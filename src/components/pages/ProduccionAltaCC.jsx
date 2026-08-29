import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import Swal from "sweetalert2";
import { Container, Table, Button, Form, Modal, Row, Col, Card } from "react-bootstrap";
import { nuevoWorkbook } from "../../helpers/excel";
import { compararCC } from "../../utils/ordenCC";

const API = "/api/centros-costo";

// Equipos con los que se puede asociar un CC. Para sumar uno nuevo alcanza
// con agregarlo acá: alimenta el selector del alta y el filtro del listado.
const EQUIPOS = [
  "Tractor",
  "Turbo",
  "Chancho",
  "Nodriza",
  "Martignani",
  "Metalfor",
  "Jacto",
  "Tk. riego",
  "Herbicida",
  "Desmalezadora",
  "Abonadora",
  "Camioneta",
  "Camión",
  "Otros",
];

// Equipos cuyo padrón se maneja en su propia pantalla: acá el listado solo
// refleja lo que pasa allá, no se dan de alta, editan ni borran.
const EQUIPOS_GESTIONADOS = {
  Tractor: "Tractores",
  Camioneta: "Camionetas",
};

const esGestionado = (equipo) => Boolean(EQUIPOS_GESTIONADOS[(equipo || "").trim()]);

// El listado se agrupa por equipo siguiendo el orden de EQUIPOS, y dentro de
// cada equipo por número de CC. Los que no tienen equipo cargado van al final.
const ordenEquipo = (equipo) => {
  const i = EQUIPOS.indexOf((equipo || "").trim());
  return i === -1 ? EQUIPOS.length : i;
};

const ordenarCentros = (lista) =>
  [...lista].sort((a, b) => {
    const dif = ordenEquipo(a.equipo) - ordenEquipo(b.equipo);
    return dif !== 0 ? dif : compararCC(a.cc, b.cc);
  });

const avisarGestionado = (equipo) => {
  const nombre = (equipo || "").trim();
  const pantalla = EQUIPOS_GESTIONADOS[nombre];
  return Swal.fire({
    icon: "info",
    title: `Se administra desde ${pantalla}`,
    text: `Los CC de tipo ${nombre} se dan de alta en la pantalla de ${pantalla}. Desde acá solo se ven.`,
    confirmButtonColor: "#1b4332",
  });
};

