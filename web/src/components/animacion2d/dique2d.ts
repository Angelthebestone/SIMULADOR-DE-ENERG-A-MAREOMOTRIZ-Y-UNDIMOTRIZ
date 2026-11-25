// Dique mareal con grupo bulbo — capa 2D.
// Alineada con dique_esquema_general.jpg, dique_corte_turbina_bulbo.jpg y
// animacion3d/escenas/dique.ts.
//
// Es un corte por el eje de un conducto de la central: el agua atraviesa el
// cuerpo de hormigón por una toma abocinada, rodea el bulbo estanco (dentro va
// el generador), pasa por el distribuidor y el rodete Kaplan y sale por el
// tubo difusor, que se ensancha para recuperar presión. El eje del rodete es
// horizontal y está en el plano del corte, así que sus palas se ven de canto y
// giran sobre ese eje, no como un ventilador de frente.
//
// El caudal sigue la continuidad: los filetes de agua corren más deprisa donde
// el conducto se estrecha y se frenan en el difusor. A la salida, el chorro
// turbulento remueve el agua y aflora en superficie.
// Autocontenida: sin estado de AnimacionCanvas.

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
  /** Nivel instantáneo del mar (marea). Si falta, el mar se queda en `yMedio`. */
  yMar?: number;
  /** Salto h en metros, con signo (+ = el mar está más alto: llenado). */
  saltoM?: number;
  /** Ángulo del rodete (rad), integrado con el caudal. */
  giro?: number;
  /** Avance del agua por el conducto (píxeles, con signo). */
  avance?: number;
  /** Perfil del terreno: el vaso se recorta contra él para quedar contenido. */
  terrenoY?: (px: number) => number;
  /** Borde derecho del vaso (píxeles). */
  xFinVaso?: number;
  /** Omite los chips de nombre/salto (previstas de la pantalla de tecnología). */
  sinRotulo?: boolean;
  /** Resguardo de la coronación sobre el nivel medio (px). */
  resguardoPx?: number;
  /** Caudal relativo con signo (+ hacia el embalse). Si falta, sale de √h. */
  caudal?: number;
  /** Apertura de las compuertas, 0 cerradas … 1 izadas. */
  apertura?: number;
}

const P = {
  hormigonAlto: "rgb(216 219 221)",
  hormigon: "rgb(196 200 203)",
  hormigonBajo: "rgb(150 157 162)",
  hormigonSombra: "rgb(96 105 112)",
  junta: "rgba(70,80,90,0.16)",
  central: "rgb(70 82 92)",
  centralOscura: "rgb(47 58 68)",
  aguaConducto: "rgb(36 84 92)",
  aguaConductoOsc: "rgb(20 52 60)",
  bulbo: "rgb(88 99 110)",
  bulboOsc: "rgb(52 62 72)",
  estator: "rgb(176 116 62)",
  pala: "rgb(199 225 74)",
  palaOsc: "rgb(120 146 26)",
  acero: "rgb(120 130 138)",
  escollera: "rgb(106 112 116)",
  acento: "rgb(199 225 74)",
  aguaVaso: "oklch(0.64 0.075 172)",
  aguaVasoFondo: "oklch(0.36 0.05 188)",
  flechaLlenado: "rgb(199 225 74)",
  flechaVaciado: "rgb(127 212 227)",
  espuma: "rgba(255,255,255,0.55)",
};

/** Ruido determinista 0..1 por índice. */
function azar(i: number, canal = 0): number {
  const s = Math.sin(i * 12.9898 + canal * 78.233) * 43758.5453;
  return s - Math.floor(s);
}

/** Geometría del cuerpo del dique. La publica el módulo para que la escena
 *  sepa dónde acaba el agua de cada lado. */
