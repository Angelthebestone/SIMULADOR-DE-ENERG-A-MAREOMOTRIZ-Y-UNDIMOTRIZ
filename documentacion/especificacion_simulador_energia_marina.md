# Especificación funcional del simulador de energía marina

Proyecto de aula, FCN030 Introducción a la Ingeniería, UTS, semestre 2026-2.
Prototipo educativo de generación energética undimotriz y mareomotriz, en forma de
aplicación de escritorio en Python.

Fecha: 25 de agosto de 2026.

Este documento define **qué debe llevar el simulador**: qué dispositivos, qué
ecuaciones, qué datos, qué salidas y qué no se va a incluir. Está construido sobre tres
fuentes: el *Handbook of Ocean Wave Energy* (Pecher y Kofoed, Springer, 2017, acceso
abierto), *Ocean Wave Energy: Current Status and Future Perspectives* (Cruz, Springer,
2008) y una investigación web documentada en `investigacion_convertidores_marinos.md`,
en esta misma carpeta.

## Convenciones

- **[L]** dato tomado de uno de los dos libros, con capítulo y ecuación o tabla.
- **[V]** verificado en fuente web citada.
- **[I]** inferencia o cálculo propio, con la confianza indicada.

Formato numérico en español: coma decimal, punto de miles.

---

## 1. Tesis del proyecto

Un simulador que solo calcule potencia hidrodinámica enseña la mitad equivocada del
problema. De los ocho dispositivos fracasados que se documentan en la sección 5,
**ninguno falló por física imposible**: fallaron por coste, por disponibilidad o por
acceso a capital. [I]

La tesis que el simulador debe hacer descubrir al estudiante, no enunciar, es esta:

> La energía marina en Colombia es marginal frente a la red interconectada, pero
> competitiva frente al diésel en zonas no interconectadas.

Los números que sostienen esa tesis y que deben estar visibles de forma permanente:

| Referencia | Densidad de potencia del oleaje | Fuente |
|---|---|---|
| Costa oeste de Europa | aproximadamente 50 kW/m | Cruz (2008), cap. 1 [L] |
| Umbral citado de rentabilidad para granjas | 40 kW/m | Osorio y otros (2016) [V] |
| Criterio de "buena ubicación" del Handbook | más de 15 kW/m | Handbook, cap. 1, §4.5 [L] |
| Caribe colombiano, zona del chorro de bajo nivel | 8 a 14 kW/m | Appendini y otros (2015) [V] |
| Isla Fuerte (Bolívar) | 8,9 kW/m, 78 MWh/m al año | Ortega y otros (2013) [V] |
| Caribe colombiano en temporada de lluvias | aproximadamente 1 kW/m | Osorio y otros [V] |
| Mínimo mundialmente citado como aprovechable | 2 kW/m | [V] |

Colombia está entre 5 y 9 kW/m frente a un umbral convencional de 40 kW/m. Ese
contraste va en la pantalla de inicio.

---

## 2. Cadena de conversión: la columna vertebral del simulador

Todo el programa se organiza sobre una sola secuencia, y cada módulo es un eslabón:

```
Recurso → Captura hidrodinámica → PTO → Generador y electrónica →
Disponibilidad → Energía anual (AEP) → Coste por MWh
```

El Handbook define la eficiencia global de esa cadena como **eficiencia ola-cable**
(wave-to-wire, η_w2w) e insiste en que incluye las limitaciones del sistema, como la
saturación del generador, no solo los rendimientos de cada etapa. [L, cap. 1, §4.2]

El objetivo pedagógico central del simulador es que el estudiante vea entrar 100 kW de
frente de ola y salir 8 kW a la red, y entienda dónde se fue cada kilovatio. Eso se
representa con un diagrama de Sankey.

---

## 3. Alcance: qué se incluye y qué no

### 3.1 Se incluye

Cuatro dispositivos, dos por familia. La elección no es arbitraria: cada uno enseña un
concepto distinto que los otros no pueden enseñar.

| Familia | Dispositivo | Qué enseña que ningún otro enseña |
|---|---|---|
| Undimotriz | **Absorbedor puntual** (boya oscilante en arfada) | Resonancia, ancho de captura mayor que el propio diámetro, optimización del amortiguamiento del PTO |
| Undimotriz | **Columna de agua oscilante (OWC)** integrada en rompeolas | Que el coste de obra civil compartido cambia la economía por completo; turbina autorrectificante |
| Mareomotriz | **Presa o laguna de rango mareal** | Dependencia cuadrática con el rango; que la estrategia de operación vale tanto como la máquina |
| Mareomotriz | **Turbina de corriente mareal** | Dependencia cúbica con la velocidad; límite de Betz y por qué el agua gana al aire |

### 3.2 Se documenta pero no se simula

Los ocho tipos de convertidor undimotriz de la clasificación EMEC y los siete de
corriente mareal aparecen en un módulo de fichas, con esquema, principio, ejemplos
reales y rango de eficiencia, pero sin modelo dinámico propio. [V]

Undimotriz: atenuador, absorbedor puntual, convertidor de oleaje oscilante por embate
(OWSC), columna de agua oscilante, rebosamiento, diferencial de presión sumergido, onda
de bulbo, masa rotatoria.

Corriente mareal: eje horizontal, eje vertical, hidroala oscilante, cometa mareal,
efecto Venturi, tornillo de Arquímedes, otros.

### 3.3 Se excluye explícitamente

- **Hidráulica convencional.** Fuera del alcance, pero la arquitectura deja el hueco
  para añadirla como tercera familia sin reescribir nada (sección 10).
- **Oleaje direccional y espectros bimodales.** El Handbook advierte que lo correcto es
  usar la serie temporal completa de espectros direccionales [L, cap. 3, §3.3], pero eso
  excede un curso introductorio. Se usa oleaje omnidireccional y se **declara la
  limitación en pantalla**, que es lo honesto.
- **Cálculo BEM.** No se resuelve el problema de contorno para obtener masa añadida y
  amortiguamiento por radiación. Se usan coeficientes de literatura, citados.
- **Amarres, fatiga y supervivencia estructural.** Se mencionan como criterio de diseño,
  no se calculan.

---

## 4. Modelo físico, módulo por módulo

### M1. Recurso undimotriz

**Potencia omnidireccional del oleaje en aguas profundas.** [L, Handbook, cap. 3, ec. 18]

```
J = ρ g² Hm0² Te / (64 π)          [W/m]
```

- `ρ` densidad del agua de mar, kg/m³ (1.025 por defecto, editable).
- `g` aceleración de la gravedad, 9,81 m/s².
- `Hm0` altura significativa espectral, m.
- `Te` periodo energético, s.

Comprobación numérica propia: con ρ = 1.025 y g = 9,81, el coeficiente
ρg²/(64π) = 1.025 · 96,2361 / 201,0619 = **490,6 W/m por m²·s**, es decir: [I]

```
J [kW/m] = 0,4906 · Hm0² · Te
```

