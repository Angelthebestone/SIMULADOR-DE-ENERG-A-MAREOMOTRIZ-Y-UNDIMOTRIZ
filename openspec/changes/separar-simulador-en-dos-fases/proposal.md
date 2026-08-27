# Separar el simulador en dos fases

## Por qué

El simulador especificado hasta ahora es una sola pieza que va del oleaje al coste por MWh. Esa cadena completa sirve para la sustentación técnica, pero deja fuera a la mayor parte de quien va a verlo primero: jurados no especialistas en energía marina, comunidad de la zona no interconectada, estudiantes de semestres iniciales y cualquiera que llegue sin saber qué es un frente de ola.

Un usuario que abre la herramienta y se encuentra con espectros, eficiencias de captura y anualizaciones de coste no aprende: se retira. El orden de aprendizaje va de lo observable a lo formal, no al revés.

La separación en dos fases también resuelve un problema de ejecución. La fase técnica depende de datos que todavía tienen pendientes de verificación, entre ellos el área real del embalse de La Rance, y de capítulos del Handbook que no se pudieron extraer porque el PDF disponible está truncado. La fase visual no depende de ninguno de esos pendientes y puede construirse y mostrarse ya.

## Qué cambia

El simulador pasa de ser un producto único a tener dos modos, con un orden de entrada definido.

**Fase 1, exploración visual.** Es la puerta de entrada y lo primero que ve cualquier usuario. Muestra el funcionamiento de los cuatro dispositivos en movimiento, con controles de pocos parámetros y salidas expresadas en magnitudes cotidianas en lugar de unidades de ingeniería. Enseña los conceptos básicos por observación: de dónde sale la energía del mar, qué distingue al oleaje de la marea y de la corriente, por qué el mismo aparato rinde distinto en el Caribe que en el Atlántico norte. No calcula costes ni presenta fórmulas.

**Fase 2, modo técnico.** Es la que ya está especificada. Conserva íntegra la cadena de cálculo hasta el coste por MWh, las dependencias cuadrática y cúbica, la comparación entre emplazamientos y el ejercicio de crítica metodológica. Se accede a ella desde la fase 1 de forma explícita, nunca por defecto.

Las dos fases comparten el mismo motor de cálculo. La fase 1 no es una maqueta con números inventados: usa los mismos datos de Isla Fuerte y los mismos coeficientes, solo que no los muestra.

## No es objetivo

- Rehacer la especificación técnica existente. La fase 2 es esa especificación, tal cual, con una puerta de entrada delante.
- Construir la fase 2 dentro de este cambio. Aquí se define la separación y se construye la fase 1.
- Sustituir la sustentación técnica por la visual. El docente y el curso evalúan la cadena completa: la rúbrica del segundo corte asigna el 55 % a especificaciones técnicas, materiales y cálculos.
- Simplificar la física. Lo que se oculta en la fase 1 son las unidades y las fórmulas, no el rigor de lo que ocurre debajo.

## Supuestos confirmados

Este cambio se redactó sin acceso al documento de especificación. Ese documento ya está en el repositorio, en `documentacion/especificacion_simulador_energia_marina.md`, y los cuatro supuestos quedan contrastados contra él el 25 de agosto de 2026:

- **Confirmado.** Emplazamiento por defecto Isla Fuerte, 8,9 kW/m y 78 MWh/m al año. Fuente: Ortega y otros (2013), Renewable Energy 57, 240-248. Es el único caso colombiano con cifra revisada por pares; San Andrés queda como escenario secundario porque su tesis de referencia solo publica el resumen y no da la densidad en kW/m.
- **Confirmado.** Cuatro dispositivos, uno por concepto, en los términos exactos del apartado 3.1 de la especificación.
- **Confirmado.** La cadena termina en coste por MWh. De los ocho dispositivos fracasados documentados en el apartado 5, ninguno falló por física imposible.
- **Confirmado con una precisión.** Las cifras 999 MWh frente a 222 MWh al año son correctas: la primera es el ejemplo del propio Handbook (cap. 1, §4.2) con 40 kW/m, la segunda es el mismo cálculo rehecho con los 8,9 kW/m de Isla Fuerte. Las cifras 32,3 W frente a 5.535 W también son correctas, para 1 m² de área barrida con Cp = 0,40, pero los 3,0 m/s de la segunda son una velocidad de referencia comercial genérica, **no un valor medido en Pentland Firth**. Debe citarse como "umbral comercial de referencia", no atribuirse a un emplazamiento concreto.

## Corrección de alcance

Este es un **proyecto de aula** de FCN030 Introducción a la Ingeniería, no un proyecto de grado. Donde una versión anterior de este documento decía "jurado del proyecto de grado", debe leerse el docente del curso y la sustentación en clase.

## Adición posterior: la fase 1 tiene cuatro niveles, no dos

La especificación, en su apartado 9.0, refina esta separación: en vez de dos fases hay cuatro niveles de divulgación progresiva sobre un mismo núcleo, con un conmutador que cambia la piel y nunca el cálculo.

| Nivel | Corresponde a |
|---|---|
| Ver | Fase 1 de esta propuesta |
| Comparar | Fase 1 ampliada: Sankey y fichas, todavía sin fórmulas |
| Calcular | Fase 2, fórmulas con números sustituidos |
| Diseñar | Fase 2 completa, hasta coste por MWh |

La condición innegociable que añade la especificación: la animación de la fase 1 debe estar movida por el modelo real, con el número de onda del solucionador de dispersión y la posición de la boya salida de integrar la ecuación de movimiento. Una animación decorativa con la calculadora al lado se nota en la sustentación.
