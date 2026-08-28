"""Estres destructivo del nucleo: simular(Parametros(...)) sin ventana.

Cada prueba distingue los dos desenlaces aceptables de los inaceptables:
- acotado-y-explicado: el valor se recorta al rango de nucleo/validacion y el
  motivo viaja en extras["avisos_entrada"];
- invariante roto: excepcion sin acotar, potencia negativa, rendimiento fuera
  de [0,1] o un Dato pendiente que se cuela como cifra valida.

Escritas como auditoria destructiva; los defectos que encontraron ya estan
corregidos, asi que ahora fijan el comportamiento arreglado contra regresiones.
"""

from __future__ import annotations

import math

import numpy as np
import pytest

from analisis.emplazamiento import panel_emplazamiento
from analisis.resonancia import analizar_resonancia
from interfaz.calculo import Parametros, simular
from nucleo.dato import Dato, DatoPendienteError
from nucleo.validacion import RANGOS, acotar

DISPOSITIVOS_MODELADOS = ("absorbedor_puntual", "owc", "turbina_corriente", "embalse")


def _salida(**kwargs):
    return simular(Parametros(**kwargs))


def _avisos(salida) -> str:
    return " | ".join(salida["extras"]["avisos_entrada"])


# --------------------------------------------------------------------------
# 1. Entradas del recurso: deben acotar y explicar, nunca reventar
# --------------------------------------------------------------------------


@pytest.mark.parametrize("hm0", [0.0, -1.0, 0.01, 1.5, 5.0, 15.0, 100.0])
def test_s1_01_hm0_extremo_acota_o_pasa(hm0):
    salida = _salida(hm0_m=hm0)
    minimo, maximo = RANGOS["Hm0"]
    dentro = minimo <= hm0 <= maximo
    assert bool(_avisos(salida)) is not dentro, f"Hm0={hm0} sin aviso de acotacion"
    if not dentro:
        assert f"Hm0={hm0}" in _avisos(salida)
    assert salida["resultado"].eslabones[-1].potencia_salida_w >= 0.0


@pytest.mark.parametrize("te", [0.0, 0.5, 1.0, 6.0, 12.0, 30.0, 100.0])
def test_s1_02_te_extremo_acota_o_pasa(te):
    salida = _salida(te_s=te)
    minimo, maximo = RANGOS["Te"]
    dentro = minimo <= te <= maximo
    assert bool(_avisos(salida)) is not dentro, f"Te={te} sin aviso de acotacion"
    # Te acotado nunca puede llegar en cero al 2*pi/Te del integrador
    assert salida["extras"]["parametros"].te_s >= minimo


@pytest.mark.parametrize("bpto", [0.0, 1.0, 80_000.0, 500_000.0, 1e9])
def test_s1_03_bpto_extremo_acota_o_pasa(bpto):
    salida = _salida(b_pto_ns_m=bpto)
    minimo, maximo = RANGOS["amortiguamiento_pto"]
    dentro = minimo <= bpto <= maximo
    assert bool(_avisos(salida)) is not dentro, f"B_pto={bpto} sin aviso de acotacion"
    assert minimo <= salida["extras"]["parametros"].b_pto_ns_m <= maximo


@pytest.mark.parametrize("prof", [0.0, 1.0, 15.0, 30.0, 60.0, 500.0])
def test_s1_04_profundidad_extrema_acota_o_pasa(prof):
    salida = _salida(profundidad_m=prof)
    minimo, maximo = RANGOS["profundidad"]
    dentro = minimo <= prof <= maximo
    assert bool(_avisos(salida)) is not dentro, f"profundidad={prof} sin aviso"
    # profundidad 0 romperia el solucionador de dispersion: debe llegar acotada
    assert salida["extras"]["parametros"].profundidad_m >= minimo


# --------------------------------------------------------------------------
# 1b. Geometria de la boya: masa y diametro NO pasan por _acotar
# --------------------------------------------------------------------------


