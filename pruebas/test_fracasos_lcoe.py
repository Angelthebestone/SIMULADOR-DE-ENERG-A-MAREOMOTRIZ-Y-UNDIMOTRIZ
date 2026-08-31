"""Tarea 2.2 — Verifica que cada ficha de fracaso tiene LCOE estimado.

Cada JSON en ``datos/fracasos/`` debe llevar ``lcoe_estimado_cop_mwh`` con la
forma ``{valor, unidad, fuente, estado}``. El ``estado`` debe ser
``verificado`` o ``pendiente``; cuando es ``verificado`` el ``valor`` debe
ser float positivo y la ``fuente`` no puede estar vacía.
"""

from __future__ import annotations

import json
import pathlib

_RAIZ = pathlib.Path(__file__).resolve().parent.parent
_FRACASOS = _RAIZ / "datos" / "fracasos"
_ESTADOS_VALIDOS = {"verificado", "pendiente"}
_CLAVE = "lcoe_estimado_cop_mwh"


def _fichas() -> list[tuple[pathlib.Path, dict]]:
    out: list[tuple[pathlib.Path, dict]] = []
    for ruta in sorted(_FRACASOS.glob("*.json")):
        out.append((ruta, json.loads(ruta.read_text(encoding="utf-8"))))
    return out


def test_2_2_1_cada_ficha_declara_lcoe_estimado() -> None:
    """Todos los JSON de fracasos llevan la clave ``lcoe_estimado_cop_mwh``."""
    for ruta, ficha in _fichas():
        assert _CLAVE in ficha, f"{ruta.name} sin {_CLAVE}"


def test_2_2_2_estructura_tiene_los_cuatro_campos() -> None:
    """El campo expone ``valor``, ``unidad``, ``fuente`` y ``estado``."""
    for ruta, ficha in _fichas():
        campo = ficha.get(_CLAVE, {})
        assert isinstance(campo, dict), f"{ruta.name}:{_CLAVE} no es dict"
        for requerido in ("valor", "unidad", "fuente", "estado"):
            assert requerido in campo, f"{ruta.name}:{_CLAVE} sin {requerido}"


def test_2_2_3_estado_es_verificado_o_pendiente() -> None:
    for ruta, ficha in _fichas():
        estado = str(ficha[_CLAVE]["estado"])
        assert estado in _ESTADOS_VALIDOS, (
            f"{ruta.name}: estado {estado!r} no está en {_ESTADOS_VALIDOS}"
        )


def test_2_2_4_fuente_no_vacia() -> None:
    """La fuente debe declarar de dónde sale el dato (incluso si es pendiente)."""
    for ruta, ficha in _fichas():
        fuente = str(ficha[_CLAVE].get("fuente", "")).strip()
        assert fuente, f"{ruta.name}: fuente vacía"


def test_2_2_5_unidad_es_cop_por_mwh() -> None:
    for ruta, ficha in _fichas():
        unidad = str(ficha[_CLAVE].get("unidad", ""))
        assert unidad == "COP/MWh", f"{ruta.name}: unidad {unidad!r}"


def test_2_2_6_verificado_lleva_valor_float_positivo() -> None:
    """Cuando el estado es ``verificado``, el valor es float > 0."""
    for ruta, ficha in _fichas():
        campo = ficha[_CLAVE]
        if campo["estado"] != "verificado":
            continue
        valor = campo["valor"]
        assert isinstance(valor, (int, float)), (
            f"{ruta.name}: valor no numérico {valor!r}"
        )
        assert float(valor) > 0.0, f"{ruta.name}: valor no positivo {valor!r}"


def test_2_2_7_pendiente_lleva_valor_none() -> None:
    """Cuando el estado es ``pendiente``, el valor es ``None`` (no inventar cifras)."""
    for ruta, ficha in _fichas():
        campo = ficha[_CLAVE]
        if campo["estado"] != "pendiente":
            continue
        assert campo["valor"] is None, (
            f"{ruta.name}: pendiente con valor no nulo {campo['valor']!r}"
        )


def test_2_2_8_cubre_los_cinco_fracasos_esperados() -> None:
    """Los cinco fracasos conocidos están en el directorio."""
    ids = {ficha.get("id") for _, ficha in _fichas()}
    esperados = {"pelamis_p2", "oyster_800", "seagen", "annapolis_royal", "limpet"}
    assert esperados.issubset(ids), (
        f"Faltan fracasos: {esperados - ids}; encontrados: {ids}"
    )
