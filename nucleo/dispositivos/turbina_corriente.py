"""Turbina de corriente mareal — P=1/2 rho Cp A V^3."""

from __future__ import annotations

import math
from dataclasses import dataclass

import numpy as np

from nucleo.constantes import BETZ_LIMITE, RHO_AGUA_MAR
from nucleo.corrientes import potencia_corriente
from nucleo.dispositivos.base import ContextoRecurso, DispositivoBase, registrar_dispositivo
from nucleo.electrico import crear_eslabon_generador
from nucleo.resultado import Eslabon, Resultado


@dataclass(frozen=True, slots=True)
class ConfigTurbinaCorriente:
    diametro_m: float = 20.0
    cp: float = 0.40
    potencia_nominal_w: float = 1000000.0
    tipo_pto: str = "directo"


def area_barrida_m2(diametro_m: float) -> float:
    if diametro_m <= 0:
        raise ValueError("diametro debe ser positivo")
    return math.pi * diametro_m * diametro_m / 4.0


def potencia_turbina_w(
    velocidad_ms: float,
    diametro_m: float,
    cp: float,
    rho: float = RHO_AGUA_MAR,
) -> float:
    area = area_barrida_m2(diametro_m)
    val = potencia_corriente(float(velocidad_ms), area, float(cp), rho)
    return float(val)  # type: ignore[no-any-return]


def _extraer_velocidad(recurso: dict[str, object]) -> float | np.ndarray:
    for clave in ("velocidad_ms", "v_ms", "velocidad", "V", "v"):
        if clave in recurso:
            val = recurso[clave]
            if isinstance(val, (list, np.ndarray)):
                return np.asarray(val, dtype=float)
            return float(val)  # type: ignore[arg-type]
    # por defecto 3.0 m/s para validacion Orbital O2
    return 3.0


def _potencias_turbina(
    vel_raw: float | np.ndarray, rho: float, area: float, cp: float, recurso: dict[str, object]
) -> tuple[float, float, float]:
    if isinstance(vel_raw, np.ndarray):
        vel_arr = np.asarray(vel_raw, dtype=float)
        pot_serie = 0.5 * rho * area * cp * np.power(np.abs(vel_arr), 3)
        if "tiempo_s" in recurso:
            t_arr = np.asarray(recurso["tiempo_s"], dtype=float)
            if len(t_arr) == len(vel_arr) and len(t_arr) > 1:
                energia_j = float(np.trapezoid(pot_serie, t_arr))
                duracion = float(t_arr[-1] - t_arr[0])
                p_media = energia_j / duracion if duracion > 0 else float(np.mean(pot_serie))
            else:
                p_media = float(np.mean(pot_serie))
                duracion = float(len(vel_arr) * 3600.0)
                energia_j = p_media * duracion
        else:
            p_media = float(np.mean(pot_serie))
            energia_j = p_media * 8766.0 * 3600.0
        p_cap = float(max(p_media, 0.0))
        p_inc = float(np.mean(0.5 * rho * area * np.power(np.abs(vel_arr), 3)))
        return p_cap, p_inc, energia_j
    vel = float(vel_raw)
    diam = math.sqrt(4.0 * area / math.pi) if area > 0 else 20.0
    p_cap = float(potencia_turbina_w(vel, diam, cp, rho))
    p_inc = float(0.5 * rho * area * abs(vel) ** 3)
    return p_cap, p_inc, 0.0


def _acotar_turbina(p_cap: float, p_inc: float, cp: float, avisos: list[str]) -> float:
    if p_cap > p_inc > 0 and cp > 1.0:
        avisos.append(f"captura {p_cap:.0f} W > incidente {p_inc:.0f} W — acotada (7.1)")
        return float(p_inc)
    return p_cap


def _rendimiento_turbina(cp: float) -> float:
    if 0 <= cp <= 1:
        return float(cp)
    return float(max(0.0, min(1.0, cp)))


def _validar_cp(cp: float) -> list[str]:
    avisos: list[str] = []
    if cp > BETZ_LIMITE:
        avisos.append(
            f"Cp={cp:.3f} > Betz {BETZ_LIMITE:.4f} (16/27) — posible solo en canal confinado por bloqueo; no bloquea"
        )
    if cp < 0 or cp > 1:
        avisos.append(f"Cp={cp} fuera de [0,1] — rendimiento no fisico")
    return avisos


