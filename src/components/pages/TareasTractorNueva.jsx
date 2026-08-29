import { useEffect, useState, useMemo } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { Container, Card, Form, Button, Row, Col, Table, Modal } from "react-bootstrap";
import Swal from "sweetalert2";
import TractorIcon from "../shared/TractorIcon";
import LogoNavbar from "../shared/LogoNavbar";

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

// Mismas categorias que ofrece el reporte de falla
const PARTES = [
  "Motor",
  "Transmisión / Caja",
  "Embrague",
  "Hidráulico",
  "Frenos",
  "Dirección",
  "Mecánica general",
  "Electricidad / Luces",
  "Horómetro",
  "Rodado / Cubiertas",
  "Implementos / Enganche",
  "Service Programado",
  "Otros",
];
const ESTADOS_REP = ["Pedido", "Pendiente", "En taller", "Colocado"];

const URGENCIAS = ["baja", "media", "alta"];

const URGENCIA_ESTILOS = {
  alta:  { label: "Crítico", bg: "#dc2626", text: "#ffffff", border: "#b91c1c", plano: "#dc2626", prioridad: "Crítico" },
  media: { label: "Urgente", bg: "#fef3c7", text: "#b45309", border: "#fde047", plano: "#b45309", prioridad: "Urgente" },
  baja:  { label: "Leve",    bg: "#dcfce7", text: "#15803d", border: "#86efac", plano: "#15803d", prioridad: "Normal" },
};

// Las tareas viejas pueden no tener urgencia; se deduce de prioridad.
const urgenciaNormalizada = (t) => {
  const u = String(t?.urgencia || "").toLowerCase().trim();
  if (URGENCIAS.includes(u)) return u;
  const pr = String(t?.prioridad || "").toLowerCase().trim();
  if (pr === "crítico" || pr === "critico") return "alta";
  if (pr === "urgente") return "media";
  return "baja";
};

