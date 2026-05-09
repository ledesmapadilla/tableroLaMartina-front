import { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Container, Table, Button } from "react-bootstrap";
import ExcelJS from "exceljs";

const MESES = ["enero", "marzo", "mayo", "julio", "septiembre", "noviembre"];
const AÑO_DESDE = 2026;
const AÑOS = Array.from({ length: 10 }, (_, i) => AÑO_DESDE + i);

const SOMBRA = "3px 3px 6px rgba(0,0,0,0.45)";

const BTN_W = { minWidth: "90px", whiteSpace: "nowrap" };

const getEstiloBtn = (estado, puntuacion) => {
  if (estado !== "realizado") return { ...BTN_W, backgroundColor: "#777", color: "#fff", border: "none", boxShadow: SOMBRA };
  if (puntuacion <= 4)  return { ...BTN_W, backgroundColor: "#b87070", color: "#fff", border: "none", boxShadow: SOMBRA };
  if (puntuacion <= 7)  return { ...BTN_W, backgroundColor: "#c8a800", color: "#fff", border: "none", boxShadow: SOMBRA };
  return { ...BTN_W, backgroundColor: "#7aaa80", color: "#fff", border: "none", boxShadow: SOMBRA };
};

function ResumenCheckList() {
  const navigate = useNavigate();
  const [año, setAño] = useState(new Date().getFullYear());
  const [camionetas, setCamionetas] = useState([]);
  const [programas, setProgramas] = useState([]);
  const [dropdownAbierto, setDropdownAbierto] = useState(false);
  const [filtroCamioneta, setFiltroCamioneta] = useState("");
  const dropdownRef = useRef(null);

  useEffect(() => {
    const handler = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target))
        setDropdownAbierto(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  useEffect(() => {
    fetch("/api/camionetas")
      .then((r) => r.json())
      .then(setCamionetas)
      .catch(() => setCamionetas([]));
  }, []);

  useEffect(() => {
    fetch(`/api/programa-checklist/${año}`)
      .then((r) => r.json())
      .then(setProgramas)
      .catch(() => setProgramas([]));
  }, [año]);

  const getMes = (camionetaId, mes) => {
    const prog = programas.find((p) => p.camioneta?._id === camionetaId);
    return prog?.[mes] ?? { estado: "pendiente", puntuacion: null };
  };

  const exportarExcel = async () => {
    const titulo   = "Resumen Check List — Camionetas";
    const mesesCap = MESES.map((m) => m.charAt(0).toUpperCase() + m.slice(1));
    const columnas = ["Camioneta", ...mesesCap, "Promedio"];
    const fechaHoy = new Date().toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric" });

    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("Check List");

    ws.mergeCells(1, 1, 1, columnas.length);
    const celdaTitulo = ws.getCell("A1");
    celdaTitulo.value = titulo;
    celdaTitulo.font  = { bold: true, underline: true, size: 14 };
    celdaTitulo.alignment = { horizontal: "center", vertical: "middle" };
    ws.getRow(1).height = 22;

    ws.mergeCells(2, 1, 2, 3);
    const celdaFecha = ws.getCell("A2");
    celdaFecha.value = `Fecha: ${fechaHoy}`;
    celdaFecha.alignment = { horizontal: "left" };
    ws.getRow(2).height = 16;

    ws.addRow([]);

    const filaEncabezado = ws.addRow(columnas);
    filaEncabezado.eachCell((cell) => {
      cell.font      = { bold: true };
      cell.alignment = { horizontal: "center", vertical: "middle" };
      cell.fill      = { type: "pattern", pattern: "solid", fgColor: { argb: "FFD9D9D9" } };
    });
    ws.getRow(4).height = 16;

    camionetas.forEach((c) => {
      const puntuaciones = MESES.map((mes) => getMes(c._id, mes))
        .filter(({ estado, puntuacion }) => estado === "realizado" && puntuacion != null)
        .map(({ puntuacion }) => puntuacion);
      const promedio = puntuaciones.length > 0
        ? (puntuaciones.reduce((a, b) => a + b, 0) / puntuaciones.length).toFixed(1)
        : "—";

      const valores = [`${c.patente} — ${c.marca}`];
      MESES.forEach((mes) => {
        const { estado, puntuacion } = getMes(c._id, mes);
        valores.push(estado === "realizado" ? (puntuacion != null ? `Realizado (${puntuacion})` : "Realizado") : "Pendiente");
      });
      valores.push(promedio);

      const fila = ws.addRow(valores);
      fila.eachCell((cell) => { cell.alignment = { horizontal: "center", vertical: "middle" }; });
      fila.getCell(1).alignment = { horizontal: "left", vertical: "middle" };
    });

    ws.columns = [
      { width: 30 },
      ...MESES.map(() => ({ width: 18 })),
      { width: 12 },
    ];

    const buffer = await wb.xlsx.writeBuffer();
    const blob   = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    const url    = URL.createObjectURL(blob);
    const a      = document.createElement("a");
    a.href       = url;
    a.download   = `checklist_${año}.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Container className="py-4">

      {/* Encabezado */}
      <div className="d-flex justify-content-between align-items-center mb-4 mx-auto" style={{ width: "92%" }}>
        <h3 className="fw-bold mb-0">Resumen Check List — Camionetas</h3>
        <div className="d-flex gap-2">
          <Button onClick={exportarExcel} style={{ backgroundColor: "#1d6f42", border: "1px solid #1d6f42", color: "#fff" }}>
            <i className="bi bi-file-earmark-excel-fill me-2"></i>Excel
          </Button>
          <Button onClick={() => navigate(-1)} style={{ backgroundColor: "#fff", border: "1px solid #000", color: "#000" }}>
            <i className="bi bi-arrow-left me-2"></i>Volver
          </Button>
          <Button onClick={() => navigate("/camionetas/resumen")} style={{ backgroundColor: "#fff", border: "1px solid #000", color: "#000" }}>
            <i className="bi bi-speedometer me-2"></i>Tablero
          </Button>
          <Button onClick={() => navigate("/")} style={{ backgroundColor: "#fff", border: "1px solid #000", color: "#000" }}>
            <i className="bi bi-house-fill me-2"></i>General
          </Button>
        </div>
      </div>

      {/* Selector de año + filtro */}
      <div className="d-flex justify-content-between align-items-center mb-4 mx-auto" style={{ width: "92%" }}>
        <div ref={dropdownRef} style={{ position: "relative" }}>
          <span
            onClick={() => setDropdownAbierto((v) => !v)}
            style={{ display: "inline-block", backgroundColor: "#666", color: "#fff", borderRadius: "4px", padding: "6px 28px", boxShadow: "3px 3px 6px rgba(0,0,0,0.45)", fontWeight: "bold", fontSize: "1.4rem", cursor: "pointer", userSelect: "none" }}
          >
            {año}
          </span>
          {dropdownAbierto && (
            <div style={{ position: "absolute", top: "110%", left: 0, backgroundColor: "#fff", border: "1.5px solid #aaa", borderRadius: "6px", boxShadow: "3px 3px 10px rgba(0,0,0,0.25)", zIndex: 200, minWidth: "90px" }}>
              {AÑOS.map((a) => (
                <div
                  key={a}
                  onClick={() => { setAño(a); setDropdownAbierto(false); }}
                  style={{ padding: "6px 18px", cursor: "pointer", fontWeight: a === año ? "bold" : "normal", backgroundColor: a === año ? "#e3f0ff" : "transparent", borderRadius: "4px" }}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = "#e3f0ff"}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = a === año ? "#e3f0ff" : "transparent"}
                >
                  {a}
                </div>
              ))}
            </div>
          )}
        </div>
        <select
          value={filtroCamioneta}
          onChange={(e) => setFiltroCamioneta(e.target.value)}
          style={{ padding: "6px 12px", borderRadius: "4px", border: "1.5px solid #aaa", fontSize: "1rem", minWidth: "220px", cursor: "pointer" }}
        >
          <option value="">Todas las camionetas</option>
          {camionetas.map((c) => (
            <option key={c._id} value={c._id}>{c.patente} — {c.marca}</option>
          ))}
        </select>
      </div>

      {/* Tabla */}
      <div className="mx-auto" style={{ width: "92%", maxHeight: "65vh", overflowY: "auto" }}>
      <Table bordered size="sm" className="text-center align-middle mb-0" style={{ whiteSpace: "nowrap" }}>
        <thead className="table-dark" style={{ position: "sticky", top: 0, zIndex: 1 }}>
          <tr>
            <th>Camioneta</th>
            {MESES.map((m) => (
              <th key={m} style={{ textTransform: "capitalize" }}>{m}</th>
            ))}
            <th>Promedio</th>
          </tr>
        </thead>
        <tbody>
          {camionetas.filter((c) => !filtroCamioneta || c._id === filtroCamioneta).map((c) => {
            const puntuaciones = MESES.map((mes) => getMes(c._id, mes))
              .filter(({ estado, puntuacion }) => estado === "realizado" && puntuacion != null)
              .map(({ puntuacion }) => puntuacion);
            const promedio = puntuaciones.length > 0
              ? (puntuaciones.reduce((a, b) => a + b, 0) / puntuaciones.length).toFixed(1)
              : null;
            return (
              <tr key={c._id} style={{ height: "42px" }}>
                <td className="fw-semibold text-start" style={{ padding: "4px 8px" }}>
                  <span style={{ display: "inline-block", backgroundColor: "#4a6fa5", color: "#fff", borderRadius: "4px", padding: "2px 10px", boxShadow: "3px 3px 6px rgba(0,0,0,0.45)" }}>
                    {c.patente} — {c.marca}
                  </span>
                </td>
                {MESES.map((mes) => {
                  const { estado, puntuacion, camionetatParada } = getMes(c._id, mes);
                  return (
                    <td key={mes}>
                      <Button
                        size="sm"
                        className="btn-placa"
                        style={getEstiloBtn(estado, puntuacion)}
                        onClick={() => navigate("/camionetas/checklist/form", { state: { mes, camionetaId: c._id } })}
                      >
                        {estado === "realizado"
                          ? camionetatParada
                            ? <i className="bi bi-exclamation-triangle-fill" style={{ fontSize: "1rem" }} />
                            : <>Realizado {puntuacion != null && <span style={{ fontWeight: "bold", marginLeft: "4px" }}>({puntuacion})</span>}</>
                          : "Pendiente"}
                      </Button>
                    </td>
                  );
                })}
                <td className="fw-bold" style={{ fontSize: "1rem" }}>
                  {promedio != null
                    ? <span style={{ display: "inline-block", backgroundColor: promedio >= 8 ? "#7aaa80" : promedio >= 5 ? "#c8a800" : "#b87070", color: "#fff", borderRadius: "4px", padding: "2px 12px", boxShadow: SOMBRA }}>{promedio}</span>
                    : <span className="text-muted">—</span>}
                </td>
              </tr>
            );
          })}
        </tbody>
      </Table>
      </div>

    </Container>
  );
}

export default ResumenCheckList;


