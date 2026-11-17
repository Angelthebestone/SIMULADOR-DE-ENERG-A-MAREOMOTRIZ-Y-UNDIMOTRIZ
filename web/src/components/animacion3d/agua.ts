// Agua de las escenas 3D: superficie (olas en la GPU, reflejo del cielo,
// Fresnel, espuma), tinte de lo sumergido (absorción + cáusticas) y partículas
// en suspensión que hacen visible el movimiento del agua.
//
// La ola principal es la del modelo: eta = (Hm0/2)·cos(k·x − ω·t). El mar de
// viento que se le suma es decoración proporcional y no mueve al dispositivo.

// @ts-ignore — three se empaqueta por Vite sin @types (build verificado)
import * as THREE from "three";
import { UNIFORMES_MAR } from "./ambiente";
import type { Malla3D } from "./tipos";

/** Máximo de piezas que atraviesan la superficie y dejan anillo de espuma. */
export const MAX_ESTELAS = 6;

const VERT_AGUA = /* glsl */ `
uniform float uTiempo;
uniform vec3 uOla;
uniform float uOleaje;
varying vec3 vMundo;
varying vec2 vPend;
varying float vAltura;

void tren( vec2 dir, float kMul, float wMul, float aMul, float fase, vec2 p, float A,
           inout float y, inout vec2 pend ) {
  float k = uOla.y * kMul;
  float g = dot( dir, p ) * k - uOla.z * wMul * uTiempo + fase;
  y += A * aMul * cos( g );
  pend -= A * aMul * k * sin( g ) * dir;
}

void main() {
  vec4 w = modelMatrix * vec4( position, 1.0 );
  float A = uOla.x * uOleaje;
  float y = 0.0;
  vec2 pend = vec2( 0.0 );
  // Ola del modelo (viaja en +X) y tres trenes cortos de mar de viento; sus
  // frecuencias siguen la dispersión de aguas profundas (ω ∝ √k).
  tren( vec2( 1.0, 0.0 ), 1.0, 1.0, 1.0, 0.0, w.xz, A, y, pend );
  tren( vec2( 0.84, 0.54 ), 1.9, 1.38, 0.13, 1.6, w.xz, A, y, pend );
  tren( vec2( 0.6, -0.8 ), 3.1, 1.76, 0.07, 4.1, w.xz, A, y, pend );
  tren( vec2( -0.3, 0.95 ), 4.7, 2.17, 0.04, 2.3, w.xz, A, y, pend );
  w.y += y;
  vAltura = y;
  vPend = pend;
  vMundo = w.xyz;
  gl_Position = projectionMatrix * viewMatrix * w;
}`;

