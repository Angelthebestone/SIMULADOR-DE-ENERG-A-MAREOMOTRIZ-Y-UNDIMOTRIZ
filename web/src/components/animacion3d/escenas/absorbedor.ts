// Escena 3D del absorbedor puntual undimotriz tipo PowerBuoy.
//
// Lo que enseña: el flotador anular sube y baja con la ola a lo largo del
// spar, que la placa de arfada mantiene casi quieto; ese movimiento relativo
// es el que acciona el convertidor (PTO). Las partículas en suspensión
// describen las órbitas de la ola, que se apagan con la profundidad.

// @ts-ignore — three se empaqueta por Vite sin @types
import * as THREE from "three";
import type {
  ContextoEscena3D,
  Encuadre3D,
  Escena3D,
  Grupo3D,
  ManijasEscena3D,
} from "../tipos";
import { manijasVacias } from "../tipos";
import { crearParticulas, crearSuperficieMar, fijarEstelas } from "../agua";
import {
  crearCableConPulso,
  crearEtiqueta,
  crearLechoArena,
  crearMatPintado,
  crearRocasLecho,
} from "../utilidades";

const COL = {
  amarillo: 0xf2b705,
  amarilloOscuro: 0xc28f00,
  spar: 0x46525c,
  torre: 0xe6e9ea,
  rojo: 0xc8261c,
  placa: 0x3d4850,
  goma: 0x15181a,
  pod: 0x7d8890,
  boyarin: 0xe8641c,
  balizaOn: 0xff3b30,
  balizaOff: 0x6a1410,
};

const NIVEL = 0;
const Y_LECHO = -6.2;
const Y_PLACA = -4.85;
/** 30 m de calado ocupan |Y_LECHO| unidades. */
const M_POR_UNIDAD_V = 30 / -Y_LECHO;
const NIEBLA = { color: 0xa8c8da, near: 40, far: 140 };

/** Catenaria entre dos puntos con una flecha dada (curva suave, no parábola exacta). */
function catenaria(a: THREE.Vector3, b: THREE.Vector3, flecha: number): THREE.CatmullRomCurve3 {
  const pts: THREE.Vector3[] = [];
  for (let i = 0; i <= 8; i++) {
    const u = i / 8;
    const p = a.clone().lerp(b, u);
    p.y -= Math.sin(u * Math.PI) * flecha * (1 - u * 0.5);
    pts.push(p);
  }
  return new THREE.CatmullRomCurve3(pts);
}

