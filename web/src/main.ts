import { createApp } from 'vue'
import './styles/tokens.css'
import './styles/fuentes.css'
import './styles/semaforo.css'
import './styles/app.css'
import './flujo/flujo.css'
import 'maplibre-gl/dist/maplibre-gl.css'
import Ver from './views/Ver.vue'
import Calcular from './views/Calcular.vue'
import Comparar from './views/Comparar.vue'
import Disenar from './views/Disenar.vue'
import Portada from './views/Portada.vue'
import Tecnologia from './views/Tecnologia.vue'
import OrigenDatos from './views/OrigenDatos.vue'
import MapaView from './components/MapaView.vue'
import Icono from './components/Icono.vue'
import DialogoFuentes from './components/DialogoFuentes.vue'
import type { SitioMapa } from './map/mapa'
import { simular, cancelar, type Params } from './api'
import { formatearNumero } from './utils/formato'
import {
  PASOS,
  PARAMS_INICIALES,
  dispositivoPorDefecto,
  familiaDeDispositivo,
  type Familia,
  type Origen,
  type Paso,
} from './flujo/estado'

const CITA = `SIMULADOR DE ENERGÍA MARINA — RECURSO, CAPTURA Y COSTES
Ortega et al. (2013) · 8,9 kW/m en Isla Fuerte frente a 40 kW/m de umbral de granja (Osorio et al. 2016 / Handbook cap. 1)
ERA5-Ocean vía Open-Meteo Marine · GMRT Lamont-Doherty · RUNAP · XM
Natural Earth para el contorno de tierra. Repositorio público con datos reproducibles.`

