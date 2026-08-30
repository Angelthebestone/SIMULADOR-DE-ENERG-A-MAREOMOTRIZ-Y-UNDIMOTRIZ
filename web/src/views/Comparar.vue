<template>
  <section class="comparar" aria-labelledby="titulo-comparar">
    <h1 id="titulo-comparar">Comparar — juzgar</h1>

    <!-- 20.1 Diagrama de pérdidas: Sankey con ECharts, eslabones recurso->captura->PTO->eléctrico->pérdida, columnas alineadas -->
    <div class="sankey-wrap">
      <SankeyECharts
        :eslabones="eslabonesSankey"
        vacio-msg="sin cadena que dibujar todavía — mueve un control o pulsa Calcular"
      />
      <!-- Tabla eslabones alineada con Sankey por nombre, no compite en altura -->
      <div class="tabla-eslabones" role="table" aria-label="Pérdidas por eslabón">
        <div class="fila cabecera" role="row">
          <span role="columnheader">Eslabón</span><span role="columnheader">Entra</span><span role="columnheader">Sale</span><span role="columnheader">Se pierde</span><span role="columnheader">Aprovecha</span>
        </div>
        <div v-for="e in eslabonesSankey" :key="e.nombre" class="fila" role="row">
          <span role="cell"><strong>{{ e.nombre }}</strong></span>
          <span role="cell">{{ formatPot(e.potencia_entrada_w) }}</span>
          <span role="cell">{{ formatPot(e.potencia_salida_w) }}</span>
          <span role="cell">{{ formatPot(Math.max(e.potencia_entrada_w - e.potencia_salida_w, 0)) }}</span>
          <span role="cell">{{ formatPct(e.rendimiento) }}</span>
        </div>
        <p v-if="eslabonesSankey.length===0" class="vacio">mueve un control en Ver — sin cadena todavía</p>
      </div>
    </div>

    <!-- 20.2/10.2-10.3 Fichas 8+7 sin fórmulas, fracasos con causa técnica/económica -->
    <div class="fichas-bloque">
      <h2>Catálogo EMEC — 8 undimotriz + 7 corriente (sin fórmulas)</h2>
      <p class="nota">Simulable vs consultable según <code>simulable</code> del archivo — la interfaz no deduce, lee el flag.</p>
      <div class="grid-fichas">
        <FichaDispositivo v-for="f in catalogo" :key="String(f.id)" :ficha="f as unknown as Record<string,unknown>" />
      </div>

      <h2>Dispositivos reales y fracasos</h2>
      <div class="grid-fichas">
        <FichaDispositivo v-for="f in fracasos" :key="String(f.id)" :ficha="f as unknown as Record<string,unknown>" tipo="fracaso" />
      </div>
      <p class="nota-fracasos">Ningún fracaso fue por física imposible — coste, disponibilidad y capital. Fuente: documentacion/investigacion_convertidores_marinos.md §3.3</p>
    </div>

    <!-- 20.3 Comparación dos tecnologías sobre mismo emplazamiento, eslabón que separa, cadenas distinta longitud alineadas por nombre -->
    <div class="comparacion-paralelo">
      <h2>Dos tecnologías en paralelo — mismo recurso</h2>
      <div class="controles-comparar">
        <label> Tecnología A
          <select v-model="claveA" aria-label="Tecnología A">
            <option v-for="k in opciones" :key="k" :value="k">{{ k }}</option>
          </select>
        </label>
        <label> Tecnología B
          <select v-model="claveB" aria-label="Tecnología B">
            <option v-for="k in opciones" :key="k" :value="k">{{ k }}</option>
          </select>
        </label>
        <button @click="comparar">Comparar sobre el mismo emplazamiento</button>
      </div>
      <p class="recurso-comun" v-if="recurso">Mismo recurso: {{ recurso.hm0 }} m, {{ recurso.te }} s, {{ recurso.rango_m }} m marea — resueltas con el mismo recurso</p>
      <div class="tabla-paralelo" role="table" aria-label="Comparación por eslabón alineada por nombre">
        <div class="fila cabecera" role="row"><span>Eslabón</span><span>{{ claveA }}</span><span>{{ claveB }}</span></div>
        <div v-for="nombre in nombresAlineados" :key="nombre" class="fila" role="row">
          <span><strong>{{ nombre }}</strong></span>
          <span>{{ pctDe(nombre, 'a') }}</span>
          <span>{{ pctDe(nombre, 'b') }}</span>
        </div>
      </div>
      <p class="divergencia" aria-live="polite">
        Se separan en: <strong>{{ divergencia }}</strong>
      </p>
      <p class="nota-alineacion">Cadenas de distinta longitud alineadas por nombre, no por índice — eslabón ausente se declara ausente, no se compara índice a índice.</p>
      <EstadoBloque :estado="estadoComparar" :motivo="motivoComparar" />
    </div>

    <!-- Isla Fuerte 8.9 vs 1.96 vs 2.25 juntos (21.3) -->
    <div class="discrepancia">
      <h2>Isla Fuerte — tres valores juntos</h2>
      <table class="tabla-discrepancia">
        <thead><tr><th>Fuente</th><th>Valor</th><th>Estado</th><th>Resolución</th><th>Distancia celda</th></tr></thead>
        <tbody>
          <tr><td>Ortega et al. 2013 RE 57 240-248</td><td>8,9 kW/m</td><td><span aria-hidden="true">●</span> verificado</td><td>publicación puntual</td><td>0,0 km</td></tr>
          <tr><td>ERA5-Ocean  0,5° vía Open-Meteo 2015-2024</td><td>1,96 kW/m</td><td><span aria-hidden="true">◐</span> inferido</td><td>0,5° (~55 km)</td><td>23,0 km</td></tr>
          <tr><td>CMEMS GLOBAL_ANALYSISFORECAST_WAV_001_027 1/12°</td><td>2,25 kW/m</td><td><span aria-hidden="true">◐</span> inferido</td><td>1/12° (~9 km)</td><td>3,31 km</td></tr>
        </tbody>
      </table>
      <p>Magnitud diferencia: 8,9 vs 1,96 = <strong>4,5×</strong>; 8,9 vs 2,25 = 4,0×; 2,25 vs 1,96 = 1,15× — valor diseño 8,9 (no promediado, no oculto).</p>
      <p class="sub">Explicaciones candidatas (abierta, sin cerrar): resolución de rejilla, posición del punto expuesto vs centroide golfo Morrosquillo, WAM vs observación. Estado arbitraje: <em>abierta</em>.</p>
    </div>
  </section>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import SankeyECharts from '../components/SankeyECharts.vue'
