import { useEffect, useState } from 'react'
import { getDispatch, type Dispatch } from '../api/client'
import SimBadge from '../components/SimBadge'
import { ZONE_COLOR, ZONE_LABEL, formatMoney } from '../lib/format'
import { card, errorBox } from '../lib/ui'

const th = { textAlign: 'left', padding: '8px 10px', fontSize: 12, color: '#555', whiteSpace: 'nowrap', borderBottom: '2px solid #ddd' } as const
const td = { padding: '8px 10px', borderBottom: '1px solid #eee', fontSize: 14, whiteSpace: 'nowrap' } as const
const pct = (x: number) => `${Math.round(x * 100)}%`

export default function City() {
  const [d, setD] = useState<Dispatch | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getDispatch().then(setD).catch((e) => setError(e.message))
  }, [])

  if (error) return <div style={{ ...errorBox, margin: 16 }}>Не вдалося завантажити: {error}</div>
  if (!d) return <div style={{ padding: 16 }}>Завантаження…</div>

  const a = d.assumptions
  const top = d.rows[0]

  return (
    <div style={{ padding: 16, paddingBottom: 72, maxWidth: 1000, margin: '0 auto' }}>
      <h2 style={{ margin: '0 0 4px' }}>
        Куди їхати контролерам <SimBadge />
      </h2>
      <div style={{ fontSize: 14, color: '#555', marginBottom: 12 }}>
        Усі числа нижче <b>змодельовані</b> (seed {a.sim_seed}): реальних даних про неоплату в Чернівцях немає, їх дасть пілот.
        Реальні скани з демо сюди не потрапляють. Список платних майданчиків і тарифи — справжні, з data.gov.ua.
      </div>

      <div style={{ ...card, marginBottom: 12 }}>
        <div style={{ fontSize: 16 }}>
          <b>Їхати окремо: {d.go_count}</b> майданчиків, очікувана вигода {formatMoney(d.go_benefit_uah)} <SimBadge />
          <br />
          <span style={{ color: '#555' }}>Лише в складі маршруту: {d.route_count}</span>
        </div>
        {top && (
          <div style={{ marginTop: 6, fontSize: 14 }}>
            Найвигідніший: <b>{top.address}</b> — {formatMoney(top.expected_benefit_uah)} за виїзд при вартості виїзду {formatMoney(a.trip_cost_uah)}. <SimBadge />
          </div>
        )}
        <div style={{ marginTop: 8, fontSize: 12, color: '#666' }}>
          Формула: вигода = авто × частка неоплати × штраф ({a.fine_multiplier} × тариф) × ймовірність сплати штрафу ({pct(a.fine_payment_prob)}).
          Їхати, якщо вигода &gt; {formatMoney(a.trip_cost_uah)}. Припущення: вартість виїзду, {pct(a.fine_payment_prob)} (бенчмарк
          Опендатабот, не паркувальні штрафи), зайнятість ≈ {pct(a.mean_occupancy)}, середня неоплата: центр {pct(a.mean_unpaid_share.center)},
          стандарт {pct(a.mean_unpaid_share.standard)}, ринки {pct(a.mean_unpaid_share.market)}.
        </div>
      </div>

      <div style={{ overflowX: 'auto', background: '#fff', borderRadius: 14, border: '1px solid #e2e2dc' }}>
        <table style={{ borderCollapse: 'collapse', width: '100%' }}>
          <thead>
            <tr>
              <th style={th}>Майданчик</th>
              <th style={th}>Зона*</th>
              <th style={th}>Тариф</th>
              <th style={th}>Авто <SimBadge /></th>
              <th style={th}>Неоплата <SimBadge /></th>
              <th style={th}>Вигода виїзду <SimBadge /></th>
              <th style={th}>Рішення</th>
            </tr>
          </thead>
          <tbody>
            {d.rows.map((r, i) => (
              <tr key={r.lot_id} style={{ background: i === 0 ? '#fff8e1' : undefined }}>
                <td style={td}>
                  <b>{r.address}</b>
                  <div style={{ fontSize: 12, color: '#777' }}>{r.operator_name}</div>
                </td>
                <td style={td}>
                  <span style={{ color: ZONE_COLOR[r.zone], fontWeight: 600 }}>● {ZONE_LABEL[r.zone]}</span>
                </td>
                <td style={td}>{r.tariff_per_hour} грн</td>
                <td style={td}>{r.cars} з {r.places}</td>
                <td style={{ ...td, background: `rgba(192, 57, 43, ${Math.min(0.6, r.unpaid_share)})` }}>{pct(r.unpaid_share)}</td>
                <td style={{ ...td, fontWeight: 600 }}>{formatMoney(r.expected_benefit_uah)}</td>
                <td style={td}>
                  {r.decision === 'go' ? (
                    <span style={{ background: '#c0392b', color: '#fff', padding: '3px 10px', borderRadius: 6, fontWeight: 600 }}>Їхати</span>
                  ) : (
                    <span style={{ background: '#e6e6e0', padding: '3px 10px', borderRadius: 6 }}>В маршруті</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div style={{ fontSize: 12, color: '#666', marginTop: 6 }}>* Зони — припущення команди за тарифом, в наборі їх немає.</div>
    </div>
  )
}
