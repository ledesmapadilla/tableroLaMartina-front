import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Container } from 'react-bootstrap'
import { usePermisos } from '../../context/permisos'
import { useAuth } from '../../context/AuthContext'
import { GRUPO } from '../../utils/permisosCatalogo'
import { seccionPropia, COLORES_NEUTROS } from '../../utils/seccionPropia'
import { ultimaCentrada } from '../../utils/grillaTarjetas'

// Las secciones de Compras. Es la entrada: todo lo demás cuelga de una de
// estas. Para sumar otra alcanza con agregar una entrada acá y su ruta en
// App.jsx.
//
// Quién ve cada una sale de la tabla de Roles (`permiso`), la misma con la que
// App.jsx controla las rutas: así una tarjeta no puede quedar visible para
// quien después rebota.
//
// Cada una lleva su color, para distinguirlas de un vistazo. Berdina se queda
// con el bordó, que es el de Compras en la página principal; los roles llevan
// el suyo, porque son cosas distintas.
const SECCIONES = [
  {
    id: 'berdina',
    titulo: 'Berdina',
    subtitulo: 'Pedidos y pendientes del taller',
    icono: 'bi bi-building-fill',
    destino: '/compras/berdina',
    permiso: GRUPO.comprasTaller,
    colores: {
      fondo: 'linear-gradient(135deg, #7a1828 0%, #9d2235 100%)',
      fondoHover: 'linear-gradient(135deg, #4a0812 0%, #7a1828 100%)',
      borde: '#f59e0b',
      icono: '#fcd34d',
      brillo: 'rgba(245,158,11,0.25)',
    },
  },
  {
    id: 'sanpablo',
    titulo: 'San Pablo',
    subtitulo: 'Pedidos y pendientes del taller',
    icono: 'bi bi-tree-fill',
    destino: '/compras/sanpablo',
    permiso: GRUPO.comprasTaller,
    colores: {
      fondo: 'linear-gradient(135deg, #14532d 0%, #166534 100%)',
      fondoHover: 'linear-gradient(135deg, #052e16 0%, #14532d 100%)',
      borde: '#4ade80',
      icono: '#bbf7d0',
      brillo: 'rgba(74,222,128,0.25)',
    },
  },
  {
    id: 'analista',
    titulo: 'Analista',
    subtitulo: 'Análisis de los pedidos y sus precios',
    icono: 'bi bi-clipboard-data-fill',
    destino: '/compras/analista',
    permiso: 'compras.analista',
    colores: {
      fondo: 'linear-gradient(135deg, #3730a3 0%, #4f46e5 100%)',
      fondoHover: 'linear-gradient(135deg, #1e1b4b 0%, #3730a3 100%)',
      borde: '#818cf8',
      icono: '#c7d2fe',
      brillo: 'rgba(129,140,248,0.25)',
    },
  },
  {
    id: 'comprador',
    titulo: 'Comprador',
    subtitulo: 'Armado de las órdenes de pago',
    icono: 'bi bi-cart-fill',
    destino: '/compras/comprador',
    permiso: 'compras.comprador',
    colores: {
      fondo: 'linear-gradient(135deg, #155e75 0%, #0e7490 100%)',
      fondoHover: 'linear-gradient(135deg, #083344 0%, #155e75 100%)',
      borde: '#22d3ee',
      icono: '#a5f3fc',
      brillo: 'rgba(34,211,238,0.25)',
    },
  },
  {
    id: 'gerencia',
    titulo: 'Gerencia',
    subtitulo: 'Autorización de pedidos e historial',
    icono: 'bi bi-patch-check-fill',
    destino: '/compras/gerencia',
    permiso: 'compras.gerencia',
    colores: {
      fondo: 'linear-gradient(135deg, #1b4332 0%, #2d6a4f 100%)',
      fondoHover: 'linear-gradient(135deg, #081c15 0%, #1b4332 100%)',
      borde: '#10b981',
      icono: '#6ee7b7',
      brillo: 'rgba(16,185,129,0.25)',
    },
  },
]

