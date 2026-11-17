<template>
  <section class="ver" aria-label="Simulador de captura" ref="raiz" tabindex="-1" :data-motor="motorActivo">
    <!-- Escena: el corte del mar ocupa el ancho de la columna; encima sólo el
         rótulo del emplazamiento y el control de pausa. -->
    <div class="escena">
      <canvas
        ref="canvasRef"
        class="oleaje"
        width="1200"
        height="600"
        aria-label="Corte del mar con el dispositivo, el oleaje y la salida a la red"
      ></canvas>

      <div ref="contenedor3D" class="lienzo-3d" aria-label="Escena tridimensional del dispositivo"></div>

      <div class="escena-modo" role="group" aria-label="Vista de la escena">
        <button
          v-for="m in VISTAS"
          :key="m.id"
          type="button"
          class="btn-vista"
          :class="{ activo: motorActivo === m.id }"
          :aria-pressed="motorActivo === m.id ? 'true' : 'false'"
          :data-testid="'vista-' + m.etiqueta"
          @click="elegirVista(m.id)"
        >{{ m.etiqueta }}</button>
      </div>

      <div class="escena-acciones">
        <p v-if="sinSerie" class="aviso-sin-serie">
          <Icono icono="pendiente" tamano="sm" />
          <span>{{ sinSerie }}</span>
        </p>
        <button class="btn-lienzo" @click="togglePausa" :aria-pressed="pausado ? 'true' : 'false'">
          <Icono :icono="pausado ? 'reproducir' : 'pausar'" tamano="sm" />
          <span>{{ pausado ? "Reanudar" : "Pausar" }}</span>
        </button>
      </div>
    </div>

    <!-- Cabina: qué se simula y con qué números. Las cifras de salida viven
         en el panel de resultados, a la derecha. -->
    <div class="cabina">
      <div class="bloque bloque--recurso">
        <div class="modos" role="group" aria-label="Tipo de recurso">
          <button
            v-for="m in MODOS"
            :key="m.id"
            type="button"
            class="btn-modo"
            :class="{ activo: modoActivo === m.id }"
            :aria-pressed="modoActivo === m.id ? 'true' : 'false'"
            @click="seleccionarModo(m.id)"
          >
            <Icono :icono="m.id" tamano="sm" />
            <span>{{ m.label }}</span>
          </button>
        </div>

        <div class="dispositivos">
          <span class="rotulo-grupo">Dispositivo</span>
          <div class="dispositivos-lista">
            <button
              v-for="d in dispositivosDelModo"
              :key="d.id"
              type="button"
              class="btn-dispositivo"
              :class="{ activo: params.dispositivo === d.id }"
              :aria-pressed="params.dispositivo === d.id ? 'true' : 'false'"
              @click="seleccionarDispositivo(d.id)"
            >
              {{ d.nombre }}
            </button>
          </div>

          <label v-if="params.dispositivo === 'turbina_corriente'" class="campo-cimentacion">
            <span class="rotulo-grupo">Cimentación</span>
            <select v-model="cimentacionSeleccionada" @change="redibujar">
              <option value="pilote">Pilote clavado</option>
              <option value="gravedad">Bloque de gravedad</option>
              <option value="tripode">Trípode</option>
            </select>
          </label>
        </div>
      </div>

      <div class="bloque bloque--controles">
        <ControlesFisicos
          :hm0_m="params.hm0_m"
          :te_s="params.te_s"
          :b_pto_ns_m="params.b_pto_ns_m"
          :modo-energia="modoActivo"
          :dispositivo="params.dispositivo"
          :velocidad-corriente="velocidadCorriente"
          :rango-marea="rangoMarea"
          :profundidad_m="params.profundidad_m || 30"
          @update:hm0_m="v => emit('update:params', { hm0_m: v })"
          @update:te_s="v => emit('update:params', { te_s: v })"
          @update:b_pto_ns_m="v => emit('update:params', { b_pto_ns_m: v })"
          @update:velocidad-corriente="alCambiarVelCorriente"
          @update:rango-marea="alCambiarRangoMarea"
          @update:profundidad_m="v => emit('update:params', { profundidad_m: v })"
        />
      </div>

      <div class="bloque bloque--anotaciones">
        <span class="rotulo-grupo">Qué es cada cosa</span>
        <ul class="anotaciones-lista">
          <template v-if="modoActivo === 'undimotriz'">
            <li><Anotacion elemento="boya" /></li>
            <li><Anotacion elemento="ola_hm0" termino="Hm0" intuicion="J" /></li>
            <li><Anotacion elemento="periodo_te" termino="Te" /></li>
            <li><Anotacion elemento="freno_pto" termino="B_pto" intuicion="freno" /></li>
          </template>
          <li v-else-if="params.dispositivo === 'embalse'"><Anotacion elemento="rango_marea" termino="R_marea" /></li>
          <li v-else><Anotacion elemento="corriente" termino="V_marea" /></li>
          <li><Anotacion elemento="energia" termino="J" intuicion="J" /></li>
          <li><Anotacion elemento="fondo" termino="h_fondo" /></li>
        </ul>
        <EstadoBloque
          v-if="modoActivo === 'undimotriz'"
          :estado="estadoValidez"
          :motivo="motivoValidez"
        />
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { onMounted, onBeforeUnmount, ref, watch, computed } from "vue";
import { AnimacionCanvas, PROFUNDIDAD_M, type TipoCimentacion } from "../components/AnimacionCanvas";
import { Animacion3D } from "../components/Animacion3D";
import Anotacion from "../components/Anotacion.vue";
import ControlesFisicos from "../components/ControlesFisicos.vue";
import EstadoBloque from "../components/EstadoBloque.vue";
import Icono from "../components/Icono.vue";
import { evaluarValidezOleaje } from "../utils/validacion";
import type { Params } from "../api";

