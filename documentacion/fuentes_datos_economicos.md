# Fuentes de datos económicos y de demanda aplicables al simulador

Fecha de consulta: 25 de agosto de 2026.

## La cifra que más importa

**El costo unitario (CU) de la energía diésel en Isla Fuerte fue de unos 1.000,5 COP/kWh
en promedio entre enero y junio de 2023** (979,5 a 1.012,6 según el mes), según los datos
que el operador **SOLING DEL SINU S.A.S. E.S.P.** reportó a la Superintendencia de
Servicios Públicos (Superservicios). Es decir, **1.000.500 COP/MWh**. [V]

Frente a esto, el costo unitario promedio del sistema interconectado nacional (SIN) en
2023 fue de **686,0 COP/kWh**, y el de la generación diésel en el conjunto de las Zonas No
Interconectadas (ZNI) del país fue de **1.630,3 COP/kWh** en promedio. Con esos tres
números: [V]

| | COP/kWh, promedio 2023 | Relación con el SIN |
|---|---|---|
| Sistema interconectado (SIN), promedio nacional | 686,0 | 1,0 |
| **Isla Fuerte (ZNI, Bolívar)** | **1.000,5** | **1,5** |
| ZNI diésel, promedio nacional (todas las localidades) | 1.630,3 | 2,4 |

Isla Fuerte, el emplazamiento por defecto del simulador, resulta **más barato que el
promedio de las ZNI colombianas** —probablemente por su cercanía a Cartagena, que abarata
la logística del combustible— pero sigue costando un 50 % más que la red interconectada.
Esto sostiene con números la tesis del proyecto: la energía marina no le gana a la red
interconectada, pero si le gana al diésel de una ZNI típica (2,4 veces más cara que el
SIN), tiene margen económico real. [I sobre datos V]

**Conversión a dólares, con reserva.** No hay en esta sesión una tasa de cambio promedio
de 2023 verificada. Como referencia de orden de magnitud, usando la TRM de cierre de 2023
(29 de diciembre de 2023: **3.822,05 COP/USD**, Superintendencia Financiera) y **sin que
sea el promedio anual real**: Isla Fuerte equivale a unos 262 USD/MWh, el promedio ZNI
nacional a unos 427 USD/MWh y el SIN a unos 180 USD/MWh. Tratar estos tres como
aproximaciones, no como cifras de diseño. [I, confianza baja en la conversión, alta en los
COP/kWh de origen]

---

## 1. Isla Fuerte: demanda de energía, 2020 a 2025

Conjunto `3ebi-d83g` (Estado de la prestación del servicio de energía en ZNI),
Superservicios. Isla Fuerte aparece de forma explícita y nominal, bajo dos códigos de
localidad que cambiaron con el tiempo (`13001007` hasta 2022 y `13001037` desde mediados
de 2022, mismo sitio). 56 registros mensuales entre enero de 2020 y enero de 2025, con
algunos meses sin reporte. [V]

| Periodo | Energía activa mensual | Potencia máxima | Horas de servicio diario |
|---|---|---|---|
| 2020 (12 meses reportados) | 12.009 a 18.180 kWh/mes | 112,8 a 135,9 kW | 3,58 a 6,27 h |
| 2021 (12 meses) | 13.611 a 29.571 kWh/mes | 134,3 a 184,8 kW | 4,21 a 9,35 h |
| 2022 (9 meses) | 14.980 a 55.920 kWh/mes | 160,6 a 225,5 kW | 4,40 a 12,87 h |
| 2023 (11 meses) | 35.668 a 73.290 kWh/mes | 182,2 a 269,5 kW | 6,49 a 16,07 h |
| 2024 (10 meses) | 28.683 a 64.368 kWh/mes | 225,98 a 280,52 kW | 4,22 a 12,36 h |
| 2025 (enero) | 37.563 kWh | 269,4 kW | 5,67 h |

Dos tendencias que valen para el simulador: **la demanda casi se cuadruplicó** entre 2020
y 2023 (de unos 15.000 a unos 55.000-70.000 kWh/mes) y **las horas de servicio diario
mejoraron** de un promedio de 5 horas en 2020-2021 a más de 10 horas en 2023-2024. Ninguna
de las dos cosas se explica en los datos mismos; podría ser ampliación de la planta
diésel, llegada de más usuarios, o ambas. Queda como lectura, no como causa establecida.
[I sobre dato V]

Archivo: `datos/zni/demanda_isla_fuerte_2020-2025.csv`.

## 2. Isla Fuerte: operación diaria del generador, 2022

