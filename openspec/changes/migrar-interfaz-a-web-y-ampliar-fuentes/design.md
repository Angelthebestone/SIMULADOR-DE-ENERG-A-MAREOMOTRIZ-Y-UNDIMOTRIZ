## Context

Ver `proposal.md` — Why para la motivación.

Tres hechos del código actual determinan el coste real de esta migración y conviene tenerlos delante:

- `app/trabajo.py` implementa el trabajo asíncrono con `threading.Thread` y tres callbacks (`on_progreso`, `on_resultado`, `on_error`). No importa Qt. El contrato con la presentación ya es agnóstico.
- `Resultado.to_dict()` ya existe en `nucleo/resultado.py`, pero **no serializa el campo `series`**, que es donde `absorbedor.py` y `owc.py` dejan `t_s` y `z_m`; y `recurso` viaja como escalares sueltos, sin `unidad`, `fuente` ni `estado`. El serializador está escrito a medias para lo que esta migración necesita: la D4 transfiere justo lo que la D3 pierde, y los arreglos numéricos no son serializables sin codificación explícita.
- `app/animacion.py` devuelve la superficie libre como matriz precalculada, con la nota explícita «muestra serie ya calculada, no recalcula por fotograma». La animación no necesita comunicación por fotograma.

Y dos correcciones a lo que este documento daba por cierto:

- El acoplamiento a Qt **no** está confinado a `interfaz/` en el sentido de que todo lo que hay en `interfaz/` sea presentación. De sus 2.652 líneas, 348 son `calculo.py`: la cabecera del archivo declara «Aquí no hay Qt» y contiene `Parametros`, `simular()`, `_matriz_potencia`, `serie_oleaje()` y el registro `DISPOSITIVOS`. Es la capa de servicio y hay que reubicarla antes de retirar nada (D12).
- El recuento de pruebas no es «61 de interfaz y ~89 intactas». Son 160 casos en nueve suites: 61 de interfaz, **49 casos de tres suites que ya importan `interfaz/`** (`test_stress_core`, `test_stress_datos`, `test_stress_rendimiento`) y 50 que sí son independientes. Dos de esas tres condicionan su ejecución a que PySide6 esté instalado, de modo que al retirar la dependencia se saltan en silencio y la casilla de no regresión queda vacía.

Restricciones que gobiernan todas las decisiones siguientes: arranque sin conexión, entrega ejecutable sin intérprete instalado y sin permisos de administrador, y demostración en vivo sobre proyector.

## Goals / Non-Goals

**Goals:**

- Sustituir el medio de presentación conservando intacta la física del núcleo y el veredicto de sus pruebas. El contrato **no** se conserva intacto: se extiende, porque el actual no transporta las series que hay que animar ni la procedencia que hay que etiquetar.
- Cerrar los huecos de datos registrados que dependen de fuentes accesibles: corriente por emplazamiento y un tercer valor de densidad de potencia para Isla Fuerte.
- Que la física escrita a mano quede respaldada por coincidencia demostrada con implementaciones de referencia, sin delegar el cálculo en ellas.
- Que la migración sea reversible en cada fase: en ningún momento debe existir un estado sin aplicación funcionando, y lo que se retire tiene que estar en el historial antes de poder retirarse.

**Non-Goals:**

- Optimizar el rendimiento del núcleo. Los tiempos actuales son aceptables y no motivan este cambio.
- Añadir dispositivos, emplazamientos o familias nuevas. El alcance de simulación es el mismo antes y después.
- Internacionalizar la interfaz. Sigue siendo en español.
- Sustituir matplotlib en la generación de figuras del informe. Ahí se queda, y mejora con una capa estética encima.

## Decisions

### D1. La frontera del cambio de lenguaje cae en la presentación, no en el núcleo

Se descarta reescribir la física en otro lenguaje.

*Alternativas consideradas:* reescritura completa en TypeScript; reescritura en Rust con la presentación en el mismo binario.

*Motivo:* `utide` resuelve el análisis armónico de constituyentes de marea y se usa efectivamente en `nucleo/mareas.py`; no tiene equivalente en el ecosistema JavaScript. SciPy resuelve la dispersión y la integración del movimiento. Reimplementar ambos es trabajo de investigación, no de interfaz, e invalidaría de golpe las pruebas de física que hoy pasan. El beneficio buscado —control total del aspecto— se obtiene íntegro cambiando solo la capa de presentación.

Lo que esta decisión **no** afirma: que la capa de presentación ocupe el directorio `interfaz/`. Una de sus siete líneas de negocio está ahí dentro y hay que sacarla antes de poder hablar de retirada (D12). La frontera correcta es «código que importa una biblioteca gráfica» frente a «código que no», no el nombre del directorio.

### D2. Carcasa nativa con motor web del sistema, y la decisión es reversible

La ventana la abre un envoltorio que delega el renderizado en el componente web que Windows 11 ya trae instalado.

*Alternativas consideradas:* envoltorio con motor propio empaquetado; carcasa en otro lenguaje con el núcleo como proceso auxiliar; servidor local abierto en el navegador del usuario.

