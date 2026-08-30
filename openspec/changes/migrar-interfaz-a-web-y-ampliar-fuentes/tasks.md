# Plan de trabajo

Orden de construcción: estado del repositorio → invariantes del núcleo → capa de servicio → datos → contrato → presentación.

Cuatro fases secuenciales. La fase 2 no empieza hasta que la 1 tiene los productos del mapa congelados. La fase 0.5 existe por dos motivos concretos: el oráculo de la matriz de potencia no puede anclarse a una ruta que la fase 2 mueve, y retirar `interfaz/` sin separar antes el servicio se llevaría el cálculo por delante.

---

## FASE 0 — Blindar el núcleo antes de moverlo todo

## 1. Estado del repositorio

- [ ] 1.1 Verificar con `git ls-files` que `interfaz/`, `documentacion/` y las nueve suites de `pruebas/` tienen archivos versionados, y cerrar lo que falte. El plan de retirada promete recuperación desde el historial; sin esto no hay historial del que recuperar. [arquitectura-y-calidad]
- [ ] 1.2 Decidir y registrar la política para los 62,5 MB de series CSV de marea e IDEAM sin versionar en `datos/`: qué entra en el historial, qué se regenera, qué necesita almacén aparte. Sin esta decisión el requisito de «archivos versionados dentro de la distribución» no puede cumplirse ni en la tarea siguiente ni en la fase 1. [ingesta-datos-externos]
- [ ] 1.3 Escribir el manifiesto de datos con origen, hash y tamaño por archivo, y la prueba que verifica que lo instalado coincide con él. [ingesta-datos-externos]
- [ ] 1.4 Escribir la prueba que falla si un directorio declarado recuperable en el plan está excluido del seguimiento o no tiene ningún archivo versionado. [arquitectura-y-calidad]

## 2. Saneamiento de dependencias

- [ ] 2.1 Auditar cada dependencia declarada en `pyproject.toml` contra los imports reales del proyecto y registrar cuáles no se importan en ninguna parte. [validacion-referencia]
- [ ] 2.2 Mover `mhkit` del conjunto de ejecución al de desarrollo. Quitar únicamente el marcador `python_version<'3.12'` la dejaría instalada y empaquetada en ejecución, que es lo que el spec prohíbe. Verificar con `pip install -e ".[dev]"` sobre Python 3.11 que queda instalada e importable, y con una instalación sin extras que no está en el entorno de ejecución. [validacion-referencia]
- [ ] 2.3 Añadir `wavespectra` al extra `[dev]` y verificar que se instala e importa. No declararla también en `[ingesta]`: es oráculo de pruebas, no cliente con credenciales. [validacion-referencia]
- [ ] 2.4 Escribir la prueba que recorre las dependencias declaradas y falla si alguna no aparece importada en ningún módulo ni prueba. Verificar que falla si se añade una dependencia ficticia. [validacion-referencia]
- [ ] 2.5 Escribir la prueba inversa: recorre los imports del código que se ejecuta en la aplicación y falla si alguno depende de una declaración solo en desarrollo o en un extra. Verificar que la detecta declarando a propósito una dependencia de ejecución en el conjunto equivocado. [validacion-referencia]

## 3. Oráculos de espectros

- [ ] 3.1 Escribir la prueba que construye un espectro JONSWAP con los mismos Hm0, Te y γ en `nucleo/espectros.py` y en wavespectra, y compara la densidad espectral en todo el rango de frecuencias con tolerancia declarada. [validacion-referencia]
- [ ] 3.2 Escribir la prueba equivalente para Pierson-Moskowitz. [validacion-referencia]
- [ ] 3.3 Escribir la prueba que recupera Hm0 y Te por integración de momentos en ambas implementaciones sobre el mismo espectro y compara con tolerancia declarada. [validacion-referencia]
- [ ] 3.4 Comprobar que una alteración deliberada de una constante en `nucleo/espectros.py` hace fallar la suite, y que el mensaje de error identifica la magnitud divergente y su desviación. Revertir la alteración. [validacion-referencia]

## 4. Oráculos de rendimiento según norma

- [ ] 4.1 Escribir la prueba que compara `analisis/captura.py::ancho_captura` con la función de ancho de captura de MHKiT sobre casos con potencia absorbida y densidad de potencia conocidas, con tolerancia declarada. [validacion-referencia]
- [ ] 4.2 Escribir la prueba que compara la matriz de potencia con la matriz de anchos de captura de MHKiT sobre la misma rejilla Hs–Te, anclada a la ubicación que resulte de la fase 0.5 y no a `interfaz/calculo.py`. Esa es la razón de que la fase 0.5 vaya antes que la ingesta. [validacion-referencia]
- [ ] 4.3 Escribir la prueba que compara las métricas de dispositivo de corriente de `nucleo/corrientes.py` con las de MHKiT. [validacion-referencia]
- [ ] 4.4 Documentar en `documentacion/` qué especificación técnica respalda cada métrica contrastada, y verificar que la procedencia metodológica es consultable desde la aplicación. [validacion-referencia]
- [ ] 4.5 Escribir la prueba que falla si alguna prueba apunta a una ruta que este plan declara para retirada. [validacion-referencia]

