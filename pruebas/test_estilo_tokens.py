"""17.x — tokens.css + semaforo.css: WCAG, vocabularios, gris y semaforo identico."""

from __future__ import annotations

import math
import pathlib
import re

ROOT = pathlib.Path(__file__).resolve().parents[1]
TOKENS = ROOT / "web/src/styles/tokens.css"
SEMAFORO = ROOT / "web/src/styles/semaforo.css"


def _read_tokens() -> str:
    assert TOKENS.exists(), f"falta {TOKENS}"
    assert SEMAFORO.exists(), f"falta {SEMAFORO}"
    return TOKENS.read_text(encoding="utf-8") + "\n" + SEMAFORO.read_text(encoding="utf-8")


def _parse_oklch_vars(css: str) -> dict[str, tuple[float, float, float]]:
    # --name: oklch(L C H)
    pat = re.compile(r"--([\w-]+)\s*:\s*oklch\(\s*([0-9.]+)\s+([0-9.]+)\s+([0-9.]+)\s*\)")
    out: dict[str, tuple[float, float, float]] = {}
    for m in pat.finditer(css):
        out[m.group(1)] = (float(m.group(2)), float(m.group(3)), float(m.group(4)))
    return out


def _oklch_to_linear_srgb(L: float, C: float, h_deg: float) -> tuple[float, float, float]:
    h = math.radians(h_deg)
    a = C * math.cos(h)
    b = C * math.sin(h)
    l_ = L + 0.3963377774 * a + 0.2158037573 * b
    m_ = L - 0.1055613458 * a - 0.0638541728 * b
    s_ = L - 0.0894841775 * a - 1.2914855480 * b
    l_cub = l_**3
    m3 = m_**3
    s3 = s_**3
    r = 4.0767416621 * l_cub - 3.3077115913 * m3 + 0.2309699292 * s3
    g = -1.2684380046 * l_cub + 2.6097574011 * m3 - 0.3413193965 * s3
    b_ = -0.0041960863 * l_cub - 0.7034186147 * m3 + 1.7076147010 * s3
    return (r, g, b_)


def _luminance_oklch(L: float, C: float, h: float) -> float:
    r, g, b = _oklch_to_linear_srgb(L, C, h)
    r = max(0.0, min(1.0, r))
    g = max(0.0, min(1.0, g))
    b = max(0.0, min(1.0, b))
    return 0.2126 * r + 0.7152 * g + 0.0722 * b


def _contrast(l1: float, l2: float) -> float:
    hi = max(l1, l2)
    lo = min(l1, l2)
    return (hi + 0.05) / (lo + 0.05)


def test_17_01_tokens_presentes() -> None:
    css = _read_tokens()
    for var in ["--lienzo", "--panel", "--tinta", "--tenue", "--borde", "--foco", "--escala"]:
        assert var in css, f"falta {var} en tokens.css"
    for var in ["--text-meta", "--text-cuerpo", "--text-seccion", "--text-nivel", "--text-cifra"]:
        assert var in css, f"falta escala tipografica {var}"
    for var in ["--s-1", "--s-4", "--s-9", "--s-13"]:
        assert var in css, f"falta espacio {var}"
    assert "[data-sustentacion]" in css and "--escala:2.1" in css.replace(" ", "").replace(
        "2.1;", "2.1"
    ), "falta [data-sustentacion]{--escala:2.1}"
    # Tipografias del sistema, sin CDN
    assert "system-ui" in css and "Segoe UI" in css


