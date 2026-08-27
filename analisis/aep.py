"""Produccion anual — AEP, matriz, regla pulgar y factor planta (M9).

- 5.1 AEP = sum ocurrencia*potencia*horas*disponibilidad, celdas consultables.
- 5.2 matriz Hs-Te desde serie, rotulando reconstrucciones.
- 5.3 regla pulgar J*ancho*n_w2w*disp*horas + aviso >50%.
- 5.4 disponibilidad explicita, factor planta derivado.
"""

from __future__ import annotations

from dataclasses import dataclass

import numpy as np

from nucleo.constantes import HORAS_POR_ANO

TOL_SUMA_01_PCT: float = 0.001
TOL_SUMA_02_PCT: float = 0.002
UMBRAL_DISCREPANCIA_PCT: float = 50.0


@dataclass(frozen=True, slots=True)
class MatrizDispersion:
    hs_bordes_m: np.ndarray
    te_bordes_s: np.ndarray
    hs_centros_m: np.ndarray
    te_centros_s: np.ndarray
    ocurrencia: np.ndarray
    n_muestras: int
    n_reconstruidas: int
    etiquetas_reconstruccion: list[str]
    avisos: list[str]


@dataclass(frozen=True, slots=True)
class ResultadoAEP:
    aep_mwh: float
    aep_por_celda_mwh: np.ndarray
    potencia_media_w: float
    horas_ano: float
    disponibilidad: float
    contribucion_pct: np.ndarray
    detalle: str


@dataclass(frozen=True, slots=True)
class ReglaPulgar:
    j_kw_m: float
    ancho_m: float
    eta_w2w: float
    disponibilidad: float
    horas_ano: float
    aep_mwh: float
    fuente: str


