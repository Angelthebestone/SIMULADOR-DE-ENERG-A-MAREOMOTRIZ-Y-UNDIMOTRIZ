## Purpose

Define la frontera entre las fuentes externas que exigen credenciales o conexión y un simulador que debe arrancar sin red, de modo que se puedan incorporar datos de satélite y de reanálisis oceánico sin que el ejecutable dependa jamás de una cuenta ni de internet.

## ADDED Requirements

### Requirement: La ingesta es una fase separada de la ejecución

Toda incorporación de datos de una fuente externa SHALL realizarse por un procedimiento de ingesta ejecutado aparte, cuyo resultado son archivos congelados dentro de la distribución. El simulador SHALL leer únicamente esos archivos.

Cada archivo congelado SHALL quedar identificado de forma verificable dentro de la distribución: con su entrada en un manifiesto que declare origen, hash y tamaño, y versionado en el control de versiones del proyecto salvo que su volumen lo haga inviable, en cuyo caso SHALL declararse la política de distribución alternativa y el procedimiento que verifica que lo instalado coincide con el manifiesto.

Decir «versionado» sin definir qué lo versiona deja el requisito sin efecto: los archivos de `datos/` pueden estar excluidos del historial y ser a la vez legibles por la aplicación, que es el estado en el que esta fase arranca.

Las bibliotecas cliente de las fuentes externas SHALL declararse en un extra de instalación destinado a la ingesta, separado de las dependencias de ejecución. El artefacto distribuido NO SHALL incluirlas.

#### Scenario: Cada archivo congelado está localizado

- **WHEN** se recorre el manifiesto de datos de la distribución
- **THEN** cada archivo tiene declarada su fuente, su hash y su tamaño
- **AND** está versionado, o tiene declarada una política de distribución alternativa con su verificación

#### Scenario: El simulador no conoce a los clientes de ingesta

- **WHEN** se analiza el grafo de imports del simulador
- **THEN** no aparece ninguna biblioteca cliente de fuente externa
- **AND** una prueba automatizada falla si aparece

#### Scenario: Instalación de ejecución sin extras de ingesta

- **WHEN** se instala el proyecto sin el extra de ingesta y se arranca la aplicación
- **THEN** la aplicación arranca y todas sus funciones operan

#### Scenario: La distribución llega completa

- **WHEN** se instala la distribución en un equipo limpio siguiendo el procedimiento documentado
- **THEN** todos los archivos del manifiesto están presentes y su hash coincide
- **AND** una prueba automatizada falla si falta alguno o si alguno difiere

### Requirement: Ninguna credencial cruza a la ejecución

Cuando una fuente externa exija autenticación, la credencial SHALL usarse solo durante la ingesta. NO SHALL almacenarse en el repositorio, NO SHALL incorporarse al artefacto distribuido y NO SHALL requerirse para ejecutar el simulador.

Cada fuente que exija credencial SHALL documentar qué tipo de cuenta hace falta y cómo obtenerla, sin incluir la credencial misma.

#### Scenario: Ejecución sin cuenta de ninguna fuente

- **WHEN** se ejecuta el simulador en un equipo sin credenciales configuradas para ninguna fuente externa
- **THEN** todas las funciones operan con normalidad sobre los datos congelados

#### Scenario: Repositorio sin secretos

- **WHEN** se inspecciona el repositorio y el artefacto distribuido
- **THEN** no aparece ninguna credencial, token ni archivo de configuración de cuenta

#### Scenario: Requisito de cuenta documentado

- **WHEN** se consulta el procedimiento de regeneración de una serie que exige autenticación
- **THEN** aparece qué cuenta hace falta y cómo se obtiene

### Requirement: Regeneración reproducible de cada serie

Cada archivo de datos incorporado SHALL tener un procedimiento que lo regenere, ejecutable de forma independiente del simulador, que declare la fuente, el recorte espacial y temporal solicitado y los parámetros empleados.

Cada serie incorporada SHALL acompañarse de un resumen legible con su origen, su periodo cubierto, su resolución y su número de registros.

#### Scenario: Regeneración de una serie

- **WHEN** se ejecuta el procedimiento de regeneración de una serie con las credenciales adecuadas
- **THEN** se obtiene un archivo equivalente al versionado
- **AND** el procedimiento declara fuente, recorte y parámetros

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

### Requirement: Resolución declarada frente a distancia al emplazamiento

Cuando un valor proceda de una rejilla, el sistema SHALL declarar la resolución de esa rejilla y la distancia entre el centro de la celda empleada y las coordenadas del emplazamiento.

Cuando existan dos valores de la misma magnitud procedentes de rejillas de distinta resolución, el sistema SHALL conservar ambos con su resolución y su distancia, y NO SHALL descartar uno en silencio.

#### Scenario: Distancia de celda visible

- **WHEN** se consulta la procedencia de un valor obtenido de una rejilla
- **THEN** aparecen la resolución de la rejilla y la distancia de la celda al emplazamiento

#### Scenario: Dos rejillas sobre la misma magnitud

- **WHEN** el mismo emplazamiento tiene densidad de potencia procedente de dos rejillas de distinta resolución
- **THEN** ambos valores permanecen consultables con su resolución y su distancia
- **AND** el sistema declara cuál emplea como valor de diseño y por qué

### Requirement: Estado de los datos derivados de reanálisis y satélite

Un valor derivado de reanálisis, de modelo global o de observación satelital SHALL registrarse con estado `inferido`, salvo que exista publicación revisada por pares que lo respalde para ese emplazamiento concreto.

La incorporación de una fuente nueva NO SHALL elevar el estado de un dato existente ni sustituir un valor `verificado` por uno `inferido` como valor de diseño.

#### Scenario: Nueva fuente entra como inferida

- **WHEN** se incorpora un valor de densidad de potencia procedente de un modelo global
- **THEN** su estado es `inferido`
- **AND** el semáforo lo refleja en todos los niveles

#### Scenario: El valor revisado por pares conserva su papel

- **WHEN** un emplazamiento tiene un valor revisado por pares y otro procedente de reanálisis
- **THEN** el valor revisado por pares sigue siendo el valor de diseño
- **AND** el procedente de reanálisis se presenta como contraste
