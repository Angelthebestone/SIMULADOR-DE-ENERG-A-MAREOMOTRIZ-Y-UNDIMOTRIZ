// Escena 3D del dique mareal — corte abierto tipo diorama, alineado con
// dique_corte_turbina_bulbo.jpg:
//   presa de hormigón con frente ABIERTO (muñeca de corte), cámaras verticales,
//   eje azul, bulbo Kaplan + rotor a la vista, mar a la izquierda, embalse a
//   la derecha, lecho ocre.
// El bloque de hormigón no es una caja sólida: se compone de piezas que
// dejan un hueco frontal para ver la máquina, como el corte de la referencia.

// @ts-ignore — three se empaqueta por Vite sin @types
import * as THREE from "three";
import { formatearNumero } from "../../../utils/formato";
import type {
  ContextoEscena3D,
  Encuadre3D,
  Escena3D,
  EscenaThree3D,
  Grupo3D,
  ManijasEscena3D,
  Malla3D,
} from "../tipos";
import { manijasVacias } from "../tipos";
import {
  crearCielo,
  crearEntornoMarino,
  crearEtiqueta,
  crearSuperficieMar,
  pintarEtiqueta,
} from "../utilidades";

const COL = {
  hormigon: 0xc2c7cb,
  hormigonOsc: 0x8f979d,
  eje: 0x2f8fd4,
  bulbo: 0xd0d6dc,
  bulboOsc: 0x6a747c,
  pala: 0xf0f4f6,
  camaraFondo: 0x3d5a62,
  arena: 0xc4a06a,
  mar: 0x1a6f9c,
  embalse: 0x2a8fb4,
};
const HORMIGON_CLARO = 0xd8dcdc;

