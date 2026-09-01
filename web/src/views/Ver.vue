<template>
  <section class="ver" aria-label="Simulador de captura">
    <canvas
      ref="canvasRef"
      class="oleaje"
      width="1200"
      height="600"
      aria-label="Corte del mar con el dispositivo, el oleaje y la salida a la red"
    ></canvas>

    <!-- Cabina de mando: qué se simula y con qué números. Se oculta cuando el
         simulador queda reducido en la esquina, donde sólo cabe la escena. -->
    <div v-if="!reducido" class="cabina cabina--controles">
      <header class="cabina-cabecera">
        <h1 id="titulo-ver" class="titulo-nivel">Simulador de captura</h1>
        <p class="sitio-actual">{{ nombreSitioActual }}</p>
      </header>

      <div class="modos" role="group" aria-label="Tipo de recurso">
        <button
          v-for="m in MODOS"
          :key="m.id"
          type="button"
          class="btn-modo"
          :class="{ activo: modoActivo === m.id }"
          :aria-pressed="modoActivo === m.id ? 'true' : 'false'"
          @click="seleccionarModo(m.id)"
        >
          <Icono :icono="m.id" tamano="sm" />
          <span>{{ m.label }}</span>
        </button>
      </div>

      <div class="dispositivos">
        <span class="rotulo-grupo">Dispositivo</span>
        <button
          v-for="d in dispositivosDelModo"
          :key="d.id"
          type="button"
          class="btn-dispositivo"
          :class="{ activo: params.dispositivo === d.id }"
          :aria-pressed="params.dispositivo === d.id ? 'true' : 'false'"
          @click="seleccionarDispositivo(d.id)"
        >
          {{ d.nombre }}
        </button>

        <label v-if="params.dispositivo === 'turbina_corriente'" class="campo-cimentacion">
          <span class="rotulo-grupo">Cimentación</span>
          <select v-model="cimentacionSeleccionada" @change="redibujar">
            <option value="pilote">Pilote clavado</option>
            <option value="gravedad">Bloque de gravedad</option>
            <option value="tripode">Trípode</option>
          </select>
        </label>
      </div>

      <ControlesFisicos
        :hm0_m="params.hm0_m"
        :te_s="params.te_s"
        :b_pto_ns_m="params.b_pto_ns_m"
        :modo-energia="modoActivo"
        :velocidad-corriente="velocidadCorriente"
        :rango-marea="rangoMarea"
        :profundidad_m="params.profundidad_m || 30"
        @update:hm0_m="v => emit('update:params', { hm0_m: v })"
        @update:te_s="v => emit('update:params', { te_s: v })"
        @update:b_pto_ns_m="v => emit('update:params', { b_pto_ns_m: v })"
        @update:velocidad-corriente="alCambiarVelCorriente"
        @update:rango-marea="alCambiarRangoMarea"
        @update:profundidad_m="v => emit('update:params', { profundidad_m: v })"
      />

      <div class="salida">
        <article class="tarjeta" data-testid="tarjeta-viviendas" aria-live="polite">
        <h2 class="tarjeta-titulo">
          <Icono icono="vivienda" tamano="sm" />
          <span>Alcanza para</span>
        </h2>
        <template v-if="viviendas !== null">
          <p class="tarjeta-cifra">{{ formatearNumero(viviendas, 0) }} <small>viviendas</small></p>
          <p class="tarjeta-subcifra">
            <Icono icono="emision" tamano="sm" />
            <span>{{ formatearNumero(viviendas * 1.8, 1) }} t CO₂ evitadas al año</span>
          </p>
        </template>
        <p v-else-if="cargando" class="tarjeta-estado">
          <Icono icono="calculando" tamano="sm" />
          <span>integrando la cadena…</span>
        </p>
        <p v-else class="tarjeta-estado semaforo semaforo--pendiente">
          <Icono icono="pendiente" tamano="sm" />
          <span>pendiente — {{ error || "consumo residencial sin fuente verificada" }}</span>
        </p>
      </article>

      <article class="tarjeta" data-testid="tesis-contraste">
        <h2 class="tarjeta-titulo">Frente al umbral de granja comercial</h2>
        <div class="barras">
          <div v-for="b in barrasContraste" :key="b.id" class="barra-fila" :data-testid="'barra-' + b.id">
            <span class="barra-rotulo">{{ b.rotulo }}</span>
            <span class="barra-pista">
              <span class="barra-relleno" :class="'barra-relleno--' + b.id" :style="{ inlineSize: b.ancho }"></span>
            </span>
            <span class="barra-cifra">{{ b.cifra }} <small>kW/m</small></span>
            <span class="barra-fuente">{{ b.fuente }}</span>
          </div>
        </div>
      </article>
      </div>

      <div class="pregunta-bloque" data-testid="pregunta-conductor">
        <p class="pregunta-linea"><strong>{{ preguntaActiva.pregunta }}</strong></p>
        <p class="tarea-linea">
          <span class="tarea-rotulo">Micro-tarea</span>
          {{ preguntaActiva.tarea }}
        </p>
        <p v-if="cumpleTarea" class="veredicto" data-testid="veredicto-positivo" aria-live="polite">
          <Icono icono="verificado" tamano="sm" />
          <span>Hm0 en el rango objetivo</span>
        </p>
      </div>
    </div>

    <div v-if="!reducido" class="cabina cabina--acciones">
      <button class="btn-lienzo" @click="togglePausa" :aria-pressed="pausado ? 'true' : 'false'">
        <Icono :icono="pausado ? 'reproducir' : 'pausar'" tamano="sm" />
        <span>{{ pausado ? "Reanudar" : "Pausar" }}</span>
      </button>
      <p v-if="sinSerie" class="aviso-sin-serie">
        <Icono icono="pendiente" tamano="sm" />
        <span>{{ sinSerie }}</span>
      </p>
    </div>
  </section>
