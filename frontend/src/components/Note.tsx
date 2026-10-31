import type { ReactNode } from 'react'
import { CheckCircleIcon, InfoIcon, WarningCircleIcon, XCircleIcon } from '@phosphor-icons/react'

export type NoteKind = 'ok' | 'warn' | 'info' | 'error'

const KIND = {
  ok: { color: 'var(--free)', Icon: CheckCircleIcon },
  warn: { color: 'var(--warn)', Icon: WarningCircleIcon },
  info: { color: 'var(--ink-2)', Icon: InfoIcon },
  error: { color: 'var(--busy)', Icon: XCircleIcon },
} as const

/** Повідомлення без рамки й заливки: іконка + текст у кольорі стану (колір не єдиний носій). */
export default function Note({ kind, children }: { kind: NoteKind; children: ReactNode }) {
  const { color, Icon } = KIND[kind]
  return (
    <div role={kind === 'error' ? 'alert' : 'status'} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', color, fontSize: 14, fontWeight: 500, lineHeight: 1.4 }}>
      <Icon size={20} weight="regular" aria-hidden style={{ flex: '0 0 auto', marginTop: 1 }} />
      <span>{children}</span>
    </div>
  )
}
