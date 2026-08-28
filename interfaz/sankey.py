"""Diagrama de Sankey de la cadena de conversion completa (10.1)."""

from __future__ import annotations

from matplotlib.sankey import Sankey

from app.formato import formatear_numero, formatear_porcentaje, formatear_potencia_w
from interfaz.estilo import PALETA
from interfaz.graficas import Lienzo
from nucleo.resultado import Eslabon, Resultado

COLOR_ESLABON = [PALETA["captura"], PALETA["pto"], PALETA["electrico"], PALETA["recurso"]]
ANCHO_MAYOR_FLUJO = 0.3
LARGO_TRONCO = 1.4


class LienzoSankey(Lienzo):
    def __init__(self) -> None:
        super().__init__(alto=4.0)

    def mostrar(self, resultado: Resultado) -> None:
        self.ejes.clear()
        self.ejes.set_axis_off()
        if not resultado.eslabones:
            self.vaciar("sin cadena que dibujar todavía")
            return
        entrada_w = resultado.eslabones[0].potencia_entrada_w
        if entrada_w <= 0:
            self.vaciar("potencia incidente nula: nada que repartir")
            return
        diagrama = Sankey(
            ax=self.ejes,
            scale=ANCHO_MAYOR_FLUJO / (entrada_w / 1000.0),
            gap=0.18,
            format=lambda kilovatios: f"{formatear_numero(abs(kilovatios), 1)} kW",
        )
        for indice, eslabon in enumerate(resultado.eslabones):
            self._anadir(diagrama, indice, eslabon)
        diagrama.finish()
        salida_w = resultado.eslabones[-1].potencia_salida_w
        self.ejes.set_title(
            f"Entran {formatear_potencia_w(entrada_w)} del oleaje y salen "
            f"{formatear_potencia_w(salida_w)} al cable — "
            f"{formatear_porcentaje(resultado.eficiencia_ola_cable)} de la cadena"
        )
        self.draw_idle()

    @staticmethod
    def _anadir(diagrama: Sankey, indice: int, eslabon: Eslabon) -> None:
        entrada = eslabon.potencia_entrada_w / 1000.0
        salida = eslabon.potencia_salida_w / 1000.0
        diagrama.add(
            flows=[entrada, -max(entrada - salida, 0.0), -salida],
            labels=[None, f"pérdida en {eslabon.nombre}", None],
            orientations=[0, 1, 0],
            trunklength=LARGO_TRONCO,
            facecolor=COLOR_ESLABON[indice % len(COLOR_ESLABON)],
            prior=None if indice == 0 else indice - 1,
            connect=None if indice == 0 else (2, 0),
        )
