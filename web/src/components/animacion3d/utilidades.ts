// Utilidades puras de construcción 3D. Sin estado de clase: el motor o las
// escenas las llaman con los argumentos explícitos.

// @ts-ignore — three se empaqueta por Vite sin @types (build verificado)
import * as THREE from "three";
import type { MaterialEstandar3D, Malla3D, Sprite3D } from "./tipos";
import { sumergir } from "./agua";
import { texturaArena, texturaDesgaste } from "./texturas";

// ---------------------------------------------------------------------------
// Rótulos
// ---------------------------------------------------------------------------
// Los rótulos viven en el espacio de la cámara (los recoloca el motor cada
// fotograma) y se dimensionan en píxeles CSS: 13 px de texto, caja de 28 px de
// alto. Así no se recortan ni se vuelven gigantes al acercar la cámara.

const ALTO_ROTULO_PX = 28;
const ANCHO_TEXTURA_PX = 512;
const ALTO_TEXTURA_PX = 56;
const FUENTE_ROTULO =
  '600 13px system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", sans-serif';
const PAD_ROTULO_X = 11;
const MARGEN_ROTULO_PX = 12;

interface DatosRotulo {
  etiquetaCanvas: HTMLCanvasElement;
  etiquetaTex: THREE.CanvasTexture;
  ancla: THREE.Vector3;
  /** Tamaño de la caja visible (px CSS). */
  anchoPx: number;
  altoPx: number;
  /** Tamaño total de la textura (px CSS), con márgenes transparentes. */
  anchoTexturaPx: number;
  altoTexturaPx: number;
  texto: string;
}

export function crearEtiqueta(texto: string): Sprite3D {
  const canvas = document.createElement("canvas");
  const dpr = Math.min(
    2,
    (typeof window !== "undefined" && window.devicePixelRatio) || 1
  );
  // Textura de tamaño fijo: repintar no redimensiona el canvas (evita avisos
  // del navegador al resubir la textura) y la caja se centra en ella.
  canvas.width = Math.ceil(ANCHO_TEXTURA_PX * dpr);
  canvas.height = Math.ceil(ALTO_TEXTURA_PX * dpr);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.minFilter = THREE.LinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.generateMipmaps = false;
  const sp = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: tex,
      transparent: true,
      depthTest: false,
      depthWrite: false,
      fog: false,
      toneMapped: false,
    })
  );
  sp.renderOrder = 1000;
  const datos: DatosRotulo = {
    etiquetaCanvas: canvas,
    etiquetaTex: tex,
    ancla: new THREE.Vector3(),
    anchoPx: 96,
    altoPx: ALTO_ROTULO_PX,
    anchoTexturaPx: ANCHO_TEXTURA_PX,
    altoTexturaPx: ALTO_TEXTURA_PX,
    texto: "",
  };
  sp.userData.esEtiqueta = true;
  sp.userData.rotulo = datos;
  // Claves planas: compatibilidad con el código que ya las consultaba.
  sp.userData.etiquetaCanvas = canvas;
  sp.userData.etiquetaTex = tex;
  sp.userData.ancla = datos.ancla;
  sp.userData.anchoPx = datos.anchoPx;
  sp.userData.altoPx = datos.altoPx;
  sp.userData.anchoTexturaPx = datos.anchoTexturaPx;
  sp.userData.altoTexturaPx = datos.altoTexturaPx;
  pintarEtiqueta(sp, texto);
  return sp;
}

