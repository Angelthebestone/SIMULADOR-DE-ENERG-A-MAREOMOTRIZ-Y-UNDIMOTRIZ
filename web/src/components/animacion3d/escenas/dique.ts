// Escena 3D del dique mareal — corte didáctico de una central mareomotriz.
//
// Composición (el eje del dique va en X; el mar queda delante, en +Z, y el
// embalse detrás, en -Z):
//   - mar abierto a un lado y embalse al otro, cada uno con su nivel de agua;
//   - presa de gravedad de hormigón con coronación, calzada y barandillas;
//   - tramo central abierto en corte: conducto, bulbo Kaplan, rotor, difusor,
//     chorros de agua y flechas de llenado/vaciado;
//   - indicador vertical del salto h entre los dos niveles.
//
// La cámara es 3/4, elevada y a distancia: se ve el dique entero con margen y
// el agua usa el mismo shader que las escenas undimotriz y de granja. Delante
// de la sala de máquinas el agua se recorta (ventana didáctica con marco de
// espuma) para que el corte sumergido se lea sin cajas de agua opacas.

// @ts-ignore — three se empaqueta por Vite sin @types
import * as THREE from "three";
import { formatearNumero } from "../../../utils/formato";
import type {
  ContextoEscena3D,
  Encuadre3D,
  Escena3D,
  EscenaThree3D,
  Grupo3D,
  Malla3D,
  ManijasEscena3D,
} from "../tipos";
import { manijasVacias } from "../tipos";
import {
  actualizarNivelAgua,
  crearCielo,
  crearEntornoMarino,
  crearEtiqueta,
  crearLechoArena,
  crearRocasLecho,
  crearSuperficieMar,
  pintarEtiqueta,
} from "../utilidades";

const COL = {
  hormigon: 0xc7c3b8,
  hormigonClaro: 0xdcd8cd,
  hormigonOsc: 0x8d8a80,
  hormigonHumedo: 0x6f7d78,
  junta: 0x6a675f,
  asfalto: 0x3a3f42,
  acero: 0x9aa4ac,
  aceroOsc: 0x5a646c,
  bulbo: 0xd8dde1,
  agua: 0x1f7fa8,
  espuma: 0xf2f9fb,
  casaTecho: 0x4a5258,
  ventana: 0x2c4a5a,
  cota: 0x7fd4e3,
} as const;

/** Cotas del diorama (unidades de mundo ≈ metros). */
const COTAS = {
  yLecho: -6.4,
  yCanal: -3.6,
  yNotchSuelo: -5.6,
  yNotchTecho: -2.0,
  xDique: 10,
  xNotch: 5,
} as const;

/** Niveles medios de marea (el rango del payload los hace oscilar). */
const Y_MAR_BASE = -1.15;
const Y_EMB_BASE = -1.15;

/** Ventana de agua clara frente a la sala de máquinas (mundo). */
const VENTANA = { x0: -5.4, x1: 5.4, z0: -1.2, z1: 4.8 } as const;

