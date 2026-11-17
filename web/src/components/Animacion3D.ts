// Animacion3D — motor Three.js. Elige la escena (dique / absorbedor / granja),
// construye el grafo a través de Escena3D.construir y en cada fotograma anima
// el oleaje genérico + lo que la escena indique en Escena3D.animar.
// Misma API pública que usa Ver.vue: constructor, cargarSimulacion, arrancar,
// pausar, reanudar, detener, liberar, degradarCalidad, dibujar, onFrame.

// @ts-ignore — three se empaqueta por Vite sin @types (build verificado)
import * as THREE from "three";
import type {
  ContextoEscena3D,
  Encuadre3D,
  Escena3D,
  ManijasEscena3D,
  ModoEnergia3D,
  Payload3D,
  TipoCimentacion3D,
} from "./animacion3d/tipos";
import { manijasVacias, PROFUNDIDAD_M_3D } from "./animacion3d/tipos";
import {
  actualizarNivelAgua,
  crearEtiqueta,
  crearLecho,
  crearMat,
  crearRedElectrica,
  crearSuperficieMar,
  disponerEtiquetas,
  pintarEtiqueta,
  type ZonaReservadaPx,
} from "./animacion3d/utilidades";
import { escenaAbsorbedor } from "./animacion3d/escenas/absorbedor";
import { escenaDique } from "./animacion3d/escenas/dique";
import { escenaGranja } from "./animacion3d/escenas/granja";

export { PROFUNDIDAD_M_3D };
export type { ModoEnergia3D, Payload3D, TipoCimentacion3D };

function serieValida(s: Payload3D["series"]): s is { t_s: number[]; z_m: number[] } {
  return (
    !!s &&
    Array.isArray(s.t_s) &&
    Array.isArray(s.z_m) &&
    s.t_s.length > 0 &&
    s.z_m.length > 0
  );
}

export class Animacion3D {
  contenedor: HTMLElement;
  series: { t_s: number[]; z_m: number[] } | null = null;
  k = 0;
  Hm0 = 1.5;
  Te = 7.0;
  Bpto = 80_000;
  lambda = 0;
  pausado = false;
  sinSerieMsg = "";

  dispositivo = "absorbedor_puntual";
  modoEnergia: ModoEnergia3D = "undimotriz";
  cimentacion: TipoCimentacion3D = "pilote";
  velocidadCorriente = 2.2;
  rangoMarea = 3.5;
  profundidad = PROFUNDIDAD_M_3D;
  cantidadUnidades = 1;
  potenciaCaptadaW: number | null = null;
  modoEmbalse = "";

  calidadBaja = false;

  /** El monitor de la vista recibe la marca de cada fotograma. */
  onFrame: ((marcaMs: number) => void) | null = null;

  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private rafId: number | null = null;
  private t0: number | null = null;
  private observador: ResizeObserver | null = null;
  private raiz: THREE.Group | null = null;
  private escena: Escena3D = escenaAbsorbedor;
  private manijas: ManijasEscena3D = manijasVacias();
  /** Encuadre autoral de la escena; el aspecto decide la distancia final. */
  private encuadre: Encuadre3D | null = null;
  /** Rótulos en espacio de cámara (se recolocan cada fotograma). */
  private etiquetas: THREE.Sprite[] = [];
  private grupoEtiquetas: THREE.Group;
  /** Controles flotantes medidos en el DOM que los rótulos deben esquivar. */
  private zonasRotulos: ZonaReservadaPx[] = [];
  private zonasMedidasMs = 0;

  constructor(contenedor: HTMLElement) {
    this.contenedor = contenedor;
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.shadowMap.enabled = true;
    // PCF (no PCFSoft): mismo aspecto didáctico, más barato y sin aviso de
    // deprecación en consola.
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    const ancho = Math.max(2, contenedor.clientWidth || 800);
    const alto = Math.max(2, contenedor.clientHeight || 400);
    this.renderer.setSize(ancho, alto);
    this.renderer.domElement.style.display = "block";
    this.renderer.domElement.style.width = "100%";
    this.renderer.domElement.style.height = "100%";
    // ACES + sRGB: evita el lavado de colores del tonemap lineal por defecto.
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    contenedor.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x0e2a3a);
    this.scene.fog = new THREE.Fog(0x0e2a3a, 40, 90);

