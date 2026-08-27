from __future__ import annotations

import csv
import pathlib

from nucleo.resultado import Resultado

TRADUCCIONES: dict[str, str] = {
    "Hm0": "qué tan grandes son las olas",
    "Te": "cada cuánto llega una ola",
    "B_pto": "qué tan duro frena la boya",
    "J": "fuerza del mar",
    "CWR": "cuánto aprovecha la boya",
    "AEP": "para cuántas casas alcanza",
    "R": "cuánto sube y baja el mar",
    "densidad_potencia": "fuerza del mar",
    "altura_significativa": "qué tan grandes son las olas",
    "periodo_energetico": "cada cuánto llega una ola",
    "amortiguamiento_pto": "qué tan duro frena la boya",
    "produccion_anual": "para cuántas casas alcanza",
    "rango_mareal": "cuánto sube y baja el mar",
}


def traducir(termino: str) -> str:
    return TRADUCCIONES.get(termino, termino)


def _consumo_residencial_kwh_mes() -> tuple[float | None, str]:
    ruta = pathlib.Path("datos/zni/comercial_residencial_isla_fuerte_2022.csv")
    if not ruta.exists():
        return None, "pendiente - sin archivo comercial_residencial_isla_fuerte_2022.csv"
    totales: list[float] = []
    try:
        with ruta.open(encoding="utf-8") as f:
            lector = csv.DictReader(f)
            for fila in lector:
                try:
                    c = float((fila.get("consumo_basico") or "").strip() or 0)
                except ValueError:
                    continue
                if c > 0:
                    totales.append(c)
    except OSError:
        return None, "pendiente - error lectura"
    if not totales:
        return None, "pendiente - sin consumos >0"
    media = sum(totales) / len(totales)
    return (
        media,
        "Superservicios p62q-r7ag Isla Fuerte feb-mar 2022, promedio consumo_basico>0, verificado",
    )


def _consumo_por_defecto() -> tuple[float, str, str]:
    cons, fuente = _consumo_residencial_kwh_mes()
    if cons is not None and cons > 0:
        return cons, fuente, "verificado"
    return 0.0, fuente, "pendiente"


def viviendas_alimentadas(
    produccion_anual_mwh: float | None = None,
    resultado: Resultado | None = None,
) -> dict[str, object]:
    if resultado is not None:
        mwh = float(resultado.produccion_anual_mwh)
    elif produccion_anual_mwh is not None:
        mwh = float(produccion_anual_mwh)
    else:
        mwh = 0.0
    cons_mes, fuente, estado = _consumo_por_defecto()
    if estado == "pendiente" or cons_mes <= 0:
        return {
            "viviendas": None,
            "consumo_kwh_mes": None,
            "fuente": fuente,
            "estado": "pendiente",
            "texto": "pendiente - consumo residencial no verificado",
        }
    kwh_ano = mwh * 1000.0
    cons_ano = cons_mes * 12.0
    viviendas = kwh_ano / cons_ano if cons_ano > 0 else 0.0
    return {
        "viviendas": viviendas,
        "consumo_kwh_mes": cons_mes,
        "fuente": fuente,
        "estado": "verificado" if estado == "verificado" else "inferido",
        "texto": f"alcanza para {viviendas:.0f} viviendas ({cons_mes:.1f} kWh/mes)",
    }


def descripcion_nivel(nivel: str) -> str:
    textos = {
        "ver": "Animación del mar y boya, tres controles en lenguaje corriente",
        "comparar": "Dos tecnologías lado a lado, Sankey, fichas reales sin fórmulas",
        "calcular": "Cada fórmula con números sustituidos, unidades y fuente",
        "disenar": "Resonancia, captura, límites, matriz potencia y coste por MWh",
    }
    return textos.get(nivel, nivel)
