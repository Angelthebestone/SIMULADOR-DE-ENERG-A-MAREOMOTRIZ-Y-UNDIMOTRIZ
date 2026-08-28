# Investigación: contenidos técnicos para un simulador educativo de energía undimotriz y mareomotriz

Documento de referencia para el diseño de una aplicación de escritorio en Python
destinada a estudiantes de Tecnología en Gestión de Recursos Energéticos (UTS).

Fecha de elaboración: 25 de agosto de 2026.

---

## 0. Convenciones de este documento

Cada afirmación relevante lleva una etiqueta:

- **[V]** verificado con fuente citada, con URL.
- **[G]** conocimiento general del campo, de libro de texto, sin fuente puntual verificada en esta búsqueda.
- **[I]** inferencia o cálculo propio a partir de datos etiquetados [V] o [G].

Cuando un dato no se encontró, se escribe **SIN DATO**.

Formato numérico en español: coma decimal y punto de miles.

---

## 1. Taxonomía de convertidores undimotrices

### 1.1 Clasificación EMEC por principio de captación

El European Marine Energy Centre (EMEC) reconoce ocho tipos principales de
convertidor de energía de las olas (WEC), más una categoría "otros". [V]

Fuente: https://www.emec.org.uk/marine-energy/wave-devices/

#### A) Atenuador (attenuator)

Definición EMEC: dispositivo flotante que opera **paralelo a la dirección del oleaje**
y efectivamente "cabalga" las olas. [V]

Captura energía del movimiento relativo entre sus brazos o secciones
a medida que la ola recorre su longitud. [V]

- Ejemplo canónico: Pelamis P1 y P2.
- Ventajas: baja carga estructural frente a un terminador, buena supervivencia
  porque se orienta con el oleaje, buen aprovechamiento por unidad de masa. [G]
- Desventajas: relación de ancho de captura muy baja (5 a 7 %), muchos grados de
  libertad y muchas juntas, cada junta es un punto de falla y de mantenimiento. [V/G]

#### B) Absorbedor puntual (point absorber)

Definición EMEC: estructura flotante que absorbe energía **desde todas las direcciones**
mediante su movimiento en la superficie o cerca de ella. Convierte el movimiento del
cuerpo boyante respecto a una base o reactor. [V]

- Dimensión horizontal pequeña frente a la longitud de onda incidente. [G]
- Ejemplos: CETO, PowerBuoy de OPT, CorPower, Seabased, Wavestar (multi-boya).
- Ventajas: geometría simple, insensible a la dirección del oleaje, escalable en
  granjas, es el tipo con más desarrollos activos. [G]
- Desventajas: ancho de captura pequeño en términos absolutos, requiere control para
  ampliar el ancho de banda, necesita una referencia (fondo marino, lastre inercial
  o segundo cuerpo) que introduce coste y modos de falla. [G]

#### C) Convertidor de oleaje oscilante por embate (OWSC, oscillating wave surge converter)

Definición EMEC: extrae energía del **embate** de la ola y del movimiento de las
partículas de agua dentro de ella. El brazo oscila como un péndulo montado sobre
una junta pivotante en respuesta al movimiento del agua. [V]

- Ejemplos: Oyster 1 y Oyster 800 de Aquamarine Power, WaveRoller.
- Se instala en aguas someras, típicamente 10 a 15 m, donde el movimiento
  horizontal de partículas es dominante. [V para Oyster: aproximadamente 10 m de
  profundidad y medio kilómetro de la costa]
  Fuente: https://openei.org/wiki/PRIMRE/Databases/Projects_Database/Devices/Aquamarine_Power_Oyster_800
- Ventajas: relación de ancho de captura la más alta de todas las familias
  (41 a 65 %). [V]
- Desventajas: sometido a cargas extremas de rompiente, cimentación costosa,
  cercanía a costa implica conflicto de usos y menor recurso. [G]

#### D) Columna de agua oscilante (OWC, oscillating water column)

Definición EMEC: estructura hueca parcialmente sumergida, abierta al mar por debajo
de la línea de flotación, que encierra una columna de aire sobre una columna de agua.
Las olas hacen subir y bajar la columna de agua, lo que comprime y descomprime el
aire. El aire atrapado fluye hacia y desde la atmósfera a través de una turbina que
normalmente puede girar independientemente del sentido del flujo de aire. [V]

- Ejemplos: Mutriku (España), LIMPET de Islay (Escocia), Pico (Azores).
- Puede ser fija (integrada en rompeolas o acantilado) o flotante (spar buoy).
- Ventajas: **ninguna pieza móvil en contacto con el agua de mar**, lo que reduce
  drásticamente la corrosión y el biofouling en el tren de potencia; permite
  integrarse en obra civil portuaria existente y compartir coste. [G]
- Desventajas: rendimiento global bajo, ruido, y la turbina autorrectificante es el
  cuello de botella. [G]
- CWR típica 15 a 40 %, ancho característico del orden de 30 m. [V]

#### E) Rebosamiento o terminador (overtopping / terminator)

Definición EMEC: captura agua cuando las olas rompen sobre una rampa, la almacena en
un embalse elevado y la devuelve al mar a través de una turbina hidráulica de baja
carga. Puede usar "colectores" (brazos reflectores) para concentrar la energía. [V]

- Ejemplos: Wave Dragon (flotante), TAPCHAN (fijo, Noruega), SSG.
- Ventajas: **desacopla la captación de la generación** mediante almacenamiento
  hidráulico, por lo que la potencia entregada es mucho más suave; usa turbinas
  Kaplan de bulbo de tecnología madura. [G]
- Desventajas: estructuras enormes y muy pesadas por kW instalado, CWR baja
  (4 a 23 %), longitud característica del orden de 300 m. [V]

#### F) Diferencial de presión sumergido (submerged pressure differential)

Definición EMEC: dispositivos típicamente cercanos a costa y anclados al fondo. El
movimiento de las olas hace subir y bajar el nivel del mar sobre el dispositivo,
induciendo un diferencial de presión. La presión alternante bombea fluido a través de
un sistema para generar electricidad. [V]

- Ejemplos: Archimedes Wave Swing (AWS), CETO en su configuración sumergida.
- Ventajas: al estar sumergido queda **protegido de las cargas de temporal** y es
  invisible desde la superficie, lo que reduce el impacto visual y el conflicto con
  la navegación. [G]
- Desventajas: acceso para mantenimiento caro, sellos y penetraciones sometidos a
  presión cíclica, atenuación exponencial de la presión con la profundidad. [G]

#### G) Onda de bulbo (bulge wave)

Definición EMEC: tubo de caucho lleno de agua, amarrado al fondo y orientado hacia el
oleaje. El agua entra por popa y la ola que pasa genera variaciones de presión a lo
largo del tubo, creando un "bulbo". El bulbo crece al viajar por el tubo, acumulando
energía que acciona una turbina de baja carga en proa, desde donde el agua vuelve
al mar. [V]

- Ejemplo: Anaconda (Checkmate SeaEnergy).
- Ventajas: sin partes metálicas móviles expuestas, muy bajo coste de material,
  tolerante a cargas extremas por su flexibilidad. [G]
- Desventajas: durabilidad del elastómero a fatiga, TRL bajo, ningún desarrollo
  comercial en operación. [G]

#### H) Masa rotatoria (rotating mass)

Definición EMEC: se usan dos formas de rotación para capturar energía a partir del
movimiento de arfada y deriva del dispositivo. El movimiento acciona bien un peso
excéntrico, bien un giroscopio cuya precesión se aprovecha. En ambos casos el
movimiento se acopla a un generador eléctrico **dentro** del dispositivo. [V]

- Ejemplos: Penguin de Wello, ISWEC.
- Ventajas: **casco completamente estanco y sellado**, sin penetraciones ni partes
  móviles expuestas al mar; es el argumento de fiabilidad más fuerte de la familia. [G]
- Desventajas: masa grande por kW, control complejo, TRL medio. [G]

#### I) Otros

Cubre diseños únicos o dispositivos de los que no se pudo determinar la
característica, por ejemplo el Wave Rotor, una turbina girada directamente por
las olas. [V]

### 1.2 Clasificación por ubicación

Tres categorías de uso estándar en la literatura. [G]

| Categoría | Profundidad orientativa | Distancia a costa | Recurso | Coste de instalación y cable |
|---|---|---|---|---|
| Costero (shoreline) | 0 a 10 m | En la línea de costa | El menor, muy atenuado | El menor |
| Cercano a costa (nearshore) | 10 a 25 m | Cientos de metros a 1 km | Intermedio | Intermedio |
| Mar adentro (offshore) | Más de 40 a 50 m | Kilómetros | El mayor, aguas profundas | El mayor |

Rangos orientativos [G]/[I]. La frontera entre nearshore y offshore no está
normalizada de forma única en la literatura.

Consecuencia física clave para el simulador: el recurso disminuye hacia la costa por
fricción de fondo, refracción y rotura, pero **la disponibilidad de la ola pierde
direccionalidad y se hace más predecible**, y el coste de amarre, cable y acceso cae
fuertemente. Esa tensión es exactamente lo que el estudiante debe poder explorar. [I]

### 1.3 Sistemas de toma de fuerza (PTO)

#### 1.3.1 PTO hidráulico

Cilindros hidráulicos resisten el movimiento y bombean fluido a alta presión a través
de acumuladores hacia motores hidráulicos que accionan generadores. [V, descripción
de Pelamis P2]
Fuente: https://openei.org/wiki/PRIMRE/Databases/Projects_Database/Devices/Pelamis_P2

- Ventajas: alta densidad de fuerza, permite adaptar fuerzas muy grandes a
  velocidades muy bajas, el acumulador **suaviza la potencia** entregada a red. [G]
- Desventajas: muchas etapas de conversión y por tanto pérdidas acumuladas, riesgo
  ambiental por fuga de aceite, mantenimiento de sellos, respuesta no lineal que
  complica el control óptimo. [G]
- Rendimiento típico de la cadena hidráulica completa: 0,65 a 0,80. [G] Verificar
  antes de publicarlo como dato duro.

#### 1.3.2 Generador lineal de accionamiento directo (direct drive)

El traslador del generador se acopla directamente al cuerpo oscilante, sin etapas
intermedias.

- Ejemplos: Seabased (Uppsala), CorPower en configuración con caja mecánica.
- Ventajas: menos etapas, menos pérdidas, sin fluidos, control de fuerza
  instantáneo que habilita **control reactivo y de latching**. [G]
- Desventajas: la máquina debe dimensionarse para fuerzas enormes a velocidades de
  0,5 a 2 m/s, lo que implica mucho imán permanente y mucho hierro; potencia muy
  pulsante que exige electrónica de potencia y almacenamiento intermedio. [G]

#### 1.3.3 Turbina de aire Wells

Turbina axial autorrectificante de perfiles simétricos que gira siempre en el mismo
sentido con flujo bidireccional.

- Uso real: Mutriku, 16 turbinas Wells de 18,5 kW cada una. [V]
  Fuente: https://en.wikipedia.org/wiki/Mutriku_Breakwater_Wave_Plant
- Uso real: LIMPET, dos turbinas Wells contrarrotantes acopladas cada una a un
  generador de inducción de 250 kW. [V]
  Fuente: https://en.wikipedia.org/wiki/Islay_LIMPET
- Rendimiento de operación típico citado: 50 a 55 %. [V]
  Fuente: https://journals.sagepub.com/doi/full/10.1177/1759313117693639
- Ventaja: simple, robusta, alta velocidad de giro y por tanto generador pequeño. [G]
- Desventaja crítica: **rango de operación estrecho**. Entra en pérdida
  aerodinámica (stall) por encima de cierto coeficiente de flujo, lo que obliga a
  válvulas de alivio y control de velocidad. [V]

#### 1.3.4 Turbina de aire de impulso

Turbina de acción con álabes directrices a ambos lados del rotor.

- Ventaja: **rango de coeficientes de flujo mucho más amplio** trabajando a
  rendimiento relativamente alto, lo que la hace mejor en oleaje irregular real. [V]
- Desventaja: rendimiento de pico más bajo, por debajo del 50 % en laboratorio,
  por pérdidas aerodinámicas en los álabes directrices aguas abajo. [V]
  Fuente: https://journals.sagepub.com/doi/full/10.1177/1759313117693639
- Compromiso: en varias plantas OWC la turbina de impulso da más energía anual pese
  a tener menor rendimiento de pico, porque el oleaje real pasa la mayor parte del
  tiempo fuera del punto de diseño. [V/I] Este es un excelente ejercicio de
  simulador: rendimiento de pico frente a energía anual.

#### 1.3.5 Turbina hidráulica de baja carga

Turbinas Kaplan o de bulbo trabajando con saltos de 1 a 3 m.

- Uso real: Wave Dragon (rebosamiento) y Oyster 800, que bombeaba agua a alta
  presión a tierra para accionar una **turbina hidroeléctrica convencional en
  tierra**. [V]
  Fuente: https://openei.org/wiki/PRIMRE/Databases/Projects_Database/Devices/Aquamarine_Power_Oyster_800
- Ventajas: tecnología madura, rendimiento alto (0,85 a 0,92), generación en tierra
  cuando se bombea agua a presión, lo que simplifica enormemente el mantenimiento. [G]
- Desventajas: requiere embalse o conducción, la carga disponible es muy variable,
  rendimiento cae fuera del punto de diseño. [G]

#### 1.3.6 Cuadro comparativo de PTO

| PTO | Fuerza / velocidad | Suavizado de potencia | Contacto con agua de mar | Madurez |
|---|---|---|---|---|
| Hidráulico | Muy alta fuerza, baja velocidad | Bueno (acumulador) | Sí, sellos | Alta |
| Generador lineal | Muy alta fuerza, baja velocidad | Malo, requiere electrónica | Sí | Media |
| Turbina Wells | Baja fuerza, alta velocidad | Malo | No | Alta |
| Turbina de impulso | Baja fuerza, alta velocidad | Malo | No | Media-alta |
| Turbina hidráulica baja carga | Media | Bueno (embalse) | Sí | Muy alta |

Tabla de síntesis propia. [I]

---

## 2. Taxonomía de convertidores mareomotrices

Hay dos familias físicamente distintas que el simulador **no debe mezclar**:
energía potencial por rango mareal, y energía cinética por corriente mareal. [G]

