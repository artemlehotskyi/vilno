import { CheckIcon, MoonIcon, XIcon } from '@phosphor-icons/react'

const item = { display: 'inline-flex', alignItems: 'center', gap: 4 } as const

/** Підпис під мапою: що означають форми маркерів і що числа — оцінка із симуляції. */
export default function MapCaption() {
  return (
    <div
      style={{
        flex: '0 0 auto', padding: '10px 16px 12px', borderTop: '1px solid var(--line)', background: 'var(--bg)',
        fontSize: 12, fontWeight: 500, color: 'var(--ink-2)',
      }}
    >
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 14px' }}>
        <span style={{ ...item, color: 'var(--free)' }}><CheckIcon size={14} weight="regular" />є місця</span>
        <span style={{ ...item, color: 'var(--busy)' }}><XIcon size={14} weight="regular" />немає місць</span>
        <span style={{ ...item, color: 'var(--neutral)' }}><MoonIcon size={14} weight="regular" />безкоштовно / не діє</span>
      </div>
      {/* правий край другого рядка лишається вільним під кнопку демо-годинника */}
      <div style={{ marginTop: 6, minHeight: 36, display: 'flex', alignItems: 'center', paddingRight: 220 }}>оцінка · симуляція</div>
    </div>
  )
}
