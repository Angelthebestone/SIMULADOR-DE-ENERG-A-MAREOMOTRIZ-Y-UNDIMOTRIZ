# Hueco 28.6 — Profundidad de los emplazamientos sin dato (transecto propio)

> Corresponde a la tarea 167 del plan `migrar-interfaz-a-web-y-ampliar-fuentes`.

## Descripción

El panel de puntuación del simulador evalúa cada emplazamiento contra el
criterio "profundidad del orden de 30 a 60 m"
(`openspec/changes/migrar-interfaz-a-web-y-ampliar-fuentes/specs/emplazamientos/spec.md`,
Requirement: Panel de puntuación del emplazamiento). Para que ese
criterio pueda puntuarse, el sitio debe declarar la distancia a la que
la profundidad cae en el rango 30-60 m desde la costa. Solo Isla Fuerte
tiene ese transecto (hecho con GMRT, verificado, y registrado como
`profundidad_30m_km_nw`, `profundidad_60m_km_nw`,
`profundidad_30m_rango_km`, `profundidad_60m_rango_km` en
`datos/sitios/isla_fuerte.json`).

Los otros cuatro sitios declaran la profundidad como `pendiente` o como
0 m, lo que impide puntuar el criterio y obliga a presentarlo como
`pendiente` en el panel:

- Bahía Málaga (`datos/sitios/bahia_malaga.json`):
  `profundidad_pto.valor: 0.0`, `estado: "pendiente"`,
  fuente: "Sin transecto GMRT específico publicado para Bahía Málaga,
  pendiente extracción".
- Tumaco (`datos/sitios/tumaco.json`):
  `profundidad_estimada.valor: 0.0`, `estado: "pendiente"`,
  fuente: "Sin transecto GMRT propio para Tumaco, pendiente extracción
  batimetría específica".
- Islas del Rosario (`datos/sitios/islas_rosario.json`): no tiene
  campo de profundidad propio; como el sitio está descartado por área
  protegida, la profundidad no se necesita para puntuar pero sí
  conviene tenerla si se quiere usar como contraste.
- San Andrés (`datos/sitios/san_andres.json`): no tiene campo de
  profundidad propio, situación similar a la de Islas del Rosario.

El criterio "banda de 30 a 60 m" no puede puntuarse sobre estos cuatro
sitios, y la especificación pide expresamente que un criterio sin dato
propio aparezca como pendiente, no como cumplido ni como incumplido. El
camino para puntuarlo es extraer un transecto radial batimétrico propio
por sitio, no reutilizar una rejilla heredada (que es justamente lo que
se hizo con ERA5 para densidad de potencia y que ya se sabe que produce
discrepancias).

## Fuentes necesarias

- **GEBCO** (General Bathymetric Chart of the Oceans): rejilla global
  batimétrica, ya en uso para Isla Fuerte. Referencia y metodología en
  `documentacion/fuentes_datos_oleaje.md`. Rejillas disponibles:
  GEBCO_2024 (15 arc-seconds) y GEBCO_2023.
- **Cartas náuticas del CIOH** (Centro de Investigaciones
  Oceanográficas e Hidrográficas de Cartagena), Dimar: cartas náuticas
  oficiales de la costa Pacífica y Caribe colombianas. Especialmente
  relevantes para Bahía Málaga y Tumaco, donde GEBCO puede tener
  resolución insuficiente o estar desactualizada en zonas costeras.
- **EMODnet Bathymetry** (European Marine Observation and Data
  Network): rejilla batimétrica de alta resolución para Europa y
  complemento global.
- **Datos batimétricos locales publicados** por Invemar, Dimar o
  universidades colombianas para los sitios concretos.

## Estado actual

- `datos/sitios/isla_fuerte.json` (campos verificados):
  - `profundidad_30m_km_nw: 5.41 km` (camino más corto al NW a 30 m,
    GMRT).
  - `profundidad_60m_km_nw: 10.0 km` (rumbo NW 10 km a 60 m).
  - `profundidad_30m_rango_km: 3.0 km` (mínima 3,0 km NNE, máxima 17,5
    km NE).
  - `profundidad_60m_rango_km: 24.25 km` (entre 10 y 24,25 km según
    rumbo, sin cruzar a S/E/SE).
  - Trazabilidad: `datos/batimetria/resumen_batimetria_isla_fuerte.json`
    y `datos/batimetria/transecto_isla_fuerte_gmrt.csv`.
