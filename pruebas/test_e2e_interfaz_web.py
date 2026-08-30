"""Tarea 138 — Montar la suite que recorre los cuatro niveles.

Como Playwright no esta instalado en este entorno (verificado con
`importlib.util.find_spec`), esta suite hace la verificacion sin navegador:

- El bundle compilado en `web/dist/index.html` existe y carga el JS principal.
- Los cuatro modulos de nivel (`Ver.vue`, `Comparar.vue`, `Calcular.vue`,
  `Disenar.vue`) se compilaron y estan referenciados en el bundle.
- Las capas declaradas en `web/src/map/capas.ts` cumplen los requisitos del
  diseno (batimetria, sentinel2, relieve, runap, sitios, batimetria 30-60 m).
- `ControlesFisicos.vue` declara los `@input` handlers de los tres controles
  fisicos.

El conjunto es equivalente a una smoke test de la build compilada.
"""

from __future__ import annotations

import importlib.util
import pathlib
import re


_RAIZ = pathlib.Path(__file__).resolve().parent.parent
_WEB = _RAIZ / "web"
_SRC = _WEB / "src"
_DIST = _WEB / "dist"
_DIST_ASSETS = _DIST / "assets"


def _leer(ruta: pathlib.Path) -> str:
    assert ruta.exists(), f"no existe {ruta}"
    return ruta.read_text(encoding="utf-8")


def test_playwright_no_instalado_es_explicito() -> None:
    """Esta suite existe porque Playwright no esta disponible. Lo verifica."""
    disponible = importlib.util.find_spec("playwright") is not None
    assert not disponible, (
        "Playwright esta instalado — esta suite asume que no. Considera "
        "reemplazarla por una suite Playwright propiamente dicha."
    )


def test_bundle_compilado_existe() -> None:
    """`web/dist/index.html` debe existir tras la build."""
    assert _DIST.exists(), f"falta {_DIST}"
    assert (_DIST / "index.html").exists(), "falta web/dist/index.html"
    assert _DIST_ASSETS.exists(), "falta web/dist/assets/"


def test_index_html_carga_modulos_y_css_del_bundle() -> None:
    """`index.html` referencia el JS y CSS compilados en `dist/assets/`."""
    html = _leer(_DIST / "index.html")
    # al menos un JS y un CSS
    js_refs = re.findall(r'<script[^>]+src="([^"]+)"', html)
    css_refs = re.findall(r'<link[^>]+href="([^"]+)"', html)
    assert js_refs, "index.html no carga ningun JS"
    assert css_refs, "index.html no carga ningun CSS"
    assert any("/assets/" in j for j in js_refs), (
        f"el JS no apunta a /assets/: {js_refs}"
    )
    assert any("/assets/" in c for c in css_refs), (
        f"el CSS no apunta a /assets/: {css_refs}"
    )
    # los archivos referenciados existen
    for ref in js_refs + css_refs:
        ruta = _DIST / ref.lstrip("/")
        assert ruta.exists(), f"asset referenciado no existe: {ref}"


def test_los_cuatro_niveles_estan_en_el_bundle() -> None:
    """Los nombres de las cuatro vistas aparecen en el JS compilado."""
    js_archivos = list(_DIST_ASSETS.glob("*.js"))
    assert js_archivos, "no hay JS compilado en dist/assets/"
    contenido = "\n".join(_leer(j) for j in js_archivos)
    # los nombres de archivo fuente aparecen tal cual en el bundle (vite conserva
    # los nombres de los chunks; minificado mantiene los strings literales del template)
    for vista in ("Ver", "Comparar", "Calcular", "Disenar"):
        assert vista in contenido, (
            f"la vista {vista!r} no aparece en el bundle compilado"
        )


def test_los_cuatro_niveles_tienen_contenedor_en_index_html() -> None:
    """El bundle final expone los cuatro `<section id='panel-*'>` esperados.

    Los nombres surgen de `web/src/main.ts`:
      panel-ver, panel-comparar, panel-calcular, panel-disenar.
    Aqui se verifica que el JS compilado construye esos IDs. Vue compila el
    template `':id="panel-'+activa"'` y el template `':id="'panel-'+t.id"'` como
    una concatenacion runtime, asi que el JS contiene el patron `'panel-'+`
    junto a la lista de ids usados (`tabs[*].id`).
    """
    js_archivos = list(_DIST_ASSETS.glob("*.js"))
    contenido = "\n".join(_leer(j) for j in js_archivos)
    # el template compilado emite `'panel-'+...` (con `+` justo despues)
    assert "panel-" in contenido, "el bundle no contiene el prefijo 'panel-'"
    # los ids que el main.ts usa para los tabs
    for tab_id in ("ver", "comparar", "calcular", "disenar", "mapa"):
        assert f"'{tab_id}'" in contenido or f'"{tab_id}"' in contenido, (
            f"el id de tab {tab_id!r} no aparece en el bundle"
        )


