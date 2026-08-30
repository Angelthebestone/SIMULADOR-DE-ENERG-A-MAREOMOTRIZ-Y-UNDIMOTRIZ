"""Regenera los CSV de economía y demanda ZNI desde la API abierta de datos.gov.co.

Cubre tres conjuntos de la Superintendencia de Servicios Públicos (Superservicios):

- `3ebi-d83g` Estado de la prestación del servicio en ZNI (demanda mensual).
- `qwe5-ycap` Registro de Operación Diario ZNI (generación y horas de servicio).
- `p62q-r7ag` Información Comercial para el Sector Residencial ZNI (facturación).
- `5cvc-m38t` Costo Unitario Libre Competencia - ZNI (generación, distribución y
  comercialización media, COP/kWh).
- `sqyx-3h49` Tarifas Aplicadas - ZNI (tarifa final por estrato, COP/kWh).
- `td8k-vhq9` Costo Unitario Prestación del Servicio (sistema interconectado, COP/kWh).

Todo sin registro ni clave. Ejecutar solo para actualizar los archivos; el simulador
lee los CSV, nunca la red.

    python descargar_zni.py
"""

from urllib.parse import urlencode
from urllib.request import urlopen
import pathlib

BASE = "https://www.datos.gov.co/resource/{}.csv"

# Cada descarga: (conjunto, destino, filtro SoQL o None, límite, orden o None).
DESCARGAS = [
    (
        "3ebi-d83g",
        "demanda_isla_fuerte_2020-2025.csv",
        "localidad like '%ISLA FUERTE%'",
        200,
        "anio,mes",
    ),
    (
        "qwe5-ycap",
        "operacion_diaria_isla_fuerte_2022.csv",
        "codigo_localidad='1300100700001'",
        200,
        "fecha",
    ),
    (
        "p62q-r7ag",
        "comercial_residencial_isla_fuerte_2022.csv",
        "codigo_localidad='1300100700001'",
        3000,
        "fch_ini_per_factura",
    ),
    (
        "5cvc-m38t",
        "costo_unitario_zni_soling_isla_fuerte_2023.csv",
        "id_empresa='48907'",
        50,
        "fecha_inicio",
    ),
    (
        "sqyx-3h49",
        "tarifas_aplicadas_zni_soling_isla_fuerte_2023.csv",
        "id_empresa='48907'",
        50,
        "fecha_inicio",
    ),
    (
        "5cvc-m38t",
        "costo_unitario_zni_nacional_diesel_2023.csv",
        "tipo_tecnologia='1'",
        700,
        "departamento,municipio,fecha_inicio",
    ),
    ("td8k-vhq9", "costo_unitario_sin_nacional_2023.csv", None, 15000, None),
]


def descargar(
    conjunto: str, destino: str, filtro: str | None, limite: int, orden: str | None
) -> int:
    parametros = {"$limit": limite}
    if filtro:
        parametros["$where"] = filtro
    if orden:
        parametros["$order"] = orden
    consulta = urlencode(parametros)
    with urlopen(f"{BASE.format(conjunto)}?{consulta}") as respuesta:
        texto = respuesta.read().decode("utf-8")
    pathlib.Path(destino).write_text(texto, encoding="utf-8")
    return texto.count("\n") - 1  # descuenta la cabecera


if __name__ == "__main__":
    for conjunto, destino, filtro, limite, orden in DESCARGAS:
        n = descargar(conjunto, destino, filtro, limite, orden)
        print(f"{destino}: {n} registros ({conjunto})")

    # Comprobación: Isla Fuerte tiene que seguir apareciendo con su operador
    # SOLING DEL SINU y un costo unitario de generación diésel de varios
    # cientos de COP/kWh. Si esto falla, la fuente o el filtro cambiaron.
    contenido = pathlib.Path("costo_unitario_zni_soling_isla_fuerte_2023.csv").read_text(
        encoding="utf-8"
    )
    assert "SOLING DEL SINU" in contenido
    assert "48907" in contenido
    print("\ncomprobación ok")
