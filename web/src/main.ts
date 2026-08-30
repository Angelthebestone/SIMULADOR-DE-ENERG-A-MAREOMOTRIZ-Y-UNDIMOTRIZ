import { createApp } from 'vue'
import './styles/tokens.css'
import './styles/semaforo.css'
import 'maplibre-gl/dist/maplibre-gl.css'
import Ver from './views/Ver.vue'
import Comparar from './views/Comparar.vue'
import Calcular from './views/Calcular.vue'
import Disenar from './views/Disenar.vue'
import MapaView from './components/MapaView.vue'
import EstadoBloque from './components/EstadoBloque.vue'

const app = createApp({
  template: `
    <div id="app" :data-sustentacion="sustentacion ? '' : null" style="--escala:1">
      <nav class="tabs" role="tablist" aria-label="Niveles">
        <button v-for="(t,i) in tabs" :key="t.id" role="tab" :id="'tab-'+t.id" :aria-controls="'panel-'+t.id" :aria-selected="activa===t.id ? 'true':'false'" :tabindex="activa===t.id ? 0 : -1" @click="activa=t.id" @keydown="alTecla($event,i)" :ref="el=>{ if(el) tabRefs[i]=el }">{{ t.label }}</button>
        <button class="sust" @click="toggleSustentacion" :aria-pressed="sustentacion ? 'true':'false'" title="Modo sustentación (Ctrl+E, ESC para salir)">Sustentación {{ sustentacion ? '2.1×' : '1×' }}</button>
      </nav>
      <div class="offline" v-if="offline" role="status">sin conexión — operando con datos locales</div>
      <section :id="'panel-'+activa" role="tabpanel" :aria-labelledby="'tab-'+activa" tabindex="0">
        <Ver v-if="activa==='ver'" />
        <Comparar v-else-if="activa==='comparar'" :resultado="resultado" />
        <Calcular v-else-if="activa==='calcular'" :formulas="formulas" :cargando="cargando" />
        <Disenar v-else-if="activa==='disenar'" :figuras="figuras" :resultado="resultado" :panel-sitio="panelSitio" :sitio-id="sitioId" />
        <MapaView v-else-if="activa==='mapa'" />
      </section>
      <footer class="cita-footer" tabindex="0" :title="citaLarga">{{ citaCorta }}</footer>
    </div>
  `,
  components: { Ver, Comparar, Calcular, Disenar, MapaView, EstadoBloque },
  data() {
    return {
      activa: 'ver' as string,
      sustentacion: false,
      offline: false,
      resultado: null as unknown,
      formulas: null as unknown,
      figuras: null as unknown,
      panelSitio: null as unknown,
      sitioId: 'isla_fuerte' as string,
      cargando: false,
      tabs: [
        { id: 'ver', label: 'Ver' },
        { id: 'comparar', label: 'Comparar' },
        { id: 'calcular', label: 'Calcular' },
        { id: 'disenar', label: 'Diseñar' },
        { id: 'mapa', label: 'Mapa' },
      ] as Array<{id:string; label:string}>,
      tabRefs: [] as HTMLElement[],
      citaLarga: 'Ortega et al. 2013, Renewable Energy 57, 240-248 — Isla Fuerte 8,9 kW/m revisado por pares — Copernicus Marine GLOBAL_ANALYSISFORECAST_WAV_001_027 1/12° (~9 km), celda 9,42N -76,17W ~3,3 km, 2015-2024, datos/cmems/resumen_oleaje_cmems.json — ERA5-Ocean via Open-Meteo, rejilla 0,5° (celda 9,5N -76,0W ~23 km), 2015-2024, 87672 registros, datos/oleaje/resumen_oleaje_era5.json — GMRT Lamont-Doherty batimetría transecto radial — RUNAP 37 áreas marinas 305.335 km² — Superservicios ZNI/SIN — XM/API_XM',
    }
  },
  computed: {
    citaCorta(): string {
      const c = this.citaLarga as string
      return c.length > 180 ? c.slice(0, 180) + '…' : c
    }
  },
  methods: {
    toggleSustentacion() {
      this.sustentacion = !this.sustentacion
      const root = document.documentElement
      if (this.sustentacion) {
        root.setAttribute('data-sustentacion', '')
        // @ts-ignore
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
      if (e.key === 'ArrowRight') { e.preventDefault(); const j = (i + 1) % n; this.activa = this.tabs[j].id; this.$nextTick(()=> (this.tabRefs[j] as HTMLElement)?.focus()) }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); const j = (i - 1 + n) % n; this.activa = this.tabs[j].id; this.$nextTick(()=> (this.tabRefs[j] as HTMLElement)?.focus()) }
      else if (e.key === 'Home') { e.preventDefault(); this.activa = this.tabs[0].id; this.$nextTick(()=> (this.tabRefs[0] as HTMLElement)?.focus()) }
      else if (e.key === 'End') { e.preventDefault(); this.activa = this.tabs[n-1].id; this.$nextTick(()=> (this.tabRefs[n-1] as HTMLElement)?.focus()) }
    },
    onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        if (this.sustentacion) this.toggleSustentacion()
        // cancelar simulación si cargando lo marca el hijo vía evento global
        window.dispatchEvent(new CustomEvent('cancelar'))
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'e') {
        e.preventDefault()
        this.toggleSustentacion()
      }
    }
  },
  mounted() {
    this.offline = !navigator.onLine
    window.addEventListener('online', ()=> { this.offline = false })
    window.addEventListener('offline', ()=> { this.offline = true })
    window.addEventListener('keydown', this.onKey as EventListener)
    document.addEventListener('focusin', (e)=>{
      const t = e.target as HTMLElement
      if(t) t.style.outline = ''
    })
    // foco visible 2px --foco (tokens.css)
    const style = document.createElement('style')
    style.textContent = `* :focus-visible{ outline:2px solid var(--foco); outline-offset:2px; border-radius:4px } .tabs{ display:flex; gap:6px; padding:10px 12px; border-bottom:1px solid var(--borde-suave); overflow:auto; white-space:nowrap; background: var(--lienzo); } .tabs [role=tab]{ border:1px solid var(--borde); background: var(--panel); border-radius:6px; padding:6px 10px; font-weight:600; font-size:13px; cursor:pointer; } .tabs [role=tab][aria-selected=true]{ background:var(--tinta); color:var(--panel); border-color:var(--tinta); } .cita-footer{ font-size:var(--text-meta); color:var(--tenue); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; padding:6px 10px; border-top:1px solid var(--borde-suave); cursor:help; background: var(--acento-suave); } .cita-footer:focus{ white-space:normal; overflow:visible; text-overflow:clip } @media (max-width:320px){ .tabs{ flex-wrap:wrap } }`
    document.head.appendChild(style)
    // aplicar sustentación a map text-size y re-layout figuras vía evento
    window.addEventListener('sustentacion', (e: Event)=>{
      const escala = (e as CustomEvent).detail?.escala ?? 1
      // mapa: text-size
      document.documentElement.style.setProperty('--map-text-size', String(12 * escala))
    })
  },
  beforeUnmount() {
    window.removeEventListener('keydown', this.onKey as EventListener)
  }
})

app.mount('#app')
export {}
