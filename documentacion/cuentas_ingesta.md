# Cuentas y credenciales de ingesta (tarea 3.1)

> Documento de referencia para regenerar las series externas congeladas en
> `datos/`. **El simulador arranca sin ninguna** de estas credenciales:
> solo leen este documento quienes necesiten volver a ejecutar un script
> de `datos/<fuente>/descargar_*.py`.

Reglas del proyecto:

- **Credenciales nunca en el repo.** Todos los archivos listados en este
  documento están excluidos de Git por `.gitignore` (ver lista al final).
- **Si una credenciales falta, el script falla con mensaje claro**, no por
  timeout: cada `descargar_*.py` está escrito de forma que un `import` que
  no se satisface, o un endpoint que devuelve 401/403, termina con
  `SystemExit("...")` y un texto accionable.

---

## 1. Fuentes sin credenciales (públicas)

Estas fuentes se pueden descargar hoy mismo desde el repositorio sin
registro previo, y están marcadas como tales en cada `descargar_*.py`:

| Fuente | Endpoint | Script | Notas |
|---|---|---|---|
| Open-Meteo Marine (ERA5-Ocean) | `https://marine-api.open-meteo.com/v1/marine` | `datos/oleaje/descargar_oleaje.py` | rate-limited, sin clave. Cobertura 1940-presente (rejilla 0,5°). |
| CIOH (DIMAR) climatología portuaria | `https://cioh.dimar.mil.co/.../pdf/<n>_<PUERTO>.pdf` | `datos/oleaje/descargar_cioh_climatologia.py` | descarga PDFs (no serie numérica). |
| IOC Sea Level (Tumaco, GLOSS 171) | `http://www.ioc-sealevelmonitoring.org/service.php` | `datos/mareas/descargar_mareas_tumaco.py` | ventana máx ~31 días por llamada; el script pagina mes a mes. |
| IDEAM DHIME (datos.gov.co `ia8x-22em`) | `https://www.datos.gov.co/resource/ia8x-22em.csv` | `datos/ideam/descargar_ideam.py` | filtro `codigoestacion='...'`, `$limit=500000`. |
| Superservicios ZNI (datos.gov.co) | `https://www.datos.gov.co/resource/{3ebi-d83g, qwe5-ycap, p62q-r7ag, 5cvc-m38t, sqyx-3h49, td8k-vhq9}.csv` | `datos/zni/descargar_zni.py` | filtros SoQL por `id_empresa`, `codigo_localidad`, `tipo_tecnologia`. |
| XM (EquipoAnaliticaXM/API_XM) | `https://servapibi.xm.com.co/hourly` | `datos/xm/descargar_xm.py` | POST JSON, paginación 30 días, sin clave. |
| RUNAP (PNN ArcGIS FeatureServer) | `https://mapas.parquesnacionales.gov.co/arcgis/rest/services/pnn/runap/FeatureServer/0/query` | `datos/runap/descargar_runap.py` | filtro `area_ha_maritima_geografica > 0`. |
| Natural Earth (continente + islas) | `https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_{50,10}m_admin_0_countries.geojson` | `datos/costa/descargar_costa.py` | descarga mundo entero y recorta al encuadre del mapa. |
| GMRT (batimetría radial Isla Fuerte) | `https://www.gmrt.org/services/PointServer?latitude=..&longitude=..&format=text` | `datos/batimetria/descargar_batimetria.py` | 11 rumbos × 25 puntos = 275 consultas; rate-limit recomendado: 1 consulta/seg. |
| FES2014 / FES2022 (AVISO/CNES) | vía Copernicus Marine (`cmems_mod_glo_tide_anfc_0.083deg_PT1H-i` o similar) | `datos/fes/descargar_constituyentes_fes.py` | público a través del wrapper de Copernicus Marine. Sin cuenta directa con AVISO es necesario **iniciar sesión en Copernicus Marine** (ver § 2). |

