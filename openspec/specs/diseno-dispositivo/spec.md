## Purpose

Permite dimensionar un dispositivo contra el recurso del emplazamiento y ver por qué unas dimensiones capturan más que otras, que es lo que distingue el nivel Diseñar de una calculadora.

## Requirements

### Requirement: Resonancia frente al recurso local

El sistema SHALL calcular la frecuencia natural del dispositivo y SHALL contrastarla con el periodo energético predominante del emplazamiento, mostrando la separación entre ambos.

#### Scenario: Dispositivo desintonizado del recurso

- **WHEN** la frecuencia natural del absorbedor difiere del periodo energético predominante del emplazamiento
- **THEN** el sistema muestra la separación entre ambos
- **AND** indica en qué sentido habría que cambiar las dimensiones para acercarlos

#### Scenario: Máximo de captura en resonancia

- **WHEN** se recorre un intervalo de periodos de ola manteniendo la geometría
- **THEN** la potencia capturada presenta su máximo en el entorno de la frecuencia natural

### Requirement: Ancho de captura y sus límites teóricos

El sistema SHALL calcular el ancho de captura del dispositivo y SHALL mostrarlo junto a su límite teórico y a la dimensión física del propio dispositivo.

Para un absorbedor puntual axisimétrico en arfada el límite SHALL ser λ/2π. Cuando el dispositivo combine la arfada con la deriva o el cabeceo, el límite aplicable SHALL ser 3λ/2π, y el sistema SHALL declarar cuál de los dos está usando. El sistema SHALL mostrar también el límite de Budal, que acota la potencia por el volumen desplazado.

#### Scenario: Ancho de captura mayor que el diámetro

- **WHEN** se calcula el ancho de captura de un absorbedor puntual en resonancia
- **THEN** el valor puede superar el diámetro del cuerpo
- **AND** el sistema muestra ambas magnitudes juntas para que la diferencia sea evidente

#### Scenario: El límite depende de los modos de oscilación

- **WHEN** se activa la deriva o el cabeceo además de la arfada
- **THEN** el límite mostrado pasa de λ/2π a 3λ/2π
- **AND** el sistema nombra los modos que justifican el límite empleado

#### Scenario: Límite de Budal activo

- **WHEN** la potencia calculada por ancho de captura supera la que permite el límite de Budal para el volumen desplazado
- **THEN** el sistema entrega la menor de las dos
- **AND** indica cuál de los dos límites está gobernando

### Requirement: Amortiguamiento del PTO optimizable

El sistema SHALL permitir recorrer el amortiguamiento del PTO y SHALL mostrar la curva de potencia capturada resultante, con su óptimo señalado.

#### Scenario: Óptimo interior

- **WHEN** se recorre el amortiguamiento del PTO dentro del rango operativo
- **THEN** la potencia capturada presenta un máximo interior, no en un extremo del rango

#### Scenario: Carrera del PTO como restricción

- **WHEN** el amortiguamiento óptimo produce una carrera del PTO superior al límite de diseño
- **THEN** el sistema muestra el óptimo restringido por la carrera
- **AND** señala que la restricción está activa

### Requirement: Dimensionado desde el recurso del emplazamiento

El sistema SHALL proponer dimensiones de partida del dispositivo a partir del recurso del emplazamiento activo, y SHALL declarar de qué criterio salen.

#### Scenario: Propuesta acompañada de su criterio

- **WHEN** se solicita un dimensionado de partida para el emplazamiento activo
- **THEN** el sistema entrega las dimensiones propuestas
- **AND** nombra el criterio empleado

#### Scenario: Emplazamiento con recurso en disputa

- **WHEN** el emplazamiento activo tiene más de un valor de densidad de potencia con fuente
- **THEN** el dimensionado se calcula con el valor declarado como de diseño
- **AND** el sistema advierte de que existe otro valor con fuente y en cuánto difiere

### Requirement: La obra civil compartida cambia la economía del dispositivo

Para la columna de agua oscilante integrada en rompeolas, el sistema SHALL permitir imputar o no el coste de la obra civil al proyecto energético, y SHALL mostrar el efecto de esa elección sobre el coste por MWh.

