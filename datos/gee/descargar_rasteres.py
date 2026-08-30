"""Exporta rasters GEE: batimetria sombreada, Sentinel-2 sin nubes, relieve y VIIRS nocturno.

Fuentes:
- Sentinel-2 SR Harmonized (COPERNICUS/S2_SR_HARMONIZED), composicion mediana 2023-2024
- GEBCO 2023 batimetria (NOAA/GEBCO o GEBCO/GEBCO_2023)
- Copernicus DEM GLO-30 relieve sombreado
- VIIRS DNB luces nocturnas (NOAA/VIIRS/DNB/MONTHLY_V1/VCMSLCFG 2023)

Requiere cuenta Google Earth Engine (earthengine.google.com) y autenticacion:

    pip install -e ".[ingesta]"
    earthengine authenticate
    python datos/gee/descargar_rasteres.py

Productos: mosaicos piramidados (XYZ 256px) + descripcion JSON por capa.
El simulador nunca importa este modulo; solo lee los mosaicos congelados.
"""

from __future__ import annotations

import json
import math
import pathlib

RECORTE = {"lon_min": -82.6, "lon_max": -70.8, "lat_min": 0.8, "lat_max": 15.2}

CAPAS = {
    "batimetria_sombreada": {
        "coleccion": "GEBCO/GEBCO_2023",
        "descripcion": "Batimetria GEBCO 2023 sombreada, intervalo 15 arcsec (~450 m)",
        "resolucion_m": 450,
        "rango": "2023",
        "licencia": "GEBCO Compilation Group (2023), CC BY 4.0",
        "niveles": [0, 1, 2, 3, 4, 5, 6, 7, 8],
        "zoom_max": 8,
    },
    "sentinel2_mediana": {
        "coleccion": "COPERNICUS/S2_SR_HARMONIZED",
        "descripcion": "Sentinel-2 SR mediana sin nubes 2023-01-01/2024-12-31, 10 m RGB",
        "resolucion_m": 10,
        "rango": "2023-01-01/2024-12-31",
        "licencia": "ESA Sentinel-2, CC BY-SA 3.0 IGO",
        "niveles": [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
        "zoom_max": 10,
    },
    "relieve_sombreado": {
        "coleccion": "COPERNICUS/DEM/GLO30",
        "descripcion": "Copernicus DEM GLO-30 hillshade, 30 m",
        "resolucion_m": 30,
        "rango": "2021",
        "licencia": "ESA Copernicus DEM, CC BY 4.0",
        "niveles": [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
        "zoom_max": 9,
    },
    "viirs_nocturno": {
        "coleccion": "NOAA/VIIRS/DNB/MONTHLY_V1/VCMSLCFG",
        "descripcion": "VIIRS DNB mensual promedio 2023, 15 arcsec (~450 m) luces nocturnas",
        "resolucion_m": 450,
        "rango": "2023",
        "licencia": "NOAA VIIRS, public domain",
        "niveles": [0, 1, 2, 3, 4, 5, 6, 7, 8],
        "zoom_max": 8,
    },
}


def estimar_producto_plano(resolucion_m: float) -> dict[str, float]:
    lon_deg = RECORTE["lon_max"] - RECORTE["lon_min"]
    lat_deg = RECORTE["lat_max"] - RECORTE["lat_min"]
    lat_media = (RECORTE["lat_min"] + RECORTE["lat_max"]) / 2
    ancho_m = lon_deg * 111320 * math.cos(math.radians(lat_media))
    alto_m = lat_deg * 110540
    nx = ancho_m / resolucion_m
    ny = alto_m / resolucion_m
    pixeles = nx * ny
    mb_rgb8 = pixeles * 3 / (1024 * 1024)
    n_mosaicos_z10 = math.ceil(nx / 256) * math.ceil(ny / 256)
    return {
        "ancho_m": round(ancho_m),
        "alto_m": round(alto_m),
        "nx_pixeles": round(nx),
        "ny_pixeles": round(ny),
        "megapixeles": round(pixeles / 1e6, 1),
        "mb_rgb8": round(mb_rgb8, 1),
        "mosaicos_z10": n_mosaicos_z10,
    }


def exportar_con_geemap(capa_id: str, cfg: dict, carpeta: pathlib.Path):
    try:
        import ee  # type: ignore
        import geemap  # type: ignore  # noqa: F401 — verifica instalacion, usa ee.Initialize+roi
    except ImportError as e:
        raise SystemExit("Falta extra [ingesta]: pip install -e '.[ingesta]' y earthengine authenticate") from e
    ee.Initialize()
    roi = ee.Geometry.Rectangle([RECORTE["lon_min"], RECORTE["lat_min"], RECORTE["lon_max"], RECORTE["lat_max"]])
    raise SystemExit("Implementacion GEE placeholder: completar export a Cloud Storage + piramidacion gdal2tiles")


if __name__ == "__main__":
    carpeta = pathlib.Path(__file__).parent
    print("Estimacion producto plano por capa (recorte -82.6..-70.8 x 0.8..15.2):")
    for cid, cfg in CAPAS.items():
        est = estimar_producto_plano(cfg["resolucion_m"])
        print(f"  {cid}: {est['nx_pixeles']}x{est['ny_pixeles']} = {est['megapixeles']} Mpx ~{est['mb_rgb8']} MB RGB8, z10 mosaicos ~{est['mosaicos_z10']}")
        desc = carpeta / f"{cid}.json"
        doc = {
            "id": cid,
            "coleccion": cfg["coleccion"],
            "descripcion": cfg["descripcion"],
            "recorte": RECORTE,
            "resolucion_m": cfg["resolucion_m"],
            "rango": cfg["rango"],
            "licencia": cfg["licencia"],
            "niveles": cfg["niveles"],
            "zoom_max": cfg["zoom_max"],
            "fuente": cfg["coleccion"] + " via Google Earth Engine",
            "estimacion_plano": est,
            "procedimiento": "geemap Export.image.toDrive + gdal2tiles piramidacion XYZ 256px; ver descargar_rasteres.py",
        }
        desc.write_text(json.dumps(doc, indent=2, ensure_ascii=False), encoding="utf-8")
        print(f"    -> {desc.name}")
    print("\nPara exportar: pip install -e '.[ingesta]' ; earthengine authenticate ; python datos/gee/descargar_rasteres.py")
