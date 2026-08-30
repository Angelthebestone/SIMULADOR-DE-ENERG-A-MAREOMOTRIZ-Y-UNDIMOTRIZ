<template>
  <div class="controles-fisicos">
    <label class="fila">
      <span class="etiqueta">qué tan grandes son las olas (Hm0)</span>
      <input type="range" :min="0.5" :max="4" :step="0.1" :value="hm0_m" @input="onHm0" />
      <span class="valor">{{ formatearNumero(hm0_m, 1) }} m</span>
    </label>
    <label class="fila">
      <span class="etiqueta">cada cuánto llega una ola (Te)</span>
      <input type="range" :min="4" :max="12" :step="0.1" :value="te_s" @input="onTe" />
      <span class="valor">{{ formatearNumero(te_s, 1) }} s</span>
    </label>
    <label class="fila">
      <span class="etiqueta">qué tan duro frena la boya (B_pto)</span>
      <input type="range" :min="10000" :max="500000" :step="1000" :value="b_pto_ns_m" @input="onBpto" />
      <span class="valor">{{ formatearNumero(b_pto_ns_m / 1000, 0) }} kN·s/m</span>
    </label>
  </div>
</template>

<script setup lang="ts">
import { formatearNumero } from "../utils/formato";

defineProps<{
  hm0_m: number;
  te_s: number;
  b_pto_ns_m: number;
}>();

const emit = defineEmits<{
  (e: "update:hm0_m", v: number): void;
  (e: "update:te_s", v: number): void;
  (e: "update:b_pto_ns_m", v: number): void;
}>();

function onHm0(e: Event) { emit("update:hm0_m", parseFloat((e.target as HTMLInputElement).value)); }
function onTe(e: Event) { emit("update:te_s", parseFloat((e.target as HTMLInputElement).value)); }
function onBpto(e: Event) { emit("update:b_pto_ns_m", parseFloat((e.target as HTMLInputElement).value)); }
</script>