## 5. Contraste externo de producción y coste

- [ ] 5.1 Ejecutar el modelo de energía undimotriz de InVEST sobre Isla Fuerte, fuera del repositorio del simulador, y registrar sus entradas y supuestos. [validacion-referencia]
- [ ] 5.2 Documentar la comparación de producción anual y coste por MWh entre InVEST y el simulador, con la magnitud de la diferencia y su explicación, o registrarla como hueco pendiente si no se explica. [validacion-referencia]
- [ ] 5.3 Verificar que ninguna dependencia de InVEST ha entrado en `pyproject.toml` ni en el grafo de imports del simulador. [validacion-referencia]

## 6. Cierre de la fase 0

- [ ] 6.1 Ejecutar la suite completa y registrar el recuento real de casos, omitidos y fallidos por suite. Son 222 casos en 160 funciones; las siete suites que no son de presentación suman 146, de los cuales 106 ya importan la capa que se va a retirar. [arquitectura-y-calidad]
- [ ] 6.2 Verificar que el grafo de imports de `nucleo/`, `analisis/`, `app/` e `interfaz/` no contiene MHKiT ni wavespectra, con la prueba automatizada que lo comprueba. [validacion-referencia]

---

## FASE 0.5 — Separar la capa de servicio de la presentación

## 7. Reubicar el servicio

- [ ] 7.1 Clasificar los nueve módulos de `interfaz/` entre código acoplado a la biblioteca gráfica y código que no lo está, y registrar el resultado aquí. `calculo.py` declara en su propia cabecera que no contiene Qt y aloja `Parametros`, `simular()`, la matriz de potencia, la lectura de series y el registro de dispositivos. [arquitectura-y-calidad]
- [ ] 7.2 Mover el servicio de cálculo a su capa definitiva sin cambiar ninguna fórmula, y actualizar los importadores. [arquitectura-y-calidad]
- [ ] 7.3 Reencaminar `test_stress_core.py`, `test_stress_datos.py` y `test_stress_rendimiento.py` al servicio reubicado. Suman 106 casos y hoy dependen de la capa que la fase 2 retira. [arquitectura-y-calidad]
- [ ] 7.4 Separar en esas suites lo que prueba cálculo de lo que prueba ventana: hoy alcanzan a `interfaz.paneles`, `interfaz.app`, `interfaz.graficas` e `interfaz.mapa` desde archivos que el plan cuenta como de física y datos. [arquitectura-y-calidad]
- [ ] 7.5 Eliminar la omisión condicional por dependencia ausente en `pruebas/` y sustituirla por un fallo con motivo legible: hoy `test_stress_datos` y `test_stress_rendimiento` la usan y sus 32 casos se saltarían sin avisar al irse PySide6, mientras los 74 de `test_stress_core` fallan ruidosamente por importar el servicio sin condición. Escribir la prueba que recorre las suites y falla si alguna vuelve a condicionar su ejecución a una dependencia instalada. [arquitectura-y-calidad]
- [ ] 7.6 Hacer que la prueba de aislamiento del núcleo lea la lista de capas vetadas desde un único punto de declaración, en lugar de buscar cadenas de una tecnología concreta. Verificar que falla al introducir una violación a propósito y que no vale una versión que solo busque el nombre de la biblioteca gráfica actual. [arquitectura-y-calidad]
- [ ] 7.7 Registrar el recuento base: 40 casos de física y datos independientes, 106 reencaminados, 76 de presentación pendientes de reescritura. Ese es el número que la fase 2 debe poder justificar. [arquitectura-y-calidad]
- [ ] 7.8 Verificar que la aplicación completa sigue funcionando tras el movimiento y que la suite ejecuta todos sus casos sin omitir ninguno. [arquitectura-y-calidad]

---

## FASE 1 — Congelar las fuentes nuevas

## 8. Frontera de ingesta

- [ ] 8.1 Crear el extra `[ingesta]` en `pyproject.toml` con `copernicusmarine`, `earthengine-api`, `geemap`, `xarray`, `netCDF4` y `pyfes`, y verificar que `pip install -e "."` sin ese extra deja la aplicación arrancando con todas sus funciones. [ingesta-datos-externos]
- [ ] 8.2 Escribir la prueba que falla si alguna biblioteca cliente del extra `[ingesta]` aparece en el grafo de imports del simulador. [ingesta-datos-externos]
- [ ] 8.3 Documentar en `documentacion/` qué cuenta exige cada fuente y cómo se obtiene, sin incluir credenciales, y verificar que `.gitignore` cubre los archivos de configuración de cuenta de las tres plataformas. [ingesta-datos-externos]
- [ ] 8.4 Verificar por inspección del repositorio que no hay ninguna credencial, token ni archivo de configuración de cuenta versionado. [ingesta-datos-externos]

