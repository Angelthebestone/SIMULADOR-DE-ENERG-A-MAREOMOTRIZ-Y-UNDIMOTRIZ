// Oleaje del corte 2D: la física que el dibujo necesita para no mentir.
//
// - Dispersión lineal ω² = g·k·tanh(k·h) resuelta en cada columna con la
//   profundidad local: al subir el fondo la ola se acorta y se frena.
// - Asomeramiento por conservación del flujo de energía (Ks = √(cg₀/cg)):
//   la ola crece al llegar al somero.
// - Rotura por profundidad (H ≤ γ·h, γ = 0,78): en la zona de rompientes la
//   altura queda limitada por el calado y el exceso se pinta como espuma.
// - Segundo orden de Stokes: crestas más agudas y senos más planos, con el
//   coeficiente de profundidad finita.
// - Órbitas de las partículas con las funciones hiperbólicas de profundidad
//   finita: elipses que se aplastan hacia el fondo.
//
// El mar se compone de un tren principal —el del contrato, (Hm0/2)·cos(k·x −
// ω·t)— y tres componentes menores con su propia dispersión, que forman
// grupos de olas como en un estado de mar real. Nada de esto recalcula la
// física del dispositivo: sólo dibuja la superficie.

export const G = 9.81;
/** Índice de rotura por profundidad (McCowan): H/h máximo antes de romper. */
export const GAMMA_ROTURA = 0.78;

/** Número de onda por la relación de dispersión, con semilla explícita de
 *  Fenton y McKee y Newton. Válido de aguas someras a profundas. */
export function numeroOndaLocal(omega: number, h: number): number {
  if (!(omega > 0)) return 0;
  const hh = Math.max(0.05, h);
  const k0 = (omega * omega) / G;
  let k = k0 / Math.pow(Math.tanh(Math.pow(k0 * hh, 0.75)), 2 / 3);
  for (let i = 0; i < 25; i++) {
    const th = Math.tanh(k * hh);
    const f = G * k * th - omega * omega;
    const df = G * th + G * k * hh * (1 - th * th);
    const dk = f / df;
    k -= dk;
    if (Math.abs(dk) < 1e-12 * k) break;
  }
  return k;
}

/** Celeridad de grupo cg = n·c, con n = ½(1 + 2kh/sinh 2kh). */
export function celeridadGrupo(omega: number, k: number, h: number): number {
  if (!(k > 0)) return 0;
  const kh2 = 2 * k * Math.max(0.05, h);
  const n = kh2 > 40 ? 0.5 : 0.5 * (1 + kh2 / Math.sinh(kh2));
  return (n * omega) / k;
}

/** cosh(k(h−d))/sinh(kh) y sinh(k(h−d))/sinh(kh) sin desbordar en aguas
 *  profundas (donde ambas tienden a e^(−k·d)). */
function factoresOrbita(k: number, h: number, d: number): [number, number] {
  const kh = k * h;
  const dd = Math.max(0, Math.min(h, d));
  if (kh > 18) {
    const e = Math.exp(-k * dd);
    return [e, e];
  }
  const s = Math.sinh(Math.max(1e-6, kh));
  return [Math.cosh(k * (h - dd)) / s, Math.sinh(k * (h - dd)) / s];
}

/** Componentes del estado de mar, relativas al tren principal. La principal
 *  es la del contrato; las otras dos casi de la misma frecuencia baten con
 *  ella y forman grupos; la última es mar de viento corto. */
const COMPONENTES = [
  { f: 1, a: 1, fase: 0 },
  { f: 1.11, a: 0.2, fase: 1.7 },
  { f: 0.91, a: 0.15, fase: 4.1 },
  { f: 1.93, a: 0.05, fase: 2.6 },
];

