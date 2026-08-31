## Context

La app ya es una aplicación web (TypeScript + Vue 3 + Vite + MapLibre + KaTeX + Plotly + ECharts) servida dentro de una ventana nativa con pywebview sobre WebView2. El motor de cálculo vive en `app/servicio.py`; la presentación solo lee de ese motor sin calcular nada. Existen pirámides raster verificadas bajo `datos/gee/{sentinel2_mediana,relieve_sombreado,batimetria_sombreada,viirs_nocturno}/` con su `metadata.json` y `datos/manifiesto.json` con SHA256. Las pirámides ya se sirven como teselas XYZ desde `web/src/map/mapa.ts` para el componente `MapaView`. La política de origen único prohíbe CDN, librerías 3D y peticiones de red en ejecución. Los tokens de diseño viven en `web/src/styles/tokens.css` (OKLCH) y la estructura de la app es de 4 vistas (`Ver`, `Comparar`, `Calcular`, `Diseñar`) más `Mapa`. Los datos de XM para LCOE medio SIN ya están descargados en `datos/xm/PrecBolsNaci_2023-2024.csv` y `datos/xm/factorEmisionCO2e_2023-2024.csv`, con un resumen en `datos/xm/resumen_xm.json`. El catálogo de dispositivos retirados está en `datos/fracasos/`.

Este cambio densifica la presentación sin tocar el motor de cálculo ni la política de origen, y extiende los parámetros de entrada del servicio sin romper compatibilidad.

## Goals / Non-Goals

**Goals:**
- Enriquecer la vista `Ver` con fondo raster real y anotaciones físicas en vivo sobre el canvas, usando solo Canvas 2D y las pirámides ya verificadas.
- Exponer en `Diseñar` los cuatro supuestos internos del modelo (`η_PTO`, `η_gen`, `CRF`, `ρ`) como controles editables con su fuente.
- Mostrar la intuición física bajo cada fórmula de `Calcular`, en una línea.
- Conectar cada ficha de fracaso comercial con un LCOE estimado por el propio simulador y con el LCOE medio SIN del mismo año.
- Hacer visible la comparación contra el LCOE medio SIN, no solo contra el diésel ZNI.
- Plantear pregunta conductora y micro-tareas verificables en cada nivel.

**Non-Goals:**
- No introducir three.js, WebGL, regl, babylon ni librerías 3D externas. El enriquecimiento visual se hace con Canvas 2D + pirámides raster.
- No modificar el motor de cálculo. La presentación no calcula; el servicio se extiende para aceptar nuevos parámetros, pero los algoritmos no cambian.
- No romper compatibilidad con los tests existentes. El servicio sigue aceptando `Parametros` mínimos sin supuestos explícitos.
- No traducir la app a otros idiomas ni cambiar el formato numérico (sigue siendo español: coma decimal, punto miles).
- No incluir dependencias npm adicionales. Se aprovechan los componentes ya disponibles.
- No migrar la app a una arquitectura nueva (sigue siendo Vue 3 SFC + TypeScript + Vite).

## Decisions

### 1. Composición de capas en el canvas: imagen estática servida desde disco + Canvas 2D

**Decisión**: el fondo del canvas de `Ver` se compone pintando la pirámide raster recortada al rectángulo del oleaje en una capa `<canvas>` inferior, y la superficie libre y la boya en una capa `<canvas>` superior, ambas en el mismo `CanvasRenderingContext2D`. La capa raster se sirve desde `./datos/gee/sentinel2_mediana/{z}/{x}/{y}.png` y `./datos/gee/relieve_sombreado/{z}/{x}/{y}.png` con la misma lógica de carga de teselas XYZ que ya usa `web/src/map/capa.ts`.

**Por qué Canvas 2D y no WebGL**: WebGL introduce un coste de aprendizaje y de mantenimiento, no es necesario para pintar una textura estática y obliga a introducir un shadear mínimo. Canvas 2D es nativo del navegador, no añade dependencias y soporta correctamente la composición alfa para superponer la simulación encima.

**Por qué reutilizar la lógica de teselas XYZ ya existente en `web/src/map/capa.ts`**: ya está testeada, ya respeta el manifiesto de SHA256 y ya se sirve desde el bundle de Vite. Reusarla evita duplicar el resolvedor de teselas y mantiene la coherencia entre la vista `Ver` y la vista `Mapa`.

