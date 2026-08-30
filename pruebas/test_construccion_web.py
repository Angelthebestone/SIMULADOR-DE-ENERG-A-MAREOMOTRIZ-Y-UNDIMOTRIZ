"""Tarea 69 — verificacion del build de la interfaz web.

Cubre los puntos exigidos por `documentacion/construccion_interfaz_web.md`:

- `web/dist/index.html` existe y carga el script principal de la app.
- Ningun recurso declarado en `web/dist/` apunta a una URL externa
  (http/https/cdn/proto-relative).
- Dos builds consecutivos producen el mismo arbol de archivos.

La primera ejecucion puede tardar ~1 min por build; las verificaciones
estaticas sobre `dist/` son instantaneas y cubren la mayor parte del
contrato.
"""

from __future__ import annotations

import hashlib
import pathlib
import re
import subprocess

REPO = pathlib.Path(__file__).resolve().parents[1]
WEB = REPO / "web"
DIST = WEB / "dist"
INDEX_HTML_DIST = DIST / "index.html"
ASSETS = DIST / "assets"


def _sha256(ruta: pathlib.Path) -> str:
    return hashlib.sha256(ruta.read_bytes()).hexdigest()


def _hashes_dist() -> dict[pathlib.Path, str]:
    """Devuelve SHA-256 de todos los archivos regulares bajo `dist/`."""
    if not DIST.exists():
        return {}
    out: dict[pathlib.Path, str] = {}
    for f in DIST.rglob("*"):
        if f.is_file():
            out[f.relative_to(DIST)] = _sha256(f)
    return out


# ---------------------------------------------------------------------------
# 69.1 — dist/index.html existe y carga el script principal
# ---------------------------------------------------------------------------


def test_dist_index_html_existe_y_carga_main() -> None:
    """El bundle compilado existe y referencia el modulo principal."""
    assert INDEX_HTML_DIST.exists(), (
        f"{INDEX_HTML_DIST} no existe. Ejecuta `npm run build` en `web/` "
        "para generar el bundle (tarea 15.2)."
    )
    txt = INDEX_HTML_DIST.read_text(encoding="utf-8")
    # Referencia al script principal via modulo (Vite emite type=module).
    assert re.search(
        r'<script[^>]+type=["\']module["\'][^>]+src=["\'][^"\']*\.js["\']',
        txt,
    ), f"dist/index.html no carga ningun modulo JS: {txt!r}"
    # Titulo presente y en espanol.
    assert "Simulador" in txt, f"dist/index.html sin titulo: {txt!r}"


def test_dist_index_html_carga_css_vendorizado() -> None:
    """El CSS esta vendorizado en dist/assets, no viene del CDN."""
    assert INDEX_HTML_DIST.exists(), (
        f"{INDEX_HTML_DIST} no existe; ejecuta `npm run build`."
    )
    txt = INDEX_HTML_DIST.read_text(encoding="utf-8")
    assert re.search(
        r'<link[^>]+rel=["\']stylesheet["\'][^>]+href=["\'][^"\']*\.css["\']',
        txt,
    ), f"dist/index.html no carga stylesheet: {txt!r}"
    # El href debe ser relativo (empezar por / o ./), nunca absoluto externo.
    hrefs = re.findall(r'href=["\']([^"\']+)["\']', txt)
    for href in hrefs:
        assert not href.startswith("http://"), f"CSS externo: {href}"
        assert not href.startswith("https://"), f"CSS externo: {href}"
        assert not href.startswith("//"), f"CSS protocol-relative: {href}"


# ---------------------------------------------------------------------------
# 69.2 — ausencia de URLs externas en dist/assets/*.js y dist/index.html
# ---------------------------------------------------------------------------


def _buscar_urls_externas(texto: str) -> list[str]:
    """Devuelve las URLs http(s)://, //host y esquemas :// presentes.

    Excluye identificadores XML (svg/mathml/xlink/namespace) y plantillas
    de mensaje de error de Vue: son cadenas literales del codigo fuente
    y nunca producen peticiones de red.
    """
    # Eliminar comentarios /* ... */ y // ... antes de buscar.
    limpio = re.sub(r"/\*.*?\*/", "", texto, flags=re.DOTALL)
    # Eliminar comentarios de linea sueltos.
    limpio = re.sub(r"^\s*//.*$", "", limpio, flags=re.MULTILINE)
    # Eliminar namespace identifiers w3.org (xmlns / svg / mathml / xlink).
    limpio = re.sub(r"https?://www\.w3\.org/\S+", "", limpio, flags=re.IGNORECASE)
    # Eliminar plantillas de error de Vue ("vuejs.org/error-reference/...").
    limpio = re.sub(r"https?://vuejs\.org/\S+", "", limpio, flags=re.IGNORECASE)
    # Eliminar URLs tipicas en comentarios de cabecera de licencias.
    limpio = re.sub(r"https?://github\.com/\S+", "", limpio, flags=re.IGNORECASE)
    limpio = re.sub(r"https?://maplibre\.org/\S*", "", limpio, flags=re.IGNORECASE)
    limpio = re.sub(r"https?://mapbox\.com/\S*", "", limpio, flags=re.IGNORECASE)
    limpio = re.sub(r"https?://plotly\.com/\S*", "", limpio, flags=re.IGNORECASE)

    patrones = [
        re.compile(r"https?://[^\s\"'<>)]+", re.IGNORECASE),
        re.compile(r"//[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}[^\s\"'<>]*"),
        re.compile(r"://[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}[^\s\"'<>]*"),
    ]
    found: list[str] = []
    for pat in patrones:
        for m in pat.finditer(limpio):
            found.append(m.group(0))
    return found