@pytest.mark.parametrize("masa", [20.0, 30_000.0, 1e7])
def test_s1_05_masa_valida_resuelve(masa):
    salida = _salida(masa_kg=masa)
    assert salida["resultado"].eslabones[-1].potencia_salida_w >= 0.0


@pytest.mark.parametrize("masa", [-1000.0, 0.0, 20.0, 1e9])
def test_s1_06_masa_fuera_de_rango_se_acota(masa):
    salida = _salida(masa_kg=masa)
    minimo, maximo = RANGOS["masa_boya"]
    assert f"masa_boya={masa}" in _avisos(salida), "masa fuera de rango sin aviso"
    assert minimo <= salida["extras"]["parametros"].masa_kg <= maximo
    assert salida["resultado"].eslabones[-1].potencia_salida_w >= 0.0


@pytest.mark.parametrize("diametro", [0.5, 10.0, 50.0])
def test_s1_07_diametro_valido_resuelve(diametro):
    salida = _salida(diametro_m=diametro)
    assert salida["resultado"].eslabones[-1].potencia_salida_w >= 0.0


@pytest.mark.parametrize("diametro", [0.0, 0.5, 50.0])
def test_s1_08_diametro_fuera_de_rango_se_acota(diametro):
    salida = _salida(diametro_m=diametro)
    minimo, maximo = RANGOS["diametro_boya"]
    assert f"diametro_boya={diametro}" in _avisos(salida), "diametro fuera de rango sin aviso"
    assert minimo <= salida["extras"]["parametros"].diametro_m <= maximo


def test_s1_09_el_orquestador_aplica_los_rangos_de_geometria():
    """Lo que declara nucleo/validacion es lo que llega al dispositivo."""
    for clave, campo in (("diametro_boya", "diametro_m"), ("masa_boya", "masa_kg")):
        minimo, maximo = RANGOS[clave]
        acotado, aviso = acotar(clave, 0.0)
        assert acotado == minimo and aviso is not None
        parametros = simular(Parametros(**{campo: 0.0}))["extras"]["parametros"]
        assert getattr(parametros, campo) == minimo
        parametros = simular(Parametros(**{campo: maximo * 10}))["extras"]["parametros"]
        assert getattr(parametros, campo) == maximo


# --------------------------------------------------------------------------
# 1c. Emplazamiento: id inexistente, vacio o None deben degradar, no romper
# --------------------------------------------------------------------------


@pytest.mark.parametrize("sitio", ["isla_fuerte", "islas_rosario", "inexistente", "", None])
def test_s1_10_sitio_id_arbitrario_degrada(sitio):
    salida = _salida(sitio_id=sitio)
    panel = salida["extras"]["panel_sitio"]
    assert panel.veredicto, "siempre debe haber veredicto legal"
    assert salida["resultado"].eslabones[-1].potencia_salida_w >= 0.0


def test_s1_11_sitio_protegido_marca_eliminatorio_sin_falsear_el_recurso():
    """Islas del Rosario es PNN: eliminatorio declarado, cifra de recurso intacta."""
    protegido = _salida(sitio_id="islas_rosario")
    libre = _salida(sitio_id="isla_fuerte")
    panel = protegido["extras"]["panel_sitio"]
    assert panel.eliminatorio is True
    assert "descartado" in panel.veredicto
    assert any("no utilizable" in aviso for aviso in panel.avisos)
    # el recurso de entrada lo fija el usuario, asi que la potencia coincide
    assert protegido["resultado"].eslabones[-1].potencia_salida_w == pytest.approx(
        libre["resultado"].eslabones[-1].potencia_salida_w
    )


def test_s1_12_sitio_desconocido_no_se_declara_utilizable():
    for sitio in ("inexistente", "", None):
        panel = _salida(sitio_id=sitio)["extras"]["panel_sitio"]
        assert panel.estado_legal == "desconocido"
        assert "utilizable —" not in panel.veredicto


