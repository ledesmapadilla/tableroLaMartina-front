import { useEffect, useMemo, useState } from "react";
import Swal from "sweetalert2";
import { Container, Table, Button, Form, Modal, Row, Col, Card } from "react-bootstrap";
import { useForm, useWatch } from "react-hook-form";
import { usePermisos } from "../../context/permisos";

const API = "/api/admisibles";
const API_TAREAS = "/api/tareas";

// El índigo de la tarjeta de Variables (ProduccionVariablesMenu).
const COLOR = "#4f46e5";
const COLOR_OSCURO = "#3730a3";

const numero = (v, decimales = 2) =>
  v === null || v === undefined || v === ""
    ? null
    : Number(v).toLocaleString("es-AR", { maximumFractionDigits: decimales });

// Unidades por litro: el rendimiento por hora dividido el consumo por hora.
// Sin alguno de los dos (o con consumo cero) no hay cuenta.
const porLitro = (rendimiento, consumo) => {
  const r = Number(rendimiento), c = Number(consumo);
  if (rendimiento === "" || rendimiento === null || rendimiento === undefined) return null;
  if (!(c > 0) || !Number.isFinite(r)) return null;
  return r / c;
};

// "Otra" es el cajón de sastre: va al final, como en la planilla.
const esOtra = (t) => /^otra$/i.test((t.tarea || "").trim());

/**
 * Valores admisibles (24/09/2026): por cada tarea, el consumo que se acepta
 * como normal y el rendimiento esperado. Contra ellos se mide el desvío.
 *
 * Están todas las tareas del alta, tengan o no valores: se cargan y se
 * corrigen con el lápiz de cada fila. El rendimiento 2 (unidad por litro) no
 * se carga: es el rendimiento por hora dividido el consumo por hora.
 *
 * Como Remuneración, vale para todos los campos y todos los meses.
 */
