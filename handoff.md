# Handoff — Simulador de energía marina

Fecha: 2026-09-09 (cierre de Fase 3). Rama: `feat/carta-mundial-y-escenario-unico` (commiteada y empujada a origin al cerrar esta sesión).
Repo: `C:\Users\Lenovo\Desktop\PROYECTO SIMULADOR ENERGIA`.

## 1. Arquitectura no negociable

- Motor Python: `nucleo/` (3.335 líneas), `analisis/` (1.624), `app/` (2.140). numpy + scipy (`brentq` en `nucleo/espectros.py`, `solve_ivp` en `nucleo/integradores.py`). NO reescribir, NO migrar.
- Frontend: Vue 3 + Vite + TypeScript en `web/` (4.461 líneas). Deps fijadas con `=`: echarts, maplibre-gl, pmtiles, plotly.js-dist-min, katex, three `=0.185.1` (empaquetado por Vite, jamás CDN).
- Doble carcasa, un frontend: `app/carcasa.py` (pywebview, `file:`) y `api/simular.py` (Vercel serverless, 72 líneas). `web/src/api.ts` elige transporte.
- Pruebas en `pruebas/` (6.262 líneas) son el activo principal. NUNCA borrar ni deshabilitar pruebas; si falla por cambio propio, arreglar el cambio.

## 2. Prohibiciones absolutas (vigentes)

- NUNCA migrar a Next.js/React/Electron/Tauri. Stack: Vue 3 + Vite + TS + Python.
- NUNCA reescribir `nucleo/` ni sustituir numpy/scipy.
- NUNCA borrar/deshabilitar pruebas.
- NUNCA borrar archivo de `datos/` sin preguntar uno por uno (peso + quién lo referencia).
- NUNCA romper paridad app/web (`file:` pywebview + Vercel). Prohibido CDN; todo empaquetado por Vite.
- NUNCA añadir funcionalidades, abstracciones, configs ni refactors no pedidos.

## 3. Reglas de ejecución (vigentes)

- Terminal: ningún comando > 4 min. Siempre `timeout` 240 s. Si llega al límite, NO reintentar tal cual: acotar y reintentar acotado.
- Windows: CMD no tiene `head`/`tail`; usar PowerShell (`Select-Object -Last N`) o `python -c`. Chaining con `&`, NO `;`.
- Python: `set PYTHONDONTWRITEBYTECODE=1`, `python -m pytest -p no:cacheprovider -o addopts=`. Formato corto: `--tb=line`; resumen: `--tb=no`.
- Suites completas SIEMPRE en segundo plano con salida a `documentacion/logs/`. Puntuales (un archivo, segundos) sí en primer plano. El checkpoint de cierre de fase SÍ espera la suite.
- `npm run test:unit` = `node --experimental-strip-types --test src/components/*.test.ts`.
- Subagentes: lotes con rutas disjuntas (dos subagentes NUNCA escriben el mismo archivo), declarar rutas tocadas/prohibidas, entregarles Contexto + Prohibiciones + Ejecución + Formato íntegros. Paralelizan DENTRO de una fase, nunca cruzan fases. Al recibir resultados, verificar `git status --short` + reinspeccionar archivos + re-correr subset relevante (no fiarse del resumen del subagente).
- Taste: leer `.commandcode/taste/taste.md`; NO editar nada bajo `.commandcode/taste/`. Preferir tools dedicados (Read/Glob/Grep/Edit) sobre shell; batch de lecturas independientes en un solo mensaje; no re-leer archivos ya en contexto.
- Formato de trabajo: 3 fases EN ORDEN. Al cerrar cada fase: esperar suite completa, imprimir `✅ FASE N COMPLETADA` + cambios + diff líneas/MB + subagentes y lotes, DETENERSE y esperar aprobación.

## 4. Fase 1 — estado: completada pendiente de 2 autorizaciones

