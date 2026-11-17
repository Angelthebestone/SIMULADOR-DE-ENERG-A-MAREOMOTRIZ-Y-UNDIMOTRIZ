// Estado global del flujo guiado (pasos 3.1 + 3.2).
// Vive aquí para que la carcasa y las etapas lean la misma ruta visible.
// Reutiliza el tipo Params del transporte único (api.ts): el flujo ordena la
// pantalla, nunca el cálculo.

import type { Params } from '../api'

export type Paso = 1 | 2 | 3 | 4
export type Familia = 'mareomotriz' | 'undimotriz'
export type Origen = 'lugar' | 'personalizado'

export interface EstadoFlujo {
  paso: Paso
  familia: Familia
  origen: Origen
}

export const PASOS: Array<{ id: Paso; nombre: string }> = [
  { id: 1, nombre: 'Inicio' },
  { id: 2, nombre: 'Tecnología' },
  { id: 3, nombre: 'Origen de datos' },
  { id: 4, nombre: 'Simulación' },
]

export const TECNOLOGIAS_POR_FAMILIA: Record<
  Familia,
  Array<{ id: string; nombre: string; descripcion: string }>
> = {
  mareomotriz: [
    {
      id: 'embalse',
      nombre: 'Dique de marea',
      descripcion: 'Embalse que se llena con la pleamar y se vacía con la bajamar',
    },
    {
      id: 'turbina_corriente',
      nombre: 'Turbina de corriente',
      descripcion: 'Rotor sumergido que gira con la corriente de marea',
    },
  ],
  undimotriz: [
    {
      id: 'absorbedor_puntual',
      nombre: 'Absorbedor puntual',
      descripcion: 'Boya que sube y baja con la ola',
    },
  ],
}

export const PARAMS_INICIALES: Params = {
  hm0_m: 2.3,
  te_s: 8.8,
  b_pto_ns_m: 80_000,
  profundidad_m: 30,
  sitio_id: 'peniche',
  rango_m: 2.8,
  velocidad_ms: 0.5,
  dispositivo: 'absorbedor_puntual',
  eta_pto: 0.65,
  eta_gen: 0.9,
  crf: 0.08,
  rho: 1025,
}

/** Punto con el que arranca cada dispositivo: un sitio de pruebas real de esa
 *  tecnología, para que la comparación con plantas reales tenga sentido desde
 *  el primer cálculo. Valores de la carta mundial (MapaView). */
export const SITIO_INICIAL: Record<string, { nombre: string; fuente: string; params: Partial<Params> }> = {
  absorbedor_puntual: {
    nombre: 'Peniche, Portugal',
    fuente: 'Wavec Portugal',
    params: { sitio_id: 'peniche', hm0_m: 2.3, te_s: 8.8, profundidad_m: 30, rango_m: 2.8, velocidad_ms: 0.5 },
  },
  turbina_corriente: {
    nombre: 'Pentland Firth, Escocia',
    fuente: 'EMEC / MeyGen',
    params: { sitio_id: 'pentland_firth', hm0_m: 2.8, te_s: 8.2, profundidad_m: 35, rango_m: 4.5, velocidad_ms: 5.0 },
  },
  embalse: {
    nombre: 'Estuario de La Rance, Francia',
    fuente: 'EDF France (240 MW)',
    params: { sitio_id: 'la_rance', hm0_m: 0.7, te_s: 4.5, profundidad_m: 18, rango_m: 13.5, velocidad_ms: 3.8 },
  },
}

export function familiaDeDispositivo(dispositivo: string): Familia {
  if (dispositivo === 'turbina_corriente' || dispositivo === 'embalse') return 'mareomotriz'
  return 'undimotriz'
}

export function dispositivoPorDefecto(familia: Familia): string {
  if (familia === 'mareomotriz') return 'turbina_corriente'
  return 'absorbedor_puntual'
}

export function esPaso(v: number): v is Paso {
  return v === 1 || v === 2 || v === 3 || v === 4
}
