## Purpose

Permite afirmar que las fórmulas escritas a mano en el núcleo coinciden con las implementaciones de referencia reconocidas del sector, sin delegar en ellas el cálculo ni renunciar al valor didáctico de tener la física visible y legible.

## ADDED Requirements

### Requirement: Las implementaciones de referencia validan, no calculan

Las bibliotecas de referencia externas SHALL usarse exclusivamente en la suite de pruebas. El simulador NO SHALL importarlas en ejecución, y el artefacto distribuido NO SHALL incluirlas.

Para que el artefacto no las incluya, su declaración NO SHALL bastarse con quitar el marcador de entorno: una dependencia declarada en el conjunto de ejecución se instala y se empaqueta. Las bibliotecas de referencia SHALL declararse en el conjunto de desarrollo, y retirarles el marcador sin cambiar de conjunto NO satisface este requisito.

El núcleo SHALL conservar sus fórmulas escritas de forma legible y consultable desde el nivel Calcular. Sustituir una fórmula propia por una llamada a una biblioteca externa NO satisface este requisito.

#### Scenario: Declaradas donde no alcanzan al artefacto

- **WHEN** se revisa la configuración del proyecto
- **THEN** toda biblioteca de referencia figura en el conjunto de desarrollo y no en el de ejecución
- **AND** una prueba automatizada falla si alguna aparece declarada como dependencia de ejecución

#### Scenario: Ausencia en el grafo de ejecución

- **WHEN** se analiza el grafo de imports de `nucleo/`, `analisis/`, `app/` y la capa de interfaz
- **THEN** no aparece ninguna biblioteca de validación de referencia
- **AND** una prueba automatizada falla si aparece

#### Scenario: El artefacto no las contiene

- **WHEN** se inspecciona el paquete distribuido
- **THEN** ninguna biblioteca de validación de referencia forma parte de él

### Requirement: Espectros contrastados contra implementación de referencia

Los espectros de Pierson-Moskowitz y JONSWAP construidos por el núcleo, y los parámetros derivados de sus momentos, SHALL contrastarse en pruebas contra una implementación de referencia de espectros de oleaje sobre los mismos parámetros de entrada.

La tolerancia de coincidencia SHALL estar declarada en la prueba. Una divergencia por encima de la tolerancia SHALL hacer fallar la suite.

#### Scenario: Coincidencia del espectro JONSWAP

- **WHEN** se construye un espectro JONSWAP con los mismos Hm0, Te y γ en el núcleo y en la implementación de referencia
- **THEN** ambas densidades espectrales coinciden dentro de la tolerancia declarada en todo el rango de frecuencias

#### Scenario: Coincidencia de los parámetros derivados

- **WHEN** se recuperan Hm0 y Te por integración de momentos sobre el mismo espectro en ambas implementaciones
- **THEN** los valores coinciden dentro de la tolerancia declarada

#### Scenario: La divergencia rompe la suite

- **WHEN** una fórmula del núcleo se modifica y deja de coincidir con la referencia
- **THEN** la suite de pruebas falla
- **AND** el error identifica qué magnitud divergió y en cuánto

### Requirement: Métricas de rendimiento contrastadas contra la norma IEC

El ancho de captura y la matriz de potencia SHALL contrastarse en pruebas contra la implementación de referencia de la IEC TS 62600-100 para energía undimotriz. Las métricas de dispositivo de corriente SHALL contrastarse contra la referencia de la IEC TS 62600-200.

Cada contraste SHALL apuntar al módulo que conserva la métrica después de la migración, no a una ruta que el propio plan de trabajo tenga asignada retirada. Un oráculo anclado a un archivo que una fase posterior borra deja de verificar nada en el momento en que la migración termina, que es precisamente cuando hace falta.

El sistema SHALL declarar en la documentación qué especificación técnica respalda cada métrica contrastada.

#### Scenario: Ancho de captura conforme a la norma

