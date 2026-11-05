import { nuevoWorkbook } from "../helpers/excel";

/**
 * Lee el Excel mensual de Contable (05/11/2026) y devuelve sus filas como
 * datos del sistema.
 *
 * Es la planilla de tareas de los contratistas ("Otras tareas"): una fila de
 * encabezado y debajo el detalle, con una fila de subtotal después de cada
 * tarea. Los subtotales no se leen (la tabla los calcula) y las demás hojas
 * tampoco, que son cuentas sueltas.
 *
 * Las columnas se buscan por el nombre del encabezado, no por la posición, así
 * un Excel con las columnas en otro orden se lee igual.
 */

// Encabezado del Excel (sin tildes, en minúscula) → campo del sistema.
const COLUMNAS = {
  "documento compras": "documentoCompras",
  "orden de trabajo": "ordenTrabajo",
  "fecha/hora creacion": "fecha",
  "denominacion almacen": "almacen",
  contratista: "contratista",
  "numero de servicio": "nroServicio",
  "detalle de tarea": "tarea",
  "cant.": "cantidad",
  "unidad medida base": "unidad",
  "precio unitario": "precioUnitario",
  subtotal: "subtotal",
  "orden de control": "ordenControl",
  "centro de coste": "centroCosteCodigo",
  "centro de costo": "centroCosto",
  "activo fijo": "activoFijo",
};

// Sin estas no hay tabla: es otro Excel.
const OBLIGATORIAS = ["tarea", "cantidad", "subtotal"];

const NUMEROS = new Set(["cantidad", "precioUnitario", "subtotal"]);

const normalizar = (s) =>
  String(s ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();

/** El valor de una celda de exceljs, sin fórmulas ni texto con formato. */
const valorDe = (v) => {
  if (v === null || v === undefined) return null;
  if (v instanceof Date) return v;
  if (typeof v === "object") {
    if ("result" in v) return valorDe(v.result);
    if (v.richText) return v.richText.map((t) => t.text).join("");
    if ("text" in v) return v.text; // hipervínculo
    if (v.error) return null;
    return null;
  }
  return v;
};

const aCampo = (campo, v) => {
  if (v === null || v === "") return null;
  if (NUMEROS.has(campo)) {
    // Como texto puede venir "1.234,56" (con coma decimal) o "1234.56".
    const s = String(v).replace(/[$\s]/g, "");
    const n = typeof v === "number" ? v : Number(s.includes(",") ? s.replace(/\./g, "").replace(",", ".") : s);
    return Number.isFinite(n) ? n : null;
  }
  if (campo === "fecha") {
    if (v instanceof Date) return v.toISOString();
    // dd/mm/aaaa, por si viene como texto
    const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})/.exec(String(v));
    return m ? new Date(Date.UTC(+m[3], +m[2] - 1, +m[1])).toISOString() : null;
  }
  const s = String(v).trim();
  return s || null;
};

/**
 * La hoja con la tabla: la primera que tenga "Detalle de tarea" en el
 * encabezado. Devuelve la hoja, la fila del encabezado y columna → campo.
 */
const buscarTabla = (wb) => {
  let encontrada = null;
  wb.eachSheet((ws) => {
    if (encontrada) return;
    const tope = Math.min(ws.rowCount, 15);
    for (let r = 1; r <= tope && !encontrada; r++) {
      const mapa = {};
      ws.getRow(r).eachCell({ includeEmpty: false }, (celda, col) => {
        const campo = COLUMNAS[normalizar(valorDe(celda.value))];
        if (campo && !Object.values(mapa).includes(campo)) mapa[col] = campo;
      });
      const campos = Object.values(mapa);
      if (OBLIGATORIAS.every((c) => campos.includes(c))) encontrada = { ws, filaEncabezado: r, mapa };
    }
  });
  return encontrada;
};

/**
 * Las filas del Excel, a partir de su contenido (ArrayBuffer). Tira un Error
 * con un mensaje para el usuario si no es la planilla esperada.
 */
export async function leerExcelContable(buffer) {
  const wb = await nuevoWorkbook();
  try {
    await wb.xlsx.load(buffer);
  } catch {
    throw new Error("No se pudo leer el archivo. Tiene que ser un Excel .xlsx.");
  }

  const tabla = buscarTabla(wb);
  if (!tabla) {
    throw new Error('No se encontró la tabla: falta el encabezado con "Detalle de tarea", "Cant." y "Subtotal".');
  }

  const { ws, filaEncabezado, mapa } = tabla;
  const filas = [];
  for (let r = filaEncabezado + 1; r <= ws.rowCount; r++) {
    const row = ws.getRow(r);
    const fila = {};
    for (const [col, campo] of Object.entries(mapa)) {
      const v = aCampo(campo, valorDe(row.getCell(Number(col)).value));
      if (v !== null) fila[campo] = v;
    }
    if (!Object.keys(fila).length) continue; // fila vacía
    // La de subtotal trae solo la tarea, la cantidad y el subtotal: ni
    // documento, ni almacén, ni contratista.
    const esSubtotal = !fila.documentoCompras && !fila.almacen && !fila.contratista;
    if (esSubtotal) continue;
    filas.push(fila);
  }
  return filas;
}
