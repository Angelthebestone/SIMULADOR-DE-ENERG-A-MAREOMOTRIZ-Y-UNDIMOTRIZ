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
Marea y corriente: 15 dias seguidos (2024-03-01 a 2024-03-15), un ciclo completo de
mareas vivas y muertas (14,77 dias), que es lo que deciden el rango y el pico.
Oleaje: una quincena de marzo es invierno en el norte y daba el doble de la media
anual, asi que `oleaje_anual()` lo rehace con cuatro ventanas estacionales de 2023
(`--solo-oleaje` repite solo esa fase). Todo se declara `inferido`.

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
    PARCIAL.unlink(missing_ok=True)
    print(f"{len(unicas)} celdas en {DESTINO.name}")


VENTANAS_OLEAJE = [
    ("2023-01-14", "2023-01-17"),
    ("2023-04-14", "2023-04-17"),
    ("2023-07-14", "2023-07-17"),
    ("2023-10-14", "2023-10-17"),
]
PASO_OLEAJE = 3
MAX_KM_RELLENO = 400.0
PARCIAL_OLEAJE = AQUI / "recurso_global.oleaje.parcial.json"


def oleaje_anual() -> None:
    """Rehace hm0_m, te_s y kw_m con cuatro ventanas estacionales.

    La quincena de marzo basta para la marea, pero en el Atlántico norte es
    pleno invierno y daba el doble de la potencia media anual. Las mismas
    celdas se piden de nuevo (ya son de mar, la API devuelve la misma).
    """
    salida = json.loads(DESTINO.read_text(encoding="utf-8"))
    # Una celda de cada tres: la ola cambia despacio y asi caben las cuatro
    # ventanas en el cupo diario gratuito de la API (10 000 llamadas).
    puntos = [(p[0], p[1]) for p in salida["puntos"]][::PASO_OLEAJE]
    hecho = (
        json.loads(PARCIAL_OLEAJE.read_text(encoding="utf-8"))
        if PARCIAL_OLEAJE.exists()
        else {"siguiente": 0, "muestras": {}}
    )
    for desde in range(hecho["siguiente"], len(puntos), LOTE):
        lote = puntos[desde : desde + LOTE]
        for inicio, fin in VENTANAS_OLEAJE:
            consulta = {
                "latitude": ",".join(str(p[1]) for p in lote),
                "longitude": ",".join(str(p[0]) for p in lote),
                "hourly": "wave_height,wave_period",
                "start_date": inicio,
                "end_date": fin,
                "timezone": "UTC",
            }
            url = f"{API}?{urllib.parse.urlencode(consulta)}"
            for intento in range(5):
                try:
                    peticion = urllib.request.Request(url, headers={"User-Agent": "simulador-energia-marina/1.0"})
                    with urllib.request.urlopen(peticion, timeout=180) as respuesta:
                        cuerpo = json.loads(respuesta.read().decode("utf-8"))
                    break
                except (urllib.error.URLError, urllib.error.HTTPError, TimeoutError) as fallo:
                    if intento == 4:
                        raise
                    print(f"  reintento {intento + 1} ({fallo})")
                    time.sleep(30 * (intento + 1))
            bloques = cuerpo if isinstance(cuerpo, list) else [cuerpo]
            for (lon, lat), bloque in zip(lote, bloques):
                h = bloque.get("hourly") or {}
                pares = [
                    [a, t]
                    for a, t in zip(h.get("wave_height") or [], h.get("wave_period") or [])
                    if a is not None and t is not None and t > 0
                ]
                hecho["muestras"].setdefault(f"{lon},{lat}", []).extend(pares)
            time.sleep(PAUSA_S / 2)
        hecho["siguiente"] = desde + len(lote)
        PARCIAL_OLEAJE.write_text(json.dumps(hecho), encoding="utf-8")
        print(f"oleaje {hecho['siguiente']}/{len(puntos)}")

    medidos = []
    for clave, olas in hecho["muestras"].items():
        if len(olas) < 48:
            continue
        lon, lat = map(float, clave.split(","))
        kw = sum(RHO * G * G * a * a * t / (64 * math.pi) for a, t in olas) / len(olas) / 1000.0
        te = sum(t for _, t in olas) / len(olas)
        medidos.append((lon, lat, round(math.sqrt(kw / (0.49 * te)), 2), round(te, 1), round(kw, 1)))
    for p in salida["puntos"]:
        cerca = min(medidos, key=lambda m: distancia_km(p[0], p[1], m[0], m[1]), default=None)
        if cerca is None or distancia_km(p[0], p[1], cerca[0], cerca[1]) > MAX_KM_RELLENO:
            p[2] = p[3] = p[4] = None
        else:
            p[2], p[3], p[4] = cerca[2], cerca[3], cerca[4]
    salida["metodo"] = (
        "Marea y corriente: 15 dias horarios de marzo de 2024 (un ciclo vivas-muertas); rango_m es la "
        "media diaria de max-min del nivel del mar y pico_ms la maxima corriente. Oleaje: cuatro "
        "ventanas estacionales de 4 dias en 2023; hm0_m y te_s son el estado de mar equivalente en "
        "energia (0,49 hm0^2 te = J media), medidos en una celda de cada tres y asignados a las demas "
        "desde la medida mas proxima (como mucho a 400 km)."
    )
    salida["periodo"] = "marea 2024-03-01 a 2024-03-15; oleaje 4 estaciones de 2023"
    DESTINO.write_text(json.dumps(salida, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    PARCIAL_OLEAJE.unlink(missing_ok=True)
    print("oleaje anual escrito")


if __name__ == "__main__":
    import sys

    if "--solo-oleaje" not in sys.argv:
        descargar()
    oleaje_anual()