export interface EntradaCampo {
  /** Ancho del corte en píxeles. */
  ancho: number;
  /** Separación entre columnas de cálculo (px). */
  paso: number;
  /** Metros horizontales por píxel: el corte es a escala en horizontal. */
  mPorPx: number;
  /** Calado local en metros (0 en seco). */
  profundidadEn: (px: number) => number;
  /** Calado de referencia mar adentro, donde la ola no está asomerada. */
  profundidadRef: number;
  Hm0: number;
  Te: number;
  /** Píxeles por metro de elevación de la superficie (vertical exagerada). */
  escalaPx: number;
  /** Píxeles por metro de calado tal como se dibuja la columna de agua. */
  pxPorMReal: number;
  /** Abscisa donde la fase del tren principal vale −ω·t (el dispositivo). */
  xRef: number;
  /** Factor de atenuación global (estuario del dique, p. ej.). */
  atenuacion?: number;
  /** Sólo el tren principal: mar regular, para las miniaturas. */
  regular?: boolean;
}

interface Componente {
  omega: number;
  amp: number; // m, ya normalizada
  fase0: number;
  k: Float64Array;
  fase: Float64Array; // ∫k dx desde xRef (rad)
  ks: Float64Array; // asomeramiento
}

/** Superficie del corte precalculada por columnas. La geometría (números de
 *  onda, fases integradas, asomeramiento, rotura) sólo depende del corte y
 *  de los mandos; por fotograma se evalúan cosenos. */
export class CampoOleaje2D {
  readonly n: number;
  readonly paso: number;
  readonly prof: Float64Array;
  readonly comps: Componente[];
  /** Factor que limita la altura por rotura y por calado dibujado (0..1). */
  readonly limite: Float64Array;
  /** Intensidad de rotura física: 0 sin romper, 1 rompiendo de lleno. */
  readonly rotura: Float64Array;
  /** Coeficiente de segundo orden de Stokes del tren principal. */
  readonly stokes: Float64Array;
  readonly escalaPx: number;
  readonly mPorPx: number;
  readonly omega: number;
  readonly a0: number;

  constructor(e: EntradaCampo) {
    this.paso = Math.max(1, e.paso);
    this.n = Math.max(2, Math.ceil(e.ancho / this.paso) + 2);
    this.escalaPx = e.escalaPx;
    this.mPorPx = e.mPorPx;
    const n = this.n;
    const omega = (2 * Math.PI) / Math.max(0.5, e.Te);
    this.omega = omega;
    const at = e.atenuacion ?? 1;
    this.a0 = (Math.max(0, e.Hm0) / 2) * at;
    const hRef = Math.max(0.5, e.profundidadRef);

    this.prof = new Float64Array(n);
    for (let i = 0; i < n; i++) this.prof[i] = Math.max(0, e.profundidadEn(i * this.paso));

    // El tren principal vale exactamente Hm0/2, como en el contrato y como la
    // ola que excita la serie del núcleo; las otras sólo añaden grupos (su
    // energía suma un 6 % a la del principal).
    const lista = e.regular ? COMPONENTES.slice(0, 1) : COMPONENTES;
    const dx = this.paso * e.mPorPx;
    const iRef = Math.max(0, Math.min(n - 1, e.xRef / this.paso));
    this.comps = lista.map((c) => {
      const w = omega * c.f;
      const kRef = numeroOndaLocal(w, hRef);
      const cgRef = celeridadGrupo(w, kRef, hRef);
      const k = new Float64Array(n);
      const fase = new Float64Array(n);
      const ks = new Float64Array(n);
      for (let i = 0; i < n; i++) {
        // En seco la ola no existe; el número de onda se congela en el del
        // somero para que la fase siga siendo continua.
        const h = Math.max(0.25, this.prof[i]);
        k[i] = numeroOndaLocal(w, h);
        const cg = celeridadGrupo(w, k[i], h);
        ks[i] = Math.min(2.2, Math.sqrt(cgRef / Math.max(1e-6, cg)));
      }
      for (let i = 1; i < n; i++) fase[i] = fase[i - 1] + 0.5 * (k[i] + k[i - 1]) * dx;
      // Fase cero en el dispositivo: ahí el tren principal es cos(ω·t).
      const i0 = Math.floor(iRef);
      const fr = iRef - i0;
      const ref = fase[i0] + (fase[Math.min(n - 1, i0 + 1)] - fase[i0]) * fr;
      for (let i = 0; i < n; i++) fase[i] -= ref;
      return { omega: w, amp: this.a0 * c.a, fase0: c.fase, k, fase, ks };
    });

    this.limite = new Float64Array(n);
    this.rotura = new Float64Array(n);
    this.stokes = new Float64Array(n);
    const principal = this.comps[0];
    for (let i = 0; i < n; i++) {
      const h = this.prof[i];
      // Envolvente máxima posible en la columna (todas las componentes en fase).
      let env = 0;
      for (const c of this.comps) env += c.amp * c.ks[i];
      // Rotura física: H = 2·env no puede superar γ·h.
      const tope = (GAMMA_ROTURA * h) / 2;
      const fis = env > 1e-9 ? Math.min(1, tope / env) : 1;
      // Tope de dibujo: con la vertical exagerada el seno no puede atravesar
      // el fondo que se ve; se deja un margen de agua bajo el seno.
      const topeDibujo = (0.82 * h * e.pxPorMReal) / Math.max(1e-6, e.escalaPx);
      const vis = env > 1e-9 ? Math.min(1, topeDibujo / env) : 1;
      this.limite[i] = Math.max(0, Math.min(fis, vis));
      this.rotura[i] = h <= 0 ? 0 : Math.max(0, Math.min(1, (1 - fis) * 3));
      // Stokes 2.º orden: B = k·a·(3 − σ²)/(4σ³), σ = tanh(kh). Acotado para
      // que el seno no desarrolle una segunda cresta (límite de validez).
      const k = principal.k[i];
      const a = principal.amp * principal.ks[i] * this.limite[i];
      const sigma = Math.tanh(k * Math.max(0.25, h));
      const B = (k * a * (3 - sigma * sigma)) / (4 * sigma * sigma * sigma);
      this.stokes[i] = Math.max(0, Math.min(0.24, B));
    }
  }

