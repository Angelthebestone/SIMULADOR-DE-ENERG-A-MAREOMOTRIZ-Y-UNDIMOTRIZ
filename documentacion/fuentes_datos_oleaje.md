# Fuentes de datos de oleaje, batimetría y marea de Tumaco

Fecha de consulta: 25 de agosto de 2026.

## Resumen

Tres vacíos del apartado 13 de la especificación, en el mismo encargo porque los tres
son "recurso oceánico" y comparten método: buscar un canal abierto, descargarlo con
`urllib`, medir en vez de citar, y marcar lo que sigue sin resolver.

| Vacío | Resultado |
|---|---|
| Hs y Tp/Te del Caribe (pendiente 9) | **Resuelto parcialmente.** Serie horaria de 10 años de Open-Meteo/ERA5-Ocean para Isla Fuerte, San Andrés y Tumaco. La magnitud absoluta en Isla Fuerte **no coincide** con el dato revisado por pares (apartado abajo); sirve para la forma de la matriz Hs-Te y la variabilidad mensual, no para reemplazar los 8,9 kW/m de Ortega y otros (2013). |
| Profundidad 30-60 m en Isla Fuerte (apartado 7) | **Resuelto.** Transecto batimétrico GMRT: 30 m entre 3 y 17,5 km de la isla según el rumbo, 60 m entre 10 y 24,25 km. |
| Rango mareal de Tumaco (pendiente 4) | **Resuelto.** Estación mareográfica real de la red GLOSS/IOC en Tumaco, operada por la DIMAR. Rango medio medido: 2,56 m. |

## 1. Oleaje: Open-Meteo Marine API (modelo ERA5-Ocean de ECMWF)

### 1.1 Por qué esta fuente y no otra

Se probó primero Open-Meteo por ser HTTP simple sin clave, como sugería el encargo.
Funcionó a la primera:

```
https://marine-api.open-meteo.com/v1/marine?latitude=9.39&longitude=-76.18&hourly=wave_height,wave_period&start_date=2024-01-01&end_date=2024-01-03
```

El servicio combina varios modelos según la región y la fecha: MeteoFrance MFWAM
(0,08°), ECMWF WAM (9 km), NCEP GFS Wave, DWD EWAM/GWAM, y **ERA5-Ocean** (0,5°, desde
1940 al presente). Sin especificar modelo (`best_match`), el punto de Isla Fuerte solo
devolvió datos desde noviembre de 2021: los modelos de mayor resolución no cubren el
Caribe colombiano antes de esa fecha. Pidiendo explícitamente `models=era5_ocean` se
obtienen datos desde 1940, comprobado con una consulta a 1990. **Se usó siempre
`era5_ocean`** por ser el único con cobertura larga en la zona. [V]

No se exploraron IOWAGA/Ifremer ni los GRIB de NOAA NOMADS: ERA5-Ocean ya resolvió el
objetivo (serie de varios años, Hs y periodo) por el camino más corto, y añadir un
segundo reanálisis no cambia la conclusión de este apartado. Si en el futuro hace
falta mayor resolución espacial, esas dos son las siguientes vías a probar.

### 1.2 Qué significa `wave_period` en este modelo — y por qué es exactamente Te

Este es el hallazgo que hace útil la serie para la ecuación M1 de la especificación
(`J = ρ g² Hm0² Te / 64π`). Open-Meteo no documenta la definición espectral exacta de
su variable `wave_period`, pero el modelo `era5_ocean` solo expone cuatro variables
horarias — `wave_height`, `wave_period`, `wave_peak_period`, `wave_direction` — que
coinciden una a una con las cuatro variables básicas del archivo de oleaje de ERA5 de
ECMWF: altura significativa (`swh`), **periodo medio de ola (`mwp`, parámetro 232)**,
periodo de pico (`pp1d`) y dirección media (`mwd`). Ninguna variable de swell o de mar
de viento aparece con `era5_ocean` (unidad `"undefined"` en la respuesta), lo cual es
coherente con que ERA5 no archiva esa partición.

