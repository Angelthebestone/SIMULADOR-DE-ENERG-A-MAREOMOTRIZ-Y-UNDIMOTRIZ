## MODIFIED Requirements

### Requirement: Mapa de potencial de Colombia

El sistema SHALL mostrar un mapa de Colombia con capas superpuestas conmutables y leyenda, organizadas en dos grupos.

Capas de decisión, obligatorias: (a) potencial de recurso (undimotriz en kW/m y mareal en rango/velocidad con fuente), (b) áreas marinas protegidas como zonas prohibidas (RUNAP, 37 áreas marinas, 305.335 km², con nombre y categoría), y (c) batimetría de referencia para la banda 30–60 m, con atribución.

Capas de contexto: (d) imagen satelital de la costa y las islas, (e) relieve del terreno emergido, y (f) luces nocturnas, que SHALL poder activarse para contrastar visualmente la zona no interconectada con el territorio servido por la red interconectada.

La capa de potencial SHALL distinguir dato verificado, inferido y pendiente con el mismo semáforo de trazabilidad. La capa de áreas protegidas SHALL ser criterio eliminatorio visible antes que cualquier cifra de recurso. Las capas de contexto NO SHALL portar cifras de decisión: son apoyo visual y SHALL declararse como tales en la leyenda.

#### Scenario: Isla Fuerte visible como caso utilizable

- **WHEN** se abre el mapa
- **THEN** Isla Fuerte aparece marcada como utilizable (8,9 kW/m verificado, sin área protegida, 30 m a 5,4 km al NW según GMRT)
- **AND** cada valor muestra su fuente al seleccionarlo

#### Scenario: Zona prohibida bloquea la propuesta

- **WHEN** se selecciona Bahía Málaga o Islas del Rosario en el mapa
- **THEN** el área aparece sombreada como prohibida con su nombre (PNN Uramba / PNN Corales del Rosario) y categoría
- **AND** el resultado del cálculo queda rotulado como ejercicio teórico

#### Scenario: Capas conmutables y offline

- **WHEN** se conmutan las capas del mapa
- **THEN** cada capa se activa/desactiva sin recalcular y sin requerir conexión a internet
- **AND** las fuentes de cada capa aparecen en la leyenda

#### Scenario: Contraste de la zona no interconectada

- **WHEN** se activa la capa de luces nocturnas con el mapa encuadrado sobre el Caribe colombiano
- **THEN** Isla Fuerte aparece sin iluminación apreciable frente al continente iluminado
- **AND** la leyenda declara la capa como apoyo visual, sin cifra de decisión asociada

#### Scenario: Batimetría legible como relieve

- **WHEN** se observa la capa de batimetría alrededor del emplazamiento activo
- **THEN** la variación de profundidad es distinguible visualmente
- **AND** la banda de 30 a 60 m es identificable

### Requirement: Las capas de contexto no reducen la legibilidad de las de decisión

Al activarse una capa de contexto sobre la que se apoyan las capas de decisión, el sistema SHALL conservar distinguibles las áreas protegidas, los emplazamientos y su semáforo. La distinguibilidad NO SHALL depender solo del color: cada categoría de decisión SHALL llevar además un canal de forma, trama o etiqueta.

Este requisito existe porque el mapa pasa de un océano de color liso a satélite y batimetría sombreada, que es justo el cambio que puede dejar de leerse: un naranja de dato pendiente sobre un sombreado costero no es un naranja.

#### Scenario: Estado distinguible con la imagen satelital encendida

- **WHEN** están activas la imagen satelital y la capa de recurso
- **THEN** verificado, inferido y pendiente se distinguen por forma o trama además de por color
- **AND** la prueba se hace sobre la capa de contexto activada, no sobre el fondo liso

#### Scenario: Zona prohibible sobre relieve sombreado

- **WHEN** están activas el relieve sombreado y las áreas marinas protegidas
- **THEN** el límite del área protegida permanece identificable con la batimetría visible debajo
- **AND** el criterio eliminatorio sigue siendo lo primero que se lee

### Requirement: Datos del mapa versionados y locales

El mapa SHALL leer todas sus capas de archivos locales incluidos en la distribución y versionados, sin peticiones de red en ejecución. Esto comprende los polígonos de áreas protegidas, la batimetría, los resúmenes de recurso, las imágenes georreferenciadas de las capas de contexto y la cartografía base con sus tipografías y símbolos.

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

## ADDED Requirements

### Requirement: Navegación continua del mapa

El mapa SHALL admitir desplazamiento y acercamiento continuos dentro de un rango declarado, sin recalcular la simulación y sin pérdida de nitidez en la cartografía base y en los rótulos.

Seleccionar un emplazamiento SHALL llevar la vista hasta él de forma que el usuario conserve la referencia espacial de dónde estaba y dónde llegó.

El rango admitido SHALL declararse por capa y NO uno solo para el conjunto: la cartografía vectorial mantiene nitidez a cualquier nivel y los rásteres no. Un rango único aplicado a las dos familias obliga a elegir entre prometer lo que el ráster no puede dar o recortar lo que el vectorial sí da.

#### Scenario: Acercamiento sin pérdida de nitidez