**Comportamiento ante ausencia de credenciales:** no aplica; todas estas
descargas se hacen con `urllib.request` estándar. El único modo de fallo
esperable es timeout transitorio del servidor (5xx), reintentable.

---

## 2. Fuentes con credenciales requeridas

### 2.1 Copernicus Marine Service

- **Producto:** `cmems_mod_glo_wav_anfc_0.083deg_PT3H-i`
  (GLOBAL_ANALYSISFORECAST_WAV_001_027, oleaje 1/12°)
  y `cmems_mod_glo_phy_my_0.083deg_P1D-m`
  (GLOBAL_MULTIYEAR_PHY_001_030, GLORYS12 corrientes 1/12°).
  Vía wrapper también se obtiene el atlas de constituyentes FES.
- **Cuenta:** registro gratuito en <https://data.marine.copernicus.eu/>
  → *Register*. No hay coste, no hay tarjeta.
- **Configuración local** (uno u otro, el script lee `~/.copernicusmarine.cfg`):
  ```bash
  pip install copernicusmarine
  copernicusmarine login                 # interactivo, persiste credenciales
  ```
  Equivalente manual: crear `~/.copernicusmarine.cfg` con usuario y
  contraseña (formato INI), o exportar `COPERNICUSMARINE_USERNAME` y
  `COPERNICUSMARINE_PASSWORD` como variables de entorno.
- **Scripts:**
  - `datos/cmems/descargar_oleaje_cmems.py`
  - `datos/cmems/descargar_corrientes_glorys.py`
  - `datos/fes/descargar_constituyentes_fes.py` (vía Copernicus; sin
    pyfes local)
- **Si no está configurada:** el script termina en cuanto el wrapper de
  Copernicus Marine intenta abrir sesión, con `401 Unauthorized` o un
  `SystemExit` previo si la biblioteca `copernicusmarine` no está
  instalada (`pip install -e ".[ingesta]"`). El fallo no es un
  *timeout*: el error es inmediato y de causa clara.

### 2.2 Google Earth Engine

- **Producto:** Sentinel-2 SR (`COPERNICUS/S2_SR_HARMONIZED`),
  GEBCO 2023 (`GEBCO/GEBCO_2023`), Copernicus DEM GLO-30
  (`COPERNICUS/DEM/GLO30`) y VIIRS DNB mensual
  (`NOAA/VIIRS/DNB/MONTHLY_V1/VCMSLCFG`).
