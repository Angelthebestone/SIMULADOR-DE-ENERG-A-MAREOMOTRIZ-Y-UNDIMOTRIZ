## Why

El cambio `migrar-interfaz-a-web-y-ampliar-fuentes` dejó la migración en un estado demostrable (296 de 306 tests pasan, la app sirve por HTTP 200 y el build de Vite compila 609 módulos sin errores), pero la auditoría del `.jsonl` y la ejecución de la suite detectaron cinco huecos que el cambio no cerró. Cerrarlos es lo que distingue un simulador que arranca de uno que se sostiene: las verificaciones tienen que ser ejercitadas, no solo escritas; los datos de la fase 1 tienen que estar realmente descargados, no solo tener el script; el mapa tiene que tener teselas, no solo una declaración; la discrepancia de Isla Fuerte necesita un tercer valor independiente, no solo dos; y los oráculos de la fase 0 deben correr con la biblioteca de referencia instalada, no con `importorskip`.

## What Changes

- Sustituir la suite e2e de Vite por una suite Playwright real que arranca la app con `npm run dev` y la recorre: cuatro niveles, tres controles del nivel Ver, cancelación de la matriz, conmutación de capas del mapa, foco por teclado y atajos ESC y Ctrl+E. La suite del cambio anterior (`pruebas/test_e2e_interfaz_web.py`) verifica el bundle compilado; esta lo navega.
- Ejecutar los scripts de ingesta de la fase 1 contra sus APIs, con credenciales en `~/.config/`, y congelar los productos en `datos/` con su entrada correspondiente en `datos/manifiesto.json`. Lo que la fase 1 promete como "scripts" pasa a "datos versionados".
- Generar la pirámide de teselas de cada capa ráster del mapa: batimetría sombreada, Sentinel-2 mediana, relieve sombreado, luces nocturnas VIIRS, recortadas al recuadro `-82,6…-70,8` × `0,8…15,2`, con su archivo de descripción y los niveles que su resolución soporta. La cartografía base vectorial ya está en `datos/costa/`; faltan las teselas.
- Incorporar al archivo `datos/sitios/isla_fuerte.json` un tercer valor de densidad de potencia, derivado de Copernicus Marine 1/12° (la serie ya está en `datos/cmems/`), con su estado `inferido`, su resolución y su distancia de celda al sitio, sin desplazar el valor `verificado` de 8,9 kW/m.
- Instalar `mhkit` y `wavespectra` en el conjunto de pruebas, declarar `statsmodels` como dependencia transitiva donde la documentación de `mhkit` lo exija, y eliminar los `pytest.importorskip` que las pruebas de la fase 0 todavía cargan. Los oráculos de espectro y de rendimiento tienen que ejecutarse, no saltarse.

## Capabilities

### New Capabilities

- `e2e-navegacion`: suite de pruebas que navega la aplicación web real con Playwright. Verifica los cuatro niveles, los controles del nivel Ver, la cancelación de la matriz, la conmutación de capas del mapa, el recorrido por teclado y los atajos ESC y Ctrl+E. No es una verificación del bundle compilado; es una verificación del comportamiento en el navegador.
- `piramide-raster`: producto de teselas de las capas ráster del mapa. Cada capa sale como pirámide con su archivo de descripción (`metadata.json`) que declara recuadro, fecha de composición, resolución nativa, número de niveles, fuente y licencia. La pirámide reemplaza la imagen georreferenciada única del cambio anterior.

### Modified Capabilities

- `interfaz-web`: la suite de pruebas de la sección 24 deja de ser una verificación del bundle y pasa a navegar la aplicación real. El requisito sobre "suite que recorre los cuatro niveles" se cumple con Playwright en lugar de inspección de strings en `dist/`.
- `ingesta-datos-externos`: los scripts de descarga pasan a ser procedimientos ejecutados al menos una vez, con sus productos en `datos/` y verificados por el manifiesto. El requisito sobre "archivos congelados" se cumple con archivos reales, no con la expectativa de que se generarán al ejecutar los scripts.
- `mapa-potencial`: el mapa de seis capas pasa de declararse a renderizarse. La capa de cada ráster se sirve desde su pirámide; el zoom máximo de cada una queda determinado por la resolución nativa de su fuente. El requisito de "origen local" se cumple para los rásteres igual que ya se cumple para el basemap vectorial.
- `emplazamientos`: el archivo de Isla Fuerte declara un tercer valor de densidad de potencia, derivado de Copernicus Marine 1/12°, con estado `inferido`, y la discrepancia pasa a tener tres números visibles, no dos.
- `validacion-referencia`: las pruebas de oráculos contra MHKiT y wavespectra ejecutan de verdad, no se saltan. El requisito de "oráculo que valida" se cumple con la comparación numérica activa, no con un `importorskip` que documenta la intención.

## Impact

**Código**: el archivo `pruebas/test_e2e_interfaz_web.py` se reemplaza; `pruebas/test_oraculos_*.py` pierde sus `importorskip`; `pyproject.toml` añade `statsmodels` al conjunto de desarrollo; `datos/manifiesto.json` se extiende con los hashes de los productos realmente descargados.

**APIs y servicios externos**: Copernicus Marine (credenciales `~/.copernicusmarine.cfg`), Google Earth Engine (`earthengine authenticate`), FES2022 (público, sin credenciales), CIOH climatología (público, sin credenciales), IDEAM (público, sin credenciales). Las credenciales no entran al repositorio; los productos sí.

**Dependencias nuevas en `[dev]`**: `statsmodels` (transitiva de `mhkit`), `playwright` con su binario de Chromium. La suite de Playwright requiere `playwright install chromium` en el entorno de CI.

**Tamaño del repositorio**: las pirámides de teselas suman aproximadamente 1,2 GB sobre los 62,5 MB actuales. La política de `datos/` del cambio anterior (transporte físico, basemap PMTiles local) se mantiene; las pirámides se distribuyen por el mismo canal.

**Suite de pruebas**: el conteo de casos sube de 308 a aproximadamente 340, con la nueva suite de Playwright (≈20 casos). Los `importorskip` desaparecen, así que la regla 0-skip del proyecto vuelve a cumplirse en las pruebas de oráculos.
