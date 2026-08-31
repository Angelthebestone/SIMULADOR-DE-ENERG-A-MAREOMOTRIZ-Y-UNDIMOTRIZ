import { defineConfig } from "vite";
import type { Connect, Plugin, ViteDevServer } from "vite";
import vue from "@vitejs/plugin-vue";
import fs from "node:fs";
import path from "node:path";

const RAIZ_DATOS = path.resolve(__dirname, "..", "datos");

/**
 * Sirve `datos/` bajo `/datos/`.
 *
 * El repositorio guarda las series en `datos/` (fuera de `web/`), pero ni el
 * `publicDir` por defecto ni ningún alias lo exponían: cada `fetch` de
 * `/datos/catalogo/*.json` y cada tesela `./datos/gee/...` caía en el fallback
 * SPA de Vite y recibía `index.html` con estado 200. El catálogo quedaba vacío
 * y el mapa sin capas, sin un solo error en consola.
 *
 * En `build` se copia a `dist/datos/` sólo lo que la web pide de verdad
 * (JSON, GeoJSON, PMTiles y teselas). Los CSV de `oleaje/`, `mareas/` e
 * `ideam/` son entrada del cálculo en Python y suman ~70 MB que el navegador
 * nunca abre.
 */
const EXTENSIONES_WEB = new Set([".json", ".geojson", ".pmtiles", ".png", ".webp"]);

const TIPOS: Record<string, string> = {
  ".json": "application/json",
  ".geojson": "application/geo+json",
  ".pmtiles": "application/octet-stream",
  ".png": "image/png",
  ".webp": "image/webp",
  ".csv": "text/csv",
};

function copiarDatos(origen: string, destino: string): number {
  let copiados = 0;
  for (const entrada of fs.readdirSync(origen, { withFileTypes: true })) {
    const desde = path.join(origen, entrada.name);
    const hacia = path.join(destino, entrada.name);
    if (entrada.isDirectory()) {
      copiados += copiarDatos(desde, hacia);
    } else if (EXTENSIONES_WEB.has(path.extname(entrada.name).toLowerCase())) {
      fs.mkdirSync(path.dirname(hacia), { recursive: true });
      fs.copyFileSync(desde, hacia);
      copiados += 1;
    }
  }
  return copiados;
}

function datosPlugin(): Plugin {
  return {
    name: "servir-datos",
    configureServer(server: ViteDevServer) {
      server.middlewares.use((req, res, next) => {
        const url = (req.url || "").split("?")[0];
        if (!url.startsWith("/datos/")) return next();

        // Sin `..`: la petición no puede salir de `datos/`.
        const relativa = path.normalize(decodeURIComponent(url.slice("/datos/".length)));
        const archivo = path.join(RAIZ_DATOS, relativa);
        if (!archivo.startsWith(RAIZ_DATOS) || !fs.existsSync(archivo) || !fs.statSync(archivo).isFile()) {
          res.statusCode = 404;
          res.end(`no existe datos/${relativa.replace(/\\/g, "/")}`);
          return;
        }
        res.statusCode = 200;
        res.setHeader("Content-Type", TIPOS[path.extname(archivo).toLowerCase()] || "application/octet-stream");
        fs.createReadStream(archivo).pipe(res);
      });
    },
    closeBundle() {
      if (!fs.existsSync(RAIZ_DATOS)) return;
      const destino = path.resolve(__dirname, "dist", "datos");
      const n = copiarDatos(RAIZ_DATOS, destino);
      this.info?.(`datos: ${n} archivos copiados a dist/datos`);
    },
  };
}

/**
 * Mock de `/api/simular`, `/api/matriz` y `/api/comparar` para el dev server.
 *
 * En producción el cálculo llega por el puente `window.pywebview.api`
 * (`app/carcasa.py`); estos endpoints sólo existen aquí, para que la suite e2e
 * y el desarrollo con `npm run dev` no necesiten levantar Python.
 *
 * La forma del contrato es la de `app/contrato.py::serializar_contrato`:
 * `resultado.eslabones`, `resultado.recurso`, `resultado.series`, `formulas`
 * como triple (latex, texto, unidades). Antes devolvía un contrato recortado
 * sin eslabones ni fórmulas, así que Comparar y Calcular seguían vacíos
 * incluso con el mock respondiendo 200.
 */
const RHO = 1025;
const G = 9.81;

function num(v: number, d: number): string {
  return v.toFixed(d).replace(".", ",");
}

