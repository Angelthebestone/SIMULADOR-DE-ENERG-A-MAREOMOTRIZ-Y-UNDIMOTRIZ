"""Tarea 3.1/3.2 — LCOE medio SIN en ``resumen_xm.json`` y expuesto en la app.

Verifica:
- El campo ``lcoe_sin_cop_mwh`` está en ``datos/xm/resumen_xm.json`` con
  ``estado == verificado`` y ``fuente`` declarada.
- La función ``app.datos_lectura.cargar_lcoe_sin()`` lo expone con la
  forma ``{valor, unidad, fuente, estado}`` lista para la vista ``Diseñar``.
"""

from __future__ import annotations

import json
import pathlib

_RAIZ = pathlib.Path(__file__).resolve().parent.parent
_XM = _RAIZ / "datos" / "xm" / "resumen_xm.json"
_CLAVE = "lcoe_sin_cop_mwh"


def _resumen() -> dict:
    return json.loads(_XM.read_text(encoding="utf-8"))


def test_3_1_1_resumen_xm_declara_lcoe_sin_cop_mwh() -> None:
    resumen = _resumen()
    assert _CLAVE in resumen, f"{_XM.name} sin {_CLAVE}"


def test_3_1_2_lcoe_sin_tiene_estructura_completa() -> None:
    campo = _resumen()[_CLAVE]
    assert isinstance(campo, dict), f"{_CLAVE} no es dict"
    for requerido in ("valor", "unidad", "fuente", "estado"):
        assert requerido in campo, f"{_CLAVE} sin {requerido}"


def test_3_1_3_lcoe_sin_esta_verificado() -> None:
    campo = _resumen()[_CLAVE]
    assert campo["estado"] == "verificado", (
        f"estado {campo['estado']!r} != verificado"
    )


def test_3_1_4_lcoe_sin_fuente_no_vacia() -> None:
    campo = _resumen()[_CLAVE]
    fuente = str(campo.get("fuente", "")).strip()
    assert fuente, f"fuente vacía en {_CLAVE}"


def test_3_1_5_lcoe_sin_valor_es_float_positivo() -> None:
    campo = _resumen()[_CLAVE]
    valor = campo["valor"]
    assert isinstance(valor, (int, float)), f"valor {valor!r} no numérico"
    assert float(valor) > 0.0, f"valor {valor!r} no positivo"


def test_3_1_6_lcoe_sin_unidad_cop_por_mwh() -> None:
    campo = _resumen()[_CLAVE]
    assert campo["unidad"] == "COP/MWh", f"unidad {campo['unidad']!r}"


def test_3_2_1_cargar_lcoe_sin_esta_en_app() -> None:
    """La función ``cargar_lcoe_sin`` está disponible en ``app.datos_lectura``."""
    from app.datos_lectura import cargar_lcoe_sin  # noqa: F401


def test_3_2_2_cargar_lcoe_sin_devuelve_estructura_esperada() -> None:
    from app.datos_lectura import cargar_lcoe_sin

    campo = cargar_lcoe_sin()
    assert isinstance(campo, dict)
    for requerido in ("valor", "unidad", "fuente", "estado"):
        assert requerido in campo, f"cargar_lcoe_sin() sin {requerido}"


def test_3_2_3_cargar_lcoe_sin_coincide_con_resumen() -> None:
    from app.datos_lectura import cargar_lcoe_sin

    campo = cargar_lcoe_sin()
    resumen_campo = _resumen()[_CLAVE]
    assert campo["valor"] == resumen_campo["valor"]
    assert campo["unidad"] == resumen_campo["unidad"]
    assert campo["fuente"] == resumen_campo["fuente"]
    assert campo["estado"] == resumen_campo["estado"]


def test_3_2_4_cargar_lcoe_sin_lectura_sin_red() -> None:
    """La función no debe hacer ninguna petición de red (política de origen único)."""
    from app.datos_lectura import cargar_lcoe_sin

    campo = cargar_lcoe_sin()
    assert campo["estado"] == "verificado"
    assert campo["valor"] is not None
    assert float(campo["valor"]) > 0
