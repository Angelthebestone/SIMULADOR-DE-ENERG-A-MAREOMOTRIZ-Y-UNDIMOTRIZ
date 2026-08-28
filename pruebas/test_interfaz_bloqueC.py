"""Bloque C — interfaz. Se ejecuta sin pantalla con la plataforma offscreen de Qt."""

import math
import os
import time

import numpy as np
import pytest

os.environ.setdefault("QT_QPA_PLATFORM", "offscreen")

pytest.importorskip("PySide6")

from PySide6.QtWidgets import QApplication, QLabel, QSlider  # noqa: E402

from interfaz.calculo import Parametros, comparar_dos, simular  # noqa: E402


@pytest.fixture(scope="module")
def aplicacion():
    app = QApplication.instance() or QApplication([])
    yield app


@pytest.fixture(scope="module")
def caso():
    return simular(Parametros())


def _ventana(aplicacion, segundos=30):
    from interfaz.app import VentanaPrincipal

    ventana = VentanaPrincipal()
    ventana.show()
    inicio = time.perf_counter()
    while ventana.gestor is None and time.perf_counter() - inicio < segundos:
        aplicacion.processEvents()
        time.sleep(0.01)
    assert ventana.gestor is not None, "el primer calculo no termino"
    return ventana


def test_9_01_conmutador_y_tesis(aplicacion):
    ventana = _ventana(aplicacion)
    assert len(ventana.grupo_niveles.buttons()) == 4
    assert "8,9" in ventana.etiqueta_tesis.text() and "40" in ventana.etiqueta_tesis.text()
    producciones = {
        ventana.gestor.cambiar_nivel(n).produccion_mwh
        for n in ("ver", "comparar", "calcular", "disenar")
    }
    assert len(producciones) == 1


def test_9_02_lienzo_usa_el_k_de_la_dispersion(aplicacion, caso):
    from interfaz.graficas import LienzoOleaje
    from nucleo.olas import numero_onda

    lienzo = LienzoOleaje()
    lienzo.mostrar(caso["resultado"])
    parametros = caso["extras"]["parametros"]
    k_nucleo, _ = numero_onda(2 * math.pi / parametros.te_s, parametros.profundidad_m)
    assert lienzo.k_rad_m == pytest.approx(k_nucleo, rel=1e-12)
    lienzo.detener()


def test_9_02b_la_profundidad_cambia_la_longitud_de_onda(aplicacion):
    from interfaz.graficas import LienzoOleaje

    longitudes = []
    for profundidad in (15.0, 60.0):
        lienzo = LienzoOleaje()
        lienzo.mostrar(simular(Parametros(profundidad_m=profundidad))["resultado"])
        longitudes.append(lienzo.longitud_onda_m)
        lienzo.detener()
    assert longitudes[0] < longitudes[1]


def test_9_03_boya_de_la_serie_integrada(aplicacion):
    from interfaz.graficas import LienzoOleaje

    amplitudes = []
    for freno in (20_000.0, 400_000.0):
        resultado = simular(Parametros(b_pto_ns_m=freno))["resultado"]
        lienzo = LienzoOleaje()
        lienzo.mostrar(resultado)
        assert lienzo._z_boya is not None, "la boya debe salir de la serie integrada"
        assert np.allclose(
            lienzo._z_boya[:5],
            np.interp(
                np.asarray(lienzo._datos["t"])[:5], resultado.series["t_s"], resultado.series["z_m"]
            ),
        )
        amplitudes.append(float(np.max(np.abs(resultado.series["z_m"][-1000:]))))
        lienzo.detener()
    assert amplitudes[1] < amplitudes[0], "mas amortiguamiento debe dar menos amplitud"


def test_9_04_tres_controles_en_lenguaje_corriente(aplicacion):
    from interfaz.paneles import PanelVer

    panel = PanelVer()
    assert len(panel.findChildren(QSlider)) == 3
    rotulos = " ".join(etiqueta.text() for etiqueta in panel.findChildren(QLabel)).lower()
    assert "grandes son las olas" in rotulos
    assert "llega una ola" in rotulos
    assert "frena la boya" in rotulos


def test_9_05_resultado_en_viviendas_sin_formulas(aplicacion, caso):
    from interfaz.paneles import PanelVer

    panel = PanelVer()
    panel.actualizar(caso["resultado"], caso["extras"])
    texto = panel.titular.text() + panel.pie.text()
    assert "casas" in texto
    assert "=" not in texto and "rho" not in texto


def test_10_01_sankey_de_la_cadena_completa(aplicacion, caso):
    from interfaz.sankey import LienzoSankey

    lienzo = LienzoSankey()
    lienzo.mostrar(caso["resultado"])
    assert len(lienzo.ejes.patches) >= len(caso["resultado"].eslabones)


