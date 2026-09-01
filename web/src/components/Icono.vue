<template>
  <svg
    class="icono"
    :class="'icono--' + tamano"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="1.75"
    stroke-linecap="round"
    stroke-linejoin="round"
    :role="nombre ? 'img' : undefined"
    :aria-hidden="nombre ? undefined : 'true'"
    :focusable="false"
  >
    <title v-if="nombre">{{ nombre }}</title>
    <path :d="trazado" :stroke-dasharray="discontinuo || undefined" />
  </svg>
</template>

<script setup lang="ts">
import { computed } from 'vue'

// Un solo archivo de iconos en vez de una dependencia de 1.500 piezas para
// usar doce. Trazados de la familia Lucide (ISC), rejilla 24x24, trazo 1,75:
// misma anchura, mismos remates y mismos radios en toda la interfaz.
const TRAZOS: Record<string, string> = {
  // Niveles
  ver: 'M2.06 12.35a1 1 0 0 1 0-.7 10.75 10.75 0 0 1 19.88 0 1 1 0 0 1 0 .7 10.75 10.75 0 0 1-19.88 0M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0',
  comparar: 'M18 20V10M12 20V4M6 20v-6',
  calcular: 'M18 7V5a1 1 0 0 0-1-1H6.5a.5.5 0 0 0-.4.8l4.5 6a2 2 0 0 1 0 2.4l-4.5 6a.5.5 0 0 0 .4.8H17a1 1 0 0 0 1-1v-2',
  disenar: 'M21 4h-7M10 4H3M21 12h-9M8 12H3M21 20h-5M12 20H3M14 2v4M8 10v4M16 18v4',
  mapa: 'm3 6 6-3 6 3 6-3v15l-6 3-6-3-6 3zM9 3v15M15 6v15',
  // Oleaje y marea: la ola es el recurso que llega del mar; la doble flecha
  // vertical es el rango entre pleamar y bajamar. Dicen de que va cada modo.
  oleaje: 'M2 6c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 2.6 0 2.4 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1M2 12c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 2.6 0 2.4 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1M2 18c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 2.6 0 2.4 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1',
  marea: 'M2 15c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 2.6 0 2.4 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1M12 3v8M9 6l3-3 3 3M12 21v-2',
  expandir: 'M8 3H5a2 2 0 0 0-2 2v3M21 8V5a2 2 0 0 0-2-2h-3M3 16v3a2 2 0 0 0 2 2h3M16 21h3a2 2 0 0 0 2-2v-3',
  vivienda: 'M15 21v-8H9v8M3 10a2 2 0 0 1 .7-1.5l7-6a2 2 0 0 1 2.6 0l7 6A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z',
  emision: 'M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.5 19 2c1 2 2 4.2 2 8 0 5.5-4.8 10-10 10M2 21c0-3 1.9-5.4 5.1-6C9.5 14.5 12 13 13 12',

  // Estados de dato
  verificado: 'M22 11.08V12a10 10 0 1 1-5.93-9.14M9 11l3 3L22 4',
  inferido: 'M12 22a10 10 0 1 1 0-20 10 10 0 0 1 0 20M12 18a6 6 0 0 0 0-12z',
  pendiente: 'M12 22a10 10 0 1 1 0-20 10 10 0 0 1 0 20',
  error: 'm21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3M12 9v4M12 17h.01',

  // Acciones y avisos
  fuentes: 'M12 7v14M3 18a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-6a3 3 0 0 0-3 3 3 3 0 0 0-3-3z',
  cerrar: 'M18 6 6 18M6 6l12 12',
  pausar: 'M14 4v16M10 4v16',
  reproducir: 'M6 3l14 9-14 9z',
  proyector: 'M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7',
  calculando: 'M12 2v4M18.4 5.6l-2.9 2.9M22 12h-4M18.4 18.4l-2.9-2.9M12 18v4M5.6 18.4l2.9-2.9M2 12h4M5.6 5.6l2.9 2.9',
  offline: 'M12 20h.01M8.5 16.43a5 5 0 0 1 7 0M5 12.86a10 10 0 0 1 3.29-2.19M19 12.86a10 10 0 0 0-2.32-1.77M2 8.82a15 15 0 0 1 4.18-2.64M2 2l20 20',

  // Secciones de Diseñar
  resonancia: 'M22 12h-2.48a2 2 0 0 0-1.93 1.46l-2.35 8.36a.25.25 0 0 1-.48 0L9.24 2.18a.25.25 0 0 0-.48 0l-2.35 8.36A2 2 0 0 1 4.49 12H2',
  limite: 'm12 14 4-4M3.34 19a10 10 0 1 1 17.32 0',
  matriz: 'M3 3h18v18H3zM3 9h18M3 15h18M9 3v18M15 3v18',
  coste: 'M12 22a10 10 0 1 1 0-20 10 10 0 0 1 0 20M16 8h-6a2 2 0 1 0 0 4h4a2 2 0 1 1 0 4H8M12 18V6',
  supuesto: 'M3 3h18v18H3zM12 8v4M12 16h.01',
  marca: 'M12 22a8 8 0 1 1 0-16 8 8 0 0 1 0 16M12 12h.01',
}

const props = defineProps<{
  /** Clave del trazado. */
  icono: string
  /** Nombre accesible. Sin él, el icono es decorativo y se oculta al lector. */
  nombre?: string
  tamano?: 'sm' | 'md' | 'lg'
}>()

// La marca y la pestana del simulador comparten el glifo del oleaje: es la
// misma cosa, el recurso que entra.
TRAZOS.simulador = TRAZOS.oleaje
TRAZOS.undimotriz = TRAZOS.oleaje
TRAZOS.mareomotriz = TRAZOS.marea

const tamano = computed(() => props.tamano ?? 'md')
const trazado = computed(() => TRAZOS[props.icono] ?? TRAZOS.pendiente)
// El círculo de `pendiente` va discontinuo: el estado se distingue por forma,
// no sólo por color, igual que el ○ del semáforo.
const discontinuo = computed(() => (props.icono === 'pendiente' ? '3 3' : ''))
</script>

<style scoped>
.icono {
  display: inline-block;
  flex: none;
  vertical-align: -0.125em;
}

.icono--sm {
  inline-size: 0.875rem;
  block-size: 0.875rem;
}

.icono--md {
  inline-size: 1.125rem;
  block-size: 1.125rem;
}

.icono--lg {
  inline-size: 1.5rem;
  block-size: 1.5rem;
}
</style>
