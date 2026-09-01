// AnimacionCanvas — transfiere series UNA vez por simulación, muestreo sin recalcular física.
// D4/Movimiento: superficie eta(x,t) = (Hm0/2)*cos(k*x - omega*t), omega=2*pi/Te, k de nucleo.olas.numero_onda
// PROFUNDIDAD_M = 30 usada para k y lambda = 2*pi/k. Amplitud boya disminuye si Bpto aumenta (m*z''+b*z'+k*z = F).
// lambda = 2 * Math.PI / k — 2*Math.PI/k
//
// Escala del dibujo
// -----------------
// El corte es a escala en horizontal: la longitud de onda ocupa los píxeles que
// le tocan según el dominio en metros. En vertical se aplica una exageración
// (EXAGERACION_VERTICAL) porque una ola de 1,5 m sobre 30 m de agua sería una
// arruga de tres píxeles. La exageración se rotula en pantalla en vez de
// dejar que el dibujo mienta sobre la proporción.

export const PROFUNDIDAD_M = 30;
const EXAGERACION_VERTICAL = 3;
/** Tope de Hm0 del deslizador. La escala vertical se ajusta para que la ola
 *  más alta quepa bajo el horizonte, y con eso la escala deja de depender del
 *  Hm0 actual: la cota crece en proporción a la altura, no a saltos. */
const HM0_TOPE_M = 4;

export type TipoCimentacion = "pilote" | "gravedad" | "tripode";
export type ModoEnergia = "undimotriz" | "mareomotriz";

/** Paleta del corte. Tres familias: cielo, agua y obra. El ámbar es el único
 *  acento y marca sólo lo que produce o transporta energía. */
