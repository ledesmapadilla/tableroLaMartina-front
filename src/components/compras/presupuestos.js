/**
 * Presupuestos reparaciones (08/10/2026): los repuestos que el taller manda a
 * cotizar desde Manitous › General. El analista hace solo el paso del
 * análisis y quedan "Cotizado"; no siguen a OP ni a Gerencia.
 */

export const ESTADOS_PRESUPUESTO = ['Para cotizar', 'Cotizado']

// El número con que se lo nombra: PR-001.
export const fmtPresupuesto = (nro) => (nro ? `PR-${String(nro).padStart(3, '0')}` : '')
