import { useEffect, useState, useMemo } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { Container, Button, Table, Form, Row, Col, Badge } from "react-bootstrap";
import { nuevoWorkbook } from "../../helpers/excel";
import TractorIcon from "../shared/TractorIcon";
import LogoNavbar from "../shared/LogoNavbar";

const formatF = (iso) =>
  iso ? new Date(iso + "T12:00:00").toLocaleDateString("es-AR") : "-";

const pesos = (n) =>
  (Number(n) || 0).toLocaleString("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0,
  });

const COLOR_ESTADO = {
  Pendiente: "#6c757d",
  "En proceso": "#ffc107",
  Terminado: "#198754",
  Terminada: "#198754",
};

const COLOR_ESTADO_REP = {
  Pedido: "#0dcaf0",
  Pendiente: "#6c757d",
  "En taller": "#fd7e14",
  Colocado: "#198754",
};

const selectActivo = { backgroundImage: "none" };
const estiloX = {
  position: "absolute",
  right: "10px",
  top: "50%",
  transform: "translateY(-50%)",
  cursor: "pointer",
  color: "#dc3545",
  fontSize: "14px",
  fontWeight: "900",
  zIndex: 5,
  userSelect: "none",
};

// Modal de Detalle en Solo Lectura
function ModalDetalle({ reparacion, onCerrar }) {
  if (!reparacion) return null;
  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: "rgba(0,0,0,0.5)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1050,
      }}
    >
      <div
        className="bg-white rounded-4 shadow-lg p-4"
        style={{ width: "90%", maxWidth: "600px", maxHeight: "85vh", overflowY: "auto" }}
      >
        <div className="d-flex justify-content-between align-items-center mb-3 border-bottom pb-2">
          <h5 className="mb-0 fw-bold">Detalle y Diagnóstico (Solo Lectura)</h5>
          <Button variant="close" onClick={onCerrar} />
        </div>
        <div className="mb-3">
          <label className="fw-semibold text-secondary small mb-1">Reparación / Tarea:</label>
          <div className="p-2 bg-light rounded-3 border small fw-bold">
            {reparacion.reparacion || "-"}
          </div>
        </div>
        <div className="mb-3">
          <label className="fw-semibold text-secondary small mb-1">Diagnóstico:</label>
          <div className="p-2 bg-light rounded-3 border small">
            {reparacion.diagnostico || <span className="text-muted fst-italic">Sin diagnóstico registrado</span>}
          </div>
        </div>
        <div className="mb-3">
          <label className="fw-semibold text-secondary small mb-1">Descripción / Trabajo a Realizar:</label>
          <div className="p-2 bg-light rounded-3 border small" style={{ whiteSpace: "pre-wrap" }}>
            {reparacion.descripcion || <span className="text-muted fst-italic">Sin descripción registrada</span>}
          </div>
        </div>
        <div className="d-flex justify-content-end">
          <Button variant="secondary" size="sm" onClick={onCerrar} className="rounded-3 px-4">
            Cerrar
          </Button>
        </div>
      </div>
    </div>
  );
}

// Modal de Observaciones en Solo Lectura
function ModalObservaciones({ reparacion, onCerrar }) {
  if (!reparacion) return null;
  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: "rgba(0,0,0,0.5)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1050,
      }}
    >
      <div
        className="bg-white rounded-4 shadow-lg p-4"
        style={{ width: "90%", maxWidth: "550px", maxHeight: "85vh", overflowY: "auto" }}
      >
        <div className="d-flex justify-content-between align-items-center mb-3 border-bottom pb-2">
          <h5 className="mb-0 fw-bold">Observaciones (Solo Lectura)</h5>
          <Button variant="close" onClick={onCerrar} />
        </div>
        <div className="mb-3">
          <label className="fw-semibold text-secondary small mb-1">Observaciones / Notas:</label>
          <div className="p-3 bg-light rounded-3 border small" style={{ minHeight: "100px", whiteSpace: "pre-wrap" }}>
            {reparacion.observaciones || <span className="text-muted fst-italic">Sin observaciones registradas</span>}
          </div>
        </div>
        <div className="d-flex justify-content-end">
          <Button variant="secondary" size="sm" onClick={onCerrar} className="rounded-3 px-4">
            Cerrar
          </Button>
        </div>
      </div>
    </div>
  );
}

