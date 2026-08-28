## Contexto verificado que estos requisitos corrigen

La versión anterior de este delta daba por hecho que el único código acoplado a la presentación estaba en `interfaz/` y que las pruebas de física y datos no se veían afectadas. Comprobado el repositorio, ninguna de las dos cosas es cierta:

- `interfaz/calculo.py` (348 de las 2.652 líneas) declara en su cabecera «Aquí no hay Qt» y contiene `Parametros`, `simular()`, `_matriz_potencia`, `_aep_matriz`, `serie_oleaje()` y el registro `DISPOSITIVOS`. Es la capa de servicio, no la presentación, y sin ella no hay aplicación.
- De las nueve suites de `pruebas/`, seis mencionan `interfaz` o `PySide6`: además de las dos de interfaz (61 casos), `test_stress_core.py`, `test_stress_datos.py` y `test_stress_rendimiento.py` importan la capa de servicio, y `test_core_invariantes.py` la menciona como cadena literal en su prueba de aislamiento.
- Las dos primeras usan `pytest.importorskip("PySide6")`. Al desaparecer la dependencia, se saltan sin avisar: una casilla verde que no ha ejecutado nada.

Estos tres hechos obligan a una fase intermedia y a endurecer los requisitos siguientes.

## MODIFIED Requirements

### Requirement: Arquitectura limpia / hexagonal

El núcleo de física (`nucleo/`, `analisis/`) NO SHALL importar ningún módulo de la capa de presentación ni de la capa de aplicación, ni ninguna biblioteca de interfaz gráfica, con independencia de cuál sea la tecnología de presentación vigente. Las reglas de negocio SHALL estar aisladas de frameworks, base de datos y UI, con dependencias apuntando hacia dentro.

El sistema SHALL usar inyección de dependencias para constantes físicas (`ρ`, `g`) y para fuentes de datos (sitios/dispositivos), en lugar de que cada módulo las cree internamente.

La prohibición SHALL expresarse como lista cerrada de capas y bibliotecas vetadas, no como la búsqueda de nombres concretos de una tecnología determinada. Un test que busque la cadena «PySide6» NO cumple este requisito: tras una sustitución de tecnología pasa sin que nada lo compruebe.

#### Scenario: Núcleo sin dependencia gráfica

- **WHEN** se analiza estáticamente el grafo de imports de `nucleo/` y `analisis/`
- **THEN** no aparece ningún import de la capa de presentación ni de ninguna biblioteca de interfaz gráfica
- **AND** una prueba automatizada falla si aparece

#### Scenario: La prueba sobrevive al cambio de tecnología porque se escribió para cambiar

- **WHEN** se sustituye la tecnología de presentación por otra
- **THEN** la prueba de aislamiento del núcleo sigue siendo válida sin reescribirse
- **AND** la lista de vetos se actualiza desde un único punto de declaración de capas
- **AND** añadir una capa o una biblioteca gráfica nueva sin declararla hace fallar la prueba

#### Scenario: El veto se comprueba añadiendo la violación

- **WHEN** se introduce deliberadamente un import de la capa de presentación en un módulo del núcleo
- **THEN** la prueba de aislamiento falla con un mensaje que nombra módulo, import y capa vetada
- **AND** revertido el import, la prueba vuelve a pasar

#### Scenario: DI de constantes físicas

- **WHEN** se instancia un cálculo de recurso
- **THEN** `ρ` y `g` se pasan como parámetros con valor por defecto documentado
- **AND** cambiar `ρ` de 1.025 a 1.000 cambia `J` de 0,4906 a 0,4786 dentro del 0,1 %

### Requirement: Patrones de diseño y DI

El sistema SHALL aplicar patrones estándar solo cuando resuelvan un problema especificado: Strategy para PTO, Factory para dispositivos, Observer para progreso y cancelación.

La realización concreta del Observer SHALL ser independiente de la tecnología de presentación: el núcleo y la capa de aplicación SHALL notificar mediante mecanismos propios del lenguaje, y la traducción a los avisos de la interfaz SHALL ocurrir en la capa de presentación.

#### Scenario: Strategy de PTO intercambiable

