import { FlaskIcon } from '@phosphor-icons/react'

/** Позначка «Симуляція»: нейтральна (не колір стану), іконка + текст. Ставимо на кожному блоці з симулятора. */
export default function SimBadge({ children = 'Симуляція' }: { children?: string }) {
  return (
    <span
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 4, color: 'var(--ink-2)', border: '1px solid var(--field-line)',
        fontSize: 11, fontWeight: 600, padding: '1px 8px', borderRadius: 999, verticalAlign: 'middle', whiteSpace: 'nowrap', lineHeight: 1.6,
      }}
    >
      <FlaskIcon size={12} weight="regular" aria-hidden />
      {children}
    </span>
  )
}
