<template>
  <section aria-label="Mapa de potencial">
    <div ref="contenedor" class="mapa" role="application" aria-label="Mapa navegable: arrastra para desplazar, rueda para zoom, pulsa emplazamiento para seleccionar"></div>
    <ListaSitios :sitios="sitios" :activo="sitioActivo" @seleccionar="alSeleccionar" />
    <aside class="leyenda" aria-label="Leyenda de capas">
      <h3>Capas</h3>
      <ul>
        <li v-for="c in CAPAS" :key="c.id">
          <strong>{{ c.id }}</strong> — {{ c.fuente }} · {{ c.resolucion }} · niveles {{ c.niveles.join(',') }} · {{ c.rango }}
        </li>
      </ul>
      <p>Banda 30–60 m identificable alrededor de sitio activo via GMRT (isolínea 30–60 m).</p>
      <p>Isla Fuerte sin iluminación apreciable frente a continente iluminado — VIIRS como apoyo visual.</p>
    </aside>
  </section>
</template>

<script setup lang="ts">
import { onMounted, ref } from "vue";
import { crearMapa, flyToSitio } from "../map/mapa";
import { CAPAS } from "../map/capas";
import ListaSitios from "./ListaSitios.vue";

const contenedor = ref<HTMLElement | null>(null);
let map: ReturnType<typeof crearMapa> | null = null;
const sitioActivo = ref("isla_fuerte");
const sitios = ref([
  { id: "isla_fuerte", nombre: "Isla Fuerte", lon: -76.18, lat: 9.39, valor: 8.9, unidad: "kW/m", fuente: "Ortega et al. 2013", estado: "verificado" },
  { id: "tumbaco", nombre: "Tumaco", lon: -78.912, lat: 1.903, valor: 3.37, unidad: "kW/m", fuente: "ERA5 0,5°", estado: "inferido" },
  { id: "bahia_malaga", nombre: "Bahía Málaga", lon: -77.349, lat: 3.925, valor: null, unidad: "kW/m", fuente: "", estado: "pendiente" },
  { id: "islas_rosario", nombre: "Islas del Rosario", lon: -75.741, lat: 10.235, valor: null, unidad: "kW/m", fuente: "", estado: "pendiente" },
  { id: "san_andres", nombre: "San Andrés", lon: -81.701, lat: 12.569, valor: 8.26, unidad: "kW/m", fuente: "ERA5 0,5°", estado: "inferido" },
]);

onMounted(() => {
  if (!contenedor.value) return;
  map = crearMapa(contenedor.value);
  map.on("sitio_seleccionado" as never, (e: { id: string }) => {
    sitioActivo.value = e.id;
  });
});

function alSeleccionar(id: string) {
  sitioActivo.value = id;
  const s = sitios.value.find((x) => x.id === id);
  if (s && map) flyToSitio(map, s.lon, s.lat);
}
</script>

<style scoped>
.mapa { width: 100%; height: 520px; }
/* Tipografía local: sin fetch remoto */
* { font-family: "Segoe UI", system-ui, sans-serif; }
.leyenda { font-size: 12px; }
</style>
