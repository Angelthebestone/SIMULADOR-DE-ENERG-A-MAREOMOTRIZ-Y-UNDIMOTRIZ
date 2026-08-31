## Purpose

Convierte la aplicación en un simulador con andamiaje pedagógico activo, no en un visor de cifras: el estudiante que abre la app encuentra una pregunta que lo guía, un glosario emergente sobre los términos físicos y unas micro-tareas verificables en cada nivel de divulgación.

## ADDED Requirements

### Requirement: Pregunta conductora visible al abrir el nivel Ver

La cabecera del nivel `Ver` SHALL mostrar una pregunta conductora y una micro-tarea que el estudiante pueda completar moviendo los tres controles existentes (altura significativa `Hm0`, período energético `Te`, ancho del absorbedor `B_pto`). La pregunta SHALL enunciar la hipótesis que la app ayuda a poner a prueba, no un objetivo genérico.

#### Scenario: Primera apertura con pregunta activa

- **WHEN** el usuario abre la app por primera vez
- **THEN** la cabecera del nivel `Ver` muestra una pregunta del estilo *"¿Cuántas viviendas de Isla Fuerte podrías alimentar si subes la altura significativa de ola a 2 m?"* con la micro-tarea asociada
- **AND** la pregunta desaparece o se atenúa cuando el estudiante alcanza la cifra objetivo (unidades, magnitud, escenario)

#### Scenario: Pregunta y tarea cambian con el nivel

- **WHEN** el usuario cambia de nivel (Comparar, Calcular, Diseñar)
- **THEN** la pregunta conductora se reformula para el nuevo nivel sin perder la hipótesis de fondo

### Requirement: Glosario emergente sobre términos físicos

El sistema SHALL ofrecer un glosario emergente (tooltip o popover) al pasar el cursor o pulsar sobre cada magnitud física o sigla que aparezca en la app: `Hm0`, `Te`, `B_pto`, `J`, `AEP`, `LCOE`, `PTO`, `η_PTO`, `η_gen`, `CRF`, `CRF`, `λ/2π`, `3λ/2π`, `Budal`, y las que el equipo añada. El glosario SHALL mostrar una definición en una línea, su unidad y, cuando aplique, la fuente de la convención.

#### Scenario: Glosario sobre un término

- **WHEN** el cursor pasa sobre `Hm0` en cualquier vista
- **THEN** aparece un cuadro con la definición, la unidad (m) y la convención seguida (4·σ_η del registro)

#### Scenario: Glosario en términos derivados

- **WHEN** el cursor pasa sobre `LCOE` en `Diseñar`
- **THEN** aparece la definición, la unidad (COP/MWh) y la fórmula conceptual (CRF·CAPEX + OPEX sobre AEP)

### Requirement: Micro-tareas verificables por nivel

El sistema SHALL enunciar, al menos en los niveles `Ver` y `Diseñar`, una micro-tarea que el estudiante pueda completar con los controles disponibles y cuyo cumplimiento SHALL poder verificarse de forma explícita en pantalla.

#### Scenario: Micro-tarea cumplida

- **WHEN** el estudiante alcanza el valor objetivo definido por la micro-tarea
- **THEN** la app muestra un veredicto positivo (unidades, valor) y la siguiente micro-tarea o un resumen
