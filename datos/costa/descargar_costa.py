"""Descarga el contorno de tierra firme para el mapa y lo recorta al Caribe/Pacifico colombiano.

Fuente: Natural Earth 1:50m Admin 0 Countries, dominio publico (sin restriccion
de uso), servido como GeoJSON desde el repositorio oficial nvkelso/natural-earth-vector.
Se descarga el mundo entero (~4 MB) y se guarda solo lo que cae dentro del
encuadre del mapa, para que datos/ no cargue con lo que no se dibuja.

    python descargar_costa.py
"""

import json
import pathlib
from urllib.request import Request, urlopen

BASE = "https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/"
# Tierra firme a 1:50m: suficiente para el encuadre y ligero de repintar. A esa
# escala Natural Earth descarta las islas pequenas, y son justo las que usa el
# simulador (San Andres, Providencia, Rosario), asi que de 1:10m se toman solo
# los anillos pequenos, que son las islas; el continente ya lo pone el de 1:50m.
FUENTE_TIERRA = "ne_50m_admin_0_countries.geojson"
FUENTE_ISLAS = "ne_10m_admin_0_countries.geojson"
LADO_MAXIMO_ISLA = 2.0  # grados: por encima de esto el anillo es continente, no isla
ATRIBUCION = (
    "Natural Earth Admin 0 Countries, dominio publico — naturalearthdata.com; "
    "continente 1:50m, islas menores 1:10m"
)

# Mismo encuadre que interfaz/mapa.py, con un margen para que los poligonos
# cortados no dejen el borde a medias.
RECORTE = (-84.0, -68.0, -1.0, 17.0)  # lon_min, lon_max, lat_min, lat_max

DESTINO = "contorno_tierra.geojson"


def _descargar(nombre: str) -> dict:
    peticion = Request(BASE + nombre, headers={"User-Agent": "simulador-energia-marina/1.0"})
    with urlopen(peticion) as respuesta:
        return json.loads(respuesta.read().decode("utf-8"))


def _anillos(geometria: dict) -> list[list[list[float]]]:
    if geometria["type"] == "Polygon":
        return [geometria["coordinates"][0]]
    return [poligono[0] for poligono in geometria["coordinates"]]


def _dentro(anillo: list[list[float]]) -> bool:
    lon_min, lon_max, lat_min, lat_max = RECORTE
    return any(lon_min <= p[0] <= lon_max and lat_min <= p[1] <= lat_max for p in anillo)


def _es_isla(anillo: list[list[float]]) -> bool:
    lons = [p[0] for p in anillo]
    lats = [p[1] for p in anillo]
    return (max(lons) - min(lons)) < LADO_MAXIMO_ISLA and (
        max(lats) - min(lats)
    ) < LADO_MAXIMO_ISLA


def recortar(tierra: dict, islas: dict) -> dict:
    """Anillos exteriores dentro del encuadre; de 1:10m solo los pequenos."""
    rasgos = []
    for mundo, solo_islas in ((tierra, False), (islas, True)):
        for rasgo in mundo["features"]:
            propiedades = rasgo.get("properties", {})
            anillos = [a for a in _anillos(rasgo["geometry"]) if _dentro(a)]
            if solo_islas:
                anillos = [a for a in anillos if _es_isla(a)]
            if not anillos:
                continue
            nombre = propiedades.get("NAME_ES") or propiedades.get("NAME") or "sin nombre"
            rasgos.append(
                {
                    "type": "Feature",
                    "properties": {"nombre": nombre, "iso": propiedades.get("ISO_A3", "")},
                    "geometry": {"type": "MultiPolygon", "coordinates": [[a] for a in anillos]},
                }
            )
    return {
        "type": "FeatureCollection",
        "crs": {"type": "name", "properties": {"name": "EPSG:4326"}},
        "fuente": ATRIBUCION,
        "recorte": {"lon": RECORTE[:2], "lat": RECORTE[2:]},
        "features": rasgos,
    }


if __name__ == "__main__":
    recortado = recortar(_descargar(FUENTE_TIERRA), _descargar(FUENTE_ISLAS))
    destino = pathlib.Path(__file__).parent / DESTINO
    destino.write_text(json.dumps(recortado), encoding="utf-8")
    nombres = {r["properties"]["nombre"] for r in recortado["features"]}
    vertices = sum(
        len(anillo[0]) for r in recortado["features"] for anillo in r["geometry"]["coordinates"]
    )
    print(
        f"{DESTINO}: {len(recortado['features'])} rasgos, {vertices} vertices, "
        f"{destino.stat().st_size / 1e6:.2f} MB"
    )

    # Comprobacion: sin Colombia el mapa no tiene sentido, el recorte debe haber
    # dejado fuera lo que no se dibuja, y San Andres es uno de los cinco
    # emplazamientos, asi que su isla tiene que estar dibujada.
    assert any(r["properties"]["iso"] == "COL" for r in recortado["features"]), "falta Colombia"
    assert not any("Argentina" in n for n in nombres), "el recorte no filtro nada"
    puntos = [
        p
        for r in recortado["features"]
        for anillo in r["geometry"]["coordinates"]
        for p in anillo[0]
    ]
    assert any(-81.8 < x < -81.6 and 12.4 < y < 12.7 for x, y in puntos), "falta San Andres"
    print("comprobacion ok")
