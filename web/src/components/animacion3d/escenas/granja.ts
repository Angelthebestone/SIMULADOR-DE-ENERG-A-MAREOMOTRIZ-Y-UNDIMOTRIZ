// Escena 3D de granja de turbinas de corriente — corte tipo diorama/acuario
// alineado con mareomotriz_granja_turbinas_corriente.jpg:
//   horizonte a media altura, agua semitransparente por debajo de la línea de
//   flotación, lecho arenoso a la vista, pilares plateados con embudo y baliza,
//   rotores rojos de 3 palas cerca del lecho.
//
// Trucos de realismo sin assets:
//   - environment map procedural → el metal sí refleja
//   - tone mapping ACES en el motor → color no lavado
//   - sin caja de agua cerrada: la lámina de superficie vista de canto casi
//     desaparece y el sumergido se ve limpio (como un corte didáctico)
//   - palas con perfil extruido, no cajas

// @ts-ignore — three se empaqueta por Vite sin @types
import * as THREE from "three";
import type {
  ContextoEscena3D,
  Encuadre3D,
  Escena3D,
  EscenaThree3D,
  Grupo3D,
  ManijasEscena3D,
  MaterialEstandar3D,
  TipoCimentacion3D,
} from "../tipos";
import { manijasVacias } from "../tipos";
import {
  crearCableConPulso,
  crearCielo,
  crearEntornoMarino,
  crearEtiqueta,
  crearLechoArena,
  crearMat,
  crearRocasLecho,
  crearSuperficieMar,
} from "../utilidades";

export const COTAS_GRANJA = {
  yLecho: -6.0,
  ySuperficie: 1.35,
  hPilar: 8.3,
  hRotor: 2.25,
  pasoFila: 7.0,
  zCercana: 3.2,
  zLejana: -6.2,
} as const;

export interface MaterialesGranja {
  metal: MaterialEstandar3D;
  metalClaro: MaterialEstandar3D;
  metalOscuro: MaterialEstandar3D;
  baseGris: MaterialEstandar3D;
  arena: MaterialEstandar3D;
  rojoPala: MaterialEstandar3D;
  naranjaPala: MaterialEstandar3D;
  rojoBaliza: MaterialEstandar3D;
  blancoBaliza: MaterialEstandar3D;
  espuma: MaterialEstandar3D;
}

export function materialesGranja(mat: ContextoEscena3D["mat"]): MaterialesGranja {
  // Con envMap en escena, metalness media-alta sí lee reflejos.
  return {
    metal: mat(0xd0d6dc, { metalness: 0.55, roughness: 0.28, envMapIntensity: 1.2 }),
    metalClaro: mat(0xe8edf1, { metalness: 0.48, roughness: 0.22, envMapIntensity: 1.35 }),
    metalOscuro: mat(0x8e979f, { metalness: 0.4, roughness: 0.4, envMapIntensity: 0.9 }),
    baseGris: mat(0x9aa1a8, { metalness: 0.12, roughness: 0.72 }),
    arena: mat(0xc4a86a, { metalness: 0.0, roughness: 0.96 }),
    rojoPala: mat(0xe01818, { metalness: 0.08, roughness: 0.38, envMapIntensity: 0.7 }),
    naranjaPala: mat(0xf5a010, { metalness: 0.08, roughness: 0.36 }),
    rojoBaliza: mat(0xf02020, {
      metalness: 0.05,
      roughness: 0.35,
      emissive: 0x881010,
      emissiveIntensity: 0.85,
    }),
    blancoBaliza: mat(0xf7f7f7, { metalness: 0.06, roughness: 0.32 }),
    espuma: mat(0xf2f8fa, { metalness: 0.0, roughness: 0.55, transparent: true, opacity: 0.55 }),
  };
}

