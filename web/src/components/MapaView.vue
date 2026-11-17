<template>
  <section class="mapa-seccion" :class="{ compacto }" aria-labelledby="titulo-mapa">
    <h1 id="titulo-mapa" class="rotulo-oculto">Carta mundial de recurso marino</h1>

    <!-- Carta: arriba, con la leyenda del recurso encima y nada más. -->
    <div class="carta">
      <div
        ref="contenedor"
        class="mapa"
        role="application"
        aria-label="Mapa navegable mundial: arrastra para desplazar, rueda para zoom, pulsa cualquier zona marina para simular"
      ></div>

      <div class="escala" aria-label="Leyenda del recurso visible">
        <div class="escala-titulo">{{ leyenda.titulo }}</div>
        <div class="escala-barra"></div>
        <div class="escala-topes"><span v-for="t in leyenda.topes" :key="t">{{ t }}</span></div>
        <div class="escala-fuente">Fuente: {{ leyenda.fuente }}</div>
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

    <!-- Ficha del emplazamiento activo: la capa de potencial la decide el
         dispositivo del flujo; aquí ya no se conmuta a mano. -->
    <div v-if="plantaActual && !compacto" class="ficha-sitio ficha-planta" aria-label="Ficha de la planta">
      <div class="ficha-cabecera">
        <div>
          <span class="ficha-tag">{{ etiquetaTecnologia(plantaActual.tecnologia) }}</span>
          <h2 class="ficha-titulo">{{ plantaActual.nombre }}</h2>
        </div>
        <span class="semaforo" :class="'semaforo--' + (plantaActual.estado_operativo === 'operativo' ? 'verificado' : 'pendiente')">
          <span class="semaforo__simbolo" :class="'semaforo__simbolo--' + (plantaActual.estado_operativo === 'operativo' ? 'verificado' : 'pendiente')" aria-hidden="true"></span>
          <span>{{ plantaActual.estado_operativo === "operativo" ? "operativo ●" : "desmantelado ○" }}</span>
        </span>
      </div>

      <dl class="ficha-metricas">
        <div class="metrica">
          <dt>Potencia instalada</dt>
          <dd v-if="plantaActual.potencia_instalada !== null">{{ formatearPlanta(plantaActual.potencia_instalada) }} <span class="metrica-unidad">{{ plantaActual.unidad_potencia }}</span></dd>
          <dd v-else data-pendiente>sin dato</dd>
        </div>
        <div class="metrica">
          <dt>Puesta en marcha</dt>
          <dd v-if="plantaActual.anio_puesta_en_marcha !== null">{{ plantaActual.anio_puesta_en_marcha }}</dd>
          <dd v-else data-pendiente>sin dato</dd>
        </div>
        <div class="metrica">
          <dt>Cierre</dt>
          <dd>{{ plantaActual.anio_cierre === null ? "en servicio" : plantaActual.anio_cierre }}</dd>
        </div>
      </dl>

      <p class="ficha-fuente">{{ plantaActual.fuente }}</p>
      <p v-if="plantaActual.catalogo" class="ficha-enlace">Ficha del catálogo: {{ plantaActual.catalogo }}</p>
      <p v-if="plantaActual.fracaso" class="ficha-enlace">Caso de cierre: {{ plantaActual.fracaso }}</p>

      <button class="btn-simular" @click="cerrarPlanta">
        <span>Volver al emplazamiento</span>
        <Icono icono="eslabon" tamano="sm" />
      </button>
    </div>

    <div v-else-if="sitioActual && !compacto" class="ficha-sitio">
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

      <p v-if="sinDatoPrincipal" class="ficha-fuente">
        Sin dato de {{ metricasSitio[0].rotulo.toLowerCase() }} en este punto: prueba más cerca de la costa o
        escribe tus propios valores.
      </p>
      <button class="btn-simular" :disabled="sinDatoPrincipal" @click="confirmarSeleccionYSimular">
        <span>Simular este emplazamiento</span>
        <Icono icono="eslabon" tamano="sm" />
      </button>
    </div>
  </section>
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, computed, watch } from "vue";
import maplibregl from "maplibre-gl";
import { crearMapa, flyToSitio, actualizarSitios, fijarTecnologiaActiva, MENSAJE_DIQUE_LEJOS, type SitioMapa } from "../map/mapa";
import { consultarOleaje, consultarMarea, consultarRangoMareal, consultarCorriente, consultarRecursoGlobal } from "../datos/marino";
import { cargarPlantas, type PlantaMundial, type TecnologiaActiva, type TecnologiaPlanta } from "../map/plantas";
import { formatearNumero } from "../utils/formato";
import Icono from "./Icono.vue";

