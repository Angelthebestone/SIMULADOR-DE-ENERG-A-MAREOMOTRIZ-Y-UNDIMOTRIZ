import { createApp } from 'vue'
import './styles/tokens.css'
import './styles/semaforo.css'
import './styles/app.css'
import 'maplibre-gl/dist/maplibre-gl.css'
import Ver from './views/Ver.vue'
import Comparar from './views/Comparar.vue'
import Calcular from './views/Calcular.vue'
import Disenar from './views/Disenar.vue'
import MapaView from './components/MapaView.vue'
import EstadoBloque from './components/EstadoBloque.vue'
import Icono from './components/Icono.vue'
import DialogoFuentes from './components/DialogoFuentes.vue'
import { simular, cancelar, type Params } from './api'
import { formatearNumero } from './utils/formato'

// Cita completa de las series. No se pinta en ninguna pantalla: vive en el
// diálogo Fuentes, que es el único sitio de la interfaz donde caben citas.
const CITA = 'Ortega et al. 2013, Renewable Energy 57, 240-248 — Isla Fuerte 8,9 kW/m revisado por pares — Copernicus Marine GLOBAL_ANALYSISFORECAST_WAV_001_027 1/12° (~9 km), celda 9,42N -76,17W ~3,3 km, 2015-2024, datos/cmems/resumen_oleaje_cmems.json — ERA5-Ocean via Open-Meteo, rejilla 0,5° (celda 9,5N -76,0W ~23 km), 2015-2024, 87672 registros, datos/oleaje/resumen_oleaje_era5.json — GMRT Lamont-Doherty batimetría transecto radial — RUNAP 37 áreas marinas 305.335 km² — Superservicios ZNI/SIN — XM/API_XM'

const SITIOS = [
  { id: 'isla_fuerte', nombre: 'Isla Fuerte' },
  { id: 'san_andres', nombre: 'San Andrés' },
  { id: 'tumaco', nombre: 'Tumaco' },
  { id: 'islas_rosario', nombre: 'Islas del Rosario' },
]

const DISPOSITIVOS = [
  { id: 'absorbedor_puntual', nombre: 'Absorbedor puntual (boya)' },
  { id: 'owc', nombre: 'Columna de agua oscilante' },
  { id: 'turbina_corriente', nombre: 'Turbina de corriente mareal' },
  { id: 'embalse', nombre: 'Presa de rango mareal' },
]

const PLANTILLA = `
  <div id="app" :data-sustentacion="sustentacion ? '' : null" style="--escala:1">
    <header class="barra">
      <div class="marca">
        <strong>Simulador de energía marina</strong>
        <span class="marca-sub">recurso → dispositivo → coste</span>
      </div>
      <div class="escenario">
        <label class="campo">
          <span>Emplazamiento</span>
          <select v-model="params.sitio_id">
            <option v-for="s in sitios" :key="s.id" :value="s.id">{{ s.nombre }}</option>
          </select>
        </label>
        <label class="campo">
          <span>Dispositivo</span>
          <select v-model="params.dispositivo">
            <option v-for="d in dispositivos" :key="d.id" :value="d.id">{{ d.nombre }}</option>
          </select>
        </label>
        <div class="acciones-barra">
          <button class="btn-barra" data-testid="abrir-fuentes" @click="abrirFuentes">
            <Icono icono="fuentes" />
            <span>Fuentes</span>
          </button>
          <button class="btn-barra" data-testid="sustentacion" @click="toggleSustentacion" :aria-pressed="sustentacion ? 'true':'false'" title="Modo sustentación (Ctrl+E, ESC para salir)">
            <Icono icono="proyector" />
            <span>{{ sustentacion ? '2,1×' : '1×' }}</span>
          </button>
        </div>
      </div>
    </header>

    <nav class="tabs" role="tablist" aria-label="Niveles">
      <button v-for="(t,i) in tabs" :key="t.id" role="tab" :id="'tab-'+t.id" :aria-controls="'panel-'+t.id" :aria-selected="activa===t.id ? 'true':'false'" :tabindex="activa===t.id ? 0 : -1" @click="alClickTab(t.id)" @keydown="alTecla($event,i)" :ref="el=>{ if(el) tabRefs[i]=el }">
        <Icono :icono="t.id" />
        <span class="tab-label">{{ t.label }}</span>
      </button>
    </nav>

    <div class="kpis" role="status" aria-live="polite" data-testid="barra-kpis">
      <div v-for="k in kpis" :key="k.id" class="kpi" :data-testid="'kpi-'+k.id" :data-estado="k.pendiente ? 'pendiente' : 'ok'">
        <span class="kpi-etiqueta">{{ k.etiqueta }}</span>
        <span v-if="cargando" class="kpi-esqueleto" aria-hidden="true"></span>
        <span v-else-if="k.pendiente" class="kpi-pendiente semaforo semaforo--pendiente">
          <Icono icono="pendiente" tamano="sm" />
          <span>pendiente</span>
        </span>
        <span v-else class="kpi-valor">{{ k.valor }} <small class="kpi-unidad">{{ k.unidad }}</small></span>
      </div>

      <p v-if="error" class="aviso aviso--error" data-testid="aviso-error">
        <Icono icono="error" tamano="sm" />
        <span>{{ error }}</span>
      </p>
      <p v-else-if="offline" class="aviso" data-testid="aviso-offline">
        <Icono icono="offline" tamano="sm" />
        <span>sin conexión — datos locales</span>
      </p>
    </div>

    <section :id="'panel-'+activa" role="tabpanel" :aria-labelledby="'tab-'+activa" tabindex="0" @keydown="alTeclaPanel">
      <Ver v-if="activa==='ver'"
        :params="params" :resultado="resultado" :viviendas="viviendas" :cargando="cargando" :error="error"
        @update:params="aplicarParams" />
      <Comparar v-else-if="activa==='comparar'" :resultado="resultado" />
      <Calcular v-else-if="activa==='calcular'" :formulas="formulas" :resultado="resultado" :cargando="cargando" />
      <Disenar v-else-if="activa==='disenar'" :figuras="figuras" :resultado="resultado" :panel-sitio="panelSitio" :sitio-id="params.sitio_id" />
      <MapaView v-else-if="activa==='mapa'" />
    </section>

    <DialogoFuentes ref="dialogoFuentes" :cita="citaLarga" />
  </div>
`

