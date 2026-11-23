/**
 * Las semanas de la caja con su arrastre (23/11/2026). Regla del usuario: si
 * una semana (viernes a jueves) cierra con saldo positivo, ese saldo pasa como
 * entrada de la semana siguiente; si cierra en negativo, la siguiente arranca
 * de cero. La cadena empieza en la semana del primer movimiento.
 *
 * La usan Contable › Caja y las pantallas del celular (compras/caja), para que
 * den lo mismo.
 */

const aFecha = (s) => {
  const [a, m, d] = s.split("-").map(Number);
  return new Date(a, m - 1, d);
};
const aIso = (f) => `${f.getFullYear()}-${String(f.getMonth() + 1).padStart(2, "0")}-${String(f.getDate()).padStart(2, "0")}`;
const masDias = (s, n) => {
  const f = aFecha(s);
  f.setDate(f.getDate() + n);
  return aIso(f);
};
const viernesDe = (s) => masDias(s, -((aFecha(s).getDay() + 2) % 7));
const redondear = (n) => Math.round(n * 100) / 100;

/**
 * { [viernes]: { anterior, ingresos, gastos, entradas, saldo, cantidad } }
 * desde la semana del primer movimiento hasta la de `hasta` (o la del último
 * movimiento, si es posterior).
 *  - anterior: lo que viene de la semana previa (0 si cerró en negativo).
 *  - ingresos: los ingresos cargados en la semana.
 *  - entradas: anterior + ingresos.
 *  - saldo: entradas − gastos.
 */
export const semanasCaja = (movimientos, hasta) => {
  const porSemana = {};
  let primera = null;
  let ultima = hasta ? viernesDe(hasta) : null;
  for (const m of movimientos || []) {
    if (!m?.fecha) continue;
    const v = viernesDe(m.fecha);
    const s = (porSemana[v] ||= { ingresos: 0, gastos: 0, cantidad: 0 });
    const monto = Number(m.monto) || 0;
    if (m.concepto === "ingreso") s.ingresos += monto;
    else s.gastos += monto;
    s.cantidad += 1;
    if (!primera || v < primera) primera = v;
    if (!ultima || v > ultima) ultima = v;
  }
  const resultado = {};
  if (!primera) return resultado;
  let anterior = 0;
  for (let v = primera; v <= ultima; v = masDias(v, 7)) {
    const s = porSemana[v] || { ingresos: 0, gastos: 0, cantidad: 0 };
    const ingresos = redondear(s.ingresos);
    const gastos = redondear(s.gastos);
    const entradas = redondear(anterior + ingresos);
    const saldo = redondear(entradas - gastos);
    resultado[v] = { anterior, ingresos, gastos, entradas, saldo, cantidad: s.cantidad };
    anterior = saldo > 0 ? saldo : 0;
  }
  return resultado;
};

/** Una semana sin nada (antes del primer movimiento, o sin movimientos cargados). */
export const SEMANA_VACIA = { anterior: 0, ingresos: 0, gastos: 0, entradas: 0, saldo: 0, cantidad: 0 };