function contratoSimulado(params: Record<string, unknown>) {
  const hm0 = Number(params.hm0_m ?? 1.5);
  const te = Number(params.te_s ?? 7.0);
  const bpto = Number(params.b_pto_ns_m ?? 80_000);
  const profundidad = Number(params.profundidad_m ?? 30);
  const dispositivo = String(params.dispositivo ?? "absorbedor_puntual");
  // Cuatro supuestos editables: η_PTO, η_gen, CRF y ρ. El mock debe
  // propagarlos al resultado para que la UI pueda moverlos y ver el
  // recálculo. Mismas defaults que app/servicio.py::Parametros.
  const etaPtoParam = Number(params.eta_pto ?? 0.65);
  const etaGenParam = Number(params.eta_gen ?? 0.90);
  const crfParam = Number(params.crf ?? 0.08);
  const rhoParam = Number(params.rho ?? RHO);

  // J = rho g^2 Hm0^2 Te / (64 pi) — W por metro de frente de ola
  const j_w_m = (rhoParam * G * G * hm0 * hm0 * te) / (64 * Math.PI);
  const ancho_m = 10;
  const pRecurso = j_w_m * ancho_m;

  // Amortiguamiento óptimo aproximado: la captura cae al alejarse de él.
  const bOptimo = 120_000;
  const desajuste = bpto / bOptimo;
  const etaCaptura = 0.45 * ((2 * desajuste) / (1 + desajuste * desajuste));
  // Los rendimientos del eslabón PTO y eléctrico se reescalan desde el
  // default interno del motor (0,85 y 0,92) hacia los supuestos editables.
  // Mismo patrón que app/servicio.py::_aplicar_rendimientos.
  const etaPtoInterno = 0.85;
  const etaElectricoInterno = 0.92;
  const etaPto = etaPtoInterno * (etaPtoParam / 0.65);
  const etaElectrico = etaElectricoInterno * (etaGenParam / 0.90);

  const pCaptura = pRecurso * etaCaptura;
  const pPto = pCaptura * etaPto;
  const pElectrico = pPto * etaElectrico;

  const eslabones = [
    { nombre: "recurso", potencia_entrada_w: pRecurso, potencia_salida_w: pRecurso, rendimiento: 1, detalle: { j_w_m, ancho_m } },
    { nombre: "captura", potencia_entrada_w: pRecurso, potencia_salida_w: pCaptura, rendimiento: etaCaptura, detalle: { b_pto_ns_m: bpto } },
    { nombre: "pto", potencia_entrada_w: pCaptura, potencia_salida_w: pPto, rendimiento: etaPto, detalle: {} },
    { nombre: "electrico", potencia_entrada_w: pPto, potencia_salida_w: pElectrico, rendimiento: etaElectrico, detalle: {} },
  ];

  const horas = 8760;
  const disponibilidad = 0.92;
  const factorPlanta = 0.28;
  const potenciaNominal = pElectrico;
  const aep = (potenciaNominal / 1000) * horas * disponibilidad * factorPlanta / 1000;

  // Serie de posición de la boya: amplitud menor cuanto más frena el PTO.
  const amplitud = (hm0 / 2) / (1 + bpto / bOptimo);
  const n = 120;
  const t_s = Array.from({ length: n }, (_, i) => (i * te * 2) / n);
  const z_m = t_s.map((t) => amplitud * Math.sin((2 * Math.PI * t) / te));

  const formulas: Record<string, [string, string, string]> = {
    J: [
      "J = \\frac{\\rho g^2 H_{m0}^2 T_e}{64\\pi}",
      `J = ${num(RHO, 0)}*${num(G, 2)}^2*${num(hm0, 2)}^2*${num(te, 2)}/(64*pi) = ${num(j_w_m / 1000, 2)} kW/m`,
      "kW/m",
    ],
    AEP: [
      "AEP = P_{n} \\cdot horas \\cdot disponibilidad \\cdot factor_{planta}",
      `AEP = ${num(potenciaNominal / 1000, 1)} kW * ${horas} h * ${num(disponibilidad, 2)} * ${num(factorPlanta, 3)} = ${num(aep, 1)} MWh/ano`,
      "MWh/ano",
    ],
  };
  for (const e of eslabones.slice(1)) {
    formulas[`eta_${e.nombre}`] = [
      "\\eta = P_{out} / P_{in}",
      `${e.nombre}: ${num(e.potencia_salida_w, 1)} W / ${num(e.potencia_entrada_w, 1)} W = eta ${num(e.rendimiento * 100, 1)} %`,
      "adimensional",
    ];
  }

  const resultado = {
    recurso: { hm0, te, profundidad_m: profundidad, rango_m: 0.4, velocidad_ms: 0 },
    eslabones,
    potencia_nominal_w: potenciaNominal,
    produccion_anual_mwh: aep,
    factor_planta: factorPlanta,
    disponibilidad,
    horas_ano: horas,
    avisos: [],
    series: { t_s, z_m },
    series_meta: { t_s: { forma: [n], dtype: "float64", techo_bytes: 0 }, z_m: { forma: [n], dtype: "float64", techo_bytes: 0 } },
    metadatos: { dispositivo, sitio_id: params.sitio_id ?? "isla_fuerte", completo: false, origen: "mock dev server" },
  };

  return {
    parametros: params,
    resultado,
    series: resultado.series,
    series_meta: resultado.series_meta,
    formulas,
    extras: {
      viviendas: { viviendas: Math.round((aep * 1000) / 1200) },
      panel_sitio: null,
    },
    progreso: 100,
    error: null,
    cancelado: false,
    payload_bytes: 0,
  };
}

