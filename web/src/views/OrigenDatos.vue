<template>
  <section class="origen" aria-labelledby="titulo-origen" data-testid="vista-origen">
    <header class="origen-cabecera">
      <div class="origen-texto">
        <p class="marca">Origen de datos</p>
        <h1 id="titulo-origen">Elige el origen de los datos</h1>
        <p class="bajada">
          Solo un camino sigue: un punto con datos medidos o unos valores libres para jugar.
        </p>
      </div>

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
          <span class="camino-detalle">Punto en el mapa con datos del mar</span>
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

      <div class="navegacion">
        <button type="button" class="btn-atras" data-testid="volver-tecnologia" @click="emit('volver')">
          Volver a tecnología
        </button>
        <button type="button" class="btn-seguir" data-testid="seguir-simulacion" @click="emit('continuar')">
          Seguir a la simulación
        </button>
      </div>
    </header>

    <div v-if="origen === 'lugar'" class="panel-lugar">
      <p class="fuente-linea" data-testid="origen-fuente">
        <template v-if="sitioNombre">
          Punto: {{ sitioNombre }} · Fuente: {{ sitioFuente || 'ver ficha del mapa' }}
        </template>
        <template v-else>
          Elige un punto en el mapa; la ficha muestra de dónde sale cada cifra.
        </template>
      </p>
      <div class="mapa-caja">
        <MapaView
          :sitio-activo="sitioId"
          :dispositivo="dispositivo"
          @seleccionar-sitio="alSeleccionarSitio"
          @ir-a-simulador="alIrASimulador"
        />
      </div>
    </div>

    <div v-else class="panel-libre">
      <div class="tarjeta-libre">
        <h2>Escribe tu propio mar</h2>
        <p class="explica">
          Útil para preguntarse «¿y si…?»: prueba un oleaje o una marea que no está en el mapa y
          mira cómo responde el dispositivo.
        </p>
        <div class="campos">
          <label v-for="c in camposLibres" :key="c.clave" class="campo">
            <span class="campo-nombre">{{ c.nombre }}</span>
            <span class="campo-caja">
              <input
                type="number"
                :value="valorDe(c.clave)"
                :min="c.min"
                :max="c.max"
                :step="c.paso"
                :aria-label="c.nombre + ' en ' + c.unidad"
                :data-testid="c.testid"
                @input="alCambiarNumero(c.clave, $event)"
              />
              <span class="campo-unidad">{{ c.unidad }}</span>
            </span>
            <span class="campo-rango">entre {{ formatearNumero(c.min, c.dec) }} y {{ formatearNumero(c.max, c.dec) }}</span>
          </label>
        </div>
        <p class="aviso-hipotetico" data-testid="aviso-hipotetico" role="note">
          El resultado será hipotético: al no venir de un punto del mapa no tiene fuente ni fecha
          y no representa ningún lugar.
        </p>
        <button type="button" class="btn-simular-libre" @click="emit('continuar')">
          Simular con estos valores
        </button>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed } from 'vue'
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
  dispositivo?: string
}>()

const emit = defineEmits<{
  (e: 'elegir-origen', o: Origen): void
  (e: 'update:params', v: Partial<Params>): void
  (e: 'seleccionar-sitio', s: SitioMapa): void
  (e: 'ir-a-simulador', s: SitioMapa): void
  (e: 'continuar'): void
  (e: 'volver'): void
}>()

type ClaveLibre = 'hm0_m' | 'te_s' | 'profundidad_m' | 'velocidad_ms' | 'rango_m'
type CampoLibre = { clave: ClaveLibre; nombre: string; unidad: string; min: number; max: number; paso: number; dec: number; testid: string }

// Cada obra pide solo las variables del mar que la mueven: la boya el oleaje,
// la turbina la corriente y el dique el rango de marea.
const CAMPOS: Record<ClaveLibre, CampoLibre> = {
  hm0_m: { clave: 'hm0_m', nombre: 'Altura de ola Hm0', unidad: 'm', min: 0.5, max: 4, paso: 0.1, dec: 1, testid: 'libre-hm0' },
  te_s: { clave: 'te_s', nombre: 'Periodo Te', unidad: 's', min: 4, max: 12, paso: 0.1, dec: 0, testid: 'libre-te' },
  velocidad_ms: { clave: 'velocidad_ms', nombre: 'Velocidad de corriente', unidad: 'm/s', min: 0, max: 5, paso: 0.1, dec: 0, testid: 'libre-velocidad' },
  rango_m: { clave: 'rango_m', nombre: 'Rango de marea', unidad: 'm', min: 0, max: 15, paso: 0.1, dec: 0, testid: 'libre-rango' },
  profundidad_m: { clave: 'profundidad_m', nombre: 'Profundidad', unidad: 'm', min: 10, max: 80, paso: 1, dec: 0, testid: 'libre-profundidad' },
}

const POR_DISPOSITIVO: Record<string, ClaveLibre[]> = {
  absorbedor_puntual: ['hm0_m', 'te_s', 'profundidad_m'],
  turbina_corriente: ['velocidad_ms', 'profundidad_m'],
  embalse: ['rango_m', 'profundidad_m'],
}

const camposLibres = computed(() => (POR_DISPOSITIVO[props.dispositivo ?? ''] ?? POR_DISPOSITIVO.absorbedor_puntual).map((k: ClaveLibre) => CAMPOS[k]))

function valorDe(clave: ClaveLibre): number | undefined {
  return props.params[clave]
}

function alCambiarNumero(clave: ClaveLibre, evento: Event) {
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
  display: flex;
  flex-direction: column;
  inline-size: 100%;
  block-size: 100%;
  min-block-size: 0;
  overflow: hidden;
  background: var(--marco);
}

