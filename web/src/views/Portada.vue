<template>
  <section
    class="portada"
    aria-label="Simulador de energía marina"
    data-testid="vista-portada"
  >
    <div ref="marRef" class="mar-realista" aria-hidden="true"></div>
    <div class="velo" aria-hidden="true"></div>

    <div class="portada-contenido">
      <p class="marca">Simulador de energía marina</p>
      <h1 class="titular">La energía del mar, en cualquier costa del mundo</h1>
      <p class="promesa">
        Elige un punto del océano con datos reales, mira el dispositivo trabajar en 2D o 3D
        y compara lo que produce con plantas que existen o existieron.
      </p>

      <div class="entradas">
        <button
          type="button"
          class="entrada"
          data-testid="entrada-mareomotriz"
          @click="emit('elegir-familia', 'mareomotriz')"
        >
          <Icono icono="mareomotriz" tamano="lg" />
          <span class="entrada-nombre">Mareomotriz</span>
          <span class="entrada-detalle">La marea que sube y baja dos veces al día: turbinas de corriente y diques.</span>
          <span class="entrada-ejemplo">Como MeyGen (Escocia) o La Rance (Francia)</span>
        </button>
        <button
          type="button"
          class="entrada"
          data-testid="entrada-undimotriz"
          @click="emit('elegir-familia', 'undimotriz')"
        >
          <Icono icono="undimotriz" tamano="lg" />
          <span class="entrada-nombre">Undimotriz</span>
          <span class="entrada-detalle">La ola que cruza la superficie: boyas que suben y bajan con ella.</span>
          <span class="entrada-ejemplo">Como la boya de CorPower (Portugal) o Wavestar (Dinamarca)</span>
        </button>
      </div>

      <ol class="recorrido" aria-label="Cómo funciona">
        <li><span>1</span> Recurso</li>
        <li><span>2</span> Tecnología</li>
        <li><span>3</span> Lugar en el mapa o valores propios</li>
        <li><span>4</span> Simulación y comparación</li>
      </ol>
    </div>
  </section>
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { MarRealista } from '../components/MarRealista'
import Icono from '../components/Icono.vue'
import type { Familia } from '../flujo/estado'

const emit = defineEmits<{ (e: 'elegir-familia', f: Familia): void }>()

const marRef = ref<HTMLElement | null>(null)
let mar: MarRealista | null = null

onMounted(() => {
  if (!marRef.value) return
  try {
    mar = new MarRealista(marRef.value)
    mar.arrancar()
  } catch {
    // Sin WebGL la portada mantiene el degradado CSS del contenedor.
    mar = null
  }
})

onBeforeUnmount(() => {
  mar?.detener()
  mar = null
})
</script>

<style scoped>
.portada {
  position: relative;
  display: flex;
  inline-size: 100%;
  block-size: 100%;
  min-block-size: 100dvh;
  overflow: hidden;
  border-radius: 0;
  /* Respaldo si WebGL no arranca: mar profundo en degradado. */
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

/* Velo para que el texto se lea sobre el cielo y el brillo especular. */
.velo {
  position: absolute;
  inset: 0;
  pointer-events: none;
  background:
    radial-gradient(ellipse 70% 55% at 50% 48%, oklch(0.1 0.02 240 / 0.18) 0%, transparent 70%),
    linear-gradient(
      180deg,
      oklch(0.12 0.03 240 / 0.35) 0%,
      oklch(0.12 0.03 240 / 0.12) 35%,
      oklch(0.08 0.02 240 / 0.28) 100%
    );
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
  color: oklch(0.98 0.005 106);
  text-shadow: 0 1px 12px oklch(0.1 0.02 240 / 0.55);
}

.marca {
  margin: 0;
  font-size: var(--text-meta);
  font-weight: 700;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  opacity: 0.92;
}

.titular {
  max-inline-size: 18ch;
  margin: 0;
  font-family: var(--font-display);
  font-size: clamp(2.2rem, 5vw, var(--text-heroe));
  font-weight: 700;
  line-height: 1.02;
  letter-spacing: -0.03em;
  text-wrap: balance;
}

.promesa {
  max-inline-size: 38rem;
  margin: 0;
  font-size: 17px;
  line-height: 1.5;
  color: oklch(0.95 0.008 220);
}

.recorrido {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: var(--s-2) var(--s-4);
  margin: var(--s-4) 0 0;
  padding: 0;
  list-style: none;
  font-size: var(--text-meta);
  color: oklch(0.92 0.008 220);
}

.recorrido li {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.recorrido span {
  display: inline-grid;
  place-items: center;
  inline-size: 1.4rem;
  block-size: 1.4rem;
  border: 1px solid oklch(1 0 0 / 0.45);
  border-radius: 50%;
  font-size: 11px;
  font-weight: 700;
}

.entrada-ejemplo {
  margin-block-start: var(--s-1);
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.02em;
  color: var(--marco-captado);
}

.entradas {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 20rem));
  gap: var(--s-4);
  margin-block-start: var(--s-3);
}

.entrada {
  display: grid;
  gap: var(--s-1);
  justify-items: center;
  padding: var(--s-6) var(--s-4);
  border: 1px solid oklch(1 0 0 / 0.32);
  border-radius: var(--radio-caja);
  background: oklch(0.18 0.03 230 / 0.55);
  color: oklch(0.98 0.004 106);
  cursor: pointer;
  backdrop-filter: blur(14px) saturate(1.15);
  -webkit-backdrop-filter: blur(14px) saturate(1.15);
  box-shadow: 0 8px 32px oklch(0.1 0.02 240 / 0.28);
  transition:
    background-color var(--dur-rapida) var(--ease-salida),
    border-color var(--dur-rapida) var(--ease-salida),
    transform var(--dur-rapida) var(--ease-salida);
  text-shadow: none;
}

.entrada:hover {
  background: oklch(0.2 0.035 230 / 0.78);
  border-color: oklch(1 0 0 / 0.55);
  transform: translateY(-2px);
}

.entrada-nombre {
  font-family: var(--font-display);
  font-size: var(--text-nivel);
  font-weight: 700;
}

.entrada-detalle {
  max-inline-size: 16rem;
  font-size: var(--text-meta);
  line-height: 1.45;
  color: oklch(0.88 0.01 220);
}

.portada :focus-visible {
  outline: 2px solid var(--foco);
  outline-offset: 3px;
  border-radius: 4px;
}

@media (width <= 40rem) {
  .entradas {
    grid-template-columns: minmax(0, 1fr);
  }

  .portada-contenido {
    padding-block: var(--s-6);
  }
}
</style>
