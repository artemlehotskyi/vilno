import type { ReactNode } from 'react'
import { CheckCircleIcon, CircleIcon, CircleNotchIcon, WarningCircleIcon, XCircleIcon } from '@phosphor-icons/react'

export type StepState = 'pending' | 'active' | 'ok' | 'warn' | 'fail'
export interface Step {
  label: string
  state: StepState
}

const ICON: Record<StepState, ReactNode> = {
  pending: <CircleIcon size={20} weight="regular" aria-hidden />,
  active: <CircleNotchIcon size={20} weight="regular" className="spin" aria-hidden />,
  ok: <CheckCircleIcon size={20} weight="regular" className="pop-in" aria-hidden />,
  warn: <WarningCircleIcon size={20} weight="regular" className="pop-in" aria-hidden />,
  fail: <XCircleIcon size={20} weight="regular" className="pop-in" aria-hidden />,
}
const COLOR: Record<StepState, string> = {
  pending: 'var(--ink-2)', active: 'var(--ink)', ok: 'var(--free)', warn: 'var(--warn)', fail: 'var(--busy)',
}

/** Реальні етапи пайплайна розпізнавання: пошук авто (YOLO) → читання номера (ALPR) → готово. */
export default function RecognitionSteps({ steps, leaving }: { steps: Step[]; leaving?: boolean }) {
  return (
    <ol
      className={leaving ? 'steps-out' : undefined}
      aria-live="polite"
      style={{ listStyle: 'none', margin: '12px 0 0', padding: 0 }}
    >
      {steps.map((s) => (
        <li key={s.label} className="step-row" style={{ color: COLOR[s.state], opacity: s.state === 'pending' ? 0.55 : 1 }}>
          {ICON[s.state]}
          <span>{s.label}</span>
        </li>
      ))}
    </ol>
  )
}
