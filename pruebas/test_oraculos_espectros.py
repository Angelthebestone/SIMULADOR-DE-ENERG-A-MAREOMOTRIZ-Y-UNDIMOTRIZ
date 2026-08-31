"""Oraculos de espectros 3.1-3.4 — nucleo/espectros.py vs wavespectra.

Requisito: validacion-referencia / Espectros contrastados contra implementacion de referencia.
Tolerancias declaradas abajo. Solo compara, no sustituye formulas propias.
wavespectra es dependencia de desarrollo; si falta, la prueba falla con ImportError ruidoso.
"""

from __future__ import annotations

import math

import numpy as np
import pytest
from wavespectra.construct.frequency import jonswap, pierson_moskowitz

TOL_DENSIDAD_REL = 0.02
TOL_HM0_REL = 0.01
TOL_TE_REL = 0.02
TOL_RMS_REL = 0.02

CASOS_JONSWAP = [
    (2.0, 7.0, 3.3),
    (1.5, 8.0, 3.3),
    (2.5, 6.0, 2.0),
    (1.0, 5.5, 3.3),
]

CASOS_PM = [
    (2.0, 7.0),
    (1.5, 8.0),
    (3.0, 9.0),
]


def _freq_grid():
    return np.arange(0.03, 1.0, 0.002)


def _omega_grid(freq):
    return 2.0 * math.pi * freq


def _te_wavespectra_jonswap(freq, fp, hs, gamma):
    ds = jonswap(freq=freq, fp=fp, hs=hs, gamma=gamma)
    m0 = float(ds.spec.momf(0).values)
    mm1 = float(ds.spec.momf(-1).values)
    return mm1 / m0 if m0 > 0 else 0.0


def _te_wavespectra_pm(freq, fp, hs):
    ds = pierson_moskowitz(freq=freq, fp=fp, hs=hs)
    m0 = float(ds.spec.momf(0).values)
    mm1 = float(ds.spec.momf(-1).values)
    return mm1 / m0 if m0 > 0 else 0.0


def _fp_para_te_jonswap(freq, hs, te, gamma):
    from scipy.optimize import brentq

    def f(fp):
        return _te_wavespectra_jonswap(freq, fp, hs, gamma) - te

    tl = _te_wavespectra_jonswap(freq, 0.04, hs, gamma)
    th = _te_wavespectra_jonswap(freq, 0.4, hs, gamma)
    assert min(tl, th) <= te <= max(tl, th), f"Te={te} fuera de rango [{th:.1f},{tl:.1f}] para hs={hs} gamma={gamma}"
    return brentq(f, 0.04, 0.4, xtol=1e-7)


def _fp_para_te_pm(freq, hs, te):
    from scipy.optimize import brentq

    def f(fp):
        return _te_wavespectra_pm(freq, fp, hs) - te

    return brentq(f, 0.04, 0.4, xtol=1e-7)


def test_3_1_jonswap_densidad_coincide_con_wavespectra():
    from nucleo.espectros import espectro_jonswap_para_hm0_te

    freq = _freq_grid()
    omega = _omega_grid(freq)
    for hm0, te, gamma in CASOS_JONSWAP:
        fp_opt = _fp_para_te_jonswap(freq, hm0, te, gamma)
        ds = jonswap(freq=freq, fp=fp_opt, hs=hm0, gamma=gamma)
        s_f_ws = np.asarray(ds.values, dtype=float)
        s_w_nuc = espectro_jonswap_para_hm0_te(omega, hm0, te, gamma=gamma)
        s_f_nuc = 2.0 * math.pi * np.asarray(s_w_nuc, dtype=float)
        mask = (freq >= 0.05) & (freq <= 0.4) & (s_f_ws > np.max(s_f_ws) * 1e-3)
        assert np.any(mask), "mascara vacia"
        rel = np.abs(s_f_nuc[mask] - s_f_ws[mask]) / np.maximum(s_f_ws[mask], 1e-12)
        max_rel = float(np.max(rel))
        rms_rel = float(np.sqrt(np.mean(rel**2)))
        assert max_rel < TOL_DENSIDAD_REL, (
            f"JONSWAP densidad espectral desvía max_rel={max_rel:.4f} > {TOL_DENSIDAD_REL} "
            f"(rms {rms_rel:.4f}) para Hm0={hm0} Te={te} gamma={gamma} fp_opt={fp_opt:.5f} "
            f"[S(f)=2π·S(ω)]"
        )
        assert rms_rel < TOL_RMS_REL, (
            f"JONSWAP rms_rel={rms_rel:.4f} > {TOL_RMS_REL} para Hm0={hm0} Te={te} gamma={gamma}"
        )
        assert float(ds.spec.hs()) == pytest.approx(hm0, rel=0.01)


