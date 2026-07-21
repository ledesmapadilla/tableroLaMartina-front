import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Container, Table, Button } from "react-bootstrap";
import ExcelJS from "exceljs";
import Swal from "sweetalert2";

const formatF = (iso) =>
  iso ? new Date(iso).toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric" }) : "-";

const getPrioridad = (t) => {
  return t.prioridad || "Normal";
};

const getPrioridadColor = (p) => {
  if (p === "Crítico") return "#8b4a4a";
  if (p === "Urgente") return "#c8a800";
  return "#7aaa80";
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

function ResumenReparacionesTractores() {
  const navigate = useNavigate();
  const [trabajos, setTrabajos] = useState([]);
  const [filtro, setFiltro] = useState("pendiente");
  const [filtroCC, setFiltroCC] = useState("");
  const [filtroUrgencia, setFiltroUrgencia] = useState("");
  const [filtroResponsable, setFiltroResponsable] = useState("");
  const [listaResponsables, setListaResponsables] = useState([]);

  useEffect(() => {
    fetch("/api/trabajos-tractor")
      .then((r) => r.json())
      .then(setTrabajos)
      .catch(() => setTrabajos([]));

    fetch("/api/tractores")
      .then((r) => r.json())
      .then((tracs) => {
        setListaResponsables([...new Set(tracs.map((t) => t.supervisor).filter(Boolean))].sort());
      })
      .catch(() => {});
  }, []);

  const cambiarResponsable = async (id, responsable) => {
    setTrabajos((prev) => prev.map((t) => t._id === id ? { ...t, responsable } : t));
    await fetch(`/api/trabajos-tractor/${id}`, {
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
    await fetch(`/api/trabajos-tractor/${id}`, { method: "DELETE" }).catch(() => {});
    setTrabajos((prev) => prev.filter((t) => t._id !== id));
  };

  const listaResponsablesFiltrada = [...new Set(
    trabajos
      .filter((t) => {
        const estLower = (t.estado || "").trim().toLowerCase();
        return estLower !== "terminada" && estLower !== "terminado";
      })
      .map((t) => t.responsable || t.tractor?.supervisor || "")
      .filter(Boolean)
  )].sort();

  const listaCCs = [...new Map(
    trabajos
      .filter((t) => t.tractor?.cc)
      .map((t) => [t.tractor.cc, { cc: t.tractor.cc, label: `${t.tractor.cc} - ${t.tractor.descripcion || ""}` }])
  ).values()].sort((a, b) => a.cc.localeCompare(b.cc));

  const trabajosFiltrados = trabajos
    .filter((t) => {
      if (filtro !== "todos") {
        const estLower = (t.estado || "").trim().toLowerCase();
        const esTerminada = estLower === "terminada" || estLower === "terminado";
        if (filtro === "terminada" && !esTerminada) return false;
        if (filtro === "pendiente" && esTerminada) return false;
      }
      if (filtroCC && t.tractor?.cc !== filtroCC) return false;
      if (filtroUrgencia && getPrioridad(t) !== filtroUrgencia) return false;
      if (filtroResponsable && (t.responsable || t.tractor?.supervisor || "") !== filtroResponsable) return false;
      return true;
    })
    .sort((a, b) => (a.tractor?.cc ?? "").localeCompare(b.tractor?.cc ?? ""));

  const exportarExcel = async () => {
    const fechaHoy = new Date().toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric" });
    const titulo = "Resumen Reparaciones Tractores";
    const columnas = ["Centro de Costo (CC)", "Descripción", "Reparación", "Detalle", "Fecha", "Prioridad", "Estado", "Responsable"];

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

    const thinBorder = {
      top: { style: "thin", color: { argb: "FFE0E0E0" } },
      left: { style: "thin", color: { argb: "FFE0E0E0" } },
      bottom: { style: "thin", color: { argb: "FFE0E0E0" } },
      right: { style: "thin", color: { argb: "FFE0E0E0" } },
    };

    const filaEnc = ws.addRow(columnas);
    filaEnc.eachCell((cell) => {
      cell.font = { bold: true };
      cell.alignment = { horizontal: "center", vertical: "middle" };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFD9D9D9" } };
      cell.border = {
        top: { style: "thin", color: { argb: "FFA0A0A0" } },
        left: { style: "thin", color: { argb: "FFA0A0A0" } },
        bottom: { style: "medium", color: { argb: "FF808080" } },
        right: { style: "thin", color: { argb: "FFA0A0A0" } },
      };
    });
    ws.getRow(4).height = 18;

    const zebraFill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF2F4F8" } };

    trabajosFiltrados.forEach((t, idx) => {
      const p = getPrioridad(t);
      const responsable = t.responsable || t.tractor?.supervisor || "—";
      const fila = ws.addRow([
        t.tractor?.cc ?? "-",
        t.tractor?.descripcion ?? "-",
        t.reparacion || "-",
        t.descripcion || "-",
        formatF(t.fecha),
        p,
        getEstadoLabel(t.estado),
        responsable,
      ]);
      const isOdd = idx % 2 === 1;
      fila.eachCell({ includeEmpty: true }, (cell) => {
        cell.alignment = { horizontal: "center", vertical: "middle" };
        cell.border = thinBorder;
        if (isOdd) cell.fill = zebraFill;
      });
      fila.getCell(3).alignment = { horizontal: "left", vertical: "middle" };
      fila.getCell(4).alignment = { horizontal: "left", vertical: "middle" };
      if (p === "Crítico") {
        fila.eachCell({ includeEmpty: true }, (cell) => {
          cell.font = { color: { argb: "FFCC0000" }, bold: true };
        });
      }
    });

    ws.columns = [
      { width: 22 }, // CC
      { width: 25 }, // Descripción
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
    a.download = `reparaciones_tractores_${filtro}.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Container className="py-4">

      <div className="d-flex justify-content-between align-items-center mb-4 mx-auto" style={{ width: "92%" }}>
        <h3 className="fw-bold mb-0">Resumen Reparaciones Tractores</h3>
        <div className="d-flex gap-2">
          <Button onClick={exportarExcel} style={{ backgroundColor: "#1d6f42", border: "1px solid #1d6f42", color: "#fff" }}>
            <i className="bi bi-file-earmark-excel-fill me-2"></i>Excel
          </Button>
          <Button onClick={() => navigate(-1)} style={{ backgroundColor: "#fff", border: "1px solid #000", color: "#000" }}>
            <i className="bi bi-arrow-left me-2"></i>Volver
          </Button>
          <Button onClick={() => navigate("/tractores")} style={{ backgroundColor: "#fff", border: "1px solid #000", color: "#000" }}>
            <i className="bi bi-speedometer me-2"></i>Grupos
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
          <span className="fw-semibold">Centro de Costo</span>
          <select value={filtroCC} onChange={(e) => setFiltroCC(e.target.value)} style={{ padding: "6px 12px", borderRadius: "4px", border: "1.5px solid #aaa", fontSize: "0.9rem", cursor: "pointer" }}>
            <option value="">Todos</option>
            {listaCCs.map((p) => (
              <option key={p.cc} value={p.cc}>{p.label}</option>
            ))}
          </select>
        </div>
        <div className="d-flex align-items-center gap-2">
          <span className="fw-semibold">Prioridad</span>
          <select value={filtroUrgencia} onChange={(e) => setFiltroUrgencia(e.target.value)} style={{ padding: "6px 12px", borderRadius: "4px", border: "1.5px solid #aaa", fontSize: "0.9rem", cursor: "pointer" }}>
            <option value="">Todas</option>
            <option value="Normal">Normal</option>
            <option value="Urgente">Urgente</option>
            <option value="Crítico">Crítico</option>
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

      <div className="mx-auto" style={{ width: "92%", maxHeight: "calc(100vh - 230px)", overflowY: "auto" }}>
        <Table striped bordered hover size="sm" className="text-center align-middle mb-0" style={{ whiteSpace: "nowrap", fontSize: "0.78rem" }}>
          <thead className="table-dark" style={{ position: "sticky", top: 0, zIndex: 1 }}>
            <tr className="fw-normal align-middle">
              <th className="fw-normal">Centro de Costo (CC)</th>
              <th className="fw-normal">Descripción</th>
              <th className="fw-normal text-start" style={{ minWidth: "150px", whiteSpace: "normal" }}>Reparación</th>
              <th className="fw-normal text-start" style={{ minWidth: "200px", whiteSpace: "normal" }}>Detalle</th>
              <th className="fw-normal">Fecha</th>
              <th className="fw-normal">Prioridad</th>
              <th className="fw-normal">Estado</th>
              <th className="fw-normal">Responsable</th>
              <th className="fw-normal"></th>
            </tr>
          </thead>
          <tbody>
            {trabajosFiltrados.length === 0 && (
              <tr><td colSpan={9} className="text-muted py-3">Sin registros</td></tr>
            )}
            {trabajosFiltrados.map((t) => {
              const responsable = t.responsable || t.tractor?.supervisor || "";
              return (
                <tr key={t._id}>
                  <td>
                    <span
                      onClick={() => t.tractor?._id && navigate(`/tractores/grupo/${t.tractor.gruppo || 6}/reparaciones/${t.tractor._id}`, { state: { cc: t.tractor.cc, descripcion: t.tractor.descripcion } })}
                      style={{ display: "inline-block", backgroundColor: "#52735a", color: "#fff", borderRadius: "4px", padding: "2px 10px", boxShadow: "3px 3px 6px rgba(0,0,0,0.3)", fontWeight: "600", cursor: t.tractor?._id ? "pointer" : "default" }}
                    >
                      {t.tractor?.cc ?? "-"}
                    </span>
                  </td>
                  <td>{t.tractor?.descripcion ?? "-"}</td>
                  <td className="text-start" style={{ paddingLeft: "12px", minWidth: "150px", whiteSpace: "normal", wordBreak: "break-word" }}>{t.reparacion || "-"}</td>
                  <td className="text-start" style={{ paddingLeft: "12px", minWidth: "200px", whiteSpace: "normal", wordBreak: "break-word" }}>{t.descripcion || "-"}</td>
                  <td>{formatF(t.fecha)}</td>
                  <td>
                    <span style={{ display: "inline-block", backgroundColor: getPrioridadColor(getPrioridad(t)), color: "#fff", borderRadius: "4px", padding: "2px 10px", boxShadow: "3px 3px 6px rgba(0,0,0,0.3)", textTransform: "capitalize", minWidth: "60px" }}>
                      {getPrioridad(t)}
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
                      style={{ padding: "2px 4px", borderRadius: "4px", border: "1px solid #aaa", fontSize: "0.72rem", cursor: "pointer", minWidth: "120px" }}
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

export default ResumenReparacionesTractores;