/** Pala con perfil de hélice extruido (raíz ancha → punta estrecha + alabeo). */
function construirPala(
  mats: MaterialesGranja,
  calidadBaja: boolean,
  fase: number
): THREE.Group {
  const porta = new THREE.Group();
  porta.rotation.z = fase;

  const shape = new THREE.Shape();
  // Raíz
  shape.moveTo(-0.12, 0.05);
  shape.lineTo(0.16, 0.05);
  // Borde de ataque hacia la punta
  shape.quadraticCurveTo(0.42, 0.9, 0.36, 1.9);
  shape.quadraticCurveTo(0.32, 2.55, 0.12, 3.05);
  // Punta
  shape.lineTo(-0.02, 3.0);
  // Borde de fuga
  shape.quadraticCurveTo(-0.22, 2.2, -0.28, 1.2);
  shape.quadraticCurveTo(-0.26, 0.5, -0.12, 0.05);

  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: 0.09,
    bevelEnabled: true,
    bevelThickness: 0.025,
    bevelSize: 0.02,
    bevelSegments: calidadBaja ? 1 : 2,
    curveSegments: calidadBaja ? 4 : 8,
  });
  geo.translate(0, 0, -0.045);
  const pala = new THREE.Mesh(geo, mats.rojoPala);
  pala.castShadow = true;
  porta.add(pala);

  // Marca naranja en el tercio exterior.
  const marca = new THREE.Mesh(
    new THREE.BoxGeometry(0.34, 0.5, 0.12),
    mats.naranjaPala
  );
  marca.position.set(0.08, 2.7, 0);
  marca.rotation.z = 0.15;
  porta.add(marca);

  return porta;
}

export function construirRotorGranja(
  mats: MaterialesGranja,
  calidadBaja: boolean
): THREE.Group {
  const rotor = new THREE.Group();
  for (let b = 0; b < 3; b++) {
    rotor.add(construirPala(mats, calidadBaja, (b * Math.PI * 2) / 3));
  }
  const buje = new THREE.Mesh(
    new THREE.SphereGeometry(0.28, calidadBaja ? 8 : 16, calidadBaja ? 6 : 12),
    mats.metalOscuro
  );
  buje.castShadow = true;
  rotor.add(buje);
  const nariz = new THREE.Mesh(
    new THREE.ConeGeometry(0.24, 0.55, calidadBaja ? 8 : 14),
    mats.metalClaro
  );
  nariz.rotation.x = Math.PI / 2;
  nariz.position.z = 0.4;
  nariz.castShadow = true;
  rotor.add(nariz);
  return rotor;
}

/** Embudo plateado con perfil Lathe (normales hacia fuera). */
function construirEmbudo(mats: MaterialesGranja, calidadBaja: boolean): THREE.Group {
  const g = new THREE.Group();
  const seg = calidadBaja ? 16 : 32;
  // Perfil de abajo a arriba: cuello → aleta ancha.
  const perfil = [
    new THREE.Vector2(0.01, 0),
    new THREE.Vector2(0.42, 0.02),
    new THREE.Vector2(0.46, 0.14),
    new THREE.Vector2(0.58, 0.3),
    new THREE.Vector2(0.88, 0.55),
    new THREE.Vector2(1.18, 0.8),
    new THREE.Vector2(1.36, 0.98),
    new THREE.Vector2(1.4, 1.08),
    new THREE.Vector2(1.38, 1.1),
  ];
  const embudo = new THREE.Mesh(
    new THREE.LatheGeometry(perfil, seg),
    mats.metalClaro
  );
  embudo.castShadow = true;
  g.add(embudo);

  const tapa = new THREE.Mesh(
    new THREE.CylinderGeometry(1.38, 1.38, 0.09, seg),
    mats.metal
  );
  tapa.position.y = 1.14;
  tapa.castShadow = true;
  tapa.receiveShadow = true;
  g.add(tapa);

  // Barandilla
  const baranda = new THREE.Mesh(
    new THREE.TorusGeometry(1.3, 0.035, 6, calidadBaja ? 12 : 28),
    mats.metal
  );
  baranda.rotation.x = Math.PI / 2;
  baranda.position.y = 1.42;
  g.add(baranda);
  const nPostes = calidadBaja ? 5 : 9;
  for (let i = 0; i < nPostes; i++) {
    const ang = (i / nPostes) * Math.PI * 2;
    const poste = new THREE.Mesh(
      new THREE.CylinderGeometry(0.028, 0.028, 0.3, 5),
      mats.metal
    );
    poste.position.set(Math.cos(ang) * 1.3, 1.28, Math.sin(ang) * 1.3);
    g.add(poste);
  }
  return g;
}

