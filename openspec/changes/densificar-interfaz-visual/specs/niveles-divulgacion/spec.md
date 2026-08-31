## Purpose

Delta sobre la capacidad existente `niveles-divulgacion`. Añade el requisito de acompañar cada fórmula del nivel `Calcular` con una línea de intuición física en lenguaje corriente, para que un estudiante que abre el nivel entienda qué representa la fórmula y por qué importa, sin abandonar el principio de que la presentación nunca calcula.

## ADDED Requirements

### Requirement: Intuición física junto a cada fórmula de Calcular

En el nivel `Calcular`, el sistema SHALL acompañar cada fórmula KaTeX con una sola línea de intuición física en lenguaje corriente, en español, que traduzca la expresión a una idea observable: por qué una magnitud escala con otra, qué representa el factor numérico, qué pasa si se duplica una variable de entrada. La línea SHALL estar visible bajo la sustitución numérica, SHALL ser estable entre simulaciones (no recalcularse) y SHALL no sustituir a la fuente bibliográfica que ya se muestra.

#### Scenario: Intuición bajo la fórmula de potencia

- **WHEN** el usuario abre el nivel `Calcular` con el sitio Isla Fuerte seleccionado
- **THEN** la fórmula de la densidad de potencia `J` aparece con su sustitución numérica
- **AND** bajo la sustitución aparece una línea del estilo *"energía que cruza un metro de frente de ola por segundo; crece con el cuadrado de la altura y de forma lineal con el periodo"*

#### Scenario: Intuición bajo la fórmula de AEP

- **WHEN** el usuario abre el nivel `Calcular`
- **THEN** la fórmula de la producción anual `AEP` aparece con su sustitución numérica
- **AND** bajo la sustitución aparece una línea que explica el paso de potencia instantánea a energía anual

#### Scenario: Intuición no reemplaza la fuente

- **WHEN** el usuario abre el nivel `Calcular`
- **THEN** la línea de intuición está bajo la sustitución y la fuente bibliográfica sigue presente bajo la intuición
