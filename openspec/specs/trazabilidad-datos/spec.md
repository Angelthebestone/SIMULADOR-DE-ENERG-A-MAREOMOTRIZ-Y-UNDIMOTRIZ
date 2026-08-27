## Purpose

Garantiza que ninguna cifra del simulador aparezca sin fuente rastreable y que la aplicación funcione sin conexión, que son las dos condiciones que sostienen la credibilidad del proyecto en la sustentación.

## Requirements

### Requirement: Ninguna cifra sin fuente

Toda constante, coeficiente y dato de emplazamiento que el sistema muestre SHALL llevar asociada su fuente, consultable desde la propia interfaz. Un dato sin fuente verificada NO SHALL entrar al cálculo: SHALL quedar registrado como pendiente.

#### Scenario: Consulta de la procedencia

- **WHEN** el usuario solicita la procedencia de una constante mostrada en el nivel Calcular o Diseñar
- **THEN** aparece su fuente

#### Scenario: Dato pendiente no entra

- **WHEN** un dato figura como pendiente de verificación
- **THEN** no se usa en ningún cálculo
- **AND** el hueco correspondiente aparece rotulado como pendiente

### Requirement: Nivel de aprobación de los datos medidos

Cuando un dato provenga de una serie instrumental, el sistema SHALL mostrar su nivel de aprobación declarado por la entidad que la publica.

#### Scenario: Serie preliminar

- **WHEN** se muestra el rango mareal obtenido de mareógrafos etiquetados como preliminares
- **THEN** el carácter preliminar del dato aparece junto a la cifra

### Requirement: Origen local de los datos

El sistema SHALL leer todos sus datos de archivos locales incluidos en la distribución y NO SHALL realizar peticiones de red durante su ejecución.

#### Scenario: Ejecución sin conexión

- **WHEN** la aplicación se ejecuta en un equipo sin conexión a internet
- **THEN** todas las funciones operan con normalidad

#### Scenario: Regeneración documentada

- **WHEN** se quiere actualizar una serie de datos
- **THEN** existe un procedimiento documentado y reproducible para volver a descargarla
- **AND** ese procedimiento es independiente de la ejecución de la aplicación

### Requirement: Limitaciones declaradas en pantalla

El sistema SHALL declarar de forma visible sus limitaciones de modelado: oleaje omnidireccional sin espectros direccionales, coeficientes hidrodinámicos tomados de literatura sin cálculo BEM, y ausencia de cálculo de amarres, fatiga y supervivencia estructural.

#### Scenario: Declaración accesible

- **WHEN** el usuario consulta las limitaciones del modelo
- **THEN** aparecen las tres limitaciones enunciadas

### Requirement: Validación de entradas que acota y explica

Ante una entrada fuera del rango operativo, el sistema SHALL acotarla al límite y explicar por qué. NO SHALL cerrarse ni rechazar la entrada sin explicación.

#### Scenario: Entrada fuera de rango

- **WHEN** se introduce una altura significativa de 12 m, por encima del rango operativo
- **THEN** el valor se acota al límite superior
- **AND** se muestra el motivo y el rango admitido
- **AND** la aplicación sigue funcionando

### Requirement: Esquema de dato trazable

Todo valor numérico de emplazamiento o de dispositivo SHALL almacenarse como objeto con cuatro campos obligatorios: `valor` (número), `unidad` (cadena SI), `fuente` (cita trazable) y `estado` (uno de `verificado`, `inferido`, `pendiente`). Un dato con `estado = pendiente` SHALL cargarse pero SHALL bloquear su uso en cualquier cálculo.

El sistema SHALL rechazar la carga de un archivo JSON de `datos/sitios/` o `datos/dispositivos/` que omita alguno de esos campos. Los once estados de `datos/catalogo/` (ocho EMEC undimotrices + siete de corriente mareal) SHALL incluir además `simulable: false` y su rango de eficiencia.

