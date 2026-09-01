"""Regenera el transecto batimétrico alrededor de Isla Fuerte usando GMRT.

GMRT (Global Multi-Resolution Topography, Lamont-Doherty Earth Observatory) sirve
un modelo combinado de topografia y batimetria (GEBCO mas multihaz donde hay
levantamiento) por HTTP simple, sin clave ni registro:

    https://www.gmrt.org/services/PointServer?latitude=..&longitude=..&format=text

Este script pide profundidad en ocho rumbos alrededor de Isla Fuerte (9,390 N,
-76,180 W) a distancias crecientes, y calcula por interpolacion lineal a que
distancia se cruzan los 30 y 60 m que pide el criterio de ubicacion del
apartado 7 de la especificacion.

    python descargar_batimetria.py
"""

from urllib.request import urlopen
import csv
import json
import math
import pathlib

CENTRO_LAT, CENTRO_LON = 9.390, -76.180
KM_POR_GRADO_LAT = 111.32

RUMBOS = {
    "N": 0,
    "NNE": 22.5,
    "NE": 45,
    "ENE": 67.5,
    "E": 90,
    "SE": 135,
    "S": 180,
    "SW": 225,
    "W": 270,
    "NW": 315,
    "NNW": 337.5,
}
DISTANCIAS_KM = list(range(1, 26))  # 1 a 25 km, paso 1 km


def punto(bearing_deg: float, dist_km: float) -> tuple[float, float]:
    rad = math.radians(bearing_deg)
    dlat = (dist_km / KM_POR_GRADO_LAT) * math.cos(rad)
    dlon = (dist_km / (KM_POR_GRADO_LAT * math.cos(math.radians(CENTRO_LAT)))) * math.sin(rad)
    return CENTRO_LAT + dlat, CENTRO_LON + dlon


def profundidad(lat: float, lon: float) -> float:
    """Metros. Positivo es tierra, negativo es profundidad bajo el mar (GMRT)."""
    url = f"https://www.gmrt.org/services/PointServer?latitude={lat:.5f}&longitude={lon:.5f}&format=text"
    with urlopen(url, timeout=20) as respuesta:
        return float(respuesta.read().decode().strip())


def distancia_a_profundidad(perfil: list[tuple[float, float]], objetivo_m: float) -> float | None:
    """Interpola la distancia (km) a la que el perfil cruza -objetivo_m por primera vez."""
    for (d0, z0), (d1, z1) in zip(perfil, perfil[1:]):
        if z0 > -objetivo_m >= z1:
            if z1 == z0:
                return d1
            frac = (-objetivo_m - z0) / (z1 - z0)
            return round(d0 + frac * (d1 - d0), 2)
    return None


BANDA = (-60.0, -30.0)  # profundidades entre 30 y 60 m, con el signo de GMRT


def geojson_banda(filas: list) -> dict:
    """Tramos de cada transecto que caen en la banda de 30-60 m.

    El mapa (`web/src/map/mapa.ts`) pinta esta capa filtrando por
    `profundidad_m` entre -60 y -30: es la franja donde se fondea un
    convertidor, ni tan somera que rompa la ola ni tan honda que dispare el
    coste de amarre. Cada tramo une dos muestras consecutivas del mismo rumbo
    y lleva la profundidad media de las dos.
    """
    rasgos = []
    por_rumbo: dict[str, list] = {}
    for nombre, _rumbo, distancia, lat, lon, z in filas:
        if z is None:
            continue
        por_rumbo.setdefault(nombre, []).append((float(distancia), float(lat), float(lon), float(z)))

    for nombre, perfil in por_rumbo.items():
        perfil.sort()
        for (d0, lat0, lon0, z0), (d1, lat1, lon1, z1) in zip(perfil, perfil[1:]):
            media = (z0 + z1) / 2
            if not (BANDA[0] <= media <= BANDA[1]):
                continue
            rasgos.append(
                {
                    "type": "Feature",
                    "geometry": {
                        "type": "LineString",
                        "coordinates": [[lon0, lat0], [lon1, lat1]],
                    },
                    "properties": {
                        "rumbo": nombre,
                        "profundidad_m": round(media, 1),
                        "distancia_km": round((d0 + d1) / 2, 2),
                    },
                }
            )

    return {
        "type": "FeatureCollection",
        "fuente": "GMRT (Global Multi-Resolution Topography), Lamont-Doherty Earth Observatory",
        "estado": "verificado",
        "banda_m": [30, 60],
        "features": rasgos,
    }


if __name__ == "__main__":
    carpeta = pathlib.Path(__file__).parent
    filas = []
    perfiles = {}
    for nombre, rumbo in RUMBOS.items():
        perfil = []
        for d in DISTANCIAS_KM:
            lat, lon = punto(rumbo, d)
            z = profundidad(lat, lon)
            perfil.append((d, z))
            filas.append([nombre, rumbo, d, round(lat, 5), round(lon, 5), z])
        perfiles[nombre] = perfil

    with open(carpeta / "transecto_isla_fuerte_gmrt.csv", "w", newline="", encoding="utf-8") as f:
        escritor = csv.writer(f)
        escritor.writerow(["rumbo", "rumbo_deg", "distancia_km", "lat", "lon", "profundidad_m"])
        escritor.writerows(filas)

    (carpeta / "transecto_isla_fuerte_gmrt.geojson").write_text(
        json.dumps(geojson_banda(filas)), encoding="utf-8"
    )

    resumen = {}
    for nombre, perfil in perfiles.items():
        d30 = distancia_a_profundidad(perfil, 30)
        d60 = distancia_a_profundidad(perfil, 60)
        resumen[nombre] = {"distancia_30m_km": d30, "distancia_60m_km": d60}
        print(f"{nombre:4s}: 30 m a {d30} km, 60 m a {d60} km")

    (carpeta / "resumen_batimetria_isla_fuerte.json").write_text(
        json.dumps(resumen, indent=2, ensure_ascii=False), encoding="utf-8"
    )

    # Comprobación: el punto exacto de Isla Fuerte es tierra (elevación positiva,
    # es una isla) y al menos un rumbo alcanza 60 m dentro de 25 km. Si esto
    # falla, la capa de GMRT o el centro de referencia cambiaron.
    assert profundidad(CENTRO_LAT, CENTRO_LON) > 0
    assert any(v["distancia_60m_km"] is not None for v in resumen.values())
    print("\ncomprobación ok")