const C = {
  cieloAlto: "#dce7f0",
  cieloBajo: "#f2f0ea",
  aguaSuperficie: "#4a8fa8",
  aguaMedia: "#1f5a76",
  aguaFondo: "#0d2f45",
  espuma: "#e8f2f5",
  arenaAlta: "#b8a07a",
  arenaBaja: "#6e5c42",
  roca: "#57534e",
  obra: "#94a3b8",
  obraOscura: "#475569",
  obraSombra: "#334155",
  tinta: "#1e293b",
  acento: "#d98324",
  acentoClaro: "#f2b544",
  tierra: "#c9c3b4",
  tierraSombra: "#a8a294",
};

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

  // Parámetros de simulación extendidos
  dispositivo: string = "absorbedor_puntual";
  modoEnergia: ModoEnergia = "undimotriz";
  cimentacion: TipoCimentacion = "pilote";
  velocidadCorriente: number = 2.2; // m/s
  rangoMarea: number = 3.5; // m
  profundidad: number = PROFUNDIDAD_M;
  cantidadUnidades: number = 1;
  /** Potencia que devuelve el cálculo. Si llega, es la que se rotula; el canvas
   *  no pinta una cifra propia cuando hay una calculada. */
  potenciaCaptadaW: number | null = null;

  /** Alto en píxeles de la cota de Hm0 tal como se acaba de pintar. Lo publica
   *  el dibujo para que se pueda comprobar sin reconstruirlo desde las
   *  llamadas al lienzo. */
  cotaHm0Px = 0;

  private rafId: number | null = null;
  private t0: number | null = null;
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

    // Respeta prefers-reduced-motion
    if (typeof window !== "undefined" && window.matchMedia) {
      const m = window.matchMedia("(prefers-reduced-motion: reduce)");
      if (m.matches) this.pausado = true;
      m.addEventListener?.("change", (e) => {
        if (e.matches) this.pausar();
      });
    }
    this.ajustarDPR();

    if (typeof ResizeObserver !== "undefined") {
      this.observador = new ResizeObserver(() => {
        if (this.pausado) this.dibujar(this.ultimoT);
      });
      this.observador.observe(canvas);
    }
  }

  private ajustarDPR(): [number, number] {
    const rect = this.canvas.getBoundingClientRect();
    const [w, h] = [rect.width, rect.height];
    if (w < 2 || h < 2) return this.medidas;
    const dpr = window.devicePixelRatio || 1;
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
    modoEnergia?: ModoEnergia;
    cimentacion?: TipoCimentacion;
    velocidadCorriente?: number;
    rangoMarea?: number;
    cantidadUnidades?: number;
    potenciaCaptadaW?: number | null;
  }) {
    this.Hm0 = payload.Hm0;
    this.Te = payload.Te;
    this.Bpto = payload.Bpto;
    this.k = payload.k;
    this.lambda = this.k > 0 ? (2 * Math.PI) / this.k : 0;
    this.dispositivo = payload.dispositivo || "absorbedor_puntual";
    this.profundidad = payload.profundidad_m ?? PROFUNDIDAD_M;
    this.potenciaCaptadaW = payload.potenciaCaptadaW ?? null;
    if (payload.modoEnergia) this.modoEnergia = payload.modoEnergia;
    else {
      if (this.dispositivo.includes("turbina") || this.dispositivo.includes("corriente") || this.dispositivo.includes("embalse") || this.dispositivo.includes("tidal")) {
        this.modoEnergia = "mareomotriz";
      } else {
        this.modoEnergia = "undimotriz";
      }
    }
    if (payload.cimentacion) this.cimentacion = payload.cimentacion;
    if (payload.velocidadCorriente !== undefined) this.velocidadCorriente = payload.velocidadCorriente;
    if (payload.rangoMarea !== undefined) this.rangoMarea = payload.rangoMarea;
    if (payload.cantidadUnidades !== undefined) this.cantidadUnidades = payload.cantidadUnidades;

    if (!payload.series || !payload.series.t_s || !payload.series.z_m) {
      this.series = null;
      this.sinSerieMsg = `sin serie de posición — dispositivo ${this.dispositivo}`;
      return;
    }
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
    const tDur = t_s[t_s.length - 1] - t_s[0];
    if (tDur <= 0) return z_m[0];
    const tLoop = t_s[0] + (t % tDur);
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

  private potenciaInstantaneaW(): number {
    if (this.potenciaCaptadaW && Number.isFinite(this.potenciaCaptadaW)) return this.potenciaCaptadaW;
    const RHO = 1025;
    const G = 9.81;
    if (this.modoEnergia === "mareomotriz") {
      if (this.dispositivo === "embalse") {
        const R = this.rangoMarea;
        return (0.5 * RHO * G * 100000 * (R * R)) / 44700;
      }
      const radio = 8;
      const area = Math.PI * radio * radio;
      const cp = 0.42;
      const v = this.velocidadCorriente;
      return 0.5 * RHO * area * cp * Math.pow(v, 3) * this.cantidadUnidades;
    }
    return (((RHO * G * G * this.Hm0 * this.Hm0 * this.Te) / (64 * Math.PI)) * this.cantidadUnidades);
  }

  /** Alto en píxeles de la cota de Hm0, dada la escala vertical en px por
   *  metro. Es la misma cifra que se dibuja: una cota que no midiera la ola
   *  que hay debajo no sería una cota. */
  alturaFlechaHm0(escalaVerticalPxM: number): number {
    return Math.max(6, this.Hm0 * escalaVerticalPxM);
  }

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

  /** Elevación de la superficie en metros. La componente principal es la del
   *  contrato; encima van dos armónicos menores que rompen la simetría del
   *  coseno puro y hacen que el mar deje de parecer una montaña única. La suma
   *  se normaliza para que la cresta siga valiendo Hm0/2. */
  private eta(xM: number, t: number, omega: number, k: number): number {
    const a = this.Hm0 / 2;
    const principal = Math.cos(k * xM - omega * t);
    const segundo = 0.34 * Math.cos(1.9 * k * xM - 1.32 * omega * t + 1.1);
    const rizo = 0.12 * Math.cos(4.3 * k * xM - 2.1 * omega * t + 2.6);
    return (a * (principal + segundo + rizo)) / 1.46;
  }

  dibujar(t: number) {
    this.ultimoT = t;
    const [w, h] = this.ajustarDPR();
    if (w < 2 || h < 2) return;
    const ctx = this.ctx;
    ctx.clearRect(0, 0, w, h);

    // La tira de lectura de la carcasa se superpone al pie del lienzo: nada
    // que haya que leer se dibuja dentro de esa banda.
    const pie = 54;
    const horizonteY = h * 0.20;
    const nivelMarMedio = h * 0.42;
    const fondoMarY = h - pie - 26;
    const xCosta = w * 0.70;
    const xPieTalud = xCosta * 0.62;

    const omega = (2 * Math.PI) / this.Te;
    const k = this.k > 0 ? this.k : 0.08;
    const dominioM = this.lambda > 0 ? 2.2 * this.lambda : 120;
    // Píxeles por metro vertical: la columna de agua dibujada representa la
    // profundidad real, y la ola se exagera sobre esa misma escala.
    const pxPorM = ((fondoMarY - nivelMarMedio) / this.profundidad) * EXAGERACION_VERTICAL;
    const escalaOla = Math.min(pxPorM, (nivelMarMedio - horizonteY) / HM0_TOPE_M);

    const superficieY = (px: number) =>
      nivelMarMedio - this.eta((px / w) * dominioM, t, omega, k) * escalaOla;

    /** Perfil natural del terreno: fondo plano mar adentro, talud continuo
     *  hasta la orilla y meseta tierra adentro. */
    const yPlaya = nivelMarMedio + 6;
    const yMeseta = nivelMarMedio - h * 0.15;
    const perfilNatural = (px: number): number => {
      if (px <= xPieTalud) return fondoMarY + Math.sin(px * 0.013) * 2.5;
      if (px <= xCosta) {
        const u = (px - xPieTalud) / (xCosta - xPieTalud);
        return fondoMarY + (yPlaya - fondoMarY) * (u * u * (3 - 2 * u));
      }
      const u = Math.min(1, (px - xCosta) / (w * 0.06));
      return yPlaya + (yMeseta - yPlaya) * (u * u * (3 - 2 * u));
    };

    // Cada dispositivo se fondea donde le corresponde: la boya en agua abierta,
    // la turbina a media profundidad y el cajón y el dique en el somero.
    const xDispositivo =
      this.dispositivo === "owc"
        ? xPieTalud + (xCosta - xPieTalud) * 0.66
        : this.dispositivo === "embalse"
          ? xPieTalud + (xCosta - xPieTalud) * 0.6
          : xCosta * 0.55;

    /** Banqueta de cimentación. Un cajón o un dique no se apoyan en la
     *  pendiente: primero se draga y se rellena una plataforma horizontal. Sin
     *  ella la obra queda colgando por el lado hondo y hundida por el somero. */
    const conBanqueta = this.dispositivo === "owc" || this.dispositivo === "embalse";
    const yBanqueta = perfilNatural(xDispositivo);
    const bx0 = xDispositivo - 200;
    // La banqueta no llega a comerse la playa: la orilla la dibuja el perfil.
    const bx1 = Math.min(xDispositivo + 150, xCosta - 55);
    // Transición larga: es un dragado con talud, no un escalón vertical.
    const transicion = 165;
    const terrenoY = (px: number): number => {
      const natural = perfilNatural(px);
      if (!conBanqueta || px < bx0 - transicion || px > bx1 + transicion) return natural;
      let f = 1;
      if (px < bx0) f = (px - (bx0 - transicion)) / transicion;
      else if (px > bx1) f = 1 - (px - bx1) / transicion;
      const u = f * f * (3 - 2 * f);
      return natural + (yBanqueta - natural) * u;
    };

    // Orilla: donde el perfil corta la línea de mar. Separa la arena del suelo
    // seco y es el ancla de la espuma y de todo lo que se apoya en la playa.
    let xOrilla = xCosta;
    for (let px = xPieTalud; px <= w; px += 3) {
      if (terrenoY(px) <= nivelMarMedio) {
        xOrilla = px;
        break;
      }
    }

    /** Cota de apoyo de una obra: el punto más hondo de su huella, no el de su
     *  eje. Apoyar en el eje deja el pie de aguas afuera colgando. */
    const apoyoHuella = (desde: number, hasta: number): number => {
      let y = terrenoY(desde);
      for (let px = desde; px <= hasta; px += 5) y = Math.max(y, terrenoY(px));
      return Math.max(y, terrenoY(hasta));
    };

    this.dibujarCielo(ctx, w, horizonteY, nivelMarMedio);
    this.dibujarAgua(ctx, w, h, nivelMarMedio, fondoMarY, xCosta, t, superficieY, terrenoY);
    this.dibujarTerreno(ctx, w, h, nivelMarMedio, xOrilla, terrenoY);
    this.dibujarEspumaCosta(ctx, superficieY, terrenoY, xCosta, nivelMarMedio, t);

    const yApoyo = terrenoY(xDispositivo);

    this.dibujarCableSubmarino(ctx, xDispositivo, yApoyo - 6, xCosta + w * 0.035, terrenoY(xCosta + w * 0.035) - 26, t);

    if (this.modoEnergia === "mareomotriz") {
      if (this.dispositivo === "embalse") {
        this.dibujarPresaMareal(ctx, xDispositivo, nivelMarMedio, yApoyo, t, escalaOla, xOrilla, terrenoY, apoyoHuella);
      } else {
        this.dibujarTurbinaCorriente(ctx, xDispositivo, nivelMarMedio, yApoyo, t, superficieY);
      }
    } else if (this.dispositivo === "owc") {
      this.dibujarOWC(ctx, xDispositivo, nivelMarMedio, yApoyo, t, omega, escalaOla, apoyoHuella, terrenoY);
    } else {
      const boyaZ = this.muestrearSerie(t) ?? this.eta((xDispositivo / w) * dominioM, t, omega, k) * 0.6;
      this.dibujarBoya(ctx, xDispositivo, nivelMarMedio, yApoyo, boyaZ, t, escalaOla, superficieY);
    }

    this.dibujarRedElectrica(ctx, w, xCosta, terrenoY, t);
    void yMeseta;
    // En miniatura las anotaciones se pisan unas a otras y no se leen: a ese
    // tamaño el lienzo enseña la escena y nada más.
    if (w >= 460) {
      this.dibujarHUD(ctx, w, h, nivelMarMedio, fondoMarY, dominioM, escalaOla, xPieTalud, pie);
    }
  }

  // ---- Escenario -----------------------------------------------------------

  private dibujarCielo(ctx: CanvasRenderingContext2D, w: number, horizonteY: number, nivelMar: number) {
    const cielo = ctx.createLinearGradient(0, 0, 0, nivelMar);
    cielo.addColorStop(0, C.cieloAlto);
    cielo.addColorStop(1, C.cieloBajo);
    ctx.fillStyle = cielo;
    ctx.fillRect(0, 0, w, nivelMar + 2);

    // Banda de bruma sobre el horizonte: da profundidad sin dibujar nubes.
    const bruma = ctx.createLinearGradient(0, horizonteY - 18, 0, horizonteY + 10);
    bruma.addColorStop(0, "rgba(255,255,255,0)");
    bruma.addColorStop(1, "rgba(255,255,255,0.65)");
    ctx.fillStyle = bruma;
    ctx.fillRect(0, horizonteY - 18, w, 28);
  }

  /** Una sola masa de terreno con el mismo perfil dentro y fuera del agua. El
   *  cambio de material va en la orilla, no en la línea de mar: a un lado
   *  arena, al otro suelo seco, con una franja de arena mojada entre los dos.
   *  Partirlo por la horizontal dejaba una banda plana cruzando toda la tierra. */
  private dibujarTerreno(
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number,
    nivelMar: number,
    xOrilla: number,
    terrenoY: (px: number) => number
  ) {
    const perfil = () => {
      ctx.beginPath();
      ctx.moveTo(0, terrenoY(0));
      for (let px = 4; px <= w; px += 4) ctx.lineTo(px, terrenoY(px));
      ctx.lineTo(w, h);
      ctx.lineTo(0, h);
      ctx.closePath();
    };

    perfil();
    const arena = ctx.createLinearGradient(0, nivelMar, 0, h);
    arena.addColorStop(0, C.arenaAlta);
    arena.addColorStop(1, C.arenaBaja);
    ctx.fillStyle = arena;
    ctx.fill();

    ctx.save();
    perfil();
    ctx.clip();

    const suelo = ctx.createLinearGradient(0, nivelMar - h * 0.2, 0, h);
    suelo.addColorStop(0, C.tierra);
    suelo.addColorStop(1, C.tierraSombra);
    ctx.fillStyle = suelo;
    ctx.fillRect(xOrilla + 40, 0, w, h);

    // Arena mojada: la transición no es un corte, es una franja.
    const franja = ctx.createLinearGradient(xOrilla - 8, 0, xOrilla + 40, 0);
    franja.addColorStop(0, "rgba(201,195,180,0)");
    franja.addColorStop(1, C.tierra);
    ctx.fillStyle = franja;
    ctx.fillRect(xOrilla - 8, 0, 48, h);
    ctx.restore();

    ctx.beginPath();
    ctx.moveTo(0, terrenoY(0));
    for (let px = 4; px <= w; px += 4) ctx.lineTo(px, terrenoY(px));
    ctx.strokeStyle = "rgba(60,55,45,0.35)";
    ctx.lineWidth = 1.2;
    ctx.stroke();

    // Cantos sobre el fondo, con tamaños y separaciones desiguales.
    ctx.fillStyle = C.roca;
    ctx.globalAlpha = 0.5;
    for (let i = 0; i < 18; i++) {
      const rx = (((i * 97) % 100) / 100) * (xOrilla - 20) + 8;
      const escala = 4 + ((i * 37) % 8);
      ctx.beginPath();
      ctx.ellipse(rx, terrenoY(rx) + 5 + ((i * 13) % 6), escala, escala * 0.5, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  private dibujarAgua(
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number,
    nivelMedio: number,
    fondoY: number,
    xCosta: number,
    t: number,
    superficieY: (px: number) => number,
    terrenoY: (px: number) => number
  ) {
    const paso = 3;
    // El agua llega hasta donde el terreno corta la superficie: la orilla.
    let borde = xCosta;
    for (let px = 0; px <= xCosta; px += paso) {
      if (terrenoY(px) <= superficieY(px)) {
        borde = px;
        break;
      }
    }

    ctx.save();
    ctx.beginPath();
    ctx.moveTo(0, superficieY(0));
    for (let px = paso; px <= borde; px += paso) ctx.lineTo(px, superficieY(px));
    for (let px = borde; px >= 0; px -= paso) ctx.lineTo(px, terrenoY(px) + 2);
    ctx.closePath();
    ctx.clip();

    const agua = ctx.createLinearGradient(0, nivelMedio - 20, 0, fondoY + 20);
    agua.addColorStop(0, C.aguaSuperficie);
    agua.addColorStop(0.35, C.aguaMedia);
    agua.addColorStop(1, C.aguaFondo);
    ctx.fillStyle = agua;
    ctx.fillRect(0, nivelMedio - 60, w, h);

    // Haces de luz: pocos, muy tenues, inclinados. Marcan que hay superficie
    // encima sin convertir el agua en un fondo de pantalla.
    ctx.globalAlpha = 0.07;
    ctx.fillStyle = "#ffffff";
    for (let i = 0; i < 5; i++) {
      const x0 = ((i * 0.23 + t * 0.012) % 1) * w;
      ctx.beginPath();
      ctx.moveTo(x0, nivelMedio - 10);
      ctx.lineTo(x0 + 26, nivelMedio - 10);
      ctx.lineTo(x0 + 96, fondoY + 20);
      ctx.lineTo(x0 + 40, fondoY + 20);
      ctx.closePath();
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // Vector de corriente: sólo en modo mareal, que es donde la corriente es
    // la magnitud que se está moviendo con el deslizador.
    if (this.modoEnergia === "mareomotriz") {
      const desplazamiento = (t * this.velocidadCorriente * 26) % 120;
      ctx.strokeStyle = "rgba(232,242,245,0.28)";
      ctx.fillStyle = "rgba(232,242,245,0.38)";
      ctx.lineWidth = 1.2;
      for (let fy = nivelMedio + 34; fy < fondoY - 12; fy += 34) {
        for (let fx = -120 + desplazamiento; fx < borde; fx += 120) {
          const largo = 26;
          ctx.beginPath();
          ctx.moveTo(fx, fy);
          ctx.lineTo(fx + largo, fy);
          ctx.stroke();
          ctx.beginPath();
          ctx.moveTo(fx + largo + 5, fy);
          ctx.lineTo(fx + largo - 2, fy - 3);
          ctx.lineTo(fx + largo - 2, fy + 3);
          ctx.closePath();
          ctx.fill();
        }
      }
    }
    ctx.restore();

    // Línea de superficie: un trazo fino, no un contorno.
    ctx.beginPath();
    ctx.moveTo(0, superficieY(0));
    for (let px = paso; px <= borde; px += paso) ctx.lineTo(px, superficieY(px));
    ctx.strokeStyle = "rgba(255,255,255,0.65)";
    ctx.lineWidth = 1.6;
    ctx.stroke();
  }

  private dibujarEspumaCosta(
    ctx: CanvasRenderingContext2D,
    superficieY: (px: number) => number,
    terrenoY: (px: number) => number,
    xCosta: number,
    nivelMedio: number,
    t: number
  ) {
    let orilla = xCosta;
    for (let px = 0; px <= xCosta; px += 3) {
      if (terrenoY(px) <= superficieY(px)) {
        orilla = px;
        break;
      }
    }
    void nivelMedio;

    ctx.fillStyle = C.espuma;
    ctx.globalAlpha = 0.7;
    for (let i = 0; i < 9; i++) {
      const fase = (t * 0.8 + i * 0.29) % 1;
      const x = orilla - 4 - i * 6 - fase * 10;
      const r = 1.4 + fase * 3;
      ctx.beginPath();
      ctx.arc(x, superficieY(x) + 2 + Math.sin(i * 1.7 + t * 2) * 2.5, r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  // ---- Red eléctrica -------------------------------------------------------

  /** Todo lo que hay en tierra se apoya en la cota del terreno **en su propia
   *  abscisa**. Con una cota única el transformador quedaba flotando sobre la
   *  rampa de la playa, que todavía no ha llegado a la meseta. */
  private dibujarRedElectrica(
    ctx: CanvasRenderingContext2D,
    w: number,
    xCosta: number,
    terrenoY: (px: number) => number,
    t: number
  ) {
    // Subestación: transformador con radiadores, aisladores pasantes y valla.
    const xSub = xCosta + w * 0.045;
    const sueloSub = terrenoY(xSub + 20);
    const ySub = sueloSub - 34;

    // Explanada bajo el transformador: una obra no se posa sobre la pendiente.
    ctx.fillStyle = C.tierraSombra;
    ctx.beginPath();
    ctx.moveTo(xSub - 10, sueloSub + 8);
    ctx.lineTo(xSub - 6, sueloSub);
    ctx.lineTo(xSub + 46, sueloSub);
    ctx.lineTo(xSub + 50, sueloSub + 8);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = C.obraOscura;
    ctx.fillRect(xSub, ySub + 10, 40, 24);
    ctx.fillStyle = C.obra;
    ctx.fillRect(xSub + 4, ySub + 4, 32, 10);
    ctx.strokeStyle = C.obraSombra;
    ctx.lineWidth = 1;
    ctx.strokeRect(xSub, ySub + 10, 40, 24);

    ctx.strokeStyle = C.obraSombra;
    ctx.lineWidth = 1.2;
    for (let i = 0; i < 6; i++) {
      ctx.beginPath();
      ctx.moveTo(xSub + 3 + i * 6.5, ySub + 12);
      ctx.lineTo(xSub + 3 + i * 6.5, ySub + 32);
      ctx.stroke();
    }

    ctx.strokeStyle = C.tinta;
    ctx.lineWidth = 1.6;
    for (const dx of [10, 20, 30]) {
      ctx.beginPath();
      ctx.moveTo(xSub + dx, ySub + 4);
      ctx.lineTo(xSub + dx, ySub - 8);
      ctx.stroke();
      ctx.fillStyle = C.espuma;
      ctx.beginPath();
      ctx.arc(xSub + dx, ySub - 10, 2.4, 0, Math.PI * 2);
      ctx.fill();
    }

    // Torre de celosía: montantes que convergen, tres tramos de arriostrado
    // y dos crucetas con aisladores.
    const xT = xCosta + w * 0.115;
    const yBase = terrenoY(xT);
    const yTop = yBase - 108;
    const anchoBase = 17;
    const anchoTop = 5;
    const montante = (s: number, y: number) => xT + s * (anchoTop + (anchoBase - anchoTop) * ((y - yTop) / (yBase - yTop)));

    ctx.strokeStyle = C.tinta;
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.moveTo(montante(-1, yBase), yBase);
    ctx.lineTo(montante(-1, yTop), yTop);
    ctx.moveTo(montante(1, yBase), yBase);
    ctx.lineTo(montante(1, yTop), yTop);
    ctx.stroke();

    ctx.lineWidth = 0.9;
    ctx.beginPath();
    const tramos = 7;
    for (let i = 0; i < tramos; i++) {
      const y0 = yTop + ((yBase - yTop) * i) / tramos;
      const y1 = yTop + ((yBase - yTop) * (i + 1)) / tramos;
      ctx.moveTo(montante(-1, y0), y0);
      ctx.lineTo(montante(1, y1), y1);
      ctx.moveTo(montante(1, y0), y0);
      ctx.lineTo(montante(-1, y1), y1);
      ctx.moveTo(montante(-1, y0), y0);
      ctx.lineTo(montante(1, y0), y0);
    }
    ctx.stroke();

    const crucetas = [yTop + 14, yTop + 40];
    ctx.lineWidth = 1.8;
    for (const yc of crucetas) {
      const brazo = yc === crucetas[0] ? 26 : 20;
      ctx.beginPath();
      ctx.moveTo(xT - brazo, yc);
      ctx.lineTo(xT + brazo, yc);
      ctx.stroke();
      ctx.lineWidth = 1;
      for (const s of [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo(xT + s * brazo, yc);
        ctx.lineTo(xT + s * brazo, yc + 6);
        ctx.stroke();
      }
      ctx.lineWidth = 1.8;
    }

    // Línea aérea con catenaria, del pórtico de la subestación a la torre y
    // de la torre al borde del cuadro.
    const conductor = (x0: number, y0: number, x1: number, y1: number) => {
      ctx.beginPath();
      ctx.moveTo(x0, y0);
      ctx.quadraticCurveTo((x0 + x1) / 2, Math.max(y0, y1) + 16, x1, y1);
      ctx.stroke();
    };
    ctx.strokeStyle = C.tinta;
    ctx.lineWidth = 1.1;
    conductor(xSub + 20, ySub - 10, xT - 26, crucetas[0] + 6);
    conductor(xT + 26, crucetas[0] + 6, w, crucetas[0] + 10);
    conductor(xT + 20, crucetas[1] + 6, w, crucetas[1] + 12);

    // Núcleo urbano: alturas y anchos desiguales, ventanas que se encienden
    // despacio. Es la carga al final de la cadena, no decoración.
    const xCiudad = xCosta + w * 0.15;
    const anchos = [26, 18, 34, 22];
    const alturas = [58, 84, 44, 70];
    let ex = xCiudad;
    for (let i = 0; i < anchos.length && ex < w; i++) {
      const ancho = anchos[i];
      const alto = alturas[i];
      const sueloEdificio = terrenoY(ex + ancho / 2);
      const ey = sueloEdificio - alto;
      ctx.fillStyle = i % 2 === 0 ? C.obraOscura : C.obraSombra;
      ctx.fillRect(ex, ey, ancho, alto);
      ctx.fillStyle = "rgba(255,255,255,0.12)";
      ctx.fillRect(ex, ey, ancho, 3);

      for (let wy = ey + 8; wy < sueloEdificio - 8; wy += 12) {
        for (let wx = ex + 5; wx < ex + ancho - 6; wx += 9) {
          const fase = Math.sin(wx * 0.7 + wy * 0.3 + t * 0.6);
          ctx.fillStyle = fase > 0.25 ? C.acentoClaro : "rgba(255,255,255,0.10)";
          ctx.fillRect(wx, wy, 4, 6);
        }
      }
      ex += ancho + 6;
    }
  }

  private dibujarCableSubmarino(
    ctx: CanvasRenderingContext2D,
    x0: number,
    y0: number,
    x1: number,
    y1: number,
    t: number
  ) {
    const cpX = (x0 + x1) * 0.55;
    const cpY = y0 + 14;

    ctx.strokeStyle = C.tinta;
    ctx.lineWidth = 3.5;
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.quadraticCurveTo(cpX, cpY, x1, y1);
    ctx.stroke();

    // Un único pulso recorriendo el cable: el movimiento dice «esto transporta
    // energía» y se apaga si el sistema pide menos movimiento.
    const frac = (t * 0.22) % 1;
    const px = (1 - frac) * (1 - frac) * x0 + 2 * (1 - frac) * frac * cpX + frac * frac * x1;
    const py = (1 - frac) * (1 - frac) * y0 + 2 * (1 - frac) * frac * cpY + frac * frac * y1;
    ctx.fillStyle = C.acentoClaro;
    ctx.beginPath();
    ctx.arc(px, py, 2.6, 0, Math.PI * 2);
    ctx.fill();
  }

  // ---- Dispositivos --------------------------------------------------------

  private dibujarBoya(
    ctx: CanvasRenderingContext2D,
    x: number,
    nivelMedio: number,
    fondoY: number,
    boyaZ: number,
    t: number,
    escalaOla: number,
    superficieY: (px: number) => number
  ) {
    const yFlotador = nivelMedio - boyaZ * escalaOla;
    const radio = 26;
    const calado = 15;

    // Amarres al lecho, uno a cada lado, con catenaria.
    ctx.strokeStyle = "rgba(20,30,40,0.7)";
    ctx.lineWidth = 1.4;
    for (const s of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(x + s * 10, yFlotador + calado);
      ctx.quadraticCurveTo(x + s * 60, fondoY - 12, x + s * 96, fondoY - 2);
      ctx.stroke();
      ctx.fillStyle = C.roca;
      ctx.beginPath();
      ctx.ellipse(x + s * 96, fondoY - 1, 7, 3.5, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    // Vástago hacia el plato de reacción: la referencia contra la que el
    // flotador trabaja. Es lo que convierte el vaivén en carrera útil.
    const yPlato = fondoY - 34;
    ctx.strokeStyle = C.obraOscura;
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(x, yFlotador);
    ctx.lineTo(x, yPlato);
    ctx.stroke();

    ctx.fillStyle = C.obraSombra;
    ctx.beginPath();
    ctx.ellipse(x, yPlato, 34, 6, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = C.obraOscura;
    ctx.lineWidth = 1.2;
    ctx.stroke();

    // Cuerpo del flotador: cilindro con tapa elíptica y línea de flotación.
    const yTapa = yFlotador - 14;
    const cuerpo = ctx.createLinearGradient(x - radio, 0, x + radio, 0);
    cuerpo.addColorStop(0, "#9a4a1c");
    cuerpo.addColorStop(0.4, C.acento);
    cuerpo.addColorStop(1, "#8a4118");
    ctx.fillStyle = cuerpo;
    ctx.beginPath();
    ctx.moveTo(x - radio, yTapa);
    ctx.lineTo(x - radio, yFlotador + calado - 8);
    ctx.quadraticCurveTo(x, yFlotador + calado + 6, x + radio, yFlotador + calado - 8);
    ctx.lineTo(x + radio, yTapa);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = C.acentoClaro;
    ctx.beginPath();
    ctx.ellipse(x, yTapa, radio, 6, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#7a3712";
    ctx.lineWidth = 1.2;
    ctx.stroke();

    // Franja de flotación al nivel real del agua en ese punto.
    const yAgua = superficieY(x);
    ctx.save();
    ctx.beginPath();
    ctx.rect(x - radio, yTapa, radio * 2, yFlotador + calado - yTapa);
    ctx.clip();
    ctx.fillStyle = "rgba(255,255,255,0.35)";
    ctx.fillRect(x - radio, yAgua - 1.5, radio * 2, 3);
    ctx.restore();

    // Mástil de señalización con luz intermitente: una sola cosa parpadea en
    // todo el cuadro, y es la que señaliza el obstáculo.
    ctx.strokeStyle = C.obra;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x, yTapa);
    ctx.lineTo(x, yTapa - 24);
    ctx.stroke();
    ctx.fillStyle = Math.sin(t * 3) > 0.4 ? "#e2493a" : "#7d2f27";
    ctx.beginPath();
    ctx.arc(x, yTapa - 26, 3, 0, Math.PI * 2);
    ctx.fill();

    // Carcasa del generador sobre el lecho, rotulada.
    const xPTO = x + 46;
    const yPTO = fondoY - 20;
    ctx.fillStyle = C.obraOscura;
    ctx.beginPath();
    ctx.roundRect(xPTO - 20, yPTO, 40, 20, 3);
    ctx.fill();
    ctx.strokeStyle = C.obraSombra;
    ctx.lineWidth = 1.2;
    ctx.stroke();
    ctx.strokeStyle = C.tinta;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x, yPlato);
    ctx.lineTo(xPTO - 20, yPTO + 8);
    ctx.stroke();
    this.rotulo(ctx, "Generador", xPTO, yPTO + 13, "center", C.espuma, 9);

    this.rotuloDispositivo(ctx, x, yTapa - 40, "Absorbedor puntual");
  }

  /** Columna de agua oscilante. Cajón apoyado en el talud con una abertura
   *  sumergida en la pared de mar: la ola entra por ahí, la lámina interior
   *  sube y baja y bombea el aire de la cámara por el conducto de la turbina.
   *  El ancho se deriva del alto, como en el dique, porque la vertical va
   *  exagerada ×3 y de otro modo el cajón saldría como una torre. */
  private dibujarOWC(
    ctx: CanvasRenderingContext2D,
    x: number,
    nivelMedio: number,
    fondoY: number,
    t: number,
    omega: number,
    escalaOla: number,
    apoyoHuella: (desde: number, hasta: number) => number,
    terrenoY: (px: number) => number
  ) {
    // El cajón se apoya en el fondo de su eje y su losa sigue el terreno: con
    // una base horizontal a la cota más honda de la huella crecía hacia abajo
    // sobre el talud hasta perder toda proporción.
    const talon = 22; // saliente del pie de la pared de mar
    const base = fondoY;
    const franco = Math.max(38, Math.min((base - nivelMedio) * 0.5, 2.2 * escalaOla));
    const yCoronacion = nivelMedio - franco;
    const altoTotal = Math.max(80, base - yCoronacion);
    const ancho = Math.min(215, Math.max(115, altoTotal * 1.1));
    const x0 = x - ancho / 2;
    const x1 = x + ancho / 2;
    void apoyoHuella;

    const espesor = Math.max(13, ancho * 0.11);
    const losa = Math.max(12, espesor * 0.85);
    const camIzq = x0 + espesor;
    const camDer = x1 - espesor;
    const techo = yCoronacion + losa;
    const suelo = base - losa;
    const abertura = Math.min(52, Math.max(24, (suelo - techo) * 0.3));
    const yAbertura = suelo - abertura;

    // Cámara: primero el hueco, para que las paredes se recorten contra él.
    ctx.fillStyle = "#0b1f2b";
    ctx.fillRect(camIzq, techo, camDer - camIzq, suelo - techo);

    // Lámina interior, desfasada respecto al mar de fuera: es lo que bombea el
    // aire por el conducto.
    const etaInterior = (this.Hm0 / 2) * Math.cos(-omega * t + 0.9);
    const yInterior = Math.min(
      suelo - 8,
      Math.max(techo + 12, nivelMedio - etaInterior * escalaOla * 1.4)
    );
    const columna = ctx.createLinearGradient(0, yInterior, 0, suelo);
    columna.addColorStop(0, "#4a8fa8");
    columna.addColorStop(1, "#123c52");
    ctx.fillStyle = columna;
    ctx.fillRect(camIzq, yInterior, camDer - camIzq, suelo - yInterior);
    ctx.fillStyle = "rgba(255,255,255,0.6)";
    ctx.fillRect(camIzq, yInterior - 1.5, camDer - camIzq, 3);

    // Agua de mar entrando por la abertura: el hueco es real, no un parche.
    ctx.fillStyle = "#2f6f8a";
    ctx.fillRect(x0, yAbertura, espesor, abertura);

    const hormigon = ctx.createLinearGradient(x0, 0, x1, 0);
    hormigon.addColorStop(0, C.obra);
    hormigon.addColorStop(0.5, "#adb8c6");
    hormigon.addColorStop(1, C.obraOscura);
    ctx.fillStyle = hormigon;
    ctx.strokeStyle = C.obraSombra;
    ctx.lineWidth = 1.3;

    // Pared de mar, partida por la abertura, con talón en el pie.
    ctx.beginPath();
    ctx.rect(x0, yCoronacion, espesor, yAbertura - yCoronacion);
    ctx.fill();
    ctx.stroke();

    // Pared de trasdós y losa de fondo.
    ctx.beginPath();
    ctx.rect(camDer, yCoronacion, espesor, base - yCoronacion);
    ctx.fill();
    ctx.stroke();

    // Losa de fondo: sigue el terreno, así que apoya en todo su ancho.
    ctx.beginPath();
    ctx.moveTo(x0 - talon, suelo);
    ctx.lineTo(x1, suelo);
    // Canto acotado: sin tope, sobre el talud la losa se estiraba hacia el
    // fondo y salía una cuña más grande que el propio cajón.
    for (let px = x1; px >= x0 - talon; px -= 6) {
      ctx.lineTo(px, Math.min(Math.max(base, terrenoY(px)), base + 32) + 2);
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Losa de coronación.
    ctx.beginPath();
    ctx.rect(x0 - 6, yCoronacion, ancho + 12, losa);
    ctx.fill();
    ctx.stroke();

    // Conducto y grupo turbina-generador sobre la cámara.
    const xDucto = x + ancho * 0.06;
    ctx.fillStyle = C.obraOscura;
    ctx.fillRect(xDucto - 14, yCoronacion - 26, 28, 27);

    const yEje = yCoronacion - 40;
    ctx.fillStyle = C.obraSombra;
    ctx.beginPath();
    ctx.roundRect(xDucto - 28, yEje - 14, 56, 28, 5);
    ctx.fill();
    ctx.fillStyle = C.obra;
    ctx.beginPath();
    ctx.arc(xDucto, yEje, 13, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = C.obraSombra;
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.save();
    ctx.translate(xDucto, yEje);
    ctx.rotate(t * 8);
    ctx.strokeStyle = C.acento;
    ctx.lineWidth = 2.4;
    for (let i = 0; i < 6; i++) {
      const ang = (i * Math.PI) / 3;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(10 * Math.cos(ang), 10 * Math.sin(ang));
      ctx.stroke();
    }
    ctx.restore();
    ctx.fillStyle = C.obraSombra;
    ctx.beginPath();
    ctx.arc(xDucto, yEje, 3.5, 0, Math.PI * 2);
    ctx.fill();

    // Flujo de aire: la punta sigue el sentido en que se mueve la columna, que
    // es lo que hace que la turbina Wells gire siempre en el mismo sentido.
    const sube = Math.sin(-omega * t + 0.9) < 0;
    ctx.strokeStyle = "rgba(30,41,59,0.6)";
    ctx.fillStyle = "rgba(30,41,59,0.6)";
    ctx.lineWidth = 1.4;
    for (const dx of [-9, 9]) {
      const yA = yEje - 18;
      ctx.beginPath();
      ctx.moveTo(xDucto + dx, yA);
      ctx.lineTo(xDucto + dx, yA - 14);
      ctx.stroke();
      ctx.beginPath();
      if (sube) {
        ctx.moveTo(xDucto + dx, yA - 18);
        ctx.lineTo(xDucto + dx - 3.5, yA - 13);
        ctx.lineTo(xDucto + dx + 3.5, yA - 13);
      } else {
        ctx.moveTo(xDucto + dx, yA - 10);
        ctx.lineTo(xDucto + dx - 3.5, yA - 15);
        ctx.lineTo(xDucto + dx + 3.5, yA - 15);
      }
      ctx.closePath();
      ctx.fill();
    }

    // Escollera al pie de la pared de mar.
    ctx.fillStyle = C.roca;
    for (let i = 0; i < 11; i++) {
      ctx.beginPath();
      const rx = x0 - talon - 16 + i * 7;
      ctx.ellipse(rx, Math.max(base, terrenoY(rx)) - 2 - ((i * 11) % 7), 6, 3.8, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    this.rotuloDispositivo(ctx, x, yEje - 34, "Columna de agua oscilante");
  }

  private dibujarTurbinaCorriente(
    ctx: CanvasRenderingContext2D,
    x: number,
    nivelMedio: number,
    fondoY: number,
    t: number,
    superficieY: (px: number) => number
  ) {
    const yRotor = nivelMedio + (fondoY - nivelMedio) * 0.55;
    const yTorreta = nivelMedio - 34;

    // Torreta hasta la superficie, con plataforma de acceso y baliza.
    const torre = ctx.createLinearGradient(x - 9, 0, x + 9, 0);
    torre.addColorStop(0, C.obraSombra);
    torre.addColorStop(0.45, C.obra);
    torre.addColorStop(1, C.obraOscura);
    ctx.fillStyle = torre;
    ctx.fillRect(x - 9, yTorreta, 18, fondoY - yTorreta);

    // La cimentación se dibuja DESPUÉS del fuste: es la pieza que lo abraza por
    // el pie, así que va delante. Antes quedaba detrás y no se veía.
    if (this.cimentacion === "gravedad") {
      ctx.fillStyle = C.obraOscura;
      ctx.beginPath();
      ctx.moveTo(x - 58, fondoY);
      ctx.lineTo(x - 42, fondoY - 28);
      ctx.lineTo(x + 42, fondoY - 28);
      ctx.lineTo(x + 58, fondoY);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = C.obraSombra;
      ctx.lineWidth = 1.4;
      ctx.stroke();
      // Lastre visible: es lo que sujeta la turbina, y por eso es un bloque.
      ctx.fillStyle = "rgba(255,255,255,0.10)";
      for (let i = 0; i < 5; i++) ctx.fillRect(x - 34 + i * 17, fondoY - 24, 12, 20);
      this.rotulo(ctx, "Bloque de gravedad", x + 66, fondoY - 8, "left", C.espuma, 9);
    } else if (this.cimentacion === "tripode") {
      ctx.strokeStyle = C.obraOscura;
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.moveTo(x, fondoY - 66);
      ctx.lineTo(x - 54, fondoY);
      ctx.moveTo(x, fondoY - 66);
      ctx.lineTo(x + 54, fondoY);
      ctx.stroke();
      ctx.lineWidth = 2.4;
      ctx.beginPath();
      ctx.moveTo(x - 36, fondoY - 26);
      ctx.lineTo(x + 36, fondoY - 26);
      ctx.moveTo(x - 20, fondoY - 46);
      ctx.lineTo(x + 20, fondoY - 46);
      ctx.stroke();
      ctx.fillStyle = C.obraSombra;
      for (const dx of [-54, 54]) ctx.fillRect(x + dx - 8, fondoY - 8, 16, 10);
      this.rotulo(ctx, "Trípode", x + 66, fondoY - 20, "left", C.espuma, 9);
    } else {
      ctx.fillStyle = C.obraOscura;
      ctx.fillRect(x - 13, fondoY - 16, 26, 20);
      ctx.fillStyle = C.obraSombra;
      ctx.beginPath();
      ctx.ellipse(x, fondoY, 28, 7, 0, 0, Math.PI * 2);
      ctx.fill();
      this.rotulo(ctx, "Pilote clavado", x + 36, fondoY - 4, "left", C.espuma, 9);
    }

    ctx.fillStyle = C.obraSombra;
    ctx.beginPath();
    ctx.moveTo(x - 26, yTorreta + 8);
    ctx.lineTo(x + 26, yTorreta + 8);
    ctx.lineTo(x + 18, yTorreta);
    ctx.lineTo(x - 18, yTorreta);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = C.obra;
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(x - 26, yTorreta);
    ctx.lineTo(x - 26, yTorreta - 9);
    ctx.moveTo(x + 26, yTorreta);
    ctx.lineTo(x + 26, yTorreta - 9);
    ctx.moveTo(x - 26, yTorreta - 9);
    ctx.lineTo(x + 26, yTorreta - 9);
    ctx.stroke();

    ctx.fillStyle = Math.sin(t * 3) > 0.4 ? "#e2493a" : "#7d2f27";
    ctx.beginPath();
    ctx.arc(x, yTorreta - 13, 3, 0, Math.PI * 2);
    ctx.fill();

    // Marca de la superficie sobre la torreta: se ve el oleaje pasar.
    const yAgua = superficieY(x);
    ctx.fillStyle = "rgba(255,255,255,0.4)";
    ctx.fillRect(x - 9, yAgua - 1.5, 18, 3);

    // Góndola y rotor tripala con perfil variable.
    const radioPala = 56;
    const giro = t * this.velocidadCorriente * 2.1;

    ctx.fillStyle = C.obraSombra;
    ctx.beginPath();
    ctx.roundRect(x - 8, yRotor - 12, 46, 24, 11);
    ctx.fill();
    ctx.strokeStyle = C.obraOscura;
    ctx.lineWidth = 1.4;
    ctx.stroke();

    ctx.save();
    ctx.translate(x, yRotor);
    for (let i = 0; i < 3; i++) {
      const ang = giro + (i * Math.PI * 2) / 3;
      // Palas casi de canto en la mitad trasera: da sensación de disco.
      const escorzo = Math.max(0.18, Math.abs(Math.cos(ang)));
      ctx.save();
      ctx.rotate(ang);
      ctx.scale(escorzo, 1);
      const pala = ctx.createLinearGradient(0, 0, 0, -radioPala);
      pala.addColorStop(0, C.obraSombra);
      pala.addColorStop(1, C.obra);
      ctx.fillStyle = pala;
      ctx.beginPath();
      ctx.moveTo(-5, 0);
      ctx.quadraticCurveTo(-8, -radioPala * 0.55, -1.6, -radioPala);
      ctx.quadraticCurveTo(4.5, -radioPala * 0.6, 5, 0);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = C.tinta;
      ctx.lineWidth = 0.8;
      ctx.stroke();
      ctx.restore();
    }
    ctx.fillStyle = C.acento;
    ctx.beginPath();
    ctx.arc(0, 0, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    this.rotulo(
      ctx,
      `Corriente ${this.velocidadCorriente.toFixed(1).replace(".", ",")} m/s`,
      x + radioPala + 14,
      yRotor + 4,
      "left",
      C.espuma,
      10
    );
    this.rotuloDispositivo(ctx, x, yTorreta - 30, "Turbina de corriente mareal");
  }

  /** Dique mareal. El corte exagera la vertical ×3, así que una obra dibujada a
   *  escala horizontal real saldría como una torre. El ancho se deriva del alto
   *  para que la sección conserve la proporción de un dique de verdad: base
   *  ancha, taludes tendidos y coronación estrecha. */
  private dibujarPresaMareal(
    ctx: CanvasRenderingContext2D,
    x: number,
    nivelMedio: number,
    fondoY: number,
    t: number,
    escalaOla: number,
    xOrilla: number,
    terrenoY: (px: number) => number,
    apoyoHuella: (desde: number, hasta: number) => number
  ) {
    // La base sigue el fondo. Apoyarla en una horizontal a la cota más honda de
    // la huella hacía que, sobre un talud, el dique creciera hacia abajo hasta
    // convertirse en una torre.
    const base = fondoY;
    const coronacion = nivelMedio - Math.max(30, (base - nivelMedio) * 0.3);
    const alto = Math.max(70, base - coronacion);
    const semiMar = Math.min(210, Math.max(95, alto * 1.25));
    const semiEmb = semiMar * 0.5;
    const semiCresta = Math.max(28, semiMar * 0.2);

    const seccionDique = () => {
      ctx.beginPath();
      ctx.moveTo(x - semiMar, terrenoY(x - semiMar) + 2);
      ctx.lineTo(x - semiCresta, coronacion);
      ctx.lineTo(x + semiCresta, coronacion);
      ctx.lineTo(x + semiEmb, terrenoY(x + semiEmb) + 2);
      for (let px = x + semiEmb; px >= x - semiMar; px -= 6) ctx.lineTo(px, terrenoY(px) + 2);
      ctx.closePath();
    };
    void apoyoHuella;

    // Desnivel: la lámina del mar es la que dibuja el oleaje, así que la que se
    // mueve aquí es la del embalse. El salto que se rotula es esa diferencia.
    const fase = Math.sin(t * 0.5);
    const salto = (this.rangoMarea / 2) * escalaOla * 0.9;
    const yEmbalse = nivelMedio + fase * salto;

    // Embalse: lámina entre el trasdós y la orilla del vaso, con el fondo
    // siguiendo el terreno. Un rectángulo dejaría agua sobre la arena.
    const xIni = x + semiEmb - 6;
    let xFin = xIni;
    while (xFin < xOrilla + 30 && terrenoY(xFin) > yEmbalse) xFin += 4;
    if (xFin > xIni + 4) {
      ctx.beginPath();
      ctx.moveTo(xIni, yEmbalse);
      ctx.lineTo(xFin, yEmbalse);
      for (let px = xFin; px >= xIni; px -= 4) ctx.lineTo(px, terrenoY(px) + 2);
      ctx.closePath();
      const vaso = ctx.createLinearGradient(0, yEmbalse, 0, base);
      vaso.addColorStop(0, "#4a8fa8");
      vaso.addColorStop(1, "#164a63");
      ctx.fillStyle = vaso;
      ctx.fill();
      ctx.fillStyle = "rgba(255,255,255,0.6)";
      ctx.fillRect(xIni, yEmbalse - 1.5, xFin - xIni, 3);
    }

    // Sección del dique: talud tendido al mar, talud corto al embalse.
    seccionDique();
    const cuerpo = ctx.createLinearGradient(0, coronacion, 0, base);
    cuerpo.addColorStop(0, C.obra);
    cuerpo.addColorStop(1, C.obraSombra);
    ctx.fillStyle = cuerpo;
    ctx.fill();
    ctx.strokeStyle = C.obraSombra;
    ctx.lineWidth = 1.4;
    ctx.stroke();

    // Escollera sobre el talud de aguas afuera: es la cara que rompe la ola.
    ctx.fillStyle = C.roca;
    for (let i = 0; i <= 26; i++) {
      const u = i / 26;
      const rx = x - semiMar + u * (semiMar - semiCresta) + ((i * 7) % 6) - 3;
      const yTalud = terrenoY(x - semiMar) + u * (coronacion - terrenoY(x - semiMar));
      const ry = yTalud + ((i * 13) % 8) - 2;
      ctx.beginPath();
      ctx.ellipse(rx, ry, 6, 4, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    // Coronación: vía sobre el dique y edificio de la central.
    ctx.fillStyle = C.obraOscura;
    ctx.fillRect(x - semiCresta - 6, coronacion - 7, semiCresta * 2 + 12, 8);
    ctx.fillStyle = C.obraSombra;
    ctx.fillRect(x - semiCresta * 0.75, coronacion - 30, semiCresta * 1.5, 24);
    ctx.strokeStyle = C.obraOscura;
    ctx.lineWidth = 1.2;
    ctx.strokeRect(x - semiCresta * 0.75, coronacion - 30, semiCresta * 1.5, 24);
    for (let i = 0; i < 3; i++) {
      ctx.fillStyle = "rgba(255,255,255,0.22)";
      ctx.fillRect(x - semiCresta * 0.55 + i * semiCresta * 0.42, coronacion - 24, 12, 9);
    }

    // Conducto con el grupo bulbo. Va bajo la coronación, no en el fondo:
    // el agua pasa por el cuerpo del dique de un lado al otro.
    const yTunel = coronacion + (base - coronacion) * 0.58;
    const medioTunel = 22;
    // El conducto se recorta contra la sección: atraviesa el dique, no asoma
    // al agua abierta como una caja pegada al talud.
    ctx.save();
    seccionDique();
    ctx.clip();
    ctx.fillStyle = "#0b2233";
    ctx.fillRect(x - semiMar, yTunel - medioTunel, semiMar + semiEmb, medioTunel * 2);
    ctx.restore();
    ctx.save();
    seccionDique();
    ctx.clip();
    ctx.strokeStyle = C.obraOscura;
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.moveTo(x - semiMar, yTunel - medioTunel);
    ctx.lineTo(x + semiEmb, yTunel - medioTunel);
    ctx.moveTo(x - semiMar, yTunel + medioTunel);
    ctx.lineTo(x + semiEmb, yTunel + medioTunel);
    ctx.stroke();
    ctx.restore();

    // Grupo bulbo: bulbo, carcasa y rodete.
    ctx.fillStyle = C.obraOscura;
    ctx.beginPath();
    ctx.ellipse(x + 26, yTunel, 20, 10, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = C.obra;
    ctx.lineWidth = 1.4;
    ctx.stroke();

    ctx.fillStyle = C.obra;
    ctx.beginPath();
    ctx.arc(x, yTunel, 15, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = C.obraSombra;
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.save();
    ctx.translate(x, yTunel);
    ctx.rotate(t * 5);
    ctx.strokeStyle = C.acento;
    ctx.lineWidth = 2.6;
    for (let i = 0; i < 6; i++) {
      const ang = (i * Math.PI) / 3;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(11.5 * Math.cos(ang), 11.5 * Math.sin(ang));
      ctx.stroke();
    }
    ctx.restore();
    ctx.fillStyle = C.obraSombra;
    ctx.beginPath();
    ctx.arc(x, yTunel, 4, 0, Math.PI * 2);
    ctx.fill();

    // Sentido del paso de agua: llena el vaso o lo vacía según el ciclo.
    const haciaEmbalse = fase > 0;
    ctx.fillStyle = "rgba(226,242,245,0.75)";
    for (let i = 0; i < 3; i++) {
      const fx = x - semiCresta - 18 + i * 24;
      const sgn = haciaEmbalse ? 1 : -1;
      ctx.beginPath();
      ctx.moveTo(fx + sgn * 9, yTunel + 15);
      ctx.lineTo(fx, yTunel + 11);
      ctx.lineTo(fx, yTunel + 19);
      ctx.closePath();
      ctx.fill();
    }

    // Cota del salto entre las dos láminas: es la variable que mueve la turbina.
    const xCota = x + semiEmb + 26;
    const yAlta = Math.min(nivelMedio, yEmbalse);
    const yBaja = Math.max(nivelMedio, yEmbalse);
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

    const saltoM = this.rangoMarea * Math.abs(fase) * 0.5;
    this.chip(
      ctx,
      `Salto ${saltoM.toFixed(1).replace(".", ",")} m · rango ${this.rangoMarea.toFixed(1).replace(".", ",")} m`,
      x,
      coronacion - 44
    );
    this.rotuloDispositivo(ctx, x, coronacion - 66, "Dique mareal");
  }

  // ---- Rótulos y anotación -------------------------------------------------

  private rotulo(
    ctx: CanvasRenderingContext2D,
    texto: string,
    x: number,
    y: number,
    alineacion: CanvasTextAlign,
    color: string,
    tam = 10
  ) {
    ctx.fillStyle = color;
    ctx.font = `${tam}px ${this.token("--font-sans", "system-ui, sans-serif")}`;
    ctx.textAlign = alineacion;
    ctx.fillText(texto, x, y);
  }

  /** Rótulo de anotación sobre fondo propio. Sin la pastilla, el texto claro
   *  se pierde en cuanto cae sobre la cresta de una ola. */
  private chip(ctx: CanvasRenderingContext2D, texto: string, x: number, y: number) {
    ctx.font = `11px ${this.token("--font-sans", "system-ui, sans-serif")}`;
    ctx.textAlign = "center";
    const ancho = (ctx.measureText?.(texto)?.width ?? texto.length * 6) + 12;
    ctx.fillStyle = "rgba(15,26,36,0.7)";
    ctx.beginPath();
    ctx.roundRect(x - ancho / 2, y - 11, ancho, 16, 3);
    ctx.fill();
    ctx.fillStyle = C.espuma;
    ctx.fillText(texto, x, y);
  }

  private rotuloDispositivo(ctx: CanvasRenderingContext2D, x: number, y: number, texto: string) {
    ctx.font = `600 11px ${this.token("--font-sans", "system-ui, sans-serif")}`;
    ctx.textAlign = "center";
    const ancho = (ctx.measureText?.(texto)?.width ?? texto.length * 6) + 14;
    ctx.fillStyle = "rgba(15,26,36,0.78)";
    ctx.beginPath();
    ctx.roundRect(x - ancho / 2, y - 12, ancho, 17, 3);
    ctx.fill();
    ctx.fillStyle = C.espuma;
    ctx.fillText(texto, x, y);
  }

  private dibujarHUD(
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number,
    nivelMedio: number,
    fondoY: number,
    dominioM: number,
    escalaOla: number,
    xPieTalud: number,
    pie: number
  ) {
    // Dos tintas: sobre el cielo la anotación va oscura, dentro del agua va
    // clara. Un solo color se pierde en la mitad del cuadro.
    const sobreCielo = "rgba(30,41,59,0.6)";
    const tenue = "rgba(232,242,245,0.8)";

    // Cota de Hm0. Las cabinas de mando ocupan los laterales del lienzo, así
    // que las anotaciones viven en la franja central, que siempre está libre.
    const altHm0 = this.alturaFlechaHm0(escalaOla);
    this.cotaHm0Px = altHm0;
    const xFlecha = w * 0.24;
    const yTop = nivelMedio - altHm0 / 2;
    const yBot = nivelMedio + altHm0 / 2;

    ctx.strokeStyle = sobreCielo;
    ctx.lineWidth = 1.4;
    // Tronco de la cota en su propio trazo: es el segmento cuya altura vale
    // Hm0 y el que mide la prueba unitaria.
    ctx.beginPath();
    ctx.moveTo(xFlecha, yTop);
    ctx.lineTo(xFlecha, yBot);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(xFlecha - 4, yTop + 4);
    ctx.lineTo(xFlecha, yTop);
    ctx.lineTo(xFlecha + 4, yTop + 4);
    ctx.moveTo(xFlecha - 4, yBot - 4);
    ctx.lineTo(xFlecha, yBot);
    ctx.lineTo(xFlecha + 4, yBot - 4);
    ctx.stroke();
    this.chip(ctx, `Hm0 ${this.Hm0.toFixed(1).replace(".", ",")} m`, xFlecha + 46, nivelMedio + 4);

    // Regla de longitud de onda sobre la superficie media.
    // La regla va en el cielo, por encima de la cresta más alta posible: es
    // donde no compite con nada del corte.
    const anchoRegla = Math.max(80, w * 0.30);
    const [m0, m1] = this.marcasIntervaloTe(anchoRegla, dominioM);
    const x0 = xFlecha + m0;
    const x1 = xFlecha + m1;
    if (this.lambda > 0 && x1 > x0) {
      const yRegla = nivelMedio - HM0_TOPE_M * escalaOla * 0.5 - 26;
      ctx.strokeStyle = sobreCielo;
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(x0, yRegla - 5);
      ctx.lineTo(x0, yRegla + 5);
      ctx.moveTo(x1, yRegla - 5);
      ctx.lineTo(x1, yRegla + 5);
      ctx.moveTo(x0, yRegla);
      ctx.lineTo(x1, yRegla);
      ctx.stroke();
      this.chip(
        ctx,
        `Te ${this.Te.toFixed(1).replace(".", ",")} s · longitud de onda ${this.lambda.toFixed(0)} m`,
        (x0 + x1) / 2,
        yRegla - 9
      );
    }

    // Cota de profundidad sobre el fondo plano, antes de que empiece el talud.
    const xCota = xPieTalud - 12;
    ctx.strokeStyle = tenue;
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    ctx.moveTo(xCota, nivelMedio);
    ctx.lineTo(xCota, fondoY);
    ctx.stroke();
    ctx.setLineDash([]);
    this.chip(ctx, `${this.profundidad} m de calado`, xCota + 56, (nivelMedio + fondoY) / 2);

    // Pie de escala: sin esto el dibujo aparentaría una proporción que no tiene.
    this.rotulo(
      ctx,
      `Corte a escala en horizontal · vertical exagerada ×${EXAGERACION_VERTICAL}`,
      w * 0.24,
      h - pie - 6,
      "left",
      tenue,
      10
    );

    // Lectura instantánea, arriba a la derecha. Con potencia calculada se
    // rotula esa; sin ella, la densidad del frente de ola, que es lo único que
    // el canvas puede afirmar por sí solo.
    const potW = this.potenciaInstantaneaW();
    const calculada = !!(this.potenciaCaptadaW && Number.isFinite(this.potenciaCaptadaW));
    const porFrente = !calculada && this.modoEnergia !== "mareomotriz";
    const etiqueta = calculada ? "Captada" : porFrente ? "J(t)" : "Flujo";
    const unidad = porFrente ? "W/m" : "W";
    const cifra = Math.round(potW)
      .toString()
      .replace(/\B(?=(\d{3})+(?!\d))/g, ".");
    const linea = `${etiqueta} = ${cifra} ${unidad}`;

    ctx.font = `600 12px ${this.token("--font-mono", "ui-monospace, monospace")}`;
    ctx.textAlign = "right";
    const anchoCaja = (ctx.measureText?.(linea)?.width ?? linea.length * 7) + 18;
    ctx.fillStyle = "rgba(15,26,36,0.72)";
    ctx.beginPath();
    ctx.roundRect(w - 12 - anchoCaja, 12, anchoCaja, 24, 4);
    ctx.fill();
    ctx.fillStyle = C.acentoClaro;
    ctx.font = `600 12px ${this.token("--font-mono", "ui-monospace, monospace")}`;
    ctx.textAlign = "right";
    ctx.fillText(linea, w - 21, 28);
    void fondoY;
  }

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
