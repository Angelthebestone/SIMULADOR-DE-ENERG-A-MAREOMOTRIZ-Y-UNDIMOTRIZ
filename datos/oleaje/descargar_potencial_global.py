"""Malla mundial de potencial undimotriz a partir de reanalisis de oleaje real.

Fuente: Open-Meteo Marine API (https://open-meteo.com/en/docs/marine-weather-api),
que sirve el reanalisis de oleaje de ECMWF (ERA5-Ocean) y MFWAM de Meteo-France.
Licencia CC BY 4.0, sin clave de acceso.

Que hace
--------
Recorre una rejilla mundial de 8 grados y, para cada punto, pide la serie horaria
de altura significativa (`wave_height`, Hm0) y periodo (`wave_period`, Te) en
cuatro ventanas estacionales de 2023. Con cada hora calcula la densidad de
potencia del frente de onda en aguas profundas

    J = rho * g^2 * Hm0^2 * Te / (64 * pi)      [W/m]

y guarda la media anual de J por punto. Se promedia J, no Hm0: la potencia va con
el cuadrado de la altura, asi que promediar la altura antes subestima el recurso.

Los puntos de tierra no existen en el modelo de oleaje: la API los devuelve sin
datos y el script los descarta en vez de rellenarlos.

    python descargar_potencial_global.py

Salida: potencial_oleaje_global.geojson (lo consume web/src/map/mapa.ts).
"""

import json
import math
import pathlib
import time
import urllib.error
import urllib.parse
import urllib.request

API = "https://marine-api.open-meteo.com/v1/marine"
FUENTE = "Open-Meteo Marine API (ERA5-Ocean / MFWAM) — CC BY 4.0"
ANNO = 2023
# Cuatro ventanas de dos dias, una por estacion: cubre el contraste invierno /
# verano de los dos hemisferios sin pedir el ano entero hora a hora.
VENTANAS = [
    (f"{ANNO}-01-15", f"{ANNO}-01-16"),
    (f"{ANNO}-04-15", f"{ANNO}-04-16"),
    (f"{ANNO}-07-15", f"{ANNO}-07-16"),
    (f"{ANNO}-10-15", f"{ANNO}-10-16"),
]

PASO_GRADOS = 8
LAT_MAX = 64  # por encima del circulo polar el modelo de oleaje tiene hielo
LOTE = 40  # coordenadas por peticion (por encima de ~50 la API responde 429)
RHO = 1025.0  # kg/m3, agua de mar
G = 9.81  # m/s2

DESTINO = "potencial_oleaje_global.geojson"


def rejilla() -> list[tuple[float, float]]:
    puntos = []
    lat = -LAT_MAX
    while lat <= LAT_MAX:
        lon = -180 + PASO_GRADOS / 2
        while lon < 180:
            puntos.append((round(lat, 3), round(lon, 3)))
            lon += PASO_GRADOS
        lat += PASO_GRADOS
    return puntos


def _pedir(lotes: list[tuple[float, float]], inicio: str, fin: str) -> list[dict]:
    consulta = {
        "latitude": ",".join(str(p[0]) for p in lotes),
        "longitude": ",".join(str(p[1]) for p in lotes),
        "hourly": "wave_height,wave_period",
        "start_date": inicio,
        "end_date": fin,
        "timezone": "UTC",
    }
    url = f"{API}?{urllib.parse.urlencode(consulta)}"
    peticion = urllib.request.Request(url, headers={"User-Agent": "simulador-energia-marina/1.0"})
    with urllib.request.urlopen(peticion, timeout=120) as respuesta:
        cuerpo = json.loads(respuesta.read().decode("utf-8"))
    return cuerpo if isinstance(cuerpo, list) else [cuerpo]


def densidad_potencia_w_m(hm0: float, te: float) -> float:
    return RHO * G * G * hm0 * hm0 * te / (64 * math.pi)


