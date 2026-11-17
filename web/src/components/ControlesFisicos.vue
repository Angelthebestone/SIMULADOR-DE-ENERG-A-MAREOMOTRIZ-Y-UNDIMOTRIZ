<template>
  <div class="controles-fisicos">
    <div class="controles-grid">
      <div v-for="c in controlesActivos" :key="c.id" class="control">
        <label :for="c.id" class="etiqueta">
          <span>{{ c.etiqueta }}</span>
          <Glosario :term="c.simbolo" class="simbolo">{{ c.simbolo }}</Glosario>
        </label>
        <output :id="c.id + '-valor'" :for="c.id" class="valor">
          {{ c.formato(c.valor) }} <span class="unidad">{{ c.unidad }}</span>
        </output>
        <div class="pista">
          <span class="tope">{{ c.formato(c.min) }}</span>
          <input
            :id="c.id"
            type="range"
            :min="c.min"
            :max="c.max"
            :step="c.step"
            :value="c.valor"
            :aria-describedby="c.id + '-valor ' + c.id + '-efecto'"
            :style="{ '--p': ((c.valor - c.min) / (c.max - c.min)) * 100 + '%' }"
            @input="c.emitir(($event.target as HTMLInputElement).valueAsNumber)"
          />
          <span class="tope">{{ c.formato(c.max) }}</span>
        </div>
        <p :id="c.id + '-efecto'" class="efecto">
          {{ c.efecto }}
        </p>
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
    dispositivo?: string;
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
    efecto: 'Si sube, llega más energía y la boya se mueve más; si baja, la cifra cae.',
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
    efecto: 'Si sube, la ola se alarga y trae más energía; si baja, la ola se acorta.',
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
    efecto: 'Si sube, frena más y la boya se mueve menos; si baja, la boya se mueve más suelta.',
    emitir: (v: number) => emit("update:b_pto_ns_m", v),
  },
]);

const controlesMareas = computed(() => [
  {
    id: "ctrl-vel-corriente",
    etiqueta: "Velocidad de corriente mareal",
    simbolo: "V_marea",
    unidad: "m/s",
    min: 0,
    max: 5,
    step: 0.1,
    valor: props.velocidadCorriente,
    formato: (v: number) => formatearNumero(v, 1),
    efecto: 'Si sube, la turbina recibe más empuje; si baja, produce menos.',
    emitir: (v: number) => emit("update:velocidadCorriente", v),
  },
  {
    id: "ctrl-rango-marea",
    etiqueta: "Rango mareal (pleamar - bajamar)",
    simbolo: "R_marea",
    unidad: "m",
    min: 0,
    max: 15,
    step: 0.1,
    valor: props.rangoMarea,
    formato: (v: number) => formatearNumero(v, 1),
    efecto: 'Si sube, hay más agua embalsada y más energía; si baja, hay menos.',
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
    efecto: 'Si baja mucho, la ola se acorta y se empina; si sube, la ola viaja más libre.',
    emitir: (v: number) => emit("update:profundidad_m", v),
  },
]);

