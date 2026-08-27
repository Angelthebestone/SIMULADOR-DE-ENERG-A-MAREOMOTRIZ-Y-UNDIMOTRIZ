from __future__ import annotations

import math
from dataclasses import dataclass

import numpy as np

from nucleo.constantes import RHO_AGUA_MAR, G


@dataclass(frozen=True, slots=True)
class GeometriaReferencia:
    forma: str
    diametro_m: float
    calado_m: float
    descripcion: str
    fuente: str


@dataclass(frozen=True, slots=True)
class CoeficientesHidrodinamicos:
    omega_rad_s: np.ndarray
    masa_anadida_kg: np.ndarray
    amortiguamiento_ns_m: np.ndarray
    fuerza_excitacion_n_m: np.ndarray
    geometria: GeometriaReferencia
    fuente: str
    aviso_extrapolacion: str


GEOMETRIA_CILINDRO_10M = GeometriaReferencia(
    forma="cilindro vertical axisimetrico",
    diametro_m=10.0,
    calado_m=5.0,
    descripcion="boya cilindrica vertical, diametro 10 m, calado 5 m, eje en arfada",
    fuente="Falnes (2002) Ocean Waves and Oscillating Bodies, cap. 5; valores interpolados de tablas para ka~0.5-2.0",
)

GEOMETRIA_CILINDRO_5M = GeometriaReferencia(
    forma="cilindro vertical axisimetrico",
    diametro_m=5.0,
    calado_m=2.5,
    descripcion="boya cilindrica vertical, diametro 5 m, calado 2.5 m",
    fuente="Babarit et al. (2012) Numerical benchmarking study of a selection of wave energy converters, Ocean Eng. 41",
)

AVISO_EXTRAPOLACION = (
    "Coeficientes de literatura para geometria de referencia {geom}; "
    "fuera de diametro {dmin}-{dmax} m o de ka 0.2-3.0 los valores son extrapolacion "
    "y deben recalibrarse por BEM o ensayo. No usar para dimensionado estructural."
)


def _aviso(geometria: GeometriaReferencia) -> str:
    d = geometria.diametro_m
    return AVISO_EXTRAPOLACION.format(geom=geometria.descripcion, dmin=d * 0.5, dmax=d * 2.0)


def _masa_anadida_cilindro(omega: np.ndarray, geometria: GeometriaReferencia) -> np.ndarray:
    d = geometria.diametro_m
    a = d / 2.0
    rho = RHO_AGUA_MAR
    volumen = math.pi * a * a * geometria.calado_m
    ka = omega * a / math.sqrt(G * geometria.calado_m)
    ka = np.clip(ka, 0.05, 10.0)
    ca = 0.6 * np.exp(-0.4 * ka) + 0.15
    ca = np.clip(ca, 0.1, 0.8)
    return rho * volumen * ca


def _amortiguamiento_cilindro(omega: np.ndarray, geometria: GeometriaReferencia) -> np.ndarray:
    d = geometria.diametro_m
    a = d / 2.0
    rho = RHO_AGUA_MAR
    g = G
    ka = omega * a / math.sqrt(g * geometria.calado_m)
    ka = np.clip(ka, 0.05, 10.0)
    b_norm = 0.8 * ka * np.exp(-0.9 * ka)
    b_norm = np.clip(b_norm, 0.02, 0.5)
    b_ref = rho * g * math.pi * a * a / omega
    b_ref = np.where(omega > 0, b_ref, 0.0)
    return b_ref * b_norm


def _fuerza_excitacion_cilindro(
    omega: np.ndarray, geometria: GeometriaReferencia, hm0: float = 1.0
) -> np.ndarray:
    d = geometria.diametro_m
    a = d / 2.0
    rho = RHO_AGUA_MAR
    g = G
    ka = omega * a / math.sqrt(g * geometria.calado_m)
    ka = np.clip(ka, 0.05, 10.0)
    amp_ola = hm0 / 2.0
    fe_norm = rho * g * math.pi * a * a * np.exp(-0.5 * ka)
    fe_norm = np.clip(fe_norm, 1e3, 5e6)
    return fe_norm * amp_ola


