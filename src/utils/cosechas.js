// Las cosechas de Reparaciones San Pablo: cada ingreso al taller es para una
// cosecha. La primera del select es la 2026 (agregada el 07/10/2026); todo lo
// cargado hasta el 16/09/2026 quedó en la 2027.
export const PRIMERA_COSECHA = 2026;

// La que viene marcada mientras el año actual no la alcance: lo que se prepara
// en el taller es para la cosecha 2027.
const COSECHA_MARCADA_MINIMA = 2027;

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

/** La que viene marcada: la del año actual (mientras no llegue, la 2027). */
export const cosechaActual = () => Math.max(COSECHA_MARCADA_MINIMA, new Date().getFullYear());

/** La cosecha de la dirección como número, o null si no es una válida. */
export const cosechaDeParam = (valor) => {
  const n = Number(valor);
  return /^\d{4}$/.test(String(valor)) && n >= PRIMERA_COSECHA ? n : null;
};