### 2.1 Rango mareal (energía potencial)

#### 2.1.1 Presa mareal (tidal barrage)

Dique que cierra por completo un estuario, con compuertas y turbinas de bulbo.

- Ejemplos: La Rance, Sihwa Lake, Annapolis Royal, Kislaya Guba, Jiangxia.
- Ventajas: tecnología hidroeléctrica madura, vida útil muy larga (La Rance lleva
  más de 55 años), generación **totalmente predecible** décadas por adelantado. [V/G]
- Desventajas: impacto ambiental severo por bloqueo del estuario, alteración del
  régimen sedimentario y de los hábitats intermareales, mortalidad de peces,
  inversión inicial enorme. [G] El caso de Annapolis Royal lo documenta. [V]

#### 2.1.2 Laguna mareal (tidal lagoon)

Dique que encierra un área de mar **sin cerrar un estuario**, construido total o
parcialmente separado de la costa.

- Ventaja principal frente a la presa: no interrumpe el flujo del río ni la
  migración de peces por el eje del estuario, y permite configuraciones de doble
  laguna con generación casi continua. [G]
- Desventaja: mucho más dique por unidad de área embalsada, por tanto peor coste. [G]
- Estado: **ningún proyecto de laguna mareal a escala comercial está en operación**
  a la fecha de este documento. Swansea Bay fue rechazado en 2018. [G] Verificar
  estado actual antes de afirmarlo en material docente.

#### 2.1.3 Modos de operación y cómo se calcula cada uno

Fuente general de los modos: revisión de generación por rango mareal.
https://pmc.ncbi.nlm.nih.gov/articles/PMC9660546/

**a) Vaciado (ebb generation).** El embalse se llena por gravedad durante la
pleamar con las compuertas abiertas; se cierran en la pleamar; se espera a que baje
el mar (holding); se turbina el embalse hacia el mar durante la bajamar. [V]

La secuencia típica es: retención en pleamar, generación en vaciado, generación en
vaciado con desagüe por compuertas, y desagüe en llenado. [V]

**b) Llenado (flood generation).** Simétrico: se vacía el embalse en bajamar y se
turbina el agua **hacia dentro** durante la subida.

Rinde menos que el vaciado en un estuario real porque al inicio del reflujo el área
intermareal es mayor y el nivel baja despacio, mientras que en el flujo el área es
menor y el nivel sube rápido; el ciclo de vaciado opera con una carga media más alta
y produce más energía. [V]
Fuente: https://pmc.ncbi.nlm.nih.gov/articles/PMC9660546/

Sihwa Lake es la excepción notable: opera **solo en llenado**, sin bombeo, por
razones de calidad de agua del embalse. [V]
Fuente: https://en.wikipedia.org/wiki/Sihwa_Lake_Tidal_Power_Station

**c) Bidireccional (two-way).** Genera en ambos sentidos. Requiere turbinas y obra
hidráulica diseñadas para flujo reversible. [V]

Produce durante más horas al día y reduce el pico de potencia, pero cada ciclo opera
con carga media menor, por lo que la energía anual total puede ser **inferior** a la
del vaciado puro. Es una compensación, no una mejora automática. [I]

**d) Con bombeo (pumping).** Se bombea agua adicional al embalse cerca de la pleamar,
cuando la diferencia de nivel es mínima, para turbinarla después con una carga mucho
mayor. La ganancia neta es positiva porque se bombea con poca carga y se turbina con
mucha. [G]

Es el análogo mareal del bombeo en centrales reversibles, y es el modo que mejor
ilustra el concepto de arbitraje energético. [I]

#### 2.1.4 Cálculo de energía por modo

Para todos los modos, el simulador debe integrar en el tiempo, no usar una fórmula
cerrada. El algoritmo estándar es: [V, descripción de la referencia]

Para cada paso de tiempo:
1. Determinar el estado (retención, compuertas, bombeo, generación).
2. Calcular la carga instantánea H(t) = |nivel del mar − nivel del embalse|.
3. Calcular el caudal Q(t) a través de turbinas y compuertas según su curva.
4. Calcular la potencia P(t) = ρ g Q(t) H(t) η(H, Q).
5. Actualizar el nivel del embalse por balance de volumen, usando la curva
   área-nivel A(h) del embalse.

Fuente del esquema: https://pmc.ncbi.nlm.nih.gov/articles/PMC9660546/

Este bucle de "0-D con curva área-nivel" es exactamente lo que debe implementarse en
el simulador: es simple, es físicamente correcto y produce todas las diferencias
entre modos de operación sin trucos. [I]

### 2.2 Corriente mareal (energía cinética)

Clasificación EMEC de dispositivos de corriente mareal, siete categorías. [V]
Fuente: https://www.emec.org.uk/marine-energy/tidal-devices/

#### A) Turbina de eje horizontal

Extrae energía del agua en movimiento del mismo modo en que una turbina eólica
extrae energía del aire en movimiento. La corriente hace girar los rotores alrededor
del eje horizontal. [V]

- Es la arquitectura **dominante**: MeyGen, SeaGen, Orbital O2, Andritz Hammerfest,
  Verdant Power.
- Ventajas: aprovecha directamente 40 años de aprendizaje eólico en aerodinámica,
  control de paso y trenes de potencia. [G]
- Desventajas: requiere orientación con el flujo (yaw o paso reversible), cavitación
  en la punta si la sumergencia es insuficiente, cargas de fatiga por turbulencia y
  por cizalladura vertical del perfil de velocidad. [G]

#### B) Turbina de eje vertical

Igual principio, pero el rotor gira alrededor de un eje vertical. [V]

- Ventajas: **omnidireccional**, no necesita orientarse; el generador puede ubicarse
  fuera del agua en configuraciones flotantes. [G]
- Desventajas: par muy pulsante, arranque pobre, rendimiento por debajo del eje
  horizontal, fatiga elevada. [G]

#### C) Hidroala oscilante (oscillating hydrofoil)

Un perfil hidrodinámico va montado sobre un brazo oscilante. La corriente que fluye
por ambas caras del ala genera sustentación. Ese movimiento acciona un fluido en un
sistema hidráulico que se convierte en electricidad. [V]

- Ejemplo real: Stingray, dispositivo de 150 kW ensayado frente a la costa escocesa
  en 2003. [V]
  Fuente: https://en.wikipedia.org/wiki/Stingray_tidal_stream_generator
- Ventaja: puede operar en **aguas muy someras** porque el área barrida es un
  rectángulo plano en vez de un círculo. [G]
- Desventaja: el programa Stingray se abandonó por coste; ningún desarrollo comercial
  en operación. [G]

#### D) Cometa mareal (tidal kite)

Cometa amarrada al fondo que lleva una turbina bajo el ala. La cometa "vuela" en la
corriente describiendo un ocho para **aumentar la velocidad del agua que atraviesa la
turbina**. [V]

- Ejemplo real: Minesto Dragon 12, 1,2 MW, envergadura de 12 m, 28 toneladas,
  conectado a red en Vestmanna (Islas Feroe) desde febrero de 2024. [V]
  Fuentes: https://minesto.com/products/kite-systems/dragon-12/
  y https://newatlas.com/energy/minesto-tidal-kite/
- Ventaja decisiva: al volar en trayectoria de ocho, la velocidad relativa del agua
  en la turbina es varias veces la velocidad de la corriente. Como la potencia va con
  el cubo de la velocidad, esto **habilita emplazamientos de baja velocidad** donde
  una turbina fija no sería viable. [V/I]
- Desventaja: sistema de control activo permanente, cable umbilical sometido a fatiga,
  riesgo de colisión. [G]

#### E) Efecto Venturi (enclosed tips)

El dispositivo se aloja en un conducto que concentra el flujo mareal que atraviesa la
turbina. El colector con forma de embudo se sitúa sumergido en la corriente. El flujo
puede accionar una turbina directamente, o el diferencial de presión inducido puede
accionar una turbina de aire. [V]

- Ventaja: aumenta la velocidad local y por tanto permite un rotor menor. [G]
- Desventaja: el conducto añade arrastre y coste; en la práctica el aumento neto de
  energía captada rara vez compensa. [G]

#### F) Tornillo de Arquímedes

Dispositivo helicoidal en forma de sacacorchos. Extrae potencia de la corriente al
moverse el agua a través de la espiral. [V]

- Ejemplo: Flumill.

#### G) Otros diseños

Diseños únicos o sin información suficiente para clasificarlos. [V]

---

## 3. Dispositivos reales con especificaciones numéricas

Los fracasos están marcados explícitamente porque son el material docente más
valioso de esta sección.

### 3.1 Undimotriz

#### Pelamis P2

| Parámetro | Valor | Etiqueta |
|---|---|---|
| Tipo | Atenuador | [V] |
| Potencia nominal | 750 kW | [V] |
| Longitud | 180 m | [V] |
| Diámetro | 4 m | [V] |
| Masa | aproximadamente 1.350 t | [V] |
| Secciones | 5 secciones unidas por juntas articuladas | [V] |
| PTO | Cilindros hidráulicos, acumuladores, motores hidráulicos, generadores | [V] |
| TRL estimado | 6 | [V] |
| Profundidad de operación | SIN DATO en la ficha PRIMRE | — |
| Estado | **Inactivo** | [V] |

Fuente: https://openei.org/wiki/PRIMRE/Databases/Projects_Database/Devices/Pelamis_P2

**Fracaso.** Pelamis Wave Power entró en administración (concurso) en noviembre de
2014. Wave Energy Scotland asumió la propiedad de sus activos y su propiedad
intelectual. [V]
Fuente: https://en.wikipedia.org/wiki/Pelamis_Wave_Power

Lección docente: era el WEC más avanzado del mundo, con dos generaciones de máquina y
clientes de utility (E.ON, ScottishPower). La causa fue económica, no física: coste
por MWh incompatible con el mercado y agotamiento de capital riesgo. Un dispositivo
puede funcionar y aun así fracasar. [I]

Dato físico revelador: **la máquina responde a la curvatura de la ola, no a su
altura**. Como la ola solo puede alcanzar cierta curvatura antes de romper, eso limita
el rango de movimiento que la máquina debe soportar en temporal, pero mantiene
movimiento amplio en las juntas con olas pequeñas. [V] Es un principio de diseño de
supervivencia muy elegante que merece una pantalla propia en el simulador.

#### Oyster 800 (Aquamarine Power)

| Parámetro | Valor | Etiqueta |
|---|---|---|
| Tipo | OWSC, aleta articulada boyante | [V] |
| Potencia nominal | 800 kW | [V] |
| Profundidad de instalación | aproximadamente 10 m | [V] |
| Distancia a costa | aproximadamente 0,5 km | [V] |
| PTO | Dos pistones hidráulicos que bombean agua a alta presión a tierra, donde acciona una turbina hidroeléctrica convencional | [V] |
| Expresión en superficie | No, la aleta está casi totalmente sumergida | [V] |
| TRL estimado | 6 | [V] |
| Ancho de la aleta | SIN DATO en las fuentes consultadas | — |
| Masa | SIN DATO en las fuentes consultadas | — |
| Estado | **Inactivo** | [V] |

Fuente: https://openei.org/wiki/PRIMRE/Databases/Projects_Database/Devices/Aquamarine_Power_Oyster_800

Predecesor: Oyster 1, de 315 kW. Aquamarine gastó más de 3 millones de libras en
Orkney y trabajó con más de 40 empresas locales. Oyster 800 se conectó a red en junio
de 2012 en el sitio de pruebas de Billia Croo del EMEC. [V]

**Fracaso.** Aquamarine Power entró en administración en octubre de 2015, no consiguió
comprador y cesó actividad en noviembre de 2015. [V]
Fuente: https://en.wikipedia.org/wiki/Aquamarine_Power

#### CETO 6 (Carnegie Clean Energy)

| Parámetro | Valor | Etiqueta |
|---|---|---|
| Tipo | Absorbedor puntual sumergido | [V] |
| Potencia nominal | 1.500 kW | [V] |
| Diámetro de la boya | aproximadamente 20 m | [V] |
| Expresión en superficie | No | [V] |
| PTO | Generador hidráulico alojado **dentro de la boya** | [V] |
| TRL estimado | 7 (actualizado en octubre de 2025) | [V] |
| Estado | **Activo** en desarrollo | [V] |
| Profundidad de operación | SIN DATO | — |
| Masa | SIN DATO | — |

Fuente: https://openei.org/wiki/PRIMRE/Databases/Projects_Database/Devices/Carnegie_Clean_Energy_CETO_6

**Fracaso parcial.** Los planes para desplegar un prototipo de CETO 6 en el sitio de
pruebas Wave Hub (Reino Unido) y después en Albany (Australia) fueron **cancelados**.
Carnegie sigue mejorando el diseño y buscando socios. Desde agosto de 2024 busca
certificación IECRE a través de Lloyd's Register. [V]
Fuente: la misma ficha PRIMRE

Nota histórica relevante: las generaciones CETO 3 y CETO 5 alimentaban una planta
desaladora además de la red, un caso de uso que conviene mostrar a estudiantes de
gestión de recursos energéticos porque cambia por completo la ecuación económica. [V]

#### PowerBuoy (Ocean Power Technologies)

**PB3:**

| Parámetro | Valor | Etiqueta |
|---|---|---|
| Potencia continua | 300 W nominal, dependiente del estado de mar | [V] |
| Potencia de pico | 7,2 kW (aproximadamente 1 hora al día) | [V] |
| Energía diaria típica | 8,4 kWh/día | [V] |
| Amarre | Punto único | [V] |

Fuente: https://oceanpowertechnologies.com/platform/opt-pb3-powerbuoy/

**PB40:**

| Parámetro | Valor | Etiqueta |
|---|---|---|
| Potencia de pico | 40 kW | [V] |
| Potencia media típica | 9 a 15 kW según emplazamiento | [V] |
| Masa | 130 t | [V] |
| Longitud | 110 pies, aproximadamente 33,5 m | [V] |
| Profundidad mínima de operación | 45 m o más | [V] |
| Estado | Desplegado frente a Nueva Jersey en 2015 | [V] |

Fuente: https://investors.oceanpowertechnologies.com/news-releases/news-release-details/photo-release-ocean-power-technologies-successfully-deploys-pb40