function ProduccionAltaCC() {
  const [centros, setCentros] = useState([]);
  const [busqueda, setBusqueda] = useState("");
  const [filtroEquipo, setFiltroEquipo] = useState("Todos");

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
      setCentros(Array.isArray(data) ? data : []);
    } catch {
      setCentros([]);
    }
  };

  useEffect(() => {
    cargar();
  }, []);

  const abrirNuevo = () => {
    setEditando(null);
    reset({
      cc: "",
      equipo: "",
      descripcion: "",
    });
    setShowModal(true);
  };

  const abrirEditar = (c) => {
    if (esGestionado(c.equipo)) {
      avisarGestionado(c.equipo);
      return;
    }
    setEditando(c._id);
    setValue("cc", c.cc);
    setValue("equipo", c.equipo || "");
    setValue("descripcion", c.descripcion || "");
    setShowModal(true);
  };

  const cerrarModal = () => {
    setShowModal(false);
    setEditando(null);
    reset();
  };

  const onSubmit = async (data) => {
    // El alta de estos equipos manda desde su propia pantalla.
    if (esGestionado(data.equipo)) {
      avisarGestionado(data.equipo);
      return;
    }
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
          title: editando ? "CC actualizado" : "CC registrado",
          timer: 1500,
          showConfirmButton: false,
        });
      } else {
        const err = await res.json();
        Swal.fire({ icon: "error", title: "Error", text: err.error || "No se pudo guardar el CC" });
      }
    } catch {
      Swal.fire({ icon: "error", title: "Sin conexión", text: "No se pudo conectar con el servidor" });
    }
  };

  const eliminar = async (c) => {
    if (esGestionado(c.equipo)) {
      avisarGestionado(c.equipo);
      return;
    }
    const result = await Swal.fire({
      title: "¿Eliminar CC?",
      text: "Esta acción quitará el centro de costos del listado",
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#dc2626",
      cancelButtonColor: "#64748b",
      confirmButtonText: "Sí, eliminar",
      cancelButtonText: "Cancelar",
    });
    if (result.isConfirmed) {
      await fetch(`${API}/${c._id}`, { method: "DELETE" });
      cargar();
      Swal.fire({ icon: "success", title: "CC eliminado", timer: 1200, showConfirmButton: false });
    }
  };

  const centrosFiltrados = ordenarCentros(centros).filter((c) => {
    const q = busqueda.toLowerCase().trim();
    const matchBusqueda =
      !q ||
      (c.cc || "").toLowerCase().includes(q) ||
      (c.equipo || "").toLowerCase().includes(q) ||
      (c.descripcion || "").toLowerCase().includes(q);

    const matchEquipo =
      filtroEquipo === "Todos" || (c.equipo || "").trim() === filtroEquipo;
    return matchBusqueda && matchEquipo;
  });

  const exportarExcel = async () => {
    const titulo = "Alta de CC — Producción";
    const columnas = ["#", "CC", "Equipo", "Descripción"];
    const fechaHoy = new Date().toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric" });

    const wb = await nuevoWorkbook();
    const ws = wb.addWorksheet("CC");

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

    centrosFiltrados.forEach((c, idx) => {
      const fila = ws.addRow([
        idx + 1,
        c.cc,
        c.equipo || "—",
        c.descripcion || "—",
      ]);
      fila.eachCell((cell) => {
        cell.alignment = { horizontal: "center", vertical: "middle" };
        cell.border = {
          top: { style: "thin", color: { argb: "FFE2E8F0" } },
          bottom: { style: "thin", color: { argb: "FFE2E8F0" } },
          left: { style: "thin", color: { argb: "FFE2E8F0" } },
          right: { style: "thin", color: { argb: "FFE2E8F0" } },
        };
      });
      fila.getCell(4).alignment = { horizontal: "left", vertical: "middle" };
    });

    ws.columns = [{ width: 6 }, { width: 18 }, { width: 24 }, { width: 46 }];

    const buffer = await wb.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `cc_alta_${new Date().toISOString().slice(0, 10)}.xlsx`;
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
              <i className="bi bi-diagram-3-fill"></i>
            </div>
            <div className="d-flex flex-column lh-sm">
              <span className="fw-bold" style={{ color: "#1b4332", fontSize: "1rem" }}>
                Alta de CC
              </span>
              <span className="text-muted" style={{ fontSize: "0.78rem" }}>
                {centros.length} centros de costos
              </span>
            </div>
          </div>

          <div className="d-flex align-items-center gap-3">
            <Button
              variant="success"
              size="sm"
              onClick={exportarExcel}
              disabled={centrosFiltrados.length === 0}
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
              <span>Nuevo CC</span>
            </Button>
          </div>
        </div>

        {/* Barra de Filtros */}
        <Card
          className="shadow-sm border-0 rounded-3 px-3 py-2 bg-white flex-shrink-0"
          style={{ marginBottom: "16px" }}
        >
          <div className="d-flex align-items-center justify-content-between w-100 flex-wrap gap-2.5">
            {/* Buscador de Texto */}
            <div style={{ width: "300px" }}>
              <div className="input-group input-group-sm">
                <span
                  className="input-group-text bg-light border-end-0 text-muted"
                  style={{ padding: "3px 9px", height: "32px" }}
                >
                  <i className="bi bi-search" style={{ fontSize: "0.8rem" }}></i>
                </span>
                <Form.Control
                  type="text"
                  placeholder="Buscar CC, descripción..."
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

            {/* Filtro por Equipo */}
            <div className="d-flex align-items-center">
              <span
                className="fw-bold text-dark small flex-shrink-0 me-2"
                style={{ fontSize: "0.8rem", letterSpacing: "0.1px" }}
              >
                Equipo:
              </span>
              <div className="input-group input-group-sm" style={{ width: "185px" }}>
                <Form.Select
                  size="sm"
                  value={filtroEquipo}
                  onChange={(e) => setFiltroEquipo(e.target.value)}
                  className={`rounded-3 ${filtroEquipo !== "Todos" ? "rounded-end-0 border-end-0 fw-bold filtro-activo" : ""}`}
                  style={{
                    fontSize: "0.82rem",
                    height: "32px",
                    padding: "3px 24px 3px 8px",
                    color: filtroEquipo !== "Todos" ? "#dc2626" : "#1e293b",
                    fontWeight: filtroEquipo !== "Todos" ? "700" : "normal",
                  }}
                >
                  <option value="Todos">Todos</option>
                  {EQUIPOS.map((eq) => (
                    <option key={eq} value={eq}>
                      {eq}
                    </option>
                  ))}
                </Form.Select>
                {filtroEquipo !== "Todos" && (
                  <button
                    className="btn btn-outline-secondary border-start-0 d-flex align-items-center justify-content-center"
                    type="button"
                    onClick={() => setFiltroEquipo("Todos")}
                    title="Limpiar filtro equipo"
                    style={{ padding: "0 6px", height: "32px" }}
                  >
                    <i className="bi bi-x" style={{ fontSize: "0.9rem" }}></i>
                  </button>
                )}
              </div>
            </div>

          </div>
        </Card>

        {/* Tabla de CC */}
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
                <th style={{ width: "90px", backgroundColor: "#1b4332", color: "#fff", padding: "8px 8px", fontWeight: "normal" }}>
                  CC
                </th>
                <th style={{ width: "150px", backgroundColor: "#1b4332", color: "#fff", padding: "8px 8px", fontWeight: "normal" }}>
                  Equipo
                </th>
                <th style={{ backgroundColor: "#1b4332", color: "#fff", padding: "8px 12px", textAlign: "left", fontWeight: "normal" }}>
                  Descripción
                </th>
                <th style={{ width: "95px", backgroundColor: "#1b4332", color: "#fff", padding: "8px 8px", fontWeight: "normal" }}>
                  Acciones
                </th>
              </tr>
            </thead>
            <tbody>
              {centrosFiltrados.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-muted py-4" style={{ fontSize: "0.85rem" }}>
                    {busqueda || filtroEquipo !== "Todos"
                      ? "No se encontraron CC con los filtros seleccionados"
                      : "No hay CC registrados"}
                  </td>
                </tr>
              ) : (
                centrosFiltrados.map((c, idx) => {
                  const isEven = idx % 2 === 0;
                  const gestionado = esGestionado(c.equipo);
                  return (
                    <tr
                      key={c._id}
                      style={{
                        backgroundColor: isEven ? "#ffffff" : "#f8fafc",
                        borderBottom: "1px solid #e2e8f0",
                        height: "44px",
                      }}
                    >
                      <td className="text-muted" style={{ fontSize: "0.76rem" }}>
                        {idx + 1}
                      </td>
                      <td>
                        <span
                          className="badge px-2.5 py-1 text-white shadow-sm"
                          style={{
                            backgroundColor: "#0f172a",
                            border: "1px solid #475569",
                            fontSize: "0.82rem",
                            letterSpacing: "0.5px",
                            borderRadius: "6px",
                            fontWeight: 700,
                          }}
                        >
                          {c.cc}
                        </span>
                      </td>
                      <td>
                        {c.equipo ? (
                          <span
                            className="badge px-2.5 py-1 shadow-sm"
                            style={{
                              backgroundColor: "#e8f5ee",
                              color: "#1b4332",
                              border: "1px solid #a7d8bf",
                              fontSize: "0.78rem",
                              borderRadius: "6px",
                              fontWeight: 600,
                            }}
                          >
                            {c.equipo}
                          </span>
                        ) : (
                          <span className="text-secondary">—</span>
                        )}
                      </td>
                      <td className="text-start ps-3 fw-semibold text-dark" style={{ wordBreak: "break-word" }}>
                        {c.descripcion || "—"}
                      </td>
                      <td>
                        <div className="d-flex justify-content-center align-items-center" style={{ gap: "10px" }}>
                          {gestionado ? (
                            <button
                              onClick={() => avisarGestionado(c.equipo)}
                              className="btn btn-sm btn-outline-secondary d-flex align-items-center justify-content-center rounded-2 p-1"
                              style={{ width: "28px", height: "28px" }}
                              title={`Se administra desde ${EQUIPOS_GESTIONADOS[c.equipo]}`}
                            >
                              <i className="bi bi-lock-fill" style={{ fontSize: "0.8rem" }}></i>
                            </button>
                          ) : (
                            <>
                              <button
                                onClick={() => abrirEditar(c)}
                                className="btn btn-sm btn-outline-primary d-flex align-items-center justify-content-center rounded-2 p-1"
                                style={{ width: "28px", height: "28px" }}
                                title="Editar CC"
                              >
                                <i className="bi bi-pencil" style={{ fontSize: "0.8rem" }}></i>
                              </button>
                              <button
                                onClick={() => eliminar(c)}
                                className="btn btn-sm btn-outline-danger d-flex align-items-center justify-content-center rounded-2 p-1"
                                style={{ width: "28px", height: "28px" }}
                                title="Eliminar CC"
                              >
                                <i className="bi bi-trash" style={{ fontSize: "0.8rem" }}></i>
                              </button>
                            </>
                          )}
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

      {/* Modal Nuevo / Editar CC */}
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
            <i className="bi bi-diagram-3-fill" style={{ color: "#10b981" }}></i>
            <span>{editando ? "Editar CC" : "Nuevo CC"}</span>
          </Modal.Title>
        </Modal.Header>
        <Form onSubmit={handleSubmit(onSubmit)}>
          <Modal.Body className="p-4" style={{ overflow: "visible" }}>
            <Row className="g-3">
              <Col md={5}>
                <Form.Label className="fw-semibold text-dark small mb-1">
                  CC <span className="text-danger">*</span>
                </Form.Label>
                <Form.Control
                  className="rounded-3"
                  style={{ fontSize: "0.85rem" }}
                  {...register("cc", {
                    required: "El CC es requerido",
                    maxLength: { value: 50, message: "Máximo 50 caracteres" },
                  })}
                  isInvalid={!!errors.cc}
                />
                <Form.Control.Feedback type="invalid" style={{ fontSize: "0.78rem" }}>
                  {errors.cc?.message}
                </Form.Control.Feedback>
              </Col>

              <Col md={7}>
                <Form.Label className="fw-semibold text-dark small mb-1">Equipo</Form.Label>
                <Form.Select
                  className="rounded-3"
                  style={{ fontSize: "0.85rem", height: "38px" }}
                  {...register("equipo")}
                >
                  <option value="">— Seleccionar —</option>
                  {EQUIPOS.map((eq) => (
                    <option key={eq} value={eq}>
                      {eq}
                    </option>
                  ))}
                </Form.Select>
              </Col>

              <Col md={12}>
                <Form.Label className="fw-semibold text-dark small mb-1">Descripción</Form.Label>
                <Form.Control
                  className="rounded-3"
                  style={{ fontSize: "0.85rem" }}
                  {...register("descripcion", {
                    maxLength: { value: 120, message: "Máximo 120 caracteres" },
                  })}
                  isInvalid={!!errors.descripcion}
                />
                <Form.Control.Feedback type="invalid" style={{ fontSize: "0.78rem" }}>
                  {errors.descripcion?.message}
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

export default ProduccionAltaCC;
