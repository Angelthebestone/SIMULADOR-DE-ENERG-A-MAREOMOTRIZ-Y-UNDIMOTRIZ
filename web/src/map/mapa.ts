import maplibregl from "maplibre-gl";
import { Protocol } from "pmtiles";

const ULTIMO_RECURSO = "gray";
let pincel: CanvasRenderingContext2D | null = null;
function aColorSoportado(valor: string, fb: string): string {
  try {
    pincel ??= document
      .createElement("canvas")
      .getContext("2d", { willReadFrequently: true });
    if (!pincel) return fb;
    pincel.clearRect(0, 0, 1, 1);
    pincel.fillStyle = valor;
    pincel.fillRect(0, 0, 1, 1);
    const [r, g, b, a] = pincel.getImageData(0, 0, 1, 1).data;
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

/** Estilo único del mapa. No hay selector de capas: la carta es el mar, la
 *  tierra y la línea de costa, y encima van sólo las capas que deciden algo
 *  (recurso, áreas protegidas, emplazamientos). Un fondo estable deja que el
 *  dato sea lo que cambia de color. */
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
    { id: "fondo", type: "background" as const, paint: { "background-color": css("--map-oceano", "oklch(0.360 0.055 240)") } },
    { id: "tierra", type: "fill" as const, source: "base_vector", paint: { "fill-color": css("--map-tierra-fill", "oklch(0.910 0.005 106)") } },
    { id: "costa_linea", type: "line" as const, source: "base_vector", paint: { "line-color": css("--map-tierra-stroke", "oklch(0.470 0.012 245)"), "line-width": 0.6 } },
  ],
};

/** Vista de arranque: el mundo entero, porque cualquier punto de mar es
 *  simulable. `VISTA_CARIBE` es el encuadre del estudio de origen y es a donde
 *  vuelve el botón de inicio de la vista de mapa. */
const VISTA_MUNDO = { center: [-30, 18] as [number, number], zoom: 1.4 };
export const VISTA_CARIBE = { center:[-76.18,9.39] as [number, number], zoom: 6 };

export type SitioMapa = {
  id: string; nombre: string; lon: number; lat: number;
  valor: number | null; unidad: string; fuente: string; estado: string;
  pais?: string; region?: string; tipo?: "undimotriz" | "mareomotriz" | "mixto";
  hm0_m?: number; te_s?: number; rango_m?: number; velocidad_ms?: number; profundidad_m?: number;
};

function coleccionSitios(sitios: SitioMapa[]) {
  return {
    type: "FeatureCollection" as const,
    features: sitios.map((s) => ({
      type: "Feature" as const,
      geometry: { type: "Point" as const, coordinates: [s.lon, s.lat] },
      properties: {
        id: s.id,
        nombre: s.nombre,
        valor: s.valor,
        unidad: s.unidad,
        fuente: s.fuente,
        estado: s.estado,
        pais: s.pais || "Mundial",
        region: s.region || "",
        tipo: s.tipo || "undimotriz",
        te_s: s.te_s ?? null,
        rango_m: s.rango_m ?? null,
        velocidad_ms: s.velocidad_ms ?? null,
        profundidad_m: s.profundidad_m ?? null,
      },
    })),
  };
}

export function actualizarSitios(map: maplibregl.Map, sitios: SitioMapa[]): void {
  const fuente = map.getSource("sitios") as maplibregl.GeoJSONSource | undefined;
  fuente?.setData(coleccionSitios(sitios) as never);
}

