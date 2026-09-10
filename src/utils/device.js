const CLAVE_ESCRITORIO = "verEscritorio";

function pidioEscritorio() {
  try {
    return sessionStorage.getItem(CLAVE_ESCRITORIO) === "1";
  } catch {
    return false;
  }
}

// Detecta si la app se está ejecutando en un celular (no tablet ni escritorio).
// Se evalúa una vez al cargar; el tipo de dispositivo no cambia durante la sesión.
// Si en esta pestaña se pidió el proyecto completo, se trata como escritorio.
export const isMobile =
  !pidioEscritorio() &&
  /Android|webOS|iPhone|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

// En celular la app solo tiene Visitas y cualquier otra ruta vuelve ahí, así que
// no hay salida navegando. Esto habilita el resto del proyecto para esta pestaña
// y recarga, porque App decide el modo una sola vez al cargar.
export function irAlEscritorio(ruta = "/") {
  try {
    sessionStorage.setItem(CLAVE_ESCRITORIO, "1");
  } catch {
    // Sin sessionStorage no hay forma de recordarlo: se queda en Visitas.
  }
  window.location.assign(ruta);
}
