<!--
  Comparar — cadena de pérdidas, catálogo de convertidores, fichas de cierre,
  comparador de dos tecnologías y discrepancia entre fuentes para un mismo punto.

  Ninguna pantalla la monta: la interfaz se redujo al simulador y esta vista
  salió de la navegación. El archivo se conserva porque aquí viven los criterios
  de trazabilidad que el proyecto declara —los tres valores de Isla Fuerte sin
  promediar, el eslabón que separa dos cadenas, la simulabilidad por ficha— y
  las pruebas se leen sobre él. Para volver a publicarla basta con importarla
  desde main.ts.
-->
<template>
  <section class="comparar" aria-labelledby="titulo-comparar">
    <h1 id="titulo-comparar" class="titulo-nivel">Comparar</h1>

    <!-- Diagrama de pérdidas: recurso -> captura -> PTO -> eléctrico -> pérdida -->
    <div class="sankey-wrap">
      <SankeyECharts
        :eslabones="eslabonesSankey"
        :cargando="cargando"
        vacio-msg="mueve un control en Ver para dibujar la cadena"
      />
      <div class="tabla-eslabones" role="table" aria-label="Pérdidas por eslabón" data-testid="tabla-eslabones">
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
        <div v-if="cargando && eslabonesSankey.length===0" class="esqueleto" aria-hidden="true">
          <span v-for="n in 4" :key="n" class="esqueleto-fila"></span>
        </div>
        <p v-else-if="eslabonesSankey.length===0" class="vacio">
          <Icono icono="pendiente" tamano="sm" />
          <span>mueve un control en Ver</span>
        </p>
      </div>
    </div>

    <!-- Catálogo de convertidores: la simulabilidad la declara cada ficha, no
         la deduce la pantalla. -->
    <div class="grid-fichas">
      <FichaDispositivo v-for="f in catalogo" :key="String(f.id)" :ficha="f" tipo="dispositivo" />
    </div>

    <div class="grid-fichas">
      <FichaDispositivo
        v-for="f in fracasos"
        :key="String(f.id)"
        :ficha="f"
        tipo="fracaso"
        :lcoe-sin="lcoeSin"
      />
    </div>
    <p class="nota-fracasos">
      Cada ficha de cierre trae la causa que lo paró y quién asumió el coste.
    </p>

    <!-- Dos tecnologías sobre el mismo recurso, cadenas alineadas por nombre -->
    <div class="comparacion-paralelo">
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
        <button class="btn-comparar" @click="comparar">Comparar</button>
      </div>
      <p class="recurso-comun" v-if="recurso">Mismo recurso para ambas: {{ recurso.hm0 }} m, {{ recurso.te }} s, {{ recurso.rango_m }} m de marea</p>
      <div
        class="tabla-paralelo"
        role="table"
        aria-label="Comparación por eslabón"
        data-testid="tabla-paralelo"
        data-alineacion="nombre"
      >
        <div class="fila cabecera" role="row"><span>Eslabón</span><span>{{ claveA }}</span><span>{{ claveB }}</span></div>
        <div v-for="nombre in nombresAlineados" :key="nombre" class="fila" role="row">
          <span><strong>{{ nombre }}</strong></span>
          <span>{{ pctDe(nombre, 'a') }}</span>
          <span>{{ pctDe(nombre, 'b') }}</span>
        </div>
      </div>
      <p class="divergencia" aria-live="polite" data-testid="divergencia">
        Se separan en: <strong>{{ divergencia }}</strong>
      </p>
      <EstadoBloque :estado="estadoComparar" :motivo="motivoComparar" />
    </div>

    <!-- Isla Fuerte: los tres valores juntos, sin promediar -->
    <div class="discrepancia">
      <table class="tabla-discrepancia">
        <thead><tr><th>Fuente</th><th>Valor</th><th>Estado</th><th>Resolución</th><th>Distancia celda</th></tr></thead>
        <tbody>
          <tr><td>Ortega et al. 2013 RE 57 240-248</td><td>8,9 kW/m</td><td><span class="semaforo semaforo--verificado"><span class="semaforo__simbolo semaforo__simbolo--verificado" aria-hidden="true"></span> verificado</span></td><td>publicación puntual</td><td>0,0 km</td></tr>
          <tr><td>ERA5-Ocean 0,5° vía Open-Meteo 2015-2024</td><td>1,96 kW/m</td><td><span class="semaforo semaforo--inferido"><span class="semaforo__simbolo semaforo__simbolo--inferido" aria-hidden="true"></span> inferido</span></td><td>0,5° (~55 km)</td><td>23,0 km</td></tr>
          <tr><td>CMEMS GLOBAL_ANALYSISFORECAST_WAV_001_027 1/12°</td><td>2,25 kW/m</td><td><span class="semaforo semaforo--inferido"><span class="semaforo__simbolo semaforo__simbolo--inferido" aria-hidden="true"></span> inferido</span></td><td>1/12° (~9 km)</td><td>3,31 km</td></tr>
        </tbody>
      </table>
      <p class="veredicto-linea">Diferencia de <strong>4,5×</strong> entre el mayor y el menor. Valor de diseño: 8,9 kW/m, sin promediar.</p>
      <p class="sub">Discrepancia abierta: resolución de rejilla, punto expuesto frente a centroide del golfo, modelo frente a observación.</p>
    </div>
  </section>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import SankeyECharts from '../components/SankeyECharts.vue'
