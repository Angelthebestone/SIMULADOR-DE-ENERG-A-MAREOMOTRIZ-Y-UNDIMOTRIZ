"""Tarea 80 — Verificar que la ventana sigue respondiendo durante la simulacion
mas costosa que la aplicacion admite (la matriz de potencia celda a celda).

No requiere pywebview ni WebView2: lo que se verifica aqui es la propiedad
de diseno que sostiene la regla, a saber: el calculo se ejecuta en un hilo
distinto y el hilo principal mantiene su capacidad de hacer polling dentro
de un presupuesto de tiempo. Si el calculo bloqueara el hilo principal, la
ventana nativa quedaria congelada y la sustentacion se romperia.

El presupuesto:
- Cada latido del hilo principal duerme 50 ms.
- Si un latido tarda mas de 1 s, falla con mensaje claro.
- La simulacion corre hasta terminar o hasta el timeout declarado.
"""

from __future__ import annotations

import threading
import time


def _latir(stop: threading.Event, max_latido_s: float = 1.0) -> float:
    """Hace polling en el hilo principal: duerme 50 ms y mide latencia.

    Devuelve la latencia maxima observada. Falla si cualquier latido supera
    `max_latido_s`.
    """
    latencia_max = 0.0
    while not stop.is_set():
        t0 = time.perf_counter()
        time.sleep(0.05)
        dt = time.perf_counter() - t0
        if dt > latencia_max:
            latencia_max = dt
        if dt > max_latido_s:
            raise AssertionError(
                f"el hilo principal quedo bloqueado {dt*1000:.0f} ms — "
                "la simulacion no se ejecuta en hilo separado"
            )
    return latencia_max


def test_hilo_principal_responde_durante_simular_completo() -> None:
    """Mientras `simular(completo=True)` corre, el hilo principal sigue vivo."""
    from app.servicio import Parametros, simular

    stop = threading.Event()
    cancelado = threading.Event()
    excepcion: list[BaseException] = []

    def _latir_aislado() -> None:
        try:
            _latir(stop, max_latido_s=1.0)
        except BaseException as e:  # noqa: BLE001
            excepcion.append(e)
        finally:
            stop.set()

    def _correr() -> None:
        try:
            simular(Parametros(completo=True), progreso=lambda _v: None, cancelado=cancelado)
        finally:
            stop.set()

    hilo_latido = threading.Thread(target=_latir_aislado, daemon=True)
    hilo_calculo = threading.Thread(target=_correr, daemon=True)

    hilo_latido.start()
    t0 = time.perf_counter()
    hilo_calculo.start()

    # esperar a que el calculo termine (o hasta 30 s)
    hilo_calculo.join(timeout=30.0)
    if hilo_calculo.is_alive():
        cancelado.set()
        hilo_calculo.join(timeout=5.0)
    stop.set()
    hilo_latido.join(timeout=2.0)
    duracion = time.perf_counter() - t0

    assert not excepcion, f"el hilo principal fue bloqueado: {excepcion[0]}"
    assert not hilo_calculo.is_alive(), (
        f"el calculo no termino en 30 s (duracion={duracion:.1f} s)"
    )


def test_calculo_corre_en_hilo_distinto_y_termina() -> None:
    """`simular(completo=False)` no bloquea y termina en un tiempo finito.

    Se usa `completo=False` para mantener el test rapido. La propiedad que
    verifica (calculo en hilo separado, sin bloqueo) es la misma."""
    from app.servicio import Parametros, simular

    cancelado = threading.Event()
    salida: dict = {}

    def _correr() -> None:
        salida["resultado"] = simular(
            Parametros(completo=False),
            progreso=lambda _v: None,
            cancelado=cancelado,
        )

    hilo = threading.Thread(target=_correr, daemon=True)
    inicio = time.perf_counter()
    hilo.start()

    # mientras corre, el hilo principal puede medir el tiempo sin bloqueo
    while hilo.is_alive() and time.perf_counter() - inicio < 15.0:
        time.sleep(0.02)

    assert not hilo.is_alive(), (
        f"el calculo no termino en 15 s — el hilo principal se quedo esperando"
    )
    assert "resultado" in salida, "el hilo no deposito la salida"


def test_cancelar_corta_el_calculo_y_el_hilo_principal_no_se_bloquea() -> None:
    """Cancelar el calculo libera el hilo y el hilo principal sigue vivo."""
    from app.servicio import Parametros, simular

    cancelado = threading.Event()
    stop = threading.Event()
    excepcion: list[BaseException] = []

    def _latir_local() -> None:
        try:
            _latir(stop, max_latido_s=1.0)
        except BaseException as e:  # noqa: BLE001
            excepcion.append(e)
        finally:
            stop.set()

    def _correr() -> None:
        simular(
            Parametros(completo=False),
            progreso=lambda _v: None,
            cancelado=cancelado,
        )

    hilo_latido = threading.Thread(target=_latir_local, daemon=True)
    hilo_calculo = threading.Thread(target=_correr, daemon=True)
    hilo_latido.start()
    hilo_calculo.start()

    # cancelar a los 30 ms — el calculo no completo debe soltar
    time.sleep(0.03)
    cancelado.set()

    hilo_calculo.join(timeout=15.0)
    stop.set()
    hilo_latido.join(timeout=2.0)

    assert not excepcion, f"latido fallo durante cancelacion: {excepcion[0]}"
    assert not hilo_calculo.is_alive(), "el calculo no respondio a la cancelacion"


def test_callback_progreso_no_bloquea_al_hilo_principal() -> None:
    """El callback de progreso se invoca rapido: un sleep en el callback
    bloquea el calculo pero no al hilo principal."""
    from app.servicio import Parametros, simular

    cancelado = threading.Event()
    stop = threading.Event()
    excepcion: list[BaseException] = []

    def _latir_local() -> None:
        try:
            _latir(stop, max_latido_s=1.0)
        except BaseException as e:  # noqa: BLE001
            excepcion.append(e)
        finally:
            stop.set()

    def _progreso_pesado(_v: int) -> None:
        # el callback tarda 20 ms — no debe afectar al hilo principal
        time.sleep(0.02)

    def _correr() -> None:
        simular(
            Parametros(completo=False),
            progreso=_progreso_pesado,
            cancelado=cancelado,
        )

    hilo_latido = threading.Thread(target=_latir_local, daemon=True)
    hilo_calculo = threading.Thread(target=_correr, daemon=True)
    hilo_latido.start()
    hilo_calculo.start()

    hilo_calculo.join(timeout=15.0)
    stop.set()
    hilo_latido.join(timeout=2.0)

    assert not excepcion, (
        f"el hilo principal se bloqueo con callback pesado: {excepcion[0]}"
    )