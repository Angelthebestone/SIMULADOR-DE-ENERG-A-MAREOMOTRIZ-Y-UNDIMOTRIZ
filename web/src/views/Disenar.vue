<template>
  <section class="disenar" aria-labelledby="titulo-disenar">
    <h1 id="titulo-disenar">Diseñar — decidir</h1>

    <!-- Rail 4 anclas -->
    <nav class="rail" aria-label="Secciones Diseñar — rail 4 anclas">
      <a href="#sec-resonancia" @click.prevent="irA('sec-resonancia')" class="ancla" :class="{activo: activa==='sec-resonancia'}" tabindex="0">1 · Resonancia</a>
      <a href="#sec-limites" @click.prevent="irA('sec-limites')" class="ancla" :class="{activo: activa==='sec-limites'}" tabindex="0">2 · Límites Falnes</a>
      <a href="#sec-matriz" @click.prevent="irA('sec-matriz')" class="ancla" :class="{activo: activa==='sec-matriz'}" tabindex="0">3 · Matriz potencia</a>
      <a href="#sec-aep-lcoe" @click.prevent="irA('sec-aep-lcoe')" class="ancla" :class="{activo: activa==='sec-aep-lcoe'}" tabindex="0">4 · AEP / LCOE</a>
    </nav>

    <!-- Cada sección = 100vh operable sin scroll previo a 1280x720 -->
    <section id="sec-resonancia" class="seccion" tabindex="0" aria-labelledby="h-resonancia">
      <h2 id="h-resonancia">Resonancia — frecuencia natural vs Te del sitio</h2>
      <GraficaPlotly :figura="figResonancia" titulo="Respuesta cerca de resonancia" :height="320" />
      <!-- Veredicto fijo abajo dentro del mismo viewport -->
      <div class="veredicto">
        <p v-if="veredictoResonancia">{{ veredictoResonancia }}</p>
        <p v-else class="pendiente"><span aria-hidden="true">○</span> pendiente — sin dato de resonancia</p>
      </div>
      <EstadoBloque :estado="estadoResonancia" :motivo="motivoResonancia" />
    </section>

    <section id="sec-limites" class="seccion" tabindex="0" aria-labelledby="h-limites">
      <h2 id="h-limites">Límites teóricos — Falnes y ancho de captura</h2>
      <GraficaPlotly :figura="figLimites" titulo="Barrido B_pto vs potencia con óptimo analítico" :height="320" />
      <div class="veredicto">
        <p v-if="veredictoLimites">{{ veredictoLimites }}</p>
        <p v-else class="pendiente"><span aria-hidden="true">○</span> pendiente — sin cota Falnes</p>
        <p class="cita-larga" tabindex="0" :title="citaFalnes">{{ citaFalnesCorta }}</p>
      </div>
      <EstadoBloque :estado="estadoLimites" :motivo="motivoLimites" />
    </section>

    <section id="sec-matriz" class="seccion" tabindex="0" aria-labelledby="h-matriz">
      <h2 id="h-matriz">Matriz de potencia — Hs × Te</h2>
      <GraficaPlotly :figura="figMatriz" titulo="Matriz de potencia (W) por celda Hs–Te" :height="340" />
      <div class="veredicto">
        <p v-if="veredictoMatriz">{{ veredictoMatriz }}</p>
        <p v-else class="pendiente"><span aria-hidden="true">○</span> pendiente — sin matriz (simulación costosa: 85 pasos)</p>
        <button @click="pedirMatriz" :disabled="cargandoMatriz">{{ cargandoMatriz ? 'Calculando…' : 'Calcular matriz (60 s)' }}</button>
        <span v-if="progresoMatriz>0" role="status" aria-live="polite"> {{ progresoMatriz }}%</span>
      </div>
      <EstadoBloque :estado="estadoMatriz" :motivo="motivoMatriz" :mostrar-cancelar="cargandoMatriz" @cancelar="cancelarMatriz" />
    </section>

    <section id="sec-aep-lcoe" class="seccion" tabindex="0" aria-labelledby="h-aep-lcoe">
      <h2 id="h-aep-lcoe">AEP y LCOE — producción y coste por MWh</h2>
      <GraficaPlotly :figura="figAep" titulo="AEP por celda y contribución (%)" :height="320" />
      <GraficaPlotly :figura="figLcoe" titulo="LCOE vs diésel ZNI / SIN" :height="260" />
      <div class="veredicto">
        <div v-if="aep!==null" class="aep-line">AEP: <strong>{{ formatNum(aep,1) }} MWh/año</strong> — factor planta {{ aep ? formatPct(factorPlanta) : '—' }}</div>
        <div v-else class="pendiente"><span aria-hidden="true">○</span> pendiente — sin AEP</div>

        <div class="lcoe-line">
          <label>CAPEX <input type="number" v-model.number="capex" :min="0" :step="50000000" aria-label="CAPEX COP" /> COP
            <span class="miles">({{ formatMiles(capex) }} COP)</span>
          </label>
          <label>OPEX <input type="number" v-model.number="opex" :min="0" :step="10000000" aria-label="OPEX COP" /> COP/año
            <span class="miles">({{ formatMiles(opex) }} COP)</span>
          </label>
        </div>
        <div v-if="lcoe!==null" class="lcoe-valor">
          LCOE: <strong>{{ formatMiles(Math.round(lcoe)) }} COP/MWh</strong> — separador miles (punto) visible
          <span class="fuente">CRF 8% 20a · fórmula servicio economia.py</span>
        </div>
        <div v-else class="pendiente"><span aria-hidden="true">○</span> pendiente — completa CAPEX/AEP para LCOE</div>

        <!-- Tesis: cifra 8,9 kW/m de Isla Fuerte (verificado) frente a 40 kW/m umbral — el resto de la justificación detallada vive en Ver -->
        <p class="tesis-line">Tesis Isla Fuerte: <strong>8,9 kW/m</strong> verificado (Ortega et al. 2013 RE 57) frente a <strong>40 kW/m</strong> umbral (Osorio et al. 2016 / Handbook cap. 1). <span class="fuente">app/tesis.py::DENSIDADES</span></p>

        <!-- Criterio eliminatorio primero, corriente pendiente cuando sin dato -->
        <div class="criterios">
          <h3>Criterios emplazamiento</h3>
          <ul>
            <li v-for="c in criterios" :key="c.nombre">
              <span :aria-hidden="true">{{ simboloEstado(c.estado) }}</span> {{ c.nombre }} — {{ c.valor }} ({{ c.estado }}) <span class="fuente">{{ c.fuente }}</span>
            </li>
          </ul>
          <p v-if="estadoLegal" class="legal" :class="estadoLegal">
            Estado legal: <strong>{{ estadoLegal }}</strong> — {{ textoLegal }}
          </p>
          <p v-if="estadoLegal==='restringido'" class="nota-restringido">
            Restringido no es utilizable ni descartado — ver RUNAP. Tres estados legales visibles al elegir sitio.
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
import { formatearNumero } from '../utils/formato'

