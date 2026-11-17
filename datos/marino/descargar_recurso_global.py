"""Recurso marino de todo el mundo para el punto libre del mapa: ola, marea y corriente.

Fuente: Open-Meteo Marine API (https://open-meteo.com/en/docs/marine-weather-api).
Sirve el oleaje de ECMWF (ERA5-Ocean) y MFWAM de Meteo-France, y la corriente y el
nivel del mar con marea del modelo SMOC de Mercator Ocean, a 1/12 de grado.
Licencia CC BY 4.0, sin clave de acceso.

Es una ingesta: se ejecuta fuera de la aplicacion y deja un archivo local. El
simulador nunca consulta la red (documentacion/aislamiento_red.md).

Puntos
------
Dos familias, porque cada recurso vive en un sitio distinto:
  * Costa: un punto cada ~150 km a lo largo del contorno de tierra
    (datos/costa/contorno_tierra.geojson). Ahi es donde se construye un dique o se
    fondea una turbina, y donde la marea se amplifica.
  * Mar abierto: rejilla de 6 grados, para el oleaje lejos de costa.
La API desplaza cada coordenada a la celda de mar mas proxima y devuelve esa
celda; se guarda la celda devuelta, no la pedida.

Ventana
-------
15 dias seguidos (2024-03-01 a 2024-03-15): cubre un ciclo completo de mareas
vivas y muertas (14,77 dias), que es lo que deciden el rango y el pico de corriente.
Una sola quincena no describe el clima de oleaje del ano entero: se declara
`inferido` y la ficha lo dice.

Que se guarda por punto
-----------------------
  hm0_m, te_s: estado de mar equivalente en energia. te_s es el periodo medio y
      hm0_m = sqrt(J_media / (0,49 te_s)), de modo que 0,49 hm0^2 te = J media.
      Asi la ficha del mapa y la simulacion, que usan Hm0 y Te, dan la misma cifra.
  kw_m: J media en kW/m, J = rho g^2 Hm0^2 Te / (64 pi) hora a hora.
  rango_m: media de (max - min) del nivel del mar en cada ventana de 24 h.
  pico_ms: maxima velocidad de corriente de la quincena (pico en vivas).

    python datos/marino/descargar_recurso_global.py

Reanudable: guarda lo descargado en recurso_global.parcial.json y continua desde ahi.
Salida: datos/marino/recurso_global.json (lo consume web/src/datos/marino.ts).
"""

from __future__ import annotations

import json
import math
import pathlib
import time
import urllib.error
import urllib.parse
import urllib.request

API = "https://marine-api.open-meteo.com/v1/marine"
FUENTE = "Open-Meteo Marine API (ERA5-Ocean, MFWAM, Mercator SMOC 1/12°) — CC BY 4.0"
INICIO, FIN = "2024-03-01", "2024-03-15"
VARIABLES = "wave_height,wave_period,ocean_current_velocity,sea_level_height_msl"

PASO_COSTA_KM = 150.0
PASO_MAR_GRADOS = 6
LAT_MAX = 66
LOTE = 40  # por encima de ~50 coordenadas por peticion la API responde 429
PAUSA_S = 6.0

RHO = 1025.0
G = 9.81

AQUI = pathlib.Path(__file__).resolve().parent
COSTA = AQUI.parent / "costa" / "contorno_tierra.geojson"
PARCIAL = AQUI / "recurso_global.parcial.json"
DESTINO = AQUI / "recurso_global.json"


def distancia_km(lon1: float, lat1: float, lon2: float, lat2: float) -> float:
    rad = math.pi / 180
    a = (
        math.sin((lat2 - lat1) * rad / 2) ** 2
        + math.cos(lat1 * rad) * math.cos(lat2 * rad) * math.sin((lon2 - lon1) * rad / 2) ** 2
    )
    return 2 * 6371 * math.asin(min(1.0, math.sqrt(a)))


def puntos_costa() -> list[tuple[float, float]]:
    datos = json.loads(COSTA.read_text(encoding="utf-8"))
    puntos: list[tuple[float, float]] = []
    for rasgo in datos["features"]:
        geo = rasgo["geometry"]
        poligonos = [geo["coordinates"]] if geo["type"] == "Polygon" else geo["coordinates"]
        for poligono in poligonos:
            anillo = poligono[0]
            recorrido = PASO_COSTA_KM  # el primer vertice de cada anillo entra
            previo = anillo[0]
            for lon, lat in anillo:
                recorrido += distancia_km(previo[0], previo[1], lon, lat)
                previo = (lon, lat)
                if recorrido >= PASO_COSTA_KM and abs(lat) <= LAT_MAX:
                    puntos.append((round(lon, 3), round(lat, 3)))
                    recorrido = 0.0
    return puntos