const props = defineProps<{
  /** Emplazamiento que la carcasa tiene activo, para que la carta lo refleje. */
  sitioActivo?: string;
  /** Dispositivo que el flujo tiene activo: decide qué capa de potencial se pinta. */
  dispositivo?: string;
  /** Caja flotante mínima (mapa de la simulación). Oculta la ficha. */
  compacto?: boolean;
  centro?: [number, number] | null;
}>();

const emit = defineEmits<{
  (e: "seleccionar-sitio", s: SitioMapa): void;
  (e: "ir-a-simulador", s: SitioMapa): void;
}>();

const contenedor = ref<HTMLElement | null>(null);
let map: ReturnType<typeof crearMapa> | null = null;
const sitioActivoLocal = ref(props.sitioActivo ?? "");
const consultando = ref(false);
const avisoTierra = ref("");
let temporizadorAviso = 0 as unknown as ReturnType<typeof setTimeout>;

/** Capa de potencial visible: la decide el dispositivo del flujo (sin conmutador). */
function tecnologiaDeDispositivo(d?: string): TecnologiaActiva {
  if (d === "embalse") return "dique";
  if (d === "turbina_corriente") return "turbina";
  return "undimotriz";
}

const tecnologiaActiva = ref<TecnologiaActiva>(tecnologiaDeDispositivo(props.dispositivo));

/** Leyenda viva: unidades + escala de color + fuente de la capa visible. */
const leyenda = computed(() => {
  if (tecnologiaActiva.value === "dique")
    return { titulo: "Rango de marea", topes: ["0,4", "1", "2", "3,5+ m"], fuente: "Mercator SMOC vía Open-Meteo" };
  if (tecnologiaActiva.value === "turbina")
    return { titulo: "Corriente de pico", topes: ["0", "1", "2", "3+ m/s"], fuente: "Mercator SMOC vía Open-Meteo" };
  return { titulo: "Frente de ola", topes: ["0", "20", "45", "80+ kW/m"], fuente: "Open-Meteo Marine (ERA5-Ocean / MFWAM)" };
});

function sincronizarTecnologia(t: TecnologiaActiva) {
  if (tecnologiaActiva.value === t) return;
  tecnologiaActiva.value = t;
  plantaActual.value = null;
  if (map) fijarTecnologiaActiva(map, t);
}

function etiquetaTecnologia(t: TecnologiaPlanta["tecnologia"]): string {
  return t === "dique" ? "Dique de marea" : t === "turbina" ? "Turbina de corriente" : "Undimotriz";
}

function formatearPlanta(v: number): string {
  return formatearNumero(v, v >= 100 ? 0 : 1);
}

/** Plantas reales: el clic en un marcador abre su ficha con fuente citada. */
const plantas = ref<PlantaMundial[]>([]);
const plantaActual = ref<PlantaMundial | null>(null);

function abrirPlanta(id: string) {
  plantaActual.value = plantas.value.find((p) => p.id === id) ?? null;
}

function cerrarPlanta() {
  plantaActual.value = null;
}

/** Potencia del oleaje en aguas profundas, J = ρg²·Hm0²·Te / 64π ≈ 0,49·Hm0²·Te kW/m.
 *  Es la misma cuenta que hace el motor con el estado de mar que se simula, así
 *  la ficha y el resultado no se contradicen. */
