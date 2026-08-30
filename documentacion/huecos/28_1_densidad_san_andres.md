# Hueco 28.1 — Densidad de potencia publicada para San Andrés

> Corresponde a la tarea 162 del plan `migrar-interfaz-a-web-y-ampliar-fuentes`.

## Descripción

San Andrés no tiene un dato revisado por pares de densidad de potencia undimotriz
en kW/m. El único valor cuantitativo disponible es el inferido de ERA5-Ocean
(8,26 kW/m con celda a 23 km, resolución 0,5°, estado `inferido`); el dato
publicado en kW/m permanece con estado `pendiente` y `valor: 0.0` en
`datos/sitios/san_andres.json`.

Esta situación incumple el requisito de la especificación `emplazamientos/spec.md`
que pide que el sistema distinga entre el valor de diseño revisado por pares y
los contrastes con su resolución y su distancia al emplazamiento. Mientras el
valor revisado por pares no exista, San Andrés no puede usarse como caso de
estudio comparable a Isla Fuerte.

## Fuentes necesarias

- **Tesis completa de la Universidad del Norte**: "Evaluación del potencial para
  generar energía undimotriz en la isla de San Andrés (Colombia)",
  https://manglar.uninorte.edu.co/handle/10584/13051
  (referenciada en `documentacion/investigacion_convertidores_marinos.md`,
  sección 7.1).
- En su defecto, otras tesis o artículos revisados por pares sobre el recurso
  undimotriz del archipiélago de San Andrés y Providencia.
- Idealmente complementado con datos medidos de la boya oceanográfica del
  CIOH en cercanías del archipiélago (mencionada en la sección 7.1 de
  `investigacion_convertidores_marinos.md`).

## Estado actual

- `datos/sitios/san_andres.json` campo `densidad_potencia_publicada`:
  - `valor: 0.0`
  - `estado: "pendiente"`
  - `fuente`: "Tesis Uninorte Evaluación potencial undimotriz San Andrés — texto
    completo no accesible, resumen indica supera 2 kW/m sin cifra, pendiente
    verificación".
- `datos/sitios/san_andres.json` campo `densidad_potencia_media`:
  - `valor: 8.26 kW/m`
  - `estado: "inferido"`
  - `fuente`: ERA5-Ocean via Open-Meteo, rejilla 0,5°, celda 12,5N -81,5W
    (~23 km de desplazamiento), 2015-2024, 87672 registros.
- `documentacion/investigacion_convertidores_marinos.md` sección 7.1 indica
  explícitamente: "Debe verificarse con el texto completo del trabajo de
  Uninorte antes de usarse en material docente."
- `documentacion/investigacion_convertidores_marinos.md` sección 9 ("Datos no
  encontrados") registra como SIN DATO el punto 6: "Densidad de potencia
  undimotriz en kW/m publicada específicamente para San Andrés".

## Intentos previos

1. **Acceso a la tesis de Uninorte**: el resumen indica que se observaron
   mayores concentraciones de densidad energética en la costa sureste,
   principalmente en enero, febrero, junio, julio y diciembre, con valores
   que superan ampliamente el mínimo explotable de 2 kW/m citado a nivel
   mundial. Sin embargo, no se pudo acceder al texto completo en la búsqueda
   que soporta `investigacion_convertidores_marinos.md` y por tanto no se
   extrajo una cifra concreta en kW/m.
2. **Inferencia desde ERA5**: se descargó la rejilla 0,5° de ERA5-Ocean a
   través de Open-Meteo y se calculó 8,26 kW/m como densidad media 2015-2024.
   Es el dato de mejor resolución disponible, pero al ser de una rejilla con
   celda a 23 km del archipiélago queda marcado como `inferido` y no como
   valor de diseño.
3. **Búsqueda de boya del CIOH**: referenciada en
   `investigacion_convertidores_marinos.md` pero no consultada en detalle en
   este plan.

## Plan de cierre

1. Consultar la tesis de Uninorte en la biblioteca de la UTS o en el
   repositorio institucional `manglar.uninorte.edu.co`.
2. Extraer el valor publicado de densidad de potencia media anual en kW/m, con
   su periodo de referencia, su resolución espacial y la distancia al
   emplazamiento.
3. Actualizar `datos/sitios/san_andres.json` campo `densidad_potencia_publicada`
   con el valor, su fuente, su estado `verificado` y, si procede, su
   resolución.
4. Si la tesis ofrece varios valores según costa o estación, registrarlos
   como contraste sin desplazar el valor de diseño (que sería el revisado por
   pares más cercano al punto de la isla).
5. Documentar la procedencia del dato en `documentacion/fuentes_datos_oleaje.md`
   para mantener la trazabilidad de las fuentes.
6. Reejecutar el panel de puntuación de San Andrés y verificar que el
   criterio de "contenido energético medio" ya pueda puntuarse como cumplido o
   incumplido en lugar de quedar pendiente.

## Criterio de cierre

El hueco se considera cerrado cuando `datos/sitios/san_andres.json` tiene un
campo `densidad_potencia_publicada` con `estado: "verificado"`, valor en kW/m
distinto de 0, fuente trazable a la tesis de Uninorte (u otra publicación
revisada por pares equivalente) y el panel de puntuación del sitio puede
declarar el criterio de contenido energético como cumplido o incumplido.