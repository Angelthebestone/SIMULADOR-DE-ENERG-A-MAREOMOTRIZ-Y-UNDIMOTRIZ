## ADDED Requirements

### Requirement: Las pruebas de interfaz se anclan al hecho, no a la frase

Una prueba que verifique una decisión de presentación SHALL anclarse a un atributo estable
(`data-testid`, `data-*` de valor semántico) o al código que implementa la decisión. NO SHALL
anclarse a una cadena de prosa escrita en la vista con el único fin de satisfacerla.

Cuando un ancla de prosa se migre a un atributo, la prueba SHALL conservar la intención
original: el criterio verificado antes y después es el mismo, y el recuento de pruebas de la
suite no disminuye.

Ningún texto SHALL existir en la interfaz cuya única razón de ser sea que una prueba lo
busque.

#### Scenario: Migración de un ancla

- **WHEN** se retira de la pantalla una frase que sostenía un oráculo
- **THEN** la prueba pasa a comprobar el atributo o el código que implementa la decisión
- **AND** el recuento de pruebas de la suite es igual o mayor que antes de la migración

#### Scenario: Prosa sin propósito de usuario

- **WHEN** se revisa un texto visible de la interfaz
- **THEN** existe un usuario del simulador para quien ese texto es útil
- **AND** si el único lector posible es el equipo de desarrollo, el texto no está en pantalla
