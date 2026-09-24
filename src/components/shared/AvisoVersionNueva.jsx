import { useEffect, useRef, useState } from "react";
import { haySinGuardar } from "../../utils/sinGuardar";

// Aviso de versión nueva (24/09/2026). Varias computadoras dejan el programa
// abierto todo el día y no se enteraban de los cambios hasta que alguien
// apretaba F5. El build deja la versión en /version.json (vite.config.js) y
// acá se la compara con la que está corriendo: si cambió sale una franja
// arriba con "Actualizar ahora", y a los 3 minutos sin uso la página se
// recarga sola, salvo que haya algo escrito sin guardar.

const CADA = 60 * 1000; // cada cuánto se pregunta por la versión
const SIN_USO = 3 * 60 * 1000; // cuánto sin tocar nada antes de recargar sola

// Hay algo a medio hacer que la recarga perdería: una pantalla que lo avisó,
// un modal o un cartel abierto, o un campo con el cursor adentro y texto.
const hayAlgoAMedias = () => {
  if (haySinGuardar()) return true;
  if (document.querySelector(".modal.show, .swal2-container")) return true;
  const el = document.activeElement;
  const editable =
    el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable);
  return Boolean(editable && (el.value ?? el.textContent ?? "").trim());
};

function AvisoVersionNueva() {
  const [hayNueva, setHayNueva] = useState(false);
  const ultimoUso = useRef(0);

  // Preguntar por la versión: cada minuto y cada vez que se vuelve a la
  // pestaña (una computadora que se suspendió a la noche avisa al prender).
  useEffect(() => {
    // En desarrollo no hay version.json: Vite ya recarga solo.
    if (import.meta.env.DEV) return;
    let cancelado = false;
    const revisar = async () => {
      try {
        const r = await fetch(`/version.json?t=${Date.now()}`, { cache: "no-store" });
        if (!r.ok) return;
        const { version } = await r.json();
        if (!cancelado && version && version !== __APP_VERSION__) setHayNueva(true);
      } catch {
        // Sin conexión: se vuelve a probar en la próxima vuelta.
      }
    };
    const alVolver = () => document.visibilityState === "visible" && revisar();
    revisar();
    const intervalo = setInterval(revisar, CADA);
    document.addEventListener("visibilitychange", alVolver);
    return () => {
      cancelado = true;
      clearInterval(intervalo);
      document.removeEventListener("visibilitychange", alVolver);
    };
  }, []);

  // Con versión nueva: contar el tiempo sin uso y recargar a los 3 minutos.
  useEffect(() => {
    if (!hayNueva) return;
    const usar = () => {
      ultimoUso.current = Date.now();
    };
    const eventos = ["mousemove", "mousedown", "keydown", "wheel", "touchstart", "scroll"];
    eventos.forEach((e) => window.addEventListener(e, usar, { passive: true, capture: true }));
    ultimoUso.current = Date.now();
    const reloj = setInterval(() => {
      if (Date.now() - ultimoUso.current >= SIN_USO && !hayAlgoAMedias()) {
        window.location.reload();
      }
    }, 10 * 1000);
    return () => {
      clearInterval(reloj);
      eventos.forEach((e) => window.removeEventListener(e, usar, { capture: true }));
    };
  }, [hayNueva]);

  if (!hayNueva) return null;

  return (
    <div
      className="d-flex align-items-center justify-content-center flex-wrap gap-2 px-3 py-1"
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        zIndex: 3000,
        backgroundColor: "#1b4332",
        color: "#fff",
        fontSize: "0.82rem",
        boxShadow: "0 2px 6px rgba(0,0,0,0.25)",
      }}
    >
      <span>
        <i className="bi bi-arrow-repeat me-1"></i>
        <span className="fw-semibold">Hay una versión nueva del programa.</span>
      </span>
      <button
        type="button"
        onClick={() => window.location.reload()}
        className="btn btn-sm btn-light fw-semibold py-0 px-2"
        style={{ fontSize: "0.78rem" }}
      >
        Actualizar ahora
      </button>
      <span>o se actualizará tras 3 min sin uso</span>
    </div>
  );
}

export default AvisoVersionNueva;
