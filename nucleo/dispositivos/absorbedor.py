"""Absorbedor puntual — arfada 1 GDL."""

from __future__ import annotations

import math
from dataclasses import dataclass

import numpy as np

from nucleo.constantes import BETZ_LIMITE, RHO_AGUA_MAR, G  # noqa: F401
from nucleo.dispositivos.base import ContextoRecurso, DispositivoBase, registrar_dispositivo
from nucleo.electrico import crear_eslabon_generador
from nucleo.hidrodinamica import coeficientes, rigidez_hidrostatica
from nucleo.integradores import integrar_adaptativo
from nucleo.olas import densidad_potencia_w_m, longitud_onda
from nucleo.pto import avisos_oficio, crear_eslabon_pto, registrar_picos
from nucleo.resultado import Eslabon, Resultado


@dataclass(frozen=True, slots=True)
class ConfigAbsorbedor:
    diametro_m: float = 10.0
    masa_kg: float = 80000.0
    b_pto_ns_m: float = 80000.0
    k_pto_n_m: float = 0.0
    potencia_nominal_w: float = 750000.0
    tipo_pto: str = "hidraulico"
    carrera_max_m: float = 3.0


def _extraer_recurso(recurso: dict[str, object]) -> tuple[float, float]:
    hm0 = recurso.get("hm0", recurso.get("Hm0", recurso.get("hs", 2.0)))
    te = recurso.get("te", recurso.get("Te", recurso.get("tp", 8.0)))
    # si viene Tp convertir a Te por factor 1/1.12 (JONSWAP gamma 3.3)
    if "tp" in recurso or "Tp" in recurso:
        tp_val = float(recurso.get("tp", recurso.get("Tp", te)))  # type: ignore[arg-type]
        te = tp_val / 1.12
    return float(hm0), float(te)  # type: ignore[arg-type]


def _kh(diametro_m: float, rho: float, g: float) -> float:
    return rigidez_hidrostatica(diametro_m, rho, g)


def _frecuencia_natural_iterativa(
    masa_kg: float,
    diametro_m: float,
    kh: float,
    k_pto: float,
) -> tuple[float, int, str]:
    omega = 1.0
    it = 0
    for i in range(1, 20):
        coef = coeficientes(omega, diametro_m)
        a_kg = float(coef.masa_anadida_kg[0])
        omega_nuevo = math.sqrt((kh + k_pto) / (masa_kg + a_kg))
        it = i
        if abs(omega_nuevo - omega) < 1e-6:
            omega = omega_nuevo
            break
        omega = omega_nuevo
    fuente = "iteracion Kh/(m+A(wn)) — A de literatura Falnes/Babarit"
    return float(omega), int(it), fuente


def _potencia_por_integracion(
    masa_kg: float,
    diametro_m: float,
    hm0: float,
    te: float,
    b_pto: float,
    k_pto: float,
    kh: float,
    rho: float,
    g: float,
) -> tuple[float, np.ndarray, np.ndarray, float, str]:
    omega = 2.0 * math.pi / float(te)
    coef = coeficientes(omega, diametro_m, hm0=float(hm0))
    a_kg = float(coef.masa_anadida_kg[0])
    b_rad = float(coef.amortiguamiento_ns_m[0])
    fe_amp = float(coef.fuerza_excitacion_n_m[0])
    masa_total = masa_kg + a_kg
    b_total = b_rad + b_pto
    k_total = kh + k_pto

    def fe_t(t: float) -> float:
        return fe_amp * math.cos(omega * t)

    def fun(t: float, y: np.ndarray) -> np.ndarray:
        z = float(y[0])
        v = float(y[1])
        a = (fe_t(t) - b_total * v - k_total * z) / masa_total
        return np.array([v, a])

    t_span = (0.0, 20.0 * float(te))
    n_eval = 4000
    t_eval = np.linspace(t_span[0], t_span[1], n_eval)
    y0 = np.array([0.0, 0.0])
    _, y = integrar_adaptativo(fun, t_span, y0, t_eval=t_eval)
    v_serie = y[1, :]
    z_serie = y[0, :]
    # descartar transitorio: promediar ultimos 10 periodos
    n_ult = int(10 * float(te) / (t_eval[1] - t_eval[0]))
    n_ult = max(100, min(n_ult, len(v_serie)))
    v_est = v_serie[-n_ult:]
    p_inst = b_pto * v_est * v_est
    p_media = float(np.mean(p_inst))
    fe_desc = f"Fe cos(wt) amp {fe_amp:.0f} N — solve_ivp RK45 20Te"
    return p_media, z_serie, v_serie, fe_amp, fe_desc


def _potencia_incidente(hm0: float, te: float, diametro_m: float) -> tuple[float, float]:
    j_w_m = densidad_potencia_w_m(hm0, te)
    p_inc = j_w_m * float(diametro_m)
    return float(p_inc), float(j_w_m)


def _ancho_captura(p_cap: float, j_w_m: float) -> float:
    if j_w_m <= 0:
        return 0.0
    return float(p_cap / j_w_m)


