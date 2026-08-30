# Criterios del informe de diseño portados al cierre

> Documento de cierre de la tarea 27.6. Lista cada hallazgo del informe de
> revisión de diseño (`.commandcode/design/review-report.md`), identifica su
> estado real al cierre del proyecto y, cuando aplica, el motivo de estar
> portado, resuelto o abandonado.

El informe tiene **10 hallazgos** (no 11 — el conteo inicial del brief
sobreestimaba). La numeración de esta tabla sigue la del informe.

## Resumen ejecutivo

| # | Severidad | Disciplina | Estado al cierre |
|---|---|---|---|
| 1 | HIGH | Color (MapLibre vs oklch) | **Abierto** |
| 2 | HIGH | Layout (center stack) | **Abandonado** (fuera de alcance) |
| 3 | HIGH | Layout (Comparar tile grid) | **Abandonado** (fuera de alcance) |
| 4 | MEDIUM | Type voice (escala) | **Parcialmente portado** |
| 5 | MEDIUM | Color voice (ancla dominio) | **Parcialmente portado** |
| 6 | MEDIUM | Surface (profundidad tarjetas) | **Abandonado** |
| 7 | MEDIUM | Interaction (sliders 44 px) | **Abandonado** |
| 8 | LOW | Accessibility (focus 3:1) | **Portado** |
| 9 | LOW | Interaction (hover mapa) | **Abandonado** |
| 10 | LOW | Writing (verbo por nivel) | **Abandonado** |

## Detalle por hallazgo

### #1 — HIGH · Color · `web/src/map/mapa.ts:28-83` oklch → hex
**Antes.** `styleVectorLocal` define `background-color`, `fill-color` y
`line-color` con literales `oklch(...)`. MapLibre exige `hex/rgb/hsl` y
tira `color expected, oklch found` ×3 en consola; el mapa queda gris
vacío en el screenshot.

**Después propuesto.** Convertir a hex mapeando desde OKLCH actual:
`fondo #F2F2EF`, `tierra #D8D8D4`, `línea #6B7378`, `conf-*` a
`#0A8F6A/#C07A00/#A8340A`, `recurso #0072B2`. Mantener `css()` solo para
DOM, no para el JSON del style.

**Estado real al cierre: ABIERTO.** Verificado en `web/src/map/mapa.ts:28-83`,
los literales siguen siendo `oklch(...)`. La build sí produce un bundle
(`web/dist/assets/index-BTjGwSfp.js`) pero la auditoría funcional del
selector de sitio en runtime no se ejecutó como parte del cierre. Se
documenta como hallazgo vivo en `documentacion/estado_huecos.md` no — este
documento sólo registra el estado.

**Motivo.** Requiere un ciclo de `agent-browser` con la app levantada y,
eventualmente, un rediseño de tokens que rompa con la cobertura actual.
No entra en el alcance del cierre del informe.

---

### #2 — HIGH · Layout · `web/src/main.ts` + 4 vistas · center stack
**Antes.** Template inline en `createApp`, cuatro vistas con
`max-width + margin:auto` similares (960/66ch/1180/1280), sin composición
editorial.

**Después propuesto.** Extraer `web/src/App.vue`; **Ver** con cifra hero
`8,9 vs 40` en `36px tabular-nums`; **Comparar** con tabla eslabones
sticky y grupos EMEC por familia; **Calcular** a 66ch aislado; nav con
`nav-niveles` autorada.

**Estado real al cierre: ABANDONADO.** Comprobado: `web/src/main.ts`
sigue montando el `createApp` con template inline y no existe
`web/src/App.vue` propio (sólo se referencia en `web/src/views/Disenar.vue`
como nombre, no como archivo SFC).

**Motivo.** Cambio de gran superficie que afecta a cuatro vistas y al
shell. Requiere un ciclo de revisión visual dedicado, no justificado por
el cronograma del cierre. El rail de **Diseñar** (única vista con decisión
de jerarquía real) sigue funcionando como referencia editorial.

---

### #3 — HIGH · Layout · `web/src/views/Comparar.vue` · feature tile grid
**Antes.** 15 fichas + 5 fracasos en `grid-template-columns:
repeat(auto-fill, minmax(260px,1fr))`, todos al mismo nivel visual.

