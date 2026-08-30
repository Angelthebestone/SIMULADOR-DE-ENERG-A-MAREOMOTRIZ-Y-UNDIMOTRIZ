from __future__ import annotations

import math

from app.formato import formatear_numero as num
from app.formato import formatear_porcentaje as pct
from nucleo.constantes import G, RHO_AGUA_MAR
from nucleo.resultado import Resultado

# cada formula es triple exacto: (latex, texto, unidades)
Triple = tuple[str, str, str]


def _triple(latex: str, texto: str, unidades: str) -> Triple:
    """Triple exacto latex texto unidades."""
    return (latex, texto, unidades)


def _registro_densidad_potencia(
    hm0: float, te: float, rho: float = RHO_AGUA_MAR, g: float = G
) -> Triple:
    j = rho * g * g * hm0 * hm0 * te / (64.0 * math.pi) / 1000.0
    coef = rho * g * g / (64.0 * math.pi)
    latex = r"J = \rho g^2 Hm0^2 Te / (64\pi)"
    texto = (
        f"J = {num(rho, 0)}*{num(g, 2)}^2*{num(hm0, 2)}^2*"
        f"{num(te, 1)}/(64 pi) = {num(coef, 1)}*"
        f"{num(hm0**2, 2)}*{num(te, 1)} /1000 = {num(j, 2)} kW/m"
    )
    unidades = "kW/m"
    return _triple(latex, texto, unidades)


def _registro_potencia_corriente(
    v: float, area: float, cp: float, rho: float = RHO_AGUA_MAR
) -> Triple:
    p = 0.5 * rho * cp * area * v**3
    latex = r"P = \frac{1}{2} \rho C_{p} A V^3"
    texto = f"P = 0,5*{num(rho, 0)}*{num(cp, 2)}*{num(area, 1)}*{num(v, 2)}^3 = {num(p, 1)} W"
    unidades = "W"
    return _triple(latex, texto, unidades)


def _registro_energia_embalse(
    area: float, rango: float, rho: float = RHO_AGUA_MAR, g: float = G
) -> Triple:
    e_j = 0.5 * rho * g * area * rango * rango
    e_gwh = e_j / 3.6e12
    latex = r"E = \frac{1}{2} \rho g A R^2"
    texto = (
        f"E = 0,5*{num(rho, 0)}*{num(g, 2)}*{num(area, 0)}*"
        f"{num(rango, 2)}^2 = {e_j:.3e} J = {num(e_gwh, 2)} GWh por ciclo"
    )
    unidades = "J"
    return _triple(latex, texto, unidades)


def _registro_aep_handbook(
    j_kw_m: float, ancho: float, eta: float, disp: float, horas: float = 8766.0
) -> Triple:
    aep = j_kw_m * 1000.0 * ancho * eta * disp * horas / 1e6
    latex = r"AEP = J \cdot ancho \cdot \eta \cdot disp \cdot horas"
    texto = (
        f"AEP = {num(j_kw_m, 1)} kW/m * {num(ancho, 1)} m * "
        f"{num(eta, 2)} * {num(disp, 2)} * {num(horas, 0)} h = {num(aep, 0)} MWh/ano"
    )
    unidades = "MWh/ano"
    return _triple(latex, texto, unidades)


def formulas_desde_resultado(resultado: Resultado) -> dict[str, Triple]:
    """Fórmulas como triple (latex, texto, unidades) para KaTeX y pantalla."""
    rec = resultado.recurso
    hm0 = float(rec.get("Hm0", rec.get("hm0", 2.0)))
    te = float(rec.get("Te", rec.get("te", 8.0)))
    h = float(rec.get("profundidad_m", rec.get("profundidad", 30.0)))
    out: dict[str, Triple] = {}
    out["J"] = _registro_densidad_potencia(hm0, te)
    aep_val = float(resultado.produccion_anual_mwh)
    latex_aep = r"AEP = P_{n} \cdot horas \cdot disponibilidad \cdot factor_{planta}"
    texto_aep = (
        f"AEP = {num(resultado.potencia_nominal_w / 1000, 1)} kW * "
        f"{num(resultado.horas_ano, 0)} h * {num(resultado.disponibilidad, 2)} * "
        f"{num(resultado.factor_planta, 3)} = {num(aep_val, 1)} MWh/ano "
        f"(factor {pct(resultado.factor_planta)})"
    )
    out["AEP"] = _triple(latex_aep, texto_aep, "MWh/ano")
    for ent in resultado.eslabones:
        pin = float(ent.potencia_entrada_w)
        pout = float(ent.potencia_salida_w)
        rend = float(ent.rendimiento)
        latex_e = r"\eta = P_{out} / P_{in}"
        texto_e = (
            f"{ent.nombre}: {num(pout, 1)} W / {num(pin, 1)} W = "
            f"eta {pct(rend)} (Pin {num(pin, 1)} W -> Pout {num(pout, 1)} W)"
        )
        out[f"eslabon_{ent.nombre}"] = _triple(latex_e, texto_e, "%")
    latex_ctx = r"h = \text{h}, H_{m0}, T_{e}"
    texto_ctx = f"h = {num(h, 1)} m, Hm0 = {num(hm0, 2)} m, Te = {num(te, 1)} s"
    out["contexto"] = _triple(latex_ctx, texto_ctx, "m")
    return out