**Fracaso estratégico.** OPT llegó a proyectar máquinas de utility de 150 kW y
granjas comerciales (proyecto con Iberdrola, proyecto de Victoria en Australia). Todos
se cancelaron. La empresa **replegó su producto a boyas de vigilancia marítima y
alimentación de sensores**, un mercado de nicho donde compite contra diésel y baterías,
no contra la red eléctrica. [V/I]

Lección docente de primer orden: cuando un WEC no puede competir en €/MWh contra la
red, el camino de supervivencia es el mercado fuera de red, donde el competidor es un
generador diésel a 0,50 USD/kWh y no una central de ciclo combinado a 0,05 USD/kWh. [I]

#### Wavestar (Hanstholm, Dinamarca)

| Parámetro | Valor | Etiqueta |
|---|---|---|
| Tipo | Multi-absorbedor puntual sobre estructura fija | [V] |
| Prototipo instalado | 2 flotadores, 110 kW eléctricos nominales | [V] |
| Masa del prototipo | 1.000 t | [V] |
| Diámetro de cada flotador | 5 m | [V] |
| Longitud del brazo | 10 m | [V] |
| Profundidad de instalación | 6 a 8 m (8 m en patas delanteras, 6 m detrás) | [V] |
| Distancia a costa | aproximadamente 350 m de Hanstholm | [V] |
| Máquina comercial proyectada | 600 kW con 20 flotadores, 10 por lado | [V] |
| Estado | Prototipo retirado, empresa inactiva | [G] |

Fuente: https://tethys.pnnl.gov/project-sites/wave-star-hanstholm

Dato clave de diseño: el prototipo C5 está dimensionado para olas de "producción" de
hasta 3 m de altura significativa; por encima levanta los flotadores fuera del agua. [V]

Ese **modo de supervivencia por retirada mecánica** es una de las mejores ideas de la
energía undimotriz y debería estar en el simulador como opción conmutable: el
estudiante ve cómo la energía anual cae poco y el coste estructural cae mucho. [I]

Observación crítica: 1.000 toneladas para 110 kW nominales es 9,1 t/kW. [I] Comparar
con eólica marina, del orden de 0,1 a 0,2 t/kW. Esta relación masa/potencia es la
razón económica de fondo por la que la undimotriz no despega, y debe mostrarse
explícitamente. [I]

#### Wave Dragon

**Prototipo de Nissum Bredning (escala 1:4,5):**

| Parámetro | Valor | Etiqueta |
|---|---|---|
| Dimensiones | 57 × 27 m | [V] |
| Masa con lastre | 237 t | [V] |
| Conexión a red | Mayo de 2003 | [V] |
| Operación | 2003 a 2005, redesplegado en 2009 | [V] |

Fuente: https://vbn.aau.dk/ws/portalfiles/portal/51742663/Prototype_Testing_of_the_Wave_Energy_Converter_Wave_Dragon.pdf

**Unidad comercial proyectada para el Mar del Norte:**

| Parámetro | Valor | Etiqueta |
|---|---|---|
| Potencia instalada | 4 MW | [V] |
| Dimensiones | aproximadamente 150 × 260 m | [V] |
| Masa | 22.000 t de hormigón armado | [V] |
| Producción anual proyectada | hasta 12 GWh/año | [V] |
| Capacidad del embalse | 5.000 m³ | [V] |
| Gama de tamaños prevista | de 1,5 a 12 MW | [V] |
| Unidad atlántica proyectada | 7 MW | [V] |

Fuente: http://www.spok.dk/consult/wavedragon_e.shtml

**Fracaso.** Nunca se construyó ninguna unidad a escala comercial. El demostrador de
1,5 MW para el Mar del Norte (DanWEC) quedó en fase de diseño. [V/I]

Cálculo docente obligatorio: 22.000 t para 4 MW son 5,5 t/kW. [I] Con 12 GWh/año sobre
4 MW instalados, el factor de planta es 12.000 MWh / (4 MW × 8.760 h) = **34,2 %**. [I]
Ese factor de planta es respetable; el problema es la masa de hormigón por kW. Enseñar
las dos cifras juntas es la lección.

#### Planta OWC de Mutriku (España)

| Parámetro | Valor | Etiqueta |
|---|---|---|
| Tipo | OWC integrada en rompeolas portuario | [V] |
| Potencia total instalada | 296 kW | [V] |
| Número de turbinas | 16 turbinas Wells | [V] |
| Potencia por grupo | 18,5 kW turbina más generador | [V] |
| Número de cámaras de aire | 16 | [V] |
| Dimensiones de cada cámara | 4,5 m de ancho, 3,1 m de profundidad, 10 m de alto sobre la bajamar astronómica más baja | [V] |
| En servicio desde | 2011 | [V] |
| Producción acumulada | más de 3 GWh en 2024; más de 3,2 GWh reportados en marzo de 2025 | [V] |
| Factor de planta medio | aproximadamente 0,11 | [V] |
| Índice de rendimiento de planta | 0,26 | [V] |
| Estado | **Activo**, la planta undimotriz con más horas de operación del mundo | [V] |

Fuentes: https://en.wikipedia.org/wiki/Mutriku_Breakwater_Wave_Plant
y https://www.eve.eus/en/news/news/the-mutriku-wave-plant-achieves-cumulative-electricity-production-of-three-million-kilowatts-per-hour/
y https://www.sciencedirect.com/science/article/abs/pii/S0960148115001652

Comprobación propia: 296 kW × 8.760 h × 0,11 = 285 MWh/año. En 14 años eso da
aproximadamente 4 GWh, del orden de los 3,2 GWh reportados. [I] Coherente.

Mutriku es el mejor caso de estudio disponible porque **el coste de la obra civil lo
pagó el puerto**, no el proyecto energético. Es el argumento central para la
integración de OWC en infraestructura existente. [I]

#### LIMPET de Islay (Escocia)

| Parámetro | Valor | Etiqueta |
|---|---|---|
| Tipo | OWC costera, columna inclinada | [V] |
| Potencia nominal de diseño | 500 kW | [V] |
| Potencia real tras reevaluación | **250 kW** | [V] |
| Turbinas | Dos Wells contrarrotantes, cada una con generador de inducción de 250 kW | [V] |
| Conexión a red | Noviembre de 2000, primer dispositivo undimotriz comercial del mundo | [V] |
| Desmantelamiento | 2011 o 2012, según la fuente | [V] |

Fuente: https://en.wikipedia.org/wiki/Islay_LIMPET

**Fracaso instructivo.** La reducción de 500 a 250 kW es el dato más didáctico de todo
este informe: la potencia nominal de catálogo **no es la potencia entregable**. Todo
simulador educativo debe obligar al estudiante a distinguir entre potencia instalada,
potencia media y energía anual. [I]

Detalle de diseño: la columna de agua inclinada facilita la entrada y salida del agua,
reduce turbulencia y pérdidas, y aumenta el área de plano de agua de la columna para
una sección de cámara dada. [V]

### 3.2 Mareomotriz

#### La Rance (Francia)

| Parámetro | Valor | Etiqueta |
|---|---|---|
| Potencia nominal | 240 MW | [V] |
| Número de turbinas | 24 | [V] |
| Potencia unitaria | 10 MW con 5,65 m de salto | [V] |
| Diámetro de rodete | 5,35 m | [V] |
| Tipo | Turbina de bulbo, operación bidireccional con bombeo | [V] |
| Rango mareal | 8 m (medio); máximo del orden de 13,5 m | [V para 8 m] |
| Inauguración | 26 de noviembre de 1966 | [V] |
| Área del embalse | 22 km² | [G] Verificar antes de publicar |
| Estado | **Activa**, más de 55 años de operación | [V] |

Fuentes: https://en.wikipedia.org/wiki/Rance_Tidal_Power_Station
y https://tethys.pnnl.gov/sites/default/files/publications/La_Rance_Tidal_Power_Plant_40_year_operation_feedback.pdf

Existe un informe formal de retroalimentación de 40 años de operación, que es material
docente de primera calidad y está disponible en abierto en Tethys. [V]

#### Sihwa Lake (Corea del Sur)

| Parámetro | Valor | Etiqueta |
|---|---|---|
| Potencia nominal | 254 MW | [V] |
| Número de turbinas | 10 turbinas de bulbo sumergidas | [V] |
| Potencia unitaria | 25,4 MW | [V] |
| Modo de operación | **Solo llenado, sin bombeo** | [V] |
| Puesta en servicio | 2011 | [V] |
| Estado | **Activa**, la mayor central mareomotriz del mundo | [V] |

Fuente: https://en.wikipedia.org/wiki/Sihwa_Lake_Tidal_Power_Station

Superó en 2011 a La Rance, que había sido la mayor durante 45 años. [V]

Caso ambientalmente excepcional: el dique ya existía como obra de recuperación de
tierras y había degradado la calidad del agua del embalse. La central se construyó
**para forzar la renovación del agua** y de paso generar electricidad. El beneficio
ambiental fue el motor del proyecto. [V/I]
Fuente: https://blogs.adb.org/blog/how-sihwa-turned-tide-bespoiling-energy-plants

#### Annapolis Royal (Nueva Escocia, Canadá)

| Parámetro | Valor | Etiqueta |
|---|---|---|
| Potencia de pico | 20 MW | [V] |
| Puesta en servicio | 1984 | [V] |
| Cierre | Abril de 2019 | [V] |
| Desmantelamiento | 2019 | [V] |

Fuente: https://en.wikipedia.org/wiki/Annapolis_Royal_Generating_Station

**Fracaso doble.** Se cerró tras dos causas concurrentes: [V]
1. El Canadian Science Advisory Secretariat determinó **mortalidad sustancial de peces
   causada por la turbina**.
2. Falló un componente crítico del sistema de generación.

Nova Scotia Power intentó recuperar 27 millones de dólares canadienses de los usuarios
por la planta inactiva y perdió el primer intento ante el regulador. [V]
Fuente: https://www.cbc.ca/news/canada/nova-scotia/n-s-power-loses-1st-bid-to-get-27m-from-customers-for-idled-annapolis-plant-1.6313798

Lección docente triple: impacto ambiental real y cuantificado, riesgo técnico de final
de vida, y **quién paga el coste hundido de un activo varado**. La tercera es la más
importante para un tecnólogo en gestión de recursos energéticos. [I]

#### MeyGen (Pentland Firth, Escocia)

| Parámetro | Valor | Etiqueta |
|---|---|---|
| Fase 1A | 6 MW | [V] |
| Configuración | Cuatro turbinas de 1,5 MW | [V] |
| Emplazamiento | Inner Sound, Pentland Firth | [V] |
| Fase de operación | 25 años, iniciada en abril de 2018 | [V] |
| Generación acumulada | más de 84 GWh a noviembre de 2025 | [V] |
| Estado | **Activo**, el mayor emplazamiento de corriente mareal del mundo | [V] |

Fuentes: https://tethys.pnnl.gov/project-sites/meygen-tidal-energy-project
y https://www.emec.org.uk/offshore-operations-at-meygens-tidal-array/

Cálculo propio de factor de planta: de abril de 2018 a noviembre de 2025 hay
aproximadamente 7,6 años. Energía teórica a plena carga: 6 MW × 8.760 h × 7,6 =
399 GWh. Factor de planta medio de todo el periodo: 84 / 399 = **21 %**. [I]

Ese 21 % incluye periodos largos con turbinas retiradas para mantenimiento; el factor
de planta instantáneo cuando las cuatro operan es sustancialmente mayor. Es un buen
ejercicio de distinción entre disponibilidad y factor de planta. [I]

#### SeaGen (Strangford Lough, Irlanda del Norte)

| Parámetro | Valor | Etiqueta |
|---|---|---|
| Potencia nominal | 1,2 MW | [V] |
| Configuración | Dos rotores de 600 kW sobre un monopilote | [V] |
| Inversión | 12 millones de libras | [V] |
| Energía exportada en toda su vida | más de 11,6 GWh | [V] |
| Desmantelamiento | Julio de 2019, primer desmantelamiento completo de la industria | [V] |

Fuente: https://saerenewables.com/meygen-operational-update-3-2/

Cálculo propio: 11,6 GWh sobre 12 millones de libras son 1,03 £/kWh solo de CAPEX
amortizado, sin contar operación. [I] Es un dato brutal y honesto que conviene mostrar:
los primeros de su clase son carísimos por definición, y eso no invalida la tecnología,
pero sí explica por qué el despliegue es lento.

Nota: SeaGen fue el primer dispositivo de corriente mareal conectado a red a escala
comercial en el mundo, en 2008. [G]

#### Orbital O2 (EMEC, Orkney)

| Parámetro | Valor | Etiqueta |
|---|---|---|
| Potencia nominal | 2 MW, dos turbinas de 1 MW | [V] |
| Longitud de la plataforma | 74 m, superestructura cilíndrica flotante de acero | [V] |
| Diámetro de rotores | 20 m, área barrida total 600 m² | [V] |
| Patas | 18 m de longitud | [V] |
| Masa de cada góndola | 100 t | [V] |
| Profundidad de los rotores | 14 m | [V] |
| Masa total | 680 t | [V] |
| Despliegue | 2021 en EMEC | [V] |
| Estado | **Activo** | [V] |

Fuentes: https://www.emec.org.uk/press-release-orbital-marine-power-unveil-design-for-orbital-o2-tidal-turbine/
y https://tethys.pnnl.gov/project-sites/orbital-marine-power-o2-emec

Innovación central: al ser **flotante con brazos abatibles**, todo el tren de potencia
se puede subir a superficie para mantenimiento sin barcos de buceo ni grúas pesadas.
Eso ataca directamente el mayor coste operativo de la corriente mareal. [V/I]

Comprobación de coherencia con la ecuación de potencia: para un rotor de 20 m de
diámetro, A = π · 10² = 314 m². Con ρ = 1.025 kg/m³, Cp = 0,40 y V = 3,0 m/s:
P = 0,5 · 1.025 · 0,40 · 314 · 3,0³ = 1,74 MW por rotor. [I]
La máquina está nominada a 1 MW por rotor, es decir, alcanza su nominal por debajo de
3 m/s y recorta por encima. Coherente. [I]

#### Minesto Dragon 12 (Islas Feroe)