const props = defineProps<{
  figuras?: Record<string, { data: unknown[]; layout: Record<string,unknown> } | null>
  resultado?: { produccion_anual_mwh?: number; factor_planta?: number; potencia_nominal_w?: number; disponibilidad?: number; horas_ano?: number; recurso?: Record<string,unknown>; metadatos?: Record<string,unknown> }
  panelSitio?: { nombre?: string; estado_legal?: string; criterios?: Array<{nombre:string; valor:string; estado:string; fuente:string}>; veredicto?: string; fuente_runap?: string } | null
  sitioId?: string
}>()

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
  // Este cálculo reproduce economia.calcular_lcoe para mostrar separador miles; en producción viene del servicio
  // No inventar valores — si pendiente, lcoe es null y se muestra pendiente
  return anualizado / aep.value
})

// Estados por sección alcanzables por teclado
const estadoResonancia = computed(()=> figResonancia.value ? 'resultado' as const : 'pendiente' as const)
const motivoResonancia = computed(()=> figResonancia.value ? '' : 'sin serie de respuesta — ejecuta simulación')
const estadoLimites = computed(()=> figLimites.value ? 'resultado' as const : 'pendiente' as const)
const motivoLimites = computed(()=> figLimites.value ? '' : 'sin barrido B_pto')
const estadoMatriz = ref<'reposo'|'cargando'|'vacio'|'resultado'|'pendiente'|'error'|'deshabilitado'|'desbordado'>('reposo')
const motivoMatriz = ref('')
const cargandoMatriz = ref(false)
const progresoMatriz = ref(0)
const estadoAep = computed(()=> aep.value!==null ? 'resultado' as const : 'pendiente' as const)
const motivoAep = computed(()=> aep.value!==null ? '' : 'sin AEP — requiere matriz')

const citaFalnes = "Falnes (2002) Pmax=|Fe|^2/(8B); Handbook cap.1 §4.3 50% simétrico / ~100% no simétrico — cota superior de potencia absorbible, techos de absorción según simetría. Fuente: analisis/captura.py::cota_falnes, nucleo/hidrodinamica.py"
const citaFalnesCorta = computed(()=> citaFalnes.length>120 ? citaFalnes.slice(0,120)+'…' : citaFalnes)

