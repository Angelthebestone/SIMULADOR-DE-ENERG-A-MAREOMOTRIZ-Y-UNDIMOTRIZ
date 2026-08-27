from __future__ import annotations

import math

import numpy as np

from nucleo.olas import numero_onda
from nucleo.resultado import Resultado


def superficie_eta(
    x: np.ndarray,
    t: float,
    hm0: float,
    omega: float,
    k: float,
) -> np.ndarray:
    return (hm0 / 2.0) * np.cos(k * np.asarray(x) - omega * float(t))


def serie_superficie(
    hm0: float,
    te: float,
    profundidad: float,
    x: np.ndarray,
    t: np.ndarray,
    g: float = 9.81,
) -> np.ndarray:
    omega = 2.0 * math.pi / te
    k, _ = numero_onda(omega, profundidad, g)
    eta = np.zeros((len(t), len(x)))
    for i, ti in enumerate(t):
        eta[i, :] = superficie_eta(x, float(ti), hm0, omega, k)
    return eta


def muestrear_serie(
    serie_t: np.ndarray,
    serie_y: np.ndarray,
    t_consulta: float | np.ndarray,
) -> np.ndarray | float:
    serie_t = np.asarray(serie_t, dtype=float)
    serie_y = np.asarray(serie_y, dtype=float)
    if isinstance(t_consulta, (int, float)):
        return float(np.interp(float(t_consulta), serie_t, serie_y))
    t_cons = np.asarray(t_consulta, dtype=float)
    return np.interp(t_cons, serie_t, serie_y)  # type: ignore[no-any-return]


def datos_animacion_desde_resultado(
    resultado: Resultado,
    x: np.ndarray | None = None,
    t: np.ndarray | None = None,
) -> dict[str, object]:
    rec = resultado.recurso
    hm0 = float(rec.get("Hm0", rec.get("hm0", 2.0)))
    te = float(rec.get("Te", rec.get("te", 8.0)))
    h = float(rec.get("profundidad_m", rec.get("profundidad", 30.0)))
    if x is None:
        omega = 2.0 * math.pi / te
        k, _ = numero_onda(omega, h)
        lam = 2.0 * math.pi / k if k > 0 else 100.0
        x = np.linspace(0.0, 2.0 * lam, 200)
    if t is None:
        serie = resultado.series
        if "t" in serie and len(np.asarray(serie["t"])) > 1:
            st = np.asarray(serie["t"], dtype=float)
            t = np.linspace(st[0], st[-1], 120)
        else:
            t = np.linspace(0.0, 4.0 * te, 120)
    eta = serie_superficie(hm0, te, h, np.asarray(x), np.asarray(t))
    serie_boya_t = None
    serie_boya_z = None
    if "t" in resultado.series and "z" in resultado.series:
        serie_boya_t = np.asarray(resultado.series["t"], dtype=float)
        serie_boya_z = np.asarray(resultado.series["z"], dtype=float)
    elif "t" in resultado.series and "zeta" in resultado.series:
        serie_boya_t = np.asarray(resultado.series["t"], dtype=float)
        serie_boya_z = np.asarray(resultado.series["zeta"], dtype=float)
    return {
        "x": np.asarray(x),
        "t": np.asarray(t),
        "eta": eta,
        "boya_t": serie_boya_t,
        "boya_z": serie_boya_z,
        "hm0": hm0,
        "te": te,
        "profundidad": h,
        "nota": "muestra serie ya calculada, no recalcula por fotograma",
    }
