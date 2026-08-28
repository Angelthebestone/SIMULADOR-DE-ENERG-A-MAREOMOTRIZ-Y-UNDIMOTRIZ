"""Ventana principal: conmutador de niveles, hilo de calculo y cancelacion.

Ningun calculo ocurre en el hilo de la interfaz. El trabajo corre en app/trabajo.py
y vuelve por señales Qt, que es lo unico que puede tocar los widgets.
"""

from __future__ import annotations

import sys
from dataclasses import replace
from typing import Any

from PySide6.QtCore import QObject, Qt, QTimer, Signal
from PySide6.QtGui import QKeySequence, QShortcut
from PySide6.QtWidgets import (
    QApplication,
    QButtonGroup,
    QCheckBox,
    QComboBox,
    QFrame,
    QHBoxLayout,
    QLabel,
    QMainWindow,
    QMessageBox,
    QProgressBar,
    QPushButton,
    QScrollArea,
    QStackedWidget,
    QStatusBar,
    QVBoxLayout,
    QWidget,
)

from app.exportacion import exportar_csv, exportar_figuras_datos
from app.limitaciones import texto_limitaciones
from app.niveles import NIVELES, GestorNiveles
from app.tesis import contraste_isla_fuerte_vs_umbral, tesis_texto
from app.trabajo import Trabajo
from app.vocabulario import descripcion_nivel
from interfaz.calculo import SITIOS, Parametros, simular
from interfaz.estilo import hoja_estilos
from interfaz.paneles import (
    PanelCalcular,
    PanelComparar,
    PanelDisenar,
    PanelVer,
    semaforo_resultado,
)

ROTULOS = {"ver": "Ver", "comparar": "Comparar", "calcular": "Calcular", "disenar": "Diseñar"}
MS_ESPERA_CONTROL = 250


class Puente(QObject):
    """Traduce los avisos del hilo de trabajo a señales Qt del hilo de interfaz."""

    progreso = Signal(int)
    resultado = Signal(object)
    error = Signal(str)


