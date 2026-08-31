<template>
  <section class="disenar" aria-labelledby="titulo-disenar">
    <h1 id="titulo-disenar" class="sr-only">Diseñar</h1>

    <nav class="rail" aria-label="Secciones de Diseñar">
      <a v-for="s in SECCIONES" :key="s.id"
         :href="'#' + s.id"
         @click.prevent="irA(s.id)"
         class="ancla"
         :class="{ activo: activa === s.id }"
         :aria-current="activa === s.id ? 'true' : undefined"
         tabindex="0">
        <Icono :icono="s.icono" />
        <span>{{ s.rotulo }}</span>
      </a>
    </nav>

    <!-- Cada sección llena el panel: operable sin scroll previo a 1280x720 -->
    <section id="sec-resonancia" class="seccion" tabindex="0" aria-labelledby="h-resonancia">
      <h2 id="h-resonancia">Resonancia — frecuencia natural frente al periodo del sitio</h2>
      <GraficaPlotly class="grafica" :figura="figResonancia" titulo="Respuesta cerca de resonancia" :motivo="motivoResonancia" />
      <div class="veredicto">
        <p v-if="veredictoResonancia" class="insignia">{{ veredictoResonancia }}</p>
      </div>
    </section>

    <section id="sec-limites" class="seccion" tabindex="0" aria-labelledby="h-limites">
      <h2 id="h-limites">Límites teóricos — cota de absorción y ancho de captura</h2>
      <GraficaPlotly class="grafica" :figura="figLimites" titulo="Barrido del freno del PTO con el óptimo analítico" :motivo="motivoLimites" />
      <div class="veredicto">
        <p v-if="veredictoLimites" class="insignia">{{ veredictoLimites }}</p>
        <p class="fuente">Falnes 2002 · Handbook cap. 1 §4.3</p>
      </div>
    </section>

    <section id="sec-matriz" class="seccion" tabindex="0" aria-labelledby="h-matriz">
      <h2 id="h-matriz">Matriz de potencia — altura por periodo</h2>
      <GraficaPlotly class="grafica" :figura="figMatriz" titulo="Potencia por celda de altura y periodo" :cargando="cargandoMatriz" motivo="sin matriz — pulsa Calcular matriz" />
      <div class="veredicto">
        <p v-if="veredictoMatriz" class="insignia">{{ veredictoMatriz }}</p>
        <div class="acciones">
          <button class="btn-accion" @click="pedirMatriz" :disabled="cargandoMatriz">
            <Icono :icono="cargandoMatriz ? 'calculando' : 'matriz'" />
            <span>{{ cargandoMatriz ? 'Calculando…' : 'Calcular matriz (60 s)' }}</span>
          </button>
          <span v-if="progresoMatriz>0" role="status" aria-live="polite" class="progreso"> {{ progresoMatriz }}%</span>
        </div>
      </div>
      <EstadoBloque :estado="estadoMatriz" :motivo="motivoMatriz" :mostrar-cancelar="cargandoMatriz" @cancelar="cancelarMatriz" />
    </section>

    <section id="sec-aep-lcoe" class="seccion" tabindex="0" aria-labelledby="h-aep-lcoe">
      <h2 id="h-aep-lcoe">Producción y coste por MWh</h2>
      <div class="graficas-par">
        <GraficaPlotly class="grafica" :figura="figAep" titulo="Producción por celda y contribución" />
        <GraficaPlotly class="grafica" :figura="figLcoe" titulo="Coste por MWh frente a diésel de zona no interconectada" />
      </div>

      <div class="veredicto tablero">
        <div class="cifras">
          <div class="cifra-bloque">
            <span class="cifra-etiqueta">Producción anual</span>
            <span v-if="aep!==null" class="cifra-valor">{{ formatNum(aep,1) }} <small>MWh/año</small></span>
            <span v-else class="cifra-pendiente semaforo semaforo--pendiente">
              <Icono icono="pendiente" tamano="sm" /><span>pendiente</span>
            </span>
          </div>
          <div class="cifra-bloque">
            <span class="cifra-etiqueta">Factor de planta</span>
            <span v-if="aep!==null" class="cifra-valor">{{ formatPct(factorPlanta) }}</span>
            <span v-else class="cifra-pendiente semaforo semaforo--pendiente">
              <Icono icono="pendiente" tamano="sm" /><span>pendiente</span>
            </span>
          </div>
          <div class="cifra-bloque">
            <span class="cifra-etiqueta">Coste por MWh</span>
            <span v-if="lcoe!==null" class="cifra-valor cifra-coste" data-testid="lcoe-valor">
              {{ formatMiles(Math.round(lcoe)) }} <small>COP/MWh</small>
            </span>
            <span v-else class="cifra-pendiente semaforo semaforo--pendiente" data-testid="lcoe-valor">
              <Icono icono="pendiente" tamano="sm" /><span>pendiente — falta CAPEX o producción</span>
            </span>
          </div>
        </div>

        <fieldset class="panel-costes">
          <legend>Inversión</legend>
          <label>CAPEX
            <input type="number" v-model.number="capex" :min="0" :step="50000000" aria-label="CAPEX en pesos" />
            <span class="unidad">COP · {{ formatMiles(capex) }}</span>
          </label>
          <label>OPEX
            <input type="number" v-model.number="opex" :min="0" :step="10000000" aria-label="OPEX anual en pesos" />
            <span class="unidad">COP/año · {{ formatMiles(opex) }}</span>
          </label>
          <p class="fuente">Factor de recuperación de capital 8 % · 20 años</p>
        </fieldset>

        <p class="tesis-line">Isla Fuerte <strong>8,9 kW/m</strong> verificado frente a <strong>40 kW/m</strong> de umbral de granja.</p>

        <div class="criterios">
          <h3>Criterios del emplazamiento</h3>
          <div class="tabla-criterios" role="table" aria-label="Criterios del emplazamiento" data-testid="tabla-criterios">
            <div v-for="c in filasCriterios" :key="c.nombre" class="fila-criterio" role="row" :data-estado="c.estado">
              <span role="cell" class="c-estado" :class="'semaforo semaforo--' + c.estado">
                <Icono :icono="c.estado" tamano="sm" />
                <span class="c-estado-txt">{{ c.estado }}</span>
              </span>
              <span role="cell" class="c-nombre">{{ c.nombre }}</span>
              <span role="cell" class="c-valor">{{ c.valor }}</span>
              <span role="cell" class="c-fuente">{{ c.fuente }}</span>
            </div>
          </div>
          <p class="legal" :class="estadoLegal" data-testid="estado-legal" :data-estado="estadoLegal">
            <Icono :icono="iconoLegal" tamano="sm" />
            <span><strong>{{ estadoLegal }}</strong> — {{ textoLegal }}</span>
          </p>
        </div>
      </div>
      <EstadoBloque :estado="estadoAep" :motivo="motivoAep" />
    </section>
  </section>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount, watch } from 'vue'
