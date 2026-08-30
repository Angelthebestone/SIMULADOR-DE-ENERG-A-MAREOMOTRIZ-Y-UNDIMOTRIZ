# Aislamiento de red — tráfico atribuible a la aplicación

El simulador arranca sin conexión: la interfaz web vive en `web/dist/`,
los datos en `datos/` y el código Python en `nucleo/`, `analisis/` y
`app/`. Este documento distingue el tráfico que la aplicación emite del
tráfico que emite el motor de renderizado del sistema, para que el
criterio de aceptación del aislamiento (tarea 15.6) no falle por ruido
ajeno ni se apruebe gracias a él.

## Tráfico atribuible a la aplicación

Todo lo que sale desde los archivos servidos por `web/dist/` o desde el
proceso Python de la aplicación:

| Origen | Destinos admitidos | Mecanismo |
|---|---|---|
| `web/dist/index.html` | `file://...` (local) | Apertura nativa de pywebview, sin servidor. |
| `web/dist/assets/*.js` y `*.css` | Recursos locales (CSP: `default-src 'self'`). | Ninguna petición de red. La verificación está en `pruebas/test_csp_interfaz.py` y `pruebas/test_construccion_web.py`. |
| `.pmtiles` (vectoriales y rásteres congelados) | Local (`file://` o `data:`). | MapLibre consume PMTiles directamente desde disco; el CSP permite `data:` para img-src. |
| Fuentes tipográficas | Local (`file://` o pila del sistema, sin descargas). | `web/src/styles/tokens.css` declara la pila del sistema (`Segoe UI Variable`, `Segoe UI`, `system-ui`); no se carga ninguna fuente remota. |
| Llamadas al núcleo Python (`window.pywebview.api`) | IPC local entre JS y Python, sin red. | pywebview mapea los métodos de `_APIWebview` directamente. |
| `app/carcasa.py::_ruta_datos_usuario()` | `%APPDATA%/SimuladorEnergia` (Windows) o `~/.local/share/simulador_energia` (resto). | El proceso Python escribe en el espacio del usuario; nunca contacta servidores. |
| Verificación de dependencias, ingestas, etc. | **Fuera** del proceso de la aplicación. Los scripts de `datos/*/descargar_*.py` requieren credenciales explícitas; el simulador no las carga. | Documentado en `documentacion/cuentas_ingesta.md`. |

**Conclusión:** la aplicación no emite ninguna petición HTTP saliente
en una sesión normal. Cualquier petición a un dominio remoto detectable
desde `web/dist/` o desde el código Python de la aplicación es un
defecto.

## Tráfico del motor de renderizado

El motor de renderizado del sistema (WebView2 en Windows, WebKit en
macOS, WebKitGTK en Linux) puede emitir tráfico propio aunque la
aplicación no se lo pida. Esto es independiente del código del
simulador y debe descontarse del criterio de aislamiento:

| Componente del sistema | Destinos conocidos | Motivo |
|---|---|---|
| WebView2 (Windows) | `*.microsoft.com`, `*.msn.com`, `*.bing.com`, `*.windows.com` | Telemetría opcional (puede desactivarse vía políticas de grupo o claves de registro), actualizaciones automáticas, listas de bloqueo de SmartScreen, comprobación de NTP/horarios. |
| WebView2 (Windows) | `*.google.com`, `*.gstatic.com`, `clients2.google.com` | Lista de bloqueo de SafeBrowsing/Phishing (motor de Google), descargada en background. |
| WebView2 (Windows) | `*.appex-rf.msn.com`, `*.appex-rf.msn.com` | Configuración y actualización del propio componente. |
| WebKit (macOS) | `*.apple.com`, `*.icloud.com` | Listas de bloqueo y actualizaciones; comportamiento análogo a WebView2. |
| WebKitGTK (Linux) | `*.ubuntu.com`, `*.gnome.org` según distribución | Telemetría opcional y actualizaciones. |

Este tráfico no es atribuible al simulador. Sin la separación que
define este documento, dos modos de fallo se vuelven indistinguibles:

- **Falso positivo**: una petición a `*.microsoft.com` por telemetría
  del motor hace fallar la prueba de aislamiento, y el desarrollador
  modifica el código para "arreglar" algo que no es del simulador.
- **Falso negativo**: el motor no emitió telemetría durante una
  sesión corta y una fuente remota servida por CDN quedó aprobada,
  porque la prueba observó cero peticiones en esa ventana.

## Criterio de aceptación

Durante una sesión de **5 minutos con la aplicación abierta, sin
interacción del usuario**, los recursos solicitados desde `web/dist/`
deben tener como destino únicamente URLs locales (`file://...`,
`data:...`, o rutas relativas que `vite` haya empaquetado como
`/assets/...` resueltas contra el origen local del bundle).

El tráfico del motor de renderizado a `*.microsoft.com`,
`*.google.com` y similares **no cuenta** contra el criterio. El
objetivo es que la aplicación no haga la petición, no que el equipo
deje de emitir ningún paquete.

## Cómo se mide

La prueba del criterio está en la suite que la tarea 24.4 del plan
define como "observar el tráfico saliente durante una sesión
completa". La verificación estructural que ya cubre este contrato:

- `pruebas/test_construccion_web.py` confirma que `web/dist/` no
  contiene URLs absolutas ni CDNs conocidos, y que dos builds
  consecutivos producen el mismo árbol.
- `pruebas/test_csp_interfaz.py` confirma que el CSP del HTML
  construido admite únicamente orígenes locales y las excepciones
  (`'unsafe-eval'`, `'unsafe-inline'`, `data:`, `blob:`, `ws:`,
  `wss:`) que el motor necesita para arrancar.

La verificación dinámica del criterio —observar los sockets durante
una sesión real— queda fuera del alcance de las pruebas automatizadas
de esta tarea porque requiere un entorno con captura de tráfico
(`netsh trace`, `Wireshark`) y un WebView2 arrancado. Su resultado
documental se adjunta al manual de la sustentación cuando se ejecuta
en el equipo del tribunal.

## Cómo se diagnostica un fallo

Si una captura muestra una petición atribuible a la aplicación:

1. Buscar la URL completa en `web/src/`, `web/dist/`, `nucleo/`,
   `analisis/` y `app/` con `git grep -E 'https?://[^"'\'' ]+'`.
2. Si está en `web/src/`, el origen del fallo está en una dependencia
   o en una fuga introducida al portar; corregir y reconstruir.
3. Si está solo en `web/dist/` y no en `web/src/`, el vendorizado de
   una dependencia npm trae una URL remota; reemplazar o vendorizar.
5. Si no aparece en el código, inspeccionar el manifest del WebView
   (`edge://policy`, `about:policy`) por si una política del sistema
   fuerza el contacto con un dominio concreto.

Si la captura muestra una petición **del motor** (WebView2 a
`*.microsoft.com`, WebKit a `*.apple.com`, etc.), no es un fallo de
la aplicación y se documenta como tráfico de la plataforma.