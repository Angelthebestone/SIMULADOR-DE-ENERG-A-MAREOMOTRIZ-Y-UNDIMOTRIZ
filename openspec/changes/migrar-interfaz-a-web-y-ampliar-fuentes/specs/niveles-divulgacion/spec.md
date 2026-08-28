## MODIFIED Requirements

### Requirement: La interfaz nunca se congela

Ningún cálculo SHALL ejecutarse en el hilo de la interfaz. La ventana SHALL seguir respondiendo mientras una simulación está en curso. La simulación SHALL correr en un trabajador aislado de la presentación, comunicado por avisos de progreso, resultado y error, y SHALL ser cancelable en cualquier momento; mientras esté en curso SHALL mostrarse indicador de progreso y control de cancelación.

El mecanismo concreto de aislamiento —hilo, proceso o canal de mensajes— es una decisión de implementación y NO SHALL fijarse en este requisito. Lo que SHALL cumplirse es que la presentación permanezca receptiva y que la cancelación surta efecto.

#### Scenario: Respuesta durante una simulación larga

- **WHEN** se lanza la simulación más costosa que la aplicación admite
- **THEN** la ventana sigue redibujándose y aceptando entrada del usuario
- **AND** existe forma de cancelar la simulación en curso

#### Scenario: Cancelación efectiva

- **WHEN** el usuario cancela una simulación en curso
- **THEN** el trabajo se detiene y la interfaz vuelve a estado disponible sin reinicio

#### Scenario: Animación sin recalcular por fotograma

- **WHEN** se anima la boya en el nivel Ver
- **THEN** la posición procede de muestrear una serie ya integrada, sin recalcular física por fotograma

### Requirement: Lenguaje adaptado a cada nivel

En el nivel Ver el sistema SHALL expresar las salidas en magnitudes cotidianas y limitar los controles a tres, con rótulos en lenguaje corriente. En Comparar SHALL mostrar el diagrama de pérdidas y las fichas de dispositivos reales, todavía sin fórmulas. En Calcular SHALL mostrar cada fórmula con los números ya sustituidos y con notación matemática compuesta, no como cadena de texto plano. En Diseñar SHALL exponer resonancia, límites teóricos, producción anual y coste por MWh.

#### Scenario: Salida en magnitudes cotidianas

- **WHEN** el nivel activo es Ver
- **THEN** el resultado principal se expresa en número de viviendas alimentadas
- **AND** no aparece ninguna fórmula en pantalla

#### Scenario: Fórmulas con números sustituidos

- **WHEN** el nivel activo es Calcular
- **THEN** cada resultado se acompaña de su fórmula con los valores numéricos ya reemplazados

#### Scenario: Notación matemática legible

- **WHEN** se muestra una fórmula con cociente, exponente o letra griega en el nivel Calcular
- **THEN** el cociente aparece como fracción, el exponente en posición superior y la letra griega con su símbolo propio

### Requirement: Modo sustentación y accesibilidad

La interfaz SHALL ofrecer un modo sustentación: tipografía escalable para proyector, paleta con contraste suficiente y distinguible para daltónicos (Sankey y mapa), y atajos de teclado (ESC cancela simulación, Ctrl+E exporta). Al arrancar sin conexión SHALL mostrar aviso offline pero operar con normalidad.

El escalado del modo sustentación SHALL aplicarse a toda la interfaz, incluidas las gráficas, las fórmulas compuestas y las etiquetas del mapa, sin que ningún elemento quede recortado ni desbordado.

El escalado SHALL definirse como un único factor numérico declarado, aplicado desde el origen único de estilo a los tres subsistemas que la interfaz usa: el documento, el mapa representado en lienzo y las figuras compuestas fuera de la presentación. Un factor que solo alcance el documento NO cumple este requisito, y su omisión es la forma en que este modo vuelve a romperse después de la migración.

El factor y la distancia de referencia SHALL declararse en el spec, derivados de la altura de letra que la distancia de visionado exige, para que la verificación tenga un criterio medible en lugar de una impresión de legibilidad.

Ese factor NO SHALL poder satisfacerse en un viewport denso aumentando solo el tamaño: la misma pantalla no admite el doble de letra sin que sobre contenido. Cuando la escala exigida no quepa, el modo SHALL recomponer la pantalla —reducir densidad, retirar elementos secundarios, ampliar el resto— y SHALL declarar qué ha retirado. Pedir a la vez «proporcional para todo» y «nada recortado» sin autorizar la recomposición deja un requisito que se incumple por aritmética, no por descuido.

#### Scenario: Modo sustentación legible

- **WHEN** se activa el modo sustentación
- **THEN** la tipografía alcanza el tamaño base declarado
- **AND** el contraste cumple el mínimo legible a la distancia de referencia declarada

#### Scenario: Escalado sin recortes

- **WHEN** se activa el modo sustentación con el mapa abierto y una fórmula visible
- **THEN** las etiquetas del mapa, la fórmula y el texto de las figuras escalan con el resto
- **AND** ningún elemento queda recortado ni desbordado

#### Scenario: Cuando la escala no cabe, se recompone y se declara

- **WHEN** el factor exigido por la distancia de visionado no cabe en el viewport con toda la densidad del nivel
- **THEN** la pantalla se recompone conservando la cifra principal y su fuente
- **AND** los elementos retirados quedan identificables como retirados, no como ausentes

#### Scenario: Comprobar el escalado sobre el contenido más largo

- **WHEN** se activa el modo sustentación con la sección más densa de cada nivel visible y la cita bibliográfica más larga del proyecto desplegada
- **THEN** ninguna cifra, etiqueta ni rótulo desaparece del viewport
- **AND** la verificación se registra con el nivel y la sección donde se hizo

#### Scenario: Arranque offline

- **WHEN** la aplicación arranca sin internet
- **THEN** aparece aviso offline y todas las funciones operan con datos locales

### Requirement: Cada control muestra el valor que está fijando

Todo control de arrastre o de ajuste SHALL mostrar junto a sí el valor físico que representa, con su unidad y en el formato numérico del proyecto, actualizado mientras se manipula y no solo al soltar.

Un control cuyo efecto numérico no sea visible NO satisface este requisito, aunque el cálculo posterior sea correcto.

#### Scenario: Valor visible durante el arrastre

- **WHEN** el usuario arrastra uno de los tres controles del nivel Ver
- **THEN** el valor en metros, segundos o newton-segundo por metro se actualiza en pantalla mientras arrastra
- **AND** coincide con el valor que la simulación recibe al soltar

### Requirement: El bucle de movimiento continuo se puede detener

Toda animación que se repita por sí sola SHALL disponer de un medio visible de detenerla, y SHALL respetar la preferencia del sistema por movimiento reducido. Detenerla NO SHALL invalidar el resultado mostrado.

#### Scenario: Pausa disponible

- **WHEN** la animación del nivel Ver está en curso
- **THEN** existe un control que la detiene y la reanuda
- **AND** con movimiento reducido la pantalla arranca sin animarse

#### Scenario: Detener no borra el resultado

- **WHEN** el usuario detiene la animación
- **THEN** la última posición y sus cifras permanecen visibles
- **AND** el resto de la interfaz sigue operativa
