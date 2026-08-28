"""Estres de tiempo real de la interfaz, sin pantalla (QT_QPA_PLATFORM=offscreen).

Se maltrata la ventana viva: rafagas de deslizadores, cambios de emplazamiento
encadenados, clics fuera del mapa, cancelaciones a mitad de la matriz de
potencia y treinta segundos de animacion con pausas. La regla es siempre la
misma: la ventana tiene que seguir viva y el estado visible tiene que ser
coherente con lo que de verdad esta corriendo.
"""

from __future__ import annotations

import os
import threading
import time

import numpy as np
import pytest

os.environ.setdefault("QT_QPA_PLATFORM", "offscreen")

pytest.importorskip("PySide6")

from PySide6.QtWidgets import QApplication  # noqa: E402

from interfaz.calculo import SITIOS, Parametros, simular  # noqa: E402

ESPERA_DEBOUNCE_S = 0.25


@pytest.fixture(scope="module")
def aplicacion():
    app = QApplication.instance() or QApplication([])
    yield app


def _bombear(aplicacion, segundos: float) -> None:
    """Deja correr el bucle de eventos sin bloquear el hilo de prueba."""
    fin = time.perf_counter() + segundos
    while time.perf_counter() < fin:
        aplicacion.processEvents()
        time.sleep(0.005)


def _reposar(aplicacion, ventana, segundos: float = 30.0) -> None:
    """Drena el antirrebote pendiente y el calculo en vuelo antes de medir.

    Sin esto, un temporizador de 250 ms encolado por una prueba anterior relanza
    la simulacion a media medicion y la sustituye por otra.
    """
    inicio = time.perf_counter()
    while time.perf_counter() - inicio < segundos:
        _bombear(aplicacion, ESPERA_DEBOUNCE_S + 0.1)
        if not ventana._espera.isActive() and (
            ventana.trabajo is None or not ventana.trabajo.esta_en_curso()
        ):
            return
    raise AssertionError("la ventana no llego nunca a reposo")


def _crear_ventana(aplicacion, segundos: float = 60.0):
    from interfaz.app import VentanaPrincipal

    ventana = VentanaPrincipal()
    ventana.show()
    inicio = time.perf_counter()
    while ventana.gestor is None and time.perf_counter() - inicio < segundos:
        _bombear(aplicacion, 0.02)
    assert ventana.gestor is not None, "el primer calculo no termino"
    return ventana


@pytest.fixture(scope="module")
def ventana(aplicacion):
    ventana = _crear_ventana(aplicacion)
    yield ventana
    ventana.paneles["ver"].lienzo.detener()
    if ventana.trabajo is not None:
        ventana.trabajo.cancelar()
        ventana.trabajo.esperar(timeout=30)
    ventana.close()


class _EspiaLanzamientos:
    """Cuenta cuantas simulaciones dispara de verdad la ventana."""

    def __init__(self, ventana):
        self.ventana = ventana
        self.original = ventana.lanzar
        self.lanzamientos: list[bool] = []

    def __enter__(self):
        def envuelto(completo: bool = False):
            self.lanzamientos.append(completo)
            return self.original(completo=completo)

        self.ventana.lanzar = envuelto
        self.ventana._espera.timeout.disconnect()
        self.ventana._espera.timeout.connect(self.ventana.lanzar)
        return self

    def __exit__(self, *_excepcion):
        self.ventana.lanzar = self.original
        self.ventana._espera.timeout.disconnect()
        self.ventana._espera.timeout.connect(self.ventana.lanzar)
        return False


# --------------------------------------------------------------------------
# 2a. Rafaga de deslizadores: el antirrebote de 250 ms tiene que colapsarla
# --------------------------------------------------------------------------


def test_s2_01_rafaga_de_50_deslizamientos_colapsa_en_un_calculo(aplicacion, ventana):
    panel = ventana.paneles["ver"]
    with _EspiaLanzamientos(ventana) as espia:
        inicio = time.perf_counter()
        for i in range(50):
            panel.deslizador_olas.setValue(5 + (i % 36))
            panel.deslizador_periodo.setValue(40 + (i % 81))
            panel.deslizador_freno.setValue(10 + (i * 7) % 491)
        duracion = time.perf_counter() - inicio
        assert duracion < 2.0, f"150 cambios tardaron {duracion:.2f} s en encolarse"
        assert espia.lanzamientos == [], "un cambio de deslizador no debe calcular al vuelo"
        _bombear(aplicacion, 1.2)
        assert len(espia.lanzamientos) == 1, (
            f"el antirrebote debe dejar un solo calculo, hubo {len(espia.lanzamientos)}"
        )
    assert ventana.isVisible()


