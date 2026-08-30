"""Estres de los datos locales: corromper datos/ y comprobar que degrada.

La aplicacion es offline y todo lo lee de datos/. La regla que se verifica aqui
es que un archivo ausente, vacio, con JSON invalido o con la geometria mal
formada degrada a "pendiente" sin propagar excepciones.

Las pruebas que dependian de la capa de presentacion Qt (LienzoMapa,
PanelCalcular) fueron retiradas en fase 2 al sustituir Qt por la carcasa web.
Las verificaciones equivalentes viven en pruebas/test_mapa.py y
pruebas/test_niveles.py.

Cada prueba restaura los archivos en un finally: el arbol de datos queda como
estaba aunque la prueba falle.
"""

from __future__ import annotations

import json
import pathlib
from contextlib import contextmanager

import pytest

from app.datos_lectura import (
    RUTA_BATIMETRIA,
    RUTA_RUNAP,
    RUTA_SITIOS,
    cargar_areas_protegidas,
    cargar_batimetria,
    cargar_sitios,
)
from app.servicio import Parametros, simular, serie_oleaje

RAIZ = pathlib.Path(__file__).resolve().parents[1]

GEOJSON_CORRUPTOS = {
    "json_invalido": b"{ esto no es json ",
    "vacio": b"",
    "solo_espacios": b"   \n  ",
}
GEOJSON_INCOMPLETOS = {
    "sin_clave_features": b'{"type":"FeatureCollection"}',
    "features_vacio": b'{"type":"FeatureCollection","features":[]}',
}
GEOJSON_GEOMETRIA_MALA = {
    "feature_sin_geometry": b'{"type":"FeatureCollection","features":[{"properties":{}}]}',
    "geometry_de_tipo_punto": (
        b'{"type":"FeatureCollection","features":[{"properties":{},'
        b'"geometry":{"type":"Point","coordinates":[-76.0,9.0]}}]}'
    ),
}


@contextmanager
def _runap_reemplazado(contenido: bytes):
    ruta = RAIZ / RUTA_RUNAP
    respaldo = ruta.read_bytes()
    try:
        ruta.write_bytes(contenido)
        yield ruta
    finally:
        ruta.write_bytes(respaldo)


@contextmanager
def _sitios_reemplazados(nuevos: dict[str, bytes] | None):
    """nuevos=None borra la carpeta entera de fichas de sitio."""
    carpeta = RAIZ / RUTA_SITIOS
    respaldo = {p.name: p.read_bytes() for p in carpeta.glob("*.json")}
    try:
        for p in carpeta.glob("*.json"):
            p.unlink()
        for nombre, contenido in (nuevos or {}).items():
            (carpeta / nombre).write_bytes(contenido)
        yield carpeta
    finally:
        for p in carpeta.glob("*.json"):
            p.unlink()
        for nombre, contenido in respaldo.items():
            (carpeta / nombre).write_bytes(contenido)


def test_s3_00_el_arbol_de_datos_esta_intacto():
    assert len(cargar_areas_protegidas()) == 37
    assert len(cargar_sitios()) == 5
    assert cargar_batimetria()["lon"].size > 0


# --------------------------------------------------------------------------
# 3a. RUNAP corrupto
# --------------------------------------------------------------------------


@pytest.mark.parametrize("caso", sorted(GEOJSON_CORRUPTOS))
def test_s3_01_runap_corrupto_degrada_a_capa_vacia(caso):
    with _runap_reemplazado(GEOJSON_CORRUPTOS[caso]):
        assert cargar_areas_protegidas() == []


@pytest.mark.parametrize("caso", sorted(GEOJSON_INCOMPLETOS))
def test_s3_03_runap_sin_features_si_degrada(caso):
    """Este si esta cubierto: .get('features', []) absorbe la clave ausente."""
    with _runap_reemplazado(GEOJSON_INCOMPLETOS[caso]):
        assert cargar_areas_protegidas() == []


def test_s3_04_runap_ausente_degrada():
    ruta = RAIZ / RUTA_RUNAP
    respaldo = ruta.read_bytes()
    try:
        ruta.unlink()
        assert cargar_areas_protegidas() == []
    finally:
        ruta.write_bytes(respaldo)


@pytest.mark.parametrize("caso", sorted(GEOJSON_GEOMETRIA_MALA))
def test_s3_05_geometria_mal_formada_se_salta(caso):
    with _runap_reemplazado(GEOJSON_GEOMETRIA_MALA[caso]):
        assert cargar_areas_protegidas() == []


# --------------------------------------------------------------------------
# 3b. Fichas de sitio ausentes o corruptas
# --------------------------------------------------------------------------


