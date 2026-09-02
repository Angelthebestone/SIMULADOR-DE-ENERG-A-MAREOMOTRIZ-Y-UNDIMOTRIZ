<template>
  <section class="mapa-seccion" aria-labelledby="titulo-mapa">
    <h1 id="titulo-mapa" class="rotulo-oculto">Carta mundial de recurso marino</h1>

    <!-- Carta: arriba, con la leyenda del recurso encima y nada más. -->
    <div class="carta">
      <div
        ref="contenedor"
        class="mapa"
        role="application"
        aria-label="Mapa navegable mundial: arrastra para desplazar, rueda para zoom, pulsa cualquier zona marina para simular"
      ></div>

      <div class="escala" aria-label="Leyenda: potencia del frente de ola">
        <div class="escala-titulo">Frente de ola</div>
        <div class="escala-barra"></div>
        <div class="escala-topes"><span>0</span><span>20</span><span>45</span><span>80+ kW/m</span></div>
      </div>

      <p v-if="consultando" class="estado-carta">
        <Icono icono="calculando" tamano="sm" />
        <span>consultando el reanálisis en ese punto…</span>
      </p>
      <p v-else-if="avisoTierra" class="estado-carta" role="status">
        <Icono icono="pendiente" tamano="sm" />
        <span>{{ avisoTierra }}</span>
      </p>
    </div>

    <!-- Ficha del emplazamiento activo: la selección se hace en la carta, así
         que la lista y los filtros de región desaparecieron. -->
    <div v-if="sitioActual" class="ficha-sitio">
      <div class="ficha-cabecera">
        <div>
          <span class="ficha-tag">{{ sitioActual.pais || "Océano global" }}</span>
          <h2 class="ficha-titulo">{{ sitioActual.nombre }}</h2>
        </div>
        <span class="semaforo" :class="'semaforo--' + sitioActual.estado">
          <span class="semaforo__simbolo" :class="'semaforo__simbolo--' + sitioActual.estado" aria-hidden="true"></span>
          <span>{{ sitioActual.estado }}</span>
        </span>
      </div>

      <dl class="ficha-metricas">
        <div v-for="m in metricasSitio" :key="m.rotulo" class="metrica">
          <dt>{{ m.rotulo }}</dt>
          <dd :data-pendiente="m.valor === null ? '' : null">
            <template v-if="m.valor !== null">{{ m.valor }} <span class="metrica-unidad">{{ m.unidad }}</span></template>
            <template v-else>sin dato</template>
          </dd>
        </div>
      </dl>

      <p class="ficha-fuente">{{ sitioActual.fuente }}</p>

      <button class="btn-simular" @click="confirmarSeleccionYSimular">
        <span>Simular este emplazamiento</span>
        <Icono icono="eslabon" tamano="sm" />
      </button>
    </div>
  </section>
</template>

<script setup lang="ts">
import { onMounted, ref, computed, watch } from "vue";
import { crearMapa, flyToSitio, actualizarSitios, type SitioMapa } from "../map/mapa";
import { consultarOleaje, consultarMarea } from "../datos/marino";
import { formatearNumero } from "../utils/formato";
import Icono from "./Icono.vue";

const props = defineProps<{
  /** Emplazamiento que la carcasa tiene activo, para que la carta lo refleje. */
  sitioActivo?: string;
}>();

const emit = defineEmits<{
  (e: "seleccionar-sitio", s: SitioMapa): void;
  (e: "ir-a-simulador", s: SitioMapa): void;
}>();

const contenedor = ref<HTMLElement | null>(null);
let map: ReturnType<typeof crearMapa> | null = null;
const sitioActivoLocal = ref(props.sitioActivo ?? "isla_fuerte");
const consultando = ref(false);
const avisoTierra = ref("");
let temporizadorAviso = 0 as unknown as ReturnType<typeof setTimeout>;