const FRAG_AGUA = /* glsl */ `
precision highp float;
uniform samplerCube uCielo;
uniform sampler2D uRuido;
uniform vec3 uSolDir;
uniform vec3 uSolColor;
uniform vec3 uAguaColor;
uniform vec3 uFogColor;
uniform float uFogNear;
uniform float uFogFar;
uniform float uTiempo;
uniform vec3 uOla;
uniform float uOleaje;
uniform float uOpacidad;
uniform float uRizo;
uniform vec2 uDeriva;
uniform vec4 uEstelas[ ${MAX_ESTELAS} ];
// Rompiente contra un paramento recto: (z de la cara, semiancho en x, fuerza).
uniform vec3 uOrilla;
varying vec3 vMundo;
varying vec2 vPend;
varying float vAltura;

void main() {
  vec3 haciaCam = cameraPosition - vMundo;
  float dist = length( haciaCam );
  vec3 V = haciaCam / dist;
  vec2 p = vMundo.xz;
  float lejos = smoothstep( 16.0, 110.0, dist );
  vec2 t = vec2( uTiempo );

  // Rizo capilar: tres capas de pendiente que se cruzan. Lejos se apaga la
  // más fina para que no centellee.
  vec2 g = ( texture2D( uRuido, p * 0.043 + t * vec2( 0.011, 0.006 ) ).gb - 0.5 );
  g += ( texture2D( uRuido, p * 0.127 + t * vec2( -0.019, 0.014 ) ).gb - 0.5 ) * 0.7;
  g += ( texture2D( uRuido, p * 0.41 + t * vec2( 0.031, -0.023 ) ).gb - 0.5 ) * 0.5 * ( 1.0 - lejos );
  float rizo = uRizo * mix( 1.0, 0.35, lejos );
  vec3 N = normalize( vec3( -( vPend.x + g.x * rizo ), 1.0, -( vPend.y + g.y * rizo ) ) );

  float ndv = max( dot( N, V ), 0.0 );
  float fres = 0.02 + 0.98 * pow( 1.0 - ndv, 5.0 );
  vec3 R = reflect( -V, N );
  R.y = abs( R.y );
  vec3 reflejo = min( textureCube( uCielo, R ).rgb, vec3( 6.0 ) );
  float rs = max( dot( R, uSolDir ), 0.0 );
  vec3 destello = uSolColor * ( pow( rs, 420.0 ) * 2.2 + pow( rs, 48.0 ) * 0.1 );

  float A = max( uOla.x * uOleaje, 0.02 );
  float cresta = clamp( vAltura / ( A * 1.25 ), -1.0, 1.0 );
  vec3 cuerpo = uAguaColor * ( 0.7 + 0.9 * max( uSolDir.y, 0.0 ) );
  // Luz que atraviesa la cresta cuando se mira hacia el sol.
  float contraluz = pow( clamp( dot( V, -uSolDir ) * 0.5 + 0.5, 0.0, 1.0 ), 3.0 );
  cuerpo += vec3( 0.01, 0.13, 0.12 ) * contraluz * smoothstep( -0.1, 1.0, cresta ) * 0.55;
  vec3 col = mix( cuerpo, reflejo, fres ) + destello;

  // Espuma: borreguillos en la cresta solo cuando la ola es empinada (A·k).
  float n1 = texture2D( uRuido, p * 0.085 + uDeriva * uTiempo ).a;
  float n2 = texture2D( uRuido, p * 0.33 + uDeriva * uTiempo * 2.3 + 0.37 ).r;
  float grano = n1 * 0.6 + n2 * 0.4;
  float empinada = smoothstep( 0.24, 0.62, A * uOla.y );
  float espuma = smoothstep( 0.5, 1.0, cresta ) * empinada * smoothstep( 0.42, 0.62, grano + cresta * 0.12 );
  for ( int i = 0; i < ${MAX_ESTELAS}; i++ ) {
    vec4 e = uEstelas[ i ];
    if ( e.w > 0.0 ) {
      float d = length( p - e.xy ) - e.z;
      float anillo = ( 1.0 - smoothstep( 0.0, 0.5 + 0.35 * e.w, d ) ) * step( -0.3, d );
      espuma = max( espuma, anillo * e.w * smoothstep( 0.3, 0.62, grano + anillo * 0.3 ) );
    }
  }
  if ( uOrilla.z > 0.0 ) {
    float d = abs( p.y - uOrilla.x );
    float banda = ( 1.0 - smoothstep( 0.0, 0.7, d ) ) * step( abs( p.x ), uOrilla.y );
    espuma = max( espuma, banda * uOrilla.z * smoothstep( 0.32, 0.6, grano + banda * 0.25 ) );
  }
  vec3 blanco = vec3( 0.86, 0.92, 0.94 ) * ( 0.55 + 0.6 * max( uSolDir.y, 0.0 ) );
  col = mix( col, blanco, espuma * 0.9 );

  // De cerca el agua deja ver lo sumergido; rasante y lejos es un espejo.
  float alpha = mix( uOpacidad, 1.0, fres );
  alpha = mix( alpha, 1.0, smoothstep( 22.0, 95.0, dist ) );
  alpha = max( alpha, espuma * 0.92 );

  float niebla = smoothstep( uFogNear, uFogFar, dist );
  col = mix( col, uFogColor, niebla );
  gl_FragColor = vec4( col, alpha );
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

/** Reparte las líneas de la malla: densas en el foco, abiertas hacia el borde. */
function lineas(min: number, max: number, foco: number, n: number): Float32Array {
  const v = new Float32Array(n + 1);
  // El foco parte la malla en proporción a cada lado, con un mínimo de filas.
  const fr = Math.min(0.85, Math.max(0.15, (foco - min) / (max - min)));
  const nIzq = Math.round(n * fr);
  for (let i = 0; i <= n; i++) {
    if (i <= nIzq) {
      const u = nIzq > 0 ? (nIzq - i) / nIzq : 0;
      v[i] = foco - (foco - min) * Math.pow(u, 2.4);
    } else {
      const u = (i - nIzq) / (n - nIzq);
      v[i] = foco + (max - foco) * Math.pow(u, 2.4);
    }
  }
  return v;
}

export interface OpcionesMar {
  niebla?: { color: number; near: number; far: number };
  /** Punto (local) donde la malla es más densa: donde mira la cámara. */
  focoX?: number;
  focoZ?: number;
  /** Fracción de la ola del modelo que ondula esta lámina (embalse ≈ 0). */
  oleaje?: number;
  /** Fuerza del rizo capilar. */
  rizo?: number;
  /** Opacidad mirando de frente y de cerca. */
  opacidad?: number;
}

/**
 * Lámina de agua. El oleaje lo calcula el vertex shader con los uniformes
 * compartidos (UNIFORMES_MAR.uOla), así que no hay vértices que mover en CPU.
 */
export function crearSuperficieMar(
  ancho: number,
  fondo: number,
  y: number,
  calidadBaja: boolean,
  opciones: OpcionesMar = {}
): { malla: Malla3D; ancho: number } {
  const nx = calidadBaja ? 72 : 168;
  const nz = calidadBaja ? 48 : 120;
  const xs = lineas(-ancho / 2, ancho / 2, opciones.focoX ?? 0, nx);
  const zs = lineas(-fondo / 2, fondo / 2, opciones.focoZ ?? 0, nz);
  const pos = new Float32Array((nx + 1) * (nz + 1) * 3);
  let o = 0;
  for (let j = 0; j <= nz; j++) {
    for (let i = 0; i <= nx; i++) {
      pos[o++] = xs[i];
      pos[o++] = 0;
      pos[o++] = zs[j];
    }
  }
  const idx = new Uint32Array(nx * nz * 6);
  o = 0;
  for (let j = 0; j < nz; j++) {
    for (let i = 0; i < nx; i++) {
      const a = j * (nx + 1) + i;
      const b = a + 1;
      const c = a + nx + 1;
      const d = c + 1;
      idx[o++] = a;
      idx[o++] = c;
      idx[o++] = b;
      idx[o++] = b;
      idx[o++] = c;
      idx[o++] = d;
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  geo.setIndex(new THREE.BufferAttribute(idx, 1));
  geo.computeBoundingSphere();

  const n = opciones.niebla;
  const estelas: THREE.Vector4[] = [];
  for (let i = 0; i < MAX_ESTELAS; i++) estelas.push(new THREE.Vector4(0, 0, 0, 0));
  const U = UNIFORMES_MAR;
  const material = new THREE.ShaderMaterial({
    uniforms: {
      uTiempo: U.uTiempo,
      uOla: U.uOla,
      uCielo: U.uCielo,
      uRuido: U.uRuido,
      uSolDir: U.uSolDir,
      uSolColor: U.uSolColor,
      uAguaColor: U.uAguaColor,
      uFogColor: { value: new THREE.Color(n?.color ?? 0xa8c8da) },
      uFogNear: { value: n?.near ?? 30 },
      uFogFar: { value: n?.far ?? 105 },
      uOleaje: { value: opciones.oleaje ?? 1 },
      uRizo: { value: opciones.rizo ?? 0.55 },
      uOpacidad: { value: opciones.opacidad ?? 0.5 },
      uDeriva: { value: new THREE.Vector2(0.004, 0.002) },
      uEstelas: { value: estelas },
      uOrilla: { value: new THREE.Vector3(0, 0, 0) },
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
  // La ola desplaza los vértices en la GPU: la esfera en reposo no la cubre.
  m.frustumCulled = false;
  return { malla: m, ancho };
}

/** Anillos de espuma donde una pieza atraviesa la superficie. */
export function fijarEstelas(
  malla: Malla3D,
  estelas: { x: number; z: number; radio: number; fuerza?: number }[]
) {
  const u = (malla.material as THREE.ShaderMaterial).uniforms.uEstelas
    ?.value as THREE.Vector4[] | undefined;
  if (!u) return;
  for (let i = 0; i < MAX_ESTELAS; i++) {
    const e = estelas[i];
    if (e) u[i].set(e.x, e.z, e.radio, e.fuerza ?? 0.8);
    else u[i].set(0, 0, 0, 0);
  }
}

// ---------------------------------------------------------------------------
// Tinte de lo sumergido
// ---------------------------------------------------------------------------

const DECL_SUMERGIDO = /* glsl */ `
varying vec3 vPosMundo;
uniform float uTiempo;
uniform vec2 uNiveles;
uniform float uDivisorZ;
uniform vec3 uOla;
uniform vec3 uAguaColor;
uniform float uTurbidez;
uniform float uCorteX;
uniform sampler2D uRuido;
`;

const FRAG_SUMERGIDO = /* glsl */ `
{
  float ladoMar = step( uDivisorZ, vPosMundo.z );
  float nivel = mix( uNiveles.y, uNiveles.x, ladoMar );
  nivel += ladoMar * uOla.x * cos( uOla.y * vPosMundo.x - uOla.z * uTiempo );
  float prof = nivel - vPosMundo.y;
  // Lo que queda por delante de un corte didáctico está en seco.
  float enAgua = smoothstep( 0.0, 0.7, uCorteX - vPosMundo.x );
  // Franja mojada por encima de la línea de flotación.
  gl_FragColor.rgb *= mix( 1.0, 0.7, smoothstep( -0.4, 0.0, prof ) * step( prof, 0.0 ) * enAgua );
  if ( prof > 0.0 && enAgua > 0.0 ) {
    vec3 haciaCam = cameraPosition - vPosMundo;
    float dCam = length( haciaCam );
    // Tramo del rayo de vista que va por dentro del agua.
    float tramo = min( dCam, prof * dCam / max( haciaCam.y, 0.22 * dCam ) );
    // Con corte didáctico se mira a través del plano del corte.
    tramo = min( tramo, max( uCorteX - vPosMundo.x, 0.0 ) * dCam / max( haciaCam.x, 0.05 * dCam ) );
    vec3 nMundo = inverseTransformDirection( normal, viewMatrix );
    vec2 q = vPosMundo.xz * 0.17 + vPosMundo.y * 0.06;
    float a = texture2D( uRuido, q + uTiempo * vec2( 0.021, 0.013 ) ).r;
    float b = texture2D( uRuido, q * 1.37 + vec2( 0.37, 0.11 ) - uTiempo * vec2( 0.017, 0.019 ) ).a;
    // Cáusticas: brillan donde los dos campos coinciden (líneas que se mueven).
    float caust = pow( clamp( 1.0 - abs( a - b ) * 4.2, 0.0, 1.0 ), 5.0 );
    float deArriba = clamp( nMundo.y * 0.7 + 0.4, 0.0, 1.0 );
    vec3 c = gl_FragColor.rgb * ( 0.8 + caust * 1.1 * deArriba * exp( -prof * 0.16 ) );
    // El agua se come primero el rojo; lo que falta lo pone su propio color.
    vec3 paso = exp( -vec3( 0.15, 0.062, 0.05 ) * ( tramo + prof * 0.7 ) * uTurbidez );
    gl_FragColor.rgb = mix( gl_FragColor.rgb, c * paso + uAguaColor * ( 1.0 - paso.b ) * 1.6, enAgua );
  }
}
`;

/**
 * Hace que un material estándar se vea bajo el agua: absorción por distancia
 * recorrida, cáusticas y franja mojada. Por encima del nivel no cambia nada.
 */
export function sumergir<T extends THREE.Material>(material: T): T {
  const U = UNIFORMES_MAR;
  material.onBeforeCompile = (shader: {
    uniforms: Record<string, unknown>;
    vertexShader: string;
    fragmentShader: string;
  }) => {
    shader.uniforms.uTiempo = U.uTiempo;
    shader.uniforms.uNiveles = U.uNiveles;
    shader.uniforms.uDivisorZ = U.uDivisorZ;
    shader.uniforms.uOla = U.uOla;
    shader.uniforms.uAguaColor = U.uAguaColor;
    shader.uniforms.uTurbidez = U.uTurbidez;
    shader.uniforms.uCorteX = U.uCorteX;
    shader.uniforms.uRuido = U.uRuido;
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nvarying vec3 vPosMundo;")
      .replace(
        "#include <project_vertex>",
        `#include <project_vertex>
        vec4 posMar = vec4( transformed, 1.0 );
        #ifdef USE_INSTANCING
          posMar = instanceMatrix * posMar;
        #endif
        vPosMundo = ( modelMatrix * posMar ).xyz;`
      );
    shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>", "#include <common>\n" + DECL_SUMERGIDO)
      .replace(
        "#include <opaque_fragment>",
        "#include <opaque_fragment>\n" + FRAG_SUMERGIDO
      );
  };
  material.customProgramCacheKey = () => "sumergible";
  return material;
}

// ---------------------------------------------------------------------------
// Cara de agua en un corte didáctico
// ---------------------------------------------------------------------------

const FRAG_CORTE = /* glsl */ `
precision highp float;
uniform sampler2D uRuido;
uniform vec3 uAguaColor;
uniform float uTiempo;
uniform float uAlto;
varying vec2 vUv;
varying vec3 vMundo;
void main() {
  float prof = ( 1.0 - vUv.y ) * uAlto;
  // Haces de luz que bajan desde la superficie y se apagan con la profundidad.
  float haz = texture2D( uRuido, vec2( vMundo.z * 0.045 + uTiempo * 0.006, 0.31 ) ).r;
  haz = smoothstep( 0.45, 0.75, haz ) * exp( -prof * 0.35 );
  vec3 col = mix( vec3( 0.05, 0.3, 0.38 ), uAguaColor * 1.5, smoothstep( 0.0, 5.5, prof ) );
  col += vec3( 0.12, 0.2, 0.18 ) * haz;
  // Línea de la lámina: marca el nivel en el corte.
  float lamina = smoothstep( 0.07, 0.0, prof );
  col = mix( col, vec3( 0.85, 0.96, 1.0 ), lamina );
  gl_FragColor = vec4( col, mix( 0.74, 0.95, lamina ) );
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

/**
 * Cara vertical de agua en el plano x = cte. de un corte (como el cristal de
 * un acuario). Va de zMin a zMax y de yFondo al nivel: `fijarNivelCorte`.
 */
export function crearCorteAgua(x: number, zMin: number, zMax: number, yFondo: number): Malla3D {
  const geo = new THREE.PlaneGeometry(zMax - zMin, 1);
  geo.translate(0, -0.5, 0);
  geo.rotateY(Math.PI / 2);
  const cara = new THREE.Mesh(
    geo,
    new THREE.ShaderMaterial({
      uniforms: {
        uRuido: UNIFORMES_MAR.uRuido,
        uAguaColor: UNIFORMES_MAR.uAguaColor,
        uTiempo: UNIFORMES_MAR.uTiempo,
        uAlto: { value: 1 },
      },
      vertexShader: /* glsl */ `
        varying vec2 vUv;
        varying vec3 vMundo;
        void main() {
          vUv = uv;
          vec4 w = modelMatrix * vec4( position, 1.0 );
          vMundo = w.xyz;
          gl_Position = projectionMatrix * viewMatrix * w;
        }`,
      fragmentShader: FRAG_CORTE,
      transparent: true,
      depthWrite: false,
    })
  );
  cara.position.set(x, 0, (zMin + zMax) / 2);
  cara.userData.yFondo = yFondo;
  cara.renderOrder = 3;
  return cara;
}

export function fijarNivelCorte(cara: Malla3D, nivel: number) {
  const alto = Math.max(0.01, nivel - (cara.userData.yFondo as number));
  cara.position.y = nivel;
  cara.scale.y = alto;
  (cara.material as THREE.ShaderMaterial).uniforms.uAlto.value = alto;
}

// ---------------------------------------------------------------------------
// Partículas en suspensión
// ---------------------------------------------------------------------------

const VERT_PART = /* glsl */ `
uniform float uTiempo;
uniform vec3 uOla;
uniform vec2 uNiveles;
uniform vec3 uCajaMin;
uniform vec3 uCajaTam;
uniform vec3 uAvance;
uniform float uOrbital;
uniform float uDecae;
uniform float uTam;
uniform float uPxPorUnidad;
attribute float aSemilla;
varying float vAlpha;
void main() {
  // Arrastre: la caja se recorre en bucle, sin saltos al cambiar la velocidad.
  vec3 p = uCajaMin + mod( position - uCajaMin + uAvance, uCajaTam );
  vec3 rel = ( p - uCajaMin ) / uCajaTam;
  float borde = smoothstep( 0.0, 0.12, rel.x ) * smoothstep( 1.0, 0.88, rel.x )
              * smoothstep( 0.0, 0.12, rel.z ) * smoothstep( 1.0, 0.88, rel.z );
  float prof = max( uNiveles.x - p.y, 0.0 );
  if ( uOrbital > 0.5 ) {
    // Órbitas de la ola lineal: radio a·e^(k·z), se apagan con la profundidad.
    float f = uOla.y * p.x - uOla.z * uTiempo;
    float r = uOla.x * exp( -uDecae * prof );
    p.x -= r * sin( f );
    p.y += r * cos( f );
  }
  vec4 mv = viewMatrix * vec4( p, 1.0 );
  gl_Position = projectionMatrix * mv;
  gl_PointSize = uTam * ( 0.6 + aSemilla * 0.8 ) * uPxPorUnidad / max( -mv.z, 0.5 );
  vAlpha = borde * exp( -prof * 0.07 ) * ( 0.45 + aSemilla * 0.55 );
}`;

const FRAG_PART = /* glsl */ `
precision highp float;
uniform vec3 uColor;
uniform float uOpacidad;
varying float vAlpha;
void main() {
  vec2 c = gl_PointCoord - 0.5;
  float a = smoothstep( 0.5, 0.08, length( c ) ) * vAlpha * uOpacidad;
  if ( a < 0.01 ) discard;
  gl_FragColor = vec4( uColor, a );
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

export interface OpcionesParticulas {
  cantidad: number;
  min: { x: number; y: number; z: number };
  max: { x: number; y: number; z: number };
  /** true: describen las órbitas de la ola. false: las arrastra la corriente. */
  orbital?: boolean;
  /** Decaimiento de la órbita por unidad de profundidad (k real × m/unidad). */
  decae?: number;
  tam?: number;
  opacidad?: number;
  semilla?: number;
}

/**
 * Nube de partículas en suspensión. `userData.avance` (Vector3) es el
 * desplazamiento acumulado por la corriente: la escena lo integra con dt.
 */
export function crearParticulas(o: OpcionesParticulas): THREE.Points {
  const pos = new Float32Array(o.cantidad * 3);
  const sem = new Float32Array(o.cantidad);
  let s = (o.semilla ?? 11) >>> 0 || 1;
  const azar = () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
  for (let i = 0; i < o.cantidad; i++) {
    pos[i * 3] = o.min.x + azar() * (o.max.x - o.min.x);
    pos[i * 3 + 1] = o.min.y + azar() * (o.max.y - o.min.y);
    pos[i * 3 + 2] = o.min.z + azar() * (o.max.z - o.min.z);
    sem[i] = azar();
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  geo.setAttribute("aSemilla", new THREE.BufferAttribute(sem, 1));
  const avance = new THREE.Vector3();
  const U = UNIFORMES_MAR;
  const mat = new THREE.ShaderMaterial({
    uniforms: {
      uTiempo: U.uTiempo,
      uOla: U.uOla,
      uNiveles: U.uNiveles,
      uCajaMin: { value: new THREE.Vector3(o.min.x, o.min.y, o.min.z) },
      uCajaTam: {
        value: new THREE.Vector3(o.max.x - o.min.x, o.max.y - o.min.y, o.max.z - o.min.z),
      },
      uAvance: { value: avance },
      uOrbital: { value: o.orbital ? 1 : 0 },
      uDecae: { value: o.decae ?? 0.3 },
      uTam: { value: o.tam ?? 0.09 },
      uPxPorUnidad: U.uPxPorUnidad,
      uColor: { value: new THREE.Color(0.78, 0.93, 0.95) },
      uOpacidad: { value: o.opacidad ?? 0.5 },
    },
    vertexShader: VERT_PART,
    fragmentShader: FRAG_PART,
    transparent: true,
    depthWrite: false,
  });
  const puntos = new THREE.Points(geo, mat);
  puntos.frustumCulled = false;
  puntos.renderOrder = 1;
  puntos.userData.avance = avance;
  return puntos;
}
