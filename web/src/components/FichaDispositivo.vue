<template>
  <article class="ficha" :class="{ fracaso: esFracaso }">
    <header class="cabecera">
      <h3 class="nombre">{{ ficha.nombre }}</h3>
      <p class="tipo">{{ ficha.tipo || ficha.familia || '' }}</p>
    </header>

    <!-- Lo que se lee de un vistazo: qué es, en qué estado está y, si fracasó,
         de qué naturaleza fue la causa. El texto largo va bajo el resumen. -->
    <ul class="marcas">
      <li v-if="esFracaso" class="marca marca-causa">{{ naturaleza }}</li>
      <li v-else class="marca">{{ simulableTexto }}</li>
      <li v-if="ficha.potencia_nominal_kw" class="marca">{{ ficha.potencia_nominal_kw }} kW nominales</li>
      <li v-if="estadoTexto" class="marca" :class="'semaforo semaforo--' + estadoTexto">
        <Icono :icono="iconoEstado" tamano="sm" />
        <span>{{ estadoTexto }}</span>
      </li>
    </ul>

    <details v-if="detalles.length" class="mas">
      <summary>Detalle</summary>
      <dl>
        <template v-for="d in detalles" :key="d.clave">
          <dt>{{ d.clave }}</dt>
          <dd>{{ d.texto }}</dd>
        </template>
      </dl>
    </details>
  </article>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import Icono from './Icono.vue'

const props = defineProps<{ ficha: Record<string, unknown>; tipo?: 'dispositivo'|'fracaso' }>()

const esFracaso = computed(() => props.tipo === 'fracaso' || !!props.ficha.causa)

const naturaleza = computed(() => {
  const c = String(props.ficha.causa || '').toLowerCase()
  const etiquetas: string[] = []
  if (c.includes('economic') || c.includes('coste') || c.includes('capital')) etiquetas.push('económica')
  if (c.includes('tecnic') || c.includes('averia') || c.includes('fatiga') || c.includes('falla') || c.includes('potencia real mitad')) etiquetas.push('técnica')
  if (c.includes('pec') || c.includes('ambient') || c.includes('mortalidad')) etiquetas.push('ambiental')
  return etiquetas.length ? `causa ${etiquetas.join(' y ')}` : 'causa: ver detalle'
})

// La simulabilidad la declara el archivo; la interfaz sólo la nombra.
const simulableTexto = computed(() =>
  props.ficha.simulable ? 'con modelo dinámico' : 'sólo consultable'
)

const estadoTexto = computed(()=> props.ficha.estado ? String(props.ficha.estado) : '')
const iconoEstado = computed(()=> {
  const e = estadoTexto.value
  return e === 'verificado' || e === 'inferido' || e === 'pendiente' ? e : 'pendiente'
})

// Todo el texto largo, plegado tras un resumen: la tarjeta se escanea en dos
// líneas y quien quiera la historia entera la despliega.
const detalles = computed(() => {
  const f = props.ficha
  const campos: Array<[string, unknown]> = [
    ['Principio', f.descripcion ?? f.principio],
    ['Dimensiones', f.dimensiones],
    ['Ejemplos', f.ejemplos],
    ['Causa', f.causa],
    ['Destino del coste', f.destino_coste],
    ['Coste hundido', f.coste_hundido],
    ['Desenlace', f.desenlace_comercial],
    ['Origen', f.origen ?? f.origen_causa],
    ['Taxonomía', f.fuente_taxonomia],
  ]
  return campos
    .filter(([, v]) => typeof v === 'string' && v.trim().length > 0)
    .map(([clave, v]) => ({ clave, texto: String(v) }))
})
</script>

<style scoped>
.ficha {
  display: grid;
  align-content: start;
  gap: var(--s-1);
  border: 1px solid var(--borde-suave);
  border-radius: var(--radio-caja);
  padding: var(--s-2);
  background: var(--panel);
  box-shadow: var(--sombra-caja);
  font-size: var(--text-cuerpo);
}

.ficha.fracaso { border-inline-start: 3px solid var(--conf-pendiente); }

.cabecera { display: grid; gap: 0; }
.nombre { font-size: var(--text-cuerpo); font-weight: 700; margin: 0; }
.tipo { color: var(--tenue); font-size: var(--text-meta); margin: 0; }

.marcas { display: flex; flex-wrap: wrap; gap: var(--s-1); margin: 0; padding: 0; list-style: none; }
.marca {
  display: inline-flex; align-items: center; gap: 4px;
  border: 1px solid var(--borde-suave); border-radius: 999px;
  padding: 1px var(--s-2); font-size: var(--text-meta); color: var(--tenue);
}
.marca-causa { border-color: var(--conf-pendiente); color: var(--conf-pendiente); }

.mas summary {
  cursor: pointer;
  font-size: var(--text-meta);
  color: var(--tenue);
  min-block-size: 1.5rem;
  padding-block: 2px;
}
.mas summary:focus-visible { outline: 2px solid var(--foco); outline-offset: 2px; border-radius: 4px; }
.mas[open] summary { font-weight: 600; }

.mas dl { display: grid; grid-template-columns: minmax(5rem, auto) 1fr; gap: 2px var(--s-2); margin: var(--s-1) 0 0; font-size: var(--text-meta); }
.mas dt { color: var(--tenue); text-transform: uppercase; letter-spacing: 0.04em; }
.mas dd { margin: 0; overflow-wrap: anywhere; }
</style>
