// Granja de turbinas de corriente mareal — capa 2D.
// Alineada con mareomotriz_granja_turbinas_corriente.jpg y animacion3d/escenas/granja.ts:
// torreta con embudo sobre el agua, baliza roja/blanca, pilar metálico,
// cimentación (gravedad, pilote o trípode), rotor tripala ROJO con puntas
// NARANJAS y lecho arenoso.
//
// El corte es lateral y la corriente va de izquierda a derecha, así que el eje
// del rotor está en el plano del dibujo: el rotor no se ve de frente sino de
// canto. Cada pala se proyecta desde su posición 3D (radio, torsión y cuerda),
// con una ligera vista oblicua: cuando apunta hacia arriba se ve fina, cuando
// apunta hacia quien mira se ve su planta. Las palas de detrás se dibujan
// antes que la góndola y las de delante después.
// Autocontenida: sin estado de AnimacionCanvas.

export type Cimentacion2D = "pilote" | "gravedad" | "tripode";

export interface OptsGranja2D {
  /** Centro horizontal de la unidad principal. */
  x: number;
  /** Nivel medio del mar (píxeles, y crece hacia abajo). */
  ySuperficie: number;
  /** Lecho / cota de apoyo (píxeles). */
  yFondo: number;
  /** Tiempo de animación en segundos. */
  t: number;
  /** Corriente en m/s — regula el giro del rotor. */
  velocidadCorriente: number;
  /** Ángulo del rotor (rad) ya integrado en el tiempo. Si falta, se deriva de `t`. */
  giro?: number;
  /** Unidades de la granja (1–6). La principal va en `x`. */
  cantidadUnidades?: number;
  /** Tipo de cimentación (por defecto gravedad, como la referencia). */
  cimentacion?: Cimentacion2D;
  /** Omite el chip del nombre (previstas de la pantalla de tecnología). */
  sinRotulo?: boolean;
  /** Ancho disponible para repartir las unidades (px). */
  anchoDisponible?: number;
  /** Superficie instantánea: la torreta marca la ola que pasa de verdad. */
  superficieY?: (px: number) => number;
}

export interface UnidadGranja {
  /** Eje de la torre. */
  x: number;
  /** Centro del buje. */
  xBuje: number;
  yRotor: number;
  /** Radio de pala en píxeles. */
  radio: number;
  /** Escala de la unidad (1 delante, menor detrás). */
  escala: number;
  /** 0 = primer plano, 1 = fondo. */
  lejania: number;
  yBase: number;
  orden: number;
}

type RGB = [number, number, number];

/** Paleta alineada con la escena 3D y el manual UTS. */
const P: Record<string, RGB> = {
  metalAlto: [226, 231, 235],
  metal: [197, 204, 210],
  metalBajo: [138, 147, 155],
  metalSombra: [84, 93, 102],
  base: [110, 120, 128],
  baseOscura: [70, 79, 86],
  rojoPala: [212, 31, 31],
  rojoPalaOsc: [140, 18, 18],
  naranjaPala: [240, 154, 24],
  balizaRojo: [224, 48, 48],
  balizaBlanco: [244, 244, 244],
  cable: [26, 34, 40],
  acento: [199, 225, 74],
  escollera: [112, 116, 112],
};
/** Tono al que tiende lo lejano: agua turbia bajo la lámina. */
const NIEBLA: RGB = [70, 118, 112];

function color(c: RGB, lejania: number, alfa = 1): string {
  const f = Math.max(0, Math.min(1, lejania)) * 0.45;
  const r = Math.round(c[0] + (NIEBLA[0] - c[0]) * f);
  const g = Math.round(c[1] + (NIEBLA[1] - c[1]) * f);
  const b = Math.round(c[2] + (NIEBLA[2] - c[2]) * f);
  return alfa >= 1 ? `rgb(${r} ${g} ${b})` : `rgba(${r},${g},${b},${alfa})`;
}

/** Velocidad específica de punta y radio real del rotor de referencia. */
export const TSR = 4.5;
export const RADIO_ROTOR_M = 10;

/** Reparto de la granja: dónde va cada unidad, a qué escala y su rotor. Lo
 *  publica el módulo para que la escena dibuje la estela sin adivinar. */
