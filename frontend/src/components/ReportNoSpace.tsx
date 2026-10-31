import { useState } from 'react'
import { CheckCircleIcon, CircleNotchIcon, WarningCircleIcon } from '@phosphor-icons/react'
import { sendReport } from '../api/client'
import { getClientId } from '../lib/clientId'
import { isValidPlate } from '../lib/plate'
import { errorBox } from '../lib/ui'
import PlateInput from './PlateInput'

/** «Місць немає? Повідомити»: сигнал диспетчеру. Не штраф і не перевірка чужого номера. Відповідь сервера завжди {ok: true}. */
export default function ReportNoSpace({ lotId }: { lotId: number }) {
  const [open, setOpen] = useState(false)
  const [plate, setPlate] = useState('')
  const [sent, setSent] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (sent) {
    return (
      <div role="status" style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8, minHeight: 48, color: 'var(--free)', fontSize: 14, fontWeight: 500 }}>
        <CheckCircleIcon size={20} weight="regular" aria-hidden />
        Дякуємо, сигнал передано
      </div>
    )
  }
  if (!open) {
    return (
      <button className="btn btn-problem" style={{ marginTop: 8 }} onClick={() => setOpen(true)}>
        <WarningCircleIcon size={20} weight="regular" aria-hidden />
        Місць немає? Повідомити
      </button>
    )
  }

  const plateOk = plate === '' || isValidPlate(plate)
  const send = async () => {
    setBusy(true)
    setError(null)
    try {
      await sendReport(lotId, plate || null, getClientId())
      setSent(true)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div style={{ marginTop: 8 }}>
      <div style={{ fontSize: 13, color: 'var(--ink-2)', marginBottom: 8 }}>
        Номер авто, яке стоїть без оплати (необов'язково). Це сигнал диспетчеру, не штраф: результат перевірки ми не показуємо.
      </div>
      <PlateInput value={plate} onChange={setPlate} />
      {error && <div style={errorBox}>{error}</div>}
      <button className="btn btn-problem" disabled={!plateOk || busy} aria-busy={busy} onClick={send}>
        {busy ? <CircleNotchIcon size={20} weight="regular" className="spin" aria-hidden /> : <WarningCircleIcon size={20} weight="regular" aria-hidden />}
        Надіслати сигнал
      </button>
      <button className="btn btn-text" disabled={busy} onClick={() => { setOpen(false); setPlate('') }}>Скасувати</button>
    </div>
  )
}