// Modal de Repuestos en Solo Lectura
function ModalRepuestos({ reparacion, onCerrar }) {
  if (!reparacion) return null;
  const reps = Array.isArray(reparacion.repuestos) ? reparacion.repuestos : [];
  const totalCosto = reps.reduce((acc, r) => acc + (Number(r.precio) || 0) * (Number(r.cantidad) || 1), 0);

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: "rgba(0,0,0,0.5)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1050,
      }}
    >
      <div
        className="bg-white rounded-4 shadow-lg p-4"
        style={{ width: "95%", maxWidth: "800px", maxHeight: "85vh", overflowY: "auto" }}
      >
        <div className="d-flex justify-content-between align-items-center mb-3 border-bottom pb-2">
          <div>
            <h5 className="mb-0 fw-bold">Repuestos de la Tarea (Solo Lectura)</h5>
            <small className="text-muted">{reparacion.reparacion}</small>
          </div>
          <Button variant="close" onClick={onCerrar} />
        </div>

        {reps.length === 0 ? (
          <p className="text-muted text-center py-4">No hay repuestos registrados en esta tarea.</p>
        ) : (
          <div className="table-responsive rounded-3 border mb-3">
            <Table size="sm" className="mb-0 text-center align-middle" style={{ fontSize: "0.82rem" }}>
              <thead className="table-light">
                <tr>
                  <th className="text-start">Repuesto</th>
                  <th>Cant.</th>
                  <th>Precio Unit.</th>
                  <th>Subtotal</th>
                  <th>Proveedor</th>
                  <th>Estado</th>
                </tr>
              </thead>
              <tbody>
                {reps.map((r, i) => {
                  const cant = Number(r.cantidad) || 1;
                  const prec = Number(r.precio) || 0;
                  return (
                    <tr key={i}>
                      <td className="text-start fw-semibold">{r.repuesto || "-"}</td>
                      <td>{cant}</td>
                      <td>{pesos(prec)}</td>
                      <td className="fw-bold">{pesos(cant * prec)}</td>
                      <td>{r.proveedor || "-"}</td>
                      <td>
                        <span
                          className="badge"
                          style={{
                            backgroundColor: COLOR_ESTADO_REP[r.estado] || "#6c757d",
                            color: r.estado === "Pedido" ? "#000" : "#fff",
                          }}
                        >
                          {r.estado || "Pedido"}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </Table>
          </div>
        )}

        <div className="d-flex justify-content-between align-items-center pt-2 border-top">
          <div className="fw-bold text-dark">
            Total Estimado: <span className="text-success ms-1">{pesos(totalCosto)}</span>
          </div>
          <Button variant="secondary" size="sm" onClick={onCerrar} className="rounded-3 px-4">
            Cerrar
          </Button>
        </div>
      </div>
    </div>
  );
}

function TareasTractorVieja() {
  const navigate = useNavigate();
  const { grupoId, tractorId } = useParams();
  const { state } = useLocation();

  const [tractor, setTractor] = useState(null);
  const [filas, setFilas] = useState([]);
  const [cargando, setCargando] = useState(true);

  const [filtroReparacion, setFiltroReparacion] = useState("");
  const [filtroResponsable, setFiltroResponsable] = useState("");
  const [filtroEstado, setFiltroEstado] = useState("activas");

  const [detalleSel, setDetalleSel] = useState(null);
  const [repuestosSel, setRepuestosSel] = useState(null);
  const [observacionesSel, setObservacionesSel] = useState(null);

  const rawCC = tractor?.cc || state?.cc || "CC —";
  const cleanCC = String(rawCC).replace(/^cc\s*/i, "").trim();
  const descripcion = tractor?.descripcion || state?.descripcion || "";

  useEffect(() => {
    setCargando(true);
    Promise.all([
      fetch(`/api/tractores/${tractorId}`).then((r) => (r.ok ? r.json() : null)),
      fetch(`/api/trabajos-tractor/tractor/${tractorId}`).then((r) => (r.ok ? r.json() : [])),
    ])
      .then(([tracRes, trabRes]) => {
        if (tracRes) setTractor(tracRes);
        const data = Array.isArray(trabRes) ? trabRes : [];
        setFilas(
          data.map((t) => ({
            id: t._id,
            fecha: t.fecha ? t.fecha.split("T")[0] : "",
            reparacion: t.reparacion || "",
            diagnostico: t.diagnostico || "",
            descripcion: t.descripcion || "",
            parte: t.parte || "",
            prioridad: t.prioridad || "Normal",
            estado: t.estado || "Pendiente",
            responsable: t.responsable || "",
            maquinaParada: !!t.maquinaParada,
            observaciones: t.observaciones || "",
            repuestos: (t.repuestos || []).map((r) => ({
              id: r._id,
              repuesto: r.repuesto || "",
              cantidad: r.cantidad || 1,
              precio: r.precio || 0,
              proveedor: r.proveedor || "",
              responsable: r.responsable || "",
              estado: r.estado || "Pedido",
              observaciones: r.observaciones || "",
            })),
          }))
        );
      })
      .catch(() => {})
      .finally(() => setCargando(false));
  }, [tractorId]);

  const reparacionesUnicas = useMemo(() => {
    return [...new Set(filas.map((f) => f.reparacion).filter(Boolean))].sort();
  }, [filas]);

  const responsablesUnicos = useMemo(() => {
    return [...new Set(filas.map((f) => f.responsable).filter(Boolean))].sort();
  }, [filas]);

  const filasFiltradas = useMemo(() => {
    return filas.filter((f) => {
      if (filtroReparacion && f.reparacion !== filtroReparacion) return false;
      if (filtroResponsable && f.responsable !== filtroResponsable) return false;
      if (filtroEstado === "activas") {
        return f.estado === "Pendiente" || f.estado === "En proceso";
      }
      if (filtroEstado && f.estado !== filtroEstado) return false;
      return true;
    });
  }, [filas, filtroReparacion, filtroResponsable, filtroEstado]);

  const estaParadoGlobal = useMemo(() => {
    return filas.some((f) => f.maquinaParada && f.estado !== "Terminado" && f.estado !== "Terminada");
  }, [filas]);

  // Exportar a Excel
  const exportarExcel = async () => {
    const wb = await nuevoWorkbook();
    const ws = wb.addWorksheet(`Tractor CC ${cleanCC}`);

    const thinBorder = {
      top: { style: "thin", color: { argb: "FFD0D0D0" } },
      left: { style: "thin", color: { argb: "FFD0D0D0" } },
      bottom: { style: "thin", color: { argb: "FFD0D0D0" } },
      right: { style: "thin", color: { argb: "FFD0D0D0" } },
    };

    ws.mergeCells("A1:I1");
    const tCell = ws.getCell("A1");
    tCell.value = `PLANILLA HISTÓRICA - TRACTOR CC ${cleanCC} ${descripcion ? `(${descripcion})` : ""}`;
    tCell.font = { bold: true, size: 14, color: { argb: "FFFFFFFF" } };
    tCell.alignment = { horizontal: "center", vertical: "middle" };
    tCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1E293B" } };
    ws.getRow(1).height = 30;

    const headers = [
      "Fecha",
      "Reparación",
      "Diagnóstico",
      "Detalle",
      "Prioridad",
      "Estado",
      "Responsable",
      "Máquina Parada",
      "Observaciones",
      "Repuestos",
    ];

    const hRow = ws.addRow(headers);
    hRow.eachCell((cell) => {
      cell.font = { bold: true, color: { argb: "FF000000" } };
      cell.alignment = { horizontal: "center", vertical: "middle" };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFD9D9D9" } };
      cell.border = thinBorder;
    });

    filasFiltradas.forEach((t) => {
      const repsStr = (t.repuestos || []).map((r) => `${r.cantidad}x ${r.repuesto} (${pesos(r.precio)})`).join(", ");
      ws.addRow([
        t.fecha ? t.fecha.split("-").reverse().join("/") : "-",
        t.reparacion || "-",
        t.diagnostico || "-",
        t.descripcion || "-",
        t.prioridad || "-",
        t.estado || "-",
        t.responsable || "-",
        t.maquinaParada ? "SÍ" : "NO",
        t.observaciones || "-",
        repsStr || "-",
      ]);
    });

    const buf = await wb.xlsx.writeBuffer();
    const blob = new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `historico_tractor_${cleanCC}_${new Date().toISOString().slice(0, 10)}.xlsx`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
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
        style={{ backgroundColor: "#1e293b", color: "#fff", height: "54px", position: "relative" }}
      >
        <LogoNavbar />
        <div className="d-flex align-items-center gap-3">
          <div
            className="rounded-3 d-flex align-items-center justify-content-center me-1"
            style={{
              width: "34px",
              height: "34px",
              backgroundColor: "#38bdf8",
              color: "#0f172a",
              fontSize: "1.15rem",
              boxShadow: "0 2px 8px rgba(56, 189, 248, 0.3)",
            }}
          >
            <i className="bi bi-table"></i>
          </div>
          <div className="d-flex align-items-center gap-2">
            <span className="text-white fs-6">Planilla Histórica (Vieja)</span>
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
            {descripcion && <span className="text-light opacity-75 small">• {descripcion}</span>}
            <Badge bg="info" text="dark" className="ms-2 small fw-semibold">
              <i className="bi bi-eye-fill me-1"></i>Solo Lectura
            </Badge>
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
            onClick={() => navigate(`/tractores/grupo/${grupoId}/reparaciones/${tractorId}/tareas`)}
            className="btn btn-sm btn-outline-light d-flex align-items-center gap-2 rounded-3 px-3 py-1"
            style={{ fontSize: "0.82rem" }}
          >
            <i className="bi bi-grid"></i>
            <span>Menú Tareas</span>
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
            onClick={exportarExcel}
            className="btn btn-sm btn-success d-flex align-items-center gap-1.5 rounded-3 px-3 py-1 text-white shadow-sm"
            style={{ fontSize: "0.82rem", backgroundColor: "#1d6f42", borderColor: "#1d6f42" }}
          >
            <i className="bi bi-file-earmark-excel-fill"></i>
            <span>Excel</span>
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

      <Container fluid className="px-4 py-3">
        {/* Banner de Estado */}
        <div className="d-flex justify-content-between align-items-center mb-3">
          <div className="d-flex align-items-center gap-2">
            <span
              className={`badge rounded-pill d-inline-flex align-items-center gap-2 px-3 py-1.5 ${
                estaParadoGlobal ? "bg-danger text-white" : "bg-success text-white"
              }`}
              style={{ fontSize: "0.82rem", fontWeight: 600 }}
            >
              <i className={`bi ${estaParadoGlobal ? "bi-record-circle-fill" : "bi-check-circle-fill"}`}></i>
              {estaParadoGlobal ? "UNIDAD PARADA" : "UNIDAD OPERATIVA"}
            </span>
            <span className="text-secondary small fst-italic ms-2">
              Visualización histórica sin modificación de datos.
            </span>
          </div>
        </div>

        {/* Filtros */}
        <div className="d-flex gap-3 mb-3 align-items-center flex-wrap bg-white p-2.5 rounded-3 border shadow-sm">
          {/* Filtro Reparacion */}
          <div className="position-relative" style={{ width: 220 }}>
            <Form.Select
              size="sm"
              value={filtroReparacion}
              onChange={(e) => setFiltroReparacion(e.target.value)}
              style={filtroReparacion ? selectActivo : {}}
            >
              <option value="">Reparación (todas)</option>
              {reparacionesUnicas.map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </Form.Select>
            {filtroReparacion && (
              <span onClick={() => setFiltroReparacion("")} style={estiloX}>X</span>
            )}
          </div>

          {/* Filtro Responsable */}
          <div className="position-relative" style={{ width: 200 }}>
            <Form.Select
              size="sm"
              value={filtroResponsable}
              onChange={(e) => setFiltroResponsable(e.target.value)}
              style={filtroResponsable ? selectActivo : {}}
            >
              <option value="">Responsable (todos)</option>
              {responsablesUnicos.map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </Form.Select>
            {filtroResponsable && (
              <span onClick={() => setFiltroResponsable("")} style={estiloX}>X</span>
            )}
          </div>

          {/* Filtro Estado */}
          <div className="position-relative" style={{ width: 200 }}>
            <Form.Select
              size="sm"
              value={filtroEstado}
              onChange={(e) => setFiltroEstado(e.target.value)}
              style={filtroEstado ? selectActivo : {}}
            >
              <option value="">Estado (todos)</option>
              <option value="activas">Activas (Pendientes/Proceso)</option>
              <option value="Pendiente">Pendiente</option>
              <option value="En proceso">En proceso</option>
              <option value="Terminado">Terminado</option>
            </Form.Select>
            {filtroEstado && (
              <span onClick={() => setFiltroEstado("")} style={estiloX}>X</span>
            )}
          </div>
        </div>

        {/* Tabla de Solo Lectura */}
        {cargando ? (
          <div className="text-center py-5 text-secondary">
            <i className="bi bi-arrow-repeat fs-2 d-inline-block spin"></i>
            <p className="mt-2 small">Cargando datos históricos...</p>
          </div>
        ) : (
          <div className="bg-white rounded-3 border shadow-sm" style={{ maxHeight: "calc(100vh - 220px)", overflowY: "auto" }}>
            <Table striped bordered hover size="sm" className="text-center align-middle mb-0" style={{ tableLayout: "fixed", width: "100%", fontSize: "0.78rem" }}>
              <thead className="table-dark" style={{ position: "sticky", top: 0, zIndex: 1 }}>
                <tr className="fw-normal align-middle">
                  <th className="fw-normal" style={{ width: "8%" }}>Fecha</th>
                  <th className="fw-normal" style={{ width: "24%" }}>Reparación</th>
                  <th className="fw-normal" style={{ width: "8%" }}>Detalle</th>
                  <th className="fw-normal" style={{ width: "8%" }}>Prioridad</th>
                  <th className="fw-normal" style={{ width: "10%" }}>Estado</th>
                  <th className="fw-normal" style={{ width: "10%" }}>Unidad Parada</th>
                  <th className="fw-normal" style={{ width: "14%" }}>Responsable</th>
                  <th className="fw-normal" style={{ width: "9%" }}>Observaciones</th>
                  <th className="fw-normal" style={{ width: "9%" }}>Repuestos</th>
                </tr>
              </thead>
              <tbody>
                {filasFiltradas.length === 0 && (
                  <tr>
                    <td colSpan={9} className="text-muted py-4">
                      Sin reparaciones para mostrar.
                    </td>
                  </tr>
                )}
                {filasFiltradas.map((f) => {
                  const est = f.estado || "Pendiente";
                  const colorEst = COLOR_ESTADO[est] || "#6c757d";

                  return (
                    <tr
                      key={f.id}
                      className={f.maquinaParada ? "tr-parada" : ""}
                      style={{ height: "36px", backgroundColor: f.maquinaParada ? "#fee2e2" : undefined }}
                    >
                      <td>{f.fecha ? f.fecha.split("-").reverse().join("/") : "-"}</td>
                      <td className="text-start fw-semibold" style={{ whiteSpace: "normal", wordBreak: "break-word" }}>
                        {f.reparacion || "-"}
                      </td>
                      <td>
                        <Button
                          size="sm"
                          variant="outline-secondary"
                          style={{ fontSize: "0.72rem", padding: "1px 6px" }}
                          onClick={() => setDetalleSel(f)}
                        >
                          <i className="bi bi-eye me-1"></i>Ver
                        </Button>
                      </td>
                      <td>
                        <span
                          className="badge"
                          style={{
                            backgroundColor: f.prioridad === "Crítico" ? "#dc3545" : f.prioridad === "Urgente" ? "#fd7e14" : "#6c757d",
                          }}
                        >
                          {f.prioridad || "Normal"}
                        </span>
                      </td>
                      <td>
                        <span
                          className="badge text-white"
                          style={{ backgroundColor: colorEst }}
                        >
                          {est}
                        </span>
                      </td>
                      <td>
                        {f.maquinaParada ? (
                          <span className="badge bg-danger text-white">SÍ (Parada)</span>
                        ) : (
                          <span className="badge bg-success text-white">NO</span>
                        )}
                      </td>
                      <td>{f.responsable || "-"}</td>
                      <td>
                        <Button
                          size="sm"
                          variant="outline-secondary"
                          style={{ fontSize: "0.72rem", padding: "1px 6px" }}
                          onClick={() => setObservacionesSel(f)}
                        >
                          <i className="bi bi-chat-text me-1"></i>Ver
                        </Button>
                      </td>
                      <td>
                        <Button
                          size="sm"
                          variant="outline-primary"
                          style={{ fontSize: "0.72rem", padding: "1px 6px" }}
                          onClick={() => setRepuestosSel(f)}
                        >
                          <i className="bi bi-box-seam me-1"></i>Ver ({f.repuestos?.length || 0})
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </Table>
          </div>
        )}
      </Container>

      {/* Modales de Solo Lectura */}
      {detalleSel && (
        <ModalDetalle reparacion={detalleSel} onCerrar={() => setDetalleSel(null)} />
      )}
      {observacionesSel && (
        <ModalObservaciones reparacion={observacionesSel} onCerrar={() => setObservacionesSel(null)} />
      )}
      {repuestosSel && (
        <ModalRepuestos reparacion={repuestosSel} onCerrar={() => setRepuestosSel(null)} />
      )}
    </div>
  );
}

export default TareasTractorVieja;
