# Hueco 28.3 — Capítulos 7 a 10 del Handbook (PDF completo de acceso abierto)

> Corresponde a la tarea 164 del plan `migrar-interfaz-a-web-y-ampliar-fuentes`.

## Descripción

El *Handbook of Ocean Wave Energy* (Almeida y otros, 2024, Springer,
acceso abierto en https://link.springer.com/book/10.1007/978-3-031-56189-2)
contiene en sus capítulos 7 a 10 las fórmulas detalladas de potencia
undimotriz, hidrodinámica de absorbedores, sistemas de toma de fuerza y
estimación de la producción anual. Estos capítulos son la fuente primaria
que justifica las constantes, los rendimientos por etapa y las reglas de
oficio (latching, control reactivo, fluctuación, picos) que el simulador
codifica.

Hasta la fecha el repositorio solo cita el Handbook de forma genérica en
`documentacion/investigacion_convertidores_marinos.md` y de manera puntual
en `nucleo/pto.py` (atribución "Handbook cap. 1 tabla 4" para rendimientos,
"Handbook cap. 1 §4.4" para reglas de oficio y "Handbook cap.6, Cruz 2008"
para el análisis Wells vs impulso). No se ha descargado el PDF completo ni
se han validado las fórmulas y tablas frente a los capítulos originales.
Esa validación es necesaria para que el material docente no propague
errores de transcripción.

## Fuentes necesarias

- **Handbook of Ocean Wave Energy** (Almeida, 2024): acceso abierto en
  https://link.springer.com/book/10.1007/978-3-031-56189-2. Identificadores
  esperados para los capítulos de interés:
  - Capítulo 7: potencia undimotriz y conversión.
  - Capítulo 8: absorbedores puntuales y atenuadores, hidrodinámica y
    coeficientes A(ω), B(ω), F_e.
  - Capítulo 9: sistemas de toma de fuerza (PTO), rendimientos por etapa.
  - Capítulo 10: estimación de producción anual (AEP) y matriz de potencia.
- DOI del libro: https://doi.org/10.1007/978-3-031-56189-2 (referencia
  bibliográfica verificable).
- Tabla 4 del Capítulo 1 y §4.4 del Capítulo 1, ya citados en
  `nucleo/pto.py` y pendientes de verificación directa.

## Estado actual

- `nucleo/pto.py` cita "Handbook cap. 1 tabla 4" para los rendimientos de
  los cinco tipos de PTO y "Handbook cap. 1 §4.4" para las reglas de
  oficio. Estos números (hidráulico 0,65; agua 0,85; aire 0,55; mecánico
  0,90; directo 0,95) son los que alimentan la simulación y deben
  validarse contra la tabla original.
- `nucleo/pto.py` cita también "Handbook cap.6, Cruz 2008" para la
  comparación Wells vs impulso.
- `documentacion/investigacion_convertidores_marinos.md` (sección 4)
  desarrolla las ecuaciones de potencia undimotriz, hidrodinámica y
  márgenes físicos con base en otras fuentes (Coastal Wiki, MDPI,
  Babarit, Cambridge JFM, Royal Society Open Science, etc.), pero no
  contrasta esas ecuaciones con los capítulos 7-10 del Handbook.
- No existe en el repositorio una copia local del PDF del Handbook ni un
  directorio `documentacion/handbook/` que acoja las notas de lectura
  contrastada.

## Intentos previos

1. **Citas puntuales en `nucleo/pto.py`**: se usaron valores tabulados de
   forma directa sin descargar la fuente, lo que dejó la trazabilidad a
   merced de la fuente original. Si la tabla del Handbook cambiase entre
   ediciones, el simulador no tendría forma de detectarlo.
2. **Búsqueda de extractos**: durante la elaboración de
   `investigacion_convertidores_marinos.md` se citaron referencias
   alternativas (Coastal Wiki, Royal Society Open Science, MDPI Processes)
   para las ecuaciones fundamentales, en lugar del Handbook de Almeida.
   Esto cubre buena parte del contenido pero deja sin verificar los
   capítulos específicos del Handbook.
3. **No se descargó el PDF completo** del libro. El repositorio no tiene
   una copia local.

## Plan de cierre

1. Descargar el PDF completo del Handbook desde
   https://link.springer.com/book/10.1007/978-3-031-56189-2 (acceso
   abierto) y archivarlo en una ruta local del repositorio
   (por ejemplo `documentacion/handbook/handbook_almeida_2024.pdf`)
   para garantizar la persistencia aunque el enlace cambie.
2. Leer los capítulos 7, 8, 9 y 10, contrastando las fórmulas, los
   rendimientos por etapa y la terminología con lo implementado en el
   simulador.
3. Validar específicamente:
   - Los rendimientos de la tabla 4 del capítulo 1 citados en
     `nucleo/pto.py` (hidráulico 0,65; agua 0,85; aire 0,55; mecánico
     0,90; directo 0,95) y la discusión sobre el rango 0,65-0,80 del
     hidráulico.
   - Las reglas de oficio del §4.4 y los ratios de fluctuación de la
     tabla 3.
   - Las fórmulas de potencia undimotriz (sección 4.1 de
     `investigacion_convertidores_marinos.md`) frente al capítulo 7.
   - Las fórmulas de hidrodinámica de absorbedores puntuales (sección
     4.3) frente al capítulo 8.
   - La metodología de AEP y matriz de potencia (sección 4.5 y 5.4)
     frente al capítulo 10.
4. Producir un documento de notas de lectura en
   `documentacion/handbook/notas_lectura.md` que registre cada
   validación con página y, en su caso, las discrepancias detectadas
   con el código.
5. Si se detectan discrepancias materiales, abrir tarea específica en
   el plan para corregir el código, sin sustituir valores verificados
   por inferencias.
6. Mantener las citas existentes en `nucleo/pto.py` y
   `investigacion_convertidores_marinos.md` con la referencia completa
   (DOI o URL de Springer) para que la trazabilidad quede explícita.

## Criterio de cierre

El hueco se considera cerrado cuando el PDF completo del Handbook está
archivado localmente, las fórmulas y tablas citadas en `nucleo/pto.py` y
en `documentacion/investigacion_convertidores_marinos.md` han sido
contrastadas con los capítulos 7-10 (y la tabla 4 del capítulo 1), y las
notas de lectura están disponibles en
`documentacion/handbook/notas_lectura.md` con la paginación de cada
validación.