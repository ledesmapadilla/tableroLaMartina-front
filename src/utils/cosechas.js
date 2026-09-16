// Las cosechas de Reparaciones San Pablo: cada ingreso al taller es para una
// cosecha. La primera es la 2027 (todo lo cargado hasta el 16/09/2026).
export const PRIMERA_COSECHA = 2027;

// Cuántos años hacia adelante se ofrecen en el select.
const ANIOS_ADELANTE = 5;

/**
 * Las cosechas del select, de menor a mayor: desde la primera hasta cinco años
 * después del actual. Sigue sola con el paso de los años.
 */
export const cosechasDisponibles = () => {
  const ultima = Math.max(PRIMERA_COSECHA, new Date().getFullYear() + ANIOS_ADELANTE);
  return Array.from({ length: ultima - PRIMERA_COSECHA + 1 }, (_, i) => PRIMERA_COSECHA + i);
};

/** La que viene marcada: la del año actual (mientras no llegue, la primera). */
export const cosechaActual = () => Math.max(PRIMERA_COSECHA, new Date().getFullYear());

/** La cosecha de la dirección como número, o null si no es una válida. */
export const cosechaDeParam = (valor) => {
  const n = Number(valor);
  return /^\d{4}$/.test(String(valor)) && n >= PRIMERA_COSECHA ? n : null;
};