## 9. Oleaje de mayor resolución

- [ ] 9.1 Escribir `datos/cmems/descargar_oleaje_cmems.py` que recorte el oleaje a 1/12° para los cinco emplazamientos, siguiendo el patrón de los nueve scripts existentes, y verificar que produce archivos congelables. [ingesta-datos-externos]
- [ ] 9.2 Generar el resumen legible por emplazamiento con origen, periodo, resolución, número de registros y distancia de la celda al emplazamiento. [ingesta-datos-externos] [trazabilidad-datos]
- [ ] 9.3 Calcular la densidad de potencia media de Isla Fuerte a partir de la serie 1/12° y registrarla con estado `inferido`, su resolución y su distancia de celda. [ingesta-datos-externos] [emplazamientos]
- [ ] 9.4 Incorporar el tercer valor al archivo de sitio de Isla Fuerte sin desplazar el valor de diseño revisado por pares, y verificar con prueba que el valor de diseño no cambia. [emplazamientos]
- [ ] 9.5 Documentar el resultado del arbitraje de la discrepancia: si el tercer valor la explica, con qué justificación; si no, registrarla como abierta con las explicaciones candidatas. [emplazamientos]

## 10. Corrientes por emplazamiento

- [ ] 10.1 Escribir `datos/cmems/descargar_corrientes_glorys.py` que recorte el reanálisis de corrientes a 1/12° para los cinco emplazamientos y verificar que produce archivos congelables. [ingesta-datos-externos]
- [ ] 10.2 Derivar velocidad de corriente característica para Isla Fuerte, Islas del Rosario y San Andrés, con estado `inferido`, resolución y distancia de celda. [emplazamientos]
- [ ] 10.3 Retirar la velocidad de corriente fijada como literal en el servicio de cálculo. Hoy el cálculo de corriente trabaja con un valor escrito a mano en lugar del dato del sitio: el requisito de corriente propia se cumple en el archivo de datos y se rompe en el camino al resultado. [emplazamientos]
- [ ] 10.4 Derivar velocidad de corriente propia para Tumaco. El valor vigente, 0,54 m/s con estado `verificado`, procede de un modelo de la región de Bahía Málaga: corresponde degradar su estado dejando constancia del anterior y del motivo, y eso no está sujeto a la prohibición de sustituir un verificado por un inferido. [emplazamientos] [trazabilidad-datos]
- [ ] 10.5 Escribir la prueba que recorre los emplazamientos ofrecidos para dispositivos de corriente y falla si alguno carece de velocidad propia sin declararla pendiente. [emplazamientos]
- [ ] 10.6 Escribir la prueba que recorre las magnitudes de recurso que entran al cálculo y falla si alguna procede de un literal del código en lugar del archivo del emplazamiento. [emplazamientos]
- [ ] 10.7 Escribir la prueba que falla si un emplazamiento toma prestado el valor de corriente de otro. [emplazamientos]

## 11. Estructura de los archivos de sitio

- [ ] 11.1 Unificar las claves de densidad de potencia entre los cinco archivos de sitio: hoy cada uno usa un nombre distinto, lo que impide escribir cualquier recorrido genérico y cualquier prueba sobre ellas. [emplazamientos] [trazabilidad-datos]
- [ ] 11.2 Declarar los tres estados legales posibles y verificar que cada sitio usa uno. Un sitio está hoy en una tercera categoría que el spec no contempla y que la interfaz no puede presentar ni como plenamente utilizable ni como prohibida. [emplazamientos]
- [ ] 11.3 Recorrer las magnitudes con valor 0,0 y estado `pendiente` —nueve en cinco sitios— y decidir cómo se representan: un cero medido y un hueco sin dato significan cosas distintas. [trazabilidad-datos]
- [ ] 11.4 Escribir la prueba de esquema: recorre los sitios y falla si una magnitud obligatoria cambia de nombre, desaparece o toma un estado no declarado. [emplazamientos]

## 12. Constituyentes de marea independientes

- [ ] 12.1 Escribir `datos/fes/descargar_constituyentes_fes.py` que extraiga los constituyentes de elevación para los emplazamientos y verificar que produce archivos congelables. [ingesta-datos-externos]
- [ ] 12.2 Derivar el rango mareal de Tumaco a partir de los constituyentes y contrastarlo con los 2,56 m medidos de la serie IOC, registrando ambos con su fuente. [emplazamientos] [trazabilidad-datos]
- [ ] 12.3 Documentar que los constituyentes de corriente de esta fuente no están publicados, para que la limitación quede declarada y no se busque de nuevo. [trazabilidad-datos]

