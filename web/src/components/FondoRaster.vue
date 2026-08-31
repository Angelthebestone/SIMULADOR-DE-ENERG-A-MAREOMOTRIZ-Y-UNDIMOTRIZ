<!--
  FondoRaster — capa raster estática bajo la animación del oleaje en `Ver`.

  Reutiliza la pirámide XYZ de `datos/gee/sentinel2_mediana/{z}/{x}/{y}.png`
  ya servida por `vite.config.ts` (mismo esquema que `web/src/map/mapa.ts`).
  Opacidad por defecto del 60 % para no robar protagonismo al oleaje.
  Toggle ON/OFF expuesto por `v-model:activo` desde `Ver.vue`.
-->
<template>
  <canvas
    v-show="activo"
    ref="lienzoRef"
    class="fondo-raster"
    :data-testid="'fondo-raster'"
    aria-hidden="true"
  ></canvas>
</template>

<script setup lang="ts">
import { onMounted, onBeforeUnmount, ref, watch } from "vue";
import { CAPAS } from "../map/capas";

const props = defineProps<{
  activo: boolean;
  opacidad?: number;
  zoom?: number;
  sitio?: { lon: number; lat: number };
}>();

const emit = defineEmits<{
  (e: "update:activo", v: boolean): void;
  (e: "update:opacidad", v: number): void;
}>();

const lienzoRef = ref<HTMLCanvasElement | null>(null);
let observador: ResizeObserver | null = null;
let corriendoId = 0;

const OPACIDAD_DEFECTO = 0.6;
const TILE_SIZE = 256;

const metadatoSentinel = CAPAS.find((c) => c.id === "sentinel2_mediana")!;
const metadatoRelieve = CAPAS.find((c) => c.id === "relieve_sombreado")!;

/** Resolvedor XYZ→URL: aísla la convención de la pirámide en un solo sitio.
 *  El mapa (`web/src/map/mapa.ts::crearMapa`) usa exactamente la misma forma
 *  `{z}/{x}/{y}.png` bajo `./datos/gee/<id>/` — no se duplica más lógica. */
function urlTile(id: string, z: number, x: number, y: number): string {
  const dir = id === metadatoRelieve.id ? "relieve_sombreado" : "sentinel2_mediana";
  return `./datos/gee/${dir}/${z}/${x}/${y}.png`;
}

function lonLatATile(lon: number, lat: number, z: number): { x: number; y: number } {
  const n = 2 ** z;
  const x = Math.floor(((lon + 180) / 360) * n);
  const latRad = (lat * Math.PI) / 180;
  const mercY = Math.log(Math.tan(Math.PI / 4 + latRad / 2));
  const y = Math.floor(((1 - mercY / Math.PI) / 2) * n);
  return { x, y };
}

function cargarImagen(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolver) => {
    const img = new Image();
    img.onload = () => resolver(img);
    img.onerror = () => resolver(null);
    img.src = src;
  });
}

function token(nombre: string, fb: string): string {
  try {
    const v = getComputedStyle(document.documentElement).getPropertyValue(nombre).trim();
    return v || fb;
  } catch {
    return fb;
  }
}

function dimensionCss(canvas: HTMLCanvasElement): [number, number] {
  const r = canvas.getBoundingClientRect();
  return [r.width, r.height];
}

function ajustarDPR(canvas: HTMLCanvasElement): [number, number, number] {
  const [w, h] = dimensionCss(canvas);
  if (w < 2 || h < 2) return [w, h, 1];
  const dpr = window.devicePixelRatio || 1;
  canvas.width = Math.round(w * dpr);
  canvas.height = Math.round(h * dpr);
  const ctx = canvas.getContext("2d");
  if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return [w, h, dpr];
}

