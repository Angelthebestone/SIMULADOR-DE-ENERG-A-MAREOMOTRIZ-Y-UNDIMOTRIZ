"""Lienzos Matplotlib embebidos en Qt.

La animacion no recalcula fisica: muestrea las series que ya trae el Resultado
(app/animacion.py). Cada fotograma es una lectura de indice.
"""

from __future__ import annotations

from collections.abc import Callable
from typing import Any

import numpy as np
from matplotlib.backends.backend_qtagg import FigureCanvasQTAgg
from matplotlib.figure import Figure
from PySide6.QtCore import QTimer

from app.animacion import datos_animacion_desde_resultado, muestrear_serie
from interfaz.estilo import PALETA
from nucleo.resultado import Resultado

MS_POR_FOTOGRAMA = 40
FOTOGRAMAS_POR_AVISO = 3
DOMINIO_X_M = 240.0


class Lienzo(FigureCanvasQTAgg):
    def __init__(self, alto: float = 3.0) -> None:
        figura = Figure(figsize=(6.0, alto), layout="constrained")
        figura.patch.set_facecolor(PALETA["panel"])
        super().__init__(figura)
        self.ejes = figura.add_subplot(111)
        self.ejes.set_facecolor(PALETA["panel"])
        # La altura minima es la que la figura pide de verdad. Con menos, el
        # motor de composicion sacrifica la franja inferior y se pierden las
        # marcas y el rotulo del eje X.
        self.setMinimumHeight(int(alto * figura.dpi))

    def wheelEvent(self, evento: Any) -> None:  # noqa: N802  (nombre de Qt)
        """La rueda desplaza el panel; el lienzo no se queda el gesto.

        matplotlib reimplementa wheelEvent y no lo marca, y Qt da la rueda por
        atendida por defecto: con el cursor sobre cualquier grafico la pagina
        dejaba de poder recorrerse. Los lienzos que si usan la rueda —el mapa—
        la aceptan en su propia sobrecarga.
        """
        super().wheelEvent(evento)
        evento.ignore()

    def vaciar(self, mensaje: str) -> None:
        self.ejes.clear()
        self.ejes.set_axis_off()
        self.ejes.text(0.5, 0.5, mensaje, ha="center", va="center", color=PALETA["tenue"])
        self.draw_idle()


class LienzoOleaje(Lienzo):
    """eta(x,t) = (Hm0/2) cos(kx - wt) con el k del solucionador de dispersion."""

    def __init__(self) -> None:
        super().__init__(alto=3.2)
        self._datos: dict[str, Any] | None = None
        self._z_boya: np.ndarray | None = None
        self._fotograma = 0
        self._pausado = False
        self.k_rad_m = 0.0
        self.longitud_onda_m = 0.0
        self.observador: Callable[[float], None] | None = None
        self._temporizador = QTimer(self)
        self._temporizador.timeout.connect(self._avanzar)

    def set_pausado(self, pausado: bool) -> None:
        self._pausado = pausado
        if pausado:
            self._temporizador.stop()
        elif self._datos is not None:
            self._temporizador.start(MS_POR_FOTOGRAMA)

    def mostrar(self, resultado: Resultado) -> None:
        x = np.linspace(0.0, DOMINIO_X_M, 400)
        datos = datos_animacion_desde_resultado(resultado, x=x)
        self._datos = datos
        self.k_rad_m = float(datos["k"])
        self.longitud_onda_m = 2.0 * np.pi / self.k_rad_m if self.k_rad_m > 0 else 0.0
        self._z_boya = self._muestrear_boya(datos)
        self._fotograma = 0
        self._preparar_ejes(datos)
        if not self._pausado:
            self._temporizador.start(MS_POR_FOTOGRAMA)

    @staticmethod
    def _muestrear_boya(datos: dict[str, Any]) -> np.ndarray | None:
        if datos.get("boya_t") is None or datos.get("boya_z") is None:
            return None
        return np.asarray(muestrear_serie(datos["boya_t"], datos["boya_z"], datos["t"]))

    def _preparar_ejes(self, datos: dict[str, Any]) -> None:
        eta = np.asarray(datos["eta"])
        tope = float(np.max(np.abs(eta))) if eta.size else 1.0
        if self._z_boya is not None and self._z_boya.size:
            tope = max(tope, float(np.max(np.abs(self._z_boya))))
        self.ejes.clear()
        self.ejes.set_axis_on()
        self.ejes.set_xlim(0.0, DOMINIO_X_M)
        self.ejes.set_ylim(-1.6 * tope, 1.6 * tope)
        self.ejes.set_xlabel("distancia sobre el mar (m)")
        self.ejes.set_yticks([])
        (self._linea,) = self.ejes.plot([], [], color=PALETA["recurso"], linewidth=2)
        self._relleno = None
        (self._boya,) = self.ejes.plot(
            [], [], marker="o", markersize=16, color=PALETA["pto"], linestyle="none"
        )
        self._rotulo = self.ejes.set_title("")

    def _avanzar(self) -> None:
        if self._datos is None or self._pausado:
            return
        eta = np.asarray(self._datos["eta"])
        x = np.asarray(self._datos["x"])
        self._fotograma = (self._fotograma + 1) % eta.shape[0]
        fila = eta[self._fotograma, :]
        self._linea.set_data(x, fila)
        if self._relleno is not None:
            self._relleno.remove()
        self._relleno = self.ejes.fill_between(x, fila, -10.0, color=PALETA["captura"], alpha=0.35)
        x_boya = self._x_boya()
        self._boya.set_data([x_boya], [self._altura_boya(x_boya, x, fila)])
        self._rotulo.set_text(f"longitud de onda dibujada: {self.longitud_onda_m:.0f} m")
        self.draw_idle()
        self._avisar_observador(eta.shape[0])

    def _avisar_observador(self, n_fotogramas: int) -> None:
        if self.observador is None or self._fotograma % FOTOGRAMAS_POR_AVISO:
            return
        self.observador(self._fotograma / max(n_fotogramas - 1, 1))

    def _x_boya(self) -> float:
        """Donde kx = 2 pi, que es la fase en que esta definida la fuerza de excitacion."""
        cabe = 0.0 < self.longitud_onda_m <= 0.8 * DOMINIO_X_M
        return self.longitud_onda_m if cabe else 0.0

    def _altura_boya(self, x_boya: float, x: np.ndarray, fila: np.ndarray) -> float:
        if self._z_boya is not None and self._z_boya.size:
            return float(self._z_boya[self._fotograma])
        return float(np.interp(x_boya, x, fila))

    def detener(self) -> None:
        self._temporizador.stop()


