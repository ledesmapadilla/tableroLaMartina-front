import { createContext, useContext } from 'react'

// Va aparte del proveedor (PermisosContext.jsx): un archivo que exporta un
// componente y un hook rompe el hot reload de Vite.
export const PermisosContext = createContext(null)

/**
 * Lo que puede quien está logueado: `puede(clave, 'ver' | 'editar')`, con las
 * claves de utils/permisosCatalogo.js, y `cargados` cuando ya llegaron de la
 * base.
 */
export const usePermisos = () => useContext(PermisosContext)