- **Cuenta:** Google Account + proyecto GEE (solicitud en
  <https://earthengine.google.com/> → *Sign Up*). La aprobación es
  automática para uso no comercial.
- **Configuración local:**
  ```bash
  pip install earthengine-api geemap
  earthengine authenticate                # abre OAuth en el navegador
  ```
  Las credenciales quedan en `~/.config/earthengine/credentials`
  (Linux/macOS) o `%USERPROFILE%\.config\earthengine\credentials` (Windows).
- **Script:** `datos/geee/descargar_rasteres.py`
- **Si no está configurada:** el script termina con `ee.Initialize()`
  lanzando `ee.EEException: Please authorize access to Earth Engine`. El
  fallo tampoco es *timeout*; es un error inmediato de autenticación.
- **Piramidación posterior** (`gdal2tiles.py -z 0-N -w none -p mercator`)
  no requiere cuenta, pero sí GDAL ≥ 3.4 en el PATH.

### 2.3 FES2014/FES2022 — caso mixto

El script `datos/fes/descargar_constituyentes_fes.py` puede operar de
dos maneras:

1. Vía pyfes + archivos de atlas locales (FES2014/FES2022 descargados de
   AVISO). Requiere registro gratuito en
   <https://aviso-data-center.cnes.fr/> y obtener los archivos `.nc` del
   atlas (decenas de GB). No es lo que usa el proyecto.
2. Vía Copernicus Marine (wrapper `copernicusmarine`). En este caso las
   credenciales son las de § 2.1 y no hay credenciales AVISO separadas.
   Es el modo previsto en el proyecto.

> **Nota:** FES solo publica constituyentes de elevación (amplitud y
> fase de marea). Los constituyentes de corriente de marea no existen
> como producto independiente; la velocidad mareal requiere un modelo
> hidrodinámico regional. Ver `datos/fes/resumen_constituyentes_fes.json`
> campo `_nota_corriente`.

---

## 3. Estado actual de credenciales en este entorno

Comprobado el día de cierre de la tarea 3.x:

| Credencial | Estado |
|---|---|
| `~/.copernicusmarine.cfg` | **NO existe** — los scripts CMEMS no pueden ejecutarse sin registrar antes una cuenta Copernicus. |
| `~/.config/earthengine/credentials` | **NO existe** — los scripts GEE no pueden ejecutarse sin antes `earthengine authenticate`. |
| Acceso a Open-Meteo, IOC, IDEAM, Superservicios, XM, RUNAP, Natural Earth, GMRT, CIOH | **Disponible** sin configuración. |

---

## 4. Procedimiento exacto de regeneración con credenciales

Para regenerar una fuente con credenciales propias:

```bash
# 1. Instalar dependencias de ingesta
pip install -e ".[ingesta]"           # Copernicus Marine + xarray + netCDF4
pip install earthengine-api geemap    # Earth Engine (no está en [ingesta] por ser binario separado)
pip install pyfes                    # solo si se opta por la vía AVISO directa de FES

# 2. Configurar credenciales (cada fuente una sola vez por máquina)
copernicusmarine login               # cuenta Copernicus Marine
earthengine authenticate             # cuenta Google + proyecto GEE

# 3. Ejecutar el script
python datos/cmems/descargar_oleaje_cmems.py
python datos/cmems/descargar_corrientes_glorys.py
python datos/fes/descargar_constituyentes_fes.py
python datos/gee/descargar_rasteres.py
```

Los scripts públicos no requieren pasos 1-2; basta con:

```bash
python datos/oleaje/descargar_oleaje.py
python datos/oleaje/descargar_cioh_climatologia.py
python datos/mareas/descargar_mareas_tumaco.py
python datos/ideam/descargar_ideam.py
python datos/zni/descargar_zni.py
python datos/xm/descargar_xm.py
python datos/runap/descargar_runap.py
python datos/costa/descargar_costa.py
python datos/batimetria/descargar_batimetria.py
```

---

## 5. Qué queda excluido de Git

`.gitignore` (versión del proyecto) ya excluye:

- `.copernicusmarine/`
- `.netrc`
- `*credentials*.json`, `*token*.json`
- `.config/earthengine/`
- `.earthengine/`
- `.geemap/`
- `.fes/`

Y mantiene versionados los productos finales:

- `datos/**/*.csv` (series descargadas, regenerables)
- `datos/**/*.json` (resúmenes y metadatos)
- `datos/**/*.geojson` (RUNAP recortado, costa recortada)

El manifiesto central `datos/manifiesto.json` registra el hash SHA-256 de
cada archivo descargado y su fecha de generación, como exige el spec
`ingesta-datos-externos`.

---

## 6. Resumen de la política de fallos

| Condición | Comportamiento |
|---|---|
| Falta credencial (CMEMS / GEE) | `SystemExit` con mensaje claro del wrapper o `ImportError` ruidoso de la biblioteca. **No** se cae por timeout. |
| Falta biblioteca de `[ingesta]` | `raise SystemExit("Falta extra [ingesta]: pip install -e '.[ingesta]'")`. |
| API pública 5xx transitorio | `URLError` capturado en el script; `xm_post` reintenta 3 veces antes de fallar. |
| API pública cambia de formato | `assert` al final del script detecta el cambio (ver `comprobación ok`). |

Esta política cumple el requisito del spec `ingesta-datos-externos`:
*"el procedimiento de regeneración SHALL estar ejecutado al menos una
vez, contra su fuente real, con sus credenciales en `~/.config/` o el
equivalente declarado en `documentacion/cuentas_ingesta.md`. Lo que se
declara regenerable sin haberlo regenerado deja el requisito sin
efecto."*