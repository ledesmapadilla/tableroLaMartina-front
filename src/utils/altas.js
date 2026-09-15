import { PERMISOS } from "./permisos";

/**
 * Las altas (padrones) de todo el proyecto, en un solo lugar. De acá sale el
 * botón "Altas" de los navbars de Compras y Producción, del Sidebar de
 * Mantenimiento y de la página principal.
 *
 * Quién ve cada una sale de la tabla de Roles (`permiso`, una clave de
 * utils/permisosCatalogo.js). Usuarios no está en esa tabla: es solo del
 * superadmin, por eso lleva `roles`.
 *
 * `enCompras` es la dirección del alta adentro de Compras: el CC se abre desde
 * ahí sin salir de la barra de Compras, y así también llega desde el celular
 * (fuera de /compras el Tablero no se abre en el teléfono).
 *
 * El plan completo está en docs/altas-unificacion.md.
 */
export const GRUPOS_ALTAS = ["Generales", "Compras", "Producción", "Flota"];

export const ALTAS = [
  {
    grupo: "Generales",
    label: "Usuarios",
    icono: "bi bi-person-badge-fill",
    to: "/compras/altas/usuarios",
    roles: PERMISOS.comprasUsuarios,
  },
  {
    grupo: "Generales",
    label: "Centros de costo",
    icono: "bi bi-diagram-3-fill",
    to: "/produccion/altas/cc",
    enCompras: "/compras/altas/centros-costo",
    permiso: "altas.centrosCosto",
  },
  {
    grupo: "Compras",
    label: "Proveedores",
    icono: "bi bi-truck",
    to: "/compras/altas/proveedores",
    permiso: "altas.proveedores",
  },
  {
    grupo: "Producción",
    label: "Personal",
    icono: "bi bi-people-fill",
    to: "/produccion/altas/personal",
    permiso: "altas.personal",
  },
  {
    grupo: "Producción",
    label: "Tareas",
    icono: "bi bi-list-check",
    to: "/produccion/altas/tareas",
    permiso: "altas.tareas",
  },
  {
    grupo: "Flota",
    label: "Camionetas",
    icono: "bi bi-car-front-fill",
    to: "/camionetas/altas",
    permiso: "altas.camionetas",
  },
  {
    grupo: "Flota",
    label: "Tractores",
    // El tractor no está en Bootstrap Icons: es el SVG de TractorIcon.
    icono: "tractor",
    to: "/tractores/altas",
    permiso: "altas.tractores",
  },
  {
    grupo: "Flota",
    label: "Colectivos",
    icono: "bi bi-bus-front-fill",
    to: "/colectivos/altas",
    permiso: "altas.colectivos",
  },
];

/**
 * Las altas que puede abrir el usuario, en el orden de la lista. `puede` es
 * el de usePermisos(); sin él solo quedan las que van por rol.
 */
export const altasDe = (user, puede) =>
  user ? ALTAS.filter((a) => (a.permiso ? Boolean(puede?.(a.permiso)) : a.roles.includes(user.rol))) : [];

/** Las mismas, agrupadas ([{ grupo, altas }]) y sin los grupos vacíos. */
export const altasPorGrupo = (user, puede) => {
  const visibles = altasDe(user, puede);
  return GRUPOS_ALTAS.map((grupo) => ({ grupo, altas: visibles.filter((a) => a.grupo === grupo) })).filter(
    (g) => g.altas.length > 0
  );
};

/** A dónde lleva un alta según la sección desde la que se abre. */
export const rutaDeAlta = (alta, seccion) => (seccion === "compras" && alta.enCompras) || alta.to;

/** Si la pantalla actual es un alta: marca el botón como activo. */
export const esRutaDeAlta = (pathname) =>
  ALTAS.some((a) =>
    [a.to, a.enCompras].filter(Boolean).some((r) => pathname === r || pathname.startsWith(`${r}/`))
  );