| Parámetro | Valor | Etiqueta |
|---|---|---|
| Potencia nominal | 1,2 MW | [V] |
| Envergadura del ala | 12 m | [V] |
| Masa | 28 t | [V] |
| Emplazamiento | Vestmanna, Islas Feroe | [V] |
| Conexión a red | Febrero de 2024 | [V] |
| Estado | **Activo** | [V] |

Fuentes: https://minesto.com/products/kite-systems/dragon-12/
y https://newatlas.com/energy/minesto-tidal-kite/

28 t para 1,2 MW son 0,023 t/kW. [I] Compárese con las 9,1 t/kW de Wavestar. Es la
comparación más contundente del informe entre undimotriz y mareomotriz.

### 3.3 Resumen de fracasos y sus causas

| Dispositivo | Año del fin | Causa dominante |
|---|---|---|
| Pelamis P2 | 2014 | Económica: coste por MWh, agotamiento de capital [V] |
| Aquamarine Oyster 800 | 2015 | Económica: sin comprador, cese de actividad [V] |
| CETO 6 en Wave Hub y Albany | Cancelados | Económica y de financiación [V] |
| Wave Dragon comercial | Nunca construido | Económica: masa de hormigón por kW [I] |
| LIMPET | 2011-2012 | Técnica: potencia real la mitad de la nominal [V] |
| PowerBuoy de utility | Repliegue | Estratégica: cambio a mercado de nicho [V/I] |
| Annapolis Royal | 2019 | Ambiental (mortalidad de peces) más falla técnica [V] |
| SeaGen | 2019 | Fin de programa de demostración, coste unitario altísimo [V/I] |
| Stingray | 2003 | Económica, programa abandonado [G] |

Patrón que el simulador debe hacer visible: **casi ningún fracaso fue por física
imposible**. Fueron fallos de coste, de disponibilidad y de acceso al capital. Por eso
un simulador educativo que solo calcule potencia hidrodinámica enseña la mitad
equivocada del problema. [I]

---

## 4. Ecuaciones de gobierno y rangos de parámetros

### 4.1 Potencia del oleaje por metro de frente en aguas profundas

Fórmula estándar: [V]

```
P = (ρ g² / (64 π)) · Hm0² · Te
```

donde:
- P es el flujo de energía por unidad de longitud de cresta, en W/m.
- ρ es la densidad del agua de mar, en kg/m³.
- g es la aceleración de la gravedad, en m/s².
- Hm0 es la altura significativa espectral, en m.
- Te es el periodo energético, en s.

Fuente de la forma de la ecuación:
https://www.mdpi.com/2227-9717/11/7/2221

**Origen de la constante.** La constante 1/(64π) proviene de tres pasos: [G]

1. Densidad de energía por unidad de área en teoría lineal de Airy:
   E = (1/8) ρ g H², con H la altura de ola monocromática.
2. Para un mar irregular, con Hm0 la altura significativa espectral, esa densidad se
   escribe E = (1/16) ρ g Hm0².
3. En aguas profundas la energía viaja a la velocidad de grupo cg = g Te / (4π).
   El flujo de energía es P = E · cg = (1/16) ρ g Hm0² · g Te / (4π) = ρ g² Hm0² Te / (64π).

**Valor numérico de la constante.** Cálculo propio: [I]
Con ρ = 1.025 kg/m³ y g = 9,81 m/s²:

```
ρ g² / (64 π) = 1.025 · 96,2361 / 201,0619 = 490,6 W/(m · m² · s)
```

Por tanto, con Hm0 en metros y Te en segundos:

```
P [kW/m] ≈ 0,49 · Hm0² · Te
```

Con agua dulce (ρ = 1.000) la constante baja a 0,479. Con ρ = 1.025 y g = 9,806 la
constante es 0,4903. La cifra "0,5" que circula en la literatura divulgativa es un
redondeo de esto. [I]

**Aviso metodológico importante.** Te no es lo mismo que el periodo de pico Tp ni que
el periodo medio Tz. La relación habitual para un espectro JONSWAP con γ = 3,3 es
Te ≈ 0,90 Tp. [G] El simulador debe pedir explícitamente cuál periodo introduce el
estudiante y convertir, porque confundirlos produce errores del 10 al 15 % en la
potencia. [I]

**Verificación con un caso real.** El paper del Caribe colombiano reporta, para una
altura significativa de 2,17 m, una potencia de frente de ola de 13,84 kW/m. [V]
Despejando: Te = 13,84 / (0,49 · 2,17²) = 6,0 s. [I] Consistente con la fórmula.

### 4.2 Relación de dispersión y su solución numérica

Relación de dispersión de la teoría lineal de ondas: [G]

```
ω² = g k tanh(k h)
```

donde ω = 2π/T es la frecuencia angular, k = 2π/λ el número de onda y h la
profundidad.

Casos límite: [G]
- Aguas profundas (k h > π, es decir h/λ > 0,5): tanh(kh) → 1, luego ω² = g k y
  λ = g T² / (2π) ≈ 1,56 T² metros.
- Aguas someras (k h < π/10, h/λ < 0,05): tanh(kh) → kh, luego c = √(g h).

**No tiene solución analítica cerrada en profundidad intermedia.** [G] Métodos para el
simulador:

**a) Iteración de punto fijo.** Reescribir k = ω² / (g tanh(k h)) e iterar desde
k0 = ω²/g. Converge siempre, con orden lineal. Simple y robusto, adecuado para código
educativo. [G]

**b) Newton-Raphson.** Definir f(k) = g k tanh(kh) − ω², con
f'(k) = g tanh(kh) + g k h sech²(kh). Converge en 3 a 5 iteraciones desde
k0 = ω²/g cuando el agua es profunda o intermedia, y desde k0 = ω/√(gh) cuando es
somera. Convergencia cuadrática. [G]

**c) Aproximación explícita de Eckart.** k ≈ (ω²/g) / √(tanh(ω² h / g)). Error del
orden del 5 % en el peor caso, útil como valor inicial. [G]

**d) Aproximación explícita de Guo (2002) o de Hunt (1979).** Error por debajo del
0,1 %, sin iteración. [G]

Recomendación para el simulador: implementar Newton-Raphson con arranque de Eckart y
tolerancia de 1e-10, y **mostrar en pantalla el número de iteraciones**. Es una
oportunidad didáctica de métodos numéricos regalada. [I]

### 4.3 Ecuación de movimiento de un absorbedor puntual en arfada

Modelo lineal de un grado de libertad en el dominio de la frecuencia (formulación
estándar de Falnes y de Cummins): [G]

```
[m + A(ω)] ζ̈(t) + [B(ω) + B_pto] ζ̇(t) + [K_h + K_pto] ζ(t) = F_e(t)
```

Términos:

| Símbolo | Nombre | Significado físico |
|---|---|---|
| m | Masa del cuerpo | Masa estructural más lastre |
| A(ω) | Masa añadida | Inercia del agua arrastrada, depende de la frecuencia |
| B(ω) | Amortiguamiento por radiación | Energía que el cuerpo radía como olas al oscilar |
| K_h | Rigidez hidrostática | K_h = ρ g S_w, con S_w el área de plano de agua |
| B_pto | Amortiguamiento del PTO | Coeficiente de la fuerza resistente, F = B_pto · ζ̇ |
| K_pto | Rigidez del PTO | Término reactivo, positivo o negativo, del control |
| F_e(t) | Fuerza de excitación | Fuerza de las olas sobre el cuerpo fijo (Froude-Krylov más difracción) |

Para una boya cilíndrica de diámetro D, S_w = π D² / 4, luego K_h = ρ g π D² / 4. [G]

El Coastal Wiki plantea la misma ecuación de forma adimensional, con la disipación
escrita como b · M · ω · (dζ/dt) y la fuerza de PTO como b_pto · M · ω · (dζ/dt). [V]
Fuente: https://www.coastalwiki.org/wiki/Wave_energy_converters

La aproximación subóptima habitual es hacer la fuerza de PTO proporcional a la
velocidad del cuerpo: f_pto(t) = b_pto · v(t). [V, misma fuente]

**Potencia absorbida instantánea y media:** [G]

```
P(t) = B_pto · ζ̇(t)²
P_media = (1/2) B_pto · ω² · |ζ0|²   (para movimiento armónico de amplitud |ζ0|)
```

### 4.4 Condición de resonancia y de máxima captura

**Resonancia.** El cuerpo resuena cuando la reactancia total se anula: [G]

```
ω_n = √( (K_h + K_pto) / (m + A(ω_n)) )
```

Nótese que A depende de ω, por lo que la ecuación es implícita y hay que resolverla
iterativamente. Sin control reactivo (K_pto = 0):

```
ω_n = √( ρ g S_w / (m + A(ω_n)) )
```

**Amortiguamiento óptimo del PTO sin control reactivo:** [G]

```
B_pto,óptimo = √( B(ω)² + [ ω (m + A(ω)) − K_h/ω ]² )
```

En resonancia el corchete se anula y se reduce a la condición de **acoplamiento de
impedancia**:

```
B_pto,óptimo = B(ω)
```

**Potencia máxima absorbible (condición de Falnes):** [G]

```
P_max = |F_e|² / (8 B(ω))
```

La mayor parte de la potencia producida por un WEC ocurre durante la absorción
resonante, cuando la fuerza de excitación está en fase con la velocidad del
dispositivo. Cuando el clima de oleaje no coincide con la resonancia estructural del
dispositivo, la potencia producida es significativamente menor. [V]
Fuente: https://www.coastalwiki.org/wiki/Wave_energy_converters

Consecuencia de diseño que el simulador debe hacer palpable: una boya de 5 m de
diámetro tiene un periodo natural en arfada del orden de 3 a 4 s, mientras que el
oleaje real está en 6 a 12 s. **Las boyas pequeñas están sistemáticamente fuera de
resonancia** y por eso necesitan control reactivo o rigidez negativa. [G/I]

### 4.5 Ancho de captura y relación de ancho de captura

**Ancho de captura** (capture width), en metros:

```
L = P_absorbida / P_ola
```

donde P_absorbida está en W y P_ola en W/m. Es la longitud de frente de ola cuya
energía completa equivale a la que el dispositivo captura. [G]

**Relación de ancho de captura** (capture width ratio, CWR), adimensional:

```
η = P_absorbida / (B · P_ola)
```

donde B es un ancho representativo del dispositivo, o su longitud en el caso de
atenuadores. [V]
Fuente: https://www.coastalwiki.org/wiki/Wave_energy_converters

**Límites teóricos:** [V]
- Absorbedor puntual axisimétrico oscilando en arfada: el ancho de captura máximo es
  **λ / 2π**. Establecido por Budal y Falnes (1975), Evans (1976) y Newman (1976).
- Arfada radía en el modo circular n = 0; deriva y cabeceo radían en el modo n = 1.
  Combinando arfada con deriva o cabeceo el máximo es la suma de ambos, es decir
  **3 λ / 2π**. [V/G]

Fuente: https://www.cambridge.org/core/journals/journal-of-fluid-mechanics/article/extending-limits-for-wave-power-absorption-by-axisymmetric-devices/FD2C7AD12B7BD51E364F75DF4A8DB47C

Cálculo ilustrativo: para T = 8 s en aguas profundas, λ = 1,56 · 64 = 99,9 m, luego
λ/2π = 15,9 m. **Una boya de 5 m de diámetro puede en teoría capturar la energía de
15,9 m de frente de ola**, es decir un ancho de captura tres veces su propio
diámetro. [I] Este resultado contraintuitivo es probablemente el concepto más potente
que un simulador undimotriz puede transmitir.

**Límite de Budal.** Impone una cota adicional por la restricción de volumen barrido
del cuerpo: [V]

```
η_Budal = π² D R / (a λ)
```

Fuente: https://www.coastalwiki.org/wiki/Wave_energy_converters

En la práctica, el límite de Budal es el que manda para dispositivos reales, porque el
límite λ/2π requiere amplitudes de movimiento físicamente imposibles. [G]

**Valores reales de CWR por tipo de dispositivo** (medidos en prototipos): [V]

| Tipo de dispositivo | CWR | Ancho o longitud característica |
|---|---|---|
| Columna de agua oscilante (OWC) | 15 a 40 % | B ≈ 30 m |
| Rebosamiento (overtopping) | 4 a 23 % | B ≈ 300 m |
| Absorbedor puntual | 3 a 42 % | B ≈ 5 a 20 m (los porcentajes bajos son de los pequeños) |
| OWSC | **41 a 65 %** | B ≈ 20 m |
| Flotante en cabeceo | 20 a 36 % | B ≈ 25 m |
| Atenuador | **5 a 7 %** | B ≈ 150 m |

Fuente: https://www.coastalwiki.org/wiki/Wave_energy_converters
citando a Babarit, "On the maximum and actual capture width ratio of wave energy
converters", EWTEC 2011.

Base de datos completa de CWR por dispositivo: Babarit (2015), "A database of capture
width ratio of wave energy converters", Renewable Energy. [V]
https://www.sciencedirect.com/science/article/abs/pii/S0960148115001652

Dato adicional de esa base: los OWSC flotantes tienen dimensión característica media
de 33 m y los grandes dispositivos de rebosamiento, de 124 m. [V]

Observación crítica para el simulador: **CWR alta no implica buena economía**. El
OWSC tiene la mejor CWR (hasta 65 %) y sin embargo Aquamarine quebró; el atenuador
tiene la peor (5 a 7 %) y Pelamis llegó más lejos comercialmente. La métrica que
decide es coste por MWh, no eficiencia hidrodinámica. [I] El simulador debe mostrar
ambas y dejar que el estudiante descubra la disociación.

### 4.6 Potencia de presa mareal

**Energía potencial por ciclo de vaciado o llenado:** [V]

```
E = (1/2) ρ g A R²
```

donde:
- A es el área horizontal del embalse, en m².
- R es el rango mareal (diferencia entre pleamar y bajamar), en m.
- ρ = 1.025 kg/m³ para agua de mar, g = 9,81 m/s².

Fuente: https://hydropower-tidalpower.blogspot.com/2009/07/energy-calculations_07.html

**Origen del factor 1/2.** A medida que el embalse se vacía a través de las turbinas,
la carga hidráulica sobre el dique disminuye. El factor 1/2 corresponde a usar la
altura media del volumen de agua, no la altura máxima. [V, misma fuente]

Es matemáticamente el mismo factor 1/2 de la energía de un resorte: se integra una
fuerza que decrece linealmente con el desplazamiento. [I]