*Motivo:* mantener un solo proceso y un solo artefacto preserva la entrega empaquetada sin complicarla con procesos auxiliares. No empaquetar un motor de renderizado mantiene el artefacto pequeño en su parte de código. Y la opción del navegador queda descartada por el requisito de aplicación sin barra de direcciones: en una sustentación, una dirección local a la vista deshace el trabajo de presentación.

Lo importante para el riesgo del proyecto: **el código de presentación es idéntico en las tres primeras alternativas**. La elección de carcasa es reversible sin tocar la interfaz, así que no conviene sobreanalizarla.

### D3. Contrato de mensajes derivado del que ya existe

El contrato entre presentación y núcleo transporta los parámetros de simulación como escalares, el resultado como el diccionario que `Resultado.to_dict()` ya produce, y los avisos de progreso, error y cancelación que `app/trabajo.py` ya emite.

*Alternativas consideradas:* diseñar una API nueva; exponer el núcleo como servicio HTTP local.

*Motivo:* el contrato ya está escrito, solo que hoy lo consumen señales Qt. Reutilizarlo evita una capa de traducción y mantiene verificables sin interfaz las pruebas del contrato. Un servicio HTTP local añadiría un puerto, un modo de fallo y una superficie de red que el requisito de ejecución sin red no quiere.

*Lo que hay que añadir, porque reutilizar no es copiar:* el diccionario actual no sirve tal cual. `to_dict()` omite `series`, de modo que la animación de la D4 no tendría qué transportar; `recurso` no lleva `unidad`, `fuente` ni `estado`, de modo que el semáforo no podría derivarse del resultado; y la matriz de potencia viaja como `numpy.ndarray`, que no es serializable. El contrato se define como un esquema explícito con esas cuatro incorporaciones y con la codificación de arreglos declarada. Esto modifica `nucleo/resultado.py` en su parte de serialización, y ninguna en sus fórmulas.

### D4. La animación se transfiere una vez y se dibuja en la presentación

La matriz de superficie libre y la serie de posición del cuerpo cruzan la frontera una sola vez por simulación. El bucle de animación vive en la presentación.

*Alternativas consideradas:* transmitir un valor por fotograma desde el núcleo.

*Motivo:* `app/animacion.py` ya precalcula. Transferir por fotograma introduciría latencia y acoplamiento sin ganar nada. Esta decisión es además lo que permite que la regla de que la animación se mueve con el modelo real siga cumpliéndose: el número de onda sigue saliendo del solucionador y la posición de integrar la ecuación de movimiento; solo cambia quién la dibuja.

### D5. Mapa por capas apiladas: base vectorial más rásteres congelados

La cartografía base es vectorial y local; las capas de contexto son imágenes georreferenciadas exportadas en la fase de ingesta.

*Alternativas consideradas:* solo rásteres, sin base vectorial; solo base vectorial, sin imagen satelital.

*Motivo:* la base vectorial da rótulos nítidos a cualquier zoom y estilo controlable; los rásteres dan la batimetría sombreada y la imagen real, que es lo que hoy falta. Cada una sola resuelve la mitad. Como el usuario ha decidido que el tamaño del artefacto no es una restricción, se toman las dos.

*Consecuencia asumida:* el artefacto crece de forma apreciable. Ver D6.

*Matiz que la decisión anterior no contemplaba:* los rásteres no pueden congelarse como una imagen georreferenciada plana. La composición satelital a resolución nativa sobre el recuadro del Caribe colombiano es un producto de decenas de gigapíxeles, y un motor de mapas no lo sirve sin pirámide. La decisión de que el tamaño no es una restricción elimina el freno económico, pero no el técnico: el producto de ingesta son mosaicos con niveles declarados, y el nivel máximo de acercamiento de cada capa ráster es el que su resolución soporta, no el que la base vectorial permite. Esto desdobla la pregunta abierta sobre el zoom en dos respuestas distintas, según la familia de capa.

### D6. Distribución en carpeta, no en archivo único

*Alternativas consideradas:* archivo único autoextraíble.

*Motivo:* con un artefacto grande, el archivo único descomprime a almacenamiento temporal en cada arranque. El escenario que más importa es abrir la aplicación delante de un tribunal; una espera de descompresión ahí es el peor momento posible. La carpeta arranca inmediatamente y sigue sin exigir permisos de administrador.

### D7. Las bibliotecas de referencia validan, no calculan

MHKiT y wavespectra entran como dependencias de desarrollo y se usan en `pruebas/` como oráculos contra los que comparar las fórmulas propias.

*Alternativas consideradas:* sustituir `nucleo/espectros.py` por wavespectra y `analisis/captura.py` por MHKiT.

*Motivo:* es un simulador educativo donde las fórmulas visibles y legibles son el producto; el nivel Calcular existe para mostrarlas. Delegarlas vaciaría ese nivel. Como oráculos, en cambio, aportan una afirmación más fuerte que la sustitución: no «uso una biblioteca que dice cumplir la norma» sino «mi implementación coincide con la de referencia dentro de la tolerancia declarada». Además el núcleo se mantiene sin dependencias pesadas, lo que protege el tamaño del artefacto y el arranque sin red.

### D8. Dos motores de gráficas como máximo dentro de la aplicación