// Decisión de arranque (lote a): la app arranca en el paso 4 con los valores
// de siempre (isla_fuerte / absorbedor_puntual) para que la escena, la carta
// y la barra de cifras estén montadas al cargar. La portada queda a un toque
// en la ruta de pasos, no como bloqueo inicial.
const PLANTILLA = `
  <div id="app" :data-sustentacion="sustentacion ? '' : null" style="--escala:1">
    <main class="tablero flujo">
      <header class="flujo-cabecera" aria-label="Ruta del recorrido">
        <ol class="flujo-lista">
          <li v-for="(p, i) in pasos" :key="p.id" class="flujo-paso-item">
            <button
              type="button"
              class="flujo-paso"
              :data-testid="'paso-' + p.id"
              :aria-current="paso === p.id ? 'step' : undefined"
              @click="irA(p.id)"
            >
              <span class="flujo-num" aria-hidden="true">{{ p.id }}</span>
              <span>{{ p.nombre }}</span>
            </button>
            <span v-if="i < pasos.length - 1" class="flujo-separador" aria-hidden="true">›</span>
          </li>
        </ol>
      </header>

      <div class="etapa">
        <Portada v-if="paso === 1" @elegir-familia="alElegirFamilia" />

        <Tecnologia
          v-else-if="paso === 2"
          :familia="familia"
          :dispositivo="params.dispositivo"
          @elegir-tecnologia="alElegirTecnologia"
          @continuar="irA(3)"
          @volver="irA(1)"
        />

        <OrigenDatos
          v-else-if="paso === 3"
          :origen="origen"
          :params="params"
          :sitio-id="params.sitio_id"
          :sitio-nombre="nombreSitio"
          :sitio-fuente="fuenteSitio"
          @elegir-origen="alElegirOrigen"
          @update:params="aplicarParams"
          @seleccionar-sitio="alSeleccionarSitioMapa"
          @ir-a-simulador="alIrASimulador"
          @continuar="irA(4)"
          @volver="irA(2)"
        />

        <div v-else class="panel-simulacion">
          <Ver
            ref="ver"
            :params="params" :resultado="resultado" :viviendas="viviendas" :cargando="cargando" :error="error"
            @update:params="aplicarParams" />

          <p v-if="origen === 'personalizado'" class="nota-hipotetico" data-testid="nota-hipotetico">
            Resultado hipotético: estos números se escribieron a mano y no pertenecen a ningún punto del mapa.
          </p>

          <div class="bloque-mapa">
            <h2>Emplazamiento</h2>
            <div class="mapa-caja">
              <MapaView
                :sitio-activo="params.sitio_id"
                @seleccionar-sitio="alSeleccionarSitioMapa"
                @ir-a-simulador="alIrASimulador" />
            </div>
          </div>

          <nav class="subvistas" aria-label="Lecturas de la simulación">
            <button
              v-for="s in subvistas"
              :key="s.id"
              type="button"
              class="subvista-btn"
              :data-testid="'subvista-' + s.id"
              :aria-selected="subvista === s.id ? 'true' : 'false'"
              @click="subvista = s.id"
            >
              <span>{{ s.nombre }}</span>
            </button>
          </nav>

          <Calcular v-if="subvista === 'calcular'" :formulas="formulas" :resultado="resultado" :cargando="cargando" />
          <Comparar v-else-if="subvista === 'comparar'" :resultado="resultado" :cargando="cargando" />
          <Disenar
            v-else-if="subvista === 'disenar'"
            :figuras="figuras"
            :resultado="resultado"
            :panel-sitio="panelSitio"
            :sitio-id="params.sitio_id"
            :params="params"
            @update:params="aplicarParams"
          />
        </div>
      </div>
    </main>

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
  components: { Ver, Calcular, Comparar, Disenar, Portada, Tecnologia, OrigenDatos, MapaView, Icono, DialogoFuentes },
  data() {
    return {
      sustentacion: false,
      offline: false,
      paso: 4 as Paso,
      familia: 'undimotriz' as Familia,
      origen: 'lugar' as Origen,
      subvista: 'calcular' as 'calcular' | 'comparar' | 'disenar',
      pasos: PASOS,
      subvistas: [
        { id: 'calcular' as const, nombre: 'Calcular' },
        { id: 'comparar' as const, nombre: 'Comparar' },
        { id: 'disenar' as const, nombre: 'Diseñar' },
      ],
      resultado: null as Record<string, any> | null,
      formulas: {} as Record<string, unknown>,
      figuras: null as Record<string, unknown> | null,
      panelSitio: null as Record<string, unknown> | null,
      viviendas: null as number | null,
      error: '' as string,
      cargando: false,
      nombreSitio: 'Isla Fuerte, Caribe colombiano',
      fuenteSitio: 'Ortega et al. 2013 · periodo 2015-2024',
      params: { ...PARAMS_INICIALES } as Params,
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
    irA(p: Paso) {
      this.paso = p
    },
    alElegirFamilia(f: Familia) {
      this.familia = f
      this.aplicarParams({ dispositivo: dispositivoPorDefecto(f) })
      this.paso = 2
    },
    alElegirTecnologia(id: string) {
      this.familia = familiaDeDispositivo(id)
      this.aplicarParams({ dispositivo: id })
    },
    alElegirOrigen(o: Origen) {
      this.origen = o
    },
    aplicarParams(cambios: Partial<Params>) {
      Object.assign(this.params, cambios)
      if (cambios.dispositivo) this.familia = familiaDeDispositivo(cambios.dispositivo)
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
      this.origen = 'lugar'
      this.nombreSitio = s.nombre || this.nombreSitio
      this.fuenteSitio = s.fuente ? `${s.fuente} · periodo 2015-2024` : this.fuenteSitio
      this.aplicarParams(cambios)
    },
    alIrASimulador(s: SitioMapa) {
      this.alSeleccionarSitioMapa(s)
      this.paso = 4
      ;(this.$refs.ver as { enfocar?: () => void } | undefined)?.enfocar?.()
    },
    async ejecutar() {
      this.cargando = true
      this.error = ''
      try {
        const respuesta = (await simular({ ...this.params })) as Record<string, any>
        if (respuesta?.error) this.error = String(respuesta.error)
        this.resultado = respuesta?.resultado ?? null
        const f = respuesta?.formulas
        this.formulas = f && typeof f === 'object' ? (f as Record<string, unknown>) : {}
        const figs = respuesta?.figuras ?? respuesta?.resultado?.figuras ?? null
        this.figuras = figs && typeof figs === 'object' ? (figs as Record<string, unknown>) : null
        const panel = respuesta?.extras?.panel_sitio ?? null
        this.panelSitio = panel && typeof panel === 'object' ? (panel as Record<string, unknown>) : null
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
