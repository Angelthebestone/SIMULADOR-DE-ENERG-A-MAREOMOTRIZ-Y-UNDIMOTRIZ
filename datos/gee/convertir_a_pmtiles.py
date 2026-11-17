"""Empaqueta las piramides XYZ de datos/gee/ en archivos PMTiles v3 raster.

Lee los PNG existentes de cada capa (NO los borra ni modifica) y escribe
``datos/gee/<capa>.pmtiles`` junto a ellos: un archivo por capa con
TileType PNG (2), compresion None (1) y directorio unico raiz ordenado por
TileID de Hilbert (``zxyToTileId`` de ``pmtiles@3.2.0``).

Solo usa stdlib + Pillow (para verificar la firma PNG; el empaquetado es
bytes en bruto, sin recomprimir ni cargar todo en RAM: se lee por lotes y
solo se retienen los blobs unicos).

Formato minimo valido que el decoder JS ``pmtiles@3.2.0`` acepta
(verificado contra ``web/node_modules/pmtiles/dist/index.js``):

* Cabecera de 127 bytes: magico ``PMTiles`` (7 bytes) + version 3 (uint8
  en offset 7) + offsets/longitudes uint64 LE + flags + TileType/minZoom/
  maxZoom/bounds/center. ``getUint16(0) == 19792`` ("PM") y
  ``getUint16(2) not in (1, 2)`` seleccionan la ruta v3.
* Directorio serializado como varints LEB128: numEntries, deltas de
  tileId, runLengths, lengths, offsets (0 = contiguo al anterior,
  si no valor+1). Deserializado por ``deserializeIndex``.
* Sin directorios hoja (todas las entradas tienen runLength >= 1, asi que
  ``leafDirectoryOffset/Length`` nunca se consultan). Sin compresion
  interna ni de tesela (``defaultDecompress`` devuelve el buffer tal cual).
* ``tileDataOffset + entry.offset`` apunta al blob PNG original; teselas
  ausentes devuelven ``undefined`` -> el protocolo responde ``data: null``.

Deduplicacion por hash: los placeholders son de color solido repetido por
zoom (misma etiqueta dentro del mismo z), asi que hay ~1 blob unico por
nivel y cada ``.pmtiles`` es << suma de PNGs. Las entradas comparten
offset/length (runLength 1 por entrada; no se usan runs multi-tesela
porque los duplicados no son consecutivos en orden Hilbert).

Cobertura: se empaquetan TODAS las teselas presentes en disco
(z0..9 salvo viirs z0..8, cap de placeholder de ``piramidizar.py``).
La cabecera anuncia el maxzoom del spec (11/14/12/8, igual que
``capas.ts``/``metadata.json``); los zooms sin teselas en disco tampoco
existen en XYZ (404), y en PMTiles resuelven a null. No se inventa ningun
dato: solo se reempaquetan los PNG existentes.

Uso:
    python datos/gee/convertir_a_pmtiles.py [capa ...]
    python datos/gee/convertir_a_pmtiles.py   # las 4 capas
"""

from __future__ import annotations

import hashlib
import json
import struct
import sys
from pathlib import Path

RAIZ = Path(__file__).resolve().parents[2]
GEE = RAIZ / "datos" / "gee"

CAPAS = (
    "batimetria_sombreada",
    "sentinel2_mediana",
    "relieve_sombreado",
    "viirs_nocturno",
)

# Maxzoom del spec (11/14/12/8): coincide con capas.ts, metadata.json y
# lo que exige pruebas/test_mapa.py (maxzoom: 11/14/12/8).
MAXZOOM_SPEC = {
    "batimetria_sombreada": 11,
    "sentinel2_mediana": 14,
    "relieve_sombreado": 12,
    "viirs_nocturno": 8,
}

RECORTE_DEF = {"lon_min": -82.6, "lon_max": -70.8, "lat_min": 0.8, "lat_max": 15.2}

# Tabla tzValues de pmtiles@3.2.0 (idOnLevel/zxyToTileId, dist/index.js).
TZ_VALUES = [
    0, 1, 5, 21, 85, 341, 1365, 5461, 21845, 87381, 349525, 1398101,
    5592405, 22369621, 89478485, 357913941, 1431655765, 5726623061,
    22906492245, 91625968981, 366503875925, 1466015503701, 5864062014805,
    23456248059221, 93824992236885, 375299968947541, 1501199875790165,
]

