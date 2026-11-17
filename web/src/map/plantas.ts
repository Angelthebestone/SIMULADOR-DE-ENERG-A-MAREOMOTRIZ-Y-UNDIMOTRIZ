// plantas.ts — catálogo de plantas reales sobre el mapa.
//
// Lee `datos/plantas/plantas_mundiales.geojson` (local, versionado, sin red)
// y lo expone como lista tipada para que mapa.ts pinte los marcadores y
// MapaView.vue abra la ficha. Ningún dato se inventa aquí: cada planta trae
// su fuente verificable y, si un campo no tiene fuente, `null` con
// `pendiente_verificacion: true`.

export type TecnologiaPlanta = "undimotriz" | "dique" | "turbina";
export type EstadoPlanta = "operativo" | "desmantelado";

/** Tecnología activa del flujo: decide qué capa de potencial se pinta.
 *  Nunca se pintan varias a la vez. */
export type TecnologiaActiva = TecnologiaPlanta;

export type PlantaMundial = {
  id: string;
  nombre: string;
  lon: number;
  lat: number;
  tecnologia: TecnologiaPlanta;
  potencia_instalada: number | null;
  unidad_potencia: string;
  anio_puesta_en_marcha: number | null;
  anio_cierre: number | null;
  estado_operativo: EstadoPlanta;
  fuente: string;
  fuente_url: string;
  catalogo: string | null;
  fracaso: string | null;
  operador: string | null;
  nota: string | null;
  pendiente_verificacion: boolean;
};

export const RUTA_PLANTAS = "./datos/plantas/plantas_mundiales.geojson";

/** Distancia máxima a la costa para aceptar un punto de dique mareal, en km.
 *  Un dique necesita encerrar una bahía o un estuario: en mar abierto no hay
 *  con qué cerrar el embalse. Exportada para que la vista la muestre y las
 *  pruebas la lean sin duplicar el valor. */
export const DISTANCIA_MAX_DIQUE_COSTA_KM = 30;

export const MENSAJE_DIQUE_LEJOS =
  "un dique necesita encerrar una bahía o un estuario: en mar abierto no hay con qué cerrar el embalse";

let plantasCache: Promise<PlantaMundial[]> | null = null;

function esPlantaValida(p: unknown): p is PlantaMundial {
  if (typeof p !== "object" || p === null) return false;
  const q = p as Record<string, unknown>;
  return (
    typeof q.id === "string" &&
    typeof q.nombre === "string" &&
    typeof q.lon === "number" &&
    typeof q.lat === "number" &&
    (q.tecnologia === "undimotriz" || q.tecnologia === "dique" || q.tecnologia === "turbina") &&
    (q.estado_operativo === "operativo" || q.estado_operativo === "desmantelado") &&
    typeof q.fuente === "string"
  );
}

/** Carga local del catálogo. Sin red: si el archivo falta, devuelve lista
 *  vacía en vez de inventar plantas. */
export function cargarPlantas(): Promise<PlantaMundial[]> {
  plantasCache ??= fetch(RUTA_PLANTAS)
    .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
    .then((j) => {
      const rasgos: unknown[] = Array.isArray(j?.features) ? j.features : [];
      const plantas: PlantaMundial[] = [];
      for (const f of rasgos) {
        const g = (f as { geometry?: { coordinates?: unknown } })?.geometry;
        const pr = (f as { properties?: Record<string, unknown> })?.properties ?? {};
        const coords = Array.isArray(g?.coordinates) ? (g.coordinates as unknown[]) : [];
        const candidata = {
          ...pr,
          lon: Number(coords[0]),
          lat: Number(coords[1]),
        };
        if (esPlantaValida(candidata)) plantas.push(candidata as PlantaMundial);
      }
      return plantas;
    })
    .catch(() => [] as PlantaMundial[]);
  return plantasCache;
}

/** Colección GeoJSON para la fuente `plantas` del mapa. */
export function coleccionPlantas(plantas: PlantaMundial[]) {
  return {
    type: "FeatureCollection" as const,
    features: plantas.map((p) => ({
      type: "Feature" as const,
      geometry: { type: "Point" as const, coordinates: [p.lon, p.lat] },
      properties: {
        id: p.id,
        nombre: p.nombre,
        tecnologia: p.tecnologia,
        potencia_instalada: p.potencia_instalada,
        unidad_potencia: p.unidad_potencia,
        anio_puesta_en_marcha: p.anio_puesta_en_marcha,
        anio_cierre: p.anio_cierre,
        estado_operativo: p.estado_operativo,
        fuente: p.fuente,
        catalogo: p.catalogo,
        fracaso: p.fracaso,
      },
    })),
  };
}
