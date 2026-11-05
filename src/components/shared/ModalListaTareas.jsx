import { useState } from "react";
import { Button, Form, Modal, Spinner, Table } from "react-bootstrap";
import Swal from "sweetalert2";

const th = {
  backgroundColor: "#164e63",
  color: "#fff",
  fontSize: "0.66rem",
  fontWeight: 600,
  verticalAlign: "middle",
  padding: "3px 5px",
  whiteSpace: "nowrap",
};
const td = { fontSize: "0.72rem", padding: "2px 5px", verticalAlign: "middle" };
const raya = <span style={{ color: "#cbd5e1" }}>—</span>;

/**
 * Un listado de tareas con su alta, para Equivalencias de tareas
 * (05/11/2026): el de Citrusvil y el de La Martina usan el mismo.
 *
 * Arriba se agrega una tarea (nombre y unidad) y abajo están todas. Lo que se
 * agrega queda enseguida para usar en la tabla de equivalencias.
 *
 * - `filas`: [{ clave, nombre, unidad, detalle?, borrable? }]
 * - `unidades`: con una lista, la unidad se elige de un desplegable y es
 *   obligatoria (la de La Martina); sin lista, es texto libre y opcional, con
 *   `sugeridas` para completar (la de Citrusvil).
 * - `onAgregar(nombre, unidad)` y `onBorrar(fila)`: devuelven una promesa;
 *   si falla, el error se muestra acá.
 */
