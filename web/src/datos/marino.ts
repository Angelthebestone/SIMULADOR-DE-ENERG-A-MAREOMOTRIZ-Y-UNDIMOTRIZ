// Consulta del recurso marino en un punto cualquiera del océano.
//
// Vía única: malla local `datos/oleaje/potencial_oleaje_global.geojson`,
// compuesta por `datos/oleaje/descargar_potencial_global.py` desde el
// reanálisis. Es la vía sin conexión: el simulador NUNCA consulta red en
// ejecución (documentacion/aislamiento_red.md, CSP default-src 'self').
//
// Si la malla no cubre ese punto, queda `pendiente`: el simulador no inventa
// una cifra de recurso para pintar algo.

const MALLA_LOCAL = "./datos/oleaje/potencial_oleaje_global.geojson";
const MAREAS_LOCAL = "./datos/mareas/hotspots_mareales.geojson";
// Rango mareal verificado por tesela FES2014/AVISO (fase 1, local, sin red).
const RANGO_MAREAL_LOCAL = "./datos/mareas/rango_mareal_esri.json";
// GLORYS12 1/12° (fase 1, local, sin red). Pendiente de ingesta real.
const CORRIENTES_GLORYS_LOCAL = "./datos/cmems/resumen_corrientes_glorys.json";

/** J = ρ g² Hm0² Te / (64π) — W por metro de frente de ola en aguas profundas.
 *  Constantes internas del cálculo offline que compuso la malla; se conserva
 *  la fórmula aquí para documentar de dónde salen los kW/m de la malla. */
export function densidadPotenciaWm(hm0: number, te: number): number {
  const RHO = 1025;
  const G = 9.81;
  return (RHO * G * G * hm0 * hm0 * te) / (64 * Math.PI);
}

export type RecursoOleaje = {
  hm0_m: number;
  te_s: number;
  kw_m: number;
  fuente: string;
  estado: "verificado" | "inferido" | "pendiente";
};

export type RecursoMarea = {
  rango_m: number;
  velocidad_ms: number;
  nombre: string;
  fuente: string;
  distancia_km: number;
};

/** Rango mareal verificado de un sitio de fase 1 (FES2014/AVISO, local).
 *  Dique pinta con estos valores; fuera de los 5 sitios no hay dato. */
export type RecursoRangoMareal = {
  rango_m: number;
  nombre: string;
  fuente: string;
  estado: "verificado" | "pendiente";
  distancia_km: number;
};

type PuntoRangoMareal = { id: string; lon: number; lat: number; rango_m: number; nombre: string };

/** Velocidad media de corriente GLORYS12 en un sitio de fase 1.
 *  Hoy la ingesta está pendiente (registros 0): se declara así, sin inventar. */
export type RecursoCorriente = {
  velocidad_ms: number | null;
  fuente: string;
  estado: "verificado" | "pendiente";
  distancia_km: number;
};

type PuntoMalla = { lon: number; lat: number; kw_m: number; hm0_m: number; te_s: number };

let mallaCache: Promise<PuntoMalla[]> | null = null;
let mareasCache: Promise<RecursoMarea[]> | null = null;
let rangoMarealCache: Promise<PuntoRangoMareal[]> | null = null;
let corrientesCache: Promise<{ velocidad_ms: number | null; estado: "verificado" | "pendiente"; lon: number; lat: number }[]> | null = null;

async function cargarMalla(): Promise<PuntoMalla[]> {
  mallaCache ??= fetch(MALLA_LOCAL)
    .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
    .then((j) =>
      (j.features ?? []).map((f: any) => ({
        lon: f.geometry.coordinates[0],
        lat: f.geometry.coordinates[1],
        kw_m: f.properties.oleaje_kw_m,
        hm0_m: f.properties.hm0_m,
        te_s: f.properties.te_s,
      }))
    )
    .catch(() => [] as PuntoMalla[]);
  return mallaCache;
}

async function cargarMareas(): Promise<RecursoMarea[]> {
  mareasCache ??= fetch(MAREAS_LOCAL)
    .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
    .then((j) =>
      (j.features ?? []).map((f: any) => ({
        rango_m: f.properties.rango_m,
        velocidad_ms: f.properties.velocidad_ms,
        nombre: f.properties.nombre,
        fuente: f.properties.fuente,
        distancia_km: 0,
        lon: f.geometry.coordinates[0],
        lat: f.geometry.coordinates[1],
      }))
    )
    .catch(() => []);
  return mareasCache as Promise<RecursoMarea[]>;
}

/** Distancia en km por la fórmula del haversine — sirve para decidir cuál es la
 *  celda más próxima y para declarar a qué distancia está el dato. */
export function distanciaKm(lon1: number, lat1: number, lon2: number, lat2: number): number {
  const R = 6371;
  const rad = Math.PI / 180;
  const dLat = (lat2 - lat1) * rad;
  const dLon = (lon2 - lon1) * rad;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(a)));
}

