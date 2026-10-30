// Дзеркало backend/app/services/plate.py (нормалізація для ручного вводу, без «виправлень» OCR)
const CYR_TO_LAT: Record<string, string> = {
  А: 'A', В: 'B', Е: 'E', І: 'I', К: 'K', М: 'M', Н: 'H', О: 'O', Р: 'P', С: 'C', Т: 'T', Х: 'X',
}
export const PLATE_RE = /^[ABCEHIKMOPTX]{2}\d{4}[ABCEHIKMOPTX]{2}$/

/** Прибирає пробіли/дефіси, верхній регістр, кирилиця → латиниця. Без валідації. */
export function normalizePlate(raw: string): string {
  return [...raw.replace(/[\s\-–—_.]/g, '').toUpperCase()].map((ch) => CYR_TO_LAT[ch] ?? ch).join('')
}

export const isValidPlate = (raw: string) => PLATE_RE.test(normalizePlate(raw))

/** 'AA1234BB' → 'AA 1234 BB' (для неповного номера ділить так, як є) */
export function formatPlate(normalized: string): string {
  return [normalized.slice(0, 2), normalized.slice(2, 6), normalized.slice(6, 8)].filter(Boolean).join(' ')
}
