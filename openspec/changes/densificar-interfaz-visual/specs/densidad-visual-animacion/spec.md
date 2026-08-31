## Purpose

Aumenta la densidad visual del canvas del nivel `Ver` para que el estudiante perciba el fenómeno físico, el contexto geográfico y la magnitud numérica al mismo tiempo, sin abandonar la política de origen único ni introducir dependencias 3D externas.

## ADDED Requirements

### Requirement: Fondo de la animación con capas raster verificadas

El canvas de `Ver` SHALL componerse, como fondo bajo la superficie libre y el cuerpo flotante, con la pirámide raster de la mediana Sentinel-2 (color real del Caribe colombiano) y opcionalmente el relieve sombreado GEBCO, servidas como teselas XYZ desde `datos/gee/sentinel2_mediana/` y `datos/gee/relieve_sombreado/`. La capa SHALL ser estática (no animada), recortada al rectángulo del canvas, y SHALL respetar la opacidad por defecto del 60 % para no robar protagonismo al oleaje. La capa SHALL poder activarse y desactivarse desde un control de la propia vista.

#### Scenario: Activación del fondo

- **WHEN** el usuario activa la capa de fondo en `Ver`
- **THEN** el canvas dibuja la composición raster recortada al rectángulo del oleaje
- **AND** la superficie libre y la boya siguen siendo visibles por encima

#### Scenario: Sin CDN ni dependencia externa

- **WHEN** el navegador carga la vista `Ver`
- **THEN** ninguna petición de red sale hacia dominios externos para servir el fondo
- **AND** el bundle compilado no incluye librerías 3D (three.js, regl, babylon)

### Requirement: Anotaciones físicas en vivo sobre el canvas

La animación SHALL superponer tres anotaciones físicas que se actualizan con los controles y con la simulación: altura significativa `Hm0` como flecha vertical, período energético `Te` como intervalo horizontal entre dos crestas consecutivas, y potencia instantánea `J(t)` en vatio por metro en una esquina. Las anotaciones SHALL provenir de la misma simulación que alimenta la posición del cuerpo, no ser decorativas.

#### Scenario: Anotación de Hm0 coherente con el control

- **WHEN** el usuario mueve el control de `Hm0` de 1,5 m a 2,5 m
- **THEN** la flecha vertical de la anotación se redimensiona en consonancia con la nueva altura
- **AND** la posición del cuerpo flotante refleja la nueva amplitud dentro de la misma simulación

#### Scenario: J(t) en tiempo real

- **WHEN** la animación corre
- **THEN** la esquina muestra `J(t)` en `W/m` con un decimal en formato español (coma decimal)
- **AND** la cifra varía siguiendo la frecuencia dominante del oleaje
