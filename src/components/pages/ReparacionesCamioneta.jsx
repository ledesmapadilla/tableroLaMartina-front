import { useEffect, useState, useMemo } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { Container, Button, Table, Form, Row, Col } from "react-bootstrap";
import Swal from "sweetalert2";

const formatF = (iso) =>
  iso ? new Date(iso + "T12:00:00").toLocaleDateString("es-AR") : "—";

const PRIORIDADES = ["Normal", "Urgente", "Crítico"];
const ESTADOS = ["Pendiente", "En proceso", "Terminado"];
const COLOR_ESTADO = { Pendiente: "#6c757d", "En proceso": "#ffc107", Terminado: "#198754" };

const RESPONSABLES = ["Zamorano", "Mauricio", "Nelson", "Juan José", "Nacho", "Agustín"];
const ESTADOS_REP = ["Pedido", "Pendiente", "En taller", "Colocado"];
const COLOR_ESTADO_REP = {
  Pedido: "#0dcaf0",
  Pendiente: "#6c757d",
  "En taller": "#fd7e14",
  Colocado: "#198754",
};

const pesos = (n) =>
  (Number(n) || 0).toLocaleString("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0,
  });

const InputMoneda = ({ value, onChange }) => (
  <Form.Control
    size="sm"
    type="text"
    inputMode="numeric"
    value={Number(value) ? pesos(value) : ""}
    onChange={(e) => onChange(Number(e.target.value.replace(/[^\d]/g, "")) || 0)}
  />
);

const hoy = () => new Date().toISOString().split("T")[0];
const filaVacia = (defaultResp = "") => ({
  id: crypto.randomUUID(),
  fecha: hoy(),
  reparacion: "",
  descripcion: "",
  parte: "",
  prioridad: "Normal",
  color: "#3a7070",
  estado: "Pendiente",
  responsable: defaultResp,
  maquinaParada: false,
  observaciones: "",
  repuestos: [],
});

const repuestoVacio = () => ({
  id: crypto.randomUUID(),
  repuesto: "",
  cantidad: 1,
  precio: 0,
  proveedor: "",
  responsable: "",
  estado: "Pedido",
  observaciones: "",
});