function potenciaOleaje(hm0?: number, te?: number): number | null {
  return hm0 && te ? 0.49 * hm0 * hm0 * te : null;
}

const sitios = ref<SitioMapa[]>(([
  // Colombia
  { id: "isla_fuerte", nombre: "Isla Fuerte", pais: "Colombia", region: "colombia", lon: -76.18, lat: 9.39, valor: 8.9, unidad: "kW/m", fuente: "Ortega et al. 2013", estado: "verificado", tipo: "undimotriz", hm0_m: 1.5, te_s: 7.0, rango_m: 0.4, velocidad_ms: 0.3, profundidad_m: 30 },

  // América
  { id: "bahia_fundy", nombre: "Bahía de Fundy (Minas Passage)", pais: "Canadá", region: "america", lon: -64.4, lat: 45.36, valor: 24.5, unidad: "kW/m", fuente: "Burntcoat Head: rango medio 11,7 m (16,3 m extremo)", estado: "inferido", tipo: "mareomotriz", hm0_m: 0.8, te_s: 5.0, rango_m: 11.7, velocidad_ms: 5.2, profundidad_m: 42 },
  { id: "estrecho_magallanes", nombre: "Estrecho de Magallanes", pais: "Chile", region: "america", lon: -70.52, lat: -52.85, valor: 72.0, unidad: "kW/m", fuente: "Univ. Magallanes", estado: "inferido", tipo: "mareomotriz", hm0_m: 3.2, te_s: 9.8, rango_m: 7.8, velocidad_ms: 4.2, profundidad_m: 50 },
  { id: "golfo_san_jose", nombre: "Golfo San José (Península Valdés)", pais: "Argentina", region: "america", lon: -64.25, lat: -42.42, valor: 35.0, unidad: "kW/m", fuente: "CNEA Argentina", estado: "inferido", tipo: "mareomotriz", hm0_m: 1.4, te_s: 6.5, rango_m: 9.1, velocidad_ms: 3.4, profundidad_m: 30 },
  { id: "oregon_coast", nombre: "PacWave (Costa de Oregón)", pais: "EE.UU.", region: "america", lon: -124.12, lat: 44.58, valor: 42.0, unidad: "kW/m", fuente: "US DOE / PacWave", estado: "inferido", tipo: "undimotriz", hm0_m: 2.5, te_s: 9.0, rango_m: 2.4, velocidad_ms: 0.7, profundidad_m: 40 },
  { id: "hawaii_oahu", nombre: "Kaneohe Bay (Oahu)", pais: "EE.UU. (Hawái)", region: "america", lon: -157.75, lat: 21.46, valor: 32.0, unidad: "kW/m", fuente: "US Navy WETS", estado: "inferido", tipo: "undimotriz", hm0_m: 2.1, te_s: 8.6, rango_m: 0.8, velocidad_ms: 0.4, profundidad_m: 35 },

  // Europa
  { id: "pentland_firth", nombre: "Pentland Firth (Orkney)", pais: "Reino Unido", region: "europa", lon: -3.14, lat: 58.71, valor: 48.0, unidad: "kW/m", fuente: "EMEC / MeyGen: pico de 5 m/s en mareas vivas", estado: "inferido", tipo: "mareomotriz", hm0_m: 2.8, te_s: 8.2, rango_m: 4.5, velocidad_ms: 5.0, profundidad_m: 35 },
  { id: "la_rance", nombre: "Estuario de La Rance (Bretaña)", pais: "Francia", region: "europa", lon: -2.03, lat: 48.62, valor: 28.0, unidad: "kW/m", fuente: "EDF: rango medio 8 m (13,5 m en vivas)", estado: "inferido", tipo: "mareomotriz", hm0_m: 0.7, te_s: 4.5, rango_m: 8.0, velocidad_ms: 3.8, profundidad_m: 18 },
  { id: "severn_estuary", nombre: "Estuario del Severn (Bristol)", pais: "Reino Unido", region: "europa", lon: -2.98, lat: 51.42, valor: 32.0, unidad: "kW/m", fuente: "UK Tidal Energy", estado: "inferido", tipo: "mareomotriz", hm0_m: 1.2, te_s: 5.5, rango_m: 14.2, velocidad_ms: 3.6, profundidad_m: 28 },
  { id: "costa_da_morte", nombre: "Costa da Morte (Galicia)", pais: "España", region: "europa", lon: -9.28, lat: 43.12, valor: 45.0, unidad: "kW/m", fuente: "Puertos del Estado", estado: "inferido", tipo: "undimotriz", hm0_m: 2.6, te_s: 9.2, rango_m: 3.5, velocidad_ms: 0.8, profundidad_m: 45 },
  { id: "peniche", nombre: "Peniche (Costa Atlántica)", pais: "Portugal", region: "europa", lon: -9.38, lat: 39.36, valor: 38.0, unidad: "kW/m", fuente: "estado de mar típico de la costa atlántica (orientativo)", estado: "inferido", tipo: "undimotriz", hm0_m: 2.3, te_s: 8.8, rango_m: 2.8, velocidad_ms: 0.5, profundidad_m: 30 },
  { id: "messina_strait", nombre: "Estrecho de Messina", pais: "Italia", region: "europa", lon: 15.65, lat: 38.24, valor: 18.0, unidad: "kW/m", fuente: "CNR Italia", estado: "inferido", tipo: "mareomotriz", hm0_m: 0.9, te_s: 5.2, rango_m: 1.4, velocidad_ms: 3.1, profundidad_m: 70 },

  // Asia / Oceanía
  { id: "cook_strait", nombre: "Estrecho de Cook", pais: "Nueva Zelanda", region: "asia_oceania", lon: 174.65, lat: -41.25, valor: 55.0, unidad: "kW/m", fuente: "NIWA New Zealand", estado: "inferido", tipo: "mareomotriz", hm0_m: 2.4, te_s: 8.5, rango_m: 2.8, velocidad_ms: 3.9, profundidad_m: 65 },
  { id: "sihwa_lake", nombre: "Lago Sihwa (central de 254 MW)", pais: "Corea del Sur", region: "asia_oceania", lon: 126.61, lat: 37.31, valor: 22.0, unidad: "kW/m", fuente: "K-Water South Korea", estado: "inferido", tipo: "mareomotriz", hm0_m: 0.6, te_s: 4.2, rango_m: 8.0, velocidad_ms: 2.5, profundidad_m: 16 },
  { id: "king_island", nombre: "King Island (Tasmania)", pais: "Australia", region: "asia_oceania", lon: 143.95, lat: -39.92, valor: 86.0, unidad: "kW/m", fuente: "CSIRO Australia", estado: "inferido", tipo: "undimotriz", hm0_m: 3.5, te_s: 10.5, rango_m: 2.2, velocidad_ms: 1.8, profundidad_m: 55 },

  // África
  { id: "cape_point", nombre: "Cape Point (Ciudad del Cabo)", pais: "Sudáfrica", region: "africa", lon: 18.49, lat: -34.35, valor: 64.0, unidad: "kW/m", fuente: "CSIR South Africa", estado: "inferido", tipo: "undimotriz", hm0_m: 3.0, te_s: 9.5, rango_m: 2.0, velocidad_ms: 1.2, profundidad_m: 48 },
] as SitioMapa[]).map((s) => ({
  ...s,
  valor: potenciaOleaje(s.hm0_m, s.te_s),
  // Solo un sitio con medición revisada por pares conserva su media anual publicada.
  publicado: s.estado === "verificado" ? s.valor : null,
})));