/** Recurso undimotriz en un punto: la malla local de reanálisis. Devuelve
 *  `estado: "pendiente"` sin cifras cuando la malla no cubre ese punto. */
export async function consultarOleaje(lon: number, lat: number): Promise<RecursoOleaje> {
  const malla = await cargarMalla();
  let mejor: PuntoMalla | null = null;
  let mejorKm = Infinity;
  for (const p of malla) {
    const d = distanciaKm(lon, lat, p.lon, p.lat);
    if (d < mejorKm) {
      mejorKm = d;
      mejor = p;
    }
  }
  // La malla es de 8°: más allá de ~600 km la celda ya no describe este punto.
  if (mejor && mejorKm <= 600) {
    return {
      hm0_m: mejor.hm0_m,
      te_s: mejor.te_s,
      kw_m: mejor.kw_m,
      fuente: `malla local de reanálisis, celda a ${mejorKm.toFixed(0)} km`,
      estado: "inferido",
    };
  }

  return { hm0_m: 0, te_s: 0, kw_m: 0, fuente: "sin fuente para este punto", estado: "pendiente" };
}

/** Marea en un punto: sólo si hay un emplazamiento mareal documentado cerca.
 *  Fuera de esos puntos no hay dato y se declara así, sin interpolar. */
export async function consultarMarea(lon: number, lat: number): Promise<RecursoMarea | null> {
  const puntos = (await cargarMareas()) as (RecursoMarea & { lon: number; lat: number })[];
  let mejor: (RecursoMarea & { lon: number; lat: number }) | null = null;
  let mejorKm = Infinity;
  for (const p of puntos) {
    const d = distanciaKm(lon, lat, p.lon, p.lat);
    if (d < mejorKm) {
      mejorKm = d;
      mejor = p;
    }
  }
  if (!mejor || mejorKm > 250) return null;
  return { ...mejor, distancia_km: Number(mejorKm.toFixed(0)) };
}

/** Carga local del rango mareal verificado de fase 1 (FES2014/AVISO,
 *  2*(M2+S2+K1+O1)). Sin red: el mapa de dique nunca llama al servicio. */
async function cargarRangoMareal(): Promise<PuntoRangoMareal[]> {
  rangoMarealCache ??= fetch(RANGO_MAREAL_LOCAL)
    .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
    .then((j) =>
      Object.entries(j ?? {})
        .filter(([id]) => !id.startsWith("_"))
        .map(([id, v]: [string, any]) => ({
          id,
          lon: Number(v.lon),
          lat: Number(v.lat),
          rango_m: Number(v.rango_m),
          nombre: String(v.nombre ?? id),
        }))
    )
    .catch(() => [] as PuntoRangoMareal[]);
  return rangoMarealCache;
}

/** Rango mareal en un punto (tecnología dique): sólo hay dato verificado en
 *  los 5 sitios de fase 1. Fuera de ellos se declara pendiente, sin interpolar. */
export async function consultarRangoMareal(lon: number, lat: number): Promise<RecursoRangoMareal> {
  const puntos = await cargarRangoMareal();
  let mejor: PuntoRangoMareal | null = null;
  let mejorKm = Infinity;
  for (const p of puntos) {
    const d = distanciaKm(lon, lat, p.lon, p.lat);
    if (d < mejorKm) {
      mejorKm = d;
      mejor = p;
    }
  }
  if (mejor && mejorKm <= 250) {
    return {
      rango_m: mejor.rango_m,
      nombre: mejor.nombre,
      fuente: `FES2014 vía AVISO (${mejor.nombre}, a ${mejorKm.toFixed(0)} km)`,
      estado: "verificado",
      distancia_km: Number(mejorKm.toFixed(0)),
    };
  }
  return {
    rango_m: 0,
    nombre: "",
    fuente: "sin campaña de rango mareal en este punto",
    estado: "pendiente",
    distancia_km: Number(mejorKm.toFixed(0)),
  };
}

/** Carga local del resumen GLORYS12 de corrientes (fase 1, sin red). */
async function cargarCorrientes(): Promise<
  { velocidad_ms: number | null; estado: "verificado" | "pendiente"; lon: number; lat: number }[]
> {
  corrientesCache ??= fetch(CORRIENTES_GLORYS_LOCAL)
    .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
    .then((j) =>
      Object.values(j ?? {}).map((v: any) => ({
        velocidad_ms: Number(v.velocidad_media_ms) > 0 ? Number(v.velocidad_media_ms) : null,
        estado: (v.estado === "verificado" ? "verificado" : "pendiente") as "verificado" | "pendiente",
        lon: Number(v.lon_celda ?? v.lon_solicitada),
        lat: Number(v.lat_celda ?? v.lat_solicitada),
      }))
    )
    .catch(() => []);
  return corrientesCache;
}

