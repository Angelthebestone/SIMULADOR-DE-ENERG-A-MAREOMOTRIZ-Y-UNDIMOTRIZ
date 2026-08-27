from __future__ import annotations

from dataclasses import dataclass
from typing import Literal

EstadoDato = Literal["verificado", "inferido", "pendiente"]

_ESTADOS_VALIDOS = {"verificado", "inferido", "pendiente"}


class DatoPendienteError(RuntimeError):
    pass


@dataclass(frozen=True, slots=True)
class Dato:
    valor: float
    unidad: str
    fuente: str
    estado: EstadoDato

    def __post_init__(self) -> None:
        if self.estado not in _ESTADOS_VALIDOS:
            raise ValueError(f"estado debe ser uno de {_ESTADOS_VALIDOS}")
        if not isinstance(self.valor, (int, float)):
            raise TypeError("valor debe ser numérico")
        if not self.unidad:
            raise ValueError("unidad es obligatoria")
        if not self.fuente:
            raise ValueError("fuente es obligatoria")

    @property
    def es_pendiente(self) -> bool:
        return self.estado == "pendiente"

    @property
    def es_verificado(self) -> bool:
        return self.estado == "verificado"

    @property
    def es_inferido(self) -> bool:
        return self.estado == "inferido"

    @property
    def usable(self) -> bool:
        return self.estado != "pendiente"

    def exigir(self) -> float:
        if self.es_pendiente:
            raise DatoPendienteError(f"dato pendiente bloqueado: {self.fuente}")
        return float(self.valor)

    def to_dict(self) -> dict[str, object]:
        return {
            "valor": self.valor,
            "unidad": self.unidad,
            "fuente": self.fuente,
            "estado": self.estado,
        }

    @classmethod
    def from_dict(cls, data: dict[str, object]) -> Dato:
        for campo in ("valor", "unidad", "fuente", "estado"):
            if campo not in data:
                raise ValueError(f"campo obligatorio faltante: {campo}")
        return cls(
            valor=float(data["valor"]),  # type: ignore[arg-type]
            unidad=str(data["unidad"]),
            fuente=str(data["fuente"]),
            estado=str(data["estado"]),  # type: ignore[arg-type]
        )


def semaforo(estado: EstadoDato) -> str:
    mapping = {"verificado": "verde", "inferido": "amarillo", "pendiente": "rojo"}
    return mapping[estado]
