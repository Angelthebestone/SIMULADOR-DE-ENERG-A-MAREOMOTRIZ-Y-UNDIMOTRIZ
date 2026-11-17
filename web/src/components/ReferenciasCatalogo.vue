<template>
  <section v-if="fichas.length" class="referencias" aria-labelledby="titulo-referencias">
    <h2 id="titulo-referencias">Otras tecnologías que existen · solo consulta</h2>
    <ul class="lista" role="list">
      <li v-for="f in fichas" :key="f.id">
        <details class="ficha">
          <summary>
            <span class="nombre">{{ f.nombre }}</span>
            <span class="ejemplos">{{ f.ejemplo_corto || f.ejemplos }}</span>
          </summary>
          <p class="principio">{{ f.principio }}</p>
          <p v-if="f.desenlace" class="desenlace">{{ f.desenlace }}</p>
        </details>
      </li>
    </ul>
  </section>
</template>

<script setup lang="ts">
import { ref, watch } from "vue";
import type { Familia } from "../flujo/estado";

const props = defineProps<{ familia: Familia }>();

// Fichas de datos/catalogo/ que no se simulan: el absorbedor puntual y la
// turbina de eje horizontal ya son las opciones simulables de arriba.
const IDS: Record<Familia, string[]> = {
  undimotriz: ["owc", "atenuador", "owsc", "rebosamiento", "masa_rotatoria", "diferencial_presion", "onda_bulbo"],
  mareomotriz: ["tidal_cometa", "tidal_eje_vertical", "tidal_hidroala", "tidal_venturi", "tidal_tornillo"],
};

type Ficha = { id: string; nombre: string; principio: string; ejemplos: string; ejemplo_corto: string; desenlace: string };
const fichas = ref<Ficha[]>([]);

watch(
  () => props.familia,
  async (familia) => {
    const leidas = await Promise.all(
      IDS[familia].map((id) =>
        fetch(`./datos/catalogo/${id}.json`)
          .then((r) => (r.ok ? r.json() : null))
          .catch(() => null)
      )
    );
    fichas.value = leidas
      .filter((d): d is Record<string, unknown> => !!d && typeof d.nombre === "string")
      .map((d) => ({
        id: String(d.id),
        nombre: String(d.nombre),
        principio: String(d.principio ?? ""),
        ejemplos: String(d.ejemplos ?? ""),
        ejemplo_corto: String(d.ejemplo_corto ?? ""),
        desenlace: String(d.desenlace_comercial ?? ""),
      }));
  },
  { immediate: true }
);
</script>

<style scoped>
.referencias {
  display: grid;
  gap: var(--s-2);
  inline-size: min(56rem, 100%);
  text-align: start;
  text-shadow: none;
}

h2 {
  margin: 0;
  font-family: var(--font-sans);
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--marco-tenue);
}

.lista {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(15rem, 1fr));
  gap: var(--s-2);
  margin: 0;
  padding: 0;
  list-style: none;
}

.ficha {
  block-size: 100%;
  padding: var(--s-2) var(--s-3);
  border: 1px solid var(--marco-linea);
  border-radius: var(--radio);
  background: oklch(0.18 0.03 230 / 0.6);
  backdrop-filter: blur(10px);
  color: var(--marco-tinta);
}

.ficha[open] {
  border-color: var(--marco-recurso);
}

summary {
  display: grid;
  gap: 2px;
  cursor: pointer;
  list-style: none;
}

summary::-webkit-details-marker {
  display: none;
}

.nombre {
  font-size: var(--text-meta);
  font-weight: 700;
}

.ejemplos {
  display: -webkit-box;
  overflow: hidden;
  font-size: 11px;
  color: var(--marco-captado);
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}

.principio,
.desenlace {
  margin: var(--s-2) 0 0;
  font-size: 11px;
  line-height: 1.45;
  color: var(--marco-tenue);
}

.desenlace {
  color: var(--marco-tinta);
}
</style>