def _validar_serie(hs_m: np.ndarray, te_s: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
    hs = np.asarray(hs_m, dtype=float)
    te = np.asarray(te_s, dtype=float)
    if hs.shape != te.shape:
        raise ValueError("hs y te deben tener igual forma")
    if hs.size == 0:
        raise ValueError("serie vacia")
    return hs, te


def _bordes_defecto(
    hs_bordes: np.ndarray | None, te_bordes: np.ndarray | None
) -> tuple[np.ndarray, np.ndarray]:
    hs_b = (
        np.asarray(hs_bordes, dtype=float)
        if hs_bordes is not None
        else np.array([0, 0.5, 1.0, 1.5, 2.0, 2.5, 4.0], dtype=float)
    )
    te_b = (
        np.asarray(te_bordes, dtype=float)
        if te_bordes is not None
        else np.array([0, 4, 5, 6, 7, 8, 12], dtype=float)
    )
    return hs_b, te_b


def _aviso_suma(suma: float) -> str:
    if abs(suma - 1.0) > TOL_SUMA_01_PCT:
        return f"ocurrencia suma {suma:.4f} fuera de 1 +-0,1% — revisar bordes o serie"
    return f"ocurrencia suma {suma:.5f} OK 1+-0,1% (7.6)"


def _avisos_reconstruccion(n_rec: int, etiquetas: list[str], avisos: list[str]) -> None:
    if n_rec <= 0:
        return
    for lab in etiquetas[:5]:
        avisos.append(f"reconstruccion: {lab}")
    if len(etiquetas) > 5:
        avisos.append(f"... y {len(etiquetas)-5} reconstrucciones mas")
    if not etiquetas:
        avisos.append(f"{n_rec} muestras no validas excluidas — rotular fuente si es ERA5")


def matriz_dispersion_desde_serie(
    hs_m: np.ndarray,
    te_s: np.ndarray,
    hs_bordes_m: np.ndarray | None = None,
    te_bordes_s: np.ndarray | None = None,
    reconstruccion_labels: list[str] | None = None,
) -> MatrizDispersion:
    """Construye matriz de ocurrencia Hs-Te desde series horarias."""
    hs, te = _validar_serie(hs_m, te_s)
    mask_valid = np.isfinite(hs) & np.isfinite(te) & (hs >= 0) & (te > 0)
    n_rec = _contar_reconstruidas(mask_valid, reconstruccion_labels)
    etiquetas: list[str] = list(reconstruccion_labels or [])
    hs_b, te_b = _bordes_defecto(hs_bordes_m, te_bordes_s)
    hs_c = (hs_b[:-1] + hs_b[1:]) / 2.0
    te_c = (te_b[:-1] + te_b[1:]) / 2.0
    hist, _, _ = np.histogram2d(hs[mask_valid], te[mask_valid], bins=[hs_b, te_b])
    total = float(np.sum(hist))
    ocurr = hist / total if total > 0 else hist
    suma = float(np.sum(ocurr))
    avisos: list[str] = [_aviso_suma(suma)]
    _avisos_reconstruccion(n_rec, etiquetas, avisos)
    return MatrizDispersion(
        hs_bordes_m=hs_b,
        te_bordes_s=te_b,
        hs_centros_m=hs_c,
        te_centros_s=te_c,
        ocurrencia=ocurr,
        n_muestras=int(np.sum(mask_valid)),
        n_reconstruidas=n_rec,
        etiquetas_reconstruccion=etiquetas,
        avisos=avisos,
    )


def _contar_reconstruidas(mask_valid: np.ndarray, labels: list[str] | None) -> int:
    if labels is not None:
        return len(labels)
    return int(np.sum(~mask_valid))


def calcular_aep(
    ocurrencia: np.ndarray,
    matriz_potencia_w: np.ndarray,
    disponibilidad: float = 0.95,
    horas_ano: float = HORAS_POR_ANO,
) -> ResultadoAEP:
    """AEP = sum ij ocurrencia_ij * P_ij * horas * disponibilidad [MWh]."""
    occ = np.asarray(ocurrencia, dtype=float)
    pmat = np.asarray(matriz_potencia_w, dtype=float)
    if occ.shape != pmat.shape:
        raise ValueError("ocurrencia y matriz_potencia deben tener igual forma")
    if not 0 < disponibilidad <= 1:
        raise ValueError("disponibilidad en (0,1]")
    suma_occ = float(np.sum(occ))
    aviso = _aviso_suma_laxo(suma_occ)
    aep_celda = occ * pmat * horas_ano * disponibilidad / 1e6
    aep = float(np.sum(aep_celda))
    p_media = float(np.sum(occ * pmat) * disponibilidad)
    contrib = _contribucion(aep_celda, aep)
    detalle = f"AEP={aep:.1f} MWh (occ {suma_occ:.4f}, disp {disponibilidad:.0%}){aviso}"
    return ResultadoAEP(
        aep_mwh=aep,
        aep_por_celda_mwh=aep_celda,
        potencia_media_w=p_media,
        horas_ano=float(horas_ano),
        disponibilidad=float(disponibilidad),
        contribucion_pct=contrib,
        detalle=detalle,
    )


def _aviso_suma_laxo(suma_occ: float) -> str:
    if abs(suma_occ - 1.0) > TOL_SUMA_02_PCT:
        return f" | AVISO suma {suma_occ:.4f} !=1"
    return ""


def _contribucion(aep_celda: np.ndarray, aep: float) -> np.ndarray:
    if aep > 0:
        return aep_celda / aep * 100.0
    return np.zeros_like(aep_celda)


def factor_planta(aep_mwh: float, p_nominal_w: float, horas_ano: float = HORAS_POR_ANO) -> float:
    """Factor planta = AEP / (Pnom * horas) — derivado, nunca de entrada (5.4)."""
    if p_nominal_w <= 0:
        raise ValueError("Pnominal debe ser positiva")
    denom = p_nominal_w * horas_ano / 1e6
    if denom == 0:
        return 0.0
    return float(aep_mwh / denom)


def regla_pulgar_handbook(
    j_kw_m: float,
    ancho_m: float,
    eta_w2w: float = 0.20,
    disponibilidad: float = 0.95,
    horas_ano: float = HORAS_POR_ANO,
) -> ReglaPulgar:
    """AEP pulgar = J * ancho * eta_w2w * disp * horas [MWh]. 40*15*0,20*0,95*8766=999."""
    if j_kw_m < 0 or ancho_m <= 0:
        raise ValueError("J>=0 y ancho positivo")
    if not 0 < eta_w2w <= 1:
        raise ValueError("eta_w2w en (0,1]")
    aep = j_kw_m * 1000.0 * ancho_m * eta_w2w * disponibilidad * horas_ano / 1e6
    return ReglaPulgar(
        j_kw_m=float(j_kw_m),
        ancho_m=float(ancho_m),
        eta_w2w=float(eta_w2w),
        disponibilidad=float(disponibilidad),
        horas_ano=float(horas_ano),
        aep_mwh=float(aep),
        fuente="Handbook cap.1 §4.2 regla pulgar +-50%",
    )


def comparar_aep_con_pulgar(aep_mwh: float, pulgar_mwh: float) -> dict[str, object]:
    """Aviso si discrepancia >50% (Handbook +-50%)."""
    if pulgar_mwh == 0:
        return {"discrepancia_pct": float("inf"), "aviso": "pulgar 0 — no comparable"}
    disc = abs(aep_mwh - pulgar_mwh) / pulgar_mwh * 100.0
    if disc > UMBRAL_DISCREPANCIA_PCT:
        aviso = f"discrepancia {disc:.0f}% >50% — revisar matriz o recurso"
    else:
        aviso = f"discrepancia {disc:.0f}% dentro de +-50% Handbook"
    return {"discrepancia_pct": float(disc), "aviso": aviso}


def energia_teorica_presion_marea(
    area_m2: float, rango_m: float, rho: float = 1025.0, g: float = 9.81
) -> float:
    """E = 0,5 rho g A R^2 por ciclo [J]; La Rance 22km2*8m => 7,08e12 J."""
    if area_m2 <= 0 or rango_m <= 0:
        raise ValueError("area y rango positivos")
    return 0.5 * rho * g * area_m2 * rango_m * rango_m


def validacion_la_rance() -> dict[str, object]:
    """Prueba 7.13 — 1.435 GWh teorico anual (2 ciclos/dia), ~35% ciclo."""
    area = 22e6
    rango = 8.0
    e_ciclo_j = energia_teorica_presion_marea(area, rango)
    e_ciclo_gwh = e_ciclo_j / 3.6e12
    e_anual = e_ciclo_gwh * 2 * 365
    prod_real = 500.0
    rend = prod_real / e_anual
    return {
        "e_ciclo_gwh": float(e_ciclo_gwh),
        "e_anual_teorica_gwh": float(e_anual),
        "produccion_real_gwh": float(prod_real),
        "rendimiento_ciclo": float(rend),
        "rotulo": "orden magnitud — area 22km2 y 500GWh sin fuente primaria",
        "fuente_produccion": "EDF 502 GWh 2018 + Wikipedia 491-523 GWh",
    }