const sitios = ref<SitioMapa[]>([
  // Colombia
  { id: "isla_fuerte", nombre: "Isla Fuerte", pais: "Colombia", region: "colombia", lon: -76.18, lat: 9.39, valor: 8.9, unidad: "kW/m", fuente: "Ortega et al. 2013", estado: "verificado", tipo: "undimotriz", hm0_m: 1.5, te_s: 7.0, rango_m: 0.4, velocidad_ms: 0.3, profundidad_m: 30 },
  { id: "san_andres", nombre: "San Andrés", pais: "Colombia", region: "colombia", lon: -81.701, lat: 12.569, valor: 8.26, unidad: "kW/m", fuente: "ERA5 0,5°", estado: "inferido", tipo: "undimotriz", hm0_m: 1.6, te_s: 6.8, rango_m: 0.3, velocidad_ms: 0.4, profundidad_m: 45 },
  { id: "tumaco", nombre: "Tumaco", pais: "Colombia", region: "colombia", lon: -78.912, lat: 1.903, valor: 3.37, unidad: "kW/m", fuente: "ERA5 0,5° / FES2014", estado: "inferido", tipo: "mareomotriz", hm0_m: 1.2, te_s: 8.5, rango_m: 3.8, velocidad_ms: 1.6, profundidad_m: 25 },
  { id: "bahia_malaga", nombre: "Bahía Málaga", pais: "Colombia", region: "colombia", lon: -77.349, lat: 3.925, valor: 2.8, unidad: "kW/m", fuente: "DIMAR / CIOH", estado: "inferido", tipo: "mareomotriz", hm0_m: 1.1, te_s: 8.8, rango_m: 4.2, velocidad_ms: 2.2, profundidad_m: 20 },
  { id: "islas_rosario", nombre: "Islas del Rosario", pais: "Colombia", region: "colombia", lon: -75.741, lat: 10.235, valor: null, unidad: "kW/m", fuente: "sin campaña de oleaje publicada", estado: "pendiente", tipo: "undimotriz", te_s: 6.5, rango_m: 0.4, velocidad_ms: 0.3, profundidad_m: 35 },
  { id: "puerto_bolivar", nombre: "La Guajira (Puerto Bolívar)", pais: "Colombia", region: "colombia", lon: -71.97, lat: 12.24, valor: 14.8, unidad: "kW/m", fuente: "CIOH / ERA5", estado: "inferido", tipo: "undimotriz", hm0_m: 2.2, te_s: 6.2, rango_m: 0.5, velocidad_ms: 0.6, profundidad_m: 32 },

  // América
  { id: "bahia_fundy", nombre: "Bahía de Fundy (Minas Passage)", pais: "Canadá", region: "america", lon: -64.4, lat: 45.36, valor: 24.5, unidad: "kW/m", fuente: "FORCE Canada / NOAA", estado: "verificado", tipo: "mareomotriz", hm0_m: 0.8, te_s: 5.0, rango_m: 16.0, velocidad_ms: 5.2, profundidad_m: 42 },
  { id: "estrecho_magallanes", nombre: "Estrecho de Magallanes", pais: "Chile", region: "america", lon: -70.52, lat: -52.85, valor: 72.0, unidad: "kW/m", fuente: "Univ. Magallanes", estado: "verificado", tipo: "mareomotriz", hm0_m: 3.2, te_s: 9.8, rango_m: 7.8, velocidad_ms: 4.2, profundidad_m: 50 },
  { id: "golfo_san_jose", nombre: "Golfo San José (Península Valdés)", pais: "Argentina", region: "america", lon: -64.25, lat: -42.42, valor: 35.0, unidad: "kW/m", fuente: "CNEA Argentina", estado: "verificado", tipo: "mareomotriz", hm0_m: 1.4, te_s: 6.5, rango_m: 9.1, velocidad_ms: 3.4, profundidad_m: 30 },
  { id: "oregon_coast", nombre: "PacWave (Costa de Oregón)", pais: "EE.UU.", region: "america", lon: -124.12, lat: 44.58, valor: 42.0, unidad: "kW/m", fuente: "US DOE / PacWave", estado: "verificado", tipo: "undimotriz", hm0_m: 2.5, te_s: 9.0, rango_m: 2.4, velocidad_ms: 0.7, profundidad_m: 40 },
  { id: "hawaii_oahu", nombre: "Kaneohe Bay (Oahu)", pais: "EE.UU. (Hawái)", region: "america", lon: -157.75, lat: 21.46, valor: 32.0, unidad: "kW/m", fuente: "US Navy WETS", estado: "verificado", tipo: "undimotriz", hm0_m: 2.1, te_s: 8.6, rango_m: 0.8, velocidad_ms: 0.4, profundidad_m: 35 },

  // Europa
  { id: "pentland_firth", nombre: "Pentland Firth (Orkney)", pais: "Reino Unido", region: "europa", lon: -3.14, lat: 58.71, valor: 48.0, unidad: "kW/m", fuente: "EMEC / MeyGen", estado: "verificado", tipo: "mareomotriz", hm0_m: 2.8, te_s: 8.2, rango_m: 4.5, velocidad_ms: 5.0, profundidad_m: 35 },
  { id: "la_rance", nombre: "Estuario de La Rance (Bretaña)", pais: "Francia", region: "europa", lon: -2.03, lat: 48.62, valor: 28.0, unidad: "kW/m", fuente: "EDF France (240 MW)", estado: "verificado", tipo: "mareomotriz", hm0_m: 0.7, te_s: 4.5, rango_m: 13.5, velocidad_ms: 3.8, profundidad_m: 18 },
  { id: "severn_estuary", nombre: "Estuario del Severn (Bristol)", pais: "Reino Unido", region: "europa", lon: -2.98, lat: 51.42, valor: 32.0, unidad: "kW/m", fuente: "UK Tidal Energy", estado: "verificado", tipo: "mareomotriz", hm0_m: 1.2, te_s: 5.5, rango_m: 14.2, velocidad_ms: 3.6, profundidad_m: 28 },
  { id: "costa_da_morte", nombre: "Costa da Morte (Galicia)", pais: "España", region: "europa", lon: -9.28, lat: 43.12, valor: 45.0, unidad: "kW/m", fuente: "Puertos del Estado", estado: "verificado", tipo: "undimotriz", hm0_m: 2.6, te_s: 9.2, rango_m: 3.5, velocidad_ms: 0.8, profundidad_m: 45 },
  { id: "peniche", nombre: "Peniche (Costa Atlántica)", pais: "Portugal", region: "europa", lon: -9.38, lat: 39.36, valor: 38.0, unidad: "kW/m", fuente: "Wavec Portugal", estado: "verificado", tipo: "undimotriz", hm0_m: 2.3, te_s: 8.8, rango_m: 2.8, velocidad_ms: 0.5, profundidad_m: 30 },
  { id: "messina_strait", nombre: "Estrecho de Messina", pais: "Italia", region: "europa", lon: 15.65, lat: 38.24, valor: 18.0, unidad: "kW/m", fuente: "CNR Italia", estado: "verificado", tipo: "mareomotriz", hm0_m: 0.9, te_s: 5.2, rango_m: 1.4, velocidad_ms: 3.1, profundidad_m: 70 },

  // Asia / Oceanía
  { id: "cook_strait", nombre: "Estrecho de Cook", pais: "Nueva Zelanda", region: "asia_oceania", lon: 174.65, lat: -41.25, valor: 55.0, unidad: "kW/m", fuente: "NIWA New Zealand", estado: "verificado", tipo: "mareomotriz", hm0_m: 2.4, te_s: 8.5, rango_m: 2.8, velocidad_ms: 3.9, profundidad_m: 65 },
  { id: "sihwa_lake", nombre: "Lago Sihwa (central de 254 MW)", pais: "Corea del Sur", region: "asia_oceania", lon: 126.61, lat: 37.31, valor: 22.0, unidad: "kW/m", fuente: "K-Water South Korea", estado: "verificado", tipo: "mareomotriz", hm0_m: 0.6, te_s: 4.2, rango_m: 8.0, velocidad_ms: 2.5, profundidad_m: 16 },
  { id: "king_island", nombre: "King Island (Tasmania)", pais: "Australia", region: "asia_oceania", lon: 143.95, lat: -39.92, valor: 86.0, unidad: "kW/m", fuente: "CSIRO Australia", estado: "verificado", tipo: "undimotriz", hm0_m: 3.5, te_s: 10.5, rango_m: 2.2, velocidad_ms: 1.8, profundidad_m: 55 },

  // África
  { id: "cape_point", nombre: "Cape Point (Ciudad del Cabo)", pais: "Sudáfrica", region: "africa", lon: 18.49, lat: -34.35, valor: 64.0, unidad: "kW/m", fuente: "CSIR South Africa", estado: "verificado", tipo: "undimotriz", hm0_m: 3.0, te_s: 9.5, rango_m: 2.0, velocidad_ms: 1.2, profundidad_m: 48 },
]);

