from __future__ import annotations

import math
from dataclasses import dataclass

import numpy as np

from nucleo.constantes import G

PM_ALPHA: float = 0.0081
PM_BETA: float = 0.74
JONSWAP_GAMMA_DEFECTO: float = 3.3
JONSWAP_SIGMA_BAJO: float = 0.07
JONSWAP_SIGMA_ALTO: float = 0.09

_MHKIT_DISPONIBLE: bool = False
try:
    import mhkitoolkit  # noqa: F401

    _MHKIT_DISPONIBLE = True
except ImportError:
    try:
        import mhkit  # noqa: F401

        _MHKIT_DISPONIBLE = True
    except ImportError:
        _MHKIT_DISPONIBLE = False


@dataclass(frozen=True, slots=True)
class ParametrosEspectrales:
    hm0: float
    te: float
    tz: float
    epsilon0: float
    m0: float
    m_1: float
    m_2: float
    m_2_neg: float


def _sigma_jonswap(omega: np.ndarray, omega_p: float) -> np.ndarray:
    sigma = np.where(omega <= omega_p, JONSWAP_SIGMA_BAJO, JONSWAP_SIGMA_ALTO)
    return sigma  # type: ignore[no-any-return]


def espectro_pierson_moskowitz(
    omega: np.ndarray,
    omega_p: float,
    g: float = G,
    alpha: float = PM_ALPHA,
    beta: float = PM_BETA,
) -> np.ndarray:
    omega = np.asarray(omega, dtype=float)
    omega_seguro = np.where(omega <= 0, np.nan, omega)
    with np.errstate(divide="ignore", invalid="ignore"):
        base = (
            alpha
            * g
            * g
            * np.power(omega_seguro, -5)
            * np.exp(-beta * np.power(omega_p / omega_seguro, 4))
        )
    base = np.where(omega <= 0, 0.0, base)
    return base  # type: ignore[no-any-return]


def espectro_jonswap(
    omega: np.ndarray,
    omega_p: float,
    gamma: float = JONSWAP_GAMMA_DEFECTO,
    g: float = G,
    alpha: float | None = None,
    u10: float | None = None,
    fetch: float | None = None,
) -> np.ndarray:
    if not 1.0 <= gamma <= 5.0:
        raise ValueError("gamma debe estar en [1, 5]")
    omega = np.asarray(omega, dtype=float)
    if gamma == 1.0:
        a_pm = alpha if alpha is not None else PM_ALPHA
        return espectro_pierson_moskowitz(omega, omega_p, g, a_pm, PM_BETA)
    if alpha is None:
        if u10 is not None and fetch is not None:
            alpha = 0.076 * (u10 * u10 / (fetch * g)) ** 0.22
        else:
            alpha = PM_ALPHA
    if u10 is not None and fetch is not None and omega_p is None:
        omega_p = 22.0 * (g * g / (u10 * fetch)) ** (1.0 / 3.0)
    sigma = _sigma_jonswap(omega, omega_p)
    with np.errstate(divide="ignore", invalid="ignore"):
        pm_parte = (
            alpha
            * g
            * g
            * np.power(np.where(omega <= 0, np.nan, omega), -5)
            * np.exp(-1.25 * np.power(omega_p / np.where(omega <= 0, np.nan, omega), 4))
        )
        r_exp = np.exp(-np.power(omega - omega_p, 2) / (2.0 * sigma * sigma * omega_p * omega_p))
        jonswap = pm_parte * np.power(gamma, r_exp)
    jonswap = np.where(omega <= 0, 0.0, jonswap)
    jonswap = np.nan_to_num(jonswap, nan=0.0, posinf=0.0, neginf=0.0)
    return jonswap  # type: ignore[no-any-return]


def espectro_jonswap_u10_fetch(
    omega: np.ndarray,
    u10: float,
    fetch: float,
    gamma: float = JONSWAP_GAMMA_DEFECTO,
    g: float = G,
) -> np.ndarray:
    if u10 <= 0 or fetch <= 0:
        raise ValueError("U10 y fetch deben ser positivos")
    alpha = 0.076 * (u10 * u10 / (fetch * g)) ** 0.22
    omega_p = 22.0 * (g * g / (u10 * fetch)) ** (1.0 / 3.0)
    return espectro_jonswap(omega, omega_p, gamma, g, alpha)


def momento_espectral(omega: np.ndarray, espectro: np.ndarray, orden: int) -> float:
    omega = np.asarray(omega, dtype=float)
    espectro = np.asarray(espectro, dtype=float)
    if omega.shape != espectro.shape:
        raise ValueError("omega y espectro deben tener igual forma")
    if omega.size < 2:
        raise ValueError("se necesitan al menos 2 puntos")
    integrando = espectro * np.power(omega, orden)
    integrando = np.where(np.isnan(integrando) | np.isinf(integrando), 0.0, integrando)
    return float(np.trapezoid(integrando, omega))


def momentos_espectrales(
    omega: np.ndarray, espectro: np.ndarray, ordenes: list[int] | None = None
) -> dict[int, float]:
    if ordenes is None:
        ordenes = [-2, -1, 0, 1, 2]
    resultado: dict[int, float] = {}
    for n in ordenes:
        resultado[n] = momento_espectral(omega, espectro, n)
    return resultado