**Potencia media:** [G]

```
P_media = E / T_ciclo
```

Con T_ciclo = 12,42 h = 44.712 s para una marea semidiurna, o 24,84 h para diurna.

En un régimen semidiurno hay dos pleamares y dos bajamares al día, luego la energía
teórica diaria en operación de vaciado puro es 2 E. [V]

**Energía anual realmente entregada:** [G]

```
E_anual = 2 · E · 706 ciclos/año · η_global
```

donde η_global agrupa el rendimiento de turbina, el de generador, el del
transformador y, sobre todo, el hecho de que nunca se turbina el rango completo.

**Ejemplo de cálculo con La Rance.** [I] Con A = 22 km² = 22 · 10⁶ m² [G, verificar],
R = 8 m [V], ρ = 1.025, g = 9,81:

```
E = 0,5 · 1.025 · 9,81 · 22·10⁶ · 8² = 7,08 · 10¹² J = 1,97 GWh por ciclo
```

Energía teórica anual con dos ciclos diarios: 1,97 · 2 · 365 = 1.435 GWh/año. [I]

La producción real declarada de La Rance ronda los 500 GWh/año [G, verificar cifra
exacta], lo que da un rendimiento global del ciclo de aproximadamente **35 %**. [I]

Ese 35 % es el número que el simulador debe hacer descubrir al estudiante. No es el
rendimiento de la turbina (que ronda el 90 %): es el producto de la turbina por la
fracción de rango mareal realmente aprovechada por la estrategia de operación. [I]

### 4.7 Potencia de turbina de corriente mareal

**Ecuación de potencia:** [V]

```
P = (1/2) ρ Cp A V³
```

donde:
- ρ = 1.025 kg/m³ (agua de mar), frente a 1,225 kg/m³ del aire.
- Cp es el coeficiente de potencia, adimensional.
- A es el área barrida del rotor, en m². Para eje horizontal, A = π D² / 4.
- V es la velocidad de la corriente, en m/s.

Fuente: https://www.sciencedirect.com/topics/engineering/power-coefficient

**Límite de Betz:** [V]

```
Cp,max = 16/27 = 0,5926
```

Es decir, un máximo del 59,3 % de la potencia cinética del fluido. El límite se deriva
de la conservación de masa y de cantidad de movimiento en un tubo de corriente de
sección libre, y **es idéntico para aire y para agua** porque no depende de la
densidad. [V/G]

Fuente: https://www.sciencedirect.com/science/article/abs/pii/S096014811200780X

**Valores reales de Cp:** turbinas axiales modernas alcanzan Cp de **0,40 a 0,50**. [V]
Misma fuente.

**Matiz importante que el simulador debe incluir.** Vennell y otros han mostrado que
turbinas mareales **en un canal** pueden tener coeficientes de potencia varias veces
superiores a 16/27, referidos a la velocidad no perturbada, porque el bloqueo del canal
fuerza al flujo a atravesar la turbina en vez de esquivarla. [V]
Fuente: https://www.sciencedirect.com/science/article/abs/pii/S096014811200780X

Es decir, el límite de Betz **no es un límite físico universal para corrientes
mareales confinadas**. Es un excelente punto de discusión avanzada, ideal para
estudiantes de semestres superiores.

**Comparación aire-agua.** La relación de densidades es 1.025/1,225 = 837. [I]
A igualdad de área y de Cp, para que una turbina eólica dé la misma potencia que una
mareal a 3 m/s necesita viento a 3 · 837^(1/3) = 3 · 9,42 = **28,3 m/s**. [I]
Ese cálculo es el argumento de una línea que justifica toda la energía mareal, y debe
aparecer en el simulador.

**Energía anual.** No basta con la velocidad media, porque P va con V³ y el promedio
del cubo no es el cubo del promedio. [G] El simulador debe integrar sobre la serie
temporal de velocidad, típicamente reconstruida por armónicos mareales:

```
V(t) = Σ_i  A_i cos(ω_i t + φ_i)
```

con las constituyentes M2 (12,42 h), S2 (12,00 h), N2, K1 (23,93 h), O1. [G]
Con M2 y S2 basta para reproducir el ciclo sicigia-cuadratura, que es la
característica pedagógicamente más importante de la marea. [I]

### 4.8 Rangos realistas de cada parámetro

Tabla de rangos para acotar los deslizadores del simulador y evitar que el estudiante
introduzca valores físicamente absurdos. [G] salvo donde se indique.

**Recurso undimotriz:**

| Parámetro | Rango operativo | Rango extremo | Nota |
|---|---|---|---|
| Altura significativa Hs | 0,5 a 4,0 m | hasta 15 m en temporal atlántico | Caribe colombiano: 0,5 a 2,5 m [V] |
| Periodo energético Te | 4 a 12 s | hasta 18 s en mar de fondo | Caribe: 5 a 8 s [V] |
| Periodo de pico Tp | 5 a 14 s | — | Te ≈ 0,90 Tp para JONSWAP γ = 3,3 |
| Densidad de potencia | 2 a 60 kW/m | hasta 100 kW/m (Atlántico norte) | Umbral mínimo explotable citado: 2 kW/m [V] |
| Profundidad de despliegue | 10 a 100 m | — | Costero < 10, nearshore 10 a 25, offshore > 40 |
| Diámetro de boya | 2 a 20 m | CETO 6 llega a 20 m [V] | Boyas comerciales: 5 a 12 m |
| Longitud de atenuador | 100 a 200 m | Pelamis P2: 180 m [V] | — |
| Amortiguamiento de PTO B_pto | 10 a 500 kN·s/m | depende fuertemente del tamaño | Óptimo cerca de B(ω) en resonancia |
| Carrera del PTO | ±1 a ±5 m | — | Límite duro de diseño |

**Rendimientos por etapa (undimotriz):**

| Etapa | Rendimiento típico |
|---|---|
| Captura hidrodinámica (CWR) | 0,05 a 0,65 según tipo [V] |
| PTO hidráulico | 0,65 a 0,80 |
| Turbina Wells | 0,50 a 0,55 [V] |
| Turbina de impulso | menos de 0,50 de pico, pero más ancho de banda [V] |
| Generador eléctrico | 0,90 a 0,95 |
| Electrónica de potencia | 0,95 a 0,97 |
| Transmisión y transformación | 0,95 a 0,98 |
| **Rendimiento de planta OWC medido en Mutriku** | **0,26** [V] |
| **Factor de planta de Mutriku** | **0,11** [V] |

**Recurso mareomotriz:**

| Parámetro | Rango operativo | Nota |
|---|---|---|
| Rango mareal para presa | mínimo viable 5 m; ideal más de 7 m | La Rance: 8 m medio [V] |
| Rango mareal Pacífico colombiano | 3 a 4 m [V] | Marginal para presa |
| Rango mareal Caribe colombiano | 0,20 a 0,30 m, rara vez más de 0,50 m [V] | Inviable para presa |
| Velocidad de corriente para turbina | mínimo viable 2,0 a 2,5 m/s; ideal más de 3 m/s | MeyGen y Pentland Firth |
| Velocidad de corriente Pacífico colombiano (modelo) | media 0,28 a 0,54 m/s; máxima 0,54 m/s [V] | Muy por debajo del umbral |
| Cp de turbina mareal | 0,40 a 0,50 [V] | Límite de Betz 0,593 [V] |
| Diámetro de rotor mareal | 10 a 20 m | Orbital O2: 20 m [V] |
| Profundidad para turbina mareal | 25 a 50 m | Restricción de sumergencia y cavitación |
| Rendimiento de turbina de bulbo | 0,88 a 0,92 | Tecnología hidroeléctrica madura |
| Rendimiento global de ciclo de presa | 0,30 a 0,40 | La Rance: aproximadamente 0,35 [I] |
| Área de embalse para presa | 10 a 100 km² | La Rance: 22 km² [G] |

---

## 5. Normas

### 5.1 Serie IEC TS 62600

Título general de la serie: **Marine energy - Wave, tidal and other water current
converters** (Energía marina: convertidores de olas, mareas y otras corrientes de
agua). Elaborada por el comité técnico **IEC TC 114**. [V]

La mayoría de las partes son **Especificaciones Técnicas (TS)**, no normas plenas.
Eso refleja la inmadurez de la industria: no hay consenso suficiente para una norma
IS. [I]

#### Partes generales

| Parte | Título | Edición | Cobertura |
|---|---|---|---|
| **62600-1** | Terminología (Terminology) | Ed. 2.0, 2020-06 | Define los términos relevantes de la energía marina [V] |
| **62600-2** | Sistemas de energía marina: requisitos de diseño | Ed. 2.0, 2019-10; Ed. 3 en elaboración | Requisitos de diseño de sistemas [V] |
| **62600-3** | Medición de cargas mecánicas | Ed. 1.0, 2020-05 | [V] |
| **62600-4** | Calificación tecnológica de sistemas de conversión de energía marina | Ed. 1.0, 2020-09; Ed. 2 en elaboración | [V] |
| **62600-10** | Evaluación del sistema de amarre de convertidores de energía marina | 2021 | Metodologías uniformes para diseño y evaluación de amarres de MEC flotantes, desde evaluación hasta diseño, instalación y mantenimiento [V] |
| **62600-30** | Calidad de potencia eléctrica | 2018 | Define las magnitudes que caracterizan la calidad de potencia de un convertidor de energía marina, y especifica métodos de medición, técnicas y pautas de interpretación de resultados [V] |
| **62600-40** | Caracterización acústica de convertidores de energía marina | Ed. 2 en elaboración | [V] |

Fuentes:
https://cdn.standards.iteh.ai/samples/102989/5a3d1ae0242c45be99b961a6ad876eab/IEC-TS-62600-1-2020.pdf
https://tethys-engineering.pnnl.gov/publications/iec-ts-62600-102021-part-10-assessment-mooring-system-marine-energy-converters-mecs
https://store.accuristech.com/standards/bs-pd-iec-ts-62600-30-2018

#### Serie 1xx: oleaje

| Parte | Título | Edición | Cobertura |
|---|---|---|---|
| **62600-100** | Convertidores de energía de las olas productores de electricidad: evaluación del desempeño de potencia | Ed. 1.0, 2012-08; **Ed. 2.0, 2024-11** | Método para estimar la producción media anual de energía (AEP) de un WEC, evaluando el desempeño de producción eléctrica de un WEC **individual, no en granja** [V] |
| **62600-101** | Evaluación y caracterización del recurso de energía de las olas | Ed. 1.0, 2015; **Ed. 2.0, 2024-12** | Evaluación del recurso undimotriz. Trabaja en conjunto con la 62600-100 [V] |
| **62600-102** | Evaluación del desempeño de un WEC en una segunda ubicación usando datos medidos | 2016 | Describe métodos y condiciones para determinar el desempeño del WEC 2 en la Ubicación 2, posiblemente a otra escala y con cambios de configuración, a partir del desempeño medido del WEC 1 en la Ubicación 1. Incorporada como anexos en la 62600-100 Ed. 2 de 2024 [V] |
| **62600-103** | Guía para el desarrollo en etapa temprana de WEC: buenas prácticas y procedimientos recomendados para el ensayo de dispositivos preprototipo | 2024 | Cubre el desarrollo a escala subprototipo. Incluye programas de ensayo en canal de olas, donde las condiciones se controlan y se programan, y las primeras pruebas en mar, donde los estados de mar ocurren naturalmente y los programas se ajustan a las condiciones [V] |
| **62600-104** | Guía para I+D de WEC pequeños o muy pequeños | En elaboración, PT 62600-104 | [V] |

Fuentes:
https://webstore.iec.ch/en/publication/66061
https://cdn.standards.iteh.ai/samples/103777/796ba9def512455ba4af218c8e19c3f7/IEC-TS-62600-101-2024.pdf
https://standards.globalspec.com/std/10037795/iec-ts-62600-102
https://standards.iteh.ai/catalog/standards/iec/9a7615f9-9c6a-436a-bf82-6440f21865a5/iec-ts-62600-103-2024

#### Serie 2xx: mareas

| Parte | Título | Edición | Cobertura |
|---|---|---|---|
| **62600-200** | Convertidores de energía mareal productores de electricidad: evaluación del desempeño de potencia | Ed. 1.0, 2013-05; Ed. 2 aprobada como DTS en 2025-07 | [V] |
| **62600-201** | Evaluación y caracterización del recurso de energía mareal | Ed. 1.0, 2015-04; **2025** | Establece un sistema para analizar y reportar, por estimación o medición directa, el recurso teórico de energía de corriente mareal en áreas oceánicas incluidos estuarios, aptas para la instalación de uno o más TEC [V] |
| **62600-202** | Desarrollo en etapa temprana de convertidores de energía mareal: buenas prácticas y procedimientos para el ensayo de dispositivos preprototipo a escala | 2022 | Especifica las etapas de desarrollo hasta escala preprototipo (Etapas 1 a 3). Incluye programas de ensayo en laboratorio hidráulico y las primeras pruebas del sistema escalado en aguas abiertas [V] |

Fuentes:
https://tethys-engineering.pnnl.gov/publications/iec-technical-specification-62600-2012025-part-201-tidal-energy-resource-assessment
https://webstore.iec.ch/en/publication/27906

#### Serie 3xx: ríos

| Parte | Título | Cobertura |
|---|---|---|
| **62600-300** | Convertidores de energía de ríos productores de electricidad: evaluación del desempeño de potencia | [V] |

Fuente: https://standards.globalspec.com/standards/detail?docId=13473092

#### Serie 2x: OTEC (gradiente térmico)

| Parte | Título | Estado |
|---|---|---|
| **62600-20** | Diseño y análisis de una planta OTEC: guía general | Ed. 2 en elaboración [V] |
| **62600-21** | Evaluación del desempeño de potencia de una planta OTEC | En elaboración [V] |
| **62600-22** | Evaluación del recurso para una planta OTEC | En elaboración [V] |

Fuente: https://www.iec.ch/dyn/www/f?p=103:23:::::FSP_ORG_ID,FSP_LANG_ID:1316,25

#### En elaboración a agosto de 2026

- **62600-11**: Manual de métodos de protección contra socavación (scour protection). [V]
- **62600-41**: Medición y caracterización de la acumulación de biofouling. [V]
- **62600-50**: Medición y caracterización de la turbulencia. [V]
- **TR 114-2**: Serie de normas y hoja de ruta para sistemas de conversión de energía
  marina (preliminary work item). [V]

