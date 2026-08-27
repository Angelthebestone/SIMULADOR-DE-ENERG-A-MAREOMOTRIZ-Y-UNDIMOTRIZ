## Purpose

Modela la toma de fuerza y la conversión eléctrica, que es donde se pierde la mayor parte de la energía capturada y donde las reglas de oficio importan más que las ecuaciones.

## ADDED Requirements

### Requirement: Rendimiento por tipo de PTO

El sistema SHALL ofrecer los tipos de PTO hidráulico, de agua, de aire, mecánico y de accionamiento directo, cada uno con su rendimiento indicativo de energía absorbida a generador y con la fuente de ese valor.

Cambiar de tipo de PTO SHALL cambiar el resultado de la cadena sin exigir reconfigurar el resto del dispositivo.

#### Scenario: Comparación entre tipos de PTO

- **WHEN** se resuelve la cadena con el mismo dispositivo y dos tipos de PTO distintos
- **THEN** las producciones resultantes difieren en la proporción de sus rendimientos
- **AND** cada rendimiento muestra su fuente

#### Scenario: El PTO de aire penaliza la OWC

- **WHEN** el dispositivo activo es una columna de agua oscilante con PTO de aire
- **THEN** el rendimiento aplicado es el más bajo de los cinco tipos
- **AND** el sistema lo señala como característica del concepto, no como defecto del modelo

### Requirement: Reglas de oficio del PTO convertidas en avisos

El sistema SHALL avisar cuando la configuración elegida contradiga una de las reglas de oficio del PTO: movimiento no restringido a un solo grado de libertad, ausencia de referencia fija contra la que trabajar, o control avanzado activado sin contabilizar su coste en cargas y desgaste.

Los avisos SHALL explicar la consecuencia. NO SHALL impedir la configuración.

#### Scenario: Aviso por falta de referencia fija

- **WHEN** se configura un dispositivo cuyo PTO no trabaja contra el fondo ni contra una estructura fija
- **THEN** el sistema avisa de la pérdida de eficiencia asociada
- **AND** permite continuar con esa configuración

#### Scenario: El control avanzado no es gratis

- **WHEN** se activa control reactivo o cualquier control avanzado
- **THEN** el sistema muestra el aumento de producción
- **AND** advierte del aumento de cargas y desgaste que lo acompaña

### Requirement: Picos de carga en paradas súbitas

El sistema SHALL señalar las paradas súbitas del PTO, por tope mecánico o por fin de carrera, como origen de picos de carga excepcionales.

#### Scenario: Tope de carrera alcanzado

- **WHEN** la simulación alcanza el límite de carrera del PTO
- **THEN** el sistema registra el evento
- **AND** lo presenta como carga excepcional, distinta de la carga de operación normal

### Requirement: Turbina Wells frente a turbina de impulso

Para la columna de agua oscilante, el sistema SHALL modelar la turbina Wells y la turbina de impulso con curvas de rendimiento distintas: la Wells con mejor rendimiento de pico y rango estrecho, con entrada en pérdida aerodinámica; la de impulso con menor pico y mayor ancho de banda.

El sistema SHALL permitir comparar la energía anual de ambas sobre el mismo oleaje.

#### Scenario: La de impulso gana en oleaje real

- **WHEN** se calcula la energía anual de ambas turbinas sobre la distribución de oleaje del emplazamiento
- **THEN** la turbina de impulso puede superar a la Wells pese a tener peor rendimiento de pico
- **AND** el sistema atribuye el resultado a que el mar pasa la mayor parte del tiempo fuera del punto de diseño

#### Scenario: Pérdida aerodinámica de la Wells

- **WHEN** el flujo supera el rango de operación de la turbina Wells
- **THEN** su rendimiento cae por entrada en pérdida
- **AND** la caída es visible en la curva mostrada

### Requirement: Fluctuación entre potencia máxima y media

El sistema SHALL calcular la relación entre potencia máxima y potencia media absorbida, y SHALL mostrarla junto al rango de referencia de la configuración correspondiente.

#### Scenario: Bidireccional frente a unidireccional

- **WHEN** se compara un cuerpo con PTO unidireccional contra el mismo cuerpo con PTO bidireccional
- **THEN** la relación máximo sobre medio es menor en el bidireccional
- **AND** ambos valores se muestran junto a su rango de referencia

### Requirement: Número de flotadores sobre un PTO común

El sistema SHALL permitir variar el número de cuerpos que comparten un mismo PTO y SHALL mostrar cómo esa elección reduce la fluctuación de potencia.

#### Scenario: Multiplicar absorbedores suaviza la potencia

- **WHEN** se pasa de un cuerpo a diez cuerpos en línea sobre un PTO bidireccional común
- **THEN** la relación entre potencia máxima y media desciende de forma acusada
- **AND** el sistema presenta ese descenso como el argumento cuantitativo para multiplicar absorbedores

### Requirement: Saturación del generador

El sistema SHALL acotar la potencia entregada por la potencia nominal del generador y SHALL contabilizar la energía perdida por esa saturación como parte de la eficiencia ola-cable.

#### Scenario: Recorte por saturación

- **WHEN** la potencia capturada instantánea supera la nominal del generador
- **THEN** la potencia entregada se acota a la nominal
- **AND** la energía recortada queda contabilizada y es consultable
