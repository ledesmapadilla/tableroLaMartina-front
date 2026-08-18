import { useEffect, useState, useMemo } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { Container, Card, Form, Button, Row, Col, Badge, Table, Modal } from "react-bootstrap";
import { nuevoWorkbook } from "../../helpers/excel";
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

const CATEGORIAS = [
  "Todas",
  "Motor",
  "Embrague",
  "Frenos",
  "Suspensión / Dirección",
  "Mecánica general",
  "Electricidad / Luces",
  "Neumáticos / Cubiertas",
  "Chapa / Carrocería",
  "Service Programado",
  "Otros",
];

const CATEGORIA_COLORES = {
  Motor: { bg: "#fee2e2", text: "#991b1b", border: "#f87171" },
  Embrague: { bg: "#ffedd5", text: "#9a3412", border: "#fb923c" },
  Frenos: { bg: "#fef3c7", text: "#92400e", border: "#fcd34d" },
  "Suspensión / Dirección": { bg: "#e0e7ff", text: "#3730a3", border: "#818cf8" },
  "Mecánica general": { bg: "#e2e8f0", text: "#334155", border: "#94a3b8" },
  "Electricidad / Luces": { bg: "#fef9c3", text: "#854d0e", border: "#facc15" },
  "Neumáticos / Cubiertas": { bg: "#ccfbf1", text: "#115e59", border: "#2dd4bf" },
  "Chapa / Carrocería": { bg: "#fae8ff", text: "#86198f", border: "#e879f9" },
  "Service Programado": { bg: "#dcfce7", text: "#166534", border: "#4ade80" },
  Otros: { bg: "#f1f5f9", text: "#475569", border: "#cbd5e1" },
};