Hecho (ya en árbol):
- `datos/cmems/descargar_corrientes_glorys.py`: `__main__` llama a `descargar()` por sitio; nuevo `_guardar_celda_csv()` recorta a celda nearest y escribe `corriente_{clave}_glorys_2015-2024.csv` (`fecha_hora_utc,uo,vo,velocidad_ms=hypot`). Sin credenciales → `SystemExit` claro.
- `datos/cmems/resumen_corrientes_glorys.json`: `null` → `0` + `estado: pendiente`. 0 nulls.
- `datos/mareas/rango_esri.py` + `rango_mareal_esri.json` (nuevos): 5 sitios por teselas LERC TilesOnly z=4 (Caribe ~0,48–0,52 m, Pacífico 3,17–3,46 m), fecha, servicio, método `2*(M2+S2+K1+O1)`, atribución exacta FES2014/Noveltis/Legos/CLS/Aviso+/Cnes, nota no-runtime. 0 nulls.
- `app/limitaciones.py`: 7.ª atribución Esri/FES2014 + clave `esri_fes`.
- `datos/mareas/procesar_tumaco_diario.py` + `nivel_mar_tumaco_diario_2023-2025.csv`: 1.114.534 lecturas → 898 días, 31,2 KB. `resumen_mareas_tumaco.json` conserva 6 campos + `validacion_esri` (Esri 3,165 vs observado 2,62 → error 20,8 %). 0 nulls.
- `datos/gee/convertir_a_pmtiles.py` + 4 `.pmtiles` (v3 raster, decoder `pmtiles@3.2.0`): ~10,6 MB PNG → ~258 KB. PNGs intactos. `web/src/map/capas.ts` añade `pmtiles:` por capa; `web/src/map/mapa.ts` prefiere `pmtiles://` con fallback XYZ (4 `addSource` intactos porque `test_mapa.py` los exige).
- Borrados autorizados Fase 1 (6): `datos/fes/descargar_constituyentes_fes.py`, `datos/fes/resumen_constituyentes_fes.json`, `datos/cmems/descargar_oleaje_cmems.py`, `datos/cmems/resumen_oleaje_cmems.json`, 2 CSV `datos/ideam/dhime_*` (349 + 419 KB).
- `datos/manifiesto.json` v2: 15 entradas, cubre 100 % carpetas.
- Diff tracked Fase 1: +146 / −7.792 líneas. `datos/` 91,6 → 91,2 MB.

Borrado autorizado el 2026-09-09: crudo `datos/mareas/nivel_mar_tumaco_ioc_2023-2025.csv` (32,5 MB, 0 referencias en runtime; solo lo nombraban su descargador y `procesar_tumaco_diario.py`, que ya lo redujo a 31,2 KB). Regenerable con `descargar_mareas_tumaco.py`. `datos/` 95 → 63 MB.

Pendiente (NO borrar sin “sí”): los 1.722 PNG de `datos/gee/` (10,6 MB, ya empaquetados en 258 KB `.pmtiles`; ojo al fallback XYZ de `mapa.ts`).

Criterios Hecho Fase 1: pytest con 8 rojos preexistentes (no verde limpio) ❌; `datos/` 91,2 MB no <30 MB ❌ (bloqueado por lo anterior + `juanchaco`/`tesoro` que sí lee `nucleo/mareas.py` + ERA5 que sí lee `servicio.py`); 0 nulls en resúmenes propios ✅; manifiesto 100 % ✅.

## 5. Fase 2 — estado: veredicto aprobado, borrado ejecutado, falta checkpoint formal

- Cobertura base: `documentacion/cobertura_antes.txt` (TOTAL 78 %, 3559 stmts). `ruff F401` = 0; `ruff ARG` = 9 en firmas de interfaz (no borrables); `vulture` ≈180 casi todo falsos positivos.
- Tabla archivo/líneas/cobertura/alcanzable/veredicto: **43/43 conservar**. Todo lo no alcanzable desde `api/simular.py` / `app/__main__.py` está cubierto por `pruebas/` (borrarlo rompería pruebas). Detalle en `documentacion/codigo_eliminado.md`.
- Borrados aprobados y ejecutados esta sesión: todos los `__pycache__` (verificado: 0 restantes). `scratchpad/`, `salidas/`, `scratchpad_*.py`, `documentacion/logs/`, `.coverage` NO existían como archivos (solo dirs ignorados / artefactos); nada que borrar. `documentacion/referencias/` (5 JPG Fase 3) SE CONSERVA. `documentacion/cobertura_antes.txt` SE CONSERVA.
- `.gitignore` ya cubre: `salidas/`, `scratchpad/`, `scratchpad_*.py`, `web/dist/`, `web/node_modules/`, `__pycache__/`, `*.jsonl`. `documentacion/logs/` ya está ignorado desde esta sesión (§7.4).

