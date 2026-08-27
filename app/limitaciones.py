from __future__ import annotations

LIMITACIONES: list[str] = [
    "Oleaje omnidireccional sin espectros direccionales ni bimodales (Handbook cap 3 3.3) - limitacion declarada en pantalla.",
    "Coeficientes hidrodinamicos A(w), B(w), F_e de literatura (Falnes 2002, Babarit 2012) sin calculo BEM - no resuelve problema de contorno; citar geometria de referencia.",
    "Sin calculo de amarres, fatiga ni supervivencia estructural - solo mencionados como criterio de diseno, no calculados.",
]

LIMITACIONES_DISPERSION: list[str] = [
    "Diagrama de dispersion Hs-Te: dentro de una celda variacion 4 a 1 en potencia; celda no guarda direccion ni forma espectral (Handbook cap 3 fig 9).",
    "Dispersion no guarda informacion direccional completa requerida por serie direccional (Handbook cap 3 3.3).",
]

ATRIBUCIONES: list[str] = [
    "IDEAM nivel del mar Preliminar (900) sin dato definitivo 1200 - series Escuela Naval CIOH y Buenaventura IDEAM, datos/ideam/.",
    "ERA5-Ocean via Open-Meteo rejilla 0,5° ~23 km desplazamiento (Isla Fuerte 9,5N -76,0W), 2015-2024 87672 registros, datos/oleaje/resumen_oleaje_era5.json.",
    "GMRT Lamont-Doherty batimetria transecto radial 275 puntos, datos/batimetria/.",
    "RUNAP PNN 37 areas marinas 305.335 km2, datos/runap/areas_marinas_protegidas_atributos.json.",
    "Superservicios ZNI/SIN 3ebi-d83g demanda, 5cvc-m38t costo ZNI, td8k-vhq9 SIN - datos/zni/, documentacion/fuentes_datos_economicos.md.",
    "XM/API_XM EquipoAnaliticaXM pydataxm MIT https://github.com/EquipoAnaliticaXM/API_XM, metricas PrecBolsNaci y factorEmisionCO2e horarios 8760 filas 2023, datos/xm/resumen_xm.json.",
]


def texto_limitaciones() -> str:
    lineas = ["Limitaciones del modelo:"]
    for i, t in enumerate(LIMITACIONES, 1):
        lineas.append(f"{i}. {t}")
    lineas.append("")
    lineas.append("Limitaciones del diagrama de dispersion:")
    for t in LIMITACIONES_DISPERSION:
        lineas.append(f"- {t}")
    lineas.append("")
    lineas.append("Atribuciones:")
    for t in ATRIBUCIONES:
        lineas.append(f"- {t}")
    return "\n".join(lineas)


def atribuciones_dict() -> dict[str, str]:
    return {
        "ideam": ATRIBUCIONES[0],
        "era5": ATRIBUCIONES[1],
        "gmrt": ATRIBUCIONES[2],
        "runap": ATRIBUCIONES[3],
        "superservicios": ATRIBUCIONES[4],
        "xm": ATRIBUCIONES[5],
    }
