# Tareas

Orden de construcción: primero todo lo que se puede comprobar sin abrir una ventana,
después la lógica que la interfaz necesita pero que no depende de cómo se vea, y en último
lugar el diseño visual. Cada bloque deja el proyecto en un estado defendible.

Las tareas citan entre corchetes la capacidad de `specs/` que satisfacen.

---

## Bloque A. Núcleo de física, sin interfaz

### 1. Recurso

- [x] 1.1 `nucleo/olas.py`: relación de dispersión por Newton-Raphson con arranque de Eckart, tolerancia 1e-10, devolviendo también el número de iteraciones. [nucleo-recurso-marino]
- [x] 1.2 `nucleo/olas.py`: potencia omnidireccional `J = ρg²Hm0²Te/(64π)`, con ρ y g como parámetros, no incrustados. [nucleo-recurso-marino]
- [x] 1.3 `nucleo/olas.py`: conversión entre Tp, Te y Tz con `1,12 Te = 1,29 Tz = Tp`, declarando el supuesto JONSWAP γ = 3,3. [nucleo-recurso-marino]
- [x] 1.4 `nucleo/olas.py`: velocidad de grupo a profundidad finita `Cg(w) = (w/2k)*[1 + 2kh/sinh(2kh)]`, con el k del punto 1.1. [nucleo-recurso-marino]
- [x] 1.5 `nucleo/mareas.py`: ajuste armónico con UTide sobre las series de `datos/ideam/`, guardando por constituyente la estación y el periodo del ajuste. [nucleo-recurso-marino]
- [x] 1.6 `nucleo/mareas.py`: reconstrucción de serie temporal desde las constituyentes ajustadas, con ciclo de sicigia y cuadratura observable. [nucleo-recurso-marino]
- [x] 1.7 `nucleo/corrientes.py`: potencia de corriente mareal con dependencia cúbica. [nucleo-recurso-marino]
- [x] 1.8 `nucleo/integradores.py`: integrador de paso adaptativo sobre `scipy.integrate.solve_ivp`. [cadena-conversion]
- [x] 1.9 `nucleo/espectros.py`: Pierson-Moskowitz y JONSWAP con γ recorrible de 1,0 a 5,0, apoyándose en MHKiT donde cubra el cálculo. γ = 1,0 debe degenerar en Pierson-Moskowitz. [nucleo-recurso-marino]
- [x] 1.10 `nucleo/espectros.py`: momentos espectrales `m_n` y parámetros derivados `Hm0 = 4√m0`, `Te = m₋₁/m0`, `Tz`, `ε0`. Ningún parámetro se introduce al margen del espectro. [nucleo-recurso-marino]
- [x] 1.11 `nucleo/corrientes.py`: energía por integración de `V(t)³` sobre la serie reconstruida, y la evaluación con la velocidad media junto a ella, marcada como el resultado no válido. [nucleo-recurso-marino]
- [x] 1.12 `nucleo/corrientes.py`: relación de densidades agua-aire y velocidad de viento equivalente para una corriente dada. [nucleo-recurso-marino]

### 2. Dispositivos y cadena

- [x] 2.1 `nucleo/dispositivos/base.py`: interfaz común recurso → captura → PTO → eléctrico, con hueco para una tercera familia. [cadena-conversion]
- [x] 2.2 `nucleo/dispositivos/absorbedor.py`: ecuación de arfada de un grado de libertad con A(ω), B(ω), K_h = ρgS_w y B_pto, y potencia absorbida como promedio de B_pto·ζ̇² sobre la serie integrada. [cadena-conversion]
- [x] 2.2b `nucleo/hidrodinamica.py`: coeficientes A(ω), B(ω) y F_e de literatura, cada uno con su fuente y la geometría de referencia, y aviso de extrapolación fuera de ella. [cadena-conversion]
- [x] 2.3 `nucleo/dispositivos/owc.py`: columna de agua oscilante, con obra civil imputable o compartida. [diseno-dispositivo]
- [x] 2.4 `nucleo/dispositivos/embalse.py`: presa de rango mareal por integración temporal — estado, carga `H(t)`, caudal `Q(t)`, potencia `P = ρgQHη` y balance de volumen sobre la curva área-nivel `A(h)`. **No calcular la producción con `E = ½ρgAR²`**, que solo entra como cota teórica. [diseno-dispositivo]
- [x] 2.4b `nucleo/dispositivos/embalse.py`: los cuatro modos de operación — vaciado, llenado, bidireccional y con bombeo — con la energía de bombeo contabilizada aparte. El bidireccional puede rendir menos; sale del cálculo, no de un supuesto. [diseno-dispositivo]
- [x] 2.5 `nucleo/dispositivos/turbina_corriente.py`: turbina de corriente con aviso si Cp supera 16/27. [cadena-conversion]
- [x] 2.6 `nucleo/resultado.py`: objeto de resultado con todos los eslabones de la cadena, que es lo único que los cuatro niveles leen. [cadena-conversion]

