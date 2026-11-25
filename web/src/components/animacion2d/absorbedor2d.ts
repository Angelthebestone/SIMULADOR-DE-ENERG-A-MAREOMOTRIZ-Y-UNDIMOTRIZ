// Absorbedor puntual undimotriz tipo PowerBuoy — capa 2D.
// Alineada con undimotriz_powerbuoy_partes.jpg y animacion3d/escenas/absorbedor.ts.
//
// Cómo trabaja, y por eso cómo se dibuja: el flotador amarillo sube y baja con
// la ola; el mástil (spar) con la placa de reactancia en el pie apenas se
// mueve, porque la placa arrastra una gran masa de agua. El PTO convierte la
// carrera relativa entre los dos cuerpos en electricidad. En el dibujo esa
// carrera se ve: el vástago que asoma entre el flotador y la cabeza del mástil
// se alarga y se acorta. El flotador va semisumergido, con su calado.
// Autocontenida: sin estado de AnimacionCanvas.

export interface OptsAbsorbedor2D {
  /** Centro horizontal del dispositivo. */
  x: number;
  /** Nivel medio del mar (píxeles). */
  ySuperficie: number;
  /** Lecho / cota de apoyo (píxeles). */
  yFondo: number;
  /** Tiempo de animación en segundos. */
  t: number;
  /** Desplazamiento vertical del flotador en **píxeles** (positivo = hacia arriba). */
  zRelativo?: number;
  /** Desplazamiento del mástil en píxeles. Por defecto, una fracción pequeña
   *  del flotador: la placa de reactancia lo frena. */
  zMastil?: number;
  /** Altura significativa de ola en metros (sin uso geométrico; se conserva
   *  por compatibilidad del contrato). */
  Hm0?: number;
  /** Cabeceo del flotador (rad, + horario): sigue la pendiente de la ola. */
  inclinacion?: number;
  /** Subida máxima esperable del flotador (px). La cabeza del mástil se
   *  coloca por encima, para que el flotador nunca la atraviese. */
  alcancePx?: number;
  /** Omite el chip del nombre (previstas de la pantalla de tecnología). */
  sinRotulo?: boolean;
  /** Omite el cable a costa: la escena ya dibuja el suyo hasta la subestación. */
  sinCable?: boolean;
}

/** Paleta PowerBuoy alineada con la escena 3D. */
const P = {
  amarillo: "rgb(245 196 0)",
  amarilloAlto: "rgb(255 226 110)",
  amarilloOsc: "rgb(196 146 0)",
  amarilloSombra: "rgb(150 108 0)",
  naranja: "rgb(224 120 32)",
  spar: "rgb(42 50 58)",
  sparClaro: "rgb(78 90 101)",
  sparBrillo: "rgb(112 124 135)",
  placa: "rgb(58 66 74)",
  placaNervio: "rgb(37 43 49)",
  pod: "rgb(106 117 126)",
  podClaro: "rgb(154 163 171)",
  podTanque: "rgb(184 192 198)",
  cable: "rgb(26 34 40)",
  flotadorCable: "rgb(236 134 40)",
  vastago: "rgb(214 222 228)",
  balizaOn: "rgb(255 59 48)",
  balizaOff: "rgb(122 24 18)",
  acento: "rgb(199 225 74)",
  metal: "rgb(200 206 212)",
  cadena: "rgba(28,36,44,0.8)",
};

/** Geometría del absorbedor, publicada para que la escena pueda colocar el
 *  cable y la espuma sin adivinar. */
export function geometriaAbsorbedor(x: number, ySuperficie: number, yFondo: number) {
  const calado = yFondo - ySuperficie;
  return {
    semiFlotador: 40,
    /** Calado del flotador bajo su línea de flotación (px). */
    caladoFlotador: 17,
    /** Francobordo sobre la línea de flotación (px). */
    francobordo: 13,
    yPlaca: ySuperficie + calado * 0.6,
    xPod: x + 58,
    yPod: yFondo - 12,
    /** Punto donde el cable de evacuación sale del pod hacia costa. */
    salidaCable: { x: x + 84, y: yFondo - 4 },
  };
}

