<template>
  <section class="ver" aria-label="Simulador de captura" ref="raiz" tabindex="-1">
    <!-- Escena: el corte del mar ocupa el ancho de la columna; encima sólo el
         rótulo del emplazamiento y el control de pausa. -->
    <div class="escena">
      <canvas
        ref="canvasRef"
        class="oleaje"
        width="1200"
        height="600"
        aria-label="Corte del mar con el dispositivo, el oleaje y la salida a la red"
      ></canvas>

      <header class="escena-cabecera">
        <h1 id="titulo-ver" class="titulo-nivel">Simulador de captura</h1>
        <p class="sitio-actual">
          <Icono icono="marca" tamano="sm" />
          <span>{{ nombreSitioActual }}</span>
        </p>
      </header>

      <div class="escena-acciones">
        <p v-if="sinSerie" class="aviso-sin-serie">
          <Icono icono="pendiente" tamano="sm" />
          <span>{{ sinSerie }}</span>
        </p>
        <button class="btn-lienzo" @click="togglePausa" :aria-pressed="pausado ? 'true' : 'false'">
          <Icono :icono="pausado ? 'reproducir' : 'pausar'" tamano="sm" />
          <span>{{ pausado ? "Reanudar" : "Pausar" }}</span>
        </button>
      </div>
    </div>

    <!-- Cabina: tres bloques bajo la escena. Qué se simula, con qué números y
         qué sale. Se lee de izquierda a derecha, como la cadena. -->
    <div class="cabina">
      <div class="bloque bloque--recurso">
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
          <div class="dispositivos-lista">
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
          </div>

          <label v-if="params.dispositivo === 'turbina_corriente'" class="campo-cimentacion">
            <span class="rotulo-grupo">Cimentación</span>
            <select v-model="cimentacionSeleccionada" @change="redibujar">
            <option value="pilote">Pilote clavado</option>
            <option value="gravedad">Bloque de gravedad</option>
            <option value="tripode">Trípode</option>
          </select>
        </label>
      </div>
    </div>

      <div class="bloque bloque--controles">
        <span class="rotulo-grupo">Controles</span>
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
      </div>

      <div class="bloque bloque--salida">
        <article class="tarjeta tarjeta--heroe" data-testid="tarjeta-viviendas" aria-live="polite">
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
      </div>
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

const props = defineProps<{
  params: Params;
  resultado: Record<string, any> | null;
  viviendas: number | null;
  cargando?: boolean;
  error?: string;
}>();

const emit = defineEmits<{ (e: "update:params", v: Partial<Params>): void }>();

const raiz = ref<HTMLElement | null>(null);
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
 *  usa para dibujar la longitud de onda a escala; no interviene en el cálculo. */
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

/** La carcasa llama aquí al pulsar «Simular este emplazamiento»: la escena
 *  recibe el foco y un destello breve para que se vea dónde pasó la acción. */
function enfocar() {
  const el = raiz.value;
  if (!el) return;
  el.focus({ preventScroll: true });
  el.setAttribute("data-destello", "");
  setTimeout(() => el.removeAttribute("data-destello"), 900);
}

defineExpose({ enfocar });

onMounted(() => {
  modoActivo.value =
    props.params.dispositivo === "turbina_corriente" || props.params.dispositivo === "embalse"
      ? "mareomotriz"
      : "undimotriz";

  if (!canvasRef.value) return;
  animacion = new AnimacionCanvas(canvasRef.value);
  // Ya no hay tira de lectura sobre el lienzo: el corte llega hasta el borde.
  animacion.pie = 0;
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
  display: flex;
  flex-direction: column;
  inline-size: 100%;
  block-size: 100%;
  min-block-size: 0;
  overflow: auto;
  background: var(--lienzo);
  outline: none;
}

/* ---- Escena ---- */
.escena {
  position: relative;
  flex: none;
  aspect-ratio: 21 / 9;
  min-block-size: 15rem;
  max-block-size: 58%;
  overflow: hidden;
  background: var(--map-oceano);
  transition: box-shadow var(--dur-media) var(--ease-salida);
}

.ver[data-destello] .escena {
  box-shadow: inset 0 0 0 3px var(--rol-captado);
}

.oleaje {
  position: absolute;
  inset: 0;
  inline-size: 100%;
  block-size: 100%;
  display: block;
}

.escena-cabecera {
  position: absolute;
  inset-block-start: var(--s-3);
  inset-inline-start: var(--s-3);
  display: grid;
  gap: 2px;
  padding: var(--s-2) var(--s-3);
  border-radius: var(--radio-caja);
  background: oklch(1 0 0 / 0.72);
  backdrop-filter: blur(8px);
  box-shadow: var(--sombra-caja);
}

.titulo-nivel {
  font-size: var(--text-seccion);
  font-weight: 600;
  color: var(--tinta);
  margin: 0;
  white-space: nowrap;
}

.sitio-actual {
  display: flex;
  align-items: center;
  gap: 4px;
  margin: 0;
  font-size: var(--text-meta);
  color: var(--tenue);
}

.escena-acciones {
  position: absolute;
  inset-block-end: var(--s-3);
  inset-inline-end: var(--s-3);
  display: flex;
  align-items: center;
  gap: var(--s-2);
}

.btn-lienzo {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: var(--s-1) 10px;
  border: 1px solid var(--marco-linea);
  border-radius: var(--radio);
  background: oklch(0.24 0.02 238 / 0.82);
  color: var(--marco-tinta);
  font-weight: 600;
  font-size: var(--text-meta);
  cursor: pointer;
  backdrop-filter: blur(6px);
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
  background: oklch(1 0 0 / 0.8);
  color: var(--tenue);
  font-size: var(--text-meta);
}

/* ---- Cabina: tres bloques ---- */
.cabina {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(15rem, 1fr));
  gap: var(--s-3);
  padding: var(--s-3);
  flex: 1;
}

