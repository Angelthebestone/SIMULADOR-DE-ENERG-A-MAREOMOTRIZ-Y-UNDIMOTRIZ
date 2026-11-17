// Utilidades puras de construcción 3D. Sin estado de clase: el motor o las
// escenas las llaman con los argumentos explícitos.

// @ts-ignore — three se empaqueta por Vite sin @types (build verificado)
import * as THREE from "three";
import type { MaterialEstandar3D, Malla3D, Sprite3D } from "./tipos";

export function crearMat(
  color: number,
  extra: Record<string, unknown> = {}
): MaterialEstandar3D {
  return new THREE.MeshStandardMaterial({
    color,
    roughness: 0.75,
    metalness: 0.08,
    ...(extra as THREE.MeshStandardMaterialParameters),
  });
}

export function crearEtiqueta(texto: string): Sprite3D {
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
  pintarEtiqueta(sp, texto);
  return sp;
}

export function pintarEtiqueta(sp: Sprite3D, texto: string) {
  const datos = sp.userData as unknown as {
    etiquetaCanvas: HTMLCanvasElement;
    etiquetaTex: THREE.CanvasTexture;
  };
  const ctx = datos.etiquetaCanvas.getContext("2d");
  if (!ctx) return;
  ctx.clearRect(0, 0, datos.etiquetaCanvas.width, datos.etiquetaCanvas.height);
  ctx.fillStyle = "rgba(10,22,32,0.78)";
  ctx.beginPath();
  ctx.roundRect(4, 8, datos.etiquetaCanvas.width - 8, datos.etiquetaCanvas.height - 16, 8);
  ctx.fill();
  ctx.fillStyle = "rgb(238 246 247)";
  ctx.font = "600 26px system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(texto, datos.etiquetaCanvas.width / 2, datos.etiquetaCanvas.height / 2 + 1);
  datos.etiquetaTex.needsUpdate = true;
}

/** Lámina de mar ondulada. Devuelve malla y la copia base de vértices. */
export function crearSuperficieMar(
  ancho: number,
  fondo: number,
  y: number,
  calidadBaja: boolean
): { malla: Malla3D; base: Float32Array; ancho: number } {
  // Más segmentos: el oleaje del motor deforma vértices; con pocos se ven
  // plegados tipo "cinta" en vez de ola.
  const nx = calidadBaja ? 36 : 72;
  const nz = calidadBaja ? 10 : 22;
  const geo = new THREE.PlaneGeometry(ancho, fondo, nx, nz);
  geo.rotateX(-Math.PI / 2);
  const m = new THREE.Mesh(
    geo,
    new THREE.MeshPhongMaterial({
      color: 0x1f7aad,
      transparent: true,
      opacity: 0.62,
      shininess: 180,
      specular: 0xc0e8f8,
      flatShading: false,
      side: THREE.FrontSide,
      depthWrite: false,
    })
  );
  m.position.y = y;
  m.receiveShadow = true;
  m.renderOrder = 2;
  const base = (geo.attributes.position.array as Float32Array).slice();
  return { malla: m, base, ancho };
}

/** Volumen translúcido bajo la superficie: da masa al agua sin tapar las piezas. */
export function crearVolumenBajo(
  ancho: number,
  alto: number,
  fondo: number,
  y: number
): Malla3D {
  const vol = new THREE.Mesh(
    new THREE.BoxGeometry(ancho, alto, fondo),
    new THREE.MeshPhongMaterial({
      color: 0x14495a,
      transparent: true,
      opacity: 0.45,
    })
  );
  vol.position.y = y;
  return vol;
}

/** Catenaria simple de evacuación con pulso. */
export function crearCableConPulso(
  puntos: THREE.Vector3[],
  radio = 0.09
): { cable: Malla3D; curva: THREE.CatmullRomCurve3; pulso: Malla3D } {
  const curva = new THREE.CatmullRomCurve3(puntos);
  const cable = new THREE.Mesh(
    new THREE.TubeGeometry(curva, Math.max(20, puntos.length * 8), radio, 6, false),
    crearMat(0x1a2228)
  );
  const pulso = new THREE.Mesh(
    new THREE.SphereGeometry(0.22, 10, 8),
    crearMat(0xc7e14a)
  );
  return { cable, curva, pulso };
}

/**
 * Lecho marino ocre compartido. La granja pide más ancho/fondo para las dos
 * filas de turbinas; el resto de escenas usa medidas más contenidas.
 */
