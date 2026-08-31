import maplibregl from "maplibre-gl";
import { Protocol } from "pmtiles";
import { CAPAS } from "./capas";

// Sin red: PMTiles local + XYZ 256px piramidados — todo local sin CDN externo.
// Colores desde tokens.css (oklch) — sin literales hex duplicados.
/** Convierte cualquier color CSS a la forma que el validador de MapLibre acepta.
 *
 * tokens.css declara la paleta en oklch, pero el parser de estilos de MapLibre
 * sólo entiende nombres, hex y rgb()/hsl(): con un oklch rechazaba el estilo
 * entero ("color expected, oklch(...) found") y el mapa se quedaba en blanco
 * sin llegar a pedir una tesela. El propio navegador hace la conversión: al
 * asignar el color a un canvas 2D se serializa como hex o rgba().
 */
// Color con nombre, no de la paleta: solo se usa si ni el token ni su
// respaldo se pueden interpretar, y hace visible que algo va mal.
const ULTIMO_RECURSO = "gray";
let pincel: CanvasRenderingContext2D | null = null;
function aColorSoportado(valor: string, fb: string): string {
  try {
    pincel ??= document
      .createElement("canvas")
      .getContext("2d", { willReadFrequently: true });
    if (!pincel) return fb;
    // Se pinta y se lee el píxel en vez de releer `fillStyle`: los navegadores
    // actuales devuelven `oklch(...)` tal cual al serializarlo, mientras que el
    // búfer del canvas ya está rasterizado en sRGB.
    pincel.clearRect(0, 0, 1, 1);
    pincel.fillStyle = valor;
    pincel.fillRect(0, 0, 1, 1);
    const [r, g, b, a] = pincel.getImageData(0, 0, 1, 1).data;
    // a === 0 significa que el color no se pudo parsear (el canvas sigue
    // transparente). Se reintenta con el respaldo y, si tampoco, gris neutro:
    // devolver el oklch original volvería a tumbar el estilo entero.
    if (a === 0) return valor === fb ? ULTIMO_RECURSO : aColorSoportado(fb, fb);
    return a === 255 ? `rgb(${r}, ${g}, ${b})` : `rgba(${r}, ${g}, ${b}, ${(a / 255).toFixed(3)})`;
  } catch {
    return ULTIMO_RECURSO;
  }
}

function css(name: string, fb: string): string {
  try {
    const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    return aColorSoportado(v || fb, fb);
  } catch {
    return aColorSoportado(fb, fb);
  }
}

// La fuente base apuntaba a `datos/costa/contorno_tierra.pmtiles`, que nunca
// se genero: el estilo no cargaba, MapLibre abortaba ahi y el mapa se quedaba
// gris sin pedir una sola tesela. `descargar_costa.py` deja el contorno en
// GeoJSON (Natural Earth, ~130 kB), que es lo que se usa aqui.
//
// Sin `glyphs` no hay tipografia vectorial local, asi que la capa de etiquetas
// de lugares no se declara: un layer symbol sin glyphs no pinta nada.
const styleVectorLocal = {
  version: 8 as const,
  sources: {
    base_vector: {
      type: "geojson" as const,
      data: "./datos/costa/contorno_tierra.geojson",
      attribution: "Natural Earth — naturalearthdata.com",
    },
  },
  layers: [
    { id: "fondo", type: "background" as const, paint: { "background-color": css("--map-bg", "oklch(0.945 0.003 106)") } },
    { id: "tierra", type: "fill" as const, source: "base_vector", paint: { "fill-color": css("--map-tierra-fill", "oklch(0.910 0.005 106)") } },
    { id: "costa_linea", type: "line" as const, source: "base_vector", paint: { "line-color": css("--map-tierra-stroke", "oklch(0.470 0.012 245)"), "line-width": 0.5 } },
  ],
};

export type SitioMapa = {
  id: string; nombre: string; lon: number; lat: number;
  valor: number | null; unidad: string; fuente: string; estado: string;
};

/** `datos/sitios.geojson` tampoco existe (los sitios viven uno por archivo en
 *  `datos/sitios/*.json`), asi que la coleccion se arma con la lista que ya
 *  tiene la vista y deja de haber un fetch a un archivo inexistente. */
function coleccionSitios(sitios: SitioMapa[]) {
  return {
    type: "FeatureCollection" as const,
    features: sitios.map((s) => ({
      type: "Feature" as const,
      geometry: { type: "Point" as const, coordinates: [s.lon, s.lat] },
      properties: { id: s.id, nombre: s.nombre, valor: s.valor, unidad: s.unidad, fuente: s.fuente, estado: s.estado },
    })),
  };
}

