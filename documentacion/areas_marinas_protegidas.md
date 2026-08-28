# Áreas marinas protegidas y restricción de emplazamiento

Fecha de consulta: 25 de agosto de 2026.

## Por qué esto entra al simulador

La especificación puntúa el emplazamiento por recurso, profundidad y cercanía a la costa
(apartado 7), pero no por si el sitio es legalmente utilizable. Un emplazamiento dentro de
un Parque Nacional Natural no admite una granja undimotriz por mucho que el oleaje
acompañe. Es un criterio eliminatorio, no un factor de puntuación, y el panel de
emplazamiento debería reflejarlo.

## Fuente

RUNAP, Registro Único Nacional de Áreas Protegidas, servido por Parques Nacionales
Naturales de Colombia como capa ArcGIS pública, **sin registro ni clave**:

```
https://mapas.parquesnacionales.gov.co/arcgis/rest/services/pnn/runap/FeatureServer/0
```

1.908 áreas protegidas en total, de las cuales **37 tienen superficie marina**. El campo
que las distingue es `area_ha_maritima_geografica`, mayor que cero. Área marina protegida
total: **305.335 km²**.

El servicio admite consulta espacial, así que se le puede preguntar directamente qué áreas
tocan un punto. Es lo que hace `datos/runap/descargar_runap.py`.

## Resultado para los emplazamientos del simulador

Consulta de intersección con un radio de 5 km alrededor de cada punto:

| Emplazamiento | Áreas protegidas | Veredicto |
|---|---|---|
| **Isla Fuerte** (9,390 N; -76,180 W) | ninguna | **Libre** |
| **Tumaco** (1,903 N; -78,912 W) | ninguna | Libre |
| **Islas del Rosario** (10,195 N; -75,747 W) | Los Corales del Rosario y de San Bernardo | **Parque Nacional Natural** |
| **Bahía Málaga** (3,925 N; -77,349 W) | Uramba Bahía Málaga; La Sierpe | **Parque Nacional Natural** |
| **San Andrés** (12,569 N; -81,701 W) | Seaflower; Jhonny Cay; una reserva civil | **Área Marina Protegida** |

Ampliando a 30 km, Isla Fuerte solo alcanza el DRMI de Bahía de Cispatá, en el delta del
Sinú, que no afecta a la isla.

### Lo que esto cambia en la especificación

1. **Isla Fuerte se refuerza como emplazamiento por defecto.** Ya era el único con cifra
   de oleaje revisada por pares y zona no interconectada; ahora además es el único
   candidato sin restricción de área protegida. Es un argumento nuevo para la
   sustentación.
2. **Islas del Rosario queda descartada, y no por falta de datos.** El pendiente número 2
   del apartado 13 pedía la densidad de potencia allí. Ya no hace falta buscarla: es
   Parque Nacional Natural. El pendiente se cierra por vía legal.
3. **Bahía Málaga queda descartada para turbina de corriente mareal.** Es justo donde el
   estudio del Pacífico modela los 0,54 m/s que la especificación cita, y donde está el
   mareógrafo de Juanchaco. El dato sirve como referencia de recurso; el sitio no sirve
   como emplazamiento. Conviene decirlo en pantalla, porque es una lección honesta: el
   mejor dato disponible no siempre está en un sitio utilizable.
4. **San Andrés arrastra la restricción de Seaflower**, además de no tener cifra de
   densidad de potencia publicada. Se mantiene como escenario secundario, ahora con dos
   motivos.

## Las áreas marinas protegidas más grandes

| Área | Categoría | Superficie marina |
|---|---|---|
| Yuruparí - Malpelo | Distrito Nacional de Manejo Integrado | 123.710 km² |
| Reserva de Biósfera Seaflower | Distrito Nacional de Manejo Integrado | 62.141 km² |
| Malpelo | Santuario de Fauna y Flora | 48.151 km² |
| Cordillera Beata | Reserva Natural | 33.125 km² |
| Colinas y Lomas Submarinas del Pacífico Norte | Distrito Nacional de Manejo Integrado | 27.611 km² |

## Archivos

En `datos/runap/`:

| Archivo | Contenido |
|---|---|
| `areas_marinas_protegidas.geojson` | 37 polígonos con todos los atributos, EPSG:4326, 6,3 MB |
| `areas_marinas_protegidas_atributos.json` | Los mismos 37 sin geometría, para tablas |
| `descargar_runap.py` | Regenera el GeoJSON y comprueba emplazamientos. Solo biblioteca estándar. Trae una comprobación con `assert` que falla si la capa cambia. |

Nota técnica: el servidor devuelve 403 al User-Agent por defecto de `urllib`, por eso el
script manda uno propio.
