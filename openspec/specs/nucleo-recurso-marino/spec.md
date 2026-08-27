## Purpose

Calcula el recurso energético del mar a partir de parámetros físicos: oleaje, marea de rango y corriente mareal. Es la base sobre la que se apoya todo lo demás y no sabe que existe una interfaz.

## Requirements

### Requirement: Solución de la relación de dispersión

El sistema SHALL resolver la relación de dispersión del oleaje `ω² = gk·tanh(kh)` para obtener el número de onda `k` dada la frecuencia angular y la profundidad, con una tolerancia igual o mejor que 1e-10.

El número de onda resultante SHALL ser el que alimente cualquier representación de la superficie libre, incluida la animación. Una sinusoide de número de onda arbitrario NO es aceptable.

#### Scenario: Convergencia en aguas intermedias

- **WHEN** se pide `k` para un periodo de 8 s y una profundidad de 30 m
- **THEN** el residuo `|ω² − gk·tanh(kh)|` queda por debajo de 1e-10
- **AND** el resultado se acompaña del número de iteraciones empleadas

#### Scenario: Límite de aguas profundas

- **WHEN** la profundidad supera la mitad de la longitud de onda
- **THEN** `k` coincide con `ω²/g` dentro del 1 %

#### Scenario: Límite de aguas someras

- **WHEN** la profundidad es menor que la vigésima parte de la longitud de onda
- **THEN** `k` coincide con `ω/√(gh)` dentro del 1 %

### Requirement: Potencia omnidireccional del oleaje

El sistema SHALL calcular la densidad de potencia del oleaje en aguas profundas como `J = ρg²Hm0²Te/(64π)`, expresada en kW/m de frente de ola.

Las constantes físicas `ρ` y `g` SHALL ser parámetros con valor por defecto documentado, nunca literales incrustados en la expresión. Para Isla Fuerte, el sistema SHALL usar **8,9 kW/m (Ortega et al. 2013, revisado por pares)** como valor de diseño y SHALL emplear la serie ERA5-Ocean (1,96 kW/m medio, rejilla 0,5°) solo para la forma de la matriz Hs-Te y la variabilidad mensual, declarando la discrepancia de 4,5× y su causa (resolución y posición de rejilla).

#### Scenario: Caso de referencia del Handbook

- **WHEN** se calcula `J` con Hm0 = 2,0 m y Te = 8,0 s
- **THEN** el resultado es 15,7 kW/m dentro del 1 %

#### Scenario: Dependencia cuadrática con la altura

- **WHEN** se duplica Hm0 manteniendo Te
- **THEN** `J` se multiplica por cuatro dentro del 0,1 %

### Requirement: Conversión entre periodos característicos

El sistema SHALL convertir entre periodo de pico, periodo energético y periodo de cruce por cero usando la relación `1,12·Te = 1,29·Tz = Tp` correspondiente a un espectro JONSWAP con γ = 3,3, y SHALL declarar ese supuesto allí donde el valor se muestre.

#### Scenario: Ida y vuelta

- **WHEN** se convierte un Tp a Te y el resultado se convierte de nuevo a Tp
- **THEN** se recupera el valor original dentro del 0,01 %

### Requirement: Serie temporal de marea por armónicos

El sistema SHALL reconstruir el nivel del mar como suma de componentes armónicas, incluyendo como mínimo M2 y S2, de modo que el ciclo de sicigia y cuadratura sea observable en una serie de al menos 30 días.

Las amplitudes y fases de las constituyentes SHALL obtenerse por ajuste armónico sobre la serie mareográfica medida del emplazamiento, no de valores tabulados de referencia. Cada constituyente SHALL llevar registrada la estación y el periodo de la serie de la que se ajustó.

Cuando un emplazamiento no disponga de serie mareográfica propia, el sistema SHALL declararlo y SHALL identificar la estación sustituta empleada. NO SHALL presentar constituyentes de una estación como si fueran del emplazamiento evaluado.

#### Scenario: Ciclo de sicigia visible

- **WHEN** se genera una serie de 30 días con M2 y S2
- **THEN** la envolvente presenta al menos dos máximos de sicigia y dos mínimos de cuadratura
- **AND** el cociente entre el rango de sicigia y el de cuadratura es mayor que 1,5

#### Scenario: Las constituyentes salen de la serie medida

- **WHEN** se consultan las constituyentes armónicas de un emplazamiento
- **THEN** cada una indica la estación mareográfica y el periodo del que se ajustó

#### Scenario: La reconstrucción reproduce el rango medido

- **WHEN** se reconstruye la serie de marea del Caribe con las constituyentes ajustadas sobre Escuela Naval CIOH y se compara el rango medio diario reconstruido con el medido
- **THEN** ambos coinciden dentro del 15 %

#### Scenario: Emplazamiento sin mareógrafo propio

- **WHEN** el emplazamiento activo no tiene serie mareográfica y se usa la de otra estación
- **THEN** el sistema nombra la estación sustituta
- **AND** el dato queda rotulado como aproximación por estación cercana

### Requirement: Rango mareal por emplazamiento

El sistema SHALL tomar el rango mareal de datos medidos por emplazamiento, no de un valor único global.

#### Scenario: Contraste entre océanos

- **WHEN** se consulta el rango mareal medio del Caribe y el del Pacífico colombiano
- **THEN** devuelve 0,31 m y 3,28 m respectivamente
- **AND** cada valor viene acompañado de su estación de origen y su periodo de medida