function ModalListaTareas({
  show,
  onHide,
  titulo,
  icono,
  filas,
  unidades = null,
  sugeridas = [],
  puedeAgregar,
  sinPermiso = "Sin permiso para agregar",
  aviso,
  // El rótulo del campo del nombre ("Tarea Ctv" en el de Citrusvil).
  etiqueta = "Tarea",
  onAgregar,
  onBorrar,
}) {
  const [nombre, setNombre] = useState("");
  const [unidad, setUnidad] = useState("");
  const [guardando, setGuardando] = useState(false);

  const cerrar = () => {
    if (guardando) return;
    setNombre("");
    setUnidad("");
    onHide();
  };

  const agregar = async (ev) => {
    ev.preventDefault();
    if (!nombre.trim() || (unidades && !unidad)) return;
    setGuardando(true);
    try {
      await onAgregar(nombre.trim(), unidad.trim());
      setNombre("");
      setUnidad("");
      Swal.fire({ icon: "success", title: "Tarea agregada", timer: 1500, showConfirmButton: false, width: "300px" });
    } catch (err) {
      Swal.fire({ icon: "error", title: "No se pudo agregar", text: err.message, width: "300px" });
    } finally {
      setGuardando(false);
    }
  };

  const borrar = async (fila) => {
    const { isConfirmed } = await Swal.fire({
      icon: "warning",
      title: "¿Borrar la tarea?",
      text: `«${fila.nombre}». Esta acción no se puede deshacer.`,
      width: "320px",
      showCancelButton: true,
      confirmButtonText: "Sí, borrar",
      cancelButtonText: "Cancelar",
      confirmButtonColor: "#dc2626",
      cancelButtonColor: "#64748b",
    });
    if (!isConfirmed) return;
    try {
      await onBorrar(fila);
    } catch (err) {
      Swal.fire({ icon: "error", title: "No se pudo borrar", text: err.message, width: "300px" });
    }
  };

  const conBorrar = Boolean(onBorrar);
  const columnas = conBorrar ? 4 : 3;

  return (
    <Modal show={show} onHide={cerrar} centered size="lg" contentClassName="border-0 shadow-lg rounded-4">
      <Modal.Header
        closeButton
        closeVariant="white"
        style={{
          backgroundColor: "#164e63",
          color: "#fff",
          borderTopLeftRadius: "1rem",
          borderTopRightRadius: "1rem",
          borderBottom: "1px solid rgba(255,255,255,0.1)",
        }}
      >
        <Modal.Title className="fs-6 fw-bold d-flex align-items-center gap-2 text-white">
          <i className={icono} style={{ color: "#67e8f9" }}></i>
          <span>{titulo}</span>
          <span className="fw-normal" style={{ fontSize: "0.8rem", opacity: 0.75 }}>
            ({filas.length})
          </span>
        </Modal.Title>
      </Modal.Header>
      <Modal.Body className="p-3">
        {/* Agregar una tarea */}
        <Form onSubmit={agregar} className="d-flex align-items-end gap-2 mb-2">
          <div style={{ flex: "1 1 auto" }}>
            <Form.Label className="fw-semibold text-dark small mb-1">{etiqueta}</Form.Label>
            <Form.Control
              size="sm"
              className="rounded-3"
              style={{ fontSize: "0.84rem" }}
              value={nombre}
              maxLength={150}
              onChange={(e) => setNombre(e.target.value)}
              disabled={!puedeAgregar || guardando}
            />
          </div>
          <div style={{ width: "140px" }}>
            <Form.Label className="fw-semibold text-dark small mb-1">
              Unidad {unidades && <span className="text-danger">*</span>}
            </Form.Label>
            {unidades ? (
              <Form.Select
                size="sm"
                className="rounded-3"
                style={{ fontSize: "0.84rem" }}
                value={unidad}
                onChange={(e) => setUnidad(e.target.value)}
                disabled={!puedeAgregar || guardando}
              >
                <option value="">— Seleccionar —</option>
                {unidades.map((u) => (
                  <option key={u} value={u}>
                    {u}
                  </option>
                ))}
              </Form.Select>
            ) : (
              <>
                <Form.Control
                  size="sm"
                  className="rounded-3"
                  style={{ fontSize: "0.84rem" }}
                  value={unidad}
                  maxLength={20}
                  list="unidades-sugeridas"
                  onChange={(e) => setUnidad(e.target.value)}
                  disabled={!puedeAgregar || guardando}
                />
                <datalist id="unidades-sugeridas">
                  {sugeridas.map((u) => (
                    <option key={u} value={u} />
                  ))}
                </datalist>
              </>
            )}
          </div>
          <Button
            type="submit"
            size="sm"
            className="rounded-3 px-3 d-flex align-items-center gap-1"
            style={{ backgroundColor: "#15803d", borderColor: "#15803d", fontSize: "0.84rem", fontWeight: 600, height: "31px" }}
            disabled={!puedeAgregar || guardando || !nombre.trim() || (unidades && !unidad)}
            title={puedeAgregar ? "Agregar la tarea" : sinPermiso}
          >
            {guardando ? <Spinner animation="border" size="sm" /> : <i className="bi bi-plus-lg"></i>}
            Agregar
          </Button>
        </Form>
        {aviso && (
          <div className="mb-2" style={{ fontSize: "0.74rem", color: "#64748b" }}>
            {aviso}
          </div>
        )}

        {/* Todas las tareas */}
        <div
          className="rounded-3 bg-white"
          style={{ maxHeight: "55vh", overflowY: "auto", border: "1px solid #cbd5e1" }}
        >
          <Table className="mb-0 tabla-informe" style={{ width: "100%" }}>
            <thead style={{ position: "sticky", top: 0, zIndex: 10, backgroundColor: "#164e63", color: "#fff" }}>
              <tr>
                <th style={{ ...th, width: "28px", textAlign: "center" }}>#</th>
                <th style={th}>Tarea</th>
                <th style={{ ...th, width: "90px", textAlign: "center" }}>Unidad</th>
                {conBorrar && <th style={{ ...th, width: "44px", textAlign: "center" }}></th>}
              </tr>
            </thead>
            <tbody>
              {!filas.length ? (
                <tr>
                  <td colSpan={columnas} className="text-center text-muted py-4" style={td}>
                    No hay tareas cargadas
                  </td>
                </tr>
              ) : (
                filas.map((f, i) => (
                  <tr key={f.clave}>
                    <td style={{ ...td, textAlign: "center", color: "#64748b" }}>{i + 1}</td>
                    <td style={td}>
                      {f.nombre}
                      {f.detalle && (
                        <span className="ms-2" style={{ fontSize: "0.66rem", color: "#0e7490", fontWeight: 600 }}>
                          {f.detalle}
                        </span>
                      )}
                    </td>
                    <td style={{ ...td, textAlign: "center" }}>{f.unidad || raya}</td>
                    {conBorrar && (
                      <td style={{ ...td, textAlign: "center" }}>
                        {f.borrable && (
                          <button
                            onClick={() => borrar(f)}
                            disabled={!puedeAgregar}
                            className="btn btn-sm btn-outline-danger d-inline-flex align-items-center justify-content-center rounded-2 p-0"
                            style={{ width: "24px", height: "24px" }}
                            title={puedeAgregar ? "Borrar" : sinPermiso}
                          >
                            <i className="bi bi-trash" style={{ fontSize: "0.8rem" }}></i>
                          </button>
                        )}
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </Table>
        </div>
      </Modal.Body>
    </Modal>
  );
}

export default ModalListaTareas;