Con agua dulce (ρ = 1.000) baja a 0,4786. El "0,5" de la literatura divulgativa es el
redondeo de esta constante. El simulador debe mostrar la constante, no esconderla.

**Definiciones espectrales.** [L, Handbook, cap. 3, ecs. 11, 16, 17, 19, 20]

```
m_n = ∫ S(ω) ω^n dω              (momento espectral de orden n, ec. 16)
Hm0 = 4 √m0                      (ec. 11)
Te  = m₋₁ / m0                   (ec. 17)
Tz  ≈ √(m0 / m2)                 (ec. 20)
ε0  = √( m0 · m₋₂ / m₋₁² − 1 )   (ancho de banda espectral, ec. 19)
```

**Conversión entre periodos.** Para un espectro JONSWAP con factor de realce γ = 3,3:
[L, Handbook, cap. 3, ec. 21]

```
1,12 · Te = 1,29 · Tz = Tp
```

De donde Te = 0,893 Tp y Tz = 0,775 Tp. [I]

Esto es obligatorio en la interfaz: el estudiante debe **elegir explícitamente** qué
periodo está introduciendo, y el simulador convierte a la vista. Confundir Tp con Te
produce un error del 12 % en la potencia, que es más que muchos de los efectos que el
simulador pretende enseñar.

**Espectros.** [L, Handbook, cap. 3, ecs. 9 y 10]

Pierson-Moskowitz (mar completamente desarrollado):

```
S(ω) = α g² ω⁻⁵ exp[ −β (ωp/ω)⁴ ]      con α = 0,0081 y β = 0,74
```

JONSWAP (mar en desarrollo, con fetch limitado):

```
S(ω) = α g² ω⁻⁵ exp[ −(5/4)(ωp/ω)⁴ ] · γ^exp[ −(ω−ωp)² / (2 σ² ωp²) ]
α = 0,076 (U10² / (F g))^0,22
ωp = 22 (g² / (U10 F))^(1/3)
γ = 3,3
σ = 0,07 para ω ≤ ωp;  σ = 0,09 para ω > ωp
```

Con γ = 1,0 el JONSWAP degenera exactamente en el Pierson-Moskowitz. [L] Ese es un
buen deslizador didáctico: mover γ de 1,0 a 5,0 y ver estrecharse el pico.

**Relación de dispersión.** [L, Handbook, cap. 3, ec. 14]

```
ω² = g k tanh(k h)
```

Sin solución cerrada en profundidad intermedia. Implementación recomendada:
Newton-Raphson con arranque de Eckart, k₀ = (ω²/g)/√(tanh(ω²h/g)), tolerancia 1e-10.
**El simulador debe mostrar el número de iteraciones**: es una lección de métodos
numéricos regalada. [I]

**Velocidad de grupo a profundidad finita.** [L, Handbook, cap. 3, ec. 13]

```
Cg(ω) = (ω / (2 k(ω))) · [ 1 + 2 k(ω) h / sinh(2 k(ω) h) ]
```

**Diagrama de dispersión (scatter diagram).** Tabla bivariada de frecuencia de
ocurrencia indexada por altura significativa y por un periodo representativo. [L,
Handbook, cap. 3, fig. 9] El Handbook advierte de sus dos limitaciones, que el
simulador debe mostrar como nota: dentro de una sola celda puede haber una variación de
potencia de 4 a 1, y la celda no guarda información de dirección ni de forma
espectral. [L]

### M2. Modelo dinámico del absorbedor puntual

Ecuación de movimiento en arfada, un grado de libertad:

```
[m + A(ω)] ζ̈ + [B(ω) + B_pto] ζ̇ + [K_h + K_pto] ζ = F_e(t)
```

| Símbolo | Significado |
|---|---|
| m | masa del cuerpo (estructura más lastre) |
| A(ω) | masa añadida, inercia del agua arrastrada |
| B(ω) | amortiguamiento por radiación |
| K_h | rigidez hidrostática, K_h = ρ g S_w |
| S_w | área de plano de agua; cilindro de diámetro D: S_w = π D²/4 |
| B_pto | amortiguamiento del PTO |
| K_pto | rigidez del PTO (control reactivo, puede ser negativa) |
| F_e | fuerza de excitación (Froude-Krylov más difracción) |

**Potencia absorbida:**

```
P(t) = B_pto · ζ̇(t)²
P_media = ½ B_pto ω² |ζ₀|²      (movimiento armónico de amplitud |ζ₀|)
```

**Resonancia:**

```
ω_n = √( (K_h + K_pto) / (m + A(ω_n)) )
```

Implícita, porque A depende de ω. Se resuelve iterando.

**Amortiguamiento óptimo del PTO sin control reactivo:**

```
B_pto,óptimo = √( B(ω)² + [ ω(m + A(ω)) − K_h/ω ]² )
```

En resonancia el corchete se anula y queda el acoplamiento de impedancia,
B_pto,óptimo = B(ω).

**Cota de Falnes:**

```
P_max = |F_e|² / (8 B(ω))
```

**El principio rector de todo el módulo,** citado literalmente del Handbook:
[L, cap. 1, §4.3, citando a Falnes y Budal (1978)]

> "A good wave absorber must be a good wave-maker."

Un cuerpo que oscila radia una ola. Cuanto mejor se parezca esa ola radiada a la ola
incidente, mejor la absorbe. El límite teórico de absorción para un cuerpo que radia una
ola simétrica o antisimétrica (boya en arfada, aleta en cabeceo) es del **50 %**; un
cuerpo no simétrico como el pato de Salter puede llegar a absorber casi el **100 %**. [L]

### M3. Ancho de captura y sus límites

```
L   = P_absorbida / J                      (ancho de captura, en metros)
CWR = P_absorbida / (B_carac · J)          (relación de ancho de captura, adimensional)
```

**Límite de Budal-Falnes.** Un absorbedor puntual axisimétrico oscilando solo en arfada
tiene un ancho de captura máximo de **λ/2π**; combinando arfada con deriva o cabeceo
sube a **3λ/2π**. [V]

Cálculo ilustrativo: con T = 8 s en aguas profundas, λ = 1,56 · 8² = 99,8 m, luego
λ/2π = **15,9 m**. Una boya de 5 m de diámetro puede en teoría capturar la energía
contenida en 15,9 m de frente de ola, más de tres veces su propio diámetro. [I]

Este resultado contraintuitivo es, en mi criterio, el concepto más potente que un
simulador undimotriz puede transmitir, y merece una pantalla dedicada.

**Límite de Budal por volumen barrido**, que es el que manda en dispositivos reales
porque el límite λ/2π exige amplitudes físicamente imposibles: [V]

```
η_Budal = π² D R / (a λ)
```

**Aquí hay una discrepancia entre fuentes que el simulador debe mostrar en vez de
ocultar.** [I]

Valores medios de CWR según el Handbook [L, cap. 1, tabla 1]:

