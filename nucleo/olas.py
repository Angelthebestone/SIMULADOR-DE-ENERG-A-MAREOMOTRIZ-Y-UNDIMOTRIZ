from __future__ import annotations

import math

import numpy as np

from nucleo.constantes import RHO_AGUA_MAR, G

SUPUESTO_CONVERSION: str = "JONSWAP gamma=3.3: 1.12 Te = 1.29 Tz = Tp"
FACTOR_TP_A_TE: float = 1.0 / 1.12
FACTOR_TP_A_TZ: float = 1.0 / 1.29
FACTOR_TE_A_TP: float = 1.12
FACTOR_TZ_A_TP: float = 1.29


def numero_onda(
    omega: float,
    profundidad: float,
    g: float = G,
    tol: float = 1e-10,
    max_iter: int = 50,
) -> tuple[float, int]:
    if omega <= 0:
        raise ValueError("omega debe ser positivo")
    if profundidad <= 0:
        raise ValueError("profundidad debe ser positiva")
    k0 = _arranque_eckart(omega, profundidad, g)
    k = float(k0)
    iteraciones = 0
    for i in range(1, max_iter + 1):
        f_val, df_val = _funcion_y_derivada(k, omega, profundidad, g)
        delta = f_val / df_val
        k -= delta
        iteraciones = i
        if abs(f_val) < tol:
            break
        if abs(delta) < tol * 0.1:
            break
    return k, iteraciones


def _arranque_eckart(omega: float, h: float, g: float) -> float:
    arg = omega * omega * h / g
    th = math.tanh(arg)
    if th <= 0:
        th = 1e-12
    return (omega * omega / g) / math.sqrt(th)


def _funcion_y_derivada(k: float, omega: float, h: float, g: float) -> tuple[float, float]:
    kh = k * h
    th = math.tanh(kh)
    f_val = g * k * th - omega * omega
    ch = math.cosh(kh)
    sech2 = 1.0 / (ch * ch)
    df_val = g * th + g * k * h * sech2
    return f_val, df_val


def densidad_potencia(
    hm0: float,
    te: float,
    rho: float = RHO_AGUA_MAR,
    g: float = G,
) -> float:
    if hm0 < 0:
        raise ValueError("Hm0 debe ser no negativo")
    if te <= 0:
        raise ValueError("Te debe ser positivo")
    j_w_m = rho * g * g * hm0 * hm0 * te / (64.0 * math.pi)
    return j_w_m / 1000.0


def densidad_potencia_w_m(
    hm0: float,
    te: float,
    rho: float = RHO_AGUA_MAR,
    g: float = G,
) -> float:
    return densidad_potencia(hm0, te, rho, g) * 1000.0


def tp_a_te(tp: float) -> float:
    if tp <= 0:
        raise ValueError("Tp debe ser positivo")
    return tp * FACTOR_TP_A_TE


def te_a_tp(te: float) -> float:
    if te <= 0:
        raise ValueError("Te debe ser positivo")
    return te * FACTOR_TE_A_TP


def tp_a_tz(tp: float) -> float:
    if tp <= 0:
        raise ValueError("Tp debe ser positivo")
    return tp * FACTOR_TP_A_TZ


def tz_a_tp(tz: float) -> float:
    if tz <= 0:
        raise ValueError("Tz debe ser positivo")
    return tz * FACTOR_TZ_A_TP


def te_a_tz(te: float) -> float:
    if te <= 0:
        raise ValueError("Te debe ser positivo")
    tp = te_a_tp(te)
    return tp_a_tz(tp)


def tz_a_te(tz: float) -> float:
    if tz <= 0:
        raise ValueError("Tz debe ser positivo")
    tp = tz_a_tp(tz)
    return tp_a_te(tp)


def velocidad_grupo(
    omega: float,
    profundidad: float,
    g: float = G,
) -> float:
    if omega <= 0:
        raise ValueError("omega debe ser positivo")
    if profundidad <= 0:
        raise ValueError("profundidad debe ser positiva")
    k, _ = numero_onda(omega, profundidad, g)
    kh = k * profundidad
    denom = math.sinh(2.0 * kh)
    if abs(denom) < 1e-14:
        return math.sqrt(g * profundidad)
    factor = 1.0 + (2.0 * kh) / denom
    return (omega / (2.0 * k)) * factor


def celeridad_fase(omega: float, profundidad: float, g: float = G) -> float:
    k, _ = numero_onda(omega, profundidad, g)
    return omega / k


def longitud_onda(omega: float, profundidad: float, g: float = G) -> float:
    k, _ = numero_onda(omega, profundidad, g)
    return 2.0 * math.pi / k


def numero_onda_vector(
    omega: np.ndarray,
    profundidad: float,
    g: float = G,
) -> tuple[np.ndarray, np.ndarray]:
    omega_arr = np.asarray(omega, dtype=float)
    ks = np.empty_like(omega_arr)
    iters = np.empty_like(omega_arr, dtype=int)
    for idx, w in enumerate(omega_arr.flat):
        k, it = numero_onda(float(w), profundidad, g)
        ks.flat[idx] = k
        iters.flat[idx] = it
    return ks, iters