import GraficaPlotly from '../components/GraficaPlotly.vue'
import EstadoBloque from '../components/EstadoBloque.vue'
import Icono from '../components/Icono.vue'
import { formatearNumero } from '../utils/formato'

const props = defineProps<{
  figuras?: Record<string, { data: unknown[]; layout: Record<string,unknown> } | null>
  resultado?: { produccion_anual_mwh?: number; factor_planta?: number; potencia_nominal_w?: number; disponibilidad?: number; horas_ano?: number; recurso?: Record<string,unknown>; metadatos?: Record<string,unknown> }
  panelSitio?: { nombre?: string; estado_legal?: string; criterios?: Array<{nombre:string; valor:string; estado:string; fuente:string}>; veredicto?: string; fuente_runap?: string } | null
  sitioId?: string
}>()

const SECCIONES = [
  { id:'sec-resonancia', rotulo:'Resonancia', icono:'resonancia' },
  { id:'sec-limites', rotulo:'Límites', icono:'limite' },
  { id:'sec-matriz', rotulo:'Matriz', icono:'matriz' },
  { id:'sec-aep-lcoe', rotulo:'Producción y coste', icono:'coste' },
] as const

const activa = ref('sec-resonancia')
function irA(id:string){
  activa.value = id
  const el = document.getElementById(id)
  if(el) el.scrollIntoView({ behavior: prefersReduced() ? 'auto' : 'smooth', block: 'start' })
  el?.focus()
}
function prefersReduced(){ return typeof window!=='undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches }

// Gráficas compuestas en Python (analisis/) — contrato entrega {data, layout} ya serializado, sin derivación en presentación
const figResonancia = computed(()=> props.figuras?.['resonancia'] ?? props.figuras?.['respuesta_periodo'] ?? null)
const figLimites = computed(()=> props.figuras?.['limites'] ?? props.figuras?.['barrido_bpto'] ?? null)
const figMatriz = computed(()=> props.figuras?.['matriz'] ?? props.figuras?.['matriz_potencia'] ?? null)
const figAep = computed(()=> props.figuras?.['aep'] ?? props.figuras?.['contribucion_pct'] ?? null)
const figLcoe = computed(()=> props.figuras?.['lcoe'] ?? null)

// Veredictos (no derivados en presentación — vienen del contrato)
const veredictoResonancia = computed(()=> {
  const f = props.figuras?.['resonancia'] as Record<string,unknown>|null
  const det = (f?.['detalle'] as string) || ''
  if(det) return det
  return (props.resultado as Record<string,unknown>)?.['veredicto_resonancia'] as string || ''
})
const veredictoLimites = computed(()=> {
  const f = props.figuras?.['limites'] as Record<string,unknown>|null
  return (f?.['detalle'] as string) || (props.resultado as Record<string,unknown>)?.['veredicto_limites'] as string || ''
})
const veredictoMatriz = computed(()=> {
  const f = props.figuras?.['matriz'] as Record<string,unknown>|null
  return (f?.['detalle'] as string) || ''
})

const aep = computed(()=> props.resultado?.produccion_anual_mwh ?? null)
const factorPlanta = computed(()=> props.resultado?.factor_planta ?? 0)

const capex = ref(0)
const opex = ref(0)
const lcoe = computed(()=> {
  if(aep.value===null || !aep.value || capex.value<=0) return null
  const crf = 0.08 * Math.pow(1.08,20) / (Math.pow(1.08,20)-1) // 8% 20a — mismo que economia.py _crf
  const anualizado = capex.value * crf + opex.value
  // Espejo de economia.calcular_lcoe; en producción el valor viene del servicio.
  // Sin CAPEX o sin producción no hay cifra: queda pendiente, no un cero.
  return anualizado / aep.value
})

// Estados por sección alcanzables por teclado
const motivoResonancia = computed(()=> figResonancia.value ? '' : 'sin serie de respuesta — ejecuta simulación')
const motivoLimites = computed(()=> figLimites.value ? '' : 'sin barrido B_pto')
const estadoMatriz = ref<'reposo'|'cargando'|'vacio'|'resultado'|'pendiente'|'error'|'deshabilitado'|'desbordado'>('reposo')
const motivoMatriz = ref('')
const cargandoMatriz = ref(false)
const progresoMatriz = ref(0)
const estadoAep = computed(()=> aep.value!==null ? 'resultado' as const : 'pendiente' as const)
const motivoAep = computed(()=> aep.value!==null ? '' : 'sin AEP — requiere matriz')

// La cita completa de Falnes y del Handbook vive en el diálogo Fuentes; aquí
// basta la referencia corta bajo el veredicto.
const criterios = computed(()=> props.panelSitio?.criterios ?? [])

// El criterio de corriente mareal se declara siempre. Si el cálculo no lo
// entrega, la fila aparece pendiente y sin cifra — no se rellena con nada.
const filasCriterios = computed(()=> {
  const filas = criterios.value.map(c=> ({
    nombre: String(c.nombre),
    valor: String(c.valor),
    estado: ['verificado','inferido','pendiente'].includes(String(c.estado)) ? String(c.estado) : 'inferido',
    fuente: String(c.fuente ?? ''),
  }))
  if(!filas.some(f=> f.nombre.toLowerCase().includes('corriente'))){
    filas.push({ nombre:'Corriente mareal', valor:'sin dato en este cálculo', estado:'pendiente', fuente:'' })
  }
  return filas
})
const estadoLegal = computed(()=> (props.panelSitio?.estado_legal as string) || (props.sitioId==='san_andres' ? 'restringido' : props.sitioId==='islas_rosario' || props.sitioId==='bahia_malaga' ? 'descartado' : 'utilizable'))
// Tres estados legales independientes: `restringido` no equivale a
// `utilizable` ni a `descartado`. El atributo data-estado los publica tal cual.
const textoLegal = computed(()=> props.panelSitio?.veredicto || (
  estadoLegal.value==='descartado' ? 'área protegida — no utilizable' :
  estadoLegal.value==='restringido' ? 'reserva de biosfera o área marina protegida' :
  'sin área protegida en 5 km'))
const iconoLegal = computed(()=> estadoLegal.value==='utilizable' ? 'verificado' : estadoLegal.value==='restringido' ? 'inferido' : 'pendiente')

function formatNum(v:number, d=1){ return formatearNumero(v,d) }
function formatPct(r:number){ return `${formatearNumero(r*100,1)} %` }
function formatMiles(n:number){ return formatearNumero(n,0) }

let abortMatriz: AbortController | null = null
async function pedirMatriz(){
  cargandoMatriz.value = true
  estadoMatriz.value = 'cargando'
  motivoMatriz.value = 'matriz en curso — 85% del tiempo'
  progresoMatriz.value = 10
  abortMatriz = new AbortController()
  try{
    const r = await fetch('/api/matriz', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ sitio_id: props.sitioId || 'isla_fuerte' }), signal: abortMatriz.signal })
    if(!r.ok) throw new Error(`HTTP ${r.status}`)
    const j = await r.json()
    progresoMatriz.value = 100
    estadoMatriz.value = 'resultado'
    motivoMatriz.value = ''
    // j.figura_matriz compuesta en Python — se emite hacia arriba
    // Aquí se deja que el padre reinyecte figuras
  }catch(e){
    if((e as Error).name==='AbortError'){ estadoMatriz.value='reposo'; motivoMatriz.value='cancelado' }
    else { estadoMatriz.value='error'; motivoMatriz.value=String(e) }
  }finally{ cargandoMatriz.value=false; abortMatriz=null }
}
function cancelarMatriz(){
  if(!abortMatriz) return
  abortMatriz.abort()
  // El progreso vuelve a cero: dejarlo a medias diría que sigue calculándose.
  progresoMatriz.value = 0
}

