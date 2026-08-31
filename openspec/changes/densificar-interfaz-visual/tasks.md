## 1. Núcleo de cálculo: supuestos editables

- [x] 1.1 Extender `app/servicio.py` con los cuatro parámetros opcionales (`eta_pto`, `eta_gen`, `crf`, `rho`) en `Parametros` con valores por defecto idénticos a los hard-coded actuales; verificar con `pytest -p no:cacheprovider --tb=line` que los tests existentes siguen pasando.
- [x] 1.2 Aplicar los cuatro parámetros a las funciones de cálculo de potencia capturada, AEP y LCOE; añadir test unitario en `pruebas/test_servicio.py` que recorra una rejilla de valores y verifique que la respuesta es monótona en el parámetro (más `eta_pto` → más potencia, más `crf` → más LCOE); verificar con `pytest pruebas/test_servicio.py --tb=line`.

## 2. Datos: LCOE estimado de fracasos comerciales

- [x] 2.1 Crear `datos/fracasos/procesar_lcoe.py` que, para cada ficha en `datos/fracasos/*.json`, calcule el LCOE estimado en Isla Fuerte con los parámetros del dispositivo y los valores por defecto del sitio; añadir campo `lcoe_estimado_cop_mwh` (con `valor`, `fuente`, `estado`, `unidad`) al JSON de cada ficha; ejecutar el script una vez; verificar con `pytest pruebas/test_fracasos_lcoe.py --tb=line` (test nuevo que valida presencia del campo, estado `verificado` o `pendiente` y trazabilidad).
- [x] 2.2 Añadir `pruebas/test_fracasos_lcoe.py` que verifique que cada ficha de `datos/fracasos/` tiene el campo `lcoe_estimado_cop_mwh` con `estado` ∈ {verificado, pendiente} y fuente declarada; verificar con `pytest pruebas/test_fracasos_lcoe.py --tb=line`.

## 3. Datos: LCOE medio SIN nacional

- [x] 3.1 Validar que `datos/xm/resumen_xm.json` contiene el campo `lcoe_sin_cop_mwh` con estado `verificado` y fuente; si falta, crear `datos/xm/procesar_sin.py` que lo calcule a partir de `datos/xm/PrecBolsNaci_2023-2024.csv` y lo escriba en el resumen, con SHA256 verificado; verificar con `pytest -k 'lcoe_sin' --tb=line`.
- [x] 3.2 Exponer el LCOE medio SIN en `app/servicio.py` o en `app/datos_lectura.py` (campo estático, lectura directa del JSON); añadir test que verifique el contrato; verificar con `pytest -k 'sin_nacional' --tb=line`.

## 4. Vista Ver: fondo raster y anotaciones físicas

- [x] 4.1 Crear `web/src/components/FondoRaster.vue` que cargue las teselas XYZ de `datos/gee/sentinel2_mediana/{z}/{x}/{y}.png` (con `datos/gee/relieve_sombreado/` opcional) y las pinte en una capa `<canvas>` inferior al canvas del oleaje, respetando la opacidad por defecto del 60 % y un control para activarla y desactivarla; verificar con `pytest pruebas/test_e2e_interfaz_web.py -k 'fondo_raster' --tb=line` (test e2e con Playwright que abre `Ver` y comprueba que la capa aparece y se puede alternar).
- [x] 4.2 Extender `web/src/components/AnimacionCanvas.ts` para dibujar las tres anotaciones físicas (flecha `Hm0`, intervalo `Te`, esquina `J(t)`) leyendo la serie ya integrada (sin recalcular física por fotograma); añadir test unitario en TypeScript que valide que las anotaciones se redimensionan al cambiar los controles; verificar con `npm run test:unit` o equivalente.
- [x] 4.3 Verificar la integración: abrir `Ver` con Playwright, mover `Hm0` de 1,5 a 2,5 m, capturar pantalla, comparar tamaño de la flecha antes y después; verificar con `pytest pruebas/test_e2e_interfaz_web.py -k 'anotaciones_fisicas' --tb=line`.

## 5. Vista Calcular: intuición física bajo cada fórmula

