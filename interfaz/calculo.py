"""Orquesta el calculo que la interfaz lanza en un hilo aparte.

Un unico Resultado alimenta los cuatro niveles (design.md). Aqui no hay Qt:
todo lo que sigue se puede ejecutar y probar sin abrir una ventana.
"""

from __future__ import annotations

import csv
import json
import math
import pathlib
import threading
from collections.abc import Callable
from dataclasses import dataclass, replace
from typing import Any

import numpy as np

from analisis.aep import (
    calcular_aep,
    comparar_aep_con_pulgar,
    matriz_dispersion_desde_serie,
    regla_pulgar_handbook,
)
from analisis.captura import barrido_bpto, cota_falnes, limites_captura, respuesta_periodo
from analisis.economia import (
    DIESEL_LOCALIDAD,
    DIESEL_OPERADOR,
    DIESEL_PERIODO,
    calcular_lcoe,
    comparador_diesel,
    intervalo_sin,
    masa_por_potencia,
    repago_capex,
)
from analisis.emplazamiento import panel_emplazamiento
from analisis.resonancia import analizar_resonancia
from app.formato import formatear_porcentaje
from app.formulas import formulas_desde_resultado
from app.vocabulario import viviendas_alimentadas
from nucleo.dispositivos.absorbedor import (
    MASA_FLOTACION_KG,
    AbsorbedorPuntual,
    ConfigAbsorbedor,
)
from nucleo.dispositivos.base import ContextoRecurso, DispositivoBase
from nucleo.dispositivos.embalse import EmbalseMareal
from nucleo.dispositivos.owc import OWC
from nucleo.dispositivos.turbina_corriente import TurbinaCorriente
from nucleo.resultado import Resultado
from nucleo.validacion import acotar

RUTA_SERIE = "datos/oleaje/oleaje_{}_era5_2015-2024.csv"

DISPOSITIVOS: dict[str, str] = {
    "absorbedor_puntual": "Absorbedor puntual (boya)",
    "owc": "Columna de agua oscilante",
    "turbina_corriente": "Turbina de corriente mareal",
    "embalse": "Presa de rango mareal",
}

SITIOS: tuple[str, ...] = ("isla_fuerte", "san_andres", "tumaco", "islas_rosario", "bahia_malaga")


@dataclass(frozen=True, slots=True)
class Parametros:
    hm0_m: float = 1.5
    te_s: float = 7.0
    b_pto_ns_m: float = 80_000.0
    sitio_id: str = "isla_fuerte"
    dispositivo: str = "absorbedor_puntual"
    profundidad_m: float = 30.0
    masa_kg: float = MASA_FLOTACION_KG
    diametro_m: float = 10.0
    completo: bool = False


def _acotar(params: Parametros) -> tuple[Parametros, list[str]]:
    """Todo lo que entra al modelo pasa por el rango de nucleo/validacion.

    Incluye la geometria de la boya: masa o diametro no positivos hacen que la
    rigidez hidrostatica y la frecuencia natural no esten definidas, asi que se
    acotan aqui en vez de dejar que revienten dentro del dispositivo.
    """
    hm0, ac_h = acotar("Hm0", params.hm0_m)
    te, ac_t = acotar("Te", params.te_s)
    bpto, ac_b = acotar("amortiguamiento_pto", params.b_pto_ns_m)
    prof, ac_p = acotar("profundidad", params.profundidad_m)
    masa, ac_m = acotar("masa_boya", params.masa_kg)
    diametro, ac_d = acotar("diametro_boya", params.diametro_m)
    avisos = [a.motivo for a in (ac_h, ac_t, ac_b, ac_p, ac_m, ac_d) if a is not None]
    acotados = replace(
        params,
        hm0_m=hm0,
        te_s=te,
        b_pto_ns_m=bpto,
        profundidad_m=prof,
        masa_kg=masa,
        diametro_m=diametro,
    )
    return acotados, avisos


def crear_dispositivo(params: Parametros) -> DispositivoBase:
    if params.dispositivo == "owc":
        return OWC()
    if params.dispositivo == "turbina_corriente":
        return TurbinaCorriente()
    if params.dispositivo == "embalse":
        return EmbalseMareal()
    return AbsorbedorPuntual(_config_absorbedor(params))


def _config_absorbedor(params: Parametros) -> ConfigAbsorbedor:
    return ConfigAbsorbedor(
        diametro_m=params.diametro_m,
        masa_kg=params.masa_kg,
        b_pto_ns_m=params.b_pto_ns_m,
    )


def cargar_sitio(sitio_id: str) -> dict[str, Any]:
    ruta = pathlib.Path("datos/sitios") / f"{sitio_id}.json"
    if not ruta.exists():
        return {}
    return json.loads(ruta.read_text(encoding="utf-8"))  # type: ignore[no-any-return]