// ESC lo captura la carcasa y lo reemite como evento: aquí es lo que aborta
// la matriz en vuelo. Antes ESC no llegaba a este nivel y el cálculo seguía.
function onCancelarGlobal(){ cancelarMatriz() }

function onScroll(){
  const ids = ['sec-resonancia','sec-limites','sec-matriz','sec-aep-lcoe']
  let best = ids[0]
  let min = Infinity
  for(const id of ids){
    const el = document.getElementById(id)
    if(!el) continue
    const d = Math.abs(el.getBoundingClientRect().top)
    if(d < min){ min=d; best=id }
  }
  activa.value = best
}
let contenedorScroll: HTMLElement | Window = window
onMounted(()=> {
  contenedorScroll = document.getElementById('sec-resonancia')?.closest('[role=tabpanel]') ?? window
  contenedorScroll.addEventListener('scroll', onScroll, { passive:true })
  window.addEventListener('cancelar', onCancelarGlobal)
})
onBeforeUnmount(()=> {
  contenedorScroll.removeEventListener('scroll', onScroll)
  window.removeEventListener('cancelar', onCancelarGlobal)
})

watch(()=> props.figuras, ()=> {
  if(figMatriz.value) { estadoMatriz.value='resultado'; progresoMatriz.value=100 }
}, { deep:true })
</script>

