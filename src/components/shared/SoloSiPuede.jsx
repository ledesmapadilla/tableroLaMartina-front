import { usePermisos } from "../../context/permisos";

/**
 * Muestra lo de adentro solo si el rol puede (tabla de Altas › Usuarios ›
 * Roles). `permiso` es una clave de utils/permisosCatalogo.js o una lista
 * (alcanza con una); `accion` es "ver" (por defecto) o "editar".
 */
export default function SoloSiPuede({ permiso, accion = "ver", children }) {
  const { puede } = usePermisos();
  return puede(permiso, accion) ? children : null;
}
