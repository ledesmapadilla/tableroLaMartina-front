// Mismo origen: al unificarse con el Tablero, Compras dejo de tener su propio
// servidor. El proxy de Vite manda /api al backend en desarrollo, y en
// produccion front y back son el mismo deploy.
const BASE = "/api";

const authHeader = () =>
  localStorage.getItem("token")
    ? { Authorization: `Bearer ${localStorage.getItem("token")}` }
    : {};

const jsonHeaders = () => ({
  "Content-Type": "application/json",
  ...authHeader(),
});

const handle = async (res) => {
  const data = await res.json();
  if (res.status === 401 && localStorage.getItem("token")) {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    // El login es uno solo para todo el proyecto.
    window.location.href = "/login";
    throw new Error("Sesión expirada");
  }
  if (!res.ok) throw new Error(data.error || "Error en la solicitud");
  return data;
};

export const api = {
  get:    (path)        => fetch(`${BASE}${path}`, { headers: authHeader() }).then(handle),
  post:   (path, body)  => fetch(`${BASE}${path}`, { method: "POST",   headers: jsonHeaders(), body: JSON.stringify(body) }).then(handle),
  put:    (path, body)  => fetch(`${BASE}${path}`, { method: "PUT",    headers: jsonHeaders(), body: JSON.stringify(body) }).then(handle),
  delete: (path)        => fetch(`${BASE}${path}`, { method: "DELETE", headers: authHeader() }).then(handle),
};
