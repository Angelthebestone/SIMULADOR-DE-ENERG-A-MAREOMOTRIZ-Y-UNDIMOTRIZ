## Why

La interfaz Qt cumple su función pero llegó al techo del medio: QSS no admite transiciones, sombras reales ni tipografía compuesta, las fórmulas del nivel Calcular se muestran como texto plano (`rho g² Hm0² Te / (64 pi)`) en lugar de matemática tipografiada, y el mapa dibuja polígonos sobre un océano de color liso. Esas tres carencias no son de código sino de la tecnología de presentación elegida.

Al mismo tiempo el proyecto arrastra huecos de datos que la fase anterior dejó registrados y no pudo cerrar: la discrepancia sin explicar entre los 8,9 kW/m revisados por pares de Isla Fuerte y los 1,96 kW/m de ERA5, tres de los cinco emplazamientos sin dato de corriente, y una dependencia de MHKiT declarada en `pyproject.toml` que ni está instalada ni se importa en ninguna parte.

Los dos problemas se resuelven juntos porque comparten una pieza: el mapa nuevo es lo que da sentido a ingerir rásteres satelitales, y los rásteres satelitales son lo que hace que valga la pena reescribir el mapa.

## What Changes

**Fase 0 — Validación contra implementaciones de referencia**

- Adoptar MHKiT y wavespectra como oráculos en `pruebas/`, no como dependencias de ejecución: el núcleo mantiene sus fórmulas escritas a mano y legibles, y las pruebas verifican que coinciden con la implementación de referencia.
- Corregir la declaración muerta de MHKiT en `pyproject.toml`: hoy figura como dependencia de **ejecución** con un marcador `python_version<'3.12'` que la elimina en silencio. Retirar el marcador sin más la convertiría en una dependencia de ejecución instalada y empaquetada, que es justo lo que el spec de `validacion-referencia` prohíbe. La corrección es moverla al conjunto de desarrollo y dejar el marcador.
- Contrastar una vez, fuera del simulador, el AEP y el LCOE de Isla Fuerte contra el modelo de energía undimotriz de InVEST.

**Fase 0.5 — Reubicar la capa de servicio antes de retirar nada**

- `interfaz/calculo.py` no es interfaz: su cabecera declara que no contiene Qt y aloja `Parametros`, `simular()`, la matriz de potencia, la lectura de series de oleaje y el registro de dispositivos. Se traslada a la capa de servicio y se actualizan sus importadores.
- Las tres suites de física y datos que hoy importan `interfaz/` (`test_stress_core`, `test_stress_datos`, `test_stress_rendimiento`: 106 casos entre las tres) se reencaminan al servicio y se libera su acoplamiento a la presentación, para que ninguna de ellas dependa de la capa que se va a retirar.
- Se elimina la omisión condicional por dependencia ausente en `pruebas/`: hoy dos de esas suites usan `importorskip("PySide6")` y, al irse PySide6, dejarían de ejecutarse en silencio mientras la casilla de «no regresión» sigue en verde.

**Fase 1 — Ingesta de fuentes nuevas**

- Nuevos scripts de descarga en `datos/`, siguiendo el patrón de los nueve existentes: Copernicus Marine (oleaje 1/12° y corrientes GLORYS12), Google Earth Engine (Sentinel-2, batimetría GEBCO, luces nocturnas VIIRS, modelo digital del terreno), FES2022 para constituyentes de marea.
- Un tercer valor independiente de densidad de potencia para Isla Fuerte, a resolución 1/12°, que arbitre la discrepancia registrada.
- Dato de corriente propio para Isla Fuerte, Islas del Rosario y San Andrés, que hoy no lo tienen, y para Tumaco, que hereda el de Bahía Málaga.
- Las credenciales de Copernicus Marine, Earth Engine y AVISO viven solo en la fase de ingesta. El simulador sigue sin tocar la red.

**Fase 2 — Interfaz web**

