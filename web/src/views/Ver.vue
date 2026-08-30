<template>
  <section class="ver">
    <header class="tesis">
      <div class="hero-cifras">
        <div class="cifra"><span class="kicker">Isla Fuerte — verificado</span><span class="num">{{ formatearNumero(8.9, 1) }} <small>kW/m</small></span><span class="ref">Ortega et al. 2013 RE 57</span></div>
        <div class="divisor">frente a</div>
        <div class="cifra umbral"><span class="num">{{ formatearNumero(40, 1) }} <small>kW/m</small></span><span class="ref">umbral granja — Handbook</span></div>
      </div>
      <p class="fuentes">8,9 verificado vs 40 umbral rentabilidad (Osorio et al. 2016 / Handbook cap. 1). La tesis se decide aquí.</p>
    </header>

    <div class="lienzo-wrap">
      <canvas ref="canvasRef" class="oleaje" width="900" height="260" aria-label="Animación del oleaje y boya"></canvas>
      <p v-if="sinSerie" class="aviso-sin-serie">{{ sinSerie }}</p>
    </div>

    <div class="acciones">
      <button class="btn-prim" @click="togglePausa">{{ animacion?.pausado ? "Reanudar" : "Pausar" }}</button>
      <span class="accion-hint">Mueve altura, ritmo y freno. Mira cómo responde la boya.</span>
    </div>

    <ControlesFisicos
      :hm0_m="hm0_m"
      :te_s="te_s"
      :b_pto_ns_m="b_pto_ns_m"
      @update:hm0_m="v => hm0_m = v"
      @update:te_s="v => te_s = v"
      @update:b_pto_ns_m="v => b_pto_ns_m = v"
    />

    <p class="viviendas">
      <template v-if="viviendas !== null">
        Alcanza para {{ formatearNumero(viviendas, 0) }} viviendas
      </template>
      <template v-else>
        pendiente — consumo residencial sin fuente verificada
      </template>
    </p>
  </section>
</template>

<script setup lang="ts">
import { onMounted, ref, watch } from "vue";
import { AnimacionCanvas, PROFUNDIDAD_M } from "../components/AnimacionCanvas";
import ControlesFisicos from "../components/ControlesFisicos.vue";
import { formatearNumero } from "../utils/formato";

// Variables exactas
const Hm0 = ref<number>(1.5); // m — alias hm0_m para el prop
const Te = ref<number>(7.0); // s
const Bpto = ref<number>(80_000); // Ns/m

const hm0_m = ref(1.5);
const te_s = ref(7.0);
const b_pto_ns_m = ref(80_000);
const profundidad_m = ref(PROFUNDIDAD_M); // 30, no recalcular física por fotograma
const viviendas = ref<number | null>(null);

const canvasRef = ref<HTMLCanvasElement | null>(null);
let animacion: AnimacionCanvas | null = null;
const sinSerie = ref("");

function numeroOnda(omega: number, h: number): number {
  // Newton-Raphson liviano espejo de nucleo.olas.numero_onda — solo para k de dibujo, no para balance energético
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
    const delta = f / df;
    k -= delta;
    if (Math.abs(f) < 1e-10) break;
  }
  return k;
}

