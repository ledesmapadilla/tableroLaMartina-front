import { useEffect, useMemo, useState } from "react";
import Swal from "sweetalert2";
import { Container, Table, Button, Form, Modal, Row, Col, Card } from "react-bootstrap";
import { useForm } from "react-hook-form";
import { usePermisos } from "../../context/permisos";

const API = "/api/lotes";

// Los números se muestran con separador de miles y sin decimales de más.
const numero = (v, decimales = 2) =>
  v === null || v === undefined || v === ""
    ? null
    : Number(v).toLocaleString("es-AR", { maximumFractionDigits: decimales });

/**
 * Los lotes de un campo, con sus cantidades (17/09/2026).
 *
 * Vive adentro de Variables porque es un valor de la certificación: en San
 * Pablo el herbicida, el desmalezado y el pulverizado se pagan por lote
 * terminado, y lo que se reparte entre la gente que trabajó es la medida del
 * lote. Por eso cada lote lleva sus **hectáreas** y sus **plantas**: la tarea
 * define con cuál de las dos se paga.
 *
 * Los lotes son de un campo: el mismo nombre puede existir en los dos.
 */
function ProduccionLotes({ establecimiento = "caspinchango" }) {
  // Ver sin editar (tabla de Roles): los botones quedan a la vista pero
  // deshabilitados.
  const { puede } = usePermisos();
  const sinEditar = !puede("produccion.lotes", "editar");
  const query = `?establecimiento=${establecimiento}`;
  const [lotes, setLotes] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [busqueda, setBusqueda] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [editando, setEditando] = useState(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm();

  const cargar = async () => {
    try {
      const res = await fetch(API + query);
      const data = res.ok ? await res.json() : [];
      setLotes(Array.isArray(data) ? data : []);
    } catch {
      setLotes([]);
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    (async () => {
      await cargar();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [establecimiento]);

  const abrirAlta = () => {
    setEditando(null);
    reset({ nombre: "", hectareas: "", plantas: "", observaciones: "" });
    setShowModal(true);
  };

  const abrirEditar = (l) => {
    setEditando(l._id);
    reset({
      nombre: l.nombre || "",
      hectareas: l.hectareas ?? "",
      plantas: l.plantas ?? "",
      observaciones: l.observaciones || "",
    });
    setShowModal(true);
  };

  const cerrarModal = () => {
    setShowModal(false);
    setEditando(null);
    reset();
  };

  const onSubmit = async (data) => {
    try {
      const res = await fetch(editando ? `${API}/${editando}` : API, {
        method: editando ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...data, establecimiento }),
      });
      if (res.ok) {
        cerrarModal();
        await cargar();
        Swal.fire({
          icon: "success",
          title: editando ? "Lote actualizado" : "Lote cargado",
          timer: 1300,
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

  const borrar = async (l) => {
    const { isConfirmed } = await Swal.fire({
      title: "¿Borrar el lote?",
      text: l.nombre,
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Sí, borrar",
      cancelButtonText: "Cancelar",
      confirmButtonColor: "#dc2626",
      cancelButtonColor: "#64748b",
    });
    if (!isConfirmed) return;
    try {
      const res = await fetch(`${API}/${l._id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      await cargar();
      Swal.fire({ icon: "success", title: "Lote borrado", timer: 1200, showConfirmButton: false });
    } catch {
      Swal.fire({ icon: "error", title: "Error", text: "No se pudo borrar el lote" });
    }
  };

  const filtrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    if (!q) return lotes;
    return lotes.filter((l) =>
      [l.nombre, l.observaciones].filter(Boolean).some((t) => t.toLowerCase().includes(q))
    );
  }, [lotes, busqueda]);

  // El formato común de las tablas (docs/formato-tablas.md).
  const th = {
    backgroundColor: "#1b4332",
    color: "#fff",
    fontSize: "0.66rem",
    fontWeight: 600,
    verticalAlign: "middle",
    padding: "3px 5px",
    whiteSpace: "nowrap",
  };
  const thCentro = { ...th, textAlign: "center" };
  const td = { fontSize: "0.7rem", padding: "1px 5px", verticalAlign: "middle" };
  const tdCentro = { ...td, textAlign: "center" };
  const raya = <span style={{ color: "#cbd5e1" }}>—</span>;
  const campo = { fontSize: "0.85rem" };
  const campoAngosto = { ...campo, maxWidth: "150px" };

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
        style={{ maxWidth: "860px", width: "100%", margin: "0 auto", overflow: "hidden" }}
      >
        {/* Encabezado. El volver está en el navbar de Producción, arriba. */}
        <div className="d-flex align-items-center justify-content-between gap-3 mb-3 flex-wrap">
          <div className="d-flex align-items-center gap-2">
            <div
              className="rounded-3 d-flex align-items-center justify-content-center"
              style={{
                width: "34px",
                height: "34px",
                backgroundColor: "#b45309",
                color: "#fff",
                fontSize: "1.1rem",
                boxShadow: "0 2px 8px rgba(180, 83, 9, 0.3)",
              }}
            >
              <i className="bi bi-map-fill"></i>
            </div>
            <span className="fw-bold" style={{ color: "#1b4332", fontSize: "1rem" }}>
              Lotes
            </span>
          </div>

          <Button
            size="sm"
            onClick={abrirAlta}
            disabled={sinEditar}
            title={sinEditar ? "Sin permiso para editar" : "Cargar un lote"}
            className="d-inline-flex align-items-center gap-1 rounded-3 px-3 shadow-sm"
            style={{ backgroundColor: "#1b4332", borderColor: "#1b4332", fontSize: "0.82rem", fontWeight: 600 }}
          >
            <i className="bi bi-plus-lg"></i>
            <span>Nuevo lote</span>
          </Button>
        </div>

        {/* Buscador */}
        <Card className="mb-3 p-2 shadow-sm border-0 rounded-3">
          <div className="d-flex align-items-center gap-3 flex-wrap">
            <div style={{ width: "240px" }}>
              <div className="input-group input-group-sm">
                <span
                  className="input-group-text bg-light border-end-0 text-muted"
                  style={{ padding: "3px 9px", height: "32px" }}
                >
                  <i className="bi bi-search" style={{ fontSize: "0.8rem" }}></i>
                </span>
                <Form.Control
                  type="text"
                  placeholder="Buscar lote..."
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
            {busqueda && (
              <span className="text-muted" style={{ fontSize: "0.78rem" }}>
                {filtrados.length} de {lotes.length}
              </span>
            )}
          </div>
        </Card>

        <div
          className="shadow-sm rounded-3 bg-white"
          style={{
            flex: "1 1 auto",
            minHeight: 0,
            alignSelf: "center",
            maxWidth: "100%",
            overflowY: "auto",
            overflowX: "auto",
            border: "1px solid #cbd5e1",
          }}
        >
          <Table className="mb-0 tabla-informe" style={{ width: "auto", minWidth: "640px" }}>
            <thead style={{ position: "sticky", top: 0, zIndex: 10 }}>
              <tr>
                <th style={{ ...thCentro, width: "44px" }}>#</th>
                <th style={th}>Lote</th>
                <th style={thCentro}>
                  Hectáreas
                  <div style={{ fontSize: "0.6rem", fontWeight: 400, opacity: 0.75 }}>ha</div>
                </th>
                <th style={thCentro}>
                  Plantas
                  <div style={{ fontSize: "0.6rem", fontWeight: 400, opacity: 0.75 }}>un</div>
                </th>
                <th style={th}>Observaciones</th>
                <th style={{ ...thCentro, width: "90px" }}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filtrados.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center text-muted py-4" style={td}>
                    {cargando
                      ? "Cargando…"
                      : busqueda
                        ? "Ningún lote coincide con la búsqueda"
                        : "No hay lotes cargados"}
                  </td>
                </tr>
              ) : (
                filtrados.map((l, idx) => (
                    <tr key={l._id}>
                      <td style={{ ...tdCentro, color: "#94a3b8" }}>{idx + 1}</td>
                      <td style={{ ...td, fontWeight: 600, color: "#1e293b" }}>{l.nombre}</td>
                      <td style={tdCentro}>{numero(l.hectareas) ?? raya}</td>
                      <td style={tdCentro}>{numero(l.plantas, 0) ?? raya}</td>
                      <td style={{ ...td, color: "#64748b" }}>{l.observaciones || raya}</td>
                      <td style={tdCentro}>
                        <div className="d-flex justify-content-center align-items-center" style={{ gap: "8px" }}>
                          <button
                            onClick={() => abrirEditar(l)}
                            disabled={sinEditar}
                            className="btn btn-sm btn-outline-primary d-flex align-items-center justify-content-center rounded-2 p-0"
                            style={{ width: "24px", height: "24px" }}
                            title={sinEditar ? "Sin permiso para editar" : "Editar"}
                          >
                            <i className="bi bi-pencil" style={{ fontSize: "0.75rem" }}></i>
                          </button>
                          <button
                            onClick={() => borrar(l)}
                            disabled={sinEditar}
                            className="btn btn-sm btn-outline-danger d-flex align-items-center justify-content-center rounded-2 p-0"
                            style={{ width: "24px", height: "24px" }}
                            title={sinEditar ? "Sin permiso para editar" : "Borrar"}
                          >
                            <i className="bi bi-trash" style={{ fontSize: "0.75rem" }}></i>
                          </button>
                        </div>
                      </td>
                    </tr>
                ))
              )}
            </tbody>
          </Table>
        </div>
      </Container>

      {/* Alta / edición */}
      <Modal show={showModal} onHide={cerrarModal} centered contentClassName="border-0 shadow-lg rounded-4">
        <Modal.Header
          closeButton
          closeVariant="white"
          style={{
            backgroundColor: "#b45309",
            color: "#fff",
            borderTopLeftRadius: "1rem",
            borderTopRightRadius: "1rem",
            borderBottom: "1px solid rgba(255,255,255,0.1)",
          }}
        >
          <Modal.Title className="fs-6 fw-bold d-flex align-items-center gap-2 text-white">
            <i className="bi bi-map-fill" style={{ color: "#fde68a" }}></i>
            <span>{editando ? "Editar lote" : "Nuevo lote"}</span>
          </Modal.Title>
        </Modal.Header>
        <Form onSubmit={handleSubmit(onSubmit)}>
          <Modal.Body className="p-4">
            <Row className="g-3">
              <Col md={12}>
                <Form.Label className="fw-semibold text-dark small mb-1">
                  Lote <span className="text-danger">*</span>
                </Form.Label>
                <Form.Control
                  className="rounded-3"
                  style={{ ...campo, maxWidth: "220px" }}
                  placeholder="Nombre o número del lote"
                  {...register("nombre", { required: "Hay que ponerle nombre al lote" })}
                  isInvalid={!!errors.nombre}
                />
                <Form.Control.Feedback type="invalid" style={{ fontSize: "0.78rem" }}>
                  {errors.nombre?.message}
                </Form.Control.Feedback>
              </Col>

              {/* Las dos medidas con las que se paga: la tarea define cuál. */}
              <Col xs={6}>
                <Form.Label className="fw-semibold text-dark small mb-1">Hectáreas</Form.Label>
                <Form.Control
                  type="number"
                  step="any"
                  min={0}
                  className="rounded-3"
                  style={campoAngosto}
                  placeholder="0"
                  {...register("hectareas", { min: { value: 0, message: "No puede ser negativo" } })}
                  isInvalid={!!errors.hectareas}
                />
                <Form.Control.Feedback type="invalid" style={{ fontSize: "0.78rem" }}>
                  {errors.hectareas?.message}
                </Form.Control.Feedback>
              </Col>

              <Col xs={6}>
                <Form.Label className="fw-semibold text-dark small mb-1">Plantas</Form.Label>
                <Form.Control
                  type="number"
                  step="1"
                  min={0}
                  className="rounded-3"
                  style={campoAngosto}
                  placeholder="0"
                  {...register("plantas", { min: { value: 0, message: "No puede ser negativo" } })}
                  isInvalid={!!errors.plantas}
                />
                <Form.Control.Feedback type="invalid" style={{ fontSize: "0.78rem" }}>
                  {errors.plantas?.message}
                </Form.Control.Feedback>
              </Col>

              <Col md={12}>
                <Form.Label className="fw-semibold text-dark small mb-1">Observaciones</Form.Label>
                <Form.Control
                  as="textarea"
                  rows={2}
                  className="rounded-3"
                  style={{ ...campo, maxWidth: "320px" }}
                  placeholder="Variedad, edad de la plantación…"
                  {...register("observaciones")}
                />
              </Col>
            </Row>
          </Modal.Body>
          <Modal.Footer
            className="bg-light border-0 py-2 px-4"
            style={{ borderBottomLeftRadius: "1rem", borderBottomRightRadius: "1rem" }}
          >
            <Button
              variant="outline-secondary"
              size="sm"
              onClick={cerrarModal}
              className="rounded-3 px-3"
              style={{ fontSize: "0.84rem" }}
            >
              Cancelar
            </Button>
            <Button
              size="sm"
              type="submit"
              disabled={sinEditar}
              title={sinEditar ? "Sin permiso para editar" : "Guardar"}
              className="rounded-3 px-3 shadow-sm d-flex align-items-center gap-1"
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

export default ProduccionLotes;