const sitioActual = computed(() => sitios.value.find((s) => s.id === sitioActivoLocal.value) ?? sitios.value[0]);

/** Cada métrica declara su ausencia. Un emplazamiento sin campaña de oleaje no
 *  recibe una cifra de relleno: la fila queda en «sin dato». */
const metricasSitio = computed(() => {
  const s = sitioActual.value;
  const cifra = (v: number | null | undefined, d: number) =>
    v === null || v === undefined ? null : formatearNumero(v, d);
  const profundidad = { rotulo: "Profundidad", valor: cifra(s.profundidad_m, 0), unidad: "m" };
  // Solo las magnitudes que mueven la tecnología elegida: el resto confunde.
  if (tecnologiaActiva.value === "dique")
    return [{ rotulo: "Rango de marea", valor: cifra(s.rango_m, 1), unidad: "m" }, profundidad];
  if (tecnologiaActiva.value === "turbina")
    return [{ rotulo: "Corriente de marea", valor: cifra(s.velocidad_ms, 1), unidad: "m/s" }, profundidad];
  return [
    { rotulo: "Potencia del oleaje", valor: cifra(potenciaOleaje(s.hm0_m, s.te_s), 1), unidad: "kW/m" },
    { rotulo: "Altura de ola Hm0", valor: cifra(s.hm0_m, 1), unidad: "m" },
    { rotulo: "Periodo Te", valor: cifra(s.te_s, 1), unidad: "s" },
    ...(s.publicado ? [{ rotulo: "Media anual publicada", valor: cifra(s.publicado, 1), unidad: "kW/m" }] : []),
    profundidad,
  ];
});