- [x] 5.1 Crear `web/src/contenido/intuiciones.ts` con un mapa `Record<id_formula, string>` que cubra todas las fórmulas renderizadas en `Calcular.vue`; verificar visualmente que cada entrada del mapa tiene menos de 25 palabras y un contenido no tautológico; verificar con `npm run lint` y una inspección manual.
- [x] 5.2 Modificar `web/src/views/Calcular.vue` para que cada bloque de fórmula KaTeX incluya bajo la sustitución numérica una línea de intuición leída del mapa por id; bajo la intuición, mantener la fuente bibliográfica existente; verificar con `pytest pruebas/test_e2e_interfaz_web.py -k 'intuicion' --tb=line`.

## 6. Vista Comparar: fracasos conectados al cálculo

- [x] 6.1 Modificar `web/src/components/FichaDispositivo.vue` (o el componente equivalente que muestra la ficha del fracaso) para que muestre el LCOE estimado del dispositivo en Isla Fuerte y, junto a él, el LCOE medio SIN del mismo año, ambos con su fuente; verificar con `pytest pruebas/test_e2e_interfaz_web.py -k 'fracaso_lcoe' --tb=line`.
- [x] 6.2 Cuando el campo `lcoe_estimado_cop_mwh` esté en `pendiente`, mostrar la leyenda "LCOE: pendiente" y el dato que falta; verificar con `pytest pruebas/test_e2e_interfaz_web.py -k 'fracaso_pendiente' --tb=line`.

## 7. Vista Diseñar: supuestos editables y comparación con SIN

- [x] 7.1 Extender `web/src/components/ControlesFisicos.vue` (o crear un componente nuevo) con los cuatro controles editables (`η_PTO`, `η_gen`, `CRF`, `ρ`), cada uno con valor por defecto, rango plausible, unidad y fuente en una sola línea bajo el control; verificar con `pytest pruebas/test_e2e_interfaz_web.py -k 'supuestos_editables' --tb=line`.
- [x] 7.2 Modificar la sección económica de `web/src/views/Disenar.vue` para que muestre los tres LCOE en el mismo orden (diésel ZNI, dispositivo marino, SIN nacional) y, según la diferencia, muestre la leyenda correspondiente de la tesis; verificar con `pytest pruebas/test_e2e_interfaz_web.py -k 'tres_lcoe' --tb=line`.

## 8. Andamiaje pedagógico: pregunta conductora y glosario

- [x] 8.1 Crear `web/src/contenido/pedagogia.ts` con un mapa por nivel (`preguntas: Record<nivel, { pregunta: string, tarea: string, verificar: (r: any) => boolean }>`) y la función `evaluar_cumplimiento`; añadir test unitario que valide que cada nivel tiene pregunta, tarea y un verificador; verificar con `npm run test:unit` o equivalente.
- [x] 8.2 Modificar la cabecera de `Ver.vue` para mostrar la pregunta y la micro-tarea del nivel activo, y el veredicto positivo cuando la micro-tarea se cumple; verificar con `pytest pruebas/test_e2e_interfaz_web.py -k 'pregunta_conductora' --tb=line`.
- [x] 8.3 Crear `web/src/components/Glosario.vue` con un mapa de términos y definiciones; modificar todos los lugares donde aparecen los términos físicos (`Hm0`, `Te`, `B_pto`, `J`, `AEP`, `LCOE`, `PTO`, `η_PTO`, `η_gen`, `CRF`) para envolverlos en un `<Glosario term="…">`; verificar con `pytest pruebas/test_e2e_interfaz_web.py -k 'glosario' --tb=line`.

## 9. Documentación y validación final

- [x] 9.1 Actualizar `documentacion/estado_huecos.md` cerrando los seis huecos cubiertos por este cambio y añadiendo un nuevo apéndice que documente el contenido pedagógico (preguntas, intuiciones, glosario); verificar leyendo el archivo diff y comparando contra los huecos previos declarados.
- [x] 9.2 Ejecutar la suite completa de regresión: `pytest -p no:cacheprovider --tb=no` (sin fail-fast para ver el resumen); documentar cualquier fallo preexistente en `documentacion/tests_rojos_pre_existentes.md` para que no se confunda con regresión; verificar que la suite termina con código 0 o, si no, con los mismos rojos preexistentes documentados.
- [x] 9.3 Verificar manualmente que la app empaquetada (`pyinstaller.spec`) sigue arrancando con `python -m pyinstaller` o `ejecutar.bat`; capturar pantalla de `Ver` con fondo raster y anotaciones, y guardar en `documentacion/capturas/` para auditoría; verificar con la captura presente y el bundle generado.