Fuente: la misma página del dashboard del TC 114.

#### Qué partes importan para un simulador educativo

Priorización propia: [I]

1. **62600-101** y **62600-201**: definen cómo se caracteriza el recurso. Fijan qué
   variables debe pedir el simulador y con qué resolución temporal.
2. **62600-100** y **62600-200**: definen la **matriz de potencia** y la producción
   media anual (AEP). Es la salida principal que el simulador debe producir.
3. **62600-1**: terminología. El simulador debe usar los términos normalizados para
   que el estudiante los reconozca luego en la industria.
4. **62600-30**: calidad de potencia. Justifica una pestaña de "conexión a red".
5. **62600-103** y **62600-202**: describen las etapas de madurez (Etapas 1 a 5). Dan
   una narrativa de proyecto natural para un curso de varios semestres.

### 5.2 EMEC

El European Marine Energy Centre (Orkney, Escocia) es el centro de ensayos acreditado
de referencia mundial y el autor de la taxonomía de dispositivos usada en la sección 1
y 2 de este documento. [V]
https://www.emec.org.uk/marine-energy/wave-devices/
https://www.emec.org.uk/marine-energy/tidal-devices/

EMEC publicó, antes de la serie IEC, una colección de doce guías de buenas prácticas
para ensayo, evaluación de desempeño, seguridad, y evaluación de recurso, que fueron
la base directa de varias partes de la 62600. [G]

EMEC ofrece servicios de ensayo acreditados y certificación. [V]
https://www.emec.org.uk/services/accredited-services/

### 5.3 EquiMar

**EquiMar**: Equitable Testing and Evaluation of Marine Energy Extraction Devices in
terms of Performance, Cost and Environmental Impact. Proyecto del 7º Programa Marco de
la Comisión Europea. [V]

Objetivo: entregar un conjunto de protocolos para la evaluación equitativa de
convertidores de energía marina (de olas o de mareas), armonizando procedimientos de
ensayo y evaluación a través de la gran variedad de dispositivos existentes, con el fin
de acelerar la adopción mediante el emparejamiento tecnológico y una mejor comprensión
de los impactos ambientales y económicos asociados al despliegue de granjas. [V]

Cobertura de los protocolos: selección de emplazamiento, diseño de ingeniería del
dispositivo, escalado de diseños, despliegue de granjas, impacto ambiental (procesos
biológicos y costeros) y aspectos económicos. [V]

Consorcio de 23 socios de 11 países. [V]

Fuentes: https://www.equimar.org/
y https://tethys.pnnl.gov/sites/default/files/publications/EquiMar_D1.1.pdf

Los entregables están disponibles en abierto en Tethys y son directamente reutilizables
como material docente. [V/I]

### 5.4 Protocolos de evaluación de recurso: síntesis

Secuencia normalizada, sintetizada de la 62600-101 y 62600-201: [V/I]

1. **Clase de evaluación**: reconocimiento, factibilidad o diseño. Determina la
   exigencia de datos.
2. **Fuente de datos**: reanálisis, modelo numérico (SWAN, WW3 para olas; Delft3D,
   FVCOM, TELEMAC para mareas), medición in situ (boya direccional, ADCP).
3. **Validación**: contraste del modelo contra medición in situ o altimetría satelital.
4. **Caracterización**: matriz de ocurrencia bivariada Hs–Te para olas; distribución
   de velocidad y análisis armónico para mareas.
5. **Reporte**: densidad de potencia media anual, variabilidad estacional e
   interanual, direccionalidad, valores extremos con periodo de retorno.

El paso 4 es el que conecta directamente con el simulador: **la matriz de ocurrencia
Hs–Te multiplicada término a término por la matriz de potencia del dispositivo da la
producción media anual**. Esa multiplicación de matrices es el corazón matemático de
cualquier simulador undimotriz serio, y es sencilla de implementar con NumPy. [I]

---

## 6. Herramientas existentes

### 6.1 WEC-Sim

**Qué es.** Wave Energy Converter Simulator. Código abierto para simular convertidores
de energía de las olas, desarrollado en MATLAB/Simulink. [V]

**Qué hace:** [V]
- Modela dispositivos compuestos por cuerpos rígidos, juntas, sistemas de toma de
  fuerza y sistemas de amarre.
- Usa el resolvedor multicuerpo Simscape Multibody.
- Modela cuerpos rígidos y flexibles con modos generalizados.
- Simula en el dominio del tiempo resolviendo las ecuaciones de movimiento en los
  6 grados de libertad cartesianos más modos definidos por el usuario.
- Requiere como entrada datos hidrodinámicos de software de método de elementos de
  contorno (BEM), por ejemplo WAMIT, NEMOH o Capytaine.
- Acopla con controles, PTO y fuerzas externas.

Desarrollado por Sandia National Laboratories y NREL. [V]

Fuentes: https://wec-sim.github.io/WEC-Sim/main/introduction/overview.html
y https://github.com/WEC-Sim/WEC-Sim

**Qué NO cubre en el plano educativo:** [I]
- Requiere licencia de MATLAB más Simulink más Simscape Multibody. Es una barrera
  económica prohibitiva para un estudiantado de tecnología en Colombia.
- Requiere ejecutar previamente un código BEM para obtener A(ω), B(ω) y F_e(ω). El
  estudiante no puede simplemente "mover un deslizador y ver qué pasa".
- No tiene interfaz gráfica orientada a aprendizaje. La entrada es un script
  `wecSimInputFile.m`.
- No incluye economía: no calcula LCOE ni CAPEX ni OPEX.
- No incluye mareomotriz de rango. No simula presas ni lagunas.
- No enseña taxonomía ni contexto histórico.

### 6.2 MHKiT

**Qué es.** Marine and Hydrokinetic Toolkit. Software de código abierto de energía
renovable marina desarrollado en **Python y MATLAB**. [V]

**Qué hace:** [V]
- Módulos para ingesta, control de calidad, procesamiento, visualización y gestión de
  datos.
- Funcionalidad actual: desempeño de potencia, calidad de potencia, cargas mecánicas,
  herramientas de recurso y control de calidad de datos, para aplicaciones de oleaje,
  marea y río.
- **Los cálculos y las visualizaciones se ajustan a las especificaciones técnicas de
  la IEC.**

Desarrollado por Sandia, NREL y PNNL. [V]

Fuentes: https://mhkit-software.github.io/MHKiT/
y https://mhkit-software.github.io/MHKiT/overview.html

**Relevancia máxima para este proyecto.** MHKiT está en Python, es libre, e implementa
exactamente los cálculos de la IEC TS 62600-101 y 62600-100. Es la **dependencia
natural** del simulador propuesto: no hay razón para reimplementar el cálculo de
espectros, momentos espectrales, Hm0, Te y matrices de potencia. [I]

**Qué NO cubre en el plano educativo:** [I]
- Es una biblioteca, no una aplicación. No tiene interfaz de usuario.
- Es una herramienta de **análisis de datos medidos**, no de **diseño paramétrico**.
  No responde a "¿qué pasa si hago la boya más grande?".
- No contiene modelos dinámicos de dispositivo. No resuelve la ecuación de movimiento.
- No cubre energía mareomotriz de rango (presas y lagunas).
- No tiene economía.
- La documentación asume que el usuario ya sabe qué es un espectro direccional.

### 6.3 Otras herramientas abiertas

| Herramienta | Qué hace | Licencia | Limitación educativa |
|---|---|---|---|
| **NEMOH** | Código BEM de potencial de flujo. Calcula A(ω), B(ω), F_e(ω) | Abierta (École Centrale de Nantes) | Requiere mallado; salida numérica cruda [G] |
| **Capytaine** | Reimplementación moderna de NEMOH en Python | Abierta | Igual: es una biblioteca de bajo nivel [G] |
| **WAMIT** | BEM comercial de referencia | Comercial, caro | Inaccesible [G] |
| **SWAN** | Modelo espectral de oleaje en aguas someras | Abierta (TU Delft) | Requiere batimetría y campos de viento [G] |
| **Delft3D** | Modelo hidrodinámico. Usado en el estudio del Pacífico colombiano | Abierta | Curva de aprendizaje de semanas [V para el uso] |
| **OpenFAST** | Aeroelástico de eólica, con módulo hidrodinámico reutilizable | Abierta (NREL) | Orientado a eólica [G] |
| **Tethys / Tethys Engineering** | Bases de datos de conocimiento de energía marina de PNNL | Abierta | Es documental, no calcula [V] |
| **PRIMRE / Projects Database** | Base de datos de dispositivos y proyectos con fichas estructuradas | Abierta (DOE) | Es catálogo, no simulador [V] |
| **Marine Energy Atlas (NREL)** | Atlas de recurso marino de EE. UU. | Abierta | Solo cubre EE. UU. [G] |

### 6.4 Simuladores educativos existentes y sus limitaciones

**Aqua-RET (Aquatic Renewable Energy Technologies).** [V]

- Módulos de aprendizaje electrónico con herramientas multimedia para informar sobre
  las tecnologías de energía renovable marina existentes y cómo funcionan.
- Productos: módulos en línea o en CD-ROM, con pósteres educativos, cubriendo olas,
  eólica marina, corrientes, presa mareal, embalse y agua fluyente.
- Financiado por la UE a través del programa Leonardo da Vinci.
- Países participantes: Chipre, Grecia, Rumania, Escocia, Irlanda y Portugal.

Fuente: https://tethys.pnnl.gov/research-studies/aqua-renewable-energy-technologies-aqua-ret

Las animaciones de las categorías de dispositivo del EMEC provienen de Aqua-RET y son
descargables. [V]

**Limitación:** es material **explicativo**, no simulación. Muestra cómo funciona un
dispositivo, no permite calcular nada ni variar parámetros. [I]

**Recursos educativos de PRIMRE (DOE).** [V]
https://openei.org/wiki/PRIMRE/STEM/Resources/Educator_Resources
https://tethys.pnnl.gov/marine-renewable-energy-educational-resources

**Limitación:** son colecciones de enlaces, planes de clase y actividades de aula.
Orientado a educación secundaria en su mayoría. Nada en español. [I]

**Bancos de ensayo físicos (tipo Ocean Wave Simulator).** [V]
https://www.ecosenseworld.com/labs/ocean-wave-simulator

Canales de olas de laboratorio para experimentación. Excelentes pero requieren
inversión en hardware. [V]

### 6.5 El hueco que existe y que este proyecto puede llenar

Síntesis propia del análisis anterior. [I]

No existe, hasta donde alcanza esta búsqueda, una herramienta que combine
simultáneamente:

1. Interfaz gráfica de escritorio orientada a aprendizaje, con deslizadores y
   respuesta inmediata.
2. **Ambas** familias tecnológicas: undimotriz y mareomotriz (rango y corriente).
3. Cálculo conforme a la metodología IEC (matriz de potencia, AEP).
4. Módulo económico (LCOE, factor de planta, coste por MWh).
5. Datos de recurso de **Colombia** precargados.
6. Interfaz y documentación en **español**.
7. Software libre, sin licencias comerciales.

**SIN DATO** sobre la existencia de simuladores educativos de energía marina en
español. La búsqueda no encontró ninguno. Eso no prueba que no exista, pero sí que no
es fácilmente localizable. [I]

---

## 7. Recurso en Colombia

### 7.1 Recurso undimotriz en el Caribe colombiano

#### Contexto físico

El clima de oleaje del mar Caribe está controlado por un viento zonal del este que
alcanza 13 m/s, conocido como **Caribbean Low-Level Jet (CLLJ)** o chorro de bajo
nivel del Caribe. [V]

Fuente: https://www.sciencedirect.com/science/article/abs/pii/S0306261914010885
(Appendini y otros, Applied Energy, 2015)

#### Cifras de potencia del oleaje

| Zona | Densidad de potencia | Fuente | Etiqueta |
|---|---|---|---|
| Región de influencia del CLLJ | **8 a 14 kW/m** | Appendini y otros (2015) | [V] |
| Fuera del área de influencia directa del CLLJ | por debajo de 8 kW/m, **no apta** con las tecnologías existentes | Appendini y otros (2015) | [V] |
| Costa colombiana, valores medios | 3 a 7 kW/m, con "puntos calientes" por encima de 10 kW/m | Eelsalu, Montoya y Soomere | [V] |
| Caribe colombiano, diciembre a abril | **5 a 7 kW/m** (estación seca) | Osorio y otros | [V] |
| Caribe colombiano, temporada de lluvias | aproximadamente **1 kW/m** | Osorio y otros | [V] |
| **Isla Fuerte (Bolívar)** | **8,9 kW/m** de potencia media; **78 MWh/m al año** | Ortega y otros (2013), Renewable Energy 57, 240-248 | [V] |

Fuentes:
https://www.sciencedirect.com/science/article/abs/pii/S0306261914010885
https://papers.ssrn.com/sol3/Delivery.cfm/6fa04269-1d84-4a7d-8de3-7d2a6542a010-MECA.pdf?abstractid=5288606&mirid=1
https://www.sciencedirect.com/science/article/abs/pii/S0960148112007847
https://www.sciencedirect.com/science/article/abs/pii/S1364032115010278

**Comparación de referencia obligatoria.** Este potencial es pequeño comparado con
otros lugares del mundo, donde potencias del orden de **40 kW/m o más** se consideran
rentables para implementar granjas de olas. [V]
Fuente: https://www.sciencedirect.com/science/article/abs/pii/S1364032115010278

Este contraste (5 a 9 kW/m en Colombia frente a 40 kW/m de umbral de rentabilidad
convencional) es el dato más importante de toda la sección 7 y **debe estar en la
pantalla de inicio del simulador**. [I]

**Tendencia de largo plazo.** El flujo de energía del oleaje en el Caribe colombiano,
evaluado con 60 años de reanálisis, muestra una **disminución** de magnitud a largo
plazo, con tasa anual entre 0,01 y 0,2 %. [V]
Fuente: https://www.sciencedirect.com/science/article/abs/pii/S0960148121014087
(Orejarena-Rondón y otros, Renewable Energy 181, 2022)

#### Costa del departamento del Atlántico

