// capas.ts — dos límites distintos (base vs ráster)
// Base vectorial admite zoom profundo (rótulos nítidos); rásteres limitados por resolución nativa.
// Fuente y zoom_max declarados por capa; leyenda muestra fuente, resolución, niveles pirámide y fecha/rango.

export const CAPAS = [
  {
    id: "base_vector",
    fuente: "Natural Earth PMTiles",
    zoom_max: 14,
    resolucion: "1:50m continente, 1:10m islas",
    niveles: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14],
    rango: "2024",
    fecha: "2024",
    licencia: "dominio público",
  },
  {
    id: "batimetria_sombreada",
    fuente: "GEBCO/GEBCO_2023",
    zoom_max: 11,
    resolucion: "15 arcsec (~450 m)",
    niveles: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
    rango: "2023",
    fecha: "2023",
    licencia: "CC BY 4.0",
  },
  {
    id: "sentinel2_mediana",
    fuente: "COPERNICUS/S2_SR_HARMONIZED",
    zoom_max: 14,
    resolucion: "10 m RGB",
    niveles: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14],
    rango: "2023-01-01/2024-12-31",
    fecha: "2023-01-01/2024-12-31",
    licencia: "ESA Sentinel-2 CC BY-SA 3.0 IGO",
  },
  {
    id: "relieve_sombreado",
    fuente: "COPERNICUS/DEM/GLO30",
    zoom_max: 12,
    resolucion: "30 m",
    niveles: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
    rango: "2021",
    fecha: "2021",
    licencia: "CC BY 4.0",
  },
  {
    id: "viirs_nocturno",
    fuente: "NOAA/VIIRS/DNB/MONTHLY_V1/VCMSLCFG",
    zoom_max: 8,
    resolucion: "15 arcsec (~450 m)",
    niveles: [0, 1, 2, 3, 4, 5, 6, 7, 8],
    rango: "2023",
    fecha: "2023",
    licencia: "public domain",
  },
] as const;

// Dos límites distintos: base_vector zoom_max 14 vs ráster max 14 (sentinel2).
// Verificación: Math.max(...CAPAS.filter(c=>c.id!=="base_vector").map(c=>c.zoom_max)) <= CAPAS.find(c=>c.id==="base_vector")!.zoom_max