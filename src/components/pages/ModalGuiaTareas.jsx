import { useEffect, useState } from "react";
import { Button, Form, Modal, Table } from "react-bootstrap";
import Swal from "sweetalert2";
import { api } from "../../services/api";
import SelectBuscador from "../shared/SelectBuscador";

/**
 * Guía de tareas (04/11/2026): el "?" al lado de Tarea en la planilla de
 * carga. Dice qué tarea del padrón va para cada trabajo, así se usa una que
 * ya existe en vez de dar de alta otra. Agregar, editar y borrar piden el
 * mismo permiso que dar de alta una tarea (altas.tareas). Se monta solo
 * mientras está abierto.
 */
const VERDE = "#1b4332";

const th = {
  backgroundColor: VERDE,
  color: "#fff",
  fontSize: "0.66rem",
  fontWeight: 600,
  verticalAlign: "middle",
  padding: "3px 5px",
  whiteSpace: "nowrap",
};
const td = { fontSize: "0.7rem", padding: "1px 5px", verticalAlign: "middle" };
const campo = { fontSize: "0.75rem", padding: "2px 6px", height: "28px" };
const botonFila = { width: "24px", height: "24px" };
const VACIO = { descripcion: "", tarea: "", observaciones: "" };
const raya = <span style={{ color: "#cbd5e1" }}>—</span>;
const SIN_PERMISO = "Tu rol no tiene permiso para editar la guía";

