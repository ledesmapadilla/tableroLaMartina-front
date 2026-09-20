/**
 * El apuro: la campana con la que se le reclama al que tiene la tarea
 * pendiente (20/09/2026).
 *
 * Lo puede tocar cualquiera que vea el pedido, menos el que tiene que
 * resolverlo: apurarse a uno mismo no tiene sentido. Queda guardado en el ítem
 * (`apuro: { fecha, por }`) y el back lo borra solo cuando el pedido cambia de
 * estado, o sea cuando el reclamo ya está resuelto.
 */

/** Qué permiso tiene la tarea pendiente, según dónde está parado el pedido. */
export const PERMISO_RESPONSABLE = {
  'Para analisis': 'compras.analista',
  'En analisis': 'compras.analista',
  Pedido: 'compras.analista',
  'Para revision': 'compras.analista',
  Autorizar: 'compras.gerencia',
  'Para hacer OP': 'compras.comprador',
  'Para retirar': 'compras.comprador',
}

/** Los estados que están esperando a alguien: los demás no se apuran. */
export const esperaAAlguien = (estado) => Boolean(PERMISO_RESPONSABLE[estado])

/**
 * Si este usuario puede apurar un pedido que está en ese estado: cuando el
 * pedido espera a otro y él no es ese otro. `puede` es el de usePermisos().
 *
 * El superadmin es la excepción: puede editar todas las pantallas, así que con
 * la regla general nunca podría apurar a nadie. Como no es el que resuelve
 * ninguna etapa, se lo deja apurar todo.
 */
export const sePuedeApurar = (estado, puede, rol) => {
  const responsable = PERMISO_RESPONSABLE[estado]
  if (!responsable) return false
  if (rol === 'superadmin') return true
  // Quien puede editar la pantalla que tiene la tarea es el responsable.
  return !puede(responsable, 'editar')
}

/**
 * Lo mismo para una fila de la tabla. Una fila puede ser un pedido entero, y
 * si sus ítems están en estados distintos el estado viene colapsado como
 * "Varios": entonces se mira ítem por ítem y alcanza con que alguno se pueda
 * apurar.
 */
export const sePuedeApurarFila = (fila, puede, rol) =>
  itemsDeLaFila(fila).some((i) => sePuedeApurar(i.estado, puede, rol))

/** "20/9 a las 14:35", para el aviso de quién apuró y cuándo. */
export const cuando = (fecha) => {
  if (!fecha) return ''
  const d = new Date(fecha)
  if (isNaN(d)) return ''
  return d.toLocaleString('es-AR', { day: 'numeric', month: 'numeric', hour: '2-digit', minute: '2-digit' })
}

/**
 * Los ítems de una fila: un pedido agrupado se apura entero.
 *
 * Las tablas de pedidos agrupan en `_items`; Gerencia y su historial arman el
 * pedido con `items`. Una fila que es un ítem suelto se devuelve sola.
 */
export const itemsDeLaFila = (fila) => {
  if (fila._agrupado) return fila._items || []
  if (Array.isArray(fila.items)) return fila.items
  return [fila]
}

/** Si alguno de los ítems de la fila está apurado, con qué datos. */
export const apuroDeLaFila = (fila) =>
  itemsDeLaFila(fila).map((i) => i.apuro).find((a) => a?.fecha) || null
