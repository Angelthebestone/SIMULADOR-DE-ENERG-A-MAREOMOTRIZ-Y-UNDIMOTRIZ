// Escena 3D de la granja de turbinas de corriente mareal.
//
// Lo que enseña: la corriente (partículas en suspensión, a su velocidad real
// a la escala de la escena) atraviesa los rotores y los hace girar. El giro
// sale de la velocidad específica de punta: ω = TSR·U/R, así que la punta de
// la pala va TSR veces más rápida que el agua, como en una turbina real.

// @ts-ignore — three se empaqueta por Vite sin @types
import * as THREE from "three";
import { formatearNumero } from "../../../utils/formato";
import type {
  ContextoEscena3D,
  Encuadre3D,
  Escena3D,
  Grupo3D,
  ManijasEscena3D,
  MaterialEstandar3D,
  TipoCimentacion3D,
} from "../tipos";
import { manijasVacias } from "../tipos";
import { UNIFORMES_MAR } from "../ambiente";
import { crearParticulas, crearSuperficieMar, fijarEstelas } from "../agua";
import {
  crearCableConPulso,
  crearEtiqueta,
  crearLechoArena,
  crearMatPintado,
  crearRocasLecho,
  pintarEtiqueta,
} from "../utilidades";

export const COTAS_GRANJA = {
  yLecho: -6.0,
  ySuperficie: 1.35,
  hPilar: 9.0,
  hRotor: 3.4,
  pasoFila: 7.4,
  zCercana: 3.2,
  zLejana: -6.2,
} as const;

/** Radio del rotor en unidades de mundo y en metros (≈ 20 m de diámetro). */
const R_ROTOR = 3.0;
const R_ROTOR_M = 10;
const U_POR_M = R_ROTOR / R_ROTOR_M;
/** Velocidad específica de punta típica de una turbina mareal tripala. */
const TSR = 4.5;
/** Guiñada de la granja: la corriente cruza la pantalla en diagonal y los
 *  discos de los rotores se ven en tres cuartos. */
const GUINADA = 0.6;
const NIEBLA = { color: 0xa8c8da, near: 45, far: 165 };

interface MaterialesGranja {
  acero: MaterialEstandar3D;
  aceroOscuro: MaterialEstandar3D;
  amarillo: MaterialEstandar3D;
  blanco: MaterialEstandar3D;
  hormigon: MaterialEstandar3D;
  pala: MaterialEstandar3D;
  rojoBaliza: MaterialEstandar3D;
}

function materialesGranja(ctx: ContextoEscena3D): MaterialesGranja {
  const pint = crearMatPintado;
  return {
    acero: pint(0xb9c2c9, { metalness: 0.45, roughness: 0.42, envMapIntensity: 1.1 }),
    aceroOscuro: pint(0x5d6871, { metalness: 0.4, roughness: 0.5 }),
    amarillo: pint(0xf0b400, { metalness: 0.12, roughness: 0.45 }),
    blanco: pint(0xeef0f0, { metalness: 0.1, roughness: 0.4 }),
    hormigon: ctx.mat(0x9a9c95, { metalness: 0, roughness: 0.95 }),
    // Rojo de las palas: el color va por vértice (punta con marca clara).
    pala: pint(0xffffff, { metalness: 0.15, roughness: 0.38, vertexColors: true }),
    rojoBaliza: ctx.mat(0xe02a20, {
      metalness: 0.05,
      roughness: 0.4,
      emissive: 0x7a0c08,
      emissiveIntensity: 0.6,
    }),
  };
}

/**
 * Pala con perfil aerodinámico (NACA de 4 cifras), cuerda y espesor que se
 * estrechan hacia la punta y torsión de raíz a punta, como una pala real.
 * Radio en +Y, eje de giro en Z.
 */
