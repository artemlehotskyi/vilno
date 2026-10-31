import { useCallback, useEffect, useRef, useState } from 'react'
import { finishSession, getSession, paySession, type Lot, type SessionOut } from '../api/client'
import { CLOCK_EVENT } from './DemoPanel'
import { ZONE_LABEL, formatDay, formatDuration, formatKyivTime, formatMoney, formatTimer } from '../lib/format'
import { CheckCircleIcon, CheckIcon, CircleNotchIcon, ReceiptIcon, TimerIcon } from '@phosphor-icons/react'
import { withMinDuration } from '../lib/minDelay'
import Note from './Note'

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

  // Старт/завершення/оплата: процес видно не менше ~1 с (мінімум лише на фронті)
  const act = async (fn: () => Promise<SessionOut>, ms = 700) => {
    setBusy(true)
    setError(null)
    try {
      onUpdate(await withMinDuration(fn(), ms))
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

  const status =
    session.status === 'active'
      ? { Icon: TimerIcon, color: 'var(--free)', text: 'Сесія триває' }
      : session.status === 'finished'
        ? { Icon: ReceiptIcon, color: 'var(--ink)', text: 'Сесію завершено · до сплати' }
        : { Icon: CheckCircleIcon, color: 'var(--free)', text: 'Сплачено' }

  const spinner = <CircleNotchIcon size={20} weight="regular" className="spin" aria-hidden />

  return (
    <div className="screen-in">
      <h2 style={{ margin: 0, fontSize: 20, fontWeight: 600, overflowWrap: 'anywhere' }}>{lot.address}</h2>
      <div style={{ marginTop: 2, fontSize: 14, color: 'var(--ink-2)' }}>
        {lot.zone && `${ZONE_LABEL[lot.zone]} · `}{lot.tariff_per_hour} грн/год · початок {formatKyivTime(session.started_at)}
      </div>
      {session.capture_method === 'fallback' && (
        <div style={{ marginTop: 8 }}><Note kind="warn">Фото не перевірено: розпізнавання було недоступне.</Note></div>
      )}

      <div style={{ marginTop: 20, paddingTop: 20, borderTop: '1px solid var(--line)', textAlign: 'center' }}>
        <div key={session.status} className="status-in" role="status" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, color: status.color, fontSize: 15, fontWeight: 600 }}>
          <status.Icon size={22} weight="regular" className="pop-in" aria-hidden />
          {status.text}
        </div>
        <div style={{ marginTop: 8, fontSize: 44, fontWeight: 600, lineHeight: 1.1 }}>{formatTimer(elapsed)}</div>
        <div style={{ marginTop: 4, fontSize: 28, fontWeight: 600 }}>
          {formatMoney(session.amount_uah)}
          {!session.is_final && <span style={{ fontSize: 14, fontWeight: 400, color: 'var(--ink-2)' }}> поки що</span>}
        </div>
      </div>

      <div style={{ marginTop: 20, borderTop: '1px solid var(--line)', fontSize: 14 }}>
        {session.breakdown.length === 0 ? (
          <div style={{ padding: '12px 0', color: 'var(--ink-2)' }}>
            {lot.open_now === false
              ? `Поза годинами платного паркування (${lot.opening_hours ? `${lot.opening_hours.from}–${lot.opening_hours.to}` : '—'}): безкоштовно.`
              : 'Оплата нараховується по хвилинах: перша хвилина ще не минула.'}
          </div>
        ) : (
          session.breakdown.map((p) => (
            <div key={p.day} style={{ padding: '12px 0', borderBottom: '1px solid var(--line)' }}>
              {formatDay(p.day)}: {formatDuration(p.minutes)} × {lot.tariff_per_hour} грн/год = {formatMoney(p.raw)}
              {p.capped && p.cap != null && (
                <div style={{ color: 'var(--free)', display: 'flex', gap: 6, alignItems: 'center', marginTop: 4 }}>
                  <CheckIcon size={16} weight="regular" aria-hidden />
                  Денний ліміт {formatMoney(p.cap)}: платите {formatMoney(p.amount)}
                </div>
              )}
            </div>
          ))
        )}
        {saved > 0 && (
          <div style={{ padding: '12px 0', color: 'var(--free)', fontWeight: 600, display: 'flex', gap: 6, alignItems: 'center', borderBottom: '1px solid var(--line)' }}>
            <CheckIcon size={16} weight="regular" aria-hidden />
            Ліміт зекономив вам {formatMoney(saved)}
          </div>
        )}
        {lot.zone === 'center' && <div style={{ padding: '12px 0', color: 'var(--ink-2)' }}>Центр: без денного ліміту (щоб місця оберталися).</div>}
        {session.payment_ref && <div style={{ padding: '4px 0 0', fontSize: 13, color: 'var(--ink-2)' }}>Квитанція: {session.payment_ref}</div>}
      </div>

      {error && <div style={{ marginTop: 12 }}><Note kind="error">{error}</Note></div>}

      <div style={{ display: 'grid', gap: 8, marginTop: 20 }}>
        {session.status === 'active' && (
          <button className="btn btn-primary" disabled={busy} aria-busy={busy} onClick={() => act(() => finishSession(session.id))}>
            {busy && spinner}
            {busy ? 'Завершуємо…' : 'Завершити сесію'}
          </button>
        )}
        {session.status === 'finished' && (
          <>
            <button className="btn btn-primary" disabled={busy} aria-busy={busy} onClick={() => act(() => paySession(session.id), 1000)}>
              {busy && spinner}
              {busy ? 'Обробляємо оплату…' : `Сплатити ${formatMoney(session.amount_uah)}`}
            </button>
            <div style={{ fontSize: 12, color: 'var(--ink-2)', textAlign: 'center' }}>
              Оплата — mock (прототип). У продукті: інтеграція через LiqPay / Приват24.
            </div>
          </>
        )}
        {session.status === 'paid' && (
          <button className="btn btn-secondary" onClick={onNew}>Нова сесія</button>
        )}
      </div>
    </div>
  )
}