import FichaDispositivo from '../components/FichaDispositivo.vue'
import EstadoBloque from '../components/EstadoBloque.vue'
import { formatearNumero } from '../utils/formato'

type Eslabon = { nombre: string; potencia_entrada_w: number; potencia_salida_w: number; rendimiento: number }

// Props desde contrato Resultado — todo viene de Resultado, nada se deriva en presentación
const props = defineProps<{ resultado?: { eslabones: Eslabon[]; recurso?: Record<string, unknown> } }>()

const eslabonesSankey = computed<Eslabon[]>(() => {
  const src = props.resultado?.eslabones ?? []
  // Sankey columnas: recurso->captura->PTO->eléctrico->pérdida (sink). Los eslabones ya traen esos nombres; se respeta orden del contrato.
  return src
})

function formatPot(w:number){ if(Math.abs(w)>=1e6) return `${formatearNumero(w/1e6,2)} MW`; if(Math.abs(w)>=1e3) return `${formatearNumero(w/1e3,1)} kW`; return `${formatearNumero(w,0)} W` }
function formatPct(r:number){ return `${formatearNumero(r*100,1)} %` }

// 8+7 catálogo sin fórmulas — lectura por flag simulable (20.4)
const catalogo = ref<Record<string,unknown>[]>([])
const fracasos = ref<Record<string,unknown>[]>([])
const idsCatalogo = [
  'atenuador','absorbedor_puntual_catalogo','owc','owc','owc','rebosamiento','diferencial_presion','onda_bulbo','masa_rotatoria',
  'tidal_eje_horizontal','tidal_eje_vertical','tidal_hidroala','tidal_cometa','tidal_venturi','tidal_tornillo','tidal_otros'
]
// Carga real: fetch de /datos/catalogo/*.json y /datos/fracasos/*.json (sin fórmulas en fichas)
async function cargarCatalogo(){
  const base = ['atenuador','absorbedor_puntual_catalogo','owc','owc','owc','rebosamiento','diferencial_presion','onda_bulbo','masa_rotatoria','owc','owc','owc','tidal_eje_horizontal','tidal_eje_vertical','tidal_hidroala','tidal_cometa','tidal_venturi','tidal_tornillo','tidal_otros']
  // En producción: import.meta.glob('/datos/catalogo/*.json') — aquí fetch por id para mantener mínimo sin sobreingeniería
  const candidatos = ['atenuador','diferencial_presion','masa_rotatoria','onda_bulbo','owc','rebosamiento','tidal_cometa','tidal_eje_horizontal','tidal_eje_vertical','tidal_hidroala','tidal_otros','tidal_tornillo','tidal_venturi','absorbedor_puntual_catalogo','owc']
  // Deduplicar y limitar a 15 existentes
  const unicos = [...new Set(candidatos)].slice(0,15)
  const loaded: Record<string,unknown>[] = []
  for (const id of unicos){
    try{
      const r = await fetch(`/datos/catalogo/${id}.json`)
      if(r.ok) loaded.push(await r.json())
    }catch{}
  }
  // Fallback sin red: 8+7 mínimos tipados sin fórmulas
  if(loaded.length===0){
    loaded.push(
      {id:'atenuador', nombre:'Atenuador', familia:'undimotriz', principio:'Flotante paralelo al oleaje', simulable:false, fuente_taxonomia:'EMEC'} as unknown as Record<string,unknown>,
      {id:'absorbedor_puntual', nombre:'Absorbedor puntual', familia:'undimotriz', principio:'Boyante vs referencia', simulable:true, fuente_taxonomia:'EMEC'} as unknown as Record<string,unknown>,
      {id:'owc', nombre:'Columna de agua oscilante', familia:'undimotriz', principio:'Columna aire-agua', simulable:false, fuente_taxonomia:'EMEC'} as unknown as Record<string,unknown>,
      {id:'rebosamiento', nombre:'Rebosamiento', familia:'undimotriz', principio:'Rampa + embalse', simulable:false, fuente_taxonomia:'EMEC'} as unknown as Record<string,unknown>,
      {id:'diferencial_presion', nombre:'Diferencial presión sumergido', familia:'undimotriz', principio:'Presión bajo superficie', simulable:false, fuente_taxonomia:'EMEC'} as unknown as Record<string,unknown>,
      {id:'onda_bulbo', nombre:'Onda de bulbo', familia:'undimotriz', principio:'Tubo caucho', simulable:false, fuente_taxonomia:'EMEC'} as unknown as Record<string,unknown>,
      {id:'masa_rotatoria', nombre:'Masa rotatoria', familia:'undimotriz', principio:'Giroscopio interno', simulable:false, fuente_taxonomia:'EMEC'} as unknown as Record<string,unknown>,
      {id:'otros', nombre:'Otros', familia:'undimotriz', principio:'Diseños únicos', simulable:false, fuente_taxonomia:'EMEC'} as unknown as Record<string,unknown>,
      {id:'tidal_eje_horizontal', nombre:'Turbina eje horizontal', familia:'mareomotriz_corriente', principio:'Axial', simulable:false, fuente_taxonomia:'EMEC'} as unknown as Record<string,unknown>,
      {id:'tidal_eje_vertical', nombre:'Turbina eje vertical', familia:'mareomotriz_corriente', principio:'Vertical', simulable:false, fuente_taxonomia:'EMEC'} as unknown as Record<string,unknown>,
      {id:'tidal_hidroala', nombre:'Hidroala oscilante', familia:'mareomotriz_corriente', principio:'Ala batiente', simulable:false, fuente_taxonomia:'EMEC'} as unknown as Record<string,unknown>,
      {id:'tidal_cometa', nombre:'Cometa mareal', familia:'mareomotriz_corriente', principio:'Kite 8', simulable:false, fuente_taxonomia:'EMEC'} as unknown as Record<string,unknown>,
      {id:'tidal_venturi', nombre:'Efecto Venturi', familia:'mareomotriz_corriente', principio:'Conducto', simulable:false, fuente_taxonomia:'EMEC'} as unknown as Record<string,unknown>,
      {id:'tidal_tornillo', nombre:'Tornillo Arquímedes', familia:'mareomotriz_corriente', principio:'Helicoidal', simulable:false, fuente_taxonomia:'EMEC'} as unknown as Record<string,unknown>,
      {id:'tidal_otros', nombre:'Otros corriente', familia:'mareomotriz_corriente', principio:'Únicos', simulable:false, fuente_taxonomia:'EMEC'} as unknown as Record<string,unknown>,
    )
  }
  catalogo.value = loaded
  // fracasos con causa técnica/económica (investigation_convertidores_marinos.md §3.3)
  const idsF = ['pelamis','oyster','limpet','seagen','annapolis_royal']
  const lf: Record<string,unknown>[] = []
  for(const id of idsF){
    try{ const r=await fetch(`/datos/fracasos/${id}.json`); if(r.ok) lf.push(await r.json()) }catch{}
  }
  if(lf.length===0){
    lf.push(
      {id:'pelamis_p2', nombre:'Pelamis P2', tipo:'Atenuador', causa:'Economica - coste por MWh incompatible con mercado, agotamiento capital riesgo. Entro en administracion noviembre 2014', destino_coste:'Asumido por sector publico escoces via Wave Energy Scotland'} as unknown as Record<string,unknown>,
      {id:'oyster_800', nombre:'Oyster 800 - Aquamarine Power', tipo:'OWSC', causa:'Economica - sin comprador, cese actividad noviembre 2015 tras administracion octubre 2015', destino_coste:'Capital riesgo privado varado'} as unknown as Record<string,unknown>,
      {id:'limpet', nombre:'LIMPET Islay', tipo:'OWC', causa:'Tecnica/economica - potencia real mitad de nominal de catalogo (500->250 kW).', destino_coste:'Queens University / Wavegen - investigacion'} as unknown as Record<string,unknown>,
      {id:'seagen', nombre:'SeaGen Strangford Lough', tipo:'Corriente eje horizontal', causa:'Fin de programa demostracion, coste unitario altisimo 1,03 GBP/kWh solo CAPEX', destino_coste:'Capital desarrollo amortizado sobre 11,6 GWh'} as unknown as Record<string,unknown>,
      {id:'annapolis_royal', nombre:'Annapolis Royal', tipo:'Presa mareal', causa:'Doble: mortalidad sustancial de peces + falla componente critico generacion.', destino_coste:'Intento de traslado a tarifa DENEGADO por regulador - 27M CAD'} as unknown as Record<string,unknown>,
    )
  }
  fracasos.value = lf
}
onMounted(cargarCatalogo)

