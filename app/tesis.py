from __future__ import annotations

DENSIDADES: list[dict[str, str | float]] = [
    {
        "concepto": "Costa oeste de Europa",
        "valor": 50.0,
        "unidad": "kW/m",
        "fuente": "Cruz (2008) cap 1",
    },
    {
        "concepto": "Umbral rentabilidad granjas",
        "valor": 40.0,
        "unidad": "kW/m",
        "fuente": "Osorio et al. 2016",
    },
    {
        "concepto": "Buena ubicacion Handbook",
        "valor": 15.0,
        "unidad": "kW/m",
        "fuente": "Handbook cap 1 4.5 >15 kW/m",
    },
    {
        "concepto": "Isla Fuerte",
        "valor": 8.9,
        "unidad": "kW/m",
        "fuente": "Ortega et al. 2013 RE 57 240-248",
    },
    {
        "concepto": "Isla Fuerte ERA5 (rejilla 0,5°)",
        "valor": 1.96,
        "unidad": "kW/m",
        "fuente": "ERA5-Ocean 2015-2024 1,96 kW/m inferido - datos/oleaje/resumen_oleaje_era5.json",
    },
    {
        "concepto": "Caribe CLLJ",
        "valor": 11.0,
        "unidad": "kW/m",
        "fuente": "Appendini et al. 2015 8-14 kW/m",
    },
    {
        "concepto": "Caribe lluvias",
        "valor": 1.0,
        "unidad": "kW/m",
        "fuente": "Osorio et al. ~1 kW/m",
    },
    {
        "concepto": "Minimo aprovechable",
        "valor": 2.0,
        "unidad": "kW/m",
        "fuente": "Citado mundial 2 kW/m",
    },
]


def contraste_isla_fuerte_vs_umbral() -> dict[str, object]:
    return {
        "isla_fuerte_kw_m": 8.9,
        "fuente_isla_fuerte": "Ortega et al. 2013 8,9 kW/m verificado",
        "umbral_kw_m": 40.0,
        "fuente_umbral": "Osorio et al. 2016 40 kW/m",
        "factor": 40.0 / 8.9,
        "texto": "Isla Fuerte 8,9 kW/m frente a umbral 40 kW/m - 4,5 veces menos por mismo dispositivo y coste",
        "discrepancia": "ERA5 1,96 kW/m (rejilla 55 km, 23 km desplazamiento) 4,5x menor que 8,9 revisado pares - banda incertidumbre, no se promedia",
    }


def tabla_densidades_con_fuente() -> list[dict[str, str | float]]:
    return list(DENSIDADES)


def tesis_texto() -> str:
    c = contraste_isla_fuerte_vs_umbral()
    lineas = [
        "Tesis: energia marina Colombia marginal frente a SIN, competitiva frente a diesel ZNI.",
        f"Contraste: {c['isla_fuerte_kw_m']} kW/m (Isla Fuerte) vs {c['umbral_kw_m']} kW/m (umbral) - factor {c['factor']:.1f}x",
        "Tabla densidades con fuente:",
    ]
    for r in DENSIDADES:
        lineas.append(f"- {r['concepto']}: {r['valor']} {r['unidad']} ({r['fuente']})")
    lineas.append(f"Nota: {c['discrepancia']}")
    return "\n".join(lineas)
