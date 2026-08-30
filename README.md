# Simulador de energía marina

Proyecto de aula de FCN030 Introducción a la Ingeniería, UTS, semestre 2026-2.
Prototipo educativo de generación energética undimotriz y mareomotriz, con
presentación web empaquetada desde Python.

## Qué es

Un simulador que recorre la cadena completa de conversión, de recurso a coste por MWh,
para cuatro dispositivos, con datos de emplazamientos colombianos y una interfaz web
que empieza siendo visual y va destapando lo técnico a medida que el usuario lo pide.

La tesis del proyecto, que el simulador debe hacer descubrir y no enunciar:

> La energía marina en Colombia es marginal frente a la red interconectada, pero
> competitiva frente al diésel en zonas no interconectadas.

## Dónde está cada cosa

| Ruta | Contenido |
|---|---|
| `documentacion/especificacion_simulador_energia_marina.md` | Especificación funcional. Qué dispositivos, qué ecuaciones, qué datos, qué salidas y qué queda fuera. Es el documento de referencia. |
| `documentacion/investigacion_convertidores_marinos.md` | Investigación de respaldo. Unas 50 fuentes con URL, cada afirmación etiquetada como verificada, general o inferida, y doce vacíos registrados. |
| `documentacion/fuentes_datos_ideam.md` | Qué datos publica el IDEAM, por qué canal y con qué reservas. Rango mareal medido de fuente primaria. |
| `documentacion/areas_marinas_protegidas.md` | Restricción legal de emplazamiento. Qué candidatos caen dentro de áreas protegidas. |
| `documentacion/dtocean_referencia.md` | DTOcean como validación externa de la cadena de eslabones (no se instala). |
| `documentacion/estado_huecos.md` | Estado final de la discrepancia Isla Fuerte y del hueco de corrientes. |
| `documentacion/criterios_diseno_portados.md` | Criterios del informe de diseño: portados, resueltos y abandonados. |
| `datos/` | Series descargadas y los scripts que las regeneran. El simulador lee estos archivos, nunca la red. |
| `openspec/changes/separar-simulador-en-dos-fases/proposal.md` | Por qué la interfaz entra por lo visual. |
| `openspec/changes/migrar-interfaz-a-web-y-ampliar-fuentes/tasks.md` | Plan de trabajo de la migración a web. |
| `nucleo/` | Capa física pura: dispersión, hidrodinámica, eslabones. No sabe que existe una interfaz. |
| `analisis/` | Capa de análisis: AEP, captura, resonancia, dimensión, economía, emplazamiento. Ahí viven también las figuras con seaborn (`analisis/figuras.py`). |
| `app/` | Capa de aplicación: orquesta cálculo, formato, exportación, contrato, vocabulario. Sirve la web empaquetada. |
| `web/` | Capa de presentación: TypeScript + Vue 3 + Vite + MapLibre + Plotly + ECharts + KaTeX. No contiene Python. |

Los dos libros de referencia (Handbook of Ocean Wave Energy y Cruz 2008) están en
`I:\Mi unidad\TEC. EN GESTIÓN DE RECURSOS ENERGETICOS\2026-2 (6to semestre)\INTRODUCCIÓN A LA ING\libros`.

## Alcance

Dos familias, cuatro dispositivos, uno por concepto:

| Familia | Dispositivo | Qué enseña |
|---|---|---|
| Undimotriz | Absorbedor puntual | Resonancia y ancho de captura mayor que el propio diámetro |
| Undimotriz | Columna de agua oscilante en rompeolas | Que compartir la obra civil cambia la economía por completo |
| Mareomotriz | Presa de rango mareal | Dependencia cuadrática con el rango |
| Mareomotriz | Turbina de corriente | Dependencia cúbica con la velocidad |

Hidráulica convencional queda fuera del alcance, pero la arquitectura deja el hueco para
añadirla como tercera familia sin reescribir nada.

Emplazamiento por defecto: **Isla Fuerte, Bolívar**. 8,9 kW/m y 78 MWh/m al año, dato
revisado por pares, zona no interconectada con unos 2.000 habitantes a 11 km del
continente.

## Cómo entra el usuario

Cuatro niveles sobre un mismo motor. El conmutador cambia la piel, nunca el cálculo.

1. **Ver.** Animación, tres controles en lenguaje corriente, resultado en casas
   alimentadas.
2. **Comparar.** Sankey de pérdidas y fichas de dispositivos reales, sin fórmulas.
3. **Calcular.** Cada fórmula con los números ya sustituidos y la fuente de cada
   constante.
4. **Diseñar.** Resonancia, límites teóricos, producción anual y coste por MWh.

## Reglas que no se negocian

1. **La animación se mueve con el modelo real.** El número de onda sale del solucionador
   de la relación de dispersión y la posición de la boya de integrar la ecuación de
   movimiento. Una animación decorativa con la calculadora al lado se nota en la
   sustentación.
2. **La simulación corre en hilo aparte, nunca en el hilo de la interfaz web.** El cálculo
   se lanza desde `app/servicio.py` y nunca bloquea el render.
3. **Ninguna cifra sin fuente.** Si un dato no está verificado, va marcado como pendiente
   y no entra al simulador. La lista de pendientes está en el apartado 13 de la
   especificación.
4. **El núcleo de física no sabe que existe la interfaz.** Así el mismo código alimenta
   las gráficas del informe, las pruebas y la aplicación.
5. **La capa de presentación es la web.** matplotlib y seaborn son dependencias de la
   capa de aplicación (`app/` y `analisis/`); nunca entran en `web/`.

## Pila tecnológica

**Python (núcleo, análisis y aplicación):**

- Python 3.11+
- NumPy, SciPy: cálculo numérico
- utide: constituyentes de marea
- Matplotlib + seaborn: figuras del informe y exportación (`analisis/figuras.py`)
- pywebview: host nativo que embebe la build web

**Web (presentación):**

- HTML / CSS / TypeScript
- Vue 3 + Vite
- MapLibre GL + PMTiles: mapa de potencial
- KaTeX: fórmulas
- Plotly.js: figuras interactivas en Ver, Comparar, Calcular, Diseñar
- ECharts: Sankey de pérdidas

## Cómo se ejecuta

### Construir y ejecutar

```bash
# Build de la capa web (genera web/dist/)
cd web
npm ci
npm run build
cd ..

# Instalacion editable de la aplicacion Python
pip install -e ".[dev]"

# Arranque de la aplicacion (pywebview sirve web/dist/)
python -m app
```

### Pruebas

```bash
python -m pytest
```

La suite cubre núcleo físico, análisis, contrato de la aplicación, capa web (build
+ contrato), dependencias, fronteras de ingesta y oráculos con `mhkit` / `wavespectra`
(marcados `[dev]`). Ninguna prueba necesita pantalla.

### Datos

La aplicación no hace ninguna petición de red: todo sale de `datos/`. Las series
descargadas se regeneran con los scripts bajo `datos/`.

## Estado

Especificación e investigación terminadas el 25 de agosto de 2026. Bloques A (núcleo),
B (lógica de aplicación) y C (interfaz y diseño visual) terminados sobre la pila web
(TypeScript + Vue + Vite + MapLibre + Plotly + ECharts): los cuatro niveles funcionan
sobre el mismo objeto de resultado, la resonancia se descubre moviendo un control y
el mapa de potencial fija el emplazamiento. La capa de figuras del informe usa
seaborn sobre matplotlib para mantener una paleta consistente dentro del paquete
empaquetado. El orden de construcción está en `tasks.md`.