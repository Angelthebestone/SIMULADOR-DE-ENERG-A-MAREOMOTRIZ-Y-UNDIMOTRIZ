# Plan de trabajo

Orden de construcción: entorno y dependencias → suite e2e real → ingesta ejecutada → pirámide ráster → tercer valor de Isla Fuerte → oráculos instalados.

---

## 1. Entorno y dependencias

- [ ] 1.1 Añadir `playwright` a `[dev]` en `pyproject.toml` y verificar que `pip install -e ".[dev]"` la deja instalada e importable. Documentar en `documentacion/construccion_interfaz_web.md` el paso `playwright install chromium` como dependencia del entorno. [e2e-navegacion]
- [ ] 1.2 Añadir `statsmodels` a `[dev]` en `pyproject.toml` con una nota que documente que es dependencia transitiva de `mhkit` para el oráculo JONSWAP, y verificar que `pip install -e ".[dev]"` la instala y que `import statsmodels` funciona. [validacion-referencia]
- [ ] 1.3 Verificar que `pyproject.toml` declara `mhkit` y `wavespectra` solo en `[dev]` y no en `dependencies`, y que `pip install .` (sin extras) no las instala. La suite `pruebas/test_dependencias.py` debe seguir pasando. [validacion-referencia]
- [ ] 1.4 Verificar que `playwright install chromium` deja un binario funcional, y que `python -c "from playwright.sync_api import sync_playwright; sync_playwright().start().chromium.launch(headless=True).close()"` ejecuta sin error. [e2e-navegacion]

## 2. Suite e2e con Playwright

- [ ] 2.1 Reescribir `pruebas/test_e2e_interfaz_web.py` para que arranque `npm run dev` en background, abra `http://127.0.0.1:5173/` con Playwright Chromium headless, espere a que la app monte, y verifique que los cinco tabs (ver, comparar, calcular, disenar, mapa) están presentes. Terminar el dev server al final. [e2e-navegacion] [interfaz-web]
- [ ] 2.2 Escribir el caso que recorre las cinco pestañas por teclado (Tab, flechas, Home, End, Enter, Space) y verifica que el foco pasa al encabezado de cada nivel y que `aria-selected` refleja la pestaña activa. [e2e-navegacion]
- [ ] 2.3 Escribir el caso que arrastra los tres controles deslizantes del nivel Ver, lee el valor de la cifra principal y verifica que cambia dentro de un segundo desde el fin del arrastre. [e2e-navegacion]
- [ ] 2.4 Escribir el caso que lanza una simulación con `completo=True` y la cancela a los 200 ms; verificar que el progreso queda entre 1 y 99 y que el campo `cancelado` del contrato es `true`. [e2e-navegacion]
- [ ] 2.5 Escribir el caso que activa y desactiva cada capa conmutable del mapa (batimetría sombreada, Sentinel-2 mediana, relieve, luces nocturnas, RUNAP, sitios) y verifica que el DOM refleja el cambio sin recálculo de la simulación. [e2e-navegacion] [mapa-potencial]
- [ ] 2.6 Escribir el caso que verifica los atajos Ctrl+E (activar modo sustentación) y ESC (desactivarlo) leyendo el atributo `data-sustentacion` y el valor de `--escala` en el documento. [e2e-navegacion]
- [ ] 2.7 Escribir el caso que recorre la app solo con teclado y verifica que cada control operable muestra un indicador de foco visible. [e2e-navegacion]
- [ ] 2.8 Escribir la prueba que observa el tráfico de red durante la suite completa (servidor local, sin remotos) y falla si se registra cualquier petición a un dominio externo. [e2e-navegacion] [trazabilidad-datos]
- [ ] 2.9 Verificar que la suite es determinista ejecutándola dos veces seguidas: ambas producen el mismo número de pasos pasados y fallidos, y ningún test falla por timeout. [e2e-navegacion]

## 3. Ingesta ejecutada contra APIs reales

