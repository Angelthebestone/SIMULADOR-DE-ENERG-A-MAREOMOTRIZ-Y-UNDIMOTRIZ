# Código eliminado — Fase 2

Fecha: 2026-09-08. Criterio: módulo no alcanzable desde `api/simular.py` ni
`app/__main__.py` Y no cubierto por `pruebas/`. Verificación: grafo de imports
+ `coverage run -m pytest` (TOTAL 78 %, `documentacion/cobertura_antes.txt`) +
`vulture --min-confidence 60` + `ruff F401/ARG`. Pruebas: 328 passed, 1 skipped,
7 failed (preexistentes documentados).

## Conservados (43/43): ningún módulo Python califica

Todo lo no alcanzable desde los entrypoints está cubierto por `pruebas/`
(borrarlo rompería pruebas, prohibido): `app/animacion.py`,
`app/datos_lectura.py`, `app/escenarios.py`, `app/exportacion.py`,
`app/limitaciones.py`, `app/niveles.py`, `app/procedencia.py`, `app/tesis.py`,
`app/trabajo.py`, `analisis/dimensionado.py` (spec diseno-dispositivo),
`nucleo/espectros.py`, `nucleo/electrico.py`, `nucleo/pto.py`, etc.
Tabla completa archivo/líneas/cobertura/alcanzable/veredicto en el reporte
de la fase (conservar todo).

Ruff ARG (9, firmas de interfaz, no muertos): `captura.py:302 k_pto_n_m`,
`absorbedor.py:74 rho/75 g/131 contexto`, `owc.py:150 contexto`,
`espectros.py:211 gamma/212 g`, `mareas.py:176 nivel_m/177 media`.
Ruff F401: 0. Vulture: solo falsos positivos (variables, dataclass fields).

## Eliminado (aprobado)

- `scratchpad/` (directorio con PNGs QA y scripts debug, ignorado por
  `.gitignore`, no trackeado).
- `salidas/` (53 PNGs QA visual, ignorado por `.gitignore`, no trackeado).
- `scratchpad_*.py` en raíz (no existían como archivos; solo el directorio).
- Todos los `__pycache__` (12 directorios, ignorados por `.gitignore`).
- `.coverage` (artefacto de la medición, no trackeado).
- `documentacion/logs/` (logs vacíos de suites en segundo plano, no trackeados).

`documentacion/referencias/` (5 fotos de Fase 3) se conserva: es insumo de
la fase siguiente. `documentacion/cobertura_antes.txt` se conserva: es la
línea base exigida por la tarea.