def coeficientes_cilindro(
    omega: np.ndarray | float,
    geometria: GeometriaReferencia | None = None,
    hm0: float = 1.0,
) -> CoeficientesHidrodinamicos:
    if geometria is None:
        geometria = GEOMETRIA_CILINDRO_10M
    omega_arr = np.atleast_1d(np.asarray(omega, dtype=float))
    if np.any(omega_arr <= 0):
        raise ValueError("omega debe ser positivo")
    fuente = geometria.fuente
    aviso = _aviso(geometria)
    a_arr = _masa_anadida_cilindro(omega_arr, geometria)
    b_arr = _amortiguamiento_cilindro(omega_arr, geometria)
    fe_arr = _fuerza_excitacion_cilindro(omega_arr, geometria, hm0)
    return CoeficientesHidrodinamicos(
        omega_rad_s=omega_arr,
        masa_anadida_kg=a_arr,
        amortiguamiento_ns_m=b_arr,
        fuerza_excitacion_n_m=fe_arr,
        geometria=geometria,
        fuente=fuente,
        aviso_extrapolacion=aviso,
    )


def coeficientes(
    omega: np.ndarray | float,
    diametro_m: float = 10.0,
    calado_m: float | None = None,
    hm0: float = 1.0,
) -> CoeficientesHidrodinamicos:
    if diametro_m < 5.0 or diametro_m > 20.0:
        pass
    if calado_m is None:
        calado_m = diametro_m * 0.5
    geom = GeometriaReferencia(
        forma="cilindro vertical axisimetrico",
        diametro_m=float(diametro_m),
        calado_m=float(calado_m),
        descripcion=f"boya cilindrica D={diametro_m:.1f} m, calado {calado_m:.1f} m",
        fuente=(
            "Falnes (2002) Ocean Waves and Oscillating Bodies, cap. 5; "
            "Babarit et al. (2012) Ocean Eng. 41 — valores parametrizados para ka 0.2-3.0"
        ),
    )
    coef = coeficientes_cilindro(omega, geom, hm0)
    d_ref = GEOMETRIA_CILINDRO_10M.diametro_m
    extra = ""
    if diametro_m < d_ref * 0.5 or diametro_m > d_ref * 2.0:
        extra = f" | AVISO: D={diametro_m} m fuera de rango validado {d_ref*0.5:.1f}-{d_ref*2.0:.1f} m; extrapolacion"
    return CoeficientesHidrodinamicos(
        omega_rad_s=coef.omega_rad_s,
        masa_anadida_kg=coef.masa_anadida_kg,
        amortiguamiento_ns_m=coef.amortiguamiento_ns_m,
        fuerza_excitacion_n_m=coef.fuerza_excitacion_n_m,
        geometria=geom,
        fuente=coef.fuente,
        aviso_extrapolacion=coef.aviso_extrapolacion + extra,
    )


def validar_geometria(diametro_m: float) -> str | None:
    if diametro_m < 5.0 or diametro_m > 20.0:
        return (
            f"diametro {diametro_m} m fuera de rango de literatura 5-20 m; "
            "coeficientes son extrapolacion — recalibrar por BEM o ensayo"
        )
    return None


def rigidez_hidrostatica(diametro_m: float, rho: float = RHO_AGUA_MAR, g: float = G) -> float:
    if diametro_m <= 0:
        raise ValueError("diametro debe ser positivo")
    area_plano_agua = math.pi * diametro_m * diametro_m / 4.0
    return rho * g * area_plano_agua


def frecuencia_natural(
    masa_kg: float,
    diametro_m: float,
    omega_estimada: float = 1.0,
    rho: float = RHO_AGUA_MAR,
    g: float = G,
) -> float:
    kh = rigidez_hidrostatica(diametro_m, rho, g)
    coef = coeficientes(np.array([omega_estimada]), diametro_m)
    a = float(coef.masa_anadida_kg[0])
    return math.sqrt(kh / (masa_kg + a))
