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
  { id: "cabina", titulo: "Cabina", icono: "bi bi-person-workspace" },
  { id: "otros", titulo: "Otros", icono: "bi bi-three-dots" },
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
