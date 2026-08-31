// Único transporte al cálculo. Dos entornos, una firma:
//   - carcasa pywebview: puente JS `window.pywebview.api`, sin peticiones.
//   - dev server de Vite: mock en `/api/simular` (ver vite.config.ts).
// Antes cada vista hacía su propio fetch('/api/simular'), que sólo existe en el
// mock: en la aplicación empaquetada no respondía nadie y la pantalla se quedaba
// vacía en silencio.

export type Params = {
  hm0_m: number
  te_s: number
  b_pto_ns_m: number
  profundidad_m: number
  sitio_id: string
  dispositivo: string
  // Cuatro supuestos editables desde Diseñar (spec supuestos-editables).
  // El motor de cálculo en app/servicio.py los acepta como parte de Parametros.
  eta_pto: number
  eta_gen: number
  crf: number
  rho: number
}

type PuenteApi = {
  simular?: (p: Record<string, unknown>) => Promise<unknown>
  cancelar?: () => void
}

declare global {
  interface Window {
    pywebview?: { api?: PuenteApi }
  }
}

/** La carcasa abre `web/dist/index.html` con el esquema `file:`; el dev server no. */
const EN_CARCASA = typeof location !== 'undefined' && location.protocol === 'file:'

/** pywebview inyecta el puente de forma asíncrona y avisa con `pywebviewready`. */
const puente: Promise<PuenteApi | null> = EN_CARCASA
  ? new Promise((resolve) => {
      if (window.pywebview?.api) return resolve(window.pywebview.api)
      window.addEventListener('pywebviewready', () => resolve(window.pywebview?.api ?? null), {
        once: true,
      })
    })
  : Promise.resolve(null)

export async function simular(params: Params, signal?: AbortSignal): Promise<unknown> {
  const api = await puente
  if (api?.simular) return api.simular(params as unknown as Record<string, unknown>)

  const r = await fetch('/api/simular', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
    signal,
  })
  if (!r.ok) throw new Error(`el servicio de cálculo respondió ${r.status}`)
  return r.json()
}

export async function cancelar(): Promise<void> {
  const api = await puente
  api?.cancelar?.()
}