Las gráficas analíticas de los niveles Calcular y Diseñar se componen en Python y se representan de forma interactiva en la presentación. El diagrama de pérdidas y la animación usan el segundo motor y dibujo directo.

*Alternativas consideradas:* un único motor para todo; tres motores especializados.

*Motivo:* componer en Python las gráficas analíticas permite tener la aplicación entera funcionando antes de dominar el ecosistema de gráficas del nuevo lenguaje, lo que hace la fase 2 demostrable desde pronto. Pero el diagrama de pérdidas es la imagen que se recuerda del proyecto y ahí sí se quiere control total, que un motor con estética propia no da. Tres motores serían coste de mantenimiento sin retorno: si una serie va lenta, primero se mide.

### D9. InVEST se usa una vez y fuera del simulador

*Motivo:* es un modelo completo, no una biblioteca de apoyo: recorre el mismo trayecto de recurso a valoración económica con otra metodología y otro origen institucional. Su valor es servir de contraste documentado a la producción anual y al coste por MWh, no formar parte de la ejecución.

### D10. DTOcean se cita, no se instala

*Motivo:* su alcance es diseño de parques —disposición, cableado, amarres, instalación, operación— frente a un simulador de un único convertidor. Además es Python 2.7 sobre distribución conda y solo Windows, y su sucesor está bajo licencia AGPL, incompatible con el MIT del proyecto. Su descomposición en módulos sí sirve como validación externa de que la cadena de eslabones está bien planteada, y como tal se referencia en la documentación.

### D11. Orden de fases: física, datos, interfaz

La fase 0 blinda el núcleo con oráculos antes de que empiece a moverse nada a su alrededor. La fase 1 congela los datos nuevos, y es independiente: la aplicación actual puede consumirlos sin cambios. La fase 2 depende de la 1 para el mapa.

*Alternativas consideradas:* empezar por la interfaz, que es lo más visible.

*Motivo:* si la interfaz se reescribe primero y aparece una divergencia numérica, no habrá forma barata de saber si vino del núcleo o de la presentación. Con los oráculos puestos antes, cualquier divergencia posterior queda acotada a la capa nueva.

### D12. La capa de servicio sale de `interfaz/` antes de que `interfaz/` salga del proyecto

`interfaz/calculo.py` no es presentación y no se retira: se reubica en la capa de servicio, se actualizan sus importadores y las tres suites de física y datos que hoy lo consumen desde ahí pasan a consumirlo desde su sitio nuevo.

*Alternativas consideradas:* dejarlo donde está y retirar el resto del directorio archivo por archivo; duplicar la firma en la capa nueva; reescribir la orquestación en TypeScript.

*Motivo:* la primera alternativa funciona pero deja el directorio retirado con un nombre dentro que no describe lo que hay, que es exactamente el estado que produjo este error de planificación. La segunda rompe el invariante de un único motor de cálculo. La tercera contradice la D1. Reubicar cuesta una tarea de mover y renombrar; no hacerlo cuesta la aplicación.

Consecuencia sobre el plan: esto abre una fase 0.5 entre los oráculos y la ingesta, porque el oráculo de la matriz de potencia (tarea 3.2) apunta a `interfaz/calculo.py::_matriz_potencia` y no puede anclarse a una ruta que una fase posterior mueve.

### D13. El aislamiento de red se impone con política de origen y se verifica por separado

Además de la prueba que observa el tráfico, la interfaz declara una política de origen que solo admite recursos locales, con las excepciones que el motor de renderizado necesita para funcionar en local.

*Motivo:* la prueba de tráfico es necesaria pero no suficiente, y además no es limpia: el componente web del sistema emite tráfico propio, telemetría y comprobaciones incluidas, aunque la aplicación no pida nada. Sin una definición de qué tráfico es atribuible a la aplicación, el requisito «cero peticiones salientes» puede fallar por algo que la aplicación no hizo, o aprobarse habiendo cargado una tipografía remota tres sesiones antes. La política convierte el requisito en una propiedad estructural y deja la prueba para lo que la política no cubre: peticiones de datos.

### D14. El escalado del modo sustentación es un factor, no una hoja de estilos más grande

Un único número declarado se propaga a los tres subsistemas por el mecanismo que cada uno tenga: la raíz del documento, la propiedad de tamaño de texto del estilo del mapa, y el re-layout de las figuras compuestas fuera de la presentación.

*Motivo:* pedir «escalado proporcional de toda la interfaz» y conseguirlo cambiando el `font-size` base es la forma exacta en que este modo se rompió en la capa anterior y volvería a romperse en la nueva. Las etiquetas de un mapa dibujado en lienzo no heredan del documento, y las figuras compuestas en Python llevan tamaños fijados en el momento de componerse. Sin un mecanismo por subsistema, el requisito se cumple en la mitad que ya se veía bien antes.

### D15. La disponibilidad del motor de renderizado es un modo de fallo del arranque

La aplicación comprueba al arrancar que el componente esté presente y que pueda escribir su directorio de datos en el espacio de la aplicación, y si no, informa en lugar de abrir una ventana vacía.

