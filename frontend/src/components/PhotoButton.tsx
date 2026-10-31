import { useRef, useState } from 'react'
import { CameraIcon, CircleNotchIcon } from '@phosphor-icons/react'
import { recognizePhoto, type Recognition } from '../api/client'
import { shrinkImage } from '../lib/image'
import { failedNote, photoNote, type PhotoNote } from '../lib/photo'
import { sleep, withMinDuration } from '../lib/minDelay'
import Note from './Note'
import RecognitionSteps, { type Step } from './RecognitionSteps'

const STEPS_RUNNING: Step[][] = [
  [{ label: 'Шукаємо авто', state: 'active' }, { label: 'Читаємо номер', state: 'pending' }, { label: 'Готово', state: 'pending' }],
  [{ label: 'Шукаємо авто', state: 'ok' }, { label: 'Читаємо номер', state: 'active' }, { label: 'Готово', state: 'pending' }],
]

/** Підсумок за справжньою відповіддю CV: що знайшли, що ні. */
function finalSteps(r: Recognition): Step[] {
  const car: Step =
    !r.enabled || r.car_present === null ? { label: 'Авто: розпізнавання недоступне', state: 'warn' }
    : r.car_present ? { label: 'Авто знайдено', state: 'ok' }
    : { label: 'Авто не знайдено', state: 'fail' }
  const plate: Step = r.plate ? { label: 'Номер прочитано', state: 'ok' } : { label: 'Номер не розпізнано впевнено', state: 'warn' }
  return [car, plate, { label: 'Готово', state: 'ok' }]
}

interface Props {
  requireCar: boolean
  onRecognized: (note: PhotoNote, r: Recognition | null) => void // r=null: запит упав
  label?: string
  primary?: boolean // головна дія екрана: суцільна синя; інакше контурна
}

/** Фото з камери телефона → /recognize (локальний CV). Фото нікуди не зберігається. Ручний ввід працює завжди. */
export default function PhotoButton({ requireCar, onRecognized, label = 'Сфотографувати', primary = false }: Props) {
  const input = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState<PhotoNote | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [steps, setSteps] = useState<Step[] | null>(null)
  const [leaving, setLeaving] = useState(false)

  const onFile = async (file: File | undefined) => {
    if (input.current) input.current.value = ''
    if (!file) return
    setBusy(true)
    setError(null)
    setNote(null)
    setLeaving(false)
    setSteps(STEPS_RUNNING[0])
    // Етапи реальні (YOLO → ALPR), але CV відповідає за ~100 мс: показуємо їх не менше ~1 с
    const second = setTimeout(() => setSteps(STEPS_RUNNING[1]), 450)
    try {
      let blob: Blob = file
      try {
        blob = await shrinkImage(file)
      } catch {
        /* формат, який браузер не вміє стискати: шлемо як є */
      }
      const r = await withMinDuration(recognizePhoto(blob))
      const n = photoNote(r, requireCar)
      setSteps(finalSteps(r))
      await sleep(550) // дати побачити підсумок етапів
      setLeaving(true)
      await sleep(200)
      setSteps(null)
      setNote(n)
      onRecognized(n, r)
    } catch (e) {
      setSteps(null)
      // 422 «не вдалося прочитати зображення» — це не падіння CV, просимо інше фото
      if ((e as Error).message.includes('прочитати')) setError((e as Error).message)
      else {
        setNote(failedNote)
        onRecognized(failedNote, null)
      }
    } finally {
      clearTimeout(second)
      setBusy(false)
    }
  }

  return (
    <div>
      <input
        ref={input} type="file" accept="image/*" capture="environment" hidden
        onChange={(e) => onFile(e.target.files?.[0])}
      />
      <button
        className={`btn ${primary ? 'btn-primary' : 'btn-secondary'}`}
        style={primary ? { minHeight: 56 } : undefined}
        disabled={busy}
        aria-busy={busy}
        onClick={() => input.current?.click()}
      >
        {busy ? <CircleNotchIcon size={22} weight="regular" className="spin" aria-hidden /> : <CameraIcon size={22} weight="regular" aria-hidden />}
        {busy ? 'Розпізнаю…' : label}
      </button>
      {steps && <RecognitionSteps steps={steps} leaving={leaving} />}
      {note && <div style={{ marginTop: 10 }}><Note kind={note.kind}>{note.text}</Note></div>}
      {error && <div style={{ marginTop: 10 }}><Note kind="error">{error}. Введіть номер вручну.</Note></div>}
    </div>
  )
}
