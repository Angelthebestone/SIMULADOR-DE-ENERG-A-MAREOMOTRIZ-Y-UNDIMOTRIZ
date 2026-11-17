<template>
  <ul role="listbox" :aria-label="ariaLabel" @keydown="alTecla" tabindex="0" ref="listaRef">
    <li
      v-for="sitio in sitios"
      :key="sitio.id"
      role="option"
      :aria-selected="sitio.id === activo ? 'true' : 'false'"
      :aria-label="`${sitio.nombre} ${valorDe(sitio)} ${sitio.estado}`"
      :class="{ activo: sitio.id === activo }"
      tabindex="-1"
      @click="emit('seleccionar', sitio.id)"
    >
      <span class="sitio-estado" :class="'semaforo semaforo--' + sitio.estado" :title="sitio.estado">
        <span class="semaforo__simbolo" :class="'semaforo__simbolo--' + sitio.estado" aria-hidden="true"></span>
      </span>
      <span class="sitio-nombre">{{ sitio.nombre }}</span>
      <span class="sitio-valor" :data-sin-dato="sitio.valor === null ? '' : null">{{ valorDe(sitio) }}</span>
    </li>
  </ul>
</template>

<script setup lang="ts">
import { ref } from "vue";
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
    if (next) emit("seleccionar", next.id);
  } else if (e.key === "ArrowUp") {
    e.preventDefault();
    const prev = props.sitios[Math.max(idx - 1, 0)];
    if (prev) emit("seleccionar", prev.id);
  } else if (e.key === "Home") {
    e.preventDefault();
    const first = props.sitios[0];
    if (first) emit("seleccionar", first.id);
  } else if (e.key === "End") {
    e.preventDefault();
    const last = props.sitios[props.sitios.length - 1];
    if (last) emit("seleccionar", last.id);
  } else if (e.key === "Enter" || e.key === " ") {
    e.preventDefault();
    if (idx >= 0) emit("seleccionar", props.sitios[idx].id);
  }
}
</script>

<style scoped>
/* La lista es la parte que se desplaza del rail: ocupa lo que sobra entre el
   filtro y la ficha, y nunca empuja a la ficha fuera de la columna. */
ul {
  flex: 1 1 auto;
  min-block-size: 6rem;
  overflow: auto;
  margin: 0;
  padding: 0;
  list-style: none;
  border: 1px solid var(--borde-suave);
  border-radius: var(--radio-caja);
  background: var(--panel);
}

li {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  gap: var(--s-2);
  align-items: center;
  padding: 6px var(--s-2);
  border-block-end: 1px solid var(--borde-suave);
  cursor: pointer;
  min-block-size: 2rem;
  font-size: var(--text-meta);
  transition: background-color var(--dur-rapida) var(--ease-salida);
}

li:last-child {
  border-block-end: none;
}

li:hover {
  background: var(--superficie);
}

li[aria-selected="true"] {
  background: var(--acento-suave);
  box-shadow: inset 3px 0 0 var(--rol-mar-profundo);
}

li[aria-selected="true"] .sitio-nombre {
  font-weight: 700;
  color: var(--rol-mar-profundo);
}

li:focus-visible {
  outline: 2px solid var(--foco);
  outline-offset: -2px;
}

ul:focus-visible {
  outline: 2px solid var(--foco);
  outline-offset: 2px;
}

.sitio-nombre {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.sitio-valor {
  font-family: var(--font-display);
  font-weight: 600;
  white-space: nowrap;
}

.sitio-valor[data-sin-dato] {
  font-family: var(--font-sans);
  font-weight: 400;
  font-style: italic;
  color: var(--tenue);
}

.sitio-estado {
  display: inline-flex;
  inline-size: 10px;
  justify-content: center;
}
</style>
