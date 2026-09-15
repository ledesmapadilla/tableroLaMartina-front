import { GRUPO } from "./permisosCatalogo";

/**
 * Qué permiso pide cada ruta, según la tabla de Roles. App.jsx lo controla en
 * un solo punto, igual que el login: si el rol no ve la pantalla, vuelve a la
 * principal.
 *
 * La primera regla que coincide manda, así que van de la más específica a la
 * más general. Una lista es "alguna de estas". Lo que no figura no pide
 * permiso: la principal, Visitas (se usa sin usuario en la entrada), el login,
 * las OP y Usuarios y Roles, que son solo del superadmin por su cuenta.
 */
const REGLAS = [
  // ── Compras ──
  [/^\/compras\/(berdina|sanpablo)\/pedidos\/nuevo/, "compras.pedidos", "editar"],
  [/^\/compras\/(berdina|sanpablo)\/pedidos/, "compras.pedidos"],
  [/^\/compras\/(berdina|sanpablo)\/pendientes/, "compras.pendientes"],
  [/^\/compras\/(berdina|sanpablo)\/?$/, GRUPO.comprasTaller],
  [/^\/compras\/pedidos\/analisis/, "compras.pedidos"],
  [/^\/compras\/analista/, "compras.analista"],
  [/^\/compras\/comprador/, "compras.comprador"],
  [/^\/compras\/gerencia/, "compras.gerencia"],
  [/^\/compras\/altas\/proveedores/, "altas.proveedores"],
  [/^\/compras\/altas\/centros-costo/, "altas.centrosCosto"],
  [/^\/compras\/?$/, GRUPO.compras],

  // ── Producción ──
  [/^\/produccion\/altas\/cc/, "altas.centrosCosto"],
  [/^\/produccion\/altas\/personal/, "altas.personal"],
  [/^\/produccion\/altas\/tareas/, "altas.tareas"],
  [/^\/produccion\/(certificados|san-pablo)\/variables/, "produccion.variables"],
  [/^\/produccion\/certificados\/\d+\/\d+\/planilla/, "produccion.certificacion"],
  [/^\/produccion\/certificados\/\d+\/\d+\/informes\/mes/, "produccion.informeMes"],
  [/^\/produccion\/certificados\/\d+\/\d+\/informes\/tareas-personal/, "produccion.contable"],
  [/^\/produccion\/certificados\/\d+\/\d+\/informes/, GRUPO.produccionInformes],
  [/^\/produccion\/certificados\/\d+\/\d+/, GRUPO.produccionMes],
  [/^\/produccion/, GRUPO.produccion],

  // ── Camionetas ──
  [/^\/camionetas\/altas/, "altas.camionetas"],
  [/^\/camionetas\/checklist\/form/, "camionetas.checklist", "editar"],
  [/^\/camionetas\/checklist/, "camionetas.checklist"],
  [/^\/camionetas\/services\/kilometros/, "camionetas.kilometros"],
  [/^\/camionetas\/services\/ultimo-service/, "camionetas.ultimoService"],
  [/^\/camionetas\/services\/reparaciones\/resumen/, "camionetas.planilla"],
  [/^\/camionetas\/services\/reparaciones\/[^/]+\/reportar/, "camionetas.reportar"],
  [/^\/camionetas\/services\/reparaciones\/[^/]+\/tareas?(\/|$)/, "camionetas.tareas"],
  [/^\/camionetas\/services\/reparaciones\/[^/]+\/historial/, "camionetas.historial"],
  [/^\/camionetas\/services\/reparaciones\/[^/]+\/?$/, GRUPO.camioneta],
  [/^\/camionetas\/services\/reparaciones/, GRUPO.camionetasReparaciones],
  [/^\/camionetas\/services/, GRUPO.camionetasServices],
  [/^\/camionetas\/preventivo/, GRUPO.camionetasPreventivo],
  [/^\/camionetas/, GRUPO.camionetas],

  // ── Tractores ──
  [/^\/tractores\/altas/, "altas.tractores"],
  [/^\/tractores\/preventivo/, "tractores.preventivo"],
  [/^\/tractores\/(services\/reparaciones|grupo\/[^/]+)\/resumen/, "tractores.planilla"],
  [/^\/tractores\/grupo\/[^/]+\/reparaciones\/[^/]+\/reportar/, "tractores.reportar"],
  [/^\/tractores\/grupo\/[^/]+\/reparaciones\/[^/]+\/tareas/, "tractores.tareas"],
  [/^\/tractores\/grupo\/[^/]+\/reparaciones\/[^/]+\/historial/, "tractores.historial"],
  [/^\/tractores\/grupo\/[^/]+\/reparaciones\/[^/]+\/?$/, GRUPO.tractor],
  [/^\/tractores\/(reparaciones|grupo|services)/, GRUPO.tractoresReparaciones],
  [/^\/tractores/, GRUPO.tractores],

  // ── Colectivos ──
  [/^\/colectivos\/altas/, "altas.colectivos"],
  [/^\/colectivo\/preventivo/, "colectivos.preventivo"],
  [/^\/colectivo\/reparaciones/, "colectivos.reparaciones"],
  [/^\/colectivo/, GRUPO.colectivos],

  // ── Inicio de Mantenimiento ──
  [/^\/inicio\/?$/, GRUPO.mantenimiento],
];

/** La regla de una ruta ({ permiso, accion }), o null si no pide permiso. */
export const reglaDeRuta = (pathname) => {
  const regla = REGLAS.find(([patron]) => patron.test(pathname));
  return regla ? { permiso: regla[1], accion: regla[2] || "ver" } : null;
};