class VentanaPrincipal(QMainWindow):
    def __init__(self) -> None:
        super().__init__()
        self.setWindowTitle("Simulador de energía marina — FCN030 UTS")
        self.parametros = Parametros()
        self.gestor: GestorNiveles | None = None
        self.trabajo: Trabajo | None = None
        self._puente = Puente()
        self._puente.progreso.connect(self._al_progresar)
        self._puente.resultado.connect(self._al_terminar)
        self._puente.error.connect(self._al_fallar)
        self._espera = QTimer(self)
        self._espera.setSingleShot(True)
        self._espera.timeout.connect(self.lanzar)
        self._construir()
        self.lanzar()

    def _construir(self) -> None:
        central = QWidget()
        columna = QVBoxLayout(central)
        columna.setContentsMargins(10, 8, 10, 8)
        columna.setSpacing(8)
        columna.addWidget(self._barra_tesis())
        columna.addWidget(self._separador())
        columna.addLayout(self._barra_niveles())
        columna.addWidget(self._separador())
        self.pila = QStackedWidget()
        self.paneles = {
            "ver": PanelVer(),
            "comparar": PanelComparar(),
            "calcular": PanelCalcular(),
            "disenar": PanelDisenar(),
        }
        for nivel in NIVELES:
            self.pila.addWidget(self._con_scroll(self.paneles[nivel]))
        self.paneles["ver"].parametros_cambiados.connect(self._pedir_recalculo)
        self.paneles["disenar"].parametros_cambiados.connect(self._pedir_recalculo)
        self.paneles["disenar"].calculo_completo_pedido.connect(self._lanzar_completo)
        self.paneles["disenar"].sitio_elegido.connect(self._elegir_sitio_en_mapa)
        columna.addWidget(self.pila, stretch=1)
        columna.addLayout(self._barra_progreso())
        self.setCentralWidget(central)
        self.setStatusBar(QStatusBar())
        self.setStyleSheet(hoja_estilos(False))
        self._atajos()
        self.resize(1280, 860)

    @staticmethod
    def _con_scroll(panel: QWidget) -> QScrollArea:
        """Cada nivel dentro de su area desplazable.

        En una pantalla baja, o con el modo sustentacion, el contenido no cabia
        y se recortaba sin mas: los graficos tienen altura minima y las tablas
        crecen con las filas. Con esto aparece barra vertical cuando hace falta
        y el ancho sigue mandandolo la ventana.
        """
        area = QScrollArea()
        area.setWidgetResizable(True)
        area.setFrameShape(QFrame.NoFrame)
        area.setHorizontalScrollBarPolicy(Qt.ScrollBarAsNeeded)
        area.setVerticalScrollBarPolicy(Qt.ScrollBarAsNeeded)
        area.setWidget(panel)
        return area

    def _separador(self) -> QFrame:
        linea = QFrame()
        linea.setFrameShape(QFrame.HLine)
        linea.setFrameShadow(QFrame.Plain)
        linea.setStyleSheet("color: #D6D6D1; max-height: 1px;")
        return linea

    def _barra_tesis(self) -> QWidget:
        cont = QWidget()
        fila = QHBoxLayout(cont)
        fila.setContentsMargins(0, 0, 0, 0)
        fila.setSpacing(10)
        contraste = contraste_isla_fuerte_vs_umbral()
        self.etiqueta_tesis = QLabel(str(contraste["texto"]))
        self.etiqueta_tesis.setProperty("papel", "tesis")
        self.etiqueta_tesis.setWordWrap(True)
        self.etiqueta_tesis.setToolTip(tesis_texto())
        fila.addWidget(self.etiqueta_tesis, stretch=1)
        self.etiqueta_semaforo_inline = QLabel("")
        self.etiqueta_semaforo_inline.setTextFormat(Qt.RichText)
        self.etiqueta_semaforo_inline.setAlignment(Qt.AlignRight | Qt.AlignVCenter)
        self.etiqueta_semaforo_inline.setMinimumWidth(320)
        fila.addWidget(self.etiqueta_semaforo_inline)
        return cont

    def _barra_niveles(self) -> QHBoxLayout:
        fila = QHBoxLayout()
        fila.setSpacing(6)
        self.grupo_niveles = QButtonGroup(self)
        for indice, nivel in enumerate(NIVELES):
            boton = QPushButton(ROTULOS[nivel])
            boton.setCheckable(True)
            boton.setToolTip(descripcion_nivel(nivel))
            boton.setChecked(nivel == "ver")
            boton.setMinimumHeight(30)
            self.grupo_niveles.addButton(boton, indice)
            fila.addWidget(boton)
        self.grupo_niveles.idClicked.connect(self.cambiar_nivel)
        fila.addSpacing(12)
        sep = QFrame()
        sep.setFrameShape(QFrame.VLine)
        sep.setFrameShadow(QFrame.Plain)
        sep.setStyleSheet("color: #B8B8B2; max-width: 1px;")
        fila.addWidget(sep)
        fila.addSpacing(6)
        fila.addWidget(QLabel("Emplazamiento"))
        self.combo_sitio = QComboBox()
        self.combo_sitio.addItems(SITIOS)
        self.combo_sitio.currentTextChanged.connect(self._cambiar_sitio)
        self.combo_sitio.setMinimumWidth(170)
        fila.addWidget(self.combo_sitio)
        fila.addStretch()
        self.casilla_sustentacion = QCheckBox("Modo sustentación")
        self.casilla_sustentacion.setToolTip("Aumenta el tamaño de letra para proyección")
        self.casilla_sustentacion.toggled.connect(
            lambda activo: self.setStyleSheet(hoja_estilos(activo))
        )
        fila.addWidget(self.casilla_sustentacion)
        boton_limitaciones = QPushButton("Limitaciones y fuentes")
        boton_limitaciones.setToolTip("Fuentes, supuestos y límites del modelo")
        boton_limitaciones.clicked.connect(self._mostrar_limitaciones)
        fila.addWidget(boton_limitaciones)
        return fila

    def _barra_progreso(self) -> QHBoxLayout:
        fila = QHBoxLayout()
        fila.setSpacing(8)
        self.etiqueta_semaforo = QLabel("")
        self.etiqueta_semaforo.setTextFormat(Qt.RichText)
        fila.addWidget(self.etiqueta_semaforo, stretch=1)
        self.barra = QProgressBar()
        self.barra.setRange(0, 100)
        self.barra.setVisible(False)
        self.barra.setMinimumWidth(160)
        self.barra.setMaximumHeight(14)
        fila.addWidget(self.barra)
        self.boton_cancelar = QPushButton("Cancelar (ESC)")
        self.boton_cancelar.setEnabled(False)
        self.boton_cancelar.clicked.connect(self.cancelar)
        fila.addWidget(self.boton_cancelar)
        return fila

    def _atajos(self) -> None:
        QShortcut(QKeySequence("Esc"), self, self.cancelar)
        QShortcut(QKeySequence("Ctrl+E"), self, self.exportar)

    def cambiar_nivel(self, indice: int) -> None:
        nivel = NIVELES[indice]
        self.pila.setCurrentIndex(indice)
        if self.gestor is not None:
            self.gestor.cambiar_nivel(nivel)
        self.statusBar().showMessage(f"Nivel {ROTULOS[nivel]}: {descripcion_nivel(nivel)}")

    def _cambiar_sitio(self, sitio_id: str) -> None:
        self.parametros = replace(self.parametros, sitio_id=sitio_id)
        self.paneles["disenar"].mapa.fijar_sitio(sitio_id)
        # Por el antirrebote, igual que los deslizadores: recorrer el desplegable
        # con el teclado lanzaba un hilo de calculo por cada emplazamiento.
        self._pedir_recalculo()

    def _elegir_sitio_en_mapa(self, sitio_id: str) -> None:
        """Un punto del mapa fija el emplazamiento para el resto de la aplicacion."""
        self.combo_sitio.setCurrentText(sitio_id)
        self.statusBar().showMessage(self.paneles["disenar"].mapa.descripcion_sitio(sitio_id))

    def _pedir_recalculo(self) -> None:
        self._espera.start(MS_ESPERA_CONTROL)

    def _lanzar_completo(self) -> None:
        self.lanzar(completo=True)

    def lanzar(self, completo: bool = False) -> None:
        if self.trabajo is not None and self.trabajo.esta_en_curso():
            self.trabajo.cancelar()
        params = self.paneles["disenar"].parametros(self.paneles["ver"].parametros(self.parametros))
        self.parametros = replace(params, completo=completo)
        objetivo = self.parametros

        def tarea(progreso: Any, cancelado: Any) -> dict[str, Any]:
            return simular(objetivo, progreso, cancelado)

        self.trabajo = Trabajo(
            tarea,
            on_progreso=self._puente.progreso.emit,
            on_resultado=self._puente.resultado.emit,
            on_error=self._puente.error.emit,
        )
        self._marcar_en_curso(True)
        self.trabajo.iniciar()

    def cancelar(self) -> None:
        if self.trabajo is None or not self.trabajo.esta_en_curso():
            return
        self.trabajo.cancelar()
        self._marcar_en_curso(False)
        self.statusBar().showMessage("Simulación cancelada; la aplicación sigue disponible.")

    def _marcar_en_curso(self, en_curso: bool) -> None:
        self.barra.setVisible(en_curso)
        self.barra.setValue(0)
        self.boton_cancelar.setEnabled(en_curso)
        if en_curso:
            self.statusBar().showMessage("Simulando… la ventana sigue respondiendo.")

    def _al_progresar(self, valor: int) -> None:
        # Las señales que el hilo ya habia emitido siguen llegando por la cola
        # despues de cancelar; sin esta guarda dejaban la barra en un valor
        # intermedio que ya no describe nada.
        if self.trabajo is None or not self.trabajo.esta_en_curso():
            return
        self.barra.setValue(valor)

    def _al_terminar(self, salida: object) -> None:
        datos = dict(salida)  # type: ignore[arg-type]
        resultado = datos["resultado"]
        extras = datos["extras"]
        if extras.get("estado") == "cancelado":
            self._marcar_en_curso(False)
            return
        self.gestor = GestorNiveles(resultado)
        for panel in self.paneles.values():
            panel.actualizar(resultado, extras)
        html = semaforo_resultado(extras)
        self.etiqueta_semaforo.setText(html)
        self.etiqueta_semaforo_inline.setText(html)
        self._marcar_en_curso(False)
        self.statusBar().showMessage(self._mensaje_de_estado(extras, resultado))

    @staticmethod
    def _mensaje_de_estado(extras: dict[str, Any], resultado: Any) -> str:
        """Lo eliminatorio manda: un area protegida pesa mas que un aviso de modelo."""
        panel = extras.get("panel_sitio")
        if panel is not None and panel.eliminatorio:
            return f"{panel.nombre}: {panel.veredicto}"
        avisos = list(extras.get("avisos_entrada", [])) + list(resultado.avisos)
        return avisos[0] if avisos else "Cálculo terminado."

    def _al_fallar(self, mensaje: str) -> None:
        self._marcar_en_curso(False)
        self.statusBar().showMessage(f"Error: {mensaje}")

    def _mostrar_limitaciones(self) -> None:
        QMessageBox.information(self, "Limitaciones declaradas", texto_limitaciones())

    def exportar(self) -> None:
        if self.gestor is None:
            return
        ruta = exportar_csv(self.gestor.resultado, "salidas/resultado.csv")
        exportar_figuras_datos(self.gestor.resultado, "salidas")
        self.statusBar().showMessage(f"Exportado a {ruta} (con hash, versión de datos y fecha)")


def main() -> int:
    aplicacion = QApplication(sys.argv)
    ventana = VentanaPrincipal()
    ventana.show()
    ventana.statusBar().showMessage(
        "Sin conexión a internet: todos los datos salen de datos/, la aplicación opera igual."
    )
    return int(aplicacion.exec())


if __name__ == "__main__":
    raise SystemExit(main())
