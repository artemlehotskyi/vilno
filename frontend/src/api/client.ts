// Єдина точка виходу до бекенду. Фронт ходить тільки в /api.
export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const r = await fetch(`/api${path}`, init)
  if (!r.ok) {
    const body = await r.json().catch(() => ({}))
    throw new Error(body.detail ?? `HTTP ${r.status}`)
  }
  return r.json() as Promise<T>
}

export type Zone = 'center' | 'standard' | 'market'

export interface Lot {
  id: number
  source_ids: number[]
  address: string
  description: string | null
  operator_name: string | null
  is_paid: boolean
  zone: Zone | null
  tariff_per_hour: number | null
  places: number | null
  places_disabled: number | null
  opening_hours: { days: number[]; from: string; to: string } | null
  lat: number
  lon: number
  free_estimate: number | null // СИМУЛЯЦІЯ
}

export const getLots = () => api<Lot[]>('/lots')