function geometriaPala(calidadBaja: boolean): THREE.BufferGeometry {
  const estaciones = calidadBaja ? 8 : 18;
  const nPerfil = calidadBaja ? 10 : 20;
  const r0 = 0.3;
  const pos: number[] = [];
  const col: number[] = [];
  for (let s = 0; s <= estaciones; s++) {
    const u = s / estaciones;
    const r = r0 + (R_ROTOR - r0) * u;
    // Raíz casi cilíndrica que se abre a la cuerda máxima y luego se afila.
    const abre = Math.min(1, u / 0.16);
    const cuerda = (0.26 + 0.44 * abre) * (1 - 0.72 * Math.pow(u, 1.25)) * (u > 0.97 ? 0.8 : 1);
    const espesor = 0.6 - 0.44 * Math.min(1, u / 0.3) - 0.04 * u;
    const torsion = 0.56 * Math.pow(1 - u, 1.6) + 0.06;
    const ct = Math.cos(torsion);
    const st = Math.sin(torsion);
    for (let i = 0; i < nPerfil; i++) {
      // Contorno cerrado: extradós de borde de fuga a ataque e intradós de vuelta.
      const a = (i / nPerfil) * Math.PI * 2;
      const x = 0.5 * (1 + Math.cos(a));
      const yt =
        5 * espesor *
        (0.2969 * Math.sqrt(x) - 0.126 * x - 0.3516 * x * x + 0.2843 * x ** 3 - 0.1036 * x ** 4);
      const comba = 0.04 * 4 * x * (1 - x);
      const px = (x - 0.3) * cuerda;
      const pz = (comba + (a < Math.PI ? yt : -yt)) * cuerda;
      pos.push(px * ct - pz * st, r, px * st + pz * ct);
      // Rojo señal; el último tramo, crema: se ve pasar la punta al girar.
      if (u > 0.86) col.push(0.93, 0.86, 0.7);
      else col.push(0.8, 0.09, 0.06);
    }
  }
  const idx: number[] = [];
  for (let s = 0; s < estaciones; s++) {
    for (let i = 0; i < nPerfil; i++) {
      const a = s * nPerfil + i;
      const b = s * nPerfil + ((i + 1) % nPerfil);
      const c = a + nPerfil;
      const d = b + nPerfil;
      idx.push(a, c, b, b, c, d);
    }
  }
  // Tapa de la punta.
  const base = estaciones * nPerfil;
  for (let i = 1; i < nPerfil - 1; i++) idx.push(base, base + i + 1, base + i);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute("color", new THREE.Float32BufferAttribute(col, 3));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  return geo;
}

function construirRotor(mats: MaterialesGranja, calidadBaja: boolean): THREE.Group {
  const rotor = new THREE.Group();
  const geoPala = geometriaPala(calidadBaja);
  for (let b = 0; b < 3; b++) {
    const pala = new THREE.Mesh(geoPala, mats.pala);
    pala.rotation.z = (b * Math.PI * 2) / 3;
    pala.castShadow = true;
    rotor.add(pala);
  }
  // Buje con ojiva: perfil de revolución alrededor del eje de giro.
  const perfil = [
    [0.48, -0.3],
    [0.48, 0.05],
    [0.42, 0.42],
    [0.3, 0.72],
    [0.14, 0.9],
    [0.0, 0.95],
  ].map(([r, y]) => new THREE.Vector2(r, y));
  const buje = new THREE.Mesh(
    new THREE.LatheGeometry(perfil, calidadBaja ? 12 : 24),
    mats.blanco
  );
  buje.rotation.x = Math.PI / 2;
  buje.castShadow = true;
  rotor.add(buje);
  return rotor;
}

function construirCimentacion(
  mats: MaterialesGranja,
  tipo: TipoCimentacion3D,
  calidadBaja: boolean,
  destino: THREE.Object3D
): void {
  const seg = calidadBaja ? 14 : 28;
  if (tipo === "gravedad") {
    // Base de gravedad: losa de hormigón ancha con faldón.
    const losa = new THREE.Mesh(new THREE.CylinderGeometry(2.0, 2.3, 0.7, seg), mats.hormigon);
    losa.position.y = 0.35;
    losa.castShadow = true;
    losa.receiveShadow = true;
    destino.add(losa);
    const cono = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 1.5, 1.3, seg), mats.hormigon);
    cono.position.y = 1.35;
    cono.castShadow = true;
    destino.add(cono);
    return;
  }
  if (tipo === "tripode") {
    for (let i = 0; i < 3; i++) {
      const ang = (i * Math.PI * 2) / 3 + 0.5;
      const pie = new THREE.Vector3(Math.cos(ang) * 2.3, 0.25, Math.sin(ang) * 2.3);
      const alto = new THREE.Vector3(0, 2.7, 0);
      const largo = pie.distanceTo(alto);
      const pata = new THREE.Mesh(
        new THREE.CylinderGeometry(0.16, 0.2, largo, calidadBaja ? 8 : 12),
        mats.aceroOscuro
      );
      pata.position.copy(pie).lerp(alto, 0.5);
      pata.quaternion.setFromUnitVectors(
        new THREE.Vector3(0, 1, 0),
        alto.clone().sub(pie).normalize()
      );
      pata.castShadow = true;
      destino.add(pata);
      const zapata = new THREE.Mesh(
        new THREE.CylinderGeometry(0.5, 0.55, 0.4, calidadBaja ? 10 : 16),
        mats.hormigon
      );
      zapata.position.set(pie.x, 0.2, pie.z);
      zapata.castShadow = true;
      zapata.receiveShadow = true;
      destino.add(zapata);
    }
    return;
  }
  // Monopilote hincado: camisa de transición y escollera contra la socavación.
  const camisa = new THREE.Mesh(new THREE.CylinderGeometry(0.58, 0.62, 1.3, seg), mats.aceroOscuro);
  camisa.position.y = 0.65;
  camisa.castShadow = true;
  destino.add(camisa);
  const escollera = new THREE.Mesh(
    new THREE.CylinderGeometry(1.5, 2.1, 0.3, seg),
    mats.hormigon
  );
  escollera.position.y = 0.12;
  escollera.receiveShadow = true;
  destino.add(escollera);
}

