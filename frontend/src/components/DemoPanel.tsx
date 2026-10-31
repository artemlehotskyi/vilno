import { useCallback, useEffect, useState } from 'react'
import { ClockIcon } from '@phosphor-icons/react'
import { demoAdvance, demoReset, getClock } from '../api/client'
import { formatKyivTime } from '../lib/format'

export const CLOCK_EVENT = 'vilno:clock'
const TOKEN_KEY = 'vilno.demoToken'
const STEPS: [string, number][] = [['+15 хв', 15], ['+30 хв', 30], ['+1 год', 60], ['+90 хв', 90], ['+4 год', 240]]

/** Демо-панель: серверний демо-годинник і скидання. Токен вводиться вручну (не вшитий у фронт). */
export default function DemoPanel() {
  const [open, setOpen] = useState(false)
  const [now, setNow] = useState<string | null>(null)
  const [token, setToken] = useState(() => sessionStorage.getItem(TOKEN_KEY) ?? '')
  const [msg, setMsg] = useState<string | null>(null)

  const refresh = useCallback(() => getClock().then((c) => setNow(c.now)).catch(() => {}), [])
  useEffect(() => {
    refresh()
    const id = setInterval(refresh, 5000)
    return () => clearInterval(id)
  }, [refresh])

  const run = async (action: () => Promise<unknown>) => {
    setMsg(null)
    try {
      await action()
      await refresh()
      window.dispatchEvent(new Event(CLOCK_EVENT))
    } catch (e) {
      setMsg((e as Error).message.includes('Token') ? 'Невірний токен' : (e as Error).message)
    }
  }

  const saveToken = (v: string) => {
    setToken(v)
    sessionStorage.setItem(TOKEN_KEY, v)
  }

  return (
    <div style={{ position: 'fixed', right: 8, bottom: 8, zIndex: 2000, maxWidth: 'calc(100vw - 16px)', display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
      {open && (
        <div style={{ background: '#fff', border: '1px solid var(--line)', borderRadius: 12, padding: 12, marginBottom: 6, width: 300, boxShadow: '0 4px 16px rgba(11,31,68,.12)' }}>
          <div style={{ fontWeight: 600, marginBottom: 6 }}>Демо-годинник</div>
          <input
            type="password" value={token} onChange={(e) => saveToken(e.target.value)} placeholder="X-Demo-Token"
            style={{ width: '100%', padding: 8, borderRadius: 8, border: '1px solid #bbb', marginBottom: 8 }}
          />
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {STEPS.map(([label, min]) => (
              <button key={min} onClick={() => run(() => demoAdvance(token, min))} style={{ padding: '0 12px', borderRadius: 8 }}>
                {label}
              </button>
            ))}
          </div>
          <button
            onClick={() => confirm('Скинути годинник і видалити всі демо-сесії?') && run(() => demoReset(token))}
            style={{ marginTop: 8, width: '100%', borderRadius: 8, color: '#c0392b' }}
          >
            Скинути демо
          </button>
          {msg && <div style={{ color: '#c0392b', fontSize: 13, marginTop: 6 }}>{msg}</div>}
        </div>
      )}
      <button
        onClick={() => setOpen((o) => !o)}
        style={{ borderRadius: 22, padding: '0 14px', background: 'var(--ink)', color: '#fff', border: 0, fontSize: 13, fontWeight: 500 }}
      >
        <ClockIcon size={16} weight="regular" style={{ verticalAlign: -3, marginRight: 6 }} />{now ? formatKyivTime(now) : '…'} · демо
      </button>
    </div>
  )
}