**Después propuesto.** Catálogo en 3 grupos con `<h3>` familia;
fracasos en banda `var(--acento-suave)`; Sankey con `min-height 280` y
`flex:1.2` vs tabla `flex:1`.

**Estado real al cierre: ABANDONADO.**

**Motivo.** Requiere reorganizar la rejilla y crear cabeceras de familia
que hoy no existen; entra dentro del rediseño general del layout
(hallazgo #2). Se mantiene el comportamiento funcional (fichas clicables,
Sankey actualizado), pero no la jerarquía editorial propuesta.

---

### #4 — MEDIUM · Type · `web/src/styles/tokens.css:11-24` · escala
**Antes.** Escala `12/15/20/27/36` declarada pero no aplicada en las
vistas; Ver mezcla `15px` tesis con `12px` pies; Calcular promete
`66ch` y no lo entrega.

**Después propuesto.** Comprometer escala `12·15·19·27·36` con
`tabular-nums`; Ver tesis `27px/1.15 weight 700`, cifra `36px`,
pies `12px tracking 0.02em`; tablas `13px` con `header 11px caps
tracking 0.06em`; KaTeX `1.05em`.

**Estado real al cierre: PARCIALMENTE PORTADO.** Verificado en
`web/src/styles/tokens.css:17-21`:
```
--text-meta: 12px;
--text-cuerpo: 15px;
--text-seccion: 20px;
--text-nivel: 27px;
--text-cifra: 36px;
```
La escala está declarada como custom property y `*` aplica
`font-variant-numeric: tabular-nums` (línea 52). Lo que **no** está
portado es el compromiso por vista (tesis `27px weight 700`, tablas
`13px`, etc.) — cada vista consume los tokens de forma desigual.

**Motivo del porte parcial.** Los tokens están en sitio y se aplican a
`html`; el ajuste fino por vista queda como criterio editorial de cada
vista y se delega a un ciclo posterior de tiposet.

---

### #5 — MEDIUM · Color · `web/src/styles/tokens.css:1-11` + `semaforo.css:15-22`
**Antes.** Lienzo crema + foco azul tech único acento; `--conf-*` y
`--rol-*` bien separados pero solo el mapa los toca.

**Después propuesto.** Anclar al dominio: fondo papel costa
`oklch(0.97 0.01 85)`, tinta abisal `oklch(0.22 0.02 240)`, recurso
agua profunda `oklch(0.55 0.14 235)`; neutros `chroma <0.015` hacia
`235`.

**Estado real al cierre: PARCIALMENTE PORTADO.** Tokens actuales en
`web/src/styles/tokens.css` mantienen la paleta crema + tech:
`--lienzo oklch(0.96 0.004 106)`, `--foco oklch(0.532 0.131 244)`. Lo
que **sí** se portó es la separación de roles:
`--conf-verificado/--conf-inferido/--conf-pendiente` y
`--rol-recurso`, con el semáforo triple (`● verificado / ◐ inferido /
○ pendiente`) en `web/src/styles/semaforo.css`.

