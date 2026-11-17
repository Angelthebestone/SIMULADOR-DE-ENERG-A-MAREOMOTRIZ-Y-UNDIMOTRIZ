// AnimacionCanvas — transfiere series UNA vez por simulación, muestreo sin recalcular física.
// Dispositivos 2D hiperrealistas: ./animacion2d (granja, absorbedor PowerBuoy, dique bulbo).
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

// Rutas con extensión .ts: el runner de tests (node --experimental-strip-types)
// no resuelve imports de directorio ni sin extensión. Vite los acepta igual.
import { dibujarGranja2D } from "./animacion2d/granja2d.ts";
import { dibujarAbsorbedor2D } from "./animacion2d/absorbedor2d.ts";
import { dibujarDique2D } from "./animacion2d/dique2d.ts";

export const PROFUNDIDAD_M = 30;
const EXAGERACION_VERTICAL = 3;
/** Tope de Hm0 del deslizador. La escala vertical se ajusta para que la ola
 *  más alta quepa bajo el horizonte, y con eso la escala deja de depender del
 *  Hm0 actual: la cota crece en proporción a la altura, no a saltos. */
const HM0_TOPE_M = 4;
/** Tope del mando de rango de marea: fija la escala vertical de la marea. */
const RANGO_TOPE_M = 15;
/** Marea comprimida: un ciclo de 12,4 h en 15 s (igual que la escena 3D). */
const OMEGA_MAREA = 0.42;

export type TipoCimentacion = "pilote" | "gravedad" | "tripode";
export type ModoEnergia = "undimotriz" | "mareomotriz";

/** Paleta del corte. Tres familias: cielo, agua y obra. Colores del manual de
 *  identidad UTS: cielo en crema Pantone 451 C, agua en los verdes profundos
 *  5535/2266 C, y el lima 382 C como único acento, marcando sólo lo que
 *  produce o transporta energía. La baliza roja es señal reglamentaria. */
