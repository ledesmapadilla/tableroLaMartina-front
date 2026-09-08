import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";

/**
 * Deja pasar solo a quien esté logueado, y con el rol que corresponda.
 *
 * Es la de Compras, movida a shared porque ahora protege todo el proyecto.
 * Dos cambios sobre la original: recuerda a dónde se quería ir, para volver
 * ahí después del login, y manda al inicio general cuando el rol no alcanza.
 */
export default function RutaProtegida({ children, roles }) {
  const { user } = useAuth();
  const location = useLocation();

  if (!user) {
    // `state.desde` lo lee el Login para devolver a la pantalla pedida en vez
    // de dejar a todos en la principal.
    return <Navigate to="/login" replace state={{ desde: location.pathname }} />;
  }

  if (roles && !roles.includes(user.rol)) return <Navigate to="/" replace />;

  return children;
}
