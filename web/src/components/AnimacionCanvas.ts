// AnimacionCanvas — transfiere series UNA vez por simulación, muestreo sin recalcular física.
// D4/Movimiento: superficie eta(x,t) = (Hm0/2)*cos(k*x - omega*t), omega=2*pi/Te, k de nucleo.olas.numero_onda
// PROFUNDIDAD_M = 30 usada para k y lambda = 2*pi/k. Amplitud boya disminuye si Bpto aumenta (m*z''+b*z'+k*z = F).
// lambda = 2 * Math.PI / k  — 2*Math.PI/k

export const PROFUNDIDAD_M = 30;

type Series = { t_s: number[]; z_m: number[] };

export class AnimacionCanvas {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  series: { t_s: number[]; z_m: number[] } | null = null;
  k: number = 0; // de nucleo.olas.numero_onda
  Hm0: number = 1.5; // m
  Te: number = 7.0; // s
  Bpto: number = 80_000; // Ns/m
  lambda: number = 0; // 2*pi/k
  pausado: boolean = false;
  private rafId: number | null = null;
  private t0: number | null = null;
  private dispositivo = "desconocido";
  private profundidad: number = PROFUNDIDAD_M;
  sinSerieMsg = "";
  private medidas: [number, number] = [0, 0];
  private dpr = 0;
  private ultimoT = 0;
  private observador: ResizeObserver | null = null;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas 2D no disponible");
    this.ctx = ctx;
    // respeta prefers-reduced-motion
    if (typeof window !== "undefined" && window.matchMedia) {
      const m = window.matchMedia("(prefers-reduced-motion: reduce)");
      if (m.matches) this.pausado = true;
      // escuchar cambios
      m.addEventListener?.("change", (e) => {
        if (e.matches) this.pausar();
      });
    }
    this.ajustarDPR();

