/**
 * Las semanas de la caja con su arrastre. Regla del usuario: el saldo con el
 * que cierra una semana (viernes a jueves) pasa a la semana siguiente, sea
 * positivo o negativo (23/11/2026; al principio el negativo no pasaba).
 * El positivo entra como entrada; el negativo, como gasto (lo que se debe),
 * así Entradas nunca da negativo y el saldo sigue siendo entradas − gastos.
 * La cadena empieza en la semana del primer movimiento.
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
 * { [viernes]: { anterior, ingresos, gastosMov, entradas, gastos, saldo, cantidad } }
 * desde la semana del primer movimiento hasta la de `hasta` (o la del último
 * movimiento, si es posterior).
 *  - anterior: el saldo con que cerró la semana previa (puede ser negativo).
 *  - ingresos / gastosMov: lo cargado en la semana.
 *  - entradas: ingresos + el anterior si es positivo.
 *  - gastos: gastosMov + el anterior si es negativo.
 *  - saldo: entradas − gastos (= anterior + ingresos − gastosMov).
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
    const gastosMov = redondear(s.gastos);
    const entradas = redondear(ingresos + Math.max(anterior, 0));
    const gastos = redondear(gastosMov + Math.max(-anterior, 0));
    const saldo = redondear(entradas - gastos);
    resultado[v] = { anterior, ingresos, gastosMov, entradas, gastos, saldo, cantidad: s.cantidad };
    anterior = saldo;
  }
  return resultado;
};

/** Una semana sin nada (antes del primer movimiento, o sin movimientos cargados). */
export const SEMANA_VACIA = { anterior: 0, ingresos: 0, gastosMov: 0, entradas: 0, gastos: 0, saldo: 0, cantidad: 0 };
