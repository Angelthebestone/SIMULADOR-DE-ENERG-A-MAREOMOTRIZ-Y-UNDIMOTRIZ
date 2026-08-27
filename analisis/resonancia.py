"""Resonancia en arfada — frecuencia natural iterativa (M2).

Formula implicita:
    wn = sqrt((Kh + Kpto) / (m + A(wn)))
A(wn) depende de wn, se itera con coeficientes de literatura.

Incluye separacion respecto a Te predominante y direccion de ajuste.
"""

from __future__ import annotations

import math
from dataclasses import dataclass

from nucleo.constantes import RHO_AGUA_MAR, G
from nucleo.hidrodinamica import coeficientes, rigidez_hidrostatica


@dataclass(frozen=True, slots=True)
class ResultadoResonancia:
    wn_rad_s: float
    tn_s: float
    fn_hz: float
    masa_anadida_kg: float
    kh_n_m: float
    kpto_n_m: float
    iteraciones: int
    convergio: bool
    fuente: str
    aviso: str


@dataclass(frozen=True, slots=True)
class SeparacionResonancia:
    te_sitio_s: float
    tn_s: float
    wn_rad_s: float
    we_sitio_rad_s: float
    separacion_abs_s: float
    separacion_rel_pct: float
    cociente_tn_te: float
    estado: str
    direccion_ajuste: str
    detalle: str


def _iterar_wn(
    masa_kg: float,
    diametro_m: float,
    kpto_n_m: float,
    omega_ini: float,
    tol: float,
    max_iter: int,
) -> tuple[float, float, int, bool]:
    kh = rigidez_hidrostatica(diametro_m, RHO_AGUA_MAR, G)
    wn = float(omega_ini)
    a_final = 0.0
    convergio = False
    it = 0
    for i in range(1, max_iter + 1):
        coef = coeficientes(omega=wn, diametro_m=diametro_m)
        a_final = float(coef.masa_anadida_kg[0])
        wn_nuevo = math.sqrt((kh + kpto_n_m) / (masa_kg + a_final))
        it = i
        if abs(wn_nuevo - wn) < tol:
            wn = wn_nuevo
            convergio = True
            break
        wn = wn_nuevo
    return wn, a_final, it, convergio


def frecuencia_natural_iterativa(
    masa_kg: float,
    diametro_m: float,
    kpto_n_m: float = 0.0,
    omega_inicial_rad_s: float = 1.0,
    tol: float = 1e-6,
    max_iter: int = 50,
) -> ResultadoResonancia:
    """Calcula wn iterando A(wn).

    Args:
        masa_kg: masa estructura + lastre [kg].
        diametro_m: diametro boya [m].
        kpto_n_m: rigidez PTO (puede ser negativa) [N/m].
        omega_inicial_rad_s: arranque iteracion.
        tol: tolerancia convergencia.
        max_iter: limite iteraciones.

    Returns:
        ResultadoResonancia con wn, Tn, A y trazabilidad.
    """
    if masa_kg <= 0:
        raise ValueError("masa debe ser positiva")
    if diametro_m <= 0:
        raise ValueError("diametro debe ser positivo")
    if omega_inicial_rad_s <= 0:
        raise ValueError("omega inicial debe ser positiva")
    kh = rigidez_hidrostatica(diametro_m, RHO_AGUA_MAR, G)
    wn, a_fin, it, conv = _iterar_wn(
        masa_kg, diametro_m, kpto_n_m, omega_inicial_rad_s, tol, max_iter
    )
    tn = 2.0 * math.pi / wn if wn > 0 else float("inf")
    fn = wn / (2.0 * math.pi)
    coef0 = coeficientes(omega=wn, diametro_m=diametro_m)
    return ResultadoResonancia(
        wn_rad_s=wn,
        tn_s=tn,
        fn_hz=fn,
        masa_anadida_kg=a_fin,
        kh_n_m=kh,
        kpto_n_m=kpto_n_m,
        iteraciones=it,
        convergio=conv,
        fuente=coef0.fuente,
        aviso=coef0.aviso_extrapolacion,
    )


def _estado_separacion(cociente: float) -> str:
    if 0.85 <= cociente <= 1.15:
        return "sintonizado"
    if cociente < 0.85:
        return "boya rapida (Tn < Te) — fuera de resonancia por defecto"
    return "boya lenta (Tn > Te)"


def _direccion_ajuste(tn: float, te: float) -> str:
    if abs(tn - te) / te < 0.05:
        return "mantener dimensiones"
    if tn < te:
        return "aumentar diametro/calado (sube masa anadida y Kh, alarga Tn)"
    return "reducir diametro/calado (baja inercia, acorta Tn)"


def separacion_resonancia(te_sitio_s: float, tn_s: float, wn_rad_s: float) -> SeparacionResonancia:
    """Evalua separacion entre resonancia y oleaje predominante."""
    if te_sitio_s <= 0 or tn_s <= 0:
        raise ValueError("periodos deben ser positivos")
    we = 2.0 * math.pi / te_sitio_s
    sep_abs = abs(tn_s - te_sitio_s)
    sep_rel = sep_abs / te_sitio_s * 100.0
    cociente = tn_s / te_sitio_s
    estado = _estado_separacion(cociente)
    direccion = _direccion_ajuste(tn_s, te_sitio_s)
    detalle = (
        f"Tn={tn_s:.2f}s vs Te={te_sitio_s:.2f}s; wn={wn_rad_s:.3f} rad/s, "
        f"we={we:.3f} rad/s; separacion {sep_rel:.1f}% — {estado}. "
        f"Ajuste: {direccion}."
    )
    return SeparacionResonancia(
        te_sitio_s=te_sitio_s,
        tn_s=tn_s,
        wn_rad_s=wn_rad_s,
        we_sitio_rad_s=we,
        separacion_abs_s=sep_abs,
        separacion_rel_pct=sep_rel,
        cociente_tn_te=cociente,
        estado=estado,
        direccion_ajuste=direccion,
        detalle=detalle,
    )


def analizar_resonancia(
    masa_kg: float,
    diametro_m: float,
    te_sitio_s: float,
    kpto_n_m: float = 0.0,
) -> dict[str, object]:
    """Analisis completo: wn iterativa + separacion + direccion."""
    res = frecuencia_natural_iterativa(masa_kg, diametro_m, kpto_n_m)
    sep = separacion_resonancia(te_sitio_s, res.tn_s, res.wn_rad_s)
    return {
        "resonancia": res,
        "separacion": sep,
        "sintonizado": abs(sep.cociente_tn_te - 1.0) < 0.15,
    }