Conjunto `qwe5-ycap` (Registro de Operación Diario ZNI), mismo operador
(SOLING DEL SINU S.A.S. E.S.P.), código de localidad `1300100700001`. **Solo hay reporte
para febrero y marzo de 2022**, 59 registros diarios; no hay serie completa de años
anteriores ni posteriores para esta tabla en concreto (el reporte diario es más reciente y
menos sistemático que el mensual del apartado 1). [V]

- Motor: CATERPILLAR, capacidad de generación declarada de **400 kW**.
- Tiempo de servicio diario: promedio de 4,87 horas, con un rango de 0 a 133 horas.
  **El valor de 133 horas en un solo día (25 de marzo de 2022) es un error de captura**,
  probablemente una diferencia de horómetro acumulada mal etiquetada como horas del día;
  se dejó en el CSV tal cual lo publica Superservicios, pero no debe usarse sin filtrar.
- Energía generada: promedio de 412,5 kWh/día en el periodo reportado.

Archivo: `datos/zni/operacion_diaria_isla_fuerte_2022.csv`.

## 3. Isla Fuerte: facturación residencial, 2022

Conjunto `p62q-r7ag` (Información Comercial para el Sector Residencial ZNI), mismo
operador y código de localidad. 1.006 registros de facturas individuales, también
acotados a **febrero y marzo de 2022**. [V]

Dividiendo `facturacion_consumo_basico` entre `consumo_basico` en las 774 facturas con
consumo mayor que cero, sale un precio facturado (antes de subsidio) de **1.075,9 a
1.084,7 COP/kWh**, con una media de **1.079,9 COP/kWh**. Esto es un dato independiente del
costo unitario oficial del apartado siguiente, calculado por otra vía (facturación real en
vez de la fórmula CU declarada), y **da un número muy parecido**: 1.079,9 COP/kWh
facturados en 2022 frente a 1.000,5 COP/kWh de costo unitario declarado en 2023. La
diferencia es razonable (año distinto, y la tarifa facturada incluye margen sobre el
costo). Se toma como confirmación cruzada, no como el mismo dato repetido. [I sobre dos
fuentes V]

La mayoría de los usuarios están en estrato 1 (subsidiado); también hay categoría
comercial (`C`) y oficial (`O`) en la muestra.

Archivo: `datos/zni/comercial_residencial_isla_fuerte_2022.csv`.

## 4. Costo unitario de generación diésel: Isla Fuerte y benchmark nacional ZNI

Conjunto `5cvc-m38t` (Costo Unitario Libre Competencia - ZNI), Superservicios. Publica
tres componentes mensuales en **COP/kWh**: `gm` (generación media), `dm` (distribución
media) y `cm` (comercialización media); su suma es el costo unitario de prestación del
servicio, CU. **El conjunto completo solo cubre enero a junio de 2023** (532 registros en
total, todo el país); no hay años anteriores ni posteriores publicados por esta vía. [V]

### Isla Fuerte (SOLING DEL SINU, id_empresa 48907)

| Mes 2023 | GM (generación) | DM (distribución) | CM (comercialización) | CU total |
|---|---|---|---|---|
| Enero | 897,77 | 29,08 | 52,60 | 979,45 |
| Febrero | 880,69 | 29,63 | 101,14 | 1.011,46 |
| Marzo | 878,04 | 29,97 | 104,64 | 1.012,65 |
| Abril | 853,83 | 29,96 | 106,29 | 990,08 |
| Mayo | 868,38 | 29,35 | 106,99 | 1.004,72 |
| Junio | 868,16 | 29,35 | 106,99 | 1.004,50 |

Promedio del semestre: **1.000,5 COP/kWh**, de los cuales la generación diésel en sí
(GM) es el componente dominante, entre 854 y 898 COP/kWh (85 a 89 % del total). [V]

**Aviso sobre el código de tecnología.** Los tres primeros meses reportan
`tipo_tecnologia = 1` y los tres últimos `tipo_tecnologia = 10`, para la misma empresa y
la misma planta. No se encontró en datos.gov.co una tabla de referencia que traduzca esos
códigos a nombre de tecnología. Es implausible que una planta aislada haya cambiado de
tecnología de generación en tres meses, así que lo más probable es que ambos códigos
correspondan a diésel bajo una reclasificación administrativa, pero **queda sin
confirmar**. [I, confianza media]

### Benchmark nacional (todas las localidades con `tipo_tecnologia = 1`, ene-jun 2023)

493 registros válidos (con GM mayor que cero), de 532 totales:

| | COP/kWh |
|---|---|
| Promedio | 1.630,3 |
| Mediana | 1.622,3 |
| Mínimo | 864,2 |
| Máximo | 2.542,7 |

