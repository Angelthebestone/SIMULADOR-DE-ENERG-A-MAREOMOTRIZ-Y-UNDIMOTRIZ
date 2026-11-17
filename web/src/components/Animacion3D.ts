// Animacion3D — motor Three.js. Elige la escena (dique / absorbedor / granja),
// construye el grafo a través de Escena3D.construir y en cada fotograma anima
// el oleaje genérico + lo que la escena indique en Escena3D.animar.
// Misma API pública que usa Ver.vue: constructor, cargarSimulacion, arrancar,
// pausar, reanudar, detener, liberar, degradarCalidad, dibujar, onFrame.

// @ts-ignore — three se empaqueta por Vite sin @types (build verificado)
import * as THREE from "three";
import type {
  ContextoEscena3D,
  Escena3D,
  ManijasEscena3D,
  ModoEnergia3D,
  Payload3D,
  TipoCimentacion3D,
} from "./animacion3d/tipos";
import { manijasVacias, PROFUNDIDAD_M_3D } from "./animacion3d/tipos";
import {
  crearEtiqueta,
  crearLecho,
  crearMat,
  crearRedElectrica,
  crearSuperficieMar,
  pintarEtiqueta,
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

  constructor(contenedor: HTMLElement) {
    this.contenedor = contenedor;
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    const ancho = Math.max(2, contenedor.clientWidth || 800);
    const alto = Math.max(2, contenedor.clientHeight || 400);
    this.renderer.setSize(ancho, alto);
    this.renderer.domElement.style.display = "block";
    this.renderer.domElement.style.width = "100%";
    this.renderer.domElement.style.height = "100%";
    // ACES + sRGB: evita el lavado de colores del tonemap lineal por defecto.
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.15;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    contenedor.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x0e2a3a);
    this.scene.fog = new THREE.Fog(0x0e2a3a, 40, 90);

    this.camera = new THREE.PerspectiveCamera(45, ancho / alto, 0.1, 300);
    this.camera.position.set(0, 9, 24);
    this.camera.lookAt(0, -1, 0);

    const hemi = new THREE.HemisphereLight(0xe8f4f8, 0x2a4a5a, 1.15);
    this.scene.add(hemi);
    const sol = new THREE.DirectionalLight(0xfff4e0, 1.85);
    sol.position.set(12, 20, 10);
    sol.castShadow = true;
    sol.shadow.mapSize.set(1024, 1024);
    this.scene.add(sol);
    // Relleno suave desde el otro lado: evita que el metal quede a manchas.
    const relleno = new THREE.DirectionalLight(0xc5dff0, 0.55);
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
    this.manijas = manijasVacias();
  }

  private construir() {
    this.limpiar();
    this.escena = this.elegirEscena();
    const enc = this.escena.encuadre();
    this.camera.position.set(enc.posicion.x, enc.posicion.y, enc.posicion.z);
    this.camera.lookAt(enc.lookAt.x, enc.lookAt.y, enc.lookAt.z);
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

    const ctx = this.contexto();
    this.manijas = this.escena.construir(g, ctx);
  }

  private ajustar() {
    const w = Math.max(2, this.contenedor.clientWidth || 800);
    const h = Math.max(2, this.contenedor.clientHeight || 400);
    this.renderer.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  /** Oleaje eta(x,t) sobre la malla de mar que la escena haya dejado en manijas. */
  private animarOleaje(t: number) {
    const { mar, marBase, marAncho } = this.manijas;
    if (!mar || !marBase) return;
    const omega = (2 * Math.PI) / (this.Te > 0 ? this.Te : 7);
    const k = this.k > 0 ? this.k : 0.08;
    const pos = mar.geometry.attributes.position as THREE.BufferAttribute;
    const arr = pos.array as Float32Array;
    const dominio = this.lambda > 0 ? 2.2 * this.lambda : 120;
    for (let i = 0; i < pos.count; i++) {
      const bx = marBase[i * 3];
      const xM = (bx / marAncho) * dominio;
      arr[i * 3 + 1] = marBase[i * 3 + 1] + this.eta(xM, t, omega, k);
    }
    pos.needsUpdate = true;
    mar.geometry.computeVertexNormals();
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
    this.renderer.render(this.scene, this.camera);
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
    const ancho = this.manijas.marAncho;
    const fondo =
      this.escena.marFondo?.(ancho) ?? (ancho >= 50 ? 24 : ancho >= 38 ? 16 : 14);
    this.raiz.remove(mar);
    mar.geometry?.dispose?.();
    const mat = mar.material as THREE.Material | THREE.Material[];
    if (Array.isArray(mat)) mat.forEach((m) => m.dispose?.());
    else mat?.dispose?.();
    const nuevo = crearSuperficieMar(ancho, fondo, 0, true);
    nuevo.malla.position.y = y;
    nuevo.malla.position.x = x;
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