## 6. Fase 3 — estado: implementada, e2e en verde (14/14) y enlaces de plantas correctos

Existe y verificado en código:
- 3.1/3.2 Flujo: `web/src/main.ts` (plantilla `PLANTILLA`, arranca en paso 4 con isla_fuerte/absorbedor, ruta visible 4 pasos, `irA`, retroceso). `web/src/flujo/estado.ts` + `flujo.css`. `views/Portada.vue` (mar pantalla completa + Mareomotriz/Undimotriz), `views/Tecnologia.vue` (dique/turbina/absorbedor; OWC fuera del selector, nota a Comparar), `views/OrigenDatos.vue` (lugar real vs valores libres + aviso hipotético + `nota-hipotetico` en paso 4).
- 3.3 Mapa calor por tecnología: `map/mapa.ts` (`fijarTecnologiaActiva`, una capa visible a la vez: oleaje kW/m desde `potencial_oleaje_global.geojson`, dique rango m desde `rango_mareal_esri.json`, turbina m/s desde resumen GLORYS pendiente). Leyenda viva en `MapaView.vue` con unidades + fuente. Restricción dique: `plantas.ts::DISTANCIA_MAX_DIQUE_COSTA_KM = 30` + `MENSAJE_DIQUE_LEJOS` físico, valida contra `contorno_tierra.geojson` (misma lógica exclusión que RUNAP). RUNAP pintado como `runap_rayado`/`runap_borde`.
- 3.4 3D: `web/src/components/Animacion3D.ts` (~720 líneas, Three.js empaquetado): dique (corte mar/embalse, niveles distintos, h en vivo, bulbo+rotor, flechas reversibles, modos llenado/vaciado/bidireccional/bombeo de `nucleo/dispositivos/embalse.py`, centro transformación + línea a tierra), absorbedor (mar + volumen, flotador/mástil/placa/subestación/cable/lecho, movimiento relativo por Hs/Te en vivo), granja turbinas (torres, rotores ∝ corriente, cable). `AnimacionCanvas.ts` INTACTO como respaldo; `Ver.vue` conmuta auto→3D si hay WebGL con GPU real (§7.3), respaldo a 2D si falla o <30 fps (monitor `onFrame3D`, `degradarCalidad()`). Selector motor Auto/3D/2D + monitor fps.
- 3.5 Educativa: `components/Anotacion.vue` + `contenido/pedagogia.ts` + `intuiciones.ts` + `Glosario.vue` reutilizados; `ControlesFisicos.vue` (símbolo+unidad+rango+efecto sube/baja); `utils/validacion.ts` (Airy: peralte rotura 1/7, límite 0,08, Ursell 30/100) con `EstadoBloque` en `Ver.vue`.
- 3.6 Plantas: `datos/plantas/plantas_mundiales.geojson` (9 features, ver §7) + `map/plantas.ts` (`cargarPlantas`, validación, `coleccionPlantas`) + marcadores en `mapa.ts` (operativo sólido vs desmantelado anillo, color+forma) + ficha en `MapaView.vue` (potencia/año/cierre/fuente/catalogo/fracaso). Sin datos inventados (campos `null` + `pendiente_verificacion` donde aplica).
- 3.7 Calidad: tokens ampliados en `styles/tokens.css` (no duplicados); foco visible; `@media (width <= 40rem)` + 375 px; `navigator.onLine` offline; estados cargando/vacío/error/sin-conexión; `utils/formato.ts` español (coma decimal, punto miles); RNF01 <2 s vía debounce 120 ms (`programar()`), `degradarCalidad()` degrada visual nunca respuesta.