/** Una turbina completa, con el origen en el lecho bajo el eje del pilar. */
function construirUnidad(
  mats: MaterialesGranja,
  opts: { cimentacion: TipoCimentacion3D; calidadBaja: boolean }
): { grupo: THREE.Group; rotor: THREE.Group } {
  const B = opts.calidadBaja;
  const seg = B ? 14 : 28;
  const u = new THREE.Group();
  const hPilar = COTAS_GRANJA.hPilar;
  const yAgua = COTAS_GRANJA.ySuperficie - COTAS_GRANJA.yLecho;

  construirCimentacion(mats, opts.cimentacion, B, u);

  const pilar = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.46, hPilar, seg), mats.acero);
  pilar.position.y = hPilar / 2;
  pilar.castShadow = true;
  pilar.receiveShadow = true;
  u.add(pilar);
  for (const y of [2.2, 5.2]) {
    const brida = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.1, seg), mats.aceroOscuro);
    brida.position.y = y;
    u.add(brida);
  }

  // Pieza de transición amarilla en la zona de salpicadura.
  const transicion = new THREE.Mesh(
    new THREE.CylinderGeometry(0.47, 0.47, 2.2, seg),
    mats.amarillo
  );
  transicion.position.y = yAgua + 0.5;
  transicion.castShadow = true;
  u.add(transicion);

  // Plataforma de trabajo con barandilla y escala.
  const yPlat = hPilar;
  const plataforma = new THREE.Mesh(new THREE.CylinderGeometry(1.25, 1.25, 0.1, seg), mats.aceroOscuro);
  plataforma.position.y = yPlat;
  plataforma.castShadow = true;
  plataforma.receiveShadow = true;
  u.add(plataforma);
  const mensula = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 0.45, 0.5, seg), mats.amarillo);
  mensula.position.y = yPlat - 0.3;
  mensula.castShadow = true;
  u.add(mensula);
  for (const y of [0.35, 0.7]) {
    const rail = new THREE.Mesh(new THREE.TorusGeometry(1.2, 0.022, 6, seg), mats.amarillo);
    rail.rotation.x = Math.PI / 2;
    rail.position.y = yPlat + y;
    u.add(rail);
  }
  const nPostes = B ? 6 : 10;
  for (let i = 0; i < nPostes; i++) {
    const ang = (i / nPostes) * Math.PI * 2;
    const poste = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.7, 5), mats.amarillo);
    poste.position.set(Math.cos(ang) * 1.2, yPlat + 0.35, Math.sin(ang) * 1.2);
    u.add(poste);
  }
  for (const s of [-1, 1]) {
    const larguero = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 2.4, 5), mats.amarillo);
    larguero.position.set(s * 0.14, yPlat - 1.2, -0.5);
    u.add(larguero);
  }

  // Armario eléctrico y baliza de señalización.
  const armario = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.8, 0.5), mats.blanco);
  armario.position.set(-0.35, yPlat + 0.45, -0.2);
  armario.castShadow = true;
  u.add(armario);
  const mastil = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 1.7, 8), mats.blanco);
  mastil.position.set(0.4, yPlat + 0.9, 0.1);
  u.add(mastil);
  for (let i = 0; i < 2; i++) {
    const franja = new THREE.Mesh(new THREE.CylinderGeometry(0.062, 0.066, 0.3, 8), mats.rojoBaliza);
    franja.position.set(0.4, yPlat + 0.6 + i * 0.6, 0.1);
    u.add(franja);
  }
  const luz = new THREE.Mesh(
    new THREE.SphereGeometry(0.1, 10, 8),
    new THREE.MeshBasicMaterial({ color: 0xff4a30 })
  );
  luz.position.set(0.4, yPlat + 1.85, 0.1);
  luz.userData.esLuz = true;
  u.add(luz);

  // Góndola: carena del generador, por delante del pilar.
  const yRotor = COTAS_GRANJA.hRotor;
  const perfil = [
    [0.0, -1.5],
    [0.2, -1.42],
    [0.4, -1.1],
    [0.5, -0.5],
    [0.52, 0.5],
    [0.5, 1.0],
    [0.48, 1.25],
  ].map(([r, y]) => new THREE.Vector2(r, y));
  const gondola = new THREE.Mesh(new THREE.LatheGeometry(perfil, seg), mats.blanco);
  gondola.rotation.x = Math.PI / 2;
  gondola.position.set(0, yRotor, 0.85);
  gondola.castShadow = true;
  u.add(gondola);
  const abrazadera = new THREE.Mesh(
    new THREE.CylinderGeometry(0.56, 0.56, 1.2, seg),
    mats.aceroOscuro
  );
  abrazadera.position.set(0, yRotor, 0);
  abrazadera.castShadow = true;
  u.add(abrazadera);
  for (const z of [0.6, 1.5]) {
    const aro = new THREE.Mesh(new THREE.TorusGeometry(0.52, 0.03, 6, seg), mats.aceroOscuro);
    aro.position.set(0, yRotor, z);
    u.add(aro);
  }

  const rotor = construirRotor(mats, B);
  rotor.position.set(0, yRotor, 2.42);
  u.add(rotor);

  return { grupo: u, rotor };
}

