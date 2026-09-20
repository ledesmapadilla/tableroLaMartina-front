import { api } from './api'

/**
 * El stock del almacén contra la API (20/09/2026).
 *
 * Reemplaza al prototipo que guardaba todo en el navegador: ahora los
 * artículos y los movimientos viven en la base y los ve todo el mundo.
 *
 * La regla la impone el back: **el saldo de un artículo solo cambia por un
 * movimiento**. Por eso `guardarArticulo` no manda la cantidad al editar, y
 * para mover el saldo está `registrarMovimiento`.
 */

export const TIPOS = { ENTRADA: 'entrada', SALIDA: 'salida', AJUSTE: 'ajuste' }

export const NOMBRE_TIPO = {
  entrada: 'Entrada',
  salida: 'Salida',
  ajuste: 'Ajuste',
}

/** Los dos talleres a los que se entrega. */
export const TALLERES = [
  { clave: 'berdina', nombre: 'Berdina' },
  { clave: 'sanpablo', nombre: 'San Pablo' },
]

export const listarArticulos = () => api.get('/stock')

/**
 * Da de alta o corrige un artículo. En el alta, `cantidad` entra como
 * movimiento de carga inicial; al editar no viaja, porque el saldo se mueve
 * con Ingresar, Entregar o Ajustar.
 */
export const guardarArticulo = ({ id, cantidad, ...datos }) =>
  id ? api.put(`/stock/${id}`, datos) : api.post('/stock', { ...datos, cantidad })

export const borrarArticulo = (id) => api.delete(`/stock/${id}`)

export const movimientosDe = (id) => api.get(`/stock/${id}/movimientos`)

export const registrarMovimiento = ({ articuloId, tipo, cantidad, taller, persona, nota }) =>
  api.post(`/stock/${articuloId}/movimientos`, { tipo, cantidad, taller, persona, nota })
