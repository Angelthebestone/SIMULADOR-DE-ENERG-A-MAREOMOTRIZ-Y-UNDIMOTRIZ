# Estado final de huecos abiertos al cierre del proyecto

> Documento de cierre: registra el estado real (resuelto / abierto) de los
> dos huecos que sobreviven a las tareas 27.5 y 28 de `tasks.md` y que el
> informe debe reflejar literalmente.

---

## 1. Discrepancia de Isla Fuerte (densidad de potencia)

**Origen del hueco.** Isla Fuerte tiene **tres** valores publicados de
densidad de potencia media para el oleaje, con fuentes y resoluciones distintas
que no se reconcilian entre sí:

| Valor | Fuente | Estado | Resolución | Distancia al sitio |
|---:|---|---|---|---:|
| **8,9 kW/m** | Ortega et al. (2013), *Renewable Energy* 57, 240-248 | **verificado** (revisado por pares) | publicación puntual (Isla Fuerte) | 0 km |
| 1,96 kW/m | ERA5-Ocean via Open-Meteo | inferido | rejilla 0,5° (~55 km) | ~23 km |
| 2,25 kW/m | Copernicus Marine GLOBAL_ANALYSISFORECAST_WAV_001_027 (1/12°) | inferido | rejilla 1/12° (~9 km) | ~3,3 km |

El archivo `datos/cmems/resumen_oleaje_cmems.json` registra el valor CMEMS
para Isla Fuerte (celda `9,42N -76,17W ~3,3 km`, 2015-2024,
`densidad_potencia_media_kw_m: null` a la espera de la serie descargada
definitiva; el valor provisional 2,25 kW/m vive en `datos/sitios/isla_fuerte.json`
bajo `densidad_potencia_cmems`).

**Estado: ABIERTA.** Ninguno de los tres valores explica por sí solo el
orden de magnitud de los otros dos. La diferencia no es ruido: 8,9 / 1,96 ≈
4,5; 8,9 / 2,25 ≈ 4,0; 2,25 / 1,96 ≈ 1,15.

**Causas candidatas registradas.** Tomadas del campo
`discrepancia_densidad.explicaciones_candidatas` de `datos/sitios/isla_fuerte.json`:

1. **Resolución de la rejilla.** ERA5 0,5° (~55 km) suaviza picos costeros;
   CMEMS 1/12° (~9 km) mejora pero aún promedia. Ninguno llega a la
   resolución del dato publicado por Ortega (que es una **publicación
   puntual**).
2. **Posición del punto de Ortega.** Costa expuesta al Caribe abierto,
   frente al centroide de la celda CMEMS que cae en el golfo de
   Morrosquillo, más resguardado.
3. **Modelo WAM vs observación.** CMEMS modela Hs y Te con WAM; Ortega
   mide (o transcribe medidas) in situ.

**Qué usa el simulador.** El valor de diseño es **8,9 kW/m** (Ortega,
verificado). No se promedia ni se reemplaza con valores inferidos
(`isla_fuerte.json::densidad_potencia_media.valor` y
`dimensionado.py::AVISO_DISCREPANCIA_ISLA_FUERTE`). Los otros dos valores
se declaran con su fuente y resolución en la misma ficha de sitio, para
que el usuario decida.

**Decisión al cierre.** La discrepancia queda **abierta** y así se reporta.
El proyecto no la cierra porque requiere o bien una campaña de medida in
situ en Isla Fuerte (fuera del alcance del aula), o bien un reanálisis con
un modelo de propagación costera de mayor resolución que el WAM global
(también fuera del alcance).

---

## 2. Hueco de corrientes

**Origen del hueco.** De los cinco sitios precargados, el dato de
`corriente_maxima_ms` llega de fuentes heterogéneas:

| Sitio | Valor | Fuente | Estado declarado |
|---|---:|---|---|
| Isla Fuerte | 0,31 m/s | CMEMS GLORYS12 1/12°, celda `9,42N -76,17W ~3,3 km`, mediana 2015-2024 | inferido |
| San Andrés | 0,28 m/s | CMEMS GLORYS12 1/12°, celda `12,58N -81,67W ~4,1 km`, mediana 2015-2024 | inferido |
| Islas del Rosario | 0,22 m/s | CMEMS GLORYS12 1/12°, celda `10,25N -75,75W ~1,9 km`, mediana 2015-2024 | inferido |
| Bahía Málaga | 0,54 m/s | Quintero y Rueda-Bayona, *Ingeniería y Competitividad* 2019, punto A Bahía Málaga | **verificado** |
| Tumaco | 0,42 m/s | CMEMS GLORYS12 1/12°, celda `1,92N -78,92W ~1,6 km`, mediana 2015-2024 | **inferido** (degradado) |

**Detalle de Tumaco (degradación).** El `corriente_maxima_ms` de Tumaco
estuvo antes marcado como `verificado 0,54 m/s` cuyo origen era un estudio
de Bahía Málaga / Buenaventura. La corrección de procedencia (tarea 10.4)
degradó ese valor a inferido propio del sitio: la celda GLORYS12 sobre
Tumaco da 0,42 m/s y se cita GLORYS como fuente real. El motivo está
registrado en el campo `motivo_degradacion` del JSON de Tumaco:
*"Origen prestado de otra región (Bahía Málaga) - corrección procedencia
10.4"*.

**Verificación archivo a archivo.**

- `datos/sitios/isla_fuerte.json` → declara `corriente_maxima_ms` (0,31 m/s
  GLORYS12, inferido).
- `datos/sitios/san_andres.json` → declara `corriente_maxima_ms` (0,28 m/s
  GLORYS12, inferido).
- `datos/sitios/islas_rosario.json` → declara `corriente_maxima_ms` (0,22
  m/s GLORYS12, inferido).
- `datos/sitios/bahia_malaga.json` → declara `corriente_maxima_ms` (0,54
  m/s Quintero y Rueda-Bayona 2019, verificado).
- `datos/sitios/tumaco.json` → declara `corriente_maxima_ms` (0,42 m/s
  GLORYS12, inferido, antes 0,54 verificado por préstamo — corregido).

Los cinco sitios declaran su corriente. **No hay sitio sin dato de
corriente**: lo que hay son sitios cuyo dato es inferido en vez de
verificado.

**El hueco real.** No es ausencia de dato, sino **resolución y trazabilidad**:

- Tres de los cinco (Isla Fuerte, San Andrés, Islas del Rosario) son
  mediana 2015-2024 de la celda GLORYS12 más cercana, sin estación in
  situ. Para el dispositivo turbina de corriente, esa resolución es
  suficiente para un orden de magnitud; no lo es para decidir
  cubicación de obra civil.
- Bahía Málaga es el único con dato verificado, pero el sitio está
  descartado por PNN (no utilizable). Sirve como referencia de orden de
  magnitud en Pacífico colombiano, no como caso de diseño.

**Estado: parcialmente abierto.** Tres de cinco quedan con dato GLORYS12
(inferido) y uno (Tumaco) tiene la trazabilidad explícita de su
degradación. No se requiere más acción dentro del alcance del proyecto:
queda como **hueco declarado** y se reporta tal cual en el informe.

---

## 3. Resumen para el informe

| Hueco | Estado | Cómo se reporta |
|---|---|---|
| Discrepancia Isla Fuerte | **ABIERTA** | Tres valores con fuente, resolución y distancia al sitio; valor de diseño 8,9 kW/m Ortega (verificado), sin promediar. |
| Corrientes | **PARCIALMENTE ABIERTO** | Cinco de cinco sitios declaran dato; tres son GLORYS12 (inferido), uno verificado en sitio descartado (Bahía Málaga), uno degradado por procedencia (Tumaco). |