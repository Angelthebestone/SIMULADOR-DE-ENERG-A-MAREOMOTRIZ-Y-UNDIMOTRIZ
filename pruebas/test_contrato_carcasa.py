"""Tarea 79 — Conectar el contrato a la carcasa y verificar extremo a extremo.

Estos tests comprueban que la API que `app/carcasa.py` expone a JavaScript
produce el contrato exacto que el diseno exige, sin delegar la verificacion
a la ventana nativa (que requiere pywebview y WebView2).

Se cubren tres puntos:
- Estructura del contrato: campos `parametros`, `resultado`, `series`,
  `series_meta`, `formulas`, `progreso`, `error`, `cancelado`, `payload_bytes`.
- Techo de tamano: una corrida completa queda por debajo de 200k bytes
  (la serializacion debe truncar si excede).
- Cancelacion: lanzar `simular(completo=True)` y disparar la cancelacion
  debe producir `cancelado=True` con `progreso < 100`.
"""

from __future__ import annotations

import threading
import time

import pytest


def _salida_ejemplo() -> dict:
    """Serializa un Parametros valido y devuelve el contrato."""
    from app.carcasa import api_simular

    return api_simular({"hm0_m": 1.5, "te_s": 7.0, "sitio_id": "isla_fuerte"})


def test_estructura_contrato_todos_los_campos() -> None:
    """El contrato devuelto por la API tiene los nueve campos exigidos."""
    contrato = _salida_ejemplo()
    for clave in (
        "parametros",
        "resultado",
        "series",
        "series_meta",
        "formulas",
        "progreso",
        "error",
        "cancelado",
        "payload_bytes",
    ):
        assert clave in contrato, f"falta la clave {clave!r} en el contrato"


def test_contrato_parametros_y_series_visibles() -> None:
    """Los parametros entran y las series llegan como listas."""
    contrato = _salida_ejemplo()
    assert contrato["parametros"]["hm0_m"] == pytest.approx(1.5)
    assert contrato["parametros"]["sitio_id"] == "isla_fuerte"
    assert "t_s" in contrato["series"]
    assert "z_m" in contrato["series"]
    assert isinstance(contrato["series"]["t_s"], list)
    assert isinstance(contrato["series"]["z_m"], list)


def test_contrato_techo_200k_bytes_en_corrida_completa() -> None:
    """Una corrida `completo=True` queda dentro del techo de 200k bytes."""
    from app.contrato import techo_bytes

    from app.carcasa import api_simular

    contrato = api_simular(
        {"hm0_m": 1.5, "te_s": 7.0, "sitio_id": "isla_fuerte", "completo": True}
    )
    assert contrato["payload_bytes"] <= techo_bytes, (
        f"payload {contrato['payload_bytes']} supera techo {techo_bytes}"
    )


def test_api_cancelar_marca_el_evento_y_el_contrato_lo_refleja() -> None:
    """`api_cancelar()` marca el evento global; un calculo en vuelo lo ve."""
    from app import carcasa

    # asegurar que arrancamos sin cancelacion pendiente
    assert not carcasa._CANCELACION.is_set()  # type: ignore[attr-defined]

    # arrancar un calculo en un hilo y cancelarlo casi inmediatamente
    salida: dict = {}
    listo = threading.Event()

    def _correr() -> None:
        try:
            salida["contrato"] = carcasa.api_simular(
                {"hm0_m": 1.5, "te_s": 7.0, "sitio_id": "isla_fuerte", "completo": True}
            )
        finally:
            listo.set()

    hilo = threading.Thread(target=_correr, daemon=True)
    hilo.start()
    # cancelar de inmediato — antes de que termine la integracion
    time.sleep(0.01)
    carcasa.api_cancelar()
    hilo.join(timeout=30)
    listo.wait(timeout=1)

    assert "contrato" in salida, "el calculo no devolvio contrato"
    assert salida["contrato"]["cancelado"] is True, (
        f"el contrato no refleja la cancelacion: {salida['contrato']['cancelado']!r}"
    )
    assert salida["contrato"]["progreso"] < 100.0, (
        f"el progreso deberia ser < 100 al cancelar, dio {salida['contrato']['progreso']}"
    )

    # limpiar el flag para que no afecte a otros tests
    carcasa._CANCELACION.clear()  # type: ignore[attr-defined]


def test_api_progreso_registra_listener() -> None:
    """`api_progreso(cb)` registra el callback sin lanzar."""
    from app import carcasa

    cb = lambda _v: None  # noqa: E731
    longitud_antes = len(carcasa._PROGRESO_LISTENERS)  # type: ignore[attr-defined]
    carcasa.api_progreso(cb)
    assert len(carcasa._PROGRESO_LISTENERS) == longitud_antes + 1
    # limpiar para no acumular listeners entre tests
    carcasa._PROGRESO_LISTENERS.clear()  # type: ignore[attr-defined]


def test_api_simular_con_parametros_invalidos_no_explota() -> None:
    """Parametros fuera de rango se acotan internamente; el contrato igual se emite."""
    from app.carcasa import api_simular

    contrato = api_simular({"hm0_m": -50.0, "te_s": 9999.0})
    assert contrato["error"] is None or isinstance(contrato["error"], str)
    assert isinstance(contrato["payload_bytes"], int)


def test_lanzar_ventana_sin_pywebview_mensaje_claro() -> None:
    """Sin pywebview instalado, `lanzar_ventana()` falla ruidosamente."""
    from app import carcasa

    # `lanzar_ventana` intenta `import webview`. Si no esta, lanza RuntimeError
    # con mensaje util. Verificamos el comportamiento a traves de un mock
    # ligero para no depender del entorno.
    import builtins
    real_import = builtins.__import__

    def _import_bloqueado(name: str, *args: object, **kwargs: object) -> object:
        if name == "webview" or name.startswith("webview"):
            raise ImportError("pywebview no instalado en este CI")
        return real_import(name, *args, **kwargs)

    builtins.__import__ = _import_bloqueado  # type: ignore[assignment]
    try:
        with pytest.raises(RuntimeError, match="pywebview"):
            carcasa.lanzar_ventana()
    finally:
        builtins.__import__ = real_import  # type: ignore[assignment]