def test_10_02_fichas_de_fracaso_con_causa(aplicacion):
    from interfaz.paneles import naturaleza_fracaso

    assert naturaleza_fracaso("Economica - coste por MWh incompatible") == "económica"
    assert "técnica" in naturaleza_fracaso("Tecnica/economica - potencia real mitad")
    assert "ambiental" in naturaleza_fracaso("Doble: mortalidad sustancial de peces")


def test_10_03_catalogo_ocho_mas_siete(aplicacion, caso):
    from interfaz.paneles import PanelComparar

    panel = PanelComparar()
    tabla = panel.tabla_catalogo
    familias = [tabla.item(f, 0).text() for f in range(tabla.rowCount())]
    assert familias.count("undimotriz") == 8
    assert familias.count("mareomotriz_corriente") == 7
    modelos = [tabla.item(f, 5).text() for f in range(tabla.rowCount())]
    assert "simulable" in modelos and any("solo consultable" in m for m in modelos)


def test_10_04_dos_tecnologias_mismo_recurso(aplicacion):
    comparacion = comparar_dos(Parametros(), "absorbedor_puntual", "owc")
    assert comparacion["a"].recurso["hm0"] == comparacion["b"].recurso["hm0"]
    assert comparacion["a"].recurso["te"] == comparacion["b"].recurso["te"]
    assert "captura" in comparacion["divergencia"]


def test_11_01_formulas_con_numeros_sustituidos(aplicacion, caso):
    from interfaz.paneles import PanelCalcular

    panel = PanelCalcular()
    panel.actualizar(caso["resultado"], caso["extras"])
    formulas = [
        panel.tabla_formulas.item(f, 1).text() for f in range(panel.tabla_formulas.rowCount())
    ]
    assert any("=" in f and any(c.isdigit() for c in f) for f in formulas)


def test_11_02_procedencia_al_pasar_el_cursor(aplicacion, caso):
    from interfaz.paneles import PanelCalcular

    panel = PanelCalcular()
    panel.actualizar(caso["resultado"], caso["extras"])
    tabla = panel.tabla_constantes
    fuentes = [tabla.item(f, 0).toolTip() for f in range(tabla.rowCount())]
    assert all(fuente for fuente in fuentes), "toda constante mostrada lleva su fuente"


def test_11_03_11_04_paneles_de_diseno(aplicacion, caso):
    from interfaz.paneles import PanelDisenar

    panel = PanelDisenar()
    panel.actualizar(caso["resultado"], caso["extras"])
    magnitudes = [
        panel.tabla_captura.item(f, 0).text() for f in range(panel.tabla_captura.rowCount())
    ]
    assert {"Periodo natural", "Ancho de captura máximo", "Cota de Falnes"} <= set(magnitudes)
    metodos = [panel.tabla_aep.item(f, 0).text() for f in range(panel.tabla_aep.rowCount())]
    assert len(metodos) >= 2


def test_11_05_economia_bloqueada_sin_capex(aplicacion, caso):
    from interfaz.paneles import PanelDisenar

    panel = PanelDisenar()
    panel.actualizar(caso["resultado"], caso["extras"])
    assert "pendiente" in panel.tabla_economia.item(0, 1).text()
    panel.entrada_capex.setValue(8000.0)
    conceptos = [
        panel.tabla_economia.item(f, 0).text() for f in range(panel.tabla_economia.rowCount())
    ]
    assert any("diésel" in c for c in conceptos)
    assert any("red interconectada" in c for c in conceptos)


def test_11_06_area_protegida_antes_que_el_recurso(aplicacion):
    from interfaz.paneles import PanelDisenar

    panel = PanelDisenar()
    caso_rosario = simular(Parametros(sitio_id="islas_rosario"))
    panel.actualizar(caso_rosario["resultado"], caso_rosario["extras"])
    texto = panel.etiqueta_eliminatorio.text()
    assert "protegida" in texto.lower()
    assert panel.etiqueta_eliminatorio.property("estado") == "pendiente"
    grupo = panel.etiqueta_eliminatorio.parent()
    assert grupo.title().startswith("1.")


def test_12_02_estados_vacios_y_pendientes(aplicacion):
    from interfaz.estilo import TEXTO_VACIO, hoja_estilos
    from interfaz.paneles import PanelVer

    panel = PanelVer()
    assert panel.titular.text() == TEXTO_VACIO
    assert panel.titular.property("estado") == "vacio"
    assert 'QLabel[estado="pendiente"]' in hoja_estilos(False)


