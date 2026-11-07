// Lo que comparten las pantallas de Contable (05/11/2026).

export const MESES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

/**
 * Lo último que se trajo de cada mes, para que la pantalla al volver se
 * dibuje enseguida (05/11/2026). La base tarda de uno a varios segundos en
 * contestar; con esto se muestra lo que ya se tenía y se pide lo actualizado
 * por detrás. Vive mientras la pestaña está abierta: al recargar arranca
 * vacía.
 *
 * Clave "anio/mes" → { filas, tabla } (la respuesta de /contable/filas).
 */
export const memoriaTablas = new Map();

/**
 * La clave con la que se comparan las tareas de Citrusvil (05/11/2026): solo
 * letras y números, en minúscula y sin acentos. No cuentan mayúsculas,
 * acentos, espacios ni signos; los errores de tipeo sí ("8 x 4" y "8 x 5" son
 * tareas distintas).
 *
 * Copia de TableroBack/src/catalogos/claveTarea.js: si cambia una, cambia la otra.
 */
export const claveTarea = (texto) =>
  String(texto || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");

/**
 * Los campos de la Comparativa (05/11/2026): la tarjeta de cada uno y con
 * qué "Denominación almacén" del Excel se juntan sus filas. El `id` es la
 * clave de la URL, la de siempre del proyecto (Berdina sigue siendo
 * `caspinchango`). Los colores son los de la entrada de Producción.
 */
/**
 * Las dos comparativas del mes (07/11/2026): la de cantidades y la de costos.
 * Por ahora hacen lo mismo; cada una con su tarjeta y su ruta.
 */
export const TIPOS_COMPARATIVA = {
  // Cada una con su color, para que dentro de las páginas se distingan
  // (07/11/2026): cantidad en el cian de Contable, costos en violeta.
  cantidad: {
    ruta: "comparativa",
    titulo: "Comparativa cantidad tareas",
    colores: { oscuro: "#164e63", medio: "#0e7490", claro: "#ecfeff", borde: "#a5f3fc", icono: "#67e8f9" },
  },
  costos: {
    ruta: "comparativa-costos",
    titulo: "Comparativa costos tarea",
    colores: { oscuro: "#4c1d95", medio: "#6d28d9", claro: "#f5f3ff", borde: "#ddd6fe", icono: "#c4b5fd" },
  },
};

export const CAMPOS_COMPARATIVA = [
  {
    id: "caspinchango",
    titulo: "Berdina",
    // El almacén del Excel ya llega como "Berdina" (catalogos/nombreBerdina.js).
    almacenes: ["berdina"],
    icono: "bi bi-file-earmark-text-fill",
    colores: {
      fondo: "linear-gradient(135deg, #1b4332 0%, #2d6a4f 100%)",
      fondoHover: "linear-gradient(135deg, #081c15 0%, #1b4332 100%)",
      borde: "#10b981",
      icono: "#6ee7b7",
      brillo: "rgba(16,185,129,0.25)",
    },
  },
  {
    id: "san-pablo",
    titulo: "San Pablo",
    almacenes: ["sanpablo"],
    icono: "bi bi-tree-fill",
    colores: {
      fondo: "linear-gradient(135deg, #7f1d1d 0%, #a13d3d 100%)",
      fondoHover: "linear-gradient(135deg, #450a0a 0%, #7f1d1d 100%)",
      borde: "#ef4444",
      icono: "#fca5a5",
      brillo: "rgba(239,68,68,0.25)",
    },
  },
];

export const fechaHora = (iso) =>
  iso
    ? new Date(iso).toLocaleString("es-AR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "";
