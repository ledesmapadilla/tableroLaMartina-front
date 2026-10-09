import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Container } from 'react-bootstrap'
import { api } from '../../services/api'
import { grillaCentrada } from '../../utils/grillaTarjetas'

// Qué se puede hacer desde el analista. Cada una lleva su color: son cosas
// distintas y de un vistazo se tiene que ver cuál es cuál. Pedidos se queda
// con el bordó de Compras.
const OPCIONES = [
  {
    id: 'pedidos',
    titulo: 'Pedidos',
    icono: 'bi bi-cart-fill',
    destino: '/compras/analista/pedidos',
    colores: {
      fondo: 'linear-gradient(135deg, #7a1828 0%, #9d2235 100%)',
      fondoHover: 'linear-gradient(135deg, #4a0812 0%, #7a1828 100%)',
      borde: '#f59e0b',
      icono: '#fcd34d',
      brillo: 'rgba(245,158,11,0.25)',
    },
  },
  {
    id: 'pendientes',
    titulo: 'Pendientes',
    icono: 'bi bi-hourglass-split',
    destino: '/compras/analista/pendientes',
    colores: {
      fondo: 'linear-gradient(135deg, #3730a3 0%, #4f46e5 100%)',
      fondoHover: 'linear-gradient(135deg, #1e1b4b 0%, #3730a3 100%)',
      borde: '#818cf8',
      icono: '#c7d2fe',
      brillo: 'rgba(129,140,248,0.25)',
    },
  },
  {
    id: 'presupuestos-reparaciones',
    titulo: 'Presupuestos reparaciones',
    icono: 'bi bi-currency-dollar',
    destino: '/compras/analista/presupuestos-reparaciones',
    colores: {
      fondo: 'linear-gradient(135deg, #0f766e 0%, #14b8a6 100%)',
      fondoHover: 'linear-gradient(135deg, #042f2e 0%, #0f766e 100%)',
      borde: '#5eead4',
      icono: '#99f6e4',
      brillo: 'rgba(94,234,212,0.25)',
    },
  },
  {
    id: 'stock',
    // El stock de la empresa: es la suma de los dos talleres, no un tercer
    // depósito. Por eso los otros dos llevan el nombre del taller.
    permiso: 'compras.stock',
    titulo: 'Almacén de repuestos',
    icono: 'bi bi-box-seam-fill',
    // Abre la puerta del almacén: los aceites o los rubros de siempre.
    destino: '/compras/analista/almacen',
    colores: {
      fondo: 'linear-gradient(135deg, #334155 0%, #475569 100%)',
      fondoHover: 'linear-gradient(135deg, #0f172a 0%, #334155 100%)',
      borde: '#94a3b8',
      icono: '#cbd5e1',
      brillo: 'rgba(148,163,184,0.25)',
    },
  },
]

// De los estados que muestra AnalistaPendientes, los que se cuentan en la
// tarjeta, con el rótulo que lleva allá cada uno (Pedido y En analisis se ven
// como Para analisis). Para revision no se cuenta.
const ESTADOS_PENDIENTES = {
  Pedido: 'Para análisis',
  'En analisis': 'Para análisis',
  'Para analisis': 'Para análisis',
  'Para retirar': 'Para retirar',
}

/**
 * Las cantidades de la tarjeta Pendientes: cuántos pedidos (como filas de la
 * tabla de pendientes) hay para analizar y para retirar, aunque sean cero. Un
 * pedido con ítems en los dos estados cuenta en los dos.
 */
function usePendientes() {
  const [conteo, setConteo] = useState(null) // [[rótulo, n]]

  useEffect(() => {
    Promise.all([
      api.get('/berdina/pedidos').catch(() => []),
      api.get('/sanpablo/pedidos').catch(() => []),
    ]).then(([berdina, sanpablo]) => {
      const porEstado = new Map(Object.values(ESTADOS_PENDIENTES).map((r) => [r, new Set()]))
      for (const [src, lista] of [['berdina', berdina], ['sanpablo', sanpablo]]) {
        for (const p of Array.isArray(lista) ? lista : []) {
          for (const i of p.items || []) {
            const rotulo = ESTADOS_PENDIENTES[i.estado]
            if (!rotulo) continue
            const clave = `${src}-${p.nro_pedido}`
            porEstado.get(rotulo).add(clave)
          }
        }
      }
      setConteo([...porEstado].map(([r, s]) => [r, s.size]))
    })
  }, [])

  return conteo
}

// La cantidad de la tarjeta Presupuestos reparaciones: los que esperan que el
// analista los cotice.
function usePresupuestosPendientes() {
  const [conteo, setConteo] = useState(null) // [[rótulo, n]]

  useEffect(() => {
    api
      .get('/presupuestos-reparaciones')
      .then((lista) => {
        const n = (Array.isArray(lista) ? lista : []).filter((p) => p.estado === 'Para cotizar').length
        setConteo([['Para cotizar', n]])
      })
      .catch(() => setConteo(null))
  }, [])

  return conteo
}

export default function Analista() {
  const navigate = useNavigate()
  const [hovered, setHovered] = useState(null)
  // Las cantidades que lleva cada tarjeta debajo del título.
  const cantidades = {
    pendientes: usePendientes(),
    'presupuestos-reparaciones': usePresupuestosPendientes(),
  }

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
        {/* Sin encabezado: las tarjetas hablan solas. */}

        {/* Tarjetas del analista */}
        <div className="flex-grow-1 d-flex align-items-center justify-content-center">
          <div
            style={{ ...grillaCentrada(OPCIONES.length, { ancho: 260, maxColumnas: 4 }), gap: '1.75rem' }}
          >
            {OPCIONES.map((o) => {
              const isHovered = hovered === o.id
              // El punto rojo de arriba a la derecha: hay algo esperando al
              // analista. Hoy solo en Presupuestos reparaciones.
              const conAviso = o.id === 'presupuestos-reparaciones' && cantidades[o.id]?.[0]?.[1] > 0
              return (
                <div
                  key={o.id}
                  className="d-flex flex-column align-items-center justify-content-center text-center p-4"
                  style={{
                    position: 'relative',
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
                  {conAviso && (
                    <span
                      title="Hay repuestos pendientes de cotizar"
                      style={{
                        position: 'absolute',
                        top: '14px',
                        right: '14px',
                        width: '14px',
                        height: '14px',
                        borderRadius: '50%',
                        backgroundColor: '#ef4444',
                        border: '2px solid #fff',
                        boxShadow: '0 0 0 3px rgba(239,68,68,0.35)',
                      }}
                    ></span>
                  )}
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

                  <span style={{ fontSize: '1.25rem', letterSpacing: '0.2px' }}>
                    {o.titulo}
                  </span>

                  {cantidades[o.id] && (
                    <div className="mt-2 d-flex flex-wrap justify-content-center gap-1">
                      {cantidades[o.id].map(([rotulo, n]) => (
                        <span
                          key={rotulo}
                          className="px-2 rounded-pill"
                          style={{ fontSize: '0.72rem', backgroundColor: 'rgba(255,255,255,0.12)' }}
                        >
                          {rotulo}: {n}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </Container>
    </div>
  )
}
