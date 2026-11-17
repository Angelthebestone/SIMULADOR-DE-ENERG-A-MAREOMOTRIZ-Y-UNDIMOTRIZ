// MarRealista — océano de portada con Three.js.
// Superficie Gerstner en el vertex shader (movimiento geométrico real) +
// fresnel, brillo solar y espuma de cresta. El cielo Preetham alimenta el
// environment map que refleja el agua.
//
// Normales analíticas (derivadas de Gerstner) y micro-oleaje con senos
// rotados: sin hash por celdas ni facetación de malla en el sombreado.

// @ts-ignore — three se empaqueta por Vite sin @types (build verificado)
import * as THREE from "three";
// @ts-ignore
import { Sky } from "three/addons/objects/Sky.js";

const GLSL_MAR = /* glsl */ `
uniform float uTiempo;
uniform float uAmplitud;

// Una componente Gerstner. Devuelve desplazamiento (dx, elev, dz) y, en
// dPdx/dPdz, las derivadas parciales de la posición respecto a (x,z) del
// plano de reposo — base de la normal analítica.
void gerstner(
  vec2 p, float t, float amp, float lon, vec2 dir, float q,
  inout vec3 despl,
  inout vec3 dPdx,
  inout vec3 dPdz
) {
  float k = 6.28318530718 / lon;
  float c = sqrt(9.81 / k);
  vec2 d = normalize(dir);
  float f = k * (dot(d, p) - c * t);
  float a = amp * uAmplitud;
  float s = sin(f);
  float co = cos(f);
  float qa = q * a;
  float akc = a * k * co;
  float qaks = qa * k * s;

  despl += vec3(d.x * qa * co, a * s, d.y * qa * co);
  // ∂/∂x
  dPdx += vec3(-d.x * d.x * qaks, d.x * akc, -d.x * d.y * qaks);
  // ∂/∂z
  dPdz += vec3(-d.x * d.y * qaks, d.y * akc, -d.y * d.y * qaks);
}

void campoOlas(
  vec2 p, float t,
  out vec3 despl,
  out vec3 normalMundo
) {
  despl = vec3(0.0);
  vec3 dPdx = vec3(1.0, 0.0, 0.0);
  vec3 dPdz = vec3(0.0, 0.0, 1.0);

  gerstner(p, t,         0.42, 56.0, vec2( 1.00,  0.22), 0.90, despl, dPdx, dPdz);
  gerstner(p, t * 1.05,  0.28, 31.0, vec2( 0.78, -0.52), 0.78, despl, dPdx, dPdz);
  gerstner(p, t * 0.93,  0.16, 17.0, vec2(-0.35,  0.92), 0.65, despl, dPdx, dPdz);
  gerstner(p, t * 1.17,  0.08,  9.5, vec2( 0.92,  0.30), 0.55, despl, dPdx, dPdz);
  gerstner(p, t * 1.29,  0.04,  5.0, vec2(-0.12, -0.99), 0.45, despl, dPdx, dPdz);

  // dPdx × dPdz da la normal del pará (x,z) del plano de reposo.
  normalMundo = normalize(cross(dPdz, dPdx));
  if (normalMundo.y < 0.0) normalMundo = -normalMundo;
}
`;

const VERT = /* glsl */ `
${GLSL_MAR}
varying vec3 vMundo;
varying vec3 vNormal;
varying float vCresta;

// Plano local XY rotado -90° en X → mundo (x, z, -y).
// El campo de olas vive en el plano horizontal mundo XZ: p = (local.x, -local.y).
void main() {
  vec2 p = vec2(position.x, -position.y);
  vec3 despl;
  vec3 nMundo;
  campoOlas(p, uTiempo, despl, nMundo);

  vec3 pos = vec3(position.x + despl.x, position.y - despl.z, position.z + despl.y);
  vCresta = smoothstep(0.12, 0.8, despl.y / max(uAmplitud * 0.5, 0.001));

  // La normal ya está en espacio mundo (derivadas del pará horizontal).
  vNormal = nMundo;

  vec4 mundo = modelMatrix * vec4(pos, 1.0);
  vMundo = mundo.xyz;
  gl_Position = projectionMatrix * viewMatrix * mundo;
}
`;

