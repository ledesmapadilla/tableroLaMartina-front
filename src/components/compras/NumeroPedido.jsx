import { COLOR_SERVICIO } from './formato'

/**
 * Muestra el número de un pedido ya armado con fmtNro (nroPedido.js) y, si es
 * de servicio, pinta la S del final de otro color: B-045-S (03/11/2026).
 * El resto del número hereda el color de donde esté puesto.
 */
const NumeroPedido = ({ texto }) => {
  if (!texto || !texto.endsWith('-S')) return texto || null
  return (
    <>
      {texto.slice(0, -1)}
      <span style={{ color: COLOR_SERVICIO, fontWeight: 700 }}>S</span>
    </>
  )
}

export default NumeroPedido
