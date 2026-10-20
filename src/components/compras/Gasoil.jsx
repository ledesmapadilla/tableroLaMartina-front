import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Container } from 'react-bootstrap'
import { grillaCentrada } from '../../utils/grillaTarjetas'
import { camposVisibles } from './camposGasoil'
import { useAuth } from '../../context/AuthContext'

// Debajo de las dos (20/10/2026): Auditorías, de la mitad de alto y del ancho
// de las dos juntas (GasoilAuditorias.jsx).
const AUDITORIAS = {
  id: 'auditorias',
  titulo: 'Auditorías',
  icono: 'bi bi-clipboard-check-fill',
  colores: {
    fondo: 'linear-gradient(135deg, #1e293b 0%, #334155 100%)',
    fondoHover: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
    borde: '#38bdf8',
    icono: '#7dd3fc',
    brillo: 'rgba(56,189,248,0.25)',
  },
}

/**
 * Compras › Gasoil (20/10/2026): una tarjeta por campo, Berdina y San Pablo.
 * Cada una abre su planilla de consumo (GasoilPlanilla.jsx). Mismo formato
 * que las tarjetas del almacén.
 */
export default function Gasoil() {
  const navigate = useNavigate()
  const [hovered, setHovered] = useState(null)
  // El encargado de taller ve solo la tarjeta de su campo.
  const { user } = useAuth()
  const campos = camposVisibles(user)

  const ir = (id) => navigate(`/compras/gasoil/${id}`)

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
        <div className="flex-grow-1 d-flex flex-column align-items-center justify-content-center">
          <div style={{ ...grillaCentrada(campos.length, { ancho: 260, maxColumnas: 2 }), gap: '1.25rem' }}>
            {campos.map((s) => {
              const isHovered = hovered === s.id
              return (
                <div
                  key={s.id}
                  className="d-flex flex-column align-items-center justify-content-center text-center p-3"
                  style={{
                    background: isHovered ? s.colores.fondoHover : s.colores.fondo,
                    borderRadius: '20px',
                    height: '185px',
                    color: '#fff',
                    cursor: 'pointer',
                    border: `1px solid ${isHovered ? s.colores.borde : 'rgba(255,255,255,0.12)'}`,
                    boxShadow: isHovered
                      ? `0 18px 30px -10px rgba(0,0,0,0.4), 0 0 16px ${s.colores.brillo}`
                      : '0 8px 18px -6px rgba(0,0,0,0.25)',
                    transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                    transform: isHovered ? 'translateY(-4px)' : 'translateY(0)',
                    userSelect: 'none',
                  }}
                  onClick={() => ir(s.id)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => e.key === 'Enter' && ir(s.id)}
                  onMouseEnter={() => setHovered(s.id)}
                  onMouseLeave={() => setHovered(null)}
                >
                  <div
                    className="mb-2 d-flex align-items-center justify-content-center"
                    style={{
                      width: '54px',
                      height: '54px',
                      borderRadius: '16px',
                      backgroundColor: 'rgba(255,255,255,0.1)',
                      border: '1px solid rgba(255,255,255,0.16)',
                    }}
                  >
                    <i className="bi bi-fuel-pump-fill" style={{ fontSize: '1.7rem', color: s.colores.icono }}></i>
                  </div>
                  <span style={{ fontSize: '1.05rem', letterSpacing: '0.2px' }}>{s.titulo}</span>
                  <span className="mt-1 px-1" style={{ fontSize: '0.76rem', color: 'rgba(255,255,255,0.72)' }}>
                    {user?.rol === 'solicitante' ? 'Ingresos de gasoil' : s.subtitulo}
                  </span>
                </div>
              )
            })}

            {/* Auditorías: ocupa las dos columnas y mide la mitad de alto. */}
            <div
              className="d-flex align-items-center justify-content-center gap-3 px-4"
              style={{
                gridColumn: '1 / -1',
                height: '92px',
                background: hovered === AUDITORIAS.id ? AUDITORIAS.colores.fondoHover : AUDITORIAS.colores.fondo,
                borderRadius: '20px',
                color: '#fff',
                cursor: 'pointer',
                border: `1px solid ${hovered === AUDITORIAS.id ? AUDITORIAS.colores.borde : 'rgba(255,255,255,0.12)'}`,
                boxShadow:
                  hovered === AUDITORIAS.id
                    ? `0 18px 30px -10px rgba(0,0,0,0.4), 0 0 16px ${AUDITORIAS.colores.brillo}`
                    : '0 8px 18px -6px rgba(0,0,0,0.25)',
                transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                transform: hovered === AUDITORIAS.id ? 'translateY(-4px)' : 'translateY(0)',
                userSelect: 'none',
              }}
              onClick={() => ir(AUDITORIAS.id)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => e.key === 'Enter' && ir(AUDITORIAS.id)}
              onMouseEnter={() => setHovered(AUDITORIAS.id)}
              onMouseLeave={() => setHovered(null)}
            >
              <div
                className="d-flex align-items-center justify-content-center"
                style={{
                  width: '42px',
                  height: '42px',
                  borderRadius: '14px',
                  backgroundColor: 'rgba(255,255,255,0.1)',
                  border: '1px solid rgba(255,255,255,0.16)',
                }}
              >
                <i className={AUDITORIAS.icono} style={{ fontSize: '1.35rem', color: AUDITORIAS.colores.icono }}></i>
              </div>
              <span style={{ fontSize: '1.05rem', letterSpacing: '0.2px' }}>{AUDITORIAS.titulo}</span>
            </div>
          </div>
        </div>
      </Container>
    </div>
  )
}