*Motivo:* la D2 se apoya en que el sistema ya trae ese componente instalado. En un equipo de una universidad o de un tribunal, «ya viene» es una hipótesis sobre una máquina concreta, y el escenario de fallo —ventana en blanco delante de un jurado— es el peor del proyecto. El directorio de datos del componente además se escribe: con una cuenta sin permisos sobre la carpeta del programa, el arranque no puede fallar por eso.

### D16. El manifiesto de la interfaz es previo a cualquier tarea de la fase 2

Existe `package.json` con versiones fijadas y bloqueadas antes de escribir el primer componente, y las bibliotecas de representación se vendorizan.

*Motivo:* MapLibre, KaTeX, Plotly.js y ECharts aparecen nombrados en la propuesta y en ninguna parte declarados. Son cuatro dependencias que tienen que llegar al artefacto sin conexión, y descubrirlo al final de la fase 2 significa volver a hacer el empaquetado.

## Propuesta de diseño de la capa de presentación

### Registro y premisa

Registro **producto**: la interfaz es un instrumento que alguien abre para responder si un sitio sirve. No hay landing, ni hero decorativo, ni descubrimiento guiado. La persona que la usa en la sustentación ya sabe qué quiere enseñar; lo que necesita es que la pantalla no le estorbe y que un visitante entienda el argumento sin que se lo cuenten.

La premisa de composición es que **los cuatro niveles no comparten layout, comparten contrato**. Cada verbo es un patrón de trabajo distinto y la pantalla debe cambiar de premisa al conmutar:

| Nivel | Verbo | Patrón | Premisa compositiva |
|---|---|---|---|
| Ver | observar | **Operate** | lienzo dominante + tres mandos + una cifra grande |
| Comparar | juzgar | **Compare** | columnas alineadas, eslabón por eslabón, nada que se pueda mover |
| Calcular | leer | **Learn** | una sola columna de 66 caracteres, derivación paso a paso |
| Diseñar | decidir | **Decide** | rail de cuatro anclas, una sección por viewport, veredicto fijo abajo |
| Mapa | recorrer | **Explore** | lienzo a sangrado completo, leyenda flotante, lista de sitios como gemelo accesible |

Un único `QStackedWidget` reutilizado cuatro veces era la solución en Qt. En el medio nuevo eso sería desperdiciar el medio: la razón de migrar es poder componer distinto por pregunta.

Lo que **no** se hace: tarjetas iguales en rejilla, héroe centrado, pastillas de color repartidas. Esas tres formas son la respuesta por defecto a «app de datos» y aquí no responden a nada.

### El objeto que prueba la tesis

El proyecto entero cuelga de un número comparado con otro. Hoy se cuentan en una frase de texto. El objeto de prueba debe ser la comparación, no la frase.

Se propone una **escala de densidad** persistente bajo la barra de niveles: un eje horizontal de 0 a 50 kW/m con las ocho densidades de referencia del proyecto marcadas como graduaciones con su nombre, la posición de Isla Fuerte como marca activa y el umbral de rentabilidad como referencia mayor. Datos ya existentes, en `app/tesis.py::DENSIDADES`: 2,0 mínimo aprovechable · 1,96 y 8,9 de Isla Fuerte · 11,0 Caribe · 15,0 criterio del Handbook · 40,0 umbral · 50,0 costa oeste de Europa.

Lo que esa escala hace visible sin palabras: que el sitio propio queda a la izquierda del criterio de buena ubicación y muy a la izquierda del umbral, y que la distancia entre el 8,9 verificado y el 1,96 inferido es mayor que la que separa el 1,96 del cero. Las dos marcas de Isla Fuerte en el mismo eje **son** la discrepancia, dibujada. Y cuando la fase 1 traiga el tercer valor, entra como una tercera marca en el mismo eje, que es donde tenía que estar.

La escala vive en el borde superior porque tiene que sobrevivir a los cuatro niveles (requisito existente) y porque en el nivel Ver compite con la animación por la atención: un eje de 56 px no le gana un lienzo, y no debe.

### Color

La paleta actual es el activo más elogiado del proyecto y conviene tratarla con respeto, pero hay que medirla antes de portarla. Medida con WCAG 2 sobre el fondo `#F2F2EF` y el panel `#FFFFFF`, y con luminancia OKLCH:

**Hallazgo 1: dos vocabularios distintos comparten los tres colores.** En `interfaz/estilo.py`, `PTO` y `COLOR_SEMAFORO["inferido"]` son ambos `#C07A00`; `ELECTRICO` y `verificado`, ambos `#0A8F6A`; `ACENTO` y `pendiente`, ambos `#C94E1A`. No es una coincidencia de familia, es el mismo valor literal. En una tabla donde quepa una fila de eslabón junto a una cifra con estado, un punto ámbar significa «paso de toma de fuerza» y «dato sin verificar» a la vez. Con el mapa ganando satélite y batimetría debajo, esa ambigüedad se multiplica.

**Hallazgo 2: el semáforo, usado como texto, no alcanza el mínimo.** `semaforo_html()` pinta la palabra del estado con su color: verificado 3,64:1, inferido 3,11:1, pendiente 4,08:1 sobre el fondo. Los tres quedan por debajo de 4,5:1 para texto normal. El contraste del estado se está contando con el canal menos fiable.