def puntos_mar() -> list[tuple[float, float]]:
    return [
        (lon + PASO_MAR_GRADOS / 2, lat)
        for lat in range(-60, LAT_MAX + 1, PASO_MAR_GRADOS)
        for lon in range(-180, 180, PASO_MAR_GRADOS)
    ]


def pedir(lote: list[tuple[float, float]]) -> list[dict]:
    consulta = {
        "latitude": ",".join(str(p[1]) for p in lote),
        "longitude": ",".join(str(p[0]) for p in lote),
        "hourly": VARIABLES,
        "start_date": INICIO,
        "end_date": FIN,
        "timezone": "UTC",
    }
    url = f"{API}?{urllib.parse.urlencode(consulta)}"
    peticion = urllib.request.Request(url, headers={"User-Agent": "simulador-energia-marina/1.0"})
    with urllib.request.urlopen(peticion, timeout=180) as respuesta:
        cuerpo = json.loads(respuesta.read().decode("utf-8"))
    return cuerpo if isinstance(cuerpo, list) else [cuerpo]


def resumir(bloque: dict) -> list[float | None] | None:
    """Una fila [lon, lat, hm0_m, te_s, kw_m, rango_m, pico_ms] o None si es tierra."""
    h = bloque.get("hourly") or {}
    alturas = h.get("wave_height") or []
    periodos = h.get("wave_period") or []
    olas = [(a, t) for a, t in zip(alturas, periodos) if a is not None and t is not None and t > 0]
    nivel = h.get("sea_level_height_msl") or []
    corriente = [v for v in (h.get("ocean_current_velocity") or []) if v is not None]

    hm0 = te = kw = None
    if len(olas) >= 24:
        j_w_m = sum(RHO * G * G * a * a * t / (64 * math.pi) for a, t in olas) / len(olas)
        te = sum(t for _, t in olas) / len(olas)
        kw = j_w_m / 1000.0
        hm0 = math.sqrt(kw / (0.49 * te))

    rangos = []
    for i in range(0, len(nivel) - 23, 24):
        dia = [z for z in nivel[i : i + 25] if z is not None]
        if len(dia) >= 20:
            rangos.append(max(dia) - min(dia))
    rango = sum(rangos) / len(rangos) if rangos else None
    # La API da la corriente en km/h.
    pico = max(corriente) / 3.6 if len(corriente) >= 24 else None

    if hm0 is None and rango is None and pico is None:
        return None
    redondeo = lambda v, d: None if v is None else round(v, d)  # noqa: E731
    return [
        round(float(bloque["longitude"]), 3),
        round(float(bloque["latitude"]), 3),
        redondeo(hm0, 2),
        redondeo(te, 1),
        redondeo(kw, 1),
        redondeo(rango, 2),
        redondeo(pico, 2),
    ]


def descargar() -> None:
    pedidos = puntos_costa() + puntos_mar()
    hecho = json.loads(PARCIAL.read_text(encoding="utf-8")) if PARCIAL.exists() else {"siguiente": 0, "filas": []}
    print(f"{len(pedidos)} puntos; se reanuda en {hecho['siguiente']}")
    for desde in range(hecho["siguiente"], len(pedidos), LOTE):
        lote = pedidos[desde : desde + LOTE]
        for intento in range(5):
            try:
                bloques = pedir(lote)
                break
            except (urllib.error.URLError, urllib.error.HTTPError, TimeoutError) as fallo:
                if intento == 4:
                    raise
                espera = 30 * (intento + 1)
                print(f"  reintento {intento + 1} en {espera} s ({fallo})")
                time.sleep(espera)
        hecho["filas"].extend(f for f in map(resumir, bloques) if f is not None)
        hecho["siguiente"] = desde + len(lote)
        PARCIAL.write_text(json.dumps(hecho), encoding="utf-8")
        print(f"{hecho['siguiente']}/{len(pedidos)}")
        time.sleep(PAUSA_S)

    # Varias peticiones caen en la misma celda de mar: una fila por celda.
    unicas = {(f[0], f[1]): f for f in hecho["filas"]}
    salida = {
        "fuente": FUENTE,
        "periodo": f"{INICIO} a {FIN}",
        "estado": "inferido",
        "metodo": (
            "15 dias horarios (un ciclo vivas-muertas). hm0_m y te_s: estado de mar equivalente "
            "en energia (0,49 hm0^2 te = J media). rango_m: media diaria de max-min del nivel del "
            "mar. pico_ms: maxima corriente de la quincena."
        ),
        "campos": ["lon", "lat", "hm0_m", "te_s", "kw_m", "rango_m", "pico_ms"],
        "puntos": sorted(unicas.values()),
    }
    DESTINO.write_text(json.dumps(salida, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    PARCIAL.unlink()
    print(f"{len(unicas)} celdas en {DESTINO.name}")


if __name__ == "__main__":
    descargar()
