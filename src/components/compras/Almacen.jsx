import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Container } from 'react-bootstrap'
import { grillaCentrada } from '../../utils/grillaTarjetas'

/**
 * La puerta del almacén de repuestos del analista (28/09/2026).
 *
 * Dos tarjetas: los aceites, que vienen del Sistema de Gestión Lepa y se
 * cuentan en litros, y el almacén de siempre, con sus seis rubros y el
 * catálogo general (Stock.jsx).
 */
const OPCIONES = [
  {
    id: 'aceites',
    titulo: 'Aceites',
    subtitulo: 'Compras, consumos y stock en litros',
    icono: 'bi bi-droplet-fill',
    destino: '/compras/analista/aceites',
    colores: {
      fondo: 'linear-gradient(135deg, #713f12 0%, #a16207 100%)',
      fondoHover: 'linear-gradient(135deg, #422006 0%, #713f12 100%)',
      borde: '#facc15',
      icono: '#fde047',
      brillo: 'rgba(250,204,21,0.25)',
    },
  },
  {
    id: 'almacen',
    titulo: 'Almacén',
    subtitulo: 'Repuestos, filtros, cubiertas, ferretería, electricidad y herramientas',
    icono: 'bi bi-box-seam-fill',
    destino: '/compras/analista/stock',
    colores: {
      fondo: 'linear-gradient(135deg, #334155 0%, #475569 100%)',
      fondoHover: 'linear-gradient(135deg, #0f172a 0%, #334155 100%)',
      borde: '#94a3b8',
      icono: '#cbd5e1',
      brillo: 'rgba(148,163,184,0.25)',
    },
  },
]

export default function Almacen() {
  const navigate = useNavigate()
  const [hovered, setHovered] = useState(null)

  return (
    <div
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        // El mismo fondo oscuro que el menú de los rubros, que es lo que sigue.
        backgroundColor: '#0f172a',
        height: '100%',
        overflow: 'hidden',
      }}
    >
      <Container
        fluid
        className="px-4 py-3 d-flex flex-column flex-grow-1"
        style={{ maxWidth: '1040px', width: '100%', margin: '0 auto' }}
      >
        {/* Sin encabezado: las tarjetas hablan solas, igual que en el analista. */}
        <div className="flex-grow-1 d-flex align-items-center justify-content-center">
          <div style={{ ...grillaCentrada(OPCIONES.length), gap: '1.75rem' }}>
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

                  <span style={{ fontSize: '1.25rem', letterSpacing: '0.2px' }}>{o.titulo}</span>

                  <span className="mt-2 px-2" style={{ fontSize: '0.82rem', color: 'rgba(255,255,255,0.72)' }}>
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
