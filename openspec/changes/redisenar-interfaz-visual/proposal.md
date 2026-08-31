## Why

La interfaz web funciona y pasa la suite, pero no se lee como un simulador: se lee como el
documento de especificación del que salió. En pantalla hay frases que describen la
arquitectura interna en vez del dominio («Toda magnitud viene del contrato Resultado»,
«la interfaz no deduce, lee el flag», «Una columna 66ch»), andamios de prueba visibles
(el bloque `demo-sustitucion` de Calcular), notas de implementación pegadas a las cifras
(«— separador miles (punto) visible» junto al LCOE) y citas bibliográficas de 500
caracteres repetidas en el pie y dentro de tres vistas.

El motivo por el que ese texto está ahí es real: varios oráculos de `pruebas/` buscan esas
cadenas en el código fuente de las vistas. El texto es el ancla de la prueba. Borrarlo a
ciegas rompe la suite; dejarlo obliga al usuario a leer el vocabulario del equipo de
desarrollo. La salida es migrar cada ancla a un atributo `data-testid` o a un contrato
inspeccionable, y verificar la intención en lugar de la frase.

Con las anclas migradas, el rediseño puede hacer lo que el dominio pide: las gráficas, el
mapa, la animación y los controles como protagonistas; el texto reducido a cifras,
unidades, veredictos de una línea y estados de dato.

## What Changes

- **Anclas de prueba** — Cada cadena de jerga que hoy sostiene un oráculo pasa a
  `data-testid` (o a un atributo/valor inspeccionable) y la prueba correspondiente se
  actualiza en el mismo cambio. Ninguna prueba se pierde en el traslado: el recuento antes
  y después es el mismo o mayor.
- **Copy** — Se retira de pantalla todo el vocabulario de especificación, prueba y código
  («contrato», «flag», «66ch», «oráculo», «demo», «eslabón ausente», «separador miles»).
  Fuera de Calcular ningún párrafo pasa de dos líneas.
- **Tokens** — Se amplía el sistema OKLCH existente (no se reemplaza): rol de recurso-mar
  en azules/teal profundos, acento cálido ámbar para la energía captada, escala tipográfica
  con paso de KPI, y una escala de espaciado densa de tablero. El semáforo
  verificado/inferido/pendiente queda reservado a estados de dato. Todo par de texto
  cumple 4,5:1.
- **Barra de KPIs** — La tira de chips de la carcasa pasa a ser una barra de indicadores
  con etiqueta, valor grande y unidad, visible desde cualquier pestaña, con estado de carga
  y estado pendiente propios.
- **Ver** — La animación del oleaje y los tres controles pasan arriba y ocupan el foco
  visual. El contraste 8,9 frente a 40 kW/m se muestra como comparación gráfica con los dos
  números y la marca de umbral, no como párrafo. Las viviendas alimentadas son una tarjeta
  de resultado.
- **Calcular** — Se elimina el bloque de demostración y la jerga; cada fórmula es una
  tarjeta con expresión, sustitución y resultado alineados.
- **Diseñar** — Rail lateral y secciones a pantalla completa se conservan; los veredictos
  pasan a insignias de una línea, CAPEX y OPEX a un panel compacto y los criterios del
  sitio a una tabla con icono de estado por fila.
- **Fuentes** — Una sola ubicación: un botón «Fuentes» en la cabecera abre un diálogo con
  la cita completa y las referencias por vista. Desaparecen las citas largas en línea y el
  pie de página de cita.
- **Iconografía** — Un componente de icono vectorial local (trazados de Lucide, sin
  dependencia nueva) para pestañas, estados de dato y acciones. Los glifos ● ◐ ○ dejan de
  ser el único portador de significado: quedan como refuerzo `aria-hidden` junto a un
  nombre accesible.
- **Estados vacíos y de carga** — Gráficas, matriz y Sankey muestran esqueleto o indicador
  visual, no solo la palabra «pendiente».

## Impact

- Afectado: `web/src/main.ts`, `web/src/styles/*`, las cuatro vistas, `MapaView.vue`,
  `EstadoBloque.vue`, `GraficaPlotly.vue`, `SankeyECharts.vue`, y un componente nuevo de
  iconos y otro de diálogo de fuentes.
- Afectado: `pruebas/test_niveles.py`, `pruebas/test_tesis_accesible.py`,
  `pruebas/test_e2e_interfaz_web.py`, `pruebas/test_estilo_tokens.py`,
  `pruebas/test_animacion_ver.py` — anclas migradas, intención conservada.
- **No** afectado: `web/src/api.ts`, los endpoints, el flujo de un solo cálculo que
  alimenta todas las vistas, el núcleo, `analisis/` y `app/`.
- Sin dependencias nuevas de npm ni de pip. Sin tipografías por CDN: la política de origen
  único (`pruebas/test_csp_interfaz.py`, `pruebas/test_construccion_web.py`) lo prohíbe, así
  que la intención tipográfica Fira Sans / Fira Code se resuelve con la pila del sistema y
  numerales tabulares.