| Tipo de WEC | CWR media |
|---|---|
| Rebosamiento flotante | 17 % |
| Columna de agua oscilante | 29 % |
| Absorbedor puntual | 16 % |
| Aleta oscilante fija al fondo | 37 % |

Rangos según la base de datos de Babarit (2015), vía Coastal Wiki [V]:

| Tipo de dispositivo | CWR | Ancho característico |
|---|---|---|
| OWC | 15 a 40 % | ≈ 30 m |
| Rebosamiento | 4 a 23 % | ≈ 300 m |
| Absorbedor puntual | 3 a 42 % | 5 a 20 m |
| OWSC | 41 a 65 % | ≈ 20 m |
| Flotante en cabeceo | 20 a 36 % | ≈ 25 m |
| Atenuador | 5 a 7 % | ≈ 150 m |

Las dos fuentes son consistentes: los valores del Handbook son medias que caen dentro de
los rangos de Babarit, salvo el OWSC, donde el Handbook da 37 % y Babarit un rango de
41 a 65 %. Ambas proceden en última instancia del mismo trabajo de Babarit, en versiones
distintas (2011 y 2015). Recomiendo usar los rangos y citar las dos. [I]

**La observación crítica que el simulador debe forzar:** el OWSC tiene la mejor CWR de
todas las familias y su desarrollador, Aquamarine Power, quebró en 2015. El atenuador
tiene la peor CWR y Pelamis llegó más lejos comercialmente que nadie. **La eficiencia
hidrodinámica no decide; decide el coste por MWh.** [I]

### M4. Dimensionamiento del dispositivo

Dimensiones hidrodinámicamente óptimas para condiciones medias del norte de Europa
[L, Handbook, cap. 1, tabla 2]:

| Tipo de WEC | Dimensión relevante |
|---|---|
| Absorbedor puntual | Diámetro de 12 a 20 m |
| OWC | Longitud de 12 a 20 m |
| OWSC | Espesor: cuanto más grueso, mejor |
| Estructuras flotantes (rebosamiento) | Longitud mayor que una longitud de onda |

El Handbook precisa que **la dimensión óptima del cuerpo absorbedor está ligada
principalmente al periodo de la ola**, y que debe usarse el periodo de pico con mayor
contribución anual de energía, es decir, el que maximiza el producto de energía por
probabilidad de ocurrencia. [L, cap. 1, §4.3]

**Consecuencia directa para Colombia, y es un aporte propio del proyecto.** [I,
confianza media] Esas dimensiones corresponden a periodos del norte de Europa, del orden
de 8 a 10 s. El Caribe colombiano tiene Te de 5 a 8 s. Como la longitud de onda escala
con T², el factor de escala es del orden de (6/9)² = 0,44, y el diámetro óptimo de un
absorbedor puntual para el Caribe colombiano caería en torno a **5 a 9 m**, no 12 a
20 m. Que el simulador calcule esa dimensión óptima a partir del recurso local, en vez
de copiar la cifra europea, es exactamente el tipo de originalidad que la rúbrica del
curso premia.

**Aviso de resonancia, y es incómodo.** El periodo natural en arfada de una boya
cilíndrica de calado d es aproximadamente T_n = 2π√(d(1+Ca)/g). Con d = 2 m y un
coeficiente de masa añadida Ca = 0,5, T_n = **3,5 s**, mientras el oleaje real está entre
6 y 12 s. Las boyas pequeñas están sistemáticamente fuera de resonancia, y por eso los
desarrollos reales necesitan control reactivo o rigidez negativa. [I/G] El simulador debe
dejar que el estudiante lo descubra moviendo el diámetro y viendo que la resonancia no
llega.

### M5. Sistemas de toma de fuerza (PTO)

Rendimientos indicativos, de energía de ola absorbida a generador
[L, Handbook, cap. 1, tabla 4]:

| Sistema de PTO | Rendimiento |
|---|---|
| Hidráulico | 65 % |
| Agua (turbina hidráulica de baja carga) | 85 % |
| Aire (turbina autorrectificante) | 55 % |
| Mecánico | 90 % |
| Accionamiento directo | 95 % |

Reglas de oro del Handbook que el simulador debe convertir en restricciones o en avisos:
[L, cap. 1, §4.4]

1. El PTO es más eficiente cuando el movimiento está **restringido a un solo grado de
   libertad**. Si no, el cuerpo se mueve por donde encuentra menos resistencia y evita
   al PTO.
2. El PTO es mucho más eficiente **trabajando contra una referencia fija**: el fondo
   marino o una estructura que no se mueva.
3. El control avanzado aumenta mucho la producción, pero también las cargas y el
   desgaste. No es gratis.
4. Se producen picos de carga excepcionales en las **paradas súbitas**: topes mecánicos
   del PTO, tirones de las líneas de amarre.

Para la turbina de aire del módulo OWC, el compromiso que hay que modelar es este: la
turbina Wells tiene mejor rendimiento de pico (50 a 55 %) pero un rango de operación
estrecho, y entra en pérdida aerodinámica; la turbina de impulso tiene un rendimiento de
pico menor (por debajo del 50 %) pero mucho más ancho de banda. [V] En oleaje real,
**la turbina de impulso puede dar más energía anual pese a tener peor rendimiento de
pico**, porque el mar pasa la mayor parte del tiempo fuera del punto de diseño. Es uno de
los mejores ejercicios que puede ofrecer el simulador. [I]

### M6. Fluctuación de potencia

Relación entre potencia máxima y potencia media absorbida, sobre 1.000 periodos de ola
y sin limitaciones físicas [L, Handbook, cap. 1, tabla 3]:

| Configuración | Relación máximo/medio |
|---|---|
| Un cuerpo, PTO unidireccional | 15 a 30 |
| Un cuerpo, PTO bidireccional | 10 a 12 |
| OWC con PTO bidireccional | 10 a 15 |
| Diez cuerpos en línea con PTO bidireccional común | 3 a 7 |

Es el argumento cuantitativo de por qué conviene multiplicar absorbedores sobre un mismo
PTO, y explica el diseño de Wavestar. Debe estar en el simulador como conmutador de
número de flotadores. [I]

### M7. Rango mareal (presa o laguna)

**Energía potencial por ciclo:** [V]

```
E = ½ ρ g A R²
```

con A el área horizontal del embalse en m² y R el rango mareal en m. El factor ½ aparece
porque la carga hidráulica decrece a medida que el embalse se vacía; es el mismo factor
½ de la energía de un resorte. [V]

**Pero el simulador no debe usar esa fórmula cerrada para calcular producción.** Debe
integrar en el tiempo, porque es la única manera de que los cuatro modos de operación se
diferencien solos. Bucle en cada paso: [V]

1. Determinar el estado: retención, compuertas abiertas, bombeo o generación.
2. Carga instantánea `H(t) = |nivel del mar − nivel del embalse|`.
3. Caudal `Q(t)` por turbinas y compuertas, según sus curvas.
4. Potencia `P(t) = ρ g Q(t) H(t) η(H, Q)`.
5. Actualizar el nivel del embalse por balance de volumen con la curva área-nivel A(h).

