import type { Lot, ScanOut } from '../api/client'
import { formatHours } from '../lib/format'

interface View {
  color: string
  title: string
  lines: string[]
}

function view(r: ScanOut, lot: Lot): View {
  if (!r.paid_now) {
    return { color: '#5b6b7a', title: 'Оплата зараз не вимагається', lines: [`Платне паркування: ${formatHours(lot.opening_hours)}`] }
  }
  switch (r.status) {
    case 'active':
      return r.grace_after_close
        ? {
            color: '#5b6b7a', // нейтральний: не зелений і не червоний
            title: `Сесію закрито ${r.minutes_since_close} хв тому, водій від'їжджає`,
            lines: ['Це пільговий час (припущення). Повторіть скан, якщо авто лишиться.'],
          }
        : { color: '#1f8a4c', title: 'Сплачено · сесія активна', lines: [] }
    case 'closed_but_present':
      return {
        color: '#d98100',
        title: `Сесію закрито ${r.minutes_since_close} хв тому, авто досі тут`,
        lines: ['Водій закрив сесію, але не поїхав.'],
      }
    case 'unpaid': {
      const lines = [`Можливо, щойно приїхав: повторіть скан через ${r.recheck_after_min} хв`]
      if (r.session_on_other_lot) lines.unshift('Є активна сесія на іншому майданчику.')
      return { color: '#c0392b', title: 'Сесії немає: не сплачено', lines }
    }
    default:
      return { color: '#6b6f76', title: 'Не вдалося визначити', lines: ['Введіть номер вручну і перевірте ще раз.'] }
  }
}

export default function ScanResultCard({ result, lot }: { result: ScanOut; lot: Lot }) {
  const v = view(result, lot)
  return (
    <div style={{ background: v.color, color: '#fff', borderRadius: 14, padding: 18 }}>
      <div style={{ fontSize: 24, fontWeight: 700, lineHeight: 1.2 }}>{v.title}</div>
      {v.lines.map((l) => (
        <div key={l} style={{ marginTop: 6, fontSize: 15 }}>{l}</div>
      ))}
      <div style={{ marginTop: 12, fontSize: 12, opacity: 0.85 }}>
        Система лише рекомендує, рішення про штраф ухвалює інспектор.
      </div>
    </div>
  )
}
