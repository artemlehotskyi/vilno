import { useCallback, useEffect, useState } from 'react'
import { getLots, getSession, getStreets, startSession, type Lot, type SessionOut, type Street } from '../api/client'
import LotSummary from '../components/LotSummary'
import LotsMap from '../components/LotsMap'
import LotPanel from '../components/LotPanel'
import MapCaption from '../components/MapCaption'
import PhotoButton from '../components/PhotoButton'
import PlateInput from '../components/PlateInput'
import SessionView from '../components/SessionView'
import { ArrowLeftIcon, CircleNotchIcon } from '@phosphor-icons/react'
import Note from '../components/Note'
import { canStart, type PhotoNote } from '../lib/photo'
import { isValidPlate } from '../lib/plate'
import { errorBox, page } from '../lib/ui'
import { withMinDuration } from '../lib/minDelay'

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
      const s = await withMinDuration(startSession(plate, selected.id, photo?.carToken ?? null), 700)
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
    const gateOk = canStart(photo?.gate ?? null)
    const ready = isValidPlate(plate) && gateOk
    return (
      <div style={page} className="screen-in">
        <button className="btn btn-text" style={{ width: 'auto', justifyContent: 'flex-start', padding: 0, minHeight: 44 }} onClick={() => { setEntering(false); setPhoto(null) }}>
          <ArrowLeftIcon size={20} weight="regular" aria-hidden />
          До мапи
        </button>
        <div style={{ paddingBottom: 16, borderBottom: '1px solid var(--line)', marginBottom: 20 }}>
          <LotSummary lot={selected} />
        </div>
        <PhotoButton
          primary={!ready}
          requireCar
          label={photo ? 'Сфотографувати ще раз' : 'Сфотографувати авто'}
          onRecognized={(n) => {
            setPhoto(n)
            if (n.plate) setPlate(n.plate)
          }}
        />
        <div style={{ marginTop: 16 }}>
          <PlateInput value={plate} onChange={setPlate} onEnter={() => gateOk && start()} hint="Перевірте, чи номер розпізнано правильно" />
        </div>
        {error && <div style={{ marginBottom: 8 }}><Note kind="error">{error}</Note></div>}
        <div style={{ marginTop: 8, paddingTop: 16, borderTop: '1px solid var(--line)' }}>
          <button className={`btn ${ready ? 'btn-primary' : 'btn-secondary'}`} disabled={!ready || busy} aria-busy={busy} aria-describedby="start-hint" onClick={start}>
            {busy && <CircleNotchIcon size={20} weight="regular" className="spin" aria-hidden />}
            {busy ? 'Починаємо…' : 'Почати паркування'}
          </button>
          <div id="start-hint" style={{ minHeight: 20, marginTop: 6, fontSize: 13, color: 'var(--ink-2)', textAlign: 'center' }}>
            {ready ? '' : photo?.gate === 'nocar' ? 'Старт заблоковано: на фото немає авто' : !gateOk ? 'Спершу сфотографуйте авто' : 'Введіть номер'}
          </div>
          {photo?.gate === 'fallback' && <div style={{ marginTop: 8 }}><Note kind="warn">Фото не перевірено: сесію буде позначено.</Note></div>}
        </div>
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
