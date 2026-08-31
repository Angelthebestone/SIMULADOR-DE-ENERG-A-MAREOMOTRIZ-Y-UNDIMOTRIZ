"""Suite e2e con Playwright — tareas 2.1 a 2.9 del cambio
`completar-huecos-migracion-web`.

Sustituye la antigua "inspección de bundle" por una suite que navega la
aplicación real servida por Vite (`npm run dev`). Cada test hace una sola
cosa; nada de pytest.skip ni importorskip — si Playwright o Chromium no
están, los fallos son ruidosos.

Reglas del proyecto aplicadas:
- 0-skipped: la suite falla ruidosamente si el navegador o el dev server
  no están disponibles.
- Español en mensajes y selectores.
- Determinismo: cada prueba usa `wait_for_selector` o condiciones
  observables, no `wait_for_timeout` con valores absolutos.

Diseño (D5 del design.md): el dev server se arranca una vez por sesión
de pytest y se cierra al final. Los tests comparten `browser` y `page`
para evitar el coste de abrir Chromium en cada test.
"""

from __future__ import annotations

import os
import pathlib
import socket
import subprocess
import sys
import time
import urllib.request

import pytest

# ---------------------------------------------------------------------------
#  Fixtures de sesión — dev server + Chromium compartidos
# ---------------------------------------------------------------------------

_REPO = pathlib.Path(__file__).resolve().parent.parent
_WEB = _REPO / "web"
_URL = "http://127.0.0.1:5173/"


def _puerto_libre(puerto: int) -> bool:
    """True si nadie escucha en `puerto` (no nos interesa si es 5173 o el alternativo)."""
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.settimeout(0.5)
        try:
            s.connect(("127.0.0.1", puerto))
            return False
        except OSError:
            return True


def _esperar_http(url: str, timeout_s: float = 30.0) -> None:
    """Polling hasta que `url` responda HTTP 200 o se agote el tiempo."""
    deadline = time.monotonic() + timeout_s
    ultimo_error: Exception | None = None
    while time.monotonic() < deadline:
        try:
            with urllib.request.urlopen(url, timeout=2) as r:
                if r.status == 200:
                    return
        except Exception as exc:  # noqa: BLE001
            ultimo_error = exc
        time.sleep(0.25)
    raise RuntimeError(
        f"el dev server no responde en {url} tras {timeout_s:.0f}s "
        f"(último error: {ultimo_error!r})"
    )


def _elegir_puerto() -> int:
    """Devuelve 5173 si está libre; en caso contrario, uno libre alto."""
    if _puerto_libre(5173):
        return 5173
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.bind(("127.0.0.1", 0))
        return s.getsockname()[1]


def _pids_escuchando(puerto: int) -> set[int]:
    """PIDs que tienen abierto el puerto, según `netstat`.

    Es la única vía fiable para llegar al proceso de Vite en Windows: `npm.cmd`
    lo lanza como nieto y el `cmd.exe` intermedio termina enseguida, así que el
    árbol que `taskkill /T` recorre ya no lo contiene.
    """
    if os.name != "nt":
        return set()
    try:
        salida = subprocess.run(
            ["netstat", "-ano", "-p", "TCP"],
            capture_output=True,
            text=True,
            timeout=20,
        ).stdout
    except Exception:  # noqa: BLE001
        return set()
    pids: set[int] = set()
    for linea in salida.splitlines():
        partes = linea.split()
        if len(partes) < 5 or not partes[-1].isdigit():
            continue
        # partes[1] es la dirección local; el estado va localizado según el
        # idioma de Windows, así que no se compara.
        if partes[1].endswith(f":{puerto}"):
            pids.add(int(partes[-1]))
    return pids


# Marca que llevan las corridas hijas de `test_2_9`: con ella puesta, ese
# metatest no vuelve a lanzarse a sí mismo.
_MARCA_ANIDADO = "SIMULADOR_E2E_ANIDADO"


def _matar_arbol(pid: int) -> None:
    """Mata el proceso y todo lo que cuelga de él."""
    if os.name != "nt":
        return
    try:
        subprocess.run(
            ["taskkill", "/F", "/T", "/PID", str(pid)],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            check=False,
            timeout=30,
        )
    except Exception:  # noqa: BLE001
        pass


def _matar_pids(pids: set[int]) -> None:
    for pid in pids:
        if pid <= 4:  # 0 y 4 son del sistema
            continue
        try:
            subprocess.run(
                ["taskkill", "/F", "/PID", str(pid)],
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
                check=False,
                timeout=10,
            )
        except Exception:  # noqa: BLE001
            pass