def recurso_de(params: Parametros, sitio: dict[str, Any]) -> dict[str, Any]:
    """Un mismo recurso de entrada, sea cual sea el dispositivo que lo consuma."""
    rango = sitio.get("rango_mareal_medio", {})
    return {
        "hm0": params.hm0_m,
        "te": params.te_s,
        "profundidad_m": params.profundidad_m,
        "rango_m": float(rango.get("valor", 1.0)) if isinstance(rango, dict) else 1.0,
        "velocidad_ms": 1.5,
    }


def _j_kw_m(resultado: Resultado) -> float:
    if not resultado.eslabones:
        return 0.0
    return float(resultado.eslabones[0].detalle.get("j_w_m", 0.0)) / 1000.0


def _extras_absorbedor(params: Parametros, resultado: Resultado) -> dict[str, Any]:
    cfg = _config_absorbedor(params)
    omega = 2.0 * math.pi / params.te_s
    p_abs = float(resultado.eslabones[0].potencia_salida_w) if resultado.eslabones else 0.0
    return {
        "resonancia": analizar_resonancia(cfg.masa_kg, cfg.diametro_m, params.te_s),
        "limites": limites_captura(
            params.te_s, params.hm0_m, params.profundidad_m, cfg.diametro_m, cfg.carrera_max_m
        ),
        "falnes": cota_falnes(omega, cfg.diametro_m, p_abs, params.hm0_m, te_s=params.te_s),
        "barrido": barrido_bpto(
            omega, cfg.masa_kg, cfg.diametro_m, params.hm0_m, carrera_limite_m=cfg.carrera_max_m
        ),
        "respuesta": respuesta_periodo(
            cfg.masa_kg, cfg.diametro_m, params.hm0_m, cfg.b_pto_ns_m, cfg.k_pto_n_m
        ),
        "ancho_referencia_m": cfg.diametro_m,
        "masa_t": cfg.masa_kg / 1000.0,
        "amplitud_boya_m": _amplitud_boya(resultado),
    }


def _amplitud_boya(resultado: Resultado) -> float:
    """Amplitud del ultimo tramo de la serie ya integrada, sin el transitorio."""
    serie = resultado.series.get("z_m")
    if serie is None or len(serie) == 0:
        return 0.0
    return float(np.max(np.abs(np.asarray(serie)[-1000:])))


def _extras(params: Parametros, resultado: Resultado) -> dict[str, Any]:
    extras: dict[str, Any] = {
        "formulas": formulas_desde_resultado(resultado),
        "viviendas": viviendas_alimentadas(resultado=resultado),
        "panel_sitio": panel_emplazamiento(params.sitio_id),
        "j_kw_m": _j_kw_m(resultado),
        "parametros": params,
    }
    if params.dispositivo == "absorbedor_puntual":
        extras.update(_extras_absorbedor(params, resultado))
    ancho = float(extras.get("ancho_referencia_m", 10.0))
    pulgar = regla_pulgar_handbook(extras["j_kw_m"], ancho) if extras["j_kw_m"] > 0 else None
    extras["pulgar"] = pulgar
    if pulgar is not None:
        extras["pulgar_vs_aep"] = comparar_aep_con_pulgar(
            resultado.produccion_anual_mwh, pulgar.aep_mwh
        )
    return extras


def serie_oleaje(sitio_id: str) -> tuple[np.ndarray, np.ndarray] | None:
    ruta = pathlib.Path(RUTA_SERIE.format(sitio_id))
    if not ruta.exists():
        return None
    hs: list[float] = []
    te: list[float] = []
    with ruta.open(encoding="utf-8") as f:
        for fila in csv.DictReader(f):
            try:
                hs.append(float(fila["hs_m"]))
                te.append(float(fila["te_s"]))
            except (KeyError, TypeError, ValueError):
                continue
    if not hs:
        return None
    return np.array(hs), np.array(te)


def _matriz_potencia(
    params: Parametros,
    hs_centros: np.ndarray,
    te_centros: np.ndarray,
    progreso: Callable[[int], None],
    cancelado: threading.Event,
) -> np.ndarray | None:
    """Una integracion por celda: la simulacion mas costosa que admite la aplicacion."""
    contexto = ContextoRecurso(profundidad_m=params.profundidad_m)
    matriz = np.zeros((len(hs_centros), len(te_centros)))
    total = matriz.size
    for i, hs in enumerate(hs_centros):
        for j, te in enumerate(te_centros):
            if cancelado.is_set():
                return None
            celda = replace(params, hm0_m=float(hs), te_s=float(te))
            res = crear_dispositivo(celda).resolver({"hm0": float(hs), "te": float(te)}, contexto)
            matriz[i, j] = res.eslabones[-1].potencia_salida_w if res.eslabones else 0.0
            progreso(10 + int(85 * (i * len(te_centros) + j + 1) / total))
    return matriz