def test_s2_02_los_deslizadores_no_salen_del_rango_validado(ventana):
    """Los topes del widget ya cubren el rango de nucleo/validacion."""
    from nucleo.validacion import RANGOS

    panel = ventana.paneles["ver"]
    for deslizador, clave, escala in (
        (panel.deslizador_olas, "Hm0", 0.1),
        (panel.deslizador_periodo, "Te", 0.1),
        (panel.deslizador_freno, "amortiguamiento_pto", 1000.0),
    ):
        minimo, maximo = RANGOS[clave]
        assert deslizador.minimum() * escala == pytest.approx(minimo)
        assert deslizador.maximum() * escala == pytest.approx(maximo)
        deslizador.setValue(deslizador.maximum() + 10_000)
        assert deslizador.value() == deslizador.maximum()
        deslizador.setValue(deslizador.minimum() - 10_000)
        assert deslizador.value() == deslizador.minimum()


# --------------------------------------------------------------------------
# 2b. Cambio de emplazamiento encadenado
# --------------------------------------------------------------------------


def test_s2_03_veinte_cambios_de_sitio_pasan_por_el_antirrebote(aplicacion, ventana):
    with _EspiaLanzamientos(ventana) as espia:
        hilos_antes = threading.active_count()
        pico = hilos_antes
        for i in range(20):
            ventana.combo_sitio.setCurrentText(SITIOS[i % len(SITIOS)])
            pico = max(pico, threading.active_count())
        _bombear(aplicacion, 3.0)
        assert len(espia.lanzamientos) <= 2, (
            f"20 cambios de sitio dispararon {len(espia.lanzamientos)} calculos"
        )
        assert pico - hilos_antes <= 2, f"llegaron a convivir {pico - hilos_antes} hilos de calculo"


def test_s2_04_veinte_cambios_de_sitio_no_matan_la_ventana(aplicacion, ventana):
    """Aunque el antirrebote se esquive, el resultado tiene que ser estable."""
    hilos_antes = threading.active_count()
    for i in range(20):
        ventana.combo_sitio.setCurrentText(SITIOS[i % len(SITIOS)])
    _bombear(aplicacion, 4.0)
    assert ventana.isVisible()
    assert threading.active_count() <= hilos_antes + 1, "quedaron hilos de calculo colgados"
    assert ventana.parametros.sitio_id in SITIOS
    assert ventana.gestor is not None


# --------------------------------------------------------------------------
# 2c. Clics en el mapa fuera de rango
# --------------------------------------------------------------------------


class _Evento:
    def __init__(self, x, y):
        self.xdata = x
        self.ydata = y


@pytest.mark.parametrize(
    "coordenada",
    [
        (-90.0, -180.0),
        (90.0, 180.0),
        (-180.0, -90.0),
        (180.0, 90.0),
        (None, None),
        (0.0, 0.0),
    ],
)
def test_s2_05_clic_fuera_del_mapa_no_cambia_el_emplazamiento(ventana, coordenada):
    mapa = ventana.paneles["disenar"].mapa
    mapa.fijar_sitio("isla_fuerte")
    activo = mapa._sitio_activo
    mapa._al_mover(_Evento(*coordenada))
    mapa._al_pulsar(_Evento(*coordenada))
    assert mapa._sitio_activo == activo, f"un clic en {coordenada} movio el emplazamiento"
    assert ventana.isVisible()


def test_s2_05b_clic_con_coordenadas_nan_no_fija_sitio(ventana):
    mapa = ventana.paneles["disenar"].mapa
    mapa.fijar_sitio("isla_fuerte")
    mapa._al_pulsar(_Evento(float("nan"), float("nan")))
    assert mapa._sitio_activo == "isla_fuerte"


def test_s2_06_clic_sobre_un_sitio_si_lo_fija(ventana):
    mapa = ventana.paneles["disenar"].mapa
    mapa.fijar_sitio("san_andres")
    mapa._al_pulsar(_Evento(-76.18, 9.39))  # Isla Fuerte
    assert mapa._sitio_activo == "isla_fuerte"
    assert "Isla Fuerte" in mapa.descripcion_sitio("isla_fuerte")
    assert mapa.descripcion_sitio("no_existe") == "sitio desconocido"


def test_s2_07_redibujar_el_mapa_no_acumula_artistas(ventana):
    mapa = ventana.paneles["disenar"].mapa
    mapa.dibujar()
    textos_antes = len(mapa.figure.texts)
    for i in range(30):
        mapa.fijar_sitio(SITIOS[i % len(SITIOS)])
    assert len(mapa.figure.texts) == textos_antes, (
        f"la figura paso de {textos_antes} a {len(mapa.figure.texts)} textos"
    )


