## Context

La migración a web quedó con cinco huecos entre el código y los specs: la suite de Playwright que verifica el comportamiento de la app, las descargas reales de las APIs externas, la pirámide de teselas del mapa, el tercer valor de densidad de potencia para Isla Fuerte, y la instalación de `mhkit` y `wavespectra` para que los oráculos ejecuten de verdad. Ver `proposal.md - Why` para la motivación. Ver los specs `e2e-navegacion`, `piramide-raster`, `interfaz-web`, `ingesta-datos-externos`, `mapa-potencial`, `emplazamientos` y `validacion-referencia` para los requisitos.

El estado actual del repositorio permite que la suite de pytest pase (296/306) y que la app arranque por HTTP 200 con el build de Vite. Lo que falta es lo que la auditoría no detectó como fallo porque los `pytest.importorskip` y las verificaciones de bundle disfrazan la ausencia de las verificaciones reales.

## Goals / Non-Goals

**Goals:**

- Instalar Playwright + Chromium en CI y reescribir la suite e2e para que abra la app servida por Vite, recorra los cuatro niveles, mueva los tres controles del nivel Ver, lance y cancele la matriz, conmute las capas del mapa, recorra la app con teclado y verifique los atajos ESC y Ctrl+E.
- Ejecutar cada script de ingesta de la fase 1 contra su API real con credenciales locales, congelar los productos en `datos/` con su entrada en `datos/manifiesto.json` y su hash SHA-256. Lo que no se descarga, no se versiona.
- Generar la pirámide de teselas de cada capa ráster del mapa con su `metadata.json` y el script de piramidación ejecutable.
- Calcular un tercer valor de densidad de potencia para Isla Fuerte a partir de Copernicus Marine 1/12° y registrarlo en `datos/sitios/isla_fuerte.json` con estado `inferido` y su resolución/distancia declaradas.
- Mover `mhkit` y `wavespectra` al conjunto de desarrollo con `statsmodels` como dependencia transitiva, y eliminar los `pytest.importorskip` de las pruebas de oráculos para que ejecuten de verdad.

**Non-Goals:**

- Reescribir el núcleo de física. Las fórmulas y los oráculos siguen siendo los mismos.
- Cambiar la pila de frontend. Sigue siendo Vue 3 + Vite + MapLibre + KaTeX + Plotly + ECharts.
- Tocar la capa de servicio. `app/servicio.py` y `app/contrato.py` ya están en su sitio.
- Internacionalizar. Sigue en español.
- Añadir dispositivos o emplazamientos. El alcance de simulación es el mismo.

## Decisions

### D1. Playwright sobre Selenium o Cypress

Playwright maneja la asincronía nativa de la app Vue 3 sin tener que sincronizar con el bucle de eventos de un WebDriver. Su API de selectores y de espera de condiciones observables encaja con los requisitos del spec `e2e-navegacion` (foco por teclado, atributos `aria-*`, conmutación de capas). Cypress está atado a JavaScript, lo que obligaría a escribir la suite en otro lenguaje. Selenium WebDriver es estable pero su API síncrona añade fricción sin ganancia aquí.

*Alternativas consideradas:* Selenium WebDriver, Cypress, jsdom en Node. Playwright sobre Chromium es la que mejor cumple el requisito de "recorrer la aplicación como una persona".

### D2. Piramidación con `gdal2tiles.py` sobre `rio-rgbify` o `tiff2tile`

`gdal2tiles.py` viene con GDAL, que ya está disponible como dependencia transitiva de `rasterio` y de `fiona` en el entorno de ingesta. Su salida sigue el esquema XYZ que MapLibre consume directamente. `rio-rgbify` exige preprocesar el ráster a RGB de 8 bits, paso adicional que no aporta cuando la fuente ya viene en color verdadero. `tiff2tile` es viable pero añade una dependencia binaria sin ahorro de tiempo.

