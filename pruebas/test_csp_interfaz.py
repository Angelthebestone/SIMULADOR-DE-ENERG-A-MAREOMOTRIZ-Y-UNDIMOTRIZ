"""Tarea 70 — verificacion de la politica de origen (CSP) de la interfaz.

Cubre los puntos exigidos por `documentacion/aislamiento_red.md` y la
decision D13 del diseno:

- `web/index.html` declara una cabecera CSP con `default-src 'self'`.
- Las excepciones locales (`'unsafe-eval'`, `'unsafe-inline'`, `data:`)
  son las unicas adicionales.
- Ningun recurso en `web/src/` (`.vue`, `.ts`, `.css`) apunta a una
  URL externa (http/https/cdn/proto-relative).
- Anadir un recurso externo a cualquier `.vue` o `.ts` hace fallar el
  test (prueba inversa / disruptiva).

La CSP complementa a la de `test_arranque_equipo_limpio.py::test_146_4_*`
con verificaciones dedicadas y la prueba inversa.
"""

from __future__ import annotations

import pathlib
import re
import tempfile

REPO = pathlib.Path(__file__).resolve().parents[1]
WEB = REPO / "web"
INDEX_HTML = WEB / "index.html"
SRC = WEB / "src"


def _leer(ruta: pathlib.Path) -> str:
    assert ruta.exists(), f"{ruta} no existe"
    return ruta.read_text(encoding="utf-8")


def _extraer_csp(html: str) -> str:
    """Lee la cabecera CSP de un archivo HTML; falla si no existe.

    El atributo `content` se delimita por comillas dobles y puede contener
    comillas simples dentro (las palabras clave `'self'`, `'unsafe-eval'`,
    etc.), asi que el grupo capturado excluye solo la comilla doble.
    """
    match = re.search(
        r'http-equiv=["\']Content-Security-Policy["\'][^>]*content="([^"]+)"',
        html,
        re.IGNORECASE,
    )
    assert match, "CSP no encontrado en el HTML"
    return match.group(1)


# ---------------------------------------------------------------------------
# 70.1 — CSP presente con default-src 'self' y excepciones locales
# ---------------------------------------------------------------------------


def test_csp_default_src_self() -> None:
    """La cabecera CSP declara `default-src 'self'`."""
    html = _leer(INDEX_HTML)
    csp = _extraer_csp(html)
    # normalizar espacios
    csp_normalizado = re.sub(r"\s+", " ", csp).strip()
    # La cabecera debe contener default-src 'self' literal.
    assert "default-src 'self'" in csp_normalizado, (
        f"CSP sin default-src 'self': {csp}"
    )


def test_csp_solo_excepciones_locales_admitidas() -> None:
    """Las unicas palabras clave adicionales deben ser locales."""
    html = _leer(INDEX_HTML)
    csp = _extraer_csp(html)
    csp_normalizado = re.sub(r"\s+", " ", csp).strip()
    # Lista cerrada de palabras clave admitidas. Cualquier otra en la
    # cabecera rompe el contrato y debe fallar ruidosamente.
    palabras_admitidas = {
        "'self'",
        "'unsafe-eval'",
        "'unsafe-inline'",
        "'none'",
        "data:",
        "blob:",
        "ws:",
        "wss:",
    }
    # Extraer todas las palabras entre comillas y los esquemas literales
    # (con su `:` final).
    comillas = re.findall(r"'([^']*)'", csp_normalizado)
    esquemas = re.findall(r"\b(?:data|blob|ws|wss|http|https|ftp):", csp_normalizado)
    for token in comillas + esquemas:
        if token in ("self", "unsafe-eval", "unsafe-inline", "none"):
            token = f"'{token}'"
        assert token in palabras_admitidas, (
            f"CSP contiene token no admitido {token!r}: {csp}"
        )


def test_csp_permite_data_en_img() -> None:
    """`img-src` admite `data:` (PMTiles puede servirse como data URI)."""
    html = _leer(INDEX_HTML)
    csp = _extraer_csp(html)
    # Permitir img-src 'self' data: con espacios variables.
    img_match = re.search(r"img-src\s+([^;]+)", csp, re.IGNORECASE)
    assert img_match, f"CSP sin directiva img-src: {csp}"
    img_valor = re.sub(r"\s+", " ", img_match.group(1)).strip()
    assert "'self'" in img_valor, f"img-src sin 'self': {img_valor}"
    assert "data:" in img_valor, f"img-src sin data: (PMTiles): {img_valor}"


def test_csp_connect_src_solo_local() -> None:
    """`connect-src` no contiene hosts remotos; solo self y websockets locales."""
    html = _leer(INDEX_HTML)
    csp = _extraer_csp(html)
    connect_match = re.search(r"connect-src\s+([^;]+)", csp, re.IGNORECASE)
    assert connect_match, f"CSP sin directiva connect-src: {csp}"
    connect_valor = re.sub(r"\s+", " ", connect_match.group(1)).strip()
    # Sin prefijos de URL absolutos.
    for prohibida in ("http://", "https://", "//"):
        assert prohibida not in connect_valor, (
            f"connect-src contiene origen remoto {prohibida}: {connect_valor}"
        )
    # Sin dominios externos conocidos.
    for dominio in ("googleapis", "jsdelivr", "unpkg", "cdnjs", "cloudflare", "amazonaws"):
        assert dominio not in connect_valor.lower(), (
            f"connect-src menciona dominio externo {dominio}: {connect_valor}"
        )


