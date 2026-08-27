from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True, slots=True)
class Acotacion:
    valor_acotado: float
    valor_original: float
    motivo: str
    rango: tuple[float, float]


RANGOS: dict[str, tuple[float, float]] = {
    "Hm0": (0.5, 4.0),
    "Te": (4.0, 12.0),
    "J": (2.0, 60.0),
    "profundidad": (10.0, 100.0),
    "diametro_boya": (2.0, 20.0),
    "amortiguamiento_pto": (10_000.0, 500_000.0),
    "carrera_pto": (1.0, 5.0),
    "rango_mareal": (0.0, 15.0),
    "velocidad_corriente": (0.0, 5.0),
    "Cp": (0.0, 1.0),
    "rendimiento": (0.0, 1.0),
}


def acotar(parametro: str, valor: float) -> tuple[float, Acotacion | None]:
    if parametro not in RANGOS:
        return valor, None
    minimo, maximo = RANGOS[parametro]
    if minimo <= valor <= maximo:
        return valor, None
    acotado = min(max(valor, minimo), maximo)
    motivo = f"{parametro}={valor} fuera de rango [{minimo}, {maximo}]; acotado a {acotado}"
    return acotado, Acotacion(
        valor_acotado=acotado,
        valor_original=valor,
        motivo=motivo,
        rango=(minimo, maximo),
    )


def validar_rango(parametro: str, valor: float) -> Acotacion | None:
    _, acotacion = acotar(parametro, valor)
    return acotacion


def es_disruptivo(valor: float, parametro: str) -> bool:
    if parametro not in RANGOS:
        return False
    minimo, maximo = RANGOS[parametro]
    return not (minimo <= valor <= maximo)


def explicar_invariante_roto(invariante: str, detalle: str) -> str:
    return f"Invariante roto [{invariante}]: {detalle}"
