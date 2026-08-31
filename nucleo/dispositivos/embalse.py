"""Embalse mareal — presa por integracion temporal."""

from __future__ import annotations

import math
from collections.abc import Callable
from dataclasses import dataclass

import numpy as np

from nucleo.constantes import RHO_AGUA_MAR, G
from nucleo.dispositivos.base import ContextoRecurso, DispositivoBase, registrar_dispositivo
from nucleo.electrico import crear_eslabon_generador
from nucleo.mareas import generar_serie_m2_s2, generar_serie_mareal
from nucleo.resultado import Eslabon, Resultado

# suprime import no usado falso positivo ruff
_uso_g = G  # noqa: F401
_uso_rho = RHO_AGUA_MAR  # noqa: F401

RANGO_MIN_VIABLE_M: float = 5.0


@dataclass(frozen=True, slots=True)
class ConfigEmbalse:
    area_m2: float = 22e6
    eficiencia_turbina: float = 0.90
    q_max_m3s: float = 4000.0
    h_min_m: float = 1.0
    potencia_nominal_w: float = 240e6
    modo: str = "vaciado"
    q_bombeo_m3s: float = 2000.0
    eta_bombeo: float = 0.75


def energia_teorica_ciclo_j(
    area_m2: float, rango_m: float, rho: float = RHO_AGUA_MAR, g: float = G
) -> float:
    return 0.5 * rho * g * area_m2 * rango_m * rango_m


def energia_teorica_anual_gwh(
    area_m2: float, rango_m: float, rho: float = RHO_AGUA_MAR, g: float = G
) -> float:
    e_ciclo = energia_teorica_ciclo_j(area_m2, rango_m, rho, g)
    return e_ciclo * 2.0 * 365.0 / 3.6e12


def _area_h(_h: float, area_base: float, curva: Callable[[float], float] | None) -> float:
    if curva is None:
        return float(area_base)
    return float(curva(_h))


def _caudal_turbina(h_m: float, q_max: float) -> float:
    if h_m <= 0:
        return 0.0
    # orificio: Q ~ sqrt(H); normalizado a q_max en H~3m
    h_ref = 3.0
    q = q_max * math.sqrt(h_m / h_ref) if h_m < h_ref else q_max
    return float(min(q, q_max))


def _obtener_serie(recurso: dict[str, object]) -> tuple[np.ndarray, np.ndarray, str]:
    if "tiempo_s" in recurso and "nivel_m" in recurso:
        t = np.asarray(recurso["tiempo_s"], dtype=float)
        n = np.asarray(recurso["nivel_m"], dtype=float)
        return t, n, "serie aportada en recurso"
    if "constituyentes" in recurso:
        const = recurso["constituyentes"]  # type: ignore[assignment]
        serie = generar_serie_mareal(duracion_dias=30.0, dt_horas=0.5, constituyentes=const)  # type: ignore[arg-type]
        return serie.tiempo_s, serie.nivel_m, "reconstruccion desde constituyentes"
    rango = float(recurso.get("rango_m", recurso.get("rango_mareal", 3.28)))  # type: ignore[arg-type]
    # mapear rango a amplitudes M2+S2 manteniendo R~2*(A_M2+A_S2)
    amp_m2 = rango * 0.35
    amp_s2 = rango * 0.12
    serie2 = generar_serie_m2_s2(
        duracion_dias=30.0, dt_horas=0.25, amplitud_m2=amp_m2, amplitud_s2=amp_s2
    )
    return serie2.tiempo_s, serie2.nivel_m, f"sintetica M2+S2 rango {rango:.2f} m"