export function disposicionGranja(opts: OptsGranja2D): UnidadGranja[] {
  const { x, ySuperficie, yFondo } = opts;
  const n = Math.max(1, Math.min(6, Math.floor(opts.cantidadUnidades ?? 1) || 1));
  const calado = Math.max(1, yFondo - ySuperficie);
  // El rotor ocupa ~60 % del calado, como un rotor de 20 m en 33 m de agua.
  const radio = Math.max(16, Math.min(56, calado * 0.3));
  const yRotor = ySuperficie + calado * 0.55;
  // Las unidades se separan lo bastante para que los rotores no se pisen.
  const escalaFondo = 0.74;
  const paso = Math.max(radio * 2.35, 70);
  const disponible = opts.anchoDisponible ?? Infinity;
  const anchoTotal = (n - 1) * paso;
  const paso2 = anchoTotal > disponible && n > 1 ? Math.max(radio * 1.6, disponible / (n - 1)) : paso;
  const unidades: UnidadGranja[] = [];
  // La principal delante; las demás en filas alternas detrás, a ambos lados.
  const posiciones: number[] = [0];
  for (let i = 1; i < n; i++) {
    const lado = i % 2 === 1 ? -1 : 1;
    posiciones.push(lado * Math.ceil(i / 2) * paso2);
  }
  posiciones.forEach((dx, i) => {
    const lejania = i === 0 ? 0 : 1;
    const s = i === 0 ? 1 : escalaFondo;
    // Las de detrás apoyan un poco más arriba: están más lejos.
    const yBase = yFondo - (i === 0 ? 0 : 7);
    const r = radio * s;
    const yR = yBase - (yFondo - yRotor) * s;
    unidades.push({
      x: x + dx,
      xBuje: x + dx - 26 * s,
      yRotor: yR,
      radio: r,
      escala: s,
      lejania,
      yBase,
      orden: i,
    });
  });
  return unidades;
}

function destelloBaliza(t: number): boolean {
  return Math.sin(t * 3) > 0.4;
}

