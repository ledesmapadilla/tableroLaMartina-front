import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { useNavigate } from "react-router-dom";
import Swal from "sweetalert2";
import { Container, Table, Button, Form, Modal, Row, Col } from "react-bootstrap";
import ExcelJS from "exceljs";
import TractorIcon from "../shared/TractorIcon";

const API = "/api/tractores";

const GRUPPO_LABELS = {
  1: "Grupo 1",
  2: "Grupo 2",
  3: "Grupo 3",
  4: "Grupo 4",
  5: "Grupo 5",
  6: "Sin dueño",
};

const GRUPPO_COLORS = {
  1: "#4a6fa5",
  2: "#52735a",
  3: "#9e8850",
  4: "#6b5b7b",
  5: "#7a5038",
  6: "#777",
};

function TractoresAltas() {
  const navigate = useNavigate();
  const [tractores, setTractores] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [editando, setEditando] = useState(null);
  const { register, handleSubmit, reset, setValue, formState: { errors } } = useForm();

  const cargar = async () => {
    try {
      const res = await fetch(API);
      const data = await res.json();
      setTractores(Array.isArray(data) ? data : []);
    } catch {
      setTractores([]);
    }
  };

  useEffect(() => { cargar(); }, []);

  const abrirNuevo = () => {
    setEditando(null);
    reset({ gruppo: 6 });
    setShowModal(true);
  };

  const abrirEditar = (t) => {
    setEditando(t._id);
    setValue("cc", t.cc);
    setValue("descripcion", t.descripcion || "");
    setValue("supervisor", t.supervisor || "");
    setValue("gruppo", t.gruppo ?? 6);
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
        body: JSON.stringify({ ...data, gruppo: Number(data.gruppo) }),
      });
      if (res.ok) {
        cerrarModal();
        cargar();
        Swal.fire({
          icon: "success",
          title: editando ? "Tractor actualizado" : "Tractor registrado",
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

  const eliminar = async (id) => {
    const result = await Swal.fire({
      title: "¿Eliminar tractor?",
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#7a4040",
      confirmButtonText: "Sí, eliminar",
      cancelButtonText: "Cancelar",
    });
    if (result.isConfirmed) {
      await fetch(`${API}/${id}`, { method: "DELETE" });
      cargar();
    }
  };

  const supervisoresExistentes = [...new Set(
    tractores.map((t) => (t.supervisor || "").trim()).filter(Boolean)
  )].sort((a, b) => a.localeCompare(b));

  const exportarExcel = async () => {
    const titulo   = "Alta de Tractores";
    const columnas = ["#", "Grupo", "Supervisor", "CC", "Descripción"];
    const fechaHoy = new Date().toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric" });

    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("Tractores");

    ws.mergeCells(1, 1, 1, columnas.length);
    const celdaTitulo = ws.getCell("A1");
    celdaTitulo.value = titulo;
    celdaTitulo.font  = { bold: true, underline: true, size: 14 };
    celdaTitulo.alignment = { horizontal: "center", vertical: "middle" };
    ws.getRow(1).height = 22;

    ws.mergeCells(2, 1, 2, 3);
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
    ws.getRow(4).height = 16;

    tractores.forEach((t, idx) => {
      const gruppoNum = t.gruppo ?? 6;
      const gruppoLabel = GRUPPO_LABELS[gruppoNum] || "Sin dueño";
      const fila = ws.addRow([
        idx + 1,
        gruppoLabel,
        t.supervisor || "—",
        t.cc,
        t.descripcion || "—",
      ]);
      fila.eachCell((cell) => { cell.alignment = { horizontal: "center", vertical: "middle" }; });
      fila.getCell(5).alignment = { horizontal: "left", vertical: "middle" };
    });

    ws.columns = [
      { width: 6 },
      { width: 14 },
      { width: 24 },
      { width: 14 },
      { width: 40 },
    ];

    const buffer = await wb.xlsx.writeBuffer();
    const blob   = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    const url    = URL.createObjectURL(blob);
    const a      = document.createElement("a");
    a.href       = url;
    a.download   = `tractores_${new Date().toISOString().slice(0, 10)}.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Container className="py-4">

      {/* Encabezado */}
      <div className="d-flex justify-content-between align-items-center mb-4 w-75 mx-auto">
        <h3 className="fw-bold mb-0">Alta Tractores</h3>
        <div className="d-flex gap-2">
          <Button onClick={() => navigate(-1)} style={{ backgroundColor: "#fff", border: "1px solid #000", color: "#000" }}>
            <i className="bi bi-arrow-left me-2"></i>Volver
          </Button>
          <Button onClick={() => navigate("/")} style={{ backgroundColor: "#fff", border: "1px solid #000", color: "#000" }}>
            <i className="bi bi-house-fill me-2"></i>General
          </Button>
          <Button onClick={exportarExcel} disabled={tractores.length === 0} style={{ backgroundColor: "#1d6f42", border: "1px solid #1d6f42", color: "#fff" }}>
            <i className="bi bi-file-earmark-excel me-2"></i>Excel
          </Button>
          <Button onClick={abrirNuevo} style={{ backgroundColor: "#000", border: "1px solid #000", color: "#fff" }}>
            Nuevo Tractor
          </Button>
        </div>
      </div>

      {/* Tabla */}
      <div className="d-flex justify-content-center">
        <div style={{ width: "75%", maxHeight: "78vh", overflowY: "auto", border: "1px solid #dee2e6", borderRadius: "4px" }}>
        <Table striped bordered hover size="sm" className="text-center align-middle mb-0" style={{ whiteSpace: "nowrap", fontSize: "0.78rem" }}>
          <thead className="table-dark" style={{ position: "sticky", top: 0, zIndex: 1 }}>
            <tr className="fw-normal align-middle">
              <th className="fw-normal" style={{ width: "40px" }}>#</th>
              <th className="fw-normal">Grupo</th>
              <th className="fw-normal">Supervisor</th>
              <th className="fw-normal">CC</th>
              <th className="fw-normal" style={{ minWidth: "200px", whiteSpace: "normal" }}>Descripción</th>
              <th className="fw-normal">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {tractores.length === 0 ? (
              <tr>
                <td colSpan={6} className="text-muted py-4">
                  No hay tractores registrados
                </td>
              </tr>
            ) : (
              tractores.map((t, idx) => {
                const gruppoNum = t.gruppo ?? 6;
                const gruppoLabel = GRUPPO_LABELS[gruppoNum] || "Sin dueño";
                const gruppoColor = GRUPPO_COLORS[gruppoNum] || "#777";
                return (
                  <tr key={t._id}>
                    <td className="text-muted" style={{ fontSize: "0.8rem" }}>{idx + 1}</td>
                    <td>
                      <span style={{ display: "inline-block", backgroundColor: gruppoColor, color: "#fff", borderRadius: "4px", padding: "2px 10px" }}>
                        {gruppoLabel}
                      </span>
                    </td>
                    <td>{t.supervisor || "-"}</td>
                    <td>
                      <span style={{ display: "inline-block", backgroundColor: "#52735a", color: "#fff", borderRadius: "4px", padding: "2px 10px", boxShadow: "3px 3px 6px rgba(0,0,0,0.35)" }}>
                        {t.cc}
                      </span>
                    </td>
                    <td style={{ minWidth: "200px", whiteSpace: "normal", wordBreak: "break-word" }}>{t.descripcion || "-"}</td>
                    <td>
                      <div className="d-flex justify-content-center gap-2">
                        <Button size="sm" onClick={() => abrirEditar(t)} style={{ backgroundColor: "#52735a", border: "none" }}>
                          <i className="bi bi-pencil"></i>
                        </Button>
                        <Button size="sm" onClick={() => eliminar(t._id)} style={{ backgroundColor: "#7a4040", border: "none" }}>
                          <i className="bi bi-trash"></i>
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </Table>
        </div>
      </div>

      {/* Modal */}
      <Modal show={showModal} onHide={cerrarModal} centered contentClassName="border border-dark">
        <Modal.Header closeButton>
          <Modal.Title>
            <TractorIcon size="1.3rem" color="#52735a" style={{ marginRight: "0.5rem" }} />
            {editando ? "Editar Tractor" : "Nuevo Tractor"}
          </Modal.Title>
        </Modal.Header>
        <Form onSubmit={handleSubmit(onSubmit)}>
          <Modal.Body>
            <Row className="g-3">
              <Col md={4}>
                <Form.Label className="fw-semibold">CC <span className="text-danger">*</span></Form.Label>
                <Form.Control
                  placeholder="Ej: T-01"
                  {...register("cc", {
                    required: "El CC es requerido",
                    maxLength: { value: 50, message: "Máximo 50 caracteres" },
                  })}
                  isInvalid={!!errors.cc}
                />
                <Form.Control.Feedback type="invalid">{errors.cc?.message}</Form.Control.Feedback>
              </Col>
              <Col md={8}>
                <Form.Label className="fw-semibold">Descripción</Form.Label>
                <Form.Control
                  placeholder="Ej: Tractor John Deere 5075E"
                  {...register("descripcion", {
                    maxLength: { value: 100, message: "Máximo 100 caracteres" },
                  })}
                  isInvalid={!!errors.descripcion}
                />
                <Form.Control.Feedback type="invalid">{errors.descripcion?.message}</Form.Control.Feedback>
              </Col>
              <Col md={8}>
                <Form.Label className="fw-semibold">Supervisor</Form.Label>
                {editando ? (
                  <Form.Select {...register("supervisor")}>
                    <option value="">— Seleccionar —</option>
                    {supervisoresExistentes.map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </Form.Select>
                ) : (
                  <>
                    <Form.Control
                      list="supervisores-list"
                      placeholder="Seleccionar o escribir nombre"
                      {...register("supervisor")}
                    />
                    <datalist id="supervisores-list">
                      <option value="Jorge Rosas" />
                      <option value="Mario Bustos" />
                      <option value="Guillermo Bustos" />
                      <option value="Carlos Chumiento" />
                      <option value="brandan alejandro" />
                      <option value="Elio Rojas" />
                      <option value="BERDINA" />
                      <option value="SP" />
                      <option value="ALBERDI" />
                    </datalist>
                  </>
                )}
              </Col>
              <Col md={4}>
                <Form.Label className="fw-semibold">Grupo</Form.Label>
                <Form.Select {...register("gruppo")}>
                  <option value={1}>Grupo 1</option>
                  <option value={2}>Grupo 2</option>
                  <option value={3}>Grupo 3</option>
                  <option value={4}>Grupo 4</option>
                  <option value={5}>Grupo 5</option>
                  <option value={6}>Sin dueño</option>
                </Form.Select>
              </Col>
            </Row>
          </Modal.Body>
          <Modal.Footer>
            <Button onClick={cerrarModal} style={{ backgroundColor: "#555", border: "none" }}>Cancelar</Button>
            <Button type="submit" style={{ backgroundColor: "#52735a", border: "none" }}>
              <i className="bi bi-check-lg me-2"></i>Guardar
            </Button>
          </Modal.Footer>
        </Form>
      </Modal>

    </Container>
  );
}

export default TractoresAltas;
