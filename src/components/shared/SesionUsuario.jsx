import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'

/**
 * Quién está logueado y el botón para salir.
 *
 * El login es del proyecto entero, no de una sección: se entra una vez y la
 * sesión vale para Compras, Mantenimiento y Producción. Por eso esto vive acá
 * y va en las cuatro entradas —la página principal y los tres navbars—, para
 * no tener que pasar por Compras solo para cerrar sesión.
 *
 * Va sobre fondos oscuros, que es lo que tienen las cuatro.
 */
export default function SesionUsuario({ mostrarRol = false }) {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  if (!user) return null

  const salir = () => {
    logout()
    navigate('/login', { replace: true })
  }

  return (
    <div className="d-flex align-items-center gap-2">
      <div className="d-flex flex-column lh-sm text-end">
        <span className="text-white fw-semibold" style={{ fontSize: '0.82rem' }}>
          {user.nombre}
        </span>
        {mostrarRol && (
          <span className="text-white" style={{ fontSize: '0.68rem', opacity: 0.7 }}>
            {user.rol}
          </span>
        )}
      </div>
      <button
        onClick={salir}
        className="btn btn-sm btn-outline-light d-flex align-items-center justify-content-center rounded-3"
        style={{ width: '32px', height: '30px', padding: 0 }}
        title={`Cerrar la sesión de ${user.nombre}`}
      >
        <i className="bi bi-box-arrow-right"></i>
      </button>
    </div>
  )
}
