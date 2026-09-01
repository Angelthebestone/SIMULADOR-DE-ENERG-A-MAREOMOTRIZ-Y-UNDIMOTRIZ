<template>
  <div class="controles-fisicos">
    <div class="controles-grid">
      <div v-for="c in controlesActivos" :key="c.id" class="control">
        <label :for="c.id" class="etiqueta">
          <span>{{ c.etiqueta }}</span>
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
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { formatearNumero } from "../utils/formato";
import Glosario from "./Glosario.vue";

const props = withDefaults(
  defineProps<{
    hm0_m: number;
    te_s: number;
    b_pto_ns_m: number;
    modoEnergia?: "undimotriz" | "mareomotriz";
    velocidadCorriente?: number;
    rangoMarea?: number;
    profundidad_m?: number;
    unidades?: number;
  }>(),
  {
    modoEnergia: "undimotriz",
    velocidadCorriente: 2.2,
    rangoMarea: 3.5,
    profundidad_m: 30,
    unidades: 1,
  }
);

const emit = defineEmits<{
  (e: "update:hm0_m", v: number): void;
  (e: "update:te_s", v: number): void;
  (e: "update:b_pto_ns_m", v: number): void;
  (e: "update:velocidadCorriente", v: number): void;
  (e: "update:rangoMarea", v: number): void;
  (e: "update:profundidad_m", v: number): void;
  (e: "update:unidades", v: number): void;
}>();

const controlesOndas = computed(() => [
  {
    id: "ctrl-hm0",
    etiqueta: "Altura de ola significativa",
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
    etiqueta: "Periodo medio del oleaje",
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
    etiqueta: "Amortiguamiento del generador",
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

const controlesMareas = computed(() => [
  {
    id: "ctrl-vel-corriente",
    etiqueta: "Velocidad de corriente mareal",
    simbolo: "V_marea",
    unidad: "m/s",
    min: 0.5,
    max: 5.5,
    step: 0.1,
    valor: props.velocidadCorriente,
    formato: (v: number) => formatearNumero(v, 1),
    emitir: (v: number) => emit("update:velocidadCorriente", v),
  },
  {
    id: "ctrl-rango-marea",
    etiqueta: "Rango mareal (pleamar - bajamar)",
    simbolo: "R_marea",
    unidad: "m",
    min: 0.5,
    max: 16.0,
    step: 0.1,
    valor: props.rangoMarea,
    formato: (v: number) => formatearNumero(v, 1),
    emitir: (v: number) => emit("update:rangoMarea", v),
  },
  {
    id: "ctrl-profundidad",
    etiqueta: "Profundidad del emplazamiento",
    simbolo: "h_fondo",
    unidad: "m",
    min: 10,
    max: 80,
    step: 1,
    valor: props.profundidad_m,
    formato: (v: number) => formatearNumero(v, 0),
    emitir: (v: number) => emit("update:profundidad_m", v),
  },
]);

const controlesActivos = computed(() => {
  if (props.modoEnergia === "mareomotriz") {
    return controlesMareas.value;
  }
  return controlesOndas.value;
});
</script>

<style scoped>
.controles-fisicos {
  container-type: inline-size;
  padding: var(--s-3);
  border: 1px solid var(--borde-suave);
  border-radius: var(--radio-caja);
  background: var(--panel);
  box-shadow: var(--sombra-caja);
}

.controles-grid {
  display: grid;
  gap: var(--s-3);
}

.control {
  display: grid;
  grid-template-columns: minmax(13rem, 19rem) 1fr auto;
  align-items: center;
  column-gap: var(--s-4);
  row-gap: 4px;
}

.control > * {
  min-inline-size: 0;
}

.etiqueta {
  display: flex;
  align-items: baseline;
  gap: 6px;
  font-weight: 600;
  font-size: var(--text-cuerpo);
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
  accent-color: var(--rol-recurso);
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
  color: var(--tinta);
}

.unidad {
  font-size: var(--text-meta);
  font-weight: 600;
  color: var(--tenue);
}

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

