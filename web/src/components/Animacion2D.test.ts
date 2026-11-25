// Pruebas de la animación 2D: física del oleaje dibujado, bucle de la serie,
// reloj y ausencia de valores no finitos en cualquier combinación de mandos.
// Runner nativo de Node (node --test), sin dependencias.

import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";

import { AnimacionCanvas } from "./AnimacionCanvas.ts";
import {
  CampoOleaje2D,
  G,
  GAMMA_ROTURA,
  numeroOndaLocal,
  tramoEstacionario,
} from "./animacion2d/oleaje2d.ts";

// ---- Dobles del entorno -------------------------------------------------------

/** Contexto 2D que acepta cualquier llamada y anota las que reciben un número
 *  no finito: un NaN en el lienzo no da error, simplemente no pinta. */
function contextoVigilante() {
  const malas: string[] = [];
  const estado: Record<string, unknown> = {};
  const gradiente = {
    addColorStop(o: number) {
      if (!Number.isFinite(o) || o < 0 || o > 1) malas.push(`addColorStop(${o})`);
    },
  };
  const ctx = new Proxy(estado, {
    get(obj, prop: string) {
      if (prop in obj) return obj[prop];
      if (prop === "measureText") return (s: string) => ({ width: s.length * 6 });
      return (...args: unknown[]) => {
        for (const a of args) {
          if (typeof a === "number" && !Number.isFinite(a)) {
            malas.push(`${prop}(${args.map(String).join(", ")})`);
            break;
          }
        }
        if (prop === "createLinearGradient" || prop === "createRadialGradient") return gradiente;
        return undefined;
      };
    },
    set(obj, prop: string, valor) {
      if (prop === "globalAlpha" && (typeof valor !== "number" || !Number.isFinite(valor))) {
        malas.push(`globalAlpha=${valor}`);
      }
      obj[prop] = valor;
      return true;
    },
  });
  return { ctx, malas };
}

let ancho = 1200;
let alto = 700;

function lienzo(ctx: unknown) {
  return {
    width: 0,
    height: 0,
    getContext: () => ctx,
    getBoundingClientRect: () => ({ width: ancho, height: alto, left: 0, top: 0, right: ancho, bottom: alto, x: 0, y: 0 }),
  } as unknown as HTMLCanvasElement;
}

const pendientes = new Map<number, (t: number) => void>();
let siguienteId = 1;

function instalarEntorno() {
  const g = globalThis as Record<string, unknown>;
  if (!g.document) g.document = { documentElement: {} };
  g.getComputedStyle = () => ({ getPropertyValue: () => "" });
  g.window = { matchMedia: () => ({ matches: false, addEventListener() {} }), devicePixelRatio: 1 };
  g.requestAnimationFrame = (cb: (t: number) => void) => {
    const id = siguienteId++;
    pendientes.set(id, cb);
    return id;
  };
  g.cancelAnimationFrame = (id: number) => {
    pendientes.delete(id);
  };
}

/** Avanza la animación ejecutando los fotogramas pendientes. */
function fotogramas(n: number, desdeMs: number, pasoMs = 16) {
  let ahora = desdeMs;
  for (let i = 0; i < n; i++) {
    const lote = [...pendientes.entries()];
    pendientes.clear();
    for (const [, cb] of lote) cb(ahora);
    ahora += pasoMs;
  }
  return ahora;
}

/** Serie como la del núcleo: arranque desde reposo con Fe·cos(ω·t). */
function serieConArranque(te: number, dur = 140, dt = 0.035) {
  const w = (2 * Math.PI) / te;
  const t_s: number[] = [];
  const z_m: number[] = [];
  for (let t = 0; t <= dur + 1e-9; t += dt) {
    t_s.push(t);
    // Respuesta en régimen con retraso de fase, modulada por el transitorio.
    z_m.push(0.7 * (1 - Math.exp(-t / 9)) * Math.sin(w * t - 0.4));
  }
  return { t_s, z_m };
}

