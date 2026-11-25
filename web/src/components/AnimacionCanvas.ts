// AnimacionCanvas — transfiere series UNA vez por simulación, muestreo sin recalcular física.
// Dispositivos 2D: ./animacion2d (granja, absorbedor PowerBuoy, dique bulbo).
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
//
// Física del dibujo
// -----------------
// La superficie la da ./animacion2d/oleaje2d: dispersión con la profundidad
// local, asomeramiento, rotura por calado y segundo orden de Stokes. El tren
// principal es el del contrato y está en fase con la serie del dispositivo:
// la fuerza de excitación del núcleo es Fe·cos(ω·t) en el eje de la boya, así
// que la ola dibujada en ese punto vale (Hm0/2)·cos(ω·t) con el mismo reloj.
// La serie se reproduce en bucle sólo en su tramo estacionario (de un cruce
// ascendente a otro), así el arranque desde reposo no reaparece cada vuelta.
//
// Reloj
// -----
// Un único bucle requestAnimationFrame y un reloj que sólo avanza: pausar,
// reanudar o mover un mando no devuelve la escena al instante cero.

// Rutas con extensión .ts: el runner de tests (node --experimental-strip-types)
// no resuelve imports de directorio ni sin extensión. Vite los acepta igual.
import {
  dibujarGranja2D,
  disposicionGranja,
  dibujarEstelaSuperficie,
  TSR,
  RADIO_ROTOR_M,
} from "./animacion2d/granja2d.ts";
import { dibujarAbsorbedor2D, geometriaAbsorbedor } from "./animacion2d/absorbedor2d.ts";
import { dibujarDique2D, geometriaDique } from "./animacion2d/dique2d.ts";
import { CampoOleaje2D, tramoEstacionario } from "./animacion2d/oleaje2d.ts";

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
/** Columnas de cálculo de la superficie (px). */
const PASO_COLUMNA = 3;

export type TipoCimentacion = "pilote" | "gravedad" | "tripode";
export type ModoEnergia = "undimotriz" | "mareomotriz";

/** Paleta del corte. Tres familias: cielo, agua y obra. Colores del manual de
 *  identidad UTS: cielo en crema Pantone 451 C, agua en los verdes profundos
 *  5535/2266 C, y el lima 382 C como único acento, marcando sólo lo que
 *  produce o transporta energía. La baliza roja es señal reglamentaria. */
const C = {
  cieloAlto: "oklch(0.92 0.02 230)",
  cieloMedio: "oklch(0.945 0.022 95)",
  cieloBajo: "oklch(0.955 0.03 85)",
  marLejano: "oklch(0.78 0.04 190)",
  marLejanoCerca: "oklch(0.6 0.075 172)",
  aguaSuperficie: "oklch(0.66 0.085 168)",
  aguaMedia: "oklch(0.47 0.072 170)",
  aguaFondo: "oklch(0.31 0.045 172)",
  espuma: "oklch(0.97 0.018 115)",
  arenaAlta: "oklch(0.78 0.05 85)",
  arenaBaja: "oklch(0.56 0.05 80)",
  arenaMojada: "oklch(0.6 0.045 78)",
  roca: "oklch(0.45 0.008 100)",
  obra: "oklch(0.7 0 0)",
  obraOscura: "oklch(0.45 0 0)",
  obraSombra: "oklch(0.33 0 0)",
  tinta: "oklch(0.28 0.02 165)",
  acento: "oklch(0.72 0.15 120)",
  acentoClaro: "oklch(0.85 0.17 118)",
  tierra: "oklch(0.72 0.035 82)",
  tierraSombra: "oklch(0.6 0.03 78)",
  arcilla: "oklch(0.59 0.025 70)",
  rocaMadre: "oklch(0.44 0.012 100)",
  rocaMadreClara: "oklch(0.5 0.012 100)",
  hierba: "oklch(0.56 0.08 140)",
  sueloVegetal: "oklch(0.45 0.05 110)",
  colinaLejana: "oklch(0.83 0.025 160)",
  colinaMedia: "oklch(0.72 0.045 148)",
  pradera: "oklch(0.5 0.09 135)",
};

