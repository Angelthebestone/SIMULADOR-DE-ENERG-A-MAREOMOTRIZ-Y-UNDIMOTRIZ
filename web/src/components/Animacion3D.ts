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
  crearEtiqueta,
  crearMat,
  disponerEtiquetas,
  pintarEtiqueta,
  type ZonaReservadaPx,
} from "./animacion3d/utilidades";
import { Ambiente, UNIFORMES_MAR } from "./animacion3d/ambiente";
import { escenaAbsorbedor } from "./animacion3d/escenas/absorbedor";
import { escenaDique } from "./animacion3d/escenas/dique";
import { escenaGranja } from "./animacion3d/escenas/granja";

export { PROFUNDIDAD_M_3D };

/** Metros reales por unidad de mundo en horizontal (30 m de calado ≈ 6 u). */
const M_POR_UNIDAD = 4.8;
const SOL_POR_DEFECTO = { x: 0.62, y: 0.58, z: 0.42 };
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
  private ambiente: Ambiente;
  private sol: THREE.DirectionalLight;
  /** Lo que obliga a reconstruir la geometría (el resto se anima en vivo). */
  private firma = "";
  private tPrevio = 0;
  /** Resolución adaptativa: fracción del pixelRatio base que se renderiza. */
  private dprBase = 1;
  private escalaRes = 1;
  private ventanaMs: number[] = [];
  private marcaPrevia = 0;
  private ventanasHolgadas = 0;
  private escalaAntesDeSubir = 0;
  private vetoSubidaHasta = 0;
  private tBase = 0;
  private dt = 0;

  constructor(contenedor: HTMLElement) {
    this.contenedor = contenedor;
    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: false,
      powerPreference: "high-performance",
    });
    this.dprBase = Math.min(window.devicePixelRatio || 1, 2);
    this.renderer.setPixelRatio(this.dprBase);
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
    this.renderer.toneMappingExposure = 0.92;
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

    // La luz ambiente la da el cielo horneado (entorno PMREM); el sol aporta
    // la direccional y las sombras.
    this.ambiente = new Ambiente(this.renderer, false);
    this.sol = new THREE.DirectionalLight(new THREE.Color(1.0, 0.95, 0.86), 2.6);
    this.sol.castShadow = true;
    this.sol.shadow.mapSize.set(1024, 1024);
    this.sol.shadow.bias = -0.0004;
    this.sol.shadow.normalBias = 0.03;
    this.scene.add(this.sol);
    this.scene.add(this.sol.target);

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
    // Los mandos (Hm0, Te, corriente, rango…) se leen en cada fotograma: solo
    // se rehace la geometría si cambia la escena o su estructura. Así el
    // arrastre de un deslizador no reinicia el oleaje.
    if (this.firmaActual() !== this.firma) this.construir();
    this.dibujar(this.tPrevio);
  }

  private firmaActual(): string {
    return [
      this.dispositivo === "embalse" ? "dique" : this.modoEnergia,
      this.cantidadUnidades,
      this.cimentacion,
      this.modoEmbalse,
      this.calidadBaja,
    ].join("|");
  }

  private muestrearSerie(t: number): number | null {
    if (!this.series) return null;
    const { t_s, z_m } = this.series;
    const tDur = t_s[t_s.length - 1] - t_s[0];
    if (tDur <= 0) return z_m[0];
    // Bucle sobre los últimos 10 periodos: régimen permanente, sin el
    // arranque desde el reposo y sin salto al repetir (10 periodos enteros).
    const ventana = this.Te > 0 && tDur > 10 * this.Te ? 10 * this.Te : tDur;
    const tLoop = t_s[t_s.length - 1] - ventana + (t % ventana);
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
      dt: this.dt,
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
        // Mallas, líneas y nubes de puntos.
        const m = o as THREE.Mesh;
        if (!m.geometry) return;
        m.geometry.dispose?.();
        const mats = Array.isArray(m.material) ? m.material : [m.material];
        for (const x of mats as THREE.MeshStandardMaterial[]) {
          // Las texturas compartidas viven en caché; solo se sueltan los clones.
          if (x?.map?.userData?.desechable) x.map.dispose();
          x?.dispose?.();
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
    this.firma = this.firmaActual();
    this.escena = this.elegirEscena();
    // El contexto va primero: algunas escenas adaptan su encuadre al número
    // de unidades o al modo.
    const ctx = this.contexto();
    const enc = this.escena.encuadre(ctx);
    this.encuadre = enc;
    const horizonte = new THREE.Color(enc.fondo);
    this.scene.fog = new THREE.Fog(enc.fondo, enc.niebla.near, enc.niebla.far);
    const s = enc.sol ?? SOL_POR_DEFECTO;
    const dirSol = new THREE.Vector3(s.x, s.y, s.z).normalize();
    this.ambiente.aplicar(this.scene, dirSol, horizonte);

    // Sombras: la caja de la luz abraza la esfera de la escena.
    const centro = new THREE.Vector3(enc.lookAt.x, enc.lookAt.y, enc.lookAt.z);
    const r = (enc.radio ?? 8) * 1.35;
    this.sol.position.copy(centro).addScaledVector(dirSol, 60);
    this.sol.target.position.copy(centro);
    const cam = this.sol.shadow.camera;
    cam.left = -r;
    cam.right = r;
    cam.top = r;
    cam.bottom = -r;
    cam.near = 1;
    cam.far = 140;
    cam.updateProjectionMatrix();

    // Cada escena parte de un mar sin embalse; el dique fija el suyo.
    UNIFORMES_MAR.uDivisorZ.value = -1e6;
    UNIFORMES_MAR.uTurbidez.value = 1;
    UNIFORMES_MAR.uCorteX.value = 1e6;

    const g = new THREE.Group();
    this.raiz = g;
    this.scene.add(g);
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
    const tam = this.renderer.getDrawingBufferSize(new THREE.Vector2());
    UNIFORMES_MAR.uPxPorUnidad.value =
      tam.y / (2 * Math.tan((this.camera.fov * Math.PI) / 360));
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

  /**
   * Ola del modelo hacia la GPU: misma eta(x,t) que el corte 2D. La longitud
   * de onda se dibuja a la escala horizontal de la escena, acotada para que
   * siempre quepa al menos una cresta en el encuadre.
   */
  private actualizarMar(t: number) {
    const omega = (2 * Math.PI) / (this.Te > 0 ? this.Te : 7);
    const lambdaM = this.lambda > 0 ? this.lambda : 80;
    const lambdaMundo = Math.max(12, Math.min(70, lambdaM / M_POR_UNIDAD));
    const escala = this.encuadre?.escalaOla ?? 1;
    UNIFORMES_MAR.uTiempo.value = t;
    UNIFORMES_MAR.uOla.value.set(
      (this.Hm0 / 2) * escala,
      (2 * Math.PI) / lambdaMundo,
      omega
    );
    const y = this.manijas.mar?.position.y ?? 0;
    UNIFORMES_MAR.uNiveles.value.set(y, y);
  }

  /** Pulso de energía a lo largo del cable de evacuación. */
  private animarPulso(t: number) {
    const { pulso, pulsoCurva } = this.manijas;
    if (!pulso || !pulsoCurva) return;
    const f = (t * 0.22) % 1;
    pulsoCurva.getPointAt(f, pulso.position);
  }

  dibujar(t: number) {
    this.dt = Math.max(0, Math.min(0.1, t - this.tPrevio));
    this.tPrevio = t;
    this.actualizarMar(t);
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
    // En un lienzo pequeño solo caben los rótulos que explican la física;
    // el resto taparía la escena.
    const tope = h < 300 || w < 520 ? 2 : h < 440 ? 3 : 99;
    const visibles = this.etiquetas.filter((sp) => {
      const cabe = ((sp.userData.prioridad as number | undefined) ?? 5) <= tope;
      if (!cabe) sp.visible = false;
      return cabe;
    });
    disponerEtiquetas(visibles, this.camera, w, h, {
      franjaSuperiorPx: 56,
      zonas: this.zonasRotulos,
      separacionPx: 6,
      ocultarSiNoCabe: true,
    });
  }

  /** Degrada calidad visual sin tocar la respuesta: pixelRatio a 1, sin
   *  sombras y geometría, agua y partículas en su versión ligera. Idempotente. */
  degradarCalidad() {
    if (this.calidadBaja) return;
    this.calidadBaja = true;
    this.dprBase = 1;
    try {
      this.renderer.setPixelRatio(this.escalaRes);
    } catch {
      /* lienzo ya liberado */
    }
    this.renderer.shadowMap.enabled = false;
    this.construir();
  }

  /**
   * Mantiene el ritmo en GPU integradas bajando la resolución de render (no
   * la geometría ni la física) cuando el fotograma medio pasa de ~21 ms, y la
   * recupera con cautela cuando sobra tiempo. Va antes que el monitor de la
   * vista, que solo actúa por debajo de 30 fps.
   */
  private gobernarResolucion(ahora: number) {
    const dt = ahora - this.marcaPrevia;
    this.marcaPrevia = ahora;
    // Pestaña en segundo plano o compilación de shaders: no es ritmo real.
    if (dt <= 0 || dt > 250) {
      this.ventanaMs.length = 0;
      return;
    }
    this.ventanaMs.push(dt);
    if (this.ventanaMs.length < 24) return;
    const media = this.ventanaMs.reduce((a, b) => a + b, 0) / this.ventanaMs.length;
    this.ventanaMs.length = 0;

    let escala = this.escalaRes;
    if (media > 21.5) {
      this.ventanasHolgadas = 0;
      if (this.escalaAntesDeSubir > 0) {
        // La subida de prueba no se sostuvo: se vuelve y no se reintenta pronto.
        escala = this.escalaAntesDeSubir;
        this.vetoSubidaHasta = ahora + 30_000;
      } else {
        escala *= Math.max(0.7, Math.min(0.93, Math.sqrt(18.5 / media)));
      }
    } else if (media < 17.6 && escala < 1 && ahora > this.vetoSubidaHasta) {
      this.ventanasHolgadas += 1;
      if (this.ventanasHolgadas >= 8) {
        this.ventanasHolgadas = 0;
        this.escalaAntesDeSubir = escala;
        escala = Math.min(1, escala * 1.12);
        this.aplicarEscalaRes(escala);
        return;
      }
    }
    this.escalaAntesDeSubir = 0;
    this.aplicarEscalaRes(Math.max(0.5, escala));
  }

  private aplicarEscalaRes(escala: number) {
    if (Math.abs(escala - this.escalaRes) < 0.01) return;
    this.escalaRes = escala;
    this.renderer.setPixelRatio(this.dprBase * escala);
    this.ajustar();
  }

  arrancar() {
    this.ajustar();
    this.dibujar(this.tPrevio);
    // Ver.vue llama a arrancar en cada cambio de mando: un solo bucle.
    if (this.rafId !== null) cancelAnimationFrame(this.rafId);
    this.rafId = null;
    this.t0 = null;
    this.iniciar();
  }

  iniciar() {
    if (this.pausado) return;
    const loop = (now: number) => {
      if (this.pausado) return;
      // El reloj sigue donde se quedó: ni pausar ni mover un mando hacen
      // saltar la escena.
      if (this.t0 === null) {
        this.t0 = now;
        this.tBase = this.tPrevio;
      }
      const t = this.tBase + (now - this.t0) / 1000;
      this.dibujar(t);
      this.gobernarResolucion(now);
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
    this.t0 = null;
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

  liberar() {
    this.detener();
    try {
      this.limpiar();
      this.ambiente.liberar();
      this.renderer.dispose();
      this.renderer.domElement.remove();
    } catch {
      /* ya liberado */
    }
  }
}
