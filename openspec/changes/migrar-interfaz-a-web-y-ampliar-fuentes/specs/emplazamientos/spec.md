## MODIFIED Requirements

### Requirement: Emplazamiento por defecto

El sistema SHALL arrancar con Isla Fuerte, Bolívar, como emplazamiento activo, con 8,9 kW/m de densidad media y 78 MWh/m al año, y SHALL mostrar la referencia de esa cifra junto al valor.

Cuando existan valores de densidad de potencia procedentes de otras fuentes para el mismo emplazamiento, el valor de diseño SHALL seguir siendo el revisado por pares, y los demás SHALL presentarse como contraste con su resolución y su distancia al emplazamiento.

#### Scenario: Sitio activo al abrir

- **WHEN** se abre la aplicación
- **THEN** el emplazamiento activo es Isla Fuerte
- **AND** su densidad de potencia y su fuente son visibles

#### Scenario: El valor de diseño no cambia al añadir fuentes

- **WHEN** se incorporan valores de densidad de potencia de fuentes adicionales para Isla Fuerte
- **THEN** el valor de diseño sigue siendo el de la publicación revisada por pares
- **AND** los valores adicionales aparecen como contraste

### Requirement: Panel de puntuación del emplazamiento

El sistema SHALL puntuar el emplazamiento activo contra los criterios de buena ubicación: contenido energético medio superior a 15 kW/m, pendiente media del oleaje superior al 1,5 %, baja relación entre altura máxima y media, baja variación mensual, proximidad a costa e infraestructura, y profundidad del orden de 30 a 60 m. Para Isla Fuerte, el criterio de profundidad SHALL declarar la banda GMRT verificada: 30 m entre 3 y 17,5 km y 60 m entre 10 y 24,25 km según rumbo, con camino más corto al NW (30 m a 5,4 km).

Cuando el emplazamiento se evalúe para un dispositivo de corriente, el panel SHALL incluir además la velocidad de corriente del propio emplazamiento como criterio, y SHALL declararlo pendiente si no dispone de dato propio.

El resultado SHALL poder ser mixto. El sistema NO SHALL ocultar los criterios que el emplazamiento incumple.

#### Scenario: Resultado mixto en Isla Fuerte

- **WHEN** se puntúa Isla Fuerte
- **THEN** el criterio de contenido energético aparece como incumplido, con 8,9 frente a 15 kW/m
- **AND** el criterio de proximidad a costa y usuario final aparece como cumplido

#### Scenario: Criterio sin dato

- **WHEN** un criterio no tiene dato verificado para el emplazamiento activo
- **THEN** aparece como pendiente, no como cumplido ni como incumplido

#### Scenario: Criterio de corriente sin dato propio

- **WHEN** se puntúa para un dispositivo de corriente un emplazamiento sin velocidad de corriente propia
- **THEN** el criterio de corriente aparece como pendiente
- **AND** el panel no toma prestado el valor de otro emplazamiento

## ADDED Requirements

### Requirement: Velocidad de corriente propia por emplazamiento

Todo emplazamiento sobre el que pueda evaluarse un dispositivo de corriente SHALL disponer de velocidad de corriente propia, con su fuente, su estado y, cuando proceda de una rejilla, su resolución y la distancia de la celda al emplazamiento.

Un emplazamiento SHALL declarar su velocidad de corriente como pendiente cuando no disponga de dato propio. El sistema NO SHALL emplear para un emplazamiento el valor medido o modelado en otro, ni siquiera dentro de la misma región.

#### Scenario: Emplazamiento con corriente propia

- **WHEN** se consulta la velocidad de corriente de un emplazamiento con dato propio
- **THEN** aparecen su valor, su unidad, su fuente y su estado
- **AND** si procede de una rejilla, aparecen su resolución y la distancia de la celda

#### Scenario: Valor prestado rechazado

- **WHEN** un emplazamiento carece de velocidad de corriente propia
- **THEN** su velocidad de corriente figura como pendiente
- **AND** ningún cálculo de dispositivo de corriente se ejecuta sobre ese emplazamiento

#### Scenario: Cobertura de los emplazamientos evaluables

- **WHEN** se recorren los emplazamientos que el sistema ofrece para dispositivos de corriente
- **THEN** cada uno tiene velocidad de corriente propia o la declara pendiente

### Requirement: Discrepancia de recurso presentada, no resuelta en silencio