const FRAG = /* glsl */ `
precision highp float;

uniform vec3 uSol;
uniform vec3 uColorProfundo;
uniform vec3 uColorSomero;
uniform vec3 uColorSol;
uniform samplerCube uEnv;
uniform float uUsaEnv;
uniform float uTiempo;
varying vec3 vMundo;
varying vec3 vNormal;
varying float vCresta;

// Micro-oleaje continuo: suma de senos en direcciones rotadas.
// Nunca hay floor/hash, así que no aparece rejilla de celdas.
float microOlas(vec2 p, float t) {
  float v = 0.0;
  v += sin(p.x * 0.92 + t * 1.15);
  v += sin(p.y * 0.81 - t * 0.95);
  v += 0.85 * sin(dot(p, vec2(0.62, 0.78)) * 1.55 + t * 1.4);
  v += 0.7 * sin(dot(p, vec2(-0.74, 0.67)) * 2.35 - t * 0.85);
  v += 0.5 * sin(dot(p, vec2(0.2, -0.98)) * 3.8 + t * 2.1);
  return v * 0.2;
}

// Gradiente analítico del mismo campo (para perturbar la normal).
vec2 microOlasGrad(vec2 p, float t) {
  vec2 grad = vec2(0.0);
  // d/dx y d/dz de cada seno: A*ω*cos(...)
  grad.x += 0.92 * cos(p.x * 0.92 + t * 1.15);
  grad.y += 0.81 * cos(p.y * 0.81 - t * 0.95);
  vec2 d1 = vec2(0.62, 0.78);
  grad += 0.85 * 1.55 * d1 * cos(dot(p, d1) * 1.55 + t * 1.4);
  vec2 d2 = vec2(-0.74, 0.67);
  grad += 0.7 * 2.35 * d2 * cos(dot(p, d2) * 2.35 - t * 0.85);
  vec2 d3 = vec2(0.2, -0.98);
  grad += 0.5 * 3.8 * d3 * cos(dot(p, d3) * 3.8 + t * 2.1);
  return grad * 0.2;
}

void main() {
  vec3 n = normalize(vNormal);
  vec3 v = normalize(cameraPosition - vMundo);
  if (dot(n, v) < 0.0) n = -n;

  // Detalle fino continuo: se atenúa lejos para no crear aliasing.
  float distancia = length(cameraPosition.xz - vMundo.xz);
  float pesoMicro = exp(-distancia * 0.018) * 0.55;
  vec2 pMicro = vMundo.xz * 0.55 + vec2(uTiempo * 0.4, uTiempo * 0.55);
  vec2 gMicro = microOlasGrad(pMicro, uTiempo);
  n = normalize(n + vec3(-gMicro.x, 0.0, -gMicro.y) * pesoMicro);

  float fresnel = pow(1.0 - max(dot(n, v), 0.0), 5.0);
  fresnel = mix(0.035, 1.0, fresnel);

  float mezcla = clamp(vMundo.y * 0.65 + 0.5, 0.0, 1.0);
  vec3 base = mix(uColorProfundo, uColorSomero, mezcla);

  vec3 r = reflect(-v, n);
  vec3 reflejo;
  if (uUsaEnv > 0.5) {
    // Reflejo contenido: el cielo cubierto entero aclara el mar hasta dejar
    // sin contraste el texto de la portada.
    reflejo = textureCube(uEnv, r).rgb * 0.13;
  } else {
    float hh = clamp(r.y, 0.0, 1.0);
    reflejo = mix(vec3(0.55, 0.68, 0.78), vec3(0.22, 0.42, 0.62), hh);
  }

  vec3 h = normalize(uSol + v);
  float ndh = max(dot(n, h), 0.0);
  float espec = pow(ndh, 140.0) * 0.9 + pow(ndh, 20.0) * 0.2;
  // Modulación con los mismos senos del micro-oleaje (sin celdas).
  float mod = 0.9 + 0.35 * microOlas(pMicro * 1.7, uTiempo * 1.2);
  espec *= clamp(mod, 0.5, 1.3);

  float espuma = smoothstep(0.74, 1.0, vCresta)
    * clamp(0.4 + 0.5 * microOlas(vMundo.xz * 0.4, uTiempo * 0.9), 0.0, 1.0);

  vec3 color = mix(base, reflejo, fresnel * 0.95);
  color += uColorSol * espec * 1.85;
  color = mix(color, vec3(0.93, 0.96, 0.98), espuma * 0.5);

  float lejos = clamp(distancia / 1100.0, 0.0, 1.0);
  color = mix(color, vec3(0.60, 0.71, 0.80), lejos * lejos * 0.88);

  gl_FragColor = vec4(color, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`;