export function geometriaDique(cx: number, yMedio: number, yFondo: number, resguardoPx?: number) {
  const alto = yFondo - yMedio;
  const resguardo = resguardoPx ?? Math.max(40, alto * 0.3);
  const coronacion = yMedio - resguardo;
  const altoTotal = yFondo - coronacion;
  const semiBase = Math.max(64, Math.min(125, alto * 0.7));
  const semiTop = Math.max(24, semiBase * 0.45);
  const semiBaseEmb = semiBase * 0.85;
  /** Paramento de mar y de embalse a la cota y. */
  const caraMar = (y: number) => cx - semiTop - (semiBase - semiTop) * ((y - coronacion) / altoTotal);
  const caraEmb = (y: number) => cx + semiTop + (semiBaseEmb - semiTop) * ((y - coronacion) / altoTotal);
  const yTunel = coronacion + altoTotal * 0.6;
  const H0 = Math.max(8, Math.min(22, altoTotal * 0.12));
  return { alto, resguardo, coronacion, altoTotal, semiBase, semiTop, semiBaseEmb, caraMar, caraEmb, yTunel, H0 };
}

/** Flecha de dirección del paso de agua. */
function flecha(ctx: CanvasRenderingContext2D, x: number, y: number, dir: number, color: string): void {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(x + dir * 8, y);
  ctx.lineTo(x, y - 3.5);
  ctx.lineTo(x, y + 3.5);
  ctx.closePath();
  ctx.fill();
}

/** Pala Kaplan vista desde el corte: eje horizontal en el plano del dibujo.
 *  `beta` es el ángulo de la pala alrededor del eje. */
function palaKaplan(
  ctx: CanvasRenderingContext2D,
  xr: number,
  yr: number,
  R: number,
  rCubo: number,
  beta: number,
  oscura: boolean
) {
  const cb = Math.cos(beta);
  const sb = Math.sin(beta);
  const n = 6;
  const a: [number, number][] = [];
  const b: [number, number][] = [];
  for (let j = 0; j <= n; j++) {
    const u = j / n;
    const r = rCubo + (R - rCubo) * u;
    const cuerda = R * (0.62 - 0.12 * u);
    const tors = ((38 - 16 * u) * Math.PI) / 180;
    const cy = r * cb;
    const cz = r * sb;
    const dx = Math.sin(tors);
    const dy = -sb * Math.cos(tors);
    const dz = cb * Math.cos(tors);
    const proy = (x3: number, y3: number, z3: number): [number, number] => [xr + x3 + z3 * 0.28, yr - y3 + z3 * 0.1];
    a.push(proy(-0.4 * cuerda * dx, cy - 0.4 * cuerda * dy, cz - 0.4 * cuerda * dz));
    b.push(proy(0.6 * cuerda * dx, cy + 0.6 * cuerda * dy, cz + 0.6 * cuerda * dz));
  }
  const pts = [...a, ...b.reverse()];
  ctx.fillStyle = oscura ? P.palaOsc : P.pala;
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = "rgba(40,52,10,0.55)";
  ctx.lineWidth = 0.8;
  ctx.stroke();
}

/**
 * Dibuja un dique mareal en corte: cuerpo de hormigón con su conducto, grupo
 * bulbo, compuertas, lámina de embalse contenida por el terreno y cota del
 * salto.
 */
