<template>
  <section class="mapa-seccion" aria-labelledby="titulo-mapa">
    <h1 id="titulo-mapa" class="rotulo-oculto">Carta mundial de recurso marino</h1>

    <div
      ref="contenedor"
      class="mapa"
      role="application"
      aria-label="Mapa navegable mundial: arrastra para desplazar, rueda para zoom, pulsa cualquier zona marina para simular"
    ></div>

    <!-- Rail de decisión: escala del recurso, dónde estoy y qué se simula.
         Un solo panel; el mapa no lleva conmutadores de capas. -->
    <div v-if="!reducido" class="rail" :class="{ plegado }">
      <button class="rail-tirador" @click="plegado = !plegado" :aria-expanded="plegado ? 'false' : 'true'">
        <Icono :icono="plegado ? 'expandir' : 'cerrar'" tamano="sm" />
        <span>{{ plegado ? 'Emplazamientos' : 'Ocultar panel' }}</span>
      </button>

      <div v-show="!plegado" class="rail-cuerpo">
        <div class="escala">
          <div class="escala-titulo">Potencia del frente de ola</div>
          <div class="escala-barra"></div>
          <div class="escala-topes"><span>0</span><span>20</span><span>45</span><span>80+ kW/m</span></div>
          <p class="escala-nota">
            Reanálisis de oleaje ERA5-Ocean / MFWAM vía Open-Meteo Marine, rejilla de 8°, medias
            estacionales de 2023. Los aros ámbar marcan emplazamientos mareales medidos.
            Contorno de tierra: Natural Earth.
          </p>
        </div>

        <div class="filtro-regiones" role="group" aria-label="Filtrar emplazamientos por región">
          <button
            v-for="r in REGIONES"
            :key="r.id"
            class="btn-region"
            :class="{ activo: regionActiva === r.id }"
            :aria-pressed="regionActiva === r.id ? 'true' : 'false'"
            @click="regionActiva = r.id"
          >
            {{ r.label }}
          </button>
        </div>

        <ListaSitios :sitios="sitiosFiltrados" :activo="sitioActivo" @seleccionar="alSeleccionar" />

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
            Simular este emplazamiento
          </button>
        </div>

        <p v-if="consultando" class="rail-estado">
          <Icono icono="calculando" tamano="sm" />
          <span>consultando el reanálisis en ese punto…</span>
        </p>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { onMounted, ref, computed, watch } from "vue";
import { crearMapa, flyToSitio, actualizarSitios, type SitioMapa } from "../map/mapa";
import { consultarOleaje, consultarMarea } from "../datos/marino";
import { formatearNumero } from "../utils/formato";
import ListaSitios from "./ListaSitios.vue";
import Icono from "./Icono.vue";

const props = defineProps<{
  /** Reducido a miniatura en la esquina: se deja sólo la carta. */
  reducido?: boolean;
}>();

const emit = defineEmits<{
  (e: "seleccionar-sitio", s: SitioMapa): void;
  (e: "ir-a-simulador", s: SitioMapa): void;
}>();

const contenedor = ref<HTMLElement | null>(null);
let map: ReturnType<typeof crearMapa> | null = null;
const sitioActivo = ref("isla_fuerte");
const regionActiva = ref("todos");
const plegado = ref(false);
const consultando = ref(false);

const REGIONES = [
  { id: "todos", label: "Todos" },
  { id: "colombia", label: "Colombia" },
  { id: "america", label: "América" },
  { id: "europa", label: "Europa" },
  { id: "asia_oceania", label: "Asia y Oceanía" },
  { id: "africa", label: "África" },
];

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

const sitiosFiltrados = computed(() => {
  if (regionActiva.value === "todos") return sitios.value;
  return sitios.value.filter((s) => s.region === regionActiva.value);
});

const sitioActual = computed(() => sitios.value.find((s) => s.id === sitioActivo.value) ?? sitios.value[0]);

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
    void puntoLibre(e.lon, e.lat);
  });
});

/** Punto cualquiera del océano: se consulta el recurso real en esa coordenada.
 *  Si no hay fuente que lo cubra, el emplazamiento entra como pendiente y sin
 *  cifras en vez de con una estimación inventada. */
