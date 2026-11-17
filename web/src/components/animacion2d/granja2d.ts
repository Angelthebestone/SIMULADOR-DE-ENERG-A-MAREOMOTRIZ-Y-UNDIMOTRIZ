// Granja de turbinas de corriente mareal — capa 2D hiperrealista.
// Alineada con mareomotriz_granja_turbinas_corriente.jpg y animacion3d/escenas/granja.ts:
// embudo/torreta sobre el agua, baliza roja/blanca, pilar metálico, base circular
// de gravedad, rotor tripala ROJO con puntas NARANJAS (escorzo por cos del giro),
// marca de oleaje en la torreta y lecho arenoso. Las palas NO son grises.
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
  /** Unidades de la granja (1–6). La principal va en `x`. */
  cantidadUnidades?: number;
  /** Tipo de cimentación (por defecto gravedad, como la referencia). */
  cimentacion?: Cimentacion2D;
  /** Omite el chip del nombre (previstas de la pantalla de tecnología). */
  sinRotulo?: boolean;
}

/** Paleta alineada con la escena 3D y el manual UTS. */
const P = {
  metalAlto: "rgb(221 227 232)",
  metal: "rgb(197 204 210)",
  metalBajo: "rgb(138 147 155)",
  metalSombra: "rgb(92 101 110)",
  base: "rgb(110 120 128)",
  baseOscura: "rgb(74 83 90)",
  rojoPala: "rgb(212 31 31)",
  rojoPalaOsc: "rgb(154 20 20)",
  naranjaPala: "rgb(240 154 24)",
  naranjaClaro: "rgb(255 193 74)",
  balizaRojo: "rgb(224 48 48)",
  balizaRojoOsc: "rgb(122 24 18)",
  balizaBlanco: "rgb(244 244 244)",
  arena: "rgb(196 168 106)",
  arenaOscura: "rgb(138 115 64)",
  cable: "rgb(26 34 40)",
  acento: "rgb(199 225 74)",
  espuma: "rgba(255,255,255,0.55)",
};

function destelloBaliza(t: number): boolean {
  return Math.sin(t * 3) > 0.4;
}

/** Pilar metálico con degradado cilíndrico y juntas. */
function dibujarPilar(
  ctx: CanvasRenderingContext2D,
  x: number,
  yCorona: number,
  yBase: number
): void {
  const ancho = 11;
  const g = ctx.createLinearGradient(x - ancho, 0, x + ancho, 0);
  g.addColorStop(0, P.metalSombra);
  g.addColorStop(0.28, P.metalAlto);
  g.addColorStop(0.55, P.metal);
  g.addColorStop(1, P.metalSombra);
  ctx.fillStyle = g;
  ctx.fillRect(x - ancho, yCorona, ancho * 2, yBase - yCorona);
  ctx.strokeStyle = "rgba(30,40,48,0.45)";
  ctx.lineWidth = 1;
  ctx.strokeRect(x - ancho, yCorona, ancho * 2, yBase - yCorona);

  // Juntas / anillos del fuste.
  ctx.strokeStyle = P.metalBajo;
  ctx.lineWidth = 1.6;
  const n = 3;
  for (let i = 1; i <= n; i++) {
    const yj = yCorona + ((yBase - yCorona) * i) / (n + 1);
    ctx.beginPath();
    ctx.moveTo(x - ancho, yj);
    ctx.lineTo(x + ancho, yj);
    ctx.stroke();
  }
}

/** Base circular de gravedad + anillo de lastre + sombra en el lecho. */
function dibujarBaseGravedad(
  ctx: CanvasRenderingContext2D,
  x: number,
  yFondo: number
): void {
  // Sombra proyectada en la arena.
  ctx.fillStyle = "rgba(20,28,32,0.28)";
  ctx.beginPath();
  ctx.ellipse(x + 4, yFondo + 6, 42, 8, 0, 0, Math.PI * 2);
  ctx.fill();

  // Plinto.
  const g = ctx.createLinearGradient(0, yFondo - 28, 0, yFondo + 4);
  g.addColorStop(0, P.base);
  g.addColorStop(1, P.baseOscura);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(x - 38, yFondo);
  ctx.lineTo(x - 30, yFondo - 26);
  ctx.lineTo(x + 30, yFondo - 26);
  ctx.lineTo(x + 38, yFondo);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = "rgba(20,28,32,0.55)";
  ctx.lineWidth = 1.3;
  ctx.stroke();

  // Elipse superior del plinto (vista en planta levemente asomada).
  ctx.fillStyle = P.base;
  ctx.beginPath();
  ctx.ellipse(x, yFondo - 26, 30, 6, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = P.baseOscura;
  ctx.lineWidth = 1.2;
  ctx.stroke();

  // Anillo de lastre.
  ctx.strokeStyle = P.metalBajo;
  ctx.lineWidth = 2.4;
  ctx.beginPath();
  ctx.ellipse(x, yFondo - 20, 22, 4.5, 0, 0, Math.PI * 2);
  ctx.stroke();

  // Bolardos perimetrales.
  ctx.fillStyle = P.metalSombra;
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    ctx.beginPath();
    ctx.ellipse(x + Math.cos(a) * 26, yFondo - 22 + Math.sin(a) * 3.5, 2.2, 1.6, 0, 0, Math.PI * 2);
    ctx.fill();
  }
}