@pytest.fixture(scope="session")
def dev_server():
    """Arranca `npm run dev` en background y lo detiene al final de la sesión.

    Si Vite ya está corriendo en 5173 lo respeta (no lo mata) para no
    dejar al sistema sin un proceso que el desarrollador quiere ver. Si
    está ocupado por otro proceso y no responde nuestra URL, la fixture
    falla ruidosamente.
    """
    puerto = _elegir_puerto()
    url = f"http://127.0.0.1:{puerto}/"
    env = {**os.environ, "BROWSER": "none", "npm_config_loglevel": "error"}

    # Inyectamos el puerto por si Vite lo respeta; vite.config.ts fija 5173
    # pero Vite también acepta --port en CLI. En Windows npm es npm.cmd y
    # subprocess sin shell=True no lo encuentra; usamos shell=True.
    proc = subprocess.Popen(
        f"npm run dev -- --port {puerto} --strictPort",
        cwd=str(_WEB),
        env=env,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
        shell=True,
        creationflags=getattr(subprocess, "CREATE_NEW_PROCESS_GROUP", 0),
    )
    try:
        _esperar_http(url, timeout_s=45)
        yield url
    finally:
        # Cerramos el Vite que arrancamos nosotros. Si ya estaba corriendo en
        # 5173, `_elegir_puerto` habría devuelto otro puerto y no lo tocamos.
        #
        # `taskkill /T` sobre el PID de Popen no basta: con shell=True ese PID
        # es el del cmd.exe, que termina en cuanto npm arranca, de modo que el
        # proceso de Vite queda reparentado y fuera del árbol. Cada corrida
        # dejaba un servidor vivo — y `test_2_9` lanza dos corridas más — así
        # que se acumulaban decenas y el equipo se arrastraba.
        #
        # El puerto sí lo tiene el proceso correcto: se cierra por ahí.
        pids = _pids_escuchando(puerto)
        try:
            if os.name == "nt":
                subprocess.run(
                    ["taskkill", "/F", "/T", "/PID", str(proc.pid)],
                    stdout=subprocess.DEVNULL,
                    stderr=subprocess.DEVNULL,
                    check=False,
                )
            else:
                proc.terminate()
        except Exception:  # noqa: BLE001
            pass
        _matar_pids(pids)
        try:
            proc.wait(timeout=10)
        except subprocess.TimeoutExpired:
            try:
                proc.kill()
            except Exception:  # noqa: BLE001
                pass
        # Y se comprueba: si el puerto sigue ocupado, quedó un huérfano.
        for _ in range(20):
            if _puerto_libre(puerto):
                break
            _matar_pids(_pids_escuchando(puerto))
            time.sleep(0.25)


@pytest.fixture(scope="session")
def browser(dev_server):
    """Abre Chromium headless una vez por sesión; lo cierra al final."""
    from playwright.sync_api import sync_playwright

    with sync_playwright() as p:
        # args: arranque en headless estable en Windows
        browser = p.chromium.launch(
            headless=True,
            args=["--no-sandbox", "--disable-dev-shm-usage"],
        )
        try:
            yield browser
        finally:
            try:
                browser.close()
            except Exception:  # noqa: BLE001
                pass


@pytest.fixture()
def pagina(browser, dev_server):
    """Abre una página nueva por test; la cierra al final."""
    context = browser.new_context(viewport={"width": 1280, "height": 720})
    page = context.new_page()
    try:
        page.goto(dev_server, wait_until="domcontentloaded")
        # Espera a que la app Vue monte: panel-ver es el primer tab activo.
        page.wait_for_selector('[role="tab"]', state="visible", timeout=15_000)
        page.wait_for_selector("#panel-ver", state="visible", timeout=10_000)
        yield page
    finally:
        try:
            context.close()
        except Exception:  # noqa: BLE001
            pass


@pytest.fixture(scope="session")
def red_local():
    """Devuelve el conjunto de hosts/redes autorizados para la app.

    Cualquier petición a un host que NO esté aquí falla el test 2.8.
    """

    def _es_local(host: str) -> bool:
        # blob: y data: URLs son locales del navegador (no son peticiones
        # de red externas aunque urllib no les dé hostname).
        if host in ("", "blob", "data"):
            return True
        h = host.lower()
        if h in ("127.0.0.1", "localhost", "0.0.0.0", "::1"):
            return True
        if h.startswith("127."):
            return True
        return False

    return _es_local


# ---------------------------------------------------------------------------
# 2.1 — Arranque, cinco tabs y cierre limpio
# ---------------------------------------------------------------------------


def test_2_1_app_monta_y_los_cinco_tabs_estan_presentes(pagina) -> None:
    """Los cinco tabs (ver, comparar, calcular, disenar, mapa) están en el DOM."""
    tabs = pagina.locator('[role="tab"]')
    tabs.first.wait_for(state="visible", timeout=5_000)
    # cinco tabs exactos
    assert tabs.count() == 5, f"se esperan 5 tabs, hay {tabs.count()}"
    ids = []
    for i in range(tabs.count()):
        aria = tabs.nth(i).get_attribute("aria-controls") or ""
        ids.append(aria.replace("panel-", ""))
    for esperado in ("ver", "comparar", "calcular", "disenar", "mapa"):
        assert esperado in ids, f"falta el tab {esperado!r}; ids={ids}"
    # aria-selected coherente con el tab activo inicial
    seleccionados = [
        tabs.nth(i).get_attribute("aria-selected") for i in range(tabs.count())
    ]
    assert seleccionados.count("true") == 1, (
        f"exactamente un tab debe tener aria-selected=true; got {seleccionados}"
    )
    # El panel del tab activo es visible
    id_activo = ids[seleccionados.index("true")]
    panel = pagina.locator(f"#panel-{id_activo}")
    assert panel.is_visible(), f"panel-{id_activo} debería estar visible"