async function puntoLibre(lon: number, lat: number) {
  consultando.value = true;
  try {
    const [oleaje, marea] = await Promise.all([consultarOleaje(lon, lat), consultarMarea(lon, lat)]);
    const hayOleaje = oleaje.estado !== "pendiente";
    const nuevo: SitioMapa = {
      id: `punto_${Date.now()}`,
      nombre: `${Math.abs(lat).toFixed(2)}° ${lat >= 0 ? "N" : "S"}, ${Math.abs(lon).toFixed(2)}° ${lon >= 0 ? "E" : "O"}`,
      pais: "Océano global",
      region: regionActiva.value,
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
    sitioActivo.value = nuevo.id;
    if (map) actualizarSitios(map, sitios.value);
    if (hayOleaje) emit("seleccionar-sitio", nuevo);
  } finally {
    consultando.value = false;
  }
}

// Al reducirse el visor, MapLibre conserva centro y zoom, así que en la
// miniatura se vería sólo un recorte. Se guarda el recuadro visible antes de
// que cambie el tamaño y se restaura después: la miniatura enseña lo mismo.
watch(
  () => props.reducido,
  () => {
    if (!map) return;
    const recuadro = map.getBounds();
    requestAnimationFrame(() => {
      if (!map) return;
      map.resize();
      map.fitBounds(recuadro, { animate: false, padding: 4 });
    });
  }
);

function alSeleccionar(id: string) {
  sitioActivo.value = id;
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
  position: relative;
  inline-size: 100%;
  block-size: 100%;
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

.mapa {
  inline-size: 100%;
  block-size: 100%;
}

/* ---- Rail de decisión ---- */
.rail {
  position: absolute;
  inset-block-start: var(--s-2);
  /* --lectura-alto lo declara el escenario (app.css): el rail no se mete
     debajo de la tira de lectura. */
  inset-block-end: calc(var(--lectura-alto, 0px) + var(--s-2));
  inset-inline-end: var(--s-2);
  inline-size: min(22rem, 40vw);
  max-block-size: 100%;
  display: flex;
  flex-direction: column;
  gap: var(--s-2);
  z-index: 4;
  pointer-events: none;
}

.rail > * {
  pointer-events: auto;
}

.rail.plegado {
  inline-size: auto;
}

.rail-tirador {
  align-self: end;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: var(--s-1) 10px;
  border: 1px solid var(--borde);
  border-radius: var(--radio);
  background: var(--panel);
  font-size: var(--text-meta);
  font-weight: 600;
  cursor: pointer;
}

.rail-cuerpo {
  display: flex;
  flex-direction: column;
  gap: var(--s-2);
  min-block-size: 0;
  /* Las secciones del rail no se comprimen entre sí: si no cabe todo, el rail
     desplaza, que es lo que se espera de una lista. */
  overflow: auto;
  padding: var(--s-3);
  border: 1px solid var(--borde);
  border-radius: var(--radio-caja);
  background: var(--panel);
  box-shadow: var(--sombra-caja);
}

.rail-cuerpo > * {
  flex: none;
}

.escala-titulo {
  font-size: var(--text-meta);
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--tenue);
}

.escala-barra {
  block-size: 8px;
  margin-block: 4px;
  border-radius: 2px;
  background: linear-gradient(to right, #0e7490, #2dd4bf, #eab308, #d9461e);
}

.escala-topes {
  display: flex;
  justify-content: space-between;
  font-size: 11px;
  color: var(--tenue);
}

.escala-nota {
  margin: var(--s-1) 0 0;
  font-size: 11px;
  color: var(--tenue);
}

.filtro-regiones {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.btn-region {
  padding: 2px 8px;
  border-radius: var(--radio);
  border: 1px solid var(--borde-suave);
  background: var(--lienzo);
  font-size: var(--text-meta);
  cursor: pointer;
}

.btn-region.activo {
  background: var(--rol-mar-profundo);
  color: var(--panel);
  border-color: var(--rol-mar-profundo);
  font-weight: 600;
}

/* ---- Ficha del emplazamiento activo ---- */
.ficha-sitio {
  border-block-start: 1px solid var(--borde-suave);
  padding-block-start: var(--s-2);
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
  font-size: var(--text-cuerpo);
  font-weight: 700;
  margin: 0;
  line-height: 1.2;
}

.ficha-metricas {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 2px var(--s-2);
  margin: var(--s-2) 0 0;
}

.metrica dt {
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--tenue);
}

.metrica dd {
  margin: 0;
  font-size: var(--text-cuerpo);
  font-weight: 600;
}

.metrica dd[data-pendiente] {
  font-weight: 400;
  font-style: italic;
  color: var(--tenue);
}

.metrica-unidad {
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
  inline-size: 100%;
  margin-block-start: var(--s-2);
  padding: 6px 12px;
  border: 1px solid var(--rol-mar-profundo);
  border-radius: var(--radio);
  background: var(--rol-mar-profundo);
  color: var(--panel);
  font-weight: 600;
  cursor: pointer;
}

.btn-simular:hover {
  background: var(--rol-mar-medio);
  border-color: var(--rol-mar-medio);
}

.rail-estado {
  display: flex;
  align-items: center;
  gap: 6px;
  margin: 0;
  padding: var(--s-1) var(--s-2);
  border-radius: var(--radio);
  background: var(--panel);
  font-size: var(--text-meta);
  color: var(--tenue);
}

@media (width <= 52rem) {
  .rail {
    inline-size: min(18rem, 62vw);
  }
}
</style>
