// ExcelJS pesa ~930 kB (256 kB gzip): mas de la mitad del bundle. Cargarlo bajo
// demanda evita que lo descargue todo el mundo al abrir el tablero, cuando en
// realidad solo hace falta al tocar "Exportar a Excel".
let ExcelJS;

export async function nuevoWorkbook() {
  if (!ExcelJS) {
    const mod = await import("exceljs");
    // exceljs es CJS: segun como lo envuelva el bundler, Workbook puede quedar
    // en el default o directo en el namespace.
    ExcelJS = mod.Workbook ? mod : mod.default;
  }
  return new ExcelJS.Workbook();
}
