import { createApp } from 'vue'
import './styles/tokens.css'
import './styles/fuentes.css'
import './styles/semaforo.css'
import './styles/app.css'
import './flujo/flujo.css'
import 'maplibre-gl/dist/maplibre-gl.css'
import Ver from './views/Ver.vue'
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

// La portada es la puerta de entrada: mar realista a pantalla completa, sin
// barra de pasos ni cadena de lectura. Al elegir familia se entra al flujo.
// Los pasos siguientes también van a pantalla completa: sin barra superior.
const PLANTILLA = `
  <div
    id="app"
    :class="claseModo"
    :data-sustentacion="sustentacion ? '' : null"
    style="--escala:1"
  >
    <main class="tablero flujo">
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
          :dispositivo="params.dispositivo"
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

          <!-- Mapa flotante: el estudiante cambia de punto sin salir de la escena. -->
          <aside class="mapa-flotante" :class="{ replegado: mapaReplegado }" aria-label="Emplazamiento">
            <div class="mapa-flotante-barra">
              <span class="mapa-flotante-titulo">Emplazamiento</span>
              <button
                type="button"
                class="mapa-flotante-toggle"
                :aria-expanded="mapaReplegado ? 'false' : 'true'"
                data-testid="alternar-mapa-mini"
                @click="mapaReplegado = !mapaReplegado"
              >
                <Icono :icono="mapaReplegado ? 'eslabon' : 'marca'" tamano="sm" />
                <span>{{ mapaReplegado ? 'Ver mapa' : 'Ocultar' }}</span>
              </button>
            </div>
            <div v-show="!mapaReplegado" class="mapa-flotante-caja">
              <MapaView
                compacto
                :sitio-activo="params.sitio_id"
                :dispositivo="params.dispositivo"
                @seleccionar-sitio="alSeleccionarSitioMapa"
                @ir-a-simulador="alSeleccionarSitioMapa" />
            </div>
          </aside>
        </div>
      </div>
    </main>

    <footer v-if="paso !== 1" class="lectura" role="status" aria-live="polite" data-testid="barra-kpis">
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
  components: { Ver, Portada, Tecnologia, OrigenDatos, MapaView, Icono, DialogoFuentes },
  data() {
    return {
      sustentacion: false,
      offline: false,
      mapaReplegado: false,
      paso: 1 as Paso,
      familia: 'undimotriz' as Familia,
      origen: 'lugar' as Origen,
      resultado: null as Record<string, any> | null,
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
    claseModo(): string {
      if (this.paso === 1) return 'modo-portada'
      if (this.paso === 2) return 'modo-tecnologia'
      if (this.paso === 3) return 'modo-origen'
      return 'modo-simulacion'
    },
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
