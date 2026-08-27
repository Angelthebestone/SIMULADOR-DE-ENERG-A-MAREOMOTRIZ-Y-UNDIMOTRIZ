from __future__ import annotations

import datetime
import hashlib
import json
import pathlib


def _hash_escenario(datos: dict[str, object]) -> str:
    canon = json.dumps(datos, sort_keys=True, ensure_ascii=False)
    return hashlib.sha256(canon.encode("utf-8")).hexdigest()[:12]


def guardar_escenario(
    ruta: str | pathlib.Path,
    parametros: dict[str, object],
    resultado: dict[str, object] | None = None,
    version_datos: str = "datos/ 2026-08-25",
) -> pathlib.Path:
    p = pathlib.Path(ruta)
    escena = {
        "parametros": parametros,
        "resultado": resultado or {},
        "version_datos": version_datos,
        "fecha": datetime.datetime.now().isoformat(),
    }
    escena["hash"] = _hash_escenario({"parametros": parametros, "resultado": resultado or {}})
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(json.dumps(escena, indent=2, ensure_ascii=False), encoding="utf-8")
    return p


def cargar_escenario(ruta: str | pathlib.Path) -> dict[str, object]:
    p = pathlib.Path(ruta)
    data = json.loads(p.read_text(encoding="utf-8"))
    return data  # type: ignore[no-any-return]


def verificar_reproducible(
    ruta: str | pathlib.Path,
    parametros: dict[str, object],
    resultado: dict[str, object] | None = None,
) -> bool:
    data = cargar_escenario(ruta)
    h_guard = str(data.get("hash", ""))
    h_calc = _hash_escenario({"parametros": parametros, "resultado": resultado or {}})
    if h_guard:
        return h_guard == h_calc
    orig_params = data.get("parametros")
    orig_res = data.get("resultado", {})
    exp = _hash_escenario({"parametros": orig_params, "resultado": orig_res})  # type: ignore[dict-item]
    cur = _hash_escenario({"parametros": parametros, "resultado": resultado or {}})
    return exp == cur