function apiMocksPlugin(): Plugin {
  function leerCuerpo(req: Connect.IncomingMessage): Promise<Record<string, unknown>> {
    return new Promise((resolve) => {
      const trozos: Buffer[] = [];
      req.on("data", (c: Buffer) => trozos.push(c));
      req.on("end", () => {
        try {
          resolve(JSON.parse(Buffer.concat(trozos).toString("utf8") || "{}"));
        } catch {
          resolve({});
        }
      });
    });
  }

  function responder(res: any, cuerpo: unknown) {
    res.statusCode = 200;
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify(cuerpo));
  }

  async function handle(req: Connect.IncomingMessage, res: any) {
    const url = req.url || "";

    if (url.startsWith("/api/simular") && req.method === "POST") {
      return responder(res, contratoSimulado(await leerCuerpo(req)));
    }

    if (url.startsWith("/api/comparar") && req.method === "POST") {
      const p = await leerCuerpo(req);
      const a = contratoSimulado({ ...p, dispositivo: p.clave_a });
      const b = contratoSimulado({ ...p, dispositivo: p.clave_b, b_pto_ns_m: Number(p.b_pto_ns_m ?? 80_000) * 1.6 });
      return responder(res, {
        a: a.resultado,
        b: b.resultado,
        recurso: a.resultado.recurso,
        eslabon_que_separa: "captura",
      });
    }

    if (url.startsWith("/api/matriz") && req.method === "POST") {
      // El cliente aborta con AbortController; Node avisa con 'aborted'/'close'.
      let abortado = false;
      req.on("aborted", () => { abortado = true; });
      req.on("close", () => { abortado = true; });
      res.statusCode = 200;
      res.setHeader("Content-Type", "application/json");
      const pasos = [5, 10, 18, 27, 36, 45, 55, 64, 73, 82, 91, 100];
      let i = 0;
      const tick = () => {
        if (abortado || res.writableEnded) return;
        if (i >= pasos.length) {
          res.end(JSON.stringify({
            figura_matriz: {
              data: [{ x: [4, 6, 8, 10], y: [0.5, 1.5, 2.5, 3.5], z: [[1, 2, 3, 2], [2, 5, 8, 5], [3, 8, 14, 9], [3, 9, 16, 10]], type: "heatmap", colorscale: "Blues" }],
              layout: { xaxis: { title: "Te (s)" }, yaxis: { title: "Hs (m)" } },
              detalle: "matriz calculada — 85 celdas Hs x Te",
            },
            progreso: 100,
            cancelado: false,
          }));
          return;
        }
        try { res.write(JSON.stringify({ progreso: pasos[i], parcial: i < pasos.length - 1 }) + "\n"); } catch { return; }
        i += 1;
        setTimeout(tick, 80);
      };
      setTimeout(tick, 30);
      return;
    }

    res.statusCode = 404;
    res.end("{}");
  }

  return {
    name: "api-mocks-matriz-simular",
    configureServer(server: ViteDevServer) {
      server.middlewares.use((req, res, next) => {
        if ((req.url || "").startsWith("/api/")) handle(req, res);
        else next();
      });
    },
  };
}

export default defineConfig({
  plugins: [vue(), datosPlugin(), apiMocksPlugin()],
  resolve: { alias: { vue: "vue/dist/vue.esm-bundler.js" } },
  define: { __VUE_OPTIONS_API__: true, __VUE_PROD_DEVTOOLS__: false },
  // La carcasa abre dist/index.html con file://: las rutas deben ser relativas.
  base: "./",
  build: {
    outDir: "dist",
    emptyOutDir: true,
    cssCodeSplit: false,
  },
  server: {
    port: 5173,
    host: "127.0.0.1",
  },
});