/** Todo lo que un fotograma necesita saber del corte. */
interface Escena {
  w: number;
  h: number;
  t: number;
  tOla: number;
  dt: number;
  nivelMarMedio: number;
  nivelMar: number;
  fondoMarY: number;
  yHorizonte: number;
  esEmbalse: boolean;
  mareal: boolean;
  escalaOla: number;
  pxPorMReal: number;
  mPorPx: number;
  amplitudPx: number;
  campo: CampoOleaje2D;
  paso: number;
  n: number;
  supY: Float64Array;
  terY: Float64Array;
  borde: number;
  /** Hasta dónde se dibuja la lámina: en el dique, el paramento de mar. */
  bordeLamina: number;
  superficieY: (px: number) => number;
  terrenoY: (px: number) => number;
  xOrilla: number;
  xDispositivo: number;
  /** Escena de costa: playa con resaca y costa lejana. */
  conPlaya: boolean;
}

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
  /** Reloj de la animación en segundos: sólo avanza mientras corre. */
  private reloj = 0;
  private marcaPrevia: number | null = null;
  sinSerieMsg = "";
  private medidas: [number, number] = [0, 0];
  private dpr = 0;
  private ultimoT = 0;
  /** Estado integrado con dt: mover un mando no hace saltar giros ni flujo. */
  private anguloRotor = 0;
  private avanceFlujo = 0;
  private anguloWells = 0;
  /** Operación del dique: nivel del embalse (m sobre el medio), si está
   *  turbinando, apertura de compuertas y velocidad del rodete. */
  private embalseM = 0;
  private generando = false;
  private apertura = 0;
  private omegaBulbo = 0;
  /** Cabeceo del flotador, amortiguado. */
  private cabeceo = 0;
  private observador: ResizeObserver | null = null;
  /** Tramo estacionario de la serie que se repite en bucle. */
  private tramo: { ini: number; fin: number } | null = null;
  /** Desfase del reloj de la ola respecto al de la serie: los alinea. */
  private desfaseOla = 0;
  private campo: CampoOleaje2D | null = null;
  private claveCampo = "";
  private supBuf = new Float64Array(0);
  private terBuf = new Float64Array(0);
  private relPrevio = 0;
  private fuenteSans = "";
  private fuenteMono = "";

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
    this.Hm0 = Number.isFinite(payload.Hm0) ? Math.max(0, payload.Hm0) : this.Hm0;
    this.Te = Number.isFinite(payload.Te) && payload.Te > 0 ? payload.Te : this.Te;
    this.Bpto = payload.Bpto;
    this.k = Number.isFinite(payload.k) ? payload.k : 0;
    this.lambda = this.k > 0 ? (2 * Math.PI) / this.k : 0;
    this.dispositivo = payload.dispositivo || "absorbedor_puntual";
    this.profundidad =
      payload.profundidad_m && payload.profundidad_m > 0 ? payload.profundidad_m : PROFUNDIDAD_M;
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
    if (payload.velocidadCorriente !== undefined && Number.isFinite(payload.velocidadCorriente))
      this.velocidadCorriente = Math.max(0, payload.velocidadCorriente);
    if (payload.rangoMarea !== undefined && Number.isFinite(payload.rangoMarea))
      this.rangoMarea = Math.max(0, payload.rangoMarea);
    if (payload.cantidadUnidades !== undefined) this.cantidadUnidades = payload.cantidadUnidades;

    if (!payload.series || !payload.series.t_s || !payload.series.z_m) {
      this.series = null;
      this.tramo = null;
      this.desfaseOla = 0;
      this.sinSerieMsg = `sin serie de posición — dispositivo ${this.dispositivo}`;
      return;
    }
    const hasT = Array.isArray(payload.series.t_s) && payload.series.t_s.length > 0;
    const hasZ = Array.isArray(payload.series.z_m) && payload.series.z_m.length > 0;
    if (!hasT || !hasZ) {
      this.series = null;
      this.tramo = null;
      this.desfaseOla = 0;
      this.sinSerieMsg = `sin serie de posición — dispositivo ${this.dispositivo}`;
      return;
    }
    this.series = { t_s: [...payload.series.t_s], z_m: [...payload.series.z_m] };
    this.tramo = tramoEstacionario(this.series.t_s, this.series.z_m);
    // La ola en el eje del dispositivo es cos(ω·t_serie). Con el bucle sobre
    // un número entero de ciclos, basta adelantar el reloj de la ola lo que
    // vale el inicio del tramo.
    this.desfaseOla = this.tramo ? this.tramo.ini : this.series.t_s[0];
    this.sinSerieMsg = "";
  }

  // Muestrea serie ya calculada — no recalcula física por fotograma, solo interpola.
  private muestrearSerie(t: number): number | null {
    if (!this.series) return null;
    const { t_s, z_m } = this.series;
    const n = Math.min(t_s.length, z_m.length);
    if (n === 0) return null;
    const ini = this.tramo ? this.tramo.ini : t_s[0];
    const fin = this.tramo ? this.tramo.fin : t_s[n - 1];
    const tDur = fin - ini;
    if (!(tDur > 0)) return z_m[0];
    const tLoop = ini + (((t % tDur) + tDur) % tDur);
    let lo = 0,
      hi = n - 1;
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
    const z = z0 + ((z1 - z0) * (tLoop - t0)) / (t1 - t0);
    return Number.isFinite(z) ? z : null;
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

  /** Fuentes del sistema de diseño. Se leen una vez: getComputedStyle por
   *  cada rótulo y fotograma fuerza recálculos de estilo innecesarios. */
  private fuente(tipo: "sans" | "mono"): string {
    if (!this.fuenteSans) {
      const leer = (nombre: string, fallback: string) => {
        try {
          const v = getComputedStyle(document.documentElement).getPropertyValue(nombre).trim();
          return v || fallback;
        } catch {
          return fallback;
        }
      };
      this.fuenteSans = leer("--font-sans", "system-ui, sans-serif");
      this.fuenteMono = leer("--font-mono", "ui-monospace, monospace");
    }
    return tipo === "sans" ? this.fuenteSans : this.fuenteMono;
  }

  /** Tren principal del contrato en el eje del dispositivo (x = 0 allí). Es
   *  el movimiento que seguiría un flotador libre si no hubiera serie. */
  private eta(xM: number, t: number, omega: number, k: number): number {
    return (this.Hm0 / 2) * Math.cos(k * xM - omega * t);
  }

  /** Ruido determinista 0..1 por índice: nubes y partículas sin Math.random,
   *  así dos fotogramas del mismo instante son idénticos. */
  private azar(i: number, canal = 0): number {
    const s = Math.sin(i * 12.9898 + canal * 78.233) * 43758.5453;
    return s - Math.floor(s);
  }

  /** Campo de oleaje cacheado: sólo se rehace si cambia el corte o un mando. */
  private obtenerCampo(clave: string, crear: () => CampoOleaje2D): CampoOleaje2D {
    if (!this.campo || this.claveCampo !== clave) {
      this.campo = crear();
      this.claveCampo = clave;
    }
    return this.campo;
  }

  /** Muestras de superficie y terreno por columna, y la orilla del agua. */
  private muestrear(
    w: number,
    superficieY: (px: number) => number,
    terrenoY: (px: number) => number,
    limite: number | null
  ): { n: number; supY: Float64Array; terY: Float64Array; borde: number } {
    const n = Math.ceil(w / PASO_COLUMNA) + 2;
    if (this.supBuf.length !== n) {
      this.supBuf = new Float64Array(n);
      this.terBuf = new Float64Array(n);
    }
    const supY = this.supBuf;
    const terY = this.terBuf;
    for (let i = 0; i < n; i++) {
      const x = i * PASO_COLUMNA;
      supY[i] = superficieY(x);
      terY[i] = terrenoY(x);
    }
    let borde = limite ?? (n - 1) * PASO_COLUMNA;
    if (limite === null) {
      for (let i = 1; i < n; i++) {
        if (terY[i] <= supY[i]) {
          // Corte exacto entre las dos columnas.
          const a = supY[i - 1] - terY[i - 1];
          const b = supY[i] - terY[i];
          const f = a !== b ? a / (a - b) : 0;
          borde = (i - 1 + Math.max(0, Math.min(1, f))) * PASO_COLUMNA;
          break;
        }
      }
    }
    return { n, supY, terY, borde };
  }

  dibujar(t: number) {
    const dt = Math.max(0, Math.min(0.1, t - this.ultimoT));
    this.ultimoT = t;
    const [w, h] = this.ajustarDPR();
    if (w < 2 || h < 2) return;
    const ctx = this.ctx;
    ctx.clearRect(0, 0, w, h);

    if (this.modoPrevia) {
      this.dibujarPrevia(t, dt, w, h);
      return;
    }

    // La tira de lectura de la carcasa se superpone al pie del lienzo: nada
    // que haya que leer se dibuja dentro de esa banda.
    const pie = this.pie;
    const horizonteY = h * 0.2;
    // El mar baja un poco respecto al centro del cuadro: la franja de tierra de
    // la derecha necesita aire sobre la lámina para que se lea como costa y no
    // como un bloque tapado por el minimapa.
    const nivelMarMedio = h * 0.455;
    // Horizonte visible: la cámara está baja, a pocos metros sobre el mar.
    const yHorizonte = nivelMarMedio - Math.max(16, h * 0.055);
    const fondoMarY = h - pie - 26;
    const xCosta = w * 0.7;
    const xPieTalud = w * 0.38;
    const xOrillaRef = w * 0.6;
    const xMeseta = w * 0.66;
    // Llanura baja: queda por debajo del minimapa (que ocupa la esquina
    // superior derecha) y por encima de la lámina, con sitio para la
    // subestación y la torre sin que el panel las tape.
    const yMeseta = nivelMarMedio - h * 0.025;
    const esEmbalse = this.modoEnergia === "mareomotriz" && this.dispositivo === "embalse";
    const mareal = this.modoEnergia === "mareomotriz";

    // Dique: la obra cierra el corte por el centro y detrás queda el vaso, un
    // estuario contenido por el terreno de la otra orilla.
    const xDam = w * 0.56;
    const yFondoDam = nivelMarMedio + h * 0.25;
    const xFinVaso = w * 0.9;
    const yFondoVaso = yFondoDam + 10;
    const yMesetaEmb = nivelMarMedio - h * 0.085;

    const omega = (2 * Math.PI) / this.Te;
    const k = this.k > 0 ? this.k : 0.08;
    const dominioM = this.lambda > 0 ? 2.2 * this.lambda : 120;
    const mPorPx = dominioM / w;
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
    // Operación de doble efecto: con salto pequeño las compuertas están
    // cerradas y el embalse no se mueve (espera); al alcanzar el salto de
    // arranque se abren y se turbina hasta que el salto cae al de parada. El
    // embalse se llena o se vacía con el caudal, que va con √h.
    const caudal = esEmbalse ? this.operarDique(t, dt) : 0;
    const yEmbalseMarea = nivelMarMedio - this.embalseM * escalaMarea;
    const saltoM = esEmbalse ? (yEmbalseMarea - nivelMar) / escalaMarea : 0;
    // En el estuario del dique el oleaje llega atenuado.
    const factorOla = esEmbalse ? 0.3 : 1;

    // Giro y arrastre integrados: turbina de corriente ω = TSR·U/R (R = 10 m,
    // TSR = 4,5); grupo bulbo, proporcional al caudal. El agua avanza a escala
    // real en horizontal: U m/s son U/mPorPx px/s.
    const U = Math.max(0, this.velocidadCorriente);
    // El rodete del bulbo tiene inercia: arranca y se para en un par de segundos.
    if (esEmbalse) this.omegaBulbo += (caudal * 2.4 - this.omegaBulbo) * Math.min(1, dt * 1.6);
    const omegaRotor = esEmbalse ? this.omegaBulbo : (TSR * U) / RADIO_ROTOR_M;
    this.anguloRotor = (this.anguloRotor + omegaRotor * dt) % (Math.PI * 2);
    const velFlujoPx = esEmbalse ? caudal * 30 : U / mPorPx;
    this.avanceFlujo += velFlujoPx * dt;

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

    // Orilla en reposo: donde el perfil corta el nivel medio. En el dique no
    // hay playa: el agua llega hasta la obra.
    let xOrilla = xCosta;
    if (!esEmbalse) {
      for (let px = xPieTalud; px <= w; px += 2) {
        if (terrenoY(px) <= nivelMarMedio) {
          xOrilla = px;
          break;
        }
      }
    }

    // Campo de oleaje con la batimetría del corte. La fase cero va en el eje
    // del dispositivo, alineada con su serie.
    const clave = [w, h, this.Hm0, this.Te, this.profundidad, this.dispositivo, this.modoEnergia].join("|");
    const campo = this.obtenerCampo(
      clave,
      () =>
        new CampoOleaje2D({
          ancho: w,
          paso: PASO_COLUMNA,
          mPorPx,
          profundidadEn: (px) => Math.max(0, (terrenoY(px) - nivelMarMedio) / pxPorMReal),
          profundidadRef: this.profundidad,
          Hm0: this.Hm0,
          Te: this.Te,
          escalaPx: escalaOla,
          pxPorMReal,
          xRef: xDispositivo,
          atenuacion: factorOla,
        })
    );
    const tOla = t + this.desfaseOla;

    // Frente al paramento del dique la ola se refleja: incidente más reflejada
    // forman un clapoteo con vientre en la pared.
    const yApoyoDam = terrenoY(xDam);
    const xPared = esEmbalse ? geometriaDique(xDam, nivelMarMedio, yApoyoDam).caraMar(nivelMarMedio) : 0;
    // Rizado capilar del viento: ondas de centímetros que el ojo ve como
    // textura de la lámina. Se apaga en la orilla, donde no hay calado.
    const rizoBase = Math.min(1, 0.35 + this.Hm0 / 2.5);
    const rizo = (px: number) => {
      const s = rizoBase * Math.min(1, campo.calado(px) / 2);
      return (
        s *
        (0.5 * Math.sin(px * 0.31 - t * 2.7) +
          0.35 * Math.sin(px * 0.53 + t * 1.9 + 1.3) +
          0.22 * Math.sin(px * 0.97 - t * 3.6 + 0.4))
      );
    };
    // Un cuerpo que oscila en la lámina radia ondas: el absorbedor deja anillos
    // que se alejan a ambos lados, con el número de onda local, y se apagan.
    const radia = !mareal && this.dispositivo !== "owc";
    const kRad = campo.numeroOnda(xDispositivo) * mPorPx; // rad/px
    const ampRad = Math.min(3.2, 0.07 * this.Hm0 * escalaOla);
    const semiFlot = geometriaAbsorbedor(0, 0, 100).semiFlotador;
    const radiada = (px: number) => {
      const d = Math.abs(px - xDispositivo);
      if (d < semiFlot * 0.6 || d > 420) return 0;
      const entra = Math.min(1, (d - semiFlot * 0.6) / (semiFlot * 0.8));
      return ampRad * entra * Math.exp(-d / 170) * Math.cos(kRad * 1.6 * d - omega * tOla * 1.0 + 0.6);
    };
    const superficieY = esEmbalse
      ? (px: number) =>
          nivelMar - (campo.elevacionPx(px, tOla) + 0.85 * campo.elevacionPx(2 * xPared - px, tOla)) - rizo(px) * 0.6
      : radia
        ? (px: number) => nivelMar - campo.elevacionPx(px, tOla) - rizo(px) - radiada(px)
        : (px: number) => nivelMar - campo.elevacionPx(px, tOla) - rizo(px);

    const m = this.muestrear(w, superficieY, terrenoY, esEmbalse ? xDam : null);
    const E: Escena = {
      w,
      h,
      t,
      tOla,
      dt,
      nivelMarMedio,
      nivelMar,
      fondoMarY,
      yHorizonte,
      esEmbalse,
      mareal,
      escalaOla,
      pxPorMReal,
      mPorPx,
      amplitudPx: (this.Hm0 / 2) * escalaOla * factorOla,
      campo,
      paso: PASO_COLUMNA,
      n: m.n,
      supY: m.supY,
      terY: m.terY,
      borde: m.borde,
      bordeLamina: esEmbalse ? geometriaDique(xDam, nivelMarMedio, yApoyoDam).caraMar(nivelMar) : m.borde,
      superficieY,
      terrenoY,
      xOrilla,
      xDispositivo,
      conPlaya: !esEmbalse,
    };

    this.dibujarCielo(ctx, w, yHorizonte, t);
    this.dibujarFondoLejano(ctx, E, esEmbalse ? { xDam, xBanco: xFinVaso - w * 0.04 } : null);
    this.dibujarAgua(ctx, E);
    this.dibujarTerreno(
      ctx,
      w,
      h,
      nivelMarMedio,
      xOrilla,
      terrenoY,
      esEmbalse ? w + 10 : xMeseta + 6,
      !esEmbalse && !mareal
    );
    if (!esEmbalse) {
      this.dibujarPlaya(ctx, E);
      // Arena con praderas donde manda la ola; grava con algas tumbadas donde
      // manda la corriente, que se lleva la arena.
      this.dibujarPraderas(ctx, E);
    }

    const yApoyo = terrenoY(xDispositivo);
    const xSub = w * 0.64;
    const xTorre = w * 0.69;
    let flotador: { x: number; semi: number; yFlot: number } | null = null;

    if (esEmbalse) {
      // Escollera de cimentación: el fondo dragado bajo el dique.
      ctx.beginPath();
      ctx.moveTo(xDam - 124, terrenoY(xDam - 124));
      for (let px = xDam - 124; px <= xDam + 84; px += 4) ctx.lineTo(px, terrenoY(px));
      for (let px = xDam + 84; px >= xDam - 124; px -= 4) ctx.lineTo(px, terrenoY(px) + 7);
      ctx.closePath();
      ctx.fillStyle = "oklch(0.55 0.012 92)";
      ctx.fill();

      // El velo del mar va antes que la obra: el dique lo corta, no al revés.
      this.dibujarVeloAgua(ctx, E);
      dibujarDique2D(ctx, {
        cx: xDam,
        yMedio: nivelMarMedio,
        yFondo: yApoyo,
        t,
        rangoMarea: this.rangoMarea,
        escalaV: escalaMarea,
        yEmbalse: yEmbalseMarea,
        yMar: nivelMar,
        saltoM,
        giro: this.anguloRotor,
        avance: this.avanceFlujo,
        terrenoY,
        xFinVaso,
        caudal,
        apertura: this.apertura,
        modo: !this.generando ? "espera" : caudal > 0 ? "llenado" : "vaciado",
        sinRotulo: this.modoPrevia,
      });
      this.dibujarSuperficie(ctx, E);
    } else {
      if (mareal) {
        // El cable va por el lecho y entra enterrado en la playa.
        this.dibujarCableSubmarino(ctx, E, xDispositivo + 28, xSub + 16);
        const optsGranja = {
          x: xDispositivo,
          ySuperficie: nivelMarMedio,
          yFondo: yApoyo,
          t,
          velocidadCorriente: U,
          giro: this.anguloRotor,
          cantidadUnidades: this.cantidadUnidades,
          cimentacion: this.cimentacion,
          sinRotulo: this.modoPrevia,
          anchoDisponible: Math.max(120, xOrilla - 120),
          superficieY,
        };
        for (const u of disposicionGranja(optsGranja)) {
          this.dibujarSombraLecho(ctx, E, u.xBuje, u.radio * 0.45, u.yRotor, u.lejania ? 0.5 : 0.9);
        }
        this.dibujarEstelaRotor(ctx, E, optsGranja, omegaRotor);
        dibujarGranja2D(ctx, optsGranja);
        this.dibujarVeloAgua(ctx, E);
        this.dibujarSuperficie(ctx, E);
        dibujarEstelaSuperficie(ctx, optsGranja, superficieY, t);
        if (!this.modoPrevia) {
          const u0 = disposicionGranja(optsGranja)[0];
          this.chip(
            ctx,
            `Corriente ${U.toFixed(1).replace(".", ",")} m/s · rotor ${Math.round((omegaRotor * 60) / (2 * Math.PI))} rpm`,
            xDispositivo + u0.radio + 96,
            u0.yRotor - u0.radio - 6
          );
        }
      } else if (this.dispositivo === "owc") {
        this.dibujarCableSubmarino(ctx, E, xDispositivo + 40, xSub + 16);
        this.dibujarOWC(ctx, E, xDispositivo, yApoyo, omega);
        this.dibujarVeloAgua(ctx, E);
        this.dibujarSuperficie(ctx, E);
      } else {
        const g = geometriaAbsorbedor(xDispositivo, nivelMarMedio, yApoyo);
        this.dibujarCableSubmarino(ctx, E, g.salidaCable.x, xSub + 16, g.salidaCable.y);
        // Flotador: serie del núcleo para el tren principal; las componentes
        // menores del mar las sigue como un cuerpo libre (RAO ≈ 1 en ola larga).
        const etaTotal = campo.elevacionPx(xDispositivo, tOla);
        const etaPrincipal = campo.elevacionPx(xDispositivo, tOla, true);
        const zSerie = this.muestrearSerie(t);
        const zPrincipal = zSerie ?? this.eta(0, tOla, omega, k);
        const zPx = zPrincipal * escalaOla + (etaTotal - etaPrincipal);
        // Cabeceo: el flotador sigue la pendiente de la lámina tal como se
        // dibuja, atenuada porque desliza guiado por el mástil, y con la
        // inercia de su masa.
        const objetivo = Math.max(-0.12, Math.min(0.12, -Math.atan(campo.pendiente(xDispositivo, tOla)) * 0.6));
        this.cabeceo += (objetivo - this.cabeceo) * Math.min(1, dt * 2.2);
        this.dibujarSombraLecho(ctx, E, xDispositivo, g.semiFlotador, nivelMarMedio - zPx);
        this.dibujarSombraLecho(ctx, E, xDispositivo, 36, g.yPlaca, 0.6);
        dibujarAbsorbedor2D(ctx, {
          x: xDispositivo,
          ySuperficie: nivelMarMedio,
          yFondo: yApoyo,
          t,
          zRelativo: zPx,
          inclinacion: this.cabeceo,
          Hm0: this.Hm0,
          alcancePx: Math.max(18, (HM0_TOPE_M / 2) * escalaOla * 0.75, this.Hm0 * escalaOla * 0.62),
          sinRotulo: this.modoPrevia,
          // La escena dibuja el cable completo hasta la subestación.
          sinCable: true,
        });
        flotador = { x: xDispositivo, semi: g.semiFlotador, yFlot: nivelMarMedio - zPx };
        this.dibujarVeloAgua(ctx, E);
        this.dibujarSuperficie(ctx, E);
        this.dibujarEspumaFlotador(ctx, E, flotador);
      }
      this.dibujarRedElectrica(ctx, w, terrenoY, xSub, xTorre);
    }

    // En miniatura las anotaciones se pisan unas a otras y no se leen: a ese
    // tamaño el lienzo enseña la escena y nada más.
    if (w >= 460) {
      this.dibujarHUD(ctx, w, h, nivelMarMedio, fondoMarY, dominioM, escalaOla, pie, mareal && !esEmbalse ? E : null);
    }
  }

  /** Sombra difusa de un objeto sumergido sobre el lecho: desplazada según
   *  la luz (el sol entra por la izquierda), más ancha y tenue cuanto más
   *  alto está el objeto sobre el fondo, porque la luz bajo el agua es
   *  difusa. */
  private dibujarSombraLecho(
    ctx: CanvasRenderingContext2D,
    E: Escena,
    x: number,
    semi: number,
    yObjeto: number,
    fuerza = 1
  ) {
    const xs = x + (E.terrenoY(x) - yObjeto) * 0.18;
    const ys = E.terrenoY(xs);
    const altura = Math.max(0, ys - yObjeto);
    const rx = semi * (1 + altura / 260);
    const ry = 2.5 + altura / 90;
    const a = 0.24 * fuerza * Math.exp(-altura / 360);
    if (a < 0.01 || !(rx > 0)) return;
    ctx.save();
    ctx.translate(xs, ys);
    ctx.scale(1, ry / rx);
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, rx);
    g.addColorStop(0, `rgba(12,30,30,${a.toFixed(3)})`);
    g.addColorStop(1, "rgba(12,30,30,0)");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(0, 0, rx, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  /** Integra la operación del dique un paso dt y devuelve el caudal relativo
   *  (+ hacia el embalse). Escala con el rango: el embalse recorre ~⅔ del
   *  rango del mar y se turbina ~¾ del ciclo, como en una central real. */
  private operarDique(t: number, dt: number): number {
    const R = Math.max(0, this.rangoMarea);
    const A = R / 2;
    if (R < 0.05) {
      this.embalseM = 0;
      this.generando = false;
      this.apertura += (0 - this.apertura) * Math.min(1, dt * 2);
      return 0;
    }
    // Si el rango baja, el embalse no puede quedar fuera de la carrera.
    this.embalseM = Math.max(-A, Math.min(A, this.embalseM));
    const hArranque = 0.3 * R;
    const hParada = 0.08 * R;
    const K = 0.5 * OMEGA_MAREA * Math.sqrt(R);
    const pasos = Math.max(1, Math.ceil(dt / 0.02));
    const h = dt / pasos;
    let q = 0;
    for (let i = 0; i < pasos; i++) {
      const tt = t - dt + (i + 1) * h;
      const eta = A * Math.sin(tt * OMEGA_MAREA);
      const salto = eta - this.embalseM;
      if (!this.generando && Math.abs(salto) >= hArranque) this.generando = true;
      if (this.generando && Math.abs(salto) < hParada) this.generando = false;
      // Las compuertas tardan en abrir y cerrar; el caudal las sigue.
      const objetivo = this.generando ? 1 : 0;
      this.apertura += (objetivo - this.apertura) * Math.min(1, h * 2.5);
      q = this.apertura * Math.sign(salto) * Math.sqrt(Math.abs(salto) / Math.max(1e-6, A));
      this.embalseM += K * this.apertura * Math.sign(salto) * Math.sqrt(Math.abs(salto)) * h;
    }
    // Caudal normalizado (≈1,2 con el salto máximo) para el giro y los filetes.
    return q * 1.2;
  }

  /** Miniatura de la pantalla de tecnología: corte centrado en el dispositivo,
   *  sin costa, cable ni red. El dique y las turbinas necesitan calado real;
   *  en la tarjeta pequeña el diorama completo se sale del encuadre. */
  private dibujarPrevia(t: number, dt: number, w: number, h: number) {
    const ctx = this.ctx;
    const esDique = this.modoEnergia === "mareomotriz" && this.dispositivo === "embalse";
    const esGranja = this.modoEnergia === "mareomotriz" && !esDique;
    // El absorbedor necesita cielo para el mástil y su baliza.
    const nivelMarMedio = esDique ? h * 0.5 : esGranja ? h * 0.44 : Math.min(h * 0.6, Math.max(h * 0.4, 88));
    const yHorizonte = nivelMarMedio - Math.max(8, h * 0.05);
    const fondoMarY = h * 0.9;
    const dominioM = this.lambda > 0 ? 2.2 * this.lambda : 120;
    const mPorPx = dominioM / w;
    const pxPorMReal = (fondoMarY - nivelMarMedio) / this.profundidad;
    const pxPorM = pxPorMReal * EXAGERACION_VERTICAL;
    // En la tarjeta la ola no puede comerse el cielo.
    const escalaOla = Math.min(pxPorM, (nivelMarMedio - h * 0.12) / HM0_TOPE_M);
    const xCentro = w * 0.48;
    const factorOla = esDique ? 0.3 : 1;
    const yFondo = fondoMarY + 2;
    const terrenoY = (px: number) => fondoMarY + Math.sin(px * 0.04) * 2.2;
    const resguardoPrevia = Math.max(16, Math.min(40, (yFondo - nivelMarMedio) * 0.4));

    const clave = ["previa", w, h, this.Hm0, this.Te, this.profundidad, this.dispositivo].join("|");
    const campo = this.obtenerCampo(
      clave,
      () =>
        new CampoOleaje2D({
          ancho: w,
          paso: PASO_COLUMNA,
          mPorPx,
          profundidadEn: () => this.profundidad,
          profundidadRef: this.profundidad,
          Hm0: this.Hm0,
          Te: this.Te,
          escalaPx: escalaOla,
          pxPorMReal,
          xRef: xCentro,
          atenuacion: factorOla,
        })
    );
    const tOla = t + this.desfaseOla;
    const superficieY = (px: number) => nivelMarMedio - campo.elevacionPx(px, tOla);
    const m = this.muestrear(w, superficieY, terrenoY, esDique ? xCentro : (Math.ceil(w / PASO_COLUMNA) + 1) * PASO_COLUMNA);
    const E: Escena = {
      w,
      h,
      t,
      tOla,
      dt,
      nivelMarMedio,
      nivelMar: nivelMarMedio,
      fondoMarY,
      yHorizonte,
      esEmbalse: esDique,
      mareal: esDique || esGranja,
      escalaOla,
      pxPorMReal,
      mPorPx,
      amplitudPx: (this.Hm0 / 2) * escalaOla * factorOla,
      campo,
      paso: PASO_COLUMNA,
      n: m.n,
      supY: m.supY,
      terY: m.terY,
      borde: m.borde,
      bordeLamina: esDique
        ? geometriaDique(xCentro, nivelMarMedio, yFondo, resguardoPrevia).caraMar(nivelMarMedio)
        : m.borde,
      superficieY,
      terrenoY,
      xOrilla: w,
      xDispositivo: xCentro,
      conPlaya: false,
    };

    this.dibujarCielo(ctx, w, yHorizonte, t);
    this.dibujarFondoLejano(ctx, E, null);
    this.dibujarAgua(ctx, E);

    // Lecho plano arenoso.
    const lecho = ctx.createLinearGradient(0, fondoMarY - 8, 0, h);
    lecho.addColorStop(0, C.arenaAlta);
    lecho.addColorStop(1, C.arenaBaja);
    ctx.fillStyle = lecho;
    ctx.beginPath();
    ctx.moveTo(0, terrenoY(0));
    for (let px = 0; px <= w + 8; px += 8) ctx.lineTo(px, terrenoY(px));
    ctx.lineTo(w, h);
    ctx.lineTo(0, h);
    ctx.closePath();
    ctx.fill();

    if (esDique) {
      // En la miniatura el vaso sigue el lecho plano y se sale del encuadre por
      // la derecha: se lee como estuario, no como una caja de agua.
      const yEmbalsePrev = nivelMarMedio + 3 + Math.min(14, h * 0.03) * Math.sin(t * 0.4);
      const escalaV = pxPorMReal;
      const salto = (yEmbalsePrev - nivelMarMedio) / escalaV;
      const caudal = Math.sign(salto) * Math.sqrt(Math.abs(salto));
      this.anguloRotor = (this.anguloRotor + caudal * 2.4 * dt) % (Math.PI * 2);
      this.avanceFlujo += caudal * 30 * dt;
      this.dibujarVeloAgua(ctx, E);
      dibujarDique2D(ctx, {
        cx: xCentro,
        yMedio: nivelMarMedio,
        yFondo,
        t,
        rangoMarea: this.rangoMarea,
        escalaV,
        yEmbalse: yEmbalsePrev,
        giro: this.anguloRotor,
        avance: this.avanceFlujo,
        terrenoY: () => yFondo,
        xFinVaso: w,
        resguardoPx: resguardoPrevia,
        modo: yEmbalsePrev > nivelMarMedio ? "llenado" : "vaciado",
        sinRotulo: true,
      });
      this.dibujarSuperficie(ctx, E);
      return;
    }

    if (esGranja) {
      const U = Math.max(0, this.velocidadCorriente);
      const omegaRotor = (TSR * U) / RADIO_ROTOR_M;
      this.anguloRotor = (this.anguloRotor + omegaRotor * dt) % (Math.PI * 2);
      this.avanceFlujo += (U / mPorPx) * dt;
      const optsGranja = {
        x: xCentro,
        ySuperficie: nivelMarMedio,
        yFondo,
        t,
        velocidadCorriente: U,
        giro: this.anguloRotor,
        cantidadUnidades: this.cantidadUnidades,
        cimentacion: this.cimentacion,
        anchoDisponible: w * 0.62,
        superficieY,
        sinRotulo: true,
      };
      dibujarGranja2D(ctx, optsGranja);
      this.dibujarVeloAgua(ctx, E);
      this.dibujarSuperficie(ctx, E);
      dibujarEstelaSuperficie(ctx, optsGranja, superficieY, t);
      return;
    }

    const etaTotal = campo.elevacionPx(xCentro, tOla);
    const etaPrincipal = campo.elevacionPx(xCentro, tOla, true);
    const omega = (2 * Math.PI) / this.Te;
    const k = this.k > 0 ? this.k : 0.08;
    const zPrincipal = this.muestrearSerie(t) ?? this.eta(0, tOla, omega, k);
    const zPx = zPrincipal * escalaOla + (etaTotal - etaPrincipal);
    dibujarAbsorbedor2D(ctx, {
      x: xCentro,
      ySuperficie: nivelMarMedio,
      yFondo,
      t,
      zRelativo: zPx,
      Hm0: this.Hm0,
      alcancePx: Math.max(12, this.Hm0 * escalaOla * 0.62),
      sinRotulo: true,
      sinCable: true,
    });
    this.dibujarVeloAgua(ctx, E);
    this.dibujarSuperficie(ctx, E);
    this.dibujarEspumaFlotador(ctx, E, {
      x: xCentro,
      semi: geometriaAbsorbedor(xCentro, nivelMarMedio, yFondo).semiFlotador,
      yFlot: nivelMarMedio - zPx,
    });
  }

  // ---- Escenario -----------------------------------------------------------

  private dibujarCielo(ctx: CanvasRenderingContext2D, w: number, yHorizonte: number, t = 0) {
    const cielo = ctx.createLinearGradient(0, 0, 0, yHorizonte);
    cielo.addColorStop(0, C.cieloAlto);
    cielo.addColorStop(0.55, C.cieloMedio);
    cielo.addColorStop(1, C.cieloBajo);
    ctx.fillStyle = cielo;
    ctx.fillRect(0, 0, w, yHorizonte + 2);

    // Sol velado: un resplandor cálido, no un disco. Da dirección a la luz
    // de los haces que bajan por el agua.
    const sx = w * 0.22;
    const sy = Math.max(22, yHorizonte * 0.32);
    const halo = ctx.createRadialGradient(sx, sy, 0, sx, sy, Math.max(140, w * 0.26));
    halo.addColorStop(0, "rgba(255,249,226,0.95)");
    halo.addColorStop(0.06, "rgba(255,245,212,0.62)");
    halo.addColorStop(0.32, "rgba(255,240,205,0.2)");
    halo.addColorStop(1, "rgba(255,240,205,0)");
    ctx.fillStyle = halo;
    ctx.fillRect(0, 0, w, yHorizonte + 2);

    // Bancos de nubes: lóbulos blandos a la deriva. Entran y salen del cuadro
    // por completo: el salto de un lado al otro ocurre fuera de la vista.
    const esc = Math.max(0.45, Math.min(1.15, yHorizonte / 260));
    for (let i = 0; i < 6; i++) {
      const e = esc * (0.6 + this.azar(i, 3) * 0.9);
      const semiancho = (68 + 50) * e * 1.5;
      const recorrido = w + semiancho * 2;
      const velocidad = 1.6 * (0.5 + this.azar(i, 1)); // px/s
      const cx = ((((this.azar(i) * recorrido + t * velocidad) % recorrido) + recorrido) % recorrido) - semiancho;
      const cy = yHorizonte * (0.12 + 0.62 * this.azar(i, 2));
      for (let j = 0; j < 5; j++) {
        const lx = cx + (j - 2) * 34 * e;
        const ly = cy - Math.sin(j * 1.3 + i) * 7 * e;
        const r = (24 + this.azar(i * 7 + j, 4) * 22) * e;
        // Volumen: cima iluminada por el sol (arriba a la izquierda) y un
        // borde algo gris donde el lóbulo se curva y queda en sombra.
        const nube = ctx.createRadialGradient(lx - r * 0.35, ly - r * 0.4, 0, lx, ly, r * 1.35);
        nube.addColorStop(0, "rgba(255,255,255,0.82)");
        nube.addColorStop(0.35, "rgba(252,252,250,0.5)");
        nube.addColorStop(0.7, "rgba(214,220,228,0.2)");
        nube.addColorStop(1, "rgba(214,220,228,0)");
        ctx.fillStyle = nube;
        ctx.beginPath();
        ctx.ellipse(lx, ly, r * 1.5, r * 0.62, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      // Base de la nube algo más gris: la luz viene de arriba.
      ctx.fillStyle = "rgba(150,158,168,0.12)";
      ctx.beginPath();
      ctx.ellipse(cx, cy + 6 * e, 80 * e, 9 * e, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    // Aves planeando a lo lejos: un aleteo de vez en cuando.
    ctx.strokeStyle = "rgba(60,66,70,0.55)";
    ctx.lineWidth = 1.1;
    for (let i = 0; i < 3; i++) {
      const recorrido = w + 80;
      const x = ((((this.azar(i, 30) * recorrido + t * (7 + 4 * this.azar(i, 31))) % recorrido) + recorrido) % recorrido) - 40;
      const y = yHorizonte * (0.3 + 0.35 * this.azar(i, 32)) + Math.sin(t * 0.4 + i * 2) * 4;
      const ciclo = (t * 0.35 + this.azar(i, 33)) % 1;
      const aleteo = ciclo < 0.25 ? Math.sin(ciclo * 8 * Math.PI) * 2.2 : 0.6;
      const s = 3.2 + this.azar(i, 34) * 1.6;
      ctx.beginPath();
      ctx.moveTo(x - s, y - aleteo);
      ctx.quadraticCurveTo(x - s * 0.45, y - aleteo - 1.2, x, y);
      ctx.quadraticCurveTo(x + s * 0.45, y - aleteo - 1.2, x + s, y - aleteo);
      ctx.stroke();
    }

    // Bruma sobre el horizonte: la lejanía se lava hacia el blanco.
    const bruma = ctx.createLinearGradient(0, yHorizonte - 26, 0, yHorizonte + 1);
    bruma.addColorStop(0, "rgba(255,255,255,0)");
    bruma.addColorStop(1, "rgba(250,251,246,0.75)");
    ctx.fillStyle = bruma;
    ctx.fillRect(0, yHorizonte - 26, w, 27);
  }

  /** Lo que se ve detrás del plano de corte: el mar que se aleja hasta el
   *  horizonte, la costa que se pierde en la bruma y, en el dique, la obra
   *  que cruza el estuario. Asoma en el seno de cada ola. */
  private dibujarFondoLejano(
    ctx: CanvasRenderingContext2D,
    E: Escena,
    dique: { xDam: number; xBanco: number } | null
  ) {
    const { w, h, yHorizonte, nivelMarMedio, t } = E;
    const marLejano = ctx.createLinearGradient(0, yHorizonte, 0, nivelMarMedio + 40);
    marLejano.addColorStop(0, C.marLejano);
    marLejano.addColorStop(1, C.marLejanoCerca);
    ctx.fillStyle = marLejano;
    ctx.fillRect(0, yHorizonte, w, h - yHorizonte);

    // Crestas lejanas: más juntas y más cortas cuanto más lejos (perspectiva),
    // y se desplazan despacio hacia la costa.
    const filas = 9;
    for (let j = 0; j < filas; j++) {
      const u = (j + 1) / filas;
      const y = yHorizonte + (nivelMarMedio - yHorizonte) * Math.pow(u, 1.7);
      const largo = 6 + 26 * u;
      const separacion = 40 + 90 * u;
      const vel = 2 + 9 * u;
      ctx.strokeStyle = `rgba(250,252,250,${(0.1 + 0.18 * u).toFixed(3)})`;
      ctx.lineWidth = 0.6 + 0.8 * u;
      ctx.beginPath();
      const desfase = this.azar(j, 40) * separacion;
      for (let x = -separacion + ((desfase + t * vel) % separacion); x < w + largo; x += separacion) {
        const jit = (this.azar(Math.floor((x - t * vel) / separacion) + j * 31, 41) - 0.5) * separacion * 0.6;
        ctx.moveTo(x + jit, y);
        ctx.lineTo(x + jit + largo, y);
      }
      ctx.stroke();
    }

    // Camino de luz del sol sobre el mar lejano: destellos que parpadean.
    const sx = w * 0.22;
    for (let i = 0; i < 46; i++) {
      const u = this.azar(i, 42);
      const y = yHorizonte + 2 + (nivelMarMedio - yHorizonte) * u * u;
      const ancho = 10 + 50 * u;
      const x = sx + (this.azar(i, 43) - 0.5) * ancho * 2;
      const brillo = Math.pow(Math.max(0, Math.sin(t * (1.3 + this.azar(i, 44) * 2) + i * 1.7)), 6);
      if (brillo < 0.05) continue;
      ctx.fillStyle = `rgba(255,252,236,${(0.85 * brillo).toFixed(3)})`;
      ctx.fillRect(x, y, 2 + 6 * u, 1);
    }

    // Un velero lejano: da escala al horizonte. Navega despacio, cabecea con
    // el mar de fondo y entra y sale con fundido por los extremos de su tramo.
    if (w >= 460) {
      const xMax = dique ? dique.xDam - w * 0.1 : E.conPlaya ? E.xOrilla - w * 0.18 : w - 20;
      const tramo = Math.max(0, xMax - 30);
      if (tramo > 120) {
        const u = (((this.azar(5, 110) * tramo + t * 2.2) % tramo) + tramo) % tramo;
        const x = 30 + u;
        const fundido = Math.min(1, u / 60, (tramo - u) / 60);
        const y = yHorizonte + 3 + Math.sin(t * 0.8) * 0.5;
        const esc = Math.max(0.7, Math.min(1.2, w / 1100));
        ctx.save();
        ctx.globalAlpha = 0.75 * fundido;
        ctx.translate(x, y);
        ctx.rotate(Math.sin(t * 0.8 + 1) * 0.04);
        ctx.scale(esc, esc);
        ctx.fillStyle = "rgb(70 78 84)";
        ctx.beginPath();
        ctx.moveTo(-8, 0);
        ctx.lineTo(8, 0);
        ctx.lineTo(6, 2.2);
        ctx.lineTo(-6.5, 2.2);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = "rgb(250 250 246)";
        ctx.beginPath();
        ctx.moveTo(0.5, -1);
        ctx.lineTo(0.5, -15);
        ctx.lineTo(7, -1);
        ctx.closePath();
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(-0.5, -1);
        ctx.lineTo(-0.5, -12);
        ctx.lineTo(-5.5, -1);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      }
    }

    if (dique) {
      // La otra orilla del estuario: arranca detrás de la obra, en el
      // horizonte, y baja hasta la ladera que cierra el vaso.
      this.dibujarColinas(ctx, E, dique.xDam - w * 0.02, dique.xBanco);
      return;
    }
    if (E.conPlaya) {
      // La costa se aleja en diagonal desde la orilla del corte y sube en
      // colinas veladas por la distancia.
      this.dibujarColinas(ctx, E, E.xOrilla - w * 0.16, E.xOrilla);
    }
  }

  /** Costa lejana: dos planos de colinas, el de detrás más lavado. El borde
   *  izquierdo es la línea de costa, que baja en diagonal hasta la orilla. */
  private dibujarColinas(ctx: CanvasRenderingContext2D, E: Escena, xCostaLejana: number, xCostaCerca: number) {
    const { w, yHorizonte, nivelMarMedio } = E;
    const perfil = (x: number, alto: number, semilla: number) =>
      yHorizonte -
      alto *
        (0.45 +
          0.3 * Math.sin(x * 0.011 + semilla) +
          0.2 * Math.sin(x * 0.027 + semilla * 2.1) +
          0.08 * Math.sin(x * 0.061 + semilla * 3.3));
    for (const [alto, color, semilla, retranqueo] of [
      [46, C.colinaLejana, 1.3, 0.05],
      [28, C.colinaMedia, 4.1, 0],
    ] as const) {
      const x0 = xCostaLejana + retranqueo * w;
      ctx.beginPath();
      ctx.moveTo(xCostaCerca, nivelMarMedio + 2);
      ctx.lineTo(x0, yHorizonte + 1);
      for (let x = x0; x <= w + 6; x += 6) {
        // La colina nace en la costa: sube suave desde el nivel del mar.
        const subida = Math.min(1, (x - x0) / 60);
        ctx.lineTo(x, yHorizonte + 1 + (perfil(x, alto, semilla) - yHorizonte - 1) * subida);
      }
      ctx.lineTo(w + 6, nivelMarMedio + 2);
      ctx.closePath();
      const g = ctx.createLinearGradient(0, yHorizonte - alto, 0, nivelMarMedio);
      g.addColorStop(0, color);
      g.addColorStop(1, "oklch(0.76 0.035 125)");
      ctx.fillStyle = g;
      ctx.fill();
    }
    // Playa lejana: un hilo de arena a lo largo de la costa en perspectiva.
    ctx.strokeStyle = "oklch(0.86 0.045 88)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(xCostaCerca, nivelMarMedio + 1);
    ctx.lineTo(xCostaLejana, yHorizonte + 1);
    ctx.stroke();
  }

  /** Contorno de la masa de agua: de la superficie al terreno, hasta la orilla. */
  private trazarRegionAgua(ctx: CanvasRenderingContext2D, E: Escena) {
    const { paso, supY, terY, borde } = E;
    const iB = Math.min(E.n - 1, Math.floor(borde / paso));
    ctx.beginPath();
    ctx.moveTo(0, supY[0]);
    for (let i = 1; i <= iB; i++) ctx.lineTo(i * paso, supY[i]);
    ctx.lineTo(borde, E.superficieY(borde));
    ctx.lineTo(borde, E.terrenoY(borde) + 2);
    for (let i = iB; i >= 0; i--) ctx.lineTo(i * paso, terY[i] + 2);
    ctx.closePath();
  }

  private dibujarAgua(ctx: CanvasRenderingContext2D, E: Escena) {
    const { w, h, t, tOla, nivelMarMedio, fondoMarY, borde, campo, paso, supY } = E;
    ctx.save();
    this.trazarRegionAgua(ctx, E);
    ctx.clip();

    const agua = ctx.createLinearGradient(0, nivelMarMedio - 30, 0, fondoMarY + 20);
    agua.addColorStop(0, C.aguaSuperficie);
    agua.addColorStop(0.32, C.aguaMedia);
    agua.addColorStop(1, C.aguaFondo);
    ctx.fillStyle = agua;
    ctx.fillRect(0, nivelMarMedio - 120, w + 4, h + 120);

    // En el somero el fondo claro se transparenta: el agua vira a turquesa
    // cerca de la orilla.
    if (E.conPlaya) {
      const somero = ctx.createLinearGradient(E.xOrilla - E.w * 0.22, 0, E.xOrilla, 0);
      somero.addColorStop(0, "rgba(120,206,180,0)");
      somero.addColorStop(1, "rgba(150,214,186,0.42)");
      ctx.fillStyle = somero;
      ctx.fillRect(E.xOrilla - E.w * 0.22, nivelMarMedio - 120, E.w * 0.22 + 10, h);
    }

    // La cresta es agua delgada a contraluz: bajo ella el mar se aclara y se
    // vuelve más verde; en el seno, más oscuro. Una sola banda que sigue la
    // lámina con un degradado fijo en altura: la cresta, más arriba, recibe
    // la parte más luminosa sin rayados entre columnas.
    if (E.amplitudPx > 1.5) {
      const luzCresta = ctx.createLinearGradient(0, E.nivelMar - E.amplitudPx * 1.6, 0, E.nivelMar + E.amplitudPx + 26);
      luzCresta.addColorStop(0, "rgba(176,236,204,0.5)");
      luzCresta.addColorStop(0.45, "rgba(176,236,204,0.16)");
      luzCresta.addColorStop(1, "rgba(176,236,204,0)");
      ctx.fillStyle = luzCresta;
      const iB = Math.min(E.n - 1, Math.floor(borde / paso));
      ctx.beginPath();
      ctx.moveTo(0, supY[0]);
      for (let i = 1; i <= iB; i++) ctx.lineTo(i * paso, supY[i]);
      for (let i = iB; i >= 0; i--) ctx.lineTo(i * paso, supY[i] + 30);
      ctx.closePath();
      ctx.fill();
    }

    // Haces de luz: bajan inclinados desde la superficie según el sol, se
    // mecen y se apagan con la profundidad. Entran y salen con fundido.
    const prof = fondoMarY - nivelMarMedio;
    const recorrido = borde + 320;
    for (let i = 0; i < 9; i++) {
      const vel = (3 + 4 * this.azar(i, 6)) * (i % 2 ? 1 : -0.7);
      const u = (((this.azar(i, 5) * recorrido + t * vel) % recorrido) + recorrido) % recorrido;
      const x0 = u - 160 + Math.sin(t * 0.37 + i) * 6;
      const fundido = Math.sin((u / recorrido) * Math.PI);
      const ancho = 12 + this.azar(i, 7) * 36;
      const caida = prof * (0.75 + 0.25 * this.azar(i, 8));
      const inclinacion = caida * 0.33;
      const brillo = (0.5 + 0.5 * Math.sin(t * 0.8 + i * 1.9)) * fundido;
      if (brillo < 0.02) continue;
      const ys = E.superficieY(Math.max(0, Math.min(borde, x0 + ancho / 2)));
      const haz = ctx.createLinearGradient(0, ys, 0, ys + caida);
      haz.addColorStop(0, `rgba(255,255,230,${(0.22 * brillo).toFixed(3)})`);
      haz.addColorStop(0.6, `rgba(255,255,230,${(0.06 * brillo).toFixed(3)})`);
      haz.addColorStop(1, "rgba(255,255,230,0)");
      ctx.fillStyle = haz;
      ctx.beginPath();
      ctx.moveTo(x0, ys);
      ctx.lineTo(x0 + ancho, ys);
      ctx.lineTo(x0 + ancho * 1.8 + inclinacion, ys + caida);
      ctx.lineTo(x0 + inclinacion, ys + caida);
      ctx.closePath();
      ctx.fill();
    }

    if (E.mareal && !E.esEmbalse) {
      this.dibujarPerfilCorriente(ctx, E);
    }

    // Partículas en suspensión. Con oleaje describen las órbitas de la ola
    // lineal en profundidad finita: elipses que se aplastan hacia el fondo.
    // Con corriente las arrastra el perfil de velocidad (ley potencial 1/7:
    // rápidas arriba, casi quietas junto al lecho) y dejan una estela.
    const n = Math.round(Math.min(130, Math.max(50, (borde * prof) / 3600)));
    const U = Math.max(0, this.velocidadCorriente);
    const viveza = Math.min(1, U / 2.5);
    ctx.lineWidth = 1;
    for (let i = 0; i < n; i++) {
      const tam = 0.8 + this.azar(i, 3) * 1.1;
      const fd = this.azar(i, 2);
      const by = nivelMarMedio + 12 + fd * (prof - 18);
      const alfa = 0.28 + 0.34 * this.azar(i, 8);
      let x: number;
      let y = by;
      if (E.mareal && !E.esEmbalse) {
        const perfil = Math.pow(Math.max(0.02, 1 - fd), 1 / 7);
        const tramo = borde + 40;
        x =
          ((((this.azar(i, 1) * tramo + this.avanceFlujo * perfil * (0.9 + 0.2 * this.azar(i, 4))) % tramo) + tramo) % tramo) - 20;
        const fundido = Math.max(0, Math.min(1, (x + 20) / 40, (borde - x) / 30));
        const estela = (3 + 10 * viveza) * perfil;
        y += Math.sin(t * 1.1 + i) * 1.5;
        ctx.strokeStyle = `rgba(236,248,242,${((0.12 + 0.3 * viveza) * fundido).toFixed(3)})`;
        ctx.beginPath();
        ctx.moveTo(x - estela, y);
        ctx.lineTo(x, y);
        ctx.stroke();
        ctx.fillStyle = `rgba(236,248,242,${(alfa * fundido).toFixed(3)})`;
      } else {
        const bx = this.azar(i, 1) * borde;
        const dM = (by - nivelMarMedio) / Math.max(0.01, E.pxPorMReal);
        const [dx, dy] = campo.orbita(bx, dM, tOla);
        x = bx + dx;
        y = by - dy;
        // Alguna órbita se deja dibujada, sólo donde la elipse se lee como
        // tal: con la vertical exagerada, en lo hondo sería una aguja.
        if (i % 9 === 0) {
          const [ax, ay] = campo.semiejesOrbita(bx, dM);
          if (ax > 3 && ay > 2 && ax / ay > 0.3) {
            ctx.strokeStyle = "rgba(236,248,242,0.14)";
            ctx.beginPath();
            ctx.ellipse(bx, by, ax, ay, 0, 0, Math.PI * 2);
            ctx.stroke();
          }
        }
        ctx.fillStyle = `rgba(236,248,242,${alfa.toFixed(3)})`;
      }
      ctx.beginPath();
      ctx.arc(x, y, tam, 0, Math.PI * 2);
      ctx.fill();
    }
    this.dibujarPeces(ctx, E);
    ctx.restore();
  }

  /** Perfil vertical de la corriente mareal: flechas con la ley potencial
   *  1/7, máxima cerca de la superficie y nula en el lecho. */
  private dibujarPerfilCorriente(ctx: CanvasRenderingContext2D, E: Escena) {
    const U = Math.max(0, this.velocidadCorriente);
    if (U < 0.05) return;
    const x0 = Math.max(104, E.w * 0.1);
    const yLecho = E.terrenoY(x0);
    const yTop = E.nivelMarMedio + 14;
    const largoMax = Math.min(70, 18 + U * 16);
    ctx.strokeStyle = "rgba(232,242,245,0.45)";
    ctx.fillStyle = "rgba(232,242,245,0.55)";
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(x0, yTop - 4);
    ctx.lineTo(x0, yLecho);
    ctx.stroke();
    const puntas: [number, number][] = [];
    const filas = 7;
    for (let j = 0; j < filas; j++) {
      const y = yTop + ((yLecho - yTop - 8) * j) / (filas - 1);
      const alturaRel = Math.max(0.02, (yLecho - y) / (yLecho - E.nivelMarMedio));
      const largo = largoMax * Math.pow(alturaRel, 1 / 7);
      puntas.push([x0 + largo, y]);
      ctx.beginPath();
      ctx.moveTo(x0, y);
      ctx.lineTo(x0 + largo - 4, y);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(x0 + largo, y);
      ctx.lineTo(x0 + largo - 6, y - 3);
      ctx.lineTo(x0 + largo - 6, y + 3);
      ctx.closePath();
      ctx.fill();
    }
    // Envolvente del perfil.
    ctx.setLineDash([2, 3]);
    ctx.beginPath();
    ctx.moveTo(puntas[0][0], puntas[0][1]);
    for (const [px, py] of puntas) ctx.lineTo(px, py);
    ctx.lineTo(x0, yLecho);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  /** Estela del rotor: torbellinos de punta de pala que se van aguas abajo
   *  en hélice. Vista de lado, una hélice es una sinusoide cuyo paso sale de
   *  la velocidad de la estela y del giro: λ = 2π·u/Ω. */
  private dibujarEstelaRotor(
    ctx: CanvasRenderingContext2D,
    E: Escena,
    optsGranja: Parameters<typeof disposicionGranja>[0],
    omegaRotor: number
  ) {
    const U = Math.max(0, this.velocidadCorriente);
    if (U < 0.1 || omegaRotor <= 0) return;
    const unidades = disposicionGranja(optsGranja);
    const uWake = (0.7 * U) / E.mPorPx; // px/s
    const pasoHelice = (2 * Math.PI * uWake) / omegaRotor; // px por vuelta
    ctx.save();
    this.trazarRegionAgua(ctx, E);
    ctx.clip();
    for (const u of unidades) {
      const largo = u.radio * 6;
      const intensidad = Math.min(1, U / 1.5) * (u.lejania ? 0.5 : 1);
      ctx.lineWidth = 1.2 * u.escala;
      ctx.lineCap = "round";
      const punto = (beta: number, s: number): [number, number, number] => {
        const rEstela = u.radio * (1 + 0.12 * (s / largo));
        const z = Math.sin(beta);
        return [u.xBuje + s + z * rEstela * 0.42, u.yRotor - Math.cos(beta) * rEstela + z * rEstela * 0.1, z];
      };
      for (let b = 0; b < 3; b++) {
        const beta0 = this.anguloRotor + u.orden * 0.7 + (b * Math.PI * 2) / 3;
        // Trazo continuo: el torbellino es un filamento, no una fila de puntos.
        let previo = punto(beta0, 2);
        for (let s = 4; s < largo; s += 2) {
          const actual = punto(beta0 - (2 * Math.PI * s) / pasoHelice, s);
          const z = (previo[2] + actual[2]) / 2;
          const a = 0.34 * intensidad * (1 - s / largo) * (0.35 + 0.65 * Math.max(0, z));
          if (a >= 0.015) {
            ctx.strokeStyle = `rgba(236,248,244,${a.toFixed(3)})`;
            ctx.beginPath();
            ctx.moveTo(previo[0], previo[1]);
            ctx.lineTo(actual[0], actual[1]);
            ctx.stroke();
          }
          previo = actual;
        }
      }
      ctx.lineCap = "butt";
    }
    ctx.restore();
  }

  /** Una sola masa de terreno con el mismo perfil dentro y fuera del agua.
   *  Las capas —arena, suelo, arcilla y roca madre— siguen el perfil en todo
   *  el ancho, también bajo el mar: es un corte geológico continuo, sin la
   *  costura vertical que lo hacía parecer una obra sin terminar. */
  private dibujarTerreno(
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number,
    nivelMar: number,
    xOrilla: number,
    terrenoY: (px: number) => number,
    xHierba: number,
    conPlaya: boolean
  ) {
    const perfil = () => {
      ctx.beginPath();
      ctx.moveTo(0, terrenoY(0));
      for (let px = 4; px <= w + 4; px += 4) ctx.lineTo(px, terrenoY(px));
      ctx.lineTo(w + 4, h);
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
    const capas = [
      { y0: 7, y1: 30, a: "oklch(0.62 0.035 78)", b: "oklch(0.55 0.03 76)" },
      { y0: 30, y1: 66, a: "oklch(0.72 0.03 88)", b: "oklch(0.64 0.03 84)" },
      { y0: 66, y1: 110, a: C.arcilla, b: "oklch(0.52 0.022 68)" },
      { y0: 110, y1: 520, a: C.rocaMadreClara, b: C.rocaMadre },
    ];
    for (const capa of capas) {
      ctx.beginPath();
      // Contactos ondulados: los estratos no son paralelos a regla.
      const ondula = (px: number, y0: number) => Math.sin(px * 0.017 + y0 * 0.3) * 3 + Math.sin(px * 0.05 + y0) * 1.2;
      ctx.moveTo(-4, terrenoY(-4) + capa.y0 + ondula(-4, capa.y0));
      for (let px = 0; px <= w + 8; px += 6) ctx.lineTo(px, terrenoY(px) + capa.y0 + ondula(px, capa.y0));
      for (let px = w + 8; px >= -4; px -= 6) ctx.lineTo(px, terrenoY(px) + capa.y1 + ondula(px, capa.y1));
      ctx.closePath();
      const g = ctx.createLinearGradient(0, nivelMar, 0, h);
      g.addColorStop(0, capa.a);
      g.addColorStop(1, capa.b);
      ctx.fillStyle = g;
      ctx.fill();
      ctx.strokeStyle = "rgba(48,42,32,0.14)";
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    // Cantos en el suelo y la arcilla: tamaño y separación irregulares.
    ctx.fillStyle = C.roca;
    ctx.globalAlpha = 0.24;
    for (let i = 0; i < 44; i++) {
      const rx = this.azar(i, 50) * w;
      const ry = terrenoY(rx) + 34 + this.azar(i, 51) * 66;
      const rr = 1.6 + this.azar(i, 52) * 3;
      ctx.beginPath();
      ctx.ellipse(rx, ry, rr, rr * 0.55, this.azar(i, 53), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // Roca madre: diaclasas inclinadas y estratificación tenue.
    ctx.strokeStyle = "rgba(28,30,28,0.1)";
    for (let i = 0; i < 7; i++) {
      const yOff = 132 + i * 30;
      ctx.beginPath();
      for (let px = -4; px <= w + 4; px += 8) {
        const y = terrenoY(px) + yOff + Math.sin(px * 0.02 + i) * 3;
        if (px === -4) ctx.moveTo(px, y);
        else ctx.lineTo(px, y);
      }
      ctx.stroke();
    }
    for (let i = 0; i < 36; i++) {
      const rx = this.azar(i, 54) * w;
      const ry = terrenoY(rx) + 124 + this.azar(i, 55) * 90;
      ctx.beginPath();
      ctx.moveTo(rx - 6, ry + 8);
      ctx.lineTo(rx + 8, ry - 8);
      ctx.stroke();
    }

    // Capa vegetal sólo en tierra firme, sobre la lámina.
    ctx.beginPath();
    let dentro = false;
    const xV = Math.max(0, xHierba - 30);
    for (let px = xV; px <= w + 4; px += 4) {
      const y = terrenoY(px);
      if (y > nivelMar - 3) continue;
      if (!dentro) {
        ctx.moveTo(px, y);
        dentro = true;
      } else ctx.lineTo(px, y);
    }
    if (dentro) {
      for (let px = w + 4; px >= xV; px -= 4) {
        const y = terrenoY(px);
        if (y > nivelMar - 3) break;
        ctx.lineTo(px, y + 6);
      }
      ctx.closePath();
      ctx.fillStyle = C.sueloVegetal;
      ctx.fill();
    }
    ctx.restore();

    // Ondas de arena (ripples) en el lecho sumergido.
    if (conPlaya) {
      ctx.strokeStyle = "rgba(255,248,226,0.22)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let px = 6; px < xOrilla - 8; px += 9) {
        const y = terrenoY(px);
        ctx.moveTo(px - 3, y + 2.5);
        ctx.quadraticCurveTo(px, y + 0.5, px + 3, y + 2.5);
      }
      ctx.stroke();
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
    for (let px = xHierba + 4; px <= w; px += 7) {
      const pendiente = Math.abs(terrenoY(px + 8) - terrenoY(px - 8));
      if (pendiente > 9 || terrenoY(px) > nivelMar - 4) continue;
      const y = terrenoY(px) - 1;
      const alto = 2.4 + this.azar(px, 56) * 2.4;
      ctx.moveTo(px, y);
      ctx.lineTo(px - 1.5, y - alto);
      ctx.moveTo(px, y);
      ctx.lineTo(px + 1.4, y - alto * 0.75);
    }
    ctx.stroke();

    // Filo del terreno: cierra la masa y separa el suelo del cielo.
    ctx.beginPath();
    ctx.moveTo(0, terrenoY(0));
    for (let px = 4; px <= w + 4; px += 4) ctx.lineTo(px, terrenoY(px));
    ctx.strokeStyle = "rgba(60,55,45,0.42)";
    ctx.lineWidth = 1.3;
    ctx.stroke();

    // Cantos sobre el fondo marino, con tamaños y separaciones desiguales.
    ctx.fillStyle = C.roca;
    ctx.globalAlpha = 0.5;
    for (let i = 0; i < 18; i++) {
      const rx = this.azar(i, 57) * (xOrilla - 30) + 8;
      const escala = 3 + this.azar(i, 58) * 6;
      ctx.beginPath();
      ctx.ellipse(rx, terrenoY(rx) + 2 + this.azar(i, 59) * 3, escala, escala * 0.5, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  /** Playa: arena mojada hasta donde llega la resaca, la lámina de agua que
   *  sube por la pendiente con cada ola y la espuma de su frente. */
  private dibujarPlaya(ctx: CanvasRenderingContext2D, E: Escena) {
    const { terrenoY, nivelMarMedio, xOrilla, campo, tOla, w, escalaOla } = E;
    // Subida máxima: una fracción de la ola que rompe, a la escala vertical.
    // Nunca más de lo que sube la playa antes de la llanura.
    const desnivel = nivelMarMedio - terrenoY(xOrilla + w * 0.08);
    const subidaPx = Math.min(26, Math.max(2, desnivel * 0.7), Math.max(3, this.Hm0 * 0.45 * escalaOla * 0.6));
    const xTope = Math.min(w, xOrilla + w * 0.08);
    const cotaEn = (yObjetivo: number) => {
      let x = xOrilla;
      while (x < xTope && terrenoY(x) > yObjetivo) x += 1;
      return x;
    };
    const xMax = cotaEn(nivelMarMedio - subidaPx);

    // Arena mojada: más oscura, hasta la marca de la última resaca.
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(xOrilla - 30, terrenoY(xOrilla - 30));
    for (let px = xOrilla - 30; px <= xMax + 14; px += 3) ctx.lineTo(px, terrenoY(px));
    for (let px = xMax + 14; px >= xOrilla - 30; px -= 3) ctx.lineTo(px, terrenoY(px) + 12);
    ctx.closePath();
    const mojada = ctx.createLinearGradient(xOrilla, 0, xMax + 14, 0);
    mojada.addColorStop(0, "rgba(110,98,74,0.42)");
    mojada.addColorStop(0.85, "rgba(110,98,74,0.25)");
    mojada.addColorStop(1, "rgba(110,98,74,0)");
    ctx.fillStyle = mojada;
    ctx.fill();
    ctx.restore();

    // Resaca: sube rápida tras cada ola y baja despacio.
    const fase = campo.fasePrincipal(xOrilla, tOla);
    const ciclo = ((((fase / (2 * Math.PI)) % 1) + 1) % 1);
    const sube = ciclo < 0.35 ? Math.sin((ciclo / 0.35) * (Math.PI / 2)) : Math.cos(((ciclo - 0.35) / 0.65) * (Math.PI / 2));
    const xFrente = cotaEn(nivelMarMedio - subidaPx * Math.max(0, sube));
    if (xFrente > xOrilla + 2) {
      ctx.beginPath();
      const x0 = xOrilla - 6;
      ctx.moveTo(x0, terrenoY(x0) - 2.5);
      for (let px = x0; px <= xFrente; px += 2) {
        const u = (px - x0) / (xFrente - x0);
        ctx.lineTo(px, terrenoY(px) - 2.6 * Math.pow(1 - u, 0.6));
      }
      for (let px = xFrente; px >= x0; px -= 2) ctx.lineTo(px, terrenoY(px) + 0.5);
      ctx.closePath();
      ctx.fillStyle = "rgba(150,212,196,0.55)";
      ctx.fill();
      // Frente de espuma de la lámina.
      ctx.fillStyle = C.espuma;
      for (let i = 0; i < 6; i++) {
        const px = xFrente - i * 3 - this.azar(i, 60) * 2;
        ctx.globalAlpha = (0.8 - i * 0.12) * (ciclo < 0.35 ? 1 : 0.7);
        ctx.beginPath();
        ctx.arc(px, terrenoY(px) - 1.2, 1.4 + this.azar(i, 61), 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }
  }

  /** Vegetación del lecho. Con oleaje, praderas que se mecen con la
   *  velocidad orbital junto al fondo: hacia la costa bajo la cresta y hacia
   *  el mar bajo el seno. Con corriente mareal la arena no se queda: el
   *  fondo es grava y cantos, y las algas se tumban aguas abajo con la
   *  corriente cerca del lecho (ley 1/7) y tiemblan por la turbulencia. */
  private dibujarPraderas(ctx: CanvasRenderingContext2D, E: Escena) {
    const { terrenoY, campo, tOla, t, nivelMarMedio, pxPorMReal, xOrilla, xDispositivo } = E;
    ctx.lineCap = "round";
    if (E.mareal) {
      // Grava y cantos rodados sobre el lecho.
      for (let i = 0; i < 70; i++) {
        const x = this.azar(i, 75) * (xOrilla - 10);
        const y = terrenoY(x);
        const r = 1.6 + this.azar(i, 76) * 3.4;
        ctx.fillStyle = i % 3 ? "rgba(96,98,92,0.75)" : "rgba(140,136,122,0.75)";
        ctx.beginPath();
        ctx.ellipse(x, y - r * 0.3, r, r * 0.6, this.azar(i, 77) - 0.5, 0, Math.PI * 2);
        ctx.fill();
      }
      const U = Math.max(0, this.velocidadCorriente);
      const uLecho = U * Math.pow(0.12, 1 / 7);
      for (let i = 0; i < 22; i++) {
        const x = 14 + this.azar(i, 78) * (xOrilla - 50);
        if (Math.abs(x - xDispositivo) < 70) continue;
        const yb = terrenoY(x);
        if ((yb - nivelMarMedio) / pxPorMReal < 2) continue;
        const frondas = 2 + Math.floor(this.azar(i, 79) * 3);
        for (let j = 0; j < frondas; j++) {
          const largo = 12 + this.azar(i * 7 + j, 80) * 16;
          // Con más corriente, más tumbada (hasta casi horizontal).
          const base = Math.min(1.35, 0.15 + 0.42 * uLecho);
          const aleteo = Math.sin(t * (2.5 + uLecho) + i * 1.7 + j) * (0.06 + 0.05 * uLecho);
          const a = base + aleteo;
          const x0 = x + (j - frondas / 2) * 2;
          const xm = x0 + Math.sin(a * 0.6) * largo * 0.5;
          const ym = yb - Math.cos(a * 0.6) * largo * 0.5;
          const xp = x0 + Math.sin(a) * largo;
          const yp = yb - Math.cos(a) * largo + Math.sin(t * 4 + i + j) * 0.8;
          ctx.strokeStyle = j % 2 ? "oklch(0.47 0.07 80)" : "oklch(0.53 0.08 95)";
          ctx.lineWidth = 2.2 - j * 0.3;
          ctx.beginPath();
          ctx.moveTo(x0, yb + 1);
          ctx.quadraticCurveTo(xm, ym, xp, yp);
          ctx.stroke();
        }
      }
      ctx.lineCap = "butt";
      return;
    }
    for (let i = 0; i < 30; i++) {
      const x = 14 + this.azar(i, 70) * (xOrilla - 50);
      if (Math.abs(x - xDispositivo) < 110) continue;
      const yb = terrenoY(x);
      const d = (yb - nivelMarMedio) / pxPorMReal;
      if (d < 1.5) continue;
      const u = campo.velocidadFondo(x, tOla);
      const inclina = Math.max(-1, Math.min(1, u * 1.4));
      const hojas = 3 + Math.floor(this.azar(i, 71) * 3);
      for (let j = 0; j < hojas; j++) {
        const alto = 8 + this.azar(i * 5 + j, 72) * 14;
        const x0 = x + (j - hojas / 2) * 2.2;
        const temblor = Math.sin(t * 1.6 + i + j * 0.8) * 0.12;
        const a = inclina * 0.8 + temblor;
        const xp = x0 + Math.sin(a) * alto;
        const yp = yb - Math.cos(a) * alto;
        ctx.strokeStyle = j % 2 ? C.pradera : "oklch(0.56 0.1 128)";
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.moveTo(x0, yb + 1);
        ctx.quadraticCurveTo(x0 + Math.sin(a * 0.4) * alto * 0.5, yb - alto * 0.55, xp, yp);
        ctx.stroke();
      }
    }
    ctx.lineCap = "butt";
  }

  /** Cardumen: nada despacio a media agua. Con oleaje los peces también
   *  describen las órbitas de la ola, como cualquier partícula; con
   *  corriente nadan contra ella, de cara aguas arriba. */
  private dibujarPeces(ctx: CanvasRenderingContext2D, E: Escena) {
    const { borde, nivelMarMedio, fondoMarY, t, tOla, campo, terrenoY, superficieY } = E;
    if (E.w < 260 || borde < 160) return;
    const prof = fondoMarY - nivelMarMedio;
    const corriente = E.mareal && !E.esEmbalse;
    const sentido = corriente ? -1 : 1;
    // Los peces evitan el rotor y su estela: con corriente nadan aguas arriba
    // y salen de la turbidez lejos de la turbina.
    const limite = corriente ? Math.min(borde, E.xDispositivo - 170) : borde;
    if (limite < 160) return;
    const recorrido = limite + 220;
    const vel = corriente ? 9 : 14;
    const u = ((((this.azar(3, 100) * recorrido + sentido * vel * t) % recorrido) + recorrido) % recorrido) - 110;
    const fundido = Math.min(1, (u + 110) / 90, (limite + 110 - u) / 90);
    if (fundido <= 0) return;
    const yC = nivelMarMedio + prof * (0.42 + 0.12 * Math.sin(t * 0.11));
    const escala = Math.max(0.75, Math.min(1.2, E.w / 1000));
    for (let i = 0; i < 11; i++) {
      let x = u + (this.azar(i, 101) - 0.5) * 90 * escala + Math.sin(t * 0.7 + i * 1.3) * 5;
      let y = yC + (this.azar(i, 102) - 0.5) * 40 * escala + Math.sin(t * 0.9 + i) * 3;
      if (!E.mareal) {
        const [dx, dy] = campo.orbita(x, (y - nivelMarMedio) / Math.max(0.01, E.pxPorMReal), tOla);
        x += dx;
        y -= dy;
      }
      if (x < -20 || x > limite + 20) continue;
      if (y > terrenoY(x) - 6 || y < superficieY(x) + 8) continue;
      const largo = (11 + this.azar(i, 103) * 5) * escala;
      const alto = largo * 0.34;
      const cola = Math.sin(t * 9 + i * 2.1) * alto * 0.7;
      ctx.globalAlpha = fundido;
      ctx.fillStyle = "rgb(40 60 66)";
      ctx.beginPath();
      ctx.ellipse(x, y, largo / 2, alto / 2, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(x - sentido * largo * 0.42, y);
      ctx.lineTo(x - sentido * largo * 0.85, y - alto * 0.6 + cola);
      ctx.lineTo(x - sentido * largo * 0.85, y + alto * 0.6 + cola);
      ctx.closePath();
      ctx.fill();
      // Vientre plateado: la luz de arriba lo ilumina.
      ctx.fillStyle = "rgba(214,232,228,0.85)";
      ctx.beginPath();
      ctx.ellipse(x + sentido * largo * 0.05, y + alto * 0.14, largo * 0.36, alto * 0.2, 0, 0, Math.PI * 2);
      ctx.fill();
      // Ojo: un punto oscuro hacia la cabeza.
      ctx.fillStyle = "rgb(20 28 30)";
      ctx.beginPath();
      ctx.arc(x + sentido * largo * 0.3, y - alto * 0.08, Math.max(0.6, alto * 0.12), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  /** Segunda pasada de agua, por delante de lo sumergido: tinte que crece
   *  con la profundidad, la franja de luz bajo la lámina y cáusticas que
   *  bailan sobre el fondo. Lo que está bajo el agua se ve a través de ella. */
  private dibujarVeloAgua(ctx: CanvasRenderingContext2D, E: Escena) {
    const { w, h, t, nivelMarMedio, fondoMarY, borde, terrenoY } = E;
    ctx.save();
    this.trazarRegionAgua(ctx, E);
    ctx.clip();
    const velo = ctx.createLinearGradient(0, nivelMarMedio - 20, 0, fondoMarY + 10);
    velo.addColorStop(0, "rgba(60,150,128,0.3)");
    velo.addColorStop(0.18, "rgba(46,124,106,0.22)");
    velo.addColorStop(1, "rgba(12,44,40,0.42)");
    ctx.fillStyle = velo;
    ctx.fillRect(0, nivelMarMedio - 120, w + 4, h + 120);

    // Cáusticas: cada tramo de lámina convexo hacia arriba es una lente que
    // concentra la luz. Se proyecta sobre el lecho siguiendo al sol (que
    // entra desde la izquierda) y desviada por la refracción en la pendiente
    // local; se apaga con la profundidad. El rizado corto dibuja la red
    // temblorosa, el oleaje largo la modula: más luz bajo cada cresta.
    const { supY, paso } = E;
    const iB = Math.min(E.n - 2, Math.floor(borde / paso));
    ctx.globalCompositeOperation = "lighter";
    ctx.lineCap = "round";
    for (let i = 1; i <= iB; i++) {
      const curv = supY[i - 1] + supY[i + 1] - 2 * supY[i];
      if (curv <= 0.04) continue;
      const x = i * paso;
      const ySup = supY[i];
      const prof = terrenoY(x) - ySup;
      if (prof < 8) continue;
      const pend = (supY[i + 1] - supY[i - 1]) / (2 * paso);
      const xl = x + prof * 0.18 + pend * prof * 0.35;
      const yl = terrenoY(xl);
      if (yl - E.superficieY(xl) < 6) continue;
      const cresta = Math.max(0.4, 1 + (E.nivelMar - ySup) / Math.max(4, E.amplitudPx * 2));
      const a = Math.min(0.32, curv * 0.55 * cresta) * Math.exp(-prof / 240);
      if (a < 0.015) continue;
      ctx.strokeStyle = `rgba(255,246,200,${a.toFixed(3)})`;
      ctx.lineWidth = 1.2 + Math.min(2.5, curv * 2);
      ctx.beginPath();
      ctx.moveTo(xl - 2.5, yl - 0.6);
      ctx.lineTo(xl + 2.5, yl - 0.6);
      ctx.stroke();
    }
    ctx.globalCompositeOperation = "source-over";
    ctx.lineCap = "butt";

    // Motas desenfocadas muy cerca de la cámara: dan profundidad de campo.
    for (let i = 0; i < 9; i++) {
      const recorrido = borde + 80;
      const u = (((this.azar(i, 120) * recorrido + t * (2 + this.azar(i, 121) * 3)) % recorrido) + recorrido) % recorrido;
      const x = u - 40;
      const y = nivelMarMedio + 20 + this.azar(i, 122) * (fondoMarY - nivelMarMedio - 40) + Math.sin(t * 0.5 + i) * 6;
      if (y > terrenoY(x) - 10) continue;
      const r = 4 + this.azar(i, 123) * 6;
      const fundido = Math.sin((u / recorrido) * Math.PI);
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, `rgba(230,246,238,${(0.16 * fundido).toFixed(3)})`);
      g.addColorStop(0.6, `rgba(230,246,238,${(0.08 * fundido).toFixed(3)})`);
      g.addColorStop(1, "rgba(230,246,238,0)");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  /** La lámina: se dibuja encima de todo lo que la atraviesa, así el
   *  flotador o el fuste quedan cortados por el agua y no pegados encima.
   *  Con ella, la espuma de las crestas y los destellos del sol. */
  private dibujarSuperficie(ctx: CanvasRenderingContext2D, E: Escena) {
    const { paso, supY, t, tOla, campo, amplitudPx } = E;
    const borde = E.bordeLamina;
    const iB = Math.min(E.n - 1, Math.floor(borde / paso));

    // Rompiente: la ola rota mete aire. Bajo la cresta y el frente queda una
    // nube de burbujas que se va deshaciendo detrás; viaja con la fase.
    if (amplitudPx >= 2) {
      ctx.save();
      this.trazarRegionAgua(ctx, E);
      ctx.clip();
      for (let i = 0; i <= iB; i += 2) {
        const x = i * paso;
        const rot = campo.roturaEn(x);
        if (rot < 0.12) continue;
        const fase = campo.fasePrincipal(x, tOla);
        const th = Math.atan2(Math.sin(fase), Math.cos(fase));
        if (th < -1.8 || th > 1.0) continue;
        const vida = th > -0.2 ? 1 : Math.exp((th + 0.2) * 1.4);
        const espesor = rot * vida * 16;
        const turbio = ctx.createLinearGradient(0, supY[i], 0, supY[i] + espesor + 2);
        turbio.addColorStop(0, `rgba(236,250,244,${(0.42 * rot * vida).toFixed(3)})`);
        turbio.addColorStop(1, "rgba(236,250,244,0)");
        ctx.fillStyle = turbio;
        ctx.fillRect(x, supY[i], paso * 2 + 0.5, espesor + 2);
        const celda = Math.floor(fase / 0.09);
        for (let b = 0; b < 2; b++) {
          const ruido = this.azar(celda * 3 + b, 84);
          if (ruido > rot * vida * 1.4) continue;
          ctx.fillStyle = `rgba(245,252,250,${(0.65 * vida).toFixed(3)})`;
          ctx.beginPath();
          ctx.arc(x + ruido * 4, supY[i] + 3 + this.azar(celda * 3 + b, 85) * espesor, 0.6 + ruido * 1.2, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      ctx.restore();
    }

    // Menisco: una sombra fina bajo la lámina le da grosor.
    ctx.beginPath();
    ctx.moveTo(0, supY[0] + 2.5);
    for (let i = 1; i <= iB; i++) ctx.lineTo(i * paso, supY[i] + 2.5);
    ctx.lineTo(borde, E.superficieY(borde) + 2.5);
    ctx.strokeStyle = "rgba(10,60,50,0.22)";
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, supY[0]);
    for (let i = 1; i <= iB; i++) ctx.lineTo(i * paso, supY[i]);
    ctx.lineTo(borde, E.superficieY(borde));
    ctx.strokeStyle = "rgba(255,255,255,0.78)";
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Destellos del sol en las caras de las olas que miran hacia él: más
    // cuanto más cerca del sol y cuanto más empinada la cara.
    const sx = E.w * 0.22;
    for (let i = 0; i < 70; i++) {
      const x = this.azar(i, 80) * borde;
      const cerca = Math.exp(-Math.pow((x - sx) / (E.w * 0.35), 2));
      const pend = campo.pendiente(x, tOla);
      const cara = Math.max(0, -pend) * 3 + 0.25;
      const brillo = Math.pow(Math.max(0, Math.sin(t * (2 + this.azar(i, 81) * 3) + i * 2.3)), 8) * cerca * Math.min(1, cara);
      if (brillo < 0.06) continue;
      const y = E.superficieY(x);
      ctx.fillStyle = `rgba(255,253,240,${Math.min(0.95, brillo).toFixed(3)})`;
      ctx.fillRect(x - 2, y - 1, 4 + 3 * brillo, 1.4);
    }

    if (amplitudPx < 2) return;
    // Borreguillos: espuma en las crestas sólo con mar empinado (Hm0/λ alto).
    // La espuma va pegada a la ola: su patrón viaja con la fase.
    const peralte = this.lambda > 0 ? this.Hm0 / this.lambda : 0;
    const rompeViento = Math.max(0, Math.min(1, (peralte - 0.014) / 0.03));
    ctx.fillStyle = C.espuma;
    for (let i = 0; i <= iB; i += 2) {
      const x = i * paso;
      const rot = campo.roturaEn(x);
      const fase = campo.fasePrincipal(x, tOla);
      const th = Math.atan2(Math.sin(fase), Math.cos(fase)); // −π..π, 0 en la cresta
      // Ruido ligado a la fase: el dibujo de la espuma viaja con la ola.
      const ruido = this.azar(Math.floor(fase / 0.12), 82);
      // Rotura en el somero: espuma en la cresta y en el frente, y un rastro
      // que se queda detrás y se deshace.
      let densidad = 0;
      if (rot > 0.02) {
        densidad = th > -0.25 && th < 1.1 ? rot : th <= -0.25 ? rot * Math.exp((th + 0.25) * 1.2) * 0.6 : 0;
      }
      // Cresta medida contra el nivel instantáneo: con marea alta el mar
      // entero está por encima del nivel medio y no por eso es espuma.
      const el = (E.nivelMar - supY[i]) / Math.max(1, amplitudPx);
      if (rompeViento > 0 && el > 0.75) densidad = Math.max(densidad, (el - 0.75) * 2.4 * rompeViento);
      if (densidad * ruido < 0.12) continue;
      const r = 0.8 + densidad * (1.4 + 2.2 * ruido);
      ctx.globalAlpha = Math.min(0.9, 0.3 + 0.6 * densidad);
      ctx.beginPath();
      ctx.ellipse(x + (ruido - 0.5) * 3, supY[i] + 0.8, r * 1.5, r * 0.75, 0, 0, Math.PI * 2);
      ctx.fill();
      // Rociones: gotas que salta el labio de la ola al romper, en tiro
      // parabólico sobre el frente.
      if (rot > 0.3 && th > -0.1 && th < 0.9) {
        const p = Math.max(0, Math.min(1, (th + 0.1) / 1.0));
        const sube = Math.sin(p * Math.PI) * rot * (6 + 8 * ruido);
        ctx.globalAlpha = 0.7 * rot * (1 - p * 0.6);
        ctx.beginPath();
        ctx.arc(x + p * 6 + ruido * 3, supY[i] - sube, 0.7 + ruido * 0.8, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
  }

  /** Espuma donde la lámina abraza el flotador: crece con la velocidad
   *  relativa entre el flotador y el agua, que es la carrera útil. */
  private dibujarEspumaFlotador(
    ctx: CanvasRenderingContext2D,
    E: Escena,
    f: { x: number; semi: number; yFlot: number }
  ) {
    const rel = E.superficieY(f.x) - f.yFlot;
    const vel = E.dt > 0 ? Math.abs(rel - this.relPrevio) / E.dt : 0;
    this.relPrevio = rel;
    const intensidad = Math.min(1, 0.25 + vel / 40);
    ctx.fillStyle = C.espuma;
    for (const s of [-1, 1]) {
      const xb = f.x + s * f.semi;
      const yb = E.superficieY(xb);
      for (let i = 0; i < 5; i++) {
        const dx = s * (1 + i * 2.6 + this.azar(i, 90) * 2);
        ctx.globalAlpha = intensidad * (0.85 - i * 0.14);
        ctx.beginPath();
        ctx.ellipse(xb + dx, yb + 0.6 + Math.sin(E.t * 4 + i) * 0.4, 1.6 + this.azar(i, 91) * 1.4, 0.9, 0, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
  }

  // ---- Red eléctrica -------------------------------------------------------

  /** Todo lo que hay en tierra se apoya en la cota del terreno **en su propia
   *  abscisa**. La subestación y la torre van sobre la llanura, no sobre la
   *  pendiente de la playa, y la línea sale del cuadro por la derecha. */
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

  /** Cable de evacuación: va tendido sobre el lecho (no flota en el agua) y
   *  al llegar a la playa entra enterrado en zanja hasta la subestación. Un
   *  pulso lo recorre: el movimiento dice «esto transporta energía». */
  private dibujarCableSubmarino(
    ctx: CanvasRenderingContext2D,
    E: Escena,
    x0: number,
    xFin: number,
    y0?: number
  ) {
    const { terrenoY, xOrilla, t } = E;
    const yEn = (px: number) => (px <= xOrilla - 4 ? terrenoY(px) - 1.5 : terrenoY(px) + 7);
    const puntos: [number, number][] = [];
    if (y0 !== undefined) puntos.push([x0, y0]);
    for (let px = x0 + 6; px <= xFin; px += 6) puntos.push([px, yEn(px)]);
    // Sube a la explanada de la subestación.
    const ySub = terrenoY(xFin) - 2;
    puntos.push([xFin, ySub]);
    if (puntos.length < 2) return;

    const iTierra = puntos.findIndex(([px]) => px > xOrilla - 4);
    ctx.lineJoin = "round";
    ctx.strokeStyle = C.tinta;
    ctx.lineWidth = 3.2;
    ctx.beginPath();
    const finMar = iTierra < 0 ? puntos.length : iTierra + 1;
    for (let i = 0; i < finMar; i++) {
      const [px, py] = puntos[i];
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.stroke();
    if (iTierra >= 0) {
      // Tramo enterrado: discontinuo, se adivina bajo la arena.
      ctx.strokeStyle = "rgba(40,46,44,0.6)";
      ctx.lineWidth = 2.4;
      ctx.setLineDash([5, 4]);
      ctx.beginPath();
      for (let i = iTierra; i < puntos.length; i++) {
        const [px, py] = puntos[i];
        if (i === iTierra) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.stroke();
      ctx.setLineDash([]);
    }
    ctx.lineJoin = "miter";

    const frac = (((t * 0.18) % 1) + 1) % 1;
    const idx = frac * (puntos.length - 1);
    const i0 = Math.floor(idx);
    const i1 = Math.min(puntos.length - 1, i0 + 1);
    const f = idx - i0;
    const px = puntos[i0][0] + (puntos[i1][0] - puntos[i0][0]) * f;
    const py = puntos[i0][1] + (puntos[i1][1] - puntos[i0][1]) * f;
    ctx.fillStyle = C.acentoClaro;
    ctx.globalAlpha = Math.min(1, Math.sin(frac * Math.PI) * 3);
    ctx.beginPath();
    ctx.arc(px, py, 2.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  // ---- Dispositivos --------------------------------------------------------

  /** Columna de agua oscilante. Cajón apoyado en la banqueta con una abertura
   *  sumergida en la pared de mar: la ola entra por ahí, la lámina interior
   *  sube y baja y bombea el aire de la cámara por el conducto de la turbina.
   *  La turbina Wells gira siempre en el mismo sentido, más deprisa cuanto
   *  más rápido se mueve la columna. */
  private dibujarOWC(ctx: CanvasRenderingContext2D, E: Escena, x: number, fondoY: number, omega: number) {
    const { nivelMarMedio, escalaOla, campo, tOla, dt, terrenoY } = E;
    const talon = 22;
    const base = fondoY;
    const franco = Math.max(38, Math.min((base - nivelMarMedio) * 0.5, 2.2 * escalaOla));
    const yCoronacion = nivelMarMedio - franco;
    const altoTotal = Math.max(80, base - yCoronacion);
    const ancho = Math.min(215, Math.max(115, altoTotal * 1.1));
    const x0 = x - ancho / 2;
    const x1 = x + ancho / 2;

    const espesor = Math.max(13, ancho * 0.11);
    const losa = Math.max(12, espesor * 0.85);
    const camIzq = x0 + espesor;
    const camDer = x1 - espesor;
    const techo = yCoronacion + losa;
    const suelo = base - losa;
    const abertura = Math.min(52, Math.max(24, (suelo - techo) * 0.3));
    const yAbertura = suelo - abertura;

    ctx.fillStyle = "oklch(0.22 0.025 190)";
    ctx.fillRect(camIzq, techo, camDer - camIzq, suelo - techo);

    // Lámina interior: sigue a la ola de fuera con retraso (la cámara es un
    // oscilador) y algo amplificada cerca de su resonancia.
    const retraso = 0.9 / omega;
    const etaInt = campo.elevacionPx(x0, tOla - retraso, true) * 1.25;
    const etaIntPrev = campo.elevacionPx(x0, tOla - retraso - 0.05, true) * 1.25;
    const velInt = (etaInt - etaIntPrev) / 0.05; // px/s, + sube
    const yInterior = Math.min(suelo - 8, Math.max(techo + 12, nivelMarMedio - etaInt));
    const columna = ctx.createLinearGradient(0, yInterior, 0, suelo);
    columna.addColorStop(0, "oklch(0.62 0.085 165)");
    columna.addColorStop(1, "oklch(0.36 0.05 190)");
    ctx.fillStyle = columna;
    ctx.fillRect(camIzq, yInterior, camDer - camIzq, suelo - yInterior);
    ctx.fillStyle = "rgba(255,255,255,0.6)";
    ctx.fillRect(camIzq, yInterior - 1.5, camDer - camIzq, 3);

    ctx.fillStyle = "oklch(0.52 0.07 175)";
    ctx.fillRect(x0, yAbertura, espesor, abertura);

    const hormigon = ctx.createLinearGradient(x0, 0, x1, 0);
    hormigon.addColorStop(0, C.obra);
    hormigon.addColorStop(0.5, "oklch(0.76 0.01 240)");
    hormigon.addColorStop(1, C.obraOscura);
    ctx.fillStyle = hormigon;
    ctx.strokeStyle = C.obraSombra;
    ctx.lineWidth = 1.3;

    ctx.beginPath();
    ctx.rect(x0, yCoronacion, espesor, yAbertura - yCoronacion);
    ctx.fill();
    ctx.stroke();

    ctx.beginPath();
    ctx.rect(camDer, yCoronacion, espesor, base - yCoronacion);
    ctx.fill();
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(x0 - talon, suelo);
    ctx.lineTo(x1, suelo);
    for (let px = x1; px >= x0 - talon; px -= 6) {
      ctx.lineTo(px, Math.min(Math.max(base, terrenoY(px)), base + 32) + 2);
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

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
    // Wells: el sentido de giro no depende del sentido del aire.
    this.anguloWells = (this.anguloWells + Math.min(14, Math.abs(velInt) * 0.25) * dt) % (Math.PI * 2);
    ctx.save();
    ctx.translate(xDucto, yEje);
    ctx.rotate(this.anguloWells);
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

    // Flujo de aire: sale cuando la columna sube y entra cuando baja.
    const sube = velInt > 0;
    const fuerza = Math.min(1, Math.abs(velInt) / 30);
    ctx.strokeStyle = `rgba(30,41,59,${(0.25 + 0.45 * fuerza).toFixed(3)})`;
    ctx.fillStyle = ctx.strokeStyle;
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
    ctx.font = `${tam}px ${this.fuente("sans")}`;
    ctx.textAlign = alineacion;
    ctx.fillText(texto, x, y);
  }

  /** Rótulo de anotación sobre fondo propio. Sin la pastilla, el texto claro
   *  se pierde en cuanto cae sobre la cresta de una ola. */
  private chip(ctx: CanvasRenderingContext2D, texto: string, x: number, y: number) {
    // 12 px es el mínimo legible del corte: por debajo, la anotación se pierde
    // en cuanto el lienzo se reduce a la columna de la vista de simulación.
    ctx.font = `12px ${this.fuente("sans")}`;
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
    ctx.font = `600 12px ${this.fuente("sans")}`;
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
    pie: number,
    escenaCorriente: Escena | null
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

      // Regla de longitud de onda en el cielo, por encima de la cresta más
      // alta posible: es donde no compite con nada del corte.
      const anchoRegla = Math.max(80, w * 0.3);
      const [m0, m1] = this.marcasIntervaloTe(anchoRegla, dominioM);
      const x0 = xFlecha + m0;
      const x1 = xFlecha + m1;
      if (this.lambda > 0 && x1 > x0) {
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
    const xCota = w * 0.2;
    ctx.strokeStyle = tenue;
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    ctx.moveTo(xCota, nivelMedio);
    ctx.lineTo(xCota, fondoY);
    ctx.stroke();
    ctx.setLineDash([]);
    this.chip(ctx, `${this.profundidad} m de calado`, xCota + 72, (nivelMedio + fondoY) / 2);

    // Rótulo del perfil de corriente, sobre su primera flecha.
    if (escenaCorriente) {
      const x0 = Math.max(104, w * 0.1);
      this.rotulo(ctx, "perfil de velocidad", x0 - 2, escenaCorriente.nivelMarMedio + 9, "left", tenue, 11);
    }

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

    ctx.font = `600 12px ${this.fuente("mono")}`;
    ctx.textAlign = "right";
    const anchoCaja = (ctx.measureText?.(linea)?.width ?? linea.length * 7) + 18;
    ctx.fillStyle = "rgba(15,26,36,0.72)";
    ctx.beginPath();
    ctx.roundRect(w - 12 - anchoCaja, 12, anchoCaja, 24, 4);
    ctx.fill();
    ctx.fillStyle = C.acentoClaro;
    ctx.font = `600 12px ${this.fuente("mono")}`;
    ctx.textAlign = "right";
    ctx.fillText(linea, w - 21, 28);
  }

  /** Pinta el instante actual y, si no está en pausa, pone en marcha el
   *  bucle. Se puede llamar tantas veces como se quiera: nunca hay más de un
   *  bucle y el reloj no vuelve a cero. */
  arrancar() {
    this.dibujar(this.reloj);
    this.iniciar();
  }

  iniciar() {
    if (this.pausado || this.rafId !== null) return;
    this.marcaPrevia = null;
    const loop = (now: number) => {
      this.rafId = null;
      if (this.pausado) return;
      if (this.marcaPrevia !== null) {
        // Un fotograma tardío (pestaña oculta, pausa del sistema) no hace
        // saltar la escena: el avance se acota.
        this.reloj += Math.max(0, Math.min(0.1, (now - this.marcaPrevia) / 1000));
      }
      this.marcaPrevia = now;
      this.dibujar(this.reloj);
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
    this.iniciar();
  }

  detener() {
    this.pausar();
    this.observador?.disconnect();
    this.observador = null;
  }
}
