"""Contrato 15.x+16.x — series, techo 200k, triple y roundtrip."""

from __future__ import annotations

import json

import numpy as np
import pytest


def _resultado_con_series(n: int = 100) -> object:
    """Resultado con series t_s y z_m."""
    from nucleo.dispositivos.absorbedor import AbsorbedorPuntual
    from nucleo.dispositivos.base import ContextoRecurso

    res = AbsorbedorPuntual().resolver({"hm0": 1.5, "te": 7.0}, ContextoRecurso(profundidad_m=30.0))
    # asegurar t_s y z_m existan con longitud n
    if len(res.series.get("t_s", [])) < 10:
        res.series["t_s"] = np.linspace(0, 20, n)
        res.series["z_m"] = np.sin(np.linspace(0, 20, n))
    return res


def test_contrato_estructura() -> None:
    """Contrato tiene parametros resultado series formulas progreso error cancelado."""
    from app.contrato import serializar_contrato
    from app.servicio import Parametros

    res = _resultado_con_series(20)
    params = Parametros(hm0_m=1.5, te_s=7.0, sitio_id="isla_fuerte")
    c = serializar_contrato(params, res)  # Contrato
    # claves exigidas por Contrato TypedDict
    assert "parametros" in c
    assert "resultado" in c
    assert "series" in c
    assert "formulas" in c
    assert "progreso" in c
    assert "error" in c
    assert "cancelado" in c
    assert isinstance(c["progreso"], float)
    assert c["error"] is None
    assert c["cancelado"] is False


def test_series_codificacion_exacta() -> None:
    """SERIES_CODIFICACION exacta."""
    from app.contrato import SERIES_CODIFICACION
    from nucleo.resultado import SERIES_CODIFICACION as SC2

    esperado = {"tipo": "float64", "forma": "lista", "dtype": "float64"}
    assert SERIES_CODIFICACION == esperado
    assert SC2 == esperado


def test_to_dict_incluye_series() -> None:
    """to_dict no pierde t_s y z_m."""
    res = _resultado_con_series(50)
    d = res.to_dict()
    assert "series" in d
    assert "t_s" in d["series"]
    assert "z_m" in d["series"]
    assert len(d["series"]["t_s"]) > 0
    assert len(d["series"]["z_m"]) > 0


def test_to_dict_sin_noqa_y_helpers() -> None:
    """to_dict sin # noqa C901 y con helpers."""
    txt = open("nucleo/resultado.py", encoding="utf-8").read()
    assert "# noqa" not in txt or "C901" not in txt
    # debe haber helpers que dividen to_dict
    assert "_serie_a_lista" in txt
    assert "_recurso_a_dict" in txt


def test_series_formas_y_dtype() -> None:
    """Series codificadas como float64 lista."""
    from app.contrato import serializar_resultado

    res = _resultado_con_series(30)
    payload = serializar_resultado(res)
    assert payload["series_codificacion"] == {
        "tipo": "float64",
        "forma": "lista",
        "dtype": "float64",
    }
    for meta in payload["series_meta"].values():
        assert meta["dtype"] == "float64"
        assert "forma" in meta
        assert "techo_bytes" in meta
    # t_s y z_m siguen en series
    assert "t_s" in payload["series"]
    assert "z_m" in payload["series"]


def test_techo_200k_trunca_con_aviso() -> None:
    """Techo 200_000: si excede trunca sin romper."""
    from app.contrato import serializar_contrato, techo_bytes
    from app.servicio import Parametros

    assert techo_bytes == 200_000
    res = _resultado_con_series(10)
    # inflar series para forzar techo
    res.series["t_s"] = np.linspace(0, 1000, 50_000)
    res.series["z_m"] = np.sin(np.linspace(0, 1000, 50_000))
    c = serializar_contrato(Parametros(), res)
    data = json.dumps(c, ensure_ascii=False).encode("utf-8")
    assert len(data) <= techo_bytes
    # debe haber aviso y truncado
    assert c.get("truncado") is True or c["resultado"].get("truncado") is True
    # no rompe: deserializable
    from app.contrato import deserializar_contrato

    rec = deserializar_contrato(c)
    assert rec["series"]["t_s"] is not None


