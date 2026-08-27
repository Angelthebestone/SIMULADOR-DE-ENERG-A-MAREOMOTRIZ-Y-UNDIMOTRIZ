from __future__ import annotations

import math

from nucleo.constantes import RHO_AGUA_MAR, G
from nucleo.resultado import Resultado


def formula_densidad_potencia(
    hm0: float, te: float, rho: float = RHO_AGUA_MAR, g: float = G
) -> str:
    j = rho * g * g * hm0 * hm0 * te / (64.0 * math.pi) / 1000.0
    coef = rho * g * g / (64.0 * math.pi)
    return (
        f"J = rho g² Hm0² Te / (64 pi) = {rho}*{g:.2f}²*{hm0}²*{te}/(64 pi) "
        f"= {coef:.1f}*{hm0**2:.2f}*{te} /1000 = {j:.2f} kW/m"
    )


def formula_potencia_corriente(v: float, area: float, cp: float, rho: float = RHO_AGUA_MAR) -> str:
    p = 0.5 * rho * cp * area * v**3
    return f"P = 1/2 rho Cp A V³ = 0,5*{rho}*{cp}*{area}*{v}³ = {p:.1f} W"


def formula_energia_embalse(
    area: float, rango: float, rho: float = RHO_AGUA_MAR, g: float = G
) -> str:
    e_j = 0.5 * rho * g * area * rango * rango
    e_gwh = e_j / 3.6e12
    return f"E = 1/2 rho g A R² = 0,5*{rho}*{g}*{area}*{rango}² = {e_j:.3e} J = {e_gwh:.2f} GWh por ciclo"


def formula_aep_handbook(
    j_kw_m: float, ancho: float, eta: float, disp: float, horas: float = 8766.0
) -> str:
    aep = j_kw_m * 1000.0 * ancho * eta * disp * horas / 1e6
    return (
        f"AEP = J ancho eta disp horas = {j_kw_m} kW/m * {ancho} m * {eta} * {disp} * {horas} h "
        f"= {aep:.0f} MWh/año"
    )


def formulas_desde_resultado(resultado: Resultado) -> dict[str, str]:
    rec = resultado.recurso
    hm0 = float(rec.get("Hm0", rec.get("hm0", 2.0)))
    te = float(rec.get("Te", rec.get("te", 8.0)))
    base_j = formula_densidad_potencia(hm0, te)
    prod = resultado.produccion_anual_mwh
    fp = resultado.factor_planta
    pot = resultado.potencia_nominal_w
    out: dict[str, str] = {
        "J": base_j,
        "AEP": f"AEP = {prod:.1f} MWh/año (factor de planta {fp:.2%}, Pn {pot/1000:.1f} kW, {resultado.horas_ano:.0f} h, disp {resultado.disponibilidad:.0%})",
    }
    for e in resultado.eslabones:
        out[f"eslabon_{e.nombre}"] = (
            f"{e.nombre}: Pin {e.potencia_entrada_w:.1f} W -> Pout {e.potencia_salida_w:.1f} W "
            f"(eta {e.rendimiento:.2%})"
        )
    h = float(rec.get("profundidad_m", rec.get("profundidad", 30.0)))
    out["contexto"] = f"h = {h} m, Hs {hm0} m, Te {te} s"
    return out