    this.camera = new THREE.PerspectiveCamera(45, ancho / alto, 0.1, 300);
    this.camera.position.set(0, 9, 24);
    this.camera.lookAt(0, -1, 0);
    // Los rótulos son hijos de la cámara: la cámara debe estar en la escena
    // para que su subárbol se renderice.
    this.grupoEtiquetas = new THREE.Group();
    this.grupoEtiquetas.name = "rotulos";
    this.camera.add(this.grupoEtiquetas);
    this.scene.add(this.camera);

    const hemi = new THREE.HemisphereLight(0xdceef6, 0x24424f, 0.95);
    this.scene.add(hemi);
    const sol = new THREE.DirectionalLight(0xfff2dc, 1.65);
    sol.position.set(12, 20, 10);
    sol.castShadow = true;
    sol.shadow.mapSize.set(1024, 1024);
    this.scene.add(sol);
    // Relleno suave desde el otro lado: evita que el metal quede a manchas.
    const relleno = new THREE.DirectionalLight(0xbfdcef, 0.45);
    relleno.position.set(-10, 8, -6);
    this.scene.add(relleno);

    if (typeof window !== "undefined" && window.matchMedia) {
      const m = window.matchMedia("(prefers-reduced-motion: reduce)");
      if (m.matches) this.pausado = true;
      m.addEventListener?.("change", (e) => {
        if (e.matches) this.pausar();
      });
    }

