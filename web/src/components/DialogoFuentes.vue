<template>
  <dialog ref="dlg" class="dlg-fuentes" data-testid="dialogo-fuentes" aria-labelledby="h-fuentes" @close="alCerrar">
    <header class="dlg-cabecera">
      <h2 id="h-fuentes">Fuentes</h2>
      <button class="dlg-cerrar" data-testid="cerrar-fuentes" @click="cerrar">
        <Icono icono="cerrar" nombre="Cerrar fuentes" />
      </button>
    </header>

    <div class="dlg-cuerpo">
      <section v-for="g in GRUPOS" :key="g.titulo" class="grupo">
        <h3>{{ g.titulo }}</h3>
        <dl>
          <template v-for="r in g.refs" :key="r.clave">
            <dt>{{ r.clave }}</dt>
            <dd>{{ r.texto }}</dd>
          </template>
        </dl>
      </section>

      <section class="grupo">
        <h3>Cita completa</h3>
        <p class="cita-completa" data-testid="cita-completa">{{ cita }}</p>
      </section>
    </div>
  </dialog>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import Icono from './Icono.vue'

defineProps<{ cita: string }>()

// Las referencias que antes vivían truncadas dentro de cada vista. Aquí caben
// enteras porque este es el sitio donde se viene a leerlas.
const GRUPOS = [
  {
    titulo: 'Recurso y emplazamiento',
    refs: [
      { clave: 'Ortega et al. 2013', texto: 'Renewable Energy 57, 240-248. Isla Fuerte 8,9 kW/m, revisado por pares. Valor de diseño.' },
      { clave: 'Osorio et al. 2016 / Handbook cap. 1', texto: 'Umbral de 40 kW/m citado como referencia de rentabilidad para granjas undimotrices.' },
      { clave: 'Copernicus Marine', texto: 'GLOBAL_ANALYSISFORECAST_WAV_001_027, rejilla 1/12° (≈9 km). Celda 9,42 N 76,17 W, a 3,3 km del sitio. Periodo 2015-2024.' },
      { clave: 'ERA5-Ocean vía Open-Meteo', texto: 'Rejilla 0,5° (celda 9,5 N 76,0 W, a 23 km). Periodo 2015-2024, 87.672 registros.' },
      { clave: 'GMRT', texto: 'Lamont-Doherty Earth Observatory. Batimetría del transecto radial.' },
      { clave: 'RUNAP', texto: 'Parques Nacionales Naturales. 37 áreas marinas protegidas, 305.335 km².' },
    ],
  },
  {
    titulo: 'Dispositivo y límites teóricos',
    refs: [
      { clave: 'Falnes 2002', texto: 'Cota superior de la potencia absorbible por un cuerpo oscilante, P_max = |Fe|² / (8B).' },
      { clave: 'Handbook cap. 1 §4.3', texto: 'Techos de absorción según simetría: 50 % simétrico, cerca del 100 % no simétrico.' },
      { clave: 'EMEC', texto: 'Taxonomía de los ocho convertidores undimotrices y los siete de corriente mareal.' },
    ],
  },
  {
    titulo: 'Coste y sistema eléctrico',
    refs: [
      { clave: 'Superservicios', texto: 'Costo unitario ZNI y SIN, tarifas aplicadas y operación diaria.' },
      { clave: 'XM / API_XM', texto: 'Precio de bolsa nacional y factor de emisión de CO₂ equivalente por kWh.' },
      { clave: 'CRF 8 % · 20 años', texto: 'Factor de recuperación de capital usado para anualizar el CAPEX en el LCOE.' },
    ],
  },
] as const

const dlg = ref<HTMLDialogElement | null>(null)
let disparador: HTMLElement | null = null

function abrir() {
  disparador = document.activeElement as HTMLElement | null
  dlg.value?.showModal()
}

function cerrar() {
  dlg.value?.close()
}

// `close` lo emite tanto el botón como la tecla ESC del propio <dialog>: el
// foco vuelve al disparador por las dos vías sin duplicar el manejador.
function alCerrar() {
  disparador?.focus?.()
  disparador = null
}

defineExpose({ abrir, cerrar })
</script>

<style scoped>
.dlg-fuentes {
  inline-size: min(56rem, 92vw);
  max-block-size: 84dvh;
  padding: 0;
  border: 1px solid var(--borde);
  border-radius: var(--radio-caja);
  background: var(--panel);
  color: var(--tinta);
}

.dlg-fuentes::backdrop {
  background: oklch(0.2 0.02 240 / 0.45);
}

.dlg-cabecera {
  position: sticky;
  inset-block-start: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--s-4);
  padding: var(--s-2) var(--s-4);
  border-block-end: 1px solid var(--borde-suave);
  background: var(--panel);
}

.dlg-cabecera h2 {
  font-size: var(--text-seccion);
}

.dlg-cerrar {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-inline-size: 2.75rem;
  min-block-size: 2.75rem;
  border: 1px solid var(--borde);
  border-radius: var(--radio);
  background: var(--panel);
  cursor: pointer;
}

.dlg-cuerpo {
  padding: var(--s-4);
  display: grid;
  gap: var(--s-6);
}

.grupo h3 {
  font-size: var(--text-meta);
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--tenue);
  margin-block-end: var(--s-2);
}

.grupo dl {
  margin: 0;
  display: grid;
  grid-template-columns: minmax(9rem, 16rem) 1fr;
  gap: var(--s-1) var(--s-4);
}

.grupo dt {
  font-weight: 600;
}

.grupo dd {
  margin: 0;
  color: var(--tenue);
}

.cita-completa {
  margin: 0;
  font-family: var(--font-mono);
  font-size: var(--text-meta);
  line-height: 1.6;
  color: var(--tenue);
  overflow-wrap: anywhere;
}

@media (width <= 40rem) {
  .grupo dl {
    grid-template-columns: 1fr;
  }

  .grupo dd {
    margin-block-end: var(--s-2);
  }
}
</style>