const props = defineProps<{
  params: Params;
  resultado: Record<string, any> | null;
  viviendas: number | null;
  cargando?: boolean;
  error?: string;
}>();

const emit = defineEmits<{ (e: "update:params", v: Partial<Params>): void }>();

const raiz = ref<HTMLElement | null>(null);
const canvasRef = ref<HTMLCanvasElement | null>(null);
const contenedor3D = ref<HTMLElement | null>(null);
let animacion: AnimacionCanvas | null = null;
let motor3d: Animacion3D | null = null;
const sinSerie = ref("");
const pausado = ref(false);

/** Motor pedido por el usuario (Auto = 3D con respaldo 2D) y motor activo
 *  real: la escena 3D solo se enciende si WebGL aguanta; si no, el 2D
 *  intacto toma el relevo sin perder la simulación. */
const motorPedido = ref<"auto" | "motor-3d" | "motor-2d">("auto");
const motorActivo = ref<"motor-3d" | "motor-2d">("motor-2d");
const fpsMedio = ref(0);
const marcasFps: number[] = [];
let fpsBajoDesde: number | null = null;
let calidadDegradada = false;

function soportaWebGL(): boolean {
  try {
    const c = document.createElement("canvas");
    return !!(c.getContext("webgl2") || c.getContext("webgl"));
  } catch {
    return false;
  }
}

/** Auto solo sube a 3D con GPU real: un rasterizador por software
 *  (SwiftShader, llvmpipe, Mesa) da WebGL válido pero pocos fps. */
function aceleracionPorHardware(): boolean {
  try {
    const c = document.createElement("canvas");
    const gl = (c.getContext("webgl2") || c.getContext("webgl")) as WebGLRenderingContext | null;
    if (!gl) return false;
    const info = gl.getExtension("WEBGL_debug_renderer_info");
    if (!info) return true;
    const nombre = String(gl.getParameter(info.UNMASKED_RENDERER_WEBGL) || "").toLowerCase();
    return !/swiftshader|llvmpipe|softpipe|software|microsoft basic/.test(nombre);
  } catch {
    return false;
  }
}

function onFrame3D(marcaMs: number) {
  marcasFps.push(marcaMs);
  if (marcasFps.length > 90) marcasFps.shift();
  if (marcasFps.length < 30) return;
  const deltas: number[] = [];
  for (let i = 1; i < marcasFps.length; i++) deltas.push(marcasFps[i] - marcasFps[i - 1]);
  deltas.sort((a, b) => a - b);
  const mediana = deltas[Math.floor(deltas.length / 2)] || 16;
  fpsMedio.value = Math.min(120, Math.round(1000 / Math.max(1, mediana)));
  const ahora = typeof performance !== "undefined" ? performance.now() : Date.now();
  if (fpsMedio.value < 30) {
    fpsBajoDesde ??= ahora;
    if (!calidadDegradada && ahora - fpsBajoDesde > 700) {
      calidadDegradada = true;
      motor3d?.degradarCalidad();
    }
    if (ahora - fpsBajoDesde > 2000) cambiarMotor("motor-2d");
  } else {
    fpsBajoDesde = null;
  }
}

