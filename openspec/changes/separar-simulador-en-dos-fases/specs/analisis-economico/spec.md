## Purpose

Convierte la producción anual en coste por MWh y lo enfrenta a lo que cuesta hoy la energía en el emplazamiento, que es el eslabón que cierra la tesis del proyecto.

## ADDED Requirements

### Requirement: Coste por MWh a partir de CAPEX, OPEX y producción

El sistema SHALL calcular el coste nivelado por MWh a partir del coste de inversión, el coste de operación, la producción anual, la vida útil y la tasa de descuento.

Los cinco parámetros SHALL ser visibles y modificables, y cada uno SHALL declarar su procedencia.

#### Scenario: Descomposición del coste

- **WHEN** se calcula el coste por MWh
- **THEN** se muestran por separado la contribución del coste de inversión y la del coste de operación

#### Scenario: Sensibilidad a la tasa de descuento

- **WHEN** se aumenta la tasa de descuento manteniendo el resto de parámetros
- **THEN** el coste por MWh aumenta
- **AND** el sistema permite ver el resultado para más de una tasa

### Requirement: El factor de planta gobierna el coste

El sistema SHALL mostrar el factor de planta junto al coste por MWh y SHALL hacer evidente que una misma máquina resulta más cara por MWh en un emplazamiento con menos recurso.

#### Scenario: Misma máquina, dos emplazamientos

- **WHEN** se calcula el coste por MWh del mismo dispositivo en dos emplazamientos con distinta densidad de potencia
- **THEN** el emplazamiento con menos recurso arroja un coste por MWh mayor
- **AND** ambos factores de planta se muestran juntos

#### Scenario: Contraste con una planta real

- **WHEN** se consulta la ficha de una instalación undimotriz en operación
- **THEN** su factor de planta real aparece junto al calculado por el simulador

### Requirement: Comparación contra la generación diésel de la zona no interconectada

El sistema SHALL enfrentar el coste por MWh de la opción marina al coste de la generación diésel del emplazamiento, cuando ese coste esté verificado con fuente.

El coste diésel SHALL identificar la localidad, el operador y el periodo de los que procede. NO SHALL usarse un promedio nacional presentándolo como el del emplazamiento.

#### Scenario: Comparación en Isla Fuerte

- **WHEN** el emplazamiento activo es Isla Fuerte y se calcula el coste por MWh
- **THEN** se muestra junto al coste unitario del diésel medido en esa localidad
- **AND** aparecen el operador y el periodo del dato

#### Scenario: Emplazamiento sin coste diésel propio

- **WHEN** el emplazamiento activo no tiene coste de generación diésel verificado
- **THEN** la comparación aparece rotulada como pendiente
- **AND** si se ofrece un promedio de referencia, queda identificado como promedio y no como dato local

### Requirement: Comparación contra la red interconectada

El sistema SHALL mostrar también el contraste con el coste de la red interconectada, y SHALL presentarlo como un intervalo cuando la fuente no permita un valor único defendible. Para 2023 el sistema SHALL usar el intervalo **628–659 COP/kWh** según filtro (con 11.336 registros en `anio_corregido=9999/mes=99`), SHALL reportar la relación Isla Fuerte/SIN como **1,5–1,6×** y NO SHALL presentar un punto único de 686 COP/kWh como valor de diseño.

#### Scenario: Intervalo en lugar de punto

- **WHEN** se muestra el coste de la red interconectada
- **THEN** aparece como intervalo 628–659 COP/kWh con su procedencia (`td8k-vhq9`, Superservicios)
- **AND** se indica que la dispersión procede de la calidad del conjunto de datos de origen

### Requirement: Las dos comparaciones se presentan juntas

El sistema SHALL mostrar la comparación contra la red interconectada y la comparación contra el diésel en la misma vista, de modo que el resultado dispar sea visible de una vez.

#### Scenario: Resultado dispar visible

- **WHEN** se consulta el cierre económico de un emplazamiento de zona no interconectada
- **THEN** ambas comparaciones aparecen juntas
- **AND** el sistema no oculta la comparación desfavorable

### Requirement: Precio de referencia del mercado mayorista (XM) offline como validación cruzada

El sistema SHALL ofrecer como referencia complementaria el Precio de Bolsa Nacional y precios de contratos del mercado mayorista colombiano obtenidos de la API XM (EquipoAnaliticaXM/API_XM, pydataxm, MIT, sin clave), cacheados offline y versionados en `datos/xm/` (CSV/JSON locales). La aplicación en ejecución SHALL leer solo esos archivos locales y NO SHALL realizar peticiones de red.

Los precios XM SHALL presentarse como intervalo con periodo y granularidad declarados (p. ej. 2015-2024, horario/diario) y SHALL etiquetarse explícitamente como precio de generación pura, distinto del costo unitario de servicio completo de Superservicios (CU = GM+DM+CM). El sistema NO SHALL mezclar Bolsa con CU en la misma cifra ni presentar Bolsa como CU.

#### Scenario: Intervalo XM visible y distinguido del CU

