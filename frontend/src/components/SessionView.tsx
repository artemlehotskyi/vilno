import { useCallback, useEffect, useRef, useState } from 'react'
import { finishSession, getSession, paySession, type Lot, type SessionOut } from '../api/client'
import { CLOCK_EVENT } from './DemoPanel'
import LotSummary from './LotSummary'
import { formatDay, formatDuration, formatKyivTime, formatMoney, formatTimer } from '../lib/format'
import { card, errorBox, primaryBtn, secondaryBtn } from '../lib/ui'

interface Props {
  session: SessionOut
  lot: Lot
  onUpdate: (s: SessionOut) => void
  onNew: () => void // нова сесія / сесію видалено на сервері
}

const round2 = (x: number) => Math.round(x * 100) / 100

export default function SessionView({ session, lot, onUpdate, onNew }: Props) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [, setTick] = useState(0)
  // Таймер: серверний час на момент відповіді + локально минулі мілісекунди
  const anchor = useRef({ serverMs: Date.parse(session.now), at: Date.now() })
  useEffect(() => {
    anchor.current = { serverMs: Date.parse(session.now), at: Date.now() }
  }, [session.now])

  const refresh = useCallback(async () => {
    try {
      onUpdate(await getSession(session.id))
    } catch (e) {
      if ((e as Error).message.includes('не знайдено')) onNew() // після «Скинути демо»
      else setError((e as Error).message)
    }
  }, [session.id, onUpdate, onNew])

  useEffect(() => {
    if (session.status !== 'active') return
    const poll = setInterval(refresh, 5000)
    window.addEventListener(CLOCK_EVENT, refresh)
    return () => {
      clearInterval(poll)
      window.removeEventListener(CLOCK_EVENT, refresh)
    }
  }, [session.status, refresh])

  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 1000)
    return () => clearInterval(id)
  }, [])

  const act = async (fn: () => Promise<SessionOut>) => {
    setBusy(true)
    setError(null)
    try {
      onUpdate(await fn())
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const nowMs = anchor.current.serverMs + (Date.now() - anchor.current.at)
  const endMs = session.ended_at ? Date.parse(session.ended_at) : nowMs
  const elapsed = endMs - Date.parse(session.started_at)
  const saved = round2(session.breakdown.reduce((s, p) => s + (p.raw - p.amount), 0))

  return (
    <div>
      <div style={{ ...card, marginBottom: 12 }}>
        <LotSummary lot={lot} />
        <div style={{ fontSize: 13, color: '#666', marginTop: 6 }}>Початок: {formatKyivTime(session.started_at)} (демо-годинник)</div>
      </div>

      <div style={{ ...card, textAlign: 'center' }}>
        {session.status === 'active' && <div style={{ color: '#1f8a4c', fontWeight: 600 }}>Сесія триває</div>}
        {session.status === 'finished' && <div style={{ fontWeight: 600 }}>Сесію завершено · до сплати</div>}
        {session.status === 'paid' && <div style={{ color: '#1f8a4c', fontWeight: 600 }}>✓ Сплачено</div>}

        <div style={{ fontSize: 44, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{formatTimer(elapsed)}</div>
        <div style={{ fontSize: 30, fontWeight: 700 }}>
          {formatMoney(session.amount_uah)}
          {!session.is_final && <span style={{ fontSize: 14, fontWeight: 400, color: '#666' }}> поки що</span>}
        </div>

        <div style={{ textAlign: 'left', marginTop: 12, fontSize: 14 }}>
          {session.breakdown.length === 0 ? (
            <div>Поза годинами платного паркування ({lot.opening_hours ? `${lot.opening_hours.from}–${lot.opening_hours.to}` : '—'}): безкоштовно.</div>
          ) : (
            session.breakdown.map((p) => (
              <div key={p.day} style={{ marginBottom: 6 }}>
                {formatDay(p.day)}: {formatDuration(p.minutes)} × {lot.tariff_per_hour} грн/год = {formatMoney(p.raw)}
                {p.capped && p.cap != null && (
                  <div style={{ color: '#1f8a4c' }}>
                    Денний ліміт {formatMoney(p.cap)}: платите {formatMoney(p.amount)}
                  </div>
                )}
              </div>
            ))
          )}
          {saved > 0 && <div style={{ color: '#1f8a4c', fontWeight: 600 }}>Ліміт зекономив вам {formatMoney(saved)}</div>}
          {lot.zone === 'center' && <div style={{ color: '#666' }}>Центр: без денного ліміту (щоб місця оберталися).</div>}
        </div>
        {session.payment_ref && <div style={{ fontSize: 13, color: '#666', marginTop: 8 }}>Квитанція: {session.payment_ref}</div>}
      </div>

      {error && <div style={errorBox}>{error}</div>}

      <div style={{ display: 'grid', gap: 8, marginTop: 12 }}>
        {session.status === 'active' && (
          <button style={primaryBtn} disabled={busy} onClick={() => act(() => finishSession(session.id))}>
            Завершити сесію
          </button>
        )}
        {session.status === 'finished' && (
          <>
            <button style={primaryBtn} disabled={busy} onClick={() => act(() => paySession(session.id))}>
              Сплатити {formatMoney(session.amount_uah)}
            </button>
            <div style={{ fontSize: 12, color: '#666', textAlign: 'center' }}>
              Оплата — mock (прототип). У продукті: інтеграція через LiqPay / Приват24.
            </div>
          </>
        )}
        {session.status === 'paid' && (
          <button style={secondaryBtn} onClick={onNew}>
            Нова сесія
          </button>
        )}
      </div>
    </div>
  )
}