- [ ] 3.1 Documentar en `documentacion/cuentas_ingesta.md` qué credenciales se necesitan para cada fuente y cómo se configuran (`~/.copernicusmarine.cfg`, `earthengine authenticate`, sin credenciales para CIOH/IDEAM/FES). [ingesta-datos-externos]
- [ ] 3.2 Ejecutar `datos/cmems/descargar_oleaje_cmems.py` con credenciales de Copernicus Marine para los cinco emplazamientos, verificar que produce los CSV y los `resumen_oleaje_cmems.json` actualizados, y registrar cada archivo en `datos/manifiesto.json` con su hash SHA-256. [ingesta-datos-externos]
- [ ] 3.3 Ejecutar `datos/cmems/descargar_corrientes_glorys.py` con credenciales de Copernicus Marine para los cinco emplazamientos, verificar que produce los CSV y el resumen de corrientes, y registrar en el manifiesto. [ingesta-datos-externos]
- [ ] 3.4 Ejecutar `datos/fes/descargar_constituyentes_fes.py` (sin credenciales, público) y registrar los constituyentes de elevación en el manifiesto. [ingesta-datos-externos]
- [ ] 3.5 Ejecutar `datos/gee/descargar_rasteres.py` con credenciales de Earth Engine para Sentinel-2, GEBCO, relieve (Copernicus DEM GLO-30) y VIIRS, y registrar las imágenes georreferenciadas de origen en el manifiesto. [ingesta-datos-externos] [piramide-raster]
- [ ] 3.6 Ejecutar `datos/ideam/descargar_ideam.py` y `datos/oleaje/descargar_cioh_climatologia.py` (sin credenciales) y registrar los CSV resultantes en el manifiesto. [ingesta-datos-externos]
- [ ] 3.7 Ejecutar `datos/mareas/descargar_mareas_tumaco.py` y `datos/xm/descargar_xm.py` y `datos/zni/descargar_zni.py` y `datos/costa/descargar_costa.py` y `datos/runap/descargar_runap.py` y registrar cada producto en el manifiesto. [ingesta-datos-externos]
- [ ] 3.8 Verificar que `python -c "from app.datos_lectura import cargar_sitios, cargar_areas_protegidas, cargar_batimetria; ..."` carga los cinco sitios, 37 áreas protegidas y la batimetría sin error, y que el test `pruebas/test_ingesta_frontera.py` pasa con los productos realmente descargados. [ingesta-datos-externos]

## 4. Pirámide de teselas del mapa

- [ ] 4.1 Escribir `datos/gee/piramidizar.py` que invoque `gdal2tiles.py -z 0-N -w none -p mercator` sobre cada imagen georreferenciada de origen y produzca el árbol de teselas XYZ y el `metadata.json` de cada capa. Verificar que el script se ejecuta sin error sobre un ráster de prueba. [piramide-raster] [mapa-potencial]
- [ ] 4.2 Generar la pirámide de `batimetria_sombreada` recortada al recuadro `-82,6…-70,8` × `0,8…15,2`, escribir su `metadata.json` con recuadro, fecha, resolución nativa (GEBCO 2023, 15 arc-sec), niveles, fuente y licencia, y registrar en `datos/manifiesto.json`. [piramide-raster] [mapa-potencial]
- [ ] 4.3 Generar la pirámide de `sentinel2_mediana` con resolución nativa 10 m, maxzoom 14, y `metadata.json`. [piramide-raster] [mapa-potencial]
- [ ] 4.4 Generar la pirámide de `relieve_sombreado` con resolución nativa 30 m, maxzoom 12, y `metadata.json`. [piramide-raster] [mapa-potencial]
- [ ] 4.5 Generar la pirámide de `viirs_nocturno` con resolución nativa 500 m, maxzoom 8, y `metadata.json`. [piramide-raster] [mapa-potencial]
- [ ] 4.6 Verificar que `web/src/map/mapa.ts` declara los `tiles` con la ruta local a cada pirámide y el `maxzoom` correspondiente, y que la prueba `pruebas/test_mapa.py` verifica que el archivo de cada capa existe y su `metadata.json` tiene los siete campos declarados. [mapa-potencial] [trazabilidad-datos]
- [ ] 4.7 Verificar que la pirámide se sirve sin conexión: con la red deshabilitada, abrir la app, acercarse sobre un área con teselas y verificar que la imagen aparece. [mapa-potencial] [trazabilidad-datos]

## 5. Tercer valor de densidad de potencia para Isla Fuerte