export class MarRealista {
  contenedor: HTMLElement;
  pausado = false;

  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private mar: THREE.Mesh | null = null;
  private material: THREE.ShaderMaterial | null = null;
  private sky: InstanceType<typeof Sky> | null = null;
  private sol = new THREE.Vector3();
  private cubo: THREE.WebGLCubeRenderTarget | null = null;
  private rafId: number | null = null;
  private tSim = 0;
  private inicioMs = 0;
  private observador: ResizeObserver | null = null;
  private reducido = false;
  private calidadBaja = false;

  constructor(contenedor: HTMLElement) {
    this.contenedor = contenedor;

    if (typeof window !== "undefined" && window.matchMedia) {
      // Preferencia del SO: sólo baja amplitud. El mar de portada debe
      // moverse siempre; congelarlo deja la escena muerta.
      const m = window.matchMedia("(prefers-reduced-motion: reduce)");
      this.reducido = m.matches;
    }

    const ancho = Math.max(2, contenedor.clientWidth || 1280);
    const alto = Math.max(2, contenedor.clientHeight || 720);

    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: false,
      powerPreference: "high-performance",
    });
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.renderer.setPixelRatio(dpr);
    this.renderer.setSize(ancho, alto);
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 0.58;
    this.renderer.domElement.style.display = "block";
    this.renderer.domElement.style.width = "100%";
    this.renderer.domElement.style.height = "100%";
    this.renderer.domElement.setAttribute("aria-hidden", "true");
    contenedor.appendChild(this.renderer.domElement);

    this.calidadBaja = ancho * alto * dpr * dpr > 3.2e6;

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(52, ancho / alto, 0.5, 25000);

    try {
      this.construir();
    } catch (e) {
      console.warn("[MarRealista] no se pudo construir el océano", e);
      this.pausado = true;
    }

    if (typeof ResizeObserver !== "undefined") {
      this.observador = new ResizeObserver(() => this.ajustar());
      this.observador.observe(contenedor);
    }
  }

  private construir() {
    const elevacion = 24;
    const azimuth = 155;
    const phi = THREE.MathUtils.degToRad(90 - elevacion);
    const theta = THREE.MathUtils.degToRad(azimuth);
    this.sol.setFromSphericalCoords(1, phi, theta);

    const sky = new Sky();
    sky.scale.setScalar(20000);
    const u = sky.material.uniforms;
    u.turbidity.value = 2.8;
    u.rayleigh.value = 2.4;
    u.mieCoefficient.value = 0.003;
    u.mieDirectionalG.value = 0.86;
    u.sunPosition.value.copy(this.sol);
    this.sky = sky;

    // El agua muestrea un samplerCube: el cielo se hornea una vez en un cubo.
    // (La textura PMREM es 2D; enlazarla a un samplerCube dejaba el reflejo
    // sin textura y un aviso de WebGL en cada programa.)
    const sceneEnv = new THREE.Scene();
    sceneEnv.add(sky);
    const cubo = new THREE.WebGLCubeRenderTarget(256, {
      type: THREE.HalfFloatType,
      generateMipmaps: true,
      minFilter: THREE.LinearMipmapLinearFilter,
    });
    new THREE.CubeCamera(1, 60000, cubo).update(this.renderer, sceneEnv);
    this.cubo = cubo;
    const envMap: THREE.Texture = cubo.texture;
    this.scene.add(sky);

    // La silueta de las olas grandes necesita densidad; el sombreado ya no
    // depende de la malla (normales analíticas en el vertex shader).
    const segmentos = this.calidadBaja || this.reducido ? 320 : 512;
    const geo = new THREE.PlaneGeometry(1400, 1400, segmentos, segmentos);

    const material = new THREE.ShaderMaterial({
      vertexShader: VERT,
      fragmentShader: FRAG,
      uniforms: {
        uTiempo: { value: 0 },
        uAmplitud: { value: this.reducido ? 0.55 : 1.0 },
        uSol: { value: this.sol.clone().normalize() },
        uColorProfundo: { value: new THREE.Color(0x052832) },
        uColorSomero: { value: new THREE.Color(0x0e7380) },
        uColorSol: { value: new THREE.Color(0xffe6b0) },
        uEnv: { value: envMap },
        uUsaEnv: { value: 1 },
      },
      side: THREE.FrontSide,
    });
    this.material = material;

    const mar = new THREE.Mesh(geo, material);
    mar.rotation.x = -Math.PI / 2;
    mar.position.y = 0;
    this.mar = mar;
    this.scene.add(mar);

    const luz = new THREE.DirectionalLight(0xfff0d8, 0.9);
    luz.position.copy(this.sol).multiplyScalar(200);
    this.scene.add(luz);
    this.scene.add(new THREE.AmbientLight(0x6a9bb0, 0.25));

    this.camera.position.set(0, 6.2, 16);
    this.camera.lookAt(0, 2.0, -55);
  }

  private ajustar() {
    const w = Math.max(2, this.contenedor.clientWidth);
    const h = Math.max(2, this.contenedor.clientHeight);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
    if (this.pausado) this.dibujar();
  }

  private dibujar() {
    if (this.material) {
      this.material.uniforms.uTiempo.value = this.tSim;
    }
    const t = this.tSim;
    const bob = this.reducido
      ? 0
      : Math.sin(t * 0.55) * 0.14 + Math.sin(t * 0.31 + 1.2) * 0.07;
    const deriva = this.reducido ? 0 : Math.sin(t * 0.17) * 0.65;
    this.camera.position.x = deriva;
    this.camera.position.y = 6.2 + bob;
    this.camera.lookAt(deriva * 0.35, 2.0 + bob * 0.45, -55);
    this.renderer.render(this.scene, this.camera);
  }

  arrancar() {
    // Siempre arranca: un pausado residual no debe congelar la portada.
    this.pausado = false;
    if (this.rafId != null) cancelAnimationFrame(this.rafId);
    this.inicioMs = performance.now();
    const paso = (marca: number) => {
      if (this.pausado) {
        this.rafId = null;
        return;
      }
      // Reloj absoluto: el oleaje avanza aunque se acumulen saltos de dt.
      const t = (marca - this.inicioMs) / 1000;
      this.tSim = t * (this.reducido ? 0.7 : 1.45);
      this.dibujar();
      this.rafId = requestAnimationFrame(paso);
    };
    this.rafId = requestAnimationFrame(paso);
  }

  pausar() {
    this.pausado = true;
    if (this.rafId != null) cancelAnimationFrame(this.rafId);
    this.rafId = null;
  }

  detener() {
    this.pausar();
    this.observador?.disconnect();
    this.observador = null;
    if (this.mar) {
      this.mar.geometry.dispose();
      this.scene.remove(this.mar);
      this.mar = null;
    }
    this.material?.dispose();
    this.material = null;
    this.cubo?.dispose();
    this.cubo = null;
    this.renderer.dispose();
    if (this.renderer.domElement.parentElement === this.contenedor) {
      this.contenedor.removeChild(this.renderer.domElement);
    }
  }
}
