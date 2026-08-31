"""Calcula el LCOE estimado de cada ficha de fracaso comercial en Isla Fuerte.

Para cada JSON en ``datos/fracasos/`` añade el campo ``lcoe_estimado_cop_mwh``
con la estructura ``{valor, unidad, fuente, estado}`` exigida por el spec
``fracasos-conectados-al-calculo``. El cálculo usa los parámetros técnicos del
catálogo (``datos/catalogo/``) y los parámetros por defecto del sitio Isla
Fuerte (8,9 kW/m verificado). Si faltan datos, el campo queda
``estado=pendiente`` con la lista de lo que falta en la fuente.

Idempotente: si el JSON ya tiene el campo, lo sobrescribe con el valor recién
calculado (mismo resultado, no se duplica).

Ejecutar una sola vez en build:
    python datos/fracasos/procesar_lcoe.py
"""

from __future__ import annotations

import json
import pathlib
import sys
from typing import Any

ROOT = pathlib.Path(__file__).resolve().parent
CATALOGO = ROOT.parent / "catalogo"

TRM_COP_POR_EUR: float = 4250.0
"""TRM media 2023 COP/EUR (orden de magnitud, sin rigor de promedio anual)."""

HORAS_ANIO: float = 8760.0
"""Horas nominales de un año para el cómputo de AEP."""

VIDA_ANOS: int = 20
TASA_DESCUENTO: float = 0.08
"""Tasa de descuento estándar del Handbook, vida 20 años."""

FRACCION_OPEX: float = 0.03
"""OPEX anual como fracción del CAPEX (regla de orden marina, sin verificar)."""

DENSIDAD_POR_DEFECTO_KW_M: float = 8.9
DENSIDAD_FUENTE: str = "Ortega et al. 2013 (verificado, Isla Fuerte 8,9 kW/m)"

DISPOSITIVO_A_CATALOGO: dict[str, str] = {
    "pelamis_p2": "atenuador",
    "oyster_800": "owsc",
    "seagen": "tidal_eje_horizontal",
    "annapolis_royal": "tidal_otros",
    "limpet": "owc",
}

ANCHO_REFERENCIA_M: dict[str, float] = {
    "atenuador": 180.0,
    "owsc": 20.0,
    "owc": 25.0,
}

CWR_REFERENCIA: dict[str, float] = {
    "atenuador": 0.06,
    "owsc": 0.37,
    "owc": 0.29,
}


def _cargar_catalogo(familia: str) -> dict[str, Any] | None:
    ruta = CATALOGO / f"{familia}.json"
    if not ruta.exists():
        return None
    return json.loads(ruta.read_text(encoding="utf-8"))


def _aep_anual_mwh(
    familia: str,
    potencia_nominal_kw: float,
) -> tuple[float | None, str]:
    """AEP = potencia_nominal * 8760 * (factor de planta efectivo).

    Para turbina de corriente: factor = Cp_verificado * 0,55 (pérdidas mecánicas
    y disponibilidad). Para mareal genérico: factor 0,25 Handbook. Para
    undimotriz: factor sale del CWR verificado del catálogo y el ancho de
    referencia declarado.
    """
    if familia == "tidal_eje_horizontal":
        cp = 0.45
        factor_planta = cp * 0.55
        return potencia_nominal_kw * HORAS_ANIO * factor_planta, f"Cp={cp} (verificado) * 0,55"

    if familia == "tidal_otros":
        factor_planta = 0.25
        return potencia_nominal_kw * HORAS_ANIO * factor_planta, "factor planta 0,25 Handbook mareal"

    cwr = CWR_REFERENCIA.get(familia)
    if cwr is None:
        return None, "familia sin CWR de catálogo"
    ancho_m = ANCHO_REFERENCIA_M.get(familia, 0.0)
    if ancho_m <= 0:
        return None, f"familia {familia} sin ancho de referencia"
    j_kw_m = DENSIDAD_POR_DEFECTO_KW_M
    potencia_captable_kw = j_kw_m * ancho_m * cwr
    if potencia_captable_kw <= 0:
        return None, f"potencia captable no positiva (J={j_kw_m}, B={ancho_m}, CWR={cwr})"
    factor_planta = min(potencia_captable_kw / max(potencia_nominal_kw, 1e-6), 0.9)
    return potencia_nominal_kw * HORAS_ANIO * factor_planta, (
        f"J={j_kw_m} kW/m (Isla Fuerte) * B={ancho_m} m * CWR={cwr} = {potencia_captable_kw:.0f} kW"
    )