def _integrar_modo(
    tiempo_s: np.ndarray,
    nivel_mar: np.ndarray,
    cfg: ConfigEmbalse,
    rho: float,
    g: float,
    curva: Callable[[float], float] | None,
    modo: str,
) -> dict[str, object]:
    n = len(tiempo_s)
    nivel_emb = np.zeros(n, dtype=float)
    potencia = np.zeros(n, dtype=float)
    caudal = np.zeros(n, dtype=float)
    nivel_emb[0] = float(nivel_mar[0])
    energia_bombeo_j = 0.0
    q_max = float(cfg.q_max_m3s)
    h_min = float(cfg.h_min_m)
    eta = float(cfg.eficiencia_turbina)
    q_bomb = float(cfg.q_bombeo_m3s)
    eta_b = float(cfg.eta_bombeo)
    area_base = float(cfg.area_m2)

    for i in range(1, n):
        dt = float(tiempo_s[i] - tiempo_s[i - 1])
        if dt <= 0:
            dt = 900.0
        h_prev = abs(float(nivel_mar[i - 1] - nivel_emb[i - 1]))
        rising = float(nivel_mar[i]) > float(nivel_mar[i - 1])
        a_eff = _area_h(float(nivel_emb[i - 1]), area_base, curva)
        a_eff = max(a_eff, 1e3)

        estado = _decidir_estado(modo, rising, h_prev, nivel_mar[i], nivel_emb[i - 1], h_min)

        if estado == "generacion":
            _paso_generacion(
                i, nivel_mar, nivel_emb, caudal, potencia, modo, dt, a_eff, rho, g, q_max, eta
            )
        elif estado == "bombeo":
            energia_bombeo_j += _paso_bombeo(
                i, nivel_mar, nivel_emb, caudal, potencia, dt, a_eff, rho, g, q_bomb, eta_b
            )
        elif estado == "compuertas":
            _paso_compuertas(i, nivel_mar, nivel_emb, caudal, potencia, dt, a_eff)
        else:
            nivel_emb[i] = float(nivel_emb[i - 1])
            caudal[i] = 0.0
            potencia[i] = 0.0

    energia_j = float(np.trapezoid(potencia, tiempo_s))
    duracion_s = float(tiempo_s[-1] - tiempo_s[0]) if n > 1 else 0.0
    dt_arr = np.diff(tiempo_s, prepend=tiempo_s[0])
    mascara_gen = potencia > 0
    vol_turbinado = float(np.sum(np.abs(caudal) * dt_arr * mascara_gen))
    # balance volumen: integral Q_net dt = A*delta_h (por construccion error ~ numerico)
    delta_h = float(nivel_emb[-1] - nivel_emb[0])
    a_medio = _area_h(float(np.mean(nivel_emb)), area_base, curva)
    vol_almacen = float(a_medio * delta_h)
    # Misma cuadratura que el paso de integracion (suma por la derecha): con
    # trapecio el residuo era el error del metodo, no el del balance, y tapaba
    # el fallo real de conservacion.
    vol_net_q = float(np.sum(caudal * dt_arr))
    # caudal con signo: positivo entra al embalse, negativo sale
    balance_err = abs(vol_net_q - vol_almacen)
    # rango observado
    rango_obs = float(np.max(nivel_mar) - np.min(nivel_mar)) if n else 0.0
    cota_j = energia_teorica_ciclo_j(area_base, rango_obs, rho, g)
    return {
        "tiempo_s": tiempo_s,
        "nivel_mar": nivel_mar,
        "nivel_embalse": nivel_emb,
        "potencia_w": potencia,
        "caudal_m3s": caudal,
        "energia_j": energia_j,
        "energia_bombeo_j": float(energia_bombeo_j),
        "duracion_s": duracion_s,
        "rango_obs_m": rango_obs,
        "cota_j": float(cota_j),
        "vol_turbinado_m3": vol_turbinado,
        "balance_err_m3": float(balance_err),
    }