PNG_MAGIC = b"\x89PNG\r\n\x1a\n"


def _rotate(n: int, xy: list, rx: int, ry: int) -> None:
    if ry == 0:
        if rx == 1:
            xy[0] = n - 1 - xy[0]
            xy[1] = n - 1 - xy[1]
        xy[0], xy[1] = xy[1], xy[0]


def zxy_to_tile_id(z: int, x: int, y: int) -> int:
    """Puerto fiel de zxyToTileId de pmtiles@3.2.0 (dist/index.js)."""
    n = 2 ** z
    rx = ry = 0
    d = 0
    xy = [x, y]
    s = n // 2
    while s > 0:
        rx = 1 if (xy[0] & s) > 0 else 0
        ry = 1 if (xy[1] & s) > 0 else 0
        d += s * s * ((3 * rx) ^ ry)
        _rotate(s, xy, rx, ry)
        s //= 2
    return TZ_VALUES[z] + d


def _varint_encode(valor: int) -> bytes:
    if valor < 0:
        raise ValueError("varint negativo")
    salida = bytearray()
    while valor >= 0x80:
        salida.append((valor & 0x7F) | 0x80)
        valor >>= 7
    salida.append(valor & 0x7F)
    return bytes(salida)


def _serializar_directorio(entradas: list) -> bytes:
    """entradas: [(tileId, offset, length)] ordenadas por tileId, runLength 1."""
    buf = bytearray()
    buf += _varint_encode(len(entradas))
    ultimo = 0
    for tid, _, _ in entradas:
        buf += _varint_encode(tid - ultimo)
        ultimo = tid
    for _ in entradas:
        buf += _varint_encode(1)  # runLength
    for _, _, ln in entradas:
        buf += _varint_encode(ln)
    previo_fin = 0
    primero = True
    for _, off, ln in entradas:
        if not primero and off == previo_fin:
            buf += _varint_encode(0)
        else:
            buf += _varint_encode(off + 1)
        previo_fin = off + ln
        primero = False
    return bytes(buf)


def _limites(capa: str) -> dict:
    meta_dir = GEE / capa / "metadata.json"
    if meta_dir.exists():
        rec = json.loads(meta_dir.read_text(encoding="utf-8")).get("recuadro")
        if rec:
            return rec
    meta_js = GEE / f"{capa}.json"
    if meta_js.exists():
        rec = json.loads(meta_js.read_text(encoding="utf-8")).get("recorte")
        if rec:
            return rec
    return dict(RECORTE_DEF)


