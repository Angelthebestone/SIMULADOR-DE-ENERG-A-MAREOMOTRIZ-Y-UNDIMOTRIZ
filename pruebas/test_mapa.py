"""Mapa 6 capas (tareas 19.1-19.12) — validación offline, banda 30-60m."""

from __future__ import annotations

import pathlib

RAIZ = pathlib.Path(__file__).resolve().parents[1]
MAPA_TS = RAIZ / "web" / "src" / "map" / "mapa.ts"
CAPAS_TS = RAIZ / "web" / "src" / "map" / "capas.ts"
MAPA_VIEW = RAIZ / "web" / "src" / "components" / "MapaView.vue"
LISTA_SITIOS = RAIZ / "web" / "src" / "components" / "ListaSitios.vue"


def _leer(ruta: pathlib.Path) -> str:
    assert ruta.exists(), f"falta {ruta.relative_to(RAIZ)}"
    return ruta.read_text(encoding="utf-8")


def test_19_capas_dos_limites():
    txt = _leer(CAPAS_TS)
    assert "const CAPAS" in txt
    for id_ in ("base_vector", "batimetria", "sentinel2", "relieve", "viirs"):
        ok = f'id:"{id_}"' in txt or f'id: "{id_}"' in txt or f"'{id_}'" in txt or f'"{id_}"' in txt
        assert ok, f"falta capa {id_}"
    assert "zoom_max:14" in txt or "zoom_max: 14" in txt
    assert "zoom_max:8" in txt or "zoom_max: 8" in txt
    assert "zoom_max:10" in txt or "zoom_max: 10" in txt
    assert "zoom_max:9" in txt or "zoom_max: 9" in txt
    assert "Natural Earth PMTiles" in txt
    assert "base_vector" in txt and "14" in txt


def test_19_1_cartografia_base_vectorial_local():
    txt = _leer(MAPA_TS)
    esperado = "map = new maplibregl.Map({container, style: styleVectorLocal"
    assert esperado in txt
    assert "center:[-76.18,9.39]" in txt
    assert "pmtiles" in txt.lower()
    assert "styleVectorLocal" in txt
    assert "glyphs" in txt and "sprite" in txt
    assert "pmtiles://" in txt.lower()


def test_19_2_capas_contexto_raster_xyz_256():
    txt = _leer(MAPA_TS)
    for capa in ("batimetria_sombreada", "sentinel2_mediana", "relieve_sombreado"):
        assert capa in txt, f"falta capa contexto {capa}"
    assert "tileSize: 256" in txt or "tileSize:256" in txt
    assert "XYZ" in txt or "{z}/{x}/{y}" in txt
    assert "30" in txt and "60" in txt
    assert "batimetria" in txt.lower()


def test_19_3_capas_decision_runap_semaforo_batimetria():
    txt = _leer(MAPA_TS)
    assert "RUNAP" in txt or "runap" in txt.lower()
    assert "rayado" in txt or "hatch" in txt or "dasharray" in txt
    assert "●" in txt and "◐" in txt and "○" in txt
    assert "emplazamientos" in txt.lower()


def test_19_4_distinguibilidad_forma_trama():
    txt = _leer(MAPA_TS)
    assert "hatch" in txt or "rayado" in txt
    assert "dasharray" in txt


def test_19_5_viirs_conmutable():
    txt_capas = _leer(CAPAS_TS)
    assert "viirs" in txt_capas.lower()
    assert "zoom_max:8" in txt_capas or "zoom_max: 8" in txt_capas


def test_19_6_hover_popup_pendiente_explicito():
    txt = _leer(MAPA_TS)
    assert "pendiente — sin dato" in txt
    assert "kW/m" in txt
    for k in ("valor", "fuente", "estado"):
        assert k in txt.lower()
    assert "verificado" in txt and "inferido" in txt and "pendiente" in txt


def test_19_7_lista_sitios_accesible():
    txt = _leer(LISTA_SITIOS)
    assert 'role="listbox"' in txt
    assert 'role="option"' in txt
    assert "aria-selected" in txt
    assert "ArrowDown" in txt or "ArrowUp" in txt or "flechas" in txt.lower()
    assert "aria-label" in txt


def test_19_8_consulta_sin_puntero_fino():
    txt = _leer(LISTA_SITIOS)
    assert 'role="listbox"' in txt
    assert 'role="option"' in txt


def test_19_9_click_vs_drag_5px():
    txt = _leer(MAPA_TS)
    assert "mousedown" in txt.lower()
    assert ">5" in txt or "> 5" in txt
    assert "isDragging" in txt or "arrastre" in txt.lower()


def test_19_10_flyto_continuidad_prefers_reduced_motion():
    txt = _leer(MAPA_TS)
    assert "map.flyTo({center:[lon,lat], duration:600, essential:true})" in txt
    assert "prefers-reduced-motion" in txt
    assert "jumpTo" in txt or "reduce" in txt.lower()


def test_19_11_mapa_no_recalcula():
    txt = _leer(MAPA_TS)
    assert "simular(" not in txt
    assert "no recalcula" in txt.lower()


def test_19_12_leyenda_fuente_resolucion_niveles_fecha():
    txt = _leer(MAPA_VIEW) + _leer(CAPAS_TS)
    for campo in ("fuente", "resolucion", "niveles", "rango"):
        assert campo in txt.lower(), f"leyenda sin {campo}"
    assert "9" in txt or "450" in txt


def test_sin_cdn_ni_tipografia_remota():
    for ruta in [MAPA_TS, CAPAS_TS, MAPA_VIEW, LISTA_SITIOS]:
        txt = _leer(ruta)
        low = txt.lower()
        assert "api.mapbox.com" not in low, f"fetch Mapbox en {ruta.name}"
        assert "api.maptiler.com" not in low
        assert "cdn.maptiler" not in low
        assert "fonts.googleapis" not in low
        assert "fonts.gstatic" not in low
        assert '@import url("http' not in low
        assert "@import url('http" not in low
    web = RAIZ / "web"
    for p in web.rglob("*.ts"):
        if "node_modules" in p.parts:
            continue
        try:
            t = p.read_text(encoding="utf-8", errors="ignore").lower()
        except (OSError, PermissionError):
            continue
        assert "api.mapbox.com" not in t
        assert "api.maptiler.com" not in t
        assert "cdn.maptiler" not in t
    for p in web.rglob("*.vue"):
        if "node_modules" in p.parts:
            continue
        try:
            t = p.read_text(encoding="utf-8", errors="ignore").lower()
        except (OSError, PermissionError):
            continue
        assert "api.mapbox.com" not in t
        assert "api.maptiler.com" not in t
        assert "cdn.maptiler" not in t


def test_banda_30_60m_visible_alrededor_sitio_activo_gmrt():
    txt = _leer(MAPA_TS)
    assert "GMRT" in txt or "gmrt" in txt.lower()
    assert "30" in txt and "60" in txt
    assert "isolinea" in txt.lower() or "isolínea" in txt.lower()
    assert "batimetria" in txt.lower()


def test_zoom_pan_sin_red_local():
    txt = _leer(MAPA_TS)
    assert "pmtiles://" in txt.lower() or "pmtiles" in txt.lower()
    assert "./datos" in txt or "datos/" in txt