/** Cimentación de la unidad, ya escalada. */
function dibujarCimentacion(
  ctx: CanvasRenderingContext2D,
  u: UnidadGranja,
  tipo: Cimentacion2D
): number {
  const { x, yBase: y, escala: s, lejania: l } = u;
  // Sombra en el lecho.
  ctx.fillStyle = `rgba(20,28,32,${0.26 * (1 - l * 0.5)})`;
  ctx.beginPath();
  ctx.ellipse(x + 4 * s, y + 4, 44 * s, 6 * s, 0, 0, Math.PI * 2);
  ctx.fill();

  if (tipo === "gravedad") {
    const g = ctx.createLinearGradient(0, y - 26 * s, 0, y + 2);
    g.addColorStop(0, color(P.base, l));
    g.addColorStop(1, color(P.baseOscura, l));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(x - 40 * s, y + 1);
    ctx.lineTo(x - 31 * s, y - 24 * s);
    ctx.lineTo(x + 31 * s, y - 24 * s);
    ctx.lineTo(x + 40 * s, y + 1);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = color(P.baseOscura, l, 0.8);
    ctx.lineWidth = 1.2;
    ctx.stroke();
    ctx.fillStyle = color(P.base, l);
    ctx.beginPath();
    ctx.ellipse(x, y - 24 * s, 31 * s, 5.5 * s, 0, 0, Math.PI * 2);
    ctx.fill();
    // Bloques de lastre en la corona.
    ctx.fillStyle = color(P.metalSombra, l);
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 + 0.3;
      ctx.beginPath();
      ctx.ellipse(x + Math.cos(a) * 24 * s, y - 24 * s + Math.sin(a) * 3.5 * s, 5 * s, 2.4 * s, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    return y - 22 * s;
  }

  if (tipo === "tripode") {
    ctx.strokeStyle = color(P.baseOscura, l);
    ctx.lineCap = "round";
    ctx.lineWidth = 5 * s;
    const yNodo = y - 52 * s;
    ctx.beginPath();
    ctx.moveTo(x, yNodo);
    ctx.lineTo(x - 40 * s, y - 3);
    ctx.moveTo(x, yNodo);
    ctx.lineTo(x + 40 * s, y - 3);
    ctx.stroke();
    // Pata trasera, más fina: está detrás.
    ctx.lineWidth = 3.5 * s;
    ctx.strokeStyle = color(P.metalSombra, l + 0.3);
    ctx.beginPath();
    ctx.moveTo(x, yNodo);
    ctx.lineTo(x + 8 * s, y - 6);
    ctx.stroke();
    ctx.lineCap = "butt";
    // Pilotes de anclaje en cada pie.
    ctx.fillStyle = color(P.base, l);
    for (const dx of [-40, 40]) {
      ctx.fillRect(x + dx * s - 5 * s, y - 8 * s, 10 * s, 10 * s);
    }
    return yNodo;
  }

  // Monopilote hincado con escollera de protección contra la socavación.
  ctx.fillStyle = color(P.escollera, l);
  for (let i = 0; i < 9; i++) {
    const rx = x + (i - 4) * 7.5 * s;
    const ry = y - 2 - (4 - Math.abs(i - 4)) * 1.4 * s;
    ctx.beginPath();
    ctx.ellipse(rx, ry, 5.5 * s, 3.4 * s, (i * 0.7) % 1, 0, Math.PI * 2);
    ctx.fill();
  }
  return y - 2;
}

/** Pilar metálico con degradado cilíndrico y bridas. */
function dibujarPilar(ctx: CanvasRenderingContext2D, u: UnidadGranja, yCorona: number, yPie: number) {
  const { x, escala: s, lejania: l } = u;
  const ancho = 10 * s;
  const g = ctx.createLinearGradient(x - ancho, 0, x + ancho, 0);
  g.addColorStop(0, color(P.metalSombra, l));
  g.addColorStop(0.3, color(P.metalAlto, l));
  g.addColorStop(0.6, color(P.metal, l));
  g.addColorStop(1, color(P.metalSombra, l));
  ctx.fillStyle = g;
  ctx.fillRect(x - ancho, yCorona, ancho * 2, yPie - yCorona);
  ctx.strokeStyle = color(P.metalBajo, l);
  ctx.lineWidth = 1.4;
  for (let i = 1; i <= 3; i++) {
    const yj = yCorona + ((yPie - yCorona) * i) / 4;
    ctx.beginPath();
    ctx.moveTo(x - ancho - 1, yj);
    ctx.lineTo(x + ancho + 1, yj);
    ctx.stroke();
  }
}

/** Embudo, plataforma y barandilla sobre la superficie. */
function dibujarTorreta(ctx: CanvasRenderingContext2D, u: UnidadGranja, yCorona: number) {
  const { x, escala: s, lejania: l } = u;
  const hEmb = 26 * s;
  const g = ctx.createLinearGradient(x - 22 * s, 0, x + 22 * s, 0);
  g.addColorStop(0, color(P.metalSombra, l));
  g.addColorStop(0.3, color(P.metalAlto, l));
  g.addColorStop(0.65, color(P.metal, l));
  g.addColorStop(1, color(P.metalSombra, l));
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(x - 10 * s, yCorona);
  ctx.quadraticCurveTo(x - 14 * s, yCorona - hEmb * 0.4, x - 21 * s, yCorona - hEmb * 0.78);
  ctx.lineTo(x - 22 * s, yCorona - hEmb);
  ctx.lineTo(x + 22 * s, yCorona - hEmb);
  ctx.lineTo(x + 21 * s, yCorona - hEmb * 0.78);
  ctx.quadraticCurveTo(x + 14 * s, yCorona - hEmb * 0.4, x + 10 * s, yCorona);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = color([30, 40, 48], l, 0.4);
  ctx.lineWidth = 1;
  ctx.stroke();

  ctx.fillStyle = color(P.metal, l);
  ctx.beginPath();
  ctx.ellipse(x, yCorona - hEmb, 22 * s, 4.5 * s, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = color(P.metalBajo, l);
  ctx.lineWidth = 1.1;
  ctx.stroke();

  // Barandilla: pasamanos y candeleros.
  const yBar = yCorona - hEmb - 9 * s;
  ctx.beginPath();
  ctx.ellipse(x, yBar, 20 * s, 3.6 * s, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let i = 0; i < 7; i++) {
    const bx = x - 20 * s + (i * 40 * s) / 6;
    ctx.moveTo(bx, yCorona - hEmb + 1);
    ctx.lineTo(bx, yBar + 1);
  }
  ctx.stroke();
}

/** Baliza de navegación: tramos rojo/blanco y destello. */
function dibujarBaliza(ctx: CanvasRenderingContext2D, u: UnidadGranja, yBase: number, t: number) {
  const { x, escala: s, lejania: l } = u;
  ctx.strokeStyle = color(P.metalBajo, l);
  ctx.lineWidth = 2 * s;
  ctx.beginPath();
  ctx.moveTo(x, yBase);
  ctx.lineTo(x, yBase - 7 * s);
  ctx.stroke();
  const hSeg = 4.6 * s;
  const wSeg = 4.6 * s;
  for (let i = 0; i < 6; i++) {
    const y = yBase - 7 * s - (i + 1) * hSeg;
    ctx.fillStyle = color(i % 2 === 0 ? P.balizaRojo : P.balizaBlanco, l);
    ctx.fillRect(x - wSeg, y, wSeg * 2, hSeg - 0.5);
  }
  const yTapa = yBase - 7 * s - 6 * hSeg;
  ctx.fillStyle = color(P.balizaRojo, l);
  ctx.beginPath();
  ctx.ellipse(x, yTapa, wSeg + 1, 2 * s, 0, 0, Math.PI * 2);
  ctx.fill();
  const on = destelloBaliza(t);
  const yLuz = yTapa - 4 * s;
  if (on) {
    const halo = ctx.createRadialGradient(x, yLuz, 0, x, yLuz, 13 * s);
    halo.addColorStop(0, "rgba(255,80,60,0.55)");
    halo.addColorStop(1, "rgba(255,80,60,0)");
    ctx.fillStyle = halo;
    ctx.beginPath();
    ctx.arc(x, yLuz, 13 * s, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = on ? "rgb(255 74 58)" : "rgb(122 24 18)";
  ctx.beginPath();
  ctx.arc(x, yLuz, 2.8 * s, 0, Math.PI * 2);
  ctx.fill();
}

// ---- Rotor ------------------------------------------------------------------

/** Proyección oblicua ligera: z (hacia quien mira) se desplaza a la derecha y
 *  un poco hacia abajo, como una vista tres cuartos muy cerrada. */
const OBL_X = 0.42;
const OBL_Y = 0.1;

/** Contorno de una pala en pantalla, desde su ángulo de giro β. La cuerda se
 *  tuerce de 26° en la raíz a 5° en la punta respecto al plano del rotor. */
function contornoPala(xb: number, yb: number, R: number, beta: number): [number, number][] {
  const estaciones = 9;
  const ataque: [number, number][] = [];
  const salida: [number, number][] = [];
  const cb = Math.cos(beta);
  const sb = Math.sin(beta);
  for (let j = 0; j <= estaciones; j++) {
    const u = j / estaciones;
    const r = R * (0.16 + 0.84 * u);
    // Cuerda: ancha cerca de la raíz, afinada en la punta.
    const cuerda = R * (0.24 - 0.15 * u) * (j === estaciones ? 0.45 : 1);
    const torsion = ((26 - 21 * u) * Math.PI) / 180;
    // Centro en 3D: (0, r·cosβ, r·sinβ). Tangente del plano: (0, −sinβ, cosβ).
    const cy = r * cb;
    const cz = r * sb;
    const dx3 = Math.sin(torsion);
    const dy3 = -sb * Math.cos(torsion);
    const dz3 = cb * Math.cos(torsion);
    const proy = (x3: number, y3: number, z3: number): [number, number] => [
      xb + x3 + z3 * OBL_X,
      yb - y3 + z3 * OBL_Y,
    ];
    ataque.push(proy(-0.32 * cuerda * dx3, cy - 0.32 * cuerda * dy3, cz - 0.32 * cuerda * dz3));
    salida.push(proy(0.68 * cuerda * dx3, cy + 0.68 * cuerda * dy3, cz + 0.68 * cuerda * dz3));
  }
  return [...ataque, ...salida.reverse()];
}

function dibujarPala(
  ctx: CanvasRenderingContext2D,
  xb: number,
  yb: number,
  R: number,
  beta: number,
  l: number
) {
  const pts = contornoPala(xb, yb, R, beta);
  // Iluminación: la cara que mira hacia quien observa recibe más luz.
  const luz = 0.55 + 0.45 * Math.max(0, Math.sin(beta));
  const tip: [number, number] = [xb + R * Math.sin(beta) * OBL_X, yb - R * Math.cos(beta) + R * Math.sin(beta) * OBL_Y];
  const g = ctx.createLinearGradient(xb, yb, tip[0], tip[1]);
  const oscuro: RGB = [
    P.rojoPalaOsc[0] * (0.7 + 0.3 * luz),
    P.rojoPalaOsc[1],
    P.rojoPalaOsc[2],
  ];
  g.addColorStop(0, color(oscuro, l));
  g.addColorStop(0.3, color([P.rojoPala[0] * (0.75 + 0.25 * luz), P.rojoPala[1], P.rojoPala[2]], l));
  g.addColorStop(0.8, color([P.rojoPala[0] * (0.75 + 0.25 * luz), P.rojoPala[1], P.rojoPala[2]], l));
  g.addColorStop(0.83, color(P.naranjaPala, l));
  g.addColorStop(1, color(P.naranjaPala, l));
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = color([60, 14, 14], l, 0.5);
  ctx.lineWidth = 0.8;
  ctx.stroke();
}

function dibujarRotor(
  ctx: CanvasRenderingContext2D,
  u: UnidadGranja,
  giro: number,
  omega: number
) {
  const { xBuje: xb, yRotor: yb, radio: R, escala: s, lejania: l, x } = u;
  const angulos = [0, 1, 2].map((i) => giro + (i * Math.PI * 2) / 3);
  const detras = angulos.filter((b) => Math.sin(b) < 0);
  const delante = angulos.filter((b) => Math.sin(b) >= 0);

  // Disco barrido: con el rotor girando el ojo ve la estela de las palas.
  const vis = Math.min(0.16, Math.abs(omega) * 0.09);
  if (vis > 0.01) {
    ctx.fillStyle = `rgba(230,240,236,${vis.toFixed(3)})`;
    ctx.beginPath();
    for (let i = 0; i <= 32; i++) {
      const a = (i / 32) * Math.PI * 2;
      const px = xb + R * Math.sin(a) * OBL_X;
      const py = yb - R * Math.cos(a) + R * Math.sin(a) * OBL_Y;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();
  }

  for (const b of detras) dibujarPala(ctx, xb, yb, R, b, l + 0.25);

  // Góndola: cuerpo de revolución, del buje al pilar y algo más allá.
  const largo = 46 * s;
  const radioG = 8.5 * s;
  const gg = ctx.createLinearGradient(0, yb - radioG, 0, yb + radioG);
  gg.addColorStop(0, color(P.metalAlto, l));
  gg.addColorStop(0.45, color(P.metal, l));
  gg.addColorStop(1, color(P.metalSombra, l));
  ctx.fillStyle = gg;
  ctx.beginPath();
  ctx.moveTo(xb + 4 * s, yb - radioG);
  ctx.lineTo(xb + largo - 10 * s, yb - radioG);
  ctx.quadraticCurveTo(xb + largo + 2 * s, yb, xb + largo - 10 * s, yb + radioG);
  ctx.lineTo(xb + 4 * s, yb + radioG);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = color([20, 28, 32], l, 0.45);
  ctx.lineWidth = 1;
  ctx.stroke();
  // Abrazadera de la góndola al pilar.
  ctx.fillStyle = color(P.metalSombra, l);
  ctx.fillRect(x - 12 * s, yb - radioG - 3 * s, 24 * s, 3 * s);
  ctx.fillRect(x - 12 * s, yb + radioG, 24 * s, 3 * s);

  for (const b of delante) dibujarPala(ctx, xb, yb, R, b, l);

  // Ojiva del buje, aguas arriba.
  const gb = ctx.createRadialGradient(xb - 4 * s, yb - 3 * s, 1, xb, yb, 11 * s);
  gb.addColorStop(0, color(P.metalAlto, l));
  gb.addColorStop(1, color(P.metalSombra, l));
  ctx.fillStyle = gb;
  ctx.beginPath();
  ctx.moveTo(xb + 5 * s, yb - 8 * s);
  ctx.quadraticCurveTo(xb - 14 * s, yb - 7 * s, xb - 16 * s, yb);
  ctx.quadraticCurveTo(xb - 14 * s, yb + 7 * s, xb + 5 * s, yb + 8 * s);
  ctx.closePath();
  ctx.fill();
}

/** Cable sobre el lecho entre unidades, con un pulso de energía. */
function dibujarCableLecho(ctx: CanvasRenderingContext2D, x0: number, x1: number, y: number, t: number) {
  ctx.strokeStyle = color(P.cable, 0);
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x0, y);
  ctx.quadraticCurveTo((x0 + x1) / 2, y + 3, x1, y);
  ctx.stroke();
  const frac = (((t * 0.22) % 1) + 1) % 1;
  ctx.fillStyle = color(P.acento, 0);
  ctx.globalAlpha = Math.sin(frac * Math.PI);
  ctx.beginPath();
  ctx.arc(x0 + (x1 - x0) * frac, y + 1.5 * Math.sin(frac * Math.PI), 2.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;
}

/**
 * Dibuja una granja de turbinas de corriente mareal (1–6 unidades).
 * La unidad principal se centra en `opts.x`; las adicionales se disponen
 * detrás, a ambos lados, más pequeñas y veladas por el agua.
 */
export function dibujarGranja2D(ctx: CanvasRenderingContext2D, opts: OptsGranja2D): void {
  const { ySuperficie, yFondo, t, velocidadCorriente, cimentacion = "gravedad", sinRotulo = false } = opts;
  if (!(yFondo > ySuperficie + 20)) return;
  const unidades = disposicionGranja(opts);
  const U = Math.max(0, velocidadCorriente);
  const omega = (TSR * U) / RADIO_ROTOR_M;
  const giroBase = opts.giro ?? t * omega;
  const sup = opts.superficieY ?? (() => ySuperficie);

  // Cables entre unidades sobre el lecho (de la del fondo a la principal).
  if (unidades.length > 1) {
    const xs = unidades.map((u) => u.x).sort((a, b) => a - b);
    for (let i = 0; i < xs.length - 1; i++) dibujarCableLecho(ctx, xs[i], xs[i + 1], yFondo - 2, t + i * 0.3);
  }

  // De lejos a cerca: la principal queda delante.
  const orden = [...unidades].sort((a, b) => b.lejania - a.lejania || b.orden - a.orden);
  for (const u of orden) {
    const s = u.escala;
    const yPie = dibujarCimentacion(ctx, u, cimentacion);
    const yCorona = ySuperficie - 30 * s;
    dibujarPilar(ctx, u, yCorona, yPie);

    // Línea de agua sobre el fuste en la cota real de la ola.
    const ySup = sup(u.x);
    ctx.fillStyle = "rgba(255,255,255,0.5)";
    ctx.fillRect(u.x - 10 * s, ySup - 1, 20 * s, 2);

    dibujarTorreta(ctx, u, yCorona);
    dibujarBaliza(ctx, u, yCorona - 38 * s, t + u.orden * 0.4);
    dibujarRotor(ctx, u, giroBase + u.orden * 0.7, omega);
  }

  if (sinRotulo) return;
  const n = unidades.length;
  const texto = n > 1 ? `Granja mareomotriz · ${n} unidades` : "Turbina de corriente mareal";
  ctx.font = "600 12px system-ui, sans-serif";
  ctx.textAlign = "left";
  const ancho = (ctx.measureText?.(texto)?.width ?? texto.length * 6.5) + 16;
  // A la derecha de la baliza: encima chocaba con la regla de Te.
  const xEt = opts.x + 28;
  const yEt = ySuperficie - 30 - 52;
  ctx.fillStyle = "rgba(15,26,36,0.8)";
  ctx.beginPath();
  ctx.roundRect(xEt, yEt - 14, ancho, 19, 3);
  ctx.fill();
  ctx.fillStyle = "rgb(238 245 247)";
  ctx.fillText(texto, xEt + 8, yEt);
}

/** Espuma y ola de proa donde la torreta corta la superficie: la corriente
 *  choca con el fuste y deja una estela en V aguas abajo. */
export function dibujarEstelaSuperficie(
  ctx: CanvasRenderingContext2D,
  opts: OptsGranja2D,
  superficieY: (px: number) => number,
  t: number
): void {
  const U = Math.max(0, opts.velocidadCorriente);
  if (U < 0.2) return;
  const fuerza = Math.min(1, U / 3);
  for (const u of disposicionGranja(opts)) {
    const s = u.escala;
    const x0 = u.x + 10 * s;
    // Ola de proa: un abultamiento aguas arriba del fuste.
    const yP = superficieY(u.x - 10 * s);
    ctx.fillStyle = `rgba(250,252,246,${(0.5 * fuerza).toFixed(3)})`;
    ctx.beginPath();
    ctx.ellipse(u.x - 11 * s, yP - 1, 5 * s * (0.6 + fuerza), 2.4 * s, 0, 0, Math.PI * 2);
    ctx.fill();
    // Estela: retazos de espuma que se alejan y se deshacen.
    const largo = (60 + 90 * fuerza) * s;
    for (let i = 0; i < 12; i++) {
      const fase = (((t * 0.4 + i / 12) % 1) + 1) % 1;
      const px = x0 + fase * largo;
      const py = superficieY(px) + 0.5 + Math.sin(i * 2.3 + t * 3) * 0.8;
      const a = (1 - fase) * 0.55 * fuerza * (u.lejania ? 0.6 : 1);
      ctx.fillStyle = `rgba(250,252,246,${a.toFixed(3)})`;
      ctx.beginPath();
      ctx.ellipse(px, py, (2 + fase * 5) * s, 1.2 * s, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}