    if (typeof ResizeObserver !== "undefined") {
      this.observador = new ResizeObserver(() => this.ajustar());
      this.observador.observe(contenedor);
    }
    this.construir();
  }

  cargarSimulacion(payload: Payload3D) {
    this.Hm0 = payload.Hm0;
    this.Te = payload.Te;
    this.Bpto = payload.Bpto;
    this.k = payload.k;
    this.lambda = this.k > 0 ? (2 * Math.PI) / this.k : 0;
    this.dispositivo = payload.dispositivo || "absorbedor_puntual";
    this.profundidad = payload.profundidad_m ?? PROFUNDIDAD_M_3D;
    this.potenciaCaptadaW = payload.potenciaCaptadaW ?? null;
    if (payload.modoEnergia) this.modoEnergia = payload.modoEnergia;
    else if (
      this.dispositivo.includes("turbina") ||
      this.dispositivo.includes("corriente") ||
      this.dispositivo.includes("embalse") ||
      this.dispositivo.includes("tidal")
    ) {
      this.modoEnergia = "mareomotriz";
    } else {
      this.modoEnergia = "undimotriz";
    }
    if (payload.cimentacion) this.cimentacion = payload.cimentacion;
    if (payload.velocidadCorriente !== undefined)
      this.velocidadCorriente = payload.velocidadCorriente;
    if (payload.rangoMarea !== undefined) this.rangoMarea = payload.rangoMarea;
    if (payload.cantidadUnidades !== undefined && payload.cantidadUnidades > 0)
      this.cantidadUnidades = Math.min(6, Math.max(1, Math.round(payload.cantidadUnidades)));
    else if (this.dispositivo === "turbina_corriente") this.cantidadUnidades = 3;
    this.modoEmbalse = (payload.modo || "").toLowerCase();
    if (!serieValida(payload.series)) {
      this.series = null;
      this.sinSerieMsg = `sin serie de posición — dispositivo ${this.dispositivo}`;
    } else {
      this.series = { t_s: [...payload.series.t_s], z_m: [...payload.series.z_m] };
      this.sinSerieMsg = "";
    }
    this.t0 = null;
    this.construir();
    this.dibujar(0);
  }

  private muestrearSerie(t: number): number | null {
    if (!this.series) return null;
    const { t_s, z_m } = this.series;
    const tDur = t_s[t_s.length - 1] - t_s[0];
    if (tDur <= 0) return z_m[0];
    const tLoop = t_s[0] + (t % tDur);
    let lo = 0;
    let hi = t_s.length - 1;
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      if (tLoop < t_s[mid]) hi = mid;
      else lo = mid;
    }
    const t0 = t_s[lo];
    const t1 = t_s[hi];
    const z0 = z_m[lo];
    const z1 = z_m[hi];
    if (t1 === t0) return z0;
    return z0 + ((z1 - z0) * (tLoop - t0)) / (t1 - t0);
  }

  private eta(xM: number, t: number, omega: number, k: number): number {
    return (this.Hm0 / 2) * Math.cos(k * xM - omega * t);
  }

  /** Contexto con parámetros vivos + helpers del motor, re-creado a demanda. */
  private contexto(): ContextoEscena3D {
    return {
      Hm0: this.Hm0,
      Te: this.Te,
      Bpto: this.Bpto,
      k: this.k,
      lambda: this.lambda,
      velocidadCorriente: this.velocidadCorriente,
      rangoMarea: this.rangoMarea,
      cimentacion: this.cimentacion,
      cantidadUnidades: this.cantidadUnidades,
      modoEmbalse: this.modoEmbalse,
      dispositivo: this.dispositivo,
      modoEnergia: this.modoEnergia,
      series: this.series,
      calidadBaja: this.calidadBaja,
      mat: crearMat,
      hacerEtiqueta: crearEtiqueta,
      pintarEtiqueta,
      muestrearSerie: (t) => this.muestrearSerie(t),
      eta: (x, t, omega, k) => this.eta(x, t, omega, k),
    };
  }

  /** Escena según dispositivo / modo: embalse→dique, mareomotriz→granja, resto→absorbedor. */
  private elegirEscena(): Escena3D {
    if (this.dispositivo === "embalse") return escenaDique;
    if (this.modoEnergia === "mareomotriz") return escenaGranja;
    return escenaAbsorbedor;
  }

  private limpiar() {
    if (this.raiz) {
      this.scene.remove(this.raiz);
      this.raiz.traverse((o: THREE.Object3D) => {
        const m = o as THREE.Mesh;
        if (m.isMesh) {
          m.geometry?.dispose?.();
          const mat = m.material as THREE.Material | THREE.Material[];
          if (Array.isArray(mat)) mat.forEach((x) => x.dispose?.());
          else mat?.dispose?.();
        }
      });
      this.raiz = null;
    }
    for (const sp of this.etiquetas) {
      this.grupoEtiquetas.remove(sp);
      const datos = sp.userData as Record<string, unknown>;
      (datos.etiquetaTex as THREE.Texture | undefined)?.dispose?.();
      (sp.material as THREE.SpriteMaterial | undefined)?.dispose?.();
    }
    this.etiquetas = [];
    this.manijas = manijasVacias();
  }

  /** Pasa los rótulos de la escena al grupo de cámara y guarda su ancla. */
  private recogerEtiquetas(g: THREE.Group) {
    const encontradas: THREE.Sprite[] = [];
    g.updateMatrixWorld(true);
    g.traverse((o: THREE.Object3D) => {
      const sp = o as THREE.Sprite;
      if (sp.isSprite && o.userData?.esEtiqueta) encontradas.push(sp);
    });
    for (const sp of encontradas) {
      const ancla = sp.userData.ancla as THREE.Vector3 | undefined;
      sp.getWorldPosition(ancla ?? new THREE.Vector3());
      this.grupoEtiquetas.add(sp);
      this.etiquetas.push(sp);
    }
  }

  private construir() {
    this.limpiar();
    this.escena = this.elegirEscena();
    // El contexto va primero: algunas escenas adaptan su encuadre al número
    // de unidades o al modo.
    const ctx = this.contexto();
    const enc = this.escena.encuadre(ctx);
    this.encuadre = enc;
    this.scene.background = new THREE.Color(enc.fondo);
    this.scene.fog = new THREE.Fog(enc.fondo, enc.niebla.near, enc.niebla.far);
    // Limpia environment de la escena anterior; la escena nueva puede reponerlo.
    this.scene.environment = null;
    this.escena.configurarEscena?.(this.scene);

    const g = new THREE.Group();
    this.raiz = g;
    this.scene.add(g);

    // Suelo y red de tierra compartidos, salvo que la escena los gestione
    // (la granja de corriente los omite: estropean el encuadre de la referencia).
    if (!this.escena.omiteEntornoTierra) {
      g.add(crearLecho(this.modoEnergia, this.dispositivo));
      crearRedElectrica(g);
    }

    this.manijas = this.escena.construir(g, ctx);
    this.recogerEtiquetas(g);
    this.ajustar();
  }

  private ajustar() {
    const w = Math.max(2, this.contenedor.clientWidth || 800);
    const h = Math.max(2, this.contenedor.clientHeight || 400);
    this.renderer.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    // La UI flotante cambia de tamaño con el lienzo: se vuelve a medir.
    this.zonasMedidasMs = 0;
    this.aplicarEncuadre();
  }

  /**
   * Coloca la cámara a la distancia justa para que la esfera declarada por la
   * escena quepa entera (con margen) en el aspecto actual. En 21:9 manda el
   * alto; en un lienzo estrecho manda el ancho. Nunca se acerca más que el
   * encuadre autoral.
   */
  private aplicarEncuadre() {
    const enc = this.encuadre;
    if (!enc) return;
    const fovV = (this.camera.fov * Math.PI) / 180;
    const aspecto = Math.max(0.2, this.camera.aspect || 1);
    const fovH = 2 * Math.atan(Math.tan(fovV / 2) * aspecto);
    const radio = Math.max(0.5, enc.radio ?? 8);
    const margen = Math.max(1, enc.margen ?? 1.1);
    const distV = radio / Math.sin(fovV / 2);
    const distH = radio / Math.sin(fovH / 2);
    const necesaria = Math.max(distV, distH) * margen;

    const look = new THREE.Vector3(enc.lookAt.x, enc.lookAt.y, enc.lookAt.z);
    const dir = new THREE.Vector3(
      enc.posicion.x - look.x,
      enc.posicion.y - look.y,
      enc.posicion.z - look.z
    );
    const base = dir.length() || 1;
    dir.normalize();
    const dist = Math.max(base, necesaria);
    this.camera.position.copy(look).addScaledVector(dir, dist);
    this.camera.lookAt(look);
    this.camera.updateMatrixWorld();
  }

  /** Oleaje sobre la malla de mar que la escena haya dejado en manijas. */
  private animarOleaje(t: number) {
    const { mar, marBase, marAncho } = this.manijas;
    if (!mar || !marBase) return;
    const omega = (2 * Math.PI) / (this.Te > 0 ? this.Te : 7);
    const k = this.k > 0 ? this.k : 0.08;
    const pos = mar.geometry.attributes.position as THREE.BufferAttribute;
    const arr = pos.array as Float32Array;
    const dominio = this.lambda > 0 ? 2.2 * this.lambda : 120;
    const ampSec = (this.Hm0 / 2) * 0.2;
    for (let i = 0; i < pos.count; i++) {
      const bx = marBase[i * 3];
      const bz = marBase[i * 3 + 2];
      const xM = (bx / marAncho) * dominio;
      // Ola principal (la del modelo) + mar de fondo corto: superficie viva
      // sin cambiar la física que mueve al dispositivo.
      const chop =
        ampSec *
        Math.cos(0.62 * k * xM + 0.4 * k * bz - 1.35 * omega * t + 1.6);
      arr[i * 3 + 1] = marBase[i * 3 + 1] + this.eta(xM, t, omega, k) + chop;
    }
    pos.needsUpdate = true;
    mar.geometry.computeVertexNormals();
    actualizarNivelAgua(mar, mar.position.y, this.Hm0 / 2, t);
  }

  /** Pulso de energía a lo largo del cable de evacuación. */
  private animarPulso(t: number) {
    const { pulso, pulsoCurva } = this.manijas;
    if (!pulso || !pulsoCurva) return;
    const f = (t * 0.22) % 1;
    pulsoCurva.getPointAt(f, pulso.position);
  }

  dibujar(t: number) {
    this.animarOleaje(t);
    this.escena.animar(t, this.contexto(), this.manijas);
    this.animarPulso(t);
    this.disponerRotulos();
    this.renderer.render(this.scene, this.camera);
  }

  /**
   * Mide los controles que flotan sobre la escena (conmutador 2D/3D, minimapa
   * y pausa) para que ningún rótulo quede debajo. Se cachea ~400 ms: el
   * minimapa se pliega/despliega sin cambiar el tamaño del lienzo.
   */
  private medirZonasRotulos(w: number, h: number) {
    const ahora =
      typeof performance !== "undefined" ? performance.now() : Date.now();
    if (this.zonasRotulos.length && ahora - this.zonasMedidasMs < 400) return;
    this.zonasMedidasMs = ahora;
    const caja = this.contenedor.getBoundingClientRect();
    const raiz: ParentNode =
      (this.contenedor.closest?.(".simulacion-escena") as HTMLElement | null) ??
      (this.contenedor.closest?.(".escena") as HTMLElement | null) ??
      document;
    const medir = (sel: string): ZonaReservadaPx | null => {
      const el = raiz.querySelector(sel) as HTMLElement | null;
      if (!el) return null;
      const r = el.getBoundingClientRect();
      if (r.width < 2 || r.height < 2) return null;
      return { x: r.left - caja.left, y: r.top - caja.top, w: r.width, h: r.height };
    };
    const esMovil = typeof window !== "undefined" && window.innerWidth < 768;
    this.zonasRotulos = [
      medir(".escena-modo") ?? { x: 12, y: 12, w: 110, h: 40 },
      medir(".mapa-flotante") ??
        (esMovil
          ? { x: w - 8 - 210, y: 8, w: 210, h: 40 }
          : { x: w - 12 - 300, y: 12, w: 300, h: 240 }),
      medir(".escena-acciones") ?? { x: 12, y: h - 12 - 40, w: 90, h: 40 },
    ];
  }

  /** Rótulos: tamaño en píxeles CSS, dentro del lienzo y fuera de la UI. */
  private disponerRotulos() {
    if (!this.etiquetas.length) return;
    const w = Math.max(2, this.contenedor.clientWidth || 800);
    const h = Math.max(2, this.contenedor.clientHeight || 400);
    this.medirZonasRotulos(w, h);
    disponerEtiquetas(this.etiquetas, this.camera, w, h, {
      franjaSuperiorPx: 56,
      zonas: this.zonasRotulos,
      separacionPx: 6,
      ocultarSiNoCabe: true,
    });
  }

  /** Degrada calidad visual sin tocar la respuesta: pixelRatio a 1, sombras
   *  fuera y mar con menos segmentos (fondo según escena.marFondo). Idempotente. */
  degradarCalidad() {
    this.calidadBaja = true;
    try {
      this.renderer.setPixelRatio(1);
    } catch {
      /* lienzo ya liberado */
    }
    this.renderer.shadowMap.enabled = false;
    const { mar } = this.manijas;
    if (!mar || !this.raiz) return;
    const y = mar.position.y;
    const x = mar.position.x;
    const z = mar.position.z;
    const ancho = this.manijas.marAncho;
    const fondo =
      this.escena.marFondo?.(ancho) ?? (ancho >= 50 ? 24 : ancho >= 38 ? 16 : 14);
    this.raiz.remove(mar);
    mar.geometry?.dispose?.();
    const mat = mar.material as THREE.Material | THREE.Material[];
    if (Array.isArray(mat)) mat.forEach((m) => m.dispose?.());
    else mat?.dispose?.();
    const nuevo = crearSuperficieMar(ancho, fondo, 0, true, {
      color: this.encuadre?.fondo ?? 0xb4cedc,
      near: this.encuadre?.niebla.near ?? 30,
      far: this.encuadre?.niebla.far ?? 105,
    });
    // La escena puede tener uniformes propios (p. ej. la ventana del dique).
    this.escena.configurarMar?.(nuevo.malla);
    nuevo.malla.position.y = y;
    nuevo.malla.position.x = x;
    nuevo.malla.position.z = z;
    this.raiz.add(nuevo.malla);
    this.manijas.mar = nuevo.malla;
    this.manijas.marBase = nuevo.base;
    this.manijas.marAncho = nuevo.ancho;
    if (this.manijas.nivelMar) this.manijas.nivelMar = nuevo.malla;
  }

  arrancar() {
    this.ajustar();
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
      try {
        this.onFrame?.(typeof performance !== "undefined" ? performance.now() : Date.now());
      } catch {
        /* el monitor no detiene la escena */
      }
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

  liberar() {
    this.detener();
    try {
      this.renderer.dispose();
      this.renderer.domElement.remove();
    } catch {
      /* ya liberado */
    }
  }
}
