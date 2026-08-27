## Purpose

Lleva el recurso del mar hasta el coste por MWh pasando por captura, PTO, generación, disponibilidad y producción anual, de forma que se vea dónde se pierde cada kilovatio de la cadena.

## ADDED Requirements

### Requirement: Cadena de conversión completa

El sistema SHALL implementar la secuencia recurso → captura hidrodinámica → PTO → generador y electrónica → disponibilidad → producción anual → coste por MWh como eslabones separados, cada uno con su entrada, su salida y su rendimiento consultables por separado.

#### Scenario: Trazabilidad de las pérdidas

- **WHEN** se resuelve la cadena para un caso cualquiera
- **THEN** la potencia de salida de cada eslabón es consultable de forma independiente
- **AND** el producto de los rendimientos de los eslabones iguala la eficiencia ola-cable global dentro del 0,1 %

### Requirement: Cuatro dispositivos, uno por concepto

El sistema SHALL modelar absorbedor puntual, columna de agua oscilante en rompeolas, presa o laguna de rango mareal y turbina de corriente mareal, todos a través de una interfaz común que permita añadir una tercera familia sin modificar los eslabones existentes.

#### Scenario: Interfaz común

- **WHEN** se resuelve la cadena para cada uno de los cuatro dispositivos
- **THEN** los cuatro responden a la misma secuencia de llamadas
- **AND** añadir una familia nueva no obliga a cambiar el código de las existentes

### Requirement: Invariantes físicos siempre satisfechos

El sistema SHALL garantizar en todo resultado que la potencia capturada no supera la incidente, que el ancho de captura de un absorbedor puntual axisimétrico en arfada no supera λ/2π, que todo rendimiento queda entre 0 y 1, que el balance de volumen de un embalse cierra y que la solución del integrador no diverge al reducir el paso de tiempo.

Cuando el coeficiente de potencia supere 16/27, el sistema SHALL señalarlo explícitamente en lugar de permitirlo en silencio, porque el límite de Betz no es universal en canales confinados.

#### Scenario: Captura acotada por la incidente

- **WHEN** se resuelve la cadena con cualquier combinación de entradas dentro de rango
- **THEN** la potencia capturada es menor o igual que la potencia incidente

#### Scenario: Ancho de captura acotado

- **WHEN** se calcula el ancho de captura de un absorbedor puntual en arfada
- **THEN** el valor no supera λ/2π

#### Scenario: Aviso por superar el límite de Betz

- **WHEN** una configuración de turbina en canal confinado arroja Cp mayor que 16/27
- **THEN** el resultado se entrega acompañado de un aviso explícito
- **AND** el cálculo no se interrumpe

#### Scenario: Convergencia del integrador

- **WHEN** se resuelve la misma configuración dinámica reduciendo el paso de tiempo a la mitad de forma sucesiva
- **THEN** la diferencia entre soluciones consecutivas disminuye de forma monótona
- **AND** ninguna solución diverge

### Requirement: Validación contra casos publicados

El sistema SHALL reproducir casos de referencia publicados dentro de la tolerancia que la propia fuente declara.

#### Scenario: Regla del pulgar del Handbook

- **WHEN** se calcula la producción anual con 40 kW/m, 15 m de ancho, 20 % de eficiencia, 95 % de disponibilidad y 8.766 horas
- **THEN** el resultado es 999 MWh al año

#### Scenario: Orbital O2

- **WHEN** se calcula la potencia de un rotor de 20 m con Cp = 0,40 y V = 3,0 m/s
- **THEN** el resultado es 1,74 MW dentro del 5 %

#### Scenario: La Rance

- **WHEN** se calcula la energía teórica por ciclo de una presa con el área de embalse y el rango mareal registrados para La Rance, y se anualiza con dos ciclos diarios
- **THEN** el resultado teórico es 1.435 GWh al año dentro del 5 %
- **AND** el sistema lo enfrenta a la producción real registrada y muestra el rendimiento global de ciclo resultante, del orden del 35 %
- **AND** distingue ese rendimiento de ciclo del rendimiento de la turbina

#### Scenario: La Rance con datos sin fuente primaria

- **WHEN** se consulta la validación contra La Rance y el área del embalse o su producción anual figuran como pendientes de fuente primaria
- **THEN** el contraste se muestra rotulado como orden de magnitud
- **AND** las cifras pendientes aparecen identificadas como tales

#### Scenario: Concordancia entre métodos de producción anual

- **WHEN** la producción anual se calcula por matriz de potencia y por la regla del pulgar del Handbook
- **THEN** ambos resultados coinciden dentro del ±50 % que el propio libro declara

