# Diseño

## D1 — El ancla de prueba no es la frase, es el hecho

Hoy `pruebas/test_niveles.py` afirma cosas como `"separador miles" in disenar.lower()` o
`"por nombre" in comparar.lower()`. La prueba no verifica que el LCOE lleve separador de
miles ni que las cadenas se alineen por nombre: verifica que alguien escribió esa frase en
el archivo. El texto acabó en pantalla porque era la forma más barata de satisfacer la
condición.

La migración cambia el sujeto de la afirmación:

| Ancla actual (frase en pantalla) | Ancla nueva (hecho inspeccionable) |
|---|---|
| «— separador miles (punto) visible» | `data-testid="lcoe-valor"` + `formatMiles` en el origen |
| «alineadas por nombre, no por índice» | `data-testid="tabla-paralelo"` con `data-alineacion="nombre"` |
| «según `simulable` del archivo — la interfaz no deduce, lee el flag» | `data-testid="catalogo-fichas"` y `simulable` en el origen |
| «Restringido no es utilizable ni descartado — ver RUNAP» | `data-testid="estado-legal"` con `data-estado="restringido\|utilizable\|descartado"` |
| «Una columna 66ch… contrato Resultado» | `data-testid="formulas"` (la columna de lectura se verifica por CSS, no por prosa) |
| bloque `demo-sustitucion` | eliminado; la sustitución con coma pegada se verifica sobre `app/formulas.py` y sobre la tarjeta real |

Regla: si la prueba quiere comprobar una decisión de diseño, comprueba el atributo o el
código que la implementa. Si quiere comprobar que algo es legible por una persona,
comprueba el texto que esa persona necesita leer — nunca el texto que solo el equipo
entiende.

## D2 — El texto que se queda

Se conserva en pantalla lo que un usuario del simulador necesita:

1. Cifras con unidad y su fuente corta (`Ortega et al. 2013`).
2. Veredictos de una línea (`resonancia lejos del pico — Te del sitio 7,0 s`).
3. Estados de dato (`pendiente — sin serie de respuesta`).
4. Rótulos de control en lenguaje corriente (los de `ControlesFisicos` ya lo son).

Todo lo demás sale. La cita bibliográfica completa vive en un solo sitio: el diálogo
«Fuentes».

## D3 — Tipografía sin CDN

La búsqueda del skill recomienda Fira Sans + Fira Code para tablero de datos. Traerlas por
Google Fonts está prohibido por dos pruebas (`test_17_07_sin_cdn` sobre cualquier `.css` de
`web/`, y `test_assets_no_referencian_cdn_politica_origen` sobre `dist/`), y empaquetar los
`.woff2` añadiría ~200 kB al bundle para una ganancia estética.

Se resuelve la intención sin la dependencia: `--font-sans` mantiene la pila del sistema que
la prueba exige (`Segoe UI Variable`, `Segoe UI`, `system-ui`) y se añade `--font-mono`
(`Cascadia Mono`, `Consolas`, `ui-monospace`) para cifras, coordenadas y valores. El
`font-variant-numeric: tabular-nums` global ya garantiza que las columnas no bailen.

## D4 — Iconos sin dependencia

`lucide-vue-next` son ~1.500 iconos para usar doce. Se añade `web/src/components/Icono.vue`:
un `<svg>` con `stroke-width: 1.75`, `viewBox 0 0 24 24` y un mapa de trazados tomados de
Lucide (ISC). Un icono decorativo lleva `aria-hidden`; un icono que porta significado
recibe `:titulo` y se anuncia con `role="img"` y `<title>`.

Los glifos ● ◐ ○ del semáforo se conservan en `semaforo.css` — hay tres pruebas que
verifican su presencia y son una forma distinta por estado, que es exactamente lo que pide
«no comunicar solo por color». Lo que cambia es que dejan de ir solos: cada uno va
acompañado de la palabra del estado y el glifo pasa a `aria-hidden`.

## D5 — La barra de KPIs

Los cuatro valores que la carcasa ya calcula (recurso, potencia captada, producción anual,
factor de planta) pasan de chip de texto a celda de indicador: etiqueta en meta, valor en
`--text-cifra` con unidad más pequeña. La barra es un `role="status"` con `aria-live`
igual que la tira actual, así que el anuncio a lector de pantalla no cambia. En carga cada
celda muestra un esqueleto del ancho del valor, lo que evita el salto de layout que
producía el chip «calculando…».

Un KPI sin dato muestra «pendiente» con el semáforo, nunca un cero ni un guion mudo.

## D6 — 8,9 frente a 40 como gráfico

La guía de gráficas del skill para «KPI contra umbral» recomienda gauge o bullet chart, con
el número y el objetivo en texto al lado y las zonas etiquetadas — el color solo no basta.
Se implementa como una barra de comparación en CSS puro (dos pistas sobre la misma escala
0–40 kW/m, marca de umbral, ambos números visibles con su fuente). Sin librería, sin
canvas, y legible a 320 px porque las pistas apilan.

## D7 — Sustentación 2,1× con el layout nuevo

El modo sustentación escala `font-size` del documento y `--escala`. Todo el layout nuevo se
declara en `rem`, `ch` y unidades de contenedor; ninguna caja lleva altura fija en píxeles.
La barra de KPIs pasa a `flex-wrap` y el rail de Diseñar a scroll horizontal, que es lo que
ya hacen. Se verifica a 320 px con la escala activa.

## D8 — Lo que no se toca

`web/src/api.ts`, la firma `simular/cancelar`, el puente pywebview, el temporizador de 120
ms, el contrato de entrada de cada vista y los `id` que la suite e2e usa para navegar
(`#panel-*`, `#titulo-*`, `[role=tab]`, `[data-testid^=toggle-]`, `.estado-bloque`,
`[role=status]` de Diseñar). El footer `.cita-footer` desaparece, así que el único test que
lo usa como punto de partida de tabulación (`test_2_2_tab_mueve_foco_al_tablist`) se
reapunta al botón «Fuentes» de la cabecera.