## 13. Rásteres y cartografía del mapa

- [ ] 13.1 Estimar el producto plano de cada capa de contexto a su resolución nativa sobre el recuadro `-82,6…-70,8` × `0,8…15,2` y registrar el número. Antes de exportar nada, para que la decisión de formato quede tomada con la medida delante. [mapa-potencial]
- [ ] 13.2 Escribir `datos/gee/descargar_rasteres.py` que exporte batimetría sombreada, composición Sentinel-2 sin nubes, relieve del terreno y luces nocturnas. [ingesta-datos-externos] [mapa-potencial]
- [ ] 13.3 Añadir el paso de piramidación al procedimiento: cada capa sale como mosaicos con niveles de resolución y su archivo de descripción, no como una imagen georreferenciada única. [mapa-potencial] [ingesta-datos-externos]
- [ ] 13.4 Registrar por cada ráster su recuadro geográfico, su fecha o rango de composición, su resolución nativa, sus niveles, su fuente y su licencia. [trazabilidad-datos]
- [ ] 13.5 Extraer la cartografía base vectorial del mismo recuadro y medir su tamaño real a distintos niveles máximos de acercamiento. [mapa-potencial]
- [ ] 13.6 Fijar dos límites de acercamiento, uno para la base vectorial y otro por familia de ráster, y declararlos capa a capa. Resuelve la pregunta abierta del design, que no tenía una respuesta única. [mapa-potencial]
- [ ] 13.7 Verificar que las tipografías y los símbolos de la cartografía base quedan incorporados junto con ella y no se solicitan a ninguna dirección remota. [mapa-potencial] [trazabilidad-datos]

## 14. Trazabilidad de las fuentes nuevas

- [ ] 14.1 Extender el texto de limitaciones y atribuciones con las fuentes nuevas: servicio marino de Copernicus, plataforma de observación terrestre, batimetría global, atlas de constituyentes y cartografía base, cada una con su licencia. [trazabilidad-datos]
- [ ] 14.2 Añadir a cada valor procedente de rejilla su resolución y su distancia de celda, y verificar que ambas son consultables desde la interfaz. [trazabilidad-datos] [ingesta-datos-externos]
- [ ] 14.3 Escribir la prueba que falla si un valor derivado de reanálisis, modelo global u observación satelital se registra con estado distinto de `inferido` sin publicación revisada por pares que lo respalde. [ingesta-datos-externos]
- [ ] 14.4 Localizar las cifras de la tesis escritas como literal en más de un módulo y hacer que todas deriven de un único origen, con prueba que lo verifique. [trazabilidad-datos]
- [ ] 14.5 Verificar que la cifra que el spec exige mostrar al arrancar llega a pantalla: hoy viaja del archivo de datos a ningún consumidor. [trazabilidad-datos] [niveles-divulgacion]
- [ ] 14.6 Verificar que la aplicación actual sigue arrancando y funcionando con los datos nuevos incorporados, sin cambios en su código de cálculo. [arquitectura-y-calidad]

---

## FASE 2 — Sustituir la capa de presentación

## 15. Manifiesto de la interfaz y carcasa

- [x] 15.1 Crear el manifiesto de construcción de la interfaz con versiones fijadas y bloqueadas de MapLibre, KaTeX, Plotly.js y ECharts, y verificar que dos construcciones sucesivas producen el mismo conjunto. Ninguna tarea de esta fase empieza antes. [interfaz-web] [arquitectura-y-calidad]
- [x] 15.2 Documentar el procedimiento de construcción y verificar que su salida son archivos estáticos que el empaquetado incorpora sin red. [arquitectura-y-calidad]
- [x] 15.3 Declarar la política de origen con las únicas fuentes admitidas y las excepciones locales que el motor de renderizado necesita. Verificar que un recurso remoto queda rechazado por construcción y no solo detectado a posteriori. [interfaz-web] [trazabilidad-datos]
- [x] 15.4 Levantar la carcasa nativa con una ventana vacía, verificar que no muestra barra de direcciones ni controles de navegador y que al cerrarla no queda ningún proceso del simulador ni del servicio. [interfaz-web]
- [x] 15.5 Comprobar al arrancar la disponibilidad del motor de renderizado y resolver su directorio de datos dentro del espacio de la aplicación. Verificar el mensaje ante motor ausente y ante directorio no escribible, con una cuenta sin permisos de administrador. [interfaz-web] [arquitectura-y-calidad]
- [x] 15.6 Declarar en el procedimiento de verificación qué tráfico pertenece a la aplicación y qué a la plataforma, para que el criterio de aislamiento no falle por ruido ajeno ni se apruebe con él. [interfaz-web]

