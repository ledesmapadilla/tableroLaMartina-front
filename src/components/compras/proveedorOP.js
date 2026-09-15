import { useCallback, useEffect, useState } from 'react'
import { api } from '../../services/api'

/**
 * A qué proveedor se le compró cada ítem. Sale de la orden de pago, que
 * guarda el proveedor de cada ítem tal como quedó al generarla (el comprador
 * puede cambiarlo en la vista previa); el pedido solo guarda el número de OP.
 *
 * Devuelve una función que, para una fila de las tablas de pedidos (un ítem o
 * un pedido agrupado), da el nombre del proveedor, "Varios" si son distintos,
 * o '' si no hay ninguno. Se relee al volver a la pantalla, como el monto de
 * autorización.
 */
export const useProveedorDeOP = () => {
  const [porItem, setPorItem] = useState(() => new Map())

  useEffect(() => {
    let vigente = true
    const leer = () =>
      Promise.all([api.get('/op').catch(() => []), api.get('/proveedores').catch(() => [])]).then(
        ([ordenes, proveedores]) => {
          if (!vigente) return
          const nombres = new Map((proveedores || []).map((p) => [String(p._id), p.razonsocial]))
          const mapa = new Map()
          for (const orden of ordenes || []) {
            for (const it of orden.items || []) {
              const nombre = nombres.get(String(it.proveedor))
              if (it.itemId && nombre) mapa.set(String(it.itemId), nombre)
            }
          }
          setPorItem(mapa)
        }
      )
    leer()
    window.addEventListener('focus', leer)
    return () => {
      vigente = false
      window.removeEventListener('focus', leer)
    }
  }, [])

  return useCallback(
    (fila) => {
      const items = fila?._agrupado ? fila._items : [fila]
      const nombres = [...new Set(items.map((i) => porItem.get(String(i?._id))).filter(Boolean))]
      return nombres.length === 0 ? '' : nombres.length === 1 ? nombres[0] : 'Varios'
    },
    [porItem]
  )
}
