import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useForm, useWatch } from "react-hook-form";
import { Button, Modal, Form, Table } from "react-bootstrap";
import Swal from "sweetalert2";
import ExcelJS from "exceljs";

const INTERVAL_KM = 10000;
const AÑOS = Array.from({ length: 10 }, (_, i) => 2026 + i);

const BTN_SRV = { padding: "4px 8px", borderRadius: "6px", border: "none", backgroundColor: "#999", color: "#fff", fontWeight: "bold", fontSize: "0.75rem", lineHeight: 1, cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center", boxShadow: "2px 2px 6px rgba(0,0,0,0.35)", transition: "transform 0.15s ease, box-shadow 0.15s ease", whiteSpace: "nowrap" };
const btnEnter = (e) => { e.currentTarget.style.transform = "scale(1.1)"; e.currentTarget.style.boxShadow = "3px 3px 10px rgba(0,0,0,0.5)"; };
const btnLeave = (e) => { e.currentTarget.style.transform = "scale(1)";   e.currentTarget.style.boxShadow = "2px 2px 6px rgba(0,0,0,0.35)"; };

const formatFecha = (iso) => {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric" });
};

const getEstado = (odoActual, kmsService) => {
  if (odoActual == null || kmsService == null) return null;
  const diff = odoActual - kmsService;
  if (diff >= INTERVAL_KM)        return { label: "Atrasado",       bg: "#8b4a4a", color: "#fff" };
  if (diff >= INTERVAL_KM - 1000) return { label: "a 1.000 Km",     bg: "#b89840", color: "#333" };
  return                                   { label: "Al día",         bg: "#52735a", color: "#fff" };
};

function ServicesUltimoService() {
  const navigate = useNavigate();
  const [showModal, setShowModal] = useState(false);
  const [camionetas, setCamionetas] = useState([]);
  const [ultimos, setUltimos] = useState([]);
  const [ultimosKm, setUltimosKm] = useState([]);
  const [dropOpen, setDropOpen] = useState(false);
  const [filtro, setFiltro] = useState("");
  const dropRef = useRef(null);
  const [año, setAnio] = useState(new Date().getFullYear());
  const [dropAño, setDropAño] = useState(false);
  const dropAñoRef = useRef(null);

  const { register, handleSubmit, setValue, reset, control, formState: { errors } } = useForm({
    defaultValues: {
      camioneta: "",
      fecha: new Date().toISOString().split("T")[0],
      responsable: "",
      kms: "",
      observaciones: "",
    },
  });

  const camionetaId    = useWatch({ control, name: "camioneta" });
  const responsableVal = useWatch({ control, name: "responsable" });

  const cargarCamionetas = () =>
    fetch("/api/camionetas").then((r) => r.json()).then(setCamionetas).catch(() => {});

  const cargarTabla = (anio) => Promise.all([
    fetch(`/api/services/ultimos/${anio}`).then((r) => r.json()).then(setUltimos).catch(() => setUltimos([])),
    fetch("/api/kilometros/ultimos").then((r) => r.json()).then(setUltimosKm).catch(() => setUltimosKm([])),
  ]);

  useEffect(() => {
    fetch("/api/camionetas")
      .then((r) => r.json())
      .then(setCamionetas)
      .catch(() => setCamionetas([]));
  }, []);

  useEffect(() => {
    cargarTabla(año);
  }, [año]);

  useEffect(() => {
    const handler = (e) => {
      if (dropRef.current && !dropRef.current.contains(e.target)) { setDropOpen(false); setFiltro(""); }
      if (dropAñoRef.current && !dropAñoRef.current.contains(e.target)) setDropAño(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  useEffect(() => {
    const c = camionetas.find((c) => c._id === camionetaId);
    if (c?.responsable) setValue("responsable", c.responsable);
  }, [camionetaId, camionetas]);

  const abrirModal = (camionetaId = "") => {
    const c   = camionetas.find((c) => c._id === camionetaId);
    const reg = ultimos.find((u) => u.camioneta?._id === camionetaId || u.camioneta === camionetaId);
    reset({
      camioneta:    camionetaId,
      fecha:        new Date().toISOString().split("T")[0],
      responsable:  c?.responsable ?? "",
      kms:          reg?.kms ?? "",
      observaciones: "",
    });
    setShowModal(true);
  };

  const cerrarModal = () => {
    setShowModal(false);
    setFiltro("");
    setDropOpen(false);
  };

  const onSubmit = async (data) => {
    try {
      const res = await fetch("/api/services", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (res.ok) {
        cerrarModal();
        await Promise.all([cargarTabla(año), cargarCamionetas()]);
        Swal.fire({ icon: "success", title: "Service guardado", timer: 1500, showConfirmButton: false });
      } else {
        const err = await res.json();
        Swal.fire({ icon: "error", title: "Error", text: err.error });
      }
    } catch {
      Swal.fire({ icon: "error", title: "Sin conexión", text: "No se pudo conectar con el servidor" });
    }
  };

  const exportarExcel = async () => {
    const titulo   = "Último Service — Camionetas";
    const columnas = ["Patente", "Vehículo", "Fecha", "Km último service", "Observaciones", "Estado"];
    const fechaHoy = new Date().toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric" });

    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("Último Service");

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
      const reg    = ultimos.find((u) => u.camioneta?._id === c._id || u.camioneta === c._id);
      const km     = ultimosKm.find((u) => u.camioneta?._id === c._id || u.camioneta === c._id);
      const estado = getEstado(km?.kms, reg?.kms);
      const fila = ws.addRow([
        c.patente,
        c.marca,
        reg ? formatFecha(reg.fecha) : "—",
        reg?.kms ?? "—",
        reg?.observaciones || "—",
        estado?.label ?? "—",
      ]);
      fila.eachCell((cell) => { cell.alignment = { horizontal: "center", vertical: "middle" }; });
      fila.getCell(5).alignment = { horizontal: "left", vertical: "middle" };
    });

    ws.columns = [
      { width: 16 },
      { width: 26 },
      { width: 14 },
      { width: 18 },
      { width: 36 },
      { width: 14 },
    ];

    const buffer = await wb.xlsx.writeBuffer();
    const blob   = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    const url    = URL.createObjectURL(blob);
    const a      = document.createElement("a");
    a.href       = url;
    a.download   = `ultimo_service_${año}.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const marcarWhatsapp = async (camionetaId, enviado) => {
    try {
      await fetch(`/api/camionetas/${camionetaId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ serviceNotificado: enviado }),
      });
      setCamionetas((prev) =>
        prev.map((c) => c._id === camionetaId ? { ...c, serviceNotificado: enviado } : c)
      );
    } catch { /* silencioso */ }
  };

  const responsablesUnicos = camionetas
    .map((c) => c.responsable)
    .filter(Boolean)
    .filter((v, i, arr) => arr.indexOf(v) === i)
    .sort();

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>

      {/* Encabezado */}
      <div className="d-flex justify-content-between align-items-center" style={{ padding: "1rem 2rem 0" }}>
        <div className="d-flex align-items-center gap-3">
          <h3 className="fw-bold mb-0">Último service — Camionetas</h3>
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
                  >{a}</div>
                ))}
              </div>
            )}
          </div>
        </div>
        <div className="d-flex gap-2">
          <Button size="sm" onClick={exportarExcel} style={{ backgroundColor: "#1d6f42", border: "1px solid #1d6f42", color: "#fff" }}>
            <i className="bi bi-file-earmark-excel-fill me-2"></i>Excel
          </Button>
          <Button size="sm" onClick={() => navigate(-1)} style={{ backgroundColor: "#fff", border: "1px solid #000", color: "#000" }}>
            <i className="bi bi-arrow-left me-2"></i>Volver
          </Button>
          <Button size="sm" onClick={() => navigate("/camionetas/resumen")} style={{ backgroundColor: "#fff", border: "1px solid #000", color: "#000" }}>
            <i className="bi bi-speedometer me-2"></i>Tablero
          </Button>
          <Button size="sm" onClick={() => navigate("/")} style={{ backgroundColor: "#fff", border: "1px solid #000", color: "#000" }}>
            <i className="bi bi-house-fill me-2"></i>General
          </Button>
        </div>
      </div>

      {/* Tabla */}
      <div style={{ flex: 1, padding: "2rem", overflowY: "auto", overflowX: "auto" }}>

        <div className="d-flex justify-content-center">
          <Table bordered size="sm" className="text-center align-middle" style={{ whiteSpace: "nowrap", fontSize: "0.75rem", width: "75%" }}>
            <thead className="table-dark">
              <tr>
                <th style={{ width: "40px" }}>#</th>
                <th></th>
                <th>Patente</th>
                <th>Fecha</th>
                <th>Km último service</th>
                <th>Km prox. service</th>
                <th>Km actuales</th>
                <th>Observaciones</th>
                <th>Estado</th>
              </tr>
            </thead>
            <tbody>
              {camionetas.map((c, idx) => {
                const reg    = ultimos.find((u) => u.camioneta?._id === c._id || u.camioneta === c._id);
                const km     = ultimosKm.find((u) => u.camioneta?._id === c._id || u.camioneta === c._id);
                const estado = getEstado(km?.kms, reg?.kms);
                return (
                  <tr key={c._id}>
                    <td className="text-muted" style={{ fontSize: "0.8rem" }}>{idx + 1}</td>
                    <td className="text-center">
                      <button
                        onClick={() => abrirModal(c._id)}
                        style={BTN_SRV}
                        onMouseEnter={btnEnter}
                        onMouseLeave={btnLeave}
                      >+ ult. service</button>
                    </td>
                    <td className="text-start">
                      <span
                        onClick={() => navigate("/camionetas/altas")}
                        style={{ display: "inline-block", backgroundColor: "#52735a", color: "#fff", borderRadius: "4px", padding: "2px 8px", fontSize: "0.82rem", boxShadow: "3px 3px 6px rgba(0,0,0,0.35)", cursor: "pointer" }}
                      >
                        {c.patente} — {c.marca}
                      </span>
                    </td>
                    <td>{reg ? formatFecha(reg.fecha) : "—"}</td>
                    <td className="fw-semibold">{reg?.kms ? reg.kms.toLocaleString("es-AR") : "—"}</td>
                    <td className="fw-semibold">{reg?.kms ? (reg.kms + INTERVAL_KM).toLocaleString("es-AR") : "—"}</td>
                    <td className="fw-semibold">{km?.kms ? km.kms.toLocaleString("es-AR") : "—"}</td>
                    <td className="text-start text-muted" style={{ fontSize: "0.9rem" }}>{reg?.observaciones || "—"}</td>
                    <td>
                      <div className="d-flex flex-column align-items-center gap-1">
                        {estado
                          ? <span style={{ display: "inline-block", backgroundColor: estado.bg, color: estado.color, borderRadius: "4px", padding: "5px 14px", fontWeight: "400", fontSize: "1rem", boxShadow: "2px 2px 5px rgba(0,0,0,0.3)" }}>{estado.label}</span>
                          : "—"}
                        {estado?.label === "Atrasado" && c.telefono && !c.serviceNotificado && (
                          <button
                            onClick={() => {
                              window.open(`https://wa.me/${c.telefono}?text=${encodeURIComponent(`El service de la camioneta ${c.patente} a su cargo, ha vencido`)}`, "_blank");
                              marcarWhatsapp(c._id, true);
                            }}
                            style={{ display: "inline-flex", alignItems: "center", gap: "4px", backgroundColor: "#25d366", color: "#fff", borderRadius: "4px", padding: "3px 10px", fontSize: "0.75rem", fontWeight: "600", border: "none", cursor: "pointer", boxShadow: "1px 1px 4px rgba(0,0,0,0.25)" }}
                          >
                            <i className="bi bi-whatsapp"></i> Avisar
                          </button>
                        )}
                        {estado?.label === "Atrasado" && c.serviceNotificado && (
                          <button
                            onClick={() => marcarWhatsapp(c._id, false)}
                            title="Avisado — click para desmarcar"
                            style={{ display: "inline-flex", alignItems: "center", gap: "4px", backgroundColor: "#e8f5e9", color: "#2e7d32", borderRadius: "4px", padding: "3px 10px", fontSize: "0.75rem", fontWeight: "600", border: "1px solid #a5d6a7", cursor: "pointer" }}
                          >
                            <i className="bi bi-check-lg"></i> Avisado
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {camionetas.length === 0 && (
                <tr><td colSpan={9} className="text-muted">Sin datos</td></tr>
              )}
            </tbody>
          </Table>
        </div>

      </div>

      {/* Modal */}
      <Modal show={showModal} onHide={cerrarModal} centered contentClassName="border border-secondary">
        <Modal.Header closeButton>
          <Modal.Title className="fw-bold">Cargar Service</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form onSubmit={handleSubmit(onSubmit)}>

            <Form.Group className="mb-3">
              <Form.Label className="fw-semibold">Fecha</Form.Label>
              <Form.Control type="date" className="w-50" {...register("fecha", { required: "Requerido" })} isInvalid={!!errors.fecha} />
              <Form.Control.Feedback type="invalid">{errors.fecha?.message}</Form.Control.Feedback>
            </Form.Group>

            <Form.Group className="mb-3">
              <Form.Label className="fw-semibold">Patente</Form.Label>
              <Form.Select className="w-50" {...register("camioneta", { required: "Seleccioná una camioneta" })} isInvalid={!!errors.camioneta}>
                <option value="">— Seleccionar —</option>
                {camionetas.map((c) => (
                  <option key={c._id} value={c._id}>{c.patente} — {c.marca}</option>
                ))}
              </Form.Select>
              <Form.Control.Feedback type="invalid">{errors.camioneta?.message}</Form.Control.Feedback>
            </Form.Group>

            <Form.Group className="mb-3" ref={dropRef} style={{ position: "relative" }}>
              <Form.Label className="fw-semibold">Responsable</Form.Label>
              <input type="hidden" {...register("responsable")} />
              <Form.Control
                className="w-50"
                placeholder="— Seleccionar o escribir —"
                value={dropOpen ? filtro : responsableVal}
                onChange={(e) => { setFiltro(e.target.value); setValue("responsable", e.target.value); }}
                onFocus={() => { setFiltro(responsableVal); setDropOpen(true); }}
                autoComplete="off"
              />
              {dropOpen && (
                <div style={{ position: "absolute", top: "100%", left: 0, width: "50%", backgroundColor: "#fff", border: "2px solid #aaa", borderRadius: "4px", boxShadow: "0 4px 12px rgba(0,0,0,0.15)", zIndex: 1060, maxHeight: "180px", overflowY: "auto" }}>
                  {responsablesUnicos
                    .filter((r) => r.toLowerCase().includes(filtro.toLowerCase()))
                    .map((r) => (
                      <div
                        key={r}
                        style={{ padding: "8px 16px", cursor: "pointer", backgroundColor: responsableVal === r ? "#e9ecef" : "transparent" }}
                        onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#f0f0f0")}
                        onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = responsableVal === r ? "#e9ecef" : "transparent")}
                        onMouseDown={(e) => {
                          e.preventDefault();
                          setValue("responsable", r);
                          setFiltro("");
                          setDropOpen(false);
                        }}
                      >
                        {r}
                      </div>
                    ))
                  }
                </div>
              )}
            </Form.Group>

            <Form.Group className="mb-3">
              <Form.Label className="fw-semibold">Km último service</Form.Label>
              <Form.Control
                type="number"
                className="w-50"
                placeholder="Ej: 125000"
                {...register("kms", {
                validate: (v) => {
                  if (!v && v !== 0) return true;
                  const reg = ultimos.find((u) => (u.camioneta?._id?.toString() ?? u.camioneta?.toString()) === camionetaId);
                  if (reg?.kms && Number(v) < reg.kms)
                    return `No puede ser menor al valor actual (${reg.kms.toLocaleString("es-AR")} km)`;
                  return true;
                },
              })}
                isInvalid={!!errors.kms}
              />
              <Form.Control.Feedback type="invalid">{errors.kms?.message}</Form.Control.Feedback>
            </Form.Group>

            <Form.Group className="mb-3">
              <Form.Label className="fw-semibold">Observaciones</Form.Label>
              <Form.Control as="textarea" rows={3} placeholder="Opcional..." {...register("observaciones")} />
            </Form.Group>

            <div className="d-flex justify-content-end gap-2">
              <Button variant="secondary" onClick={cerrarModal}>Cancelar</Button>
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

export default ServicesUltimoService;


