"""La capa de presentacion es la web (TS/Vue). matplotlib y seaborn no entran ahi.

La razon es trivial: la web es una build de Vite que produce un bundle JS/CSS
estatico que sirve ``app/servicio.py``; los ``import matplotlib`` o
``import seaborn`` son Python y nunca entran en el grafo de TS/Vue.

Estas pruebas blindan el invariante:
- ``web/package.json`` no lista matplotlib ni seaborn;
- ningun archivo ``.ts`` o ``.vue`` bajo ``web/src`` los importa;
- el bundle minificado en ``web/dist/assets/*.js`` no contiene los tokens.
"""

from __future__ import annotations

import json
import pathlib
import re

ROOT = pathlib.Path(__file__).resolve().parents[1]
WEB = ROOT / "web"
WEB_SRC = WEB / "src"
WEB_DIST_ASSETS = WEB / "dist" / "assets"
PACKAGE_JSON = WEB / "package.json"

PALABRAS_VETADAS: tuple[str, ...] = ("matplotlib", "seaborn")
PATRON_IMPORT = re.compile(r"\b(?:from\s+['\"]|require\(\s*['\"]?)(matplotlib|seaborn)\b", re.IGNORECASE)


def test_package_json_no_lista_matplotlib_ni_seaborn():
    data = json.loads(PACKAGE_JSON.read_text(encoding="utf-8"))
    candidatos: list[str] = []
    for clave in ("dependencies", "devDependencies", "peerDependencies"):
        candidatos.extend((data.get(clave) or {}).keys())
    texto = " ".join(candidatos).lower()
    for nombre in PALABRAS_VETADAS:
        assert nombre not in texto, (
            f"web/package.json lista {nombre!r}; la web no debe importar matplotlib ni seaborn"
        )


def _archivos_web() -> list[pathlib.Path]:
    if not WEB_SRC.exists():
        return []
    return [
        p for p in WEB_SRC.rglob("*")
        if p.is_file() and p.suffix.lower() in {".ts", ".vue", ".js"}
    ]


def test_archivos_web_no_importan_matplotlib_ni_seaborn():
    offenders: list[str] = []
    for f in _archivos_web():
        try:
            texto = f.read_text(encoding="utf-8")
        except UnicodeDecodeError:
            continue
        for match in PATRON_IMPORT.finditer(texto):
            offenders.append(f"{f}: importa {match.group(1)}")
    assert not offenders, (
        "archivos de la capa web importan bibliotecas de figuras Python:\n"
        + "\n".join(offenders)
    )


def _bundles() -> list[pathlib.Path]:
    if not WEB_DIST_ASSETS.exists():
        return []
    return sorted(WEB_DIST_ASSETS.glob("*.js"))


def test_bundle_dist_no_contiene_matplotlib_ni_seaborn():
    bundles = _bundles()
    if not bundles:
        # Sin build, la afirmacion no se puede demostrar empiricamente; el
        # test de ``package.json`` y el de ``web/src`` ya cubren la regla
        # en origen.
        import pytest

        pytest.skip("web/dist/assets/*.js no presente (build no generado)")
    offenders: list[str] = []
    for f in bundles:
        texto = f.read_text(encoding="utf-8", errors="ignore").lower()
        for nombre in PALABRAS_VETADAS:
            if nombre in texto:
                offenders.append(f"{f.name}: contiene {nombre!r}")
    assert not offenders, (
        "el bundle minificado contiene nombres de matplotlib/seaborn:\n"
        + "\n".join(offenders)
    )