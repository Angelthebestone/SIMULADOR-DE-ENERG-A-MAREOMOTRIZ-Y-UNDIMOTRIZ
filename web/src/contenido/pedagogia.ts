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
      '¿Cuántas viviendas podrías alimentar si subes la altura significativa de ola a 2 m?',
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

/** Explicación breve de un elemento de la escena: qué es y qué hace. */
export type AnotacionContenido = {
  /** Nombre corto que se muestra en el botón. */
  titulo: string
  /** Qué es, en una línea. */
  queEs: string
  /** Qué hace dentro de la escena, en una línea. */
  funcion: string
}

/** Un registro por elemento animado: boya, ola, freno, energía y fondo. */
export const anotaciones: Record<string, AnotacionContenido> = {
  boya: {
    titulo: 'Boya',
    queEs: 'Cuerpo que sube y baja con la ola y entrega movimiento al equipo.',
    funcion: 'Su vaivén es lo que luego se convierte en electricidad.',
  },
  ola_hm0: {
    titulo: 'Altura de ola',
    queEs: 'Altura media del tercio de olas más altas, en metros.',
    funcion: 'Si crece, la boya se mueve más y llega más energía.',
  },
  periodo_te: {
    titulo: 'Periodo del oleaje',
    queEs: 'Tiempo medio entre crestas seguidas, en segundos.',
    funcion: 'Marca el ritmo al que la boya sube y baja.',
  },
  freno_pto: {
    titulo: 'Freno del equipo',
    queEs: 'Resistencia que opone el equipo al movimiento de la boya.',
    funcion: 'Con el freno justo se extrae más; si frena de más, la boya casi no se mueve.',
  },
  energia: {
    titulo: 'Energía que trae la ola',
    queEs: 'Energía que cruza cada metro de frente de ola por segundo.',
    funcion: 'Es el punto de partida: todo lo que sigue sale de ahí.',
  },
  fondo: {
    titulo: 'Fondo',
    queEs: 'Profundidad del lugar, en metros.',
    funcion: 'En fondo bajo la ola se acorta y se empina.',
  },
  corriente: {
    titulo: 'Corriente de marea',
    queEs: 'Agua que se mueve con la marea, en metros por segundo.',
    funcion: 'Su empuje mueve la turbina cuando el recurso es la marea.',
  },
  rango_marea: {
    titulo: 'Rango de marea',
    queEs: 'Diferencia de altura entre pleamar y bajamar, en metros.',
    funcion: 'Un rango mayor guarda más agua tras el dique.',
  },
}

/** Devuelve la explicación del elemento, o nulo si no existe. */
export function anotacionDe(id: string): AnotacionContenido | null {
  return anotaciones[id] ?? null
}