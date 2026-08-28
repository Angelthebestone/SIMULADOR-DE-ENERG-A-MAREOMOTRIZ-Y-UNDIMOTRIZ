## Purpose

Traslada la capa de presentación a un medio que admite tipografía compuesta, animación fluida y control total del aspecto, sin que el núcleo de física se entere del cambio y sin perder el arranque sin conexión ni la entrega como aplicación de escritorio.

## Contexto verificado que este spec debe respetar

Tres hechos del código actual condicionan los requisitos siguientes y se declaran aquí para que ninguna decisión posterior los contradiga:

- `nucleo/resultado.py::to_dict()` **no** incluye el campo `series`, que es donde `nucleo/dispositivos/absorbedor.py` y `owc.py` dejan `t_s` y `z_m`. El diccionario que hoy produce el serializador pierde la serie de animación, y `recurso` viaja con escalares sueltos, sin `unidad`, `fuente` ni `estado`. Todo lo que la presentación deba dibujar y todo lo que deba etiquetarse con el semáforo tiene que viajar por el contrato de forma explícita.
- `interfaz/calculo.py` no es presentación: su propia cabecera declara «Aquí no hay Qt» y contiene `Parametros`, `simular()`, `_matriz_potencia`, `serie_oleaje()` y el registro `DISPOSITIVOS`. Es la capa de servicio y esta migración NO la retira; la reubica antes (ver `arquitectura-y-calidad`).
- La presentación web no dispone de motor de renderizado propio: depende del componente del sistema, que puede no estar instalado y que necesita un directorio de datos escribible.

## ADDED Requirements

### Requirement: Aplicación de escritorio, no sesión de navegador

La interfaz SHALL presentarse en una ventana propia de la aplicación, sin barra de direcciones, sin pestañas y sin controles de navegación del navegador. El usuario NO SHALL necesitar abrir un navegador ni escribir una dirección para usar el simulador.

Cerrar la ventana SHALL terminar la aplicación por completo. Ningún proceso del simulador ni de su capa de servicio SHALL quedar en ejecución. Los procesos subsidiarios del motor de renderizado que la plataforma gestione por su cuenta NO se consideran procesos del simulador, y el procedimiento de verificación SHALL nombrarlos para que el criterio no quede ambiguo.

#### Scenario: Arranque como aplicación

- **WHEN** se ejecuta el paquete distribuido
- **THEN** aparece una ventana de aplicación con el simulador
- **AND** no hay barra de direcciones ni ningún control de navegador visible

#### Scenario: Cierre limpio

- **WHEN** se cierra la ventana de la aplicación
- **THEN** no queda ningún proceso del simulador ni de su capa de servicio en ejecución
- **AND** el verificador distingue los procesos del simulador de los que la plataforma asigna al motor de renderizado

### Requirement: El motor de renderizado se verifica al arrancar

La aplicación SHALL comprobar al arrancar que el motor de renderizado del sistema está disponible y que puede escribir su directorio de datos dentro del espacio de la aplicación. Si alguna de las dos condiciones falla, SHALL informar del motivo y de cómo resolverlo en lugar de abrir una ventana vacía.

La detección y el directorio de datos NO SHALL depender de permisos de administrador.

#### Scenario: Motor ausente

- **WHEN** se ejecuta el paquete en un equipo sin el motor de renderizado del sistema instalado
- **THEN** aparece un mensaje con el motivo, su consecuencia y la forma de resolverlo
- **AND** la aplicación no deja una ventana en blanco ni un proceso colgado

#### Scenario: Directorio de datos no escribible

- **WHEN** el directorio por defecto del motor de renderizado no es escribible con la cuenta en uso
- **THEN** la aplicación lo redirige a un directorio propio y arranca
- **AND** la configuración del motor NO se escribe en ninguna ubicación que exija elevación de privilegios

### Requirement: La interfaz no calcula física

La capa de presentación SHALL limitarse a enviar parámetros, recibir resultados y dibujarlos. NO SHALL reimplementar ninguna fórmula del núcleo ni derivar magnitudes físicas por su cuenta.

Toda magnitud mostrada SHALL proceder del resultado entregado por el núcleo. Los únicos cálculos admitidos en la presentación son los de disposición gráfica: escalas, interpolación entre fotogramas ya calculados y conversión de unidades a formato de visualización.