**Hallazgo 3: en escala de grises los estados colapsan.** Luminancias OKLCH 0,578 / 0,638 / 0,582: la separación mínima entre dos estados es 0,004. Verificado y pendiente tienen la misma luminancia, de modo que el triple canal del que el proyecto está orgulloso descansa hoy en el símbolo y la palabra, no en el color. Bien; entonces que el color haga lo que sí puede hacer.

**Hallazgo 4: `captura` no pasa ni como grafismo.** `#56B4E9` da 2,06:1 sobre el fondo, por debajo del 3:1 exigible a un objeto gráfico. Es el color de un eslabón del diagrama de pérdidas, que es la imagen que se recuerda del proyecto.

**Propuesta: separar los vocabularíos por canal, no por matiz.** Los roles de la cadena siguen llevando color, porque en el Sankey ya están ordenados espacialmente y el color es redundante con la posición. El estado **deja de ir en color de texto**: va en glifo con forma (`●` lleno, `◐` medio, `○` hueco) sobre tinta, que es lo que ya distingue al estado de un simple número, más una palabra en el color de la tinta. El color del estado se conserva solo donde aporta —el anillo del símbolo y la capa del mapa—, y en una escala luminosa separada:

```css
:root {
  /* Estado: forma y palabra mandan; el color es un refuerzo en escala separada */
  --conf-verificado: oklch(0.578 0.117 166);  /* #0A8F6A */
  --conf-inferido:   oklch(0.638 0.138 070);  /* #C07A00 */
  --conf-pendiente:  oklch(0.494 0.159 037);  /* #A8340A, antes #C94E1A */
  --conf-texto: var(--tinta);                 /* la palabra, no el estado, en 14,7:1 */

  /* Roles de cadena: mismos valores, canal distinto */
  --rol-recurso:   oklch(0.532 0.131 244);    /* #0072B2 */
  --rol-captura:   oklch(0.600 0.130 245);    /* #2E86C8, oscurecido: el claro no pasa 3:1 */
  --rol-pto:       oklch(0.638 0.138 070);
  --rol-electrico: oklch(0.578 0.117 166);
  --rol-perdida:   oklch(0.596 0.133 350);    /* grafismo; en texto, #9C4373 */

  /* Neutros teñidos al azul del recurso, nunca grises puros */
  --lienzo: oklch(0.960 0.004 106);
  --panel:  oklch(0.988 0.003 106);
  --tinta:  oklch(0.238 0.017 238);
  --tenue:  oklch(0.495 0.017 245);           /* 5,46:1: sí sirve para metadato */
  --borde:  oklch(0.781 0.008 107);

  --foco: oklch(0.532 0.131 244);
  --escala: 1;                                /* factor del modo sustentación */
}
```

Con `pendiente` oscurecido a `#A8340A`, la menor separación de luminancias entre dos estados pasa de 0,004 a 0,060 y los tres quedan por encima de 3:1 sobre el fondo; y como la palabra ya no va en el color del estado, el umbral de 4,5:1 para texto deja de depender de él. Separar más aún obligaría a clarear `inferido`, y a 0,78 de luminancia `#F0A81E` ya no pasa de 1,81:1: el margen está agotado por arriba y por abajo, y ésa es la razón de que la separación buena sea la del glifo, no la del pigmento.

Tres reglas de uso, no de gusto:

1. **El acento no se reparte.** La familia del estado pendiente es escasez: error, bloqueo y pendiente. Si ocupa más del 10 % de la superficie, un dato sin verificar deja de verse como un aviso y pasa a ser decoración naranja.
2. **Nada viaja solo en color.** En el mapa, cada categoría de decisión añade trama: áreas protegidas con rayado cerrado, recurso con el glifo del estado, batimetría con isolínea etiquetada. En el diagrama de pérdidas, cada eslabón se nombra dentro de su propio bloque y no solo en la leyenda.
3. **El color de rol no se usa para estado ni al revés.** Es la corrección del hallazgo 1, y es la razón de separar los vocabularíos por canal en lugar de buscar seis matices distintos.

*Pendiente de medir:* los valores de arriba están comprobados con la fórmula WCAG 2 sobre fondo y panel, no con APCA ni con simulador de deficiencia cromática sobre el render real. La tarea de verificación debe producir ambos números y, si algún par no alcanza Lc 60 en texto no corporal o Lc 30 en grafismo, mover `L` conservando `C` y `H`.

### Tipografía

Una sola familia para la interfaz: la pila del sistema (`Segoe UI Variable`, `Segoe UI`, `system-ui`). Es la decisión correcta en registro de producto y es lo que ya usa el proyecto. No hay segunda familia de marca: este programa no necesita parecer nada.

La escala, con pasos que sí se distinguen al entrecerrar los ojos —el informe de revisión detectó dos tamaños para todo, y con la migración eso no se arregla solo—:

| Rol | Tamaño | Uso |
|---|---:|---|
| `meta` | 12 px | procedencia, unidad de fuente, pies de figura |
| `cuerpo` | 15 px | tablas, etiquetas, párrafo didáctico |
| `sección` | 20 px | título de sección dentro de un nivel |
| `nivel` | 27 px | nombre del nivel activo |
| `cifra` | 36 px | la cifra que responde la pregunta del nivel |

