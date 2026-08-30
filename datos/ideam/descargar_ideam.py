"""Regenera los CSV de nivel del mar del IDEAM desde la API abierta de datos.gov.co.

Conjunto ia8x-22em, dato crudo sin validar. Ejecutar solo para actualizar los
archivos; el simulador lee los CSV, nunca la red.

    python descargar_ideam.py
"""

from urllib.parse import urlencode
from urllib.request import urlopen
import pathlib

CONJUNTO = "https://www.datos.gov.co/resource/ia8x-22em.csv"
COLUMNAS = (
    "fechaobservacion,valorobservado,nombreestacion,codigoestacion,latitud,longitud,unidadmedida"
)

ESTACIONES = {
    "0054077210": "nivel_mar_juanchaco_horario_2005-2020.csv",
    "0014017001": "nivel_mar_islatesoro_10min_2012-2020.csv",
}


def descargar(codigo: str, destino: str) -> int:
    consulta = urlencode(
        {
            "$select": COLUMNAS,
            "$where": f"codigoestacion='{codigo}'",
            "$order": "fechaobservacion",
            "$limit": 500_000,
        }
    )
    with urlopen(f"{CONJUNTO}?{consulta}") as respuesta:
        texto = respuesta.read().decode("utf-8")
    pathlib.Path(destino).write_text(texto, encoding="utf-8")
    return texto.count("\n") - 1  # descuenta la cabecera


if __name__ == "__main__":
    for codigo, destino in ESTACIONES.items():
        print(f"{destino}: {descargar(codigo, destino)} registros")