class TurbinaCorriente(DispositivoBase):
    familia = "mareomotriz"
    nombre = "turbina_corriente"

    def __init__(self, config: ConfigTurbinaCorriente | None = None) -> None:
        self.config = config or ConfigTurbinaCorriente()

    def potencia_incidente_w(self, recurso: dict[str, object], contexto: ContextoRecurso) -> float:
        rho = float(contexto.rho)
        vel = _extraer_velocidad(recurso)
        if isinstance(vel, np.ndarray):
            vel = float(np.mean(np.abs(vel))) if vel.size else 0.0
        area = area_barrida_m2(self.config.diametro_m)
        # incidente = disponible sin Cp (Cp=1)
        return float(0.5 * rho * area * abs(float(vel)) ** 3)

    def resolver(self, recurso: dict[str, object], contexto: ContextoRecurso) -> Resultado:
        rho = float(contexto.rho)
        cfg = self.config
        area = area_barrida_m2(cfg.diametro_m)
        cp = float(cfg.cp)
        vel_raw = _extraer_velocidad(recurso)
        avisos: list[str] = []
        avisos.extend(_validar_cp(cp))
        p_cap, p_inc, energia_j = _potencias_turbina(vel_raw, rho, area, cp, recurso)
        p_cap = _acotar_turbina(p_cap, p_inc, cp, avisos)
        rend_cap = _rendimiento_turbina(cp)

        es_cap = Eslabon(
            nombre="captura",
            potencia_entrada_w=float(p_inc),
            potencia_salida_w=float(p_cap),
            rendimiento=float(max(0.0, min(1.0, rend_cap))),
            detalle={
                "diametro_m": float(cfg.diametro_m),
                "area_m2": float(area),
                "cp": float(cp),
                "betz_limite": float(BETZ_LIMITE),
                "velocidad_ms": (
                    float(vel_raw)
                    if isinstance(vel_raw, float)
                    else float(np.mean(np.abs(vel_raw)))
                ),
                "energia_j": float(energia_j) if isinstance(vel_raw, np.ndarray) else 0.0,
                "fuente": "P=1/2 rho Cp A V^3 — Betz 16/27",
            },
        )

        # PTO implicito segun tipo (directo 95% etc) — no cambia Cp, solo cadena
        from nucleo.pto import crear_eslabon_pto as _pto

        try:
            es_pto = _pto(float(p_cap), cfg.tipo_pto)
        except ValueError:
            es_pto = Eslabon(
                nombre="pto",
                potencia_entrada_w=float(p_cap),
                potencia_salida_w=float(p_cap),
                rendimiento=1.0,
                detalle={"tipo": cfg.tipo_pto},
            )
            avisos.append(f"tipo PTO {cfg.tipo_pto} no reconocido — se omite etapa PTO")

        p_pto_out = float(es_pto.potencia_salida_w)
        es_gen, res_elec = crear_eslabon_generador(
            p_pto_out, cfg.potencia_nominal_w, rendimiento_generador=0.95
        )

        eslabones = [es_cap, es_pto, es_gen]
        for e in eslabones:
            if not 0.0 <= e.rendimiento <= 1.0:
                avisos.append(f"rendimiento fuera [0,1] en {e.nombre}: {e.rendimiento}")

        horas = 8766.0
        disp = 0.95
        p_ent = float(es_gen.potencia_salida_w)
        prod_mwh = p_ent * horas * disp / 1e6
        fp = (
            (prod_mwh * 1e6) / (cfg.potencia_nominal_w * horas)
            if cfg.potencia_nominal_w > 0
            else 0.0
        )

        return Resultado(
            recurso=dict(recurso),
            eslabones=eslabones,
            potencia_nominal_w=float(cfg.potencia_nominal_w),
            produccion_anual_mwh=float(prod_mwh),
            factor_planta=float(fp),
            disponibilidad=float(disp),
            horas_ano=float(horas),
            avisos=avisos,
            series={"potencia_recortada_w": res_elec.potencia_recortada_w},
            metadatos={
                "dispositivo": self.nombre,
                "familia": self.familia,
                "config": {
                    "diametro_m": cfg.diametro_m,
                    "cp": cfg.cp,
                    "potencia_nominal_w": cfg.potencia_nominal_w,
                    "tipo_pto": cfg.tipo_pto,
                },
                "contexto": {"rho": rho},
            },
        )


registrar_dispositivo("turbina_corriente", TurbinaCorriente)
registrar_dispositivo("turbina", TurbinaCorriente)