function ProduccionAdmisibles() {
  // Ver sin editar (tabla de Roles): los botones quedan a la vista pero
  // deshabilitados.
  const { puede } = usePermisos();
  const sinEditar = !puede("produccion.admisibles", "editar");
  const [tareas, setTareas] = useState([]);
  const [admisibles, setAdmisibles] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [busqueda, setBusqueda] = useState("");
  const [editando, setEditando] = useState(null); // la fila abierta en la ventana

  const {
    register,
    handleSubmit,
    reset,
    control,
    formState: { errors },
  } = useForm();

  const cargar = async () => {
    try {
      const [resT, resA] = await Promise.all([fetch(API_TAREAS), fetch(API)]);
      const t = resT.ok ? await resT.json() : [];
      const a = resA.ok ? await resA.json() : [];
      setTareas(Array.isArray(t) ? t : []);
      setAdmisibles(Array.isArray(a) ? a : []);
    } catch {
      setTareas([]);
      setAdmisibles([]);
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    (async () => {
      await cargar();
    })();
  }, []);

  // Una fila por tarea, con sus valores si los tiene.
  const filas = useMemo(() => {
    const porTarea = new Map(admisibles.map((a) => [String(a.tarea?._id || a.tarea), a]));
    const alfabetico = (a, b) =>
      (a.tarea || "").localeCompare(b.tarea || "", "es", { sensitivity: "base", numeric: true });
    return [...tareas.filter((t) => !esOtra(t)).sort(alfabetico), ...tareas.filter(esOtra)].map((t) => {
      const a = porTarea.get(String(t._id));
      return {
        _id: t._id,
        tarea: t.tarea,
        unidad: t.unidad || "",
        consumo: a?.consumo ?? null,
        rendimiento: a?.rendimiento ?? null,
        observaciones: a?.observaciones || "",
        cargado: Boolean(a),
      };
    });
  }, [tareas, admisibles]);

  const filtradas = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    if (!q) return filas;
    return filas.filter((f) =>
      [f.tarea, f.unidad, f.observaciones].filter(Boolean).some((t) => t.toLowerCase().includes(q))
    );
  }, [filas, busqueda]);

  const conValores = filas.filter((f) => f.cargado).length;

  const abrir = (f) => {
    setEditando(f);
    reset({
      consumo: f.consumo ?? "",
      rendimiento: f.rendimiento ?? "",
      observaciones: f.observaciones || "",
    });
  };

  const cerrar = () => {
    setEditando(null);
    reset();
  };

  const onSubmit = async (data) => {
    try {
      const res = await fetch(`${API}/${editando._id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (res.ok) {
        cerrar();
        await cargar();
        Swal.fire({ icon: "success", title: "Valores guardados", timer: 1300, showConfirmButton: false });
      } else {
        const err = await res.json().catch(() => ({}));
        Swal.fire({ icon: "error", title: "Error", text: err.error || "No se pudo guardar" });
      }
    } catch {
      Swal.fire({ icon: "error", title: "Sin conexión", text: "No se pudo conectar con el servidor" });
    }
  };

  const borrar = async (f) => {
    const { isConfirmed } = await Swal.fire({
      title: "¿Borrar los valores?",
      text: `${f.tarea}: la tarea queda sin consumo ni rendimiento admisible`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Sí, borrar",
      cancelButtonText: "Cancelar",
      confirmButtonColor: "#dc2626",
      cancelButtonColor: "#64748b",
    });
    if (!isConfirmed) return;
    try {
      const res = await fetch(`${API}/${f._id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      if (editando) cerrar();
      await cargar();
      Swal.fire({ icon: "success", title: "Valores borrados", timer: 1200, showConfirmButton: false });
    } catch {
      Swal.fire({ icon: "error", title: "Error", text: "No se pudieron borrar los valores" });
    }
  };

  // El rendimiento 2 en vivo, mientras se escribe en la ventana.
  const [rendimientoVivo, consumoVivo] = useWatch({ control, name: ["rendimiento", "consumo"] });
  const vivo = porLitro(rendimientoVivo, consumoVivo);

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
  const sub = { fontSize: "0.6rem", fontWeight: 400, opacity: 0.75 };
  const td = { fontSize: "0.7rem", padding: "1px 5px", verticalAlign: "middle" };
  const tdCentro = { ...td, textAlign: "center" };
  const raya = <span style={{ color: "#cbd5e1" }}>—</span>;
  const campo = { fontSize: "0.85rem" };
  const unidadMin = (u) => (u ? u.toLowerCase() : "un");

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
        style={{ maxWidth: "1020px", width: "100%", margin: "0 auto", overflow: "hidden" }}
      >
        {/* Encabezado. El volver está en el navbar de Producción, arriba. */}
        <div className="d-flex align-items-center gap-2 mb-3 flex-wrap">
          <div
            className="rounded-3 d-flex align-items-center justify-content-center"
            style={{
              width: "34px",
              height: "34px",
              backgroundColor: COLOR,
              color: "#fff",
              fontSize: "1.1rem",
              boxShadow: "0 2px 8px rgba(79, 70, 229, 0.3)",
            }}
          >
            <i className="bi bi-speedometer2"></i>
          </div>
          <span className="fw-bold" style={{ color: "#1b4332", fontSize: "1rem" }}>
            Valores admisibles
          </span>
          <span
            className="px-2 py-1 rounded-3"
            style={{ fontSize: "0.76rem", backgroundColor: "#e8f5ee", color: "#1b4332", fontWeight: 600 }}
          >
            {conValores} de {filas.length} tareas con valores
          </span>
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
                  placeholder="Buscar tarea..."
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
                {filtradas.length} de {filas.length}
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
          <Table className="mb-0 tabla-informe" style={{ width: "auto", minWidth: "860px" }}>
            <thead style={{ position: "sticky", top: 0, zIndex: 10 }}>
              <tr>
                <th style={{ ...thCentro, width: "44px" }}>#</th>
                <th style={th}>Tarea</th>
                <th style={thCentro}>Unidad</th>
                <th style={thCentro}>
                  Consumo admisible
                  <div style={sub}>lts / hs</div>
                </th>
                <th style={thCentro}>
                  Rendimiento
                  <div style={sub}>unidad / hs</div>
                </th>
                <th style={thCentro} title="Rendimiento dividido consumo: se calcula solo">
                  Rendimiento 2
                  <div style={sub}>unidad / lts · calculado</div>
                </th>
                <th style={th}>Observaciones</th>
                <th style={{ ...thCentro, width: "90px" }}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filtradas.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center text-muted py-4" style={td}>
                    {cargando
                      ? "Cargando…"
                      : busqueda
                        ? "Ninguna tarea coincide con la búsqueda"
                        : "No hay tareas dadas de alta"}
                  </td>
                </tr>
              ) : (
                filtradas.map((f, idx) => {
                  const r2 = porLitro(f.rendimiento, f.consumo);
                  return (
                    <tr key={f._id}>
                      <td style={{ ...tdCentro, color: "#94a3b8" }}>{idx + 1}</td>
                      <td style={{ ...td, fontWeight: 600, color: "#1e293b" }}>{f.tarea}</td>
                      <td style={{ ...tdCentro, color: "#64748b" }}>{f.unidad || raya}</td>
                      <td style={tdCentro}>{numero(f.consumo) ?? raya}</td>
                      <td style={tdCentro}>{numero(f.rendimiento) ?? raya}</td>
                      <td style={{ ...tdCentro, fontWeight: 600, color: "#1b4332" }}>
                        {r2 === null ? raya : numero(r2)}
                      </td>
                      <td style={{ ...td, color: "#64748b", whiteSpace: "normal" }}>{f.observaciones || raya}</td>
                      <td style={tdCentro}>
                        <div className="d-flex justify-content-center align-items-center" style={{ gap: "8px" }}>
                          <button
                            onClick={() => abrir(f)}
                            disabled={sinEditar}
                            className="btn btn-sm btn-outline-primary d-flex align-items-center justify-content-center rounded-2 p-0"
                            style={{ width: "24px", height: "24px" }}
                            title={sinEditar ? "Sin permiso para editar" : f.cargado ? "Editar" : "Cargar valores"}
                          >
                            <i className={`bi ${f.cargado ? "bi-pencil" : "bi-plus-lg"}`} style={{ fontSize: "0.75rem" }}></i>
                          </button>
                          <button
                            onClick={() => borrar(f)}
                            disabled={sinEditar || !f.cargado}
                            className="btn btn-sm btn-outline-danger d-flex align-items-center justify-content-center rounded-2 p-0"
                            style={{ width: "24px", height: "24px" }}
                            title={sinEditar ? "Sin permiso para editar" : f.cargado ? "Borrar los valores" : "No tiene valores cargados"}
                          >
                            <i className="bi bi-trash" style={{ fontSize: "0.75rem" }}></i>
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

      {/* Carga / edición de los valores de una tarea */}
      <Modal show={Boolean(editando)} onHide={cerrar} centered contentClassName="border-0 shadow-lg rounded-4">
        <Modal.Header
          closeButton
          closeVariant="white"
          style={{
            backgroundColor: COLOR_OSCURO,
            color: "#fff",
            borderTopLeftRadius: "1rem",
            borderTopRightRadius: "1rem",
            borderBottom: "1px solid rgba(255,255,255,0.1)",
          }}
        >
          <Modal.Title className="fs-6 fw-bold d-flex align-items-center gap-2 text-white">
            <i className="bi bi-speedometer2" style={{ color: "#c7d2fe" }}></i>
            <span>{editando?.tarea}</span>
            {editando?.unidad && (
              <span className="fw-normal" style={{ fontSize: "0.8rem", color: "#c7d2fe" }}>
                · se mide en {editando.unidad.toLowerCase()}
              </span>
            )}
          </Modal.Title>
        </Modal.Header>
        <Form onSubmit={handleSubmit(onSubmit)}>
          <Modal.Body className="p-4">
            <Row className="g-3">
              <Col xs={6}>
                <Form.Label className="fw-semibold text-dark small mb-1">
                  Consumo admisible <span className="text-muted fw-normal">(lts / hs)</span>
                </Form.Label>
                <Form.Control
                  type="number"
                  step="any"
                  min={0}
                  className="rounded-3"
                  style={{ ...campo, maxWidth: "150px" }}
                  placeholder="0"
                  {...register("consumo", { min: { value: 0, message: "No puede ser negativo" } })}
                  isInvalid={!!errors.consumo}
                />
                <Form.Control.Feedback type="invalid" style={{ fontSize: "0.78rem" }}>
                  {errors.consumo?.message}
                </Form.Control.Feedback>
              </Col>

              <Col xs={6}>
                <Form.Label className="fw-semibold text-dark small mb-1">
                  Rendimiento{" "}
                  <span className="text-muted fw-normal">({unidadMin(editando?.unidad)} / hs)</span>
                </Form.Label>
                <Form.Control
                  type="number"
                  step="any"
                  min={0}
                  className="rounded-3"
                  style={{ ...campo, maxWidth: "150px" }}
                  placeholder="0"
                  {...register("rendimiento", { min: { value: 0, message: "No puede ser negativo" } })}
                  isInvalid={!!errors.rendimiento}
                />
                <Form.Control.Feedback type="invalid" style={{ fontSize: "0.78rem" }}>
                  {errors.rendimiento?.message}
                </Form.Control.Feedback>
              </Col>

              {/* El rendimiento 2 no se escribe: se va calculando. */}
              <Col md={12}>
                <Form.Label className="fw-semibold text-dark small mb-1">
                  Rendimiento 2{" "}
                  <span className="text-muted fw-normal">({unidadMin(editando?.unidad)} / lts)</span>
                </Form.Label>
                <div
                  className="rounded-3 px-3 py-2 d-inline-flex align-items-center gap-2"
                  style={{ backgroundColor: "#e8f5ee", color: "#1b4332", fontSize: "0.85rem", minWidth: "150px" }}
                >
                  <span className="fw-bold">{vivo === null ? "—" : numero(vivo)}</span>
                  <span className="text-muted" style={{ fontSize: "0.72rem" }}>
                    = rendimiento ÷ consumo
                  </span>
                </div>
              </Col>

              <Col md={12}>
                <Form.Label className="fw-semibold text-dark small mb-1">Observaciones</Form.Label>
                <Form.Control
                  as="textarea"
                  rows={2}
                  className="rounded-3"
                  style={{ ...campo, maxWidth: "360px" }}
                  placeholder="De dónde sale el valor, con qué máquina…"
                  {...register("observaciones")}
                />
              </Col>
            </Row>
          </Modal.Body>
          <Modal.Footer
            className="bg-light border-0 py-2 px-4"
            style={{ borderBottomLeftRadius: "1rem", borderBottomRightRadius: "1rem" }}
          >
            {editando?.cargado && (
              <Button
                variant="outline-danger"
                size="sm"
                onClick={() => borrar(editando)}
                disabled={sinEditar}
                className="rounded-3 px-3 me-auto d-flex align-items-center gap-1"
                style={{ fontSize: "0.84rem" }}
              >
                <i className="bi bi-trash"></i>
                <span>Borrar valores</span>
              </Button>
            )}
            <Button
              variant="outline-secondary"
              size="sm"
              onClick={cerrar}
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

export default ProduccionAdmisibles;