### 3. PTO y generación

- [x] 3.1 `nucleo/pto.py`: los cinco tipos de PTO con su rendimiento y su fuente. [pto-y-generacion]
- [x] 3.2 `nucleo/pto.py`: reglas de oficio como avisos que explican y no impiden. [pto-y-generacion]
- [x] 3.3 `nucleo/pto.py`: turbina Wells frente a turbina de impulso, con pérdida aerodinámica y ancho de banda distintos. [pto-y-generacion]
- [x] 3.4 `nucleo/pto.py`: registro de picos de carga por parada súbita y por tope de carrera. [pto-y-generacion]
- [x] 3.5 `nucleo/pto.py`: fluctuación máximo sobre medio y conmutador de número de flotadores. [pto-y-generacion]
- [x] 3.6 `nucleo/electrico.py`: saturación del generador con contabilidad de la energía recortada. [pto-y-generacion]

### 4. Dimensionado y límites

- [x] 4.1 `analisis/resonancia.py`: frecuencia natural y separación respecto al periodo predominante del sitio. [diseno-dispositivo]
- [x] 4.2 `analisis/captura.py`: ancho de captura, límite λ/2π en arfada, 3λ/2π al combinar con deriva o cabeceo, y límite de Budal, indicando cuál gobierna. [diseno-dispositivo]
- [x] 4.3 `analisis/captura.py`: barrido de amortiguamiento del PTO con óptimo y restricción de carrera. [diseno-dispositivo]
- [x] 4.4 `analisis/dimensionado.py`: dimensiones de partida desde el recurso, declarando el criterio y advirtiendo si hay más de un valor de recurso con fuente. [diseno-dispositivo]
- [x] 4.5 `analisis/captura.py`: cota de Falnes `P_max = |F_e|²/(8B)` mostrada junto a la potencia absorbida, con los techos de absorción del 50 % simétrico y ~100 % no simétrico y su cita. [diseno-dispositivo]
- [x] 4.6 `analisis/captura.py`: amortiguamiento óptimo analítico `√(B² + [ω(m+A) − K_h/ω]²)` superpuesto al barrido del punto 4.3, y su reducción a `B(ω)` en resonancia. [diseno-dispositivo]
- [x] 4.7 `analisis/dimensionado.py`: periodo de diseño como el que maximiza energía por ocurrencia, mostrado junto al más frecuente y al medio, con el escalado en T² frente a la dimensión de referencia europea. [diseno-dispositivo]

### 5. Producción anual y economía

- [x] 5.1 `analisis/aep.py`: matriz de ocurrencia por matriz de potencia, con contribución por celda consultable. [produccion-anual]
- [x] 5.2 `analisis/aep.py`: construcción de la matriz de dispersión desde serie, rotulando reconstrucciones. [produccion-anual]
- [x] 5.3 `analisis/aep.py`: regla del pulgar del Handbook y aviso por discrepancia fuera de tolerancia. [produccion-anual]
- [x] 5.4 `analisis/aep.py`: disponibilidad explícita y factor de planta derivado, nunca de entrada. [produccion-anual]
- [x] 5.5 `analisis/economia.py`: CAPEX, OPEX, vida útil, tasa de descuento y coste nivelado por MWh. [analisis-economico]
- [x] 5.6 `analisis/economia.py`: comparador contra diésel local, exigiendo localidad, operador y periodo. [analisis-economico]
- [x] 5.7 `analisis/economia.py`: comparador contra red interconectada como intervalo. [analisis-economico]
- [x] 5.8 `analisis/economia.py`: repago del coste de inversión de partida por tamaño de máquina, y comprobación de que multiplicar unidades pequeñas no lo reparte. [analisis-economico]
- [x] 5.9 `analisis/economia.py`: relación masa sobre potencia con la advertencia de estructura frente a lastre. [analisis-economico]

### 6. Datos y trazabilidad

- [x] 6.1 `nucleo/dato.py`: tipo con valor, unidad, fuente y estado de verificación. Un dato pendiente se carga pero no se usa. [trazabilidad-datos]
- [x] 6.2 `datos/sitios/*.json`: un archivo por emplazamiento con ese formato, empezando por Isla Fuerte. [trazabilidad-datos]
- [x] 6.3 `datos/dispositivos/*.json`: fichas de los cuatro dispositivos modelados. [trazabilidad-datos]
- [x] 6.4 `datos/catalogo/*.json`: las ocho categorías EMEC undimotrices y las siete de corriente mareal, marcadas como no simulables. [niveles-divulgacion]
- [x] 6.5 `datos/fracasos/*.json`: instalaciones desmanteladas con causa y destino del coste hundido. [analisis-economico]
- [x] 6.6 `nucleo/validacion.py`: guardas de rango que acotan y explican, nunca cierran. [trazabilidad-datos]
- [x] 6.7 `analisis/emplazamiento.py`: panel de puntuación y criterio eliminatorio de área protegida sobre `datos/runap/`. [emplazamientos]
- [x] 6.8 `datos/catalogo/*.json`: relación de ancho de captura de cada tipo con **las dos fuentes** (medias y rangos) y el desenlace comercial de sus desarrollos reales. La discrepancia se muestra, no se promedia. [diseno-dispositivo]