def test_3_2_pierson_moskowitz_densidad_coincide():
    from nucleo.espectros import espectro_pm_para_hm0_te

    freq = _freq_grid()
    omega = _omega_grid(freq)
    for hm0, te in CASOS_PM:
        fp_opt = _fp_para_te_pm(freq, hm0, te)
        ds = pierson_moskowitz(freq=freq, fp=fp_opt, hs=hm0)
        s_f_ws = np.asarray(ds.values, dtype=float)
        s_w_nuc = espectro_pm_para_hm0_te(omega, hm0, te)
        s_f_nuc = 2.0 * math.pi * np.asarray(s_w_nuc, dtype=float)
        mask = (freq >= 0.05) & (freq <= 0.4) & (s_f_ws > np.max(s_f_ws) * 1e-3)
        rel = np.abs(s_f_nuc[mask] - s_f_ws[mask]) / np.maximum(s_f_ws[mask], 1e-12)
        max_rel = float(np.max(rel))
        rms_rel = float(np.sqrt(np.mean(rel**2)))
        assert max_rel < TOL_DENSIDAD_REL, (
            f"Pierson-Moskowitz max_rel={max_rel:.4f} > {TOL_DENSIDAD_REL} "
            f"para Hm0={hm0} Te={te} fp_opt={fp_opt:.5f}"
        )
        assert rms_rel < TOL_RMS_REL


def test_3_3_hm0_te_por_momentos_coinciden():
    from nucleo.espectros import espectro_jonswap_para_hm0_te, espectro_pm_para_hm0_te, parametros_desde_espectro

    freq = _freq_grid()
    omega = _omega_grid(freq)
    for hm0, te, gamma in CASOS_JONSWAP:
        fp_opt = _fp_para_te_jonswap(freq, hm0, te, gamma)
        ds = jonswap(freq=freq, fp=fp_opt, hs=hm0, gamma=gamma)
        hs_ws = float(ds.spec.hs())
        m0_ws = float(ds.spec.momf(0).values)
        mm1_ws = float(ds.spec.momf(-1).values)
        te_ws = mm1_ws / m0_ws if m0_ws > 0 else 0.0
        s_w = espectro_jonswap_para_hm0_te(omega, hm0, te, gamma=gamma)
        p = parametros_desde_espectro(omega, s_w)
        assert p.hm0 == pytest.approx(hs_ws, rel=TOL_HM0_REL), (
            f"Hm0 JONSWAP nucleo {p.hm0:.4f} vs wavespectra {hs_ws:.4f} "
            f"desviación {abs(p.hm0-hs_ws)/hs_ws:.4f} > {TOL_HM0_REL} (Hm0={hm0} Te={te} gamma={gamma})"
        )
        assert p.te == pytest.approx(te_ws, rel=TOL_TE_REL), (
            f"Te JONSWAP nucleo {p.te:.4f} vs wavespectra {te_ws:.4f} "
            f"desviación {abs(p.te-te_ws)/te_ws:.4f} > {TOL_TE_REL}"
        )
    for hm0, te in CASOS_PM:
        fp_opt = _fp_para_te_pm(freq, hm0, te)
        ds = pierson_moskowitz(freq=freq, fp=fp_opt, hs=hm0)
        hs_ws = float(ds.spec.hs())
        m0_ws = float(ds.spec.momf(0).values)
        mm1_ws = float(ds.spec.momf(-1).values)
        te_ws = mm1_ws / m0_ws if m0_ws > 0 else 0.0
        s_w = espectro_pm_para_hm0_te(omega, hm0, te)
        p = parametros_desde_espectro(omega, s_w)
        assert p.hm0 == pytest.approx(hs_ws, rel=TOL_HM0_REL), (
            f"Hm0 PM nucleo {p.hm0:.4f} vs wavespectra {hs_ws:.4f} "
            f"desviación {abs(p.hm0-hs_ws)/hs_ws:.4f} > {TOL_HM0_REL}"
        )
        assert p.te == pytest.approx(te_ws, rel=TOL_TE_REL), (
            f"Te PM nucleo {p.te:.4f} vs wavespectra {te_ws:.4f} "
            f"desviación {abs(p.te-te_ws)/te_ws:.4f} > {TOL_TE_REL}"
        )


