// Escena 3D del dique mareal — maqueta en corte de una central mareomotriz.
//
// El dique corre por −X hasta perderse en la bruma y cierra el estuario. Un
// plano de corte en x = 0 (como el cristal de un acuario) lo secciona justo
// por el eje de un grupo bulbo: a la izquierda queda el mar (+Z), a la
// derecha el embalse (−Z) y, en medio, el conducto con la turbina entera.
//
// Física que se ve:
//   - el mar sube y baja con el rango de marea a escala (ESCALA_V u/m) y el
//     embalse lo sigue con retraso: entre las dos láminas queda el salto h;
//   - el caudal por el conducto va con √h (Torricelli) y cambia de sentido
//     cuando se invierte el salto; el rodete gira con ese caudal.

// @ts-ignore — three se empaqueta por Vite sin @types
import * as THREE from "three";
import { formatearNumero } from "../../../utils/formato";
import type {
  ContextoEscena3D,
  Encuadre3D,
  Escena3D,
  Grupo3D,
  ManijasEscena3D,
} from "../tipos";
import { manijasVacias } from "../tipos";
import { UNIFORMES_MAR } from "../ambiente";
import { crearCorteAgua, crearSuperficieMar, fijarNivelCorte } from "../agua";
import { texturaEstratos, texturaHormigon } from "../texturas";
import {
  crearEtiqueta,
  crearLechoArena,
  crearMatPintado,
  crearRocasLecho,
  pintarEtiqueta,
} from "../utilidades";

const COL = {
  hormigon: 0xc9c5ba,
  hormigonClaro: 0xdedad0,
  hormigonOsc: 0x8f8c83,
  asfalto: 0x34383b,
  aceroOsc: 0x56616a,
  bulbo: 0xe3e6e8,
  rodete: 0xb98a4a,
  amarillo: 0xf0b400,
  tejado: 0x4a5258,
  vidrio: 0x23404f,
  cota: 0xc7e14a,
} as const;

/** Unidades de mundo por metro en vertical: los 15 m del tope del mando
 *  caben entre la berma (bajamar) y la coronación (pleamar). */
const ESCALA_V = 0.25;
const Y_LECHO = -6.4;
const Y_MEDIO = -0.6;
const Y_CORONA = 2.0;
/** Cuerpo bajo (cajón de la sala de máquinas) y cuerpo alto del dique, en Z. */
const Z_MAR = 1.8;
const Z_EMB = -6.2;
/** Paramento del embalse y eje de la coronación (el del mar está en z = 0). */
const Z_TRAS = -4.4;
const ZC = Z_TRAS / 2;
const Y_BERMA = -2.55;
/** Eje del conducto y radios. */
const Y_EJE = -4.3;
const R_GARGANTA = 1.3;
const R_BULBO = 0.74;
const Z_RODETE = -3.0;
/** Fondo (en X) del bloque seccionado: detrás sigue el dique macizo. */
const X_BLOQUE = -2.4;
/** Periodo de marea comprimido: un ciclo de 12,4 h en 15 s. */
const OMEGA_MAREA = 0.42;
const NIEBLA = { color: 0xa8c8da, near: 45, far: 165 };

/** Radio de la pared del conducto a lo largo de Z (abocinado–garganta–difusor). */
function radioPared(z: number): number {
  if (z > 0.6) return R_GARGANTA + 0.2 * Math.pow((z - 0.6) / (Z_MAR - 0.6), 2);
  if (z > -3.6) return R_GARGANTA;
  return R_GARGANTA + 0.3 * ((-3.6 - z) / (-3.6 - Z_EMB));
}

/** Radio del bulbo a lo largo de Z (0 fuera de él). Nariz hacia el mar. */
function radioBulbo(z: number): number {
  if (z > 0.4 || z < -2.65) return 0;
  if (z > -0.5) return R_BULBO * Math.sqrt(Math.max(0, 1 - Math.pow((z + 0.5) / 0.9, 2)));
  if (z > -1.7) return R_BULBO;
  return R_BULBO - 0.4 * ((-1.7 - z) / 0.95);
}

