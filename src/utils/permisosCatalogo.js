import { PERMISOS, ROLES } from "./permisos";

/**
 * Los permisos del proyecto: una fila por pantalla o tarjeta, con "ver" y
 * "editar". La pantalla Roles (Altas › Usuarios › Roles) muestra esta lista y
 * el superadmin marca con una cruz lo que puede cada rol; eso se guarda en la
 * base (/api/roles).
 *
 * `hoy` son los roles que entraban antes de que existieran los permisos. Es lo
 * que vale para un rol mientras no se le guarde nada, así que sumar una fila
 * no le quita ni le da acceso a nadie.
 *
 * Usuarios y la propia pantalla Roles no están: son solo del superadmin.
 */
export const CATALOGO = [
  // Compras
  { seccion: "Compras", clave: "compras.pedidos", label: "Pedidos (Berdina y San Pablo)", hoy: PERMISOS.comprasGeneral },
  { seccion: "Compras", clave: "compras.pendientes", label: "Pendientes (Berdina y San Pablo)", hoy: PERMISOS.comprasGeneral },
  { seccion: "Compras", clave: "compras.analista", label: "Analista", hoy: PERMISOS.comprasAnalista },
  { seccion: "Compras", clave: "compras.comprador", label: "Comprador", hoy: PERMISOS.comprasAnalista },
  { seccion: "Compras", clave: "compras.gerencia", label: "Gerencia", hoy: PERMISOS.comprasGerencia },
  // El almacén (20/09/2026). Hoy lo lleva el analista; cuando cada taller
  // tenga el suyo, cada uno va a sumar su propia fila.
  { seccion: "Compras", clave: "compras.stock", label: "Almacén de repuestos", hoy: PERMISOS.comprasAnalista },

  // Mantenimiento
  { seccion: "Camionetas", clave: "camionetas.kilometros", label: "Preventivo › Kilómetros", hoy: PERMISOS.mantenimiento },
  { seccion: "Camionetas", clave: "camionetas.ultimoService", label: "Preventivo › Último service", hoy: PERMISOS.mantenimiento },
  { seccion: "Camionetas", clave: "camionetas.checklist", label: "Preventivo › Check list", hoy: PERMISOS.mantenimiento },
  { seccion: "Camionetas", clave: "camionetas.reportar", label: "Reparaciones › Reportar falla", hoy: PERMISOS.mantenimiento },
  { seccion: "Camionetas", clave: "camionetas.tareas", label: "Reparaciones › Tareas", hoy: PERMISOS.mantenimiento },
  { seccion: "Camionetas", clave: "camionetas.historial", label: "Reparaciones › Historial", hoy: PERMISOS.mantenimiento },
  { seccion: "Camionetas", clave: "camionetas.planilla", label: "Reparaciones › Planilla general", hoy: PERMISOS.mantenimiento },

  { seccion: "Tractores", clave: "tractores.preventivo", label: "Preventivo", hoy: PERMISOS.mantenimiento },
  { seccion: "Tractores", clave: "tractores.repuestos", label: "Repuestos (filtros)", hoy: PERMISOS.mantenimiento },
  { seccion: "Tractores", clave: "tractores.reportar", label: "Reparaciones › Reportar falla", hoy: PERMISOS.mantenimiento },
  { seccion: "Tractores", clave: "tractores.tareas", label: "Reparaciones › Tareas", hoy: PERMISOS.mantenimiento },
  { seccion: "Tractores", clave: "tractores.historial", label: "Reparaciones › Historial", hoy: PERMISOS.mantenimiento },
  { seccion: "Tractores", clave: "tractores.planilla", label: "Reparaciones › Planilla general", hoy: PERMISOS.mantenimiento },

  { seccion: "Colectivos", clave: "colectivos.preventivo", label: "Preventivo", hoy: PERMISOS.mantenimiento },
  { seccion: "Colectivos", clave: "colectivos.reparaciones", label: "Reparaciones", hoy: PERMISOS.mantenimiento },

  { seccion: "Visitas", clave: "mantenimiento.visitas", label: "Visitas", hoy: PERMISOS.mantenimiento },

  // Los dos botones flotantes de Mantenimiento (arriba a la derecha).
  { seccion: "Tablero", clave: "tablero.camionetas", label: "Tablero de control (camionetas)", hoy: PERMISOS.mantenimiento },
  { seccion: "Tablero", clave: "tablero.reunion", label: "Reunión (planillas de la flota)", hoy: PERMISOS.mantenimiento },

  { seccion: "San Pablo", clave: "sanpablo.ingresos", label: "Reparaciones › Ingresos (Manitous…)", hoy: PERMISOS.mantenimiento },

  // Producción
  // Variables son las tres tarjetas de /produccion/variables. `produccion.variables`
  // es la de Remuneración, que era la pantalla Variables de antes: así lo que
  // ya estaba guardado sigue valiendo para ella.
  { seccion: "Producción", clave: "produccion.variables", label: "Variables › Remuneración", hoy: PERMISOS.produccion },
  { seccion: "Producción", clave: "produccion.lotes", label: "Variables › Lotes", hoy: PERMISOS.produccion },
  { seccion: "Producción", clave: "produccion.admisibles", label: "Variables › Valores admisibles", hoy: PERMISOS.produccion },
  { seccion: "Producción", clave: "produccion.certificacion", label: "Tarjeta del mes › Datos certificación", hoy: PERMISOS.produccion },
  { seccion: "Producción", clave: "produccion.informeMes", label: "Tarjeta del mes › Informe del mes", hoy: PERMISOS.produccion },
  { seccion: "Producción", clave: "produccion.contable", label: "Tarjeta del mes › Contable - Pagos", hoy: PERMISOS.produccionContable },

  // Altas (las que no son solo del superadmin)
  { seccion: "Altas", clave: "altas.centrosCosto", label: "Centros de costo", hoy: PERMISOS.comprasAnalista },
  { seccion: "Altas", clave: "altas.proveedores", label: "Proveedores", hoy: PERMISOS.comprasAnalista },
  { seccion: "Altas", clave: "altas.personal", label: "Personal", hoy: PERMISOS.produccion },
  { seccion: "Altas", clave: "altas.tareas", label: "Tareas", hoy: PERMISOS.produccion },
  { seccion: "Altas", clave: "altas.camionetas", label: "Camionetas", hoy: PERMISOS.mantenimiento },
  { seccion: "Altas", clave: "altas.tractores", label: "Tractores", hoy: PERMISOS.mantenimiento },
  { seccion: "Altas", clave: "altas.colectivos", label: "Colectivos", hoy: PERMISOS.mantenimiento },
];

