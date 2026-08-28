# Fuentes de datos del IDEAM aplicables al simulador

Fecha de consulta: 25 de agosto de 2026.

## Resumen

El IDEAM **no publica oleaje**, ni Hs ni Tp, en ningún canal: ni en la API abierta ni en
DHIME, cuyo catálogo de 25 variables se revisó completo. Lo que sí publica, y alimenta
directamente el módulo M7 (rango mareal), es **nivel del mar** de mareógrafos costeros,
por dos vías distintas que no traen lo mismo:

- **API abierta de datos.gov.co**, sin registro, dato crudo, resolución horaria o de 10
  minutos, dos estaciones, hasta 2020. Apartado 1.
- **Portal DHIME**, dato con nivel de aprobación declarado, resolución diaria, más
  estaciones y hasta 2024. Apartado 4.

## 1. Nivel del mar, API abierta (sin registro)

Conjunto `ia8x-22em` en datos.gov.co, propiedad de la Oficina de Informática del IDEAM.
278.344 registros. Columnas: `codigoestacion`, `fechaobservacion`, `valorobservado`,
`nombreestacion`, `municipio`, `latitud`, `longitud`, `unidadmedida` (m).

Solo dos estaciones lo alimentan:

| Estación | Código | Ubicación | Resolución | Periodo | Registros |
|---|---|---|---|---|---|
| JUANCHACO - AUT | 0054077210 | Buenaventura, Valle (3,925 N; -77,349 W), boca de Bahía Málaga | horaria | 2005-06-28 a 2020-03-21 | 83.611 |
| TESORO INVEMAR | 0014017001 | Isla Tesoro, Islas del Rosario, Bolívar (10,235 N; -75,741 W) | 10 minutos | 2012-10-02 a 2020-09-24 | 194.733 |

Descarga por SoQL, sin clave:

```
https://www.datos.gov.co/resource/ia8x-22em.json?$where=codigoestacion='0054077210'&$limit=50000
```

Existen además `uxy3-jchf` (nivel del mar máximo) y `7z6g-yx9q` (mínimo), mismo formato.

### Rango mareal calculado de la fuente primaria

Máximo menos mínimo diario, enero y febrero de 2019, descartando valores por debajo de
0,05 m como fallo de sensor:

| Estación | Días | Rango medio | Mediana | Mínimo | Máximo |
|---|---|---|---|---|---|
| Juanchaco (Pacífico) | 59 | **2,82 m** | 2,72 m | 1,78 m | **4,29 m** |
| Isla Tesoro (Caribe) | 59 | **0,23 m** | 0,30 m | 0,03 m | 0,31 m |

Esto **confirma con fuente primaria** las dos cifras que la especificación traía como [V]
de segunda mano: Caribe de 0,20 a 0,30 m y Pacífico de 3 a 4 m. El máximo de sicigia de
4,29 m en Juanchaco es coherente con los 4,2 m atribuidos a Buenaventura en el pendiente
número 4 de la sección 13.

### Advertencias de uso

- El IDEAM declara estos datos **crudos, no validados**, de sensor automático.
- Juanchaco tiene valores absurdos en la serie completa (hasta 300 m). Hay que filtrar.
- Isla Tesoro intercala lecturas de 0,003 a 0,007 m entre lecturas válidas de 0,34 m:
  caídas de sensor, no bajamares.
- El cero del sensor no es el nivel medio del mar ni un cero hidrográfico declarado. Sirve
  para **rango** (diferencia), no para cota absoluta.

## 2. Catálogo de estaciones

Conjunto `hp9r-jxuu`. La categoría **Meteorologica Marina** tiene 51 estaciones. Incluye
siete boyas de oleaje, todas de la DIMAR o el INVEMAR, no del IDEAM:

| Boya | Código | Posición | Estado |
|---|---|---|---|
| BOYA_TURBO_OLEAJE | 0012021002 | 8,907 N; -76,840 W | Activa |
| BOYA_SAN_ANDRES_OLEAJE | 0012011002 | 12,626 N; -81,683 W | Activa |
| BOYA_BARRANQUILLA_OLEAJE | 0029061001 | 11,121 N; -74,799 W | Activa |
| BOYA_PUERTO_BOLIVAR_OLEAJ | 0015071001 | 12,349 N; -72,218 W | Activa |
| BOYA_GORGONA | 0053071001 | 2,969 N; -78,260 W | Activa |
| BOYA_TUMACO | 0051021001 | 1,903 N; -78,912 W | Activa |
| BOYA_BUENAVENTURA | 0053091001 | 3,540 N; -77,729 W | Activa |

