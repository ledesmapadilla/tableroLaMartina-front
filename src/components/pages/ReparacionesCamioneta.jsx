import { useEffect, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { Container, Button, Table, Modal, Form, InputGroup } from "react-bootstrap";
import { useForm } from "react-hook-form";
import Swal from "sweetalert2";

const formatF = (iso) =>
  iso ? new Date(iso).toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric" }) : "—";

const FILA_VACIA = { nombre: "", costo: "", observaciones: "" };

function ReparacionesCamioneta() {
  const navigate = useNavigate();
  const { camionetaId } = useParams();
  const { state } = useLocation();
  const patente = state?.patente ?? "—";
  const marca   = state?.marca   ?? "";

  const [trabajos, setTrabajos] = useState([]);

  // Modal crear/editar
  const [showForm, setShowForm] = useState(false);
  const [editando, setEditando] = useState(null);
  const { register, handleSubmit, reset, formState: { errors } } = useForm();

  // Modal detalle (textarea)
  const [showDetalle, setShowDetalle]   = useState(false);
  const [detalleTexto, setDetalleTexto] = useState("");
  const [detalleId, setDetalleId]       = useState(null);

  // Modal ver
  const [showVer, setShowVer] = useState(false);
  const [verItem, setVerItem] = useState(null);

  // Modal repuestos CRUD
  const [showRepuestos, setShowRepuestos]     = useState(false);
  const [repuestosId, setRepuestosId]         = useState(null);
  const [repuestosLista, setRepuestosLista]   = useState([]);
  const [nuevaFila, setNuevaFila]             = useState(FILA_VACIA);

  const cargar = () =>
    fetch(`/api/trabajos-camioneta/${camionetaId}`)
      .then((r) => r.json()).then(setTrabajos).catch(() => setTrabajos([]));

  useEffect(() => { cargar(); }, [camionetaId]);

  /* ── Crear / Editar ── */
  const abrirNuevo = () => {
    setEditando(null);
    reset({ fecha: new Date().toISOString().split("T")[0], descripcion: "" });
    setShowForm(true);
  };
  const abrirEditar = (t) => {
    setEditando(t._id);
    reset({ fecha: t.fecha ? t.fecha.split("T")[0] : "", descripcion: t.descripcion ?? "" });
    setShowForm(true);
  };
  const cerrarForm = () => { setShowForm(false); setEditando(null); };
  const onSubmit = async (data) => {
    try {
      const url    = editando ? `/api/trabajos-camioneta/${editando}` : "/api/trabajos-camioneta";
      const method = editando ? "PUT" : "POST";
      const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...data, camioneta: camionetaId }) });
      if (res.ok) {
        cerrarForm(); cargar();
        Swal.fire({ icon: "success", title: editando ? "Trabajo actualizado" : "Trabajo guardado", timer: 1500, showConfirmButton: false });
      } else { const err = await res.json(); Swal.fire({ icon: "error", title: "Error", text: err.error }); }
    } catch { Swal.fire({ icon: "error", title: "Sin conexión" }); }
  };

  /* ── Eliminar ── */
  const eliminar = async (id) => {
    const r = await Swal.fire({ icon: "warning", title: "¿Eliminar trabajo?", showCancelButton: true, confirmButtonText: "Eliminar", cancelButtonText: "Cancelar", confirmButtonColor: "#7a4040" });
    if (!r.isConfirmed) return;
    try { await fetch(`/api/trabajos-camioneta/${id}`, { method: "DELETE" }); cargar(); }
    catch { Swal.fire({ icon: "error", title: "Sin conexión" }); }
  };

  /* ── Detalle ── */
  const abrirDetalle = (t) => { setDetalleId(t._id); setDetalleTexto(t.detalle ?? ""); setShowDetalle(true); };
  const guardarDetalle = async () => {
    try {
      await fetch(`/api/trabajos-camioneta/${detalleId}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ detalle: detalleTexto }) });
      setShowDetalle(false); cargar();
    } catch { Swal.fire({ icon: "error", title: "Sin conexión" }); }
  };

  /* ── Ver ── */
  const abrirVer = (t) => { setVerItem(t); setShowVer(true); };

  /* ── Repuestos CRUD ── */
  const abrirRepuestos = (t) => {
    setRepuestosId(t._id);
    setRepuestosLista(t.repuestos ? t.repuestos.map((r) => ({ ...r })) : []);
    setNuevaFila(FILA_VACIA);
    setShowRepuestos(true);
  };
  const agregarFila = () => {
    setRepuestosLista((prev) => [...prev, { ...nuevaFila }]);
    setNuevaFila(FILA_VACIA);
  };
  const eliminarFila = (idx) => setRepuestosLista((prev) => prev.filter((_, i) => i !== idx));
  const editarFila = (idx, campo, valor) =>
    setRepuestosLista((prev) => prev.map((r, i) => i === idx ? { ...r, [campo]: valor } : r));
  const guardarRepuestos = async () => {
    try {
      const lista = repuestosLista.map(({ nombre, costo, observaciones }) => ({ nombre, costo, observaciones }));
      await fetch(`/api/trabajos-camioneta/${repuestosId}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ repuestos: lista }) });
      setShowRepuestos(false); cargar();
      Swal.fire({ icon: "success", title: "Repuestos guardados", timer: 1200, showConfirmButton: false });
    } catch { Swal.fire({ icon: "error", title: "Sin conexión" }); }
  };

  return (
    <Container className="py-4">

      {/* Encabezado */}
      <div style={{ position: "relative", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: "1.5rem" }}>
        <h3 className="fw-bold mb-0 text-center">Reparaciones camioneta: {patente}{marca ? ` — ${marca}` : ""}</h3>
        <div className="d-flex gap-2" style={{ position: "absolute", right: 0 }}>
          <Button onClick={() => navigate("/camionetas/services/reparaciones")} style={{ backgroundColor: "#fff", border: "1px solid #000", color: "#000" }}>
            <i className="bi bi-arrow-left me-2"></i>Volver
          </Button>
          <Button onClick={() => navigate("/camionetas/resumen")} style={{ backgroundColor: "#fff", border: "1px solid #000", color: "#000" }}>
            <i className="bi bi-speedometer me-2"></i>Tablero
          </Button>
          <Button onClick={() => navigate("/")} style={{ backgroundColor: "#fff", border: "1px solid #000", color: "#000" }}>
            <i className="bi bi-house-fill me-2"></i>General
          </Button>
        </div>
      </div>

      {/* Botón agregar */}
      <div className="mb-3">
        <Button onClick={abrirNuevo} style={{ backgroundColor: "#2c2c2c", border: "none", color: "#fff" }}>
          <i className="bi bi-plus-lg me-2"></i>Agregar Reparación
        </Button>
      </div>

      {/* Tabla principal */}
      <Table bordered size="sm" className="text-center align-middle">
        <thead className="table-dark">
          <tr>
            <th style={{ width: "120px" }}>Fecha</th>
            <th>Reparación</th>
            <th style={{ width: "220px" }}>Acciones</th>
          </tr>
        </thead>
        <tbody>
          {trabajos.length === 0 && <tr><td colSpan={3} className="text-muted py-3">Sin registros</td></tr>}
          {trabajos.map((t) => (
            <tr key={t._id}>
              <td>{formatF(t.fecha)}</td>
              <td className="text-start">{t.descripcion}</td>
              <td>
                <div className="d-flex justify-content-center gap-1">
                  <Button size="sm" onClick={() => abrirDetalle(t)} style={{ backgroundColor: "#52735a", border: "none", fontSize: "0.78rem" }}>Detalle</Button>
                  <Button size="sm" onClick={() => abrirRepuestos(t)} style={{ backgroundColor: "#9e8850", border: "none", fontSize: "0.78rem" }}>Repuestos</Button>
                  <Button size="sm" onClick={() => abrirVer(t)} style={{ backgroundColor: "#4a6fa5", border: "none" }}>
                    <i className="bi bi-eye"></i>
                  </Button>
                  <Button size="sm" onClick={() => abrirEditar(t)} style={{ backgroundColor: "#2c2c2c", border: "none" }}>
                    <i className="bi bi-pencil"></i>
                  </Button>
                  <Button size="sm" onClick={() => eliminar(t._id)} style={{ backgroundColor: "#7a4040", border: "none" }}>
                    <i className="bi bi-trash"></i>
                  </Button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </Table>

      {/* Modal Crear / Editar */}
      <Modal show={showForm} onHide={cerrarForm} centered contentClassName="border border-dark">
        <Modal.Header closeButton>
          <Modal.Title className="fw-bold">{editando ? "Editar reparación" : "Nueva reparación"}</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form onSubmit={handleSubmit(onSubmit)}>
            <Form.Group className="mb-3">
              <Form.Label className="fw-semibold">Fecha</Form.Label>
              <Form.Control type="date" className="w-50" {...register("fecha", { required: "Requerido" })} isInvalid={!!errors.fecha} />
              <Form.Control.Feedback type="invalid">{errors.fecha?.message}</Form.Control.Feedback>
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label className="fw-semibold">Breve descripción</Form.Label>
              <Form.Control type="text" placeholder="Ej: Cambio de correa" {...register("descripcion", { required: "Requerido" })} isInvalid={!!errors.descripcion} />
              <Form.Control.Feedback type="invalid">{errors.descripcion?.message}</Form.Control.Feedback>
            </Form.Group>
            <div className="d-flex justify-content-end gap-2">
              <Button variant="secondary" onClick={cerrarForm}>Cancelar</Button>
              <Button type="submit" style={{ backgroundColor: "#2c2c2c", border: "none", color: "#fff" }}>
                <i className="bi bi-save me-2"></i>Guardar
              </Button>
            </div>
          </Form>
        </Modal.Body>
      </Modal>

      {/* Modal Detalle */}
      <Modal show={showDetalle} onHide={() => setShowDetalle(false)} centered size="lg" contentClassName="border border-dark">
        <Modal.Header closeButton>
          <Modal.Title className="fw-bold">Detalle de tarea</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form.Control as="textarea" rows={14} placeholder="Escribí aquí el detalle de la tarea a realizar..." value={detalleTexto} onChange={(e) => setDetalleTexto(e.target.value)} style={{ resize: "none", fontSize: "0.95rem" }} />
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowDetalle(false)}>Cancelar</Button>
          <Button onClick={guardarDetalle} style={{ backgroundColor: "#2c2c2c", border: "none", color: "#fff" }}>
            <i className="bi bi-save me-2"></i>Guardar
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Modal Repuestos CRUD */}
      <Modal show={showRepuestos} onHide={() => setShowRepuestos(false)} centered size="xl" contentClassName="border border-dark">
        <Modal.Header closeButton>
          <Modal.Title className="fw-bold">Repuestos</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Table bordered size="sm" className="text-center align-middle mb-3">
            <thead className="table-dark">
              <tr>
                <th>Repuesto</th>
                <th style={{ width: "120px" }}>Costo</th>
                <th>Observaciones</th>
                <th style={{ width: "50px" }}></th>
              </tr>
            </thead>
            <tbody>
              {repuestosLista.length === 0 && <tr><td colSpan={4} className="text-muted">Sin repuestos</td></tr>}
              {repuestosLista.map((r, idx) => (
                <tr key={idx}>
                  <td>
                    <Form.Control size="sm" value={r.nombre} onChange={(e) => editarFila(idx, "nombre", e.target.value)} />
                  </td>
                  <td>
                    <InputGroup size="sm">
                      <InputGroup.Text>$</InputGroup.Text>
                      <Form.Control type="number" value={r.costo ?? ""} onChange={(e) => editarFila(idx, "costo", e.target.value)} style={{ textAlign: "right" }} />
                    </InputGroup>
                  </td>
                  <td>
                    <Form.Control size="sm" value={r.observaciones} onChange={(e) => editarFila(idx, "observaciones", e.target.value)} />
                  </td>
                  <td>
                    <button type="button" onClick={() => eliminarFila(idx)} style={{ background: "none", border: "none", color: "#7a4040", cursor: "pointer", fontSize: "1rem" }}>
                      <i className="bi bi-trash"></i>
                    </button>
                  </td>
                </tr>
              ))}
              {/* Fila para agregar nuevo */}
              <tr style={{ backgroundColor: "#f8f9fa" }}>
                <td>
                  <Form.Control size="sm" placeholder="Repuesto..." value={nuevaFila.nombre} onChange={(e) => setNuevaFila((p) => ({ ...p, nombre: e.target.value }))} onKeyDown={(e) => e.key === "Enter" && agregarFila()} />
                </td>
                <td>
                  <InputGroup size="sm">
                      <InputGroup.Text>$</InputGroup.Text>
                      <Form.Control type="number" placeholder="0" value={nuevaFila.costo} onChange={(e) => setNuevaFila((p) => ({ ...p, costo: e.target.value }))} style={{ textAlign: "right" }} onKeyDown={(e) => e.key === "Enter" && agregarFila()} />
                    </InputGroup>
                </td>
                <td>
                  <Form.Control size="sm" placeholder="Observaciones..." value={nuevaFila.observaciones} onChange={(e) => setNuevaFila((p) => ({ ...p, observaciones: e.target.value }))} onKeyDown={(e) => e.key === "Enter" && agregarFila()} />
                </td>
                <td>
                  <Button type="button" size="sm" onClick={agregarFila} style={{ backgroundColor: "#52735a", border: "none", fontSize: "0.75rem", padding: "2px 8px" }}>
                    Agregar
                  </Button>
                </td>
              </tr>
            </tbody>
          </Table>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowRepuestos(false)}>Cancelar</Button>
          <Button onClick={guardarRepuestos} style={{ backgroundColor: "#2c2c2c", border: "none", color: "#fff" }}>
            <i className="bi bi-save me-2"></i>Guardar
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Modal Ver */}
      <Modal show={showVer} onHide={() => setShowVer(false)} centered size="lg" contentClassName="border border-dark">
        <Modal.Header closeButton>
          <Modal.Title className="fw-bold">Resumen de reparación</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {verItem && (
            <>
              <p><span className="fw-semibold">Fecha:</span> {formatF(verItem.fecha)}</p>
              <p><span className="fw-semibold">Descripción:</span> {verItem.descripcion}</p>
              {verItem.detalle && <><p className="fw-semibold mb-1">Detalle:</p><p className="text-muted" style={{ whiteSpace: "pre-wrap" }}>{verItem.detalle}</p></>}
              <p className="fw-semibold mb-1">Repuestos:</p>
              {verItem.repuestos?.length > 0
                ? <Table bordered size="sm" className="text-center align-middle">
                    <thead className="table-secondary">
                      <tr><th>Repuesto</th><th>Costo</th><th>Observaciones</th></tr>
                    </thead>
                    <tbody>
                      {verItem.repuestos.map((r, i) => (
                        <tr key={i}>
                          <td className="text-start">{r.nombre}</td>
                          <td>{r.costo != null ? `$${Number(r.costo).toLocaleString("es-AR")}` : "—"}</td>
                          <td className="text-start">{r.observaciones || "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </Table>
                : <p className="text-muted">Sin repuestos cargados</p>
              }
            </>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowVer(false)}>Cerrar</Button>
        </Modal.Footer>
      </Modal>

    </Container>
  );
}

export default ReparacionesCamioneta;
