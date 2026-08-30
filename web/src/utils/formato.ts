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