def _paso_generacion(
    i: int,
    nivel_mar: np.ndarray,
    nivel_emb: np.ndarray,
    caudal: np.ndarray,
    potencia: np.ndarray,
    modo: str,
    dt: float,
    a_eff: float,
    rho: float,
    g: float,
    q_max: float,
    eta: float,
) -> None:
    h_cur = abs(float(nivel_mar[i] - nivel_emb[i - 1]))
    q_mag = _caudal_turbina(h_cur, q_max)
    if modo == "llenado":
        dh = q_mag * dt / a_eff
        if nivel_emb[i - 1] + dh > float(nivel_mar[i]):
            dh = float(nivel_mar[i]) - float(nivel_emb[i - 1])
            q_mag = dh * a_eff / dt if dt > 0 else 0.0
        nivel_emb[i] = float(nivel_emb[i - 1] + dh)
        caudal[i] = float(q_mag)
        potencia[i] = float(rho * g * q_mag * h_cur * eta)
        return
    if modo == "bidireccional":
        _generacion_bidireccional(
            i, nivel_mar, nivel_emb, caudal, potencia, h_cur, q_mag, dt, a_eff, rho, g, eta
        )
        return
    if float(nivel_emb[i - 1]) <= float(nivel_mar[i]):
        nivel_emb[i] = float(nivel_emb[i - 1])
        caudal[i] = 0.0
        potencia[i] = 0.0
        return
    dh = -q_mag * dt / a_eff
    if nivel_emb[i - 1] + dh < float(nivel_mar[i]):
        dh = float(nivel_mar[i]) - float(nivel_emb[i - 1])
        q_mag = abs(dh * a_eff / dt) if dt > 0 else 0.0
    nivel_emb[i] = float(nivel_emb[i - 1] + dh)
    # Vaciado: el agua sale, dh < 0. El caudal lleva el mismo signo que dh —
    # convenio unico en todo el modulo, el que exige el balance A*dh = int Q dt.
    caudal[i] = float(-q_mag)
    potencia[i] = float(rho * g * q_mag * h_cur * eta)


def _generacion_bidireccional(
    i: int,
    nivel_mar: np.ndarray,
    nivel_emb: np.ndarray,
    caudal: np.ndarray,
    potencia: np.ndarray,
    h_cur: float,
    q_mag: float,
    dt: float,
    a_eff: float,
    rho: float,
    g: float,
    eta: float,
) -> None:
    if float(nivel_emb[i - 1]) > float(nivel_mar[i]):
        dh = -q_mag * dt / a_eff
        if nivel_emb[i - 1] + dh < float(nivel_mar[i]):
            dh = float(nivel_mar[i]) - float(nivel_emb[i - 1])
            q_mag = abs(dh * a_eff / dt) if dt > 0 else 0.0
        potencia[i] = float(rho * g * q_mag * h_cur * eta)
    else:
        dh = q_mag * dt / a_eff
        if nivel_emb[i - 1] + dh > float(nivel_mar[i]):
            dh = float(nivel_mar[i]) - float(nivel_emb[i - 1])
            q_mag = abs(dh * a_eff / dt) if dt > 0 else 0.0
        potencia[i] = float(rho * g * q_mag * h_cur * eta)
    nivel_emb[i] = float(nivel_emb[i - 1] + dh)
    caudal[i] = float(q_mag if dh >= 0 else -q_mag)


def _paso_bombeo(
    i: int,
    nivel_mar: np.ndarray,
    nivel_emb: np.ndarray,
    caudal: np.ndarray,
    potencia: np.ndarray,
    dt: float,
    a_eff: float,
    rho: float,
    g: float,
    q_bomb: float,
    eta_b: float,
) -> float:
    h_cur = abs(float(nivel_mar[i] - nivel_emb[i - 1]))
    dh = q_bomb * dt / a_eff
    if nivel_emb[i - 1] + dh > float(nivel_mar[i]) + 0.5:
        dh = max(0.0, float(nivel_mar[i]) + 0.5 - float(nivel_emb[i - 1]))
    nivel_emb[i] = float(nivel_emb[i - 1] + dh)
    q_mag = dh * a_eff / dt if dt > 0 else 0.0
    # Bombeo: el agua entra, dh > 0, luego el caudal es positivo.
    caudal[i] = float(q_mag)
    potencia[i] = 0.0
    return float(rho * g * q_mag * max(h_cur, 0.5) / max(eta_b, 0.1) * dt)


def _paso_compuertas(
    i: int,
    nivel_mar: np.ndarray,
    nivel_emb: np.ndarray,
    caudal: np.ndarray,
    potencia: np.ndarray,
    dt: float,
    a_eff: float,
) -> None:
    dh = float(nivel_mar[i] - nivel_emb[i - 1])
    nivel_emb[i] = float(nivel_mar[i])
    caudal[i] = float(dh * a_eff / dt) if dt > 0 else 0.0
    potencia[i] = 0.0