def test_3_4_alterar_constante_rompe_oraculo_con_mensaje_identificable(monkeypatch):
    import nucleo.espectros as esp

    freq = _freq_grid()
    omega = _omega_grid(freq)
    hm0, te, gamma = 2.0, 7.0, 3.3
    fp_opt = _fp_para_te_jonswap(freq, hm0, te, gamma)
    ds = jonswap(freq=freq, fp=fp_opt, hs=hm0, gamma=gamma)
    s_f_ws = np.asarray(ds.values, dtype=float)

    s_w_ok = esp.espectro_jonswap_para_hm0_te(omega, hm0, te, gamma=gamma)
    s_f_ok = 2.0 * math.pi * np.asarray(s_w_ok, dtype=float)
    mask = (freq >= 0.05) & (freq <= 0.4) & (s_f_ws > np.max(s_f_ws) * 1e-3)
    max_ok = float(np.max(np.abs(s_f_ok[mask] - s_f_ws[mask]) / s_f_ws[mask]))
    assert max_ok < TOL_DENSIDAD_REL

    orig_sigma_bajo = esp.JONSWAP_SIGMA_BAJO
    orig_sigma_alto = esp.JONSWAP_SIGMA_ALTO
    monkeypatch.setattr(esp, "JONSWAP_SIGMA_BAJO", 0.15)
    monkeypatch.setattr(esp, "JONSWAP_SIGMA_ALTO", 0.20)
    s_w_bad = esp.espectro_jonswap_para_hm0_te(omega, hm0, te, gamma=gamma)
    s_f_bad = 2.0 * math.pi * np.asarray(s_w_bad, dtype=float)
    rel_bad = np.abs(s_f_bad[mask] - s_f_ws[mask]) / s_f_ws[mask]
    max_bad = float(np.max(rel_bad))
    rms_bad = float(np.sqrt(np.mean(rel_bad**2)))
    assert max_bad > TOL_DENSIDAD_REL, (
        f"alterar JONSWAP_SIGMA_BAJO {orig_sigma_bajo}→0.15 y JONSWAP_SIGMA_ALTO {orig_sigma_alto}→0.20 "
        f"no hizo desviar el espectro max_rel={max_bad:.4f} ≤ tol {TOL_DENSIDAD_REL} — el oráculo no detecta la alteración"
    )
    msg = (
        f"Magnitud densidad espectral JONSWAP desvía max_rel={max_bad:.3f} rms={rms_bad:.3f} "
        f"tras alterar JONSWAP_SIGMA_BAJO {orig_sigma_bajo}→0.15 y JONSWAP_SIGMA_ALTO {orig_sigma_alto}→0.20; "
        f"esperado <{TOL_DENSIDAD_REL} — oráculo wavespectra detecta la divergencia"
    )
    assert "JONSWAP_SIGMA" in msg and "max_rel" in msg
    with pytest.raises(AssertionError, match=r"max_rel.*desvía|Magnitud.*desvía"):
        assert max_bad < TOL_DENSIDAD_REL, msg
