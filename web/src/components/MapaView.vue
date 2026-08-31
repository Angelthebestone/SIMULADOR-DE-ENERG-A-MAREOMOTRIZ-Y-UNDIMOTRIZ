<template>
  <section aria-labelledby="titulo-mapa">
    <h1 id="titulo-mapa" class="titulo-nivel">Mapa</h1>
    <div ref="contenedor" class="mapa" role="application" aria-label="Mapa navegable: arrastra para desplazar, rueda para zoom, pulsa emplazamiento para seleccionar"></div>
    <ListaSitios :sitios="sitios" :activo="sitioActivo" @seleccionar="alSeleccionar" />
    <!-- Panel de capas conmutables: las 6 declaradas en el spec
         (batimetría sombreada, Sentinel-2 mediana, relieve, luces nocturnas,
         RUNAP, sitios). Cada checkbox refleja y modifica el estado del mapa.
         Toggle = sin recálculo: no se llama a /api/simular ni /api/matriz. -->
    <fieldset class="capas-toggle" aria-label="Capas conmutables">
      <legend>Capas</legend>
      <label v-for="c in CAPAS_CONMUTABLES" :key="c.id" class="fila-capa">
        <input
          type="checkbox"
          :checked="visibilidad[c.id] !== 'none'"
          :data-testid="'toggle-' + c.id"
          :aria-label="'Alternar capa ' + c.nombre"
          @change="alToggle(c.id, ($event.target as HTMLInputElement).checked)"
        />
        <span>{{ c.nombre }}</span>
      </label>
    </fieldset>
    <aside class="leyenda" aria-label="Procedencia de las capas">
      <div class="tabla-capas" role="table" aria-label="Procedencia de las capas" data-testid="tabla-capas">
        <div class="fila-capa-dato cabecera" role="row">
          <span role="columnheader">Capa</span>
          <span role="columnheader">Fuente</span>
          <span role="columnheader">Resolución</span>
          <span role="columnheader">Niveles</span>
          <span role="columnheader">Rango</span>
        </div>
        <div v-for="c in CAPAS" :key="c.id" class="fila-capa-dato" role="row">
          <span role="cell"><strong>{{ c.id }}</strong></span>
          <span role="cell">{{ c.fuente }}</span>
          <span role="cell">{{ c.resolucion }}</span>
          <span role="cell">{{ c.niveles.join('–') }}</span>
          <span role="cell">{{ c.rango }}</span>
        </div>
      </div>
      <p class="nota-mapa">Isolínea de 30–60 m alrededor del sitio activo, según GMRT.</p>
    </aside>
  </section>
</template>

<script setup lang="ts">
import { onMounted, reactive, ref } from "vue";
import { crearMapa, flyToSitio, alternarCapa, visibilidadCapa } from "../map/mapa";
import { CAPAS } from "../map/capas";
import ListaSitios from "./ListaSitios.vue";

const contenedor = ref<HTMLElement | null>(null);
let map: ReturnType<typeof crearMapa> | null = null;
const sitioActivo = ref("isla_fuerte");

// Identificadores de las 6 capas conmutables — coinciden con los layer ids
// registrados en `web/src/map/mapa.ts::crearMapa`. RUNAP usa dos layers
// (relleno + borde) que se conmutan juntos.
interface CapaConmutable { id: string; nombre: string; layers: string[] }
const CAPAS_CONMUTABLES: CapaConmutable[] = [
  { id: "batimetria_sombreada", nombre: "Batimetría sombreada", layers: ["batimetria_sombreada"] },
  { id: "sentinel2_mediana", nombre: "Sentinel-2 mediana", layers: ["sentinel2_mediana"] },
  { id: "relieve_sombreado", nombre: "Relieve sombreado", layers: ["relieve_sombreado"] },
  { id: "viirs_nocturno", nombre: "Luces nocturnas (VIIRS)", layers: ["viirs_nocturno"] },
  { id: "runap", nombre: "RUNAP", layers: ["runap_rayado", "runap_borde"] },
  { id: "sitios", nombre: "Emplazamientos", layers: ["emplazamientos", "emplazamientos_simbolo"] },
];

const visibilidad = reactive<Record<string, "visible" | "none">>({});
for (const c of CAPAS_CONMUTABLES) visibilidad[c.id] = "visible";