Aparecen en el catálogo del IDEAM porque son de convenio, pero **sus series no están en
la API abierta**. Para Hs y Tp hay que ir a la DIMAR o al CIOH.

**Nada en Isla Fuerte.** La estación marina activa más cercana es COVEÑAS_CIOH
(0012051001, 9,406 N; -75,684 W), de la DIMAR, a unos 55 km al este. La boya de oleaje más
cercana es la de Turbo, a unos 80 km al sur.

## 3. Otras series del IDEAM con API abierta

`sgfv-3yp8` velocidad del viento, `kiw7-v9ta` dirección del viento, `62tk-nxj5` presión
atmosférica, y el resto de variables meteorológicas, todas con el mismo esquema de
columnas. Útiles como contexto del chorro de bajo nivel del Caribe, no como entrada de
oleaje: reconstruir Hs por fetch a partir de viento es un modelo aparte y no está en el
alcance.

## 4. Portal DHIME

`https://atencionciudadano.ideam.gov.co/` sustituye al antiguo `dhime.ideam.gov.co`.
Revisado el 25 de agosto de 2026.

**El catálogo completo son 25 variables y ninguna es de oleaje:** altura de la base de la
nube, ángulo de elevación de la nube, brillo solar, caudal, clasificación de la nube,
concentración media de sedimentos, concentración superficial de sedimentos, dirección del
viento, dirección de nube convectiva, estado del suelo, evaporación, fenómenos
atmosféricos, humedad del suelo, humedad relativa, **nivel**, nubosidad, número de días
con lluvia, precipitación, presión atmosférica, radiación ultravioleta, radiación solar,
temperatura, temperatura del suelo, tensión de vapor, transporte de sedimentos, velocidad
del viento.

Queda cerrado: **el IDEAM no tiene Hs ni Tp en ningún canal.**

### Lo que sí aporta DHIME sobre la API abierta

La variable **Nivel** tiene diez parámetros, y tres importan aquí: `Nivel máximo diario`,
`Nivel mínimo diario` y `Nivel medio diario`. La diferencia de los dos primeros **es el
rango mareal diario ya calculado**, sobre dato validado, sin tener que filtrar caídas de
sensor como en la API cruda.

Series de nivel medio diario en estaciones marinas, consultadas en el portal:

| Estación | Código | Océano | Periodo | Días |
|---|---|---|---|---|
| ESCUELA NAVAL CIOH | 14019030 | Caribe, Cartagena | 2016-01-01 a **2024-08-01** | 3.135 |
| BUENAVENTURA IDEAM | 53119010 | Pacífico | 2013-01-01 a 2021-02-27 | 2.979 |
| JUANCHACO | 54077210 | Pacífico, Bahía Málaga | 2017-03-28 a 2019-12-31 | 1.008 |

Dos cosas que esto cambia:

1. **Escuela Naval CIOH llega hasta 2024**, cuatro años más allá del corte de la API
   abierta, y es la mejor serie mareográfica del Caribe colombiano disponible en el IDEAM.
   Es el sustituto natural de Isla Tesoro para el rango mareal del Caribe.
2. **Buenaventura IDEAM** da el rango mareal de Buenaventura de fuente primaria, que es
   justo el pendiente número 4 de la sección 13 de la especificación.

Isla Tesoro (INVEMAR) **no aparece** en DHIME bajo Cartagena; solo está en la API abierta.
Los dos canales no traen lo mismo, hay que mirar ambos.

### Rango mareal del Caribe medido sobre el dato descargado

Descargado el 25 de agosto de 2026: Escuela Naval CIOH, nivel máximo y mínimo diario,
2016-01-01 a 2024-08-01, 4.006 registros en centímetros. Restando mínimo de máximo día a
día, con 2.003 días completos:

| | Rango mareal diario |
|---|---|
| Medio | **31,2 cm** |
| Mediana | 31,0 cm |
| Percentil 5 | 18,0 cm |
| Percentil 95 | 44,0 cm |
| Máximo | 81,0 cm |

Esto **corrige al alza** el dato que la especificación traía como [V] de segunda mano. La
especificación dice "0,20 a 0,30 m, rara vez más de 0,50 m"; ocho años y medio de
mareógrafo dan una media de 0,31 m y un máximo de 0,81 m. El orden de magnitud aguanta y
la conclusión de inviabilidad de la presa mareal en el Caribe no cambia, pero la cifra que
entre al simulador debería ser **0,31 m medidos**, no 0,25 m citados.

