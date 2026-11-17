<template>
  <section
    class="tecnologia"
    aria-labelledby="titulo-tecnologia"
    data-testid="vista-tecnologia"
  >
    <div ref="marRef" class="mar-realista" aria-hidden="true"></div>
    <div class="velo" aria-hidden="true"></div>

    <div class="tecnologia-contenido">
      <p class="marca">{{ nombreFamilia }}</p>
      <h1 id="titulo-tecnologia">Elige la tecnología</h1>
      <p class="bajada">
        Elige el dispositivo que vas a simular. Debajo están las demás tecnologías que se han
        probado en el mar, para consulta.
      </p>

      <div class="opciones" role="group" aria-label="Tecnologías de la familia">
        <button
          v-for="t in opciones"
          :key="t.id"
          type="button"
          class="opcion"
          :class="{ activa: dispositivo === t.id }"
          :aria-pressed="dispositivo === t.id ? 'true' : 'false'"
          :data-testid="'tecnologia-' + t.id"
          @click="emit('elegir-tecnologia', t.id)"
        >
          <div class="opcion-lienzo" aria-hidden="true">
            <canvas :ref="(el) => registrarCanvas(t.id, el)"></canvas>
          </div>
          <span class="opcion-nombre">{{ t.nombre }}</span>
          <span class="opcion-detalle">{{ t.descripcion }}</span>
        </button>
      </div>


      <ReferenciasCatalogo :familia="familia" />

      <div class="navegacion">
        <button type="button" class="btn-atras" data-testid="volver-inicio" @click="emit('volver')">
          Volver al inicio
        </button>
        <button type="button" class="btn-seguir" data-testid="seguir-origen" @click="emit('continuar')">
          Seguir al origen de datos
        </button>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { MarRealista } from '../components/MarRealista'
import { AnimacionCanvas } from '../components/AnimacionCanvas'
import { TECNOLOGIAS_POR_FAMILIA, type Familia } from '../flujo/estado'
import ReferenciasCatalogo from '../components/ReferenciasCatalogo.vue'

const props = defineProps<{
  familia: Familia
  dispositivo: string
}>()

const emit = defineEmits<{
  (e: 'elegir-tecnologia', id: string): void
  (e: 'continuar'): void
  (e: 'volver'): void
}>()

const opciones = computed(() => TECNOLOGIAS_POR_FAMILIA[props.familia] ?? [])
const nombreFamilia = computed(() =>
  props.familia === 'mareomotriz' ? 'Mareomotriz' : 'Undimotriz'
)

const marRef = ref<HTMLElement | null>(null)
let mar: MarRealista | null = null

const lienzos = new Map<string, HTMLCanvasElement>()
const previas = new Map<string, AnimacionCanvas>()

function registrarCanvas(id: string, el: unknown) {
  if (el && typeof el === 'object' && 'tagName' in el) {
    lienzos.set(id, el as HTMLCanvasElement)
  } else {
    lienzos.delete(id)
  }
}

/** Serie sintética de demo: onda regular para que la prevista se mueva sin API. */
function serieDemo(te: number) {
  const t_s: number[] = []
  const z_m: number[] = []
  const n = 96
  for (let i = 0; i <= n; i++) {
    const t = (i / n) * te * 3
    t_s.push(t)
    z_m.push(Math.sin((2 * Math.PI * t) / te) * 0.55)
  }
  return { t_s, z_m }
}

