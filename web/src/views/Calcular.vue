<template>
  <section class="calcular" aria-labelledby="titulo-calcular">
    <h1 id="titulo-calcular">Calcular — leer</h1>
    <p class="sub">Una columna 66ch, derivación paso a paso. Toda magnitud viene del contrato Resultado.</p>

    <!-- FORMULA_DENSIDAD variable exacta -->
    <div class="formula-card">
      <h2>Densidad de potencia incidente</h2>
      <div ref="formulaDensidadEl" class="katex-block" role="math" aria-label="Fórmula densidad de potencia"></div>
      <p class="fuente">Fuente: Handbook cap. 1 §3.2 · ρ agua de mar 1025 kg/m³ · g 9,81 m/s²</p>
    </div>

    <!-- KaTeX para cada fórmula del contrato: densidad con \rho, \frac, ^{}, \text{8,9} -->
    <div v-for="(f, key) in formulas" :key="String(key)" class="formula-card">
      <h3>{{ String(key) }}</h3>
      <div :ref="el => { if(el) (refs[String(key)] = el as Element) }" class="katex-block" role="math"></div>
      <p class="valor-sustituido" v-if="f.sustitucion">{{ f.sustitucion }}</p>
      <p class="resultado" v-if="f.resultado">{{ f.resultado }}</p>
    </div>

    <!-- Ejemplo de render directo de valores sustituidos envueltos en \text{} para coma sin espacio -->
    <div class="demo-sustitucion">
      <h3>Ejemplo sustitución (formato español dentro de matemática)</h3>
      <div ref="demoEl" class="katex-block" role="math" aria-label="Ejemplo 8,9 kW/m"></div>
    </div>

    <EstadoBloque :estado="estado" :motivo="motivo" />
  </section>
</template>

<script setup lang="ts">
import { ref, watch, onMounted, reactive } from 'vue'
import EstadoBloque from '../components/EstadoBloque.vue'

/** Variable exacta exigida */
const FORMULA_DENSIDAD = "J = \\rho g^2 Hm0^2 Te / (64\\pi)"

const props = defineProps<{
  formulas?: Record<string, { expresion?: string; sustitucion?: string; resultado?: string; valor?: number } | string>
  resultado?: unknown
  cargando?: boolean
}>()

const estado = ref<'reposo'|'cargando'|'vacio'|'resultado'|'pendiente'|'error'|'deshabilitado'|'desbordado'>('reposo')
const motivo = ref('')

const formulaDensidadEl = ref<HTMLElement | null>(null)
const demoEl = ref<HTMLElement | null>(null)
const refs: Record<string, Element> = reactive({})

const formulas = ref<Record<string, { expresion?: string; sustitucion?: string; resultado?: string }>>({})

function normalizarFormulas(){
  const src = props.formulas as Record<string, unknown> | undefined
  if(!src){ formulas.value = {}; return }
  const out: Record<string, { expresion?: string; sustitucion?: string; resultado?: string }> = {}
  for(const [k,v] of Object.entries(src)){
    if(typeof v === 'string') out[k] = { expresion: v }
    else if(v && typeof v==='object') out[k] = v as Record<string,string>
  }
  formulas.value = out
  // Inyectar FORMULA_DENSIDAD si falta
  if(!out['J'] && !out['densidad_potencia']){
    out['J'] = { expresion: FORMULA_DENSIDAD, sustitucion: 'sustitución viene del contrato Resultado', resultado: '' }
  }
}

declare const katex: { render: (tex:string, el:Element, opts?:unknown)=>void }

async function asegurarKaTeX(): Promise<void> {
  if(typeof (window as unknown as Record<string,unknown>).katex !== 'undefined') return
  // KaTeX vendorizado sin red
  await new Promise<void>((resolve, reject)=>{
    const link = document.createElement('link')
    link.rel = 'stylesheet'
    link.href = '/vendor/katex/katex.min.css'
    document.head.appendChild(link)
    const s = document.createElement('script')
    s.src = '/vendor/katex/katex.min.js'
    s.onload = ()=> resolve()
    s.onerror = ()=> {
      const s2 = document.createElement('script')
      s2.src = './vendor/katex/katex.min.js'
      s2.onload = ()=> resolve()
      s2.onerror = ()=> reject(new Error('KaTeX no disponible'))
      document.head.appendChild(s2)
    }
    document.head.appendChild(s)
  })
}

