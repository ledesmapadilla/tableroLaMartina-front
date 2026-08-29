import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useForm, useWatch } from "react-hook-form";
import { Button, Modal, Form, Table, Container } from "react-bootstrap";
import Swal from "sweetalert2";
import { nuevoWorkbook } from "../../helpers/excel";

import { getEstado } from "../../utils/serviceHelpers";
import LogoNavbar from "../shared/LogoNavbar";

const MESES_CORTOS = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
const AÑOS = Array.from({ length: 6 }, (_, i) => 2026 + i);

function ResponsableDropdown({ value, onChange, onSelect, camionetas, dropOpen, setDropOpen, filtro, setFiltro, dropRef }) {
  const responsablesUnicos = camionetas
    .map((c) => c.responsable)
    .filter(Boolean)
    .filter((v, i, arr) => arr.indexOf(v) === i)
    .sort();

  return (
    <Form.Group className="mb-3" ref={dropRef} style={{ position: "relative", maxWidth: "300px" }}>
      <Form.Label className="fw-semibold small text-dark mb-1">Responsable</Form.Label>
      <Form.Control
        placeholder="— Seleccionar o escribir —"
        value={dropOpen ? filtro : value}
        onChange={(e) => {
          setFiltro(e.target.value);
          onChange(e.target.value);
        }}
        onFocus={() => {
          setFiltro(value);
          setDropOpen(true);
        }}
        autoComplete="off"
        className="rounded-3"
        size="sm"
        style={{ maxWidth: "260px" }}
      />
      {dropOpen && (
        <div
          style={{
            position: "absolute",
            top: "100%",
            left: 0,
            width: "260px",
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
                  backgroundColor: value === r ? "#f1f5f9" : "transparent",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#f8fafc")}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = value === r ? "#f1f5f9" : "transparent")}
                onMouseDown={(e) => {
                  e.preventDefault();
                  onSelect(r);
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
  );
}

function ServicesKilometros() {
  const navigate = useNavigate();

  const [año, setAnio] = useState(2026);
  const [dropAño, setDropAño] = useState(false);
  const dropAñoRef = useRef(null);

  const [filtroPat, setFiltroPat] = useState("");

  const [camionetas, setCamionetas] = useState([]);
  const [registros, setRegistros] = useState([]);
  const [ultimos, setUltimos] = useState([]);
  const [ultimosService, setUltimosService] = useState([]);
  const [paradasAbiertas, setParadasAbiertas] = useState(new Set());

  const [detalleReg, setDetalleReg] = useState(null);
  const [modalMes, setModalMes] = useState(null);
  const [sinDatosEdit, setSinDatosEdit] = useState(false);

  const [showKmModal, setShowKmModal] = useState(false);
  const [sinDatosKm, setSinDatosKm] = useState(false);
  const [dropOpenKm, setDropOpenKm] = useState(false);
  const [filtroKm, setFiltroKm] = useState("");
  const dropRefKm = useRef(null);
  const kmForm = useForm({ defaultValues: { camioneta: "", fecha: "", responsable: "", kms: "", observaciones: "" } });
  const camionetaIdKm = useWatch({ control: kmForm.control, name: "camioneta" });
  const responsableKm = useWatch({ control: kmForm.control, name: "responsable" });

  const editForm = useForm({ defaultValues: { fecha: "", responsable: "", kms: "", observaciones: "" } });

  const cargarRegistros = (targetAnio = año) =>
    fetch(`/api/kilometros/anio/${targetAnio}`)
      .then((r) => (r.ok ? r.json() : []))
      .then((d) => setRegistros(Array.isArray(d) ? d : []))
      .catch(() => setRegistros([]));

  const cargarParadas = () =>
    fetch("/api/paradas/abiertas/ids")
      .then((r) => (r.ok ? r.json() : []))
      .then((ids) => setParadasAbiertas(new Set(Array.isArray(ids) ? ids : [])))
      .catch(() => setParadasAbiertas(new Set()));

  const cargarUltimos = () =>
    Promise.all([
      fetch("/api/kilometros/ultimos")
        .then((r) => (r.ok ? r.json() : []))
        .then((d) => setUltimos(Array.isArray(d) ? d : []))
        .catch(() => setUltimos([])),
      fetch("/api/services/ultimos")
        .then((r) => (r.ok ? r.json() : []))
        .then((d) => setUltimosService(Array.isArray(d) ? d : []))
        .catch(() => setUltimosService([])),
    ]);

  useEffect(() => {
    fetch("/api/camionetas")
      .then((r) => (r.ok ? r.json() : []))
      .then((d) => setCamionetas(Array.isArray(d) ? d : []))
      .catch(() => setCamionetas([]));
    cargarUltimos();
    cargarParadas();
  }, []);

  useEffect(() => {
    cargarRegistros(año);
  }, [año]);

  useEffect(() => {
    const handler = (e) => {
      if (dropRefKm.current && !dropRefKm.current.contains(e.target)) {
        setDropOpenKm(false);
        setFiltroKm("");
      }
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
      const isSinDatos = detalleReg.kms === "S/ Datos" || (typeof detalleReg.kms === "string" && isNaN(Number(detalleReg.kms)));
      setSinDatosEdit(isSinDatos);
      editForm.reset({
        fecha: detalleReg.fecha ? detalleReg.fecha.split("T")[0] : "",
        responsable: detalleReg.responsable ?? "",
        kms: isSinDatos ? "" : (detalleReg.kms ?? ""),
        observaciones: detalleReg.observaciones ?? "",
      });
    }
  }, [detalleReg]);

  const onSubmitEdit = async (data) => {
    try {
      const body = { ...data };
      if (sinDatosEdit) {
        body.kms = "S/ Datos";
      } else {
        body.kms = Number(data.kms);
      }

      const res = await fetch(`/api/kilometros/${detalleReg._id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        setDetalleReg(null);
        await Promise.all([cargarRegistros(), cargarUltimos()]);
        Swal.fire({
          icon: "success",
          title: "Registro actualizado",
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

  const eliminarKm = async () => {
    const result = await Swal.fire({
      icon: "warning",
      title: "¿Eliminar registro?",
      showCancelButton: true,
      confirmButtonText: "Sí, borrar",
      cancelButtonText: "Cancelar",
      confirmButtonColor: "#ef4444",
      cancelButtonColor: "#64748b",
      width: "300px",
    });
    if (!result.isConfirmed) return;
    try {
      const res = await fetch(`/api/kilometros/${detalleReg._id}`, { method: "DELETE" });
      if (res.ok) {
        setDetalleReg(null);
        await Promise.all([cargarRegistros(), cargarUltimos()]);
        Swal.fire({
          icon: "success",
          title: "Registro eliminado",
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
    setSinDatosKm(false);
    const c = camionetas.find((c) => c._id === camionetaId);
    const fecha = mes !== null
      ? new Date(año, mes - 1, 1).toISOString().split("T")[0]
      : new Date().toISOString().split("T")[0];
    const reg = ultimos.find((u) => getId(u.camioneta) === camionetaId.toString());
    kmForm.reset({
      camioneta: camionetaId,
      fecha,
      responsable: c?.responsable ?? "",
      kms: reg && typeof reg.kms === "number" ? reg.kms : "",
      observaciones: "",
    });
    setShowKmModal(true);
  };

  const cerrarKmModal = () => {
    setShowKmModal(false);
    setSinDatosKm(false);
    setFiltroKm("");
    setDropOpenKm(false);
  };

  const exportarExcel = async () => {
    const titulo = `Control de Kilómetros - Flota de Camionetas (${año})`;
    const columnas = ["Patente", "Vehículo", "Responsable", ...MESES_CORTOS, "Estado Service"];
    const fechaHoy = new Date().toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric" });

    const wb = await nuevoWorkbook();
    const ws = wb.addWorksheet("Kilómetros");

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
      const ultimo = ultimos.find((u) => getId(u.camioneta) === c._id.toString());
      const serv = ultimosService.find((u) => getId(u.camioneta) === c._id.toString());
      const estado = getEstado(ultimo?.kms, serv?.kms, c.patente);
      const valores = [c.patente, c.marca, c.responsable || "—"];
      MESES_CORTOS.forEach((_, mIdx) => {
        const reg = getKmMes(c._id, mIdx + 1);
        if (!reg) {
          valores.push("—");
        } else if (reg.kms === "S/ Datos" || (typeof reg.kms === "string" && isNaN(Number(reg.kms)))) {
          valores.push("S/ Datos");
        } else {
          valores.push(Number(reg.kms).toLocaleString("es-AR"));
        }
      });
      valores.push(estado?.label ?? "—");

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
    });

    ws.columns = [
      { width: 14 },
      { width: 24 },
      { width: 22 },
      ...MESES_CORTOS.map(() => ({ width: 11 })),
      { width: 18 },
    ];

    const buffer = await wb.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `kilometros_${año}.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const onSubmitKm = async (data) => {
    try {
      const body = { ...data };
      if (modalMes !== null) {
        body.mes = modalMes;
        body.anio = año;
      }
      if (sinDatosKm) {
        body.kms = "S/ Datos";
      } else {
        body.kms = Number(data.kms);
      }

      const existing = modalMes !== null ? getKmMes(body.camioneta, modalMes) : null;
      const url = existing ? `/api/kilometros/${existing._id}` : "/api/kilometros";
      const method = existing ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        cerrarKmModal();
        await Promise.all([cargarRegistros(), cargarUltimos()]);
        Swal.fire({
          icon: "success",
          title: "Kilómetros guardados",
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
        style={{ backgroundColor: "#1e293b", color: "#fff", height: "54px", position: "relative" }}
      >
        <LogoNavbar />
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
            <i className="bi bi-speedometer2"></i>
          </div>
          <div className="d-flex align-items-center gap-2">
            <span className="text-white fs-6">Control de Kilómetros</span>
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
        <div className="d-flex align-items-center justify-content-between mb-3 flex-wrap gap-2">
          {/* Selector de Año y Buscador */}
          <div className="d-flex align-items-center gap-3">
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
                value={filtroPat}
                onChange={(e) => setFiltroPat(e.target.value)}
                size="sm"
                className="rounded-3 ps-4"
                style={{ fontSize: "0.84rem", paddingRight: filtroPat ? "28px" : undefined }}
              />
              {filtroPat && (
                <button
                  onClick={() => setFiltroPat("")}
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

          {/* Botones de Acción a la Derecha */}
          <div className="d-flex align-items-center gap-2">
            <Button
              variant="dark"
              size="sm"
              onClick={() => abrirKmModal()}
              className="d-inline-flex align-items-center rounded-3 px-3 py-1.5 shadow-sm"
              style={{
                backgroundColor: "#1e293b",
                borderColor: "#1e293b",
                fontSize: "0.82rem",
                fontWeight: 500,
              }}
            >
              <span>Cargar Kilómetros</span>
            </Button>

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
              title="Exportar planilla a Excel"
            >
              <i className="bi bi-file-earmark-excel-fill"></i>
              <span>Excel</span>
            </Button>
          </div>
        </div>

        {/* Tabla de Kilómetros */}
        <div
          className="flex-grow-1 shadow-sm rounded-3 bg-white"
          style={{
            overflowY: "auto",
            overflowX: "auto",
            border: "1px solid #cbd5e1",
          }}
        >
          <Table
            hover
            size="sm"
            className="text-center align-middle mb-0"
            style={{ whiteSpace: "nowrap", fontSize: "0.82rem", width: "100%" }}
          >
            <thead style={{ position: "sticky", top: 0, zIndex: 10, backgroundColor: "#1e293b", color: "#fff" }}>
              <tr className="fw-normal align-middle">
                <th style={{ width: "40px", backgroundColor: "#1e293b", color: "#fff", padding: "8px 6px", fontWeight: "normal" }}>#</th>
                <th style={{ backgroundColor: "#1e293b", color: "#fff", padding: "8px 12px", textAlign: "left", fontWeight: "normal" }}>Patente</th>
                <th style={{ backgroundColor: "#1e293b", color: "#fff", padding: "8px 12px", fontWeight: "normal" }}>Responsable</th>
                {MESES_CORTOS.map((m) => (
                  <th key={m} style={{ backgroundColor: "#1e293b", color: "#fff", padding: "8px 6px", width: "70px", fontWeight: "normal" }}>
                    {m}
                  </th>
                ))}
                <th style={{ backgroundColor: "#1e293b", color: "#fff", padding: "8px 12px", fontWeight: "normal" }}>Estado Service</th>
              </tr>
            </thead>
            <tbody>
              {camionetas
                .filter((c) => c.patente.toLowerCase().includes(filtroPat.toLowerCase()))
                .map((c, idx) => {
                  const estaParada = paradasAbiertas.has(c._id.toString());
                  const ultimo = ultimos.find((u) => getId(u.camioneta) === c._id.toString());
                  const serv = ultimosService.find((u) => getId(u.camioneta) === c._id.toString());
                  const estado = getEstado(ultimo?.kms, serv?.kms, c.patente);
                  const isEven = idx % 2 === 0;

                  return (
                    <tr
                      key={c._id}
                      style={{
                        backgroundColor: isEven ? "#ffffff" : "#f8fafc",
                        borderBottom: "1px solid #e2e8f0",
                      }}
                    >
                      <td className="text-muted" style={{ fontSize: "0.78rem" }}>
                        {idx + 1}
                      </td>

                      {/* Patente y Marca (sin palabra parada) */}
                      <td className="text-start" style={{ padding: "6px 12px" }}>
                        <div className="d-flex align-items-center gap-2">
                          <span
                            className="badge px-2.5 py-1 text-white shadow-sm"
                            style={{
                              backgroundColor: estaParada ? "#991b1b" : "#0f172a",
                              border: "1px solid #475569",
                              fontSize: "0.82rem",
                              letterSpacing: "1.1px",
                              borderRadius: "6px",
                              fontWeight: 700,
                            }}
                          >
                            {c.patente}
                          </span>
                          <span className="text-muted small" style={{ fontSize: "0.8rem" }}>
                            {c.marca}
                          </span>
                        </div>
                      </td>

                      {/* Responsable */}
                      <td style={{ color: "#334155", fontSize: "0.82rem" }}>{c.responsable || "—"}</td>

                      {/* Meses Ene - Dic */}
                      {MESES_CORTOS.map((_, mIdx) => {
                        const mes = mIdx + 1;
                        const reg = getKmMes(c._id, mes);
                        const isSinDatos = reg && (reg.kms === "S/ Datos" || (typeof reg.kms === "string" && isNaN(Number(reg.kms))));

                        return (
                          <td key={mIdx} style={{ padding: "4px 6px" }}>
                            {reg ? (
                              <button
                                onClick={() => setDetalleReg(reg)}
                                className="btn btn-sm py-0.5 px-1.5 fw-semibold"
                                style={{
                                  background: "transparent",
                                  border: "1px solid transparent",
                                  fontSize: isSinDatos ? "0.76rem" : "0.84rem",
                                  color: isSinDatos ? "#64748b" : "#0f172a",
                                  fontStyle: isSinDatos ? "italic" : "normal",
                                  borderRadius: "4px",
                                  transition: "all 0.15s ease",
                                }}
                                onMouseEnter={(e) => {
                                  e.currentTarget.style.backgroundColor = "#e2e8f0";
                                  e.currentTarget.style.borderColor = "#cbd5e1";
                                }}
                                onMouseLeave={(e) => {
                                  e.currentTarget.style.backgroundColor = "transparent";
                                  e.currentTarget.style.borderColor = "transparent";
                                }}
                                title="Clic para editar odómetro"
                              >
                                {isSinDatos ? "S/ Datos" : Number(reg.kms).toLocaleString("es-AR")}
                              </button>
                            ) : esMesFuturo(mes) ? (
                              <span style={{ color: "#cbd5e1", fontSize: "0.85rem" }}>—</span>
                            ) : (
                              <button
                                onClick={() => abrirKmModal(c._id, mes)}
                                className="btn btn-sm p-0 rounded-circle d-inline-flex align-items-center justify-content-center"
                                style={{
                                  width: "22px",
                                  height: "22px",
                                  backgroundColor: "#cbd5e1",
                                  border: "1px solid #94a3b8",
                                  color: "#1e293b",
                                  fontSize: "0.78rem",
                                  fontWeight: "700",
                                  transition: "all 0.15s ease",
                                }}
                                onMouseEnter={(e) => {
                                  e.currentTarget.style.backgroundColor = "#1e293b";
                                  e.currentTarget.style.borderColor = "#1e293b";
                                  e.currentTarget.style.color = "#fff";
                                  e.currentTarget.style.transform = "scale(1.15)";
                                }}
                                onMouseLeave={(e) => {
                                  e.currentTarget.style.backgroundColor = "#cbd5e1";
                                  e.currentTarget.style.borderColor = "#94a3b8";
                                  e.currentTarget.style.color = "#1e293b";
                                  e.currentTarget.style.transform = "scale(1)";
                                }}
                                title="Cargar km de este mes"
                              >
                                <i className="bi bi-plus"></i>
                              </button>
                            )}
                          </td>
                        );
                      })}

                      {/* Estado del Service */}
                      <td style={{ padding: "6px 12px" }}>
                        {estado ? (
                          <button
                            onClick={() => navigate("/camionetas/services/ultimo-service")}
                            className="badge py-1.5 px-3 border-0 shadow-sm"
                            style={{
                              backgroundColor: estado.bg,
                              color: estado.color,
                              fontSize: "0.76rem",
                              fontWeight: 600,
                              borderRadius: "6px",
                              cursor: "pointer",
                              transition: "transform 0.15s ease, box-shadow 0.15s ease",
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.transform = "scale(1.05)";
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.transform = "scale(1)";
                            }}
                          >
                            {estado.label}
                          </button>
                        ) : (
                          <span className="text-muted">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              {camionetas.filter((c) => c.patente.toLowerCase().includes(filtroPat.toLowerCase())).length === 0 && (
                <tr>
                  <td colSpan={16} className="text-muted py-4">
                    {filtroPat ? `Sin resultados para "${filtroPat}"` : "Sin camionetas registradas"}
                  </td>
                </tr>
              )}
            </tbody>
          </Table>
        </div>
      </Container>

      {/* Modal Editar Km */}
      <Modal show={!!detalleReg} onHide={() => setDetalleReg(null)} centered contentClassName="border rounded-4 shadow">
        <Modal.Header closeButton style={{ backgroundColor: "#1e293b", color: "#fff", borderTopLeftRadius: "15px", borderTopRightRadius: "15px", padding: "12px 18px" }}>
          <div>
            <Modal.Title className="fs-6 fw-bold mb-0">Editar Kilómetros</Modal.Title>
            {detalleReg && (() => {
              const cam = camionetas.find((c) => c._id === getId(detalleReg.camioneta));
              const mesNombre = detalleReg.mes ? MESES_CORTOS[detalleReg.mes - 1] : null;
              return (
                <div style={{ fontSize: "0.78rem", color: "#cbd5e1", marginTop: "2px" }}>
                  {cam ? `${cam.patente} — ${cam.marca}` : ""}
                  {mesNombre ? ` • ${mesNombre} ${detalleReg.anio ?? ""}` : ""}
                </div>
              );
            })()}
          </div>
        </Modal.Header>
        <Modal.Body className="p-3 bg-white">
          {detalleReg && (
            <Form onSubmit={editForm.handleSubmit(onSubmitEdit)}>
              <Form.Group className="mb-2.5" style={{ maxWidth: "280px" }}>
                <Form.Label className="fw-semibold small text-dark mb-1">Fecha de Lectura</Form.Label>
                <Form.Control
                  type="date"
                  size="sm"
                  className="rounded-3"
                  style={{ maxWidth: "220px" }}
                  {...editForm.register("fecha", { required: "Requerido" })}
                  isInvalid={!!editForm.formState.errors.fecha}
                />
                <Form.Control.Feedback type="invalid">{editForm.formState.errors.fecha?.message}</Form.Control.Feedback>
              </Form.Group>

              {/* Odómetro o S/ Datos */}
              <Form.Group className="mb-2.5" style={{ maxWidth: "280px" }}>
                <div className="d-flex justify-content-between align-items-center mb-1">
                  <Form.Label className="fw-semibold small text-dark mb-0">Odómetro (Km)</Form.Label>
                  <button
                    type="button"
                    onClick={() => setSinDatosEdit(!sinDatosEdit)}
                    className={`btn btn-sm py-0 px-2 rounded-pill ${sinDatosEdit ? "btn-dark text-white" : "btn-outline-secondary"}`}
                    style={{ fontSize: "0.72rem" }}
                  >
                    {sinDatosEdit ? "✓ S/ Datos" : "Marcar S/ Datos"}
                  </button>
                </div>
                {sinDatosEdit ? (
                  <div
                    className="form-control form-control-sm rounded-3 bg-light text-muted fw-semibold d-flex align-items-center"
                    style={{ maxWidth: "220px", height: "31px", fontSize: "0.82rem" }}
                  >
                    S/ Datos
                  </div>
                ) : (
                  <Form.Control
                    type="number"
                    size="sm"
                    className="rounded-3"
                    style={{ maxWidth: "220px" }}
                    {...editForm.register("kms", {
                      required: sinDatosEdit ? false : "Requerido",
                      min: { value: 0, message: "Debe ser positivo" },
                    })}
                    isInvalid={!sinDatosEdit && !!editForm.formState.errors.kms}
                  />
                )}
                {!sinDatosEdit && (
                  <Form.Control.Feedback type="invalid">{editForm.formState.errors.kms?.message}</Form.Control.Feedback>
                )}
              </Form.Group>

              <Form.Group className="mb-2.5" style={{ maxWidth: "280px" }}>
                <Form.Label className="fw-semibold small text-dark mb-1">Responsable</Form.Label>
                <Form.Control type="text" size="sm" className="rounded-3" style={{ maxWidth: "240px" }} {...editForm.register("responsable")} />
              </Form.Group>

              <Form.Group className="mb-3" style={{ maxWidth: "320px" }}>
                <Form.Label className="fw-semibold small text-dark mb-1">Observaciones</Form.Label>
                <Form.Control as="textarea" rows={2} size="sm" className="rounded-3" placeholder="Opcional..." {...editForm.register("observaciones")} />
              </Form.Group>

              <div className="d-flex justify-content-between align-items-center pt-2 border-top">
                <Button
                  type="button"
                  variant="outline-danger"
                  size="sm"
                  onClick={eliminarKm}
                  className="rounded-3 px-2.5 py-1"
                  style={{ fontSize: "0.8rem" }}
                >
                  <i className="bi bi-trash me-1"></i>Eliminar
                </Button>
                <div className="d-flex gap-2">
                  <Button variant="outline-secondary" size="sm" onClick={() => setDetalleReg(null)} className="rounded-3 px-3 py-1" style={{ fontSize: "0.8rem" }}>
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
          )}
        </Modal.Body>
      </Modal>

      {/* Modal Cargar Km */}
      <Modal show={showKmModal} onHide={cerrarKmModal} centered contentClassName="border rounded-4 shadow">
        <Modal.Header closeButton style={{ backgroundColor: "#1e293b", color: "#fff", borderTopLeftRadius: "15px", borderTopRightRadius: "15px", padding: "12px 18px" }}>
          <Modal.Title className="fs-6 fw-bold mb-0">Cargar Kilómetros</Modal.Title>
        </Modal.Header>
        <Modal.Body className="p-3 bg-white">
          <Form onSubmit={kmForm.handleSubmit(onSubmitKm)}>
            <Form.Group className="mb-2.5" style={{ maxWidth: "280px" }}>
              <Form.Label className="fw-semibold small text-dark mb-1">Fecha</Form.Label>
              <Form.Control
                type="date"
                size="sm"
                className="rounded-3"
                style={{ maxWidth: "220px" }}
                {...kmForm.register("fecha", { required: "Requerido" })}
                isInvalid={!!kmForm.formState.errors.fecha}
              />
              <Form.Control.Feedback type="invalid">{kmForm.formState.errors.fecha?.message}</Form.Control.Feedback>
            </Form.Group>

            <Form.Group className="mb-2.5" style={{ maxWidth: "300px" }}>
              <Form.Label className="fw-semibold small text-dark mb-1">Camioneta</Form.Label>
              <Form.Select
                size="sm"
                className="rounded-3"
                style={{ maxWidth: "260px" }}
                {...kmForm.register("camioneta", { required: "Seleccioná una camioneta" })}
                isInvalid={!!kmForm.formState.errors.camioneta}
              >
                <option value="">— Seleccionar —</option>
                {camionetas.map((c) => (
                  <option key={c._id} value={c._id}>
                    {c.patente} — {c.marca} {c.responsable ? `(${c.responsable})` : ""}
                  </option>
                ))}
              </Form.Select>
              <Form.Control.Feedback type="invalid">{kmForm.formState.errors.camioneta?.message}</Form.Control.Feedback>
            </Form.Group>

            <ResponsableDropdown
              value={responsableKm}
              onChange={(v) => kmForm.setValue("responsable", v)}
              onSelect={(v) => kmForm.setValue("responsable", v)}
              camionetas={camionetas}
              dropOpen={dropOpenKm}
              setDropOpen={setDropOpenKm}
              filtro={filtroKm}
              setFiltro={setFiltroKm}
              dropRef={dropRefKm}
            />

            {/* Odómetro o S/ Datos */}
            <Form.Group className="mb-2.5" style={{ maxWidth: "280px" }}>
              <div className="d-flex justify-content-between align-items-center mb-1">
                <Form.Label className="fw-semibold small text-dark mb-0">Odómetro (Km)</Form.Label>
                <button
                  type="button"
                  onClick={() => setSinDatosKm(!sinDatosKm)}
                  className={`btn btn-sm py-0 px-2 rounded-pill ${sinDatosKm ? "btn-dark text-white" : "btn-outline-secondary"}`}
                  style={{ fontSize: "0.72rem" }}
                >
                  {sinDatosKm ? "✓ S/ Datos" : "Marcar S/ Datos"}
                </button>
              </div>
              {sinDatosKm ? (
                <div
                  className="form-control form-control-sm rounded-3 bg-light text-muted fw-semibold d-flex align-items-center"
                  style={{ maxWidth: "220px", height: "31px", fontSize: "0.82rem" }}
                >
                  S/ Datos
                </div>
              ) : (
                <Form.Control
                  type="number"
                  size="sm"
                  className="rounded-3"
                  style={{ maxWidth: "220px" }}
                  {...kmForm.register("kms", {
                    required: sinDatosKm ? false : "Requerido",
                    min: { value: 0, message: "Debe ser positivo" },
                  })}
                  isInvalid={!sinDatosKm && !!kmForm.formState.errors.kms}
                />
              )}
              {!sinDatosKm && (
                <Form.Control.Feedback type="invalid">{kmForm.formState.errors.kms?.message}</Form.Control.Feedback>
              )}
            </Form.Group>

            <Form.Group className="mb-3" style={{ maxWidth: "320px" }}>
              <Form.Label className="fw-semibold small text-dark mb-1">Observaciones</Form.Label>
              <Form.Control as="textarea" rows={2} size="sm" className="rounded-3" placeholder="Opcional..." {...kmForm.register("observaciones")} />
            </Form.Group>

            <div className="d-flex justify-content-end gap-2 pt-2 border-top">
              <Button variant="outline-secondary" size="sm" onClick={cerrarKmModal} className="rounded-3 px-3 py-1" style={{ fontSize: "0.8rem" }}>
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
          </Form>
        </Modal.Body>
      </Modal>
    </div>
  );
}

export default ServicesKilometros;
