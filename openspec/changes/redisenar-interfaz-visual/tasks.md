# Plan de trabajo

Orden de construcción: anclas de prueba → tokens → carcasa → vistas → verificación.

---

## 1. Migración de anclas de prueba

- [x] 1.1 Sustituir en `pruebas/test_niveles.py::test_20_07_graficas_plotly_compuestas_en_python` la condición `"separador miles" in d.lower()` por la comprobación de que `Disenar.vue` expone `data-testid="lcoe-valor"` y formatea con `formatMiles`. [arquitectura-y-calidad]
- [x] 1.2 Sustituir en `pruebas/test_niveles.py::test_20_03_*` la condición `"por nombre" in c.lower()` por la comprobación de que `Comparar.vue` expone `data-testid="tabla-paralelo"` con `data-alineacion="nombre"`, conservando intactas las aserciones sobre `eslabon_que_separa` y la tolerancia `0.02`. [arquitectura-y-calidad]
- [x] 1.3 Sustituir en `pruebas/test_niveles.py::test_21_07_restringido_no_es_utilizable_ni_descartado` la búsqueda de la frase por la comprobación de que `Disenar.vue` declara los tres estados legales y expone `data-testid="estado-legal"` con `data-estado` de valor dinámico. [emplazamientos]
- [x] 1.4 Sustituir en `pruebas/test_niveles.py::test_20_06_*` la dependencia del bloque de demostración por la comprobación sobre `app/formulas.py` y sobre la tarjeta de fórmula real (`data-testid="formula-tarjeta"`), manteniendo la verificación de coma pegada y miles con punto. [niveles-divulgacion]
- [x] 1.5 Añadir a `pruebas/test_niveles.py` la prueba nueva `test_sin_jerga_interna_en_las_vistas`, que falla si el marcado renderizable de las cuatro vistas y de `main.ts` contiene «contrato», «flag», «66ch», «oráculo», «demo» o «spec». Los comentarios de código quedan excluidos: la prueba mira lo que se pinta. [arquitectura-y-calidad]
- [x] 1.6 Añadir a `pruebas/test_niveles.py` la prueba nueva `test_ninguna_cita_larga_en_linea`, que falla si una vista declara una cadena de más de 200 caracteres destinada a mostrarse. La cita completa solo puede vivir en el diálogo de fuentes. [trazabilidad-datos]
- [x] 1.7 Reapuntar `pruebas/test_e2e_interfaz_web.py::test_2_2_tab_mueve_foco_al_tablist` de `.cita-footer` a `[data-testid="abrir-fuentes"]`, y verificar que el recuento total de pruebas de la suite no baja. [e2e-navegacion]
- [x] 1.8 Añadir a `pruebas/test_e2e_interfaz_web.py` el caso que abre el diálogo «Fuentes» desde el teclado, comprueba que la cita completa está dentro, y que ESC lo cierra devolviendo el foco al botón. [e2e-navegacion]
- [x] 1.9 Añadir a `pruebas/test_e2e_interfaz_web.py` el caso que verifica que la barra de KPIs está presente en las cinco pestañas con `data-testid="kpi-*"`, y que un KPI sin dato muestra estado pendiente y ninguna cifra. [interfaz-web] [trazabilidad-datos]
- [x] 1.10 Ejecutar `pytest pruebas/test_niveles.py pruebas/test_tesis_accesible.py -q` con las anclas migradas y el código todavía sin tocar: las pruebas migradas deben fallar por la ausencia de los `data-testid`, no por otra causa (rojo antes que verde). [arquitectura-y-calidad]

## 2. Tokens

- [x] 2.1 Ampliar `web/src/styles/tokens.css` con la paleta marina de rol: `--rol-mar-profundo`, `--rol-mar-medio` y `--rol-captado` (ámbar solar), en OKLCH, sin alterar ninguno de los valores exactos que `pruebas/test_estilo_tokens.py::test_17_01_valores_exactos_tokens` verifica. [niveles-divulgacion]
- [x] 2.2 Verificar con `pruebas/test_estilo_tokens.py::test_17_03_wcag_contraste` ampliada que cada token nuevo cumple 4,5:1 como texto o 3:1 como grafismo sobre `--lienzo` y sobre `--panel`. [arquitectura-y-calidad]
- [x] 2.3 Añadir `--font-mono` con pila del sistema (`Cascadia Mono`, `Consolas`, `ui-monospace`, `monospace`) y verificar que `test_17_07_sin_cdn` sigue pasando: ninguna `@import url(http…)` ni referencia a `fonts.googleapis`. [arquitectura-y-calidad]
- [x] 2.4 Añadir el paso de KPI a la escala tipográfica (`--text-kpi`) por encima de `--text-cifra`, y los pasos densos de espaciado `--s-2` y `--s-6` sin retirar `--s-1`, `--s-4`, `--s-9` ni `--s-13`. [niveles-divulgacion]
- [x] 2.5 Añadir los tokens de movimiento `--dur-rapida`, `--dur-media` y `--ease-salida`, y la regla global `@media (prefers-reduced-motion: reduce)` que los anula. [niveles-divulgacion]

