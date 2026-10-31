import { useRef, useState } from 'react'
import { CameraIcon, CircleNotchIcon } from '@phosphor-icons/react'
import { recognizePhoto, type Recognition } from '../api/client'
import { shrinkImage } from '../lib/image'
import { failedNote, photoNote, type PhotoNote } from '../lib/photo'
import Note from './Note'

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

  const onFile = async (file: File | undefined) => {
    if (input.current) input.current.value = ''
    if (!file) return
    setBusy(true)
    setError(null)
    try {
      let blob: Blob = file
      try {
        blob = await shrinkImage(file)
      } catch {
        /* формат, який браузер не вміє стискати: шлемо як є */
      }
      const r = await recognizePhoto(blob)
      const n = photoNote(r, requireCar)
      setNote(n)
      onRecognized(n, r)
    } catch (e) {
      // 422 «не вдалося прочитати зображення» — це не падіння CV, просимо інше фото
      if ((e as Error).message.includes('прочитати')) setError((e as Error).message)
      else {
        setNote(failedNote)
        onRecognized(failedNote, null)
      }
    } finally {
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
      {note && <div style={{ marginTop: 10 }}><Note kind={note.kind}>{note.text}</Note></div>}
      {error && <div style={{ marginTop: 10 }}><Note kind="error">{error}. Введіть номер вручну.</Note></div>}
    </div>
  )
}
