"""Carcasa nativa — abre la ventana pywebview y expone la API Python<->JS.

La ventana se sirve desde `web/dist/index.html` y se expone en el frontend
mediante `window.pywebview.api` con los metodos que el contrato necesita:

- `simular(parametros)` -> dict: ejecuta `app.servicio.simular(...)` y devuelve
  el contrato serializado por `app.contrato.serializar_contrato(...)`.
- `cancelar()` -> None: encola la cancelacion via `app/trabajo.py`.
- `progreso(callback)` -> None: la app JS se suscribe a eventos de progreso.

Este modulo es importable aunque `pywebview` no este instalado: si no lo esta,
`lanzar_ventana()` levanta `RuntimeError` con mensaje claro (no se omite en
silencio). Asi las pruebas que importan simbolos siguen funcionando en CI sin
la dependencia grafica.

Tambien expone las comprobaciones de la tarea 15.5: motor de renderizado
disponible y directorio de datos escribible. Estas funciones son consultadas
por `pruebas/test_arranque_equipo_limpio.py` (tarea 146) sin abrir ventana.
"""

from __future__ import annotations

import os
import pathlib
import subprocess
import sys
import threading
from typing import Any, Callable

from app.contrato import serializar_contrato
from app.servicio import Parametros, simular

# `pywebview` es la tecnologia que monta la ventana nativa. La capa nueva
# (interfaz-web) la declara en `dependencies`; si no esta instalada, el modulo
# sigue siendo importable: las funciones que la usan lo verifican y levantan
# `RuntimeError` con motivo legible (no se omite en silencio).
try:
    import webview  # type: ignore[import-not-found]
except ImportError:
    webview = None  # type: ignore[assignment]


# Evento global para que la aplicacion JS pueda cancelar el calculo en vuelo
# (independiente del Trabajo del calculo). Es el mismo patron que usa
# `app/servicio.py::simular(..., cancelado=threading.Event())`.
_CANCELACION = threading.Event()
_PROGRESO_LISTENERS: list[Callable[[int], None]] = []
_LISTENERS_LOCK = threading.Lock()


def _notificar_progreso(valor: int) -> None:
    """Reenvia el progreso a todos los listeners JS suscritos."""
    with _LISTENERS_LOCK:
        listeners = list(_PROGRESO_LISTENERS)
    for cb in listeners:
        try:
            cb(int(valor))
        except Exception:  # noqa: BLE001
            # un listener que falle no debe tumbar el calculo principal
            pass


def _params_desde_dict(d: dict[str, Any]) -> Parametros:
    """Convierte el dict del frontend a Parametros con valores por defecto."""
    campos = {f.name for f in Parametros.__dataclass_fields__.values()}  # type: ignore[attr-defined]
    limpio: dict[str, Any] = {k: v for k, v in d.items() if k in campos}
    return Parametros(**limpio)


def api_simular(parametros: dict[str, Any]) -> dict[str, Any]:
    """Ejecuta `app.servicio.simular` y devuelve el contrato serializado.

    Esta es la API que la aplicacion JS invoca desde `window.pywebview.api`.
    El contrato conserva todos los campos exigidos por el diseno:
    `parametros`, `resultado`, `series`, `series_meta`, `formulas`, `progreso`,
    `error`, `cancelado`, `payload_bytes`.
    """
    _CANCELACION.clear()
    params = _params_desde_dict(parametros if isinstance(parametros, dict) else {})

    def _progreso(v: int) -> None:
        _notificar_progreso(v)

    salida = simular(params, progreso=_progreso, cancelado=_CANCELACION)
    resultado = salida.get("resultado")
    cancelado = bool(_CANCELACION.is_set() or salida.get("extras", {}).get("estado") == "cancelado")
    error = None
    if isinstance(salida.get("extras"), dict) and salida["extras"].get("estado") == "error":
        error = str(salida["extras"].get("motivo", ""))
    contrato = serializar_contrato(
        params,
        resultado,
        progreso=0 if cancelado else 100,
        error=error,
        cancelado=cancelado,
    )
    return contrato


def api_cancelar() -> None:
    """Marca la cancelacion. La proxima comprobacion de `cancelado.is_set()`
    en el nucleo hara que `simular` salga por la frontera de fase."""
    _CANCELACION.set()


