<template>
  <span class="glosario" @mouseenter="abierto = true" @mouseleave="abierto = false" @focusin="abierto = true" @focusout="abierto = false" tabindex="0" :aria-describedby="id">
    <span class="termino"><slot /></span>
    <span v-if="abierto && definicion" :id="id" class="glosario-popover" role="tooltip" data-testid="glosario-popover">
      <strong class="glosario-titulo">{{ term }}</strong>
      <span class="glosario-def">{{ definicion }}</span>
    </span>
  </span>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'

const props = defineProps<{ term: string }>()

const abierto = ref(false)
const id = computed(() => `glosario-${props.term}-${Math.random().toString(36).slice(2, 8)}`)

const TERMINOS: Record<string, string> = {
  Hm0: 'Altura significativa del oleaje (m): 4·σ_η del registro, convención espectral estándar.',
  Te: 'Período energético del oleaje (s): momento espectral de orden -1 sobre el de orden 0.',
  'B_pto': 'Amortiguamiento del PTO (N·s/m): resistencia viscosa del convertidor mecánico a la velocidad de la boya.',
  J: 'Densidad de potencia del oleaje (W/m): energía que cruza un metro de frente de ola por segundo.',
  AEP: 'Producción anual de energía (MWh/año): energía que el dispositivo entrega en un año medio.',
  LCOE: 'Coste nivelado de la energía (COP/MWh): coste total descontado sobre la energía total producida en la vida útil.',
  PTO: 'Power Take-Off: convertidor electromecánico que transforma el movimiento de la boya en electricidad.',
  'η_PTO': 'Rendimiento del PTO (adimensional): pérdidas mecánicas e hidráulicas en la conversión.',
  'η_gen': 'Eficiencia del generador eléctrico (adimensional): pérdidas en la conversión mecánica→eléctrica.',
  CRF: 'Factor de recuperación de capital (adimensional): anualiza la inversión inicial a una tasa y vida dadas.',
  rho: 'Densidad del agua de mar (kg/m³): 1.025 nominal; editable para análisis de sensibilidad.',
}

const definicion = computed(() => TERMINOS[props.term] ?? '')
</script>

<style scoped>
.glosario {
  position: relative;
  display: inline;
  border-bottom: 1px dotted var(--color-texto-secundario, currentColor);
  cursor: help;
  outline: none;
}
.glosario:focus-visible {
  border-bottom: 1px solid var(--color-foco, currentColor);
}
.glosario-popover {
  position: absolute;
  bottom: 100%;
  left: 0;
  z-index: 100;
  display: flex;
  flex-direction: column;
  gap: 0.25em;
  min-width: 18em;
  max-width: 28em;
  padding: 0.5em 0.75em;
  font-size: 0.85em;
  line-height: 1.35;
  color: var(--color-texto, currentColor);
  background: var(--color-panel, #fff);
  border: 1px solid var(--color-borde, #ccc);
  border-radius: 4px;
  box-shadow: 0 2px 8px rgb(0 0 0 / 12%);
  white-space: normal;
}
.glosario-titulo {
  font-weight: 600;
}
.glosario-def {
  font-weight: 400;
}
</style>