export const escenaDique: Escena3D = {
  omiteEntornoTierra: true,

  configurarEscena(escenaThree: EscenaThree3D): void {
    escenaThree.environment = crearEntornoMarino();
    escenaThree.background = crearCielo();
  },

  encuadre(): Encuadre3D {
    // 3/4 desde el mar y algo elevada. El motor aleja la cámara lo necesario
    // para que la esfera del dique (radio 12,4) quepa entera en cualquier
    // aspecto, con margen para que el agua respire alrededor.
    return {
      posicion: { x: -13, y: 10.5, z: 21 },
      lookAt: { x: 0, y: -1.8, z: -1 },
      fondo: 0xa8c8da,
      niebla: { near: 45, far: 165 },
      radio: 12.4,
      margen: 1.04,
    };
  },

  marFondo(): number {
    // La lámina de mar del dique es muy profunda (llega al horizonte).
    return 180;
  },

  /**
   * Ventana didáctica en la lámina de mar: frente a la sala de máquinas el
   * agua se aclara (con un marco de espuma) para que el corte sumergido se
   * lea. Se reaplica al degradar calidad porque el motor rehace la lámina.
   */
  configurarMar(malla: Malla3D): void {
    const shader = malla.material as THREE.ShaderMaterial;
    const u = shader?.uniforms;
    if (!u) return;
    u.uVentana?.value.set(VENTANA.x0, VENTANA.x1, VENTANA.z0, VENTANA.z1);
    if (u.uVentanaActiva) u.uVentanaActiva.value = 1;
  },

  construir(g: Grupo3D, ctx: ContextoEscena3D): ManijasEscena3D {
    const m = manijasVacias();
    const mat = ctx.mat;
    const B = ctx.calidadBaja;

    const hormigon = { roughness: 0.9, metalness: 0.03, envMapIntensity: 0.7 };
    const metal = { roughness: 0.3, metalness: 0.5, envMapIntensity: 1.2 };
    const acero = { roughness: 0.45, metalness: 0.35, envMapIntensity: 0.9 };

    // =====================================================================
    // LECHO — arena con dunas y rocas, visible a través del agua
    // =====================================================================
    const lecho = crearLechoArena(240, 220, COTAS.yLecho, B, {
      amplitud: 0.4,
      tono: 0.92,
    });
    lecho.position.z = 0;
    g.add(lecho);
    g.add(crearRocasLecho(12, 110, 90, COTAS.yLecho, 53));

    // =====================================================================
    // PRESA DE GRAVEDAD
    // Perfil escalonado: cuerpo bajo ancho, cuerpo alto estrecho y bermas
    // inclinadas que rompen el escalón. El tramo central (x ±5) se abre en
    // corte para enseñar la sala de máquinas.
    // =====================================================================
    const anchoDique = COTAS.xDique * 2;
    const anchoNotch = COTAS.xNotch * 2;
    const anchoLateral = COTAS.xDique - COTAS.xNotch;

    for (const s of [-1, 1]) {
      const x = s * (COTAS.xNotch + anchoLateral / 2);
      const bajo = new THREE.Mesh(
        new THREE.BoxGeometry(anchoLateral, 3.4, 4.6),
        mat(COL.hormigonOsc, hormigon)
      );
      bajo.position.set(x, -4.7, -2.3);
      bajo.castShadow = true;
      bajo.receiveShadow = true;
      g.add(bajo);

      const alto = new THREE.Mesh(
        new THREE.BoxGeometry(anchoLateral, 3.4, 2.8),
        mat(COL.hormigon, hormigon)
      );
      alto.position.set(x, -0.5, -2.3);
      alto.castShadow = true;
      alto.receiveShadow = true;
      g.add(alto);
    }

    // Base bajo el hueco, tapa sobre el hueco y muro trasero del corte.
    const baseCentral = new THREE.Mesh(
      new THREE.BoxGeometry(anchoNotch, 0.8, 4.6),
      mat(COL.hormigonOsc, hormigon)
    );
    baseCentral.position.set(0, -6.0, -2.3);
    baseCentral.receiveShadow = true;
    g.add(baseCentral);

    const tapaCentral = new THREE.Mesh(
      new THREE.BoxGeometry(anchoNotch, 3.2, 2.8),
      mat(COL.hormigon, hormigon)
    );
    tapaCentral.position.set(0, -0.4, -2.3);
    tapaCentral.castShadow = true;
    tapaCentral.receiveShadow = true;
    g.add(tapaCentral);

    const trasero = new THREE.Mesh(
      new THREE.BoxGeometry(anchoNotch, 3.6, 0.6),
      mat(COL.hormigonOsc, hormigon)
    );
    trasero.position.set(0, -3.8, -4.3);
    trasero.castShadow = true;
    g.add(trasero);

    // Bermas inclinadas mar/embalse. Se cortan en el tramo central para no
    // tapar la boca del corte (la sala de máquinas no tiene berma).
    for (const [z, rot] of [
      [-0.45, 0.42],
      [-4.15, -0.42],
    ] as const) {
      for (const s of [-1, 1]) {
        const berma = new THREE.Mesh(
          new THREE.BoxGeometry(anchoLateral, 0.5, 1.25),
          mat(COL.hormigonOsc, hormigon)
        );
        berma.position.set(s * (COTAS.xNotch + anchoLateral / 2), -2.6, z);
        berma.rotation.x = rot;
        berma.castShadow = true;
        berma.receiveShadow = true;
        g.add(berma);
      }
    }

    // Coronación, calzada y líneas de borde.
    const coronacion = new THREE.Mesh(
      new THREE.BoxGeometry(anchoDique, 0.35, 3.6),
      mat(COL.hormigonClaro, hormigon)
    );
    coronacion.position.set(0, 1.375, -2.3);
    coronacion.castShadow = true;
    coronacion.receiveShadow = true;
    g.add(coronacion);

    const calzada = new THREE.Mesh(
      new THREE.BoxGeometry(anchoDique, 0.08, 2.8),
      mat(COL.asfalto, { roughness: 0.95, metalness: 0.02 })
    );
    calzada.position.set(0, 1.59, -2.3);
    calzada.receiveShadow = true;
    g.add(calzada);

    for (const z of [-3.55, -1.05]) {
      const linea = new THREE.Mesh(
        new THREE.BoxGeometry(anchoDique, 0.02, 0.06),
        mat(0xe8e4d8, { roughness: 0.8 })
      );
      linea.position.set(0, 1.64, z);
      g.add(linea);
    }

    // Barandillas a ambos lados de la calzada.
    const matBaranda = mat(COL.aceroOsc, acero);
    for (const z of [-3.85, -0.75]) {
      for (let x = -9; x <= 9; x += 3.5) {
        const poste = new THREE.Mesh(
          new THREE.BoxGeometry(0.06, 0.72, 0.06),
          matBaranda
        );
        poste.position.set(x, 1.99, z);
        g.add(poste);
      }
      for (const y of [2.32, 2.02]) {
        const rail = new THREE.Mesh(
          new THREE.BoxGeometry(anchoDique, 0.05, 0.05),
          matBaranda
        );
        rail.position.set(0, y, z);
        g.add(rail);
      }
    }

    // Juntas de hormigonado: verticales en el alzado y dos horizontales.
    const matJunta = mat(COL.junta, { roughness: 0.95, metalness: 0.02 });
    for (const x of [-9, -6, 6, 9]) {
      const altoJ = new THREE.Mesh(
        new THREE.BoxGeometry(0.05, 3.4, 0.03),
        matJunta
      );
      altoJ.position.set(x, -0.5, -0.885);
      g.add(altoJ);
      const bajoJ = new THREE.Mesh(
        new THREE.BoxGeometry(0.05, 3.4, 0.03),
        matJunta
      );
      bajoJ.position.set(x, -4.7, 0.015);
      g.add(bajoJ);
    }
    for (const [y, z] of [
      [-4.8, 0.015],
      [0.4, -0.885],
    ] as const) {
      const h = new THREE.Mesh(
        new THREE.BoxGeometry(anchoDique, 0.04, 0.03),
        matJunta
      );
      h.position.set(0, y, z);
      g.add(h);
    }

    // Franja húmeda alrededor de la línea de flotación (solo tramos macizos).
    for (const s of [-1, 1]) {
      const humedo = new THREE.Mesh(
        new THREE.BoxGeometry(anchoLateral, 2.5, 0.02),
        new THREE.MeshStandardMaterial({
          color: COL.hormigonHumedo,
          transparent: true,
          opacity: 0.22,
          roughness: 0.85,
          metalness: 0.02,
          depthWrite: false,
        })
      );
      humedo.position.set(
        s * (COTAS.xNotch + anchoLateral / 2),
        -0.95,
        -0.882
      );
      g.add(humedo);
    }

    // Casa de máquinas en la coronación (izquierda, para no tapar el corte).
    const casa = new THREE.Group();
    casa.position.set(-7.5, 0, -2.3);
    const cuerpoCasa = new THREE.Mesh(
      new THREE.BoxGeometry(4.6, 1.8, 2.6),
      mat(COL.hormigonClaro, hormigon)
    );
    cuerpoCasa.position.y = 2.53;
    cuerpoCasa.castShadow = true;
    cuerpoCasa.receiveShadow = true;
    casa.add(cuerpoCasa);

    const techoCasa = new THREE.Mesh(
      new THREE.BoxGeometry(5.0, 0.16, 3.0),
      mat(COL.casaTecho, { roughness: 0.6, metalness: 0.2 })
    );
    techoCasa.position.y = 3.5;
    techoCasa.castShadow = true;
    casa.add(techoCasa);

    const ventana = new THREE.Mesh(
      new THREE.BoxGeometry(3.4, 0.66, 0.06),
      mat(COL.ventana, {
        roughness: 0.25,
        metalness: 0.35,
        emissive: 0x16323e,
        emissiveIntensity: 0.6,
      })
    );
    ventana.position.set(0, 2.85, 1.31);
    casa.add(ventana);

    const puerta = new THREE.Mesh(
      new THREE.BoxGeometry(0.8, 1.2, 0.06),
      mat(0x3a4650, { roughness: 0.6 })
    );
    puerta.position.set(-1.4, 2.23, 1.31);
    casa.add(puerta);

    const antena = new THREE.Mesh(
      new THREE.CylinderGeometry(0.03, 0.04, 1.1, 6),
      mat(COL.acero, metal)
    );
    antena.position.set(1.4, 4.12, 0);
    casa.add(antena);

    const baliza = new THREE.Mesh(
      new THREE.SphereGeometry(0.08, 8, 6),
      new THREE.MeshBasicMaterial({ color: 0xff3b30 })
    );
    baliza.position.set(1.4, 4.72, 0);
    casa.add(baliza);
    g.add(casa);

    // =====================================================================
    // SALA DE MÁQUINAS EN CORTE
    // Hueco frontal (x ±5, y -5,6…-2,0, z -4,0…0) con las caras interiores
    // oscurecidas para que se lea como un corte y no como un bloque gris.
    // =====================================================================
    const caraCorte = {
      roughness: 0.92,
      metalness: 0.02,
      side: THREE.DoubleSide,
    };
    const paredIzq = new THREE.Mesh(
      new THREE.PlaneGeometry(4.0, 3.6),
      mat(COL.hormigonOsc, caraCorte)
    );
    paredIzq.rotation.y = Math.PI / 2;
    paredIzq.position.set(-COTAS.xNotch + 0.01, -3.8, -2.0);
    g.add(paredIzq);

    const paredDer = new THREE.Mesh(
      new THREE.PlaneGeometry(4.0, 3.6),
      mat(COL.hormigonOsc, caraCorte)
    );
    paredDer.rotation.y = -Math.PI / 2;
    paredDer.position.set(COTAS.xNotch - 0.01, -3.8, -2.0);
    g.add(paredDer);

    const fondoNotch = new THREE.Mesh(
      new THREE.PlaneGeometry(10, 3.6),
      mat(COL.hormigonOsc, caraCorte)
    );
    fondoNotch.position.set(0, -3.8, -3.99);
    g.add(fondoNotch);

    const techoNotch = new THREE.Mesh(
      new THREE.PlaneGeometry(10, 4.0),
      mat(COL.hormigonOsc, caraCorte)
    );
    techoNotch.rotation.x = Math.PI / 2;
    techoNotch.position.set(0, COTAS.yNotchTecho - 0.01, -2.0);
    g.add(techoNotch);

    const sueloNotch = new THREE.Mesh(
      new THREE.PlaneGeometry(10, 4.0),
      mat(COL.hormigonHumedo, { roughness: 0.95, metalness: 0.02 })
    );
    sueloNotch.rotation.x = -Math.PI / 2;
    sueloNotch.position.set(0, COTAS.yNotchSuelo + 0.01, -2.0);
    g.add(sueloNotch);

    // Delantal de hormigón bajo la ventana de agua: el recorte del mar deja
    // ver una solera continua con el suelo de la sala de máquinas.
    const delantal = new THREE.Mesh(
      new THREE.BoxGeometry(10.8, 0.3, 5.0),
      mat(COL.hormigonHumedo, { roughness: 0.94, metalness: 0.02 })
    );
    delantal.position.set(0, COTAS.yNotchSuelo - 0.15, 2.4);
    delantal.receiveShadow = true;
    g.add(delantal);

    // Luz cálida dentro del corte: el sol no entra y el bulbo se perdería.
    const luzCorte = new THREE.PointLight(0xffe2b0, 18, 10, 2);
    luzCorte.position.set(0, -2.6, -1.5);
    g.add(luzCorte);

    // ---- Conducto: volumen de agua translúcido + aros de toma/salida ----
    const aguaCanal = new THREE.Mesh(
      new THREE.CylinderGeometry(1.25, 1.25, 4.0, B ? 16 : 28, 1, true),
      new THREE.MeshStandardMaterial({
        color: COL.agua,
        transparent: true,
        opacity: 0.16,
        roughness: 0.3,
        metalness: 0,
        side: THREE.DoubleSide,
        depthWrite: false,
      })
    );
    aguaCanal.rotation.x = Math.PI / 2;
    aguaCanal.position.set(0, COTAS.yCanal, -2.0);
    aguaCanal.renderOrder = 1;
    g.add(aguaCanal);

    for (const z of [0.01, -3.99]) {
      const aro = new THREE.Mesh(
        new THREE.TorusGeometry(1.25, 0.1, 8, B ? 16 : 28),
        mat(COL.aceroOsc, metal)
      );
      aro.position.set(0, COTAS.yCanal, z);
      g.add(aro);
    }

    // ---- Difusor (tubo de aspiración) hacia el embalse ----
    const difusor = new THREE.Mesh(
      new THREE.CylinderGeometry(0.62, 1.15, 1.0, B ? 16 : 24, 1, true),
      mat(COL.hormigonOsc, {
        roughness: 0.8,
        metalness: 0.05,
        side: THREE.DoubleSide,
      })
    );
    difusor.rotation.x = Math.PI / 2;
    difusor.position.set(0, COTAS.yCanal, -3.5);
    g.add(difusor);

    // ---- Bulbo: cápsula del generador, banda y soportes ----
    const bulbo = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.62, 1.0, B ? 6 : 10, B ? 12 : 20),
      mat(COL.bulbo, metal)
    );
    bulbo.rotation.x = Math.PI / 2;
    bulbo.position.set(0, COTAS.yCanal, -1.9);
    bulbo.castShadow = true;
    g.add(bulbo);

    const banda = new THREE.Mesh(
      new THREE.CylinderGeometry(0.64, 0.64, 0.2, B ? 12 : 20),
      mat(COL.aceroOsc, metal)
    );
    banda.rotation.x = Math.PI / 2;
    banda.position.set(0, COTAS.yCanal, -2.15);
    g.add(banda);

    for (const ang of [Math.PI / 2, (Math.PI * 7) / 6, (Math.PI * 11) / 6]) {
      const porta = new THREE.Group();
      porta.rotation.z = ang;
      const soporte = new THREE.Mesh(
        new THREE.BoxGeometry(0.1, 0.65, 0.18),
        mat(COL.aceroOsc, metal)
      );
      soporte.position.y = 0.95;
      porta.add(soporte);
      porta.position.set(0, COTAS.yCanal, -2.1);
      g.add(porta);
    }

    // ---- Rotor Kaplan (4 palas) en la toma ----
    const rotor = new THREE.Group();
    for (let i = 0; i < 4; i++) {
      const porta = new THREE.Group();
      porta.rotation.z = (i * Math.PI) / 2;
      const pala = new THREE.Mesh(
        new THREE.BoxGeometry(0.08, 0.9, 0.34),
        mat(0x8fb3c4, {
          roughness: 0.32,
          metalness: 0.45,
          envMapIntensity: 1.15,
        })
      );
      pala.position.y = 0.62;
      pala.rotation.y = 0.38;
      pala.castShadow = true;
      porta.add(pala);
      rotor.add(porta);
    }
    const buje = new THREE.Mesh(
      new THREE.SphereGeometry(0.22, 14, 10),
      mat(COL.aceroOsc, metal)
    );
    rotor.add(buje);
    const nariz = new THREE.Mesh(
      new THREE.ConeGeometry(0.18, 0.32, 12),
      mat(COL.bulbo, metal)
    );
    nariz.rotation.x = Math.PI / 2;
    nariz.position.z = 0.26;
    rotor.add(nariz);
    rotor.position.set(0, COTAS.yCanal, -0.55);
    g.add(rotor);
    m.rotores = [rotor];

    const aroRotor = new THREE.Mesh(
      new THREE.TorusGeometry(1.18, 0.08, 8, B ? 16 : 28),
      mat(COL.aceroOsc, metal)
    );
    aroRotor.position.set(0, COTAS.yCanal, -0.55);
    g.add(aroRotor);

    // ---- Chorros de agua alrededor del bulbo ----
    const matChorro = new THREE.MeshStandardMaterial({
      color: 0xbfefff,
      emissive: 0x2a7fa0,
      emissiveIntensity: 0.9,
      roughness: 0.3,
      metalness: 0.1,
    });
    const geoChorro = new THREE.BoxGeometry(0.08, 0.08, 0.55);
    const nChorros = B ? 8 : 16;
    for (let i = 0; i < nChorros; i++) {
      const ang = (i / nChorros) * Math.PI * 2 + 0.35;
      const rad = 0.8 + (i % 3) * 0.12;
      const chorro = new THREE.Mesh(geoChorro, matChorro);
      chorro.position.set(
        Math.cos(ang) * rad,
        COTAS.yCanal + Math.sin(ang) * rad,
        0.1 - (i / nChorros) * 4.0
      );
      chorro.userData.fase = i / nChorros;
      g.add(chorro);
      m.chorros.push(chorro);
    }

    // ---- Flechas de flujo (solo una visible según el ciclo) ----
    m.flechaLlenado = new THREE.ArrowHelper(
      new THREE.Vector3(0, 0, -1),
      new THREE.Vector3(2.6, COTAS.yCanal, 0.05),
      3.8,
      0xc7e14a,
      0.6,
      0.32
    );
    m.flechaVaciado = new THREE.ArrowHelper(
      new THREE.Vector3(0, 0, 1),
      new THREE.Vector3(-2.6, COTAS.yCanal, -3.95),
      3.8,
      0x7fd4e3,
      0.6,
      0.32
    );
    g.add(m.flechaLlenado);
    g.add(m.flechaVaciado);

    // =====================================================================
    // AGUA — dos láminas con el mismo shader que las otras escenas.
    // El mar se asigna a m.mar para que el motor lo ondule; el embalse queda
    // más quieto (solo rizo de shader) y la escena le mueve el nivel.
    // =====================================================================
    const marInfo = crearSuperficieMar(220, 180, Y_MAR_BASE, B, {
      color: 0xa8c8da,
      near: 45,
      far: 165,
    });
    // z -1…179: el borde entra 1 m en el cuerpo alto (oculto por el hormigón)
    // para que la línea de flotación quede pegada a la cara del dique.
    marInfo.malla.position.set(0, Y_MAR_BASE, 89);
    this.configurarMar?.(marInfo.malla);
    g.add(marInfo.malla);
    m.mar = marInfo.malla;
    m.marBase = marInfo.base;
    m.marAncho = marInfo.ancho;
    m.nivelMar = marInfo.malla;

    const embInfo = crearSuperficieMar(220, 176.5, Y_EMB_BASE, B, {
      color: 0xa8c8da,
      near: 45,
      far: 165,
    });
    embInfo.malla.position.set(0, Y_EMB_BASE, -91.75);
    g.add(embInfo.malla);
    m.nivelEmbalse = embInfo.malla;

    // Espuma en las dos líneas de flotación.
    const matEspuma = mat(COL.espuma, {
      roughness: 0.6,
      metalness: 0,
      transparent: true,
      opacity: 0.55,
    });
    m.espumaMar = new THREE.Mesh(
      new THREE.BoxGeometry(anchoDique, 0.06, 0.5),
      matEspuma
    );
    m.espumaMar.position.set(0, Y_MAR_BASE + 0.03, -0.55);
    g.add(m.espumaMar);

    m.espumaEmbalse = new THREE.Mesh(
      new THREE.BoxGeometry(anchoDique, 0.06, 0.5),
      matEspuma
    );
    m.espumaEmbalse.position.set(0, Y_EMB_BASE + 0.03, -4.05);
    g.add(m.espumaEmbalse);

    // =====================================================================
    // INDICADOR DEL SALTO h — barra vertical con dos ticks en los niveles
    // =====================================================================
    const grupoSalto = new THREE.Group();
    const matSalto = mat(COL.cota, {
      emissive: 0x1f6f8a,
      emissiveIntensity: 0.6,
      roughness: 0.35,
      metalness: 0.2,
    });
    const barra = new THREE.Mesh(
      new THREE.CylinderGeometry(0.06, 0.06, 1, 8),
      matSalto
    );
    barra.position.set(-6.5, 0, -0.8);
    grupoSalto.add(barra);

    const tickAlto = new THREE.Mesh(
      new THREE.BoxGeometry(0.08, 0.08, 1.2),
      matSalto
    );
    tickAlto.position.set(-6.5, 0, -0.8);
    grupoSalto.add(tickAlto);

    const tickBajo = tickAlto.clone();
    grupoSalto.add(tickBajo);

    grupoSalto.userData.barra = barra;
    grupoSalto.userData.tickAlto = tickAlto;
    grupoSalto.userData.tickBajo = tickBajo;
    g.add(grupoSalto);
    m.grupoSalto = grupoSalto;

    // =====================================================================
    // RÓTULOS — prioridad: salto, ciclo, dispositivo. El motor los aparta de
    // la franja superior y de las esquinas con controles.
    // =====================================================================
    m.etiquetaSalto = crearEtiqueta("h 0,0 m");
    m.etiquetaSalto.position.set(-6.5, 1.0, -0.6);
    m.etiquetaSalto.userData.prioridad = 1;
    g.add(m.etiquetaSalto);

    m.etiquetaCiclo = crearEtiqueta("vaciado");
    m.etiquetaCiclo.position.set(-6.5, 2.2, -0.6);
    m.etiquetaCiclo.userData.prioridad = 2;
    g.add(m.etiquetaCiclo);

    m.etiquetaDispositivo = crearEtiqueta("Dique de marea");
    m.etiquetaDispositivo.position.set(-7.5, 5.3, -2.3);
    m.etiquetaDispositivo.userData.prioridad = 3;
    g.add(m.etiquetaDispositivo);

    return m;
  },

  animar(t: number, ctx: ContextoEscena3D, m: ManijasEscena3D): void {
    // Marea: el mar oscila y el embalse va con retraso → salto h visible.
    const rango = Math.max(0.8, ctx.rangoMarea);
    const amp = Math.min(1.6, rango * 0.38);
    const omega = 0.42;
    const zMar = Y_MAR_BASE + Math.sin(t * omega) * amp;
    const zEmb = Y_EMB_BASE + Math.sin(t * omega - 0.95) * amp * 0.85;

    if (m.nivelMar) {
      m.nivelMar.position.y = zMar;
      actualizarNivelAgua(m.nivelMar, zMar, Math.max(0.2, ctx.Hm0 / 2), t);
    }
    if (m.nivelEmbalse) {
      m.nivelEmbalse.position.y = zEmb;
      actualizarNivelAgua(m.nivelEmbalse, zEmb, 0.08, t * 0.8);
    }
    if (m.espumaMar) m.espumaMar.position.y = zMar + 0.03;
    if (m.espumaEmbalse) m.espumaEmbalse.position.y = zEmb + 0.03;

    const saltoM = Math.abs(zMar - zEmb);
    const haciaEmbalse = zMar > zEmb;
    // Al llenar, el agua va del mar (+Z) al embalse (-Z).
    const dir = haciaEmbalse ? -1 : 1;

    // Rotor: más rápido cuanto mayor es el salto.
    const vel = 0.35 + Math.min(2.4, saltoM * 0.9);
    for (const r of m.rotores) r.rotation.z += dir * vel * 0.06;

    if (m.flechaLlenado) m.flechaLlenado.visible = haciaEmbalse;
    if (m.flechaVaciado) m.flechaVaciado.visible = !haciaEmbalse;

    // Chorros: recorren el conducto alrededor del bulbo y vuelven a entrar.
    const avance = t * (0.3 + Math.min(1.2, saltoM * 0.35));
    for (const c of m.chorros) {
      const fase = (c.userData.fase as number | undefined) ?? 0;
      let f = (fase + avance * (haciaEmbalse ? 1 : -1)) % 1;
      if (f < 0) f += 1;
      c.position.z = 0.1 - f * 4.0;
    }

    // Indicador de salto: la barra une los dos niveles y los ticks los marcan.
    const yAlto = Math.max(zMar, zEmb);
    const yBajo = Math.min(zMar, zEmb);
    const grupo = m.grupoSalto;
    if (grupo) {
      const barra = grupo.userData.barra as THREE.Mesh | undefined;
      const alto = grupo.userData.tickAlto as THREE.Mesh | undefined;
      const bajo = grupo.userData.tickBajo as THREE.Mesh | undefined;
      if (barra) {
        barra.position.y = (yAlto + yBajo) / 2;
        barra.scale.y = Math.max(0.12, yAlto - yBajo);
      }
      if (alto) alto.position.y = yAlto;
      if (bajo) bajo.position.y = yBajo;
    }

    // Los rótulos siguen a los niveles vivos (ancla en espacio de mundo).
    const anclaSalto = m.etiquetaSalto?.userData.ancla as
      | THREE.Vector3
      | undefined;
    anclaSalto?.set(-6.5, yAlto + 1.0, -0.6);
    const anclaCiclo = m.etiquetaCiclo?.userData.ancla as
      | THREE.Vector3
      | undefined;
    anclaCiclo?.set(-6.5, yAlto + 2.2, -0.6);

    const txtSalto = `h ${formatearNumero(saltoM, 1)} m`;
    if (txtSalto !== m.ultimoTextoSalto && m.etiquetaSalto) {
      pintarEtiqueta(m.etiquetaSalto, txtSalto);
      m.ultimoTextoSalto = txtSalto;
    }
    const ciclo = textoCiclo(ctx.modoEmbalse, haciaEmbalse ? 1 : -1);
    if (ciclo !== m.ultimoTextoCiclo && m.etiquetaCiclo) {
      pintarEtiqueta(m.etiquetaCiclo, ciclo);
      m.ultimoTextoCiclo = ciclo;
    }
  },
};

function textoCiclo(modoEmbalse: string, fase: number): string {
  if (["llenado", "vaciado", "bidireccional", "bombeo"].includes(modoEmbalse))
    return modoEmbalse;
  if (modoEmbalse) return modoEmbalse;
  return fase >= 0 ? "llenado" : "vaciado";
}