    // El primer dibujo ocurre antes de que el navegador asiente la maquetación,
    // así que el lienzo se mide estrecho. Mientras hay animación el siguiente
    // fotograma lo corrige solo; en pausa (o con movimiento reducido) no hay
    // siguiente fotograma, de ahí el observador.
    if (typeof ResizeObserver !== "undefined") {
      this.observador = new ResizeObserver(() => {
        if (this.pausado) this.dibujar(this.ultimoT);
      });
      this.observador.observe(canvas);
    }
  }

  /** Devuelve el tamaño CSS actual y reajusta el búfer si ha cambiado.
   *
   * Se llama en cada dibujo, no sólo en el constructor: cuando el canvas se
   * construye antes de que el navegador aplique la maquetación, el rect mide
   * ~1 px y el búfer se quedaba en 2 px de ancho para siempre, así que no se
   * veía nada aunque se dibujara. */
  private ajustarDPR(): [number, number] {
    const rect = this.canvas.getBoundingClientRect();
    const [w, h] = [rect.width, rect.height];
    if (w < 2 || h < 2) return this.medidas;
    const dpr = window.devicePixelRatio || 1;
    // El DPR también cambia (mover la ventana a otro monitor, zoom del
    // navegador), así que entra en la comparación y no sólo el tamaño CSS.
    if (w !== this.medidas[0] || h !== this.medidas[1] || dpr !== this.dpr) {
      this.canvas.width = Math.round(w * dpr);
      this.canvas.height = Math.round(h * dpr);
      this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      this.medidas = [w, h];
      this.dpr = dpr;
    }
    return this.medidas;
  }

  // Contrato: una transferencia por simulación. No llamar por fotograma.
  cargarSimulacion(payload: {
    series: { t_s: number[]; z_m: number[] } | null;
    k: number;
    Hm0: number;
    Te: number;
    Bpto: number;
    dispositivo: string;
    profundidad_m?: number;
  }) {
    this.Hm0 = payload.Hm0;
    this.Te = payload.Te;
    this.Bpto = payload.Bpto;
    this.k = payload.k;
    this.lambda = this.k > 0 ? 2 * Math.PI / this.k : 0;
    this.dispositivo = payload.dispositivo || "desconocido";
    this.profundidad = payload.profundidad_m ?? PROFUNDIDAD_M;

    if (!payload.series || !payload.series.t_s || !payload.series.z_m) {
      this.series = null;
      this.sinSerieMsg = `sin serie de posición — dispositivo ${this.dispositivo}`;
      return;
    }
    // declarar ausencia sin sintetizar: si z_m es null/undefined -> mensaje, sin serie sintética
    const hasT = Array.isArray(payload.series.t_s) && payload.series.t_s.length > 0;
    const hasZ = Array.isArray(payload.series.z_m) && payload.series.z_m.length > 0;
    if (!hasT || !hasZ) {
      this.series = null;
      this.sinSerieMsg = `sin serie de posición — dispositivo ${this.dispositivo}`;
      return;
    }
    this.series = { t_s: [...payload.series.t_s], z_m: [...payload.series.z_m] };
    this.sinSerieMsg = "";
    this.t0 = null;
  }

  // Muestrea serie ya calculada — no recalcula física por fotograma, solo interpola.
  private muestrearSerie(t: number): number | null {
    if (!this.series) return null;
    const { t_s, z_m } = this.series;
    // envolver tiempo de animación sobre duración de serie
    const tDur = t_s[t_s.length - 1] - t_s[0];
    if (tDur <= 0) return z_m[0];
    const tLoop = t_s[0] + (t % tDur);
    // búsqueda lineal binaria simple
    let lo = 0,
      hi = t_s.length - 1;
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      if (tLoop < t_s[mid]) hi = mid;
      else lo = mid;
    }
    const t0 = t_s[lo],
      t1 = t_s[hi],
      z0 = z_m[lo],
      z1 = z_m[hi];
    if (t1 === t0) return z0;
    return z0 + ((z1 - z0) * (tLoop - t0)) / (t1 - t0);
  }

  // J(t) viene de la fórmula J = ρ g² Hm0² Te / (64π); los valores fijos
  // (ρ=1025 kg/m³, g=9.81 m/s²) están en vite.config.ts (mocks) y en
  // app/tesis.py (cálculo real) — aquí se mantiene la misma fórmula para que
  // la cifra mostrada en pantalla coincida con la del servicio.
  private potenciaInstantaneaW(): number {
    const RHO = 1025;
    const G = 9.81;
    return (RHO * G * G * this.Hm0 * this.Hm0 * this.Te) / (64 * Math.PI);
  }

  // Altura visible (px CSS) de la flecha Hm0 sobre el nivel medio.
  alturaFlechaHm0(hLienzo: number): number {
    return Math.max(20, this.Hm0 * (hLienzo * 0.18));
  }

  // Posición horizontal (px CSS) de dos crestas separadas un lambda.
  marcasIntervaloTe(wLienzo: number, dominioM: number): [number, number] {
    if (this.lambda <= 0 || dominioM <= 0) return [0, 0];
    const pxPorM = wLienzo / dominioM;
    const x0 = Math.min(20, wLienzo * 0.15);
    const x1 = x0 + this.lambda * pxPorM;
    return [x0, Math.min(x1, wLienzo - 4)];
  }

  private token(nombre: string, fallback: string): string {
    try {
      const v = getComputedStyle(document.documentElement).getPropertyValue(nombre).trim();
      return v || fallback;
    } catch {
      return fallback;
    }
  }

  // Dibuja un instante t (segundos de animación). No comunica con núcleo.
  dibujar(t: number) {
    this.ultimoT = t;
    const [w, h] = this.ajustarDPR();
    if (w < 2 || h < 2) return;
    const ctx = this.ctx;
    ctx.clearRect(0, 0, w, h);

    // si no hay serie -> declarar ausencia, sin sintetizar
    if (!this.series) {
      ctx.fillStyle = this.token("--tenue", "oklch(0.495 0.017 245)");
      ctx.font = "14px system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(this.sinSerieMsg || `sin serie de posición — dispositivo ${this.dispositivo}`, w / 2, h / 2);
      return;
    }

    const omega = 2 * Math.PI / this.Te; // omega=2*pi/Te
    const k = this.k;
    const Hm0 = this.Hm0;
    // Amplitud boyas implícita en serie: coherente con m*z''+b*z'+k*z = F => a mayor Bpto menor amplitud
    const boyaZ = this.muestrearSerie(t);
    // Dominio espacial: 2 lambda para ver cambio con profundidad
    const dominioM = this.lambda > 0 ? 2 * this.lambda : 120;
    const nivel = h * 0.52;

    // eta(x,t) = (Hm0/2)*cos(k*x - omega*t)
    ctx.beginPath();
    for (let px = 0; px < w; px++) {
      const x = (px / w) * dominioM;
      const eta = (Hm0 / 2) * Math.cos(k * x - omega * t);
      const y = nivel - eta * (h * 0.18); // escala visual arbitraria, no física nueva
      if (px === 0) ctx.moveTo(px, y);
      else ctx.lineTo(px, y);
    }
    ctx.strokeStyle = this.token("--rol-recurso", "oklch(0.532 0.131 244)");
    ctx.lineWidth = 2;
    ctx.stroke();
    // relleno bajo ola
    ctx.lineTo(w, h);
    ctx.lineTo(0, h);
    ctx.closePath();
    ctx.fillStyle = "oklch(0.532 0.131 244 / 0.12)";
    ctx.fill();

    // boyA: posición sale de serie integrada (muestreo), no de eta
    if (boyaZ !== null) {
      const xBoya = this.lambda > 0 ? Math.min(this.lambda, dominioM * 0.5) : dominioM * 0.3;
      const pxBoya = (xBoya / dominioM) * w;
      // dibujar boya en su z muestreadA
      const yBoya = nivel - boyaZ * (h * 0.18);
      ctx.beginPath();
      ctx.arc(pxBoya, yBoya, 9, 0, Math.PI * 2);
      ctx.fillStyle = this.token("--conf-inferido", "oklch(0.638 0.138 070)");
      ctx.fill();
      ctx.strokeStyle = "oklch(0.4 0.08 070)";
      ctx.lineWidth = 1.5;
      ctx.stroke();
      // línea vertical guía
      ctx.beginPath();
      ctx.moveTo(pxBoya, yBoya);
      ctx.lineTo(pxBoya, nivel);
      ctx.strokeStyle = "oklch(0.638 0.138 070 / 0.35)";
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    // rótulo lambda
    ctx.fillStyle = this.token("--tenue", "oklch(0.495 0.017 245)");
    ctx.font = "11px system-ui, sans-serif";
    ctx.textAlign = "left";
    const lambdaTxt = this.lambda ? `λ = 2·π/k = ${this.lambda.toFixed(0)} m` : "";
    ctx.fillText(lambdaTxt, 8, h - 8);

    this.dibujarAnotaciones(ctx, w, h, nivel);
  }

  /** Tres anotaciones físicas en vivo: flecha Hm0, intervalo Te, J(t).
   *  Lee `this.Hm0`, `this.Te` y la serie ya integrada (no recalcula física). */
  private dibujarAnotaciones(
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number,
    nivel: number,
  ) {
    const colorOnda = this.token("--rol-onda", "oklch(0.532 0.131 244)");
    const colorTexto = this.token("--texto-secundario", "oklch(0.495 0.017 245)");
    const colorTenue = this.token("--tenue", "oklch(0.495 0.017 245)");

    const dominioM = this.lambda > 0 ? 2 * this.lambda : 120;

    // (1) Flecha vertical Hm0 a la izquierda del canvas, doble arrowhead.
    const altHm0 = this.alturaFlechaHm0(h);
    const xFlecha = Math.max(18, w * 0.04);
    const yCentro = nivel;
    const yTop = yCentro - altHm0 / 2;
    const yBot = yCentro + altHm0 / 2;
    ctx.strokeStyle = colorOnda;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(xFlecha, yTop);
    ctx.lineTo(xFlecha, yBot);
    ctx.stroke();
    const tamFlecha = 5;
    ctx.beginPath();
    ctx.moveTo(xFlecha - tamFlecha, yTop + tamFlecha);
    ctx.lineTo(xFlecha, yTop);
    ctx.lineTo(xFlecha + tamFlecha, yTop + tamFlecha);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(xFlecha - tamFlecha, yBot - tamFlecha);
    ctx.lineTo(xFlecha, yBot);
    ctx.lineTo(xFlecha + tamFlecha, yBot - tamFlecha);
    ctx.stroke();
    ctx.fillStyle = colorTexto;
    ctx.font = "11px system-ui, sans-serif";
    ctx.textAlign = "right";
    ctx.fillText(`Hm0 = ${this.Hm0.toFixed(1).replace(".", ",")} m`, xFlecha - 8, yCentro + 4);

    // (2) Intervalo Te: dos marcas verticales separadas por `lambda`.
    const [x0, x1] = this.marcasIntervaloTe(w, dominioM);
    if (this.lambda > 0) {
      ctx.strokeStyle = colorTenue;
      ctx.lineWidth = 1;
      const tickTop = nivel - 8;
      const tickBot = nivel + 8;
      ctx.beginPath();
      ctx.moveTo(x0, tickTop);
      ctx.lineTo(x0, tickBot);
      ctx.moveTo(x1, tickTop);
      ctx.lineTo(x1, tickBot);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(x0, nivel);
      ctx.lineTo(x1, nivel);
      ctx.stroke();
      ctx.fillStyle = colorTexto;
      ctx.font = "11px system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(`Te = ${this.Te.toFixed(1).replace(".", ",")} s`, (x0 + x1) / 2, tickTop - 4);
      ctx.textAlign = "left";
    }

    // (3) J(t) en esquina superior derecha (W/m, monoespaciada).
    const jW = this.potenciaInstantaneaW();
    ctx.fillStyle = colorTexto;
    ctx.font = `12px ${this.token("--texto-monoespaciado", "ui-monospace, Consolas, monospace")}`;
    ctx.textAlign = "right";
    ctx.fillText(`J(t) = ${jW.toFixed(0)} W/m`, w - 8, 16);
    ctx.textAlign = "left";
  }

  /** Punto de entrada normal: pinta siempre un fotograma y anima si procede.
   *
   * Respetar `prefers-reduced-motion` significa no mover la ola, no dejar el
   * lienzo en blanco: antes `iniciar()` salía por la primera línea y quien
   * tuviera la preferencia activada no veía absolutamente nada. */
  arrancar() {
    this.dibujar(0);
    this.iniciar();
  }

  iniciar() {
    if (this.pausado) return;
    const loop = (now: number) => {
      if (this.pausado) return;
      if (this.t0 === null) this.t0 = now;
      const t = (now - this.t0) / 1000;
      this.dibujar(t);
      this.rafId = requestAnimationFrame(loop);
    };
    this.rafId = requestAnimationFrame(loop);
  }

  pausar() {
    this.pausado = true;
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }

  reanudar() {
    // `prefers-reduced-motion` fija el valor inicial de `pausado`; pulsar
    // "Reanudar" es una decisión explícita del usuario y manda sobre él.
    // Antes el botón no hacía nada y parecía roto.
    this.pausado = false;
    this.t0 = null;
    this.iniciar();
  }

  detener() {
    this.pausar();
    this.observador?.disconnect();
    this.observador = null;
  }
}
