from __future__ import annotations

import json
from dataclasses import dataclass, field
from typing import Any, TypedDict

try:
    import numpy as np  # type: ignore[import-not-found]
except ImportError:
    np = None  # type: ignore[assignment]

# codificación declarada para arreglos del contrato
SERIES_CODIFICACION: dict[str, str] = {
    "tipo": "float64",
    "forma": "lista",
    "dtype": "float64",
}

# techo para payload de animación
techo_bytes: int = 200_000
TECHO_BYTES: int = techo_bytes
DTYPE: str = "float64"


class SerieContrato(TypedDict):
    """Series mínimas para animación."""

    t_s: list[float]
    z_m: list[float]


class Contrato(TypedDict):
    """Contrato entre núcleo y presentación."""

    parametros: dict[str, Any]
    resultado: dict[str, Any]
    series: SerieContrato
    formulas: dict[str, tuple[str, str, str]]
    progreso: float
    error: str | None
    cancelado: bool


@dataclass
class ContratoDataclass:
    """Variante dataclass del contrato."""

    parametros: dict[str, Any] = field(default_factory=dict)
    resultado: dict[str, Any] = field(default_factory=dict)
    series: dict[str, list[float]] = field(default_factory=dict)
    formulas: dict[str, tuple[str, str, str]] = field(default_factory=dict)
    progreso: float = 0.0
    error: str | None = None
    cancelado: bool = False


def _tamano_bytes(payload: dict[str, Any]) -> int:
    """Tamaño json en bytes."""
    return len(json.dumps(payload, ensure_ascii=False).encode("utf-8"))


def _es_lista_numerica(valor: Any) -> bool:
    """Lista solo con números."""
    return isinstance(valor, list) and all(isinstance(x, (int, float)) for x in valor)


def _a_lista(valor: Any) -> tuple[list[Any], list[int]]:
    """Convierte valor a lista y forma."""
    if np is not None and isinstance(valor, np.ndarray):
        lista = valor.tolist()
        forma = [int(valor.size)] if valor.ndim == 1 else list(valor.shape)
        return lista, forma
    if isinstance(valor, list):
        return valor, [len(valor)]
    if np is not None:
        try:
            arr = np.asarray(valor, dtype=float)
            if arr.ndim >= 1:
                forma = [int(arr.size)] if arr.ndim == 1 else list(arr.shape)
                return arr.tolist(), forma
        except Exception:
            pass
    if isinstance(valor, (list, tuple)):
        lst = list(valor)
        return lst, [len(lst)]
    return valor, [0]  # type: ignore[return-value]


def _codificar_series(series: dict[str, Any]) -> tuple[dict[str, Any], dict[str, Any]]:
    """Codifica series a lista float64 con metadatos."""
    codificadas: dict[str, Any] = {}
    metas: dict[str, Any] = {}
    for clave, valor in series.items():
        lista, forma = _a_lista(valor)
        codificadas[clave] = lista
        metas[clave] = {
            "forma": forma,
            "dtype": DTYPE,
            "techo_bytes": techo_bytes,
        }
    return codificadas, metas


def _reducir(codificadas: dict[str, Any], metas: dict[str, Any]) -> None:
    """Reduce cada serie a la mitad."""
    for clave, lista in list(codificadas.items()):
        if isinstance(lista, list) and len(lista) > 1:
            codificadas[clave] = lista[::2]
            if clave in metas:
                metas[clave] = {**metas[clave], "forma": [len(codificadas[clave])]}


def _truncar_si_excede(payload: dict[str, Any]) -> dict[str, Any]:
    """Trunca series si excede techo, con aviso sin romper."""
    if _tamano_bytes(payload) <= techo_bytes:
        return payload
    series = payload.get("series", {})
    if not isinstance(series, dict) or not series:
        return payload
    codificadas = dict(series)
    metas = dict(payload.get("series_meta", {}))
    for _ in range(10):
        if _tamano_bytes({**payload, "series": codificadas}) <= techo_bytes:
            break
        _reducir(codificadas, metas)
        if all(isinstance(v, list) and len(v) <= 2 for v in codificadas.values()):
            break
    payload["series"] = codificadas
    payload["series_meta"] = metas
    payload["truncado"] = True
    payload["aviso"] = "series truncadas por techo 200k"
    return payload


def _filtrar_series_contrato(series: dict[str, Any]) -> dict[str, Any]:
    """Solo t_s y z_m para el contrato de animación."""
    return {k: v for k, v in series.items() if k in ("t_s", "z_m")}


def serializar_resultado(resultado: Any) -> dict[str, Any]:
    """Serializa Resultado con series codificadas y techo."""
    base = resultado.to_dict()
    series_raw = base.pop("series", {})
    if not isinstance(series_raw, dict):
        series_raw = {}
    # solo series del contrato para no exceder techo
    series_raw = _filtrar_series_contrato(series_raw)
    codificadas, metas = _codificar_series(series_raw)
    payload: dict[str, Any] = {
        **base,
        "series": codificadas,
        "series_meta": metas,
        "series_codificacion": SERIES_CODIFICACION,
        "techo_bytes": techo_bytes,
    }
    payload = _truncar_si_excede(payload)
    payload["payload_bytes"] = _tamano_bytes(payload)
    return payload


