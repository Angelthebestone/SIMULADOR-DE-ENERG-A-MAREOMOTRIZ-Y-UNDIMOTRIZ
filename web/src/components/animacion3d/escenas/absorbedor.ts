// Escena 3D del absorbedor puntual undimotriz tipo PowerBuoy.
// Referencia: undimotriz_powerbuoy_partes.jpg
// Mismo tratamiento de corte didáctico que la granja: sin caja de agua,
// environment map + cielo, materiales legibles, lecho plano.

// @ts-ignore — three se empaqueta por Vite sin @types
import * as THREE from "three";
import type {
  ContextoEscena3D,
  Encuadre3D,
  Escena3D,
  EscenaThree3D,
  Grupo3D,
  Malla3D,
  ManijasEscena3D,
  Sprite3D,
} from "../tipos";
import { manijasVacias } from "../tipos";
import {
  crearCableConPulso,
  crearCielo,
  crearEntornoMarino,
  crearEtiqueta,
  crearLechoArena,
  crearRocasLecho,
  crearSuperficieMar,
} from "../utilidades";

const COL = {
  amarillo: 0xf5c400,
  amarilloOscuro: 0xc99600,
  naranja: 0xe07820,
  spar: 0x3a424a,
  sparClaro: 0x5a6570,
  placa: 0x4a555e,
  placaNervio: 0x2e363e,
  pod: 0x6a757e,
  podClaro: 0x9aa3ab,
  podTanque: 0xb8c0c6,
  cable: 0x1a2228,
  balizaOn: 0xff3b30,
  balizaOff: 0x7a1812,
  arena: 0xc4a86a,
};