</template>

<script setup lang="ts">
import { onMounted, onBeforeUnmount, ref, watch, computed } from "vue";
import { AnimacionCanvas, PROFUNDIDAD_M, type TipoCimentacion } from "../components/AnimacionCanvas";
import ControlesFisicos from "../components/ControlesFisicos.vue";
import Icono from "../components/Icono.vue";
import { formatearNumero } from "../utils/formato";
import type { Params } from "../api";
import { preguntas, evaluar_cumplimiento } from "../contenido/pedagogia";

const props = defineProps<{
  params: Params;
  resultado: Record<string, any> | null;
  viviendas: number | null;
  cargando?: boolean;
  error?: string;
  /** Reducido a miniatura en la esquina: sólo se pinta la escena, sin paneles
   *  con los que no se puede operar a ese tamaño. */
  reducido?: boolean;
}>();

const emit = defineEmits<{ (e: "update:params", v: Partial<Params>): void }>();

const canvasRef = ref<HTMLCanvasElement | null>(null);
let animacion: AnimacionCanvas | null = null;
const sinSerie = ref("");
const pausado = ref(false);

const modoActivo = ref<"undimotriz" | "mareomotriz">("undimotriz");
const cimentacionSeleccionada = ref<TipoCimentacion>("pilote");
const velocidadCorriente = ref(2.2);
const rangoMarea = ref(3.5);

const MODOS = [
  { id: "undimotriz" as const, label: "Oleaje" },
  { id: "mareomotriz" as const, label: "Marea" },
];

const DISPOSITIVOS_UNDIMOTRIZ = [
  { id: "absorbedor_puntual", nombre: "Absorbedor puntual" },
  { id: "owc", nombre: "Columna de agua oscilante" },
];

const DISPOSITIVOS_MAREOMOTRIZ = [
  { id: "turbina_corriente", nombre: "Turbina de corriente" },
  { id: "embalse", nombre: "Dique mareal" },
];

const dispositivosDelModo = computed(() =>
  modoActivo.value === "mareomotriz" ? DISPOSITIVOS_MAREOMOTRIZ : DISPOSITIVOS_UNDIMOTRIZ
);

const NOMBRES_SITIO: Record<string, string> = {
  isla_fuerte: "Isla Fuerte, Caribe colombiano",
  san_andres: "San Andrés, Caribe insular",
  tumaco: "Tumaco, Pacífico colombiano",
  bahia_malaga: "Bahía Málaga, Pacífico",
  islas_rosario: "Islas del Rosario",
  puerto_bolivar: "Puerto Bolívar, La Guajira",
  bahia_fundy: "Bahía de Fundy, Canadá",
  pentland_firth: "Pentland Firth, Escocia",
  la_rance: "Estuario de La Rance, Francia",
  severn_estuary: "Estuario del Severn, Reino Unido",
  cook_strait: "Estrecho de Cook, Nueva Zelanda",
  estrecho_magallanes: "Estrecho de Magallanes, Chile",
  sihwa_lake: "Lago Sihwa, Corea del Sur",
  oregon_coast: "PacWave, Oregón",
  hawaii_oahu: "Kaneohe Bay, Oahu",
  costa_da_morte: "Costa da Morte, Galicia",
  peniche: "Peniche, Portugal",
  messina_strait: "Estrecho de Messina, Italia",
  king_island: "King Island, Tasmania",
  cape_point: "Cape Point, Sudáfrica",
  golfo_san_jose: "Golfo San José, Argentina",
};

