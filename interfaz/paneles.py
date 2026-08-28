"""Los cuatro niveles: cuatro vistas del mismo Resultado, nunca cuatro calculos."""

from __future__ import annotations

import json
import pathlib
from dataclasses import replace
from typing import Any

from PySide6.QtCore import Qt, Signal
from PySide6.QtGui import QColor
from PySide6.QtWidgets import (
    QCheckBox,
    QComboBox,
    QDoubleSpinBox,
    QFormLayout,
    QGroupBox,
    QHBoxLayout,
    QHeaderView,
    QLabel,
    QPushButton,
    QScrollArea,
    QSlider,
    QTableWidget,
    QTableWidgetItem,
    QTabWidget,
    QVBoxLayout,
    QWidget,
)

from app.formato import (
    formatear_magnitud,
    formatear_numero,
    formatear_porcentaje,
    formatear_potencia_w,
)
from analisis.aep import comparar_aep_con_pulgar
from app.vocabulario import explicar_cambio, traducir
from interfaz.calculo import DISPOSITIVOS, Parametros, comparar_dos, economia_completa
from nucleo.dispositivos.absorbedor import MASA_FLOTACION_KG
from interfaz.estilo import COLOR_SEMAFORO, SIMBOLO_SEMAFORO, TEXTO_VACIO, semaforo_html
from interfaz.graficas import (
    LienzoBarrido,
    LienzoMatriz,
    LienzoOleaje,
    LienzoRespuesta,
    LienzoSeries,
)
from matplotlib.backends.backend_qtagg import NavigationToolbar2QT

from interfaz.mapa import LienzoMapa
from interfaz.sankey import LienzoSankey
from nucleo.constantes import RHO_AGUA_MAR, G
from nucleo.resultado import Resultado

FUENTES_CONSTANTES: dict[str, tuple[float, str, str]] = {
    "rho agua de mar": (RHO_AGUA_MAR, "kg/m³", "Handbook cap. 1 — agua de mar 1025 kg/m³"),
    "g": (G, "m/s²", "Valor normal de la gravedad, 9,81 m/s²"),
    "horas del año": (8766.0, "h", "8766 h = 365,25 días, Handbook cap. 1 §4.2"),
}


def _etiqueta(texto: str, papel: str | None = None, estado: str | None = None) -> QLabel:
    etq = QLabel(texto)
    etq.setWordWrap(True)
    etq.setTextInteractionFlags(Qt.TextSelectableByMouse)
    if papel:
        etq.setProperty("papel", papel)
    if estado:
        etq.setProperty("estado", estado)
    return etq


def _tabla(columnas: list[str]) -> QTableWidget:
    tabla = QTableWidget(0, len(columnas))
    tabla.setHorizontalHeaderLabels(columnas)
    tabla.verticalHeader().setVisible(False)
    tabla.setEditTriggers(QTableWidget.NoEditTriggers)
    tabla.setWordWrap(True)
    tabla.setAlternatingRowColors(True)
    tabla.horizontalHeader().setSectionResizeMode(QHeaderView.Stretch)
    tabla.horizontalHeader().setHighlightSections(False)
    return tabla


def _fila(tabla: QTableWidget, valores: list[str], fuente: str | None = None) -> None:
    fila = tabla.rowCount()
    tabla.insertRow(fila)
    for columna, texto in enumerate(valores):
        celda = QTableWidgetItem(texto)
        if fuente:
            celda.setToolTip(fuente)
        if texto in COLOR_SEMAFORO:
            celda.setText(f"{SIMBOLO_SEMAFORO[texto]} {texto}")
            celda.setForeground(QColor(COLOR_SEMAFORO[texto]))
        tabla.setItem(fila, columna, celda)


def _valor_legible(valor: float | str) -> str:
    return formatear_numero(valor, 2) if isinstance(valor, (int, float)) else str(valor)


def _leer_json(carpeta: str) -> list[dict[str, Any]]:
    base = pathlib.Path(carpeta)
    if not base.exists():
        return []
    fichas = []
    for ruta in sorted(base.glob("*.json")):
        try:
            fichas.append(json.loads(ruta.read_text(encoding="utf-8")))
        except (OSError, json.JSONDecodeError):
            continue
    return fichas


class Panel(QWidget):
    """Base de los cuatro niveles: recibe el Resultado, nunca lo calcula."""

    parametros_cambiados = Signal()

    def __init__(self) -> None:
        super().__init__()
        self.resultado: Resultado | None = None
        self.extras: dict[str, Any] = {}

    def actualizar(self, resultado: Resultado, extras: dict[str, Any]) -> None:
        self.resultado = resultado
        self.extras = extras
        self.pintar()

    def pintar(self) -> None:
        raise NotImplementedError


