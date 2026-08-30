# Cuentas y credenciales de ingesta (8.3)

Solo para regenerar series; el simulador arranca sin ninguna.

| Fuente | Cuenta | Obtencion | Uso |
|---|---|---|---|
| Copernicus Marine | Copernicus Marine Service (gratuita) | marine.copernicus.eu -> Register | `copernicusmarine login` (guarda en `~/.copernicusmarine/`); scripts `datos/cmems/*.py` |
| Google Earth Engine | Google Account + proyecto GEE | earthengine.google.com -> Sign Up | `earthengine authenticate` (guarda en `~/.config/earthengine/`); `datos/gee/descargar_rasteres.py` (geemap) |
| FES AVISO | AVISO/CNES (gratuita) | aviso-data-center.cnes.fr | credenciales pyfes; `datos/fes/descargar_constituyentes_fes.py` |
| Open-Meteo / ERA5-Ocean | Ninguna | — | HTTP sin clave (`datos/oleaje/descargar_oleaje.py`) |
| GMRT, RUNAP, IDEAM, Superservicios, XM, Natural Earth | Ninguna | — | HTTP sin clave |

No versionar: `.copernicusmarine/`, `.netrc`, `*credentials*.json`, `*token*.json`, `.config/earthengine/`, `.earthengine/`, `.geemap/`, `.fes/` (ver `.gitignore`).

Nota FES: constituyentes de **corriente** no publicados (12.3); solo elevacion.
