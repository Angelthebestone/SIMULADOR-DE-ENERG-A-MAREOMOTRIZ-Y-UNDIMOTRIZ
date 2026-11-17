// Texturas de material generadas en memoria (lienzo 2D): hormigón encofrado,
// pintura naval gastada y arena con rizaduras. Se crean una vez y se
// comparten; no hay imágenes que descargar.

// @ts-ignore — three se empaqueta por Vite sin @types (build verificado)
import * as THREE from "three";
import { ruidoPeriodico } from "./ambiente";

const cache = new Map<string, THREE.CanvasTexture>();

function lienzo(tam: number, pintar: (ctx: CanvasRenderingContext2D, azar: () => number) => void, semilla: number) {
  const c = document.createElement("canvas");
  c.width = tam;
  c.height = tam;
  const ctx = c.getContext("2d");
  let s = semilla >>> 0 || 1;
  const azar = () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
  if (ctx) pintar(ctx, azar);
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

/** Fondo gris con grano: `base` y `rango` en 0..255. */
function grano(ctx: CanvasRenderingContext2D, tam: number, base: number, rango: number, semilla: number, periodo = 8) {
  const campo = ruidoPeriodico(tam, periodo, 5, semilla);
  const img = ctx.createImageData(tam, tam);
  for (let i = 0; i < campo.length; i++) {
    const v = Math.max(0, Math.min(255, base + (campo[i] - 0.5) * 2 * rango));
    img.data[i * 4] = v;
    img.data[i * 4 + 1] = v;
    img.data[i * 4 + 2] = v;
    img.data[i * 4 + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
}

/** Hormigón: paños de encofrado, agujeros de latiguillo y chorretones. */
export function texturaHormigon(): THREE.CanvasTexture {
  const k = "hormigon";
  const ya = cache.get(k);
  if (ya) return ya;
  const tam = 512;
  const tex = lienzo(
    tam,
    (ctx, azar) => {
      grano(ctx, tam, 214, 30, 771);
      // Manchas grandes de humedad y lechada.
      for (let i = 0; i < 26; i++) {
        const x = azar() * tam;
        const y = azar() * tam;
        const r = 30 + azar() * 90;
        const g = ctx.createRadialGradient(x, y, 0, x, y, r);
        const oscuro = azar() > 0.45;
        g.addColorStop(0, oscuro ? "rgba(70, 72, 68, 0.16)" : "rgba(255, 252, 244, 0.14)");
        g.addColorStop(1, "rgba(128, 128, 128, 0)");
        ctx.fillStyle = g;
        ctx.fillRect(x - r, y - r, r * 2, r * 2);
      }
      // Chorretones: el agua arrastra suciedad hacia abajo.
      for (let i = 0; i < 46; i++) {
        const x = azar() * tam;
        const y = azar() * tam * 0.7;
        const largo = 40 + azar() * 170;
        const g = ctx.createLinearGradient(0, y, 0, y + largo);
        g.addColorStop(0, "rgba(58, 62, 56, 0.2)");
        g.addColorStop(1, "rgba(58, 62, 56, 0)");
        ctx.fillStyle = g;
        ctx.fillRect(x, y, 1.5 + azar() * 4, largo);
      }
      // Juntas de encofrado y agujeros de latiguillo.
      ctx.strokeStyle = "rgba(60, 60, 56, 0.4)";
      ctx.lineWidth = 1.4;
      for (let i = 0; i <= 4; i++) {
        const y = (i * tam) / 4 + 0.5;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(tam, y);
        ctx.stroke();
      }
      for (let i = 0; i <= 2; i++) {
        const x = (i * tam) / 2 + 0.5;
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, tam);
        ctx.stroke();
      }
      ctx.fillStyle = "rgba(48, 48, 46, 0.5)";
      for (let j = 0; j < 4; j++) {
        for (let i = 0; i < 4; i++) {
          ctx.beginPath();
          ctx.arc(32 + i * 64 * 2 + (j % 2) * 0, 64 + j * 128, 2.6, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    },
    5
  );
  cache.set(k, tex);
  return tex;
}

/** Pintura naval gastada: grano fino, roces y regueros de óxido tenues. */
export function texturaDesgaste(): THREE.CanvasTexture {
  const k = "desgaste";
  const ya = cache.get(k);
  if (ya) return ya;
  const tam = 256;
  const tex = lienzo(
    tam,
    (ctx, azar) => {
      grano(ctx, tam, 232, 18, 313, 16);
      for (let i = 0; i < 34; i++) {
        const x = azar() * tam;
        const y = azar() * tam;
        const largo = 20 + azar() * 90;
        const g = ctx.createLinearGradient(0, y, 0, y + largo);
        const oxido = azar() > 0.6;
        g.addColorStop(0, oxido ? "rgba(150, 96, 60, 0.2)" : "rgba(40, 44, 48, 0.16)");
        g.addColorStop(1, "rgba(120, 100, 90, 0)");
        ctx.fillStyle = g;
        ctx.fillRect(x, y, 1 + azar() * 3, largo);
      }
      ctx.strokeStyle = "rgba(255, 255, 255, 0.12)";
      ctx.lineWidth = 0.7;
      for (let i = 0; i < 40; i++) {
        const x = azar() * tam;
        const y = azar() * tam;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + (azar() - 0.5) * 34, y + (azar() - 0.5) * 12);
        ctx.stroke();
      }
    },
    17
  );
  cache.set(k, tex);
  return tex;
}

/** Corte del terreno bajo el lecho: arena, arcilla y roca madre en estratos. */
export function texturaEstratos(): THREE.CanvasTexture {
  const k = "estratos";
  const ya = cache.get(k);
  if (ya) return ya;
  const tam = 512;
  const tex = lienzo(
    tam,
    (ctx, azar) => {
      const onda = ruidoPeriodico(tam, 4, 4, 555);
      const fino = ruidoPeriodico(tam, 32, 3, 808);
      // Capas de arriba abajo: [cota relativa, r, g, b].
      const capas = [
        [0.0, 196, 172, 128],
        [0.07, 168, 146, 110],
        [0.2, 128, 112, 92],
        [0.42, 98, 96, 90],
        [1.01, 62, 64, 64],
      ];
      const img = ctx.createImageData(tam, tam);
      for (let y = 0; y < tam; y++) {
        for (let x = 0; x < tam; x++) {
          const i = y * tam + x;
          // Los contactos entre capas ondulan: no son reglas horizontales.
          const v = y / tam + (onda[i] - 0.5) * 0.09;
          let c = capas[capas.length - 1];
          for (let n = 0; n < capas.length - 1; n++) {
            if (v < capas[n + 1][0]) {
              c = capas[n];
              break;
            }
          }
          const g = 0.86 + fino[i] * 0.28;
          img.data[i * 4] = c[1] * g;
          img.data[i * 4 + 1] = c[2] * g;
          img.data[i * 4 + 2] = c[3] * g;
          img.data[i * 4 + 3] = 255;
        }
      }
      ctx.putImageData(img, 0, 0);
      // Cantos y bolos sueltos en las capas altas.
      for (let n = 0; n < 150; n++) {
        const y = tam * (0.08 + azar() * 0.4);
        ctx.fillStyle = `rgba(70, 66, 58, ${0.25 + azar() * 0.3})`;
        ctx.beginPath();
        ctx.ellipse(azar() * tam, y, 2 + azar() * 6, 1.5 + azar() * 3, azar(), 0, Math.PI * 2);
        ctx.fill();
      }
    },
    29
  );
  cache.set(k, tex);
  return tex;
}

/** Arena: rizaduras de corriente (ripples) sobre grano. */
export function texturaArena(): THREE.CanvasTexture {
  const k = "arena";
  const ya = cache.get(k);
  if (ya) return ya;
  const tam = 256;
  const tex = lienzo(
    tam,
    (ctx) => {
      const fino = ruidoPeriodico(tam, 32, 3, 99);
      const onda = ruidoPeriodico(tam, 4, 3, 1234);
      const img = ctx.createImageData(tam, tam);
      for (let y = 0; y < tam; y++) {
        for (let x = 0; x < tam; x++) {
          const i = y * tam + x;
          // Crestas paralelas, deformadas para que no parezcan una rejilla.
          const fase = (x / tam) * Math.PI * 2 * 9 + onda[i] * 7;
          const v = 196 + Math.sin(fase) * 26 + (fino[i] - 0.5) * 44;
          img.data[i * 4] = v;
          img.data[i * 4 + 1] = v;
          img.data[i * 4 + 2] = v;
          img.data[i * 4 + 3] = 255;
        }
      }
      ctx.putImageData(img, 0, 0);
    },
    3
  );
  cache.set(k, tex);
  return tex;
}
