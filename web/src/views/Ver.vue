<template>
  <section class="ver" aria-labelledby="titulo-ver">
    <h1 id="titulo-ver" class="titulo-nivel">Ver</h1>

    <div class="pregunta-bloque" data-testid="pregunta-conductor">
      <p class="pregunta-linea">
        <strong>{{ preguntaActiva.pregunta }}</strong>
      </p>
      <p class="tarea-linea">
        <span class="tarea-rotulo">Micro-tarea:</span>
        {{ preguntaActiva.tarea }}
      </p>
      <p
        v-if="cumpleTarea"
        class="veredicto-positivo"
        data-testid="veredicto-positivo"
        aria-live="polite"
      >
        ✓ Micro-tarea cumplida — Hm0 en el rango objetivo
      </p>
    </div>

    <div class="cabecera-lienzo">
      <h2 class="cabecera-lienzo-titulo">Oleaje</h2>
      <label class="toggle-fondo" data-testid="toggle-fondo-raster-wrap">
        <input
          type="checkbox"
          data-testid="toggle-fondo-raster"
          :checked="fondoActivo"
          aria-label="Alternar fondo raster del Caribe colombiano"
          @change="onToggleFondo(($event.target as HTMLInputElement).checked)"
        />
        <span>Fondo raster</span>
      </label>
    </div>

    <div class="lienzo-wrap">
      <FondoRaster ref="fondoRef" :activo="fondoActivo" :opacidad="0.6" :sitio="{ lon: -76.18, lat: 9.39 }" @update:activo="v => fondoActivo = v" />
      <canvas ref="canvasRef" class="oleaje" width="900" height="260" aria-label="Animación del oleaje y la boya"></canvas>
      <button class="btn-lienzo" @click="togglePausa" :aria-pressed="pausado ? 'true' : 'false'">
        <Icono :icono="pausado ? 'reproducir' : 'pausar'" />
        <span>{{ pausado ? "Reanudar" : "Pausar" }}</span>
      </button>
      <p v-if="sinSerie" class="aviso-sin-serie">
        <Icono icono="pendiente" tamano="sm" />
        <span>{{ sinSerie }}</span>
      </p>
    </div>

    <ControlesFisicos
      :hm0_m="params.hm0_m"
      :te_s="params.te_s"
      :b_pto_ns_m="params.b_pto_ns_m"
      @update:hm0_m="v => emit('update:params', { hm0_m: v })"
      @update:te_s="v => emit('update:params', { te_s: v })"
      @update:b_pto_ns_m="v => emit('update:params', { b_pto_ns_m: v })"
    />

    <div class="fila-resultado">
      <article class="tarjeta" data-testid="tarjeta-viviendas" aria-live="polite">
        <h2 class="tarjeta-titulo">Alcanza para</h2>
        <template v-if="viviendas !== null">
          <p class="tarjeta-cifra">{{ formatearNumero(viviendas, 0) }} <small>viviendas</small></p>
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

      <article class="tarjeta contraste" data-testid="tesis-contraste">
        <h2 class="tarjeta-titulo">Recurso frente al umbral de granja</h2>
        <div class="barras">
          <div v-for="b in BARRAS" :key="b.id" class="barra-fila" :data-testid="'barra-' + b.id">
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
  </section>
</template>

<script setup lang="ts">
import { onMounted, onBeforeUnmount, ref, watch, computed } from "vue";
import { AnimacionCanvas, PROFUNDIDAD_M } from "../components/AnimacionCanvas";
import ControlesFisicos from "../components/ControlesFisicos.vue";
import FondoRaster from "../components/FondoRaster.vue";
import Icono from "../components/Icono.vue";
import { formatearNumero } from "../utils/formato";
import type { Params } from "../api";
import { preguntas, evaluar_cumplimiento } from "../contenido/pedagogia";

// Ver ya no llama al servicio: el cálculo lo lanza main.ts una sola vez y
// alimenta los cuatro niveles. Aquí sólo se dibuja lo que llega.
const props = defineProps<{
  params: Params;
  resultado: Record<string, any> | null;
  viviendas: number | null;
  cargando?: boolean;
  error?: string;
}>();

