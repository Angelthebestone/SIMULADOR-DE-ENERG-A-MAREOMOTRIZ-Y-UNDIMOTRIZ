<template>
  <figure class="grafica-wrap">
    <figcaption v-if="titulo" class="titulo">{{ titulo }}</figcaption>
    <!-- Sin figura no se reserva lienzo: antes quedaban ~220 px en blanco por
         gráfica y el nivel Diseñar parecía roto en vez de pendiente. -->
    <div
      v-if="figura"
      ref="contenedor"
      class="grafica"
      role="img"
      :aria-label="titulo || 'Gráfica analítica'"
      tabindex="0"
    ></div>
    <div v-else-if="cargando" class="grafica-esqueleto" aria-hidden="true">
      <span v-for="n in 7" :key="n" class="esqueleto-barra" :style="{ blockSize: ALTOS[n - 1] }"></span>
    </div>
    <p v-else class="pendiente">
      <Icono icono="pendiente" tamano="sm" />
      <span>pendiente — {{ motivo || 'sin figura todavía' }}</span>
    </p>
  </figure>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import Icono from './Icono.vue'

// ponytail: sin renderizador. `analisis/` no compone ninguna figura {data,
// layout} todavía, así que este componente sólo puede declarar la ausencia.
//
// El renderizador anterior inyectaba un <script src> a una ruta que no existe
// en el árbol: nunca llegó a dibujar una figura. Importar `plotly.js-dist-min`
// como módulo sí funciona, pero mete en el bundle los mapas base de Plotly y
// sus proveedores de teselas remotos, y eso rompe la política de origen único
// que verifica pruebas/test_construccion_web.py.
//
// Cuando Python emita figuras, dibujarlas con ECharts, que ya está en el
// bundle por el Sankey y no arrastra orígenes externos.
const props = defineProps<{
  figura: { data: unknown[]; layout: Record<string,unknown> } | null
  titulo?: string
  motivo?: string
  height?: number
  cargando?: boolean
}>()

// Alturas del esqueleto: perfil de una serie, no barras iguales, para que el
// hueco se lea como «va a haber una gráfica aquí».
const ALTOS = ['35%', '58%', '46%', '82%', '64%', '90%', '52%']

const contenedor = ref<HTMLElement | null>(null)

const motivoVisible = () => props.motivo || 'sin figura todavía'
defineExpose({ motivoVisible })
</script>

<style scoped>
.grafica-wrap {
  margin: 0;
  display: grid;
  gap: var(--s-1);
}

.titulo {
  font-size: var(--text-meta);
  color: var(--tenue);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.grafica {
  inline-size: 100%;
  min-block-size: 13.75rem;
  display: block;
}

.grafica:focus-visible {
  outline: 2px solid var(--foco);
  outline-offset: 2px;
  border-radius: 6px;
}

.grafica-esqueleto {
  display: flex;
  align-items: flex-end;
  gap: var(--s-2);
  inline-size: 100%;
  min-block-size: 8rem;
  padding: var(--s-2);
  border: 1px solid var(--borde-suave);
  border-radius: var(--radio-caja);
  box-sizing: border-box;
}

.esqueleto-barra {
  flex: 1;
  border-radius: 4px;
  background: var(--superficie);
  animation: grafica-latido 1.4s ease-in-out infinite alternate;
}

@keyframes grafica-latido {
  from {
    opacity: 0.5;
  }

  to {
    opacity: 1;
  }
}

.pendiente {
  display: flex;
  align-items: center;
  gap: 6px;
  margin: 0;
  border-inline-start: 3px solid var(--conf-pendiente);
  padding: 6px var(--s-2);
  background: var(--acento-suave);
  color: var(--tenue);
  font-style: italic;
  font-size: var(--text-meta);
}
</style>