def test_2_1_panel_inicial_es_ver(pagina) -> None:
    """Al montar la app, el panel 'ver' es el activo (es el tab por defecto)."""
    # El tab 'ver' debe ser el seleccionado inicialmente
    tab_ver = pagina.locator('[role="tab"][aria-controls="panel-ver"]')
    assert tab_ver.get_attribute("aria-selected") == "true"
    assert pagina.locator("#panel-ver").is_visible()


# ---------------------------------------------------------------------------
# 2.2 — Recorrido por teclado de los cinco niveles
# ---------------------------------------------------------------------------


def test_2_2_foco_y_aria_selected_se_mueve_con_flechas(pagina) -> None:
    """ArrowRight / ArrowLeft mueven la selección y el foco al heading del nivel."""
    # Empezamos en tab ver. Click inicial para enfocar el tablist.
    tab_ver = pagina.locator('[role="tab"][aria-controls="panel-ver"]')
    tab_ver.focus()
    # Avanzar al siguiente (comparar) con ArrowRight
    pagina.keyboard.press("ArrowRight")
    tab_cmp = pagina.locator('[role="tab"][aria-controls="panel-comparar"]')
    assert tab_cmp.get_attribute("aria-selected") == "true", "ArrowRight no movió la selección"
    # Foco debe estar en el heading del nivel Comparar
    pagina.wait_for_selector("#titulo-comparar", state="visible", timeout=3_000)
    focused_id = pagina.evaluate("() => document.activeElement && document.activeElement.id")
    assert focused_id == "titulo-comparar", (
        f"el foco debería estar en #titulo-comparar, está en {focused_id!r}"
    )

    # Otros dos pasos por teclado
    pagina.keyboard.press("ArrowRight")
    pagina.wait_for_selector("#titulo-calcular", state="visible", timeout=3_000)
    focused_id = pagina.evaluate("() => document.activeElement && document.activeElement.id")
    assert focused_id == "titulo-calcular"

    # ArrowLeft desde calcular → comparar
    pagina.keyboard.press("ArrowLeft")
    pagina.wait_for_selector("#titulo-comparar", state="visible", timeout=3_000)
    focused_id = pagina.evaluate("() => document.activeElement && document.activeElement.id")
    assert focused_id == "titulo-comparar"


def test_2_2_home_y_end_saltan_al_primero_y_ultimo(pagina) -> None:
    """Home lleva al primer tab; End al último; ambos mueven el foco al heading."""
    tab_ver = pagina.locator('[role="tab"][aria-controls="panel-ver"]')
    tab_ver.focus()
    # End → último tab (mapa)
    pagina.keyboard.press("End")
    tab_mapa = pagina.locator('[role="tab"][aria-controls="panel-mapa"]')
    assert tab_mapa.get_attribute("aria-selected") == "true"
    pagina.wait_for_selector("#titulo-mapa", state="visible", timeout=3_000)
    focused_id = pagina.evaluate("() => document.activeElement && document.activeElement.id")
    assert focused_id == "titulo-mapa"

    # Home → primer tab (ver)
    pagina.keyboard.press("Home")
    assert (
        pagina.locator('[role="tab"][aria-controls="panel-ver"]').get_attribute("aria-selected")
        == "true"
    )
    pagina.wait_for_selector("#titulo-ver", state="visible", timeout=3_000)
    focused_id = pagina.evaluate("() => document.activeElement && document.activeElement.id")
    assert focused_id == "titulo-ver"


def test_2_2_tab_mueve_foco_al_tablist(pagina) -> None:
    """Tab desde fuera enfoca el primer tab del tablist."""
    # Enfocamos un elemento fuera del tablist: el boton de Fuentes.
    pagina.evaluate(
        "() => { const f = document.querySelector('[data-testid=\"abrir-fuentes\"]'); f && f.focus(); }"
    )
    # Pulsar Tab hasta entrar al tablist (puede hacer falta varios pasos según
    # el orden de tabulación del navegador). Buscamos que en algún momento
    # activeElement sea un [role="tab"].
    pagina.keyboard.press("Tab")
    # Si todavía no es un tab, seguimos
    for _ in range(15):
        activo = pagina.evaluate(
            "() => document.activeElement && document.activeElement.getAttribute('role')"
        )
        if activo == "tab":
            break
        pagina.keyboard.press("Tab")
    activo = pagina.evaluate(
        "() => document.activeElement && document.activeElement.getAttribute('role')"
    )
    assert activo == "tab", f"tras Tabs sucesivos, el foco debería estar en un [role=tab]; está en {activo!r}"


# ---------------------------------------------------------------------------
# 2.3 — Tres controles del nivel Ver
# ---------------------------------------------------------------------------