const C = {
  cieloAlto: "oklch(0.93 0.018 95)",
  cieloBajo: "oklch(0.955 0.028 85)",
  aguaSuperficie: "oklch(0.62 0.085 165)",
  aguaMedia: "oklch(0.42 0.07 168)",
  aguaFondo: "oklch(0.27 0.035 165)",
  espuma: "oklch(0.96 0.022 115)",
  arenaAlta: "oklch(0.76 0.05 85)",
  arenaBaja: "oklch(0.5 0.055 80)",
  roca: "oklch(0.45 0.008 100)",
  obra: "oklch(0.7 0 0)",
  obraOscura: "oklch(0.45 0 0)",
  obraSombra: "oklch(0.33 0 0)",
  tinta: "oklch(0.28 0.02 165)",
  acento: "oklch(0.72 0.15 120)",
  acentoClaro: "oklch(0.85 0.17 118)",
  // Corte del terreno: capa vegetal, suelo, arcilla y roca madre. Son los
  // mismos materiales del corte 3D, en tonos apagados para que la obra y el
  // agua sigan siendo lo que destaca.
  suelo: "oklch(0.47 0.045 132)",
  sueloClaro: "oklch(0.53 0.05 134)",
  tierra: "oklch(0.72 0.035 82)",
  tierraSombra: "oklch(0.6 0.03 78)",
  arcilla: "oklch(0.59 0.025 70)",
  rocaMadre: "oklch(0.44 0.012 100)",
  rocaMadreClara: "oklch(0.5 0.012 100)",
  hierba: "oklch(0.56 0.08 140)",
  aguaVaso: "oklch(0.58 0.07 175)",
  aguaVasoFondo: "oklch(0.33 0.045 190)",
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

  /** Miniatura de la pantalla de tecnología: sin rótulos ni chips, sólo la escena. */
  modoPrevia = false;

  /** Alto en píxeles de la cota de Hm0 tal como se acaba de pintar. Lo publica
   *  el dibujo para que se pueda comprobar sin reconstruirlo desde las
   *  llamadas al lienzo. */
  cotaHm0Px = 0;

  /** Alto en píxeles reservado al pie del lienzo para una tira superpuesta.
   *  La carcasa actual no superpone nada: Ver.vue lo pone a 0. */
  pie = 54;

  private rafId: number | null = null;
  private t0: number | null = null;
  sinSerieMsg = "";
  private medidas: [number, number] = [0, 0];
  private dpr = 0;
  private ultimoT = 0;
  /** Estado integrado con dt: mover un mando no hace saltar giros ni flujo. */
  private anguloRotor = 0;
  private avanceFlujo = 0;
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
    const dt = Math.max(0, Math.min(0.1, t - this.ultimoT));
    this.ultimoT = t;
    const [w, h] = this.ajustarDPR();
    if (w < 2 || h < 2) return;
    const ctx = this.ctx;
    ctx.clearRect(0, 0, w, h);

    if (this.modoPrevia) {
      this.dibujarPrevia(t, w, h);
      return;
    }

    // La tira de lectura de la carcasa se superpone al pie del lienzo: nada
    // que haya que leer se dibuja dentro de esa banda.
    const pie = this.pie;
    const horizonteY = h * 0.20;
    // El mar baja un poco respecto al centro del cuadro: la franja de tierra de
    // la derecha necesita aire sobre la lámina para que se lea como costa y no
    // como un bloque tapado por el minimapa.
    const nivelMarMedio = h * 0.455;
    const fondoMarY = h - pie - 26;
    const xCosta = w * 0.70;
    const xPieTalud = w * 0.38;
    const xOrillaRef = w * 0.60;
    const xMeseta = w * 0.66;
    // Llanura baja: queda por debajo del minimapa (que ocupa la esquina
    // superior derecha) y por encima de la lámina, con sitio para la
    // subestación y la torre sin que el panel las tape.
    const yMeseta = nivelMarMedio - h * 0.025;
    const esEmbalse = this.modoEnergia === "mareomotriz" && this.dispositivo === "embalse";

    // Dique: la obra cierra el corte por el centro y detrás queda el vaso, un
    // estuario contenido por el terreno de la otra orilla.
    const xDam = w * 0.56;
    const yFondoDam = nivelMarMedio + h * 0.25;
    const xFinVaso = w * 0.90;
    const yFondoVaso = yFondoDam + 10;
    const yMesetaEmb = nivelMarMedio - h * 0.085;

    const omega = (2 * Math.PI) / this.Te;
    const k = this.k > 0 ? this.k : 0.08;
    const dominioM = this.lambda > 0 ? 2.2 * this.lambda : 120;
    // Píxeles por metro vertical: la columna de agua dibujada representa la
    // profundidad real, y la ola se exagera sobre esa misma escala.
    const pxPorM = ((fondoMarY - nivelMarMedio) / this.profundidad) * EXAGERACION_VERTICAL;
    const pxPorMReal = (fondoMarY - nivelMarMedio) / this.profundidad;
    const escalaOla = Math.min(pxPorM, (nivelMarMedio - horizonteY) / HM0_TOPE_M);

    // Marea del dique: el mar oscila con el rango real (a la escala que deja
    // el resguardo de la obra) y el embalse lo sigue amortiguado y con
    // retraso. El salto h es la diferencia; el caudal va con √h (Torricelli).
    const altoDique = yFondoDam - nivelMarMedio;
    const resguardo = Math.max(40, altoDique * 0.3);
    const semiMaxPx = Math.max(8, Math.min(resguardo - 8, 0.58 * altoDique - 0.42 * resguardo - 22));
    const escalaMarea = semiMaxPx / (RANGO_TOPE_M / 2);
    const semiMarea = esEmbalse ? (Math.max(0, this.rangoMarea) / 2) * escalaMarea : 0;
    const nivelMar = nivelMarMedio - Math.sin(t * OMEGA_MAREA) * semiMarea;
    const yEmbalseMarea = nivelMarMedio - Math.sin(t * OMEGA_MAREA - 0.95) * semiMarea * 0.85;
    const saltoM = esEmbalse ? (yEmbalseMarea - nivelMar) / escalaMarea : 0;
    const caudal = Math.sign(saltoM) * Math.sqrt(Math.abs(saltoM));
    // En el estuario del dique el oleaje llega atenuado.
    const factorOla = esEmbalse ? 0.3 : 1;

    // Giro y arrastre integrados: turbina de corriente ω = TSR·U/R (R = 10 m,
    // TSR = 4,5); grupo bulbo, proporcional al caudal.
    const omegaRotor = esEmbalse ? caudal * 2.4 : (4.5 * Math.max(0, this.velocidadCorriente)) / 10;
    this.anguloRotor = (this.anguloRotor + omegaRotor * dt) % (Math.PI * 2);
    const velFlujoPx = esEmbalse ? caudal * 30 : this.velocidadCorriente * 26;
    this.avanceFlujo += velFlujoPx * dt;

    const superficieY = (px: number) =>
      nivelMar - this.eta((px / w) * dominioM, t, omega, k) * escalaOla * factorOla;

    const suave = (u: number) => {
      const c = Math.max(0, Math.min(1, u));
      return c * c * (3 - 2 * c);
    };

    /** Perfil del terreno. En la costa, el fondo sube por la playa hasta una
     *  llanura baja. En el dique, el fondo sube hasta la cimentación, el vaso
     *  queda excavado detrás y la otra orilla lo cierra por la derecha. */
    const perfilNatural = (px: number): number => {
      if (esEmbalse) {
        if (px <= xPieTalud) return fondoMarY + Math.sin(px * 0.013) * 2.5;
        if (px <= xDam - 115) {
          const u = (px - xPieTalud) / (xDam - 115 - xPieTalud);
          return fondoMarY + (yFondoDam - fondoMarY) * suave(u);
        }
        if (px <= xDam + 70) return yFondoDam;
        if (px <= xFinVaso) {
          const u = (px - (xDam + 70)) / (xFinVaso - (xDam + 70));
          return yFondoVaso + Math.sin(u * Math.PI) * 5;
        }
        const u = (px - xFinVaso) / (w * 0.08);
        return yFondoVaso + (yMesetaEmb - yFondoVaso) * suave(u);
      }
      if (px <= xPieTalud) return fondoMarY + Math.sin(px * 0.013) * 2.5;
      if (px <= xOrillaRef) {
        const u = (px - xPieTalud) / (xOrillaRef - xPieTalud);
        return fondoMarY + (nivelMarMedio + 2 - fondoMarY) * suave(u);
      }
      const u = (px - xOrillaRef) / (xMeseta - xOrillaRef);
      return nivelMarMedio + 2 + (yMeseta - (nivelMarMedio + 2)) * suave(u);
    };

    // Cada dispositivo se fondea donde le corresponde: la boya y la turbina en
    // agua abierta, el cajón en el somero y el dique cerrando el vaso.
    const xDispositivo = esEmbalse
      ? xDam
      : this.dispositivo === "owc"
        ? xPieTalud + (xOrillaRef - xPieTalud) * 0.78
        : this.dispositivo.includes("turbina") || this.dispositivo.includes("corriente")
          ? w * 0.35
          : w * 0.375;

    /** Banqueta de cimentación del cajón OWC: no se apoya en la pendiente. */
    const conBanqueta = this.dispositivo === "owc";
    const yBanqueta = perfilNatural(xDispositivo);
    const bx0 = xDispositivo - 190;
    const bx1 = Math.min(xDispositivo + 130, xOrillaRef - 40);
    // Transición larga: es un dragado con talud, no un escalón vertical.
    const transicion = 150;
    const terrenoY = (px: number): number => {
      const natural = perfilNatural(px);
      if (!conBanqueta || px < bx0 - transicion || px > bx1 + transicion) return natural;
      let f = 1;
      if (px < bx0) f = (px - (bx0 - transicion)) / transicion;
      else if (px > bx1) f = 1 - (px - bx1) / transicion;
      const u = f * f * (3 - 2 * f);
      return natural + (yBanqueta - natural) * u;
    };

    // Orilla: donde el perfil corta la línea de mar. En el dique no hay playa:
    // el agua llega hasta el pie de aguas arriba de la obra.
    const xBordeAgua = esEmbalse ? xDam - 60 : undefined;
    let xOrilla = xBordeAgua ?? xCosta;
    if (xBordeAgua === undefined) {
      for (let px = xPieTalud; px <= w; px += 3) {
        if (terrenoY(px) <= nivelMarMedio) {
          xOrilla = px;
          break;
        }
      }
    }

    /** Cota de apoyo de una obra: el punto más hondo de su huella, no el de su
     *  eje. Apoyar en el eje deja el pie de aguas afuera colgando. */
    const apoyoHuella = (desde: number, hasta: number): number => {
      let y = terrenoY(desde);
      for (let px = desde; px <= hasta; px += 5) y = Math.max(y, terrenoY(px));
      return Math.max(y, terrenoY(hasta));
    };

    this.dibujarCielo(ctx, w, horizonteY, nivelMarMedio, t);
    // En el seno de la ola y en bajamar el mar baja de su nivel medio: detrás
    // sigue habiendo cielo, no el fondo de la página.
    ctx.fillStyle = C.cieloBajo;
    ctx.fillRect(0, nivelMarMedio, w, semiMarea + (this.Hm0 / 2) * escalaOla + 14);
    const fisAgua = {
      omega,
      k,
      dominioM,
      amplitudPx: (this.Hm0 / 2) * escalaOla * factorOla,
      pxPorMReal,
      // Sentido y viveza del flujo: fijo en la corriente, con signo en el dique.
      flujo: esEmbalse ? Math.max(-1, Math.min(1, caudal / 1.2)) : Math.min(1, this.velocidadCorriente / 2.5),
      conEspuma: !esEmbalse,
      conFlechas: !esEmbalse,
    };
    this.dibujarAgua(ctx, w, h, nivelMar, fondoMarY, xBordeAgua ?? w, t, superficieY, terrenoY, fisAgua);
    this.dibujarTerreno(
      ctx,
      w,
      h,
      nivelMarMedio,
      xOrilla,
      terrenoY,
      // El corte geológico arranca en la orilla (o en el pie del dique) y la
      // hierba en la llanura: así la playa conserva su arena y el subsuelo
      // muestra las capas en todo el ancho, no sólo en la franja de la derecha.
      esEmbalse ? xDam - 140 : xOrilla - 6,
      esEmbalse ? w + 10 : xMeseta + 6,
      !esEmbalse
    );
    if (!esEmbalse) {
      this.dibujarEspumaCosta(ctx, superficieY, terrenoY, xOrilla + 6, nivelMarMedio, t);
    }

    const yApoyo = terrenoY(xDispositivo);
    const xSub = w * 0.64;
    const xTorre = w * 0.69;

    if (esEmbalse) {
      // Escollera de cimentación: el fondo dragado bajo el dique. Sin ella la
      // obra se posaba sobre un montón de arena liso.
      ctx.beginPath();
      ctx.moveTo(xDam - 124, terrenoY(xDam - 124));
      for (let px = xDam - 124; px <= xDam + 84; px += 4) ctx.lineTo(px, terrenoY(px));
      for (let px = xDam + 84; px >= xDam - 124; px -= 4) {
        ctx.lineTo(px, terrenoY(px) + 7);
      }
      ctx.closePath();
      ctx.fillStyle = "oklch(0.55 0.012 92)";
      ctx.fill();
      ctx.fillStyle = "oklch(0.63 0.01 96)";
      for (let i = 0; i < 24; i++) {
        const rx = xDam - 120 + i * 9;
        const ry = terrenoY(rx) + 3 + ((i * 7) % 4);
        ctx.beginPath();
        ctx.ellipse(rx, ry, 3.4, 1.9, 0, 0, Math.PI * 2);
        ctx.fill();
      }

      // Lámina del vaso: sube y baja con la marea, contenida por el terreno de
      // la otra orilla. El nivel del mar es la referencia del salto.
      const yEmbalse = yEmbalseMarea;
      const haciaEmbalse = saltoM > 0;
      // El velo del mar va antes que la obra: el dique lo corta, no al revés.
      this.dibujarVeloAgua(ctx, w, h, nivelMar, fondoMarY, xBordeAgua ?? w, t, superficieY, terrenoY);
      dibujarDique2D(ctx, {
        cx: xDam,
        yMedio: nivelMarMedio,
        yFondo: yApoyo,
        t,
        rangoMarea: this.rangoMarea,
        escalaV: escalaMarea,
        yEmbalse,
        yMar: nivelMar,
        saltoM,
        giro: this.anguloRotor,
        avance: this.avanceFlujo,
        terrenoY,
        xFinVaso,
        modo: haciaEmbalse ? "llenado" : "vaciado",
        sinRotulo: this.modoPrevia,
      });
    } else {
      // El cable submarino remata en la subestación de la costa.
      this.dibujarCableSubmarino(
        ctx,
        xDispositivo,
        yApoyo - 6,
        xSub + 16,
        terrenoY(xSub + 20) - 2,
        t
      );

      if (this.modoEnergia === "mareomotriz") {
        // Granja / turbina de corriente: rotor tripala rojo-naranja (capa animacion2d).
        dibujarGranja2D(ctx, {
          x: xDispositivo,
          ySuperficie: nivelMarMedio,
          yFondo: yApoyo,
          t,
          velocidadCorriente: this.velocidadCorriente,
          giro: this.anguloRotor,
          cantidadUnidades: this.cantidadUnidades,
          cimentacion: this.cimentacion,
          sinRotulo: this.modoPrevia,
        });
        if (!this.modoPrevia) {
          const yRotor = nivelMarMedio + (yApoyo - nivelMarMedio) * 0.52;
          this.chip(
            ctx,
            `Corriente ${this.velocidadCorriente.toFixed(1).replace(".", ",")} m/s · rotor ${Math.round((omegaRotor * 60) / (2 * Math.PI))} rpm`,
            xDispositivo + 124,
            yRotor - 40
          );
        }
      } else if (this.dispositivo === "owc") {
        this.dibujarOWC(ctx, xDispositivo, nivelMarMedio, yApoyo, t, omega, escalaOla, apoyoHuella, terrenoY);
      } else {
        const boyaZ =
          this.muestrearSerie(t) ?? this.eta((xDispositivo / w) * dominioM, t, omega, k) * 0.6;
        // PowerBuoy 2D: flotador amarillo + spar + placa de reactancia + pod.
        dibujarAbsorbedor2D(ctx, {
          x: xDispositivo,
          ySuperficie: nivelMarMedio,
          yFondo: yApoyo,
          t,
          zRelativo: boyaZ * escalaOla,
          Hm0: this.Hm0,
          sinRotulo: this.modoPrevia,
          // La escena dibuja el cable completo hasta la subestación: el del
          // módulo acabaría en mitad de la playa.
          sinCable: !this.modoPrevia,
        });
      }

      this.dibujarRedElectrica(ctx, w, terrenoY, xSub, xTorre);
    }

    // Velo de agua por delante de lo sumergido: la obra queda dentro del mar,
    // no pegada encima.
    if (!esEmbalse) {
      this.dibujarVeloAgua(ctx, w, h, nivelMar, fondoMarY, xBordeAgua ?? w, t, superficieY, terrenoY);
    }

    // En miniatura las anotaciones se pisan unas a otras y no se leen: a ese
    // tamaño el lienzo enseña la escena y nada más.
    if (w >= 460) {
      this.dibujarHUD(ctx, w, h, nivelMarMedio, fondoMarY, dominioM, escalaOla, pie);
    }
  }

  /** Miniatura de la pantalla de tecnología: corte centrado en el dispositivo,
   *  sin costa, cable ni red. El dique y las turbinas necesitan calado real;
   *  en la tarjeta pequeña el diorama completo se sale del encuadre. */
  private dibujarPrevia(t: number, w: number, h: number) {
    const ctx = this.ctx;
    // El dique y la torreta de las turbinas sobresalen mucho del agua: en la
    // tarjeta hay que dejar cielo arriba y calado abajo, o se cortan.
    const esDique = this.modoEnergia === "mareomotriz" && this.dispositivo === "embalse";
    const esGranja = this.modoEnergia === "mareomotriz" && !esDique;
    const horizonteY = h * (esDique ? 0.12 : 0.16);
    const nivelMarMedio = h * (esDique ? 0.48 : esGranja ? 0.44 : 0.40);
    const fondoMarY = h * 0.90;
    const omega = (2 * Math.PI) / this.Te;
    const k = this.k > 0 ? this.k : 0.08;
    const dominioM = this.lambda > 0 ? 2.2 * this.lambda : 120;
    const pxPorM = ((fondoMarY - nivelMarMedio) / this.profundidad) * EXAGERACION_VERTICAL;
    const escalaOla = Math.min(pxPorM, (nivelMarMedio - horizonteY) / HM0_TOPE_M);
    const superficieY = (px: number) =>
      nivelMarMedio - this.eta((px / w) * dominioM, t, omega, k) * escalaOla;

    this.dibujarCielo(ctx, w, horizonteY, nivelMarMedio);

    // Agua: columna abierta de borde a borde, sin talud de costa.
    const agua = ctx.createLinearGradient(0, nivelMarMedio, 0, fondoMarY);
    agua.addColorStop(0, C.aguaSuperficie);
    agua.addColorStop(0.45, C.aguaMedia);
    agua.addColorStop(1, C.aguaFondo);
    ctx.fillStyle = agua;
    ctx.beginPath();
    ctx.moveTo(0, nivelMarMedio + 2);
    for (let px = 0; px <= w; px += 4) ctx.lineTo(px, superficieY(px));
    ctx.lineTo(w, fondoMarY);
    ctx.lineTo(0, fondoMarY);
    ctx.closePath();
    ctx.fill();

    // Lecho plano arenoso.
    const lecho = ctx.createLinearGradient(0, fondoMarY - 8, 0, h);
    lecho.addColorStop(0, C.arenaAlta);
    lecho.addColorStop(1, C.arenaBaja);
    ctx.fillStyle = lecho;
    ctx.beginPath();
    ctx.moveTo(0, fondoMarY + Math.sin(t * 0.2) * 0.5);
    for (let px = 0; px <= w; px += 8) {
      ctx.lineTo(px, fondoMarY + Math.sin(px * 0.04) * 2.2);
    }
    ctx.lineTo(w, h);
    ctx.lineTo(0, h);
    ctx.closePath();
    ctx.fill();

    // Línea de espuma en la superficie.
    ctx.strokeStyle = "rgba(255,255,255,0.35)";
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    for (let px = 0; px <= w; px += 3) {
      const y = superficieY(px);
      if (px === 0) ctx.moveTo(px, y);
      else ctx.lineTo(px, y);
    }
    ctx.stroke();

    const xCentro = w * 0.48;
    const yFondo = fondoMarY + 2;

    if (this.modoEnergia === "mareomotriz" && this.dispositivo === "embalse") {
      // En la miniatura el vaso sigue el lecho plano y se sale del encuadre por
      // la derecha: se lee como estuario, no como una caja de agua.
      const yEmbalsePrev = nivelMarMedio + 3 + Math.min(14, h * 0.03) * Math.sin(t * 0.4);
      dibujarDique2D(ctx, {
        cx: xCentro,
        yMedio: nivelMarMedio,
        yFondo,
        t,
        rangoMarea: this.rangoMarea,
        escalaV: (fondoMarY - nivelMarMedio) / this.profundidad,
        yEmbalse: yEmbalsePrev,
        terrenoY: () => yFondo,
        xFinVaso: w,
        modo: yEmbalsePrev > nivelMarMedio ? "llenado" : "vaciado",
        sinRotulo: true,
      });
      return;
    }

    if (this.modoEnergia === "mareomotriz") {
      dibujarGranja2D(ctx, {
        x: xCentro,
        ySuperficie: nivelMarMedio,
        yFondo,
        t,
        velocidadCorriente: this.velocidadCorriente,
        cantidadUnidades: this.cantidadUnidades,
        cimentacion: this.cimentacion,
        sinRotulo: true,
      });
      return;
    }

    const boyaZ =
      this.muestrearSerie(t) ?? this.eta((xCentro / w) * dominioM, t, omega, k) * 0.6;
    dibujarAbsorbedor2D(ctx, {
      x: xCentro,
      ySuperficie: nivelMarMedio,
      yFondo,
      t,
      zRelativo: boyaZ * escalaOla,
      Hm0: this.Hm0,
      sinRotulo: true,
    });
  }

  // ---- Escenario -----------------------------------------------------------

  /** Ruido determinista 0..1 por índice: nubes y partículas sin Math.random,
   *  así dos fotogramas del mismo instante son idénticos. */
  private azar(i: number, canal = 0): number {
    const s = Math.sin(i * 12.9898 + canal * 78.233) * 43758.5453;
    return s - Math.floor(s);
  }

  private dibujarCielo(ctx: CanvasRenderingContext2D, w: number, horizonteY: number, nivelMar: number, t = 0) {
    const cielo = ctx.createLinearGradient(0, 0, 0, nivelMar);
    cielo.addColorStop(0, C.cieloAlto);
    cielo.addColorStop(1, C.cieloBajo);
    ctx.fillStyle = cielo;
    ctx.fillRect(0, 0, w, nivelMar + 2);

    // Sol velado: un resplandor cálido, no un disco. Da dirección a la luz
    // de los haces que bajan por el agua.
    const sx = w * 0.22;
    const sy = Math.max(22, horizonteY * 0.5);
    const halo = ctx.createRadialGradient(sx, sy, 0, sx, sy, Math.max(140, w * 0.26));
    halo.addColorStop(0, "rgba(255,248,222,0.95)");
    halo.addColorStop(0.07, "rgba(255,244,208,0.6)");
    halo.addColorStop(0.35, "rgba(255,240,205,0.2)");
    halo.addColorStop(1, "rgba(255,240,205,0)");
    ctx.fillStyle = halo;
    ctx.fillRect(0, 0, w, nivelMar);

    // Bancos de nubes: lóbulos blandos, a la deriva.
    const esc = Math.max(0.45, Math.min(1.15, nivelMar / 300));
    for (let i = 0; i < 6; i++) {
      const deriva = t * 0.0035 * (0.5 + this.azar(i, 1));
      const cx = (((this.azar(i) * 1.4 + deriva) % 1.4) - 0.2) * w;
      const cy = nivelMar * (0.1 + 0.46 * this.azar(i, 2));
      const e = esc * (0.6 + this.azar(i, 3) * 0.9);
      for (let j = 0; j < 5; j++) {
        const lx = cx + (j - 2) * 34 * e;
        const ly = cy - Math.sin(j * 1.3 + i) * 7 * e;
        const r = (24 + this.azar(i * 7 + j, 4) * 22) * e;
        const nube = ctx.createRadialGradient(lx, ly - r * 0.2, 0, lx, ly, r * 1.3);
        nube.addColorStop(0, "rgba(255,255,255,0.62)");
        nube.addColorStop(0.55, "rgba(255,253,246,0.26)");
        nube.addColorStop(1, "rgba(255,253,246,0)");
        ctx.fillStyle = nube;
        ctx.beginPath();
        ctx.ellipse(lx, ly, r * 1.5, r * 0.62, 0, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Banda de bruma sobre el horizonte: da profundidad sin dibujar nubes.
    const bruma = ctx.createLinearGradient(0, horizonteY - 18, 0, horizonteY + 10);
    bruma.addColorStop(0, "rgba(255,255,255,0)");
    bruma.addColorStop(1, "rgba(255,255,255,0.65)");
    ctx.fillStyle = bruma;
    ctx.fillRect(0, horizonteY - 18, w, 28);
  }

  /** Una sola masa de terreno con el mismo perfil dentro y fuera del agua. El
   *  cambio de material va en la orilla, no en la línea de mar: a un lado
   *  arena, al otro un corte geológico —capa vegetal, suelo, arcilla y roca
   *  madre—. Sin esas capas la tierra era un bloque plano que parecía una obra
   *  sin terminar. */
  private dibujarTerreno(
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number,
    nivelMar: number,
    xOrilla: number,
    terrenoY: (px: number) => number,
    xEstratos: number,
    xHierba: number,
    conPlaya: boolean
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
    // Borde de corte: el corte geológico arranca en la cresta de la duna y
    // deja una cuña de arena bajo ella, en vez de una costura vertical.
    const corteIzq = 40;
    ctx.beginPath();
    ctx.moveTo(xEstratos, 0);
    ctx.lineTo(w, 0);
    ctx.lineTo(w, h);
    ctx.lineTo(xEstratos + corteIzq, h);
    ctx.closePath();
    ctx.clip();

    const capas = [
      // La primera capa es arena: la playa no cambia de material en la orilla,
      // y el corte empieza justo debajo de ella.
      { y0: 0, y1: 6, a: "oklch(0.7 0.045 84)", b: "oklch(0.63 0.04 82)" },
      { y0: 6, y1: 30, a: "oklch(0.6 0.035 78)", b: "oklch(0.54 0.03 76)" },
      { y0: 30, y1: 66, a: "oklch(0.74 0.03 88)", b: "oklch(0.66 0.03 84)" },
      { y0: 66, y1: 110, a: C.arcilla, b: "oklch(0.52 0.022 68)" },
      { y0: 110, y1: 440, a: C.rocaMadreClara, b: C.rocaMadre },
    ];
    const xIniCapa = xEstratos - 4;
    for (const capa of capas) {
      ctx.beginPath();
      let primero = true;
      for (let px = xIniCapa; px <= w + 4; px += 4) {
        const y = terrenoY(px) + capa.y0;
        if (primero) {
          ctx.moveTo(px, y);
          primero = false;
        } else ctx.lineTo(px, y);
      }
      for (let px = w + 4; px >= xIniCapa; px -= 4) {
        ctx.lineTo(px, terrenoY(px) + capa.y1);
      }
      ctx.closePath();
      const g = ctx.createLinearGradient(0, nivelMar, 0, h);
      g.addColorStop(0, capa.a);
      g.addColorStop(1, capa.b);
      ctx.fillStyle = g;
      ctx.fill();
    }

    // Contactos entre capas: una línea ondulada, no un borde de regla.
    ctx.strokeStyle = "rgba(48,42,32,0.16)";
    ctx.lineWidth = 1;
    for (const yOff of [6, 30, 66, 110]) {
      ctx.beginPath();
      for (let px = xIniCapa; px <= w + 4; px += 4) {
        const y = terrenoY(px) + yOff + Math.sin(px * 0.045 + yOff * 0.7) * 1.6;
        if (px === xIniCapa) ctx.moveTo(px, y);
        else ctx.lineTo(px, y);
      }
      ctx.stroke();
    }

    // Cantos en el suelo y la arcilla: tamaño y separación irregulares.
    ctx.fillStyle = C.roca;
    ctx.globalAlpha = 0.26;
    for (let i = 0; i < 26; i++) {
      const rx = xEstratos + (((i * 137) % 1000) / 1000) * (w - xEstratos);
      const ry = terrenoY(rx) + 34 + ((i * 61) % 60);
      const rr = 1.6 + ((i * 29) % 5) * 0.7;
      ctx.beginPath();
      ctx.ellipse(rx, ry, rr, rr * 0.55, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // Roca madre: estratos horizontales tenues y trazos inclinados. Sin esta
    // textura la capa profunda volvía a ser un bloque plano, ahora en gris.
    ctx.strokeStyle = "rgba(28,30,28,0.1)";
    ctx.lineWidth = 1;
    for (let i = 0; i < 8; i++) {
      const yOff = 128 + i * 30;
      ctx.beginPath();
      for (let px = xIniCapa; px <= w + 4; px += 6) {
        const y = terrenoY(px) + yOff + Math.sin(px * 0.02 + i) * 3;
        if (px === xIniCapa) ctx.moveTo(px, y);
        else ctx.lineTo(px, y);
      }
      ctx.stroke();
    }
    ctx.strokeStyle = "rgba(30,32,30,0.12)";
    for (let i = 0; i < 26; i++) {
      const rx = xEstratos + (((i * 173) % 1000) / 1000) * (w - xEstratos);
      const ry = terrenoY(rx) + 124 + ((i * 47) % 84);
      ctx.beginPath();
      ctx.moveTo(rx - 6, ry + 8);
      ctx.lineTo(rx + 8, ry - 8);
      ctx.stroke();
    }
    ctx.restore();

    // Arena mojada: la transición no es un corte, es una franja. Sólo en la
    // playa; en el vaso del dique el agua llega a la obra.
    if (conPlaya) {
      const franja = ctx.createLinearGradient(xOrilla - 10, 0, xOrilla + 34, 0);
      franja.addColorStop(0, "rgba(201,195,180,0)");
      franja.addColorStop(1, C.tierra);
      ctx.save();
      perfil();
      ctx.clip();
      ctx.fillStyle = franja;
      ctx.fillRect(xOrilla - 10, 0, 44, h);
      ctx.restore();
    }

    // Hierba sobre la llanura: sólo donde la pendiente deja de ser un talud y
    // el terreno está por encima de la lámina.
    ctx.strokeStyle = C.hierba;
    ctx.lineWidth = 2;
    ctx.beginPath();
    let tramo = false;
    for (let px = xHierba; px <= w; px += 4) {
      const pendiente = Math.abs(terrenoY(px + 8) - terrenoY(px - 8));
      if (pendiente > 9 || terrenoY(px) > nivelMar - 4) {
        tramo = false;
        continue;
      }
      const y = terrenoY(px) - 0.5;
      if (!tramo) {
        ctx.moveTo(px, y);
        tramo = true;
      } else ctx.lineTo(px, y);
    }
    ctx.stroke();
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    for (let px = xHierba + 4; px <= w; px += 13) {
      const pendiente = Math.abs(terrenoY(px + 8) - terrenoY(px - 8));
      if (pendiente > 9 || terrenoY(px) > nivelMar - 4) continue;
      const y = terrenoY(px) - 1;
      ctx.moveTo(px, y);
      ctx.lineTo(px - 1.5, y - 3.2);
      ctx.moveTo(px, y);
      ctx.lineTo(px + 1.4, y - 2.4);
    }
    ctx.stroke();

    // Filo del terreno: cierra la masa y separa el suelo del cielo.
    ctx.beginPath();
    ctx.moveTo(0, terrenoY(0));
    for (let px = 4; px <= w; px += 4) ctx.lineTo(px, terrenoY(px));
    ctx.strokeStyle = "rgba(60,55,45,0.42)";
    ctx.lineWidth = 1.3;
    ctx.stroke();

    // Cantos sobre el fondo marino, con tamaños y separaciones desiguales.
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

  /** Abscisa donde el terreno corta la superficie: la orilla del agua. */
  private bordeAgua(
    xCosta: number,
    superficieY: (px: number) => number,
    terrenoY: (px: number) => number
  ): number {
    for (let px = 0; px <= xCosta; px += 3) {
      if (terrenoY(px) <= superficieY(px)) return px;
    }
    return xCosta;
  }

  /** Recorte con la masa de agua: de la superficie al terreno. */
  private recortarAgua(
    ctx: CanvasRenderingContext2D,
    borde: number,
    superficieY: (px: number) => number,
    terrenoY: (px: number) => number
  ) {
    const paso = 3;
    ctx.beginPath();
    ctx.moveTo(0, superficieY(0));
    for (let px = paso; px <= borde; px += paso) ctx.lineTo(px, superficieY(px));
    for (let px = borde; px >= 0; px -= paso) ctx.lineTo(px, terrenoY(px) + 2);
    ctx.closePath();
    ctx.clip();
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
    terrenoY: (px: number) => number,
    fis: {
      omega: number;
      k: number;
      dominioM: number;
      amplitudPx: number;
      pxPorMReal: number;
      flujo: number;
      conEspuma: boolean;
      conFlechas: boolean;
    }
  ) {
    const paso = 3;
    // El agua llega hasta donde el terreno corta la superficie: la orilla.
    const borde = this.bordeAgua(xCosta, superficieY, terrenoY);

    ctx.save();
    this.recortarAgua(ctx, borde, superficieY, terrenoY);

    const agua = ctx.createLinearGradient(0, nivelMedio - 20, 0, fondoY + 20);
    agua.addColorStop(0, C.aguaSuperficie);
    agua.addColorStop(0.35, C.aguaMedia);
    agua.addColorStop(1, C.aguaFondo);
    ctx.fillStyle = agua;
    ctx.fillRect(0, nivelMedio - 60, w, h);

    // Luz que entra por la lámina: una franja clara bajo la superficie.
    const lamina = ctx.createLinearGradient(0, nivelMedio - 24, 0, nivelMedio + 70);
    lamina.addColorStop(0, "rgba(214,244,226,0.3)");
    lamina.addColorStop(1, "rgba(214,244,226,0)");
    ctx.fillStyle = lamina;
    ctx.fillRect(0, nivelMedio - 60, w, 140);

    // Haces de luz: inclinados según el sol, se mecen y se apagan con la
    // profundidad. Marcan que hay superficie encima.
    const haz = ctx.createLinearGradient(0, nivelMedio - 10, 0, fondoY + 20);
    haz.addColorStop(0, "rgba(255,255,236,0.2)");
    haz.addColorStop(0.7, "rgba(255,255,236,0.04)");
    haz.addColorStop(1, "rgba(255,255,236,0)");
    ctx.fillStyle = haz;
    for (let i = 0; i < 8; i++) {
      const deriva = t * 0.009 * (i % 2 ? 1 : -0.6);
      const x0 = ((((this.azar(i, 5) + deriva) % 1) + 1) % 1) * (borde + 120) - 60;
      const ancho = 14 + this.azar(i, 6) * 34;
      const caida = 46 + this.azar(i, 7) * 40;
      ctx.globalAlpha = 0.45 + 0.4 * Math.sin(t * 0.6 + i * 1.9);
      ctx.beginPath();
      ctx.moveTo(x0, nivelMedio - 10);
      ctx.lineTo(x0 + ancho, nivelMedio - 10);
      ctx.lineTo(x0 + ancho * 1.8 + caida, fondoY + 20);
      ctx.lineTo(x0 + caida, fondoY + 20);
      ctx.closePath();
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    const mareal = this.modoEnergia === "mareomotriz";
    const sentido = fis.flujo >= 0 ? 1 : -1;
    const viveza = Math.min(1, Math.abs(fis.flujo));

    // Vector de corriente: sólo en modo mareal. Avanza con el flujo integrado
    // y, en el dique, cambia de sentido con el salto.
    if (mareal && fis.conFlechas && viveza > 0.08) {
      const desplazamiento = ((this.avanceFlujo % 120) + 120) % 120;
      ctx.strokeStyle = `rgba(232,242,245,${(0.28 * viveza).toFixed(3)})`;
      ctx.fillStyle = `rgba(232,242,245,${(0.38 * viveza).toFixed(3)})`;
      ctx.lineWidth = 1.2;
      for (let fy = nivelMedio + 34; fy < fondoY - 12; fy += 34) {
        for (let fx = -120 + desplazamiento; fx < borde; fx += 120) {
          const largo = 26;
          const punta = sentido > 0 ? fx + largo : fx;
          ctx.beginPath();
          ctx.moveTo(fx, fy);
          ctx.lineTo(fx + largo, fy);
          ctx.stroke();
          ctx.beginPath();
          ctx.moveTo(punta + 5 * sentido, fy);
          ctx.lineTo(punta - 2 * sentido, fy - 3);
          ctx.lineTo(punta - 2 * sentido, fy + 3);
          ctx.closePath();
          ctx.fill();
        }
      }
    }

    // Partículas en suspensión. Con oleaje describen las órbitas de la ola
    // lineal, de radio a·e^(−k·z): grandes arriba, casi nulas en el fondo.
    // Con corriente, las arrastra el flujo y dejan una estela proporcional.
    const n = 72;
    ctx.lineWidth = 1;
    for (let i = 0; i < n; i++) {
      const bx = this.azar(i, 1) * borde;
      const by = nivelMedio + 16 + this.azar(i, 2) * (fondoY - nivelMedio - 26);
      const tam = 0.9 + this.azar(i, 3) * 1.1;
      let x = bx;
      let y = by;
      if (mareal) {
        x = (((bx + this.avanceFlujo * (0.7 + 0.6 * this.azar(i, 4))) % borde) + borde) % borde;
        if (y > terrenoY(x) - 5) continue;
        const estela = (3 + 9 * viveza) * sentido;
        ctx.strokeStyle = `rgba(236,248,242,${(0.12 + 0.3 * viveza).toFixed(3)})`;
        ctx.beginPath();
        ctx.moveTo(x - estela, y);
        ctx.lineTo(x, y);
        ctx.stroke();
      } else {
        if (by > terrenoY(bx) - 5) continue;
        const profM = (by - nivelMedio) / Math.max(0.01, fis.pxPorMReal);
        const r = fis.amplitudPx * Math.exp(-fis.k * profM);
        const fase = fis.k * (bx / w) * fis.dominioM - fis.omega * t;
        x = bx - r * Math.sin(fase);
        y = by - r * Math.cos(fase);
        // Alguna órbita se deja dibujada: se ve cómo se cierra y cómo mengua.
        if (i % 6 === 0 && r > 2.5) {
          ctx.strokeStyle = "rgba(236,248,242,0.2)";
          ctx.beginPath();
          ctx.arc(bx, by, r, 0, Math.PI * 2);
          ctx.stroke();
        }
      }
      ctx.fillStyle = `rgba(236,248,242,${(0.3 + 0.35 * this.azar(i, 8)).toFixed(3)})`;
      ctx.beginPath();
      ctx.arc(x, y, tam, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    // Línea de superficie: brillo fino con una sombra debajo que le da grosor.
    ctx.beginPath();
    ctx.moveTo(0, superficieY(0) + 2.5);
    for (let px = paso; px <= borde; px += paso) ctx.lineTo(px, superficieY(px) + 2.5);
    ctx.strokeStyle = "rgba(10,60,50,0.22)";
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, superficieY(0));
    for (let px = paso; px <= borde; px += paso) ctx.lineTo(px, superficieY(px));
    ctx.strokeStyle = "rgba(255,255,255,0.72)";
    ctx.lineWidth = 1.6;
    ctx.stroke();

    // Borreguillos: espuma en la cresta sólo cuando la ola es empinada
    // (Hm0/λ alto): mar de 0,5 m liso, mar de 4 m con rompientes.
    const peralte = this.lambda > 0 ? this.Hm0 / this.lambda : 0;
    const rompe = Math.max(0, Math.min(1, (peralte - 0.014) / 0.03));
    if (fis.conEspuma && rompe > 0 && fis.amplitudPx > 3) {
      ctx.fillStyle = C.espuma;
      for (let px = 0; px <= borde - 6; px += 5) {
        const ys = superficieY(px);
        const e = (nivelMedio - ys) / fis.amplitudPx;
        if (e < 0.7) continue;
        const r = (e - 0.7) * 16 * rompe * (0.6 + 0.8 * this.azar(Math.floor(px / 5), 9));
        if (r < 0.6) continue;
        ctx.globalAlpha = 0.35 + 0.4 * rompe;
        ctx.beginPath();
        ctx.arc(px + Math.sin(t * 2 + px) * 1.5, ys + 1, r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }
  }

  /** Segunda pasada de agua, por delante de la obra sumergida: tinte que
   *  crece con la profundidad y manchas de luz (cáusticas) sobre el fondo. */
  private dibujarVeloAgua(
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
    const borde = this.bordeAgua(xCosta, superficieY, terrenoY);
    ctx.save();
    this.recortarAgua(ctx, borde, superficieY, terrenoY);
    const velo = ctx.createLinearGradient(0, nivelMedio, 0, fondoY + 10);
    velo.addColorStop(0, "rgba(46,120,100,0.05)");
    velo.addColorStop(1, "rgba(12,44,40,0.36)");
    ctx.fillStyle = velo;
    ctx.fillRect(0, nivelMedio - 60, w, h);

    // Cáusticas: la luz que enfocan las olas baila sobre el lecho.
    ctx.fillStyle = "rgba(255,250,214,1)";
    for (let i = 0; i < 16; i++) {
      const x = ((((this.azar(i, 11) + t * 0.006 * (i % 2 ? 1 : -1)) % 1) + 1) % 1) * borde;
      const y = terrenoY(x);
      const calado = (y - nivelMedio) / Math.max(1, fondoY - nivelMedio);
      if (calado < 0.15) continue;
      ctx.globalAlpha = (0.05 + 0.07 * (0.5 + 0.5 * Math.sin(t * 1.3 + i * 2.1))) * (1.2 - calado * 0.5);
      ctx.beginPath();
      ctx.ellipse(x, y + 1, 14 + this.azar(i, 12) * 22, 2.6, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.restore();
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
   *  abscisa**. La subestación y la torre van sobre la llanura, no sobre la
   *  pendiente de la playa, y la línea sale del cuadro por la derecha: la
   *  ciudad que antes asomaba bajo el minimapa era una carga sin sitio. */
  private dibujarRedElectrica(
    ctx: CanvasRenderingContext2D,
    w: number,
    terrenoY: (px: number) => number,
    xSub: number,
    xTorre: number
  ) {
    // Explanada de la subestación: una obra no se posa sobre la pendiente.
    const sueloSub = terrenoY(xSub + 16);
    const medioPatio = 38;
    ctx.fillStyle = C.tierraSombra;
    ctx.beginPath();
    ctx.moveTo(xSub - medioPatio, sueloSub + 3);
    ctx.lineTo(xSub - medioPatio + 4, sueloSub - 1);
    ctx.lineTo(xSub + medioPatio - 4, sueloSub - 1);
    ctx.lineTo(xSub + medioPatio, sueloSub + 3);
    ctx.closePath();
    ctx.fill();

    // Transformador: cuerpo con radiadores, tapa y tres pasatapas.
    const yTrafo = sueloSub - 19;
    ctx.fillStyle = C.obraOscura;
    ctx.fillRect(xSub - 13, yTrafo, 26, 18);
    ctx.strokeStyle = C.obraSombra;
    ctx.lineWidth = 1;
    ctx.strokeRect(xSub - 13, yTrafo, 26, 18);
    ctx.fillStyle = C.obra;
    ctx.fillRect(xSub - 15, yTrafo - 3, 30, 4);
    ctx.strokeStyle = C.obraSombra;
    ctx.lineWidth = 1;
    for (let i = 0; i < 4; i++) {
      ctx.beginPath();
      ctx.moveTo(xSub - 11 + i * 6, yTrafo + 2);
      ctx.lineTo(xSub - 11 + i * 6, yTrafo + 16);
      ctx.stroke();
    }
    for (const dx of [-8, 0, 8]) {
      ctx.strokeStyle = C.tinta;
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(xSub + dx, yTrafo - 3);
      ctx.lineTo(xSub + dx, yTrafo - 11);
      ctx.stroke();
      ctx.fillStyle = C.espuma;
      for (let k = 0; k < 3; k++) {
        ctx.beginPath();
        ctx.arc(xSub + dx, yTrafo - 5 - k * 2.2, 1.7, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    // Armario de control junto al transformador.
    ctx.fillStyle = C.obra;
    ctx.fillRect(xSub + 18, sueloSub - 13, 7, 12);
    ctx.strokeStyle = C.obraSombra;
    ctx.strokeRect(xSub + 18, sueloSub - 13, 7, 12);

    // Valla del patio.
    ctx.strokeStyle = "rgba(60,70,72,0.5)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let i = 0; i <= 6; i++) {
      const vx = xSub - medioPatio + 2 + (i * (medioPatio * 2 - 4)) / 6;
      ctx.moveTo(vx, sueloSub - 1);
      ctx.lineTo(vx, sueloSub - 9);
    }
    ctx.moveTo(xSub - medioPatio + 2, sueloSub - 8);
    ctx.lineTo(xSub + medioPatio - 2, sueloSub - 8);
    ctx.stroke();

    // Torre de celosía: montantes que convergen, tramos arriostrados y dos
    // crucetas con aisladores.
    const yBase = terrenoY(xTorre);
    const yTop = yBase - 96;
    const anchoBase = 9;
    const anchoTop = 3;
    const montante = (s: number, y: number) =>
      xTorre + s * (anchoTop + (anchoBase - anchoTop) * ((y - yTop) / (yBase - yTop)));

    ctx.strokeStyle = C.tinta;
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(montante(-1, yBase), yBase);
    ctx.lineTo(montante(-1, yTop), yTop);
    ctx.moveTo(montante(1, yBase), yBase);
    ctx.lineTo(montante(1, yTop), yTop);
    ctx.stroke();

    ctx.lineWidth = 0.8;
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

    const crucetas = [yTop + 12, yTop + 34];
    const brazos = [20, 16];
    for (let i = 0; i < crucetas.length; i++) {
      const yc = crucetas[i];
      const brazo = brazos[i];
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(xTorre - brazo, yc);
      ctx.lineTo(xTorre + brazo, yc);
      ctx.stroke();
      ctx.lineWidth = 0.9;
      for (const s of [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo(xTorre + s * brazo, yc);
        ctx.lineTo(xTorre + s * brazo, yc + 5);
        ctx.stroke();
        ctx.fillStyle = C.espuma;
        ctx.beginPath();
        ctx.arc(xTorre + s * brazo, yc + 6, 1.6, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Línea aérea con catenaria: de la subestación a la torre y de la torre al
    // borde del cuadro, donde la red sigue fuera de plano.
    const conductor = (x0: number, y0: number, x1: number, y1: number) => {
      ctx.beginPath();
      ctx.moveTo(x0, y0);
      ctx.quadraticCurveTo((x0 + x1) / 2, Math.max(y0, y1) + 14, x1, y1);
      ctx.stroke();
    };
    ctx.strokeStyle = C.tinta;
    ctx.lineWidth = 1;
    conductor(xSub + 8, yTrafo - 11, xTorre - 20, crucetas[0] + 6);
    conductor(xSub - 8, yTrafo - 11, xTorre - 16, crucetas[1] + 6);
    conductor(xTorre + 20, crucetas[0] + 6, w, crucetas[0] + 14);
    conductor(xTorre + 16, crucetas[1] + 6, w, crucetas[1] + 18);

    // Patas de la torre sobre el terreno.
    ctx.strokeStyle = C.tinta;
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(montante(-1, yBase), yBase);
    ctx.lineTo(montante(-1, yBase) - 2, yBase + 3);
    ctx.moveTo(montante(1, yBase), yBase);
    ctx.lineTo(montante(1, yBase) + 2, yBase + 3);
    ctx.stroke();
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
    cuerpo.addColorStop(0, "oklch(0.47 0.1 45)");
    cuerpo.addColorStop(0.4, C.acento);
    cuerpo.addColorStop(1, "oklch(0.44 0.095 42)");
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
    ctx.strokeStyle = "oklch(0.38 0.08 42)";
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
    ctx.fillStyle = Math.sin(t * 3) > 0.4 ? "oklch(0.62 0.19 30)" : "oklch(0.44 0.11 32)";
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
    ctx.fillStyle = "oklch(0.22 0.025 190)";
    ctx.fillRect(camIzq, techo, camDer - camIzq, suelo - techo);

    // Lámina interior, desfasada respecto al mar de fuera: es lo que bombea el
    // aire por el conducto.
    const etaInterior = (this.Hm0 / 2) * Math.cos(-omega * t + 0.9);
    const yInterior = Math.min(
      suelo - 8,
      Math.max(techo + 12, nivelMedio - etaInterior * escalaOla * 1.4)
    );
    const columna = ctx.createLinearGradient(0, yInterior, 0, suelo);
    columna.addColorStop(0, "oklch(0.62 0.085 165)");
    columna.addColorStop(1, "oklch(0.36 0.05 190)");
    ctx.fillStyle = columna;
    ctx.fillRect(camIzq, yInterior, camDer - camIzq, suelo - yInterior);
    ctx.fillStyle = "rgba(255,255,255,0.6)";
    ctx.fillRect(camIzq, yInterior - 1.5, camDer - camIzq, 3);

    // Agua de mar entrando por la abertura: el hueco es real, no un parche.
    ctx.fillStyle = "oklch(0.52 0.07 175)";
    ctx.fillRect(x0, yAbertura, espesor, abertura);

    const hormigon = ctx.createLinearGradient(x0, 0, x1, 0);
    hormigon.addColorStop(0, C.obra);
    hormigon.addColorStop(0.5, "oklch(0.76 0.01 240)");
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

    ctx.fillStyle = Math.sin(t * 3) > 0.4 ? "oklch(0.62 0.19 30)" : "oklch(0.44 0.11 32)";
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
      vaso.addColorStop(0, "oklch(0.62 0.085 165)");
      vaso.addColorStop(1, "oklch(0.38 0.06 200)");
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
    ctx.fillStyle = "oklch(0.23 0.03 195)";
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
    this.rotuloDispositivo(ctx, x, coronacion - 66, "Dique de marea");
  }

  // ---- Rótulos y anotación -------------------------------------------------

  private rotulo(
    ctx: CanvasRenderingContext2D,
    texto: string,
    x: number,
    y: number,
    alineacion: CanvasTextAlign,
    color: string,
    tam = 12
  ) {
    ctx.fillStyle = color;
    ctx.font = `${tam}px ${this.token("--font-sans", "system-ui, sans-serif")}`;
    ctx.textAlign = alineacion;
    ctx.fillText(texto, x, y);
  }

  /** Rótulo de anotación sobre fondo propio. Sin la pastilla, el texto claro
   *  se pierde en cuanto cae sobre la cresta de una ola. */
  private chip(ctx: CanvasRenderingContext2D, texto: string, x: number, y: number) {
    // 12 px es el mínimo legible del corte: por debajo, la anotación se pierde
    // en cuanto el lienzo se reduce a la columna de la vista de simulación.
    ctx.font = `12px ${this.token("--font-sans", "system-ui, sans-serif")}`;
    ctx.textAlign = "center";
    const ancho = (ctx.measureText?.(texto)?.width ?? texto.length * 6.5) + 14;
    ctx.fillStyle = "rgba(15,26,36,0.72)";
    ctx.beginPath();
    ctx.roundRect(x - ancho / 2, y - 13, ancho, 18, 3);
    ctx.fill();
    ctx.fillStyle = C.espuma;
    ctx.fillText(texto, x, y);
  }

  private rotuloDispositivo(ctx: CanvasRenderingContext2D, x: number, y: number, texto: string) {
    ctx.font = `600 12px ${this.token("--font-sans", "system-ui, sans-serif")}`;
    ctx.textAlign = "center";
    const ancho = (ctx.measureText?.(texto)?.width ?? texto.length * 6.5) + 16;
    ctx.fillStyle = "rgba(15,26,36,0.8)";
    ctx.beginPath();
    ctx.roundRect(x - ancho / 2, y - 14, ancho, 19, 3);
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
    pie: number
  ) {
    // Dos tintas: sobre el cielo la anotación va oscura, dentro del agua va
    // clara. Un solo color se pierde en la mitad del cuadro.
    const sobreCielo = "rgba(30,41,59,0.6)";
    const tenue = "rgba(232,242,245,0.8)";

    // El dique de marea no se lee con Hm0 ni con Te: su escala es el rango y
    // el salto, que rotula la escena del dique.
    const esDique = this.modoEnergia === "mareomotriz" && this.dispositivo === "embalse";
    if (esDique) {
      this.cotaHm0Px = 0;
    } else {
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
        // La regla sube hasta el cielo libre: a la altura de la cresta se cruzaba
        // con el chip del dispositivo.
        const yRegla = nivelMedio - HM0_TOPE_M * escalaOla * 0.5 - 68;
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
    }

    // Cota de profundidad en agua abierta, lejos del dispositivo y de la cota
    // de Hm0: antes caía sobre el fuste y se comía el rótulo de la corriente.
    const xCota = w * 0.20;
    ctx.strokeStyle = tenue;
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    ctx.moveTo(xCota, nivelMedio);
    ctx.lineTo(xCota, fondoY);
    ctx.stroke();
    ctx.setLineDash([]);
    this.chip(ctx, `${this.profundidad} m de calado`, xCota + 72, (nivelMedio + fondoY) / 2);

    // Pie de escala: sin esto el dibujo aparentaría una proporción que no tiene.
    this.rotulo(
      ctx,
      `Corte a escala en horizontal · vertical exagerada ×${EXAGERACION_VERTICAL}`,
      w * 0.24,
      h - pie - 6,
      "left",
      tenue,
      12
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