class LienzoBarrido(Lienzo):
    def __init__(self, alto: float = 2.4) -> None:
        super().__init__(alto=alto)

    def mostrar(self, barrido: Any) -> None:
        self.ejes.clear()
        self.ejes.set_axis_on()
        self.ejes.plot(
            barrido.bpto_valores / 1000.0,
            barrido.potencia_w / 1000.0,
            color=PALETA["recurso"],
            label="potencia absorbida",
        )
        self.ejes.axvline(
            barrido.bpto_optimo / 1000.0,
            color=PALETA["pto"],
            linestyle="--",
            label=f"óptimo barrido {barrido.bpto_optimo/1000:.0f} kNs/m",
        )
        if barrido.bpto_optimo_analitico:
            self.ejes.axvline(
                barrido.bpto_optimo_analitico / 1000.0,
                color=PALETA["electrico"],
                linestyle=":",
                label=f"óptimo analítico {barrido.bpto_optimo_analitico/1000:.0f} kNs/m",
            )
        self.ejes.set_xlabel("amortiguamiento del PTO (kNs/m)")
        self.ejes.set_ylabel("potencia (kW)")
        self.ejes.legend(fontsize="small")
        self.draw_idle()


class LienzoMatriz(Lienzo):
    def __init__(self, alto: float = 3.0) -> None:
        super().__init__(alto=alto)
        self._barra = None

    def mostrar(self, dispersion: Any, contribucion: np.ndarray) -> None:
        # ejes.clear() no retira el eje del colorbar: sin esto cada matriz nueva
        # anadia uno y el grafico se iba encogiendo. Se quita su eje antes de
        # limpiar, porque Colorbar.remove() ya no funciona una vez desmontado.
        if self._barra is not None:
            self._barra.ax.remove()
            self._barra = None
        self.ejes.clear()
        self.ejes.set_axis_on()
        malla = self.ejes.pcolormesh(
            dispersion.te_bordes_s, dispersion.hs_bordes_m, contribucion, cmap="viridis"
        )
        self._barra = self.figure.colorbar(malla, ax=self.ejes, label="contribución al AEP (%)")
        self.ejes.set_xlabel("Te (s)")
        self.ejes.set_ylabel("Hs (m)")
        self.draw_idle()