- **WHEN** se acerca la vista desde el encuadre nacional hasta el entorno de un emplazamiento
- **THEN** la cartografía base y sus rótulos se mantienen nítidos en todo el recorrido
- **AND** no se dispara ningún recálculo de la simulación

#### Scenario: Desplazamiento hasta el emplazamiento seleccionado

- **WHEN** se selecciona un emplazamiento desde fuera del encuadre actual
- **THEN** la vista se desplaza hasta él conservando la continuidad espacial

#### Scenario: Límites de navegación declarados

- **WHEN** se intenta salir del rango de zoom admitido
- **THEN** la vista se detiene en el límite
- **AND** el sistema no muestra área sin dato como si tuviera dato

#### Scenario: El acercamiento máximo de un ráster es el de su resolución

- **WHEN** se acerca la vista más allá del nivel en que una capa ráster conserva detalle
- **THEN** el sistema lo declara como límite de esa capa en lugar de mostrar la imagen pixelada como si fuera información
- **AND** el nivel declarado corresponde a la resolución realmente ingerida, no a un nivel arbitrario

### Requirement: Las capas ráster se ingieren en pirámide de resolución

Toda capa de imagen del mapa SHALL incorporarse como conjunto de mosaicos o pirámide con niveles de resolución declarados, y no como una imagen georreferenciada única a la resolución nativa de la fuente.

El requisito es de viabilidad y no de tamaño: una composición satelital a resolución nativa sobre el recuadro del Caribe colombiano exige un producto que no cabe en una distribución ni se sirve sin pirámide. Cada capa SHALL declarar su resolución nativa, el nivel máximo de acercamiento que soporta y el procedimiento de teselado que lo produce.

#### Scenario: Cada capa declara su profundidad de pirámide

- **WHEN** se consulta el origen de una capa de contexto
- **THEN** aparecen su resolución nativa, sus niveles de pirámide y su nivel máximo de acercamiento
- **AND** la suma de sus mosaicos es coherente con el recuadro geográfico declarado

#### Scenario: La ingesta produce mosaicos y no solo una imagen

- **WHEN** se ejecuta el procedimiento de ingesta de una capa de contexto
- **THEN** produce el conjunto de mosaicos que el mapa consume, junto con su archivo de descripción
- **AND** el paso de teselado está documentado como parte del procedimiento de regeneración

### Requirement: Consulta de valores sobre el mapa, con equivalente fuera del lienzo

Situar el puntero sobre un elemento con dato del mapa SHALL mostrar su valor, su unidad, su fuente y su estado, sin necesidad de abrir otro panel.

Un elemento sin dato SHALL indicarlo explícitamente en lugar de no mostrar nada.

Puesto que el mapa se representa en un lienzo, sus elementos no son alcanzables por el teclado ni por lectura de pantalla de forma natural. El sistema SHALL ofrecer un control equivalente, con semántica nativa, que permita recorrer los emplazamientos y obtener de cada uno el mismo valor, unidad, fuente y estado que muestra el mapa. La consulta por puntero es un añadido sobre ese equivalente, nunca su sustituto.

#### Scenario: Consulta de un emplazamiento con dato

- **WHEN** se sitúa el puntero sobre un emplazamiento con densidad de potencia conocida
- **THEN** aparecen su valor, su unidad, su fuente y su estado

#### Scenario: Elemento sin dato

- **WHEN** se sitúa el puntero sobre un emplazamiento sin dato de corriente
- **THEN** el sistema indica que ese dato está pendiente
- **AND** no muestra un valor en su lugar

#### Scenario: Recorrido por teclado

- **WHEN** una persona recorre los emplazamientos con teclado
- **THEN** cada uno anuncia su nombre, su valor, su unidad, su fuente y su estado
- **AND** seleccionarlo desde ese recorrido fija el emplazamiento activo igual que un clic sobre el mapa

#### Scenario: Consulta sin puntero

- **WHEN** se usa la interfaz con un dispositivo de puntero grueso, donde no existe el paso del puntero por encima
- **THEN** el valor de un elemento sigue siendo consultable
- **AND** la forma de consultarlo está declarada en la leyenda o en el propio elemento

### Requirement: Pulsar y arrastrar significan cosas distintas en el mapa

Un mapa navegable de forma continua deja de poder interpretar cualquier pulsación como selección. El sistema SHALL distinguir la pulsación que selecciona un emplazamiento del gesto que desplaza la vista, y SHALL comunicar que el mapa es un elemento interactivo en lugar de una ilustración.

#### Scenario: Arrastrar no selecciona

- **WHEN** el usuario pulsa sobre un área vacía y arrastra para desplazar la vista
- **THEN** el emplazamiento activo no cambia
- **AND** la vista sigue el gesto sin saltos

#### Scenario: Seleccionar un emplazamiento

- **WHEN** el usuario pulsa sobre un emplazamiento sin arrastrar
- **THEN** ese emplazamiento pasa a ser el activo
- **AND** la interfaz informa del cambio en el resto de niveles

#### Scenario: El mapa anuncia que se puede usar

- **WHEN** el puntero entra en el área del mapa
- **THEN** el cursor y algún indicador declaran que el elemento admite navegación y selección
- **AND** un usuario que lo ve por primera vez no necesita que se lo expliquen
