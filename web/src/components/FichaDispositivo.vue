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

    <!-- Bloques LCOE: solo en fichas de fracaso. Comparte el resultado calculado
         con el LCOE medio SIN del mismo año para que la diferencia sea explícita. -->
    <section v-if="esFracaso" class="lcoe-bloques" data-testid="lcoe-bloques">
      <div
        class="lcoe-bloque"
        :class="'lcoe-bloque--' + lcoeEstado"
        data-testid="lcoe-estimado"
      >
        <span class="lcoe-etiqueta">LCOE estimado en Isla Fuerte</span>
        <span v-if="lcoeEstado === 'verificado'" class="lcoe-cifra">
          {{ formatearNumero(lcoeValor, 0) }}
          <small>{{ lcoeUnidad }}</small>
        </span>
        <span v-else class="lcoe-pendiente-leyenda" data-testid="lcoe-pendiente-leyenda">
          LCOE: pendiente — falta {{ lcoeMotivoFalta }}
        </span>
        <span class="lcoe-fuente">{{ lcoeFuente }}</span>
      </div>

      <div
        class="lcoe-bloque"
        :class="'lcoe-bloque--' + lcoeSinEstado"
        data-testid="lcoe-sin"
      >
        <span class="lcoe-etiqueta">LCOE medio SIN (mismo año)</span>
        <span v-if="lcoeSinEstado === 'verificado' && lcoeSinValor !== null" class="lcoe-cifra">
          {{ formatearNumero(lcoeSinValor, 0) }}
          <small>{{ lcoeSinUnidad }}</small>
        </span>
        <span v-else class="lcoe-pendiente-leyenda">
          SIN: pendiente — falta resumen XM
        </span>
        <span class="lcoe-fuente">{{ lcoeSinFuente }}</span>
      </div>

      <p
        v-if="lcoeEstado === 'verificado' && lcoeSinEstado === 'verificado' && lcoeValor !== null && lcoeSinValor !== null && lcoeSinValor > 0"
        class="lcoe-diferencia"
        data-testid="lcoe-diferencia"
      >
        Diferencia frente a SIN:
        <strong>{{ formatearNumero(lcoeValor / lcoeSinValor, 2) }}×</strong>
      </p>
    </section>

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
import { formatearNumero } from '../utils/formato'

type LcoeCampo = {
  valor: number | null
  unidad: string
  fuente: string
  estado: 'verificado' | 'pendiente' | 'inferido' | string
}

const props = defineProps<{
  ficha: Record<string, unknown>
  tipo?: 'dispositivo' | 'fracaso'
  lcoeSin?: LcoeCampo | null
}>()

const esFracaso = computed(() => props.tipo === 'fracaso' || !!props.ficha.causa)

const naturaleza = computed(() => {
  const c = String(props.ficha.causa || '').toLowerCase()
  const etiquetas: string[] = []
  if (c.includes('economic') || c.includes('coste') || c.includes('capital')) etiquetas.push('económica')
  if (c.includes('tecnic') || c.includes('averia') || c.includes('fatiga') || c.includes('falla') || c.includes('potencia real mitad')) etiquetas.push('técnica')
  if (c.includes('pec') || c.includes('ambient') || c.includes('mortalidad')) etiquetas.push('ambiental')
  return etiquetas.length ? `causa ${etiquetas.join(' y ')}` : 'causa: ver detalle'
})

const simulableTexto = computed(() =>
  props.ficha.simulable ? 'con modelo dinámico' : 'sólo consultable'
)

const estadoTexto = computed(() => (props.ficha.estado ? String(props.ficha.estado) : ''))
const iconoEstado = computed(() => {
  const e = estadoTexto.value
  return e === 'verificado' || e === 'inferido' || e === 'pendiente' ? e : 'pendiente'
})

// ---- Bloques LCOE (tareas 6.1 y 6.2) -------------------------------------

const lcoeCampo = computed<LcoeCampo | null>(() => {
  const c = props.ficha.lcoe_estimado_cop_mwh
  return c && typeof c === 'object' ? (c as LcoeCampo) : null
})

const lcoeValor = computed(() => {
  const v = lcoeCampo.value?.valor
  return typeof v === 'number' && Number.isFinite(v) ? v : null
})
const lcoeUnidad = computed(() => lcoeCampo.value?.unidad || 'COP/MWh')
const lcoeFuente = computed(() => lcoeCampo.value?.fuente || '')
const lcoeEstado = computed(() => {
  const e = lcoeCampo.value?.estado
  return e === 'verificado' || e === 'pendiente' || e === 'inferido' ? e : 'pendiente'
})
// El campo `fuente` se usa para declarar qué dato falta (tarea 6.2).
const lcoeMotivoFalta = computed(() => {
  const f = lcoeFuente.value
  if (!f) return 'datos del dispositivo en el catálogo'
  return f
})

const lcoeSinEstado = computed(() => {
  const e = props.lcoeSin?.estado
  return e === 'verificado' || e === 'pendiente' || e === 'inferido' ? e : 'pendiente'
})
const lcoeSinValor = computed(() => {
  const v = props.lcoeSin?.valor
  return typeof v === 'number' && Number.isFinite(v) ? v : null
})
const lcoeSinUnidad = computed(() => props.lcoeSin?.unidad || 'COP/MWh')
const lcoeSinFuente = computed(() => props.lcoeSin?.fuente || '')

// ---- Detalles plegados -----------------------------------------------------

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

/* ---- Bloques LCOE estimado / LCOE SIN ---- */
.lcoe-bloques {
  display: grid;
  gap: var(--s-1);
  margin: var(--s-1) 0 0;
  padding: var(--s-1) var(--s-2);
  border: 1px solid var(--borde-suave);
  border-radius: var(--radio);
  background: var(--superficie);
}

.lcoe-bloque {
  display: grid;
  grid-template-columns: 1fr auto;
  align-items: baseline;
  gap: 2px var(--s-2);
  font-size: var(--text-meta);
  padding-block: 2px;
}

.lcoe-etiqueta {
  grid-column: 1 / -1;
  font-size: var(--text-meta);
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--tenue);
}

.lcoe-cifra {
  font-size: var(--text-seccion);
  font-weight: 700;
  color: var(--rol-captado);
  font-variant-numeric: tabular-nums;
  justify-self: end;
}
.lcoe-cifra small {
  font-size: 0.55em;
  font-weight: 600;
  color: var(--tenue);
}

.lcoe-bloque--pendiente .lcoe-cifra { color: var(--tenue); }

.lcoe-fuente {
  grid-column: 1 / -1;
  color: var(--tenue);
  font-size: 0.85em;
  overflow-wrap: anywhere;
}

.lcoe-pendiente-leyenda {
  grid-column: 1 / -1;
  font-style: italic;
  color: var(--conf-pendiente);
  font-size: var(--text-meta);
}

.lcoe-diferencia {
  margin: 0;
  padding-block-start: var(--s-1);
  border-block-start: 1px dashed var(--borde-suave);
  font-size: var(--text-meta);
  color: var(--tenue);
}
.lcoe-diferencia strong {
  color: var(--tinta);
  font-weight: 700;
}

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