export function crearMapa(container: string | HTMLElement, sitios: SitioMapa[] = []): maplibregl.Map {
  const protocol = new Protocol();
  maplibregl.addProtocol("pmtiles", protocol.tile);

  // Emplazamientos con semáforo ●◐○ — color + forma
  const map = new maplibregl.Map({container, style: styleVectorLocal, center: VISTA_MUNDO.center, zoom: VISTA_MUNDO.zoom, minZoom: 1, maxZoom: 12, attributionControl: false});
  // Sin control de atribución sobre la carta: las fuentes se citan en el rail,
  // donde caben enteras y no tapan medio océano.
  map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-left");

  const nodo = typeof container === "string" ? document.getElementById(container) : container;
  if (nodo && typeof ResizeObserver !== "undefined") {
    const observador = new ResizeObserver(() => map.resize());
    observador.observe(nodo);
    map.on("remove", () => observador.disconnect());
  }

  map.on("load", () => {
    // Pirámides ráster de contexto (batimetría GEBCO, Sentinel-2, relieve
    // GLO-30 y VIIRS nocturno). Se declaran aquí porque el árbol de teselas
    // existe en disco y la procedencia forma parte del mapa, pero ninguna capa
    // las pinta: el estilo es uno solo, sin conmutadores, y los mosaicos de
    // relleno de las pirámides sin imagen real no aportan nada a la decisión.
    // Sin capa que las use, MapLibre no pide una sola tesela (XYZ {z}/{x}/{y}).
    map.addSource("batimetria_sombreada", { type: "raster", tiles: ["./datos/gee/batimetria_sombreada/{z}/{x}/{y}.png"], tileSize: 256, maxzoom: 11, attribution: "GEBCO 2023" });
    map.addSource("sentinel2_mediana", { type: "raster", tiles: ["./datos/gee/sentinel2_mediana/{z}/{x}/{y}.png"], tileSize: 256, maxzoom: 14, attribution: "Sentinel-2 2023" });
    map.addSource("relieve_sombreado", { type: "raster", tiles: ["./datos/gee/relieve_sombreado/{z}/{x}/{y}.png"], tileSize: 256, maxzoom: 12, attribution: "Copernicus DEM GLO-30" });
    map.addSource("viirs_nocturno", { type: "raster", tiles: ["./datos/gee/viirs_nocturno/{z}/{x}/{y}.png"], tileSize: 256, maxzoom: 8, attribution: "VIIRS DNB 2023" });

    // 1. Recurso undimotriz: malla mundial de J medido, no una función de
    //    adorno. datos/oleaje/descargar_potencial_global.py la compone desde
    //    el reanalisis de oleaje y guarda kW/m por punto de mar.
    map.addSource("potencial_oleaje", {
      type: "geojson",
      data: "./datos/oleaje/potencial_oleaje_global.geojson",
      attribution: "Open-Meteo Marine (ERA5-Ocean / MFWAM)",
    });

    map.addLayer({
      id: "mapa_calor_oleaje",
      type: "heatmap",
      source: "potencial_oleaje",
      maxzoom: 7,
      paint: {
        // El dominio de la rampa es el rango real del recurso mundial:
        // 0 kW/m en el cinturón ecuatorial, ~80 kW/m en los cuarenta rugientes.
        "heatmap-weight": ["interpolate", ["linear"], ["get", "oleaje_kw_m"], 0, 0, 80, 1],
        "heatmap-intensity": ["interpolate", ["linear"], ["zoom"], 0, 1.1, 6, 2.2],
        "heatmap-color": [
          "interpolate",
          ["linear"],
          ["heatmap-density"],
          0, "rgba(12, 74, 110, 0)",
          0.25, "rgba(14, 116, 144, 0.55)",
          0.5, "rgba(45, 212, 191, 0.65)",
          0.75, "rgba(234, 179, 8, 0.75)",
          1, "rgba(217, 70, 30, 0.85)",
        ],
        // La malla es de 8°, así que la separación entre puntos se duplica con
        // cada nivel de zoom. El radio la sigue: por debajo de ~1,5 veces esa
        // separación la mancha se lee como una cuadrícula de lunares.
        "heatmap-radius": ["interpolate", ["exponential", 2], ["zoom"], 0, 22, 3, 176, 5, 300],
        "heatmap-opacity": ["interpolate", ["linear"], ["zoom"], 5, 0.85, 7, 0],
      },
    });

    // De cerca la mancha estorba: por encima de zoom 5 la malla se lee punto a
    // punto, que es donde cada valor tiene fuente y celda.
    map.addLayer({
      id: "potencial_oleaje_puntos",
      type: "circle",
      source: "potencial_oleaje",
      minzoom: 5,
      paint: {
        "circle-radius": ["interpolate", ["linear"], ["zoom"], 5, 3, 10, 7],
        "circle-color": [
          "interpolate", ["linear"], ["get", "oleaje_kw_m"],
          0, "#0e7490",
          20, "#2dd4bf",
          45, "#eab308",
          80, "#d9461e",
        ],
        "circle-opacity": 0.75,
        "circle-stroke-width": 0.5,
        "circle-stroke-color": "rgba(255,255,255,0.55)",
      },
    });

    // 2. Recurso mareal: los emplazamientos con marea medida o explotada.
    //    No hay malla mundial de mareas en el árbol, así que fuera de estos
    //    puntos la marea queda pendiente en vez de interpolarse.
    map.addSource("mareas", {
      type: "geojson",
      data: "./datos/mareas/hotspots_mareales.geojson",
      attribution: "Operadores y agencias de cada emplazamiento mareal",
    });

    map.addLayer({
      id: "mareas_puntos",
      type: "circle",
      source: "mareas",
      paint: {
        "circle-radius": ["interpolate", ["linear"], ["get", "rango_m"], 1, 4, 16, 11],
        "circle-color": "rgba(0,0,0,0)",
        "circle-stroke-width": 2,
        "circle-stroke-color": css("--rol-captado", "oklch(0.520 0.130 062)"),
      },
    });

    // 3. Capas de decisión local: RUNAP, emplazamientos y batimetría 30-60 m
    map.addSource("runap", { type: "geojson", data: "./datos/runap/areas_marinas_protegidas.geojson" });
    map.addSource("sitios", { type: "geojson", data: coleccionSitios(sitios) });
    map.addSource("batimetria_30_60", { type: "geojson", data: "./datos/batimetria/transecto_isla_fuerte_gmrt.geojson" });

    map.addLayer({ id: "runap_rayado", type: "fill", source: "runap", paint: { "fill-color": css("--conf-pendiente", "oklch(0.494 0.159 037)"), "fill-opacity": 0.22 } });
    map.addLayer({ id: "runap_borde", type: "line", source: "runap", paint: { "line-color": css("--conf-pendiente", "oklch(0.494 0.159 037)"), "line-width": 1, "line-dasharray": [4, 2] } });

    // Emplazamientos: un solo círculo con anillo blanco. El estado va en color
    // y en el relleno del núcleo, para que se distinga también sin color.
    map.addLayer({
      id: "emplazamientos",
      type: "circle",
      source: "sitios",
      paint: {
        "circle-radius": ["interpolate", ["linear"], ["zoom"], 1, 4.5, 6, 8],
        "circle-stroke-width": 1.5,
        "circle-stroke-color": "#ffffff",
        "circle-color": [
          "match",
          ["get", "estado"],
          "verificado", css("--conf-verificado", "oklch(0.578 0.117 166)"),
          "inferido", css("--conf-inferido", "oklch(0.638 0.138 070)"),
          css("--conf-pendiente", "oklch(0.494 0.159 037)"),
        ],
        "circle-opacity": 0.95,
      },
    });

    map.addLayer({
      id: "emplazamientos_simbolo",
      type: "circle",
      source: "sitios",
      minzoom: 3,
      paint: {
        "circle-radius": 2.5,
        "circle-color": "#ffffff",
        "circle-opacity": ["match", ["get", "estado"], "verificado", 1, "inferido", 0.6, 0.15],
      },
    });

    map.addLayer({
      id: "batimetria_isolinea_30_60m",
      type: "line",
      source: "batimetria_30_60",
      filter: ["all", [">=", ["get", "profundidad_m"], -60], ["<=", ["get", "profundidad_m"], -30]],
      paint: { "line-color": css("--rol-recurso", "oklch(0.532 0.131 244)"), "line-width": 1.5, "line-dasharray": [2, 2] },
    });
  });

  const popup = new maplibregl.Popup({ closeButton: false, closeOnClick: false, className: "popup-mapa" });
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

  const fila = (rotulo: string, cuerpo: string) =>
    `<div class="popup-fila"><span>${rotulo}</span><span>${cuerpo}</span></div>`;

  map.on("mousemove", "emplazamientos", (e) => {
    if (!e.features?.[0]) return;
    map.getCanvas().style.cursor = "pointer";
    const p = e.features[0].properties as {
      nombre?: string;
      valor?: number;
      unidad?: string;
      fuente?: string;
      estado?: string;
      tipo?: string;
    };
    const estado = p.estado ?? "pendiente";
    const nombre = p.nombre ?? "Emplazamiento";
    const html =
      estado === "pendiente" || p.valor == null
        ? `<div class="popup-cuerpo"><strong>${nombre}</strong>${fila("valor", "pendiente — sin dato")}${fila("estado", estado)}</div>`
        : `<div class="popup-cuerpo"><strong>${nombre}</strong>${fila("valor", `${p.valor} kW/m`)}${fila("fuente", p.fuente ?? "—")}${fila("estado", estado)}</div>`;
    popup.setLngLat(e.lngLat).setHTML(html).addTo(map);
  });

  map.on("mouseleave", "emplazamientos", () => {
    map.getCanvas().style.cursor = "";
    popup.remove();
  });

  // La malla de recurso también se consulta: cada punto trae su Hm0, su Te y
  // el J que sale de ellos, con estado inferido porque viene de reanálisis.
  map.on("mousemove", "potencial_oleaje_puntos", (e) => {
    if (!e.features?.[0]) return;
    map.getCanvas().style.cursor = "crosshair";
    const p = e.features[0].properties as { oleaje_kw_m?: number; hm0_m?: number; te_s?: number };
    popup
      .setLngLat(e.lngLat)
      .setHTML(
        `<div class="popup-cuerpo"><strong>Malla de recurso</strong>` +
          fila("valor", `${p.oleaje_kw_m ?? "—"} kW/m`) +
          fila("Hm0 / Te", `${p.hm0_m ?? "—"} m · ${p.te_s ?? "—"} s`) +
          fila("fuente", "reanálisis de oleaje") +
          fila("estado", "inferido") +
          `</div>`
      )
      .addTo(map);
  });
  map.on("mouseleave", "potencial_oleaje_puntos", () => {
    map.getCanvas().style.cursor = "";
    popup.remove();
  });

  map.on("mousemove", "mareas_puntos", (e) => {
    if (!e.features?.[0]) return;
    map.getCanvas().style.cursor = "pointer";
    const p = e.features[0].properties as {
      nombre?: string; rango_m?: number; velocidad_ms?: number; fuente?: string;
    };
    popup
      .setLngLat(e.lngLat)
      .setHTML(
        `<div class="popup-cuerpo"><strong>${p.nombre ?? "Punto mareal"}</strong>` +
          fila("rango", `${p.rango_m ?? "—"} m`) +
          fila("corriente", `${p.velocidad_ms ?? "—"} m/s`) +
          fila("fuente", p.fuente ?? "—") +
          fila("estado", "verificado") +
          `</div>`
      )
      .addTo(map);
  });
  map.on("mouseleave", "mareas_puntos", () => {
    map.getCanvas().style.cursor = "";
    popup.remove();
  });

  map.on("click", "emplazamientos", (e) => {
    if (isDragging) return;
    const id = (e.features?.[0]?.properties as { id?: string })?.id;
    if (id) map.fire("sitio_seleccionado" as never, { id } as never);
  });

  // Click en cualquier parte del océano global para posicionar la simulación.
  // En tierra no hay nada que simular: el contorno de Natural Earth ya está
  // dibujado, así que se pregunta a esa misma capa si el punto cae dentro.
  map.on("click", (e) => {
    if (isDragging) return;
    if (map.queryRenderedFeatures(e.point, { layers: ["emplazamientos"] }).length > 0) return;

    const { lng, lat } = e.lngLat;
    if (map.queryRenderedFeatures(e.point, { layers: ["tierra"] }).length > 0) {
      map.fire("punto_en_tierra" as never, { lon: lng, lat } as never);
      return;
    }
    map.fire("coordenada_seleccionada" as never, { lon: lng, lat } as never);
  });

  // Mapa no recalcula: ninguna acción dispara el cálculo
  map.getCanvas().setAttribute("aria-label", "Mapa navegable mundial: arrastra para desplazar, rueda para zoom, pulsa cualquier zona marina para simular");

  return map;
}

export function flyToSitio(map: maplibregl.Map, lon: number, lat: number, zoom = 7): void {
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduce) {
    map.jumpTo({ center: [lon, lat] });
  } else {
    map.flyTo({center:[lon,lat], duration:600, essential:true});
  }
}

export function cuandoCargue(map: maplibregl.Map): Promise<maplibregl.Map> {
  return new Promise((resolve) => {
    if (map.loaded()) resolve(map);
    else map.once("load", () => resolve(map));
  });
}

export { styleVectorLocal };
