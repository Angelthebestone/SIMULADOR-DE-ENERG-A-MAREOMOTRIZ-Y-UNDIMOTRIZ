## MODIFIED Requirements

### Requirement: Discrepancia de recurso presentada, no resuelta en silencio

Cuando un emplazamiento tenga valores de densidad de potencia que difieran entre sí más allá de la incertidumbre declarada de sus fuentes, el sistema SHALL presentar la discrepancia de forma explícita, con todos los valores disponibles, sus fuentes, sus resoluciones y la magnitud de la diferencia.

El sistema SHALL ofrecer las explicaciones candidatas de la discrepancia que estén documentadas —entre ellas la resolución de la rejilla y la distancia de la celda al emplazamiento— sin afirmar como cerrada ninguna que no lo esté.

Para Isla Fuerte, el sistema SHALL incorporar al menos un tercer valor de densidad de potencia independiente de los dos existentes (revisado por pares y ERA5-Ocean 0,5°), de modo que la discrepancia pase de tener dos a tener tres números visibles. El tercer valor SHALL derivar de Copernicus Marine `GLOBAL_ANALYSISFORECAST_WAV_001_027` a 1/12° sobre la celda que cubre el sitio, con su resolución y su distancia de celda declaradas, y SHALL registrarse con estado `inferido`. El valor de diseño revisado por pares (8,9 kW/m) NO SHALL desplazarse: la incorporación de un valor nuevo no es una sustitución.

#### Scenario: Discrepancia de Isla Fuerte visible con tres valores

- **WHEN** se consulta la densidad de potencia de Isla Fuerte
- **THEN** aparecen al menos tres valores con sus fuentes, sus resoluciones y la magnitud de la diferencia entre cada par
- **AND** el valor revisado por pares sigue declarado como valor de diseño

#### Scenario: Explicación candidata sin cerrar

- **WHEN** se consulta el motivo de la discrepancia
- **THEN** aparecen las explicaciones candidatas documentadas
- **AND** ninguna se presenta como confirmada si no lo está

#### Scenario: Una fuente nueva no cierra la discrepancia por sí sola

- **WHEN** se incorpora un tercer valor de mayor resolución para el mismo emplazamiento
- **THEN** los tres valores quedan visibles con sus resoluciones
- **AND** la discrepancia se declara resuelta únicamente si existe justificación documentada

### Requirement: Emplazamiento por defecto

El sistema SHALL arrancar con Isla Fuerte, Bolívar, como emplazamiento activo, con 8,9 kW/m de densidad media y 78 MWh/m al año, y SHALL mostrar la referencia de esa cifra junto al valor.

Cuando existan valores de densidad de potencia procedentes de otras fuentes para el mismo emplazamiento, el valor de diseño SHALL seguir siendo el revisado por pares, y los demás SHALL presentarse como contraste con su resolución y su distancia al emplazamiento. Tras incorporar un valor Copernicus 1/12°, Isla Fuerte SHALL declarar al menos tres valores de densidad de potencia, todos visibles al consultar el sitio.

#### Scenario: Sitio activo al abrir

- **WHEN** se abre la aplicación
- **THEN** el emplazamiento activo es Isla Fuerte
- **AND** su densidad de potencia y su fuente son visibles

#### Scenario: El valor de diseño no cambia al añadir fuentes

- **WHEN** se incorporan valores de densidad de potencia de fuentes adicionales para Isla Fuerte
- **THEN** el valor de diseño sigue siendo el de la publicación revisada por pares
- **AND** los valores adicionales aparecen como contraste