**Los cuatro modos:** [V]

- **Vaciado (ebb).** Llenado por gravedad en pleamar, cierre, espera, turbinado hacia el
  mar en bajamar.
- **Llenado (flood).** El simétrico. Rinde menos en un estuario real, porque el ciclo de
  vaciado opera con carga media mayor. Sihwa Lake es la excepción: opera solo en llenado
  por razones de calidad del agua del embalse.
- **Bidireccional.** Produce más horas y reduce el pico, pero con menor carga media, así
  que la energía anual puede ser **inferior** a la del vaciado puro. No es una mejora
  automática, es un compromiso. [I]
- **Con bombeo.** Se bombea al embalse cerca de la pleamar, con poca carga, para turbinar
  después con mucha carga. Es arbitraje energético puro.

**Validación obligatoria contra La Rance.** Con A = 22 km² y R = 8 m:

```
E = 0,5 · 1.025 · 9,81 · 22·10⁶ · 8² = 7,08·10¹² J = 1,97 GWh por ciclo
```

Energía teórica anual con dos ciclos diarios: 1,97 · 2 · 365 = **1.435 GWh/año**. [I]
La producción real ronda los 500 GWh/año, lo que da un rendimiento global de ciclo de
aproximadamente **35 %**. [I]

Ese 35 % no es el rendimiento de la turbina, que ronda el 90 %. Es el producto del
rendimiento de la máquina por la fracción del rango mareal que la estrategia de operación
realmente aprovecha. Hacer que el estudiante descubra esa diferencia es el objetivo
completo del módulo.

Nota de verificación pendiente: el área de 22 km² y la producción de 500 GWh/año no se
confirmaron contra fuente primaria. Deben verificarse antes de imprimirlas en material
docente.

### M8. Corriente mareal

```
P = ½ ρ Cp A V³
```

- Para eje horizontal, A = π D²/4.
- Cp real de turbinas axiales modernas: **0,40 a 0,50**. [V]
- Límite de Betz: **Cp,max = 16/27 = 0,5926**, idéntico para aire y agua porque no
  depende de la densidad. [V]

**Matiz que eleva el nivel del simulador.** Vennell y otros mostraron que turbinas en un
canal confinado pueden superar 16/27 referido a la velocidad no perturbada, porque el
bloqueo obliga al flujo a atravesar la turbina en vez de esquivarla. [V] El límite de
Betz no es universal para corrientes mareales confinadas. Es material de discusión
avanzada para semestres superiores.

**Comparación aire-agua, de una línea, que justifica toda la energía mareal:** [I]
La relación de densidades es 1.025/1,225 = **837**. A igualdad de área y de Cp, una
turbina eólica necesitaría viento a 3 · 837^(1/3) = **28,3 m/s** para igualar a una
mareal a 3 m/s.

**La media del cubo no es el cubo de la media.** El simulador debe integrar sobre la
serie temporal de velocidad, reconstruida por armónicos mareales:

```
V(t) = Σ_i A_i cos(ω_i t + φ_i)
```

Con las constituyentes M2 (12,42 h), S2 (12,00 h), N2, K1 (23,93 h) y O1. Con M2 y S2
basta para reproducir el ciclo de sicigia y cuadratura, que es lo pedagógicamente
importante. [I]

**Validación contra Orbital O2:** rotor de 20 m, A = π·10² = 314 m², con Cp = 0,40,
ρ = 1.025 y V = 3,0 m/s da **1,74 MW por rotor**. La máquina está nominada a 1 MW por
rotor, es decir alcanza su nominal por debajo de 3 m/s y recorta por encima. Coherente. [I]

### M9. Producción anual conforme a IEC

Es la salida principal del simulador, y la que define la norma IEC TS 62600-100 (olas) y
62600-200 (mareas). [V]

```
AEP = Σ_ij  ocurrencia(Hs_i, Te_j) · matriz_potencia(Hs_i, Te_j) · horas_año · disponibilidad
```

Multiplicación término a término de la matriz de ocurrencia por la matriz de potencia.
Trivial con NumPy y es el corazón matemático de cualquier simulador undimotriz serio. [I]

**Regla del pulgar del Handbook para contrastar el resultado**, con precisión declarada
de ±50 %: [L, cap. 1, §4.2]

```
AEP = J · ancho_absorbedor · η_w2w · disponibilidad · horas_año
```

Ejemplo del propio libro, para un absorbedor puntual optimizado en buen recurso: [L]

```
AEP = 40 kW/m · 15 m · 20 % · 95 % · 8.766 h = 999 MWh/año
```

que corresponde a 114 kW medios, con 750 kW instalados y un factor de planta del 15 %.

**Ese mismo cálculo rehecho con el recurso colombiano** es el ejercicio central del
proyecto: [I]

```
AEP = 8,9 kW/m · 15 m · 20 % · 95 % · 8.766 h = 222 MWh/año
```

Es decir, **cuatro veces y media menos energía por el mismo dispositivo y el mismo
coste**, solo por cambiar de sitio. Ese número, y no una animación bonita, es el
resultado que debe defenderse en la sustentación.

### M10. Economía

El Handbook da referencias de coste que el simulador debe usar como valores por defecto:
[L, cap. 1, §4.2]

- Eólica marina, granja de 1.000 MW a 30 m de profundidad: CAPEX aproximado de
  4 millones de euros por MW instalado, OPEX de unos 30 euros por MWh, LCOE de unos
  120 euros por MWh.
- CAPEX base (desarrollo, infraestructura y puesta en marcha, sin la máquina) de un
  aerogenerador marino de 3,6 MW: unos 7,2 millones de euros, aproximadamente el 45 %
  del CAPEX total.
- CAPEX base esperado para un WEC de 3,6 MW: algo menos, unos 6 millones de euros. Para
  un WEC de 750 kW: unos 2 millones de euros.

Y la conclusión que se deriva, que el simulador debe reproducir: con esos costes base, el
WEC pequeño tarda unos **13 años** en repagar solo su CAPEX base, mientras el grande
tarda unos **4 años**. [L] De ahí la regla: **los WEC tienen que ser grandes, del orden
de varios MW, para ser viables**, y multiplicar unidades pequeñas no sustituye a escalar,
porque no reparte el CAPEX base. [L]

Métricas de masa por potencia, para el mismo módulo: [I, calculadas sobre datos [V]]

| Dispositivo | Masa / potencia |
|---|---|
| Wavestar (1.000 t, 110 kW) | 9,1 t/kW |
| Wave Dragon comercial (22.000 t, 4 MW) | 5,5 t/kW |
| Minesto Dragon 12 (28 t, 1,2 MW) | 0,023 t/kW |
| Eólica marina, referencia | 0,1 a 0,2 t/kW |

El Handbook advierte, con razón, que esta relación puede ser engañosa si no se separa el
material estructural del lastre, porque la diferencia de coste entre ambos puede ser de
un factor 100. [L, cap. 1, §4.2]

