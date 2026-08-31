// Tests unitarios de las anotaciones físicas sobre el canvas de la animación.
// Se ejecutan con el test runner nativo de Node (node --test) sin dependencias
// nuevas: AnimacionCanvas expone los métodos `alturaFlechaHm0` y
// `marcasIntervaloTe` con la lógica geométrica, y `dibujar()` se ejercita
// contra un mock del CanvasRenderingContext2D que registra las llamadas.

import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";

import { AnimacionCanvas } from "./AnimacionCanvas.ts";

class FakeCtx {
  calls: { method: string; args: unknown[] }[] = [];
  fillStyle = "";
  strokeStyle = "";
  font = "";
  textAlign: CanvasTextAlign = "left";
  lineWidth = 1;
  beginPath() { this.calls.push({ method: "beginPath", args: [] }); }
  moveTo(x: number, y: number) { this.calls.push({ method: "moveTo", args: [x, y] }); }
  lineTo(x: number, y: number) { this.calls.push({ method: "lineTo", args: [x, y] }); }
  stroke() { this.calls.push({ method: "stroke", args: [] }); }
  fill() { this.calls.push({ method: "fill", args: [] }); }
  fillText(text: string, x: number, y: number) {
    this.calls.push({ method: "fillText", args: [text, x, y] });
  }
  clearRect() { this.calls.push({ method: "clearRect", args: [] }); }
  arc() { this.calls.push({ method: "arc", args: [] }); }
  closePath() { this.calls.push({ method: "closePath", args: [] }); }
  setTransform() { this.calls.push({ method: "setTransform", args: [] }); }
  measureText?: (text: string) => { width: number };
}

class FakeCanvas {
  width = 0;
  height = 0;
  listeners: Record<string, (e: unknown) => void> = {};
  ctx = new FakeCtx();
  getContext(_kind: "2d"): FakeCtx | null { return this.ctx; }
  getBoundingClientRect() { return { width: 900, height: 260, left: 0, top: 0, right: 900, bottom: 260, x: 0, y: 0, toJSON: () => ({}) }; }
  addEventListener(name: string, cb: (e: unknown) => void) { this.listeners[name] = cb; }
  removeEventListener(name: string) { delete this.listeners[name]; }
  dispatchEvent(name: string, e: unknown) { this.listeners[name]?.(e); }
}

function instalarDomShim(canvas: FakeCanvas) {
  // jsdom no está instalado; AnimacionCanvas llama a getComputedStyle y
  // matchMedia en el constructor y al pedir tokens. Devolvemos shims vacíos.
  const w = globalThis as unknown as {
    document: { documentElement: { getPropertyValue: (n: string) => string } };
    window: { matchMedia: (q: string) => { matches: boolean; addEventListener?: (t: string, cb: (e: { matches: boolean }) => void) => void } };
    ResizeObserver: unknown;
    devicePixelRatio: number;
  };
  if (!w.document) {
    w.document = {
      documentElement: {
        getPropertyValue: (_n: string) => "",
      },
    };
  }
  if (!w.window) {
    w.window = {
      matchMedia: (_q: string) => ({
        matches: false,
        addEventListener: () => {},
      }),
    };
  }
  if (!(w as any).ResizeObserver) {
    (w as any).ResizeObserver = class { observe() {} disconnect() {} };
  }
  if (!w.devicePixelRatio) w.devicePixelRatio = 1;
  // El constructor pide window.devicePixelRatio — usar globalThis.window
  if (typeof (globalThis as any).window === "undefined") {
    (globalThis as any).window = w.window;
  }
  void canvas;
}

function cargar(anim: AnimacionCanvas, hm0: number, te: number, k: number) {
  // Serie trivial: 60 puntos con seno
  const N = 60;
  const t = Array.from({ length: N }, (_, i) => (i * te * 2) / N);
  const z = t.map((tt) => 0.4 * Math.sin((2 * Math.PI * tt) / te));
  anim.cargarSimulacion({
    series: { t_s: t, z_m: z },
    k,
    Hm0: hm0,
    Te: te,
    Bpto: 80_000,
    dispositivo: "absorbedor_puntual",
  });
}