const nombreSitioActual = computed(
  () => NOMBRES_SITIO[props.params.sitio_id || "isla_fuerte"] || "Punto marino seleccionado"
);

const preguntaActiva = computed(() => preguntas.ver);
const cumpleTarea = computed(() =>
  evaluar_cumplimiento("ver", props.resultado as Record<string, unknown> | null)
);

const barrasContraste = computed(() => {
  const recursoActual = props.resultado?.eslabones?.[0]?.detalle?.j_w_m;
  const kwm = recursoActual ? recursoActual / 1000 : 8.9;
  const umbral = 40.0;
  const anchoPct = Math.min(100, Math.max(3, (kwm / umbral) * 100));

  return [
    {
      id: "sitio",
      rotulo: nombreSitioActual.value.split(",")[0],
      cifra: formatearNumero(kwm, 1),
      ancho: `${anchoPct.toFixed(1)}%`,
      fuente: "Ortega et al. 2013 — verificado",
    },
    {
      id: "umbral",
      rotulo: "Umbral de granja",
      cifra: formatearNumero(40, 1),
      ancho: "100%",
      fuente: "Osorio et al. 2016 / Handbook cap. 1",
    },
  ];
});

function seleccionarModo(modo: "undimotriz" | "mareomotriz") {
  modoActivo.value = modo;
  if (modo === "mareomotriz") {
    if (props.params.dispositivo !== "turbina_corriente" && props.params.dispositivo !== "embalse") {
      emit("update:params", { dispositivo: "turbina_corriente" });
    }
  } else if (props.params.dispositivo !== "absorbedor_puntual" && props.params.dispositivo !== "owc") {
    emit("update:params", { dispositivo: "absorbedor_puntual" });
  }
}

function seleccionarDispositivo(id: string) {
  emit("update:params", { dispositivo: id });
}

function alCambiarVelCorriente(v: number) {
  velocidadCorriente.value = v;
  redibujar();
}

function alCambiarRangoMarea(v: number) {
  rangoMarea.value = v;
  redibujar();
}

/** Número de onda por Newton-Raphson sobre la relación de dispersión. Sólo se
 *  usa para dibujar la longitud de onda a escala; no interviene en el cálculo,
 *  que llega ya resuelto desde el servicio. */
function numeroOnda(omega: number, h: number): number {
  const g = 9.81;
  const arg = (omega * omega * h) / g;
  let th = Math.tanh(arg);
  if (th <= 0) th = 1e-12;
  let k = (omega * omega / g) / Math.sqrt(th);
  for (let i = 0; i < 30; i++) {
    const kh = k * h;
    const th2 = Math.tanh(kh);
    const f = g * k * th2 - omega * omega;
    const ch = Math.cosh(kh);
    const sech2 = 1 / (ch * ch);
    const df = g * th2 + g * k * h * sech2;
    k -= f / df;
    if (Math.abs(f) < 1e-10) break;
  }
  return k;
}

function redibujar() {
  if (!animacion) return;
  const { hm0_m, te_s, b_pto_ns_m } = props.params;
  const profundidad = props.params.profundidad_m || PROFUNDIDAD_M;
  const k = numeroOnda((2 * Math.PI) / te_s, profundidad);

  const r = props.resultado;
  const t = r?.series?.t_s ?? null;
  const z = r?.series?.z_m ?? null;
  const series =
    Array.isArray(t) && Array.isArray(z) && t.length && z.length ? { t_s: t, z_m: z } : null;

  animacion.cargarSimulacion({
    series,
    k,
    Hm0: hm0_m,
    Te: te_s,
    Bpto: b_pto_ns_m,
    dispositivo: String(r?.metadatos?.dispositivo ?? props.params.dispositivo),
    profundidad_m: profundidad,
    modoEnergia: modoActivo.value,
    cimentacion: cimentacionSeleccionada.value,
    velocidadCorriente: velocidadCorriente.value,
    rangoMarea: rangoMarea.value,
    potenciaCaptadaW: Number(r?.potencia_nominal_w) || null,
  });
  sinSerie.value = animacion.sinSerieMsg;
  animacion.arrancar();
  pausado.value = animacion.pausado;
}

