## Purpose

Permite al estudiante modificar los supuestos internos del modelo que hoy están fijos en `app/servicio.py` para que la pedagogía activa de *"¿qué pasa si el PTO fuera más eficiente?"* sea posible, y no quede cerrada por la UI.

## ADDED Requirements

### Requirement: Cuatro supuestos editables con fuente y rango

El nivel `Diseñar` SHALL exponer, junto a los parámetros de sitio y dispositivo, los siguientes cuatro supuestos del modelo, cada uno con su valor por defecto, su rango plausible, su unidad y su fuente bibliográfica:

- rendimiento electromecánico del PTO (`η_PTO`)
- eficiencia del generador (`η_gen`)
- factor de recuperación de capital (`CRF`)
- densidad del agua de mar (`ρ`)

Cambiar cualquiera de los cuatro SHALL propagar al recálculo de potencia capturada, producción anual y LCOE, manteniendo los demás parámetros constantes.

#### Scenario: Editar η_PTO reduce la potencia capturada

- **WHEN** el usuario disminuye `η_PTO` del 70 % al 40 % manteniendo el resto
- **THEN** la potencia capturada por el absorbedor cae en proporción coherente con `η_PTO`
- **AND** el AEP y el LCOE reflejados en pantalla se recalculan

#### Scenario: Editar CRF aumenta el LCOE

- **WHEN** el usuario aumenta el `CRF` del 8 % al 12 % manteniendo el resto
- **THEN** el LCOE aumenta
- **AND** la app muestra la contribución de CAPEX y la de OPEX por separado

#### Scenario: Rango plausible y fuente

- **WHEN** el usuario abre un control de supuesto
- **THEN** la app muestra el valor por defecto, el rango plausible (mínimo y máximo) y la fuente bibliográfica (Falnes 2002, handbook, etc.) en una sola línea bajo el control

### Requirement: Cambio de supuesto exportado en el servicio

El servicio Python SHALL aceptar estos cuatro parámetros como parte de `Parametros` (o estructura equivalente) y SHALL devolver resultados diferenciados para cada combinación. La función SHALL mantener la compatibilidad hacia atrás: los tests existentes con `Parametros` mínimos no se rompen.

#### Scenario: Servicio sin supuestos explícitos

- **WHEN** se llama al servicio sin especificar los cuatro supuestos nuevos
- **THEN** el servicio aplica los valores por defecto declarados
- **AND** los tests existentes siguen pasando
