// Utilidades puras de construcción 3D. Sin estado de clase: el motor o las
// escenas las llaman con los argumentos explícitos.

// @ts-ignore — three se empaqueta por Vite sin @types (build verificado)
import * as THREE from "three";
import type { MaterialEstandar3D, Malla3D, Sprite3D } from "./tipos";

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
// Materiales y mar
// ---------------------------------------------------------------------------

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

const VERT_AGUA = `
varying vec3 vWorldPos;
varying vec3 vNormalW;
varying float vFogDepth;
void main() {
  vec4 worldPos = modelMatrix * vec4( position, 1.0 );
  vWorldPos = worldPos.xyz;
  vNormalW = normalize( mat3( modelMatrix ) * normal );
  vec4 mvPosition = viewMatrix * worldPos;
  vFogDepth = - mvPosition.z;
  gl_Position = projectionMatrix * mvPosition;
}`;

const FRAG_AGUA = `
uniform vec3 uDeep;
uniform vec3 uShallow;
uniform vec3 uSky;
uniform vec3 uEspuma;
uniform vec3 uSunDir;
uniform vec3 uSunColor;
uniform vec3 uFogColor;
uniform float uFogNear;
uniform float uFogFar;
uniform float uNivel;
uniform float uAmp;
uniform float uOpacidad;
uniform float uTiempo;
// Ventana didáctica: dentro del rectángulo (xmin, xmax, zmin, zmax) el agua
// se recorta para dejar ver un corte sumergido (sala de máquinas del dique).
uniform vec4 uVentana;
uniform float uVentanaActiva;
varying vec3 vWorldPos;
varying vec3 vNormalW;
varying float vFogDepth;
void main() {
  vec3 N = normalize( vNormalW );
  vec3 V = normalize( cameraPosition - vWorldPos );
  // Rizo de viento: perturba la normal en el fragmento (no hace falta más
  // geometría) para que la superficie tenga brillos y no sea un plano liso.
  vec2 p = vWorldPos.xz;
  float r1 = sin( p.x * 0.85 + uTiempo * 1.25 ) * cos( p.y * 0.63 - uTiempo * 0.95 );
  float r2 = sin( p.x * 1.7 + p.y * 1.3 - uTiempo * 1.9 + 1.3 );
  float r3 = sin( p.x * 0.35 - p.y * 0.5 + uTiempo * 0.7 );
  vec3 Nf = normalize( N + vec3( r1 * 0.035 + r3 * 0.02, 0.0, r2 * 0.04 ) );
  float ndv = clamp( dot( Nf, V ), 0.0, 1.0 );
  float fres = pow( 1.0 - ndv, 3.0 );
  float dist = length( cameraPosition - vWorldPos );
  // Azul profundo lejos; más claro y translúcido cerca de la cámara.
  vec3 base = mix( uShallow, uDeep, smoothstep( 4.0, 70.0, dist ) );
  vec3 col = mix( base, uSky, clamp( fres * 0.3, 0.0, 0.3 ) );
  // Crestas de la ola: un velo de espuma muy tenue.
  float cresta = smoothstep( 0.15, 0.85, ( vWorldPos.y - uNivel ) / max( uAmp, 0.01 ) );
  col = mix( col, uEspuma, cresta * 0.3 );
  // Destello del sol sobre las caras inclinadas.
  vec3 H = normalize( uSunDir + V );
  float nh = max( dot( Nf, H ), 0.0 );
  float spec = pow( nh, 180.0 ) * 1.5 + pow( nh, 22.0 ) * 0.12;
  col += uSunColor * spec;
  // Niebla lineal: el agua lejana se funde con el cielo del horizonte.
  float fogFactor = smoothstep( uFogNear, uFogFar, vFogDepth );
  col = mix( col, uFogColor, fogFactor );
  // Corte didáctico: cerca se ve el dispositivo; lejos el agua es opaca.
  float alpha = uOpacidad * ( 0.62 + 0.38 * smoothstep( 4.0, 55.0, dist ) );
  if ( uVentanaActiva > 0.5 ) {
    float enX = step( uVentana.x, vWorldPos.x ) * step( vWorldPos.x, uVentana.y );
    float enZ = step( uVentana.z, vWorldPos.z ) * step( vWorldPos.z, uVentana.w );
    float enVentana = enX * enZ;
    float dx = min( abs( vWorldPos.x - uVentana.x ), abs( vWorldPos.x - uVentana.y ) );
    float dz = min( abs( vWorldPos.z - uVentana.z ), abs( vWorldPos.z - uVentana.w ) );
    float borde = ( 1.0 - smoothstep( 0.0, 0.22, min( dx, dz ) ) ) * enVentana;
    // Marco de espuma en el borde de la ventana: se lee como un corte, no
    // como un agujero accidental. El interior se descarta (no hay lámina de
    // agua atravesando la sala de máquinas).
    if ( enVentana > 0.5 && borde < 0.01 ) discard;
    col = mix( col, uEspuma, borde * 0.45 );
    alpha = max( alpha, borde * 0.7 );
  }
  gl_FragColor = vec4( col, alpha );
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

/**
 * Lámina de mar ondulada. Devuelve malla y la copia base de vértices.
 * Shader propio (una pasada): azul profundo, Fresnel contenido, destello de
 * sol, espuma en crestas y niebla. Mucho más barato que postprocesar.
 */
export function crearSuperficieMar(
  ancho: number,
  fondo: number,
  y: number,
  calidadBaja: boolean,
  niebla?: { color: number; near: number; far: number }
): { malla: Malla3D; base: Float32Array; ancho: number } {
  // Más segmentos: el oleaje del motor deforma vértices; con pocos se ven
  // plegados tipo "cinta" en vez de ola.
  const nx = calidadBaja ? 40 : 84;
  const nz = calidadBaja ? 14 : 30;
  const geo = new THREE.PlaneGeometry(ancho, fondo, nx, nz);
  geo.rotateX(-Math.PI / 2);
  const material = new THREE.ShaderMaterial({
    uniforms: {
      uDeep: { value: new THREE.Color(0x062c40) },
      uShallow: { value: new THREE.Color(0x0f5f80) },
      uSky: { value: new THREE.Color(0xb4cedc) },
      uEspuma: { value: new THREE.Color(0xe6f6fa) },
      uSunDir: { value: new THREE.Vector3(12, 20, 10).normalize() },
      uSunColor: { value: new THREE.Color(0xfff0d0) },
      uFogColor: { value: new THREE.Color(niebla?.color ?? 0xa8c8da) },
      uFogNear: { value: niebla?.near ?? 30 },
      uFogFar: { value: niebla?.far ?? 105 },
      uNivel: { value: y },
      uAmp: { value: 0.75 },
      uOpacidad: { value: 0.9 },
      uTiempo: { value: 0 },
      uVentana: { value: new THREE.Vector4(0, 0, 0, 0) },
      uVentanaActiva: { value: 0 },
    },
    vertexShader: VERT_AGUA,
    fragmentShader: FRAG_AGUA,
    transparent: true,
    depthWrite: false,
    side: THREE.FrontSide,
  });
  const m = new THREE.Mesh(geo, material);
  m.position.y = y;
  m.renderOrder = 2;
  const base = (geo.attributes.position.array as Float32Array).slice();
  return { malla: m, base, ancho };
}

/** Mantiene el nivel/amplitud del shader de agua al día (marea, Hm0). */
export function actualizarNivelAgua(
  malla: Malla3D,
  nivel: number,
  amp: number,
  tiempo = 0
) {
  const mat = malla.material as THREE.ShaderMaterial;
  const u = mat?.uniforms;
  if (!u) return;
  if (u.uNivel) u.uNivel.value = nivel;
  if (u.uAmp) u.uAmp.value = Math.max(0.05, amp);
  if (u.uTiempo) u.uTiempo.value = tiempo;
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
    new THREE.MeshStandardMaterial({
      color: 0x0a2c3c,
      transparent: true,
      opacity: 0.16,
      depthWrite: false,
      roughness: 0.6,
      metalness: 0,
    })
  );
  vol.position.y = y;
  vol.renderOrder = 1;
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
 * Lecho marino ocre compartido (caja). La granja pide más ancho/fondo para las
 * dos filas de turbinas; el resto de escenas usa medidas más contenidas.
 */
export function crearLecho(
  modoEnergia: "undimotriz" | "mareomotriz",
  dispositivo: string
): Malla3D {
  const esGranja = modoEnergia === "mareomotriz" && dispositivo !== "embalse";
  const ancho = esGranja ? 120 : 56;
  const fondo = esGranja ? 80 : 36;
  const geo = new THREE.BoxGeometry(ancho, 1.2, fondo);
  const lecho = new THREE.Mesh(
    geo,
    crearMat(0x8d7a52, { roughness: 0.95, metalness: 0.02 })
  );
  lecho.position.set(0, -6.6, 0);
  lecho.receiveShadow = true;
  return lecho;
}

/**
 * Lecho de arena con dunas suaves y color por vértice. Una sola malla, sin
 * texturas: se lee como fondo marino y no como una mancha plana.
 */
export function crearLechoArena(
  ancho: number,
  fondo: number,
  y: number,
  calidadBaja: boolean,
  opciones: { amplitud?: number; tono?: number } = {}
): Malla3D {
  const segX = calidadBaja ? 18 : 44;
  const segZ = calidadBaja ? 12 : 28;
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
    // Variación suave (sin ruido blanco): vetas de arena más clara y oscura.
    const veta =
      Math.sin(x * 0.9 + Math.sin(z * 0.7) * 2.1) *
      Math.cos(z * 0.8 + Math.sin(x * 0.5) * 1.7);
    const claro = (0.86 + veta * 0.14) * tono;
    const alto = duna * amp > 0 ? 1.06 : 0.94;
    // Arena algo fría (bajo el agua) y con vetas: no es un desierto.
    colores[i * 3] = 0.1 * claro * alto;
    colores[i * 3 + 1] = 0.12 * claro * alto;
    colores[i * 3 + 2] = 0.13 * claro * alto;
  }
  geo.setAttribute("color", new THREE.BufferAttribute(colores, 3));
  geo.computeVertexNormals();
  const lecho = new THREE.Mesh(
    geo,
    new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.97,
      metalness: 0.0,
    })
  );
  lecho.position.y = y;
  lecho.receiveShadow = true;
  return lecho;
}

/** Rocas dispersas de bajo poliedro: dan escala y textura al lecho. */
export function crearRocasLecho(
  cantidad: number,
  ancho: number,
  fondo: number,
  y: number,
  semilla = 7
): THREE.Group {
  const g = new THREE.Group();
  const mats = [
    crearMat(0x3f463f, { roughness: 0.92, metalness: 0.02 }),
    crearMat(0x4b4f45, { roughness: 0.9, metalness: 0.02 }),
    crearMat(0x343a36, { roughness: 0.94, metalness: 0.02 }),
  ];
  let s = (semilla >>> 0) || 1;
  const rnd = () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
  const radioMax = Math.min(ancho, fondo) * 0.38;
  for (let i = 0; i < cantidad; i++) {
    const ang = rnd() * Math.PI * 2;
    const rad = 3.2 + rnd() * radioMax;
    const esc = 0.18 + rnd() * 0.52;
    const roca = new THREE.Mesh(
      new THREE.DodecahedronGeometry(1, 0),
      mats[i % mats.length]
    );
    // Semienterradas: se apoyan en la arena, no flotan.
    roca.position.set(
      Math.cos(ang) * rad,
      y - 0.08 + esc * 0.06,
      Math.sin(ang) * rad * 0.72
    );
    roca.scale.set(
      esc * (0.8 + rnd() * 0.7),
      esc * (0.4 + rnd() * 0.45),
      esc * (0.8 + rnd() * 0.7)
    );
    roca.rotation.set(rnd() * 3.1, rnd() * 3.1, rnd() * 3.1);
    roca.castShadow = true;
    roca.receiveShadow = true;
    g.add(roca);
  }
  return g;
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
    cielo.addColorStop(0, "rgb(46 102 152)");
    cielo.addColorStop(0.45, "rgb(126 174 206)");
    cielo.addColorStop(0.82, "rgb(184 212 228)");
    cielo.addColorStop(1, "rgb(214 230 238)");
    ctx.fillStyle = cielo;
    ctx.fillRect(0, 0, 512, 128);
    const mar = ctx.createLinearGradient(0, 128, 0, 256);
    mar.addColorStop(0, "rgb(38 104 136)");
    mar.addColorStop(0.35, "rgb(18 68 94)");
    mar.addColorStop(1, "rgb(7 34 50)");
    ctx.fillStyle = mar;
    ctx.fillRect(0, 128, 512, 128);
    // Mancha de sol: el metal coge un reflejo cálido y el agua, brillo.
    const sol = ctx.createRadialGradient(360, 46, 2, 360, 46, 58);
    sol.addColorStop(0, "rgba(255, 250, 228, 0.95)");
    sol.addColorStop(0.35, "rgba(255, 244, 210, 0.45)");
    sol.addColorStop(1, "rgba(255, 244, 210, 0)");
    ctx.fillStyle = sol;
    ctx.fillRect(300, 0, 120, 110);
    // Reflejo del sol sobre el mar.
    const brillo = ctx.createLinearGradient(0, 128, 0, 200);
    brillo.addColorStop(0, "rgba(255, 240, 205, 0.28)");
    brillo.addColorStop(1, "rgba(255, 240, 205, 0)");
    ctx.fillStyle = brillo;
    ctx.fillRect(320, 128, 80, 72);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.mapping = THREE.EquirectangularReflectionMapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/**
 * Cielo degradado para scene.background. La banda del horizonte coincide con
 * el color de niebla de las escenas: el agua lejana se funde con el cielo.
 */
export function crearCielo(): THREE.Texture {
  const canvas = document.createElement("canvas");
  canvas.width = 64;
  canvas.height = 512;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    const grad = ctx.createLinearGradient(0, 0, 0, 512);
    grad.addColorStop(0.0, "rgb(24 70 118)");
    grad.addColorStop(0.2, "rgb(56 116 162)");
    grad.addColorStop(0.36, "rgb(94 150 190)");
    grad.addColorStop(0.45, "rgb(140 182 208)");
    grad.addColorStop(0.49, "rgb(164 198 214)");
    grad.addColorStop(0.5, "rgb(168 200 216)");
    grad.addColorStop(0.53, "rgb(132 172 192)");
    grad.addColorStop(0.62, "rgb(70 126 156)");
    grad.addColorStop(0.78, "rgb(28 80 110)");
    grad.addColorStop(1.0, "rgb(10 42 64)");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 64, 512);
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