<style scoped>
/* Altura definida para que el 100% de cada seccion resuelva contra el panel. */
.disenar{ max-width:1280px; margin:0 auto; padding:0 var(--s-2); block-size:100% }

.sr-only{ position:absolute; inline-size:1px; block-size:1px; overflow:hidden; clip-path:inset(50%); white-space:nowrap }

.rail{
  position:sticky; inset-block-start:0; z-index:5;
  display:flex; gap: var(--s-1); padding: var(--s-2) 0;
  background: var(--lienzo); border-bottom:1px solid var(--borde-suave);
  overflow:auto; white-space:nowrap;
}
.ancla{
  display:inline-flex; align-items:center; gap:6px;
  padding:6px 10px; border-radius: var(--radio); text-decoration:none;
  color: var(--tenue); border:1px solid transparent;
  font-size: var(--text-meta); font-weight:600; outline:none;
  transition: color var(--dur-rapida) var(--ease-salida), background-color var(--dur-rapida) var(--ease-salida);
}
.ancla:hover{ color: var(--tinta); background: var(--superficie) }
.ancla.activo{ background: var(--rol-mar-profundo); color: var(--panel); border-color: var(--rol-mar-profundo) }
.ancla:focus-visible{ outline:2px solid var(--foco); outline-offset:2px }

