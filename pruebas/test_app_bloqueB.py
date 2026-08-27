import pathlib
import tempfile


def test_8_01_trabajo_fuera_hilo():
    from app.trabajo import Trabajo

    done = {}

    def fn(on_progreso, cancel_event):
        on_progreso(50)
        return 42

    t = Trabajo(fn, on_resultado=lambda v: done.setdefault("v", v))
    t.iniciar()
    t.esperar(timeout=5)
    assert done.get("v") == 42


def test_8_02_cancelacion():
    import time

    from app.trabajo import Trabajo

    def fn(on_progreso, cancel_event):
        for _ in range(20):
            if cancel_event.is_set():
                return "cancelado"
            time.sleep(0.02)
        return "terminado"

    t = Trabajo(fn)
    t.iniciar()
    time.sleep(0.05)
    t.cancelar()
    t.esperar(timeout=2)
    assert not t.esta_en_curso()


def test_8_03_niveles_mismo_resultado():
    from app.niveles import GestorNiveles
    from nucleo.dispositivos.absorbedor import AbsorbedorPuntual
    from nucleo.dispositivos.base import ContextoRecurso

    r = AbsorbedorPuntual().resolver({"hm0": 1.5, "te": 6}, ContextoRecurso())
    g = GestorNiveles(r)
    v1 = g.cambiar_nivel("ver").produccion_mwh
    v2 = g.cambiar_nivel("calcular").produccion_mwh
    assert v1 == v2


def test_8_04_formato_espanol():
    from app.formato import formatear_numero

    assert formatear_numero(8.9, 1) == "8,9"
    assert formatear_numero(1435.4, 1) == "1.435,4"


def test_8_05_formulas_sustituidas():
    from app.formulas import formulas_desde_resultado
    from nucleo.dispositivos.absorbedor import AbsorbedorPuntual
    from nucleo.dispositivos.base import ContextoRecurso

    r = AbsorbedorPuntual().resolver({"hm0": 2.0, "te": 8.0}, ContextoRecurso())
    f = formulas_desde_resultado(r)
    assert len(f) >= 1


def test_8_06_procedencia():
    from app.procedencia import fuente_de_constante

    f = fuente_de_constante("densidad_potencia_media", sitio_id="isla_fuerte")
    assert f is not None
    assert len(f) > 0


def test_8_07_animacion_muestrea_serie():
    from app.animacion import datos_animacion_desde_resultado
    from nucleo.dispositivos.absorbedor import AbsorbedorPuntual
    from nucleo.dispositivos.base import ContextoRecurso

    r = AbsorbedorPuntual().resolver({"hm0": 2.0, "te": 8.0}, ContextoRecurso())
    datos = datos_animacion_desde_resultado(r)
    assert isinstance(datos, dict)
    assert len(datos) > 0


def test_8_08_escenarios_roundtrip():
    from app.escenarios import cargar_escenario, guardar_escenario

    with tempfile.TemporaryDirectory() as td:
        p = pathlib.Path(td) / "esc.json"
        guardar_escenario(str(p), {"hm0": 1.5}, {"dummy": 1})
        rec = cargar_escenario(str(p))
        assert rec["parametros"]["hm0"] == 1.5


def test_8_09_export_csv():
    from app.exportacion import exportar_csv
    from nucleo.dispositivos.absorbedor import AbsorbedorPuntual
    from nucleo.dispositivos.base import ContextoRecurso

    r = AbsorbedorPuntual().resolver({"hm0": 1.5, "te": 6}, ContextoRecurso())
    with tempfile.TemporaryDirectory() as td:
        p = pathlib.Path(td) / "res.csv"
        out = exportar_csv(r, str(p))
        assert pathlib.Path(out).exists()


def test_8_10_limitaciones():
    from app.limitaciones import LIMITACIONES

    assert len(LIMITACIONES) >= 3


def test_8_14_tesis():
    from app.tesis import contraste_isla_fuerte_vs_umbral, tabla_densidades_con_fuente

    c = contraste_isla_fuerte_vs_umbral()
    assert c["isla_fuerte_kw_m"] == 8.9
    t = tabla_densidades_con_fuente()
    assert len(t) >= 5


def test_8_13_dato_pendiente_bloquea():
    from nucleo.dato import Dato, DatoPendienteError

    d = Dato(valor=1.0, unidad="m", fuente="pendiente", estado="pendiente")
    try:
        d.exigir()
        assert False
    except DatoPendienteError:
        pass