function togglePausa() {
  if (!animacion) return;
  if (animacion.pausado) animacion.reanudar();
  else animacion.pausar();
  pausado.value = animacion.pausado;
}

onMounted(() => {
  modoActivo.value =
    props.params.dispositivo === "turbina_corriente" || props.params.dispositivo === "embalse"
      ? "mareomotriz"
      : "undimotriz";

  if (!canvasRef.value) return;
  animacion = new AnimacionCanvas(canvasRef.value);
  redibujar();
});

onBeforeUnmount(() => animacion?.detener());

watch(
  () => [props.params, props.resultado, modoActivo.value],
  () => {
    if (props.params.dispositivo === "turbina_corriente" || props.params.dispositivo === "embalse") {
      modoActivo.value = "mareomotriz";
    }
    redibujar();
  },
  { deep: true }
);
</script>

<style scoped>
.ver {
  position: relative;
  inline-size: 100%;
  block-size: 100%;
  overflow: hidden;
  background: var(--map-oceano);
}

.oleaje {
  position: absolute;
  inset: 0;
  inline-size: 100%;
  block-size: 100%;
  display: block;
}

/* ---- Cabina: los paneles que flotan sobre la escena ---- */
.cabina {
  position: absolute;
  z-index: 3;
  display: flex;
  flex-direction: column;
  gap: var(--s-2);
}

.cabina--controles {
  inset-block-start: var(--s-2);
  inset-inline-start: var(--s-2);
  inline-size: min(23rem, 40vw);
  /* La miniatura vive abajo a la izquierda, justo debajo: la cabina termina
     antes de llegar a ella. */
  max-block-size: calc(
    100% - var(--lectura-alto, 0px) - var(--miniatura-alto, 0px) - var(--s-6)
  );
  overflow: auto;
  padding: var(--s-3);
  border: 1px solid var(--borde);
  border-radius: var(--radio-caja);
  background: var(--panel);
  box-shadow: var(--sombra-caja);
}

/* Salida dentro de la misma cabina: así el lado derecho del corte queda
   entero para la costa, la subestación y la red, que es donde termina la
   cadena y hay que poder verla. */
.salida {
  display: grid;
  gap: var(--s-2);
}

.cabina--acciones {
  inset-block-end: calc(var(--lectura-alto, 0px) + var(--s-2));
  inset-inline-end: var(--s-2);
  align-items: end;
}

.cabina-cabecera {
  display: grid;
  gap: 2px;
}

.titulo-nivel {
  font-size: var(--text-seccion);
  font-weight: 700;
  color: var(--tinta);
  margin: 0;
}

.sitio-actual {
  margin: 0;
  font-size: var(--text-meta);
  color: var(--tenue);
}

/* ---- Selección de recurso y dispositivo ---- */
.modos {
  display: flex;
  gap: var(--s-1);
}

.btn-modo {
  flex: 1;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: var(--s-1) var(--s-2);
  border: 1px solid var(--borde);
  border-radius: var(--radio);
  background: var(--lienzo);
  font-weight: 600;
  cursor: pointer;
}

.btn-modo.activo {
  background: var(--rol-mar-profundo);
  border-color: var(--rol-mar-profundo);
  color: var(--panel);
}

.dispositivos {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--s-1);
}

.rotulo-grupo {
  font-size: var(--text-meta);
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--tenue);
}

.btn-dispositivo {
  padding: 2px 8px;
  border: 1px solid var(--borde-suave);
  border-radius: var(--radio);
  background: var(--lienzo);
  font-size: var(--text-meta);
  cursor: pointer;
}

.btn-dispositivo.activo {
  border-color: var(--rol-mar-profundo);
  background: var(--acento-suave);
  font-weight: 600;
}

.campo-cimentacion {
  display: flex;
  align-items: center;
  gap: 6px;
  inline-size: 100%;
}

.campo-cimentacion select {
  flex: 1;
  min-inline-size: 0;
  padding: 2px 6px;
  border: 1px solid var(--borde);
  border-radius: var(--radio);
  background: var(--panel);
  font-size: var(--text-meta);
}