function construirBaliza(mats: MaterialesGranja, calidadBaja: boolean): THREE.Group {
  const g = new THREE.Group();
  const pilon = new THREE.Mesh(
    new THREE.CylinderGeometry(0.045, 0.055, 0.65, calidadBaja ? 6 : 10),
    mats.metal
  );
  pilon.position.y = 0.32;
  g.add(pilon);

  const nSeg = 5;
  const hSeg = 0.28;
  for (let i = 0; i < nSeg; i++) {
    const seg = new THREE.Mesh(
      new THREE.CylinderGeometry(0.15, 0.15, hSeg, calidadBaja ? 8 : 14),
      i % 2 === 0 ? mats.rojoBaliza : mats.blancoBaliza
    );
    seg.position.y = 0.72 + i * (hSeg + 0.015);
    seg.castShadow = true;
    g.add(seg);
  }
  // Tapa
  const tapa = new THREE.Mesh(
    new THREE.CylinderGeometry(0.12, 0.16, 0.08, calidadBaja ? 8 : 12),
    mats.rojoBaliza
  );
  tapa.position.y = 0.72 + nSeg * (hSeg + 0.015);
  g.add(tapa);
  return g;
}

function construirCimentacion(
  mats: MaterialesGranja,
  tipo: TipoCimentacion3D,
  calidadBaja: boolean,
  destino: THREE.Object3D,
  x: number,
  z: number,
  yLecho: number
): void {
  const seg = calidadBaja ? 14 : 24;
  const radioBase = tipo === "gravedad" ? 1.6 : 1.32;

  // Plinto con ligero tronco de cono.
  const base = new THREE.Mesh(
    new THREE.CylinderGeometry(radioBase * 0.92, radioBase * 1.08, 0.65, seg),
    mats.baseGris
  );
  base.position.set(x, yLecho + 0.32, z);
  base.castShadow = true;
  base.receiveShadow = true;
  destino.add(base);

  const anillo = new THREE.Mesh(
    new THREE.TorusGeometry(radioBase * 0.7, 0.11, 8, calidadBaja ? 12 : 20),
    mats.metalOscuro
  );
  anillo.rotation.x = Math.PI / 2;
  anillo.position.set(x, yLecho + 0.64, z);
  anillo.castShadow = true;
  destino.add(anillo);

  // Pernos
  const nPer = calidadBaja ? 4 : 8;
  for (let i = 0; i < nPer; i++) {
    const ang = (i / nPer) * Math.PI * 2 + 0.2;
    const p = new THREE.Mesh(
      new THREE.CylinderGeometry(0.07, 0.08, 0.16, 6),
      mats.metalOscuro
    );
    p.position.set(
      x + Math.cos(ang) * radioBase * 0.78,
      yLecho + 0.72,
      z + Math.sin(ang) * radioBase * 0.78
    );
    destino.add(p);
  }

  if (tipo === "tripode") {
    for (const s of [-1, 0, 1]) {
      const pata = new THREE.Mesh(
        new THREE.CylinderGeometry(0.15, 0.2, 2.9, calidadBaja ? 6 : 10),
        mats.metalOscuro
      );
      const ang = s * 1.05;
      pata.position.set(x + Math.sin(ang) * 1.0, yLecho + 1.55, z + Math.cos(ang) * 0.58);
      pata.rotation.z = s * 0.38;
      pata.castShadow = true;
      destino.add(pata);
    }
  } else if (tipo === "pilote") {
    const zapa = new THREE.Mesh(
      new THREE.CylinderGeometry(0.58, 0.7, 1.0, calidadBaja ? 8 : 14),
      mats.metalOscuro
    );
    zapa.position.set(x, yLecho + 1.05, z);
    zapa.castShadow = true;
    destino.add(zapa);
  }
}

