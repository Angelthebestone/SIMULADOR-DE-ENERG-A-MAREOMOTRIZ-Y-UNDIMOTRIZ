import math


def test_dispersion_convergencia():
    from nucleo.olas import numero_onda

    te = 8.0
    w = 2 * math.pi / te
    k, it = numero_onda(w, 30.0, 9.81)
    resid = abs(w * w - 9.81 * k * math.tanh(k * 30.0))
    assert resid < 1e-10
    assert it >= 1


def test_potencia_J_cuadratica():
    from nucleo.olas import densidad_potencia_w_m

    j1 = densidad_potencia_w_m(1.0, 8.0)
    j2 = densidad_potencia_w_m(2.0, 8.0)
    assert abs(j2 / j1 - 4) < 1e-3


def test_conversion_tp_te_ida_vuelta():
    from nucleo.olas import te_a_tp, tp_a_te

    tp = 9.0
    assert abs(te_a_tp(tp_a_te(tp)) - tp) / tp < 1e-4


def test_cg_profundo():
    from nucleo.olas import celeridad_fase, velocidad_grupo

    w = 2 * math.pi / 8
    cg = velocidad_grupo(w, 200, 9.81)
    c = celeridad_fase(w, 200, 9.81)
    assert abs(cg - c / 2) / (c / 2) < 0.02


def test_cg_somero():
    from nucleo.olas import velocidad_grupo

    w = 2 * math.pi / 8
    cg = velocidad_grupo(w, 1.0, 9.81)
    assert abs(cg - math.sqrt(9.81 * 1.0)) / math.sqrt(9.81 * 1.0) < 0.06
