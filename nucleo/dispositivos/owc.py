"""OWC — columna de agua oscilante en rompeolas."""

from __future__ import annotations

import math
from dataclasses import dataclass

import numpy as np

from nucleo.constantes import RHO_AGUA_MAR, G  # noqa: F401
from nucleo.dispositivos.base import ContextoRecurso, DispositivoBase, registrar_dispositivo
from nucleo.electrico import crear_eslabon_generador
from nucleo.hidrodinamica import coeficientes, rigidez_hidrostatica
from nucleo.integradores import integrar_adaptativo
from nucleo.olas import densidad_potencia_w_m, longitud_onda
from nucleo.pto import (
    avisos_oficio,
    crear_eslabon_pto,
    eficiencia_impulso,
    eficiencia_wells,
    registrar_picos,
)
from nucleo.resultado import Eslabon, Resultado


@dataclass(frozen=True, slots=True)
class ConfigOWC:
    ancho_camara_m: float = 12.0
    diametro_columna_m: float = 6.0
    masa_columna_kg: float = 40000.0
    b_pto_ns_m: float = 60000.0
    k_pto_n_m: float = 0.0
    potencia_nominal_w: float = 296000.0
    tipo_pto: str = "aire"
    tipo_turbina: str = "wells"
    obra_civil_compartida: bool = False
    carrera_max_m: float = 2.5


def _extraer_recurso(recurso: dict[str, object]) -> tuple[float, float]:
    hm0 = recurso.get("hm0", recurso.get("Hm0", 2.0))
    te = recurso.get("te", recurso.get("Te", 8.0))
    if "tp" in recurso or "Tp" in recurso:
        tp_val = float(recurso.get("tp", recurso.get("Tp", te)))  # type: ignore[arg-type]
        te = tp_val / 1.12
    return float(hm0), float(te)  # type: ignore[arg-type]


def _potencia_incidente(hm0: float, te: float, ancho_m: float) -> tuple[float, float]:
    j = densidad_potencia_w_m(hm0, te)
    return float(j * ancho_m), float(j)


def _kh_owc(diametro_m: float, rho: float, g: float) -> float:
    return rigidez_hidrostatica(diametro_m, rho, g)


def _integrar_owc(
    masa_kg: float,
    diametro_m: float,
    hm0: float,
    te: float,
    b_pto: float,
    k_pto: float,
    kh: float,
) -> tuple[float, np.ndarray, np.ndarray, float]:
    omega = 2.0 * math.pi / float(te)
    coef = coeficientes(omega, diametro_m, hm0=float(hm0))
    a_kg = float(coef.masa_anadida_kg[0])
    b_rad = float(coef.amortiguamiento_ns_m[0])
    fe_amp = float(coef.fuerza_excitacion_n_m[0])
    m_tot = masa_kg + a_kg
    b_tot = b_rad + b_pto
    k_tot = kh + k_pto

    def fe_t(t: float) -> float:
        return fe_amp * math.cos(omega * t)

    def fun(t: float, y: np.ndarray) -> np.ndarray:
        z = float(y[0])
        v = float(y[1])
        a = (fe_t(t) - b_tot * v - k_tot * z) / m_tot
        return np.array([v, a])

    t_span = (0.0, 20.0 * float(te))
    t_eval = np.linspace(t_span[0], t_span[1], 4000)
    _, y = integrar_adaptativo(fun, t_span, np.array([0.0, 0.0]), t_eval=t_eval)
    v_serie = y[1, :]
    z_serie = y[0, :]
    n_ult = max(100, int(10 * float(te) / (t_eval[1] - t_eval[0])))
    n_ult = min(n_ult, len(v_serie))
    p_media = float(np.mean(b_pto * v_serie[-n_ult:] * v_serie[-n_ult:]))
    return p_media, z_serie, v_serie, fe_amp


def _acotar_captura_owc(
    p_raw: float, p_inc: float, j_wm: float, lam: float, p_falnes: float
) -> tuple[float, float, float, list[str]]:
    avisos: list[str] = []
    p_cap = float(max(p_raw, 0.0))
    if p_cap > p_inc > 0:
        avisos.append(f"captura {p_cap:.0f} W > incidente {p_inc:.0f} W — acotada (7.1)")
        p_cap = float(p_inc)
    limite = lam / (2.0 * math.pi)
    ancho = p_cap / j_wm if j_wm > 0 else 0.0
    if ancho > limite:
        avisos.append(f"ancho captura {ancho:.1f} m > lambda/2pi {limite:.1f} m — acotado (7.2)")
        p_cap = float(limite * j_wm)
        ancho = float(limite)
    if math.isfinite(p_falnes) and p_cap > p_falnes:
        p_cap = float(p_falnes)
    return p_cap, ancho, limite, avisos


def _evaluar_turbinas(v_serie: np.ndarray) -> tuple[float, float, float]:
    v_dis = float(np.percentile(np.abs(v_serie), 90)) if len(v_serie) else 1.0
    v_dis = max(v_dis, 0.5)
    v_medio = (
        float(np.mean(np.abs(v_serie[-500:])))
        if len(v_serie) >= 500
        else float(np.mean(np.abs(v_serie)))
    )
    caudal_norm = v_medio / v_dis if v_dis > 0 else 1.0
    return caudal_norm, eficiencia_wells(caudal_norm), eficiencia_impulso(caudal_norm)


def _avisos_owc(cfg: ConfigOWC, coef: object, info_picos: dict[str, object]) -> list[str]:
    avisos: list[str] = []
    if int(info_picos["n_picos"]) > 0:  # type: ignore[arg-type]
        avisos.append(str(info_picos["aviso"]))
    if cfg.obra_civil_compartida:
        avisos.append(
            "OWC en rompeolas: obra civil compartida — no afecta fisica, reduce coste imputable (Mutriku)"
        )
    else:
        avisos.append("OWC: obra civil imputable al proyecto — afecta coste por MWh, no fisica")
    aviso_ext = getattr(coef, "aviso_extrapolacion", None)
    if aviso_ext:
        avisos.append(str(aviso_ext))
    return avisos


