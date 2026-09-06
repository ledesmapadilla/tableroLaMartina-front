// Los dos clientes de siempre. No es una lista cerrada: en la planilla el
// cliente se escribe libre y acá solo están los que se ofrecen de entrada, para
// que el mismo cliente se escriba igual en todos lados. El primero es el que
// viene puesto en cada parte nuevo.
export const CLIENTES = ["Citrusvil", "Sauce Guacho"];

// Junta los clientes fijos con los que ya aparecen en los datos (partes o
// precios cargados), sin repetir y sin distinguir mayúsculas ni acentos.
export const unirClientes = (...listas) => {
  const vistos = new Map();
  for (const cliente of [...CLIENTES, ...listas.flat()]) {
    const texto = (cliente || "").trim();
    if (!texto) continue;
    const clave = texto.toLowerCase();
    if (!vistos.has(clave)) vistos.set(clave, texto);
  }
  return [...vistos.values()];
};
