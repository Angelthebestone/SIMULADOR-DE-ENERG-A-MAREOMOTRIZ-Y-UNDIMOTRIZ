## Purpose

Ofrece cuatro maneras de entrar al mismo motor de cálculo, de lo observable a lo formal, para que quien llega sin saber qué es un frente de ola no se retire en la primera pantalla.

## Requirements

### Requirement: Cuatro niveles sobre un único motor

El sistema SHALL ofrecer los niveles Ver, Comparar, Calcular y Diseñar, y el conmutador entre ellos SHALL cambiar únicamente la presentación. El cálculo subyacente SHALL ser idéntico en los cuatro.

#### Scenario: El cálculo no cambia con el nivel

- **WHEN** se fija una configuración y se recorren los cuatro niveles sin tocar ningún control
- **THEN** la producción anual calculada es idéntica en los cuatro

#### Scenario: Entrada por el nivel visual

- **WHEN** se abre la aplicación por primera vez
- **THEN** el nivel activo es Ver
- **AND** se llega a Calcular y a Diseñar solo por acción explícita

### Requirement: La animación se mueve con el modelo real

La superficie libre representada en el nivel Ver SHALL dibujarse con `η(x,t) = (Hm0/2)·cos(kx − ωt)` usando el número de onda del solucionador de la relación de dispersión, y la posición vertical del cuerpo flotante SHALL provenir de integrar su ecuación de movimiento.

Una animación decorativa desacoplada del cálculo NO satisface este requisito.

#### Scenario: Coherencia entre animación y cálculo

- **WHEN** se cambia la profundidad del emplazamiento manteniendo el periodo
- **THEN** la longitud de onda dibujada en pantalla cambia de acuerdo con el nuevo número de onda

#### Scenario: Movimiento del cuerpo acoplado a la física

- **WHEN** se aumenta el amortiguamiento del PTO
- **THEN** la amplitud del movimiento vertical dibujado disminuye de forma coherente con la ecuación de movimiento

### Requirement: La interfaz nunca se congela

Ningún cálculo SHALL ejecutarse en el hilo de la interfaz. La ventana SHALL seguir respondiendo mientras una simulación está en curso. La simulación SHALL correr en QThread (u otro hilo de trabajo) comunicada por señales de progreso/resultado/error y SHALL ser cancelable en cualquier momento; mientras esté en curso SHALL mostrarse indicador de progreso y control de cancelación.

#### Scenario: Respuesta durante una simulación larga

- **WHEN** se lanza la simulación más costosa que la aplicación admite
- **THEN** la ventana sigue redibujándose y aceptando entrada del usuario
- **AND** existe forma de cancelar la simulación en curso

#### Scenario: Cancelación efectiva

- **WHEN** el usuario cancela una simulación en curso
- **THEN** el trabajo se detiene y la interfaz vuelve a estado disponible sin reinicio

#### Scenario: Animación sin recalcular por fotograma

- **WHEN** se anima la boya en el nivel Ver
- **THEN** la posición procede de muestrear una serie ya integrada, sin recalcular física por fotograma

### Requirement: Lenguaje adaptado a cada nivel

En el nivel Ver el sistema SHALL expresar las salidas en magnitudes cotidianas y limitar los controles a tres, con rótulos en lenguaje corriente. En Comparar SHALL mostrar el diagrama de pérdidas y las fichas de dispositivos reales, todavía sin fórmulas. En Calcular SHALL mostrar cada fórmula con los números ya sustituidos. En Diseñar SHALL exponer resonancia, límites teóricos, producción anual y coste por MWh.

#### Scenario: Salida en magnitudes cotidianas

- **WHEN** el nivel activo es Ver
- **THEN** el resultado principal se expresa en número de viviendas alimentadas
- **AND** no aparece ninguna fórmula en pantalla

#### Scenario: Fórmulas con números sustituidos

- **WHEN** el nivel activo es Calcular
- **THEN** cada resultado se acompaña de su fórmula con los valores numéricos ya reemplazados

