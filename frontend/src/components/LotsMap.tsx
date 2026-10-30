import { useEffect, useRef } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import type { Lot } from '../api/client'
import { FREE_COLOR, ZONE_COLOR, ZONE_LABEL, formatHours } from '../lib/format'

const CHERNIVTSI: [number, number] = [48.2915, 25.9352]

function row(text: string, bold = false): HTMLElement {
  const el = document.createElement('div')
  el.textContent = text
  if (bold) el.style.fontWeight = '600'
  return el
}

// Попап будуємо через textContent, не innerHTML
function popup(lot: Lot): HTMLElement {
  const box = document.createElement('div')
  box.append(row(lot.address, true))
  if (!lot.is_paid) {
    box.append(row('Безкоштовний майданчик, без тарифікації'))
    if (lot.places != null) box.append(row(`Місць: ${lot.places}`))
    return box
  }
  box.append(row(lot.operator_name ?? 'оператор не вказаний'))
  box.append(row(`${lot.tariff_per_hour} грн/год · зона: ${ZONE_LABEL[lot.zone!]} (припущення)`))
  box.append(row(formatHours(lot.opening_hours)))
  const disabled = lot.places_disabled ? `, з них для людей з інвалідністю ${lot.places_disabled}` : ''
  box.append(row(`Місць: ${lot.places ?? '—'}${disabled}`))
  if (lot.free_estimate != null) box.append(row(`Вільно ≈ ${lot.free_estimate} (оцінка · симуляція)`))
  return box
}

interface Props {
  lots: Lot[]
  selectedId?: number | null
  onSelect?: (lot: Lot) => void
}

export default function LotsMap({ lots, selectedId, onSelect }: Props) {
  const el = useRef<HTMLDivElement>(null)
  const map = useRef<L.Map | null>(null)
  const layer = useRef<L.LayerGroup | null>(null)
  const onSelectRef = useRef(onSelect)
  onSelectRef.current = onSelect

  useEffect(() => {
    const m = L.map(el.current!, { zoomControl: true }).setView(CHERNIVTSI, 13)
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '© OpenStreetMap',
    }).addTo(m)
    layer.current = L.layerGroup().addTo(m)
    map.current = m
    return () => {
      m.remove()
      map.current = null
    }
  }, [])

  useEffect(() => {
    const g = layer.current
    if (!g) return
    g.clearLayers()
    for (const lot of lots) {
      const color = lot.is_paid ? ZONE_COLOR[lot.zone!] : FREE_COLOR
      const selected = lot.id === selectedId
      const marker = L.circleMarker([lot.lat, lot.lon], {
        radius: selected ? 13 : lot.is_paid ? 9 : 7,
        color: selected ? '#000' : '#fff',
        weight: selected ? 3 : 2,
        fillColor: color,
        fillOpacity: lot.is_paid ? 0.9 : 0.7,
      })
      marker.bindPopup(popup(lot))
      marker.on('click', () => onSelectRef.current?.(lot))
      marker.addTo(g)
    }
  }, [lots, selectedId])

  return <div ref={el} style={{ position: 'absolute', inset: 0 }} />
}