def test_s2_07b_la_atribucion_del_mapa_es_un_unico_artista(ventana):
    """Se reutiliza el mismo texto en vez de apilar una copia por redibujado."""
    mapa = ventana.paneles["disenar"].mapa
    mapa.dibujar()
    antes = len(mapa.figure.texts)
    for _ in range(10):
        mapa.dibujar()
    assert len(mapa.figure.texts) == antes
    assert mapa._atribucion.get_text(), "la atribucion no puede quedar vacia"


# --------------------------------------------------------------------------
# 2d. Matriz de potencia y cancelacion con ESC
# --------------------------------------------------------------------------


@pytest.mark.parametrize("momento", [0.1, 0.5, 2.0])
def test_s2_08_esc_durante_la_matriz_deja_la_ventana_viva(aplicacion, ventana, momento):
    _reposar(aplicacion, ventana)
    ventana.lanzar(completo=True)
    trabajo = ventana.trabajo
    _bombear(aplicacion, momento)
    assert trabajo.esta_en_curso(), "la matriz deberia seguir calculandose"
    inicio = time.perf_counter()
    ventana.cancelar()
    trabajo.esperar(timeout=20)
    demora = time.perf_counter() - inicio
    _bombear(aplicacion, 0.3)
    assert not trabajo.esta_en_curso()
    # Aislado son 0,03-0,07 s; el margen cubre la contencion por el GIL cuando
    # la ventana esta repintando el mapa al mismo tiempo.
    assert demora < 2.5, f"la cancelacion tardo {demora:.2f} s en soltar el hilo"
    assert ventana.isVisible(), "la ventana murio al cancelar"
    assert ventana.barra.isVisible() is False
    assert ventana.boton_cancelar.isEnabled() is False
    assert "cancelada" in ventana.statusBar().currentMessage()
    assert ventana.gestor is not None, "se perdio el ultimo resultado bueno"


def test_s2_09_la_barra_se_resetea_tras_cancelar(aplicacion, ventana):
    _reposar(aplicacion, ventana)
    residuos = []
    for _ in range(6):
        ventana.lanzar(completo=True)
        trabajo = ventana.trabajo
        _bombear(aplicacion, 1.0)
        ventana.cancelar()
        trabajo.esperar(timeout=20)
        _bombear(aplicacion, 0.4)
        residuos.append(ventana.barra.value())
    assert residuos == [0] * 6, f"la barra quedo en {residuos} % tras cancelar"


def test_s2_10_la_barra_obsoleta_no_contamina_la_corrida_siguiente(aplicacion, ventana):
    """Acota el defecto anterior: al relanzar, el progreso vuelve a empezar en cero."""
    _reposar(aplicacion, ventana)
    ventana.lanzar(completo=True)
    trabajo = ventana.trabajo
    _bombear(aplicacion, 1.5)
    ventana.cancelar()
    trabajo.esperar(timeout=20)
    _bombear(aplicacion, 0.3)
    ventana.lanzar(completo=False)
    observados = set()
    inicio = time.perf_counter()
    while time.perf_counter() - inicio < 1.5:
        aplicacion.processEvents()
        observados.add(ventana.barra.value())
        time.sleep(0.01)
    assert max(observados) <= 10, f"progreso heredado de la corrida cancelada: {sorted(observados)}"


def test_s2_11_cancelar_sin_calculo_en_curso_no_hace_nada(aplicacion, ventana):
    if ventana.trabajo is not None:
        ventana.trabajo.esperar(timeout=30)
    _bombear(aplicacion, 0.3)
    ventana.cancelar()
    ventana.cancelar()
    assert ventana.isVisible()


def test_s2_12_cancelar_corta_el_calculo_normal_en_la_frontera_de_fase(aplicacion, ventana):
    """La integracion en vuelo no se puede partir; todo lo que viene detras, si.

    simular() consulta el Event antes de resolver y antes de los extras, asi
    que cancelar deja el hilo en la integracion que ya estaba corriendo y no
    gasta nada mas.
    """
    from interfaz.calculo import Parametros, simular

    cancelado = threading.Event()
    cancelado.set()
    salida = simular(Parametros(), cancelado=cancelado)
    assert salida["extras"]["estado"] == "cancelado"
    assert salida["resultado"].eslabones == [], "no debe resolver nada ya cancelado"

    _reposar(aplicacion, ventana)
    ventana.lanzar(completo=False)
    trabajo = ventana.trabajo
    inicio = time.perf_counter()
    ventana.cancelar()
    trabajo.esperar(timeout=10)
    assert time.perf_counter() - inicio < 1.0, "el hilo no solto en un tiempo razonable"
    assert ventana.isVisible()


