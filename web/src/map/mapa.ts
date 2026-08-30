import maplibregl from "maplibre-gl";
import { Protocol } from "pmtiles";
import { CAPAS } from "./capas";

// Sin red: PMTiles local + XYZ 256px piramidados — todo local sin CDN externo.
// Colores desde tokens.css (oklch) — sin literales hex duplicados.
function css(name: string, fb: string): string {
  try {
    const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    return v || fb;
  } catch {
    return fb;
  }
}

const styleVectorLocal = {
  version: 8 as const,
  sources: {
    base_vector: {
      type: "vector" as const,
      url: "pmtiles://./datos/costa/contorno_tierra.pmtiles",
      attribution: "Natural Earth PMTiles",
    },
  },
  glyphs: "./fonts/{fontstack}/{range}.pbf",
  sprite: "./sprites/sprite",
  layers: [
    { id: "fondo", type: "background" as const, paint: { "background-color": css("--map-bg", "oklch(0.945 0.003 106)") } },
    { id: "tierra", type: "fill" as const, source: "base_vector", "source-layer": "tierra", paint: { "fill-color": css("--map-tierra-fill", "oklch(0.910 0.005 106)") } },
    { id: "costa_linea", type: "line" as const, source: "base_vector", "source-layer": "tierra", paint: { "line-color": css("--map-tierra-stroke", "oklch(0.470 0.012 245)"), "line-width": 0.5 } },
    { id: "etiquetas", type: "symbol" as const, source: "base_vector", "source-layer": "lugares", layout: { "text-field": ["get", "nombre"], "text-size": 12 } },
  ],
};

export function crearMapa(container: string | HTMLElement): maplibregl.Map {
  const protocol = new Protocol();
  maplibregl.addProtocol("pmtiles", protocol.tile);

  const map = new maplibregl.Map({container, style: styleVectorLocal, center:[-76.18,9.39], zoom:6});

  // Capas contexto — ráster XYZ 256px piramidado local
  map.on("load", () => {
    map.addSource("batimetria_sombreada", { type: "raster", tiles: ["./datos/gee/batimetria_sombreada/{z}/{x}/{y}.png"], tileSize: 256, maxzoom: 8, attribution: "GEBCO 2023" });
    map.addSource("sentinel2_mediana", { type: "raster", tiles: ["./datos/gee/sentinel2_mediana/{z}/{x}/{y}.png"], tileSize: 256, maxzoom: 10, attribution: "Sentinel-2 2023" });
    map.addSource("relieve_sombreado", { type: "raster", tiles: ["./datos/gee/relieve_sombreado/{z}/{x}/{y}.png"], tileSize: 256, maxzoom: 9, attribution: "Copernicus DEM GLO-30" });

    map.addLayer({ id: "batimetria_sombreada", type: "raster", source: "batimetria_sombreada", paint: { "raster-opacity": 0.7 } });
    map.addLayer({ id: "sentinel2_mediana", type: "raster", source: "sentinel2_mediana", paint: { "raster-opacity": 0.65 } });
    map.addLayer({ id: "relieve_sombreado", type: "raster", source: "relieve_sombreado", paint: { "raster-opacity": 0.6 } });

    // Capas decisión: RUNAP rayado, emplazamientos semáforo, batimetría isolínea 30-60m
    map.addSource("runap", { type: "geojson", data: "./datos/runap/areas_marinas_protegidas.geojson" });
    map.addSource("sitios", { type: "geojson", data: "./datos/sitios.geojson" });
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

    // Símbolo textual semáforo para distinguibilidad en gris
    map.addLayer({
      id: "emplazamientos_simbolo",
      type: "symbol",
      source: "sitios",
      layout: { "text-field": ["match", ["get", "estado"], "verificado", "●", "inferido", "◐", "○"], "text-size": 10, "text-offset": [0, -1.2] },
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

export { styleVectorLocal };
