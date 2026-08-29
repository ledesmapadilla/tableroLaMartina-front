import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import Swal from "sweetalert2";
import { Container, Table, Button, Form, Modal, Row, Col, Card } from "react-bootstrap";
import { nuevoWorkbook } from "../../helpers/excel";

const API = "/api/tareas";

// Unidades en las que se mide una tarea. Para sumar una nueva alcanza con
// agregarla acá: alimenta el selector del alta y el filtro del listado.
const UNIDADES = ["Horas", "Plantas", "Tancadas"];

function ProduccionAltaTareas() {
  const [tareas, setTareas] = useState([]);
  const [busqueda, setBusqueda] = useState("");
  const [filtroUnidad, setFiltroUnidad] = useState("Todas");
  const [filtroEmpresa, setFiltroEmpresa] = useState("Todas");

  const [showModal, setShowModal] = useState(false);
  const [editando, setEditando] = useState(null);

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    formState: { errors },
  } = useForm();

  const cargar = async () => {
    try {
      const res = await fetch(API);
      const data = res.ok ? await res.json() : [];
      setTareas(Array.isArray(data) ? data : []);
    } catch {
      setTareas([]);
    }
  };

  useEffect(() => {
    cargar();
  }, []);

  const abrirNuevo = () => {
    setEditando(null);
    reset({ tarea: "", unidad: "", empresa: "" });
    setShowModal(true);
  };

  const abrirEditar = (t) => {
    setEditando(t._id);
    setValue("tarea", t.tarea);
    setValue("unidad", t.unidad || "");
    setValue("empresa", t.empresa || "");
    setShowModal(true);
  };

  const cerrarModal = () => {
    setShowModal(false);
    setEditando(null);
    reset();
  };

  const onSubmit = async (data) => {
    try {
      const url = editando ? `${API}/${editando}` : API;
      const method = editando ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (res.ok) {
        cerrarModal();
        cargar();
        Swal.fire({
          icon: "success",
          title: editando ? "Tarea actualizada" : "Tarea registrada",
          timer: 1500,
          showConfirmButton: false,
        });
      } else {
        const err = await res.json();
        Swal.fire({ icon: "error", title: "Error", text: err.error || "No se pudo guardar" });
      }
    } catch {
      Swal.fire({ icon: "error", title: "Sin conexión", text: "No se pudo conectar con el servidor" });
    }
  };

  const eliminar = async (t) => {
    const result = await Swal.fire({
      title: "¿Eliminar tarea?",
      text: `Se quitará ${t.tarea} del listado`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#dc2626",
      cancelButtonColor: "#64748b",
      confirmButtonText: "Sí, eliminar",
      cancelButtonText: "Cancelar",
    });
    if (result.isConfirmed) {
      await fetch(`${API}/${t._id}`, { method: "DELETE" });
      cargar();
      Swal.fire({ icon: "success", title: "Tarea eliminada", timer: 1200, showConfirmButton: false });
    }
  };

  // Las empresas del filtro salen de lo ya cargado: no hay un padrón fijo.
  const empresasExistentes = [
    ...new Set(tareas.map((t) => (t.empresa || "").trim()).filter(Boolean)),
  ].sort((a, b) => a.localeCompare(b, "es", { sensitivity: "base" }));

  const tareasFiltradas = tareas
    .filter((t) => {
      const q = busqueda.toLowerCase().trim();
      const matchBusqueda =
        !q ||
        (t.tarea || "").toLowerCase().includes(q) ||
        (t.unidad || "").toLowerCase().includes(q) ||
        (t.empresa || "").toLowerCase().includes(q);

      const matchUnidad =
        filtroUnidad === "Todas" || (t.unidad || "").trim() === filtroUnidad;
      const matchEmpresa =
        filtroEmpresa === "Todas" || (t.empresa || "").trim() === filtroEmpresa;

      return matchBusqueda && matchUnidad && matchEmpresa;
    })
    .sort((a, b) => (a.tarea || "").localeCompare(b.tarea || "", "es", { sensitivity: "base" }));

  const exportarExcel = async () => {
    const titulo = "Alta de Tareas — Producción";
    const columnas = ["#", "Tarea", "Unidad", "Empresa"];
    const fechaHoy = new Date().toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric" });

    const wb = await nuevoWorkbook();
    const ws = wb.addWorksheet("Tareas");

    // Título institucional
    ws.mergeCells(1, 1, 1, columnas.length);
    const celdaTitulo = ws.getCell("A1");
    celdaTitulo.value = titulo;
    celdaTitulo.font = { bold: true, size: 14, color: { argb: "FF1B4332" } };
    celdaTitulo.alignment = { horizontal: "center", vertical: "middle" };
    ws.getRow(1).height = 24;

    // Fecha
    ws.mergeCells(2, 1, 2, columnas.length);
    const celdaFecha = ws.getCell("A2");
    celdaFecha.value = `Fecha de emisión: ${fechaHoy}`;
    celdaFecha.font = { italic: true, size: 10, color: { argb: "FF64748B" } };
    celdaFecha.alignment = { horizontal: "center", vertical: "middle" };
    ws.getRow(2).height = 18;

    ws.addRow([]);

    // Encabezado de columnas
    const filaEncabezado = ws.addRow(columnas);
    filaEncabezado.eachCell((cell) => {
      cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
      cell.alignment = { horizontal: "center", vertical: "middle" };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1B4332" } };
    });
    ws.getRow(4).height = 20;

    tareasFiltradas.forEach((t, idx) => {
      const fila = ws.addRow([idx + 1, t.tarea, t.unidad || "—", t.empresa || "—"]);
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

    ws.columns = [{ width: 6 }, { width: 44 }, { width: 14 }, { width: 24 }];

    const buffer = await wb.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `tareas_alta_${new Date().toISOString().slice(0, 10)}.xlsx`;
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
        style={{ maxWidth: "880px", width: "100%", margin: "0 auto", overflow: "hidden" }}
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
              <i className="bi bi-list-check"></i>
            </div>
            <div className="d-flex flex-column lh-sm">
              <span className="fw-bold" style={{ color: "#1b4332", fontSize: "1rem" }}>
                Alta de Tareas
              </span>
              <span className="text-muted" style={{ fontSize: "0.78rem" }}>
                {tareas.length} tareas
              </span>
            </div>
          </div>

          <div className="d-flex align-items-center gap-3">
            <Button
              variant="success"
              size="sm"
              onClick={exportarExcel}
              disabled={tareasFiltradas.length === 0}
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
              className="d-inline-flex align-items-center rounded-3 px-3.5 py-1.5 shadow-sm"
              style={{
                backgroundColor: "#1b4332",
                borderColor: "#1b4332",
                fontSize: "0.82rem",
                fontWeight: 600,
              }}
            >
              <span>Nueva Tarea</span>
            </Button>
          </div>
        </div>

        {/* Buscador y filtro */}
        <Card
          className="shadow-sm border-0 rounded-3 px-3 py-2 bg-white flex-shrink-0"
          style={{ marginBottom: "16px" }}
        >
          <div className="d-flex align-items-center justify-content-between w-100 flex-wrap gap-2.5">
            <div style={{ width: "260px" }}>
              <div className="input-group input-group-sm">
                <span
                  className="input-group-text bg-light border-end-0 text-muted"
                  style={{ padding: "3px 9px", height: "32px" }}
                >
                  <i className="bi bi-search" style={{ fontSize: "0.8rem" }}></i>
                </span>
                <Form.Control
                  type="text"
                  placeholder="Buscar tarea, unidad o empresa..."
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

            {/* Filtro por Unidad */}
            <div className="d-flex align-items-center">
              <span
                className="fw-bold text-dark small flex-shrink-0 me-2"
                style={{ fontSize: "0.8rem", letterSpacing: "0.1px" }}
              >
                Unidad:
              </span>
              <div className="input-group input-group-sm" style={{ width: "150px" }}>
                <Form.Select
                  size="sm"
                  value={filtroUnidad}
                  onChange={(e) => setFiltroUnidad(e.target.value)}
                  className={`rounded-3 ${filtroUnidad !== "Todas" ? "rounded-end-0 border-end-0 fw-bold filtro-activo" : ""}`}
                  style={{
                    fontSize: "0.82rem",
                    height: "32px",
                    padding: "3px 24px 3px 8px",
                    color: filtroUnidad !== "Todas" ? "#dc2626" : "#1e293b",
                    fontWeight: filtroUnidad !== "Todas" ? "700" : "normal",
                  }}
                >
                  <option value="Todas">Todas</option>
                  {UNIDADES.map((u) => (
                    <option key={u} value={u}>
                      {u}
                    </option>
                  ))}
                </Form.Select>
                {filtroUnidad !== "Todas" && (
                  <button
                    className="btn btn-outline-secondary border-start-0 d-flex align-items-center justify-content-center"
                    type="button"
                    onClick={() => setFiltroUnidad("Todas")}
                    title="Limpiar filtro unidad"
                    style={{ padding: "0 6px", height: "32px" }}
                  >
                    <i className="bi bi-x" style={{ fontSize: "0.9rem" }}></i>
                  </button>
                )}
              </div>
            </div>

            {/* Filtro por Empresa */}
            <div className="d-flex align-items-center">
              <span
                className="fw-bold text-dark small flex-shrink-0 me-2"
                style={{ fontSize: "0.8rem", letterSpacing: "0.1px" }}
              >
                Empresa:
              </span>
              <div className="input-group input-group-sm" style={{ width: "200px" }}>
                <Form.Select
                  size="sm"
                  value={filtroEmpresa}
                  onChange={(e) => setFiltroEmpresa(e.target.value)}
                  className={`rounded-3 ${filtroEmpresa !== "Todas" ? "rounded-end-0 border-end-0 fw-bold filtro-activo" : ""}`}
                  style={{
                    fontSize: "0.82rem",
                    height: "32px",
                    padding: "3px 24px 3px 8px",
                    color: filtroEmpresa !== "Todas" ? "#dc2626" : "#1e293b",
                    fontWeight: filtroEmpresa !== "Todas" ? "700" : "normal",
                  }}
                >
                  <option value="Todas">Todas</option>
                  {empresasExistentes.map((e) => (
                    <option key={e} value={e}>
                      {e}
                    </option>
                  ))}
                </Form.Select>
                {filtroEmpresa !== "Todas" && (
                  <button
                    className="btn btn-outline-secondary border-start-0 d-flex align-items-center justify-content-center"
                    type="button"
                    onClick={() => setFiltroEmpresa("Todas")}
                    title="Limpiar filtro empresa"
                    style={{ padding: "0 6px", height: "32px" }}
                  >
                    <i className="bi bi-x" style={{ fontSize: "0.9rem" }}></i>
                  </button>
                )}
              </div>
            </div>
          </div>
        </Card>

        {/* Tabla de Tareas */}
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
                  Tarea
                </th>
                <th style={{ width: "110px", backgroundColor: "#1b4332", color: "#fff", padding: "8px 8px", fontWeight: "normal" }}>
                  Unidad
                </th>
                <th style={{ width: "180px", backgroundColor: "#1b4332", color: "#fff", padding: "8px 8px", fontWeight: "normal" }}>
                  Empresa
                </th>
                <th style={{ width: "95px", backgroundColor: "#1b4332", color: "#fff", padding: "8px 8px", fontWeight: "normal" }}>
                  Acciones
                </th>
              </tr>
            </thead>
            <tbody>
              {tareasFiltradas.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-muted py-4" style={{ fontSize: "0.85rem" }}>
                    {busqueda || filtroUnidad !== "Todas" || filtroEmpresa !== "Todas"
                      ? "No se encontraron tareas con los filtros seleccionados"
                      : "No hay tareas registradas"}
                  </td>
                </tr>
              ) : (
                tareasFiltradas.map((t, idx) => {
                  const isEven = idx % 2 === 0;
                  return (
                    <tr
                      key={t._id}
                      style={{
                        backgroundColor: isEven ? "#ffffff" : "#f8fafc",
                        borderBottom: "1px solid #e2e8f0",
                        height: "32px",
                      }}
                    >
                      <td className="text-muted" style={{ fontSize: "0.76rem" }}>
                        {idx + 1}
                      </td>
                      <td className="text-start ps-3 fw-semibold text-dark" style={{ wordBreak: "break-word" }}>
                        {t.tarea}
                      </td>
                      <td className="text-secondary fw-medium">{t.unidad || "—"}</td>
                      <td className="text-secondary fw-medium">{t.empresa || "—"}</td>
                      <td>
                        <div className="d-flex justify-content-center align-items-center" style={{ gap: "10px" }}>
                          <button
                            onClick={() => abrirEditar(t)}
                            className="btn btn-sm btn-outline-primary d-flex align-items-center justify-content-center rounded-2 p-0"
                            style={{ width: "24px", height: "24px" }}
                            title="Editar"
                          >
                            <i className="bi bi-pencil" style={{ fontSize: "0.8rem" }}></i>
                          </button>
                          <button
                            onClick={() => eliminar(t)}
                            className="btn btn-sm btn-outline-danger d-flex align-items-center justify-content-center rounded-2 p-0"
                            style={{ width: "24px", height: "24px" }}
                            title="Eliminar"
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

      {/* Modal Nueva / Editar Tarea */}
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
            <i className="bi bi-list-check" style={{ color: "#10b981" }}></i>
            <span>{editando ? "Editar Tarea" : "Nueva Tarea"}</span>
          </Modal.Title>
        </Modal.Header>
        <Form onSubmit={handleSubmit(onSubmit)}>
          <Modal.Body className="p-4" style={{ overflow: "visible" }}>
            <Row className="g-3">
              <Col md={12}>
                <Form.Label className="fw-semibold text-dark small mb-1">
                  Tarea <span className="text-danger">*</span>
                </Form.Label>
                <Form.Control
                  className="rounded-3"
                  style={{ fontSize: "0.85rem" }}
                  {...register("tarea", {
                    required: "La tarea es requerida",
                    maxLength: { value: 120, message: "Máximo 120 caracteres" },
                  })}
                  isInvalid={!!errors.tarea}
                />
                <Form.Control.Feedback type="invalid" style={{ fontSize: "0.78rem" }}>
                  {errors.tarea?.message}
                </Form.Control.Feedback>
              </Col>

              <Col md={5}>
                <Form.Label className="fw-semibold text-dark small mb-1">
                  Unidad <span className="text-danger">*</span>
                </Form.Label>
                <Form.Select
                  className="rounded-3"
                  style={{ fontSize: "0.85rem", height: "38px" }}
                  {...register("unidad", { required: "La unidad es requerida" })}
                  isInvalid={!!errors.unidad}
                >
                  <option value="">— Seleccionar —</option>
                  {UNIDADES.map((u) => (
                    <option key={u} value={u}>
                      {u}
                    </option>
                  ))}
                </Form.Select>
                <Form.Control.Feedback type="invalid" style={{ fontSize: "0.78rem" }}>
                  {errors.unidad?.message}
                </Form.Control.Feedback>
              </Col>

              <Col md={7}>
                <Form.Label className="fw-semibold text-dark small mb-1">Empresa</Form.Label>
                <Form.Control
                  className="rounded-3"
                  style={{ fontSize: "0.85rem" }}
                  list="empresas-cargadas"
                  {...register("empresa", {
                    maxLength: { value: 80, message: "Máximo 80 caracteres" },
                  })}
                  isInvalid={!!errors.empresa}
                />
                <datalist id="empresas-cargadas">
                  {empresasExistentes.map((e) => (
                    <option key={e} value={e} />
                  ))}
                </datalist>
                <Form.Control.Feedback type="invalid" style={{ fontSize: "0.78rem" }}>
                  {errors.empresa?.message}
                </Form.Control.Feedback>
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

export default ProduccionAltaTareas;
