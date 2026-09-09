<template>
  <section class="origen" aria-labelledby="titulo-origen" data-testid="vista-origen">
    <p class="paso-marca">Paso 3 de 4 · Origen de datos</p>
    <h1 id="titulo-origen">Elige el origen de los datos</h1>
    <p class="bajada">Solo un camino sigue: un punto con datos medidos o unos valores libres para jugar.</p>

    <div class="caminos" role="group" aria-label="Caminos de datos">
      <button
        type="button"
        class="camino"
        :class="{ activo: origen === 'lugar' }"
        :aria-pressed="origen === 'lugar' ? 'true' : 'false'"
        data-testid="origen-lugar"
        @click="emit('elegir-origen', 'lugar')"
      >
        <span class="camino-nombre">Lugar real</span>
        <span class="camino-detalle">Punto en el mapa con datos del mar (m, s, m)</span>
      </button>
      <button
        type="button"
        class="camino"
        :class="{ activo: origen === 'personalizado' }"
        :aria-pressed="origen === 'personalizado' ? 'true' : 'false'"
        data-testid="origen-personalizado"
        @click="emit('elegir-origen', 'personalizado')"
      >
        <span class="camino-nombre">Valores libres</span>
        <span class="camino-detalle">Números a mano sin punto en el mapa</span>
      </button>
    </div>

    <div v-if="origen === 'lugar'" class="panel-lugar">
      <p class="nota">Los números llegan del punto elegido; la ficha del mapa muestra la fuente y el periodo.</p>
      <p v-if="sitioNombre" class="fuente-linea" data-testid="origen-fuente">
        Punto: {{ sitioNombre }} · Fuente: {{ sitioFuente || 'ver ficha del mapa' }} · Periodo 2015-2024
      </p>
      <p v-else class="fuente-linea" data-testid="origen-fuente">
        Elige un punto en el mapa; la ficha muestra la fuente y el periodo.
      </p>
      <div class="mapa-caja">
        <MapaView
          :sitio-activo="sitioId"
          @seleccionar-sitio="alSeleccionarSitio"
          @ir-a-simulador="alIrASimulador"
        />
      </div>
    </div>

    <div v-else class="panel-libre">
      <p class="aviso-hipotetico" data-testid="aviso-hipotetico" role="note">
        Aviso: resultado hipotético. Al no venir de un punto del mapa, no tiene fuente ni fecha
        y no representa ningún lugar.
      </p>
      <div class="campos">
        <label class="campo">
          <span>Altura de ola Hm0 (m)</span>
          <input
            type="number"
            :value="params.hm0_m"
            min="0.5"
            max="4"
            step="0.1"
            aria-label="Altura de ola Hm0 en metros"
            data-testid="libre-hm0"
            @input="alCambiarNumero('hm0_m', $event)"
          />
        </label>
        <label class="campo">
          <span>Periodo Te (s)</span>
          <input
            type="number"
            :value="params.te_s"
            min="4"
            max="12"
            step="0.1"
            aria-label="Periodo Te en segundos"
            data-testid="libre-te"
            @input="alCambiarNumero('te_s', $event)"
          />
        </label>
        <label class="campo">
          <span>Profundidad (m)</span>
          <input
            type="number"
            :value="params.profundidad_m"
            min="10"
            max="80"
            step="1"
            aria-label="Profundidad en metros"
            data-testid="libre-profundidad"
            @input="alCambiarNumero('profundidad_m', $event)"
          />
        </label>
      </div>
      <p class="ahora">
        Ahora: {{ formatearNumero(params.hm0_m, 1) }} m · {{ formatearNumero(params.te_s, 1) }} s ·
        {{ formatearNumero(params.profundidad_m, 0) }} m
      </p>
    </div>

    <div class="navegacion">
      <button type="button" class="btn-atras" data-testid="volver-tecnologia" @click="emit('volver')">
        Volver a tecnología
      </button>
      <button type="button" class="btn-seguir" data-testid="seguir-simulacion" @click="emit('continuar')">
        Seguir a la simulación
      </button>
    </div>
  </section>
</template>

<script setup lang="ts">
import MapaView from '../components/MapaView.vue'
import { formatearNumero } from '../utils/formato'
import type { Params } from '../api'
import type { SitioMapa } from '../map/mapa'
import type { Origen } from '../flujo/estado'

const props = defineProps<{
  origen: Origen
  params: Params
  sitioId: string
  sitioNombre: string
  sitioFuente: string
}>()

