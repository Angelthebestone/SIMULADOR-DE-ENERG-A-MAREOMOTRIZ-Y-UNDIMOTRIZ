"""Rango mareal Esri (derivado de FES2014) para los cinco emplazamientos.

Servicio: Global_Tidal_Range_meters2 (ImageServer TilesOnly, teselas LERC2D).
El portal item d5354dea41b14f0689860bf4b2cf5e8a confirma:
rango = 2*(M2+S2+K1+O1) sobre FES2014 con datos AVISO.

El servicio es TilesOnly (capabilities Image,TilesOnly): las operaciones
`identify` y `exportImage` devuelven HTTP 400, por lo que se lee por teselas:
se calcula la tesela XYZ WebMercator de cada sitio, se descarga
`/tile/{z}/{y}/{x}` y se decodifica el blob LERC2 para muestrear el pixel.

Dependencia de ingesta (NO es runtime del simulador):

    pip install lerc

Sin `lerc` el script aborta con mensaje claro (ver _decodificar_lerc);
el simulador NUNCA depende del servicio ni de `lerc` en runtime:
solo consume los valores cacheados en `rango_mareal_esri.json`.
"""

from __future__ import annotations

import datetime
import json
import math
import pathlib
import urllib.request

EMPLAZAMIENTOS = {
    "isla_fuerte": ("Isla Fuerte", 9.390, -76.180),
    "san_andres": ("San Andrés", 12.569, -81.701),
    "tumaco": ("Tumaco", 1.903, -78.912),
    "islas_rosario": ("Islas del Rosario", 10.235, -75.741),
    "bahia_malaga": ("Bahía Málaga", 3.925, -77.349),
}

SERVICIO = (
    "https://tiledimageservices.arcgis.com/bDAhvQYMG4WL8O5o"
    "/arcgis/rest/services/Global_Tidal_Range_meters2/ImageServer"
)
METODO = "2*(M2+S2+K1+O1) sobre FES2014 vía teselas LERC"
ATRIBUCION = (
    "FES2014 was produced by Noveltis, Legos and CLS "
    "and distributed by Aviso+, with support from Cnes"
)
NOTA_RUNTIME = (
    "El simulador NUNCA depende del servicio en runtime: "
    "solo consume los valores cacheados en rango_mareal_esri.json. "
    "Este script es ingesta puntual, no codigo del simulador."
)

Z = 4  # nivel maximo publicado por el servicio (lods 0-4)
ORIGEN_X = -20037507.067179184
ORIGEN_Y = 30240971.95838655
RESOLUCION_Z4 = 12087.135109783749  # metros/pixel en z=4
TAM_TESELA = 256
RADIO_TIERRA = 6378137.0


def _a_webmercator(lat: float, lon: float) -> tuple[float, float]:
    mx = math.radians(lon) * RADIO_TIERRA
    my = RADIO_TIERRA * math.log(math.tan(math.pi / 4 + math.radians(lat) / 2))
    return mx, my


def tesela_y_pixel(lat: float, lon: float) -> tuple[int, int, int, int]:
    """Devuelve (col, fila, px, py) de la tesela z=4 para lat/lon."""
    mx, my = _a_webmercator(lat, lon)
    col_f = (mx - ORIGEN_X) / (RESOLUCION_Z4 * TAM_TESELA)
    fila_f = (ORIGEN_Y - my) / (RESOLUCION_Z4 * TAM_TESELA)
    col, fila = int(col_f), int(fila_f)
    px = min(int((col_f - col) * TAM_TESELA), TAM_TESELA - 1)
    py = min(int((fila_f - fila) * TAM_TESELA), TAM_TESELA - 1)
    return col, fila, px, py


def _descargar_tesela(col: int, fila: int) -> bytes:
    url = f"{SERVICIO}/tile/{Z}/{fila}/{col}"
    req = urllib.request.Request(url, headers={"User-Agent": "simulador-energia-ingesta"})
    with urllib.request.urlopen(req, timeout=60) as resp:
        return resp.read()


def _decodificar_lerc(blob: bytes):
    """Decodifica un blob LERC2 a matriz 2D. `lerc` solo vive aqui (ingesta)."""
    try:
        import lerc  # type: ignore
    except ImportError as e:
        raise SystemExit(
            "Falta el paquete 'lerc' (solo dependencia de ingesta, "
            "nunca runtime del simulador): pip install lerc"
        ) from e
    _codigo, matriz, _mascara = lerc.decode(blob)
    return matriz


def obtener_rangos() -> tuple[dict[str, float], dict[str, str]]:
    """Descarga las teselas necesarias y muestrea el rango (m) por sitio.

    Devuelve (rangos, estados): estados es "verificado" si la tesela se
    descargo y decodifico, "pendiente" si la red fallo (rango 0.0, nunca null).
    """
    rangos: dict[str, float] = {}
    estados: dict[str, str] = {}
    por_tesela: dict[tuple[int, int], list[str]] = {}
    pixeles: dict[str, tuple[int, int]] = {}
    for clave, (_nombre, lat, lon) in EMPLAZAMIENTOS.items():
        col, fila, px, py = tesela_y_pixel(lat, lon)
        por_tesela.setdefault((col, fila), []).append(clave)
        pixeles[clave] = (px, py)
    for (col, fila), claves in por_tesela.items():
        try:
            matriz = _decodificar_lerc(_descargar_tesela(col, fila))
            ok = True
        except Exception:
            ok = False
            matriz = None
        for clave in claves:
            if ok and matriz is not None:
                px, py = pixeles[clave]
                try:
                    rangos[clave] = round(float(matriz[py][px]), 3)
                    estados[clave] = "verificado"
                except (IndexError, TypeError, ValueError):
                    rangos[clave] = 0.0
                    estados[clave] = "pendiente"
            else:
                rangos[clave] = 0.0
                estados[clave] = "pendiente"
    return rangos, estados


if __name__ == "__main__":
    carpeta = pathlib.Path(__file__).parent
    rangos, estados = obtener_rangos()
    fecha = datetime.datetime.now(datetime.timezone.utc).isoformat()
    global_ok = all(e == "verificado" for e in estados.values())
    doc: dict = {}
    for clave, (nombre, lat, lon) in EMPLAZAMIENTOS.items():
        col, fila, px, py = tesela_y_pixel(lat, lon)
        doc[clave] = {
            "nombre": nombre,
            "lat": lat,
            "lon": lon,
            "rango_m": rangos[clave],
            "estado": estados[clave],
            "tesela_z": Z,
            "tesela_col": col,
            "tesela_fila": fila,
            "pixel_x": px,
            "pixel_y": py,
        }
        print(f"{clave}: rango~{rangos[clave]} m ({estados[clave]})")
    doc["_fecha_consulta"] = fecha
    doc["_servicio"] = SERVICIO
    doc["_metodo"] = METODO
    doc["_atribucion"] = ATRIBUCION
    doc["_nota_runtime"] = NOTA_RUNTIME
    doc["_estado"] = "verificado" if global_ok else "pendiente"
    destino = carpeta / "rango_mareal_esri.json"
    destino.write_text(json.dumps(doc, indent=2, ensure_ascii=False), encoding="utf-8")
    print(f"{destino.name} actualizado (estado={doc['_estado']})")
