// Intuiciones físicas por fórmula del nivel Calcular.
//
// Una sola línea en lenguaje corriente (< 25 palabras) que traduce la
// expresión KaTeX a una idea observable: por qué una magnitud escala con
// otra, qué representa el factor numérico, qué pasa si se duplica una
// variable de entrada. La presentación no calcula: la intuición es texto
// fijo por id, estable entre simulaciones.

export const intuiciones: Record<string, string> = {
  J: 'energía que cruza un metro de frente de ola por segundo; crece con el cuadrado de la altura y de forma lineal con el periodo.',
  AEP: 'pasa de potencia instantánea a energía del año multiplicando por las horas en que el mar ofrece el recurso y el factor de planta del dispositivo.',
  contexto: 'reune las condiciones del sitio y del oleaje bajo las que se calculan las demás fórmulas.',
  densidad_potencia: 'mismo significado que J, con notación distinta: kilovatios por metro de frente de ola en lugar de vatios.',
  LCOE: 'coste de producir un MWh incluyendo el repago de la inversión (CRF) y el coste de operación y mantenimiento del año.',
}

export function intuicionDe(id: string): string {
  return intuiciones[id] ?? ''
}
