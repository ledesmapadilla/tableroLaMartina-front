/**
 * El número de un pedido como se muestra en Compras: B-012 los de Berdina,
 * SP-045 los de San Pablo. Los que salen de Reparaciones San Pablo
 * (`origen` "reparaciones", 06/10/2026) llevan una R adelante del número:
 * SP-R045. Los de servicio (29/10/2026) llevan una S al final: SP-045-S.
 */
export const fmtNro = (n, src, origen, servicio) =>
  `${src === 'berdina' ? 'B' : 'SP'}-${origen === 'reparaciones' ? 'R' : ''}${String(n).padStart(3, '0')}${servicio ? '-S' : ''}`