/** Las secciones en el orden de la lista, para agrupar la tabla. */
export const SECCIONES_PERMISOS = [...new Set(CATALOGO.map((p) => p.seccion))];

const clavesDe = (prefijo) => CATALOGO.filter((p) => p.clave.startsWith(prefijo)).map((p) => p.clave);

/**
 * Las pantallas que agrupa cada menú. Una tarjeta, un link o una ruta que
 * lleva a varias pantallas se ve si el rol ve alguna: usePermisos().puede
 * acepta una lista.
 */
export const GRUPO = {
  compras: clavesDe("compras."),
  comprasTaller: ["compras.pedidos", "compras.pendientes"],
  camionetas: clavesDe("camionetas."),
  camionetasPreventivo: ["camionetas.kilometros", "camionetas.ultimoService", "camionetas.checklist"],
  camionetasServices: ["camionetas.kilometros", "camionetas.ultimoService"],
  camionetasReparaciones: ["camionetas.reportar", "camionetas.tareas", "camionetas.historial", "camionetas.planilla"],
  camioneta: ["camionetas.reportar", "camionetas.tareas", "camionetas.historial"],
  tractores: clavesDe("tractores."),
  tractoresReparaciones: ["tractores.reportar", "tractores.tareas", "tractores.historial", "tractores.planilla"],
  tractor: ["tractores.reportar", "tractores.tareas", "tractores.historial"],
  colectivos: clavesDe("colectivos."),
  mantenimiento: [
    ...clavesDe("camionetas."),
    ...clavesDe("tractores."),
    ...clavesDe("colectivos."),
    ...clavesDe("sanpablo."),
    "mantenimiento.visitas",
  ],
  produccion: clavesDe("produccion."),
  produccionVariables: ["produccion.variables", "produccion.lotes", "produccion.admisibles"],
  produccionMes: ["produccion.certificacion", "produccion.informeMes", "produccion.contable"],
  produccionInformes: ["produccion.informeMes", "produccion.contable"],
};

/** Cómo se muestra cada rol. Por dentro siguen siendo los de siempre. */
export const NOMBRES_ROL = {
  superadmin: "Superadministrador",
  solicitante: "Encargado de taller",
  analista: "Analista",
  comprador: "Comprador",
  gerente: "Gerente",
  celular: "Celular",
  liquidacion: "Liquidación",
};

export const nombreRol = (rol) => NOMBRES_ROL[rol] || rol || "";

/** Los que se configuran en Roles: el superadmin puede todo. */
export const ROLES_CONFIGURABLES = ROLES.filter((r) => r !== "superadmin");

/** Lo que vale para un rol sin nada guardado: el acceso de antes. */
export const permisosPorDefecto = (rol) =>
  Object.fromEntries(
    CATALOGO.map((p) => {
      const entra = p.hoy.includes(rol);
      return [p.clave, { ver: entra, editar: entra }];
    })
  );

/**
 * Los permisos de un rol: los guardados pisan a los de antes, pantalla por
 * pantalla. Editar implica ver. El superadmin puede todo.
 */
export const resolverPermisos = (rol, guardados = {}) => {
  if (rol === "superadmin") {
    return Object.fromEntries(CATALOGO.map((p) => [p.clave, { ver: true, editar: true }]));
  }
  const permisos = permisosPorDefecto(rol);
  for (const p of CATALOGO) {
    const g = guardados?.[p.clave];
    if (g) permisos[p.clave] = { ver: Boolean(g.ver || g.editar), editar: Boolean(g.editar) };
  }
  return permisos;
};
