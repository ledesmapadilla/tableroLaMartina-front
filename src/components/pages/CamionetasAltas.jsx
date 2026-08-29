import { useEffect, useState, useRef } from "react";
import { useForm, useWatch } from "react-hook-form";
import { useNavigate } from "react-router-dom";
import Swal from "sweetalert2";
import { Container, Table, Button, Form, Modal, Row, Col } from "react-bootstrap";
import LogoNavbar from "../shared/LogoNavbar";

const API = "/api/camionetas";

function SelectResponsableDown({ value, onChange, options, isInvalid, errorMsg }) {
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState("");
  const containerRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const filtered = options.filter((o) =>
    o.toLowerCase().includes(filter.toLowerCase())
  );

  return (
    <div ref={containerRef} className="position-relative">
      <Form.Control
        placeholder="— Seleccionar o escribir responsable —"
        value={open ? filter : value || ""}
        onFocus={() => {
          setFilter("");
          setOpen(true);
        }}
        onChange={(e) => {
          setFilter(e.target.value);
          onChange(e.target.value);
          setOpen(true);
        }}
        isInvalid={isInvalid}
        className="rounded-3"
        style={{ fontSize: "0.85rem", cursor: "pointer" }}
      />
      {open && (
        <div
          style={{
            position: "absolute",
            top: "100%",
            left: 0,
            right: 0,
            zIndex: 1060,
            backgroundColor: "#fff",
            border: "1px solid #cbd5e1",
            borderRadius: "8px",
            maxHeight: "260px",
            overflowY: "auto",
            boxShadow: "0 8px 24px rgba(0,0,0,0.15)",
            marginTop: "4px",
          }}
        >
          {filtered.length === 0 ? (
            <div className="px-3 py-2 text-muted" style={{ fontSize: "0.82rem" }}>
              Sin coincidencias. Escribe para ingresar "{filter}"
            </div>
          ) : (
            filtered.map((r) => (
              <div
                key={r}
                className="px-3 py-2"
                style={{
                  cursor: "pointer",
                  fontSize: "0.85rem",
                  backgroundColor: value === r ? "#f1f5f9" : "#fff",
                  fontWeight: value === r ? "600" : "normal",
                  color: value === r ? "#0f172a" : "#334155",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#f8fafc")}
                onMouseLeave={(e) =>
                  (e.currentTarget.style.backgroundColor = value === r ? "#f1f5f9" : "#fff")
                }
                onMouseDown={(e) => {
                  e.preventDefault();
                  onChange(r);
                  setFilter("");
                  setOpen(false);
                }}
              >
                {r}
              </div>
            ))
          )}
        </div>
      )}
      {isInvalid && errorMsg && (
        <Form.Control.Feedback type="invalid" style={{ display: "block", fontSize: "0.78rem" }}>
          {errorMsg}
        </Form.Control.Feedback>
      )}
    </div>
  );
}

function CamionetasAltas() {
  const navigate = useNavigate();
  const [camionetas, setCamionetas] = useState([]);
  const [paradasAbiertas, setParadasAbiertas] = useState(new Set());
  const [busqueda, setBusqueda] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [editando, setEditando] = useState(null);
  const {
    register,
    handleSubmit,
    reset,
    setValue,
    control,
    formState: { errors },
  } = useForm();
  const responsableValue = useWatch({ control, name: "responsable" });

  const cargar = async () => {
    try {
      const [res, resParadas] = await Promise.all([
        fetch(API),
        fetch("/api/paradas/abiertas/ids"),
      ]);
      const data = res.ok ? await res.json() : [];
      const dataParadas = resParadas.ok ? await resParadas.json() : [];
      setCamionetas(Array.isArray(data) ? data : []);
      setParadasAbiertas(new Set(Array.isArray(dataParadas) ? dataParadas : []));
    } catch {
      setCamionetas([]);
      setParadasAbiertas(new Set());
    }
  };

  useEffect(() => {
    cargar();
  }, []);

  const abrirNuevo = () => {
    setEditando(null);
    reset();
    setShowModal(true);
  };

  const formatTelefono = (tel) => {
    if (!tel) return "";
    const str = String(tel).trim();
    if (str.startsWith("549")) return str.slice(3);
    if (str.startsWith("+549")) return str.slice(4);
    if (str.startsWith("54")) return str.slice(2);
    return str;
  };

  const abrirEditar = (c) => {
    setEditando(c._id);
    setValue("marca", c.marca);
    setValue("patente", c.patente);
    setValue("responsable", c.responsable);
    setValue("telefono", formatTelefono(c.telefono));
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
      const payload = {
        ...data,
        telefono: formatTelefono(data.telefono),
      };
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
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
      text: "Esta acción quitará la camioneta de la flota",
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#dc2626",
      cancelButtonColor: "#64748b",
      confirmButtonText: "Sí, eliminar",
      cancelButtonText: "Cancelar",
    });
    if (result.isConfirmed) {
      await fetch(`${API}/${id}`, { method: "DELETE" });
      cargar();
      Swal.fire({ icon: "success", title: "Equipo eliminado", timer: 1200, showConfirmButton: false });
    }
  };

  const EXCLUIDOS = new Set([
    "agustin",
    "agustín",
    "nacho",
    "tomas marquez",
    "tomás márquez",
    "zamorano",
    "nelson",
    "mauricio",
    "juan jose",
    "juan josé",
  ]);

  const responsablesExistentes = [
    ...new Set([
      "Carlos Carro",
      "Victor",
      "Kevin",
      ...camionetas
        .map((c) => (c.responsable || "").trim())
        .filter((r) => r && !EXCLUIDOS.has(r.toLowerCase())),
    ]),
  ].sort((a, b) => a.localeCompare(b));

  const camionetasFiltradas = camionetas.filter((c) => {
    const q = busqueda.toLowerCase().trim();
    if (!q) return true;
    const enMarca = (c.marca || "").toLowerCase().includes(q);
    const enPatente = (c.patente || "").toLowerCase().includes(q);
    const enResp = (c.responsable || "").toLowerCase().includes(q);
    return enMarca || enPatente || enResp;
  });

  return (
    <div
      style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        backgroundColor: "#f8f9fa",
        height: "100%",
        maxHeight: "100vh",
        overflow: "hidden",
      }}
    >
      {/* Barra de Cabecera Institucional */}
      <div
        className="d-flex align-items-center justify-content-between px-4 py-2 border-bottom shadow-sm flex-shrink-0"
        style={{ backgroundColor: "#1e293b", color: "#fff", height: "54px", position: "relative" }}
      >
        <LogoNavbar />
        {/* Lado Izquierdo: Icono e info */}
        <div className="d-flex align-items-center gap-2">
          <div
            className="rounded-3 d-flex align-items-center justify-content-center me-1"
            style={{
              width: "34px",
              height: "34px",
              backgroundColor: "#3b82f6",
              color: "#fff",
              fontSize: "1.15rem",
              boxShadow: "0 2px 8px rgba(59, 130, 246, 0.3)",
            }}
          >
            <i className="bi bi-car-front-fill"></i>
          </div>
          <span className="text-light opacity-75 small ms-1">{camionetas.length} Camionetas</span>
        </div>

        {/* Título (corrido a la izquierda: el logo ocupa el centro) */}
        <div
          style={{
            marginRight: "auto",
            marginLeft: "0.9rem",
            width: "max-content",
            pointerEvents: "none",
          }}
        >
          <span className="text-white fs-6 fw-normal" style={{ letterSpacing: "0.3px" }}>
            Alta de Flota — Camionetas
          </span>
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
            onClick={() => navigate("/")}
            className="btn btn-sm btn-light text-dark d-flex align-items-center gap-1.5 rounded-3 px-3 py-1"
            style={{ fontSize: "0.82rem" }}
          >
            <i className="bi bi-house-door-fill"></i>
            <span>General</span>
          </button>
        </div>
      </div>

      {/* Contenedor Principal */}
      <Container
        fluid
        className="px-4 py-3 d-flex flex-column flex-grow-1"
        style={{ maxWidth: "1020px", width: "100%", margin: "0 auto", overflow: "hidden" }}
      >
        {/* Barra de Búsqueda y Botón Nueva Camioneta */}
        <div className="d-flex align-items-center justify-content-between mb-3 flex-wrap gap-2">
          {/* Buscador rápido */}
          <div style={{ position: "relative", width: "280px" }}>
            <i
              className="bi bi-search text-muted"
              style={{
                position: "absolute",
                left: "10px",
                top: "50%",
                transform: "translateY(-50%)",
                fontSize: "0.82rem",
              }}
            ></i>
            <Form.Control
              type="text"
              placeholder="Buscar patente, marca, responsable..."
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              size="sm"
              className="rounded-3 ps-4"
              style={{ fontSize: "0.84rem", paddingRight: busqueda ? "28px" : undefined }}
            />
            {busqueda && (
              <button
                onClick={() => setBusqueda("")}
                style={{
                  position: "absolute",
                  right: "8px",
                  top: "50%",
                  transform: "translateY(-50%)",
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  color: "#94a3b8",
                  fontSize: "0.9rem",
                  padding: 0,
                }}
              >
                ×
              </button>
            )}
          </div>

          {/* Botón Nueva Camioneta */}
          <Button
            variant="success"
            size="sm"
            onClick={abrirNuevo}
            className="d-inline-flex align-items-center rounded-3 px-3 py-1.5 shadow-sm"
            style={{
              backgroundColor: "#15803d",
              borderColor: "#15803d",
              fontSize: "0.84rem",
              fontWeight: 600,
            }}
          >
            <span>Nueva Camioneta</span>
          </Button>
        </div>

        {/* Tabla de Camionetas */}
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
            <thead style={{ position: "sticky", top: 0, zIndex: 10, backgroundColor: "#1e293b", color: "#fff" }}>
              <tr className="fw-normal align-middle">
                <th style={{ width: "40px", backgroundColor: "#1e293b", color: "#fff", padding: "8px 4px", fontWeight: "normal" }}>
                  #
                </th>
                <th style={{ width: "180px", backgroundColor: "#1e293b", color: "#fff", padding: "8px 12px", textAlign: "left", fontWeight: "normal" }}>
                  Marca / Modelo
                </th>
                <th style={{ width: "130px", backgroundColor: "#1e293b", color: "#fff", padding: "8px 8px", fontWeight: "normal" }}>
                  Patente
                </th>
                <th style={{ width: "180px", backgroundColor: "#1e293b", color: "#fff", padding: "8px 8px", fontWeight: "normal" }}>
                  Responsable
                </th>
                <th style={{ width: "160px", backgroundColor: "#1e293b", color: "#fff", padding: "8px 8px", fontWeight: "normal" }}>
                  Teléfono (Avisos)
                </th>
                <th style={{ width: "100px", backgroundColor: "#1e293b", color: "#fff", padding: "8px 8px", fontWeight: "normal" }}>
                  Acciones
                </th>
              </tr>
            </thead>
            <tbody>
              {camionetasFiltradas.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-muted py-4" style={{ fontSize: "0.85rem" }}>
                    {busqueda ? "No se encontraron camionetas con ese criterio" : "No hay equipos registrados en la flota"}
                  </td>
                </tr>
              ) : (
                camionetasFiltradas.map((c, idx) => {
                  const estaParada = paradasAbiertas.has(c._id?.toString());
                  const isEven = idx % 2 === 0;
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
                      <td className="text-start fw-semibold text-dark ps-3">
                        {c.marca}
                      </td>
                      <td>
                        <span
                          className="badge px-2.5 py-1 text-white shadow-sm"
                          style={{
                            backgroundColor: estaParada ? "#991b1b" : "#0f172a",
                            border: "1px solid #475569",
                            fontSize: "0.82rem",
                            letterSpacing: "1px",
                            borderRadius: "6px",
                            fontWeight: 700,
                          }}
                        >
                          {c.patente}
                        </span>
                      </td>
                      <td className="text-secondary fw-medium">
                        {c.responsable || "—"}
                      </td>
                      <td>
                        {c.telefono ? (
                          <div className="d-flex align-items-center justify-content-center gap-1.5 text-success small fw-semibold">
                            <i className="bi bi-whatsapp" style={{ color: "#25d366" }}></i>
                            <span style={{ color: "#334155" }}>{formatTelefono(c.telefono)}</span>
                          </div>
                        ) : (
                          <span className="text-muted small">—</span>
                        )}
                      </td>
                      <td>
                        <div className="d-flex justify-content-center align-items-center gap-1.5">
                          <button
                            onClick={() => abrirEditar(c)}
                            className="btn btn-sm btn-outline-primary d-flex align-items-center justify-content-center rounded-2 p-1"
                            style={{ width: "28px", height: "28px" }}
                            title="Editar camioneta"
                          >
                            <i className="bi bi-pencil" style={{ fontSize: "0.8rem" }}></i>
                          </button>
                          <button
                            onClick={() => eliminar(c._id)}
                            className="btn btn-sm btn-outline-danger d-flex align-items-center justify-content-center rounded-2 p-1"
                            style={{ width: "28px", height: "28px" }}
                            title="Eliminar camioneta"
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

      {/* Modal Nueva / Editar Camioneta */}
      <Modal show={showModal} onHide={cerrarModal} centered contentClassName="border-0 shadow-lg rounded-4 overflow-visible">
        <Modal.Header
          closeButton
          closeVariant="white"
          style={{ backgroundColor: "#1e293b", color: "#fff", borderTopLeftRadius: "1rem", borderTopRightRadius: "1rem", borderBottom: "1px solid rgba(255,255,255,0.1)" }}
        >
          <Modal.Title className="fs-6 fw-bold d-flex align-items-center gap-2">
            <i className="bi bi-car-front-fill text-info"></i>
            <span>{editando ? "Editar Camioneta" : "Nueva Camioneta"}</span>
          </Modal.Title>
        </Modal.Header>
        <Form onSubmit={handleSubmit(onSubmit)}>
          <Modal.Body className="p-4" style={{ overflow: "visible" }}>
            <Row className="g-3">
              <Col md={6}>
                <Form.Label className="fw-semibold text-dark small mb-1">Marca / Modelo</Form.Label>
                <Form.Control
                  placeholder="Ej: Ford Ranger"
                  className="rounded-3"
                  style={{ fontSize: "0.85rem" }}
                  {...register("marca", {
                    required: "La marca es requerida",
                    minLength: { value: 2, message: "Mínimo 2 caracteres" },
                    maxLength: { value: 50, message: "Máximo 50 caracteres" },
                  })}
                  isInvalid={!!errors.marca}
                />
                <Form.Control.Feedback type="invalid" style={{ fontSize: "0.78rem" }}>
                  {errors.marca?.message}
                </Form.Control.Feedback>
              </Col>

              <Col md={6}>
                <Form.Label className="fw-semibold text-dark small mb-1">Patente</Form.Label>
                <Form.Control
                  placeholder="Ej: AB123CD"
                  className="rounded-3 text-uppercase"
                  style={{ fontSize: "0.85rem" }}
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
                <Form.Control.Feedback type="invalid" style={{ fontSize: "0.78rem" }}>
                  {errors.patente?.message}
                </Form.Control.Feedback>
              </Col>

              <Col md={12}>
                <Form.Label className="fw-semibold text-dark small mb-1">Responsable habitual</Form.Label>
                <input
                  type="hidden"
                  {...register("responsable", { required: "El responsable es requerido" })}
                />
                <SelectResponsableDown
                  value={responsableValue}
                  onChange={(val) => setValue("responsable", val, { shouldValidate: true })}
                  options={responsablesExistentes}
                  isInvalid={!!errors.responsable}
                  errorMsg={errors.responsable?.message}
                />
              </Col>

              <Col md={12}>
                <Form.Label className="fw-semibold text-dark small mb-1 d-flex align-items-center gap-1.5">
                  <i className="bi bi-whatsapp text-success"></i>
                  <span>Teléfono para avisos automáticos</span>
                </Form.Label>
                <Form.Control
                  placeholder="Ej: 3815123456"
                  className="rounded-3"
                  style={{ fontSize: "0.85rem" }}
                  {...register("telefono")}
                />
                <Form.Text className="text-muted" style={{ fontSize: "0.74rem" }}>
                  Sin 549, ingresar código de área y número (Ej: 3815123456).
                </Form.Text>
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

export default CamionetasAltas;