def parametros_desde_momentos(momentos: dict[int, float]) -> ParametrosEspectrales:
    m0 = momentos[0]
    m_1 = momentos[-1]
    m2 = momentos[2]
    m_2 = momentos[-2]
    if m0 <= 0:
        raise ValueError("m0 debe ser positivo")
    hm0 = 4.0 * math.sqrt(m0)
    te = 2.0 * math.pi * m_1 / m0 if m0 != 0 else 0.0
    tz = 2.0 * math.pi * math.sqrt(m0 / m2) if m2 > 0 else 0.0
    if m_1 == 0:
        epsilon0 = 0.0
    else:
        val = m0 * m_2 / (m_1 * m_1) - 1.0
        epsilon0 = math.sqrt(max(val, 0.0))
    return ParametrosEspectrales(
        hm0=hm0, te=te, tz=tz, epsilon0=epsilon0, m0=m0, m_1=m_1, m_2=m2, m_2_neg=m_2
    )


def parametros_desde_espectro(omega: np.ndarray, espectro: np.ndarray) -> ParametrosEspectrales:
    moms = momentos_espectrales(omega, espectro)
    return parametros_desde_momentos(moms)


def espectro_escalado_para_hm0(
    omega: np.ndarray, espectro: np.ndarray, hm0_objetivo: float
) -> np.ndarray:
    if hm0_objetivo <= 0:
        raise ValueError("Hm0 objetivo debe ser positivo")
    params = parametros_desde_espectro(omega, espectro)
    if params.m0 <= 0:
        raise ValueError("m0 no positivo, no se puede escalar")
    factor = (hm0_objetivo / params.hm0) ** 2
    return espectro * factor


def _te_de_espectro(omega: np.ndarray, espectro: np.ndarray) -> float:
    m0 = momento_espectral(omega, espectro, 0)
    m_1 = momento_espectral(omega, espectro, -1)
    return 2.0 * math.pi * m_1 / m0 if m0 > 0 else 0.0


def espectro_jonswap_para_hm0_te(
    omega: np.ndarray,
    hm0: float,
    te: float,
    gamma: float = JONSWAP_GAMMA_DEFECTO,
    g: float = G,
) -> np.ndarray:
    if hm0 <= 0 or te <= 0:
        raise ValueError("Hm0 y Te deben ser positivos")
    if not 1.0 <= gamma <= 5.0:
        raise ValueError("gamma debe estar en [1, 5]")
    return _jonswap_hm0_te_impl(omega, hm0, te, gamma, g)


def _jonswap_hm0_te_impl(
    omega: np.ndarray, hm0: float, te: float, gamma: float, g: float
) -> np.ndarray:

    def construir(op: float) -> np.ndarray:
        return espectro_jonswap(omega, op, gamma, g)

    def te_para(op: float) -> float:
        return _te_de_espectro(omega, construir(op))

    op_bajo = 2.0 * math.pi / 20.0
    op_alto = 2.0 * math.pi / 2.0
    te_bajo = te_para(op_bajo)
    te_alto = te_para(op_alto)
    en_rango = min(te_bajo, te_alto) <= te <= max(te_bajo, te_alto)
    if not en_rango:
        return _espectro_aproximado(omega, hm0, te, gamma, g, op_bajo, op_alto, construir)
    return _espectro_con_opt(omega, hm0, te, construir, te_para, op_bajo, op_alto)


def _espectro_aproximado(
    omega: np.ndarray,
    hm0: float,
    te: float,
    gamma: float,
    g: float,
    op_bajo: float,
    op_alto: float,
    construir: object,
) -> np.ndarray:
    op_aprox = 2.0 * math.pi / (te / 0.9)
    op_aprox = float(np.clip(op_aprox, op_bajo, op_alto))
    s_opt = construir(op_aprox)  # type: ignore[operator]
    s_esc = espectro_escalado_para_hm0(omega, s_opt, hm0)
    te_log = _te_de_espectro(omega, s_esc)
    if abs(te_log - te) / te <= 0.01:
        return s_esc
    return _reintentar_opt(omega, hm0, te, construir, op_bajo, op_alto, s_esc)  # type: ignore[arg-type]


def _espectro_con_opt(
    omega: np.ndarray,
    hm0: float,
    te: float,
    construir: object,
    te_para: object,
    op_bajo: float,
    op_alto: float,
) -> np.ndarray:
    from scipy.optimize import brentq

    try:
        op_opt = brentq(lambda op: te_para(op) - te, op_bajo, op_alto, xtol=1e-8)  # type: ignore[operator]
    except ValueError:
        op_opt = 2.0 * math.pi / (te / 0.9)
    s_opt = construir(op_opt)  # type: ignore[operator]
    return espectro_escalado_para_hm0(omega, s_opt, hm0)


def _reintentar_opt(
    omega: np.ndarray,
    hm0: float,
    te: float,
    construir: object,
    op_bajo: float,
    op_alto: float,
    fallback: np.ndarray,
) -> np.ndarray:
    from scipy.optimize import brentq

    def te_para(op: float) -> float:
        return _te_de_espectro(omega, construir(op))  # type: ignore[operator]

    try:
        op_opt = brentq(lambda op: te_para(op) - te, op_bajo, op_alto, xtol=1e-8)
        s_opt = construir(op_opt)  # type: ignore[operator]
        return espectro_escalado_para_hm0(omega, s_opt, hm0)
    except Exception:
        return fallback


def espectro_pm_para_hm0_te(
    omega: np.ndarray,
    hm0: float,
    te: float,
    g: float = G,
) -> np.ndarray:
    return espectro_jonswap_para_hm0_te(omega, hm0, te, gamma=1.0, g=g)


def malla_frecuencias(f_min: float = 0.02, f_max: float = 1.0, n_puntos: int = 500) -> np.ndarray:
    if f_min <= 0 or f_max <= f_min:
        raise ValueError("rango de frecuencias invalido")
    f = np.linspace(f_min, f_max, n_puntos)
    return 2.0 * math.pi * f
