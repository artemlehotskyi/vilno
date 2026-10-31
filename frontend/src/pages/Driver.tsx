import { useCallback, useEffect, useState } from 'react'
import { getLots, getSession, startSession, type Lot, type SessionOut } from '../api/client'
import LotSummary from '../components/LotSummary'
import LotsMap from '../components/LotsMap'
import MapLegend from '../components/MapLegend'
import PhotoButton from '../components/PhotoButton'
import PlateInput from '../components/PlateInput'
import SessionView from '../components/SessionView'
import { canStart, type PhotoNote } from '../lib/photo'
import { isValidPlate } from '../lib/plate'
import { card, errorBox, page, primaryBtn, secondaryBtn } from '../lib/ui'

const SESSION_KEY = 'vilno.sessionId'

export default function Driver() {
  const [lots, setLots] = useState<Lot[]>([])
  const [selected, setSelected] = useState<Lot | null>(null)
  const [entering, setEntering] = useState(false) // екран вводу номера
  const [plate, setPlate] = useState('')
  const [photo, setPhoto] = useState<PhotoNote | null>(null) // старт лише після фото з авто або fallback
  const [session, setSession] = useState<SessionOut | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    getLots().then(setLots).catch((e) => setError(e.message))
    const id = localStorage.getItem(SESSION_KEY)
    if (id) {
      getSession(id)
        .then(setSession)
        .catch(() => localStorage.removeItem(SESSION_KEY))
    }
  }, [])

  const newSession = useCallback(() => {
    localStorage.removeItem(SESSION_KEY)
    setSession(null)
    setEntering(false)
    setSelected(null)
    setPlate('')
    setPhoto(null)
    setError(null)
    getLots().then(setLots).catch(() => {}) // оновити «вільно ≈»
  }, [])

  const start = async () => {
    if (!selected) return
    setBusy(true)
    setError(null)
    try {
      const s = await startSession(plate, selected.id, photo?.carToken ?? null)
      localStorage.setItem(SESSION_KEY, s.id)
      setSession(s)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  // --- активна/завершена сесія ---
  if (session) {
    const lot = lots.find((l) => l.id === session.lot_id)
    return (
      <div style={page}>
        {lot ? <SessionView session={session} lot={lot} onUpdate={setSession} onNew={newSession} /> : 'Завантаження…'}
      </div>
    )
  }

  // --- екран вводу номера ---
  if (entering && selected) {
    return (
      <div style={page}>
        <button style={{ ...secondaryBtn, width: 'auto', padding: '0 16px', marginBottom: 12 }} onClick={() => { setEntering(false); setPhoto(null) }}>
          ← До мапи
        </button>
        <div style={{ ...card, marginBottom: 12 }}>
          <LotSummary lot={selected} />
        </div>
        <PhotoButton
          requireCar
          label={photo ? '📷 Сфотографувати ще раз' : '📷 Сфотографувати авто'}
          onRecognized={(n) => {
            setPhoto(n)
            if (n.plate) setPlate(n.plate)
          }}
        />
        <PlateInput value={plate} onChange={setPlate} onEnter={() => canStart(photo?.gate ?? null) && start()} autoFocus />
        {error && <div style={errorBox}>{error}</div>}
        {(() => {
          const ready = isValidPlate(plate) && canStart(photo?.gate ?? null)
          return (
            <>
              <button style={{ ...primaryBtn, marginTop: 8, opacity: ready ? 1 : 0.5 }} disabled={!ready || busy} onClick={start}>
                Почати паркування
              </button>
              {!canStart(photo?.gate ?? null) && (
                <div style={{ fontSize: 13, color: '#666', marginTop: 6, textAlign: 'center' }}>
                  {photo?.gate === 'nocar' ? 'Старт заблоковано: на фото немає авто.' : 'Спершу сфотографуйте авто.'}
                </div>
              )}
              {photo?.gate === 'fallback' && (
                <div style={{ fontSize: 13, color: '#8a5a00', marginTop: 6, textAlign: 'center' }}>Фото не перевірено: сесію буде позначено.</div>
              )}
            </>
          )
        })()}
      </div>
    )
  }

  // --- мапа + вибір майданчика ---
  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      <LotsMap lots={lots} selectedId={selected?.id} onSelect={setSelected} />
      <MapLegend />
      {error && <div style={{ ...errorBox, position: 'absolute', top: 8, left: 8, right: 8, zIndex: 1000 }}>Не вдалося завантажити: {error}</div>}
      <div
        style={{
          position: 'absolute', left: 0, right: 0, bottom: 0, zIndex: 1000, background: '#fff',
          borderRadius: '16px 16px 0 0', padding: '14px 16px 64px', boxShadow: '0 -2px 10px rgba(0,0,0,.2)',
        }}
      >
        {selected ? (
          <>
            <LotSummary lot={selected} />
            {selected.is_paid && selected.free_estimate != null && (
              <div style={{ fontSize: 13, color: '#666', marginTop: 4 }}>Вільно ≈ {selected.free_estimate} (оцінка · симуляція)</div>
            )}
            <button
              style={{ ...primaryBtn, marginTop: 10, opacity: selected.is_paid ? 1 : 0.5 }}
              disabled={!selected.is_paid}
              onClick={() => setEntering(true)}
            >
              {selected.is_paid ? 'Припаркуватись тут' : 'Безкоштовно: сесія не потрібна'}
            </button>
          </>
        ) : (
          <div style={{ color: '#666' }}>Оберіть майданчик на мапі, щоб почати паркування.</div>
        )}
      </div>
    </div>
  )
}