export default function Inicio() {
  const navigate = useNavigate()
  const { puede } = usePermisos()
  const { user } = useAuth()
  const [hovered, setHovered] = useState(null)

  const visibles = SECCIONES.filter((s) => puede(s.permiso))

  // La sección de quien está logueado va con su color y el resto en gris, para
  // que cada uno reconozca la suya de entrada (utils/seccionPropia.js). Si no
  // hay ninguna propia —el superadmin, por ejemplo— quedan todas con su color.
  const propia = seccionPropia(user)
  const coloresDe = (s) => (!propia || s.id === propia ? s.colores : COLORES_NEUTROS)

  // Tres tarjetas por fila como máximo: más chicas no se leen. Con una o dos
  // el ancho se achica para que no queden estiradas a lo ancho de la pantalla.
  const columnas = Math.min(visibles.length, 3) || 1
  const anchoGrilla = columnas === 1 ? '320px' : columnas === 2 ? '640px' : '960px'

  // Con las cinco secciones a la vista van dos arriba y tres abajo, y las de
  // arriba caen justo sobre los huecos de la fila de abajo. Sale de una grilla
  // de seis columnas: cada tarjeta ocupa dos, y la fila de arriba arranca
  // corrida una, así queda centrada sobre las juntas.
  const enCinco = visibles.length === 5
  const COLUMNA = ['2 / span 2', '4 / span 2', '1 / span 2', '3 / span 2', '5 / span 2']

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
        {/* Sin encabezado: el navbar de arriba ya dice Compras. */}

        {/* Tarjetas de las secciones */}
        <div className="flex-grow-1 d-flex align-items-center justify-content-center">
          {visibles.length === 0 ? (
            <span className="text-muted" style={{ fontSize: '0.9rem' }}>
              Tu usuario no tiene ninguna sección de Compras habilitada.
            </span>
          ) : (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: enCinco ? 'repeat(6, 1fr)' : `repeat(${columnas}, 1fr)`,
                gap: '1.75rem',
                width: '100%',
                maxWidth: anchoGrilla,
                margin: '0 auto',
              }}
            >
              {visibles.map((s, i) => {
                const isHovered = hovered === s.id
                const colores = coloresDe(s)
                const esPropia = s.id === propia
                return (
                  <div
                    key={s.id}
                    className="d-flex flex-column align-items-center justify-content-center text-center p-4"
                    style={{
                      gridColumn: enCinco ? COLUMNA[i] : undefined,
                      // Con cuatro tarjetas van tres arriba y una abajo: esa
                      // última se centra en vez de quedar a la izquierda.
                      ...(enCinco ? {} : ultimaCentrada(i, visibles.length, columnas)),
                      background: isHovered ? colores.fondoHover : colores.fondo,
                      borderRadius: '20px',
                      height: '230px',
                      color: '#fff',
                      cursor: 'pointer',
                      // La propia lleva su borde siempre, no solo al pasar el
                      // mouse: con el color ya se distingue, y el borde lo
                      // remarca.
                      border: `1px solid ${
                        isHovered || esPropia ? colores.borde : 'rgba(255,255,255,0.12)'
                      }`,
                      boxShadow: isHovered
                        ? `0 18px 30px -10px rgba(0,0,0,0.4), 0 0 16px ${colores.brillo}`
                        : esPropia
                        ? `0 8px 18px -6px rgba(0,0,0,0.25), 0 0 12px ${colores.brillo}`
                        : '0 8px 18px -6px rgba(0,0,0,0.25)',
                      transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                      transform: isHovered ? 'translateY(-4px)' : 'translateY(0)',
                      userSelect: 'none',
                    }}
                    onClick={() => navigate(s.destino)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => e.key === 'Enter' && navigate(s.destino)}
                    onMouseEnter={() => setHovered(s.id)}
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
                      <i className={s.icono} style={{ fontSize: '2.1rem', color: colores.icono }}></i>
                    </div>

                    <span className="fw-bold" style={{ fontSize: '1.25rem', letterSpacing: '0.2px' }}>
                      {s.titulo}
                    </span>

                    <span
                      className="mt-2 px-2"
                      style={{ fontSize: '0.82rem', color: 'rgba(255,255,255,0.72)' }}
                    >
                      {s.subtitulo}
                    </span>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </Container>
    </div>
  )
}
