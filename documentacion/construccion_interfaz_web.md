# Construcción de la interfaz web

Procedimiento para producir el bundle estático que sirve de entrada a la
carcasa nativa (`app/carcasa.py::lanzar_ventana`) y al artefacto empaquetado
(`pyinstaller.spec`). Sigue la decisión D16 del diseño: el manifiesto de la
interfaz (`web/package.json`) precede a cualquier tarea de la fase 2 y las
bibliotecas de representación se vendorizan dentro del artefacto.

## Requisitos

| Herramienta | Versión mínima | Propósito |
|---|---|---|
| Node.js | ≥ 18 | Compila TypeScript y Vue a ES estático. |
| npm | ≥ 9 | Resuelve y bloquea versiones vía `package-lock.json`. |

Las versiones exactas de cada dependencia (MapLibre GL, KaTeX, Plotly.js,
ECharts, PMTiles, Vue, Vite, TypeScript) están fijadas y bloqueadas con el
operador `=` en `web/package.json`. `npm ci` rechaza cualquier discrepancia
con `package-lock.json`, lo que garantiza que dos clones del repositorio
producen el mismo árbol de módulos.

El equipo destino **no** necesita Node ni npm: la salida del build son
archivos estáticos servidos desde `web/dist/` por la propia ventana nativa.

## Procedimiento

```powershell
cd "C:\Users\Lenovo\Desktop\PROYECTO SIMULADOR ENERGIA\web"
npm ci
npm run build
```

`npm ci` instala el árbol bloqueado; `npm run build` invoca
`vite build`, que aplica la configuración de `web/vite.config.ts`:
`outDir: "dist"`, `emptyOutDir: true`, `cssCodeSplit: false`. Los chunks
generados se nombran con hash de contenido en `web/dist/assets/`.

## Salida

```
web/
└── dist/
    ├── index.html
    └── assets/
        ├── index-<hash>.js
        └── style-<hash>.css
```

- `index.html`: punto de entrada con la cabecera CSP de la tarea 15.3.
- `assets/index-<hash>.js`: aplicación completa (Vue + MapLibre + KaTeX +
  ECharts + Plotly + PMTiles + lógica de los cinco niveles).
- `assets/style-<hash>.css`: sistema de estilo (`tokens.css` + `semaforo.css`).

Toda petición a recursos externos (CDNs, fuentes remotas, mapas en línea)
rompería la política de origen y no se incorporará al artefacto.

## Cómo se incorpora al artefacto final

`pyinstaller.spec` declara la entrada `datas=[("web/dist", "web/dist")]`
para que PyInstaller incluya el bundle estático en la distribución
`--onedir` (decisión D6). El binario resultante abre
`web/dist/index.html` desde la carpeta de recursos de PyInstaller
(`sys._MEIPASS`) o, en desarrollo, desde la ruta del repositorio. La
lógica de selección vive en `app/carcasa.py::_ruta_dist()`.

Este procedimiento es prerrequisito del empaquetado documentado en
`documentacion/empaquetado.md` (tarea 25.1). Sin un build previo
`pyinstaller` empaqueta una `web/dist/` ausente y la aplicación falla al
arrancar con el mensaje de `app/carcasa.py::lanzar_ventana()`.

## Verificación de reproducibilidad

Dos construcciones consecutivas sobre el mismo clon deben producir el
mismo árbol de archivos: idénticos nombres con hash de contenido y
tamaños byte a byte. Vite usa hashes deterministas basados en el
contenido de cada módulo, así que la condición se cumple si y solo si el
árbol de fuentes y `package-lock.json` no cambian.

La prueba `pruebas/test_construccion_web.py::test_reproducibilidad`
implementa esta comprobación: lee el manifiesto de `web/dist/`, ejecuta
`npm run build` dos veces, y compara los hashes SHA-256 de
`dist/index.html` y de cada archivo en `dist/assets/` entre ambas
corridas. Si difieren, el build no es reproducible y la prueba falla.

La comprobación puede ejecutarse a mano:

```powershell
cd "C:\Users\Lenovo\Desktop\PROYECTO SIMULADOR ENERGIA\web"
npm run build
Get-FileHash dist/index.html -Algorithm SHA256
Get-FileHash dist/assets/*.js, dist/assets/*.css -Algorithm SHA256
npm run build
# Repetir los Get-FileHash y comparar contra los anteriores
```

Si los hashes difieren entre corridas sin haber tocado `web/src/` ni
`web/package.json`, hay que revisar la configuración de Vite y la
presencia de marcas de tiempo en los módulos.