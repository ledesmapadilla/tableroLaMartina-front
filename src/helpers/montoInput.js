/**
 * Monto con formato de moneda mientras se escribe (23/11/2026): "$ 1.234.567,89".
 * Miles con punto, decimales con coma (hasta dos). Un punto tipeado al final
 * sin coma todavía (el del teclado numérico) se toma como la coma decimal.
 */
export const formatearMonto = (texto) => {
  let s = String(texto ?? "");
  if (s.endsWith(".") && !s.includes(",")) s = `${s.slice(0, -1)},`;
  s = s.replace(/[^\d,]/g, "");
  if (!s) return "";
  const coma = s.indexOf(",");
  let entero = coma === -1 ? s : s.slice(0, coma);
  const decimales = coma === -1 ? null : s.slice(coma + 1).replace(/,/g, "").slice(0, 2);
  entero = entero.replace(/^0+(?=\d)/, "");
  if (!entero && decimales !== null) entero = "0";
  const miles = entero.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `$ ${miles}${decimales !== null ? `,${decimales}` : ""}`;
};

/** El número que hay en un monto formateado (NaN si está vacío). */
export const leerMonto = (texto) => {
  const s = String(texto ?? "").replace(/[^\d,]/g, "");
  if (!s) return NaN;
  return Math.round(Number(s.replace(",", ".")) * 100) / 100;
};

/** Un número guardado, listo para el input formateado. */
export const montoAInput = (n) =>
  Number.isFinite(Number(n)) && n !== "" && n !== null ? formatearMonto(String(n).replace(".", ",")) : "";
