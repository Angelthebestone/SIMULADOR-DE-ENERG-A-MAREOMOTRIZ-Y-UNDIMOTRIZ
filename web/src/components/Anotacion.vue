<template>
  <span class="anotacion">
    <button
      type="button"
      class="anotacion-boton"
      :aria-expanded="abierta ? 'true' : 'false'"
      :aria-describedby="abierta ? panelId : undefined"
      @click="abierta = !abierta"
    >
      <span class="anotacion-punto" aria-hidden="true">i</span>
      <span>{{ contenido?.titulo ?? elemento }}</span>
    </button>
    <span v-if="abierta" :id="panelId" class="anotacion-panel" role="note">
      <span class="anotacion-linea"><strong>Qué es:</strong> {{ contenido?.queEs ?? '' }}</span>
      <span class="anotacion-linea"><strong>Qué hace:</strong> {{ contenido?.funcion ?? '' }}</span>
      <span v-if="termino" class="anotacion-linea">
        <Glosario :term="termino">{{ termino }}</Glosario>
      </span>
      <span v-if="textoIntuicion" class="anotacion-linea anotacion-intuicion">{{ textoIntuicion }}</span>
      <button type="button" class="anotacion-cerrar" @click="abierta = false">Cerrar</button>
    </span>
  </span>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import Glosario from './Glosario.vue'
import { anotacionDe } from '../contenido/pedagogia'
import { intuicionDe } from '../contenido/intuiciones'

const props = withDefaults(
  defineProps<{
    elemento: string
    termino?: string
    intuicion?: string
  }>(),
  { termino: '', intuicion: '' },
)

const abierta = ref(false)
const panelId = computed(() => `anotacion-${props.elemento}`)
const contenido = computed(() => anotacionDe(props.elemento))
const textoIntuicion = computed(() => (props.intuicion ? intuicionDe(props.intuicion) : ''))
</script>

<style scoped>
.anotacion {
  position: relative;
  display: inline-block;
}
.anotacion-boton {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 2px 8px;
  border: 1px solid var(--anotacion-borde);
  border-radius: var(--radio);
  background: var(--anotacion-fondo);
  color: var(--tinta);
  font-size: var(--text-meta);
  font-weight: 600;
  cursor: pointer;
}
.anotacion-boton:hover {
  border-color: var(--foco);
}
.anotacion-boton:focus-visible {
  outline: 2px solid var(--foco);
  outline-offset: 2px;
}
.anotacion-punto {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  inline-size: 1.1rem;
  block-size: 1.1rem;
  border-radius: 50%;
  background: var(--anotacion-borde);
  color: var(--panel);
  font-size: 11px;
  font-weight: 700;
}
.anotacion-panel {
  position: absolute;
  z-index: 100;
  inset-block-start: calc(100% + 4px);
  inset-inline-start: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-inline-size: 14rem;
  max-inline-size: 22rem;
  padding: var(--s-2) var(--s-3);
  border: 1px solid var(--anotacion-borde);
  border-radius: var(--radio-caja);
  background: var(--anotacion-fondo);
  color: var(--tinta);
  font-size: var(--text-meta);
  line-height: 1.4;
  box-shadow: var(--sombra-caja);
}
.anotacion-linea {
  margin: 0;
}
.anotacion-intuicion {
  color: var(--tenue);
}
.anotacion-cerrar {
  align-self: flex-start;
  margin-block-start: 2px;
  padding: 2px 10px;
  border: 1px solid var(--borde);
  border-radius: var(--radio);
  background: var(--panel);
  color: var(--tinta);
  font-size: var(--text-meta);
  cursor: pointer;
}
.anotacion-cerrar:focus-visible {
  outline: 2px solid var(--foco);
  outline-offset: 2px;
}
@media (max-width: 23.5rem) {
  .anotacion-panel {
    min-inline-size: 0;
    max-inline-size: 16rem;
  }
}
</style>