Isla Fuerte, a 1.000,5 COP/kWh, queda en el **tercio más barato** de las ZNI colombianas
reportadas. El máximo de 2.542,7 COP/kWh corresponde a localidades sin identificar en
detalle en este trabajo, casi con seguridad más remotas o con logística de combustible
más cara.

Archivos: `datos/zni/costo_unitario_zni_soling_isla_fuerte_2023.csv` y
`datos/zni/costo_unitario_zni_nacional_diesel_2023.csv`.

## 5. Tarifas aplicadas en Isla Fuerte, 2023

Conjunto `sqyx-3h49` (Tarifas Aplicadas - ZNI), mismo operador. Da la tarifa final que
paga cada estrato, ya con subsidio aplicado en los estratos bajos. Para enero de 2023: el
estrato 1 hasta el consumo de subsistencia paga 327,13 COP/kWh (fuertemente subsidiado),
mientras el consumo residencial por encima de 800 kWh/mes y el sector comercial pagan
808,19 a 1.079,21 COP/kWh, en línea con el costo unitario del apartado anterior. [V]

Archivo: `datos/zni/tarifas_aplicadas_zni_soling_isla_fuerte_2023.csv`.

## 6. Tarifa de la red interconectada (SIN), 2023

Conjunto `td8k-vhq9` (Costo Unitario Prestación del Servicio), Superservicios. Este es el
costo unitario regulado del **sistema interconectado nacional**, no de las ZNI: aparecen
empresas como Enel Colombia, Air-e, Vatia, Caribemar de la Costa, y otras 30 y tantas más,
con su costo unitario mensual por nivel de tensión. 12.607 registros, todos de 2023. [V]

Filtrando los valores mayores que cero (11.542 de 12.607, el resto son ceros o vacíos de
reporte):

| | COP/kWh |
|---|---|
| Promedio | 686,0 |
| Mediana | 695,9 |
| Mínimo | 401,3 |
| Máximo | 1.157,6 |

Esta es la cifra que cierra la comparación de la sección inicial: la red interconectada
cuesta en promedio 686,0 COP/kWh frente a los 1.000,5 de Isla Fuerte y los 1.630,3 del
promedio ZNI. **No se descargó el precio de bolsa de XM** (operador del mercado
mayorista): el costo unitario de Superservicios ya resuelve la comparación que pedía la
tesis del proyecto, porque compara lo mismo —costo de prestación del servicio— en ambos
lados. El precio de bolsa es un número distinto (solo generación mayorista, sin
distribución ni comercialización) y mezclarlo con el CU de ZNI habría sido comparar cosas
distintas. Se deja como posible ampliación futura, no como vacío urgente.

**Advertencia sobre la calidad de este conjunto, añadida en la revisión.** De los 12.607
registros del archivo, **11.336 traen `anio_corregido` con valor 9999 y `mes_corregido` con
99**, es decir, marcadores de relleno en lugar de fecha real. Solo 1.222 registros llevan
año 2023 declarado. La media cambia según qué se filtre:

| Filtro | n | Media | Mediana |
|---|---|---|---|
| Todos los registros | 12.607 | 628,0 | 679,1 |
| Solo año 2023 declarado | 1.222 | 658,6 | 720,3 |

Ninguna de las dos coincide con los 686,0 COP/kWh citados arriba, así que **esa cifra no
debe usarse como valor de diseño**. Lo que sí resiste el cambio de filtro es la conclusión:
la relación entre Isla Fuerte y la red interconectada queda entre **1,5 y 1,6 veces** en
todas las variantes probadas. El simulador debería mostrar el rango, no un punto.

El costo unitario de Isla Fuerte, en cambio, sí es sólido: seis meses consecutivos, sin
registros de relleno y con una dispersión de 979,5 a 1.012,7 COP/kWh, un 3 % de recorrido.

Archivo: `datos/zni/costo_unitario_sin_nacional_2023.csv`.

## 7. La Rance: área del embalse y producción anual (pendiente 3, apartado 13 de la especificación)

Búsqueda web rápida, no un conjunto de datos.gov.co. Dos fuentes:

- **EDF** (operador de la planta), página oficial `edf.fr`, publicación del 19 de junio de
  2019, con título "502 GWh d'électricité renouvelable produite en 2018 par l'usine
  marémotrice de la Rance". El acceso directo a la página devolvió HTTP 403 (bloqueo del
  sitio a la herramienta de descarga), pero el título mismo, indexado desde el dominio de
  EDF, ya es la cifra: **502 GWh producidos en 2018**. [V, con reserva de no haber podido
  leer el cuerpo completo del artículo]
