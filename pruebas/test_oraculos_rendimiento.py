"""Oraculos de rendimiento 4.1-4.3, 4.5 — analisis/captura, matriz potencia, corrientes vs MHKiT.

Requisito: validacion-referencia / Metricas de rendimiento contrastadas contra la norma IEC.
Solo compara, no sustituye. Si mhkit no esta instalado, se omite con motivo legible.
"""

from __future__ import annotations

import importlib.util
import math
import pathlib

import numpy as np
import pytest

TOL_CAPTURA_REL = 1e-9
TOL_MATRIZ_REL = 1e-9
TOL_CORRIENTE_REL = 1e-9


def _servicio():  # type: ignore[no-redef]
    if importlib.util.find_spec("app.servicio") is not None:
        import app.servicio as svc  # type: ignore[no-redef]

        return svc, "app/servicio.py"
    import importlib as _il

    svc2 = _il.import_module("interfaz.calculo")
    return svc2, "interfaz/calculo.py"


def test_4_1_ancho_captura_coincide_con_mhkit():
    pytest.importorskip("mhkit", reason="mhkit no instalado — instala con pip install -e \".[dev]\" (requiere statsmodels)")
    try:
        from mhkit.wave.performance import capture_width as mhkit_cw
    except Exception as e:
        pytest.skip(f"mhkit.wave.performance no importable: {e}")

    from analisis.captura import ancho_captura

    casos = [
        (5000.0, 2000.0),
        (15000.0, 3000.0),
        (0.0, 1000.0),
        (1e6, 50000.0),
        (222.0 * 1e3, 8900.0),
    ]
    for p_abs, j in casos:
        raw = mhkit_cw(np.array([p_abs]), np.array([j]), to_pandas=False)
        cw_mhkit_val = float(np.asarray(raw).squeeze())
        cw_nucleo = ancho_captura(p_abs, j)
        assert cw_nucleo == pytest.approx(cw_mhkit_val, rel=TOL_CAPTURA_REL), (
            f"ancho_captura desvia: nucleo {cw_nucleo:.6f} vs MHKiT {cw_mhkit_val:.6f} "
            f"para P={p_abs} J={j} (L=P/J, IEC TS 62600-100)"
        )


def test_4_2_matriz_potencia_vs_mhkit_anclada_a_servicio():
    pytest.importorskip("mhkit", reason="mhkit no instalado")
    try:
        from mhkit.wave.performance import capture_width as mhkit_cw
        from mhkit.wave.performance import power_matrix as mhkit_pm
    except Exception as e:
        pytest.skip(f"mhkit.wave.performance no importable: {e}")

    from analisis.captura import ancho_captura
    from nucleo.olas import densidad_potencia_w_m

    svc, ruta = _servicio()
    assert hasattr(svc, "_matriz_potencia") or hasattr(svc, "simular"), f"servicio en {ruta} sin _matriz_potencia ni simular"
    assert "interfaz/calculo" not in ruta or not pathlib.Path("app/servicio.py").exists(), (
        f"oraculo anclado a {ruta} que es ruta declarada para retirada (migrar-interfaz-a-web-y-ampliar-fuentes fase 0.5); "
        f"debe apuntar a app/servicio.py cuando existe"
    )

    hs_centros = np.array([0.25, 0.75, 1.25, 1.75, 2.25, 3.25])
    te_centros = np.array([2.0, 4.5, 5.5, 6.5, 7.5, 10.0])

    from nucleo.dispositivos.absorbedor import AbsorbedorPuntual
    from nucleo.dispositivos.base import ContextoRecurso

    dev = AbsorbedorPuntual()
    ctx = ContextoRecurso(profundidad_m=30.0)

    j_mat = np.zeros((len(hs_centros), len(te_centros)))
    p_mat = np.zeros_like(j_mat)
    cw_mat = np.zeros_like(j_mat)

    for i, hs in enumerate(hs_centros):
        for j, te in enumerate(te_centros):
            j_w_m = densidad_potencia_w_m(float(hs), float(te))
            res = dev.resolver({"hm0": float(hs), "te": float(te)}, ctx)
            p_w = float(res.eslabones[-1].potencia_salida_w) if res.eslabones else 0.0
            cw = ancho_captura(p_w, j_w_m) if j_w_m > 0 else 0.0
            cw_mhkit = float(np.asarray(mhkit_cw(np.array([p_w]), np.array([j_w_m]), to_pandas=False)).squeeze())
            assert cw == pytest.approx(cw_mhkit, rel=TOL_CAPTURA_REL), (
                f"CW celda Hs={hs} Te={te} desvia nucleo {cw:.4f} vs MHKiT {cw_mhkit:.4f}"
            )
            j_mat[i, j] = j_w_m
            p_mat[i, j] = p_w
            cw_mat[i, j] = cw

    import pandas as pd
    import xarray as xr

    cw_da = xr.DataArray(cw_mat, dims=["Hm0", "Te"], coords={"Hm0": hs_centros, "Te": te_centros})
    j_da = xr.DataArray(j_mat, dims=["Hm0", "Te"], coords={"Hm0": hs_centros, "Te": te_centros})
    pm_mhkit = mhkit_pm(cw_da, j_da)
    if isinstance(pm_mhkit, (pd.DataFrame,)):
        pm_mhkit_vals = pm_mhkit.values
    else:
        pm_mhkit_vals = np.asarray(pm_mhkit.values if hasattr(pm_mhkit, "values") else pm_mhkit)

    assert pm_mhkit_vals.shape == p_mat.shape
    rel = np.abs(pm_mhkit_vals - p_mat) / np.maximum(np.abs(p_mat), 1.0)
    max_rel = float(np.max(rel))
    assert max_rel < TOL_MATRIZ_REL, (
        f"matriz de potencia desvia max_rel={max_rel:.4f} > {TOL_MATRIZ_REL}; "
        f"MHKiT power_matrix(CWM,JM)=CWM*JM debe coincidir con P=CW*J cedula a cedula (IEC TS 62600-100)"
    )

    if hasattr(svc, "_matriz_potencia"):
        import threading

        params = svc.Parametros(hm0_m=1.5, te_s=7.0, dispositivo="absorbedor_puntual")
        hs_test = np.array([1.0, 2.0])
        te_test = np.array([6.0, 8.0])
        mat = svc._matriz_potencia(params, hs_test, te_test, lambda _: None, threading.Event())
        assert mat is not None and mat.shape == (2, 2)
        assert np.all(mat >= 0)