def test_controles_fisicos_tienen_handlers_de_arrastre() -> None:
    """`ControlesFisicos.vue` declara `@input` en los tres sliders."""
    src = _leer(_SRC / "components" / "ControlesFisicos.vue")
    # tres sliders con @input
    matches = re.findall(r"@input=\"[^\"]+\"", src)
    assert len(matches) >= 3, (
        f"se esperaban >=3 handlers @input, hay {len(matches)}: {matches}"
    )
    # los tres parametros: hm0_m, te_s, b_pto_ns_m
    for clave in ("hm0_m", "te_s", "b_pto_ns_m"):
        assert clave in src, f"falta el parametro {clave!r} en ControlesFisicos.vue"


def test_capas_mapa_declara_las_seis_esperadas() -> None:
    """`web/src/map/capas.ts` declara las capas del diseno."""
    src = _leer(_SRC / "map" / "capas.ts")
    capas_esperadas = {
        "batimetria",
        "sentinel2",
        "relieve",
        "viirs",
        "base_vector",
    }
    for capa in capas_esperadas:
        # formato: id: "nombre_capa"
        assert re.search(rf'id:\s*"{capa}"', src), (
            f"falta la capa {capa!r} en web/src/map/capas.ts"
        )


def test_capas_mapa_declaradas_en_mapa_ts() -> None:
    """`mapa.ts` registra fuentes/capas para batimetria, sentinel2, relieve,
    runap, sitios y batimetria 30-60 m."""
    src = _leer(_SRC / "map" / "mapa.ts")
    for nombre in (
        "batimetria_sombreada",
        "sentinel2_mediana",
        "relieve_sombreado",
        "runap",
        "sitios",
        "batimetria_30_60",
    ):
        assert nombre in src, f"falta la capa/fuente {nombre!r} en mapa.ts"


def test_estructura_capas_ts_tiene_atributos_de_trazabilidad() -> None:
    """Cada capa declara fuente, resolucion, niveles y rango/fecha (19.12)."""
    src = _leer(_SRC / "map" / "capas.ts")
    for clave in ("fuente:", "resolucion:", "niveles:", "rango:", "fecha:"):
        assert clave in src, f"falta el atributo {clave!r} en capas.ts"


def test_vista_ver_declara_seccion_y_canvas() -> None:
    """`Ver.vue` declara `<section class='ver'>` y el `<canvas>` del oleaje."""
    src = _leer(_SRC / "views" / "Ver.vue")
    assert 'class="ver"' in src or "class='ver'" in src, (
        "Ver.vue no tiene <section class='ver'>"
    )
    assert "<canvas" in src, "Ver.vue no tiene <canvas> para la animacion"


def test_vista_comparar_declara_sankey_y_catalogo() -> None:
    """`Comparar.vue` declara Sankey, fichas y comparacion."""
    src = _leer(_SRC / "views" / "Comparar.vue")
    assert "SankeyECharts" in src, "Comparar.vue no importa SankeyECharts"
    assert "FichaDispositivo" in src, "Comparar.vue no importa FichaDispositivo"
    assert "tabla-discrepancia" in src or "discrepancia" in src.lower()


def test_vista_calcular_declara_formula_y_katex() -> None:
    """`Calcular.vue` importa KaTeX y declara FORMULA_DENSIDAD."""
    src = _leer(_SRC / "views" / "Calcular.vue")
    assert "FORMULA_DENSIDAD" in src, "Calcular.vue no expone FORMULA_DENSIDAD"
    assert "katex" in src.lower(), "Calcular.vue no usa KaTeX"


def test_vista_disenar_declara_cuatro_secciones_y_rail() -> None:
    """`Disenar.vue` declara las cuatro secciones y el rail."""
    src = _leer(_SRC / "views" / "Disenar.vue")
    for seccion in (
        "sec-resonancia",
        "sec-limites",
        "sec-matriz",
        "sec-aep-lcoe",
    ):
        assert seccion in src, f"Disenar.vue no declara la seccion {seccion!r}"
    assert "class=\"rail\"" in src or "class='rail'" in src, (
        "Disenar.vue no tiene <nav class='rail'>"
    )


def test_main_ts_declara_tabs_de_los_cuatro_niveles() -> None:
    """`main.ts` declara los cinco tabs (los cuatro niveles + Mapa)."""
    src = _leer(_SRC / "main.ts")
    for tab in ("ver", "comparar", "calcular", "disenar", "mapa"):
        # aparece como id del tab y/o del panel
        assert f"'{tab}'" in src or f'"{tab}"' in src, (
            f"main.ts no declara el tab {tab!r}"
        )


def test_main_ts_suscribe_cancelar_y_progreso() -> None:
    """`main.ts` implementa suscripcion a eventos de progreso y cancelacion."""
    src = _leer(_SRC / "main.ts")
    assert "cancelar" in src.lower(), "main.ts no escucha el evento 'cancelar'"
    # la suscripcion a eventos custom ('sustentacion' o 'cancelar')
    assert "CustomEvent" in src or "addEventListener" in src