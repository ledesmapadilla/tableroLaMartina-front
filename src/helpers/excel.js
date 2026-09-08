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

// Dispara la descarga del workbook ya armado.
async function descargar(wb, archivo) {
  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = archivo;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * Planilla simple: titulo, fecha, encabezado y filas.
 *
 * Es el formato que usan los listados de Compras, que eran cuatro
 * exportaciones casi identicas. Las pantallas del Tablero que arman informes
 * con totales, cortes y colores siguen usando `nuevoWorkbook` directo: eso no
 * entra en un formato generico.
 *
 *   columnas: [{ titulo, ancho }]
 *   filas:    [[valor, valor, ...]]
 */
export async function exportarPlanilla({ titulo, columnas, filas, hoja = "Datos", archivo }) {
  const wb = await nuevoWorkbook();
  const ws = wb.addWorksheet(hoja);
  const fechaHoy = new Date().toLocaleDateString("es-AR");

  // Titulo, cruzando todas las columnas
  ws.mergeCells(1, 1, 1, columnas.length);
  const celdaTitulo = ws.getCell("A1");
  celdaTitulo.value = titulo;
  celdaTitulo.font = { bold: true, size: 14, color: { argb: "FF1B4332" } };
  celdaTitulo.alignment = { horizontal: "center", vertical: "middle" };
  ws.getRow(1).height = 24;

  ws.mergeCells(2, 1, 2, columnas.length);
  const celdaFecha = ws.getCell("A2");
  celdaFecha.value = `Fecha de emisión: ${fechaHoy}`;
  celdaFecha.font = { italic: true, size: 10, color: { argb: "FF64748B" } };
  celdaFecha.alignment = { horizontal: "center", vertical: "middle" };

  ws.addRow([]);

  const filaEnc = ws.addRow(columnas.map((c) => c.titulo));
  filaEnc.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
    cell.alignment = { horizontal: "center", vertical: "middle" };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1B4332" } };
  });
  ws.getRow(4).height = 20;

  for (const datos of filas) {
    const fila = ws.addRow(datos);
    fila.eachCell({ includeEmpty: true }, (cell) => {
      cell.alignment = { horizontal: "center", vertical: "middle" };
      cell.border = {
        top: { style: "thin", color: { argb: "FFE2E8F0" } },
        bottom: { style: "thin", color: { argb: "FFE2E8F0" } },
        left: { style: "thin", color: { argb: "FFE2E8F0" } },
        right: { style: "thin", color: { argb: "FFE2E8F0" } },
      };
    });
  }

  ws.columns = columnas.map((c) => ({ width: c.ancho ?? 14 }));
  await descargar(wb, archivo);
}
