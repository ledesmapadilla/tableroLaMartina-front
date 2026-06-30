import { useEffect, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { Container, Button, Table, Modal, Form, InputGroup } from "react-bootstrap";
import { useForm } from "react-hook-form";
import Swal from "sweetalert2";
import ExcelJS from "exceljs";

const formatF = (iso) =>
  iso ? new Date(iso).toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric" }) : "—";

const formatearPeso = (v) => {
  if (v === "" || v == null) return "";
  const n = parseFloat(String(v).replace(/\./g, "").replace(",", "."));
  return isNaN(n) ? "" : n.toLocaleString("es-AR", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
};
const parsearPeso = (v) => parseFloat(String(v).replace(/\./g, "").replace(",", ".")) || 0;

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
    reset({ fecha: new Date().toISOString().split("T")[0], descripcion: "", urgencia: "baja" });
    setShowForm(true);
  };
  const abrirEditar = (t) => {
    setEditando(t._id);
    reset({ fecha: t.fecha ? t.fecha.split("T")[0] : "", descripcion: t.descripcion ?? "", urgencia: t.urgencia ?? "baja" });
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

  /* ── Estado (solo lectura; se cambia desde el historial) ── */
  const ESTADO_COLORES = { pendiente: "#8b4a4a", "en proceso": "#c08a2d", terminada: "#52735a" };
  const ESTADO_LABELS = { pendiente: "Pendiente", "en proceso": "En proceso", terminada: "Terminada" };

  /* ── Urgencia ── */
  const URGENCIAS = ["baja", "media", "alta"];
  const URGENCIA_COLORES = { baja: "#7aaa80", media: "#c8a800", alta: "#8b4a4a" };
  const toggleUrgencia = async (t) => {
    const idx = URGENCIAS.indexOf(t.urgencia ?? "baja");
    const nueva = URGENCIAS[(idx + 1) % URGENCIAS.length];
    try {
      await fetch(`/api/trabajos-camioneta/${t._id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ urgencia: nueva }) });
      cargar();
    } catch { Swal.fire({ icon: "error", title: "Sin conexión" }); }
  };

  /* ── Detalle ── */
  const abrirDetalle = (t) => { setDetalleId(t._id); setDetalleTexto(t.detalle ?? ""); setShowDetalle(true); };
  const guardarDetalle = async () => {
    try {
      await fetch(`/api/trabajos-camioneta/${detalleId}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ detalle: detalleTexto }) });
      setShowDetalle(false); cargar();
    } catch { Swal.fire({ icon: "error", title: "Sin conexión" }); }
  };

  /* ── Repuestos CRUD ── */
  const abrirRepuestos = (t) => {
    setRepuestosId(t._id);
    setRepuestosLista(t.repuestos ? t.repuestos.map((r) => ({ ...r, costo: formatearPeso(r.costo) })) : []);
    setNuevaFila(FILA_VACIA);
    setShowRepuestos(true);
  };
  const agregarFila = () => {
    setRepuestosLista((prev) => [...prev, { ...nuevaFila, costo: formatearPeso(nuevaFila.costo) }]);
    setNuevaFila(FILA_VACIA);
  };
  const eliminarFila = (idx) => setRepuestosLista((prev) => prev.filter((_, i) => i !== idx));
  const editarFila = (idx, campo, valor) =>
    setRepuestosLista((prev) => prev.map((r, i) => i === idx ? { ...r, [campo]: valor } : r));
  const guardarRepuestos = async () => {
    try {
      const lista = repuestosLista.map(({ nombre, costo, observaciones }) => ({ nombre, costo: parsearPeso(costo), observaciones }));
      await fetch(`/api/trabajos-camioneta/${repuestosId}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ repuestos: lista }) });
      setShowRepuestos(false); cargar();
      Swal.fire({ icon: "success", title: "Repuestos guardados", timer: 1200, showConfirmButton: false });
    } catch { Swal.fire({ icon: "error", title: "Sin conexión" }); }
  };

  const pendientes = trabajos.filter((t) => (t.estado ?? "pendiente") === "pendiente");

  const exportarExcel = async () => {
    const titulo   = `Reparaciones — ${patente}${marca ? ` — ${marca}` : ""}`;
    const columnas = ["Fecha", "Reparación requerida", "Estado", "Urgencia"];
    const fechaHoy = new Date().toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric" });

    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("Reparaciones");

    ws.mergeCells(1, 1, 1, columnas.length);
    const celdaTitulo = ws.getCell("A1");
    celdaTitulo.value = titulo;
    celdaTitulo.font  = { bold: true, underline: true, size: 14 };
    celdaTitulo.alignment = { horizontal: "center", vertical: "middle" };
    ws.getRow(1).height = 22;

    ws.mergeCells(2, 1, 2, columnas.length);
    const celdaFecha = ws.getCell("A2");
    celdaFecha.value = `Fecha: ${fechaHoy}`;
    celdaFecha.alignment = { horizontal: "left" };
    ws.getRow(2).height = 16;

    ws.addRow([]);

    const filaEncabezado = ws.addRow(columnas);
    filaEncabezado.eachCell((cell) => {
      cell.font      = { bold: true };
      cell.alignment = { horizontal: "center", vertical: "middle" };
      cell.fill      = { type: "pattern", pattern: "solid", fgColor: { argb: "FFD9D9D9" } };
    });

    pendientes.forEach((t) => {
      const fila = ws.addRow([
        formatF(t.fecha),
        t.descripcion || "—",
        ESTADO_LABELS[t.estado ?? "pendiente"],
        t.urgencia ?? "baja",
      ]);
      fila.eachCell((cell) => { cell.alignment = { horizontal: "center", vertical: "middle" }; });
      fila.getCell(2).alignment = { horizontal: "left", vertical: "middle" };
    });

    ws.columns = [{ width: 14 }, { width: 44 }, { width: 14 }, { width: 12 }];

    const buffer = await wb.xlsx.writeBuffer();
    const blob   = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    const url    = URL.createObjectURL(blob);
    const a      = document.createElement("a");
    a.href       = url;
    a.download   = `reparaciones_${patente}_${new Date().toISOString().slice(0, 10)}.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Container className="py-4">

      {/* Botones */}
      <div className="d-flex justify-content-end gap-2 w-75 mx-auto">
        <Button onClick={() => navigate(-1)} style={{ backgroundColor: "#fff", border: "1px solid #000", color: "#000" }}>
          <i className="bi bi-arrow-left me-2"></i>Volver
        </Button>
        <Button onClick={() => navigate("/camionetas/resumen")} style={{ backgroundColor: "#fff", border: "1px solid #000", color: "#000" }}>
          <i className="bi bi-speedometer me-2"></i>Tablero
        </Button>
        <Button onClick={() => navigate("/")} style={{ backgroundColor: "#fff", border: "1px solid #000", color: "#000" }}>
          <i className="bi bi-house-fill me-2"></i>General
        </Button>
        <Button onClick={exportarExcel} disabled={pendientes.length === 0} style={{ backgroundColor: "#1d6f42", border: "1px solid #1d6f42", color: "#fff" }}>
          <i className="bi bi-file-earmark-excel me-2"></i>Excel
        </Button>
      </div>

      {/* Título */}
      <div className="text-center w-75 mx-auto" style={{ marginTop: "2rem", marginBottom: "1.5rem" }}>
        <h3 className="fw-bold mb-0">Reparaciones camioneta: {patente}{marca ? ` — ${marca}` : ""}</h3>
      </div>

      {/* Botón agregar + historial */}
      <div className="position-relative w-75 mx-auto mb-2 d-flex align-items-center" style={{ minHeight: "40px" }}>
        <Button onClick={abrirNuevo} style={{ backgroundColor: "#6c757d", border: "none", color: "#fff" }}>
          <i className="bi bi-plus-lg me-2"></i>Agregar Reparación
        </Button>
        <Button
          onClick={() => navigate(`/camionetas/services/reparaciones/${camionetaId}/historial`, { state: { patente, marca } })}
          className="position-absolute top-50 start-50 translate-middle"
          style={{ backgroundColor: "#4a6fa5", border: "none", color: "#fff" }}
        >
          <i className="bi bi-clock-history me-2"></i>Historial
        </Button>
      </div>

      {/* Tabla principal */}
      <Table bordered size="sm" className="text-center align-middle w-75 mx-auto">
        <thead className="table-dark">
          <tr>
            <th className="fw-normal" style={{ width: "120px" }}>Fecha</th>
            <th className="fw-normal">Reparación requerida</th>
            <th className="fw-normal" style={{ width: "120px" }}>Estado</th>
            <th className="fw-normal" style={{ width: "100px" }}>Urgencia</th>
            <th className="fw-normal" style={{ width: "120px" }}>Acciones</th>
          </tr>
        </thead>
        <tbody>
          {pendientes.length === 0 && <tr><td colSpan={5} className="text-muted py-3">Sin tareas pendientes</td></tr>}
          {pendientes.map((t) => (
            <tr key={t._id}>
              <td>{formatF(t.fecha)}</td>
              <td className="text-start">{t.descripcion}</td>
              <td>
                <span
                  style={{ display: "inline-block", backgroundColor: ESTADO_COLORES[t.estado ?? "pendiente"], color: "#fff", borderRadius: "6px", padding: "4px 12px", fontSize: "0.78rem", fontWeight: "600", minWidth: "90px" }}
                >
                  {ESTADO_LABELS[t.estado ?? "pendiente"]}
                </span>
              </td>
              <td>
                <Button
                  size="sm"
                  onClick={() => toggleUrgencia(t)}
                  style={{ backgroundColor: URGENCIA_COLORES[t.urgencia ?? "baja"], border: "none", fontSize: "0.78rem", minWidth: "68px", textTransform: "capitalize" }}
                >
                  {t.urgencia ?? "baja"}
                </Button>
              </td>
              <td>
                <div className="d-flex justify-content-center gap-1">
                  <Button size="sm"
                    onClick={() => navigate(`/camionetas/services/reparaciones/${camionetaId}/tarea/${t._id}`, {
                      state: { patente, marca, trabajo: t }
                    })}
                    style={{ backgroundColor: "#4a6fa5", border: "none" }}>
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
            <Form.Group className="mb-3">
              <Form.Label className="fw-semibold">Urgencia</Form.Label>
              <Form.Select className="w-50" {...register("urgencia")}>
                <option value="baja">Baja</option>
                <option value="media">Media</option>
                <option value="alta">Alta</option>
              </Form.Select>
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
                      <Form.Control
                        type="text"
                        inputMode="numeric"
                        value={r.costo ?? ""}
                        onChange={(e) => editarFila(idx, "costo", e.target.value.replace(/[^\d]/g, ""))}
                        onBlur={(e) => editarFila(idx, "costo", formatearPeso(e.target.value))}
                        onFocus={(e) => editarFila(idx, "costo", String(e.target.value).replace(/\./g, ""))}
                        style={{ textAlign: "center" }}
                      />
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
                      <Form.Control
                        type="text"
                        inputMode="numeric"
                        placeholder="0"
                        value={nuevaFila.costo}
                        onChange={(e) => setNuevaFila((p) => ({ ...p, costo: e.target.value.replace(/[^\d]/g, "") }))}
                        onBlur={(e) => setNuevaFila((p) => ({ ...p, costo: formatearPeso(e.target.value) }))}
                        onFocus={(e) => setNuevaFila((p) => ({ ...p, costo: String(e.target.value).replace(/\./g, "") }))}
                        style={{ textAlign: "center" }}
                        onKeyDown={(e) => e.key === "Enter" && agregarFila()}
                      />
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

    </Container>
  );
}

export default ReparacionesCamioneta;
