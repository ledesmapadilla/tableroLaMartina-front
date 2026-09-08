/**
 * Quién ve qué. Es el único lugar donde se define: para cambiar los permisos
 * de una sección se toca acá y nada más.
 *
 * Los roles son los que ya traía Compras; no se agregaron nuevos.
 */
export const ROLES = ["superadmin", "solicitante", "analista", "comprador", "gerente"];

const TODOS = ROLES;
const SIN_SOLICITANTE = ROLES.filter((r) => r !== "solicitante");

export const PERMISOS = {
  // ── Compras ── (como venía de antes de unificar)
  comprasGeneral: TODOS,
  comprasAnalista: SIN_SOLICITANTE,
  comprasGerencia: ["gerente", "superadmin"],
  comprasUsuarios: ["superadmin"],

  // ── Mantenimiento ──
  // Todos los que entran trabajan con los equipos de alguna manera: el que
  // pide un repuesto necesita ver el tractor al que se lo pide.
  mantenimiento: TODOS,

  // ── Producción ──
  // La carga de partes y los padrones. El solicitante no participa.
  produccion: SIN_SOLICITANTE,

  // Lo que toca plata: precios, descuentos y el informe de pagos.
  produccionContable: ["superadmin", "gerente", "analista"],
};

// Rutas que se ven sin estar logueado. Visitas es la vista del celular de la
// entrada: la abre quien controla el ingreso, que no tiene usuario.
export const RUTAS_PUBLICAS = ["/visitas", "/login"];

export const esRutaPublica = (pathname) =>
  RUTAS_PUBLICAS.some((r) => pathname === r || pathname.startsWith(`${r}/`));