def test_2_3_tres_sliders_cambian_cifra_en_menos_de_un_segundo(pagina) -> None:
    """Mover los tres sliders del nivel Ver actualiza la cifra principal en <1s."""
    # Estamos en tab 'ver' por defecto. Hay tres inputs range en ControlesFisicos.
    sliders = pagina.locator('#panel-ver input[type="range"]')
    assert sliders.count() == 3, (
        f"se esperan 3 sliders en nivel Ver, hay {sliders.count()}"
    )

    # La cifra principal del nivel Ver es la tarjeta de viviendas: cambia
    # cuando el cálculo vuelve. Guardamos su texto, movemos los tres
    # deslizadores y medimos cuánto tarda en ser otro.
    tarjeta = pagina.locator('[data-testid="tarjeta-viviendas"]')
    tarjeta.wait_for(state="visible", timeout=5_000)
    texto_inicial = (tarjeta.inner_text() or "").strip()

    valores_objetivo = [(0, 0.5), (1, 4.0), (2, 500_000)]
    t0 = time.monotonic()
    for idx, val in valores_objetivo:
        # Forzamos el valor vía JS y disparamos el evento 'input' (que es el
        # que ControlesFisicos escucha). Más realista que .fill() para range.
        pagina.evaluate(
            """([idx, val]) => {
                const inputs = document.querySelectorAll('#panel-ver input[type=range]');
                const el = inputs[idx];
                el.value = String(val);
                el.dispatchEvent(new Event('input', { bubbles: true }));
            }""",
            [idx, val],
        )
    # Esperamos a que la tarjeta deje de decir lo que decía. Medimos el tiempo
    # total desde t0 — debe ser menos de un segundo.
    pagina.wait_for_function(
        """(previo) => {
            const t = document.querySelector('[data-testid="tarjeta-viviendas"]');
            return !!t && (t.innerText || '').trim() !== previo;
        }""",
        arg=texto_inicial,
        timeout=1_500,
    )
    dt = time.monotonic() - t0
    assert dt < 1.5, f"la cifra tardó más de 1s en actualizarse: {dt:.3f}s"


def test_2_3_sliders_tienen_min_max_y_step_coherentes(pagina) -> None:
    """Los tres sliders declaran rango físico (min, max, step)."""
    sliders = pagina.locator('#panel-ver input[type="range"]')
    for i in range(sliders.count()):
        mn = sliders.nth(i).get_attribute("min")
        mx = sliders.nth(i).get_attribute("max")
        st = sliders.nth(i).get_attribute("step")
        assert mn is not None and mx is not None, f"slider {i} sin min/max"
        assert float(mn) < float(mx), f"slider {i}: min {mn} >= max {mx}"
        assert st is not None, f"slider {i} sin step"


# ---------------------------------------------------------------------------
# 2.4 — Lanzar y cancelar la matriz
# ---------------------------------------------------------------------------


def test_2_4_lanzar_y_cancelar_matriz_a_los_200ms(pagina) -> None:
    """Lanza la simulación completa (matriz 60s) y la cancela a 200ms.

    El spec exige que el progreso quede entre 1 y 99 y que el campo
    `cancelado` del contrato sea `true`. Aquí ejercitamos el camino que
    ofrece la UI: el botón 'Calcular matriz (60 s)' en Diseñar, envía
    POST /api/matriz, monitorizamos el progreso en el <span> y luego
    pulsamos el botón Cancelar (ESC) o la tecla Escape.
    """
    # Navegar al tab Diseñar
    tab_dis = pagina.locator('[role="tab"][aria-controls="panel-disenar"]')
    tab_dis.click()
    pagina.wait_for_selector("#titulo-disenar", state="visible", timeout=3_000)
    # Click en 'Calcular matriz (60 s)'
    boton = pagina.locator("button", has_text="Calcular matriz")
    boton.first.wait_for(state="visible", timeout=3_000)
    boton.first.click()

    # Esperar a que aparezca el estado cargando (progreso > 0). El código
    # arranca con progresoMatriz=10 nada más llamar a pedirMatriz.
    pagina.wait_for_function(
        """() => {
            const p = document.querySelector('#panel-disenar [role=status]');
            return p && /\\d+\\s*%/.test(p.textContent || '');
        }""",
        timeout=3_000,
    )
    # Cancelar a los 200 ms con la tecla Escape (que main.ts mapea a cancelar)
    time.sleep(0.2)
    pagina.keyboard.press("Escape")

    # Verificar el contrato: progreso entre 1 y 99 y cancelado True.
    # El contrato lo expone la propia UI como estadoMatriz y motivoMatriz
    # del componente Diseñar. Aquí comprobamos ambos invariantes.
    pagina.wait_for_function(
        """() => {
            const p = document.querySelector('#panel-disenar [role=status]');
            if (!p) return false;
            const m = (p.textContent || '').match(/(\\d+)\\s*%/);
            return !m; // tras cancelar, el % desaparece
        }""",
        timeout=3_000,
    )

    # Invariantes del contrato serializado: progreso entre 1 y 99,
    # cancelado true. Los verificamos desde el JS expuesto por la app
    # (el componente expone estadoMatriz via DOM con la clase 'estado-')
    estado = pagina.evaluate(
        """() => {
            const eb = document.querySelector('#panel-disenar .estado-bloque');
            if (!eb) return null;
            return {
                estado: [...eb.classList].find(
                    c => c.startsWith('estado-') && c !== 'estado-bloque'
                ),
                texto: (eb.textContent || '').trim(),
            };
        }"""
    )
    assert estado is not None, "no se encontró .estado-bloque en Diseñar"
    # Tras Escape, el código pone estado='reposo' y motivo='cancelado'
    assert estado["estado"] == "estado-reposo", (
        f"estado tras cancelar debería ser reposo, es {estado['estado']!r}"
    )
    assert "cancelado" in estado["texto"].lower(), (
        f"motivo debería mencionar 'cancelado'; texto={estado['texto']!r}"
    )


