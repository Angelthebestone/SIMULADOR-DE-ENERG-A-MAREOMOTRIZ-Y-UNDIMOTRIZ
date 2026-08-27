## Purpose

Calcula la producción anual conforme a la metodología de la serie IEC TS 62600 y la contrasta con una regla de referencia, porque es la salida principal del simulador y la que se defiende en la sustentación.

## Requirements

### Requirement: Producción anual por matriz de ocurrencia y matriz de potencia

El sistema SHALL calcular la producción anual como la suma, sobre todas las celdas de la matriz de dispersión, del producto entre la ocurrencia de cada estado de mar, la potencia del dispositivo en ese estado, las horas del año y la disponibilidad.

#### Scenario: Suma sobre la matriz

- **WHEN** se calcula la producción anual de un dispositivo en un emplazamiento
- **THEN** el resultado es la suma término a término de ocurrencia por potencia por horas por disponibilidad
- **AND** la contribución de cada celda es consultable

#### Scenario: La matriz de ocurrencia suma la unidad

- **WHEN** se carga la matriz de dispersión de un emplazamiento
- **THEN** la suma de sus ocurrencias es la unidad dentro del 0,1 %

#### Scenario: Celdas sin potencia definida

- **WHEN** la matriz de dispersión contiene estados de mar fuera del rango de la matriz de potencia
- **THEN** esas celdas aportan cero a la producción
- **AND** el sistema informa de qué fracción de la ocurrencia quedó fuera

### Requirement: Origen declarado de la matriz de dispersión

La matriz de dispersión SHALL declarar de qué serie procede y por qué método se construyó. Cuando no proceda de una serie temporal medida o de reanálisis sino de una reconstrucción a partir de valores agregados, el sistema SHALL rotularla como reconstrucción.

#### Scenario: Matriz procedente de serie

- **WHEN** se consulta la matriz de dispersión de un emplazamiento construida a partir de una serie horaria
- **THEN** aparecen la fuente de la serie, su periodo y su número de registros

#### Scenario: Matriz reconstruida

- **WHEN** la matriz procede de una reconstrucción a partir de una densidad de potencia agregada
- **THEN** queda rotulada como reconstrucción
- **AND** no se presenta como distribución medida

### Requirement: Contraste con la regla del pulgar

El sistema SHALL calcular también la producción anual por la regla del pulgar del Handbook, como producto de densidad de potencia, ancho del absorbedor, eficiencia ola-cable, disponibilidad y horas del año, y SHALL mostrar ambos resultados juntos con la tolerancia declarada de la regla.

#### Scenario: Ambos métodos a la vista

- **WHEN** se calcula la producción anual
- **THEN** se muestran el resultado por matriz y el resultado por regla del pulgar
- **AND** se indica que la regla declara una precisión de más menos el cincuenta por ciento

#### Scenario: Discrepancia fuera de tolerancia

- **WHEN** los dos métodos difieren más de lo que la propia regla declara
- **THEN** el sistema lo señala como aviso
- **AND** no oculta ninguno de los dos resultados

### Requirement: El mismo dispositivo en dos recursos

El sistema SHALL permitir calcular la producción anual del mismo dispositivo en emplazamientos de distinta densidad de potencia y SHALL presentar la comparación de forma directa.

#### Scenario: Ejercicio central del proyecto

- **WHEN** se calcula la producción anual del mismo absorbedor con la densidad de potencia de referencia del Handbook y con la del emplazamiento colombiano por defecto
- **THEN** ambas producciones se muestran juntas
- **AND** el sistema expresa la diferencia como relación entre ambas
- **AND** deja claro que el dispositivo y su coste no han cambiado, solo el emplazamiento

### Requirement: Disponibilidad como parámetro explícito

La disponibilidad SHALL ser un parámetro visible y modificable, con su valor por defecto justificado, y NO SHALL quedar incorporada de forma implícita en otros rendimientos.

#### Scenario: Efecto de la disponibilidad

- **WHEN** se reduce la disponibilidad manteniendo el resto de parámetros
- **THEN** la producción anual se reduce en la misma proporción

### Requirement: Factor de planta derivado, no introducido

El factor de planta SHALL calcularse a partir de la producción anual y la potencia nominal, y NO SHALL ser un dato de entrada.

#### Scenario: Coherencia del factor de planta

- **WHEN** se consulta el factor de planta de un resultado
- **THEN** su valor coincide con la producción anual dividida entre el producto de la potencia nominal por las horas del año

### Requirement: Banda de incertidumbre por sensibilidad del recurso

El sistema SHALL permitir variar Hm0 y Te en ±15 % y SHALL mostrar la banda resultante de AEP y de factor de planta. La discrepancia Isla Fuerte 8,9 kW/m (Ortega 2013) vs 1,96 kW/m (ERA5-Ocean) SHALL ofrecerse como caso didáctico de propagación de incertidumbre.

#### Scenario: Banda por variación del recurso

- **WHEN** se solicita sensibilidad con Hm0/Te ±15 %
- **THEN** se muestra AEP mínimo, central y máximo con su banda

#### Scenario: Caso Isla Fuerte como ejemplo

- **WHEN** se compara AEP con 8,9 vs 1,96 kW/m sobre el mismo dispositivo
- **THEN** ambos resultados aparecen como banda de incertidumbre, no como corrección

### Requirement: Limitaciones declaradas del diagrama de dispersión

El sistema SHALL mostrar, junto a toda matriz de dispersión, sus dos limitaciones conocidas: que dentro de una misma celda la potencia del oleaje puede variar en una relación de hasta cuatro a uno, y que la celda no conserva información de dirección ni de forma espectral.

#### Scenario: Nota visible junto a la matriz

- **WHEN** se consulta la matriz de dispersión de un emplazamiento
- **THEN** ambas limitaciones aparecen junto a ella con su fuente

#### Scenario: Dispersión dentro de una celda

- **WHEN** se selecciona una celda de la matriz
- **THEN** el sistema muestra el rango de potencia que los estados de mar de esa celda pueden tomar
- **AND** deja claro que la potencia asignada a la celda es un representante, no un valor único