def _capex_cop(potencia_nominal_kw: float, familia: str) -> tuple[float, str]:
    eur_por_mw = 6_000_000.0 if familia == "tidal_otros" else 4_000_000.0
    capex_eur = potencia_nominal_kw / 1000.0 * eur_por_mw
    capex_cop = capex_eur * TRM_COP_POR_EUR
    return capex_cop, f"{eur_por_mw:,.0f} EUR/MW Handbook * {TRM_COP_POR_EUR:.0f} COP/EUR"


def _pendiente(motivo: str) -> dict[str, Any]:
    return {
        "valor": None,
        "unidad": "COP/MWh",
        "fuente": motivo,
        "estado": "pendiente",
    }


def calcular_lcoe_fracaso(ficha: dict[str, Any]) -> dict[str, Any]:
    """Devuelve el dict ``lcoe_estimado_cop_mwh`` listo para volcar en la ficha."""
    dispositivo_id = str(ficha.get("id", ""))
    familia = DISPOSITIVO_A_CATALOGO.get(dispositivo_id)
    potencia_kw = float(ficha.get("potencia_nominal_kw") or 0.0)

    if not familia or potencia_kw <= 0:
        return _pendiente(f"falta mapeo a catálogo o potencia_nominal_kw para {dispositivo_id}")

    if _cargar_catalogo(familia) is None:
        return _pendiente(f"falta datos/catalogo/{familia}.json")

    aep_mwh, motivo_aep = _aep_anual_mwh(familia, potencia_kw)
    if aep_mwh is None or aep_mwh <= 0:
        return _pendiente(f"AEP no se pudo estimar para {familia}: {motivo_aep}")

    capex_cop, motivo_capex = _capex_cop(potencia_kw, familia)
    opex_anual_cop = capex_cop * FRACCION_OPEX

    try:
        sys.path.insert(0, str(ROOT.parent.parent))
        from analisis.economia import calcular_lcoe  # type: ignore[import-not-found]

        resultado = calcular_lcoe(
            capex_cop=capex_cop,
            opex_anual_cop=opex_anual_cop,
            aep_mwh=aep_mwh,
            vida_anos=VIDA_ANOS,
            tasa_descuento=TASA_DESCUENTO,
        )
        valor = float(resultado.lcoe_cop_mwh)
    except Exception as exc:  # noqa: BLE001
        return _pendiente(f"calcular_lcoe falló: {exc}")

    fuente = (
        f"Isla Fuerte por defecto ({DENSIDAD_FUENTE}) + catálogo {familia} "
        f"({motivo_aep}); CAPEX {motivo_capex}"
    )
    return {
        "valor": valor,
        "unidad": "COP/MWh",
        "fuente": fuente,
        "estado": "verificado",
    }


def procesar_ficha(ruta: pathlib.Path) -> dict[str, Any]:
    ficha = json.loads(ruta.read_text(encoding="utf-8"))
    ficha["lcoe_estimado_cop_mwh"] = calcular_lcoe_fracaso(ficha)
    ruta.write_text(
        json.dumps(ficha, indent=2, ensure_ascii=False) + "\n",
        encoding="utf-8",
    )
    return ficha["lcoe_estimado_cop_mwh"]


def main() -> None:
    for ruta in sorted(ROOT.glob("*.json")):
        if ruta.name.startswith("_"):
            continue
        campo = procesar_ficha(ruta)
        print(f"{ruta.name}: {campo['estado']}")


if __name__ == "__main__":
    main()

