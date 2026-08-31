## Purpose

Cierra el requisito declarado en el spec de mapa-potencial de la migración: cada capa ráster del mapa se incorpora como pirámide de teselas con sus niveles de resolución declarados y un archivo de metadatos, y el simulador las sirve sin componerlas en ejecución.

## ADDED Requirements

### Requirement: Cada capa ráster sale como pirámide de teselas

Toda capa de imagen del mapa SHALL existir en `datos/<capa>/<z>/<x>/<y>.<ext>` con sus niveles de zoom declarados y un archivo `metadata.json` adyacente que contenga: recuadro geográfico, fecha o rango de composición, resolución nativa, niveles de pirámide, fuente y licencia.

El nivel máximo de zoom SHALL corresponder a la resolución nativa ingerida: una capa de Sentinel-2 a 10 m declara `maxzoom: 14`, una capa de relieve a 30 m declara `maxzoom: 12`, una capa de luces nocturnas a 500 m declara `maxzoom: 8`.

#### Scenario: metadata.json de cada capa

- **WHEN** se consulta la metadata de una capa ráster del mapa
- **THEN** el archivo existe, es JSON válido y contiene los siete campos declarados
- **AND** los valores son coherentes con el producto fuente

#### Scenario: Pirámide de teselas en disco

- **WHEN** se recorre el árbol de archivos de una capa
- **THEN** existen directorios `0/` a `N/` donde N es el nivel máximo declarado
- **AND** cada nivel contiene teselas `x/y.<ext>` siguiendo el esquema XYZ

#### Scenario: El mapa sirve las teselas locales

- **WHEN** se abre la aplicación sin conexión y se acerca la vista sobre un área con teselas
- **THEN** el mapa carga las teselas desde `datos/`
- **AND** no se registra ninguna petición a un dominio externo

### Requirement: Procedimiento de piramidación declarable y reproducible

El procedimiento que produce la pirámide SHALL estar versionado en el repositorio como un script ejecutable que tome la imagen georreferenciada de origen y produzca el árbol de teselas, el `metadata.json` y el `.pgw` o equivalente de georreferenciación. La ejecución del script SHALL ser determinista: dos corridas sobre el mismo origen producen el mismo árbol y el mismo hash.

#### Scenario: Procedimiento ejecutable

- **WHEN** se invoca el script de piramidación de una capa con su imagen de origen
- **THEN** produce el árbol `datos/<capa>/<z>/<x>/<y>.<ext>` y su `metadata.json`
- **AND** el script termina con código 0

#### Scenario: Reproducibilidad por hash

- **WHEN** se ejecuta el script dos veces sobre el mismo origen
- **THEN** los archivos producidos son idénticos bit a bit
- **AND** sus hashes SHA-256 coinciden con los del manifiesto
