<template>
  <div
    ref="contenedor"
    class="sankey"
    role="img"
    :aria-label="ariaLabel"
    tabindex="0"
  ></div>
  <p v-if="!tieneDatos" class="vacio">{{ mensajeVacio }}</p>
</template>

<script setup lang="ts">
import { onMounted, onBeforeUnmount, watch, ref, computed } from 'vue'
import * as echarts from 'echarts'

// Contrato Resultado.eslabones -> Sankey nodos: recurso->captura->PTO->eléctrico + pérdida
// Columnas alineadas, no competir con tabla.

type Eslabon = { nombre: string; potencia_entrada_w: number; potencia_salida_w: number; rendimiento: number }

const props = defineProps<{ eslabones: Eslabon[]; vacioMsg?: string }>()
const contenedor = ref<HTMLElement | null>(null)
let chart: echarts.ECharts | null = null

const tieneDatos = computed(() => props.eslabones && props.eslabones.length > 0 && props.eslabones[0].potencia_entrada_w > 0)
const mensajeVacio = computed(()=> props.vacioMsg || 'sin cadena que dibujar todavía — mueve un control o pulsa Calcular')
const ariaLabel = computed(()=> {
  if (!tieneDatos.value) return 'Sankey vacío'
  const nombres = props.eslabones.map(e=>e.nombre).join(' → ')
  return `Diagrama Sankey ${nombres}`
})

function construirOpcion() {
  if (!tieneDatos.value) return null
  // Nodos ordenados: recurso, captura, PTO, eléctrico, pérdida (sink)
  const chain = props.eslabones.map(e=>e.nombre)
  // Alinear columnas: cada eslabón genera dos nodos lógicos si no existen: entrada y salida encadenadas
  // ECharts sankey alinea por depth; garantizamos nombres únicos alineados por nombre (no índice).
  const nodes: { name: string }[] = []
  const seen = new Set<string>()
  for (const n of chain) {
    if (!seen.has(n)) { nodes.push({ name: n }); seen.add(n) }
  }
  const sink = 'pérdida'
  if (!seen.has(sink)) nodes.push({ name: sink })

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
      lineStyle: { color: 'gradient' as const, curveness: 0.5 },
      label: { formatter: '{b}' },
    }]
  }
}

function render() {
  if (!contenedor.value) return
  if (!chart) chart = echarts.init(contenedor.value)
  const opt = construirOpcion()
  if (!opt) {
    chart.clear()
    return
  }
  chart.setOption(opt as echarts.EChartsOption, { notMerge: true })
}

function onResize() { chart?.resize() }

onMounted(()=> {
  render()
  window.addEventListener('resize', onResize)
})
onBeforeUnmount(()=> {
  window.removeEventListener('resize', onResize)
  chart?.dispose()
  chart = null
})
watch(()=> props.eslabones, render, { deep: true })
</script>

<style scoped>
.sankey{ width:100%; height:320px; min-height:260px; display:block; outline:none }
.sankey:focus-visible{ outline:2px solid var(--foco, #0072B2); outline-offset:2px; border-radius:6px }
.vacio{ color: var(--tenue, #5A636B); font-style:italic; text-align:center }
</style>