export default function ModalGuiaTareas({ onCerrar, opcionesTarea, puedeAgregar }) {
  const [guia, setGuia] = useState([]);
  const [cargando, setCargando] = useState(true);
  // El trabajo que se está cargando o corrigiendo: sin _id es uno nuevo.
  const [editando, setEditando] = useState(null);
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    api
      .get("/guia-tareas")
      .then((data) => setGuia(Array.isArray(data) ? data : []))
      .catch(() => setGuia([]))
      .finally(() => setCargando(false));
  }, []);

  const cambiar = (k, v) => setEditando((n) => ({ ...n, [k]: v }));

  const abrirEditar = (g) =>
    setEditando({
      _id: g._id,
      descripcion: g.descripcion || "",
      tarea: g.tarea?._id || "",
      observaciones: g.observaciones || "",
    });

  // Guardado el trabajo (nuevo o corregido), el modal se cierra (pedido del
  // usuario, 04/11/2026).
  const guardar = async () => {
    if (!editando.descripcion.trim() || !editando.tarea) {
      Swal.fire({ icon: "error", title: "Faltan datos", text: "La descripción y la tarea son obligatorias.", width: "300px" });
      return;
    }
    setGuardando(true);
    try {
      const { _id, ...datos } = editando;
      if (_id) await api.put(`/guia-tareas/${_id}`, datos);
      else await api.post("/guia-tareas", datos);
      onCerrar();
      Swal.fire({
        icon: "success",
        title: _id ? "Trabajo guardado" : "Trabajo agregado",
        timer: 1500,
        showConfirmButton: false,
        width: "300px",
      });
    } catch (error) {
      Swal.fire({ icon: "error", title: "No se pudo guardar", text: error.message, width: "300px" });
    } finally {
      setGuardando(false);
    }
  };

  const borrar = async (g) => {
    const { isConfirmed } = await Swal.fire({
      icon: "warning",
      title: "¿Borrar el trabajo?",
      text: g.descripcion,
      width: "320px",
      showCancelButton: true,
      confirmButtonText: "Sí, borrar",
      cancelButtonText: "Cancelar",
      confirmButtonColor: "#dc2626",
      cancelButtonColor: "#64748b",
    });
    if (!isConfirmed) return;
    try {
      await api.delete(`/guia-tareas/${g._id}`);
      setGuia((lista) => lista.filter((x) => x._id !== g._id));
      Swal.fire({ icon: "success", title: "Trabajo borrado", timer: 1500, showConfirmButton: false, width: "300px" });
    } catch (error) {
      Swal.fire({ icon: "error", title: "No se pudo borrar", text: error.message, width: "300px" });
    }
  };

  // La fila con los campos para escribir: la de un trabajo nuevo, al final, o
  // la del que se corrige, en su lugar.
  const filaEdicion = (clave) => (
    <tr key={clave} className="fila-editando">
      <td style={{ ...td, minWidth: "180px" }}>
        <Form.Control
          autoFocus
          value={editando.descripcion}
          onChange={(e) => cambiar("descripcion", e.target.value)}
          placeholder="Descripción del trabajo"
          style={campo}
        />
      </td>
      <td style={{ ...td, minWidth: "200px" }}>
        <SelectBuscador
          opciones={opcionesTarea}
          valor={editando.tarea}
          onChange={(v) => cambiar("tarea", v)}
          placeholder="—"
          style={campo}
        />
      </td>
      <td style={{ ...td, minWidth: "180px" }}>
        <Form.Control
          value={editando.observaciones}
          onChange={(e) => cambiar("observaciones", e.target.value)}
          style={campo}
        />
      </td>
      <td style={td}></td>
    </tr>
  );

  return (
    <Modal show onHide={onCerrar} centered size="lg" contentClassName="border-0 shadow-lg rounded-4">
      <Modal.Header
        closeButton
        closeVariant="white"
        style={{ backgroundColor: VERDE, color: "#fff", borderTopLeftRadius: "1rem", borderTopRightRadius: "1rem" }}
      >
        <Modal.Title className="fs-6 fw-bold d-flex align-items-center gap-2 text-white">
          <i className="bi bi-question-circle"></i>
          <span>Guía de tareas</span>
        </Modal.Title>
      </Modal.Header>
      <Modal.Body className="p-3">
        <div
          className="shadow-sm rounded-3 bg-white"
          style={{ maxHeight: "60vh", overflowY: "auto", overflowX: "auto", border: "1px solid #cbd5e1" }}
        >
          <Table className="mb-0 tabla-informe" style={{ width: "100%" }}>
            <thead style={{ position: "sticky", top: 0, zIndex: 10 }}>
              <tr>
                <th style={th}>Descripción trabajo</th>
                <th style={th}>Tarea</th>
                <th style={th}>Observaciones</th>
                <th style={{ ...th, width: "70px" }}></th>
              </tr>
            </thead>
            <tbody>
              {guia.length === 0 && !editando && (
                <tr>
                  <td colSpan={4} className="text-center text-muted py-4" style={td}>
                    {cargando ? "Cargando…" : "No hay trabajos cargados"}
                  </td>
                </tr>
              )}
              {guia.map((g) =>
                editando?._id === g._id ? (
                  filaEdicion(g._id)
                ) : (
                  <tr key={g._id}>
                    <td style={td}>{g.descripcion}</td>
                    <td style={td}>{g.tarea?.tarea || raya}</td>
                    <td style={td}>{g.observaciones || raya}</td>
                    <td style={td}>
                      <div className="d-flex justify-content-center align-items-center" style={{ gap: "8px" }}>
                        <button
                          type="button"
                          onClick={() => abrirEditar(g)}
                          disabled={!puedeAgregar || !!editando}
                          className="btn btn-sm btn-outline-primary d-flex align-items-center justify-content-center rounded-2 p-0"
                          style={botonFila}
                          title={puedeAgregar ? "Editar" : SIN_PERMISO}
                        >
                          <i className="bi bi-pencil" style={{ fontSize: "0.8rem" }}></i>
                        </button>
                        <button
                          type="button"
                          onClick={() => borrar(g)}
                          disabled={!puedeAgregar || !!editando}
                          className="btn btn-sm btn-outline-danger d-flex align-items-center justify-content-center rounded-2 p-0"
                          style={botonFila}
                          title={puedeAgregar ? "Borrar" : SIN_PERMISO}
                        >
                          <i className="bi bi-trash" style={{ fontSize: "0.8rem" }}></i>
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              )}
              {editando && !editando._id && filaEdicion("nuevo")}
            </tbody>
          </Table>
        </div>

        <div className="d-flex justify-content-end gap-2 mt-3">
          {editando ? (
            <>
              <Button size="sm" variant="outline-secondary" onClick={() => setEditando(null)} disabled={guardando}>
                Cancelar
              </Button>
              <Button
                size="sm"
                onClick={guardar}
                disabled={guardando}
                style={{ backgroundColor: VERDE, borderColor: VERDE }}
              >
                <i className="bi bi-check-lg"></i> Guardar
              </Button>
            </>
          ) : (
            <Button
              size="sm"
              onClick={() => setEditando({ ...VACIO })}
              disabled={!puedeAgregar}
              title={puedeAgregar ? undefined : SIN_PERMISO}
              style={{ backgroundColor: VERDE, borderColor: VERDE }}
            >
              <i className="bi bi-plus-lg"></i> Agregar trabajo
            </Button>
          )}
        </div>
      </Modal.Body>
    </Modal>
  );
}
