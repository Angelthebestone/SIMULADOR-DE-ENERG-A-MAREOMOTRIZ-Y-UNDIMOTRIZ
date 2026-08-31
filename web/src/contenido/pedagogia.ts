// Andamiaje pedagógico — pregunta conductora, micro-tarea y verificador por nivel.
//
// Centraliza el contenido pedagógico (no UI). Cada nivel expone una hipótesis
// verificable con los controles disponibles; las vistas consumen este mapa y
// muestran un veredicto positivo cuando `evaluar_cumplimiento(nivel, resultado)`
// devuelve true.

export type Nivel = 'ver' | 'comparar' | 'calcular' | 'disenar'

export type Pregunta = {
  /** Hipótesis que el estudiante pone a prueba al manipular el nivel. */
  pregunta: string
  /** Pasos concretos para ello — un renglón, una sola idea. */
  tarea: string
  /** Decide si la micro-tarea se cumplió con el resultado del cálculo. */
  verificar: (r: Record<string, unknown>) => boolean
}

export const preguntas: Record<Nivel, Pregunta> = {
  ver: {
    pregunta:
      '¿Cuántas viviendas de Isla Fuerte podrías alimentar si subes la altura significativa de ola a 2 m?',
    tarea:
      'Sube Hm0 hasta 2,0 m y deja Te en 7,0 s hasta ver la cifra de viviendas.',
    verificar: (r) => {
      const recurso = r?.recurso as Record<string, unknown> | undefined
      const hm0 = Number(recurso?.hm0 ?? NaN)
      return Number.isFinite(hm0) && hm0 >= 1.95 && hm0 <= 2.05
    },
  },
  comparar: {
    pregunta:
      '¿En qué eslabón se separan dos tecnologías evaluadas con el mismo oleaje?',
    tarea:
      'Pulsa Comparar y lee el nombre del primer eslabón que difiera más del 2 %.',
    verificar: (r) => {
      const div = String(r?.divergencia ?? '')
      return div.length > 0 && !div.startsWith('—') && !div.startsWith('selecciona')
    },
  },
  calcular: {
    pregunta:
      '¿Cómo sale la cifra de AEP a partir de la potencia, horas, disponibilidad y factor de planta?',
    tarea:
      'Lee la sustitución numérica bajo cada fórmula y comprueba que el producto cierra.',
    verificar: (r) => !!r && typeof r === 'object',
  },
  disenar: {
    pregunta:
      '¿Cuánto cuesta cada MWh del dispositivo frente al diésel ZNI y a la red SIN?',
    tarea:
      'Edita CAPEX y OPEX hasta que el coste por MWh quede por debajo del diésel y, si es posible, por debajo del SIN.',
    verificar: (r) => {
      const lcoe = Number((r?.extras as Record<string, unknown> | undefined)?.lcoe ?? NaN)
      const lcoeSin = Number((r?.extras as Record<string, unknown> | undefined)?.lcoe_sin ?? NaN)
      return Number.isFinite(lcoe) && Number.isFinite(lcoeSin) && lcoe > 0 && lcoe < lcoeSin
    },
  },
}

/** Decide si la micro-tarea del nivel se cumplió con el resultado del cálculo. */
export function evaluar_cumplimiento(nivel: Nivel, resultado: Record<string, unknown> | null | undefined): boolean {
  if (!resultado) return false
  const p = preguntas[nivel]
  if (!p) return false
  try {
    return p.verificar(resultado)
  } catch {
    return false
  }
}