function payload(extra: Record<string, unknown> = {}) {
  const te = (extra.Te as number) ?? 7;
  const prof = (extra.profundidad_m as number) ?? 30;
  const k = numeroOndaLocal((2 * Math.PI) / te, prof);
  return {
    series: serieConArranque(te),
    k,
    Hm0: 1.5,
    Te: te,
    Bpto: 80_000,
    dispositivo: "absorbedor_puntual",
    profundidad_m: prof,
    ...extra,
  };
}

// ---- Física del oleaje ---------------------------------------------------------

describe("oleaje2d — física de la superficie", () => {
  it("numeroOndaLocal cumple la dispersión y sus dos límites", () => {
    for (const te of [3, 7, 12, 16]) {
      for (const h of [0.5, 5, 30, 200]) {
        const w = (2 * Math.PI) / te;
        const k = numeroOndaLocal(w, h);
        const resto = G * k * Math.tanh(k * h) - w * w;
        assert.ok(Math.abs(resto) < 1e-8, `dispersión no cumplida: Te=${te} h=${h} resto=${resto}`);
      }
    }
    const w = (2 * Math.PI) / 7;
    // Profundo: k → ω²/g. Somero: k → ω/√(g·h).
    assert.ok(Math.abs(numeroOndaLocal(w, 500) / ((w * w) / G) - 1) < 1e-6);
    assert.ok(Math.abs(numeroOndaLocal(w, 0.3) / (w / Math.sqrt(G * 0.3)) - 1) < 0.02);
  });

  it("en el dispositivo el tren principal vale (Hm0/2)·cos(ω·t)", () => {
    const Hm0 = 1.8;
    const Te = 8;
    const campo = new CampoOleaje2D({
      ancho: 900,
      paso: 3,
      mPorPx: 0.15,
      profundidadEn: () => 30,
      profundidadRef: 30,
      Hm0,
      Te,
      escalaPx: 20,
      pxPorMReal: 10,
      xRef: 300,
    });
    const w = (2 * Math.PI) / Te;
    for (const t of [0, 1.3, 4.1, 9.7]) {
      const eta = campo.elevacionPx(300, t, true) / 20;
      // El segundo orden de Stokes añade muy poco en 30 m de agua.
      assert.ok(Math.abs(eta - (Hm0 / 2) * Math.cos(w * t)) < 0.03 * Hm0, `t=${t}: ${eta}`);
    }
  });

  it("la ola se acorta y crece al llegar al somero, y rompe por calado", () => {
    // Fondo que sube linealmente de 30 m a 0 entre 300 y 900 px.
    const prof = (px: number) => (px < 300 ? 30 : Math.max(0, 30 * (1 - (px - 300) / 600)));
    const campo = new CampoOleaje2D({
      ancho: 1000,
      paso: 3,
      mPorPx: 0.2,
      profundidadEn: prof,
      profundidadRef: 30,
      Hm0: 2,
      Te: 9,
      escalaPx: 10,
      pxPorMReal: 20,
      xRef: 100,
    });
    const iProfundo = Math.round(100 / 3);
    const iMedio = Math.round(700 / 3);
    const c = campo.comps[0];
    assert.ok(c.k[iMedio] > c.k[iProfundo], "la longitud de onda no se acorta en el somero");
    assert.ok(c.ks[iMedio] > 1, "no hay asomeramiento");
    // En ninguna columna la altura dibujada supera γ·h.
    for (let i = 0; i < campo.n; i++) {
      let env = 0;
      for (const comp of campo.comps) env += comp.amp * comp.ks[i] * campo.limite[i];
      assert.ok(2 * env <= GAMMA_ROTURA * campo.prof[i] + 1e-9, `H > γh en la columna ${i}`);
    }
    assert.ok(campo.roturaEn(880) > 0, "no hay zona de rompientes junto a la orilla");
    assert.equal(campo.roturaEn(50), 0, "rompe en aguas profundas");
  });
});