def _aep_matriz(
    params: Parametros,
    progreso: Callable[[int], None],
    cancelado: threading.Event,
) -> dict[str, Any]:
    serie = serie_oleaje(params.sitio_id)
    if serie is None:
        return {"estado": "pendiente", "motivo": f"sin serie de oleaje para {params.sitio_id}"}
    dispersion = matriz_dispersion_desde_serie(serie[0], serie[1])
    potencia = _matriz_potencia(
        params, dispersion.hs_centros_m, dispersion.te_centros_s, progreso, cancelado
    )
    if potencia is None:
        return {"estado": "cancelado", "motivo": "cancelado por el usuario"}
    return {
        "estado": "listo",
        "dispersion": dispersion,
        "matriz_potencia_w": potencia,
        "aep": calcular_aep(dispersion.ocurrencia, potencia),
        "fuente": f"ERA5-Ocean via Open-Meteo, {dispersion.n_muestras} registros horarios",
    }


def simular(
    params: Parametros,
    progreso: Callable[[int], None] | None = None,
    cancelado: threading.Event | None = None,
) -> dict[str, Any]:
    prog = progreso or (lambda _v: None)
    cancel = cancelado or threading.Event()
    params, avisos = _acotar(params)
    prog(5)
    if cancel.is_set():
        return _abandonado(params, avisos)
    sitio = cargar_sitio(params.sitio_id)
    contexto = ContextoRecurso(profundidad_m=params.profundidad_m)
    resultado = crear_dispositivo(params).resolver(recurso_de(params, sitio), contexto)
    prog(10)
    # La integracion de una sola condicion de mar no se puede interrumpir por
    # dentro, pero todo lo que viene detras si: barridos, panel de sitio y, sobre
    # todo, la matriz. Se comprueba en cada frontera de fase.
    if cancel.is_set():
        return _abandonado(params, avisos)
    extras = _extras(params, resultado)
    extras["avisos_entrada"] = avisos
    extras["sitio"] = sitio
    if params.completo:
        extras["aep_matriz"] = _aep_matriz(params, prog, cancel)
    prog(100)
    return {"resultado": resultado, "extras": extras}


def _abandonado(params: Parametros, avisos: list[str]) -> dict[str, Any]:
    """Salida vacia cuando se cancela: el hilo no sigue gastando en lo que se va a tirar."""
    return {
        "resultado": Resultado(),
        "extras": {"estado": "cancelado", "avisos_entrada": avisos, "parametros": params},
    }


def eslabon_que_separa(a: Resultado, b: Resultado, tolerancia: float = 0.02) -> str:
    """Primer eslabon en que dos cadenas dejan de rendir igual."""
    for esl_a, esl_b in zip(a.eslabones, b.eslabones):
        if abs(esl_a.rendimiento - esl_b.rendimiento) > tolerancia:
            return (
                f"{esl_a.nombre}: {formatear_porcentaje(esl_a.rendimiento)} frente a "
                f"{formatear_porcentaje(esl_b.rendimiento)}"
            )
    return "ningun eslabon los separa por encima del 2 %"


def comparar_dos(params: Parametros, clave_a: str, clave_b: str) -> dict[str, Any]:
    """Dos tecnologias sobre el mismo emplazamiento, resueltas con el mismo recurso."""
    sitio = cargar_sitio(params.sitio_id)
    contexto = ContextoRecurso(profundidad_m=params.profundidad_m)
    recurso = recurso_de(params, sitio)
    salidas = [
        crear_dispositivo(replace(params, dispositivo=clave)).resolver(dict(recurso), contexto)
        for clave in (clave_a, clave_b)
    ]
    return {
        "recurso": recurso,
        "a": salidas[0],
        "b": salidas[1],
        "divergencia": eslabon_que_separa(salidas[0], salidas[1]),
    }


def economia_completa(
    aep_mwh: float,
    capex_cop: float,
    opex_anual_cop: float,
    potencia_kw: float,
    masa_t: float,
    vida_anos: int = 20,
    tasa_descuento: float = 0.08,
) -> dict[str, Any]:
    """Las dos comparaciones juntas: la favorable (diesel ZNI) y la desfavorable (SIN)."""
    if aep_mwh <= 0 or capex_cop <= 0:
        return {"estado": "pendiente", "motivo": "CAPEX pendiente — sin cifra no hay LCOE"}
    lcoe = calcular_lcoe(capex_cop, opex_anual_cop, aep_mwh, vida_anos, tasa_descuento)
    return {
        "estado": "listo",
        "lcoe": lcoe,
        "diesel": comparador_diesel(
            lcoe.lcoe_cop_mwh, DIESEL_LOCALIDAD, DIESEL_OPERADOR, DIESEL_PERIODO
        ),
        "sin": intervalo_sin(lcoe.lcoe_cop_mwh),
        "repago": repago_capex(capex_cop, capex_cop, potencia_kw, aep_mwh),
        "masa": masa_por_potencia(masa_t, potencia_kw),
    }