function configurarPrevia(id: string, canvas: HTMLCanvasElement) {
  previas.get(id)?.detener()
  const anim = new AnimacionCanvas(canvas)
  anim.pie = 0
  anim.modoPrevia = true
  const te = 7
  const omega = (2 * Math.PI) / te
  // lambda ≈ g*Te²/(2π) aguada larga; se fija un k razonable para el corte.
  const k = 0.09
  if (id === 'embalse') {
    anim.cargarSimulacion({
      series: serieDemo(te),
      k,
      Hm0: 1.2,
      Te: te,
      Bpto: 80_000,
      dispositivo: 'embalse',
      modoEnergia: 'mareomotriz',
      rangoMarea: 3.5,
      profundidad_m: 28,
      velocidadCorriente: 1.2,
    })
  } else if (id === 'turbina_corriente') {
    anim.cargarSimulacion({
      series: serieDemo(te),
      k,
      Hm0: 0.8,
      Te: te,
      Bpto: 80_000,
      dispositivo: 'turbina_corriente',
      modoEnergia: 'mareomotriz',
      velocidadCorriente: 2.2,
      rangoMarea: 2.5,
      profundidad_m: 30,
      cantidadUnidades: 3,
      cimentacion: 'pilote',
    })
  } else {
    anim.cargarSimulacion({
      series: serieDemo(te),
      k,
      Hm0: 1.5,
      Te: te,
      Bpto: 80_000,
      dispositivo: 'absorbedor_puntual',
      modoEnergia: 'undimotriz',
      profundidad_m: 30,
    })
  }
  void omega
  anim.arrancar()
  previas.set(id, anim)
}

function montarPrevias() {
  for (const [id, canvas] of lienzos) {
    if (canvas && canvas.isConnected) configurarPrevia(id, canvas)
  }
}

onMounted(() => {
  if (marRef.value) {
    try {
      mar = new MarRealista(marRef.value)
      mar.arrancar()
    } catch {
      mar = null
    }
  }
  // Un fotograma para que el layout asiente antes de medir el canvas.
  requestAnimationFrame(() => montarPrevias())
})

watch(
  () => props.familia,
  async () => {
    for (const anim of previas.values()) anim.detener()
    previas.clear()
    lienzos.clear()
    await nextTick()
    requestAnimationFrame(() => montarPrevias())
  }
)

onBeforeUnmount(() => {
  mar?.detener()
  mar = null
  for (const anim of previas.values()) anim.detener()
  previas.clear()
})
</script>

<style scoped>
.tecnologia {
  position: relative;
  display: flex;
  inline-size: 100%;
  block-size: 100%;
  min-block-size: 100%;
  overflow: hidden;
  border-radius: 0;
  background:
    linear-gradient(
      180deg,
      oklch(0.78 0.06 220) 0%,
      oklch(0.55 0.09 210) 28%,
      oklch(0.38 0.08 200) 52%,
      oklch(0.28 0.05 200) 100%
    );
}

.mar-realista {
  position: absolute;
  inset: 0;
  inline-size: 100%;
  block-size: 100%;
}

.mar-realista :deep(canvas) {
  display: block;
  inline-size: 100%;
  block-size: 100%;
}

.velo {
  position: absolute;
  inset: 0;
  pointer-events: none;
  background:
    radial-gradient(ellipse 70% 55% at 50% 48%, oklch(0.1 0.02 240 / 0.18) 0%, transparent 70%),
    linear-gradient(
      180deg,
      oklch(0.12 0.03 240 / 0.62) 0%,
      oklch(0.12 0.03 240 / 0.38) 40%,
      oklch(0.08 0.02 240 / 0.28) 100%
    );
}

.tecnologia-contenido {
  position: relative;
  z-index: 1;
  display: grid;
  gap: var(--s-3);
  align-content: center;
  justify-items: center;
  inline-size: 100%;
  block-size: 100%;
  padding: var(--s-6) var(--s-4);
  text-align: center;
  color: oklch(0.98 0.005 106);
  text-shadow: 0 1px 12px oklch(0.1 0.02 240 / 0.55);
  overflow: auto;
}

.marca {
  margin: 0;
  font-size: var(--text-meta);
  font-weight: 700;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  opacity: 0.92;
}

.tecnologia h1 {
  margin: 0;
  font-size: clamp(1.9rem, 3.5vw, 2.6rem);
  letter-spacing: -0.01em;
  color: oklch(0.98 0.005 106);
}