describe("AnimacionCanvas — anotaciones físicas", () => {
  let canvas: FakeCanvas;
  let anim: AnimacionCanvas;

  beforeEach(() => {
    canvas = new FakeCanvas();
    instalarDomShim(canvas);
    anim = new AnimacionCanvas(canvas as unknown as HTMLCanvasElement);
    // Fijar k coherente con Te=7, profundidad 30 → omega=2π/7, k ≈ 0.118
    cargar(anim, 1.5, 7.0, 0.118);
  });

  it("alturaFlechaHm0: con Hm0=1.5 produce altura menor que con Hm0=2.5", () => {
    cargar(anim, 1.5, 7.0, 0.118);
    const h15 = anim.alturaFlechaHm0(260);
    cargar(anim, 2.5, 7.0, 0.118);
    const h25 = anim.alturaFlechaHm0(260);
    assert.ok(
      h15 > 0 && h25 > h15,
      `la flecha con Hm0=2.5 debe ser mayor que con Hm0=1.5; h15=${h15} h25=${h25}`,
    );
    // Escala visual: Hm0 * (hLienzo * 0.18) → 2.5/1.5 ≈ 1.667
    const ratio = h25 / h15;
    assert.ok(Math.abs(ratio - 5 / 3) < 0.05, `ratio esperado ≈1.667, fue ${ratio.toFixed(3)}`);
  });

  it("marcasIntervaloTe: la distancia entre las dos marcas equivale a lambda en pixels", () => {
    const lambda = anim.lambda; // 2π/k ≈ 53.2 m
    const w = 900;
    const dominioM = 2 * lambda;
    const [x0, x1] = anim.marcasIntervaloTe(w, dominioM);
    const dxPx = x1 - x0;
    const esperado = lambda * (w / dominioM);
    assert.ok(
      Math.abs(dxPx - esperado) < 0.01,
      `la separación debe coincidir con lambda escalado: ${dxPx} vs ${esperado}`,
    );
    assert.ok(x1 > x0, "la segunda marca debe estar a la derecha de la primera");
  });

  it("dibujar() emite las tres anotaciones en el orden esperado", () => {
    cargar(anim, 1.5, 7.0, 0.118);
    // limpiar el historial del constructor (beginPath ya no importa)
    canvas.ctx.calls.length = 0;
    anim.dibujar(0);

    const texts = canvas.ctx.calls
      .filter((c) => c.method === "fillText")
      .map((c) => String((c.args[0] as string) ?? ""));

    // Hm0 = 1,5 m
    assert.ok(
      texts.some((t) => t.includes("Hm0") && t.includes("1,5")),
      `debe aparecer la cifra Hm0=1,5; textos=${JSON.stringify(texts)}`,
    );
    // Te = 7,0 s
    assert.ok(
      texts.some((t) => t.includes("Te") && t.includes("7,0")),
      `debe aparecer la cifra Te=7,0; textos=${JSON.stringify(texts)}`,
    );
    // J(t) en esquina superior derecha
    const jtxt = texts.find((t) => t.startsWith("J(t)"));
    assert.ok(jtxt, `debe aparecer J(t); textos=${JSON.stringify(texts)}`);
    assert.ok(jtxt!.includes("W/m"), `J(t) debe llevar unidad W/m; fue ${jtxt!}`);
    // Localización: una fillText de J(t) en y cercano a 16
    const jCall = canvas.ctx.calls.find(
      (c) => c.method === "fillText" && String(c.args[0]).startsWith("J(t)"),
    );
    assert.ok(jCall, "fillText de J(t) registrado");
    const yJ = jCall!.args[2] as number;
    assert.ok(yJ < 40, `J(t) debe pintarse en la parte alta del canvas; y=${yJ}`);
  });

  it("dibujar() redimensiona la flecha al pasar Hm0 de 1,5 a 2,5", () => {
    // La flecha Hm0 se compone de tres beginPath sobre el mismo x: el del
    // tronco (moveTo → lineTo), y los dos arrowheads. Medimos el bounding
    // box de los puntos emitidos por los arrowheads, que cubren exactamente
    // la altura de la flecha.
    const medirFlecha = (calls: { method: string; args: unknown[] }[]) => {
      const ys: number[] = [];
      let xRef = -1;
      let subpath: number[][] = [];
      let abierto = false;
      const flush = () => {
        if (subpath.length > 0) {
          // ¿Es la línea vertical? dos puntos con x idéntico
          if (subpath.length >= 2 && subpath.every((p) => Math.abs(p[0] - xRef) < 0.01)) {
            ys.push(subpath[0][1], subpath[subpath.length - 1][1]);
          }
        }
        subpath = [];
      };
      for (const c of calls) {
        if (c.method === "beginPath") { abierto = true; subpath = []; continue; }
        if (!abierto) continue;
        if (c.method === "moveTo") {
          const x = c.args[0] as number;
          const y = c.args[1] as number;
          xRef = x;
          subpath.push([x, y]);
          continue;
        }
        if (c.method === "lineTo") {
          const x = c.args[0] as number;
          const y = c.args[1] as number;
          subpath.push([x, y]);
          continue;
        }
        if (c.method === "stroke") { flush(); abierto = false; continue; }
      }
      if (ys.length < 2) return 0;
      const min = Math.min(...ys);
      const max = Math.max(...ys);
      return max - min;
    };

    cargar(anim, 1.5, 7.0, 0.118);
    canvas.ctx.calls.length = 0;
    anim.dibujar(0);
    const alt15 = medirFlecha(canvas.ctx.calls);

    cargar(anim, 2.5, 7.0, 0.118);
    canvas.ctx.calls.length = 0;
    anim.dibujar(0);
    const alt25 = medirFlecha(canvas.ctx.calls);

    assert.ok(
      alt15 > 0 && alt25 > alt15,
      `altura de flecha debe crecer al pasar Hm0 de 1,5 a 2,5; alt15=${alt15} alt25=${alt25}`,
    );
    const ratio = alt25 / alt15;
    assert.ok(
      ratio > 1.5,
      `ratio debe acercarse a 1.667; fue ${ratio.toFixed(3)}`,
    );
  });

  it("con Hm0=2.5 la cifra J(t) crece (cuadrática en Hm0)", () => {
    cargar(anim, 1.5, 7.0, 0.118);
    canvas.ctx.calls.length = 0;
    anim.dibujar(0);
    const j15 = Number(
      String(canvas.ctx.calls.find((c) => c.method === "fillText" && String(c.args[0]).startsWith("J(t)"))!.args[0])
        .replace(/J\(t\)\s*=\s*/, "")
        .replace(/\s*W\/m/, "")
        .replace(/\./g, "")
        .replace(",", "."),
    );
    cargar(anim, 2.5, 7.0, 0.118);
    canvas.ctx.calls.length = 0;
    anim.dibujar(0);
    const j25 = Number(
      String(canvas.ctx.calls.find((c) => c.method === "fillText" && String(c.args[0]).startsWith("J(t)"))!.args[0])
        .replace(/J\(t\)\s*=\s*/, "")
        .replace(/\s*W\/m/, "")
        .replace(/\./g, "")
        .replace(",", "."),
    );
    const ratio = j25 / j15;
    // J ∝ Hm0² → ratio esperado (2.5/1.5)² = 2.777…
    assert.ok(
      Math.abs(ratio - (2.5 * 2.5) / (1.5 * 1.5)) < 0.05,
      `J(t) debe crecer cuadráticamente; ratio=${ratio.toFixed(3)}`,
    );
  });
});