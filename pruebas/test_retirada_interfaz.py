"""Tarea 151 — verificacion de la retirada de la capa de presentacion anterior.

Cubre la seccion 26.2 del plan: la presentacion en PySide6 se retira
del repositorio y la simulacion sigue siendo posible desde el servicio
sin abrir ninguna ventana ni importar Qt.
"""

from __future__ import annotations

import pathlib


def test_interfaz_no_existe():
    """El directorio `interfaz/` ya no esta presente en el sistema de archivos."""
    ruta = pathlib.Path("interfaz")
    assert not ruta.exists(), (
        f"interfaz/ aun existe tras la retirada: {ruta.resolve()} — "
        "la fase 26.2 obliga a retirarlo"
    )


def test_servicio_simula_sin_interfaz():
    """app.servicio.simular() funciona sin que exista la capa de presentacion."""
    from app.servicio import Parametros, simular

    salida = simular(Parametros())
    assert "resultado" in salida, "simular debe entregar un resultado"
    assert "extras" in salida, "simular debe entregar los extras del calculo"
    assert salida["resultado"].produccion_anual_mwh > 0.0, (
        "la simulacion por defecto debe producir energia positiva"
    )


def test_no_se_importa_interfaz_desde_app():
    """app/ no contiene imports estaticos de la capa retirada."""
    import re

    raiz = pathlib.Path("app")
    pat = re.compile(r"^\s*(?:from|import)\s+interfaz(\.|\s|$)", re.MULTILINE)
    for py in raiz.rglob("*.py"):
        if pat.search(py.read_text(encoding="utf-8")):
            raise AssertionError(
                f"{py} importa la capa retirada interfaz/ — "
                "toda la logica de servicio vive en app/servicio.py"
            )