import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Container } from 'react-bootstrap'

// Qué se puede hacer dentro del taller. Cada una lleva su color: son cosas
// distintas y de un vistazo se tiene que ver cuál es cuál. Pedidos se queda
// con el ámbar, que es el color de Compras.
const OPCIONES = [
  {
    id: 'pedidos',
    titulo: 'Pedidos',
    subtitulo: 'Pedidos del taller y carga de uno nuevo',
    icono: 'bi bi-cart-fill',
    destino: '/compras/berdina/pedidos',
    colores: {
      fondo: 'linear-gradient(135deg, #78350f 0%, #92400e 100%)',
      fondoHover: 'linear-gradient(135deg, #451a03 0%, #78350f 100%)',
      borde: '#f59e0b',
      icono: '#fcd34d',
      brillo: 'rgba(245,158,11,0.25)',
    },
  },
  {
    id: 'pendientes',
    titulo: 'Pendientes',
    subtitulo: 'Lo pedido que todavía no se resolvió',
    icono: 'bi bi-hourglass-split',
    destino: '/compras/berdina/pendientes',
    colores: {
      fondo: 'linear-gradient(135deg, #3730a3 0%, #4f46e5 100%)',
      fondoHover: 'linear-gradient(135deg, #1e1b4b 0%, #3730a3 100%)',
      borde: '#818cf8',
      icono: '#c7d2fe',
      brillo: 'rgba(129,140,248,0.25)',
    },
  },
  {
    id: 'stock',
    titulo: 'Stock',
    subtitulo: 'Repuestos disponibles en el taller',
    icono: 'bi bi-box-seam-fill',
    destino: '/compras/berdina/stock',
    colores: {
      fondo: 'linear-gradient(135deg, #334155 0%, #475569 100%)',
      fondoHover: 'linear-gradient(135deg, #0f172a 0%, #334155 100%)',
      borde: '#94a3b8',
      icono: '#cbd5e1',
      brillo: 'rgba(148,163,184,0.25)',
    },
  },
]

export default function Berdina() {
  const navigate = useNavigate()
  const [hovered, setHovered] = useState(null)

  return (
    <div
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: '#f8f9fa',
        height: '100%',
        overflow: 'hidden',
      }}
    >
      <Container
        fluid
        className="px-4 py-3 d-flex flex-column flex-grow-1"
        style={{ maxWidth: '1040px', width: '100%', margin: '0 auto' }}
      >
        {/* Encabezado. El volver está en el navbar de Compras, arriba. */}
        <div className="d-flex align-items-center gap-2 mb-4">
          <span className="fw-bold" style={{ color: '#78350f', fontSize: '1.05rem' }}>
            Berdina
          </span>
        </div>

        {/* Tarjetas del taller */}
        <div className="flex-grow-1 d-flex align-items-center justify-content-center">
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: `repeat(${OPCIONES.length}, 1fr)`,
              gap: '1.75rem',
              width: '100%',
              maxWidth: '960px',
              margin: '0 auto',
            }}
          >
            {OPCIONES.map((o) => {
              const isHovered = hovered === o.id
              return (
                <div
                  key={o.id}
                  className="d-flex flex-column align-items-center justify-content-center text-center p-4"
                  style={{
                    background: isHovered ? o.colores.fondoHover : o.colores.fondo,
                    borderRadius: '20px',
                    height: '230px',
                    color: '#fff',
                    cursor: 'pointer',
                    border: `1px solid ${isHovered ? o.colores.borde : 'rgba(255,255,255,0.12)'}`,
                    boxShadow: isHovered
                      ? `0 18px 30px -10px rgba(0,0,0,0.4), 0 0 16px ${o.colores.brillo}`
                      : '0 8px 18px -6px rgba(0,0,0,0.25)',
                    transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                    transform: isHovered ? 'translateY(-4px)' : 'translateY(0)',
                    userSelect: 'none',
                  }}
                  onClick={() => navigate(o.destino)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => e.key === 'Enter' && navigate(o.destino)}
                  onMouseEnter={() => setHovered(o.id)}
                  onMouseLeave={() => setHovered(null)}
                >
                  <div
                    className="mb-3 d-flex align-items-center justify-content-center"
                    style={{
                      width: '66px',
                      height: '66px',
                      borderRadius: '18px',
                      backgroundColor: 'rgba(255,255,255,0.1)',
                      border: '1px solid rgba(255,255,255,0.16)',
                    }}
                  >
                    <i className={o.icono} style={{ fontSize: '2.1rem', color: o.colores.icono }}></i>
                  </div>

                  <span className="fw-bold" style={{ fontSize: '1.25rem', letterSpacing: '0.2px' }}>
                    {o.titulo}
                  </span>

                  <span
                    className="mt-2 px-2"
                    style={{ fontSize: '0.82rem', color: 'rgba(255,255,255,0.72)' }}
                  >
                    {o.subtitulo}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      </Container>
    </div>
  )
}