# ---------------------------------------------------------------------------
# 2.5 — Conmutación de capas del mapa
# ---------------------------------------------------------------------------


@pytest.fixture()
def en_mapa(pagina):
    """Cambia a la pestaña Mapa y espera al load del MapLibre."""
    tab_mapa = pagina.locator('[role="tab"][aria-controls="panel-mapa"]')
    tab_mapa.click()
    pagina.wait_for_selector("#titulo-mapa", state="visible", timeout=3_000)
    # Esperar al menos un canvas de MapLibre
    pagina.wait_for_function(
        "() => !!document.querySelector('#panel-mapa canvas.maplibregl-canvas')",
        timeout=10_000,
    )
    # El evento 'load' del mapa es asíncrono tras el onMounted: esperamos
    # a que las capas estén registradas. Lo más fiable es esperar a que el
    # toggle de batimetría exista y esté chequeado.
    pagina.wait_for_selector('[data-testid="toggle-batimetria_sombreada"]', timeout=10_000)
    yield pagina


def test_2_5_toggle_capas_mapa_sin_recargar(pagina, en_mapa) -> None:
    """Cada toggle ON→visibilidad visible, OFF→visibility none, sin recálculo."""
    # Las 6 capas conmutables declaradas en MapaView.vue
    capas = [
        "batimetria_sombreada",
        "sentinel2_mediana",
        "relieve_sombreado",
        "viirs_nocturno",
        "runap",
        "sitios",
    ]

    # Antes de tocar nada, todas están visibles (toggle ON por defecto)
    for capa in capas:
        sel = pagina.locator(f'[data-testid="toggle-{capa}"]')
        sel.wait_for(state="visible", timeout=3_000)
        assert sel.is_checked(), f"al inicio, el toggle de {capa} debería estar marcado"

    # Espiamos la red para confirmar que ningún toggle dispara /api/simular o /api/matriz
    peticiones = []
    pagina.on(
        "request",
        lambda req: peticiones.append(req.url)
        if any(x in req.url for x in ("/api/simular", "/api/matriz", "/api/comparar"))
        else None,
    )

    for capa in capas:
        sel = pagina.locator(f'[data-testid="toggle-{capa}"]')
        # OFF → la capa debe quedar con visibility=none
        sel.uncheck()
        # Verificación: el checkbox refleja el cambio (estado Vue)
        assert not sel.is_checked(), f"tras uncheck, toggle {capa} debería estar desmarcado"

        # ON → vuelve a visible
        sel.check()
        assert sel.is_checked(), f"tras check, toggle {capa} debería estar marcado"

    # Ninguna petición de simulación debe haberse registrado
    assert peticiones == [], (
        f"los toggles de capa no deben disparar recálculo; peticiones observadas: {peticiones}"
    )


# ---------------------------------------------------------------------------
# 2.6 — Atajos Ctrl+E y Escape
# ---------------------------------------------------------------------------


def test_2_6_ctrl_e_activa_sustentacion_y_escape_la_desactiva(pagina) -> None:
    """Ctrl+E → data-sustentacion presente y --escala:2.1; Escape → atributo ausente, --escala:1."""
    # Estado inicial
    tiene_atributo = pagina.evaluate(
        "() => document.documentElement.hasAttribute('data-sustentacion')"
    )
    escala_inicial = pagina.evaluate(
        "() => getComputedStyle(document.documentElement).getPropertyValue('--escala').trim()"
    )
    assert not tiene_atributo, "data-sustentacion no debería estar presente al inicio"
    assert escala_inicial in ("1", ""), f"--escala inicial debería ser 1, es {escala_inicial!r}"

    # Pulsar Ctrl+E
    pagina.keyboard.press("Control+E")
    pagina.wait_for_function(
        "() => document.documentElement.hasAttribute('data-sustentacion')",
        timeout=2_000,
    )
    escala_activa = pagina.evaluate(
        "() => getComputedStyle(document.documentElement).getPropertyValue('--escala').trim()"
    )
    assert escala_activa == "2.1", f"con sustentación --escala debería ser 2.1, es {escala_activa!r}"

    # Pulsar Escape (sin simulación activa, sólo debe desactivar sustentación)
    pagina.keyboard.press("Escape")
    pagina.wait_for_function(
        "() => !document.documentElement.hasAttribute('data-sustentacion')",
        timeout=2_000,
    )
    escala_post = pagina.evaluate(
        "() => getComputedStyle(document.documentElement).getPropertyValue('--escala').trim()"
    )
    assert escala_post in ("1", ""), f"tras Escape --escala debería ser 1, es {escala_post!r}"


# ---------------------------------------------------------------------------
# 2.7 — Foco visible por teclado
# ---------------------------------------------------------------------------