- `datos/sitios/bahia_malaga.json`:
  - `profundidad_pto: 0.0`, `estado: "pendiente"`, "Sin transecto GMRT
    específico publicado para Bahía Málaga".
- `datos/sitios/tumaco.json`:
  - `profundidad_estimada: 0.0`, `estado: "pendiente"`, "Sin transecto
    GMRT propio para Tumaco, pendiente extracción batimetría
    específica".
- `datos/sitios/islas_rosario.json`: sin campo de profundidad.
- `datos/sitios/san_andres.json`: sin campo de profundidad propio.
- `datos/batimetria/`: solo contiene el transecto de Isla Fuerte; no
  hay extracción análoga para los demás sitios.
- `documentacion/fuentes_datos_oleaje.md` documenta la metodología
  GMRT usada para Isla Fuerte, pero no se ha replicado para los
  demás sitios.

## Intentos previos

1. **Transecto GMRT para Isla Fuerte**: extraído y verificado, con 11
   rumbos y distancias mínimas y máximas a las isobatas de 30 m y 60 m.
   Sirve como plantilla metodológica.
2. **No se ha extraído** un transecto análogo para Bahía Málaga, Tumaco,
   Islas del Rosario ni San Andrés. La razón principal es que se
   priorizó cerrar el caso de Isla Fuerte como sitio por defecto antes
   de extender la metodología a los demás.
3. **No se han consultado cartas náuticas del CIOH**: están listadas
   como fuente prioritaria para Colombia, pero no se han descargado ni
   procesado.

## Plan de cierre

1. Para cada uno de los cuatro sitios pendientes (Bahía Málaga, Tumaco,
   Islas del Rosario, San Andrés) extraer un transecto radial batimétrico
   propio desde la costa en 8 a 12 rumbos usando GEBCO_2024 (15
   arc-seconds) o rejilla equivalente. Registrar la distancia a la que
   se cruzan las isobatas de 30 m y 60 m.
2. Cuando GEBCO no tenga resolución suficiente en zonas costeras
   (especialmente Pacífico colombiano y bahías pequeñas), complementar
   con cartas náuticas del CIOH (Dimar) que cubran el área, citando la
   carta concreta y su año de edición.
3. Generar para cada sitio un archivo
   `datos/batimetria/transecto_<id>_batim.csv` y un resumen JSON
   paralelo al de Isla Fuerte, registrando el rumbo, la distancia al
   primer cruce de 30 m y al primer cruce de 60 m, y el rango
   observado entre rumbos.
4. Actualizar `datos/sitios/<id>.json` con los nuevos campos
   `profundidad_30m_rango_km`, `profundidad_60m_rango_km` y, donde
   aplique, `profundidad_30m_km_*` y `profundidad_60m_km_*` por rumbo.
   Marcar el estado como `verificado` cuando la fuente sea trazable y
   como `inferido` cuando se base en una rejilla sin cartografía local.
5. Reejecutar el panel de puntuación del simulador para cada sitio y
   confirmar que el criterio de profundidad ya puede puntuarse como
   cumplido o incumplido (cuando el rango de distancia observado
   incluya la banda 30-60 m en alguna distancia razonable del
   dispositivo) o como pendiente (cuando el rango observado no incluya
   esa banda).
6. Documentar la metodología y las fuentes en
   `documentacion/fuentes_datos_oleaje.md`, junto al caso de Isla
   Fuerte, para que la trazabilidad quede explícita.

## Criterio de cierre

El hueco se considera cerrado cuando los cuatro sitios pendientes
(Bahía Málaga, Tumaco, Islas del Rosario, San Andrés) tienen en su
archivo JSON un campo de profundidad con un valor distinto de 0 y
estado `verificado` o `inferido`, acompañado de un archivo CSV en
`datos/batimetria/` con el transecto radial extraído y la fuente
trazable (GEBCO o cartas náuticas del CIOH). El panel de puntuación
del simulador debe poder evaluar el criterio de la banda 30-60 m sobre
los cinco sitios.