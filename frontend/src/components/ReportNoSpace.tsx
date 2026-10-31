import { useState } from 'react'
import { sendReport } from '../api/client'
import { getClientId } from '../lib/clientId'
import { isValidPlate } from '../lib/plate'
import { errorBox, primaryBtn, secondaryBtn } from '../lib/ui'
import PlateInput from './PlateInput'

/** «Місць насправді немає»: сигнал диспетчеру. Не штраф і не перевірка чужого номера. */
export default function ReportNoSpace({ lotId }: { lotId: number }) {
  const [open, setOpen] = useState(false)
  const [plate, setPlate] = useState('')
  const [sent, setSent] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (sent) return <div style={{ background: '#e3f4e8', padding: 10, borderRadius: 8, marginTop: 8 }}>Дякуємо, сигнал передано.</div>
  if (!open) {
    return (
      <button style={{ ...secondaryBtn, marginTop: 8 }} onClick={() => setOpen(true)}>
        Місць насправді немає
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
      <div style={{ fontSize: 13, color: '#555', marginBottom: 6 }}>
        Номер авто, яке, на вашу думку, стоїть без оплати (необов'язково). Результат перевірки вам не показуємо: це сигнал диспетчеру, не штраф.
      </div>
      <PlateInput value={plate} onChange={setPlate} />
      {error && <div style={errorBox}>{error}</div>}
      <button style={{ ...primaryBtn, opacity: plateOk ? 1 : 0.5 }} disabled={!plateOk || busy} onClick={send}>
        Надіслати сигнал
      </button>
    </div>
  )
}