def test_4_3_metricas_corriente_vs_mhkit():
    pytest.importorskip("mhkit", reason="mhkit no instalado")
    try:
        from mhkit.river.performance import circular as mhkit_circular
        from mhkit.river.performance import power_coefficient as mhkit_cp
        from mhkit.tidal.performance import circular as mhkit_circular_tidal
    except Exception as e:
        pytest.skip(f"mhkit river/tidal no importable: {e}")

    from nucleo.constantes import RHO_AGUA_MAR
    from nucleo.corrientes import potencia_corriente
    from nucleo.dispositivos.turbina_corriente import area_barrida_m2

    for d in [5.0, 10.0, 20.0]:
        area_nuc = area_barrida_m2(d)
        _, area_mhkit = mhkit_circular(d)
        assert area_nuc == pytest.approx(area_mhkit, rel=TOL_CORRIENTE_REL), (
            f"area barrida D={d} nucleo {area_nuc:.4f} vs MHKiT {area_mhkit:.4f} (IEC TS 62600-200 circular)"
        )
        _, area_tidal = mhkit_circular_tidal(d)
        assert area_mhkit == pytest.approx(area_tidal, rel=TOL_CORRIENTE_REL)

    for v, d, cp in [(0.54, 10.0, 0.40), (1.5, 20.0, 0.35), (3.0, 20.0, 0.40), (2.5, 15.0, 0.45)]:
        area = area_barrida_m2(d)
        p_nuc = float(potencia_corriente(v, area, cp, RHO_AGUA_MAR))
        p_inc = 0.5 * RHO_AGUA_MAR * area * abs(v) ** 3
        cp_mhkit = float(np.asarray(mhkit_cp(np.array([p_nuc]), np.array([v]), area, RHO_AGUA_MAR)).squeeze())
        assert cp_mhkit == pytest.approx(cp, rel=TOL_CORRIENTE_REL), (
            f"Cp corriente desvia nucleo Cp={cp} vs MHKiT power_coefficient={cp_mhkit:.4f} "
            f"para V={v} D={d} area={area:.1f} (P=0.5 rho Cp A V^3, Betz 16/27)"
        )
        p_mhkit_inv = float(cp * p_inc)
        assert p_nuc == pytest.approx(p_mhkit_inv, rel=TOL_CORRIENTE_REL)

    t = np.linspace(0, 30 * 86400, 2880)
    vel = 1.5 + 1.0 * np.cos(2 * math.pi * t / 44714) + 0.5 * np.cos(2 * math.pi * t / 43200)
    from nucleo.corrientes import energia_por_integracion

    res = energia_por_integracion(t, vel, area_barrida_m2(10.0), 0.40, RHO_AGUA_MAR)
    dt = np.mean(np.diff(t))
    pot_serie = 0.5 * RHO_AGUA_MAR * area_barrida_m2(10.0) * 0.40 * np.abs(vel) ** 3
    e_trapz = float(np.trapezoid(pot_serie, t))
    assert res.energia_integrada_j == pytest.approx(e_trapz, rel=1e-9), (
        f"energia integrada desvia {res.energia_integrada_j:.1f} vs trapz {e_trapz:.1f}"
    )
    assert res.energia_integrada_j > res.energia_vel_media_j, "integracion V^3 debe superar cubo de la media"


