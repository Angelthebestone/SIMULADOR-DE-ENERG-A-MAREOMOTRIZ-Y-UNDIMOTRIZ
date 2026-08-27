## Purpose

Asegura que el código se mantenga mínimo, testeable y defendible en la sustentación, aislando la física de la interfaz y automatizando la calidad en cada push.

## ADDED Requirements

### Requirement: Arquitectura limpia / hexagonal

El núcleo de física (`nucleo/`, `analisis/`) NO SHALL importar ningún módulo de `interfaz/` ni de `app/`. Las reglas de negocio SHALL estar aisladas de frameworks, base de datos y UI, con dependencias apuntando hacia dentro.

El sistema SHALL usar inyección de dependencias para constantes físicas (`ρ`, `g`) y para fuentes de datos (sitios/dispositivos), en lugar de que cada módulo las cree internamente.

#### Scenario: Núcleo sin dependencia gráfica

- **WHEN** se analiza estáticamente el grafo de imports de `nucleo/` y `analisis/`
- **THEN** no aparece ningún import de `interfaz` ni de `PySide6`
- **AND** una prueba automatizada falla si aparece

#### Scenario: DI de constantes físicas

- **WHEN** se instancia un cálculo de recurso
- **THEN** `ρ` y `g` se pasan como parámetros con valor por defecto documentado
- **AND** cambiar `ρ` de 1.025 a 1.000 cambia `J` de 0,4906 a 0,4786 dentro del 0,1 %

### Requirement: Principios SOLID, KISS, DRY, YAGNI y SoC

Cada módulo SHALL tener una sola responsabilidad (SRP), estar abierto a extensión sin modificar eslabones existentes (OCP), y exponer interfaces segregadas por familia (ISP). El sistema SHALL preferir la solución más simple que cumpla el spec (KISS), no duplicar lógica (DRY), no implementar funcionalidad futura no especcada (YAGNI) y separar claramente cálculo, datos y presentación (SoC).

#### Scenario: Extensión sin modificación

- **WHEN** se añade una tercera familia (hidráulica) como nuevo módulo en `nucleo/dispositivos/`
- **THEN** `base.py` y los cuatro dispositivos existentes no requieren cambios

### Requirement: Código limpio y guías de estilo

El código SHALL seguir PEP 8, nombres autoexplicativos, funciones pequeñas con pocos argumentos y sin comentarios innecesarios. La complejidad se resuelve con nombres y estructura, no con comentarios.

#### Scenario: Linter sin errores

- **WHEN** se ejecuta `ruff check` y `black --check` sobre `nucleo/` y `analisis/`
- **THEN** no hay violaciones

### Requirement: TDD, BDD y ATDD antes del código

Todo requisito SHALL tener su prueba escrita antes que la implementación (TDD). Los escenarios de este spec en lenguaje GIVEN/WHEN/THEN SHALL ser la especificación ejecutable (BDD/ATDD).

#### Scenario: Prueba antes que implementación

- **WHEN** se añade un nuevo requisito
- **THEN** existe al menos un test que falla antes de implementar el código

### Requirement: Revisión y limpieza continua

El sistema SHALL someterse a refactorización sin cambiar comportamiento, revisión de código y análisis estático (Ruff/SonarQube) en cada cambio. La refactorización SHALL preservar todos los invariantes físicos.

#### Scenario: Refactorización preserva invariantes

- **WHEN** se refactoriza un módulo de `nucleo/`
- **THEN** todas las pruebas de invariantes (potencia capturada ≤ incidente, CWR ≤ λ/2π, Cp ≤ 16/27 salvo aviso) siguen pasando

### Requirement: Patrones de diseño y DI

El sistema SHALL aplicar patrones estándar solo cuando resuelvan un problema especcado: Strategy para PTO, Factory para dispositivos, Observer (señales Qt) para progreso/cancelación.

#### Scenario: Strategy de PTO intercambiable

- **WHEN** se cambia el tipo de PTO sobre el mismo dispositivo
- **THEN** solo cambia la estrategia de rendimiento, sin tocar la cadena

### Requirement: CI con tests disruptivos

Cada push SHALL ejecutar linters, formateadores y pruebas automatizadas. La suite SHALL incluir tests disruptivos que busquen romper el programa, no solo verificar el caso feliz: entradas fuera de rango, JSON corrupto o sin fuente, matriz que no suma 1, Cp > 16/27, Hs negativa, Te = 0.

#### Scenario: Test disruptivo bloquea merge

- **WHEN** se envía un JSON de sitio sin campo `fuente` o una matriz de ocurrencia que suma 0,8
- **THEN** la CI falla
- **AND** el error indica el invariante roto

#### Scenario: Fuzzing de entradas numéricas

- **WHEN** se fuzzzean Hs, Te, profundidad y Cp con valores aleatorios dentro y fuera de rango
- **THEN** el sistema nunca lanza excepción no controlada: acota y explica (programación defensiva)

### Requirement: Entrega empaquetada y ejecutable sin Python instalado

El sistema SHALL distribuirse como ejecutable empaquetado que arranca en un equipo sin Python ni dependencias instaladas y sin permisos de administrador. El paquete SHALL incluir los datos locales de `datos/` y SHALL operar sin conexión a internet.

La declaración de limitaciones del modelo SHALL ser accesible desde la aplicación empaquetada, no solo desde el repositorio.

#### Scenario: Arranque en equipo limpio

- **WHEN** se ejecuta el paquete en un equipo sin Python instalado y sin conexión
- **THEN** la aplicación arranca y el emplazamiento por defecto se carga con sus datos

#### Scenario: Limitaciones dentro del paquete

- **WHEN** se consultan las limitaciones del modelo desde la aplicación empaquetada
- **THEN** el texto aparece sin requerir ningún archivo externo al paquete