def test_formulas_triple() -> None:
    """Formulas son triple latex texto unidades."""
    from app.formulas import formulas_desde_resultado

    res = _resultado_con_series(20)
    f: dict[str, tuple[str, str, str]] = formulas_desde_resultado(res)
    assert len(f) >= 1
    for clave, triple in f.items():
        assert isinstance(triple, tuple), f"{clave} no es tupla"
        assert len(triple) == 3, f"{clave} len {len(triple)} != 3"
        latex, texto, unidades = triple
        assert isinstance(latex, str) and latex
        assert isinstance(texto, str) and texto
        assert isinstance(unidades, str) and unidades
        # latex lleva KaTeX
        assert "\\" in latex or "frac" in latex or "rho" in latex
    # J y AEP existen
    assert "J" in f
    assert "AEP" in f


def test_forms_return_type_is_triple_not_dict() -> None:
    """app/formulas.py retorna triple no dict[str,str]."""
    txt = open("app/formulas.py", encoding="utf-8").read()
    assert "tuple[str, str, str]" in txt or "Triple" in txt
    assert "dict[str, str]" not in txt


def test_serializar_deserializar_roundtrip() -> None:
    """Roundtrip serializar y deserializar preserva campos."""
    from app.contrato import deserializar, deserializar_contrato, serializar_contrato

    res = _resultado_con_series(40)
    c = serializar_contrato({"hm0": 1.5, "te": 7.0}, res, progreso=50)
    rec = deserializar_contrato(c)
    assert rec["parametros"]["hm0"] == pytest.approx(1.5)
    assert rec["progreso"] == pytest.approx(50.0)
    assert rec["cancelado"] is False
    assert "t_s" in rec["series"]
    assert "z_m" in rec["series"]
    r2 = deserializar(c["resultado"])
    assert r2.produccion_anual_mwh == pytest.approx(res.produccion_anual_mwh, rel=1e-6)
    assert "t_s" in r2.series
    assert "z_m" in r2.series


def test_payload_bytes_y_techo() -> None:
    """payload_bytes bajo techo y techo es 200k."""
    from app.contrato import TECHO_BYTES, serializar_contrato, techo_bytes

    assert techo_bytes == 200_000
    assert TECHO_BYTES == 200_000
    res = _resultado_con_series(20)
    c = serializar_contrato({}, res)
    assert c["payload_bytes"] <= techo_bytes
    assert c["resultado"]["payload_bytes"] <= techo_bytes


def test_web_package_exact_versions() -> None:
    """web/package.json fija versiones con = exacto sin ^ ~."""
    data = json.loads(open("web/package.json", encoding="utf-8").read())
    for dep in {**data.get("dependencies", {}), **data.get("devDependencies", {})}.values():
        assert dep.startswith("="), f"version no exacta {dep}"
        assert "^" not in dep and "~" not in dep
    # lock existe y es reproducible (npm ci no lo cambia)
    assert open("web/package-lock.json", encoding="utf-8").read().strip()


def test_contrato_progreso_error_cancelado() -> None:
    """Contrato transporta progreso error cancelado."""
    from app.contrato import deserializar_contrato, serializar_contrato

    res = _resultado_con_series(10)
    c = serializar_contrato({}, res, progreso=42, error="fallo", cancelado=True)
    assert c["progreso"] == pytest.approx(42.0)
    assert c["error"] == "fallo"
    assert c["cancelado"] is True
    rec = deserializar_contrato(c)
    assert rec["progreso"] == pytest.approx(42.0)
    assert rec["error"] == "fallo"
    assert rec["cancelado"] is True
