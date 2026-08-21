import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useForm, useWatch } from "react-hook-form";
import { Button, Modal, Form, Table, Container } from "react-bootstrap";
import Swal from "sweetalert2";
import { nuevoWorkbook } from "../../helpers/excel";

import { getIntervalKm, getEstado } from "../../utils/serviceHelpers";

const AÑOS = Array.from({ length: 6 }, (_, i) => 2026 + i);

const formatFecha = (iso) => {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric" });
};

function ServicesUltimoService() {
  const navigate = useNavigate();
  const [showModal, setShowModal] = useState(false);
  const [camionetas, setCamionetas] = useState([]);
  const [ultimos, setUltimos] = useState([]);
  const [ultimosKm, setUltimosKm] = useState([]);
  const [paradasAbiertas, setParadasAbiertas] = useState(new Set());
  const [dropOpen, setDropOpen] = useState(false);
  const [filtro, setFiltro] = useState("");
  const dropRef = useRef(null);
  const [año, setAnio] = useState(2026);
  const [dropAño, setDropAño] = useState(false);
  const dropAñoRef = useRef(null);
  const [telefonoAviso, setTelefonoAviso] = useState("");
  const [guardandoTel, setGuardandoTel] = useState(false);
  const [busquedaPatente, setBusquedaPatente] = useState("");
  const [obsModalText, setObsModalText] = useState(null);
  const [guardandoObs, setGuardandoObs] = useState(false);

  const {
    register,
    handleSubmit,
    setValue,
    reset,
    control,
    formState: { errors },
  } = useForm({
    defaultValues: {
      camioneta: "",
      fecha: new Date().toISOString().split("T")[0],
      responsable: "",
      kms: "",
      observaciones: "",
    },
  });

  const camionetaId = useWatch({ control, name: "camioneta" });
  const responsableVal = useWatch({ control, name: "responsable" });

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

  const cargarTabla = (anio) =>
    Promise.all([
      fetch(`/api/services/ultimos/${anio}`)
        .then((r) => (r.ok ? r.json() : []))
        .then((d) => setUltimos(Array.isArray(d) ? d : []))
        .catch(() => setUltimos([])),
      fetch("/api/kilometros/ultimos")
        .then((r) => (r.ok ? r.json() : []))
        .then((d) => setUltimosKm(Array.isArray(d) ? d : []))
        .catch(() => setUltimosKm([])),
      cargarParadas(),
    ]);

  useEffect(() => {
    fetch("/api/camionetas")
      .then((r) => (r.ok ? r.json() : []))
      .then((d) => setCamionetas(Array.isArray(d) ? d : []))
      .catch(() => setCamionetas([]));
    fetch("/api/config")
      .then((r) => (r.ok ? r.json() : {}))
      .then((cfg) => setTelefonoAviso(cfg?.telefonoAviso ?? ""))
      .catch(() => {});
    cargarParadas();
  }, []);

  useEffect(() => {
    cargarTabla(año);
  }, [año]);

  useEffect(() => {
    const handler = (e) => {
      if (dropRef.current && !dropRef.current.contains(e.target)) {
        setDropOpen(false);
        setFiltro("");
      }
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
    const c = camionetas.find((c) => c._id === camionetaId);
    const reg = ultimos.find((u) => u.camioneta?._id === camionetaId || u.camioneta === camionetaId);
    reset({
      camioneta: camionetaId,
      fecha: new Date().toISOString().split("T")[0],
      responsable: c?.responsable ?? "",
      kms: reg?.kms ?? "",
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
        await Promise.all([cargarTabla(año), cargarCamionetas(), cargarParadas()]);
        Swal.fire({
          icon: "success",
          title: "Service guardado",
          timer: 1400,
          showConfirmButton: false,
          width: "300px",
        });
      } else {
        const err = await res.json();
        Swal.fire({ icon: "error", title: "Error", text: err.error, width: "320px" });
      }
    } catch {
      Swal.fire({ icon: "error", title: "Sin conexión", text: "No se pudo conectar con el servidor", width: "320px" });
    }
  };

  const exportarExcel = async () => {
    const titulo = `Control de Último Service - Flota de Camionetas (${año})`;
    const columnas = ["Patente", "Vehículo", "Responsable", "Fecha Service", "Km Últ. Service", "Km Próx. Service", "Km Actuales", "Observaciones", "Estado"];
    const fechaHoy = new Date().toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric" });

    const wb = await nuevoWorkbook();
    const ws = wb.addWorksheet("Último Service");

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
      const reg = ultimos.find((u) => u.camioneta?._id === c._id || u.camioneta === c._id);
      const km = ultimosKm.find((u) => u.camioneta?._id === c._id || u.camioneta === c._id);
      const estado = getEstado(km?.kms, reg?.kms, c.patente);
      const kmActualesVal = km?.kms && typeof km.kms === "number" ? km.kms.toLocaleString("es-AR") : km?.kms || "—";
      const kmUltServiceVal = reg?.kms ? Number(reg.kms).toLocaleString("es-AR") : "—";
      const kmProxServiceVal = reg?.kms ? (Number(reg.kms) + getIntervalKm(c.patente, reg.kms, km?.kms)).toLocaleString("es-AR") : "—";

      const fila = ws.addRow([
        c.patente,
        c.marca,
        c.responsable || "—",
        reg ? formatFecha(reg.fecha) : "—",
        kmUltServiceVal,
        kmProxServiceVal,
        kmActualesVal,
        reg?.observaciones || "—",
        estado?.label ?? "—",
      ]);
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
      fila.getCell(8).alignment = { horizontal: "left", vertical: "middle" };
    });

    ws.columns = [
      { width: 14 },
      { width: 24 },
      { width: 22 },
      { width: 14 },
      { width: 16 },
      { width: 16 },
      { width: 16 },
      { width: 30 },
      { width: 16 },
    ];

    const buffer = await wb.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `ultimo_service_${año}.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const guardarTelefono = async () => {
    setGuardandoTel(true);
    try {
      await fetch("/api/config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ telefonoAviso }),
      });
      Swal.fire({ icon: "success", title: "Número guardado", timer: 1200, showConfirmButton: false, width: "280px" });
    } catch {
      /* silencioso */
    }
    setGuardandoTel(false);
  };

  const guardarObservacion = async () => {
    if (!obsModalText) return;
    setGuardandoObs(true);
    try {
      if (obsModalText.serviceId) {
        const res = await fetch(`/api/services/${obsModalText.serviceId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ observaciones: obsModalText.texto }),
        });
        if (res.ok) {
          setObsModalText(null);
          await cargarTabla(año);
          Swal.fire({
            icon: "success",
            title: "Observaciones guardadas",
            timer: 1300,
            showConfirmButton: false,
            width: "300px",
          });
        } else {
          Swal.fire({ icon: "error", title: "Error", text: "No se pudo guardar", width: "300px" });
        }
      } else {
        const res = await fetch("/api/services", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            camioneta: obsModalText.camionetaId,
            fecha: new Date().toISOString().split("T")[0],
            observaciones: obsModalText.texto,
          }),
        });
        if (res.ok) {
          setObsModalText(null);
          await Promise.all([cargarTabla(año), cargarCamionetas()]);
          Swal.fire({
            icon: "success",
            title: "Observaciones guardadas",
            timer: 1300,
            showConfirmButton: false,
            width: "300px",
          });
        } else {
          Swal.fire({ icon: "error", title: "Error", text: "No se pudo guardar", width: "300px" });
        }
      }
    } catch {
      Swal.fire({ icon: "error", title: "Sin conexión", text: "No se pudo conectar", width: "300px" });
    } finally {
      setGuardandoObs(false);
    }
  };

  const marcarWhatsapp = async (camionetaId, enviado) => {
    try {
      await fetch(`/api/camionetas/${camionetaId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ serviceNotificado: enviado }),
      });
      setCamionetas((prev) =>
        prev.map((c) => (c._id === camionetaId ? { ...c, serviceNotificado: enviado } : c))
      );
    } catch {
      /* silencioso */
    }
  };

  const enviarAvisoWhatsapp = (c) => {
    const telResp = c.telefono?.trim();
    const telAviso = telefonoAviso?.trim();
    const texto = encodeURIComponent(`Hola. Mensaje automático: El service de la camioneta ${c.patente} a cargo de ${c.responsable || "—"} ha vencido`);

    if (telResp && telAviso && telResp !== telAviso) {
      Swal.fire({
        title: "Enviar aviso de service",
        html: `
          <p class="mb-3 text-muted small">Seleccioná destinatario para <b>${c.patente}</b>:</p>
          <div style="display: flex; flex-direction: column; gap: 8px;">
            <button id="swal-btn-resp" class="btn w-100 fw-semibold text-white rounded-3" style="background-color: #25d366; padding: 8px 12px;">
              <i class="bi bi-whatsapp me-2"></i>Responsable (${c.responsable || "Sin nombre"})
            </button>
            <button id="swal-btn-aviso" class="btn w-100 fw-semibold text-white rounded-3" style="background-color: #1e293b; padding: 8px 12px;">
              <i class="bi bi-whatsapp me-2"></i>Número de aviso
            </button>
            <button id="swal-btn-ambos" class="btn w-100 fw-semibold text-white rounded-3" style="background-color: #15803d; padding: 8px 12px;">
              <i class="bi bi-whatsapp me-2"></i>Enviar a ambos
            </button>
            <button id="swal-btn-informado" class="btn w-100 fw-semibold text-white rounded-3" style="background-color: #64748b; padding: 8px 12px;">
              <i class="bi bi-check-circle me-2"></i>Informado
            </button>
          </div>
        `,
        icon: "question",
        showConfirmButton: false,
        showCancelButton: true,
        cancelButtonText: "Cancelar",
        cancelButtonColor: "#94a3b8",
        width: "360px",
        didOpen: () => {
          const btnResp = document.getElementById("swal-btn-resp");
          const btnAviso = document.getElementById("swal-btn-aviso");
          const btnAmbos = document.getElementById("swal-btn-ambos");
          const btnInformado = document.getElementById("swal-btn-informado");

          if (btnResp) {
            btnResp.onclick = () => {
              Swal.close();
              window.open(`https://wa.me/${telResp}?text=${texto}`, "_blank");
              marcarWhatsapp(c._id, true);
            };
          }
          if (btnAviso) {
            btnAviso.onclick = () => {
              Swal.close();
              window.open(`https://wa.me/${telAviso}?text=${texto}`, "_blank");
              marcarWhatsapp(c._id, true);
            };
          }
          if (btnAmbos) {
            btnAmbos.onclick = () => {
              Swal.close();
              window.open(`https://wa.me/${telResp}?text=${texto}`, "_blank");
              marcarWhatsapp(c._id, true);

              setTimeout(() => {
                Swal.fire({
                  title: "Segundo aviso",
                  html: `Se abrió el WhatsApp de <b>${c.responsable || "Responsable"}</b>.<br/><br/>Hacé clic para enviar al <b>número general</b> (${telAviso}).`,
                  icon: "info",
                  confirmButtonText: "Abrir 2do WhatsApp",
                  confirmButtonColor: "#25d366",
                  width: "340px",
                }).then((res2) => {
                  if (res2.isConfirmed) {
                    window.open(`https://wa.me/${telAviso}?text=${texto}`, "_blank");
                  }
                });
              }, 300);
            };
          }
          if (btnInformado) {
            btnInformado.onclick = () => {
              Swal.close();
              marcarWhatsapp(c._id, true);
            };
          }
        },
      });
    } else {
      const tel = telResp || telAviso;
      if (tel) {
        Swal.fire({
          title: "Enviar aviso de service",
          html: `
            <p class="mb-3 text-muted small">Seleccioná una opción para <b>${c.patente}</b>:</p>
            <div style="display: flex; flex-direction: column; gap: 8px;">
              <button id="swal-btn-single-wa" class="btn w-100 fw-semibold text-white rounded-3" style="background-color: #25d366; padding: 8px 12px;">
                <i class="bi bi-whatsapp me-2"></i>Enviar WhatsApp
              </button>
              <button id="swal-btn-single-inf" class="btn w-100 fw-semibold text-white rounded-3" style="background-color: #64748b; padding: 8px 12px;">
                <i class="bi bi-check-circle me-2"></i>Informado
              </button>
            </div>
          `,
          icon: "question",
          showConfirmButton: false,
          showCancelButton: true,
          cancelButtonText: "Cancelar",
          cancelButtonColor: "#94a3b8",
          width: "340px",
          didOpen: () => {
            const btnSingleWa = document.getElementById("swal-btn-single-wa");
            const btnSingleInf = document.getElementById("swal-btn-single-inf");

            if (btnSingleWa) {
              btnSingleWa.onclick = () => {
                Swal.close();
                window.open(`https://wa.me/${tel}?text=${texto}`, "_blank");
                marcarWhatsapp(c._id, true);
              };
            }
            if (btnSingleInf) {
              btnSingleInf.onclick = () => {
                Swal.close();
                marcarWhatsapp(c._id, true);
              };
            }
          },
        });
      }
    }
  };

  const responsablesUnicos = camionetas
    .map((c) => c.responsable)
    .filter(Boolean)
    .filter((v, i, arr) => arr.indexOf(v) === i)
    .sort();

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
              backgroundColor: "#10b981",
              color: "#fff",
              fontSize: "1.15rem",
              boxShadow: "0 2px 8px rgba(16, 185, 129, 0.3)",
            }}
          >
            <i className="bi bi-calendar-check-fill"></i>
          </div>
          <div className="d-flex align-items-center gap-2">
            <span className="text-white fs-6">Control de Último Service</span>
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
        {/* Barra de Filtros, Teléfono y Acciones */}
        <div
          className="d-flex align-items-center justify-content-between mb-3 flex-wrap gap-2"
          style={{ maxWidth: "1020px", width: "100%", margin: "0 auto" }}
        >
          {/* Año, Buscador, Teléfono WhatsApp y Excel */}
          <div className="d-flex align-items-center gap-2.5 flex-wrap">
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
                        setAnio(a);
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

            {/* Buscador de Patente */}
            <div style={{ position: "relative", width: "190px" }}>
              <i
                className="bi bi-search text-muted"
                style={{ position: "absolute", left: "10px", top: "50%", transform: "translateY(-50%)", fontSize: "0.82rem" }}
              ></i>
              <Form.Control
                type="text"
                placeholder="Buscar patente..."
                value={busquedaPatente}
                onChange={(e) => setBusquedaPatente(e.target.value)}
                size="sm"
                className="rounded-3 ps-4"
                style={{ fontSize: "0.84rem", paddingRight: busquedaPatente ? "28px" : undefined }}
              />
              {busquedaPatente && (
                <button
                  onClick={() => setBusquedaPatente("")}
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

            {/* Configuración Teléfono WhatsApp */}
            <div className="d-flex align-items-center gap-2 bg-white px-3 py-1.5 rounded-3 border shadow-sm">
              <i className="bi bi-whatsapp text-success" style={{ fontSize: "1.1rem" }}></i>
              <span className="small fw-semibold text-secondary" style={{ fontSize: "0.82rem", whiteSpace: "nowrap" }}>
                J. Posleman:
              </span>
              <input
                type="text"
                value={telefonoAviso}
                onChange={(e) => setTelefonoAviso(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && guardarTelefono()}
                placeholder="5491123456789"
                className="border-0 bg-transparent px-2"
                style={{ fontSize: "0.86rem", width: "190px", outline: "none", color: "#1e293b" }}
              />
              <button
                onClick={guardarTelefono}
                disabled={guardandoTel}
                className="btn btn-sm btn-outline-secondary py-1 px-3 rounded-2 fw-semibold"
                style={{ fontSize: "0.76rem" }}
              >
                {guardandoTel ? "..." : "Guardar"}
              </button>
            </div>
          </div>

          {/* Botón Excel alineado a la derecha */}
          <Button
            variant="success"
            size="sm"
            onClick={exportarExcel}
            className="d-inline-flex align-items-center gap-1.5 rounded-3 px-3 py-1.5 shadow-sm ms-auto"
            style={{
              backgroundColor: "#15803d",
              borderColor: "#15803d",
              fontSize: "0.82rem",
              fontWeight: 500,
            }}
            title="Exportar planilla a Excel"
          >
            <i className="bi bi-file-earmark-excel-fill"></i>
            <span>Excel</span>
          </Button>
        </div>

        {/* Tabla de Último Service (Ancho compactado y centrado) */}
        <div
          className="flex-grow-1 shadow-sm rounded-3 bg-white"
          style={{
            overflowY: "auto",
            overflowX: "auto",
            border: "1px solid #cbd5e1",
            maxWidth: "1020px",
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
                <th style={{ width: "30px", backgroundColor: "#1e293b", color: "#fff", padding: "5px 2px", fontWeight: "normal" }}>#</th>
                <th style={{ width: "70px", backgroundColor: "#1e293b", color: "#fff", padding: "5px 2px", fontWeight: "normal" }}>Acción</th>
                <th style={{ width: "140px", backgroundColor: "#1e293b", color: "#fff", padding: "5px 6px", textAlign: "left", fontWeight: "normal" }}>Patente</th>
                <th style={{ width: "120px", backgroundColor: "#1e293b", color: "#fff", padding: "5px 6px", fontWeight: "normal" }}>Responsable</th>
                <th style={{ width: "80px", backgroundColor: "#1e293b", color: "#fff", padding: "5px 4px", fontWeight: "normal" }}>Fecha</th>
                <th style={{ width: "85px", backgroundColor: "#1e293b", color: "#fff", padding: "5px 4px", fontWeight: "normal" }}>Km Últ. Srv.</th>
                <th style={{ width: "85px", backgroundColor: "#1e293b", color: "#fff", padding: "5px 4px", fontWeight: "normal" }}>Km Próx. Srv.</th>
                <th style={{ width: "80px", backgroundColor: "#1e293b", color: "#fff", padding: "5px 4px", fontWeight: "normal" }}>Km Actuales</th>
                <th style={{ width: "32px", backgroundColor: "#1e293b", color: "#fff", padding: "5px 2px", fontWeight: "normal" }}>Obs.</th>
                <th style={{ width: "110px", backgroundColor: "#1e293b", color: "#fff", padding: "5px 4px", fontWeight: "normal" }}>Estado</th>
              </tr>
            </thead>
            <tbody>
              {camionetas
                .filter((c) => c.patente.toLowerCase().includes(busquedaPatente.toLowerCase()))
                .map((c, idx) => {
                  const estaParada = paradasAbiertas.has(c._id.toString());
                  const reg = ultimos.find((u) => u.camioneta?._id === c._id || u.camioneta === c._id);
                  const km = ultimosKm.find((u) => u.camioneta?._id === c._id || u.camioneta === c._id);
                  const estado = getEstado(km?.kms, reg?.kms, c.patente);
                  const isEven = idx % 2 === 0;

                  return (
                    <tr
                      key={c._id}
                      className={estaParada ? "tr-parada" : ""}
                      style={{
                        backgroundColor: estaParada ? "#fee2e2" : isEven ? "#ffffff" : "#f8fafc",
                        borderBottom: "1px solid #e2e8f0",
                      }}
                    >
                      <td className="text-muted" style={{ fontSize: "0.75rem", padding: "4px 2px" }}>
                        {idx + 1}
                      </td>

                      {/* Botón Acción + Service */}
                      <td style={{ padding: "4px 2px" }}>
                        <button
                          onClick={() => abrirModal(c._id)}
                          className="btn btn-sm py-0.5 px-1.5 rounded-2 text-white shadow-sm"
                          style={{
                            backgroundColor: "#1e293b",
                            border: "1px solid #475569",
                            fontSize: "0.72rem",
                            fontWeight: 500,
                            transition: "all 0.15s ease",
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.backgroundColor = "#334155";
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.backgroundColor = "#1e293b";
                          }}
                          title="Cargar service para esta unidad"
                        >
                          + Service
                        </button>
                      </td>

                      {/* Patente y Marca (sin palabra parada) */}
                      <td className="text-start" style={{ padding: "4px 8px" }}>
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

                      {/* Fecha Service */}
                      <td style={{ fontSize: "0.76rem", color: "#475569", padding: "4px 4px" }}>{reg ? formatFecha(reg.fecha) : "—"}</td>

                      {/* Km Último Service */}
                      <td className="fw-semibold" style={{ fontSize: "0.8rem", color: "#0f172a", padding: "4px 4px" }}>
                        {reg?.kms ? Number(reg.kms).toLocaleString("es-AR") : "—"}
                      </td>

                      {/* Km Próximo Service */}
                      <td className="fw-semibold" style={{ fontSize: "0.8rem", color: "#2563eb", padding: "4px 4px" }}>
                        {reg?.kms
                          ? (Number(reg.kms) + getIntervalKm(c.patente, reg.kms, km?.kms)).toLocaleString("es-AR")
                          : "—"}
                      </td>

                      {/* Km Actuales */}
                      <td className="fw-semibold" style={{ fontSize: "0.8rem", color: "#0f172a", padding: "4px 4px" }}>
                        {km?.kms && typeof km.kms === "number"
                          ? km.kms.toLocaleString("es-AR")
                          : km?.kms || "—"}
                      </td>

                      {/* Observaciones Modal */}
                      <td style={{ padding: "4px 2px" }}>
                        <button
                          className={`btn btn-sm p-0 rounded-circle d-inline-flex align-items-center justify-content-center ${
                            reg?.observaciones?.trim()
                              ? "btn-outline-primary"
                              : "btn-outline-secondary"
                          }`}
                          style={{
                            width: "22px",
                            height: "22px",
                            fontSize: "0.72rem",
                            opacity: reg?.observaciones?.trim() ? 1 : 0.6,
                          }}
                          onClick={() =>
                            setObsModalText({
                              serviceId: reg?._id,
                              camionetaId: c._id,
                              patente: c.patente,
                              marca: c.marca,
                              texto: reg?.observaciones || "",
                            })
                          }
                          title={reg?.observaciones?.trim() ? "Editar observaciones" : "Agregar observación"}
                        >
                          <i className={`bi ${reg?.observaciones?.trim() ? "bi-chat-left-text-fill" : "bi-plus"}`}></i>
                        </button>
                      </td>

                      {/* Estado y WhatsApp */}
                      <td style={{ padding: "4px 6px" }}>
                        <div className="d-flex align-items-center justify-content-center gap-1.5">
                          {estado ? (
                            <span
                              className="badge py-1.5 px-2.5 border-0 shadow-sm"
                              style={{
                                backgroundColor: estado.bg,
                                color: estado.color,
                                fontSize: "0.76rem",
                                fontWeight: 600,
                                borderRadius: "6px",
                              }}
                            >
                              {estado.label}
                            </span>
                          ) : (
                            <span className="text-muted">—</span>
                          )}

                          {/* Botón WhatsApp si está atrasado */}
                          {(() => {
                            const tieneTelefono = Boolean(c.telefono?.trim() || telefonoAviso?.trim());
                            if (estado?.label === "Atrasado" && tieneTelefono && !c.serviceNotificado) {
                              return (
                                <button
                                  onClick={() => enviarAvisoWhatsapp(c)}
                                  className="btn btn-sm py-1 px-2 text-white shadow-sm d-inline-flex align-items-center gap-1"
                                  style={{
                                    backgroundColor: "#25d366",
                                    border: "none",
                                    borderRadius: "6px",
                                    fontSize: "0.72rem",
                                    fontWeight: 600,
                                  }}
                                  title="Enviar aviso por WhatsApp"
                                >
                                  <i className="bi bi-whatsapp"></i>
                                  <span>Avisar</span>
                                </button>
                              );
                            }
                            if (estado?.label === "Atrasado" && c.serviceNotificado) {
                              return (
                                <button
                                  onClick={() => marcarWhatsapp(c._id, false)}
                                  className="btn btn-sm py-1 px-2 d-inline-flex align-items-center gap-1"
                                  style={{
                                    backgroundColor: "#dcfce7",
                                    color: "#166534",
                                    border: "1px solid #86efac",
                                    borderRadius: "6px",
                                    fontSize: "0.72rem",
                                    fontWeight: 600,
                                  }}
                                  title="Avisado — clic para desmarcar"
                                >
                                  <i className="bi bi-check-lg"></i>
                                  <span>Avisado</span>
                                </button>
                              );
                            }
                            return null;
                          })()}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              {camionetas.filter((c) => c.patente.toLowerCase().includes(busquedaPatente.toLowerCase())).length === 0 && (
                <tr>
                  <td colSpan={10} className="text-muted py-4">
                    {busquedaPatente ? `Sin resultados para "${busquedaPatente}"` : "Sin datos"}
                  </td>
                </tr>
              )}
            </tbody>
          </Table>
        </div>
      </Container>

      {/* Modal Cargar Service */}
      <Modal show={showModal} onHide={cerrarModal} centered contentClassName="border rounded-4 shadow">
        <Modal.Header closeButton style={{ backgroundColor: "#1e293b", color: "#fff", borderTopLeftRadius: "15px", borderTopRightRadius: "15px", padding: "12px 18px" }}>
          <Modal.Title className="fs-6 fw-bold mb-0">Cargar Service</Modal.Title>
        </Modal.Header>
        <Modal.Body className="p-4 bg-white">
          <Form onSubmit={handleSubmit(onSubmit)} className="d-flex flex-column align-items-center">
            <div style={{ width: "100%", maxWidth: "280px" }}>
              <Form.Group className="mb-2.5">
                <Form.Label className="fw-semibold small text-dark mb-1">Fecha</Form.Label>
                <Form.Control
                  type="date"
                  size="sm"
                  className="rounded-3"
                  {...register("fecha", { required: "Requerido" })}
                  isInvalid={!!errors.fecha}
                />
                <Form.Control.Feedback type="invalid">{errors.fecha?.message}</Form.Control.Feedback>
              </Form.Group>

              <Form.Group className="mb-2.5">
                <Form.Label className="fw-semibold small text-dark mb-1">Camioneta</Form.Label>
                <Form.Select
                  size="sm"
                  className="rounded-3"
                  {...register("camioneta", { required: "Seleccioná una camioneta" })}
                  isInvalid={!!errors.camioneta}
                >
                  <option value="">— Seleccionar —</option>
                  {camionetas.map((c) => (
                    <option key={c._id} value={c._id}>
                      {c.patente} — {c.marca} {c.responsable ? `(${c.responsable})` : ""}
                    </option>
                  ))}
                </Form.Select>
                <Form.Control.Feedback type="invalid">{errors.camioneta?.message}</Form.Control.Feedback>
              </Form.Group>

              <Form.Group className="mb-2.5" ref={dropRef} style={{ position: "relative" }}>
                <Form.Label className="fw-semibold small text-dark mb-1">Responsable</Form.Label>
                <input type="hidden" {...register("responsable")} />
                <Form.Control
                  size="sm"
                  className="rounded-3"
                  placeholder="— Seleccionar o escribir —"
                  value={dropOpen ? filtro : responsableVal}
                  onChange={(e) => {
                    setFiltro(e.target.value);
                    setValue("responsable", e.target.value);
                  }}
                  onFocus={() => {
                    setFiltro(responsableVal);
                    setDropOpen(true);
                  }}
                  autoComplete="off"
                />
                {dropOpen && (
                  <div
                    style={{
                      position: "absolute",
                      top: "100%",
                      left: 0,
                      width: "100%",
                      backgroundColor: "#fff",
                      border: "1px solid #cbd5e1",
                      borderRadius: "8px",
                      boxShadow: "0 8px 24px rgba(0,0,0,0.15)",
                      zIndex: 1060,
                      maxHeight: "180px",
                      overflowY: "auto",
                    }}
                  >
                    {responsablesUnicos
                      .filter((r) => r.toLowerCase().includes(filtro.toLowerCase()))
                      .map((r) => (
                        <div
                          key={r}
                          style={{
                            padding: "6px 12px",
                            cursor: "pointer",
                            fontSize: "0.84rem",
                            backgroundColor: responsableVal === r ? "#f1f5f9" : "transparent",
                          }}
                          onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#f8fafc")}
                          onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = responsableVal === r ? "#f1f5f9" : "transparent")}
                          onMouseDown={(e) => {
                            e.preventDefault();
                            setValue("responsable", r);
                            setFiltro("");
                            setDropOpen(false);
                          }}
                        >
                          {r}
                        </div>
                      ))}
                  </div>
                )}
              </Form.Group>

              <Form.Group className="mb-2.5">
                <Form.Label className="fw-semibold small text-dark mb-1">Km Último Service</Form.Label>
                <Form.Control
                  type="number"
                  size="sm"
                  className="rounded-3"
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
                <Form.Label className="fw-semibold small text-dark mb-1">Observaciones</Form.Label>
                <Form.Control as="textarea" rows={2} size="sm" className="rounded-3" placeholder="Opcional..." {...register("observaciones")} />
              </Form.Group>

              <div className="d-flex justify-content-center gap-2 pt-2 border-top">
                <Button variant="outline-secondary" size="sm" onClick={cerrarModal} className="rounded-3 px-3 py-1" style={{ fontSize: "0.8rem" }}>
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  className="rounded-3 px-3.5 py-1 text-white"
                  style={{ backgroundColor: "#1e293b", borderColor: "#1e293b", fontSize: "0.8rem" }}
                >
                  <i className="bi bi-check-lg me-1"></i>Guardar
                </Button>
              </div>
            </div>
          </Form>
        </Modal.Body>
      </Modal>

      {/* Modal Observaciones Editable */}
      <Modal show={!!obsModalText} onHide={() => setObsModalText(null)} centered contentClassName="border rounded-4 shadow">
        <Modal.Header closeButton style={{ backgroundColor: "#1e293b", color: "#fff", borderTopLeftRadius: "15px", borderTopRightRadius: "15px", padding: "12px 18px" }}>
          <div>
            <Modal.Title className="fs-6 fw-bold mb-0">Observaciones</Modal.Title>
            <div style={{ fontSize: "0.78rem", color: "#cbd5e1", marginTop: "2px" }}>
              {obsModalText?.patente} {obsModalText?.marca ? `— ${obsModalText.marca}` : ""}
            </div>
          </div>
        </Modal.Header>
        <Modal.Body className="p-3 bg-white">
          <Form.Group>
            <Form.Label className="fw-semibold small text-dark mb-1">Detalle / Novedades</Form.Label>
            <Form.Control
              as="textarea"
              rows={4}
              className="rounded-3"
              style={{ fontSize: "0.86rem" }}
              value={obsModalText?.texto ?? ""}
              onChange={(e) => setObsModalText((prev) => ({ ...prev, texto: e.target.value }))}
              placeholder="Escribir observaciones..."
              autoFocus
            />
          </Form.Group>
        </Modal.Body>
        <Modal.Footer className="d-flex justify-content-end gap-2 py-2 px-3 border-top">
          <Button variant="outline-secondary" size="sm" onClick={() => setObsModalText(null)} className="rounded-3 px-3 py-1" style={{ fontSize: "0.8rem" }}>
            Cancelar
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={guardarObservacion}
            disabled={guardandoObs}
            className="rounded-3 px-3.5 py-1 text-white"
            style={{ backgroundColor: "#1e293b", borderColor: "#1e293b", fontSize: "0.8rem" }}
          >
            <i className="bi bi-check-lg me-1"></i>{guardandoObs ? "Guardando..." : "Guardar"}
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
}

export default ServicesUltimoService;
