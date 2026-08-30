# DTOcean como validación externa de la cadena de eslabones

> Documento de referencia. No se instala. Sirve para situar la descomposición
> del simulador frente a la descomposición que la comunidad de diseño de
> parques undimotriz y mareomotriz ya validó.

## 1. Qué es DTOcean (y qué no)

**DTOcean** ("Development of Tidal and Wave Energy Commercial Array Tools") es
una herramienta europea de **diseño de parques** (arrays de dispositivos), no
de simulación de un único convertidor. Sus módulos están pensados para decidir
disposición, cableado, fondeo, logística y evaluación tecnoeconómica de un
conjunto de captadores, no la dinámica de una sola boya.

El sucesor, **DTOceanPlus**, amplía el alcance con módulos adicionales
(operación y mantenimiento, evaluación ambiental y social, etc.).

Por contraste, este simulador trabaja **un único dispositivo** por concepto
(absorbedor puntual, columna oscilante, turbina de corriente, presa de rango
mareal) sobre un solo sitio. Por eso no se instala: no resuelve el mismo
problema.

## 2. La cadena de módulos de DTOcean

La cadena canónica de DTOcean y DTOceanPlus recorre el parque de la
hidrodinámica al coste por MWh. Es, en buena medida, la misma cadena que
este simulador descompone en eslabones:

| Módulo DTOcean / DTOceanPlus | Qué resuelve | Eslabón análogo del simulador |
|---|---|---|
| Hydrodynamics | Caracteriza el clima marino (oleaje, marea, corriente) en el sitio. | `nucleo/espectros.py`, `nucleo/mareas.py`, `nucleo/corrientes.py` y las series de `datos/`. |
| Capture | Estima la potencia capturada por cada dispositivo. | `nucleo/dispositivos/*` y el primer eslabón del `Resultado`. |
| PTO (Power Take-Off) | Modela la conversión electromecánica posterior a la captura. | `nucleo/pto.py` y los eslabones PTO de cada dispositivo. |
| Array (disposición e interacciones) | Posiciona dispositivos y calcula efectos de parque. | No aplica: este simulador es de **un solo** dispositivo. |
| Installation (logística e instalación) | Evalúa la viabilidad de instalar el parque. | Sólo como criterio cualitativo del panel de `analisis/emplazamiento.py`. |
| Operation (O&M) | Estima disponibilidad, mantenimiento, acceso. | Disponibilidad del 95 % en `analisis/aep.py` (constante; no modelada). |
| Assessment (evaluación tecnoeconómica) | LCOE y métricas de retorno. | `analisis/economia.py` (LCOE, comparador diésel, intervalo SIN, repago). |

**Lectura.** La columna de la derecha muestra que la descomposición del
simulador reproduce la mitad izquierda del diagrama de DTOcean — captura y
PTO módulo a módulo —, más el final de la cadena (evaluación). Lo que
**no** entra es el array y la instalación detallada, que es precisamente lo
que DTOcean aporta y este simulador deja fuera a propósito (un solo
dispositivo).

Por eso la cita no es decorativa: **la cadena de eslabones que el simulador
implementa coincide con la cadena que la comunidad europea de diseño de
parques ya consensuó**, lo que sirve como validación externa de que la
descomposición está bien planteada.

## 3. Por qué NO se instala

Hay tres razones técnicas y de licencia para no instalar DTOcean ni
DTOceanPlus en este proyecto:

1. **Lenguaje y entorno.** DTOcean está escrito en **Python 2.7** y se
   distribuye como un paquete conda con binarios solo para Windows. La
   incompatibilidad con Python 3.11+ (la versión que exige este proyecto)
   lo convierte en una dependencia no instalable en el flujo actual.

2. **Sucesor bajo licencia AGPL.** DTOceanPlus se distribuye bajo **AGPL**,
   una licencia copyleft fuerte incompatible con la **MIT** de este
   proyecto. Mezclar AGPL con MIT obliga, en la práctica, a relicenciar el
   proyecto entero, lo que no es aceptable para un material de aula con
   licenciamiento abierto estándar.

3. **No resuelve el problema del proyecto.** Este simulador es de **un
   único dispositivo** con datos de sitios colombianos. DTOcean está
   pensado para parques enteros con clima europeo. Su coste de adopción
   (entorno, licencia, curva de aprendizaje) supera el beneficio, que se
   limita a la validación conceptual ya cubierta por la tabla 1.

## 4. Por qué se cita

La descomposición en módulos de DTOcean se cita aquí como **validación
externa** de la cadena de eslabones, no como instalación. Tres argumentos:

- **Origen de la descomposición.** Los módulos de DTOcean no son una
  ocurrencia: vienen de consorcios industriales y académicos que
  consensuaron la frontera entre captura, PTO, array y evaluación. Que
  nuestro simulador descomponga de la misma forma (captura → PTO →
  evaluación) es una señal de que el modelo no omite un eslabón que la
  práctica europea considera obligatorio.
- **Coherencia con las normas IEC.** DTOceanPlus se apoya en las normas
  IEC TS 62600-100 (power performance) y 62600-200 (tidal), que ya
  citamos en `app/limitaciones.py`. La cadena que DTOcean implementa y
  la cadena que las normas verifican son la misma.
- **Trazabilidad.** El lector del informe puede cruzar la cadena de
  eslabones de este proyecto con la cadena de DTOcean sin instalar
  nada: están publicadas y son estables.

## 5. Referencias y URLs

Documentación pública y material de referencia (consultados durante la
elaboración del documento, **sin instalar nada**):

- Proyecto DTOcean (original, Python 2.7):
  <https://cordis.europa.eu/project/id/608537>
- Proyecto DTOceanPlus (sucesor):
  <https://www.dtoceanplus.eu/>
- Publicaciones DTOcean / DTOceanPlus en Renewable Energy y J. Phys.:
  Conf. Ser. (búsquedas en
  <https://www.sciencedirect.com/journal/renewable-energy> con los
  términos "DTOcean array layout" y "DTOceanPlus assessment").
- Informes técnicos públicos disponibles en el portal del proyecto
  (deliverables DOW, D6.x, D7.x).

Estas referencias se citan aquí a nivel de existencia; este proyecto no
descarga, no enlaza en caliente y no reutiliza código de DTOcean.