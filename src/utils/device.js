// Detecta si la app se está ejecutando en un celular (no tablet ni escritorio).
// Se evalúa una vez al cargar; el tipo de dispositivo no cambia durante la sesión.
export const isMobile = /Android|webOS|iPhone|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
  navigator.userAgent
);
