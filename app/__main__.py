"""Punto de entrada para `python -m app` y para el ejecutable empaquetado.

Llama a app.carcasa.lanzar_ventana() y propaga el codigo de salida. El spec de
PyInstaller usa este archivo como entry point; desde el repo, `python -m app`
abre la misma ventana.
"""

from __future__ import annotations

import sys

from app.carcasa import lanzar_ventana


if __name__ == "__main__":
    sys.exit(lanzar_ventana())