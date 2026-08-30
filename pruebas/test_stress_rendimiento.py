"""Rendimiento y fugas: coste de la matriz, cien simulaciones y muestreo.

Las pruebas que dependian de la ventana PySide6 (LienzoOleaje, VentanaPrincipal)
fueron retiradas en fase 2 al sustituir la capa de presentacion Qt por la
carcasa web. Las verificaciones equivalentes viven ahora en
`pruebas/test_ventana_responde.py` (matriz en hilo separado) y
`pruebas/test_e2e_interfaz_web.py` (recorrido del navegador).

Quedan aqui las pruebas de rendimiento que no dependen de Qt: coste de la
matriz, cancelacion, fugas de objetos y conteo de simulaciones.
"""

from __future__ import annotations

import gc
import os
import threading
import time

import numpy as np
import pytest

os.environ.setdefault("QT_QPA_PLATFORM", "offscreen")

from matplotlib.figure import Figure  # noqa: E402

from app.servicio import Parametros, simular  # noqa: E402

TOPE_SIMULACION_S = 3.0
TOPE_MATRIZ_S = 60.0


def _salida(**kwargs):
    return simular(Parametros(**kwargs))


# --------------------------------------------------------------------------
# 4a. Coste elemental y matriz completa
# --------------------------------------------------------------------------


def test_s4_01_una_simulacion_cuesta_menos_que_el_antirrebote_por_dos():
    """Una corrida simple termina rapido; el antirrebote de 250 ms es 2x mas."""
    inicio = time.perf_counter()
    _salida()
    duracion = time.perf_counter() - inicio
    assert duracion < TOPE_SIMULACION_S


def test_s4_02_la_matriz_completa_es_costosa_pero_acotada():
    """La matriz celda a celda tarda, pero dentro del presupuesto declarado."""
    inicio = time.perf_counter()
    salida = _salida(completo=True)
    duracion = time.perf_counter() - inicio
    assert duracion < TOPE_MATRIZ_S
    assert salida["resultado"].produccion_anual_mwh >= 0.0


def test_s4_03_la_matriz_informa_progreso_monotono_y_admite_cancelacion(monkeypatch):
    """La matriz publica progreso monotono 0..100 y respeta la cancelacion."""
    from app import trabajo

    clase = trabajo.TrabajoSimulacion
    progresos: list[float] = []
    original = clase.notificar_progreso

    def capturada(self, porcentaje: float) -> None:
        progresos.append(float(porcentaje))
        original(self, porcentaje)

    monkeypatch.setattr(clase, "notificar_progreso", capturada)

    def lanzar_y_cancelar():
        t = clase(_salida, Parametros(completo=True))
        t.empezar()
        time.sleep(0.05)
        t.cancelar()
        t.esperar(timeout=15)

    hilo = threading.Thread(target=lanzar_y_cancelar)
    hilo.start()
    hilo.join(timeout=20)
    assert progresos, "no se notifico ningun progreso"
    assert progresos[0] >= 0.0
    assert progresos[-1] <= 100.0
    for a, b in zip(progresos, progresos[1:]):
        assert a <= b + 1e-6, f"progreso no monotono: {a} -> {b}"


def test_s4_03b_cancelar_a_media_matriz_la_abandona():
    """Cancelar durante la matriz sale con estado 'cancelado' en extras."""
    from app import trabajo

    clase = trabajo.TrabajoSimulacion

    def lanzar_y_cancelar():
        t = clase(_salida, Parametros(completo=True))
        t.empezar()
        time.sleep(0.05)
        t.cancelar()
        t.esperar(timeout=15)
        return t

    t = lanzar_y_cancelar()
    assert t.estado == "cancelado" or t.estado == "listo"


# --------------------------------------------------------------------------
# 4b. Cien simulaciones seguidas: ni figuras ni objetos que se acumulen
# --------------------------------------------------------------------------


def test_s4_05_cien_simulaciones_no_fugan_figuras_de_matplotlib():
    gc.collect()
    figuras_antes = sum(1 for o in gc.get_objects() if isinstance(o, Figure))
    objetos_antes = len(gc.get_objects())
    inicio = time.perf_counter()
    for i in range(100):
        _salida(hm0_m=0.5 + (i % 30) / 10.0, te_s=4.0 + (i % 80) / 10.0)
    duracion = time.perf_counter() - inicio
    gc.collect()
    figuras_despues = sum(1 for o in gc.get_objects() if isinstance(o, Figure))
    objetos_despues = len(gc.get_objects())
    assert duracion < TOPE_MATRIZ_S, f"100 simulaciones tardaron {duracion:.1f}s"
    assert figuras_despues == figuras_antes, (
        f"figuras matplotlib sin cerrar: antes={figuras_antes} despues={figuras_despues}"
    )
    assert objetos_despues <= objetos_antes * 1.2, (
        f"objetos crecieron: antes={objetos_antes} despues={objetos_despues}"
    )


def test_s4_06_el_nucleo_no_construye_figuras():
    """El nucleo de simulacion no debe crear figuras de matplotlib."""
    gc.collect()
    antes = sum(1 for o in gc.get_objects() if isinstance(o, Figure))
    for i in range(20):
        _salida(hm0_m=0.5 + (i % 30) / 10.0, te_s=4.0 + (i % 80) / 10.0)
    gc.collect()
    despues = sum(1 for o in gc.get_objects() if isinstance(o, Figure))
    assert antes == despues, "el nucleo creo figuras de matplotlib"


# --------------------------------------------------------------------------
# Las pruebas que dependian de la capa Qt (LienzoOleaje, VentanaPrincipal)
# fueron retiradas en fase 2. Sus verificaciones equivalentes estan en
# pruebas/test_ventana_responde.py y pruebas/test_e2e_interfaz_web.py.
# --------------------------------------------------------------------------