def test_4_5_ninguna_prueba_apunta_a_ruta_para_retirada():  # noqa: C901
    """Falla si alguna prueba importa una ruta declarada para retirada (fase 2).

    Rutas para retirada = presentacion PySide6: app.py, paneles.py, mapa.py, graficas.py,
    sankey.py, estilo.py dentro de interfaz/. La capa de servicio interfaz/calculo.py NO
    esta en esa lista (fase 0.5 la reubica a app/servicio.py).
    Permitidos en allowlist temporal hasta 7.3: los tres stress que aun importan interfaz.
    """
    RETIRADA_MODULOS = {
        "interfaz.app",
        "interfaz.paneles",
        "interfaz.mapa",
        "interfaz.graficas",
        "interfaz.sankey",
        "interfaz.estilo",
    }
    RETIRADA_RUTAS = {m.replace(".", "/") + ".py" for m in RETIRADA_MODULOS}
    allowlist = {
        "test_stress_core.py": {"interfaz.calculo"},
        "test_stress_datos.py": {"interfaz.calculo", "interfaz.mapa"},
        "test_stress_rendimiento.py": {"interfaz.calculo", "interfaz.app", "interfaz.graficas"},
        "test_core_invariantes.py": set(),
        "test_stress_interfaz.py": RETIRADA_MODULOS,
        "test_interfaz_bloqueC.py": RETIRADA_MODULOS,
    }
    import re

    raiz = pathlib.Path("pruebas")
    offenders: list[str] = []
    pat_import = re.compile(r"^\s*(?:from|import)\s+([a-zA-Z0-9_.]+)")
    for p in sorted(raiz.glob("test_*.py")):
        if p.name == "test_oraculos_rendimiento.py":
            continue
        txt = p.read_text(encoding="utf-8", errors="ignore")
        permitidos = allowlist.get(p.name, set())
        for line in txt.splitlines():
            m = pat_import.match(line)
            if not m:
                continue
            mod = m.group(1).strip()
            if mod in RETIRADA_MODULOS and mod not in permitidos:
                offenders.append(f"{p.name}: importa {mod} — ruta {mod.replace('.', '/')}.py declarada para retirada (fase 2)")
            if mod.startswith("interfaz.") and mod not in RETIRADA_MODULOS and mod != "interfaz.calculo":
                if mod in RETIRADA_MODULOS:
                    offenders.append(f"{p.name}: importa {mod}")
        for ruta in RETIRADA_RUTAS:
            if f'"{ruta}"' in txt or f"'{ruta}'" in txt:
                if ruta.replace("/", ".").removesuffix(".py") not in permitidos:
                    offenders.append(f'{p.name}: menciona ruta retiranda "{ruta}" como cadena')

    new_oracles = ["test_oraculos_espectros.py", "test_oraculos_rendimiento.py"]
    for name in new_oracles:
        p = raiz / name
        if not p.exists():
            continue
        txt = p.read_text(encoding="utf-8", errors="ignore")
        for mod in RETIRADA_MODULOS:
            assert f"import {mod}" not in txt and f"from {mod}" not in txt, (
                f"{name} importa {mod} — los oraculos deben anclarse a app/servicio.py, no a {mod} (ruta para retirada)"
            )
        has_static_import = "from interfaz.calculo import" in txt or "import interfaz.calculo" in txt
        has_dynamic = 'import_module("interfaz.calculo")' in txt or "import_module('interfaz.calculo')" in txt
        assert not (has_static_import and not has_dynamic), (
            f"{name} importa interfaz/calculo.py de forma estatica — anclado a ruta para retirada; "
            f"usa importlib.import_module con fallback a app/servicio.py (fase 0.5)"
        )

    if offenders:
        pytest.fail(
            "Pruebas apuntan a ruta declarada para retirada (fase 2 / spec arquitectura-y-calidad):\n"
            + "\n".join(offenders)
            + "\nCorrige reencaminando a app/servicio.py (fase 0.5) o mueve la prueba a la suite Playwright."
        )
