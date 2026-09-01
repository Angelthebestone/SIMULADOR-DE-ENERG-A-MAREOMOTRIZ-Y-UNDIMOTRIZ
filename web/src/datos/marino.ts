// Consulta del recurso marino en un punto cualquiera del océano.
//
// Dos vías, en este orden:
//   1. Reanálisis en vivo (Open-Meteo Marine, que sirve ERA5-Ocean y MFWAM):
//      serie horaria real de Hm0 y Te de los últimos días en ese punto.
//   2. Malla local `datos/oleaje/potencial_oleaje_global.geojson`, compuesta
//      por `datos/oleaje/descargar_potencial_global.py` desde el mismo
//      reanálisis. Es la vía sin conexión.
//
// Si ninguna responde, el punto queda `pendiente`: el simulador no inventa una
// cifra de recurso para pintar algo.

const API_OLEAJE = "https://marine-api.open-meteo.com/v1/marine";
const MALLA_LOCAL = "./datos/oleaje/potencial_oleaje_global.geojson";
const MAREAS_LOCAL = "./datos/mareas/hotspots_mareales.geojson";

const RHO = 1025;
const G = 9.81;

/** J = ρ g² Hm0² Te / (64π) — W por metro de frente de ola en aguas profundas. */
export function densidadPotenciaWm(hm0: number, te: number): number {
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

type PuntoMalla = { lon: number; lat: number; kw_m: number; hm0_m: number; te_s: number };

let mallaCache: Promise<PuntoMalla[]> | null = null;
let mareasCache: Promise<RecursoMarea[]> | null = null;

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

async function consultarEnVivo(lon: number, lat: number): Promise<RecursoOleaje | null> {
  const consulta = new URLSearchParams({
    latitude: lat.toFixed(3),
    longitude: lon.toFixed(3),
    hourly: "wave_height,wave_period",
    past_days: "7",
    forecast_days: "1",
    timezone: "UTC",
  });
  const control = new AbortController();
  const corte = setTimeout(() => control.abort(), 8000);
  try {
    const respuesta = await fetch(`${API_OLEAJE}?${consulta}`, { signal: control.signal });
    if (!respuesta.ok) return null;
    const cuerpo = await respuesta.json();
    const alturas: (number | null)[] = cuerpo?.hourly?.wave_height ?? [];
    const periodos: (number | null)[] = cuerpo?.hourly?.wave_period ?? [];
    const js: number[] = [];
    const hs: number[] = [];
    const ts: number[] = [];
    for (let i = 0; i < alturas.length; i++) {
      const h = alturas[i];
      const p = periodos[i];
      if (h == null || p == null || p <= 0) continue;
      js.push(densidadPotenciaWm(h, p));
      hs.push(h);
      ts.push(p);
    }
    // Menos de un día de horas válidas es tierra o hielo, no un punto de mar.
    if (js.length < 24) return null;
    const media = (v: number[]) => v.reduce((a, b) => a + b, 0) / v.length;
    return {
      hm0_m: Number(media(hs).toFixed(2)),
      te_s: Number(media(ts).toFixed(2)),
      kw_m: Number((media(js) / 1000).toFixed(2)),
      fuente: "Open-Meteo Marine (ERA5-Ocean / MFWAM), media de 7 días",
      estado: "inferido",
    };
  } catch {
    return null;
  } finally {
    clearTimeout(corte);
  }
}

/** Recurso undimotriz en un punto. Devuelve `estado: "pendiente"` sin cifras
 *  cuando ni el reanálisis en vivo ni la malla local cubren ese punto. */
export async function consultarOleaje(lon: number, lat: number): Promise<RecursoOleaje> {
  const vivo = await consultarEnVivo(lon, lat);
  if (vivo) return vivo;

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