export const escenaAbsorbedor: Escena3D = {
  /** Lecho y mar los pinta esta escena; el motor no pone tierra ni AT. */
  omiteEntornoTierra: true,

  configurarEscena(escenaThree: EscenaThree3D): void {
    escenaThree.environment = crearEntornoMarino();
    escenaThree.background = crearCielo();
  },

  encuadre(): Encuadre3D {
    return {
      posicion: { x: 7.0, y: 4.4, z: 16.2 },
      lookAt: { x: 0.9, y: -1.8, z: 0 },
      fondo: 0xa8c8da,
      niebla: { near: 40, far: 140 },
      radio: 6.9,
      margen: 1.02,
    };
  },

  marFondo(): number {
    return 36;
  },

  construir(g: Grupo3D, ctx: ContextoEscena3D): ManijasEscena3D {
    const m = manijasVacias();
    const mat = ctx.mat;

    // ---- Lecho de arena con dunas y rocas (sin caja) ----
    const lecho = crearLechoArena(220, 180, -6.2, ctx.calidadBaja, {
      amplitud: 0.5,
      tono: 0.95,
    });
    lecho.position.z = -30;
    g.add(lecho);
    g.add(crearRocasLecho(10, 120, 90, -6.2, 23));

    // ---- Superficie de mar ancha, sin volumen caja ----
    // Llega más allá de la niebla: el horizonte no muestra el borde del plano.
    const marInfo = crearSuperficieMar(220, 200, 0.15, ctx.calidadBaja, {
      color: 0xa8c8da,
      near: 40,
      far: 140,
    });
    marInfo.malla.position.z = -40;
    g.add(marInfo.malla);
    m.mar = marInfo.malla;
    m.marBase = marInfo.base;
    m.marAncho = marInfo.ancho;

    // =====================================================================
    // SPAR
    // =====================================================================
    const sparAlto = 9.2;
    const sparY = -2.0;
    const spar = new THREE.Mesh(
      new THREE.CylinderGeometry(0.26, 0.3, sparAlto, ctx.calidadBaja ? 12 : 18),
      mat(COL.spar, { metalness: 0.4, roughness: 0.4, envMapIntensity: 0.9 })
    );
    spar.position.set(0, sparY, 0);
    spar.castShadow = true;
    g.add(spar);
    m.mastil = spar;

    for (const [y, r, h] of [
      [1.55, 0.38, 0.22],
      [-0.4, 0.34, 0.18],
      [-3.6, 0.34, 0.18],
      [-5.9, 0.4, 0.28],
    ] as const) {
      const collar = new THREE.Mesh(
        new THREE.CylinderGeometry(r, r, h, 14),
        mat(COL.sparClaro, { metalness: 0.35, roughness: 0.42, envMapIntensity: 0.9 })
      );
      collar.position.set(0, y, 0);
      g.add(collar);
    }

    const gorjon = new THREE.Mesh(
      new THREE.CylinderGeometry(0.26, 0.55, 0.55, 14),
      mat(COL.sparClaro, { metalness: 0.35, roughness: 0.42 })
    );
    gorjon.position.set(0, -1.15, 0);
    g.add(gorjon);

    // ---- Heave plate ----
    const yPlaca = -4.85;
    const rPlaca = 2.55;
    const placa = new THREE.Mesh(
      new THREE.CylinderGeometry(rPlaca, rPlaca * 0.96, 0.22, ctx.calidadBaja ? 16 : 32),
      mat(COL.placa, { metalness: 0.3, roughness: 0.5, envMapIntensity: 0.8 })
    );
    placa.position.set(0, yPlaca, 0);
    placa.castShadow = true;
    g.add(placa);

    const aro = new THREE.Mesh(
      new THREE.TorusGeometry(rPlaca * 0.97, 0.1, 8, ctx.calidadBaja ? 16 : 36),
      mat(COL.placaNervio, { metalness: 0.32, roughness: 0.5 })
    );
    aro.rotation.x = Math.PI / 2;
    aro.position.set(0, yPlaca, 0);
    g.add(aro);

    const nNerv = ctx.calidadBaja ? 4 : 8;
    for (let i = 0; i < nNerv; i++) {
      const ang = (i * Math.PI * 2) / nNerv;
      const nerv = new THREE.Mesh(
        new THREE.BoxGeometry(rPlaca * 1.7, 0.1, 0.16),
        mat(COL.placaNervio, { metalness: 0.28, roughness: 0.52 })
      );
      nerv.position.set(0, yPlaca + 0.14, 0);
      nerv.rotation.y = -ang;
      g.add(nerv);
    }

    const bocel = new THREE.Mesh(
      new THREE.CylinderGeometry(0.55, 0.62, 0.38, 14),
      mat(COL.placaNervio, { metalness: 0.35, roughness: 0.42 })
    );
    bocel.position.set(0, yPlaca + 0.05, 0);
    g.add(bocel);

    // =====================================================================
    // FLOTADOR PowerBuoy
    // =====================================================================
    const amarillo = mat(COL.amarillo, {
      roughness: 0.4,
      metalness: 0.1,
      envMapIntensity: 0.85,
    });
    const amarilloOsc = mat(COL.amarilloOscuro, {
      roughness: 0.45,
      metalness: 0.1,
    });

    const cuerpo = new THREE.Mesh(
      new THREE.CylinderGeometry(1.15, 1.05, 1.15, ctx.calidadBaja ? 16 : 28),
      amarillo
    );
    cuerpo.castShadow = true;
    cuerpo.receiveShadow = true;
    g.add(cuerpo);
    const flot: Malla3D = cuerpo;
    m.flotador = flot;

    const casquete = new THREE.Mesh(
      new THREE.SphereGeometry(1.05, ctx.calidadBaja ? 12 : 24, ctx.calidadBaja ? 6 : 12, 0, Math.PI * 2, 0, Math.PI * 0.42),
      amarillo
    );
    casquete.scale.set(1, 0.55, 1);
    casquete.position.y = 0.56;
    casquete.castShadow = true;
    flot.add(casquete);

    const cubierta = new THREE.Mesh(
      new THREE.CylinderGeometry(0.95, 0.95, 0.1, 20),
      amarilloOsc
    );
    cubierta.position.y = 0.68;
    flot.add(cubierta);

    const collarFlot = new THREE.Mesh(
      new THREE.CylinderGeometry(1.62, 1.48, 0.42, ctx.calidadBaja ? 16 : 32),
      amarillo
    );
    collarFlot.position.y = -0.52;
    collarFlot.castShadow = true;
    flot.add(collarFlot);

    const bisel = new THREE.Mesh(
      new THREE.TorusGeometry(1.55, 0.09, 8, ctx.calidadBaja ? 16 : 32),
      amarilloOsc
    );
    bisel.rotation.x = Math.PI / 2;
    bisel.position.y = -0.72;
    flot.add(bisel);

    const faja = new THREE.Mesh(
      new THREE.CylinderGeometry(1.64, 1.64, 0.16, ctx.calidadBaja ? 16 : 32),
      mat(COL.naranja, { roughness: 0.42, metalness: 0.08 })
    );
    faja.position.y = -0.38;
    flot.add(faja);

    const pataLargo = 1.15;
    for (let i = 0; i < 4; i++) {
      const ang = (i * Math.PI) / 2 + Math.PI / 4;
      const pata = new THREE.Mesh(
        new THREE.CylinderGeometry(0.045, 0.055, pataLargo, 8),
        amarilloOsc
      );
      const rBase = 0.55;
      const rAlto = 0.18;
      pata.position.set(
        Math.cos(ang) * (rBase + rAlto) * 0.5,
        0.72 + pataLargo * 0.45,
        Math.sin(ang) * (rBase + rAlto) * 0.5
      );
      pata.lookAt(new THREE.Vector3(0, 0.72 + pataLargo, 0));
      pata.rotateX(Math.PI / 2);
      flot.add(pata);
    }
    const travesano = new THREE.Mesh(
      new THREE.CylinderGeometry(0.16, 0.16, 0.1, 12),
      amarilloOsc
    );
    travesano.position.y = 0.72 + pataLargo;
    flot.add(travesano);

    const caja = new THREE.Mesh(
      new THREE.BoxGeometry(0.55, 0.28, 0.4),
      mat(0x5a6570, { metalness: 0.3, roughness: 0.5 })
    );
    caja.position.set(0.15, 0.82, 0);
    caja.castShadow = true;
    flot.add(caja);

    const mastilBaliza = new THREE.Mesh(
      new THREE.CylinderGeometry(0.035, 0.04, 0.85, 8),
      mat(0xc8ced4, { metalness: 0.4, roughness: 0.32, envMapIntensity: 1.1 })
    );
    mastilBaliza.position.y = 0.72 + pataLargo + 0.45;
    flot.add(mastilBaliza);

    const antena = new THREE.Mesh(
      new THREE.CylinderGeometry(0.015, 0.02, 0.55, 6),
      mat(0xd0d6dc, { metalness: 0.4, roughness: 0.3, envMapIntensity: 1.1 })
    );
    antena.position.set(0.08, 0.72 + pataLargo + 0.95, 0);
    flot.add(antena);

    const luzBaliza = new THREE.Mesh(
      new THREE.SphereGeometry(0.14, 12, 10),
      new THREE.MeshBasicMaterial({ color: COL.balizaOff })
    );
    luzBaliza.position.y = 0.72 + pataLargo + 0.88;
    flot.add(luzBaliza);
    (flot.userData as Record<string, unknown>).luzBaliza = luzBaliza;

    const grillete = new THREE.Mesh(
      new THREE.TorusGeometry(0.22, 0.045, 6, 14),
      mat(COL.sparClaro, { metalness: 0.4, roughness: 0.35 })
    );
    grillete.position.y = -0.95;
    flot.add(grillete);

    // Espuma en la línea de flotación del spar.
    const espuma = new THREE.Mesh(
      new THREE.TorusGeometry(0.42, 0.05, 6, 18),
      mat(0xf2f8fa, { roughness: 0.55, metalness: 0, transparent: true, opacity: 0.5 })
    );
    espuma.rotation.x = Math.PI / 2;
    espuma.position.set(0, 0.15, 0);
    g.add(espuma);

    // =====================================================================
    // POD submarino
    // =====================================================================
    const xPod = 5.4;
    const zPod = -0.8;
    const yPod = -5.9;

    const losa = new THREE.Mesh(
      new THREE.BoxGeometry(2.4, 0.18, 1.7),
      mat(0x4a555e, { metalness: 0.2, roughness: 0.55 })
    );
    losa.position.set(xPod, yPod, zPod);
    losa.castShadow = true;
    losa.receiveShadow = true;
    g.add(losa);

    const podCuerpo = new THREE.Mesh(
      new THREE.BoxGeometry(1.7, 0.7, 1.15),
      mat(COL.pod, { metalness: 0.3, roughness: 0.42, envMapIntensity: 0.85 })
    );
    podCuerpo.position.set(xPod, yPod + 0.44, zPod);
    podCuerpo.castShadow = true;
    g.add(podCuerpo);

    const podTapa = new THREE.Mesh(
      new THREE.BoxGeometry(1.5, 0.14, 1.0),
      mat(COL.podClaro, { metalness: 0.35, roughness: 0.35, envMapIntensity: 1 })
    );
    podTapa.position.set(xPod, yPod + 0.86, zPod);
    g.add(podTapa);

    for (const s of [-1, 1]) {
      const tanque = new THREE.Mesh(
        new THREE.CylinderGeometry(0.18, 0.18, 0.95, 12),
        mat(COL.podTanque, { metalness: 0.4, roughness: 0.3, envMapIntensity: 1.1 })
      );
      tanque.rotation.z = Math.PI / 2;
      tanque.position.set(xPod + s * 0.35, yPod + 1.05, zPod);
      tanque.castShadow = true;
      g.add(tanque);
      for (const e of [-1, 1]) {
        const tapaT = new THREE.Mesh(
          new THREE.CylinderGeometry(0.19, 0.19, 0.06, 12),
          mat(0x6a757e, { metalness: 0.35 })
        );
        tapaT.rotation.z = Math.PI / 2;
        tapaT.position.set(xPod + s * 0.35 + e * 0.48, yPod + 1.05, zPod);
        g.add(tapaT);
      }
    }

    for (const [dx, dz] of [
      [-1.05, -0.7],
      [1.05, -0.7],
      [-1.05, 0.7],
      [1.05, 0.7],
    ] as const) {
      const poste = new THREE.Mesh(
        new THREE.CylinderGeometry(0.03, 0.03, 0.55, 6),
        mat(COL.podClaro, { metalness: 0.35 })
      );
      poste.position.set(xPod + dx, yPod + 0.4, zPod + dz);
      g.add(poste);
    }

    // ---- Cable ----
    const { cable, curva, pulso } = crearCableConPulso(
      [
        new THREE.Vector3(0, yPlaca - 0.15, 0),
        new THREE.Vector3(2.2, -5.7, 0.3),
        new THREE.Vector3(xPod - 1.3, yPod + 0.3, zPod),
        new THREE.Vector3(xPod + 1.5, yPod + 0.2, zPod),
        new THREE.Vector3(12, -5.5, -2),
      ],
      0.085
    );
    g.add(cable);
    m.pulsoCurva = curva;
    m.pulso = pulso;
    g.add(pulso);

    const cableInterno = new THREE.Mesh(
      new THREE.CylinderGeometry(0.06, 0.06, 0.9, 8),
      mat(COL.cable)
    );
    cableInterno.position.set(0, yPlaca + 0.55, 0);
    g.add(cableInterno);

    m.etiquetaDispositivo = crearEtiqueta("Absorbedor puntual");
    m.etiquetaDispositivo.position.set(0, 3.6, 0);
    g.add(m.etiquetaDispositivo as Sprite3D);

    return m;
  },

  animar(t: number, ctx: ContextoEscena3D, m: ManijasEscena3D): void {
    const omega = (2 * Math.PI) / (ctx.Te > 0 ? ctx.Te : 7);
    const k = ctx.k > 0 ? ctx.k : 0.08;
    const zSerie = ctx.muestrearSerie(t);
    const z = zSerie !== null ? zSerie : ctx.eta(0, t, omega, k) * 0.6;
    const freno = Math.max(0.3, Math.min(1.6, 80_000 / Math.max(10_000, ctx.Bpto)));
    const escala =
      Math.max(0.4, Math.min(2.2, ctx.Hm0 / Math.max(0.5, ctx.Te / 4))) * freno;

    if (m.flotador) {
      m.flotador.position.y = z * escala * 1.35;
      m.flotador.rotation.z = Math.sin(t * omega * 0.5) * 0.025 * escala;
      m.flotador.rotation.x = Math.cos(t * omega * 0.43) * 0.02 * escala;
    }
    if (m.mastil) {
      m.mastil.position.y = -2.0 + Math.sin(t * 0.37) * 0.04;
    }
    if (m.flotador) {
      const luz = (m.flotador.userData as Record<string, unknown>).luzBaliza as
        | THREE.Mesh
        | undefined;
      if (luz && luz.material) {
        const on = Math.sin(t * 2.4) > 0.35;
        (luz.material as THREE.MeshBasicMaterial).color.setHex(
          on ? COL.balizaOn : COL.balizaOff
        );
        const s = on ? 1.25 : 1.0;
        luz.scale.set(s, s, s);
      }
    }
    if (m.pulso && m.pulsoCurva) {
      const f = (t * 0.2) % 1;
      m.pulsoCurva.getPointAt(f, m.pulso.position);
      const matP = m.pulso.material as THREE.MeshStandardMaterial;
      if (matP && matP.emissive) {
        matP.emissive.setHex(0x6a8a10);
        matP.emissiveIntensity = 0.55 + 0.45 * Math.sin(f * Math.PI);
      }
    }
  },
};