**Alternativas consideradas**:
- three.js para un plano 3D: rechazado por la política de origen único y por el coste de aprendizaje.
- Cargar el raster completo como `<img>` y recortarlo: rechazado porque la pirámide es XYZ en niveles de zoom y una sola imagen no respeta la zona del Caribe colombiano con la resolución correcta.
- Pintar el fondo a mano con gradientes: rechazado porque ya tenemos las pirámides verificadas y serían trabajo tirado a la basura.

### 2. Anotaciones físicas como componente Vue 2D

**Decisión**: las anotaciones (`Hm0`, `Te`, `J(t)`) se dibujan en la misma capa Canvas superior del oleaje, leyendo los mismos valores de simulación que `AnimacionCanvas.ts` ya consume. La flecha de `Hm0` se dibuja con `lineTo` + `arrowhead` en estilo sobrio (token OKLCH `--color-texto`), sin gradientes ni efectos. La potencia instantánea `J(t)` se calcula a partir de la serie temporal ya integrada (no se recalcula física) y se muestra en una esquina del canvas con `font-variant-numeric: tabular-nums` (ya está en el CSS global).

**Por qué reutilizar la serie ya integrada**: el spec `niveles-divulgacion` exige explícitamente que la animación no recalcule física por fotograma. Reusar la serie es coherente con ese requisito y elimina cualquier riesgo de regresión de rendimiento.

### 3. Supuestos editables: extensión retrocompatible de `Parametros`

**Decisión**: `app/servicio.py` declara los cuatro nuevos parámetros (`eta_pto`, `eta_gen`, `crf`, `rho`) como opcionales en `Parametros` (o equivalente, según la firma existente) con valores por defecto iguales a los que hoy están hard-coded. Las funciones de cálculo aceptan el argumento y lo aplican al producto. La firma pública no cambia: los tests existentes que llaman sin estos argumentos siguen funcionando.

**Por qué dataclass opcional y no kwarg suelto**: el spec pide que cada control editable exponga valor por defecto, rango y fuente; centralizarlos en una estructura única (con metadatos por campo) es más limpio y testeable que pasarlos como kwargs sueltos.

**Por qué no crear un objeto `Supuestos` separado**: el spec lo describe como parte del modelo de parámetros; añadir un envoltorio introduce una indirección sin valor pedagógico. Mejor ampliar la estructura existente.

### 4. Comparación contra SIN: lectura directa del resumen XM

**Decisión**: el LCOE medio SIN se calcula una vez en build a partir de `datos/xm/PrecBolsNaci_2023-2024.csv` y se publica en `datos/xm/resumen_xm.json` (ya presente). La vista `Diseñar` lo lee directamente, sin recalcular, junto al LCOE diésel ZNI ya existente. El cálculo del LCOE medio SIN se hace en un script `datos/xm/procesar_sin.py` reproducible, con su test, y se documenta en `documentacion/estado_huecos.md`.

**Por qué no hacer el cálculo en cada render**: ya hay datos verificados, el cálculo es estable y hacerlo en runtime introduce acoplamiento entre presentación y datos crudos.

### 5. Fracasos conectados: el LCOE estimado se calcula con `app/servicio.py`

**Decisión**: para cada ficha de `datos/fracasos/*.json`, el campo `lcoe_estimado_cop_mwh` se calcula con los parámetros técnicos declarados en `datos/catalogo/` y los parámetros del sitio por defecto (Isla Fuerte). El cálculo se hace en build (offline) por un script `datos/fracasos/procesar_lcoe.py` y se publica en el mismo `datos/fracasos/<id>.json` bajo el campo. La presentación de `Comparar` lo lee directamente.

**Por qué en build y no en runtime**: el cálculo es pesado y determinista; precomputarlo mantiene la presentación instantánea y permite trazabilidad por SHA256. Es coherente con el patrón ya usado para las pirámides raster.

### 6. Pregunta conductora y micro-tareas: contenido por nivel en `web/src/contenido/`

**Decisión**: el texto de la pregunta conductora y la micro-tarea de cada nivel se guardan en un módulo TypeScript `web/src/contenido/pedagogia.ts`, junto a una función `verificar_cumplimiento(resultado, nivel)` que evalúa si la micro-tarea se ha cumplido. La cabecera de cada vista consume este módulo. Las preguntas se redactan en español, en una sola línea, y declaran explícitamente la hipótesis que se pone a prueba (no un objetivo vago).

**Por qué centralizar en un módulo y no en cada `.vue`**: la pregunta y la verificación son contenido pedagógico, no UI. Centralizarlas permite reescribirlas sin tocar las vistas y deja la lógica de "veredicto positivo" testeable sin DOM.

