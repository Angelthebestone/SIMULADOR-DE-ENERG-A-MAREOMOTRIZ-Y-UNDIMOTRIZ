import maplibregl from "maplibre-gl";
import { Protocol } from "pmtiles";
import { coleccionCorrientes, coleccionRangoMareal, distanciaKm } from "../datos/marino";
import {
  DISTANCIA_MAX_DIQUE_COSTA_KM,
  MENSAJE_DIQUE_LEJOS,
  RUTA_PLANTAS,
  type TecnologiaActiva,
} from "./plantas";

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

/** Vista de arranque: el mundo entero, porque cualquier punto de mar es simulable. */
const VISTA_MUNDO = { center: [-30, 18] as [number, number], zoom: 1.4 };

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

/** Tecnología activa del flujo: una sola capa de potencial a la vez, nunca
 *  todas juntas. undimotriz pinta densidad kW/m, dique pinta rango mareal m y
 *  turbina pinta velocidad media m/s. La vista la conmuta con
 *  `fijarTecnologiaActiva` cuando cambia el dispositivo del flujo. */
let tecnologiaMapa: TecnologiaActiva = "undimotriz";

const CAPAS_POTENCIAL: Record<TecnologiaActiva, string[]> = {
  undimotriz: ["mapa_calor_oleaje", "potencial_oleaje_puntos"],
  dique: ["dique_rango_puntos"],
  turbina: ["turbina_puntos", "turbina_simbolo"],
};

function aplicarTecnologia(map: maplibregl.Map): void {
  for (const [tec, capas] of Object.entries(CAPAS_POTENCIAL) as [TecnologiaActiva, string[]][]) {
    for (const id of capas) {
      if (map.getLayer(id)) map.setLayoutProperty(id, "visibility", tec === tecnologiaMapa ? "visible" : "none");
    }
  }
}

/** Conmuta la capa de potencial visible según la tecnología activa. Si el mapa
 *  aún no cargó las capas, guarda la selección y se aplica al cargar. */
export function fijarTecnologiaActiva(map: maplibregl.Map, tec: TecnologiaActiva): void {
  tecnologiaMapa = tec;
  // Con dique, el clic valida la distancia a costa: se precarga el contorno
  // para no esperar la descarga de 1,5 MB en el primer clic.
  if (tec === "dique") void cargarCosta();
  try {
    aplicarTecnologia(map);
  } catch {
    /* mapa aún sin capas: se aplica en el on(load) */
  }
}

export function tecnologiaActivaMapa(): TecnologiaActiva {
  return tecnologiaMapa;
}

/** Vértices del contorno de costa ya servido en local (el mismo archivo que
 *  dibuja la capa `tierra`), muestreados 1 de cada 4 para que la distancia
 *  mínima en cada clic cueste ~15 mil haversines en vez de 61 mil. */
let costaCache: Promise<Array<readonly [number, number]>> | null = null;

function cargarCosta(): Promise<Array<readonly [number, number]>> {
  costaCache ??= fetch("./datos/costa/contorno_tierra.geojson")
    .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
    .then((j) => {
      const pts: Array<readonly [number, number]> = [];
      let n = 0;
      const anda = (c: unknown): void => {
        if (Array.isArray(c) && typeof c[0] === "number" && typeof c[1] === "number") {
          if (n++ % 4 === 0) pts.push([c[0], c[1]] as const);
          return;
        }
        if (Array.isArray(c)) for (const x of c) anda(x);
      };
      for (const f of j.features ?? []) anda(f.geometry?.coordinates);
      return pts;
    })
    .catch(() => [] as Array<readonly [number, number]>);
  return costaCache;
}