# --------------------------------------------------------------------------
# 2e. Navegar por las pestanas mientras hay un calculo corriendo
# --------------------------------------------------------------------------


def test_s2_13_alternar_pestanas_durante_la_matriz(aplicacion, ventana):
    panel = ventana.paneles["disenar"]
    _reposar(aplicacion, ventana)
    ventana.lanzar(completo=True)
    trabajo = ventana.trabajo
    for i in range(40):
        panel.tabs.setCurrentIndex(i % 4)
        ventana.cambiar_nivel(i % 4)
        aplicacion.processEvents()
        time.sleep(0.01)
    assert ventana.isVisible()
    trabajo.esperar(timeout=60)
    _bombear(aplicacion, 1.0)
    assert ventana.gestor is not None
    assert panel.tabs.count() == 4


def test_s2_14_repintar_la_matriz_no_acumula_ejes(aplicacion, ventana):
    from analisis.aep import calcular_aep, matriz_dispersion_desde_serie

    lienzo = ventana.paneles["disenar"].lienzo_matriz
    dispersion = matriz_dispersion_desde_serie(
        np.linspace(0.2, 3.5, 400), np.linspace(3.0, 11.0, 400)
    )
    potencia = np.full((len(dispersion.hs_centros_m), len(dispersion.te_centros_s)), 5_000.0)
    aep = calcular_aep(dispersion.ocurrencia, potencia)
    lienzo.mostrar(dispersion, aep.contribucion_pct)
    ejes_antes = len(lienzo.figure.axes)
    for _ in range(4):
        lienzo.mostrar(dispersion, aep.contribucion_pct)
    assert len(lienzo.figure.axes) == ejes_antes, (
        f"la figura paso de {ejes_antes} a {len(lienzo.figure.axes)} ejes"
    )


# --------------------------------------------------------------------------
# 2f. CAPEX / OPEX: el LCOE queda pendiente antes que dividir por cero
# --------------------------------------------------------------------------


@pytest.mark.parametrize(
    "capex,opex,espera_pendiente",
    [
        (0.0, 0.0, True),
        (0.1, 0.0, True),  # los decimales del widget son 0: 0,1 se redondea a 0
        (8000.0, 100.0, False),
        (1e7, 1e7, False),  # el widget lo acota a su maximo
        (-500.0, -500.0, True),  # el widget lo acota a 0
    ],
)
def test_s2_15_capex_extremo_no_divide_por_cero(ventana, capex, opex, espera_pendiente):
    panel = ventana.paneles["disenar"]
    panel.entrada_capex.setValue(capex)
    panel.entrada_opex.setValue(opex)
    assert panel.entrada_capex.value() >= 0.0
    panel._pintar_economia()
    primera = panel.tabla_economia.item(0, 1).text()
    if espera_pendiente:
        assert "pendiente" in primera, f"CAPEX={capex} deberia dejar el LCOE pendiente"
        assert "CAPEX pendiente" in panel.tabla_economia.item(0, 2).text()
    else:
        assert "pendiente" not in primera
        assert "COP/MWh" in primera


@pytest.mark.parametrize("texto", ["", "abc", "-9", "8.000"])
def test_s2_16_capex_con_texto_invalido_conserva_el_ultimo_valor(ventana, texto):
    panel = ventana.paneles["disenar"]
    panel.entrada_capex.setValue(8000.0)
    panel.entrada_capex.lineEdit().setText(texto)
    panel.entrada_capex.interpretText()
    assert panel.entrada_capex.value() == 8000.0, f"el texto {texto!r} altero el CAPEX"
    panel._pintar_economia()
    assert "COP/MWh" in panel.tabla_economia.item(0, 1).text()


def test_s2_16b_capex_nan_adopta_el_maximo_del_widget(ventana):
    """Observado, no deseable: NaN no revienta ni divide por cero, pero el widget
    lo traduce a su maximo (100.000 M COP) sin avisar. Solo es alcanzable por
    codigo: el validador del QDoubleSpinBox no deja teclearlo."""
    panel = ventana.paneles["disenar"]
    panel.entrada_capex.setValue(8000.0)
    panel.entrada_capex.setValue(float("nan"))
    assert panel.entrada_capex.value() == panel.entrada_capex.maximum()
    panel._pintar_economia()
    assert panel.tabla_economia.rowCount() > 0
    assert "COP/MWh" in panel.tabla_economia.item(0, 1).text()
    panel.entrada_capex.setValue(0.0)