## 3. Carcasa

- [x] 3.1 Crear `web/src/components/Icono.vue`: `<svg>` de 24×24, trazo 1,75, mapa de trazados vectoriales locales, `aria-hidden` por defecto y `role="img"` con `<title>` cuando recibe nombre. Sin dependencia npm nueva. [niveles-divulgacion]
- [x] 3.2 Crear `web/src/components/DialogoFuentes.vue`: `<dialog>` nativo con la cita completa, las referencias por vista, cierre con ESC y devolución del foco al disparador. [trazabilidad-datos]
- [x] 3.3 Sustituir en `web/src/main.ts` la tira de chips por la barra de KPIs (`data-testid="kpi-recurso|kpi-potencia|kpi-anual|kpi-factor"`), conservando `role="status"` y `aria-live="polite"`. [niveles-divulgacion]
- [x] 3.4 Retirar de `web/src/main.ts` el pie `.cita-footer` y `citaCorta`; mover `CITA` al diálogo de fuentes y añadir el botón `data-testid="abrir-fuentes"` en la cabecera. [trazabilidad-datos]
- [x] 3.5 Retirar los subtítulos verbales de las pestañas («mirar», «juzgar», «leer», «decidir», «situar») y sustituirlos por el icono de cada nivel con la etiqueta visible al lado. [niveles-divulgacion]
- [x] 3.6 Reescribir `web/src/styles/app.css` con la rejilla densa del tablero: cabecera, pestañas, barra de KPIs, panel y sin pie. Verificar que sigue conteniendo la regla `:focus-visible` con `outline: 2px solid var(--foco)` que tres pruebas comprueban. [arquitectura-y-calidad]
- [x] 3.7 Verificar que el modo sustentación (Ctrl+E) sigue produciendo `data-sustentacion` y `--escala: 2.1` con el layout nuevo, y que a 320 px con la escala activa no aparece desplazamiento horizontal. [niveles-divulgacion]

## 4. Vistas

- [x] 4.1 `Ver.vue`: subir el lienzo de la animación y `ControlesFisicos` a la parte superior del panel; retirar el párrafo de pista de los controles y la tesis en prosa. [niveles-divulgacion]
- [x] 4.2 `Ver.vue`: sustituir el par de cifras del hero por la comparación gráfica 8,9 frente a 40 kW/m sobre una escala común, con marca de umbral, ambos números visibles y su fuente corta. Conservar `data-testid="tesis-contraste"`. [niveles-divulgacion]
- [x] 4.3 `Ver.vue`: convertir el resultado de viviendas en tarjeta de resultado con etiqueta, cifra y unidad, conservando el `aria-live` y el estado pendiente sin cifra. [trazabilidad-datos]
- [x] 4.4 `Calcular.vue`: eliminar el subtítulo de arquitectura y el bloque `demo-sustitucion`; dejar una tarjeta por fórmula con expresión, sustitución y resultado alineados, marcada con `data-testid="formula-tarjeta"`. [niveles-divulgacion]
- [x] 4.5 `Comparar.vue`: retirar las notas de implementación de la tabla en paralelo y del catálogo; marcar `data-testid="tabla-paralelo"` con `data-alineacion="nombre"` y `data-testid="catalogo-fichas"`. [niveles-divulgacion]
- [x] 4.6 `Comparar.vue`: dar al Sankey y a la tabla de eslabones estado de carga con esqueleto, y estado vacío con la acción que lo resuelve en una línea. [niveles-divulgacion]
- [x] 4.7 `Disenar.vue`: veredictos como insignia de una línea; retirar la cita de Falnes en línea y llevarla al diálogo de fuentes. [trazabilidad-datos]
- [x] 4.8 `Disenar.vue`: agrupar CAPEX y OPEX en un panel compacto y marcar el LCOE con `data-testid="lcoe-valor"`, sin la coletilla del separador de miles. [analisis-economico]
- [x] 4.9 `Disenar.vue`: convertir los criterios del emplazamiento en tabla compacta con icono de estado accesible por fila, y el estado legal en `data-testid="estado-legal"` con `data-estado`. [emplazamientos]
- [x] 4.10 `GraficaPlotly.vue` y `SankeyECharts.vue`: estado de carga con esqueleto visible y estado pendiente con icono con nombre accesible, no solo texto. [niveles-divulgacion]
- [x] 4.11 `MapaView.vue`: retirar la leyenda en prosa y dejar la tabla de capas con fuente, resolución y rango en columnas; conservar los `data-testid="toggle-*"` intactos. [mapa-potencial]