/** Álabe Kaplan: lámina helicoidal ancha, con más paso cerca del cubo. */
function geometriaAlabe(calidadBaja: boolean): THREE.BufferGeometry {
  const nr = calidadBaja ? 4 : 8;
  const nf = calidadBaja ? 4 : 10;
  const pos: number[] = [];
  for (let i = 0; i <= nr; i++) {
    const r = 0.3 + (R_GARGANTA - 0.1 - 0.3) * (i / nr);
    const semi = 0.62 - 0.1 * (i / nr);
    for (let j = 0; j <= nf; j++) {
      const f = -semi + 2 * semi * (j / nf);
      pos.push(r * Math.sin(f), r * Math.cos(f), f * (0.32 + 0.12 / r));
    }
  }
  const idx: number[] = [];
  for (let i = 0; i < nr; i++) {
    for (let j = 0; j < nf; j++) {
      const a = i * (nf + 1) + j;
      idx.push(a, a + 1, a + nf + 1, a + 1, a + nf + 2, a + nf + 1);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  return geo;
}

/** Contorno exterior de la sección del dique, del pie del mar al del embalse. */
const CONTORNO: [number, number][] = [
  [Z_MAR, Y_BERMA],
  [0, Y_BERMA + 0.08],
  [0, Y_CORONA],
  [Z_TRAS, Y_CORONA],
  [Z_TRAS, Y_BERMA + 0.08],
  [Z_EMB, Y_BERMA],
];

/** Extruye una sección (z, y) a lo largo de −X desde x0, con `fondo` de largo. */
function extruir(
  seccion: THREE.Shape,
  x0: number,
  fondo: number,
  material: THREE.Material
): THREE.Mesh {
  const geo = new THREE.ExtrudeGeometry(seccion, {
    depth: fondo,
    bevelEnabled: false,
    steps: 1,
  });
  // La extrusión nace en +Z local; se tumba para que corra hacia −X.
  geo.rotateY(-Math.PI / 2);
  const malla = new THREE.Mesh(geo, material);
  malla.position.x = x0;
  malla.castShadow = true;
  malla.receiveShadow = true;
  return malla;
}

export const escenaDique: Escena3D = {
  encuadre(): Encuadre3D {
    // Frente al corte, algo desplazada hacia el mar y elevada: el corte se
    // lee como una sección de libro y el dique se aleja en perspectiva.
    return {
      posicion: { x: 16, y: 3.2, z: 2.2 },
      lookAt: { x: 0, y: -2.2, z: ZC },
      fondo: NIEBLA.color,
      niebla: { near: NIEBLA.near, far: NIEBLA.far },
      radio: 5.9,
      margen: 1.04,
      sol: { x: 0.52, y: 0.62, z: 0.58 },
      escalaOla: ESCALA_V,
    };
  },

  construir(g: Grupo3D, ctx: ContextoEscena3D): ManijasEscena3D {
    const m = manijasVacias();
    const mat = ctx.mat;
    const B = ctx.calidadBaja;
    const seg = B ? 16 : 40;

    // Agua de estuario algo más clara; el corte se mira a través de x = 0.
    UNIFORMES_MAR.uTurbidez.value = 0.6;
    UNIFORMES_MAR.uDivisorZ.value = Z_RODETE - 0.75;
    UNIFORMES_MAR.uCorteX.value = 0;

    const texH = texturaHormigon();
    const texLargo = texH.clone();
    texLargo.repeat.set(0.11, 0.11);
    texLargo.userData.desechable = true;
    texLargo.needsUpdate = true;
    const hormigon = (
      color: number,
      tex = texH,
      extra: Record<string, unknown> = {}
    ) =>
      mat(color, {
        map: tex,
        bumpMap: tex,
        bumpScale: 1.2,
        roughness: 0.92,
        metalness: 0.0,
        ...extra,
      });
    const acero = (color: number) =>
      crearMatPintado(color, { roughness: 0.45, metalness: 0.5 });

    // =====================================================================
    // LECHO y corte del terreno
    // =====================================================================
    const lecho = crearLechoArena(260, 400, Y_LECHO, B, { amplitud: 0 });
    lecho.position.x = -130;
    g.add(lecho);
    const rocas = crearRocasLecho(B ? 8 : 18, 110, 90, Y_LECHO, 53);
    rocas.position.x = -32;
    g.add(rocas);

    const estratos = texturaEstratos().clone();
    estratos.repeat.set(18, 1);
    estratos.userData.desechable = true;
    estratos.needsUpdate = true;
    const altoTerreno = 22;
    const terreno = new THREE.Mesh(
      new THREE.PlaneGeometry(400, altoTerreno),
      new THREE.MeshStandardMaterial({ map: estratos, roughness: 1, metalness: 0 })
    );
    terreno.rotation.y = Math.PI / 2;
    terreno.position.set(-0.01, Y_LECHO - altoTerreno / 2, 0);
    g.add(terreno);

    // =====================================================================
    // CUERPO DEL DIQUE
    // =====================================================================
    const macizo = new THREE.Shape();
    macizo.moveTo(Z_MAR, Y_LECHO);
    for (const [z, y] of CONTORNO) macizo.lineTo(z, y);
    macizo.lineTo(Z_EMB, Y_LECHO);
    macizo.closePath();
    const matCuerpo = hormigon(COL.hormigon, texLargo);
    g.add(extruir(macizo, X_BLOQUE, 112, matCuerpo));

    // Bloque seccionado: hormigón por encima y por debajo del conducto. La
    // cara de x = 0 es la sección que se lee; el hueco es el paso del agua.
    const N = 28;
    const zs: number[] = [];
    for (let i = 0; i <= N; i++) zs.push(Z_MAR + (Z_EMB - Z_MAR) * (i / N));
    const arriba = new THREE.Shape();
    arriba.moveTo(Z_MAR, Y_EJE + radioPared(Z_MAR));
    for (const [z, y] of CONTORNO) arriba.lineTo(z, y);
    for (let i = N; i >= 0; i--) arriba.lineTo(zs[i], Y_EJE + radioPared(zs[i]));
    const abajo = new THREE.Shape();
    abajo.moveTo(Z_MAR, Y_LECHO);
    for (let i = 0; i <= N; i++) abajo.lineTo(zs[i], Y_EJE - radioPared(zs[i]));
    abajo.lineTo(Z_EMB, Y_LECHO);
    abajo.closePath();
    // Sección algo más oscura: se distingue el corte del paramento exterior.
    const matSeccion = hormigon(COL.hormigonOsc, texLargo);
    g.add(extruir(arriba, 0, -X_BLOQUE, matSeccion));
    g.add(extruir(abajo, 0, -X_BLOQUE, matSeccion));

    // Media caña del conducto (la mitad que queda detrás del plano de corte).
    const perfilConducto: THREE.Vector2[] = [];
    for (let i = N; i >= 0; i--) {
      perfilConducto.push(new THREE.Vector2(radioPared(zs[i]), zs[i]));
    }
    const conducto = new THREE.Mesh(
      new THREE.LatheGeometry(perfilConducto, B ? 12 : 24, Math.PI, Math.PI),
      hormigon(COL.hormigonOsc, texH, { side: THREE.DoubleSide })
    );
    conducto.rotation.x = Math.PI / 2;
    conducto.position.y = Y_EJE;
    conducto.receiveShadow = true;
    g.add(conducto);

    // Escollera al pie, a los dos lados: protege la cimentación de la socavación.
    const matPiedra = mat(0x7b7c74, { roughness: 0.96, metalness: 0, flatShading: true });
    let sem = 97;
    const azar = () => {
      sem = (sem * 1664525 + 1013904223) >>> 0;
      return sem / 4294967296;
    };
    const nPiedras = B ? 60 : 200;
    const escollera = new THREE.InstancedMesh(
      new THREE.IcosahedronGeometry(1, 1),
      matPiedra,
      nPiedras
    );
    const tmp = new THREE.Object3D();
    for (let i = 0; i < nPiedras; i++) {
      const mar = i % 2 === 0;
      const e = 0.16 + azar() * 0.24;
      tmp.position.set(
        -0.4 - azar() * azar() * 46,
        Y_LECHO + 0.08 + azar() * 0.3,
        mar ? Z_MAR + 0.2 + azar() * 1.5 : Z_EMB - 0.2 - azar() * 1.5
      );
      tmp.scale.set(
        e * (0.9 + azar() * 0.6),
        e * (0.6 + azar() * 0.4),
        e * (0.9 + azar() * 0.6)
      );
      tmp.rotation.set(azar() * 3, azar() * 3, azar() * 3);
      tmp.updateMatrix();
      escollera.setMatrixAt(i, tmp.matrix);
    }
    escollera.castShadow = true;
    escollera.receiveShadow = true;
    g.add(escollera);

    // =====================================================================
    // CORONACIÓN: calzada, pretiles, barandillas y farolas
    // =====================================================================
    const largoVia = 112;
    const xVia = -largoVia / 2;
    const calzada = new THREE.Mesh(
      new THREE.BoxGeometry(largoVia, 0.08, -Z_TRAS - 1.0),
      mat(COL.asfalto, { roughness: 0.92, metalness: 0 })
    );
    calzada.position.set(xVia, Y_CORONA + 0.04, ZC);
    calzada.receiveShadow = true;
    g.add(calzada);
    const eje = new THREE.Mesh(
      new THREE.BoxGeometry(largoVia, 0.01, 0.07),
      mat(0xe9e6da, { roughness: 0.8 })
    );
    eje.position.set(xVia, Y_CORONA + 0.085, ZC);
    g.add(eje);
    const matPretil = hormigon(COL.hormigonClaro, texLargo);
    const matBaranda = acero(COL.aceroOsc);
    for (const z of [-0.25, Z_TRAS + 0.25]) {
      const pretil = new THREE.Mesh(new THREE.BoxGeometry(largoVia, 0.3, 0.3), matPretil);
      pretil.position.set(xVia, Y_CORONA + 0.15, z);
      pretil.castShadow = true;
      pretil.receiveShadow = true;
      g.add(pretil);
      for (const y of [0.55, 0.8]) {
        const rail = new THREE.Mesh(
          new THREE.BoxGeometry(largoVia, 0.035, 0.035),
          matBaranda
        );
        rail.position.set(xVia, Y_CORONA + y, z);
        g.add(rail);
      }
    }
    const nPostes = B ? 24 : 60;
    const postes = new THREE.InstancedMesh(
      new THREE.BoxGeometry(0.04, 0.55, 0.04),
      matBaranda,
      nPostes * 2
    );
    for (let i = 0; i < nPostes; i++) {
      for (let lado = 0; lado < 2; lado++) {
        tmp.position.set(-0.05 - i * 1.3, Y_CORONA + 0.55, lado ? Z_TRAS + 0.25 : -0.25);
        tmp.scale.set(1, 1, 1);
        tmp.rotation.set(0, 0, 0);
        tmp.updateMatrix();
        postes.setMatrixAt(i * 2 + lado, tmp.matrix);
      }
    }
    g.add(postes);
    for (let x = -5; x >= -75; x -= 7) {
      const farola = new THREE.Mesh(
        new THREE.CylinderGeometry(0.035, 0.05, 2.2, 6),
        matBaranda
      );
      farola.position.set(x, Y_CORONA + 1.4, Z_TRAS + 0.25);
      farola.castShadow = true;
      g.add(farola);
      const brazo = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, 0.7), matBaranda);
      brazo.position.set(x, Y_CORONA + 2.5, Z_TRAS + 0.55);
      g.add(brazo);
    }

    // ---- Pórtico grúa sobre la sala de máquinas (iza los grupos) ----
    const matGrua = crearMatPintado(COL.amarillo, { roughness: 0.5, metalness: 0.15 });
    const grua = new THREE.Group();
    for (const z of [-0.55, Z_TRAS + 0.55]) {
      for (const x of [-0.9, 0.9]) {
        const pata = new THREE.Mesh(new THREE.BoxGeometry(0.16, 2.4, 0.16), matGrua);
        pata.position.set(x, 1.2, z);
        pata.castShadow = true;
        grua.add(pata);
      }
      const dintel = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.2, 0.2), matGrua);
      dintel.position.set(0, 2.4, z);
      grua.add(dintel);
    }
    const viga = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.4, -Z_TRAS), matGrua);
    viga.position.set(0, 2.65, ZC);
    viga.castShadow = true;
    grua.add(viga);
    const carro = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.36, 0.7), acero(COL.aceroOsc));
    carro.position.set(0, 3.0, ZC + 0.4);
    carro.castShadow = true;
    grua.add(carro);
    grua.position.set(-1.4, Y_CORONA + 0.08, 0);
    grua.scale.y = 0.62;
    g.add(grua);

    // ---- Edificio de control ----
    const casa = new THREE.Group();
    casa.position.set(-7.4, Y_CORONA, ZC);
    const cuerpoCasa = new THREE.Mesh(
      new THREE.BoxGeometry(4.4, 1.9, 2.4),
      hormigon(COL.hormigonClaro)
    );
    cuerpoCasa.position.y = 1.03;
    cuerpoCasa.castShadow = true;
    cuerpoCasa.receiveShadow = true;
    casa.add(cuerpoCasa);
    const tejado = new THREE.Mesh(
      new THREE.BoxGeometry(4.8, 0.14, 2.8),
      mat(COL.tejado, { roughness: 0.55, metalness: 0.3 })
    );
    tejado.position.y = 2.05;
    tejado.castShadow = true;
    casa.add(tejado);
    const vidrio = mat(COL.vidrio, { roughness: 0.08, metalness: 0.9, envMapIntensity: 1.6 });
    for (const [x, z, giro, ancho] of [
      [0.2, 1.21, 0, 3.4],
      [2.21, 0, Math.PI / 2, 1.7],
    ] as const) {
      const ventanal = new THREE.Mesh(new THREE.BoxGeometry(ancho, 0.7, 0.05), vidrio);
      ventanal.position.set(x, 1.3, z);
      ventanal.rotation.y = giro;
      casa.add(ventanal);
    }
    const antena = new THREE.Mesh(
      new THREE.CylinderGeometry(0.025, 0.035, 1.3, 6),
      matBaranda
    );
    antena.position.set(-1.6, 2.75, -0.5);
    casa.add(antena);
    g.add(casa);

    // =====================================================================
    // GRUPO BULBO (entero, sobresale del plano de corte)
    // =====================================================================
    // Luz de trabajo en el conducto: el sol llega tamizado por el agua.
    const luzCorte = new THREE.PointLight(new THREE.Color(1.0, 0.94, 0.84), 16, 9, 2);
    luzCorte.position.set(1.6, Y_EJE + 0.3, -1.6);
    g.add(luzCorte);

    const matAro = acero(COL.aceroOsc);
    for (const z of [Z_MAR - 0.05, 0.6, -3.6, Z_EMB + 0.05]) {
      // Media brida: solo el arco que queda detrás del corte.
      const aro = new THREE.Mesh(
        new THREE.TorusGeometry(radioPared(z) - 0.03, 0.06, 8, seg, Math.PI),
        matAro
      );
      aro.rotation.z = Math.PI / 2;
      aro.position.set(0, Y_EJE, z);
      g.add(aro);
    }

    // Bulbo: carena estanca del generador, con la nariz hacia el mar.
    const matBulbo = crearMatPintado(COL.bulbo, { roughness: 0.42, metalness: 0.3 });
    const perfilBulbo: THREE.Vector2[] = [];
    for (let i = 0; i <= 32; i++) {
      const z = -2.65 + 3.05 * (i / 32);
      perfilBulbo.push(new THREE.Vector2(Math.max(0.001, radioBulbo(z)), z));
    }
    const bulbo = new THREE.Mesh(new THREE.LatheGeometry(perfilBulbo, seg), matBulbo);
    bulbo.rotation.x = Math.PI / 2;
    bulbo.position.y = Y_EJE;
    bulbo.castShadow = true;
    g.add(bulbo);
    for (const z of [-0.5, -1.7]) {
      const brida = new THREE.Mesh(
        new THREE.TorusGeometry(R_BULBO + 0.01, 0.035, 6, seg),
        matAro
      );
      brida.position.set(0, Y_EJE, z);
      g.add(brida);
    }
    // Pozo de acceso (arriba) y apoyo (abajo): sostienen el bulbo en el flujo.
    const altoPozo = R_GARGANTA - R_BULBO + 0.3;
    for (const s of [1, -1]) {
      const radio = s > 0 ? 0.27 : 0.12;
      const pozo = new THREE.Mesh(
        new THREE.CylinderGeometry(radio, radio, altoPozo, B ? 10 : 18),
        matBulbo
      );
      pozo.scale.z = 2.0;
      pozo.position.set(0, Y_EJE + s * (R_BULBO - 0.15 + altoPozo / 2), -1.1);
      g.add(pozo);
    }

    // Distribuidor: corona de álabes directrices que orientan el agua al rodete.
    const nDirectrices = B ? 8 : 14;
    const rBase = radioBulbo(-2.3);
    for (let i = 0; i < nDirectrices; i++) {
      const porta = new THREE.Group();
      porta.position.set(0, Y_EJE, -2.3);
      porta.rotation.z = (i / nDirectrices) * Math.PI * 2;
      const directriz = new THREE.Mesh(
        new THREE.BoxGeometry(0.035, R_GARGANTA - rBase, 0.36),
        matAro
      );
      directriz.position.y = (R_GARGANTA + rBase) / 2 - 0.02;
      directriz.rotation.y = 0.5;
      porta.add(directriz);
      g.add(porta);
    }

    // Rodete Kaplan de 4 álabes (bronce) y ojiva de salida.
    const rotor = new THREE.Group();
    const geoAlabe = geometriaAlabe(B);
    const matRodete = crearMatPintado(COL.rodete, {
      roughness: 0.35,
      metalness: 0.75,
      envMapIntensity: 1.3,
      side: THREE.DoubleSide,
    });
    for (let i = 0; i < 4; i++) {
      const alabe = new THREE.Mesh(geoAlabe, matRodete);
      alabe.rotation.z = (i * Math.PI) / 2;
      alabe.castShadow = true;
      rotor.add(alabe);
    }
    const cubo = new THREE.Mesh(
      new THREE.LatheGeometry(
        [
          [0.001, -0.7],
          [0.16, -0.55],
          [0.3, -0.25],
          [0.34, 0.0],
          [0.34, 0.32],
        ].map(([r, y]) => new THREE.Vector2(r, y)),
        B ? 12 : 24
      ),
      matBulbo
    );
    cubo.rotation.x = Math.PI / 2;
    rotor.add(cubo);
    rotor.position.set(0, Y_EJE, Z_RODETE);
    g.add(rotor);
    m.rotores = [rotor];

    // ---- Filetes de agua: recorren el conducto rodeando el bulbo ----
    const geoFilete = new THREE.ConeGeometry(0.035, 0.5, 5);
    geoFilete.rotateX(-Math.PI / 2);
    const matFilete = new THREE.MeshBasicMaterial({
      color: new THREE.Color(0.8, 0.96, 1.0),
      transparent: true,
      opacity: 0.9,
      depthWrite: false,
    });
    const nFiletes = B ? 20 : 48;
    for (let i = 0; i < nFiletes; i++) {
      const filete = new THREE.Mesh(geoFilete, matFilete);
      filete.userData.fase = (i * 0.618034) % 1;
      // Solo por detrás del plano de corte: delante no hay agua.
      filete.userData.ang = Math.PI * (0.5 + ((i * 0.618034 + 0.31) % 1));
      filete.userData.capa = 0.3 + 0.55 * ((i * 0.37) % 1);
      filete.renderOrder = 4;
      g.add(filete);
      m.chorros.push(filete);
    }
    m.estado.avance = 0;
    m.estado.angulo = 0;

    // =====================================================================
    // AGUA: láminas (mar y embalse) y sus caras en el plano de corte
    // =====================================================================
    const marInfo = crearSuperficieMar(260, 200, Y_MEDIO, B, {
      niebla: NIEBLA,
      focoX: 130,
      focoZ: -100,
      oleaje: 0.3,
      opacidad: 0.62,
    });
    // El borde entra en el hormigón: la flotación queda pegada al paramento.
    marInfo.malla.position.set(-130, Y_MEDIO, 99.7);
    (marInfo.malla.material as THREE.ShaderMaterial).uniforms.uOrilla.value.set(
      0.05,
      200,
      0.7
    );
    g.add(marInfo.malla);
    m.mar = marInfo.malla;
    m.nivelMar = marInfo.malla;

    const embInfo = crearSuperficieMar(260, 200, Y_MEDIO, B, {
      niebla: NIEBLA,
      focoX: 130,
      focoZ: 100,
      oleaje: 0.08,
      rizo: 0.3,
      opacidad: 0.66,
    });
    embInfo.malla.position.set(-130, Y_MEDIO, Z_TRAS + 0.3 - 100);
    (embInfo.malla.material as THREE.ShaderMaterial).uniforms.uOrilla.value.set(
      Z_TRAS - 0.05,
      200,
      0.4
    );
    g.add(embInfo.malla);
    m.nivelEmbalse = embInfo.malla;

    const corteMar = crearCorteAgua(-0.02, 0, 200, Y_LECHO);
    const corteEmb = crearCorteAgua(-0.02, -200, Z_TRAS, Y_LECHO);
    g.add(corteMar, corteEmb);
    m.estado.corteMar = corteMar;
    m.estado.corteEmb = corteEmb;

    // =====================================================================
    // LECTURA DEL SALTO h sobre la sección del dique
    // =====================================================================
    const grupoSalto = new THREE.Group();
    const matCota = new THREE.MeshBasicMaterial({ color: COL.cota });
    const xCota = 0.04;
    const barra = new THREE.Mesh(new THREE.BoxGeometry(0.03, 1, 0.09), matCota);
    barra.position.set(xCota, 0, ZC);
    // Cada marca prolonga su lámina de agua hasta el centro de la sección.
    const marcaMar = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.06, -ZC), matCota);
    marcaMar.position.set(xCota, 0, ZC / 2);
    const marcaEmb = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.06, -ZC), matCota);
    marcaEmb.position.set(xCota, 0, ZC * 1.5);
    grupoSalto.add(barra, marcaMar, marcaEmb);
    grupoSalto.userData.barra = barra;
    grupoSalto.userData.marcaEmb = marcaEmb;
    grupoSalto.userData.marcaMar = marcaMar;
    g.add(grupoSalto);
    m.grupoSalto = grupoSalto;

    // ---- Rótulos (prioridad: salto, ciclo, dispositivo, masas de agua) ----
    m.etiquetaSalto = crearEtiqueta("Salto h = 0,0 m");
    m.etiquetaSalto.position.set(0.1, Y_CORONA - 0.6, ZC);
    m.etiquetaSalto.userData.prioridad = 1;
    g.add(m.etiquetaSalto);

    m.etiquetaCiclo = crearEtiqueta("Llenado");
    m.etiquetaCiclo.position.set(0.5, Y_LECHO - 1.3, ZC);
    m.etiquetaCiclo.userData.prioridad = 2;
    g.add(m.etiquetaCiclo);

    m.etiquetaDispositivo = crearEtiqueta("Dique de marea · grupo bulbo");
    m.etiquetaDispositivo.position.set(-1.4, Y_CORONA + 0.9, ZC);
    m.etiquetaDispositivo.userData.prioridad = 3;
    g.add(m.etiquetaDispositivo);

    const rotBulbo = crearEtiqueta("Bulbo: aloja el generador");
    rotBulbo.position.set(0.3, Y_EJE - R_GARGANTA - 0.55, 0.9);
    rotBulbo.userData.prioridad = 5;
    g.add(rotBulbo);
    const rotRodete = crearEtiqueta("Rodete Kaplan");
    rotRodete.position.set(0.3, Y_EJE - R_GARGANTA - 0.55, Z_RODETE - 1.6);
    rotRodete.userData.prioridad = 5;
    g.add(rotRodete);

    const rotMar = crearEtiqueta("Mar");
    rotMar.position.set(0, Y_MEDIO - 1.6, 5.6);
    rotMar.userData.prioridad = 4;
    g.add(rotMar);
    const rotEmb = crearEtiqueta("Embalse");
    rotEmb.position.set(0, Y_MEDIO - 1.6, -9.6);
    rotEmb.userData.prioridad = 4;
    g.add(rotEmb);

    return m;
  },

  animar(t: number, ctx: ContextoEscena3D, m: ManijasEscena3D): void {
    // Marea: el mar oscila con el rango real (a escala) y el embalse lo sigue
    // amortiguado y con retraso; la diferencia es el salto h.
    const semi = (Math.max(0, ctx.rangoMarea) / 2) * ESCALA_V;
    const yMar = Y_MEDIO + Math.sin(t * OMEGA_MAREA) * semi;
    const yEmb = Y_MEDIO + Math.sin(t * OMEGA_MAREA - 0.95) * semi * 0.85;
    if (m.nivelMar) m.nivelMar.position.y = yMar;
    if (m.nivelEmbalse) m.nivelEmbalse.position.y = yEmb;
    UNIFORMES_MAR.uNiveles.value.set(yMar, yEmb);
    if (m.estado.corteMar) fijarNivelCorte(m.estado.corteMar as THREE.Mesh, yMar);
    if (m.estado.corteEmb) fijarNivelCorte(m.estado.corteEmb as THREE.Mesh, yEmb);

    const saltoM = (yMar - yEmb) / ESCALA_V;
    const haciaEmbalse = saltoM > 0;
    // Caudal ∝ √h (Torricelli), con signo: se anula al igualarse los niveles.
    const caudal = Math.sign(saltoM) * Math.sqrt(Math.abs(saltoM));

    m.estado.angulo =
      ((m.estado.angulo as number) + caudal * 2.4 * ctx.dt) % (Math.PI * 2);
    for (const r of m.rotores) r.rotation.z = m.estado.angulo as number;

    // Filetes: avanzan del mar (+Z) al embalse (−Z) al llenar, y al revés.
    m.estado.avance = (m.estado.avance as number) + caudal * 0.2 * ctx.dt;
    const zIni = Z_MAR + 1.6;
    const largo = zIni - (Z_EMB - 1.6);
    const fuerza = Math.min(1, Math.abs(caudal) / 0.6);
    for (const c of m.chorros) {
      let f = ((c.userData.fase as number) + (m.estado.avance as number)) % 1;
      if (f < 0) f += 1;
      const z = zIni - f * largo;
      const zc = Math.max(Z_EMB, Math.min(Z_MAR, z));
      const rb = radioBulbo(zc);
      const r = rb + (radioPared(zc) - rb) * (c.userData.capa as number);
      const ang = c.userData.ang as number;
      c.position.set(Math.cos(ang) * r, Y_EJE + Math.sin(ang) * r, z);
      c.rotation.y = haciaEmbalse ? 0 : Math.PI;
      c.scale.set(1, 1, 0.4 + Math.abs(caudal) * 0.9);
      c.visible = fuerza > 0.05;
    }
    const matFilete = m.chorros[0]?.material as THREE.MeshBasicMaterial | undefined;
    if (matFilete) matFilete.opacity = 0.9 * fuerza;

    // Cota del salto: barra entre las dos láminas, sobre la sección.
    const yAlto = Math.max(yMar, yEmb);
    const yBajo = Math.min(yMar, yEmb);
    const grupo = m.grupoSalto;
    if (grupo) {
      const barra = grupo.userData.barra as THREE.Mesh;
      barra.position.y = (yAlto + yBajo) / 2;
      barra.scale.y = Math.max(0.02, yAlto - yBajo);
      (grupo.userData.marcaEmb as THREE.Mesh).position.y = yEmb;
      (grupo.userData.marcaMar as THREE.Mesh).position.y = yMar;
    }
    const anclaSalto = m.etiquetaSalto?.userData.ancla as THREE.Vector3 | undefined;
    anclaSalto?.set(0.1, yAlto + 0.75, ZC);

    const txtSalto = `Salto h = ${formatearNumero(Math.abs(saltoM), 1)} m`;
    if (txtSalto !== m.ultimoTextoSalto && m.etiquetaSalto) {
      pintarEtiqueta(m.etiquetaSalto, txtSalto);
      m.ultimoTextoSalto = txtSalto;
    }
    const ciclo = textoCiclo(ctx.modoEmbalse, haciaEmbalse);
    if (ciclo !== m.ultimoTextoCiclo && m.etiquetaCiclo) {
      pintarEtiqueta(m.etiquetaCiclo, ciclo);
      m.ultimoTextoCiclo = ciclo;
    }
  },
};

function textoCiclo(modoEmbalse: string, haciaEmbalse: boolean): string {
  const fase = haciaEmbalse
    ? "Llenado: el mar entra al embalse"
    : "Vaciado: el embalse vuelve al mar";
  return modoEmbalse ? `${fase} · modo ${modoEmbalse}` : fase;
}
