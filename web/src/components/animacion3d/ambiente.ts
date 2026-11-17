// Ambiente compartido de las escenas 3D: cielo con nubes horneado una vez en
// un cubo (fondo + reflejos del agua + luz de entorno PMREM) y la textura de
// ruido que usan agua, cáusticas y espuma. Todo se genera en la GPU o en
// memoria: no hay ficheros que cargar ni peticiones de red.

// @ts-ignore — three se empaqueta por Vite sin @types (build verificado)
import * as THREE from "three";

/** Uniformes vivos que comparten el agua y los materiales sumergidos. */
export const UNIFORMES_MAR = {
  uTiempo: { value: 0 },
  /** x = nivel del mar, y = nivel del embalse (mundo). */
  uNiveles: { value: new THREE.Vector2(0, 0) },
  /** z de mundo que separa mar (z mayor) de embalse. Muy negativo: solo mar. */
  uDivisorZ: { value: -1e6 },
  /** Ola del modelo: x = amplitud, y = número de onda (1/unidad), z = ω. */
  uOla: { value: new THREE.Vector3(0, 0.2, 1) },
  uSolDir: { value: new THREE.Vector3(0.5, 0.6, 0.3).normalize() },
  uSolColor: { value: new THREE.Color(1.0, 0.93, 0.8) },
  /** Color del agua iluminada en volumen (lo que tiñe lo sumergido). */
  uAguaColor: { value: new THREE.Color(0.012, 0.085, 0.12) },
  /** Extinción del agua: 1 = costa limpia; más alto, agua más turbia. */
  uTurbidez: { value: 1 },
  /** Plano x = cte. donde un corte didáctico deja el agua a la vista (el
   *  dique). Lo sumergido se ve a través de ese plano, no desde la superficie. */
  uCorteX: { value: 1e6 },
  /** Píxeles de pantalla por unidad de mundo a 1 unidad de la cámara. */
  uPxPorUnidad: { value: 800 },
  uRuido: { value: null as THREE.Texture | null },
  uCielo: { value: null as THREE.Texture | null },
};

const VERT_CIELO = /* glsl */ `
varying vec3 vDir;
void main() {
  vDir = position;
  gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
}`;

const FRAG_CIELO = /* glsl */ `
precision highp float;
varying vec3 vDir;
uniform vec3 uSol;
uniform vec3 uHorizonte;

float hash( vec2 p ) {
  p = fract( p * vec2( 123.34, 456.21 ) );
  p += dot( p, p + 45.32 );
  return fract( p.x * p.y );
}
float ruido( vec2 p ) {
  vec2 i = floor( p );
  vec2 f = fract( p );
  f = f * f * ( 3.0 - 2.0 * f );
  return mix(
    mix( hash( i ), hash( i + vec2( 1.0, 0.0 ) ), f.x ),
    mix( hash( i + vec2( 0.0, 1.0 ) ), hash( i + vec2( 1.0, 1.0 ) ), f.x ),
    f.y );
}
float fbm( vec2 p ) {
  float a = 0.5;
  float s = 0.0;
  for ( int i = 0; i < 6; i++ ) {
    s += a * ruido( p );
    p = p * 2.03 + vec2( 17.1, 9.2 );
    a *= 0.5;
  }
  return s;
}

void main() {
  vec3 d = normalize( vDir );
  float h = max( d.y, 0.0 );
  vec3 cenit = vec3( 0.07, 0.2, 0.5 );
  vec3 col = mix( uHorizonte, cenit, 1.0 - exp( -h * 3.4 ) );

  float cs = max( dot( d, uSol ), 0.0 );
  // Halo cálido alrededor del sol y disco HDR (da el destello a los metales).
  col += vec3( 1.0, 0.8, 0.55 ) * ( pow( cs, 10.0 ) * 0.22 + pow( cs, 160.0 ) * 0.9 );
  col += vec3( 1.0, 0.95, 0.85 ) * smoothstep( 0.9994, 0.9998, cs ) * 30.0;

  if ( d.y > 0.0 ) {
    // Cúmulos sobre un plano alto: se aplastan hacia el horizonte.
    vec2 uv = d.xz / ( d.y + 0.14 );
    float dens = fbm( uv * 1.15 + 3.7 );
    float haciaSol = fbm( ( uv + uSol.xz * 0.16 ) * 1.15 + 3.7 );
    float cob = smoothstep( 0.5, 0.74, dens );
    float luz = clamp( 0.55 + ( dens - haciaSol ) * 4.5, 0.0, 1.0 );
    vec3 nube = mix( vec3( 0.5, 0.57, 0.67 ), vec3( 1.25, 1.2, 1.12 ), luz );
    // Velo de cirros: rompe el degradado limpio del cenit.
    float cirro = smoothstep( 0.45, 0.9, fbm( uv * vec2( 0.5, 2.4 ) + 11.0 ) ) * 0.22;
    col = mix( col, vec3( 0.95, 0.97, 1.0 ), cirro * smoothstep( 0.05, 0.4, d.y ) );
    col = mix( col, nube, cob * smoothstep( 0.03, 0.26, d.y ) * 0.88 );
  } else {
    // Bajo el horizonte: mar en penumbra (solo cuenta para la luz de entorno).
    col = mix( uHorizonte, vec3( 0.02, 0.08, 0.12 ), smoothstep( 0.0, -0.3, d.y ) );
  }
  gl_FragColor = vec4( col, 1.0 );
}`;