const estadoNormalizado = (estado) => {
  if (!estado) return "Pendiente";
  const lower = String(estado).toLowerCase().trim();
  if (lower === "terminado" || lower === "terminada") return "Terminada";
  if (lower === "en proceso") return "En proceso";
  return "Pendiente";
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

function TareasTractorNueva() {
  const navigate = useNavigate();
  const { grupoId, tractorId } = useParams();
  const { state } = useLocation();

  const [tractor, setTractor] = useState(null);
  const [trabajos, setTrabajos] = useState([]);
  const [cargando, setCargando] = useState(true);

  const [filtroEstado, setFiltroEstado] = useState("pendientes_en_proceso"); // 'pendientes_en_proceso' (por defecto) | 'Terminadas' | 'todas'
  const [tareaSeleccionadaId, setTareaSeleccionadaId] = useState(null);
  const [guardandoId, setGuardandoId] = useState(null);
  const [tareaEditada, setTareaEditada] = useState(null); // borrador del modal de edicion
  const [guardandoEdicion, setGuardandoEdicion] = useState(false);

  const rawCC = tractor?.cc || state?.cc || "CC —";
  const cleanCC = String(rawCC).replace(/^cc\s*/i, "").trim();
  const descripcion = tractor?.descripcion || state?.descripcion || "";

  const infoGrupo = GRUPOS[grupoId] || { label: state?.grupoLabel || `Grupo ${grupoId}`, supervisor: "—" };

  const cargarDatos = async () => {
    setCargando(true);
    try {
      const [tracRes, trabRes] = await Promise.all([
        fetch(`/api/tractores/${tractorId}`).then((r) => (r.ok ? r.json() : null)),
        fetch(`/api/trabajos-tractor/tractor/${tractorId}`).then((r) => (r.ok ? r.json() : [])),
      ]);

      if (tracRes) setTractor(tracRes);
      const listaTrabajos = Array.isArray(trabRes) ? trabRes : [];
      setTrabajos(listaTrabajos);
    } catch {
      // noop
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    cargarDatos();
  }, [tractorId]);

  // Verificar si la unidad está parada actualmente
  const tieneTrabajoParada = useMemo(() => {
    return trabajos.some(
      (t) => t.maquinaParada && estadoNormalizado(t.estado) !== "Terminada"
    );
  }, [trabajos]);

  const estaParada = Boolean(tieneTrabajoParada);

  // Actualizar campo de la tarea seleccionada
  const handleUpdateTarea = (id, campo, valor) => {
    setTrabajos((prev) =>
      prev.map((t) => (t._id === id ? { ...t, [campo]: valor } : t))
    );
  };

  // Guardar tarea en backend con SweetAlert2
  const handleGuardarTarea = async (tarea) => {
    setGuardandoId(tarea._id);
    const tractorEstabaParado =
      Boolean(tarea.maquinaParada) ||
      trabajos.some((t) => Boolean(t.maquinaParada));

    try {
      const fechaLimpia = `${(tarea.fecha ? String(tarea.fecha).split("T")[0] : hoyStr())}T12:00:00.000Z`;

      const payload = {
        ...tarea,
        tractor: tractorId,
        fecha: fechaLimpia,
        taller: tarea.taller || "Taller Propio",
        nombreTaller: tarea.taller === "Tercero" ? (tarea.nombreTaller || "").trim() : "",
      };

      const res = await fetch(`/api/trabajos-tractor/${tarea._id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        setTareaSeleccionadaId(null);

        const esTerminada = estadoNormalizado(tarea.estado) === "Terminada";

        // Si el tractor estaba en situación de parada y se termina la reparación, preguntar SIEMPRE si se cambia a actividad
        if (esTerminada && tractorEstabaParado) {
          const confirmAlta = await Swal.fire({
            title: "¿Poner en actividad la unidad?",
            text: "La reparación fue dada por terminada. ¿Desea cambiar el estado del tractor a unidad en actividad?",
            icon: "question",
            width: "350px",
            showCancelButton: true,
            confirmButtonColor: "#10b981",
            cancelButtonColor: "#64748b",
            confirmButtonText: "Sí, unidad en actividad",
            cancelButtonText: "No, mantener parado",
          });

          if (confirmAlta.isConfirmed) {
            const promises = [
              fetch(`/api/trabajos-tractor/${tarea._id}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ ...payload, maquinaParada: false }),
              }),
            ];
            trabajos
              .filter((t) => t.maquinaParada && t._id !== tarea._id)
              .forEach((t) => {
                promises.push(
                  fetch(`/api/trabajos-tractor/${t._id}`, {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ maquinaParada: false }),
                  })
                );
              });

            await Promise.all(promises);
            Swal.fire({
              icon: "success",
              title: "¡Tractor en actividad!",
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
      const res = await fetch(`/api/trabajos-tractor/${tareaId}`, {
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

  // Abrir el modal de edicion de una tarea del listado
  const handleAbrirEdicion = (tarea, e) => {
    if (e) e.stopPropagation();
    setTareaEditada({
      _id: tarea._id,
      fecha: tarea.fecha ? String(tarea.fecha).split("T")[0] : hoyStr(),
      reparacion: tarea.reparacion || tarea.descripcion || "",
      parte: tarea.parte || "",
      horometro: tarea.horometro ?? "",
      estado: estadoNormalizado(tarea.estado),
      urgencia: urgenciaNormalizada(tarea),
    });
  };

  const handleCerrarEdicion = () => {
    setTareaEditada(null);
    setGuardandoEdicion(false);
  };

  const handleCambioEdicion = (campo, valor) => {
    setTareaEditada((prev) => (prev ? { ...prev, [campo]: valor } : prev));
  };

  // Guardar los cambios del modal (actualizacion parcial de la tarea)
  const handleGuardarEdicion = async () => {
    if (!tareaEditada) return;

    const titulo = (tareaEditada.reparacion || "").trim();
    if (!titulo) {
      Swal.fire({
        icon: "warning",
        title: "Falta la descripción",
        text: "Escriba la falla o tarea reportada.",
        width: "320px",
        confirmButtonColor: "#1e293b",
      });
      return;
    }

    setGuardandoEdicion(true);
    try {
      const fecha = tareaEditada.fecha || hoyStr();
      const payload = {
        fecha: `${fecha}T12:00:00.000Z`,
        reparacion: titulo,
        parte: tareaEditada.parte || "",
        horometro: tareaEditada.horometro,
        estado: tareaEditada.estado,
        urgencia: tareaEditada.urgencia,
        prioridad: URGENCIA_ESTILOS[tareaEditada.urgencia].prioridad,
      };

      const res = await fetch(`/api/trabajos-tractor/${tareaEditada._id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        handleCerrarEdicion();
        Swal.fire({
          icon: "success",
          title: "Tarea actualizada",
          width: "300px",
          timer: 1300,
          showConfirmButton: false,
        });
        cargarDatos();
      } else {
        setGuardandoEdicion(false);
        Swal.fire({
          icon: "error",
          title: "Error",
          text: "No se pudieron guardar los cambios.",
          width: "300px",
          confirmButtonColor: "#1e293b",
        });
      }
    } catch {
      setGuardandoEdicion(false);
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
        const est = estadoNormalizado(t.estado);
        if (filtroEstado === "pendientes_en_proceso") {
          return est === "Pendiente" || est === "En proceso";
        }
        if (filtroEstado === "Terminadas") {
          return est === "Terminada";
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
        style={{ backgroundColor: "#1e293b", color: "#fff", height: "54px", position: "relative" }}
      >
        <LogoNavbar />
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
            onClick={() => navigate(`/tractores/grupo/${grupoId}`)}
            className="btn btn-sm btn-outline-light d-flex align-items-center gap-2 rounded-3 px-3 py-1"
            style={{ fontSize: "0.82rem" }}
          >
            <i className="bi bi-grid-fill"></i>
            <span>{infoGrupo.label}</span>
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

      {/* Banner de Estado del Tractor Centrado */}
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
              const estado = estadoNormalizado(t.estado);
              const estiloUrg = URGENCIA_ESTILOS[urgenciaNormalizada(t)];
              let badgeColor = "bg-secondary";
              if (estado === "En proceso") badgeColor = "bg-warning text-dark";
              if (estado === "Terminada") badgeColor = "bg-success";

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
                      <span
                        className="badge rounded-pill px-2 py-1 fw-normal"
                        style={{
                          fontSize: "0.68rem",
                          backgroundColor: estiloUrg.bg,
                          color: estiloUrg.text,
                          border: `1px solid ${estiloUrg.border}`,
                        }}
                        title="Nivel de urgencia"
                      >
                        {estiloUrg.label}
                      </span>
                      <span className={`badge ${badgeColor} rounded-pill px-2 py-1 fw-normal`} style={{ fontSize: "0.68rem", fontWeight: "normal" }}>
                        {estado}
                      </span>
                      <button
                        type="button"
                        onClick={(e) => handleAbrirEdicion(t, e)}
                        className="btn btn-sm btn-link text-primary p-0 ms-1 opacity-75 hover-opacity-100"
                        title="Editar tarea"
                        style={{ lineHeight: 1 }}
                      >
                        <i className="bi bi-pencil-square" style={{ fontSize: "0.85rem" }}></i>
                      </button>
                      <button
                        type="button"
                        onClick={(e) => handleEliminarTarea(t._id, e)}
                        className="btn btn-sm btn-link text-danger p-0 opacity-75 hover-opacity-100"
                        title="Eliminar tarea"
                        style={{ lineHeight: 1 }}
                      >
                        <i className="bi bi-trash3" style={{ fontSize: "0.85rem" }}></i>
                      </button>
                    </div>
                  </div>

                  <div className="fw-semibold text-dark text-truncate small mb-1" title={t.reparacion || t.diagnostico || t.descripcion}>
                    {t.reparacion || t.diagnostico || t.descripcion || "Reparación sin título"}
                  </div>
                  {t.diagnostico && t.reparacion && t.diagnostico !== t.reparacion && (
                    <div className="text-secondary text-truncate small mb-1" style={{ fontSize: "0.72rem" }} title={t.diagnostico}>
                      {t.diagnostico}
                    </div>
                  )}

                  <div className="d-flex align-items-center justify-content-between text-muted" style={{ fontSize: "0.72rem" }}>
                    <span>
                      {t.parte || "Mecánica general"}
                      {t.horometro ? ` • ${t.horometro} hs` : ""}
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
                  {tareaSeleccionada.reparacion || tareaSeleccionada.diagnostico || "Reparación"}
                </h5>
                <div className="small text-muted" style={{ fontSize: "0.82rem" }}>
                  <div>Fecha de reporte: {formatF(tareaSeleccionada.fecha)}</div>
                  <div className="mt-0.5">
                    Categoría: <span className="fw-semibold text-dark">{tareaSeleccionada.parte || "Mecánica general"}</span>
                    {tareaSeleccionada.horometro ? (
                      <span className="ms-2">• Horómetro: <span className="fw-semibold text-dark">{tareaSeleccionada.horometro} hs</span></span>
                    ) : null}
                    <span className="ms-2">
                      • Urgencia:{" "}
                      <span
                        className="fw-semibold"
                        style={{ color: URGENCIA_ESTILOS[urgenciaNormalizada(tareaSeleccionada)].plano }}
                      >
                        {URGENCIA_ESTILOS[urgenciaNormalizada(tareaSeleccionada)].label}
                      </span>
                    </span>
                  </div>
                </div>
              </div>

              {/* Botón Guardar y Switch de Tractor Parado */}
              <div className="d-flex align-items-center gap-2">
                <div
                  className={`d-inline-flex align-items-center justify-content-between px-2.5 py-1 rounded-3 border ${
                    tareaSeleccionada.maquinaParada
                      ? "bg-danger-subtle border-danger text-danger"
                      : "bg-light border text-secondary"
                  }`}
                  style={{ fontSize: "0.82rem", height: "36px" }}
                >
                  <i className={`bi bi-exclamation-triangle-fill me-1.5 ${tareaSeleccionada.maquinaParada ? "text-danger" : "text-muted"}`}></i>
                  <span className="me-2 text-dark" style={{ fontSize: "0.8rem" }}>Tractor parado</span>
                  <Form.Check
                    type="switch"
                    id="maquina-parada-switch"
                    checked={Boolean(tareaSeleccionada.maquinaParada)}
                    onChange={(e) => handleUpdateTarea(tareaSeleccionada._id, "maquinaParada", e.target.checked)}
                    style={{ cursor: "pointer", marginBottom: 0, fontSize: "1rem" }}
                  />
                </div>

                <Button
                  variant="dark"
                  size="sm"
                  className="rounded-3 px-3 py-1.5 d-flex align-items-center gap-1.5 shadow-sm"
                  style={{ fontSize: "0.84rem", height: "36px" }}
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

            {/* Fecha, Horómetro, Estado del Trabajo, Taller, Nombre Taller y Responsable */}
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
                        : hoyStr()
                    }
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val && val > hoyStr()) {
                        handleUpdateTarea(tareaSeleccionada._id, "fecha", hoyStr());
                      } else {
                        handleUpdateTarea(tareaSeleccionada._id, "fecha", val || hoyStr());
                      }
                    }}
                    className="rounded-3 form-control-sm"
                    style={{ fontSize: "0.85rem", height: "36px" }}
                  />
                </Form.Group>
              </Col>

              <Col md={tareaSeleccionada.taller === "Tercero" ? 2 : 2}>
                <Form.Group>
                  <Form.Label className="fw-semibold text-dark small mb-1">Horómetro (hs)</Form.Label>
                  <Form.Control
                    type="number"
                    min="0"
                    step="any"
                    value={tareaSeleccionada.horometro ?? ""}
                    onChange={(e) => handleUpdateTarea(tareaSeleccionada._id, "horometro", e.target.value)}
                    placeholder="Ej. 1250"
                    className="rounded-3 form-control-sm"
                    style={{ fontSize: "0.85rem", height: "36px" }}
                  />
                </Form.Group>
              </Col>

              <Col md={tareaSeleccionada.taller === "Tercero" ? 2 : 2}>
                <Form.Group>
                  <Form.Label className="fw-semibold text-dark small mb-1">Estado</Form.Label>
                  <Form.Select
                    value={estadoNormalizado(tareaSeleccionada.estado)}
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
                rows={3}
                value={tareaSeleccionada.descripcion || tareaSeleccionada.reparacion || ""}
                onChange={(e) => {
                  const val = e.target.value;
                  handleUpdateTarea(tareaSeleccionada._id, "descripcion", val);
                  if (!tareaSeleccionada.reparacion) {
                    handleUpdateTarea(tareaSeleccionada._id, "reparacion", val);
                  }
                }}
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

      {/* Modal para editar una tarea del listado */}
      <Modal show={Boolean(tareaEditada)} onHide={handleCerrarEdicion} centered contentClassName="border-0 shadow-lg rounded-4">
        <Modal.Header
          closeButton
          closeVariant="white"
          style={{
            backgroundColor: "#1e293b",
            color: "#fff",
            borderTopLeftRadius: "1rem",
            borderTopRightRadius: "1rem",
          }}
        >
          <Modal.Title className="fs-6 fw-bold d-flex align-items-center gap-2 text-white">
            <i className="bi bi-pencil-square" style={{ color: "#f59e0b" }}></i>
            <span>Editar tarea</span>
          </Modal.Title>
        </Modal.Header>
        <Modal.Body className="p-4">
          {tareaEditada && (
            <Row className="g-3">
              <Col md={12}>
                <Form.Label className="fw-semibold text-dark small mb-1">
                  Falla / Tarea reportada <span className="text-danger">*</span>
                </Form.Label>
                <Form.Control
                  as="textarea"
                  rows={2}
                  value={tareaEditada.reparacion}
                  onChange={(e) => handleCambioEdicion("reparacion", e.target.value)}
                  placeholder="Ej. Pérdida de aceite en el cárter"
                  className="rounded-3"
                  style={{ fontSize: "0.86rem" }}
                />
              </Col>

              <Col md={6}>
                <Form.Label className="fw-semibold text-dark small mb-1">Fecha</Form.Label>
                <Form.Control
                  type="date"
                  max={hoyStr()}
                  value={tareaEditada.fecha}
                  onChange={(e) => {
                    const val = e.target.value;
                    handleCambioEdicion("fecha", val && val <= hoyStr() ? val : hoyStr());
                  }}
                  className="rounded-3 form-control-sm"
                  style={{ fontSize: "0.85rem", height: "36px" }}
                />
              </Col>

              <Col md={6}>
                <Form.Label className="fw-semibold text-dark small mb-1">Horómetro (hs)</Form.Label>
                <Form.Control
                  type="number"
                  min="0"
                  step="any"
                  value={tareaEditada.horometro}
                  onChange={(e) => handleCambioEdicion("horometro", e.target.value)}
                  placeholder="Ej. 1250"
                  className="rounded-3 form-control-sm"
                  style={{ fontSize: "0.85rem", height: "36px" }}
                />
              </Col>

              <Col md={4}>
                <Form.Label className="fw-semibold text-dark small mb-1">Categoría</Form.Label>
                <Form.Select
                  value={tareaEditada.parte}
                  onChange={(e) => handleCambioEdicion("parte", e.target.value)}
                  className="rounded-3 form-select-sm"
                  style={{ fontSize: "0.85rem", height: "36px" }}
                >
                  <option value="">-- Sin categoría --</option>
                  {PARTES.map((op) => (
                    <option key={op} value={op}>
                      {op}
                    </option>
                  ))}
                </Form.Select>
              </Col>

              <Col md={4}>
                <Form.Label className="fw-semibold text-dark small mb-1">Estado</Form.Label>
                <Form.Select
                  value={tareaEditada.estado}
                  onChange={(e) => handleCambioEdicion("estado", e.target.value)}
                  className="rounded-3 form-select-sm"
                  style={{ fontSize: "0.85rem", height: "36px" }}
                >
                  {ESTADOS.map((op) => (
                    <option key={op} value={op}>
                      {op}
                    </option>
                  ))}
                </Form.Select>
              </Col>

              <Col md={4}>
                <Form.Label className="fw-semibold text-dark small mb-1">Urgencia</Form.Label>
                <Form.Select
                  value={tareaEditada.urgencia}
                  onChange={(e) => handleCambioEdicion("urgencia", e.target.value)}
                  className="rounded-3 form-select-sm"
                  style={{ fontSize: "0.85rem", height: "36px" }}
                >
                  {URGENCIAS.map((op) => (
                    <option key={op} value={op}>
                      {URGENCIA_ESTILOS[op].label}
                    </option>
                  ))}
                </Form.Select>
              </Col>
            </Row>
          )}
        </Modal.Body>
        <Modal.Footer className="bg-light border-0 py-2.5 px-4" style={{ borderBottomLeftRadius: "1rem", borderBottomRightRadius: "1rem" }}>
          <Button
            variant="outline-secondary"
            size="sm"
            onClick={handleCerrarEdicion}
            className="rounded-3 px-3 py-1.5"
            style={{ fontSize: "0.84rem" }}
          >
            Cancelar
          </Button>
          <Button
            variant="dark"
            size="sm"
            onClick={handleGuardarEdicion}
            disabled={guardandoEdicion}
            className="rounded-3 px-3.5 py-1.5 shadow-sm d-flex align-items-center gap-1.5"
            style={{ fontSize: "0.84rem" }}
          >
            {guardandoEdicion ? (
              <span>Guardando...</span>
            ) : (
              <>
                <i className="bi bi-floppy-fill"></i>
                <span>Guardar cambios</span>
              </>
            )}
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
}

export default TareasTractorNueva;