const emit = defineEmits<{ (e: "update:params", v: Partial<Params>): void }>();

// El contraste de la tesis, sobre una escala común de 0 a 40 kW/m. Ancho y
// cifra se declaran juntos: la presentación no calcula ninguna magnitud, sólo
// coloca las dos que app/tesis.py::DENSIDADES ya publica.
const BARRAS = [
  {
    id: "sitio",
    rotulo: "Isla Fuerte",
    cifra: formatearNumero(8.9, 1),
    ancho: "22.25%",
    fuente: "Ortega et al. 2013 · verificado",
  },
  {
    id: "umbral",
    rotulo: "Umbral de granja",
    cifra: formatearNumero(40, 1),
    ancho: "100%",
    fuente: "Osorio et al. 2016 / Handbook cap. 1",
  },
];

const canvasRef = ref<HTMLCanvasElement | null>(null);
let animacion: AnimacionCanvas | null = null;
const sinSerie = ref("");
const pausado = ref(false); // reactivo: el rótulo del botón depende de él
const fondoActivo = ref(true); // spec: capa activa por defecto, opacidad 60%
const fondoRef = ref<InstanceType<typeof FondoRaster> | null>(null);

// Pregunta conductora y micro-tarea del nivel 'ver', leídas del mapa de
// pedagogía. Se actualizan reactivamente cuando cambia el resultado de la
// simulación y muestran un veredicto positivo al alcanzar el rango objetivo.
const preguntaActiva = computed(() => preguntas.ver);
const cumpleTarea = computed(() =>
  evaluar_cumplimiento('ver', props.resultado as Record<string, unknown> | null)
);

function onToggleFondo(v: boolean) {
  fondoActivo.value = v;
}

function numeroOnda(omega: number, h: number): number {
  // Newton-Raphson liviano, espejo de nucleo.olas.numero_onda — sólo para la k
  // del dibujo, no para el balance energético.
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

  // Series del contrato. Si el dispositivo no entrega z_m se declara la
  // ausencia; no se sintetiza una serie falsa.
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
  if (!canvasRef.value) return;
  animacion = new AnimacionCanvas(canvasRef.value);
  redibujar();
});

onBeforeUnmount(() => animacion?.detener());

watch(() => [props.params, props.resultado], redibujar, { deep: true });
</script>

<style scoped>
.ver {
  max-width: 72rem;
  margin-inline: auto;
  display: grid;
  gap: var(--s-4);
  align-content: start;
}

/* El título del nivel existe para el foco y el lector de pantalla; la pestaña
   ya lo nombra en grande, así que aquí va discreto. */
.titulo-nivel {
  font-size: var(--text-meta);
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--tenue);
}

/* Pregunta conductora del nivel — bloque discreto bajo el título.
   El veredicto positivo se enciende cuando la micro-tarea se cumple. */
.pregunta-bloque {
  display: grid;
  gap: var(--s-1);
  padding: var(--s-2) var(--s-4);
  border: 1px solid var(--borde-suave);
  border-radius: var(--radio-caja);
  background: var(--panel);
  box-shadow: var(--sombra-caja);
  border-inline-start: 3px solid var(--rol-mar-profundo);
}

.pregunta-linea {
  margin: 0;
  font-size: var(--text-cuerpo);
  color: var(--tinta);
}

.pregunta-linea strong {
  font-weight: 600;
}

.tarea-linea {
  margin: 0;
  font-size: var(--text-meta);
  color: var(--tenue);
}

.tarea-rotulo {
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin-inline-end: 4px;
}

.veredicto-positivo {
  margin: 0;
  font-size: var(--text-meta);
  color: var(--conf-verificado);
  font-weight: 600;
}

/* Cabecera del lienzo: rótulo del bloque + toggle del fondo raster. */
.cabecera-lienzo {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: var(--s-2);
}

.cabecera-lienzo-titulo {
  font-size: var(--text-meta);
  letter-spacing: 0.05em;
  text-transform: uppercase;
  color: var(--tenue);
  font-weight: 600;
  margin: 0;
}