**Comparador contra diésel en zona no interconectada.** Es el módulo que cierra la tesis
del proyecto: enfrentar el coste por MWh del dispositivo contra el del diésel en una isla
sin conexión al sistema interconectado.

---

## 5. Fichas de dispositivos reales

El simulador incluye fichas consultables. **Los fracasos son material docente tan valioso
como los éxitos** y deben marcarse como tales, con la causa.

### Undimotriz

| Dispositivo | Tipo | Nominal | Dato clave | Estado |
|---|---|---|---|---|
| Pelamis P2 | Atenuador | 750 kW | 180 m de largo, 4 m de diámetro, 1.350 t | Inactivo desde 2014 |
| Oyster 800 | OWSC | 800 kW | 10 m de profundidad, 0,5 km de la costa | Inactivo desde 2015 |
| CETO 6 | Absorbedor puntual sumergido | 1.500 kW | Boya de 20 m, generador dentro | Activo, despliegues cancelados |
| PowerBuoy PB40 | Absorbedor puntual | 40 kW pico | 130 t, 33,5 m, más de 45 m de profundidad | Repliegue a nicho |
| Wavestar | Multi-absorbedor | 110 kW | 1.000 t, flotadores de 5 m, brazos de 10 m | Retirado |
| Wave Dragon | Rebosamiento | 4 MW proyectados | 22.000 t de hormigón, embalse de 5.000 m³ | Nunca construido a escala |
| Mutriku | OWC en rompeolas | 296 kW | 16 turbinas Wells de 18,5 kW | **Activo desde 2011** |
| LIMPET Islay | OWC costera | 500 kW nominales | Rebajado a **250 kW** reales | Desmantelado 2011-2012 |

Fuente de todas las cifras: fichas PRIMRE, Tethys y EMEC, detalladas en
`investigacion_convertidores_marinos.md`. [V]

Dos datos que merecen pantalla propia:

- **Mutriku** es la planta undimotriz con más horas de operación del mundo, con factor de
  planta de 0,11 e índice de rendimiento de planta de 0,26. Funciona porque **el coste de
  la obra civil lo pagó el puerto**, no el proyecto energético. Es el argumento central
  para integrar OWC en infraestructura portuaria existente, y es directamente
  trasladable a Colombia. [V/I]
- **LIMPET** se rebajó de 500 a 250 kW nominales tras la reevaluación. La potencia de
  catálogo no es la potencia entregable. Todo el simulador se construye alrededor de esa
  distinción. [V/I]

### Mareomotriz

| Instalación | Tipo | Nominal | Dato clave | Estado |
|---|---|---|---|---|
| La Rance | Presa | 240 MW | 24 turbinas de bulbo, rango de 8 m, bidireccional con bombeo | **Activa desde 1966** |
| Sihwa Lake | Presa | 254 MW | 10 turbinas, **solo llenado**, sin bombeo | **Activa desde 2011** |
| Annapolis Royal | Presa | 20 MW | Cerrada por mortalidad de peces más falla técnica | Desmantelada 2019 |
| MeyGen | Corriente | 6 MW (fase 1A) | Más de 84 GWh acumulados, factor de planta del 21 % | Activo |
| SeaGen | Corriente | 1,2 MW | 11,6 GWh en toda su vida, 12 millones de libras | Desmantelado 2019 |
| Orbital O2 | Corriente flotante | 2 MW | Rotores de 20 m, brazos abatibles para mantenimiento | Activo |

El caso de **Annapolis Royal** debe presentarse completo, incluida la parte que no es
técnica: Nova Scotia Power intentó recuperar 27 millones de dólares canadienses de los
usuarios por la planta inactiva y perdió el primer intento ante el regulador. [V] Quién
paga el coste hundido de un activo varado es una pregunta central para un tecnólogo en
gestión de recursos energéticos, y no aparece en ningún simulador existente.

---

## 6. Datos precargados

### Emplazamientos colombianos

| Sitio | Recurso | Valor | Estado del dato |
|---|---|---|---|
| **Isla Fuerte (Bolívar)** | Oleaje | 8,9 kW/m medios, 78 MWh/m al año | [V] revisado por pares |
| Zona del chorro de bajo nivel del Caribe | Oleaje | 8 a 14 kW/m | [V] |
| Caribe, diciembre a abril | Oleaje | 5 a 7 kW/m | [V] |
| Caribe, temporada de lluvias | Oleaje | aproximadamente 1 kW/m | [V] |
| Costa del Atlántico | Oleaje | Serie mensual de Hs y potencia, 2016-2017 | [V] con reservas, ver abajo |
| San Andrés | Oleaje | Mayor densidad en la costa sureste; enero, febrero, junio, julio y diciembre por encima de 2 kW/m | [V] cualitativo, **sin cifra en kW/m** |
| Caribe colombiano | Rango mareal | **0,31 m medio**, 0,44 m en el percentil 95, 0,81 m máximo | [V] **medido**, ver abajo |
| Pacífico colombiano | Rango mareal | **3,28 m medio**, 4,63 m en el percentil 95, 5,15 m máximo | [V] **medido**, ver abajo |
| Bahía Málaga | Corriente mareal | 0,54 m/s máxima modelada | [V] |
| Buenaventura | Corriente mareal | 0,49 m/s máxima; 31,5 kWh/mes acumulados en el punto de mayor potencial | [V] |

**Rangos mareales medidos de fuente primaria.** Las dos cifras de rango de la tabla ya no
son citas de segunda mano. Salen de mareógrafos del IDEAM descargados el 25 de agosto de
2026 y procesados restando el mínimo del máximo de cada día: [V]

| Estación | Océano | Periodo | Días | Rango medio | Máximo |
|---|---|---|---|---|---|
| Escuela Naval CIOH, Cartagena | Caribe | 2016 a 2024 | 2.003 | **0,31 m** | 0,81 m |
| Buenaventura IDEAM | Pacífico | 2016 a 2024 | 1.643 | **3,28 m** | 5,15 m |

El contraste entre océanos, que es material de pantalla: 10,6 a 1 en rango y, por la
dependencia cuadrática, **112 a 1 en energía por unidad de área embalsada**. Frente a los
8 m de La Rance, el Caribe da (0,31/8)² = 0,0015, unas **670 veces menos**. La
especificación decía "unas 700 veces" con 0,30 m estimados; medido son 670 y la conclusión
no cambia. [I sobre dato V]

**Matiz importante sobre Buenaventura.** Los 4,2 m que circulaban para Buenaventura **no
son el rango medio, están cerca del de mareas vivas**: el medio medido es 3,28 m y el
percentil 95 es 4,63 m. Usar 4,2 m como valor típico sobreestima la energía de una presa
en un 64 %, porque (4,2/3,28)² = 1,64. El simulador debe cargar 3,28 m como valor por
defecto y ofrecer 4,63 m como escenario de sicigia. [I sobre dato V]