function ReparacionesCamioneta() {
  const navigate = useNavigate();
  const { camionetaId } = useParams();
  const { state } = useLocation();
  const patente = state?.patente ?? "—";
  const marca   = state?.marca   ?? "";

  const [filas, setFilas] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [editandoId, setEditandoId] = useState(null);

  const [filtroReparacion, setFiltroReparacion] = useState("");
  const [filtroResponsable, setFiltroResponsable] = useState("");
  const [filtroEstado, setFiltroEstado] = useState("activas");

  const [detalleSel, setDetalleSel] = useState(null);
  const [repuestosSel, setRepuestosSel] = useState(null);
  const [observacionesSel, setObservacionesSel] = useState(null);

  const [responsablesAlta, setResponsablesAlta] = useState([]);
  const [responsableDefault, setResponsableDefault] = useState("");
  const [otroRespMain, setOtroRespMain] = useState(() => new Set());

  // Cargar datos existentes y adaptarlos
  useEffect(() => {
    setCargando(true);
    Promise.all([
      fetch(`/api/trabajos-camioneta/${camionetaId}`).then((r) => r.json()),
      fetch("/api/camionetas").then((r) => r.json())
    ])
      .then(([trabajosData, camionetasData]) => {
        if (Array.isArray(camionetasData)) {
          const currentCamioneta = camionetasData.find((c) => String(c._id) === String(camionetaId));
          if (currentCamioneta?.responsable) {
            setResponsableDefault(currentCamioneta.responsable);
          }
          const list = [...new Set(camionetasData.map((c) => c.responsable).filter(Boolean))].sort((a, b) => a.localeCompare(b));
          setResponsablesAlta(list);
        }

        const items = (Array.isArray(trabajosData) ? trabajosData : []).map((t) => ({
          id: t._id,
          fecha: t.fecha ? t.fecha.split("T")[0] : "",
          reparacion: t.reparacion || t.descripcion || "",
          descripcion: t.descripcion && t.reparacion ? t.descripcion : (t.detalle || ""),
          parte: t.parte || "",
          prioridad: t.prioridad || (t.urgencia === "alta" ? "Crítico" : t.urgencia === "media" ? "Urgente" : "Normal"),
          estado: t.estado ? (t.estado === "terminada" ? "Terminado" : t.estado === "en proceso" ? "En proceso" : t.estado === "pendiente" ? "Pendiente" : t.estado) : "Pendiente",
          responsable: t.responsable || "",
          maquinaParada: !!t.maquinaParada,
          observaciones: t.observaciones || "",
          repuestos: (t.repuestos || []).map((r) => ({
            id: r._id || crypto.randomUUID(),
            repuesto: r.repuesto || r.nombre || "",
            cantidad: r.cantidad || 1,
            precio: r.precio || r.costo || 0,
            proveedor: r.proveedor || "",
            responsable: r.responsable || "",
            estado: r.estado || "Pedido",
            observaciones: r.observaciones || "",
          })),
        }));
        setFilas(items);
      })
      .catch((e) => {
        console.error("Error loading data:", e);
        setFilas([]);
      })
      .finally(() => setCargando(false));
  }, [camionetaId]);

  // Manejar el cierre con Esc
  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") setEditandoId(null); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const agregar = () => {
    const nueva = filaVacia(responsableDefault);
    setFilas((p) => [...p, nueva]);
    setEditandoId(nueva.id);
  };

  const editar = (id, campo, valor) =>
    setFilas((p) => p.map((f) => (f.id === id ? { ...f, [campo]: valor } : f)));

  const borrar = async (id) => {
    const { isConfirmed } = await Swal.fire({
      title: "¿Eliminar reparación?",
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#7a4040",
      confirmButtonText: "Sí, borrar",
      cancelButtonText: "Cancelar",
    });
    if (!isConfirmed) return;

    const isNew = String(id).length !== 24;

    if (isNew) {
      setFilas((p) => p.filter((f) => f.id !== id));
      setEditandoId((prev) => (prev === id ? null : prev));
      Swal.fire({ icon: "success", title: "Reparación eliminada", timer: 1500, showConfirmButton: false });
      return;
    }

    try {
      const res = await fetch(`/api/trabajos-camioneta/${id}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        throw new Error("No se pudo eliminar la reparación de la base de datos.");
      }

      setFilas((p) => p.filter((f) => f.id !== id));
      setEditandoId((prev) => (prev === id ? null : prev));
      Swal.fire({ icon: "success", title: "Reparación eliminada", timer: 1500, showConfirmButton: false });
    } catch (e) {
      console.error(e);
      Swal.fire({ icon: "error", title: "Error", text: e.message });
    }
  };

  const finalizarEdicion = async () => {
    const fila = filas.find((f) => f.id === editandoId);
    if (fila && !(fila.reparacion || "").trim()) {
      return Swal.fire({ icon: "warning", title: "Atención", text: "La reparación es obligatoria." });
    }

    const body = {
      camioneta: camionetaId,
      fecha: fila.fecha,
      reparacion: fila.reparacion,
      descripcion: fila.descripcion,
      parte: fila.parte || "",
      prioridad: fila.prioridad,
      estado: fila.estado,
      responsable: fila.responsable || "",
      observaciones: fila.observaciones,
      maquinaParada: !!fila.maquinaParada,
      repuestos: (fila.repuestos || []).map((r) => ({
        repuesto: r.repuesto,
        cantidad: Number(r.cantidad) || 1,
        precio: Number(r.precio) || 0,
        proveedor: r.proveedor || "",
        responsable: r.responsable || "",
        estado: r.estado || "Pedido",
        observaciones: r.observaciones || "",
      })),
    };

    const isNew = String(fila.id).length !== 24;

    try {
      const url = isNew ? "/api/trabajos-camioneta" : `/api/trabajos-camioneta/${fila.id}`;
      const method = isNew ? "POST" : "PUT";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        throw new Error("No se pudo guardar la reparación en la base de datos.");
      }

      const saved = await res.json();
      
      setFilas((prev) =>
        prev.map((f) =>
          f.id === editandoId
            ? {
                ...f,
                id: saved._id,
                repuestos: (saved.repuestos || []).map((sr) => ({
                  id: sr._id,
                  repuesto: sr.repuesto || "",
                  cantidad: sr.cantidad || 1,
                  precio: sr.precio || 0,
                  proveedor: sr.proveedor || "",
                  responsable: sr.responsable || "",
                  estado: sr.estado || "Pedido",
                  observaciones: sr.observaciones || "",
                })),
              }
            : f
        )
      );

      setEditandoId(null);
      Swal.fire({ icon: "success", title: "Reparación guardada", timer: 1500, showConfirmButton: false });
    } catch (e) {
      console.error(e);
      Swal.fire({ icon: "error", title: "Error", text: e.message });
    }
  };

  const verObservacion = (texto) =>
    Swal.fire({
      title: "Observaciones / Descripción",
      text: texto,
      confirmButtonText: "Cerrar",
      confirmButtonColor: "#6c757d",
    });

  const reparacionesUnicas = useMemo(
    () => [...new Set(filas.map((f) => f.reparacion).filter(Boolean))].sort((a, b) => a.localeCompare(b)),
    [filas]
  );
  const responsablesUnicos = useMemo(
    () => [...new Set(filas.map((f) => f.responsable).filter(Boolean))].sort((a, b) => a.localeCompare(b)),
    [filas]
  );
  const filasFiltradas = useMemo(
    () =>
      filas.filter(
        (f) =>
          f.id === editandoId ||
          ((!filtroReparacion || f.reparacion === filtroReparacion) &&
            (!filtroResponsable || f.responsable === filtroResponsable) &&
            (filtroEstado === "" ||
              (filtroEstado === "activas"
                ? f.estado === "Pendiente" || f.estado === "En proceso"
                : f.estado === filtroEstado)))
      ),
    [filas, filtroReparacion, filtroResponsable, filtroEstado, editandoId]
  );

  const exportarExcel = () => {
    Swal.fire({
      icon: "info",
      title: "Exportar Excel",
      text: "La exportación en este formato planilla está en desarrollo.",
      confirmButtonColor: "#3a7070",
    });
  };

  if (detalleSel) {
    const isEditMode = editandoId === detalleSel.id;
    return (
      <DetalleReparacion
        patente={patente}
        marca={marca}
        reparacion={detalleSel}
        readOnly={!isEditMode}
        onVolver={() => setDetalleSel(null)}
        onGuardar={(texto) => {
          setFilas((prev) =>
            prev.map((f) => (f.id === detalleSel.id ? { ...f, descripcion: texto } : f))
          );
          return { ok: true };
        }}
      />
    );
  }

  if (repuestosSel) {
    const fila = filas.find((f) => f.id === repuestosSel);
    const isEditMode = editandoId === repuestosSel;
    return (
      <DetalleRepuestos
        patente={patente}
        marca={marca}
        reparacion={fila}
        readOnly={!isEditMode}
        onVolver={() => setRepuestosSel(null)}
        onGuardar={(reps) => {
          setFilas((prev) =>
            prev.map((f) => (f.id === repuestosSel ? { ...f, repuestos: reps } : f))
          );
          return { ok: true };
        }}
      />
    );
  }

  if (observacionesSel) {
    const fila = filas.find((f) => f.id === observacionesSel);
    const isEditMode = editandoId === observacionesSel;
    return (
      <DetalleObservaciones
        patente={patente}
        marca={marca}
        reparacion={fila}
        readOnly={!isEditMode}
        onVolver={() => setObservacionesSel(null)}
        onGuardar={(texto) => {
          setFilas((prev) =>
            prev.map((f) => (f.id === observacionesSel ? { ...f, observaciones: texto } : f))
          );
          return { ok: true };
        }}
      />
    );
  }

  return (
    <Container className="py-4">
      {/* Botones */}
      <div className="d-flex justify-content-end gap-2 w-100 mb-4">
        <Button onClick={() => navigate(-1)} style={{ backgroundColor: "#fff", border: "1px solid #000", color: "#000" }}>
          <i className="bi bi-arrow-left me-2"></i>Volver
        </Button>
        <Button onClick={() => navigate("/camionetas/resumen")} style={{ backgroundColor: "#fff", border: "1px solid #000", color: "#000" }}>
          <i className="bi bi-speedometer me-2"></i>Tablero
        </Button>
        <Button onClick={() => navigate("/")} style={{ backgroundColor: "#fff", border: "1px solid #000", color: "#000" }}>
          <i className="bi bi-house-fill me-2"></i>General
        </Button>
        <Button onClick={exportarExcel} disabled={filasFiltradas.length === 0} style={{ backgroundColor: "#1d6f42", border: "1px solid #1d6f42", color: "#fff" }}>
          <i className="bi bi-file-earmark-excel me-2"></i>Excel
        </Button>
      </div>

      {/* Título */}
      <div className="text-center mb-4">
        <h3 className="fw-bold mb-0">Reparaciones camioneta: {patente}{marca ? ` — ${marca}` : ""}</h3>
      </div>

      {/* Agregar reparación */}
      <div className="mb-4">
        <Button variant="outline-primary" size="sm" onClick={agregar}>
          <i className="bi bi-plus-lg me-1"></i>Agregar reparación
        </Button>
      </div>

      {/* Filtros */}
      <div className="d-flex gap-2 mb-3 flex-wrap">
        <div className="position-relative" style={{ width: 220 }}>
          <Form.Select
            size="sm"
            value={filtroEstado}
            onChange={(e) => setFiltroEstado(e.target.value)}
          >
            <option value="activas">Pendientes y en proceso</option>
            <option value="Pendiente">Pendiente</option>
            <option value="En proceso">En proceso</option>
            <option value="Terminado">Terminado</option>
            <option value="">Todos</option>
          </Form.Select>
        </div>
        <div className="position-relative" style={{ width: 220 }}>
          <Form.Select
            size="sm"
            value={filtroReparacion}
            onChange={(e) => setFiltroReparacion(e.target.value)}
          >
            <option value="">Reparación (todas)</option>
            {reparacionesUnicas.map((r) => (
              <option key={r} value={r}>{r}</option>
            ))}
          </Form.Select>
        </div>
        <div className="position-relative" style={{ width: 220 }}>
          <Form.Select
            size="sm"
            value={filtroResponsable}
            onChange={(e) => setFiltroResponsable(e.target.value)}
          >
            <option value="">Responsable (todos)</option>
            {responsablesUnicos.map((r) => (
              <option key={r} value={r}>{r}</option>
            ))}
          </Form.Select>
        </div>
      </div>

      {cargando ? (
        <div className="text-center py-5">Cargando reparaciones...</div>
      ) : (
        <div style={{ maxHeight: "65vh", overflowY: "auto" }}>
          <Table striped bordered hover size="sm" className="text-center align-middle mb-0" style={{ tableLayout: "fixed", width: "100%", fontSize: "0.78rem" }}>
            <thead className="table-dark" style={{ position: "sticky", top: 0, zIndex: 1 }}>
              <tr className="fw-normal">
                <th className="fw-normal" style={{ width: "9%" }}>Fecha</th>
                <th className="fw-normal" style={{ width: "23%" }}>Reparación</th>
                <th className="fw-normal" style={{ width: "6%" }}>Detalle</th>
                <th className="fw-normal" style={{ width: "9%" }}>Prioridad</th>
                <th className="fw-normal" style={{ width: "9%" }}>Estado</th>
                <th className="fw-normal" style={{ width: "14%" }}>Responsable</th>
                <th className="fw-normal" style={{ width: "7%" }}>Observaciones</th>
                <th className="fw-normal" style={{ width: "7%" }}>Parada</th>
                <th className="fw-normal" style={{ width: "6%" }}>Repuestos</th>
                <th className="fw-normal" style={{ width: "10%" }}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filasFiltradas.length === 0 && (
                <tr>
                  <td colSpan={10} className="text-muted py-3">
                    Sin reparaciones cargadas
                  </td>
                </tr>
              )}
              {filasFiltradas.map((f) => {
                const editando = editandoId === f.id;
                return (
                  <tr key={f.id} style={{ height: "36px" }}>
                    <td>
                      {editando ? (
                        <Form.Control
                          type="date"
                          size="sm"
                          value={f.fecha}
                          onChange={(e) => editar(f.id, "fecha", e.target.value)}
                          style={{ fontSize: "0.72rem", padding: "2px 4px" }}
                        />
                      ) : (
                        f.fecha ? f.fecha.split("-").reverse().join("/") : "-"
                      )}
                    </td>
                    <td className="text-start text-truncate" title={f.reparacion} style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {editando ? (
                        <Form.Control
                          size="sm"
                          value={f.reparacion}
                          onChange={(e) => editar(f.id, "reparacion", e.target.value)}
                          style={{ fontSize: "0.72rem", padding: "2px 4px" }}
                        />
                      ) : (
                        f.reparacion || "-"
                      )}
                    </td>
                    <td>
                      {(() => {
                        const tieneDet = (f.descripcion || "").trim() !== "";
                        if (tieneDet) {
                          return (
                            <Button
                              size="sm"
                              variant="outline-success"
                              style={{ fontSize: "0.7rem", padding: "1px 6px" }}
                              onClick={() => setDetalleSel(f)}
                            >
                              +
                            </Button>
                          );
                        }
                        if (editando) {
                          return (
                            <Button
                              size="sm"
                              variant="outline-secondary"
                              style={{ fontSize: "0.7rem", padding: "1px 6px" }}
                              onClick={() => setDetalleSel(f)}
                            >
                              +
                            </Button>
                          );
                        }
                        return <span className="text-muted">—</span>;
                      })()}
                    </td>
                    <td>
                      {editando ? (
                        <Form.Select
                          size="sm"
                          value={f.prioridad}
                          onChange={(e) => editar(f.id, "prioridad", e.target.value)}
                          style={{ fontSize: "0.72rem", padding: "2px 4px" }}
                        >
                          {PRIORIDADES.map((p) => (
                            <option key={p} value={p}>
                              {p}
                            </option>
                          ))}
                        </Form.Select>
                      ) : (
                        f.prioridad || "-"
                      )}
                    </td>
                    <td>
                      {editando ? (
                        <Form.Select
                          size="sm"
                          value={f.estado}
                          onChange={(e) => editar(f.id, "estado", e.target.value)}
                          style={{ fontSize: "0.72rem", padding: "2px 4px" }}
                        >
                          {ESTADOS.map((s) => (
                            <option key={s} value={s}>
                              {s}
                            </option>
                          ))}
                        </Form.Select>
                      ) : (
                        <span style={{ color: COLOR_ESTADO[f.estado] || "#dee2e6", fontWeight: 600 }}>
                          {f.estado || "-"}
                        </span>
                      )}
                    </td>
                    <td>
                      {editando ? (
                        <>
                          <Form.Select
                            size="sm"
                            value={
                              responsablesAlta.includes(f.responsable)
                                ? f.responsable
                                : (f.responsable || otroRespMain.has(f.id)) ? "__otro__" : ""
                            }
                            onChange={(e) => {
                              const v = e.target.value;
                              if (v === "__otro__") {
                                setOtroRespMain((prev) => new Set(prev).add(f.id));
                                editar(f.id, "responsable", "");
                              } else {
                                setOtroRespMain((prev) => { const n = new Set(prev); n.delete(f.id); return n; });
                                editar(f.id, "responsable", v);
                              }
                            }}
                            style={{ fontSize: "0.72rem", padding: "2px 4px" }}
                          >
                            <option value="">Seleccionar...</option>
                            {responsablesAlta.map((r) => (
                              <option key={r} value={r}>
                                {r}
                              </option>
                            ))}
                            <option value="__otro__">Otro...</option>
                          </Form.Select>
                          {(otroRespMain.has(f.id) || (f.responsable && !responsablesAlta.includes(f.responsable))) && (
                            <Form.Control
                              size="sm"
                              className="mt-1"
                              placeholder="Nombre"
                              value={f.responsable}
                              onChange={(e) => editar(f.id, "responsable", e.target.value)}
                              style={{ fontSize: "0.72rem", padding: "2px 4px" }}
                            />
                          )}
                        </>
                      ) : (
                        f.responsable || "-"
                      )}
                    </td>
                    <td>
                      {(() => {
                        const tieneObs = (f.observaciones || "").trim() !== "";
                        if (tieneObs) {
                          return (
                            <Button
                              size="sm"
                              variant="outline-success"
                              style={{ fontSize: "0.7rem", padding: "1px 6px" }}
                              onClick={() => setObservacionesSel(f.id)}
                            >
                              +
                            </Button>
                          );
                        }
                        if (editando) {
                          return (
                            <Button
                              size="sm"
                              variant="outline-secondary"
                              style={{ fontSize: "0.7rem", padding: "1px 6px" }}
                              onClick={() => setObservacionesSel(f.id)}
                            >
                              +
                            </Button>
                          );
                        }
                        return <span className="text-muted">—</span>;
                      })()}
                    </td>
                    <td>
                      <div className="d-flex justify-content-center">
                        {editando ? (
                          <input
                            type="checkbox"
                            checked={!!f.maquinaParada}
                            onChange={(e) => editar(f.id, "maquinaParada", e.target.checked)}
                            style={{ cursor: "pointer", accentColor: "#ff0000", width: 16, height: 16 }}
                          />
                        ) : f.maquinaParada ? (
                          <i className="bi bi-check-square-fill" style={{ color: "#ff0000", fontSize: 16 }} />
                        ) : (
                          <i className="bi bi-square" style={{ color: "#adb5bd", fontSize: 16 }} />
                        )}
                      </div>
                    </td>
                    <td>
                      {(() => {
                        const tieneReps = (f.repuestos || []).length > 0;
                        if (tieneReps) {
                          return (
                            <Button
                              size="sm"
                              variant="outline-success"
                              style={{ fontSize: "0.7rem", padding: "1px 6px" }}
                              onClick={() => setRepuestosSel(f.id)}
                            >
                              +
                            </Button>
                          );
                        }
                        if (editando) {
                          return (
                            <Button
                              size="sm"
                              variant="outline-secondary"
                              style={{ fontSize: "0.7rem", padding: "1px 6px" }}
                              onClick={() => setRepuestosSel(f.id)}
                            >
                              +
                            </Button>
                          );
                        }
                        return <span className="text-muted">—</span>;
                      })()}
                    </td>
                    <td>
                      <div className="d-flex gap-1 justify-content-center align-items-center flex-wrap">
                        {editando ? (
                          <Button size="sm" variant="outline-success" style={{ fontSize: "0.7rem", padding: "2px 6px" }} onClick={finalizarEdicion}>
                            Listo
                          </Button>
                        ) : (
                          <Button size="sm" variant="outline-warning" style={{ fontSize: "0.7rem", padding: "2px 6px" }} onClick={() => setEditandoId(f.id)}>
                            Editar
                          </Button>
                        )}
                        <Button size="sm" variant="outline-danger" style={{ fontSize: "0.7rem", padding: "2px 6px" }} onClick={() => borrar(f.id)}>
                          Borrar
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        </div>
      )}
    </Container>
  );
}

function DetalleReparacion({ patente, marca, reparacion, readOnly, onVolver, onGuardar }) {
  const r = reparacion || {};
  const [texto, setTexto] = useState(r.descripcion || "");

  const handleGuardar = async () => {
    const res = await onGuardar(texto);
    if (res?.ok) {
      Swal.fire({ icon: "success", title: "Detalle guardado temporalmente", timer: 1200, showConfirmButton: false });
      onVolver();
    }
  };

  const Item = ({ label, value }) => (
    <Col xs={6} md={3} className="mb-3">
      <div className="text-muted small">{label}</div>
      <div className="fw-semibold">{value || "—"}</div>
    </Col>
  );

  return (
    <Container className="py-4">
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h4 className="fw-bold mb-0">
          Detalle de reparación — {patente} {marca}
        </h4>
        <Button onClick={onVolver} style={{ backgroundColor: "#fff", border: "1px solid #000", color: "#000" }}>
          <i className="bi bi-arrow-left me-2"></i>Volver
        </Button>
      </div>

      <div
        className="border rounded p-3 mb-4 bg-light"
        style={{ borderTop: "4px solid #3a7070" }}
      >
        <Row>
          <Item label="Fecha" value={formatF(r.fecha)} />
          <Item label="Reparación" value={r.reparacion} />
          <Item label="Prioridad" value={r.prioridad} />
          <Item label="Estado" value={r.estado} />
        </Row>
      </div>

      <div className="border rounded p-4 bg-white" style={{ borderTop: "4px solid #3a7070" }}>
        <Form.Group className="mb-3">
          <Form.Label className="fw-semibold">Descripción Detallada del Trabajo</Form.Label>
          <Form.Control
            as="textarea"
            rows={8}
            placeholder={readOnly ? "Sin detalle cargado." : "Escriba aquí los detalles o descripción del trabajo realizado..."}
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            disabled={readOnly}
            style={{ fontSize: "0.9rem" }}
          />
        </Form.Group>
        <div className="d-flex justify-content-end gap-2">
          {readOnly ? (
            <Button variant="secondary" size="sm" onClick={onVolver}>
              Cerrar
            </Button>
          ) : (
            <>
              <Button variant="secondary" size="sm" onClick={onVolver}>
                Cancelar
              </Button>
              <Button size="sm" style={{ backgroundColor: "#3a7070", borderColor: "#3a7070", color: "#fff" }} onClick={handleGuardar}>
                Guardar
              </Button>
            </>
          )}
        </div>
      </div>
    </Container>
  );
}

function DetalleObservaciones({ patente, marca, reparacion, readOnly, onVolver, onGuardar }) {
  const [texto, setTexto] = useState(reparacion?.observaciones || "");

  const handleGuardar = async () => {
    const res = await onGuardar(texto);
    if (res?.ok) {
      Swal.fire({ icon: "success", title: "Observaciones guardadas temporalmente", timer: 1200, showConfirmButton: false });
      onVolver();
    }
  };

  return (
    <Container className="py-4">
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h4 className="fw-bold mb-0">
          Observaciones — {reparacion?.reparacion || "reparación"}
          <small className="text-muted ms-2" style={{ fontSize: "1rem", fontWeight: 400 }}>
            {patente} {marca}
          </small>
        </h4>
        <Button onClick={onVolver} style={{ backgroundColor: "#fff", border: "1px solid #000", color: "#000" }}>
          <i className="bi bi-arrow-left me-2"></i>Volver
        </Button>
      </div>

      <div className="border rounded p-4 bg-light" style={{ borderTop: "4px solid #3a7070" }}>
        <Form.Group className="mb-3">
          <Form.Label className="fw-semibold">Notas y Observaciones de la Reparación</Form.Label>
          <Form.Control
            as="textarea"
            rows={8}
            placeholder={readOnly ? "Sin observaciones cargadas." : "Escriba aquí las observaciones o notas detalladas de la reparación..."}
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            disabled={readOnly}
            style={{ fontSize: "0.9rem" }}
          />
        </Form.Group>
        <div className="d-flex justify-content-end gap-2">
          {readOnly ? (
            <Button variant="secondary" size="sm" onClick={onVolver}>
              Cerrar
            </Button>
          ) : (
            <>
              <Button variant="secondary" size="sm" onClick={onVolver}>
                Cancelar
              </Button>
              <Button size="sm" style={{ backgroundColor: "#3a7070", borderColor: "#3a7070", color: "#fff" }} onClick={handleGuardar}>
                Guardar
              </Button>
            </>
          )}
        </div>
      </div>
    </Container>
  );
}

function DetalleRepuestos({ patente, marca, reparacion, readOnly, onVolver, onGuardar }) {
  const [filas, setFilas] = useState(
    (reparacion?.repuestos || []).map((r) => ({ ...r, id: r.id || crypto.randomUUID() }))
  );
  const [editandoId, setEditandoId] = useState(null);
  const [otroResp, setOtroResp] = useState(() => new Set());
  const [nuevas, setNuevas] = useState(() => new Set());

  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") setEditandoId(null); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const agregar = () => {
    const nueva = repuestoVacio();
    setFilas((p) => [...p, nueva]);
    setEditandoId(nueva.id);
    setNuevas((prev) => new Set(prev).add(nueva.id));
  };

  const editar = (id, campo, valor) =>
    setFilas((p) => p.map((f) => (f.id === id ? { ...f, [campo]: valor } : f)));

  const borrar = async (id) => {
    const { isConfirmed } = await Swal.fire({
      title: "¿Eliminar repuesto?",
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#7a4040",
      confirmButtonText: "Sí, borrar",
      cancelButtonText: "Cancelar",
    });
    if (!isConfirmed) return;
    const nuevasLista = filas.filter((f) => f.id !== id);
    const res = await onGuardar(nuevasLista);
    if (res?.ok) {
      setFilas(nuevasLista);
      setEditandoId((prev) => (prev === id ? null : prev));
      Swal.fire({ icon: "success", title: "Repuesto quitado temporalmente", timer: 1200, showConfirmButton: false });
    }
  };

  const finalizarEdicion = async () => {
    const id = editandoId;
    const fila = filas.find((f) => f.id === id);
    if (fila) {
      if (!(fila.repuesto || "").trim())
        return Swal.fire({ icon: "warning", title: "Atención", text: "El repuesto es obligatorio." });
      if (!(Number(fila.cantidad) > 0))
        return Swal.fire({ icon: "warning", title: "Atención", text: "La cantidad es obligatoria." });
      if (!(fila.responsable || "").trim())
        return Swal.fire({ icon: "warning", title: "Atención", text: "El responsable es obligatorio." });
    }
    const esNueva = nuevas.has(id);
    const res = await onGuardar(filas);
    if (res?.ok) {
      setEditandoId(null);
      setNuevas((prev) => { const n = new Set(prev); n.delete(id); return n; });
      Swal.fire({ icon: "success", title: esNueva ? "Repuesto agregado" : "Repuesto editado", timer: 1200, showConfirmButton: false });
    }
  };

  const total = filas.reduce(
    (s, f) => s + (Number(f.cantidad) || 0) * (Number(f.precio) || 0),
    0
  );

  const exportarExcel = () => {
    Swal.fire({
      icon: "info",
      title: "Exportar Excel",
      text: "La exportación en este formato planilla está en desarrollo.",
      confirmButtonColor: "#3a7070",
    });
  };

  return (
    <Container className="py-4">
      <div style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr", alignItems: "center" }} className="mb-3">
        <div></div>
        <h4 className="mb-0 text-center">
          Repuestos - {reparacion?.reparacion || "reparación"}
          <small className="text-muted ms-2" style={{ fontSize: "1rem", fontWeight: 400 }}>
            {patente} {marca}
          </small>
        </h4>
        <div className="d-flex gap-2 justify-content-end">
          <Button variant="outline-dark" size="sm" onClick={exportarExcel}>
            Excel
          </Button>
          <Button variant="outline-success" size="sm" onClick={onVolver}>
            Volver
          </Button>
        </div>
      </div>

      {!readOnly && (
        <div className="mb-4">
          <Button variant="outline-primary" size="sm" onClick={agregar}>
            Agregar repuesto
          </Button>
        </div>
      )}

      <div style={{ maxHeight: "65vh", overflowY: "auto" }}>
        <Table striped bordered hover size="sm" className="text-center align-middle mb-0" style={{ fontSize: "0.78rem" }}>
          <thead className="table-dark" style={{ position: "sticky", top: 0, zIndex: 1 }}>
            <tr className="fw-normal">
              <th className="fw-normal" style={{ width: 40 }}>#</th>
              <th className="fw-normal">Repuesto</th>
              <th className="fw-normal" style={{ width: 110 }}>Cantidad</th>
              <th className="fw-normal" style={{ width: 150 }}>Precio</th>
              <th className="fw-normal" style={{ width: 200 }}>Proveedor</th>
              <th className="fw-normal" style={{ width: 180 }}>Responsable</th>
              <th className="fw-normal" style={{ width: 140 }}>Estado</th>
              <th className="fw-normal" style={{ width: 220 }}>Observaciones</th>
              {!readOnly && <th className="fw-normal" style={{ width: 160 }}>Acciones</th>}
            </tr>
          </thead>
          <tbody>
            {filas.length === 0 && (
              <tr>
                <td colSpan={readOnly ? 8 : 9} className="text-muted py-3">
                  Sin repuestos cargados
                </td>
              </tr>
            )}
            {filas.map((f, idx) => {
              const editando = editandoId === f.id;
              return (
                <tr key={f.id}>
                  <td className="text-muted">{idx + 1}</td>
                  <td className="text-start">
                    {editando ? (
                      <Form.Control
                        size="sm"
                        value={f.repuesto}
                        onChange={(e) => editar(f.id, "repuesto", e.target.value)}
                      />
                    ) : (
                      f.repuesto || "-"
                    )}
                  </td>
                  <td>
                    {editando ? (
                      <Form.Control
                        type="number"
                        size="sm"
                        value={f.cantidad}
                        onChange={(e) => editar(f.id, "cantidad", e.target.value)}
                      />
                    ) : (
                      Number(f.cantidad) || 0
                    )}
                  </td>
                  <td>
                    {editando ? (
                      <InputMoneda
                        value={f.precio}
                        onChange={(v) => editar(f.id, "precio", v)}
                      />
                    ) : (
                      pesos(f.precio)
                    )}
                  </td>
                  <td>
                    {editando ? (
                      <Form.Control
                        size="sm"
                        value={f.proveedor}
                        onChange={(e) => editar(f.id, "proveedor", e.target.value)}
                      />
                    ) : (
                      f.proveedor || "-"
                    )}
                  </td>
                  <td>
                    {editando ? (
                      <>
                        <Form.Select
                          size="sm"
                          value={
                            RESPONSABLES.includes(f.responsable)
                              ? f.responsable
                              : (f.responsable || otroResp.has(f.id)) ? "__otro__" : ""
                          }
                          onChange={(e) => {
                            const v = e.target.value;
                            if (v === "__otro__") {
                              setOtroResp((prev) => new Set(prev).add(f.id));
                              editar(f.id, "responsable", "");
                            } else {
                              setOtroResp((prev) => { const n = new Set(prev); n.delete(f.id); return n; });
                              editar(f.id, "responsable", v);
                            }
                          }}
                        >
                          <option value="">Seleccionar...</option>
                          {RESPONSABLES.map((r) => (
                            <option key={r} value={r}>{r}</option>
                          ))}
                          <option value="__otro__">Otro...</option>
                        </Form.Select>
                        {(otroResp.has(f.id) || (f.responsable && !RESPONSABLES.includes(f.responsable))) && (
                          <Form.Control
                            size="sm"
                            className="mt-1"
                            placeholder="Nombre"
                            value={f.responsable}
                            onChange={(e) => editar(f.id, "responsable", e.target.value)}
                          />
                        )}
                      </>
                    ) : (
                      f.responsable || "-"
                    )}
                  </td>
                  <td>
                    {editando ? (
                      <Form.Select
                        size="sm"
                        value={f.estado || "Pedido"}
                        onChange={(e) => editar(f.id, "estado", e.target.value)}
                      >
                        {ESTADOS_REP.map((s) => (
                          <option key={s} value={s}>
                            {s}
                          </option>
                        ))}
                      </Form.Select>
                    ) : (
                      <span style={{ color: COLOR_ESTADO_REP[f.estado] || "#dee2e6", fontWeight: 600 }}>
                        {f.estado || "-"}
                      </span>
                    )}
                  </td>
                  <td className={editando ? "" : "text-start"}>
                    {editando ? (
                      <Form.Control
                        size="sm"
                        value={f.observaciones || ""}
                        onChange={(e) => editar(f.id, "observaciones", e.target.value)}
                      />
                    ) : (
                      f.observaciones || "-"
                    )}
                  </td>
                  {!readOnly && (
                    <td>
                      <div className="d-flex gap-1 justify-content-center align-items-center">
                        {editando ? (
                          <Button size="sm" variant="outline-success" onClick={finalizarEdicion}>
                            Listo
                          </Button>
                        ) : (
                          <Button size="sm" variant="outline-warning" onClick={() => setEditandoId(f.id)}>
                            Editar
                          </Button>
                        )}
                        <Button size="sm" variant="outline-danger" onClick={() => borrar(f.id)}>
                          Borrar
                        </Button>
                      </div>
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
          {filas.length > 0 && (
            <tfoot>
              <tr className="table-dark">
                <td className="text-end" colSpan={3}>
                  Total
                </td>
                <td>{pesos(total)}</td>
                <td colSpan={readOnly ? 4 : 5} />
              </tr>
            </tfoot>
          )}
        </Table>
      </div>
    </Container>
  );
}

export default ReparacionesCamioneta;
