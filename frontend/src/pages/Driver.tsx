import { useCallback, useEffect, useState } from 'react'
import { getLots, getSession, getStreets, startSession, type Lot, type SessionOut, type Street } from '../api/client'
import LotSummary from '../components/LotSummary'
import LotsMap from '../components/LotsMap'
import LotPanel from '../components/LotPanel'
import MapCaption from '../components/MapCaption'
import PhotoButton from '../components/PhotoButton'
import PlateInput from '../components/PlateInput'
import SessionView from '../components/SessionView'
import { canStart, type PhotoNote } from '../lib/photo'
import { isValidPlate } from '../lib/plate'
import { card, errorBox, page, primaryBtn, secondaryBtn } from '../lib/ui'

const SESSION_KEY = 'vilno.sessionId'

export default function Driver() {
  const [lots, setLots] = useState<Lot[]>([])
  const [streets, setStreets] = useState<Record<string, Street>>({})
  const [tilesReady, setTilesReady] = useState(false)
  const [lotsReady, setLotsReady] = useState(false)
  const [selected, setSelected] = useState<Lot | null>(null)
  const [entering, setEntering] = useState(false) // екран вводу номера
  const [plate, setPlate] = useState('')
  const [photo, setPhoto] = useState<PhotoNote | null>(null) // старт лише після фото з авто або fallback
  const [session, setSession] = useState<SessionOut | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    const t = setTimeout(() => setTilesReady(true), 5000) // тайли не прийшли (офлайн): не тримаємо індикатор вічно
    getLots().then((l) => { setLots(l); setLotsReady(true) }).catch((e) => { setError(e.message); setLotsReady(true) })
    getStreets().then(setStreets).catch(() => {}) // немає кешу → лінія через точки лота
    const id = localStorage.getItem(SESSION_KEY)
    if (id) {
      getSession(id)
        .then(setSession)
        .catch(() => localStorage.removeItem(SESSION_KEY))
    }
    return () => clearTimeout(t)
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
  const loading = !(tilesReady && lotsReady)
  return (
    <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column' }}>
      <div style={{ flex: 1, minHeight: 0, position: 'relative' }}>
        {loading && <div className="map-loading" role="progressbar" aria-label="Завантаження мапи" />}
        <LotsMap
          lots={lots}
          streets={streets}
          selectedId={selected?.id}
          onSelect={setSelected}
          onDeselect={() => setSelected(null)}
          onReady={() => setTilesReady(true)}
        />
        {error && <div style={{ ...errorBox, position: 'absolute', top: 8, left: 8, right: 8, zIndex: 1000 }}>Не вдалося завантажити: {error}</div>}
        {selected && <LotPanel lot={selected} onPark={() => setEntering(true)} onClose={() => setSelected(null)} />}
      </div>
      <MapCaption />
    </div>
  )
}
