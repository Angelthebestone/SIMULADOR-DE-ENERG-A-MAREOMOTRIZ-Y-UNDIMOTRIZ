<template>
  <ul role="listbox" :aria-label="ariaLabel" @keydown="alTecla" tabindex="0" ref="listaRef">
    <li
      v-for="(sitio, i) in sitios"
      :key="sitio.id"
      role="option"
      :aria-selected="sitio.id === activo ? 'true' : 'false'"
      :aria-label="`${sitio.nombre} ${sitio.valor ?? 'pendiente — sin dato'} ${sitio.unidad} ${sitio.estado}`"
      :class="{ activo: sitio.id === activo }"
      tabindex="-1"
      @click="emit('seleccionar', sitio.id)"
    >
      {{ sitio.nombre }} — {{ sitio.valor ?? 'pendiente — sin dato' }} {{ sitio.unidad }} ({{ sitio.estado }})
    </li>
  </ul>
</template>

<script setup lang="ts">
import { ref } from "vue";
import { flyToSitio } from "../map/mapa";

const props = defineProps<{
  sitios: { id: string; nombre: string; lon: number; lat: number; valor: number | null; unidad: string; fuente: string; estado: string }[];
  activo: string;
}>();

const emit = defineEmits<{ (e: "seleccionar", id: string): void }>();

const listaRef = ref<HTMLUListElement | null>(null);
const ariaLabel = "Emplazamientos — recorre con flechas, selecciona para volar al sitio";

function alTecla(e: KeyboardEvent) {
  const idx = props.sitios.findIndex((s) => s.id === props.activo);
  if (e.key === "ArrowDown") {
    e.preventDefault();
    const next = props.sitios[Math.min(idx + 1, props.sitios.length - 1)];
    if (next) anunciarYSeleccionar(next.id);
  } else if (e.key === "ArrowUp") {
    e.preventDefault();
    const prev = props.sitios[Math.max(idx - 1, 0)];
    if (prev) anunciarYSeleccionar(prev.id);
  } else if (e.key === "Home") {
    e.preventDefault();
    const first = props.sitios[0];
    if (first) anunciarYSeleccionar(first.id);
  } else if (e.key === "End") {
    e.preventDefault();
    const last = props.sitios[props.sitios.length - 1];
    if (last) anunciarYSeleccionar(last.id);
  } else if (e.key === "Enter" || e.key === " ") {
    e.preventDefault();
    if (idx >= 0) emit("seleccionar", props.sitios[idx].id);
  }
}

function anunciarYSeleccionar(id: string) {
  emit("seleccionar", id);
  // El anuncio lo hace aria-selected + aria-label; el foco permanece en listbox
  // para no romper navegación por teclado. El flyTo lo ejecuta el padre (MapaView)
  // con map.flyTo({center:[lon,lat], duration:600, essential:true}) y respeta prefers-reduced-motion.
}
</script>

<style scoped>
li[aria-selected="true"] { font-weight: 700; background: var(--panel); border-left: 3px solid var(--foco); }
li:focus-visible { outline: 2px solid var(--foco); outline-offset: 2px; }
</style>
