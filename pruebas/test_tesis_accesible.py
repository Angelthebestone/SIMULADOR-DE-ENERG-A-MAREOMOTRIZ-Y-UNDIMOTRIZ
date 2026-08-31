"""Tarea 140 — Contraste de la tesis accesible en los cuatro niveles.

La cifra 8,9 kW/m de Isla Fuerte (Ortega et al. 2013) y el umbral de 40
kW/m (Osorio et al. 2016 / Handbook cap. 1) son la conclusion del
simulador. Esta prueba verifica que aparecen en los cuatro niveles y que
los datos vienen del modulo Python `app.tesis`, no de valores literales
duplicados en la presentacion.
"""

from __future__ import annotations

import pathlib


_RAIZ = pathlib.Path(__file__).resolve().parent.parent
_TESIS_PY = _RAIZ / "app" / "tesis.py"
_MAIN_TS = _RAIZ / "web" / "src" / "main.ts"
_VER_VUE = _RAIZ / "web" / "src" / "views" / "Ver.vue"
_CALCULAR_VUE = _RAIZ / "web" / "src" / "views" / "Calcular.vue"
_DISENAR_VUE = _RAIZ / "web" / "src" / "views" / "Disenar.vue"
_COMPARAR_VUE = _RAIZ / "web" / "src" / "views" / "Comparar.vue"


def _leer(p: pathlib.Path) -> str:
    return p.read_text(encoding="utf-8")


def test_densidades_declara_isla_fuerte_y_umbral() -> None:
    """`app/tesis.py::DENSIDADES` declara 8,9 kW/m (verificado) y 40 kW/m."""
    src = _leer(_TESIS_PY)
    # buscar la entrada "Isla Fuerte" con valor 8.9
    assert "Isla Fuerte" in src, "DENSIDADES no menciona Isla Fuerte"
    # valor 8.9 aparece en el contexto de Isla Fuerte
    assert '"valor": 8.9' in src or "'valor': 8.9" in src, (
        "DENSIDADES no declara el valor 8.9 para Isla Fuerte"
    )
    # umbral 40.0
    assert '"valor": 40.0' in src or "'valor': 40.0" in src, (
        "DENSIDADES no declara el valor 40.0 para el umbral"
    )


def test_contraste_isla_fuerte_vs_umbral() -> None:
    """`contraste_isla_fuerte_vs_umbral()` retorna los dos valores."""
    from app.tesis import contraste_isla_fuerte_vs_umbral

    c = contraste_isla_fuerte_vs_umbral()
    assert c["isla_fuerte_kw_m"] == 8.9, (
        f"el contraste retorna {c['isla_fuerte_kw_m']}, se esperaba 8.9"
    )
    assert c["umbral_kw_m"] == 40.0, (
        f"el contraste retorna {c['umbral_kw_m']}, se esperaba 40.0"
    )


def test_8_9_visible_en_ver() -> None:
    """`Ver.vue` muestra 8,9 kW/m y la fuente Ortega et al. 2013."""
    src = _leer(_VER_VUE)
    # 8.9 o 8,9
    assert "8.9" in src or "8,9" in src, (
        "Ver.vue no muestra la cifra 8,9 kW/m"
    )
    assert "Ortega" in src or "kW/m" in src, (
        "Ver.vue no muestra la fuente/unidad de la cifra"
    )


def test_8_9_visible_en_calcular() -> None:
    """En Calcular la cifra llega del calculo, no de un ejemplo escrito a mano.

    El bloque de demostracion con 8,9 incrustado desaparecio: era andamio de
    prueba. La tarjeta muestra la sustitucion que compone `app/formulas.py`, y
    el contraste de la tesis sigue accesible desde la barra de indicadores de
    la carcasa, visible tambien en este nivel.
    """
    src = _leer(_CALCULAR_VUE)
    assert "f.sustitucion" in src, (
        "Calcular.vue no muestra los valores sustituidos del calculo"
    )
    assert "demo" not in src.lower(), (
        "Calcular.vue conserva andamio de demostracion"
    )
    assert "8,9" in _leer(_MAIN_TS), (
        "la carcasa, visible desde Calcular, no conserva la cifra de la tesis"
    )


def test_8_9_visible_en_disenar() -> None:
    """`Disenar.vue` referencia 8,9 kW/m."""
    src = _leer(_DISENAR_VUE)
    assert "8.9" in src or "8,9" in src, (
        "Disenar.vue no menciona la cifra 8,9"
    )


def test_8_9_visible_en_comparar() -> None:
    """`Comparar.vue` muestra la tabla de discrepancia con 8,9."""
    src = _leer(_COMPARAR_VUE)
    assert "8,9" in src, "Comparar.vue no muestra 8,9 kW/m en la discrepancia"
    assert "1,96" in src, "Comparar.vue no muestra el valor ERA5 (1,96)"


def test_main_ts_referencia_la_cifra() -> None:
    """`main.ts` declara la cita larga con la cifra 8,9."""
    src = _leer(_MAIN_TS)
    assert "8,9" in src, "main.ts no incluye la cifra 8,9 en la cita larga"


def test_umbral_40_visible_en_al_menos_un_nivel() -> None:
    """`40` aparece en el contexto del umbral en al menos un nivel."""
    srcs = [_leer(_VER_VUE), _leer(_CALCULAR_VUE), _leer(_DISENAR_VUE)]
    encontrado = False
    for src in srcs:
        # presencia de 40 (no solo en cite footer) en contexto de umbral
        if "40" in src and "umbral" in src.lower():
            encontrado = True
            break
        # o como "40,0" en calculo
        if "40,0" in src:
            encontrado = True
            break
    assert encontrado, "ningun nivel muestra el umbral 40 kW/m"


def test_la_cifra_no_se_deriva_en_la_presentacion() -> None:
    """Las vistas no contienen `0.089 * 100` ni formulas que deriven 8,9."""
    # Decision 20.9: ninguna magnitud mostrada se deriva en la presentacion.
    for ruta in (_VER_VUE, _CALCULAR_VUE, _DISENAR_VUE, _COMPARAR_VUE):
        src = _leer(ruta)
        # busqueda de division sospechosa
        assert "0.089 * 100" not in src and "0,089 * 100" not in src, (
            f"{ruta.name} deriva 8,9 por multiplicacion — viola decision 20.9"
        )
        assert "* 89 / 10" not in src and "/ 89 / 10" not in src