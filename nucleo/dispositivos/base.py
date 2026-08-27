from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import Any

from nucleo.resultado import Resultado


@dataclass(frozen=True, slots=True)
class ContextoRecurso:
    rho: float = 1025.0
    g: float = 9.81
    profundidad_m: float = 30.0


class DispositivoBase(ABC):
    familia: str = ""
    nombre: str = ""

    @abstractmethod
    def resolver(self, recurso: dict[str, Any], contexto: ContextoRecurso) -> Resultado:
        raise NotImplementedError

    def potencia_incidente_w(self, recurso: dict[str, Any], contexto: ContextoRecurso) -> float:
        raise NotImplementedError


_DISPOSITIVOS: dict[str, type[DispositivoBase]] = {}


def registrar_dispositivo(clave: str, clase: type[DispositivoBase]) -> None:
    _DISPOSITIVOS[clave] = clase


def crear_dispositivo(clave: str) -> DispositivoBase:
    if clave not in _DISPOSITIVOS:
        raise KeyError(f"dispositivo desconocido: {clave} ({list(_DISPOSITIVOS)})")
    return _DISPOSITIVOS[clave]()


def dispositivos_registrados() -> list[str]:
    return sorted(_DISPOSITIVOS.keys())
