<template>
  <div class="controles-fisicos">
    <div v-for="c in controles" :key="c.id" class="control">
      <label :for="c.id" class="etiqueta">
        {{ c.etiqueta }}
        <span class="simbolo">{{ c.simbolo }}</span>
      </label>
      <div class="pista">
        <span class="tope">{{ c.formato(c.min) }}</span>
        <input
          :id="c.id"
          type="range"
          :min="c.min"
          :max="c.max"
          :step="c.step"
          :value="c.valor"
          :aria-describedby="c.id + '-valor'"
          @input="c.emitir(($event.target as HTMLInputElement).valueAsNumber)"
        />
        <span class="tope">{{ c.formato(c.max) }}</span>
      </div>
      <output :id="c.id + '-valor'" :for="c.id" class="valor">
        {{ c.formato(c.valor) }} <span class="unidad">{{ c.unidad }}</span>
      </output>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { formatearNumero } from "../utils/formato";

const props = defineProps<{
  hm0_m: number;
  te_s: number;
  b_pto_ns_m: number;
}>();

const emit = defineEmits<{
  (e: "update:hm0_m", v: number): void;
  (e: "update:te_s", v: number): void;
  (e: "update:b_pto_ns_m", v: number): void;
}>();

// Una sola descripción por control: la plantilla ya no repite tres bloques
// casi idénticos y añadir un cuarto parámetro es una línea.
const controles = computed(() => [
  {
    id: "ctrl-hm0",
    etiqueta: "Qué tan grandes son las olas",
    simbolo: "Hm0",
    unidad: "m",
    min: 0.5,
    max: 4,
    step: 0.1,
    valor: props.hm0_m,
    formato: (v: number) => formatearNumero(v, 1),
    emitir: (v: number) => emit("update:hm0_m", v),
  },
  {
    id: "ctrl-te",
    etiqueta: "Cada cuánto llega una ola",
    simbolo: "Te",
    unidad: "s",
    min: 4,
    max: 12,
    step: 0.1,
    valor: props.te_s,
    formato: (v: number) => formatearNumero(v, 1),
    emitir: (v: number) => emit("update:te_s", v),
  },
  {
    id: "ctrl-bpto",
    etiqueta: "Qué tan duro frena la boya",
    simbolo: "B_pto",
    unidad: "kN·s/m",
    min: 10_000,
    max: 500_000,
    step: 1_000,
    valor: props.b_pto_ns_m,
    formato: (v: number) => formatearNumero(v / 1000, 0),
    emitir: (v: number) => emit("update:b_pto_ns_m", v),
  },
]);
</script>

<style scoped>
/* Se adapta al ancho del contenedor, no al de la ventana: el mismo bloque
   sirve en el panel ancho de Ver y en una columna estrecha. */
.controles-fisicos {
  container-type: inline-size;
  display: grid;
  gap: var(--s-4);
  padding: 12px;
  border: 1px solid var(--borde-suave);
  border-radius: 8px;
  background: var(--panel);
}

.control {
  display: grid;
  grid-template-columns: minmax(12rem, 18rem) 1fr auto;
  align-items: center;
  column-gap: var(--s-4);
  row-gap: 2px;
}

/* Ningun hijo bloquea el encogido del grupo: con la escala de sustentacion a
   320 px, el ancho minimo del valor y de la etiqueta desplazaba el panel. */
.control > * {
  min-inline-size: 0;
}

/* Etiqueta pegada a su control y separada del grupo siguiente. */
.etiqueta {
  display: flex;
  align-items: baseline;
  gap: 6px;
  font-weight: 600;
  cursor: pointer;
}

.simbolo {
  font-size: var(--text-meta);
  font-weight: 400;
  color: var(--tenue);
}

.pista {
  display: flex;
  align-items: center;
  gap: 8px;
  min-inline-size: 0;
}

.tope {
  font-size: var(--text-meta);
  color: var(--tenue);
}

.pista input[type="range"] {
  flex: 1;
  min-inline-size: 0;
  block-size: 1.5rem;
  cursor: pointer;
}

@media (pointer: coarse) {
  .pista input[type="range"] {
    block-size: 2.75rem;
  }
}

.valor {
  min-inline-size: 6.5rem;
  text-align: end;
  font-weight: 700;
  font-size: var(--text-seccion);
  line-height: 1.1;
}

.unidad {
  font-size: var(--text-meta);
  font-weight: 400;
  color: var(--tenue);
}

/* Una columna cuando el contenedor se estrecha. */
@container (width < 34rem) {
  .control {
    grid-template-columns: 1fr auto;
  }

  .pista {
    grid-column: 1 / -1;
    order: 3;
  }

  .valor {
    text-align: end;
    min-inline-size: 0;
  }

  .etiqueta {
    overflow-wrap: anywhere;
  }
}
</style>
