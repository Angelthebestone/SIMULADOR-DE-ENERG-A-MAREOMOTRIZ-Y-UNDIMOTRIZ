<template>
  <article class="ficha" :class="{ fracaso: esFracaso }">
    <h3 class="nombre">{{ ficha.nombre }}</h3>
    <p class="tipo">{{ ficha.tipo || ficha.familia || '' }}</p>
    <p v-if="ficha.descripcion || ficha.principio" class="principio">{{ ficha.descripcion || ficha.principio }}</p>
    <p v-if="ficha.dimensiones || ficha.ejemplos" class="ejemplos">{{ ficha.dimensiones || ficha.ejemplos }}</p>
    <p v-if="ficha.potencia_nominal_kw" class="potencia">{{ ficha.potencia_nominal_kw }} kW nominales</p>

    <!-- Fracaso: causa + naturaleza técnica/económica/ambiental (investigation_convertidores_marinos.md) -->
    <template v-if="esFracaso">
      <p class="causa"><strong>Causa:</strong> {{ ficha.causa }}</p>
      <p class="naturaleza"><strong>Naturaleza:</strong> {{ naturaleza }}</p>
      <p v-if="ficha.destino_coste" class="coste"><strong>Destino coste hundido:</strong> {{ ficha.destino_coste }}</p>
      <p v-if="ficha.coste_hundido" class="coste2">{{ ficha.coste_hundido }}</p>
      <p v-if="ficha.origen_causa" class="fuente fuente-causa">{{ ficha.origen_causa }}</p>
    </template>
    <template v-else>
      <p v-if="ficha.ejemplos" class="ejemplos2">{{ ficha.ejemplos }}</p>
      <p v-if="ficha.desenlace_comercial" class="desenlace">{{ ficha.desenlace_comercial }}</p>
    </template>
    <p v-if="ficha.origen" class="fuente">{{ ficha.origen }}</p>
    <p v-if="ficha.fuente_taxonomia" class="fuente">{{ ficha.fuente_taxonomia }}</p>
    <p v-if="estadoTexto" class="estado"><span :aria-label="estadoTexto">{{ simbolo }}</span> {{ estadoTexto }}</p>
  </article>
</template>

<script setup lang="ts">
import { computed } from 'vue'
const props = defineProps<{ ficha: Record<string, unknown>; tipo?: 'dispositivo'|'fracaso' }>()

const esFracaso = computed(() => props.tipo === 'fracaso' || !!props.ficha.causa)

const naturaleza = computed(() => {
  const c = String(props.ficha.causa || '').toLowerCase()
  const etiquetas: string[] = []
  if (c.includes('economic') || c.includes('coste') || c.includes('capital')) etiquetas.push('económica')
  if (c.includes('tecnic') || c.includes('averia') || c.includes('fatiga') || c.includes('falla') || c.includes('potencia real mitad')) etiquetas.push('técnica')
  if (c.includes('pec') || c.includes('ambient') || c.includes('mortalidad')) etiquetas.push('ambiental')
  return etiquetas.length ? etiquetas.join(' y ') : 'otra (ver causa)'
})

const estadoTexto = computed(()=> {
  if (props.ficha.estado) return String(props.ficha.estado)
  return ''
})
const simbolo = computed(()=> {
  const e = String(props.ficha.estado || '')
  if (e === 'verificado') return '●'
  if (e === 'inferido') return '◐'
  if (e === 'pendiente') return '○'
  return ''
})
</script>

<style scoped>
.ficha{ border:1px solid var(--borde, #B8B8B2); border-radius:8px; padding:10px; background: var(--panel, #fff); font-size: 15px }
.ficha.fracaso{ border-left:3px solid var(--conf-pendiente, #A8340A) }
.nombre{ font-weight:700; margin:0 0 4px }
.tipo{ color: var(--tenue, #5A636B); font-size:12px; margin:0 0 6px }
.principio, .ejemplos, .potencia, .causa, .naturaleza, .coste, .coste2, .ejemplos2, .desenlace{ font-size:14px; margin:4px 0 }
.fuente{ font-size:12px; color: var(--tenue); margin:4px 0 }
.estado{ font-size:12px; margin-top:6px }
</style>
