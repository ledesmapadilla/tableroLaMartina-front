import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Container, Table, Button } from "react-bootstrap";
import ExcelJS from "exceljs";
import Swal from "sweetalert2";

const formatF = (iso) =>
  iso ? new Date(iso).toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric" }) : "-";

const PRIORIDAD_COLORES = { baja: "#7aaa80", media: "#c8a800", alta: "#8b4a4a" };

const getPrioridadLabel = (urg) => {
  const u = (urg || "").trim().toLowerCase();
  if (u === "alta") return "Alta";
  if (u === "media") return "Media";
  return "Baja";
};

const getPrioridadColor = (urg) => {
  const u = (urg || "").trim().toLowerCase();
  return PRIORIDAD_COLORES[u] || PRIORIDAD_COLORES.baja;
};

const getEstadoLabel = (est) => {
  const e = (est || "").trim().toLowerCase();
  if (e === "terminada" || e === "terminado") return "Terminado";
  if (e === "en proceso") return "En proceso";
  return "Pendiente";
};

const getEstadoColor = (est) => {
  const e = (est || "").trim().toLowerCase();
  if (e === "terminada" || e === "terminado") return "#52735a";
  if (e === "en proceso") return "#c8a800";
  return "#8b4a4a";
};

function ResumenReparaciones() {
  const navigate = useNavigate();
  const [trabajos, setTrabajos] = useState([]);
  const [filtro, setFiltro] = useState("pendiente");
  const [filtroPatente, setFiltroPatente] = useState("");
  const [filtroUrgencia, setFiltroUrgencia] = useState("");
  const [filtroResponsable, setFiltroResponsable] = useState("");
  const [listaResponsables, setListaResponsables] = useState([]);

  useEffect(() => {
    fetch("/api/trabajos-camioneta")
      .then((r) => r.json())
      .then(setTrabajos)
      .catch(() => setTrabajos([]));

    fetch("/api/camionetas")
      .then((r) => r.json())
      .then((cams) => {
        setListaResponsables([...new Set(cams.map((c) => c.responsable).filter(Boolean))].sort());
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

  const eliminar = async (id) => {
    const result = await Swal.fire({
      title: "¿Eliminar reparación?",
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#7a4040",
      confirmButtonText: "Sí, eliminar",
      cancelButtonText: "Cancelar",
    });
    if (!result.isConfirmed) return;
    await fetch(`/api/trabajos-camioneta/${id}`, { method: "DELETE" }).catch(() => {});
    setTrabajos((prev) => prev.filter((t) => t._id !== id));
  };

  const listaResponsablesFiltrada = [...new Set(
    trabajos
      .filter((t) => {
        const estLower = (t.estado || "").trim().toLowerCase();
        return estLower !== "terminada" && estLower !== "terminado";
      })
      .map((t) => t.responsable || t.camioneta?.responsable || "")
      .filter(Boolean)
  )].sort();

  const listaPatentes = [...new Map(
    trabajos
      .filter((t) => t.camioneta?.patente)
      .map((t) => [t.camioneta.patente, { patente: t.camioneta.patente, label: `${t.camioneta.patente} - ${t.camioneta.marca}` }])
  ).values()].sort((a, b) => a.patente.localeCompare(b.patente));

  const trabajosFiltrados = trabajos
    .filter((t) => {
      if (filtro !== "todos") {
        const estLower = (t.estado || "").trim().toLowerCase();
        const esTerminada = estLower === "terminada" || estLower === "terminado";
        if (filtro === "terminada" && !esTerminada) return false;
        if (filtro === "pendiente" && esTerminada) return false;
      }
      if (filtroPatente && t.camioneta?.patente !== filtroPatente) return false;
      if (filtroUrgencia && (t.urgencia ?? "baja") !== filtroUrgencia) return false;
      if (filtroResponsable && (t.responsable || t.camioneta?.responsable || "") !== filtroResponsable) return false;
      return true;
    })
    .sort((a, b) => (a.camioneta?.patente ?? "").localeCompare(b.camioneta?.patente ?? ""));

  const exportarExcel = async () => {
    const fechaHoy = new Date().toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric" });
    const titulo = "Resumen Reparaciones Camionetas";
    const columnas = ["Patente", "Marca", "Reparación", "Detalle", "Fecha", "Prioridad", "Estado", "Responsable"];

    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("Reparaciones");

    ws.mergeCells(1, 1, 1, columnas.length);
    const celdaTitulo = ws.getCell("A1");
    celdaTitulo.value = titulo;
    celdaTitulo.font = { bold: true, underline: true, size: 14 };
    celdaTitulo.alignment = { horizontal: "center", vertical: "middle" };
    ws.getRow(1).height = 22;

    ws.mergeCells(2, 1, 2, 4);
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
        t.camioneta?.patente ?? "-",
        t.camioneta?.marca ?? "-",
        t.reparacion || "-",
        t.descripcion || "-",
        formatF(t.fecha),
        getPrioridadLabel(t.urgencia),
        getEstadoLabel(t.estado),
        responsable,
      ]);
      fila.eachCell((cell) => { cell.alignment = { horizontal: "center", vertical: "middle" }; });
      fila.getCell(3).alignment = { horizontal: "left", vertical: "middle" };
      fila.getCell(4).alignment = { horizontal: "left", vertical: "middle" };
      if (urgencia === "alta") {
        fila.eachCell((cell) => { cell.font = { color: { argb: "FFCC0000" } }; });
      }
    });

    ws.columns = [
      { width: 14 }, // Patente
      { width: 18 }, // Marca
      { width: 22 }, // Reparación
      { width: 40 }, // Detalle
      { width: 14 }, // Fecha
      { width: 12 }, // Prioridad
      { width: 12 }, // Estado
      { width: 20 }, // Responsable
    ];

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

      <div className="mx-auto mb-3 d-flex align-items-center gap-3 flex-wrap" style={{ width: "92%" }}>
        <div className="d-flex align-items-center gap-2">
          <span className="fw-semibold">Estado</span>
          <select value={filtro} onChange={(e) => setFiltro(e.target.value)} style={{ padding: "6px 12px", borderRadius: "4px", border: "1.5px solid #aaa", fontSize: "0.9rem", cursor: "pointer" }}>
            <option value="todos">Todas</option>
            <option value="pendiente">Pendientes</option>
            <option value="terminada">Terminadas</option>
          </select>
        </div>
        <div className="d-flex align-items-center gap-2">
          <span className="fw-semibold">Patente</span>
          <select value={filtroPatente} onChange={(e) => setFiltroPatente(e.target.value)} style={{ padding: "6px 12px", borderRadius: "4px", border: "1.5px solid #aaa", fontSize: "0.9rem", cursor: "pointer" }}>
            <option value="">Todas</option>
            {listaPatentes.map((p) => (
              <option key={p.patente} value={p.patente}>{p.label}</option>
            ))}
          </select>
        </div>
        <div className="d-flex align-items-center gap-2">
          <span className="fw-semibold">Prioridad</span>
          <select value={filtroUrgencia} onChange={(e) => setFiltroUrgencia(e.target.value)} style={{ padding: "6px 12px", borderRadius: "4px", border: "1.5px solid #aaa", fontSize: "0.9rem", cursor: "pointer" }}>
            <option value="">Todas</option>
            <option value="baja">Baja</option>
            <option value="media">Media</option>
            <option value="alta">Alta</option>
          </select>
        </div>
        <div className="d-flex align-items-center gap-2">
          <span className="fw-semibold">Responsable</span>
          <select value={filtroResponsable} onChange={(e) => setFiltroResponsable(e.target.value)} style={{ padding: "6px 12px", borderRadius: "4px", border: "1.5px solid #aaa", fontSize: "0.9rem", cursor: "pointer" }}>
            <option value="">Todos</option>
            {listaResponsablesFiltrada.map((r) => (
              <option key={r} value={r}>{r}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="mx-auto" style={{ width: "92%", maxHeight: "70vh", overflowY: "auto" }}>
        <Table bordered size="sm" className="text-center align-middle mb-0" style={{ whiteSpace: "nowrap" }}>
          <thead className="table-dark" style={{ position: "sticky", top: 0, zIndex: 1 }}>
            <tr>
              <th>Patente</th>
              <th>Marca</th>
              <th className="text-start">Reparación</th>
              <th className="text-start">Detalle</th>
              <th>Fecha</th>
              <th>Prioridad</th>
              <th>Estado</th>
              <th>Responsable</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {trabajosFiltrados.length === 0 && (
              <tr><td colSpan={9} className="text-muted py-3">Sin registros</td></tr>
            )}
            {trabajosFiltrados.map((t) => {
              const responsable = t.responsable || t.camioneta?.responsable || "";
              return (
                <tr key={t._id}>
                  <td>
                    <span
                      onClick={() => t.camioneta?._id && navigate(`/camionetas/services/reparaciones/${t.camioneta._id}`, { state: { patente: t.camioneta.patente, marca: t.camioneta.marca } })}
                      style={{ display: "inline-block", backgroundColor: "#4a6fa5", color: "#fff", borderRadius: "4px", padding: "2px 10px", boxShadow: "3px 3px 6px rgba(0,0,0,0.3)", fontWeight: "600", cursor: t.camioneta?._id ? "pointer" : "default" }}
                    >
                      {t.camioneta?.patente ?? "-"}
                    </span>
                  </td>
                  <td>{t.camioneta?.marca ?? "-"}</td>
                  <td className="text-start" style={{ paddingLeft: "12px" }}>{t.reparacion || "-"}</td>
                  <td className="text-start" style={{ paddingLeft: "12px" }}>{t.descripcion || "-"}</td>
                  <td>{formatF(t.fecha)}</td>
                  <td>
                    <span style={{ display: "inline-block", backgroundColor: getPrioridadColor(t.urgencia), color: "#fff", borderRadius: "4px", padding: "2px 10px", boxShadow: "3px 3px 6px rgba(0,0,0,0.3)", textTransform: "capitalize", minWidth: "60px" }}>
                      {getPrioridadLabel(t.urgencia)}
                    </span>
                  </td>
                  <td>
                    <span style={{ display: "inline-block", backgroundColor: getEstadoColor(t.estado), color: "#fff", borderRadius: "4px", padding: "2px 10px", boxShadow: "3px 3px 6px rgba(0,0,0,0.3)", textTransform: "capitalize", minWidth: "80px" }}>
                      {getEstadoLabel(t.estado)}
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
                  <td>
                    <Button size="sm" onClick={() => eliminar(t._id)} style={{ backgroundColor: "#7a4040", border: "none" }}>
                      <i className="bi bi-trash"></i>
                    </Button>
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