def test_s3_06_sin_ninguna_ficha_de_sitio_todo_degrada():
    with _sitios_reemplazados(None):
        assert cargar_sitios() == []
        salida = simular(Parametros())
        panel = salida["extras"]["panel_sitio"]
        assert panel.estado_legal == "desconocido"
        assert "utilizable —" not in panel.veredicto
        assert salida["resultado"].eslabones[-1].potencia_salida_w >= 0.0


def test_s3_08_una_ficha_de_sitio_corrupta_se_salta():
    with _sitios_reemplazados({"isla_fuerte.json": b"{roto", "otro.json": b'{"id":"otro"}'}):
        sitios = cargar_sitios()
        assert [s["id"] for s in sitios] == ["otro"]


def test_s3_09_ficha_de_sitio_sin_coordenadas_degrada():
    ficha = json.dumps({"id": "sin_coords", "nombre": "Sin coordenadas"}).encode("utf-8")
    with _sitios_reemplazados({"sin_coords.json": ficha}):
        sitios = cargar_sitios()
        assert len(sitios) == 1
        assert sitios[0]["j_kw_m"] is None
        assert sitios[0]["estado_recurso"] == "pendiente"
        assert sitios[0]["estado_legal"] == "desconocido"


# --------------------------------------------------------------------------
# 3c. j_kw_m pendiente con valor > 0
# --------------------------------------------------------------------------


def _ficha_con_j_pendiente(valor: float) -> bytes:
    return json.dumps(
        {
            "id": "isla_fuerte",
            "nombre": "Isla Fuerte",
            "estado_legal": "utilizable",
            "latitud": {
                "valor": 9.39,
                "unidad": "grados",
                "fuente": "prueba",
                "estado": "verificado",
            },
            "longitud": {
                "valor": -76.18,
                "unidad": "grados",
                "fuente": "prueba",
                "estado": "verificado",
            },
            "densidad_potencia_media": {
                "valor": valor,
                "unidad": "kW/m",
                "fuente": "valor sin verificar, puesto solo para esta prueba",
                "estado": "pendiente",
            },
        }
    ).encode("utf-8")


def test_s3_10_el_mapa_rotula_pendiente_aunque_el_valor_sea_alto():
    with _sitios_reemplazados({"isla_fuerte.json": _ficha_con_j_pendiente(25.0)}):
        sitio = cargar_sitios()[0]
        assert sitio["j_kw_m"] is None
        assert sitio["estado_recurso"] == "pendiente"


def test_s3_11_el_panel_no_puntua_con_un_j_pendiente():
    with _sitios_reemplazados({"isla_fuerte.json": _ficha_con_j_pendiente(25.0)}):
        panel = simular(Parametros(sitio_id="isla_fuerte"))["extras"]["panel_sitio"]
        energia = next(c for c in panel.criterios if "energia" in c.nombre)
        assert energia.cumple is False


def test_s3_12_mapa_y_panel_dicen_lo_mismo_del_mismo_dato():
    """El sintoma que veria quien sustente la tesis: ya no se contradicen."""
    with _sitios_reemplazados({"isla_fuerte.json": _ficha_con_j_pendiente(25.0)}):
        mapa_dice = cargar_sitios()[0]["estado_recurso"]
        panel = simular(Parametros(sitio_id="isla_fuerte"))["extras"]["panel_sitio"]
        energia = next(c for c in panel.criterios if "energia" in c.nombre)
        assert mapa_dice == "pendiente"
        assert energia.cumple is False
        assert energia.valor == 0.0, "el valor pendiente no debe llegar a la tabla"


# --------------------------------------------------------------------------
# 3d. Batimetria
# --------------------------------------------------------------------------


def test_s3_13_batimetria_ausente_o_corrupta_degrada():
    ruta = RAIZ / RUTA_BATIMETRIA
    respaldo = ruta.read_bytes()
    try:
        ruta.unlink()
        assert cargar_batimetria() == {}
        ruta.write_bytes(b"lon,lat,profundidad_m\nno,es,numero\n")
        datos = cargar_batimetria()
        assert datos["lon"].size == 0
    finally:
        ruta.write_bytes(respaldo)


def test_s3_14_serie_de_oleaje_ausente_deja_la_matriz_pendiente():
    """Sin serie de oleaje para el sitio, la matriz queda en estado pendiente."""
    assert serie_oleaje("sitio_que_no_existe") is None
    salida = simular(Parametros(sitio_id="sitio_que_no_existe", completo=True))
    matriz = salida["extras"]["aep_matriz"]
    assert matriz["estado"] == "pendiente"
    assert "sin serie de oleaje" in matriz["motivo"]


def test_s3_99_el_arbol_de_datos_sigue_intacto():
    """Cierra el modulo comprobando que ninguna prueba dejo datos/ tocado."""
    assert len(cargar_areas_protegidas()) == 37
    assert len(cargar_sitios()) == 5
    assert cargar_batimetria()["lon"].size > 0
