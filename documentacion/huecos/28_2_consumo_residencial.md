# Hueco 28.2 — Consumo residencial de referencia con fuente

> Corresponde a la tarea 163 del plan `migrar-interfaz-a-web-y-ampliar-fuentes`.

## Descripción

La conversión de la producción anual del dispositivo (en MWh) al número de
"viviendas alimentadas" en el panel del simulador requiere un consumo
residencial de referencia en kWh/mes. El simulador implementa esa conversión
en `app/vocabulario.py::viviendas_alimentadas`, pero el valor de consumo que
utiliza se lee de un CSV (`datos/zni/comercial_residencial_isla_fuerte_2022.csv`)
que puede no existir y cuyo procesamiento queda marcado como `pendiente`
cuando no se puede calcular la media del campo `consumo_basico`.

Cuando el archivo no existe o no produce un valor promedio mayor que cero, la
función devuelve explícitamente `"estado": "pendiente"` con el texto
"pendiente - consumo residencial no verificado", lo que significa que el
indicador "para cuántas casas alcanza" pierde su capacidad de situar la
producción del dispositivo en un contexto doméstico sin un dato residencial
trazable a una fuente primaria oficial.

## Fuentes necesarias

- **UPME** (Unidad de Planeación Minero Energética): caracterización
  energética de las Zonas No Interconectadas (ZNI), con series de consumo
  residencial medio por municipio o por área operativa.
- **IDEAM** (Instituto de Hidrología, Meteorología y Estudios Ambientales):
  caracterización de la demanda energética en ZNI, planes de energización
  rural sostenible (PERS).
- **Superservicios** (Superintendencia Delegada para Energía y Gas
  Combustible): conjuntos de datos abiertos de facturación por usuario
  (`comercial_residencial_isla_fuerte_2022.csv` y análogos para otros
  operadores del SIN y de las ZNI). Esta fuente ya está parcialmente
  integrada pero falta trazar el valor promedio a un año y operador
  verificables.
- **DANE**: Encuesta Nacional de Calidad de Vida (ENCV) o Encuesta Nacional
  de Presupuestos de los Hogares (ENPH), que pueden dar consumo medio
  residencial nacional como referencia cruzada.

## Estado actual

- `app/vocabulario.py::viviendas_alimentadas` (líneas 64-92): cuando el CSV
  no existe o no produce consumos positivos, devuelve
  `"estado": "pendiente"` con texto "pendiente - consumo residencial no
  verificado".
- `app/vocabulario.py::_consumo_residencial_kwh_mes` (líneas 31-54):
  implementación que lee `datos/zni/comercial_residencial_isla_fuerte_2022.csv`
  y devuelve `(media, fuente)` o `None` con motivo de pendiente.
- `datos/sitios/isla_fuerte.json` campo `consumo_residencial_medio_kwh_mes`:
  `valor: 0.0`, `estado: "pendiente"`, con la observación de que el
  promedio del campo `consumo_basico` del CSV requiere un cálculo no
  incorporado como cifra única.
- `documentacion/fuentes_datos_economicos.md` aún no contiene un valor de
  consumo residencial de referencia para ZNI con su fuente trazada.
- No existe un módulo `analisis-economico` que centralice este parámetro; el
  literal vive disperso entre `vocabulario.py` y los CSV de Superservicios.

## Intentos previos

1. **Lectura directa del CSV de Superservicios**: implementada en
   `_consumo_residencial_kwh_mes`. El intento automatiza el cálculo de la
   media del campo `consumo_basico` pero queda en `pendiente` por dos
   motivos recurrentes: (a) el archivo CSV no se descarga como parte del
   proceso de `make data` o del pipeline reproducible, y (b) cuando existe,
   la media no queda etiquetada con año, operador ni universo de facturas
   del que se extrajo.
2. **Búsqueda de cifras UPME/IDEAM**: referenciada en el plan pero no
   incorporada al repositorio. No se descargó ningún documento primario.
3. **Comparación con referencias internacionales**: el consumo medio
   residencial colombiano está en el orden de 100-150 kWh/mes en zonas
   urbanas y de 50-100 kWh/mes en zonas rurales (cifras de contexto), pero
   no se ha confirmado contra una fuente primaria nacional reciente.

## Plan de cierre

1. Localizar el documento UPME/IDEAM/Superservicios que dé consumo
   residencial medio para Zonas No Interconectadas en Colombia, con año de
   referencia.
2. Si se mantiene el enfoque por Superservicios, descargar
   `comercial_residencial_isla_fuerte_2022.csv` (y un equivalente de otro
   operador representativo para validar la magnitud) al directorio
   `datos/zni/`, y procesar la media del campo `consumo_basico` con un
   script reproducible que registre el universo (número de facturas,
   filtro de ceros, año) en un JSON al lado.
3. Incorporar el valor a `datos/sitios/isla_fuerte.json` campo
   `consumo_residencial_medio_kwh_mes` con estado `verificado`, fuente,
   año y universo.
4. Añadir a `documentacion/fuentes_datos_economicos.md` la fuente
   primaria (UPME, IDEAM o Superservicios) con URL y año.
5. Si se prefiere una constante de proyecto, centralizarla en un módulo
   `nucleo/economia.py` (o similar) en lugar de dejarla literal en
   `vocabulario.py`, para que el dato sea trazable y editable en un único
   lugar.
6. Reejecutar las pruebas del panel "para cuántas casas alcanza" y
   verificar que el cálculo devuelve un número coherente con la magnitud
   esperada para una producción anual del orden de decenas a centenas de
   MWh.

## Criterio de cierre

El hueco se considera cerrado cuando `viviendas_alimentadas` deja de
devolver `estado: "pendiente"` para el caso por defecto y produce un número
de viviendas coherente con una fuente trazable (UPME, IDEAM o
Superservicios), registrada en `documentacion/fuentes_datos_economicos.md`
con año y universo de facturas.