def test_s2_17_lcoe_sin_produccion_queda_pendiente():
    from interfaz.calculo import economia_completa

    for aep, capex in ((0.0, 8000e6), (-1.0, 8000e6), (100.0, 0.0), (0.0, 0.0)):
        salida = economia_completa(aep, capex, 0.0, 750.0, 402.5)
        assert salida["estado"] == "pendiente", f"aep={aep} capex={capex} no quedo pendiente"
        assert salida["motivo"]


# --------------------------------------------------------------------------
# 2g. Animacion: 30 s corriendo con diez pausas
# --------------------------------------------------------------------------


def test_s2_18_treinta_segundos_de_animacion_con_diez_pausas(aplicacion):
    from interfaz.graficas import LienzoOleaje

    resultado = simular(Parametros())["resultado"]
    lienzo = LienzoOleaje()
    lienzo.mostrar(resultado)
    try:
        fotogramas = np.asarray(lienzo._datos["eta"]).shape[0]
        # el primer fotograma crea el fill_between que luego se recicla: la
        # referencia se toma despues, para no contar ese unico artista como fuga
        lienzo._avanzar()
        artistas_antes = len(lienzo.ejes.get_children())
        textos_antes = len(lienzo.figure.texts)
        colecciones_antes = len(lienzo.ejes.collections)
        lienzo.set_pausado(False)
        inicio = time.perf_counter()
        pausas = 0
        intermedio = None
        while pausas < 10 or time.perf_counter() - inicio < 30.0:
            _bombear(aplicacion, 3.0)
            lienzo.set_pausado(True)
            marca = lienzo._fotograma
            _bombear(aplicacion, 0.15)
            assert lienzo._fotograma == marca, "el temporizador siguio corriendo en pausa"
            lienzo.set_pausado(False)
            pausas += 1
            if pausas == 5:
                intermedio = len(lienzo.ejes.get_children())
        assert pausas >= 10, f"solo se hicieron {pausas} pausas"
        assert intermedio == artistas_antes, "los artistas ya crecian a mitad de la animacion"
        assert len(lienzo.ejes.get_children()) == artistas_antes, "fuga de artistas en los ejes"
        assert len(lienzo.figure.texts) == textos_antes
        assert len(lienzo.ejes.collections) == colecciones_antes, (
            "el fill_between de cada fotograma no se esta retirando"
        )
        assert 0 <= lienzo._fotograma < fotogramas
    finally:
        lienzo.detener()


def test_s2_19_la_boya_no_se_desincroniza_del_oleaje(aplicacion):
    from interfaz.graficas import LienzoOleaje

    resultado = simular(Parametros())["resultado"]
    lienzo = LienzoOleaje()
    lienzo.mostrar(resultado)
    try:
        fotogramas = np.asarray(lienzo._datos["eta"]).shape[0]
        assert lienzo._z_boya is not None
        assert len(lienzo._z_boya) == fotogramas, "z_boya y eta no tienen el mismo numero de pasos"
        esperado = np.interp(
            np.asarray(lienzo._datos["t"]), resultado.series["t_s"], resultado.series["z_m"]
        )
        assert np.allclose(lienzo._z_boya, esperado)
        for _ in range(1000):
            lienzo._avanzar()
            assert 0 <= lienzo._fotograma < fotogramas
        # y tras un cambio de parametros a mitad de animacion sigue cuadrando
        lienzo.mostrar(simular(Parametros(te_s=11.0, hm0_m=3.0))["resultado"])
        assert lienzo._fotograma == 0
        assert len(lienzo._z_boya) == np.asarray(lienzo._datos["eta"]).shape[0]
    finally:
        lienzo.detener()


def test_s2_20_pausar_y_reanudar_diez_veces_no_duplica_temporizadores(aplicacion):
    from interfaz.graficas import LienzoOleaje

    lienzo = LienzoOleaje()
    lienzo.mostrar(simular(Parametros())["resultado"])
    try:
        for _ in range(10):
            lienzo.set_pausado(True)
            lienzo.set_pausado(False)
        assert lienzo._temporizador.isActive()
        antes = lienzo._fotograma
        _bombear(aplicacion, 0.5)
        avance = (lienzo._fotograma - antes) % np.asarray(lienzo._datos["eta"]).shape[0]
        # 500 ms a 40 ms por fotograma son unos 12 pasos: si hubiera dos
        # temporizadores encadenados el avance se dispararia
        assert avance <= 25, f"avanzo {avance} fotogramas en 0,5 s"
        lienzo.set_pausado(True)
        assert not lienzo._temporizador.isActive()
    finally:
        lienzo.detener()