.toggle-fondo {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: var(--text-meta);
  color: var(--tenue);
  cursor: pointer;
  min-block-size: 1.75rem;
}

.toggle-fondo input[type="checkbox"] {
  cursor: pointer;
  inline-size: 1rem;
  block-size: 1rem;
  accent-color: var(--rol-mar-profundo);
}

.toggle-fondo input[type="checkbox"]:focus-visible {
  outline: 2px solid var(--foco);
  outline-offset: 2px;
}

/* La animación es el protagonista del nivel: primera y a todo el ancho. */
.lienzo-wrap {
  position: relative;
  background: var(--panel);
  border: 1px solid var(--borde);
  border-block-start: 3px solid var(--rol-mar-profundo);
  border-radius: var(--radio-caja);
  overflow: hidden;
}

.oleaje {
  inline-size: 100%;
  block-size: min(22rem, 42dvh);
  display: block;
  background: transparent;
  position: relative;
}

.btn-lienzo {
  position: absolute;
  inset-block-start: var(--s-2);
  inset-inline-end: var(--s-2);
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  border: 1px solid var(--borde);
  border-radius: var(--radio);
  background: var(--panel);
  font-weight: 600;
  font-size: var(--text-meta);
  cursor: pointer;
  transition: border-color var(--dur-rapida) var(--ease-salida);
}

.btn-lienzo:hover {
  border-color: var(--foco);
}

.aviso-sin-serie {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  color: var(--tenue);
  font-size: var(--text-meta);
  margin-block: var(--s-1) 0;
}

.fila-resultado {
  display: grid;
  grid-template-columns: minmax(14rem, 1fr) minmax(20rem, 2fr);
  gap: var(--s-4);
  align-items: stretch;
}

.tarjeta {
  display: grid;
  align-content: start;
  gap: var(--s-1);
  padding: var(--s-2) var(--s-4);
  border: 1px solid var(--borde-suave);
  border-radius: var(--radio-caja);
  background: var(--panel);
  box-shadow: var(--sombra-caja);
}

.tarjeta-titulo {
  font-size: var(--text-meta);
  letter-spacing: 0.05em;
  text-transform: uppercase;
  color: var(--tenue);
  font-weight: 600;
}

.tarjeta-cifra {
  margin: 0;
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

.tarjeta-estado {
  display: flex;
  align-items: center;
  gap: 6px;
  margin: 0;
  font-size: var(--text-cuerpo);
  color: var(--tenue);
  font-style: italic;
}

/* ---- Contraste 8,9 frente a 40 sobre la misma escala ---- */
.barras {
  display: grid;
  gap: var(--s-2);
}

.barra-fila {
  display: grid;
  grid-template-columns: minmax(6rem, auto) minmax(6rem, 1fr) auto;
  grid-template-areas:
    'rotulo pista cifra'
    'fuente fuente fuente';
  align-items: center;
  column-gap: var(--s-2);
}

.barra-rotulo {
  grid-area: rotulo;
  font-weight: 600;
}

.barra-pista {
  grid-area: pista;
  display: block;
  block-size: 0.875rem;
  border-radius: 999px;
  background: var(--superficie);
  overflow: hidden;
}

.barra-relleno {
  display: block;
  block-size: 100%;
  border-radius: 999px;
  transition: inline-size var(--dur-media) var(--ease-salida);
}

.barra-relleno--sitio {
  background: var(--rol-mar-profundo);
}

/* El umbral no es una medida del sitio: se dibuja rayado para que se distinga
   de la barra medida incluso en escala de grises. */
.barra-relleno--umbral {
  background: repeating-linear-gradient(
    135deg,
    var(--tenue) 0 4px,
    transparent 4px 8px
  );
  border: 1px solid var(--tenue);
  box-sizing: border-box;
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
  font-size: var(--text-meta);
  color: var(--tenue);
}

@media (width <= 52rem) {
  .fila-resultado {
    grid-template-columns: 1fr;
  }
}

@media (width <= 26rem) {
  .barra-fila {
    grid-template-columns: 1fr auto;
    grid-template-areas:
      'rotulo cifra'
      'pista pista'
      'fuente fuente';
    row-gap: var(--s-1);
  }
}
</style>