/* Cada sección llena el panel: operable sin scroll previo a 1280x720 */
.seccion{
  /* "Cada seccion = una pantalla, operable sin scroll previo". El contenedor
     que desplaza es el tabpanel, no la ventana: 100% del panel es la misma
     intencion bien medida (con 100vh cada seccion sobresalia del area util). */
  min-block-size:100%;
  display:flex;
  flex-direction:column;
  gap: var(--s-2);
  padding: var(--s-4) 0;
  box-sizing:border-box;
  border-bottom:1px solid var(--borde-suave);
  scroll-margin-top:3rem;
}
.seccion:focus-visible{ outline:2px solid var(--foco); outline-offset:-2px; border-radius: var(--radio) }
/* Los hijos de un contenedor flexible no encogen por debajo de su contenido
   salvo que se les diga: sin esto el panel se desplazaba en horizontal. */
.seccion > *{ min-inline-size: 0 }
.tablero > *{ min-inline-size: 0 }
.seccion h2{ margin:0; font-size: var(--text-seccion); flex:0 0 auto }
.seccion h3{ font-size: var(--text-meta); text-transform:uppercase; letter-spacing:0.05em; color: var(--tenue) }
.seccion .grafica{ flex:1 1 auto; min-block-size:13rem }
.graficas-par{ display:grid; grid-template-columns:1fr 1fr; gap: var(--s-4); flex:1 1 auto; min-block-size:13rem }
@media (max-width: 60rem){ .graficas-par{ grid-template-columns:1fr } }

.veredicto{
  flex:0 0 auto; border-top:1px solid var(--borde-suave); padding-top: var(--s-2);
  font-size: var(--text-cuerpo); background: var(--panel);
}
.veredicto:focus-visible{ outline:2px solid var(--foco) }

/* Veredicto en una línea, con marca de color a la izquierda. */
.insignia{
  display:inline-block; margin:0 0 var(--s-1);
  border-inline-start:3px solid var(--rol-mar-profundo);
  padding: 2px var(--s-2); background: var(--superficie);
  border-radius:0 var(--radio) var(--radio) 0;
}

.acciones{ display:flex; align-items:center; gap: var(--s-2); flex-wrap:wrap }
.btn-accion{
  display:inline-flex; align-items:center; gap:6px;
  padding:4px 12px; border:1px solid var(--borde); border-radius: var(--radio);
  background: var(--panel); font-weight:600; cursor:pointer;
}
.btn-accion:hover:not(:disabled){ border-color: var(--foco) }
.btn-accion:disabled{ opacity:0.5; cursor:default }
.progreso{ font-family: var(--font-mono); font-weight:600 }