La prueba automatizada que hace cumplir este requisito SHALL distinguir entre una fórmula **evaluada** en la presentación, que está prohibida, y una fórmula **recibida como dato** para ser representada, que es obligatoria y viaja por el contrato. Sin esa distinción, el requisito de matemática compuesta resulta insatisfacible.

#### Scenario: Ausencia de física evaluada en la presentación

- **WHEN** se revisa el código de la capa de presentación
- **THEN** no aparece ninguna constante física usada en una operación aritmética ni ninguna conversión energética calculada
- **AND** una prueba automatizada falla si aparecen

#### Scenario: Una fórmula recibida por el contrato no viola el requisito

- **WHEN** la presentación recibe una expresión matemática como cadena de datos y la representa
- **THEN** la prueba de ausencia de física pasa
- **AND** la expresión representada es la recibida, no una reescrita en la presentación

### Requirement: Contrato explícito entre presentación y núcleo

La comunicación entre la presentación y la capa de servicio SHALL realizarse por un contrato explícito y serializable que transporte: los parámetros de la simulación, el resultado completo, las series temporales necesarias para animar sin recalcular, las expresiones matemáticas con sus valores sustituidos, la procedencia de cada dato mostrado y los avisos de progreso, error y cancelación.

El contrato SHALL declarar cómo se codifican los arreglos numéricos, que no son serializables en el formato de intercambio por defecto, y SHALL fijar un techo de tamaño por transferencia para el payload de animación.

El contrato SHALL estar documentado y SHALL ser verificable por pruebas de forma independiente de la interfaz. Ampliar el contrato para incluir estos campos es una modificación admitida de `nucleo/resultado.py` y NO habilita ningún cambio en las fórmulas del núcleo.

#### Scenario: Resultado serializable sin pérdida

- **WHEN** se ejecuta una simulación y se serializa su resultado
- **THEN** el transporte incluye las series de animación además de los escalares de resumen
- **AND** ninguna magnitud, unidad, fuente ni estado se pierde en el camino
- **AND** una prueba automatizada compara campo a campo lo emitido y lo recibido

#### Scenario: Arreglos codificados y acotados

- **WHEN** un resultado contiene una matriz o una serie temporal
- **THEN** el contrato declara su codificación, su forma y su tipo
- **AND** el payload de animación no supera el techo declarado
- **AND** la presentación reconstruye el arreglo sin recalcular física

#### Scenario: Contrato probado sin interfaz

- **WHEN** se ejecutan las pruebas del contrato en un entorno sin componente gráfico
- **THEN** todas se completan

#### Scenario: Error transportado, no silenciado

- **WHEN** el núcleo interrumpe un cálculo por una entrada inválida
- **THEN** la presentación recibe el error y muestra su motivo
- **AND** la aplicación sigue operativa

### Requirement: La fórmula mostrada y el número calculado salen del mismo origen

Toda fórmula que la interfaz componga SHALL llegar por el contrato junto con los valores sustituidos dentro de ella y con el resultado que la capa de servicio obtuvo, de modo que símbolo, sustitución y cifra no puedan divergir entre capas.

Escribir en la presentación una expresión matemática cuya aritmética esté calculada en otro lado NO satisface este requisito.

#### Scenario: Expresión, sustitución y resultado viajan juntos

- **WHEN** el nivel Calcular muestra la densidad de potencia
- **THEN** la expresión, los valores sustituidos y el resultado proceden de un mismo registro entregado por la capa de servicio
- **AND** alterar el valor de entrada cambia la sustitución mostrada sin editar la presentación

#### Scenario: Divergencia detectada por prueba

- **WHEN** una expresión recibida deja de corresponder a los valores recibidos con ella
- **THEN** una prueba automatizada falla
- **AND** el mensaje identifica qué de los dos elementos divergió

### Requirement: Todos los recursos de la interfaz incorporados al paquete

Todo recurso que la interfaz necesite para representarse SHALL formar parte de la distribución: tipografías, hojas de estilo, código de presentación, bibliotecas de representación, iconos, imágenes, assets matemáticos y datos cartográficos. Cada biblioteca de tercero que la interfaz incorpore SHALL estar declarada en el manifiesto de construcción de la interfaz y fijada a una versión verificable.

La interfaz NO SHALL solicitar ningún recurso a una dirección remota.

La restricción SHALL imponerse en el arranque mediante una política de origen que declare las únicas fuentes admitidas, y SHALL verificarse además con una prueba. Una garantía de aislamiento que solo se comprueba a posteriori deja sin efecto la posibilidad de que el requisito se cumpla por construcción. La política de origen SHALL admitir explícitamente los mecanismos que el motor de renderizado necesita para operar en local.