Dos detalles que en esta interfaz no son cosméticos:

- **Cifras tabulares en todo número.** `font-variant-numeric: tabular-nums`. Se aplican a la pila de cifras de la matriz de potencia, al LCOE que cambia con dos decimales mientras se arrastra un control, y a la columna «Valor» de las tablas de constantes. Sin tabulares, cada recálculo hace saltar la retícula.
- **La coma decimal dentro de la matemática compuesta es un caso de diseño, no de maquetación.** El modo matemático trata la coma como puntuación y le añade separación: `8,9` sale con un hueco, y el punto de miles queda indistinguido de un decimal. Cada valor sustituido viaja envuelto (`\text{8,9}`), y la prueba de la tarea 20.6 tiene que comparar contra la cifra renderizada, no contra la cadena de entrada.

Medida: 66 caracteres en la columna de Calcular, 74 en los párrafos didácticos de Ver. Las tablas se salen de la medida; no son lectura corrida.

### Espacio y retícula

Base de 4 px con ritmo 1·4·9: 4 para respiraciones internas, 16 para relación entre componentes, 36 y 52 para cortes de sección. La regla estructural que decide cuándo hace falta una línea: el hueco entre grupos es al menos el doble que el hueco dentro del grupo. Con esa regla, la mayoría de los `QGroupBox` de hoy pasan a ser separación y un título, sin caja: seis cajas anidadas por pantalla es la señal de que nadie decidió qué va junto.

Retícula estricta de doce columnas para Comparar y Diseñar —es una superficie técnica y la retícula le da autoridad—, y una columna centrada de 66 caracteres para Calcular, que es lectura. La misma retícula en los cuatro niveles sería la trampa: Calcular no es un dashboard.

Anchos mínimos probables: el selector de emplazamiento no baja de 160 px (hoy se comprime a 1024); las citas bibliográficas de atribución son el contenido más largo del proyecto y definen el ancho mínimo de la columna de procedencia.

### Estados

Hoy el proyecto tiene dos estados buenos —`pendiente` y `vacío`— con texto y forma propios, y el resto de la superficie está pensada solo para «hay resultado». La matriz que se propone, por familia de componente:

| Familia | reposo | cargando | vacío | resultado | pendiente | error | deshabilitado | desbordado |
|---|---|---|---|---|---|---|---|---|
| Cifra (`cifra`) | guion y pista | esqueleto de su ancho | — | valor tabular + semáforo + fuente | círculo y motivo, sin número | valor anterior + motivo | valor en gris con motivo | — |
| Lienzo de animación | ilustración con etiqueta del control | aviso de integración en curso | — | onda + cuerpo + cifra | «sin serie de posición» con el nombre del dispositivo | último fotograma + motivo | pausa visible | — |
| Sankey y figuras | — | barras al ancho final, sin datos | — | cadena con eslabones nombrados | eslabón rayado, sin porcentaje | — | — | etiqueta externa |
| Tabla | — | tres filas de esqueleto | «mueve un control» | filas alineadas | celda con símbolo y palabra | fila del invariante roto | — | columna truncada con tooltip completo |
| Mapa | encuadre nacional | mosaicos que entran por nivel | capa sin dato declarada en la leyenda | seis capas conmutables | emplazamiento con `○` y su motivo | mosaico ausente declarado | capa bloqueada con motivo | etiqueta cedida a un segundo plano |

Tres reglas sobre la tabla:

- **Un dato pendiente se dibuja como ausencia con forma, no como cero.** Hoy `0,0` con estado `pendiente` convive con ceros medidos en los archivos de sitio, nueve casos entre cinco emplazamientos. La pantalla no puede repetir esa ambigüedad.
- **El error conserva el último resultado válido.** El cálculo es caro: perder la matriz de potencia por un fallo en economía es un defecto, no una consecuencia.
- **Ninguna cifra de resultado aparece donde debería estar un bloqueo.** Es el invariante que la suite nueva tiene que poder comprobar por sí sola.

### Movimiento

Registro producto: el movimiento explica un cambio de estado, no da la bienvenida.

- Conmutar nivel: el contenido entra con desplazamiento de 8 px y fundido, 160 ms, curva de desaceleración marcada. La barra de niveles no se mueve; lo que cambia es lo que se compara con lo anterior.
- Recálculo: los números tabulados interpogan su valor en 120 ms. El resto de la pantalla no pestañea.
- Diagrama de pérdidas: los eslabones entran en cascada, 20 ms por posición de la cadena, porque el orden de la cascada **es** el orden de la conversión. Un fundido simultáneo perdería esa información.
- `flyTo` del mapa: 600 ms; con `prefers-reduced-motion` se salta sin interpolar.
- Bucles: ninguno en la interfaz salvo el que el usuario pidió. La animación de la onda es un bucle con control de pausa y su arranque respeta la preferencia del sistema.

Duraciones de salida al 70 % de las de entrada. Todo sobre `transform` y `opacity`; el reflow de una tabla de 15 filas del catálogo no se anima.

### Teclado y accesibilidad

