// Absorbedor puntual undimotriz tipo PowerBuoy — capa 2D hiperrealista.
// Alineada con undimotriz_powerbuoy_partes.jpg y animacion3d/escenas/absorbedor.ts:
// flotador amarillo (tambor + collar + casquete + faja naranja + baliza + antena),
// spar metálico oscuro, placa de reactancia con nervaduras, pod/subestación en el
// lecho y cable a costa con pulso. Autocontenida: sin estado de AnimacionCanvas.

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
  /** Altura significativa de ola en metros (afina el calado visual). */
  Hm0?: number;
  /** Omite el chip del nombre (previstas de la pantalla de tecnología). */
  sinRotulo?: boolean;
}

/** Paleta PowerBuoy alineada con la escena 3D. */
const P = {
  amarillo: "rgb(245 196 0)",
  amarilloAlto: "rgb(255 224 102)",
  amarilloOsc: "rgb(201 150 0)",
  naranja: "rgb(224 120 32)",
  spar: "rgb(42 50 58)",
  sparClaro: "rgb(61 72 82)",
  placa: "rgb(58 66 74)",
  placaNervio: "rgb(37 43 49)",
  pod: "rgb(106 117 126)",
  podClaro: "rgb(154 163 171)",
  podTanque: "rgb(184 192 198)",
  cable: "rgb(26 34 40)",
  balizaOn: "rgb(255 59 48)",
  balizaOff: "rgb(122 24 18)",
  acento: "rgb(199 225 74)",
  metal: "rgb(200 206 212)",
};

/**
 * Dibuja un PowerBuoy: flotador amarillo con heave, spar, placa de reactancia,
 * pod submarino y cable de evacuación.
 */