- [ ] 5.1 Calcular la densidad de potencia media anual para Isla Fuerte a partir de la serie Copernicus 1/12° en `datos/cmems/oleaje_isla_fuerte_cmems_2015-2024.csv` (o el nombre equivalente) usando la fórmula del núcleo sobre cada muestra, y registrar el valor medio con su incertidumbre (desviación estándar). [emplazamientos] [trazabilidad-datos]
- [ ] 5.2 Editar `datos/sitios/isla_fuerte.json` para añadir un tercer campo `densidad_potencia_copernicus_1_12` con su valor, unidad `kW/m`, fuente `Copernicus Marine GLOBAL_ANALYSISFORECAST_WAV_001_027`, estado `inferido`, resolución `1/12° (≈9 km)` y `distancia_celda_km: 3.3` (la distancia entre la celda 9,5°N 76,2°W y el sitio 9,39°N 76,18°W). El campo `densidad_potencia_media` revisado por pares NO se modifica. [emplazamientos]
- [ ] 5.3 Verificar que la prueba `pruebas/test_emplazamientos.py` (o equivalente) cuenta tres valores de densidad de potencia para Isla Fuerte y que el valor de diseño sigue siendo 8,9 kW/m. [emplazamientos]
- [ ] 5.4 Actualizar `datos/cmems/resumen_oleaje_cmems.json` con la media calculada para Isla Fuerte y su desviación estándar, y verificar que `pruebas/test_ingesta_frontera.py` lo carga sin error. [emplazamientos] [trazabilidad-datos]
- [ ] 5.5 Documentar en `documentacion/estado_huecos.md` (o en el archivo de la tarea 28.1 de la migración) que la discrepancia de Isla Fuerte sigue abierta tras incorporar el tercer valor: tres valores con factor 4,5 entre el mayor y el menor, sin explicación cerrada. [emplazamientos]

## 6. Oráculos de referencia instalados

- [ ] 6.1 Verificar que `pip install -e ".[dev]"` sobre Python 3.11 deja `mhkit`, `wavespectra` y `statsmodels` instalados e importables. Si `mhkit` requiere `statsmodels >= 0.13`, anclar la versión. [validacion-referencia]
- [ ] 6.2 Eliminar el `pytest.importorskip("mhkit", ...)` y `pytest.importorskip("wavespectra", ...)` de `pruebas/test_oraculos_espectros.py` y `pruebas/test_oraculos_rendimiento.py`. La ausencia de la dependencia debe manifestarse como ImportError ruidoso, no como omisión. [validacion-referencia]
- [ ] 6.3 Verificar que las pruebas de oráculos ejecutan de verdad: `pytest pruebas/test_oraculos_espectros.py pruebas/test_oraculos_rendimiento.py` pasa, y dos corridas seguidas producen el mismo resultado. [validacion-referencia]
- [ ] 6.4 Verificar que el conteo de pruebas skipped en la suite completa es 0, y que `pruebas/test_dependencias.py` confirma que las dependencias declaradas en `[dev]` se usan solo en ese conjunto. [validacion-referencia] [arquitectura-y-calidad]
- [ ] 6.5 Verificar que la regla 0-skipped se cumple recorriendo `pruebas/` con `pytest -v --tb=no` y confirmando que el reporte final no muestra "skipped" en ninguna suite. [arquitectura-y-calidad]

## 7. Cierre

- [ ] 7.1 Verificar que la suite completa pasa: `pytest pruebas` sin errores, sin skips, sin warnings críticos; y que `playwright install chromium && pytest pruebas/test_e2e_interfaz_web.py` también pasa. [e2e-navegacion] [validacion-referencia] [piramide-raster]
- [ ] 7.2 Verificar que `npm run build` produce un `dist/` cuyo contenido es idéntico al de la primera construcción (reproducibilidad), y que el dev server sirve la app con todos los assets locales sin peticiones remotas. [interfaz-web] [trazabilidad-datos]
- [ ] 7.3 Actualizar `README.md` con la sección "Pila tecnológica" completa (Python 3.11+, NumPy, SciPy, Matplotlib, seaborn, utide, pywebview, playwright; HTML/CSS/TypeScript, Vue 3, Vite, MapLibre GL, KaTeX, Plotly.js, ECharts, pmtiles), el procedimiento de construcción ("`pip install -e ".[dev]" && playwright install chromium && cd web && npm ci && npm run build`") y el de ejecución ("`python -m app`"). [arquitectura-y-calidad]
- [ ] 7.4 Actualizar `documentacion/cuentas_ingesta.md` con el estado final de cada fuente: descargada, hash, fecha de última regeneración. [ingesta-datos-externos]
- [ ] 7.5 Actualizar `documentacion/estado_huecos.md` con el estado de los seis huecos del cambio anterior: cerrados los cinco que este cambio cubre, y notas sobre cualquier otro pendiente. [emplazamientos] [trazabilidad-datos]
- [ ] 7.6 Marcar las 22 tareas anteriores como completadas en `openspec/changes/completar-huecos-migracion-web/tasks.md` y registrar el resumen ejecutivo de la implementación: archivos modificados, archivos creados, pruebas añadidas, decisiones de implementación que difieren del design, y huecos que el cambio deja abiertos. [arquitectura-y-calidad]