export const escenaDique: Escena3D = {
  omiteEntornoTierra: true,

  configurarEscena(escenaThree: EscenaThree3D): void {
    escenaThree.environment = crearEntornoMarino();
    escenaThree.background = crearCielo();
  },

  encuadre(): Encuadre3D {
    // Casi frontal: se lee el corte como la lámina de referencia.
    return {
      posicion: { x: 1.5, y: 2.2, z: 13.5 },
      lookAt: { x: 0.5, y: -2.2, z: 0.8 },
      fondo: 0x7eb6d4,
      niebla: { near: 18, far: 48 },
    };
  },

  marFondo(): number {
    return 16;
  },

  construir(g: Grupo3D, ctx: ContextoEscena3D): ManijasEscena3D {
    const m = manijasVacias();
    const mat = ctx.mat;
    const B = ctx.calidadBaja;

    const hormigon = { roughness: 0.88, metalness: 0.04, envMapIntensity: 0.75 };
    const metal = { roughness: 0.32, metalness: 0.48, envMapIntensity: 1.2 };

    // =====================================================================
    // LECHO
    // =====================================================================
    const lecho = new THREE.Mesh(
      new THREE.BoxGeometry(48, 0.7, 20),
      mat(COL.arena, { roughness: 0.95, metalness: 0 })
    );
    lecho.position.set(2, -6.35, 0);
    lecho.receiveShadow = true;
    g.add(lecho);

    // =====================================================================
    // PRESA EN CORTE ABIERTO (sin tapa frontal)
    // Coordenadas: X = mar(-) / embalse(+), Y = arriba, Z = cámara(+).
    // El hueco frontal (z ≈ +1.5) deja ver bulbo y eje.
    // =====================================================================

    // Muro trasero del corte.
    const trasero = new THREE.Mesh(
      new THREE.BoxGeometry(5.4, 5.8, 1.2),
      mat(COL.hormigonOsc, hormigon)
    );
    trasero.position.set(0, -1.6, -2.2);
    trasero.castShadow = true;
    trasero.receiveShadow = true;
    g.add(trasero);

    // Laterales del bloque (mar y embalse), abiertos al frente.
    for (const s of [-1, 1]) {
      const lateral = new THREE.Mesh(
        new THREE.BoxGeometry(1.35, 5.6, 3.8),
        mat(COL.hormigon, hormigon)
      );
      lateral.position.set(s * 2.1, -1.7, -0.3);
      lateral.castShadow = true;
      lateral.receiveShadow = true;
      g.add(lateral);

      // Talud exterior.
      const talud = new THREE.Mesh(
        new THREE.BoxGeometry(1.2, 4.0, 3.2),
        mat(COL.hormigonOsc, hormigon)
      );
      talud.position.set(s * 3.2, -3.0, -0.3);
      talud.rotation.z = s * 0.3;
      talud.castShadow = true;
      g.add(talud);
    }

    // Suelo de la cámara de máquinas.
    const sueloCamara = new THREE.Mesh(
      new THREE.BoxGeometry(3.2, 0.5, 4.2),
      mat(COL.hormigonOsc, hormigon)
    );
    sueloCamara.position.set(0, -5.15, 0.3);
    sueloCamara.receiveShadow = true;
    g.add(sueloCamara);

    // Fondo de la cámara (detrás del bulbo, más oscuro).
    const fondoCamara = new THREE.Mesh(
      new THREE.BoxGeometry(3.2, 2.6, 0.3),
      mat(COL.camaraFondo, { roughness: 0.7, metalness: 0.08 })
    );
    fondoCamara.position.set(0, -3.7, -1.6);
    g.add(fondoCamara);

    // Techo de la cámara / losa bajo la presa.
    const techoCamara = new THREE.Mesh(
      new THREE.BoxGeometry(3.4, 0.45, 4.0),
      mat(HORMIGON_CLARO, hormigon)
    );
    techoCamara.position.set(0, -2.35, 0.2);
    techoCamara.castShadow = true;
    g.add(techoCamara);

    // Coronación + central.
    const coronacion = new THREE.Mesh(
      new THREE.BoxGeometry(6.2, 0.45, 4.5),
      mat(HORMIGON_CLARO, hormigon)
    );
    coronacion.position.set(0, 1.45, -0.5);
    coronacion.castShadow = true;
    coronacion.receiveShadow = true;
    g.add(coronacion);

    const central = new THREE.Mesh(
      new THREE.BoxGeometry(2.0, 1.25, 2.4),
      mat(COL.hormigonOsc, { roughness: 0.75, metalness: 0.1 })
    );
    central.position.set(0, 2.3, -0.5);
    central.castShadow = true;
    g.add(central);
    const centralTapa = new THREE.Mesh(
      new THREE.BoxGeometry(2.2, 0.12, 2.6),
      mat(0x3a4650, { roughness: 0.55, metalness: 0.18 })
    );
    centralTapa.position.set(0, 2.98, -0.5);
    g.add(centralTapa);

    // Cámaras verticales oscuras en el frente del corte (como la referencia).
    for (const s of [-1, 1]) {
      const hueco = new THREE.Mesh(
        new THREE.BoxGeometry(0.5, 3.4, 0.25),
        mat(0x1e282e, { roughness: 0.65 })
      );
      hueco.position.set(s * 1.35, -0.3, 1.55);
      g.add(hueco);
      const marco = new THREE.Mesh(
        new THREE.BoxGeometry(0.62, 3.55, 0.1),
        mat(HORMIGON_CLARO, hormigon)
      );
      marco.position.set(s * 1.35, -0.3, 1.7);
      g.add(marco);
    }

    // Eje azul vertical, bien a la vista en el corte.
    const eje = new THREE.Mesh(
      new THREE.CylinderGeometry(0.2, 0.2, 6.8, B ? 10 : 14),
      mat(COL.eje, { roughness: 0.32, metalness: 0.45, envMapIntensity: 1.15 })
    );
    eje.position.set(0, -1.2, 1.6);
    eje.castShadow = true;
    g.add(eje);

    const remate = new THREE.Mesh(
      new THREE.CylinderGeometry(0.34, 0.34, 0.32, 12),
      mat(COL.bulboOsc, metal)
    );
    remate.position.set(0, 2.35, 1.6);
    g.add(remate);

    // ---- Bulbo Kaplan + rotor, en el hueco frontal ----
    const bulbo = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.52, 1.0, B ? 4 : 8, B ? 12 : 18),
      mat(COL.bulbo, metal)
    );
    bulbo.rotation.z = Math.PI / 2;
    bulbo.position.set(0.15, -3.65, 1.6);
    bulbo.castShadow = true;
    g.add(bulbo);

    const munon = new THREE.Mesh(
      new THREE.CylinderGeometry(0.2, 0.2, 0.85, 12),
      mat(COL.bulboOsc, metal)
    );
    munon.position.set(-0.7, -3.65, 1.6);
    g.add(munon);

    const rotor = new THREE.Group();
    for (let i = 0; i < 4; i++) {
      const pala = new THREE.Mesh(
        new THREE.BoxGeometry(0.09, 1.2, 0.24),
        mat(COL.pala, { roughness: 0.38, metalness: 0.28, envMapIntensity: 1.05 })
      );
      pala.position.y = 0.65;
      pala.castShadow = true;
      const porta = new THREE.Group();
      porta.rotation.x = (i * Math.PI) / 2;
      porta.add(pala);
      rotor.add(porta);
    }
    rotor.add(
      new THREE.Mesh(
        new THREE.SphereGeometry(0.18, 12, 10),
        mat(COL.bulboOsc, metal)
      )
    );
    rotor.rotation.y = Math.PI / 2;
    rotor.position.set(1.35, -3.65, 1.6);
    g.add(rotor);
    m.rotores = [rotor];

    // Aro de toma a la izquierda del bulbo.
    const aro = new THREE.Mesh(
      new THREE.TorusGeometry(0.68, 0.11, 8, B ? 12 : 20),
      mat(COL.bulboOsc, { roughness: 0.48, metalness: 0.3 })
    );
    aro.rotation.y = Math.PI / 2;
    aro.position.set(-1.55, -3.65, 1.6);
    g.add(aro);

    // =====================================================================
    // AGUA — dos láminas horizontales simples, sin volúmenes.
    // Colocadas a media altura de la presa, pegadas a cada talud.
    // =====================================================================
    const Y_MAR_BASE = 0.1;
    const Y_EMB_BASE = 0.35;

    // Mar (izquierda): plano modesto, borde derecho tocando el talud.
    const marInfo = crearSuperficieMar(12, 7, Y_MAR_BASE, B);
    const matMar = marInfo.malla.material as THREE.MeshPhongMaterial;
    matMar.color.setHex(0x2b86b5);
    matMar.opacity = 0.85;
    matMar.shininess = 180;
    matMar.specular.setHex(0xc8ecf8);
    marInfo.malla.position.set(-9.5, Y_MAR_BASE, 0.2);
    g.add(marInfo.malla);
    m.nivelMar = marInfo.malla;
    (m.nivelMar.userData as Record<string, unknown>).base = marInfo.base;
    (m.nivelMar.userData as Record<string, unknown>).ancho = marInfo.ancho;
    (m.nivelMar.userData as Record<string, unknown>).y0 = Y_MAR_BASE;

    const espumaMar = new THREE.Mesh(
      new THREE.BoxGeometry(0.4, 0.08, 3.2),
      mat(0xf4fafc, { roughness: 0.5, metalness: 0, transparent: true, opacity: 0.75 })
    );
    espumaMar.position.set(-3.4, Y_MAR_BASE, 1.0);
    g.add(espumaMar);
    (m.nivelMar.userData as Record<string, unknown>).espuma = espumaMar;

    // Embalse (derecha).
    const embInfo = crearSuperficieMar(10, 7, Y_EMB_BASE, B);
    const matEmb = embInfo.malla.material as THREE.MeshPhongMaterial;
    matEmb.color.setHex(0x3a9bb8);
    matEmb.opacity = 0.82;
    matEmb.shininess = 160;
    matEmb.specular.setHex(0xb8e4f0);
    embInfo.malla.position.set(8.8, Y_EMB_BASE, 0.2);
    g.add(embInfo.malla);
    m.nivelEmbalse = embInfo.malla;
    (m.nivelEmbalse.userData as Record<string, unknown>).base = embInfo.base;
    (m.nivelEmbalse.userData as Record<string, unknown>).y0 = Y_EMB_BASE;

    const espumaEmb = new THREE.Mesh(
      new THREE.BoxGeometry(0.4, 0.08, 3.2),
      mat(0xf4fafc, { roughness: 0.5, metalness: 0, transparent: true, opacity: 0.7 })
    );
    espumaEmb.position.set(3.4, Y_EMB_BASE, 1.0);
    g.add(espumaEmb);
    (m.nivelEmbalse.userData as Record<string, unknown>).espuma = espumaEmb;

    // =====================================================================
    // Flechas y etiquetas
    // =====================================================================
    m.flechaLlenado = new THREE.ArrowHelper(
      new THREE.Vector3(1, 0, 0),
      new THREE.Vector3(-4.2, -3.65, 2.6),
      3.2,
      0xc7e14a,
      0.7,
      0.42
    );
    m.flechaVaciado = new THREE.ArrowHelper(
      new THREE.Vector3(-1, 0, 0),
      new THREE.Vector3(4.2, -3.65, 2.6),
      3.2,
      0x7fd4e3,
      0.7,
      0.42
    );
    g.add(m.flechaLlenado);
    g.add(m.flechaVaciado);

    m.etiquetaSalto = crearEtiqueta("h 0,0 m");
    m.etiquetaSalto.position.set(-6.2, 3.6, 1);
    g.add(m.etiquetaSalto);

    m.etiquetaCiclo = crearEtiqueta("llenado");
    m.etiquetaCiclo.position.set(-6.2, 2.5, 1);
    g.add(m.etiquetaCiclo);

    m.etiquetaDispositivo = crearEtiqueta("Dique mareal");
    m.etiquetaDispositivo.position.set(0, 4.0, 1);
    g.add(m.etiquetaDispositivo);

    return m;
  },

  animar(t: number, ctx: ContextoEscena3D, m: ManijasEscena3D): void {
    // Marea: el mar oscila; el embalse va con retraso → salto h visible.
    const omegaT = 0.42;
    const rango = Math.max(0.8, ctx.rangoMarea);
    const amp = rango * 0.4;

    const yMar0 =
      ((m.nivelMar?.userData as Record<string, unknown> | undefined)?.y0 as number) ?? -0.05;
    const yEmb0 =
      ((m.nivelEmbalse?.userData as Record<string, unknown> | undefined)?.y0 as number) ?? 0.2;

    const zMar = yMar0 + Math.sin(t * omegaT) * amp;
    const zEmb = yEmb0 + Math.sin(t * omegaT - 1.0) * amp * 0.8;

    /** Oleaje Gerstner-lite: dos ondas de viaje + una estacionaria suave. */
    const ondular = (
      malla: THREE.Mesh,
      base: Float32Array | undefined,
      tt: number,
      ampY: number,
      ampZ: number
    ) => {
      if (!base) return;
      const pos = malla.geometry.attributes.position as THREE.BufferAttribute;
      const arr = pos.array as Float32Array;
      for (let i = 0; i < pos.count; i++) {
        const bx = base[i * 3];
        const bz = base[i * 3 + 2];
        const h =
          Math.sin(bx * 0.42 + tt * 1.6) * ampY +
          Math.sin(bz * 0.31 + tt * 1.15 + bx * 0.12) * (ampY * 0.55) +
          Math.sin(bx * 0.18 - bz * 0.22 + tt * 0.7) * (ampY * 0.35);
        arr[i * 3 + 1] = base[i * 3 + 1] + h;
        // Desplazamiento horizontal leve (estilo Gerstner) en Z local.
        arr[i * 3 + 2] = base[i * 3 + 2] + Math.sin(bx * 0.42 + tt * 1.6) * ampZ;
      }
      pos.needsUpdate = true;
      malla.geometry.computeVertexNormals();
    };

    if (m.nivelMar) {
      m.nivelMar.position.y = zMar;
      const ud = m.nivelMar.userData as Record<string, unknown>;
      ondular(m.nivelMar, ud.base as Float32Array | undefined, t, 0.05, 0.02);
      const espuma = ud.espuma as THREE.Mesh | undefined;
      if (espuma) {
        espuma.position.y = zMar + Math.sin(t * 1.6) * 0.02;
        espuma.scale.z = 1 + Math.sin(t * 1.3) * 0.05;
      }
    }

    if (m.nivelEmbalse) {
      m.nivelEmbalse.position.y = zEmb;
      const ud = m.nivelEmbalse.userData as Record<string, unknown>;
      ondular(m.nivelEmbalse, ud.base as Float32Array | undefined, t * 0.7, 0.03, 0.015);
      const espuma = ud.espuma as THREE.Mesh | undefined;
      if (espuma) {
        espuma.position.y = zEmb + Math.sin(t * 1.2 + 1) * 0.015;
        espuma.scale.z = 1 + Math.sin(t * 0.9 + 0.5) * 0.04;
      }
    }

    const saltoM = Math.abs(zMar - zEmb);
    for (const r of m.rotores) r.rotation.x += 0.04 + saltoM * 0.08;
    const haciaEmbalse = zMar > zEmb;
    if (m.flechaLlenado) m.flechaLlenado.visible = haciaEmbalse;
    if (m.flechaVaciado) m.flechaVaciado.visible = !haciaEmbalse;

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