# --------------------------------------------------------------------------
# 2h. Hallazgos de la inspeccion visual de la ventana
# --------------------------------------------------------------------------


def test_s2_21_la_matriz_avisa_si_discrepa_de_la_cadena(aplicacion, ventana):
    _reposar(aplicacion, ventana)
    ventana.lanzar(completo=True)
    trabajo = ventana.trabajo
    trabajo.esperar(timeout=120)
    _bombear(aplicacion, 1.0)
    panel = ventana.paneles["disenar"]
    matriz = ventana.paneles["disenar"].extras.get("aep_matriz", {})
    if matriz.get("estado") != "listo":
        pytest.skip("la matriz no llego a calcularse")
    cadena = ventana.gestor.resultado.produccion_anual_mwh
    de_matriz = matriz["aep"].aep_mwh
    discrepancia = abs(cadena - de_matriz) / max(de_matriz, 1e-9) * 100.0
    filas = [
        panel.tabla_aep.item(fila, 2).text()
        for fila in range(panel.tabla_aep.rowCount())
        if panel.tabla_aep.item(fila, 0).text().startswith("Matriz")
    ]
    assert filas, "no aparece la fila de la matriz"
    if discrepancia > 50.0:
        assert "discrepancia" in filas[0].lower(), (
            f"cadena {cadena:.1f} frente a matriz {de_matriz:.1f} MWh/ano "
            f"({discrepancia:.0f} %) y la fila solo dice: {filas[0]!r}"
        )


@pytest.mark.parametrize("sitio", ["isla_fuerte", "islas_rosario"])
def test_s2_22_el_aviso_eliminatorio_no_repite_el_estado_legal(aplicacion, ventana, sitio):
    ventana.combo_sitio.setCurrentText(sitio)
    _reposar(aplicacion, ventana)
    texto = ventana.paneles["disenar"].etiqueta_eliminatorio.text()
    estado = ventana.paneles["disenar"].extras["panel_sitio"].estado_legal
    assert texto.count(estado) == 1, f"{estado!r} aparece {texto.count(estado)} veces: {texto!r}"


def test_s2_23_el_eje_de_potencia_se_rotula_a_la_derecha(aplicacion):
    """clear() sobre el eje gemelo devolvia 'kW' a la izquierda, encima de 'metros'."""
    from interfaz.graficas import LienzoSeries

    lienzo = LienzoSeries()
    for _ in range(3):  # el defecto solo aparecia al repintar
        lienzo.mostrar(simular(Parametros())["resultado"])
    assert lienzo.ejes.yaxis.get_label().get_text() == "metros"
    assert lienzo.ejes_potencia.yaxis.get_label().get_text() == "kW"
    assert lienzo.ejes_potencia.yaxis.get_label_position() == "right"
    assert lienzo.ejes.yaxis.get_label_position() == "left"


def test_s2_24_sin_resonancia_el_grafico_no_anuncia_un_periodo_preferido(aplicacion):
    """Con 120 t y 6 m la curva es monotona: no debe salir 'la boya prefiere'."""
    from analisis.captura import respuesta_periodo
    from interfaz.graficas import LienzoRespuesta

    lienzo = LienzoRespuesta()
    respuesta = respuesta_periodo(120_000.0, 6.0, hm0_m=2.5, bpto_ns_m=200_000.0)
    assert respuesta.pico_interior is False
    lienzo.mostrar(respuesta, te_actual=5.7)
    rotulos = [texto.get_text() for texto in lienzo.ejes.get_legend().get_texts()]
    assert not any("prefiere" in r for r in rotulos), rotulos
    assert any("sin resonancia" in r for r in rotulos), rotulos


# --------------------------------------------------------------------------
# 2i. Desplazamiento de los paneles y zoom del mapa
# --------------------------------------------------------------------------


def test_s2_25_los_cuatro_niveles_son_desplazables(aplicacion, ventana):
    """Cada nivel dentro de un area desplazable, con el panel un nivel por dentro."""
    from PySide6.QtWidgets import QScrollArea

    from app.niveles import NIVELES

    assert ventana.pila.count() == len(NIVELES)
    for indice, nivel in enumerate(NIVELES):
        contenedor = ventana.pila.widget(indice)
        assert isinstance(contenedor, QScrollArea), f"{nivel} no es desplazable"
        assert contenedor.widget() is ventana.paneles[nivel]
        assert contenedor.widgetResizable(), "el panel debe seguir el ancho de la ventana"


