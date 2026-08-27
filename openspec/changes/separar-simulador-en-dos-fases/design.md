## Context

El apartado 10 de `documentacion/especificacion_simulador_energia_marina.md` ya fija el árbol de módulos y las bibliotecas. Este documento no lo repite: recoge las decisiones que ese apartado deja abiertas y que hay que cerrar antes de escribir código. Para la motivación, ver `proposal.md`. Para el contrato de comportamiento, ver los once specs de `specs/`.

Dos restricciones del contexto mandan sobre todo lo demás:

- Es un proyecto de aula de un curso introductorio, con una sustentación en vivo. Lo que falle delante del docente cuenta más que lo que sea elegante.
- Los datos ya descargados están en `datos/`, terminan en 2024 y no crecen. Hay vacíos conocidos, sobre todo Hs y Tp del Caribe, que a fecha de hoy siguen sin fuente.

## Goals / Non-Goals

**Goals:**

- Cerrar la separación entre núcleo e interfaz de modo que se pueda comprobar, no solo declarar.
- Decidir cómo un mismo cálculo alimenta cuatro presentaciones sin duplicarse.
- Decidir cómo se representa la procedencia de cada cifra, que es lo que sostiene el requisito de trazabilidad.
- Decidir el orden de construcción de forma que lo demostrable exista pronto.

**Non-Goals:**

- Elegir entre PySide6 y PyQt6, o entre Matplotlib y PyQtGraph. El apartado 10 ya lo trata y ninguna de esas elecciones cambia los specs.
- Diseñar el cálculo BEM, los amarres o la fatiga. Están fuera del alcance del proyecto.
- Resolver los vacíos de datos. Eso es adquisición, no diseño.

## Decisions

### El núcleo no importa nada de la interfaz, y hay una prueba que lo comprueba

El principio de que el núcleo no sabe que existe la interfaz se degrada solo si nadie lo vigila. La decisión es convertirlo en una prueba automatizada que recorra los módulos de `nucleo/` y `analisis/` y falle si alguno importa el paquete de interfaz.

Alternativa considerada: confiar en la disciplina y la revisión. Descartada porque el modo típico de romperlo es un `import` añadido a las tres de la mañana para depurar algo, y nadie lo revisa después.

### La procedencia viaja con el dato, no en una tabla aparte

Todo valor de emplazamiento o de dispositivo se representa como un objeto con valor, unidad, fuente y estado de verificación, en lugar de un número suelto. Los archivos JSON de `datos/sitios/` y `datos/dispositivos/` llevan esos cuatro campos por cifra.

Esto hace estructural el requisito de que ninguna cifra vaya sin fuente: no se puede cargar un dato sin declarar de dónde sale, porque el campo es obligatorio. Y hace barato mostrar la procedencia al pasar el cursor, porque el dato ya la lleva encima.

Alternativa considerada: números sueltos en el JSON y un documento de fuentes al lado. Descartada porque los dos se desincronizan en cuanto alguien edita uno, y en la sustentación la pregunta incómoda es exactamente de dónde salió ese número.

El estado de verificación reutiliza el vocabulario que ya se usa en la documentación: verificado, inferido o pendiente. Un dato pendiente se carga pero el motor se niega a usarlo, que es lo que exige el spec de trazabilidad.

### Los cuatro niveles son cuatro vistas de un único resultado

El cálculo devuelve siempre el resultado completo de la cadena, con todos los eslabones. Cada nivel decide qué parte de ese resultado muestra y con qué vocabulario. No hay un cálculo reducido propio del nivel Ver.

Esto es lo que hace verificable el requisito de que el conmutador cambie la piel y nunca el cálculo: si los cuatro niveles leen del mismo objeto de resultado, la igualdad entre niveles es cierta por construcción y la prueba correspondiente es trivial de escribir.

Alternativa considerada: que cada nivel pida solo lo que necesita, por eficiencia. Descartada por prematura. La cadena completa para un caso es barata, y duplicar rutas de cálculo es exactamente el defecto que el proyecto quiere evitar.

### Se adoptan UTide y MHKiT; Capytaine queda como vía de ampliación, no como dependencia

El apartado 10 de la especificación deja abierta la cuestión de las bibliotecas de dominio. Se cierra así:

| Biblioteca | Licencia | Decisión |
|---|---|---|
| UTide | MIT | **Se adopta** para el análisis armónico de marea |
| MHKiT | BSD | **Se adopta** para los cálculos conformes a IEC TS 62600 |
| pyTMD | MIT | Reserva, si hiciera falta marea donde no hay mareógrafo |
| Capytaine | GPL-3.0 | **No se adopta.** Vía de ampliación |
| WecOptTool | GPL-3.0 | **No se adopta.** Fuera del alcance |

**UTide es la que más cambia el proyecto, y no por potencia de cálculo sino por trazabilidad.** Permite ajustar las constituyentes armónicas sobre las series mareográficas ya descargadas en `datos/ideam/`: 194.733 registros de diez minutos en Isla Tesoro y 83.611 horarios en Juanchaco. Con eso, las amplitudes de M2 y S2 dejan de ser constantes tomadas de un libro y pasan a ser un ajuste sobre dato medido colombiano, que es justo lo que exige la regla de que ninguna cifra vaya sin fuente. Reimplementar un ajuste armónico por mínimos cuadrados con correcciones nodales sería reinventar mal algo resuelto.

**MHKiT** ya estaba señalada en el apartado 10 y se confirma. Implementa los cálculos de la IEC TS 62600-101 y 62600-100, que el proyecto cita como norma de referencia. No tiene sentido reimplementar momentos espectrales y matrices de potencia.

