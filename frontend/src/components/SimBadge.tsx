export default function SimBadge({ children = 'Симуляція' }: { children?: string }) {
  return (
    <span
      style={{
        display: 'inline-block', background: '#ffd54a', color: '#4a3600', fontSize: 12, fontWeight: 700,
        padding: '2px 8px', borderRadius: 6, textTransform: 'uppercase', letterSpacing: 0.4, verticalAlign: 'middle',
      }}
    >
      {children}
    </span>
  )
}
