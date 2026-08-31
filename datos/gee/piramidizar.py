"""Pirámide de teselas XYZ (256 px, mercator) por capa ráster del mapa.

Toma una imagen georreferenciada de origen (GeoTIFF) y produce el árbol de
teselas `datos/<capa>/<z>/<x>/<y>.png` con un `metadata.json` adyacente.
Si la imagen de origen no existe (p.ej. la tarea 3.5 quedó pendiente por
falta de credenciales de Earth Engine), genera un **placeholder sintético**
(un PNG de color sólido con el nombre de la capa repetido en cada tesela).
Esto no satisface el spec visualmente, pero cumple el contrato de que
`web/src/map/mapa.ts` carga teselas desde `./datos/<capa>/{z}/{x}/{y}.png`.

Estrategia de motor (orden de preferencia):
  1. `gdal2tiles.py -z 0-N -w none -p mercator` si GDAL está disponible.
  2. `rio-tiler` + recorte manual a teselas XYZ 256 px.
  3. `titiler`.
  4. Wrapper mínimo en Pillow (genera teselas de color sólido o muestrea
     la imagen origen) — siempre disponible.

Uso:
    python datos/gee/piramidizar.py <ruta_al_raster> [--capa <id>] [--placeholder]
    python datos/gee/piramidizar.py --capa batimetria_sombreada --placeholder

El parámetro `--maxzoom N` (opcional) fuerza el nivel máximo de la pirámide;
si se omite, se calcula desde la resolución nativa declarada en
`datos/gee/<id>.json`.

El manifiesto `datos/manifiesto.json` se actualiza con la entrada de la
pirámide (sha256 del árbol más el `metadata.json`).
"""

from __future__ import annotations

import argparse
import hashlib
import json
import math
import os
import shutil
import subprocess
import sys
import textwrap
import time
from pathlib import Path

try:
    from PIL import Image, ImageDraw, ImageFont
except ImportError:  # pragma: no cover
    sys.stderr.write("Falta Pillow: pip install Pillow\n")
    raise


# Recuadro canónico del proyecto (batimetría, relieve, sentinel, viirs).
RECORTE = {"lon_min": -82.6, "lon_max": -70.8, "lat_min": 0.8, "lat_max": 15.2}

# Resolución nativa → maxzoom por capa. Coincide con el spec piramide-raster
# (10 m → 14, 30 m → 12, 500 m → 8). Batimetría GEBCO 15 arc-sec ≈ 450 m
# admite zoom 8 nativo; se acepta maxzoom 11 por encima de la nativa (sobra
# de muestreo: cada tesela muestra el mismo color de fondo).
MAXZOOM_POR_RESOLUCION_M = {
    10: 14,   # Sentinel-2
    30: 12,   # Copernicus DEM GLO-30
    450: 11,  # GEBCO 15 arc-sec (placeholder nativo ≈ 8; 11 por holgura)
    500: 8,   # VIIRS DNB
}

# Colores por capa (RGB). Coherentes con la leyenda de `web/src/map/capas.ts`.
COLOR_POR_CAPA = {
    "batimetria_sombreada": (32, 86, 122),    # azul batimétrico
    "sentinel2_mediana": (66, 133, 88),       # verde óptico
    "relieve_sombreado": (138, 110, 78),      # sepia relieve
    "viirs_nocturno": (15, 15, 24),           # negro nocturno
}

# Maxzoom efectivo cuando la capa es un placeholder. La pirámide completa
# hasta 11/14/12/8 declarada en el spec genera millones de teselas inútiles
# (todas del mismo color). Cap para placeholder: 9 (unos cientos de teselas).
PLACEHOLDER_MAXZOOM_CAP = 9


def _resolver_maxzoom(capa_id: str, json_meta: Path) -> int:
    """Devuelve el maxzoom declarado en el JSON de metadatos o el de la tabla."""
    if json_meta.exists():
        meta = json.loads(json_meta.read_text(encoding="utf-8"))
        for clave in ("maxzoom", "zoom_max"):
            if clave in meta:
                return int(meta[clave])
    # Recurso: el spec del proyecto fija 11/14/12/8 por capa.
    fijos = {
        "batimetria_sombreada": 11,
        "sentinel2_mediana": 14,
        "relieve_sombreado": 12,
        "viirs_nocturno": 8,
    }
    if capa_id in fijos:
        return fijos[capa_id]
    # Fallback por resolución nativa.
    for res_m, mz in MAXZOOM_POR_RESOLUCION_M.items():
        # heurística: el JSON declara `resolucion_m`
        if json_meta.exists():
            rm = json.loads(json_meta.read_text(encoding="utf-8")).get("resolucion_m")
            if rm and abs(rm - res_m) < 50:
                return mz
    return 8


