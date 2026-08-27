## Purpose

Permite ver de un vistazo dónde hay recurso, dónde no se puede construir y dónde el fondo permite anclar, para que la elección de emplazamiento sea territorial y no solo numérica.

## ADDED Requirements

### Requirement: Mapa de potencial de Colombia

El sistema SHALL mostrar un mapa de Colombia con tres capas superpuestas y leyenda: (a) potencial de recurso (undimotriz en kW/m y mareal en rango/velocidad con fuente), (b) áreas marinas protegidas como zonas prohibidas (RUNAP, 37 áreas marinas, 305.335 km², con nombre y categoría), y (c) batimetría de referencia para la banda 30–60 m (GMRT, con atribución).

La capa de potencial SHALL distinguir dato verificado, inferido y pendiente con el mismo semáforo de trazabilidad. La capa de áreas protegidas SHALL ser criterio eliminatorio visible antes que cualquier cifra de recurso.

#### Scenario: Isla Fuerte visible como caso utilizable

- **WHEN** se abre el mapa
- **THEN** Isla Fuerte aparece marcada como utilizable (8,9 kW/m verificado, sin área protegida, 30 m a 5,4 km al NW según GMRT)
- **AND** cada valor muestra su fuente al seleccionarlo

#### Scenario: Zona prohibida bloquea la propuesta

- **WHEN** se selecciona Bahía Málaga o Islas del Rosario en el mapa
- **THEN** el área aparece sombreada como prohibida con su nombre (PNN Uramba / PNN Corales del Rosario) y categoría
- **AND** el resultado del cálculo queda rotulado como ejercicio teórico

#### Scenario: Capas conmutables y offline

- **WHEN** se conmutan las tres capas en el mapa
- **THEN** cada capa se activa/desactiva sin recalcular y sin requerir conexión a internet
- **AND** las fuentes GMRT/RUNAP/ERA5 aparecen en la leyenda

### Requirement: Selección de emplazamiento desde el mapa

Seleccionar un punto en el mapa SHALL fijar el emplazamiento activo para el resto de la aplicación (panel de puntuación, cadena y economía). Un punto sin dato de recurso SHALL fijar el emplazamiento igualmente pero SHALL dejar el recurso como pendiente.

#### Scenario: Click fija emplazamiento

- **WHEN** se hace click en un punto del mapa con dato de recurso
- **THEN** el emplazamiento activo cambia y su potencial aparece en el panel de puntuación

### Requirement: Datos del mapa versionados y locales

El mapa SHALL leer polígonos RUNAP, transecto GMRT y resúmenes ERA5 de `datos/` locales (GeoJSON/CSV/JSON), versionados, sin peticiones de red en ejecución.

#### Scenario: Mapa offline

- **WHEN** se abre el mapa sin conexión
- **THEN** las tres capas se renderizan con normalidad
