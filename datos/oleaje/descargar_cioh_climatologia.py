"""Descarga las fichas de climatología portuaria del CIOH (DIMAR) con datos de oleaje.

El CIOH (Centro de Investigaciones Oceanográficas e Hidrográficas del Caribe, DIMAR)
publica una ficha en PDF por puerto del Caribe colombiano, con rosas de oleaje
mensuales (altura significativa por rumbo) calculadas con el modelo SWAN 1979-2010.
No hay serie numérica descargable, son gráficos, pero es la única fuente primaria
colombiana con algo de oleaje para el Caribe. Sin clave ni registro:

    https://cioh.dimar.mil.co/images/site/principales_puertos/pdf/<n>_<PUERTO>.pdf

Se descargan solo San Andrés y Coveñas, los dos puertos con ficha más cercanos a los
emplazamientos del simulador (Coveñas está a unos 55 km de Isla Fuerte). Hay otras
siete fichas en el mismo patrón (Providencia, Puerto Bolívar, Cartagena, Santa Marta,
Riohacha, Turbo, Barranquilla) por si hicieran falta más adelante.

    python descargar_cioh_climatologia.py
"""

from urllib.request import Request, urlopen
import pathlib

BASE = "https://cioh.dimar.mil.co/images/site/principales_puertos/pdf"

FICHAS = {
    "2_SAN_ANDRES.pdf": "cioh_climatologia_san_andres.pdf",
    "7_COVENIAS.pdf": "cioh_climatologia_covenas.pdf",
}


def descargar(nombre_remoto: str, destino: pathlib.Path) -> int:
    peticion = Request(
        f"{BASE}/{nombre_remoto}", headers={"User-Agent": "simulador-energia-marina/1.0"}
    )
    with urlopen(peticion, timeout=30) as respuesta:
        contenido = respuesta.read()
    destino.write_bytes(contenido)
    return len(contenido)


if __name__ == "__main__":
    carpeta = pathlib.Path(__file__).parent
    for remoto, local in FICHAS.items():
        destino = carpeta / local
        n = descargar(remoto, destino)
        print(f"{local}: {n} bytes")

    # Comprobación: son PDF de verdad, no una página de error HTML.
    for local in FICHAS.values():
        assert (carpeta / local).read_bytes()[:4] == b"%PDF"
    print("\ncomprobación ok")