*Alternativas consideradas:* `rio-rgbify` (necesita paso previo), `tiff2tile` (dependencia nueva), `mapnik` (sobreingeniería para esta escala). GDAL es el camino más corto al esquema XYZ.

### D3. Tercer valor de Isla Fuerte desde Copernicus Marine 1/12°

`datos/cmems/descargar_oleaje_cmems.py` ya extrae la serie del producto `GLOBAL_ANALYSISFORECAST_WAV_001_027` para los cinco emplazamientos. El valor se calcula como la media anual de la densidad de potencia de la serie local, con su estado `inferido` y la distancia de la celda al sitio (≈3,3 km para Isla Fuerte). El archivo `datos/cmems/resumen_oleaje_cmems.json` declara la resolución y el periodo.

*Alternativas consideradas:* ERA5 a 0,25° (similar al 0,5° ya en uso, no aporta resolución), boya medidora real (no disponible para Isla Fuerte en abierto). Copernicus 1/12° es la rejilla operativa de mayor resolución accesible sin coste.

### D4. Pip en lugar de Conda para `mhkit`

`mhkit` publica wheels de Python para Linux, macOS y Windows en PyPI. `pip install ".[dev]"` sobre Python 3.11 resuelve la dependencia transitiva `statsmodels` que el oráculo de JONSWAP necesita para su cálculo del parámetro de forma. La sección `[dev]` de `pyproject.toml` ya excluye estas dependencias del wheel de distribución, por lo que el artefacto empaquetado no las incluye.

*Alternativas consideradas:* Conda (binarios precompilados, pero el resto del proyecto es pip y mantener dos canales es trabajo gratis), Poetry (cambio de gestor de dependencias fuera de alcance). Pip es lo que ya usa el proyecto.

### D5. Reutilizar el dev server de Vite como objetivo de Playwright

`npm run dev` sirve la app en `http://127.0.0.1:5173/`. La suite de Playwright arranca ese proceso en background antes de las pruebas y lo termina al final. La alternativa, servir el `dist/` por un servidor estático local, obligaría a mantener dos artefactos sincronizados: la app de desarrollo y la de producción. La app de desarrollo es la misma fuente, así que servirla evita el problema y mantiene la prueba fiel al código que la CI acaba de compilar.

*Alternativas consideradas:* servidor estático sobre `dist/`, abrir `index.html` directamente con `file://` (las pirámides del mapa usan rutas relativas y `file://` no las resuelve). Vite dev server es el camino más corto y reproducible.

## Risks / Trade-offs

**El binario de Chromium añade 200 MB al entorno de CI** → Se documenta en `documentacion/construccion_interfaz_web.md` el paso `playwright install chromium` como dependencia de la suite e2e, y se separa la ejecución de la suite e2e del job de pytest para que los cambios de UI no obliguen a reejecutar todas las pruebas físicas.

**Las descargas reales de Copernicus Marine dependen de credenciales que no están en el repositorio** → El script `datos/cmems/descargar_oleaje_cmems.py` se ejecuta con `COPERNICUSMARINE_USERNAME` y `COPERNICUSMARINE_PASSWORD` en variables de entorno, tomadas de `~/.copernicusmarine.cfg` según el spec `ingesta-datos-externos`. En CI sin credenciales, la suite que verifica la presencia de los productos congelados falla ruidosamente con un mensaje claro, en lugar de fallar por timeout.

**La pirámide de teselas suma aproximadamente 1,2 GB a la distribución** → Se mantiene la política de transporte físico del cambio anterior y se documenta en `documentacion/aislamiento_red.md` el canal de distribución para los rásteres voluminosos. La pirámide se construye una vez y se distribuye, no se reconstruye en cada arranque.

**La suite de Playwright introduce una dependencia temporal (timing)** → Las pruebas usan `wait_for_selector` y `wait_for_function` con condiciones observables (texto, atributo `aria-selected`, valor del contrato) en lugar de `sleep` o `wait_for_timeout` con valores absolutos. Donde el requisito del spec es "dentro de un segundo", la prueba mide el intervalo y falla si excede, no usa un timeout blando.