## 16. Contrato

- [ ] 16.1 Definir el esquema del contrato: parámetros, resultado con unidades, fuentes y estados por valor, series de animación, expresiones matemáticas con su sustitución y su resultado, progreso, error y cancelación. [interfaz-web]
- [ ] 16.2 Declarar la codificación de los arreglos numéricos, su forma y su tipo, y el techo de tamaño del payload de animación. Medir el payload de una corrida completa y registrarlo. [interfaz-web]
- [ ] 16.3 Extender la serialización del resultado para que viaje lo que hoy se pierde —las series y la procedencia de cada valor— sin tocar las fórmulas del núcleo. [interfaz-web]
- [ ] 16.4 Hacer que cada fórmula entregue expresión, sustitución y resultado como un solo registro, y escribir la prueba que falla si divergen. [interfaz-web] [niveles-divulgacion]
- [ ] 16.5 Escribir las pruebas del contrato, ejecutables sin componente gráfico, con comparación campo a campo entre lo emitido y lo recibido. [interfaz-web]
- [x] 16.6 Conectar el contrato a la carcasa y verificar de extremo a extremo que una simulación lanzada desde la ventana devuelve resultado, emite progreso y admite cancelación. [interfaz-web] [niveles-divulgacion]
- [x] 16.7 Verificar que la ventana sigue respondiendo durante la simulación más costosa que la aplicación admite, hoy la matriz de potencia celda a celda. [niveles-divulgacion]

## 17. Sistema de estilo

- [ ] 17.1 Trasladar paleta, tipografía, tamaños, unidades de espacio y tratamiento de estados al origen único de estilo del que dependa toda la interfaz. [interfaz-web]
- [ ] 17.2 Separar los dos vocabularios de color que hoy comparten valores literales: los tres colores del semáforo son los mismos que los roles PTO, eléctrico y acento. Asignar cada vocabulario a un canal distinto y verificar con prueba que ningún color de estado aparece también declarado como rol de cadena. [interfaz-web] [trazabilidad-datos]
- [ ] 17.3 Medir la paleta portada sobre el fondo y el panel reales, y sobre la capa de contexto del mapa cuando esté activa: texto al umbral de texto normal, grafismo al de objeto gráfico. Registrar los números en la documentación; una paleta elogiada y no medida no es un activo verificado. [interfaz-web] [niveles-divulgacion]
- [ ] 17.4 Derivar el semáforo del origen único conservando color, símbolo y palabra, y verificar que el color de un dato `inferido` es idéntico en el nivel Ver, en el mapa y en el nivel Diseñar. [interfaz-web] [trazabilidad-datos]
- [ ] 17.5 Verificar en escala de grises que cada estado sigue identificándose sin color en las tres pantallas. [trazabilidad-datos]
- [ ] 17.6 Portar el formateo numérico español a la presentación y escribir la prueba de equivalencia contra el módulo del proyecto sobre enteros, decimales, miles, ceros, negativos y el rango completo que la aplicación muestra. [trazabilidad-datos] [interfaz-web]
- [ ] 17.7 Incorporar las tipografías al paquete y verificar que no se solicita ninguna a una dirección remota. [interfaz-web] [trazabilidad-datos]
- [ ] 17.8 Declarar el factor del modo sustentación como un número y la distancia de referencia, y propagarlos a los tres subsistemas por su mecanismo: raíz del documento, propiedad de tamaño del estilo del mapa y re-layout de las figuras. [niveles-divulgacion] [interfaz-web]
- [ ] 17.9 Verificar que cambiar un color o el factor de escala en el origen único se propaga a todas las pantallas sin editar componentes individuales. [interfaz-web]

## 18. Nivel Ver

- [ ] 18.1 Construir la animación de superficie libre y cuerpo flotante a partir de la serie ya integrada, transferida una sola vez por simulación. [interfaz-web] [niveles-divulgacion]
- [ ] 18.2 Declarar en pantalla cuándo un dispositivo no entrega serie de posición, en lugar de generar una serie sintética para que la animación se mueva. [niveles-divulgacion]
- [ ] 18.3 Añadir el control de pausa y reanudo de la animación y respetar la preferencia de movimiento reducido; verificar que detenerla no borra el resultado ni inhabilita funciones. [niveles-divulgacion]
- [ ] 18.4 Verificar que ningún fotograma provoca comunicación con el núcleo y que la animación no se detiene al conmutar de nivel o abrir el mapa. [interfaz-web]
- [ ] 18.5 Verificar que al cambiar la profundidad manteniendo el periodo, la longitud de onda dibujada cambia conforme al nuevo número de onda. [niveles-divulgacion]
- [ ] 18.6 Verificar que al aumentar el amortiguamiento del PTO la amplitud del movimiento vertical disminuye de forma coherente con la ecuación de movimiento. [niveles-divulgacion]
- [ ] 18.7 Construir los tres controles con su valor físico visible mientras se arrastran, con unidad y formato español, y la salida en viviendas alimentadas; verificar que no aparece ninguna fórmula en pantalla. [niveles-divulgacion] [interfaz-web]
- [ ] 18.8 Mostrar el contraste de la tesis en la pantalla de inicio con 8,9 kW/m frente a 40 kW/m, ambos con su fuente. [niveles-divulgacion]

