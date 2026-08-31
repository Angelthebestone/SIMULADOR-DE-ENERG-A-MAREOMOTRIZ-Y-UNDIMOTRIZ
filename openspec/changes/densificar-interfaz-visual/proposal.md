## Why

La interfaz actual es rigurosa y honesta (semáforo `verificado/inferido/pendiente`, citas bibliográficas, separación presentación/cálculo), pero está concebida como un visor de cifras con fuentes, no como un simulador con andamiaje pedagógico. Un estudiante que abre la app no encuentra una pregunta conductora, no puede modificar los supuestos del modelo, no recibe intuición física junto a las fórmulas, no ve los fracasos comerciales conectados a un número simulado y nunca ve la otra mitad de la tesis del proyecto: la comparación del LCOE marino contra la red interconectada (SIN). El canvas de la vista `Ver` es la pieza más visible y la que más tiempo ocupa la mirada del estudiante, y es la más pobre visualmente: una sinusoide sobre fondo blanco con un cuerpo rígido que sube y baja, sin contexto geográfico, sin anotaciones físicas y sin la densidad visual que las simulaciones educativas de referencia (PhET, NOAA OpenWave) tienen.

## What Changes

- **Pregunta conductora visible en la cabecera de `Ver`**, con una micro-tarea que el estudiante pueda completar moviendo los tres controles existentes.
- **Cuatro controles adicionales editables en `Diseñar`** para los supuestos del modelo que hoy están fijos en `app/servicio.py`: rendimiento del PTO (`η_PTO`), eficiencia del generador (`η_gen`), factor de recuperación de capital (`CRF`) y densidad del agua de mar (`ρ`). Cada control editable expone su valor por defecto, su rango plausible y su fuente bibliográfica.
- **Línea de intuición física bajo cada fórmula en `Calcular`**: por qué `J` escala con `Hm0²` y `Te` lineal, qué captura el coeficiente `1/64π`, qué es la densidad de potencia. Una sola línea por fórmula, sin revelar derivaciones formales.
- **Conexión de cada ficha de fracaso comercial en `Comparar`** (Pelamis, Oyster, SeaGen, Annapolis) con un número del propio simulador: el LCOE que el dispositivo habría tenido en Isla Fuerte, o el AEP que no alcanzó, con la fuente que soporta el dato.
- **Comparación visible con la red interconectada nacional (SIN)** en `Diseñar`, no solo contra el diésel ZNI. La tesis del proyecto dice "marginal frente a la red, competitivo frente al diésel"; la UI hoy solo muestra la segunda mitad.
- **Canvas de `Ver` con densidad visual real**: composición en capas con el color real del mar Caribe (mediana Sentinel-2) y el relieve sombreado (GEBCO sombreado) como fondo, ya disponibles como pirámides raster en `datos/gee/`. Anotaciones físicas en vivo sobre la animación: altura `Hm0` como flecha vertical, período `Te` como intervalo entre dos crestas, potencia instantánea `J(t)` en una esquina. La animación sigue saliendo del modelo físico, no se convierte en decorativa.
- **Mapa de capas con control de opacidad por capa** en `Ver`, para que el estudiante explore el recurso geográficamente y no solo numéricamente.

## Capabilities

### New Capabilities

- `andamiaje-pedagogico`: pregunta conductora, glosario emergente, micro-tareas en cada nivel.
- `supuestos-editables`: controles adicionales para `η_PTO`, `η_gen`, `CRF`, `ρ` con sus rangos y fuentes.
- `densidad-visual-animacion`: composición de capas raster y anotaciones físicas en vivo sobre el canvas.
- `fracasos-conectados-al-calculo`: vínculo de cada ficha de fracaso comercial con un número simulado y su fuente.
- `comparacion-red-sin`: contraste LCOE marino contra LCOE medio SIN nacional en `Diseñar`.

### Modified Capabilities

- `niveles-divulgacion`: añadir requisito de línea de intuición física bajo cada fórmula de `Calcular`, y de pregunta conductora visible en `Ver`.

## Impact

- Código: `web/src/views/Ver.vue`, `web/src/views/Calcular.vue`, `web/src/views/Comparar.vue`, `web/src/views/Disenar.vue`, `web/src/components/ControlesFisicos.vue` (extensión), `web/src/components/AnimacionCanvas.ts` (nuevo fondo y anotaciones), `web/src/components/FichaDispositivo.vue` (conectar LCOE simulado), nuevo `web/src/components/AnotacionesFisicas.vue`, nuevo `web/src/components/ControlOpacidadCapas.vue`.
- Servicio Python: `app/servicio.py` debe exponer los cuatro supuestos editables y devolver el LCOE frente a SIN (datos XM ya disponibles en `datos/xm/`).
- Datos: `datos/fracasos/` debe llevar junto a cada ficha un campo `lcoe_estimado_cop_mwh` o `aep_estimado_mwh_anio` con fuente bibliográfica.
- Diseño: respeta la política de origen único (sin CDN, sin librerías 3D), tokens OKLCH existentes, formato numérico español. **No introduce three.js, WebGL ni dependencias externas adicionales.** El enriquecimiento del canvas se hace con `Canvas 2D` + las pirámides raster ya verificadas.
- Compatibilidad: ningún cambio al motor de cálculo, solo a la presentación y a los parámetros de entrada. Los tests existentes deben seguir pasando.
- Documentación: `documentacion/estado_huecos.md` se actualiza para cerrar los huecos que este cambio cubre.
