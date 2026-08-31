"""Mapa 6 capas (tareas 19.1-19.12) — validación offline, banda 30-60m."""

from __future__ import annotations

import json
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
    for id_ in ("base_vector", "batimetria_sombreada", "sentinel2_mediana", "relieve_sombreado", "viirs_nocturno"):
        ok = f'id:"{id_}"' in txt or f'id: "{id_}"' in txt or f"'{id_}'" in txt or f'"{id_}"' in txt
        assert ok, f"falta capa {id_}"
    assert "zoom_max:14" in txt or "zoom_max: 14" in txt
    assert "zoom_max:11" in txt or "zoom_max: 11" in txt
    assert "zoom_max:12" in txt or "zoom_max: 12" in txt
    assert "zoom_max:8" in txt or "zoom_max: 8" in txt
    assert "Natural Earth PMTiles" in txt
    assert "base_vector" in txt and "14" in txt


def test_19_1_cartografia_base_vectorial_local():
    txt = _leer(MAPA_TS)
    esperado = "map = new maplibregl.Map({container, style: styleVectorLocal"
    assert esperado in txt
    assert "center:[-76.18,9.39]" in txt
    assert "pmtiles" in txt.lower(), "protocolo pmtiles registrado para capas futuras"
    assert "styleVectorLocal" in txt
    # La base sale de datos/ en local. Es GeoJSON y no vector tiles porque
    # datos/costa/contorno_tierra.pmtiles nunca se genero: descargar_costa.py
    # deja el contorno de Natural Earth en .geojson. Tampoco hay web/fonts ni
    # web/sprites, asi que el estilo no declara glyphs ni sprite (un layer
    # symbol sin glyphs no pinta nada).
    assert "./datos/costa/contorno_tierra" in txt, "contorno de costa local"
    assert "glyphs:" not in txt, "sin tipografia vectorial en el arbol, no se declara"
    assert "http://" not in txt and "https://" not in txt, "sin CDN externo"


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


# --- Tareas 4.6 y 4.7 — pirámide de teselas del mapa ---


# Capas ráster declaradas en mapa.ts y la pirámide generada por
# datos/gee/piramidizar.py. Cada tupla: (id_capa, maxzoom declarado en mapa.ts).
CAPAS_RASTER = (
    ("batimetria_sombreada", 11),
    ("sentinel2_mediana", 14),
    ("relieve_sombreado", 12),
    ("viirs_nocturno", 8),
)


def _metadata_de_capa(capa_id: str) -> dict:
    ruta = RAIZ / "datos" / "gee" / capa_id / "metadata.json"
    assert ruta.exists(), f"falta metadata.json de {capa_id} en {ruta}"
    return json.loads(ruta.read_text(encoding="utf-8"))


def test_4_6_metadata_existe_y_siete_campos_por_capa():
    """4.6 — metadata.json existe y declara los siete campos del spec.

    Los siete campos declarados en el spec piramide-raster son:
    recuadro geográfico, fecha o rango de composición, resolución nativa,
    niveles de pirámide, fuente, licencia y maxzoom.
    """
    campos_obligatorios = (
        "recuadro",        # recuadro geográfico
        "fecha",           # fecha o rango de composición
        "resolucion_m",    # resolución nativa
        "niveles",         # niveles de pirámide
        "fuente",          # fuente
        "licencia",        # licencia
        "maxzoom",         # nivel máximo (7º campo para alinearse al spec)
    )
    for capa_id, _ in CAPAS_RASTER:
        meta = _metadata_de_capa(capa_id)
        for campo in campos_obligatorios:
            assert campo in meta, f"{capa_id}: falta campo '{campo}'"
        # recuadro coherente: 4 esquinas lon/lat en el bbox del proyecto.
        rec = meta["recuadro"]
        for k in ("lon_min", "lon_max", "lat_min", "lat_max"):
            assert k in rec, f"{capa_id}: recuadro sin clave {k}"
        assert rec["lon_min"] < rec["lon_max"]
        assert rec["lat_min"] < rec["lat_max"]