/** Pilote clavado / trípode (variantes de cimentación). */
function dibujarOtraCimentacion(
  ctx: CanvasRenderingContext2D,
  x: number,
  yFondo: number,
  tipo: Cimentacion2D
): void {
  ctx.fillStyle = "rgba(20,28,32,0.25)";
  ctx.beginPath();
  ctx.ellipse(x + 3, yFondo + 5, 28, 6, 0, 0, Math.PI * 2);
  ctx.fill();

  if (tipo === "tripode") {
    ctx.strokeStyle = P.baseOscura;
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(x, yFondo - 48);
    ctx.lineTo(x - 36, yFondo - 2);
    ctx.moveTo(x, yFondo - 48);
    ctx.lineTo(x + 36, yFondo - 2);
    ctx.moveTo(x, yFondo - 48);
    ctx.lineTo(x + 4, yFondo - 2);
    ctx.stroke();
    ctx.fillStyle = P.base;
    ctx.beginPath();
    ctx.ellipse(x, yFondo - 2, 18, 4, 0, 0, Math.PI * 2);
    ctx.fill();
  } else {
    const g = ctx.createLinearGradient(x - 10, 0, x + 10, 0);
    g.addColorStop(0, P.metalSombra);
    g.addColorStop(0.4, P.metal);
    g.addColorStop(1, P.metalSombra);
    ctx.fillStyle = g;
    ctx.fillRect(x - 9, yFondo - 22, 18, 24);
    ctx.fillStyle = P.baseOscura;
    ctx.beginPath();
    ctx.ellipse(x, yFondo, 20, 5, 0, 0, Math.PI * 2);
    ctx.fill();
  }
}