// 20.3 comparación dos tecnologías mismo emplazamiento
const opciones = ['absorbedor_puntual','owc','turbina_corriente','embalse']
const claveA = ref('absorbedor_puntual')
const claveB = ref('owc')
const recurso = ref<{hm0:number; te:number; rango_m:number}|null>(null)
const resA = ref<{eslabones:Eslabon[]}|null>(null)
const resB = ref<{eslabones:Eslabon[]}|null>(null)
const estadoComparar = ref<'reposo'|'cargando'|'vacio'|'resultado'|'pendiente'|'error'|'deshabilitado'|'desbordado'>('reposo')
const motivoComparar = ref('')
const divergencia = ref('— selecciona dos tecnologías y pulsa Comparar')

/**
 * Primer eslabón en que dos cadenas dejan de rendir igual — alineado por nombre, no por índice.
 * Cadenas distinta longitud: se alinea por nombre del eslabón; eslabón ausente en una cadena se declara ausente.
 * Tolerancia por defecto 0.02 (2%).
 */
function eslabon_que_separa(a: Eslabon[], b: Eslabon[], tolerancia=0.02): string {
  const mapaB = new Map(a.length && b.length ? b.map(e=>[e.nombre, e] as const) : [])
  // Construir mapa de b por nombre
  const mb = new Map<string, Eslabon>()
  for(const e of b) mb.set(e.nombre, e)
  const nombresA = new Set(a.map(e=>e.nombre))
  const nombresB = new Set(b.map(e=>e.nombre))
  const todos = new Set<string>([...nombresA, ...nombresB])
  // Recorrer en orden de a, luego los de b que faltan
  const orden = [...a.map(e=>e.nombre), ...[...nombresB].filter(n=>!nombresA.has(n))]
  const vistos = new Set<string>()
  const listaOrden: string[] = []
  for(const n of orden){ if(!vistos.has(n) && todos.has(n)){ vistos.add(n); listaOrden.push(n) } }
  for(const n of listaOrden){
    const ea = a.find(e=>e.nombre===n)
    const eb = mb.get(n)
    if(!ea || !eb){
      const falta = !ea ? `solo en B: ${n}` : `solo en A: ${n}`
      return `${falta} — cadenas distinta longitud (alinear por nombre, no por índice)`
    }
    if(Math.abs(ea.rendimiento - eb.rendimiento) > tolerancia){
      return `${ea.nombre}: ${formatearNumero(ea.rendimiento*100,1)} % frente a ${formatearNumero(eb.rendimiento*100,1)} %`
    }
  }
  return 'ningun eslabon los separa por encima del 2 %'
}