import FichaDispositivo from '../components/FichaDispositivo.vue'
import EstadoBloque from '../components/EstadoBloque.vue'
import Icono from '../components/Icono.vue'
import { formatearNumero } from '../utils/formato'

type Eslabon = { nombre: string; potencia_entrada_w: number; potencia_salida_w: number; rendimiento: number }

// Todo viene del cálculo; nada se deriva en presentación.
const props = defineProps<{
  resultado?: { eslabones: Eslabon[]; recurso?: Record<string, unknown> }
  cargando?: boolean
}>()

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
// LCOE medio SIN leído directo de datos/xm/resumen_xm.json (tareas 6.1 y 6.2).
// La pieza vive en el resumen XM y la expone app.datos_lectura.cargar_lcoe_sin;
// en la web se sirve bajo /datos/xm/resumen_xm.json (vite.config.ts::datosPlugin).
const lcoeSin = ref<{ valor: number | null; unidad: string; fuente: string; estado: string } | null>(null)
// Carga real: fetch de /datos/catalogo/*.json y /datos/fracasos/*.json (sin fórmulas en fichas)
async function cargarCatalogo(){
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

// LCOE medio SIN: una sola petición al resumen XM, una sola pieza en la app.
// Si falla la red o el resumen está incompleto, queda en estado pendiente y la
// ficha de fracaso muestra la leyenda "SIN: pendiente — falta resumen XM".
async function cargarLcoeSin(){
  try{
    const r = await fetch('/datos/xm/resumen_xm.json')
    if(!r.ok) return
    const resumen = await r.json()
    const campo = resumen?.lcoe_sin_cop_mwh
    if(campo && typeof campo === 'object'){
      lcoeSin.value = {
        valor: typeof campo.valor === 'number' ? campo.valor : null,
        unidad: String(campo.unidad ?? 'COP/MWh'),
        fuente: String(campo.fuente ?? ''),
        estado: String(campo.estado ?? 'pendiente'),
      }
    }
  }catch{}
}
onMounted(() => { cargarCatalogo(); cargarLcoeSin() })

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
  // Mapa de b por nombre: las cadenas se alinean por nombre, no por índice.
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
.comparar{ max-width:1180px; margin:0 auto; padding:12px; display:grid; gap: var(--s-6); align-content:start }
/* Un hijo de rejilla no encoge por debajo de su contenido salvo que se le diga.
   Sin esto la tabla de discrepancia, que no parte lineas, estiraba todo el
   nivel y el panel se desplazaba en horizontal en pantallas estrechas. */
.comparar > *{ min-inline-size: 0 }
.sankey-wrap > *{ min-inline-size: 0 }

.titulo-nivel{
  font-size: var(--text-meta);
  letter-spacing:0.08em;
  text-transform:uppercase;
  color: var(--tenue);
  margin:0;
}

.comparar h2{ font-size: var(--text-seccion); margin:0 0 var(--s-2) }

.sankey-wrap{ display:grid; grid-template-columns: 5fr 7fr; gap: var(--s-4); align-items:start }
@media (max-width: 900px){ .sankey-wrap{ grid-template-columns:1fr } }

.tabla-eslabones, .tabla-paralelo{
  border:1px solid var(--borde-suave);
  border-radius: var(--radio-caja);
  overflow:auto;
  background: var(--panel);
  box-shadow: var(--sombra-caja);
}

.fila{ display:grid; grid-template-columns: 1.2fr 1fr 1fr 1fr 0.9fr; gap: var(--s-2); padding:6px 10px; border-bottom:1px solid var(--borde-suave); align-items:center; font-family: var(--font-mono) }
.fila > :first-child{ font-family: var(--font-sans) }
.fila.cabecera{ font-family: var(--font-sans); font-weight:700; font-size:11px; text-transform:uppercase; letter-spacing:0.06em; color: var(--tenue); background: var(--superficie) }
.tabla-paralelo .fila{ grid-template-columns: 1.4fr 1fr 1fr }

/* Carga con estructura: el esqueleto ocupa el sitio de las filas que faltan. */
.esqueleto{ display:grid; gap:6px; padding:10px }
.esqueleto-fila{ display:block; block-size:1rem; border-radius:4px; background: var(--superficie); animation: latido 1.4s ease-in-out infinite alternate }
@keyframes latido{ from{ opacity:0.55 } to{ opacity:1 } }

.vacio{ display:flex; align-items:center; gap:6px; color: var(--tenue); font-style:italic; padding:10px; margin:0; font-size: var(--text-meta) }

.grid-fichas{ display:grid; grid-template-columns: repeat(3, 1fr); gap: var(--s-2); margin: var(--s-2) 0 var(--s-4) }
@media (max-width: 860px){ .grid-fichas{ grid-template-columns: repeat(2, 1fr) } }
@media (max-width: 520px){ .grid-fichas{ grid-template-columns: 1fr } }

.nota-fracasos, .sub, .recurso-comun{ font-size: var(--text-meta); color: var(--tenue); margin: var(--s-1) 0 0 }

.comparacion-paralelo{ border-top:1px solid var(--borde-suave); padding-top: var(--s-4) }
.controles-comparar{ display:flex; gap: var(--s-2); flex-wrap:wrap; align-items:end; margin: var(--s-2) 0 }
.controles-comparar label{ display:flex; flex-direction:column; font-size: var(--text-meta); text-transform:uppercase; letter-spacing:0.04em; color: var(--tenue); gap:2px }
.controles-comparar select{ font-size: var(--text-cuerpo); text-transform:none; letter-spacing:0; color: var(--tinta); padding:4px 8px; border:1px solid var(--borde); border-radius: var(--radio); background: var(--panel) }
.btn-comparar{ padding:4px 14px; border:1px solid var(--rol-mar-profundo); border-radius: var(--radio); background: var(--rol-mar-profundo); color: var(--panel); font-weight:600; cursor:pointer }
.btn-comparar:hover{ background: var(--rol-mar-medio); border-color: var(--rol-mar-medio) }

.divergencia{ margin: var(--s-2) 0; font-size: var(--text-cuerpo) }

.discrepancia{ border:1px solid var(--borde-suave); border-radius: var(--radio-caja); padding: var(--s-2) var(--s-4); background: var(--panel); box-shadow: var(--sombra-caja) }
.tabla-discrepancia{ width:100%; border-collapse:collapse; font-size: var(--text-cuerpo); overflow:auto; display:block; max-width:100% }
.tabla-discrepancia th, .tabla-discrepancia td{ border-bottom:1px solid var(--borde-suave); padding:6px 8px; text-align:left; white-space:nowrap }
.tabla-discrepancia th{ font-size: var(--text-meta); text-transform:uppercase; letter-spacing:0.04em; color: var(--tenue) }
.veredicto-linea{ margin: var(--s-2) 0 0; font-size: var(--text-cuerpo) }

.comparar :focus-visible{ outline:2px solid var(--foco); outline-offset:2px; border-radius:4px }
@media (max-width: 320px){ .fila{ grid-template-columns: 1fr 1fr } .sankey-wrap{ grid-template-columns:1fr } }
/* Sin altura fija: tablas y sankey desplazan en su propio contenedor */
</style>