export const escenaAbsorbedor: Escena3D = {
  encuadre(): Encuadre3D {
    return {
      posicion: { x: 7.0, y: 4.4, z: 16.2 },
      lookAt: { x: 0.9, y: -1.8, z: 0 },
      fondo: NIEBLA.color,
      niebla: { near: NIEBLA.near, far: NIEBLA.far },
      radio: 6.9,
      margen: 1.02,
      // Sol alto, por detrás y a la izquierda: modela el volumen de la boya y
      // deja el camino de destellos sobre el mar.
      sol: { x: -0.62, y: 0.6, z: -0.38 },
    };
  },

  construir(g: Grupo3D, ctx: ContextoEscena3D): ManijasEscena3D {
    const m = manijasVacias();
    const B = ctx.calidadBaja;
    const seg = B ? 20 : 48;
    const pint = crearMatPintado;

    // ---- Lecho y mar ----
    const lecho = crearLechoArena(220, 180, Y_LECHO, B, { amplitud: 0.5 });
    lecho.position.z = -30;
    g.add(lecho);
    g.add(crearRocasLecho(B ? 8 : 16, 120, 90, Y_LECHO, 23));

    const marInfo = crearSuperficieMar(240, 220, NIVEL, B, { niebla: NIEBLA, focoZ: 40 });
    marInfo.malla.position.z = -40;
    g.add(marInfo.malla);
    m.mar = marInfo.malla;

    // =====================================================================
    // SPAR + PLACA DE ARFADA + TORRE (casi quietos)
    // =====================================================================
    const spar = new THREE.Group();
    g.add(spar);
    m.estado.spar = spar;

    const matSpar = pint(COL.spar, { roughness: 0.5, metalness: 0.35 });
    const fuste = new THREE.Mesh(
      new THREE.CylinderGeometry(0.34, 0.34, 7.3, B ? 14 : 28),
      matSpar
    );
    fuste.position.y = Y_PLACA + 3.65;
    fuste.castShadow = true;
    fuste.receiveShadow = true;
    spar.add(fuste);

    // Guías verticales por las que desliza el flotador.
    for (let i = 0; i < 4; i++) {
      const ang = (i * Math.PI) / 2 + Math.PI / 4;
      const guia = new THREE.Mesh(new THREE.BoxGeometry(0.07, 4.6, 0.1), matSpar);
      guia.position.set(Math.cos(ang) * 0.36, 0.1, Math.sin(ang) * 0.36);
      guia.rotation.y = -ang;
      spar.add(guia);
    }
    for (const y of [2.4, -2.2, -3.6]) {
      const brida = new THREE.Mesh(
        new THREE.CylinderGeometry(0.42, 0.42, 0.12, B ? 14 : 28),
        matSpar
      );
      brida.position.y = y;
      spar.add(brida);
    }

    // Torre de señalización: tramo blanco con banda roja, plataforma y mástil.
    const matTorre = pint(COL.torre, { roughness: 0.45, metalness: 0.15 });
    const torre = new THREE.Mesh(
      new THREE.CylinderGeometry(0.26, 0.32, 1.5, B ? 14 : 28),
      matTorre
    );
    torre.position.y = 2.9;
    torre.castShadow = true;
    spar.add(torre);
    const banda = new THREE.Mesh(
      new THREE.CylinderGeometry(0.3, 0.31, 0.32, B ? 14 : 28),
      pint(COL.rojo, { roughness: 0.5, metalness: 0.1 })
    );
    banda.position.y = 2.75;
    spar.add(banda);
    const plataforma = new THREE.Mesh(
      new THREE.CylinderGeometry(0.62, 0.62, 0.06, B ? 14 : 28),
      matSpar
    );
    plataforma.position.y = 3.66;
    plataforma.castShadow = true;
    spar.add(plataforma);
    const baranda = new THREE.Mesh(
      new THREE.TorusGeometry(0.6, 0.02, 6, B ? 14 : 28),
      matTorre
    );
    baranda.rotation.x = Math.PI / 2;
    baranda.position.y = 4.02;
    spar.add(baranda);
    for (let i = 0; i < 6; i++) {
      const ang = (i * Math.PI) / 3;
      const poste = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.36, 5), matTorre);
      poste.position.set(Math.cos(ang) * 0.6, 3.84, Math.sin(ang) * 0.6);
      spar.add(poste);
    }
    const mastil = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.05, 0.8, 8), matTorre);
    mastil.position.y = 4.08;
    spar.add(mastil);
    // Paneles solares de la electrónica de a bordo.
    for (const s of [-1, 1]) {
      const panel = new THREE.Mesh(
        new THREE.BoxGeometry(0.5, 0.03, 0.36),
        ctx.mat(0x14233a, { roughness: 0.18, metalness: 0.6, envMapIntensity: 1.4 })
      );
      panel.position.set(s * 0.33, 4.12, 0);
      panel.rotation.z = -s * 0.6;
      panel.castShadow = true;
      spar.add(panel);
    }
    const antena = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.012, 0.6, 5), matSpar);
    antena.position.set(0.1, 4.75, 0);
    spar.add(antena);
    const luzBaliza = new THREE.Mesh(
      new THREE.SphereGeometry(0.1, 12, 10),
      new THREE.MeshBasicMaterial({ color: COL.balizaOff })
    );
    luzBaliza.position.y = 4.56;
    spar.add(luzBaliza);
    m.estado.luzBaliza = luzBaliza;

    // Placa de arfada: disco ancho que "se agarra" al agua quieta del fondo.
    const rPlaca = 2.55;
    const matPlaca = pint(COL.placa, { roughness: 0.6, metalness: 0.3 });
    const placa = new THREE.Mesh(
      new THREE.CylinderGeometry(rPlaca, rPlaca, 0.16, seg),
      matPlaca
    );
    placa.position.y = Y_PLACA;
    placa.castShadow = true;
    placa.receiveShadow = true;
    spar.add(placa);
    const canto = new THREE.Mesh(
      new THREE.TorusGeometry(rPlaca, 0.11, 8, seg),
      matPlaca
    );
    canto.rotation.x = Math.PI / 2;
    canto.position.y = Y_PLACA;
    spar.add(canto);
    const nNerv = B ? 6 : 12;
    for (let i = 0; i < nNerv; i++) {
      const ang = (i * Math.PI * 2) / nNerv;
      const nerv = new THREE.Mesh(new THREE.BoxGeometry(rPlaca - 0.4, 0.2, 0.05), matPlaca);
      nerv.position.set(
        Math.cos(ang) * (rPlaca + 0.4) * 0.5,
        Y_PLACA + 0.18,
        Math.sin(ang) * (rPlaca + 0.4) * 0.5
      );
      nerv.rotation.y = -ang;
      spar.add(nerv);
      if (i % 3 === 0) {
        // Tornapuntas del spar al borde de la placa.
        const largo = Math.hypot(rPlaca - 0.7, 1.7);
        const punta = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, largo, 6), matSpar);
        punta.position.set(
          Math.cos(ang) * (rPlaca * 0.5 + 0.02),
          Y_PLACA + 0.95,
          Math.sin(ang) * (rPlaca * 0.5 + 0.02)
        );
        punta.rotation.y = -ang;
        punta.rotation.z = Math.atan2(rPlaca - 0.7, 1.7);
        spar.add(punta);
      }
    }

    // =====================================================================
    // FLOTADOR anular (se mueve con la serie del motor)
    // =====================================================================
    const amarillo = pint(COL.amarillo, { roughness: 0.42, metalness: 0.12, envMapIntensity: 0.9 });
    const amarilloOsc = pint(COL.amarilloOscuro, { roughness: 0.5, metalness: 0.12 });
    const perfil = [
      [0.46, -0.52],
      [1.3, -0.56],
      [1.56, -0.44],
      [1.66, -0.2],
      [1.66, 0.16],
      [1.58, 0.36],
      [1.3, 0.47],
      [0.46, 0.52],
      [0.46, -0.52],
    ].map(([r, y]) => new THREE.Vector2(r, y));
    const flotador = new THREE.Mesh(new THREE.LatheGeometry(perfil, seg), amarillo);
    flotador.castShadow = true;
    flotador.receiveShadow = true;
    g.add(flotador);
    m.flotador = flotador;

    const defensa = new THREE.Mesh(
      new THREE.TorusGeometry(1.66, 0.085, 8, seg),
      ctx.mat(COL.goma, { roughness: 0.9, metalness: 0 })
    );
    defensa.rotation.x = Math.PI / 2;
    defensa.position.y = -0.02;
    flotador.add(defensa);
    // Casquillo guía alrededor del spar.
    const casquillo = new THREE.Mesh(
      new THREE.CylinderGeometry(0.5, 0.5, 1.3, B ? 14 : 28, 1, true),
      amarilloOsc
    );
    casquillo.position.y = 0.05;
    flotador.add(casquillo);
    // Barandilla y escotillas de cubierta.
    const rail = new THREE.Mesh(new THREE.TorusGeometry(1.42, 0.022, 6, seg), amarilloOsc);
    rail.rotation.x = Math.PI / 2;
    rail.position.y = 0.92;
    flotador.add(rail);
    const nPostes = B ? 6 : 12;
    for (let i = 0; i < nPostes; i++) {
      const ang = (i * Math.PI * 2) / nPostes;
      const poste = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.48, 5), amarilloOsc);
      poste.position.set(Math.cos(ang) * 1.42, 0.69, Math.sin(ang) * 1.42);
      flotador.add(poste);
    }
    for (let i = 0; i < 3; i++) {
      const ang = (i * Math.PI * 2) / 3 + 0.5;
      const escotilla = new THREE.Mesh(
        new THREE.CylinderGeometry(0.2, 0.2, 0.06, 14),
        amarilloOsc
      );
      escotilla.position.set(Math.cos(ang) * 0.98, 0.5, Math.sin(ang) * 0.98);
      flotador.add(escotilla);
    }

    // =====================================================================
    // FONDEO: tres líneas con boyarín intermedio
    // =====================================================================
    const matLinea = ctx.mat(0x23292d, { roughness: 0.8, metalness: 0.2 });
    for (let i = 0; i < 3; i++) {
      const ang = (i * Math.PI * 2) / 3 - Math.PI / 2;
      const origen = new THREE.Vector3(Math.cos(ang) * 0.4, -2.2, Math.sin(ang) * 0.4);
      const medio = new THREE.Vector3(Math.cos(ang) * 5.2, -2.9, Math.sin(ang) * 5.2);
      const ancla = new THREE.Vector3(Math.cos(ang) * 12.5, Y_LECHO + 0.1, Math.sin(ang) * 12.5);
      for (const c of [catenaria(origen, medio, 0.9), catenaria(medio, ancla, 1.2)]) {
        const linea = new THREE.Mesh(new THREE.TubeGeometry(c, B ? 12 : 24, 0.03, 5, false), matLinea);
        g.add(linea);
      }
      const boyarin = new THREE.Mesh(
        new THREE.SphereGeometry(0.3, B ? 10 : 18, B ? 8 : 12),
        pint(COL.boyarin, { roughness: 0.5, metalness: 0.05 })
      );
      boyarin.position.copy(medio).y += 0.24;
      boyarin.castShadow = true;
      g.add(boyarin);
    }

    // =====================================================================
    // SUBESTACIÓN SUBMARINA + CABLE
    // =====================================================================
    const xPod = 5.4;
    const zPod = -0.8;
    const yPod = Y_LECHO + 0.3;
    const matPod = pint(COL.pod, { roughness: 0.5, metalness: 0.35 });
    const losa = new THREE.Mesh(
      new THREE.BoxGeometry(2.6, 0.2, 1.9),
      ctx.mat(0x8b8d86, { roughness: 0.95, metalness: 0 })
    );
    losa.position.set(xPod, yPod, zPod);
    losa.castShadow = true;
    losa.receiveShadow = true;
    g.add(losa);
    const podCuerpo = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.75, 1.15), matPod);
    podCuerpo.position.set(xPod, yPod + 0.48, zPod);
    podCuerpo.castShadow = true;
    g.add(podCuerpo);
    for (const s of [-1, 1]) {
      const tanque = new THREE.Mesh(new THREE.CapsuleGeometry(0.19, 0.8, 4, B ? 8 : 14), matPod);
      tanque.rotation.z = Math.PI / 2;
      tanque.position.set(xPod, yPod + 1.06, zPod + s * 0.3);
      tanque.castShadow = true;
      g.add(tanque);
    }
    // Bastidor de protección contra artes de pesca.
    const matBastidor = pint(COL.amarillo, { roughness: 0.55, metalness: 0.1 });
    for (const [dx, dz] of [
      [-1.15, -0.8],
      [1.15, -0.8],
      [-1.15, 0.8],
      [1.15, 0.8],
    ] as const) {
      const poste = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 1.4, 6), matBastidor);
      poste.position.set(xPod + dx, yPod + 0.75, zPod + dz);
      g.add(poste);
    }
    for (const dz of [-0.8, 0.8]) {
      const larguero = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 2.3, 6), matBastidor);
      larguero.rotation.z = Math.PI / 2;
      larguero.position.set(xPod, yPod + 1.45, zPod + dz);
      g.add(larguero);
    }
    for (const dx of [-1.15, 1.15]) {
      const travesano = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 1.6, 6), matBastidor);
      travesano.rotation.x = Math.PI / 2;
      travesano.position.set(xPod + dx, yPod + 1.45, zPod);
      g.add(travesano);
    }

    // Umbilical en "lazy wave" del spar al lecho, y cable de evacuación.
    const { cable, curva, pulso } = crearCableConPulso(
      [
        new THREE.Vector3(0, Y_PLACA - 0.1, 0),
        new THREE.Vector3(0.9, Y_PLACA - 0.75, 0.25),
        new THREE.Vector3(2.4, Y_LECHO + 0.5, 0.2),
        new THREE.Vector3(xPod - 1.25, yPod + 0.25, zPod),
        new THREE.Vector3(xPod + 1.4, yPod + 0.12, zPod),
        new THREE.Vector3(9, Y_LECHO + 0.1, -1.6),
        new THREE.Vector3(16, Y_LECHO + 0.08, -3),
      ],
      0.07
    );
    g.add(cable);
    m.pulsoCurva = curva;
    m.pulso = pulso;
    g.add(pulso);

    // ---- Partículas: órbitas de la ola, cada vez menores hacia el fondo ----
    const particulas = crearParticulas({
      cantidad: B ? 140 : 420,
      min: { x: -10, y: Y_LECHO + 0.5, z: -6 },
      max: { x: 10, y: -0.5, z: 5 },
      orbital: true,
      tam: 0.085,
      opacidad: 0.6,
    });
    g.add(particulas);
    m.estado.particulas = particulas;

    // ---- Rótulos ----
    m.etiquetaDispositivo = crearEtiqueta("Absorbedor puntual");
    m.etiquetaDispositivo.position.set(0, 5.4, 0);
    m.etiquetaDispositivo.userData.prioridad = 2;
    g.add(m.etiquetaDispositivo);
    const rotFlot = crearEtiqueta("Flotador: sube y baja con la ola");
    rotFlot.position.set(-3.6, 1.3, 0);
    rotFlot.userData.prioridad = 1;
    g.add(rotFlot);
    m.estado.rotFlot = rotFlot;
    const rotPlaca = crearEtiqueta("Placa de arfada: casi quieta");
    rotPlaca.position.set(-3.4, Y_PLACA + 0.9, 0);
    rotPlaca.userData.prioridad = 3;
    g.add(rotPlaca);

    return m;
  },

  animar(t: number, ctx: ContextoEscena3D, m: ManijasEscena3D): void {
    const omega = (2 * Math.PI) / (ctx.Te > 0 ? ctx.Te : 7);
    const k = ctx.k > 0 ? ctx.k : 0.08;
    // Misma escala vertical que la ola: el flotador sube lo que diga la serie
    // del motor (ya incluye Hm0, Te y el amortiguamiento del PTO).
    const zSerie = ctx.muestrearSerie(t);
    const eta0 = ctx.eta(0, t, omega, k);
    const z = zSerie !== null ? zSerie : eta0 * 0.6;

    if (m.flotador) {
      m.flotador.position.y = NIVEL + z;
      // Cabeceo leve: el flotador se acomoda a la pendiente de la ola.
      const pendiente = (ctx.Hm0 / 2) * 0.22 * Math.sin(omega * t);
      m.flotador.rotation.z = Math.atan(pendiente) * 0.3;
    }
    const spar = m.estado.spar as THREE.Group | undefined;
    // La placa de arfada deja al spar un resto pequeño del movimiento.
    if (spar) spar.position.y = eta0 * 0.05;

    const luz = m.estado.luzBaliza as THREE.Mesh | undefined;
    if (luz) {
      const on = Math.sin(t * 2.4) > 0.35;
      (luz.material as THREE.MeshBasicMaterial).color.setHex(
        on ? COL.balizaOn : COL.balizaOff
      );
      luz.scale.setScalar(on ? 1.5 : 1.0);
    }

    const part = m.estado.particulas as THREE.Points | undefined;
    if (part) {
      (part.material as THREE.ShaderMaterial).uniforms.uDecae.value = k * M_POR_UNIDAD_V;
    }

    // Espuma en la flotación: más viva cuanto más se mueve el flotador
    // respecto al agua que lo rodea.
    if (m.mar) {
      const relativo = Math.min(1, Math.abs(z - eta0) / 0.8);
      fijarEstelas(m.mar, [
        { x: 0, z: 0, radio: 1.66, fuerza: 0.3 + 0.6 * relativo },
      ]);
    }
    const anclaFlot = (m.estado.rotFlot as THREE.Sprite | undefined)?.userData
      .ancla as THREE.Vector3 | undefined;
    anclaFlot?.set(-3.6, 1.3 + z, 0);
  },
};
