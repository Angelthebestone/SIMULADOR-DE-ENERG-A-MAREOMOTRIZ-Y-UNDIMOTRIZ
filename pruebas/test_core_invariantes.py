import math

import numpy as np


def test_7_01_captura_no_supera_incidente():
    from nucleo.dispositivos.absorbedor import AbsorbedorPuntual
    from nucleo.dispositivos.base import ContextoRecurso
    from nucleo.dispositivos.owc import OWC
    from nucleo.dispositivos.turbina_corriente import TurbinaCorriente

    for dev in [AbsorbedorPuntual(), OWC(), TurbinaCorriente()]:
        r = dev.resolver({"hm0": 2.0, "te": 6.0, "velocidad_ms": 2.0}, ContextoRecurso())
        cap = r.eslabones[0]
        assert cap.potencia_salida_w <= cap.potencia_entrada_w + 1e-9


def test_7_02_ancho_captura_lambda_2pi():
    from nucleo.dispositivos.absorbedor import AbsorbedorPuntual
    from nucleo.dispositivos.base import ContextoRecurso
    from nucleo.olas import longitud_onda

    dev = AbsorbedorPuntual()
    r = dev.resolver({"hm0": 1.5, "te": 6.0}, ContextoRecurso(profundidad_m=50))
    lam = longitud_onda(2 * math.pi / 6.0, 50.0, 9.81)
    ancho = r.eslabones[0].detalle["ancho_captura_m"]
    assert ancho <= lam / (2 * math.pi) + 1e-9


def test_7_03_rendimientos_0_1():
    from nucleo.dispositivos.absorbedor import AbsorbedorPuntual
    from nucleo.dispositivos.base import ContextoRecurso

    r = AbsorbedorPuntual().resolver({"hm0": 2.0, "te": 8.0}, ContextoRecurso())
    for e in r.eslabones:
        assert 0.0 <= e.rendimiento <= 1.0


def test_7_04_balance_volumen_embalse():
    from nucleo.dispositivos.base import ContextoRecurso
    from nucleo.dispositivos.embalse import EmbalseMareal

    r = EmbalseMareal().resolver({"rango_m": 3.28}, ContextoRecurso())
    err = r.eslabones[0].detalle.get("balance_err_m3", 0)
    vol = r.eslabones[0].detalle.get("vol_turbinado_m3", 0)
    assert math.isfinite(err)
    assert abs(err) / max(abs(vol), 1) < 1e-6 or abs(err) < 1e3


def test_7_05_integrador_converge():
    from nucleo.integradores import integrar_adaptativo

    def fun(t, y):
        return np.array([y[1], -4 * y[0] - 0.5 * y[1]])

    errs = []
    prev = None
    for n in [200, 400, 800]:
        teval = np.linspace(0, 10, n)
        _, y = integrar_adaptativo(fun, (0, 10), np.array([1.0, 0.0]), t_eval=teval)
        val = float(y[0, -1])
        if prev is not None:
            errs.append(abs(val - prev))
        prev = val
    assert len(errs) == 2
    assert errs[1] < errs[0] or errs[1] < 1e-6


def test_7_06_matriz_ocurrencia_suma_uno():
    from analisis.aep import matriz_dispersion_desde_serie

    hs = np.random.default_rng(0).uniform(0.5, 3.0, 1000)
    te = np.random.default_rng(1).uniform(4, 12, 1000)
    m = matriz_dispersion_desde_serie(hs, te)
    assert abs(m.ocurrencia.sum() - 1.0) < 1e-3


def test_7_07_factor_planta_coherente():
    from nucleo.dispositivos.absorbedor import AbsorbedorPuntual
    from nucleo.dispositivos.base import ContextoRecurso

    r = AbsorbedorPuntual().resolver({"hm0": 2.0, "te": 8.0}, ContextoRecurso())
    assert (
        abs(r.factor_planta - (r.produccion_anual_mwh * 1e6 / (r.potencia_nominal_w * 8766.0)))
        < 1e-9
    )


def test_7_08_handbook_999():
    from analisis.aep import regla_pulgar_handbook

    r = regla_pulgar_handbook(40, 15, 0.20, 0.95)
    assert abs(r.aep_mwh - 999.324) < 1.0


def test_7_09_orbital_o2():
    from nucleo.dispositivos.turbina_corriente import potencia_turbina_w

    p = potencia_turbina_w(3.0, 20, 0.40)
    assert abs(p - 1.74e6) / 1.74e6 < 0.05


def test_7_10_reconstruccion_marea_caribe():
    from nucleo.mareas import (
        ajustar_constituyentes,
        cociente_sicigia_cuadratura,
        rango_reconstruido_vs_medido,
    )

    ajuste = ajustar_constituyentes(oceano="caribe")
    assert ajuste is not None
    assert cociente_sicigia_cuadratura(ajuste.constituyentes) > 1.5
    comp = rango_reconstruido_vs_medido("caribe")
    assert comp["error_relativo"] < 0.15


def test_7_11_nucleo_no_importa_interfaz():
    import pathlib

    for p in pathlib.Path("nucleo").rglob("*.py"):
        txt = p.read_text(encoding="utf-8")
        assert "import interfaz" not in txt
        assert "from interfaz" not in txt
        assert "PySide6" not in txt
    for p in pathlib.Path("analisis").rglob("*.py"):
        txt = p.read_text(encoding="utf-8")
        assert "import interfaz" not in txt
        assert "PySide6" not in txt


def test_7_12_nucleo_sin_gui():
    import subprocess
    import sys

    code = "import nucleo.olas, nucleo.corrientes, nucleo.dispositivos.absorbedor; print('ok')"
    r = subprocess.run([sys.executable, "-c", code], capture_output=True, text=True, timeout=10)
    assert r.returncode == 0


def test_7_13_la_rance():
    from analisis.aep import validacion_la_rance

    v = validacion_la_rance()
    assert abs(v["e_anual_teorica_gwh"] - 1435.44) / 1435.44 < 0.05
    assert 0.30 < v["rendimiento_ciclo"] < 0.45
    assert "orden magnitud" in v["rotulo"]


def test_7_14_energia_integrada_mayor():
    from nucleo.corrientes import energia_por_integracion

    t = np.linspace(0, 30 * 86400, 2880)
    vel = 1.5 + 1.0 * np.cos(2 * math.pi * t / 44714) + 0.5 * np.cos(2 * math.pi * t / 43200)
    res = energia_por_integracion(t, vel, 1, 0.40)
    assert res.energia_integrada_j > res.energia_vel_media_j
    assert res.metodo_valido == "integracion de V(t)^3 sobre la serie"


def test_7_15_jonswap_gamma1_pierson():
    import numpy as np

    from nucleo.espectros import (
        espectro_jonswap,
        espectro_jonswap_para_hm0_te,
        espectro_pierson_moskowitz,
        parametros_desde_espectro,
    )

    omega = np.linspace(0.2, 2, 500)
    wp = 2 * math.pi / 8
    pm = espectro_pierson_moskowitz(omega, wp)
    jm = espectro_jonswap(omega, wp, gamma=1.0)
    assert np.max(np.abs(pm - jm)) / np.max(pm) < 0.01
    hm0, te = 2.0, 8.0
    omega2 = np.linspace(0.05, 3, 800)
    s = espectro_jonswap_para_hm0_te(omega2, hm0, te, gamma=1.0)
    rec = parametros_desde_espectro(omega2, s)
    assert abs(rec.hm0 - hm0) / hm0 < 0.01
    assert abs(rec.te - te) / te < 0.01