- **WHEN** se cambia el tipo de PTO sobre el mismo dispositivo
- **THEN** solo cambia la estrategia de rendimiento, sin tocar la cadena

#### Scenario: Observer sin acoplamiento a la interfaz

- **WHEN** se ejecuta un trabajo con notificación de progreso en un entorno sin componente gráfico
- **THEN** los avisos de progreso, resultado y error se emiten y se reciben con normalidad

### Requirement: Entrega empaquetada y ejecutable sin Python instalado

El sistema SHALL distribuirse como paquete que arranca en un equipo sin Python ni dependencias instaladas y sin permisos de administrador. El paquete SHALL incluir los datos locales de `datos/` y todos los recursos que la interfaz necesite para representarse, y SHALL operar sin conexión a internet.

La forma del paquete —archivo único o carpeta con ejecutable y recursos— SHALL elegirse de modo que el arranque no quede penalizado por la descompresión del artefacto en cada ejecución.

La declaración de limitaciones del modelo SHALL ser accesible desde la aplicación empaquetada, no solo desde el repositorio.

El requisito de arrancar sin conexión y sin permisos de administrador SHALL cubrir el motor de renderizado del sistema del que dependa la interfaz: su ausencia y la imposibilidad de escribir su directorio de datos son modos de fallo del arranque y SHALL estar especificados en la capacidad de interfaz correspondiente.

#### Scenario: Arranque en equipo limpio

- **WHEN** se ejecuta el paquete en un equipo sin Python instalado y sin conexión
- **THEN** la aplicación arranca y el emplazamiento por defecto se carga con sus datos

#### Scenario: Arranque sin penalización por descompresión

- **WHEN** se ejecuta el paquete de forma repetida en el mismo equipo
- **THEN** el tiempo hasta que la ventana es utilizable no crece con el tamaño del artefacto por causa de la descompresión

#### Scenario: Limitaciones dentro del paquete

- **WHEN** se consultan las limitaciones del modelo desde la aplicación empaquetada
- **THEN** el texto aparece sin requerir ningún archivo externo al paquete

## ADDED Requirements

### Requirement: La capa de servicio se reubica antes de retirar la presentación

El código que orquesta el cálculo sin depender de ninguna biblioteca de interfaz gráfica SHALL vivir en una capa de servicio, no dentro del directorio de la presentación. Reubicarlo SHALL preceder a cualquier retirada de la capa de presentación anterior.

Retirar un directorio de presentación NO SHALL eliminar ninguna capacidad de cálculo, de carga de datos o de serie temporal que resida en él y no dependa de la tecnología retirada.

#### Scenario: El servicio sobrevive a la retirada

- **WHEN** se retira la capa de presentación anterior
- **THEN** la ejecución de una simulación completa sigue siendo posible sin esa capa
- **AND** la suite de física y datos que consume el servicio sigue ejecutándose

#### Scenario: Inventario de lo que se retira

- **WHEN** se planifica la retirada de la capa de presentación
- **THEN** existe una clasificación explícita de sus archivos entre código acoplado a la tecnología retirada y código que no lo está
- **AND** cada archivo no acoplado tiene declarado un destino antes de la retirada

#### Scenario: La matriz de potencia tiene dueño estable

- **WHEN** se retira la presentación anterior
- **THEN** el cálculo de la matriz de potencia sobre la rejilla de estados de mar sigue existiendo en la capa de servicio
- **AND** el oráculo que lo contrasta contra la referencia apunta a su nueva ubicación

### Requirement: Las pruebas no se autoexcluyen en silencio

Ningún módulo de prueba SHALL condicionar su ejecución a la presencia de una biblioteca que el proyecto declara como dependencia. La exclusión silenciosa de una suite hace que una casilla verde signifique «no ejecutado», que es el modo de fallo más peligroso de una verificación de no regresión.

Cuando una prueba necesite un componente externo ausente, SHALL fallar con un motivo legible en lugar de omitirse.

#### Scenario: Desaparece la dependencia y la prueba no se calla