/** El mapa compacto enseña dónde se está simulando, no el mundo entero, y sigue
 *  al punto cuando el estudiante elige otro. */
let marca: maplibregl.Marker | null = null;
function situarMarca() {
  const activo = sitios.value.find((s) => s.id === props.sitioActivo);
  const centro = props.centro ?? (activo ? ([activo.lon, activo.lat] as [number, number]) : null);
  if (!map || !centro) return;
  map.jumpTo({ center: centro, zoom: 3 });
  if (!marca) {
    const el = document.createElement("div");
    el.style.cssText =
      "inline-size:14px;block-size:14px;border-radius:50%;background:var(--marco-captado);border:2px solid var(--marco);box-shadow:0 0 0 4px oklch(0.85 0.17 118 / 0.35)";
    marca = new maplibregl.Marker({ element: el }).setLngLat(centro).addTo(map);
  }
  marca.setLngLat(centro);
}

watch(
  () => [props.centro, props.sitioActivo],
  () => {
    if (props.compacto) situarMarca();
  }
);

const sinDatoPrincipal = computed(() => metricasSitio.value[0]?.valor == null);

onMounted(() => {
  if (!contenedor.value) return;
  map = crearMapa(contenedor.value, sitios.value);
  if (map) fijarTecnologiaActiva(map, tecnologiaActiva.value);
  if (props.compacto) situarMarca();
  void cargarPlantas().then((ps) => (plantas.value = ps));

  map.on("sitio_seleccionado" as never, (e: { id: string }) => alSeleccionar(e.id));
  map.on("planta_seleccionada" as never, (e: { id: string }) => {
    plantaActual.value = null;
    abrirPlanta(e.id);
    const p = plantaActual.value;
    if (p && map) flyToSitio(map, p.lon, p.lat, 6);
  });
  map.on("coordenada_seleccionada" as never, (e: { lon: number; lat: number }) => {
    avisoTierra.value = "";
    void puntoLibre(e.lon, e.lat);
  });
  map.on("dique_rechazado" as never, (e: { distancia_km: number }) => {
    avisoTierra.value = `${MENSAJE_DIQUE_LEJOS} (a ${formatearNumero(e.distancia_km, 0)} km de la costa)`;
    clearTimeout(temporizadorAviso);
    temporizadorAviso = setTimeout(() => (avisoTierra.value = ""), 6000);
  });
  map.on("punto_en_tierra" as never, () => {
    avisoTierra.value = "ese punto cae en tierra firme; el recurso marino sólo se evalúa sobre el mar";
    clearTimeout(temporizadorAviso);
    temporizadorAviso = setTimeout(() => (avisoTierra.value = ""), 5000);
  });
});

onBeforeUnmount(() => {
  map?.remove();
  map = null;
});