export function crearMapa(container: string | HTMLElement, sitios: SitioMapa[] = []): maplibregl.Map {
  const protocol = new Protocol();
  maplibregl.addProtocol("pmtiles", protocol.tile);

  const map = new maplibregl.Map({container, style: styleVectorLocal, center:[-76.18,9.39], zoom:6});

  // El mapa se crea al montar el nivel, antes de que el navegador asiente el
  // tamaño del contenedor, así que el viewport GL nacía a cero y el lienzo se
  // quedaba en el color de fondo hasta que algo disparaba un `resize`.
  // MapLibre 4 no observa el contenedor por su cuenta.
  const nodo = typeof container === "string" ? document.getElementById(container) : container;
  if (nodo && typeof ResizeObserver !== "undefined") {
    const observador = new ResizeObserver(() => map.resize());
    observador.observe(nodo);
    map.on("remove", () => observador.disconnect());
  }

  // Capas contexto — ráster XYZ 256px piramidado local
  map.on("load", () => {
    map.addSource("batimetria_sombreada", { type: "raster", tiles: ["./datos/gee/batimetria_sombreada/{z}/{x}/{y}.png"], tileSize: 256, maxzoom: 11, attribution: "GEBCO 2023" });
    map.addSource("sentinel2_mediana", { type: "raster", tiles: ["./datos/gee/sentinel2_mediana/{z}/{x}/{y}.png"], tileSize: 256, maxzoom: 14, attribution: "Sentinel-2 2023" });
    map.addSource("relieve_sombreado", { type: "raster", tiles: ["./datos/gee/relieve_sombreado/{z}/{x}/{y}.png"], tileSize: 256, maxzoom: 12, attribution: "Copernicus DEM GLO-30" });
    map.addSource("viirs_nocturno", { type: "raster", tiles: ["./datos/gee/viirs_nocturno/{z}/{x}/{y}.png"], tileSize: 256, maxzoom: 8, attribution: "VIIRS DNB 2023" });

    map.addLayer({ id: "batimetria_sombreada", type: "raster", source: "batimetria_sombreada", paint: { "raster-opacity": 0.7 } });
    map.addLayer({ id: "sentinel2_mediana", type: "raster", source: "sentinel2_mediana", paint: { "raster-opacity": 0.65 } });
    map.addLayer({ id: "relieve_sombreado", type: "raster", source: "relieve_sombreado", paint: { "raster-opacity": 0.6 } });
    map.addLayer({ id: "viirs_nocturno", type: "raster", source: "viirs_nocturno", paint: { "raster-opacity": 0.55 } });

    // Capas decisión: RUNAP rayado, emplazamientos semáforo, batimetría isolínea 30-60m
    map.addSource("runap", { type: "geojson", data: "./datos/runap/areas_marinas_protegidas.geojson" });
    map.addSource("sitios", { type: "geojson", data: coleccionSitios(sitios) });
    map.addSource("batimetria_30_60", { type: "geojson", data: "./datos/batimetria/transecto_isla_fuerte_gmrt.geojson" });

    // RUNAP rayado — trama además de color para distinguibilidad sin color
    map.addLayer({ id: "runap_rayado", type: "fill", source: "runap", paint: { "fill-color": css("--conf-pendiente", "oklch(0.494 0.159 037)"), "fill-opacity": 0.25 } });
    map.addLayer({ id: "runap_borde", type: "line", source: "runap", paint: { "line-color": css("--conf-pendiente", "oklch(0.494 0.159 037)"), "line-width": 1, "line-dasharray": [4, 2] } });

    // Emplazamientos con semáforo ●◐○ — color + forma (tokens.css, semaforo idéntico en 3 pantallas)
    map.addLayer({
      id: "emplazamientos",
      type: "circle",
      source: "sitios",
      paint: {
        "circle-radius": 7,
        "circle-stroke-width": 1.5,
        "circle-stroke-color": css("--tinta", "oklch(0.238 0.017 238)"),
        "circle-color": ["match", ["get", "estado"], "verificado", css("--conf-verificado", "oklch(0.578 0.117 166)"), "inferido", css("--conf-inferido", "oklch(0.638 0.138 070)"), css("--conf-pendiente", "oklch(0.494 0.159 037)")],
        "circle-opacity": ["match", ["get", "estado"], "pendiente", 0.35, 1],
      },
    });

    // El semaforo en forma se dibuja con el propio circulo (relleno/hueco), no
    // con un layer symbol: sin `glyphs` local MapLibre no puede componer texto.
    map.addLayer({
      id: "emplazamientos_simbolo",
      type: "circle",
      source: "sitios",
      paint: {
        "circle-radius": 3,
        "circle-color": css("--panel", "oklch(0.988 0.003 106)"),
        "circle-opacity": ["match", ["get", "estado"], "verificado", 0, "inferido", 0.55, 1],
      },
    });

    // Batimetría isolínea 30-60m — banda identificable alrededor de sitio activo via GMRT
    map.addLayer({ id: "batimetria_isolinea_30_60m", type: "line", source: "batimetria_30_60", filter: ["all", [">=", ["get", "profundidad_m"], -60], ["<=", ["get", "profundidad_m"], -30]], paint: { "line-color": css("--rol-recurso", "oklch(0.532 0.131 244)"), "line-width": 1.5, "line-dasharray": [2, 2] } });
  });

  // Hover: popup con {valor, unidad:"kW/m", fuente, estado:"verificado|inferido|pendiente"} y "pendiente — sin dato" si pendiente
  const popup = new maplibregl.Popup({ closeButton: false, closeOnClick: false });
  let mousedownPos: { x: number; y: number } | null = null;
  let isDragging = false;

  map.getCanvas().addEventListener("mousedown", (e) => {
    mousedownPos = { x: e.clientX, y: e.clientY };
    isDragging = false;
  });
  map.getCanvas().addEventListener("mousemove", (e) => {
    if (mousedownPos && (Math.abs(e.clientX - mousedownPos.x) > 5 || Math.abs(e.clientY - mousedownPos.y) > 5)) {
      isDragging = true;
    }
  });
  map.getCanvas().addEventListener("mouseup", () => {
    mousedownPos = null;
    setTimeout(() => (isDragging = false), 0);
  });

  map.on("mousemove", "emplazamientos", (e) => {
    if (!e.features?.[0]) return;
    const p = e.features[0].properties as { valor?: number; fuente?: string; estado?: string };
    const estado = p.estado ?? "pendiente";
    const html =
      estado === "pendiente" || p.valor == null
        ? `<div>pendiente — sin dato</div><div>estado: ${estado}</div>`
        : `<div>valor: ${p.valor} <span>kW/m</span></div><div>fuente: ${p.fuente ?? "—"}</div><div>estado: ${estado}</div><div>unidad: kW/m</div>`;
    popup.setLngLat(e.lngLat).setHTML(html).addTo(map);
  });
  map.on("mouseleave", "emplazamientos", () => popup.remove());

  // Click vs drag: mousedown+movimiento >5px = arrastre no selecciona
  map.on("click", "emplazamientos", (e) => {
    if (isDragging) return;
    const id = (e.features?.[0]?.properties as { id?: string })?.id;
    if (id) map.fire("sitio_seleccionado" as never, { id } as never);
  });

  // Mapa no recalcula: ninguna acción dispara el cálculo
  map.getCanvas().setAttribute("aria-label", "Mapa navegable: arrastra para desplazar, rueda para zoom, pulsa emplazamiento para seleccionar");

  return map;
}