def api_progreso(callback: Callable[[int], None]) -> None:
    """Suscribe una funcion JS (envuelta por pywebview) a los eventos de
    progreso. La suscripcion es global: se mantiene hasta que se reinicie el
    proceso. Es suficiente para la aplicacion: solo hay un calculo activo
    simultaneo."""
    if not callable(callback):
        raise TypeError("callback debe ser callable")
    with _LISTENERS_LOCK:
        _PROGRESO_LISTENERS.append(callback)


def _ruta_dist() -> pathlib.Path:
    """Devuelve la ruta absoluta al bundle compilado (`web/dist/index.html`).

    En desarrollo vive junto al repo. Empaquetado con PyInstaller --onedir,
    ``sys._MEIPASS`` apunta a la carpeta de recursos donde el spec copia
    ``web/dist`` por la entrada ``datas``. Se prefiere ``_MEIPASS`` cuando
    existe y el directorio esta presente alli.
    """
    meipass = getattr(sys, "_MEIPASS", None)
    if meipass:
        candidato = pathlib.Path(meipass) / "web" / "dist" / "index.html"
        if candidato.exists():
            return candidato
    raiz = pathlib.Path(__file__).resolve().parent.parent
    return raiz / "web" / "dist" / "index.html"


def _ruta_datos_usuario() -> pathlib.Path:
    """Directorio de datos escribible por el usuario.

    Windows: %APPDATA%/SimuladorEnergia. Resto: ~/.local/share/simulador_energia.
    La creacion la gestiona ``comprobar_directorio_datos``.
    """
    if sys.platform == "win32":
        base = os.environ.get("APPDATA") or str(pathlib.Path.home())
        return pathlib.Path(base) / "SimuladorEnergia"
    return pathlib.Path.home() / ".local" / "share" / "simulador_energia"


def _detectar_webview2_windows() -> bool:
    """Devuelve True si WebView2 Runtime esta instalado en Windows.

    Busca la clave de registro que Evergreen Runtime crea en
    `HKLM\\SOFTWARE\\WOW6432Node\\Microsoft\\EdgeUpdate\\Clients\\{F30...}`
    (versionado) y la clave equivalente en 32 bits. Cualquier retorno
    exitoso indica que el runtime esta disponible para que pywebview
    lo use.
    """
    if sys.platform != "win32":
        return False
    claves = [
        r"HKLM\SOFTWARE\WOW6432Node\Microsoft\EdgeUpdate\Clients\{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}",
        r"HKLM\SOFTWARE\Microsoft\EdgeUpdate\Clients\{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}",
    ]
    for clave in claves:
        try:
            r = subprocess.run(
                ["reg", "query", clave],
                capture_output=True,
                text=True,
                timeout=5,
            )
            if r.returncode == 0:
                return True
        except (OSError, subprocess.TimeoutExpired):
            continue
    return False


def comprobar_motor() -> tuple[bool, str]:
    """Indica si el motor de renderizado (pywebview + WebView2) esta disponible.

    Devuelve ``(ok, mensaje)``. La deteccion es de dos niveles:

    1. ``pywebview`` instalado: comprobacion por import. Sin el paquete,
       la aplicacion no puede instanciar la ventana nativa.
    2. ``WebView2 Runtime`` instalado en Windows: comprobacion por
       consulta al registro. Sin este runtime, pywebview fallara al
       crear la ventana aunque el paquete este presente.

    Si cualquiera de los dos niveles falla, devuelve ``(False, mensaje)``
    con el motivo exacto para que el usuario sepa que instalar. Cuando
    ambos niveles estan presentes, devuelve ``(True, mensaje)``.

    Usado por la tarea 15.5, la tarea 146 (arranque en equipo limpio,
    variante "motor ausente") y por ``pruebas/test_motor_renderizado.py``.
    """
    if webview is None:
        return (
            False,
            "Motor de renderizado WebView2 no encontrado. Instale Microsoft Edge "
            "WebView2 Runtime (https://developer.microsoft.com/microsoft-edge/"
            "webview2/) y el paquete pywebview (`pip install pywebview`).",
        )

    if sys.platform == "win32" and not _detectar_webview2_windows():
        return (
            False,
            "Motor de renderizado WebView2 no encontrado. Instale Microsoft Edge "
            "WebView2 Runtime desde "
            "https://developer.microsoft.com/microsoft-edge/webview2/.",
        )

    return True, "Motor de renderizado WebView2 disponible"


