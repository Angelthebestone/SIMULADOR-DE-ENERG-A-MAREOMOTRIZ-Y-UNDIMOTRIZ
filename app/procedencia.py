from __future__ import annotations

import json
import pathlib

from nucleo.dato import Dato


def fuente_de_constante(
    nombre: str, sitio_id: str | None = None, dispositivo_id: str | None = None
) -> str | None:
    for base in [pathlib.Path("datos/sitios"), pathlib.Path("datos/dispositivos")]:
        if not base.exists():
            continue
        for ruta in base.glob("*.json"):
            if sitio_id and ruta.stem != sitio_id:
                continue
            if dispositivo_id and ruta.stem != dispositivo_id:
                continue
            try:
                data = json.loads(ruta.read_text(encoding="utf-8"))
            except (json.JSONDecodeError, OSError):
                continue
            val = data.get(nombre)
            if isinstance(val, dict) and "fuente" in val:
                return str(val["fuente"])
    return None


def procedencia_completa(ruta_json: str | pathlib.Path) -> dict[str, dict[str, str]]:
    p = pathlib.Path(ruta_json)
    data = json.loads(p.read_text(encoding="utf-8"))
    res: dict[str, dict[str, str]] = {}
    for k, v in data.items():
        if isinstance(v, dict) and "fuente" in v:
            res[k] = {
                "fuente": str(v["fuente"]),
                "estado": str(v.get("estado", "")),
                "unidad": str(v.get("unidad", "")),
            }
    return res


def exigir_dato(ruta_json: str, campo: str) -> float:
    p = pathlib.Path(ruta_json)
    data = json.loads(p.read_text(encoding="utf-8"))
    raw = data.get(campo)
    if not isinstance(raw, dict):
        raise ValueError(f"{campo} no es Dato en {ruta_json}")
    dato = Dato.from_dict(raw)  # type: ignore[arg-type]
    return dato.exigir()


def listar_pendientes(ruta_json: str | pathlib.Path) -> list[str]:
    p = pathlib.Path(ruta_json)
    data = json.loads(p.read_text(encoding="utf-8"))
    pendientes: list[str] = []
    for k, v in data.items():
        if isinstance(v, dict) and v.get("estado") == "pendiente":
            pendientes.append(k)
    return pendientes
