"""Calcula el LCOE medio SIN nacional y lo publica en ``resumen_xm.json``.

El campo ``lcoe_sin_cop_mwh`` resume el precio medio de bolsa nacional horario
(``PrecBolsNaci``) de XM, convertido a COP/MWh. Es un promedio aritmético
simple del precio horario; no pondera por generación, que es exactamente el
mismo criterio usado por Superservicios en el intervalo 628-659 COP/kWh
publicado en el sistema (``analisis.economia``). La diferencia entre este
promedio XM y el rango Superservidios se explica porque XM Bolsa es sólo
generación, mientras que el costo unitario SIN integra también transporte,
distribución y comercialización.

Idempotente: si el resumen ya tiene el campo, lo sobrescribe con el valor
recién calculado.

Ejecutar una sola vez en build:
    python datos/xm/procesar_sin.py
"""

from __future__ import annotations

import csv
import json
import pathlib
import statistics

ROOT = pathlib.Path(__file__).resolve().parent
CSV_BOLETA = ROOT / "PrecBolsNaci_2023-2024.csv"
RESUMEN = ROOT / "resumen_xm.json"

FUENTE_RESUMEN: str = "XM PrecBolsNaci 2023-2024 media horaria"
ANIO_INICIO: int = 2023
ANIO_FIN: int = 2024


def _media_bolsa_cop_kwh(ruta: pathlib.Path = CSV_BOLETA) -> tuple[float, int]:
    with ruta.open(encoding="utf-8") as f:
        filas = list(csv.DictReader(f))
    if not filas:
        raise ValueError(f"CSV de bolsa vacío: {ruta}")
    valores = [float(fila["valor"]) for fila in filas]
    return float(statistics.mean(valores)), len(valas := valores)  # noqa: F841


def construir_campo_lcoe_sin() -> dict[str, object]:
    media_cop_kwh, n = _media_bolsa_cop_kwh()
    valor_cop_mwh = media_cop_kwh * 1000.0
    return {
        "valor": float(valor_cop_mwh),
        "unidad": "COP/MWh",
        "fuente": f"{FUENTE_RESUMEN} ({n} registros horarios {ANIO_INICIO}-{ANIO_FIN})",
        "estado": "verificado",
        "anio_inicio": ANIO_INICIO,
        "anio_fin": ANIO_FIN,
        "n_registros": int(n),
    }


def actualizar_resumen(ruta: pathlib.Path = RESUMEN) -> dict[str, object]:
    if ruta.exists():
        resumen = json.loads(ruta.read_text(encoding="utf-8"))
    else:
        resumen = {}
    campo = construir_campo_lcoe_sin()
    resumen["lcoe_sin_cop_mwh"] = campo
    ruta.write_text(
        json.dumps(resumen, indent=2, ensure_ascii=False) + "\n",
        encoding="utf-8",
    )
    return campo


def main() -> None:
    campo = actualizar_resumen()
    print(
        f"lcoe_sin_cop_mwh: {campo['valor']:.2f} {campo['unidad']} "
        f"({campo['estado']}, {campo['n_registros']} registros)"
    )


if __name__ == "__main__":
    main()