function payloadComun() {
  const { hm0_m, te_s, b_pto_ns_m } = props.params;
  const profundidad = props.params.profundidad_m || PROFUNDIDAD_M;
  const k = numeroOnda((2 * Math.PI) / te_s, profundidad);
  const r = props.resultado;
  const t = r?.series?.t_s ?? null;
  const z = r?.series?.z_m ?? null;
  const series =
    Array.isArray(t) && Array.isArray(z) && t.length && z.length ? { t_s: t, z_m: z } : null;
  return {
    series,
    k,
    Hm0: hm0_m,
    Te: te_s,
    Bpto: b_pto_ns_m,
    dispositivo: String(r?.metadatos?.dispositivo ?? props.params.dispositivo),
    profundidad_m: profundidad,
    modoEnergia: modoActivo.value,
    cimentacion: cimentacionSeleccionada.value,
    velocidadCorriente: velocidadCorriente.value,
    rangoMarea: rangoMarea.value,
    cantidadUnidades: Number((r as Record<string, unknown> | null | undefined)?.cantidad_unidades) > 0 ? Number((r as Record<string, unknown>).cantidad_unidades) : undefined,
    potenciaCaptadaW: Number(r?.potencia_nominal_w) || null,
    modo: String((r as Record<string, unknown> | null | undefined)?.recurso ? String(((r as Record<string, unknown>).recurso as Record<string, unknown>).modo ?? "") : ""),
  };
}

/** Enciende el motor pedido sin perder la simulación: alimenta el payload
 *  común al motor entrante, pausa el saliente y reconecta el monitor. */
function cambiarMotor(destino: "motor-3d" | "motor-2d") {
  if (destino === "motor-3d") {
    if (!contenedor3D.value || !soportaWebGL()) {
      motorActivo.value = "motor-2d";
      return;
    }
    try {
      if (!motor3d && contenedor3D.value) {
        motor3d = new Animacion3D(contenedor3D.value);
        motor3d.onFrame = onFrame3D;
      }
      if (!motor3d) {
        motorActivo.value = "motor-2d";
        return;
      }
      motor3d.cargarSimulacion(payloadComun() as never);
      sinSerie.value = motor3d.sinSerieMsg;
      animacion?.pausar();
      motorActivo.value = "motor-3d";
      motor3d.arrancar();
      if (pausado.value) motor3d.pausar();
      else motor3d.reanudar();
      pausado.value = motor3d.pausado;
      if (canvasRef.value) canvasRef.value.style.visibility = "hidden";
      if (contenedor3D.value) contenedor3D.value.style.visibility = "visible";
    } catch {
      motor3d = null;
      motorActivo.value = "motor-2d";
    }
    return;
  }
  animacion?.cargarSimulacion(payloadComun() as never);
  if (animacion) {
    sinSerie.value = animacion.sinSerieMsg;
    motor3d?.pausar();
    motorActivo.value = "motor-2d";
    animacion.arrancar();
    if (pausado.value) animacion.pausar();
    else animacion.reanudar();
    pausado.value = animacion.pausado;
  }
  if (canvasRef.value) canvasRef.value.style.visibility = "visible";
  if (contenedor3D.value) contenedor3D.value.style.visibility = "hidden";
}

const VISTAS = [
  { id: "motor-2d" as const, etiqueta: "2D" },
  { id: "motor-3d" as const, etiqueta: "3D" },
];

function elegirVista(id: "motor-2d" | "motor-3d") {
  motorPedido.value = id;
  alCambiarMotor();
}

function alCambiarMotor() {
  marcasFps.length = 0;
  fpsBajoDesde = null;
  if (motorPedido.value === "motor-2d") cambiarMotor("motor-2d");
  else if (motorPedido.value === "motor-3d") cambiarMotor("motor-3d");
  else if (soportaWebGL() && aceleracionPorHardware()) cambiarMotor("motor-3d");
  else cambiarMotor("motor-2d");
}

