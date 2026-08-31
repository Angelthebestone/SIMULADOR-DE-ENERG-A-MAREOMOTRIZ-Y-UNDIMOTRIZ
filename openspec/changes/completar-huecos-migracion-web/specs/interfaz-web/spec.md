## MODIFIED Requirements

### Requirement: Pruebas automatizadas sobre la interfaz real

La interfaz SHALL disponer de pruebas automatizadas que la ejerciten como lo haría una persona: conmutar niveles, mover controles, lanzar y cancelar una simulación, abrir el mapa y conmutar sus capas.

Las pruebas SHALL ejecutarse contra la aplicación servida por Vite o por el build de producción, abiertas en un navegador real mediante Playwright. Verificar el bundle compilado sin navegador SHALL dejar de satisfacer este requisito: el navegador es el que ejerce la composición, el foco, el orden de tabulación, la conmutación de capas y la cancelación de la matriz.

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

#### Scenario: La suite no es inspección de bundle

- **WHEN** se ejecuta la suite de pruebas
- **THEN** un proceso de navegador queda en ejecución durante la suite
- **AND** la suite consulta el DOM, los atributos `aria-*` y el contrato recibido por la API
- **AND** la suite falla si el navegador no arranca o si Vite no sirve la app
