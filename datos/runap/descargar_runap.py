"""Descarga las áreas marinas protegidas del RUNAP y comprueba emplazamientos.

Fuente: ArcGIS FeatureServer de Parques Nacionales Naturales de Colombia,
capa "Registro Unico Nacional AP". Un área se considera marina cuando su
campo `area_ha_maritima_geografica` es mayor que cero.

    python descargar_runap.py
"""

from urllib.parse import urlencode
from urllib.request import Request, urlopen
import json
import pathlib

CAPA = (
    "https://mapas.parquesnacionales.gov.co/arcgis/rest/services" "/pnn/runap/FeatureServer/0/query"
)
SOLO_MARINAS = "area_ha_maritima_geografica > 0"

# Emplazamientos del simulador. Longitud, latitud.
EMPLAZAMIENTOS = {
    "Isla Fuerte": (-76.180, 9.390),
    "Islas del Rosario": (-75.747, 10.195),
    "Bahía Málaga": (-77.349, 3.925),
    "San Andrés": (-81.701, 12.569),
    "Tumaco": (-78.912, 1.903),
}


def consultar(**parametros) -> dict:
    parametros.setdefault("f", "json")
    # El servidor devuelve 403 al User-Agent por defecto de urllib.
    peticion = Request(
        f"{CAPA}?{urlencode(parametros)}", headers={"User-Agent": "simulador-energia-marina/1.0"}
    )
    with urlopen(peticion) as respuesta:
        return json.loads(respuesta.read().decode("utf-8"))


def descargar_geojson(destino: str) -> int:
    datos = consultar(
        where=SOLO_MARINAS, outFields="*", returnGeometry="true", outSR=4326, f="geojson"
    )
    pathlib.Path(destino).write_text(json.dumps(datos), encoding="utf-8")
    return len(datos["features"])


def areas_en(lon: float, lat: float, radio_m: int = 5000) -> list[str]:
    """Áreas protegidas que tocan un círculo de radio_m alrededor del punto."""
    datos = consultar(
        geometry=json.dumps({"x": lon, "y": lat, "spatialReference": {"wkid": 4326}}),
        geometryType="esriGeometryPoint",
        spatialRel="esriSpatialRelIntersects",
        distance=radio_m,
        units="esriSRUnit_Meter",
        inSR=4326,
        outFields="ap_nombre,ap_categoria",
        returnGeometry="false",
    )
    return [
        f"{f['attributes']['ap_nombre']} ({f['attributes']['ap_categoria']})"
        for f in datos.get("features", [])
    ]


if __name__ == "__main__":
    print(
        f"areas_marinas_protegidas.geojson: "
        f"{descargar_geojson('areas_marinas_protegidas.geojson')} áreas"
    )
    for nombre, (lon, lat) in EMPLAZAMIENTOS.items():
        encontradas = areas_en(lon, lat)
        print(f"\n{nombre}:")
        for a in encontradas or ["  libre de área protegida en 5 km"]:
            print(f"  {a}" if encontradas else a)

    # Comprobación: Rosario está dentro de un Parque Nacional Natural y
    # Isla Fuerte no tiene ninguna área protegida a 5 km. Si esto falla,
    # la capa o el criterio de filtro cambiaron.
    assert any("Corales del Rosario" in a for a in areas_en(-75.747, 10.195))
    assert areas_en(-76.180, 9.390) == []
    print("\ncomprobación ok")
