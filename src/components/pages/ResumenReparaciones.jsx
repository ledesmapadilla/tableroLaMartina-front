import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Container, Table, Button } from "react-bootstrap";
import ExcelJS from "exceljs";

const formatF = (iso) =>
  iso ? new Date(iso).toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric" }) : "—";

const URGENCIA_COLORES = { baja: "#7aaa80", media: "#c8a800", alta: "#8b4a4a" };

function ResumenReparaciones() {
  const navigate = useNavigate();
  const [trabajos, setTrabajos] = useState([]);
  const [filtro, setFiltro] = useState("pendiente");
  const [listaResponsables, setListaResponsables] = useState([]);

  useEffect(() => {
    fetch("/api/trabajos-camioneta")
      .then((r) => r.json())
      .then(setTrabajos)
      .catch(() => setTrabajos([]));

    fetch("/api/camionetas")
      .then((r) => r.json())
      .then((cams) => {
        const unicos = [...new Set(cams.map((c) => c.responsable).filter(Boolean))].sort();
        setListaResponsables(unicos);
      })
      .catch(() => {});
  }, []);

  const cambiarResponsable = async (id, responsable) => {
    setTrabajos((prev) => prev.map((t) => t._id === id ? { ...t, responsable } : t));
    await fetch(`/api/trabajos-camioneta/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ responsable }),
    }).catch(() => {});
  };

  const trabajosFiltrados = trabajos.filter((t) =>
    filtro === "todos" || (t.estado ?? "pendiente") === filtro
  );

  const exportarExcel = async () => {
    const fechaHoy = new Date().toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric" });
    const titulo = "Resumen Reparaciones Camionetas";
    const columnas = ["Patente", "Tarea", "Fecha tarea", "Urgencia", "Estado", "Responsable"];

    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("Reparaciones");

    ws.mergeCells(1, 1, 1, columnas.length);
    const celdaTitulo = ws.getCell("A1");
    celdaTitulo.value = titulo;
    celdaTitulo.font = { bold: true, underline: true, size: 14 };
    celdaTitulo.alignment = { horizontal: "center", vertical: "middle" };
    ws.getRow(1).height = 22;

    ws.mergeCells(2, 1, 2, 3);
    const celdaFecha = ws.getCell("A2");
    celdaFecha.value = `Fecha: ${fechaHoy}`;
    celdaFecha.alignment = { horizontal: "left" };
    ws.getRow(2).height = 16;

    ws.addRow([]);

    const filaEnc = ws.addRow(columnas);
    filaEnc.eachCell((cell) => {
      cell.font = { bold: true };
      cell.alignment = { horizontal: "center", vertical: "middle" };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFD9D9D9" } };
    });
    ws.getRow(4).height = 16;

    trabajosFiltrados.forEach((t) => {
      const urgencia = t.urgencia ?? "baja";
      const responsable = t.responsable || t.camioneta?.responsable || "—";
      const fila = ws.addRow([
        t.camioneta?.patente ?? "—",
        t.descripcion,
        formatF(t.fecha),
        urgencia,
        (t.estado ?? "pendiente") === "terminada" ? "Terminada" : "Pendiente",
        responsable,
      ]);
      fila.eachCell((cell) => { cell.alignment = { horizontal: "center", vertical: "middle" }; });
      fila.getCell(2).alignment = { horizontal: "left", vertical: "middle" };
      if (urgencia === "alta") {
        fila.eachCell((cell) => { cell.font = { color: { argb: "FFCC0000" } }; });
      }
    });

    ws.columns = [{ width: 14 }, { width: 40 }, { width: 14 }, { width: 12 }, { width: 12 }, { width: 20 }];

    const buffer = await wb.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `reparaciones_${filtro}.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Container className="py-4">

      <div className="d-flex justify-content-between align-items-center mb-4 mx-auto" style={{ width: "92%" }}>
        <h3 className="fw-bold mb-0">Resumen Reparaciones Camionetas</h3>
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

      <div className="mx-auto mb-3" style={{ width: "92%" }}>
        <select
          value={filtro}
          onChange={(e) => setFiltro(e.target.value)}
          style={{ padding: "6px 16px", borderRadius: "4px", border: "1.5px solid #aaa", fontSize: "1rem", cursor: "pointer" }}
        >
          <option value="todos">Todas</option>
          <option value="pendiente">Pendientes</option>
          <option value="terminada">Terminadas</option>
        </select>
      </div>

      <div className="mx-auto" style={{ width: "92%", maxHeight: "70vh", overflowY: "auto" }}>
        <Table bordered size="sm" className="text-center align-middle mb-0" style={{ whiteSpace: "nowrap" }}>
          <thead className="table-dark" style={{ position: "sticky", top: 0, zIndex: 1 }}>
            <tr>
              <th>Patente</th>
              <th className="text-start">Tarea</th>
              <th>Fecha tarea</th>
              <th>Urgencia</th>
              <th>Estado</th>
              <th>Responsable</th>
            </tr>
          </thead>
          <tbody>
            {trabajosFiltrados.length === 0 && (
              <tr><td colSpan={6} className="text-muted py-3">Sin registros</td></tr>
            )}
            {trabajosFiltrados.map((t) => {
              const urgencia    = t.urgencia ?? "baja";
              const estado      = t.estado   ?? "pendiente";
              const responsable = t.responsable || t.camioneta?.responsable || "";
              return (
                <tr key={t._id}>
                  <td>
                    <span style={{ display: "inline-block", backgroundColor: "#4a6fa5", color: "#fff", borderRadius: "4px", padding: "2px 10px", boxShadow: "3px 3px 6px rgba(0,0,0,0.3)", fontWeight: "600" }}>
                      {t.camioneta?.patente ?? "—"}
                    </span>
                  </td>
                  <td className="text-start" style={{ paddingLeft: "12px" }}>{t.descripcion}</td>
                  <td>{formatF(t.fecha)}</td>
                  <td>
                    <span style={{ display: "inline-block", backgroundColor: URGENCIA_COLORES[urgencia], color: "#fff", borderRadius: "4px", padding: "2px 10px", boxShadow: "3px 3px 6px rgba(0,0,0,0.3)", textTransform: "capitalize", minWidth: "60px" }}>
                      {urgencia}
                    </span>
                  </td>
                  <td>
                    <span style={{ display: "inline-block", backgroundColor: estado === "terminada" ? "#52735a" : "#8b4a4a", color: "#fff", borderRadius: "4px", padding: "2px 10px", boxShadow: "3px 3px 6px rgba(0,0,0,0.3)", textTransform: "capitalize", minWidth: "80px" }}>
                      {estado === "terminada" ? "Terminada" : "Pendiente"}
                    </span>
                  </td>
                  <td>
                    <select
                      value={responsable}
                      onChange={(e) => cambiarResponsable(t._id, e.target.value)}
                      style={{ padding: "2px 6px", borderRadius: "4px", border: "1px solid #aaa", fontSize: "0.85rem", cursor: "pointer", minWidth: "120px" }}
                    >
                      <option value="">— Sin asignar —</option>
                      {listaResponsables.map((r) => (
                        <option key={r} value={r}>{r}</option>
                      ))}
                    </select>
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

export default ResumenReparaciones;
