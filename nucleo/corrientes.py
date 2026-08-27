from __future__ import annotations

import math
from dataclasses import dataclass

import numpy as np

from nucleo.constantes import RHO_AGUA_MAR, RHO_AIRE
from nucleo.mareas import Constituyente, generar_serie_mareal


def potencia_corriente(
    velocidad_ms: float | np.ndarray,
    area_m2: float,
    cp: float,
    rho: float = RHO_AGUA_MAR,
) -> float | np.ndarray:
    if area_m2 <= 0:
        raise ValueError("area debe ser positiva")
    if not 0.0 <= cp <= 1.0:
        raise ValueError("Cp debe estar en [0, 1]")
    v = np.asarray(velocidad_ms, dtype=float)
    pot = 0.5 * rho * area_m2 * cp * np.power(np.abs(v), 3)
    if pot.ndim == 0:
        return float(pot)
    return pot


def potencia_corriente_escalar(
    velocidad_ms: float,
    area_m2: float,
    cp: float,
    rho: float = RHO_AGUA_MAR,
) -> float:
    if area_m2 <= 0:
        raise ValueError("area debe ser positiva")
    if not 0.0 <= cp <= 1.0:
        raise ValueError("Cp debe estar en [0, 1]")
    return 0.5 * rho * area_m2 * cp * abs(velocidad_ms) ** 3


@dataclass(frozen=True, slots=True)
class ResultadoIntegracionCorriente:
    energia_integrada_j: float
    energia_vel_media_j: float
    potencia_media_integrada_w: float
    potencia_vel_media_w: float
    velocidad_media_ms: float
    duracion_s: float
    periodo_cubierto: str
    metodo_valido: str
    estacion: str


def generar_serie_velocidad(
    constituyentes: tuple[Constituyente, ...],
    duracion_dias: float = 30.0,
    dt_horas: float = 0.5,
    factor_velocidad: float = 1.0,
) -> tuple[np.ndarray, np.ndarray, str]:
    serie = generar_serie_mareal(
        duracion_dias=duracion_dias, dt_horas=dt_horas, constituyentes=constituyentes
    )
    # Para corriente: escalar amplitudes a velocidad
    # Mejor: reconstruir directamente como velocidad con las mismas frecuencias
    tiempo_s = serie.tiempo_s
    vel = np.zeros_like(tiempo_s, dtype=float)
    for c in constituyentes:
        w = 2.0 * math.pi * c.frecuencia_hz
        vel += c.amplitud_m * factor_velocidad * np.cos(w * tiempo_s + c.fase_rad)
    return tiempo_s, vel, serie.estacion


def energia_por_integracion(
    tiempo_s: np.ndarray,
    velocidad_ms: np.ndarray,
    area_m2: float,
    cp: float,
    rho: float = RHO_AGUA_MAR,
    constituyentes: tuple[Constituyente, ...] | None = None,
    estacion: str = "",
) -> ResultadoIntegracionCorriente:
    if len(tiempo_s) != len(velocidad_ms):
        raise ValueError("tiempo y velocidad deben tener igual longitud")
    if len(tiempo_s) < 2:
        raise ValueError("se necesitan al menos 2 puntos")
    tiempo_s = np.asarray(tiempo_s, dtype=float)
    velocidad_ms = np.asarray(velocidad_ms, dtype=float)
    pot_serie = 0.5 * rho * area_m2 * cp * np.power(np.abs(velocidad_ms), 3)
    energia_integrada = float(np.trapezoid(pot_serie, tiempo_s))
    duracion = float(tiempo_s[-1] - tiempo_s[0])
    if duracion <= 0:
        duracion = float(len(tiempo_s)) * 3600.0
    v_media = float(np.mean(np.abs(velocidad_ms)))
    v_media_con_signo = float(np.mean(velocidad_ms))
    # velocidad media con signo puede ser ~0; usar media de valor absoluto para comparacion
    # pero segun spec se evalua con la velocidad media de la serie (con signo -> ~0, ilustra el error)
    # Ofrecemos ambas; la no valida es con media con signo
    pot_vel_media = 0.5 * rho * area_m2 * cp * abs(v_media_con_signo) ** 3
    energia_vel_media = pot_vel_media * duracion
    # Tambien reportar potencia con v_media_abs para contexto
    potencia_media_integrada = energia_integrada / duracion if duracion > 0 else 0.0
    periodo_txt = f"{duracion / 86400.0:.1f} dias ({duracion / 3600.0:.0f} h)"
    if constituyentes is not None and len(constituyentes) > 0:
        nombres = ", ".join(c.nombre for c in constituyentes)
        periodo_txt += f" | constituyentes: {nombres}"
    if estacion:
        periodo_txt += f" | estacion: {estacion}"
    return ResultadoIntegracionCorriente(
        energia_integrada_j=energia_integrada,
        energia_vel_media_j=float(energia_vel_media),
        potencia_media_integrada_w=float(potencia_media_integrada),
        potencia_vel_media_w=float(pot_vel_media),
        velocidad_media_ms=v_media,
        duracion_s=duracion,
        periodo_cubierto=periodo_txt,
        metodo_valido="integracion de V(t)^3 sobre la serie",
        estacion=estacion,
    )


def energia_corriente_desde_constituyentes(
    constituyentes: tuple[Constituyente, ...],
    area_m2: float,
    cp: float,
    rho: float = RHO_AGUA_MAR,
    duracion_dias: float = 30.0,
    dt_horas: float = 0.5,
    factor_velocidad: float = 1.0,
) -> ResultadoIntegracionCorriente:
    tiempo_s, velocidad_ms, estacion = generar_serie_velocidad(
        constituyentes, duracion_dias, dt_horas, factor_velocidad
    )
    return energia_por_integracion(
        tiempo_s, velocidad_ms, area_m2, cp, rho, constituyentes, estacion
    )


def relacion_densidades(rho_agua: float = RHO_AGUA_MAR, rho_aire: float = RHO_AIRE) -> float:
    if rho_aire <= 0:
        raise ValueError("rho_aire debe ser positivo")
    return rho_agua / rho_aire


def velocidad_viento_equivalente(
    velocidad_agua_ms: float,
    rho_agua: float = RHO_AGUA_MAR,
    rho_aire: float = RHO_AIRE,
) -> float:
    if velocidad_agua_ms < 0:
        raise ValueError("velocidad debe ser no negativa")
    if rho_aire <= 0:
        raise ValueError("rho_aire debe ser positivo")
    rel = rho_agua / rho_aire
    return velocidad_agua_ms * rel ** (1.0 / 3.0)


def contraste_agua_aire(
    velocidad_agua_ms: float = 3.0,
    rho_agua: float = RHO_AGUA_MAR,
    rho_aire: float = RHO_AIRE,
) -> dict[str, float]:
    rel = relacion_densidades(rho_agua, rho_aire)
    v_eq = velocidad_viento_equivalente(velocidad_agua_ms, rho_agua, rho_aire)
    return {
        "relacion_densidades": rel,
        "velocidad_agua_ms": velocidad_agua_ms,
        "velocidad_viento_equivalente_ms": v_eq,
        "rho_agua": rho_agua,
        "rho_aire": rho_aire,
    }
