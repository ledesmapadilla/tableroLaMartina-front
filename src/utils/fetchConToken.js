/**
 * Manda el token en todas las llamadas a /api, sin tocar las 125 que ya
 * existen.
 *
 * El Tablero llama a la API con `fetch("/api/...")` directo, repartido en 33
 * archivos; Compras usa su servicio `api`. En vez de reescribir todo eso, se
 * envuelve `fetch` una sola vez al arrancar: si la URL es de nuestra API y hay
 * token guardado, le agrega el Authorization.
 *
 * Solo toca las llamadas a `/api` del mismo origen. Cualquier otro fetch —a un
 * CDN, a un servicio externo— pasa intacto y sin el token.
 */
export function instalarFetchConToken() {
  const original = window.fetch;

  window.fetch = (entrada, opciones = {}) => {
    const url = typeof entrada === "string" ? entrada : entrada?.url || "";
    const esNuestraApi = url.startsWith("/api/") || url.startsWith("/api?");
    const token = esNuestraApi ? localStorage.getItem("token") : null;

    if (!token) return original(entrada, opciones);

    // No se pisa un Authorization que la llamada ya traiga: el servicio `api`
    // de Compras pone el suyo.
    const headers = new Headers(opciones.headers || {});
    if (!headers.has("Authorization")) headers.set("Authorization", `Bearer ${token}`);

    return original(entrada, { ...opciones, headers });
  };
}