**Capytaine se rechaza por licencia, no por calidad.** Resuelve por elementos de contorno el problema que la especificación excluye en su apartado 3.3: daría A(ω) y B(ω) calculados para la geometría real de la boya en vez de tomados de literatura. Dos razones para no adoptarla en este proyecto:

- Es GPL-3.0 y la entrega es un ejecutable empaquetado con PyInstaller. Distribuir el binario obligaría a liberar todo el proyecto bajo GPL. Es una decisión que no corresponde tomar dentro de un trabajo de curso.
- Exige mallado de la geometría y compilación de rutinas Fortran, con lo que el modo de fallo típico se traslada a la instalación, en un curso introductorio y posiblemente en salas de cómputo con permisos restringidos.

Queda anotada como la vía natural de ampliación el día que el proyecto quiera levantar la exclusión de BEM. Mientras tanto, los coeficientes hidrodinámicos siguen viniendo de literatura y citados, y la limitación se declara en pantalla como ya exige el spec de trazabilidad.

Alternativa considerada: adoptar Capytaine y distribuir el proyecto bajo GPL. Descartada porque cambia las condiciones de licencia de un trabajo de aula por una mejora que el alcance declarado no necesita.

### La animación consume el mismo resultado, muestreado

El nivel Ver necesita la posición de la boya en el tiempo. Esa serie sale del integrador de la ecuación de movimiento, y la animación la reproduce muestreándola, no recalculando nada por fotograma.

Consecuencia práctica: la simulación produce una serie temporal antes de que empiece la animación, y el dibujo es solo lectura. Eso desacopla la velocidad de la animación de la del integrador y elimina la tentación de sustituir la física por una sinusoide cuando el fotograma no llega a tiempo.

### El hilo de cálculo comunica por señales, y siempre se puede cancelar

El riesgo técnico número uno declarado es que la ventana se congele en la demostración. La decisión: la interfaz nunca llama al núcleo de forma directa. Lanza un trabajo, recibe progreso y resultado por señales, y dispone de cancelación.

Que la cancelación exista desde el principio importa más de lo que parece: sin ella, el modo de fallo en la sustentación no es una ventana congelada sino una ventana que responde pero no se puede detener, que a efectos prácticos es lo mismo.

### El orden de construcción va de lo comprobable a lo vistoso

Núcleo primero, pruebas de invariantes después, nivel Ver a continuación, y solo entonces el resto. `tasks.md` ya lo recoge en ese orden.

La razón no es metodológica sino de riesgo: los invariantes físicos son lo único que distingue un simulador de una animación con números, y son lo primero que una pregunta del docente puede tumbar. Construirlos antes que la interfaz significa que cualquier cosa que se enseñe ya está respaldada.

### Los datos se congelan en el repositorio y los scripts de descarga viven aparte

Las series ya descargadas quedan como archivos en `datos/`. Los scripts que las regeneran se ejecutan a mano, nunca desde la aplicación.

Las series del IDEAM terminan en 2020 o 2024 y no crecen, así que una consulta en vivo no aportaría nada más fresco y sí añadiría una dependencia de red durante la sustentación. Para el portal DHIME, además, la descarga automatizada no es posible: hay que pasar por su formulario.

## Risks / Trade-offs

- **No hay Hs ni Tp medidos para el Caribe colombiano.** El módulo de recurso undimotriz es el corazón del simulador y hoy se apoya en una densidad media publicada, no en una serie. → Hay adquisición en curso explorando reanálisis abiertos. Si no aparece nada, la salida es construir la matriz de dispersión a partir de la densidad media publicada y declararlo en pantalla como reconstrucción, no como medida.

- **Todo el dato de nivel del mar del IDEAM es preliminar, ninguno definitivo.** → Se admite y se declara junto a la cifra. La alternativa era quedarse sin rango mareal colombiano de fuente primaria, que es peor.

- **La regla de ninguna cifra sin fuente puede dejar huecos visibles en la demostración.** Un panel con varios criterios rotulados como pendientes se ve peor que uno completo. → Se asume. Un hueco declarado es defendible ante una pregunta; una cifra inventada, no. El propio proyecto convierte esto en argumento pedagógico.

- **Cuatro niveles multiplican la superficie de interfaz y el proyecto es de un curso introductorio.** → El orden de construcción lo contiene: Ver es el único que debe estar terminado para la primera demostración, y los otros tres degradan a no disponible todavía sin romper nada.

- **El acoplamiento entre animación y física puede volverse lento con configuraciones costosas.** → La animación lee una serie ya calculada, así que el coste se paga una vez antes de animar, no por fotograma. Si aun así tarda, se reduce la duración simulada, nunca la fidelidad del modelo.

## Migration Plan

No aplica en el sentido habitual: no hay sistema anterior en producción ni datos que migrar. El código del simulador no está iniciado.

Lo único que se arrastra es documentación ya escrita, y queda coherente: la especificación funcional y los documentos de fuentes de `documentacion/` son la referencia de la que estos specs derivan, y siguen siendo válidos.

## Open Questions

- Si aparece una serie de oleaje utilizable para el Caribe, ¿la matriz de dispersión se construye con esa serie o se conserva también la reconstrucción a partir de la densidad media, como comparación? Se puede decidir cuando se sepa qué serie hay; no cambia ningún spec ni el reparto de tareas.
- ¿Cuántas viviendas equivalen a un MWh al año en el nivel Ver? Necesita un consumo residencial de referencia con fuente. No bloquea la construcción del nivel: el requisito es que la salida se exprese en viviendas, y la constante entra cuando tenga fuente.