const controlesActivos = computed(() => {
  // Cada obra mareomotriz responde a una sola variable de la marea: la turbina
  // a la corriente, el dique al rango. Mostrar la otra sería un mando muerto.
  if (props.dispositivo === "embalse") return controlesMareas.value.filter((c) => c.id !== "ctrl-vel-corriente");
  if (props.modoEnergia === "mareomotriz") return controlesMareas.value.filter((c) => c.id !== "ctrl-rango-marea");
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
  gap: var(--s-4);
}

/* Cada control: etiqueta y cifra en la misma fila, la pista debajo a todo
   el ancho. La cifra grande a la derecha es lo que se lee al mover. */
.control {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: baseline;
  column-gap: var(--s-3);
  row-gap: 6px;
}

.control > * {
  min-inline-size: 0;
}

.etiqueta {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 6px;
  font-weight: 600;
  font-size: var(--text-cuerpo);
  cursor: pointer;
}

.simbolo {
  font-family: var(--font-mono);
  font-size: var(--text-meta);
  font-weight: 400;
  color: var(--tenue);
}

.valor {
  font-family: var(--font-display);
  text-align: end;
  font-weight: 600;
  font-size: var(--text-nivel);
  line-height: 1;
  letter-spacing: -0.02em;
  color: var(--tinta);
  white-space: nowrap;
}

.unidad {
  font-family: var(--font-sans);
  font-size: var(--text-meta);
  font-weight: 600;
  letter-spacing: 0;
  color: var(--tenue);
}

.pista {
  grid-column: 1 / -1;
  display: flex;
  align-items: center;
  gap: 8px;
  min-inline-size: 0;
}

.tope {
  font-size: 11px;
  color: var(--tenue);
  min-inline-size: 1.6rem;
}

.tope:last-child {
  text-align: end;
}

/* Qué pasa si sube o baja: una línea bajo la pista, en tono tenue. */
.efecto {
  grid-column: 1 / -1;
  margin: 2px 0 0;
  font-size: var(--text-meta);
  color: var(--tenue);
  line-height: 1.35;
}

/* Deslizador propio: pista fina con el tramo recorrido en el azul del
   recurso, tirador redondo con anillo. La fracción --p la pone la plantilla. */
.pista input[type="range"] {
  flex: 1;
  min-inline-size: 0;
  block-size: 1.5rem;
  margin: 0;
  cursor: pointer;
  appearance: none;
  background: transparent;
}

.pista input[type="range"]::-webkit-slider-runnable-track {
  block-size: 4px;
  border-radius: 2px;
  background: linear-gradient(to right, var(--rol-recurso) var(--p, 0%), var(--superficie) var(--p, 0%));
}

.pista input[type="range"]::-moz-range-track {
  block-size: 4px;
  border-radius: 2px;
  background: var(--superficie);
}

.pista input[type="range"]::-moz-range-progress {
  block-size: 4px;
  border-radius: 2px;
  background: var(--rol-recurso);
}

.pista input[type="range"]::-webkit-slider-thumb {
  appearance: none;
  inline-size: 18px;
  block-size: 18px;
  margin-block-start: -7px;
  border-radius: 50%;
  border: 2px solid var(--panel);
  background: var(--rol-recurso);
  box-shadow: 0 1px 3px oklch(0.2 0.02 240 / 0.3);
  transition: transform var(--dur-rapida) var(--ease-salida);
}

.pista input[type="range"]::-moz-range-thumb {
  inline-size: 14px;
  block-size: 14px;
  border-radius: 50%;
  border: 2px solid var(--panel);
  background: var(--rol-recurso);
  box-shadow: 0 1px 3px oklch(0.2 0.02 240 / 0.3);
}

.pista input[type="range"]:hover::-webkit-slider-thumb,
.pista input[type="range"]:focus-visible::-webkit-slider-thumb {
  transform: scale(1.15);
}

.pista input[type="range"]:focus-visible {
  outline: none;
}

.pista input[type="range"]:focus-visible::-webkit-slider-thumb {
  box-shadow: 0 0 0 4px var(--acento-suave), 0 0 0 5px var(--foco);
}

@media (pointer: coarse) {
  .pista input[type="range"] {
    block-size: 2.75rem;
  }
}
@container (inline-size >= 34rem) {
  .controles-grid {
    grid-template-columns: repeat(auto-fit, minmax(0, 1fr));
    gap: var(--s-6);
  }

  /* En columna estrecha la cifra va bajo la etiqueta: lado a lado se pisan. */
  .control {
    grid-template-columns: minmax(0, 1fr);
    row-gap: 4px;
  }

  .etiqueta {
    font-size: 14px;
  }

  .valor {
    font-size: 24px;
    text-align: start;
  }
}
</style>