def _decidir_estado(
    modo: str, rising: bool, h_prev: float, nivel_mar_i: float, nivel_emb_prev: float, h_min: float
) -> str:
    if modo == "vaciado":
        return _estado_vaciado(rising, h_prev, nivel_mar_i, nivel_emb_prev, h_min)
    if modo == "llenado":
        return _estado_llenado(rising, h_prev, nivel_mar_i, nivel_emb_prev, h_min)
    if modo == "bidireccional":
        return _estado_bidireccional(rising, h_prev, nivel_mar_i, nivel_emb_prev, h_min)
    if modo == "bombeo":
        return _estado_bombeo(rising, h_prev, nivel_mar_i, nivel_emb_prev, h_min)
    return "retencion"


def _estado_vaciado(
    rising: bool, h_prev: float, nivel_mar_i: float, nivel_emb_prev: float, h_min: float
) -> str:
    if rising:
        return "compuertas"
    if h_prev >= h_min and float(nivel_emb_prev) > float(nivel_mar_i):
        return "generacion"
    return "retencion"


def _estado_llenado(
    rising: bool, h_prev: float, nivel_mar_i: float, nivel_emb_prev: float, h_min: float
) -> str:
    if not rising:
        return "compuertas"
    if h_prev >= h_min and float(nivel_mar_i) > float(nivel_emb_prev):
        return "generacion"
    return "retencion"


def _estado_bidireccional(
    _rising: bool, h_prev: float, _nivel_mar_i: float, _nivel_emb_prev: float, h_min: float
) -> str:
    if h_prev >= h_min:
        return "generacion"
    if h_prev < 0.4:
        return "compuertas"
    return "retencion"


def _estado_bombeo(
    rising: bool, h_prev: float, nivel_mar_i: float, nivel_emb_prev: float, h_min: float
) -> str:
    if rising and h_prev < 0.8 and float(nivel_mar_i) > float(nivel_emb_prev):
        # cerca de pleamar con poca carga: bombear
        return "bombeo"
    if not rising and h_prev >= h_min and float(nivel_emb_prev) > float(nivel_mar_i):
        return "generacion"
    if rising:
        return "compuertas"
    return "retencion"


