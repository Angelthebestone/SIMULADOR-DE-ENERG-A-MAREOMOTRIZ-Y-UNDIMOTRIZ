# Empaquetado del Simulador de Energía Marina

Procedimiento para producir el binario que el usuario final ejecuta. Sigue la
decisión D6 del diseño: **distribución en carpeta (`--onedir`), no en archivo
único autoextraíble**.

## Requisitos

| Herramienta | Versión | Propósito |
|---|---|---|
| Python | ≥ 3.11 (igual que `pyproject.toml`) | Runtime del núcleo y la carcasa. |
| Node.js | ≥ 18 | Solo para construir la interfaz (`npm run build`). No se necesita en el equipo destino. |
| PyInstaller | ≥ 6 | Empaqueta el código Python con sus recursos en una carpeta. |
| pywebview | ≥ 5 | Carcasa nativa sobre WebView2 (Windows). |

En el equipo destino solo se necesita:
- Windows 10 u 11 con **WebView2** (preinstalado en Windows 11; en Windows 10 se
  instala como runtime Evergreen).
- **Sin** intérprete de Python.
- **Sin** permisos de administrador.
- **Sin** Node, npm, ni PyInstaller.

## Procedimiento de construcción

```powershell
cd "C:\Users\Lenovo\Desktop\PROYECTO SIMULADOR ENERGIA"

# 1. Construir la interfaz (genera web/dist/)
cd web
npm ci
npm run build
cd ..

# 2. Empaquetar con PyInstaller (onedir, ver pyinstaller.spec)
pyinstaller pyinstaller.spec --clean --noconfirm
```

El paso 1 es obligatorio: `pyinstaller.spec` declara `datas=[('web/dist',
'web/dist')]`. Si `web/dist/` está vacío o no existe, la aplicación falla al
arrancar con `Interfaz no encontrada en ...\web\dist\index.html`.

## Salida

El comando produce la siguiente carpeta, lista para copiar al equipo destino:

```
dist/
└── SimuladorEnergia/                  (~250-400 MB, ver tabla de tamaño)
    ├── SimuladorEnergia.exe            # Lanzador (entry point: app/__main__.py)
    └── _internal/                      # Recursos y módulos
        ├── web/dist/                   # HTML, JS, CSS, vendor (MapLibre, KaTeX, ECharts, Plotly)
        ├── datos/                      # Manifiesto, sitios, dispositivos, oleaje, etc.
        ├── app/, nucleo/, analisis/    # Módulos Python
        └── ...                         # Dependencias (.dist-info, DLLs)
```

### Tamaño aproximado esperado

La estimación combina los vendorizados de la interfaz, los datos y los módulos
de Python. Las cifras reales dependen de la versión exacta de las dependencias.

| Componente | Tamaño aproximado |
|---|---|
| `web/dist/` (MapLibre, KaTeX, ECharts, Plotly) | 40-60 MB |
| `datos/` (sitios, dispositivos, oleaje, batimetría, costa) | 5-15 MB |
| Módulos Python (numpy, scipy, utide, matplotlib, plotly) | 150-250 MB |
| Runtime de PyInstaller y DLLs | 30-50 MB |
| **Total** | **~250-400 MB** |

## Cómo se ejecuta

En el equipo destino:

1. Copiar `dist/SimuladorEnergia/` a cualquier carpeta del disco (por ejemplo,
   `C:\Users\Public\SimuladorEnergia` o el escritorio).
2. Doble clic en `dist/SimuladorEnergia/SimuladorEnergia.exe`.
3. La ventana abre directamente sin descomprimir ni pedir permisos de
   administrador.

Para desinstalar basta con borrar la carpeta `SimuladorEnergia/`. No quedan
temporales, no se modifica el registro del sistema, no se crean servicios.

## Cómo se ejecuta desde el repo (sin empaquetar)

Para desarrollo o verificación rápida:

```powershell
cd "C:\Users\Lenovo\Desktop\PROYECTO SIMULADOR ENERGIA"
python -m app
```

`app/__main__.py` llama a `app.carcasa.lanzar_ventana()`, que es la misma
función que el entry point del spec.

## Política de dependencias del runtime

El paquete final lleva las dependencias declaradas en `pyproject.toml` como
`dependencies`. No lleva las declaradas en `[dev]` (pytest, ruff, black, mhkit,
wavespectra) ni en `[ingesta]` (copernicusmarine, earthengine-api, geemap,
xarray, netCDF4, pyfes).

Para retirar dependencias que la aplicación ya no usa, véase la sección 26 del
plan (`openspec/changes/migrar-interfaz-a-web-y-ampliar-fuentes/tasks.md`).

## Trazabilidad de la decisión

- **D2 (Carcasa nativa con motor web del sistema)**:
  `pywebview` + WebView2; la presentación es idéntica en las tres alternativas
  que el diseño consideró, así que la elección de carcasa es reversible.
- **D6 (Distribución en carpeta, no en archivo único)**:
  `--onedir` en el spec; arranque inmediato sin descomprimir a temporales.
- **Tarea 15.4** (`openspec/.../tasks.md`): ventana nativa sin barra de
  direcciones ni controles de navegador.
- **Tarea 15.5** (`openspec/.../tasks.md`): comprobación de motor y de
  directorio de datos; mensajes claros ante motor ausente o directorio no
  escribible. Implementado en `app/carcasa.comprobar_motor()` y
  `app/carcasa.comprobar_directorio_datos()`.