### Requirement: Distinción entre potencia nominal y entregable

El sistema SHALL presentar la potencia nominal de catálogo y la potencia realmente entregable como magnitudes distintas, y SHALL mostrar el factor de planta que las relaciona.

#### Scenario: Factor de planta visible

- **WHEN** se muestra el resultado de cualquier dispositivo
- **THEN** aparecen la potencia nominal, la producción anual y el factor de planta resultante

### Requirement: Modo romper a propósito (disruptivo didáctico)

El sistema SHALL ofrecer un modo donde el usuario pueda forzar valores fuera de rango (Cp > 0,5926, Hs = 12 m, Te = 0) y SHALL explicar el invariante roto en lugar de bloquear la entrada o lanzar excepción no controlada. Este modo SHALL reutilizar las mismas guardas defensivas de la cadena.

#### Scenario: Cp por encima de Betz explica el límite

- **WHEN** se fuerza Cp = 0,65 en flujo libre
- **THEN** el resultado aparece con aviso de Betz superado y explicación
- **AND** el cálculo no se interrumpe

#### Scenario: Entrada absurda acotada y explicada

- **WHEN** se introduce Hs negativa o Te = 0 en modo disruptivo
- **THEN** el sistema acota, explica el rango admitido y no colapsa

### Requirement: Validación cruzada viva

Además de Handbook 999 MWh y Orbital O2 1,74 MW, el sistema SHALL contrastar en la vista de validación el factor de planta simulado contra Mutriku (0,11) y MeyGen (21 % medio), mostrando la desviación. Un desvío fuera de tolerancia SHALL ser aviso, no bloqueo.

#### Scenario: Contraste contra planta real

- **WHEN** se consulta la validación cruzada con la configuración de Mutriku
- **THEN** aparece el factor de planta simulado junto al 0,11 medido y su fuente

### Requirement: Comparación económica contra diésel

El sistema SHALL calcular el coste por MWh de la opción marina y SHALL contrastarlo tanto con la red interconectada como con la generación diésel en zona no interconectada.

Mientras el coste del diésel en zona no interconectada no esté verificado con fuente, el sistema SHALL mostrar la comparación marcada como pendiente en lugar de usar una cifra sin respaldo.

#### Scenario: Comparación con dato verificado

- **WHEN** existe un coste de diésel en zona no interconectada con fuente registrada
- **THEN** la comparación se muestra con ambas cifras y su fuente

#### Scenario: Comparación sin dato verificado

- **WHEN** no existe coste de diésel verificado
- **THEN** la comparación aparece rotulada como pendiente
- **AND** no se muestra ninguna cifra de contraste inventada

### Requirement: Modelo dinámico del cuerpo absorbedor

El eslabón de captura hidrodinámica del absorbedor puntual SHALL resolver la ecuación de movimiento en arfada de un grado de libertad `[m + A(ω)]·ζ̈ + [B(ω) + B_pto]·ζ̇ + [K_h + K_pto]·ζ = F_e(t)`, con la rigidez hidrostática obtenida como `K_h = ρ·g·S_w` a partir del área de plano de agua de la geometría.

La masa añadida `A(ω)`, el amortiguamiento por radiación `B(ω)` y la fuerza de excitación `F_e` SHALL proceder de coeficientes de literatura con cita, y NO SHALL calcularse resolviendo el problema de contorno. Cada coeficiente SHALL declarar la fuente y la geometría para la que fue publicado, y el sistema SHALL advertir cuando la geometría evaluada se aparte de esa geometría de referencia.

La potencia absorbida SHALL obtenerse como `P(t) = B_pto·ζ̇(t)²` sobre la serie integrada.

#### Scenario: Coeficientes con procedencia

- **WHEN** se consulta la masa añadida o el amortiguamiento por radiación empleados
- **THEN** aparecen su fuente y la geometría de referencia de la que proceden

#### Scenario: Geometría fuera del rango de la fuente

- **WHEN** la geometría evaluada se aparta de aquella para la que se publicaron los coeficientes
- **THEN** el sistema advierte de la extrapolación
- **AND** el cálculo se completa

#### Scenario: Frecuencia natural implícita

- **WHEN** se calcula la frecuencia natural con `A(ω)` dependiente de la frecuencia
- **THEN** el valor se obtiene por iteración hasta converger
- **AND** el número de iteraciones es consultable

#### Scenario: La potencia sale del movimiento integrado

- **WHEN** se calcula la potencia absorbida media
- **THEN** su valor coincide con el promedio de `B_pto·ζ̇²` sobre la serie integrada dentro del 1 %
