import { useState } from "react";
import Swal from "sweetalert2";
import { Button, Col, Form, Modal, Row } from "react-bootstrap";
import { api } from "../../services/api";
import { campo } from "../compras/formato";
import { Raya } from "../compras/estilos";

// Los frentes de San Pablo (02/10/2026): se dan de alta en Carros porta
// escaleras y en Escaleras (06/10/2026), y se eligen en las dos. Cada uno
// tiene nombre y cliente.

const GRIS_CLARO = "#a0aec0";
const TEXTO = "#1e293b";
// El slate de Mantenimiento, el de las dos pantallas.
const COLOR = "#1e293b";

// El frente en la tabla: el nombre y, al lado, el cliente en gris.
export function CeldaFrente({ frente }) {
  if (!frente?.nombre) return <Raya />;
  return (
    <span>
      {frente.nombre}
      {frente.cliente && (
        <span className="text-muted" style={{ fontSize: "0.66rem" }}>
          {" "}
          · {frente.cliente}
        </span>
      )}
    </span>
  );
}

// El desplegable con los frentes dados de alta.
export function SelectFrente({ frentes, valor, onChange, required = false }) {
  return (
    <>
      <Form.Select
        className="rounded-3"
        style={{ ...campo, color: valor ? TEXTO : GRIS_CLARO }}
        value={valor || ""}
        onChange={(e) => onChange(e.target.value)}
        required={required}
      >
        <option value="">Elegir frente…</option>
        {frentes.map((f) => (
          <option key={f._id} value={f._id} style={{ color: TEXTO }}>
            {f.nombre}
            {f.cliente ? ` · ${f.cliente}` : ""}
          </option>
        ))}
      </Form.Select>
      {frentes.length === 0 && (
        <div className="text-muted mt-1" style={{ fontSize: "0.72rem" }}>
          No hay frentes dados de alta: se agregan con el botón Alta de frente.
        </div>
      )}
    </>
  );
}

// El alta de un frente: nombre y cliente. `onGuardado` vuelve a traer los
// frentes de la pantalla que lo abrió.
export function ModalAltaFrente({ show, onHide, frentes, onGuardado }) {
  const vacio = { nombre: "", cliente: "" };
  const [nuevo, setNuevo] = useState(vacio);

  const guardar = async (e) => {
    e.preventDefault();
    try {
      await api.post("/ingresos-sanpablo/frentes", nuevo);
      onHide();
      onGuardado?.();
      Swal.fire({ icon: "success", title: "Frente dado de alta", timer: 1400, showConfirmButton: false });
    } catch (err) {
      Swal.fire({ icon: "error", title: "No se pudo guardar", text: err.message });
    }
  };

  return (
    // Al cerrarse queda vacío para la próxima vez.
    <Modal
      show={show}
      onHide={onHide}
      onExited={() => setNuevo(vacio)}
      centered
      dialogClassName="modal-cc"
      contentClassName="border-0 shadow-lg rounded-4"
    >
      <Modal.Header
        closeButton
        closeVariant="white"
        style={{
          backgroundColor: COLOR,
          color: "#fff",
          borderTopLeftRadius: "1rem",
          borderTopRightRadius: "1rem",
          borderBottom: "1px solid rgba(255,255,255,0.1)",
        }}
      >
        <Modal.Title className="fs-6 fw-normal d-flex align-items-center gap-2 text-white">
          <i className="bi bi-geo-alt"></i>
          <span>Alta de frente</span>
        </Modal.Title>
      </Modal.Header>
      <Form onSubmit={guardar}>
        <Modal.Body className="p-4">
          <Row className="g-3 form-ingresos">
            <Col xs={12}>
              <Form.Label className="fw-semibold text-dark small mb-1">
                Nombre del frente <span className="text-danger">*</span>
              </Form.Label>
              <Form.Control
                className="rounded-3"
                style={campo}
                value={nuevo.nombre}
                onChange={(e) => setNuevo({ ...nuevo, nombre: e.target.value })}
                placeholder="Nombre del frente"
                maxLength={80}
                autoFocus
                required
              />
            </Col>
            <Col xs={12}>
              <Form.Label className="fw-semibold text-dark small mb-1">
                Cliente <span className="text-danger">*</span>
              </Form.Label>
              <Form.Control
                className="rounded-3"
                style={campo}
                value={nuevo.cliente}
                onChange={(e) => setNuevo({ ...nuevo, cliente: e.target.value })}
                placeholder="Cliente"
                maxLength={80}
                required
              />
            </Col>
            {frentes.length > 0 && (
              <Col xs={12}>
                <div className="text-muted" style={{ fontSize: "0.72rem" }}>
                  Ya dados de alta: {frentes.map((f) => f.nombre).join(", ")}
                </div>
              </Col>
            )}
          </Row>
        </Modal.Body>
        <Modal.Footer
          className="bg-light border-0 py-2 px-4"
          style={{ borderBottomLeftRadius: "1rem", borderBottomRightRadius: "1rem" }}
        >
          <Button
            variant="outline-secondary"
            size="sm"
            onClick={onHide}
            className="rounded-3 px-3 py-1"
            style={{ fontSize: "0.84rem" }}
          >
            Cancelar
          </Button>
          <Button
            size="sm"
            type="submit"
            className="rounded-3 px-3 py-1 shadow-sm d-flex align-items-center gap-1"
            style={{ backgroundColor: "#15803d", borderColor: "#15803d", fontSize: "0.84rem", fontWeight: 600 }}
          >
            <i className="bi bi-check-lg"></i>
            <span>Guardar</span>
          </Button>
        </Modal.Footer>
      </Form>
    </Modal>
  );
}