/** Embudo/cono truncado + plataforma + barandilla sobre la superficie. */
function dibujarEmbudo(
  ctx: CanvasRenderingContext2D,
  x: number,
  yCorona: number
): void {
  // Perfil del embudo: cuello estrecho → aleta ancha.
  const hEmb = 28;
  const g = ctx.createLinearGradient(x - 22, 0, x + 22, 0);
  g.addColorStop(0, P.metalSombra);
  g.addColorStop(0.3, P.metalAlto);
  g.addColorStop(0.65, P.metal);
  g.addColorStop(1, P.metalSombra);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(x - 8, yCorona);
  ctx.quadraticCurveTo(x - 14, yCorona - hEmb * 0.35, x - 20, yCorona - hEmb * 0.75);
  ctx.lineTo(x - 22, yCorona - hEmb);
  ctx.lineTo(x + 22, yCorona - hEmb);
  ctx.lineTo(x + 20, yCorona - hEmb * 0.75);
  ctx.quadraticCurveTo(x + 14, yCorona - hEmb * 0.35, x + 8, yCorona);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = "rgba(30,40,48,0.4)";
  ctx.lineWidth = 1;
  ctx.stroke();

  // Plataforma superior.
  ctx.fillStyle = P.metal;
  ctx.beginPath();
  ctx.ellipse(x, yCorona - hEmb, 22, 5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = P.metalBajo;
  ctx.lineWidth = 1.2;
  ctx.stroke();

  // Barandilla.
  ctx.strokeStyle = P.metalBajo;
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.ellipse(x, yCorona - hEmb - 10, 20, 4, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.lineWidth = 1;
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const bx = x + Math.cos(a) * 20;
    ctx.beginPath();
    ctx.moveTo(bx, yCorona - hEmb);
    ctx.lineTo(bx, yCorona - hEmb - 10);
    ctx.stroke();
  }
}

/** Baliza de navegación: tramos alternos rojo/blanco + destello. */
function dibujarBaliza(
  ctx: CanvasRenderingContext2D,
  x: number,
  yBase: number,
  t: number
): void {
  // Mástil.
  ctx.strokeStyle = P.metalBajo;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x, yBase);
  ctx.lineTo(x, yBase - 8);
  ctx.stroke();

  const nSeg = 6;
  const hSeg = 5;
  const wSeg = 5;
  for (let i = 0; i < nSeg; i++) {
    const y = yBase - 8 - (i + 1) * hSeg;
    ctx.fillStyle = i % 2 === 0 ? P.balizaRojo : P.balizaBlanco;
    ctx.fillRect(x - wSeg, y, wSeg * 2, hSeg - 0.5);
  }
  // Tapa.
  ctx.fillStyle = P.balizaRojo;
  ctx.beginPath();
  ctx.ellipse(x, yBase - 8 - nSeg * hSeg, wSeg + 1, 2, 0, 0, Math.PI * 2);
  ctx.fill();

  // Luz + halo.
  const on = destelloBaliza(t);
  const yLuz = yBase - 8 - nSeg * hSeg - 4;
  if (on) {
    const halo = ctx.createRadialGradient(x, yLuz, 0, x, yLuz, 12);
    halo.addColorStop(0, "rgba(255,80,60,0.55)");
    halo.addColorStop(1, "rgba(255,80,60,0)");
    ctx.fillStyle = halo;
    ctx.beginPath();
    ctx.arc(x, yLuz, 12, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = on ? "rgb(255 74 58)" : P.balizaRojoOsc;
  ctx.beginPath();
  ctx.arc(x, yLuz, 3, 0, Math.PI * 2);
  ctx.fill();
}

/** Rotor tripala rojo con puntas naranjas y escorzo por cos(giro). */
function dibujarRotor(
  ctx: CanvasRenderingContext2D,
  x: number,
  yRotor: number,
  t: number,
  velocidadCorriente: number,
  escala = 1
): void {
  const radio = 52 * escala;
  const giro = t * velocidadCorriente * 2.1;

  // Góndola.
  const gg = ctx.createLinearGradient(x - 6, yRotor - 10, x + 6, yRotor + 10);
  gg.addColorStop(0, P.metalSombra);
  gg.addColorStop(0.5, P.metalBajo);
  gg.addColorStop(1, P.metalSombra);
  ctx.fillStyle = gg;
  ctx.beginPath();
  ctx.roundRect(x - 7, yRotor - 11 * escala, 40 * escala, 22 * escala, 10);
  ctx.fill();
  ctx.strokeStyle = "rgba(20,28,32,0.5)";
  ctx.lineWidth = 1.2;
  ctx.stroke();

  // Brazo góndola → pilar (si el eje está desplazado).
  ctx.fillStyle = P.metalSombra;
  ctx.fillRect(x - 2, yRotor - 4, 10, 8);

  ctx.save();
  ctx.translate(x, yRotor);
  for (let i = 0; i < 3; i++) {
    const ang = giro + (i * Math.PI * 2) / 3;
    const escorzo = Math.max(0.18, Math.abs(Math.cos(ang)));
    ctx.save();
    ctx.rotate(ang);
    ctx.scale(escorzo, 1);

    // Tramo raíz–medio (rojo).
    const pala = ctx.createLinearGradient(0, 0, 0, -radio);
    pala.addColorStop(0, P.rojoPalaOsc);
    pala.addColorStop(0.35, P.rojoPala);
    pala.addColorStop(0.82, P.rojoPala);
    pala.addColorStop(1, P.naranjaPala);
    ctx.fillStyle = pala;
    ctx.beginPath();
    ctx.moveTo(-5, 0);
    ctx.quadraticCurveTo(-9, -radio * 0.5, -2, -radio * 0.88);
    ctx.lineTo(-1.2, -radio);
    ctx.quadraticCurveTo(4.5, -radio * 0.55, 5.5, 0);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = "rgba(30,20,20,0.45)";
    ctx.lineWidth = 0.8;
    ctx.stroke();

    // Punta naranja (marca de la referencia).
    ctx.fillStyle = P.naranjaPala;
    ctx.beginPath();
    ctx.moveTo(-2, -radio * 0.88);
    ctx.lineTo(-1.2, -radio);
    ctx.quadraticCurveTo(2.5, -radio * 0.9, 3.2, -radio * 0.86);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
  // Buje.
  const buje = ctx.createRadialGradient(0, -2, 1, 0, 0, 8);
  buje.addColorStop(0, P.metalAlto);
  buje.addColorStop(1, P.metalSombra);
  ctx.fillStyle = buje;
  ctx.beginPath();
  ctx.arc(0, 0, 7 * escala, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/** Cable sobre el lecho entre unidades (detalle de la referencia 3D). */
function dibujarCableLecho(
  ctx: CanvasRenderingContext2D,
  x0: number,
  x1: number,
  yFondo: number,
  t: number
): void {
  const y = yFondo - 2;
  ctx.strokeStyle = P.cable;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x0, y);
  ctx.quadraticCurveTo((x0 + x1) / 2, y - 6, x1, y);
  ctx.stroke();

  const frac = (t * 0.22) % 1;
  const px = (1 - frac) * x0 + frac * x1;
  const py = y - 4 * Math.sin(frac * Math.PI);
  ctx.fillStyle = P.acento;
  ctx.beginPath();
  ctx.arc(px, py, 2.2, 0, Math.PI * 2);
  ctx.fill();
}

/**
 * Dibuja una granja de turbinas de corriente mareal (1–6 unidades).
 * La unidad principal se centra en `opts.x`; las adicionales se disponen
 * a ambos lados con escala ligeramente menor (fila en profundidad).
 */
export function dibujarGranja2D(ctx: CanvasRenderingContext2D, opts: OptsGranja2D): void {
  const {
    x,
    ySuperficie,
    yFondo,
    t,
    velocidadCorriente,
    cantidadUnidades = 1,
    cimentacion = "gravedad",
    sinRotulo = false,
  } = opts;
  if (!(yFondo > ySuperficie + 20)) return;

  const n = Math.max(1, Math.min(6, Math.floor(cantidadUnidades) || 1));
  const yCorona = ySuperficie - 28;
  const yRotor = ySuperficie + (yFondo - ySuperficie) * 0.52;

  // Posiciones: principal en x; el resto a izquierda/derecha.
  const offsets =
    n === 1
      ? [0]
      : n === 2
        ? [-70, 0]
        : n === 3
          ? [-80, 0, 80]
          : [-110, -40, 40, 110, 0].slice(0, n);
  const escalas = n === 1 ? [1] : offsets.map((_, i) => (i === Math.floor(n / 2) ? 1 : 0.72));

  // Lecho arenoso local (textura suave bajo las cimentaciones).
  const arena = ctx.createLinearGradient(0, yFondo - 8, 0, yFondo + 18);
  arena.addColorStop(0, P.arena);
  arena.addColorStop(1, P.arenaOscura);
  ctx.fillStyle = arena;
  ctx.globalAlpha = 0.35;
  ctx.beginPath();
  ctx.ellipse(x, yFondo + 4, 160 * (n > 1 ? 1.4 : 1), 12, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;

  // Cables entre unidades sobre el lecho.
  if (n > 1) {
    for (let i = 0; i < offsets.length - 1; i++) {
      dibujarCableLecho(ctx, x + offsets[i], x + offsets[i + 1], yFondo, t);
    }
  }

  // Unidades: de lejos a cerca para que la principal quede delante.
  const orden = offsets.map((_, i) => i).sort((a, b) => escalas[a] - escalas[b]);
  for (const i of orden) {
    const ux = x + offsets[i];
    const s = escalas[i];
    const esPrincipal = s >= 1;

    if (cimentacion === "gravedad") dibujarBaseGravedad(ctx, ux, yFondo);
    else dibujarOtraCimentacion(ctx, ux, yFondo, cimentacion);

    dibujarPilar(ctx, ux, yCorona, yFondo - (cimentacion === "gravedad" ? 22 : 8));

    // Marca de oleaje en la torreta.
    ctx.fillStyle = P.espuma;
    ctx.fillRect(ux - 11, ySuperficie - 1.5, 22, 3);
    // Espuma de resalte en el fuste.
    ctx.globalAlpha = 0.55;
    ctx.beginPath();
    ctx.ellipse(ux, ySuperficie + 1, 14, 3, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;

    dibujarEmbudo(ctx, ux, yCorona);
    dibujarBaliza(ctx, ux, yCorona - 38, t + i * 0.4);
    dibujarRotor(ctx, ux + 4, yRotor, t, velocidadCorriente, s);

    if (esPrincipal) {
      // Sombra suave del rotor sobre el agua (profundidad).
      ctx.fillStyle = "rgba(10,20,28,0.12)";
      ctx.beginPath();
      ctx.ellipse(ux + 8, yRotor + 6, 40, 10, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Rótulo del dispositivo.
  if (sinRotulo) return;
  const texto =
    n > 1 ? `Granja mareomotriz · ${n} unidades` : "Turbina de corriente mareal";
  ctx.font = "600 12px system-ui, sans-serif";
  ctx.textAlign = "center";
  const ancho = (ctx.measureText?.(texto)?.width ?? texto.length * 6.5) + 16;
  // Justo encima de la baliza, con aire suficiente respecto a la regla de Te.
  const yEt = yCorona - 66;
  ctx.fillStyle = "rgba(15,26,36,0.8)";
  ctx.beginPath();
  ctx.roundRect(x - ancho / 2, yEt - 14, ancho, 19, 3);
  ctx.fill();
  ctx.fillStyle = "rgb(238 245 247)";
  ctx.fillText(texto, x, yEt);
}