def test_s2_26_en_ventana_baja_aparece_la_barra_de_desplazamiento(aplicacion, ventana):
    """Antes el contenido se recortaba sin mas; ahora se puede recorrer."""
    from app.niveles import NIVELES

    ancho = ventana.width()
    ventana.resize(ancho, 420)
    _bombear(aplicacion, 1.0)
    try:
        desplazables = []
        for indice, nivel in enumerate(NIVELES):
            ventana.cambiar_nivel(indice)
            _bombear(aplicacion, 0.3)
            contenedor = ventana.pila.widget(indice)
            barra = contenedor.verticalScrollBar()
            if barra.maximum() > 0:
                desplazables.append(nivel)
                barra.setValue(barra.maximum())
                assert barra.value() == barra.maximum(), f"{nivel} no llega al final"
        assert desplazables, "con 420 px de alto algun nivel tiene que desplazarse"
        assert ventana.isVisible()
    finally:
        ventana.resize(ancho, 860)
        _bombear(aplicacion, 0.5)


class _Rueda:
    def __init__(self, x, y, button):
        self.xdata = x
        self.ydata = y
        self.button = button


def test_s2_27_la_rueda_acerca_y_aleja_el_mapa(ventana):
    from interfaz.mapa import LAT_MAX, LAT_MIN, LON_MAX, LON_MIN

    mapa = ventana.paneles["disenar"].mapa
    mapa.encuadrar()
    ancho_inicial = mapa.ejes.get_xlim()[1] - mapa.ejes.get_xlim()[0]
    assert ancho_inicial == pytest.approx(LON_MAX - LON_MIN)

    mapa._al_rodar(_Rueda(-76.18, 9.39, "up"))
    acercado = mapa.ejes.get_xlim()[1] - mapa.ejes.get_xlim()[0]
    assert acercado < ancho_inicial, "la rueda arriba tiene que acercar"

    mapa._al_rodar(_Rueda(-76.18, 9.39, "down"))
    assert mapa.ejes.get_xlim()[1] - mapa.ejes.get_xlim()[0] == pytest.approx(ancho_inicial)
    assert mapa.ejes.get_ylim() == pytest.approx((LAT_MIN, LAT_MAX))
    mapa.encuadrar()


def test_s2_28_el_zoom_deja_el_cursor_sobre_el_mismo_punto(ventana):
    """Ancla el punto apuntado, no lo centra: es lo que hace un mapa."""
    mapa = ventana.paneles["disenar"].mapa
    mapa.encuadrar()
    x, y = -76.18, 9.39

    def fraccion() -> float:
        x0, x1 = mapa.ejes.get_xlim()
        return (x - x0) / (x1 - x0)

    inicial = fraccion()
    for _ in range(4):
        mapa._al_rodar(_Rueda(x, y, "up"))
        assert fraccion() == pytest.approx(inicial, abs=1e-9), "el punto se movio bajo el cursor"
    (x0, x1), (y0, y1) = mapa.ejes.get_xlim(), mapa.ejes.get_ylim()
    assert x0 < x < x1 and y0 < y < y1, "el punto apuntado se salio del encuadre"
    mapa.encuadrar()


def test_s2_29_el_zoom_esta_acotado_y_sobrevive_al_repintado(ventana):
    from interfaz.mapa import ZOOM_MAXIMO_GRADOS, ZOOM_MINIMO_GRADOS

    mapa = ventana.paneles["disenar"].mapa
    mapa.encuadrar()
    for _ in range(60):  # mucho mas alla de los topes en ambos sentidos
        mapa._al_rodar(_Rueda(-76.18, 9.39, "up"))
    ancho = mapa.ejes.get_xlim()[1] - mapa.ejes.get_xlim()[0]
    assert ZOOM_MINIMO_GRADOS <= ancho <= ZOOM_MAXIMO_GRADOS, ancho

    # pasar el raton o conmutar una capa no puede deshacer el zoom
    vista = (mapa.ejes.get_xlim(), mapa.ejes.get_ylim())
    mapa._al_mover(_Evento(-76.0, 9.5))
    mapa.conmutar("batimetria", False)
    mapa.fijar_sitio("tumaco")
    assert mapa.ejes.get_xlim() == pytest.approx(vista[0])
    assert mapa.ejes.get_ylim() == pytest.approx(vista[1])

    for _ in range(60):
        mapa._al_rodar(_Rueda(-76.18, 9.39, "down"))
    assert mapa.ejes.get_xlim()[1] - mapa.ejes.get_xlim()[0] <= ZOOM_MAXIMO_GRADOS
    mapa.conmutar("batimetria", True)
    mapa.encuadrar()