const modoActivo = ref<"undimotriz" | "mareomotriz">("undimotriz");
const cimentacionSeleccionada = ref<TipoCimentacion>("pilote");
// La marea que manda es la de los params (punto del mapa o mando); si no la
// hay, la que el motor leyó del sitio.
const recursoMotor = computed(() => (props.resultado?.recurso ?? {}) as Record<string, number>);
const velocidadCorriente = computed(() => props.params.velocidad_ms ?? recursoMotor.value.velocidad_ms ?? 0);
const rangoMarea = computed(() => props.params.rango_m ?? recursoMotor.value.rango_m ?? 0);

/* Aviso de validez del modelo lineal: se calcula sobre los valores de los
   controles, sin tocar el resultado del servicio. Fuera de rango se avisa
   en palabras, sin cifras con apariencia de exactas. */
const validez = computed(() =>
  evaluarValidezOleaje({
    hm0: props.params.hm0_m,
    te: props.params.te_s,
    profundidad: props.params.profundidad_m || PROFUNDIDAD_M,
  })
);
const estadoValidez = computed<'pendiente' | 'error' | 'resultado'>(() =>
  validez.value.estado === 'fuera' ? 'error' : validez.value.estado === 'limite' ? 'pendiente' : 'resultado'
);
const motivoValidez = computed(() => validez.value.mensaje || 'Oleaje dentro del rango del modelo lineal.');

const MODOS = [
  { id: "undimotriz" as const, label: "Oleaje" },
  { id: "mareomotriz" as const, label: "Marea" },
];

const DISPOSITIVOS_UNDIMOTRIZ = [
  { id: "absorbedor_puntual", nombre: "Absorbedor puntual" },
];

const DISPOSITIVOS_MAREOMOTRIZ = [
  { id: "turbina_corriente", nombre: "Turbina de corriente" },
  { id: "embalse", nombre: "Dique mareal" },
];

const dispositivosDelModo = computed(() =>
  modoActivo.value === "mareomotriz" ? DISPOSITIVOS_MAREOMOTRIZ : DISPOSITIVOS_UNDIMOTRIZ
);

function seleccionarModo(modo: "undimotriz" | "mareomotriz") {
  modoActivo.value = modo;
  if (modo === "mareomotriz") {
    if (props.params.dispositivo !== "turbina_corriente" && props.params.dispositivo !== "embalse") {
      emit("update:params", { dispositivo: "turbina_corriente" });
    }
  } else if (props.params.dispositivo !== "absorbedor_puntual") {
    emit("update:params", { dispositivo: "absorbedor_puntual" });
  }
}

function seleccionarDispositivo(id: string) {
  emit("update:params", { dispositivo: id });
}

function alCambiarVelCorriente(v: number) {
  emit("update:params", { velocidad_ms: v });
}

function alCambiarRangoMarea(v: number) {
  emit("update:params", { rango_m: v });
}

/** Número de onda por Newton-Raphson sobre la relación de dispersión. Sólo se
 *  usa para dibujar la longitud de onda a escala; no interviene en el cálculo. */
function numeroOnda(omega: number, h: number): number {
  const g = 9.81;
  const arg = (omega * omega * h) / g;
  let th = Math.tanh(arg);
  if (th <= 0) th = 1e-12;
  let k = (omega * omega / g) / Math.sqrt(th);
  for (let i = 0; i < 30; i++) {
    const kh = k * h;
    const th2 = Math.tanh(kh);
    const f = g * k * th2 - omega * omega;
    const ch = Math.cosh(kh);
    const sech2 = 1 / (ch * ch);
    const df = g * th2 + g * k * h * sech2;
    k -= f / df;
    if (Math.abs(f) < 1e-10) break;
  }
  return k;
}

function redibujar() {
  if (!animacion) return;
  const payload = payloadComun();
  if (motorActivo.value === "motor-3d" && motor3d) {
    motor3d.cargarSimulacion(payload as never);
    sinSerie.value = motor3d.sinSerieMsg;
    motor3d.arrancar();
    if (pausado.value) motor3d.pausar();
    pausado.value = motor3d.pausado;
    return;
  }
  animacion.cargarSimulacion(payload as never);
  sinSerie.value = animacion.sinSerieMsg;
  animacion.arrancar();
  pausado.value = animacion.pausado;
}