function HistorialReparaciones() {
  const navigate = useNavigate();
  const { camionetaId } = useParams();
  const { state } = useLocation();

  const [camioneta, setCamioneta] = useState(null);
  const [trabajos, setTrabajos] = useState([]);
  const [paradasAbiertas, setParadasAbiertas] = useState(new Set());
  const [cargando, setCargando] = useState(true);

  // Filtros
  const [busqueda, setBusqueda] = useState("");
  const [filtroCategoria, setFiltroCategoria] = useState("Todas");
  const [filtroEstado, setFiltroEstado] = useState("Pendientes / En proceso"); // 'Pendientes / En proceso' | 'Todas' | 'Terminada' | 'En proceso' | 'Pendiente'
  const [filtroTaller, setFiltroTaller] = useState("Todos"); // 'Todos' | 'Taller Propio' | 'Tercero'
  const [filtroSoloParadas, setFiltroSoloParadas] = useState(Boolean(state?.soloParadas || state?.maquinaParada));

  // Modal de Detalle
  const [trabajoSeleccionado, setTrabajoSeleccionado] = useState(null);
  const [showModal, setShowModal] = useState(false);

  const cargarDatos = () => {
    setCargando(true);
    Promise.all([
      fetch(`/api/camionetas/${camionetaId}`).then((r) => (r.ok ? r.json() : null)).catch(() => null),
      fetch(`/api/trabajos-camioneta/${camionetaId}`).then((r) => (r.ok ? r.json() : [])).catch(() => []),
      fetch("/api/paradas/abiertas/ids").then((r) => (r.ok ? r.json() : [])).catch(() => []),
    ]).then(([cam, trabs, abIds]) => {
      if (cam) setCamioneta(cam);
      setTrabajos(Array.isArray(trabs) ? trabs : []);
      setParadasAbiertas(new Set(Array.isArray(abIds) ? abIds : []));
      setCargando(false);
    });
  };

  useEffect(() => {
    cargarDatos();
  }, [camionetaId]);

  const patente = camioneta?.patente || state?.patente || "—";
  const marca = camioneta?.marca || state?.marca || "";
  const responsableCam = camioneta?.responsable || "";

  // Estado Parada vs Activa
  const estaParada =
    paradasAbiertas.has(camionetaId) ||
    trabajos.some(
      (t) =>
        t.maquinaParada &&
        !["terminada", "terminado"].includes((t.estado || "").toLowerCase())
    );

  // Filtrado de Trabajos
  const trabajosFiltrados = useMemo(() => {
    return trabajos.filter((t) => {
      // Filtro por Estado
      if (filtroEstado === "Pendientes / En proceso" || filtroEstado === "Pendiente / En proceso") {
        const est = (t.estado || "Pendiente").toLowerCase();
        if (est !== "pendiente" && est !== "en proceso") return false;
      } else if (filtroEstado !== "Todas") {
        const est = (t.estado || "Pendiente").toLowerCase();
        if (filtroEstado.toLowerCase() !== est) return false;
      }

      // Filtro por Categoría
      if (filtroCategoria !== "Todas") {
        const parte = t.parte || "Otros";
        if (parte !== filtroCategoria) return false;
      }

      // Filtro por Taller
      if (filtroTaller !== "Todos") {
        if (filtroTaller === "Taller Propio" && t.taller === "Tercero") return false;
        if (filtroTaller === "Tercero" && t.taller !== "Tercero") return false;
      }

      // Buscador por texto
      if (busqueda.trim()) {
        const q = busqueda.toLowerCase().trim();
        const enDiag = (t.diagnostico || "").toLowerCase().includes(q);
        const enRep = (t.reparacion || "").toLowerCase().includes(q);
        const enDesc = (t.descripcion || "").toLowerCase().includes(q);
        const enResp = (t.responsable || "").toLowerCase().includes(q);
        if (!enDiag && !enRep && !enDesc && !enResp && !enTaller && !enParte && !enRepuestos) {
          return false;
        }
      }

      return true;
    });
  }, [trabajos, filtroEstado, filtroCategoria, filtroTaller, busqueda]);

  // Contadores de tareas
  const pendientes = trabajos.filter((t) => (t.estado || "").toLowerCase() === "pendiente").length;
  const enProceso = trabajos.filter((t) => (t.estado || "").toLowerCase() === "en proceso").length;
  const cantPendientesOEnProceso = pendientes + enProceso;

  const abrirDetalle = (t) => {
    setTrabajoSeleccionado(t);
    setShowModal(true);
  };

  // Eliminar trabajo
  const handleEliminarTrabajo = async (trabajoId) => {
    const result = await Swal.fire({
      title: "¿Eliminar registro?",
      icon: "warning",
      width: "300px",
      showCancelButton: true,
      confirmButtonColor: "#ef4444",
      cancelButtonColor: "#64748b",
      confirmButtonText: "Sí, borrar",
      cancelButtonText: "Cancelar",
    });

    if (!result.isConfirmed) return;

    try {
      const res = await fetch(`/api/trabajos-camioneta/${trabajoId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        Swal.fire({
          icon: "success",
          title: "Registro eliminado",
          width: "300px",
          timer: 1400,
          showConfirmButton: false,
        });
        cargarDatos();
      } else {
        Swal.fire({
          icon: "error",
          title: "Error",
          text: "No se pudo eliminar el registro.",
          width: "300px",
          confirmButtonColor: "#1e293b",
        });
      }
    } catch {
      Swal.fire({
        icon: "error",
        title: "Error",
        text: "Error de conexión con el servidor.",
        width: "300px",
        confirmButtonColor: "#1e293b",
      });
    }
  };

  // Exportar Excel
  const exportarExcel = async () => {
    const wb = await nuevoWorkbook();
    const ws = wb.addWorksheet("Historial Reparaciones");

    const titulo = `HISTORIAL DE REPARACIONES - ${patente} ${marca ? `(${marca})` : ""}`;
    const fechaHoy = formatF(new Date().toISOString());

    const columnas = [
      "Fecha",
      "Categoría",
      "Diagnóstico",
      "Reparación Realizada",
      "Estado",
      "Taller",
      "Responsable",
      "Repuestos Utilizados",
      "Observaciones",
    ];

    ws.mergeCells(1, 1, 1, columnas.length);
    const celdaTitulo = ws.getCell("A1");
    celdaTitulo.value = titulo;
    celdaTitulo.font = { bold: true, size: 14, color: { argb: "FF000000" } };
    celdaTitulo.alignment = { horizontal: "center", vertical: "middle" };
    ws.getRow(1).height = 24;

    ws.mergeCells(2, 1, 2, 4);
    const celdaFecha = ws.getCell("A2");
    celdaFecha.value = `Fecha: ${fechaHoy}`;
    celdaFecha.font = { bold: true, size: 11, color: { argb: "FF000000" } };
    celdaFecha.alignment = { horizontal: "left", vertical: "middle" };
    ws.getRow(2).height = 18;

    ws.addRow([]);

    const filaEnc = ws.addRow(columnas);
    filaEnc.eachCell((cell) => {
      cell.font = { bold: false, color: { argb: "FFFFFFFF" } };
      cell.alignment = { horizontal: "center", vertical: "middle" };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1E293B" } };
      cell.border = {
        top: { style: "thin", color: { argb: "FFA0A0A0" } },
        left: { style: "thin", color: { argb: "FFA0A0A0" } },
        bottom: { style: "medium", color: { argb: "FF808080" } },
        right: { style: "thin", color: { argb: "FFA0A0A0" } },
      };
    });
    ws.getRow(4).height = 20;

    const zebraFill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF8FAFC" } };

    trabajosFiltrados.forEach((t, idx) => {
      const repList = (t.repuestos || [])
        .map((r) => `${r.repuesto || "Repuesto"} (x${r.cantidad || 1})`)
        .join(", ");

      const tallerStr =
        t.taller === "Tercero" ? `Tercero: ${t.nombreTaller || "Externo"}` : t.taller || "Taller Propio";

      const fila = ws.addRow([
        formatF(t.fecha),
        t.parte || "Mecánica general",
        t.diagnostico || t.descripcion || "-",
        t.reparacion || "-",
        t.estado || "Pendiente",
        tallerStr,
        t.responsable || responsableCam || "-",
        repList || "-",
        t.observaciones || "-",
      ]);

      if (idx % 2 === 1) {
        fila.eachCell((cell) => {
          cell.fill = zebraFill;
        });
      }

      fila.eachCell((cell) => {
        cell.border = {
          top: { style: "thin", color: { argb: "FFE2E8F0" } },
          left: { style: "thin", color: { argb: "FFE2E8F0" } },
          bottom: { style: "thin", color: { argb: "FFE2E8F0" } },
          right: { style: "thin", color: { argb: "FFE2E8F0" } },
        };
        cell.alignment = { vertical: "middle" };
      });
    });

    ws.columns = [
      { width: 14 }, // Fecha
      { width: 20 }, // Categoría
      { width: 35 }, // Diagnóstico
      { width: 35 }, // Reparación
      { width: 14 }, // Estado
      { width: 24 }, // Taller
      { width: 20 }, // Responsable
      { width: 35 }, // Repuestos
      { width: 30 }, // Observaciones
    ];

    const buffer = await wb.xlsx.writeBuffer();
    const blob = new Blob([buffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Historial_Reparaciones_${patente}_${fechaHoy.replace(/\//g, "-")}.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
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
      {/* Barra de Cabecera */}
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
              backgroundColor: "#3b82f6",
              color: "#fff",
              fontSize: "1.15rem",
              boxShadow: "0 2px 8px rgba(59, 130, 246, 0.3)",
            }}
          >
            <i className="bi bi-clock-history"></i>
          </div>
          <div className="d-flex align-items-center gap-2">
            <span className="text-white fs-6">Historial</span>
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
            {responsableCam && (
              <span className="text-light opacity-75 small">• Responsable: {responsableCam}</span>
            )}
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

      {/* Cartel / Banner de Estado de la Camioneta Centrado en la Página */}
      <div
        className="px-4 py-2 border-bottom flex-shrink-0 d-flex align-items-center justify-content-center"
        style={{
          backgroundColor: estaParada ? "#fef2f2" : "#f0fdf4",
          borderColor: estaParada ? "#fecaca" : "#bbf7d0",
        }}
      >
        <div className="d-flex align-items-center gap-2">
          <i
            className={`bi ${estaParada ? "bi-exclamation-octagon-fill text-danger" : "bi-check-circle-fill text-success"}`}
            style={{ fontSize: "1.05rem" }}
          ></i>
          <span
            className="fw-bold"
            style={{
              color: estaParada ? "#991b1b" : "#166534",
              fontSize: "0.88rem",
              letterSpacing: "0.3px",
            }}
          >
            {estaParada ? "UNIDAD PARADA" : "UNIDAD ACTIVA / EN SERVICIO"}
          </span>
        </div>
      </div>

      <Container fluid className="px-4 py-3">
        {/* Fila Superior: Tarjeta Centrada de Tareas Pendientes / En Proceso y Botón de Excel a la derecha */}
        <div className="d-flex align-items-center justify-content-between mb-3">
          <div style={{ width: "100px" }}></div> {/* Espaciador balanceador */}

          {/* Tarjeta Centrada de Tareas Pendientes / En Proceso */}
          <div
            className="shadow-sm bg-white rounded-3 px-4 py-2.5 d-flex align-items-center gap-3 border"
            style={{ borderColor: "#cbd5e1" }}
          >
            <div
              className="rounded-3 d-flex align-items-center justify-content-center flex-shrink-0"
              style={{
                width: "38px",
                height: "38px",
                backgroundColor: cantPendientesOEnProceso > 0 ? "#fef3c7" : "#dcfce7",
                color: cantPendientesOEnProceso > 0 ? "#b45309" : "#15803d",
                fontSize: "1.2rem",
              }}
            >
              <i className={cantPendientesOEnProceso > 0 ? "bi bi-hourglass-split" : "bi bi-check2-circle"}></i>
            </div>
            <div className="text-center">
              <div className="text-muted small fw-semibold">Tareas pendientes o en proceso</div>
              <div className="d-flex align-items-center justify-content-center gap-2">
                <h4 className="fw-bold mb-0 text-dark">{cantPendientesOEnProceso}</h4>
                <span className="text-muted small" style={{ fontSize: "0.82rem" }}>
                  {cantPendientesOEnProceso > 0
                    ? `(${pendientes} pendientes, ${enProceso} en proceso)`
                    : "— Sin tareas pendientes (Al día)"}
                </span>
              </div>
            </div>
          </div>

          {/* Botón Excel Arriba a la Derecha */}
          <div style={{ width: "100px" }} className="text-end">
            <Button
              variant="success"
              size="sm"
              onClick={exportarExcel}
              disabled={trabajosFiltrados.length === 0}
              className="d-inline-flex align-items-center gap-1.5 rounded-3 px-3 py-1.5 shadow-sm"
              style={{ fontSize: "0.82rem", backgroundColor: "#15803d", borderColor: "#15803d" }}
              title="Exportar a Excel"
            >
              <i className="bi bi-file-earmark-excel-fill"></i>
              <span>Excel</span>
            </Button>
          </div>
        </div>

        {/* Barra de Filtros distribuida armónicamente a lo ancho con mayor espacio inferior */}
        <Card
          className="shadow-sm border-0 rounded-3 px-3 py-2 bg-white"
          style={{ marginBottom: "18px" }}
        >
          <div className="d-flex align-items-center justify-content-between w-100 flex-nowrap gap-3">
            {/* Buscador de Texto */}
            <div style={{ width: "260px" }}>
              <div className="input-group input-group-sm">
                <span
                  className="input-group-text bg-light border-end-0 text-muted"
                  style={{ padding: "3px 9px", height: "32px" }}
                >
                  <i className="bi bi-search" style={{ fontSize: "0.8rem" }}></i>
                </span>
                <Form.Control
                  type="text"
                  placeholder="Buscar falla, repuesto, taller..."
                  value={busqueda}
                  onChange={(e) => setBusqueda(e.target.value)}
                  className={`border-start-0 ps-0 ${busqueda ? "fw-bold filtro-activo" : ""}`}
                  style={{
                    fontSize: "0.82rem",
                    height: "32px",
                    padding: "3px 8px",
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

            {/* Filtro por Categoría */}
            <div className="d-flex align-items-center gap-2">
              <span
                className="fw-bold text-dark small flex-shrink-0"
                style={{ fontSize: "0.8rem", letterSpacing: "0.1px" }}
              >
                Categoría:
              </span>
              <div className="input-group input-group-sm" style={{ width: "205px" }}>
                <Form.Select
                  size="sm"
                  value={filtroCategoria}
                  onChange={(e) => setFiltroCategoria(e.target.value)}
                  className={`rounded-3 ${filtroCategoria !== "Todas" ? "rounded-end-0 border-end-0 fw-bold filtro-activo" : ""}`}
                  style={{
                    fontSize: "0.82rem",
                    height: "32px",
                    padding: "3px 24px 3px 8px",
                    color: filtroCategoria !== "Todas" ? "#dc2626" : "#1e293b",
                    fontWeight: filtroCategoria !== "Todas" ? "700" : "normal",
                  }}
                >
                  {CATEGORIAS.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </Form.Select>
                {filtroCategoria !== "Todas" && (
                  <button
                    className="btn btn-outline-secondary border-start-0 d-flex align-items-center justify-content-center"
                    type="button"
                    onClick={() => setFiltroCategoria("Todas")}
                    title="Limpiar filtro categoría"
                    style={{ padding: "0 6px", height: "32px" }}
                  >
                    <i className="bi bi-x" style={{ fontSize: "0.9rem" }}></i>
                  </button>
                )}
              </div>
            </div>

            {/* Filtro por Taller */}
            <div className="d-flex align-items-center gap-2">
              <span
                className="fw-bold text-dark small flex-shrink-0"
                style={{ fontSize: "0.8rem", letterSpacing: "0.1px" }}
              >
                Taller:
              </span>
              <div className="input-group input-group-sm" style={{ width: "170px" }}>
                <Form.Select
                  size="sm"
                  value={filtroTaller}
                  onChange={(e) => setFiltroTaller(e.target.value)}
                  className={`rounded-3 ${filtroTaller !== "Todos" ? "rounded-end-0 border-end-0 fw-bold filtro-activo" : ""}`}
                  style={{
                    fontSize: "0.82rem",
                    height: "32px",
                    padding: "3px 24px 3px 8px",
                    color: filtroTaller !== "Todos" ? "#dc2626" : "#1e293b",
                    fontWeight: filtroTaller !== "Todos" ? "700" : "normal",
                  }}
                >
                  <option value="Todos">Todos</option>
                  <option value="Taller Propio">Taller Propio</option>
                  <option value="Tercero">Tercero</option>
                </Form.Select>
                {filtroTaller !== "Todos" && (
                  <button
                    className="btn btn-outline-secondary border-start-0 d-flex align-items-center justify-content-center"
                    type="button"
                    onClick={() => setFiltroTaller("Todos")}
                    title="Limpiar filtro taller"
                    style={{ padding: "0 6px", height: "32px" }}
                  >
                    <i className="bi bi-x" style={{ fontSize: "0.9rem" }}></i>
                  </button>
                )}
              </div>
            </div>

            {/* Filtro por Estado */}
            <div className="d-flex align-items-center gap-2">
              <span
                className="fw-bold text-dark small flex-shrink-0"
                style={{ fontSize: "0.8rem", letterSpacing: "0.1px" }}
              >
                Estado:
              </span>
              <div className="input-group input-group-sm" style={{ width: "205px" }}>
                <Form.Select
                  size="sm"
                  value={filtroEstado}
                  onChange={(e) => setFiltroEstado(e.target.value)}
                  className={`rounded-3 ${filtroEstado !== "Todas" ? "rounded-end-0 border-end-0 fw-bold filtro-activo" : ""}`}
                  style={{
                    fontSize: "0.82rem",
                    height: "32px",
                    padding: "3px 24px 3px 8px",
                    color: filtroEstado !== "Todas" ? "#dc2626" : "#1e293b",
                    fontWeight: filtroEstado !== "Todas" ? "700" : "normal",
                  }}
                >
                  <option value="Pendientes / En proceso">Pendientes / En proceso</option>
                  <option value="Todas">Todas</option>
                  <option value="Pendiente">Pendiente</option>
                  <option value="En proceso">En proceso</option>
                  <option value="Terminada">Terminada</option>
                </Form.Select>
                {filtroEstado !== "Todas" && (
                  <button
                    className="btn btn-outline-secondary border-start-0 d-flex align-items-center justify-content-center"
                    type="button"
                    onClick={() => setFiltroEstado("Todas")}
                    title="Limpiar filtro estado"
                    style={{ padding: "0 6px", height: "32px" }}
                  >
                    <i className="bi bi-x" style={{ fontSize: "0.9rem" }}></i>
                  </button>
                )}
              </div>
            </div>
          </div>
        </Card>

        {/* Contenedor de la Tabla con bordes y esquinas limpias sin recorte */}
        <div
          className="shadow-sm bg-white"
          style={{
            borderRadius: "10px",
            border: "1px solid #cbd5e1",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              maxHeight: "calc(100vh - 310px)",
              minHeight: "260px",
              overflowY: "auto",
              overflowX: "auto",
            }}
          >
            <Table
              hover
              className="align-middle mb-0"
              style={{
                fontSize: "0.84rem",
                borderCollapse: "separate",
                borderSpacing: 0,
              }}
            >
              <thead
                style={{
                  position: "sticky",
                  top: 0,
                  zIndex: 2,
                }}
              >
                <tr className="align-middle">
                  <th
                    style={{
                      width: "105px",
                      padding: "11px 14px",
                      backgroundColor: "#1e293b",
                      color: "#ffffff",
                      fontWeight: "normal",
                      textAlign: "center",
                      fontSize: "0.82rem",
                      borderBottom: "1px solid #334155",
                    }}
                  >
                    Fecha
                  </th>
                  <th
                    style={{
                      width: "155px",
                      backgroundColor: "#1e293b",
                      color: "#ffffff",
                      fontWeight: "normal",
                      textAlign: "center",
                      fontSize: "0.82rem",
                      borderBottom: "1px solid #334155",
                    }}
                  >
                    Categoría
                  </th>
                  <th
                    style={{
                      minWidth: "220px",
                      backgroundColor: "#1e293b",
                      color: "#ffffff",
                      fontWeight: "normal",
                      textAlign: "center",
                      fontSize: "0.82rem",
                      borderBottom: "1px solid #334155",
                    }}
                  >
                    Diagnóstico
                  </th>
                  <th
                    style={{
                      minWidth: "240px",
                      backgroundColor: "#1e293b",
                      color: "#ffffff",
                      fontWeight: "normal",
                      textAlign: "center",
                      fontSize: "0.82rem",
                      borderBottom: "1px solid #334155",
                    }}
                  >
                    Reparación Realizada
                  </th>
                  <th
                    style={{
                      width: "150px",
                      backgroundColor: "#1e293b",
                      color: "#ffffff",
                      fontWeight: "normal",
                      textAlign: "center",
                      fontSize: "0.82rem",
                      borderBottom: "1px solid #334155",
                    }}
                  >
                    Taller
                  </th>
                  <th
                    style={{
                      width: "120px",
                      backgroundColor: "#1e293b",
                      color: "#ffffff",
                      fontWeight: "normal",
                      textAlign: "center",
                      fontSize: "0.82rem",
                      borderBottom: "1px solid #334155",
                    }}
                  >
                    Repuestos
                  </th>
                  <th
                    style={{
                      width: "115px",
                      textAlign: "center",
                      backgroundColor: "#1e293b",
                      color: "#ffffff",
                      fontWeight: "normal",
                      fontSize: "0.82rem",
                      borderBottom: "1px solid #334155",
                    }}
                  >
                    Estado
                  </th>
                  <th
                    style={{
                      width: "115px",
                      textAlign: "center",
                      backgroundColor: "#1e293b",
                      color: "#ffffff",
                      fontWeight: "normal",
                      fontSize: "0.82rem",
                      borderBottom: "1px solid #334155",
                    }}
                  >
                    Acción
                  </th>
                </tr>
              </thead>
              <tbody>
                {cargando ? (
                  <tr>
                    <td colSpan={8} className="text-center py-5 text-muted">
                      <div className="spinner-border spinner-border-sm text-primary me-2" role="status"></div>
                      Cargando historial de reparaciones...
                    </td>
                  </tr>
                ) : trabajosFiltrados.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="text-center py-5 text-muted">
                      <i className="bi bi-inbox fs-2 d-block mb-2 text-secondary opacity-50"></i>
                      {busqueda ||
                      filtroCategoria !== "Todas" ||
                      filtroEstado !== "Todas" ||
                      filtroTaller !== "Todos"
                        ? "No se encontraron reparaciones con los filtros seleccionados."
                        : "Esta unidad no tiene reparaciones registradas en el historial."}
                    </td>
                  </tr>
                ) : (
                  trabajosFiltrados.map((t) => {
                    const estiloCat = CATEGORIA_COLORES[t.parte] || CATEGORIA_COLORES["Otros"];
                    const esTerminada = (t.estado || "").toLowerCase() === "terminada";
                    const esEnProceso = (t.estado || "").toLowerCase() === "en proceso";

                    return (
                      <tr key={t._id}>
                        {/* Fecha */}
                        <td
                          className="fw-semibold text-dark text-center"
                          style={{ borderBottom: "1px solid #f1f5f9" }}
                        >
                          {formatF(t.fecha)}
                        </td>

                        {/* Categoría */}
                        <td className="text-center" style={{ borderBottom: "1px solid #f1f5f9" }}>
                          <span
                            className="badge fw-medium px-2 py-1"
                            style={{
                              backgroundColor: estiloCat.bg,
                              color: estiloCat.text,
                              border: `1px solid ${estiloCat.border}`,
                              fontSize: "0.75rem",
                              borderRadius: "6px",
                            }}
                          >
                            {t.parte || "Mecánica general"}
                          </span>
                        </td>

                        {/* Diagnóstico */}
                        <td style={{ borderBottom: "1px solid #f1f5f9" }}>
                          <div
                            className="fw-medium text-dark text-truncate"
                            style={{ maxWidth: "260px" }}
                            title={t.diagnostico || t.descripcion || "—"}
                          >
                            {t.diagnostico || t.descripcion || "—"}
                          </div>
                          {t.maquinaParada && (
                            <span
                              className="badge bg-danger-subtle text-danger border border-danger-subtle px-1.5 py-0.5 mt-1"
                              style={{ fontSize: "0.68rem" }}
                            >
                              <i className="bi bi-exclamation-triangle-fill me-1"></i>Parada
                            </span>
                          )}
                        </td>

                        {/* Reparación Realizada */}
                        <td style={{ borderBottom: "1px solid #f1f5f9" }}>
                          <div
                            className="text-secondary text-truncate"
                            style={{ maxWidth: "280px" }}
                            title={t.reparacion || "—"}
                          >
                            {t.reparacion || <span className="text-muted fst-italic">Sin detalle de avance</span>}
                          </div>
                        </td>

                        {/* Taller */}
                        <td className="text-center" style={{ borderBottom: "1px solid #f1f5f9" }}>
                          {t.taller === "Tercero" ? (
                            <span
                              className="badge px-2 py-1 fw-medium"
                              style={{
                                backgroundColor: "#e0f2fe",
                                color: "#0369a1",
                                border: "1px solid #7dd3fc",
                                fontSize: "0.73rem",
                              }}
                            >
                              <i className="bi bi-building me-1"></i>
                              {t.nombreTaller || "Tercero"}
                            </span>
                          ) : (
                            <span
                              className="badge px-2 py-1 fw-medium"
                              style={{
                                backgroundColor: "#f0fdf4",
                                color: "#166534",
                                border: "1px solid #86efac",
                                fontSize: "0.73rem",
                              }}
                            >
                              <i className="bi bi-house-door me-1"></i>
                              {t.taller || "Taller Propio"}
                            </span>
                          )}
                        </td>

                        {/* Repuestos (Clicable para abrir ficha técnica) */}
                        <td className="text-center" style={{ borderBottom: "1px solid #f1f5f9" }}>
                          {t.repuestos && t.repuestos.length > 0 ? (
                            <span
                              className="badge px-2 py-1 fw-medium"
                              style={{
                                backgroundColor: "#f1f5f9",
                                color: "#334155",
                                border: "1px solid #cbd5e1",
                                fontSize: "0.73rem",
                                cursor: "pointer",
                              }}
                              onClick={() => abrirDetalle(t)}
                              title="Haga clic para ver el detalle de repuestos"
                            >
                              <i className="bi bi-box-seam me-1"></i>
                              {t.repuestos.length} {t.repuestos.length === 1 ? "repuesto" : "repuestos"}
                            </span>
                          ) : (
                            <span className="text-muted small">—</span>
                          )}
                        </td>

                        {/* Estado */}
                        <td className="text-center" style={{ borderBottom: "1px solid #f1f5f9" }}>
                          <span
                            className="badge px-2.5 py-1 fw-semibold"
                            style={{
                              backgroundColor: esTerminada ? "#d1fae5" : esEnProceso ? "#fef3c7" : "#fee2e2",
                              color: esTerminada ? "#065f46" : esEnProceso ? "#92400e" : "#991b1b",
                              border: `1px solid ${esTerminada ? "#6ee7b7" : esEnProceso ? "#fcd34d" : "#fca5a5"}`,
                              fontSize: "0.74rem",
                              borderRadius: "20px",
                            }}
                          >
                            {esTerminada ? (
                              <>
                                <i className="bi bi-check2 me-1"></i>Terminada
                              </>
                            ) : esEnProceso ? (
                              <>
                                <i className="bi bi-hourglass-split me-1"></i>En proceso
                              </>
                            ) : (
                              <>
                                <i className="bi bi-clock me-1"></i>Pendiente
                              </>
                            )}
                          </span>
                        </td>

                        {/* Acciones: Botón Ver (sin icono) y Botón Borrar */}
                        <td
                          className="text-center"
                          style={{ borderBottom: "1px solid #f1f5f9" }}
                        >
                          <div className="d-flex align-items-center justify-content-center gap-1.5">
                            <Button
                              size="sm"
                              variant="outline-primary"
                              className="rounded-3 px-2.5 py-0.5"
                              style={{ fontSize: "0.75rem", fontWeight: "600" }}
                              onClick={() => abrirDetalle(t)}
                            >
                              Ver
                            </Button>
                            <Button
                              size="sm"
                              variant="outline-danger"
                              className="rounded-3 px-2 py-0.5"
                              style={{ fontSize: "0.75rem" }}
                              onClick={() => handleEliminarTrabajo(t._id)}
                              title="Eliminar reparación"
                            >
                              <i className="bi bi-trash3-fill"></i>
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
      </Container>

      {/* Modal de Detalle Completo de la Reparación */}
      <Modal show={showModal} onHide={() => setShowModal(false)} size="lg" centered>
        {trabajoSeleccionado && (
          <>
            <Modal.Header
              closeButton
              closeVariant="white"
              data-bs-theme="dark"
              style={{ backgroundColor: "#1e293b", color: "#fff", borderBottom: "none" }}
            >
              <Modal.Title className="fs-6 d-flex align-items-center gap-2">
                <i className="bi bi-tools text-warning"></i>
                <span>
                  Ficha de Reparación - {patente} ({formatF(trabajoSeleccionado.fecha)})
                </span>
              </Modal.Title>
            </Modal.Header>

            <Modal.Body className="p-4 bg-light">
              {/* Tarjeta de Resumen Rápido */}
              <Card className="border-0 shadow-sm rounded-3 p-3 mb-3 bg-white">
                <Row className="g-3">
                  <Col sm={3}>
                    <div className="text-muted small">Fecha</div>
                    <div className="fw-bold text-dark">{formatF(trabajoSeleccionado.fecha)}</div>
                  </Col>
                  <Col sm={3}>
                    <div className="text-muted small">Categoría</div>
                    <div>
                      <Badge
                        bg="light"
                        className="text-dark border"
                        style={{ fontSize: "0.8rem", fontWeight: "600" }}
                      >
                        {trabajoSeleccionado.parte || "Mecánica general"}
                      </Badge>
                    </div>
                  </Col>
                  <Col sm={3}>
                    <div className="text-muted small">Estado</div>
                    <div>
                      <span
                        className="badge px-2 py-1 fw-semibold"
                        style={{
                          backgroundColor:
                            (trabajoSeleccionado.estado || "").toLowerCase() === "terminada"
                              ? "#d1fae5"
                              : (trabajoSeleccionado.estado || "").toLowerCase() === "en proceso"
                              ? "#fef3c7"
                              : "#fee2e2",
                          color:
                            (trabajoSeleccionado.estado || "").toLowerCase() === "terminada"
                              ? "#065f46"
                              : (trabajoSeleccionado.estado || "").toLowerCase() === "en proceso"
                              ? "#92400e"
                              : "#991b1b",
                          fontSize: "0.78rem",
                        }}
                      >
                        {trabajoSeleccionado.estado || "Pendiente"}
                      </span>
                    </div>
                  </Col>
                  <Col sm={3}>
                    <div className="text-muted small">Taller</div>
                    <div className="fw-semibold text-dark">
                      {trabajoSeleccionado.taller === "Tercero"
                        ? `Tercero (${trabajoSeleccionado.nombreTaller || "Externo"})`
                        : trabajoSeleccionado.taller || "Taller Propio"}
                    </div>
                  </Col>
                </Row>
              </Card>

              {/* Diagnóstico */}
              <Card className="border-0 shadow-sm rounded-3 p-3 mb-3 bg-white">
                <h6 className="fw-bold text-dark mb-2 d-flex align-items-center gap-1.5">
                  <i className="bi bi-clipboard-pulse text-danger"></i>
                  Diagnóstico
                </h6>
                <div
                  className="p-2.5 rounded-3 bg-light text-dark"
                  style={{ fontSize: "0.88rem", whiteSpace: "pre-wrap" }}
                >
                  {trabajoSeleccionado.diagnostico || trabajoSeleccionado.descripcion || "Sin diagnóstico registrado."}
                </div>
              </Card>

              {/* Reparación Realizada */}
              <Card className="border-0 shadow-sm rounded-3 p-3 mb-3 bg-white">
                <h6 className="fw-bold text-dark mb-2 d-flex align-items-center gap-1.5">
                  <i className="bi bi-wrench text-success"></i>
                  Reparación Realizada / Solución
                </h6>
                <div
                  className="p-2.5 rounded-3 bg-light text-dark"
                  style={{ fontSize: "0.88rem", whiteSpace: "pre-wrap" }}
                >
                  {trabajoSeleccionado.reparacion || (
                    <span className="text-muted fst-italic">Sin detalle de reparación asentado.</span>
                  )}
                </div>
              </Card>

              {/* Repuestos Utilizados */}
              <Card className="border-0 shadow-sm rounded-3 p-3 mb-3 bg-white">
                <h6 className="fw-bold text-dark mb-2 d-flex align-items-center gap-1.5">
                  <i className="bi bi-box-seam-fill text-primary"></i>
                  Repuestos y Materiales
                </h6>
                {trabajoSeleccionado.repuestos && trabajoSeleccionado.repuestos.length > 0 ? (
                  <div className="table-responsive">
                    <Table size="sm" bordered hover className="align-middle mb-0" style={{ fontSize: "0.8rem" }}>
                      <thead className="table-light">
                        <tr>
                          <th>Repuesto / Pieza</th>
                          <th style={{ width: "70px" }} className="text-center">Cant.</th>
                          <th style={{ width: "120px" }}>Proveedor</th>
                          <th style={{ width: "110px" }} className="text-center">Estado</th>
                          <th>Observaciones</th>
                        </tr>
                      </thead>
                      <tbody>
                        {trabajoSeleccionado.repuestos.map((r, i) => (
                          <tr key={i}>
                            <td className="fw-semibold text-dark">{r.repuesto || "—"}</td>
                            <td className="text-center">{r.cantidad || 1}</td>
                            <td>{r.proveedor || "—"}</td>
                            <td className="text-center">
                              <span className="badge bg-secondary-subtle text-dark border px-2 py-0.5">
                                {r.estado || "Colocado"}
                              </span>
                            </td>
                            <td className="text-muted">{r.observaciones || "—"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </Table>
                  </div>
                ) : (
                  <div className="text-muted small fst-italic">No se asociaron repuestos a este trabajo.</div>
                )}
              </Card>

              {/* Observaciones y Responsable */}
              {(trabajoSeleccionado.observaciones || trabajoSeleccionado.responsable) && (
                <Card className="border-0 shadow-sm rounded-3 p-3 bg-white">
                  <Row className="g-3">
                    {trabajoSeleccionado.responsable && (
                      <Col sm={6}>
                        <div className="text-muted small">Mecánico / Responsable de Ejecución</div>
                        <div className="fw-semibold text-dark">{trabajoSeleccionado.responsable}</div>
                      </Col>
                    )}
                    {trabajoSeleccionado.observaciones && (
                      <Col sm={6}>
                        <div className="text-muted small">Observaciones Adicionales</div>
                        <div className="text-dark small">{trabajoSeleccionado.observaciones}</div>
                      </Col>
                    )}
                  </Row>
                </Card>
              )}
            </Modal.Body>

            <Modal.Footer className="border-top-0 bg-white">
              <Button
                variant="outline-secondary"
                size="sm"
                className="rounded-3 px-3"
                onClick={() => setShowModal(false)}
              >
                Cerrar
              </Button>
            </Modal.Footer>
          </>
        )}
      </Modal>
    </div>
  );
}

export default HistorialReparaciones;
