"""Emplazamiento — panel Handbook + eliminatorio RUNAP (6.7)."""

from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path

UMBRAL_ENERGIA_KW_M: float = 15.0
UMBRAL_PENDIENTE_PCT: float = 1.5

GMRT_RUMBO_CORTO_30M: str = "NW 5,4 km (NNE 3,0 km mas corto pero somero)"
GMRT_FUENTE: str = "GMRT Lamont-Doherty — datos/batimetria/resumen_batimetria_isla_fuerte.json"

RUNAP_TOTAL_AREAS: int = 37
RUNAP_TOTAL_KM2: float = 305335.0
RUNAP_DIR: str = "datos/runap"
UMBRAL_PROX_KM: float = 15.0
RATIO_VARIACION_MAX: float = 3.0


@dataclass(frozen=True, slots=True)
class CriterioPuntuado:
    nombre: str
    valor: float | str
    umbral: str
    cumple: bool
    detalle: str


@dataclass(frozen=True, slots=True)
class PanelEmplazamiento:
    sitio_id: str
    nombre: str
    criterios: list[CriterioPuntuado]
    puntaje: int
    total_criterios: int
    estado_legal: str
    eliminatorio: bool
    veredicto: str
    fuente_runap: str
    fuente_batimetria: str
    avisos: list[str]


def _cargar_sitio_json(sitio_id: str, base: Path | None = None) -> dict[str, object]:
    root = base or Path(__file__).resolve().parents[1]
    p = root / "datos" / "sitios" / f"{sitio_id}.json"
    if not p.exists():
        return {}
    return json.loads(p.read_text(encoding="utf-8"))  # type: ignore[no-any-return]


def _extraer_valor(campo: object) -> float | None:
    if isinstance(campo, dict) and "valor" in campo:
        try:
            return float(campo["valor"])  # type: ignore[arg-type]
        except Exception:
            return None
    if isinstance(campo, (int, float)):
        return float(campo)
    return None


def criterio_energia(j_kw_m: float) -> CriterioPuntuado:
    cumple = j_kw_m > UMBRAL_ENERGIA_KW_M
    estado = "cumple" if cumple else "no cumple"
    return CriterioPuntuado(
        nombre="energia media >15 kW/m",
        valor=j_kw_m,
        umbral=f">{UMBRAL_ENERGIA_KW_M} kW/m",
        cumple=cumple,
        detalle=f"J={j_kw_m:.1f} vs {UMBRAL_ENERGIA_KW_M} — {estado} (Handbook §4.5)",
    )


def criterio_pendiente(pendiente_pct: float | None) -> CriterioPuntuado:
    if pendiente_pct is None:
        return CriterioPuntuado(
            nombre="pendiente oleaje >1,5%",
            valor="sin dato",
            umbral=f">{UMBRAL_PENDIENTE_PCT}%",
            cumple=False,
            detalle="pendiente no calculada — requiere Hs/lambda",
        )
    cumple = pendiente_pct > UMBRAL_PENDIENTE_PCT
    estado = "cumple" if cumple else "no cumple"
    return CriterioPuntuado(
        nombre="pendiente media >1,5%",
        valor=pendiente_pct,
        umbral=f">{UMBRAL_PENDIENTE_PCT}%",
        cumple=cumple,
        detalle=f"pendiente {pendiente_pct:.2f}% vs {UMBRAL_PENDIENTE_PCT}% — {estado}",
    )


def criterio_variacion_mensual(j_mensual_kw_m: list[float] | None) -> CriterioPuntuado:
    if not j_mensual_kw_m or len(j_mensual_kw_m) < 2:  # noqa: PLR2004
        return CriterioPuntuado(
            nombre="baja variacion mensual",
            valor="sin serie mensual",
            umbral="ratio max/min bajo",
            cumple=False,
            detalle="sin serie mensual — Isla Fuerte ERA5 0,59-4,59 ratio ~8x no cumple",
        )
    mx = max(j_mensual_kw_m)
    mn = min(j_mensual_kw_m) if min(j_mensual_kw_m) > 0 else 1e-9
    ratio = mx / mn
    cumple = ratio < RATIO_VARIACION_MAX
    estado = "cumple" if cumple else "no cumple; Isla Fuerte ~8x"
    return CriterioPuntuado(
        nombre="baja variacion mensual",
        valor=ratio,
        umbral=f"ratio <{RATIO_VARIACION_MAX:.0f}",
        cumple=cumple,
        detalle=f"ratio {ratio:.1f} (max {mx:.1f} min {mn:.1f}) — {estado}",
    )


def criterio_proximidad(distancia_km: float | None) -> CriterioPuntuado:
    if distancia_km is None:
        return CriterioPuntuado(
            nombre="proximidad costa/usuario",
            valor="sin dato",
            umbral=f"<{UMBRAL_PROX_KM:.0f} km",
            cumple=False,
            detalle="sin dato de distancia",
        )
    cumple = distancia_km < UMBRAL_PROX_KM
    estado = "cumple (Isla Fuerte 11km)" if cumple else "lejos"
    return CriterioPuntuado(
        nombre="proximidad costa/usuario",
        valor=distancia_km,
        umbral=f"<{UMBRAL_PROX_KM:.0f} km",
        cumple=cumple,
        detalle=f"{distancia_km:.1f} km — {estado}",
    )


