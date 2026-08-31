<template>
  <ul role="listbox" :aria-label="ariaLabel" @keydown="alTecla" tabindex="0" ref="listaRef">
    <li
      v-for="(sitio, i) in sitios"
      :key="sitio.id"
      role="option"
      :aria-selected="sitio.id === activo ? 'true' : 'false'"
      :aria-label="`${sitio.nombre} ${valorDe(sitio)} ${sitio.estado}`"
      :class="{ activo: sitio.id === activo }"
      tabindex="-1"
      @click="emit('seleccionar', sitio.id)"
    >
      <span class="sitio-nombre">{{ sitio.nombre }}</span>
      <span class="sitio-valor">{{ valorDe(sitio) }}</span>
      <span class="sitio-estado" :class="'semaforo semaforo--' + sitio.estado">
        <Icono :icono="sitio.estado" tamano="sm" />
        <span>{{ sitio.estado }}</span>
      </span>
    </li>
  </ul>
</template>

<script setup lang="ts">
import { ref } from "vue";
import Icono from "./Icono.vue";
import { formatearNumero } from "../utils/formato";

const props = defineProps<{
  sitios: { id: string; nombre: string; lon: number; lat: number; valor: number | null; unidad: string; fuente: string; estado: string }[];
  activo: string;
}>();

const emit = defineEmits<{ (e: "seleccionar", id: string): void }>();

/** Sin valor no se inventa un cero: se dice que falta. */
function valorDe(sitio: { valor: number | null; unidad: string }): string {
  return sitio.valor === null ? "sin dato" : `${formatearNumero(sitio.valor, 1)} ${sitio.unidad}`;
}

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
ul { margin: var(--s-2) 0; padding: 0; list-style: none; border: 1px solid var(--borde-suave);
  border-radius: var(--radio-caja); background: var(--panel); overflow: hidden; }
li { display: grid; grid-template-columns: minmax(8rem, 1fr) minmax(6rem, auto) minmax(7rem, auto);
  gap: var(--s-2); align-items: center; padding: 6px var(--s-2);
  border-bottom: 1px solid var(--borde-suave); cursor: pointer; min-block-size: 2rem; }
li:last-child { border-bottom: none; }
li:hover { background: var(--superficie); }
li[aria-selected="true"] { font-weight: 700; background: var(--acento-suave);
  box-shadow: inset 3px 0 0 var(--rol-mar-profundo); }
li:focus-visible { outline: 2px solid var(--foco); outline-offset: -2px; }
ul:focus-visible { outline: 2px solid var(--foco); outline-offset: 2px; }
.sitio-valor { text-align: end; }
.sitio-estado { display: inline-flex; align-items: center; gap: 4px; font-size: var(--text-meta); font-weight: 400; }
li[aria-selected="true"] .sitio-estado { font-weight: 400; }
@media (max-width: 30rem) { li { grid-template-columns: 1fr auto; } .sitio-estado { grid-column: 1 / -1; } }
</style>
