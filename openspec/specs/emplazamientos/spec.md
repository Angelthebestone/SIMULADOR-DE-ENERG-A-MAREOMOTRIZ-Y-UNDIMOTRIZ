## Purpose

Define qué sitios de la costa colombiana puede evaluar el simulador, con qué datos y bajo qué restricciones legales, para que la elección de emplazamiento sea un ejercicio argumentado y no una casilla.

## Requirements

### Requirement: Emplazamiento por defecto

El sistema SHALL arrancar con Isla Fuerte, Bolívar, como emplazamiento activo, con 8,9 kW/m de densidad media y 78 MWh/m al año, y SHALL mostrar la referencia de esa cifra junto al valor.

#### Scenario: Sitio activo al abrir

- **WHEN** se abre la aplicación
- **THEN** el emplazamiento activo es Isla Fuerte
- **AND** su densidad de potencia y su fuente son visibles

### Requirement: Panel de puntuación del emplazamiento

El sistema SHALL puntuar el emplazamiento activo contra los criterios de buena ubicación: contenido energético medio superior a 15 kW/m, pendiente media del oleaje superior al 1,5 %, baja relación entre altura máxima y media, baja variación mensual, proximidad a costa e infraestructura, y profundidad del orden de 30 a 60 m. Para Isla Fuerte, el criterio de profundidad SHALL declarar la banda GMRT verificada: 30 m entre 3 y 17,5 km y 60 m entre 10 y 24,25 km según rumbo, con camino más corto al NW (30 m a 5,4 km).

El resultado SHALL poder ser mixto. El sistema NO SHALL ocultar los criterios que el emplazamiento incumple.

#### Scenario: Resultado mixto en Isla Fuerte

- **WHEN** se puntúa Isla Fuerte
- **THEN** el criterio de contenido energético aparece como incumplido, con 8,9 frente a 15 kW/m
- **AND** el criterio de proximidad a costa y usuario final aparece como cumplido

#### Scenario: Criterio sin dato

- **WHEN** un criterio no tiene dato verificado para el emplazamiento activo
- **THEN** aparece como pendiente, no como cumplido ni como incumplido

### Requirement: Restricción de área marina protegida

El sistema SHALL comprobar si el emplazamiento está dentro de un área marina protegida y SHALL tratarlo como criterio eliminatorio, presentado antes que cualquier cifra de recurso.

#### Scenario: Emplazamiento utilizable

- **WHEN** el emplazamiento activo es Isla Fuerte
- **THEN** el panel indica que no lo toca ninguna área protegida

#### Scenario: Emplazamiento descartado

- **WHEN** el emplazamiento activo es Islas del Rosario o Bahía Málaga
- **THEN** el panel lo marca como descartado
- **AND** nombra el área protegida y su categoría

#### Scenario: Cálculo sobre un emplazamiento descartado

- **WHEN** se ejecuta el cálculo con un emplazamiento descartado
- **THEN** el cálculo se completa
- **AND** el resultado queda rotulado como ejercicio teórico, no como propuesta viable

### Requirement: Honestidad sobre el recurso dominante

El sistema SHALL informar de que el principal recurso oceánico del Caribe colombiano no es el oleaje sino el gradiente salino, y de que cerca de San Andrés el gradiente térmico puede ser mejor opción que las olas.

#### Scenario: Contexto de recurso alternativo

- **WHEN** se consulta el contexto de un emplazamiento del Caribe
- **THEN** aparece la mención al gradiente salino con su magnitud estimada y su fuente

### Requirement: Fuente cuestionable marcada como ejercicio

Cuando una fuente de datos presente inconsistencias internas conocidas, el sistema SHALL cargarla rotulada como ejercicio de crítica metodológica y NO SHALL usar sus valores como valores de diseño.

#### Scenario: Serie con inconsistencia documentada

- **WHEN** se selecciona la serie del Caribe colombiano cuyas alturas diarias y mensuales difieren entre tres y cuatro veces
- **THEN** el sistema la presenta como ejercicio de crítica
- **AND** explica en qué consiste la inconsistencia