/** Lecho de arena con dunas, color por vértice y rocas. Grande hasta la niebla. */
function construirLechoArena(g: Grupo3D, mats: MaterialesGranja, calidadBaja: boolean) {
  const lecho = crearLechoArena(280, 240, COTAS_GRANJA.yLecho, calidadBaja, {
    amplitud: 0.5,
    tono: 0.95,
  });
  lecho.position.z = -50;
  g.add(lecho);
  g.add(crearRocasLecho(12, 150, 110, COTAS_GRANJA.yLecho, 31));
}

/** Anillo de espuma en la línea de flotación del pilar. */
function construirEspuma(
  mats: MaterialesGranja,
  x: number,
  z: number,
  y: number
): THREE.Mesh {
  const espuma = new THREE.Mesh(
    new THREE.TorusGeometry(0.55, 0.07, 6, 20),
    mats.espuma
  );
  espuma.rotation.x = Math.PI / 2;
  espuma.position.set(x, y, z);
  return espuma;
}

export function construirUnidadTurbinaGranja(
  destino: THREE.Object3D,
  x: number,
  z: number,
  mats: MaterialesGranja,
  opts: { cimentacion: TipoCimentacion3D; calidadBaja: boolean }
): { rotor: THREE.Group } {
  const yLecho = COTAS_GRANJA.yLecho;
  const hPilar = COTAS_GRANJA.hPilar;
  const yCorona = yLecho + hPilar;
  const yRotor = yLecho + COTAS_GRANJA.hRotor;
  const seg = opts.calidadBaja ? 12 : 22;

  construirCimentacion(mats, opts.cimentacion, opts.calidadBaja, destino, x, z, yLecho);

  const pilar = new THREE.Mesh(
    new THREE.CylinderGeometry(0.34, 0.44, hPilar, seg),
    mats.metal
  );
  pilar.position.set(x, yLecho + hPilar / 2, z);
  pilar.castShadow = true;
  pilar.receiveShadow = true;
  destino.add(pilar);

  // Anillos de brida
  for (let i = 1; i <= 3; i++) {
    const yj = yLecho + (hPilar * i) / 4;
    const brida = new THREE.Mesh(
      new THREE.TorusGeometry(0.38 - i * 0.01, 0.04, 6, seg),
      mats.metalOscuro
    );
    brida.rotation.x = Math.PI / 2;
    brida.position.set(x, yj, z);
    destino.add(brida);
  }

  destino.add(construirEspuma(mats, x, z, COTAS_GRANJA.ySuperficie));

  const collar = new THREE.Mesh(
    new THREE.CylinderGeometry(0.62, 0.42, 0.9, seg),
    mats.metal
  );
  collar.position.set(x, yCorona - 0.42, z);
  collar.castShadow = true;
  destino.add(collar);

  const embudo = construirEmbudo(mats, opts.calidadBaja);
  embudo.position.set(x, yCorona + 0.02, z);
  destino.add(embudo);

  const baliza = construirBaliza(mats, opts.calidadBaja);
  baliza.position.set(x, yCorona + 1.22, z);
  destino.add(baliza);

  const gondola = new THREE.Mesh(
    new THREE.CylinderGeometry(0.42, 0.48, 1.45, seg),
    mats.metalOscuro
  );
  gondola.rotation.x = Math.PI / 2;
  gondola.position.set(x, yRotor, z + 0.5);
  gondola.castShadow = true;
  destino.add(gondola);

  const brazo = new THREE.Mesh(
    new THREE.BoxGeometry(0.34, 0.34, 0.75),
    mats.metalOscuro
  );
  brazo.position.set(x, yRotor, z + 0.12);
  brazo.castShadow = true;
  destino.add(brazo);

  const rotor = construirRotorGranja(mats, opts.calidadBaja);
  rotor.position.set(x, yRotor, z + 1.45);
  destino.add(rotor);

  return { rotor };
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
  omiteEntornoTierra: true,

  configurarEscena(escenaThree: EscenaThree3D): void {
    const entorno = crearEntornoMarino();
    escenaThree.environment = entorno;
    // Fondo cielo→mar: da horizonte aunque el mar 3D no llegue al borde.
    escenaThree.background = crearCielo();
  },

  encuadre(ctx?: ContextoEscena3D): Encuadre3D {
    // Cámara alta mirando a la granja: la lámina de mar cruza la vista y el
    // azul de niebla tiñe lo lejano. Sin cajas: el horizonte lo pinta el cielo.
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
    const radio = Math.max(7.2, maxX + 2.6, Math.abs(minZ) + 2.2, maxZ + 2.4);
    return {
      posicion: { x: 6.5, y: 4.6, z: 19.0 },
      lookAt: { x: 0.0, y: -1.2, z: -2.0 },
      fondo: 0xa8c8da,
      niebla: { near: 45, far: 165 },
      radio,
      margen: 1.02,
    };
  },

  marFondo(): number {
    return 48;
  },

  construir(g: Grupo3D, ctx: ContextoEscena3D): ManijasEscena3D {
    const m = manijasVacias();
    const mats = materialesGranja(ctx.mat);

    // Arena algo más fría/húmeda: el tinte azul de la niebla la leerá como
    // lecho bajo el agua, no como desierto.
    construirLechoArena(g, mats, ctx.calidadBaja);

    // Una sola lámina de mar, muy ancha (bordes más allá de la niebla) y con
    // oleaje. Sin volumen caja ni plano de horizonte: esos rectángulos eran
    // lo que se veía como "muro azul".
    const marInfo = crearSuperficieMar(280, 240, COTAS_GRANJA.ySuperficie, ctx.calidadBaja, {
      color: 0xa8c8da,
      near: 45,
      far: 165,
    });
    marInfo.malla.position.z = -50;
    g.add(marInfo.malla);
    m.mar = marInfo.malla;
    m.marBase = marInfo.base;
    m.marAncho = marInfo.ancho;

    const pos = posicionesGranja(ctx.cantidadUnidades);
    const ptsCable: THREE.Vector3[] = [];
    pos.forEach((p) => {
      const { rotor } = construirUnidadTurbinaGranja(g, p.x, p.z, mats, {
        cimentacion: ctx.cimentacion,
        calidadBaja: ctx.calidadBaja,
      });
      m.rotores.push(rotor);
      ptsCable.push(new THREE.Vector3(p.x, COTAS_GRANJA.yLecho + 0.18, p.z + 1.6));
    });

    ptsCable.push(new THREE.Vector3(13, COTAS_GRANJA.yLecho + 0.15, -2));
    ptsCable.push(new THREE.Vector3(24, COTAS_GRANJA.yLecho + 0.15, -5));
    if (ptsCable.length >= 2) {
      const { cable, curva, pulso } = crearCableConPulso(ptsCable, 0.12);
      g.add(cable);
      m.pulsoCurva = curva;
      m.pulso = pulso;
      g.add(pulso);
    }

    const n = pos.length;
    m.etiquetaDispositivo = crearEtiqueta(
      `Granja mareomotriz · ${n} unidad${n > 1 ? "es" : ""}`
    );
    m.etiquetaDispositivo.position.set(0, 5.4, 0);
    g.add(m.etiquetaDispositivo);

    return m;
  },

  animar(t: number, ctx: ContextoEscena3D, m: ManijasEscena3D): void {
    const giro = ctx.velocidadCorriente * 2.5 * 0.016;
    for (const r of m.rotores) r.rotation.z += giro;
    if (m.pulso && m.pulsoCurva) {
      m.pulsoCurva.getPointAt((t * 0.22) % 1, m.pulso.position);
    }
  },
};
