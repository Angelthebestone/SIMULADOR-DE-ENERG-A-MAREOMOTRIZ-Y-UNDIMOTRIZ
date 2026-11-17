<template>
  <section class="compara" aria-labelledby="titulo-compara" data-testid="compara-plantas">
    <h2 id="titulo-compara" class="rotulo">
      <Icono icono="comparar" tamano="sm" />
      <span>Frente a plantas reales</span>
    </h2>

    <p v-if="!filas.length" class="vacio">Sin plantas reales de esta tecnología en el catálogo.</p>

    <template v-else>
      <p v-if="frase" class="frase">{{ frase }}</p>
      <p v-if="dispositivo === 'absorbedor_puntual'" class="nota">
        Ninguna planta de olas en servicio usa todavía una boya como la tuya: abajo hay columnas de agua,
        aletas y serpientes, otras formas de captar la misma ola.
      </p>

      <ul class="lista" role="list">
        <li class="fila fila--tuya">
          <div class="fila-cabeza">
            <span class="nombre">Tu simulación</span>
            <span class="cifra">{{ textoPotencia(propia.potenciaW) }}</span>
          </div>
          <div class="barra" :aria-label="'Factor de planta ' + textoFp(propia.fp)">
            <span class="barra-relleno" :style="{ inlineSize: anchoFp(propia.fp) }"></span>
            <span class="barra-texto">FP {{ textoFp(propia.fp) }}</span>
          </div>
        </li>

        <li v-for="f in filas" :key="f.id" class="fila">
          <div class="fila-cabeza">
            <a class="nombre" :href="f.url" target="_blank" rel="noopener">{{ f.nombre }}</a>
            <span class="cifra">{{ textoPotencia(f.potenciaW) }}</span>
          </div>
          <div class="meta">
            <span class="estado" :data-estado="f.estado">{{ f.estadoTexto }}</span>
            <span v-if="f.gwh !== null">
              {{ formatearNumero(f.gwh, f.gwh < 10 ? 2 : 0) }} GWh/año<template v-if="f.nota"> · {{ f.nota }}</template>
            </span>
            <span v-else class="sin-dato">producción anual sin dato publicado</span>
          </div>
          <div v-if="f.fp !== null" class="barra barra--real">
            <span class="barra-relleno" :style="{ inlineSize: anchoFp(f.fp) }"></span>
            <span class="barra-texto">FP {{ textoFp(f.fp) }}</span>
          </div>
          <details v-if="f.causa" class="causa">
            <summary>Por qué cerró</summary>
            <p>{{ f.causa }}</p>
          </details>
        </li>
      </ul>

      <p class="nota">
        FP = factor de planta: energía del año ÷ (potencia instalada × 8 760 h). Es la cifra que sí se
        compara entre escalas distintas. La simulación no cuenta averías, mantenimiento ni paradas: por
        eso las plantas reales suelen quedar por debajo.
      </p>
    </template>
  </section>
</template>

<script setup lang="ts">
import { computed, ref, watch } from "vue";
import Icono from "./Icono.vue";
import { cargarPlantas, type PlantaMundial, type TecnologiaPlanta } from "../map/plantas";
import { formatearNumero, textoPotencia } from "../utils/formato";

const props = defineProps<{
  dispositivo: string;
  potenciaW: number;
  aepMwh: number;
  factorPlanta: number;
}>();

const TECNOLOGIA: Record<string, TecnologiaPlanta> = {
  absorbedor_puntual: "undimotriz",
  turbina_corriente: "turbina",
  embalse: "dique",
};

type PlantaConDatos = PlantaMundial & {
  produccion_anual_gwh?: number;
  produccion_url?: string;
  produccion_nota?: string;
};

const plantas = ref<PlantaConDatos[]>([]);
const causas = ref<Record<string, string>>({});
cargarPlantas().then((p) => (plantas.value = p as PlantaConDatos[]));

function potenciaW(p: PlantaMundial): number {
  const v = Number(p.potencia_instalada);
  if (!Number.isFinite(v)) return NaN;
  return v * (p.unidad_potencia === "MW" ? 1e6 : p.unidad_potencia === "kW" ? 1e3 : 1);
}

const filas = computed(() =>
  plantas.value
    .filter((p) => p.tecnologia === TECNOLOGIA[props.dispositivo])
    .map((p) => {
      const pw = potenciaW(p);
      const gwh = typeof p.produccion_anual_gwh === "number" ? p.produccion_anual_gwh : null;
      return {
        id: p.id,
        nombre: p.nombre,
        url: p.produccion_url || p.fuente_url,
        potenciaW: pw,
        gwh,
        nota: p.produccion_nota ?? "",
        fp: gwh !== null && pw > 0 ? (gwh * 1e9) / (pw * 8760) : null,
        estado: p.estado_operativo,
        estadoTexto:
          p.estado_operativo === "operativo"
            ? `en operación desde ${p.anio_puesta_en_marcha ?? "—"}`
            : `cerrada en ${p.anio_cierre ?? "—"}`,
        causa: p.fracaso ? causas.value[p.fracaso] ?? "" : "",
        fracaso: p.fracaso,
      };
    })
    .sort((a, b) => b.potenciaW - a.potenciaW)
);