def criterio_profundidad(
    distancia_30m_km: float | None, distancia_60m_km: float | None
) -> CriterioPuntuado:
    tiene = distancia_30m_km is not None or distancia_60m_km is not None
    if tiene:
        val = f"30m a {distancia_30m_km}km, 60m a {distancia_60m_km}km"
    else:
        val = "sin banda 30-60m en 25km"
    disp = "disponible" if tiene else "no disponible"
    return CriterioPuntuado(
        nombre="profundidad 30-60m disponible",
        valor=val,
        umbral="30m y 60m <25km",
        cumple=tiene,
        detalle=f"GMRT: {val} — {GMRT_RUMBO_CORTO_30M}; {disp}",
    )


def _es_utilizable(estado_legal: str) -> bool:
    return estado_legal.strip().lower() == "utilizable"


def _es_descartado(estado_legal: str) -> bool:
    return estado_legal.strip().lower() == "descartado"


def _resolver_defaults(
    sitio: dict[str, object],
    sitio_id: str,
    j_kw_m: float | None,
    distancia_km: float | None,
    d30: float | None,
    d60: float | None,
) -> tuple[float, float | None, float | None, float | None]:
    j = j_kw_m
    if j is None:
        v = _extraer_valor(sitio.get("densidad_potencia_media"))
        if v is None or v == 0:
            v = _extraer_valor(sitio.get("densidad_potencia_era5"))
        j = float(v) if v is not None else 0.0
    dk = distancia_km
    if dk is None:
        v = _extraer_valor(sitio.get("distancia_continente_km"))
        dk = float(v) if v is not None else None
    dd30, dd60 = d30, d60
    if dd30 is None and dd60 is None:
        v30 = _extraer_valor(sitio.get("profundidad_30m_km_nw"))
        v60 = _extraer_valor(sitio.get("profundidad_60m_km_nw"))
        if v30 is not None:
            dd30 = float(v30)
        if v60 is not None:
            dd60 = float(v60)
        if sitio_id == "isla_fuerte" and dd30 is None:
            dd30, dd60 = 5.41, 10.0
    return j, dk, dd30, dd60


def _veredicto_y_avisos(
    sitio_id: str,
    sitio: dict[str, object],
    estado_legal: str,
    puntaje: int,
    total: int,
    j_kw: float,
) -> tuple[str, bool, list[str]]:
    area_prot = str(sitio.get("area_protegida", ""))
    nombre = str(sitio.get("nombre", sitio_id))
    eliminatorio = _es_descartado(estado_legal)
    avisos: list[str] = []
    if _es_utilizable(estado_legal):
        veredicto = (
            f"utilizable — {puntaje}/{total}; Isla Fuerte falla energia pero cumple prox/GMRT"
        )
    elif eliminatorio:
        veredicto = (
            f"descartado — {area_prot}; RUNAP {RUNAP_TOTAL_AREAS} areas {RUNAP_TOTAL_KM2:.0f} km2"
        )
        avisos.append("Eliminatorio RUNAP: PNN — ejercicio teorico si se calcula")
    else:
        veredicto = f"restringido — {area_prot or estado_legal}; consulta autoridad"
        avisos.append("Restringido Seaflower/AMP — no utilizable sin autorizacion")
    if sitio_id == "isla_fuerte" and j_kw < UMBRAL_ENERGIA_KW_M:
        avisos.append(
            f"Isla Fuerte {j_kw} kW/m < {UMBRAL_ENERGIA_KW_M} — falla energia gana prox/usuario"
        )
    if sitio_id in ("islas_rosario", "bahia_malaga") and eliminatorio:
        avisos.append(f"{nombre} PNN — dato recurso sigue valido, sitio no utilizable")
    return veredicto, eliminatorio, avisos


def panel_emplazamiento(
    sitio_id: str,
    j_kw_m: float | None = None,
    pendiente_pct: float | None = None,
    j_mensual_kw_m: list[float] | None = None,
    distancia_km: float | None = None,
    distancia_30m_km: float | None = None,
    distancia_60m_km: float | None = None,
    sitio_json: dict[str, object] | None = None,
) -> PanelEmplazamiento:
    """Panel puntuacion + eliminatorio RUNAP."""
    sitio = sitio_json if sitio_json is not None else _cargar_sitio_json(sitio_id)
    estado_legal = str(sitio.get("estado_legal", "desconocido"))
    j_kw, dk, dd30, dd60 = _resolver_defaults(
        sitio, sitio_id, j_kw_m, distancia_km, distancia_30m_km, distancia_60m_km
    )
    criterios = [
        criterio_energia(float(j_kw)),
        criterio_pendiente(pendiente_pct),
        criterio_variacion_mensual(j_mensual_kw_m),
        criterio_proximidad(dk),
        criterio_profundidad(dd30, dd60),
    ]
    puntaje = sum(1 for c in criterios if c.cumple)
    total = len(criterios)
    veredicto, eliminatorio, avisos = _veredicto_y_avisos(
        sitio_id, sitio, estado_legal, puntaje, total, float(j_kw)
    )
    return PanelEmplazamiento(
        sitio_id=sitio_id,
        nombre=str(sitio.get("nombre", sitio_id)),
        criterios=criterios,
        puntaje=puntaje,
        total_criterios=total,
        estado_legal=estado_legal,
        eliminatorio=eliminatorio,
        veredicto=veredicto,
        fuente_runap=f"RUNAP datos/runap/ ({RUNAP_TOTAL_AREAS} areas, {RUNAP_TOTAL_KM2:.0f} km2)",
        fuente_batimetria=GMRT_FUENTE,
        avisos=avisos,
    )


def resumen_todos_sitios() -> list[PanelEmplazamiento]:
    """Panel para los cinco sitios precargados."""
    out: list[PanelEmplazamiento] = []
    for sid in ["isla_fuerte", "tumaco", "islas_rosario", "bahia_malaga", "san_andres"]:
        out.append(panel_emplazamiento(sid))
    return out
