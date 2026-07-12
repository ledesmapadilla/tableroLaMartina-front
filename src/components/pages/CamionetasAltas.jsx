import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { useNavigate } from "react-router-dom";
import Swal from "sweetalert2";
import { Container, Table, Button, Form, Modal, Row, Col } from "react-bootstrap";

const API = "/api/camionetas";

function CamionetasAltas() {
  const navigate = useNavigate();
  const [camionetas, setCamionetas] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [editando, setEditando] = useState(null);
  const { register, handleSubmit, reset, setValue, formState: { errors } } = useForm();

  const cargar = async () => {
    try {
      const res = await fetch(API);
      const data = await res.json();
      setCamionetas(data);
    } catch {
      setCamionetas([]);
    }
  };

  useEffect(() => { cargar(); }, []);

  const abrirNuevo = () => {
    setEditando(null);
    reset();
    setShowModal(true);
  };

  const abrirEditar = (c) => {
    setEditando(c._id);
    setValue("marca", c.marca);
    setValue("patente", c.patente);
    setValue("responsable", c.responsable);
    setValue("telefono", c.telefono ?? "");
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
          title: editando ? "Equipo actualizado" : "Equipo registrado",
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
      title: "¿Eliminar equipo?",
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

  return (
    <Container className="py-4">

      {/* Encabezado */}
      <div className="d-flex justify-content-between align-items-center mb-4 w-75 mx-auto">
        <h3 className="fw-bold mb-0">Alta Flota</h3>
        <div className="d-flex gap-2">
          <Button onClick={() => navigate(-1)} style={{ backgroundColor: "#fff", border: "1px solid #000", color: "#000" }}>
            <i className="bi bi-arrow-left me-2"></i>Volver
          </Button>
          <Button onClick={() => navigate("/camionetas/resumen")} style={{ backgroundColor: "#fff", border: "1px solid #000", color: "#000" }}>
            <i className="bi bi-speedometer me-2"></i>Tablero
          </Button>
          <Button onClick={() => navigate("/")} style={{ backgroundColor: "#fff", border: "1px solid #000", color: "#000" }}>
            <i className="bi bi-house-fill me-2"></i>General
          </Button>
          <Button onClick={abrirNuevo} style={{ backgroundColor: "#000", border: "1px solid #000", color: "#fff" }}>
            Nueva Camioneta
          </Button>
        </div>
      </div>

      {/* Tabla */}
      <div className="d-flex justify-content-center">
        <Table striped bordered hover size="sm" className="text-center align-middle w-75" style={{ whiteSpace: "nowrap", fontSize: "0.78rem" }}>
          <thead className="table-dark">
            <tr className="fw-normal">
              <th className="fw-normal" style={{ width: "40px" }}>#</th>
              <th className="fw-normal">Marca</th>
              <th className="fw-normal">Patente</th>
              <th className="fw-normal">Responsable</th>
              <th className="fw-normal">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {camionetas.length === 0 ? (
              <tr>
                <td colSpan={5} className="text-muted py-4">
                  No hay equipos registrados
                </td>
              </tr>
            ) : (
              camionetas.map((c, idx) => (
                <tr key={c._id}>
                  <td className="text-muted" style={{ fontSize: "0.8rem" }}>{idx + 1}</td>
                  <td>{c.marca}</td>
                  <td>
                    <span style={{ display: "inline-block", backgroundColor: "#4a6fa5", color: "#fff", borderRadius: "4px", padding: "2px 10px", boxShadow: "3px 3px 6px rgba(0,0,0,0.35)" }}>
                      {c.patente}
                    </span>
                  </td>
                  <td>{c.responsable}</td>
                  <td>
                    <div className="d-flex justify-content-center gap-2">
                      <Button size="sm" onClick={() => abrirEditar(c)} style={{ backgroundColor: "#4a6fa5", border: "none" }}>
                        <i className="bi bi-pencil"></i>
                      </Button>
                      <Button size="sm" onClick={() => eliminar(c._id)} style={{ backgroundColor: "#7a4040", border: "none" }}>
                        <i className="bi bi-trash"></i>
                      </Button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </Table>
      </div>

      {/* Modal */}
      <Modal show={showModal} onHide={cerrarModal} centered contentClassName="border border-dark">
        <Modal.Header closeButton>
          <Modal.Title>
            <i className="bi bi-truck-front-fill me-2 text-primary"></i>
            {editando ? "Editar Camioneta" : "Nueva Camioneta"}
          </Modal.Title>
        </Modal.Header>
        <Form onSubmit={handleSubmit(onSubmit)}>
          <Modal.Body>
            <Row className="g-3">
              <Col md={6}>
                <Form.Label className="fw-semibold">Marca</Form.Label>
                <Form.Control
                  placeholder="Ej: Ford"
                  {...register("marca", {
                    required: "La marca es requerida",
                    minLength: { value: 2, message: "Mínimo 2 caracteres" },
                    maxLength: { value: 50, message: "Máximo 50 caracteres" },
                  })}
                  isInvalid={!!errors.marca}
                />
                <Form.Control.Feedback type="invalid">{errors.marca?.message}</Form.Control.Feedback>
              </Col>
              <Col md={6}>
                <Form.Label className="fw-semibold">Patente</Form.Label>
                <Form.Control
                  placeholder="Ej: AB123CD"
                  {...register("patente", {
                    required: "La patente es requerida",
                    pattern: {
                      value: /^[A-Za-z]{2,3}[0-9]{3}[A-Za-z]{0,2}$/,
                      message: "Formato inválido (Ej: ABC123 o AB123CD)",
                    },
                    validate: (val) => {
                      const dup = camionetas.find(
                        (c) => c.patente.toUpperCase() === val.toUpperCase() && c._id !== editando
                      );
                      return !dup || "La patente ya está registrada";
                    },
                  })}
                  isInvalid={!!errors.patente}
                />
                <Form.Control.Feedback type="invalid">{errors.patente?.message}</Form.Control.Feedback>
              </Col>
              <Col md={12}>
                <Form.Label className="fw-semibold">Responsable</Form.Label>
                <Form.Control
                  placeholder="Nombre del responsable"
                  {...register("responsable", {
                    required: "El responsable es requerido",
                    minLength: { value: 2, message: "Mínimo 2 caracteres" },
                    maxLength: { value: 100, message: "Máximo 100 caracteres" },
                  })}
                  isInvalid={!!errors.responsable}
                />
                <Form.Control.Feedback type="invalid">{errors.responsable?.message}</Form.Control.Feedback>
              </Col>
              <Col md={6}>
                <Form.Label className="fw-semibold">
                  <i className="bi bi-whatsapp me-1" style={{ color: "#25d366" }}></i>
                  Teléfono responsable
                </Form.Label>
                <Form.Control
                  placeholder="Ej: 5491123456789"
                  {...register("telefono")}
                />
                <Form.Text className="text-muted">Con código de país, sin + ni espacios</Form.Text>
              </Col>
            </Row>
          </Modal.Body>
          <Modal.Footer>
            <Button onClick={cerrarModal} style={{ backgroundColor: "#555", border: "none" }}>Cancelar</Button>
            <Button type="submit" style={{ backgroundColor: "#4a6fa5", border: "none" }}>
              <i className="bi bi-check-lg me-2"></i>Guardar
            </Button>
          </Modal.Footer>
        </Form>
      </Modal>

    </Container>
  );
}

export default CamionetasAltas;


