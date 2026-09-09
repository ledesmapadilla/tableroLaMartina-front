import { useEffect, useRef, useState } from 'react'
import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import LogoNavbar from '../shared/LogoNavbar'
import SesionUsuario from '../shared/SesionUsuario'
import { useAuth } from '../../context/AuthContext'
import { PERMISOS } from '../../utils/permisos'

// Los padrones de Compras. Es el único desplegable de la barra: a las
// secciones (Berdina, San Pablo, Analista, Comprador, Gerencia) se entra por
// las tarjetas de Inicio, igual que en Producción se entra por las suyas.
//
// Los roles salen de PERMISOS, el mismo con el que App.jsx protege cada ruta.
const ALTAS = [
  {
    to: '/compras/altas/usuarios',
    label: 'Usuarios',
    icon: 'bi bi-person-badge-fill',
    roles: PERMISOS.comprasUsuarios,
  },
  {
    to: '/compras/altas/proveedores',
    label: 'Proveedores',
    icon: 'bi bi-truck',
    roles: PERMISOS.comprasAnalista,
  },
  {
    to: '/compras/altas/centros-costo',
    label: 'Centros de Costo (CC)',
    icon: 'bi bi-diagram-3-fill',
    roles: PERMISOS.comprasAnalista,
  },
]

// Bordó y ámbar: los colores de Compras en la página principal.
const FONDO = '#7a1828'
const ACTIVO = '#9d2235'
const ACENTO = '#f59e0b'

/**
 * En qué sección de Compras se está parado, sacado de la URL.
 *
 * Adentro de una sección las pantallas se llaman igual (Pedidos, Pendientes) y
 * no dicen de qué taller son, así que el cartel del navbar es lo único que lo
 * aclara. Cada uno lleva el color de su tarjeta en el inicio.
 *
 * Devuelve null en el inicio, donde no corresponde ninguna, y en las altas,
 * que son padrones de Compras y no cuelgan de una sección.
 */
const SECCIONES = [
  { ruta: '/compras/berdina', nombre: 'Berdina', icono: 'bi bi-building-fill', fondo: '#9d2235', borde: '#f59e0b' },
  { ruta: '/compras/sanpablo', nombre: 'San Pablo', icono: 'bi bi-tree-fill', fondo: '#166534', borde: '#4ade80' },
  { ruta: '/compras/analista', nombre: 'Analista', icono: 'bi bi-clipboard-data-fill', fondo: '#4f46e5', borde: '#818cf8' },
  { ruta: '/compras/comprador', nombre: 'Comprador', icono: 'bi bi-cart-fill', fondo: '#0e7490', borde: '#22d3ee' },
  { ruta: '/compras/gerencia', nombre: 'Gerencia', icono: 'bi bi-patch-check-fill', fondo: '#2d6a4f', borde: '#10b981' },
]

const seccionDe = (pathname) => SECCIONES.find((s) => pathname.startsWith(s.ruta)) || null

const btnSeccion = (activo) => ({
  backgroundColor: activo ? ACTIVO : 'transparent',
  border: '1px solid rgba(255, 255, 255, 0.22)',
  fontWeight: 600,
  fontSize: '0.86rem',
})

