import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import Swal from "sweetalert2";
import { Container, Table, Button, Form, Modal, Row, Col, Card } from "react-bootstrap";
import { nuevoWorkbook } from "../../helpers/excel";
import { usePermisos } from "../../context/permisos";

const API = "/api/clientes";

// El nombre va adentro del HTML del aviso: se escapa para que se muestre tal cual.
const escaparHtml = (t) =>
  String(t).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

/**
 * Padrón de clientes de Producción (04/10/2026).
 *
 * Los clientes de acá son los únicos que se pueden elegir en el parte y en
 * Remuneración: el cliente define con qué precio se paga cada tarea, y antes,
 * escrito a mano, un error de tipeo creaba otro cliente.
 *
 * Un cliente con partes o precios no se borra: se marca inactivo y deja de
 * ofrecerse en las cargas nuevas, pero lo cargado sigue valiendo. Renombrarlo
 * renombra también sus partes y sus precios (lo hace el backend).
 */
function ProduccionAltaClientes() {
  // Ver sin editar (tabla de Roles): nuevo, editar y borrar quedan a la vista
  // pero deshabilitados.
  const { puede } = usePermisos();
  const sinEditar = !puede("altas.clientes", "editar");
  const [clientes, setClientes] = useState([]);
  const [busqueda, setBusqueda] = useState("");

  const [showModal, setShowModal] = useState(false);
  const [editando, setEditando] = useState(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm();

  const cargar = () =>
    fetch(API)
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => setClientes(Array.isArray(data) ? data : []))
      .catch(() => setClientes([]));

  useEffect(() => {
    fetch(API)
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => setClientes(Array.isArray(data) ? data : []))
      .catch(() => setClientes([]));
  }, []);

  const abrirNuevo = () => {
    setEditando(null);
    reset({ nombre: "", activo: true });
    setShowModal(true);
  };

  const abrirEditar = (c) => {
    setEditando(c);
    reset({ nombre: c.nombre, activo: c.activo !== false });
    setShowModal(true);
  };

  const cerrarModal = () => {
    setShowModal(false);
    setEditando(null);
    reset();
  };

  const onSubmit = async (data) => {
    // Renombrar cambia el cliente de todos sus partes y precios: se avisa
    // antes, porque afecta datos ya cargados.
    if (editando && data.nombre.trim() !== editando.nombre) {
      const ok = await Swal.fire({
        title: "¿Renombrar el cliente?",
        html: `<div style="font-size:0.86rem"><b>${escaparHtml(editando.nombre)}</b> pasa a llamarse <b>${escaparHtml(data.nombre.trim())}</b>.<div style="color:#64748b;margin-top:.5rem;font-size:0.8rem">También se cambia en todos sus partes y precios.</div></div>`,
        icon: "question",
        showCancelButton: true,
        confirmButtonColor: "#1b4332",
        cancelButtonColor: "#64748b",
        confirmButtonText: "Sí, renombrar",
        cancelButtonText: "Cancelar",
      });
      if (!ok.isConfirmed) return;
    }

    try {
      const res = await fetch(editando ? `${API}/${editando._id}` : API, {
        method: editando ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (res.ok) {
        cerrarModal();
        cargar();
        Swal.fire({
          icon: "success",
          title: editando ? "Cliente actualizado" : "Cliente registrado",
          timer: 1500,
          showConfirmButton: false,
        });
      } else {
        const err = await res.json().catch(() => ({}));
        Swal.fire({ icon: "error", title: "Error", text: err.error || "No se pudo guardar" });
      }
    } catch {
      Swal.fire({ icon: "error", title: "Sin conexión", text: "No se pudo conectar con el servidor" });
    }
  };

  const eliminar = async (c) => {
    const result = await Swal.fire({
      title: "¿Eliminar cliente?",
      text: `Se quitará ${c.nombre} del padrón`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#dc2626",
      cancelButtonColor: "#64748b",
      confirmButtonText: "Sí, eliminar",
      cancelButtonText: "Cancelar",
    });
    if (!result.isConfirmed) return;
    try {
      const res = await fetch(`${API}/${c._id}`, { method: "DELETE" });
      if (!res.ok) {
        // Con partes o precios el backend no lo deja borrar y explica por qué.
        const err = await res.json().catch(() => ({}));
        Swal.fire({ icon: "warning", title: "No se puede eliminar", text: err.error || "No se pudo eliminar" });
        return;
      }
      cargar();
      Swal.fire({ icon: "success", title: "Cliente eliminado", timer: 1200, showConfirmButton: false });
    } catch {
      Swal.fire({ icon: "error", title: "Sin conexión", text: "No se pudo conectar con el servidor" });
    }
  };

  const clientesFiltrados = clientes.filter((c) => {
    const q = busqueda.toLowerCase().trim();
    return !q || (c.nombre || "").toLowerCase().includes(q);
  });
  const activos = clientes.filter((c) => c.activo !== false).length;

  const exportarExcel = async () => {
    const columnas = ["#", "Cliente", "Estado"];
    const fechaHoy = new Date().toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric" });

    const wb = await nuevoWorkbook();
    const ws = wb.addWorksheet("Clientes");

    ws.mergeCells(1, 1, 1, columnas.length);
    const celdaTitulo = ws.getCell("A1");
    celdaTitulo.value = "Alta de Clientes — Producción";
    celdaTitulo.font = { bold: true, size: 14, color: { argb: "FF1B4332" } };
    celdaTitulo.alignment = { horizontal: "center", vertical: "middle" };
    ws.getRow(1).height = 24;

    ws.mergeCells(2, 1, 2, columnas.length);
    const celdaFecha = ws.getCell("A2");
    celdaFecha.value = `Fecha de emisión: ${fechaHoy}`;
    celdaFecha.font = { italic: true, size: 10, color: { argb: "FF64748B" } };
    celdaFecha.alignment = { horizontal: "center", vertical: "middle" };
    ws.getRow(2).height = 18;

    ws.addRow([]);

    const filaEncabezado = ws.addRow(columnas);
    filaEncabezado.eachCell((cell) => {
      cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
      cell.alignment = { horizontal: "center", vertical: "middle" };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1B4332" } };
    });
    ws.getRow(4).height = 20;

    clientesFiltrados.forEach((c, idx) => {
      const fila = ws.addRow([idx + 1, c.nombre, c.activo !== false ? "Activo" : "Inactivo"]);
      fila.eachCell((cell) => {
        cell.alignment = { horizontal: "center", vertical: "middle" };
        cell.border = {
          top: { style: "thin", color: { argb: "FFE2E8F0" } },
          bottom: { style: "thin", color: { argb: "FFE2E8F0" } },
          left: { style: "thin", color: { argb: "FFE2E8F0" } },
          right: { style: "thin", color: { argb: "FFE2E8F0" } },
        };
      });
      fila.getCell(2).alignment = { horizontal: "left", vertical: "middle" };
    });

    ws.columns = [{ width: 6 }, { width: 36 }, { width: 14 }];

    const buffer = await wb.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `clientes_alta_${new Date().toISOString().slice(0, 10)}.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div
      style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        backgroundColor: "#f8f9fa",
        height: "100%",
        overflow: "hidden",
      }}
    >
      <Container
        fluid
        className="px-4 py-3 d-flex flex-column flex-grow-1"
        style={{ maxWidth: "640px", width: "100%", margin: "0 auto", overflow: "hidden" }}
      >
        {/* Encabezado de la pantalla + acciones */}
        <div className="d-flex align-items-center justify-content-between gap-3 mb-3 flex-wrap">
          <div className="d-flex align-items-center gap-2">
            <div
              className="rounded-3 d-flex align-items-center justify-content-center"
              style={{
                width: "34px",
                height: "34px",
                backgroundColor: "#10b981",
                color: "#fff",
                fontSize: "1.1rem",
                boxShadow: "0 2px 8px rgba(16, 185, 129, 0.3)",
              }}
            >
              <i className="bi bi-building"></i>
            </div>
            <div className="d-flex flex-column lh-sm">
              <span className="fw-bold" style={{ color: "#1b4332", fontSize: "1rem" }}>
                Alta de Clientes
              </span>
              <span className="text-muted" style={{ fontSize: "0.78rem" }}>
                {clientes.length} clientes · {activos} activos
              </span>
            </div>
          </div>

          <div className="d-flex align-items-center gap-3">
            <Button
              variant="success"
              size="sm"
              onClick={exportarExcel}
              disabled={clientesFiltrados.length === 0}
              className="d-inline-flex align-items-center gap-1.5 rounded-3 px-3 py-1.5 shadow-sm"
              style={{ fontSize: "0.82rem", backgroundColor: "#15803d", borderColor: "#15803d" }}
              title="Exportar a Excel"
            >
              <i className="bi bi-file-earmark-excel-fill"></i>
              <span>Excel</span>
            </Button>

            <Button
              variant="primary"
              size="sm"
              onClick={abrirNuevo}
              disabled={sinEditar}
              className="d-inline-flex align-items-center rounded-3 px-3.5 py-1.5 shadow-sm"
              style={{
                backgroundColor: "#1b4332",
                borderColor: "#1b4332",
                fontSize: "0.82rem",
                fontWeight: 600,
              }}
            >
              <span>Nuevo Cliente</span>
            </Button>
          </div>
        </div>

        {/* Buscador */}
        <Card
          className="shadow-sm border-0 rounded-3 px-3 py-2 bg-white flex-shrink-0"
          style={{ marginBottom: "16px" }}
        >
          <div style={{ width: "280px" }}>
            <div className="input-group input-group-sm">
              <span
                className="input-group-text bg-light border-end-0 text-muted"
                style={{ padding: "3px 9px", height: "32px" }}
              >
                <i className="bi bi-search" style={{ fontSize: "0.8rem" }}></i>
              </span>
              <Form.Control
                type="text"
                placeholder="Buscar cliente..."
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                className={`border-start-0 ${busqueda ? "fw-bold filtro-activo" : ""}`}
                style={{
                  fontSize: "0.82rem",
                  height: "32px",
                  padding: "3px 8px 3px 10px",
                  color: busqueda ? "#dc2626" : "#1e293b",
                  fontWeight: busqueda ? "700" : "normal",
                }}
              />
              {busqueda && (
                <button
                  className="btn btn-outline-secondary border-start-0 d-flex align-items-center justify-content-center"
                  type="button"
                  onClick={() => setBusqueda("")}
                  title="Limpiar búsqueda"
                  style={{ padding: "0 7px", height: "32px" }}
                >
                  <i className="bi bi-x" style={{ fontSize: "0.9rem" }}></i>
                </button>
              )}
            </div>
          </div>
        </Card>

        {/* Tabla de Clientes */}
        <div
          className="flex-grow-1 shadow-sm rounded-3 bg-white"
          style={{
            overflowY: "auto",
            overflowX: "auto",
            border: "1px solid #cbd5e1",
          }}
        >
          <Table
            hover
            size="sm"
            className="text-center align-middle mb-0"
            style={{ whiteSpace: "nowrap", fontSize: "0.8rem", width: "100%" }}
          >
            <thead style={{ position: "sticky", top: 0, zIndex: 10, backgroundColor: "#1b4332", color: "#fff" }}>
              <tr className="fw-normal align-middle">
                <th style={{ width: "45px", backgroundColor: "#1b4332", color: "#fff", padding: "8px 4px", fontWeight: "normal" }}>
                  #
                </th>
                <th style={{ backgroundColor: "#1b4332", color: "#fff", padding: "8px 12px", textAlign: "left", fontWeight: "normal" }}>
                  Cliente
                </th>
                <th style={{ width: "100px", backgroundColor: "#1b4332", color: "#fff", padding: "8px 8px", fontWeight: "normal" }}>
                  Estado
                </th>
                <th style={{ width: "95px", backgroundColor: "#1b4332", color: "#fff", padding: "8px 8px", fontWeight: "normal" }}>
                  Acciones
                </th>
              </tr>
            </thead>
            <tbody>
              {clientesFiltrados.length === 0 ? (
                <tr>
                  <td colSpan={4} className="text-muted py-4" style={{ fontSize: "0.85rem" }}>
                    {busqueda ? "No se encontró ningún cliente con esa búsqueda" : "No hay clientes registrados"}
                  </td>
                </tr>
              ) : (
                clientesFiltrados.map((c, idx) => {
                  const isEven = idx % 2 === 0;
                  const activo = c.activo !== false;
                  return (
                    <tr
                      key={c._id}
                      style={{
                        backgroundColor: isEven ? "#ffffff" : "#f8fafc",
                        borderBottom: "1px solid #e2e8f0",
                        height: "32px",
                      }}
                    >
                      <td className="text-muted" style={{ fontSize: "0.76rem" }}>
                        {idx + 1}
                      </td>
                      <td
                        className={`text-start ps-3 fw-semibold ${activo ? "text-dark" : "text-muted"}`}
                        style={{ wordBreak: "break-word" }}
                      >
                        {c.nombre}
                      </td>
                      <td>
                        <span
                          className="px-2 rounded-pill"
                          style={{
                            fontSize: "0.7rem",
                            fontWeight: 700,
                            backgroundColor: activo ? "#dcfce7" : "#f1f5f9",
                            color: activo ? "#15803d" : "#64748b",
                          }}
                          title={activo ? "Se ofrece en las cargas" : "No se ofrece en las cargas nuevas"}
                        >
                          {activo ? "Activo" : "Inactivo"}
                        </span>
                      </td>
                      <td>
                        <div className="d-flex justify-content-center align-items-center" style={{ gap: "10px" }}>
                          <button
                            onClick={() => abrirEditar(c)}
                            disabled={sinEditar}
                            className="btn btn-sm btn-outline-primary d-flex align-items-center justify-content-center rounded-2 p-0"
                            style={{ width: "24px", height: "24px" }}
                            title={sinEditar ? "Sin permiso para editar" : "Editar"}
                          >
                            <i className="bi bi-pencil" style={{ fontSize: "0.8rem" }}></i>
                          </button>
                          <button
                            onClick={() => eliminar(c)}
                            disabled={sinEditar}
                            className="btn btn-sm btn-outline-danger d-flex align-items-center justify-content-center rounded-2 p-0"
                            style={{ width: "24px", height: "24px" }}
                            title={sinEditar ? "Sin permiso para editar" : "Eliminar"}
                          >
                            <i className="bi bi-trash" style={{ fontSize: "0.8rem" }}></i>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </Table>
        </div>
      </Container>

      {/* Modal Nuevo / Editar Cliente */}
      <Modal show={showModal} onHide={cerrarModal} centered dialogClassName="modal-cc" contentClassName="border-0 shadow-lg rounded-4 overflow-visible">
        <Modal.Header
          closeButton
          closeVariant="white"
          style={{
            backgroundColor: "#1b4332",
            color: "#fff",
            borderTopLeftRadius: "1rem",
            borderTopRightRadius: "1rem",
            borderBottom: "1px solid rgba(255,255,255,0.1)",
          }}
        >
          <Modal.Title className="fs-6 fw-bold d-flex align-items-center gap-2 text-white">
            <i className="bi bi-building" style={{ color: "#10b981" }}></i>
            <span>{editando ? "Editar Cliente" : "Nuevo Cliente"}</span>
          </Modal.Title>
        </Modal.Header>
        <Form onSubmit={handleSubmit(onSubmit)}>
          <Modal.Body className="p-4" style={{ overflow: "visible" }}>
            <Row className="g-3">
              <Col md={12}>
                <Form.Label className="fw-semibold text-dark small mb-1">
                  Cliente <span className="text-danger">*</span>
                </Form.Label>
                <Form.Control
                  className="rounded-3"
                  style={{ fontSize: "0.85rem" }}
                  {...register("nombre", {
                    validate: (v) => Boolean((v || "").trim()) || "El nombre es requerido",
                    maxLength: { value: 60, message: "Máximo 60 caracteres" },
                  })}
                  isInvalid={!!errors.nombre}
                />
                <Form.Control.Feedback type="invalid" style={{ fontSize: "0.78rem" }}>
                  {errors.nombre?.message}
                </Form.Control.Feedback>
              </Col>

              {/* Inactivo: deja de ofrecerse en las cargas nuevas, pero lo ya
                  cargado sigue valiendo. */}
              <Col md={12}>
                <Form.Check
                  type="switch"
                  id="cliente-activo"
                  label="Activo (se ofrece en el parte y en Remuneración)"
                  className="small"
                  {...register("activo")}
                />
              </Col>
            </Row>
          </Modal.Body>
          <Modal.Footer className="bg-light border-0 py-2.5 px-4" style={{ borderBottomLeftRadius: "1rem", borderBottomRightRadius: "1rem" }}>
            <Button
              variant="outline-secondary"
              size="sm"
              onClick={cerrarModal}
              className="rounded-3 px-3 py-1.5"
              style={{ fontSize: "0.84rem" }}
            >
              Cancelar
            </Button>
            <Button
              variant="success"
              size="sm"
              type="submit"
              disabled={sinEditar}
              className="rounded-3 px-3.5 py-1.5 shadow-sm d-flex align-items-center gap-1.5"
              style={{ backgroundColor: "#15803d", borderColor: "#15803d", fontSize: "0.84rem", fontWeight: 600 }}
            >
              <i className="bi bi-check-lg"></i>
              <span>Guardar</span>
            </Button>
          </Modal.Footer>
        </Form>
      </Modal>
    </div>
  );
}

export default ProduccionAltaClientes;