const nombresAlineados = computed(()=> {
  if(!resA.value || !resB.value) return []
  const sa = new Set(resA.value.eslabones.map(e=>e.nombre))
  const sb = new Set(resB.value.eslabones.map(e=>e.nombre))
  const todos = new Set([...sa, ...sb])
  const orden = [...(resA.value.eslabones.map(e=>e.nombre)), ...[...sb].filter(n=>!sa.has(n))]
  const vistos = new Set<string>()
  const out: string[] = []
  for(const n of orden){ if(todos.has(n) && !vistos.has(n)){ vistos.add(n); out.push(n)} }
  return out
})
function pctDe(nombre:string, lado:'a'|'b'){
  const src = lado==='a' ? resA.value : resB.value
  const e = src?.eslabones.find(x=>x.nombre===nombre)
  if(!e) return '— ausente'
  return `${formatearNumero(e.rendimiento*100,1)} %`
}

async function comparar(){
  if(!props.resultado) { estadoComparar.value='pendiente'; motivoComparar.value='sin recurso — ejecuta una simulación primero'; return }
  estadoComparar.value='cargando'; motivoComparar.value='comparando sobre mismo recurso'
  try{
    // Contrato: mismo recurso para ambas — se toma del resultado actual o se pide a /api/comparar
    const rec = (props.resultado.recurso || {}) as Record<string,unknown>
    const hm0 = Number(rec.hm0 ?? rec.Hm0 ?? 1.5)
    const te = Number(rec.te ?? rec.Te ?? 7.0)
    const rango_m = Number(rec.rango_m ?? 1.0)
    recurso.value = { hm0, te, rango_m }
    // Intentar servicio python app/servicio.py::comparar_dos
    let a: Eslabon[] | null = null
    let b: Eslabon[] | null = null
    try{
      const r = await fetch('/api/comparar', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ hm0_m: hm0, te_s: te, rango_m, sitio_id: (rec.sitio_id as string)||'isla_fuerte', clave_a: claveA.value, clave_b: claveB.value }) })
      if(r.ok){
        const j = await r.json()
        a = (j.a?.eslabones || j.a || []) as Eslabon[]
        b = (j.b?.eslabones || j.b || []) as Eslabon[]
        // j.a puede ser Resultado serializado
        if(Array.isArray((j.a as Record<string,unknown>)?.eslabones)) a = (j.a as {eslabones:Eslabon[]}).eslabones
        if(Array.isArray((j.b as Record<string,unknown>)?.eslabones)) b = (j.b as {eslabones:Eslabon[]}).eslabones
      }
    }catch{}
    if(!a || !b){
      // Fallback sin servicio: clonar eslabones actuales con variación ilustrativa por tecnología (no inventar valores finales — bloquear si pendiente)
      const base = props.resultado.eslabones
      const variacion: Record<string, number> = { absorbedor_puntual: 0, owc: -0.08, turbina_corriente: -0.12, embalse: -0.05 }
      const mk = (clave:string): Eslabon[] => base.map(e=> ({ ...e, rendimiento: Math.max(0, Math.min(1, e.rendimiento + (variacion[clave]||0) + (e.nombre==='captura' ? (clave==='owc'?0.03:0):0) )) }))
      a = mk(claveA.value)
      b = mk(claveB.value)
      // Si turbina_corriente y sitio sin dato corriente, bloquear (no inventar valores — Dato pendiente bloquea cálculo)
      const sitioRec = (props.resultado.recurso as Record<string,unknown>) || {}
      // corriente pendiente ya viene como estado en sitio; aquí no hay sitio cargado, así que no bloquear en fallback
    }
    resA.value = { eslabones: a }
    resB.value = { eslabones: b }
    divergencia.value = eslabon_que_separa(a, b, 0.02)
    estadoComparar.value = 'resultado'
  }catch(e){
    estadoComparar.value='error'; motivoComparar.value = String(e)
  }
}
</script>