## 7. Cambios de ESTA sesión (ya commiteados)

1. `web/src/datos/marino.ts` — fix CSP/paridad (único `https://` en `web/src/*.ts`):
   - Eliminada `API_OLEAJE` + `consultarEnVivo()` (fetch a `marine-api.open-meteo.com`, rompía `default-src 'self'`, `test_src_sin_urls_externas` y `test_dist_assets_sin_urls_externas`, y `aislamiento_red.md` “cero peticiones”).
   - `consultarOleaje()` ahora solo malla local `./datos/oleaje/potencial_oleaje_global.geojson` (≤600 km, si no `pendiente`). `densidadPotenciaWm()` conserva fórmula con consts locales (documenta kW/m de la malla; la siguen importando `mapa.ts`/`MapaView.vue`).
   - Rebuild `web` (20,34 s, 1777 archivos a `dist/datos`): bundle nuevo `assets/index-DLY2Q_gR.js` (2.998 kB). CSP+build: **15 passed, 1 deselected**; `test:unit` 5/5.
2. `datos/plantas/plantas_mundiales.geojson` — cerrado:
   - `limpet_islay.fracaso = 'limpet'`, `pelamis_p2.fracaso = 'pelamis'`, `oyster_800.fracaso = 'oyster'` (vía `sed` sobre el JSON; `json.dump` fallaba en silencio). Verificado: los 5 `fracaso` y los 7 `catalogo` no nulos resuelven a archivo existente en `datos/fracasos/` y `datos/catalogo/`, y coinciden con `Comparar.vue::idsF`.
   - Estado (9): la_rance (dique, 240 MW, 1966, operativo), sihwa_lake (dique, 254 MW, 2011, operativo), meygen (turbina, 6 MW, 2016, operativo, catalogo tidal_eje_horizontal), mutriku (undimotriz, 296 kW, 2011, operativo, catalogo owc), annapolis_royal (dique, 20 MW, 1984–2019, desmantelado, fracaso annapolis_royal), seagen (turbina, 1,2 MW, 2008–2019, desmantelado, tidal_eje_horizontal + seagen), limpet_islay (undimotriz, 250 kW, 2000–2011, desmantelado, owc + limpet), pelamis_p2 (undimotriz, 750 kW, 2010–2014, desmantelado, atenuador + pelamis), oyster_800 (undimotriz, 800 kW, 2012–2015, desmantelado, owsc + oyster).
   - Nota: `la_rance`/`sihwa` sin `catalogo` es honesto (no hay ficha "dique" en `datos/catalogo/`); no inventar. `MapaView` muestra `fracaso`/`catalogo` como texto, no como fetch.
3. `web/src/views/Ver.vue` — fix headless↔auto-3D (causa de los 4 rojos e2e): nueva `aceleracionPorHardware()` lee `WEBGL_debug_renderer_info::UNMASKED_RENDERER_WEBGL` y, en modo **auto**, no sube a 3D si el renderizador es por software (SwiftShader, llvmpipe, softpipe, Mesa software, Microsoft Basic). Sin extensión disponible → asume hardware. `soportaWebGL()` intacta: si el usuario pide 3D a mano en el selector, lo obtiene igual. Three sigue empaquetado, respaldo 2D <30 fps y `AnimacionCanvas.ts` intactos. No es un parche de test: un rasterizador por software da WebGL válido y pocos fps, que es justo el caso que el respaldo 2D existe para cubrir.
4. `.gitignore`: añadido `documentacion/logs/` (el `pytest_fase3.txt` vacío se borró; los logs no se commitean).

## 8. Tests — dónde estamos (corrida 2026-09-09)