function togglePausa() {
  const activo = motorActivo.value === "motor-3d" && motor3d ? motor3d : animacion;
  if (!activo) return;
  if (activo.pausado) activo.reanudar();
  else activo.pausar();
  pausado.value = activo.pausado;
}

/** La carcasa llama aquí al pulsar «Simular este emplazamiento»: la escena
 *  recibe el foco y un destello breve para que se vea dónde pasó la acción. */
function enfocar() {
  const el = raiz.value;
  if (!el) return;
  el.focus({ preventScroll: true });
  el.setAttribute("data-destello", "");
  setTimeout(() => el.removeAttribute("data-destello"), 900);
}

defineExpose({ enfocar });

onMounted(() => {
  modoActivo.value =
    props.params.dispositivo === "turbina_corriente" || props.params.dispositivo === "embalse"
      ? "mareomotriz"
      : "undimotriz";

  if (!canvasRef.value) return;
  animacion = new AnimacionCanvas(canvasRef.value);
  // Ya no hay tira de lectura sobre el lienzo: el corte llega hasta el borde.
  animacion.pie = 0;
  redibujar();
  // Auto: 3D si WebGL aguanta, si no el 2D intacto sigue al mando.
  alCambiarMotor();
});

onBeforeUnmount(() => {
  animacion?.detener();
  motor3d?.liberar();
  motor3d = null;
});

watch(
  () => [props.params, props.resultado, modoActivo.value],
  () => {
    if (props.params.dispositivo === "turbina_corriente" || props.params.dispositivo === "embalse") {
      modoActivo.value = "mareomotriz";
    }
    redibujar();
  },
  { deep: true }
);
</script>

<style scoped>
.ver {
  display: flex;
  flex-direction: column;
  inline-size: 100%;
  block-size: 100%;
  min-block-size: 0;
  overflow: auto;
  background: var(--lienzo);
  outline: none;
}

/* ---- Escena ---- */
/* La escena se queda con el alto que dejan los mandos: en pantallas altas
   crece en vez de dejar una franja vacía bajo la cabina. */
.escena {
  position: relative;
  flex: 1 1 auto;
  min-block-size: 18rem;
  overflow: hidden;
  background: var(--map-oceano);
  transition: box-shadow var(--dur-media) var(--ease-salida);
}

.ver[data-destello] .escena {
  box-shadow: inset 0 0 0 3px var(--rol-captado);
}

.oleaje {
  position: absolute;
  inset: 0;
  inline-size: 100%;
  block-size: 100%;
  display: block;
}

/* Escena 3D con respaldo 2D: el lienzo 3D vive encima sólo cuando el motor
   activo es el 3D; el 2D intacto sigue debajo y toma el relevo sin perder
   la simulación si WebGL falla o el ritmo cae bajo 30 fps. */
.lienzo-3d {
  position: absolute;
  inset: 0;
  inline-size: 100%;
  block-size: 100%;
  visibility: hidden;
}

.ver[data-motor="motor-3d"] .lienzo-3d {
  visibility: visible;
}

.ver[data-motor="motor-3d"] .oleaje {
  visibility: hidden;
}

/* Abajo a la izquierda: la esquina superior derecha es del minimapa. */
.escena-acciones {
  position: absolute;
  inset-block-end: var(--s-3);
  inset-inline-start: var(--s-3);
  display: flex;
  align-items: center;
  gap: var(--s-2);
}

.btn-lienzo {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: var(--s-1) 10px;
  border: 1px solid var(--marco-linea);
  border-radius: var(--radio);
  background: oklch(0.24 0.02 238 / 0.82);
  color: var(--marco-tinta);
  font-weight: 600;
  font-size: var(--text-meta);
  cursor: pointer;
  backdrop-filter: blur(6px);
}

.btn-lienzo:hover {
  background: oklch(0.24 0.02 238 / 0.97);
}

.aviso-sin-serie {
  display: flex;
  align-items: center;
  gap: 6px;
  margin: 0;
  padding: var(--s-1) var(--s-2);
  border-radius: var(--radio);
  background: oklch(1 0 0 / 0.8);
  color: var(--tenue);
  font-size: var(--text-meta);
}