Estudio: "Cuantificación del potencial energético undimotriz en las costas del Caribe
colombiano", Investigación e Innovación en Ingenierías, vol. 5, n.º 2, 2017. [V]
https://revistas.unisimon.edu.co/index.php/innovacioning/article/download/2758/3106

Potencial teórico cercano a costa (nearshore) en la costa del departamento del
Atlántico: aproximadamente **1.107 MW**. [V]

Tabla reportada de potencia de frente de ola: [V]

| Mes | Altura significativa (m) | Potencia (kW/m) |
|---|---|---|
| Enero 2016 | 2,17 | 13,84 |
| Febrero 2016 | 2,35 | 16,24 |
| Marzo 2016 | 2,55 | 19,12 |
| Abril 2016 | 1,36 | 5,44 |
| Mayo 2016 | 1,87 | 10,28 |
| Junio 2016 | 2,11 | 13,09 |
| Julio 2016 | 2,31 | 15,69 |
| Agosto 2016 | 1,80 | 9,53 |
| Septiembre 2016 | 1,24 | 4,52 |
| Octubre 2016 | 1,75 | 9,00 |
| Noviembre 2016 | 1,37 | 5,52 |
| Diciembre 2016 | 2,17 | 13,84 |
| Enero 2017 | 2,85 | 23,88 |

Datos de oleaje diario en dos puntos del Atlántico citados en el mismo trabajo: [V]

"El muelle": alturas de 0,40 a 0,71 m con periodos de 5,87 a 7,00 s.
"El bolsillo" (Pradomar): alturas de 0,44 a 0,82 m con periodos de 5,87 a 7,00 s.

**Advertencia crítica sobre esta fuente.** [I] Existe una **inconsistencia interna
grave** en ese trabajo: las alturas medidas que reporta en sus propias tablas de datos
diarios están entre 0,40 y 0,82 m, mientras que las alturas significativas mensuales
que usa para calcular potencia están entre 1,24 y 2,85 m, es decir, entre tres y cuatro
veces mayores. Además, el "potencial teórico" de 1.107 MW no está referido a ninguna
longitud de costa explícita en el extracto consultado.

Recomendación: usar esta referencia como ejemplo de contexto local y como **ejercicio
de crítica metodológica en clase**, no como fuente de valores de diseño. Los valores de
diseño deben tomarse de Appendini y otros (2015), Ortega y otros (2013) y
Orejarena-Rondón y otros (2022), que son revisados por pares en revistas de alto
impacto. [I]

#### San Andrés

**SIN DATO** de una cifra publicada específica de densidad de potencia undimotriz en
kW/m para San Andrés en las fuentes consultadas.

Lo que sí se encontró: [V]
- Existe un trabajo de la Universidad del Norte: "Evaluación del potencial para generar
  energía undimotriz en la isla de San Andrés (Colombia)".
  https://manglar.uninorte.edu.co/handle/10584/13051
  No se pudo acceder al texto completo en esta búsqueda.
- Existe una boya oceanográfica del CIOH en las cercanías de las islas de San Andrés y
  Providencia. [V]
- El resumen de ese trabajo indica que se observaron mayores concentraciones de
  densidad energética en la **costa sureste**, principalmente en enero, febrero, junio,
  julio y diciembre, con valores que **superan ampliamente el mínimo explotable de
  2 kW/m** citado a nivel mundial. [V]
- Régimen de marea en San Andrés: **mixta semidiurna**. [V]

Por su ubicación dentro del área de influencia del CLLJ, es razonable esperar valores
en el rango de 8 a 14 kW/m. [I] Confianza media. **Debe verificarse con el texto
completo del trabajo de Uninorte antes de usarse en material docente.**

#### Islas del Rosario

**SIN DATO** de densidad de potencia undimotriz en kW/m publicada específicamente para
Islas del Rosario.

Lo que sí se encontró: [V]
- Régimen de marea en Cartagena e Islas del Rosario: **mixta predominantemente
  diurna**.
- Rango mareal en el Caribe colombiano: entre **20 y 30 cm**, rara vez por encima de
  **50 cm**. Por eso la marea no es significativa como contribuyente a la variabilidad
  de las corrientes oceánicas de la zona. [V]

Conclusión directa: **la energía mareomotriz de rango es físicamente inviable en todo
el Caribe colombiano.** Con R = 0,30 m, la energía por ciclo es (0,30/8)² = 0,0014 veces
la de La Rance por unidad de área embalsada, es decir, 700 veces menor. [I] Este
cálculo debe estar en el simulador porque enseña de golpe la dependencia cuadrática
con el rango.

Nota: Isla Fuerte, con sus 8,9 kW/m verificados y su condición de zona no
interconectada (2.000 habitantes, a 11 km del continente, sin conexión al SIN, dependiente
de combustibles fósiles caros) [V], es **el mejor caso de estudio colombiano disponible**
para el simulador. Es análogo a Islas del Rosario en régimen de oleaje y sí tiene
cifras publicadas y revisadas por pares.

### 7.2 Recurso mareomotriz en el Pacífico colombiano

#### Rango mareal

| Ubicación | Rango o altura de marea | Fuente | Etiqueta |
|---|---|---|---|
| Pacífico colombiano, general | alturas de marea locales de **hasta 4 m** | Quintero y Rueda-Bayona, Inge CuC 2019 | [V] |
| Colombia, lado Pacífico | rango mareal de **3 a 4 m** | Osorio y otros, RSER 2016 | [V] |
| Puntos A, B, C y D (zona central), máximo en 2018 | **1,88 m** | Quintero y Rueda-Bayona, Inge CuC 2019 | [V] |
| Buenaventura | 4,2 m | Reportado en resultados de búsqueda, sin acceso a la fuente primaria | **Verificar** |
| Tumaco | 3,8 m | Reportado en resultados de búsqueda, sin acceso a la fuente primaria | **Verificar** |

Fuente principal: https://revistascientificas.cuc.edu.co/ingecuc/article/download/3202/4670

Nota sobre la aparente contradicción entre "hasta 4 m" y "máximo 1,88 m": la primera
cifra parece ser el rango mareal máximo (pleamar a bajamar) en sicigia, y la segunda,
la amplitud o el máximo modelado en los cuatro puntos concretos del estudio durante
2018. [I] Confianza media. Debe aclararse antes de usar cualquiera de las dos.

#### Corrientes mareales: estudio de referencia

**Quintero Aguilar y Rueda Bayona (2019), "Potencial de energía mareomotriz en la zona
central de la costa del Pacífico colombiano", Inge CuC.** [V]

Metodología: modelado hidrodinámico con **Delft3D**, validado con información medida
in situ. [V]

Resultados numéricos: [V]

| Punto | Ubicación | Velocidad máxima | Tiempo de velocidad mínima | Capacidad de generación diaria |
|---|---|---|---|---|
| A | Bahía Málaga | 0,54 m/s | 1 h | 22 h |
| B | Buenaventura | 0,49 m/s | 2 h | 20 h |
| C | (zona central) | 0,31 m/s | — | — |
| D | (zona central) | 0,28 m/s | — | — |

- Rango de velocidad media en los cuatro puntos: **0,28 a 0,54 m/s**. [V]
- Alturas máximas de marea en los cuatro puntos durante 2018: **1,88 m**. [V]
- Punto B (Buenaventura) registró el mayor potencial acumulado de generación eléctrica
  por mes: **31.546,56 Wh/mes**, es decir 31,5 kWh/mes. [V]
- Con **5 microturbinas mareales de eje horizontal reversible de 1 m² de área de
  barrido** en el punto de mayor potencial (B) es posible generar la electricidad
  necesaria para cubrir el consumo eléctrico de **una casa**. [V]
- Los mayores potenciales se encontraron en **Bahía Málaga (A) y Buenaventura (B)**. [V]
- Otra referencia citada en el mismo trabajo menciona **45 bahías posibles con un
  potencial energético estimado de 120.000 kW**. [V]
- La región tiene velocidades de corriente de **hasta 1,5 m/s**. [V]
- Hay puntos en Buenaventura y Bahía Málaga donde las corrientes superan los 3 m/s en
  momentos extremos. [V] Verificar, porque contradice los 0,54 m/s máximos del modelo
  del mismo estudio; probablemente se refiere a corrientes fluviales o a eventos
  puntuales, no a la corriente mareal media.

#### Lectura crítica obligatoria para el material docente

Las velocidades medias de 0,28 a 0,54 m/s están **muy por debajo del umbral de
viabilidad** de una turbina mareal comercial, que ronda los 2,0 a 2,5 m/s. [I]

Cálculo comparativo propio: [I]
- A 0,54 m/s con A = 1 m², Cp = 0,40, ρ = 1.025:
  P = 0,5 · 1.025 · 0,40 · 1 · 0,54³ = **32,3 W**.
- A 3,0 m/s con la misma turbina:
  P = 0,5 · 1.025 · 0,40 · 1 · 27 = **5.535 W**.

Una relación de **171 a 1** con solo multiplicar la velocidad por 5,6. Esa es la
dependencia cúbica, y es la lección física central de toda la energía cinética marina.

Conclusión operativa para Colombia: [I]
- Energía mareal de **rango** (presa o laguna): inviable en el Caribe (R = 0,2 a 0,3 m)
  y marginal en el Pacífico (R = 3 a 4 m, en el límite inferior de lo que se considera
  viable, que son 5 m).
- Energía mareal de **corriente**: los valores publicados para el Pacífico central
  (0,28 a 0,54 m/s medios) no soportan turbinas comerciales, pero sí microturbinas para
  aplicaciones aisladas de muy baja potencia.
- Energía **undimotriz**: 5 a 9 kW/m en el Caribe frente a 40 kW/m de referencia
  internacional. Marginal con tecnología actual, pero **competitiva frente al diésel en
  zonas no interconectadas** como Isla Fuerte, Islas del Rosario, San Andrés y
  Providencia.

Esa última frase es el argumento que da sentido a todo el proyecto y debe ser la tesis
del simulador. [I]

### 7.3 Otros recursos marinos colombianos, para contexto

| Recurso | Potencial | Ubicación | Etiqueta |
|---|---|---|---|
| Gradiente salino | **15.157 MW** | Desembocadura del río Magdalena | [V] |
| Gradiente salino | 187 MW | Río León, golfo de Urabá | [V] |
| Gradiente salino | 15,6 GW de potencial medio específico por sitio | Principalmente Magdalena | [V] |
| Gradiente térmico (OTEC) | Gradientes superiores a 20 °C todo el año a menos de 700 m; de 22 a 24 °C hasta 1.000 m, a menos de 2,5 km de la costa | **San Andrés** | [V] |

Fuentes:
https://www.sciencedirect.com/science/article/abs/pii/S1364032115010278
https://www.sciencedirect.com/science/article/abs/pii/S0960148114005448

Dato relevante para la honestidad intelectual del proyecto: en el Caribe colombiano,
**el gradiente salino es el principal recurso de energía oceánica**, no el oleaje. Y
cerca de San Andrés, el gradiente térmico puede ser mejor opción que las olas. [V]

Si el simulador va a incluir un módulo de "comparación de recursos marinos", este es el
dato que lo hace honesto. [I]

---

## 8. Qué debe contener el simulador: síntesis operativa

Esta sección es inferencia propia [I] construida sobre todo lo anterior.

### 8.1 Principio rector

El error de diseño más probable es construir una calculadora de potencia hidrodinámica.
Todos los fracasos documentados en la sección 3 fueron **económicos y operativos**, no
hidrodinámicos. Un simulador que solo calcule kW enseña el lado equivocado del problema.

La cadena completa que debe recorrer el estudiante es:

```
Recurso → Captura → PTO → Eléctrico → Disponibilidad → Energía anual → Coste por MWh
```

### 8.2 Módulos mínimos

**M1. Recurso.**
- Entrada de Hs, Te (o Tp con conversión explícita), profundidad, densidad.
- Cálculo de P = 0,49 Hs² Te con la constante mostrada y editable.
- Resolución de la relación de dispersión con Newton-Raphson, mostrando iteraciones.
- Matriz de ocurrencia Hs–Te editable, con casos precargados: Isla Fuerte, Atlántico,
  Orkney (para contraste), Pacífico colombiano.
- Para mareas: serie temporal por armónicos M2, S2, K1, O1, con ciclo
  sicigia-cuadratura visible.

**M2. Selección y taxonomía de dispositivo.**
- Los ocho tipos EMEC de WEC y los siete de corriente mareal, con esquema y descripción.
- Al elegir un tipo, el simulador precarga su rango de CWR real de la tabla de la
  sección 4.5.
- Fichas de los dispositivos reales de la sección 3, incluidos los fracasos y sus causas.

**M3. Modelo dinámico (nivel avanzado, semestres superiores).**
- Ecuación de arfada de un grado de libertad con A(ω), B(ω), K_h, B_pto.
- Cálculo del periodo natural y visualización de la curva de respuesta.
- Deslizador de B_pto con indicación del óptimo teórico.
- Comparación entre potencia absorbida y límites λ/2π y de Budal.

**M4. Rango mareal.**
- Curva área-nivel del embalse.
- Los cuatro modos de operación: vaciado, llenado, bidireccional, con bombeo.
- Bucle temporal de balance de volumen con carga instantánea.
- Comparación de energía anual entre modos sobre el mismo emplazamiento.

**M5. Corriente mareal.**
- P = 0,5 ρ Cp A V³, con Cp editable y el límite de Betz marcado en el gráfico.
- Integración sobre la serie temporal, mostrando por qué el promedio del cubo no es el
  cubo del promedio.
- Comparación aire-agua con el cálculo del factor 837 y de los 28,3 m/s equivalentes.

**M6. Cadena de rendimientos.**
- Diagrama de Sankey con todas las etapas de la tabla de la sección 4.8.
- El estudiante ve entrar 100 kW de ola y salir 8 kW a red. Ese golpe visual es el
  objetivo pedagógico.

**M7. Producción anual (AEP) conforme a IEC.**
- Matriz de potencia del dispositivo (kW por celda Hs–Te).
- Multiplicación término a término con la matriz de ocurrencia.
- Salida: AEP en MWh/año, factor de planta, horas equivalentes.

**M8. Economía.**
- CAPEX por tonelada y por kW, con los valores reales de la sección 3 como referencia
  (Wavestar 9,1 t/kW, Wave Dragon 5,5 t/kW, Minesto 0,023 t/kW).
