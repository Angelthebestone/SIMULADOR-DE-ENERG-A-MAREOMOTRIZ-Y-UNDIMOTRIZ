<template>
  <div class="controles-supuestos">
    <div v-for="c in controles" :key="c.id" class="supuesto">
      <label :for="c.id" class="etiqueta">
        {{ c.etiqueta }}
        <Glosario :term="c.simbolo" class="simbolo">{{ c.simbolo }}</Glosario>
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
          :aria-describedby="c.id + '-meta'"
          @input="c.emitir(($event.target as HTMLInputElement).valueAsNumber)"
        />
        <span class="tope">{{ c.formato(c.max) }}</span>
      </div>
      <output :id="c.id + '-valor'" :for="c.id" class="valor">
        {{ c.formato(c.valor) }} <span class="unidad">{{ c.unidad }}</span>
      </output>
      <p :id="c.id + '-meta'" class="meta">
        defecto {{ c.formato(c.defecto) }} ·
        rango {{ c.formato(c.min) }}–{{ c.formato(c.max) }} ·
        fuente {{ c.fuente }}
      </p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { formatearNumero } from "../utils/formato";
import Glosario from "./Glosario.vue";

const props = defineProps<{
  eta_pto: number;
  eta_gen: number;
  crf: number;
  rho: number;
}>();

const emit = defineEmits<{
  (e: "update:eta_pto", v: number): void;
  (e: "update:eta_gen", v: number): void;
  (e: "update:crf", v: number): void;
  (e: "update:rho", v: number): void;
}>();

// Cuatro supuestos editables. Cada control expone valor por defecto, rango
// plausible, unidad y fuente bibliográfica en una sola línea bajo el control
// (spec `supuestos-editables`). Sin CDN, sin librería externa: el patrón es
// espejo de ControlesFisicos.vue.
const controles = computed(() => [
  {
    id: "ctrl-eta-pto",
    etiqueta: "Rendimiento del PTO",
    simbolo: "η_PTO",
    unidad: "",
    min: 0.4,
    max: 0.9,
    step: 0.01,
    defecto: 0.65,
    valor: props.eta_pto,
    formato: (v: number) => formatearNumero(v, 2),
    fuente: "Falnes 2002 cap. 4",
    emitir: (v: number) => emit("update:eta_pto", v),
  },
  {
    id: "ctrl-eta-gen",
    etiqueta: "Eficiencia del generador",
    simbolo: "η_gen",
    unidad: "",
    min: 0.8,
    max: 0.95,
    step: 0.01,
    defecto: 0.90,
    valor: props.eta_gen,
    formato: (v: number) => formatearNumero(v, 2),
    fuente: "Handbook cap. 1",
    emitir: (v: number) => emit("update:eta_gen", v),
  },
  {
    id: "ctrl-crf",
    etiqueta: "Factor de recuperación de capital",
    simbolo: "CRF",
    unidad: "",
    min: 0.04,
    max: 0.15,
    step: 0.005,
    defecto: 0.08,
    valor: props.crf,
    formato: (v: number) => formatearNumero(v, 3),
    fuente: "tasa 8% vida 20 años",
    emitir: (v: number) => emit("update:crf", v),
  },
  {
    id: "ctrl-rho",
    etiqueta: "Densidad del agua de mar",
    simbolo: "rho",
    unidad: "kg/m³",
    min: 1000,
    max: 1050,
    step: 1,
    defecto: 1025,
    valor: props.rho,
    formato: (v: number) => formatearNumero(v, 0),
    fuente: "agua de mar nominal",
    emitir: (v: number) => emit("update:rho", v),
  },
]);
</script>

<style scoped>
.controles-supuestos {
  container-type: inline-size;
  display: grid;
  gap: var(--s-4);
  padding: 12px;
  border: 1px solid var(--borde-suave);
  border-radius: 8px;
  background: var(--panel);
}

.supuesto {
  display: grid;
  grid-template-columns: minmax(12rem, 18rem) 1fr auto;
  align-items: center;
  column-gap: var(--s-4);
  row-gap: 2px;
}

.supuesto > * {
  min-inline-size: 0;
}

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

/* Línea única bajo el control con defecto, rango y fuente bibliográfica. */
.meta {
  grid-column: 1 / -1;
  margin: 2px 0 0;
  font-size: var(--text-meta);
  color: var(--tenue);
  line-height: 1.3;
}

/* Una columna cuando el contenedor se estrecha. */
@container (width < 34rem) {
  .supuesto {
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