  private indice(px: number): [number, number] {
    const u = Math.max(0, Math.min(this.n - 1.0001, px / this.paso));
    const i = Math.floor(u);
    return [i, u - i];
  }

  /** Elevación de la superficie en la columna i, en metros. */
  elevacionM(i: number, t: number, soloPrincipal = false): number {
    const lim = this.limite[i];
    if (lim <= 0) return 0;
    let eta = 0;
    const lista = soloPrincipal ? 1 : this.comps.length;
    for (let j = 0; j < lista; j++) {
      const c = this.comps[j];
      const th = c.fase[i] - c.omega * t + c.fase0;
      const a = c.amp * c.ks[i] * lim;
      if (j === 0) {
        // Segundo orden de Stokes y frente que se empina al romper: la
        // cresta se inclina hacia la costa.
        const B = this.stokes[i];
        const S = 0.42 * this.rotura[i];
        eta += a * (Math.cos(th) + B * Math.cos(2 * th) + S * Math.sin(2 * th) * 0.5);
      } else {
        eta += a * Math.cos(th);
      }
    }
    return eta;
  }

  /** Elevación en píxeles (positiva hacia arriba) en cualquier abscisa. */
  elevacionPx(px: number, t: number, soloPrincipal = false): number {
    const [i, f] = this.indice(px);
    const a = this.elevacionM(i, t, soloPrincipal);
    const b = this.elevacionM(i + 1, t, soloPrincipal);
    return (a + (b - a) * f) * this.escalaPx;
  }

  /** Pendiente local de la superficie (px/px), para espuma y destellos. */
  pendiente(px: number, t: number): number {
    return (this.elevacionPx(px + 2, t) - this.elevacionPx(px - 2, t)) / 4;
  }

  /** Calado local en metros. */
  calado(px: number): number {
    const [i, f] = this.indice(px);
    return this.prof[i] + (this.prof[i + 1] - this.prof[i]) * f;
  }

  /** Número de onda del tren principal en una abscisa (rad/m). */
  numeroOnda(px: number): number {
    const [i] = this.indice(px);
    return this.comps[0].k[i];
  }

  /** Intensidad de rotura en una abscisa (0..1). */
  roturaEn(px: number): number {
    const [i, f] = this.indice(px);
    return this.rotura[i] + (this.rotura[i + 1] - this.rotura[i]) * f;
  }

