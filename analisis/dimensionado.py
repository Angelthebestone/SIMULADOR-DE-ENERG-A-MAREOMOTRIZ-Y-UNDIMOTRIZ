"""Dimensionado — diametro de partida y periodo de diseno (M4).

- 4.4 dimensiones de partida desde recurso, advierte >1 valor Isla Fuerte.
- 4.7 periodo de diseno = maximiza energia por ocurrencia; referencia T^2.
"""

from __future__ import annotations

from dataclasses import dataclass

import numpy as np

# Isla Fuerte: dos valores de J con fuentes distintas — se declara la discrepancia
DENSIDAD_ISLA_FUERTE_ORTEGA_KW_M: float = 8.9
FUENTE_ORTEGA: str = "Ortega et al. (2013) Renewable Energy 57 — 8,9 kW/m revisado por pares"
DENSIDAD_ISLA_FUERTE_ERA5_KW_M: float = 1.96
FUENTE_ERA5: str = (
    "ERA5-Ocean via Open-Meteo, Isla Fuerte rejilla 0,5° ~23km — 1,96 kW/m (2015-2024)"
)
AVISO_DISCREPANCIA_ISLA_FUERTE: str = (
    "Isla Fuerte tiene dos valores: 8,9 kW/m (Ortega et al. 2013, revisado por pares) "
    "frente a 1,96 kW/m (ERA5-Ocean rejilla 0,5° ~23km, 4,5x menor por resguardo de golfo "
    "y rejilla gruesa). No se debe reemplazar 8,9 con 1,96; ERA5 sirve para forma Hs-Te."
)

# Referencia europea Handbook (tabla 2)
DIAMETRO_EU_MIN_M: float = 12.0
DIAMETRO_EU_MAX_M: float = 20.0
TE_EU_REF_S: float = 9.0
TE_CARIBE_MIN_S: float = 5.0
TE_CARIBE_MAX_S: float = 8.0


@dataclass(frozen=True, slots=True)
class DimensionPartida:
    diametro_m: float
    rango_diametro_m: tuple[float, float]
    criterio: str
    te_sitio_s: float
    te_ref_s: float
    factor_escala: float
    fuente: str
    avisos: list[str]


@dataclass(frozen=True, slots=True)
class PeriodoDiseno:
    te_mas_frecuente_s: float
    te_medio_s: float
    te_diseno_s: float
    criterio_diseno: str
    j_por_celda_kw_m: np.ndarray | None
    detalle: str


def _factor_escala_t2(te_sitio: float, te_ref: float = TE_EU_REF_S) -> float:
    """lambda ~ T^2 en aguas profundas => D escala con T^2."""
    return float((te_sitio / te_ref) ** 2)


def dimension_partida_desde_recurso(
    te_sitio_s: float,
    diametro_eu_ref_m: float = 16.0,
    te_eu_ref_s: float = TE_EU_REF_S,
    sitio: str = "generico",
) -> DimensionPartida:
    """Calcula diametro de partida escalando T^2 desde referencia europea.

    12-20m a 8-10s => 5-9m a 5-8s Caribe (especificacion M4, aporte propio).
    """
    if te_sitio_s <= 0:
        raise ValueError("Te debe ser positivo")
    factor = _factor_escala_t2(te_sitio_s, te_eu_ref_s)
    diam = diametro_eu_ref_m * factor
    rmin = DIAMETRO_EU_MIN_M * factor
    rmax = DIAMETRO_EU_MAX_M * factor
    avisos: list[str] = []
    if sitio.lower().replace(" ", "_") in ("isla_fuerte", "islafuerte"):
        avisos.append(AVISO_DISCREPANCIA_ISLA_FUERTE)
        avisos.append(
            f"Usado Te={te_sitio_s}s para escala; J no interviene en D, pero se declara discrepancia de recurso."
        )
    criterio = (
        f"D = D_ref * (Te_sitio/Te_ref)^2  (Handbook cap.1 tabla 2 + escala lambda~T^2); "
        f"Te_sitio={te_sitio_s}s, Te_ref={te_eu_ref_s}s, D_ref={diametro_eu_ref_m}m => D={diam:.1f}m"
    )
    fuente = (
        "Handbook cap.1 tabla 2 (12-20m a 8-10s) + escala T^2 (M4 originalidad Caribe); "
        "Isla Fuerte: Ortega 8,9 vs ERA5 1,96 — ver avisos"
    )
    return DimensionPartida(
        diametro_m=float(diam),
        rango_diametro_m=(float(rmin), float(rmax)),
        criterio=criterio,
        te_sitio_s=float(te_sitio_s),
        te_ref_s=float(te_eu_ref_s),
        factor_escala=float(factor),
        fuente=fuente,
        avisos=avisos,
    )


