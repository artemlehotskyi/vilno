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

export interface DayPart {
  day: string
  minutes: number
  raw: number
  amount: number
  cap: number | null
  capped: boolean
}

export interface SessionOut {
  id: string
  lot_id: number
  status: 'active' | 'finished' | 'paid'
  started_at: string
  ended_at: string | null
  now: string // демо-час сервера
  minutes: number
  amount_uah: number
  is_final: boolean
  breakdown: DayPart[]
  payment_ref: string | null
}

export interface Clock {
  now: string
  is_demo_shifted: boolean
}

const JSON_HEADERS = { 'Content-Type': 'application/json' }

export const startSession = (plate: string, lot_id: number) =>
  api<SessionOut>('/sessions', { method: 'POST', headers: JSON_HEADERS, body: JSON.stringify({ plate, lot_id }) })
export const getSession = (id: string) => api<SessionOut>(`/sessions/${id}`)
export const finishSession = (id: string) => api<SessionOut>(`/sessions/${id}/finish`, { method: 'POST' })
export const paySession = (id: string) => api<SessionOut>(`/sessions/${id}/pay`, { method: 'POST' })

export const getClock = () => api<Clock>('/clock')
export const demoAdvance = (token: string, minutes: number) =>
  api<Clock>('/demo/clock', {
    method: 'POST',
    headers: { ...JSON_HEADERS, 'X-Demo-Token': token },
    body: JSON.stringify({ advance_minutes: minutes }),
  })
export const demoReset = (token: string) =>
  api<Clock>('/demo/reset', { method: 'POST', headers: { 'X-Demo-Token': token } })

export type ScanStatus = 'active' | 'unpaid' | 'closed_but_present' | 'unknown'

export interface ScanOut {
  status: ScanStatus
  paid_now: boolean // чи діє зараз платне паркування на лоті
  minutes_since_close: number | null
  grace_after_close: boolean
  session_on_other_lot: boolean
  recheck_after_min: number | null
  lot_id: number
  scanned_at: string
}

export const postScan = (plate: string | null, lot_id: number, ocr_source: 'manual' | 'cv' = 'manual') =>
  api<ScanOut>('/scans', { method: 'POST', headers: JSON_HEADERS, body: JSON.stringify({ plate, lot_id, ocr_source }) })
