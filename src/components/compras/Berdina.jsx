import { useNavigate } from 'react-router-dom'
import { useState } from 'react'

const tarjetas = [
  { titulo: 'Pedidos',    icono: 'bi-cart3',           ruta: '/compras/berdina/pedidos',    color: 'linear-gradient(135deg, #7a1828, #4a0812)' },
  { titulo: 'Pendientes', icono: 'bi-hourglass-split', ruta: '/compras/berdina/pendientes', color: 'linear-gradient(135deg, #316650, #1a3326)' },
  { titulo: 'Stock',      icono: 'bi-box-seam',        ruta: '/compras/berdina/stock',      color: 'linear-gradient(135deg, #5a5a5a, #2a2a2a)' },
]

function Tarjeta({ titulo, icono, ruta, color }) {
  const navigate = useNavigate()
  const [hovered, setHovered] = useState(false)

  return (
    <div
      onClick={() => navigate(ruta)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        width: 260,
        height: 260,
        cursor: 'pointer',
        borderRadius: 14,
        background: color,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 14,
        transition: 'transform 0.18s ease, box-shadow 0.18s ease',
        transform: hovered ? 'translateY(-6px) scale(1.03)' : 'translateY(0) scale(1)',
        border: '1px solid rgba(0,0,0,0.12)',
        boxShadow: hovered
          ? '0 12px 32px rgba(0,0,0,0.22), 0 0 24px rgba(0,0,0,0.10)'
          : '0 3px 10px rgba(0,0,0,0.12)',
      }}
    >
      <i className={`bi ${icono}`} style={{ fontSize: 56, color: '#fff' }} />
      <span style={{ fontWeight: 700, fontSize: 19, color: '#fff', letterSpacing: 1, textTransform: 'uppercase' }}>{titulo}</span>
    </div>
  )
}

export default function Berdina() {
  const navigate = useNavigate()

  return (
    <div className="container-fluid flex-grow-1 d-flex flex-column py-4">

      {/* Header */}
      <div className="container d-flex justify-content-between align-items-center mb-5">
        <p className="mb-0" style={{ fontSize: 13, fontWeight: 500, color: 'var(--color-muted)', textTransform: 'uppercase', letterSpacing: 2 }}>
          Compras
        </p>
        <button onClick={() => navigate(-1)} className="btn btn-outline-dark btn-sm">
          ← Volver
        </button>
      </div>

      {/* Título + tarjetas centradas */}
      <div className="container flex-grow-1 d-flex flex-column align-items-center justify-content-center gap-4" style={{ paddingBottom: '6vh' }}>
        <h2 className="mb-3" style={{ fontWeight: 700, fontSize: 36, color: 'var(--color-text)', textTransform: 'uppercase', letterSpacing: 3 }}>
          Berdina
        </h2>
        <div className="d-flex flex-wrap justify-content-center gap-4">
          {tarjetas.map((t) => <Tarjeta key={t.titulo} {...t} />)}
        </div>
      </div>

    </div>
  )
}
