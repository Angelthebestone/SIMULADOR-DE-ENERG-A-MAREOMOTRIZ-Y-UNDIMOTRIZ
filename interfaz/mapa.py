"""Mapa de potencial de Colombia con tres capas conmutables (spec mapa-potencial).

Todo sale de datos/ locales: RUNAP (areas marinas protegidas), GMRT (batimetria) y
los propios archivos de sitio. Ninguna peticion de red.
"""

from __future__ import annotations

import csv
import json
import pathlib
from typing import Any, Callable

import numpy as np
from matplotlib.collections import PatchCollection
from matplotlib.lines import Line2D
from matplotlib.patches import Patch
from matplotlib.patches import Polygon as PoligonoMpl
from PySide6.QtCore import Qt

from app.formato import formatear_magnitud
from interfaz.estilo import COLOR_SEMAFORO, PALETA
from interfaz.graficas import Lienzo

RUTA_RUNAP = "datos/runap/areas_marinas_protegidas.geojson"
RUTA_BATIMETRIA = "datos/batimetria/transecto_isla_fuerte_gmrt.csv"
RUTA_SITIOS = "datos/sitios"
RUTA_COSTA = "datos/costa/contorno_tierra.geojson"

FUENTE_RUNAP = "RUNAP (PNN) — 37 áreas marinas, 305.335 km²"
FUENTE_GMRT = "GMRT (Lamont-Doherty) — transecto radial, banda 30–60 m"
FUENTE_RECURSO = "Ortega et al. 2013 y ERA5-Ocean vía Open-Meteo (rejilla 0,5°)"
FUENTE_COSTA = "Natural Earth (dominio público) — continente 1:50m, islas 1:10m"
SIN_COSTA = "sin contorno de tierra: falta datos/costa (ejecuta datos/costa/descargar_costa.py)"

# Encuadre del mapa: Caribe y Pacifico colombianos con los cinco emplazamientos.
LON_MIN, LON_MAX = -82.6, -70.8
LAT_MIN, LAT_MAX = 0.8, 15.2
RADIO_SELECCION_GRADOS = 1.2
FACTOR_ZOOM = 1.25
# Topes del zoom: mas cerca que 0,2 grados no hay dato que mirar (la costa es
# 1:50m) y mas lejos que el encuadre completo solo se anade oceano vacio.
ZOOM_MINIMO_GRADOS = 0.2
ZOOM_MAXIMO_GRADOS = LON_MAX - LON_MIN

# Campos de recurso por orden de preferencia: primero el verificado, luego el inferido.
CAMPOS_RECURSO = (
    "densidad_potencia_media",
    "densidad_potencia_era5",
    "densidad_potencia_publicada",
    "densidad_potencia",
)


