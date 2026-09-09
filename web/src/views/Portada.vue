<template>
  <section class="portada" aria-labelledby="titulo-portada" data-testid="vista-portada">
    <canvas
      ref="canvasRef"
      class="oleaje mar"
      width="1200"
      height="600"
      aria-label="Mar en movimiento con el dispositivo de captura"
    ></canvas>

    <div class="portada-contenido">
      <p class="marca">Simulador de energía marina</p>
      <h1 id="titulo-portada">El mar, a pantalla completa</h1>
      <p class="bajada">Elige por dónde entra la energía: la marea o la ola. Nada más que elegir.</p>

      <div class="entradas">
        <button
          type="button"
          class="entrada"
          data-testid="entrada-mareomotriz"
          @click="emit('elegir-familia', 'mareomotriz')"
        >
          <Icono icono="mareomotriz" tamano="lg" />
          <span class="entrada-nombre">Mareomotriz</span>
          <span class="entrada-detalle">La marea que sube y baja, dos veces al día</span>
        </button>
        <button
          type="button"
          class="entrada"
          data-testid="entrada-undimotriz"
          @click="emit('elegir-familia', 'undimotriz')"
        >
          <Icono icono="undimotriz" tamano="lg" />
          <span class="entrada-nombre">Undimotriz</span>
          <span class="entrada-detalle">La ola que cruza la superficie (m, s)</span>
        </button>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { AnimacionCanvas } from '../components/AnimacionCanvas'
import Icono from '../components/Icono.vue'
import type { Familia } from '../flujo/estado'

const emit = defineEmits<{ (e: 'elegir-familia', f: Familia): void }>()

const canvasRef = ref<HTMLCanvasElement | null>(null)
let animacion: AnimacionCanvas | null = null

onMounted(() => {
  if (!canvasRef.value) return
  animacion = new AnimacionCanvas(canvasRef.value)
  animacion.pie = 0
  // Misma superficie del simulador, sin serie de cálculo: la ola se dibuja
  // con altura 1,5 m y periodo 7,0 s, como en Isla Fuerte.
  animacion.cargarSimulacion({
    series: null,
    k: 0.083,
    Hm0: 1.5,
    Te: 7.0,
    Bpto: 80_000,
    dispositivo: 'absorbedor_puntual',
    profundidad_m: 30,
    modoEnergia: 'undimotriz',
    potenciaCaptadaW: null,
  })
  animacion.arrancar()
})

onBeforeUnmount(() => animacion?.detener())
</script>

<style scoped>
.portada {
  position: relative;
  display: flex;
  min-block-size: calc(100dvh - 12rem);
  overflow: hidden;
  border-radius: var(--radio-escena);
  background: var(--map-oceano);
}

.mar {
  position: absolute;
  inset: 0;
  inline-size: 100%;
  block-size: 100%;
  display: block;
}

.portada-contenido {
  position: relative;
  z-index: 1;
  display: grid;
  gap: var(--s-3);
  align-content: center;
  justify-items: center;
  inline-size: 100%;
  padding: var(--s-9) var(--s-4);
  text-align: center;
  color: oklch(0.97 0.004 106);
}

.marca {
  margin: 0;
  font-size: var(--text-meta);
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  opacity: 0.9;
}

.portada-contenido h1 {
  margin: 0;
  font-size: var(--text-cifra);
  letter-spacing: -0.02em;
  text-wrap: balance;
}

.bajada {
  margin: 0;
  max-inline-size: 34rem;
  font-size: var(--text-cuerpo);
  opacity: 0.92;
  text-wrap: pretty;
}

.entradas {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 17rem));
  gap: var(--s-4);
  margin-block-start: var(--s-4);
}

.entrada {
  display: grid;
  gap: var(--s-1);
  justify-items: center;
  padding: var(--s-6) var(--s-4);
  border: 1px solid oklch(1 0 0 / 0.35);
  border-radius: var(--radio-caja);
  background: oklch(0.24 0.02 238 / 0.82);
  color: var(--marco-tinta);
  cursor: pointer;
  backdrop-filter: blur(6px);
}

.entrada:hover {
  background: oklch(0.24 0.02 238 / 0.95);
}

.entrada-nombre {
  font-family: var(--font-display);
  font-size: var(--text-seccion);
  font-weight: 700;
}

.entrada-detalle {
  font-size: var(--text-meta);
  color: var(--marco-tenue);
}

.portada :focus-visible {
  outline: 2px solid var(--foco);
  outline-offset: 2px;
  border-radius: 4px;
}

@media (width <= 40rem) {
  .entradas {
    grid-template-columns: minmax(0, 1fr);
  }

  .portada-contenido h1 {
    font-size: var(--text-seccion);
  }
}
</style>
