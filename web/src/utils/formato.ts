// Port de app/formato.py — paridad verificada por pruebas/test_formato_espanol.py
export function formatearNumero(valor: number, decimales: number): string {
  const f = Number(valor).toFixed(Math.max(decimales, 0));
  const [ent, dec] = f.split(".");
  const entMiles = ent.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return dec !== undefined ? `${entMiles},${dec}` : entMiles;
}

export function formatearPorcentaje(v: number): string {
  return `${formatearNumero(v * 100, 1)} %`;
}

export function formatearMagnitud(valor: number, unidad: string, decimales = 2): string {
  return `${formatearNumero(valor, decimales)} ${unidad}`.trim();
}

/** Potencia en la unidad que la deja entre 1 y 1000: W, kW, MW o GW. */
export function partesPotencia(w: number): { valor: string; unidad: string } {
  if (!Number.isFinite(w)) return { valor: '', unidad: '' }
  const escalas: Array<[number, string]> = [[1e9, 'GW'], [1e6, 'MW'], [1e3, 'kW'], [1, 'W']]
  const [div, unidad] = escalas.find(([d]) => Math.abs(w) >= d) ?? [1, 'W']
  const v = w / div
  return { valor: formatearNumero(v, v < 10 ? 2 : v < 100 ? 1 : 0), unidad }
}

export function textoPotencia(w: number): string {
  const p = partesPotencia(w)
  return p.valor ? `${p.valor} ${p.unidad}` : 'sin dato'
}

/** Energía anual: MWh/año hasta 10 000, GWh/año por encima. */
export function partesEnergiaAnual(mwh: number): { valor: string; unidad: string } {
  if (!Number.isFinite(mwh)) return { valor: '', unidad: '' }
  if (Math.abs(mwh) >= 10_000) return { valor: formatearNumero(mwh / 1000, 1), unidad: 'GWh/año' }
  return { valor: formatearNumero(mwh, mwh < 100 ? 1 : 0), unidad: 'MWh/año' }
}