class PanelVer(Panel):
    """Animacion movida por el modelo, tres controles y viviendas alimentadas."""

    FOTOGRAMAS_POR_MARCA = 3

    def __init__(self) -> None:
        super().__init__()
        self._anterior: dict[str, float] = {}
        disposicion = QVBoxLayout(self)
        disposicion.setSpacing(10)
        disposicion.setContentsMargins(4, 4, 4, 4)
        barra = QHBoxLayout()
        self.boton_pausa = QPushButton("⏸ Pausa")
        self.boton_pausa.setCheckable(True)
        self.boton_pausa.setToolTip("Pausa o reanuda la animación del oleaje")
        self.boton_pausa.toggled.connect(self._toggle_animacion)
        barra.addWidget(self.boton_pausa)
        barra.addStretch()
        intro = _etiqueta("Simulación resuelta por integración — cada fotograma es una lectura, no un recálculo.", papel="subtitulo")
        barra.addWidget(intro)
        disposicion.addLayout(barra)
        self.lienzo = LienzoOleaje()
        self.lienzo.observador = self._sincronizar_marca
        self.boton_pausa.toggled.connect(lambda p: self.lienzo.set_pausado(p))
        disposicion.addWidget(self.lienzo, stretch=3)
        self.titular = _etiqueta(TEXTO_VACIO, papel="titular", estado="vacio")
        disposicion.addWidget(self.titular)
        self.pie = _etiqueta("", papel="subtitulo")
        disposicion.addWidget(self.pie)
        self.explicacion = _etiqueta(explicar_cambio({}, {}), estado="vacio")
        disposicion.addWidget(self.explicacion)
        disposicion.addLayout(self._lienzos_didacticos(), stretch=2)
        disposicion.addWidget(self._controles())

    def _toggle_animacion(self, pausado: bool) -> None:
        self.boton_pausa.setText("▶ Reanudar" if pausado else "⏸ Pausa")

    def _lienzos_didacticos(self) -> QHBoxLayout:
        fila = QHBoxLayout()
        fila.setSpacing(10)
        self.lienzo_respuesta = LienzoRespuesta()
        self.lienzo_series = LienzoSeries()
        fila.addWidget(
            self._encuadrar(
                "¿Cuánto se mueve la boya según el ritmo de las olas?", self.lienzo_respuesta
            )
        )
        fila.addWidget(self._encuadrar("La máquina trabajando", self.lienzo_series))
        return fila

    @staticmethod
    def _encuadrar(titulo: str, widget: QWidget) -> QGroupBox:
        grupo = QGroupBox(titulo)
        QVBoxLayout(grupo).addWidget(widget)
        return grupo

    def _sincronizar_marca(self, fraccion: float) -> None:
        self.lienzo_series.marcar_instante(fraccion)

    def _controles(self) -> QGroupBox:
        grupo = QGroupBox("Controles — altura (Hm0), ritmo (Te) y freno (B_pto)")
        col = QVBoxLayout(grupo)
        col.setSpacing(4)
        sub = _etiqueta("Tres cosas que puedes mover — la explicación aparece abajo.", papel="subtitulo")
        col.addWidget(sub)
        formulario = QFormLayout()
        formulario.setSpacing(8)
        formulario.setLabelAlignment(Qt.AlignRight | Qt.AlignVCenter)
        self.deslizador_olas = self._deslizador(5, 40, 15)
        self.deslizador_periodo = self._deslizador(40, 120, 70)
        self.deslizador_freno = self._deslizador(10, 500, 80)
        self.valor_olas = QLabel()
        self.valor_periodo = QLabel()
        self.valor_freno = QLabel()
        for lbl in (self.valor_olas, self.valor_periodo, self.valor_freno):
            lbl.setProperty("papel", "subtitulo")
            lbl.setMinimumWidth(110)
            lbl.setAlignment(Qt.AlignRight | Qt.AlignVCenter)
        self._actualizar_valores()
        self.deslizador_olas.valueChanged.connect(lambda _: (self._actualizar_valores(), self.parametros_cambiados.emit()))
        self.deslizador_periodo.valueChanged.connect(lambda _: (self._actualizar_valores(), self.parametros_cambiados.emit()))
        self.deslizador_freno.valueChanged.connect(lambda _: (self._actualizar_valores(), self.parametros_cambiados.emit()))
        formulario.addRow(traducir("Hm0").capitalize(), self._fila_control(self.deslizador_olas, self.valor_olas))
        formulario.addRow(traducir("Te").capitalize(), self._fila_control(self.deslizador_periodo, self.valor_periodo))
        formulario.addRow(traducir("B_pto").capitalize(), self._fila_control(self.deslizador_freno, self.valor_freno))
        col.addLayout(formulario)
        return grupo

    @staticmethod
    def _fila_control(slider: QSlider, valor: QLabel) -> QWidget:
        cont = QWidget()
        fila = QHBoxLayout(cont)
        fila.setContentsMargins(0, 0, 0, 0)
        fila.setSpacing(8)
        fila.addWidget(slider, stretch=1)
        fila.addWidget(valor)
        return cont

    def _actualizar_valores(self) -> None:
        self.valor_olas.setText(f"{self.deslizador_olas.value() / 10:.1f} m")
        self.valor_periodo.setText(f"{self.deslizador_periodo.value() / 10:.1f} s")
        self.valor_freno.setText(f"{self.deslizador_freno.value():.0f} kNs/m")

    def _deslizador(self, minimo: int, maximo: int, valor: int) -> QSlider:
        deslizador = QSlider(Qt.Horizontal)
        deslizador.setRange(minimo, maximo)
        deslizador.setValue(valor)
        deslizador.setTickPosition(QSlider.TicksBelow)
        deslizador.setTickInterval(max(5, (maximo - minimo) // 6))
        deslizador.setSingleStep(1)
        deslizador.setPageStep(5)
        return deslizador

    def parametros(self, base: Parametros) -> Parametros:
        return replace(
            base,
            hm0_m=self.deslizador_olas.value() / 10.0,
            te_s=self.deslizador_periodo.value() / 10.0,
            b_pto_ns_m=self.deslizador_freno.value() * 1000.0,
            completo=False,
        )

    def pintar(self) -> None:
        if self.resultado is None:
            return
        self.lienzo.mostrar(self.resultado)
        viviendas = self.extras.get("viviendas", {})
        self.titular.setProperty("estado", None)
        if viviendas.get("viviendas") is None:
            self.titular.setProperty("estado", "pendiente")
            self.titular.setText("Todavía no se puede decir para cuántas casas alcanza")
            self.pie.setText(str(viviendas.get("fuente", "")))
        else:
            casas = formatear_numero(float(viviendas["viviendas"]), 0)
            self.titular.setText(f"Alcanza para {casas} casas")
            self.pie.setText(
                "Con lo que gasta una casa de Isla Fuerte en un mes: "
                + formatear_magnitud(float(viviendas["consumo_kwh_mes"]), "kWh al mes", 1)
            )
        self.titular.style().polish(self.titular)
        self._pintar_didactica()

    def _pintar_didactica(self) -> None:
        assert self.resultado is not None
        respuesta = self.extras.get("respuesta")
        parametros = self.extras.get("parametros")
        self.lienzo_series.mostrar(self.resultado)
        if respuesta is None or parametros is None:
            return
        self.lienzo_respuesta.mostrar(
            respuesta, parametros.te_s, self.extras.get("amplitud_boya_m")
        )
        ahora = {
            "hm0_m": parametros.hm0_m,
            "te_s": parametros.te_s,
            "b_pto_ns_m": parametros.b_pto_ns_m,
        }
        self.explicacion.setProperty("estado", None if self._anterior else "vacio")
        # Sin pico dentro del barrido no hay periodo preferido que contar.
        resonante = respuesta.te_resonante_s if respuesta.pico_interior else None
        self.explicacion.setText(explicar_cambio(self._anterior, ahora, resonante))
        self.explicacion.style().polish(self.explicacion)
        self._anterior = ahora


class PanelComparar(Panel):
    """Perdidas, fichas reales, catalogo EMEC y dos tecnologias en paralelo."""

    def __init__(self) -> None:
        super().__init__()
        disposicion = QVBoxLayout(self)
        disposicion.setContentsMargins(4, 4, 4, 4)
        pestanas = QTabWidget()
        disposicion.addWidget(pestanas)
        pestanas.addTab(self._pestana_cadena(), "Dónde se pierde")
        pestanas.addTab(self._pestana_paralelo(), "Dos tecnologías")
        pestanas.addTab(self._pestana_fichas(), "Dispositivos reales y fracasos")
        pestanas.addTab(self._pestana_catalogo(), "Catálogo EMEC")

    def _pestana_cadena(self) -> QWidget:
        contenedor = QWidget()
        disposicion = QVBoxLayout(contenedor)
        self.lienzo_sankey = LienzoSankey()
        disposicion.addWidget(self.lienzo_sankey, stretch=4)
        self.tabla_perdidas = _tabla(["Eslabón", "Entra", "Sale", "Se pierde", "Aprovecha"])
        disposicion.addWidget(self.tabla_perdidas, stretch=2)
        return contenedor

    def _pestana_paralelo(self) -> QWidget:
        contenedor = QWidget()
        disposicion = QVBoxLayout(contenedor)
        fila = QHBoxLayout()
        self.combo_a = QComboBox()
        self.combo_b = QComboBox()
        for clave, nombre in DISPOSITIVOS.items():
            self.combo_a.addItem(nombre, clave)
            self.combo_b.addItem(nombre, clave)
        self.combo_b.setCurrentIndex(1)
        boton = QPushButton("Comparar sobre el mismo emplazamiento")
        boton.clicked.connect(self._comparar)
        fila.addWidget(self.combo_a)
        fila.addWidget(self.combo_b)
        fila.addWidget(boton)
        disposicion.addLayout(fila)
        self.etiqueta_recurso = _etiqueta("", papel="subtitulo")
        disposicion.addWidget(self.etiqueta_recurso)
        self.tabla_paralelo = _tabla(["Eslabón", "Tecnología A", "Tecnología B"])
        disposicion.addWidget(self.tabla_paralelo)
        self.etiqueta_divergencia = _etiqueta(TEXTO_VACIO, estado="vacio")
        disposicion.addWidget(self.etiqueta_divergencia)
        return contenedor

    def _pestana_fichas(self) -> QWidget:
        area = QScrollArea()
        area.setWidgetResizable(True)
        contenedor = QWidget()
        disposicion = QVBoxLayout(contenedor)
        for ficha in _leer_json("datos/dispositivos"):
            disposicion.addWidget(self._ficha_dispositivo(ficha))
        for fracaso in _leer_json("datos/fracasos"):
            disposicion.addWidget(self._ficha_fracaso(fracaso))
        disposicion.addWidget(
            _etiqueta(
                "Ninguna de estas instalaciones falló por física imposible: "
                "las causas son de coste, de operación o de permiso.",
                papel="subtitulo",
            )
        )
        disposicion.addStretch()
        area.setWidget(contenedor)
        return area

    @staticmethod
    def _ficha_dispositivo(ficha: dict[str, Any]) -> QGroupBox:
        grupo = QGroupBox(f"{ficha.get('nombre', '?')} — con modelo dinámico")
        disposicion = QVBoxLayout(grupo)
        disposicion.addWidget(_etiqueta(str(ficha.get("descripcion", ""))))
        disposicion.addWidget(
            _etiqueta(f"Ejemplos reales: {ficha.get('ejemplos', 'sin ejemplos')}", papel="subtitulo")
        )
        return grupo

    @staticmethod
    def _ficha_fracaso(ficha: dict[str, Any]) -> QGroupBox:
        grupo = QGroupBox(f"{ficha.get('nombre', '?')} — desmantelado")
        disposicion = QVBoxLayout(grupo)
        causa = str(ficha.get("causa", ""))
        disposicion.addWidget(_etiqueta(f"Naturaleza: {naturaleza_fracaso(causa)}"))
        disposicion.addWidget(_etiqueta(f"Causa: {causa}"))
        disposicion.addWidget(_etiqueta(f"Coste hundido: {ficha.get('destino_coste', 'sin dato')}", papel="subtitulo"))
        return grupo

    def _pestana_catalogo(self) -> QWidget:
        contenedor = QWidget()
        disposicion = QVBoxLayout(contenedor)
        self.tabla_catalogo = _tabla(
            ["Familia", "Tipo", "Principio", "Eficiencia", "Ejemplos", "Modelo"]
        )
        modelados = {ficha.get("id") for ficha in _leer_json("datos/dispositivos")}
        for ficha in _leer_json("datos/catalogo"):
            simulable = ficha.get("id") in modelados
            _fila(
                self.tabla_catalogo,
                [
                    str(ficha.get("familia", "")),
                    str(ficha.get("nombre", "")),
                    str(ficha.get("principio", "")),
                    rango_eficiencia(ficha),
                    str(ficha.get("ejemplos", "")),
                    "simulable" if simulable else "solo consultable",
                ],
                fuente=str(ficha.get("fuente_taxonomia", "")) + " — " + _nota_modelo(simulable),
            )
        disposicion.addWidget(_etiqueta("Ocho familias undimotrices y siete de corriente mareal.", papel="subtitulo"))
        disposicion.addWidget(self.tabla_catalogo)
        return contenedor

    def _comparar(self) -> None:
        params = self.extras.get("parametros")
        if params is None:
            return
        comparacion = comparar_dos(params, self.combo_a.currentData(), self.combo_b.currentData())
        recurso = comparacion["recurso"]
        self.etiqueta_recurso.setText(
            "Mismo recurso para las dos: "
            + formatear_magnitud(recurso["hm0"], "m de ola", 1)
            + ", "
            + formatear_magnitud(recurso["te"], "s entre olas", 1)
            + ", "
            + formatear_magnitud(recurso["rango_m"], "m de marea", 2)
        )
        self.tabla_paralelo.setRowCount(0)
        for esl_a, esl_b in zip(comparacion["a"].eslabones, comparacion["b"].eslabones):
            _fila(
                self.tabla_paralelo,
                [
                    esl_a.nombre,
                    formatear_porcentaje(esl_a.rendimiento),
                    formatear_porcentaje(esl_b.rendimiento),
                ],
            )
        self.etiqueta_divergencia.setProperty("estado", None)
        self.etiqueta_divergencia.setText(
            "Se separan en el eslabón " + str(comparacion["divergencia"])
        )
        self.etiqueta_divergencia.style().polish(self.etiqueta_divergencia)

    def pintar(self) -> None:
        if self.resultado is None:
            return
        self.lienzo_sankey.mostrar(self.resultado)
        self.tabla_perdidas.setRowCount(0)
        for eslabon in self.resultado.eslabones:
            perdida = eslabon.potencia_entrada_w - eslabon.potencia_salida_w
            _fila(
                self.tabla_perdidas,
                [
                    eslabon.nombre,
                    formatear_potencia_w(eslabon.potencia_entrada_w),
                    formatear_potencia_w(eslabon.potencia_salida_w),
                    formatear_potencia_w(perdida),
                    formatear_porcentaje(eslabon.rendimiento),
                ],
            )


class PanelCalcular(Panel):
    """Cada resultado con su formula sustituida y la fuente al pasar el cursor."""

    def __init__(self) -> None:
        super().__init__()
        disposicion = QVBoxLayout(self)
        disposicion.setContentsMargins(4, 4, 4, 4)
        disposicion.addWidget(_etiqueta("Cada cifra con la fórmula y los números ya puestos.", papel="subtitulo"))
        self.tabla_formulas = _tabla(["Resultado", "Fórmula con los números sustituidos"])
        disposicion.addWidget(self.tabla_formulas, stretch=2)
        disposicion.addWidget(
            _etiqueta("Constantes y datos del emplazamiento — pasa el cursor para ver la fuente.", papel="subtitulo")
        )
        self.tabla_constantes = _tabla(["Constante", "Valor", "Unidad", "Estado"])
        disposicion.addWidget(self.tabla_constantes, stretch=2)

    def pintar(self) -> None:
        if self.resultado is None:
            return
        self.tabla_formulas.setRowCount(0)
        for nombre, formula in self.extras.get("formulas", {}).items():
            _fila(self.tabla_formulas, [nombre, formula])
        self._pintar_constantes()

    def _pintar_constantes(self) -> None:
        self.tabla_constantes.setRowCount(0)
        for nombre, (valor, unidad, fuente) in FUENTES_CONSTANTES.items():
            _fila(
                self.tabla_constantes,
                [nombre, formatear_numero(valor, 2), unidad, "verificado"],
                fuente=fuente,
            )
        for nombre, campo in sorted(self.extras.get("sitio", {}).items()):
            if not isinstance(campo, dict) or "fuente" not in campo:
                continue
            _fila(
                self.tabla_constantes,
                [
                    nombre,
                    formatear_numero(float(campo.get("valor", 0.0)), 2),
                    str(campo.get("unidad", "")),
                    str(campo.get("estado", "")),
                ],
                fuente=str(campo["fuente"]),
            )


class PanelDisenar(Panel):
    """Emplazamiento primero, luego resonancia, captura, produccion y coste."""

    calculo_completo_pedido = Signal()
    sitio_elegido = Signal(str)

    def __init__(self) -> None:
        super().__init__()
        col = QVBoxLayout(self)
        col.setContentsMargins(4, 4, 4, 4)
        col.setSpacing(6)
        hint = _etiqueta("El criterio eliminatorio va primero: si el sitio está en área protegida, el resto no compensa.", papel="subtitulo")
        col.addWidget(hint)
        self.tabs = QTabWidget()
        self.tabs.addTab(self._tab_emplazamiento(), "1 · Emplazamiento")
        self.tabs.addTab(self._tab_captura(), "2 · Captura")
        self.tabs.addTab(self._tab_produccion(), "3 · Producción")
        self.tabs.addTab(self._tab_economia(), "4 · Economía")
        col.addWidget(self.tabs)

    def _tab_emplazamiento(self) -> QWidget:
        pagina = QWidget()
        disp = QVBoxLayout(pagina)
        grupo = QGroupBox("1. Emplazamiento — el criterio eliminatorio va primero")
        g = QVBoxLayout(grupo)
        self.etiqueta_eliminatorio = _etiqueta(TEXTO_VACIO, estado="vacio")
        g.addWidget(self.etiqueta_eliminatorio)
        self.mapa = LienzoMapa(al_elegir_sitio=self.sitio_elegido.emit)
        self.mapa.dibujar()
        g.addLayout(self._capas_del_mapa())
        g.addWidget(self.mapa, stretch=1)
        # Desplazar, acercar por rectangulo y volver al encuadre: lo trae
        # matplotlib hecho, no hace falta reimplementarlo.
        self.navegacion_mapa = NavigationToolbar2QT(self.mapa, self)
        g.addWidget(self.navegacion_mapa)
        g.addWidget(
            _etiqueta(
                "☝ Pulsa un punto del mapa para fijar el emplazamiento activo. "
                "Rueda del ratón para acercar; la casita vuelve al encuadre completo.",
                papel="subtitulo",
            )
        )
        self.tabla_criterios = _tabla(["Criterio", "Valor", "Umbral", "Cumple"])
        g.addWidget(self.tabla_criterios)
        disp.addWidget(grupo, stretch=1)
        return pagina

    def _capas_del_mapa(self) -> QHBoxLayout:
        fila = QHBoxLayout()
        fila.addWidget(QLabel("Capas:"))
        rotulos = {
            "protegidas": "áreas protegidas (eliminatorio)",
            "recurso": "potencial de recurso",
            "batimetria": "batimetría 30–60 m",
        }
        for capa, rotulo in rotulos.items():
            casilla = QCheckBox(rotulo)
            casilla.setChecked(True)
            casilla.toggled.connect(lambda visible, c=capa: self.mapa.conmutar(c, visible))
            fila.addWidget(casilla)
        fila.addStretch()
        return fila

    def _tab_captura(self) -> QWidget:
        cont = QWidget()
        disp = QVBoxLayout(cont)
        disp.addLayout(self._controles_boya())
        self.tabla_captura = _tabla(["Magnitud", "Valor", "Comentario"])
        disp.addWidget(self.tabla_captura)
        self.lienzo_barrido = LienzoBarrido()
        disp.addWidget(self.lienzo_barrido, stretch=1)
        return cont

    def _controles_boya(self) -> QFormLayout:
        formulario = QFormLayout()
        formulario.setSpacing(8)
        self.entrada_masa = QDoubleSpinBox()
        self.entrada_masa.setRange(20.0, 3000.0)
        self.entrada_masa.setDecimals(0)
        self.entrada_masa.setSingleStep(50.0)
        self.entrada_masa.setValue(MASA_FLOTACION_KG / 1000.0)
        self.entrada_masa.setSuffix(" t")
        self.entrada_masa.setGroupSeparatorShown(True)
        self.entrada_masa.valueChanged.connect(lambda _v: self.parametros_cambiados.emit())
        self.entrada_diametro = QDoubleSpinBox()
        self.entrada_diametro.setRange(2.0, 20.0)
        self.entrada_diametro.setDecimals(1)
        self.entrada_diametro.setSuffix(" m")
        self.entrada_diametro.setValue(10.0)
        self.entrada_diametro.valueChanged.connect(lambda _v: self.parametros_cambiados.emit())
        formulario.addRow("Masa de la boya", self.entrada_masa)
        formulario.addRow("Diámetro de la boya", self.entrada_diametro)
        return formulario

    def parametros(self, base: Parametros) -> Parametros:
        return replace(
            base,
            masa_kg=self.entrada_masa.value() * 1000.0,
            diametro_m=self.entrada_diametro.value(),
        )

    def _tab_produccion(self) -> QWidget:
        cont = QWidget()
        disp = QVBoxLayout(cont)
        self.tabla_aep = _tabla(["Método", "Producción", "Procedencia"])
        disp.addWidget(self.tabla_aep)
        self.boton_completo = QPushButton(
            "Calcular la matriz de potencia celda a celda (simulación costosa)"
        )
        self.boton_completo.clicked.connect(self.calculo_completo_pedido.emit)
        disp.addWidget(self.boton_completo)
        self.lienzo_matriz = LienzoMatriz()
        self.lienzo_matriz.vaciar("sin matriz de dispersión todavía")
        disp.addWidget(self.lienzo_matriz, stretch=1)
        return cont

    def _tab_economia(self) -> QWidget:
        cont = QWidget()
        disp = QVBoxLayout(cont)
        formulario = QFormLayout()
        formulario.setSpacing(8)
        self.entrada_capex = self._moneda(0.0)
        self.entrada_opex = self._moneda(0.0)
        formulario.addRow("CAPEX (millones COP)", self.entrada_capex)
        formulario.addRow("OPEX anual (millones COP)", self.entrada_opex)
        disp.addLayout(formulario)
        disp.addWidget(
            _etiqueta(
                "Referencia Handbook cap. 1 §4.2: 2 M€ para 750 kW. No hay tasa EUR→COP "
                "verificada en datos/ (fuentes_datos_economicos.md), así que el CAPEX entra "
                "como valor aportado por el usuario, no como cifra con fuente.",
                papel="subtitulo",
            )
        )
        self.tabla_economia = _tabla(["Concepto", "Valor", "Lectura"])
        disp.addWidget(self.tabla_economia, stretch=1)
        return cont

    def _moneda(self, valor: float) -> QDoubleSpinBox:
        entrada = QDoubleSpinBox()
        entrada.setRange(0.0, 1e5)
        entrada.setDecimals(0)
        entrada.setSingleStep(50.0)
        entrada.setSuffix(" M COP")
        entrada.setGroupSeparatorShown(True)
        entrada.setValue(valor)
        entrada.valueChanged.connect(self._pintar_economia)
        return entrada

    def pintar(self) -> None:
        if self.resultado is None:
            return
        self._pintar_emplazamiento()
        self._pintar_captura()
        self._pintar_aep()
        self._pintar_economia()

    def _pintar_emplazamiento(self) -> None:
        panel = self.extras.get("panel_sitio")
        if panel is None:
            return
        estado = "pendiente" if panel.eliminatorio else None
        self.etiqueta_eliminatorio.setProperty("estado", estado)
        # El veredicto ya empieza por el estado legal; anteponerlo lo repetia.
        self.etiqueta_eliminatorio.setText(f"Área protegida: {panel.veredicto}\n{panel.fuente_runap}")
        self.etiqueta_eliminatorio.style().polish(self.etiqueta_eliminatorio)
        self.tabla_criterios.setRowCount(0)
        for criterio in panel.criterios:
            _fila(
                self.tabla_criterios,
                [
                    criterio.nombre,
                    _valor_legible(criterio.valor),
                    criterio.umbral,
                    "sí" if criterio.cumple else "no",
                ],
                fuente=criterio.detalle,
            )

    def _pintar_captura(self) -> None:
        self.tabla_captura.setRowCount(0)
        resonancia = self.extras.get("resonancia")
        limites = self.extras.get("limites")
        falnes = self.extras.get("falnes")
        if resonancia is not None:
            separacion = resonancia["separacion"]
            _fila(
                self.tabla_captura,
                [
                    "Periodo natural",
                    formatear_magnitud(separacion.tn_s, "s", 2),
                    separacion.detalle,
                ],
                fuente=resonancia["resonancia"].fuente,
            )
        if limites is not None:
            _fila(
                self.tabla_captura,
                [
                    "Ancho de captura máximo",
                    formatear_magnitud(limites.l_gobernante_m, "m", 2),
                    limites.detalle,
                ],
            )
        if falnes is not None:
            _fila(
                self.tabla_captura,
                [
                    "Cota de Falnes",
                    formatear_potencia_w(falnes.p_max_w),
                    f"absorbida {formatear_porcentaje(falnes.relacion_pabs_pmax)} de la cota; "
                    f"ancho {formatear_magnitud(falnes.l_captura_m, 'm', 2)}",
                ],
                fuente=falnes.fuente,
            )
        barrido = self.extras.get("barrido")
        if barrido is not None:
            self.lienzo_barrido.mostrar(barrido)

    def _pintar_aep(self) -> None:
        assert self.resultado is not None
        self.tabla_aep.setRowCount(0)
        _fila(
            self.tabla_aep,
            [
                "Cadena resuelta (integración)",
                formatear_magnitud(self.resultado.produccion_anual_mwh, "MWh/año", 1),
                "potencia entregada por la cadena × horas × disponibilidad",
            ],
        )
        pulgar = self.extras.get("pulgar")
        if pulgar is not None:
            comparacion = self.extras.get("pulgar_vs_aep", {})
            _fila(
                self.tabla_aep,
                [
                    "Regla del pulgar del Handbook",
                    formatear_magnitud(pulgar.aep_mwh, "MWh/año", 1),
                    str(comparacion.get("aviso", "")),
                ],
                fuente=pulgar.fuente,
            )
        self._pintar_matriz()

    def _pintar_matriz(self) -> None:
        matriz = self.extras.get("aep_matriz")
        if matriz is None:
            return
        if matriz.get("estado") != "listo":
            _fila(self.tabla_aep, ["Matriz de ocurrencia", "pendiente", str(matriz.get("motivo"))])
            return
        aep = matriz["aep"]
        # La cadena resuelve el Hm0-Te de los controles y la matriz toda la serie
        # del sitio: si se separan, hay que decirlo aqui, porque es la cadena la
        # que alimenta el LCOE y el titular de viviendas.
        assert self.resultado is not None
        comparacion = comparar_aep_con_pulgar(self.resultado.produccion_anual_mwh, aep.aep_mwh)
        _fila(
            self.tabla_aep,
            [
                "Matriz de ocurrencia × matriz de potencia",
                formatear_magnitud(aep.aep_mwh, "MWh/año", 1),
                f"{aep.detalle} — frente a la cadena, {comparacion['aviso']}",
            ],
            fuente=str(matriz.get("fuente", "")),
        )
        self.lienzo_matriz.mostrar(matriz["dispersion"], aep.contribucion_pct)

    def _pintar_economia(self) -> None:
        if self.resultado is None:
            return
        economia = economia_completa(
            self.resultado.produccion_anual_mwh,
            self.entrada_capex.value() * 1e6,
            self.entrada_opex.value() * 1e6,
            self.resultado.potencia_nominal_w / 1000.0,
            float(self.extras.get("masa_t", 0.0)),
        )
        self.tabla_economia.setRowCount(0)
        if economia.get("estado") != "listo":
            _fila(self.tabla_economia, ["LCOE", "pendiente", str(economia.get("motivo"))])
            return
        lcoe = economia["lcoe"]
        _fila(
            self.tabla_economia,
            ["Coste nivelado", formatear_magnitud(lcoe.lcoe_cop_mwh, "COP/MWh", 0), lcoe.detalle],
        )
        diesel = economia["diesel"]
        _fila(
            self.tabla_economia,
            [
                "Frente al diésel de la ZNI (favorable)",
                formatear_magnitud(diesel.diesel_cop_kwh, "COP/kWh", 1),
                diesel.veredicto,
            ],
            fuente=diesel.fuente,
        )
        red = economia["sin"]
        _fila(
            self.tabla_economia,
            [
                "Frente a la red interconectada (desfavorable)",
                f"{formatear_numero(red.minimo_cop_kwh, 0)}–"
                f"{formatear_numero(red.maximo_cop_kwh, 0)} COP/kWh",
                red.posicion_relativa,
            ],
            fuente=red.fuente,
        )
        repago = economia["repago"]
        _fila(
            self.tabla_economia,
            [
                "Años de repago",
                formatear_numero(repago.anos_repago_total, 1),
                repago.multiplica_unidades,
            ],
            fuente=repago.fuente,
        )
        masa = economia["masa"]
        _fila(
            self.tabla_economia,
            ["Masa por potencia", formatear_numero(masa.ratio_t_kw, 3) + " t/kW", masa.advertencia],
        )


def _nota_modelo(simulable: bool) -> str:
    if simulable:
        return "Tiene modelo dinámico propio: el simulador lo resuelve."
    return "Sin modelo dinámico: el simulador no ofrece calcularlo, solo consultarlo."


def naturaleza_fracaso(causa: str) -> str:
    texto = causa.lower()
    etiquetas = []
    if "economic" in texto or "coste" in texto or "capital" in texto:
        etiquetas.append("económica")
    if any(clave in texto for clave in ("tecnic", "averia", "fatiga", "falla")):
        etiquetas.append("técnica")
    if "pec" in texto or "ambient" in texto or "mortalidad" in texto:
        etiquetas.append("ambiental")
    return " y ".join(etiquetas) if etiquetas else "otra (ver causa)"


def rango_eficiencia(ficha: dict[str, Any]) -> str:
    minimo = ficha.get("cwr_rango_babarit_min")
    maximo = ficha.get("cwr_rango_babarit_max")
    if isinstance(minimo, dict) and isinstance(maximo, dict):
        return (
            f"CWR {formatear_numero(float(minimo['valor']) * 100, 0)}–"
            f"{formatear_numero(float(maximo['valor']) * 100, 0)} %"
        )
    tipico = ficha.get("cp_tipico")
    if isinstance(tipico, dict):
        betz = ficha.get("cp_betz", {})
        limite = float(betz.get("valor", 0.5926)) if isinstance(betz, dict) else 0.5926
        return (
            f"Cp {formatear_numero(float(tipico['valor']), 2)} "
            f"(Betz {formatear_numero(limite, 2)})"
        )
    return "pendiente"


def semaforo_resultado(extras: dict[str, Any]) -> str:
    panel = extras.get("panel_sitio")
    if panel is not None and panel.eliminatorio:
        return semaforo_html("pendiente", f"{panel.nombre}: área protegida, sitio no utilizable")
    viviendas = extras.get("viviendas", {})
    if viviendas.get("estado") == "pendiente":
        return semaforo_html("pendiente", "conversión a viviendas sin fuente verificada")
    return semaforo_html(
        "inferido",
        "Hm0 y Te los fija el usuario con los controles, no una serie medida del sitio",
    )