class AbsorbedorPuntual(DispositivoBase):
    familia = "undimotriz"
    nombre = "absorbedor puntual"

    def __init__(self, config: ConfigAbsorbedor | None = None) -> None:
        self.config = config or ConfigAbsorbedor()

    def potencia_incidente_w(self, recurso: dict[str, object], contexto: ContextoRecurso) -> float:
        hm0, te = _extraer_recurso(recurso)
        p_inc, _ = _potencia_incidente(hm0, te, self.config.diametro_m)
        return p_inc

    def resolver(self, recurso: dict[str, object], contexto: ContextoRecurso) -> Resultado:
        hm0, te = _extraer_recurso(recurso)
        rho = float(contexto.rho)
        g = float(contexto.g)
        prof = float(contexto.profundidad_m)
        cfg = self.config

        kh = _kh(cfg.diametro_m, rho, g)
        omega_n, n_iter, fuente_wn = _frecuencia_natural_iterativa(
            cfg.masa_kg, cfg.diametro_m, kh, cfg.k_pto_n_m
        )
        p_cap_raw, z_serie, v_serie, fe_amp, fe_desc = _potencia_por_integracion(
            cfg.masa_kg, cfg.diametro_m, hm0, te, cfg.b_pto_ns_m, cfg.k_pto_n_m, kh, rho, g
        )
        p_inc, j_w_m = _potencia_incidente(hm0, te, cfg.diametro_m)

        avisos: list[str] = []

        # invariante 7.1 captura <= incidente
        p_cap = float(p_cap_raw)
        if p_cap > p_inc > 0:
            avisos.append(
                f"captura {p_cap:.0f} W > incidente {p_inc:.0f} W — acotada a incidente (7.1)"
            )
            p_cap = float(p_inc)

        # invariante 7.2 ancho captura <= lambda/2pi
        omega = 2.0 * math.pi / float(te)
        lam = longitud_onda(omega, prof, g)
        limite_l = lam / (2.0 * math.pi)
        ancho = _ancho_captura(p_cap, j_w_m)
        if ancho > limite_l:
            avisos.append(
                f"ancho captura {ancho:.1f} m > lambda/2pi {limite_l:.1f} m — acotado (7.2) lam={lam:.1f} m"
            )
            p_cap = float(limite_l * j_w_m)
            ancho = float(limite_l)

        # cota Falnes
        coef = coeficientes(omega, cfg.diametro_m, hm0=float(hm0))
        b_rad = float(coef.amortiguamiento_ns_m[0])
        p_falnes = (fe_amp * fe_amp) / (8.0 * b_rad) if b_rad > 0 else float("inf")
        if p_cap > p_falnes:
            avisos.append(f"captura supera cota Falnes {p_falnes:.0f} W — acotada")
            p_cap = float(p_falnes)

        # 3.2 reglas oficio como avisos
        avisos.extend(avisos_oficio(un_grado_libertad=True, referencia_fija=True))

        # 3.4 picos por tope carrera
        info_picos = registrar_picos(z_serie, cfg.carrera_max_m)
        if int(info_picos["n_picos"]) > 0:  # type: ignore[arg-type]
            avisos.append(str(info_picos["aviso"]))

        # extrapolacion hidrodinamica
        if coef.aviso_extrapolacion:
            avisos.append(coef.aviso_extrapolacion)

        rend_captura = (p_cap / p_inc) if p_inc > 0 else 0.0
        rend_captura = max(0.0, min(1.0, rend_captura))

        es_captura = Eslabon(
            nombre="captura",
            potencia_entrada_w=float(p_inc),
            potencia_salida_w=float(p_cap),
            rendimiento=float(rend_captura),
            detalle={
                "hm0_m": float(hm0),
                "te_s": float(te),
                "j_w_m": float(j_w_m),
                "kh_n_m": float(kh),
                "omega_n_rad_s": float(omega_n),
                "n_iter_frecuencia_natural": int(n_iter),
                "fuente_frecuencia_natural": fuente_wn,
                "fe_desc": fe_desc,
                "ancho_captura_m": float(ancho),
                "limite_lambda_2pi_m": float(limite_l),
                "p_falnes_w": float(p_falnes) if math.isfinite(p_falnes) else 0.0,
                "picos": info_picos,
                "fuente_hidrodinamica": coef.fuente,
            },
        )

        es_pto = crear_eslabon_pto(float(p_cap), cfg.tipo_pto)
        p_pto_out = float(es_pto.potencia_salida_w)

        es_gen, res_elec = crear_eslabon_generador(
            p_pto_out, cfg.potencia_nominal_w, rendimiento_generador=0.90
        )

        eslabones = [es_captura, es_pto, es_gen]
        # validar rendimientos 0-1 (7.3)
        for e in eslabones:
            if not 0.0 <= e.rendimiento <= 1.0:
                avisos.append(f"rendimiento fuera [0,1] en {e.nombre}: {e.rendimiento}")

        horas = 8766.0
        disp = 0.95
        p_entregada = float(es_gen.potencia_salida_w)
        prod_mwh = p_entregada * horas * disp / 1e6
        factor = (
            (prod_mwh * 1e6) / (cfg.potencia_nominal_w * horas)
            if cfg.potencia_nominal_w > 0
            else 0.0
        )

        return Resultado(
            recurso=dict(recurso),
            eslabones=eslabones,
            potencia_nominal_w=float(cfg.potencia_nominal_w),
            produccion_anual_mwh=float(prod_mwh),
            factor_planta=float(factor),
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
                    "diametro_m": cfg.diametro_m,
                    "masa_kg": cfg.masa_kg,
                    "b_pto_ns_m": cfg.b_pto_ns_m,
                    "k_pto_n_m": cfg.k_pto_n_m,
                    "potencia_nominal_w": cfg.potencia_nominal_w,
                    "tipo_pto": cfg.tipo_pto,
                    "carrera_max_m": cfg.carrera_max_m,
                },
                "contexto": {"rho": rho, "g": g, "profundidad_m": prof},
            },
        )


registrar_dispositivo("absorbedor", AbsorbedorPuntual)
registrar_dispositivo("absorbedor_puntual", AbsorbedorPuntual)
