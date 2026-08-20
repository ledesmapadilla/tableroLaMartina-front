import { useEffect, useState, useMemo } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { Container, Card, Form, Button, Row, Col, Badge, Table } from "react-bootstrap";
import Swal from "sweetalert2";

// Formateo seguro de fechas sin desfase horario UTC
const formatF = (iso) => {
  if (!iso) return "-";
  const str = typeof iso === "string" ? iso.split("T")[0] : new Date(iso).toISOString().split("T")[0];
  const parts = str.split("-");
  if (parts.length === 3) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }
  return str;
};

const hoyStr = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const ESTADOS = ["Pendiente", "En proceso", "Terminada"];
const ESTADOS_REP = ["Pedido", "Pendiente", "En taller", "Colocado"];

function ReparacionesCamioneta() {
  const navigate = useNavigate();
  const { camionetaId } = useParams();
  const { state } = useLocation();

  const [camioneta, setCamioneta] = useState(null);
  const [trabajos, setTrabajos] = useState([]);
  const [paradas, setParadas] = useState([]);
  const [cargando, setCargando] = useState(true);

  const [filtroEstado, setFiltroEstado] = useState("pendientes_en_proceso"); // 'pendientes_en_proceso' (por defecto) | 'Terminadas' | 'todas'
  const [tareaSeleccionadaId, setTareaSeleccionadaId] = useState(null);
  const [guardandoId, setGuardandoId] = useState(null);

  const patente = camioneta?.patente || state?.patente || "Camioneta";
  const marca = camioneta?.marca || state?.marca || "";

  const cargarDatos = async () => {
    setCargando(true);
    try {
      // Un solo pedido en lugar de tres: camioneta, trabajos y paradas juntos.
      const data = await fetch(`/api/camionetas/${camionetaId}/reparaciones`).then((r) =>
        r.ok ? r.json() : null,
      );

      if (data?.camioneta) setCamioneta(data.camioneta);
      setTrabajos(Array.isArray(data?.trabajos) ? data.trabajos : []);
      setParadas(Array.isArray(data?.paradas) ? data.paradas : []);
    } catch {
      // noop
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    cargarDatos();
  }, [camionetaId]);

  // Verificar si la unidad está parada actualmente
  const paradaAbierta = useMemo(() => {
    return paradas.find((p) => !p.fechaArranque);
  }, [paradas]);

  const tieneTrabajoParada = useMemo(() => {
    return trabajos.some((t) => t.maquinaParada && t.estado !== "Terminada" && t.estado !== "terminada");
  }, [trabajos]);

  const estaParada = Boolean(paradaAbierta || tieneTrabajoParada);

  // Actualizar campo de la tarea seleccionada
  const handleUpdateTarea = (id, campo, valor) => {
    setTrabajos((prev) =>
      prev.map((t) => (t._id === id ? { ...t, [campo]: valor } : t))
    );
  };

  // Guardar tarea en backend con SweetAlert2
  const handleGuardarTarea = async (tarea) => {
    setGuardandoId(tarea._id);
    try {
      // Formateo seguro de fecha a mediodía para evitar cualquier corrimiento UTC
      const fechaLimpia = tarea.fecha
        ? `${String(tarea.fecha).split("T")[0]}T12:00:00.000Z`
        : new Date().toISOString();

      const payload = {
        ...tarea,
        fecha: fechaLimpia,
      };

      const res = await fetch(`/api/trabajos-camioneta/${tarea._id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        setTareaSeleccionadaId(null);

        const esTerminada =
          tarea.estado === "Terminada" ||
          tarea.estado === "terminada" ||
          tarea.estado === "Terminado";

        // Si la camioneta está parada y se termina la tarea, preguntar si se pone en servicio operativo
        if (esTerminada && estaParada) {
          const confirmAlta = await Swal.fire({
            title: "¿Poner en servicio la unidad?",
            text: "La reparación fue marcada como terminada.",
            icon: "question",
            width: "320px",
            showCancelButton: true,
            confirmButtonColor: "#10b981",
            cancelButtonColor: "#64748b",
            confirmButtonText: "Sí, poner en servicio",
            cancelButtonText: "No, mantener parada",
          });

          if (confirmAlta.isConfirmed) {
            const now = new Date().toISOString();
            const promises = [];

            if (paradaAbierta) {
              promises.push(
                fetch(`/api/paradas/${paradaAbierta._id}`, {
                  method: "PUT",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ fechaArranque: now }),
                })
              );
            }

            trabajos
              .filter((t) => t.maquinaParada)
              .forEach((t) => {
                promises.push(
                  fetch(`/api/trabajos-camioneta/${t._id}`, {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ maquinaParada: false }),
                  })
                );
              });

            await Promise.all(promises);
            Swal.fire({
              icon: "success",
              title: "¡Camioneta en servicio!",
              width: "300px",
              timer: 1500,
              showConfirmButton: false,
            });
            cargarDatos();
            return;
          }
        }

        Swal.fire({
          icon: "success",
          title: "Reparación guardada",
          width: "300px",
          timer: 1400,
          showConfirmButton: false,
        });
        cargarDatos();
      } else {
        Swal.fire({
          icon: "error",
          title: "Error",
          text: "No se pudieron guardar los cambios.",
          width: "300px",
          confirmButtonColor: "#1e293b",
        });
      }
    } catch {
      Swal.fire({
        icon: "error",
        title: "Error de conexión",
        width: "300px",
        confirmButtonColor: "#1e293b",
      });
    } finally {
      setGuardandoId(null);
    }
  };

  // Repuestos: Agregar repuesto a la tarea
  const handleAgregarRepuesto = (tareaId) => {
    const nuevoRep = {
      repuesto: "",
      cantidad: 1,
      precio: 0,
      proveedor: "",
      responsable: "",
      estado: "Pedido",
      observaciones: "",
    };

    setTrabajos((prev) =>
      prev.map((t) => {
        if (t._id === tareaId) {
          const actual = Array.isArray(t.repuestos) ? t.repuestos : [];
          return { ...t, repuestos: [...actual, nuevoRep] };
        }
        return t;
      })
    );
  };

  // Repuestos: Actualizar repuesto
  const handleUpdateRepuesto = (tareaId, index, campo, valor) => {
    setTrabajos((prev) =>
      prev.map((t) => {
        if (t._id === tareaId) {
          const reps = [...(t.repuestos || [])];
          reps[index] = { ...reps[index], [campo]: valor };
          return { ...t, repuestos: reps };
        }
        return t;
      })
    );
  };

  // Repuestos: Eliminar repuesto con confirmación SweetAlert2
  const handleEliminarRepuesto = async (tareaId, index) => {
    const result = await Swal.fire({
      title: "¿Desea borrar el repuesto?",
      icon: "warning",
      width: "320px",
      showCancelButton: true,
      confirmButtonColor: "#ef4444",
      cancelButtonColor: "#64748b",
      confirmButtonText: "Sí, borrar",
      cancelButtonText: "Cancelar",
    });

    if (!result.isConfirmed) return;

    setTrabajos((prev) =>
      prev.map((t) => {
        if (t._id === tareaId) {
          const reps = [...(t.repuestos || [])];
          reps.splice(index, 1);
          return { ...t, repuestos: reps };
        }
        return t;
      })
    );

    Swal.fire({
      icon: "success",
      title: "Repuesto borrado",
      width: "280px",
      timer: 1200,
      showConfirmButton: false,
    });
  };

  // Eliminar tarea de reparación desde el listado
  const handleEliminarTarea = async (tareaId, e) => {
    if (e) e.stopPropagation();
    const result = await Swal.fire({
      title: "¿Desea borrar la tarea?",
      icon: "warning",
      width: "320px",
      showCancelButton: true,
      confirmButtonColor: "#ef4444",
      cancelButtonColor: "#64748b",
      confirmButtonText: "Sí, borrar",
      cancelButtonText: "Cancelar",
    });

    if (!result.isConfirmed) return;

    try {
      const res = await fetch(`/api/trabajos-camioneta/${tareaId}`, {
        method: "DELETE",
      });

      if (res.ok) {
        const nuevosTrabajos = trabajos.filter((t) => t._id !== tareaId);
        setTrabajos(nuevosTrabajos);
        if (tareaSeleccionadaId === tareaId) {
          setTareaSeleccionadaId(nuevosTrabajos[0]?._id || null);
        }
        Swal.fire({
          icon: "success",
          title: "Tarea borrada",
          width: "280px",
          timer: 1200,
          showConfirmButton: false,
        });
      } else {
        Swal.fire({
          icon: "error",
          title: "Error",
          width: "300px",
          confirmButtonColor: "#1e293b",
        });
      }
    } catch {
      Swal.fire({
        icon: "error",
        title: "Error de conexión",
        width: "300px",
        confirmButtonColor: "#1e293b",
      });
    }
  };

  // Filtrado de tareas ordenadas por fecha y registro (más recientes arriba de todo)
  const tareasFiltradas = useMemo(() => {
    return [...trabajos]
      .filter((t) => {
        if (filtroEstado === "pendientes_en_proceso") {
          return t.estado !== "Terminada" && t.estado !== "terminada" && t.estado !== "Terminado";
        }
        if (filtroEstado === "Terminadas") {
          return t.estado === "Terminada" || t.estado === "terminada" || t.estado === "Terminado";
        }
        return true;
      })
      .sort((a, b) => {
        const dateA = a.fecha ? new Date(a.fecha).getTime() : 0;
        const dateB = b.fecha ? new Date(b.fecha).getTime() : 0;
        if (dateB !== dateA) {
          return dateB - dateA;
        }
        const createdA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const createdB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        if (createdB !== createdA) {
          return createdB - createdA;
        }
        return String(b._id || "").localeCompare(String(a._id || ""));
      });
  }, [trabajos, filtroEstado]);

  const tareaSeleccionada = useMemo(() => {
    return trabajos.find((t) => t._id === tareaSeleccionadaId) || null;
  }, [trabajos, tareaSeleccionadaId]);

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
        style={{ backgroundColor: "#1e293b", color: "#fff", height: "54px" }}
      >
        <div className="d-flex align-items-center gap-3">
          <div
            className="rounded-3 d-flex align-items-center justify-content-center me-1"
            style={{
              width: "34px",
              height: "34px",
              backgroundColor: "#f59e0b",
              color: "#fff",
              fontSize: "1.15rem",
              boxShadow: "0 2px 8px rgba(245, 158, 11, 0.3)",
            }}
          >
            <i className="bi bi-tools"></i>
          </div>
          <div className="d-flex align-items-center gap-2">
            <span className="text-white fs-6">Tareas</span>
            <span className="text-light opacity-75 small">•</span>
            <span
              className="badge px-3 py-1 fw-bold text-white shadow-sm"
              style={{
                backgroundColor: "#0f172a",
                border: "1px solid #475569",
                fontSize: "0.92rem",
                letterSpacing: "1.2px",
                borderRadius: "8px",
              }}
            >
              {patente}
            </span>
            {marca && <span className="text-light opacity-75 small">• {marca}</span>}
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
            onClick={() => navigate(`/camionetas/services/reparaciones/${camionetaId}`)}
            className="btn btn-sm btn-outline-light d-flex align-items-center gap-2 rounded-3 px-3 py-1"
            style={{ fontSize: "0.82rem" }}
          >
            <i className="bi bi-car-front-fill me-1"></i>
            <span>Menú Camioneta</span>
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

      {/* Banner de Estado de la Camioneta Centrado */}
      <div
        className="px-4 py-2 border-bottom flex-shrink-0 d-flex align-items-center justify-content-center"
        style={{
          backgroundColor: estaParada ? "#fef2f2" : "#f0fdf4",
          borderColor: estaParada ? "#fecaca" : "#bbf7d0",
        }}
      >
        <div className="d-flex align-items-center gap-2">
          {estaParada ? (
            <>
              <i className="bi bi-exclamation-octagon-fill text-danger fs-5"></i>
              <span className="text-danger fw-semibold" style={{ fontSize: "0.88rem" }}>
                Unidad Parada
              </span>
            </>
          ) : (
            <>
              <i className="bi bi-check-circle-fill text-success fs-5"></i>
              <span className="text-success fw-semibold" style={{ fontSize: "0.88rem" }}>
                Unidad Operativa en Servicio
              </span>
            </>
          )}
        </div>
      </div>

      {/* Cuerpo Principal: Master-Detail (Lista de Tareas a la Izq + Detalle de Taller a la Der) */}
      <div className="flex-grow-1 p-3 d-flex gap-3" style={{ overflow: "hidden" }}>
        {/* Panel Izquierdo: Lista de Tareas Cargadas */}
        <div
          className="d-flex flex-column bg-white rounded-4 shadow-sm border p-3 flex-shrink-0"
          style={{ width: "370px", borderColor: "#cbd5e1", overflow: "hidden" }}
        >
          {/* Cabecera de Lista */}
          <div className="d-flex align-items-center justify-content-between mb-2">
            <span className="fw-semibold text-dark small">Tareas Registradas ({trabajos.length})</span>
          </div>

          {/* Píldoras de Filtro (3 en una sola fila horizontal) */}
          <div className="d-flex align-items-center gap-1.5 mb-3 pb-2.5 border-bottom flex-nowrap">
            {[
              { id: "pendientes_en_proceso", label: "Pendientes / En proceso" },
              { id: "Terminadas", label: "Terminadas" },
              { id: "todas", label: "Todas" },
            ].map((f) => (
              <button
                key={f.id}
                onClick={() => setFiltroEstado(f.id)}
                className={`btn btn-sm rounded-pill px-2 py-1 text-nowrap flex-grow-1 text-center ${
                  filtroEstado === f.id ? "btn-dark text-white shadow-sm" : "btn-light text-secondary border"
                }`}
                style={{ fontSize: "0.71rem", letterSpacing: "-0.2px" }}
              >
                {f.label}
              </button>
            ))}
          </div>

          {/* Lista scrolleable de tarjetas de tareas con espaciado cómodo */}
          <div className="flex-grow-1 pe-1" style={{ overflowY: "auto" }}>
            {tareasFiltradas.length === 0 && (
              <div className="text-center py-4 text-muted small">
                <i className="bi bi-clipboard2-check fs-2 d-block mb-1 opacity-50"></i>
                No hay tareas con este filtro.
              </div>
            )}

            {tareasFiltradas.map((t) => {
              const isSelected = tareaSeleccionada?._id === t._id;
              const estado = t.estado || "Pendiente";
              let badgeColor = "bg-secondary";
              if (estado === "En proceso" || estado === "en proceso") badgeColor = "bg-warning text-dark";
              if (estado === "Terminada" || estado === "terminada" || estado === "Terminado") badgeColor = "bg-success";

              return (
                <div
                  key={t._id}
                  onClick={() => setTareaSeleccionadaId(t._id)}
                  className={`p-3 mb-2 rounded-3 border transition-all cursor-pointer ${
                    isSelected ? "border-primary bg-primary-subtle shadow-sm" : "bg-light hover-bg-light"
                  }`}
                  style={{ cursor: "pointer", transition: "all 0.15s ease" }}
                >
                  {/* Fila superior con Fecha, Estado y Botón Borrar bien alineados */}
                  <div className="d-flex align-items-center justify-content-between mb-2">
                    <span className="small text-muted" style={{ fontSize: "0.75rem" }}>
                      {formatF(t.fecha)}
                    </span>
                    <div className="d-flex align-items-center gap-2">
                      <span className={`badge ${badgeColor} rounded-pill px-2 py-1 fw-normal`} style={{ fontSize: "0.68rem", fontWeight: "normal" }}>
                        {estado}
                      </span>
                      <button
                        type="button"
                        onClick={(e) => handleEliminarTarea(t._id, e)}
                        className="btn btn-sm btn-link text-danger p-0 ms-1 opacity-75 hover-opacity-100"
                        title="Eliminar tarea"
                        style={{ lineHeight: 1 }}
                      >
                        <i className="bi bi-trash3" style={{ fontSize: "0.85rem" }}></i>
                      </button>
                    </div>
                  </div>

                  <div className="fw-semibold text-dark text-truncate small mb-1.5" title={t.diagnostico || t.descripcion}>
                    {t.diagnostico || t.descripcion || "Reparación sin título"}
                  </div>

                  <div className="d-flex align-items-center justify-content-between text-muted" style={{ fontSize: "0.72rem" }}>
                    <span>
                      {t.parte || "Mecánica general"}
                      {(t.kilometraje || t.kilometros) ? ` • ${t.kilometraje || t.kilometros} km` : ""}
                    </span>
                    {t.maquinaParada && <span className="text-danger fw-bold">🔴 Parada</span>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Panel Derecho: Área de Diagnóstico y Plan de Reparación */}
        {tareaSeleccionada ? (
          <div
            className="flex-grow-1 bg-white rounded-4 shadow-sm border p-4 d-flex flex-column"
            style={{ borderColor: "#cbd5e1", overflowY: "auto" }}
          >
            {/* Cabecera de la Tarea Activa */}
            <div className="d-flex flex-wrap align-items-center justify-content-between pb-3 mb-3 border-bottom gap-2">
              <div>
                <h5 className="text-dark mb-1 fs-5">
                  Reparación
                </h5>
                <div className="small text-muted" style={{ fontSize: "0.82rem" }}>
                  <div>Fecha de reporte: {formatF(tareaSeleccionada.fecha)}</div>
                  <div className="mt-0.5">
                    Categoría: <span className="fw-semibold text-dark">{tareaSeleccionada.parte || "Mecánica general"}</span>
                    {(tareaSeleccionada.kilometraje || tareaSeleccionada.kilometros) ? (
                      <span className="ms-2">• Kilometraje: <span className="fw-semibold text-dark">{tareaSeleccionada.kilometraje || tareaSeleccionada.kilometros} km</span></span>
                    ) : null}
                  </div>
                </div>
              </div>

              {/* Botón Guardar */}
              <div className="d-flex align-items-center gap-2">
                <Button
                  variant="dark"
                  size="sm"
                  className="rounded-3 px-3 py-1.5 d-flex align-items-center gap-1.5 shadow-sm"
                  style={{ fontSize: "0.84rem" }}
                  disabled={guardandoId === tareaSeleccionada._id}
                  onClick={() => handleGuardarTarea(tareaSeleccionada)}
                >
                  {guardandoId === tareaSeleccionada._id ? (
                    <span>Guardando...</span>
                  ) : (
                    <>
                      <i className="bi bi-floppy-fill me-2"></i>
                      <span>Guardar</span>
                    </>
                  )}
                </Button>
              </div>
            </div>

            {/* Fecha, Kilometraje, Estado del Trabajo, Taller, Nombre Taller y Responsable */}
            <Row className="g-3 mb-3">
              <Col md={tareaSeleccionada.taller === "Tercero" ? 2 : 2}>
                <Form.Group>
                  <Form.Label className="fw-semibold text-dark small mb-1">Fecha</Form.Label>
                  <Form.Control
                    type="date"
                    max={hoyStr()}
                    value={
                      tareaSeleccionada.fecha
                        ? typeof tareaSeleccionada.fecha === "string"
                          ? tareaSeleccionada.fecha.split("T")[0]
                          : new Date(tareaSeleccionada.fecha).toISOString().split("T")[0]
                        : ""
                    }
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val && val > hoyStr()) {
                        handleUpdateTarea(tareaSeleccionada._id, "fecha", hoyStr());
                      } else {
                        handleUpdateTarea(tareaSeleccionada._id, "fecha", val);
                      }
                    }}
                    className="rounded-3 form-control-sm"
                    style={{ fontSize: "0.85rem", height: "36px" }}
                  />
                </Form.Group>
              </Col>

              <Col md={tareaSeleccionada.taller === "Tercero" ? 2 : 2}>
                <Form.Group>
                  <Form.Label className="fw-semibold text-dark small mb-1">Kilometraje (km)</Form.Label>
                  <Form.Control
                    type="number"
                    min="0"
                    step="any"
                    value={tareaSeleccionada.kilometraje ?? tareaSeleccionada.kilometros ?? ""}
                    onChange={(e) => {
                      handleUpdateTarea(tareaSeleccionada._id, "kilometraje", e.target.value);
                      handleUpdateTarea(tareaSeleccionada._id, "kilometros", e.target.value);
                    }}
                    placeholder="Ej. 85000"
                    className="rounded-3 form-control-sm"
                    style={{ fontSize: "0.85rem", height: "36px" }}
                  />
                </Form.Group>
              </Col>

              <Col md={tareaSeleccionada.taller === "Tercero" ? 2 : 2}>
                <Form.Group>
                  <Form.Label className="fw-semibold text-dark small mb-1">Estado</Form.Label>
                  <Form.Select
                    value={tareaSeleccionada.estado || "Pendiente"}
                    onChange={(e) => handleUpdateTarea(tareaSeleccionada._id, "estado", e.target.value)}
                    className="rounded-3 form-select-sm"
                    style={{ fontSize: "0.85rem", height: "36px" }}
                  >
                    <option value="Pendiente">🟡 Pendiente</option>
                    <option value="En proceso">⚙️ En proceso</option>
                    <option value="Terminada">🟢 Terminada</option>
                  </Form.Select>
                </Form.Group>
              </Col>

              <Col md={tareaSeleccionada.taller === "Tercero" ? 2 : 3}>
                <Form.Group>
                  <Form.Label className="fw-semibold text-dark small mb-1">Lugar / Taller</Form.Label>
                  <div className="d-flex align-items-center" style={{ height: "36px" }}>
                    <div
                      className="d-inline-flex align-items-center justify-content-between gap-1 px-2.5 py-1 rounded-3 border bg-light w-100"
                      style={{ fontSize: "0.82rem", height: "36px" }}
                    >
                      <span className={tareaSeleccionada.taller === "Tercero" ? "text-muted" : "fw-semibold text-dark"}>
                        T. propio
                      </span>
                      <Form.Check
                        type="switch"
                        id="taller-toggle-switch"
                        checked={tareaSeleccionada.taller === "Tercero"}
                        onChange={(e) => {
                          const esTercero = e.target.checked;
                          handleUpdateTarea(tareaSeleccionada._id, "taller", esTercero ? "Tercero" : "Taller Propio");
                        }}
                        style={{ cursor: "pointer", marginBottom: 0, fontSize: "1rem" }}
                      />
                      <span className={tareaSeleccionada.taller === "Tercero" ? "fw-semibold text-dark" : "text-muted"}>
                        Tercero
                      </span>
                    </div>
                  </div>
                </Form.Group>
              </Col>

              {tareaSeleccionada.taller === "Tercero" && (
                <Col md={2}>
                  <Form.Group>
                    <Form.Label className="fw-semibold text-dark small mb-1">Nombre del taller</Form.Label>
                    <Form.Control
                      type="text"
                      value={tareaSeleccionada.nombreTaller || ""}
                      onChange={(e) => handleUpdateTarea(tareaSeleccionada._id, "nombreTaller", e.target.value)}
                      placeholder="Nombre del taller"
                      className="rounded-3 form-control-sm"
                      style={{ fontSize: "0.85rem", height: "36px" }}
                    />
                  </Form.Group>
                </Col>
              )}

              <Col md={tareaSeleccionada.taller === "Tercero" ? 2 : 3}>
                <Form.Group>
                  <Form.Label className="fw-semibold text-dark small mb-1">Responsable</Form.Label>
                  <Form.Control
                    type="text"
                    value={tareaSeleccionada.responsable || ""}
                    onChange={(e) => handleUpdateTarea(tareaSeleccionada._id, "responsable", e.target.value)}
                    className="rounded-3 form-control-sm"
                    style={{ fontSize: "0.85rem", height: "36px" }}
                    placeholder="Ej. Mecánico"
                  />
                </Form.Group>
              </Col>
            </Row>

            {/* Diagnóstico Detallado */}
            <Form.Group className="mb-3">
              <Form.Label className="fw-semibold text-dark small mb-1">Diagnóstico Detallado</Form.Label>
              <Form.Control
                as="textarea"
                rows={2}
                value={tareaSeleccionada.diagnostico || ""}
                onChange={(e) => handleUpdateTarea(tareaSeleccionada._id, "diagnostico", e.target.value)}
                placeholder="Diagnóstico técnico del mecánico o análisis de la falla..."
                className="rounded-3"
                style={{ fontSize: "0.86rem" }}
              />
            </Form.Group>

            {/* Reparaciones realizadas - Avance */}
            <Form.Group className="mb-3">
              <Form.Label className="fw-semibold text-dark small mb-1">Reparaciones realizadas - Avance</Form.Label>
              <Form.Control
                as="textarea"
                rows={2}
                value={tareaSeleccionada.reparacion || ""}
                onChange={(e) => handleUpdateTarea(tareaSeleccionada._id, "reparacion", e.target.value)}
                placeholder="Trabajo a realizar o avance de la reparación..."
                className="rounded-3"
                style={{ fontSize: "0.86rem" }}
              />
            </Form.Group>

            {/* Sección de Repuestos Requeridos */}
            <div className="border rounded-3 p-3 bg-light mb-3">
              <div className="d-flex align-items-center justify-content-between mb-2">
                <div className="d-flex align-items-center gap-2">
                  <i className="bi bi-box-seam-fill text-secondary"></i>
                  <span className="fw-semibold text-dark small">Lista de Repuestos Requeridos</span>
                </div>
                <Button
                  size="sm"
                  variant="outline-secondary"
                  className="rounded-3 px-2 py-0.5"
                  style={{ fontSize: "0.75rem" }}
                  onClick={() => handleAgregarRepuesto(tareaSeleccionada._id)}
                >
                  <i className="bi bi-plus-lg me-1"></i>Agregar Repuesto
                </Button>
              </div>

              {(!tareaSeleccionada.repuestos || tareaSeleccionada.repuestos.length === 0) ? (
                <p className="text-muted small mb-0 py-1">No se han registrado repuestos requeridos para esta tarea.</p>
              ) : (
                <div className="table-responsive bg-white rounded-3 border">
                  <Table size="sm" className="mb-0 align-middle" style={{ fontSize: "0.8rem" }}>
                    <thead className="table-light">
                      <tr>
                        <th style={{ width: "35%" }}>Repuesto / Insumo</th>
                        <th style={{ width: "15%" }}>Cantidad</th>
                        <th style={{ width: "25%" }}>Estado</th>
                        <th style={{ width: "20%" }}>Proveedor</th>
                        <th style={{ width: "5%" }}></th>
                      </tr>
                    </thead>
                    <tbody>
                      {tareaSeleccionada.repuestos.map((rep, idx) => (
                        <tr key={idx}>
                          <td>
                            <Form.Control
                              size="sm"
                              type="text"
                              value={rep.repuesto || ""}
                              onChange={(e) => handleUpdateRepuesto(tareaSeleccionada._id, idx, "repuesto", e.target.value)}
                              placeholder="Ej. Filtro de aceite"
                              className="border-0 shadow-none p-1"
                              style={{ fontSize: "0.8rem" }}
                            />
                          </td>
                          <td>
                            <Form.Control
                              size="sm"
                              type="number"
                              min="1"
                              value={rep.cantidad || 1}
                              onChange={(e) => handleUpdateRepuesto(tareaSeleccionada._id, idx, "cantidad", Number(e.target.value))}
                              className="border-0 shadow-none p-1"
                              style={{ fontSize: "0.8rem", width: "60px" }}
                            />
                          </td>
                          <td>
                            <Form.Select
                              size="sm"
                              value={rep.estado || "Pedido"}
                              onChange={(e) => handleUpdateRepuesto(tareaSeleccionada._id, idx, "estado", e.target.value)}
                              className="border-0 shadow-none p-1"
                              style={{ fontSize: "0.78rem" }}
                            >
                              {ESTADOS_REP.map((er) => (
                                <option key={er} value={er}>{er}</option>
                              ))}
                            </Form.Select>
                          </td>
                          <td>
                            <Form.Control
                              size="sm"
                              type="text"
                              value={rep.proveedor || ""}
                              onChange={(e) => handleUpdateRepuesto(tareaSeleccionada._id, idx, "proveedor", e.target.value)}
                              placeholder="Proveedor"
                              className="border-0 shadow-none p-1"
                              style={{ fontSize: "0.8rem" }}
                            />
                          </td>
                          <td>
                            <button
                              type="button"
                              onClick={() => handleEliminarRepuesto(tareaSeleccionada._id, idx)}
                              className="btn btn-sm btn-link text-danger p-0"
                              title="Eliminar repuesto"
                            >
                              <i className="bi bi-trash"></i>
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </Table>
                </div>
              )}
            </div>

            {/* Observaciones Generales */}
            <Form.Group className="mb-0">
              <Form.Label className="fw-semibold text-dark small mb-1">Observaciones / Notas Adicionales</Form.Label>
              <Form.Control
                type="text"
                value={tareaSeleccionada.observaciones || ""}
                onChange={(e) => handleUpdateTarea(tareaSeleccionada._id, "observaciones", e.target.value)}
                placeholder="Comentarios sobre tiempos, entrega o pruebas finales..."
                className="rounded-3"
                style={{ fontSize: "0.85rem" }}
              />
            </Form.Group>
          </div>
        ) : (
          <div className="flex-grow-1 bg-white rounded-4 shadow-sm border p-5 d-flex flex-column align-items-center justify-content-center text-muted" style={{ borderColor: "#cbd5e1" }}>
            <i className="bi bi-tools fs-1 mb-2 opacity-50"></i>
            <h5 className="fw-normal text-dark">Reparación</h5>
            <p className="small mb-0 text-muted">Seleccione una tarea del listado para ver o registrar la reparación.</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default ReparacionesCamioneta;
