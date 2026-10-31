import type { CSSProperties } from 'react'

export const primaryBtn: CSSProperties = {
  width: '100%', minHeight: 52, borderRadius: 12, border: 0, background: 'var(--ink)', color: '#fff',
  fontSize: 16, fontWeight: 600,
}
export const secondaryBtn: CSSProperties = {
  width: '100%', minHeight: 48, borderRadius: 12, border: '1px solid var(--line)', background: 'var(--bg)', fontSize: 14, fontWeight: 500,
}
export const card: CSSProperties = { background: 'var(--bg)', borderRadius: 12, padding: 16, border: '1px solid var(--line)' }
export const errorBox: CSSProperties = {
  background: 'var(--busy-tint)', color: 'var(--busy)', padding: '10px 12px', borderRadius: 8, margin: '8px 0', fontSize: 14, fontWeight: 500,
}
export const page: CSSProperties = { padding: 16, maxWidth: 480, margin: '0 auto', paddingBottom: 72 }