- **WHEN** se retira una dependencia y una suite que la necesitaba deja de ejecutarse
- **THEN** la suite falla declarando qué falta y por qué debía ejecutarse
- **AND** una prueba automatizada recorre los archivos de `pruebas/` y falla si alguno usa la omisión condicional por dependencia

#### Scenario: Las suites de física y datos siguen ejecutándose tras la retirada

- **WHEN** se retira la capa de presentación anterior y su dependencia
- **THEN** las suites que no pertenecen a la interfaz ejecutan todos sus casos, no se saltan ninguno
- **AND** el recuento de casos ejecutados se compara con el recuento previo y la diferencia queda explicada

### Requirement: El estado del repositorio es prerrequisito del plan de retirada

Todo código y todo dato que un plan de retirada declare recuperable desde el historial SHALL estar efectivamente versionado antes de que la retirada se programme. Una garantía de reversibilidad sobre archivos sin seguimiento en el control de versiones NO es una garantía.

Los datos de origen externo de gran volumen SHALL declarar su política de versionado: qué se guarda en el historial, qué se regenera, cómo se identifica la versión empleada y cómo se verifica su integridad.

#### Scenario: Retirar sin perder

- **WHEN** se programa retirar una capa de presentación
- **THEN** esa capa está versionada y su contenido es recuperable desde el historial
- **AND** una comprobación automática verifica que el directorio no está excluido del seguimiento

#### Scenario: Los datos congelados están versionados o se declara que no

- **WHEN** una serie o un archivo de datos forma parte de la distribución
- **THEN** está versionado, o existe una declaración explícita de que se regenera y de cómo se identifica su versión
- **AND** el paquete distribuido puede indicar qué versión de datos contiene mediante un manifiesto con hashes

### Requirement: Retirada de la capa de presentación sustituida

La capa de presentación anterior SHALL retirarse del repositorio y de las dependencias declaradas solo cuando la capa nueva satisfaga todos los requisitos de los niveles de divulgación, del mapa de potencial y de la interfaz, verificados por su suite de pruebas.

Durante la transición NO SHALL mantenerse indefinidamente dos capas de presentación en paralelo: la coexistencia SHALL limitarse al periodo de verificación y SHALL terminar con la retirada de la anterior.

Antes de retirar nada SHALL cumplirse lo declarado en el recuento de pruebas: los casos de la suite anterior que la nueva no reproduce están contados y justificados, y ninguna suite de física o datos depende ya de la capa que se va.

#### Scenario: Retirada condicionada a la verificación

- **WHEN** se retira la capa de presentación anterior
- **THEN** la suite de pruebas de la capa nueva pasa por completo
- **AND** la dependencia de la biblioteca gráfica anterior desaparece de la configuración del proyecto
- **AND** las suites de física y datos ejecutan todos sus casos sin depender de la capa retirada

#### Scenario: Sin dependencias huérfanas tras la retirada

- **WHEN** se instala el proyecto después de la retirada
- **THEN** no se instala ninguna biblioteca de la capa de presentación anterior

### Requirement: Herramientas de construcción fuera del artefacto

Las herramientas necesarias para construir los recursos de la interfaz SHALL ser exigibles solo en el entorno de desarrollo. El equipo donde se ejecuta el paquete distribuido NO SHALL necesitar instalarlas.

El resultado de la construcción SHALL ser un conjunto de archivos estáticos incorporado al paquete.

Las bibliotecas de tercero que la interfaz necesite para representarse SHALL estar declaradas en un manifiesto de construcción con versión fijada y bloqueo verificable. La ausencia de ese manifiesto impide construir la interfaz y SHALL tratarse como bloqueante previo a cualquier tarea de implementación de la presentación.

#### Scenario: Equipo de demostración sin cadena de construcción

- **WHEN** se ejecuta el paquete en un equipo sin las herramientas de construcción de la interfaz instaladas
- **THEN** la aplicación arranca y la interfaz se representa completa

#### Scenario: Construcción reproducible

- **WHEN** se construyen los recursos de la interfaz desde el repositorio limpio
- **THEN** el procedimiento está documentado y produce el conjunto de archivos que el empaquetado incorpora
- **AND** dos construcciones sucesivas desde el manifiesto fijado producen el mismo conjunto de bibliotecas