- Ejecución local verificada el 2026-09-09: `python -m app` abre la ventana nativa (requiere `pip install pywebview`, que NO está en `requirements.txt` porque ese archivo es solo del backend serverless). El motor real vía `app.carcasa.api_simular`: absorbedor@isla_fuerte 407 ms, turbina@tumaco 39 ms, embalse@tumaco 38 ms — muy por debajo del RNF01 de 2 s. Las 3 escenas 3D (absorbedor, granja de turbinas, dique con `h` en vivo) se comprobaron a ojo en el dev server; ojo: el dev server de Vite responde `/api/simular` con un **mock** (`vite.config.ts`), las cifras reales solo salen por la carcasa o por Vercel.
- Instalar pywebview destapó dos pruebas que solo pasaban por su ausencia; arregladas en `app/carcasa.py` resolviendo el módulo en la llamada y no en el import: `comprobar_motor()` lee `sys.modules`, `crear_ventana()` hace `import webview` dentro. Con eso `test_deteccion_webview2_presente` pasa a verde y quedan **5** rojos preexistentes, no 6.
- Suite Python sin e2e/build: **330 passed, 6 failed** — los mismos 6 rojos preexistentes de `documentacion/tests_rojos_pre_existentes.md`, ninguno es regresión: `test_11_4_esquema_sitios` (fixture `sin_coords.json`), `test_deteccion_webview2_presente`, 2× `s1_21` resonancia borde, `s4_03` progreso/cancelación (carrera), `test_14_1_14_2` ("Copernicus Marine" case/encoding).
- CSP + build: **15 passed, 1 deselected**.
- `test_build_es_reproducible_dos_corridas` (corrido solo): **1 passed en 83 s** — ya no hace falta deselectarlo.
- `npm run test:unit`: **5/5**.
- E2E completo `pruebas/test_e2e_interfaz_web.py`: **14 passed** en 167 s. Los 4 rojos de la sesión anterior (`2_3_tres_sliders…`, `4_3_{flecha_hm0_redimensiona, jt_y_te_visibles, jt_cambia_con_hm0}`) están verdes con el fix de §7.3; `2_8_sin_peticiones_remotas` sigue verde.
- Playwright: hubo que reinstalar el navegador (`python -m playwright install chromium chromium-headless-shell`); sin eso los e2e dan ERROR de setup, no fallo real.

Comandos de re-verificación (timeout 240 s salvo el último):
- `python -m pytest -p no:cacheprovider -q --tb=line -o addopts= --ignore=pruebas/test_e2e_interfaz_web.py --ignore=pruebas/test_construccion_web.py -k "not dos_corridas and not reproducible and not determinismo"`
- `python -m pytest pruebas/test_csp_interfaz.py pruebas/test_construccion_web.py -p no:cacheprovider -q --tb=line -o addopts= -k "not dos_corridas and not reproducible"`
- `python -m pytest pruebas/test_e2e_interfaz_web.py -p no:cacheprovider -q --tb=line -o addopts=`
- `npm run test:unit` (en `web/`)
- `python -m pytest pruebas/test_construccion_web.py -p no:cacheprovider -q --tb=line -o addopts= -k "dos_corridas"` (~83 s, dos builds)

## 9. Git — snapshot del commit de cierre

Todo lo de §4–§8 va en un solo commit sobre `feat/carta-mundial-y-escenario-unico`: 27 archivos tracked modificados/borrados (Fase 1) + los nuevos untracked (4 `.pmtiles` + `convertir_a_pmtiles.py`, `rango_esri.py` + `rango_mareal_esri.json`, `procesar_tumaco_diario.py` + diario Tumaco, `datos/plantas/`, `cobertura_antes.txt`, `codigo_eliminado.md`, `documentacion/referencias/` (5 JPG), `Animacion3D.ts`, `Anotacion.vue`, `flujo/`, `map/plantas.ts`, `utils/validacion.ts`, `views/{OrigenDatos,Portada,Tecnologia}.vue`, este `handoff.md`).
Fuera del commit: `web/dist/` (rebuild local), `documentacion/logs/`, `__pycache__` (0), `*.jsonl` — todos en `.gitignore`.

## 10. Próxima sesión — TODO en orden

Cerrados en esta sesión: enlaces `fracaso` de plantas (§7.2), fix headless↔3D (§7.3), `dos_corridas` en verde (§8). Queda:

1. **Autorización de borrado pendiente de Fase 1 (§4)** — sin "sí" explícito no se toca:
   - Los 1.722 PNG de `datos/gee/`, 10,6 MB, ya empaquetados en 258 KB de `.pmtiles` (los `.pmtiles` se sirven con fallback XYZ a esos PNG en `mapa.ts`: si se borran, el fallback se queda sin destino y hay que quitarlo o aceptar solo `pmtiles://`).
   Con ese borrado `datos/` bajaría de 63 MB a ~52 MB; el objetivo <30 MB sigue bloqueado por `juanchaco`/`tesoro` (los lee `nucleo/mareas.py`) y ERA5 (lo lee `servicio.py`).
2. Los 6 rojos preexistentes (§8) siguen abiertos y documentados; decidir si se arreglan o se aceptan como deuda declarada.
3. Checkpoint formal de Fase 2 (§5), que quedó sin imprimir.

## 11. Sesión 2026-11-16 — simulador global y revisión estricta

Objetivo: UX/UI de altísima calidad para estudiantes, simulación 2D/3D en cualquier punto del mundo y comparación con plantas reales; sin foco en Colombia.

Hecho (commits de `7b3aa13` en adelante, ver `git log`):
- Flujo de 4 pasos (Recurso → Tecnología → Lugar → Simulación) con barra de pasos, panel `Resultados.vue` (KPI, potencia media, cadena de pérdidas, avisos traducidos, `ComparaPlantas.vue`) y catálogo de consulta en el paso 2 (`ReferenciasCatalogo.vue`, campo `ejemplo_corto` en `datos/catalogo/*.json`).
- Sitios de arranque globales por tecnología (`estado.ts::SITIO_INICIAL`: Peniche, Pentland Firth, La Rance). Los sitios curados de `MapaView.vue` son `inferido` salvo Isla Fuerte (Ortega 2013, lo exigen las pruebas); la ficha calcula J = 0,49·Hm0²·Te con los mismos valores que simula el motor y muestra solo las magnitudes de la tecnología activa.
- Motor (`app/servicio.py`, sin tocar `nucleo/`): `rango_m` y `velocidad_ms` como parámetros; la turbina se resuelve con una serie M2 + vivas-muertas (`serie_corriente_mareal`) recortada a la velocidad nominal, así el FP deja de salir ~95 %. El mando de la turbina es «corriente de pico en vivas»; el del dique, «rango de marea medio».
- Punto libre global SIN red en ejecución: `datos/marino/descargar_recurso_global.py` (ingesta Open-Meteo, 15 días de marzo de 2024, costa cada 150 km + mar abierto 6°) genera `datos/marino/recurso_global.json`, que lee `web/src/datos/marino.ts::consultarRecursoGlobal` (ola ≤ 400 km, marea y corriente ≤ 100 km). Reanudable con `recurso_global.parcial.json`.
- Plantas: producción anual con cita para La Rance (500), Sihwa (552,7), Annapolis (30), MeyGen (8,5, media 2017-19), SeaGen (1,05, media de vida), Mutriku (0,24, media 2011-23), con `produccion_nota`.
- Escenas 2D/3D rehechas (costa, embalse, dique 3D en corte, rótulos que esquivan los controles).

Abierto:
- La boya tiene 750 kW nominales fijos en `nucleo/dispositivos/absorbedor.py` → FP ~1,7 % en Peniche. Decidir si se cambia (requiere permiso para tocar `nucleo/`).
- El modo proyección no escala el panel de resultados: los tokens `--text-*` están en px y `test_estilo_tokens.py` lo exige.
- RUNAP y el transecto GMRT de Isla Fuerte siguen cargándose en `mapa.ts`, y `Disenar/Comparar/Calcular.vue` y `FichaDispositivo.vue` siguen en el repo sin importarse: varias pruebas los leen por ruta (`test_mapa.py`, `test_niveles.py`, `test_tesis_accesible.py`, `test_animacion_ver.py`). Quitarlos exige reescribir esas pruebas con permiso.
- El modelo de dique da 291 GWh en La Rance con rango medio 8 m frente a 500 reales (no modela bombeo ni doble efecto).
- Aviso WebGL `bindTexture … multiple targets`: según el agente sale de `MarRealista.ts` (portada), no de las escenas 3D; sin verificar.