Dos advertencias que deben aparecer en pantalla junto al dato: el IDEAM etiqueta estas
series como **"Preliminar"**, nivel de aprobación 900, y no existe dato de nivel del mar
con aprobación definitiva 1200 para estas estaciones; y el cero del sensor no es el nivel
medio del mar, así que el dato sirve para rango, no para cota absoluta. Procedencia y
procedimiento completos en `fuentes_datos_ideam.md`.

**Restricción de área protegida.** Tres de los cinco emplazamientos candidatos están
dentro de áreas marinas protegidas y no son utilizables. El detalle está en el apartado
7.1; aquí basta con la consecuencia: solo Isla Fuerte y Tumaco quedan disponibles. [V]

**Emplazamiento por defecto: Isla Fuerte.** Es el único caso colombiano con cifras
publicadas y revisadas por pares, es zona no interconectada, tiene unos 2.000 habitantes
a 11 km del continente y depende de combustible fósil caro. Reúne el mejor dato y el
mejor argumento. [V/I]

**San Andrés queda como escenario secundario** hasta conseguir el texto completo de la
tesis de Uninorte. El resumen confirma que supera el umbral de 2 kW/m, pero no publica la
cifra de densidad de potencia, y el simulador no puede llevar un número inventado.

**Advertencia sobre la fuente del Atlántico.** El trabajo de 2017 sobre el Caribe
colombiano tiene una inconsistencia interna grave: sus tablas de datos diarios medidos
reportan alturas de 0,40 a 0,82 m, mientras las alturas significativas mensuales con las
que calcula la potencia van de 1,24 a 2,85 m, entre tres y cuatro veces mayores. [I]
Recomendación: cargarlo en el simulador **como ejercicio de crítica metodológica**, no
como fuente de valores de diseño.

### Conclusiones que los datos imponen y que el simulador debe hacer evidentes

1. **La energía mareomotriz de rango es físicamente inviable en el Caribe colombiano.**
   Con R = 0,30 m frente a los 8 m de La Rance, la energía por unidad de área embalsada
   es (0,30/8)² = 0,0014 veces, es decir **unas 700 veces menor**. [I] Es la mejor
   demostración posible de la dependencia cuadrática con el rango.
2. **Las corrientes del Pacífico central no soportan turbinas comerciales.** Con
   A = 1 m², Cp = 0,40 y ρ = 1.025: a 0,54 m/s la potencia es **32,3 W**; a 3,0 m/s es
   **5.535 W**. Una relación de 171 a 1 multiplicando la velocidad por 5,6. [I] Es la
   dependencia cúbica en una sola pantalla.
3. **Honestidad intelectual obligatoria:** el principal recurso oceánico del Caribe
   colombiano no es el oleaje sino el **gradiente salino**, con 15.157 MW estimados en la
   desembocadura del Magdalena, y cerca de San Andrés el gradiente térmico puede ser
   mejor opción que las olas. [V] Un módulo de contexto que diga esto es lo que separa un
   proyecto serio de un folleto.

---

## 7. Criterios de buena ubicación

El Handbook da una lista que el simulador debe convertir en un panel de puntuación del
emplazamiento: [L, cap. 1, §4.5]

- Contenido energético medio del oleaje superior a **15 kW/m**.
- Pendiente media del oleaje superior al **1,5 %**: el rendimiento de un WEC es mucho
  mayor en olas empinadas que en mar de fondo largo, porque los movimientos son más
  frecuentes y mayores.
- Baja relación entre altura máxima y altura media: se paga por soportar la ola de
  periodo de retorno de 100 años y se cobra por la ola media.
- Baja variación mensual del contenido energético, que mejora el factor de planta,
  aunque complica las ventanas de mantenimiento.
- Proximidad a la costa, a la infraestructura y al usuario final, que reduce mucho
  CAPEX y OPEX.
- Profundidad razonable, del orden de **30 a 60 m**, por coste de amarre y cable.

Aplicado a Isla Fuerte, el emplazamiento **falla el primer criterio** (8,9 frente a
15 kW/m) y **aprueba con holgura** el de proximidad a costa y usuario final. Que el
estudiante vea ese resultado mixto y tenga que argumentarlo es mejor ejercicio que darle
un sitio que apruebe todo. [I]

### 7.1 Criterio eliminatorio: área marina protegida

Los seis criterios anteriores puntúan. Este **no puntúa, descarta.** Un emplazamiento
dentro de un Parque Nacional Natural o de un Área Marina Protegida no admite una granja
undimotriz ni un parque de turbinas mareales por mucho que el recurso acompañe, y el panel
de emplazamiento debe mostrarlo antes que cualquier número de kW/m. [I]

Fuente: RUNAP, Registro Único Nacional de Áreas Protegidas de Parques Nacionales Naturales
de Colombia, capa ArcGIS pública consultable por intersección espacial. 1.908 áreas
protegidas, de las cuales 37 tienen superficie marina, 305.335 km² en total. [V] Detalle y
procedimiento en `areas_marinas_protegidas.md`.

Resultado para los cinco candidatos, con radio de 5 km: [V]

| Emplazamiento | Áreas protegidas que lo tocan | Veredicto |
|---|---|---|
| **Isla Fuerte** | ninguna | **Utilizable** |
| Tumaco | ninguna | Utilizable |
| Islas del Rosario | Corales del Rosario y de San Bernardo | **Descartado**, Parque Nacional Natural |
| Bahía Málaga | Uramba Bahía Málaga; La Sierpe | **Descartado**, Parque Nacional Natural |
| San Andrés | Seaflower; Jhonny Cay | **Restringido**, Área Marina Protegida |

Tres cosas que el simulador debe hacer visibles:

1. **Isla Fuerte es el único candidato que reúne el mejor dato y la viabilidad legal.**
   Refuerza la elección de emplazamiento por defecto con un argumento independiente del
   recurso.
2. **Bahía Málaga es la lección incómoda y por eso vale la pena mostrarla.** Es de donde
   sale la velocidad de corriente de 0,54 m/s que usa el módulo M8, y donde está el
   mareógrafo que da el rango mareal del Pacífico. El dato es bueno; el sitio no se puede
   usar. El mejor dato disponible no siempre está en un lugar utilizable, y un tecnólogo
   en gestión de recursos energéticos tiene que saber distinguir las dos cosas.
3. **La restricción ambiental es anterior al cálculo,** no un ajuste posterior. En el
   nivel Diseñar, seleccionar un emplazamiento descartado debe dejar correr el cálculo
   pero rotular el resultado como ejercicio teórico.

---

## 8. Rangos de validación de las entradas

Guardas para que el estudiante no pueda introducir valores absurdos sin recibir una
explicación. La aplicación **acota y explica**, nunca se cierra.

