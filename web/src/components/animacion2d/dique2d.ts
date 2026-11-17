// Dique mareal con turbina bulbo — capa 2D hiperrealista.
// Alineada con dique_esquema_general.jpg, dique_corte_turbina_bulbo.jpg y
// animacion3d/escenas/dique.ts: presa trapecio de hormigón, conducto con bulbo
// y rotor de 4 palas lima, flechas de llenado/vaciado, niveles distintos de
// mar y embalse. Autocontenida: sin estado de AnimacionCanvas.

export interface OptsDique2D {
  /** Centro horizontal del dique (píxeles). */
  cx: number;
  /** Nivel medio del mar (píxeles). */
  yMedio: number;
  /** Cota de apoyo / fondo bajo el dique (píxeles). */
  yFondo: number;
  /** Tiempo de animación en segundos. */
  t: number;
  /** Rango de marea en metros. */
  rangoMarea: number;
  /** Modo de operación (llenado | vaciado | bidireccional | bombeo | …). */
  modo?: string;
  /** Escala vertical en píxeles por metro. Por defecto se deriva del calado. */
  escalaV?: number;
  /** Omite los chips de nombre/salto (previstas de la pantalla de tecnología). */
  sinRotulo?: boolean;
}

const P = {
  hormigonAlto: "rgb(213 217 220)",
  hormigon: "rgb(197 201 204)",
  hormigonBajo: "rgb(142 150 156)",
  hormigonSombra: "rgb(89 99 107)",
  central: "rgb(70 82 92)",
  centralOscura: "rgb(47 58 68)",
  tunel: "rgb(29 48 60)",
  bulbo: "rgb(57 67 77)",
  pala: "rgb(199 225 74)",
  palaOsc: "rgb(138 163 32)",
  escollera: "rgb(106 114 120)",
  acento: "rgb(199 225 74)",
  aguaClara: "rgb(58 163 181)",
  flechaLlenado: "rgb(199 225 74)",
  flechaVaciado: "rgb(127 212 227)",
  espuma: "rgba(255,255,255,0.55)",
};

/** Flecha de dirección del paso de agua. */
function flecha(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  dir: number,
  color: string
): void {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(x + dir * 9, y);
  ctx.lineTo(x, y - 4);
  ctx.lineTo(x, y + 4);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x - dir * 2, y);
  ctx.lineTo(x + dir * 4, y);
  ctx.stroke();
}

/**
 * Dibuja un dique mareal en corte: presa trapecio, conducto con bulbo y
 * palas, lámina de embalse con nivel oscilante y flechas de llenado/vaciado.
 */
