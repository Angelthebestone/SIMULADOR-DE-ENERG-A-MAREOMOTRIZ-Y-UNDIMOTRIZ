import { createApp } from 'vue'
import './styles/tokens.css'
import './styles/fuentes.css'
import './styles/semaforo.css'
import './styles/app.css'
import 'maplibre-gl/dist/maplibre-gl.css'
import Ver from './views/Ver.vue'
import MapaView from './components/MapaView.vue'
import Icono from './components/Icono.vue'
import DialogoFuentes from './components/DialogoFuentes.vue'
import type { SitioMapa } from './map/mapa'
import { simular, cancelar, type Params } from './api'
import { formatearNumero } from './utils/formato'

const CITA = `SIMULADOR DE ENERGÍA MARINA — RECURSO, CAPTURA Y COSTES
Ortega et al. (2013) · 8,9 kW/m en Isla Fuerte frente a 40 kW/m de umbral de granja (Osorio et al. 2016 / Handbook cap. 1)
ERA5-Ocean vía Open-Meteo Marine · GMRT Lamont-Doherty · RUNAP · XM
Natural Earth para el contorno de tierra. Repositorio público con datos reproducibles.`

const PLANTILLA = `
  <div id="app" :data-sustentacion="sustentacion ? '' : null" style="--escala:1">
    <!-- Tablero: emplazamiento a la izquierda, escena a la derecha. Los dos
         siempre a la vista, ninguno se desmonta ni se reduce a miniatura.
         Sin barra superior: el título vive en la pestaña y las dos acciones
         bajan al pie, ganando una franja completa para el tablero. -->
    <main class="tablero">
      <section class="columna" aria-label="Emplazamiento">
        <MapaView
          :sitio-activo="params.sitio_id"
          @seleccionar-sitio="alSeleccionarSitioMapa"
          @ir-a-simulador="alIrASimulador" />
      </section>

      <section class="columna" aria-label="Simulador">
        <Ver
          ref="ver"
          :params="params" :resultado="resultado" :viviendas="viviendas" :cargando="cargando" :error="error"
          @update:params="aplicarParams" />
      </section>
    </main>

    <!-- Cadena de lectura: las cuatro cifras encadenadas, siempre a la vista. -->
    <footer class="lectura" role="status" aria-live="polite" data-testid="barra-kpis">
      <div class="cadena">
        <template v-for="(k, i) in kpis" :key="k.id">
          <Icono v-if="i > 0" icono="eslabon" tamano="sm" class="eslabon" />
          <div class="kpi" :data-testid="'kpi-'+k.id" :data-estado="k.pendiente ? 'pendiente' : 'ok'">
            <span class="kpi-etiqueta">{{ k.etiqueta }}</span>
            <span v-if="cargando" class="kpi-esqueleto" aria-hidden="true"></span>
            <span v-else-if="k.pendiente" class="kpi-pendiente semaforo semaforo--pendiente">
              <Icono icono="pendiente" tamano="sm" />
              <span>pendiente</span>
            </span>
            <span v-else class="kpi-valor">{{ k.valor }} <small class="kpi-unidad">{{ k.unidad }}</small></span>
          </div>
        </template>
      </div>

      <p v-if="error" class="aviso aviso--error" data-testid="aviso-error">
        <Icono icono="error" tamano="sm" />
        <span>{{ error }}</span>
      </p>
      <p v-else-if="offline" class="aviso" data-testid="aviso-offline">
        <Icono icono="offline" tamano="sm" />
        <span>sin conexión — datos locales</span>
      </p>

      <div class="acciones-barra">
        <button class="btn-barra" data-testid="abrir-fuentes" @click="abrirFuentes">
          <Icono icono="fuentes" />
          <span>Fuentes</span>
        </button>
        <button class="btn-barra" data-testid="sustentacion" @click="toggleSustentacion" :aria-pressed="sustentacion ? 'true':'false'" title="Modo presentación (Ctrl+E, ESC para salir)">
          <Icono icono="proyector" />
          <span>{{ sustentacion ? 'Proyectando 2,1×' : 'Proyectar' }}</span>
        </button>
      </div>
    </footer>

    <DialogoFuentes ref="dialogoFuentes" :cita="citaLarga" />
  </div>
`

const app = createApp({
  template: PLANTILLA,
  components: { Ver, MapaView, Icono, DialogoFuentes },
  data() {
    return {
      sustentacion: false,
      offline: false,
      resultado: null as Record<string, any> | null,
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
        eta_pto: 0.65,
        eta_gen: 0.90,
        crf: 0.08,
        rho: 1025,
      } as Params,
      citaLarga: CITA,
      temporizador: 0 as unknown as ReturnType<typeof setTimeout>,
    }
  },
  computed: {
    kpis(): Array<{ id: string; etiqueta: string; valor: string; unidad: string; pendiente: boolean }> {
      const r = this.resultado
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
        celda('recurso', 'Recurso', kwm, 'kW/m', 1),
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
    alSeleccionarSitioMapa(s: SitioMapa) {
      const cambios: Partial<Params> = { sitio_id: s.id }
      if (s.hm0_m) cambios.hm0_m = s.hm0_m
      if (s.te_s) cambios.te_s = s.te_s
      if (s.profundidad_m) cambios.profundidad_m = s.profundidad_m
      if (s.tipo === 'mareomotriz') cambios.dispositivo = 'turbina_corriente'
      else if (s.tipo === 'undimotriz') cambios.dispositivo = 'absorbedor_puntual'
      this.aplicarParams(cambios)
    },
    // Con las dos columnas siempre visibles, «simular» ya no cambia de
    // pantalla: lleva el foco a la escena para que la mirada siga a la acción.
    alIrASimulador(s: SitioMapa) {
      this.alSeleccionarSitioMapa(s)
      ;(this.$refs.ver as { enfocar?: () => void } | undefined)?.enfocar?.()
    },
    async ejecutar() {
      this.cargando = true
      this.error = ''
      try {
        const respuesta = (await simular({ ...this.params })) as Record<string, any>
        if (respuesta?.error) this.error = String(respuesta.error)
        this.resultado = respuesta?.resultado ?? null
        const v = respuesta?.extras?.viviendas
        this.viviendas = typeof v === 'number' ? v : (v?.viviendas ?? null)
      } catch (e) {
        this.error = e instanceof Error ? e.message : 'no se pudo calcular'
      } finally {
        this.cargando = false
      }
    },
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
    onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
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