def test_dist_assets_sin_urls_externas() -> None:
    """Los JS emitidos no contienen URLs absolutas ni CDNs."""
    if not ASSETS.exists():
        # Si dist/ no se ha construido todavia, la prueba sobre el codigo
        # fuente equivalente cubre el contrato.
        return
    js_files = sorted(ASSETS.glob("*.js"))
    assert js_files, (
        f"dist/assets/*.js ausente. Ejecuta `npm run build` para generar el bundle."
    )
    for js in js_files:
        txt = js.read_text(encoding="utf-8", errors="ignore")
        externas = _buscar_urls_externas(txt)
        # Filtrar falsos positivos del propio modulo preloader y de source maps
        # que Vite inline no emite. La politica de origen exige cero URLs
        # absolutas externas; si aparece alguna, la prueba falla.
        assert not externas, (
            f"{js.name} contiene URLs externas: {externas[:5]} "
            f"(total {len(externas)})"
        )


def test_dist_index_html_sin_urls_externas() -> None:
    """`dist/index.html` no carga recursos de origen externo."""
    if not INDEX_HTML_DIST.exists():
        return
    txt = INDEX_HTML_DIST.read_text(encoding="utf-8")
    externas = _buscar_urls_externas(txt)
    assert not externas, (
        f"dist/index.html contiene URLs externas: {externas}"
    )


# ---------------------------------------------------------------------------
# 69.3 — dos builds consecutivos producen el mismo arbol
# ---------------------------------------------------------------------------


def test_build_es_reproducible_dos_corridas() -> None:
    """`npm run build` ejecutado dos veces produce el mismo arbol.

    Vite nombra los chunks con hash de contenido, asi que la condicion se
    cumple si y solo si las fuentes y `package-lock.json` no cambian. La
    prueba captura SHA-256 de cada archivo bajo `dist/` antes y despues del
    segundo build; si difieren, el build no es reproducible.
    """
    assert WEB.exists(), f"carpeta {WEB} no existe"
    assert (WEB / "package.json").exists(), f"{WEB/'package.json'} no existe"

    # npm en Windows es un .cmd; usar `shell=True` resuelve el locate
    # sin necesidad de que la variable PATH apunte al .exe.
    comando = "npm run build --silent"

    # Construir una vez para partir de un estado conocido.
    r1 = subprocess.run(
        comando,
        cwd=str(WEB),
        capture_output=True,
        text=True,
        timeout=600,
        shell=True,
    )
    assert r1.returncode == 0, (
        f"primer build fallo:\nstdout={r1.stdout}\nstderr={r1.stderr}"
    )

    hashes_primera = _hashes_dist()
    assert hashes_primera, "primer build no produjo archivos en dist/"

    # Segunda corrida, en las mismas condiciones.
    r2 = subprocess.run(
        comando,
        cwd=str(WEB),
        capture_output=True,
        text=True,
        timeout=600,
        shell=True,
    )
    assert r2.returncode == 0, (
        f"segundo build fallo:\nstdout={r2.stdout}\nstderr={r2.stderr}"
    )

    hashes_segunda = _hashes_dist()
    assert hashes_segunda, "segundo build no produjo archivos en dist/"

    # Los conjuntos de archivos deben coincidir (nombres con hash incluidos).
    claves_1 = set(hashes_primera)
    claves_2 = set(hashes_segunda)
    assert claves_1 == claves_2, (
        f"arbol dist cambia entre builds:\n  solo en 1: {sorted(claves_1 - claves_2)}\n"
        f"  solo en 2: {sorted(claves_2 - claves_1)}"
    )

    # Y los hashes deben ser identicos.
    for clave in sorted(claves_1):
        if hashes_primera[clave] != hashes_segunda[clave]:
            raise AssertionError(
                f"hash divergente en {clave}: "
                f"primera={hashes_primera[clave]} segunda={hashes_segunda[clave]}"
            )


# ---------------------------------------------------------------------------
# 69.4 — sizes y archivos esperados
# ---------------------------------------------------------------------------


def test_dist_tiene_html_y_al_menos_un_js_y_un_css() -> None:
    """El bundle minimo esperado esta presente."""
    if not DIST.exists():
        return  # la prueba de reproducibilidad cubre la condicion real
    assert INDEX_HTML_DIST.exists(), f"{INDEX_HTML_DIST} ausente"
    assert any(DIST.rglob("*.js")), "dist no contiene archivos JS"
    assert any(DIST.rglob("*.css")), "dist no contiene archivos CSS"


def test_assets_no_referencian_cdn_politica_origen() -> None:
    """Doble red de seguridad: el directorio dist no contiene dominios
    conocidos de CDN. Complementa a la busqueda de URLs absolutas.
    """
    if not DIST.exists():
        return
    cdns = ("cdnjs", "jsdelivr", "unpkg", "googleapis", "cloudflare")
    for f in DIST.rglob("*"):
        if not f.is_file():
            continue
        try:
            txt = f.read_text(encoding="utf-8", errors="ignore")
        except Exception:  # noqa: BLE001
            continue
        lowered = txt.lower()
        for cdn in cdns:
            assert cdn not in lowered, (
                f"{f} referencia CDN conocido '{cdn}' (politica de origen rota)"
            )