## MODIFIED Requirements

### Requirement: Las implementaciones de referencia validan, no calculan

Las bibliotecas de referencia externas SHALL usarse exclusivamente en la suite de pruebas. El simulador NO SHALL importarlas en ejecución, y el artefacto distribuido NO SHALL incluirlas.

Para que el artefacto no las incluya, su declaración NO SHALL bastarse con quitar el marcador de entorno: una dependencia declarada en el conjunto de ejecución se instala y se empaqueta. Las bibliotecas de referencia SHALL declararse en el conjunto de desarrollo, y retirarles el marcador sin cambiar de conjunto NO satisface este requisito.

Las dependencias transitivas necesarias para que las bibliotecas de referencia ejecuten SHALL declararse en el mismo conjunto que estas, con su justificación documentada. Una biblioteca que solo puede importarse cargando `statsmodels` exige que `statsmodels` esté en el mismo conjunto que ella; declararla en el otro conjunto es ocultar la dependencia.

El núcleo SHALL conservar sus fórmulas escritas de forma legible y consultable desde el nivel Calcular. Sustituir una fórmula propia por una llamada a una biblioteca externa NO satisface este requisito.

Las pruebas que invocan las bibliotecas de referencia SHALL ejecutarlas, no saltarlas. Un `pytest.importorskip` en una prueba de oráculo es la forma en que una garantía de validación se convierte en una ausencia: la prueba pasa sin haber medido nada.

#### Scenario: Declaradas donde no alcanzan al artefacto

- **WHEN** se revisa la configuración del proyecto
- **THEN** toda biblioteca de referencia figura en el conjunto de desarrollo y no en el de ejecución
- **AND** una prueba automatizada falla si alguna aparece declarada como dependencia de ejecución

#### Scenario: Dependencias transitivas declaradas en el mismo conjunto

- **WHEN** una biblioteca de referencia exige una dependencia transitiva para ejecutarse
- **THEN** la dependencia transitiva figura en el mismo conjunto que la biblioteca
- **AND** una prueba automatizada falla si la transitiva está en otro conjunto

#### Scenario: Ausencia en el grafo de ejecución

- **WHEN** se analiza el grafo de imports de `nucleo/`, `analisis/`, `app/` y la capa de interfaz
- **THEN** no aparece ninguna biblioteca de validación de referencia
- **AND** una prueba automatizada falla si aparece

#### Scenario: El artefacto no las contiene

- **WHEN** se inspecciona el paquete distribuido
- **THEN** ninguna biblioteca de validación de referencia forma parte de él

#### Scenario: Los oráculos se ejecutan, no se saltan

- **WHEN** se ejecuta la suite de pruebas con las dependencias de desarrollo instaladas
- **THEN** las pruebas que contrastan contra la implementación de referencia ejecutan el cálculo
- **AND** ninguna prueba de oráculo salta la importación con `pytest.importorskip`
- **AND** la ausencia de la biblioteca de referencia se manifiesta como fallo, no como omisión
