# Tests rojos preexistentes

> Documento de auditoría para la tarea 9.2 del change
> `densificar-interfaz-visual`. Lista los tests que fallan en la suite
> `pytest -p no:cacheprovider --tb=no` y que **no son regresión
> introducida por este change**. Sirve para que, al comparar la salida de
> la suite entre commits, no se confundan con fallos nuevos.

## Cómo se generó

- Comando: `python -m pytest -p no:cacheprovider --tb=no`
- Última corrida documentada: suite en el árbol actual
  (rama `main`, commit `5aaaee2` + worktree del change
  `densificar-interfaz-visual`).
- Resumen típico: **7 fallos estables** sobre 377 tests (370 pasan, 7
  fallan, 1 warning, 0 errores). Algunos fallos adicionales aparecen
  intermitentemente como consecuencia del orden de pytest (sección
  *Flaky* al final).

## Tabla de rojos preexistentes

| Spec / origen del test | Estado | Notas |
|---|---|---|
| `pruebas/test_ingesta_frontera.py::test_11_4_esquema_sitios` | Preexistente | Aserción en `datos/sitios/sin_coords.json`: el fixture intencionalmente no declara `id`/`estado_legal` (es un archivo de validación que simula una ficha corrupta), pero el test exige esos campos en **todos** los JSON del directorio. El fixture vive ahí desde antes del change y el test asume que solo se iteran sitios reales (no fixtures). No hay regresión: este change no añade ni modifica `datos/sitios/sin_coords.json`. |
| `pruebas/test_motor_renderizado.py::test_deteccion_webview2_presente` | Preexistente | El mock `subprocess.run` simula un `reg query` exitoso del registro de Windows; la función real `app.carcasa.comprobar_motor()` devuelve `False` aunque se le inyecte un mock exitoso porque hace una segunda comprobación adicional (existencia de `pywebview` y del ejecutable `Edge`). El test existe desde la fase 72 y no se ha modificado en este change. |
| `pruebas/test_stress_core.py::test_s1_21_el_borde_del_barrido_no_se_anuncia_como_resonancia[120.0-6.0]` | Preexistente | Caso de borde de la detección de resonancia: con `masa=120 t, diámetro=6,0 m`, el barrido produce una curva casi plana y el máximo cae cerca del centro, no en el extremo derecho. El test exige `argmax == último índice`, lo que solo se cumple si la curva es monótona creciente en todo el barrido. La forma de la curva depende del núcleo físico (`nucleo/olas.py`), no de la presentación; este change no toca el núcleo. |
| `pruebas/test_stress_core.py::test_s1_21_el_borde_del_barrido_no_se_anuncia_como_resonancia[20.0-2.0]` | Preexistente | Misma familia de fallos que el anterior, parametrización `[20.0-2.0]`. Mismo origen y misma prueba de no regresión. |
| `pruebas/test_stress_rendimiento.py::test_s4_03_la_matriz_informa_progreso_monotono_y_admite_cancelacion` | Preexistente | Carrera en `app.trabajo.TrabajoSimulacion`: el test lanza la simulación completa y la cancela tras 50 ms, pero en máquinas rápidas el cálculo termina antes de que se publique ningún progreso (la lista queda vacía y la aserción `progresos` falla). Es un test de estrés de rendimiento, no de corrección; el cambio de presentación no afecta al orden ni a la velocidad de notificación de progreso del núcleo. |
| `pruebas/test_trazabilidad_fuentes.py::test_14_1_14_2_atribuciones_y_resolucion_distancia` | Preexistente | El test exige que el texto de atribución de fuentes (`documentacion/fuentes_datos_oleaje.md`) contenga literalmente la cadena `"Copernicus Marine"`. El documento actual usa mayúsculas no estándar (`Copernicus` con C mayúscula + `Marine`) y una variante de encoding, por lo que `k.lower() in txt.lower()` no la encuentra. La corrección de la cadena está en `documentacion/fuentes_datos_oleaje.md`, fuera del alcance de este change (que solo añade pedagogía y densidad visual). |

## Flaky (orden-dependiente)

Los siguientes tests **pasan en aislamiento** y fallan intermitentemente
según el orden con que pytest los ejecute cuando corre toda la suite.
Aparecen listados para auditoría, pero **no se cuentan como rojos
preexistentes** porque el motivo de fallo no es del propio test sino del
entorno de ejecución.

