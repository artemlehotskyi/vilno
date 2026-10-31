import type { Recognition } from '../api/client'

/** car — CV знайшов авто (є токен), nocar — авто немає (старт заблоковано),
 *  fallback — CV недоступний/впав (старт дозволено, «фото не перевірено»). */
export type PhotoGate = 'car' | 'nocar' | 'fallback'

export interface PhotoNote {
  kind: 'ok' | 'warn' | 'info'
  text: string
  plate: string | null // що підставити в поле (або null)
  gate: PhotoGate
  carToken: string | null
}

/** Що сказати людині після розпізнавання. requireCar: водій має сфотографувати авто. */
export function photoNote(r: Recognition, requireCar: boolean): PhotoNote {
  const base = { plate: null, carToken: null }
  if (!r.enabled || r.car_present === null) {
    return { ...base, kind: 'info', gate: 'fallback', text: 'Розпізнавання недоступне: фото не перевірено. Номер введіть вручну.' }
  }
  if (requireCar && r.car_present === false) {
    return { ...base, kind: 'warn', gate: 'nocar', text: 'На фото немає авто, спробуйте ще раз.' }
  }
  const gate: PhotoGate = r.car_present && r.car_token ? 'car' : 'nocar'
  if (r.plate) return { kind: 'ok', gate, plate: r.plate, carToken: r.car_token, text: 'Номер розпізнано. Перевірте й підтвердьте його самі.' }
  return { ...base, kind: 'info', gate, carToken: r.car_token, text: 'Авто на фото є. Номер не розпізнано впевнено: введіть вручну.' }
}

/** Запит до /recognize впав (мережа, 5xx): дозволяємо fallback, остаточно вирішує сервер. */
export const failedNote: PhotoNote = {
  kind: 'info', gate: 'fallback', plate: null, carToken: null,
  text: 'Розпізнавання не спрацювало: фото не перевірено. Номер введіть вручну.',
}

export const canStart = (gate: PhotoGate | null) => gate === 'car' || gate === 'fallback'
