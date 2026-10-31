import type { ComponentType } from 'react'
import { CheckCircleIcon, ClockIcon, HourglassIcon, MoonIcon, QuestionIcon, XCircleIcon, type IconProps } from '@phosphor-icons/react'
import type { Lot, ScanOut } from '../api/client'
import { formatHours } from '../lib/format'
import { formatPlate } from '../lib/plate'

interface View {
  tone: 'free' | 'busy' | 'neutral' | 'warn'
  solid?: boolean // суцільна плашка — порушення: unpaid (червона, білий текст), closed_but_present (бурштинова, темний текст)
  Icon: ComponentType<IconProps>
  title: string
  lines: string[]
}

// Статуси: колір + іконка + текст (DESIGN.md). Логіку статусів не чіпаємо, лише відображення.
function view(r: ScanOut, lot: Lot): View {
  if (!r.paid_now) {
    return { tone: 'neutral', Icon: MoonIcon, title: 'Оплата зараз не вимагається', lines: [`Платне паркування: ${formatHours(lot.opening_hours)}`] }
  }
  switch (r.status) {
    case 'active':
      return r.grace_after_close
        ? {
            tone: 'neutral', Icon: HourglassIcon, title: 'Щойно закрито',
            lines: [`Сесію закрито ${r.minutes_since_close} хв тому, водій від'їжджає.`, 'Це пільговий час (припущення). Повторіть скан, якщо авто лишиться.'],
          }
        : { tone: 'free', Icon: CheckCircleIcon, title: 'Оплачено', lines: ['Сесія активна.'] }
    case 'closed_but_present':
      return {
        tone: 'warn', solid: true, Icon: ClockIcon, title: 'Сесію закрито, авто на місці',
        lines: [`Закрито ${r.minutes_since_close} хв тому. Водій закрив сесію, але не поїхав.`],
      }
    case 'unpaid': {
      const lines = r.recheck_after_min != null ? [`Можливо, щойно приїхав: повторіть скан через ${r.recheck_after_min} хв.`] : []
      return {
        tone: 'busy', solid: true, Icon: XCircleIcon,
        title: r.session_on_other_lot ? 'Оплачено на іншому майданчику — тут не оплачено' : 'Не оплачено',
        lines,
      }
    }
    default:
      return { tone: 'neutral', Icon: QuestionIcon, title: 'Невідомо', lines: ['Не вдалося визначити. Введіть номер вручну і перевірте ще раз.'] }
  }
}

const TINT = { free: 'var(--free-tint)', busy: 'var(--busy-tint)', neutral: 'var(--neutral-tint)', warn: 'var(--warn-tint)' } as const
const COLOR = { free: 'var(--free)', busy: 'var(--busy)', neutral: 'var(--ink-2)', warn: 'var(--warn-solid)' } as const
// Текст на суцільній плашці: білий на червоному, темно-синій на бурштиновому
const ON_SOLID = { free: '#fff', busy: '#fff', neutral: '#fff', warn: 'var(--ink)' } as const

/** Вердикт скану: іконка + текст + колір, номер повторено, щоб було видно, до якого авто він належить. */
export default function ScanResultCard({ result, lot, plate }: { result: ScanOut; lot: Lot; plate: string | null }) {
  const v = view(result, lot)
  const fg = v.solid ? ON_SOLID[v.tone] : COLOR[v.tone]
  return (
    <div>
      <div
        className="verdict"
        role="status"
        aria-live="polite"
        style={{ background: v.solid ? COLOR[v.tone] : TINT[v.tone], color: fg, borderRadius: 'var(--radius)', padding: '20px 16px' }}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
          <v.Icon className="verdict-icon" size={40} weight="regular" aria-hidden style={{ flex: '0 0 auto' }} />
          <div style={{ fontSize: 22, fontWeight: 600, lineHeight: 1.25, textWrap: 'balance' }}>{v.title}</div>
        </div>
        {v.lines.map((l) => (
          <div key={l} style={{ marginTop: 10, fontSize: 15, fontWeight: 500, color: v.solid ? ON_SOLID[v.tone] : 'var(--ink)' }}>{l}</div>
        ))}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'baseline', padding: '14px 0', borderBottom: '1px solid var(--line)' }}>
        <span style={{ fontSize: 22, fontWeight: 600, letterSpacing: 2 }}>{plate ? formatPlate(plate) : 'Номер не введено'}</span>
        <span style={{ fontSize: 13, color: 'var(--ink-2)', textAlign: 'right' }}>{lot.address}</span>
      </div>
      <p style={{ margin: '12px 0 0', fontSize: 13, color: 'var(--ink-2)' }}>
        Система лише рекомендує, рішення про штраф ухвалює інспектор.
      </p>
    </div>
  )
}