def _energia_por_ocurrencia(
    hs_centros: np.ndarray,
    te_centros: np.ndarray,
    ocurrencia: np.ndarray,
) -> tuple[np.ndarray, float, float]:
    """Matriz de energia relativa: ocurrencia * Hs^2 * Te (proporcional a J)."""
    hs = np.asarray(hs_centros, dtype=float)
    te = np.asarray(te_centros, dtype=float)
    occ = np.asarray(ocurrencia, dtype=float)
    if occ.shape != (hs.size, te.size):
        raise ValueError("ocurrencia debe ser Hs x Te")
    j_rel = np.outer(hs * hs, te)  # Hs^2*Te por celda
    energia = occ * j_rel
    return energia, float(np.mean(te)), float(np.sum(energia))


def periodo_diseno_desde_matriz(
    hs_centros_m: np.ndarray,
    te_centros_s: np.ndarray,
    ocurrencia: np.ndarray,
) -> PeriodoDiseno:
    """Periodo de diseno = maximiza energia por ocurrencia (Handbook M4).

    Junto a mas frecuente y medio; incluye escalado T^2 vs Europa.
    """
    hs = np.asarray(hs_centros_m, dtype=float)
    te = np.asarray(te_centros_s, dtype=float)
    occ = np.asarray(ocurrencia, dtype=float)
    if hs.size == 0 or te.size == 0:
        raise ValueError("centros no vacios")
    if occ.shape != (hs.size, te.size):
        raise ValueError("ocurrencia debe ser Hs x Te")
    # Mas frecuente: celda de mayor ocurrencia
    idx_frec = np.unravel_index(int(np.argmax(occ)), occ.shape)
    te_frec = float(te[idx_frec[1]])
    # Medio ponderado por ocurrencia
    te_medio = float(np.sum(occ * te[np.newaxis, :]) / max(np.sum(occ), 1e-12))
    # Energia por ocurrencia
    energia, _, _ = _energia_por_ocurrencia(hs, te, occ)
    idx_en = np.unravel_index(int(np.argmax(energia)), energia.shape)
    te_dis = float(te[idx_en[1]])
    # Escalado T^2
    f_frec = _factor_escala_t2(te_frec)
    f_medio = _factor_escala_t2(te_medio)
    f_dis = _factor_escala_t2(te_dis)
    detalle = (
        f"Te mas frecuente {te_frec:.1f}s (celda max ocurrencia), "
        f"Te medio {te_medio:.1f}s, Te diseno {te_dis:.1f}s (max energia*ocurrencia); "
        f"escalado T^2: ref 9s => factores {f_frec:.2f}/{f_medio:.2f}/{f_dis:.2f} "
        f"=> D 16m ref => {16*f_frec:.1f}/{16*f_medio:.1f}/{16*f_dis:.1f}m; "
        f"Europa 12-20m a 8-10s => Caribe 5-9m a 5-8s."
    )
    return PeriodoDiseno(
        te_mas_frecuente_s=te_frec,
        te_medio_s=te_medio,
        te_diseno_s=te_dis,
        criterio_diseno="maximiza Hs^2*Te*ocurrencia (Handbook M4 — mayor contribucion anual)",
        j_por_celda_kw_m=None,
        detalle=detalle,
    )


def validar_t2_caribe() -> str:
    """Comprobacion 12-20m a 9s => 5-9m a 6s con T^2: 16*(6/9)^2=7,1m dentro de rango."""
    d_ref = 16.0
    te_caribe = 6.0
    d_caribe = d_ref * (te_caribe / TE_EU_REF_S) ** 2
    return (
        f"T^2: D_ref {d_ref}m a {TE_EU_REF_S}s => D_caribe {d_caribe:.1f}m a {te_caribe}s; "
        f"rango europeo 12-20m => caribe {DIAMETRO_EU_MIN_M*(6/9)**2:.1f}-"
        f"{DIAMETRO_EU_MAX_M*(6/9)**2:.1f}m, coherente con 5-9m citado."
    )