const sitioActual = computed(() => sitios.value.find((s) => s.id === sitioActivoLocal.value) ?? sitios.value[0]);

/** Cada métrica declara su ausencia. Un emplazamiento sin campaña de oleaje no
 *  recibe una cifra de relleno: la fila queda en «sin dato». */
const metricasSitio = computed(() => {
  const s = sitioActual.value;
  const cifra = (v: number | null | undefined, d: number) =>
    v === null || v === undefined ? null : formatearNumero(v, d);
  return [
    { rotulo: "Potencia del frente", valor: cifra(s.valor, 1), unidad: "kW/m" },
    { rotulo: "Altura de ola Hm0", valor: cifra(s.hm0_m, 1), unidad: "m" },
    { rotulo: "Periodo Te", valor: cifra(s.te_s, 1), unidad: "s" },
    { rotulo: "Rango mareal", valor: cifra(s.rango_m, 1), unidad: "m" },
    { rotulo: "Corriente mareal", valor: cifra(s.velocidad_ms, 1), unidad: "m/s" },
    { rotulo: "Profundidad", valor: cifra(s.profundidad_m, 0), unidad: "m" },
  ];
});

onMounted(() => {
  if (!contenedor.value) return;
  map = crearMapa(contenedor.value, sitios.value);

  map.on("sitio_seleccionado" as never, (e: { id: string }) => alSeleccionar(e.id));
  map.on("coordenada_seleccionada" as never, (e: { lon: number; lat: number }) => {
    avisoTierra.value = "";
    void puntoLibre(e.lon, e.lat);
  });
  map.on("punto_en_tierra" as never, () => {
    avisoTierra.value = "ese punto cae en tierra firme; el recurso marino sólo se evalúa sobre el mar";
    clearTimeout(temporizadorAviso);
    temporizadorAviso = setTimeout(() => (avisoTierra.value = ""), 5000);
  });
});

