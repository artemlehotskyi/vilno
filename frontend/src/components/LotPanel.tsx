import { BuildingsIcon, CheckIcon, ClockIcon, MoonIcon, WheelchairIcon, XIcon } from '@phosphor-icons/react'
import type { ReactNode } from 'react'
import type { Lot } from '../api/client'
import { ZONE_LABEL, formatHours } from '../lib/format'
import { busyEstimate, lotState } from '../lib/lotState'
import ReportNoSpace from './ReportNoSpace'
import { primaryBtn } from '../lib/ui'

const NO_DATA = 'немає даних'

function Metric({ icon, color, value, label, note }: { icon: ReactNode; color: string; value: number | null; label: string; note: string }) {
  return (
    <div style={{ flex: 1, minWidth: 0, color, padding: '0 12px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: value == null ? 14 : 28, fontWeight: 600, lineHeight: 1.1, minHeight: 32 }}>
        {icon}
        <span>{value ?? '—'}</span>
      </div>
      <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--ink-2)', marginTop: 4, lineHeight: 1.3 }}>
        {label}
        <span style={{ display: 'block', fontWeight: 400 }}>{value == null ? NO_DATA : note}</span>
      </div>
    </div>
  )
}

function Line({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', fontSize: 14, color: 'var(--ink-2)' }}>
      <span style={{ marginTop: 2, display: 'flex' }}>{icon}</span>
      <span>{children}</span>
    </div>
  )
}

interface Props {
  lot: Lot
  onPark: () => void
  onClose: () => void
}

/** Панель майданчика знизу: назва, тариф із зоною, три показники в один рядок, дія. */
export default function LotPanel({ lot, onPark, onClose }: Props) {
  const { state, reason } = lotState(lot)
  const isFree = !lot.is_paid
  return (
    <section
      className="lot-panel"
      aria-label={`Майданчик ${lot.address}`}
      style={{
        position: 'absolute', left: 0, right: 0, bottom: 0, zIndex: 1000, background: 'var(--bg)',
        borderTop: '1px solid var(--line)', borderRadius: '16px 16px 0 0', padding: '16px 16px 20px',
        boxShadow: '0 -4px 16px rgba(11,31,68,.08)', maxHeight: '70%', overflowY: 'auto',
      }}
    >
      <div key={lot.id} className="lot-panel-body">
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h2 style={{ margin: 0, fontSize: 20, fontWeight: 600, lineHeight: 1.25, overflowWrap: 'anywhere', textWrap: 'balance' }}>{lot.address}</h2>
            <div style={{ marginTop: 4, fontSize: 14, fontWeight: 500 }}>
              {isFree ? (
                'Безкоштовний майданчик'
              ) : (
                <>
                  {lot.zone ? `${ZONE_LABEL[lot.zone]} · ` : ''}
                  {lot.tariff_per_hour} грн/год
                </>
              )}
            </div>
            {!isFree && <div style={{ fontSize: 12, color: 'var(--ink-2)' }}>зона — припущення за ціною</div>}
          </div>
          <button
            onClick={onClose}
            aria-label="Закрити панель"
            style={{ width: 44, height: 44, margin: '-8px -8px 0 0', border: 0, background: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >
            <XIcon size={20} weight="regular" />
          </button>
        </div>

        {(!isFree || lot.places_disabled != null) && (
        <div style={{ display: 'flex', margin: '16px 0', padding: '12px 0', borderTop: '1px solid var(--line)', borderBottom: '1px solid var(--line)' }}>
          {!isFree && (
            <>
          <Metric icon={<CheckIcon size={20} weight="regular" />} color="var(--free)" value={state === 'free' || state === 'busy' ? lot.free_estimate : null} label="вільно" note="оцінка" />
          <div style={{ width: 1, background: 'var(--line)' }} />
          <Metric icon={<XIcon size={20} weight="regular" />} color="var(--busy)" value={state === 'free' || state === 'busy' ? busyEstimate(lot) : null} label="зайнято" note="оцінка" />
          <div style={{ width: 1, background: 'var(--line)' }} />
            </>
          )}
          <Metric icon={<WheelchairIcon size={20} weight="regular" />} color="var(--disabled-places)" value={lot.places_disabled} label="для людей з інвалідністю" note="за набором" />
        </div>
        )}

        <div style={{ display: 'grid', gap: 6, marginBottom: 16 }}>
          {reason === 'closed' && (
            <Line icon={<MoonIcon size={16} weight="regular" />}>Зараз поза робочими годинами: паркування безкоштовне</Line>
          )}
          {!isFree && <Line icon={<ClockIcon size={16} weight="regular" />}>{formatHours(lot.opening_hours)}</Line>}
          {!isFree && <Line icon={<BuildingsIcon size={16} weight="regular" />}>{lot.operator_name ?? 'оператор не вказаний'}</Line>}
          {lot.places != null && <Line icon={<span style={{ width: 16 }} />}>Усього місць за набором: {lot.places}</Line>}
          {isFree && lot.places == null && <Line icon={<span style={{ width: 16 }} />}>Кількість місць: {NO_DATA}</Line>}
        </div>

        {isFree ? (
          <div style={{ fontSize: 14, color: 'var(--ink-2)' }}>Сесія не потрібна: тут не стягують плату.</div>
        ) : (
          <>
            <button style={primaryBtn} onClick={onPark}>Припаркуватись тут</button>
            <ReportNoSpace key={lot.id} lotId={lot.id} />
          </>
        )}
      </div>
    </section>
  )
}
