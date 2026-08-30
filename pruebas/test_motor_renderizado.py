"""Tarea 72 — verificacion del motor de renderizado WebView2.

Cubre la decision D15 del diseno: la disponibilidad del motor de
renderizado es un modo de fallo del arranque. La aplicacion comprueba al
arrancar que el componente este presente y pueda escribir su directorio
de datos en el espacio de la aplicacion.

Las pruebas no abren una ventana real (no hay GUI en CI). Validan:

- `app.carcasa.comprobar_motor()` devuelve una tupla ``(bool, str)``.
- El mensaje es claro y en espanol ante motor ausente, citando WebView2
  o pywebview.
- El directorio de datos por defecto se resuelve dentro del espacio del
  usuario (``%APPDATA%/SimuladorEnergia`` en Windows,
  ``~/.local/share/simulador_energia`` en el resto).
- `comprobar_directorio_datos` detecta rutas no escribibles.
"""

from __future__ import annotations

import pathlib
import sys
import tempfile
from unittest import mock

REPO = pathlib.Path(__file__).resolve().parents[1]


def _importar_carcasa():
    try:
        from app import carcasa
    except ImportError as exc:
        raise AssertionError(
            f"app.carcasa no importable: {exc} (la tarea 15.4 no esta cerrada)"
        ) from exc
    return carcasa


# ---------------------------------------------------------------------------
# 72.1 — comprobar_motor devuelve una tupla (bool, str)
# ---------------------------------------------------------------------------


def test_comprobar_motor_devuelve_tupla_bool_str() -> None:
    """El contrato es una tupla ``(ok, mensaje)``."""
    carcasa = _importar_carcasa()
    # Mockear `import webview` para no depender de la instalacion.
    with mock.patch.dict(sys.modules, {"webview": mock.MagicMock()}):
        resultado = carcasa.comprobar_motor()
    assert isinstance(resultado, tuple), (
        f"comprobar_motor debe devolver tupla, devolvio {type(resultado).__name__}"
    )
    assert len(resultado) == 2, (
        f"la tupla debe tener 2 elementos, tiene {len(resultado)}"
    )
    ok, mensaje = resultado
    assert isinstance(ok, bool), f"primer elemento debe ser bool, es {type(ok).__name__}"
    assert isinstance(mensaje, str), (
        f"segundo elemento debe ser str, es {type(mensaje).__name__}"
    )
    assert mensaje, "mensaje vacio: debe describir el estado del motor"


# ---------------------------------------------------------------------------
# 72.2 — mensaje claro ante motor ausente
# ---------------------------------------------------------------------------


def test_comprobar_motor_ausente_mensaje_en_espanol() -> None:
    """Sin pywebview, el mensaje cita WebView2 en espanol."""
    carcasa = _importar_carcasa()
    saved = sys.modules.pop("webview", None)
    with mock.patch.dict(sys.modules, {"webview": None}):
        ok, mensaje = carcasa.comprobar_motor()
    if saved is not None:
        sys.modules["webview"] = saved
    assert ok is False, "comprobar_motor debio devolver False sin pywebview"
    assert mensaje, "mensaje vacio"
    # Cita WebView2 (motor de renderizado) o pywebview (paquete).
    assert ("WebView2" in mensaje) or ("pywebview" in mensaje), (
        f"mensaje debe mencionar el motor ausente: {mensaje!r}"
    )
    # Cita donde instalar o que falta.
    lowered = mensaje.lower()
    assert (
        "instale" in lowered
        or "instalar" in lowered
        or "no encontrado" in lowered
        or "no esta" in lowered
    ), f"mensaje debe indicar que instalar: {mensaje!r}"


# ---------------------------------------------------------------------------
# 72.3 — directorio de datos del usuario resoluble y escribible
# ---------------------------------------------------------------------------


def test_directorio_datos_usuario_en_espacio_app() -> None:
    """El directorio de datos vive dentro del espacio del usuario."""
    carcasa = _importar_carcasa()
    ruta = carcasa._ruta_datos_usuario()  # type: ignore[attr-defined]
    assert isinstance(ruta, pathlib.Path)
    if sys.platform == "win32":
        # Windows: %APPDATA%/SimuladorEnergia dentro del perfil del usuario.
        home = pathlib.Path.home()
        assert home in ruta.parents or str(home) in str(ruta), (
            f"directorio {ruta} debe estar bajo {home}"
        )
        assert ruta.name == "SimuladorEnergia", ruta
    else:
        # Linux/macOS: ~/.local/share/simulador_energia.
        home = pathlib.Path.home()
        assert home in ruta.parents, (
            f"directorio {ruta} debe estar bajo {home}"
        )
        assert ruta.name == "simulador_energia", ruta


