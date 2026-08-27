import numpy as np


def test_val_handbook_999():
    from analisis.aep import regla_pulgar_handbook

    r = regla_pulgar_handbook(40, 15, 0.20, 0.95)
    assert abs(r.aep_mwh - 999.324) < 2


def test_val_isla_fuerte_222():
    from analisis.aep import regla_pulgar_handbook

    r = regla_pulgar_handbook(8.9, 15, 0.20, 0.95)
    assert abs(r.aep_mwh - 222) < 3


def test_val_orbital_o2():
    from nucleo.dispositivos.turbina_corriente import potencia_turbina_w

    assert abs(potencia_turbina_w(3.0, 20, 0.40) - 1.74e6) / 1.74e6 < 0.05


def test_val_corriente_32_y_5535():
    from nucleo.corrientes import potencia_corriente

    assert abs(potencia_corriente(0.54, 1, 0.40) - 32.3) / 32.3 < 0.02
    assert abs(potencia_corriente(3.0, 1, 0.40) - 5535) / 5535 < 0.01
    assert abs((5535 / 32.3) - 171) / 171 < 0.05


def test_val_J_15_7():
    from nucleo.olas import densidad_potencia_w_m

    assert abs(densidad_potencia_w_m(2.0, 8.0) - 15700) / 15700 < 0.02


def test_val_rango_mareal():
    import json
    import pathlib

    sitio = json.loads(pathlib.Path("datos/sitios/isla_fuerte.json").read_text(encoding="utf-8"))
    val = sitio["rango_mareal_medio"]["valor"]
    assert 0.3 < val < 0.35
    assert 105 < (3.28 / 0.31) ** 2 < 120


def test_val_la_rance():
    from analisis.aep import validacion_la_rance

    v = validacion_la_rance()
    assert abs(v["e_anual_teorica_gwh"] - 1435.44) < 80
    assert 0.30 < v["rendimiento_ciclo"] < 0.40


def test_val_jonswap_gamma1():
    from nucleo.espectros import espectro_jonswap, espectro_pierson_moskowitz

    w = np.linspace(0.2, 2, 600)
    wp = 2 * np.pi / 8
    pm = espectro_pierson_moskowitz(w, wp)
    jm = espectro_jonswap(w, wp, gamma=1.0)
    assert float(np.max(np.abs(pm - jm)) / np.max(pm)) < 0.01