def _leer_geojson(ruta: str) -> dict[str, Any]:
    """Un archivo ausente, vacio o corrupto degrada a coleccion vacia.

    El mapa se construye dentro de PanelDisenar, asi que dejar subir una
    JSONDecodeError impedia arrancar la aplicacion entera por un byte malo en
    datos/. Mismo criterio que interfaz/paneles._leer_json.
    """
    archivo = pathlib.Path(ruta)
    if not archivo.exists():
        return {}
    try:
        coleccion = json.loads(archivo.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return {}
    return coleccion if isinstance(coleccion, dict) else {}


def _anillos(geometria: Any) -> list[list[list[float]]]:
    """Anillos exteriores de un Polygon o MultiPolygon; [] si no es ninguno."""
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
    """Anillos de tierra firme e islas, para dar referencia geografica al mapa.

    Devuelve arrays ya convertidos: el mapa se redibuja en cada movimiento del
    raton y no conviene reconstruirlos cinco mil veces por segundo.
    """
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
    """Una ficha ilegible se salta; las demas siguen dibujandose."""
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


class LienzoMapa(Lienzo):
    """Tres capas conmutables. El area protegida se pinta antes que cualquier cifra."""

    def __init__(self, al_elegir_sitio: Callable[[str], None] | None = None) -> None:
        super().__init__(alto=5.4)
        self.setMinimumHeight(430)
        self.setCursor(Qt.PointingHandCursor)
        self.setToolTip(
            "Pulsa un punto para fijar el emplazamiento.\n"
            "Rueda del ratón para acercar y alejar; la barra de abajo desplaza y reencuadra."
        )
        self._al_elegir = al_elegir_sitio
        self._areas = cargar_areas_protegidas()
        self._batimetria = cargar_batimetria()
        self._costa = cargar_costa()
        self._sitios = cargar_sitios()
        self._sitio_activo = "isla_fuerte"
        self._sitio_hover: str | None = None
        self._dibujado = False
        self.capas = {"protegidas": True, "recurso": True, "batimetria": True}
        # La atribucion vive en la figura, no en los ejes: ejes.clear() no la
        # borraria y cada redibujado apilaria una copia mas.
        self._atribucion = self.figure.text(0.01, 0.005, "", fontsize=6, color=PALETA["tenue"])
        self.mpl_connect("button_press_event", self._al_pulsar)
        self.mpl_connect("motion_notify_event", self._al_mover)
        self.mpl_connect("scroll_event", self._al_rodar)

    def conmutar(self, capa: str, visible: bool) -> None:
        """Encender o apagar una capa no recalcula nada: solo se vuelve a dibujar."""
        self.capas[capa] = visible
        self.dibujar()

    def fijar_sitio(self, sitio_id: str) -> None:
        self._sitio_activo = sitio_id
        self.dibujar()

    def dibujar(self) -> None:
        # El mapa se repinta al pasar el raton y al conmutar capas; si volviera
        # siempre al encuadre completo, cualquiera de esas cosas deshaeria el
        # zoom del usuario a media lectura.
        vista = (self.ejes.get_xlim(), self.ejes.get_ylim()) if self._dibujado else None
        self.ejes.clear()
        self.ejes.set_axis_on()
        self._capa_costa()
        if self.capas["protegidas"]:
            self._capa_protegidas()
        if self.capas["batimetria"]:
            self._capa_batimetria()
        if self.capas["recurso"]:
            self._capa_recurso()
        if vista is None:
            self.ejes.set_xlim(LON_MIN, LON_MAX)
            self.ejes.set_ylim(LAT_MIN, LAT_MAX)
        else:
            self.ejes.set_xlim(*vista[0])
            self.ejes.set_ylim(*vista[1])
        # Un grado de longitud y uno de latitud miden casi lo mismo a esta
        # latitud, asi que sin aspecto igual el pais sale estirado. Se encoge la
        # caja, no los limites: con adjustable="datalim" matplotlib abre el
        # encuadre hasta medio planeta para cuadrar la proporcion.
        self.ejes.set_aspect("equal", adjustable="box")
        self.ejes.set_xlabel("longitud (°)")
        self.ejes.set_ylabel("latitud (°)")
        self.ejes.set_title("Dónde no se puede construir, y solo después dónde hay recurso")
        # Fuera del encuadre: dentro no queda esquina libre (tapaba Tumaco) y el
        # aspecto igual deja margen lateral de sobra donde ponerla.
        self.ejes.legend(
            handles=self._leyenda(),
            fontsize="x-small",
            loc="center left",
            bbox_to_anchor=(1.01, 0.5),
            borderaxespad=0.0,
            frameon=False,
        )
        # Reservar la franja inferior para la atribucion, que si no pisa el eje.
        self.figure.get_layout_engine().set(rect=(0.0, 0.045, 1.0, 0.955))
        self._atribucion.set_text(
            f"{FUENTE_RUNAP} · {FUENTE_GMRT} · {FUENTE_RECURSO} · "
            f"{FUENTE_COSTA if self._costa else SIN_COSTA}"
        )
        self._dibujado = True
        self.draw_idle()

    def _capa_costa(self) -> None:
        """Tierra firme al fondo: sin ella los poligonos flotan sin referencia."""
        if not self._costa:
            return
        parches = [PoligonoMpl(anillo, closed=True) for anillo in self._costa]
        self.ejes.add_collection(
            PatchCollection(
                parches,
                facecolor=PALETA["borde"],
                edgecolor=PALETA["tenue"],
                linewidths=0.5,
                alpha=0.45,
                zorder=0,
            )
        )

    def _leyenda(self) -> list[Any]:
        """Artistas de referencia: una coleccion de parches no puede ir a la leyenda."""
        entradas: list[Any] = []
        if self._costa:
            entradas.append(
                Patch(
                    facecolor=PALETA["borde"],
                    edgecolor=PALETA["tenue"],
                    alpha=0.45,
                    label="tierra firme e islas (Natural Earth)",
                )
            )
        if self.capas["protegidas"]:
            entradas.append(
                Patch(
                    facecolor=PALETA["perdida"],
                    edgecolor=PALETA["acento"],
                    alpha=0.55,
                    label=f"prohibido: {len(self._areas)} áreas protegidas (RUNAP)",
                )
            )
        if self.capas["batimetria"]:
            entradas.append(
                Line2D(
                    [],
                    [],
                    marker="o",
                    linestyle="none",
                    markersize=5,
                    color=PALETA["recurso"],
                    label="fondo 30–60 m (GMRT, solo transecto de Isla Fuerte)",
                )
            )
        if self.capas["recurso"]:
            entradas.extend(
                Line2D(
                    [],
                    [],
                    marker="o",
                    linestyle="none",
                    markersize=7,
                    color=COLOR_SEMAFORO[estado],
                    label=f"recurso {estado}",
                )
                for estado in ("verificado", "inferido", "pendiente")
            )
        return entradas

    def _capa_protegidas(self) -> None:
        parches = [
            PoligonoMpl(np.array(anillo)[:, :2], closed=True)
            for area in self._areas
            for anillo in area["anillos"]
        ]
        if not parches:
            return
        coleccion = PatchCollection(
            parches,
            facecolor=PALETA["perdida"],
            edgecolor=PALETA["acento"],
            alpha=0.55,
            linewidths=0.4,
        )
        coleccion.set_label(f"prohibido: {len(self._areas)} áreas protegidas (RUNAP)")
        self.ejes.add_collection(coleccion)

    def _capa_batimetria(self) -> None:
        if not self._batimetria:
            return
        banda = (self._batimetria["profundidad_m"] <= -30) & (
            self._batimetria["profundidad_m"] >= -60
        )
        self.ejes.scatter(
            self._batimetria["lon"],
            self._batimetria["lat"],
            s=4,
            color=PALETA["borde"],
        )
        if banda.any():
            self.ejes.scatter(
                self._batimetria["lon"][banda],
                self._batimetria["lat"][banda],
                s=18,
                color=PALETA["recurso"],
            )

    # Cuatro posiciones alrededor del punto. Cuando dos emplazamientos caen
    # cerca (Isla Fuerte y Rosario distan 0,9°), el segundo toma la siguiente
    # para que las etiquetas no se pisen.
    # Misma altura y lado contrario: asi cada rotulo se apoya en su propio
    # marcador. Desplazarlos tambien en vertical los hacia converger, porque
    # Isla Fuerte y Rosario estan en diagonal.
    _DESPLAZAMIENTOS = ((10, 6), (-10, 6), (10, -26), (-10, -26))
    _ALINEACIONES = ("left", "right", "left", "right")
    _SEPARACION_ROTULOS_GRADOS = 1.6

    def _hueco_para_rotulo(self, sitio: dict[str, Any], ocupados: list[tuple[float, float]]) -> int:
        cercanos = sum(
            1
            for lon, lat in ocupados
            if abs(lon - sitio["lon"]) < self._SEPARACION_ROTULOS_GRADOS
            and abs(lat - sitio["lat"]) < self._SEPARACION_ROTULOS_GRADOS
        )
        return cercanos % len(self._DESPLAZAMIENTOS)

    def _capa_recurso(self) -> None:
        ocupados: list[tuple[float, float]] = []
        for sitio in self._sitios:
            color = COLOR_SEMAFORO.get(sitio["estado_recurso"], PALETA["tenue"])
            activo = sitio["id"] == self._sitio_activo
            es_hover = sitio["id"] == self._sitio_hover
            if es_hover and not activo:
                self.ejes.plot(
                    sitio["lon"],
                    sitio["lat"],
                    marker="o",
                    markersize=18,
                    color=color,
                    markeredgecolor=PALETA["tinta"],
                    markeredgewidth=1.0,
                    linestyle="none",
                    alpha=0.25,
                )
            self.ejes.plot(
                sitio["lon"],
                sitio["lat"],
                marker="*" if activo else "o",
                markersize=20 if activo else (14 if es_hover else 11),
                color=color,
                markeredgecolor=PALETA["tinta"],
                markeredgewidth=1.4 if activo else (1.0 if es_hover else 0.6),
                linestyle="none",
                zorder=5 if activo or es_hover else 3,
            )
            hueco = self._hueco_para_rotulo(sitio, ocupados)
            self.ejes.annotate(
                self._rotulo(sitio),
                (sitio["lon"], sitio["lat"]),
                textcoords="offset points",
                xytext=self._DESPLAZAMIENTOS[hueco],
                ha=self._ALINEACIONES[hueco],
                fontsize=7,
                fontweight="bold" if activo or es_hover else "normal",
                zorder=6,
                bbox={
                    "boxstyle": "round,pad=0.2",
                    "facecolor": PALETA["panel"],
                    "edgecolor": "none",
                    "alpha": 0.75,
                },
            )
            ocupados.append((sitio["lon"], sitio["lat"]))

    @staticmethod
    def _rotulo(sitio: dict[str, Any]) -> str:
        if sitio["j_kw_m"] is None:
            return f"{sitio['nombre']}\npendiente"
        return f"{sitio['nombre']}\n{formatear_magnitud(sitio['j_kw_m'], 'kW/m', 1)}"

    def wheelEvent(self, evento: Any) -> None:  # noqa: N802  (nombre de Qt)
        """La rueda hace zoom aqui y no llega al area desplazable de detras.

        matplotlib traduce la rueda a scroll_event pero no marca el evento como
        atendido, asi que Qt lo heredaba al padre y el mapa hacia zoom mientras
        la pagina se desplazaba a la vez.
        """
        super().wheelEvent(evento)
        evento.accept()

    def encuadrar(self) -> None:
        """Vuelve al encuadre completo de Colombia."""
        self.ejes.set_xlim(LON_MIN, LON_MAX)
        self.ejes.set_ylim(LAT_MIN, LAT_MAX)
        self.draw_idle()

    def _al_rodar(self, evento: Any) -> None:
        """Rueda del raton: acerca y aleja manteniendo fijo el punto del cursor."""
        if evento.xdata is None or evento.ydata is None:
            return
        x, y = float(evento.xdata), float(evento.ydata)
        if not (np.isfinite(x) and np.isfinite(y)):
            return
        factor = 1.0 / FACTOR_ZOOM if evento.button == "up" else FACTOR_ZOOM
        (x0, x1), (y0, y1) = self.ejes.get_xlim(), self.ejes.get_ylim()
        ancho, alto = (x1 - x0) * factor, (y1 - y0) * factor
        if not ZOOM_MINIMO_GRADOS <= ancho <= ZOOM_MAXIMO_GRADOS:
            return
        # El cursor se queda sobre el mismo punto del mapa antes y despues.
        fx = (x - x0) / (x1 - x0)
        fy = (y - y0) / (y1 - y0)
        self.ejes.set_xlim(x - fx * ancho, x + (1.0 - fx) * ancho)
        self.ejes.set_ylim(y - fy * alto, y + (1.0 - fy) * alto)
        self.draw_idle()

    def _sitio_bajo(self, evento: Any) -> str | None:
        """Emplazamiento dentro del radio de seleccion, o None.

        Filtra tambien las coordenadas no finitas: con NaN toda comparacion es
        falsa, asi que la guarda de distancia no saltaba y el clic acababa
        fijando el primer sitio de la lista.
        """
        # Durante un arrastre de desplazamiento o de zoom, matplotlib toma el
        # lienzo; ahi el clic es navegacion, no eleccion de emplazamiento.
        if self.widgetlock.locked():
            return None
        if not self._sitios or evento.xdata is None or evento.ydata is None:
            return None
        x, y = float(evento.xdata), float(evento.ydata)
        if not (np.isfinite(x) and np.isfinite(y)):
            return None
        cercano = min(self._sitios, key=lambda s: (s["lon"] - x) ** 2 + (s["lat"] - y) ** 2)
        distancia = np.hypot(cercano["lon"] - x, cercano["lat"] - y)
        return cercano["id"] if distancia <= RADIO_SELECCION_GRADOS else None

    def _al_mover(self, evento: Any) -> None:
        nuevo_hover = self._sitio_bajo(evento)
        if nuevo_hover != self._sitio_hover:
            self._sitio_hover = nuevo_hover
            self.dibujar()

    def _al_pulsar(self, evento: Any) -> None:
        elegido = self._sitio_bajo(evento)
        if elegido is None:
            return
        self.fijar_sitio(elegido)
        if self._al_elegir is not None:
            self._al_elegir(elegido)

    def descripcion_sitio(self, sitio_id: str) -> str:
        """Lo eliminatorio primero, la cifra de recurso despues."""
        for sitio in self._sitios:
            if sitio["id"] != sitio_id:
                continue
            recurso = (
                "recurso pendiente de fuente verificada"
                if sitio["j_kw_m"] is None
                else f"recurso {formatear_magnitud(sitio['j_kw_m'], 'kW/m', 1)} ({sitio['estado_recurso']})"
            )
            return (
                f"{sitio['nombre']}: {sitio['estado_legal']} — {sitio['area_protegida']}\n{recurso}"
            )
        return "sitio desconocido"