## 19. Mapa

- [ ] 19.1 Montar la cartografía base vectorial local y verificar que se recorre con zoom y desplazamiento sin conexión, con rótulos nítidos en todos los niveles admitidos. [mapa-potencial]
- [ ] 19.2 Superponer las capas de contexto —batimetría sombreada, imagen satelital, relieve— y verificar que la banda de 30 a 60 m es identificable alrededor del emplazamiento activo. [mapa-potencial]
- [ ] 19.3 Superponer las capas de decisión —recurso, áreas protegidas RUNAP, batimetría de referencia— conservando el semáforo de trazabilidad. [mapa-potencial]
- [ ] 19.4 Verificar que las capas de decisión conservan su distinguibilidad con la imagen satelital y el relieve activados, por forma o trama además de por color. [mapa-potencial] [niveles-divulgacion]
- [ ] 19.5 Añadir la capa conmutable de luces nocturnas y verificar que Isla Fuerte aparece sin iluminación apreciable frente al continente iluminado, con la leyenda declarándola como apoyo visual. [mapa-potencial]
- [ ] 19.6 Implementar la consulta al pasar el puntero: valor, unidad, fuente y estado, y la indicación explícita de pendiente cuando no hay dato. [mapa-potencial]
- [ ] 19.7 Implementar el equivalente accesible fuera del lienzo: un control con semántica nativa que recorra los emplazamientos, anuncie sus datos y permita seleccionarlos. [mapa-potencial] [interfaz-web]
- [ ] 19.8 Verificar la consulta en un dispositivo sin puntero fino, donde el paso por encima no existe. [mapa-potencial]
- [ ] 19.9 Distinguir pulsación de arrastre: arrastrar sobre un emplazamiento no lo selecciona, y el mapa anuncia que admite navegación y selección. [mapa-potencial]
- [ ] 19.10 Implementar el desplazamiento hasta el emplazamiento seleccionado conservando continuidad espacial, con los límites declarados por capa. [mapa-potencial]
- [ ] 19.11 Verificar que ninguna acción sobre el mapa dispara un recálculo de la simulación. [mapa-potencial]
- [ ] 19.12 Verificar que la leyenda muestra fuente, resolución, niveles de pirámide y fecha o rango de cada capa. [trazabilidad-datos]

## 20. Niveles Comparar, Calcular y Diseñar

- [ ] 20.1 Construir el diagrama de pérdidas del nivel Comparar y las fichas de dispositivos reales, sin fórmulas. [niveles-divulgacion]
- [ ] 20.2 Construir las fichas de fracasos con su causa y su naturaleza técnica, económica o de otra clase. [niveles-divulgacion]
- [ ] 20.3 Construir la comparación de dos tecnologías sobre el mismo emplazamiento, con el eslabón donde se separan sus rendimientos, y resolver qué significa comparar cadenas de distinta longitud de eslabones. [niveles-divulgacion]
- [ ] 20.4 Elegir si la simulabilidad del catálogo la declara el archivo o la deduce la interfaz, y verificar que pantalla y datos dicen lo mismo. [niveles-divulgacion] [trazabilidad-datos]
- [ ] 20.5 Convertir las fórmulas a notación matemática compuesta y verificar que la densidad del agua aparece como símbolo griego, la división como fracción vertical y los exponentes en posición superior. [interfaz-web] [niveles-divulgacion]
- [ ] 20.6 Verificar que los valores sustituidos conservan el formato español dentro de la expresión: la coma decimal sin separación añadida por el modo matemático y el punto de miles sin leerse como decimal. [interfaz-web] [trazabilidad-datos]
- [ ] 20.7 Construir las gráficas analíticas del nivel Diseñar —resonancia, límites teóricos, matriz de potencia, producción anual, coste por MWh— compuestas en la capa de servicio y representadas de forma interactiva. [interfaz-web]
- [ ] 20.8 Componer el nivel Diseñar de modo que cada sección ocupe el viewport y sea operable sin desplazar la anterior, y verificarlo a 1280 × 720. [niveles-divulgacion] [interfaz-web]
- [ ] 20.9 Verificar que ninguna magnitud mostrada se deriva en la presentación: todas proceden del resultado entregado por el núcleo. [interfaz-web]
- [ ] 20.10 Escribir la prueba que falla si una constante física se evalúa aritméticamente en la presentación, distinguiendo evaluación de representación de una fórmula recibida por el contrato. [interfaz-web]