def _bbox_desde_recorte(recorte: dict) -> tuple[float, float, float, float]:
    """(lon_min, lat_min, lon_max, lat_max)."""
    return (
        float(recorte["lon_min"]),
        float(recorte["lat_min"]),
        float(recorte["lon_max"]),
        float(recorte["lat_max"]),
    )


def _lonlat_a_tile(lon: float, lat: float, z: int) -> tuple[int, int]:
    """Convierte lon/lat (WGS84) a coordenadas XYZ en web mercator."""
    n = 2 ** z
    xtile = int((lon + 180.0) / 360.0 * n)
    lat_rad = math.radians(lat)
    ytile = int(
        (1.0 - math.log(math.tan(lat_rad) + 1.0 / math.cos(lat_rad)) / math.pi)
        / 2.0
        * n
    )
    return xtile, ytile


def _tile_bounds(x: int, y: int, z: int) -> tuple[float, float, float, float]:
    """Devuelve (lon_min, lat_min, lon_max, lat_max) de una tesela XYZ."""
    n = 2 ** z
    lon_min = x / n * 360.0 - 180.0
    lon_max = (x + 1) / n * 360.0 - 180.0
    lat_max = math.degrees(math.atan(math.sinh(math.pi * (1 - 2 * y / n))))
    lat_min = math.degrees(math.atan(math.sinh(math.pi * (1 - 2 * (y + 1) / n))))
    return lon_min, lat_min, lon_max, lat_max


# --- Motores de piramidación ---------------------------------------------------


def _motor_gdal2tiles(ruta_origen: Path, salida: Path, maxzoom: int) -> bool:
    """Intenta usar gdal2tiles.py si está disponible. Devuelve True si ok."""
    binarios = ["gdal2tiles.py", "gdal2tiles"]
    for cmd in binarios:
        ruta = shutil.which(cmd)
        if ruta:
            try:
                subprocess.run(
                    [ruta, "-z", f"0-{maxzoom}", "-w", "none", "-p", "mercator",
                     "-r", "near", str(ruta_origen), str(salida)],
                    check=True,
                    stdout=subprocess.DEVNULL,
                    stderr=subprocess.DEVNULL,
                )
                return True
            except (subprocess.CalledProcessError, OSError):
                continue
    # GDAL Python
    try:
        from osgeo import gdal2tiles as _g2t  # type: ignore
    except ImportError:
        return False
    try:
        _g2t.generate_tiles(
            str(ruta_origen), str(salida), zoom_range=(0, maxzoom),
            profile="mercator", webviewer="none", resampling="near",
        )
        return True
    except Exception:
        return False


def _motor_rio_tiler(ruta_origen: Path, salida: Path, maxzoom: int,
                      bbox: tuple[float, float, float, float]) -> bool:
    """Piramidación con rasterio + Pillow. Devuelve True si ok."""
    try:
        import rasterio  # type: ignore
        from rasterio.windows import from_bounds  # type: ignore
    except ImportError:
        return False
    try:
        with rasterio.open(str(ruta_origen)) as src:
            n_canales = min(src.count, 3)
            for z in range(0, maxzoom + 1):
                lon_min, lat_min, lon_max, lat_max = bbox
                x0, y0 = _lonlat_a_tile(lon_min, lat_max, z)
                x1, y1 = _lonlat_a_tile(lon_max, lat_min, z)
                for xtile in range(x0, x1 + 1):
                    dir_z = salida / str(z) / str(xtile)
                    dir_z.mkdir(parents=True, exist_ok=True)
                    for ytile in range(y0, y1 + 1):
                        tlon_min, tlat_min, tlon_max, tlat_max = _tile_bounds(
                            xtile, ytile, z
                        )
                        # Ajuste al borde del bbox global
                        tlmin = max(tlon_min, lon_min)
                        tlat_mn = max(tlat_min, lat_min)
                        tlmax = min(tlon_max, lon_max)
                        tlat_mx = min(tlat_max, lat_max)
                        if tlmin >= tlmax or tlat_mn >= tlat_mx:
                            continue
                        ventana = from_bounds(tlmin, tlat_mn, tlmax, tlat_mx,
                                              src.transform)
                        arr = src.read(
                            indexes=list(range(1, n_canales + 1)),
                            window=ventana,
                            out_shape=(n_canales, 256, 256),
                            resampling=rasterio.enums.Resampling.nearest,
                        )
                        # (C, H, W) → (H, W, C)
                        if arr.shape[0] == 1:
                            img = Image.fromarray(arr[0], mode="L").convert("RGB")
                        elif arr.shape[0] == 2:
                            rgb = Image.new("RGB", (arr.shape[2], arr.shape[1]))
                            rgb.putdata([(int(arr[0, y, x] & 0xff),
                                          int(arr[1, y, x] & 0xff), 0)
                                         for y in range(arr.shape[1])
                                         for x in range(arr.shape[2])])
                            img = rgb
                        else:
                            img = Image.fromarray(
                                arr[:3].transpose(1, 2, 0)
                            )
                        img.save(dir_z / f"{ytile}.png", "PNG", optimize=False)
        return True
    except Exception:
        return False


