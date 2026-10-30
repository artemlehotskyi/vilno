import { NavLink, Navigate, Route, Routes } from 'react-router-dom'
import Driver from './pages/Driver'
import Inspector from './pages/Inspector'
import City from './pages/City'

const tabs = [
  { to: '/driver', label: 'Водій' },
  { to: '/inspector', label: 'Інспектор' },
  { to: '/city', label: 'Місто' },
]

export default function App() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <nav style={{ display: 'flex', gap: 4, padding: 8, background: '#fff', borderBottom: '1px solid #ddd' }}>
        <strong style={{ alignSelf: 'center', marginRight: 8 }}>VILNO</strong>
        {tabs.map((t) => (
          <NavLink
            key={t.to}
            to={t.to}
            style={({ isActive }) => ({
              padding: '10px 12px',
              borderRadius: 8,
              textDecoration: 'none',
              color: isActive ? '#fff' : '#1a1a1a',
              background: isActive ? '#1a1a1a' : 'transparent',
            })}
          >
            {t.label}
          </NavLink>
        ))}
      </nav>
      <main style={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
        <Routes>
          <Route path="/" element={<Navigate to="/driver" replace />} />
          <Route path="/driver" element={<Driver />} />
          <Route path="/inspector" element={<Inspector />} />
          <Route path="/city" element={<City />} />
        </Routes>
      </main>
    </div>
  )
}
