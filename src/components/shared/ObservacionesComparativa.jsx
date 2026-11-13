import { useState } from "react";
import { Button, Form, Modal } from "react-bootstrap";
import Swal from "sweetalert2";
import { useAuth } from "../../context/AuthContext";

/**
 * Observaciones de las filas de la solapa Comparativa (12/11/2026): cualquiera
 * con sesión escribe con el "+", y el ojo (solo si hay algo escrito) muestra
 * todas, con quién y cuándo. Cada una la borra quien la escribió (o Nacho).
 * Se guardan por mes, campo y comparativa (volumétrica o costos).
 */

const fechaCorta = (f) => {
  const d = new Date(f);
  if (Number.isNaN(d.getTime())) return "";
  const dos = (n) => String(n).padStart(2, "0");
  return `${dos(d.getDate())}/${dos(d.getMonth() + 1)}/${d.getFullYear()} ${dos(d.getHours())}:${dos(d.getMinutes())}`;
};

/**
 * El "+" y, si hay algo escrito, el ojo con la cantidad. Paran el clic para
 * que no se abra el historial de la fila.
 */
export function BotonesObservacion({ notas = [], onAgregar, onVer }) {
  const parar = (fn) => (e) => {
    e.stopPropagation();
    fn();
  };
  return (
    <div className="d-flex justify-content-center align-items-center" style={{ gap: "8px" }}>
      <button
        type="button"
        onClick={parar(onAgregar)}
        className="btn btn-sm btn-outline-success d-flex align-items-center justify-content-center rounded-2 p-0"
        style={{ width: "22px", height: "22px" }}
        title="Escribir una observación"
      >
        <i className="bi bi-plus-lg" style={{ fontSize: "0.75rem" }}></i>
      </button>
      {notas.length > 0 && (
        <button
          type="button"
          onClick={parar(onVer)}
          className="btn btn-sm btn-outline-primary d-flex align-items-center justify-content-center gap-1 rounded-2 px-1 py-0"
          style={{ height: "22px", fontSize: "0.66rem" }}
          // Quién escribió, sin abrir el modal (12/11/2026).
          title={`Ver ${notas.length === 1 ? "la observación" : `las ${notas.length} observaciones`} de ${[
            ...new Set(notas.map((n) => n.nombre || n.usuario || "—")),
          ].join(", ")}`}
        >
          <i className="bi bi-eye" style={{ fontSize: "0.78rem" }}></i>
          {notas.length > 1 && <span>{notas.length}</span>}
        </button>
      )}
    </div>
  );
}

const encabezado = (color) => ({
  backgroundColor: color,
  color: "#fff",
  borderTopLeftRadius: "1rem",
  borderTopRightRadius: "1rem",
  borderBottom: "1px solid rgba(255,255,255,0.1)",
});

/**
 * Los dos modales: escribir (`fila` con `modo: "agregar"`) y ver (`modo:
 * "ver"`). `fila`: { clave, tarea, modo } o null.
 */