watch(
  () => props.sitioActivo,
  (id) => {
    if (id && id !== sitioActivoLocal.value && sitios.value.some((s) => s.id === id)) sitioActivoLocal.value = id;
  }
);

/** Punto cualquiera del océano: se consulta el recurso real en esa coordenada. */
async function puntoLibre(lon: number, lat: number) {
  consultando.value = true;
  try {
    const [oleaje, marea] = await Promise.all([consultarOleaje(lon, lat), consultarMarea(lon, lat)]);
    const hayOleaje = oleaje.estado !== "pendiente";
    const nuevo: SitioMapa = {
      id: `punto_${Date.now()}`,
      nombre: `${Math.abs(lat).toFixed(2)}° ${lat >= 0 ? "N" : "S"}, ${Math.abs(lon).toFixed(2)}° ${lon >= 0 ? "E" : "O"}`,
      pais: "Océano global",
      region: "libre",
      lon,
      lat,
      valor: hayOleaje ? oleaje.kw_m : null,
      unidad: "kW/m",
      fuente: marea
        ? `${oleaje.fuente} · marea: ${marea.fuente} (${marea.nombre}, a ${marea.distancia_km} km)`
        : `${oleaje.fuente} · marea sin fuente en este punto`,
      estado: oleaje.estado,
      tipo: marea && marea.velocidad_ms >= 2 ? "mareomotriz" : "undimotriz",
      hm0_m: hayOleaje ? oleaje.hm0_m : undefined,
      te_s: hayOleaje ? oleaje.te_s : undefined,
      rango_m: marea?.rango_m,
      velocidad_ms: marea?.velocidad_ms,
      profundidad_m: undefined,
    };
    sitios.value = [nuevo, ...sitios.value];
    sitioActivoLocal.value = nuevo.id;
    if (map) actualizarSitios(map, sitios.value);
    if (hayOleaje) emit("seleccionar-sitio", nuevo);
  } finally {
    consultando.value = false;
  }
}

function alSeleccionar(id: string) {
  sitioActivoLocal.value = id;
  const s = sitios.value.find((x) => x.id === id);
  if (!s) return;
  if (map) flyToSitio(map, s.lon, s.lat, s.id.startsWith("punto_") ? 5 : 7);
  emit("seleccionar-sitio", s);
}