# --------------------------------------------------------------------------
# 1d. Contrato Dato {valor, unidad, fuente, estado}
# --------------------------------------------------------------------------


def test_s1_13_dato_pendiente_bloquea_y_los_demas_no():
    base = {"unidad": "kW/m", "fuente": "prueba"}
    pendiente = Dato(valor=25.0, estado="pendiente", **base)
    with pytest.raises(DatoPendienteError):
        pendiente.exigir()
    assert pendiente.usable is False
    for estado in ("verificado", "inferido"):
        dato = Dato(valor=25.0, estado=estado, **base)
        assert dato.exigir() == 25.0 and dato.usable is True


@pytest.mark.parametrize(
    "campos",
    [
        {"unidad": "", "fuente": "x", "estado": "verificado"},
        {"unidad": "m", "fuente": "", "estado": "verificado"},
        {"unidad": "m", "fuente": "x", "estado": "inventado"},
    ],
)
def test_s1_14_dato_rechaza_fichas_incompletas(campos):
    with pytest.raises((ValueError, TypeError)):
        Dato(valor=1.0, **campos)


def test_s1_15_dato_pendiente_no_puntua_criterio():
    ficha = {
        "nombre": "sitio de prueba",
        "estado_legal": "utilizable",
        "densidad_potencia_media": {
            "valor": 25.0,
            "unidad": "kW/m",
            "fuente": "valor sin verificar, solo para la prueba",
            "estado": "pendiente",
        },
    }
    panel = panel_emplazamiento("sitio_prueba", sitio_json=ficha)
    energia = next(c for c in panel.criterios if "energia" in c.nombre)
    assert energia.cumple is False, "un dato pendiente no puede dar por cumplido un criterio"


def test_s1_15b_el_mapa_si_descarta_el_dato_pendiente():
    """Contraparte del anterior: interfaz/mapa aplica el contrato correctamente."""
    from interfaz.mapa import _recurso_de_sitio

    ficha = {
        "densidad_potencia_media": {
            "valor": 25.0,
            "unidad": "kW/m",
            "fuente": "valor sin verificar, solo para la prueba",
            "estado": "pendiente",
        }
    }
    valor, estado, _fuente = _recurso_de_sitio(ficha)
    assert valor is None and estado == "pendiente"


# --------------------------------------------------------------------------
# 1e. Invariantes fisicos sobre malla amplia
# --------------------------------------------------------------------------


@pytest.mark.parametrize("dispositivo", DISPOSITIVOS_MODELADOS)
@pytest.mark.parametrize(
    "hm0,te,bpto",
    [(0.5, 4.0, 10_000.0), (2.5, 8.0, 80_000.0), (4.0, 12.0, 500_000.0)],
)
def test_s1_16_invariantes_de_cadena(dispositivo, hm0, te, bpto):
    resultado = _salida(dispositivo=dispositivo, hm0_m=hm0, te_s=te, b_pto_ns_m=bpto)["resultado"]
    for eslabon in resultado.eslabones:
        assert eslabon.potencia_entrada_w >= 0.0, f"{eslabon.nombre}: entrada negativa"
        assert eslabon.potencia_salida_w >= 0.0, f"{eslabon.nombre}: potencia negativa"
        assert 0.0 <= eslabon.rendimiento <= 1.0, f"{eslabon.nombre}: {eslabon.rendimiento}"
        assert math.isfinite(eslabon.potencia_salida_w)
    assert 0.0 <= resultado.eficiencia_ola_cable <= 1.0
    assert resultado.produccion_anual_mwh >= 0.0
    assert 0.0 <= resultado.factor_planta <= 1.0


def test_s1_17_captura_nunca_supera_la_potencia_incidente():
    for hm0 in (0.5, 1.5, 4.0):
        for te in (4.0, 7.0, 12.0):
            captura = _salida(hm0_m=hm0, te_s=te)["resultado"].eslabones[0]
            assert captura.potencia_salida_w <= captura.potencia_entrada_w + 1e-6