export function dibujarDique2D(ctx: CanvasRenderingContext2D, opts: OptsDique2D): void {
  const { cx, yMedio, yFondo, t, rangoMarea, sinRotulo = false } = opts;
  const modo = opts.modo ?? "";
  if (!(yFondo > yMedio + 30)) return;

  const g = geometriaDique(cx, yMedio, yFondo, opts.resguardoPx);
  const { coronacion, altoTotal, semiTop, caraMar, caraEmb, yTunel, H0 } = g;
  const sObra = Math.max(0.5, Math.min(1, g.resguardo / 40));
  const escalaV = opts.escalaV ?? Math.max(2, Math.min(12, (yFondo - yMedio) / 18));

  const fase = Math.sin(t * 0.5);
  const saltoPx = (rangoMarea / 2) * escalaV * 0.9;
  const yEmbalse = opts.yEmbalse ?? yMedio + Math.max(-26, Math.min(26, fase * saltoPx));
  const yMarAhora = opts.yMar ?? yMedio;
  const terreno = opts.terrenoY;
  const suelo = (px: number) => (terreno ? terreno(px) : yFondo);

  // Caudal con signo: + hacia el embalse. Sin salto explícito se deduce de las
  // láminas.
  const salto = opts.saltoM ?? (yEmbalse - yMarAhora) / Math.max(1, escalaV);
  const caudal = opts.caudal ?? Math.sign(salto) * Math.sqrt(Math.abs(salto));
  const apertura = Math.max(0, Math.min(1, opts.apertura ?? 1));
  const viveza = Math.min(1, Math.abs(caudal) / 1.2);
  // Sentido del paso: el del caudal; parado, el que marca el salto.
  const dir = Math.abs(caudal) > 1e-3 ? Math.sign(caudal) : salto >= 0 ? 1 : -1;

  // ---- Vaso: lámina recortada contra el terreno ---------------------------
  // El agua del vaso empieza detrás del dique (la obra la tapa) y muere en la
  // ladera de la otra orilla.
  const xEmb0 = cx;
  const xFinVaso = opts.xFinVaso ?? cx + g.semiBaseEmb + 150;
  let xBorde = xFinVaso;
  if (terreno) {
    for (let px = caraEmb(yEmbalse); px <= xFinVaso + 160; px += 3) {
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

    const brillo = ctx.createLinearGradient(0, yEmbalse, 0, yEmbalse + 26);
    brillo.addColorStop(0, "rgba(238,245,247,0.24)");
    brillo.addColorStop(1, "rgba(238,245,247,0)");
    ctx.fillStyle = brillo;
    ctx.fillRect(xEmb0, yEmbalse, xBorde - xEmb0, 26);

    // Lámina del vaso: ondulación corta de viento, no una regla.
    ctx.strokeStyle = "rgba(255,255,255,0.7)";
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    for (let px = xEmb0; px <= xBorde; px += 4) {
      const y = yEmbalse + Math.sin(px * 0.09 - t * 1.6) * 0.7 + Math.sin(px * 0.031 + t * 0.7) * 0.5;
      if (px === xEmb0) ctx.moveTo(px, y);
      else ctx.lineTo(px, y);
    }
    ctx.stroke();
    // Reflejos tenues bajo la lámina.
    ctx.strokeStyle = "rgba(255,255,255,0.1)";
    ctx.lineWidth = 1;
    for (let i = 1; i <= 3; i++) {
      const y = yEmbalse + i * 9 + Math.sin(t * 0.5 + i) * 1.2;
      const x0 = caraEmb(y) + 10;
      const x1 = xBorde - 12 - i * 14;
      if (x1 <= x0) continue;
      ctx.beginPath();
      ctx.moveTo(x0, y);
      ctx.lineTo(x1, y);
      ctx.stroke();
    }
  }

  // Destellos del sol en el oleaje corto del embalse.
  if (xBorde > xEmb0 + 20) {
    for (let i = 0; i < 18; i++) {
      const px = caraEmb(yEmbalse) + azar(i, 30) * Math.max(0, xBorde - caraEmb(yEmbalse) - 6);
      const brillo = Math.pow(Math.max(0, Math.sin(t * (2 + azar(i, 31) * 3) + i * 2.3)), 8);
      if (brillo < 0.08) continue;
      ctx.fillStyle = `rgba(255,253,240,${(0.85 * brillo).toFixed(3)})`;
      ctx.fillRect(px - 2, yEmbalse + Math.sin(px * 0.09 - t * 1.6) * 0.7 - 0.8, 3 + 3 * brillo, 1.2);
    }
  }

  // ---- Cuerpo del dique -----------------------------------------------------
  const xMarBase = caraMar(yFondo);
  const xEmbBase = caraEmb(yFondo);
  const seccion = () => {
    ctx.beginPath();
    ctx.moveTo(xMarBase, suelo(xMarBase) + 2);
    ctx.lineTo(caraMar(coronacion), coronacion);
    ctx.lineTo(caraEmb(coronacion), coronacion);
    ctx.lineTo(xEmbBase, suelo(xEmbBase) + 2);
    for (let px = xEmbBase; px >= xMarBase; px -= 5) ctx.lineTo(px, Math.max(yFondo, suelo(px)) + 2);
    ctx.closePath();
  };

  seccion();
  const cuerpo = ctx.createLinearGradient(0, coronacion, 0, yFondo);
  cuerpo.addColorStop(0, P.hormigonAlto);
  cuerpo.addColorStop(0.5, P.hormigon);
  cuerpo.addColorStop(1, P.hormigonBajo);
  ctx.fillStyle = cuerpo;
  ctx.fill();

  ctx.save();
  seccion();
  ctx.clip();
  // Tongadas de hormigonado y manchas de humedad bajo la carrera de marea.
  ctx.strokeStyle = P.junta;
  ctx.lineWidth = 1;
  for (let i = 1; i <= 6; i++) {
    const yj = coronacion + (altoTotal * i) / 7;
    ctx.beginPath();
    ctx.moveTo(xMarBase - 4, yj);
    ctx.lineTo(xEmbBase + 4, yj);
    ctx.stroke();
  }
  const humedad = ctx.createLinearGradient(0, yMedio - 20, 0, yMedio + 30);
  humedad.addColorStop(0, "rgba(60,80,70,0)");
  humedad.addColorStop(1, "rgba(60,80,70,0.16)");
  ctx.fillStyle = humedad;
  ctx.fillRect(xMarBase - 4, yMedio - 20, xEmbBase - xMarBase + 8, yFondo - yMedio + 30);

  // ---- Conducto: toma abocinada, tramo del bulbo y tubo difusor -------------
  const xIn = caraMar(yTunel) - 6;
  const xOut = caraEmb(yTunel) + 6;
  const L = xOut - xIn;
  const semiAlto = (px: number) => {
    const u = (px - xIn) / L;
    if (u < 0.2) return H0 * (1 + 0.5 * Math.pow(1 - u / 0.2, 2));
    if (u < 0.56) return H0;
    return H0 * (1 + 0.55 * Math.pow((u - 0.56) / 0.44, 1.2));
  };
  const conducto = () => {
    ctx.beginPath();
    ctx.moveTo(xIn, yTunel - semiAlto(xIn));
    for (let px = xIn; px <= xOut; px += 3) ctx.lineTo(px, yTunel - semiAlto(px));
    for (let px = xOut; px >= xIn; px -= 3) ctx.lineTo(px, yTunel + semiAlto(px));
    ctx.closePath();
  };
  conducto();
  const gAgua = ctx.createLinearGradient(0, yTunel - H0 * 1.6, 0, yTunel + H0 * 1.6);
  gAgua.addColorStop(0, P.aguaConducto);
  gAgua.addColorStop(1, P.aguaConductoOsc);
  ctx.fillStyle = gAgua;
  ctx.fill();
  ctx.strokeStyle = P.hormigonSombra;
  ctx.lineWidth = 1.6;
  ctx.stroke();

  // Filetes de agua por continuidad: avanzan a caudal constante, así que
  // corren donde el conducto se estrecha y se frenan en el difusor.
  const xr = xIn + L * 0.52;
  const xBulbo = xr - L * 0.2;
  const semiBulbo = L * 0.17;
  const altoBulbo = H0 * 0.6;
  if (opts.avance !== undefined && viveza > 0.02) {
    const N = 48;
    const acum: number[] = [0];
    for (let i = 1; i <= N; i++) {
      const x0 = xIn + (L * (i - 1)) / N;
      const x1 = xIn + (L * i) / N;
      acum.push(acum[i - 1] + 0.5 * (semiAlto(x0) + semiAlto(x1)) * (x1 - x0));
    }
    const total = acum[N];
    const xDeVolumen = (c: number) => {
      let i = 1;
      while (i < N && acum[i] < c) i++;
      const f = (c - acum[i - 1]) / Math.max(1e-6, acum[i] - acum[i - 1]);
      return xIn + (L * (i - 1 + f)) / N;
    };
    ctx.save();
    conducto();
    ctx.clip();
    ctx.lineCap = "round";
    for (let i = 0; i < 22; i++) {
      const c = (((azar(i, 1) * total + opts.avance * H0 * (0.85 + 0.3 * azar(i, 2))) % total) + total) % total;
      const px = xDeVolumen(c);
      const hh = semiAlto(px);
      const fila = (azar(i, 3) * 2 - 1) * 0.85;
      const py = yTunel + fila * hh;
      const largo = (4 + 12 * viveza) * (H0 / hh);
      const a = 0.5 * viveza * Math.min(1, Math.sin((c / total) * Math.PI) * 3);
      ctx.strokeStyle = `rgba(200,240,246,${a.toFixed(3)})`;
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(px - dir * largo, py);
      ctx.lineTo(px, py);
      ctx.stroke();
    }
    ctx.lineCap = "butt";
    ctx.restore();
  }

  // Ranuras de compuertas a la entrada y a la salida. En generación el
  // tablero está izado; en la espera baja y cierra el conducto. Bajan en
  // vertical desde la coronación, así que van dentro de su ancho.
  const xRanuraIn = caraMar(coronacion) + 9;
  const xRanuraOut = caraEmb(coronacion) - 9;
  for (const [xg, lado] of [
    [xRanuraIn, -1],
    [xRanuraOut, 1],
  ] as const) {
    const yTecho = yTunel - semiAlto(xg);
    ctx.fillStyle = "rgba(40,50,58,0.55)";
    ctx.fillRect(xg - 3, coronacion, 6, yTecho - coronacion);
    const altoTablero = semiAlto(xg) * 2;
    const yIzado = Math.max(coronacion + 2, yTecho - altoTablero - 4);
    const yCerrado = yTecho - 1;
    const yTab = yCerrado + (yIzado - yCerrado) * apertura;
    const altoVisible = apertura > 0.98 ? Math.min(altoTablero, yTecho - yTab - 2) : altoTablero + 1;
    ctx.fillStyle = P.acero;
    ctx.fillRect(xg - 2.5, yTab, 5, altoVisible);
    ctx.fillStyle = "rgba(20,26,30,0.5)";
    for (let k = 1; k < 4; k++) ctx.fillRect(xg - 2.5, yTab + (altoVisible * k) / 4, 5, 1);
    // Cable del torno que sostiene el tablero.
    ctx.strokeStyle = "rgba(30,36,40,0.7)";
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.moveTo(xg, coronacion);
    ctx.lineTo(xg, yTab);
    ctx.stroke();
    void lado;
  }

  // Pozo de acceso del bulbo: une su lomo con el techo del conducto.
  const yTechoBulbo = yTunel - semiAlto(xBulbo);
  ctx.fillStyle = P.hormigonBajo;
  ctx.fillRect(xBulbo - semiBulbo * 0.28, yTechoBulbo - 1, semiBulbo * 0.56, Math.max(0, yTunel - altoBulbo - yTechoBulbo + 3));

  // Bulbo estanco en corte: carcasa, generador y eje hasta el rodete.
  ctx.fillStyle = P.bulbo;
  ctx.beginPath();
  ctx.moveTo(xBulbo + semiBulbo, yTunel - altoBulbo);
  ctx.lineTo(xBulbo - semiBulbo * 0.55, yTunel - altoBulbo);
  ctx.quadraticCurveTo(xBulbo - semiBulbo * 1.25, yTunel - altoBulbo, xBulbo - semiBulbo * 1.3, yTunel);
  ctx.quadraticCurveTo(xBulbo - semiBulbo * 1.25, yTunel + altoBulbo, xBulbo - semiBulbo * 0.55, yTunel + altoBulbo);
  ctx.lineTo(xBulbo + semiBulbo, yTunel + altoBulbo);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = P.bulboOsc;
  ctx.lineWidth = 1.2;
  ctx.stroke();
  // Interior: estator del generador con sus bobinas, visto en corte.
  const xg0 = xBulbo - semiBulbo * 0.5;
  const xg1 = xBulbo + semiBulbo * 0.55;
  ctx.fillStyle = P.bulboOsc;
  ctx.fillRect(xg0, yTunel - altoBulbo * 0.72, xg1 - xg0, altoBulbo * 1.44);
  ctx.fillStyle = P.estator;
  const nBob = 6;
  for (let i = 0; i < nBob; i++) {
    const bx = xg0 + 2 + ((xg1 - xg0 - 4) * i) / nBob;
    const bw = (xg1 - xg0 - 4) / nBob - 1.5;
    ctx.fillRect(bx, yTunel - altoBulbo * 0.66, bw, altoBulbo * 0.3);
    ctx.fillRect(bx, yTunel + altoBulbo * 0.36, bw, altoBulbo * 0.3);
  }
  // Rotor del generador: gira con el rodete (una marca lo delata).
  ctx.fillStyle = P.acero;
  ctx.fillRect(xg0 + 2, yTunel - altoBulbo * 0.3, xg1 - xg0 - 4, altoBulbo * 0.6);
  // Sin ángulo integrado, un giro constante: t·caudal saltaría al cambiar el caudal.
  const giro = opts.giro ?? t * 2;
  const marca = Math.cos(giro);
  ctx.fillStyle = "rgba(255,255,255,0.35)";
  ctx.fillRect(xg0 + 2, yTunel - marca * altoBulbo * 0.26 - 1, xg1 - xg0 - 4, 2);
  // Eje hasta el rodete.
  ctx.fillStyle = P.bulboOsc;
  ctx.fillRect(xg1, yTunel - 2.5, xr - xg1, 5);

  // Distribuidor: álabes directrices en la corona aguas arriba del rodete.
  const xDist = xr - L * 0.06;
  ctx.strokeStyle = P.acero;
  ctx.lineWidth = 2;
  for (const s of [-1, 1]) {
    const y0 = yTunel + s * altoBulbo * 0.95;
    const y1 = yTunel + s * semiAlto(xDist) * 0.98;
    for (let i = 0; i < 3; i++) {
      const fx = xDist - 6 + i * 6;
      ctx.beginPath();
      ctx.moveTo(fx - 2, y0);
      ctx.lineTo(fx + 2, y1);
      ctx.stroke();
    }
  }

  // Rodete Kaplan de cuatro palas: eje horizontal, giro con el caudal.
  const R = semiAlto(xr) * 0.9;
  const rCubo = altoBulbo * 0.55;
  const angulos = [0, 1, 2, 3].map((i) => giro + (i * Math.PI) / 2);
  for (const b of angulos.filter((b) => Math.sin(b) < 0)) palaKaplan(ctx, xr, yTunel, R, rCubo, b, true);
  const gCubo = ctx.createLinearGradient(0, yTunel - rCubo, 0, yTunel + rCubo);
  gCubo.addColorStop(0, "rgb(150 160 168)");
  gCubo.addColorStop(1, P.bulboOsc);
  ctx.fillStyle = gCubo;
  ctx.beginPath();
  ctx.moveTo(xr - 6, yTunel - rCubo);
  ctx.lineTo(xr + 6, yTunel - rCubo * 0.9);
  ctx.quadraticCurveTo(xr + 16, yTunel, xr + 6, yTunel + rCubo * 0.9);
  ctx.lineTo(xr - 6, yTunel + rCubo);
  ctx.closePath();
  ctx.fill();
  for (const b of angulos.filter((b) => Math.sin(b) >= 0)) palaKaplan(ctx, xr, yTunel, R, rCubo, b, false);

  // Flechas del sentido del paso, discretas, en la toma.
  const colorFlecha = dir > 0 ? P.flechaLlenado : P.flechaVaciado;
  // En la espera no se rotula paso de agua aunque las compuertas aún se estén cerrando.
  if (viveza > 0.12 && modo !== "espera") {
    ctx.globalAlpha = 0.85;
    for (let i = 0; i < 3; i++) {
      const fx = (dir > 0 ? xIn + L * 0.78 : xIn + L * 0.86) + i * 9 * dir;
      flecha(ctx, fx, yTunel + semiAlto(fx) * 0.55, dir, colorFlecha);
    }
    ctx.globalAlpha = 1;
  }
  ctx.restore();

  // Paramentos: arista viva de la obra.
  seccion();
  ctx.strokeStyle = "rgba(40,48,55,0.55)";
  ctx.lineWidth = 1.4;
  ctx.stroke();

  // ---- Chorro a la salida -----------------------------------------------------
  // Remolinos que se abren y se apagan aguas abajo; si llegan arriba, la
  // superficie hierve.
  if (viveza > 0.05) {
    const xSal = dir > 0 ? xOut - 6 : xIn + 6;
    const yLamina = dir > 0 ? yEmbalse : yMarAhora;
    const hSal = semiAlto(dir > 0 ? xOut : xIn);
    for (let i = 0; i < 26; i++) {
      // Avance monótono con el reloj: el caudal cambia la intensidad, no el
      // ritmo, para que mover un mando no haga saltar los remolinos.
      const p = (((azar(i, 4) + t * (0.2 + 0.12 * azar(i, 5))) % 1) + 1) % 1;
      const d = p * (90 + 70 * viveza);
      const abre = hSal * (0.6 + 1.6 * p);
      const px = xSal + dir * d;
      const py = yTunel + Math.sin(azar(i, 6) * 6.28 + p * 7 + t * 1.5) * abre * (0.4 + 0.6 * azar(i, 7));
      if (py < yLamina + 4 || py > suelo(px) - 3) continue;
      const r = 1.2 + p * 3.2 * azar(i, 8);
      ctx.strokeStyle = `rgba(226,246,248,${(0.5 * viveza * (1 - p)).toFixed(3)})`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(px, py, r, 0, Math.PI * 2);
      ctx.stroke();
    }
    // Afloramiento del chorro en la lámina de aguas abajo.
    if (viveza > 0.25) {
      for (let i = 0; i < 9; i++) {
        const p = (((azar(i, 9) + t * 0.18) % 1) + 1) % 1;
        const px = xSal + dir * (40 + p * 70);
        ctx.fillStyle = `rgba(250,252,248,${(0.45 * viveza * Math.sin(p * Math.PI)).toFixed(3)})`;
        ctx.beginPath();
        ctx.ellipse(px, yLamina + 1, 3 + p * 6, 1.4, 0, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  // Escollera de protección al pie de ambos paramentos.
  ctx.fillStyle = P.escollera;
  for (const [x0, x1] of [
    [xMarBase - 34, xMarBase + 8],
    [xEmbBase - 6, xEmbBase + 30],
  ] as const) {
    for (let i = 0; i < 10; i++) {
      const rx = x0 + ((x1 - x0) * i) / 9 + (azar(i, 10) - 0.5) * 4;
      const base = Math.max(yFondo, suelo(rx));
      const ry = base - 2 - azar(i, 11) * 5;
      ctx.beginPath();
      ctx.ellipse(rx, ry, 4.5 + azar(i, 12) * 2.5, 3 + azar(i, 13) * 1.5, azar(i, 14), 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // ---- Coronación: calzada, pórtico grúa y edificio de control ----------------
  const xc0 = caraMar(coronacion);
  const xc1 = caraEmb(coronacion);
  ctx.fillStyle = P.hormigonSombra;
  ctx.fillRect(xc0 - 5, coronacion - 6 * sObra, xc1 - xc0 + 10, 6 * sObra);
  // Pretiles.
  ctx.fillStyle = P.hormigonBajo;
  ctx.fillRect(xc0 - 5, coronacion - 10 * sObra, 3, 4 * sObra);
  ctx.fillRect(xc1 + 2, coronacion - 10 * sObra, 3, 4 * sObra);
  // Edificio de control, del lado del embalse.
  const anchoEd = semiTop * 0.9;
  const xEd = cx + semiTop * 0.05;
  const altoEd = 24 * sObra;
  const gCentral = ctx.createLinearGradient(0, coronacion - 6 * sObra - altoEd, 0, coronacion - 6 * sObra);
  gCentral.addColorStop(0, P.central);
  gCentral.addColorStop(1, P.centralOscura);
  ctx.fillStyle = gCentral;
  ctx.beginPath();
  ctx.roundRect(xEd, coronacion - 6 * sObra - altoEd, anchoEd, altoEd, 2);
  ctx.fill();
  ctx.fillStyle = "rgba(220,236,240,0.3)";
  for (let i = 0; i < 3; i++) {
    ctx.fillRect(xEd + 4 + i * (anchoEd - 8) * 0.34, coronacion - 6 * sObra - altoEd + 6 * sObra, (anchoEd - 8) * 0.24, 7 * sObra);
  }
  // Pórtico grúa sobre las ranuras de compuertas de la toma.
  const xGrua = xRanuraIn + 4 * sObra;
  const yViga = coronacion - 6 * sObra - 30 * sObra;
  ctx.strokeStyle = P.centralOscura;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(xGrua - 12 * sObra, coronacion - 6 * sObra);
  ctx.lineTo(xGrua - 9 * sObra, yViga);
  ctx.moveTo(xGrua + 12 * sObra, coronacion - 6 * sObra);
  ctx.lineTo(xGrua + 9 * sObra, yViga);
  ctx.moveTo(xGrua - 14 * sObra, yViga);
  ctx.lineTo(xGrua + 14 * sObra, yViga);
  ctx.stroke();
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(xGrua, yViga);
  ctx.lineTo(xGrua, yViga + 9 * sObra);
  ctx.stroke();
  ctx.fillStyle = "rgb(226 176 40)";
  ctx.fillRect(xGrua - 4 * sObra, yViga - 4 * sObra, 8 * sObra, 4 * sObra);

  // ---- Cota del salto h ------------------------------------------------------
  const xCota = caraEmb(yMedio) + 30;
  const yAlta = Math.min(yMarAhora, yEmbalse);
  const yBaja = Math.max(yMarAhora, yEmbalse);
  if (opts.yMar !== undefined) {
    ctx.strokeStyle = P.acento;
    ctx.lineWidth = 1.2;
    ctx.setLineDash([5, 4]);
    ctx.beginPath();
    ctx.moveTo(caraMar(yMarAhora) - 20, yMarAhora);
    ctx.lineTo(xCota + 10, yMarAhora);
    ctx.stroke();
    ctx.setLineDash([]);
  }
  if (yBaja - yAlta > 2) {
    ctx.strokeStyle = opts.yMar !== undefined ? P.acento : "rgba(238,245,247,0.9)";
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.moveTo(xCota, yAlta);
    ctx.lineTo(xCota, yBaja);
    if (yBaja - yAlta > 9) {
      ctx.moveTo(xCota - 4, yAlta + 4);
      ctx.lineTo(xCota, yAlta);
      ctx.lineTo(xCota + 4, yAlta + 4);
      ctx.moveTo(xCota - 4, yBaja - 4);
      ctx.lineTo(xCota, yBaja);
      ctx.lineTo(xCota + 4, yBaja - 4);
    }
    ctx.stroke();
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

  const saltoM = Math.abs(salto);
  const ciclo =
    ["llenado", "vaciado", "bidireccional", "bombeo", "espera"].includes(modo) && modo
      ? modo === "espera"
        ? "en espera"
        : modo
      : dir > 0
        ? "llenado"
        : "vaciado";

  // Chip del salto junto a la cota: el número y la altura medida se leen en
  // el mismo sitio. Por encima de las dos láminas para no tapar el agua.
  const chipSalto = `Salto h = ${saltoM.toFixed(1).replace(".", ",")} m · ${ciclo}`;
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

  const texto = "Dique de marea";
  ctx.font = "600 12px system-ui, sans-serif";
  const ancho = (ctx.measureText?.(texto)?.width ?? texto.length * 6.5) + 16;
  const yEt = yViga - 16;
  ctx.fillStyle = "rgba(15,26,36,0.8)";
  ctx.beginPath();
  ctx.roundRect(cx - ancho / 2, yEt - 14, ancho, 19, 3);
  ctx.fill();
  ctx.fillStyle = "rgb(238 245 247)";
  ctx.fillText(texto, cx, yEt);
}