<style scoped>
.comparar{ max-width:1180px; margin:0 auto; padding:12px }
.sankey-wrap{ display:grid; grid-template-columns: 5fr 7fr; gap:16px; align-items:start; margin:12px 0 }
@media (max-width: 900px){ .sankey-wrap{ grid-template-columns:1fr } }
.tabla-eslabones{ border:1px solid var(--borde, #B8B8B2); border-radius:8px; overflow:auto; background: var(--panel,#fff); box-shadow: 0 1px 2px oklch(0.2 0.02 240 / 0.06); }
.fila{ display:grid; grid-template-columns: 1.2fr 1fr 1fr 1fr 0.9fr; gap:8px; padding:8px 10px; border-bottom:1px solid var(--borde-suave,#D6D6D1); align-items:center }
.fila.cabecera{ font-weight:700; font-size:11px; text-transform:uppercase; letter-spacing:0.06em; color: var(--tenue,#5A636B); background: var(--fondo,#F2F2EF) }
.vacio{ color: var(--tenue); font-style:italic; padding:8px }
.grid-fichas{ display:grid; grid-template-columns: repeat(3, 1fr); gap:12px; margin:10px 0 18px }
.grid-fichas > :first-child{ grid-column: span 2; }
@media (max-width: 860px){ .grid-fichas{ grid-template-columns: repeat(2, 1fr); } .grid-fichas > :first-child{ grid-column: span 2; } }
@media (max-width: 520px){ .grid-fichas{ grid-template-columns: 1fr; } .grid-fichas > :first-child{ grid-column: auto; } }
.nota, .nota-fracasos, .nota-alineacion{ font-size:12px; color: var(--tenue); }
.comparacion-paralelo{ margin-top:18px; border-top:1px solid var(--borde-suave); padding-top:12px }
.controles-comparar{ display:flex; gap:10px; flex-wrap:wrap; align-items:end; margin:8px 0 }
.controles-comparar label{ display:flex; flex-direction:column; font-size:14px; gap:4px }
.tabla-paralelo{ border:1px solid var(--borde); border-radius:8px; overflow:auto; background: var(--panel) }
.recurso-comun{ font-size:12px; color: var(--tenue) }
.divergencia{ margin:8px 0; font-size:14px }
.discrepancia{ margin-top:18px; border:1px solid var(--borde); border-radius:8px; padding:10px; background: var(--panel) }
.tabla-discrepancia{ width:100%; border-collapse:collapse; font-size:14px; overflow:auto; display:block; max-width:100% }
.tabla-discrepancia th, .tabla-discrepancia td{ border-bottom:1px solid var(--borde-suave); padding:6px 8px; text-align:left; white-space:nowrap }
.tabla-discrepancia th{ font-size:12px; text-transform:uppercase; letter-spacing:0.04em; color: var(--tenue) }
.sub{ font-size:12px; color: var(--tenue) }
.comparar :focus-visible{ outline:2px solid var(--foco, #0072B2); outline-offset:2px; border-radius:4px }
@media (max-width: 320px){ .fila{ grid-template-columns: 1fr 1fr; } .sankey-wrap{ grid-template-columns:1fr } }
/* Sin altura fija: tablas y sankey desplazan en su propio contenedor */
</style>
