"""Estres de los datos locales: corromper datos/ y comprobar que degrada.

La aplicacion es offline y todo lo lee de datos/. La regla que se verifica aqui
es que un archivo ausente, vacio, con JSON invalido o con la geometria mal
formada degrada a "pendiente" y deja la ventana en pie, sin propagar la
excepcion hasta el constructor de la interfaz.

Cada prueba restaura los archivos en un finally: el arbol de datos queda como
estaba aunque la prueba falle.
"""

from __future__ import annotations

import json
import os
import pathlib
from contextlib import contextmanager

import pytest

os.environ.setdefault("QT_QPA_PLATFORM", "offscreen")

pytest.importorskip("PySide6")

from PySide6.QtWidgets import QApplication  # noqa: E402

from interfaz.calculo import Parametros, simular  # noqa: E402
from interfaz.mapa import (  # noqa: E402
    RUTA_RUNAP,
    RUTA_SITIOS,
    LienzoMapa,
    cargar_areas_protegidas,
    cargar_batimetria,
    cargar_sitios,
)

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


@pytest.fixture(scope="module")
def aplicacion():
    app = QApplication.instance() or QApplication([])
    yield app


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


@pytest.mark.parametrize("caso", sorted(GEOJSON_CORRUPTOS))
def test_s3_02_el_mapa_se_dibuja_sin_la_capa_de_areas(aplicacion, caso):
    with _runap_reemplazado(GEOJSON_CORRUPTOS[caso]):
        mapa = LienzoMapa()
        mapa.dibujar()
        assert mapa._areas == []


@pytest.mark.parametrize("caso", sorted(GEOJSON_INCOMPLETOS))
def test_s3_03_runap_sin_features_si_degrada(aplicacion, caso):
    """Este si esta cubierto: .get('features', []) absorbe la clave ausente."""
    with _runap_reemplazado(GEOJSON_INCOMPLETOS[caso]):
        assert cargar_areas_protegidas() == []
        mapa = LienzoMapa()
        mapa.dibujar()
        assert mapa.capas["protegidas"] is True


def test_s3_04_runap_ausente_degrada(aplicacion):
    ruta = RAIZ / RUTA_RUNAP
    respaldo = ruta.read_bytes()
    try:
        ruta.unlink()
        assert cargar_areas_protegidas() == []
        LienzoMapa().dibujar()
    finally:
        ruta.write_bytes(respaldo)


@pytest.mark.parametrize("caso", sorted(GEOJSON_GEOMETRIA_MALA))
def test_s3_05_geometria_mal_formada_se_salta(caso):
    with _runap_reemplazado(GEOJSON_GEOMETRIA_MALA[caso]):
        assert cargar_areas_protegidas() == []


# --------------------------------------------------------------------------
# 3b. Fichas de sitio ausentes o corruptas
# --------------------------------------------------------------------------


def test_s3_06_sin_ninguna_ficha_de_sitio_todo_degrada(aplicacion):
    with _sitios_reemplazados(None):
        assert cargar_sitios() == []
        mapa = LienzoMapa()
        mapa.dibujar()
        assert mapa.descripcion_sitio("isla_fuerte") == "sitio desconocido"
        salida = simular(Parametros())
        panel = salida["extras"]["panel_sitio"]
        assert panel.estado_legal == "desconocido"
        assert "utilizable —" not in panel.veredicto
        assert salida["resultado"].eslabones[-1].potencia_salida_w >= 0.0


def test_s3_07_sin_fichas_el_panel_calcular_no_pinta_constantes_inventadas(aplicacion):
    from interfaz.paneles import PanelCalcular

    with _sitios_reemplazados(None):
        salida = simular(Parametros())
        panel = PanelCalcular()
        panel.actualizar(salida["resultado"], salida["extras"])
        # solo quedan las tres constantes fisicas, ninguna cifra de sitio
        assert panel.tabla_constantes.rowCount() == 3
        estados = {
            panel.tabla_constantes.item(fila, 3).text()
            for fila in range(panel.tabla_constantes.rowCount())
        }
        assert all("verificado" in estado for estado in estados)


def test_s3_08_una_ficha_de_sitio_corrupta_se_salta(aplicacion):
    with _sitios_reemplazados({"isla_fuerte.json": b"{roto", "otro.json": b'{"id":"otro"}'}):
        sitios = cargar_sitios()
        assert [s["id"] for s in sitios] == ["otro"]


def test_s3_09_ficha_de_sitio_sin_coordenadas_degrada(aplicacion):
    ficha = json.dumps({"id": "sin_coords", "nombre": "Sin coordenadas"}).encode("utf-8")
    with _sitios_reemplazados({"sin_coords.json": ficha}):
        sitios = cargar_sitios()
        assert len(sitios) == 1
        assert sitios[0]["j_kw_m"] is None
        assert sitios[0]["estado_recurso"] == "pendiente"
        assert sitios[0]["estado_legal"] == "desconocido"
        LienzoMapa().dibujar()


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


def test_s3_10_el_mapa_rotula_pendiente_aunque_el_valor_sea_alto(aplicacion):
    with _sitios_reemplazados({"isla_fuerte.json": _ficha_con_j_pendiente(25.0)}):
        sitio = cargar_sitios()[0]
        assert sitio["j_kw_m"] is None
        assert sitio["estado_recurso"] == "pendiente"
        mapa = LienzoMapa()
        mapa.dibujar()
        assert "pendiente" in mapa.descripcion_sitio("isla_fuerte")


def test_s3_11_el_panel_no_puntua_con_un_j_pendiente(aplicacion):
    with _sitios_reemplazados({"isla_fuerte.json": _ficha_con_j_pendiente(25.0)}):
        panel = simular(Parametros(sitio_id="isla_fuerte"))["extras"]["panel_sitio"]
        energia = next(c for c in panel.criterios if "energia" in c.nombre)
        assert energia.cumple is False


def test_s3_12_mapa_y_panel_dicen_lo_mismo_del_mismo_dato(aplicacion):
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


def test_s3_13_batimetria_ausente_o_corrupta_degrada(aplicacion):
    from interfaz.mapa import RUTA_BATIMETRIA

    ruta = RAIZ / RUTA_BATIMETRIA
    respaldo = ruta.read_bytes()
    try:
        ruta.unlink()
        assert cargar_batimetria() == {}
        LienzoMapa().dibujar()
        ruta.write_bytes(b"lon,lat,profundidad_m\nno,es,numero\n")
        datos = cargar_batimetria()
        assert datos["lon"].size == 0
        LienzoMapa().dibujar()
    finally:
        ruta.write_bytes(respaldo)


def test_s3_14_serie_de_oleaje_ausente_deja_la_matriz_pendiente():
    from interfaz.calculo import serie_oleaje

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