class LienzoRespuesta(Lienzo):
    """Amplitud de la boya frente al periodo de la ola: aqui se ve la resonancia."""

    def __init__(self, alto: float = 2.6) -> None:
        super().__init__(alto=alto)

    def mostrar(
        self, respuesta: Any, te_actual: float, amplitud_actual: float | None = None
    ) -> None:
        self.ejes.clear()
        self.ejes.set_axis_on()
        veces = respuesta.amplitud_m / respuesta.amplitud_ola_m
        self.ejes.plot(respuesta.te_s, veces, color=PALETA["recurso"], linewidth=2)
        self.ejes.axhline(1.0, color=PALETA["tenue"], linewidth=1, linestyle=":")
        # Si el maximo cae en el borde del barrido no hay resonancia dentro de
        # la ventana: anunciar ese Te como el preferido es un artefacto.
        if getattr(respuesta, "pico_interior", True):
            self.ejes.axvline(
                respuesta.te_resonante_s,
                color=PALETA["electrico"],
                linestyle="--",
                label=f"la boya prefiere {respuesta.te_resonante_s:.1f} s",
            )
        else:
            self.ejes.plot(
                [],
                [],
                linestyle="none",
                label=f"sin resonancia entre {respuesta.te_s[0]:.0f} y {respuesta.te_s[-1]:.0f} s",
            )
        altura = (
            amplitud_actual / respuesta.amplitud_ola_m
            if amplitud_actual is not None and respuesta.amplitud_ola_m > 0
            else float(np.interp(te_actual, respuesta.te_s, veces))
        )
        self.ejes.plot(
            [te_actual],
            [altura],
            marker="o",
            markersize=13,
            color=PALETA["pto"],
            linestyle="none",
            label="estás aquí",
        )
        self.ejes.set_xlabel("cada cuánto llega una ola (s)")
        self.ejes.set_ylabel("veces la ola")
        self.ejes.set_ylim(0.0, max(2.5, float(np.max(veces)) * 1.15))
        self.ejes.legend(fontsize="small", loc="upper right")
        self.draw_idle()


class LienzoSeries(Lienzo):
    """La maquina trabajando: posicion de la boya y potencia instantanea en el tiempo."""

    def __init__(self, alto: float = 2.8) -> None:
        super().__init__(alto=alto)
        self.ejes_potencia = self.ejes.twinx()
        self._marca = None
        self._ventana_s = (0.0, 1.0)

    def mostrar(self, resultado: Resultado, periodos: float = 4.0) -> None:
        series = resultado.series
        if "t_s" not in series or "z_m" not in series:
            self.vaciar("este dispositivo no entrega serie temporal")
            return
        tiempo = np.asarray(series["t_s"], dtype=float)
        recorte = tiempo >= tiempo[-1] - periodos * self._periodo(resultado)
        self._dibujar(tiempo[recorte], series, recorte)

    @staticmethod
    def _periodo(resultado: Resultado) -> float:
        return float(resultado.recurso.get("te", resultado.recurso.get("Te", 8.0)))

    def _dibujar(self, tiempo: np.ndarray, series: dict[str, Any], recorte: np.ndarray) -> None:
        self.ejes.clear()
        self.ejes_potencia.clear()
        self.ejes.set_axis_on()
        self.ejes.plot(
            tiempo,
            np.asarray(series["z_m"])[recorte],
            color=PALETA["pto"],
            linewidth=2,
            label="sube y baja la boya",
        )
        if "p_pto_w" in series:
            self.ejes_potencia.fill_between(
                tiempo,
                np.asarray(series["p_pto_w"])[recorte] / 1000.0,
                color=PALETA["electrico"],
                alpha=0.30,
                label="energía que entrega",
            )
            # clear() sobre el eje gemelo devuelve las marcas y el rotulo a la
            # izquierda, donde se montaban encima de "metros".
            self.ejes_potencia.yaxis.tick_right()
            self.ejes_potencia.yaxis.set_label_position("right")
            self.ejes_potencia.set_ylabel("kW")
        self.ejes.set_xlabel("tiempo (s)")
        self.ejes.set_ylabel("metros")
        # Hueco arriba para que la leyenda no tape el primer ciclo de la boya.
        inferior, superior = self.ejes.get_ylim()
        self.ejes.set_ylim(inferior, superior + 0.35 * (superior - inferior))
        self.ejes.legend(fontsize="small", loc="upper left", framealpha=0.85)
        self._marca = self.ejes.axvline(tiempo[0], color=PALETA["acento"], linewidth=1.5)
        self._ventana_s = (float(tiempo[0]), float(tiempo[-1]))
        self.draw_idle()

    def marcar_instante(self, fraccion: float) -> None:
        """Mueve la linea vertical al mismo compas que la animacion."""
        if self._marca is None:
            return
        inicio, fin = self._ventana_s
        instante = inicio + (fin - inicio) * max(0.0, min(1.0, fraccion))
        self._marca.set_xdata([instante, instante])
        self.draw_idle()