def test_12_03_12_04_progreso_cancelacion_y_ventana_viva(aplicacion):
    ventana = _ventana(aplicacion)
    ventana.lanzar(completo=True)
    assert ventana.barra.isVisible() and ventana.boton_cancelar.isEnabled()
    inicio = time.perf_counter()
    while ventana.barra.value() < 15 and time.perf_counter() - inicio < 30:
        aplicacion.processEvents()
        time.sleep(0.01)
    assert ventana.trabajo.esta_en_curso(), "la simulacion costosa debe seguir en curso"
    ventana.cambiar_nivel(2)
    aplicacion.processEvents()
    # cada nivel vive dentro de su area desplazable, asi que el widget de la
    # pila es el contenedor y el panel esta un nivel por dentro
    assert ventana.pila.currentWidget().widget() is ventana.paneles["calcular"], "la ventana responde"
    ventana.cancelar()
    ventana.trabajo.esperar(timeout=10)
    assert not ventana.trabajo.esta_en_curso()
    assert not ventana.boton_cancelar.isEnabled()


def test_9_06_la_resonancia_es_alcanzable_moviendo_el_periodo(aplicacion):
    """La leccion central del absorbedor tiene que caber en el rango del deslizador."""
    from interfaz.calculo import Parametros

    caso = simular(Parametros())
    respuesta = caso["extras"]["respuesta"]
    assert 4.0 <= respuesta.te_resonante_s <= 12.0, "el pico cae fuera del deslizador de Te"
    assert respuesta.amplificacion_maxima > 1.4, "sin amplificacion visible no se ve resonancia"
    lejos = simular(Parametros(te_s=12.0))["extras"]["amplitud_boya_m"]
    cerca = simular(Parametros(te_s=respuesta.te_resonante_s))["extras"]["amplitud_boya_m"]
    assert cerca > 1.5 * lejos, "la boya debe moverse mucho mas cerca de la resonancia"


def test_9_07_masa_de_la_boya_coherente_con_su_geometria(aplicacion):
    from nucleo.dispositivos.absorbedor import CALADO_REF_M, DIAMETRO_REF_M, MASA_FLOTACION_KG
    from nucleo.constantes import RHO_AGUA_MAR

    esperada = RHO_AGUA_MAR * math.pi * DIAMETRO_REF_M**2 / 4 * CALADO_REF_M
    assert MASA_FLOTACION_KG == pytest.approx(esperada)


def test_9_08_series_de_la_maquina_trabajando(aplicacion, caso):
    from interfaz.graficas import LienzoSeries

    resultado = caso["resultado"]
    assert "p_pto_w" in resultado.series
    potencia = np.asarray(resultado.series["p_pto_w"])
    assert np.all(potencia >= 0), "la potencia del PTO nunca es negativa"
    media_serie = float(np.mean(potencia[-1000:]))
    assert media_serie == pytest.approx(resultado.eslabones[0].potencia_salida_w, rel=0.5)
    lienzo = LienzoSeries()
    lienzo.mostrar(resultado)
    lienzo.marcar_instante(0.5)


def test_9_09_explica_por_que_cambio(aplicacion):
    from app.vocabulario import explicar_cambio

    antes = {"hm0_m": 1.5, "te_s": 9.0, "b_pto_ns_m": 80_000.0}
    texto = explicar_cambio(antes, {**antes, "hm0_m": 3.0}, 6.0)
    assert "4,0 veces" in texto, "el cuadrado de la altura tiene que salir explicado"
    acerca = explicar_cambio(antes, {**antes, "te_s": 6.2}, 6.0)
    assert "acercas" in acerca
    aleja = explicar_cambio(antes, {**antes, "te_s": 12.0}, 6.0)
    assert "alejas" in aleja


def test_8_04b_el_redondeo_no_pierde_el_acarreo(aplicacion):
    from app.formato import formatear_numero

    assert formatear_numero(5.96, 1) == "6,0"
    assert formatear_numero(1435.96, 1) == "1.436,0"
    assert formatear_numero(8.9, 1) == "8,9"
    assert formatear_numero(-8.94, 1) == "-8,9"


def test_mapa_capas_locales_y_eliminatorio_primero(aplicacion):
    from interfaz.mapa import LienzoMapa, cargar_areas_protegidas, cargar_sitios

    areas = cargar_areas_protegidas()
    assert len(areas) == 37, "RUNAP declara 37 areas marinas protegidas"
    assert all(a["nombre"] and a["categoria"] for a in areas)
    mapa = LienzoMapa()
    mapa.dibujar()
    assert set(mapa.capas) == {"protegidas", "recurso", "batimetria"}
    mapa.conmutar("protegidas", False)
    assert mapa.capas["protegidas"] is False
    descripcion = mapa.descripcion_sitio("islas_rosario")
    assert descripcion.index("descartado") < descripcion.index("recurso")
    sitios = {s["id"]: s for s in cargar_sitios()}
    assert sitios["isla_fuerte"]["estado_recurso"] == "verificado"
    assert sitios["islas_rosario"]["j_kw_m"] is None


def test_mapa_fija_el_emplazamiento_activo(aplicacion):
    ventana = _ventana(aplicacion)
    ventana.paneles["disenar"].sitio_elegido.emit("tumaco")
    aplicacion.processEvents()
    assert ventana.parametros.sitio_id == "tumaco"