| Parámetro | Rango operativo | Nota |
|---|---|---|
| Altura significativa Hm0 | 0,5 a 4,0 m | Caribe colombiano: 0,5 a 2,5 m |
| Periodo energético Te | 4 a 12 s | Caribe: 5 a 8 s |
| Densidad de potencia | 2 a 60 kW/m | Umbral aprovechable citado: 2 kW/m |
| Profundidad | 10 a 100 m | Costero < 10, cercano a costa 10 a 25, mar adentro > 40 |
| Diámetro de boya | 2 a 20 m | CETO 6 llega a 20 m |
| Amortiguamiento de PTO | 10 a 500 kN·s/m | Óptimo cerca de B(ω) en resonancia |
| Carrera del PTO | ±1 a ±5 m | Límite duro de diseño |
| Rango mareal para presa | mínimo viable 5 m | La Rance: 8 m |
| Velocidad de corriente | mínimo viable 2,0 a 2,5 m/s | Pacífico colombiano: 0,28 a 0,54 m/s |
| Cp de turbina mareal | 0,40 a 0,50 | Betz: 0,5926 |
| Rendimiento de turbina de bulbo | 0,88 a 0,92 | Tecnología madura |

Invariantes físicos que las pruebas automatizadas deben comprobar en cada versión: [I]

1. La potencia capturada nunca supera la potencia incidente disponible.
2. El ancho de captura no supera λ/2π para un absorbedor puntual axisimétrico en arfada.
3. Cp nunca supera 16/27 en flujo libre, y si supera ese valor en canal confinado, la
   aplicación lo señala explícitamente en vez de permitirlo en silencio.
4. Todos los rendimientos quedan entre 0 y 1.
5. El balance de volumen del embalse cierra: el volumen turbinado más el desaguado
   iguala la variación de volumen almacenado.
6. El integrador no diverge al reducir el paso de tiempo.
7. La producción anual calculada por matriz de potencia y la calculada por la regla del
   pulgar del Handbook coinciden dentro del ±50 % que el propio libro declara.

---

## 9. Capa didáctica

### 9.0 Divulgación progresiva: cuatro niveles sobre un mismo núcleo

La aplicación abre siempre en el nivel visual. Los conceptos técnicos no desaparecen,
se destapan cuando el usuario los pide. Un conmutador de cuatro posiciones en la parte
superior cambia la piel, **nunca el cálculo**.

| Nivel | Qué muestra | Qué esconde | Salida principal |
|---|---|---|---|
| **Ver** | Animación del mar, la boya subiendo y bajando, el embalse llenándose. Tres controles en lenguaje corriente | Toda ecuación, todo símbolo, toda unidad técnica | "Alcanza para 14 casas" |
| **Comparar** | Dos tecnologías lado a lado, diagrama de Sankey, fichas de dispositivos reales | Las ecuaciones siguen ocultas | Cuánto se pierde en cada etapa |
| **Calcular** | Cada fórmula con los números ya sustituidos, unidades, fuente de cada constante | Nada | kW, kW/m, MWh/año |
| **Diseñar** | Resonancia, ancho de captura, límites teóricos, matriz de potencia, coste por MWh | Nada | AEP y coste por MWh |

**Condición innegociable: la animación tiene que estar movida por el modelo real.** La
superficie del mar se dibuja con η(x,t) = (Hm0/2)·cos(kx − ωt), usando el número de onda
k que devuelve el solucionador de la relación de dispersión. La boya se mueve con la ζ(t)
que sale de integrar la ecuación de movimiento. Si la animación fuera decorativa y los
números se calcularan aparte, sería un dibujo animado con una calculadora al lado, y en
la sustentación se nota. [I]

La ventaja de hacerlo bien es que **la resonancia se enseña sin escribir una sola
ecuación**: el estudiante mueve el control de "cada cuánto llega una ola" y ve a la boya
pasar de apenas moverse a saltar. Después, en el nivel Calcular, aparece la fórmula que
explica lo que ya vio.

Traducciones de vocabulario para el nivel Ver:

| Término técnico | Cómo se dice en el nivel Ver |
|---|---|
| Altura significativa Hm0 | Qué tan grandes son las olas |
| Periodo energético Te | Cada cuánto llega una ola |
| Amortiguamiento del PTO | Qué tan duro frena la boya |
| Densidad de potencia J | Fuerza del mar |
| Relación de ancho de captura | Cuánto aprovecha la boya |
| Producción anual (AEP) | Para cuántas casas alcanza |
| Rango mareal | Cuánto sube y baja el mar |

### 9.1 Elementos de la capa didáctica

Es lo que convierte una calculadora en una herramienta de enseñanza, y sin ella el
proyecto no cumple el objetivo de servir durante varios semestres.

1. **Ecuaciones a la vista con los números sustituidos.** Cada resultado muestra la
   fórmula y el reemplazo, no solo el valor. Sin esto no se aprende, solo se mira.
2. **Trazabilidad de cada constante.** Al pasar el cursor sobre un coeficiente aparece de
   dónde salió, con la referencia. Un simulador que no cita es un simulador que no se
   puede defender.
3. **Modo comparación**, mismo sitio y dos tecnologías en paralelo.
4. **Diagrama de Sankey** de la cadena de conversión completa.
5. **Exportación** a CSV y de figuras, para que los estudiantes las usen en sus informes.
6. **Escenarios guardados en JSON legible**, para que el trabajo de un semestre sea
   insumo del siguiente.
7. **Contraste permanente** contra un valor publicado, para que se vea que el modelo
   reproduce algo que alguien midió.
8. **Declaración de limitaciones en pantalla**, no escondida en un manual: oleaje
   omnidireccional, coeficientes hidrodinámicos de literatura, sin cálculo BEM.

---

## 10. Arquitectura de software

Principio: **el núcleo de física no sabe que existe la interfaz.** Esto permite que el
mismo código alimente las gráficas del informe, las pruebas automatizadas y la
aplicación, y que alguien añada la hidráulica en el futuro sin tocar nada.

```
simulador/
  nucleo/
    olas.py            teoría lineal, dispersión, espectros, momentos
    mareas.py          armónicos, serie temporal, ciclo sicigia-cuadratura
    hidrodinamica.py   masa añadida, radiación, excitación
    dispositivos/
      base.py          interfaz común: recurso → captura → PTO → eléctrico
      absorbedor.py
      owc.py
      embalse.py
      turbina_corriente.py
    pto.py
    integradores.py
    validacion.py      guardas e invariantes
  datos/
    sitios/*.json      un archivo por emplazamiento
    dispositivos/*.json
  analisis/
    aep.py             matriz de ocurrencia por matriz de potencia
    economia.py        CAPEX, OPEX, LCOE, comparador diésel
  interfaz/
    app.py, paneles.py, graficas.py, sankey.py
  pruebas/
```

Decisiones técnicas:

- **Interfaz:** PySide6 o PyQt6. La simulación corre en un hilo aparte con QThread y
  señales; **nunca en el hilo de la interfaz**, o la ventana se congela justo durante la
  sustentación. Es el riesgo técnico número uno del proyecto.
