import type { Lot, Zone } from '../api/client'

const DAY = ['', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Нд']

/** [1,2,3,4,5] → «Пн–Пт», [1..7] → «щодня», [2..7] → «Вт–Нд» */
export function formatDays(days: number[]): string {
  const d = [...days].sort((a, b) => a - b)
  if (d.length === 7) return 'щодня'
  const contiguous = d.every((x, i) => i === 0 || x === d[i - 1] + 1)
  if (contiguous && d.length > 2) return `${DAY[d[0]]}–${DAY[d[d.length - 1]]}`
  return d.map((x) => DAY[x]).join(', ')
}

export function formatHours(h: Lot['opening_hours']): string {
  return h ? `${formatDays(h.days)} ${h.from}–${h.to}` : 'години не вказані'
}

// Зони виведені з ціни (припущення), у наборі їх немає. Колір зони на мапі не кодуємо
export const ZONE_LABEL: Record<Zone, string> = {
  center: 'Центр',
  standard: 'Стандарт',
  market: 'Ринки/приватні',
}

export function formatMoney(n: number): string {
  const text = n.toLocaleString('uk-UA', { minimumFractionDigits: Number.isInteger(n) ? 0 : 2, maximumFractionDigits: 2 })
  return `${text} грн`
}

/** 90 → «1 год 30 хв», 45 → «45 хв» */
export function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return [h ? `${h} год` : '', m || !h ? `${m} хв` : ''].filter(Boolean).join(' ')
}

/** HH:MM:SS з мілісекунд */
export function formatTimer(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000))
  const pad = (x: number) => String(x).padStart(2, '0')
  return `${pad(Math.floor(s / 3600))}:${pad(Math.floor((s % 3600) / 60))}:${pad(s % 60)}`
}

// Показуємо час Києва незалежно від часового поясу телефона
export function formatKyivTime(iso: string, withDay = true): string {
  return new Date(iso).toLocaleString('uk-UA', {
    timeZone: 'Europe/Kyiv',
    ...(withDay ? { weekday: 'short', day: '2-digit', month: '2-digit' } : {}),
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function formatDay(isoDate: string): string {
  return new Date(`${isoDate}T12:00:00`).toLocaleDateString('uk-UA', { weekday: 'short', day: '2-digit', month: '2-digit' })
}