- Los cuatro niveles son un conjunto de pestañas real: **un** punto de tabulación, flechas para moverse, `Home`/`End` a los extremos, `aria-controls` al panel.
- Cambiar de nivel lanza el foco al `h1` del nivel nuevo y actualiza el título del documento. Sin eso, una navegación cliente no le dice a nadie que cambió de pantalla.
- La lista de emplazamientos y el recorrido del mapa comparten selección y comparten anuncio: moverse por la lista mueve la vista del mapa; pulsar en el mapa mueve la lista. El mapa en lienzo no tiene elementos enfocables y no se finge que los tiene.
- Foco con `:focus-visible`, 2 px con desplazamiento, color `--foco` verificado contra los fondos que cruza. Nunca se borra el anillo del navegador sin sustitución medida.
- Objetivos: 44 px en la fila de mandos, `::before` para ampliar los indicadores de capa sin agrandar su glifo.
- Progreso de cálculo: una sola región `role="status"`, actualizada en hitos (5 %, 10 %, fin), no por fotograma. Anunciar 25 veces por segundo es peor que no anunciar.
- El modo offline se anuncia; no bloquea nada y no es un diálogo.

### Voz

Una regla que arregla la oscilación que el informe de revisión señaló: el nombre técnico y su traducción **nunca comparten frase, comparten bloque**. Encabezado en lenguaje corriente, término entre paréntesis en `meta` y tenue, cifra debajo. Así `Hm0` nunca aparece suelto en Ver ni `cota de Falnes` disfrazado de coloquial en Diseñar.

Dos cosas que hay que arreglar del diccionario existente antes de portar la pantalla: siete términos traducen a solo cinco frases, con `J` y `densidad_potencia` cayendo en la misma frase, y faltan los términos que más se repiten en Calcular y Diseñar —PTO, Cp, límite de Betz, cota de Falnes, LCOE, factor de recuperación, periodo natural, `kh`, `λ/2π`, resonancia—. Un vocabulario con colisiones enseña dos nombres para la misma cosa.

Sin signos de exclamación, sin mayúsculas en títulos, verbales los botones («Exportar escenario», no «Aceptar»), y los errores con la recuperación en el mismo enunciado.

### Empaquetado del aspecto

Todos los valores anteriores viven en un único archivo de tokens, y el modo sustentación es **un cambio en ese archivo**, no una hoja aparte:

```css
[data-sustentacion] { --escala: 2.1; }   /* derivado de la sala, ver abajo */
```

El factor por defecto sale de la distancia, no de la costumbre. Con una proyección de 1,80 m de ancho a 1920 px (0,94 mm por píxel) y un fondo de sala a 4 m, una altura de letra de distancia/250 pide unos 16 mm, es decir 22 px de altura de glifo: unos 32 px de cuerpo. Sobre el cuerpo base de 15 px eso es un factor de 2,1, no el 1,45 heredado de la capa Qt, que a esa distancia deja el texto corporal por debajo de lo legible.

Consecuencia admitida y escrita en el spec: a ese factor la pantalla no aguanta su densidad, así que el modo sustentación **recompone** en lugar de solo agrandar. Cada nivel declara qué conserva y qué retira. En Ver se queda la onda, los tres mandos y la cifra; salen los dos lienzos didácticos secundarios. En Diseñar se ve una sección y su veredicto. En Calcular, una fórmula por viewport. En el mapa, el encuadre del sitio activo con su leyenda. Lo retirado se anuncia como retirado, que es lo que distingue recomponer de amputar.

Y el factor llega a los tres subsistemas por su propio mecanismo: la raíz del documento, `text-size` del estilo del mapa, y re-layout de las figuras compuestas en la capa de servicio. Un único número con tres caminos, que es la razón de que el origen sea uno.

### Lo que esta propuesta no resuelve todavía

- La paleta está medida con la fórmula de contraste de WCAG 2 sobre fondo y panel, no con APCA ni con simulación de deficiencia cromática sobre el render. Falta la segunda medición, y la separación de luminancias del semáforo puede pedir otro ajuste al ver los tres estados sobre satélite real.
- Oscurecer `pendiente` de `#C94E1A` a `#A8340A` separa los estados en gris, pero acerca el color de bloqueo al de la pérdida en el diagrama. Si al montar el Sankey resultan confundibles, la salida no es un cuarto rojo: es que la pérdida ya se distingue por su posición en la cadena y puede bajar de croma.
- El factor de sustentación depende de una sala que no está medida. El 2,1 sale de un ancho de proyección supuesto; con la sala real delante hay que recalcularlo, y si el fondo de sala es mayor, el modo recompone más de lo previsto.
- El contraste de las capas de decisión sobre la imagen satelital no puede decidirse antes de la fase 1: no hay todavía un Sentinel-2 recortado que mirar. La tarea 19.4 es la primera que puede decir si la trama propuesta basta.
- La escala de densidad como objeto de prueba está propuesta sobre los datos que ya existen, pero su lectura depende de cuántas de las ocho referencias se muestren a la vez. Ocho marcas con nombre en 56 px de alto no caben; hace falta decidir cuál se ve siempre y cuál al pasar, y eso es una decisión editorial sobre la tesis, no de layout.
- Retirar el color de la palabra del estado cambia un hábito del proyecto, no solo un valor CSS: las capturas de la capa Qt que ya estén usadas en el informe mostrarán un semáforo distinto al de la aplicación nueva. Hay que decidir cuál de las dos aparece en el documento escrito.