- **WHEN** se consulta la referencia XM junto al CU del SIN
- **THEN** aparecen dos intervalos separados: CU Superservicios (servicio completo) y Bolsa XM (solo generación)
- **AND** cada uno muestra su fuente, periodo y granularidad

#### Scenario: Operación offline con XM cacheado

- **WHEN** la aplicación se ejecuta sin internet y `datos/xm/` contiene los CSV cacheados
- **THEN** la referencia XM se muestra con normalidad sin intentar descargar

### Requirement: Emisiones de CO2 evitadas

El sistema SHALL calcular las emisiones evitadas como `tCO2eq = AEP × factor_de_emisión_evitado`, usando el Factor de Emisión de la Matriz Energética (CO2eq/kWh) cacheado offline de la API XM (`datos/xm/`) y, cuando exista, el factor del diésel ZNI. El factor empleado SHALL mostrar su fuente, periodo y unidad.

#### Scenario: Cálculo de CO2 evitado con factor XM

- **WHEN** existe AEP y factor de emisión XM cacheado
- **THEN** el sistema muestra tCO2eq/año evitadas y la fórmula con valores sustituidos y fuente del factor

### Requirement: Coste hundido de un activo varado

El sistema SHALL incluir, entre las fichas de instalaciones desmanteladas, quién asumió el coste del activo una vez fuera de servicio.

#### Scenario: Ficha con el destino del coste hundido

- **WHEN** se consulta la ficha de una instalación mareomotriz desmantelada
- **THEN** aparece qué se intentó hacer con el coste no recuperado
- **AND** se distingue el desenlace regulatorio del desenlace técnico

### Requirement: Trazabilidad monetaria

Toda cifra monetaria SHALL indicar su moneda y su año de referencia. Cuando se convierta entre monedas, el sistema SHALL declarar la tasa empleada y su fecha.

#### Scenario: Cifra monetaria completa

- **WHEN** se muestra cualquier importe
- **THEN** aparece con su moneda y su año de referencia

#### Scenario: Conversión declarada

- **WHEN** un importe se presenta convertido a otra moneda
- **THEN** el sistema muestra la tasa de cambio empleada y su fecha
- **AND** si esa tasa no está verificada, la conversión queda rotulada como orden de magnitud

### Requirement: Banda de incertidumbre económica

El sistema SHALL propagar la banda de AEP (±15 % en Hm0/Te) al coste por MWh, mostrando LCOE mínimo/central/máximo. La banda SHALL recalcularse al cambiar disponibilidad, vida útil o tasa de descuento.

#### Scenario: LCOE con banda

- **WHEN** se solicita sensibilidad económica con AEP ±15 %
- **THEN** el LCOE aparece como intervalo, no como punto

### Requirement: Consumo de referencia para conversión a viviendas

La conversión de producción anual a número de viviendas alimentadas del nivel Ver SHALL usar un consumo residencial anual con fuente declarada. Mientras ese consumo no esté verificado, el sistema SHALL rotular la salida en viviendas como pendiente y NO SHALL inventar un consumo.

#### Scenario: Viviendas con consumo verificado

- **WHEN** existe un consumo residencial anual verificado
- **THEN** el número de viviendas se muestra junto al consumo y su fuente

#### Scenario: Viviendas sin consumo verificado

- **WHEN** no existe consumo verificado
- **THEN** la salida en viviendas aparece como pendiente
- **AND** no se muestra ningún número de viviendas

### Requirement: La escala gobierna la viabilidad

El sistema SHALL calcular el tiempo de repago del coste de inversión de partida, el que no depende del tamaño de la máquina, y SHALL permitir compararlo entre una máquina pequeña y una de varios megavatios sobre el mismo emplazamiento.

El sistema SHALL hacer evidente que multiplicar unidades pequeñas no equivale a escalar, porque no reparte ese coste de partida entre más potencia instalada. Los valores de coste de partida empleados SHALL declarar su fuente y su año de referencia.

#### Scenario: Repago según el tamaño

- **WHEN** se calcula el repago del coste de inversión de partida para una máquina de cientos de kilovatios y para una de varios megavatios en el mismo emplazamiento
- **THEN** ambos plazos se muestran juntos
- **AND** el de la máquina pequeña es sensiblemente mayor
- **AND** el sistema atribuye la diferencia al reparto del coste de partida, no al rendimiento

#### Scenario: Multiplicar unidades no sustituye a escalar

- **WHEN** se configura un número de unidades pequeñas cuya potencia instalada suma la de una única máquina grande
- **THEN** el coste de inversión de partida total resulta mayor que el de la máquina única
- **AND** el coste por MWh resultante también

### Requirement: Masa por unidad de potencia

El sistema SHALL mostrar la relación entre masa y potencia instalada de los dispositivos con datos registrados, y SHALL advertir de que la comparación es engañosa si no se separa el material estructural del lastre, porque su coste por tonelada difiere en órdenes de magnitud.

#### Scenario: Comparación con advertencia

- **WHEN** se consulta la relación masa sobre potencia de dos dispositivos
- **THEN** ambos valores aparecen con su fuente
- **AND** la advertencia sobre estructura frente a lastre acompaña a la comparación
