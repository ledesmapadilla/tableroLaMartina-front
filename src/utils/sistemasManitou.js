// Los sistemas de Manitous › General (06/10/2026): una tarjeta y una tabla de
// chequeo cada uno. El id va en la dirección y en el back
// (controllers/chequeossanpablo.controller.js).
export const SISTEMAS_MANITOU = [
  { id: "motor", titulo: "Motor", icono: "bi bi-gear-wide-connected" },
  { id: "tren-delantero", titulo: "Tren delantero", icono: "bi bi-chevron-double-up" },
  { id: "tren-trasero", titulo: "Tren trasero", icono: "bi bi-chevron-double-down" },
  { id: "torre", titulo: "Torre", icono: "bi bi-arrows-angle-expand" },
  { id: "sistema-hidraulico", titulo: "Sistema hidráulico", icono: "bi bi-droplet-fill" },
  { id: "sistema-electrico", titulo: "Sistema eléctrico", icono: "bi bi-lightning-charge-fill" },
  { id: "cabina", titulo: "Cabina y otros", icono: "bi bi-person-workspace" },
];

// Las Manitous (09/10/2026). General es la plantilla: los ítems y los
// repuestos se cargan ahí y el back los copia a cada unidad, donde se
// trabaja. El número de la unidad es también su C.C. Igual que en el back
// (catalogos/manitous.js).
export const UNIDADES_MANITOU = ["1100", "1101", "1102", "1103", "1104"];

// La sección de los chequeos: "general" (la de la dirección) o el número.
export const seccionManitou = (unidad) => (unidad === "general" ? "manitous-general" : `manitou-${unidad}`);
export const unidadManitouValida = (unidad) => unidad === "general" || UNIDADES_MANITOU.includes(unidad);

// Las Manitou que abren todos los sistemas en una sola página, uno debajo
// del otro, en lugar de una tarjeta por sistema (09/10/2026): todas las
// Manitou. General sigue con una tarjeta por sistema.
export const MANITOUS_DESPLEGADAS = UNIDADES_MANITOU;

// Cuánto lleva una tarea de una Manitou, de 0 a 100 (21/10/2026): el % que
// carga el taller (`avance`). Una vieja sin % pero con OK cuenta 100.
export const avanceTarea = (f) => f.avance ?? (f.chequeado ? 100 : 0);

// El avance de la reparación de una Manitou (21/10/2026), en %: cada sistema
// aporta su peso (los % cargados en General, que suman 100) por su propio
// avance: cada tarea pesa lo suyo dentro del sistema (`peso` de la fila,
// cargado en cada Manitou; las del sistema suman 100) por su % (avanceTarea).
// Los pesos de las tareas se toman sobre lo que suman las que aplican, así
// una NO APLICA no deja el sistema sin poder llegar a 100. Si ninguna tarea
// del sistema tiene peso, pesan todas igual. Un sistema con todas sus tareas
// en NO APLICA se toma como terminado; uno sin ninguna tarea no aporta nada.
// Cada sistema trae su avance (`parte`, de 0 a 1), que no depende de los
// pesos de los sistemas, y cuántas tareas están al 100% (`hechas`); sin pesos
// de sistemas cargados el total es null.
// filasPorSistema: { [sistema]: filas }; pesos: { [sistema]: % }.
export const avanceManitou = (filasPorSistema, pesos) => {
  const conPesos = Boolean(pesos) && Object.keys(pesos).length > 0;
  const porSistema = SISTEMAS_MANITOU.map((s) => {
    const filas = filasPorSistema[s.id] || [];
    const aplican = filas.filter((f) => !f.no_aplica);
    const hechas = aplican.filter((f) => avanceTarea(f) >= 100).length;
    const peso = conPesos ? Number(pesos[s.id]) || 0 : null;
    const conPesoTareas = aplican.some((f) => Number(f.peso) > 0);
    const pesoTarea = (f) => (conPesoTareas ? Number(f.peso) || 0 : 1);
    const sumaPesoTareas = aplican.reduce((t, f) => t + pesoTarea(f), 0);
    const parte = aplican.length
      ? aplican.reduce((t, f) => t + pesoTarea(f) * avanceTarea(f), 0) / (sumaPesoTareas * 100)
      : filas.length
        ? 1
        : 0;
    return { sistema: s, peso, tareas: aplican.length, hechas, parte, aporte: conPesos ? peso * parte : null };
  });
  return { total: conPesos ? porSistema.reduce((t, s) => t + s.aporte, 0) : null, porSistema };
};

// Un % del avance como se muestra: "27,5%".
export const fmtPct = (n) => `${n.toLocaleString("es-AR", { maximumFractionDigits: 1 })}%`;