describe("oleaje2d — bucle de la serie", () => {
  it("el tramo estacionario deja fuera el arranque y cierra el ciclo", () => {
    const { t_s, z_m } = serieConArranque(7);
    const tramo = tramoEstacionario(t_s, z_m);
    assert.ok(tramo, "no encontró tramo");
    assert.ok(tramo!.ini >= 140 * 0.4, "el tramo incluye el arranque desde reposo");
    const ciclos = (tramo!.fin - tramo!.ini) / 7;
    assert.ok(Math.abs(ciclos - Math.round(ciclos)) < 0.01, `no es un número entero de ciclos: ${ciclos}`);
  });

  it("la boya no salta al dar la vuelta el bucle", () => {
    instalarEntorno();
    const { ctx } = contextoVigilante();
    const anim = new AnimacionCanvas(lienzo(ctx));
    anim.cargarSimulacion(payload());
    const muestrear = (t: number) => (anim as unknown as { muestrearSerie: (t: number) => number }).muestrearSerie(t);
    const tramo = (anim as unknown as { tramo: { ini: number; fin: number } }).tramo;
    const ventana = tramo.fin - tramo.ini;
    for (const vuelta of [1, 2, 5]) {
      const antes = muestrear(vuelta * ventana - 0.02);
      const despues = muestrear(vuelta * ventana + 0.02);
      assert.ok(Math.abs(despues - antes) < 0.05, `salto de ${Math.abs(despues - antes)} m en la vuelta ${vuelta}`);
    }
  });
});

// ---- Reloj y bucle de animación ------------------------------------------------

describe("AnimacionCanvas — reloj y bucle", () => {
  beforeEach(() => {
    pendientes.clear();
    instalarEntorno();
  });

  it("arrancar() repetido no apila bucles", () => {
    const { ctx } = contextoVigilante();
    const anim = new AnimacionCanvas(lienzo(ctx));
    anim.cargarSimulacion(payload());
    anim.arrancar();
    anim.arrancar();
    anim.reanudar();
    anim.arrancar();
    assert.equal(pendientes.size, 1, "hay más de un bucle requestAnimationFrame");
    fotogramas(5, 1000);
    assert.equal(pendientes.size, 1, "el bucle se multiplicó al avanzar");
    anim.pausar();
    assert.equal(pendientes.size, 0, "pausar no detuvo el bucle");
  });

  it("mover un mando o pausar no devuelve el reloj a cero", () => {
    const { ctx } = contextoVigilante();
    const anim = new AnimacionCanvas(lienzo(ctx));
    anim.cargarSimulacion(payload());
    anim.arrancar();
    fotogramas(120, 1000);
    const reloj = () => (anim as unknown as { reloj: number }).reloj;
    const antes = reloj();
    assert.ok(antes > 1.5, `el reloj no avanzó: ${antes}`);
    anim.cargarSimulacion(payload({ Hm0: 2.5 }));
    anim.arrancar();
    assert.ok(reloj() >= antes, "cargar una simulación reinició el reloj");
    anim.pausar();
    anim.reanudar();
    fotogramas(3, 50_000);
    assert.ok(reloj() >= antes, "reanudar reinició el reloj");
    // Un hueco largo entre fotogramas (pestaña oculta) no hace saltar la escena.
    assert.ok(reloj() - antes < 0.5, `el reloj saltó ${reloj() - antes} s tras la pausa`);
  });
});

// ---- Ningún valor no finito en el dibujo ---------------------------------------

