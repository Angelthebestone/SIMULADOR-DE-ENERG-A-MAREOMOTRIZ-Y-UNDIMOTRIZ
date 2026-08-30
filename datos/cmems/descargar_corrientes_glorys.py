"""Regenera series de corrientes Copernicus GLORYS12 1/12° (~9 km) para los cinco emplazamientos.

Fuente: Copernicus Marine Service, producto GLOBAL_MULTIYEAR_PHY_001_030
(GLORYS12V1, 1/12°, variables uo/vo). Requiere cuenta Copernicus Marine y
`copernicusmarine login`.

    pip install -e ".[ingesta]"
    copernicusmarine login
    python datos/cmems/descargar_corrientes_glorys.py
"""

from __future__ import annotations

import csv
import json
import math
import pathlib
import statistics

DATASET_ID = "cmems_mod_glo_phy_my_0.083deg_P1D-m"
VARIABLES = ["uo", "vo"]
RESOLUCION_GRADOS = 1 / 12
RESOLUCION_KM = 9.0
PERIODO = "2015-01-01/2024-12-31"

EMPLAZAMIENTOS = {
    "isla_fuerte": ("Isla Fuerte", 9.390, -76.180),
    "san_andres": ("San Andrés", 12.569, -81.701),
    "tumaco": ("Tumaco", 1.903, -78.912),
    "islas_rosario": ("Islas del Rosario", 10.235, -75.741),
    "bahia_malaga": ("Bahía Málaga", 3.925, -77.349),
}


def _celda_cercana(lat: float, lon: float) -> tuple[float, float, float]:
    glat = round(lat / RESOLUCION_GRADOS) * RESOLUCION_GRADOS
    glon = round(lon / RESOLUCION_GRADOS) * RESOLUCION_GRADOS
    dlat = (lat - glat) * 111.32
    dlon = (lon - glon) * 111.32 * math.cos(math.radians(lat))
    dist_km = math.hypot(dlat, dlon)
    return glat, glon, round(dist_km, 2)


def descargar(lat: float, lon: float, out_dir: pathlib.Path):
    try:
        import copernicusmarine  # type: ignore
        import xarray  # type: ignore
    except ImportError as e:
        raise SystemExit("Falta extra [ingesta]: pip install -e '.[ingesta]'") from e
    glat, glon, _ = _celda_cercana(lat, lon)
    delta = RESOLUCION_GRADOS * 0.6
    out = out_dir / f"cmems_corriente_{lat:.3f}_{lon:.3f}.nc"
    copernicusmarine.subset(
        dataset_id=DATASET_ID,
        variables=VARIABLES,
        minimum_longitude=glon - delta,
        maximum_longitude=glon + delta,
        minimum_latitude=glat - delta,
        maximum_latitude=glat + delta,
        start_datetime=PERIODO.split("/")[0],
        end_datetime=PERIODO.split("/")[1],
        output_filename=str(out),
        force_download=True,
    )
    ds = xarray.open_dataset(out)
    return ds


def velocidad_media(vels: list[float]) -> tuple[float, float]:
    if not vels:
        return 0.0, 0.0
    return statistics.mean(vels), statistics.median(vels)


if __name__ == "__main__":
    carpeta = pathlib.Path(__file__).parent
    resumen = {}
    for clave, (nombre, lat, lon) in EMPLAZAMIENTOS.items():
        glat, glon, dist = _celda_cercana(lat, lon)
        destino = carpeta / f"corriente_{clave}_glorys_2015-2024.csv"
        existe = destino.exists()
        n = 0
        v_med = None
        if existe:
            with destino.open(encoding="utf-8") as f:
                rows = list(csv.DictReader(f))
                n = len(rows)
                vels = []
                for r in rows:
                    try:
                        vels.append(float(r.get("velocidad_ms") or r.get("v_ms") or 0))
                    except (TypeError, ValueError):
                        continue
                if vels:
                    v_med = round(statistics.mean(vels), 3)
        resumen[clave] = {
            "nombre": nombre,
            "lat_solicitada": lat,
            "lon_solicitada": lon,
            "lat_celda": glat,
            "lon_celda": glon,
            "resolucion_grados": RESOLUCION_GRADOS,
            "resolucion_km": RESOLUCION_KM,
            "distancia_celda_km": dist,
            "periodo": PERIODO,
            "registros": n,
            "velocidad_media_ms": v_med,
            "archivo": destino.name,
            "dataset": DATASET_ID,
            "origen": "Copernicus Marine GLORYS12 1/12° GLOBAL_MULTIYEAR_PHY_001_030 uo/vo",
        }
        print(f"{clave}: celda {glat:.4f},{glon:.4f} dist {dist} km, {n} registros, V={v_med} m/s")
    (carpeta / "resumen_corrientes_glorys.json").write_text(
        json.dumps(resumen, indent=2, ensure_ascii=False), encoding="utf-8"
    )
    print("resumen_corrientes_glorys.json actualizado")
