import { useEffect, useState } from 'react'
import { getLots, type Lot } from '../api/client'
import LotsMap from '../components/LotsMap'
import MapLegend from '../components/MapLegend'

export default function Driver() {
  const [lots, setLots] = useState<Lot[]>([])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getLots().then(setLots).catch((e) => setError(e.message))
  }, [])

  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      <LotsMap lots={lots} />
      <MapLegend />
      {error && (
        <div style={{ position: 'absolute', top: 8, left: 8, right: 8, zIndex: 1000, background: '#fde8e8', padding: 10, borderRadius: 8 }}>
          Не вдалося завантажити майданчики: {error}
        </div>
      )}
    </div>
  )
}
