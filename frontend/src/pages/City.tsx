import { Fragment, useEffect, useMemo, useState } from 'react'
import { CircleNotchIcon, NavigationArrowIcon, PathIcon, WarningCircleIcon } from '@phosphor-icons/react'
import { getDispatch, type Dispatch } from '../api/client'
import Note from '../components/Note'
import SimBadge from '../components/SimBadge'
import { ZONE_LABEL, formatMoney } from '../lib/format'

const ROUTE_BG = 'color-mix(in srgb, var(--ink) 4%, white)'
const ROUTE_SIZE = 5 // «маршрут на сьогодні»: топ за вигодою виїзду
const th = { textAlign: 'left', padding: '10px 12px', fontSize: 12, fontWeight: 600, color: 'var(--ink-2)', whiteSpace: 'nowrap', borderBottom: '1px solid var(--field-line)' } as const
const td = { padding: '12px', borderBottom: '1px solid var(--line)', fontSize: 14, whiteSpace: 'nowrap' } as const
const pct = (x: number) => `${Math.round(x * 100)}%`

export default function City() {
  const [d, setD] = useState<Dispatch | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getDispatch().then(setD).catch((e) => setError(e.message))
  }, [])

  // Сортуємо за вигодою виїзду (симуляція). Підтверджені сигнали лишаються видимими в стовпці, порядок не змінюють.
  const rows = useMemo(() => (d ? [...d.rows].sort((a, b) => b.expected_benefit_uah - a.expected_benefit_uah) : []), [d])

  if (error) return <div style={{ padding: 16 }}><Note kind="error">Не вдалося завантажити: {error}</Note></div>
  if (!d) {
    return (
      <div role="status" style={{ padding: 16, display: 'flex', gap: 8, alignItems: 'center', color: 'var(--ink-2)' }}>
        <CircleNotchIcon size={20} weight="regular" className="spin" aria-hidden />
        Завантаження…
      </div>
    )
  }

  const a = d.assumptions
  const route = rows.slice(0, ROUTE_SIZE)
  const routeBenefit = route.reduce((s, r) => s + r.expected_benefit_uah, 0)

  return (
    <div className="screen-in" style={{ padding: 16, paddingBottom: 72, maxWidth: 1000, margin: '0 auto' }}>
      <h2 style={{ margin: '0 0 4px', fontSize: 20, fontWeight: 600 }}>
        Куди їхати контролерам <SimBadge />
      </h2>
      <p style={{ margin: '0 0 20px', fontSize: 14, color: 'var(--ink-2)' }}>
        Усі числа нижче змодельовані (seed {a.sim_seed}): реальних даних про неоплату в Чернівцях немає, їх дасть пілот. Реальні скани з демо сюди не
        потрапляють. Список платних майданчиків і тарифи справжні, з data.gov.ua.
      </p>

      <section style={{ padding: '16px 0', borderTop: '1px solid var(--line)', borderBottom: '1px solid var(--line)' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px 32px' }}>
          <div>
            <div style={{ fontSize: 28, fontWeight: 600, lineHeight: 1.1 }}>{d.go_count}</div>
            <div style={{ fontSize: 13, color: 'var(--ink-2)' }}>їхати окремо, з {rows.length} майданчиків</div>
          </div>
          <div>
            <div style={{ fontSize: 28, fontWeight: 600, lineHeight: 1.1 }}>{formatMoney(d.go_benefit_uah)}</div>
            <div style={{ fontSize: 13, color: 'var(--ink-2)' }}>очікувана вигода <SimBadge /></div>
          </div>
          <div>
            <div style={{ fontSize: 28, fontWeight: 600, lineHeight: 1.1 }}>{d.route_count}</div>
            <div style={{ fontSize: 13, color: 'var(--ink-2)' }}>лише в складі маршруту</div>
          </div>
        </div>
        <p style={{ margin: '14px 0 0', fontSize: 12, color: 'var(--ink-2)' }}>
          Формула: вигода = авто × частка неоплати × штраф ({a.fine_multiplier} × тариф) × ймовірність сплати штрафу ({pct(a.fine_payment_prob)}).
          Їхати, якщо вигода &gt; {formatMoney(a.trip_cost_uah)}. Припущення: вартість виїзду, {pct(a.fine_payment_prob)} (бенчмарк Опендатабот, не паркувальні
          штрафи), зайнятість ≈ {pct(a.mean_occupancy)}, середня неоплата: центр {pct(a.mean_unpaid_share.center)}, стандарт {pct(a.mean_unpaid_share.standard)},
          ринки {pct(a.mean_unpaid_share.market)}.
        </p>
      </section>

      <div style={{ margin: '20px 0 8px', fontSize: 13, color: 'var(--ink-2)' }}>
        Таблиця відсортована за вигодою виїзду. Стовпці «Авто», «Неоплата», «Вигода виїзду» <SimBadge />
      </div>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: 760 }}>
          <thead>
            <tr>
              <th style={{ ...th, position: 'sticky', left: 0, background: 'var(--bg)' }}>Майданчик</th>
              <th style={th}>Вигода виїзду</th>
              <th style={th}>Рішення</th>
              <th style={th}>Зона*</th>
              <th style={th}>Тариф</th>
              <th style={th}>Авто</th>
              <th style={th}>Неоплата</th>
              <th style={th}>Сигнали за 1 год<br /><span style={{ fontWeight: 400 }}>усього / підтв. (реальні)</span></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <Fragment key={r.lot_id}>
                {(i === 0 || i === ROUTE_SIZE) && (
                  <tr>
                    <td colSpan={8} style={{ padding: '16px 12px 8px', fontSize: 13, fontWeight: 600, color: i === 0 ? 'var(--ink)' : 'var(--ink-2)' }}>
                      {i === 0 ? (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                          <PathIcon size={18} weight="regular" aria-hidden />
                          Маршрут на сьогодні: топ-{ROUTE_SIZE}, разом {formatMoney(routeBenefit)} <SimBadge />
                        </span>
                      ) : (
                        'Решта майданчиків'
                      )}
                    </td>
                  </tr>
                )}
                <tr style={{ background: i < ROUTE_SIZE ? ROUTE_BG : undefined }}>
                  {/* перший стовпець липкий: на вузькому екрані майданчик завжди видно при горизонтальній прокрутці */}
                  <td style={{ ...td, position: 'sticky', left: 0, background: i < ROUTE_SIZE ? ROUTE_BG : 'var(--bg)', maxWidth: 170, whiteSpace: 'normal' }}>
                    <span style={{ fontWeight: 600 }}>{r.address}</span>
                    <div style={{ fontSize: 12, color: 'var(--ink-2)' }}>{r.operator_name}</div>
                  </td>
                  <td style={{ ...td, fontWeight: 600 }}>{formatMoney(r.expected_benefit_uah)}</td>
                  <td style={td}>
                    {r.decision === 'go' ? (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontWeight: 600 }}>
                        <NavigationArrowIcon size={16} weight="regular" aria-hidden />
                        Їхати
                      </span>
                    ) : (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: 'var(--ink-2)' }}>
                        <PathIcon size={16} weight="regular" aria-hidden />
                        В маршруті
                      </span>
                    )}
                  </td>
                  <td style={td}>{ZONE_LABEL[r.zone]}</td>
                  <td style={td}>{r.tariff_per_hour} грн</td>
                  <td style={td}>{r.cars} з {r.places}</td>
                  <td style={td}>{pct(r.unpaid_share)}</td>
                  <td style={td}>
                    {r.reports_1h ? (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontWeight: r.reports_confirmed_1h ? 600 : 400, color: r.reports_confirmed_1h ? 'var(--busy)' : undefined }}>
                        {r.reports_confirmed_1h > 0 && <WarningCircleIcon size={16} weight="regular" aria-label="Є підтверджені сигнали" />}
                        {r.reports_1h} / {r.reports_confirmed_1h}
                      </span>
                    ) : (
                      '—'
                    )}
                  </td>
                </tr>
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
      <p style={{ fontSize: 12, color: 'var(--ink-2)', margin: '12px 0 0' }}>
        * Зони — припущення команди за тарифом, в наборі їх немає.
        <br />
        Сигнали — реальні скарги водіїв «місць насправді немає» за останню годину. Підтверджений = вказаний номер не має активної сесії на цьому
        майданчику (позначено іконкою). Сигнал не є штрафом: рішення після скану ухвалює інспектор.
      </p>
    </div>
  )
}
