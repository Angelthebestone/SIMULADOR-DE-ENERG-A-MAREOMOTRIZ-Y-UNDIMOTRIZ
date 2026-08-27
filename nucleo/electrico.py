"""Electrico — saturacion de generador y eficiencia ola-cable."""

from __future__ import annotations

from dataclasses import dataclass

from nucleo.resultado import Eslabon


@dataclass(frozen=True, slots=True)
class ResultadoElectrico:
    potencia_pto_w: float
    potencia_entregada_w: float
    potencia_nominal_w: float
    potencia_recortada_w: float
    energia_recortada_mwh_ano: float
    rendimiento: float
    horas_ano: float
    disponibilidad: float


def _validar_rendimiento(valor: float) -> float:
    return max(0.0, min(1.0, float(valor)))


def crear_eslabon_generador(
    potencia_entrada_w: float,
    potencia_nominal_w: float,
    rendimiento_generador: float = 0.90,
    horas_ano: float = 8766.0,
    disponibilidad: float = 0.95,
) -> tuple[Eslabon, ResultadoElectrico]:
    """Generador con saturacion — potencia entregada acotada a nominal."""
    pot_in = max(float(potencia_entrada_w), 0.0)
    p_nom = max(float(potencia_nominal_w), 0.0)
    rend = _validar_rendimiento(rendimiento_generador)
    # saturacion
    if p_nom <= 0:
        entregada = 0.0
        recortada = pot_in
    else:
        entregada = min(pot_in * rend, p_nom)
        # energia recortada: lo que excede nominal antes de rendimiento
        # y lo perdido por saturacion despues de rendimiento
        entregada_sin_cap = pot_in * rend
        recortada = max(entregada_sin_cap - entregada, 0.0)
    # si entrada ya supera nominal/rend, hay recorte por saturacion
    rendimiento_efectivo = (entregada / pot_in) if pot_in > 0 else 0.0
    rendimiento_efectivo = _validar_rendimiento(rendimiento_efectivo)
    energia_rec_mwh = recortada * horas_ano * disponibilidad / 1e6
    eslabon = Eslabon(
        nombre="generador",
        potencia_entrada_w=pot_in,
        potencia_salida_w=entregada,
        rendimiento=rendimiento_efectivo,
        detalle={
            "potencia_nominal_w": p_nom,
            "potencia_recortada_w": float(recortada),
            "energia_recortada_mwh_ano": float(energia_rec_mwh),
            "rendimiento_generador": float(rend),
            "horas_ano": float(horas_ano),
            "disponibilidad": float(disponibilidad),
            "fuente": "Handbook cap.1 §4.2 — saturacion generador en eficiencia ola-cable",
        },
    )
    resultado = ResultadoElectrico(
        potencia_pto_w=pot_in,
        potencia_entregada_w=float(entregada),
        potencia_nominal_w=float(p_nom),
        potencia_recortada_w=float(recortada),
        energia_recortada_mwh_ano=float(energia_rec_mwh),
        rendimiento=float(rendimiento_efectivo),
        horas_ano=float(horas_ano),
        disponibilidad=float(disponibilidad),
    )
    return eslabon, resultado


def eficiencia_ola_cable(eslabones: list[Eslabon]) -> float:
    """Producto de rendimientos — Handbook ola-cable incluye saturacion."""
    prod = 1.0
    for e in eslabones:
        prod *= _validar_rendimiento(e.rendimiento)
    return float(prod)


def potencia_entregada(eslabones: list[Eslabon]) -> float:
    """Potencia a red tras toda la cadena."""
    if not eslabones:
        return 0.0
    return float(eslabones[-1].potencia_salida_w)