- **WHEN** se calcula un ancho de captura sobre un caso con potencia absorbida y densidad de potencia conocidas en ambas implementaciones
- **THEN** los resultados coinciden dentro de la tolerancia declarada

#### Scenario: El oráculo sobrevive a la retirada

- **WHEN** se retira la capa de presentación anterior
- **THEN** el contraste de la matriz de potencia sigue ejecutándose contra su nueva ubicación
- **AND** una comprobación automática verifica que ninguna prueba apunta a una ruta marcada para retirada

#### Scenario: Norma citada por métrica

- **WHEN** se consulta la procedencia metodológica de una métrica de rendimiento
- **THEN** aparece la especificación técnica que la respalda

### Requirement: Declaración de dependencias coherente con el uso real, en las dos direcciones

Toda dependencia declarada en la configuración del proyecto SHALL corresponder a un uso efectivo en el código o en las pruebas. Una dependencia declarada que no se importe en ninguna parte SHALL retirarse o pasar a usarse.

La coherencia SHALL comprobarse también en el sentido inverso, que es el que rompe un paquete: todo módulo que se ejecuta dentro del simulador o que la interfaz necesita para representarse SHALL depender solo de dependencias declaradas en el conjunto de ejecución. Una biblioteca usada en ejecución y declarada solo en desarrollo produce un paquete que falla en el equipo limpio y una suite que pasa en el de desarrollo.

Un marcador de entorno que excluya silenciosamente una dependencia en versiones soportadas del intérprete NO SHALL emplearse: si la dependencia es necesaria en ejecución, SHALL declararse sin condición en el conjunto de ejecución; si solo hace falta para probar o para ingerir datos, SHALL declararse en el conjunto correspondiente; si no es necesaria, SHALL retirarse.

#### Scenario: Dependencia declarada sin uso

- **WHEN** se comprueba cada dependencia declarada contra los imports del proyecto
- **THEN** toda dependencia declarada aparece importada en al menos un módulo o prueba
- **AND** una prueba automatizada falla si alguna no aparece

#### Scenario: Uso en ejecución con declaración de desarrollo

- **WHEN** un módulo que se ejecuta dentro del simulador importa una dependencia declarada solo en el conjunto de desarrollo o en un extra
- **THEN** una prueba automatizada falla nombrando el módulo, la importación y el conjunto donde está declarada
- **AND** el fallo se produce aunque la suite completa esté en verde en el entorno de desarrollo

#### Scenario: Instalación completa en el intérprete soportado

- **WHEN** se instala el proyecto con sus extras de desarrollo en una versión soportada del intérprete
- **THEN** todas las dependencias declaradas quedan efectivamente instaladas e importables

#### Scenario: Instalación mínima suficiente para ejecutar

- **WHEN** se instala el proyecto sin ningún extra y se recorre la aplicación completa
- **THEN** ninguna función necesita una dependencia que solo estaba en un extra
- **AND** una verificación en un entorno recién creado lo confirma

### Requirement: Contraste externo de producción anual y coste

La producción anual y el coste por MWh del emplazamiento por defecto SHALL contrastarse, al menos una vez y fuera del simulador, contra un modelo público independiente de energía undimotriz que recorra el mismo trayecto de recurso a valoración económica.

El resultado del contraste SHALL quedar documentado con la fuente del modelo, sus supuestos y la magnitud de la diferencia encontrada. Este contraste NO SHALL formar parte de la ejecución del simulador.

#### Scenario: Contraste documentado

- **WHEN** se consulta la documentación de validación del proyecto
- **THEN** aparece el contraste de producción anual y coste contra el modelo externo, con su fuente y sus supuestos
- **AND** la diferencia encontrada se declara con su magnitud

#### Scenario: Divergencia declarada, no ocultada

- **WHEN** el modelo externo y el simulador difieren más allá del orden de magnitud
- **THEN** la divergencia se documenta con su explicación o se registra como hueco pendiente
- **AND** no se presenta el resultado propio como confirmado por el externo
