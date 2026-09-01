"""Descarga el contorno de tierra firme mundial para el mapa del simulador.

Fuente: Natural Earth, dominio publico (sin restriccion de uso), servido como
GeoJSON desde el repositorio oficial nvkelso/natural-earth-vector.

El mapa es mundial: se puede pulsar cualquier punto del oceano para simular, asi
que el contorno tiene que cubrir todos los continentes, no solo el encuadre
colombiano. Se combinan dos escalas:

  - 1:50m tierra firme (`ne_50m_land`): continentes e islas mayores del mundo.
    A esta escala Natural Earth descarta las islas pequenas.
  - 1:10m paises (`ne_10m_admin_0_countries`): de aqui se toman solo los anillos
    pequenos que caen en el encuadre del Caribe/Pacifico colombiano, que son
    justo las islas que usa el simulador (San Andres, Providencia, Rosario) y
    que el 1:50m no dibuja.

    python descargar_costa.py
"""

import json
import pathlib
from urllib.request import Request, urlopen

BASE = "https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/"
FUENTE_MUNDO = "ne_50m_land.geojson"
FUENTE_ISLAS = "ne_10m_admin_0_countries.geojson"
LADO_MAXIMO_ISLA = 2.0  # grados: por encima de esto el anillo es continente, no isla
ATRIBUCION = (
    "Natural Earth, dominio publico — naturalearthdata.com; "
    "mundo 1:50m (land), islas menores del Caribe/Pacifico colombiano 1:10m"
)

# Encuadre de detalle: solo aqui se anaden islas pequenas de 1:10m, porque son
# los emplazamientos del simulador. El resto del mundo va a 1:50m.
DETALLE = (-84.0, -68.0, -1.0, 17.0)  # lon_min, lon_max, lat_min, lat_max

DESTINO = "contorno_tierra.geojson"


def _descargar(nombre: str) -> dict:
    peticion = Request(BASE + nombre, headers={"User-Agent": "simulador-energia-marina/1.0"})
    with urlopen(peticion) as respuesta:
        return json.loads(respuesta.read().decode("utf-8"))


def _anillos(geometria: dict) -> list[list[list[float]]]:
    if geometria["type"] == "Polygon":
        return [geometria["coordinates"][0]]
    return [poligono[0] for poligono in geometria["coordinates"]]


def _en_detalle(anillo: list[list[float]]) -> bool:
    lon_min, lon_max, lat_min, lat_max = DETALLE
    return any(lon_min <= p[0] <= lon_max and lat_min <= p[1] <= lat_max for p in anillo)


def _es_isla(anillo: list[list[float]]) -> bool:
    lons = [p[0] for p in anillo]
    lats = [p[1] for p in anillo]
    return (max(lons) - min(lons)) < LADO_MAXIMO_ISLA and (
        max(lats) - min(lats)
    ) < LADO_MAXIMO_ISLA


def componer(mundo: dict, islas: dict) -> dict:
    """Mundo entero a 1:50m + islas menores a 1:10m dentro del encuadre de detalle."""
    rasgos: list[dict] = []

    anillos_mundo = [a for rasgo in mundo["features"] for a in _anillos(rasgo["geometry"])]
    rasgos.append(
        {
            "type": "Feature",
            "properties": {"nombre": "tierra firme mundial", "escala": "1:50m"},
            "geometry": {"type": "MultiPolygon", "coordinates": [[a] for a in anillos_mundo]},
        }
    )

    for rasgo in islas["features"]:
        propiedades = rasgo.get("properties", {})
        anillos = [
            a for a in _anillos(rasgo["geometry"]) if _en_detalle(a) and _es_isla(a)
        ]
        if not anillos:
            continue
        nombre = propiedades.get("NAME_ES") or propiedades.get("NAME") or "sin nombre"
        rasgos.append(
            {
                "type": "Feature",
                "properties": {
                    "nombre": nombre,
                    "iso": propiedades.get("ISO_A3", ""),
                    "escala": "1:10m",
                },
                "geometry": {"type": "MultiPolygon", "coordinates": [[a] for a in anillos]},
            }
        )

    return {
        "type": "FeatureCollection",
        "crs": {"type": "name", "properties": {"name": "EPSG:4326"}},
        "fuente": ATRIBUCION,
        "cobertura": "mundial",
        "detalle": {"lon": DETALLE[:2], "lat": DETALLE[2:]},
        "features": rasgos,
    }


if __name__ == "__main__":
    compuesto = componer(_descargar(FUENTE_MUNDO), _descargar(FUENTE_ISLAS))
    destino = pathlib.Path(__file__).parent / DESTINO
    destino.write_text(json.dumps(compuesto), encoding="utf-8")
    vertices = sum(
        len(anillo[0]) for r in compuesto["features"] for anillo in r["geometry"]["coordinates"]
    )
    print(
        f"{DESTINO}: {len(compuesto['features'])} rasgos, {vertices} vertices, "
        f"{destino.stat().st_size / 1e6:.2f} MB"
    )

    # Comprobaciones: el mapa es mundial, asi que tiene que haber tierra en los
    # cuatro cuadrantes; y San Andres es uno de los emplazamientos, asi que su
    # isla tiene que seguir dibujada pese a que 1:50m la descarta.
    puntos = [
        p
        for r in compuesto["features"]
        for anillo in r["geometry"]["coordinates"]
        for p in anillo[0]
    ]
    for etiqueta, prueba in (
        ("Europa", lambda x, y: 0 < x < 30 and 40 < y < 60),
        ("Asia", lambda x, y: 100 < x < 140 and 20 < y < 50),
        ("Oceania", lambda x, y: 140 < x < 155 and -40 < y < -20),
        ("Africa austral", lambda x, y: 15 < x < 30 and -35 < y < -25),
    ):
        assert any(prueba(x, y) for x, y in puntos), f"el contorno no llega a {etiqueta}"
    assert any(-81.8 < x < -81.6 and 12.4 < y < 12.7 for x, y in puntos), "falta San Andres"
    print("comprobacion ok")