# --------------------------------------------------------------------------
# 1f. Resonancia alcanzable dentro de los rangos que ofrece la interfaz
# --------------------------------------------------------------------------


def test_s1_18_resonancia_alcanzable_y_convergente():
    """Con masa 20-3000 t y diametro 2-20 m, Tn cruza el rango del deslizador Te."""
    te_min, te_max = RANGOS["Te"]
    periodos = []
    for masa_t in (20.0, 100.0, 402.5, 1000.0, 3000.0):
        for diametro in (2.0, 5.0, 10.0, 20.0):
            analisis = analizar_resonancia(masa_t * 1000.0, diametro, 7.0)
            assert analisis["resonancia"].convergio, "la iteracion de wn no convergio"
            periodos.append(analisis["resonancia"].tn_s)
    assert min(periodos) <= te_min and max(periodos) >= te_max, (
        f"Tn alcanzable {min(periodos):.2f}-{max(periodos):.2f} s "
        f"no cubre Te {te_min}-{te_max} s"
    )
    assert any(te_min <= tn <= te_max for tn in periodos)


def test_s1_19_resonancia_por_defecto_declara_su_desintonia():
    analisis = analizar_resonancia(402_500.0, 10.0, 7.0)
    separacion = analisis["separacion"]
    assert separacion.detalle and separacion.direccion_ajuste
    assert analisis["sintonizado"] is (abs(separacion.cociente_tn_te - 1.0) < 0.15)


# --------------------------------------------------------------------------
# 1g. Hallazgos de la inspeccion visual de la ventana
# --------------------------------------------------------------------------


def test_s1_20_la_resonancia_declarada_coincide_cuando_el_pico_es_interior():
    """Con la geometria por defecto las dos lecturas de resonancia se parecen."""
    from analisis.captura import respuesta_periodo

    respuesta = respuesta_periodo(402_500.0, 10.0, hm0_m=2.5, bpto_ns_m=200_000.0)
    natural = analizar_resonancia(402_500.0, 10.0, 5.7)["resonancia"]
    indice = int(np.argmax(respuesta.amplitud_m))
    assert 0 < indice < len(respuesta.te_s) - 1, "el pico deberia caer dentro del barrido"
    assert abs(respuesta.te_resonante_s - natural.tn_s) < 1.5


@pytest.mark.parametrize("masa_t,diametro", [(120.0, 6.0), (20.0, 2.0)])
def test_s1_21_el_borde_del_barrido_no_se_anuncia_como_resonancia(masa_t, diametro):
    """Curva monotona: no hay pico, y respuesta_periodo tiene que declararlo."""
    from analisis.captura import respuesta_periodo

    respuesta = respuesta_periodo(masa_t * 1000.0, diametro, hm0_m=2.5, bpto_ns_m=200_000.0)
    assert int(np.argmax(respuesta.amplitud_m)) == len(respuesta.te_s) - 1
    assert respuesta.pico_interior is False
    assert "sin pico" in respuesta.detalle


@pytest.mark.parametrize("diametro", [3.0, 6.0, 10.0, 30.0])
def test_s1_22_el_aviso_de_extrapolacion_cita_siempre_la_geometria_de_referencia(diametro):
    """El rango de validez sale del cilindro de 10 m, no del diametro evaluado.

    Antes se construia como 0,5*D a 2*D del propio D, un intervalo que siempre
    lo contenia y que por tanto nunca podia senalar una extrapolacion.
    """
    from nucleo.hidrodinamica import GEOMETRIA_CILINDRO_10M, coeficientes, validar_geometria

    aviso = coeficientes(1.0, diametro_m=diametro).aviso_extrapolacion
    referencia = GEOMETRIA_CILINDRO_10M.diametro_m
    assert f"fuera de diametro {referencia * 0.5}-{referencia * 2.0} m" in aviso
    # y el aviso concreto aparece exactamente cuando validar_geometria protesta
    assert ("fuera de rango validado" in aviso) is (validar_geometria(diametro) is not None)
