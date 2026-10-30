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

export const ZONE_LABEL: Record<Zone, string> = {
  center: 'центр',
  standard: 'стандарт',
  market: 'ринки/приватні',
}

// Колір зони: платні за зоною, безкоштовні сірі
export const ZONE_COLOR: Record<Zone, string> = {
  center: '#c0392b',
  standard: '#d98100',
  market: '#2563c9',
}
export const FREE_COLOR = '#8a8f98'