async function pintar(id: number): Promise<void> {
  const canvas = lienzoRef.value;
  if (!canvas || !props.activo) return;
  const [w, h] = ajustarDPR(canvas);
  if (w < 2 || h < 2) return;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const op = Math.min(1, Math.max(0, props.opacidad ?? OPACIDAD_DEFECTO));
  const zoom = Math.min(
    metadatoSentinel.zoom_max,
    Math.max(0, props.zoom ?? 8),
  );
  const sitio = props.sitio ?? { lon: -76.18, lat: 9.39 };
  const { x: cx, y: cy } = lonLatATile(sitio.lon, sitio.lat, zoom);

  // Pintar fondo del lienzo con el token de panel: si una tesela falta, queda
  // el color de la app y no un pixel negro que rompa la lectura.
  ctx.globalAlpha = 1;
  ctx.fillStyle = token("--panel", "oklch(0.988 0.003 106)");
  ctx.fillRect(0, 0, w, h);

  // Compensar DPR para no pintar las teselas en coordenadas de dispositivo.
  const dpr = window.devicePixelRatio || 1;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  // Capa 1: relieve sombreado (opacidad reducida — es textura secundaria).
  const relieves = await Promise.all(
    [-1, 0, 1].flatMap((dx) =>
      [-1, 0, 1].map((dy) =>
        cargarImagen(urlTile(metadatoRelieve.id, zoom, cx + dx, cy + dy)),
      ),
    ),
  );
  ctx.globalAlpha = op * 0.5;
  for (let dx = -1; dx <= 1; dx++) {
    for (let dy = -1; dy <= 1; dy++) {
      const img = relieves[(dx + 1) * 3 + (dy + 1)];
      if (!img) continue;
      const tx = (cx + dx) * TILE_SIZE - cx * TILE_SIZE + w / 2 - TILE_SIZE / 2;
      const ty = (cy + dy) * TILE_SIZE - cy * TILE_SIZE + h / 2 - TILE_SIZE / 2;
      ctx.drawImage(img, tx, ty);
    }
  }

  // Capa 2: Sentinel-2 mediana (color real del Caribe colombiano).
  const sentinels = await Promise.all(
    [-1, 0, 1].flatMap((dx) =>
      [-1, 0, 1].map((dy) =>
        cargarImagen(urlTile(metadatoSentinel.id, zoom, cx + dx, cy + dy)),
      ),
    ),
  );
  ctx.globalAlpha = op;
  for (let dx = -1; dx <= 1; dx++) {
    for (let dy = -1; dy <= 1; dy++) {
      const img = sentinels[(dx + 1) * 3 + (dy + 1)];
      if (!img) continue;
      const tx = (cx + dx) * TILE_SIZE - cx * TILE_SIZE + w / 2 - TILE_SIZE / 2;
      const ty = (cy + dy) * TILE_SIZE - cy * TILE_SIZE + h / 2 - TILE_SIZE / 2;
      ctx.drawImage(img, tx, ty);
    }
  }

  ctx.globalAlpha = 1;
  // Si en medio de la composición se desactivó la capa, descartar el trabajo.
  if (id !== corriendoId) return;
}

async function repintar(): Promise<void> {
  if (!props.activo) return;
  const id = ++corriendoId;
  await pintar(id);
}

function alternar(): void {
  emit("update:activo", !props.activo);
}

defineExpose({ alternar });

onMounted(() => {
  if (!lienzoRef.value) return;
  if (typeof ResizeObserver !== "undefined") {
    observador = new ResizeObserver(() => repintar());
    observador.observe(lienzoRef.value);
  }
  if (props.activo) repintar();
});

onBeforeUnmount(() => {
  observador?.disconnect();
  observador = null;
});

watch(
  () => [props.activo, props.opacidad, props.zoom, props.sitio?.lon, props.sitio?.lat],
  () => repintar(),
  { deep: true },
);
</script>

<style scoped>
.fondo-raster {
  position: absolute;
  inset: 0;
  inline-size: 100%;
  block-size: 100%;
  pointer-events: none;
  display: block;
}
</style>