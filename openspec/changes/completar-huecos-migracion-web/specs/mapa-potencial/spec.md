## MODIFIED Requirements

### Requirement: Datos del mapa versionados y locales

El mapa SHALL leer todas sus capas de archivos locales incluidos en la distribución y versionados, sin peticiones de red en ejecución. Esto comprende los polígonos de áreas protegidas, la batimetría, los resúmenes de recurso, las imágenes georreferenciadas de las capas de contexto y la cartografía base con sus tipografías y símbolos.

Cada capa ráster SHALL servirse desde su pirámide de teselas con sus niveles declarados en `metadata.json`, no desde una imagen georreferenciada única. La pirámide SHALL estar materializada en el repositorio o en el canal de distribución declarado para los archivos voluminosos.

Cada capa SHALL declarar su fuente y, cuando proceda de una rejilla o de una composición temporal, su resolución y su fecha o rango.

#### Scenario: Mapa offline

- **WHEN** se abre el mapa sin conexión
- **THEN** todas las capas se renderizan con normalidad

#### Scenario: Cartografía base incorporada

- **WHEN** se recorre el mapa con zoom y desplazamiento sin conexión
- **THEN** la cartografía base, sus topónimos y sus símbolos se muestran en todos los niveles de zoom admitidos

#### Scenario: Procedencia por capa

- **WHEN** se consulta la leyenda de una capa de contexto
- **THEN** aparecen su fuente, su resolución y su fecha o rango de composición
