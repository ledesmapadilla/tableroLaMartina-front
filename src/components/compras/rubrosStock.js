/**
 * Los rubros del almacén de repuestos (22/09/2026).
 *
 * Una entrada por tarjeta del stock, con la clave de su tarjeta en `Stock.jsx`
 * —que es también la de la ruta y la del back—. Todos se miran con la misma
 * pantalla (`StockRubro.jsx`), así que acá está lo único que los diferencia.
 *
 * El color es el de la tarjeta: adentro del almacén cada rubro lleva el suyo
 * y no el bordó de Compras. `cebra` y `hover` son los de la columna de
 * Acciones, que al quedar fija necesita fondo propio.
 *
 * `titulo` es lo que se lee arriba de la tabla. En los rubros que juntan cosas
 * distintas va el subtítulo de la tarjeta y no su nombre: "Cubiertas y correas"
 * deja afuera las baterías, y esa lista sí las nombra a todas.
 *
 * `tipos` es la lista de la que elige el alta. Solo Filtros la tiene: en los
 * demás la descripción se escribe a mano, porque no hay lista que contenga
 * todas las medidas de una cubierta ni todos los bulones.
 */
const ARTICULO = ['artículo', 'artículos']

export const RUBROS = {
  repuestos: {
    titulo: 'Los repuestos de los equipos',
    icono: 'bi bi-gear-wide-connected',
    hoja: 'Repuestos',
    archivo: 'almacen_repuestos',
    nombre: ARTICULO,
    color: '#1e3a8a',
    colorSuave: '#e8eefb',
    acento: '#60a5fa',
    colorGuardar: '#1d4ed8',
    cebra: '#f0f4fb',
    hover: '#dce7f9',
  },
  filtros: {
    titulo: 'Filtros',
    icono: 'bi bi-funnel-fill',
    hoja: 'Filtros',
    archivo: 'almacen_filtros',
    nombre: ['filtro', 'filtros'],
    // El tipo dice "filtro" completo: la columna se lee sola, sin depender del
    // título de la pantalla. Es como ya se nombran en Tractores › Repuestos, y
    // tiene que decir lo mismo que el catálogo del back. El orden es el de uso
    // en el taller, no el alfabético.
    tipos: [
      'Filtro de aire',
      'Filtro de combustible',
      'Filtro de aceite',
      'Filtro hidráulico',
      'Filtro trampa de agua',
    ],
    color: '#1b4332',
    colorSuave: '#e8f5ee',
    acento: '#10b981',
    colorGuardar: '#15803d',
    cebra: '#f1f5f4',
    hover: '#dcefe4',
  },
  cubiertas: {
    titulo: 'Gomería, baterías, correas y cadenas',
    icono: 'bi bi-record-circle-fill',
    hoja: 'Cubiertas y correas',
    archivo: 'almacen_cubiertas',
    nombre: ARTICULO,
    color: '#134e4a',
    colorSuave: '#e6f5f3',
    acento: '#2dd4bf',
    colorGuardar: '#0f766e',
    cebra: '#eef5f4',
    hover: '#d7efec',
  },
  ferreteria: {
    titulo: 'Bulonería, hierro y electrodos',
    icono: 'bi bi-nut-fill',
    hoja: 'Ferretería y herrería',
    archivo: 'almacen_ferreteria',
    nombre: ARTICULO,
    color: '#7c2d12',
    colorSuave: '#fbeee4',
    acento: '#fbbf24',
    colorGuardar: '#b45309',
    cebra: '#f9f2ec',
    hover: '#f6e3cd',
  },
  electricidad: {
    titulo: 'Cables, luces y material eléctrico',
    icono: 'bi bi-lightning-charge-fill',
    hoja: 'Electricidad',
    archivo: 'almacen_electricidad',
    nombre: ARTICULO,
    color: '#3730a3',
    colorSuave: '#eceafb',
    acento: '#818cf8',
    colorGuardar: '#4338ca',
    cebra: '#f2f1fb',
    hover: '#e1dff8',
  },
  herramientas: {
    titulo: 'Las herramientas del taller',
    // Una herramienta no se consume: se presta y vuelve. Además de la
    // existencia lleva a cargo de quién está, que es el único rubro que lo usa.
    aCargo: true,
    icono: 'bi bi-tools',
    hoja: 'Herramientas',
    archivo: 'almacen_herramientas',
    nombre: ARTICULO,
    color: '#7a1828',
    colorSuave: '#fae9ec',
    acento: '#f59e0b',
    colorGuardar: '#9d2235',
    cebra: '#f9eff1',
    hover: '#f3dbe0',
  },
}

/**
 * El catálogo general, la tarjeta alargada de arriba.
 *
 * No es un rubro: es todo el almacén junto, de solo lectura. Va acá igual para
 * que el color y el ícono salgan del mismo lugar que los de los rubros.
 */
export const CATALOGO = {
  titulo: 'Catálogo general',
  subtitulo: 'Todo el almacén junto, de todos los rubros',
  icono: 'bi bi-card-list',
  hoja: 'Catálogo general',
  archivo: 'almacen_catalogo',
  color: '#155e75',
  colorSuave: '#e0f5fa',
  acento: '#22d3ee',
  cebra: '#eef7fa',
  hover: '#d5eef5',
}

// El rubro de una tarjeta, con su clave adentro: es la que arma la URL del
// back. El id de la tarjeta, el de la ruta y el del back son el mismo. Devuelve
// undefined si esa tarjeta no es un rubro: el catálogo general es la lista de
// todo lo que existe y todavía no tiene pantalla.
export const rubroDe = (seccion) => RUBROS[seccion] && { clave: seccion, ...RUBROS[seccion] }