.origen-cabecera {
  flex: none;
  display: flex;
  flex-wrap: wrap;
  align-items: end;
  gap: var(--s-3) var(--s-4);
  padding: var(--s-3) var(--s-4);
  color: var(--marco-tinta);
  background: var(--marco);
  border-block-end: 1px solid var(--marco-linea);
}

.origen-texto {
  display: grid;
  gap: 2px;
  min-inline-size: 14rem;
  flex: 1 1 16rem;
}

.marca {
  margin: 0;
  font-size: var(--text-meta);
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--marco-tenue);
}

.origen h1 {
  margin: 0;
  font-size: var(--text-seccion);
  letter-spacing: -0.01em;
  color: var(--marco-tinta);
}

.bajada {
  margin: 0;
  color: var(--marco-tenue);
  font-size: var(--text-meta);
}

.caminos {
  display: flex;
  flex-wrap: wrap;
  gap: var(--s-2);
}

.camino {
  display: grid;
  gap: 2px;
  justify-items: start;
  text-align: start;
  padding: var(--s-2) var(--s-3);
  border: 1px solid var(--marco-linea);
  border-radius: var(--radio);
  background: var(--marco-alto);
  color: var(--marco-tinta);
  cursor: pointer;
}

.camino:hover {
  border-color: var(--marco-recurso);
}

.camino.activo {
  border-color: var(--marco-captado);
  background: oklch(0.3 0.06 160 / 0.35);
}

.camino-nombre {
  font-weight: 700;
  font-size: var(--text-meta);
}

.camino-detalle {
  font-size: 11px;
  color: var(--marco-tenue);
}

.navegacion {
  display: flex;
  flex-wrap: wrap;
  gap: var(--s-2);
  margin-inline-start: auto;
}

.btn-atras,
.btn-seguir {
  padding: var(--s-1) var(--s-3);
  border-radius: var(--radio);
  font-weight: 600;
  font-size: var(--text-meta);
  cursor: pointer;
}

.btn-atras {
  border: 1px solid var(--marco-linea);
  background: var(--marco-alto);
  color: var(--marco-tinta);
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

.panel-lugar {
  position: relative;
  display: flex;
  flex-direction: column;
  flex: 1 1 auto;
  min-block-size: 0;
}

.fuente-linea {
  position: absolute;
  z-index: 2;
  inset-block-start: var(--s-2);
  inset-inline-start: 50%;
  translate: -50% 0;
  margin: 0;
  max-inline-size: min(36rem, calc(100% - 7rem));
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  padding: var(--s-1) var(--s-2);
  border-radius: var(--radio);
  background: oklch(1 0 0 / 0.9);
  backdrop-filter: blur(6px);
  box-shadow: var(--sombra-caja);
  font-size: var(--text-meta);
  color: var(--tinta);
  pointer-events: none;
}

.mapa-caja {
  flex: 1 1 auto;
  min-block-size: 0;
  overflow: hidden;
  background: var(--map-oceano);
}

.panel-libre {
  flex: 1 1 auto;
  display: grid;
  place-items: center;
  padding: var(--s-6) var(--s-4);
  overflow: auto;
  background: var(--lienzo);
  color: var(--tinta);
}

.tarjeta-libre {
  display: grid;
  gap: var(--s-4);
  inline-size: min(40rem, 100%);
  padding: var(--s-6);
  border: 1px solid var(--borde-suave);
  border-radius: var(--radio-escena);
  background: var(--panel);
  box-shadow: var(--sombra-escena);
}

.tarjeta-libre h2 {
  margin: 0;
  font-size: var(--text-nivel);
}

.explica {
  margin: 0;
  color: var(--tenue);
}

.campos {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(10rem, 1fr));
  gap: var(--s-3);
}

.campo {
  display: grid;
  gap: 6px;
}

.campo-nombre {
  font-size: var(--text-meta);
  font-weight: 700;
  color: var(--tinta);
}

.campo-caja {
  display: flex;
  align-items: center;
  gap: var(--s-2);
  padding-inline-end: var(--s-3);
  border: 1px solid var(--borde);
  border-radius: var(--radio);
  background: var(--lienzo);
}

.campo-caja:focus-within {
  border-color: var(--foco);
  box-shadow: 0 0 0 3px var(--acento-suave);
}

.campo-caja input {
  flex: 1;
  min-inline-size: 0;
  padding: var(--s-2) var(--s-3);
  border: none;
  background: transparent;
  color: var(--tinta);
  font-family: var(--font-display);
  font-size: var(--text-seccion);
  font-weight: 600;
  outline: none;
}

.campo-unidad {
  font-size: var(--text-meta);
  font-weight: 600;
  color: var(--tenue);
}

.campo-rango {
  font-size: 11px;
  color: var(--tenue);
}

.aviso-hipotetico {
  margin: 0;
  padding: var(--s-2) var(--s-3);
  border-radius: var(--radio);
  border-inline-start: 3px solid var(--conf-pendiente);
  background: var(--aviso-fondo);
  font-size: var(--text-meta);
}

.btn-simular-libre {
  justify-self: start;
  padding: var(--s-2) var(--s-4);
  border: none;
  border-radius: var(--radio);
  background: var(--rol-mar-profundo);
  color: var(--marco-tinta);
  font-weight: 700;
  cursor: pointer;
}

.btn-simular-libre:hover {
  background: var(--rol-mar-medio);
}

.origen :focus-visible {
  outline: 2px solid var(--foco);
  outline-offset: 2px;
  border-radius: 4px;
}

@media (width <= 48rem) {
  .origen-cabecera {
    padding: var(--s-2) var(--s-3);
  }

  .navegacion {
    margin-inline-start: 0;
    inline-size: 100%;
  }
}
</style>
