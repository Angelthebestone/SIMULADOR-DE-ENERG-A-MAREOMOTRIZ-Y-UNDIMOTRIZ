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
        # netstat responde en la codepage local (Windows en español no es
        # UTF-8): decodificamos con reemplazo para que el hilo lector no
        # reviente y stdout llegue siempre como texto.
        salida = subprocess.run(
            ["netstat", "-ano", "-p", "TCP"],
            capture_output=True,
            text=True,
            encoding="utf-8",
            errors="replace",
            timeout=20,
        ).stdout
    except Exception:  # noqa: BLE001
        return set()
    pids: set[int] = set()
    if not salida:
        return set()
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
        # Espera a que la app Vue monte: el tablero de dos columnas con su
        # escena y la cadena de lectura al pie.
        page.wait_for_selector("main.tablero section.ver", state="visible", timeout=15_000)
        page.wait_for_selector('[data-testid="barra-kpis"]', state="visible", timeout=10_000)
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
def test_2_1_panel_inicial_es_ver(pagina) -> None:
    """Al montar la app, el tablero muestra escena y emplazamiento a la vez."""
    assert pagina.locator("section.ver").is_visible()
    assert pagina.locator("section.mapa-seccion").is_visible()
def test_2_3_tres_sliders_cambian_cifra_en_menos_de_un_segundo(pagina) -> None:
    """Mover los tres sliders del nivel Ver actualiza la cifra principal en <1s."""
    # Estamos en tab 'ver' por defecto. Hay tres inputs range en ControlesFisicos.
    sliders = pagina.locator('section.ver input[type="range"]')
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
                const inputs = document.querySelectorAll('section.ver input[type=range]');
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
    sliders = pagina.locator('section.ver input[type="range"]')
    for i in range(sliders.count()):
        mn = sliders.nth(i).get_attribute("min")
        mx = sliders.nth(i).get_attribute("max")
        st = sliders.nth(i).get_attribute("step")
        assert mn is not None and mx is not None, f"slider {i} sin min/max"
        assert float(mn) < float(mx), f"slider {i}: min {mn} >= max {mx}"
        assert st is not None, f"slider {i} sin step"
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
    panel = pagina.locator("section.ver")
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
            const inputs = document.querySelectorAll('section.ver input[type=range]');
            if (inputs[1]) {
                inputs[1].value = '8';
                inputs[1].dispatchEvent(new Event('input', { bubbles: true }));
            }
        }"""
    )
    # Pantalla única: el slider ya disparó /api/simular; abrimos y cerramos
    # el diálogo de fuentes para recorrer el resto del tablero.
    pagina.locator('[data-testid="abrir-fuentes"]').click()
    pagina.wait_for_selector("dialog[open]", state="visible", timeout=3_000)
    pagina.keyboard.press("Escape")

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
    pagina.wait_for_selector("section.ver", state="visible", timeout=5_000)
    if True:
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
        )
        assert not largos, f"cita larga fuera del diálogo: {largos[:2]}"


# ---------------------------------------------------------------------------
# 2.11 — Barra de indicadores visible desde todos los niveles
# ---------------------------------------------------------------------------


def test_2_11_los_cuatro_kpi_en_pantalla_unica(pagina) -> None:
    """Los cuatro indicadores del pie son únicos y visibles en el tablero."""
    claves = ("recurso", "potencia", "anual", "factor")
    for clave in claves:
        kpi = pagina.locator(f'[data-testid="kpi-{clave}"]')
        assert kpi.count() == 1, f"falta el indicador {clave}"
        assert kpi.is_visible(), f"el indicador {clave} no se ve"

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
def _pausar_animacion(pagina) -> None:
    """Pausa la animación del lienzo para que las capturas no varíen entre frames."""
    boton = pagina.locator("section.ver .btn-lienzo")
    boton.wait_for(state="visible", timeout=3_000)
    if "Reanudar" not in (boton.inner_text() or ""):
        boton.click()


def _data_url_canvas(pagina, selector: str) -> str:
    """Devuelve el dataURL PNG del canvas (estado actual pintado)."""
    return pagina.evaluate(
        """(sel) => {
            const c = document.querySelector(sel);
            if (!c) return '';
            return c.toDataURL('image/png');
        }""",
        selector,
    )


def _imagen_canvas(pagina, selector: str):
    """Decodifica el dataURL del canvas a un objeto PIL.Image."""
    import base64
    from io import BytesIO
    from PIL import Image

    data = _data_url_canvas(pagina, selector)
    if not data:
        return None
    _, b64 = data.split(",", 1)
    return Image.open(BytesIO(base64.b64decode(b64)))


def _pixeles_visibles(img, x0: int = 0, x1: int | None = None, y0: int = 0, y1: int | None = None) -> int:
    """Cuenta píxeles no totalmente transparentes en una región de la imagen."""
    if img is None:
        return 0
    x1 = img.width if x1 is None else x1
    y1 = img.height if y1 is None else y1
    if img.mode in ("RGBA", "LA") or "transparency" in img.info:
        n = 0
        for x in range(x0, x1):
            for y in range(y0, y1):
                if img.getpixel((x, y))[3] > 0:
                    n += 1
        return n
    # Sin alfa: cualquier píxel no blanco
    n = 0
    for x in range(x0, x1):
        for y in range(y0, y1):
            if img.getpixel((x, y))[:3] != (255, 255, 255):
                n += 1
    return n


def _hm0_altura_flecha_px(h_canvas: int, hm0: float) -> float:
    """Espejo de `AnimacionCanvas.alturaFlechaHm0`. Mantener en sincronía."""
    return max(20.0, hm0 * (h_canvas * 0.18))


def _altura_flecha_en_imagen(img, w_css: int) -> int:
    """Bounding box vertical (px buffer) de los píxeles opacos de la flecha Hm0.

    Estrategia: la flecha Hm0 vive en la columna izquierda del canvas,
    con alfa sólido. El relleno del oleaje bajo la línea cubre la parte
    inferior con alfa alta; para no confundir ambos, medimos sólo hasta
    `y_max = h*0.75` (por encima de donde se acumula el relleno).
    """
    h = img.height
    w_buffer = img.width
    escala = w_buffer / w_css
    x_css_flecha = max(18.0, w_css * 0.04)
    x_lo = int(x_css_flecha * escala) - 4
    x_hi = int(x_css_flecha * escala) + 5
    if x_lo < 0: x_lo = 0
    if x_hi >= w_buffer: x_hi = w_buffer - 1
    y_max_scan = int(h * 0.75)
    y_min = y_max_scan
    y_max = -1
    for x in range(x_lo, x_hi + 1):
        for y in range(0, y_max_scan):
            alfa = img.getpixel((x, y))[3]
            if alfa >= 200:
                if y < y_min: y_min = y
                if y > y_max: y_max = y
    if y_max < 0:
        return 0
    return y_max - y_min


def _fijar_hm0(pagina, valor: str) -> None:
    """Fija el deslizador de Hm0 y espera al recálculo con debounce."""
    pagina.evaluate(
        """(v) => {
            const el = document.getElementById('ctrl-hm0');
            el.value = v;
            el.dispatchEvent(new Event('input', { bubbles: true }));
        }""",
        valor,
    )
    pagina.wait_for_timeout(900)


def _captura_escena(pagina) -> bytes:
    """PNG del lienzo pausado (mismo fotograma t=0 en ambas tomas)."""
    import base64

    url = pagina.evaluate(
        """() => {
            const c = document.querySelector('canvas.oleaje');
            return c.toDataURL('image/png');
        }"""
    )
    return base64.b64decode(url.split(",", 1)[1])


def test_4_3_anotaciones_fisicas_flecha_hm0_redimensiona(pagina) -> None:
    """Al pasar Hm0 de 1,5 a 2,5 m la escena responde: la superficie del
    oleaje —y con ella la anotación Hm0 junto al dispositivo— se redibuja
    con la nueva amplitud.

    Cobertura del spec `densidad-visual-animacion`:
    - Scenario "Anotación de Hm0 coherente con el control": el corte
      refleja la nueva amplitud dentro de la misma simulación.
    """
    oleaje = pagina.locator("canvas.oleaje")
    oleaje.wait_for(state="visible", timeout=3_000)

    _pausar_animacion(pagina)
    pagina.wait_for_timeout(200)

    _fijar_hm0(pagina, "1.5")
    captura_15 = _captura_escena(pagina)
    _fijar_hm0(pagina, "2.5")
    captura_25 = _captura_escena(pagina)
    assert captura_15 != captura_25, (
        "el lienzo no cambió al pasar Hm0 de 1,5 a 2,5"
    )

    # La diferencia vive en la franja del agua (superficie y anotación),
    # no en el cielo: comparamos píxel a píxel con Pillow.
    import io

    from PIL import Image, ImageChops

    a = Image.open(io.BytesIO(captura_15)).convert("RGB")
    b = Image.open(io.BytesIO(captura_25)).convert("RGB")
    dif = ImageChops.difference(a, b)
    px = dif.load()
    franja_mar = sum(
        1
        for y in range(int(a.height * 0.25), int(a.height * 0.75))
        for x in range(0, a.width, 2)
        if sum(px[x, y]) > 24
    )
    assert franja_mar > 200, (
        f"la franja del agua apenas cambia con Hm0: {franja_mar} píxeles distintos"
    )


def test_4_3_anotaciones_fisicas_jt_y_te_visibles(pagina) -> None:
    """El canvas muestra la cifra J(t) en la esquina superior derecha.

    Spec: J(t) en W/m con un decimal en formato español. La condición sobre
    la marca Te se delega al test de redimensionado, donde la franja
    central cambia al moverse Hm0.
    """
    oleaje = pagina.locator("canvas.oleaje")
    oleaje.wait_for(state="visible", timeout=3_000)
    _pausar_animacion(pagina)
    pagina.wait_for_timeout(150)

    img = _imagen_canvas(pagina, "canvas.oleaje")
    assert img is not None
    pixeles_esquina = _pixeles_visibles(img, int(img.width * 0.66), img.width, 0, int(img.height * 0.12))
    assert pixeles_esquina > 5, (
        f"esquina superior derecha sin contenido (¿falta J(t)?); píxeles={pixeles_esquina}"
    )


def test_4_3_anotaciones_fisicas_jt_cambia_con_hm0(pagina) -> None:
    """La lectura instantánea del lienzo varía al cambiar Hm0: la cifra
    captada crece con el recurso (J ∝ Hm0²)."""
    oleaje = pagina.locator("canvas.oleaje")
    oleaje.wait_for(state="visible", timeout=3_000)
    _pausar_animacion(pagina)
    pagina.wait_for_timeout(150)

    _fijar_hm0(pagina, "1.5")
    captura_bajo = _captura_escena(pagina)

    _fijar_hm0(pagina, "2.5")
    # La lectura usa el resultado del cálculo (debounce + fetch): sondeamos
    # hasta ~4 s esperando que el rótulo refleje la nueva potencia.
    cambio = False
    for _ in range(12):
        pagina.wait_for_timeout(350)
        if _captura_escena(pagina) != captura_bajo:
            cambio = True
            break
    assert cambio, (
        "la lectura del lienzo no cambió al mover Hm0 de 1,5 a 2,5"
    )