#### Scenario: Interfaz completa sin conexión

- **WHEN** se abre la aplicación en un equipo sin conexión
- **THEN** la interfaz se representa completa, con sus tipografías, sus iconos, su matemática compuesta y su cartografía

#### Scenario: Petición remota rechazada por construcción

- **WHEN** la interfaz intenta cargar una hoja de estilo, una tipografía o un script desde una dirección remota
- **THEN** el motor de renderizado la rechaza por política de origen
- **AND** el rechazo se registra como defecto, no como un aspecto degradado silencioso

#### Scenario: Ninguna petición saliente atribuible a la aplicación

- **WHEN** se observa el tráfico de red durante una sesión completa que recorre los cuatro niveles, el mapa y una exportación
- **THEN** no se registra ninguna petición iniciada por la aplicación hacia una dirección remota
- **AND** el procedimiento de observación declara cómo separa el tráfico de la aplicación del tráfico propio del motor de renderizado, de modo que el criterio pueda fallar por defecto ajeno y por exceso propio
- **AND** una prueba automatizada falla si se registra alguna petición de la aplicación

### Requirement: El formato numérico de la presentación se porta y se verifica contra el original

El formato numérico español de la nueva capa de presentación SHALL ser la traslación verificada del módulo de formato del proyecto, y SHALL existir una prueba que enfrente ambos formateadores sobre el mismo conjunto de valores: enteros, decimales, miles, ceros, negativos y el rango completo de magnitudes que la aplicación muestra.

Reimplementar el formateo en la presentación sin prueba de equivalencia NO satisface este requisito: dos formateadores que divergen rompen el invariante de que el cálculo y el almacenamiento usan punto decimal y la pantalla coma.

#### Scenario: Equivalencia de formateadores

- **WHEN** se formatea el mismo valor con el formateador del proyecto y con el de la presentación
- **THEN** ambos producen exactamente la misma cadena
- **AND** la prueba recorre los casos límite declarados

### Requirement: Números sustituidos dentro de una expresión compuesta

Los valores sustituidos dentro de una fórmula matemática compuesta SHALL conservarse legibles con el formato numérico español. La coma decimal de un número NO SHALL adquirir separación por ser puntuación dentro del modo matemático, y el punto de separación de miles NO SHALL leerse como separador decimal.

#### Scenario: Coma decimal dentro de la matemática

- **WHEN** se muestra una fórmula con el valor `8,9` sustituido
- **THEN** la coma aparece pegada a ambas cifras, sin espacio intermedio
- **AND** el valor se lee como ocho con nueve y no como dos números separados por coma

#### Scenario: Miles dentro de la matemática

- **WHEN** se muestra una cifra de miles dentro de una expresión compuesta
- **THEN** el separador de miles no se confunde con el decimal
- **AND** la cifra representa el mismo valor que el resultado entregado por la capa de servicio

### Requirement: Fórmulas presentadas como matemática compuesta

En el nivel Calcular, cada fórmula SHALL representarse con notación matemática compuesta: símbolos griegos propios, fracciones con numerador y denominador dispuestos verticalmente, exponentes y subíndices en su posición, y radicales cuando los haya.

Representar una fórmula como cadena de texto plano NO satisface este requisito.

#### Scenario: Fórmula de densidad de potencia compuesta

- **WHEN** se muestra la fórmula de la densidad de potencia del oleaje en el nivel Calcular
- **THEN** la densidad del agua aparece como símbolo griego, la división aparece como fracción dispuesta verticalmente y los exponentes en posición superior

#### Scenario: Sustitución numérica sobre la fórmula compuesta

- **WHEN** se muestra la misma fórmula con los valores ya sustituidos
- **THEN** los números aparecen en su posición dentro de la estructura matemática
- **AND** conservan el formato numérico español

### Requirement: Animación a partir de la serie ya integrada

La animación del nivel Ver SHALL dibujarse a partir de la serie de superficie libre y de posición del cuerpo ya calculadas por el núcleo, transferidas una sola vez por simulación.

La presentación NO SHALL solicitar al núcleo un valor por fotograma. La animación SHALL mantenerse fluida mientras el usuario interactúa con el resto de la interfaz.

El bucle de animación SHALL ser controlable: SHALL existir un medio visible de detenerlo y reanudarlo, SHALL respetar la preferencia del sistema por movimiento reducido, y SHALL poder declararse detenido sin que el resto de la pantalla pierda el resultado.

