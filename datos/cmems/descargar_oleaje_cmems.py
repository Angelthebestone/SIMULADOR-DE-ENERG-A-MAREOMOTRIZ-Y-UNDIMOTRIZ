"""Regenera series de oleaje Copernicus Marine a 1/12° (~9 km) para los cinco emplazamientos.

Fuente: Copernicus Marine Service, producto GLOBAL_ANALYSISFORECAST_WAV_001_027 (WAM)
o SEALEVEL_GLO_PHY_L4_MY_008_047 para parametro ancilar. Requiere cuenta
Copernicus Marine (gratuita, registro en marine.copernicus.eu) y credenciales
configuradas via `copernicusmarine login`.

Patron de los nueve scripts existentes: solo biblioteca de ingesta (copernicusmarine,
xarray, netCDF4) en extra [ingesta]; el simulador nunca importa este modulo.

    pip install -e ".[ingesta]"
    copernicusmarine login
    python datos/cmems/descargar_oleaje_cmems.py
"""

from __future__ import annotations

import csv
import json
import math
import pathlib
import statistics

DATASET_ID = "cmems_mod_glo_wav_anfc_0.083deg_PT3H-i"
VARIABLES = ["VHM0", "VTM02", "VMDR"]
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

DENSIDAD_AGUA = 1025.0
G = 9.81
CONSTANTE_J = DENSIDAD_AGUA * G**2 / (64 * math.pi) / 1000


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
    out = out_dir / f"cmems_oleaje_{lat:.3f}_{lon:.3f}.nc"
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


def densidad_potencia_media(hs: list[float], te: list[float]) -> float:
    vals = [CONSTANTE_J * h * h * t for h, t in zip(hs, te) if h is not None and t is not None]
    return statistics.mean(vals) if vals else 0.0


if __name__ == "__main__":
    carpeta = pathlib.Path(__file__).parent
    resumen = {}
    for clave, (nombre, lat, lon) in EMPLAZAMIENTOS.items():
        glat, glon, dist = _celda_cercana(lat, lon)
        destino = carpeta / f"oleaje_{clave}_cmems_2015-2024.csv"
        existe = destino.exists()
        n = 0
        j_media = 0.0
        if existe:
            with destino.open(encoding="utf-8") as f:
                rows = list(csv.DictReader(f))
                n = len(rows)
                hs = [float(r["hs_m"]) for r in rows if r.get("hs_m")]
                te = [float(r["te_s"]) for r in rows if r.get("te_s")]
                j_media = densidad_potencia_media(hs, te) if hs else 0.0
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
            "densidad_potencia_media_kw_m": round(j_media, 3) if j_media else None,
            "archivo": destino.name,
            "dataset": DATASET_ID,
            "origen": "Copernicus Marine Service GLOBAL_ANALYSISFORECAST_WAV_001_027 1/12°",
        }
        print(f"{clave}: celda {glat:.4f},{glon:.4f} dist {dist} km, {n} registros, J={j_media:.2f} kW/m")
    (carpeta / "resumen_oleaje_cmems.json").write_text(
        json.dumps(resumen, indent=2, ensure_ascii=False), encoding="utf-8"
    )
    print("resumen_oleaje_cmems.json actualizado")