export function crearLecho(
  modoEnergia: "undimotriz" | "mareomotriz",
  dispositivo: string
): Malla3D {
  const esGranja = modoEnergia === "mareomotriz" && dispositivo !== "embalse";
  const ancho = esGranja ? 120 : 56;
  const fondo = esGranja ? 80 : 36;
  const geo = new THREE.BoxGeometry(ancho, 1.2, fondo);
  const lecho = new THREE.Mesh(geo, crearMat(0xb5a06a, { roughness: 0.94, metalness: 0.02 }));
  lecho.position.set(0, -6.6, 0);
  lecho.receiveShadow = true;
  return lecho;
}

/**
 * Red eléctrica de tierra: centro de transformación + postes AT + línea.
 * Coherente con el esquema del dique (centro de transformación y torres).
 */
export function crearRedElectrica(g: Grupo3DLike): void {
  // Centro de transformacion en tierra (derecha) + linea de postes a borde.
  const tierra = new THREE.Mesh(new THREE.BoxGeometry(8, 3.4, 10), crearMat(0xa8b0b4, { roughness: 0.9 }));
  tierra.position.set(17, -4.2, -2);
  tierra.castShadow = true;
  g.add(tierra);
  const sub = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1.4, 1.6), crearMat(0x4a5660));
  sub.position.set(15.6, -1.8, -2);
  sub.castShadow = true;
  g.add(sub);
  for (let i = 0; i < 3; i++) {
    const poste = new THREE.Mesh(
      new THREE.CylinderGeometry(0.09, 0.11, 5, 8),
      crearMat(0x3a4650)
    );
    poste.position.set(8 + i * 3.4, 0.4, -4.5);
    g.add(poste);
    const cruceta = new THREE.Mesh(
      new THREE.BoxGeometry(1.4, 0.1, 0.1),
      crearMat(0x3a4650)
    );
    cruceta.position.set(8 + i * 3.4, 2.4, -4.5);
    g.add(cruceta);
  }
  const pts = [
    new THREE.Vector3(4, 2.4, -4.5),
    new THREE.Vector3(22, 2.6, -4.5),
  ];
  const linea = new THREE.Line(
    new THREE.BufferGeometry().setFromPoints(pts),
    new THREE.LineBasicMaterial({ color: 0x222222 })
  );
  g.add(linea);
}

/**
 * Environment map equirectangular procedural (cielo + mar).
 * Sin él, los materiales metálicos se ven casi negros.
 */
export function crearEntornoMarino(): THREE.Texture {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 256;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    const cielo = ctx.createLinearGradient(0, 0, 0, 128);
    cielo.addColorStop(0, "rgb(159 208 234)");
    cielo.addColorStop(0.55, "rgb(197 228 244)");
    cielo.addColorStop(1, "rgb(232 242 246)");
    ctx.fillStyle = cielo;
    ctx.fillRect(0, 0, 512, 128);
    const mar = ctx.createLinearGradient(0, 128, 0, 256);
    mar.addColorStop(0, "rgb(58 144 176)");
    mar.addColorStop(0.4, "rgb(31 98 128)");
    mar.addColorStop(1, "rgb(14 58 76)");
    ctx.fillStyle = mar;
    ctx.fillRect(0, 128, 512, 128);
    // Manchas de sol para que el metal coja reflejos.
    ctx.fillStyle = "rgba(255,250,230,0.55)";
    ctx.beginPath();
    ctx.ellipse(360, 48, 40, 18, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.mapping = THREE.EquirectangularReflectionMapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** Cielo degradado azul → horizonte marino. Para scene.background. */
export function crearCielo(): THREE.Texture {
  const canvas = document.createElement("canvas");
  canvas.width = 32;
  canvas.height = 256;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    const grad = ctx.createLinearGradient(0, 0, 0, 256);
    grad.addColorStop(0, "rgb(110 182 222)");
    grad.addColorStop(0.45, "rgb(159 208 234)");
    grad.addColorStop(0.62, "rgb(197 226 239)");
    grad.addColorStop(0.68, "rgb(58 143 180)");
    grad.addColorStop(1, "rgb(26 95 130)");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 32, 256);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.mapping = THREE.EquirectangularReflectionMapping;
  return tex;
}

/** Grupo mínimo que acepta add() — evita acoplar a THREE.Group en la firma. */
interface Grupo3DLike {
  add(...objetos: unknown[]): unknown;
}