- Sustituir la capa `interfaz/` en PySide6 por una interfaz en HTML, CSS y TypeScript servida dentro de una ventana nativa por pywebview sobre el WebView2 de Windows.
- Mapa de seis capas con MapLibre GL: batimetría sombreada, imagen Sentinel-2, relieve terrestre, base vectorial PMTiles, capas de datos (RUNAP, emplazamientos, recurso) y luces nocturnas conmutables.
- Fórmulas tipografiadas con KaTeX en el nivel Calcular.
- Animación del nivel Ver sobre Canvas 2D, alimentada por la misma serie ya integrada.
- Gráficas analíticas con Plotly (compuestas en Python) y Sankey con ECharts.
- Manifiesto de construcción de la interfaz (`package.json` con versiones fijadas y bloqueadas). No existe hoy y sin él no se puede construir nada: las cuatro bibliotecas de representación que nombra esta propuesta no están declaradas en ningún sitio.
- Aislamiento de red impuesto por construcción con una política de origen, además de verificado con una prueba: el tráfico propio del motor de renderizado no es tráfico de la aplicación, y sin ese límite el requisito de desconexión se comprueba contra un ruido que la aplicación no controla.
- Comprobación del motor de renderizado al arrancar, con su directorio de datos dentro del espacio de la aplicación. Su ausencia y su falta de permisos de escritura son modos de fallo del arranque que hoy ningún spec contempla.
- Los defectos de presentación ya registrados en `.commandcode/design/review-report.md` (foco visible, affordance del mapa, valor visible en cada control, control de la animación, navegación del nivel Diseñar) pasan a ser requisitos y casos de prueba de la capa nueva, no memoria de la capa vieja.
- **BREAKING**: se retira la parte de `interfaz/` que sí es presentación en PySide6, y la dependencia `PySide6` de `pyproject.toml`. El empaquetado pasa de `--onefile` a `--onedir` porque el artefacto crece con los rásteres y el basemap.
- Las pruebas de interfaz pasan de Qt a Playwright, con el recuento de casos comparado respecto a los 76 anteriores.

`nucleo/` y `analisis/` no cambian de física. Dos piezas sí se tocan, y conviene decirlo aquí en lugar de descubrirlo en la fase 2: `nucleo/resultado.py` se extiende para que el contrato transporte series, unidades, fuentes y estados (`to_dict()` pierde hoy el campo `series`, que es el que necesita la animación), y `app/formulas.py` pasa a entregar la expresión junto con su sustitución y su resultado en lugar de una sola cadena de texto.

## Capabilities

### New Capabilities

- `validacion-referencia`: verificación de las implementaciones propias del núcleo contra bibliotecas de referencia externas (MHKiT según IEC TS 62600, wavespectra, InVEST), ejecutada en pruebas y nunca en el simulador.
- `ingesta-datos-externos`: disciplina de la frontera offline. Cómo se descargan, congelan, versionan y atribuyen las series de fuentes que exigen credenciales, y por qué esas credenciales nunca cruzan a la ejecución.
- `interfaz-web`: capa de presentación en tecnologías web dentro de ventana nativa, su contrato con el núcleo, su empaquetado y sus pruebas.

### Modified Capabilities

- `niveles-divulgacion`: el requisito de no congelar la interfaz deja de nombrar `QThread`; la animación pasa a Canvas; las fórmulas del nivel Calcular pasan de texto plano a matemática compuesta; el modo sustentación se redefine sobre el medio web.
- `mapa-potencial`: de tres capas estáticas a seis capas navegables con zoom continuo, y el requisito de origen local se amplía a los rásteres y al basemap vectorial.
- `arquitectura-y-calidad`: el patrón Observer deja de nombrar señales Qt; el requisito de entrega empaquetada admite distribución en carpeta; la prohibición de importar `PySide6` desde el núcleo se generaliza a cualquier biblioteca de presentación.
- `trazabilidad-datos`: la prohibición de peticiones de red se extiende a los recursos de la interfaz; se añaden las atribuciones y licencias de Copernicus Marine, Earth Engine, GEBCO, FES2022, Sentinel-2, VIIRS y la cartografía base; y se añade el requisito de presentar juntos dos valores discrepantes de la misma magnitud.
- `emplazamientos`: cada emplazamiento pasa a exigir dato de corriente propio o declararlo pendiente, y la discrepancia de densidad de potencia de Isla Fuerte pasa a ser un requisito de presentación explícita en lugar de una nota.

## Impact

**Código afectado**

Contado sobre el repositorio, no sobre la memoria del plan:

