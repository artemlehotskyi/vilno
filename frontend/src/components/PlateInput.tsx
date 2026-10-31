import { CheckCircleIcon, WarningCircleIcon } from '@phosphor-icons/react'
import { formatPlate, isValidPlate, normalizePlate } from '../lib/plate'

interface Props {
  value: string // нормалізований: 'AA1234BB'
  onChange: (normalized: string) => void
  onEnter?: () => void
  autoFocus?: boolean
  hint?: string // підпис під полем, коли помилки немає
}

/** Ручний ввід номера. Приймає кирилицю і латиницю, пробіли, дефіси. Працює без CV. */
export default function PlateInput({ value, onChange, onEnter, autoFocus, hint = 'Формат: AA 1234 BB' }: Props) {
  const valid = isValidPlate(value)
  const showError = value.length >= 8 && !valid
  return (
    <div>
      <div style={{ position: 'relative' }}>
        <input
          className={`plate-input${valid ? ' valid' : showError ? ' invalid' : ''}`}
          value={formatPlate(value)}
          onChange={(e) => onChange(normalizePlate(e.target.value).slice(0, 8))}
          onKeyDown={(e) => e.key === 'Enter' && valid && onEnter?.()}
          placeholder="AA 1234 BB"
          autoFocus={autoFocus}
          autoCapitalize="characters"
          autoCorrect="off"
          spellCheck={false}
          aria-label="Номер автомобіля"
          aria-invalid={showError}
        />
        {(valid || showError) && (
          <span style={{ position: 'absolute', right: 14, top: 0, bottom: 0, display: 'flex', alignItems: 'center', color: valid ? 'var(--free)' : 'var(--busy)' }}>
            {valid ? <CheckCircleIcon size={24} weight="regular" aria-label="Номер у порядку" /> : <WarningCircleIcon size={24} weight="regular" aria-hidden />}
          </span>
        )}
      </div>
      <div style={{ minHeight: 20, marginTop: 6, fontSize: 13, color: showError ? 'var(--busy)' : 'var(--ink-2)' }}>
        {showError ? 'Формат: 2 літери, 4 цифри, 2 літери' : hint}
      </div>
    </div>
  )
}