/* ---- Pregunta conductora ---- */
.pregunta-bloque {
  display: grid;
  gap: 2px;
  padding: var(--s-2);
  border-radius: var(--radio);
  background: var(--superficie);
}

.pregunta-linea {
  margin: 0;
  font-size: var(--text-meta);
}

.tarea-linea {
  margin: 0;
  font-size: 11px;
  color: var(--tenue);
}

.tarea-rotulo {
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin-inline-end: 4px;
}

.veredicto {
  display: flex;
  align-items: center;
  gap: 4px;
  margin: 0;
  font-size: 11px;
  font-weight: 600;
  color: var(--conf-verificado);
}

/* ---- Tarjetas de salida ---- */
.tarjeta > *,
.barra-fila > * {
  min-inline-size: 0;
  overflow-wrap: anywhere;
}

.tarjeta {
  display: grid;
  align-content: start;
  gap: var(--s-1);
  padding: var(--s-2) var(--s-3);
  border: 1px solid var(--borde);
  border-radius: var(--radio-caja);
  background: var(--panel);
  box-shadow: var(--sombra-caja);
}

.tarjeta-titulo {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: var(--text-meta);
  letter-spacing: 0.05em;
  text-transform: uppercase;
  color: var(--tenue);
  font-weight: 700;
  margin: 0;
}

.tarjeta-cifra {
  margin: 2px 0 0;
  font-size: var(--text-cifra);
  font-weight: 700;
  line-height: 1.05;
  color: var(--rol-captado);
}

.tarjeta-cifra small {
  font-size: 0.32em;
  font-weight: 600;
  color: var(--tenue);
}

.tarjeta-subcifra {
  display: flex;
  align-items: center;
  gap: 4px;
  margin: 2px 0 0;
  font-size: 11px;
  color: var(--tenue);
}

.tarjeta-estado {
  display: flex;
  align-items: center;
  gap: 6px;
  margin: 0;
  font-size: var(--text-meta);
  color: var(--tenue);
  font-style: italic;
}

.barras {
  display: grid;
  gap: var(--s-2);
  margin-block-start: 2px;
}

.barra-fila {
  display: grid;
  grid-template-columns: minmax(5rem, 1fr) auto;
  grid-template-areas:
    'rotulo cifra'
    'pista pista'
    'fuente fuente';
  align-items: baseline;
  column-gap: var(--s-2);
}

.barra-rotulo {
  grid-area: rotulo;
  font-weight: 600;
  font-size: var(--text-meta);
}

.barra-pista {
  grid-area: pista;
  display: block;
  block-size: 0.5rem;
  margin-block: 2px;
  border-radius: 2px;
  background: var(--superficie);
  overflow: hidden;
}

.barra-relleno {
  display: block;
  block-size: 100%;
  transition: inline-size var(--dur-media) var(--ease-salida);
}

.barra-relleno--sitio {
  background: var(--rol-mar-medio);
}

.barra-relleno--umbral {
  background: repeating-linear-gradient(135deg, var(--tenue) 0 3px, transparent 3px 7px);
}

.barra-cifra {
  grid-area: cifra;
  font-size: var(--text-seccion);
  font-weight: 700;
  white-space: nowrap;
}

.barra-cifra small {
  font-size: 0.55em;
  font-weight: 600;
  color: var(--tenue);
}

.barra-fuente {
  grid-area: fuente;
  font-size: 11px;
  color: var(--tenue);
}

/* ---- Acciones sobre la escena ---- */
.btn-lienzo {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: var(--s-1) 10px;
  border: 1px solid oklch(1 0 0 / 0.25);
  border-radius: var(--radio);
  background: oklch(0.24 0.02 238 / 0.85);
  color: oklch(0.97 0.004 106);
  font-weight: 600;
  font-size: var(--text-meta);
  cursor: pointer;
}

.btn-lienzo:hover {
  background: oklch(0.24 0.02 238 / 0.97);
}

.aviso-sin-serie {
  display: flex;
  align-items: center;
  gap: 6px;
  margin: 0;
  padding: var(--s-1) var(--s-2);
  border-radius: var(--radio);
  background: var(--panel);
  color: var(--tenue);
  font-size: var(--text-meta);
}

@media (width <= 56rem) {
  .cabina--controles {
    inline-size: min(18rem, 62vw);
  }
}
</style>