/* Tablero de la sección de coste: cifras, panel de inversión y criterios. */
.tablero{ display:grid; gap: var(--s-2) }
.cifras{ display:flex; flex-wrap:wrap; gap: var(--s-6) }
.cifra-bloque{ display:flex; flex-direction:column }
.cifra-etiqueta{ font-size: var(--text-meta); text-transform:uppercase; letter-spacing:0.05em; color: var(--tenue) }
.cifra-valor{ font-size: var(--text-seccion); font-weight:700; line-height:1.1 }
.cifra-valor small{ font-size:0.6em; font-weight:600; color: var(--tenue) }
.cifra-coste{ color: var(--rol-captado) }
.cifra-pendiente{ display:inline-flex; align-items:center; gap:4px; font-style:italic; color: var(--tenue); font-size: var(--text-meta) }

.panel-costes{
  display:flex; flex-wrap:wrap; align-items:end; gap: var(--s-2) var(--s-4);
  border:1px solid var(--borde-suave); border-radius: var(--radio-caja);
  padding: var(--s-1) var(--s-4) var(--s-2); background: var(--panel); margin:0;
}
.panel-costes legend{ font-size: var(--text-meta); text-transform:uppercase; letter-spacing:0.05em; color: var(--tenue); padding-inline:6px }
.panel-costes label{ display:flex; flex-direction:column; gap:2px; font-size: var(--text-meta); text-transform:uppercase; letter-spacing:0.04em; color: var(--tenue) }
.panel-costes input{ inline-size:11rem; font-family: var(--font-mono); color: var(--tinta); padding:4px 8px; border:1px solid var(--borde); border-radius: var(--radio); background: var(--panel) }
.panel-costes .unidad{ font-family: var(--font-mono); text-transform:none; letter-spacing:0 }

.tesis-line{ margin:0; font-size: var(--text-cuerpo) }
.fuente{ font-size: var(--text-meta); color: var(--tenue); margin: var(--s-1) 0 0 }

/* Criterios: tabla compacta, estado a la izquierda con icono y palabra. */
.tabla-criterios{ border:1px solid var(--borde-suave); border-radius: var(--radio-caja); overflow:auto; background: var(--panel) }
.fila-criterio{
  display:grid; grid-template-columns: 7rem minmax(7rem, 1fr) minmax(5rem, auto) minmax(5rem, 1fr);
  gap: var(--s-2); align-items:center; padding:4px var(--s-2);
  border-bottom:1px solid var(--borde-suave); font-size: var(--text-meta);
}
.fila-criterio:last-child{ border-bottom:none }
.c-estado{ display:inline-flex; align-items:center; gap:4px }
.c-estado-txt{ font-size: var(--text-meta) }
.fila-criterio[data-estado="verificado"] .c-estado{ color: var(--conf-verificado) }
.fila-criterio[data-estado="inferido"] .c-estado{ color: var(--conf-inferido) }
.fila-criterio[data-estado="pendiente"] .c-estado{ color: var(--conf-pendiente) }
.c-nombre{ font-weight:600; color: var(--tinta) }
.c-valor{ font-family: var(--font-mono); color: var(--tinta) }
.c-fuente{ color: var(--tenue) }

.legal{ display:flex; align-items:center; gap:6px; font-size: var(--text-cuerpo); margin: var(--s-2) 0 0; padding-inline-start: var(--s-2) }
.legal.restringido{ border-inline-start:3px solid var(--conf-inferido) }
.legal.descartado{ border-inline-start:3px solid var(--conf-pendiente) }
.legal.utilizable{ border-inline-start:3px solid var(--conf-verificado) }

/* Bajo 48rem la tabla de criterios no cabe en cuatro columnas: cada fila pasa
   a bloque, con el estado arriba. Lo mismo con el panel de inversion. */
@media (max-width: 48rem){
  .fila-criterio{ grid-template-columns: 1fr; row-gap:2px; padding: var(--s-1) var(--s-2) }
  .c-valor, .c-fuente{ color: var(--tenue) }
  .panel-costes{ flex-direction:column; align-items:stretch }
  .panel-costes input{ inline-size:100% }
  .cifras{ gap: var(--s-4) }
}

@media (max-width: 320px){
  .ancla{ padding:5px 6px }
  .seccion{ padding: var(--s-2) 0 }
}
.disenar :focus-visible{ outline:2px solid var(--foco); outline-offset:2px }
</style>