export function dibujarDique2D(ctx: CanvasRenderingContext2D, opts: OptsDique2D): void {
  const { cx, yMedio, yFondo, t, rangoMarea, sinRotulo = false } = opts;
  const modo = opts.modo ?? "";
  if (!(yFondo > yMedio + 30)) return;

  const alto = yFondo - yMedio;
  const coronacion = yMedio - Math.max(28, alto * 0.28);
  // En previstas (lienzo estrecho) el semi-ancho se recorta para que la
  // sección entera quepa sin comerse el embalse de la derecha.
  const anchoMax = Math.min(180, Math.max(85, alto * 1.15));
  const semiMar = Math.min(anchoMax, Math.max(70, alto * 1.05));
  const semiEmb = semiMar * 0.55;
  const semiCresta = Math.max(24, semiMar * 0.22);

  const escalaV =
    opts.escalaV ?? Math.max(2, Math.min(12, (yFondo - yMedio) / 18));

  const fase = Math.sin(t * 0.5);
  const saltoPx = (rangoMarea / 2) * escalaV * 0.9;
  const yEmbalse = yMedio + fase * saltoPx;

  // ---- Embalse (a la derecha del dique) ------------------------------------
  const xEmb0 = cx + semiCresta;
  const xEmb1 = cx + semiEmb + 90;
  ctx.beginPath();
  ctx.moveTo(xEmb0, yEmbalse);
  ctx.lineTo(xEmb1, yEmbalse);
  ctx.lineTo(xEmb1, yFondo + 4);
  ctx.lineTo(xEmb0, yFondo + 4);
  ctx.closePath();
  const vaso = ctx.createLinearGradient(0, yEmbalse, 0, yFondo);
  vaso.addColorStop(0, "oklch(0.62 0.085 165)");
  vaso.addColorStop(1, "oklch(0.38 0.06 200)");
  ctx.fillStyle = vaso;
  ctx.fill();
  ctx.fillStyle = P.espuma;
  ctx.fillRect(xEmb0, yEmbalse - 1.5, xEmb1 - xEmb0, 3);

  // ---- Sección del dique ---------------------------------------------------
  const seccion = () => {
    ctx.beginPath();
    ctx.moveTo(cx - semiMar, yFondo + 2);
    ctx.lineTo(cx - semiCresta, coronacion);
    ctx.lineTo(cx + semiCresta, coronacion);
    ctx.lineTo(cx + semiEmb, yFondo + 2);
    ctx.closePath();
  };

  seccion();
  const cuerpo = ctx.createLinearGradient(0, coronacion, 0, yFondo);
  cuerpo.addColorStop(0, P.hormigonAlto);
  cuerpo.addColorStop(0.45, P.hormigon);
  cuerpo.addColorStop(1, P.hormigonSombra);
  ctx.fillStyle = cuerpo;
  ctx.fill();
  ctx.strokeStyle = "rgba(40,48,55,0.55)";
  ctx.lineWidth = 1.4;
  ctx.stroke();

  // Juntas de hormigón (líneas horizontales tenues).
  ctx.save();
  seccion();
  ctx.clip();
  ctx.strokeStyle = "rgba(70,80,90,0.18)";
  ctx.lineWidth = 1;
  for (let i = 1; i <= 5; i++) {
    const yj = coronacion + ((yFondo - coronacion) * i) / 6;
    ctx.beginPath();
    ctx.moveTo(cx - semiMar, yj);
    ctx.lineTo(cx + semiEmb, yj);
    ctx.stroke();
  }
  ctx.restore();

  // Escollera sobre el talud de aguas afuera.
  ctx.fillStyle = P.escollera;
  ctx.globalAlpha = 0.85;
  for (let i = 0; i <= 22; i++) {
    const u = i / 22;
    const rx = cx - semiMar + u * (semiMar - semiCresta) + ((i * 7) % 6) - 3;
    const yTalud = yFondo + u * (coronacion - yFondo);
    ctx.beginPath();
    ctx.ellipse(rx, yTalud + ((i * 13) % 7) - 2, 5.5, 3.5, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  // ---- Coronación + central ------------------------------------------------
  ctx.fillStyle = P.hormigonSombra;
  ctx.fillRect(cx - semiCresta - 6, coronacion - 7, semiCresta * 2 + 12, 8);
  const gCentral = ctx.createLinearGradient(0, coronacion - 32, 0, coronacion - 6);
  gCentral.addColorStop(0, P.central);
  gCentral.addColorStop(1, P.centralOscura);
  ctx.fillStyle = gCentral;
  ctx.beginPath();
  ctx.roundRect(cx - semiCresta * 0.72, coronacion - 32, semiCresta * 1.44, 26, 2);
  ctx.fill();
  ctx.strokeStyle = "rgba(20,28,32,0.45)";
  ctx.lineWidth = 1.1;
  ctx.stroke();
  // Ventanas del edificio.
  ctx.fillStyle = "rgba(255,255,255,0.22)";
  for (let i = 0; i < 3; i++) {
    ctx.fillRect(cx - semiCresta * 0.5 + i * semiCresta * 0.4, coronacion - 26, 11, 8);
  }
  // Poste AT pequeño sobre la central (coherencia con la red).
  ctx.strokeStyle = P.centralOscura;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(cx, coronacion - 32);
  ctx.lineTo(cx, coronacion - 46);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(cx - 8, coronacion - 42);
  ctx.lineTo(cx + 8, coronacion - 42);
  ctx.stroke();

  // ---- Conducto + bulbo + palas -------------------------------------------
  const yTunel = coronacion + (yFondo - coronacion) * 0.58;
  const medioTunel = 20;

  ctx.save();
  seccion();
  ctx.clip();
  ctx.fillStyle = P.tunel;
  ctx.fillRect(cx - semiMar, yTunel - medioTunel, semiMar + semiEmb, medioTunel * 2);
  // Brillo interno del conducto.
  const gTun = ctx.createLinearGradient(0, yTunel - medioTunel, 0, yTunel + medioTunel);
  gTun.addColorStop(0, "rgba(255,255,255,0.06)");
  gTun.addColorStop(0.5, "rgba(0,0,0,0)");
  gTun.addColorStop(1, "rgba(0,0,0,0.18)");
  ctx.fillStyle = gTun;
  ctx.fillRect(cx - semiMar, yTunel - medioTunel, semiMar + semiEmb, medioTunel * 2);
  ctx.restore();

  ctx.save();
  seccion();
  ctx.clip();
  ctx.strokeStyle = P.hormigonSombra;
  ctx.lineWidth = 2.2;
  ctx.beginPath();
  ctx.moveTo(cx - semiMar, yTunel - medioTunel);
  ctx.lineTo(cx + semiEmb, yTunel - medioTunel);
  ctx.moveTo(cx - semiMar, yTunel + medioTunel);
  ctx.lineTo(cx + semiEmb, yTunel + medioTunel);
  ctx.stroke();
  ctx.restore();

  // Bulbo (generador estanco) aguas abajo del rodete.
  const gBulbo = ctx.createLinearGradient(cx + 10, yTunel - 12, cx + 10, yTunel + 12);
  gBulbo.addColorStop(0, "rgb(74 86 98)");
  gBulbo.addColorStop(1, P.bulbo);
  ctx.fillStyle = gBulbo;
  ctx.beginPath();
  ctx.ellipse(cx + 28, yTunel, 20, 11, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "rgba(20,28,32,0.55)";
  ctx.lineWidth = 1.3;
  ctx.stroke();

  // Carcasa del rodete.
  ctx.fillStyle = P.hormigonBajo;
  ctx.beginPath();
  ctx.arc(cx, yTunel, 15, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = P.hormigonSombra;
  ctx.lineWidth = 2;
  ctx.stroke();

  // Rotor de 4 palas lima (como la escena 3D).
  ctx.save();
  ctx.translate(cx, yTunel);
  ctx.rotate(t * 5 + Math.abs(fase) * 0.8);
  for (let i = 0; i < 4; i++) {
    const ang = (i * Math.PI) / 2;
    ctx.save();
    ctx.rotate(ang);
    const gPala = ctx.createLinearGradient(0, 0, 12, 0);
    gPala.addColorStop(0, P.palaOsc);
    gPala.addColorStop(1, P.pala);
    ctx.fillStyle = gPala;
    ctx.beginPath();
    ctx.moveTo(-2, 0);
    ctx.lineTo(-1.2, 12);
    ctx.lineTo(1.2, 12);
    ctx.lineTo(2, 0);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
  ctx.fillStyle = P.bulbo;
  ctx.beginPath();
  ctx.arc(0, 0, 4.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // ---- Flechas de llenado / vaciado ----------------------------------------
  const haciaEmbalse =
    modo === "llenado" || modo === "vaciado" || modo === "bidireccional" || modo === "bombeo"
      ? modo === "vaciado"
        ? false
        : true
      : fase > 0;

  const colorFlecha = haciaEmbalse ? P.flechaLlenado : P.flechaVaciado;
  for (let i = 0; i < 3; i++) {
    const fx = cx - semiCresta - 16 + i * 22;
    flecha(ctx, fx, yTunel + 14, haciaEmbalse ? 1 : -1, colorFlecha);
  }

  // ---- Cota del salto h ----------------------------------------------------
  const xCota = cx + semiEmb + 28;
  const yAlta = Math.min(yMedio, yEmbalse);
  const yBaja = Math.max(yMedio, yEmbalse);
  if (yBaja - yAlta > 3) {
    ctx.strokeStyle = "rgba(232,242,245,0.85)";
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(xCota, yAlta);
    ctx.lineTo(xCota, yBaja);
    ctx.moveTo(xCota - 4, yAlta + 4);
    ctx.lineTo(xCota, yAlta);
    ctx.lineTo(xCota + 4, yAlta + 4);
    ctx.moveTo(xCota - 4, yBaja - 4);
    ctx.lineTo(xCota, yBaja);
    ctx.lineTo(xCota + 4, yBaja - 4);
    ctx.stroke();
  }

  // Etiqueta de ciclo + salto.
  if (sinRotulo) return;
  const saltoM = rangoMarea * Math.abs(fase) * 0.5;
  const ciclo =
    ["llenado", "vaciado", "bidireccional", "bombeo"].includes(modo) && modo
      ? modo
      : haciaEmbalse
        ? "llenado"
        : "vaciado";
  const chipSalto = `Salto ${saltoM.toFixed(1).replace(".", ",")} m · ${ciclo}`;
  ctx.font = "11px system-ui, sans-serif";
  ctx.textAlign = "center";
  const anchoChip = (ctx.measureText?.(chipSalto)?.width ?? chipSalto.length * 6) + 12;
  ctx.fillStyle = "rgba(15,26,36,0.7)";
  ctx.beginPath();
  ctx.roundRect(cx - anchoChip / 2, coronacion - 55, anchoChip, 16, 3);
  ctx.fill();
  ctx.fillStyle = "rgb(238 245 247)";
  ctx.fillText(chipSalto, cx, coronacion - 44);

  const texto = "Dique mareal";
  const ancho = (ctx.measureText?.(texto)?.width ?? texto.length * 6) + 14;
  ctx.font = "600 11px system-ui, sans-serif";
  ctx.fillStyle = "rgba(15,26,36,0.78)";
  ctx.beginPath();
  ctx.roundRect(cx - ancho / 2, coronacion - 78, ancho, 17, 3);
  ctx.fill();
  ctx.fillStyle = "rgb(238 245 247)";
  ctx.fillText(texto, cx, coronacion - 66);
}
