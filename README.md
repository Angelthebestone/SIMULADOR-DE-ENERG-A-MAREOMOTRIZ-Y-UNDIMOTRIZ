# Simulador de energía marina

Proyecto de aula de FCN030 Introducción a la Ingeniería, UTS, semestre 2026-2.
Prototipo educativo de generación energética undimotriz y mareomotriz, como aplicación
de escritorio en Python.

## Qué es

Un simulador que recorre la cadena completa de conversión, de recurso a coste por MWh,
para cuatro dispositivos, con datos de emplazamientos colombianos y una interfaz que
empieza siendo visual y va destapando lo técnico a medida que el usuario lo pide.

La tesis del proyecto, que el simulador debe hacer descubrir y no enunciar:

> La energía marina en Colombia es marginal frente a la red interconectada, pero
> competitiva frente al diésel en zonas no interconectadas.

## Dónde está cada cosa

| Ruta | Contenido |
|---|---|
| `documentacion/especificacion_simulador_energia_marina.md` | Especificación funcional. Qué dispositivos, qué ecuaciones, qué datos, qué salidas y qué queda fuera. Es el documento de referencia. |
| `documentacion/investigacion_convertidores_marinos.md` | Investigación de respaldo. Unas 50 fuentes con URL, cada afirmación etiquetada como verificada, general o inferida, y doce vacíos registrados. |
| `documentacion/fuentes_datos_ideam.md` | Qué datos publica el IDEAM, por qué canal y con qué reservas. Rango mareal medido de fuente primaria. |
| `documentacion/areas_marinas_protegidas.md` | Restricción legal de emplazamiento. Qué candidatos caen dentro de áreas protegidas. |
| `datos/` | Series descargadas y los scripts que las regeneran. El simulador lee estos archivos, nunca la red. |
| `openspec/changes/separar-simulador-en-dos-fases/proposal.md` | Por qué la interfaz entra por lo visual. |
| `openspec/changes/separar-simulador-en-dos-fases/tasks.md` | Plan de trabajo en orden de ejecución. |

Los dos libros de referencia (Handbook of Ocean Wave Energy y Cruz 2008) están en
`I:\Mi unidad\TEC. EN GESTIÓN DE RECURSOS ENERGETICOS\2026-2 (6to semestre)\INTRODUCCIÓN A LA ING\libros`.

## Alcance

Dos familias, cuatro dispositivos, uno por concepto:

| Familia | Dispositivo | Qué enseña |
|---|---|---|
| Undimotriz | Absorbedor puntual | Resonancia y ancho de captura mayor que el propio diámetro |
| Undimotriz | Columna de agua oscilante en rompeolas | Que compartir la obra civil cambia la economía por completo |
| Mareomotriz | Presa de rango mareal | Dependencia cuadrática con el rango |
| Mareomotriz | Turbina de corriente | Dependencia cúbica con la velocidad |

Hidráulica convencional queda fuera del alcance, pero la arquitectura deja el hueco para
añadirla como tercera familia sin reescribir nada.

Emplazamiento por defecto: **Isla Fuerte, Bolívar**. 8,9 kW/m y 78 MWh/m al año, dato
revisado por pares, zona no interconectada con unos 2.000 habitantes a 11 km del
continente.

## Cómo entra el usuario

Cuatro niveles sobre un mismo motor. El conmutador cambia la piel, nunca el cálculo.

1. **Ver.** Animación, tres controles en lenguaje corriente, resultado en casas
   alimentadas.
2. **Comparar.** Sankey de pérdidas y fichas de dispositivos reales, sin fórmulas.
3. **Calcular.** Cada fórmula con los números ya sustituidos y la fuente de cada
   constante.
4. **Diseñar.** Resonancia, límites teóricos, producción anual y coste por MWh.

## Reglas que no se negocian

1. **La animación se mueve con el modelo real.** El número de onda sale del solucionador
   de la relación de dispersión y la posición de la boya de integrar la ecuación de
   movimiento. Una animación decorativa con la calculadora al lado se nota en la
   sustentación.
2. **La simulación corre en `QThread`, nunca en el hilo de la interfaz.** Es el riesgo
   técnico número uno: la ventana se congela justo durante la demostración en vivo.
3. **Ninguna cifra sin fuente.** Si un dato no está verificado, va marcado como pendiente
   y no entra al simulador. La lista de pendientes está en el apartado 13 de la
   especificación.
4. **El núcleo de física no sabe que existe la interfaz.** Así el mismo código alimenta
   las gráficas del informe, las pruebas y la aplicación.

## Estado

Especificación e investigación terminadas el 25 de agosto de 2026. Código no iniciado.
El orden de construcción está en `tasks.md`: núcleo, pruebas de invariantes, nivel Ver,
y solo después el resto.
