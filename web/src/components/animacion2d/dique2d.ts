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
  /** Nivel de la lámina del vaso. Si falta, se anima con `rangoMarea`. */
  yEmbalse?: number;
  /** Perfil del terreno: el vaso se recorta contra él para quedar contenido. */
  terrenoY?: (px: number) => number;
  /** Borde derecho del vaso (píxeles). */
  xFinVaso?: number;
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
  aguaVaso: "oklch(0.66 0.08 170)",
  aguaVasoFondo: "oklch(0.4 0.05 188)",
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
 * palas, lámina de embalse contenida por el terreno y cota del salto.
 */
export function dibujarDique2D(ctx: CanvasRenderingContext2D, opts: OptsDique2D): void {
  const { cx, yMedio, yFondo, t, rangoMarea, sinRotulo = false } = opts;
  const modo = opts.modo ?? "";
  if (!(yFondo > yMedio + 30)) return;

  const alto = yFondo - yMedio;
  // Coronación con resguardo: el vaso nunca llega a rebasar la obra.
  const coronacion = yMedio - Math.max(40, alto * 0.3);
  const semiMar = Math.min(150, Math.max(80, alto * 0.85));
  const semiEmb = semiMar * 0.55;
  const semiCresta = Math.max(24, semiMar * 0.22);

  const escalaV = opts.escalaV ?? Math.max(2, Math.min(12, (yFondo - yMedio) / 18));

  const fase = Math.sin(t * 0.5);
  const saltoPx = (rangoMarea / 2) * escalaV * 0.9;
  const yEmbalse =
    opts.yEmbalse ?? yMedio + Math.max(-26, Math.min(26, fase * saltoPx));

  // ---- Vaso: lámina recortada contra el terreno ---------------------------
  // El agua no es una caja: su fondo sigue el terreno y su borde derecho es la
  // otra orilla, que la contiene. Así se lee como estuario y no como un
  // rectángulo flotante junto al dique.
  const xEmb0 = cx + semiCresta;
  const xFinVaso = opts.xFinVaso ?? cx + semiEmb + 150;
  const terreno = opts.terrenoY;
  let xBorde = xFinVaso;
  if (terreno) {
    // El borde es la otra orilla: se busca hasta el final del lienzo, no hasta
    // el límite del vaso, para que el agua muera en la ladera y no en una
    // arista vertical.
    for (let px = xEmb0; px <= xFinVaso + 140; px += 3) {
      if (terreno(px) < yEmbalse) {
        xBorde = px;
        break;
      }
    }
  }
  if (xBorde > xEmb0 + 4) {
    ctx.beginPath();
    ctx.moveTo(xEmb0, yEmbalse);
    ctx.lineTo(xBorde, yEmbalse);
    if (terreno) {
      for (let px = xBorde; px >= xEmb0; px -= 3) ctx.lineTo(px, terreno(px) + 1);
    } else {
      ctx.lineTo(xBorde, yFondo + 4);
      ctx.lineTo(xEmb0, yFondo + 4);
    }
    ctx.closePath();
    const vaso = ctx.createLinearGradient(0, yEmbalse, 0, yFondo + 10);
    vaso.addColorStop(0, P.aguaVaso);
    vaso.addColorStop(1, P.aguaVasoFondo);
    ctx.fillStyle = vaso;
    ctx.fill();

    // Reflejo del cielo en la primera franja del vaso: da profundidad sin
    // convertirlo en una lámina opaca.
    const brillo = ctx.createLinearGradient(0, yEmbalse, 0, yEmbalse + 22);
    brillo.addColorStop(0, "rgba(238,245,247,0.22)");
    brillo.addColorStop(1, "rgba(238,245,247,0)");
    ctx.fillStyle = brillo;
    ctx.fillRect(xEmb0, yEmbalse, xBorde - xEmb0, 22);

    // Lámina: una línea de espuma, no un borde de caja.
    ctx.fillStyle = P.espuma;
    ctx.fillRect(xEmb0, yEmbalse - 1.5, xBorde - xEmb0, 3);

    // Reflejos tenues que siguen la superficie.
    ctx.strokeStyle = "rgba(255,255,255,0.12)";
    ctx.lineWidth = 1;
    for (let i = 1; i <= 3; i++) {
      const y = yEmbalse + i * 9 + Math.sin(t * 0.5 + i) * 1.2;
      ctx.beginPath();
      ctx.moveTo(xEmb0 + 12, y);
      ctx.lineTo(xBorde - 12 - i * 10, y);
      ctx.stroke();
    }
  }

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
      : yEmbalse > yMedio;

  const colorFlecha = haciaEmbalse ? P.flechaLlenado : P.flechaVaciado;
  for (let i = 0; i < 3; i++) {
    const fx = cx - semiCresta - 16 + i * 22;
    flecha(ctx, fx, yTunel + 14, haciaEmbalse ? 1 : -1, colorFlecha);
  }

  // ---- Cota del salto h ----------------------------------------------------
  // La cota vive a la derecha del dique, entre las dos láminas: es la variable
  // que mueve la turbina y la que el estudiante tiene que poder leer.
  const xCota = cx + semiEmb + 30;
  const yAlta = Math.min(yMedio, yEmbalse);
  const yBaja = Math.max(yMedio, yEmbalse);
  if (yBaja - yAlta > 2) {
    ctx.strokeStyle = "rgba(238,245,247,0.9)";
    ctx.lineWidth = 1.3;
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
    // Guías cortas en los dos niveles.
    ctx.strokeStyle = "rgba(238,245,247,0.55)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(xCota - 16, yAlta);
    ctx.lineTo(xCota + 8, yAlta);
    ctx.moveTo(xCota - 16, yBaja);
    ctx.lineTo(xCota + 8, yBaja);
    ctx.stroke();
  }

  if (sinRotulo) return;

  const saltoM = Math.abs(yEmbalse - yMedio) / Math.max(1, escalaV);
  const ciclo =
    ["llenado", "vaciado", "bidireccional", "bombeo"].includes(modo) && modo
      ? modo
      : haciaEmbalse
        ? "llenado"
        : "vaciado";

  // Chip del salto junto a la cota, no en la coronación: así el número y la
  // altura medida se leen en el mismo sitio.
  const chipSalto = `Salto ${saltoM.toFixed(1).replace(".", ",")} m · ${ciclo}`;
  ctx.font = "12px system-ui, sans-serif";
  ctx.textAlign = "center";
  const anchoSalto = (ctx.measureText?.(chipSalto)?.width ?? chipSalto.length * 6.5) + 14;
  const ySalto = Math.min(Math.max((yAlta + yBaja) / 2 + 4, yAlta + 14), yBaja - 6);
  ctx.fillStyle = "rgba(15,26,36,0.72)";
  ctx.beginPath();
  ctx.roundRect(xCota + 12, ySalto - 13, anchoSalto, 18, 3);
  ctx.fill();
  ctx.fillStyle = "rgb(238 245 247)";
  ctx.fillText(chipSalto, xCota + 12 + anchoSalto / 2, ySalto);

  const texto = "Dique mareal";
  ctx.font = "600 12px system-ui, sans-serif";
  const ancho = (ctx.measureText?.(texto)?.width ?? texto.length * 6.5) + 16;
  ctx.fillStyle = "rgba(15,26,36,0.8)";
  ctx.beginPath();
  ctx.roundRect(cx - ancho / 2, coronacion - 72, ancho, 19, 3);
  ctx.fill();
  ctx.fillStyle = "rgb(238 245 247)";
  ctx.fillText(texto, cx, coronacion - 59);
}
