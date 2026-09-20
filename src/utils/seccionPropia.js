/**
 * Cuál de las secciones de Compras es "la de" quien está logueado.
 *
 * La entrada de Compras muestra su tarjeta con el color de siempre y las demás
 * en gris, para que cada uno reconozca la suya de un vistazo (19/09/2026).
 *
 * Con el rol alcanza para Analista, Comprador y Gerencia. Los dos talleres
 * comparten el rol "Encargado de taller" (`solicitante`), así que ahí hay que
 * mirar quién es: Kevin es Berdina y Victor es San Pablo. Si cambia la persona
 * de un taller, se toca `POR_USUARIO` y nada más; el rol manda sobre el nombre,
 * así que si mañana Kevin pasa a comprador su tarjeta es la de Comprador.
 *
 * El superadmin no tiene una sección propia: ve todas y todas quedan con su
 * color, como antes.
 */
const POR_ROL = {
  analista: "analista",
  comprador: "comprador",
  gerente: "gerencia",
};

const POR_USUARIO = {
  kevin: "berdina",
  victor: "sanpablo",
};

export const seccionPropia = (user) => {
  if (!user) return null;
  if (POR_ROL[user.rol]) return POR_ROL[user.rol];
  // Se busca en el usuario y en el nombre: entra igual "kevin" que "Kevin Paz".
  const quien = `${user.usuario || ""} ${user.nombre || ""}`.toLowerCase();
  const encontrado = Object.keys(POR_USUARIO).find((n) => quien.includes(n));
  return encontrado ? POR_USUARIO[encontrado] : null;
};

/** El gris de las secciones que no son la de quien está logueado. */
export const COLORES_NEUTROS = {
  fondo: "linear-gradient(135deg, #64748b 0%, #94a3b8 100%)",
  fondoHover: "linear-gradient(135deg, #475569 0%, #64748b 100%)",
  borde: "#cbd5e1",
  icono: "#f1f5f9",
  brillo: "rgba(203,213,225,0.25)",
};