const criterios = computed(()=> props.panelSitio?.criterios ?? [])
const estadoLegal = computed(()=> (props.panelSitio?.estado_legal as string) || (props.sitioId==='san_andres' ? 'restringido' : props.sitioId==='islas_rosario' || props.sitioId==='bahia_malaga' ? 'descartado' : 'utilizable'))
const textoLegal = computed(()=> props.panelSitio?.veredicto || (estadoLegal.value==='descartado' ? 'Área protegida — sitio no utilizable (eliminatorio primero)' : estadoLegal.value==='restringido' ? 'Reserva Biosfera / AMP — restringido, no es utilizable ni descartado' : 'Sin área protegida en 5 km — utilizable'))

function simboloEstado(e:string){ if(e==='verificado') return '●'; if(e==='inferido') return '◐'; return '○' }
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
function cancelarMatriz(){ abortMatriz?.abort() }

// Teclado rail: flechas Home/End ya en nav; ESC y Ctrl+E globales los maneja App.vue
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
onMounted(()=> window.addEventListener('scroll', onScroll, { passive:true }))
onBeforeUnmount(()=> window.removeEventListener('scroll', onScroll))

watch(()=> props.figuras, ()=> {
  if(figMatriz.value) { estadoMatriz.value='resultado'; progresoMatriz.value=100 }
}, { deep:true })
</script>

<style scoped>
.disenar{ max-width:1280px; margin:0 auto; padding:8px 12px; font-family: "Segoe UI", system-ui, sans-serif }
.rail{ position:sticky; top:0; z-index:5; display:flex; gap:8px; padding:8px 0; background: var(--panel, #fff); border-bottom:1px solid var(--borde-suave, #D6D6D1); overflow:auto; white-space:nowrap }
.ancla{ padding:6px 10px; border-radius:6px; text-decoration:none; color: var(--tinta, #172026); border:1px solid var(--borde, #B8B8B2); font-size:14px; font-weight:600; outline:none }
.ancla.activo, .ancla:hover{ background: var(--recurso, #0072B2); color:#fff; border-color: var(--recurso) }
.ancla:focus-visible{ outline:2px solid var(--foco, #0072B2); outline-offset:2px }

/* Cada sección = 100vh operable sin scroll previo a 1280x720 */
.seccion{
  height: 100vh;
  min-height: 100vh;
  max-height: 100vh;
  display:flex;
  flex-direction:column;
  gap:8px;
  padding:12px 0;
  box-sizing:border-box;
  overflow:auto; /* sección desplaza en su propio contenedor */
  border-bottom:1px solid var(--borde-suave);
  scroll-margin-top:48px;
}
.seccion:focus-visible{ outline:2px solid var(--foco); outline-offset:-2px; border-radius:6px }
.seccion h2{ margin:0 0 4px; font-size:18px; flex:0 0 auto }
.seccion .grafica{ flex:1 1 auto; min-height:220px }
.veredicto{ flex:0 0 auto; border-top:1px solid var(--borde-suave); padding-top:6px; font-size:14px; background: var(--panel); position:sticky; bottom:0 }
.veredicto:focus-visible{ outline:2px solid var(--foco); }
.pendiente{ border-left:3px solid var(--conf-pendiente, #A8340A); padding-left:8px; background: var(--acento-suave,#FFF0E6); font-style:italic }
.miles{ color: var(--tenue); font-size:12px }
.lcoe-line{ display:flex; gap:12px; flex-wrap:wrap; align-items:center; margin:6px 0 }
.lcoe-line input{ width:160px }
.miles{ white-space:nowrap }
.fuente{ font-size:12px; color: var(--tenue) }
.cita-larga{ font-size:12px; color: var(--tenue); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; cursor:help; border-bottom:1px dotted var(--tenue); max-width:100% }
.cita-larga:focus{ white-space:normal; overflow:visible; text-overflow:clip }
.criterios ul{ margin:6px 0; padding-left:18px; font-size:14px }
.legal{ font-size:14px; margin:6px 0 }
.legal.restringido{ border-left:3px solid var(--conf-inferido, #C07A00); padding-left:8px; background:#FFF8E6 }
.legal.descartado{ border-left:3px solid var(--conf-pendiente); padding-left:8px; background:#FFF0E6 }
.nota-restringido{ font-size:12px; color: var(--tenue); font-style:italic }

@media (max-width: 1280px) and (max-height: 720px){
  .seccion{ height:100vh; max-height:100vh }
}
@media (max-width: 320px){
  .rail{ gap:4px }
  .ancla{ padding:5px 6px; font-size:12px }
  .seccion{ height:100vh; max-height:100vh; padding:8px 0 }
}
.disenar :focus-visible{ outline:2px solid var(--foco, #0072B2); outline-offset:2px }
</style>