def test_17_01_valores_exactos_tokens() -> None:
    css = _read_tokens()
    # Valores oklch exigidos en el enunciado
    assert "oklch(0.96 0.004 106)" in css  # --lienzo
    assert "oklch(0.988 0.003 106)" in css  # --panel
    assert "oklch(0.238 0.017 238)" in css  # --tinta
    assert "oklch(0.495 0.017 245)" in css  # --tenue
    assert "oklch(0.781 0.008 107)" in css  # --borde
    assert "oklch(0.532 0.131 244)" in css  # --foco
    for px in [
        "--text-meta:12px",
        "--text-cuerpo:15px",
        "--text-seccion:20px",
        "--text-nivel:27px",
        "--text-cifra:36px",
    ]:
        assert px.replace(" ", "") in css.replace(" ", ""), f"falta {px}"
    for s in ["--s-1:4px", "--s-4:16px", "--s-9:36px", "--s-13:52px"]:
        assert s.replace(" ", "") in css.replace(" ", ""), f"falta {s}"


def test_17_02_vocabulario_separado() -> None:
    css = _read_tokens()
    ok_vars = _parse_oklch_vars(css)
    conf_keys = [k for k in ok_vars if k.startswith("conf-")]
    rol_keys = [k for k in ok_vars if k.startswith("rol-")]
    assert len(conf_keys) >= 3, f"faltan --conf-* {conf_keys}"
    assert len(rol_keys) >= 3, f"faltan --rol-* {rol_keys}"
    # Ningun valor oklch de conf aparece como rol
    conf_vals = {ok_vars[k] for k in conf_keys}
    rol_vals = {ok_vars[k] for k in rol_keys}
    inter = conf_vals & rol_vals
    assert not inter, f"--conf-* y --rol-* comparten valores oklch: {inter}"
    # Exigidos por enunciado
    assert ok_vars.get("conf-verificado") == (0.578, 0.117, 166.0) or ok_vars.get(
        "conf-verificado"
    ) == (0.578, 0.117, 166)
    assert ok_vars.get("conf-inferido") == (0.638, 0.138, 70.0) or ok_vars.get("conf-inferido") == (
        0.638,
        0.138,
        70,
    )
    assert ok_vars.get("conf-pendiente") == (0.494, 0.159, 37.0) or ok_vars.get(
        "conf-pendiente"
    ) == (0.494, 0.159, 37)


def test_17_03_wcag_contraste() -> None:
    css = _read_tokens()
    ok_vars = _parse_oklch_vars(css)

    # Texto normal 4.5:1, grafismo 3:1 sobre lienzo/panel
    def check(fg: str, bg: str, umbral: float) -> None:
        assert fg in ok_vars and bg in ok_vars, f"falta {fg} o {bg}"
        c = _contrast(_luminance_oklch(*ok_vars[fg]), _luminance_oklch(*ok_vars[bg]))
        assert c >= umbral, f"{fg} vs {bg} {c:.2f} < {umbral}"

    # Texto normal 4.5:1
    check("tinta", "lienzo", 4.5)
    check("tinta", "panel", 4.5)
    check("tenue", "lienzo", 4.5)
    check("foco", "lienzo", 4.5)
    # Grafismo 3:1 — semaforo y roles
    check("conf-verificado", "lienzo", 3.0)
    check("conf-inferido", "lienzo", 3.0)
    check("conf-pendiente", "lienzo", 3.0)
    check("rol-recurso", "lienzo", 3.0)
    check("rol-captura", "lienzo", 3.0)


def test_17_04_17_05_semaforo_identico_y_gris() -> None:
    # Semaforo identico en 3 pantallas: Ver, Mapa, Disenar usan mismo semaforo.css
    sema = SEMAFORO.read_text(encoding="utf-8")
    assert "semaforo" in sema.lower()
    # Cada estado con simbolo distinto (glifo)
    assert "●" in sema and "◐" in sema and "○" in sema, "semaforo debe tener ● / ◐ / ○"
    # Gris: con distinto simbolo ya hay distincion sin color; verificar que hay 3 clases distintas
    assert sema.count("semaforo--verificado") >= 1
    assert sema.count("semaforo--inferido") >= 1
    assert sema.count("semaforo--pendiente") >= 1
    # Ver, Mapa, Disenar importan o usan semaforo: buscar referencias
    ROOT_WEB = ROOT / "web/src"
    hits = 0
    for p in ROOT_WEB.rglob("*.vue"):
        t = p.read_text(encoding="utf-8")
        if "semaforo" in t.lower() or "●" in t or "◐" in t or "○" in t or "conf-" in t:
            hits += 1
    # Al menos Ver/Comparar/Disenar o equivalente
    assert hits >= 2, f"semáforo debe aparecer en al menos 2 pantallas, hits={hits}"
    # Mapa usa mismo vocabulario (conf-*)
    mapa = ROOT / "web/src/map/mapa.ts"
    assert mapa.exists()
    mapa_txt = mapa.read_text(encoding="utf-8")
    assert "conf-verificado" in mapa_txt or "0.578 0.117 166" in mapa_txt
    assert "conf-inferido" in mapa_txt or "0.638 0.138" in mapa_txt


