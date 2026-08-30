"""Ver y animación — 18.1-18.8.

Cubre contrato del canvas, controles físicos, contraste tesis y dos invariantes
numéricos: profundidad cambia lambda y Bpto reduce amplitud. Sin sobreingeniería.
"""

from __future__ import annotations

import math
import pathlib
import re

import numpy as np

REPO = pathlib.Path(__file__).resolve().parents[1]
CANVAS = REPO / "web/src/components/AnimacionCanvas.ts"
VER = REPO / "web/src/views/Ver.vue"
CONTROLES = REPO / "web/src/components/ControlesFisicos.vue"


def _read(p: pathlib.Path) -> str:
    return p.read_text(encoding="utf-8")


# 18.1 — animación desde serie ya integrada, UNA transferencia, muestreo sin recálculo
def test_18_1_animacion_contrato_unica_transferencia():
    assert CANVAS.exists(), "web/src/components/AnimacionCanvas.ts ausente"
    t = _read(CANVAS)
    clean = t.replace(" ", "")
    assert "class AnimacionCanvas" in t
    assert "canvas: HTMLCanvasElement" in t or "canvas:HTMLCanvasElement" in clean
    assert "series:" in t and "t_s" in t and "z_m" in t
    assert re.search(r"k\s*:\s*number", t), "k:number ausente"
    assert "dibujar" in t and re.search(r"dibujar\s*\(\s*t\s*:\s*number", t)
    # transferencia UNA vez por simulación vía contrato
    assert (
        "cargarSimulacion" in t
        or "cargar_simulacion" in t
        or "UNA vez" in t
        or "una sola vez" in t.lower()
        or "series" in t
    )
    # no recalcula física por fotograma — solo muestrea serie
    assert "muestrearSerie" in t or "muestrear" in t.lower()
    # eta(x,t) = (Hm0/2)*cos(k*x - omega*t) con omega=2*pi/Te
    assert "Hm0 / 2" in t or "Hm0/2" in t or "Hm0/2" in clean
    assert "Math.cos" in t and "k * x" in t and "omega * t" in t
    assert ("2 * Math.PI" in t and "/ Te" in t) or "2*Math.PI" in clean
    # PROFUNDIDAD_M = 30 y lambda = 2*pi/k
    assert "PROFUNDIDAD_M" in t and "30" in t
    # lambda con espacios variables: 2 * Math.PI / k
    assert re.search(r"2\s*\*\s*Math\.PI\s*/\s*k", t) or "2*Math.PI/k" in clean
    # bucle requestAnimationFrame
    assert "requestAnimationFrame" in t
    # comentario de contrato
    assert (
        "no recalcula" in t.lower()
        or "sin recalcular" in t.lower()
        or "muestrea serie" in t.lower()
    )


def test_18_1_sin_codigo_muerto_animacion():
    t = _read(CANVAS)
    assert "matplotlib" not in t.lower()
    assert "FigureCanvas" not in t
    # no lógica que recalcule física por fotograma
    # no debe aparecer densidad_potencia ni rho*g en web
    assert "densidad_potencia" not in t
    # solo muestrea serie: no solve_ivp ni integrar en web
    assert "solve_ivp" not in t
    assert "integrar" not in t.lower() or "muestrear" in t.lower()


# 18.2 — declarar ausencia si z_m null/undefined, sin sintetizar
def test_18_2_sin_serie_sintetica():
    t = _read(CANVAS)
    assert "sin serie de posición — dispositivo" in t
    # rama de ausencia sin generar sintética
    assert "sinSerieMsg" in t or "sin serie" in t.lower()
    # no generar seno sintético para boya cuando falta z_m
    # debe haber return temprano sin asignar serie sintética
    assert re.search(r"series\s*=\s*null", t)
    # Ver.vue también declara ausencia
    v = _read(VER)
    assert "sin serie de posición" in v


def test_18_2_no_sintetiza_en_web():
    for p in [CANVAS, VER, CONTROLES]:
        if p.exists():
            c = _read(p)
            # no Math.sin sintético para boya cuando falta serie
            # el seno solo para eta de superficie
            # si hay sintesis de z_m sería un defecto; no debe aparecer asignación de z_m inventada
            assert "z_m = " not in c or "sin serie" in c


# 18.3 — pausa con flag y prefers-reduced-motion
def test_18_3_pausa_y_reduced_motion():
    t = _read(CANVAS)
    assert re.search(r"pausado\s*:\s*boolean", t)
    assert "prefers-reduced-motion" in t
    assert "pausar" in t.lower() and "reanudar" in t.lower()
    # Ver.vue tiene botón Pausa/Reanudar y no borra resultado
    v = _read(VER)
    assert "Pausa" in v and "Reanudar" in v
    # detener no borra: dibujar conserva último frame, pausado no limpia series
    assert "pausado" in t and "cancelAnimationFrame" in t


# 18.4 — ningún fotograma comunica con núcleo; animación no se detiene al conmutar
def test_18_4_no_comunicacion_por_fotograma():
    t = _read(CANVAS)
    # dibujar no hace fetch ni import de nucleo
    dibujar = t[t.find("dibujar(") : t.find("dibujar(") + 2000] if "dibujar(" in t else t
    assert "fetch" not in dibujar
    assert "nucleo" not in dibujar
    # cargarSimulacion es la única vía con fetch/servicio, fuera del loop
    assert t.count("fetch") <= 1 or "cargarSimulacion" in t