def convertir_capa(capa: str) -> Path:
    dir_capa = GEE / capa
    pngs = sorted(dir_capa.rglob("*.png"))
    if not pngs:
        raise FileNotFoundError(f"sin teselas en {dir_capa}")
    blobs: dict[str, tuple[bytes, int]] = {}  # sha256 -> (bytes, offset)
    datos = bytearray()
    entradas: list = []
    pendientes: list = []  # (tileId, sha)
    for p in pngs:
        try:
            z = int(p.parent.parent.name)
            x = int(p.parent.name)
            y = int(p.stem)
        except ValueError:
            continue  # ignora archivos fuera del esquema z/x/y.png
        with open(p, "rb") as fh:
            raw = fh.read()
        if raw[:8] != PNG_MAGIC:
            raise ValueError(f"{p} no es PNG")
        sha = hashlib.sha256(raw).hexdigest()
        if sha not in blobs:
            blobs[sha] = (raw, -1)  # offset se asigna al concatenar
        pendientes.append((zxy_to_tile_id(z, x, y), sha, len(raw)))
    # Concatena blobs unicos (lotes: solo un blob por zoom en la practica).
    for sha, (raw, _) in blobs.items():
        blobs[sha] = (raw, len(datos))
        datos += raw
    for tid, sha, ln in pendientes:
        _, off = blobs[sha]
        entradas.append((tid, off, ln))
    entradas.sort(key=lambda e: e[0])

    dir_bytes = _serializar_directorio(entradas)
    rec = _limites(capa)
    meta_doc = {
        "name": capa,
        "description": f"proxy PMTiles v3 de piramide XYZ ./datos/gee/{capa}/{{z}}/{{x}}/{{y}}.png",
        "attribution": capa,
        "minzoom": 0,
        "maxzoom": MAXZOOM_SPEC[capa],
        "bounds": f"{rec['lon_min']},{rec['lat_min']},{rec['lon_max']},{rec['lat_max']}",
        "center": f"{(rec['lon_min'] + rec['lon_max']) / 2},"
                  f"{(rec['lat_min'] + rec['lat_max']) / 2},4",
        "format": "png",
        "placeholder": True,
    }
    json_bytes = json.dumps(meta_doc, ensure_ascii=False).encode("utf-8")

    root_off = 127
    json_off = root_off + len(dir_bytes)
    tile_off = json_off + len(json_bytes)
    maxzoom = MAXZOOM_SPEC[capa]
    cab = bytearray(127)
    cab[0:7] = b"PMTiles"
    cab[7] = 3  # specVersion
    struct.pack_into("<Q", cab, 8, root_off)
    struct.pack_into("<Q", cab, 16, len(dir_bytes))
    struct.pack_into("<Q", cab, 24, json_off)
    struct.pack_into("<Q", cab, 32, len(json_bytes))
    struct.pack_into("<Q", cab, 40, tile_off)  # sin hojas: apunta a tileData
    struct.pack_into("<Q", cab, 48, 0)
    struct.pack_into("<Q", cab, 56, tile_off)
    struct.pack_into("<Q", cab, 64, len(datos))
    struct.pack_into("<Q", cab, 72, len(entradas))  # numAddressedTiles
    struct.pack_into("<Q", cab, 80, len(entradas))  # numTileEntries
    struct.pack_into("<Q", cab, 88, len(blobs))  # numTileContents (unicos)
    cab[96] = 0  # clustered=false (offsets compartidos por dedup)
    cab[97] = 1  # internalCompression None
    cab[98] = 1  # tileCompression None
    cab[99] = 2  # TileType PNG
    cab[100] = 0
    cab[101] = maxzoom
    struct.pack_into("<i", cab, 102, int(round(rec["lon_min"] * 1e7)))
    struct.pack_into("<i", cab, 106, int(round(rec["lat_min"] * 1e7)))
    struct.pack_into("<i", cab, 110, int(round(rec["lon_max"] * 1e7)))
    struct.pack_into("<i", cab, 114, int(round(rec["lat_max"] * 1e7)))
    cab[118] = 4
    struct.pack_into(
        "<i", cab, 119, int(round((rec["lon_min"] + rec["lon_max"]) / 2 * 1e7))
    )
    struct.pack_into(
        "<i", cab, 123, int(round((rec["lat_min"] + rec["lat_max"]) / 2 * 1e7))
    )

    destino = GEE / f"{capa}.pmtiles"
    with open(destino, "wb") as fh:
        fh.write(bytes(cab))
        fh.write(dir_bytes)
        fh.write(json_bytes)
        fh.write(bytes(datos))

    # Autoverificacion: cabecera + primera/ultima entrada resuelven a PNG.
    with open(destino, "rb") as fh:
        head = fh.read(127)
    assert head[0:7] == b"PMTiles" and head[7] == 3
    assert struct.unpack_from("<Q", head, 8)[0] == root_off
    for tid, off, ln in (entradas[0], entradas[-1]):
        with open(destino, "rb") as fh:
            fh.seek(tile_off + off)
            assert fh.read(8) == PNG_MAGIC, f"tesela {tid} corrupta"
    total_png = sum(p.stat().st_size for p in pngs)
    print(
        f"{capa}: {len(pngs)} PNG ({total_png} B) -> "
        f"{destino.name} ({destino.stat().st_size} B, "
        f"{len(blobs)} unicos, {len(entradas)} entradas)"
    )
    return destino


def main(argv: list[str] | None = None) -> int:
    capas = [a for a in (argv or []) if not a.startswith("-")] or list(CAPAS)
    for capa in capas:
        if capa not in CAPAS:
            print(f"capa desconocida: {capa}", file=sys.stderr)
            return 2
        convertir_capa(capa)
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
