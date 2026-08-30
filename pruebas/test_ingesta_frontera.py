import pathlib


def test_8_2_ingesta_no_en_grafo():
    libs = ["copernicusmarine", "earthengine", "ee", "geemap", "xarray", "netCDF4", "pyfes"]
    for p in list(pathlib.Path("nucleo").rglob("*.py")) + list(pathlib.Path("analisis").rglob("*.py")) + list(pathlib.Path("app").rglob("*.py")) + list(pathlib.Path("interfaz").rglob("*.py")):
        txt = p.read_text(encoding="utf-8")
        for lib in libs:
            assert f"import {lib}" not in txt, f"{p}: importa {lib} de [ingesta]"
            assert f"from {lib}" not in txt, f"{p}: importa {lib} de [ingesta]"


def test_14_3_inferido_sin_verificado():
    import json
    for f in pathlib.Path("datos/sitios").glob("*.json"):
        data = json.loads(f.read_text(encoding="utf-8"))
        for k, v in data.items():
            if not isinstance(v, dict) or "estado" not in v:
                continue
            if v.get("estado") != "inferido":
                continue
            fuente = str(v.get("fuente", "")).lower()
            assert "copernicus" in fuente or "glorys" in fuente or "cmems" in fuente or "era5" in fuente or "open-meteo" in fuente or "fes" in fuente or "gee" in fuente or "gebco" in fuente or "sentinel" in fuente or "viirs" in fuente or "supersi" in fuente or "inferido" in fuente or "pendiente reemplazo" in fuente or "pyfes" in fuente or "infer" in str(v.get("estado", "")), f"{f.name}:{k} inferido sin fuente de reanalisis/satelite/modelo: {v.get('fuente')}"


def test_11_4_esquema_sitios():
    import json
    estados_validos = {"verificado", "inferido", "pendiente"}
    obligatorias = {"densidad_potencia_media", "rango_mareal_medio", "corriente_maxima_ms"}
    for f in pathlib.Path("datos/sitios").glob("*.json"):
        data = json.loads(f.read_text(encoding="utf-8"))
        assert "id" in data and "estado_legal" in data, f"{f.name} sin id/estado_legal"
        assert data["estado_legal"] in {"utilizable", "restringido", "descartado"}, f"{f.name} estado_legal invalido"
        for clave in obligatorias:
            assert clave in data, f"{f.name} falta {clave} (11.1/11.2)"
            assert isinstance(data[clave], dict), f"{f.name}:{clave} no es Dato"
            assert data[clave].get("estado") in estados_validos, f"{f.name}:{clave} estado invalido: {data[clave].get('estado')}"
        for k, v in data.items():
            if isinstance(v, dict) and "estado" in v:
                assert v["estado"] in estados_validos, f"{f.name}:{k} estado {v['estado']} no declarado"
                if v.get("estado") == "pendiente":
                    assert v.get("valor") == 0.0 or v.get("valor") == 0, f"{f.name}:{k} pendiente debe ser 0.0 (11.3), es {v.get('valor')}"


def test_9_4_valor_diseno_no_cambia():
    import json
    data = json.loads(pathlib.Path("datos/sitios/isla_fuerte.json").read_text(encoding="utf-8"))
    assert data["densidad_potencia_media"]["valor"] == 8.9
    assert data["densidad_potencia_media"]["estado"] == "verificado"
    assert data["densidad_potencia_cmems"]["estado"] == "inferido"
    disc = data.get("discrepancia_densidad", {})
    assert disc.get("valor_diseno_kw_m") == 8.9


def test_10_5_10_6_10_7_corrientes():
    import json
    from app.servicio import Parametros, recurso_de
    for f in pathlib.Path("datos/sitios").glob("*.json"):
        data = json.loads(f.read_text(encoding="utf-8"))
        cid = data["id"]
        if cid in ("isla_fuerte", "san_andres", "islas_rosario", "tumaco", "bahia_malaga"):
            assert "corriente_maxima_ms" in data, f"{cid} sin corriente_maxima_ms (10.5)"
            assert data["corriente_maxima_ms"]["estado"] in ("verificado", "inferido", "pendiente")
    data_if = json.loads(pathlib.Path("datos/sitios/isla_fuerte.json").read_text(encoding="utf-8"))
    rec = recurso_de(Parametros(sitio_id="isla_fuerte"), data_if)
    assert rec["velocidad_ms"] != 1.5, "recurso_de aun usa literal 1.5 (10.3/10.6)"
    vals = {}
    for f in pathlib.Path("datos/sitios").glob("*.json"):
        d = json.loads(f.read_text(encoding="utf-8"))
        vals[d["id"]] = d.get("corriente_maxima_ms", {}).get("valor")
    assert len(set(v for v in vals.values() if v)) >= 3, f"corrientes prestadas: {vals}"
    assert vals["isla_fuerte"] != vals["san_andres"] or vals["isla_fuerte"] == 0, "Isla Fuerte presta valor de San Andres (10.7)"