Cuando un emplazamiento tenga valores de densidad de potencia que difieran entre sí más allá de la incertidumbre declarada de sus fuentes, el sistema SHALL presentar la discrepancia de forma explícita, con ambos valores, sus fuentes, sus resoluciones y la magnitud de la diferencia.

El sistema SHALL ofrecer las explicaciones candidatas de la discrepancia que estén documentadas —entre ellas la resolución de la rejilla y la distancia de la celda al emplazamiento— sin afirmar como cerrada ninguna que no lo esté.

#### Scenario: Discrepancia de Isla Fuerte visible

- **WHEN** se consulta la densidad de potencia de Isla Fuerte
- **THEN** aparecen los valores disponibles con sus fuentes y resoluciones
- **AND** la magnitud de la diferencia entre ellos es visible

#### Scenario: Explicación candidata sin cerrar

- **WHEN** se consulta el motivo de la discrepancia
- **THEN** aparecen las explicaciones candidatas documentadas
- **AND** ninguna se presenta como confirmada si no lo está

#### Scenario: Una fuente nueva no cierra la discrepancia por sí sola

- **WHEN** se incorpora un tercer valor de mayor resolución para el mismo emplazamiento
- **THEN** los tres valores quedan visibles con sus resoluciones
- **AND** la discrepancia se declara resuelta únicamente si existe justificación documentada

### Requirement: Los valores que el sistema usa salen del dato del emplazamiento

Ninguna magnitud de recurso SHALL fijarse como constante dentro de la capa de servicio o de la presentación para que un cálculo avance. Un valor de corriente, de altura de ola o de profundidad escrito a mano en el código NO es un dato de emplazamiento: es una hipótesis invisible.

Cuando el dato del emplazamiento falte, el requisito de dato pendiente es el que se aplica, no la sustitución por un valor razonable.

#### Scenario: Sin dato, sin número

- **WHEN** un dispositivo de corriente se evalúa sobre un emplazamiento sin velocidad propia
- **THEN** el cálculo queda bloqueado y se declara el motivo
- **AND** el resultado no muestra ninguna potencia calculada sobre una velocidad supuesta

#### Scenario: La constante inventada se detecta

- **WHEN** la capa de servicio asigna un valor de recurso literal en lugar de leerlo del archivo del emplazamiento
- **THEN** una prueba automatizada falla
- **AND** la prueba recorre las magnitudes de recurso que deben proceder del dato, no del código

### Requirement: Un valor verificado que deja de merecerlo se degrada declarándolo

Cuando una revisión del origen muestre que un valor marcado como verificado procede en realidad de otro emplazamiento, de una rejilla o de una región distinta a la declarada, el sistema SHALL degradar su estado y SHALL dejar constancia del estado anterior y del motivo.

La degradación NO está sujeta a la prohibición de sustituir un valor verificado por uno inferido: esa prohibición protege un valor de diseño correctamente obtenido, no un valor cuyo origen resultó estar mal declarado. Aplicarla aquí convertiría un error de procedencia en un requisito permanente.

#### Scenario: Procedencia corregida

- **WHEN** un valor con estado verificado se revela prestado de otra región
- **THEN** pasa a `pendiente` o a `inferido` según su origen real, con constancia del valor anterior
- **AND** el sistema deja de usarlo como dato propio del emplazamiento

#### Scenario: La degradación no se confunde con el contraste de fuentes

- **WHEN** un emplazamiento tiene a la vez un valor verificado y otro inferido de la misma magnitud
- **THEN** el verificado sigue siendo el valor de diseño
- **AND** el inferido se presenta como contraste, sin desplazar al primero

### Requirement: Los tres estados legales de un emplazamiento

El sistema SHALL distinguir tres situaciones legales sobre un emplazamiento: utilizable, restringido y descartado por área protegida, y SHALL representar cada una con su propio criterio y su propia consecuencia sobre el cálculo. Reducir el catálogo de sitios a dos categorías obliga a elegir entre presentar un caso restringido como plenamente viable o como prohibido, y las dos opciones son falsas.

#### Scenario: Restringido no es lo mismo que descartado

- **WHEN** se selecciona un emplazamiento con situación restringida
- **THEN** aparece qué lo restringe y qué lo distinguiría de un emplazamiento en área protegida
- **AND** el resultado del cálculo se rotula conforme a esa situación, no como ejercicio teórico ni como propuesta viable

#### Scenario: Los tres estados son visibles en la elección de sitio

- **WHEN** el usuario recorre la lista de emplazamientos disponibles
- **THEN** cada uno muestra su situación legal con la fuente que la declara
- **AND** ninguna situación se infiere de la ausencia de marca