### 7. Pruebas de invariantes, antes de cualquier interfaz

- [x] 7.1 La potencia capturada nunca supera la potencia incidente disponible. [cadena-conversion]
- [x] 7.2 El ancho de captura no supera λ/2π para un absorbedor puntual axisimétrico en arfada. [cadena-conversion]
- [x] 7.3 Todos los rendimientos quedan entre 0 y 1. [cadena-conversion]
- [x] 7.4 El balance de volumen del embalse cierra. [cadena-conversion]
- [x] 7.5 El integrador no diverge al reducir el paso de tiempo: la diferencia entre soluciones consecutivas decrece de forma monótona. [cadena-conversion]
- [x] 7.6 La matriz de ocurrencia suma la unidad dentro del 0,1 %. [produccion-anual]
- [x] 7.7 El factor de planta coincide con producción sobre nominal por horas. [produccion-anual]
- [x] 7.8 Validación contra el Handbook: 40 kW/m · 15 m · 20 % · 95 % · 8.766 h = 999 MWh/año. [cadena-conversion]
- [x] 7.9 Validación contra Orbital O2: rotor de 20 m, Cp = 0,40, V = 3,0 m/s = 1,74 MW. [cadena-conversion]
- [x] 7.10 La reconstrucción de marea del Caribe reproduce el rango medido dentro del 15 %. [nucleo-recurso-marino]
- [x] 7.11 Ningún módulo de `nucleo/` ni de `analisis/` importa el paquete de interfaz. [arquitectura-y-calidad]
- [x] 7.12 El núcleo se ejecuta completo en un entorno sin biblioteca gráfica instalada. [nucleo-recurso-marino]
- [x] 7.13 Validación contra La Rance: la energía teórica anualizada da 1.435 GWh/año y el cociente con la producción real registrada arroja un rendimiento de ciclo del orden del 35 %, rotulado como orden de magnitud mientras el área y la producción sigan sin fuente primaria. [cadena-conversion]
- [x] 7.14 La energía de corriente integrada sobre la serie supera a la evaluada con la velocidad media de esa misma serie. [nucleo-recurso-marino]
- [x] 7.15 JONSWAP con γ = 1,0 coincide con Pierson-Moskowitz dentro del 1 %, y Hm0 y Te recuperados por integración de momentos reproducen los de partida. [nucleo-recurso-marino]

---

## Bloque B. Lógica de aplicación, sin decisiones visuales

Todo lo que la interfaz necesita para funcionar y que se puede probar sin mirar la pantalla.

- [x] 8.1 `app/trabajo.py`: ejecución del cálculo fuera del hilo de interfaz, con señales de progreso, resultado y error. [niveles-divulgacion]
- [x] 8.2 `app/trabajo.py`: cancelación de una simulación en curso. [niveles-divulgacion]
- [x] 8.3 `app/niveles.py`: las cuatro vistas leen del mismo objeto de resultado; el conmutador no recalcula. [niveles-divulgacion]
- [x] 8.4 `app/vocabulario.py`: traducción de magnitudes a lenguaje corriente y a viviendas alimentadas. [niveles-divulgacion]
- [x] 8.4b `app/formato.py`: formato numérico español (coma decimal, punto de miles) y unidad junto a cada magnitud, solo en presentación. El núcleo sigue en SI y punto decimal. [trazabilidad-datos]
- [x] 8.5 `app/formulas.py`: representación de cada fórmula con los números ya sustituidos. [niveles-divulgacion]
- [x] 8.6 `app/procedencia.py`: resolución de la fuente de cualquier constante mostrada. [trazabilidad-datos]
- [x] 8.7 `app/animacion.py`: muestreo de la serie ya calculada para la animación. No recalcula por fotograma. [niveles-divulgacion]
- [x] 8.8 `app/escenarios.py`: guardar y cargar escenarios en JSON legible, reproduciendo los mismos resultados. [trazabilidad-datos]
- [x] 8.9 `app/exportacion.py`: exportación de resultados a CSV y de figuras. [trazabilidad-datos]
- [x] 8.10 `app/limitaciones.py`: texto de limitaciones declaradas, accesible desde cualquier nivel, incluidas las dos del diagrama de dispersión. [trazabilidad-datos] [produccion-anual]
- [x] 8.14 `app/tesis.py`: contraste 8,9 frente a 40 kW/m y tabla de densidades de referencia con fuente, disponible en los cuatro niveles. [niveles-divulgacion]
- [x] 8.11 Pruebas: la producción anual es idéntica en los cuatro niveles sin tocar controles. [niveles-divulgacion]
- [x] 8.12 Pruebas: un escenario guardado y recargado reproduce los mismos resultados. [trazabilidad-datos]
- [x] 8.13 Pruebas: un dato pendiente nunca entra a un cálculo. [trazabilidad-datos]

