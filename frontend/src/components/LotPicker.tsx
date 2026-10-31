import { useEffect, useRef, useState } from 'react'
import { CaretDownIcon, CheckIcon, XIcon } from '@phosphor-icons/react'
import type { Lot } from '../api/client'
import { ZONE_LABEL } from '../lib/format'

const ZONES = ['center', 'standard', 'market'] as const

interface Props {
  lots: Lot[] // платні
  value: Lot | null
  onChange: (id: number) => void
}

/** Вибір майданчика: рядок із поточним майданчиком + нижній аркуш зі списком (замість нативного select). */
export default function LotPicker({ lots, value, onChange }: Props) {
  const [open, setOpen] = useState(false)
  const trigger = useRef<HTMLButtonElement>(null)
  const sheet = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const prevOverflow = document.body.style.overflow
    const opener = trigger.current
    document.body.style.overflow = 'hidden'
    // фокус на обраний пункт (список прокрутиться до нього), інакше на сам аркуш, а не на кнопку «закрити»
    const target = sheet.current?.querySelector<HTMLElement>('[aria-current="true"]') ?? sheet.current
    target?.focus()
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = prevOverflow
      window.removeEventListener('keydown', onKey)
      opener?.focus()
    }
  }, [open])

  const pick = (id: number) => {
    onChange(id)
    setOpen(false)
  }

  return (
    <>
      <button
        ref={trigger}
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        aria-expanded={open}
        style={{
          all: 'unset', boxSizing: 'border-box', width: '100%', minHeight: 64, display: 'flex', alignItems: 'center', gap: 12,
          cursor: 'pointer', padding: '10px 0', borderBottom: '1px solid var(--line)',
        }}
      >
        <span style={{ flex: 1, minWidth: 0 }}>
          <span style={{ display: 'block', fontSize: 12, fontWeight: 500, color: 'var(--ink-2)' }}>Майданчик</span>
          <span style={{ display: 'block', fontSize: 16, fontWeight: 600, overflowWrap: 'anywhere' }}>
            {value ? value.address : 'Оберіть майданчик'}
          </span>
          {value && <span style={{ display: 'block', fontSize: 13, color: 'var(--ink-2)' }}>{value.tariff_per_hour} грн/год</span>}
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 14, fontWeight: 500, color: 'var(--ink-2)' }}>
          Змінити <CaretDownIcon size={16} weight="regular" aria-hidden />
        </span>
      </button>

      {open && (
        <>
          <div className="sheet-backdrop" onClick={() => setOpen(false)} />
          <div ref={sheet} className="sheet" tabIndex={-1} style={{ outline: 'none' }} role="dialog" aria-modal="true" aria-label="Оберіть майданчик">
            <div style={{ display: 'flex', alignItems: 'center', padding: '8px 8px 8px 16px', borderBottom: '1px solid var(--line)' }}>
              <h2 style={{ flex: 1, margin: 0, fontSize: 16, fontWeight: 600 }}>Майданчик</h2>
              <button onClick={() => setOpen(false)} aria-label="Закрити" style={{ width: 44, height: 44, border: 0, background: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <XIcon size={20} weight="regular" />
              </button>
            </div>
            <div style={{ overflowY: 'auto', padding: '0 16px 24px' }}>
              {ZONES.map((z) => {
                const group = lots.filter((l) => l.zone === z)
                if (group.length === 0) return null
                return (
                  <div key={z}>
                    <div style={{ padding: '16px 0 4px', fontSize: 12, fontWeight: 600, color: 'var(--ink-2)' }}>{ZONE_LABEL[z]}</div>
                    {group.map((l) => {
                      const selected = l.id === value?.id
                      return (
                        <button
                          key={l.id}
                          onClick={() => pick(l.id)}
                          aria-current={selected}
                          style={{
                            all: 'unset', boxSizing: 'border-box', width: '100%', minHeight: 48, display: 'flex', alignItems: 'center', gap: 12,
                            cursor: 'pointer', borderBottom: '1px solid var(--line)', fontSize: 15, fontWeight: selected ? 600 : 400,
                          }}
                        >
                          <span style={{ flex: 1, minWidth: 0, overflowWrap: 'anywhere' }}>{l.address}</span>
                          <span style={{ color: 'var(--ink-2)', fontSize: 13 }}>{l.tariff_per_hour} грн/год</span>
                          <span style={{ width: 20, display: 'flex' }}>{selected && <CheckIcon size={20} weight="regular" aria-label="Обрано" />}</span>
                        </button>
                      )
                    })}
                  </div>
                )
              })}
              <div style={{ marginTop: 16, fontSize: 12, color: 'var(--ink-2)' }}>Зони виведено з ціни: це припущення, у наборі даних їх немає.</div>
            </div>
          </div>
        </>
      )}
    </>
  )
}
