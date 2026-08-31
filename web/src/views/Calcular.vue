<template>
  <section class="calcular" aria-labelledby="titulo-calcular">
    <h1 id="titulo-calcular" class="titulo-nivel">Calcular</h1>

    <div class="formulas" data-testid="formulas">
      <article v-for="(f, key) in formulas" :key="String(key)" class="formula-card" data-testid="formula-tarjeta">
        <h2>{{ tituloDe(String(key)) }}</h2>
        <div :ref="el => { if(el) (refs[String(key)] = el as Element) }" class="katex-block" role="math"></div>
        <dl class="derivacion">
          <template v-if="f.sustitucion">
            <dt>Sustitución</dt>
            <dd class="valor-sustituido">{{ f.sustitucion }}</dd>
          </template>
          <template v-if="f.resultado">
            <dt>Resultado</dt>
            <dd class="resultado">{{ f.resultado }}</dd>
          </template>
          <template v-if="f.unidades">
            <dt>Unidades</dt>
            <dd class="unidades">{{ f.unidades }}</dd>
          </template>
        </dl>
        <p v-if="FUENTES[String(key)]" class="fuente">{{ FUENTES[String(key)] }}</p>
      </article>
    </div>

    <EstadoBloque :estado="estado" :motivo="motivo" />
  </section>
</template>

<script setup lang="ts">
import { ref, watch, onMounted, reactive, nextTick } from 'vue'
// KaTeX ya es dependencia del proyecto, asi que se importa como modulo. Antes
// se inyectaba un <script src="/vendor/katex/..."> que no existia: ninguna
// formula llegaba a renderizarse y las tarjetas salian vacias.
import katex from 'katex'
import 'katex/dist/katex.min.css'
import EstadoBloque from '../components/EstadoBloque.vue'

/** Variable exacta exigida */
const FORMULA_DENSIDAD = "J = \\rho g^2 Hm0^2 Te / (64\\pi)"

const props = defineProps<{
  formulas?: Record<string, { expresion?: string; sustitucion?: string; resultado?: string; valor?: number } | string | string[]>
  resultado?: unknown
  cargando?: boolean
}>()

const estado = ref<'reposo'|'cargando'|'vacio'|'resultado'|'pendiente'|'error'|'deshabilitado'|'desbordado'>('reposo')
const motivo = ref('')

const refs: Record<string, Element> = reactive({})

const formulas = ref<Record<string, { expresion?: string; sustitucion?: string; resultado?: string; unidades?: string }>>({})

// La procedencia de cada fórmula, en una línea bajo la tarjeta.
const FUENTES: Record<string, string> = {
  J: 'Handbook cap. 1 §3.2 · agua de mar 1.025 kg/m³ · g 9,81 m/s²',
  AEP: 'Handbook cap. 1 — producción anual equivalente',
}

// Las claves del cálculo son identificadores; en pantalla van con su nombre.
const TITULOS: Record<string, string> = {
  J: 'Densidad de potencia del oleaje',
  AEP: 'Producción anual',
  contexto: 'Condiciones del emplazamiento',
}

function tituloDe(clave: string): string {
  if (TITULOS[clave]) return TITULOS[clave]
  if (clave.startsWith('eslabon_')) return `Rendimiento — ${clave.slice('eslabon_'.length).replace(/_/g, ' ')}`
  return clave.replace(/_/g, ' ')
}

function normalizarFormulas(){
  const src = props.formulas as Record<string, unknown> | undefined
  if(!src){ formulas.value = {}; return }
  const out: Record<string, { expresion?: string; sustitucion?: string; resultado?: string; unidades?: string }> = {}
  for(const [k,v] of Object.entries(src)){
    if(typeof v === 'string') out[k] = { expresion: v }
    // app/formulas.py entrega Triple = (latex, texto, unidades), o sea un array.
    // Caia en la rama 'object' y quedaba sin `expresion` ni valores sustituidos.
    else if(Array.isArray(v)) out[k] = { expresion: String(v[0] ?? ''), sustitucion: String(v[1] ?? ''), unidades: String(v[2] ?? '') }
    else if(v && typeof v==='object') out[k] = v as Record<string,string>
  }
  formulas.value = out
  // Inyectar FORMULA_DENSIDAD si falta
  if(!out['J'] && !out['densidad_potencia']){
    out['J'] = { expresion: FORMULA_DENSIDAD, sustitucion: '', resultado: '' }
  }
}