// Las causas de cierre viven en datos/fracasos/<id>.json; se piden solo para
// las plantas cerradas que se están mostrando.
watch(
  filas,
  (fs) => {
    for (const f of fs) {
      if (!f.fracaso || f.fracaso in causas.value) continue;
      causas.value[f.fracaso] = "";
      fetch(`./datos/fracasos/${f.fracaso}.json`)
        .then((r) => (r.ok ? r.json() : null))
        .then((j) => {
          if (j?.causa) causas.value[f.fracaso as string] = String(j.causa);
        })
        .catch(() => undefined);
    }
  },
  { immediate: true }
);

const propia = computed(() => ({ potenciaW: props.potenciaW, fp: props.factorPlanta }));

/** Una frase de escala contra la planta real de potencia más parecida a la
 *  simulada: cuántos dispositivos harían falta, o qué parte produce el tuyo. */
const frase = computed(() => {
  const conDato = filas.value.filter((f) => f.gwh !== null && f.potenciaW > 0);
  if (!conDato.length || !(props.aepMwh > 0)) return "";
  const distancia = (f: { potenciaW: number }) => Math.abs(Math.log(f.potenciaW / props.potenciaW));
  const ref_ = conDato.reduce((a, b) => (distancia(b) < distancia(a) ? b : a));
  const cociente = ((ref_.gwh as number) * 1000) / props.aepMwh;
  if (cociente <= 1.05) {
    return `Tu simulación produce ${formatearNumero(1 / cociente, 1)} veces lo que produce ${ref_.nombre} en un año.`;
  }
  const n = Math.ceil(cociente);
  const plural = { absorbedor_puntual: "boyas", turbina_corriente: "turbinas", embalse: "diques" }[props.dispositivo] ?? "dispositivos";
  return `Para producir lo que produce ${ref_.nombre} en un año harían falta ${formatearNumero(n, 0)} ${plural} como el tuyo en este punto.`;
});

function textoFp(fp: number | null): string {
  return fp === null || !Number.isFinite(fp) ? "sin dato" : `${formatearNumero(fp * 100, 1)} %`;
}

function anchoFp(fp: number | null): string {
  return `${Math.max(0, Math.min(1, fp ?? 0)) * 100}%`;
}
</script>

<style scoped>
.compara {
  display: grid;
  gap: var(--s-2);
}

.rotulo {
  display: flex;
  align-items: center;
  gap: 6px;
  margin: 0;
  font-family: var(--font-sans);
  font-size: var(--text-meta);
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--tenue);
}

.frase {
  margin: 0;
  font-size: var(--text-meta);
  line-height: 1.45;
  color: var(--tinta);
}

.vacio,
.nota {
  margin: 0;
  font-size: var(--text-meta);
  color: var(--tenue);
}

.lista {
  display: grid;
  gap: var(--s-2);
  margin: 0;
  padding: 0;
  list-style: none;
}

.fila {
  display: grid;
  gap: 4px;
  padding: var(--s-2) var(--s-3);
  border: 1px solid var(--borde-suave);
  border-radius: var(--radio);
  background: var(--panel);
}

.fila--tuya {
  border-color: var(--rol-captado);
  background: var(--acento-suave);
}

.fila-cabeza {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: var(--s-2);
}

.nombre {
  font-size: var(--text-meta);
  font-weight: 600;
  color: var(--tinta);
  text-decoration: none;
}

a.nombre {
  padding-block: 0.6rem;
  margin-block: -0.6rem;
}

a.nombre:hover {
  text-decoration: underline;
}

.cifra {
  font-family: var(--font-display);
  font-size: 15px;
  font-weight: 600;
  white-space: nowrap;
}

.meta {
  display: flex;
  flex-wrap: wrap;
  gap: 4px var(--s-2);
  font-size: var(--text-meta);
  color: var(--tenue);
}

.estado[data-estado="operativo"] {
  color: var(--conf-verificado);
  font-weight: 600;
}

.sin-dato {
  font-style: italic;
}

.barra {
  position: relative;
  block-size: 18px;
  border-radius: 4px;
  background: var(--superficie);
  overflow: hidden;
}

.barra-relleno {
  position: absolute;
  inset-block: 0;
  inset-inline-start: 0;
  background: var(--rol-captado);
  transition: inline-size var(--dur-media) var(--ease-salida);
}

.barra--real .barra-relleno {
  background: var(--rol-mar-medio);
}

.barra-texto {
  position: relative;
  padding-inline: 6px;
  font-size: var(--text-meta);
  font-weight: 700;
  line-height: 18px;
  color: var(--tinta);
  mix-blend-mode: normal;
}

.causa summary {
  padding-block: 0.6rem;
  font-size: var(--text-meta);
  font-weight: 600;
  color: var(--aviso-borde);
  cursor: pointer;
}

.causa p {
  margin: 4px 0 0;
  font-size: var(--text-meta);
  line-height: 1.45;
  color: var(--tinta);
}
</style>
