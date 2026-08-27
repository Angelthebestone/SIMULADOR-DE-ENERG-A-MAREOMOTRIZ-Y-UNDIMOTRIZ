from __future__ import annotations

from collections.abc import Callable

import numpy as np
from scipy.integrate import solve_ivp


def integrar_adaptativo(
    fun: Callable[[float, np.ndarray], np.ndarray],
    t_span: tuple[float, float],
    y0: np.ndarray,
    t_eval: np.ndarray | None = None,
    rtol: float = 1e-8,
    atol: float = 1e-8,
    method: str = "RK45",
) -> tuple[np.ndarray, np.ndarray]:
    sol = solve_ivp(
        fun,
        t_span,
        np.asarray(y0, dtype=float),
        method=method,
        t_eval=t_eval,
        rtol=rtol,
        atol=atol,
    )
    if not sol.success:
        raise RuntimeError(f"integrador fallo: {sol.message}")
    t = sol.t if t_eval is None else t_eval
    y = sol.y if t_eval is None else _interp_sol(sol, t_eval)
    return t, y


def _interp_sol(sol: object, t_eval: np.ndarray) -> np.ndarray:
    s = sol  # type: ignore[attr-defined]
    if hasattr(s, "sol") and s.sol is not None:
        return s.sol(t_eval)  # type: ignore[no-any-return]
    return s.y  # type: ignore[no-any-return]
