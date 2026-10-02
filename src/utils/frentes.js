// Un frente de San Pablo como texto: "Nombre (cliente)". Lo usan los Excel de
// Carros porta escaleras y de Escaleras.
export const textoFrente = (f) => (f?.nombre ? (f.cliente ? `${f.nombre} (${f.cliente})` : f.nombre) : "");