// app/formulas.py ya entrega LaTeX válido: aquí se respeta tal cual.
//
// Antes esta función descartaba cualquier expresión que no contuviera
// \rho, \frac, ^{ o \pi y la sustituía por FORMULA_DENSIDAD. AEP
// (`AEP = P_{n} \cdot horas ...`) y el rendimiento de cada eslabón
// (`\eta = P_{out} / P_{in}`) no pasaban ese filtro, así que las cuatro
// tarjetas mostraban la fórmula de densidad.
function katexParaFormula(expr: string): string {
  return expr.trim() || FORMULA_DENSIDAD
}

function renderTodo(){
  const K = katex
  for(const [k, f] of Object.entries(formulas.value)){
    const el = refs[k]
    if(!el) continue
    const expr = f.expresion || FORMULA_DENSIDAD
    const tex = katexParaFormula(expr)
    try{ K.render(tex, el, { displayMode:true, throwOnError:false }) }catch{}
  }
}

onMounted(async ()=> {
  normalizarFormulas()
  if(props.cargando){ estado.value='cargando'; motivo.value='cargando fórmulas' }
  else if(!props.formulas || Object.keys(props.formulas).length===0){ estado.value='vacio' }
  else { estado.value='resultado' }
  await nextTick()
  renderTodo()
})

watch(()=> props.formulas, ()=> { normalizarFormulas(); renderTodo() }, { deep:true, flush:'post' })
watch(()=> props.cargando, (v)=> { estado.value = v ? 'cargando' : (Object.keys(formulas.value).length ? 'resultado' : 'vacio') })
// 'post': los `refs` del v-for no existen hasta que Vue ha pintado las
// tarjetas, asi que con el flush por defecto KaTeX no encontraba donde escribir
// y todas las formulas del contrato salian en blanco.
watch(formulas, renderTodo, { deep:true, flush:'post' })

// Exponer constante para validación
defineExpose({ FORMULA_DENSIDAD })
</script>

<style scoped>
/* Columna de lectura: la derivación se sigue de arriba abajo sin que la vista
   tenga que saltar de un lado a otro de la pantalla. */
.calcular{ max-width: 66ch; margin:0 auto; padding:12px; display:grid; gap: var(--s-4); align-content:start }

.titulo-nivel{
  font-size: var(--text-meta);
  letter-spacing:0.08em;
  text-transform:uppercase;
  color: var(--tenue);
}

.formulas{ display:grid; gap: var(--s-4) }

.formula-card{
  border:1px solid var(--borde-suave);
  border-radius: var(--radio-caja);
  padding: var(--s-2) var(--s-4);
  background: var(--panel);
  overflow:auto;
  border-block-start:3px solid var(--rol-mar-profundo);
  box-shadow: var(--sombra-caja);
}

.formula-card h2, .formula-card h3{
  font-size: var(--text-meta);
  letter-spacing:0.05em;
  text-transform:uppercase;
  color: var(--tenue);
  font-weight:600;
}

.katex-block{ min-block-size:2rem; overflow:auto; display:block; max-width:100%; padding-block: var(--s-1) }
.katex-block :deep(.katex){ font-size:1.05em }

/* Sustitución y resultado alineados en dos columnas: la etiqueta a la
   izquierda, el número siempre en el mismo eje. */
.derivacion{
  display:grid;
  grid-template-columns: minmax(5.5rem, auto) 1fr;
  gap: 2px var(--s-2);
  margin:0;
  font-size: var(--text-meta);
}

.derivacion dt{ color: var(--tenue); text-transform:uppercase; letter-spacing:0.05em }
.derivacion dd{ margin:0; font-family: var(--font-mono); font-size: var(--text-cuerpo); overflow-wrap:anywhere }
.derivacion dd.resultado{ font-weight:700 }
.derivacion dd.unidades{ font-family: var(--font-sans); color: var(--tenue) }

.fuente{ font-size: var(--text-meta); color: var(--tenue); margin:0 }
.calcular :focus-visible{ outline:2px solid var(--foco); outline-offset:2px; border-radius:4px }

/* Sin altura fija: todo desplaza en su propio contenedor; 320px sin truncar */
@media (max-width: 320px){
  .calcular{ max-width:100%; padding:8px }
  .katex-block{ font-size:0.95em }
  .derivacion{ grid-template-columns:1fr }
}
</style>