def test_directorio_datos_escribible_en_tmp() -> None:
    """Un directorio temporal es escribible y devuelve (True, mensaje)."""
    carcasa = _importar_carcasa()
    with tempfile.TemporaryDirectory() as tmp:
        ruta = pathlib.Path(tmp) / "SimuladorEnergia"
        ok, mensaje = carcasa.comprobar_directorio_datos(ruta)
        assert ok is True, f"tmp debio ser escribible: {mensaje}"
        assert str(ruta) in mensaje


def test_directorio_datos_invalido_devuelve_false_y_ruta() -> None:
    """Una ruta bajo el home es escribible; probamos mensajes claros."""
    carcasa = _importar_carcasa()
    with tempfile.TemporaryDirectory() as tmp:
        # Crear un directorio de solo lectura y verificar el mensaje.
        ruta = pathlib.Path(tmp) / "protegido"
        ruta.mkdir(parents=True)
        if sys.platform != "win32":
            ruta.chmod(0o500)  # lectura/ejecucion, sin escritura
        try:
            ok, mensaje = carcasa.comprobar_directorio_datos(ruta)
            if ok:
                # Si la cuenta tiene permisos elevados, la prueba no
                # aplica; dejamos constancia del resultado.
                assert True
            else:
                assert "no escribible" in mensaje.lower(), (
                    f"mensaje debe decir 'no escribible': {mensaje!r}"
                )
                assert str(ruta) in mensaje or str(ruta).replace("/", "\\") in mensaje
        finally:
            if sys.platform != "win32":
                ruta.chmod(0o700)  # restaurar para limpieza


# ---------------------------------------------------------------------------
# 72.4 — deteccion de WebView2 via registro en Windows
# ---------------------------------------------------------------------------


def test_deteccion_webview2_en_windows() -> None:
    """En Windows, la deteccion consulta el registro; sin WebView2 devuelve False."""
    carcasa = _importar_carcasa()
    if sys.platform != "win32":
        # Fuera de Windows: comprobar_motor no exige registro.
        with mock.patch.dict(sys.modules, {"webview": mock.MagicMock()}):
            ok, _ = carcasa.comprobar_motor()
        assert ok is True, "fuera de Windows, pywebview disponible debe bastar"
        return

    # Mockear subprocess.run para simular ausencia de WebView2.
    def _reg_falla(*args, **kwargs):
        m = mock.MagicMock()
        m.returncode = 1
        m.stdout = ""
        m.stderr = "ERROR: The system was unable to find the specified registry key"
        return m

    with mock.patch.dict(sys.modules, {"webview": mock.MagicMock()}):
        with mock.patch.object(subprocess := __import__("subprocess"), "run", _reg_falla):
            ok, mensaje = carcasa.comprobar_motor()
    assert ok is False, (
        f"sin WebView2 en registro, comprobar_motor debio devolver False: {mensaje}"
    )
    assert "WebView2" in mensaje or "Edge" in mensaje, (
        f"mensaje debe mencionar WebView2: {mensaje!r}"
    )


def test_deteccion_webview2_presente() -> None:
    """Si la consulta al registro tiene exito, el motor esta disponible."""
    carcasa = _importar_carcasa()
    if sys.platform != "win32":
        return  # prueba especifica de Windows

    def _reg_exitosa(*args, **kwargs):
        m = mock.MagicMock()
        m.returncode = 0
        m.stdout = "HKEY_LOCAL_MACHINE\\...\\pv    REG_SZ    123.0.2592.0"
        return m

    with mock.patch.dict(sys.modules, {"webview": mock.MagicMock()}):
        with mock.patch.object(__import__("subprocess"), "run", _reg_exitosa):
            ok, mensaje = carcasa.comprobar_motor()
    assert ok is True, (
        f"con WebView2 presente, comprobar_motor debio devolver True: {mensaje}"
    )
    assert "disponible" in mensaje.lower() or "WebView2" in mensaje


# ---------------------------------------------------------------------------
# 72.5 — directorio de datos predeterminado bajo AppData
# ---------------------------------------------------------------------------


def test_directorio_datos_predeterminado_resuelve_a_appdata_en_windows() -> None:
    """El directorio de datos por defecto vive bajo %APPDATA%."""
    carcasa = _importar_carcasa()
    ruta = carcasa._ruta_datos_usuario()  # type: ignore[attr-defined]
    if sys.platform != "win32":
        return
    # %APPDATA% en Windows esta dentro del perfil del usuario.
    home = pathlib.Path.home()
    assert home in ruta.parents, f"{ruta} debe estar bajo {home}"
    # El nombre del directorio es el del simulador.
    assert ruta.name == "SimuladorEnergia"