export function posicionesGranja(cantidad: number): { x: number; z: number }[] {
  const n = Math.max(1, Math.min(24, Math.floor(cantidad) || 1));
  const porFila = Math.max(2, Math.ceil(n / 2));
  const pos: { x: number; z: number }[] = [];
  for (let i = 0; i < n; i++) {
    const fila = Math.floor(i / porFila);
    const col = i % porFila;
    const enFila = Math.min(porFila, n - fila * porFila);
    const desfase = fila === 0 ? 0 : COTAS_GRANJA.pasoFila * 0.45;
    pos.push({
      x: (col - (enFila - 1) / 2) * COTAS_GRANJA.pasoFila + desfase,
      z: fila === 0 ? COTAS_GRANJA.zCercana : COTAS_GRANJA.zLejana,
    });
  }
  return pos;
}

export const escenaGranja: Escena3D = {
  encuadre(ctx?: ContextoEscena3D): Encuadre3D {
    // El radio crece con el número de unidades para que ninguna quede fuera.
    const n = Math.max(1, Math.min(24, Math.floor(ctx?.cantidadUnidades ?? 3) || 3));
    const pos = posicionesGranja(n);
    let maxX = 0;
    let minZ = 0;
    let maxZ = 0;
    for (const p of pos) {
      maxX = Math.max(maxX, Math.abs(p.x));
      minZ = Math.min(minZ, p.z);
      maxZ = Math.max(maxZ, p.z);
    }
    const radio = Math.max(7.6, maxX + 3.4, Math.abs(minZ) + 2.2, maxZ + 3.4);
    return {
      posicion: { x: 6.5, y: 4.6, z: 19.0 },
      lookAt: { x: 0.0, y: -1.0, z: -2.0 },
      fondo: NIEBLA.color,
      niebla: { near: NIEBLA.near, far: NIEBLA.far },
      radio,
      margen: 1.02,
      sol: { x: 0.5, y: 0.66, z: 0.36 },
      // La ola aquí es contexto, no recurso: casi a la escala de las turbinas.
      escalaOla: 0.45,
    };
  },

  construir(g: Grupo3D, ctx: ContextoEscena3D): ManijasEscena3D {
    const m = manijasVacias();
    const B = ctx.calidadBaja;
    const mats = materialesGranja(ctx);
    // Canal de marea de agua clara: los rotores tienen que leerse al fondo.
    UNIFORMES_MAR.uTurbidez.value = 0.55;

    const lecho = crearLechoArena(280, 240, COTAS_GRANJA.yLecho, B, { amplitud: 0.45 });
    lecho.position.z = -50;
    g.add(lecho);
    g.add(crearRocasLecho(B ? 10 : 22, 150, 110, COTAS_GRANJA.yLecho, 31));

    const marInfo = crearSuperficieMar(300, 260, COTAS_GRANJA.ySuperficie, B, {
      niebla: NIEBLA,
      focoZ: 50,
      opacidad: 0.42,
    });
    marInfo.malla.position.z = -50;
    g.add(marInfo.malla);
    m.mar = marInfo.malla;

    const pos = posicionesGranja(ctx.cantidadUnidades);
    const ptsCable: THREE.Vector3[] = [];
    const luces: THREE.Mesh[] = [];
    pos.forEach((p) => {
      const { grupo, rotor } = construirUnidad(mats, {
        cimentacion: ctx.cimentacion,
        calidadBaja: B,
      });
      grupo.position.set(p.x, COTAS_GRANJA.yLecho, p.z);
      grupo.rotation.y = GUINADA;
      grupo.traverse((o: THREE.Object3D) => {
        if (o.userData.esLuz) luces.push(o as THREE.Mesh);
      });
      g.add(grupo);
      m.rotores.push(rotor);
      ptsCable.push(new THREE.Vector3(p.x - 1.2, COTAS_GRANJA.yLecho + 0.12, p.z - 1.6));
    });
    m.estado.luces = luces;
    fijarEstelas(
      marInfo.malla,
      pos.slice(0, 6).map((p) => ({ x: p.x, z: p.z, radio: 0.47, fuerza: 0.9 }))
    );

    ptsCable.sort((a, b) => a.x - b.x);
    ptsCable.push(new THREE.Vector3(16, COTAS_GRANJA.yLecho + 0.1, -4));
    ptsCable.push(new THREE.Vector3(30, COTAS_GRANJA.yLecho + 0.1, -7));
    const { cable, curva, pulso } = crearCableConPulso(ptsCable, 0.1);
    g.add(cable);
    m.pulsoCurva = curva;
    m.pulso = pulso;
    g.add(pulso);

    // Partículas que arrastra la corriente (entra por delante de los rotores).
    const particulas = crearParticulas({
      cantidad: B ? 260 : 800,
      min: { x: -16, y: COTAS_GRANJA.yLecho + 0.4, z: -14 },
      max: { x: 16, y: COTAS_GRANJA.ySuperficie - 0.5, z: 12 },
      tam: 0.11,
      opacidad: 0.75,
      semilla: 5,
    });
    g.add(particulas);
    m.estado.particulas = particulas;
    m.estado.angulo = 0;

    const n = pos.length;
    m.etiquetaDispositivo = crearEtiqueta(
      `Granja mareomotriz · ${n} unidad${n > 1 ? "es" : ""}`
    );
    m.etiquetaDispositivo.position.set(0, 6.6, 0);
    m.etiquetaDispositivo.userData.prioridad = 2;
    g.add(m.etiquetaDispositivo);

    // Rótulo vivo: corriente y régimen del rotor que resulta de ella.
    m.etiquetaCiclo = crearEtiqueta("Corriente");
    m.etiquetaCiclo.position.set(pos[0].x - 3.6, COTAS_GRANJA.yLecho + COTAS_GRANJA.hRotor - 3.4, pos[0].z + 2);
    m.etiquetaCiclo.userData.prioridad = 1;
    g.add(m.etiquetaCiclo);

    return m;
  },

  animar(t: number, ctx: ContextoEscena3D, m: ManijasEscena3D): void {
    const U = Math.max(0, ctx.velocidadCorriente);
    // ω = TSR·U/R: giro proporcional a la corriente, en tiempo real.
    const omega = (TSR * U) / R_ROTOR_M;
    m.estado.angulo = ((m.estado.angulo as number) + omega * ctx.dt) % (Math.PI * 2);
    m.rotores.forEach((r, i) => {
      r.rotation.z = -(m.estado.angulo as number) - i * 0.7;
    });

    // La corriente llega de frente a los rotores (−Z local de cada turbina).
    const part = m.estado.particulas as THREE.Points | undefined;
    if (part) {
      const avance = part.userData.avance as THREE.Vector3;
      const paso = U * U_POR_M * ctx.dt;
      avance.x = (avance.x - Math.sin(GUINADA) * paso) % 32;
      avance.z = (avance.z - Math.cos(GUINADA) * paso) % 26;
    }
    const on = Math.sin(t * 2.4) > 0.35;
    for (const luz of (m.estado.luces as THREE.Mesh[] | undefined) ?? []) {
      luz.scale.setScalar(on ? 1.5 : 0.8);
    }

    const rpm = (omega * 60) / (2 * Math.PI);
    const texto = `Corriente ${formatearNumero(U, 1)} m/s · rotor ${formatearNumero(rpm, 0)} rpm`;
    if (texto !== m.ultimoTextoCiclo && m.etiquetaCiclo) {
      pintarEtiqueta(m.etiquetaCiclo, texto);
      m.ultimoTextoCiclo = texto;
    }
  },
};