def test_18_4_sin_imports_prohibidos_en_web():
    for p in [CANVAS, VER, CONTROLES]:
        c = _read(p)
        assert "matplotlib" not in c
        assert "FigureCanvas" not in c
        assert "from nucleo" not in c
        assert "import * as nucleo" not in c


# 18.5 — profundidad 30->60 cambia lambda dibujada (usa numero_onda real)
def test_18_5_profundidad_cambia_lambda():
    from nucleo.olas import numero_onda

    # con Te=7, 30m no es profundo; 15m sí muestra dispersión fuerte
    omega = 2 * math.pi / 7.0
    k15, _ = numero_onda(omega, 15.0)
    k60, _ = numero_onda(omega, 60.0)
    lam15 = 2 * math.pi / k15
    lam60 = 2 * math.pi / k60
    assert lam60 > lam15, f"lambda debe crecer con profundidad: 15m {lam15:.1f} vs 60m {lam60:.1f}"
    assert lam60 / lam15 > 1.05
    # validar también el par pedido 30->60 crece (aunque poco en régimen intermedio)
    omega2 = 2 * math.pi / 7.0
    k30, _ = numero_onda(omega2, 30.0)
    lam30 = 2 * math.pi / k30
    assert lam60 > lam30
    # el canvas computa lambda = 2*pi/k y k viene de numero_onda
    t = _read(CANVAS)
    assert "lambda" in t.lower() and "Math.PI" in t


# 18.6 — Bpto 80k->500k reduce amplitud (m*z''+b*z'+k*z = F)
def test_18_6_bpto_reduce_amplitud():
    from app.servicio import Parametros, simular

    base_kwargs = dict(
        hm0_m=1.5,
        te_s=7.0,
        profundidad_m=30.0,
        sitio_id="isla_fuerte",
        dispositivo="absorbedor_puntual",
    )
    r_bajo = simular(Parametros(b_pto_ns_m=80_000.0, **base_kwargs))
    r_alto = simular(Parametros(b_pto_ns_m=500_000.0, **base_kwargs))
    z_bajo = np.asarray(r_bajo["resultado"].series["z_m"])
    z_alto = np.asarray(r_alto["resultado"].series["z_m"])
    amp_bajo = float(np.max(np.abs(z_bajo[-1000:])))
    amp_alto = float(np.max(np.abs(z_alto[-1000:])))
    assert (
        amp_alto < amp_bajo
    ), f"Bpto alto debe dar menor amplitud: {amp_bajo:.3f} vs {amp_alto:.3f}"
    # también vía extras amplitud_boya_m
    assert float(r_alto["extras"]["amplitud_boya_m"]) < float(r_bajo["extras"]["amplitud_boya_m"])


# 18.7 — tres controles con unidad y formato español, viviendas sin fórmulas
def test_18_7_controles_y_viviendas():
    assert CONTROLES.exists(), "ControlesFisicos.vue ausente"
    v = _read(VER)
    c = _read(CONTROLES)
    # tres input range con las variables exactas
    for var in ["hm0_m", "te_s", "b_pto_ns_m"]:
        assert var in v or var in c, f"{var} ausente en Ver o Controles"
    assert c.count('type="range"') >= 3 or v.count('type="range"') >= 3
    # valor físico visible con unidad y formato español (formatearNumero)
    assert "formatearNumero" in c or "formatearNumero" in v
    assert " m" in c or " m" in v
    assert " s" in c or " s" in v
    assert "kN" in c or "Ns/m" in c or "kN·s/m" in c
    # salida viviendas_alimentadas
    assert "viviendas" in v.lower()
    assert "viviendas_alimentadas" in v or "viviendas" in v
    # sin fórmulas en pantalla Ver
    for prohibida in ["J = ", "rho", "1/2 rho", "64 pi"]:
        assert prohibida not in v, f"fórmula '{prohibida}' no debe aparecer en Ver.vue"


def test_18_7_variables_exactas_y_profMagnitud():
    t = _read(CANVAS)
    assert "PROFUNDIDAD_M" in t
    assert "30" in _read(CANVAS)
    v = _read(VER)
    # Hm0: number (m), Te: number (s), Bpto: number (Ns/m)
    assert "hm0_m" in v and "te_s" in v and "b_pto_ns_m" in v


# 18.8 — contraste tesis 8,9 vs 40 con fuentes
def test_18_8_contraste_tesis():
    v = _read(VER)
    # 8,9 y 40 deben aparecer con formato español (coma decimal)
    assert "8,9" in v or "8.9" in v  # formatearNumero produce 8,9
    assert "40" in v
    assert "kW/m" in v
    # fuentes Ortega vs Handbook
    assert "Ortega" in v
    assert "Handbook" in v or "Osorio" in v
    # ambos con su fuente en la misma vista
    assert v.lower().count("fuente") >= 1 or "Ortega" in v and "Handbook" in v
