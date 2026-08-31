<template>
  <div
    :class="['estado-bloque', 'estado-' + estado]"
    :aria-live="estado === 'cargando' ? 'polite' : undefined"
    :aria-busy="estado === 'cargando' ? 'true' : 'false'"
    :aria-disabled="estado === 'deshabilitado' ? 'true' : undefined"
    tabindex="0"
    role="status"
    @keydown.enter="emit('activar')"
    @keydown.space.prevent="emit('activar')"
  >
    <!-- reposo -->
    <template v-if="estado === 'reposo'">
      <!-- Tras una cancelación el motivo explica por qué se volvió al reposo;
           sin motivo, la instrucción de siempre. -->
      <p class="instruccion">{{ motivo ? motivo + ' — mueve un control o pulsa Calcular' : 'sin calcular todavía — mueve un control o pulsa Calcular' }}</p>
      <slot name="reposo" />
    </template>

    <!-- cargando: vacío con instrucción, estructura conservada, cancelación disponible -->
    <template v-else-if="estado === 'cargando'">
      <div class="esqueleto" aria-hidden="true">
        <div class="barra esqueleto-barra" style="width:92%"></div>
        <div class="barra esqueleto-barra" style="width:84%"></div>
        <div class="barra esqueleto-barra" style="width:68%"></div>
      </div>
      <p class="instruccion">integrando — {{ motivo || 'cálculo en curso' }}</p>
      <button v-if="mostrarCancelar" @click="emit('cancelar')" class="btn-cancelar">Cancelar (ESC)</button>
      <slot />
    </template>

    <!-- vacío -->
    <template v-else-if="estado === 'vacio'">
      <p class="instruccion">mueve un control para ver pérdidas — sin cadena que dibujar todavía</p>
      <slot name="vacio" />
    </template>

    <!-- resultado -->
    <template v-else-if="estado === 'resultado'">
      <slot />
    </template>

    <!-- pendiente: ○ y motivo sin número -->
    <template v-else-if="estado === 'pendiente'">
      <p class="pendiente"><span aria-hidden="true">○</span> pendiente — {{ motivo || 'sin dato' }}</p>
      <!-- no cifra de resultado aparece en su lugar -->
    </template>

    <!-- error: conserva último resultado -->
    <template v-else-if="estado === 'error'">
      <p class="error-msg" role="alert">error — {{ motivo || 'cálculo interrumpido' }}</p>
      <div class="ultimo-resultado" v-if="ultimoResultado">
        <slot name="ultimo" :data="ultimoResultado" />
        <p class="nota-conserva">se conserva el último resultado válido</p>
      </div>
      <slot v-else />
    </template>

    <!-- deshabilitado -->
    <template v-else-if="estado === 'deshabilitado'">
      <p class="deshabilitado" aria-disabled="true">deshabilitado — {{ motivo || 'bloqueado por dato pendiente' }}</p>
    </template>

    <!-- desbordado: cita más larga -->
    <template v-else-if="estado === 'desbordado'">
      <div class="desbordado">
        <p class="cita" :title="citaCompleta" tabindex="0">{{ citaTruncada }}</p>
        <span class="sr-only">{{ citaCompleta }}</span>
      </div>
      <slot />
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
const props = defineProps<{
  estado: 'reposo'|'cargando'|'vacio'|'resultado'|'pendiente'|'error'|'deshabilitado'|'desbordado'
  motivo?: string
  cita?: string
  ultimoResultado?: unknown
  mostrarCancelar?: boolean
}>()
const emit = defineEmits<{ (e:'activar'):void; (e:'cancelar'):void }>()

const citaCompleta = computed(()=> props.cita || 'Ortega et al. 2013, Renewable Energy 57, 240-248 — Isla Fuerte 8,9 kW/m revisado por pares — Copernicus Marine GLOBAL_ANALYSISFORECAST_WAV_001_027 1/12° (~9 km), celda 9,42N -76,17W ~3,3 km, 2015-2024, datos/cmems/resumen_oleaje_cmems.json — ERA5-Ocean via Open-Meteo, rejilla 0,5° (celda 9,5N -76,0W ~23 km), 2015-2024, 87672 registros, datos/oleaje/resumen_oleaje_era5.json — GMRT Lamont-Doherty batimetría transecto radial')
const citaTruncada = computed(()=> {
  const c = citaCompleta.value
  return c.length > 140 ? c.slice(0,140) + '…' : c
})
</script>

<style scoped>
.estado-bloque:focus-visible{ outline:2px solid var(--foco, #0072B2); outline-offset:2px; border-radius:6px }
.instruccion{ color: var(--tenue, #5A636B); font-style:italic; font-size:0.9em }
.esqueleto{ display:grid; gap:8px; padding:8px 0 }
.esqueleto-barra{ height:14px; background: var(--borde-suave, #D6D6D1); border-radius:4px; animation: pulse 1.2s infinite alternate }
@keyframes pulse{ from{opacity:0.6} to{opacity:1} }
.pendiente{ border-left:3px solid var(--conf-pendiente, #A8340A); padding-left:8px; background: var(--acento-suave, #FFF0E6); font-style:italic }
.error-msg{ color: var(--conf-pendiente); font-weight:700 }
.ultimo-resultado{ opacity:0.95; border:1px dashed var(--borde, #B8B8B2); padding:8px; border-radius:6px }
.deshabilitado{ color: var(--tenue); opacity:0.6 }
.desbordado .cita{ white-space:nowrap; overflow:hidden; text-overflow:ellipsis; max-width:100%; cursor:help; border-bottom:1px dotted var(--tenue) }
.desbordado .cita:focus{ white-space:normal; overflow:visible }
.btn-cancelar{ margin-top:8px }
.sr-only{ position:absolute; left:-9999px }
</style>
