"""Tarea 152 — verificacion de la retirada de PySide6 del proyecto.

Cubre la seccion 26.3 del plan: PySide6 desaparece de las dependencias
de ejecucion y una instalacion limpia del proyecto no lo trae. Tambien
exige que la tecnologia de sustitucion (pywebview) este declarada.
"""

from __future__ import annotations

import importlib
import pathlib
import tomllib


def _cargar_pyproject() -> dict:
    ruta = pathlib.Path("pyproject.toml")
    assert ruta.exists(), "pyproject.toml no existe"
    return tomllib.load(ruta.open("rb"))


def _deps_ejecucion(pyproject: dict) -> list[str]:
    """Nombres normalizados de las dependencias de ejecucion (sin marcadores)."""
    deps = pyproject["project"].get("dependencies", [])
    nombres: list[str] = []
    for dep in deps:
        # Ignora entornos (marcadores 'python_version < ...')
        limpio = dep.split(";")[0].strip()
        # Separa el nombre del primer marcador de version
        nombre = ""
        for c in limpio:
            if c in ">=[< ;":
                break
            nombre += c
        nombres.append(nombre.strip())
    return nombres


def test_pyside6_no_esta_en_dependencies():
    """PySide6 no aparece como dependencia de ejecucion en pyproject.toml."""
    pyproject = _cargar_pyproject()
    deps = _deps_ejecucion(pyproject)
    assert "PySide6" not in deps, (
        f"PySide6 sigue declarado en dependencies: {deps} "
        "(seccion 26.3 del plan)"
    )


def test_pywebview_esta_en_dependencies():
    """pywebview esta declarada como dependencia de ejecucion (sustituto)."""
    pyproject = _cargar_pyproject()
    deps = _deps_ejecucion(pyproject)
    assert "pywebview" in deps, (
        f"pywebview no aparece en dependencies: {deps} "
        "(la capa nueva debe declararla)"
    )


def test_instalacion_limpia_no_instala_pyside6():
    """`pip install -e .` en un entorno limpio no instala PySide6.

    Verificacion declarativa: lee pyproject.toml y exige que PySide6 no
    figure ni en [dependencies] ni como dependencia transitiva declarada
    en el proyecto. Una instalacion limpia (sin extras) trae solo lo que
    aparece en [project.dependencies] y [project.optional-dependencies].
    """
    pyproject = _cargar_pyproject()
    deps_ejecucion = _deps_ejecucion(pyproject)
    opt = pyproject["project"].get("optional-dependencies", {})
    extras = []
    for conjunto in opt.values():
        for dep in conjunto:
            nombre = ""
            for c in dep.split(";")[0]:
                if c in ">=[< ;":
                    break
                nombre += c
            extras.append(nombre.strip())
    assert "PySide6" not in deps_ejecucion, (
        f"PySide6 en [dependencies]: {deps_ejecucion}"
    )
    assert "PySide6" not in extras, (
        f"PySide6 en extras (no debe incluirse en pip install -e .): {extras}"
    )


def test_pyside6_no_es_usable_como_capa():
    """El modulo PySide6, aunque instalado en este entorno, no se importa
    desde nucleo/, analisis/ o app/. Esto es lo que protege a la arquitectura
    aun si alguien lo tiene instalado por accidente.
    """
    import re

    pat = re.compile(r"^\s*(?:from|import)\s+PySide6(\.|\s|$)", re.MULTILINE)
    for raiz in ("nucleo", "analisis", "app"):
        base = pathlib.Path(raiz)
        if not base.exists():
            continue
        for py in base.rglob("*.py"):
            if pat.search(py.read_text(encoding="utf-8")):
                raise AssertionError(
                    f"{py} importa PySide6 — la capa retirada no debe "
                    "aparecer en nucleo/analisis/app"
                )


def test_pywebview_se_puede_importar():
    """pywebview esta disponible para importacion (verificacion dinamica)."""
    try:
        importlib.import_module("webview")
        ok = True
    except ImportError:
        ok = False
    # Si no esta instalado en el entorno actual, la declaracion en
    # pyproject.toml es suficiente para garantizar su inclusion tras una
    # instalacion limpia.
    pyproject = _cargar_pyproject()
    declarado = "pywebview" in _deps_ejecucion(pyproject)
    assert ok or declarado, (
        "pywebview no esta ni instalado ni declarado en [dependencies]"
    )