## Risks / Trade-offs

**Un recurso servido desde una dirección remota rompe el arranque sin conexión** → Se impone por construcción con la política de origen de la D13 y se verifica con una prueba que observa el tráfico saliente durante una sesión completa. Es el modo de fallo más probable y el más silencioso: en desarrollo, con conexión, no se nota.

**El tráfico del motor de renderizado puede hacer fallar la prueba de aislamiento** → Consecuencia de no controlar el componente. Se mitiga definiendo en el spec qué tráfico es atribuible a la aplicación y separándolo del de la plataforma en el procedimiento de verificación.

**El artefacto crece y complica el transporte al equipo de la demostración** → Consecuencia asumida de D5, decidida por el usuario. Se mitiga con D6 (carpeta, arranque inmediato) y con transporte físico en vez de por correo. El producto ráster en pirámide, además, obliga a decidir la política de distribución de los archivos voluminosos: no todo lo congelado cabe ni conviene que quepa en el historial.

**Se descarta la capa de presentación que funciona** → No se borra hasta que la capa nueva pasa su suite completa. Versionar `interfaz/` es prerrequisito de esta frase: cuando este plan se escribió, el directorio no estaba en el historial y la garantía de recuperación era inexistente. Hoy está versionado.

**Se introduce una cadena de construcción de frontend** → Su salida son archivos estáticos, de modo que el equipo donde se ejecuta el paquete no la necesita. El coste queda confinado al entorno de desarrollo y así se especifica.

**61 pruebas de interfaz se reescriben, y 49 pruebas de física y datos se reencaminan** → Es trabajo real, no evitable, y mayor de lo que el plan admitía. El riesgo no es el coste sino el silencio: dos de las suites reencaminadas se saltan si falta la dependencia retirada, así que la verificación de no regresión quedaría vacía y en verde si no se elimina esa omisión condicional.

**El arbitraje de la discrepancia de Isla Fuerte puede no cerrarla** → El spec exige presentarla, no resolverla. Si el tercer valor no la explica, el resultado sigue siendo válido: tres valores visibles con sus resoluciones son mejor material de discusión que dos.

**Las fuentes nuevas exigen cuentas de terceros** → Confinadas a la ingesta por spec. El riesgo residual es de disponibilidad: si un servicio cambia sus condiciones, los datos ya congelados siguen sirviendo y solo se pierde la capacidad de regenerarlos, que es exactamente lo que el procedimiento de regeneración documenta.

## Migration Plan

**Fase 0 — Oráculos.** No toca ni interfaz ni datos. Al terminar, el núcleo tiene coincidencia demostrada con las implementaciones de referencia y la configuración del proyecto ya no declara dependencias que no usa. Reversible por completo: solo añade pruebas.

**Fase 0.5 — Separar el servicio de la presentación.** Reubica `interfaz/calculo.py`, reencamina las tres suites que lo consumen y elimina la omisión condicional por dependencia. Al terminar, retirar la presentación es una operación que no puede llevarse el cálculo por delante. Reversible: es mover y renombrar.

**Fase 1 — Ingesta.** Añade archivos a `datos/`, su manifiesto con hashes, y procedimientos de descarga. La aplicación actual sigue funcionando y puede consumir los datos nuevos. Reversible: los archivos nuevos se pueden ignorar.

**Fase 2 — Interfaz.** Las dos capas de presentación coexisten mientras la nueva se completa. La retirada de la anterior es el último paso y está condicionada por spec a que la suite de la nueva pase entera, a que ningún caso se haya perdido sin declararlo y a que las suites de física y datos ejecuten todos sus casos sin depender de la capa retirada. Punto de retroceso: mientras la capa siga versionada, se puede volver a ella.

En ninguna de las cuatro fases existe un estado intermedio sin aplicación funcionando.

## Open Questions

- Nivel máximo de acercamiento del mapa **por familia de capa**. La base vectorial admite más niveles que los rásteres congelados, así que la pregunta no tiene una respuesta única: se fijan dos, midiendo en la fase 1 con el producto de teselado real delante.
- Política de distribución de los archivos voluminosos: `datos/` contiene hoy 62,5 MB de series CSV de marea e IDEAM sin versionar. Versionarlos todos, versionar solo lo pequeño y regenerar lo demás, o usar almacenamiento aparte para grandes objetos son tres decisiones distintas con costes distintos, y el spec ya no puede quedarse en «archivos versionados».
- Nivel de detalle del catálogo de convertidores no simulados en la capa nueva: son 15 fichas consultables, 13 de ellas sin modelo, y hoy la interfaz decide cuáles son simulables comparando identificadores con otro directorio en lugar de leer el flag que los propios archivos declaran. Hay que elegir cuál de los dos manda antes de portar la pantalla.
- Si las gráficas de los niveles Calcular y Diseñar se quedan permanentemente compuestas en Python o se migran al segundo motor más adelante. Ambas cumplen los specs; la decisión puede tomarse cuando la fase 2 esté avanzada y se vea cuánto estorba la estética por defecto.