- `interfaz/` son 2.652 líneas, de las cuales **2.304 son presentación en PySide6** (`app.py`, `paneles.py`, `mapa.py`, `graficas.py`, `estilo.py`, `sankey.py`) y **348 son la capa de servicio** (`calculo.py`), que no importa Qt y se reubica en la fase 0.5. Retirar el directorio entero se llevaría el cálculo por delante.
- `pruebas/` recoge **222 casos en 160 funciones**, en nueve suites. Contados por lo que la migración toca: **76 casos** de presentación (`test_interfaz_bloqueC` 24 y `test_stress_interfaz` 52) se reescriben sobre Playwright; el «61 pruebas» del plan era un recuento de funciones, y son 61 funciones pero 76 casos. De las otras siete suites, **106 casos de tres importan ya `interfaz/`** y hay que reencaminarlos, y solo **40 casos** son de física y datos puros. La cifra de «~89 pruebas intocables» con la que el plan justifica su riesgo no sale por ningún lado.
- De esos 106 casos, `test_stress_core` (74) fallará ruidosamente al retirar la capa, pero `test_stress_datos` (22) y `test_stress_rendimiento` (10) usan `importorskip("PySide6")` y **se saltarán en silencio**: 32 casos de la verificación de no regresión desaparecen sin que nada lo avise.
- `nucleo/` no cambia de física; `nucleo/resultado.py` se extiende para el contrato. `app/formulas.py` se extiende para emitir expresión, sustitución y resultado juntos. `analisis/` no se modifica.
- `datos/` gana subdirectorios, scripts de descarga y un manifiesto con hashes. Hoy no está versionado: `git ls-files -- datos` devuelve 0 archivos, así que el requisito de «archivos versionados dentro de la distribución» empieza de cero y hay que decidir la política para los 62,5 MB de series CSV de marea e IDEAM que ya contiene.

**Dependencias**

- Salen de ejecución: `PySide6`.
- Entran en ejecución: `pywebview`, `plotly` (composición de figuras en Python), `seaborn` (figuras que genera la aplicación en tiempo de ejecución, no solo el informe).
- Entran en `[dev]`: `mhkit` (se mueve desde ejecución), `wavespectra`, `playwright`.
- Entran en un extra `[ingesta]` nuevo, nunca en ejecución: `copernicusmarine`, `earthengine-api`, `geemap`, `xarray`, `netCDF4`, `pyfes`. `wavespectra` NO va aquí: es oráculo de pruebas, no cliente con credenciales, y declararla en los dos conjuntos hace ambigua su política.
- Entran en el manifiesto de construcción de la interfaz, fijadas y vendorizadas: `maplibre-gl`, `katex`, `plotly.js`, `echarts`, más el tipificado de MapLibre y las tipografías. Ninguna de las cuatro aparece hoy en `pyproject.toml` ni en ningún manifiesto, y todas tienen que llegar al artefacto sin red.
- Se mantienen intactas: `numpy`, `scipy`, `utide`, `matplotlib`.

**Riesgos**

- El arranque sin conexión es lo más fácil de romper: un solo recurso web servido desde CDN invalida el requisito. Toda dependencia de frontend debe quedar incorporada al artefacto, y la política de origen debe rechazar la remota para que el fallo sea ruidoso y no un aspecto degradado.
- El requisito de «cero peticiones salientes» puede fallar por culpa ajena: el motor de renderizado del sistema emite tráfico propio aunque la aplicación no pida nada. Sin declarar qué tráfico es atribuible a la aplicación, el criterio de aceptación queda indefinido.
- El riesgo más silencioso de esta migración no es visual sino de verificación: dos suites de física y datos se saltan si falta PySide6. Al retirarlo, la casilla que debía detectar una regresión se queda vacía y verde.
- La capa de servicio vive hoy dentro del directorio que la fase 2 retira. Si la retirada se ejecuta tal como estaba escrita, se lleva el cálculo de la matriz de potencia y el contrato de simulación.
- El motor de renderizado puede no estar instalado, o puede no poder escribir su directorio de datos con una cuenta sin permisos. Ningún spec contemplaba ese modo de fallo del arranque.
- El artefacto empaquetado crece de forma apreciable con el basemap y los rásteres. Con `--onefile` eso se traduce en descompresión a temporales en cada arranque, justo el escenario de la sustentación en vivo.
- Se introduce Node y npm como herramientas de construcción. El artefacto final son ficheros estáticos, de modo que el equipo donde se demuestra no los necesita.
- El arbitraje de la discrepancia de Isla Fuerte puede no resolverla. El requisito exige presentarla, no cerrarla.

**Fuera de alcance**

- Reescribir el núcleo de física en otro lenguaje. Se descarta explícitamente: `utide` y SciPy no tienen equivalente y las pruebas de física quedarían invalidadas.
- Sustituir las fórmulas propias por llamadas a MHKiT o wavespectra. Las fórmulas escritas y legibles son el producto didáctico.
- DTOcean y DTOceanPlus: alcance de diseño de parques, Python 2.7 y licencia AGPL incompatible con el MIT del proyecto.
