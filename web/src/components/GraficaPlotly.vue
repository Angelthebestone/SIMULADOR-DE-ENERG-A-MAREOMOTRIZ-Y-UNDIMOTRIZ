<template>
  <div
    ref="contenedor"
    class="grafica"
    role="img"
    :aria-label="titulo || 'Gráfica analítica compuesta en Python'"
    tabindex="0"
  ></div>
  <p v-if="!figura" class="pendiente"><span aria-hidden="true">○</span> pendiente — sin figura todavía</p>
</template>

<script setup lang="ts">
import { onMounted, watch, ref, onBeforeUnmount } from 'vue'
declare const Plotly: { newPlot: (el: HTMLElement, data: unknown[], layout: unknown, config?: unknown)=>Promise<void>; relayout:(el:HTMLElement,o:unknown)=>void; resize:(el:HTMLElement)=>void; purge:(el:HTMLElement)=>void }

const props = defineProps<{
  figura: { data: unknown[]; layout: Record<string,unknown> } | null
  titulo?: string
  height?: number
}>()

const contenedor = ref<HTMLElement | null>(null)

async function asegurarPlotly(): Promise<void> {
  if (typeof (window as unknown as Record<string,unknown>).Plotly !== 'undefined') return
  await new Promise<void>((resolve, reject)=>{
    const s = document.createElement('script')
    s.src = '/vendor/plotly/plotly.min.js'
    // fallback local vendorizado sin red
    s.onload = ()=> resolve()
    s.onerror = ()=> {
      // intentar cdn vendorizado alternativo local
      const s2 = document.createElement('script')
      s2.src = './vendor/plotly/plotly.min.js'
      s2.onload = ()=> resolve()
      s2.onerror = ()=> reject(new Error('Plotly no disponible sin conexión'))
      document.head.appendChild(s2)
    }
    document.head.appendChild(s)
  })
}

async function render() {
  if (!contenedor.value) return
  const el = contenedor.value
  if (!props.figura || !props.figura.data) {
    const P = (window as unknown as Record<string,unknown>).Plotly as typeof Plotly | undefined
    if (P) try{ P.purge(el) }catch{}
    return
  }
  try { await asegurarPlotly() } catch { return }
  const P = (window as unknown as Record<string,unknown>).Plotly as typeof Plotly
  if (!P || !P.newPlot) return
  const layout = { ...(props.figura.layout || {}), height: props.height || 320, autosize: true, margin:{ t:30, r:10, b:40, l:50 } }
  await P.newPlot(el, props.figura.data as unknown[], layout as unknown, { responsive:true, displayModeBar:false } as unknown)
}

function onResize(){ const el=contenedor.value; if(!el) return; const P=(window as unknown as Record<string,unknown>).Plotly as typeof Plotly|undefined; if(P?.resize) try{ P.resize(el) }catch{} }

function onSustentacion(){
  // re-layout figuras compuestas en Python: refit sin fetch nuevo
  onResize()
}

onMounted(()=> {
  render()
  window.addEventListener('resize', onResize)
  window.addEventListener('sustentacion', onSustentacion)
})
onBeforeUnmount(()=> {
  window.removeEventListener('resize', onResize)
  window.removeEventListener('sustentacion', onSustentacion)
  if (contenedor.value) {
    const P=(window as unknown as Record<string,unknown>).Plotly as typeof Plotly|undefined
    if(P?.purge) try{ P.purge(contenedor.value) }catch{}
  }
})
watch(()=> props.figura, render, { deep:true })
watch(()=> props.height, render)
</script>

<style scoped>
.grafica{ width:100%; min-height:220px; display:block; outline:none }
.grafica:focus-visible{ outline:2px solid var(--foco, #0072B2); outline-offset:2px; border-radius:6px }
.pendiente{ border-left:3px solid var(--conf-pendiente, #A8340A); padding-left:8px; background: var(--acento-suave, #FFF0E6); font-style:italic }
</style>