export function dibujarAbsorbedor2D(ctx: CanvasRenderingContext2D, opts: OptsAbsorbedor2D): void {
  const { x, ySuperficie, yFondo, t, sinRotulo = false } = opts;
  const z = opts.zRelativo ?? 0;
  const hm0 = opts.Hm0 ?? 1.5;
  if (!(yFondo > ySuperficie + 30)) return;

  // El flotador se eleva con la serie; el spar queda casi fijo (referencia inercial).
  const yFlot = ySuperficie - z;
  const yPlaca = ySuperficie + (yFondo - ySuperficie) * 0.62;
  const yPod = yFondo - 8;

  // ---- Cable a costa + pulso de energía ------------------------------------
  const xCosta = x + 220;
  const yCosta = ySuperficie + (yFondo - ySuperficie) * 0.15;
  ctx.strokeStyle = P.cable;
  ctx.lineWidth = 2.4;
  ctx.beginPath();
  ctx.moveTo(x + 18, yPod + 4);
  ctx.quadraticCurveTo(x + 100, yPod + 10, xCosta, yCosta);
  ctx.stroke();
  const frac = (t * 0.2) % 1;
  const cpX = x + 100;
  const cpY = yPod + 10;
  const x0c = x + 18;
  const y0c = yPod + 4;
  const px = (1 - frac) * (1 - frac) * x0c + 2 * (1 - frac) * frac * cpX + frac * frac * xCosta;
  const py = (1 - frac) * (1 - frac) * y0c + 2 * (1 - frac) * frac * cpY + frac * frac * yCosta;
  ctx.fillStyle = P.acento;
  ctx.globalAlpha = 0.55 + 0.45 * Math.sin(frac * Math.PI);
  ctx.beginPath();
  ctx.arc(px, py, 2.8, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;

  // ---- Pod / subestación submarina (USP) -----------------------------------
  ctx.fillStyle = "rgba(15,25,32,0.3)";
  ctx.beginPath();
  ctx.ellipse(x + 48, yFondo + 4, 28, 6, 0, 0, Math.PI * 2);
  ctx.fill();

  const gPod = ctx.createLinearGradient(0, yPod - 4, 0, yPod + 18);
  gPod.addColorStop(0, P.podClaro);
  gPod.addColorStop(1, P.pod);
  ctx.fillStyle = gPod;
  ctx.beginPath();
  ctx.roundRect(x + 28, yPod, 42, 18, 3);
  ctx.fill();
  ctx.strokeStyle = "rgba(20,28,32,0.5)";
  ctx.lineWidth = 1.1;
  ctx.stroke();
  // Cofia.
  ctx.fillStyle = P.podClaro;
  ctx.fillRect(x + 32, yPod - 4, 34, 5);
  // Tanques.
  ctx.fillStyle = P.podTanque;
  for (const s of [-1, 1]) {
    ctx.beginPath();
    ctx.ellipse(x + 49 + s * 8, yPod - 8, 7, 3.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillRect(x + 49 + s * 8 - 7, yPod - 8, 14, 5);
  }
  // Losa base.
  ctx.fillStyle = "rgb(74 85 94)";
  ctx.fillRect(x + 24, yPod + 18, 50, 4);

  // ---- Spar (casi fijo) ----------------------------------------------------
  const ySparTop = yFlot + 8;
  const gSpar = ctx.createLinearGradient(x - 5, 0, x + 5, 0);
  gSpar.addColorStop(0, "rgb(26 34 40)");
  gSpar.addColorStop(0.4, P.sparClaro);
  gSpar.addColorStop(1, P.spar);
  ctx.fillStyle = gSpar;
  ctx.fillRect(x - 4, ySparTop, 8, yPlaca - ySparTop + 4);
  // Collarines.
  ctx.fillStyle = P.sparClaro;
  for (const [fracY, h] of [
    [0.12, 4],
    [0.35, 3],
    [0.72, 4],
  ] as const) {
    const yc = ySparTop + (yPlaca - ySparTop) * fracY;
    ctx.fillRect(x - 6, yc, 12, h);
  }

  // ---- Placa de reactancia -------------------------------------------------
  ctx.fillStyle = "rgba(10,18,24,0.25)";
  ctx.beginPath();
  ctx.ellipse(x + 3, yPlaca + 8, 36, 7, 0, 0, Math.PI * 2);
  ctx.fill();

  const gPlaca = ctx.createLinearGradient(0, yPlaca - 5, 0, yPlaca + 8);
  gPlaca.addColorStop(0, "rgb(74 84 94)");
  gPlaca.addColorStop(1, P.placa);
  ctx.fillStyle = gPlaca;
  ctx.beginPath();
  ctx.ellipse(x, yPlaca, 34, 8, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = P.placaNervio;
  ctx.lineWidth = 1.8;
  ctx.stroke();
  // Aro exterior.
  ctx.strokeStyle = P.placaNervio;
  ctx.lineWidth = 2.4;
  ctx.beginPath();
  ctx.ellipse(x, yPlaca, 31, 6.5, 0, 0, Math.PI * 2);
  ctx.stroke();
  // Nervaduras radiales.
  ctx.lineWidth = 1.2;
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(x, yPlaca);
    ctx.lineTo(x + Math.cos(a) * 30, yPlaca + Math.sin(a) * 6.5);
    ctx.stroke();
  }
  // Bocel central.
  ctx.fillStyle = P.placaNervio;
  ctx.beginPath();
  ctx.ellipse(x, yPlaca, 7, 3.5, 0, 0, Math.PI * 2);
  ctx.fill();

  // Cable interno placa → pod.
  ctx.strokeStyle = P.cable;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x, yPlaca + 6);
  ctx.quadraticCurveTo(x + 14, yPlaca + 20, x + 36, yPod);
  ctx.stroke();

  // ---- Flotador amarillo (se mueve en heave) -------------------------------
  const radio = 28;
  const collarR = 38;
  const yCuerpoTop = yFlot - 22;
  const yCuerpoBot = yFlot + 16;
  const yCollar = yFlot + 4;

  // Sombra en el agua bajo el collar.
  ctx.fillStyle = "rgba(10,25,30,0.2)";
  ctx.beginPath();
  ctx.ellipse(x, yCollar + 14, collarR + 4, 6, 0, 0, Math.PI * 2);
  ctx.fill();

  // Cuerpo / tambor principal.
  const gCuerpo = ctx.createLinearGradient(x - radio, 0, x + radio, 0);
  gCuerpo.addColorStop(0, P.amarilloOsc);
  gCuerpo.addColorStop(0.35, P.amarilloAlto);
  gCuerpo.addColorStop(0.7, P.amarillo);
  gCuerpo.addColorStop(1, P.amarilloOsc);
  ctx.fillStyle = gCuerpo;
  ctx.beginPath();
  ctx.moveTo(x - radio, yCuerpoTop);
  ctx.lineTo(x - radio + 2, yCuerpoBot - 6);
  ctx.quadraticCurveTo(x, yCuerpoBot + 4, x + radio - 2, yCuerpoBot - 6);
  ctx.lineTo(x + radio, yCuerpoTop);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = "rgba(120,80,0,0.45)";
  ctx.lineWidth = 1.1;
  ctx.stroke();

  // Casquete superior abombado.
  const gDome = ctx.createLinearGradient(0, yCuerpoTop - 14, 0, yCuerpoTop);
  gDome.addColorStop(0, P.amarilloAlto);
  gDome.addColorStop(1, P.amarillo);
  ctx.fillStyle = gDome;
  ctx.beginPath();
  ctx.ellipse(x, yCuerpoTop, radio - 2, 10, 0, Math.PI, 0, true);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = "rgba(120,80,0,0.35)";
  ctx.stroke();

  // Cubierta plana.
  ctx.fillStyle = P.amarilloOsc;
  ctx.beginPath();
  ctx.ellipse(x, yCuerpoTop - 2, radio - 6, 4, 0, 0, Math.PI * 2);
  ctx.fill();

  // Collar de flotación ancho (rasgo reconocible).
  const gCollar = ctx.createLinearGradient(x - collarR, 0, x + collarR, 0);
  gCollar.addColorStop(0, P.amarilloOsc);
  gCollar.addColorStop(0.4, P.amarilloAlto);
  gCollar.addColorStop(1, P.amarilloOsc);
  ctx.fillStyle = gCollar;
  ctx.beginPath();
  ctx.moveTo(x - collarR, yCollar - 8);
  ctx.lineTo(x - collarR + 3, yCollar + 10);
  ctx.quadraticCurveTo(x, yCollar + 16, x + collarR - 3, yCollar + 10);
  ctx.lineTo(x + collarR, yCollar - 8);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = "rgba(120,80,0,0.4)";
  ctx.lineWidth = 1.2;
  ctx.stroke();
  // Borde superior del collar.
  ctx.fillStyle = P.amarillo;
  ctx.beginPath();
  ctx.ellipse(x, yCollar - 8, collarR, 7, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = P.amarilloOsc;
  ctx.stroke();

  // Faja naranja en la línea de flotación.
  ctx.fillStyle = P.naranja;
  ctx.fillRect(x - collarR + 2, yCollar + 1, (collarR - 2) * 2, 5);
  // Brillo de oleaje sobre la faja.
  ctx.fillStyle = "rgba(255,255,255,0.4)";
  ctx.fillRect(x - collarR + 4, yCollar + 1, (collarR - 6) * 2, 2);
  // Pequeña marca de ola animada.
  const onda = Math.sin(t * 2.2) * 2;
  ctx.fillStyle = "rgba(255,255,255,0.25)";
  ctx.fillRect(x - 8 + onda, yCollar + 3, 16, 1.5);

  // ---- Torre tipo A + caja de equipos --------------------------------------
  const yTorre = yCuerpoTop - 2;
  const yCima = yTorre - 28;
  ctx.strokeStyle = P.amarilloOsc;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x - 12, yTorre);
  ctx.lineTo(x - 3, yCima);
  ctx.moveTo(x + 12, yTorre);
  ctx.lineTo(x + 3, yCima);
  ctx.stroke();
  // Travesaño.
  ctx.fillStyle = P.amarilloOsc;
  ctx.fillRect(x - 4, yCima - 3, 8, 5);
  // Caja de equipos.
  ctx.fillStyle = "rgb(90 101 112)";
  ctx.beginPath();
  ctx.roundRect(x + 4, yTorre - 10, 12, 8, 2);
  ctx.fill();
  ctx.strokeStyle = "rgba(20,28,32,0.4)";
  ctx.lineWidth = 0.8;
  ctx.stroke();

  // ---- Mástil + antena + baliza --------------------------------------------
  ctx.strokeStyle = P.metal;
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.moveTo(x, yCima);
  ctx.lineTo(x, yCima - 14);
  ctx.stroke();
  ctx.strokeStyle = "rgb(208 214 220)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(x + 3, yCima - 14);
  ctx.lineTo(x + 4, yCima - 26);
  ctx.stroke();

  const on = Math.sin(t * 2.4) > 0.35;
  const yLuz = yCima - 16;
  if (on) {
    const halo = ctx.createRadialGradient(x, yLuz, 0, x, yLuz, 14);
    halo.addColorStop(0, "rgba(255,60,48,0.55)");
    halo.addColorStop(1, "rgba(255,60,48,0)");
    ctx.fillStyle = halo;
    ctx.beginPath();
    ctx.arc(x, yLuz, 14, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = on ? P.balizaOn : P.balizaOff;
  ctx.beginPath();
  ctx.arc(x, yLuz, on ? 3.6 : 2.8, 0, Math.PI * 2);
  ctx.fill();

  // Grillete de amarre bajo el collar.
  ctx.strokeStyle = P.sparClaro;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.ellipse(x, yCollar + 18, 5, 3, 0, 0, Math.PI * 2);
  ctx.stroke();

  // Amarres al lecho (catenaria suave).
  ctx.strokeStyle = "rgba(20,30,40,0.65)";
  ctx.lineWidth = 1.3;
  for (const s of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(x + s * 10, yCollar + 16);
    ctx.quadraticCurveTo(x + s * 50, yFondo - 20, x + s * 78, yFondo - 2);
    ctx.stroke();
    ctx.fillStyle = "rgb(74 83 90)";
    ctx.beginPath();
    ctx.ellipse(x + s * 78, yFondo - 1, 7, 3.5, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // Rótulo.
  if (sinRotulo) return;
  const texto = "Absorbedor puntual";
  ctx.font = "600 11px system-ui, sans-serif";
  ctx.textAlign = "center";
  const ancho = (ctx.measureText?.(texto)?.width ?? texto.length * 6) + 14;
  const yEt = yCima - 40;
  ctx.fillStyle = "rgba(15,26,36,0.78)";
  ctx.beginPath();
  ctx.roundRect(x - ancho / 2, yEt - 12, ancho, 17, 3);
  ctx.fill();
  ctx.fillStyle = "rgb(238 245 247)";
  ctx.fillText(texto, x, yEt);

  void hm0; // reservado: el calado visual se deriva de ySuperficie/yFondo
}