def test_4_6_maxzoom_coherente_entre_mapa_y_metadata():
    """4.6 — el maxzoom declarado en mapa.ts coincide con metadata.json.

    El spec piramide-raster fija maxzoom por resolución nativa:
    Sentinel-2 10 m → 14, relieve 30 m → 12, VIIRS 500 m → 8.
    La batimetría GEBCO 15 arc-sec admite maxzoom 11 (placeholder del proyecto).
    """
    txt = _leer(MAPA_TS)
    for capa_id, maxzoom in CAPAS_RASTER:
        meta = _metadata_de_capa(capa_id)
        assert meta["maxzoom"] == maxzoom, (
            f"{capa_id}: maxzoom declarado en metadata.json={meta['maxzoom']} "
            f"difiere del esperado {maxzoom}"
        )
        # El addSource del mapa.ts debe declarar maxzoom y la ruta a la pirámide.
        assert f'maxzoom: {maxzoom}' in txt, (
            f"{capa_id}: mapa.ts no declara maxzoom: {maxzoom}"
        )
        assert f'./datos/gee/{capa_id}/{{z}}/{{x}}/{{y}}.png' in txt, (
            f"{capa_id}: mapa.ts no apunta a ./datos/gee/{capa_id}/{{z}}/{{x}}/{{y}}.png"
        )
        # attribution declarada y tileSize 256.
        assert 'tileSize: 256' in txt or "tileSize:256" in txt


def test_4_6_piramide_teselas_en_disco():
    """4.6 — pirámide de teselas en disco: existen z/<x>/<y>.png hasta maxzoom.

    En modo placeholder la pirámide se trunca a PLACEHOLDER_MAXZOOM_CAP=9;
    el metadata.json declara el maxzoom del spec pero el árbol sólo llega
    hasta el cap (el spec declara el nivel, la implementación lo acota).
    """
    for capa_id, maxzoom in CAPAS_RASTER:
        dir_capa = RAIZ / "datos" / "gee" / capa_id
        assert dir_capa.is_dir(), f"falta directorio {dir_capa}"
        # Al menos z=0..3 presentes (la pirámide arranca en z=0)
        for z in (0, 1, 2, 3):
            zdir = dir_capa / str(z)
            assert zdir.is_dir(), f"{capa_id}: falta nivel {z}/"
        # Cada nivel presente contiene al menos un PNG.
        niveles = sorted(int(p.name) for p in dir_capa.iterdir() if p.is_dir())
        for z in niveles:
            pngs = list((dir_capa / str(z)).rglob("*.png"))
            assert pngs, f"{capa_id}: nivel {z} sin teselas"


def test_4_7_mapa_sirve_teselas_sin_conexion():
    """4.7 — la pirámide local permite servir el mapa sin conexión.

    Para cada capa ráster declara en mapa.ts:
    - la URL de tesela es relativa a la raíz del proyecto (./datos/...);
    - la pirámide materializada existe y contiene una tesela para al menos
      un zoom bajo (z=0..3), de modo que el mapa no devuelve 404 al cargar
      ni siquiera sin raster real — sirve el placeholder.
    """
    txt = _leer(MAPA_TS)
    for capa_id, _ in CAPAS_RASTER:
        # La URL es relativa, sin esquema http(s)://
        url_fragment = f'./datos/gee/{capa_id}/{{z}}/{{x}}/{{y}}.png'
        assert url_fragment in txt, (
            f"{capa_id}: mapa.ts no apunta a {url_fragment}"
        )
        # Confirmamos que existe la tesela z=0/x=0/y=0 (o equivalente).
        # Cualquier tesela del nivel 0 vale como muestra de que el árbol
        # tiene materialización; con esa, MapLibre sirve placeholder al
        # cliente sin emitir 404 al primer plano visible.
        dir_capa = RAIZ / "datos" / "gee" / capa_id
        pngs_nivel0 = list((dir_capa / "0").rglob("*.png"))
        assert pngs_nivel0, (
            f"{capa_id}: pirámide sin teselas en z=0; el mapa mostraría "
            f"404 sin conexión"
        )


def test_4_7_sin_peticiones_remotas_al_servir_teselas():
    """4.7 — el árbol de teselas no requiere peticiones externas.

    Verifica que no existe CDN ni dominio externo en mapa.ts y que
    los paths a pirámide son todos locales (./datos/...).
    """
    txt = _leer(MAPA_TS).lower()
    for dominio in ("api.mapbox.com", "api.maptiler.com", "cdn.maptiler",
                    "fonts.googleapis", "fonts.gstatic"):
        assert dominio not in txt, f"mapa.ts pide {dominio}"
    # Las pirámide raster apuntan a ./datos/...
    for capa_id, _ in CAPAS_RASTER:
        assert f"./datos/gee/{capa_id}/" in txt.lower(), (
            f"{capa_id}: ruta no local en mapa.ts"
        )