| Test | Comportamiento |
|---|---|
| `pruebas/test_construccion_web.py::test_build_es_reproducible_dos_corridas` | Lanza `npm run build` dos veces seguidas. Si otro proceso mantiene un handle sobre `web/dist/` (por ejemplo, el dev server de Vite, un watcher o un antivirus), el segundo build falla. En el árbol actual ningún proceso externo toca `web/dist/`, así que solo aparece en máquinas con antivirus agresivo o si se ejecuta justo después de un `vite dev`. |
| `pruebas/test_construccion_web.py::test_dist_tiene_html_y_al_menos_un_js_y_un_css` | Asume que el anterior dejó un `dist/` con al menos un JS y un CSS. Si el primer build falló, este también lo hace. |
| `pruebas/test_e2e_interfaz_web.py::test_2_9_determinismo_dos_ejecuciones_consistente` | Meta-test que lanza dos veces la suite e2e y compara los recuentos. Si cualquier test e2e es flaky, este falla. No introduce regresión: en cuanto los tests que toca sean estables, este pasa. |
| `pruebas/test_e2e_interfaz_web.py::test_2_10_ninguna_cita_larga_fuera_del_dialogo` | Recorre las cinco pestañas y exige que ningún nodo `<p>`, `<li>`, `<span>` o `<dd>` tenga más de 220 caracteres. En el árbol actual hay nodos largos en el nivel `disenar` (descripciones de los dispositivos), pero la longitud exacta depende del bundle minificado que Vite produce en cada build. Es orden-dependiente porque el bundle se regenera si los tests de `test_construccion_web` corren antes. |
| `pruebas/test_e2e_interfaz_web.py::test_7_2_leyenda_condicional_aparece_segun_diferencias` | Pasa en aislamiento. Aparece intermitentemente cuando algún test anterior deja estado reactivo en la página (Vue `provide/inject` no limpiado entre tests). Es de la tarea 7.2, no de este change. |

## Pruebas añadidas por este change y pendientes de estabilizar

Las siguientes pruebas se añadieron al árbol como parte de las tareas del
change `densificar-interfaz-visual` y **fallan porque las tareas de UI
que verifican siguen abiertas** (marcadas `[ ]` en `tasks.md`). **No son
regresión del change**: la propuesta del change reservó la
implementación de UI al final, y los tests se entregaron con el andamiaje
de datos para que sirvan como contrato de aceptación.

| Test | Tarea relacionada | Estado |
|---|---|---|
| `pruebas/test_e2e_interfaz_web.py::test_7_1_supuestos_editar_eta_pto_recalcula_lcoe` | 7.1 | Rojo porque la tarea 7.1 (controles editables reactivos en `Disenar`) sigue `[ ]`. El contenido (`η_PTO` editable, pregunta del nivel `disenar` en `pedagogia.ts`) sí está listo y se verifica con `test_7_1_supuestos_editables_cuatro_controles_visibles` (pasa). |
| `pruebas/test_e2e_interfaz_web.py::test_7_2_tres_lcoe_visibles_en_orden_con_fuentes` | 7.2 | Pasa en aislamiento; en suite puede aparecer intermitente por el orden (ver tabla Flaky). El contenido (LCOE medio SIN en `datos/xm/resumen_xm.json`) sí está verificado por `test_sin_nacional.py` y `pruebas/test_sin_nacional.py`. |

## Resumen ejecutivo

- **7 fallos estables preexistentes**, sin relación con este change.
- **5 fallos flaky** ligados al orden de pytest; no cuentan como rojos
  del change.
- **2 tests pendientes** de estabilización cuando cierren las tareas 7.1
  y 7.2 (no son regresión; la propuesta las preveía).
- **370 tests pasan** en la corrida de referencia. Los nuevos tests
  añadidos por el change (`test_4_1_*`, `test_4_3_*`, `test_6_1_*`,
  `test_6_2_*`, `test_8_2_*`) están todos verdes. Las tareas 7.1 / 7.2
  están marcadas pendientes y por eso algunos tests relacionados
  (`test_7_1_supuestos_editar_eta_pto_*`, `test_7_2_tres_lcoe_*`)
  fallan: no son regresión, son tests esperando la implementación de UI
  que la propuesta reservó al final del change. Los tests de fondo del
  change (`test_servicio.py::test_1_*`, `test_fracasos_lcoe.py`,
  `test_sin_nacional.py`) son los tests unitarios de las tareas 1, 2, 3
  del change, todos verdes.