export default function Menu() {
  const navigate = useNavigate()
  const location = useLocation()
  const { user, logout } = useAuth()
  const [abierto, setAbierto] = useState(false)
  const [menuMovil, setMenuMovil] = useState(false)
  const navRef = useRef(null)

  // Cerrar lo que esté abierto al navegar o al hacer click afuera. Se cierra
  // en el propio click y no en un efecto sobre pathname: el efecto encadena un
  // render de más en cada navegación.
  const cerrar = () => {
    setAbierto(false)
    setMenuMovil(false)
  }

  const ir = (ruta) => {
    cerrar()
    navigate(ruta)
  }

  useEffect(() => {
    const handler = (e) => {
      if (navRef.current && !navRef.current.contains(e.target)) cerrar()
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const salir = () => {
    cerrar()
    logout()
    navigate('/login', { replace: true })
  }

  const altasVisibles = user ? ALTAS.filter((a) => a.roles.includes(user.rol)) : []
  const enAltas = location.pathname.startsWith('/compras/altas')
  const seccion = seccionDe(location.pathname)

  return (
    <div
      ref={navRef}
      className="d-flex align-items-center justify-content-between px-4 py-2 border-bottom shadow-sm flex-shrink-0"
      style={{
        backgroundColor: FONDO,
        color: '#fff',
        height: '54px',
        position: 'relative',
        zIndex: 30,
      }}
    >
      {/* En el celular no entra la fila de botones: se pliega en un panel. El
          logo del medio tampoco, que ahí choca con la identidad. */}
      <style>{`
        /* display:contents deja al logo fuera del reparto del flex: el <Link>
           es absoluto y se centra contra la barra, como en Producción. Un div
           común contaría como columna y correría la identidad al medio. */
        .navc-logo { display: contents; }
        .navc-desktop { display: flex; }
        .navc-toggle { display: none; }
        @media (max-width: 991.98px) {
          .navc-logo { display: none; }
          .navc-desktop { display: none; }
          .navc-toggle { display: inline-flex; }
        }
      `}</style>

      <div className="navc-logo">
        <LogoNavbar />
      </div>

      {/* Lado izquierdo: identidad de Compras y en qué sección se está */}
      <div className="d-flex align-items-center gap-3">
        <div
          className="d-flex align-items-center gap-2"
          role="button"
          onClick={() => ir('/compras')}
          style={{ cursor: 'pointer' }}
          title="Ir al inicio de Compras"
        >
          <div
            className="rounded-3 d-flex align-items-center justify-content-center"
            style={{
              width: '34px',
              height: '34px',
              backgroundColor: ACENTO,
              color: '#fff',
              fontSize: '1.15rem',
              boxShadow: '0 2px 8px rgba(245, 158, 11, 0.3)',
            }}
          >
            <i className="bi bi-cart-fill"></i>
          </div>
          <span className="text-white fw-semibold">Compras</span>
        </div>

        {/* Adentro de una sección las pantallas se llaman igual en las dos
            (Pedidos, Pendientes): el cartel es lo único que las distingue, así
            que va grande y con el color de su tarjeta. */}
        {seccion && (
          <div
            className="d-flex align-items-center gap-2 rounded-3 px-3 py-1"
            style={{
              backgroundColor: seccion.fondo,
              border: `1px solid ${seccion.borde}`,
              boxShadow: '0 2px 8px rgba(0,0,0,0.25)',
            }}
            title={`Está en ${seccion.nombre}`}
          >
            <i className={seccion.icono} style={{ color: seccion.borde }}></i>
            <span className="fw-bold text-white" style={{ fontSize: '0.95rem', letterSpacing: '0.3px' }}>
              {seccion.nombre}
            </span>
          </div>
        )}
      </div>

      {/* Lado derecho: navegación y menús de la sección */}
      <div className="navc-desktop align-items-center gap-2">
        <button
          onClick={() => { cerrar(); navigate(-1) }}
          className="btn btn-sm btn-outline-light d-flex align-items-center gap-1.5 rounded-3 px-3 py-1"
          style={{ fontSize: '0.82rem' }}
        >
          <i className="bi bi-arrow-left"></i>
          <span>Volver</span>
        </button>

        {altasVisibles.length > 0 && (
          <div style={{ position: 'relative' }}>
            <button
              onClick={() => setAbierto((v) => !v)}
              className="btn btn-sm d-flex align-items-center gap-2 rounded-3 px-3 py-1 text-white"
              style={btnSeccion(abierto || enAltas)}
            >
              <i className="bi bi-plus-circle-fill"></i>
              <span>Altas</span>
              <i className={`bi bi-chevron-${abierto ? 'up' : 'down'} small opacity-75`}></i>
            </button>

            {abierto && (
              <div
                className="shadow-lg"
                style={{
                  position: 'absolute',
                  top: 'calc(100% + 8px)',
                  right: 0,
                  minWidth: '210px',
                  backgroundColor: '#ffffff',
                  borderRadius: '12px',
                  border: '1px solid #e2e8f0',
                  overflow: 'hidden',
                  zIndex: 40,
                }}
              >
                {altasVisibles.map((a) => (
                  <NavLink
                    key={a.to}
                    to={a.to}
                    onClick={cerrar}
                    className="d-flex align-items-center gap-2 px-3 py-2 text-decoration-none"
                    style={({ isActive }) => ({
                      color: isActive ? FONDO : '#334155',
                      backgroundColor: isActive ? '#fef3c7' : 'transparent',
                      fontWeight: isActive ? 600 : 500,
                      fontSize: '0.88rem',
                    })}
                  >
                    <i className={a.icon} style={{ color: ACTIVO, minWidth: '20px' }}></i>
                    <span>{a.label}</span>
                  </NavLink>
                ))}
              </div>
            )}
          </div>
        )}

        {/* La sesión es del proyecto: el mismo bloque que en Producción y en la
            página principal. */}
        <span style={{ width: '1px', height: '24px', backgroundColor: 'rgba(255,255,255,0.22)' }} />
        <SesionUsuario />
      </div>

      {/* Celular: todo lo de arriba, apilado */}
      <button
        onClick={() => setMenuMovil((v) => !v)}
        className="navc-toggle btn btn-sm btn-outline-light align-items-center justify-content-center rounded-3"
        style={{ width: '36px', height: '32px' }}
        title="Menú"
      >
        <i className={`bi bi-${menuMovil ? 'x-lg' : 'list'}`}></i>
      </button>

      {menuMovil && (
        <div
          className="shadow-lg d-lg-none"
          style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            right: 0,
            backgroundColor: FONDO,
            borderTop: '1px solid rgba(255,255,255,0.15)',
            zIndex: 40,
            padding: '8px',
          }}
        >
          {user && (
            <div
              className="px-3 py-2 text-white"
              style={{ fontSize: '0.8rem', opacity: 0.75 }}
            >
              {user.nombre} · {user.rol}
            </div>
          )}

          <button
            onClick={() => { cerrar(); navigate(-1) }}
            className="btn btn-sm w-100 text-start d-flex align-items-center gap-2 rounded-3 px-3 py-2 text-white mb-1"
            style={btnSeccion(false)}
          >
            <i className="bi bi-arrow-left"></i>
            <span>Volver</span>
          </button>

          {altasVisibles.map((a) => (
            <NavLink
              key={a.to}
              to={a.to}
              onClick={cerrar}
              className="btn btn-sm w-100 text-start d-flex align-items-center gap-2 rounded-3 px-3 py-2 text-white mb-1"
              style={({ isActive }) => btnSeccion(isActive)}
            >
              <i className={a.icon}></i>
              <span>{a.label}</span>
            </NavLink>
          ))}

          {user && (
            <button
              onClick={salir}
              className="btn btn-sm w-100 text-start d-flex align-items-center gap-2 rounded-3 px-3 py-2 text-white"
              style={btnSeccion(false)}
            >
              <i className="bi bi-box-arrow-right"></i>
              <span>Cerrar sesión</span>
            </button>
          )}
        </div>
      )}
    </div>
  )
}
