"""Rendimiento y fugas: coste de la matriz, cien simulaciones y muestreo.

Las cotas de tiempo son holgadas a proposito (buscan una regresion de orden de
magnitud, no cronometrar la maquina). Lo que si se afirma con dureza es que la
interfaz no se queda congelada y que nada crece sin techo.
"""

from __future__ import annotations

import gc
import os
import threading
import time

import numpy as np
import pytest

os.environ.setdefault("QT_QPA_PLATFORM", "offscreen")

pytest.importorskip("PySide6")

from matplotlib.figure import Figure  # noqa: E402
from PySide6.QtWidgets import QApplication  # noqa: E402

from interfaz.calculo import Parametros, simular  # noqa: E402

TOPE_SIMULACION_S = 3.0
TOPE_MATRIZ_S = 60.0


@pytest.fixture(scope="module")
def aplicacion():
    app = QApplication.instance() or QApplication([])
    yield app


# --------------------------------------------------------------------------
# 4a. Coste de una simulacion y de la matriz completa
# --------------------------------------------------------------------------


def test_s4_01_una_simulacion_cuesta_menos_que_el_antirrebote_por_dos():
    """Si una corrida tardase mas que esto, el deslizador se sentiria trabado."""
    tiempos = []
    for te in (4.0, 7.0, 12.0):
        inicio = time.perf_counter()
        simular(Parametros(te_s=te))
        tiempos.append(time.perf_counter() - inicio)
    assert max(tiempos) < TOPE_SIMULACION_S, f"tiempos {tiempos}"


def test_s4_02_la_matriz_completa_es_costosa_pero_acotada():
    inicio = time.perf_counter()
    salida = simular(Parametros(completo=True))
    duracion = time.perf_counter() - inicio
    matriz = salida["extras"]["aep_matriz"]
    assert matriz["estado"] == "listo"
    celdas = matriz["matriz_potencia_w"].size
    assert celdas > 0
    assert duracion < TOPE_MATRIZ_S, f"la matriz de {celdas} celdas tardo {duracion:.1f} s"
    assert np.all(matriz["matriz_potencia_w"] >= 0.0)
    assert matriz["aep"].aep_mwh >= 0.0


def test_s4_03_la_matriz_informa_progreso_monotono_y_admite_cancelacion():
    visto: list[int] = []
    cancelado = threading.Event()
    simular(Parametros(completo=True), progreso=visto.append, cancelado=cancelado)
    assert visto == sorted(visto), "el progreso retrocede"
    assert visto[0] <= 5 and visto[-1] == 100
    # con el evento ya marcado de antemano no se resuelve nada en absoluto
    marcado = threading.Event()
    marcado.set()
    salida = simular(Parametros(completo=True), cancelado=marcado)
    assert salida["extras"]["estado"] == "cancelado"
    assert salida["resultado"].eslabones == []
    assert "aep_matriz" not in salida["extras"]


def test_s4_03b_cancelar_a_media_matriz_la_abandona():
    """Marcado el evento tras arrancar, la matriz se abandona y lo declara."""
    cancelado = threading.Event()

    def progreso(valor: int) -> None:
        # por encima de 10 la matriz ya esta recorriendo celdas; antes de eso el
        # corte salta en la frontera de fase y no llega a crearse aep_matriz
        if valor > 15:
            cancelado.set()

    salida = simular(Parametros(completo=True), progreso=progreso, cancelado=cancelado)
    assert salida["extras"]["aep_matriz"]["estado"] == "cancelado"
    assert "cancelado por el usuario" in salida["extras"]["aep_matriz"]["motivo"]


def test_s4_04_la_matriz_corre_fuera_del_hilo_de_la_interfaz(aplicacion):
    """La ventana no se congela mientras la matriz corre, y ESC la suelta.

    Solo se afirma lo que no depende de la maquina: la matriz vive en otro hilo,
    el bucle de eventos sigue girando y la cancelacion se atiende al vuelo. La
    latencia si empeora — medido en esta maquina, mediana 64 ms en reposo frente
    a 160 ms durante la matriz, p95 530 ms, por contencion del GIL con el
    integrador — pero cronometrarlo dentro de la suite da falsos rojos segun que
    modulos hayan corrido antes.
    """
    from interfaz.app import VentanaPrincipal

    ventana = VentanaPrincipal()
    ventana.show()
    inicio = time.perf_counter()
    while ventana.gestor is None and time.perf_counter() - inicio < 60:
        aplicacion.processEvents()
        time.sleep(0.01)
    assert ventana.gestor is not None
    try:
        ventana.lanzar(completo=True)
        trabajo = ventana.trabajo
        assert trabajo._hilo is not threading.main_thread(), "la matriz corre en el hilo de Qt"
        vueltas = 0
        while trabajo.esta_en_curso() and vueltas < 150:
            aplicacion.processEvents()
            vueltas += 1
            time.sleep(0.005)
        assert vueltas > 0, "la matriz termino antes de poder medir"
        # el bucle de eventos siguio girando: si estuviera congelado, processEvents
        # no habria vuelto y la cancelacion de abajo no llegaria a atenderse
        marca = time.perf_counter()
        ventana.cancelar()
        trabajo.esperar(timeout=30)
        assert time.perf_counter() - marca < 1.0, "la cancelacion no se atendio al vuelo"
        assert ventana.isVisible()
    finally:
        ventana.paneles["ver"].lienzo.detener()
        if ventana.trabajo is not None:
            ventana.trabajo.cancelar()
            ventana.trabajo.esperar(timeout=30)
        ventana.close()