.bloque {
  display: flex;
  flex-direction: column;
  gap: var(--s-3);
  min-inline-size: 0;
}

.rotulo-grupo {
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--tenue);
}

/* ---- Selección de recurso y dispositivo ---- */
.modos {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 2px;
  padding: 3px;
  border-radius: var(--radio-caja);
  background: var(--superficie);
}

.btn-modo {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: var(--s-1) var(--s-2);
  border: none;
  border-radius: calc(var(--radio-caja) - 3px);
  background: transparent;
  color: var(--tenue);
  font-weight: 600;
  cursor: pointer;
  transition: background-color var(--dur-rapida) var(--ease-salida), color var(--dur-rapida) var(--ease-salida);
}

.btn-modo.activo {
  background: var(--panel);
  color: var(--rol-mar-profundo);
  box-shadow: var(--sombra-caja);
}

.dispositivos {
  display: grid;
  gap: var(--s-1);
}

.dispositivos-lista {
  display: grid;
  gap: 4px;
}

.btn-dispositivo {
  text-align: start;
  padding: 6px 10px;
  border: 1px solid var(--borde-suave);
  border-radius: var(--radio);
  background: var(--panel);
  font-size: var(--text-meta);
  font-weight: 500;
  cursor: pointer;
  transition: border-color var(--dur-rapida) var(--ease-salida), background-color var(--dur-rapida) var(--ease-salida);
}

.btn-dispositivo:hover {
  border-color: var(--borde);
}

.btn-dispositivo.activo {
  border-color: var(--rol-mar-profundo);
  background: var(--acento-suave);
  color: var(--rol-mar-profundo);
  font-weight: 600;
}

.campo-cimentacion {
  display: grid;
  gap: 4px;
  margin-block-start: var(--s-1);
}

.campo-cimentacion select {
  min-inline-size: 0;
  padding: 4px 8px;
  border: 1px solid var(--borde);
  border-radius: var(--radio);
  background: var(--panel);
  font-size: var(--text-meta);
}

/* ---- Tarjetas de salida ---- */
.tarjeta > * {
  min-inline-size: 0;
  overflow-wrap: anywhere;
}

.tarjeta {
  display: grid;
  align-content: start;
  gap: var(--s-1);
  padding: var(--s-3);
  border: 1px solid var(--borde-suave);
  border-radius: var(--radio-caja);
  background: var(--panel);
  box-shadow: var(--sombra-caja);
}

.tarjeta--heroe {
  background: linear-gradient(160deg, var(--panel), var(--acento-suave));
}

.tarjeta-titulo {
  display: flex;
  align-items: center;
  gap: 6px;
  font-family: var(--font-sans);
  font-size: 11px;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--tenue);
  font-weight: 700;
  margin: 0;
}

.tarjeta-cifra {
  margin: 2px 0 0;
  font-family: var(--font-display);
  font-size: var(--text-heroe);
  font-weight: 700;
  line-height: 0.95;
  letter-spacing: -0.03em;
  color: var(--rol-captado);
}

.tarjeta-cifra small {
  font-family: var(--font-sans);
  font-size: 0.26em;
  font-weight: 600;
  letter-spacing: 0;
  color: var(--tenue);
}

.tarjeta-subcifra {
  display: flex;
  align-items: center;
  gap: 4px;
  margin: var(--s-1) 0 0;
  font-size: var(--text-meta);
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

@media (width <= 90rem) {
  .bloque--salida {
    flex-direction: row;
  }

  .bloque--salida > * {
    flex: 1;
  }
}

@media (width <= 64rem) {
  .escena {
    max-block-size: none;
  }

  .cabina {
    grid-template-columns: minmax(0, 1fr);
  }

  .bloque--salida {
    flex-direction: column;
  }
}
</style>
