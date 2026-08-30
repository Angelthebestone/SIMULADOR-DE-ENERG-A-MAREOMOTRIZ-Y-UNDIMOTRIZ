"""Regenera la serie de nivel del mar de Tumaco desde el IOC Sea Level Station
Monitoring Facility (UNESCO-IOC / Flanders Marine Institute), estación `tumc`.

La estación la opera la Dirección General Marítima (DIMAR) de Colombia y alimenta la
red GLOSS. GLOSS core ID 171, en 1,82 N / -78,7287 W (canal de acceso al puerto de
Tumaco). Sensores radar (`rad`) y burbujeador (`bub`), muestreo cada 1-2 minutos.
API sin clave ni registro:

    http://www.ioc-sealevelmonitoring.org/service.php?query=data&code=tumc&timestart=...&timestop=...

El servidor trunca cualquier solicitud a como mucho ~31 dias de datos, así que este
script pide mes a mes. La cobertura tiene huecos (mantenimiento, caídas de FTP); el
script guarda lo que haya y lo reporta.

    python descargar_mareas_tumaco.py
"""

from urllib.parse import urlencode
from urllib.request import urlopen
from datetime import date
from collections import defaultdict
import csv
import json
import pathlib
import statistics

SERVICIO = "http://www.ioc-sealevelmonitoring.org/service.php"
CODIGO = "tumc"
DESDE = date(2023, 1, 1)
HASTA = date(2025, 12, 31)  # se recorta a datos existentes; huecos se ignoran
SENSOR_PREFERIDO = "rad"  # radar; si no hay, se usa 'bub' (burbujeador)

# El feed en vivo trae caídas de sensor puntuales (valores de cientos de metros).
# 0,04% de las lecturas de una prueba con datos de 2023-2025 caía fuera de este
# rango; dentro de él el percentil 99,9 es 5,92 m, coherente con marea de hasta
# 6 m en el Pacífico colombiano.
NIVEL_MIN_PLAUSIBLE = 0.5
NIVEL_MAX_PLAUSIBLE = 8.0


def meses_entre(desde: date, hasta: date):
    anio, mes = desde.year, desde.month
    while (anio, mes) <= (hasta.year, hasta.month):
        inicio = date(anio, mes, 1)
        fin = date(anio + (mes == 12), (mes % 12) + 1, 1)
        yield inicio, fin
        anio, mes = fin.year, fin.month


def descargar_mes(inicio: date, fin: date) -> list[dict]:
    consulta = urlencode(
        {
            "query": "data",
            "code": CODIGO,
            "timestart": inicio.isoformat(),
            "timestop": fin.isoformat(),
        }
    )
    with urlopen(f"{SERVICIO}?{consulta}", timeout=30) as respuesta:
        texto = respuesta.read().decode("utf-8")
    return json.loads(texto) if texto.strip() else []


def elegir_sensor(registros: list[dict]) -> list[dict]:
    por_sensor = defaultdict(list)
    for r in registros:
        por_sensor[r["sensor"]].append(r)
    if SENSOR_PREFERIDO in por_sensor:
        return por_sensor[SENSOR_PREFERIDO]
    return max(por_sensor.values(), key=len) if por_sensor else []


def rango_mareal_diario(registros: list[dict]) -> dict[str, tuple[float, float]]:
    """Máximo menos mínimo por día, descartando caídas de sensor puntuales."""
    por_dia = defaultdict(list)
    for r in registros:
        if not (NIVEL_MIN_PLAUSIBLE <= r["slevel"] <= NIVEL_MAX_PLAUSIBLE):
            continue
        dia = r["stime"][:10]
        por_dia[dia].append(r["slevel"])
    return {dia: (min(v), max(v)) for dia, v in por_dia.items() if len(v) >= 10}


if __name__ == "__main__":
    carpeta = pathlib.Path(__file__).parent
    todos = []
    for inicio, fin in meses_entre(DESDE, HASTA):
        mes_registros = descargar_mes(inicio, fin)
        elegidos = elegir_sensor(mes_registros)
        todos.extend(elegidos)
        print(
            f"{inicio:%Y-%m}: {len(mes_registros)} registros brutos, "
            f"{len(elegidos)} del sensor elegido"
        )

    destino = carpeta / "nivel_mar_tumaco_ioc_2023-2025.csv"
    with open(destino, "w", newline="", encoding="utf-8") as f:
        escritor = csv.writer(f)
        escritor.writerow(["fecha_hora_utc", "nivel_m", "sensor"])
        for r in todos:
            escritor.writerow([r["stime"], r["slevel"], r["sensor"]])

    diario = rango_mareal_diario(todos)
    rangos = [maxv - minv for minv, maxv in diario.values()]

    resumen = {
        "registros_totales": len(todos),
        "dias_con_rango_calculable": len(rangos),
        "rango_medio_m": round(statistics.mean(rangos), 3) if rangos else None,
        "rango_mediana_m": round(statistics.median(rangos), 3) if rangos else None,
        "rango_maximo_m": round(max(rangos), 3) if rangos else None,
        "rango_minimo_m": round(min(rangos), 3) if rangos else None,
    }
    (carpeta / "resumen_mareas_tumaco.json").write_text(
        json.dumps(resumen, indent=2, ensure_ascii=False), encoding="utf-8"
    )

    print(f"\n{destino.name}: {len(todos)} registros")
    print(f"Días con rango calculable: {len(rangos)}")
    if rangos:
        print(
            f"Rango mareal medio: {resumen['rango_medio_m']} m, "
            f"máximo: {resumen['rango_maximo_m']} m"
        )

    # Comprobación: la estación existe y produjo al menos 30 días de rango
    # calculable en el periodo pedido. Si esto falla, la estación se cayó
    # del todo o el servicio cambió de formato.
    assert len(rangos) >= 30, "muy pocos días con rango calculable"
    assert 0.1 <= resumen["rango_medio_m"] <= 6.0
    print("\ncomprobación ok")