- **Cálculo:** NumPy y SciPy.
- **Gráficas:** Matplotlib embebido; PyQtGraph si se necesita animación fluida.
- **Cálculos conformes a IEC:** evaluar **MHKiT** como dependencia. Está en Python, es
  libre y desarrollado por Sandia, NREL y PNNL, e implementa los cálculos de la IEC TS
  62600-101 y 62600-100. No tiene sentido reimplementar espectros y momentos
  espectrales. [V]
- **Datos en JSON versionado**, uno por sitio y uno por dispositivo, para que los
  estudiantes añadan casos sin tocar el código.
- **Empaquetado con PyInstaller**, para distribuir un ejecutable sin instalar Python.
  Crítico si se usa en salas de cómputo con permisos restringidos, y resuelve la
  demostración en vivo del tercer corte.

---

## 11. Progresión por semestres

| Nivel | Módulos | Concepto central |
|---|---|---|
| Introductorio | M1, M5, fichas | Recurso, taxonomía, la energía se pierde en cada etapa |
| Intermedio | M7, M8, M9 | Modos de operación, dependencia cúbica, producción anual |
| Avanzado | M2, M3, M4 | Resonancia, límites de absorción, dimensionamiento |
| Proyecto final | M10 y todo | Un emplazamiento colombiano de principio a fin, con coste |

---

## 12. Correspondencia con la evaluación del curso

| Criterio de la rúbrica | Cómo lo cubre esta especificación |
|---|---|
| Creatividad y originalidad | Ningún simulador existente combina las dos familias, metodología IEC, economía, datos colombianos e interfaz en español |
| Calidad técnica, corte 2 (55 %) | El dispositivo se especifica como si fuera a construirse: dimensiones calculadas desde el recurso local, materiales, PTO, generador |
| Calidad técnica, corte 3 (70 %) | Ejecutable empaquetado, pruebas de invariantes físicos, operación estable en la demostración |
| Informe ICONTEC 1486 | Cada ecuación y cada cifra tiene fuente rastreable desde este documento |
| Sustentación | Las fichas de fracasos anticipan las preguntas difíciles del jurado |

---

## 13. Datos pendientes de verificar antes de usarlos como valores de diseño

1. Densidad de potencia en kW/m publicada para **San Andrés**. La tesis de Uninorte
   existe pero solo su resumen es accesible. Sigue abierto, aunque pierde urgencia: San
   Andrés está dentro del Área Marina Protegida Seaflower (apartado 7.1).
2. ~~Densidad de potencia para **Islas del Rosario**~~. **Cerrado el 25 de agosto de
   2026, por vía legal y no por vía de dato:** el emplazamiento está dentro del Parque
   Nacional Natural Corales del Rosario y de San Bernardo, así que la cifra es
   irrelevante para el simulador. [V]
3. Área del embalse de **La Rance** (se usó 22 km²) y su producción anual real (se usó
   500 GWh/año), ambas sin fuente primaria.
4. ~~Fuente primaria del rango mareal de **Buenaventura** (4,2 m)~~. **Resuelto el 25 de
   agosto de 2026:** estación BUENAVENTURA IDEAM (53119010), nivel máximo y mínimo diario
   de 2016 a 2024, 1.643 días completos. Rango medio **3,28 m**, percentil 95 de 4,63 m,
   máximo de 5,15 m. Los 4,2 m que circulaban **no son el rango medio sino uno cercano al
   de sicigia**, y usarlos como valor típico sobreestima la energía en un 64 %. [V]
   **Sigue abierto** el rango mareal de **Tumaco** (3,8 m), sin fuente primaria: no hay
   mareógrafo del IDEAM con serie de nivel allí.
5. Contradicción en el estudio del Pacífico central: velocidades máximas modeladas de
   0,54 m/s frente a menciones de corrientes por encima de 3 m/s en momentos extremos.
6. Rendimiento verificado de una cadena hidráulica de PTO real (se usó 0,65 a 0,80).
7. Los capítulos 7 a 10 del Handbook (amarres, PTO, ensayos y modelado ola-cable) no se
   extrajeron. El libro es de acceso abierto bajo Creative Commons
   (DOI 10.1007/978-3-319-39889-1) y puede descargarse completo de Springer.
8. **Todas las series de nivel del mar del IDEAM son "Preliminar" (900).** No existe dato
   con aprobación definitiva (1200) para ninguna estación mareográfica consultada. La
   decisión tomada es admitirlas y declararlo en pantalla, porque la alternativa es no
   tener rango mareal colombiano de fuente primaria. Conviene revisar si eso cambia.
9. **Hs y Tp para cualquier punto del Caribe colombiano.** El IDEAM no publica oleaje por
   ningún canal: ni por su API abierta ni por DHIME, cuyo catálogo de 25 variables se
   revisó completo. Las siete boyas de oleaje del catálogo de estaciones son de la DIMAR
   y del INVEMAR, y sus series no están disponibles. Vías pendientes: DIMAR o CIOH para
   las boyas, o reanálisis tipo ERA5 para serie sintética.

---

## 14. Fuentes principales

**Libros**

- Pecher, A. y Kofoed, J. P. (eds.), *Handbook of Ocean Wave Energy*, Springer, Ocean
  Engineering & Oceanography vol. 7, 2017. Acceso abierto,
  DOI 10.1007/978-3-319-39889-1. Capítulos usados: 1 (reglas del pulgar), 3 (recurso y
  formulación espectral, ecuaciones 9 a 22).
- Cruz, J. (ed.), *Ocean Wave Energy: Current Status and Future Perspectives*, Springer,
  2008. ISBN 978-3-540-74894-6. Capítulos relevantes: 5 (ensayo en laboratorio), 6 (PTO,
  turbinas de aire, generadores lineales, hidráulica, desalación), 7 (dispositivos a
  escala real), 8 (impacto ambiental).

**Normas**

- Serie IEC TS 62600, comité IEC TC 114. Partes prioritarias: 62600-101 y 62600-201
  (evaluación de recurso), 62600-100 y 62600-200 (desempeño y producción anual), 62600-1
  (terminología), 62600-30 (calidad de potencia), 62600-103 y 62600-202 (etapas de
  desarrollo).

**Fuentes de datos**

- IDEAM, nivel del mar. API abierta de datos.gov.co, conjunto `ia8x-22em`, y portal DHIME
  en `atencionciudadano.ideam.gov.co`. Detalle en `fuentes_datos_ideam.md`.
- RUNAP, Registro Único Nacional de Áreas Protegidas, Parques Nacionales Naturales de
  Colombia. Capa ArcGIS pública `pnn/runap`. Detalle en `areas_marinas_protegidas.md`.

Las series descargadas y los scripts que las regeneran están en `datos/`. El simulador lee
esos archivos y **nunca consulta la red en ejecución**: las series del IDEAM terminan en
2020 o 2024 y no crecen, así que una consulta en vivo no aportaría datos más frescos y sí
añadiría un punto de fallo durante la sustentación.

**Investigación web completa**

- `investigacion_convertidores_marinos.md`, en esta misma carpeta, con unas 50 fuentes
  con URL, cada afirmación etiquetada y doce vacíos registrados.