**`mhkit` requiere `statsmodels` (~30 MB adicionales en el conjunto de desarrollo)** → Es el coste de tener el oráculo de JONSWAP ejecutándose de verdad. El spec `validacion-referencia` lo exige y el beneficio es que la suite detecta divergencias reales en lugar de pasar por `importorskip`. La suite sin `mhkit` instalado sigue fallando ruidosamente, no salta.

## Migration Plan

1. Instalar Playwright + Chromium en el entorno de desarrollo (`pip install playwright && playwright install chromium`).
2. Reescribir `pruebas/test_e2e_interfaz_web.py` para que abra `http://127.0.0.1:5173/` con Playwright, recorra la app y verifique los invariantes del spec `interfaz-web`.
3. Configurar las credenciales de Copernicus Marine, Earth Engine y AVISO en `~/.config/` o `~/.copernicusmarine.cfg`, y ejecutar los scripts de ingesta de `datos/cmems/`, `datos/gee/`, `datos/fes/`, `datos/ideam/`, `datos/mareas/`, `datos/oleaje/`, `datos/xm/`, `datos/zni/`, `datos/costa/`, `datos/runap/`, `datos/dispositivos/`, `datos/fracasos/`, `datos/catalogo/`. Cada producto descargado se registra en `datos/manifiesto.json` con su hash SHA-256.
4. Generar las pirámides de teselas con `gdal2tiles.py` para `batimetria_sombreada`, `sentinel2_mediana`, `relieve_sombreado` y `viirs_nocturno`, recortadas al recuadro `-82,6…-70,8` × `0,8…15,2`, y escribir el `metadata.json` de cada una.
5. Calcular el tercer valor de densidad de potencia para Isla Fuerte a partir de la serie Copernicus 1/12° ya en `datos/cmems/`, registrarlo en `datos/sitios/isla_fuerte.json` con estado `inferido`, su resolución (1/12° ≈ 9 km) y la distancia de la celda (≈3,3 km). Actualizar la suite de validación para que verifique los tres valores.
6. Añadir `statsmodels` a `[dev]` en `pyproject.toml` con justificación documentada, y eliminar los `pytest.importorskip("mhkit")` y `pytest.importorskip("wavespectra")` de `pruebas/test_oraculos_espectros.py` y `pruebas/test_oraculos_rendimiento.py`. Las pruebas que detecten la ausencia de la dependencia fallan ruidosamente.
7. Verificar la suite completa: `pytest` debe pasar 100% sin skips; `playwright install chromium && pytest pruebas/test_e2e_interfaz_web.py` debe pasar; `npm run build` debe producir el mismo `dist/` que la primera construcción.

**Rollback:** cada paso es reversible. Si el oráculo de `mhkit` no termina de importar por incompatibilidad de `statsmodels` con Python 3.11 en alguna plataforma, el spec exige el oráculo y el requisito se mantiene: la solución es declarar el wheel que funcione, no relajar el requisito. Si una API externa cambia su formato y rompe el script de ingesta, se versiona el script y se documenta el cambio en `datos/manifiesto.json` antes de reejecutar.

## Open Questions

- Si las pirámides se versionan en Git o se distribuyen por canal aparte. La política de tamaño del proyecto admite hasta 200 MB por artefacto versionado; 1,2 GB excede ese límite. La decisión se delega a una consulta con el usuario cuando el tamaño real de las pirámides se mida tras la primera ejecución, no ahora.
- Si Playwright Chromium se ejecuta en Windows headless sin servidor gráfico. La suite lo ejecutará con `headless=True` por defecto, pero en Windows algunos errores de driver requieren `headless="new"` o `xvfb-run`. Se documenta en `documentacion/construccion_interfaz_web.md` cuando se ejecute la primera vez.
