"""Pruebas de la ficha de Isla Fuerte: tres valores de densidad de potencia.

El sitio por defecto (Isla Fuerte) tiene un valor de diseño (8,9 kW/m
Ortega 2013, revisado por pares) y dos contrastes (ERA5-Ocean 0,5° y
Copernicus Marine 1/12°). Las pruebas verifican:

- Hay al menos tres campos que empiezan por `densidad_potencia`.
- El valor de diseño sigue siendo 8,9 kW/m y su estado es `verificado`.
- El nuevo campo `densidad_potencia_copernicus_1_12` está bien formado y
  declarado como `inferido`.
- El campo `discrepancia_densidad` declara los tres valores.

Tarea 5.3 del cambio `completar-huecos-migracion-web`.
"""

from __future__ import annotations

import json
import pathlib


_SITIO = pathlib.Path("datos/sitios/isla_fuerte.json")


def _sitio() -> dict:
    return json.loads(_SITIO.read_text(encoding="utf-8"))


def test_5_3_1_isla_fuerte_declara_al_menos_tres_densidades_potencia():
    data = _sitio()
    campos = [k for k in data if k.startswith("densidad_potencia")]
    assert len(campos) >= 3, (
        f"Isla Fuerte debe declarar >= 3 campos densidad_potencia*, hay: {campos}"
    )
    for requerido in (
        "densidad_potencia_media",
        "densidad_potencia_era5",
        "densidad_potencia_copernicus_1_12",
    ):
        assert requerido in data, f"Isla Fuerte sin {requerido}"


def test_5_3_2_valor_diseno_no_se_desplaza():
    data = _sitio()
    diseno = data["densidad_potencia_media"]
    assert diseno["valor"] == 8.9, f"valor de diseño cambió: {diseno['valor']}"
    assert diseno["estado"] == "verificado", (
        f"valor de diseño perdió estado verificado: {diseno['estado']}"
    )


def test_5_3_3_copernicus_1_12_tiene_resolucion_y_distancia():
    data = _sitio()
    c = data["densidad_potencia_copernicus_1_12"]
    assert c["estado"] == "inferido", c["estado"]
    assert c["unidad"] == "kW/m"
    assert "resolucion" in c and "distancia_celda_km" in c, c
    assert isinstance(c["valor"], (int, float))
    assert c["valor"] > 0


def test_5_3_4_discrepancia_declara_los_tres_valores():
    data = _sitio()
    disc = data.get("discrepancia_densidad")
    assert isinstance(disc, dict), "Isla Fuerte sin discrepancia_densidad"
    valores = disc.get("valores_kw_m", [])
    assert 8.9 in valores, valores
    assert disc.get("valor_diseno_kw_m") == 8.9
    assert len(valores) >= 3, f"discrepancia con menos de 3 valores: {valores}"