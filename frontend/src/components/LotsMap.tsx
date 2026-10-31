import { useEffect, useRef } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { MoonIcon, ProhibitIcon, QuestionIcon, XIcon } from '@phosphor-icons/react'
import type { Lot, Street } from '../api/client'
import { lotState } from '../lib/lotState'

const CHERNIVTSI: [number, number] = [48.2915, 25.9352]
const ICON_PROPS = { size: 16, weight: 'regular' as const, 'aria-hidden': true }

function glyph(lot: Lot): string {
  const { state, reason } = lotState(lot)
  if (state === 'free') return String(lot.free_estimate)
  if (state === 'busy') return renderToStaticMarkup(<XIcon {...ICON_PROPS} />)
  const Icon = reason === 'closed' ? MoonIcon : reason === 'no_data' ? QuestionIcon : ProhibitIcon
  return renderToStaticMarkup(<Icon {...ICON_PROPS} size={14} />)
}

// Підпис для скрінрідерів: стан не лише кольором і формою
function ariaLabel(lot: Lot): string {
  const { state, reason } = lotState(lot)
  if (state === 'free') return `${lot.address}: вільно ${lot.free_estimate}, оцінка`
  if (state === 'busy') return `${lot.address}: вільних місць немає, оцінка`
  return `${lot.address}: ${reason === 'closed' ? 'зараз поза робочими годинами' : reason === 'free_lot' ? 'безкоштовний' : 'немає даних'}`
}

function markerIcon(lot: Lot, selected: boolean, enter: boolean): L.DivIcon {
  const { state } = lotState(lot)
  // Вміст — лише числа й іконки з коду, текст з набору даних сюди не потрапляє
  const html = `<span class="shape ${state}">${glyph(lot)}</span>`
  return L.divIcon({
    className: `lot-marker${selected ? ' selected' : ''}${enter ? ' enter' : ''}`,
    html,
    iconSize: [44, 44], // зона торкання ≥ 44 px
    iconAnchor: [22, 22],
  })
}

interface Props {
  lots: Lot[]
  streets: Record<string, Street>
  selectedId?: number | null
  onSelect?: (lot: Lot) => void
  onDeselect?: () => void
  onReady?: () => void
}

export default function LotsMap({ lots, streets, selectedId, onSelect, onDeselect, onReady }: Props) {
  const el = useRef<HTMLDivElement>(null)
  const map = useRef<L.Map | null>(null)
  const markers = useRef<L.LayerGroup | null>(null)
  const highlight = useRef<L.LayerGroup | null>(null)
  const entered = useRef(false)
  const cb = useRef({ onSelect, onDeselect, onReady })
  cb.current = { onSelect, onDeselect, onReady }

  useEffect(() => {
    const m = L.map(el.current!, { zoomControl: false, attributionControl: true }).setView(CHERNIVTSI, 13)
    L.control.zoom({ position: 'topright' }).addTo(m)
    const tiles = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors · <a href="https://data.gov.ua">data.gov.ua</a>',
    }).addTo(m)
    tiles.once('load', () => cb.current.onReady?.())
    m.on('click', () => cb.current.onDeselect?.())
    highlight.current = L.layerGroup().addTo(m)
    markers.current = L.layerGroup().addTo(m)
    map.current = m
    return () => {
      m.remove()
      map.current = null
      entered.current = false
    }
  }, [])

  useEffect(() => {
    const g = markers.current
    if (!g || lots.length === 0) return
    g.clearLayers()
    const enter = !entered.current
    if (enter && map.current) {
      // перший показ: вся множина майданчиків у кадрі (центр міста), не фіксований масштаб
      // викиди на околицях міста не розтягують кадр: беремо майданчики в межах 1,8 км від медіани
      const med = (xs: number[]) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)]
      const centre = L.latLng(med(lots.map((l) => l.lat)), med(lots.map((l) => l.lon)))
      const core = lots.filter((l) => centre.distanceTo([l.lat, l.lon]) <= 1800)
      map.current.fitBounds(L.latLngBounds(core.map((l) => [l.lat, l.lon] as [number, number])), { padding: [24, 24], maxZoom: 15, animate: false })
    }
    entered.current = true
    for (const lot of lots) {
      const mk = L.marker([lot.lat, lot.lon], {
        icon: markerIcon(lot, lot.id === selectedId, enter),
        keyboard: true,
        title: ariaLabel(lot),
        alt: ariaLabel(lot),
        zIndexOffset: lot.id === selectedId ? 1000 : 0,
      })
      mk.on('click', (e) => {
        L.DomEvent.stopPropagation(e)
        cb.current.onSelect?.(lot)
      })
      mk.addTo(g)
    }
  }, [lots, selectedId])

  // Підсвітка вулиці/ділянки вибраного майданчика
  useEffect(() => {
    const g = highlight.current
    const m = map.current
    if (!g || !m) return
    g.clearLayers()
    const lot = lots.find((l) => l.id === selectedId)
    if (!lot) return
    const street = streets[String(lot.id)]
    const lines: [number, number][][] = street?.lines.length ? street.lines : lot.points.length > 1 ? [lot.points] : []
    const bounds = L.latLngBounds([[lot.lat, lot.lon]])
    for (const line of lines) {
      // біла підкладка + темно-синя лінія: читається і на світлій, і на людній мапі
      L.polyline(line, { color: '#fff', weight: 9, opacity: 0.95, lineCap: 'round', lineJoin: 'round', interactive: false }).addTo(g)
      L.polyline(line, { color: '#0b1f44', weight: 5, opacity: 0.9, lineCap: 'round', lineJoin: 'round', interactive: false }).addTo(g)
      bounds.extend(line)
    }
    if (lines.length === 0) {
      L.circle([lot.lat, lot.lon], { radius: 35, color: '#0b1f44', weight: 3, fill: false, interactive: false }).addTo(g)
      bounds.extend(L.latLng(lot.lat, lot.lon).toBounds(120))
    }
    // панель займає низ мапи: лишаємо їй місце, щоб вулиця не опинилась під нею
    const panelInset = Math.min(380, Math.round(m.getSize().y * 0.55))
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    m.fitBounds(bounds, {
      paddingTopLeft: [32, 64],
      paddingBottomRight: [32, panelInset + 24],
      maxZoom: 17,
      animate: !reduce,
      duration: 0.4,
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId, streets])

  return <div ref={el} style={{ position: 'absolute', inset: 0 }} />
}
