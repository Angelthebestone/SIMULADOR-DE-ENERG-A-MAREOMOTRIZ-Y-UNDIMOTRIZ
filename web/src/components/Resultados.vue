<template>
  <aside class="resultados" aria-labelledby="titulo-resultados">
    <header class="cabeza">
      <h2 id="titulo-resultados">Resultado</h2>
      <span v-if="cargando" class="calculando">
        <Icono icono="calculando" tamano="sm" />
        <span>calculando…</span>
      </span>
    </header>

    <div class="lectura" role="status" aria-live="polite" data-testid="barra-kpis">
      <div
        v-for="k in kpis"
        :key="k.id"
        class="kpi"
        :data-testid="'kpi-' + k.id"
        :data-estado="k.pendiente ? 'pendiente' : 'ok'"
      >
        <span class="kpi-etiqueta">{{ k.etiqueta }}</span>
        <span v-if="cargando && !resultado" class="kpi-esqueleto" aria-hidden="true"></span>
        <span v-else-if="k.pendiente" class="kpi-pendiente semaforo semaforo--pendiente">
          <Icono icono="pendiente" tamano="sm" />
          <span>pendiente</span>
        </span>
        <span v-else class="kpi-valor">{{ k.valor }} <small class="kpi-unidad">{{ k.unidad }}</small></span>
      </div>
    </div>

    <p v-if="error" class="aviso aviso--error" data-testid="aviso-error">
      <Icono icono="error" tamano="sm" />
      <span>{{ error }}</span>
    </p>

    <section v-if="cadena.length" class="cadena" aria-labelledby="titulo-cadena">
      <h3 id="titulo-cadena" class="rotulo">Qué se queda en el camino</h3>
      <ol class="cadena-lista">
        <li v-for="e in cadena" :key="e.nombre" class="eslabon">
          <span class="eslabon-nombre">{{ e.nombre }}</span>
          <span class="eslabon-barra" aria-hidden="true">
            <span class="eslabon-relleno" :data-rol="e.rol" :style="{ inlineSize: e.ancho }"></span>
          </span>
          <span class="eslabon-cifra">{{ e.potencia }}</span>
          <span class="eslabon-pct">{{ e.pct }}</span>
        </li>
      </ol>
    </section>

    <ul v-if="avisos.length" class="avisos" aria-label="Avisos del modelo">
      <li v-for="(a, i) in avisos" :key="i">
        <Icono icono="error" tamano="sm" />
        <span>{{ a }}</span>
      </li>
    </ul>

    <article class="viviendas" data-testid="tarjeta-viviendas" aria-live="polite">
      <Icono icono="vivienda" tamano="sm" />
      <template v-if="viviendas !== null">
        <span>Alcanza para <strong>{{ formatearNumero(viviendas, 0) }} viviendas</strong></span>
        <span class="viviendas-co2">· {{ formatearNumero(viviendas * 1.8, 1) }} t CO₂ evitadas al año</span>
      </template>
      <span v-else-if="cargando">integrando la cadena…</span>
      <span v-else class="semaforo semaforo--pendiente">
        viviendas: pendiente — {{ error || "consumo residencial sin fuente verificada" }}
      </span>
    </article>

    <ComparaPlantas
      v-if="resultado"
      :dispositivo="params.dispositivo"
      :potencia-w="num(resultado.potencia_nominal_w)"
      :aep-mwh="num(resultado.produccion_anual_mwh)"
      :factor-planta="num(resultado.factor_planta)"
    />
  </aside>
</template>

<script setup lang="ts">
import { computed } from "vue";
import Icono from "./Icono.vue";
import ComparaPlantas from "./ComparaPlantas.vue";
import type { Params } from "../api";
import { formatearNumero, partesEnergiaAnual, partesPotencia, textoPotencia } from "../utils/formato";

const props = defineProps<{
  params: Params;
  resultado: Record<string, any> | null;
  viviendas: number | null;
  cargando?: boolean;
  error?: string;
}>();

function num(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : NaN;
}

/** El recurso se mide distinto en cada obra: la ola en kW por metro de frente,
 *  la corriente en m/s y la marea del dique en metros de rango. */
const recurso = computed(() => {
  const r = props.resultado;
  const d = props.params.dispositivo;
  if (d === "turbina_corriente") return { valor: num(r?.recurso?.velocidad_ms), unidad: "m/s", dec: 2, etiqueta: "Corriente" };
  if (d === "embalse") return { valor: num(r?.recurso?.rango_m), unidad: "m", dec: 1, etiqueta: "Rango de marea" };
  return { valor: num(r?.eslabones?.[0]?.detalle?.j_w_m) / 1000, unidad: "kW/m", dec: 1, etiqueta: "Recurso" };
});

const kpis = computed(() => {
  const r = props.resultado;
  const pot = partesPotencia(num(r?.potencia_nominal_w));
  const aep = partesEnergiaAnual(num(r?.produccion_anual_mwh));
  const fp = num(r?.factor_planta) * 100;
  const rec = recurso.value;
  return [
    { id: "recurso", etiqueta: rec.etiqueta, valor: Number.isFinite(rec.valor) ? formatearNumero(rec.valor, rec.dec) : "", unidad: rec.unidad, pendiente: !Number.isFinite(rec.valor) },
    { id: "potencia", etiqueta: "Potencia nominal", valor: pot.valor, unidad: pot.unidad, pendiente: !pot.valor },
    { id: "anual", etiqueta: "Producción anual", valor: aep.valor, unidad: aep.unidad, pendiente: !aep.valor },
    { id: "factor", etiqueta: "Factor de planta", valor: Number.isFinite(fp) ? formatearNumero(fp, 1) : "", unidad: "%", pendiente: !Number.isFinite(fp) },
  ];
});