**Advertencia que hay que registrar en el apartado 13.** Los 4.006 registros vienen
etiquetados como **"Preliminar"**, nivel de aprobación 900. Ninguno es definitivo. No
existe dato de nivel del mar con aprobación 1200 para esta estación. O se admite el
preliminar declarándolo en pantalla, o no hay dato de rango mareal colombiano de fuente
primaria en el IDEAM. Recomendación: admitirlo y declararlo, porque la alternativa es
peor.

### Rango mareal del Pacífico medido sobre el dato descargado

Descargado el 25 de agosto de 2026: Buenaventura IDEAM (53119010), nivel máximo y mínimo
diario, 2016-01-01 a 2024-12-31, 3.286 registros en centímetros, **1.643 días con máximo y
mínimo**:

| | Rango mareal diario |
|---|---|
| Medio | **3,28 m** |
| Mediana | 3,28 m |
| Percentil 5 | 2,06 m |
| Percentil 95 | 4,63 m |
| Máximo | 5,15 m |

Esto **resuelve el pendiente número 4** de la sección 13 de la especificación, y además lo
matiza: los 4,2 m que se atribuían a Buenaventura **no son el rango medio, son cercanos al
de mareas vivas**. El medio es 3,28 m y el percentil 95 es 4,63 m. Usar 4,2 m como valor
típico sobreestima la energía de una presa mareal en un 60 %, porque la dependencia es
cuadrática: (4,2/3,28)² = 1,64.

Contraste que el simulador debe hacer evidente, ahora con las dos cifras medidas:

| | Caribe (Escuela Naval) | Pacífico (Buenaventura) | Relación |
|---|---|---|---|
| Rango medio | 0,31 m | 3,28 m | 10,6 a 1 |
| Energía por unidad de área, proporcional a R² | 1 | **112** | 112 a 1 |

Y frente a La Rance, con 8 m: el Caribe da (0,31/8)² = 0,0015, es decir **unas 670 veces
menos** energía por unidad de área embalsada. La cifra que traía la especificación era
"unas 700 veces", calculada con 0,30 m estimados. Medida, son 670. La conclusión no
cambia.

Límites de descarga declarados: 50 años y 50 estaciones para etiquetas anuales, 30 años y
40 estaciones para diarias, 10 años y 20 estaciones para horarias. Cada dato viene con
nivel de aprobación: preliminar 900, en revisión 1100, definitivo 1200. **Para el
simulador solo debería entrar 1200.**

## 5. Qué queda sin resolver en el IDEAM

- Hs y Tp para cualquier punto del Caribe colombiano. No está en el IDEAM. Vías: DIMAR o
  CIOH para las boyas, o reanálisis (ERA5, IOWAGA) para serie sintética.
- Densidad de potencia del oleaje en San Andrés (pendiente 1 de la sección 13). Hay boya
  activa allí, operada por la DIMAR.
- Islas del Rosario (pendiente 2) tiene mareógrafo pero no oleaje.

---

## 6. Archivos descargados

En `datos/ideam/`:

| Archivo | Origen | Contenido |
|---|---|---|
| `nivel_mar_juanchaco_horario_2005-2020.csv` | API abierta | 83.611 registros horarios, Pacífico |
| `nivel_mar_islatesoro_10min_2012-2020.csv` | API abierta | 194.733 registros de 10 minutos, Caribe |
| `dhime_escuela_naval_cioh_nivel_max_min_diario_2016-2024.csv` | Portal DHIME | 4.006 registros diarios en cm, Caribe |
| `dhime_buenaventura_ideam_nivel_max_min_diario_2016-2024.csv` | Portal DHIME | 3.286 registros diarios en cm, Pacífico |
| `descargar_ideam.py` | — | Regenera los dos CSV de la API. Solo biblioteca estándar. |

Los dos CSV de DHIME **no se pueden regenerar por script**. El portal expone un endpoint
(`modulopersonalizado.ideam.gov.co/DhimeServicePortal/api/Listas/ConsultarListaSeriesTiempoEstacionesPorFiltroString`,
con etiquetas `NV_MX_D` y `NV_MN_D`), pero llamarlo fuera de la aplicación devuelve HTTP
400: manda algo más que no queda expuesto. Hay que pasar por el formulario, y cada consulta
tarda entre dos y diez minutos en devolver el ZIP. Consultas grandes, de varias estaciones
o periodos largos, no vuelven nunca; conviene pedir una estación y una etiqueta por vez.

El simulador debe leer estos archivos, **nunca la red**. La serie de la API terminó en
2020 y no crece, así que una consulta en vivo no aporta datos más frescos y sí añade un
punto de fallo durante la sustentación.