### Requirement: Potencia de corriente mareal

El sistema SHALL calcular la potencia disponible en una corriente como `P = ½·ρ·A·V³·Cp`, con dependencia cúbica en la velocidad.

#### Scenario: Dependencia cúbica demostrable

- **WHEN** se calcula la potencia para 0,54 m/s y para 3,0 m/s con A = 1 m², Cp = 0,40 y ρ = 1.025 kg/m³
- **THEN** los resultados son 32,3 W y 5.535 W dentro del 1 %
- **AND** el cociente entre ambos es aproximadamente 171

### Requirement: Independencia de la interfaz

El núcleo SHALL ser utilizable sin ningún componente de interfaz gráfica presente, de modo que el mismo código alimente la aplicación, las pruebas y las figuras del informe.

#### Scenario: Uso sin interfaz

- **WHEN** se ejecutan los cálculos del núcleo en un entorno sin biblioteca gráfica instalada
- **THEN** todos los cálculos se completan sin error

### Requirement: Espectros de oleaje y momentos espectrales

El sistema SHALL construir el espectro de densidad de energía del oleaje en las formulaciones de Pierson-Moskowitz y JONSWAP, y SHALL derivar de él los momentos espectrales `m_n = ∫S(ω)·ω^n·dω` y los parámetros que se obtienen de ellos: `Hm0 = 4√m0`, `Te = m₋₁/m0`, `Tz ≈ √(m0/m2)` y el ancho de banda espectral `ε0 = √(m0·m₋₂/m₋₁² − 1)`.

El factor de realce `γ` SHALL ser un parámetro recorrible entre 1,0 y 5,0. Los parámetros derivados SHALL calcularse a partir del espectro, y NO SHALL introducirse como constantes independientes de él.

#### Scenario: JONSWAP degenera en Pierson-Moskowitz

- **WHEN** se construye un espectro JONSWAP con γ = 1,0 y se compara con el Pierson-Moskowitz de la misma frecuencia de pico
- **THEN** ambos espectros coinciden dentro del 1 % en todo el rango de frecuencias

#### Scenario: El pico se estrecha al aumentar el realce

- **WHEN** se recorre γ de 1,0 a 5,0 manteniendo la frecuencia de pico
- **THEN** la densidad espectral en el pico aumenta de forma monótona
- **AND** el ancho de banda espectral `ε0` disminuye

#### Scenario: Coherencia entre espectro y parámetros

- **WHEN** se genera un espectro a partir de un Hm0 y un Te dados y se recuperan ambos por integración de sus momentos
- **THEN** los valores recuperados coinciden con los de partida dentro del 1 %

#### Scenario: Relación entre periodos derivada del espectro

- **WHEN** se calculan `Te` y `Tp` sobre un espectro JONSWAP con γ = 3,3
- **THEN** su cociente coincide con el 0,893 de la relación `1,12·Te = Tp` dentro del 2 %

### Requirement: Velocidad de grupo a profundidad finita

El sistema SHALL calcular la velocidad de grupo como `Cg(ω) = (ω/2k)·[1 + 2kh/sinh(2kh)]`, empleando el número de onda que devuelve el solucionador de la relación de dispersión.

#### Scenario: Límite de aguas profundas

- **WHEN** la profundidad supera la mitad de la longitud de onda
- **THEN** `Cg` coincide con la mitad de la celeridad de fase dentro del 1 %

#### Scenario: Límite de aguas someras

- **WHEN** la profundidad es menor que la vigésima parte de la longitud de onda
- **THEN** `Cg` coincide con `√(gh)` dentro del 1 %

### Requirement: La media del cubo no es el cubo de la media

La energía de una corriente mareal SHALL obtenerse integrando `P = ½·ρ·A·Cp·V(t)³` sobre la serie temporal reconstruida por armónicos. El sistema NO SHALL calcular la producción evaluando la expresión con la velocidad media de la serie.

El sistema SHALL poder mostrar ambos resultados juntos como ejercicio, dejando claro cuál de los dos es el válido.

#### Scenario: Integración frente a velocidad media

- **WHEN** se calcula la energía de una serie de corriente por integración y evaluando la potencia con la velocidad media de esa misma serie
- **THEN** ambos resultados se muestran juntos
- **AND** el obtenido con la velocidad media es menor
- **AND** el sistema señala la integración como el resultado válido

#### Scenario: La producción anual mareal se apoya en la serie

- **WHEN** se solicita la producción anual de una turbina de corriente
- **THEN** el cálculo recorre la serie temporal de velocidad
- **AND** el periodo cubierto por la serie aparece junto al resultado

### Requirement: Contraste de densidad entre aire y agua

El sistema SHALL mostrar la relación entre la densidad del agua de mar y la del aire y SHALL expresar, para una velocidad de corriente dada, la velocidad de viento que igualaría la potencia por unidad de área con el mismo coeficiente de potencia.

#### Scenario: Equivalente eólico de una corriente

- **WHEN** se consulta el equivalente eólico de una corriente de 3,0 m/s con ρ_agua = 1.025 kg/m³ y ρ_aire = 1,225 kg/m³
- **THEN** la relación de densidades mostrada es 837 dentro del 1 %
- **AND** la velocidad de viento equivalente es 28,3 m/s dentro del 1 %
