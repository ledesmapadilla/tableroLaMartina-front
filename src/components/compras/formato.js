/**
 * El formato común de las pantallas de Compras: color y estilos de tabla.
 *
 * Es el formato de Producción (docs/formato-tablas.md) con el bordó de Compras
 * en lugar del verde. Los componentes que lo acompañan (filtros, botones) están
 * en estilos.jsx: van separados porque un archivo no puede exportar componentes
 * y constantes a la vez sin romper el hot reload de Vite.
 */

// El bordó de Compras. Es lo que en Producción es el verde #1b4332.
export const BORDO = '#7a1828'

// El bordó clarito, para los chips del encabezado.
export const BORDO_SUAVE = '#fdeaee'

/**
 * El número de pedido en las tablas, que se toca para ver el detalle
 * (20/09/2026). El de un pedido con varios ítems va en el bordó de Compras,
 * el mismo del borde y del ojo que ya lo marcan; el de un pedido de un solo
 * ítem va en índigo, para diferenciarlos de un vistazo.
 */
export const COLOR_NRO_MULTIPLE = BORDO
export const COLOR_NRO_SIMPLE = '#3730a3'

export const th = {
  backgroundColor: BORDO,
  color: '#fff',
  fontSize: '0.66rem',
  fontWeight: 600,
  verticalAlign: 'middle',
  padding: '3px 5px',
  whiteSpace: 'nowrap',
}
export const thCentro = { ...th, textAlign: 'center' }

export const td = { fontSize: '0.7rem', padding: '1px 5px', verticalAlign: 'middle' }
export const tdCentro = { ...td, textAlign: 'center' }

/**
 * Variante grande, para las tablas de pocas filas —la orden de pago tiene
 * uno o dos ítems—, donde las filas finas del informe dejan media pantalla
 * vacía. Mismo formato, con más aire y letra más grande.
 */
export const thGrande = { ...th, fontSize: '0.82rem', padding: '9px 12px' }
export const thGrandeCentro = { ...thGrande, textAlign: 'center' }

export const tdGrande = { ...td, fontSize: '0.9rem', padding: '8px 12px' }
export const tdGrandeCentro = { ...tdGrande, textAlign: 'center' }

// Todos los campos de formulario y de modal van iguales.
export const campo = { fontSize: '0.85rem' }
