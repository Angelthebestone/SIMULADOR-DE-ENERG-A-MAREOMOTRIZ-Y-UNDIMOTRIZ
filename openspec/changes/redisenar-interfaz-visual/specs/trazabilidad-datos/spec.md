## MODIFIED Requirements

### Requirement: Atribuciones y licencias de fuentes externas

Cada serie local SHALL declarar su procedencia y su nivel de aprobación en el propio archivo y en la interfaz: IDEAM preliminar 900 (sin dato definitivo 1200), ERA5-Ocean vía Open-Meteo (rejilla 0,5°, ~23 km de desplazamiento), GMRT (Lamont-Doherty), RUNAP (PNN, 37 áreas marinas, 305.335 km²), Superservicios ZNI/SIN (`3ebi-d83g`, `5cvc-m38t`, `td8k-vhq9`) y XM/API_XM (EquipoAnaliticaXM, pydataxm, MIT, sin clave, https://github.com/EquipoAnaliticaXM/API_XM, métricas Precio de Bolsa, precios de contratos y Factor de Emisión CO2eq/kWh). La pantalla de limitaciones SHALL incluir estas atribuciones.

Las citas bibliográficas completas SHALL residir en un único lugar de la interfaz, accesible desde la cabecera en todos los niveles. Ninguna vista SHALL repetir una cita larga en línea junto a un resultado: junto a la cifra basta la referencia corta — autor y año — que remite a esa ubicación única.

El acceso a las fuentes SHALL ser operable por teclado, cerrarse con ESC y devolver el foco al control que lo abrió.

#### Scenario: Atribución visible

- **WHEN** se consulta la procedencia de un dato de oleaje o de rango mareal
- **THEN** aparece la fuente, su resolución o aprobación y el periodo cubierto

#### Scenario: Una sola ubicación para las citas

- **WHEN** se abre el acceso a fuentes desde cualquier nivel
- **THEN** aparece la cita completa de cada serie y las referencias del nivel activo
- **AND** ninguna vista muestra esa misma cita truncada junto a una cifra

#### Scenario: Fuentes por teclado

- **WHEN** se abre el acceso a fuentes con el teclado y se pulsa ESC
- **THEN** se cierra y el foco vuelve al control que lo abrió

### Requirement: Semáforo de confianza por resultado

Cada cifra mostrada SHALL acompañarse de un indicador visual de confianza derivado de su `estado`: verde para `verificado`, amarillo para `inferido`, rojo para `pendiente`. El semáforo SHALL ser visible en todos los niveles, incluido Ver, sin requerir abrir Calcular.

El indicador SHALL distinguir los tres estados por forma además de por color, y SHALL acompañarse del nombre del estado en texto. El glifo SHALL quedar fuera del árbol de accesibilidad cuando la palabra ya lo nombra, y SHALL tener nombre accesible cuando aparece solo.

Los colores del semáforo SHALL usarse únicamente para estados de dato. Los roles de la cadena de conversión SHALL usar un vocabulario de color disjunto.

#### Scenario: Semáforo coherente con el estado

- **WHEN** se muestra un resultado calculado con un dato `inferido`
- **THEN** el indicador aparece en amarillo junto a la cifra

#### Scenario: Distinguible sin color

- **WHEN** se observa el semáforo en escala de grises
- **THEN** los tres estados siguen siendo distinguibles por su forma y por su palabra