Cuando un dispositivo no entregue serie de posición, la animación SHALL declararlo en pantalla en lugar de generar una serie sintética.

#### Scenario: Una transferencia por simulación

- **WHEN** se ejecuta una simulación y se anima el resultado durante varios ciclos
- **THEN** los datos de animación se transfieren una sola vez
- **AND** ningún fotograma provoca comunicación con el núcleo

#### Scenario: Fluidez durante la interacción

- **WHEN** la animación está en curso y el usuario conmuta de nivel o abre el mapa
- **THEN** la animación no se detiene ni salta

#### Scenario: Animación detenida por la persona o por el sistema

- **WHEN** el usuario pulsa el control de pausa, o el sistema declara preferencia por movimiento reducido
- **THEN** el bucle se detiene y la última posición queda visible con sus cifras
- **AND** detener la animación no inhabilita ninguna otra función de la pantalla

### Requirement: Aspecto gobernado desde un único origen

La paleta, la tipografía, los tamaños, las unidades de espacio y el tratamiento de estados SHALL definirse en un único lugar del que dependa toda la interfaz. Cambiar un color o un tamaño en ese origen SHALL propagarse a toda la aplicación sin editar componentes individuales.

El semáforo de confianza SHALL derivar su color de ese mismo origen, de modo que la correspondencia entre estado y color no pueda divergir entre pantallas.

Los subsistemas que la interfaz no gobierna por hoja de estilos —las etiquetas de un mapa representado en lienzo y las figuras compuestas fuera de la presentación— SHALL recibir el valor del origen mediante la llamada de actualización que cada uno ofrezca. El origen único SHALL cubrir los tres mecanismos, no solo el primero.

#### Scenario: Cambio de paleta propagado

- **WHEN** se modifica un color en el origen único de estilo
- **THEN** todas las pantallas que lo emplean reflejan el cambio

#### Scenario: Semáforo coherente entre pantallas

- **WHEN** se compara el color de un dato `inferido` en el nivel Ver, en el mapa y en el nivel Diseñar
- **THEN** es el mismo en los tres

#### Scenario: Etiquetas y figuras siguen el origen

- **WHEN** cambia el tamaño base declarado en el origen único
- **THEN** las etiquetas del mapa y el texto de las figuras se actualizan desde ese mismo valor
- **AND** ningún subsistema conserva un tamaño propio que pueda divergir

### Requirement: Estado y forma viajan juntos en el semáforo

El indicador de confianza SHALL conservar en la nueva capa la redundancia que ya tiene el proyecto: color, símbolo y palabra. Trasladar el semáforo como color de texto, o como un punto de color sin glifo ni etiqueta, NO satisface el requisito de que ningún estado se comunique solo por color.

El canal de color del estado SHALL cumplir el umbral exigible a un objeto gráfico sobre el fondo donde se pinta, y donde el estado se comunique con texto, ese texto SHALL cumplir el umbral exigible a texto normal. Ninguno de los dos umbrales se delega en el otro canal: la redundancia existe para el caso en que uno falle, no para dispensar la medición del otro.

#### Scenario: Semáforo legible sin color

- **WHEN** se muestra un dato `pendiente` y la interfaz se observa en escala de grises
- **THEN** el estado sigue identificándose por su símbolo y su palabra
- **AND** la prueba automatizada exige los tres canales, no solo el atributo de color

#### Scenario: El estado medido, no asumido

- **WHEN** se mide el color del indicador contra el fondo sobre el que renderiza, con la capa de contexto activada donde exista
- **THEN** alcanza el umbral de objeto gráfico
- **AND** la palabra que lo acompaña alcanza el umbral de texto por su cuenta

### Requirement: Composición gobernada por la pregunta de cada nivel

Cada nivel SHALL declarar la pregunta que responde y SHALL componerse de modo que esa pregunta pueda responderse sin desplazarse. Ninguna pantalla SHALL usar el desplazamiento como mecanismo para navegar entre secciones que la persona necesita comparar entre sí.

Las secciones de un mismo nivel SHALL compartir el viewport con el contraste de la tesis y con el selector de emplazamiento, que permanecen accesibles sin empujar el contenido fuera de la vista.

#### Scenario: Cada sección de Diseñar cabe sola

- **WHEN** se abre el nivel Diseñar en una ventana de 1280 × 720
- **THEN** cada una de sus cuatro secciones es visible y operable sin desplazar la anterior
- **AND** cambiar de sección no obliga a recorrer el contenido intermedio