---

## Bloque C. Interfaz y diseño visual

Se construye al final, sobre lógica ya probada. Ver es el único nivel que debe estar
terminado para la primera demostración; los otros tres pueden degradar a no disponible.

### 9. Nivel Ver

- [ ] 9.1 Ventana con el conmutador de cuatro niveles; solo Ver operativo. El contraste de la tesis visible desde el arranque. [niveles-divulgacion]
- [ ] 9.2 Lienzo animado del oleaje con `η(x,t) = (Hm0/2)·cos(kx − ωt)` usando el k del punto 1.1. **No aproximar con una sinusoide arbitraria.**
- [ ] 9.3 Boya cuya posición sale de la serie integrada en el punto 8.7.
- [ ] 9.4 Tres controles con rótulos en lenguaje corriente.
- [ ] 9.5 Resultado principal en viviendas alimentadas, sin fórmulas en pantalla.

### 10. Nivel Comparar

- [ ] 10.1 Diagrama de Sankey de la cadena de conversión completa.
- [ ] 10.2 Fichas de dispositivos reales, con los fracasos y su causa.
- [ ] 10.3 Catálogo EMEC, distinguiendo lo simulable de lo consultable.
- [ ] 10.4 Vista de dos tecnologías en paralelo sobre el mismo emplazamiento, resueltas con el mismo recurso y señalando en qué eslabón se separan. [niveles-divulgacion]

### 11. Niveles Calcular y Diseñar

- [ ] 11.1 Cada resultado con su fórmula y sus números sustituidos.
- [ ] 11.2 Procedencia de cada constante al pasar el cursor.
- [ ] 11.3 Panel de resonancia, ancho de captura y límites.
- [ ] 11.4 Panel de producción anual con los dos métodos a la vista.
- [ ] 11.5 Panel económico con las dos comparaciones juntas, la favorable y la desfavorable.
- [ ] 11.6 Panel de emplazamiento con el criterio eliminatorio de área protegida antes que cualquier cifra de recurso.

### 12. Acabado visual

- [ ] 12.1 Paleta, tipografía y espaciado coherentes en los cuatro niveles.
- [ ] 12.2 Estados vacíos y rótulos de dato pendiente con tratamiento visual propio.
- [ ] 12.3 Indicador de simulación en curso y control de cancelación visibles.
- [ ] 12.4 Comprobación de que la ventana responde durante la simulación más costosa.

---

## Bloque D. Entrega

- [ ] 13.1 Empaquetado con PyInstaller, probado en un equipo sin Python instalado ni permisos de administrador, con `datos/` dentro del paquete. [arquitectura-y-calidad]
- [ ] 13.2 Comprobación de ejecución sin conexión a internet. [arquitectura-y-calidad] [trazabilidad-datos]
- [ ] 13.3 Declaración de limitaciones visible en la aplicación empaquetada. [arquitectura-y-calidad]

---

## Pendientes de datos que no bloquean los bloques A y B

- [ ] 14.1 Decidir qué hacer con la discrepancia de Isla Fuerte: 8,9 kW/m revisado por pares frente a 1,96 kW/m de ERA5. Afecta al valor de diseño y, si se elige mostrarla, exige un requisito nuevo en `emplazamientos`.
- [ ] 14.2 Densidad de potencia publicada para San Andrés, del texto completo de la tesis de Uninorte.
- [ ] 14.3 Rango mareal de Tumaco con fuente primaria distinta de la serie de la IOC, para contrastar los 2,56 m medidos.
- [ ] 14.4 Consumo residencial de referencia con fuente, para la conversión a viviendas alimentadas del punto 8.4.
- [ ] 14.5 Capítulos 7 a 10 del Handbook, descargando el PDF completo de Springer (acceso abierto, DOI 10.1007/978-3-319-39889-1).
- [ ] 14.6 Rendimiento verificado de una cadena hidráulica de PTO real, hoy usado como 0,65 a 0,80.
- [ ] 14.7 Área del embalse de La Rance (22 km²) y su producción anual real (500 GWh/año) con fuente primaria. Hasta entonces, la validación 7.13 se rotula como orden de magnitud.