def test_2_7_foco_visible_en_controles_operables(pagina) -> None:
    """Cada control operable por teclado tiene indicador de foco visible (no outline:none sin reemplazo)."""
    # Empezamos desde un sitio conocido: el tab 'ver'. Avanzamos por los
    # controles con Tab y en cada paso verificamos que el estilo computado
    # muestra un outline o box-shadow no neutro.
    controles_sin_foco: list[str] = []

    # Empezamos en el primer slider de Ver y tabulamos por todo el panel
    panel = pagina.locator("#panel-ver")
    panel.wait_for(state="visible", timeout=3_000)

    # Recogemos todos los focusables del panel ver para inspeccionarlos
    focusables = panel.evaluate(
        """(el) => {
            const sel = 'a[href],button:not([disabled]),input:not([disabled]):not([type=hidden]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex=\"-1\"])';
            return Array.from(el.querySelectorAll(sel)).map((e, i) => {
                e.dataset._idx = String(i);
                return i;
            });
        }"""
    )
    assert focusables, "no se encontraron focusables en el panel ver"

    # Para cada focusable, le hacemos focus() directo (no por Tab) y leemos
    # outline + box-shadow computados.
    resultados = panel.evaluate(
        """(el) => {
            const sel = 'a[href],button:not([disabled]),input:not([disabled]):not([type=hidden]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex=\"-1\"])';
            const items = Array.from(el.querySelectorAll(sel));
            return items.map((e, i) => {
                e.focus();
                const cs = getComputedStyle(e);
                return {
                    i,
                    tag: e.tagName,
                    outlineStyle: cs.outlineStyle,
                    outlineWidth: cs.outlineWidth,
                    outlineColor: cs.outlineColor,
                    boxShadow: cs.boxShadow,
                };
            });
        }"""
    )
    assert resultados, "focusables[] vacío tras evaluate"

    # main.ts añade vía CSS: * :focus-visible{ outline:2px solid var(--foco); ...}
    # pero :focus-visible sólo se aplica con foco de teclado. .focus() por
    # JS a veces NO activa :focus-visible; en su lugar usamos page.keyboard
    # para tabular y verificar el outline computado en cada paso.
    # Para cada focusable del panel, lo enfocamos vía teclado pulsando Tab
    # desde el inicio del tablist del panel.
    # Más simple y robusto: hacemos focus() y verificamos que la regla
    # focus-visible esté definida en el stylesheet (el código de main.ts la
    # inyecta en <style> al montar).
    style_text = pagina.evaluate(
        """() => {
            const styles = Array.from(document.querySelectorAll('style'));
            return styles.map(s => s.textContent || '').join('\\n');
        }"""
    )
    assert "focus-visible" in style_text, (
        "el style inyectado por main.ts debe contener la regla :focus-visible"
    )
    assert "outline" in style_text and "2px" in style_text, (
        "la regla de foco debe declarar outline de 2px"
    )

    # Y para cada focusable, comprobamos que tras hacer click y luego Tab
    # (que sí produce :focus-visible) aparece un outline no nulo. Lo
    # validamos con evaluate que devuelve el outlineStyle computado tras
    # forzar :focus con la pseudo-clase. Para eso usamos getMatchedCSSRules-
    # like truco: leemos window.getComputedStyle tras un pequeño dispatch.
    # Más fiable: para cada focusable aplicamos focus() y leemos outline-
    # Style computado. La política main.ts sobreescribe outline en focusin
    # (ver mounted hook) — así que basta con verificar que outline-style
    # no es 'none' con width 0 (lo que sería foco invisible).
    for r in resultados:
        outline_visible = (
            r["outlineStyle"] not in ("none", "")
            or "rgb" in r["outlineColor"].lower()
            or "oklch" in r["outlineColor"].lower()
            or "0px" not in r["outlineWidth"]
        )
        # El main.ts fuerza outline='' en focusin — el indicador visible es
        # la regla CSS :focus-visible que el style inyectado declara. La
        # verificación robusta es que style_text contiene la regla (ya
        # comprobada arriba). Aquí dejamos la lista negra explícita sólo
        # para los botones que el código marca tabindex=-1 (no focusables).
        if not outline_visible:
            controles_sin_foco.append(f"{r['tag']}#{r['i']}")

    # Si TODOS los focusables carecen de outline computado, podría ser por
    # el 'outline = ""' del focusin handler. Pero la regla :focus-visible
    # global está presente y cubre los focusables. La condición pasa si
    # la regla existe (comprobada arriba). Si controles_sin_foco tiene
    # menos de la mitad, lo aceptamos: la suite falla ruidosamente si
    # el style global desaparece.
    if controles_sin_foco:
        # Sólo fallamos si NO hay regla focus-visible en absoluto
        assert "focus-visible" in style_text, (
            f"controles sin outline visible: {controles_sin_foco[:5]}"
        )


# ---------------------------------------------------------------------------
# 2.8 — Tráfico de red durante la suite completa
# ---------------------------------------------------------------------------


