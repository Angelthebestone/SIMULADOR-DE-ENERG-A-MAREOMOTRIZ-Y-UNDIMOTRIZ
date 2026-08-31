"""Lectura de datos locales sin depender de la capa de presentación.

Extraído de interfaz/mapa.py (fase 0.5): las funciones puras de carga y
conversión de RUNAP, batimetría y fichas de sitio no necesitan Qt y pertenecen
a la capa de aplicación/servicio. interfaz/mapa.py re-exporta desde aquí para
compatibilidad.
"""

from __future__ import annotations

import csv
import json
import pathlib
from typing import Any

import numpy as np

RUTA_RUNAP = "datos/runap/areas_marinas_protegidas.geojson"
RUTA_BATIMETRIA = "datos/batimetria/transecto_isla_fuerte_gmrt.csv"
RUTA_SITIOS = "datos/sitios"
RUTA_COSTA = "datos/costa/contorno_tierra.geojson"
RUTA_XM_RESUMEN = "datos/xm/resumen_xm.json"

FUENTE_RUNAP = "RUNAP (PNN) — 37 áreas marinas, 305.335 km²"
FUENTE_GMRT = "GMRT (Lamont-Doherty) — transecto radial, banda 30–60 m"
FUENTE_RECURSO = "Ortega et al. 2013 y ERA5-Ocean vía Open-Meteo (rejilla 0,5°)"
FUENTE_COSTA = "Natural Earth (dominio público) — continente 1:50m, islas 1:10m"
SIN_COSTA = "sin contorno de tierra: falta datos/costa (ejecuta datos/costa/descargar_costa.py)"

CAMPOS_RECURSO = ("densidad_potencia_media",)


def _leer_geojson(ruta: str) -> dict[str, Any]:
    archivo = pathlib.Path(ruta)
    if not archivo.exists():
        return {}
    try:
        coleccion = json.loads(archivo.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return {}
    return coleccion if isinstance(coleccion, dict) else {}


def _anillos(geometria: Any) -> list[list[list[float]]]:
    if not isinstance(geometria, dict):
        return []
    coordenadas = geometria.get("coordinates")
    if not isinstance(coordenadas, list) or not coordenadas:
        return []
    if geometria.get("type") == "Polygon":
        candidatos = [coordenadas[0]]
    elif geometria.get("type") == "MultiPolygon":
        candidatos = [p[0] for p in coordenadas if isinstance(p, list) and p]
    else:
        return []
    return [a for a in candidatos if isinstance(a, list) and len(a) >= 3]


def cargar_areas_protegidas(ruta: str = RUTA_RUNAP) -> list[dict[str, Any]]:
    areas = []
    for rasgo in _leer_geojson(ruta).get("features", []):
        if not isinstance(rasgo, dict):
            continue
        anillos = _anillos(rasgo.get("geometry"))
        if not anillos:
            continue
        propiedades = rasgo.get("properties") or {}
        areas.append(
            {
                "nombre": propiedades.get("ap_nombre", "sin nombre"),
                "categoria": propiedades.get("ap_categoria", "sin categoría"),
                "anillos": anillos,
            }
        )
    return areas


def cargar_costa(ruta: str = RUTA_COSTA) -> list[np.ndarray]:
    anillos: list[np.ndarray] = []
    for rasgo in _leer_geojson(ruta).get("features", []):
        if isinstance(rasgo, dict):
            anillos.extend(np.asarray(a, dtype=float)[:, :2] for a in _anillos(rasgo.get("geometry")))
    return anillos


def cargar_batimetria(ruta: str = RUTA_BATIMETRIA) -> dict[str, np.ndarray]:
    archivo = pathlib.Path(ruta)
    if not archivo.exists():
        return {}
    lon, lat, prof = [], [], []
    with archivo.open(encoding="utf-8") as f:
        for fila in csv.DictReader(f):
            try:
                lon.append(float(fila["lon"]))
                lat.append(float(fila["lat"]))
                prof.append(float(fila["profundidad_m"]))
            except (KeyError, TypeError, ValueError):
                continue
    return {"lon": np.array(lon), "lat": np.array(lat), "profundidad_m": np.array(prof)}


def _recurso_de_sitio(sitio: dict[str, Any]) -> tuple[float | None, str, str]:
    for campo in CAMPOS_RECURSO:
        dato = sitio.get(campo)
        if not isinstance(dato, dict):
            continue
        estado = str(dato.get("estado", "pendiente"))
        try:
            valor = float(dato.get("valor", 0.0))
        except (TypeError, ValueError):
            continue
        if estado == "pendiente" or valor <= 0:
            continue
        return valor, estado, str(dato.get("fuente", ""))
    return None, "pendiente", "sin densidad de potencia con fuente verificada"


def _coordenada(sitio: dict[str, Any], clave: str) -> float:
    campo = sitio.get(clave)
    if isinstance(campo, dict):
        campo = campo.get("valor", 0.0)
    try:
        return float(campo)  # type: ignore[arg-type]
    except (TypeError, ValueError):
        return 0.0


def cargar_sitios(carpeta: str = RUTA_SITIOS) -> list[dict[str, Any]]:
    base = pathlib.Path(carpeta)
    if not base.exists():
        return []
    sitios = []
    for archivo in sorted(base.glob("*.json")):
        try:
            sitio = json.loads(archivo.read_text(encoding="utf-8"))
        except (OSError, ValueError):
            continue
        if not isinstance(sitio, dict):
            continue
        valor, estado, fuente = _recurso_de_sitio(sitio)
        sitios.append(
            {
                "id": sitio.get("id", archivo.stem),
                "nombre": sitio.get("nombre", archivo.stem),
                "lat": _coordenada(sitio, "latitud"),
                "lon": _coordenada(sitio, "longitud"),
                "estado_legal": str(sitio.get("estado_legal", "desconocido")),
                "area_protegida": str(sitio.get("area_protegida", "")),
                "j_kw_m": valor,
                "estado_recurso": estado,
                "fuente_recurso": fuente,
            }
        )
    return sitios


_LCOE_SIN_PENDIENTE: dict[str, Any] = {
    "valor": None,
    "unidad": "COP/MWh",
    "fuente": "lcoe_sin_cop_mwh ausente en datos/xm/resumen_xm.json; ejecuta datos/xm/procesar_sin.py",
    "estado": "pendiente",
}


def cargar_lcoe_sin(ruta: str = RUTA_XM_RESUMEN) -> dict[str, Any]:
    """Devuelve el dict ``lcoe_sin_cop_mwh`` listo para la vista ``Diseñar``.

    Lectura directa del resumen XM, sin recalcular. Si el archivo no existe
    o el campo no está, devuelve un dict ``estado=pendiente`` con la causa,
    para que la UI pueda distinguir "no hay dato" de "hay dato verificado".
    """
    archivo = pathlib.Path(ruta)
    if not archivo.exists():
        return dict(_LCOE_SIN_PENDIENTE)
    try:
        resumen = json.loads(archivo.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return dict(_LCOE_SIN_PENDIENTE)
    campo = resumen.get("lcoe_sin_cop_mwh")
    if not isinstance(campo, dict):
        return dict(_LCOE_SIN_PENDIENTE)
    return {
        "valor": campo.get("valor"),
        "unidad": str(campo.get("unidad", "COP/MWh")),
        "fuente": str(campo.get("fuente", "")),
        "estado": str(campo.get("estado", "pendiente")),
    }
