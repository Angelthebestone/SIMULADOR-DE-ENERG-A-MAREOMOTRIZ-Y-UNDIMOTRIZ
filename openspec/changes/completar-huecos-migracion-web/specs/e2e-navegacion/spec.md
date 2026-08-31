## Purpose

Sustituye la verificación de bundle de la migración web por una suite que navega la aplicación real con Playwright y la somete al mismo recorrido que una persona: cambiar de nivel, mover los tres controles del nivel Ver, lanzar y cancelar la matriz, conmutar las capas del mapa y recorrer la aplicación con teclado.

## ADDED Requirements

### Requirement: La suite de pruebas navega la aplicación real

El sistema SHALL disponer de una suite de pruebas que arranque la aplicación web servida por `npm run dev` o por el build de Vite, abra Chromium mediante Playwright, y recorra los cuatro niveles y el mapa como lo haría una persona.

La suite SHALL ejercitar los controles declarados del nivel Ver, lanzar una simulación y cancelarla a media ejecución, conmutar cada capa conmutable del mapa, recorrer la aplicación solo con teclado y verificar que los atajos ESC y Ctrl+E tienen el efecto declarado.

Las pruebas SHALL ejecutarse en CI con `playwright install chromium` instalado y SHALL fallar ruidosamente si Playwright o el binario de Chromium no están disponibles: la regla del proyecto de 0-skipped y 0-importorskip se mantiene.

#### Scenario: Arranque y cierre limpio

- **WHEN** se ejecuta la suite sobre una construcción reciente
- **THEN** Playwright abre la página, los componentes de la app se montan
- **AND** al cerrar el navegador, no queda ningún proceso del simulador ni de Vite en ejecución

#### Scenario: Recorrido por los cuatro niveles

- **WHEN** la suite activa cada pestaña de navegación por teclado
- **THEN** la vista correspondiente se hace visible y el foco pasa al encabezado del nivel
- **AND** el estado de la pestaña activa se refleja en `aria-selected`

#### Scenario: Tres controles del nivel Ver con su valor físico

- **WHEN** la suite arrastra los tres controles deslizantes del nivel Ver
- **THEN** la cifra principal refleja la nueva combinación de parámetros
- **AND** la cifra se actualiza dentro de un segundo desde el fin del arrastre

#### Scenario: Lanzar y cancelar la matriz

- **WHEN** la suite lanza una simulación con `completo=True` y la cancela a los 200 ms
- **THEN** el progreso alcanza un valor entre 1 y 99
- **AND** el campo `cancelado` del contrato es `true` en la respuesta

#### Scenario: Conmutación de cada capa del mapa

- **WHEN** la suite activa y desactiva cada capa conmutable del mapa
- **THEN** la capa correspondiente aparece y desaparece en la visualización
- **AND** ningún recálculo de la simulación se dispara

#### Scenario: Recorrido solo con teclado

- **WHEN** la suite recorre la aplicación con Tab, flechas, Home, End, Enter y Space
- **THEN** cada control operable muestra un indicador de foco visible
- **AND** es posible lanzar, cancelar y exportar una simulación sin invocar el puntero

#### Scenario: Atajos ESC y Ctrl+E

- **WHEN** la suite pulsa Ctrl+E y luego ESC
- **THEN** el modo sustentación se activa y después se desactiva
- **AND** el factor de escala del documento pasa de 2,1 a 1 y de vuelta a 2,1

### Requirement: La suite no depende de recursos remotos

La suite de pruebas SHALL ejecutarse sin conexión a internet salvo el caso explícito de carga inicial de Chromium por `playwright install`. Una vez el binario está instalado, ninguna prueba SHALL emitir peticiones a direcciones que no sean `127.0.0.1` o `localhost`.

La política de origen del documento SHALL bloquear cualquier petición remota que la aplicación pueda intentar bajo la prueba.

#### Scenario: Tráfico saliente durante la suite

- **WHEN** se ejecuta la suite completa con la red observada
- **THEN** la única petición saliente es la carga local del HTML, JS y CSS de Vite
- **AND** no se registra ninguna petición a un dominio externo

### Requirement: La suite es repetible y produce el mismo resultado

Ejecutar la suite dos veces seguidas SHALL producir el mismo conjunto de veredictos: ninguna prueba es intermitente. La regla se cumple escribiendo pruebas que consultan estado determinista (atributos `aria-*`, texto de elementos, valores del contrato) y evitando temporizadores absolutos cuando basta con esperar a una condición observable.

#### Scenario: Determinismo entre dos ejecuciones

- **WHEN** se ejecuta la suite dos veces seguidas sin cambios en el código
- **THEN** ambas ejecuciones producen el mismo número de pasos pasados y fallidos
- **AND** ningún test marca error de timeout
