import { FREE_COLOR, ZONE_COLOR, ZONE_LABEL } from '../lib/format'
import type { Zone } from '../api/client'

const dot = (c: string) => (
  <span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: '50%', background: c, marginRight: 6 }} />
)

export default function MapLegend() {
  return (
    <div
      style={{
        position: 'absolute', right: 8, top: 8, zIndex: 1000, background: 'rgba(255,255,255,.94)',
        padding: '6px 10px', borderRadius: 8, fontSize: 12, boxShadow: '0 1px 4px rgba(0,0,0,.25)',
      }}
    >
      {(Object.keys(ZONE_LABEL) as Zone[]).map((z) => (
        <div key={z}>{dot(ZONE_COLOR[z])}{ZONE_LABEL[z]}</div>
      ))}
      <div>{dot(FREE_COLOR)}безкоштовно</div>
      <div style={{ color: '#666', marginTop: 4 }}>Зони — припущення за тарифом</div>
    </div>
  )
}
