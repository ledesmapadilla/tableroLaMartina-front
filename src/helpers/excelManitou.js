import { exportarPlanilla } from "./excel";

// El estado de una fila de chequeo de Manitou (09/10/2026), uno solo y
// mandando el menos avanzado: Pedir cotización si alguno no se mandó al
// analista, Cotizando si el analista no lo cotizó, Cotizado si está
// cotizado pero falta el pedido de compra, Pedido si están todos pedidos.
// Lo ya pedido no cuenta para la cotización. Null sin repuestos.
// `cotizaciones`: { [repuestoId]: estado del presupuesto }.
// Con cantidad 0 el repuesto no hace falta en esa Manitou (13/10/2026): no
// se cotiza ni se pide, así que no cuenta para el estado.
export const estadoDeFila = (f, cotizaciones) => {
  const repuestos = (f.repuestos || []).filter((r) => r.pedido || r.cant > 0);
  if (repuestos.length === 0) return null;
  const sinPedir = repuestos.filter((r) => !r.pedido);
  if (sinPedir.length === 0) return "Pedido";
  if (sinPedir.some((r) => !cotizaciones[r._id])) return "Pedir cotización";
  if (sinPedir.some((r) => cotizaciones[r._id] !== "Cotizado")) return "Cotizando";
  return "Cotizado";
};

/**
 * La planilla del chequeo de una Manitou: replica la tabla, un renglón por
 * ítem (09/10/2026), con sus repuestos en una celda (13/10/2026). `secciones` es [{ sistema, filas }]:
 * con más de una (la Manitou desplegada, toda la página en una hoja) suma la
 * columna Sistema. General no lleva Detalle reparación, OK ni Estado, como su tabla. Con
 * `filtro` sale solo lo que se ve, con el número de la tabla completa.
 */
// Las reparaciones de una fila en una celda (11/10/2026): una por renglón,
// "problema: detalle" y si se realizó.
const reparacionesTexto = (f) =>
  (f.reparaciones || [])
    .map((r) => `${r.problema}${r.detalle ? `: ${r.detalle}` : ""}${r.realizado ? " (realizado)" : ""}${r.notas ? ` — ${r.notas}` : ""}`)
    .join("\n");

// Los repuestos de una fila en una celda (13/10/2026): uno por renglón,
// "nombre: cantidad unidad (estado)". Los de cantidad 0 no hacen falta en
// esa Manitou y no salen, salvo que ya se hayan pedido.
export const repuestosDeFila = (f, cotizaciones) =>
  (f.repuestos || [])
    .filter((r) => r.pedido || r.cant > 0)
    .map((r) => ({ ...r, estado: r.pedido ? "Pedido" : cotizaciones[r._id] || "Sin cotizar" }));

const repuestosTexto = (f, cotizaciones) =>
  repuestosDeFila(f, cotizaciones).map(lineaRepuesto).join("\n");

const lineaRepuesto = (r) => `${r.nombre_repuesto}: ${r.cant} ${r.unidad} (${r.estado})`;

// Los repuestos de toda una Manitou (13/10/2026): un renglón por tarea que
// tiene alguno, con el sistema. Lo que no aplica no tiene repuestos. Con
// `filtro`, solo lo que pasa el filtro de la página.
export const tareasConRepuestos = (secciones, cotizaciones, filtro) =>
  secciones.flatMap(({ sistema, filas }) =>
    filas
      .filter((f) => !f.no_aplica && (!filtro || pasaFiltro(f, filtro, cotizaciones)))
      .map((f) => ({ _id: f._id, sistema, tarea: f.item, repuestos: repuestosDeFila(f, cotizaciones) }))
      .filter((t) => t.repuestos.length > 0)
  );

export const exportarRepuestosManitou = ({ titulo, archivo, tareas }) =>
  exportarPlanilla({
    titulo,
    columnas: [
      { titulo: "#", ancho: 6 },
      { titulo: "Sistema", ancho: 18 },
      { titulo: "Tarea", ancho: 34 },
      { titulo: "Repuesto", ancho: 50 },
      { titulo: "Cant.", ancho: 10 },
      { titulo: "Unidad", ancho: 10 },
      { titulo: "Estado", ancho: 16 },
    ],
    // Un renglón por repuesto, con la tarea en cada uno para poder filtrar.
    filas: tareas.flatMap((t, idx) =>
      t.repuestos.map((r) => [idx + 1, t.sistema.titulo, t.tarea, r.nombre_repuesto, r.cant, r.unidad, r.estado])
    ),
    hoja: "Repuestos",
    archivo,
  });

export const exportarChequeoManitou = ({ titulo, archivo, secciones, cotizaciones, general = false, filtro }) => {
  const conSistema = secciones.length > 1;
  // Cada sistema (Motor, Tren delantero…) cierra con una línea gruesa
  // (18/10/2026): se marca su última fila exportada.
  const filas = [];
  const cortes = [];
  for (const { sistema, filas: filasSistema } of secciones) {
    filasSistema.forEach((f, idx) => {
      if (filtro && !pasaFiltro(f, filtro, cotizaciones)) return;
      filas.push([
        idx + 1,
        ...(conSistema ? [sistema.titulo] : []),
        f.item,
        f.no_aplica ? "NO APLICA" : f.descripcion || "",
        ...(general ? [] : [reparacionesTexto(f), repuestosTexto(f, cotizaciones), f.chequeado ? "Sí" : "", (f.no_aplica ? "" : estadoDeFila(f, cotizaciones) || "")]),
      ]);
    });
    if (filas.length && cortes.at(-1) !== filas.length - 1) cortes.push(filas.length - 1);
  }
  return exportarPlanilla({
    titulo,
    columnas: [
      { titulo: "#", ancho: 6 },
      ...(conSistema ? [{ titulo: "Sistema", ancho: 18 }] : []),
      { titulo: "Tarea", ancho: 34, negrita: true },
      { titulo: "Descripción", ancho: 50 },
      ...(general
        ? []
        : [
            { titulo: "Detalle reparación", ancho: 45 },
            { titulo: "Repuestos", ancho: 50 },
            { titulo: "OK", ancho: 8 },
            { titulo: "Estado", ancho: 16 },
          ]),
    ],
    filas,
    cortes,
    hoja: "Chequeo",
    archivo,
  });
};

// Los filtros de arriba de la tabla de una Manitou (09/10/2026), dos
// selects: el chequeo (OK o con algún problema sin resolver) y el estado de
// la fila. Vacío es todas.
export const FILTRO_CHEQUEO_VACIO = { chequeo: "", estado: "" };
export const OPCIONES_CHEQUEO = ["OK", "Con problemas"];
export const OPCIONES_ESTADO = ["Pedir cotización", "Cotizando", "Cotizado", "Pedido"];

export const hayFiltro = (filtro) => Boolean(filtro.chequeo || filtro.estado);

export const pasaFiltro = (f, filtro, cotizaciones) => {
  if (filtro.chequeo === "OK" && !f.chequeado) return false;
  if (filtro.chequeo === "Con problemas" && !(f.problemas || []).some((p) => !p.resuelto)) return false;
  // Lo que no aplica no tiene estado (10/10/2026).
  if (filtro.estado && (f.no_aplica || estadoDeFila(f, cotizaciones) !== filtro.estado)) return false;
  return true;
};
