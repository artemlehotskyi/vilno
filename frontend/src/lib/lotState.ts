import type { Lot } from '../api/client'

/** Стан майданчика на мапі. free/busy — оцінка із симулятора; neutral — безкоштовний, поза годинами або без даних. */
export type LotState = 'free' | 'busy' | 'neutral'
export type NeutralReason = 'free_lot' | 'closed' | 'no_data'

export function lotState(lot: Lot): { state: LotState; reason?: NeutralReason } {
  if (!lot.is_paid) return { state: 'neutral', reason: 'free_lot' }
  if (lot.open_now === false) return { state: 'neutral', reason: 'closed' }
  if (lot.free_estimate == null) return { state: 'neutral', reason: 'no_data' }
  return { state: lot.free_estimate > 0 ? 'free' : 'busy' }
}

/** Зайняті = місця з набору мінус вільні (оцінка). */
export function busyEstimate(lot: Lot): number | null {
  if (lot.places == null || lot.free_estimate == null) return null
  return lot.places - lot.free_estimate
}
