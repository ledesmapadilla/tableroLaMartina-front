// Service worker mínimo (23/11/2026). Está para que el celular pueda instalar
// el Tablero como app (sin la barra de direcciones): Chrome lo pide para
// ofrecer "Instalar app". No guarda nada en caché ni toca los pedidos a /api,
// las subidas ni los archivos: solo las páginas pasan por acá y van a la red
// como siempre. Así no se mete con el aviso de versión nueva.

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));

self.addEventListener("fetch", (e) => {
  if (e.request.mode !== "navigate") return;
  e.respondWith(
    fetch(e.request).catch(
      () =>
        new Response("<h3 style='font-family:sans-serif;text-align:center;margin-top:40vh'>Sin conexión</h3>", {
          headers: { "Content-Type": "text/html; charset=utf-8" },
        })
    )
  );
});