const emit = defineEmits<{
  (e: 'elegir-origen', o: Origen): void
  (e: 'update:params', v: Partial<Params>): void
  (e: 'seleccionar-sitio', s: SitioMapa): void
  (e: 'ir-a-simulador', s: SitioMapa): void
  (e: 'continuar'): void
  (e: 'volver'): void
}>()

function alCambiarNumero(clave: 'hm0_m' | 'te_s' | 'profundidad_m', evento: Event) {
  const el = evento.target as HTMLInputElement | null
  if (!el) return
  const v = Number(String(el.value).replace(',', '.'))
  if (!Number.isFinite(v)) return
  emit('update:params', { [clave]: v } as Partial<Params>)
}

function alSeleccionarSitio(s: SitioMapa) {
  emit('seleccionar-sitio', s)
}

function alIrASimulador(s: SitioMapa) {
  emit('ir-a-simulador', s)
}
</script>

<style scoped>
.origen {
  display: grid;
  gap: var(--s-3);
  align-content: start;
  max-inline-size: 64rem;
  margin: 0 auto;
  padding: var(--s-6) var(--s-4);
}

.paso-marca {
  margin: 0;
  font-size: var(--text-meta);
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--tenue);
}

.origen h1 {
  margin: 0;
  font-size: var(--text-nivel);
  letter-spacing: -0.01em;
}

.bajada {
  margin: 0;
  color: var(--tenue);
  font-size: var(--text-cuerpo);
}

.caminos {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(15rem, 1fr));
  gap: var(--s-3);
}

.camino {
  display: grid;
  gap: var(--s-1);
  justify-items: start;
  text-align: start;
  padding: var(--s-4);
  border: 1px solid var(--borde-suave);
  border-radius: var(--radio-caja);
  background: var(--panel);
  box-shadow: var(--sombra-caja);
  cursor: pointer;
}

.camino:hover {
  border-color: var(--borde);
}

.camino.activo {
  border-color: var(--rol-mar-profundo);
  background: var(--acento-suave);
}

.camino-nombre {
  font-family: var(--font-display);
  font-size: var(--text-seccion);
  font-weight: 700;
  color: var(--tinta);
}

.camino-detalle {
  font-size: var(--text-meta);
  color: var(--tenue);
}

.nota,
.fuente-linea,
.ahora {
  margin: 0;
  font-size: var(--text-cuerpo);
  color: var(--tenue);
}

.fuente-linea {
  font-size: var(--text-meta);
}

.mapa-caja {
  min-block-size: 22rem;
  border: 1px solid var(--borde-suave);
  border-radius: var(--radio-caja);
  overflow: hidden;
  background: var(--panel);
}

.aviso-hipotetico {
  margin: 0;
  padding: var(--s-3);
  border-radius: var(--radio);
  border-inline-start: 3px solid var(--conf-pendiente);
  background: var(--panel);
  font-size: var(--text-cuerpo);
}

.campos {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(11rem, 1fr));
  gap: var(--s-3);
}

.campo {
  display: grid;
  gap: var(--s-1);
  font-size: var(--text-meta);
  font-weight: 600;
  color: var(--tenue);
}

.campo input {
  padding: var(--s-2);
  border: 1px solid var(--borde);
  border-radius: var(--radio);
  background: var(--panel);
  color: var(--tinta);
  font-family: var(--font-mono);
  font-size: var(--text-cuerpo);
}

.navegacion {
  display: flex;
  flex-wrap: wrap;
  gap: var(--s-2);
  margin-block-start: var(--s-3);
}

.btn-atras,
.btn-seguir {
  padding: var(--s-2) var(--s-4);
  border-radius: var(--radio);
  font-weight: 600;
  cursor: pointer;
}

.btn-atras {
  border: 1px solid var(--borde);
  background: var(--panel);
  color: var(--tinta);
}

.btn-seguir {
  border: 1px solid var(--rol-mar-profundo);
  background: var(--rol-mar-profundo);
  color: var(--panel);
}

.btn-seguir:hover {
  background: var(--rol-mar-medio);
  border-color: var(--rol-mar-medio);
}

.origen :focus-visible {
  outline: 2px solid var(--foco);
  outline-offset: 2px;
  border-radius: 4px;
}

@media (width <= 40rem) {
  .origen {
    padding: var(--s-4) var(--s-3);
  }
}
</style>