#### Scenario: Obra civil imputada frente a compartida

- **WHEN** se calcula el coste por MWh de una columna de agua oscilante con y sin imputar la obra civil
- **THEN** ambos resultados se muestran juntos
- **AND** la diferencia entre ambos queda explicada como decisión de reparto de costes, no como mejora técnica

### Requirement: Dependencia del rango mareal en la presa

El sistema SHALL mostrar que la energía de una presa o laguna de rango mareal depende del cuadrado del rango, y SHALL permitir comparar emplazamientos por esa vía.

#### Scenario: Comparación Caribe contra Pacífico

- **WHEN** se compara la energía por unidad de área embalsada del Caribe colombiano con la del Pacífico colombiano usando los rangos medidos
- **THEN** la relación entre ambas es aproximadamente 112 a 1
- **AND** el sistema atribuye esa relación a la dependencia cuadrática con el rango

#### Scenario: Rango por debajo del mínimo viable

- **WHEN** el rango mareal del emplazamiento queda por debajo del mínimo viable para una presa
- **THEN** el cálculo se completa
- **AND** el resultado queda rotulado como inviable, con el rango mínimo de referencia a la vista

### Requirement: La estrategia de operación vale tanto como la máquina

Para la presa de rango mareal, el sistema SHALL modelar los cuatro modos de operación: vaciado, llenado, bidireccional y con bombeo. SHALL mostrar la diferencia de producción entre ellos sobre la misma máquina y el mismo rango.

El sistema NO SHALL presentar el modo bidireccional como una mejora automática: al operar con carga media menor, su producción anual puede resultar inferior a la del vaciado puro, y el resultado SHALL salir del cálculo y no de un supuesto.

#### Scenario: Los cuatro modos sobre el mismo emplazamiento

- **WHEN** se calcula la producción anual de la misma presa con los cuatro modos de operación
- **THEN** las cuatro producciones se muestran juntas
- **AND** la diferencia se atribuye a la estrategia, no a la máquina

#### Scenario: El bidireccional no gana por definición

- **WHEN** se comparan el modo bidireccional y el de vaciado sobre la misma presa
- **THEN** el sistema muestra cuál produce más según el cálculo
- **AND** acompaña el resultado del número de horas de operación y de la carga media de cada uno

#### Scenario: El bombeo como arbitraje

- **WHEN** se activa el modo con bombeo
- **THEN** la energía consumida en el bombeo y la energía turbinada aparecen por separado
- **AND** el resultado neto queda identificado como tal

### Requirement: Producción de la presa por integración temporal

La producción de una presa o laguna de rango mareal SHALL obtenerse integrando en el tiempo el estado de operación, la carga instantánea `H(t) = |nivel del mar − nivel del embalse|`, el caudal `Q(t)` por turbinas y compuertas, la potencia `P(t) = ρ·g·Q(t)·H(t)·η(H,Q)` y el balance de volumen del embalse sobre su curva área-nivel `A(h)`.

La expresión cerrada `E = ½·ρ·g·A·R²` SHALL usarse únicamente como cota teórica de referencia por ciclo. NO SHALL emplearse para calcular la producción, porque con ella los modos de operación dejan de distinguirse entre sí.

#### Scenario: Los modos se diferencian solos

- **WHEN** se calcula la producción de la misma presa con dos modos de operación distintos
- **THEN** las producciones difieren
- **AND** la diferencia procede de la integración temporal, no de un factor aplicado a la cota teórica

#### Scenario: La cota teórica se muestra como cota

- **WHEN** se consulta la energía por ciclo de una presa
- **THEN** el valor de `½·ρ·g·A·R²` aparece rotulado como cota teórica
- **AND** junto a él aparece la producción integrada, siempre menor

### Requirement: Cota de Falnes y el principio del buen radiador

El sistema SHALL calcular la cota superior de potencia absorbida `P_max = |F_e|²/(8·B(ω))` y SHALL mostrarla junto a la potencia absorbida calculada.

El sistema SHALL enunciar que un buen absorbedor de olas es un buen generador de olas, y SHALL declarar que el límite teórico de absorción es del 50 % para un cuerpo que radia una ola simétrica o antisimétrica y puede acercarse al 100 % para un cuerpo no simétrico, citando la fuente en ambos casos.