const app = createApp({
  template: PLANTILLA,
  components: { Ver, Comparar, Calcular, Disenar, MapaView, EstadoBloque, Icono, DialogoFuentes },
  data() {
    return {
      activa: 'ver' as string,
      sustentacion: false,
      offline: false,
      resultado: null as Record<string, any> | null,
      formulas: null as unknown,
      figuras: null as unknown,
      panelSitio: null as unknown,
      viviendas: null as number | null,
      error: '' as string,
      cargando: false,
      params: {
        hm0_m: 1.5,
        te_s: 7.0,
        b_pto_ns_m: 80_000,
        profundidad_m: 30,
        sitio_id: 'isla_fuerte',
        dispositivo: 'absorbedor_puntual',
      } as Params,
      sitios: SITIOS,
      dispositivos: DISPOSITIVOS,
      tabs: [
        { id: 'ver', label: 'Ver' },
        { id: 'comparar', label: 'Comparar' },
        { id: 'calcular', label: 'Calcular' },
        { id: 'disenar', label: 'Diseñar' },
        { id: 'mapa', label: 'Mapa' },
      ] as Array<{id:string; label:string}>,
      tabRefs: [] as HTMLElement[],
      citaLarga: CITA,
      temporizador: 0 as unknown as ReturnType<typeof setTimeout>,
    }
  },
  computed: {
    // Indicadores de cabecera: salen del cálculo, no se derivan aquí. Sin dato
    // el indicador queda `pendiente` y no aparece cifra alguna en su lugar.
    kpis(): Array<{ id: string; etiqueta: string; valor: string; unidad: string; pendiente: boolean }> {
      const r = this.resultado
      // app/servicio.py::_j_kw_m lee la densidad del primer eslabón, no de `recurso`.
      const kwm = Number(r?.eslabones?.[0]?.detalle?.j_w_m ?? NaN) / 1000
      const w = Number(r?.potencia_nominal_w ?? NaN)
      const mwh = Number(r?.produccion_anual_mwh ?? NaN)
      const fp = Number(r?.factor_planta ?? NaN)
      const celda = (id: string, etiqueta: string, v: number, unidad: string, dec: number) => ({
        id,
        etiqueta,
        unidad,
        pendiente: !Number.isFinite(v),
        valor: Number.isFinite(v) ? formatearNumero(v, dec) : '',
      })
      return [
        celda('recurso', 'Recurso del oleaje', kwm, 'kW/m', 2),
        celda('potencia', 'Potencia captada', w / 1000, 'kW', 1),
        celda('anual', 'Producción anual', mwh, 'MWh/año', 1),
        celda('factor', 'Factor de planta', fp * 100, '%', 1),
      ]
    },
  },
  methods: {
    aplicarParams(cambios: Partial<Params>) {
      Object.assign(this.params, cambios)
    },
    abrirFuentes() {
      ;(this.$refs.dialogoFuentes as { abrir: () => void } | undefined)?.abrir()
    },
    /** Un solo cálculo alimenta los cuatro niveles (design.md). */
    async ejecutar() {
      this.cargando = true
      this.error = ''
      try {
        const contrato = (await simular({ ...this.params })) as Record<string, any>
        if (contrato?.error) this.error = String(contrato.error)
        this.resultado = contrato?.resultado ?? null
        this.formulas = contrato?.formulas ?? null
        this.figuras = contrato?.figuras ?? null
        this.panelSitio = contrato?.extras?.panel_sitio ?? contrato?.panel_sitio ?? null
        const v = contrato?.extras?.viviendas
        this.viviendas = typeof v === 'number' ? v : (v?.viviendas ?? null)
      } catch (e) {
        // Un fallo de transporte se dice. Antes se tragaba en un catch vacío y
        // la pantalla se quedaba en blanco sin explicar por qué.
        this.error = e instanceof Error ? e.message : 'no se pudo calcular'
      } finally {
        this.cargando = false
      }
    },
    /** Los sliders emiten en cada píxel; se agrupan para no encolar cálculos. */
    programar() {
      clearTimeout(this.temporizador)
      this.temporizador = setTimeout(() => this.ejecutar(), 120)
    },
    toggleSustentacion() {
      this.sustentacion = !this.sustentacion
      const root = document.documentElement
      if (this.sustentacion) {
        root.setAttribute('data-sustentacion', '')
        root.style.setProperty('--escala', '2.1')
        root.style.fontSize = 'calc(16px * 2.1)'
        window.dispatchEvent(new CustomEvent('sustentacion', { detail: { escala: 2.1 } }))
      } else {
        root.removeAttribute('data-sustentacion')
        root.style.setProperty('--escala', '1')
        root.style.fontSize = ''
        window.dispatchEvent(new CustomEvent('sustentacion', { detail: { escala: 1 } }))
      }
    },
    alTecla(e: KeyboardEvent, i: number) {
      const n = this.tabs.length
      if (e.key === 'ArrowRight') { e.preventDefault(); const j = (i + 1) % n; this.activa = this.tabs[j].id; this.$nextTick(()=> this.enfocarEncabezado()) }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); const j = (i - 1 + n) % n; this.activa = this.tabs[j].id; this.$nextTick(()=> this.enfocarEncabezado()) }
      else if (e.key === 'Home') { e.preventDefault(); this.activa = this.tabs[0].id; this.$nextTick(()=> this.enfocarEncabezado()) }
      else if (e.key === 'End') { e.preventDefault(); this.activa = this.tabs[n-1].id; this.$nextTick(()=> this.enfocarEncabezado()) }
    },
    /** El foco vive en el encabezado del panel tras conmutar; las flechas
     *  tienen que seguir recorriendo los niveles desde ahí. Sólo cuando el
     *  foco está en el encabezado: dentro del panel las flechas son de los
     *  controles (deslizadores, listas), no de las pestañas. */
    alTeclaPanel(e: KeyboardEvent) {
      const destino = e.target as HTMLElement | null
      if (!destino || destino.id !== 'titulo-' + this.activa) return
      const i = this.tabs.findIndex(t => t.id === this.activa)
      if (i >= 0) this.alTecla(e, i)
    },
    alClickTab(id: string) {
      this.activa = id
      // Tras click el foco se queda en el botón, que es lo esperado con ratón.
    },
    enfocarEncabezado() {
      // WAI-ARIA tabs: el foco pasa al contenido del nuevo tabpanel.
      const panel = document.getElementById('panel-' + this.activa)
      const heading = panel?.querySelector('h1, h2, [role="heading"]') as HTMLElement | null
      if (heading) {
        if (!heading.hasAttribute('tabindex')) heading.setAttribute('tabindex', '-1')
        heading.focus({ preventScroll: false })
      }
    },
    onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        // Con un diálogo abierto, ESC es suyo: lo cierra el <dialog> nativo y
        // aquí no se cancela nada ni se conmuta la sustentación.
        if (document.querySelector('dialog[open]')) return
        if (this.sustentacion) this.toggleSustentacion()
        cancelar()
        window.dispatchEvent(new CustomEvent('cancelar'))
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'e') {
        e.preventDefault()
        this.toggleSustentacion()
      }
    }
  },
  watch: {
    params: { handler() { this.programar() }, deep: true },
  },
  mounted() {
    this.offline = !navigator.onLine
    window.addEventListener('online', ()=> { this.offline = false })
    window.addEventListener('offline', ()=> { this.offline = true })
    window.addEventListener('keydown', this.onKey as EventListener)
    window.addEventListener('sustentacion', (e: Event)=>{
      const escala = (e as CustomEvent).detail?.escala ?? 1
      document.documentElement.style.setProperty('--map-text-size', String(12 * escala))
    })
    this.ejecutar()
  },
  beforeUnmount() {
    clearTimeout(this.temporizador)
    window.removeEventListener('keydown', this.onKey as EventListener)
  }
})

app.mount('#app')
export {}
