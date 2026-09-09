<template>
  <section class="tecnologia" aria-labelledby="titulo-tecnologia" data-testid="vista-tecnologia">
    <p class="paso-marca">Paso 2 de 4 · {{ nombreFamilia }}</p>
    <h1 id="titulo-tecnologia">Elige la tecnología</h1>
    <p class="bajada">
      Cada familia aprovecha una parte distinta del mar. Solo una sigue con tus números.
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
        <span class="opcion-nombre">{{ t.nombre }}</span>
        <span class="opcion-detalle">{{ t.descripcion }}</span>
      </button>
    </div>

    <p class="nota">
      La columna de agua oscilante no se ofrece aquí; su ficha sigue en Comparar para consulta.
    </p>

    <div class="navegacion">
      <button type="button" class="btn-atras" data-testid="volver-inicio" @click="emit('volver')">
        Volver al inicio
      </button>
      <button type="button" class="btn-seguir" data-testid="seguir-origen" @click="emit('continuar')">
        Seguir al origen de datos
      </button>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { TECNOLOGIAS_POR_FAMILIA, type Familia } from '../flujo/estado'

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
</script>

<style scoped>
.tecnologia {
  display: grid;
  gap: var(--s-3);
  align-content: start;
  max-inline-size: 60rem;
  margin: 0 auto;
  padding: var(--s-6) var(--s-4);
}

.paso-marca {
  margin: 0;
  font-size: var(--text-meta);
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--tenue);
}

.tecnologia h1 {
  margin: 0;
  font-size: var(--text-nivel);
  letter-spacing: -0.01em;
}

.bajada {
  margin: 0;
  color: var(--tenue);
  font-size: var(--text-cuerpo);
}

.opciones {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(15rem, 1fr));
  gap: var(--s-3);
}

.opcion {
  display: grid;
  gap: var(--s-1);
  justify-items: start;
  text-align: start;
  padding: var(--s-4);
  border: 1px solid var(--borde-suave);
  border-radius: var(--radio-caja);
  background: var(--panel);
  box-shadow: var(--sombra-caja);
  cursor: pointer;
}

.opcion:hover {
  border-color: var(--borde);
}

.opcion.activa {
  border-color: var(--rol-mar-profundo);
  background: var(--acento-suave);
}

.opcion-nombre {
  font-family: var(--font-display);
  font-size: var(--text-seccion);
  font-weight: 700;
  color: var(--tinta);
}

.opcion-detalle {
  font-size: var(--text-meta);
  color: var(--tenue);
}

.nota {
  margin: 0;
  font-size: var(--text-meta);
  color: var(--tenue);
}

.navegacion {
  display: flex;
  flex-wrap: wrap;
  gap: var(--s-2);
  margin-block-start: var(--s-3);
}

.btn-atras,
.btn-seguir {
  padding: var(--s-2) var(--s-4);
  border-radius: var(--radio);
  font-weight: 600;
  cursor: pointer;
}

.btn-atras {
  border: 1px solid var(--borde);
  background: var(--panel);
  color: var(--tinta);
}

.btn-seguir {
  border: 1px solid var(--rol-mar-profundo);
  background: var(--rol-mar-profundo);
  color: var(--panel);
}

.btn-seguir:hover {
  background: var(--rol-mar-medio);
  border-color: var(--rol-mar-medio);
}

.tecnologia :focus-visible {
  outline: 2px solid var(--foco);
  outline-offset: 2px;
  border-radius: 4px;
}

@media (width <= 40rem) {
  .tecnologia {
    padding: var(--s-4) var(--s-3);
  }
}
</style>