class OWC(DispositivoBase):
    familia = "undimotriz"
    nombre = "owc"

    def __init__(self, config: ConfigOWC | None = None) -> None:
        self.config = config or ConfigOWC()

    def potencia_incidente_w(self, recurso: dict[str, object], contexto: ContextoRecurso) -> float:
        hm0, te = _extraer_recurso(recurso)
        p_inc, _ = _potencia_incidente(hm0, te, self.config.ancho_camara_m)
        return p_inc

    def resolver(self, recurso: dict[str, object], contexto: ContextoRecurso) -> Resultado:
        hm0, te = _extraer_recurso(recurso)
        rho = float(contexto.rho)
        g = float(contexto.g)
        prof = float(contexto.profundidad_m)
        cfg = self.config
        kh = _kh_owc(cfg.diametro_columna_m, rho, g)
        p_raw, z_serie, v_serie, fe_amp = _integrar_owc(
            cfg.masa_columna_kg, cfg.diametro_columna_m, hm0, te, cfg.b_pto_ns_m, cfg.k_pto_n_m, kh
        )
        p_inc, j_wm = _potencia_incidente(hm0, te, cfg.ancho_camara_m)
        omega = 2.0 * math.pi / float(te)
        lam = longitud_onda(omega, prof, g)
        coef = coeficientes(omega, cfg.diametro_columna_m, hm0=float(hm0))
        b_rad = float(coef.amortiguamiento_ns_m[0])
        p_falnes = (fe_amp * fe_amp) / (8.0 * b_rad) if b_rad > 0 else float("inf")
        p_cap, ancho, limite, avisos_acot = _acotar_captura_owc(p_raw, p_inc, j_wm, lam, p_falnes)
        caudal_norm, eff_w, eff_i = _evaluar_turbinas(v_serie)
        info_picos = registrar_picos(z_serie, cfg.carrera_max_m)
        avisos = avisos_acot + avisos_oficio(un_grado_libertad=True, referencia_fija=True)
        avisos += _avisos_owc(cfg, coef, info_picos)

        rend_cap = (p_cap / p_inc) if p_inc > 0 else 0.0
        rend_cap = max(0.0, min(1.0, rend_cap))
        es_cap = Eslabon(
            nombre="captura",
            potencia_entrada_w=float(p_inc),
            potencia_salida_w=float(p_cap),
            rendimiento=float(rend_cap),
            detalle={
                "hm0_m": float(hm0),
                "te_s": float(te),
                "j_w_m": float(j_wm),
                "ancho_captura_m": float(ancho),
                "limite_lambda_2pi_m": float(limite),
                "p_falnes_w": float(p_falnes) if math.isfinite(p_falnes) else 0.0,
                "tipo_turbina": cfg.tipo_turbina,
                "eficiencia_wells": float(eff_w),
                "eficiencia_impulso": float(eff_i),
                "caudal_norm": float(caudal_norm),
                "obra_civil_compartida": bool(cfg.obra_civil_compartida),
                "picos": info_picos,
                "fuente_hidrodinamica": coef.fuente,
            },
        )
        es_pto = crear_eslabon_pto(float(p_cap), cfg.tipo_pto)
        if cfg.tipo_pto == "aire":
            avisos.append(
                "PTO aire 55% — mas bajo de los cinco tipos, caracteristica OWC no defecto"
            )
        p_pto_out = float(es_pto.potencia_salida_w)
        es_gen, res_elec = crear_eslabon_generador(
            p_pto_out, cfg.potencia_nominal_w, rendimiento_generador=0.90
        )
        eslabones = [es_cap, es_pto, es_gen]
        for e in eslabones:
            if not 0.0 <= e.rendimiento <= 1.0:
                avisos.append(f"rendimiento fuera [0,1] en {e.nombre}: {e.rendimiento}")
        horas = 8766.0
        disp = 0.95
        p_ent = float(es_gen.potencia_salida_w)
        prod = p_ent * horas * disp / 1e6
        fp = (prod * 1e6) / (cfg.potencia_nominal_w * horas) if cfg.potencia_nominal_w > 0 else 0.0
        return Resultado(
            recurso=dict(recurso),
            eslabones=eslabones,
            potencia_nominal_w=float(cfg.potencia_nominal_w),
            produccion_anual_mwh=float(prod),
            factor_planta=float(fp),
            disponibilidad=float(disp),
            horas_ano=float(horas),
            avisos=avisos,
            series={
                "z_m": z_serie,
                "v_ms": v_serie,
                "potencia_recortada_w": res_elec.potencia_recortada_w,
            },
            metadatos={
                "dispositivo": self.nombre,
                "familia": self.familia,
                "config": {
                    "ancho_camara_m": cfg.ancho_camara_m,
                    "diametro_columna_m": cfg.diametro_columna_m,
                    "masa_columna_kg": cfg.masa_columna_kg,
                    "b_pto_ns_m": cfg.b_pto_ns_m,
                    "k_pto_n_m": cfg.k_pto_n_m,
                    "potencia_nominal_w": cfg.potencia_nominal_w,
                    "tipo_pto": cfg.tipo_pto,
                    "tipo_turbina": cfg.tipo_turbina,
                    "obra_civil_compartida": cfg.obra_civil_compartida,
                    "carrera_max_m": cfg.carrera_max_m,
                },
                "contexto": {"rho": rho, "g": g, "profundidad_m": prof},
            },
        )


registrar_dispositivo("owc", OWC)
