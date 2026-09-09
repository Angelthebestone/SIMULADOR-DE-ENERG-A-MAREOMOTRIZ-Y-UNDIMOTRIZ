// Animacion3D — motor Three.js empaquetado por Vite, mismo contrato que AnimacionCanvas.
// Una transferencia por simulacion: cargarSimulacion(payload) + bucle requestAnimationFrame.
// Tres escenas minimas pero legibles: dique mareal, absorbedor puntual y granja de
// turbinas de corriente. Sin red, sin calculo fisico por fotograma: solo interpola
// la serie ya integrada y evalua eta(x,t) = (Hm0/2)*cos(k*x - omega*t).

// @ts-ignore — three se empaqueta por Vite sin @types (build verificado)
import * as THREE from "three";
import { formatearNumero } from "../utils/formato";

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
  private mar: THREE.Mesh | null = null;
  private marBase: Float32Array | null = null;
  private marAncho = 34;
  private rotores: THREE.Group[] = [];
  private flotador: THREE.Mesh | null = null;
  private mastil: THREE.Mesh | null = null;
  private nivelEmbalse: THREE.Mesh | null = null;
  private nivelMar: THREE.Mesh | null = null;
  private flechaLlenado: THREE.ArrowHelper | null = null;
  private flechaVaciado: THREE.ArrowHelper | null = null;
  private etiquetaSalto: THREE.Sprite | null = null;
  private etiquetaCiclo: THREE.Sprite | null = null;
  private etiquetaDispositivo: THREE.Sprite | null = null;
  private pulso: THREE.Mesh | null = null;
  private pulsoCurva: THREE.CatmullRomCurve3 | null = null;
  private ultimoTextoSalto = "";
  private ultimoTextoCiclo = "";

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
    contenedor.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x0e2a3a);
    this.scene.fog = new THREE.Fog(0x0e2a3a, 40, 90);

    this.camera = new THREE.PerspectiveCamera(45, ancho / alto, 0.1, 300);
    this.camera.position.set(0, 9, 24);
    this.camera.lookAt(0, -1, 0);

    const hemi = new THREE.HemisphereLight(0xdff2f5, 0x1c3a4a, 0.95);
    this.scene.add(hemi);
    const sol = new THREE.DirectionalLight(0xfff6e0, 1.6);
    sol.position.set(10, 18, 8);
    sol.castShadow = true;
    sol.shadow.mapSize.set(1024, 1024);
    this.scene.add(sol);

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

  // ---- Construccion ------------------------------------------------------

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
    this.mar = null;
    this.marBase = null;
    this.rotores = [];
    this.flotador = null;
    this.mastil = null;
    this.nivelEmbalse = null;
    this.nivelMar = null;
    this.flechaLlenado = null;
    this.flechaVaciado = null;
    this.etiquetaSalto = null;
    this.etiquetaCiclo = null;
    this.etiquetaDispositivo = null;
    this.pulso = null;
    this.pulsoCurva = null;
    this.ultimoTextoSalto = "";
    this.ultimoTextoCiclo = "";
  }

  private construir() {
    this.limpiar();
    const g = new THREE.Group();
    this.raiz = g;
    this.scene.add(g);
    this.agregarLecho(g);
    if (this.dispositivo === "embalse") this.buildDique(g);
    else if (this.modoEnergia === "mareomotriz") this.buildGranja(g);
    else this.buildAbsorbedor(g);
    this.agregarRedElectrica(g);
  }

  private mat(color: number, extra: Partial<THREE.MeshStandardMaterialParameters> = {}) {
    return new THREE.MeshStandardMaterial({ color, roughness: 0.75, metalness: 0.08, ...extra });
  }

  private agregarLecho(g: THREE.Group) {
    const geo = new THREE.BoxGeometry(44, 1.2, 16);
    const lecho = new THREE.Mesh(geo, this.mat(0x8a7a5a));
    lecho.position.set(0, -6.6, 0);
    lecho.receiveShadow = true;
    g.add(lecho);
  }

  private agregarRedElectrica(g: THREE.Group) {
    // Centro de transformacion en tierra (derecha) + linea de postes a borde.
    const tierra = new THREE.Mesh(new THREE.BoxGeometry(8, 3.4, 10), this.mat(0x9aa3a8));
    tierra.position.set(17, -4.2, -2);
    tierra.castShadow = true;
    g.add(tierra);
    const sub = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1.4, 1.6), this.mat(0x3c4a55));
    sub.position.set(15.6, -1.8, -2);
    sub.castShadow = true;
    g.add(sub);
    for (let i = 0; i < 3; i++) {
      const poste = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.11, 5, 8), this.mat(0x2c3840));
      poste.position.set(8 + i * 3.4, 0.4, -4.5);
      g.add(poste);
      const cruceta = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.1, 0.1), this.mat(0x2c3840));
      cruceta.position.set(8 + i * 3.4, 2.4, -4.5);
      g.add(cruceta);
    }
    const pts = [new THREE.Vector3(4, 2.4, -4.5), new THREE.Vector3(22, 2.6, -4.5)];
    const linea = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints(pts),
      new THREE.LineBasicMaterial({ color: 0x222222 })
    );
    g.add(linea);
  }

  private superficieMar(ancho: number, fondo: number, y: number): THREE.Mesh {
    const nx = this.calidadBaja ? 24 : 48;
    const nz = this.calidadBaja ? 6 : 12;
    const geo = new THREE.PlaneGeometry(ancho, fondo, nx, nz);
    geo.rotateX(-Math.PI / 2);
    const m = new THREE.Mesh(
      geo,
      new THREE.MeshPhongMaterial({
        color: 0x2e8b9a,
        transparent: true,
        opacity: 0.82,
        shininess: 90,
        flatShading: false,
        side: THREE.DoubleSide,
      })
    );
    m.position.y = y;
    m.receiveShadow = true;
    this.mar = m;
    this.marAncho = ancho;
    this.marBase = (geo.attributes.position.array as Float32Array).slice();
    return m;
  }

  private volumenBajo(g: THREE.Group, ancho: number, alto: number, fondo: number, y: number) {
    const vol = new THREE.Mesh(
      new THREE.BoxGeometry(ancho, alto, fondo),
      new THREE.MeshPhongMaterial({ color: 0x14495a, transparent: true, opacity: 0.45 })
    );
    vol.position.y = y;
    g.add(vol);
  }

  // (a) Dique mareal: corte transversal mar/embalse con niveles distintos.
  private buildDique(g: THREE.Group) {
    // Cuerpo del dique al centro.
    const cuerpo = new THREE.Mesh(new THREE.BoxGeometry(5, 7, 8), this.mat(0xb9bdc0));
    cuerpo.position.set(0, -3.2, 0);
    cuerpo.castShadow = true;
    cuerpo.receiveShadow = true;
    g.add(cuerpo);
    const coronacion = new THREE.Mesh(new THREE.BoxGeometry(5.6, 0.5, 8.4), this.mat(0x59636b));
    coronacion.position.set(0, 0.55, 0);
    g.add(coronacion);
    const central = new THREE.Mesh(new THREE.BoxGeometry(2.4, 1.4, 3), this.mat(0x46525c));
    central.position.set(0, 1.5, 0);
    central.castShadow = true;
    g.add(central);
    // Compuerta + conducto con turbina bulbo.
    const compuerta = new THREE.Mesh(new THREE.BoxGeometry(0.4, 2.2, 2.2), this.mat(0x7c8894));
    compuerta.position.set(-1.2, -2.2, 0);
    g.add(compuerta);
    const conducto = new THREE.Mesh(
      new THREE.CylinderGeometry(0.9, 0.9, 5.4, 16, 1, true),
      new THREE.MeshStandardMaterial({ color: 0x1d303c, roughness: 0.5, side: THREE.DoubleSide })
    );
    conducto.rotation.z = Math.PI / 2;
    conducto.position.set(0, -3.4, 0);
    g.add(conducto);
    const bulbo = new THREE.Mesh(new THREE.SphereGeometry(0.55, 14, 10), this.mat(0x39434d));
    bulbo.position.set(1.2, -3.4, 0);
    g.add(bulbo);
    const rotor = new THREE.Group();
    for (let i = 0; i < 4; i++) {
      const pala = new THREE.Mesh(new THREE.BoxGeometry(0.08, 1.0, 0.28), this.mat(0xc7e14a));
      pala.position.y = 0.55;
      const porta = new THREE.Group();
      porta.rotation.x = (i * Math.PI) / 2;
      porta.add(pala);
      rotor.add(porta);
    }
    rotor.rotation.z = Math.PI / 2;
    rotor.position.set(-0.4, -3.4, 0);
    g.add(rotor);
    this.rotores = [rotor];
    // Laminas: mar a la izquierda, embalse a la derecha, niveles distintos.
    const mar = this.superficieMar(17, 14, 0);
    mar.position.x = -12;
    g.add(mar);
    this.nivelMar = mar;
    this.volumenBajo(g, 17, 5.4, 14, -3.1);
    const emb = new THREE.Mesh(
      new THREE.PlaneGeometry(15, 14),
      new THREE.MeshPhongMaterial({ color: 0x3aa3b5, transparent: true, opacity: 0.8, side: THREE.DoubleSide })
    );
    emb.rotation.x = -Math.PI / 2;
    emb.position.set(11, 0.8, 0);
    g.add(emb);
    this.nivelEmbalse = emb;
    // Flechas de paso que invierten segun fase.
    this.flechaLlenado = new THREE.ArrowHelper(
      new THREE.Vector3(1, 0, 0),
      new THREE.Vector3(-4, -3.4, 2.6),
      4,
      0xc7e14a,
      0.8,
      0.5
    );
    this.flechaVaciado = new THREE.ArrowHelper(
      new THREE.Vector3(-1, 0, 0),
      new THREE.Vector3(4, -3.4, 2.6),
      4,
      0x7fd4e3,
      0.8,
      0.5
    );
    g.add(this.flechaLlenado);
    g.add(this.flechaVaciado);
    // Etiquetas: salto con valor en m en vivo + estado del ciclo + rotulo.
    this.etiquetaSalto = this.hacerEtiqueta("h 0,0 m");
    this.etiquetaSalto.position.set(0, 4.6, 0);
    g.add(this.etiquetaSalto);
    this.etiquetaCiclo = this.hacerEtiqueta("llenado");
    this.etiquetaCiclo.position.set(0, 3.4, 0);
    g.add(this.etiquetaCiclo);
    this.etiquetaDispositivo = this.hacerEtiqueta("Dique mareal");
    this.etiquetaDispositivo.position.set(0, 2.5, 0);
    g.add(this.etiquetaDispositivo);
    // Cable de evacuacion hacia el centro de transformacion.
    const curva = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, -3.2, 0),
      new THREE.Vector3(6, -5.4, -1),
      new THREE.Vector3(15.6, -2.4, -2),
    ]);
    const cable = new THREE.Mesh(
      new THREE.TubeGeometry(curva, 20, 0.09, 6, false),
      this.mat(0x222a30)
    );
    g.add(cable);
    this.pulsoCurva = curva;
    this.pulso = new THREE.Mesh(new THREE.SphereGeometry(0.22, 10, 8), this.mat(0xc7e14a));
    g.add(this.pulso);
  }

  // (b) Absorbedor puntual: flotador sobre mastil con movimiento relativo en vivo.
  private buildAbsorbedor(g: THREE.Group) {
    const mar = this.superficieMar(34, 14, 0);
    g.add(mar);
    this.volumenBajo(g, 34, 5.4, 14, -3.1);
    // Mastil fijo + placa de reaccion al fondo.
    const mastil = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 8.5, 12), this.mat(0x59636b));
    mastil.position.set(0, -2.2, 0);
    mastil.castShadow = true;
    g.add(mastil);
    this.mastil = mastil;
    const placa = new THREE.Mesh(new THREE.CylinderGeometry(1.8, 1.8, 0.3, 20), this.mat(0x39434d));
    placa.position.set(0, -5.6, 0);
    g.add(placa);
    // Flotador que desliza sobre el mastil.
    const flot = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.35, 1.6, 20), this.mat(0xc7e14a));
    flot.position.set(0, 0.6, 0);
    flot.castShadow = true;
    g.add(flot);
    this.flotador = flot;
    const baliza = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 1.4, 8), this.mat(0xd8d8d8));
    baliza.position.set(0, 2.1, 0);
    flot.add(baliza);
    const luz = new THREE.Mesh(
      new THREE.SphereGeometry(0.18, 10, 8),
      new THREE.MeshBasicMaterial({ color: 0xe2483d })
    );
    luz.position.set(0, 2.9, 0);
    flot.add(luz);
    // Amarre + cable a subestacion.
    const curva = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, -5.4, 0),
      new THREE.Vector3(7, -6.0, -1),
      new THREE.Vector3(15.6, -2.4, -2),
    ]);
    g.add(new THREE.Mesh(new THREE.TubeGeometry(curva, 20, 0.09, 6, false), this.mat(0x222a30)));
    this.pulsoCurva = curva;
    this.pulso = new THREE.Mesh(new THREE.SphereGeometry(0.22, 10, 8), this.mat(0xc7e14a));
    g.add(this.pulso);
    this.etiquetaDispositivo = this.hacerEtiqueta("Absorbedor puntual");
    this.etiquetaDispositivo.position.set(0, 4.4, 0);
    g.add(this.etiquetaDispositivo);
  }

  // (c) Granja de turbinas de corriente de eje horizontal.
  private buildGranja(g: THREE.Group) {
    const mar = this.superficieMar(38, 16, 1.6);
    g.add(mar);
    this.volumenBajo(g, 38, 5.4, 16, -1.6);
    const n = this.cantidadUnidades;
    const xs: number[] = [];
    for (let i = 0; i < n; i++) xs.push((i - (n - 1) / 2) * 7);
    const curvaPts: THREE.Vector3[] = [];
    xs.forEach((x, idx) => {
      // Cimentacion segun seleccion.
      if (this.cimentacion === "gravedad") {
        const bloque = new THREE.Mesh(new THREE.BoxGeometry(3.2, 1.2, 2.4), this.mat(0x59636b));
        bloque.position.set(x, -5.4, 0);
        bloque.castShadow = true;
        g.add(bloque);
      } else if (this.cimentacion === "tripode") {
        for (const s of [-1, 0, 1]) {
          const pata = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 3.4, 8), this.mat(0x59636b));
          pata.position.set(x + s * 1.1, -4.6, s * 0.7);
          pata.rotation.z = s * 0.35;
          g.add(pata);
        }
      } else {
        const pilote = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 2.6, 10), this.mat(0x59636b));
        pilote.position.set(x, -5.2, 0);
        g.add(pilote);
      }
      // Torre a superficie + plataforma.
      const torre = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.34, 6.4, 10), this.mat(0xb9bdc0));
      torre.position.set(x, -2.2, 0);
      torre.castShadow = true;
      g.add(torre);
      const plat = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.25, 1.4), this.mat(0x46525c));
      plat.position.set(x, 1.4, 0);
      g.add(plat);
      // Gondola + rotor tripala de eje horizontal.
      const gondola = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 1.8, 12), this.mat(0x39434d));
      gondola.rotation.z = Math.PI / 2;
      gondola.position.set(x, -2.4, 0);
      g.add(gondola);
      const rotor = new THREE.Group();
      for (let b = 0; b < 3; b++) {
        const pala = new THREE.Mesh(new THREE.BoxGeometry(0.22, 2.4, 0.1), this.mat(0xd8dee2));
        pala.position.y = 1.35;
        const porta = new THREE.Group();
        porta.rotation.x = (b * 2 * Math.PI) / 3;
        porta.add(pala);
        rotor.add(porta);
      }
      const buje = new THREE.Mesh(new THREE.SphereGeometry(0.32, 12, 10), this.mat(0xc7e14a));
      rotor.add(buje);
      rotor.position.set(x - 1.2, -2.4, 0);
      rotor.rotation.y = Math.PI / 2;
      g.add(rotor);
      this.rotores.push(rotor);
      curvaPts.push(new THREE.Vector3(x, -5.6, 0.8));
    });
    curvaPts.push(new THREE.Vector3(15.6, -2.4, -2));
    const curva = new THREE.CatmullRomCurve3(curvaPts);
    g.add(new THREE.Mesh(new THREE.TubeGeometry(curva, 30, 0.09, 6, false), this.mat(0x222a30)));
    this.pulsoCurva = curva;
    this.pulso = new THREE.Mesh(new THREE.SphereGeometry(0.22, 10, 8), this.mat(0xc7e14a));
    g.add(this.pulso);
    this.etiquetaDispositivo = this.hacerEtiqueta(`Granja · ${n} rotor${n > 1 ? "es" : ""}`);
    this.etiquetaDispositivo.position.set(0, 4.6, 0);
    g.add(this.etiquetaDispositivo);
  }

  // ---- Etiquetas (sprite con canvas-textura) ---------------------------------

  private hacerEtiqueta(texto: string): THREE.Sprite {
    const canvas = document.createElement("canvas");
    canvas.width = 256;
    canvas.height = 64;
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    const sp = new THREE.Sprite(
      new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false })
    );
    sp.scale.set(5.2, 1.3, 1);
    sp.userData.etiquetaCanvas = canvas;
    sp.userData.etiquetaTex = tex;
    this.pintarEtiqueta(sp, texto);
    return sp;
  }

  private pintarEtiqueta(sp: THREE.Sprite, texto: string) {
    const datos = sp.userData as unknown as { etiquetaCanvas: HTMLCanvasElement; etiquetaTex: THREE.CanvasTexture };
    const ctx = datos.etiquetaCanvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, datos.etiquetaCanvas.width, datos.etiquetaCanvas.height);
    ctx.fillStyle = "rgba(10,22,32,0.78)";
    ctx.beginPath();
    ctx.roundRect(4, 8, datos.etiquetaCanvas.width - 8, datos.etiquetaCanvas.height - 16, 8);
    ctx.fill();
    ctx.fillStyle = "#eef6f7";
    ctx.font = "600 26px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(texto, datos.etiquetaCanvas.width / 2, datos.etiquetaCanvas.height / 2 + 1);
    datos.etiquetaTex.needsUpdate = true;
  }

  /** Degrada calidad visual sin tocar la respuesta: pixelRatio a 1, sombras
   *  fuera y mar con menos segmentos. Idempotente. */
  degradarCalidad() {
    this.calidadBaja = true;
    try {
      this.renderer.setPixelRatio(1);
    } catch {
      /* lienzo ya liberado */
    }
    this.renderer.shadowMap.enabled = false;
    if (this.mar && this.raiz) {
      const y = this.mar.position.y;
      const x = this.mar.position.x;
      const ancho = this.marAncho;
      const esDique = this.dispositivo === "embalse";
      this.raiz.remove(this.mar);
      const nuevo = this.superficieMar(ancho, esDique ? 14 : this.marFondo(ancho), 0);
      nuevo.position.y = y;
      nuevo.position.x = esDique ? x : 0;
      this.raiz.add(nuevo);
      if (esDique) this.nivelMar = nuevo;
    }
  }

  private marFondo(ancho: number): number {
    return ancho >= 38 ? 16 : 14;
  }

  private ajustar() {
    const w = Math.max(2, this.contenedor.clientWidth || 800);
    const h = Math.max(2, this.contenedor.clientHeight || 400);
    this.renderer.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  dibujar(t: number) {
    const omega = (2 * Math.PI) / this.Te;
    const k = this.k > 0 ? this.k : 0.08;
    // Superficie eta(x,t) sobre la malla.
    if (this.mar && this.marBase) {
      const pos = this.mar.geometry.attributes.position as THREE.BufferAttribute;
      const arr = pos.array as Float32Array;
      const base = this.marBase;
      const dominio = this.lambda > 0 ? 2.2 * this.lambda : 120;
      for (let i = 0; i < pos.count; i++) {
        const bx = base[i * 3];
        const xM = (bx / this.marAncho) * dominio;
        arr[i * 3 + 1] = base[i * 3 + 1] + this.eta(xM, t, omega, k);
      }
      pos.needsUpdate = true;
      this.mar.geometry.computeVertexNormals();
    }
    if (this.dispositivo === "embalse") {
      const fase = Math.sin(t * 0.5);
      const salto = (this.rangoMarea / 2) * 0.9;
      if (this.nivelEmbalse) this.nivelEmbalse.position.y = fase * salto + 0.4;
      // Rotores del bulbo giran siempre; mas rapido con mas salto.
      for (const r of this.rotores) r.rotation.x += 0.04 + Math.abs(fase) * 0.12;
      const haciaEmbalse = fase > 0;
      if (this.flechaLlenado) this.flechaLlenado.visible = haciaEmbalse;
      if (this.flechaVaciado) this.flechaVaciado.visible = !haciaEmbalse;
      const saltoM = this.rangoMarea * Math.abs(fase) * 0.5;
      const txtSalto = `h ${formatearNumero(saltoM, 1)} m`;
      if (txtSalto !== this.ultimoTextoSalto && this.etiquetaSalto) {
        this.pintarEtiqueta(this.etiquetaSalto, txtSalto);
        this.ultimoTextoSalto = txtSalto;
      }
      const ciclo = this.textoCiclo(fase);
      if (ciclo !== this.ultimoTextoCiclo && this.etiquetaCiclo) {
        this.pintarEtiqueta(this.etiquetaCiclo, ciclo);
        this.ultimoTextoCiclo = ciclo;
      }
    } else if (this.modoEnergia === "mareomotriz") {
      const giro = this.velocidadCorriente * 2.1 * 0.016;
      for (const r of this.rotores) r.rotation.x += giro;
    } else {
      // Movimiento relativo flotador-mastil: muestrea la serie como el 2D.
      const z = this.muestrearSerie(t) ?? this.eta(0, t, omega, k) * 0.6;
      const freno = Math.max(0.3, Math.min(1.6, 80_000 / Math.max(10_000, this.Bpto)));
      const escala = Math.max(0.4, Math.min(2.2, this.Hm0 / Math.max(0.5, this.Te / 4))) * freno;
      if (this.flotador) this.flotador.position.y = z * escala * 1.4;
      if (this.mastil) this.mastil.position.y = -2.2 + Math.sin(t * 0.4) * 0.06;
    }
    if (this.pulso && this.pulsoCurva) {
      const f = (t * 0.22) % 1;
      this.pulsoCurva.getPointAt(f, this.pulso.position);
    }
    this.renderer.render(this.scene, this.camera);
  }

  private textoCiclo(fase: number): string {
    if (["llenado", "vaciado", "bidireccional", "bombeo"].includes(this.modoEmbalse))
      return this.modoEmbalse;
    if (this.modoEmbalse) return this.modoEmbalse;
    return fase >= 0 ? "llenado" : "vaciado";
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