#### Scenario: Dato pendiente bloquea el cálculo

- **WHEN** un archivo de sitio trae un campo con `estado = pendiente`
- **THEN** el dato se muestra rotulado como pendiente
- **AND** cualquier cadena que lo requiera se niega a ejecutarse y explica el bloqueo

#### Scenario: JSON sin fuente es inválido

- **WHEN** se intenta cargar un JSON de sitio sin campo `fuente`
- **THEN** la carga falla con error de esquema

### Requirement: Atribuciones y licencias de fuentes externas

Cada serie local SHALL declarar su procedencia y su nivel de aprobación en el propio archivo y en la interfaz: IDEAM preliminar 900 (sin dato definitivo 1200), ERA5-Ocean vía Open-Meteo (rejilla 0,5°, ~23 km de desplazamiento), GMRT (Lamont-Doherty), RUNAP (PNN, 37 áreas marinas, 305.335 km²), Superservicios ZNI/SIN (`3ebi-d83g`, `5cvc-m38t`, `td8k-vhq9`) y XM/API_XM (EquipoAnaliticaXM, pydataxm, MIT, sin clave, https://github.com/EquipoAnaliticaXM/API_XM, métricas Precio de Bolsa, precios de contratos y Factor de Emisión CO2eq/kWh). La pantalla de limitaciones SHALL incluir estas atribuciones.

#### Scenario: Atribución visible

- **WHEN** se consulta la procedencia de un dato de oleaje o de rango mareal
- **THEN** aparece la fuente, su resolución o aprobación y el periodo cubierto

### Requirement: Semáforo de confianza por resultado

Cada cifra mostrada SHALL acompañarse de un indicador visual de confianza derivado de su `estado`: verde para `verificado`, amarillo para `inferido`, rojo para `pendiente`. El semáforo SHALL ser visible en todos los niveles, incluido Ver, sin requerir abrir Calcular.

#### Scenario: Semáforo coherente con el estado

- **WHEN** se muestra un resultado calculado con un dato `inferido`
- **THEN** el indicador aparece en amarillo junto a la cifra

### Requirement: Reproducibilidad del escenario

Cada exportación (CSV, figura, JSON de escenario) SHALL incluir el hash del escenario, la versión del conjunto de datos (`datos/` ) y la fecha de cálculo. Un escenario guardado y recargado SHALL reproducir los mismos resultados bit a bit.

#### Scenario: Trazabilidad de una exportación

- **WHEN** se exporta un resultado a CSV
- **THEN** el archivo incluye hash, versión de datos y fecha

### Requirement: Exportación de resultados

El sistema SHALL permitir exportar los resultados numéricos y las figuras, y guardar escenarios en un formato legible por una persona.

#### Scenario: Exportación de un escenario

- **WHEN** se guarda un escenario y se vuelve a cargar
- **THEN** se reproducen los mismos resultados
- **AND** el archivo guardado es legible y editable con un editor de texto

### Requirement: Formato numérico y unidades en español

Toda cifra mostrada al usuario SHALL emplear el formato numérico español: coma como separador decimal y punto como separador de miles. Toda magnitud mostrada SHALL ir acompañada de su unidad.

El formato de presentación SHALL aplicarse solo en la capa de presentación. El núcleo y los archivos de datos SHALL operar y almacenar en punto decimal y en unidades del Sistema Internacional, de modo que el formateo no afecte a ningún cálculo.

#### Scenario: Presentación en formato español

- **WHEN** se muestra una densidad de potencia de 8,9 kW/m y una producción de 1.435 GWh al año
- **THEN** el decimal aparece con coma y el millar con punto
- **AND** ambas cifras muestran su unidad

#### Scenario: El formato no entra al cálculo

- **WHEN** se compara el valor almacenado de una magnitud con el que se muestra en pantalla
- **THEN** el almacenado está en unidades del Sistema Internacional y con punto decimal
- **AND** el cambio de formato de presentación no altera ningún resultado