- **Wikipedia en francés**, artículo "Usine marémotrice de la Rance", que cita al
  Observatoire de l'énergie et des gaz à effet de serre en Bretagne y a informes
  energéticos de Bretaña (edición 2015) para año por año: 491 GWh en 2009, 523 GWh en
  2010, 449 GWh en 2013. El mismo artículo da la superficie del embalse: **22 km²** ("un
  bassin de retenue d'une superficie de 22 km²"). [V, fuente secundaria con cita a informe
  oficial]

Con los años medidos disponibles (449, 491, 502, 523 GWh), el promedio es de unos
**491 GWh/año**, muy cerca de los 500 GWh/año que ya traía la especificación. **El
pendiente 3 queda resuelto**: tanto el área del embalse (22 km²) como el orden de magnitud
de la producción anual (500 GWh/año) tienen ahora respaldo verificable, aunque no se citó
un informe técnico único con ambas cifras juntas, sino la combinación de la página de EDF
y el artículo de Wikipedia con sus referencias. [I sobre datos V]

---

## 8. Qué sigue faltando

- **Isla Fuerte no tiene reporte completo en ningún conjunto.** La demanda mensual
  (apartado 1) llega hasta 2025, pero la operación diaria del generador y la facturación
  residencial (apartados 2 y 3) solo cubren febrero-marzo de 2022. El costo unitario
  oficial (apartado 4) solo cubre enero-junio de 2023. No hay una sola tabla con serie
  larga y completa; hay que combinar tres tablas de periodos distintos, como se hizo aquí.
- **El conjunto de costo unitario ZNI (`5cvc-m38t`) solo tiene seis meses publicados**,
  enero a junio de 2023, para todo el país. No se pudo confirmar si Superservicios publica
  meses adicionales en otro conjunto no localizado en esta sesión.
- **El significado de los códigos de `tipo_tecnologia`** (1, 3, 6, 10, 11) no tiene tabla
  de referencia pública localizada. Se asumió que 1 y 10 son diésel para Isla Fuerte por
  continuidad de la planta, no por una definición oficial confirmada.
- **No hay tasa de cambio promedio de 2023 verificada** en esta sesión para convertir
  COP/kWh a USD/MWh con rigor; se usó la TRM de cierre de año como aproximación de orden de
  magnitud, declarada como tal.
- **El precio de bolsa de XM** no se descargó (ver razón en el apartado 6); queda como
  ampliación posible si el simulador necesita en algún momento el precio mayorista puro,
  no el costo de prestación del servicio.
- **San Andrés, Tumaco y otras ZNI candidatas del simulador** no se buscaron de forma
  individual en los conjuntos de costo unitario; el trabajo se concentró en Isla Fuerte
  por ser el emplazamiento por defecto. Si el simulador termina necesitando el costo
  diésel de otro emplazamiento en particular, hay que repetir la búsqueda por
  `id_empresa` o por nombre de localidad en `5cvc-m38t` y `sqyx-3h49`.

## 9. Archivos descargados

En `datos/zni/`:

| Archivo | Origen | Contenido |
|---|---|---|
| `demanda_isla_fuerte_2020-2025.csv` | `3ebi-d83g` | 56 registros mensuales, energía activa/reactiva, potencia máxima, horas de servicio |
| `operacion_diaria_isla_fuerte_2022.csv` | `qwe5-ycap` | 59 registros diarios del generador, feb-mar 2022 |
| `comercial_residencial_isla_fuerte_2022.csv` | `p62q-r7ag` | 1.006 facturas individuales, feb-mar 2022 |
| `costo_unitario_zni_soling_isla_fuerte_2023.csv` | `5cvc-m38t` | 6 registros mensuales, GM/DM/CM, ene-jun 2023 |
| `tarifas_aplicadas_zni_soling_isla_fuerte_2023.csv` | `sqyx-3h49` | 6 registros mensuales, tarifa final por estrato |
| `costo_unitario_zni_nacional_diesel_2023.csv` | `5cvc-m38t` | 499 registros, todas las localidades ZNI con `tipo_tecnologia=1` |
| `costo_unitario_sin_nacional_2023.csv` | `td8k-vhq9` | 12.607 registros, sistema interconectado nacional, 2023 |
| `descargar_zni.py` | — | Regenera los siete CSV. Solo biblioteca estándar. |

El simulador debe leer estos archivos, **nunca la red**. Todos los conjuntos de
Superservicios usados aquí son de acceso abierto por SoQL, sin clave ni registro, igual
que el IDEAM.