describe("AnimacionCanvas — dibujo robusto en todo el rango de mandos", () => {
  beforeEach(() => {
    pendientes.clear();
    instalarEntorno();
  });

  const casos: Record<string, unknown>[] = [];
  for (const dispositivo of ["absorbedor_puntual", "turbina_corriente", "embalse", "owc"]) {
    for (const Hm0 of [0, 0.5, 4]) {
      for (const Te of [3, 16]) {
        for (const profundidad_m of [8, 30, 80]) {
          casos.push({
            dispositivo,
            Hm0,
            Te,
            profundidad_m,
            velocidadCorriente: Hm0 === 0 ? 0 : Hm0 * 1.3,
            rangoMarea: Hm0 === 0 ? 0 : Hm0 * 3.7,
            cantidadUnidades: Hm0 === 4 ? 6 : 1,
            cimentacion: Te === 3 ? "tripode" : profundidad_m === 8 ? "gravedad" : "pilote",
          });
        }
      }
    }
  }

  for (const [modoPrevia, w, h] of [
    [false, 1200, 700],
    [false, 520, 380],
    [true, 300, 170],
  ] as const) {
    it(`sin NaN ni infinitos (${modoPrevia ? "miniatura" : "escena"} ${w}×${h})`, () => {
      ancho = w;
      alto = h;
      for (const caso of casos) {
        const { ctx, malas } = contextoVigilante();
        const anim = new AnimacionCanvas(lienzo(ctx));
        anim.modoPrevia = modoPrevia;
        anim.pie = 0;
        anim.cargarSimulacion(payload(caso));
        for (const t of [0, 0.4, 3.3, 61.7, 300.2]) anim.dibujar(t);
        assert.deepEqual(malas.slice(0, 3), [], `caso ${JSON.stringify(caso)}`);
      }
      ancho = 1200;
      alto = 700;
    });
  }

  it("sin serie tampoco hay valores no finitos y se declara la ausencia", () => {
    const { ctx, malas } = contextoVigilante();
    const anim = new AnimacionCanvas(lienzo(ctx));
    anim.cargarSimulacion({ ...payload(), series: null });
    for (const t of [0, 2.5, 40]) anim.dibujar(t);
    assert.deepEqual(malas, []);
    assert.match(anim.sinSerieMsg, /sin serie de posición/);
  });
});

// ---- Operación del dique ------------------------------------------------------

describe("AnimacionCanvas — operación de doble efecto del dique", () => {
  beforeEach(() => {
    pendientes.clear();
    instalarEntorno();
  });

  it("alterna espera y turbinado; en la espera el embalse no se mueve y el rodete se para", () => {
    const { ctx } = contextoVigilante();
    const anim = new AnimacionCanvas(lienzo(ctx));
    const R = 8;
    anim.cargarSimulacion(payload({ dispositivo: "embalse", modoEnergia: "mareomotriz", rangoMarea: R }));
    const priv = anim as unknown as { embalseM: number; generando: boolean; omegaBulbo: number; apertura: number };
    let esperas = 0;
    let turbinados = 0;
    let rodeteParado = false;
    let embalseAnterior = priv.embalseM;
    let quietoEnEspera = true;
    let min = Infinity;
    let max = -Infinity;
    for (let i = 0; i <= 3000; i++) {
      const t = i * 0.05;
      anim.dibujar(t);
      if (t < 30) {
        embalseAnterior = priv.embalseM;
        continue;
      }
      min = Math.min(min, priv.embalseM);
      max = Math.max(max, priv.embalseM);
      if (priv.generando) turbinados++;
      else {
        esperas++;
        // Con las compuertas ya cerradas, el embalse queda quieto.
        if (priv.apertura < 0.01 && Math.abs(priv.embalseM - embalseAnterior) > 1e-3) quietoEnEspera = false;
        if (Math.abs(priv.omegaBulbo) < 0.05) rodeteParado = true;
      }
      embalseAnterior = priv.embalseM;
    }
    assert.ok(esperas > 0 && turbinados > 0, `sin alternancia: espera ${esperas}, turbinado ${turbinados}`);
    assert.ok(turbinados > esperas, "turbina menos tiempo del que espera");
    assert.ok(quietoEnEspera, "el embalse se mueve con las compuertas cerradas");
    assert.ok(rodeteParado, "el rodete no llega a pararse en la espera");
    assert.ok(min >= -R / 2 - 1e-9 && max <= R / 2 + 1e-9, `embalse fuera de la carrera: ${min}..${max}`);
    const recorrido = (max - min) / R;
    assert.ok(recorrido > 0.5 && recorrido < 0.85, `el embalse recorre ${recorrido} del rango`);
  });
});
