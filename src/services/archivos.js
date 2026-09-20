import { api } from "./api";

/**
 * Los adjuntos de Compras (19/09/2026).
 *
 * El archivo va del navegador **directo a Cloudinary**: el back solo firma la
 * subida (`GET /archivos/firma`). Es así porque el backend está en Vercel, donde
 * el cuerpo de un pedido no puede pasar de unos 4,5 MB, y la foto de un
 * presupuesto sacada con el celular ya lo supera.
 *
 * Esto reemplaza a `archivoPrototipo.js`, que guardaba el archivo en
 * `sessionStorage` del navegador: se perdía al cerrar la pestaña, no se veía
 * desde otra computadora y el link `data:` que armaba lo bloquea Chrome.
 *
 * Lo que queda guardado en el ítem del pedido es este objeto:
 *   { url, nombre, publicId, tipo }
 */

const LIMITE_MB = 10;

export const subirArchivo = async (file) => {
  if (file.size > LIMITE_MB * 1024 * 1024) {
    throw new Error(`El archivo no puede pasar de ${LIMITE_MB} MB.`);
  }

  const firma = await api.get("/archivos/firma");

  const datos = new FormData();
  datos.append("file", file);
  datos.append("api_key", firma.apiKey);
  datos.append("timestamp", firma.timestamp);
  datos.append("signature", firma.signature);
  datos.append("folder", firma.folder);

  // `auto` deja que Cloudinary decida entre imagen y raw; el tipo se guarda
  // igual, porque para borrar hay que decírselo.
  const res = await fetch(`https://api.cloudinary.com/v1_1/${firma.cloudName}/auto/upload`, {
    method: "POST",
    body: datos,
  });
  const subido = await res.json().catch(() => ({}));
  if (!res.ok || !subido.secure_url) {
    throw new Error(subido.error?.message || "No se pudo subir el archivo.");
  }

  return {
    url: subido.secure_url,
    nombre: file.name,
    publicId: subido.public_id,
    tipo: subido.resource_type === "image" ? "image" : "raw",
  };
};

/**
 * Borra el archivo de Cloudinary. Quitarlo del ítem es aparte: lo hace la
 * pantalla con el PUT del ítem, que es donde se controlan los permisos del
 * pedido. Si el borrado falla no se corta la operación: lo importante es que el
 * ítem quede sin adjunto.
 */
export const borrarArchivo = async ({ publicId, tipo = "image" }) => {
  if (!publicId) return;
  try {
    await api.delete(`/archivos/${tipo}/${encodeURIComponent(publicId)}`);
  } catch {
    // Queda un archivo suelto en Cloudinary; no se le avisa al usuario.
  }
};