export function ModalesObservacion({ fila, onCerrar, notas = [], onAgregar, onBorrar, color, icono }) {
  const { user } = useAuth();
  const [texto, setTexto] = useState("");
  const [guardando, setGuardando] = useState(false);
  const esNacho = user?.rol === "superadmin" && user?.usuario === "nacho";

  // Al cerrar, el texto se limpia para la próxima.
  const cerrar = () => {
    setTexto("");
    onCerrar();
  };

  const guardar = async (ev) => {
    ev.preventDefault();
    if (!texto.trim()) return;
    setGuardando(true);
    try {
      await onAgregar(fila.clave, fila.tarea, texto.trim());
      cerrar();
      Swal.fire({ icon: "success", title: "Guardado", timer: 1500, showConfirmButton: false, width: "300px" });
    } catch (err) {
      Swal.fire({ icon: "error", title: "No se pudo guardar", text: err.message, width: "300px" });
    } finally {
      setGuardando(false);
    }
  };

  const borrar = async (nota) => {
    const { isConfirmed } = await Swal.fire({
      icon: "warning",
      title: "¿Borrar la observación?",
      text: "Se va a borrar la observación.",
      width: "320px",
      showCancelButton: true,
      confirmButtonText: "Sí, borrar",
      cancelButtonText: "Cancelar",
      confirmButtonColor: "#dc2626",
      cancelButtonColor: "#64748b",
    });
    if (!isConfirmed) return;
    try {
      await onBorrar(fila.clave, nota);
      if (notas.length <= 1) onCerrar();
    } catch (err) {
      Swal.fire({ icon: "error", title: "No se pudo borrar", text: err.message, width: "300px" });
    }
  };

  const titulo = (
    <Modal.Title className="fs-6 fw-bold d-flex align-items-center gap-2 text-white">
      <i className={icono || "bi bi-chat-left-text"} style={{ color: "#fff", opacity: 0.85 }}></i>
      <span>{fila?.tarea || "Observaciones"}</span>
    </Modal.Title>
  );

  return (
    <>
      <Modal
        show={fila?.modo === "agregar"}
        onHide={() => !guardando && cerrar()}
        centered
        contentClassName="border-0 shadow-lg rounded-4 overflow-visible"
      >
        <Modal.Header closeButton closeVariant="white" style={encabezado(color)}>
          {titulo}
        </Modal.Header>
        <Form onSubmit={guardar}>
          <Modal.Body className="p-4">
            <Form.Label className="fw-semibold text-dark small mb-1">Observación</Form.Label>
            <Form.Control
              as="textarea"
              rows={4}
              autoFocus
              className="rounded-3"
              style={{ fontSize: "0.85rem" }}
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              maxLength={1000}
            />
          </Modal.Body>
          <Modal.Footer
            className="bg-light border-0 py-2.5 px-4"
            style={{ borderBottomLeftRadius: "1rem", borderBottomRightRadius: "1rem" }}
          >
            <Button
              variant="outline-secondary"
              size="sm"
              onClick={cerrar}
              disabled={guardando}
              className="rounded-3 px-3 py-1.5"
              style={{ fontSize: "0.84rem" }}
            >
              Cancelar
            </Button>
            <Button
              variant="success"
              size="sm"
              type="submit"
              disabled={guardando || !texto.trim()}
              className="rounded-3 px-3.5 py-1.5 shadow-sm d-flex align-items-center gap-1.5"
              style={{ backgroundColor: "#15803d", borderColor: "#15803d", fontSize: "0.84rem", fontWeight: 600 }}
            >
              <i className="bi bi-check-lg"></i>
              <span>Guardar</span>
            </Button>
          </Modal.Footer>
        </Form>
      </Modal>

      <Modal show={fila?.modo === "ver"} onHide={onCerrar} centered contentClassName="border-0 shadow-lg rounded-4 overflow-visible">
        <Modal.Header closeButton closeVariant="white" style={encabezado(color)}>
          {titulo}
        </Modal.Header>
        <Modal.Body className="p-3" style={{ maxHeight: "60vh", overflowY: "auto" }}>
          {notas.map((n) => {
            const puedeBorrar = n.usuario === user?.usuario || esNacho;
            return (
              <div key={n._id} className="rounded-3 border px-3 py-2 mb-2" style={{ backgroundColor: "#f8fafc" }}>
                <div className="d-flex align-items-center gap-2 mb-1" style={{ fontSize: "0.72rem", color: "#64748b" }}>
                  <i className="bi bi-person-fill"></i>
                  <span className="fw-semibold" style={{ color: "#334155" }}>
                    {n.nombre || n.usuario || "—"}
                  </span>
                  <span>{fechaCorta(n.fecha)}</span>
                  {puedeBorrar && (
                    <button
                      type="button"
                      onClick={() => borrar(n)}
                      className="btn btn-link p-0 ms-auto"
                      style={{ color: "#dc2626", fontSize: "0.8rem", lineHeight: 1 }}
                      title="Borrar la observación"
                    >
                      <i className="bi bi-trash"></i>
                    </button>
                  )}
                </div>
                <div style={{ fontSize: "0.85rem", color: "#1e293b", whiteSpace: "pre-wrap" }}>{n.texto}</div>
              </div>
            );
          })}
        </Modal.Body>
      </Modal>
    </>
  );
}