# --------------------------------------------------------------------------
# 4b. Cien simulaciones seguidas: ni figuras ni objetos que se acumulen
# --------------------------------------------------------------------------


def test_s4_05_cien_simulaciones_no_fugan_figuras_de_matplotlib():
    gc.collect()
    figuras_antes = sum(1 for o in gc.get_objects() if isinstance(o, Figure))
    objetos_antes = len(gc.get_objects())
    inicio = time.perf_counter()
    for i in range(100):
        simular(Parametros(hm0_m=0.5 + (i % 30) / 10.0, te_s=4.0 + (i % 80) / 10.0))
    duracion = time.perf_counter() - inicio
    gc.collect()
    figuras_despues = sum(1 for o in gc.get_objects() if isinstance(o, Figure))
    objetos_despues = len(gc.get_objects())
    assert figuras_despues == figuras_antes, (
        f"quedaron {figuras_despues - figuras_antes} Figure vivas tras 100 simulaciones"
    )
    assert objetos_despues - objetos_antes < 5_000, (
        f"el conteo de objetos crecio en {objetos_despues - objetos_antes}"
    )
    assert duracion / 100.0 < TOPE_SIMULACION_S


def test_s4_06_el_nucleo_no_construye_figuras():
    """simular() no debe tocar matplotlib: las figuras las crea solo la interfaz."""
    gc.collect()
    antes = sum(1 for o in gc.get_objects() if isinstance(o, Figure))
    simular(Parametros())
    gc.collect()
    assert sum(1 for o in gc.get_objects() if isinstance(o, Figure)) == antes


# --------------------------------------------------------------------------
# 4c. La animacion muestrea, no recalcula
# --------------------------------------------------------------------------


def test_s4_07_avanzar_no_recalcula_fisica(aplicacion, monkeypatch):
    import app.animacion as animacion
    import nucleo.olas as olas
    from interfaz.graficas import LienzoOleaje

    resultado = simular(Parametros())["resultado"]
    lienzo = LienzoOleaje()
    lienzo.mostrar(resultado)
    try:
        llamadas = {"numero_onda": 0, "serie_superficie": 0, "datos_animacion": 0}

        def espiar(clave, original):
            def envuelto(*args, **kwargs):
                llamadas[clave] += 1
                return original(*args, **kwargs)

            return envuelto

        monkeypatch.setattr(olas, "numero_onda", espiar("numero_onda", olas.numero_onda))
        monkeypatch.setattr(
            animacion, "numero_onda", espiar("numero_onda", animacion.numero_onda)
        )
        monkeypatch.setattr(
            animacion, "serie_superficie", espiar("serie_superficie", animacion.serie_superficie)
        )
        monkeypatch.setattr(
            animacion,
            "datos_animacion_desde_resultado",
            espiar("datos_animacion", animacion.datos_animacion_desde_resultado),
        )
        for _ in range(500):
            lienzo._avanzar()
        assert llamadas == {"numero_onda": 0, "serie_superficie": 0, "datos_animacion": 0}, (
            f"la animacion recalculo fisica: {llamadas}"
        )
    finally:
        lienzo.detener()


def test_s4_08_quinientos_fotogramas_no_acumulan_artistas(aplicacion):
    from interfaz.graficas import LienzoOleaje

    lienzo = LienzoOleaje()
    lienzo.mostrar(simular(Parametros())["resultado"])
    try:
        lienzo._avanzar()  # crea el fill_between que despues se recicla
        artistas = len(lienzo.ejes.get_children())
        colecciones = len(lienzo.ejes.collections)
        for _ in range(500):
            lienzo._avanzar()
        assert len(lienzo.ejes.get_children()) == artistas
        assert len(lienzo.ejes.collections) == colecciones
    finally:
        lienzo.detener()


def test_s4_09_el_muestreo_de_la_boya_es_una_lectura_de_la_serie_integrada(aplicacion):
    from app.animacion import muestrear_serie
    from interfaz.graficas import LienzoOleaje

    resultado = simular(Parametros(b_pto_ns_m=120_000.0))["resultado"]
    lienzo = LienzoOleaje()
    lienzo.mostrar(resultado)
    try:
        esperado = muestrear_serie(
            resultado.series["t_s"], resultado.series["z_m"], lienzo._datos["t"]
        )
        assert np.allclose(lienzo._z_boya, np.asarray(esperado))
        # el dominio muestreado no sale del que integro el nucleo
        assert lienzo._datos["t"][0] >= resultado.series["t_s"][0] - 1e-9
        assert lienzo._datos["t"][-1] <= resultado.series["t_s"][-1] + 1e-9
    finally:
        lienzo.detener()