const NOMBRES: Record<string, string> = {
  recurso: "Llega del mar",
  captura: "Captura",
  pto: "Toma de fuerza",
  generador: "Generador",
  electrico: "Generador",
};

/** Potencia que sobrevive a cada eslabón, como fracción de lo que trae el mar. */
const cadena = computed(() => {
  const es = (props.resultado?.eslabones ?? []) as Array<Record<string, any>>;
  if (!es.length) return [];
  const base = num(es[0].potencia_entrada_w);
  if (!(base > 0)) return [];
  const filas = [{ nombre: NOMBRES.recurso, w: base, rol: "recurso" }];
  for (const e of es) {
    if (e.nombre === "recurso") continue;
    filas.push({ nombre: NOMBRES[e.nombre] ?? e.nombre, w: num(e.potencia_salida_w), rol: "captado" });
  }
  return filas.map((f) => ({
    nombre: f.nombre,
    rol: f.rol,
    potencia: textoPotencia(f.w),
    pct: `${formatearNumero((f.w / base) * 100, f.w / base < 0.1 ? 1 : 0)} %`,
    ancho: `${Math.max(0.5, (f.w / base) * 100)}%`,
  }));
});

const avisos = computed(() => {
  const a = props.resultado?.avisos;
  return Array.isArray(a) ? a.map(String).filter((s) => s.length > 0) : [];
});
</script>

<style scoped>
.resultados {
  display: flex;
  flex-direction: column;
  gap: var(--s-4);
  min-block-size: 0;
  padding: var(--s-4);
  overflow-y: auto;
  background: var(--panel);
  border-inline-start: 1px solid var(--borde-suave);
}

.resultados > * {
  flex: none;
}

.cabeza {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--s-2);
}

.cabeza h2 {
  margin: 0;
  font-size: var(--text-seccion);
  font-weight: 700;
}

.calculando {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: var(--text-meta);
  color: var(--tenue);
}

.lectura {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1px;
  overflow: hidden;
  border-radius: var(--radio-caja);
  background: var(--marco-linea);
}

.kpi {
  display: grid;
  align-content: start;
  gap: 2px;
  min-inline-size: 0;
  padding: var(--s-3);
  background: var(--marco);
  color: var(--marco-tinta);
}

.kpi-etiqueta {
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--marco-tenue);
}

.kpi-valor {
  font-family: var(--font-display);
  font-size: var(--text-kpi);
  font-weight: 600;
  line-height: 1.05;
  letter-spacing: -0.02em;
  white-space: nowrap;
}

.kpi-unidad {
  font-family: var(--font-sans);
  font-size: 0.42em;
  font-weight: 600;
  letter-spacing: 0;
  color: var(--marco-tenue);
}

[data-testid="kpi-recurso"] .kpi-valor {
  color: var(--marco-recurso);
}

[data-testid="kpi-anual"] .kpi-valor {
  color: var(--marco-captado);
}

.kpi-pendiente {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: var(--text-meta);
  font-style: italic;
  color: var(--marco-tenue);
}

.kpi-esqueleto {
  display: block;
  inline-size: 5rem;
  block-size: calc(var(--text-kpi) * 1.05);
  border-radius: var(--radio);
  background: var(--marco-linea);
  animation: latido 1.4s linear infinite alternate;
}

@keyframes latido {
  from { opacity: 0.45; }
  to { opacity: 0.9; }
}

.aviso {
  display: flex;
  align-items: center;
  gap: 6px;
  margin: 0;
  padding: var(--s-2) var(--s-3);
  border: 1px solid var(--aviso-error-borde);
  border-radius: var(--radio);
  background: var(--aviso-error-fondo);
  font-size: var(--text-meta);
  font-weight: 600;
}

.rotulo {
  margin: 0 0 var(--s-2);
  font-family: var(--font-sans);
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--tenue);
}

.cadena-lista {
  display: grid;
  gap: 6px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.eslabon {
  display: grid;
  grid-template-columns: 7.5rem minmax(0, 1fr) 4.6rem 3.2rem;
  align-items: center;
  gap: var(--s-2);
  font-size: var(--text-meta);
}

.eslabon-nombre {
  color: var(--tinta);
  white-space: nowrap;
}

.eslabon-barra {
  block-size: 10px;
  border-radius: 5px;
  background: var(--superficie);
  overflow: hidden;
}

.eslabon-relleno {
  display: block;
  block-size: 100%;
  border-radius: 5px;
  background: var(--rol-captado);
  transition: inline-size var(--dur-media) var(--ease-salida);
}

.eslabon-relleno[data-rol="recurso"] {
  background: var(--rol-mar-medio);
}

.eslabon-cifra {
  text-align: end;
  white-space: nowrap;
  color: var(--tenue);
}

.eslabon-pct {
  text-align: end;
  font-weight: 700;
}

.avisos {
  display: grid;
  gap: 6px;
  margin: 0;
  padding: var(--s-2) var(--s-3);
  border-inline-start: 3px solid var(--aviso-borde);
  border-radius: var(--radio);
  background: var(--aviso-fondo);
  list-style: none;
  font-size: 11px;
  line-height: 1.45;
}

.avisos li {
  display: flex;
  gap: 6px;
  align-items: flex-start;
}

.viviendas {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
  margin: 0;
  font-size: var(--text-meta);
  color: var(--tinta);
}

.viviendas-co2 {
  color: var(--tenue);
}
</style>