def comprobar_directorio_datos(ruta: pathlib.Path | None = None) -> tuple[bool, str]:
    """Verifica que el directorio de datos existe o se puede crear y es escribible.

    Devuelve ``(ok, mensaje)``. Pensado para cuentas sin permisos de
    administrador (tarea 15.5). Si ``ruta`` es None, se usa el directorio de
    datos del usuario (%APPDATA%/SimuladorEnergia en Windows,
    ~/.local/share/simulador_energia en el resto).
    """
    destino = pathlib.Path(ruta) if ruta is not None else _ruta_datos_usuario()
    try:
        destino.mkdir(parents=True, exist_ok=True)
        prueba = destino / ".escritura"
        prueba.write_text("ok", encoding="utf-8")
        prueba.unlink()
    except OSError as exc:
        return False, f"Directorio no escribible: {destino} ({exc.strerror or exc})"
    return True, f"Directorio escribible: {destino}"


def lanzar_ventana() -> Any:
    """Abre la ventana nativa apuntando a `web/dist/index.html`.

    Alias historico de `crear_ventana()`. Conservado para compatibilidad
    con `app/__main__.py` y los tests existentes.

    Levanta `RuntimeError` si `pywebview` no esta disponible, con un mensaje
    que indica como instalarlo. La ventana expone `window.pywebview.api` con
    `simular`, `cancelar` y `progreso`.
    """
    return crear_ventana()


def crear_ventana() -> Any:
    """Crea y arranca la ventana nativa que sirve `web/dist/index.html`.

    El tamano de la ventana es 1280 x 720 px (16:9), coherente con el
    tamano de diseno del nivel Diseñar (tarea 20.8). pywebview en modo
    local (apertura de `file://...`) no muestra barra de direcciones ni
    controles de navegador: la aplicacion se presenta como una ventana
    nativa sin cromo web visible. Al cerrar la ventana, pywebview cierra
    el ciclo de eventos y termina el proceso limpiamente sin dejar hilos
    zombi del simulador ni del servicio.

    Levanta `RuntimeError` si:
    - `pywebview` no esta instalado (mensaje claro indica `pip install pywebview`).
    - `web/dist/index.html` no existe (mensaje indica ejecutar `npm run build`).

    Devuelve el objeto ventana que `webview.create_window` retorna, para
    inspeccion en pruebas que mockean pywebview.
    """
    if webview is None:
        raise RuntimeError(
            "pywebview no esta instalado. Para abrir la ventana nativa ejecuta "
            "`pip install pywebview` en un entorno con WebView2 (Windows) o "
            "`webkit2gtk` (Linux)."
        )

    ruta = _ruta_dist()
    if not ruta.exists():
        raise RuntimeError(
            f"No se encontro el bundle compilado en {ruta}. "
            "Ejecuta `npm run build` dentro de `web/` antes de abrir la carcasa."
        )

    api = _APIWebview()
    ventana = webview.create_window(
        title="Simulador Energia Marina",
        url=str(ruta),
        js_api=api,
        width=1280,
        height=720,
    )
    webview.start()
    return ventana


class _APIWebview:
    """API expuesta a JavaScript como `window.pywebview.api`.

    pywebview mapea los metodos publicos de este objeto al espacio de nombres
    `window.pywebview.api`. Los nombres de los metodos coinciden con la
    convencion snake_case de pywebview: `simular`, `cancelar`, `progreso`.
    """

    def simular(self, parametros: dict[str, Any]) -> dict[str, Any]:
        return api_simular(parametros)

    def cancelar(self) -> None:
        api_cancelar()

    def progreso(self, callback: Callable[[int], None]) -> None:
        api_progreso(callback)


__all__ = [
    "lanzar_ventana",
    "crear_ventana",
    "api_simular",
    "api_cancelar",
    "api_progreso",
    "comprobar_motor",
    "comprobar_directorio_datos",
]