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
        raise SystemExit(
            "Sin credenciales/dependencias GLORYS: falta extra [ingesta]. "
            "Ejecuta: pip install -e '.[ingesta]' y luego 'copernicusmarine login'."
        ) from e
    glat, glon, _ = _celda_cercana(lat, lon)
    delta = RESOLUCION_GRADOS * 0.6
    out = out_dir / f"cmems_corriente_{lat:.3f}_{lon:.3f}.nc"
    try:
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
    except SystemExit:
        raise
    except Exception as e:
        raise SystemExit(
            "Fallo Copernicus Marine subset (auth/red). Verifica "
            "'pip install -e '.[ingesta]'' y 'copernicusmarine login'. "
            f"Detalle: {e}"
        ) from e
    return ds


def velocidad_media(vels: list[float]) -> tuple[float, float]:
    if not vels:
        return 0.0, 0.0
    return statistics.mean(vels), statistics.median(vels)


def _guardar_celda_csv(ds, glat: float, glon: float, destino: pathlib.Path) -> tuple[int, float, float]:
    """Recorta el dataset a la celda nearest (superficie) y lo guarda como CSV.

    Columnas: fecha_hora_utc,uo,vo,velocidad_ms con velocidad_ms=hypot(uo,vo).
    Devuelve (n_registros, media, mediana).
    """
    lat_n = next((c for c in ("latitude", "lat", "nav_lat") if c in ds.coords or c in ds.dims), None)
    lon_n = next((c for c in ("longitude", "lon", "nav_lon") if c in ds.coords or c in ds.dims), None)
    if lat_n is None or lon_n is None:
        raise SystemExit("Dataset GLORYS sin coordenadas lat/lon reconocibles.")
    celda = ds
    for prof_n in ("depth", "deptht", "lev", "z", "level"):
        if prof_n in ds.coords or prof_n in ds.dims:
            celda = celda.isel({prof_n: 0})
            break
    celda = celda.sel({lat_n: glat, lon_n: glon}, method="nearest")
    time_n = next(
        (c for c in ("time", "valid_time", "counter") if c in celda.coords or c in celda.dims),
        None,
    )
    if time_n is None or "uo" not in celda or "vo" not in celda:
        raise SystemExit("Dataset GLORYS sin variables uo/vo/tiempo reconocibles.")
    tiempos = celda[time_n].values
    u_vals = celda["uo"].values
    v_vals = celda["vo"].values
    try:
        n = len(tiempos)
    except TypeError:
        tiempos = [tiempos]
        u_vals = [u_vals]
        v_vals = [v_vals]
        n = 1
    vels: list[float] = []
    with destino.open("w", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        w.writerow(["fecha_hora_utc", "uo", "vo", "velocidad_ms"])
        for t, u, v in zip(tiempos.flat if hasattr(tiempos, "flat") else tiempos,
                           u_vals.flat if hasattr(u_vals, "flat") else u_vals,
                           v_vals.flat if hasattr(v_vals, "flat") else v_vals):
            try:
                uf = float(u)
                vf = float(v)
            except (TypeError, ValueError):
                continue
            vel = math.hypot(uf, vf)
            vels.append(vel)
            if hasattr(t, "isoformat"):
                try:
                    fecha = t.isoformat()  # type: ignore[union-attr]
                except Exception:
                    fecha = str(t)
            else:
                fecha = str(t)
            w.writerow([fecha, f"{uf:.6f}", f"{vf:.6f}", f"{vel:.6f}"])
    media, mediana = velocidad_media(vels)
    return len(vels), round(media, 3), round(mediana, 3)


if __name__ == "__main__":
    carpeta = pathlib.Path(__file__).parent
    resumen = {}
    for clave, (nombre, lat, lon) in EMPLAZAMIENTOS.items():
        glat, glon, dist = _celda_cercana(lat, lon)
        destino = carpeta / f"corriente_{clave}_glorys_2015-2024.csv"
        try:
            ds = descargar(lat, lon, carpeta)
        except SystemExit:
            raise
        except Exception as e:
            raise SystemExit(
                "Fallo Copernicus Marine subset (auth/red). Verifica "
                "'pip install -e '.[ingesta]'' y 'copernicusmarine login'. "
                f"Detalle: {e}"
            ) from e
        try:
            n, v_med, v_mediana = _guardar_celda_csv(ds, glat, glon, destino)
        finally:
            try:
                ds.close()
            except Exception:
                pass
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
            "velocidad_mediana_ms": v_mediana,
            "estado": "ok",
            "archivo": destino.name,
            "dataset": DATASET_ID,
            "origen": "Copernicus Marine GLORYS12 1/12° GLOBAL_MULTIYEAR_PHY_001_030 uo/vo",
        }
        print(f"{clave}: celda {glat:.4f},{glon:.4f} dist {dist} km, {n} registros, V={v_med} m/s")
    # Solo se escribe si TODAS las descargas tuvieron éxito: sin credenciales
    # se aborta con SystemExit antes de llegar aquí y el resumen no se toca.
    (carpeta / "resumen_corrientes_glorys.json").write_text(
        json.dumps(resumen, indent=2, ensure_ascii=False), encoding="utf-8"
    )
    print("resumen_corrientes_glorys.json actualizado")
