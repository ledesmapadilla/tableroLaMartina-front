import { useEffect, useState } from 'react'
import { useAuth } from './AuthContext'
import { PermisosContext } from './permisos'
import { api } from '../services/api'
import { resolverPermisos } from '../utils/permisosCatalogo'

/**
 * Lo que puede ver y editar quien está logueado, según su rol. Se lee con
 * usePermisos() (context/permisos.js).
 *
 * Los permisos se piden a la base (/api/roles/mio) al entrar, al recargar y
 * cada vez que se vuelve a la pestaña; si el pedido falla se reintenta. Hasta
 * que llegan por primera vez vale el acceso de antes (ver
 * utils/permisosCatalogo.js). `cargados` dice si ya llegaron.
 */
export function PermisosProvider({ children }) {
  const { user } = useAuth()
  const rol = user?.rol
  // Se guarda de qué rol son: si entra otro usuario no se mezclan.
  const [guardados, setGuardados] = useState({ rol: null, permisos: {} })

  useEffect(() => {
    if (!rol) return
    let vigente = true
    let reintento = null

    const cargar = () => {
      clearTimeout(reintento)
      api
        .get('/roles/mio')
        .then((d) => {
          if (vigente) setGuardados({ rol, permisos: d?.permisos || {} })
        })
        .catch(() => {
          if (!vigente) return
          // Se conservan los últimos que llegaron bien; si nunca llegaron,
          // vale el acceso de antes. Se vuelve a intentar en un rato (por
          // ejemplo, si el back se estaba reiniciando).
          setGuardados((g) => (g.rol === rol ? g : { rol, permisos: {} }))
          reintento = setTimeout(cargar, 10000)
        })
    }
    cargar()

    // Se vuelven a pedir al volver a la pestaña: un cambio hecho en Roles, o
    // un pedido que había fallado, se corrige solo, sin salir y volver a
    // entrar. Antes se pedían una sola vez y un fallo quedaba hasta recargar.
    const alVolver = () => {
      if (document.visibilityState === 'visible') cargar()
    }
    window.addEventListener('focus', alVolver)
    document.addEventListener('visibilitychange', alVolver)
    return () => {
      vigente = false
      clearTimeout(reintento)
      window.removeEventListener('focus', alVolver)
      document.removeEventListener('visibilitychange', alVolver)
    }
  }, [rol])

  const cargados = Boolean(rol) && guardados.rol === rol
  const permisos = resolverPermisos(rol, cargados ? guardados.permisos : {})
  // Con una lista alcanza con que pueda alguna: la tarjeta de un menú se ve si
  // se ve alguna de las pantallas que agrupa.
  const puede = (clave, accion = 'ver') =>
    Array.isArray(clave)
      ? clave.some((c) => Boolean(permisos[c]?.[accion]))
      : Boolean(permisos[clave]?.[accion])

  return (
    <PermisosContext.Provider value={{ permisos, puede, cargados }}>
      {children}
    </PermisosContext.Provider>
  )
}