- OPEX como porcentaje del CAPEX.
- LCOE con tasa de descuento y vida útil editables.
- Comparador contra diésel en zona no interconectada.

**M9. Colombia.**
- Emplazamientos precargados con las cifras verificadas de la sección 7.
- El contraste 5 a 9 kW/m contra 40 kW/m en pantalla permanente.
- Módulo de comparación con gradiente salino y térmico, para honestidad.

### 8.3 Decisiones técnicas de implementación en Python

Recomendaciones propias [I], no verificadas contra requisitos del curso:

- **Interfaz**: PySide6 o PyQt6 para escritorio nativo, o Dear PyGui si se prioriza
  respuesta inmediata a deslizadores. Tkinter es suficiente pero limita las gráficas.
- **Cálculo**: NumPy y SciPy. `scipy.optimize.newton` para la dispersión.
- **Gráficas**: Matplotlib embebido en el widget, o PyQtGraph si se necesita animación
  en tiempo real.
- **Cálculos IEC**: usar **MHKiT** como dependencia en vez de reimplementar espectros
  y momentos espectrales. Está en Python, es libre y sigue la 62600-101.
- **Datos**: archivos CSV o JSON versionados en el repositorio, uno por emplazamiento y
  uno por dispositivo, para que los estudiantes puedan añadir casos sin tocar el código.
- **Empaquetado**: PyInstaller para distribuir un ejecutable sin instalación de Python,
  crítico si los estudiantes usan salas de cómputo con permisos restringidos.
- **Persistencia entre semestres**: guardar los escenarios en JSON legible para que el
  trabajo de un semestre sea insumo del siguiente.

### 8.4 Progresión por semestres

Propuesta propia [I]:

| Nivel | Módulos | Concepto central |
|---|---|---|
| Introductorio | M1, M2, M6 | Recurso, taxonomía, la energía se pierde en cada etapa |
| Intermedio | M4, M5, M7 | Modos de operación, dependencia cúbica, producción anual |
| Avanzado | M3, M8 | Resonancia, límites teóricos, coste por MWh |
| Proyecto final | M9 completo | Un emplazamiento colombiano real de principio a fin |

---

## 9. Datos no encontrados (SIN DATO)

Registro explícito de lo que esta investigación **no** pudo verificar:

1. Dimensiones (ancho, alto) y masa del Oyster 800. SIN DATO en PRIMRE, EMEC ni Tethys.
2. Profundidad de operación y masa del CETO 6. SIN DATO en PRIMRE.
3. Profundidad de operación del Pelamis P2. SIN DATO en la ficha PRIMRE.
4. Área exacta del embalse de La Rance, con fuente primaria. Se usó 22 km² como [G].
5. Producción anual exacta de La Rance, con fuente primaria. Se usó 500 GWh como [G].
6. Densidad de potencia undimotriz en kW/m publicada específicamente para **San Andrés**.
7. Densidad de potencia undimotriz en kW/m publicada específicamente para **Islas del
   Rosario**.
8. Fuente primaria para los rangos mareales de Buenaventura (4,2 m) y Tumaco (3,8 m).
9. Fecha exacta de desmantelamiento del LIMPET: las fuentes dan 2011 o 2012.
10. Existencia de simuladores educativos de energía marina **en español**.
11. Rendimiento verificado de la cadena hidráulica completa de un PTO real (se usó
    0,65 a 0,80 como [G]).
12. Estado actual verificado de proyectos de laguna mareal a escala comercial.

Cualquiera de estos puntos requiere una búsqueda dirigida antes de aparecer como dato
duro en material docente.

---

## 10. Fuentes consultadas

### Taxonomía y clasificación
- EMEC, Wave devices: https://www.emec.org.uk/marine-energy/wave-devices/
- EMEC, Tidal devices: https://www.emec.org.uk/marine-energy/tidal-devices/
- Coastal Wiki, Wave energy converters: https://www.coastalwiki.org/wiki/Wave_energy_converters
- PRIMRE, Basics of Wave Energy: https://openei.org/wiki/PRIMRE/Basics/Wave_Energy

### Dispositivos
- PRIMRE, Pelamis P2: https://openei.org/wiki/PRIMRE/Databases/Projects_Database/Devices/Pelamis_P2
- PRIMRE, Oyster 800: https://openei.org/wiki/PRIMRE/Databases/Projects_Database/Devices/Aquamarine_Power_Oyster_800
- PRIMRE, CETO 6: https://openei.org/wiki/PRIMRE/Databases/Projects_Database/Devices/Carnegie_Clean_Energy_CETO_6
- Wikipedia, Pelamis Wave Power: https://en.wikipedia.org/wiki/Pelamis_Wave_Power
- Wikipedia, Aquamarine Power: https://en.wikipedia.org/wiki/Aquamarine_Power
- Wikipedia, Islay LIMPET: https://en.wikipedia.org/wiki/Islay_LIMPET
- Wikipedia, Mutriku Breakwater Wave Plant: https://en.wikipedia.org/wiki/Mutriku_Breakwater_Wave_Plant
- Wikipedia, Rance Tidal Power Station: https://en.wikipedia.org/wiki/Rance_Tidal_Power_Station
- Wikipedia, Sihwa Lake Tidal Power Station: https://en.wikipedia.org/wiki/Sihwa_Lake_Tidal_Power_Station
- Wikipedia, Annapolis Royal Generating Station: https://en.wikipedia.org/wiki/Annapolis_Royal_Generating_Station
- Wikipedia, Stingray tidal stream generator: https://en.wikipedia.org/wiki/Stingray_tidal_stream_generator
- Tethys, Wave Star Hanstholm: https://tethys.pnnl.gov/project-sites/wave-star-hanstholm
- Tethys, MeyGen: https://tethys.pnnl.gov/project-sites/meygen-tidal-energy-project
- Tethys, Orbital O2 at EMEC: https://tethys.pnnl.gov/project-sites/orbital-marine-power-o2-emec
- Tethys, La Rance 40-year feedback: https://tethys.pnnl.gov/sites/default/files/publications/La_Rance_Tidal_Power_Plant_40_year_operation_feedback.pdf
- SAE Renewables, desmantelamiento de SeaGen: https://saerenewables.com/meygen-operational-update-3-2/
- EMEC, Orbital O2 design: https://www.emec.org.uk/press-release-orbital-marine-power-unveil-design-for-orbital-o2-tidal-turbine/
- EMEC, MeyGen offshore operations: https://www.emec.org.uk/offshore-operations-at-meygens-tidal-array/
- Minesto, Dragon 12: https://minesto.com/products/kite-systems/dragon-12/
- New Atlas, Minesto tidal kite: https://newatlas.com/energy/minesto-tidal-kite/
- OPT, PB3 PowerBuoy: https://oceanpowertechnologies.com/platform/opt-pb3-powerbuoy/
- OPT, despliegue del PB40: https://investors.oceanpowertechnologies.com/news-releases/news-release-details/photo-release-ocean-power-technologies-successfully-deploys-pb40
- Wave Dragon, especificaciones: http://www.spok.dk/consult/wavedragon_e.shtml
- Aalborg University, prototipo Wave Dragon: https://vbn.aau.dk/ws/portalfiles/portal/51742663/Prototype_Testing_of_the_Wave_Energy_Converter_Wave_Dragon.pdf
- EVE, producción acumulada de Mutriku: https://www.eve.eus/en/news/news/the-mutriku-wave-plant-achieves-cumulative-electricity-production-of-three-million-kilowatts-per-hour/
- CBC, coste varado de Annapolis: https://www.cbc.ca/news/canada/nova-scotia/n-s-power-loses-1st-bid-to-get-27m-from-customers-for-idled-annapolis-plant-1.6313798
- ADB, caso Sihwa: https://blogs.adb.org/blog/how-sihwa-turned-tide-bespoiling-energy-plants

### Ecuaciones y desempeño
- MDPI Processes, caracterización de recurso undimotriz: https://www.mdpi.com/2227-9717/11/7/2221
- Babarit, base de datos de CWR: https://www.sciencedirect.com/science/article/abs/pii/S0960148115001652
- Cambridge JFM, límites de absorción axisimétrica: https://www.cambridge.org/core/journals/journal-of-fluid-mechanics/article/extending-limits-for-wave-power-absorption-by-axisymmetric-devices/FD2C7AD12B7BD51E364F75DF4A8DB47C
- Royal Society Open Science, fórmulas fundamentales de conversión: https://royalsocietypublishing.org/doi/10.1098/rsos.140305
- Vennell, superar el límite de Betz con turbinas mareales: https://www.sciencedirect.com/science/article/abs/pii/S096014811200780X
- ScienceDirect Topics, coeficiente de potencia: https://www.sciencedirect.com/topics/engineering/power-coefficient
- Cálculos de energía mareomotriz: https://hydropower-tidalpower.blogspot.com/2009/07/energy-calculations_07.html
- PMC, comparación presas y lagunas mareales: https://pmc.ncbi.nlm.nih.gov/articles/PMC9660546/
- Das, Halder y Samad, diseño óptimo de turbinas de aire para OWC: https://journals.sagepub.com/doi/full/10.1177/1759313117693639

### Normas
- IEC TS 62600-1 Ed. 2.0 2020: https://cdn.standards.iteh.ai/samples/102989/5a3d1ae0242c45be99b961a6ad876eab/IEC-TS-62600-1-2020.pdf
- IEC TS 62600-2 Ed. 2.0 2019: https://cdn.standards.iteh.ai/samples/101783/ea682e5bc92741c8b33f111487389422/IEC-TS-62600-2-2019.pdf
- IEC TS 62600-3 Ed. 1.0 2020: https://cdn.standards.iteh.ai/samples/100562/7c2afce4f50d4f9585324692b80c3d3b/IEC-TS-62600-3-2020.pdf
- IEC TS 62600-4 Ed. 1.0 2020: https://cdn.standards.iteh.ai/samples/102470/5a32d631b6ec482f887e41a068209326/IEC-TS-62600-4-2020.pdf
- IEC TS 62600-100:2024: https://webstore.iec.ch/en/publication/66061
- IEC TS 62600-101 Ed. 2.0 2024: https://cdn.standards.iteh.ai/samples/103777/796ba9def512455ba4af218c8e19c3f7/IEC-TS-62600-101-2024.pdf
- IEC TS 62600-102: https://standards.globalspec.com/std/10037795/iec-ts-62600-102
- IEC TS 62600-103:2024: https://standards.iteh.ai/catalog/standards/iec/9a7615f9-9c6a-436a-bf82-6440f21865a5/iec-ts-62600-103-2024
- IEC TS 62600-10:2021: https://tethys-engineering.pnnl.gov/publications/iec-ts-62600-102021-part-10-assessment-mooring-system-marine-energy-converters-mecs
- IEC TS 62600-30:2018: https://store.accuristech.com/standards/bs-pd-iec-ts-62600-30-2018
- IEC TS 62600-201:2025: https://tethys-engineering.pnnl.gov/publications/iec-technical-specification-62600-2012025-part-201-tidal-energy-resource-assessment
- IEC TS 62600-202:2022: https://webstore.iec.ch/en/publication/27906
- IEC TS 62600-300: https://standards.globalspec.com/standards/detail?docId=13473092
- IEC TC 114, programa de trabajo: https://www.iec.ch/dyn/www/f?p=103:23:::::FSP_ORG_ID,FSP_LANG_ID:1316,25
- EquiMar: https://www.equimar.org/
- EquiMar D1.1: https://tethys.pnnl.gov/sites/default/files/publications/EquiMar_D1.1.pdf
- EMEC, servicios acreditados: https://www.emec.org.uk/services/accredited-services/

### Herramientas
- WEC-Sim, documentación: https://wec-sim.github.io/WEC-Sim/main/introduction/overview.html
- WEC-Sim, repositorio: https://github.com/WEC-Sim/WEC-Sim
- MHKiT, documentación: https://mhkit-software.github.io/MHKiT/
- MHKiT, visión general: https://mhkit-software.github.io/MHKiT/overview.html
- Sandia, datos y software: https://energy.sandia.gov/programs/renewable-energy/water-power/data-software/
- Tethys, Aqua-RET: https://tethys.pnnl.gov/research-studies/aqua-renewable-energy-technologies-aqua-ret
- PRIMRE, recursos para educadores: https://openei.org/wiki/PRIMRE/STEM/Resources/Educator_Resources
- Tethys, recursos educativos de energía renovable marina: https://tethys.pnnl.gov/marine-renewable-energy-educational-resources

### Recurso en Colombia
- Appendini y otros (2015), Applied Energy, recurso undimotriz en el CLLJ: https://www.sciencedirect.com/science/article/abs/pii/S0306261914010885
- Ortega y otros (2013), Renewable Energy, Isla Fuerte: https://www.sciencedirect.com/science/article/abs/pii/S0960148112007847
- Osorio y otros (2016), RSER, evaluación del potencial marino en Colombia: https://www.sciencedirect.com/science/article/abs/pii/S1364032115010278
- Orejarena-Rondón y otros (2022), Renewable Energy, flujo de energía del oleaje en el Caribe: https://www.sciencedirect.com/science/article/abs/pii/S0960148121014087
- Eelsalu, Montoya y Soomere, puntos calientes de potencia de oleaje en el Caribe: https://papers.ssrn.com/sol3/Delivery.cfm/6fa04269-1d84-4a7d-8de3-7d2a6542a010-MECA.pdf?abstractid=5288606&mirid=1
- Quintero Aguilar y Rueda Bayona (2019), Inge CuC, potencial mareomotriz del Pacífico central: https://revistascientificas.cuc.edu.co/ingecuc/article/download/3202/4670
- Cuantificación del potencial undimotriz en el Caribe colombiano (2017), Investigación e Innovación en Ingenierías: https://revistas.unisimon.edu.co/index.php/innovacioning/article/download/2758/3106
- Uninorte, evaluación del potencial undimotriz en San Andrés: https://manglar.uninorte.edu.co/handle/10584/13051
- Potencial de gradiente salino en Colombia: https://www.sciencedirect.com/science/article/abs/pii/S0960148114005448
- DIMAR, pronóstico de condiciones oceánicas para el Caribe colombiano: https://issuu.com/dimarcolombia/docs/pro_sep_2020/s/10995513

---

Fin del documento.
