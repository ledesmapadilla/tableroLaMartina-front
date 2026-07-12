import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useForm, useWatch } from "react-hook-form";
import { Button, Modal, Form, Table } from "react-bootstrap";
import Swal from "sweetalert2";
import ExcelJS from "exceljs";

const INTERVAL_KM = 10000;
const MESES_CORTOS = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];
const AÑOS = Array.from({ length: 10 }, (_, i) => 2026 + i);

const formatFecha = (iso) => {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric" });
};

const getEstado = (odoActual, kmsService) => {
  if (odoActual == null || kmsService == null) return null;
  const diff = odoActual - kmsService;
  if (diff >= INTERVAL_KM)        return { label: "Atrasado",   bg: "#8b4a4a", color: "#fff" };
  if (diff >= INTERVAL_KM - 1000) return { label: "a 1.000 Km", bg: "#b89840", color: "#333" };
  return                                   { label: "Al día",    bg: "#52735a", color: "#fff" };
};

const BTN_PLUS = { height: "26px", width: "26px", borderRadius: "6px", border: "none", backgroundColor: "#999", color: "#fff", fontWeight: "600", fontSize: "1rem", lineHeight: 1, cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center", boxShadow: "2px 2px 6px rgba(0,0,0,0.35)", transition: "transform 0.15s ease, box-shadow 0.15s ease" };
const btnEnter = (e) => { e.currentTarget.style.transform = "scale(1.2)"; e.currentTarget.style.boxShadow = "3px 3px 10px rgba(0,0,0,0.5)"; };
const btnLeave = (e) => { e.currentTarget.style.transform = "scale(1)";   e.currentTarget.style.boxShadow = "2px 2px 6px rgba(0,0,0,0.35)"; };

function ResponsableDropdown({ value, onChange, onSelect, camionetas, dropOpen, setDropOpen, filtro, setFiltro, dropRef }) {
  const responsablesUnicos = camionetas
    .map((c) => c.responsable).filter(Boolean)
    .filter((v, i, arr) => arr.indexOf(v) === i).sort();

  return (
    <Form.Group className="mb-3" ref={dropRef} style={{ position: "relative" }}>
      <Form.Label className="fw-semibold">Responsable</Form.Label>
      <Form.Control
        className="w-50"
        placeholder="— Seleccionar o escribir —"
        value={dropOpen ? filtro : value}
        onChange={(e) => { setFiltro(e.target.value); onChange(e.target.value); }}
        onFocus={() => { setFiltro(value); setDropOpen(true); }}
        autoComplete="off"
      />
      {dropOpen && (
        <div style={{ position: "absolute", top: "100%", left: 0, width: "50%", backgroundColor: "#fff", border: "2px solid #aaa", borderRadius: "4px", boxShadow: "0 4px 12px rgba(0,0,0,0.15)", zIndex: 1060, maxHeight: "180px", overflowY: "auto" }}>
          {responsablesUnicos
            .filter((r) => r.toLowerCase().includes(filtro.toLowerCase()))
            .map((r) => (
              <div
                key={r}
                style={{ padding: "8px 16px", cursor: "pointer", backgroundColor: value === r ? "#e9ecef" : "transparent" }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#f0f0f0")}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = value === r ? "#e9ecef" : "transparent")}
                onMouseDown={(e) => { e.preventDefault(); onSelect(r); setFiltro(""); setDropOpen(false); }}
              >{r}</div>
            ))}
        </div>
      )}
    </Form.Group>
  );
}

function ServicesKilometros() {
  const navigate = useNavigate();

  const [año, setAnio] = useState(new Date().getFullYear());
  const [dropAño, setDropAño] = useState(false);
  const dropAñoRef = useRef(null);

  const [filtroPat, setFiltroPat] = useState("");

  const [camionetas, setCamionetas] = useState([]);
  const [registros, setRegistros] = useState([]);
  const [ultimos, setUltimos] = useState([]);
  const [ultimosService, setUltimosService] = useState([]);

  const [detalleReg, setDetalleReg] = useState(null);
  const [modalMes, setModalMes] = useState(null);

  const [showKmModal, setShowKmModal] = useState(false);
  const [dropOpenKm, setDropOpenKm] = useState(false);
  const [filtroKm, setFiltroKm] = useState("");
  const dropRefKm = useRef(null);
  const kmForm = useForm({ defaultValues: { camioneta: "", fecha: "", responsable: "", kms: "", observaciones: "" } });
  const camionetaIdKm = useWatch({ control: kmForm.control, name: "camioneta" });
  const responsableKm = useWatch({ control: kmForm.control, name: "responsable" });

  const editForm = useForm({ defaultValues: { fecha: "", responsable: "", kms: "", observaciones: "" } });

  const cargarRegistros = () =>
    fetch("/api/kilometros").then((r) => r.json()).then(setRegistros).catch(() => setRegistros([]));

  const cargarUltimos = () => Promise.all([
    fetch("/api/kilometros/ultimos").then((r) => r.json()).then(setUltimos).catch(() => setUltimos([])),
    fetch("/api/services/ultimos").then((r) => r.json()).then(setUltimosService).catch(() => setUltimosService([])),
  ]);

  useEffect(() => {
    fetch("/api/camionetas").then((r) => r.json()).then(setCamionetas).catch(() => setCamionetas([]));
    cargarRegistros();
    cargarUltimos();
  }, []);

  useEffect(() => {
    const handler = (e) => {
      if (dropRefKm.current && !dropRefKm.current.contains(e.target)) { setDropOpenKm(false); setFiltroKm(""); }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  useEffect(() => {
    const handler = (e) => {
      if (dropAñoRef.current && !dropAñoRef.current.contains(e.target)) setDropAño(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  useEffect(() => {
    const c = camionetas.find((c) => c._id === camionetaIdKm);
    if (c?.responsable) kmForm.setValue("responsable", c.responsable);
  }, [camionetaIdKm, camionetas]);

  useEffect(() => {
    if (detalleReg) {
      editForm.reset({
        fecha: detalleReg.fecha ? detalleReg.fecha.split("T")[0] : "",
        responsable: detalleReg.responsable ?? "",
        kms: detalleReg.kms ?? "",
        observaciones: detalleReg.observaciones ?? "",
      });
    }
  }, [detalleReg]);

  const onSubmitEdit = async (data) => {
    try {
      const res = await fetch(`/api/kilometros/${detalleReg._id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (res.ok) {
        setDetalleReg(null);
        await Promise.all([cargarRegistros(), cargarUltimos()]);
        Swal.fire({ icon: "success", title: "Registro actualizado", timer: 1500, showConfirmButton: false });
      } else {
        const err = await res.json();
        Swal.fire({ icon: "error", title: "Error", text: err.error });
      }
    } catch { Swal.fire({ icon: "error", title: "Sin conexión" }); }
  };

  const eliminarKm = async () => {
    const result = await Swal.fire({
      icon: "warning",
      title: "¿Eliminar registro?",
      text: "Esta acción no se puede deshacer",
      showCancelButton: true,
      confirmButtonText: "Eliminar",
      cancelButtonText: "Cancelar",
      confirmButtonColor: "#8b4a4a",
    });
    if (!result.isConfirmed) return;
    try {
      const res = await fetch(`/api/kilometros/${detalleReg._id}`, { method: "DELETE" });
      if (res.ok) {
        setDetalleReg(null);
        await Promise.all([cargarRegistros(), cargarUltimos()]);
        Swal.fire({ icon: "success", title: "Registro eliminado", timer: 1500, showConfirmButton: false });
      } else {
        const err = await res.json();
        Swal.fire({ icon: "error", title: "Error", text: err.error });
      }
    } catch { Swal.fire({ icon: "error", title: "Sin conexión" }); }
  };

  const getId = (val) => (val?._id ?? val)?.toString() ?? "";

  const esMesFuturo = (mes) => {
    const hoy = new Date();
    return año > hoy.getFullYear() || (año === hoy.getFullYear() && mes > hoy.getMonth() + 1);
  };

  const getKmMes = (camionetaId, mes) =>
    registros
      .filter((r) => {
        if (getId(r.camioneta) !== camionetaId) return false;
        if (r.mes != null && r.anio != null) return r.mes === mes && r.anio === año;
        const fecha = new Date(r.fecha);
        return fecha.getUTCFullYear() === año && fecha.getUTCMonth() + 1 === mes;
      })
      .sort((a, b) => new Date(b.fecha) - new Date(a.fecha))[0] ?? null;

  const abrirKmModal = (camionetaId = "", mes = null) => {
    setModalMes(mes);
    const c = camionetas.find((c) => c._id === camionetaId);
    const fecha = mes !== null
      ? new Date(año, mes - 1, 1).toISOString().split("T")[0]
      : new Date().toISOString().split("T")[0];
    const reg = ultimos.find((u) => getId(u.camioneta) === camionetaId.toString());
    kmForm.reset({ camioneta: camionetaId, fecha, responsable: c?.responsable ?? "", kms: reg?.kms ?? "", observaciones: "" });
    setShowKmModal(true);
  };

  const cerrarKmModal = () => { setShowKmModal(false); setFiltroKm(""); setDropOpenKm(false); };

  const exportarExcel = async () => {
    const titulo   = "Kilómetros — Camionetas";
    const columnas = ["Patente", "Vehículo", "Responsable", ...MESES_CORTOS, "Estado service"];
    const fechaHoy = new Date().toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric" });

    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("Kilómetros");

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
      const ultimo = ultimos.find((u) => getId(u.camioneta) === c._id.toString());
      const serv   = ultimosService.find((u) => getId(u.camioneta) === c._id.toString());
      const estado = getEstado(ultimo?.kms, serv?.kms);
      const valores = [c.patente, c.marca, c.responsable || "—"];
      MESES_CORTOS.forEach((_, idx) => {
        const reg = getKmMes(c._id, idx + 1);
        valores.push(reg ? reg.kms : "—");
      });
      valores.push(estado?.label ?? "—");
      const fila = ws.addRow(valores);
      fila.eachCell((cell) => { cell.alignment = { horizontal: "center", vertical: "middle" }; });
      fila.getCell(2).alignment = { horizontal: "left", vertical: "middle" };
    });

    ws.columns = [
      { width: 14 },
      { width: 26 },
      { width: 22 },
      ...MESES_CORTOS.map(() => ({ width: 9 })),
      { width: 16 },
    ];

    const buffer = await wb.xlsx.writeBuffer();
    const blob   = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    const url    = URL.createObjectURL(blob);
    const a      = document.createElement("a");
    a.href       = url;
    a.download   = `kilometros_${año}.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
  };;

  const onSubmitKm = async (data) => {
    try {
      const body = { ...data };
      if (modalMes !== null) { body.mes = modalMes; body.anio = año; }
      const existing = modalMes !== null ? getKmMes(body.camioneta, modalMes) : null;
      const url = existing ? `/api/kilometros/${existing._id}` : "/api/kilometros";
      const method = existing ? "PUT" : "POST";
      const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      if (res.ok) {
        cerrarKmModal();
        await Promise.all([cargarRegistros(), cargarUltimos()]);

        Swal.fire({ icon: "success", title: "Kilómetros guardados", timer: 1500, showConfirmButton: false });
      } else {
        const err = await res.json();
        Swal.fire({ icon: "error", title: "Error", text: err.error });
      }
    } catch { Swal.fire({ icon: "error", title: "Sin conexión", text: "No se pudo conectar con el servidor" }); }
  };

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>

      {/* Encabezado */}
      <div className="d-flex justify-content-between align-items-center" style={{ padding: "1rem 0 0", width: "80%", margin: "0 auto" }}>
        <div className="d-flex align-items-center gap-3">
          <h3 className="fw-bold mb-0">Kilómetros — Camionetas</h3>
          {/* Buscador por patente */}
          <div style={{ position: "relative" }}>
            <Form.Control
              type="text"
              placeholder="Buscar patente..."
              value={filtroPat}
              onChange={(e) => setFiltroPat(e.target.value)}
              style={{ width: "160px", fontSize: "0.88rem", paddingRight: filtroPat ? "28px" : undefined }}
            />
            {filtroPat && (
              <button
                onClick={() => setFiltroPat("")}
                style={{ position: "absolute", right: "6px", top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "#999", fontSize: "1rem", lineHeight: 1, padding: 0 }}
              >×</button>
            )}
          </div>
          {/* Selector de año */}
          <div ref={dropAñoRef} style={{ position: "relative" }}>
            <button
              onClick={() => setDropAño((v) => !v)}
              style={{ backgroundColor: "#666", color: "#fff", border: "none", borderRadius: "6px", padding: "4px 16px", fontWeight: "700", fontSize: "1rem", cursor: "pointer", boxShadow: "2px 2px 6px rgba(0,0,0,0.3)" }}
            >
              {año}
            </button>
            {dropAño && (
              <div style={{ position: "absolute", top: "110%", left: 0, backgroundColor: "#fff", border: "1px solid #aaa", borderRadius: "6px", boxShadow: "0 4px 12px rgba(0,0,0,0.2)", zIndex: 200, minWidth: "80px", overflow: "hidden" }}>
                {AÑOS.map((a) => (
                  <div
                    key={a}
                    onClick={() => { setAnio(a); setDropAño(false); }}
                    style={{ padding: "6px 16px", cursor: "pointer", fontWeight: a === año ? "700" : "400", backgroundColor: a === año ? "#e3eaf7" : "transparent", fontSize: "0.9rem" }}
                    onMouseEnter={(e) => { if (a !== año) e.currentTarget.style.backgroundColor = "#f0f0f0"; }}
                    onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = a === año ? "#e3eaf7" : "transparent"; }}
                  >
                    {a}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
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

      {/* Tabla */}
      <div className="d-flex justify-content-center" style={{ flex: 1, padding: "1.5rem 2rem" }}>
        <div style={{ width: "80%", maxHeight: "65vh", overflowY: "auto", border: "1px solid #dee2e6", borderRadius: "4px" }}>
          <Table striped bordered hover size="sm" className="text-center align-middle mb-0" style={{ whiteSpace: "nowrap", fontSize: "0.78rem", width: "100%" }}>
            <thead className="table-dark" style={{ position: "sticky", top: 0, zIndex: 1 }}>
              <tr className="fw-normal">
                <th className="fw-normal" style={{ width: "40px" }}>#</th>
                <th className="fw-normal">Patente</th>
                <th className="fw-normal">Responsable</th>
                {MESES_CORTOS.map((m) => <th key={m} className="fw-normal">{m}</th>)}
                <th className="fw-normal">Estado</th>
              </tr>
            </thead>
            <tbody>
              {camionetas
                .filter((c) => c.patente.toLowerCase().includes(filtroPat.toLowerCase()))
                .map((c, idx) => {
                const ultimo = ultimos.find((u) => getId(u.camioneta) === c._id.toString());
                const serv   = ultimosService.find((u) => getId(u.camioneta) === c._id.toString());
                const estado = getEstado(ultimo?.kms, serv?.kms);
                return (
                  <tr key={c._id}>
                    <td className="text-muted" style={{ fontSize: "0.8rem" }}>{idx + 1}</td>
                    <td className="text-start" style={{ cursor: "pointer" }} onClick={() => navigate("/camionetas/altas")}>
                      <span style={{ display: "inline-block", backgroundColor: "#4a6fa5", color: "#fff", borderRadius: "4px", padding: "2px 10px", boxShadow: "3px 3px 6px rgba(0,0,0,0.35)", marginRight: "6px" }}>
                        {c.patente}
                      </span>
                      <span style={{ fontSize: "0.88rem" }}>{c.marca}</span>
                    </td>
                    <td>{c.responsable || "—"}</td>
                    {MESES_CORTOS.map((_, idx) => {
                      const mes = idx + 1;
                      const reg = getKmMes(c._id, mes);
                      return (
                        <td key={idx}>
                          {reg
                            ? <button
                                onClick={() => setDetalleReg(reg)}
                                onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = "#e3eaf7"; }}
                                onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "transparent"; }}
                                style={{ background: "transparent", border: "none", cursor: "pointer", fontWeight: "600", fontSize: "0.88rem", padding: "2px 4px", borderRadius: "4px", transition: "background-color 0.15s" }}
                              >{reg.kms.toLocaleString("es-AR")}</button>
                            : esMesFuturo(mes)
                              ? <span style={{ color: "#ccc" }}>—</span>
                              : <button style={BTN_PLUS} onMouseEnter={btnEnter} onMouseLeave={btnLeave} onClick={() => abrirKmModal(c._id, mes)}>+</button>
                          }
                        </td>
                      );
                    })}
                    <td>
                      {estado
                        ? <button
                            onClick={() => navigate("/camionetas/services/ultimo-service")}
                            onMouseEnter={(e) => { e.currentTarget.style.transform = "scale(1.08)"; e.currentTarget.style.boxShadow = "4px 4px 10px rgba(0,0,0,0.45)"; }}
                            onMouseLeave={(e) => { e.currentTarget.style.transform = "scale(1)"; e.currentTarget.style.boxShadow = "2px 2px 5px rgba(0,0,0,0.3)"; }}
                            style={{ backgroundColor: estado.bg, color: estado.color, borderRadius: "4px", padding: "5px 14px", fontWeight: "400", fontSize: "1rem", boxShadow: "2px 2px 5px rgba(0,0,0,0.3)", border: "none", cursor: "pointer", transition: "transform 0.15s ease, box-shadow 0.15s ease" }}
                          >{estado.label}</button>
                        : "—"}
                    </td>
                  </tr>
                );
              })}
              {camionetas.filter((c) => c.patente.toLowerCase().includes(filtroPat.toLowerCase())).length === 0 && (
                <tr><td colSpan={16} className="text-muted">{filtroPat ? `Sin resultados para "${filtroPat}"` : "Sin datos"}</td></tr>
              )}
            </tbody>
          </Table>
        </div>
      </div>

      {/* Modal Editar Km */}
      <Modal show={!!detalleReg} onHide={() => setDetalleReg(null)} centered contentClassName="border border-dark">
        <Modal.Header closeButton>
          <div>
            <Modal.Title className="fw-bold">Editar kilómetros</Modal.Title>
            {detalleReg && (() => {
              const cam = camionetas.find((c) => c._id === getId(detalleReg.camioneta));
              const mesNombre = detalleReg.mes ? MESES_CORTOS[detalleReg.mes - 1] : null;
              return (
                <div style={{ fontSize: "0.82rem", color: "#666", marginTop: "2px" }}>
                  {cam ? `${cam.patente} — ${cam.marca}` : ""}
                  {mesNombre ? ` · ${mesNombre} ${detalleReg.anio ?? ""}` : ""}
                </div>
              );
            })()}
          </div>
        </Modal.Header>
        <Modal.Body>
          {detalleReg && (
            <Form onSubmit={editForm.handleSubmit(onSubmitEdit)}>
              <Form.Group className="mb-3">
                <Form.Label className="fw-semibold">Fecha</Form.Label>
                <Form.Control type="date" className="w-50" {...editForm.register("fecha", { required: "Requerido" })} isInvalid={!!editForm.formState.errors.fecha} />
                <Form.Control.Feedback type="invalid">{editForm.formState.errors.fecha?.message}</Form.Control.Feedback>
              </Form.Group>
              <Form.Group className="mb-3">
                <Form.Label className="fw-semibold">Odómetro</Form.Label>
                <Form.Control type="number" className="w-50" {...editForm.register("kms", { required: "Requerido", validate: (v) => Number(v) >= detalleReg.kms || `No puede ser menor al valor actual (${detalleReg.kms.toLocaleString("es-AR")} km)` })} isInvalid={!!editForm.formState.errors.kms} />
                <Form.Control.Feedback type="invalid">{editForm.formState.errors.kms?.message}</Form.Control.Feedback>
              </Form.Group>
              <Form.Group className="mb-3">
                <Form.Label className="fw-semibold">Responsable</Form.Label>
                <Form.Control type="text" className="w-50" {...editForm.register("responsable")} />
              </Form.Group>
              <Form.Group className="mb-3">
                <Form.Label className="fw-semibold">Observaciones</Form.Label>
                <Form.Control as="textarea" rows={2} {...editForm.register("observaciones")} />
              </Form.Group>
              <div className="d-flex justify-content-between align-items-center mt-2">
                <Button
                  type="button"
                  onClick={eliminarKm}
                  style={{ backgroundColor: "#8b4a4a", border: "none", color: "#fff" }}
                >
                  <i className="bi bi-trash me-2"></i>Eliminar
                </Button>
                <div className="d-flex gap-2">
                  <Button variant="secondary" onClick={() => setDetalleReg(null)}>Cancelar</Button>
                  <Button type="submit" style={{ backgroundColor: "#000", border: "1px solid #000", color: "#fff" }}>
                    <i className="bi bi-save me-2"></i>Guardar
                  </Button>
                </div>
              </div>
            </Form>
          )}
        </Modal.Body>
      </Modal>

      {/* Modal Kilómetros */}
      <Modal show={showKmModal} onHide={cerrarKmModal} centered contentClassName="border border-dark">
        <Modal.Header closeButton>
          <Modal.Title className="fw-bold">Cargar Kilómetros</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form onSubmit={kmForm.handleSubmit(onSubmitKm)}>
            <Form.Group className="mb-3">
              <Form.Label className="fw-semibold">Fecha</Form.Label>
              <Form.Control type="date" className="w-50" {...kmForm.register("fecha", { required: "Requerido" })} isInvalid={!!kmForm.formState.errors.fecha} />
              <Form.Control.Feedback type="invalid">{kmForm.formState.errors.fecha?.message}</Form.Control.Feedback>
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label className="fw-semibold">Patente</Form.Label>
              <Form.Select className="w-50" {...kmForm.register("camioneta", { required: "Seleccioná una camioneta" })} isInvalid={!!kmForm.formState.errors.camioneta}>
                <option value="">— Seleccionar —</option>
                {camionetas.map((c) => <option key={c._id} value={c._id}>{c.patente} — {c.marca}</option>)}
              </Form.Select>
              <Form.Control.Feedback type="invalid">{kmForm.formState.errors.camioneta?.message}</Form.Control.Feedback>
            </Form.Group>
            <ResponsableDropdown value={responsableKm} onChange={(v) => kmForm.setValue("responsable", v)} onSelect={(v) => kmForm.setValue("responsable", v)} camionetas={camionetas} dropOpen={dropOpenKm} setDropOpen={setDropOpenKm} filtro={filtroKm} setFiltro={setFiltroKm} dropRef={dropRefKm} />
            <Form.Group className="mb-3">
              <Form.Label className="fw-semibold">Odómetro</Form.Label>
              <Form.Control type="number" className="w-50" placeholder="Ej: 125000" {...kmForm.register("kms", { required: "Requerido", min: { value: 0, message: "Debe ser positivo" } })} isInvalid={!!kmForm.formState.errors.kms} />
              <Form.Control.Feedback type="invalid">{kmForm.formState.errors.kms?.message}</Form.Control.Feedback>
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label className="fw-semibold">Observaciones</Form.Label>
              <Form.Control as="textarea" rows={2} placeholder="Opcional..." {...kmForm.register("observaciones")} />
            </Form.Group>
            <div className="d-flex justify-content-end gap-2">
              <Button variant="secondary" onClick={cerrarKmModal}>Cancelar</Button>
              <Button type="submit" style={{ backgroundColor: "#000", border: "1px solid #000", color: "#fff" }}>
                <i className="bi bi-save me-2"></i>Guardar
              </Button>
            </div>
          </Form>
        </Modal.Body>
      </Modal>

    </div>
  );
}

export default ServicesKilometros;


