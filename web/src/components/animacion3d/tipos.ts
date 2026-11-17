// Tipos compartidos de las escenas 3D. El motor (Animacion3D) elige la escena,
// le pasa un ContextoEscena3D con parámetros y helpers, y recibe ManijasEscena3D
// con las referencias que debe animar cada fotograma.

// @ts-ignore — three se empaqueta por Vite sin @types (build verificado)
import * as THREE from "three";

export const PROFUNDIDAD_M_3D = 30;

export type TipoCimentacion3D = "pilote" | "gravedad" | "tripode";
export type ModoEnergia3D = "undimotriz" | "mareomotriz";

export interface Payload3D {
  series: { t_s: number[]; z_m: number[] } | null;
  k: number;
  Hm0: number;
  Te: number;
  Bpto: number;
  dispositivo: string;
  profundidad_m?: number;
  modoEnergia?: ModoEnergia3D;
  cimentacion?: TipoCimentacion3D;
  velocidadCorriente?: number;
  rangoMarea?: number;
  cantidadUnidades?: number;
  potenciaCaptadaW?: number | null;
  modo?: string;
}

/** Alias de three para que las escenas no importen three a mano. */
export type Grupo3D = THREE.Group;
export type Malla3D = THREE.Mesh;
export type Sprite3D = THREE.Sprite;
export type Flecha3D = THREE.ArrowHelper;
export type MaterialEstandar3D = THREE.MeshStandardMaterial;
export type Camara3D = THREE.PerspectiveCamera;
export type EscenaThree3D = THREE.Scene;
export type Renderer3D = THREE.WebGLRenderer;
export type Curva3D = THREE.CatmullRomCurve3;
export type Color3D = THREE.Color;
export type Niebla3D = THREE.Fog;

/** Parámetros de simulación + helpers del motor que las escenas necesitan. */
export interface ContextoEscena3D {
  readonly Hm0: number;
  readonly Te: number;
  readonly Bpto: number;
  readonly k: number;
  readonly lambda: number;
  readonly velocidadCorriente: number;
  readonly rangoMarea: number;
  readonly cimentacion: TipoCimentacion3D;
  readonly cantidadUnidades: number;
  readonly modoEmbalse: string;
  readonly dispositivo: string;
  readonly modoEnergia: ModoEnergia3D;
  readonly series: { t_s: number[]; z_m: number[] } | null;
  readonly calidadBaja: boolean;
  /** Material estándar con color y extras opcionales. */
  mat(color: number, extra?: Record<string, unknown>): MaterialEstandar3D;
  /** Crea un sprite de texto reutilizable. */
  hacerEtiqueta(texto: string): Sprite3D;
  /** Repinta el sprite ya creado. */
  pintarEtiqueta(sp: Sprite3D, texto: string): void;
  /** Interpola la serie ya integrada en el tiempo t (segundos). */
  muestrearSerie(t: number): number | null;
  /** Elevación eta(x,t) = (Hm0/2)*cos(k*x - omega*t). */
  eta(xM: number, t: number, omega: number, k: number): number;
}

/** Referencias que el motor actualiza cada fotograma. */
export interface ManijasEscena3D {
  rotores: Grupo3D[];
  mar: Malla3D | null;
  marBase: Float32Array | null;
  marAncho: number;
  flotador: Malla3D | null;
  mastil: Malla3D | null;
  nivelEmbalse: Malla3D | null;
  nivelMar: Malla3D | null;
  flechaLlenado: Flecha3D | null;
  flechaVaciado: Flecha3D | null;
  etiquetaSalto: Sprite3D | null;
  etiquetaCiclo: Sprite3D | null;
  etiquetaDispositivo: Sprite3D | null;
  pulso: Malla3D | null;
  pulsoCurva: Curva3D | null;
  /** Partículas de flujo del conducto (dique). */
  chorros: Malla3D[];
  /** Indicador vertical del salto h entre niveles (dique). */
  grupoSalto: Grupo3D | null;
  /** Espuma de la línea de flotación en cada lado (dique). */
  espumaMar: Malla3D | null;
  espumaEmbalse: Malla3D | null;
  ultimoTextoSalto: string;
  ultimoTextoCiclo: string;
}

/** Encuadre de cámara, fondo y niebla de una escena. */
export interface Encuadre3D {
  posicion: { x: number; y: number; z: number };
  lookAt: { x: number; y: number; z: number };
  /** Color de fondo en hex (0xRRGGBB). También es el color de la niebla. */
  fondo: number;
  /** Niebla exponencial lineal. */
  niebla: { near: number; far: number };
  /**
   * Radio (unidades de mundo) de la esfera que debe caber entera en el
   * lienzo. El motor aleja la cámara lo necesario según el aspecto.
   */
  radio?: number;
  /** Margen extra sobre la esfera (1 = justo al borde). Por defecto 1,1. */
  margen?: number;
}

/** Una escena concreta: dique, absorbedor o granja. */
export interface Escena3D {
  /** ctx permite adaptar el encuadre al número de unidades o al modo. */
  encuadre(ctx?: ContextoEscena3D): Encuadre3D;
  /** Añade la geometría al grupo raíz y devuelve las manijas a animar. */
  construir(g: Grupo3D, ctx: ContextoEscena3D): ManijasEscena3D;
  /** Actualiza manijas según el tiempo. El render lo hace el motor. */
  animar(t: number, ctx: ContextoEscena3D, manijas: ManijasEscena3D): void;
  /** Profundidad (en Z) de la lámina de mar al degradar calidad. */
  marFondo?(ancho: number): number;
  /** Ajusta la lámina de mar recién creada (p. ej. la ventana del dique). */
  configurarMar?(malla: Malla3D): void;
  /** Si es true, el motor no añade lecho ni red eléctrica de tierra. */
  omiteEntornoTierra?: boolean;
  /** Hook previo a construir: environment map, tone mapping, luces extra. */
  configurarEscena?(escenaThree: EscenaThree3D): void;
}

/** Manijas vacías: las escenas rellenan solo lo que usan. */
export function manijasVacias(): ManijasEscena3D {
  return {
    rotores: [],
    mar: null,
    marBase: null,
    marAncho: 34,
    flotador: null,
    mastil: null,
    nivelEmbalse: null,
    nivelMar: null,
    flechaLlenado: null,
    flechaVaciado: null,
    etiquetaSalto: null,
    etiquetaCiclo: null,
    etiquetaDispositivo: null,
    pulso: null,
    pulsoCurva: null,
    chorros: [],
    grupoSalto: null,
    espumaMar: null,
    espumaEmbalse: null,
    ultimoTextoSalto: "",
    ultimoTextoCiclo: "",
  };
}