.bajada {
  margin: 0;
  max-inline-size: 36rem;
  color: oklch(0.98 0.005 106);
  font-size: 16px;
  font-weight: 500;
  text-shadow: 0 1px 3px oklch(0.1 0.02 240 / 0.7), 0 0 18px oklch(0.1 0.02 240 / 0.6);
}

.opciones {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(16rem, 20rem));
  gap: var(--s-3);
  justify-content: center;
  inline-size: 100%;
  max-inline-size: 48rem;
  margin-block-start: var(--s-2);
}

.opcion {
  display: grid;
  gap: var(--s-2);
  justify-items: stretch;
  text-align: start;
  padding: 0 0 var(--s-3);
  border: 1px solid oklch(1 0 0 / 0.32);
  border-radius: var(--radio-caja);
  background: oklch(0.18 0.03 230 / 0.55);
  color: oklch(0.98 0.004 106);
  cursor: pointer;
  overflow: hidden;
  backdrop-filter: blur(14px) saturate(1.15);
  -webkit-backdrop-filter: blur(14px) saturate(1.15);
  box-shadow: 0 8px 32px oklch(0.1 0.02 240 / 0.28);
  transition:
    background-color var(--dur-rapida) var(--ease-salida),
    border-color var(--dur-rapida) var(--ease-salida),
    transform var(--dur-rapida) var(--ease-salida);
  text-shadow: none;
}

.opcion:hover {
  background: oklch(0.2 0.035 230 / 0.78);
  border-color: oklch(1 0 0 / 0.55);
  transform: translateY(-2px);
}

.opcion.activa {
  border-color: oklch(0.85 0.17 118);
  background: oklch(0.22 0.04 200 / 0.82);
  box-shadow:
    0 8px 32px oklch(0.1 0.02 240 / 0.28),
    inset 0 0 0 1px oklch(0.85 0.17 118 / 0.55);
}

.opcion-lienzo {
  inline-size: 100%;
  aspect-ratio: 16 / 9;
  background: #0d2430;
  overflow: hidden;
}

.opcion-lienzo canvas {
  display: block;
  inline-size: 100%;
  block-size: 100%;
}

.opcion-nombre {
  padding-inline: var(--s-3);
  font-family: var(--font-display);
  font-size: var(--text-seccion);
  font-weight: 700;
}

.opcion-detalle {
  padding-inline: var(--s-3);
  font-size: var(--text-meta);
  color: oklch(0.88 0.01 220);
}

.nota {
  margin: 0;
  max-inline-size: 36rem;
  font-size: var(--text-meta);
  color: oklch(0.88 0.01 220);
}

.navegacion {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: var(--s-2);
  margin-block-start: var(--s-4);
}

.btn-atras,
.btn-seguir {
  padding: var(--s-2) var(--s-4);
  border-radius: var(--radio);
  font-weight: 600;
  cursor: pointer;
}

.btn-atras {
  border: 1px solid oklch(1 0 0 / 0.4);
  background: oklch(0.18 0.03 230 / 0.55);
  color: oklch(0.98 0.004 106);
  backdrop-filter: blur(10px);
}

.btn-seguir {
  border: 1px solid oklch(0.72 0.15 120);
  background: oklch(0.72 0.15 120);
  color: oklch(0.18 0.04 140);
}

.btn-seguir:hover {
  background: oklch(0.8 0.16 118);
  border-color: oklch(0.8 0.16 118);
}

.tecnologia :focus-visible {
  outline: 2px solid var(--foco);
  outline-offset: 2px;
  border-radius: 4px;
}

@media (width <= 40rem) {
  .opciones {
    grid-template-columns: minmax(0, 1fr);
  }

  .tecnologia-contenido {
    padding: var(--s-4) var(--s-3);
  }
}
</style>