La documentación oficial de ECMWF (Bidlot, *Ocean wave model output parameters*,
<https://confluence.ecmwf.int/download/attachments/59774192/wave_parameters.pdf>)
define el "mean wave period" (`mwp`) como:

> Tm₋₁ = m₋₁ / m0 ... también conocido como el periodo energético medio de ola.
> Junto con Hs, puede usarse para determinar el flujo de energía de oleaje por unidad
> de longitud de cresta: P = ρw g² Hs² Tm₋₁ / 64π.

Esa es **literalmente la ecuación M1 de la especificación**, con la misma constante.
Es decir: **`wave_period` en `era5_ocean` es Te**, no Tz ni un periodo medio genérico.
[V] la definición de ECMWF; [I] con confianza alta que Open-Meteo reexporta ese campo
sin transformarlo, por la correspondencia exacta de las cuatro variables disponibles.
Confirmado además por literatura de recursos undimotriz (Zheng y otros, *Frontiers in
Marine Science*, 2022): "el periodo medio (Tm−1) también se conoce como el periodo de
energía (Te) según la documentación de ECMWF, y puede usarse directamente" en esa
ecuación.

### 1.3 Series descargadas

10 años, horario, 2015-01-01 a 2024-12-31, 87.672 registros por punto:

| Emplazamiento | Punto pedido | Rejilla ERA5 usada (0,5°) | Distancia aprox. | Hs media | Te media | J media |
|---|---|---|---|---|---|---|
| Isla Fuerte | 9,390 N; -76,180 W | 9,5 N; -76,0 W | ~23 km | 0,76 m | 5,39 s | **1,96 kW/m** |
| San Andrés | 12,569 N; -81,701 W | 12,5 N; -81,5 W | ~23 km | 1,46 m | 6,42 s | **8,26 kW/m** |
| Tumaco | 1,903 N; -78,912 W | 2,0 N; -79,0 W | ~15 km | 0,93 m | 7,66 s | **3,37 kW/m** |

J calculado hora a hora con la fórmula del apartado M1 (`0,4906 · Hs² · Te`, en kW/m) y
promediado, no con las medias de Hs y Te por separado (la relación es cuadrática en
Hs, promediar antes introduce sesgo).

**Reserva importante en Isla Fuerte.** El punto de rejilla de ERA5-Ocean, a 0,5° de
resolución (~55 km), cae a unos 23 km de la isla, dentro del golfo de Morrosquillo, más
resguardado que la costa expuesta al Caribe abierto. La densidad de potencia media
resultante, 1,96 kW/m, es **unas 4,5 veces menor** que los 8,9 kW/m de Ortega y otros
(2013) que trae la especificación como valor de diseño revisado por pares. No se sabe
con certeza cuál de las dos causas pesa más: la rejilla gruesa suaviza los picos de
oleaje cerca de la costa, o el punto de Ortega y otros está en una posición más
expuesta que el centroide de la celda de 55 km. **No se debe reemplazar el valor de
8,9 kW/m con este dato**; el uso correcto de esta serie es la forma de la matriz
Hs-Te y la variabilidad estacional, ambas coherentes con lo que reporta el CIOH (ver
1.5). [I], confianza media.

Variabilidad mensual de J en Isla Fuerte, mismo cálculo por mes:

| Mes | Ene | Feb | Mar | Abr | May | Jun | Jul | Ago | Sep | Oct | Nov | Dic |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| J medio (kW/m) | 3,69 | 4,59 | 3,58 | 1,94 | 1,09 | 1,18 | 1,67 | 1,10 | 0,59 | 0,59 | 1,11 | 2,52 |

Diciembre a marzo (alisios) concentra la energía, igual que reportan las fichas del
CIOH para San Andrés y Coveñas (apartado 1.5). Esto es justo la "baja variación
mensual" que pide el apartado 7 como criterio de buena ubicación: Isla Fuerte **no la
cumple**, la razón entre el mes más energético (febrero, 4,59 kW/m) y el más pobre
(septiembre u octubre, 0,59 kW/m) es de casi 8 a 1.

### 1.4 Matriz de dispersión Hs-Te, Isla Fuerte

Ocurrencia porcentual sobre las 87.672 horas de la serie, para ilustrar el formato que
pide el módulo M9 (AEP por matriz de ocurrencia). Filas: Hs (m). Columnas: Te (s).

| Hs \\ Te | 0-4 | 4-5 | 5-6 | 6-7 | 7-8 | >8 |
|---|---|---|---|---|---|---|
| 0,0-0,5 | 7,0 % | 11,7 % | 4,2 % | 0,2 % | 0,0 % | 0,0 % |
| 0,5-1,0 | 1,9 % | 11,1 % | 27,1 % | 14,2 % | 0,6 % | 0,0 % |
| 1,0-1,5 | 0,0 % | 1,5 % | 5,9 % | 8,1 % | 3,4 % | 0,1 % |
| 1,5-2,0 | 0,0 % | 0,0 % | 1,0 % | 1,2 % | 0,5 % | 0,1 % |
| 2,0-2,5 | 0,0 % | 0,0 % | 0,0 % | 0,1 % | 0,0 % | 0,0 % |

El estado de mar más frecuente es Hs entre 0,5 y 1,0 m con Te entre 5 y 6 s (27,1 % de
las horas). Hs máximo de toda la serie: 2,24 m, dentro del rango 0,5-4,0 m que acota el
apartado 8 de la especificación.

### 1.5 CIOH/DIMAR: fichas de climatología portuaria (con reserva de qué son)

En `cioh.dimar.mil.co` sí hay algo descargable, aunque no es una serie numérica: fichas
en PDF por puerto del Caribe, con **rosas de oleaje mensuales** (altura significativa
por rumbo) calculadas con el modelo SWAN 1979-2010 del propio CIOH. Es la única fuente
primaria colombiana con algo de oleaje para el Caribe, y confirma de forma
independiente la estacionalidad que muestra ERA5:

| Puerto | Hs, diciembre a marzo (alisios) | Hs, resto del año | Dirección dominante |
|---|---|---|---|
| San Andrés | 1,0 a 2,5 m | menor a 1 m | NE/E |
| Coveñas (55 km de Isla Fuerte) | hasta 2,5 m | menor a 1,5 m | N/NNE |

Fuente: *Simulating Wave Nearshore* (SWAN), CIOH, 1979-2010. [V] cualitativo: confirma
el orden de magnitud y la estacionalidad, **no da una cifra de kW/m**. Sigue sin
resolverse el pendiente 1 de la especificación (densidad de potencia publicada en
San Andrés), aunque pierde urgencia porque San Andrés está dentro de la Reserva de
Biósfera Seaflower (`areas_marinas_protegidas.md`).

No se encontró portal de descarga de series numéricas en `cioh.dimar.mil.co` ni en
`cecoldo.dimar.mil.co/geonetwork` (el buscador del geonetwork devolvió error 500 en la
consulta de prueba). Las siete boyas de oleaje del catálogo del IDEAM (Turbo, San
Andrés, Barranquilla, Puerto Bolívar, Gorgona, Tumaco, Buenaventura) **siguen sin
canal abierto**: se comprobó y no se insistió más, tal como pedía el encargo.

### 1.6 Archivos

En `datos/oleaje/`:

| Archivo | Contenido |
|---|---|
| `oleaje_isla_fuerte_era5_2015-2024.csv` | 87.672 horas: Hs, Te, Tp, dirección |
| `oleaje_san_andres_era5_2015-2024.csv` | ídem, San Andrés |
| `oleaje_tumaco_era5_2015-2024.csv` | ídem, Tumaco |
| `resumen_oleaje_era5.json` | Medias por punto, coordenadas de rejilla usadas |
| `cioh_climatologia_san_andres.pdf` | Ficha CIOH, rosas de oleaje mensuales |
| `cioh_climatologia_covenas.pdf` | Ficha CIOH, rosas de oleaje mensuales |
| `descargar_oleaje.py` | Regenera los tres CSV y el resumen. Solo biblioteca estándar. |
| `descargar_cioh_climatologia.py` | Regenera los dos PDF. Solo biblioteca estándar. |

El simulador debe leer estos archivos, nunca la red.

---

## 2. Batimetría de Isla Fuerte: GMRT

### 2.1 Fuente

GMRT (Global Multi-Resolution Topography, Lamont-Doherty Earth Observatory, Columbia
University) sirve un modelo combinado de topografía y batimetría (compila GEBCO más
levantamientos multihaz donde existen) por HTTP simple, sin clave:

```
https://www.gmrt.org/services/PointServer?latitude=9.39&longitude=-76.18&format=text
```

Devuelve un único número en metros: positivo es tierra, negativo es profundidad bajo
el nivel del mar. El propio centro de Isla Fuerte (9,390 N; -76,180 W) da +25 m: es la
isla misma, no el mar.

### 2.2 Método

Transecto radial: 11 rumbos (cada 22,5° más N y NW adicionales) por 25 distancias (1 a
25 km, paso de 1 km) alrededor del centro de Isla Fuerte, 275 consultas. Para cada
rumbo se interpola linealmente la distancia a la que el perfil cruza -30 m y -60 m.

### 2.3 Resultado

| Rumbo | Distancia a 30 m | Distancia a 60 m |
|---|---|---|
| N | 6,5 km | 17,0 km |
| NNW | 4,33 km | 15,0 km |
| **NW** | **5,41 km** | **10,0 km** |
| NNE | 3,0 km | 24,25 km |
| W | 10,67 km | 19,75 km |
| SW | 8,11 km | sin cruzar en 25 km |
| NE | 17,5 km | sin cruzar en 25 km |
| E, SE, S | sin cruzar en 25 km | sin cruzar en 25 km |

**El camino más corto a la banda de 30-60 m que pide el apartado 7 es hacia el
noroeste: 30 m a 5,4 km de la isla, 60 m a 10 km.** Hacia el norte, algo más lejos: 30 m
a 6,5 km, 60 m a 17 km. Hacia el sur, sureste y este (en dirección al continente y a la
plataforma somera del delta del Sinú y el golfo de Morrosquillo) el fondo se mantiene
por encima de 30 m dentro del radio explorado: no hay corte con 30 m ni 60 m en esos
rumbos a menos de 25 km. [V]

Esto responde el criterio pendiente del apartado 7: **Isla Fuerte sí tiene profundidad
de 30 a 60 m disponible, a entre 5 y 17 km de la costa según el rumbo elegido**, lo
cual es razonable para un tendido de cable pero deja de cumplir con holgura el criterio
de "proximidad a la costa" si el dispositivo tiene que anclarse en esa banda de
profundidad.

### 2.4 Archivos

En `datos/batimetria/`:

| Archivo | Contenido |
|---|---|
| `transecto_isla_fuerte_gmrt.csv` | 275 puntos: rumbo, distancia, lat/lon, profundidad |
| `resumen_batimetria_isla_fuerte.json` | Distancia a 30 m y 60 m por rumbo |
| `descargar_batimetria.py` | Regenera el transecto y el resumen. Solo biblioteca estándar. |

---

## 3. Rango mareal de Tumaco

### 3.1 Fuente

El pendiente 4 de la sección 13 quedaba abierto porque no hay mareógrafo del IDEAM en
Tumaco. Sí existe uno de la **DIMAR**, alimentando la red internacional GLOSS a través
del **IOC Sea Level Station Monitoring Facility** (UNESCO-IOC / Flanders Marine
Institute), sin clave ni registro para los datos crudos:

```
http://www.ioc-sealevelmonitoring.org/service.php?query=data&code=tumc&timestart=2024-01-01&timestop=2024-02-01
```

Estación `tumc`, GLOSS core ID 171, en 1,82 N; -78,7287 W (canal de acceso al puerto de
Tumaco, unos 25 km de la ciudad), operada por la Dirección General Marítima de
Colombia. Dos sensores en paralelo, radar (`rad`) y burbujeador (`bub`), muestreo cada
1-2 minutos. [V]

El servicio trunca cualquier solicitud a como mucho ~31 días de datos aunque se pida un
rango mayor; hay que pedir mes a mes. La cobertura tiene huecos de varias semanas
(mantenimiento, caídas de la conexión FTP), documentados por mes en la salida del
script.

### 3.2 Filtrado

El feed en vivo trae caídas de sensor puntuales con valores de cientos de metros
(0,04 % de 1.114.534 lecturas de la prueba 2023-2025 quedaba fuera de 0,5-8,0 m; dentro
de ese rango el percentil 99,9 es 5,92 m, coherente con marea de hasta 6 m en el
Pacífico colombiano). Se descartan esas lecturas puntuales antes de calcular el rango
diario (máximo menos mínimo por día, exigiendo al menos 10 lecturas válidas ese día),
mismo criterio que ya usa `descargar_ideam.py` para Juanchaco e Isla Tesoro.

### 3.3 Resultado

Sensor radar, enero de 2023 a agosto/septiembre de 2025 (con huecos), 898 días con
rango calculable:

| | Rango mareal diario |
|---|---|
| Medio | **2,56 m** |
| Mediana | 2,56 m |
| Percentil 5 | 1,59 m |
| Percentil 95 | 3,65 m |
| Máximo | 4,06 m |

**Cifras revisadas.** Una primera versión de esta tabla daba 2,62 m de media y 6,95 m de
máximo. La serie cruda de la IOC trae picos de sensor —hay valores absurdos de decenas y
hasta centenares de metros— que contaminan el máximo y arrastran la media. Los valores de
arriba se recalcularon tomando como rango diario el intervalo entre los percentiles 1 y 99
de cada día y descartando después cinco días cuyo rango seguía superando los 5 m. Quedan
817 días de 822. El máximo pasa de 6,95 m a 4,06 m, que es coherente con un percentil 95
de 3,65 m; los 6,95 m eran ruido, no una marea real.

**Esto resuelve el pendiente 4 de la sección 13 para Tumaco.** Los 3,8 m que circulaban
sin fuente primaria **sobreestiman el rango típico**: el medio medido es 2,56 m, un
33 % menos. Es el mismo patrón que ya se vio con Buenaventura (el dato citado
resultó cercano a mareas vivas, no al medio): conviene revisar si la fuente original de
"3,8 m" describía sicigia y no promedio.

**Cruce con la tabla de pronóstico astronómico de la DIMAR** (`cccp.dimar.mil.co`, CIOH
Pacífico), que publica predicción armónica oficial del puerto de Tumaco: en el día
consultado el rango de los dos ciclos de marea fue de 2,55 m y 2,18 m, del mismo orden
que el medio medido aquí. Es una comprobación independiente de método (predicción
armónica contra medición directa de sensor), no una segunda serie descargada. [V]

### 3.4 Advertencias de uso

- El IOC SLSMF es un servicio de **monitoreo operativo en tiempo real**, pensado para
  alertas de tsunami, no un archivo climático con control de calidad tipo IDEAM/DHIME.
  El filtrado de caídas de sensor lo hace este script, con un umbral fijo simple; no
  hay una bandera de calidad en el dato de origen como el "preliminar/definitivo" del
  IDEAM.
- El cero del sensor es el cero arbitrario del instrumento, no un dato hidrográfico
  declarado. Sirve para **rango** (diferencia diaria), igual que las series de IDEAM ya
  documentadas, no para cota absoluta.
- Cobertura 2023-2025 con huecos; no es una climatología de varias décadas como la de
  Buenaventura o Escuela Naval CIOH.

### 3.5 Archivos

En `datos/mareas/`:

| Archivo | Contenido |
|---|---|
| `nivel_mar_tumaco_ioc_2023-2025.csv` | 1.114.534 registros de 1-2 minutos, sensor radar preferido |
| `resumen_mareas_tumaco.json` | Rango mareal diario: medio, mediana, percentiles, máximo |
| `descargar_mareas_tumaco.py` | Regenera la serie y el resumen. Solo biblioteca estándar. |

---

## 4. Qué queda pendiente después de este encargo

1. **Densidad de potencia de oleaje en kW/m para Isla Fuerte, de una fuente con mejor
   resolución que ERA5-Ocean.** La discrepancia de 4,5 veces frente a Ortega y otros
   (2013) no está explicada; ni IOWAGA/Ifremer ni los GRIB de NOAA NOMADS se llegaron a
   probar, y alguno de los dos podría resolver la duda con mejor rejilla.
2. **San Andrés sigue sin cifra numérica de kW/m publicada**, solo la ficha cualitativa
   del CIOH y la estimación ERA5 (8,26 kW/m, con la misma reserva de resolución que
   Isla Fuerte). Baja prioridad: el emplazamiento está dentro de Seaflower.
3. **Ninguna de las siete boyas de oleaje de la DIMAR/INVEMAR tiene canal abierto.** Se
   comprobó `cioh.dimar.mil.co` y `cecoldo.dimar.mil.co/geonetwork` sin éxito. Pedir
   acceso directo a la DIMAR/CIOH (hay un formulario de "Solicitar accesos a datos" en
   `cecoldo.dimar.mil.co/web/solicitudes`) es la vía que queda, y requiere gestión
   humana, no un script.
