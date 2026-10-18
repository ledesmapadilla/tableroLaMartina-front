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
 *   columnas: [{ titulo, ancho, moneda?, negrita? }]
 *   filas:    [[valor, valor, ...]]
 *   cortes:   índices de `filas` que llevan abajo la línea gruesa (18/10/2026)
 *
 * `negrita: true` pone esa columna en negrita (18/10/2026). `cortes` marca el
 * fin de un grupo de filas, como los sistemas de una Manitou.
 *
 * `moneda: true` le pone a esa columna el formato de importe de todo el
 * proyecto ("$"#,##0.00) en las celdas con número (08/10/2026). Una fila que
 * empieza con "TOTAL" va en negrita, como la fila de total de la pantalla.
 */
export async function exportarPlanilla({ titulo, columnas, filas, hoja = "Datos", archivo, cortes = [] }) {
  const conCorte = new Set(cortes);
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

  filas.forEach((datos, i) => {
    const fila = ws.addRow(datos);
    const esTotal = datos[0] === "TOTAL";
    fila.eachCell({ includeEmpty: true }, (cell, nro) => {
      if (columnas[nro - 1]?.moneda && typeof cell.value === "number") cell.numFmt = '"$"#,##0.00';
      if (esTotal || columnas[nro - 1]?.negrita) cell.font = { bold: true };
      // Una celda con varios renglones (una lista, uno por renglón) se ajusta
      // al texto y va a la izquierda, para que se lea (13/10/2026).
      const lista = typeof cell.value === "string" && cell.value.includes("\n");
      cell.alignment = lista
        ? { horizontal: "left", vertical: "middle", wrapText: true }
        : { horizontal: "center", vertical: "middle" };
      cell.border = {
        top: { style: "thin", color: { argb: "FFE2E8F0" } },
        bottom: conCorte.has(i)
          ? { style: "medium", color: { argb: "FF1E293B" } }
          : { style: "thin", color: { argb: "FFE2E8F0" } },
        left: { style: "thin", color: { argb: "FFE2E8F0" } },
        right: { style: "thin", color: { argb: "FFE2E8F0" } },
      };
    });
  });

  ws.columns = columnas.map((c) => ({ width: c.ancho ?? 14 }));
  await descargar(wb, archivo);
}
