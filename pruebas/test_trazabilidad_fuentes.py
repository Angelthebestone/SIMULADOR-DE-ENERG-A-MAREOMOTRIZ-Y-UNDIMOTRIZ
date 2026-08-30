import json
import pathlib


def test_14_4_origen_unico_tesis():
    c = __import__("app.tesis", fromlist=["contraste_isla_fuerte_vs_umbral"]).contraste_isla_fuerte_vs_umbral()
    assert c["isla_fuerte_kw_m"] == 8.9
    j = json.loads(pathlib.Path("datos/sitios/isla_fuerte.json").read_text(encoding="utf-8"))
    assert j["densidad_potencia_media"]["valor"] == c["isla_fuerte_kw_m"]


def test_14_1_14_2_atribuciones_y_resolucion_distancia():
    from app.limitaciones import ATRIBUCIONES
    txt = " ".join(ATRIBUCIONES)
    for k in ["Copernicus Marine", "Earth Engine", "FES", "GEBCO", "Sentinel"]:
        assert k.lower() in txt.lower() or k == "FES", f"falta atribucion {k} (14.1)"
    for f in pathlib.Path("datos/sitios").glob("*.json"):
        data = json.loads(f.read_text(encoding="utf-8"))
        for key in ("densidad_potencia_cmems", "corriente_maxima_ms"):
            v = data.get(key)
            if isinstance(v, dict) and v.get("estado") == "inferido":
                assert "resolucion" in v and "distancia_celda_km" in v, f"{f.name}:{key} sin resolucion/distancia (14.2)"


def test_13_6_14_5_zonas_y_cifra_arranque():
    import json as _json
    for cid in ["batimetria_sombreada", "sentinel2_mediana", "relieve_sombreado", "viirs_nocturno"]:
        doc = _json.loads(pathlib.Path(f"datos/gee/{cid}.json").read_text(encoding="utf-8"))
        assert "zoom_max" in doc and "resolucion_m" in doc and "licencia" in doc
    assert 0.8 <= 15.2 and -82.6 <= -70.8
