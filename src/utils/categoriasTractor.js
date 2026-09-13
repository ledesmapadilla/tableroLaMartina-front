/**
 * Categorías de las reparaciones de tractores. Es la lista única: la ofrecen
 * el reporte de falla y la edición de tareas, y la usan como filtro la
 * planilla general y el historial del tractor. Antes cada pantalla tenía su
 * propia copia y se habían separado: el filtro no traía "Horómetro" y tenía
 * "Hidráulica" donde se carga "Hidráulico", así que esas reparaciones no se
 * podían filtrar.
 */
export const CATEGORIAS_TRACTOR = [
  "Motor",
  "Transmisión / Caja",
  "Embrague",
  "Hidráulico",
  "Frenos",
  "Dirección",
  "Mecánica general",
  "Electricidad / Luces",
  "Horómetro",
  "Rodado / Cubiertas",
  "Implementos / Enganche",
  "Service Programado",
  "Otros",
];

export const CATEGORIA_COLORES = {
  Motor: { bg: "#fee2e2", text: "#991b1b", border: "#f87171" },
  Embrague: { bg: "#ffedd5", text: "#9a3412", border: "#fb923c" },
  "Transmisión / Caja": { bg: "#fef3c7", text: "#92400e", border: "#fcd34d" },
  Frenos: { bg: "#fef3c7", text: "#92400e", border: "#fcd34d" },
  Hidráulico: { bg: "#e0e7ff", text: "#3730a3", border: "#818cf8" },
  Dirección: { bg: "#e0e7ff", text: "#3730a3", border: "#818cf8" },
  "Mecánica general": { bg: "#e2e8f0", text: "#334155", border: "#94a3b8" },
  "Electricidad / Luces": { bg: "#fef9c3", text: "#854d0e", border: "#facc15" },
  Horómetro: { bg: "#cffafe", text: "#155e75", border: "#22d3ee" },
  "Rodado / Cubiertas": { bg: "#ccfbf1", text: "#115e59", border: "#2dd4bf" },
  "Implementos / Enganche": { bg: "#e0f2fe", text: "#0369a1", border: "#7dd3fc" },
  "Service Programado": { bg: "#dcfce7", text: "#166534", border: "#4ade80" },
  Otros: { bg: "#f1f5f9", text: "#475569", border: "#cbd5e1" },
};

/**
 * Opciones del filtro de categoría: "Todas", la lista única y, al final,
 * cualquier categoría que figure en los trabajos cargados y ya no esté en la
 * lista (cargas viejas), para que ninguna reparación quede sin poder filtrarse.
 * Un trabajo sin categoría cuenta como "Otros", igual que en el filtro.
 */
export const opcionesFiltroCategoria = (trabajos = []) => {
  const extras = new Set();
  trabajos.forEach((t) => {
    const parte = t?.parte || "Otros";
    if (!CATEGORIAS_TRACTOR.includes(parte)) extras.add(parte);
  });
  return ["Todas", ...CATEGORIAS_TRACTOR, ...[...extras].sort((a, b) => a.localeCompare(b, "es"))];
};
