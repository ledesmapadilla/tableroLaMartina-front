/**
 * Lo que comparten las dos pantallas de aceites (28/09/2026): el color de su
 * tarjeta en el almacén y cómo se escriben los litros y la plata.
 *
 * Es el ámbar oscuro de la tarjeta. `cebra` y `hover` son los de la columna
 * de Acciones, que al quedar fija necesita fondo propio.
 */
export const A = {
  API: '/stock/aceites',
  color: '#713f12',
  colorSuave: '#fef9c3',
  acento: '#ca8a04',
  cebra: '#fdfbef',
  hover: '#fbf3cf',
  icono: 'bi bi-droplet-fill',
}

// Los litros van con coma y hasta dos decimales: 12,5 L.
export const litros = (n) =>
  Number(n ?? 0).toLocaleString('es-AR', { maximumFractionDigits: 2 })

export const pesos = (n) =>
  `$ ${Number(n ?? 0).toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`

// Cómo se nombra un aceite en una línea: "Motor · Shell · Rimula R4 15W40".
export const nombreAceite = (a) => [a?.tipo, a?.marca, a?.denominacion].filter(Boolean).join(' · ')

// Para buscar: sin acentos y sin distinguir mayúsculas.
export const normalizar = (t) =>
  (t ?? '')
    .toString()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()

export const hoy = () => new Date().toISOString().slice(0, 10)

// dd/mm/aaaa sin correrse de día: la fecha viene a medianoche UTC.
export const fechaCorta = (f) => (f ? new Date(f).toLocaleDateString('es-AR', { timeZone: 'UTC' }) : '')
