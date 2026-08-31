<template>
  <div
    v-show="tieneDatos"
    ref="contenedor"
    class="sankey"
    role="img"
    :aria-label="ariaLabel"
    tabindex="0"
  ></div>
  <div v-if="!tieneDatos && cargando" class="sankey-esqueleto" aria-hidden="true">
    <span v-for="n in 5" :key="n" class="esqueleto-col" :style="{ blockSize: ALTOS[n - 1] }"></span>
  </div>
  <p v-else-if="!tieneDatos" class="vacio">
    <Icono icono="pendiente" tamano="sm" />
    <span>{{ mensajeVacio }}</span>
  </p>
</template>

<script setup lang="ts">
import { onMounted, onBeforeUnmount, watch, ref, computed } from 'vue'
import * as echarts from 'echarts'
import Icono from './Icono.vue'

// Contrato Resultado.eslabones -> Sankey nodos: recurso->captura->PTO->eléctrico + pérdida
// Columnas alineadas, no competir con tabla.

type Eslabon = { nombre: string; potencia_entrada_w: number; potencia_salida_w: number; rendimiento: number }

const props = defineProps<{ eslabones: Eslabon[]; vacioMsg?: string; cargando?: boolean }>()

// Esqueleto de cinco columnas decrecientes: la forma del Sankey que va a
// llegar, para que su llegada no desplace la pantalla.
const ALTOS = ['86%', '68%', '54%', '40%', '22%']
const contenedor = ref<HTMLElement | null>(null)
let chart: echarts.ECharts | null = null

const tieneDatos = computed(() => props.eslabones && props.eslabones.length > 0 && props.eslabones[0].potencia_entrada_w > 0)
const mensajeVacio = computed(()=> props.vacioMsg || 'sin cadena que dibujar todavía — mueve un control o pulsa Calcular')
const ariaLabel = computed(()=> {
  if (!tieneDatos.value) return 'Sankey vacío'
  const nombres = props.eslabones.map(e=>e.nombre).join(' → ')
  return `Diagrama Sankey ${nombres}`
})

// semaforo.css define un --rol-* por eslabon justo para este diagrama; sin
// esto ECharts reparte su paleta por defecto y el Sankey no coincide con
// ningun otro color de la aplicacion.
function colorRol(nombre: string): string {
  const clave = nombre.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
  const css = getComputedStyle(document.documentElement).getPropertyValue(`--rol-${clave}`).trim()
  return css || getComputedStyle(document.documentElement).getPropertyValue('--rol-acento').trim()
}

function construirOpcion() {
  if (!tieneDatos.value) return null
  // Nodos ordenados: recurso, captura, PTO, eléctrico, pérdida (sink)
  const chain = props.eslabones.map(e=>e.nombre)
  // Alinear columnas: cada eslabón genera dos nodos lógicos si no existen: entrada y salida encadenadas
  // ECharts sankey alinea por depth; garantizamos nombres únicos alineados por nombre (no índice).
  const nodes: { name: string; itemStyle?: { color: string } }[] = []
  const seen = new Set<string>()
  for (const n of chain) {
    if (!seen.has(n)) { nodes.push({ name: n, itemStyle: { color: colorRol(n) } }); seen.add(n) }
  }
  const sink = 'pérdida'
  if (!seen.has(sink)) nodes.push({ name: sink, itemStyle: { color: colorRol(sink) } })

  const links: { source: string; target: string; value: number }[] = []
  for (let i = 0; i < props.eslabones.length; i++) {
    const e = props.eslabones[i]
    const perdida = Math.max(e.potencia_entrada_w - e.potencia_salida_w, 0)
    const src = e.nombre
    const dst = i + 1 < props.eslabones.length ? props.eslabones[i + 1].nombre : sink
    // flujo útil hacia siguiente eslabón
    if (e.potencia_salida_w > 0) links.push({ source: src, target: dst, value: e.potencia_salida_w / 1000 })
    // flujo perdido hacia sink
    if (perdida > 0) links.push({ source: src, target: sink, value: perdida / 1000 })
  }

  // Si cadena vacía de links, mostrar vacío
  if (links.length === 0) return null

  return {
    tooltip: { trigger: 'item' as const },
    series: [{
      type: 'sankey' as const,
      layout: 'none' as const,
      emphasis: { focus: 'adjacency' as const },
      nodeAlign: 'left' as const,
      data: nodes,
      links,
      lineStyle: { color: 'gradient' as const, curveness: 0.5, opacity: 0.45 },
      label: { formatter: '{b}' },
    }]
  }
}

function render() {
  if (!contenedor.value) return
  const opt = construirOpcion()
  if (!opt) {
    chart?.clear()
    return
  }
  // Se inicializa aqui, no antes: con v-show el contenedor mide 0x0 mientras
  // no hay cadena y echarts se quedaria fijado a ese tamano.
  if (!chart) chart = echarts.init(contenedor.value)
  chart.setOption(opt as echarts.EChartsOption, { notMerge: true })
}

function onResize() { chart?.resize() }

// El ancho del contenedor cambia sin que cambie el de la ventana: al plegar la
// rejilla en pantallas estrechas, al abrir el modo sustentacion o al aparecer
// la barra de desplazamiento. Con el evento de ventana el diagrama se quedaba
// dibujado al tamano que midio la primera vez y se salia de su caja.
let observador: ResizeObserver | null = null

onMounted(()=> {
  render()
  window.addEventListener('resize', onResize)
  if (contenedor.value && typeof ResizeObserver !== 'undefined') {
    observador = new ResizeObserver(onResize)
    observador.observe(contenedor.value)
  }
})
onBeforeUnmount(()=> {
  window.removeEventListener('resize', onResize)
  observador?.disconnect()
  observador = null
  chart?.dispose()
  chart = null
})
watch(()=> props.eslabones, render, { deep: true, flush: 'post' })
</script>

<style scoped>
.sankey{ inline-size:100%; block-size:20rem; display:block; outline:none }
.sankey:focus-visible{ outline:2px solid var(--foco); outline-offset:2px; border-radius:6px }
.vacio{ display:flex; align-items:center; gap:6px; margin:0;
  border-inline-start:3px solid var(--conf-pendiente); padding:6px 8px;
  background:var(--acento-suave); color:var(--tenue); font-style:italic; font-size:var(--text-meta) }
.sankey-esqueleto{ display:flex; align-items:flex-end; gap:6px; inline-size:100%; block-size:20rem;
  padding:8px; border:1px solid var(--borde-suave); border-radius:var(--radio-caja); box-sizing:border-box }
.esqueleto-col{ flex:1; border-radius:4px; background: var(--superficie);
  animation: sankey-latido 1.4s ease-in-out infinite alternate }
@keyframes sankey-latido{ from{ opacity:0.5 } to{ opacity:1 } }
</style>