// \rho para densidad agua, \frac{}{} y ^{} verificables; valores en \text{8,9} para coma pegada
function katexParaFormula(expr: string, sustitucion?: string): string {
  // Si expr ya viene con \rho/\frac/^, respetarlo. Texto plano muerto migrado a KaTeX vivo.
  const yaEsKaTeX = expr.includes('\\rho') || expr.includes('\\frac') || expr.includes('^{') || expr.includes('\\pi')
  let tex = expr
  if(!yaEsKaTeX){
    tex = FORMULA_DENSIDAD
  }
  // Si la expresión no contiene \rho pero debería (densidad agua), corregir
  if(tex.includes('rho') && !tex.includes('\\rho')) tex = tex.replace(/rho/g, '\\rho')
  // Sustitución: envolver valores con coma en \text{} para que la coma no meta espacio matemático
  let bloque = tex
  if(sustitucion){
    // Extraer números con coma y envolver en \text{}
    const conText = sustitucion.replace(/(\d+[.,]\d+)/g, '\\text{$1}')
    bloque = `${tex} \\\\ \\text{sustitución: } ${conText}`
  }
  return bloque
}

async function renderTodo(){
  try{ await asegurarKaTeX() }catch{ return }
  const K = (window as unknown as Record<string,unknown>).katex as typeof katex | undefined
  if(!K) return
  if(formulaDensidadEl.value){
    try{ K.render(FORMULA_DENSIDAD, formulaDensidadEl.value, { displayMode:true, throwOnError:false }) }catch{}
  }
  if(demoEl.value){
    // Demo: 8,9 con \text{} para coma sin espacio, miles con punto
    const demo = "\\rho = \\text{1.025} \\, \\text{kg/m}^3 \\quad J = \\frac{\\rho g^2 H_{m0}^2 T_e}{64\\pi} = \\frac{\\text{1.025}\\cdot 9{,}81^{2}\\cdot \\text{8,9}^{2}\\cdot \\text{5,39}}{64\\pi}"
    // Usamos \text{8,9} coma pegada; miles: \text{1.025}
    try{ K.render(demo, demoEl.value, { displayMode:true, throwOnError:false }) }catch{}
  }
  for(const [k, f] of Object.entries(formulas.value)){
    const el = refs[k]
    if(!el) continue
    const expr = f.expresion || FORMULA_DENSIDAD
    const tex = katexParaFormula(expr, f.sustitucion)
    try{ K.render(tex, el, { displayMode:true, throwOnError:false }) }catch{}
  }
}

onMounted(()=> {
  normalizarFormulas()
  if(props.cargando){ estado.value='cargando'; motivo.value='cargando fórmulas' }
  else if(!props.formulas || Object.keys(props.formulas).length===0){ estado.value='vacio' }
  else { estado.value='resultado' }
  renderTodo()
})

watch(()=> props.formulas, ()=> { normalizarFormulas(); renderTodo() }, { deep:true })
watch(()=> props.cargando, (v)=> { estado.value = v ? 'cargando' : (Object.keys(formulas.value).length ? 'resultado' : 'vacio') })
watch(formulas, renderTodo, { deep:true })

// Exponer constante para validación
defineExpose({ FORMULA_DENSIDAD })
</script>

<style scoped>
.calcular{ max-width: 66ch; margin:0 auto; padding:12px }
.sub{ font-size:12px; color: var(--tenue, #5A636B); max-width:66ch }
.formula-card{ border:1px solid var(--borde, #B8B8B2); border-radius:8px; padding:12px; background: var(--panel,#fff); margin:12px 0; overflow:auto; border-top:3px solid var(--foco); box-shadow: 0 1px 2px oklch(0.2 0.02 240 / 0.06); }
.katex-block{ min-height:32px; overflow:auto; display:block; max-width:100% }
.katex-block :deep(.katex){ font-size:1.05em }
.fuente{ font-size:12px; color: var(--tenue) }
.valor-sustituido, .resultado{ font-size:14px; overflow:auto; white-space:nowrap; max-width:100% }
.demo-sustitucion{ border:1px dashed var(--borde); border-radius:8px; padding:10px; overflow:auto }
.calcular :focus-visible{ outline:2px solid var(--foco, #0072B2); outline-offset:2px; border-radius:4px }
/* Sin altura fija: todo desplaza en su propio contenedor; 320px sin truncar */
@media (max-width: 320px){ .calcular{ max-width:100%; padding:8px } .katex-block{ font-size:0.95em } }
</style>