def acumular(destino: dict[int, list[float]], indice: int, bloque: dict) -> None:
    horaria = bloque.get("hourly") or {}
    alturas = horaria.get("wave_height") or []
    periodos = horaria.get("wave_period") or []
    for hm0, te in zip(alturas, periodos):
        if hm0 is None or te is None or te <= 0:
            continue
        destino.setdefault(indice, []).append(densidad_potencia_w_m(float(hm0), float(te)))


def descargar() -> dict:
    puntos = rejilla()
    acumulado: dict[int, list[float]] = {}
    alturas: dict[int, list[float]] = {}
    periodos: dict[int, list[float]] = {}

    for inicio, fin in VENTANAS:
        for desplazamiento in range(0, len(puntos), LOTE):
            lote = puntos[desplazamiento : desplazamiento + LOTE]
            for intento in range(4):
                try:
                    bloques = _pedir(lote, inicio, fin)
                    break
                except (urllib.error.URLError, urllib.error.HTTPError, TimeoutError) as fallo:
                    if intento == 3:
                        raise
                    print(f"  reintento {intento + 1} ({fallo})")
                    time.sleep(5 * (intento + 1))
            for local, bloque in enumerate(bloques):
                indice = desplazamiento + local
                acumular(acumulado, indice, bloque)
                horaria = bloque.get("hourly") or {}
                for hm0 in horaria.get("wave_height") or []:
                    if hm0 is not None:
                        alturas.setdefault(indice, []).append(float(hm0))
                for te in horaria.get("wave_period") or []:
                    if te is not None:
                        periodos.setdefault(indice, []).append(float(te))
            print(f"{inicio} {desplazamiento + len(lote)}/{len(puntos)}")
            time.sleep(4)

    rasgos = []
    for indice, muestras in sorted(acumulado.items()):
        if len(muestras) < 24:  # menos de un dia de datos: no es un punto de mar util
            continue
        lat, lon = puntos[indice]
        j_w_m = sum(muestras) / len(muestras)
        hm0 = sum(alturas[indice]) / len(alturas[indice])
        te = sum(periodos[indice]) / len(periodos[indice])
        rasgos.append(
            {
                "type": "Feature",
                "geometry": {"type": "Point", "coordinates": [lon, lat]},
                "properties": {
                    "oleaje_kw_m": round(j_w_m / 1000, 2),
                    "hm0_m": round(hm0, 2),
                    "te_s": round(te, 2),
                    "horas": len(muestras),
                },
            }
        )

    return {
        "type": "FeatureCollection",
        "fuente": FUENTE,
        "estado": "inferido",
        "metodo": (
            f"media de J = rho g^2 Hm0^2 Te / (64 pi) sobre {len(VENTANAS)} ventanas "
            f"estacionales de 2 dias en {ANNO}, rejilla de {PASO_GRADOS} grados"
        ),
        "unidad": "kW/m",
        "features": rasgos,
    }


if __name__ == "__main__":
    malla = descargar()
    destino = pathlib.Path(__file__).parent / DESTINO
    destino.write_text(json.dumps(malla), encoding="utf-8")
    valores = [r["properties"]["oleaje_kw_m"] for r in malla["features"]]
    print(
        f"{DESTINO}: {len(valores)} puntos de mar, "
        f"J entre {min(valores):.1f} y {max(valores):.1f} kW/m, "
        f"{destino.stat().st_size / 1e6:.2f} MB"
    )
    # El patron global es conocido: los cuarenta rugientes y el Atlantico norte
    # superan con holgura el cinturon ecuatorial. Si no sale asi, la descarga
    # trajo otra cosa.
    def media(filtro) -> float:
        sel = [
            r["properties"]["oleaje_kw_m"]
            for r in malla["features"]
            if filtro(r["geometry"]["coordinates"][1])
        ]
        return sum(sel) / len(sel)

    rugientes = media(lambda lat: -60 <= lat <= -40)
    tropico = media(lambda lat: -15 <= lat <= 15)
    assert rugientes > 2 * tropico, f"rugientes {rugientes:.1f} vs tropico {tropico:.1f}"
    print(f"comprobacion ok — rugientes {rugientes:.1f} kW/m vs tropico {tropico:.1f} kW/m")