/** Distancia mínima en km desde un punto a la línea de costa. */
export async function distanciaCostaKm(lon: number, lat: number): Promise<number> {
  const pts = await cargarCosta();
  let min = Infinity;
  for (const [x, y] of pts) {
    const d = distanciaKm(lon, lat, x, y);
    if (d < min) min = d;
  }
  return min;
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
    // PMTiles: cada pirámide existe también como datos/gee/<capa>.pmtiles
    // (generado por datos/gee/convertir_a_pmtiles.py). Cuando el protocolo
    // pmtiles registrado arriba está disponible se prefiere
    // pmtiles://./datos/gee/<capa>.pmtiles/{z}/{x}/{y}; si el archivo no
    // existe o el protocolo falla, el source cae al XYZ ./datos/gee/<capa>/
    // {z}/{x}/{y}.png de siempre. Los 4 addSource XYZ se mantienen intactos
    // porque pruebas/test_mapa.py exige esos strings, maxzoom y tileSize.
    const pmtilesUrl = (capa: string): string => `pmtiles://./datos/gee/${capa}.pmtiles/{z}/{x}/{y}`;
    map.addSource("batimetria_sombreada", { type: "raster", tiles: [pmtilesUrl("batimetria_sombreada"), "./datos/gee/batimetria_sombreada/{z}/{x}/{y}.png"], tileSize: 256, maxzoom: 11, attribution: "GEBCO 2023" });
    map.addSource("sentinel2_mediana", { type: "raster", tiles: [pmtilesUrl("sentinel2_mediana"), "./datos/gee/sentinel2_mediana/{z}/{x}/{y}.png"], tileSize: 256, maxzoom: 14, attribution: "Sentinel-2 2023" });
    map.addSource("relieve_sombreado", { type: "raster", tiles: [pmtilesUrl("relieve_sombreado"), "./datos/gee/relieve_sombreado/{z}/{x}/{y}.png"], tileSize: 256, maxzoom: 12, attribution: "Copernicus DEM GLO-30" });
    map.addSource("viirs_nocturno", { type: "raster", tiles: [pmtilesUrl("viirs_nocturno"), "./datos/gee/viirs_nocturno/{z}/{x}/{y}.png"], tileSize: 256, maxzoom: 8, attribution: "VIIRS DNB 2023" });

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
          0, css("--rampa-0", "oklch(0.50 0.09 215)"),
          20, css("--rampa-1", "oklch(0.80 0.14 180)"),
          45, css("--rampa-2", "oklch(0.80 0.16 90)"),
          80, css("--rampa-3", "oklch(0.60 0.19 35)"),
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

    // 2b. Potencial por tecnología activa: sólo una visible a la vez
    // (fijarTecnologiaActiva). Undimotriz pinta densidad kW/m (la malla de
    // arriba); dique pinta rango mareal m desde rango_mareal_esri.json local
    // (FES2014/AVISO, fase 1, sin red); turbina pinta velocidad media m/s
    // desde el resumen GLORYS local (pendiente de ingesta: declara pendiente
    // donde no hay dato, sin inventar velocidades).
    map.addSource("dique_rango", {
      type: "geojson",
      data: { type: "FeatureCollection", features: [] },
      attribution: "FES2014 vía AVISO",
    });
    coleccionRangoMareal().then((d) => {
      const s = map.getSource("dique_rango") as maplibregl.GeoJSONSource | undefined;
      s?.setData(d as never);
    });

    map.addLayer({
      id: "dique_rango_puntos",
      type: "circle",
      source: "dique_rango",
      layout: { visibility: "none" },
      paint: {
        "circle-radius": ["interpolate", ["linear"], ["get", "rango_m"], 0.4, 4, 3.5, 11],
        "circle-color": css("--conf-verificado", "oklch(0.578 0.117 166)"),
        "circle-opacity": 0.8,
        "circle-stroke-width": 1,
        "circle-stroke-color": "rgba(255,255,255,0.7)",
      },
    });

    map.addSource("turbina_corrientes", {
      type: "geojson",
      data: { type: "FeatureCollection", features: [] },
      attribution: "GLORYS12 (pendiente de ingesta)",
    });
    coleccionCorrientes().then((d) => {
      const s = map.getSource("turbina_corrientes") as maplibregl.GeoJSONSource | undefined;
      s?.setData(d as never);
    });

    // Sin velocidad medida la turbina no tiene cifra: anillo pendiente con
    // núcleo tenue (●◐○ adaptado: el estado va en color y en relleno).
    map.addLayer({
      id: "turbina_puntos",
      type: "circle",
      source: "turbina_corrientes",
      layout: { visibility: "none" },
      paint: {
        "circle-radius": 7,
        "circle-color": "rgba(0,0,0,0)",
        "circle-stroke-width": 2,
        "circle-stroke-color": css("--conf-pendiente", "oklch(0.494 0.159 037)"),
      },
    });
    map.addLayer({
      id: "turbina_simbolo",
      type: "circle",
      source: "turbina_corrientes",
      layout: { visibility: "none" },
      paint: {
        "circle-radius": 2.5,
        "circle-color": css("--conf-pendiente", "oklch(0.494 0.159 037)"),
        "circle-opacity": ["match", ["get", "estado"], "verificado", 1, 0.15],
      },
    });

    // 2c. Plantas reales de referencia: marcadores consultables que abren
    // ficha. Operativo = disco sólido; desmantelado = anillo con núcleo
    // tenue (color + forma, nunca sólo color).
    map.addSource("plantas", {
      type: "geojson",
      data: RUTA_PLANTAS,
      attribution: "Operadores y agencias de cada planta",
    });

    map.addLayer({
      id: "plantas_operativas",
      type: "circle",
      source: "plantas",
      filter: ["==", ["get", "estado_operativo"], "operativo"],
      paint: {
        "circle-radius": 5.5,
        "circle-color": css("--conf-verificado", "oklch(0.578 0.117 166)"),
        "circle-opacity": 0.95,
        "circle-stroke-width": 1.5,
        "circle-stroke-color": "rgba(255,255,255,0.9)",
      },
    });
    map.addLayer({
      id: "plantas_retiradas",
      type: "circle",
      source: "plantas",
      filter: ["==", ["get", "estado_operativo"], "desmantelado"],
      paint: {
        "circle-radius": 6.5,
        "circle-color": "rgba(0,0,0,0)",
        "circle-stroke-width": 2.5,
        "circle-stroke-color": css("--conf-pendiente", "oklch(0.494 0.159 037)"),
      },
    });
    map.addLayer({
      id: "plantas_retiradas_nucleo",
      type: "circle",
      source: "plantas",
      filter: ["==", ["get", "estado_operativo"], "desmantelado"],
      paint: {
        "circle-radius": 2,
        "circle-color": css("--conf-pendiente", "oklch(0.494 0.159 037)"),
        "circle-opacity": 0.85,
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

    // Aplica la tecnología que el flujo ya tuviera activa antes de que el
    // mapa cargara (una sola capa de potencial visible, nunca todas).
    aplicarTecnologia(map);
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

  // Dique: rango mareal verificado en m, con su fuente FES2014/AVISO.
  map.on("mousemove", "dique_rango_puntos", (e) => {
    if (!e.features?.[0]) return;
    map.getCanvas().style.cursor = "pointer";
    const p = e.features[0].properties as { nombre?: string; rango_m?: number; fuente?: string; estado?: string };
    popup
      .setLngLat(e.lngLat)
      .setHTML(
        `<div class="popup-cuerpo"><strong>${p.nombre ?? "Punto de rango mareal"}</strong>` +
          fila("valor", `${p.rango_m ?? "—"} m`) +
          fila("fuente", p.fuente ?? "—") +
          fila("estado", p.estado ?? "verificado") +
          `</div>`
      )
      .addTo(map);
  });
  map.on("mouseleave", "dique_rango_puntos", () => {
    map.getCanvas().style.cursor = "";
    popup.remove();
  });

  // Turbina: velocidad media en m/s; hoy la ingesta GLORYS está pendiente y el
  // punto lo dice en vez de inventar una cifra.
  map.on("mousemove", "turbina_puntos", (e) => {
    if (!e.features?.[0]) return;
    map.getCanvas().style.cursor = "pointer";
    const p = e.features[0].properties as { velocidad_ms?: number | null; fuente?: string; estado?: string };
    popup
      .setLngLat(e.lngLat)
      .setHTML(
        `<div class="popup-cuerpo"><strong>Punto de corriente</strong>` +
          fila("valor", p.velocidad_ms != null ? `${p.velocidad_ms} m/s` : "pendiente — sin dato") +
          fila("fuente", p.fuente ?? "—") +
          fila("estado", p.estado ?? "pendiente") +
          `</div>`
      )
      .addTo(map);
  });
  map.on("mouseleave", "turbina_puntos", () => {
    map.getCanvas().style.cursor = "";
    popup.remove();
  });

  // Plantas reales: cada marcador resume potencia instalada, año y estado, y
  // cita su fuente verificable. El clic abre la ficha en la vista.
  const popupPlanta = (props: {
    nombre?: string; potencia_instalada?: number | null; unidad_potencia?: string;
    anio_puesta_en_marcha?: number | null; anio_cierre?: number | null;
    estado_operativo?: string; fuente?: string;
  }) =>
    `<div class="popup-cuerpo"><strong>${props.nombre ?? "Planta"}</strong>` +
    fila(
      "potencia",
      props.potencia_instalada != null ? `${props.potencia_instalada} ${props.unidad_potencia ?? ""}`.trim() : "pendiente — sin dato"
    ) +
    fila(
      "servicio",
      `${props.anio_puesta_en_marcha ?? "—"}${props.anio_cierre != null ? ` – ${props.anio_cierre}` : ""}`
    ) +
    fila("estado", props.estado_operativo === "operativo" ? "operativo ●" : "desmantelado ○") +
    fila("fuente", props.fuente ?? "—") +
    `</div>`;

  for (const capa of ["plantas_operativas", "plantas_retiradas", "plantas_retiradas_nucleo"] as const) {
    map.on("mousemove", capa, (e) => {
      if (!e.features?.[0]) return;
      map.getCanvas().style.cursor = "pointer";
      popup
        .setLngLat(e.lngLat)
        .setHTML(popupPlanta(e.features[0].properties as never))
        .addTo(map);
    });
    map.on("mouseleave", capa, () => {
      map.getCanvas().style.cursor = "";
      popup.remove();
    });
    map.on("click", capa, (e) => {
      if (isDragging) return;
      const props = (e.features?.[0]?.properties ?? {}) as { id?: string };
      if (props.id) map.fire("planta_seleccionada" as never, { id: props.id } as never);
    });
  }

  map.on("click", "emplazamientos", (e) => {
    if (isDragging) return;
    const id = (e.features?.[0]?.properties as { id?: string })?.id;
    if (id) map.fire("sitio_seleccionado" as never, { id } as never);
  });

  // Click en cualquier parte del océano global para posicionar la simulación.
  // En tierra no hay nada que simular: el contorno de Natural Earth ya está
  // dibujado, así que se pregunta a esa misma capa si el punto cae dentro.
  // Con dique activo además se exige costa a menos de DISTANCIA_MAX_DIQUE_COSTA_KM:
  // misma lógica de exclusión que RUNAP, con mensaje físico en vez de genérico.
  map.on("click", (e) => {
    if (isDragging) return;
    if (map.queryRenderedFeatures(e.point, { layers: ["emplazamientos"] }).length > 0) return;
    if (
      map.queryRenderedFeatures(e.point, {
        layers: ["plantas_operativas", "plantas_retiradas", "plantas_retiradas_nucleo"],
      }).length > 0
    )
      return;

    const { lng, lat } = e.lngLat;
    if (map.queryRenderedFeatures(e.point, { layers: ["tierra"] }).length > 0) {
      map.fire("punto_en_tierra" as never, { lon: lng, lat } as never);
      return;
    }
    if (tecnologiaMapa === "dique") {
      void distanciaCostaKm(lng, lat).then((d) => {
        if (d > DISTANCIA_MAX_DIQUE_COSTA_KM) {
          map.fire("dique_rechazado" as never, { lon: lng, lat, distancia_km: d } as never);
        } else {
          map.fire("coordenada_seleccionada" as never, { lon: lng, lat } as never);
        }
      });
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
export { DISTANCIA_MAX_DIQUE_COSTA_KM, MENSAJE_DIQUE_LEJOS } from "./plantas";
export type { TecnologiaActiva } from "./plantas";