export function flyToSitio(map: maplibregl.Map, lon: number, lat: number): void {
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduce) {
    map.jumpTo({ center: [lon, lat] });
  } else {
    map.flyTo({center:[lon,lat], duration:600, essential:true});
  }
}

/**
 * Conmuta la visibilidad de una capa del mapa por su id registrado en
 * `crearMapa`. Se aplica tras `map.on("load")`; antes del load la capa aún
 * no existe en el style y la función lo declara sin lanzar.
 */
export function alternarCapa(map: maplibregl.Map, layerId: string, visible: boolean): boolean {
  try {
    if (!map.getLayer(layerId)) return false;
    map.setLayoutProperty(layerId, "visibility", visible ? "visible" : "none");
    return true;
  } catch {
    return false;
  }
}

/** Devuelve la visibilidad actual de una capa; "none" si no existe o falla. */
export function visibilidadCapa(map: maplibregl.Map, layerId: string): "visible" | "none" | "inexistente" {
  try {
    if (!map.getLayer(layerId)) return "inexistente";
    const v = map.getLayoutProperty(layerId, "visibility");
    return (v === "none" ? "none" : "visible");
  } catch {
    return "inexistente";
  }
}

/** Espera al evento `load` del mapa y resuelve con el map. */
export function cuandoCargue(map: maplibregl.Map): Promise<maplibregl.Map> {
  return new Promise((resolve) => {
    if (map.loaded()) resolve(map);
    else map.once("load", () => resolve(map));
  });
}

export { styleVectorLocal };