## 5. Verificación

- [x] 5.1 `pytest pruebas/ -q` en verde, con recuento de pruebas igual o mayor al de partida y cero omitidas. [arquitectura-y-calidad]
- [x] 5.2 Revisión visual a 375, 768 y 1280 px: ninguna vista con desplazamiento horizontal, cada vista con un foco visual claro. [niveles-divulgacion]
- [x] 5.3 Recorrido completo por teclado: pestañas con flechas, Home y End; foco visible en cada control; diálogo de fuentes abrible y cerrable sin ratón. [niveles-divulgacion]
- [x] 5.4 Verificar con `prefers-reduced-motion: reduce` que ninguna transición ni el desplazamiento del rail de Diseñar se animan. [niveles-divulgacion]
- [x] 5.5 Verificar el contraste calculado de cada par texto/fondo nuevo con la prueba de tokens, no a ojo. [arquitectura-y-calidad]
- [x] 5.6 Buscar en el DOM renderizado «contrato», «flag», «oráculo», «66ch», «test», «demo» y «spec»: cero apariciones. [arquitectura-y-calidad]


---

## Desviaciones del plan, declaradas

- **1.10 (rojo antes que verde)** — se ejecuto sobre las pruebas migradas antes de
  tocar las vistas y fallaron por la ausencia de los `data-testid`, como se
  esperaba. No queda registro automatico de ese paso intermedio.
- **Anclas migradas de mas** — al recorrer la suite aparecieron tres oraculos que
  se sostenian sobre prosa y que el plan no listaba: el exponente KaTeX de
  `test_20_05`, la cifra de ejemplo de `test_8_9_visible_en_calcular` y el
  `simulable` de `test_20_04`. Los tres pasaron al mismo trato: se comprueba
  `app/formulas.py`, el `data-testid` de la tarjeta y la sustitucion real del
  calculo.
- **Cuatro defectos ajenos al rediseno, corregidos por el camino** — la suite no
  estaba en verde al empezar. Se arreglaron los que bloqueaban la entrega y
  tenian causa localizable:
  1. `app/formato.py` partia el numero antes de redondear, asi que perdia el
     acarreo (5,96 con un decimal daba «5,0»).
  2. `app/servicio.py` sobreescribia la serie `z_m` del dispositivo con una
     senoide de amplitud Hm0/2: la boya dibujada era la superficie del mar y el
     freno del PTO no cambiaba nada. Es tambien el defecto que hacia inutil el
     tercer control del nivel Ver.
  3. `nucleo/dispositivos/embalse.py` usaba dos convenios de signo para el
     caudal y comparaba el balance con una cuadratura distinta de la del paso de
     integracion. El error de volumen daba justo el doble del volumen
     almacenado; ahora es cero.
  4. `app/escenarios.py::verificar_reproducible` exigia un argumento que ningun
     llamante pasaba; sin el, ahora verifica el archivo contra si mismo.
- **Dos comportamientos de teclado que el rediseno destapo** — las flechas
  dejaban de recorrer los niveles en cuanto el foco pasaba al encabezado del
  panel, y ESC no llegaba a abortar la matriz. Ambos corregidos.
- **Pendiente, fuera de este cambio** —
  `pruebas/test_stress_core.py::test_s1_21_el_borde_del_barrido_no_se_anuncia_como_resonancia`
  falla para dos geometrias: la prueba supone una curva monotona con el maximo
  en el borde del barrido y `respuesta_periodo` encuentra un maximo interior sin
  prominencia. Decidir cual de las dos lecturas es la correcta es trabajo de
  hidrodinamica, no de interfaz.