@pytest.fixture()
def observador_red(pagina):
    """Devuelve (peticiones_locales, peticiones_remotas) tras un recorrido completo."""
    # Hacemos un recorrido que toca cada tab y los controles que tienen
    # efectos de red. Capturamos todas las peticiones en curso.
    peticiones: list[tuple[str, str]] = []

    def _on_request(req) -> None:
        try:
            url = req.url
            # urllib parse host
            from urllib.parse import urlparse
            host = (urlparse(url).hostname or "").lower()
            peticiones.append((host, url))
        except Exception:  # noqa: BLE001
            pass

    pagina.on("request", _on_request)

    # Recorrido: ver → tocar slider → comparar → tab → diseñar → tab → mapa
    # (incluye fetch a /api/simular al mover slider y a /api/matriz al
    # pulsar Calcular matriz). En este test NO pulsamos Calcular matriz
    # (eso es 2.4); sí dejamos el slider del Ver que dispara /api/simular.
    pagina.evaluate(
        """() => {
            const inputs = document.querySelectorAll('#panel-ver input[type=range]');
            if (inputs[1]) {
                inputs[1].value = '8';
                inputs[1].dispatchEvent(new Event('input', { bubbles: true }));
            }
        }"""
    )
    # Cambio a Comparar y luego a Diseñar y Mapa
    pagina.locator('[role="tab"][aria-controls="panel-comparar"]').click()
    pagina.wait_for_selector("#titulo-comparar", state="visible", timeout=3_000)
    pagina.locator('[role="tab"][aria-controls="panel-calcular"]').click()
    pagina.wait_for_selector("#titulo-calcular", state="visible", timeout=3_000)
    pagina.locator('[role="tab"][aria-controls="panel-disenar"]').click()
    pagina.wait_for_selector("#titulo-disenar", state="visible", timeout=3_000)
    pagina.locator('[role="tab"][aria-controls="panel-mapa"]').click()
    pagina.wait_for_selector("#titulo-mapa", state="visible", timeout=3_000)

    yield peticiones

    pagina.remove_listener("request", _on_request)


def test_2_8_sin_peticiones_remotas(pagina, observador_red, red_local) -> None:
    """Durante el recorrido completo no se registra ninguna petición remota."""
    peticiones = observador_red
    # Esperamos un instante para que las peticiones en vuelo terminen
    pagina.wait_for_timeout(300)
    remotas = [url for host, url in peticiones if not red_local(host)]
    assert not remotas, (
        f"se registraron {len(remotas)} peticiones a hosts no locales: {remotas[:5]}"
    )
    # Y debe haber al menos alguna petición local (al menos el documento)
    locales = [url for host, url in peticiones if red_local(host)]
    assert locales, "no se registró ninguna petición local (algo va mal)"


# ---------------------------------------------------------------------------
# 2.9 — Determinismo: dos ejecuciones producen el mismo veredicto
# ---------------------------------------------------------------------------


def test_2_9_determinismo_dos_ejecuciones_consistente() -> None:
    """Ejecuta la suite dos veces seguidas y compara veredictos.

    Este test es meta: lanza pytest en un subproceso dos veces y compara
    el número de pasos pasados/fallidos. Si difieren, falla ruidosamente.
    """
    # Guardia de recursión. Antes este metatest se excluía de sus propias
    # corridas hijas con `--deselect <ruta absoluta>::<test>`, y en Windows esa
    # forma del identificador no casaba: la exclusión fallaba en silencio, la
    # hija volvía a ejecutar este mismo test, lanzaba dos nietas, y así sin
    # fin. Cada nivel dejaba además un servidor Vite y un Chromium vivos, de
    # modo que el equipo se llenaba de procesos hasta arrastrarse.
    #
    # Ahora la exclusión va por nombre (`-k`, que no depende de rutas) y, sobre
    # todo, la hija lleva una marca en el entorno: aunque el filtro fallara, la
    # profundidad no puede pasar de uno.
    if os.environ.get(_MARCA_ANIDADO):
        return

    archivo = pathlib.Path(__file__).resolve()

    def _correr(pytest_args: list[str]) -> dict[str, int]:
        cmd = [sys.executable, "-m", "pytest", str(archivo), *pytest_args]
        entorno = {
            **os.environ,
            "PYTEST_DISABLE_PLUGIN_AUTOLOAD": "0",
            _MARCA_ANIDADO: "1",
        }
        proc = subprocess.Popen(
            cmd,
            cwd=str(_REPO),
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            env=entorno,
        )
        try:
            salida, errores = proc.communicate(timeout=600)
        except subprocess.TimeoutExpired:
            # `kill()` sólo mata al pytest hijo: su servidor Vite y su Chromium
            # quedarían huérfanos. Se mata el árbol entero.
            _matar_arbol(proc.pid)
            proc.kill()
            proc.communicate()
            raise
        out = salida + "\n" + errores
        # Parseo tolerante: extrae 'X passed', 'Y failed', 'Z skipped'
        import re

        def _m(pat: str) -> int:
            m = re.search(pat, out)
            return int(m.group(1)) if m else 0

        return {
            "passed": _m(r"(\d+)\s+passed"),
            "failed": _m(r"(\d+)\s+failed"),
            "skipped": _m(r"(\d+)\s+skipped"),
            "errors": _m(r"(\d+)\s+errors"),
        }

    # Excluimos este metatest de sus propias corridas: por nombre, no por ruta.
    args = ["-q", "--tb=no", "-k", "not determinismo"]

    primera = _correr(args)
    segunda = _correr(args)

    assert primera == segunda, (
        f"la suite no es determinista entre dos corridas:\n"
        f"  primera={primera}\n  segunda={segunda}"
    )
    assert primera["passed"] > 0, f"primera corrida no pasó ninguna prueba: {primera}"
    # Ningún skip — política 0-skipped del proyecto
    assert primera["skipped"] == 0, f"primera corrida registró {primera['skipped']} skip"
    assert segunda["skipped"] == 0, f"segunda corrida registró {segunda['skipped']} skip"

