import { exportarPlanilla } from "./excel";

// El estado de una fila de chequeo de Manitou (09/10/2026), uno solo y
// mandando el menos avanzado: Pedir cotización si alguno no se mandó al
// analista, Sin cotizar si el analista no lo cotizó, Cotizado si está
// cotizado pero falta el pedido de compra, Pedido si están todos pedidos.
// Lo ya pedido no cuenta para la cotización. Null sin repuestos.
// `cotizaciones`: { [repuestoId]: estado del presupuesto }.
export const estadoDeFila = (f, cotizaciones) => {
  const repuestos = f.repuestos || [];
  if (repuestos.length === 0) return null;
  const sinPedir = repuestos.filter((r) => !r.pedido);
  if (sinPedir.length === 0) return "Pedido";
  if (sinPedir.some((r) => !cotizaciones[r._id])) return "Pedir cotización";
  if (sinPedir.some((r) => cotizaciones[r._id] !== "Cotizado")) return "Sin cotizar";
  return "Cotizado";
};

/**
 * La planilla del chequeo de una Manitou: replica la tabla, un renglón por
 * ítem y sin los repuestos (09/10/2026). `secciones` es [{ sistema, filas }]:
 * con más de una (la Manitou desplegada, toda la página en una hoja) suma la
 * columna Sistema. General no lleva OK, Tareas ni Estado, como su tabla. Con
 * `filtro` sale solo lo que se ve, con el número de la tabla completa.
 */
export const exportarChequeoManitou = ({ titulo, archivo, secciones, cotizaciones, general = false, filtro }) => {
  const conSistema = secciones.length > 1;
  return exportarPlanilla({
    titulo,
    columnas: [
      { titulo: "#", ancho: 6 },
      ...(conSistema ? [{ titulo: "Sistema", ancho: 18 }] : []),
      { titulo: "Ítem", ancho: 34 },
      { titulo: "Descripción", ancho: 50 },
      ...(general
        ? []
        : [
            { titulo: "OK", ancho: 8 },
            { titulo: "Tareas", ancho: 45 },
            { titulo: "Estado", ancho: 16 },
          ]),
    ],
    filas: secciones.flatMap(({ sistema, filas }) =>
      filas.flatMap((f, idx) => {
        if (filtro && !pasaFiltro(f, filtro, cotizaciones)) return [];
        const tareas = (f.problemas || []).map((p) => `${p.texto}${p.resuelto ? " (resuelto)" : ""}`).join(" · ");
        return [
          [
            idx + 1,
            ...(conSistema ? [sistema.titulo] : []),
            f.item,
            f.descripcion || "",
            ...(general ? [] : [f.chequeado ? "Sí" : "", tareas, estadoDeFila(f, cotizaciones) || ""]),
          ],
        ];
      })
    ),
    hoja: "Chequeo",
    archivo,
  });
};

// Los filtros de arriba de la tabla de una Manitou (09/10/2026), dos
// selects: el chequeo (OK o con algún problema sin resolver) y el estado de
// la fila. Vacío es todas.
export const FILTRO_CHEQUEO_VACIO = { chequeo: "", estado: "" };
export const OPCIONES_CHEQUEO = ["OK", "Con problemas"];
export const OPCIONES_ESTADO = ["Pedir cotización", "Sin cotizar", "Cotizado", "Pedido"];

export const hayFiltro = (filtro) => Boolean(filtro.chequeo || filtro.estado);

export const pasaFiltro = (f, filtro, cotizaciones) => {
  if (filtro.chequeo === "OK" && !f.chequeado) return false;
  if (filtro.chequeo === "Con problemas" && !(f.problemas || []).some((p) => !p.resuelto)) return false;
  if (filtro.estado && estadoDeFila(f, cotizaciones) !== filtro.estado) return false;
  return true;
};
