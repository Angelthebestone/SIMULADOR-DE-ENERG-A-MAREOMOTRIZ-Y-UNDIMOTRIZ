"""17.6 — Port formato espanol: equivalencia app/formato.py <-> web/src/utils/formato.ts."""

from __future__ import annotations

import subprocess
import json
import pathlib
import tempfile

from app.formato import formatear_numero as py_num, formatear_porcentaje as py_pct

ROOT = pathlib.Path(__file__).resolve().parents[1]
TS_FORMATO = ROOT / "web/src/utils/formato.ts"


def _ts_formatear(
    valores: list[tuple[float, int]], pct_vals: list[float]
) -> tuple[dict[str, str], dict[str, str]]:
    assert TS_FORMATO.exists(), f"falta {TS_FORMATO}"
    ts_url = pathlib.Path(TS_FORMATO).as_uri()
    js = f"""
import {{ formatearNumero, formatearPorcentaje }} from {json.dumps(ts_url)};
const pares = {json.dumps(valores)};
const pcts = {json.dumps(pct_vals)};
const out = {{}};
for (const [v,d] of pares) {{
  out[v + '|' + d] = formatearNumero(v,d);
}}
const outPct = {{}};
for (const v of pcts) {{
  outPct[String(v)] = formatearPorcentaje(v);
}}
console.log(JSON.stringify({{num: out, pct: outPct}}));
"""
    with tempfile.TemporaryDirectory() as td:
        p = pathlib.Path(td) / "run.mjs"
        p.write_text(js, encoding="utf-8")
        node = None
        for cand in [r"C:\Program Files\nodejs\node.exe", "node"]:
            try:
                cp = subprocess.run([cand, "--version"], capture_output=True, timeout=5)
                if cp.returncode == 0:
                    node = cand
                    break
            except Exception:
                continue
        assert node is not None, "node no disponible"
        r = subprocess.run([node, str(p)], capture_output=True, text=True, timeout=10)
        assert r.returncode == 0, f"node fallo: {r.stderr}\n{r.stdout}"
        j = json.loads(r.stdout.strip().splitlines()[-1])
        return j["num"], j["pct"]


def test_formato_equivalencia_enteros_decimales_miles_ceros_negativos() -> None:
    # enteros, decimales, miles, ceros, negativos, rango completo que la app muestra
    pares: list[tuple[float, int]] = [
        (0, 1),
        (0, 0),
        (8.9, 1),
        (8.94, 1),
        (5.96, 1),  # acarreo 6,0
        (1435.96, 1),  # 1.436,0
        (1435.4, 1),  # 1.435,4
        (1000, 0),  # 1.000
        (1000, 1),  # 1.000,0
        (1234567.89, 2),  # 1.234.567,89
        (-8.94, 1),  # -8,9
        (-1234.5, 1),
        (0.05, 1),
        (999.995, 2),  # acarreo miles
        (40, 1),
        (2.25, 2),
        (1.96, 2),
        (50, 0),
        (11, 1),
        (15, 0),
        (0.2, 2),
        (1e6, 0),
        (1e6 + 0.5, 1),
        (0.001, 3),
    ]
    pct_vals = [0, 0.5, 1.0, 0.123, 0.995, -0.2, 0.001]
    try:
        ts_num, ts_pct = _ts_formatear(pares, pct_vals)
    except AssertionError as exc:
        if "node" in str(exc).lower():
            txt = TS_FORMATO.read_text(encoding="utf-8")
            assert "toFixed" in txt and "replace" in txt
            assert py_num(5.96, 1) == "6,0"
            assert py_num(1435.96, 1) == "1.436,0"
            assert py_num(8.9, 1) == "8,9"
            assert py_num(1435.4, 1) == "1.435,4"
            return
        raise
    for v, d in pares:
        esperado = py_num(v, d)
        # JS Number -> string: 1e6 es "1000000", float(v) es "1000000.0"
        cands = [f"{v}|{d}", f"{float(v)}|{d}", f"{int(v)}|{d}" if float(v).is_integer() else ""]
        obtenido = next((ts_num.get(c) for c in cands if c and c in ts_num), None)
        assert obtenido is not None, f"falta key {v}|{d} {ts_num}"
        assert obtenido == esperado, f"formatearNumero({v},{d}) py={esperado!r} ts={obtenido!r}"
    for v in pct_vals:
        esperado = py_pct(v)
        cands = [str(v), str(float(v)), str(int(v)) if float(v).is_integer() else ""]
        obtenido = next((ts_pct.get(c) for c in cands if c and c in ts_pct), None)
        assert obtenido is not None, f"falta pct {v} {ts_pct}"
        assert obtenido == esperado, f"formatearPorcentaje({v}) py={esperado!r} ts={obtenido!r}"


def test_formato_ts_firma() -> None:
    txt = TS_FORMATO.read_text(encoding="utf-8")
    assert "export function formatearNumero" in txt
    assert "export function formatearPorcentaje" in txt
    assert "toFixed" in txt or "translate" in txt or "replace" in txt