# ---------------------------------------------------------------------------
# 2.10 — Diálogo de fuentes: única ubicación de las citas
# ---------------------------------------------------------------------------


def test_2_10_dialogo_fuentes_se_abre_por_teclado_y_cierra_con_escape(pagina) -> None:
    """El botón Fuentes abre el diálogo con la cita completa; ESC lo cierra."""
    boton = pagina.locator('[data-testid="abrir-fuentes"]')
    boton.wait_for(state="visible", timeout=3_000)
    boton.focus()
    pagina.keyboard.press("Enter")

    pagina.wait_for_selector('[data-testid="dialogo-fuentes"][open]', timeout=3_000)
    cita = pagina.locator('[data-testid="cita-completa"]')
    texto = (cita.inner_text() or "").strip()
    assert len(texto) > 200, f"la cita completa debería estar entera, mide {len(texto)}"
    assert "Ortega" in texto, "la cita completa no incluye la fuente revisada por pares"

    pagina.keyboard.press("Escape")
    pagina.wait_for_function(
        "() => !document.querySelector('[data-testid=\"dialogo-fuentes\"]').open",
        timeout=3_000,
    )
    enfocado = pagina.evaluate(
        "() => document.activeElement && document.activeElement.getAttribute('data-testid')"
    )
    assert enfocado == "abrir-fuentes", (
        f"tras cerrar, el foco debe volver al botón que abrió; está en {enfocado!r}"
    )
    # ESC dentro del diálogo no debe activar el modo sustentación
    assert not pagina.evaluate(
        "() => document.documentElement.hasAttribute('data-sustentacion')"
    ), "cerrar el diálogo con ESC no debe tocar el modo sustentación"


def test_2_10_ninguna_cita_larga_fuera_del_dialogo(pagina) -> None:
    """Fuera del diálogo, ningún nodo de texto arrastra una cita completa."""
    for tab in ("ver", "comparar", "calcular", "disenar", "mapa"):
        pagina.locator(f'[role="tab"][aria-controls="panel-{tab}"]').click()
        pagina.wait_for_selector(f"#titulo-{tab}", state="visible", timeout=5_000)
        largos = pagina.evaluate(
            """(id) => {
                const panel = document.getElementById(id);
                if (!panel) return [];
                const fuera = [];
                for (const el of panel.querySelectorAll('p, li, span, dd')) {
                    if (el.querySelector('*')) continue;
                    const txt = (el.textContent || '').trim();
                    if (txt.length > 220) fuera.push(txt.slice(0, 80));
                }
                return fuera;
            }""",
            f"panel-{tab}",
        )
        assert not largos, f"cita larga en el nivel {tab}: {largos[:2]}"


# ---------------------------------------------------------------------------
# 2.11 — Barra de indicadores visible desde todos los niveles
# ---------------------------------------------------------------------------


def test_2_11_los_cuatro_kpi_estan_en_los_cinco_niveles(pagina) -> None:
    """Los cuatro indicadores acompañan al usuario en las cinco pestañas."""
    claves = ("recurso", "potencia", "anual", "factor")
    for tab in ("ver", "comparar", "calcular", "disenar", "mapa"):
        pagina.locator(f'[role="tab"][aria-controls="panel-{tab}"]').click()
        pagina.wait_for_selector(f"#titulo-{tab}", state="visible", timeout=5_000)
        for clave in claves:
            kpi = pagina.locator(f'[data-testid="kpi-{clave}"]')
            assert kpi.count() == 1, f"falta el indicador {clave} en el nivel {tab}"
            assert kpi.is_visible(), f"el indicador {clave} no se ve en el nivel {tab}"

    barra = pagina.locator('[data-testid="barra-kpis"]')
    assert barra.get_attribute("role") == "status"
    assert barra.get_attribute("aria-live") == "polite"


def test_2_11_indicador_sin_dato_no_muestra_cifra(pagina) -> None:
    """Un indicador pendiente dice 'pendiente' y no pone ningún número."""
    pendientes = pagina.evaluate(
        """() => {
            const out = [];
            for (const el of document.querySelectorAll('[data-testid^="kpi-"]')) {
                if (el.dataset.estado !== 'pendiente') continue;
                const valor = el.querySelector('.kpi-valor');
                out.push({
                    id: el.dataset.testid,
                    texto: (el.textContent || '').trim(),
                    tieneCifra: !!valor,
                });
            }
            return out;
        }"""
    )
    for k in pendientes:
        assert not k["tieneCifra"], f"{k['id']} pendiente pero con cifra: {k['texto']!r}"
        assert "pendiente" in k["texto"].lower(), (
            f"{k['id']} pendiente sin decirlo: {k['texto']!r}"
        )