#### Scenario: Comparar criterio, recurso y coste sin scroll

- **WHEN** la persona quiere poner juntos el criterio eliminatorio, el recurso y el coste de un emplazamiento
- **THEN** puede alternar entre ellos sin desplazar una columna continua
- **AND** la cifra que compara sigue visible mientras cambia de sección

### Requirement: Estados de presentación cubiertos

Todo componente que reciba datos del núcleo SHALL implementar y hacer alcanzable cada estado que pueda presentar: reposo, cargando, vacío, con resultado, pendiente, error, deshabilitado y desbordado.

Una pantalla diseñada solo para el caso con resultado NO satisface este requisito.

#### Scenario: Estado vacío con instrucción

- **WHEN** una pantalla se abre antes de cualquier cálculo
- **THEN** declara qué falta, qué lo produce y ofrece la acción
- **AND** no aparece un lienzo en blanco ni una tabla sin filas

#### Scenario: Cargando sin perder la pantalla

- **WHEN** un cálculo está en curso
- **THEN** la pantalla conserva su estructura, indica progreso y ofrece cancelación
- **AND** el resultado anterior sigue visible hasta que llega el nuevo

#### Scenario: Desbordamiento de contenido real

- **WHEN** una cita bibliográfica o un nombre de área protegida excede el ancho de su columna
- **THEN** el contenido completo sigue siendo accesible
- **AND** ninguna cifra aparece cortada a mitad de dígito

### Requirement: Pruebas automatizadas sobre la interfaz real

La interfaz SHALL disponer de pruebas automatizadas que la ejerciten como lo haría una persona: conmutar niveles, mover controles, lanzar y cancelar una simulación, abrir el mapa y conmutar sus capas.

Las pruebas SHALL comprobar los invariantes de presentación: que el semáforo corresponde al estado del dato en las pantallas donde aparece, que un dato pendiente no aparece como cifra de resultado, que el contraste de la tesis permanece accesible en los cuatro niveles, que todo control operable con puntero tiene equivalente de teclado con foco visible, y que los estados de presentación declarados son alcanzables de verdad.

Los defectos de presentación ya registrados contra la capa anterior SHALL trasladarse como criterios de prueba de la nueva, no como memoria del pasado.

#### Scenario: Recorrido completo automatizado

- **WHEN** se ejecuta la suite de pruebas de interfaz
- **THEN** se recorren los cuatro niveles, se lanza y se cancela una simulación y se conmutan las capas del mapa
- **AND** la suite falla si alguna acción no produce el efecto esperado

#### Scenario: Dato pendiente nunca aparece como resultado

- **WHEN** una simulación depende de un dato con estado `pendiente`
- **THEN** la interfaz muestra el bloqueo y su motivo
- **AND** ninguna cifra de resultado aparece en su lugar

#### Scenario: Teclado verificado

- **WHEN** se recorre la aplicación solo con teclado
- **THEN** cada control muestra un indicador visible de dónde está el foco
- **AND** es posible lanzar, cancelar y exportar una simulación sin usar el puntero

#### Scenario: Un criterio conocido no se pierde en el traslado

- **WHEN** la suite nueva deja de comprobar un criterio que la anterior sí comprobaba
- **THEN** el abandono queda declarado y justificado en el plan de trabajo
- **AND** ninguna prueba desaparece sin que el recuento lo registre

## MODIFIED Requirements

### Requirement: Entrega en carpeta con arranque inmediato

El paquete distribuido SHALL arrancar sin descomprimir su contenido en almacenamiento temporal en cada ejecución. Cuando el tamaño del artefacto haga que un único archivo ejecutable comprometa el tiempo de arranque, la distribución SHALL adoptar la forma de carpeta con el ejecutable y sus recursos junto a él.

El paquete SHALL seguir arrancando en un equipo sin intérprete instalado, sin permisos de administrador y sin conexión.

#### Scenario: Arranque sin espera de descompresión

- **WHEN** se ejecuta el paquete distribuido por segunda vez en un equipo limpio
- **THEN** la ventana aparece sin una espera atribuible a la descompresión del artefacto

#### Scenario: Equipo sin intérprete ni administrador

- **WHEN** se ejecuta el paquete en un equipo sin el intérprete instalado y con una cuenta sin permisos de administrador
- **THEN** la aplicación arranca y el emplazamiento por defecto se carga con sus datos
