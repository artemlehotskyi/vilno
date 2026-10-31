import { NavLink, Navigate, Route, Routes } from 'react-router-dom'
import Driver from './pages/Driver'
import Inspector from './pages/Inspector'
import City from './pages/City'
import DemoPanel from './components/DemoPanel'

const tabs = [
  { to: '/driver', label: 'Водій' },
  { to: '/inspector', label: 'Інспектор' },
  { to: '/city', label: 'Місто' },
]

export default function App() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <nav style={{ display: 'flex', gap: 4, padding: '4px 12px', background: 'var(--bg)', borderBottom: '1px solid var(--line)', alignItems: 'center' }}>
        <strong style={{ marginRight: 12, fontWeight: 600, letterSpacing: 1.5 }}>VILNO</strong>
        {tabs.map((t) => (
          <NavLink
            key={t.to}
            to={t.to}
            style={({ isActive }) => ({
              padding: '12px 10px',
              textDecoration: 'none',
              fontSize: 14,
              fontWeight: isActive ? 600 : 500,
              color: isActive ? 'var(--ink)' : 'var(--ink-2)',
              borderBottom: `2px solid ${isActive ? 'var(--ink)' : 'transparent'}`,
            })}
          >
            {t.label}
          </NavLink>
        ))}
      </nav>
      <main style={{ flex: 1, minHeight: 0, overflow: "auto", position: "relative" }}>
        <Routes>
          <Route path="/" element={<Navigate to="/driver" replace />} />
          <Route path="/driver" element={<Driver />} />
          <Route path="/inspector" element={<Inspector />} />
          <Route path="/city" element={<City />} />
        </Routes>
      </main>
      <DemoPanel />
    </div>
  )
}
