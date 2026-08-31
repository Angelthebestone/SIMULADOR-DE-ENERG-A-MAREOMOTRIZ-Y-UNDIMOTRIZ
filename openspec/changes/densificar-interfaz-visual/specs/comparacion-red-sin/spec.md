## Purpose

Hace visible la otra mitad de la tesis del proyecto: la energía marina frente a la red interconectada nacional (SIN), no solo frente al diésel de las zonas no interconectadas (ZNI). La app pasa de comparar contra un único referente a mostrar los dos referentes que dan sentido a la afirmación original.

## ADDED Requirements

### Requirement: LCOE medio SIN visible en Diseñar

El nivel `Diseñar` SHALL mostrar, junto al LCOE calculado del dispositivo y al LCOE diésel ZNI ya presente, el LCOE medio de la red interconectada nacional (SIN) para el mismo año, obtenido del resumen de precios de bolsa en `datos/xm/resumen_xm.json` y del costo unitario SIN en `datos/xm/PrecBolsNaci_2023-2024.csv`. La cifra SHALL incluir fuente, año y estado (verificado/inferido/pendiente).

#### Scenario: Tres LCOE en pantalla

- **WHEN** el usuario abre `Diseñar`
- **THEN** la sección económica muestra tres LCOE en el mismo orden: diésel ZNI, LCOE del dispositivo marino, SIN nacional
- **AND** cada uno lleva su fuente y su estado

#### Scenario: Resaltado de la afirmación de la tesis

- **WHEN** el LCOE del dispositivo marino es mayor que el SIN
- **THEN** la app muestra la leyenda *"la energía marina en Isla Fuerte es marginal frente a la red interconectada"*
- **WHEN** el LCOE del dispositivo marino es menor que el diésel ZNI
- **THEN** la app muestra la leyenda *"la energía marina en Isla Fuerte es competitiva frente al diésel ZNI"*