async function cargarSimulacion() {
  const H = hm0_m.value;
  const TeV = te_s.value;
  const Bp = b_pto_ns_m.value;
  const omega = (2 * Math.PI) / TeV;
  const k = numeroOnda(omega, profundidad_m.value);
  // Contrato: series transfer UNA vez por simulación vía servicio
  // Si dispositivo no entrega z_m (ej TurbinaCorriente), muestra "sin serie de posición — dispositivo <nombre>" sin sintetizar
  let series: { t_s: number[]; z_m: number[] } | null = null;
  let dispositivo = "absorbedor_puntual";
  let viviendasSrv: number | null = null;
  try {
    // intento servicio real si está disponible (app/servicio.py expone /simular en despliegue)
    const r = await fetch(`/api/simular`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ hm0_m: H, te_s: TeV, b_pto_ns_m: Bp, profundidad_m: profundidad_m.value }),
    });
    if (r.ok) {
      const j = await r.json();
      const z = j?.resultado?.series?.z_m ?? j?.series?.z_m ?? null;
      const t = j?.resultado?.series?.t_s ?? j?.series?.t_s ?? null;
      dispositivo = j?.resultado?.metadatos?.dispositivo ?? j?.dispositivo ?? dispositivo;
      if (Array.isArray(t) && Array.isArray(z) && t.length && z.length) series = { t_s: t, z_m: z };
      else series = null; // no sintetizar
      viviendasSrv = j?.extras?.viviendas?.viviendas ?? j?.viviendas ?? null;
    }
  } catch {
    // sin servicio: sin serie sintética — declarar ausencia si aplica
  }
  // Si aún sin series y dispositivo es absorbedor, no inventamos; si es turbina, también ausencia
  if (animacion) {
    animacion.cargarSimulacion({ series, k, Hm0: H, Te: TeV, Bpto: Bp, dispositivo, profundidad_m: profundidad_m.value });
    sinSerie.value = (animacion as any).sinSerieMsg || "";
    if (!animacion.pausado) animacion.iniciar();
  }
  viviendas.value = viviendasSrv;
  // fallback viviendas local si servicio no responde: estimación simple sin fórmulas en pantalla
  if (viviendas.value === null && series) {
    // no calcular física aquí: solo mostrar pendiente si no hay servicio
    viviendas.value = null;
  }
}

function togglePausa() {
  if (!animacion) return;
  if (animacion.pausado) animacion.reanudar();
  else animacion.pausar();
}

onMounted(() => {
  if (canvasRef.value) {
    animacion = new AnimacionCanvas(canvasRef.value);
    cargarSimulacion();
  }
});

watch([hm0_m, te_s, b_pto_ns_m], cargarSimulacion);
</script>

<style scoped>
.ver { max-width: 960px; margin: 0 auto; }
.tesis { border-bottom: 1px solid var(--borde-suave); margin-bottom: var(--s-4); padding-bottom: 8px; }
.hero-cifras { display: flex; align-items: end; gap: 18px; flex-wrap: wrap; }
.cifra { display: flex; flex-direction: column; line-height: 1.05; }
.cifra .kicker { font-size: 11px; letter-spacing: 0.06em; text-transform: uppercase; color: var(--tenue); }
.cifra .num { font-size: var(--text-cifra); font-weight: 700; color: var(--tinta); font-variant-numeric: tabular-nums; }
.cifra .num small { font-size: 0.45em; font-weight: 600; color: var(--tenue); }
.cifra .ref { font-size: var(--text-meta); color: var(--tenue); }
.divisor { font-size: 13px; color: var(--tenue); align-self: center; padding-bottom: 14px; }
.cifra.umbral .num { color: var(--conf-pendiente); opacity: 0.95; }
.fuentes { font-size: var(--text-meta); color: var(--tenue); margin: 8px 0 0; }
.oleaje { width: 100%; height: 260px; display: block; background: var(--panel); border: 1px solid var(--borde); border-top: 3px solid var(--foco); box-shadow: 0 1px 2px oklch(0.2 0.02 240 / 0.08); }
.aviso-sin-serie { color: var(--tenue); text-align: center; font-size: var(--text-meta); margin: 6px 0 0; }
.acciones { display: flex; align-items: center; gap: 12px; margin: 10px 0 6px; }
.btn-prim { background: var(--tinta); color: var(--panel); border: 1px solid var(--tinta); border-radius: 6px; padding: 6px 12px; font-weight: 600; cursor: pointer; }
.btn-prim:focus-visible { outline: 2px solid var(--foco); outline-offset: 2px; }
.accion-hint { font-size: 12px; color: var(--tenue); }
.fila input[type="range"] { vertical-align: middle; }
</style>