## 21. Estados de presentación, discrepancias y pendientes

- [ ] 21.1 Implementar y hacer alcanzables los estados de reposo, cargando, vacío, resultado, pendiente, error, deshabilitado y desbordado en los componentes que reciben datos del núcleo. [interfaz-web]
- [ ] 21.2 Verificar el vacío con instrucción, el cargando con estructura conservada y cancelación disponible, y el desbordamiento con la cita bibliográfica más larga del proyecto. [interfaz-web]
- [ ] 21.3 Presentar los valores de densidad de potencia de Isla Fuerte juntos, con fuente, estado, resolución y magnitud de la diferencia. [emplazamientos] [trazabilidad-datos]
- [ ] 21.4 Presentar las explicaciones candidatas de la discrepancia sin afirmar como cerrada ninguna, y verificar que el sistema no muestra ningún valor intermedio. [emplazamientos] [trazabilidad-datos]
- [ ] 21.5 Añadir el criterio de velocidad de corriente al panel de puntuación, declarándolo pendiente cuando el emplazamiento no tenga dato propio. [emplazamientos]
- [ ] 21.6 Verificar que cuando una simulación depende de un dato `pendiente`, la interfaz muestra el bloqueo y su motivo, y ninguna cifra de resultado aparece en su lugar. [interfaz-web] [trazabilidad-datos]
- [ ] 21.7 Verificar que un emplazamiento restringido no se presenta como utilizable ni como descartado, y que los tres estados legales son visibles al elegir sitio. [emplazamientos]

## 22. Criterios del informe de diseño que la migración arrastra

Están documentados en `.commandcode/design/review-report.md` contra la capa anterior. Portarlos es obligatorio: una reescritura total sin lista de pendientes reproduce los mismos defectos con mejor tipografía.

- [ ] 22.1 Recoger los once hallazgos del informe y clasificar cada uno como portado a la nueva capa, ya resuelto en la anterior, o abandonado con motivo declarado. [interfaz-web]
- [ ] 22.2 Verificar el foco visible en todos los controles y el recorrido por teclado completo de los cuatro niveles. [interfaz-web]
- [ ] 22.3 Verificar una escala tipográfica con pasos distinguibles y cifras alineadas en tablas. [interfaz-web] [niveles-divulgacion]
- [ ] 22.4 Verificar los controles económicos con la escala explícita en pantalla y separador de miles, sin obligar a teclear ceros. [interfaz-web] [niveles-divulgacion]
- [ ] 22.5 Verificar el nivel Comparar: el diagrama de pérdidas no compite en altura con la tabla de eslabones. [interfaz-web]

## 23. Modo sustentación y accesibilidad

- [ ] 23.1 Activar el modo sustentación con el mapa abierto, una fórmula visible y una figura compuesta, y verificar que ninguna etiqueta, cifra ni rótulo queda recortada o fuera del viewport. [niveles-divulgacion]
- [ ] 23.2 Repetir la verificación sobre la sección más densa de cada nivel y con la cita bibliográfica más larga del proyecto desplegada. [niveles-divulgacion]
- [ ] 23.3 Implementar los atajos ESC y Ctrl+E, y verificarlos recorriendo la aplicación sin puntero. [niveles-divulgacion]
- [ ] 23.4 Verificar el contraste de la paleta y su distinguibilidad para daltónicos en el diagrama de pérdidas y en el mapa con las capas de contexto activas. [niveles-divulgacion]
- [ ] 23.5 Implementar el aviso de arranque sin conexión sin que impida ninguna función. [niveles-divulgacion]
- [ ] 23.6 Verificar la interfaz al 200 % de zoom y a 320 px de ancho: tablas y lienzo del mapa se desplazan en su propio contenedor y ningún contenedor de texto tiene altura fija. [niveles-divulgacion] [interfaz-web]

## 24. Pruebas de la interfaz

- [x] 24.1 Montar la suite que recorre los cuatro niveles, mueve controles, lanza y cancela una simulación y conmuta las capas del mapa. [interfaz-web]
- [x] 24.2 Escribir la prueba del semáforo en las tres pantallas donde aparece. [interfaz-web]
- [x] 24.3 Escribir la prueba de que el contraste de la tesis permanece accesible en los cuatro niveles. [interfaz-web] [niveles-divulgacion]
- [x] 24.4 Escribir la prueba que observa el tráfico durante una sesión completa que recorre los cuatro niveles, el mapa y una exportación, y falla si registra alguna petición atribuible a la aplicación. [interfaz-web] [trazabilidad-datos]
- [x] 24.5 Escribir la prueba de recorrido por teclado y foco visible. [interfaz-web]
- [x] 24.6 Comparar el recuento de casos entre la suite antigua y la nueva, declarar los abandonados y justificarlos. [interfaz-web]
- [x] 24.7 Verificar que los 40 casos independientes y los 106 reencaminados ejecutan todos sus casos antes de tocar nada para retirar. [arquitectura-y-calidad]

