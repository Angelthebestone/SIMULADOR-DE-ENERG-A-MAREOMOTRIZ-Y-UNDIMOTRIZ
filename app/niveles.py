from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from nucleo.resultado import Resultado

NIVELES: tuple[str, ...] = ("ver", "comparar", "calcular", "disenar")


@dataclass
class VistaNivel:
    nivel: str
    resultado: Resultado
    extras: dict[str, Any]

    @property
    def produccion_mwh(self) -> float:
        return float(self.resultado.produccion_anual_mwh)

    @property
    def potencia_w(self) -> float:
        return float(self.resultado.potencia_nominal_w)


class GestorNiveles:
    def __init__(self, resultado: Resultado) -> None:
        self._resultado = resultado
        self._nivel_activo = "ver"

    @property
    def resultado(self) -> Resultado:
        return self._resultado

    @property
    def nivel_activo(self) -> str:
        return self._nivel_activo

    def cambiar_nivel(self, nivel: str) -> VistaNivel:
        if nivel not in NIVELES:
            raise ValueError(f"nivel desconocido: {nivel}")
        self._nivel_activo = nivel
        return self.vista_actual()

    def vista_actual(self) -> VistaNivel:
        return VistaNivel(nivel=self._nivel_activo, resultado=self._resultado, extras={})

    def vistas_todas(self) -> dict[str, VistaNivel]:
        return {n: VistaNivel(nivel=n, resultado=self._resultado, extras={}) for n in NIVELES}

    def produccion_identica_en_todos(self) -> bool:
        vistas = self.vistas_todas()
        vals = [v.produccion_mwh for v in vistas.values()]
        return len(set(vals)) == 1
