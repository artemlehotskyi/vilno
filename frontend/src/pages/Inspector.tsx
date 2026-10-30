import { useEffect, useMemo, useState } from 'react'
import { getLots, postScan, type Lot, type ScanOut } from '../api/client'
import PhotoButton from '../components/PhotoButton'
import PlateInput from '../components/PlateInput'
import ScanResultCard from '../components/ScanResultCard'
import { ZONE_LABEL } from '../lib/format'
import { isValidPlate } from '../lib/plate'
import { card, errorBox, page, primaryBtn, secondaryBtn } from '../lib/ui'

const LOT_KEY = 'vilno.inspectorLot'
const ZONES = ['center', 'standard', 'market'] as const

export default function Inspector() {
  const [lots, setLots] = useState<Lot[]>([])
  const [lotId, setLotId] = useState<number | null>(() => Number(localStorage.getItem(LOT_KEY)) || null)
  const [plate, setPlate] = useState('')
  const [fromCv, setFromCv] = useState(false) // номер підставлено з CV (і не змінено людиною)
  const [result, setResult] = useState<ScanOut | null>(null)
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

  return (
    <div style={page}>
      <label style={{ fontSize: 13, color: '#666' }}>Майданчик, де ви зараз</label>
      <select
        value={lot?.id ?? ''}
        onChange={(e) => choose(Number(e.target.value))}
        style={{ width: '100%', minHeight: 48, borderRadius: 10, border: '1px solid #bbb', padding: '0 8px', marginBottom: 12, fontSize: 16 }}
      >
        {ZONES.map((z) => (
          <optgroup key={z} label={`${ZONE_LABEL[z]} (зона — припущення)`}>
            {paid.filter((l) => l.zone === z).map((l) => (
              <option key={l.id} value={l.id}>
                {l.address} · {l.tariff_per_hour} грн
              </option>
            ))}
          </optgroup>
        ))}
      </select>

      {result && lot ? (
        <>
          <ScanResultCard result={result} lot={lot} />
          <button style={{ ...primaryBtn, marginTop: 12 }} onClick={reset}>
            Новий скан
          </button>
          <button style={{ ...secondaryBtn, marginTop: 8 }} disabled={busy} onClick={() => check(plate || null)}>
            Повторити скан цього номера
          </button>
        </>
      ) : (
        <div style={card}>
          <div style={{ marginBottom: 8, fontWeight: 600 }}>Номер авто (підтвердіть самі)</div>
          <PhotoButton
            requireCar={false}
            label="📷 Сфотографувати номер"
            onRecognized={(n) => {
              if (n.plate) {
                setPlate(n.plate)
                setFromCv(true)
              }
            }}
          />
          <PlateInput
            value={plate}
            onChange={(v) => {
              setPlate(v)
              setFromCv(false)
            }}
            onEnter={() => check(plate)}
          />
          {error && <div style={errorBox}>{error}</div>}
          <button
            style={{ ...primaryBtn, opacity: isValidPlate(plate) ? 1 : 0.5 }}
            disabled={!isValidPlate(plate) || busy || !lot}
            onClick={() => check(plate)}
          >
            Перевірити статус
          </button>
          <button style={{ ...secondaryBtn, marginTop: 8 }} disabled={busy || !lot} onClick={() => check(null)}>
            Номер не видно / нечитабельний
          </button>
        </div>
      )}
    </div>
  )
}