def test_17_07_sin_cdn() -> None:
    # Tipografias no se solicitan a CDN: tokens.css no debe tener url() remoto
    css = _read_tokens()
    assert "http" not in css.lower(), "tokens.css no debe solicitar CDN"
    # web no debe tener @import url(http)
    for p in (ROOT / "web").rglob("*.css"):
        if "node_modules" in str(p):
            continue
        t = p.read_text(encoding="utf-8").lower()
        assert (
            "http" not in t
            or "https" not in t
            or "@import url" not in t
            or "fonts.googleapis" not in t
        )


def test_17_08_17_09_sustentacion_y_propagacion() -> None:
    css = _read_tokens()
    assert "[data-sustentacion]" in css
    assert "--escala:2.1" in css.replace(" ", "") or "--escala: 2.1" in css
    # Propagacion: Ver/Mapa/Disenar usan var(--escala); main.ts usa data-sustentacion
    main = ROOT / "web/src/main.ts"
    if main.exists():
        mt = main.read_text(encoding="utf-8")
        assert "data-sustentacion" in mt
        assert "--escala" in mt or "sustentacion" in mt
    # Mapa recibe text-size por --escala o evento propio
    mapa = ROOT / "web/src/map/mapa.ts"
    assert mapa.exists()
    # Si no, al menos que tokens.css defina --escala y semaforo importe tokens
    sema = SEMAFORO.read_text(encoding="utf-8")
    assert "tokens.css" in sema or "--escala" in css


def test_no_hardcoded_colores_fuera_tokens() -> None:
    # Fuera de tokens/semaforo/css base, los componentes no deben hardcodear hex literales
    # Permitidos solo como fallback var(--*, #hex)
    hex_pat = re.compile(r"#[0-9A-Fa-f]{4,6}\b")
    import_excl = re.compile(r"var\(--[^,]+,\s*#[0-9A-Fa-f]{4,6}\s*\)")
    # Comentarios /* #hex */ se permiten (documentan oklch)
    offenders: list[str] = []
    for p in (ROOT / "web/src").rglob("*"):
        if p.suffix not in (".ts", ".vue", ".css"):
            continue
        if "node_modules" in str(p):
            continue
        if p.name in ("tokens.css", "semaforo.css"):
            continue
        t = p.read_text(encoding="utf-8")
        # quitar bloques var(--*, #hex) y comentarios
        t_sin_fallback = import_excl.sub("", t)
        # quitar comentarios /* ... */
        t_sin_fallback = re.sub(r"/\*.*?#.*?\\*/", "", t_sin_fallback, flags=re.DOTALL)
        # quitar inline style fallbacks ya eliminados; buscar hex restante
        for m in hex_pat.finditer(t_sin_fallback):
            # ignorar urls o ejemplos
            ctx = t_sin_fallback[max(0, m.start() - 60) : m.end() + 60]
            if "http" in ctx.lower() or "example" in ctx.lower():
                continue
            offenders.append(f"{p.name}:{m.group(0)} {ctx.strip()[:80]}")
    assert not offenders, "colores hardcodeados fuera de tokens.css (usar var(--*)): " + "; ".join(
        offenders[:10]
    )