/** Curva de cadena entre dos puntos con flecha `seno` (px). Una parábola es
 *  la aproximación de la catenaria con poca flecha. */
function linea(ctx: CanvasRenderingContext2D, x0: number, y0: number, x1: number, y1: number, seno: number) {
  ctx.beginPath();
  ctx.moveTo(x0, y0);
  ctx.quadraticCurveTo((x0 + x1) / 2, Math.max(y0, y1) + seno, x1, y1);
  ctx.stroke();
}

/**
 * Dibuja un PowerBuoy: flotador amarillo con heave, mástil casi fijo con
 * placa de reactancia, PTO visible, fondeo, umbilical y pod submarino.
 */
export function dibujarAbsorbedor2D(ctx: CanvasRenderingContext2D, opts: OptsAbsorbedor2D): void {
  const { x, ySuperficie, yFondo, t, sinRotulo = false, sinCable = false } = opts;
  if (!(yFondo > ySuperficie + 30)) return;
  const g = geometriaAbsorbedor(x, ySuperficie, yFondo);
  const alcance = Math.max(14, opts.alcancePx ?? 30);
  // Topes de carrera: el flotador no puede atravesar la cabeza del mástil ni
  // hundirse hasta la placa, como en la máquina real.
  const zCrudo = Number.isFinite(opts.zRelativo) ? (opts.zRelativo as number) : 0;
  const z = Math.max(-alcance * 1.3, Math.min(alcance, zCrudo));
  const zs = Number.isFinite(opts.zMastil) ? (opts.zMastil as number) : z * 0.12;

  // Mástil: referencia casi inercial. Su cota se desplaza poco.
  const ySparTop = ySuperficie - g.francobordo - alcance - 26 - zs;
  const yPlaca = g.yPlaca - zs;
  // Flotador: su línea de flotación de proyecto va con la serie.
  const yFlot = ySuperficie - z;
  const semi = g.semiFlotador;
  const yTope = yFlot - g.francobordo;
  const yQuilla = yFlot + g.caladoFlotador;

  // ---- Fondeo: tres líneas de cadena al lecho ------------------------------
  // Salen del collar inferior del mástil; la que va a sotavento queda más
  // tensa y la de barlovento más floja, porque el mar empuja hacia la costa.
  ctx.strokeStyle = P.cadena;
  ctx.lineWidth = 1.4;
  const yFair = yPlaca - 14;
  for (const [dx, seno] of [
    [-96, 26],
    [-58, 14],
    [92, 10],
  ] as const) {
    const xa = x + dx;
    linea(ctx, x + Math.sign(dx) * 5, yFair, xa, yFondo - 2, seno);
    // Ancla de succión enterrada: sólo asoma la cabeza.
    ctx.fillStyle = "rgb(74 83 90)";
    ctx.beginPath();
    ctx.ellipse(xa, yFondo - 1, 7, 3.5, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // ---- Pod / subestación submarina ----------------------------------------
  const xp = g.xPod;
  const yp = g.yPod;
  ctx.fillStyle = "rgba(15,25,32,0.3)";
  ctx.beginPath();
  ctx.ellipse(xp + 4, yFondo + 3, 30, 5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "rgb(74 85 94)";
  ctx.fillRect(xp - 26, yp + 8, 52, 5);
  const gPod = ctx.createLinearGradient(0, yp - 8, 0, yp + 10);
  gPod.addColorStop(0, P.podClaro);
  gPod.addColorStop(1, P.pod);
  ctx.fillStyle = gPod;
  ctx.beginPath();
  ctx.roundRect(xp - 21, yp - 8, 42, 17, 4);
  ctx.fill();
  ctx.strokeStyle = "rgba(20,28,32,0.5)";
  ctx.lineWidth = 1.1;
  ctx.stroke();
  ctx.fillStyle = P.podTanque;
  for (const s of [-1, 1]) {
    ctx.beginPath();
    ctx.ellipse(xp + s * 9, yp - 9, 7, 3.2, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  // Conectores húmedos a ambos lados.
  ctx.fillStyle = "rgb(60 68 76)";
  ctx.fillRect(xp - 25, yp - 2, 4, 6);
  ctx.fillRect(xp + 21, yp - 2, 4, 6);

  // ---- Umbilical en «onda perezosa» ----------------------------------------
  // Del pie del mástil baja, sube sobre los flotadores de cable y cae al pod:
  // esa joroba absorbe el movimiento del mástil sin tirar del conector.
  const u0x = x + 4;
  const u0y = yPlaca + 6;
  const jorobaX = x + 26;
  const jorobaY = Math.min(yp - 26, u0y + (yp - u0y) * 0.45);
  ctx.strokeStyle = P.cable;
  ctx.lineWidth = 2.2;
  ctx.beginPath();
  ctx.moveTo(u0x, u0y);
  ctx.bezierCurveTo(x + 6, jorobaY + 30, jorobaX - 14, jorobaY, jorobaX, jorobaY);
  ctx.bezierCurveTo(jorobaX + 12, jorobaY, xp - 32, yp + 2, xp - 25, yp + 1);
  ctx.stroke();
  // Módulos de flotación sobre la joroba.
  ctx.fillStyle = P.flotadorCable;
  for (let i = -2; i <= 2; i++) {
    ctx.beginPath();
    ctx.ellipse(jorobaX + i * 5, jorobaY + Math.abs(i) * 0.9, 2.4, 3.4, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // ---- Cable a costa (sólo si la escena no dibuja el suyo) ------------------
  if (!sinCable) {
    const x0c = g.salidaCable.x;
    const y0c = g.salidaCable.y;
    const xCosta = x + 240;
    const yCosta = ySuperficie + (yFondo - ySuperficie) * 0.2;
    const cpX = x + 150;
    const cpY = yFondo + 2;
    ctx.strokeStyle = P.cable;
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.moveTo(xp + 25, yp + 1);
    ctx.lineTo(x0c, y0c);
    ctx.quadraticCurveTo(cpX, cpY, xCosta, yCosta);
    ctx.stroke();
    const frac = (((t * 0.2) % 1) + 1) % 1;
    const px = (1 - frac) * (1 - frac) * x0c + 2 * (1 - frac) * frac * cpX + frac * frac * xCosta;
    const py = (1 - frac) * (1 - frac) * y0c + 2 * (1 - frac) * frac * cpY + frac * frac * yCosta;
    ctx.fillStyle = P.acento;
    ctx.globalAlpha = Math.sin(frac * Math.PI);
    ctx.beginPath();
    ctx.arc(px, py, 2.8, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  // ---- Placa de reactancia --------------------------------------------------
  ctx.fillStyle = "rgba(10,18,24,0.22)";
  ctx.beginPath();
  ctx.ellipse(x + 3, yPlaca + 9, 40, 7, 0, 0, Math.PI * 2);
  ctx.fill();
  const gPlaca = ctx.createLinearGradient(0, yPlaca - 6, 0, yPlaca + 8);
  gPlaca.addColorStop(0, "rgb(84 94 104)");
  gPlaca.addColorStop(1, P.placa);
  ctx.fillStyle = gPlaca;
  ctx.beginPath();
  ctx.ellipse(x, yPlaca, 36, 8, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = P.placaNervio;
  ctx.lineWidth = 1.6;
  ctx.stroke();
  ctx.lineWidth = 1.1;
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(x, yPlaca);
    ctx.lineTo(x + Math.cos(a) * 32, yPlaca + Math.sin(a) * 6.8);
    ctx.stroke();
  }
  // Canto de la placa: tiene espesor.
  ctx.fillStyle = P.placaNervio;
  ctx.beginPath();
  ctx.moveTo(x - 36, yPlaca);
  ctx.lineTo(x - 36, yPlaca + 3);
  ctx.ellipse(x, yPlaca + 3, 36, 8, 0, Math.PI, 0, true);
  ctx.lineTo(x + 36, yPlaca);
  ctx.ellipse(x, yPlaca, 36, 8, 0, 0, Math.PI, false);
  ctx.closePath();
  ctx.fill();

  // ---- Mástil ---------------------------------------------------------------
  const semiSpar = 5.5;
  const gSpar = ctx.createLinearGradient(x - semiSpar, 0, x + semiSpar, 0);
  gSpar.addColorStop(0, "rgb(22 28 34)");
  gSpar.addColorStop(0.35, P.sparBrillo);
  gSpar.addColorStop(0.6, P.sparClaro);
  gSpar.addColorStop(1, P.spar);
  ctx.fillStyle = gSpar;
  ctx.fillRect(x - semiSpar, ySparTop, semiSpar * 2, yPlaca - ySparTop);
  // Collarines del mástil.
  ctx.fillStyle = P.sparClaro;
  for (const fr of [0.55, 0.78]) {
    const yc = ySparTop + (yPlaca - ySparTop) * fr;
    ctx.fillRect(x - semiSpar - 1.5, yc, semiSpar * 2 + 3, 3);
  }
  ctx.fillRect(x - 8, yFair - 3, 16, 6);

  // ---- Flotador -------------------------------------------------------------
  // El flotador cabecea con la pendiente de la ola alrededor de su línea de
  // flotación; el mástil, más pesado y anclado, se queda vertical.
  const cabeceo = Math.max(-0.14, Math.min(0.14, opts.inclinacion ?? 0));
  ctx.save();
  ctx.translate(x, yFlot);
  ctx.rotate(cabeceo);
  ctx.translate(-x, -yFlot);
  // Toroide visto de lado: casco con pantoque redondeado y quilla plana.
  const gCuerpo = ctx.createLinearGradient(x - semi, 0, x + semi, 0);
  gCuerpo.addColorStop(0, P.amarilloSombra);
  gCuerpo.addColorStop(0.28, P.amarilloAlto);
  gCuerpo.addColorStop(0.55, P.amarillo);
  gCuerpo.addColorStop(1, P.amarilloSombra);
  ctx.fillStyle = gCuerpo;
  ctx.beginPath();
  ctx.moveTo(x - semi, yTope + 3);
  ctx.lineTo(x - semi, yQuilla - 9);
  ctx.quadraticCurveTo(x - semi, yQuilla, x - semi + 12, yQuilla);
  ctx.lineTo(x + semi - 12, yQuilla);
  ctx.quadraticCurveTo(x + semi, yQuilla, x + semi, yQuilla - 9);
  ctx.lineTo(x + semi, yTope + 3);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = "rgba(110,72,0,0.5)";
  ctx.lineWidth = 1.1;
  ctx.stroke();
  // Cubierta del toroide vista desde arriba en ligero picado.
  ctx.fillStyle = P.amarillo;
  ctx.beginPath();
  ctx.ellipse(x, yTope + 3, semi, 6, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = P.amarilloOsc;
  ctx.stroke();
  // Hueco central por donde pasa el mástil.
  ctx.fillStyle = "rgb(70 56 10)";
  ctx.beginPath();
  ctx.ellipse(x, yTope + 3, 10, 2.6, 0, 0, Math.PI * 2);
  ctx.fill();
  // Faja naranja de flotación: la marca que debería quedar a ras de agua.
  ctx.fillStyle = P.naranja;
  ctx.fillRect(x - semi, yFlot - 2, semi * 2, 5);
  ctx.fillStyle = "rgba(255,255,255,0.28)";
  ctx.fillRect(x - semi + 3, yFlot - 2, semi * 2 - 6, 1.5);
  // Cáncamos de izado.
  ctx.fillStyle = P.amarilloOsc;
  for (const s of [-1, 1]) ctx.fillRect(x + s * (semi - 9) - 2, yTope - 1, 4, 4);

  ctx.restore();

  // ---- PTO a la vista ---------------------------------------------------------
  // El vástago une el flotador con la cabeza del mástil: su largo visible es la
  // carrera relativa, que es la que produce energía.
  const yCabeza = ySparTop + 16;
  const yCollarFlot = yTope;
  if (yCollarFlot > yCabeza + 2) {
    ctx.fillStyle = P.vastago;
    ctx.fillRect(x - 3, yCabeza, 6, yCollarFlot - yCabeza);
    ctx.fillStyle = "rgba(255,255,255,0.55)";
    ctx.fillRect(x - 1.5, yCabeza, 1.2, yCollarFlot - yCabeza);
  }
  // Cabeza del mástil: alojamiento del generador lineal.
  const gCab = ctx.createLinearGradient(x - 10, 0, x + 10, 0);
  gCab.addColorStop(0, "rgb(30 38 46)");
  gCab.addColorStop(0.4, P.sparBrillo);
  gCab.addColorStop(1, P.spar);
  ctx.fillStyle = gCab;
  ctx.beginPath();
  ctx.roundRect(x - 10, ySparTop, 20, 16, 3);
  ctx.fill();
  ctx.strokeStyle = "rgba(10,14,18,0.5)";
  ctx.lineWidth = 1;
  ctx.stroke();
  // Junta lima: aquí está la conversión a electricidad.
  ctx.fillStyle = P.acento;
  ctx.fillRect(x - 10, ySparTop + 12, 20, 2.5);

  // ---- Mástil de señales: baliza y antena ------------------------------------
  ctx.strokeStyle = P.metal;
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.moveTo(x, ySparTop);
  ctx.lineTo(x, ySparTop - 16);
  ctx.moveTo(x + 5, ySparTop);
  ctx.lineTo(x + 6, ySparTop - 26);
  ctx.stroke();
  // Marca de tope: aspa amarilla de marca especial.
  ctx.strokeStyle = P.amarilloOsc;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x - 5, ySparTop - 24);
  ctx.lineTo(x + 3, ySparTop - 16);
  ctx.moveTo(x + 3, ySparTop - 24);
  ctx.lineTo(x - 5, ySparTop - 16);
  ctx.stroke();
  const on = Math.sin(t * 2.4) > 0.35;
  const yLuz = ySparTop - 19;
  if (on) {
    const halo = ctx.createRadialGradient(x - 1, yLuz, 0, x - 1, yLuz, 14);
    halo.addColorStop(0, "rgba(255,60,48,0.55)");
    halo.addColorStop(1, "rgba(255,60,48,0)");
    ctx.fillStyle = halo;
    ctx.beginPath();
    ctx.arc(x - 1, yLuz, 14, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = on ? P.balizaOn : P.balizaOff;
  ctx.beginPath();
  ctx.arc(x - 1, yLuz, on ? 3.4 : 2.6, 0, Math.PI * 2);
  ctx.fill();

  // Rótulo.
  if (sinRotulo) return;
  const texto = "Absorbedor puntual";
  ctx.font = "600 12px system-ui, sans-serif";
  ctx.textAlign = "left";
  const ancho = (ctx.measureText?.(texto)?.width ?? texto.length * 6.5) + 16;
  // A la derecha de la cabeza del mástil, que apenas se mueve: encima chocaba
  // con la regla de Te, que vive en el cielo sobre la cresta más alta.
  const xEt = x + 22;
  const yEt = ySuperficie - g.francobordo - alcance - 14;
  ctx.fillStyle = "rgba(15,26,36,0.8)";
  ctx.beginPath();
  ctx.roundRect(xEt, yEt - 14, ancho, 19, 3);
  ctx.fill();
  ctx.fillStyle = "rgb(238 245 247)";
  ctx.fillText(texto, xEt + 8, yEt);
}
