## MODIFIED Requirements

### Requirement: Lenguaje adaptado a cada nivel

En el nivel Ver el sistema SHALL expresar las salidas en magnitudes cotidianas y limitar los controles a tres, con rótulos en lenguaje corriente. En Comparar SHALL mostrar el diagrama de pérdidas y las fichas de dispositivos reales, todavía sin fórmulas. En Calcular SHALL mostrar cada fórmula con los números ya sustituidos. En Diseñar SHALL exponer resonancia, límites teóricos, producción anual y coste por MWh.

El sistema NO SHALL mostrar en pantalla vocabulario de su propia construcción: nombres de contrato, de bandera de datos, de oráculo, de prueba, de bloque de demostración, de medida tipográfica interna ni de archivo de especificación. Todo texto visible SHALL pertenecer al dominio del simulador o a la operación de la interfaz.

Fuera del nivel Calcular, ningún párrafo visible SHALL ocupar más de dos líneas a la anchura de lectura por defecto. El texto de las demás pantallas SHALL limitarse a cifras con unidad, veredictos de una línea, estados de dato y rótulos de control.

#### Scenario: Salida en magnitudes cotidianas

- **WHEN** el nivel activo es Ver
- **THEN** el resultado principal se expresa en número de viviendas alimentadas
- **AND** no aparece ninguna fórmula en pantalla

#### Scenario: Fórmulas con números sustituidos

- **WHEN** el nivel activo es Calcular
- **THEN** cada resultado se acompaña de su fórmula con los valores numéricos ya reemplazados

#### Scenario: Sin vocabulario de construcción en pantalla

- **WHEN** se recorre cualquiera de los cinco niveles
- **THEN** ninguna cadena visible contiene «contrato», «flag», «oráculo», «66ch», «demo» ni «spec»
- **AND** ningún bloque destinado a ejercitar una prueba aparece como contenido

#### Scenario: Prosa acotada

- **WHEN** se mide el texto visible de un nivel distinto de Calcular
- **THEN** ningún párrafo supera las dos líneas

### Requirement: La tesis del proyecto visible desde el arranque

La pantalla de inicio SHALL mostrar el contraste entre la densidad de potencia del emplazamiento por defecto y el umbral de rentabilidad citado para granjas undimotrices, y ese contraste SHALL permanecer accesible en los cuatro niveles.

El contraste SHALL presentarse como comparación gráfica sobre una escala común, con las dos cifras en texto junto a la representación y la marca del umbral rotulada. El color NO SHALL ser el único portador de la diferencia.

El sistema SHALL acompañarlo de la tabla de densidades de referencia, cada una con su fuente: costa oeste de Europa, umbral de rentabilidad, criterio de buena ubicación del Handbook, Caribe colombiano y mínimo aprovechable citado.

El sistema NO SHALL enunciar la conclusión del proyecto como afirmación cerrada: SHALL presentar las cifras que la sostienen y dejar que el usuario la derive.

#### Scenario: Contraste en la pantalla de inicio

- **WHEN** se abre la aplicación
- **THEN** aparecen los 8,9 kW/m de Isla Fuerte junto a los 40 kW/m del umbral citado
- **AND** ambas cifras muestran su fuente

#### Scenario: El contraste es gráfico y legible sin color

- **WHEN** se observa el contraste en escala de grises
- **THEN** las dos magnitudes siguen siendo distinguibles por longitud y por su cifra en texto

#### Scenario: El contraste sobrevive al cambio de nivel

- **WHEN** se conmuta a cualquiera de los cuatro niveles
- **THEN** el contraste sigue siendo consultable sin volver a la pantalla de inicio

### Requirement: Modo sustentación y accesibilidad

La interfaz SHALL ofrecer un modo sustentación: tipografía escalable para proyector, paleta con contraste suficiente y distinguible para daltónicos (Sankey y mapa), y atajos de teclado (ESC cancela simulación, Ctrl+E exporta). Al arrancar sin conexión SHALL mostrar aviso offline pero operar con normalidad.

Los iconos de la interfaz SHALL ser vectoriales y de una sola familia. Un icono decorativo situado junto a texto visible SHALL quedar fuera del árbol de accesibilidad; un icono que porta significado SHALL disponer de nombre accesible. Los emojis y los glifos sueltos NO SHALL ser el único portador de un significado.

Los estados de carga y los estados vacíos de gráficas, matriz y diagrama SHALL mostrar una estructura visual — esqueleto o indicador — además del texto que los describe.

#### Scenario: Modo sustentación legible

- **WHEN** se activa el modo sustentación
- **THEN** la tipografía aumenta y el contraste cumple el mínimo legible a distancia de proyector

#### Scenario: Arranque offline

- **WHEN** la aplicación arranca sin internet
- **THEN** aparece aviso offline y todas las funciones operan con datos locales

#### Scenario: Icono con significado

- **WHEN** un icono representa un estado de dato sin texto adyacente que lo repita
- **THEN** el icono tiene nombre accesible y un lector de pantalla lo anuncia

#### Scenario: Carga con estructura

- **WHEN** una gráfica o la matriz están calculándose
- **THEN** su espacio muestra un esqueleto del tamaño del resultado
- **AND** el contenido posterior no desplaza el resto de la pantalla

## ADDED Requirements

### Requirement: Indicadores principales visibles desde cualquier nivel

La carcasa SHALL presentar los indicadores del cálculo activo — densidad de recurso, potencia captada, producción anual y factor de planta — como barra de indicadores con etiqueta, valor y unidad diferenciados tipográficamente, visible en los cinco niveles.

Un indicador sin dato SHALL mostrar su estado pendiente y NO SHALL mostrar cifra alguna en su lugar. Durante el cálculo cada indicador SHALL conservar su espacio para que la llegada del valor no desplace la pantalla.

La barra SHALL anunciarse a los lectores de pantalla como región de estado con actualización cortés, igual que la tira de estado que sustituye.

#### Scenario: Los indicadores acompañan al usuario

- **WHEN** se conmuta entre los cinco niveles sin tocar ningún control
- **THEN** los cuatro indicadores siguen visibles con los mismos valores

#### Scenario: Indicador sin dato

- **WHEN** el cálculo no entrega uno de los indicadores
- **THEN** ese indicador muestra estado pendiente
- **AND** no aparece ninguna cifra ni un cero en su lugar

#### Scenario: La llegada del valor no salta

- **WHEN** un cálculo en curso termina
- **THEN** el valor sustituye al esqueleto dentro del mismo espacio
- **AND** el resto de la pantalla no se desplaza
