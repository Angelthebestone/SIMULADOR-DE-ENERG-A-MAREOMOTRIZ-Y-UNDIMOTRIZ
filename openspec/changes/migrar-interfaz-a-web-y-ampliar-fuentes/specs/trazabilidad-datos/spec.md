## MODIFIED Requirements

### Requirement: Origen local de los datos

El sistema SHALL leer todos sus datos de archivos locales incluidos en la distribución y NO SHALL realizar peticiones de red durante su ejecución.

Esta prohibición SHALL alcanzar también a los recursos que la interfaz necesite para representarse: tipografías, hojas de estilo, código de presentación, iconos, imágenes y cartografía. Ningún recurso SHALL solicitarse a una dirección remota en ejecución.

#### Scenario: Ejecución sin conexión

- **WHEN** la aplicación se ejecuta en un equipo sin conexión a internet
- **THEN** todas las funciones operan con normalidad

#### Scenario: Ninguna petición saliente en una sesión completa

- **WHEN** se observa el tráfico de red durante una sesión que recorre los cuatro niveles, el mapa y una exportación
- **THEN** no se registra ninguna petición saliente

#### Scenario: Regeneración documentada

- **WHEN** se quiere actualizar una serie de datos
- **THEN** existe un procedimiento documentado y reproducible para volver a descargarla
- **AND** ese procedimiento es independiente de la ejecución de la aplicación

### Requirement: Atribuciones y licencias de fuentes externas

Cada serie local SHALL declarar su procedencia y su nivel de aprobación en el propio archivo y en la interfaz: IDEAM preliminar 900 (sin dato definitivo 1200), ERA5-Ocean vía Open-Meteo (rejilla 0,5°, ~23 km de desplazamiento), GMRT (Lamont-Doherty), RUNAP (PNN, 37 áreas marinas, 305.335 km²), Superservicios ZNI/SIN (`3ebi-d83g`, `5cvc-m38t`, `td8k-vhq9`) y XM/API_XM (EquipoAnaliticaXM, pydataxm, MIT, sin clave, https://github.com/EquipoAnaliticaXM/API_XM, métricas Precio de Bolsa, precios de contratos y Factor de Emisión CO2eq/kWh).

Las fuentes incorporadas por ingesta externa SHALL declararse con el mismo detalle, incluyendo su resolución y el periodo o composición empleados: servicio marino de Copernicus para oleaje y para corrientes, plataforma de observación terrestre para imagen satelital, relieve y luces nocturnas, batimetría global de referencia, atlas global de constituyentes de marea, y cartografía base con su licencia de uso.

Cada fuente que exija cuenta o registro SHALL declararlo, junto con la advertencia de que esa cuenta se necesita únicamente para regenerar la serie y nunca para ejecutar el simulador.

La pantalla de limitaciones SHALL incluir todas estas atribuciones.

#### Scenario: Atribución visible

- **WHEN** se consulta la procedencia de un dato de oleaje o de rango mareal
- **THEN** aparece la fuente, su resolución o aprobación y el periodo cubierto

#### Scenario: Atribución de una capa de contexto

- **WHEN** se consulta la procedencia de la imagen satelital o de la cartografía base del mapa
- **THEN** aparecen su fuente, su licencia y su fecha o rango de composición

#### Scenario: Requisito de cuenta declarado

- **WHEN** se consulta la procedencia de una serie obtenida de un servicio que exige registro
- **THEN** se declara que la cuenta solo hace falta para regenerarla
- **AND** se indica que la ejecución del simulador no la requiere

## ADDED Requirements

### Requirement: Contraste entre valores de la misma magnitud

Cuando el sistema disponga de más de un valor para la misma magnitud de un mismo emplazamiento, SHALL mostrarlos juntos con su fuente, su estado y su resolución, y SHALL declarar cuál emplea como valor de diseño y por qué.

El sistema NO SHALL resolver la discrepancia promediando, ni ocultar el valor que no emplea, ni presentar la coincidencia entre fuentes como si existiera cuando no existe.

#### Scenario: Dos valores presentados juntos

- **WHEN** un emplazamiento tiene densidad de potencia procedente de una publicación revisada por pares y de un reanálisis
- **THEN** ambos valores aparecen con su fuente, su estado y su resolución
- **AND** el sistema declara cuál es el valor de diseño y el motivo

#### Scenario: La discrepancia no se promedia

- **WHEN** dos fuentes difieren en un factor apreciable sobre la misma magnitud
- **THEN** el sistema no muestra un valor intermedio
- **AND** la diferencia queda visible con su magnitud

### Requirement: Cada cifra de la tesis tiene un único origen de datos

Toda cifra que el proyecto use como afirmación propia SHALL tener un único origen declarado, del que las demás apariciones se deriven. Escribir el mismo número en varios módulos no es redundancia inofensiva: es la garantía de que puedan divergir sin que nada lo avise.

Una cifra que un requisito del proyecto exija mostrar SHALL tener un consumidor real. Un valor presente solo en un archivo y nunca leído por la aplicación no cumple el requisito que lo pide, aunque la prueba del archivo siga en verde.

#### Scenario: Una sola fuente para cada cifra

- **WHEN** se localiza una cifra de la tesis en el código
- **THEN** existe un único origen del que la toman el resto de módulos
- **AND** una prueba automatizada falla si el mismo valor aparece escrito como literal en más de un módulo sin derivar del origen

#### Scenario: La cifra exigida llega a pantalla

- **WHEN** un requisito exige mostrar una cifra del emplazamiento por defecto
- **THEN** existe un camino verificado desde el archivo de datos hasta la pantalla
- **AND** una prueba de interfaz comprueba que la cifra aparece, no solo que está en el archivo

#### Scenario: Las cifras de referencia siguen disponibles como contraste

- **WHEN** el origen único de una cifra cambia
- **THEN** las tablas de referencia y los contrastes que la citaban se actualizan desde el mismo origen
- **AND** ninguna comparación conserva una copia antigua del valor
