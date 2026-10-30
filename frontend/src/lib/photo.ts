import type { Recognition } from '../api/client'

export interface PhotoNote {
  kind: 'ok' | 'warn' | 'info'
  text: string
  plate: string | null // що підставити в поле (або null)
}

/** Що сказати людині після розпізнавання. requireCar: водій має сфотографувати авто. */
export function photoNote(r: Recognition, requireCar: boolean): PhotoNote {
  if (!r.enabled) return { kind: 'info', text: 'Розпізнавання вимкнено: введіть номер вручну.', plate: null }
  if (requireCar && r.car_present === false) {
    return { kind: 'warn', text: 'На фото не видно авто. Зробіть фото ще раз або введіть номер вручну.', plate: null }
  }
  if (r.plate) return { kind: 'ok', text: 'Номер розпізнано. Перевірте й підтвердьте його самі.', plate: r.plate }
  return { kind: 'info', text: 'Номер не вдалося розпізнати впевнено: введіть вручну.', plate: null }
}
