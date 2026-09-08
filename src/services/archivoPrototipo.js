// ============================================================================
// PROTOTIPO FRONT — almacenamiento temporal de adjuntos en sessionStorage.
// Sirve para ver la operatoria del archivo (Analista -> Gerencia) sin backend.
// Aguanta navegación y recarga (F5); se limpia solo al cerrar la pestaña.
// Cuando se conecte Cloudinary, ESTO SE ELIMINA: el archivo se sube a Cloudinary
// y la URL se guarda en item.archivo en la base. Ver CHECKPOINT.md.
// ============================================================================
const KEY = 'archivosPrototipo'

const read = () => {
  try { return JSON.parse(sessionStorage.getItem(KEY)) || {} }
  catch { return {} }
}

const write = (mapa) => sessionStorage.setItem(KEY, JSON.stringify(mapa))

// archivo = { name, dataURL }
export const getArchivo = (itemId) => read()[itemId] || null

export const setArchivo = (itemId, archivo) => {
  const mapa = read()
  mapa[itemId] = archivo
  write(mapa)
}

export const removeArchivo = (itemId) => {
  const mapa = read()
  delete mapa[itemId]
  write(mapa)
}

// Lee un File y lo convierte en { name, dataURL } (base64).
export const fileADataURL = (file) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve({ name: file.name, dataURL: reader.result })
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
