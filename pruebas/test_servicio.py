"""Servicio - supuestos editables (tareas 1.1 y 1.2 del change densificar-interfaz-visual).

Verifica que Parametros acepta eta_pto, eta_gen, crf, rho con defaults identicos a
los hard-coded y que propagan al calculo de potencia, AEP y LCOE con monotonía.
"""

from __future__ import annotations

import pytest

from analisis.economia import DIESEL_ISLA_FUERTE_COP_KWH, ResultadoLCOE, calcular_lcoe
from app.servicio import Parametros, economia_completa, simular


PARAMS_BASE = Parametros()


def test_parametros_tiene_cuatro_campos_nuevos() -> None:
    campos = {"eta_pto", "eta_gen", "crf", "rho"}
    presentes = set(Parametros.__dataclass_fields__)
    assert campos <= presentes, f"faltan {campos - presentes} en Parametros"


def test_parametros_retrocompatible_sin_argumentos() -> None:
    p = Parametros()
    assert p.eta_pto == 0.65
    assert p.eta_gen == 0.90
    assert p.crf == 0.08
    assert p.rho == 1_025.0


def test_parametros_construir_con_todos_los_campos() -> None:
    p = Parametros(eta_pto=0.80, eta_gen=0.95, crf=0.12, rho=1030.0)
    assert p.eta_pto == 0.80
    assert p.eta_gen == 0.95
    assert p.crf == 0.12
    assert p.rho == 1030.0


def test_rejilla_eta_pto_monotona_potencia() -> None:
    """Mas eta_pto -> mas potencia electrica entregada (monotonia creciente)."""
    muestras: list[float] = []
    for eta_pto in (0.40, 0.55, 0.70, 0.85, 0.95):
        params = Parametros(eta_pto=eta_pto)
        salida = simular(params)
        resultado = salida["resultado"]
        assert resultado.eslabones, f"sin eslabones para eta_pto={eta_pto}"
        muestras.append(float(resultado.eslabones[-1].potencia_salida_w))
    for i in range(len(muestras) - 1):
        assert muestras[i + 1] > muestras[i], (
            f"potencia no monotona creciente en eta_pto: {muestras}"
        )


def test_rejilla_eta_gen_monotona_potencia() -> None:
    """Mas eta_gen -> mas potencia electrica entregada (monotonia creciente)."""
    muestras: list[float] = []
    for eta_gen in (0.70, 0.80, 0.90, 0.95):
        params = Parametros(eta_gen=eta_gen)
        salida = simular(params)
        resultado = salida["resultado"]
        assert resultado.eslabones
        muestras.append(float(resultado.eslabones[-1].potencia_salida_w))
    for i in range(len(muestras) - 1):
        assert muestras[i + 1] > muestras[i], (
            f"potencia no monotona creciente en eta_gen: {muestras}"
        )


def test_rejilla_crf_monotona_lcoe() -> None:
    """Mas crf -> mas LCOE (monotonia creciente en CRF)."""
    capex = 6_000_000_000.0
    opex = 200_000_000.0
    aep = 50.0
    muestras: list[float] = []
    for crf in (0.05, 0.08, 0.10, 0.12, 0.15):
        ec = economia_completa(
            aep_mwh=aep,
            capex_cop=capex,
            opex_anual_cop=opex,
            potencia_kw=750.0,
            masa_t=80.0,
            crf=crf,
        )
        assert ec["estado"] == "listo"
        assert isinstance(ec["lcoe"], ResultadoLCOE)
        muestras.append(float(ec["lcoe"].lcoe_cop_mwh))
    for i in range(len(muestras) - 1):
        assert muestras[i + 1] > muestras[i], (
            f"LCOE no monotono creciente en crf: {muestras}"
        )


def test_rejilla_tasa_descuento_monotona_lcoe() -> None:
    """Mas tasa_descuento -> CRF más alto -> LCOE más alto (monotonia creciente)."""
    muestras: list[float] = []
    for tasa in (0.04, 0.08, 0.12, 0.16):
        lcoe = calcular_lcoe(
            capex_cop=6_000_000_000.0,
            opex_anual_cop=200_000_000.0,
            aep_mwh=50.0,
            vida_anos=20,
            tasa_descuento=tasa,
        )
        muestras.append(float(lcoe.lcoe_cop_mwh))
    for i in range(len(muestras) - 1):
        assert muestras[i + 1] > muestras[i], (
            f"LCOE no monotono creciente en tasa_descuento: {muestras}"
        )


def test_regresion_defaults_equivalentes_a_antes() -> None:
    """Defaults de Parametros reproducen el comportamiento previo."""
    p = Parametros()
    assert p.eta_pto == 0.65
    assert p.eta_gen == 0.90
    assert p.crf == 0.08
    assert p.rho == 1_025.0
    salida = simular(p)
    assert salida["resultado"].eslabones
    assert salida["resultado"].produccion_anual_mwh >= 0.0


def test_regresion_eco_completa_sin_crf_explicito() -> None:
    """economia_completa sin crf explicito usa tasa_descuento=0.08 (default previo)."""
    ec = economia_completa(
        aep_mwh=50.0,
        capex_cop=6_000_000_000.0,
        opex_anual_cop=200_000_000.0,
        potencia_kw=750.0,
        masa_t=80.0,
    )
    assert ec["estado"] == "listo"
    lcoe_ref = calcular_lcoe(
        6_000_000_000.0, 200_000_000.0, 50.0, vida_anos=20, tasa_descuento=0.08
    )
    assert abs(ec["lcoe"].lcoe_cop_mwh - lcoe_ref.lcoe_cop_mwh) < 1e-6


def test_rho_propagado_a_contexto_recurso() -> None:
    """rho de Parametros llega a ContextoRecurso dentro del flujo de simular."""
    p = Parametros(rho=1_035.0)
    salida = simular(p)
    ctx = salida["resultado"].metadatos.get("contexto", {})
    assert ctx.get("rho") == 1_035.0


def test_rho_no_propaga_a_simular_sin_cambios() -> None:
    """rho por defecto 1_025 se mantiene en ContextoRecurso cuando no se cambia."""
    p = Parametros()
    salida = simular(p)
    ctx = salida["resultado"].metadatos.get("contexto", {})
    assert ctx.get("rho") == 1_025.0


@pytest.mark.parametrize("eta_pto", [0.30, 0.50, 0.70, 0.90, 0.99])
def test_eta_pto_rejilla_completa(eta_pto: float) -> None:
    """Rejilla densa: cada valor produce un Resultado valido y potencia no-negativa."""
    params = Parametros(eta_pto=eta_pto)
    salida = simular(params)
    resultado = salida["resultado"]
    assert resultado.eslabones
    p_entregada = float(resultado.eslabones[-1].potencia_salida_w)
    assert p_entregada >= 0.0
    assert p_entregada <= float(resultado.potencia_nominal_w) + 1e-9


@pytest.mark.parametrize("rho", [990.0, 1_000.0, 1_025.0, 1_035.0, 1_050.0])
def test_rho_rejilla_completa(rho: float) -> None:
    """Rejilla de rho (agua dulce a salada densa): cada valor produce resultado valido."""
    params = Parametros(rho=rho)
    salida = simular(params)
    resultado = salida["resultado"]
    assert resultado.eslabones
    ctx = resultado.metadatos.get("contexto", {})
    assert ctx.get("rho") == rho