## MODIFIED Requirements

### Requirement: Regeneración reproducible de cada serie

Cada archivo de datos incorporado SHALL tener un procedimiento que lo regenere, ejecutable de forma independiente del simulador, que declare la fuente, el recorte espacial y temporal solicitado y los parámetros empleados.

Cada serie incorporada SHALL acompañarse de un resumen legible con su origen, su periodo cubierto, su resolución y su número de registros. El procedimiento de regeneración SHALL estar ejecutado al menos una vez, contra su fuente real, con sus credenciales en `~/.config/` o el equivalente declarado en `documentacion/cuentas_ingesta.md`. Lo que se declara regenerable sin haberlo regenerado deja el requisito sin efecto: un script que nunca corrió contra la API real puede fallar por motivos que solo se descubren al ejecutarlo, y esa información se pierde.

#### Scenario: Regeneración de una serie con credenciales reales

- **WHEN** se ejecuta el procedimiento de regeneración de una serie con las credenciales configuradas
- **THEN** se obtiene un archivo equivalente al versionado
- **AND** el procedimiento declara fuente, recorte y parámetros
- **AND** la salida queda registrada en `datos/manifiesto.json` con su hash SHA-256

#### Scenario: Resumen presente junto a la serie

- **WHEN** se consulta cualquier serie incorporada
- **THEN** existe su resumen con origen, periodo, resolución y número de registros

### Requirement: Los productos ráster se congelan como mosaicos con pirámide

Las capas de imagen procedentes de plataformas de observación terrestre SHALL incorporarse como conjuntos de mosaicos georreferenciados con sus niveles de resolución, y no como una imagen única a la resolución nativa de la fuente. Cada capa SHALL declarar su recuadro geográfico, su fecha o rango de composición, su resolución nativa, sus niveles y su nivel máximo de acercamiento.

La razón no es de tamaño sino de naturaleza del producto: una composición satelital a resolución nativa sobre el recuadro del Caribe colombiano produce un archivo que ningún motor de mapas sirve sin pirámide, y exportarlo plano solo garantiza que el problema aparezca en la fase de interfaz.

El simulador NO SHALL calcular ni componer estos productos en ejecución: SHALL limitarse a mostrarlos.

#### Scenario: Ráster con metadatos completos

- **WHEN** se consulta una capa de imagen del mapa
- **THEN** aparecen su recuadro geográfico, su fecha o rango de composición, su resolución nativa y sus niveles de pirámide
- **AND** el nivel máximo declarado corresponde a la resolución ingerida

#### Scenario: Mapa sin cómputo remoto

- **WHEN** se abre el mapa sin conexión
- **THEN** todas las capas de imagen se muestran desde archivos locales

#### Scenario: La ingesta entrega el producto que el mapa consume

- **WHEN** se ejecuta el procedimiento de ingesta de una capa de imagen
- **THEN** produce los mosaicos y su descripción en el formato que el mapa lee
- **AND** documenta el paso de piramidación como parte del procedimiento de regeneración
- **AND** la ejecución del procedimiento queda registrada en `datos/<capa>/metadata.json` con su fecha y su hash