### 7. Línea de intuición bajo fórmulas: contenido en `web/src/contenido/intuiciones.ts`

**Decisión**: cada fórmula de `Calcular` declara su texto de intuición en un mapa `intuiciones: Record<id_formula, string>` en `web/src/contenido/intuiciones.ts`. La vista `Calcular.vue` lo lee por id. El texto es estable, no se recalcula. La línea va bajo la sustitución numérica y sobre la fuente bibliográfica, con tipografía secundaria (token `--texto-secundario`).

**Por qué un mapa y no atributo en la fórmula**: las fórmulas son KaTeX y se renderizan en runtime. Añadir un atributo a la fuente KaTeX es trabajoso; un mapa por id es trivial, testeable, y respeta el principio de "presentación no calcula".

## Risks / Trade-offs

- **Riesgo: el fondo raster de Sentinel-2 distraiga del oleaje.** → Mitigación: opacidad por defecto del 60 %, controlable por el usuario; elección de paleta sobria en OKLCH para el oleaje; verificación visual en las pruebas e2e con capturas.
- **Riesgo: añadir cuatro supuestos editables rompa la convergencia de los tests existentes.** → Mitigación: los nuevos campos son opcionales con valores por defecto idénticos a los hard-coded; suite de regresión `pytest -p no:cacheprovider --tb=line` se ejecuta antes de cerrar tareas.
- **Riesgo: la pregunta conductora y el glosario se sientan como condescendientes para usuarios avanzados.** → Mitigación: el control de capa, el glosario y la pregunta son apagables individualmente desde un panel de configuración; el modo sustentación ya permite ocultar información.
- **Riesgo: las anotaciones sobre el canvas (flecha Hm0, J(t)) parpadeen o se vean mal con resoluciones bajas.** → Mitigación: el sistema de anotaciones usa `requestAnimationFrame` ya existente, dibuja con `font-variant-numeric: tabular-nums` y cae a opacidad reducida en pantallas < 800px.
- **Riesgo: precomputar el LCOE estimado de cada fracaso consuma tiempo y memoria.** → Mitigación: el script procesa solo los dispositivos retirados declarados (≤ 4 hoy), y se ejecuta una sola vez en build, no en cada arranque.
- **Riesgo: la dependencia de `datos/xm/resumen_xm.json` no esté en el estado verificado al inicio del cambio.** → Mitigación: la primera tarea del bloque `comparacion-red-sin` valida que el resumen existe, tiene el campo `lcoe_sin_cop_mwh` con estado `verificado`, y, si falta, genera un script `datos/xm/procesar_sin.py` que lo produce desde el CSV.
- **Trade-off: el texto de intuición física y la pregunta conductora no son traducibles automáticamente.** → Es un proyecto de aula en español; no se busca localización.

## Migration Plan

1. Crear el módulo `web/src/contenido/pedagogia.ts` y `web/src/contenido/intuiciones.ts` con el contenido inicial.
2. Extender `app/servicio.py` con los cuatro parámetros opcionales. Verificar que los tests existentes pasan sin cambios.
3. Crear `datos/fracasos/procesar_lcoe.py` y ejecutarlo una vez; commitear los JSONs actualizados.
4. Crear `datos/xm/procesar_sin.py` si hace falta y commitear `datos/xm/resumen_xm.json` actualizado.
5. Modificar las vistas Vue (`Ver`, `Calcular`, `Comparar`, `Diseñar`) y los componentes asociados.
6. Añadir pruebas e2e con Playwright para verificar la pregunta conductora, el glosario emergente, las anotaciones y la comparación de los tres LCOE.
7. Actualizar `documentacion/estado_huecos.md` para cerrar los huecos cubiertos por este cambio.
8. No requiere migración de datos de usuario: la app es offline y todo el estado es local.

## Open Questions

- ¿La capa de fondo raster debe ser la mediana Sentinel-2 (color real del mar) o el relieve sombreado GEBCO (batimetría)? El spec dice "obligatorio Sentinel-2, opcional relieve". La decisión final la toma la primera tarea visual, comparando dos capturas y eligiendo la que mejor combina con el oleaje.
- ¿La pregunta conductora debe enunciar el objetivo (ej.: "alimenta N viviendas") o la hipótesis (ej.: "compara con la red")? La primera opción es más motivadora; la segunda más rigurosa. El contenido concreto se decide en la primera tarea del bloque `andamiaje-pedagogico` y se itera con pruebas de usuario.