/** Corriente media en un punto (tecnología turbina): hoy la ingesta GLORYS
 *  está pendiente (registros 0), así que se declara pendiente donde no hay
 *  dato y NO se inventa ninguna velocidad. */
export async function consultarCorriente(lon: number, lat: number): Promise<RecursoCorriente> {
  const puntos = await cargarCorrientes();
  let mejor: { velocidad_ms: number | null; estado: "verificado" | "pendiente"; lon: number; lat: number } | null = null;
  let mejorKm = Infinity;
  for (const p of puntos) {
    const d = distanciaKm(lon, lat, p.lon, p.lat);
    if (d < mejorKm) {
      mejorKm = d;
      mejor = p;
    }
  }
  if (mejor && mejorKm <= 250 && mejor.velocidad_ms != null && mejor.estado === "verificado") {
    return {
      velocidad_ms: mejor.velocidad_ms,
      fuente: `GLORYS12 1/12°, celda a ${mejorKm.toFixed(0)} km`,
      estado: "verificado",
      distancia_km: Number(mejorKm.toFixed(0)),
    };
  }
  return {
    velocidad_ms: null,
    fuente: "corriente GLORYS pendiente de ingesta en este punto",
    estado: "pendiente",
    distancia_km: Number.isFinite(mejorKm) ? Number(mejorKm.toFixed(0)) : -1,
  };
}

/** Puntos de rango mareal verificados para la capa de dique (local, sin red).
 *  Dibuja sólo donde hay dato: los 5 sitios de fase 1. */
export async function coleccionRangoMareal() {
  const puntos = await cargarRangoMareal();
  return {
    type: "FeatureCollection" as const,
    features: puntos.map((p) => ({
      type: "Feature" as const,
      geometry: { type: "Point" as const, coordinates: [p.lon, p.lat] },
      properties: {
        id: p.id,
        nombre: p.nombre,
        rango_m: p.rango_m,
        fuente: "FES2014 vía AVISO, 2*(M2+S2+K1+O1)",
        estado: "verificado",
      },
    })),
  };
}

/** Puntos de corriente para la capa de turbina (local, sin red).
 *  Hoy la ingesta GLORYS está pendiente: cada punto declara su estado y el
 *  mapa pinta «pendiente» en vez de inventar una velocidad. */
export async function coleccionCorrientes() {
  const puntos = await cargarCorrientes();
  return {
    type: "FeatureCollection" as const,
    features: puntos.map((p, i) => ({
      type: "Feature" as const,
      geometry: { type: "Point" as const, coordinates: [p.lon, p.lat] },
      properties: {
        id: `glorys_${i}`,
        velocidad_ms: p.velocidad_ms,
        fuente: "GLORYS12 1/12° (pendiente de ingesta)",
        estado: p.estado,
      },
    })),
  };
}

/** Recurso global del punto libre: ola, rango de marea y pico de corriente de la
 *  celda de mar más próxima (datos/marino/descargar_recurso_global.py). */
export type RecursoGlobal = {
  hm0_m: number | null;
  te_s: number | null;
  rango_m: number | null;
  pico_ms: number | null;
  distancia_km: number;
  fuente: string;
};

type MallaGlobal = { fuente: string; periodo: string; puntos: (number | null)[][] };

const RECURSO_GLOBAL = "./datos/marino/recurso_global.json";
// La ola cambia poco en cientos de km de mar abierto; la marea y la corriente
// cambian de una ensenada a la siguiente, así que solo valen muy cerca.
const MAX_KM_OLEAJE = 400;
const MAX_KM_MAREA = 100;

let globalCache: Promise<MallaGlobal | null> | null = null;

function cargarGlobal(): Promise<MallaGlobal | null> {
  globalCache ??= fetch(RECURSO_GLOBAL)
    .then((r) => (r.ok ? (r.json() as Promise<MallaGlobal>) : null))
    .catch(() => null);
  return globalCache;
}

export async function consultarRecursoGlobal(lon: number, lat: number): Promise<RecursoGlobal | null> {
  const malla = await cargarGlobal();
  if (!malla) return null;
  let mejor: (number | null)[] | null = null;
  let mejorKm = Infinity;
  for (const p of malla.puntos) {
    const d = distanciaKm(lon, lat, p[0] as number, p[1] as number);
    if (d < mejorKm) {
      mejorKm = d;
      mejor = p;
    }
  }
  if (!mejor) return null;
  const [, , hm0, te, , rango, pico] = mejor;
  const olaCerca = mejorKm <= MAX_KM_OLEAJE;
  const mareaCerca = mejorKm <= MAX_KM_MAREA;
  return {
    hm0_m: olaCerca ? hm0 : null,
    te_s: olaCerca ? te : null,
    rango_m: mareaCerca ? rango : null,
    pico_ms: mareaCerca ? pico : null,
    distancia_km: Math.round(mejorKm),
    fuente: `${malla.fuente}, ${malla.periodo}; celda a ${Math.round(mejorKm)} km`,
  };
}