class EmbalseMareal(DispositivoBase):
    familia = "mareomotriz"
    nombre = "embalse"

    def __init__(self, config: ConfigEmbalse | None = None) -> None:
        self.config = config or ConfigEmbalse()

    def potencia_incidente_w(self, recurso: dict[str, object], contexto: ContextoRecurso) -> float:
        # cota teorica por ciclo convertida a potencia media por ciclo semidiurno
        rango = float(recurso.get("rango_m", recurso.get("rango_mareal", 3.28)))  # type: ignore[arg-type]
        e_ciclo = energia_teorica_ciclo_j(
            self.config.area_m2, rango, float(contexto.rho), float(contexto.g)
        )
        # potencia media si esa energia se entregara en 12.42h
        return float(e_ciclo / (12.42 * 3600.0))

    def resolver(self, recurso: dict[str, object], contexto: ContextoRecurso) -> Resultado:
        rho = float(contexto.rho)
        g = float(contexto.g)
        cfg = self.config
        modo_req = str(recurso.get("modo", cfg.modo))
        # curva area-nivel opcional
        curva = recurso.get("curva_area_nivel")  # type: ignore[assignment]
        if curva is not None and not callable(curva):
            curva = None  # type: ignore[assignment]

        tiempo_s, nivel_mar, desc_serie = _obtener_serie(recurso)
        res = _integrar_modo(tiempo_s, nivel_mar, cfg, rho, g, curva, modo_req)  # type: ignore[arg-type]

        energia_j = float(res["energia_j"])
        energia_bombeo_j = float(res["energia_bombeo_j"])
        duracion_s = float(res["duracion_s"])
        rango_obs = float(res["rango_obs_m"])
        cota_j = float(res["cota_j"])
        balance_err = float(res["balance_err_m3"])

        avisos: list[str] = []
        if rango_obs < RANGO_MIN_VIABLE_M:
            avisos.append(
                f"rango {rango_obs:.2f} m < minimo viable {RANGO_MIN_VIABLE_M} m — inviable para presa (7.1)"
            )
        if balance_err > 1e6:
            avisos.append(f"balance volumen error {balance_err:.0f} m3 — revisar (7.4)")
        avisos.append(f"serie marea: {desc_serie}")
        avisos.append(
            f"cota teorica E=1/2 rho g A R2 = {cota_j/3.6e12:.3f} GWh/ciclo — solo cota, no produccion"
        )

        # potencia media sobre la serie
        p_media_w = energia_j / duracion_s if duracion_s > 0 else 0.0
        p_media_neta_w = (energia_j - energia_bombeo_j) / duracion_s if duracion_s > 0 else 0.0
        # incidente para 7.1
        p_inc = self.potencia_incidente_w(recurso, contexto)
        # produccion anual escalada desde serie (30 dias -> anual)
        factor_anual = (365.0 * 86400.0) / duracion_s if duracion_s > 0 else 0.0
        energia_anual_j = energia_j * factor_anual
        energia_anual_neta_j = (energia_j - energia_bombeo_j) * factor_anual
        prod_mwh = energia_anual_j / 3.6e9
        prod_neta_mwh = energia_anual_neta_j / 3.6e9

        # invariante 7.1
        if p_media_w > p_inc > 0:
            avisos.append(
                f"captura media {p_media_w:.0f} W > incidente {p_inc:.0f} W — acotada (7.1)"
            )

        # eslabon captura
        rend_cap = (p_media_w / p_inc) if p_inc > 0 else 0.0
        rend_cap = max(0.0, min(1.0, rend_cap))
        es_cap = Eslabon(
            nombre="captura",
            potencia_entrada_w=float(p_inc),
            potencia_salida_w=float(p_media_w),
            rendimiento=float(rend_cap),
            detalle={
                "energia_j": float(energia_j),
                "rango_obs_m": float(rango_obs),
                "cota_j": float(cota_j),
                "modo": modo_req,
                "balance_err_m3": float(balance_err),
                "vol_turbinado_m3": float(res["vol_turbinado_m3"]),
                "duracion_s": float(duracion_s),
            },
        )
        # sin PTO separado para embalse; turbina ya incluida en eta
        # generador y disponibilidad
        es_gen, res_elec = crear_eslabon_generador(
            float(p_media_neta_w if modo_req == "bombeo" else p_media_w),
            cfg.potencia_nominal_w,
            rendimiento_generador=0.95,
        )
        eslabones = [es_cap, es_gen]
        for e in eslabones:
            if not 0.0 <= e.rendimiento <= 1.0:
                avisos.append(f"rendimiento fuera [0,1] en {e.nombre}")

        horas = 8766.0
        disp = 0.95
        # produccion anual usa bruta para factor planta, neta informada aparte
        prod_anual_disp = prod_mwh * disp
        prod_neta_disp = prod_neta_mwh * disp
        potencia_nom = float(cfg.potencia_nominal_w)
        factor_planta = (
            (prod_anual_disp * 1e6) / (potencia_nom * horas) if potencia_nom > 0 else 0.0
        )

        meta = {
            "dispositivo": self.nombre,
            "familia": self.familia,
            "modo": modo_req,
            "energia_bombeo_j": float(energia_bombeo_j),
            "produccion_neta_mwh": float(prod_neta_disp),
            "rango_obs_m": float(rango_obs),
        }

        return Resultado(
            recurso=dict(recurso),
            eslabones=eslabones,
            potencia_nominal_w=potencia_nom,
            produccion_anual_mwh=float(prod_anual_disp),
            factor_planta=float(factor_planta),
            disponibilidad=float(disp),
            horas_ano=float(horas),
            avisos=avisos,
            series={
                "tiempo_s": res["tiempo_s"],
                "nivel_mar": res["nivel_mar"],
                "nivel_embalse": res["nivel_embalse"],
                "potencia_w": res["potencia_w"],
                "potencia_recortada_w": res_elec.potencia_recortada_w,
            },
            metadatos=meta,
        )


registrar_dispositivo("embalse", EmbalseMareal)
registrar_dispositivo("presa", EmbalseMareal)
