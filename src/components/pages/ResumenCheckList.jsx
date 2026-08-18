import { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Container, Table, Button, Form } from "react-bootstrap";
import { nuevoWorkbook } from "../../helpers/excel";

const MESES = ["enero", "marzo", "mayo", "julio", "septiembre", "noviembre"];
const AÑO_DESDE = 2026;
const AÑOS = Array.from({ length: 6 }, (_, i) => AÑO_DESDE + i);

function ResumenCheckList() {
  const navigate = useNavigate();
  const [año, setAño] = useState(2026);
  const [camionetas, setCamionetas] = useState([]);
  const [programas, setProgramas] = useState([]);
  const [paradasAbiertas, setParadasAbiertas] = useState(new Set());
  const [dropAño, setDropAño] = useState(false);
  const [filtroPatente, setFiltroPatente] = useState("");
  const dropAñoRef = useRef(null);

  useEffect(() => {
    const handler = (e) => {
      if (dropAñoRef.current && !dropAñoRef.current.contains(e.target)) {
        setDropAño(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const cargarCamionetas = () =>
    fetch("/api/camionetas")
      .then((r) => (r.ok ? r.json() : []))
      .then((d) => setCamionetas(Array.isArray(d) ? d : []))
      .catch(() => setCamionetas([]));

  const cargarParadas = () =>
    fetch("/api/paradas/abiertas/ids")
      .then((r) => (r.ok ? r.json() : []))
      .then((ids) => setParadasAbiertas(new Set(Array.isArray(ids) ? ids : [])))
      .catch(() => setParadasAbiertas(new Set()));

  const cargarProgramas = (a) =>
    fetch(`/api/programa-checklist/${a}`)
      .then((r) => (r.ok ? r.json() : []))
      .then((d) => setProgramas(Array.isArray(d) ? d : []))
      .catch(() => setProgramas([]));

  useEffect(() => {
    cargarCamionetas();
    cargarParadas();
  }, []);

  useEffect(() => {
    cargarProgramas(año);
  }, [año]);

  const getMes = (camionetaId, mes) => {
    const prog = Array.isArray(programas)
      ? programas.find((p) => p.camioneta?._id === camionetaId || p.camioneta === camionetaId)
      : null;
    return prog?.[mes] ?? { estado: "pendiente", puntuacion: null };
  };

  const getBadgeMes = (estado, puntuacion, camionetaParada) => {
    if (estado !== "realizado" || (!camionetaParada && (puntuacion == null || isNaN(puntuacion)))) {
      return {
        bg: "#f1f5f9",
        color: "#64748b",
        border: "1px solid #cbd5e1",
        label: "Pendiente",
      };
    }
    if (camionetaParada) {
      return {
        bg: "#fee2e2",
        color: "#991b1b",
        border: "1px solid #f87171",
        label: "Parada",
        icon: "bi bi-exclamation-triangle-fill",
      };
    }
    if (puntuacion <= 4) {
      return {
        bg: "#fee2e2",
        color: "#991b1b",
        border: "1px solid #fca5a5",
        label: `Realizado (${puntuacion})`,
      };
    }
    if (puntuacion <= 7) {
      return {
        bg: "#fef3c7",
        color: "#92400e",
        border: "1px solid #fcd34d",
        label: `Realizado (${puntuacion})`,
      };
    }
    return {
      bg: "#dcfce7",
      color: "#166534",
      border: "1px solid #86efac",
      label: `Realizado (${puntuacion})`,
    };
  };

  const exportarExcel = async () => {
    const titulo = `Resumen Check List - Flota de Camionetas (${año})`;
    const mesesCap = MESES.map((m) => m.charAt(0).toUpperCase() + m.slice(1));
    const columnas = ["Patente", "Vehículo", "Responsable", ...mesesCap, "Promedio"];
    const fechaHoy = new Date().toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric" });

    const wb = await nuevoWorkbook();
    const ws = wb.addWorksheet("Check List");

    ws.mergeCells(1, 1, 1, columnas.length);
    const celdaTitulo = ws.getCell("A1");
    celdaTitulo.value = titulo;
    celdaTitulo.font = { bold: true, size: 14, color: { argb: "FF1E293B" } };
    celdaTitulo.alignment = { horizontal: "center", vertical: "middle" };
    ws.getRow(1).height = 28;

    ws.mergeCells(2, 1, 2, 3);
    const celdaFecha = ws.getCell("A2");
    celdaFecha.value = `Generado el: ${fechaHoy}`;
    celdaFecha.font = { italic: true, size: 10, color: { argb: "FF64748B" } };
    celdaFecha.alignment = { horizontal: "left", vertical: "middle" };
    ws.getRow(2).height = 18;

    ws.addRow([]);

    const filaEncabezado = ws.addRow(columnas);
    filaEncabezado.eachCell((cell) => {
      cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
      cell.alignment = { horizontal: "center", vertical: "middle" };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF334155" } };
      cell.border = {
        top: { style: "thin", color: { argb: "FF475569" } },
        left: { style: "thin", color: { argb: "FF475569" } },
        bottom: { style: "thin", color: { argb: "FF475569" } },
        right: { style: "thin", color: { argb: "FF475569" } },
      };
    });
    ws.getRow(4).height = 24;

    const thinBorder = {
      top: { style: "thin", color: { argb: "FFE2E8F0" } },
      left: { style: "thin", color: { argb: "FFE2E8F0" } },
      bottom: { style: "thin", color: { argb: "FFE2E8F0" } },
      right: { style: "thin", color: { argb: "FFE2E8F0" } },
    };

    camionetas.forEach((c, idx) => {
      const estaParada = paradasAbiertas.has(c._id.toString());
      const puntuaciones = MESES.map((mes) => getMes(c._id, mes))
        .filter(({ estado, puntuacion, camionetatParada }) => !camionetatParada && estado === "realizado" && puntuacion != null && !isNaN(puntuacion))
        .map(({ puntuacion }) => Number(puntuacion));
      const promedio = puntuaciones.length > 0
        ? (puntuaciones.reduce((a, b) => a + b, 0) / puntuaciones.length).toFixed(1)
        : "—";

      const valores = [c.patente, c.marca, c.responsable || "—"];
      MESES.forEach((mes) => {
        const { estado, puntuacion, camionetatParada } = getMes(c._id, mes);
        if (camionetatParada) {
          valores.push("Parada");
        } else if (estado === "realizado" && puntuacion != null && !isNaN(puntuacion)) {
          valores.push(`Realizado (${puntuacion})`);
        } else {
          valores.push("Pendiente");
        }
      });
      valores.push(promedio);

      const fila = ws.addRow(valores);
      fila.height = 20;

      const isOdd = idx % 2 === 1;
      const zebraBg = isOdd ? { type: "pattern", pattern: "solid", fgColor: { argb: "FFF8FAFC" } } : undefined;

      fila.eachCell({ includeEmpty: true }, (cell) => {
        cell.alignment = { horizontal: "center", vertical: "middle" };
        cell.border = thinBorder;
        if (estaParada) {
          cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFEE2E2" } };
        } else if (zebraBg) {
          cell.fill = zebraBg;
        }
      });
      fila.getCell(1).font = { bold: true };
      fila.getCell(2).alignment = { horizontal: "left", vertical: "middle" };
      fila.getCell(3).alignment = { horizontal: "left", vertical: "middle" };
    });

    ws.columns = [
      { width: 14 },
      { width: 22 },
      { width: 22 },
      ...MESES.map(() => ({ width: 16 })),
      { width: 14 },
    ];

    const buffer = await wb.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `checklist_${año}.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const totalCams = camionetas.length;

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
              backgroundColor: "#3b82f6",
              color: "#fff",
              fontSize: "1.15rem",
              boxShadow: "0 2px 8px rgba(59, 130, 246, 0.3)",
            }}
          >
            <i className="bi bi-clipboard-check-fill"></i>
          </div>
          <div className="d-flex align-items-center gap-2">
            <span className="text-white fs-6">Resumen Check List</span>
            <span className="text-light opacity-75 small">• {totalCams} Unidades</span>
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
            onClick={() => navigate("/camionetas/preventivo")}
            className="btn btn-sm btn-outline-light d-flex align-items-center gap-1.5 rounded-3 px-3 py-1"
            style={{ fontSize: "0.82rem" }}
          >
            <i className="bi bi-shield-check"></i>
            <span>Preventivo</span>
          </button>
          <button
            onClick={() => navigate("/camionetas")}
            className="btn btn-sm btn-outline-light d-flex align-items-center gap-2 rounded-3 px-3 py-1"
            style={{ fontSize: "0.82rem" }}
          >
            <i className="bi bi-car-front-fill me-1"></i>
            <span>Camionetas</span>
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
      <Container fluid className="px-4 py-3 d-flex flex-column flex-grow-1" style={{ overflow: "hidden" }}>
        {/* Barra de Filtros y Acciones */}
        <div
          className="d-flex align-items-center justify-content-between mb-3 flex-wrap gap-2"
          style={{ maxWidth: "1050px", width: "100%", margin: "0 auto" }}
        >
          {/* Año y Buscador de Patente bien separados a la izquierda */}
          <div className="d-flex align-items-center gap-4 flex-wrap">
            {/* Dropdown de Año */}
            <div ref={dropAñoRef} style={{ position: "relative" }}>
              <button
                onClick={() => setDropAño((v) => !v)}
                className="btn btn-sm d-flex align-items-center gap-2 rounded-3 px-3 py-1.5 text-white shadow-sm"
                style={{
                  backgroundColor: "#1e293b",
                  border: "1px solid #475569",
                  fontWeight: 600,
                  fontSize: "0.88rem",
                }}
              >
                <i className="bi bi-calendar3"></i>
                <span>Año {año}</span>
                <i className={`bi bi-chevron-${dropAño ? "up" : "down"} small opacity-75`}></i>
              </button>
              {dropAño && (
                <div
                  style={{
                    position: "absolute",
                    top: "115%",
                    left: 0,
                    backgroundColor: "#fff",
                    border: "1px solid #cbd5e1",
                    borderRadius: "8px",
                    boxShadow: "0 8px 24px rgba(0,0,0,0.15)",
                    zIndex: 200,
                    minWidth: "110px",
                    overflow: "hidden",
                  }}
                >
                  {AÑOS.map((a) => (
                    <div
                      key={a}
                      onClick={() => {
                        setAño(a);
                        setDropAño(false);
                      }}
                      style={{
                        padding: "8px 16px",
                        cursor: "pointer",
                        fontWeight: a === año ? "700" : "400",
                        backgroundColor: a === año ? "#f1f5f9" : "transparent",
                        color: a === año ? "#1e293b" : "#334155",
                        fontSize: "0.88rem",
                      }}
                      onMouseEnter={(e) => {
                        if (a !== año) e.currentTarget.style.backgroundColor = "#f8fafc";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = a === año ? "#f1f5f9" : "transparent";
                      }}
                    >
                      {a}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Buscador de Patente separado */}
            <div style={{ position: "relative", width: "220px" }}>
              <i
                className="bi bi-search text-muted"
                style={{ position: "absolute", left: "10px", top: "50%", transform: "translateY(-50%)", fontSize: "0.82rem" }}
              ></i>
              <Form.Control
                type="text"
                placeholder="Buscar patente o marca..."
                value={filtroPatente}
                onChange={(e) => setFiltroPatente(e.target.value)}
                size="sm"
                className="rounded-3 ps-4"
                style={{ fontSize: "0.84rem", paddingRight: filtroPatente ? "28px" : undefined }}
              />
              {filtroPatente && (
                <button
                  onClick={() => setFiltroPatente("")}
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
          </div>

          {/* Botón Excel a la derecha */}
          <div className="d-flex align-items-center">
            <Button
              variant="success"
              size="sm"
              onClick={exportarExcel}
              className="d-inline-flex align-items-center gap-1.5 rounded-3 px-3 py-1.5 shadow-sm"
              style={{
                backgroundColor: "#15803d",
                borderColor: "#15803d",
                fontSize: "0.82rem",
                fontWeight: 500,
              }}
              title="Exportar resumen a Excel"
            >
              <i className="bi bi-file-earmark-excel-fill"></i>
              <span>Excel</span>
            </Button>
          </div>
        </div>

        {/* Tabla de Resumen Check List */}
        <div
          className="flex-grow-1 shadow-sm rounded-3 bg-white"
          style={{
            overflowY: "auto",
            overflowX: "auto",
            border: "1px solid #cbd5e1",
            maxWidth: "1050px",
            width: "100%",
            margin: "0 auto",
          }}
        >
          <Table
            hover
            size="sm"
            className="text-center align-middle mb-0"
            style={{ whiteSpace: "nowrap", fontSize: "0.78rem", width: "100%" }}
          >
            <thead style={{ position: "sticky", top: 0, zIndex: 10, backgroundColor: "#1e293b", color: "#fff" }}>
              <tr className="fw-normal align-middle">
                <th style={{ width: "30px", backgroundColor: "#1e293b", color: "#fff", padding: "6px 4px", fontWeight: "normal" }}>#</th>
                <th style={{ width: "160px", backgroundColor: "#1e293b", color: "#fff", padding: "6px 8px", textAlign: "left", fontWeight: "normal" }}>Patente</th>
                <th style={{ width: "130px", backgroundColor: "#1e293b", color: "#fff", padding: "6px 6px", fontWeight: "normal" }}>Responsable</th>
                {MESES.map((m) => (
                  <th key={m} style={{ backgroundColor: "#1e293b", color: "#fff", padding: "6px 4px", textTransform: "capitalize", fontWeight: "normal" }}>
                    {m}
                  </th>
                ))}
                <th style={{ width: "80px", backgroundColor: "#1e293b", color: "#fff", padding: "6px 6px", fontWeight: "normal" }}>Promedio</th>
              </tr>
            </thead>
            <tbody>
              {camionetas
                .filter((c) => {
                  const query = filtroPatente.toLowerCase();
                  return c.patente.toLowerCase().includes(query) || (c.marca && c.marca.toLowerCase().includes(query));
                })
                .map((c, idx) => {
                  const estaParada = paradasAbiertas.has(c._id.toString());
                  const isEven = idx % 2 === 0;

                  const puntuaciones = MESES.map((mes) => getMes(c._id, mes))
                    .filter(({ estado, puntuacion, camionetatParada }) => !camionetatParada && estado === "realizado" && puntuacion != null && !isNaN(puntuacion))
                    .map(({ puntuacion }) => Number(puntuacion));
                  const promedio = puntuaciones.length > 0
                    ? (puntuaciones.reduce((a, b) => a + b, 0) / puntuaciones.length).toFixed(1)
                    : null;

                  return (
                    <tr
                      key={c._id}
                      style={{
                        backgroundColor: estaParada ? "#fef2f2" : isEven ? "#ffffff" : "#f8fafc",
                        borderBottom: "1px solid #e2e8f0",
                        height: "40px",
                      }}
                    >
                      <td className="text-muted" style={{ fontSize: "0.75rem", padding: "4px 2px" }}>
                        {idx + 1}
                      </td>

                      {/* Patente y Marca (sin palabra parada) */}
                      <td
                        className="text-start"
                        style={{ padding: "4px 8px", cursor: "pointer" }}
                        onClick={() => navigate("/camionetas/altas")}
                        title="Ver ficha de camioneta"
                      >
                        <div className="d-flex align-items-center gap-2">
                          <span
                            className="badge px-2 py-0.5 text-white shadow-sm me-1"
                            style={{
                              backgroundColor: estaParada ? "#991b1b" : "#0f172a",
                              border: "1px solid #475569",
                              fontSize: "0.78rem",
                              letterSpacing: "1px",
                              borderRadius: "5px",
                              fontWeight: 700,
                            }}
                          >
                            {c.patente}
                          </span>
                          <span className="text-muted small" style={{ fontSize: "0.76rem" }}>
                            {c.marca}
                          </span>
                        </div>
                      </td>

                      {/* Responsable */}
                      <td style={{ color: "#334155", fontSize: "0.78rem", padding: "4px 6px" }}>{c.responsable || "—"}</td>

                      {/* Meses */}
                      {MESES.map((mes) => {
                        const { estado, puntuacion, camionetatParada } = getMes(c._id, mes);
                        const badgeInfo = getBadgeMes(estado, puntuacion, camionetatParada);

                        return (
                          <td key={mes} style={{ padding: "4px 3px" }}>
                            <button
                              onClick={() => navigate("/camionetas/checklist/form", { state: { mes, camionetaId: c._id } })}
                              className="btn btn-sm py-0.5 px-2 rounded-2 shadow-sm d-inline-flex align-items-center justify-content-center gap-1"
                              style={{
                                backgroundColor: badgeInfo.bg,
                                color: badgeInfo.color,
                                border: badgeInfo.border,
                                fontSize: "0.74rem",
                                fontWeight: 600,
                                minWidth: "85px",
                                transition: "all 0.15s ease",
                              }}
                              title={`Abrir Check List de ${mes}`}
                            >
                              {badgeInfo.icon && <i className={badgeInfo.icon}></i>}
                              <span>{badgeInfo.label}</span>
                            </button>
                          </td>
                        );
                      })}

                      {/* Promedio */}
                      <td style={{ padding: "4px 6px" }}>
                        {promedio != null ? (
                          <span
                            className="badge py-1 px-2 text-white shadow-sm"
                            style={{
                              backgroundColor:
                                Number(promedio) >= 8 ? "#15803d" : Number(promedio) >= 5 ? "#d97706" : "#dc2626",
                              fontSize: "0.78rem",
                              fontWeight: 700,
                              borderRadius: "5px",
                              minWidth: "38px",
                            }}
                          >
                            {promedio}
                          </span>
                        ) : (
                          <span className="text-muted small">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              {camionetas.filter((c) => {
                const query = filtroPatente.toLowerCase();
                return c.patente.toLowerCase().includes(query) || (c.marca && c.marca.toLowerCase().includes(query));
              }).length === 0 && (
                <tr>
                  <td colSpan={10} className="text-muted py-4">
                    {filtroPatente ? `Sin resultados para "${filtroPatente}"` : "Sin datos"}
                  </td>
                </tr>
              )}
            </tbody>
          </Table>
        </div>
      </Container>
    </div>
  );
}

export default ResumenCheckList;