watch(
  () => props.sitioActivo,
  (id) => {
    if (id && id !== sitioActivoLocal.value && sitios.value.some((s) => s.id === id)) sitioActivoLocal.value = id;
  }
);

// El flujo conmuta la capa visible: embalse→dique, turbina→turbina, resto→oleaje.
watch(
  () => props.dispositivo,
  (d) => {
    sincronizarTecnologia(tecnologiaDeDispositivo(d));
  }
);

/** Punto cualquiera del océano: se lee el recurso de la celda de mar más
 *  próxima de la malla global local. Las fuentes de fase 1 quedan de respaldo
 *  para los puntos que esa malla no cubre. */
async function puntoLibre(lon: number, lat: number) {
  consultando.value = true;
  try {
    const [global, oleaje, marea, rangoLocal, corriente] = await Promise.all([
      consultarRecursoGlobal(lon, lat),
      consultarOleaje(lon, lat),
      consultarMarea(lon, lat),
      consultarRangoMareal(lon, lat),
      consultarCorriente(lon, lat),
    ]);
    const hayOleaje = oleaje.estado !== "pendiente";
    const hm0 = global?.hm0_m ?? (hayOleaje ? oleaje.hm0_m : null);
    const te = global?.te_s ?? (hayOleaje ? oleaje.te_s : null);
    const rango = global?.rango_m ?? (rangoLocal.estado === "verificado" ? rangoLocal.rango_m : marea?.rango_m ?? null);
    const pico = global?.pico_ms ?? corriente.velocidad_ms ?? marea?.velocidad_ms ?? null;
    const tec = tecnologiaActiva.value;
    const dato = tec === "dique" ? rango : tec === "turbina" ? pico : potenciaOleaje(hm0 ?? undefined, te ?? undefined);
    const delGlobal = tec === "dique" ? global?.rango_m != null : tec === "turbina" ? global?.pico_ms != null : global?.hm0_m != null;
    const fuenteLocal =
      tec === "dique" ? rangoLocal.fuente : tec === "turbina" ? corriente.fuente : oleaje.fuente;
    const nuevo: SitioMapa = {
      id: `punto_${Date.now()}`,
      nombre: `${Math.abs(lat).toFixed(2)}° ${lat >= 0 ? "N" : "S"}, ${Math.abs(lon).toFixed(2)}° ${lon >= 0 ? "E" : "O"}`,
      pais: "Océano global",
      region: "libre",
      lon,
      lat,
      valor: potenciaOleaje(hm0 ?? undefined, te ?? undefined),
      unidad: "kW/m",
      fuente: delGlobal && global ? global.fuente : fuenteLocal,
      estado: dato === null ? "pendiente" : "inferido",
      tipo: tec === "undimotriz" ? "undimotriz" : "mareomotriz",
      hm0_m: hm0 ?? undefined,
      te_s: te ?? undefined,
      rango_m: rango ?? undefined,
      velocidad_ms: pico ?? undefined,
      profundidad_m: undefined,
    };
    sitios.value = [nuevo, ...sitios.value];
    sitioActivoLocal.value = nuevo.id;
    if (map) actualizarSitios(map, sitios.value);
    if (dato !== null) emit("seleccionar-sitio", nuevo);
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

/* Absoluto dentro de .carta: un 100 % de alto no resuelve en un hijo flex
   sin altura definida y el mapa compacto quedaba con 0 px de alto. */
.mapa {
  position: absolute;
  inset: 0;
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

.escala-fuente {
  margin-block-start: 2px;
  font-size: 10px;
  color: var(--tenue);
}

/* Caja mínima de la simulación: sólo la carta y la leyenda. */
.mapa-seccion.compacto .escala {
  inline-size: 9rem;
  inset-block-end: 4px;
  inset-inline-start: 4px;
  padding: 4px 8px;
}

.mapa-seccion.compacto .escala-fuente {
  display: none;
}

.ficha-enlace {
  margin: var(--s-2) 0 0;
  font-size: 11px;
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

.btn-simular:disabled {
  opacity: 0.5;
  cursor: not-allowed;
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
