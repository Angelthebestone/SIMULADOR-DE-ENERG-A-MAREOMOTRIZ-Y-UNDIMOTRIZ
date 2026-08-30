# Hueco 28.5 — Área del embalse de La Rance y producción anual real con fuente primaria

> Corresponde a la tarea 166 del plan `migrar-interfaz-a-web-y-ampliar-fuentes`.

## Descripción

La Rance (Francia, primera presa mareal del mundo, en operación desde el
26 de noviembre de 1966) tiene un área de embalse y una producción
anual publicadas, que son la referencia mundial para cualquier cálculo
de energía mareomotriz por rango. El simulador usa valores aproximados
para ambos:

- `nucleo/dispositivos/embalse.py::ConfigEmbalse` define `area_m2 =
  22e6` (es decir, 22 km²) y `potencia_nominal_w = 240e6` (240 MW) como
  valores por defecto.
- `documentacion/investigacion_convertidores_marinos.md` sección 3.2
  lista "Área del embalse: 22 km² [G] Verificar antes de publicar" y
  registra en la sección 4.6 que la producción real declarada ronda los
  500 GWh/año [G, verificar cifra exacta].
- `documentacion/investigacion_convertidores_marinos.md` sección 9
  ("Datos no encontrados") incluye los puntos 4 y 5: "Área exacta del
  embalse de La Rance, con fuente primaria. Se usó 22 km² como [G]" y
  "Producción anual exacta de La Rance, con fuente primaria. Se usó 500
  GWh como [G]".

Ambas cifras (22 km² y 500 GWh/año) son razonables y muy citadas en
literatura divulgativa, pero el plan pide que queden ancladas a una
fuente primaria (EDF, el operador; informe técnico de La Rance; o, en
su defecto, Wikipedia y derivados trazables) antes de aparecer como
dato de diseño.

## Fuentes necesarias

- **EDF (Électricité de France)**, operador de La Rance desde su
  inauguración. Informes técnicos anuales o decenales sobre
  producción, mantenimiento y disponibilidad.
- **Tethys (PNNL)**, "La Rance Tidal Power Plant: 40-year operation
  feedback":
  https://tethys.pnnl.gov/sites/default/files/publications/La_Rance_Tidal_Power_Station_40_year_operation_feedback.pdf
  (ya referenciada en `investigacion_convertidores_marinos.md`).
- **Wikipedia, Rance Tidal Power Station**:
  https://en.wikipedia.org/wiki/Rance_Tidal_Power_Station
  (referenciada como [V] para potencia nominal, número de turbinas,
  diámetro de rodete, inauguración, etc., pero sin valor [V] para
  área ni producción anual).
- **Otras fuentes secundarias verificables** que citen EDF: artículos
  técnicos de la IEEE, repositorios institucionales, publicaciones de
  Energies (MDPI) sobre energía mareomotriz.

## Estado actual

- `nucleo/dispositivos/embalse.py::ConfigEmbalse` (líneas 24-33):
  `area_m2: float = 22e6`, `potencia_nominal_w: float = 240e6`.
  Ambos son los valores por defecto que se usan cuando el usuario no
  los edita explícitamente.
- `nucleo/dispositivos/embalse.py::_obtener_serie` (línea 73): usa
  `recurso.get("rango_m", recurso.get("rango_mareal", 3.28))`. El
  rango 3,28 m no corresponde a La Rance (cuyo rango medio es 8 m);
  es el rango medio del Pacífico colombiano usado como valor
  sustituto cuando no se aporta uno.
- `documentacion/investigacion_convertidores_marinos.md` sección 3.2,
  tabla de La Rance: 240 MW [V], 24 turbinas [V], 10 MW unitario [V],
  5,35 m de diámetro [V], 5,65 m de salto [V], tipo bulbo bidireccional
  con bombeo [V], rango 8 m medio [V], máximo 13,5 m [V],
  inauguración 26-11-1966 [V], estado "Activa" [V]. Los campos
  pendientes con fuente primaria son el área del embalse y la
  producción anual.
- `documentacion/investigacion_convertidores_marinos.md` sección 4.6
  hace un cálculo de ejemplo con A = 22 km² [G, verificar] y R = 8 m
  [V] para producir 1.435 GWh/año teóricos y comparar con la
  producción real de "alrededor de 500 GWh/año" [G, verificar cifra
  exacta], arrojando un rendimiento global de ciclo del 35 %.

## Intentos previos

1. **Recopilación de cifras de catálogo**: las cifras de potencia
   nominal (240 MW), número de turbinas (24), diámetro (5,35 m),
   inauguración (1966) y tipo (bulbo bidireccional con bombeo) están
   bien documentadas y marcadas como [V] en la tabla de la sección 3.2.
2. **Cálculo propio del rendimiento global del ciclo**: realizado en
   la sección 4.6, comparando la energía teórica (1.435 GWh/año) con
   la producción real declarada (500 GWh/año), pero ambas dependen de
   los valores [G] por verificar.
3. **Cálculo de la energía teórica por ciclo**:
   `energia_teorica_ciclo_j(area_m2, rango_m, rho, g)` en
   `nucleo/dispositivos/embalse.py` línea 36-39 es general, pero su
   uso con A = 22 km² y R = 8 m sigue dependiendo del valor [G] del
   área.

## Plan de cierre

1. Localizar el informe técnico de EDF o el documento de Tethys
   "La Rance Tidal Power Plant: 40-year operation feedback" y extraer
   el área exacta del embalse (en km²) y la producción media anual
   (en GWh/año) con su periodo de referencia.
2. Si EDF no publica la cifra directamente, consultar el dossier
   técnico de La Rance disponible en la web del operador o el artículo
   de Wikipedia enlazando a fuentes terciarias verificables.
3. Actualizar `ConfigEmbalse` en `nucleo/dispositivos/embalse.py`
   cambiando `area_m2: float = 22e6` por el valor verificado y añadir
   un comentario que cite la fuente.
4. Si la producción anual verificada difiere materialmente de los 500
   GWh/año usados como ejemplo, actualizar el cálculo docente de la
   sección 4.6 de `investigacion_convertidores_marinos.md` y la
   tabla de la sección 3.2 para reflejar el rendimiento global del
   ciclo real.
5. Considerar mover el área de La Rance y su producción anual a un
   archivo de datos dedicado en `datos/` (por ejemplo
   `datos/mareas/la_rance.json`) para no tenerlas como literales en el
   código. Esto facilitaría su trazabilidad y su uso en escenarios
   educativos.
6. Documentar la fuente primaria en
   `documentacion/fuentes_datos_oleaje.md` y/o
   `documentacion/investigacion_convertidores_marinos.md` con la URL
   o DOI del informe técnico de EDF o de Tethys.

## Criterio de cierre

El hueco se considera cerrado cuando `nucleo/dispositivos/embalse.py`
deja de tener el literal `22e6` como valor por defecto y, en su lugar,
lee el área verificada del embalse de La Rance desde un dato trazable a
EDF (o al informe de Tethys), con la producción anual correspondiente
registrada con su fuente y su periodo de referencia en
`documentacion/investigacion_convertidores_marinos.md`.