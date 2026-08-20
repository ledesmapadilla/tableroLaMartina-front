import { useState, useEffect } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { Container, Card, Form, Button, Row, Col } from "react-bootstrap";
import Swal from "sweetalert2";
import TractorIcon from "../shared/TractorIcon";

const hoyStr = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const GRUPOS = {
  1: { label: "Grupo 1", supervisor: "Jorge Rosas" },
  2: { label: "Grupo 2", supervisor: "Guillermo Bustos" },
  3: { label: "Grupo 3", supervisor: "Carlos Chumiento" },
  4: { label: "Grupo 4", supervisor: "brandan alejandro" },
  5: { label: "Grupo 5", supervisor: "Elio Rojas" },
  6: { label: "Berdina", supervisor: "Kevin" },
  7: { label: "San Pablo", supervisor: "Victor" },
};

function ReportarFallaTractor() {
  const navigate = useNavigate();
  const { grupoId, tractorId } = useParams();
  const { state } = useLocation();

  const [tractor, setTractor] = useState(null);
  const [formData, setFormData] = useState({
    fecha: hoyStr(),
    diagnostico: "",
    descripcion: "",
    urgencia: "baja",
    prioridad: "Normal",
    parte: "",
    responsable: state?.responsable || "",
    horometro: "",
    maquinaParada: false,
  });

  const [enviando, setEnviando] = useState(false);

  const infoGrupo = GRUPOS[grupoId] || { label: state?.grupoLabel || `Grupo ${grupoId}`, supervisor: "—" };

  useEffect(() => {
    fetch(`/api/tractores/${tractorId}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data) {
          setTractor(data);
          setFormData((prev) => ({
            ...prev,
            responsable: prev.responsable || data.encargadoGral || data.supervisor || infoGrupo.supervisor || "",
            maquinaParada: false,
          }));
        }
      })
      .catch(() => {});
  }, [tractorId]);

  const rawCC = tractor?.cc || state?.cc || "CC —";
  const cleanCC = String(rawCC).replace(/^cc\s*/i, "").trim();
  const descripcion = tractor?.descripcion || state?.descripcion || "";

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.descripcion.trim() && !formData.diagnostico.trim()) {
      Swal.fire({
        icon: "warning",
        title: "Atención",
        text: "Complete el diagnóstico o la descripción de la falla.",
        width: "320px",
        confirmButtonColor: "#1e293b",
      });
      return;
    }

    if (!formData.parte || !formData.parte.trim()) {
      Swal.fire({
        icon: "warning",
        title: "Atención",
        text: "Debe seleccionar una categoría para la reparación.",
        width: "320px",
        confirmButtonColor: "#1e293b",
      });
      return;
    }

    if (formData.fecha && formData.fecha > hoyStr()) {
      Swal.fire({
        icon: "warning",
        title: "Fecha no válida",
        text: "No se permiten fechas futuras para el reporte de falla.",
        width: "320px",
        confirmButtonColor: "#1e293b",
      });
      return;
    }

    if (formData.maquinaParada) {
      const confirmParada = await Swal.fire({
        title: "Tractor Parado",
        text: "¿Confirma registrar esta reparación con la unidad fuera de servicio?",
        icon: "warning",
        width: "320px",
        showCancelButton: true,
        confirmButtonColor: "#ef4444",
        cancelButtonColor: "#64748b",
        confirmButtonText: "Sí, guardar",
        cancelButtonText: "Cancelar",
      });

      if (!confirmParada.isConfirmed) {
        return;
      }
    }

    setEnviando(true);

    const desc = formData.descripcion.trim() || formData.diagnostico.trim();
    const diag = formData.diagnostico.trim() || desc;
    const fechaISO = formData.fecha ? `${formData.fecha}T12:00:00.000Z` : new Date().toISOString();

    const payload = {
      tractor: tractorId,
      fecha: fechaISO,
      descripcion: desc,
      reparacion: desc,
      diagnostico: diag,
      parte: formData.parte,
      urgencia: formData.urgencia,
      prioridad: formData.prioridad,
      responsable: formData.responsable.trim(),
      horometro: formData.horometro !== "" ? Number(formData.horometro) : "",
      maquinaParada: formData.maquinaParada,
      estado: "Pendiente",
    };

    try {
      const res = await fetch("/api/trabajos-tractor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        Swal.fire({
          icon: "success",
          title: "Falla guardada",
          width: "300px",
          timer: 1400,
          showConfirmButton: false,
        });

        setTimeout(() => {
          navigate(`/tractores/grupo/${grupoId}/reparaciones/${tractorId}/tareas`, {
            state: { cc: rawCC, descripcion, responsable: formData.responsable, grupoId },
          });
        }, 1400);
      } else {
        Swal.fire({
          icon: "error",
          title: "Error",
          text: "No se pudo guardar la solicitud.",
          width: "320px",
          confirmButtonColor: "#1e293b",
        });
      }
    } catch {
      Swal.fire({
        icon: "error",
        title: "Error de conexión",
        text: "Ocurrió un error al enviar el reporte.",
        width: "320px",
        confirmButtonColor: "#1e293b",
      });
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div
      style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        backgroundColor: "#f8f9fa",
        minHeight: "100%",
        overflowY: "auto",
      }}
    >
      {/* Barra de Cabecera Institucional */}
      <div
        className="d-flex align-items-center justify-content-between px-4 py-2 border-bottom shadow-sm flex-shrink-0"
        style={{ backgroundColor: "#1e293b", color: "#fff", height: "54px" }}
      >
        <div className="d-flex align-items-center gap-3">
          <div
            className="rounded-3 d-flex align-items-center justify-content-center me-1"
            style={{
              width: "34px",
              height: "34px",
              backgroundColor: "#ef4444",
              color: "#fff",
              fontSize: "1.15rem",
              boxShadow: "0 2px 8px rgba(239, 68, 68, 0.3)",
            }}
          >
            <i className="bi bi-megaphone-fill"></i>
          </div>
          <div className="d-flex align-items-center gap-2">
            <span className="text-white fs-6">Reportar Falla</span>
            <span className="text-light opacity-75 small">•</span>
            <span
              className="badge px-3 py-1 fw-bold text-white shadow-sm"
              style={{
                backgroundColor: "#0f172a",
                border: "1px solid #475569",
                fontSize: "0.92rem",
                letterSpacing: "0.5px",
                borderRadius: "8px",
              }}
            >
              CC {cleanCC}
            </span>
            <span className="text-light opacity-75 small">• {infoGrupo.label}</span>
            {descripcion && <span className="text-light opacity-75 small">• {descripcion}</span>}
          </div>
        </div>

        {/* Botones de Navegación */}
        <div className="d-flex align-items-center gap-2">
          <button
            onClick={() => navigate(-1)}
            className="btn btn-sm btn-outline-light d-flex align-items-center gap-1.5 rounded-3 px-3 py-1"
            style={{ fontSize: "0.82rem" }}
          >
            <i className="bi bi-arrow-left"></i>
            <span>Volver</span>
          </button>
          <button
            onClick={() => navigate(`/tractores/grupo/${grupoId}/reparaciones/${tractorId}`)}
            className="btn btn-sm btn-outline-light d-flex align-items-center gap-2 rounded-3 px-3 py-1"
            style={{ fontSize: "0.82rem" }}
          >
            <TractorIcon size="1.05rem" color="#fff" />
            <span>Menú Tractor</span>
          </button>
          <button
            onClick={() => navigate("/")}
            className="btn btn-sm btn-light text-dark d-flex align-items-center gap-1.5 rounded-3 px-3 py-1"
            style={{ fontSize: "0.82rem" }}
          >
            <i className="bi bi-house-door-fill"></i>
            <span>General</span>
          </button>
        </div>
      </div>

      <Container className="py-4" style={{ maxWidth: "680px" }}>
        <Card className="shadow-sm rounded-4 p-4 bg-white" style={{ border: "1px solid #cbd5e1" }}>
          {/* Título de la tarjeta centrado */}
          <div className="text-center mb-3 pb-2" style={{ borderBottom: "1px solid #cbd5e1" }}>
            <h5 className="text-dark mb-0 fs-5">Detalle de reparación solicitada</h5>
          </div>

          <Form onSubmit={handleSubmit}>
            {/* Fila Superior: Fecha a la izquierda y Tractor Parado a la derecha */}
            <div className="d-flex align-items-center justify-content-between mb-3 pb-2" style={{ borderBottom: "1px solid #f1f5f9" }}>
              {/* Campo Fecha */}
              <div className="d-flex align-items-center gap-2">
                <Form.Label className="fw-semibold text-dark small mb-0">Fecha:</Form.Label>
                <Form.Control
                  type="date"
                  max={hoyStr()}
                  value={formData.fecha}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val && val > hoyStr()) {
                      setFormData({ ...formData, fecha: hoyStr() });
                    } else {
                      setFormData({ ...formData, fecha: val });
                    }
                  }}
                  className="rounded-3 form-control-sm"
                  style={{ width: "155px", fontSize: "0.85rem" }}
                />
              </div>

              {/* Switch de Tractor Parado */}
              <div
                className={`d-inline-flex align-items-center justify-content-between px-3 py-1.5 rounded-3 border ${
                  formData.maquinaParada
                    ? "bg-danger-subtle border-danger text-danger"
                    : "bg-light border text-secondary"
                }`}
                style={{ width: "210px" }}
              >
                <div className="d-flex align-items-center gap-2" style={{ fontSize: "0.86rem" }}>
                  <i
                    className={`bi bi-exclamation-triangle-fill ${
                      formData.maquinaParada ? "text-danger" : "text-secondary"
                    }`}
                  ></i>
                  <span className="text-dark" style={{ fontSize: "0.84rem" }}>Tractor parado</span>
                </div>
                <Form.Check
                  type="switch"
                  id="parada-switch"
                  checked={formData.maquinaParada}
                  onChange={(e) => {
                    setFormData({
                      ...formData,
                      maquinaParada: e.target.checked,
                    });
                  }}
                  style={{ fontSize: "1.1rem", cursor: "pointer", marginBottom: 0 }}
                />
              </div>
            </div>

            {/* 1. Diagnóstico */}
            <Form.Group className="mb-3">
              <Form.Label className="fw-semibold text-dark small mb-1">Diagnóstico</Form.Label>
              <Form.Control
                type="text"
                value={formData.diagnostico}
                onChange={(e) => setFormData({ ...formData, diagnostico: e.target.value })}
                className="rounded-3"
              />
            </Form.Group>

            {/* 2. Descripción de la Falla */}
            <Form.Group className="mb-3">
              <Form.Label className="fw-semibold text-dark small mb-1">Descripción de la falla</Form.Label>
              <Form.Control
                as="textarea"
                rows={3}
                value={formData.descripcion}
                onChange={(e) => setFormData({ ...formData, descripcion: e.target.value })}
                className="rounded-3"
              />
            </Form.Group>

            {/* 3. Nivel de Urgencia Centrado */}
            <Form.Group className="mb-4 text-center">
              <Form.Label className="fw-semibold text-dark small mb-2 d-block text-center">Nivel de urgencia</Form.Label>
              <div className="d-flex justify-content-center gap-2 mx-auto" style={{ maxWidth: "380px" }}>
                <div
                  className={`flex-fill px-3 py-1.5 rounded-3 border text-center transition-all ${
                    formData.urgencia === "baja"
                      ? "bg-success-subtle border-success text-success fw-semibold"
                      : "bg-light text-secondary"
                  }`}
                  onClick={() => setFormData({ ...formData, urgencia: "baja", prioridad: "Normal" })}
                  style={{ cursor: "pointer", fontSize: "0.84rem" }}
                >
                  🟢 Leve
                </div>
                <div
                  className={`flex-fill px-3 py-1.5 rounded-3 border text-center transition-all ${
                    formData.urgencia === "media"
                      ? "bg-warning-subtle border-warning text-warning-emphasis fw-semibold"
                      : "bg-light text-secondary"
                  }`}
                  onClick={() => setFormData({ ...formData, urgencia: "media", prioridad: "Urgente" })}
                  style={{ cursor: "pointer", fontSize: "0.84rem" }}
                >
                  🟡 Urgente
                </div>
                <div
                  className={`flex-fill px-3 py-1.5 rounded-3 border text-center transition-all ${
                    formData.urgencia === "alta"
                      ? "bg-danger-subtle border-danger text-danger fw-semibold"
                      : "bg-light text-secondary"
                  }`}
                  onClick={() =>
                    setFormData({
                      ...formData,
                      urgencia: "alta",
                      prioridad: "Crítico",
                    })
                  }
                  style={{ cursor: "pointer", fontSize: "0.84rem" }}
                >
                  🔴 Crítico
                </div>
              </div>
            </Form.Group>

            {/* Categoría, Responsable y Horómetro */}
            <Row className="g-3 mb-4">
              <Col sm={4}>
                <Form.Group>
                  <Form.Label className="fw-semibold text-dark small mb-1">
                    Categoría <span className="text-danger">*</span>
                  </Form.Label>
                  <Form.Select
                    value={formData.parte}
                    onChange={(e) => setFormData({ ...formData, parte: e.target.value })}
                    className="rounded-3"
                    style={{ fontSize: "0.86rem", height: "38px" }}
                  >
                    <option value="">-- Seleccione una categoría --</option>
                    <option value="Motor">Motor</option>
                    <option value="Transmisión / Caja">Transmisión / Caja</option>
                    <option value="Embrague">Embrague</option>
                    <option value="Hidráulico">Hidráulico</option>
                    <option value="Frenos">Frenos</option>
                    <option value="Dirección">Dirección</option>
                    <option value="Mecánica general">Mecánica general</option>
                    <option value="Electricidad / Luces">Electricidad / Luces</option>
                    <option value="Rodado / Cubiertas">Rodado / Cubiertas</option>
                    <option value="Implementos / Enganche">Implementos / Enganche</option>
                    <option value="Service Programado">Service Programado</option>
                    <option value="Otros">Otros</option>
                  </Form.Select>
                </Form.Group>
              </Col>

              <Col sm={4}>
                <Form.Group>
                  <Form.Label className="fw-semibold text-dark small mb-1">Responsable</Form.Label>
                  <Form.Control
                    type="text"
                    value={formData.responsable}
                    onChange={(e) => setFormData({ ...formData, responsable: e.target.value })}
                    className="rounded-3"
                    style={{ fontSize: "0.86rem", height: "38px" }}
                    placeholder="Ej. Mecánico"
                  />
                </Form.Group>
              </Col>

              <Col sm={4}>
                <Form.Group>
                  <Form.Label className="fw-semibold text-dark small mb-1">Horómetro (hs)</Form.Label>
                  <Form.Control
                    type="number"
                    min="0"
                    step="any"
                    value={formData.horometro}
                    onChange={(e) => setFormData({ ...formData, horometro: e.target.value })}
                    placeholder="Ej. 1250"
                    className="rounded-3"
                    style={{ fontSize: "0.86rem", height: "38px" }}
                  />
                </Form.Group>
              </Col>
            </Row>

            {/* Botones de Envío */}
            <div className="d-flex justify-content-end gap-2 pt-3 border-top">
              <Button
                variant="outline-secondary"
                className="rounded-3 px-4 btn-sm"
                onClick={() => navigate(-1)}
                disabled={enviando}
                style={{ fontSize: "0.85rem" }}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                variant="dark"
                className="rounded-3 px-4 btn-sm d-flex align-items-center gap-1.5"
                disabled={enviando}
                style={{ fontSize: "0.85rem" }}
              >
                {enviando ? (
                  <span>Guardando...</span>
                ) : (
                  <>
                    <i className="bi bi-check2 me-2"></i>
                    <span>Guardar</span>
                  </>
                )}
              </Button>
            </div>
          </Form>
        </Card>
      </Container>
    </div>
  );
}

export default ReportarFallaTractor;