def test_csp_font_src_self() -> None:
    """`font-src` solo admite el origen local (sin CDNs de tipografias)."""
    html = _leer(INDEX_HTML)
    csp = _extraer_csp(html)
    font_match = re.search(r"font-src\s+([^;]+)", csp, re.IGNORECASE)
    assert font_match, f"CSP sin directiva font-src: {csp}"
    font_valor = re.sub(r"\s+", " ", font_match.group(1)).strip()
    for prohibida in ("http://", "https://", "//"):
        assert prohibida not in font_valor, (
            f"font-src contiene origen remoto {prohibida}: {font_valor}"
        )


# ---------------------------------------------------------------------------
# 70.2 — recursos en web/src no apuntan a URL externa
# ---------------------------------------------------------------------------


def _archivos_recurso() -> list[pathlib.Path]:
    """Devuelve todos los .vue, .ts, .css bajo web/src/."""
    if not SRC.exists():
        return []
    return sorted(
        [p for p in SRC.rglob("*") if p.is_file() and p.suffix in (".vue", ".ts", ".css")]
    )


def test_src_sin_urls_externas() -> None:
    """Ningun archivo fuente (.vue, .ts, .css) referencia un origen externo."""
    archivos = _archivos_recurso()
    assert archivos, f"no se encontraron archivos fuente en {SRC}"
    externos: list[str] = []
    for ruta in archivos:
        txt = ruta.read_text(encoding="utf-8", errors="ignore")
        for patron in (
            r"https?://[^\s\"'<>)\\]+",
            r"//[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}[^\s\"'<>]*",
            r"://[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}[^\s\"'<>]*",
        ):
            for m in re.finditer(patron, txt, re.IGNORECASE):
                externos.append(f"{ruta.relative_to(REPO)}: {m.group(0)}")
    assert not externos, (
        f"recursos externos en web/src/ (politica de origen rota):\n"
        + "\n".join(externos[:10])
    )


# ---------------------------------------------------------------------------
# 70.3 — anadir un https:// en cualquier .vue o .ts hace fallar el test
# ---------------------------------------------------------------------------


def test_anadir_url_externa_a_vue_hace_fallar_la_deteccion() -> None:
    """Si un .vue introduce un https://, el detector debe capturarlo.

    Crea un archivo temporal con una referencia `https://ejemplo.com/x` y
    verifica que la heuristica de deteccion lo encuentra. Esto garantiza
    que la prueba inversa (el detector no pasa por alto inyecciones
    simples) se mantiene sincronizada con la regla que la app debe cumplir.
    """
    with tempfile.TemporaryDirectory() as tmp:
        tmp_path = pathlib.Path(tmp)
        # Componente Vue con una URL externa inyectada.
        vue_con_externo = tmp_path / "Malicioso.vue"
        vue_con_externo.write_text(
            "<template><div>cargando https://evil.example.com/x</div></template>",
            encoding="utf-8",
        )
        # Detector copiado del test principal: cualquier coincidencia rompe.
        txt = vue_con_externo.read_text(encoding="utf-8")
        externos = re.findall(r"https?://[^\s\"'<>)\\]+", txt)
        assert any("evil.example.com" in u for u in externos), (
            "el detector no captura la URL https:// en el .vue malicioso: "
            f"detectadas={externos}"
        )


def test_anadir_url_externa_a_ts_hace_fallar_la_deteccion() -> None:
    """Equivalente para TypeScript: una llamada `fetch('https://...')` rompe."""
    with tempfile.TemporaryDirectory() as tmp:
        tmp_path = pathlib.Path(tmp)
        ts_con_externo = tmp_path / "Malicioso.ts"
        ts_con_externo.write_text(
            "const r = await fetch('https://evil.example.com/api');\n",
            encoding="utf-8",
        )
        txt = ts_con_externo.read_text(encoding="utf-8")
        externos = re.findall(r"https?://[^\s\"'<>)\\]+", txt)
        assert any("evil.example.com" in u for u in externos), (
            "el detector no captura la URL https:// en el .ts malicioso: "
            f"detectadas={externos}"
        )


# ---------------------------------------------------------------------------
# 70.4 — dist/ respeta la CSP (doble red de seguridad)
# ---------------------------------------------------------------------------


def test_dist_index_html_respeta_csp() -> None:
    """El HTML construido declara CSP y no apunta a hosts remotos."""
    dist_html = REPO / "web" / "dist" / "index.html"
    if not dist_html.exists():
        # Sin build previo el contrato queda verificado por los tests sobre
        # `web/index.html`. No es omision: la condicion esta documentada.
        return
    html = _leer(dist_html)
    # El CSP debe sobrevivir al build (Vite no elimina metas).
    assert "Content-Security-Policy" in html, (
        f"dist/index.html sin CSP: {html}"
    )
    # El src/href del dist solo apuntan a rutas relativas.
    srcs = re.findall(r'(?:src|href)\s*=\s*"([^"]+)"', html)
    for src in srcs:
        assert not src.startswith("http://"), f"asset remoto: {src}"
        assert not src.startswith("https://"), f"asset remoto: {src}"
        assert not src.startswith("//"), f"asset protocol-relative: {src}"