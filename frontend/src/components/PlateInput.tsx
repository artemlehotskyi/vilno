import { formatPlate, isValidPlate, normalizePlate } from '../lib/plate'

interface Props {
  value: string // нормалізований: 'AA1234BB'
  onChange: (normalized: string) => void
  onEnter?: () => void
  autoFocus?: boolean
}

/** Ручний ввід номера. Приймає кирилицю і латиницю, пробіли, дефіси. Працює без CV. */
export default function PlateInput({ value, onChange, onEnter, autoFocus }: Props) {
  const valid = isValidPlate(value)
  const showError = value.length >= 8 && !valid
  return (
    <div>
      <input
        value={formatPlate(value)}
        onChange={(e) => onChange(normalizePlate(e.target.value).slice(0, 8))}
        onKeyDown={(e) => e.key === 'Enter' && valid && onEnter?.()}
        placeholder="AA 1234 BB"
        autoFocus={autoFocus}
        autoCapitalize="characters"
        autoCorrect="off"
        spellCheck={false}
        aria-label="Номер автомобіля"
        style={{
          width: '100%', fontSize: 28, fontWeight: 700, letterSpacing: 2, textAlign: 'center',
          padding: '12px 8px', borderRadius: 10, background: '#fff', fontFamily: 'ui-monospace, monospace',
          border: `2px solid ${valid ? '#1f8a4c' : showError ? '#c0392b' : '#bbb'}`,
        }}
      />
      <div style={{ minHeight: 20, marginTop: 4, fontSize: 13, color: showError ? '#c0392b' : '#666' }}>
        {showError
          ? 'Формат: 2 літери, 4 цифри, 2 літери (літери A B C E H I K M O P T X, кирилиця теж ок)'
          : valid
            ? '✓ Номер у порядку'
            : 'Формат AA 1234 BB'}
      </div>
    </div>
  )
}
