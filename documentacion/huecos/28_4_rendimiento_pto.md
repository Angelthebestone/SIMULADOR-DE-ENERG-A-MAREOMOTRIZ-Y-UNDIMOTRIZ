# Hueco 28.4 — Rendimiento verificado de cadena hidráulica de PTO real

> Corresponde a la tarea 165 del plan `migrar-interfaz-a-web-y-ampliar-fuentes`.

## Descripción

El rendimiento de la cadena hidráulica completa del PTO se modela en el
simulador con un valor único de 0,65 para el tipo "hidraulico" en
`nucleo/pto.py` (líneas 16-22), atribuido a "Handbook cap. 1 tabla 4".
La especificación de la que parte el plan, sin embargo, habla de un
rango 0,65-0,80, y la documentación interna cita ese mismo rango
(`documentacion/investigacion_convertidores_marinos.md` sección 1.3.1:
"Rendimiento típico de la cadena hidráulica completa: 0,65 a 0,80. [G]
Verificar antes de publicarlo como dato duro").

Una cadena hidráulica real (Wello Penguin, CorPower, Carnegie CETO, AWS
Archimedes Wave Swing, etc.) tiene rendimientos medidos por etapa
(bomba, motor, acumulador, generador) y un rendimiento global publicado
en informes técnicos y papers revisados por pares. El hueco consiste
precisamente en que ese rendimiento medido con su incertidumbre no se
ha incorporado al modelo; lo que hay es una constante declarada sin
validación contra una cadena hidráulica real concreta.

## Fuentes necesarias

- **Wello Oy** (Penguin): publicaciones técnicas, informes de ensayo en
  EMEC y Tethys (PNNL).
- **CorPower Ocean**: publicaciones de sus campañas de ensayo en
  Orkney y Portugal.
- **Carnegie Clean Energy** (CETO 6): informes técnicos y publicaciones
  asociadas a las campañas Albany (Australia) y Wave Hub (Reino Unido).
- **AWS Ocean Energy** (Archimedes Wave Swing): papers y memorias del
  ensayo en Portugal.
- **Documentos generales del Handbook of Ocean Wave Energy** (Almeida,
  2024, capítulo 9 sobre PTO).
- **Papers de revisión** sobre eficiencia de cadenas hidráulicas en
  WECs, accesibles en ScienceDirect, MDPI, Royal Society Open Science y
  repositorios institucionales de universidades con programas de
  energía marina.

## Estado actual

- `nucleo/pto.py` define `RENDIMIENTOS_PTO["hidraulico"] = 0.65` y la
  fuente declarada como "Handbook cap. 1 tabla 4 — hidráulico 65%".
- `nucleo/pto.py` líneas 24-30 declaran la fuente por tipo de PTO, pero
  no asocian ese rendimiento a una cadena hidráulica medida en un
  dispositivo real concreto, ni a su incertidumbre.
- `documentacion/investigacion_convertidores_marinos.md`:
  - Sección 1.3.1 declara el rango 0,65-0,80 con etiqueta [G] y la
    observación "Verificar antes de publicarlo como dato duro".
  - Sección 4.8 tabla "Rendimientos por etapa (undimotriz)" lista
    "PTO hidráulico: 0,65 a 0,80" sin fuente primaria.
  - Sección 9 ("Datos no encontrados") punto 11: "Rendimiento
    verificado de la cadena hidráulica completa de un PTO real (se usó
    0,65 a 0,80 como [G])".
- `nucleo/dispositivos/absorbedor.py` consume el rendimiento vía
  `crear_eslabon_pto(p_cap, cfg.tipo_pto)` con `cfg.tipo_pto =
  "hidraulico"` por defecto.

## Intentos previos

1. **Tabla genérica del Handbook**: se incorporó el rendimiento
   hidráulico como un escalar único (0,65) con etiqueta de fuente que
   apunta a la tabla 4 del capítulo 1 del Handbook, pero esa tabla no
   se contrastó con la cadena hidráulica de un dispositivo real
   concreto.
2. **Rango orientativo en `investigacion_convertidores_marinos.md`**:
   se documentó el rango 0,65-0,80 como [G], pero sin trazabilidad a
   un paper o informe técnico de una cadena hidráulica real.
3. **Comparación con turbinas hidráulicas de baja carga**: en la
   sección 1.3.5 del mismo documento se cita "rendimiento alto (0,85 a
   0,92)" para turbinas Kaplan de baja carga, pero esa es una familia
   distinta (agua, no hidráulica) y se usa en otra parte del modelo
   (`RENDIMIENTOS_PTO["agua"] = 0.85`).

## Plan de cierre

1. Identificar al menos dos publicaciones técnicas revisadas por pares
   o informes de operador con rendimiento medido de cadena hidráulica
   en WECs (Wello, CorPower, Carnegie, AWS o equivalente).
2. Extraer de cada fuente: tipo de cadena, número de etapas
   (cilindros, acumulador, motor, generador), rendimiento por etapa,
   rendimiento global y, si se reporta, incertidumbre o intervalo de
   confianza.
3. Si las fuentes son consistentes dentro de un intervalo, sustituir
   el escalar 0,65 en `nucleo/pto.py` por un rango y declarar la
   fuente; si son heterogéneas, presentar ambos valores como contraste
   al estilo del patrón aplicado al oleaje en `isla_fuerte.json`.
4. Si la fuente principal es el Handbook (cap. 1 tabla 4), validar la
   cita directamente con el PDF completo (ver hueco 28.3) y, en su
   defecto, complementar con la publicación de un operador concreto.
5. Registrar el rendimiento por etapa y el global en
   `documentacion/investigacion_convertidores_marinos.md` sección 4.8
   con la fuente trazable (URL o DOI), reemplazando la etiqueta [G]
   por [V] cuando proceda.
6. Verificar que `nucleo/dispositivos/absorbedor.py` siga produciendo
   los mismos resultados dentro del nuevo rango (regresión), o
   actualizar el invariante de captura si el rendimiento cambia
   materialmente.

## Criterio de cierre

El hueco se considera cerrado cuando `RENDIMIENTOS_PTO["hidraulico"]`
queda expresado como un valor con fuente primaria trazable (paper
revisado por pares o informe técnico de operador), con su incertidumbre
declarada, y la documentación interna (`investigacion_convertidores_marinos.md`
sección 4.8) cita esa fuente en lugar de la etiqueta genérica [G].