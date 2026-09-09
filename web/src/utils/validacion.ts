// Validez del modelo lineal de oleaje (Airy) frente a los controles.
//
// La presentación no calcula física: estas funciones solo deciden si la
// combinación de altura, periodo y fondo cae dentro del rango donde el
// modelo lineal responde bien. El cálculo pesado sigue en el servicio;
// aquí hay como mucho unas decenas de operaciones, lejos del camino
// control → pintado que protege el debounce de la carcasa.
//
// Criterios en palabras: una ola demasiado empinada (altura frente a
// longitud) rompería y el modelo lineal ya no la describe; en fondo muy
// bajo para la ola, la ola se deforma (número de Ursell alto) y el modelo
// lineal tampoco vale. En ambos casos se avisa en vez de mostrar la cifra
// como si fuera exacta.

import { formatearNumero } from './formato'

/** Peralte a partir del cual la ola rompe (criterio de Miche-Stokes). */
export const PERALTE_ROTURA = 1 / 7

/** Peralte desde el que la cifra ya solo orienta. */
export const PERALTE_LIMITE = 0.08

/** Ursell desde el que el fondo bajo deforma la ola de forma notable. */
export const URSELL_LIMITE = 30

/** Ursell desde el que el modelo lineal deja de valer en somero. */
export const URSELL_FUERA = 100

const GRAVEDAD = 9.81

/** Longitud de onda (m) por la relación de dispersión, Newton-Raphson. */
export function longitudOnda(te_s: number, profundidad_m: number): number {
  if (!Number.isFinite(te_s) || te_s <= 0) return NaN
  const h = Math.max(profundidad_m, 0.5)
  const omega = (2 * Math.PI) / te_s
  let k = (omega * omega) / GRAVEDAD
  for (let i = 0; i < 30; i++) {
    const kh = k * h
    const th = Math.tanh(kh)
    const f = GRAVEDAD * k * th - omega * omega
    const ch = Math.cosh(kh)
    const sech2 = 1 / (ch * ch)
    const df = GRAVEDAD * th + GRAVEDAD * k * h * sech2
    if (!Number.isFinite(df) || df === 0) break
    k -= f / df
    if (Math.abs(f) < 1e-10) break
  }
  if (!Number.isFinite(k) || k <= 0) return NaN
  return (2 * Math.PI) / k
}

/** Peralte: altura de ola frente a longitud de onda (sin unidad). */
export function peralte(hm0_m: number, longitud_m: number): number {
  if (!Number.isFinite(hm0_m) || !Number.isFinite(longitud_m) || longitud_m <= 0) return NaN
  return hm0_m / longitud_m
}

/** Número de Ursell: pesa la altura y la longitud frente al fondo (sin unidad). */
export function numeroUrsell(hm0_m: number, longitud_m: number, profundidad_m: number): number {
  const h = Math.max(profundidad_m, 0.5)
  if (!Number.isFinite(hm0_m) || !Number.isFinite(longitud_m) || longitud_m <= 0) return NaN
  return (hm0_m * longitud_m * longitud_m) / (h * h * h)
}

export type EstadoValidez = 'valido' | 'limite' | 'fuera'

export type ValidezOleaje = {
  longitud_m: number
  peralte: number
  ursell: number
  estado: EstadoValidez
  /** Aviso en palabras llanas, con cifras en formato español. Vacío si válido. */
  mensaje: string
}

/** ¿Sigue valiendo el modelo lineal con esta altura, periodo y fondo? */
export function airyValido(hm0_m: number, te_s: number, profundidad_m: number): boolean {
  return evaluarValidezOleaje({ hm0: hm0_m, te: te_s, profundidad: profundidad_m }).estado === 'valido'
}

export function evaluarValidezOleaje(o: { hm0: number; te: number; profundidad: number }): ValidezOleaje {
  const lambda = longitudOnda(o.te, o.profundidad)
  const p = peralte(o.hm0, lambda)
  const u = numeroUrsell(o.hm0, lambda, o.profundidad)
  const base: ValidezOleaje = { longitud_m: lambda, peralte: p, ursell: u, estado: 'valido', mensaje: '' }
  if (!Number.isFinite(p) || !Number.isFinite(u) || !Number.isFinite(lambda)) {
    return { ...base, estado: 'limite', mensaje: 'Sin longitud de onda para este periodo: la cifra solo orienta.' }
  }
  if (p > PERALTE_ROTURA) {
    return {
      ...base,
      estado: 'fuera',
      mensaje:
        `Ola demasiado empinada para el modelo lineal (peralte ${formatearNumero(p, 2)}): ` +
        'la ola rompería y la cifra solo orienta.',
    }
  }
  if (u > URSELL_FUERA) {
    return {
      ...base,
      estado: 'fuera',
      mensaje:
        `Ola demasiado grande para un fondo tan bajo (${formatearNumero(o.profundidad, 0)} m): ` +
        'la ola se deforma y el modelo lineal no vale; la cifra solo orienta.',
    }
  }
  if (p > PERALTE_LIMITE || u > URSELL_LIMITE) {
    return { ...base, estado: 'limite', mensaje: 'Ola al límite del modelo lineal: toma la cifra como orientativa.' }
  }
  return base
}