function confirmarSeleccionYSimular() {
  if (sitioActual.value) emit("ir-a-simulador", sitioActual.value);
}
</script>

<style scoped>
.mapa-seccion {
  display: flex;
  flex-direction: column;
  inline-size: 100%;
  block-size: 100%;
  min-block-size: 0;
  overflow: hidden;
}

.rotulo-oculto {
  position: absolute;
  inline-size: 1px;
  block-size: 1px;
  overflow: hidden;
  clip-path: inset(50%);
  white-space: nowrap;
}

/* ---- Carta ---- */
.carta {
  position: relative;
  flex: 1 1 auto;
  min-block-size: 13rem;
  background: var(--map-oceano);
}

.mapa {
  inline-size: 100%;
  block-size: 100%;
}

.escala {
  position: absolute;
  inset-block-end: var(--s-2);
  inset-inline-start: var(--s-2);
  inline-size: 11rem;
  padding: 6px var(--s-2);
  border-radius: var(--radio);
  background: oklch(1 0 0 / 0.86);
  backdrop-filter: blur(6px);
  box-shadow: var(--sombra-caja);
  pointer-events: none;
}

.escala-titulo {
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--tenue);
}

.escala-barra {
  block-size: 6px;
  margin-block: 4px 3px;
  border-radius: 2px;
  background: linear-gradient(to right, var(--rampa-0), var(--rampa-1), var(--rampa-2), var(--rampa-3));
}

.escala-topes {
  display: flex;
  justify-content: space-between;
  font-size: 10px;
  color: var(--tenue);
}

.estado-carta {
  position: absolute;
  inset-block-start: var(--s-2);
  inset-inline: var(--s-2) var(--s-2);
  display: flex;
  align-items: start;
  gap: 6px;
  margin: 0;
  padding: var(--s-2);
  border-radius: var(--radio);
  background: oklch(1 0 0 / 0.9);
  box-shadow: var(--sombra-caja);
  font-size: var(--text-meta);
  color: var(--tinta);
}

/* ---- Ficha del emplazamiento activo ---- */
.ficha-sitio {
  flex: none;
  margin: var(--s-3);
  padding: var(--s-3);
  border: 1px solid var(--borde-suave);
  border-radius: var(--radio-caja);
  background: var(--panel);
  box-shadow: var(--sombra-caja);
}

.ficha-cabecera {
  display: flex;
  justify-content: space-between;
  align-items: start;
  gap: var(--s-2);
}

.ficha-tag {
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--tenue);
  font-weight: 700;
}

.ficha-titulo {
  font-size: var(--text-seccion);
  font-weight: 600;
  margin: 0;
  line-height: 1.15;
}

.ficha-metricas {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: var(--s-2) var(--s-2);
  margin: var(--s-3) 0 0;
}

.metrica dt {
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--tenue);
}

.metrica dd {
  margin: 0;
  font-family: var(--font-display);
  font-size: var(--text-cuerpo);
  font-weight: 600;
}

.metrica dd[data-pendiente] {
  font-family: var(--font-sans);
  font-weight: 400;
  font-style: italic;
  color: var(--tenue);
}

.metrica-unidad {
  font-family: var(--font-sans);
  font-size: 11px;
  font-weight: 400;
  color: var(--tenue);
}

.ficha-fuente {
  margin: var(--s-2) 0 0;
  font-size: 11px;
  color: var(--tenue);
}

.btn-simular {
  display: flex;
  align-items: center;
  justify-content: space-between;
  inline-size: 100%;
  margin-block-start: var(--s-3);
  padding: 8px 12px;
  border: 1px solid var(--rol-mar-profundo);
  border-radius: var(--radio);
  background: var(--rol-mar-profundo);
  color: var(--panel);
  font-weight: 600;
  cursor: pointer;
  transition: background-color var(--dur-rapida) var(--ease-salida);
}

.btn-simular:hover {
  background: var(--rol-mar-medio);
  border-color: var(--rol-mar-medio);
}

@media (width <= 64rem) {
  .carta {
    flex: 1 1 auto;
    min-block-size: 16rem;
  }
}
</style>
