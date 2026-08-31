## Purpose

Convierte las fichas de fracasos comerciales (Pelamis, Oyster, SeaGen, Annapolis) en piezas activas del simulador: cada ficha se acompaña de un número calculado por el propio simulador, de modo que el estudiante ve por qué cada dispositivo habría (o no habría) sido viable en el escenario de Isla Fuerte, con la fuente que sostiene el dato.

## ADDED Requirements

### Requirement: LCOE estimado por ficha de fracaso

Cada ficha de dispositivo retirado en `Comparar` SHALL incluir un campo con el LCOE estimado en COP/MWh que ese dispositivo habría tenido en Isla Fuerte, calculado por el propio simulador con los parámetros por defecto del sitio y los parámetros técnicos declarados del dispositivo. La cifra SHALL ir con su fuente bibliográfica. Cuando el cálculo no sea posible por falta de datos, SHALL declararse como `pendiente` y SHALL explicar qué dato falta.

#### Scenario: LCOE estimado presente

- **WHEN** el usuario abre la ficha de Pelamis en `Comparar`
- **THEN** la ficha muestra el LCOE estimado para Isla Fuerte en COP/MWh con la fuente bibliográfica del dato técnico del dispositivo

#### Scenario: LCOE pendiente

- **WHEN** el dispositivo retirado no tiene parámetros técnicos suficientes en `datos/catalogo/`
- **THEN** la ficha muestra `LCOE: pendiente` y nombra el dato que falta (rendimiento del PTO, dimensiones, etc.)

### Requirement: Comparación contra el LCOE medio SIN

En cada ficha de fracaso SHALL aparecer, junto al LCOE estimado, el LCOE medio de la red interconectada nacional para el mismo año, de modo que la diferencia entre el LCOE del dispositivo retirado y el LCOE de la red quede explícita y respalde la explicación del fracaso.

#### Scenario: Diferencia visible

- **WHEN** el usuario abre la ficha de Oyster
- **THEN** la ficha muestra el LCOE estimado del dispositivo, el LCOE medio SIN del mismo año, y la diferencia porcentual entre ambos