  /** Fase del tren principal en una abscisa (rad), para colocar la espuma
   *  en el frente de cada ola. */
  fasePrincipal(px: number, t: number): number {
    const [i, f] = this.indice(px);
    const c = this.comps[0];
    const fase = c.fase[i] + (c.fase[i + 1] - c.fase[i]) * f;
    return fase - c.omega * t + c.fase0;
  }

  /** Desplazamiento orbital de una partícula a `d` metros bajo el nivel
   *  medio: horizontal a escala real, vertical con la exageración del corte. */
  orbita(px: number, d: number, t: number): [number, number] {
    const [i] = this.indice(px);
    const h = this.prof[i];
    if (h <= 0.3 || d >= h) return [0, 0];
    const lim = this.limite[i];
    let dx = 0;
    let dy = 0;
    for (const c of this.comps) {
      const k = c.k[i];
      const a = c.amp * c.ks[i] * lim;
      const th = c.fase[i] - c.omega * t + c.fase0;
      const [fh, fv] = factoresOrbita(k, h, d);
      dx += -a * fh * Math.sin(th);
      dy += a * fv * Math.cos(th);
    }
    // El vaivén horizontal en el somero llega a ser varias veces la amplitud:
    // se acota para que la partícula no cruce media pantalla.
    const dxPx = Math.max(-40, Math.min(40, dx / this.mPorPx));
    return [dxPx, dy * this.escalaPx];
  }

  /** Semiejes (px) de la órbita del tren principal a `d` metros de
   *  profundidad: la elipse que recorre una partícula en un periodo. */
  semiejesOrbita(px: number, d: number): [number, number] {
    const [i] = this.indice(px);
    const h = this.prof[i];
    if (h <= 0.3 || d >= h) return [0, 0];
    const c = this.comps[0];
    const a = c.amp * c.ks[i] * this.limite[i];
    const [fh, fv] = factoresOrbita(c.k[i], h, d);
    return [Math.min(40, (a * fh) / this.mPorPx), a * fv * this.escalaPx];
  }

  /** Velocidad orbital horizontal junto al fondo (m/s, + hacia la costa).
   *  Es la que mece las praderas del lecho. */
  velocidadFondo(px: number, t: number): number {
    const [i] = this.indice(px);
    const h = this.prof[i];
    if (h <= 0.3) return 0;
    const lim = this.limite[i];
    let u = 0;
    for (const c of this.comps) {
      const k = c.k[i];
      const kh = k * h;
      if (kh > 18) continue;
      const a = c.amp * c.ks[i] * lim;
      const th = c.fase[i] - c.omega * t + c.fase0;
      u += ((a * c.omega) / Math.sinh(Math.max(1e-6, kh))) * Math.cos(th);
    }
    return u;
  }
}

/** Tramo estacionario de una serie periódica: de un cruce ascendente por cero
 *  a otro, dejando fuera el arranque desde reposo. Repetir ese tramo en bucle
 *  no produce saltos, porque empieza y acaba en el mismo punto del ciclo. */
export function tramoEstacionario(t_s: number[], z_m: number[]): { ini: number; fin: number } | null {
  const n = Math.min(t_s.length, z_m.length);
  if (n < 8) return null;
  const tIni = t_s[0];
  const tFin = t_s[n - 1];
  const dur = tFin - tIni;
  if (!(dur > 0)) return null;
  // Media del último tercio: la serie puede oscilar alrededor de un valor no nulo.
  let suma = 0;
  let cuenta = 0;
  for (let i = 0; i < n; i++) {
    if (t_s[i] >= tIni + dur * 0.4) {
      suma += z_m[i];
      cuenta++;
    }
  }
  const media = cuenta ? suma / cuenta : 0;
  const cruces: number[] = [];
  for (let i = 1; i < n; i++) {
    if (t_s[i] < tIni + dur * 0.4) continue;
    const a = z_m[i - 1] - media;
    const b = z_m[i] - media;
    if (a < 0 && b >= 0) {
      const f = a / (a - b);
      cruces.push(t_s[i - 1] + (t_s[i] - t_s[i - 1]) * f);
    }
  }
  if (cruces.length < 2) return null;
  return { ini: cruces[0], fin: cruces[cruces.length - 1] };
}