export function pintarEtiqueta(sp: Sprite3D, texto: string) {
  const datos = sp.userData as unknown as DatosRotulo;
  const canvas = datos.etiquetaCanvas;
  const tex = datos.etiquetaTex;
  if (!canvas || !tex) return;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const dpr = Math.min(
    2,
    (typeof window !== "undefined" && window.devicePixelRatio) || 1
  );
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, ANCHO_TEXTURA_PX, ALTO_TEXTURA_PX);

  // Ajuste de fuente y recorte: la caja nunca supera el ancho de la textura.
  const maxTexto = ANCHO_TEXTURA_PX - PAD_ROTULO_X * 2 - 8;
  let fuente = 13;
  let visible = texto;
  ctx.font = FUENTE_ROTULO;
  let anchoTexto = ctx.measureText(visible).width;
  while (anchoTexto > maxTexto && fuente > 10) {
    fuente -= 1;
    ctx.font = `600 ${fuente}px system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", sans-serif`;
    anchoTexto = ctx.measureText(visible).width;
  }
  if (anchoTexto > maxTexto) {
    let corte = visible.length;
    while (corte > 4 && anchoTexto > maxTexto) {
      corte -= 1;
      visible = visible.slice(0, corte).trimEnd() + "…";
      anchoTexto = ctx.measureText(visible).width;
    }
  }

  const anchoCaja = Math.min(
    ANCHO_TEXTURA_PX - 8,
    Math.max(54, Math.ceil(anchoTexto) + PAD_ROTULO_X * 2)
  );
  const x = (ANCHO_TEXTURA_PX - anchoCaja) / 2;
  const y = (ALTO_TEXTURA_PX - ALTO_ROTULO_PX) / 2;

  // Sombra suave + caja redondeada translúcida: discreta y legible sobre
  // cielo, agua o arena.
  ctx.save();
  ctx.shadowColor = "rgba(0, 0, 0, 0.38)";
  ctx.shadowBlur = 7;
  ctx.shadowOffsetY = 2;
  ctx.fillStyle = "rgba(7, 19, 28, 0.74)";
  trazarRectRedondeado(ctx, x + 0.5, y + 0.5, anchoCaja - 1, ALTO_ROTULO_PX - 1, 9);
  ctx.fill();
  ctx.restore();

  ctx.strokeStyle = "rgba(214, 236, 245, 0.18)";
  ctx.lineWidth = 1;
  trazarRectRedondeado(ctx, x + 0.5, y + 0.5, anchoCaja - 1, ALTO_ROTULO_PX - 1, 9);
  ctx.stroke();

  ctx.fillStyle = "rgb(238, 247, 250)";
  ctx.font = `600 ${fuente}px system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(visible, ANCHO_TEXTURA_PX / 2, ALTO_TEXTURA_PX / 2 + 0.5);

  datos.anchoPx = anchoCaja;
  datos.altoPx = ALTO_ROTULO_PX;
  datos.texto = visible;
  sp.userData.anchoPx = anchoCaja;
  sp.userData.altoPx = ALTO_ROTULO_PX;
  tex.needsUpdate = true;
}

function trazarRectRedondeado(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  const rr = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.lineTo(x + w - rr, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + rr);
  ctx.lineTo(x + w, y + h - rr);
  ctx.quadraticCurveTo(x + w, y + h, x + w - rr, y + h);
  ctx.lineTo(x + rr, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - rr);
  ctx.lineTo(x, y + rr);
  ctx.quadraticCurveTo(x, y, x + rr, y);
  ctx.closePath();
}

const _v1 = new THREE.Vector3();
const _v2 = new THREE.Vector3();
const _v3 = new THREE.Vector3();

/** Rectángulo de UI (px CSS, relativo al lienzo) que los rótulos esquivan. */
export interface ZonaReservadaPx {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface OpcionesRotulos {
  /** Franja superior (px CSS) que ningún rótulo puede invadir. */
  franjaSuperiorPx?: number;
  /** Controles flotantes que los rótulos deben esquivar (px CSS del lienzo). */
  zonas?: ZonaReservadaPx[];
  /** Separación mínima entre rótulos y controles (px CSS). */
  separacionPx?: number;
  /** Si no hay hueco libre, oculta el rótulo en vez de dejarlo encima. */
  ocultarSiNoCabe?: boolean;
}

interface RectPx {
  x: number;
  y: number;
  w: number;
  h: number;
}

function solapan(a: RectPx, b: RectPx): boolean {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

function expandir(r: RectPx, d: number): RectPx {
  return { x: r.x - d, y: r.y - d, w: r.w + 2 * d, h: r.h + 2 * d };
}

/**
 * Coloca los rótulos en pantalla: tamaño constante en píxeles CSS, siempre
 * dentro del lienzo con margen, sin salirse por los lados y sin pisar los
 * controles flotantes (conmutador 2D/3D, minimapa, pausa). Los sprites deben
 * ser hijos de la cámara (el motor los cuelga de un grupo suyo).
 *
 * Los rótulos con `userData.prioridad` más baja se colocan primero; el resto
 * los esquiva. Si un rótulo no cabe en ningún hueco libre se oculta (por
 * defecto) para no quedar debajo de la UI.
 */
export function disponerEtiquetas(
  etiquetas: Sprite3D[],
  camara: THREE.PerspectiveCamera,
  anchoPx: number,
  altoPx: number,
  opciones: OpcionesRotulos = {}
): void {
  if (!etiquetas.length || anchoPx < 2 || altoPx < 2) return;
  camara.updateMatrixWorld();
  const tanV = Math.tan((camara.fov * Math.PI) / 360);
  const aspecto = anchoPx / altoPx;
  const dist = 10; // plano de cámara donde se dibujan los rótulos
  const mundoPorPx = (2 * dist * tanV) / altoPx;
  const posCam = camara.getWorldPosition(_v1);
  const dirCam = camara.getWorldDirection(_v2);

  const margen = MARGEN_ROTULO_PX;
  const minY = Math.max(margen, opciones.franjaSuperiorPx ?? 0);
  const sep = Math.max(0, opciones.separacionPx ?? 6);
  const ocultar = opciones.ocultarSiNoCabe !== false;
  const zonas = (opciones.zonas ?? []).map((z) => expandir(z, sep));
  const ocupados: RectPx[] = [];

  // Los importantes primero: los demás buscan hueco a su alrededor.
  const orden = [...etiquetas].sort(
    (a, b) =>
      ((a.userData.prioridad as number | undefined) ?? 5) -
      ((b.userData.prioridad as number | undefined) ?? 5)
  );

  for (const sp of orden) {
    const datos = sp.userData as unknown as DatosRotulo;
    const ancla = datos.ancla;
    if (!ancla) continue;
    // Detrás de la cámara: no se puede rotular nada.
    _v3.copy(ancla).sub(posCam);
    if (_v3.dot(dirCam) <= 0.05) {
      sp.visible = false;
      continue;
    }
    sp.visible = true;
    _v3.copy(ancla).project(camara);

    let ancho = Math.max(24, datos.anchoPx || 96);
    let alto = Math.max(16, datos.altoPx || ALTO_ROTULO_PX);
    // Nunca más ancho que el lienzo (con margen): si hiciera falta, encoge.
    const maxAncho = Math.max(48, anchoPx - 2 * margen);
    if (ancho > maxAncho) {
      const f = maxAncho / ancho;
      ancho *= f;
      alto *= f;
    }
    const minX = margen;
    const maxX = anchoPx - margen - ancho;
    const maxY = altoPx - margen - alto;
    if (maxX < minX || maxY < minY) {
      sp.visible = false;
      continue;
    }

    const idealX = (_v3.x * 0.5 + 0.5) * anchoPx - ancho / 2;
    const idealY = (0.5 - _v3.y * 0.5) * altoPx - alto / 2;
    let rect: RectPx = {
      x: Math.max(minX, Math.min(maxX, idealX)),
      y: Math.max(minY, Math.min(maxY, idealY)),
      w: ancho,
      h: alto,
    };

    const choca = (r: RectPx) =>
      zonas.some((z) => solapan(r, z)) || ocupados.some((o) => solapan(r, o));

    // Desplazamiento mínimo fuera del control que pise; hasta 8 rebotes.
    for (let it = 0; it < 8 && choca(rect); it++) {
      const golpe =
        zonas.find((z) => solapan(rect, z)) ??
        ocupados.find((o) => solapan(rect, o));
      if (!golpe) break;
      const cands: RectPx[] = [
        { ...rect, x: golpe.x - rect.w },
        { ...rect, x: golpe.x + golpe.w },
        { ...rect, y: golpe.y - rect.h },
        { ...rect, y: golpe.y + golpe.h },
      ];
      let mejor: RectPx | null = null;
      let mejorD = Infinity;
      for (const c of cands) {
        c.x = Math.max(minX, Math.min(maxX, c.x));
        c.y = Math.max(minY, Math.min(maxY, c.y));
        if (choca(c)) continue;
        const d = (c.x - rect.x) ** 2 + (c.y - rect.y) ** 2;
        if (d < mejorD) {
          mejorD = d;
          mejor = c;
        }
      }
      if (!mejor) break;
      rect = mejor;
    }

    // Sin hueco por rebotes: rejilla gruesa y, si tampoco, se oculta.
    if (choca(rect)) {
      let mejor: RectPx | null = null;
      let mejorD = Infinity;
      for (let y = minY; y <= maxY + 0.01; y += 6) {
        for (let x = minX; x <= maxX + 0.01; x += 6) {
          const c = { x, y, w: ancho, h: alto };
          if (choca(c)) continue;
          const d = (x - idealX) ** 2 + (y - idealY) ** 2;
          if (d < mejorD) {
            mejorD = d;
            mejor = c;
          }
        }
      }
      if (mejor) rect = mejor;
      else if (ocultar) {
        sp.visible = false;
        continue;
      }
    }

    ocupados.push(expandir(rect, sep * 0.75));

    const nx = ((rect.x + ancho / 2) / anchoPx) * 2 - 1;
    const ny = 1 - ((rect.y + alto / 2) / altoPx) * 2;
    // La textura incluye márgenes transparentes; la caja está centrada.
    const anchoTex = datos.anchoTexturaPx || ANCHO_TEXTURA_PX;
    const altoTex = datos.altoTexturaPx || ALTO_TEXTURA_PX;
    const factor = alto / (datos.altoPx || ALTO_ROTULO_PX);
    sp.position.set(nx * tanV * aspecto * dist, ny * tanV * dist, -dist);
    sp.scale.set(
      anchoTex * factor * mundoPorPx,
      altoTex * factor * mundoPorPx,
      1
    );
  }
}

// ---------------------------------------------------------------------------
// Materiales y lecho
// ---------------------------------------------------------------------------

/** Material estándar que además sabe verse bajo el agua (ver `sumergir`). */
export function crearMat(
  color: number,
  extra: Record<string, unknown> = {}
): MaterialEstandar3D {
  return sumergir(
    new THREE.MeshStandardMaterial({
      color,
      roughness: 0.75,
      metalness: 0.08,
      ...(extra as THREE.MeshStandardMaterialParameters),
    })
  );
}

/** Acero pintado con uso: roces, regueros y un relieve fino en el brillo. */
export function crearMatPintado(
  color: number,
  extra: Record<string, unknown> = {}
): MaterialEstandar3D {
  const t = texturaDesgaste();
  return crearMat(color, {
    map: t,
    roughnessMap: t,
    bumpMap: t,
    bumpScale: 0.6,
    roughness: 0.55,
    metalness: 0.25,
    ...extra,
  });
}

/** Cable de evacuación tendido sobre el lecho, con el pulso de energía. */
export function crearCableConPulso(
  puntos: THREE.Vector3[],
  radio = 0.09
): { cable: Malla3D; curva: THREE.CatmullRomCurve3; pulso: Malla3D } {
  const curva = new THREE.CatmullRomCurve3(puntos);
  const cable = new THREE.Mesh(
    new THREE.TubeGeometry(curva, Math.max(40, puntos.length * 14), radio, 8, false),
    crearMat(0x15191c, { roughness: 0.6, metalness: 0.1 })
  );
  cable.castShadow = true;
  // El pulso es un símbolo (energía que viaja), no un objeto: no lo tiñe el agua.
  const pulso = new THREE.Mesh(
    new THREE.SphereGeometry(radio * 2.3, 14, 10),
    new THREE.MeshBasicMaterial({ color: 0xc7e14a })
  );
  const halo = new THREE.Mesh(
    new THREE.SphereGeometry(radio * 4.6, 14, 10),
    new THREE.MeshBasicMaterial({
      color: 0xc7e14a,
      transparent: true,
      opacity: 0.22,
      depthWrite: false,
    })
  );
  pulso.add(halo);
  return { cable, curva, pulso };
}

/**
 * Lecho de arena: dunas suaves en la malla, rizaduras de corriente en el
 * relieve y vetas de color por vértice. El tinte azul lo pone el agua.
 */
export function crearLechoArena(
  ancho: number,
  fondo: number,
  y: number,
  calidadBaja: boolean,
  opciones: { amplitud?: number; tono?: number } = {}
): Malla3D {
  const segX = calidadBaja ? 24 : 64;
  const segZ = calidadBaja ? 16 : 44;
  const geo = new THREE.PlaneGeometry(ancho, fondo, segX, segZ);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position as THREE.BufferAttribute;
  const amp = opciones.amplitud ?? 0.55;
  const tono = opciones.tono ?? 1;
  const colores = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    const duna =
      Math.sin(x * 0.13 + 0.7) * 0.45 +
      Math.cos(z * 0.17 - 0.4) * 0.3 +
      Math.sin((x + z) * 0.07) * 0.25;
    pos.setY(i, duna * amp);
    const veta =
      Math.sin(x * 0.9 + Math.sin(z * 0.7) * 2.1) *
      Math.cos(z * 0.8 + Math.sin(x * 0.5) * 1.7);
    const claro = (0.9 + veta * 0.1) * tono * (duna > 0 ? 1.05 : 0.93);
    colores[i * 3] = 0.8 * claro;
    colores[i * 3 + 1] = 0.72 * claro;
    colores[i * 3 + 2] = 0.56 * claro;
  }
  geo.setAttribute("color", new THREE.BufferAttribute(colores, 3));
  geo.computeVertexNormals();
  const arena = texturaArena().clone();
  arena.repeat.set(ancho / 7, fondo / 7);
  arena.needsUpdate = true;
  const lecho = new THREE.Mesh(
    geo,
    sumergir(
      // Lambert: la arena es mate y ocupa media pantalla; no merece el coste
      // del sombreado físico con entorno.
      new THREE.MeshLambertMaterial({
        vertexColors: true,
        map: arena,
        bumpMap: arena,
        bumpScale: 1.4,
      })
    )
  );
  lecho.position.y = y;
  lecho.receiveShadow = true;
  return lecho;
}

/** Roca irregular: icosaedro deformado con senos (sin caras regulares). */
function geometriaRoca(semilla: number): THREE.BufferGeometry {
  const geo = new THREE.IcosahedronGeometry(1, 2);
  const pos = geo.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    const d =
      1 +
      0.2 * Math.sin(x * 3.1 + semilla) * Math.cos(y * 2.7 + semilla * 1.7) +
      0.14 * Math.sin(z * 4.3 + semilla * 0.6) +
      0.08 * Math.sin((x + y + z) * 7.1 + semilla);
    pos.setXYZ(i, x * d, y * d, z * d);
  }
  geo.computeVertexNormals();
  return geo;
}

/** Rocas dispersas, semienterradas en la arena: dan escala al lecho. */
export function crearRocasLecho(
  cantidad: number,
  ancho: number,
  fondo: number,
  y: number,
  semilla = 7
): THREE.Group {
  const g = new THREE.Group();
  const t = texturaDesgaste();
  const mats = [0x5a5f58, 0x6b6a5e, 0x4a504c].map((c) =>
    crearMat(c, { roughness: 0.95, metalness: 0.0, bumpMap: t, bumpScale: 2.5, flatShading: true })
  );
  const geos = [geometriaRoca(1.3), geometriaRoca(4.1), geometriaRoca(7.7)];
  let s = (semilla >>> 0) || 1;
  const rnd = () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
  const radioMax = Math.min(ancho, fondo) * 0.38;
  for (let i = 0; i < cantidad; i++) {
    const ang = rnd() * Math.PI * 2;
    const rad = 3.6 + rnd() * radioMax;
    const esc = 0.2 + rnd() * 0.55;
    const roca = new THREE.Mesh(geos[i % geos.length], mats[i % mats.length]);
    roca.position.set(
      Math.cos(ang) * rad,
      y - 0.05 + esc * 0.1,
      Math.sin(ang) * rad * 0.72
    );
    roca.scale.set(
      esc * (0.8 + rnd() * 0.7),
      esc * (0.4 + rnd() * 0.45),
      esc * (0.8 + rnd() * 0.7)
    );
    roca.rotation.set(rnd() * 0.5, rnd() * 3.1, rnd() * 0.5);
    roca.castShadow = true;
    roca.receiveShadow = true;
    g.add(roca);
  }
  return g;
}
