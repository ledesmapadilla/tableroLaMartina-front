// Lo que comparten las dos pantallas de Gasoil (20/10/2026): un campo por
// tarjeta, con los colores de Berdina y San Pablo del resto del Tablero. Va
// con otro nombre que Gasoil.jsx: "gasoil.js" le ganaría al importar sin
// extensión (Windows no distingue mayúsculas y Vite prueba .js antes).
import { seccionPropia } from '../../utils/seccionPropia'

export const API_GASOIL = '/gasoil'

// Corregir un ingreso ya cargado es solo del comprador, gerencia y el
// superadmin (20/10/2026), además del "Editar" de Gasoil. El analista no.
// El back lo controla igual (gasoil.controller.js).
export const ROLES_EDITAR_INGRESO = ['comprador', 'gerente', 'superadmin']

// Los encargados de taller ven solo la solapa de ingresos, no la de consumos
// (20/10/2026). El back tampoco les da los consumos (gasoil.controller.js).
export const ROLES_SIN_CONSUMOS = ['solicitante']

// Los campos de Gasoil que ve cada uno (20/10/2026): el encargado de taller,
// solo el de su taller (Kevin Berdina; Victor y Pablo San Pablo, según
// utils/seccionPropia.js), y si no se sabe cuál es, ninguno. Los demás, los
// dos. El back controla lo mismo (gasoil.controller.js).
export const camposVisibles = (user) => {
  if (user?.rol !== 'solicitante') return CAMPOS_GASOIL
  const propia = seccionPropia(user)
  return CAMPOS_GASOIL.filter((c) => c.id === propia)
}

export const CAMPOS_GASOIL = [
  {
    id: 'berdina',
    titulo: 'Berdina',
    subtitulo: 'Consumos e ingresos de gasoil',
    color: '#991b1b',
    // El sombreado del día del stock inicial en los consumos.
    filaStock: '#fee2e2',
    colores: {
      fondo: 'linear-gradient(135deg, #991b1b 0%, #b91c1c 100%)',
      fondoHover: 'linear-gradient(135deg, #450a0a 0%, #991b1b 100%)',
      borde: '#f87171',
      icono: '#fecaca',
      brillo: 'rgba(248,113,113,0.25)',
    },
  },
  {
    id: 'sanpablo',
    titulo: 'San Pablo',
    subtitulo: 'Consumos e ingresos de gasoil',
    color: '#3f6212',
    filaStock: '#ecfccb',
    colores: {
      fondo: 'linear-gradient(135deg, #3f6212 0%, #4d7c0f 100%)',
      fondoHover: 'linear-gradient(135deg, #1a2e05 0%, #3f6212 100%)',
      borde: '#a3e635',
      icono: '#d9f99d',
      brillo: 'rgba(163,230,53,0.25)',
    },
  },
]

export const campoGasoil = (id) => CAMPOS_GASOIL.find((c) => c.id === id)

// El campo de Gasoil de cada establecimiento de Producción (la clave de
// Berdina sigue siendo "caspinchango").
const CAMPO_DE_ESTABLECIMIENTO = { caspinchango: 'berdina', 'san-pablo': 'sanpablo' }
export const campoDeEstablecimiento = (establecimiento) => campoGasoil(CAMPO_DE_ESTABLECIMIENTO[establecimiento])