def test_s2_30_la_rueda_con_coordenadas_invalidas_no_hace_nada(ventana):
    mapa = ventana.paneles["disenar"].mapa
    mapa.encuadrar()
    vista = (mapa.ejes.get_xlim(), mapa.ejes.get_ylim())
    for coordenada in ((None, None), (float("nan"), float("nan")), (float("inf"), 9.0)):
        mapa._al_rodar(_Rueda(*coordenada, "up"))
    assert mapa.ejes.get_xlim() == pytest.approx(vista[0])
    assert mapa.ejes.get_ylim() == pytest.approx(vista[1])


def test_s2_31_el_mapa_trae_barra_de_navegacion(ventana):
    """Desplazar y reencuadrar los pone matplotlib; no se reimplementan."""
    from matplotlib.backends.backend_qtagg import NavigationToolbar2QT

    panel = ventana.paneles["disenar"]
    assert isinstance(panel.navegacion_mapa, NavigationToolbar2QT)
    assert panel.navegacion_mapa.canvas is panel.mapa
    # con una herramienta activa el clic navega, no elige emplazamiento
    mapa = panel.mapa
    mapa.fijar_sitio("isla_fuerte")
    mapa.widgetlock(mapa)
    try:
        mapa._al_pulsar(_Evento(-75.741, 10.235))  # justo sobre Islas del Rosario
        assert mapa._sitio_activo == "isla_fuerte"
    finally:
        mapa.widgetlock.release(mapa)
    mapa._al_pulsar(_Evento(-75.741, 10.235))
    assert mapa._sitio_activo == "islas_rosario"
    mapa.fijar_sitio("isla_fuerte")


def _rueda_qt(widget, delta: int) -> bool:
    """Envia una rueda real y devuelve si el widget se quedo el gesto."""
    from PySide6.QtCore import QPoint, QPointF, Qt
    from PySide6.QtGui import QWheelEvent

    centro = QPointF(widget.width() / 2, widget.height() / 2)
    evento = QWheelEvent(
        centro,
        widget.mapToGlobal(QPoint(int(centro.x()), int(centro.y()))),
        QPoint(0, 0),
        QPoint(0, delta),
        Qt.NoButton,
        Qt.NoModifier,
        Qt.NoScrollPhase,
        False,
    )
    QApplication.instance().sendEvent(widget, evento)
    return evento.isAccepted()


def test_s2_32_la_rueda_sobre_un_grafico_desplaza_la_pagina(aplicacion, ventana):
    """Qt solo propaga al area desplazable lo que el lienzo no acepta.

    matplotlib reimplementa wheelEvent sin marcarlo y Qt da la rueda por
    atendida, asi que con el cursor sobre cualquier grafico el panel dejaba de
    poder recorrerse.
    """
    panel = ventana.paneles["ver"]
    for lienzo in (panel.lienzo, panel.lienzo_respuesta, panel.lienzo_series):
        assert _rueda_qt(lienzo, -120) is False, f"{type(lienzo).__name__} se queda la rueda"
    assert _rueda_qt(ventana.paneles["comparar"].lienzo_sankey, -120) is False


def test_s2_33_la_rueda_sobre_el_mapa_hace_zoom_y_no_desplaza(aplicacion, ventana):
    mapa = ventana.paneles["disenar"].mapa
    mapa.encuadrar()
    ancho_antes = mapa.ejes.get_xlim()[1] - mapa.ejes.get_xlim()[0]
    assert _rueda_qt(mapa, 120) is True, "el mapa debe quedarse la rueda para el zoom"
    assert mapa.ejes.get_xlim()[1] - mapa.ejes.get_xlim()[0] < ancho_antes
    mapa.encuadrar()


def test_s2_34_el_area_desplazable_si_mueve_la_pagina(aplicacion, ventana):
    ancho = ventana.width()
    ventana.resize(ancho, 420)
    _bombear(aplicacion, 1.0)
    try:
        ventana.cambiar_nivel(0)
        _bombear(aplicacion, 0.5)
        contenedor = ventana.pila.widget(0)
        barra = contenedor.verticalScrollBar()
        assert barra.maximum() > 0, "con 420 px de alto el nivel Ver tiene que desplazarse"
        barra.setValue(0)
        _rueda_qt(contenedor.viewport(), -120)
        _bombear(aplicacion, 0.3)
        assert barra.value() > 0, "la rueda sobre el area no movio la pagina"
    finally:
        ventana.resize(ancho, 860)
        _bombear(aplicacion, 0.5)