#### Scenario: La absorción no supera la cota

- **WHEN** se calcula la potencia absorbida para cualquier combinación de entradas dentro de rango
- **THEN** el valor no supera `|F_e|²/(8·B(ω))`
- **AND** ambos valores se muestran juntos

#### Scenario: Techo de absorción según la simetría

- **WHEN** se consulta el límite de absorción del absorbedor puntual en arfada
- **THEN** aparece el 50 % correspondiente a un radiador simétrico
- **AND** el sistema indica que un cuerpo no simétrico puede superarlo, con su fuente

### Requirement: Amortiguamiento óptimo del PTO por expresión analítica

El sistema SHALL calcular el amortiguamiento óptimo del PTO sin control reactivo como `B_pto,óptimo = √(B(ω)² + [ω(m + A(ω)) − K_h/ω]²)` y SHALL mostrarlo sobre la curva del barrido numérico.

El sistema SHALL hacer visible que en resonancia el término entre corchetes se anula y el óptimo se reduce al acoplamiento de impedancia `B_pto = B(ω)`.

#### Scenario: El barrido confirma la expresión

- **WHEN** se recorre el amortiguamiento del PTO y se compara el máximo hallado con el valor de la expresión analítica
- **THEN** ambos coinciden dentro del 5 %

#### Scenario: Acoplamiento de impedancia en resonancia

- **WHEN** el dispositivo se evalúa a su frecuencia natural
- **THEN** el amortiguamiento óptimo coincide con `B(ω)` dentro del 1 %

### Requirement: Periodo de diseño por contribución energética anual

El dimensionado SHALL tomar como periodo de referencia aquel que maximiza el producto de la energía por su probabilidad de ocurrencia en el emplazamiento, y NO el periodo medio ni el más frecuente. El sistema SHALL mostrar los tres para que la diferencia sea visible.

#### Scenario: El periodo de diseño no es el más frecuente

- **WHEN** se solicita el dimensionado para un emplazamiento con matriz de dispersión cargada
- **THEN** el sistema muestra el periodo de mayor contribución energética anual, el más frecuente y el medio
- **AND** declara cuál de ellos gobierna el dimensionado

#### Scenario: Escalado por el recurso local

- **WHEN** se dimensiona un absorbedor puntual para un emplazamiento cuyo periodo de diseño es menor que el del norte de Europa
- **THEN** la dimensión propuesta escala con el cuadrado del periodo
- **AND** el sistema muestra la dimensión de referencia europea junto a la calculada localmente

### Requirement: Discrepancia entre fuentes de relación de ancho de captura

Cuando dos fuentes publiquen valores distintos de relación de ancho de captura para el mismo tipo de convertidor, el sistema SHALL mostrar ambas con su cita en lugar de elegir una en silencio.

#### Scenario: Medias frente a rangos

- **WHEN** se consulta la relación de ancho de captura de un tipo de convertidor con más de una fuente registrada
- **THEN** aparecen los valores de ambas fuentes con su cita y su año
- **AND** el sistema indica si son medias o rangos

#### Scenario: Caso con discrepancia declarada

- **WHEN** se consulta el convertidor de oleaje oscilante por embate
- **THEN** aparecen el 37 % de una fuente y el rango de 41 a 65 % de la otra
- **AND** el sistema señala la discrepancia en lugar de promediarla

### Requirement: La eficiencia hidrodinámica no decide

El sistema SHALL presentar, junto a la relación de ancho de captura de cada tipo de convertidor, el desenlace comercial de sus desarrollos reales, de modo que sea visible que el tipo con mejor eficiencia hidrodinámica no es el que llegó más lejos.

#### Scenario: Mejor eficiencia, peor desenlace

- **WHEN** se ordenan los tipos de convertidor por relación de ancho de captura
- **THEN** junto a cada uno aparece el estado de sus desarrollos reales
- **AND** el tipo con la mejor relación muestra un desarrollador que cesó actividad
- **AND** el tipo con la peor relación muestra el desarrollo que alcanzó mayor recorrido comercial
