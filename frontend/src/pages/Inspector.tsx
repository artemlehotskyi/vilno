import { useEffect, useMemo, useState } from 'react'
import { CircleNotchIcon } from '@phosphor-icons/react'
import { getLots, postScan, type Lot, type ScanOut } from '../api/client'
import LotPicker from '../components/LotPicker'
import Note from '../components/Note'
import PhotoButton from '../components/PhotoButton'
import PlateInput from '../components/PlateInput'
import ScanResultCard from '../components/ScanResultCard'
import { isValidPlate } from '../lib/plate'
import { page } from '../lib/ui'

const LOT_KEY = 'vilno.inspectorLot'

export default function Inspector() {
  const [lots, setLots] = useState<Lot[]>([])
  const [lotId, setLotId] = useState<number | null>(() => Number(localStorage.getItem(LOT_KEY)) || null)
  const [plate, setPlate] = useState('')
  const [fromCv, setFromCv] = useState(false) // номер підставлено з CV (і не змінено людиною)
  const [result, setResult] = useState<ScanOut | null>(null)
  const [scanned, setScanned] = useState<string | null>(null) // номер, для якого показано результат
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getLots().then(setLots).catch((e) => setError(e.message))
  }, [])

  const paid = useMemo(() => lots.filter((l) => l.is_paid), [lots])
  const lot = paid.find((l) => l.id === lotId) ?? paid[0] ?? null

  const choose = (id: number) => {
    setLotId(id)
    localStorage.setItem(LOT_KEY, String(id))
    setResult(null)
  }

  const check = async (plateOrNull: string | null) => {
    if (!lot) return
    setBusy(true)
    setError(null)
    try {
      setResult(await postScan(plateOrNull, lot.id, plateOrNull && fromCv ? 'cv' : 'manual'))
      setScanned(plateOrNull)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const reset = () => {
    setResult(null)
    setPlate('')
    setFromCv(false)
    setError(null)
  }

  const valid = isValidPlate(plate)

  return (
    <div style={page}>
      <LotPicker lots={paid} value={lot} onChange={choose} />

      {result && lot ? (
        <section style={{ marginTop: 20 }}>
          <ScanResultCard result={result} lot={lot} plate={scanned} />
          <div style={{ display: 'grid', gap: 8, marginTop: 20 }}>
            {result.status === 'unknown' && result.paid_now ? (
              <button className="btn btn-primary" onClick={() => setResult(null)}>Ввести номер</button>
            ) : (
              <>
                <button className="btn btn-primary" onClick={reset}>Новий скан</button>
                {scanned && (
                  <button className="btn btn-secondary" disabled={busy} aria-busy={busy} onClick={() => check(scanned)}>
                    {busy && <CircleNotchIcon size={20} weight="regular" className="spin" aria-hidden />}
                    Повторити скан
                  </button>
                )}
              </>
            )}
          </div>
        </section>
      ) : (
        <section style={{ marginTop: 20 }}>
          <h2 style={{ margin: '0 0 12px', fontSize: 16, fontWeight: 600 }}>Номер авто</h2>
          <PhotoButton
            primary={!valid}
            requireCar={false}
            label="Сфотографувати номер"
            onRecognized={(n) => {
              if (n.plate) {
                setPlate(n.plate)
                setFromCv(true)
              }
            }}
          />
          <div style={{ margin: '16px 0 0' }}>
            <PlateInput
              value={plate}
              hint="Перевірте, чи номер розпізнано правильно"
              onChange={(v) => {
                setPlate(v)
                setFromCv(false)
              }}
              onEnter={() => check(plate)}
            />
          </div>
          {error && <div style={{ marginTop: 8 }}><Note kind="error">{error}</Note></div>}

          <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid var(--line)' }}>
            <button
              className={`btn ${valid ? 'btn-primary' : 'btn-secondary'}`}
              style={valid ? undefined : { minHeight: 52 }}
              disabled={!valid || busy || !lot}
              aria-busy={busy}
              aria-describedby="check-hint"
              onClick={() => check(plate)}
            >
              {busy && <CircleNotchIcon size={20} weight="regular" className="spin" aria-hidden />}
              Перевірити статус
            </button>
            <div id="check-hint" style={{ minHeight: 20, marginTop: 6, fontSize: 13, color: 'var(--ink-2)', textAlign: 'center' }}>
              {valid ? '' : plate ? 'Номер ще не повний' : 'Введіть номер'}
            </div>
            <button className="btn btn-text" disabled={busy || !lot} onClick={() => check(null)}>
              Номер не читається
            </button>
          </div>
        </section>
      )}
    </div>
  )
}
