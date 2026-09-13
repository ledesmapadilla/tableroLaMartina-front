/**
 * Qué proveedor y qué precio valen para un ítem analizado. El analista carga
 * hasta tres presupuestos; por defecto vale el más barato, pero puede elegir
 * otro (`elegido`: 1, 2 o 3). Lo usan el análisis, Gerencia y la orden de
 * compra, para que todos cuenten con el mismo proveedor.
 *
 * Sirve para el ítem guardado y para el formulario del análisis, donde los
 * precios son texto.
 */

// Los presupuestos que tienen precio, como { n, precio, proveedor }.
export const opcionesDePrecio = (item = {}) =>
  [1, 2, 3]
    .map((n) => ({ n, precio: Number(item[`precio${n}`]), proveedor: item[`proveedor${n}`] || '' }))
    .filter((o) => Number.isFinite(o.precio) && o.precio > 0)

// El más barato; a igual precio, el primero.
export const opcionMinima = (opciones) =>
  opciones.length ? opciones.reduce((a, b) => (b.precio < a.precio ? b : a)) : null

/**
 * El presupuesto con el que se cuenta: el elegido si todavía tiene precio, si
 * no el más barato. `esMinima` dice si coincide con el precio más bajo.
 * Devuelve null si el ítem no tiene ningún precio cargado.
 */
export const opcionElegida = (item = {}) => {
  const opciones = opcionesDePrecio(item)
  const minima = opcionMinima(opciones)
  if (!minima) return null
  const elegida = opciones.find((o) => o.n === Number(item.elegido)) || minima
  return { ...elegida, esMinima: elegida.precio === minima.precio }
}
