import { useEffect, useState, useMemo } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { Container, Button, Table, Form, Row, Col } from "react-bootstrap";
import Swal from "sweetalert2";
import ExcelJS from "exceljs";

const formatF = (iso) =>
  iso ? new Date(iso + "T12:00:00").toLocaleDateString("es-AR") : "-";

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

function ReparacionesTractor() {
  const navigate = useNavigate();
  const { grupoId, tractorId } = useParams();
  const { state } = useLocation();
  const cc = state?.cc ?? "-";
  const descripcion = state?.descripcion ?? "";

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
      fetch(`/api/trabajos-tractor/tractor/${tractorId}`).then((r) => r.json()),
      fetch("/api/tractores").then((r) => r.json())
    ])
      .then(([trabajosData, tractoresData]) => {
        if (Array.isArray(tractoresData)) {
          const currentTractor = tractoresData.find((t) => String(t._id) === String(tractorId));
          if (currentTractor?.supervisor) {
            setResponsableDefault(currentTractor.supervisor);
          }
          const list = [...new Set(tractoresData.map((t) => t.supervisor).filter(Boolean))].sort((a, b) => a.localeCompare(b));
          setResponsablesAlta(list);
        }

        const items = (Array.isArray(trabajosData) ? trabajosData : []).map((t) => ({
          id: t._id,
          fecha: t.fecha ? t.fecha.split("T")[0] : "",
          reparacion: t.reparacion || t.descripcion || "",
          descripcion: t.descripcion && t.reparacion ? t.descripcion : "",
          parte: t.parte || "",
          prioridad: t.prioridad || "Normal",
          estado: t.estado || "Pendiente",
          responsable: t.responsable || "",
          maquinaParada: !!t.maquinaParada,
          observaciones: t.observaciones || "",
          repuestos: (t.repuestos || []).map((r) => ({
            id: r._id || crypto.randomUUID(),
            repuesto: r.repuesto || "",
            cantidad: r.cantidad || 1,
            precio: r.precio || 0,
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
  }, [tractorId]);

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
      const res = await fetch(`/api/trabajos-tractor/${id}`, {
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
      tractor: tractorId,
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
      const url = isNew ? "/api/trabajos-tractor" : `/api/trabajos-tractor/${fila.id}`;
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

  const handleSaveSubSection = async (tipo, arrayUObjeto) => {
    const targetId = detalleSel?.id || observacionesSel || repuestosSel;
    const fila = filas.find((f) => f.id === targetId);
    if (!fila) return { ok: false };

    const body = {
      tractor: tractorId,
      fecha: fila.fecha,
      reparacion: fila.reparacion,
      descripcion: tipo === "detalle" ? arrayUObjeto : fila.descripcion,
      parte: fila.parte || "",
      prioridad: fila.prioridad,
      estado: fila.estado,
      responsable: fila.responsable || "",
      observaciones: tipo === "observaciones" ? arrayUObjeto : fila.observaciones,
      maquinaParada: !!fila.maquinaParada,
      repuestos: tipo === "repuestos"
        ? arrayUObjeto.map((r) => ({
            repuesto: r.repuesto,
            cantidad: Number(r.cantidad) || 1,
            precio: Number(r.precio) || 0,
            proveedor: r.proveedor || "",
            responsable: r.responsable || "",
            estado: r.estado || "Pedido",
            observaciones: r.observaciones || "",
          }))
        : (fila.repuestos || []).map((r) => ({
            repuesto: r.repuesto,
            cantidad: r.cantidad,
            precio: r.precio,
            proveedor: r.proveedor,
            responsable: r.responsable,
            estado: r.estado,
            observaciones: r.observaciones,
          })),
    };

    const isNew = String(fila.id).length !== 24;

    if (isNew) {
      setFilas((prev) =>
        prev.map((f) => {
          if (f.id === fila.id) {
            if (tipo === "detalle") return { ...f, descripcion: arrayUObjeto };
            if (tipo === "observaciones") return { ...f, observaciones: arrayUObjeto };
            if (tipo === "repuestos") return { ...f, repuestos: arrayUObjeto };
          }
          return f;
        })
      );
      return { ok: true };
    }

    try {
      const res = await fetch(`/api/trabajos-tractor/${fila.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) throw new Error("No se pudo guardar la modificación.");
      const saved = await res.json();

      setFilas((prev) =>
        prev.map((f) =>
          f.id === fila.id
            ? {
                ...f,
                descripcion: saved.descripcion || "",
                observaciones: saved.observaciones || "",
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
      return { ok: true };
    } catch (e) {
      console.error(e);
      Swal.fire({ icon: "error", title: "Error", text: e.message });
      return { ok: false };
    }
  };

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

  const exportarExcel = async () => {
    const fechaHoy = new Date().toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric" });
    const titulo = `Reparaciones Tractor: ${cc}${descripcion ? ` - ${descripcion}` : ""}`;
    const columnas = ["Fecha", "Reparación", "Detalle", "Prioridad", "Estado", "Responsable", "Observaciones", "Repuestos"];

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
    ws.getRow(4).height = 18;

    filasFiltradas.forEach((t) => {
      const repsStr = (t.repuestos || [])
        .map((r) => `${r.cantidad}x ${r.repuesto} (${pesos(r.precio)})`)
        .join(", ");

      const fila = ws.addRow([
        t.fecha ? t.fecha.split("-").reverse().join("/") : "-",
        t.reparacion || "-",
        t.descripcion || "-",
        t.prioridad || "-",
        t.estado || "-",
        t.responsable || "-",
        t.observaciones || "-",
        repsStr || "-",
      ]);

      fila.eachCell((cell) => {
        cell.alignment = { horizontal: "center", vertical: "middle" };
      });
      fila.getCell(2).alignment = { horizontal: "left", vertical: "middle" };
      fila.getCell(3).alignment = { horizontal: "left", vertical: "middle" };
      fila.getCell(7).alignment = { horizontal: "left", vertical: "middle" };
      fila.getCell(8).alignment = { horizontal: "left", vertical: "middle" };
    });

    ws.columns = [
      { width: 13 },
      { width: 35 },
      { width: 35 },
      { width: 13 },
      { width: 13 },
      { width: 20 },
      { width: 35 },
      { width: 45 },
    ];

    const buf = await wb.xlsx.writeBuffer();
    const blob = new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `reparaciones_tractor_${cc}_${new Date().toISOString().slice(0, 10)}.xlsx`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  if (detalleSel) {
    const isEditMode = editandoId === detalleSel.id;
    return (
      <DetalleReparacion
        cc={cc}
        descripcion={descripcion}
        reparacion={detalleSel}
        readOnly={!isEditMode}
        onVolver={() => setDetalleSel(null)}
        onGuardar={(texto) => handleSaveSubSection("detalle", texto)}
      />
    );
  }

  if (observacionesSel) {
    const fila = filas.find((f) => f.id === observacionesSel);
    const isEditMode = editandoId === observacionesSel;
    return (
      <DetalleObservaciones
        cc={cc}
        descripcion={descripcion}
        reparacion={fila}
        readOnly={!isEditMode}
        onVolver={() => setObservacionesSel(null)}
        onGuardar={(texto) => handleSaveSubSection("observaciones", texto)}
      />
    );
  }

  if (repuestosSel) {
    const fila = filas.find((f) => f.id === repuestosSel);
    const isEditMode = editandoId === repuestosSel;
    return (
      <DetalleRepuestos
        cc={cc}
        descripcion={descripcion}
        reparacion={fila}
        readOnly={!isEditMode}
        responsablesAlta={responsablesAlta}
        onVolver={() => setRepuestosSel(null)}
        onGuardar={(lista) => handleSaveSubSection("repuestos", lista)}
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
        <Button onClick={() => navigate("/tractores")} style={{ backgroundColor: "#fff", border: "1px solid #000", color: "#000" }}>
          <i className="bi bi-speedometer me-2"></i>Grupos
        </Button>
        <Button onClick={() => navigate("/")} style={{ backgroundColor: "#fff", border: "1px solid #000", color: "#000" }}>
          <i className="bi bi-house-fill me-2"></i>General
        </Button>
        <Button onClick={exportarExcel} style={{ backgroundColor: "#1d6f42", border: "1px solid #1d6f42", color: "#fff" }}>
          <i className="bi bi-file-earmark-excel-fill me-2"></i>Excel
        </Button>
      </div>

      {/* Título */}
      <div className="text-center mb-4">
        <h3 className="fw-bold mb-0">Reparaciones tractor: {cc}{descripcion ? ` - ${descripcion}` : ""}</h3>
      </div>

      {/* Agregar reparación */}
      <div className="mb-4">
        <Button variant="outline-primary" size="sm" onClick={agregar}>
          <i className="bi bi-plus-lg me-1"></i>Agregar reparación
        </Button>
      </div>

      {/* Filtros */}
      <div className="d-flex gap-3 mb-3 align-items-center flex-wrap">
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
        <div className="position-relative" style={{ width: 220 }}>
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
        <div className="position-relative" style={{ width: 220 }}>
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

        <div className="ms-auto">
          {editandoId && (
            <Button
              size="sm"
              variant="link"
              className="text-danger p-0"
              onClick={() => {
                const isNew = String(editandoId).length !== 24;
                if (isNew) setFilas((p) => p.filter((fi) => fi.id !== editandoId));
                setEditandoId(null);
              }}
            >
              Cancelar Edición
            </Button>
          )}
        </div>
      </div>

      {cargando ? (
        <div className="text-center py-5">Cargando reparaciones...</div>
      ) : (
        <div style={{ maxHeight: "calc(100vh - 190px)", overflowY: "auto" }}>
          <Table striped bordered hover size="sm" className="text-center align-middle mb-0" style={{ tableLayout: "fixed", width: "100%", fontSize: "0.78rem" }}>
            <thead className="table-dark" style={{ position: "sticky", top: 0, zIndex: 1 }}>
              <tr className="fw-normal align-middle">
                <th className="fw-normal" style={{ width: "9%" }}>Fecha</th>
                <th className="fw-normal" style={{ width: "30%" }}>Reparación</th>
                <th className="fw-normal" style={{ width: "6%" }}>Detalle</th>
                <th className="fw-normal" style={{ width: "9%" }}>Prioridad</th>
                <th className="fw-normal" style={{ width: "9%" }}>Estado</th>
                <th className="fw-normal" style={{ width: "14%" }}>Responsable</th>
                <th className="fw-normal" style={{ width: "7%" }}>Observaciones</th>
                <th className="fw-normal" style={{ width: "6%" }}>Repuestos</th>
                <th className="fw-normal" style={{ width: "10%" }}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filasFiltradas.length === 0 && (
                <tr>
                  <td colSpan={9} className="text-muted py-3">
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
                    <td className="text-start" style={{ whiteSpace: "normal", wordBreak: "break-word" }}>
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
                        return <span className="text-muted">-</span>;
                      })()}
                    </td>
                    <td>
                      {editando ? (
                        <Form.Select
                          size="sm"
                          value={f.prioridad}
                          onChange={(e) => editar(f.id, "prioridad", e.target.value)}
                          style={{
                            fontSize: "0.72rem",
                            padding: "2px 4px",
                            color: f.prioridad === "Crítico" ? "red" : "",
                            fontWeight: f.prioridad === "Crítico" ? "bold" : ""
                          }}
                        >
                          {PRIORIDADES.map((p) => (
                            <option key={p} value={p}>
                              {p}
                            </option>
                          ))}
                        </Form.Select>
                      ) : (
                        f.prioridad === "Crítico" ? (
                          <span className="text-danger fw-semibold">Crítico</span>
                        ) : (
                          f.prioridad || "-"
                        )
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
                            {RESPONSABLES.map((r) => (
                              <option key={r} value={r}>
                                {r}
                              </option>
                            ))}
                            <option value="__otro__">Otro...</option>
                          </Form.Select>
                          {otroRespMain.has(f.id) && (
                            <Form.Control
                              size="sm"
                              className="mt-1"
                              placeholder="Escriba responsable..."
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
                        return <span className="text-muted">-</span>;
                      })()}
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
                        return <span className="text-muted">-</span>;
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

// Sub-componentes
function DetalleReparacion({ cc, descripcion, reparacion, readOnly, onVolver, onGuardar }) {
  const r = reparacion || {};
  const [texto, setTexto] = useState(r.descripcion || "");

  const handleGuardar = async () => {
    const res = await onGuardar(texto);
    if (res?.ok) {
      Swal.fire({ icon: "success", title: "Detalle guardado", timer: 1200, showConfirmButton: false });
      onVolver();
    }
  };

  const Item = ({ label, value }) => (
    <Col xs={6} md={4} lg={2.4} className="mb-3">
      <div className="text-muted small">{label}</div>
      <div className="fw-semibold">{value || "-"}</div>
    </Col>
  );

  return (
    <Container className="py-4">
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h4 className="fw-bold mb-0">
          Detalle de reparación - {cc} {descripcion}
        </h4>
        <Button onClick={onVolver} style={{ backgroundColor: "#fff", border: "1px solid #000", color: "#000" }}>
          <i className="bi bi-arrow-left me-2"></i>Volver
        </Button>
      </div>

      <div className="border rounded p-3 mb-4 bg-light" style={{ borderTop: "4px solid #3a7070" }}>
        <Row>
          <Item label="Fecha" value={formatF(r.fecha)} />
          <Item label="Reparación" value={r.reparacion} />
          <Item label="Prioridad" value={r.prioridad} />
          <Item label="Estado" value={r.estado} />
          <Item label="Responsable" value={r.responsable} />
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

function DetalleObservaciones({ cc, descripcion, reparacion, readOnly, onVolver, onGuardar }) {
  const [texto, setTexto] = useState(reparacion?.observaciones || "");

  const handleGuardar = async () => {
    const res = await onGuardar(texto);
    if (res?.ok) {
      Swal.fire({ icon: "success", title: "Observaciones guardadas", timer: 1200, showConfirmButton: false });
      onVolver();
    }
  };

  return (
    <Container className="py-4">
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h4 className="fw-bold mb-0">
          Observaciones - {reparacion?.reparacion || "reparación"}
          <small className="text-muted ms-2" style={{ fontSize: "1rem", fontWeight: 400 }}>
            {cc} {descripcion}
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

function DetalleRepuestos({ cc, descripcion, reparacion, readOnly, responsablesAlta, onVolver, onGuardar }) {
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
      Swal.fire({ icon: "success", title: "Repuesto quitado", timer: 1200, showConfirmButton: false });
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

  const exportarExcel = async () => {
    const fechaHoy = new Date().toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric" });
    const titulo = `Repuestos - ${reparacion?.reparacion || "reparación"} (${cc} ${descripcion})`;
    const columnas = ["#", "Repuesto", "Cantidad", "Precio", "Proveedor", "Responsable", "Estado", "Observaciones"];

    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("Repuestos");

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
    ws.getRow(4).height = 18;

    filas.forEach((r, idx) => {
      const fila = ws.addRow([
        idx + 1,
        r.repuesto || "-",
        r.cantidad || 0,
        r.precio || 0,
        r.proveedor || "-",
        r.responsable || "-",
        r.estado || "-",
        r.observaciones || "-",
      ]);
      fila.eachCell((cell) => {
        cell.alignment = { horizontal: "center", vertical: "middle" };
      });
      fila.getCell(2).alignment = { horizontal: "left", vertical: "middle" };
      fila.getCell(8).alignment = { horizontal: "left", vertical: "middle" };
    });

    ws.columns = [
      { width: 6 },
      { width: 35 },
      { width: 12 },
      { width: 15 },
      { width: 25 },
      { width: 20 },
      { width: 15 },
      { width: 35 },
    ];

    const buf = await wb.xlsx.writeBuffer();
    const blob = new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `repuestos_tractor_${cc}_${new Date().toISOString().slice(0, 10)}.xlsx`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <Container className="py-4">
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h4 className="fw-bold mb-0">
          Repuestos para: {reparacion?.reparacion || "reparación"}
          <small className="text-muted ms-2" style={{ fontSize: "1rem", fontWeight: 400 }}>
            {cc} {descripcion}
          </small>
        </h4>
        <div className="d-flex gap-2">
          {!readOnly && (
            <Button size="sm" variant="success" onClick={agregar} disabled={editandoId != null}>
              + Agregar Repuesto
            </Button>
          )}
          <Button size="sm" onClick={exportarExcel} style={{ backgroundColor: "#1d6f42", borderColor: "#1d6f42", color: "#fff" }}>
            <i className="bi bi-file-earmark-excel-fill me-2"></i>Excel
          </Button>
          <Button size="sm" onClick={onVolver} style={{ backgroundColor: "#fff", border: "1px solid #000", color: "#000" }}>
            <i className="bi bi-arrow-left me-2"></i>Volver
          </Button>
        </div>
      </div>

      <div className="border rounded p-3 mb-4 bg-light" style={{ borderTop: "4px solid #3a7070" }}>
        <Row className="align-items-center">
          <Col xs={12} md={6}>
            <span className="text-muted">Total en repuestos:</span>
            <h3 className="fw-bold mb-0 text-success">{pesos(total)}</h3>
          </Col>
          <Col xs={12} md={6} className="text-md-end mt-2 mt-md-0">
            {editandoId && (
              <Button size="sm" variant="link" className="text-danger p-0" onClick={() => {
                if (nuevas.has(editandoId)) setFilas((p) => p.filter((fi) => fi.id !== editandoId));
                setEditandoId(null);
              }}>
                Cancelar Edición
              </Button>
            )}
          </Col>
        </Row>
      </div>

      <div style={{ maxHeight: "400px", overflowY: "auto" }}>
        <Table striped bordered hover size="sm" className="text-center align-middle mb-0" style={{ fontSize: "0.78rem" }}>
          <thead className="table-dark" style={{ position: "sticky", top: 0, zIndex: 1 }}>
            <tr className="align-middle">
              <th style={{ width: "35%" }}>Repuesto</th>
              <th style={{ width: "8%" }}>Cant.</th>
              <th style={{ width: "12%" }}>Precio Unit.</th>
              <th style={{ width: "12%" }}>Subtotal</th>
              <th style={{ width: "15%" }}>Proveedor</th>
              <th style={{ width: "14%" }}>Responsable</th>
              <th style={{ width: "10%" }}>Estado</th>
              {!readOnly && <th style={{ width: "12%" }}>Acciones</th>}
            </tr>
          </thead>
          <tbody>
            {filas.length === 0 && (
              <tr>
                <td colSpan={readOnly ? 7 : 8} className="text-muted py-3">
                  Sin repuestos cargados
                </td>
              </tr>
            )}
            {filas.map((r) => {
              const editando = editandoId === r.id;
              return (
                <tr key={r.id}>
                  <td className="text-start">
                    {editando ? (
                      <Form.Control
                        size="sm"
                        value={r.repuesto}
                        onChange={(e) => editar(r.id, "repuesto", e.target.value)}
                        style={{ fontSize: "0.72rem" }}
                      />
                    ) : (
                      r.repuesto || "—"
                    )}
                  </td>
                  <td>
                    {editando ? (
                      <Form.Control
                        size="sm"
                        type="number"
                        min="1"
                        value={r.cantidad}
                        onChange={(e) => editar(r.id, "cantidad", Number(e.target.value) || 0)}
                        style={{ fontSize: "0.72rem" }}
                      />
                    ) : (
                      r.cantidad || 0
                    )}
                  </td>
                  <td>
                    {editando ? (
                      <InputMoneda
                        value={r.precio}
                        onChange={(val) => editar(r.id, "precio", val)}
                      />
                    ) : (
                      pesos(r.precio)
                    )}
                  </td>
                  <td className="fw-semibold">
                    {pesos((Number(r.cantidad) || 0) * (Number(r.precio) || 0))}
                  </td>
                  <td>
                    {editando ? (
                      <Form.Control
                        size="sm"
                        value={r.proveedor}
                        onChange={(e) => editar(r.id, "proveedor", e.target.value)}
                        style={{ fontSize: "0.72rem" }}
                      />
                    ) : (
                      r.proveedor || "—"
                    )}
                  </td>
                  <td>
                    {editando ? (
                      <div className="d-flex gap-1">
                        {otroResp.has(r.id) ? (
                          <Form.Control
                            size="sm"
                            value={r.responsable}
                            onChange={(e) => editar(r.id, "responsable", e.target.value)}
                            placeholder="Nombre..."
                            style={{ fontSize: "0.72rem" }}
                          />
                        ) : (
                          <Form.Select
                            size="sm"
                            value={r.responsable}
                            onChange={(e) => {
                              if (e.target.value === "__otro__") {
                                setOtroResp((p) => new Set(p).add(r.id));
                                editar(r.id, "responsable", "");
                              } else {
                                editar(r.id, "responsable", e.target.value);
                              }
                            }}
                            style={{ fontSize: "0.72rem" }}
                          >
                            <option value="">—</option>
                            {responsablesAlta.map((re) => <option key={re} value={re}>{re}</option>)}
                            {RESPONSABLES.map((re) => <option key={re} value={re}>{re}</option>)}
                            <option value="__otro__">Otro...</option>
                          </Form.Select>
                        )}
                      </div>
                    ) : (
                      r.responsable || "—"
                    )}
                  </td>
                  <td>
                    {editando ? (
                      <Form.Select
                        size="sm"
                        value={r.estado}
                        onChange={(e) => editar(r.id, "estado", e.target.value)}
                        style={{ fontSize: "0.72rem" }}
                      >
                        {ESTADOS_REP.map((es) => <option key={es} value={es}>{es}</option>)}
                      </Form.Select>
                    ) : (
                      <span style={{
                        display: "inline-block",
                        backgroundColor: COLOR_ESTADO_REP[r.estado] || "#6c757d",
                        color: "#fff",
                        borderRadius: "4px",
                        padding: "2px 8px",
                        fontWeight: "600",
                        fontSize: "0.72rem",
                        minWidth: "70px"
                      }}>
                        {r.estado}
                      </span>
                    )}
                  </td>
                  {!readOnly && (
                    <td>
                      {editando ? (
                        <div className="d-flex gap-1 justify-content-center">
                          <Button size="sm" variant="success" onClick={finalizarEdicion} style={{ padding: "2px 6px", fontSize: "0.72rem" }}>
                            Ok
                          </Button>
                          <Button size="sm" variant="secondary" onClick={() => {
                            if (nuevas.has(editandoId)) setFilas((p) => p.filter((fi) => fi.id !== editandoId));
                            setEditandoId(null);
                          }} style={{ padding: "2px 6px", fontSize: "0.72rem" }}>
                            No
                          </Button>
                        </div>
                      ) : (
                        <div className="d-flex gap-1 justify-content-center">
                          <Button size="sm" variant="outline-primary" onClick={() => setEditandoId(r.id)} disabled={editandoId != null} style={{ padding: "2px 6px", fontSize: "0.72rem" }}>
                            Editar
                          </Button>
                          <Button size="sm" variant="outline-danger" onClick={() => borrar(r.id)} disabled={editandoId != null} style={{ padding: "2px 6px", fontSize: "0.72rem" }}>
                            Borrar
                          </Button>
                        </div>
                      )}
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </Table>
      </div>
    </Container>
  );
}

export default ReparacionesTractor;