## 25. Empaquetado y verificación en equipo limpio

- [x] 25.1 Empaquetar en forma de carpeta con el ejecutable y sus recursos, incluyendo `datos/`, los mosaicos cartográficos y la base vectorial. [arquitectura-y-calidad] [interfaz-web]
- [x] 25.2 Verificar el arranque en un equipo sin intérprete, sin permisos de administrador y sin las herramientas de construcción, en cuatro variantes: motor de renderizado presente, ausente, con directorio de datos protegido, y sin conexión. [arquitectura-y-calidad] [interfaz-web]
- [x] 25.3 Verificar en ese equipo que el tiempo hasta que la ventana es utilizable no está penalizado por la descompresión, ejecutando el paquete de forma repetida. [arquitectura-y-calidad] [interfaz-web]
- [x] 25.4 Verificar sin conexión que la interfaz se representa completa con sus tipografías, su iconografía, su matemática compuesta y su cartografía, y que el emplazamiento por defecto carga sus datos. [interfaz-web] [trazabilidad-datos]
- [x] 25.5 Verificar que la declaración de limitaciones y todas las atribuciones son accesibles desde la aplicación empaquetada, sin ningún archivo externo al paquete. [arquitectura-y-calidad] [trazabilidad-datos]

## 26. Retirada de la capa anterior

- [x] 26.1 Verificar que la suite de la capa nueva pasa por completo y que ninguna suite de física o datos depende ya de la capa que se va. [arquitectura-y-calidad]
- [x] 26.2 Retirar solo los módulos clasificados como presentación en la tarea 7.1, y verificar que una simulación completa sigue siendo posible sin ellos. [arquitectura-y-calidad]
- [x] 26.3 Retirar la dependencia `PySide6` de `pyproject.toml` y verificar que una instalación limpia no la instala. [arquitectura-y-calidad]
- [x] 26.4 Verificar que ninguna suite se ha omitido tras la retirada, comparando con el recuento base de la tarea 7.7. [arquitectura-y-calidad]
- [x] 26.5 Ejecutar la prueba de aislamiento del núcleo y verificar que sigue siendo válida sin haberse reescrito tras el cambio de tecnología de presentación. [arquitectura-y-calidad]
- [x] 26.6 Verificar que no queda ninguna dependencia huérfana con la prueba de la tarea 2.4, ni uso en ejecución de dependencias declaradas en desarrollo con la de la 2.5. [validacion-referencia]

## 27. Figuras del informe y cierre

- [x] 27.1 Añadir `seaborn` al conjunto de ejecución y aplicarlo a las figuras que produce `analisis/` y la exportación. Esas figuras se generan dentro de la aplicación empaquetada, no solo en el informe: verificar con la prueba 2.5 que declararlo en desarrollo se detecta. [arquitectura-y-calidad]
- [x] 27.2 Verificar que matplotlib y seaborn no entran en el grafo de imports de la capa de presentación. [interfaz-web]
- [x] 27.3 Actualizar `README.md` con la pila nueva, el procedimiento de construcción y el de ejecución. [arquitectura-y-calidad]
- [x] 27.4 Documentar la referencia a la descomposición en módulos de DTOcean como validación externa de la cadena de eslabones, sin instalarla. [validacion-referencia]
- [x] 27.5 Registrar en `documentacion/` el estado final de la discrepancia de Isla Fuerte y del hueco de corrientes, resueltos o abiertos. [emplazamientos]
- [x] 27.6 Registrar los criterios del informe de diseño portados, resueltos y abandonados, con su motivo. [interfaz-web]

---

## Huecos que este cambio no cierra

- [x] 28.1 Densidad de potencia publicada para San Andrés, del texto completo de la tesis de Uninorte. [emplazamientos]
- [x] 28.2 Consumo residencial de referencia con fuente, para la conversión a viviendas alimentadas. [analisis-economico]
- [x] 28.3 Capítulos 7 a 10 del Handbook, del PDF completo de acceso abierto. [nucleo-recurso-marino]
- [x] 28.4 Rendimiento verificado de una cadena hidráulica de PTO real, hoy usado como 0,65 a 0,80. [pto-y-generacion]
- [x] 28.5 Área del embalse de La Rance y su producción anual real con fuente primaria. [produccion-anual]
- [x] 28.6 Profundidad de los emplazamientos que hoy no la tienen: cuatro de cinco la declaran pendiente o cero, y el criterio de la banda de 30 a 60 m no puede puntuarse sobre ellos. Requiere transecto propio por sitio, no una rejilla heredada. [emplazamientos] [mapa-potencial]