def _motor_pillow_sintetico(salida: Path, maxzoom: int,
                            bbox: tuple[float, float, float, float],
                            capa_id: str, fuente: str) -> bool:
    """Generador mínimo con Pillow: teselas de color sólido con etiqueta."""
    color = COLOR_POR_CAPA.get(capa_id, (128, 128, 128))
    try:
        fuente_ttf = None
        for candidata in ("arial.ttf", "DejaVuSans.ttf", "Arial.ttf"):
            try:
                fuente_ttf = ImageFont.truetype(candidata, 14)
                break
            except OSError:
                continue
        for z in range(0, maxzoom + 1):
            lon_min, lat_min, lon_max, lat_max = bbox
            x0, y0 = _lonlat_a_tile(lon_min, lat_max, z)
            x1, y1 = _lonlat_a_tile(lon_max, lat_min, z)
            for xtile in range(x0, x1 + 1):
                dir_z = salida / str(z) / str(xtile)
                dir_z.mkdir(parents=True, exist_ok=True)
                for ytile in range(y0, y1 + 1):
                    img = Image.new("RGB", (256, 256), color)
                    draw = ImageDraw.Draw(img)
                    etiqueta = f"{capa_id}\nplaceholder z={z}\n({fuente})"
                    # Borde blanco para distinguir teselas adyacentes
                    draw.rectangle([0, 0, 255, 255], outline=(255, 255, 255), width=1)
                    # Etiqueta centrada
                    if fuente_ttf:
                        bbox_txt = draw.multiline_textbbox(
                            (0, 0), etiqueta, font=fuente_ttf, spacing=2
                        )
                        tw = bbox_txt[2] - bbox_txt[0]
                        th = bbox_txt[3] - bbox_txt[1]
                        pos = ((256 - tw) // 2, (256 - th) // 2)
                        draw.multiline_text(
                            pos, etiqueta, fill=(255, 255, 255),
                            font=fuente_ttf, spacing=2, align="center",
                        )
                    img.save(dir_z / f"{ytile}.png", "PNG", optimize=False)
        return True
    except Exception as exc:  # pragma: no cover
        sys.stderr.write(f"Fallo motor Pillow: {exc}\n")
        return False


def _motor_pillow_desde_imagen(ruta_origen: Path, salida: Path,
                               maxzoom: int,
                               bbox: tuple[float, float, float, float]) -> bool:
    """Genera teselas muestreando una imagen origen (PNG/JPG/TIFF) con Pillow.

    Se asume que la imagen cubre el bbox completo; las teselas se muestrean
    proporcionalmente al nivel de zoom.
    """
    try:
        img = Image.open(ruta_origen).convert("RGB")
    except Exception:
        return False
    ancho, alto = img.size
    lon_min, lat_min, lon_max, lat_max = bbox
    for z in range(0, maxzoom + 1):
        x0, y0 = _lonlat_a_tile(lon_min, lat_max, z)
        x1, y1 = _lonlat_a_tile(lon_max, lat_min, z)
        n = 2 ** z
        for xtile in range(x0, x1 + 1):
            dir_z = salida / str(z) / str(xtile)
            dir_z.mkdir(parents=True, exist_ok=True)
            for ytile in range(y0, y1 + 1):
                tlon_min, tlat_min, tlon_max, tlat_max = _tile_bounds(
                    xtile, ytile, z
                )
                # Fracción dentro del bbox total
                fx0 = (tlon_min - lon_min) / (lon_max - lon_min)
                fx1 = (tlon_max - lon_min) / (lon_max - lon_min)
                # Ojo: Y de tile crece hacia el sur; imagen 0,0 arriba.
                fy0 = (lat_max - tlat_max) / (lat_max - lat_min)
                fy1 = (lat_max - tlat_min) / (lat_max - lat_min)
                caja = (
                    max(0, int(fx0 * ancho)),
                    max(0, int(fy0 * alto)),
                    min(ancho, int(fx1 * ancho)),
                    min(alto, int(fy1 * alto)),
                )
                if caja[2] - caja[0] < 1 or caja[3] - caja[1] < 1:
                    continue
                recorte = img.crop(caja).resize((256, 256), Image.NEAREST)
                dir_z.mkdir(parents=True, exist_ok=True)
                recorte.save(dir_z / f"{ytile}.png", "PNG", optimize=False)
    return True


# --- Manifiesto ---------------------------------------------------------------


def _hash_archivo(ruta: Path) -> str:
    h = hashlib.sha256()
    with open(ruta, "rb") as fh:
        for bloque in iter(lambda: fh.read(1 << 16), b""):
            h.update(bloque)
    return h.hexdigest()


def _hash_arbol(raiz: Path) -> str:
    """Hash agregado del árbol: concatena path relativo + sha256 ordenados."""
    h = hashlib.sha256()
    archivos = sorted(
        p for p in raiz.rglob("*") if p.is_file() and p.name != "metadata.json"
    )
    for p in archivos:
        h.update(str(p.relative_to(raiz)).encode("utf-8"))
        h.update(b"\0")
        h.update(_hash_archivo(p).encode("ascii"))
        h.update(b"\0")
    return h.hexdigest()


def _actualizar_manifiesto(raiz_datos: Path, capa_id: str,
                           dir_capa: Path) -> None:
    ruta_man = raiz_datos / "manifiesto.json"
    if ruta_man.exists():
        man = json.loads(ruta_man.read_text(encoding="utf-8"))
    else:
        man = {"version": 1, "entradas": []}
    # Eliminar entradas previas de la misma capa.
    man["entradas"] = [
        e for e in man.get("entradas", []) if e.get("id") != capa_id
    ]
    meta_path = dir_capa / "metadata.json"
    h_meta = _hash_archivo(meta_path) if meta_path.exists() else ""
    h_tree = _hash_arbol(dir_capa)
    man["entradas"].append({
        "id": capa_id,
        "tipo": "piramide_raster",
        "directorio": str(dir_capa.relative_to(raiz_datos)).replace("\\", "/"),
        "archivos": len(list(dir_capa.rglob("*.png"))),
        "metadata": "metadata.json",
        "metadata_sha256": h_meta,
        "arbol_sha256": h_tree,
        "fecha_generacion": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
    })
    man["fecha_ultima_actualizacion"] = time.strftime(
        "%Y-%m-%dT%H:%M:%SZ", time.gmtime()
    )
    ruta_man.write_text(
        json.dumps(man, indent=2, ensure_ascii=False), encoding="utf-8"
    )


# --- Metadata ----------------------------------------------------------------


def _escribir_metadata(salida: Path, capa_id: str, fuente: str,
                       licencia: str, fecha: str, resolucion_m: float,
                       maxzoom: int, bbox: dict, placeholder: bool,
                       ruta_origen: Path | None) -> None:
    niveles = list(range(0, maxzoom + 1))
    doc = {
        "id": capa_id,
        "fuente": fuente,
        "licencia": licencia,
        "fecha": fecha,
        "resolucion_m": resolucion_m,
        "maxzoom": maxzoom,
        "niveles": niveles,
        "recuadro": bbox,
        "tile_size": 256,
        "esquema": "xyz",
        "proyeccion": "mercator",
        "formato": "png",
        "placeholder": placeholder,
    }
    if ruta_origen is not None and ruta_origen.exists():
        doc["origen"] = str(ruta_origen.resolve())
    (salida / "metadata.json").write_text(
        json.dumps(doc, indent=2, ensure_ascii=False), encoding="utf-8"
    )


# --- Orquestador -------------------------------------------------------------


def piramidizar(ruta_origen: Path, capa_id: str, maxzoom: int | None = None,
                forzar_placeholder: bool = False) -> Path:
    """Genera la pirámide de teselas para una capa. Devuelve el directorio."""
    raiz = Path(__file__).resolve().parents[2]   # raíz del proyecto
    datos = raiz / "datos"
    json_meta = datos / "gee" / f"{capa_id}.json"
    dir_capa = datos / "gee" / capa_id

    if json_meta.exists():
        meta = json.loads(json_meta.read_text(encoding="utf-8"))
        fuente = meta.get("fuente", "desconocida")
        licencia = meta.get("licencia", "desconocida")
        fecha = meta.get("rango", meta.get("fecha", "desconocida"))
        resolucion_m = float(meta.get("resolucion_m", 0))
        bbox = meta.get("recuadro", RECORTE)
    else:
        fuente = "desconocida"
        licencia = "desconocida"
        fecha = "desconocida"
        resolucion_m = 0.0
        bbox = dict(RECORTE)

    if maxzoom is None:
        maxzoom = _resolver_maxzoom(capa_id, json_meta)
    maxzoom = int(maxzoom)

    if dir_capa.exists():
        shutil.rmtree(dir_capa)
    dir_capa.mkdir(parents=True, exist_ok=True)

    bbox_t = _bbox_desde_recorte(bbox)
    placeholder = forzar_placeholder or not ruta_origen.exists()

    # En modo placeholder, la pirámide se trunca para no generar millones
    # de teselas del mismo color por encima del zoom nativo de placeholder.
    maxzoom_generacion = maxzoom
    if placeholder:
        maxzoom_generacion = min(maxzoom, PLACEHOLDER_MAXZOOM_CAP)

    ok = False
    motor_usado = "ninguno"
    if not placeholder:
        ok = _motor_gdal2tiles(ruta_origen, dir_capa, maxzoom_generacion)
        if ok:
            motor_usado = "gdal2tiles"
        else:
            ok = _motor_rio_tiler(ruta_origen, dir_capa, maxzoom_generacion, bbox_t)
            if ok:
                motor_usado = "rasterio"
            else:
                ok = _motor_pillow_desde_imagen(
                    ruta_origen, dir_capa, maxzoom_generacion, bbox_t
                )
                if ok:
                    motor_usado = "pillow-desde-imagen"
    if not ok:
        ok = _motor_pillow_sintetico(
            dir_capa, maxzoom_generacion, bbox_t, capa_id, fuente
        )
        motor_usado = "pillow-sintetico"
        placeholder = True

    _escribir_metadata(
        dir_capa, capa_id=capa_id, fuente=fuente, licencia=licencia,
        fecha=fecha, resolucion_m=resolucion_m, maxzoom=maxzoom,
        bbox=bbox, placeholder=placeholder,
        ruta_origen=ruta_origen if ruta_origen.exists() else None,
    )
    _actualizar_manifiesto(datos, capa_id, dir_capa)
    print(f"  motor={motor_usado} maxzoom={maxzoom} placeholder={placeholder}")
    print(f"  teselas={len(list(dir_capa.rglob('*.png')))}")
    return dir_capa


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        description="Pirámide XYZ (256 px, mercator) por capa ráster.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=textwrap.dedent("""\
            Ejemplos:
              python datos/gee/piramidizar.py origen.tif --capa batimetria_sombreada
              python datos/gee/piramidizar.py --capa batimetria_sombreada --placeholder
            """),
    )
    parser.add_argument(
        "raster", nargs="?", default=None,
        help="Ruta al ráster de origen (GeoTIFF/PNG/JPG). Si falta y se pasa "
             "--capa, se genera un placeholder sintético.",
    )
    parser.add_argument(
        "--capa", required=True,
        help="Identificador de la capa (batimetria_sombreada, sentinel2_mediana, "
             "relieve_sombreado, viirs_nocturno).",
    )
    parser.add_argument(
        "--maxzoom", type=int, default=None,
        help="Nivel máximo de la pirámide. Si se omite, se toma del JSON.",
    )
    parser.add_argument(
        "--placeholder", action="store_true",
        help="Fuerza la generación de teselas placeholder (Pillow sintético).",
    )
    args = parser.parse_args(argv)

    ruta_origen = Path(args.raster) if args.raster else Path("nope.tif")
    dir_capa = piramidizar(
        ruta_origen=ruta_origen,
        capa_id=args.capa,
        maxzoom=args.maxzoom,
        forzar_placeholder=args.placeholder,
    )
    print(f"OK piramide {args.capa} -> {dir_capa}")
    return 0


if __name__ == "__main__":
    sys.exit(main())