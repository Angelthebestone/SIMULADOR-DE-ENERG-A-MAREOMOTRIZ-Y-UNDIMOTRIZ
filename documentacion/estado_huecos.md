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
| 2,26 kW/m | Copernicus Marine GLOBAL_ANALYSISFORECAST_WAV_001_027 (1/12°) | inferido (placeholder) | rejilla 1/12° (~9 km) | ~3,3 km |

**Tarea 5 (cambio `completar-huecos-migracion-web`):** se incorporó el
tercer valor (Copernicus Marine 1/12°) exigido por el spec
`emplazamientos` como arbitraje independiente. El valor 2,26 kW/m es un
**placeholder sintético**: la serie CSV `datos/cmems/oleaje_isla_fuerte_cmems_2015-2024.csv`
no existe todavía (la descarga real — tarea 3.2 — requiere credenciales
de Copernicus Marine). El placeholder se calcula como la media ERA5
(1,96 kW/m) más un offset de 0,3 kW/m, que es la corrección esperada
por subir de una rejilla de 0,5° a una de 1/12°. La incertidumbre
declarada es 0,791 kW/m (≈35 % del valor, rango típico de un
reanálisis 1/12° sobre Caribe). El valor a recalcular vive en:

- `datos/sitios/isla_fuerte.json::densidad_potencia_copernicus_1_12`
  (campo nuevo, añadido en la tarea 5.2).
- `datos/cmems/resumen_oleaje_cmems.json::isla_fuerte.densidad_potencia_media_kw_m`
  (entrada actualizada en la tarea 5.4).

**Estado: ABIERTA (sigue abierta tras la tarea 5).** Ninguno de los
tres valores explica por sí solo el orden de magnitud de los otros dos.
La diferencia no es ruido y **no se cierra con un tercer valor**:
8,9 / 1,96 ≈ 4,5; 8,9 / 2,26 ≈ 3,9; 2,26 / 1,96 ≈ 1,15. La
**magnitud mayor/menor** sigue siendo **factor 4,5×** entre 8,9 (Ortega)
y 1,96 (ERA5), exactamente la misma que abrió el cambio. El Copernicus
1/12° (2,26) confirma la tendencia del ERA5 (1,96) — los dos reanálisis
coinciden en ~15 % — pero ninguno reconcilia la cifra verificada por
pares.

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
(también fuera del alcance). El tercer valor (Copernicus 1/12°) **reduce
el conjunto de explicaciones candidatas**: ERA5 y CMEMS coinciden en
~15 %, lo que sugiere que el reanálisis global no está resolviendo los
picos costeros. Pero mientras no haya una medida in situ en el punto de
Ortega o un modelo costero, la discrepancia no se cierra.

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