const sitios = ref([
  { id: "isla_fuerte", nombre: "Isla Fuerte", lon: -76.18, lat: 9.39, valor: 8.9, unidad: "kW/m", fuente: "Ortega et al. 2013", estado: "verificado" },
  { id: "tumbaco", nombre: "Tumaco", lon: -78.912, lat: 1.903, valor: 3.37, unidad: "kW/m", fuente: "ERA5 0,5°", estado: "inferido" },
  { id: "bahia_malaga", nombre: "Bahía Málaga", lon: -77.349, lat: 3.925, valor: null, unidad: "kW/m", fuente: "", estado: "pendiente" },
  { id: "islas_rosario", nombre: "Islas del Rosario", lon: -75.741, lat: 10.235, valor: null, unidad: "kW/m", fuente: "", estado: "pendiente" },
  { id: "san_andres", nombre: "San Andrés", lon: -81.701, lat: 12.569, valor: 8.26, unidad: "kW/m", fuente: "ERA5 0,5°", estado: "inferido" },
]);

onMounted(() => {
  if (!contenedor.value) return;
  map = crearMapa(contenedor.value, sitios.value);
  map.on("load", () => {
    // Refleja el estado inicial (todas visibles) en el reactive map.
    for (const c of CAPAS_CONMUTABLES) {
      for (const layer of c.layers) {
        if (map && map.getLayer(layer)) {
          visibilidad[c.id] = visibilidadCapa(map, layer);
        }
      }
    }
  });
  map.on("sitio_seleccionado" as never, (e: { id: string }) => {
    sitioActivo.value = e.id;
  });
});

function alSeleccionar(id: string) {
  sitioActivo.value = id;
  const s = sitios.value.find((x) => x.id === id);
  if (s && map) flyToSitio(map, s.lon, s.lat);
}

function alToggle(capaId: string, visible: boolean) {
  if (!map) return;
  const def = CAPAS_CONMUTABLES.find((c) => c.id === capaId);
  if (!def) return;
  for (const layer of def.layers) {
    alternarCapa(map, layer, visible);
  }
  visibilidad[capaId] = visible ? "visible" : "none";
}
</script>

<style scoped>
.titulo-nivel { font-size: var(--text-meta); letter-spacing: 0.08em; text-transform: uppercase; color: var(--tenue); }
.mapa { inline-size: 100%; block-size: min(34rem, 62dvh); border: 1px solid var(--borde); border-radius: var(--radio-caja); }
.leyenda { font-size: var(--text-meta); }
.capas-toggle { border: 1px solid var(--borde-suave); border-radius: var(--radio); padding: var(--s-1) var(--s-2); margin: var(--s-2) 0; }
.capas-toggle legend { font-size: var(--text-meta); text-transform: uppercase; letter-spacing: 0.05em; color: var(--tenue); padding: 0 6px; }
.fila-capa { display: inline-flex; align-items: center; gap: 4px; margin-right: var(--s-4); min-block-size: 2rem; font-size: var(--text-cuerpo); }
.fila-capa input[type="checkbox"] { cursor: pointer; inline-size: 1rem; block-size: 1rem; }
.fila-capa input[type="checkbox"]:focus-visible { outline: 2px solid var(--foco); outline-offset: 2px; }

.tabla-capas { border: 1px solid var(--borde-suave); border-radius: var(--radio-caja); overflow: auto; background: var(--panel); }
.fila-capa-dato {
  display: grid;
  grid-template-columns: minmax(9rem, 1fr) minmax(8rem, 2fr) minmax(6rem, 1fr) minmax(4rem, auto) minmax(6rem, 1fr);
  gap: var(--s-2);
  padding: 4px var(--s-2);
  border-bottom: 1px solid var(--borde-suave);
  font-family: var(--font-mono);
}
.fila-capa-dato:last-child { border-bottom: none; }
.fila-capa-dato.cabecera {
  font-family: var(--font-sans);
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--tenue);
  background: var(--superficie);
}
.nota-mapa { color: var(--tenue); margin: var(--s-1) 0 0; }
@media (max-width: 40rem) { .fila-capa-dato { grid-template-columns: 1fr; row-gap: 2px; } }
</style>