/* Conmutador de vista 2D | 3D: arriba a la izquierda, siempre a la vista. */
.escena-modo {
  position: absolute;
  inset-block-start: var(--s-3);
  inset-inline-start: var(--s-3);
  display: inline-flex;
  padding: 3px;
  gap: 2px;
  border: 1px solid var(--marco-linea);
  border-radius: var(--radio-caja);
  background: oklch(0.24 0.02 238 / 0.82);
  backdrop-filter: blur(6px);
}

.btn-vista {
  min-inline-size: 3rem;
  padding: 4px 12px;
  border: none;
  border-radius: calc(var(--radio-caja) - 3px);
  background: transparent;
  color: var(--marco-tenue);
  font-weight: 700;
  font-size: var(--text-meta);
  letter-spacing: 0.04em;
  cursor: pointer;
  transition: background-color var(--dur-rapida) var(--ease-salida), color var(--dur-rapida) var(--ease-salida);
}

.btn-vista:hover {
  color: var(--marco-tinta);
}

.btn-vista.activo {
  background: var(--marco-captado);
  color: var(--marco);
}

/* ---- Cabina: dispositivo y mandos en una fila, anotaciones debajo ---- */
.cabina {
  display: grid;
  grid-template-columns: minmax(13rem, 16rem) minmax(0, 1fr);
  grid-template-areas:
    "recurso controles"
    "anotaciones anotaciones";
  flex: none;
  align-items: start;
  gap: var(--s-3);
  padding: var(--s-3);
}

.bloque--recurso { grid-area: recurso; }
.bloque--controles { grid-area: controles; }
.bloque--anotaciones { grid-area: anotaciones; }

.bloque {
  display: flex;
  flex-direction: column;
  gap: var(--s-3);
  min-inline-size: 0;
}

.rotulo-grupo {
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--tenue);
}

/* Anotaciones clicables de la escena: qué es cada cosa, en lista. */
.anotaciones-lista {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin: 0;
  padding: 0;
  list-style: none;
}

/* Aviso de validez del modelo: reutiliza EstadoBloque con sus estados. */
.bloque--anotaciones {
  flex-direction: row;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--s-2) var(--s-3);
  padding: var(--s-2) var(--s-3);
  border: 1px solid var(--borde-suave);
  border-radius: var(--radio-caja);
  background: var(--panel);
}

/* ---- Selección de recurso y dispositivo ---- */
.modos {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 2px;
  padding: 3px;
  border-radius: var(--radio-caja);
  background: var(--superficie);
}

.btn-modo {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: var(--s-1) var(--s-2);
  border: none;
  border-radius: calc(var(--radio-caja) - 3px);
  background: transparent;
  color: var(--tenue);
  font-weight: 600;
  cursor: pointer;
  transition: background-color var(--dur-rapida) var(--ease-salida), color var(--dur-rapida) var(--ease-salida);
}

.btn-modo.activo {
  background: var(--panel);
  color: var(--rol-mar-profundo);
  box-shadow: var(--sombra-caja);
}

.dispositivos {
  display: grid;
  gap: var(--s-1);
}

.dispositivos-lista {
  display: grid;
  gap: 4px;
}

.btn-dispositivo {
  text-align: start;
  padding: 6px 10px;
  border: 1px solid var(--borde-suave);
  border-radius: var(--radio);
  background: var(--panel);
  font-size: var(--text-meta);
  font-weight: 500;
  cursor: pointer;
  transition: border-color var(--dur-rapida) var(--ease-salida), background-color var(--dur-rapida) var(--ease-salida);
}

.btn-dispositivo:hover {
  border-color: var(--borde);
}

.btn-dispositivo.activo {
  border-color: var(--rol-mar-profundo);
  background: var(--acento-suave);
  color: var(--rol-mar-profundo);
  font-weight: 600;
}

.campo-cimentacion {
  display: grid;
  gap: 4px;
  margin-block-start: var(--s-1);
}

.campo-cimentacion select {
  min-inline-size: 0;
  padding: 4px 8px;
  border: 1px solid var(--borde);
  border-radius: var(--radio);
  background: var(--panel);
  font-size: var(--text-meta);
}

@media (width <= 64rem) {
  .escena {
    flex: none;
    aspect-ratio: 16 / 9;
    min-block-size: 14rem;
  }

  .cabina {
    grid-template-columns: minmax(0, 1fr);
    grid-template-areas: "recurso" "controles" "anotaciones";
  }
}
</style>
