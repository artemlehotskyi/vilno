import type { Lot } from '../api/client'
import { ZONE_LABEL, formatHours } from '../lib/format'

/** Короткий опис лоту (для водія й інспектора). Зона — припущення. */
export default function LotSummary({ lot }: { lot: Lot }) {
  return (
    <div style={{ fontSize: 14, lineHeight: 1.45 }}>
      <div style={{ fontWeight: 700, fontSize: 16 }}>{lot.address}</div>
      {lot.is_paid ? (
        <>
          <div>{lot.operator_name ?? 'оператор не вказаний'}</div>
          <div>{lot.tariff_per_hour} грн/год · зона: {lot.zone && ZONE_LABEL[lot.zone]} (припущення)</div>
          <div>{formatHours(lot.opening_hours)}</div>
        </>
      ) : (
        <div>Безкоштовний майданчик, без тарифікації</div>
      )}
    </div>
  )
}
