import { useRef, useState } from 'react'
import { recognizePhoto, type Recognition } from '../api/client'
import { shrinkImage } from '../lib/image'
import { photoNote, type PhotoNote } from '../lib/photo'
import { errorBox, secondaryBtn } from '../lib/ui'

const COLORS = { ok: '#e3f4e8', warn: '#fdebd0', info: '#eef0f3' }

interface Props {
  requireCar: boolean
  onRecognized: (note: PhotoNote, r: Recognition) => void
  label?: string
}

/** Фото з камери телефона → /recognize (локальний CV). Фото нікуди не зберігається. Ручний ввід працює завжди. */
export default function PhotoButton({ requireCar, onRecognized, label = '📷 Сфотографувати' }: Props) {
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
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div style={{ marginBottom: 8 }}>
      <input
        ref={input} type="file" accept="image/*" capture="environment" hidden
        onChange={(e) => onFile(e.target.files?.[0])}
      />
      <button style={secondaryBtn} disabled={busy} onClick={() => input.current?.click()}>
        {busy ? 'Розпізнаю…' : label}
      </button>
      {note && <div style={{ background: COLORS[note.kind], padding: 10, borderRadius: 8, marginTop: 8, fontSize: 14 }}>{note.text}</div>}
      {error && <div style={errorBox}>{error}. Введіть номер вручну.</div>}
    </div>
  )
}