### Requirement: Catálogo de convertidores documentados pero no simulados

El sistema SHALL incluir un catálogo consultable con los ocho tipos de convertidor undimotriz de la clasificación EMEC y los siete de corriente mareal, cada uno con su principio de funcionamiento, ejemplos reales y rango de eficiencia.

Estos tipos NO SHALL disponer de modelo dinámico propio, y el sistema SHALL dejar claro cuáles de ellos son simulables y cuáles solo consultables.

#### Scenario: Distinción entre simulable y consultable

- **WHEN** se consulta un tipo de convertidor del catálogo que no es uno de los cuatro modelados
- **THEN** aparecen su principio, sus ejemplos reales y su rango de eficiencia
- **AND** el sistema indica que no dispone de modelo dinámico y no ofrece calcularlo

#### Scenario: Cobertura del catálogo

- **WHEN** se abre el catálogo de convertidores
- **THEN** están presentes las ocho categorías undimotrices y las siete de corriente mareal

### Requirement: Los fracasos se muestran con su causa

El nivel Comparar SHALL incluir fichas de instalaciones reales que fracasaron, indicando la causa, y SHALL dejar claro que ninguna falló por física imposible.

#### Scenario: Ficha de un fracaso

- **WHEN** se consulta la ficha de una instalación desmantelada
- **THEN** aparece la causa del cierre
- **AND** se distingue si fue técnica, económica o de otra naturaleza

### Requirement: Modo sustentación y accesibilidad

La interfaz SHALL ofrecer un modo sustentación: tipografía escalable para proyector, paleta con contraste suficiente y distinguible para daltónicos (Sankey y mapa), y atajos de teclado (ESC cancela simulación, Ctrl+E exporta). Al arrancar sin conexión SHALL mostrar aviso offline pero operar con normalidad.

#### Scenario: Modo sustentación legible

- **WHEN** se activa el modo sustentación
- **THEN** la tipografía aumenta y el contraste cumple el mínimo legible a distancia de proyector

#### Scenario: Arranque offline

- **WHEN** la aplicación arranca sin internet
- **THEN** aparece aviso offline y todas las funciones operan con datos locales

### Requirement: La tesis del proyecto visible desde el arranque

La pantalla de inicio SHALL mostrar el contraste entre la densidad de potencia del emplazamiento por defecto y el umbral de rentabilidad citado para granjas undimotrices, y ese contraste SHALL permanecer accesible en los cuatro niveles.

El sistema SHALL acompañarlo de la tabla de densidades de referencia, cada una con su fuente: costa oeste de Europa, umbral de rentabilidad, criterio de buena ubicación del Handbook, Caribe colombiano y mínimo aprovechable citado.

El sistema NO SHALL enunciar la conclusión del proyecto como afirmación cerrada: SHALL presentar las cifras que la sostienen y dejar que el usuario la derive.

#### Scenario: Contraste en la pantalla de inicio

- **WHEN** se abre la aplicación
- **THEN** aparecen los 8,9 kW/m de Isla Fuerte junto a los 40 kW/m del umbral citado
- **AND** ambas cifras muestran su fuente

#### Scenario: El contraste sobrevive al cambio de nivel

- **WHEN** se conmuta a cualquiera de los cuatro niveles
- **THEN** el contraste sigue siendo consultable sin volver a la pantalla de inicio

### Requirement: Dos tecnologías en paralelo sobre el mismo emplazamiento

El nivel Comparar SHALL permitir resolver dos dispositivos distintos sobre el mismo emplazamiento y presentar sus resultados lado a lado, con el mismo recurso de entrada para ambos.

#### Scenario: Comparación con recurso común

- **WHEN** se seleccionan dos dispositivos en el nivel Comparar
- **THEN** ambos se resuelven con el recurso del emplazamiento activo
- **AND** sus cadenas de conversión se muestran juntas
- **AND** el sistema señala en qué eslabón se separan sus rendimientos