def deserializar(payload: dict[str, Any]) -> Any:
    """Reconstruye Resultado desde payload."""
    from nucleo.resultado import Eslabon, Resultado

    recurso = payload.get("recurso", {})
    eslabones_raw = payload.get("eslabones", [])
    eslabones: list[Eslabon] = []
    for ent in eslabones_raw:
        eslabones.append(
            Eslabon(
                nombre=str(ent.get("nombre", "")),
                potencia_entrada_w=float(ent.get("potencia_entrada_w", 0)),
                potencia_salida_w=float(ent.get("potencia_salida_w", 0)),
                rendimiento=float(ent.get("rendimiento", 0)),
                detalle=dict(ent.get("detalle", {})),
            )
        )
    series_raw = payload.get("series", {})
    series: dict[str, Any] = {}
    if np is not None:
        for clave, valor in series_raw.items():
            if _es_lista_numerica(valor):
                series[clave] = np.asarray(valor, dtype=float)
            else:
                series[clave] = valor
    else:
        series = dict(series_raw)
    return Resultado(
        recurso=dict(recurso),
        eslabones=eslabones,
        potencia_nominal_w=float(payload.get("potencia_nominal_w", 0)),
        produccion_anual_mwh=float(payload.get("produccion_anual_mwh", 0)),
        factor_planta=float(payload.get("factor_planta", 0)),
        disponibilidad=float(payload.get("disponibilidad", 0.95)),
        horas_ano=float(payload.get("horas_ano", 8766.0)),
        avisos=list(payload.get("avisos", [])),
        series=series,
        metadatos=dict(payload.get("metadatos", {})),
    )


def _params_a_dict(parametros: Any) -> dict[str, Any]:
    """Convierte parametros a dict."""
    if hasattr(parametros, "__dataclass_fields__"):
        try:
            import dataclasses

            if dataclasses.is_dataclass(parametros):
                return dataclasses.asdict(parametros)  # type: ignore[arg-type]
        except Exception:
            pass
    if hasattr(parametros, "__dict__"):
        try:
            return dict(parametros.__dict__)
        except Exception:
            pass
    if isinstance(parametros, dict):
        return dict(parametros)
    return {"valor": str(parametros)}


def serializar_contrato(
    parametros: Any,
    resultado: Any,
    formulas: dict[str, Any] | None = None,
    progreso: int = 100,
    error: str | None = None,
    cancelado: bool = False,
) -> dict[str, Any]:
    """Contrato completo con techo en series."""
    if formulas is None:
        from app.formulas import formulas_desde_resultado

        formulas = formulas_desde_resultado(resultado)  # type: ignore[assignment]
    payload_res = serializar_resultado(resultado)
    params_dict = _params_a_dict(parametros)
    contrato: dict[str, Any] = {
        "parametros": params_dict,
        "resultado": payload_res,
        "series": payload_res.get("series", {}),
        "series_meta": payload_res.get("series_meta", {}),
        "formulas": formulas,
        "progreso": float(progreso),
        "error": error,
        "cancelado": bool(cancelado),
    }
    contrato["payload_bytes"] = _tamano_bytes(contrato)
    if contrato["payload_bytes"] > techo_bytes:
        cod = dict(contrato.get("series", {}))
        metas = dict(contrato.get("series_meta", {}))
        if isinstance(cod, dict) and cod:
            for _ in range(10):
                if _tamano_bytes(contrato) <= techo_bytes:
                    break
                _reducir(cod, metas)
                contrato["series"] = cod
                contrato["series_meta"] = metas
                if isinstance(contrato["resultado"], dict):
                    contrato["resultado"]["series"] = cod
                    contrato["resultado"]["series_meta"] = metas
                    contrato["resultado"]["payload_bytes"] = _tamano_bytes(contrato["resultado"])
                    contrato["resultado"]["truncado"] = True
                    contrato["resultado"]["aviso"] = "series truncadas por techo 200k"
                if all(isinstance(v, list) and len(v) <= 2 for v in cod.values()):
                    break
            contrato["payload_bytes"] = _tamano_bytes(contrato)
            contrato["truncado"] = True
            contrato["aviso"] = "series truncadas por techo 200k"
    return contrato


def deserializar_contrato(payload: dict[str, Any]) -> dict[str, Any]:
    """Reconstruye contrato desde payload."""
    from nucleo.resultado import Resultado

    resultado_raw = payload.get("resultado", {})
    if isinstance(resultado_raw, dict):
        resultado = deserializar(resultado_raw)
    else:
        resultado = Resultado()
    return {
        "parametros": payload.get("parametros", {}),
        "resultado": resultado,
        "series": payload.get("series", {}),
        "series_meta": payload.get("series_meta", {}),
        "formulas": payload.get("formulas", {}),
        "progreso": float(payload.get("progreso", 0)),
        "error": payload.get("error"),
        "cancelado": bool(payload.get("cancelado", False)),
        "payload_bytes": payload.get("payload_bytes", 0),
    }