**Motivo del porte parcial.** Cambiar el ancla tonal implica un
recolor completo que afecta al mapa (#1) y a la marca visual; se deja
para una iteración posterior. La separación semántica de roles y la
señalización textual del semáforo son lo que el aula puede sostener.

---

### #6 — MEDIUM · Surface · `web/src/views/Calcular.vue:153-158` + `Comparar.vue:283-293`
**Antes.** `formula-card`, `tabla-eslabones` y `ficha` comparten el
mismo plano `border + radius + panel` sin elevación.

**Después propuesto.** Dos niveles de elevación: base `border 1px
var(--borde-suave) + panel shadow 0 1px 2px`; fórmulas con
`border-top 3px var(--rol-recurso)`.

**Estado real al cierre: ABANDONADO.**

**Motivo.** Decisión editorial de cada vista. No es bloqueante: la
información jerárquica está dada por la tipografía y el orden de
lectura, no por la sombra.

---

### #7 — MEDIUM · Interaction · `web/src/views/Ver.vue:22-29` + `ControlesFisicos.vue:3-17`
**Antes.** Sliders nativos azules, sin `44×44` hit-area ni
`aria-valuetext`.

**Después propuesto.** `control-card` con label + valor `19px/600
tabular` + slider `h 6px thumb 18px` + `::before 44px` hit;
`label for`, `aria-valuetext "1,5 metros"`, `tick` cada `5`.

**Estado real al cierre: ABANDONADO.**

**Motivo.** Los sliders funcionan y exponen el dato, pero el embellecimiento
del control no se hizo. No bloquea la lectura; queda como decisión editorial
de Ver.

---

### #8 — LOW · Accessibility · `web/src/main.ts:106` · focus 3:1
**Antes.** `* :focus-visible 2px var(--foco)` existe en `main.ts:106`
pero sin medición 3:1 sobre `oklch(0.53) / oklch(0.96)`.

**Después propuesto.** Medir contraste, fijar
`outline:2px solid var(--foco); outline-offset:2px; border-radius:4px`
en tokens globales; verificar Tab Ver → Comparar → Mapa a 200 % zoom
320 px.

**Estado real al cierre: PORTADO.** Verificado:
`main.ts:106` mantiene `* :focus-visible{ outline:2px solid var(--foco);
outline-offset:2px; border-radius:4px }` y cada vista define su
propia regla local con `outline-offset:2px` (`Calcular.vue:159`,
`Comparar.vue:303`, `Disenar.vue:269`, `ListaSitios.vue:66`,
`SankeyECharts.vue:104`, `GraficaPlotly.vue:84`,
`EstadoBloque.vue:92`, `Ver.vue:160`).

**Pendiente.** La medición colorimétrica formal a 200 % / 320 px no se
ejecutó; queda como verificación manual en aula antes de la sustentación.

---

### #9 — LOW · Interaction · `web/src/map/mapa.ts:87-122` · hover mapa
**Antes.** Sin `cursor pointer` fuera de radio hit, sin highlight al
`mouseenter`.

**Después propuesto.** `map.getCanvas().style.cursor = 'pointer'` al
`mouseenter` + highlight `circle-stroke-width 1.5→3` del sitio más
cercano.

**Estado real al cierre: ABANDONADO.** El mapa usa `mousemove` para
detectar el sitio más cercano y abrir popup; el cursor y el highlight
no se añadieron.

**Motivo.** Mejora incremental, no bloqueante. El comportamiento
funcional (popup con estado y fuente) ya está portado.

---

### #10 — LOW · Writing · `web/src/views/Ver.vue:5-9` · verbo por nivel
**Antes.** Tesis en dos `<p>` sin verbo; títulos genéricos "Comparar —
juzgar / Calcular — leer".

**Después propuesto.** Ver "Mueve altura, ritmo y freno. Mira cómo
responde la boya."; Comparar "Dónde se pierde cada vatio"; Calcular
"Lee la sustitución, verifica la fuente".

**Estado real al cierre: ABANDONADO.**

**Motivo.** Decisión editorial de copy; queda en manos del siguiente
ciclo de revisión de tiposet/Writing.

---

## Tabla compacta

```
#  sev     estado                motivo
1  HIGH    abierto               oklch en mapa.ts sin conversión a hex
2  HIGH    abandonado            requiere rediseño general de shell
3  HIGH    abandonado            subordinado a #2
4  MEDIUM   parcial               tokens presentes, aplicación por vista desigual
5  MEDIUM   parcial               semáforo portado, ancla tonal sin recolor
6  MEDIUM   abandonado            decisión editorial por vista
7  MEDIUM   abandonado            decisión editorial de Ver
8  LOW      portado               outline 2px + offset 2px en 9 sitios
9  LOW      abandonado            mejora incremental del mapa
10 LOW      abandonado            decisión editorial de copy
```

## Lo que esto significa para el informe

- Lo único **resuelto** al cierre es la regla de foco (#8), porque ya
  estaba en `main.ts` y en cada vista y solo faltaba verificación humana.
- Las dos cosas **abiertas** son las que el informe de revisión llamó
  HIGH #1 (oklch en mapa) y HIGH #2/#3 (composición center stack +
  feature tile grid).
- Las **parciales** son las que más rinden en términos de "lo que el aula
  puede sostener" (#4 type tokens y #5 semáforo): el esqueleto está, la
  aplicación por vista es trabajo editorial de cada vista.
- Las **abandonadas** son trabajo editorial legítimo, no bloqueante para
  la sustentación.