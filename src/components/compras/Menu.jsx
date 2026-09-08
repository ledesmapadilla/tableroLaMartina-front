import { Link, NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'

const closeMenu = () => {
  const el = document.getElementById('navMenu')
  if (el?.classList.contains('show')) el.classList.remove('show')
}

const TODOS = ['superadmin', 'solicitante', 'analista', 'comprador', 'gerente']
const SIN_SOLICITANTE = TODOS.filter(r => r !== 'solicitante')

const NAV_ITEMS = [
  { label: 'Berdina',   to: '/compras/berdina',   roles: TODOS },
  { label: 'San Pablo', to: '/compras/sanpablo',   roles: TODOS },
  { label: 'Analista',  to: '/compras/analista',   roles: SIN_SOLICITANTE },
  { label: 'Comprador', to: '/compras/comprador',  roles: SIN_SOLICITANTE },
  { label: 'Gerencia',  to: '/compras/gerencia',   roles: ['gerente', 'superadmin'] },
]

export default function Menu() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  const handleLogout = () => {
    closeMenu()
    logout()
    navigate('/login', { replace: true })
  }

  const visibles = user
    ? NAV_ITEMS.filter(i => i.roles.includes(user.rol))
    : []

  return (
    <nav className="navbar navbar-expand-lg navbar-dark bg-dark sticky-top">
      <div className="container position-relative">
        <Link className="navbar-brand d-flex align-items-center gap-2" to="/compras">
          <img
            src="/logo LM.jpg"
            alt="Logo La Martina"
            height="54"
            style={{
              maskImage: 'linear-gradient(to right, transparent 0%, black 20%, black 80%, transparent 100%), linear-gradient(to bottom, transparent 0%, black 10%, black 90%, transparent 100%)',
              WebkitMaskImage: 'linear-gradient(to right, transparent 0%, black 20%, black 80%, transparent 100%), linear-gradient(to bottom, transparent 0%, black 10%, black 90%, transparent 100%)',
              maskComposite: 'intersect',
              WebkitMaskComposite: 'destination-in',
            }}
          />
        </Link>
        <button
          className="navbar-toggler"
          type="button"
          data-bs-toggle="collapse"
          data-bs-target="#navMenu"
        >
          <span className="navbar-toggler-icon" />
        </button>
        <div className="collapse navbar-collapse" id="navMenu">
          <ul className="navbar-nav navbar-nav-center">
            {visibles.map(item => (
              <li className="nav-item" key={item.to}>
                <NavLink
                  className={({ isActive }) => `nav-link${isActive ? ' nav-activo' : ''}`}
                  to={item.to}
                  onClick={closeMenu}
                >
                  {item.label}
                </NavLink>
              </li>
            ))}
          </ul>
          <ul className="navbar-nav ms-auto align-items-center gap-2">
            {['superadmin', 'analista', 'comprador', 'gerente'].includes(user?.rol) && (
              <li className="nav-item dropdown">
                <a className="nav-link dropdown-toggle" href="#" role="button" data-bs-toggle="dropdown">
                  Altas
                </a>
                <ul className="dropdown-menu dropdown-menu-dark dropdown-menu-end">
                  {user?.rol === 'superadmin' && (
                    <li><Link className="dropdown-item" to="/compras/altas/usuarios" onClick={closeMenu}>Usuarios</Link></li>
                  )}
                  <li><Link className="dropdown-item" to="/compras/altas/proveedores" onClick={closeMenu}>Proveedores</Link></li>
                  <li><Link className="dropdown-item" to="/compras/altas/centros-costo" onClick={closeMenu}>Centros de Costo (CC)</Link></li>
                </ul>
              </li>
            )}
            {user && (
              <>
                <li className="nav-item">
                  <span className="nav-link pe-0" style={{ fontSize: 13, opacity: 0.75 }}>
                    {user.nombre}
                  </span>
                </li>
                <li className="nav-item">
                  <button className="btn btn-outline-light btn-sm" onClick={handleLogout}>
                    Cerrar sesión
                  </button>
                </li>
              </>
            )}
          </ul>
        </div>
      </div>
    </nav>
  )
}