/** Ruido de valor periódico (enlosa sin costuras) con varias octavas. */
export function ruidoPeriodico(tam: number, periodoBase: number, octavas: number, semilla: number) {
  let s = semilla >>> 0 || 1;
  const azar = () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
  const campo = new Float32Array(tam * tam);
  let amp = 0.5;
  let total = 0;
  for (let o = 0; o < octavas; o++) {
    const periodo = periodoBase << o;
    const red = new Float32Array(periodo * periodo);
    for (let i = 0; i < red.length; i++) red[i] = azar();
    const escala = periodo / tam;
    for (let y = 0; y < tam; y++) {
      const fy = y * escala;
      const y0 = Math.floor(fy);
      const ty = fy - y0;
      const sy = ty * ty * (3 - 2 * ty);
      const ya = (y0 % periodo) * periodo;
      const yb = ((y0 + 1) % periodo) * periodo;
      for (let x = 0; x < tam; x++) {
        const fx = x * escala;
        const x0 = Math.floor(fx);
        const tx = fx - x0;
        const sx = tx * tx * (3 - 2 * tx);
        const xa = x0 % periodo;
        const xb = (x0 + 1) % periodo;
        const a = red[ya + xa] + (red[ya + xb] - red[ya + xa]) * sx;
        const b = red[yb + xa] + (red[yb + xb] - red[yb + xa]) * sx;
        campo[y * tam + x] += (a + (b - a) * sy) * amp;
      }
    }
    total += amp;
    amp *= 0.5;
  }
  for (let i = 0; i < campo.length; i++) campo[i] /= total;
  return campo;
}

/**
 * Textura de ruido 256²: R = altura, G/B = pendiente de esa altura (para
 * perturbar normales sin derivar en el fragmento), A = ruido independiente.
 */
function crearTexturaRuido(): THREE.DataTexture {
  const tam = 256;
  const altura = ruidoPeriodico(tam, 4, 5, 9173);
  const otro = ruidoPeriodico(tam, 8, 4, 40213);
  const datos = new Uint8Array(tam * tam * 4);
  const en = (x: number, y: number) =>
    altura[((y + tam) % tam) * tam + ((x + tam) % tam)];
  for (let y = 0; y < tam; y++) {
    for (let x = 0; x < tam; x++) {
      const i = (y * tam + x) * 4;
      const dx = (en(x + 1, y) - en(x - 1, y)) * 9;
      const dy = (en(x, y + 1) - en(x, y - 1)) * 9;
      datos[i] = Math.round(altura[y * tam + x] * 255);
      datos[i + 1] = Math.round(Math.max(0, Math.min(1, 0.5 + dx)) * 255);
      datos[i + 2] = Math.round(Math.max(0, Math.min(1, 0.5 + dy)) * 255);
      datos[i + 3] = Math.round(otro[y * tam + x] * 255);
    }
  }
  const tex = new THREE.DataTexture(datos, tam, tam, THREE.RGBAFormat);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.generateMipmaps = true;
  tex.needsUpdate = true;
  return tex;
}

/** Cielo + entorno + ruido. Vive lo que el renderer; el motor lo libera. */
export class Ambiente {
  readonly ruido: THREE.DataTexture;
  private cubo: THREE.WebGLCubeRenderTarget;
  private pmrem: THREE.PMREMGenerator;
  private entorno: THREE.WebGLRenderTarget | null = null;
  private escenaCielo = new THREE.Scene();
  private matCielo: THREE.ShaderMaterial;
  private camaraCubo: THREE.CubeCamera;
  private clave = "";
  private renderer: THREE.WebGLRenderer;

  constructor(renderer: THREE.WebGLRenderer, calidadBaja: boolean) {
    this.renderer = renderer;
    this.ruido = crearTexturaRuido();
    UNIFORMES_MAR.uRuido.value = this.ruido;
    this.cubo = new THREE.WebGLCubeRenderTarget(calidadBaja ? 256 : 1024, {
      type: THREE.HalfFloatType,
      generateMipmaps: true,
      minFilter: THREE.LinearMipmapLinearFilter,
    });
    this.camaraCubo = new THREE.CubeCamera(0.1, 10, this.cubo);
    this.matCielo = new THREE.ShaderMaterial({
      vertexShader: VERT_CIELO,
      fragmentShader: FRAG_CIELO,
      side: THREE.BackSide,
      depthWrite: false,
      uniforms: {
        uSol: { value: new THREE.Vector3(0, 1, 0) },
        uHorizonte: { value: new THREE.Color() },
      },
    });
    this.escenaCielo.add(
      new THREE.Mesh(new THREE.BoxGeometry(2, 2, 2), this.matCielo)
    );
    this.pmrem = new THREE.PMREMGenerator(renderer);
  }

  /** Hornea el cielo para ese sol y lo deja como fondo y entorno. */
  aplicar(escena: THREE.Scene, sol: THREE.Vector3, horizonte: THREE.Color) {
    const clave = `${sol.x.toFixed(3)},${sol.y.toFixed(3)},${sol.z.toFixed(3)},${horizonte.getHex()}`;
    if (clave !== this.clave) {
      this.clave = clave;
      this.matCielo.uniforms.uSol.value.copy(sol).normalize();
      this.matCielo.uniforms.uHorizonte.value.copy(horizonte);
      this.camaraCubo.update(this.renderer, this.escenaCielo);
      this.entorno?.dispose();
      this.entorno = this.pmrem.fromCubemap(this.cubo.texture);
    }
    escena.background = this.cubo.texture;
    escena.environment = this.entorno?.texture ?? null;
    UNIFORMES_MAR.uCielo.value = this.cubo.texture;
    UNIFORMES_MAR.uSolDir.value.copy(sol).normalize();
  }

  liberar() {
    this.cubo.dispose();
    this.entorno?.dispose();
    this.pmrem.dispose();
    this.ruido.dispose();
    this.matCielo.dispose();
  }
}
