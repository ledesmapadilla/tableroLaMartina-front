// Los CC son casi todos numéricos ("02", "104", "198"), pero se guardan como
// texto: ordenados como strings quedaría "104" antes que "02". Acá los
// numéricos van primero y en orden numérico, y los que tienen letras
// (patentes, "T-04") después, alfabéticamente.
export const compararCC = (a, b) => {
  const x = (a || "").trim();
  const y = (b || "").trim();

  const xEsNumero = /^\d+$/.test(x);
  const yEsNumero = /^\d+$/.test(y);

  if (xEsNumero && yEsNumero) return Number(x) - Number(y);
  if (xEsNumero) return -1;
  if (yEsNumero) return 1;

  return x.localeCompare(y, "es", { numeric: true, sensitivity: "base" });
};
