from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any


@dataclass
class Eslabon:
    nombre: str
    potencia_entrada_w: float
    potencia_salida_w: float
    rendimiento: float
    detalle: dict[str, Any] = field(default_factory=dict)


@dataclass
class Resultado:
    recurso: dict[str, Any] = field(default_factory=dict)
    eslabones: list[Eslabon] = field(default_factory=list)
    potencia_nominal_w: float = 0.0
    produccion_anual_mwh: float = 0.0
    factor_planta: float = 0.0
    disponibilidad: float = 0.95
    horas_ano: float = 8766.0
    avisos: list[str] = field(default_factory=list)
    series: dict[str, Any] = field(default_factory=dict)
    metadatos: dict[str, Any] = field(default_factory=dict)

    @property
    def eficiencia_ola_cable(self) -> float:
        prod = 1.0
        for e in self.eslabones:
            prod *= e.rendimiento
        return prod

    @property
    def produccion_por_eslabon(self) -> dict[str, float]:
        return {e.nombre: e.potencia_salida_w for e in self.eslabones}

    def rendimiento_eslabon(self, nombre: str) -> float | None:
        for e in self.eslabones:
            if e.nombre == nombre:
                return e.rendimiento
        return None

    def to_dict(self) -> dict[str, Any]:
        return {
            "recurso": self.recurso,
            "eslabones": [
                {
                    "nombre": e.nombre,
                    "potencia_entrada_w": e.potencia_entrada_w,
                    "potencia_salida_w": e.potencia_salida_w,
                    "rendimiento": e.rendimiento,
                    "detalle": e.detalle,
                }
                for e in self.eslabones
            ],
            "potencia_nominal_w": self.potencia_nominal_w,
            "produccion_anual_mwh": self.produccion_anual_mwh,
            "factor_planta": self.factor_planta,
            "disponibilidad": self.disponibilidad,
            "horas_ano": self.horas_ano,
            "avisos": self.avisos,
            "metadatos": self.metadatos,
        }
