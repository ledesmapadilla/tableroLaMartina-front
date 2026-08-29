import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useForm, useWatch } from "react-hook-form";
import { Button, Modal, Form, Table, Container } from "react-bootstrap";
import Swal from "sweetalert2";
import { nuevoWorkbook } from "../../helpers/excel";
import LogoNavbar from "../shared/LogoNavbar";

const AÑOS = Array.from({ length: 6 }, (_, i) => 2026 + i);

const formatFecha = (iso) => {
  if (!iso) return "—";
  if (typeof iso === "string" && iso.includes("-")) {
    const parts = iso.split("T")[0].split("-");
    if (parts.length === 3) {
      return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
  }
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric" });
};

const formatKm = (valor) =>
  typeof valor === "number" && !isNaN(valor) ? `${valor.toLocaleString("es-AR")} km` : "—";

// Intervalo estandar de mantenimiento para colectivos (en kilometros)
const DEFAULT_INTERVALO_KM = 10000;

// El aviso de "Proximo" arranca al ultimo 20% del intervalo, igual que en
// tractores (50 hs sobre 250), pero proporcional para que sirva con cualquiera.
const MARGEN_AVISO = 0.2;

// De donde se tomo la lectura vigente de kilometraje.
const ORIGEN_LECTURA = {
  manual: "carga manual",
  service: "service",
};

function getEstadoColectivo(kmActuales, kmUltimoService, intervalo = DEFAULT_INTERVALO_KM) {
  if (typeof kmUltimoService !== "number" || isNaN(kmUltimoService)) {
    return {
      label: "Sin service",
      bg: "#f1f5f9",
      color: "#64748b",
    };
  }

  if (typeof kmActuales !== "number" || isNaN(kmActuales)) {
    return {
      label: "Al día",
      bg: "#dcfce7",
      color: "#166534",
    };
  }

  const kmProxService = kmUltimoService + intervalo;
  const diferencia = kmProxService - kmActuales;

  if (diferencia <= 0) {
    return {
      label: "Atrasado",
      bg: "#fee2e2",
      color: "#991b1b",
    };
  }

  if (diferencia <= intervalo * MARGEN_AVISO) {
    return {
      label: "Próximo",
      bg: "#fef3c7",
      color: "#92400e",
    };
  }

  return {
    label: "Al día",
    bg: "#dcfce7",
    color: "#166534",
  };
}

function ColectivosPreventivo() {
  const navigate = useNavigate();
  const [colectivos, setColectivos] = useState([]);
  const [ultimosServices, setUltimosServices] = useState([]);
  const [ultimosKilometrajes, setUltimosKilometrajes] = useState({});
  const [loading, setLoading] = useState(true);

  const [año, setAnio] = useState(2026);
  const [dropAño, setDropAño] = useState(false);
  const dropAñoRef = useRef(null);

  const [filtroBusqueda, setFiltroBusqueda] = useState("");
  const [filtroEstado, setFiltroEstado] = useState("TODOS");

  // Modal Cargar Service
  const [showModal, setShowModal] = useState(false);
  const [colectivoModalPreseleccionado, setColectivoModalPreseleccionado] = useState(null);
  const [servicioEditandoId, setServicioEditandoId] = useState(null);

  // Modal Cargar Kilometraje actual
  const [showModalKm, setShowModalKm] = useState(false);
  const [colectivoModalKm, setColectivoModalKm] = useState(null);
  const [kilometroEditandoId, setKilometroEditandoId] = useState(null);
  const [kmActualReferencia, setKmActualReferencia] = useState(null);

  // Modal Observaciones
  const [obsModalText, setObsModalText] = useState(null);
  const [guardandoObs, setGuardandoObs] = useState(false);

  // Modal Historial
  const [historialModal, setHistorialModal] = useState(null);
  const [historialServices, setHistorialServices] = useState([]);
  const [historialKilometros, setHistorialKilometros] = useState([]);
  const [cargandoHistorial, setCargandoHistorial] = useState(false);

  const {
    register,
    handleSubmit,
    setValue,
    reset,
    control,
    formState: { errors },
  } = useForm({
    defaultValues: {
      colectivo: "",
      fecha: new Date().toISOString().split("T")[0],
      responsable: "",
      kilometraje: "",
      intervalo: DEFAULT_INTERVALO_KM,
      observaciones: "",
    },
  });

  const {
    register: registerKm,
    handleSubmit: handleSubmitKm,
    reset: resetKm,
    formState: { errors: errorsKm },
  } = useForm({
    defaultValues: {
      colectivo: "",
      fecha: new Date().toISOString().split("T")[0],
      kilometraje: "",
      observaciones: "",
    },
  });

  const colectivoSeleccionadoId = useWatch({ control, name: "colectivo" });

  const cargarColectivos = () =>
    fetch("/api/colectivos")
      .then((r) => (r.ok ? r.json() : []))
      .then((d) => setColectivos(Array.isArray(d) ? d : []))
      .catch(() => setColectivos([]));

  const cargarTabla = (anio) =>
    Promise.all([
      fetch(`/api/services-colectivo/ultimos/${anio}`)
        .then((r) => (r.ok ? r.json() : []))
        .then((d) => setUltimosServices(Array.isArray(d) ? d : []))
        .catch(() => setUltimosServices([])),
      fetch("/api/services-colectivo/ultimos-kilometrajes")
        .then((r) => (r.ok ? r.json() : {}))
        .then((d) => setUltimosKilometrajes(d || {}))
        .catch(() => setUltimosKilometrajes({})),
    ]);

  useEffect(() => {
    setLoading(true);
    Promise.all([cargarColectivos(), cargarTabla(año)]).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    cargarTabla(año);
  }, [año]);

  useEffect(() => {
    const handler = (e) => {
      if (dropAñoRef.current && !dropAñoRef.current.contains(e.target)) setDropAño(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  useEffect(() => {
    // Al editar se respeta el responsable que quedo guardado en el registro.
    if (servicioEditandoId) return;
    const c = colectivos.find((c) => c._id === colectivoSeleccionadoId);
    if (c?.supervisor) {
      setValue("responsable", c.supervisor);
    }
  }, [colectivoSeleccionadoId, colectivos, setValue, servicioEditandoId]);

  // El mapa de kilometrajes se indexa por cc con y sin el prefijo "CC ".
  const getKmObj = (colectivo) => {
    if (!colectivo?.cc) return null;
    const cleanCC = String(colectivo.cc).replace(/^cc\s*/i, "").trim();
    return ultimosKilometrajes[colectivo.cc] || ultimosKilometrajes[cleanCC] || null;
  };

  const getServicio = (colectivoId) =>
    ultimosServices.find((u) => u.colectivo?._id === colectivoId || u.colectivo === colectivoId);

  const abrirModalService = (colectivoId = "") => {
    const c = colectivos.find((c) => c._id === colectivoId);
    const reg = getServicio(colectivoId);
    const kmObj = getKmObj(c);

    setServicioEditandoId(null);
    setColectivoModalPreseleccionado(c || null);
    reset({
      colectivo: colectivoId || "",
      fecha: new Date().toISOString().split("T")[0],
      responsable: c?.supervisor || "",
      kilometraje: reg?.kilometraje ?? kmObj?.kilometraje ?? "",
      intervalo: reg?.intervalo ?? DEFAULT_INTERVALO_KM,
      observaciones: "",
    });
    setShowModal(true);
  };

  const cerrarModalService = () => {
    setShowModal(false);
    setColectivoModalPreseleccionado(null);
    setServicioEditandoId(null);
  };

  const onSubmitService = async (data) => {
    const editando = Boolean(servicioEditandoId);
    try {
      const res = await fetch(
        editando ? `/api/services-colectivo/${servicioEditandoId}` : "/api/services-colectivo",
        {
          method: editando ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        }
      );
      if (res.ok) {
        const colectivoHistorial = historialModal;
        cerrarModalService();
        await cargarTabla(año);
        // Si la edicion salio del historial, refrescarlo antes de mostrarlo.
        if (colectivoHistorial) await abrirHistorial(colectivoHistorial);
        Swal.fire({
          icon: "success",
          title: editando ? "Service actualizado" : "Service guardado",
          text: editando
            ? "Los cambios del service fueron guardados exitosamente."
            : "El registro de service fue guardado exitosamente.",
          timer: 1500,
          showConfirmButton: false,
          width: "320px",
        });
      } else {
        const err = await res.json();
        Swal.fire({ icon: "error", title: "Error", text: err.error || "No se pudo guardar", width: "320px" });
      }
    } catch {
      Swal.fire({ icon: "error", title: "Sin conexión", text: "No se pudo conectar con el servidor", width: "320px" });
    }
  };

  const abrirModalKilometraje = (colectivo) => {
    const kmObj = getKmObj(colectivo);

    setKilometroEditandoId(null);
    setColectivoModalKm(colectivo || null);
    setKmActualReferencia(kmObj || null);
    resetKm({
      colectivo: colectivo?._id || "",
      fecha: new Date().toISOString().split("T")[0],
      kilometraje: "",
      observaciones: "",
    });
    setShowModalKm(true);
  };

  const cerrarModalKilometraje = () => {
    setShowModalKm(false);
    setColectivoModalKm(null);
    setKmActualReferencia(null);
    setKilometroEditandoId(null);
  };

  const editarKilometrajeHistorial = (k) => {
    const colectivoId = (k.colectivo?._id || k.colectivo || historialModal?._id || "").toString();
    const c = colectivos.find((x) => x._id === colectivoId) || historialModal;

    setKilometroEditandoId(k._id);
    setColectivoModalKm(c || null);
    setKmActualReferencia(null);
    resetKm({
      colectivo: colectivoId,
      fecha: k.fecha ? String(k.fecha).split("T")[0] : new Date().toISOString().split("T")[0],
      kilometraje: k.kilometraje ?? "",
      observaciones: k.observaciones || "",
    });
    setShowModalKm(true);
  };

  const eliminarKilometrajeHistorial = async (kilometroId) => {
    const result = await Swal.fire({
      title: "¿Eliminar lectura de kilometraje?",
      text: "Esta acción no se puede deshacer.",
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#dc2626",
      cancelButtonColor: "#64748b",
      confirmButtonText: "Sí, eliminar",
      cancelButtonText: "Cancelar",
    });
    if (!result.isConfirmed) return;

    try {
      const res = await fetch(`/api/kilometros-colectivo/${kilometroId}`, { method: "DELETE" });
      if (res.ok) {
        if (historialModal) await abrirHistorial(historialModal);
        await cargarTabla(año);
        Swal.fire({
          icon: "success",
          title: "Eliminada",
          text: "La lectura de kilometraje fue eliminada.",
          timer: 1300,
          showConfirmButton: false,
        });
      }
    } catch {
      Swal.fire({ icon: "error", title: "Error", text: "No se pudo eliminar" });
    }
  };

  const onSubmitKilometraje = async (data) => {
    const editando = Boolean(kilometroEditandoId);

    // Bajar el odometro es legitimo (corregir una carga erronea) pero nunca
    // deberia pasar por descuido: se avisa y decide el usuario.
    const nuevo = Number(data.kilometraje);
    const kmObj = getKmObj(colectivoModalKm);
    const actual = kmObj?.kilometraje;

    if (Number.isFinite(nuevo) && typeof actual === "number" && nuevo < actual) {
      // La correccion hacia abajo solo pisa a la tabla si la carga manual es al
      // menos tan reciente como la lectura vigente. Si no, la tabla no cambia y
      // conviene decirlo en vez de prometer algo que no va a pasar.
      const pisaLaTabla = String(data.fecha || "") >= String(kmObj?.fecha || "");
      const confirmacion = await Swal.fire({
        icon: "warning",
        title: "El kilometraje es menor al registrado",
        html:
          `La última lectura de <b>CC ${colectivoModalKm?.cc ?? "—"}</b> es de ` +
          `<b>${actual.toLocaleString("es-AR")} km</b>` +
          `${kmObj?.fecha ? ` (${formatFecha(kmObj.fecha)})` : ""}` +
          ` y estás cargando <b>${nuevo.toLocaleString("es-AR")} km</b>.<br/><br/>` +
          (pisaLaTabla
            ? "Si continuás, la tabla va a pasar a mostrar el valor nuevo."
            : "Como la fecha que cargás es anterior, la lectura queda en el historial pero la tabla va a seguir mostrando la más reciente."),
        showCancelButton: true,
        confirmButtonText: "Continuar igual",
        cancelButtonText: "Corregir",
        confirmButtonColor: "#dc2626",
        cancelButtonColor: "#64748b",
        reverseButtons: true,
        width: "440px",
      });
      if (!confirmacion.isConfirmed) return;
    }

    try {
      const res = await fetch(
        editando ? `/api/kilometros-colectivo/${kilometroEditandoId}` : "/api/kilometros-colectivo",
        {
          method: editando ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        }
      );
      if (res.ok) {
        const colectivoHistorial = historialModal;
        cerrarModalKilometraje();
        await cargarTabla(año);
        if (colectivoHistorial) await abrirHistorial(colectivoHistorial);
        Swal.fire({
          icon: "success",
          title: editando ? "Kilometraje actualizado" : "Kilometraje cargado",
          text: editando
            ? "Los cambios de la lectura fueron guardados exitosamente."
            : "La lectura de kilometraje fue registrada exitosamente.",
          timer: 1500,
          showConfirmButton: false,
          width: "320px",
        });
      } else {
        const err = await res.json();
        Swal.fire({ icon: "error", title: "Error", text: err.error || "No se pudo guardar", width: "320px" });
      }
    } catch {
      Swal.fire({ icon: "error", title: "Sin conexión", text: "No se pudo conectar con el servidor", width: "320px" });
    }
  };

  const guardarObservacion = async () => {
    if (!obsModalText) return;
    setGuardandoObs(true);
    try {
      const esEdicion = Boolean(obsModalText.serviceId);
      const res = await fetch(
        esEdicion ? `/api/services-colectivo/${obsModalText.serviceId}` : "/api/services-colectivo",
        {
          method: esEdicion ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(
            esEdicion
              ? { observaciones: obsModalText.texto }
              : {
                  colectivo: obsModalText.colectivoId,
                  fecha: new Date().toISOString().split("T")[0],
                  kilometraje: 0,
                  observaciones: obsModalText.texto,
                }
          ),
        }
      );
      if (res.ok) {
        setObsModalText(null);
        await cargarTabla(año);
        Swal.fire({
          icon: "success",
          title: "Observación guardada",
          timer: 1300,
          showConfirmButton: false,
          width: "300px",
        });
      } else {
        Swal.fire({ icon: "error", title: "Error", text: "No se pudo guardar", width: "300px" });
      }
    } catch {
      Swal.fire({ icon: "error", title: "Sin conexión", text: "No se pudo conectar", width: "300px" });
    } finally {
      setGuardandoObs(false);
    }
  };

  const abrirHistorial = async (colectivo) => {
    setHistorialModal(colectivo);
    setCargandoHistorial(true);
    try {
      const [resSrv, resKm] = await Promise.all([
        fetch(`/api/services-colectivo/historial/${colectivo._id}`),
        fetch(`/api/kilometros-colectivo/historial/${colectivo._id}`),
      ]);
      const srv = resSrv.ok ? await resSrv.json() : [];
      const km = resKm.ok ? await resKm.json() : [];
      setHistorialServices(Array.isArray(srv) ? srv : []);
      setHistorialKilometros(Array.isArray(km) ? km : []);
    } catch {
      setHistorialServices([]);
      setHistorialKilometros([]);
    } finally {
      setCargandoHistorial(false);
    }
  };

  const editarServiceHistorial = (s) => {
    const colectivoId = (s.colectivo?._id || s.colectivo || historialModal?._id || "").toString();
    const c = colectivos.find((x) => x._id === colectivoId) || historialModal;

    setServicioEditandoId(s._id);
    setColectivoModalPreseleccionado(c || null);
    reset({
      colectivo: colectivoId,
      fecha: s.fecha ? String(s.fecha).split("T")[0] : new Date().toISOString().split("T")[0],
      responsable: s.responsable || c?.supervisor || "",
      kilometraje: s.kilometraje ?? "",
      intervalo: s.intervalo ?? DEFAULT_INTERVALO_KM,
      observaciones: s.observaciones || "",
    });
    setShowModal(true);
  };

  const eliminarServiceHistorial = async (serviceId) => {
    const result = await Swal.fire({
      title: "¿Eliminar service?",
      text: "Esta acción no se puede deshacer.",
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#dc2626",
      cancelButtonColor: "#64748b",
      confirmButtonText: "Sí, eliminar",
      cancelButtonText: "Cancelar",
    });
    if (!result.isConfirmed) return;

    try {
      const res = await fetch(`/api/services-colectivo/${serviceId}`, { method: "DELETE" });
      if (res.ok) {
        if (historialModal) {
          abrirHistorial(historialModal);
        }
        await cargarTabla(año);
        Swal.fire({
          icon: "success",
          title: "Eliminado",
          text: "El registro de service fue eliminado.",
          timer: 1300,
          showConfirmButton: false,
        });
      }
    } catch {
      Swal.fire({ icon: "error", title: "Error", text: "No se pudo eliminar" });
    }
  };

  const colectivosFiltrados = colectivos.filter((c) => {
    const q = filtroBusqueda.toLowerCase();
    const matchBusqueda =
      (c.cc || "").toLowerCase().includes(q) ||
      (c.patente || "").toLowerCase().includes(q) ||
      (c.descripcion || "").toLowerCase().includes(q) ||
      (c.supervisor || "").toLowerCase().includes(q);

    if (!matchBusqueda) return false;
    if (filtroEstado === "TODOS") return true;

    const reg = getServicio(c._id);
    const kmObj = getKmObj(c);
    const kmUltimoService = typeof reg?.kilometraje === "number" ? reg.kilometraje : null;
    const estado = getEstadoColectivo(
      kmObj?.kilometraje,
      kmUltimoService,
      reg?.intervalo || DEFAULT_INTERVALO_KM
    );
    return estado.label === filtroEstado;
  });

  // Datos derivados de una fila: los usan la tabla y la exportacion a Excel.
  const filaDeColectivo = (c) => {
    const reg = getServicio(c._id);
    const kmObj = getKmObj(c);
    const kmActuales = kmObj?.kilometraje;
    const fechaKmActual = kmObj?.fecha;
    const kmUltimoService = typeof reg?.kilometraje === "number" ? reg.kilometraje : null;
    const intervalo = reg?.intervalo || DEFAULT_INTERVALO_KM;
    const kmProxService = kmUltimoService !== null ? kmUltimoService + intervalo : null;
    const estado = getEstadoColectivo(kmActuales, kmUltimoService, intervalo);
    return { reg, kmActuales, fechaKmActual, kmUltimoService, intervalo, kmProxService, estado };
  };

  const exportarExcel = async () => {
    const titulo = `Control de Último Service - Flota de Colectivos (${año})`;
    const columnas = [
      "#",
      "CC",
      "Patente",
      "Descripción",
      "Supervisor",
      "Fecha",
      "Kilometraje",
      "Fecha Service",
      "Km Service",
      "Km Próx. Service",
      "Observaciones",
      "Estado",
    ];
    const fechaHoy = new Date().toLocaleDateString("es-AR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });

    const wb = await nuevoWorkbook();
    const ws = wb.addWorksheet("Último Service Colectivos");

    ws.mergeCells(1, 1, 1, columnas.length);
    const celdaTitulo = ws.getCell("A1");
    celdaTitulo.value = titulo;
    celdaTitulo.font = { bold: true, size: 14, color: { argb: "FF1E293B" } };
    celdaTitulo.alignment = { horizontal: "center", vertical: "middle" };
    ws.getRow(1).height = 28;

    ws.mergeCells(2, 1, 2, 4);
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

    colectivosFiltrados.forEach((c, idx) => {
      const { reg, kmActuales, fechaKmActual, kmUltimoService, kmProxService, estado } =
        filaDeColectivo(c);

      const fila = ws.addRow([
        idx + 1,
        c.cc,
        c.patente || "—",
        c.descripcion || "—",
        c.supervisor || "—",
        fechaKmActual ? formatFecha(fechaKmActual) : "—",
        formatKm(kmActuales),
        reg ? formatFecha(reg.fecha) : "—",
        formatKm(kmUltimoService),
        formatKm(kmProxService),
        reg?.observaciones || "—",
        estado.label,
      ]);
      fila.height = 20;

      const isOdd = idx % 2 === 1;
      const zebraBg = isOdd ? { type: "pattern", pattern: "solid", fgColor: { argb: "FFF8FAFC" } } : undefined;

      fila.eachCell({ includeEmpty: true }, (cell) => {
        cell.alignment = { horizontal: "center", vertical: "middle" };
        cell.border = thinBorder;
        if (estado.label === "Atrasado") {
          cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFEE2E2" } };
        } else if (zebraBg) {
          cell.fill = zebraBg;
        }
      });
      fila.getCell(2).font = { bold: true };
      fila.getCell(4).alignment = { horizontal: "left", vertical: "middle" };
      fila.getCell(5).alignment = { horizontal: "left", vertical: "middle" };
      fila.getCell(11).alignment = { horizontal: "left", vertical: "middle" };
    });

    ws.columns = [
      { width: 6 },
      { width: 12 },
      { width: 14 },
      { width: 24 },
      { width: 22 },
      { width: 15 },
      { width: 16 },
      { width: 15 },
      { width: 16 },
      { width: 18 },
      { width: 28 },
      { width: 16 },
    ];

    const buffer = await wb.xlsx.writeBuffer();
    const blob = new Blob([buffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `ultimo_service_colectivos_${año}.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const totalColectivos = colectivos.length;

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
              backgroundColor: "#047857",
              color: "#fff",
              fontSize: "1.15rem",
              boxShadow: "0 2px 8px rgba(4, 120, 87, 0.3)",
            }}
          >
            <i className="bi bi-bus-front-fill" style={{ fontSize: "1.15rem" }}></i>
          </div>
          <div className="d-flex align-items-center gap-2">
            <span className="text-white fs-6 fw-semibold">Colectivos — Control de Último Service</span>
            <span className="text-light opacity-75 small">• {totalColectivos} Unidades</span>
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
            onClick={() => navigate("/colectivo/reparaciones")}
            className="btn btn-sm btn-outline-light d-flex align-items-center gap-1.5 rounded-3 px-3 py-1"
            style={{ fontSize: "0.82rem" }}
          >
            <i className="bi bi-tools"></i>
            <span>Reparaciones</span>
          </button>
          <button
            onClick={() => navigate("/colectivo")}
            className="btn btn-sm btn-outline-light d-flex align-items-center gap-2 rounded-3 px-3 py-1"
            style={{ fontSize: "0.82rem" }}
          >
            <i className="bi bi-bus-front-fill"></i>
            <span>Colectivos</span>
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
        {/* Barra de Filtros, Buscador y Acciones */}
        <div
          className="d-flex align-items-center justify-content-between mb-3 flex-wrap gap-3"
          style={{ maxWidth: "1180px", width: "100%", margin: "0 auto" }}
        >
          <div className="d-flex align-items-center gap-3 flex-wrap">
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

            {/* Buscador por CC o Patente */}
            <div style={{ position: "relative", width: "220px" }}>
              <i
                className="bi bi-search text-muted"
                style={{
                  position: "absolute",
                  left: "10px",
                  top: "50%",
                  transform: "translateY(-50%)",
                  fontSize: "0.82rem",
                }}
              ></i>
              <Form.Control
                type="text"
                placeholder="Buscar CC o patente..."
                value={filtroBusqueda}
                onChange={(e) => setFiltroBusqueda(e.target.value)}
                size="sm"
                className="rounded-3 ps-4"
                style={{ fontSize: "0.84rem", paddingRight: filtroBusqueda ? "28px" : undefined }}
              />
              {filtroBusqueda && (
                <button
                  onClick={() => setFiltroBusqueda("")}
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

            {/* Filtro por Estado */}
            <Form.Select
              size="sm"
              value={filtroEstado}
              onChange={(e) => setFiltroEstado(e.target.value)}
              className="rounded-3 shadow-sm"
              style={{ width: "175px", fontSize: "0.84rem", borderColor: "#cbd5e1" }}
            >
              <option value="TODOS">Todos los Estados</option>
              <option value="Atrasado">Atrasados</option>
              <option value="Próximo">Próximos</option>
              <option value="Al día">Al día</option>
              <option value="Sin service">Sin service</option>
            </Form.Select>
          </div>

          {/* Botón Excel a la derecha */}
          <div>
            <Button
              variant="success"
              size="sm"
              onClick={exportarExcel}
              className="d-inline-flex align-items-center gap-1.5 rounded-3 px-3.5 py-1.5 shadow-sm"
              style={{
                backgroundColor: "#15803d",
                borderColor: "#15803d",
                fontSize: "0.84rem",
                fontWeight: 500,
              }}
              title="Exportar planilla a Excel"
            >
              <i className="bi bi-file-earmark-excel-fill"></i>
              <span>Excel</span>
            </Button>
          </div>
        </div>

        {/* Tabla de Último Service de Colectivos */}
        <div
          className="flex-grow-1 shadow-sm rounded-3 bg-white"
          style={{
            overflowY: "auto",
            overflowX: "auto",
            border: "1px solid #cbd5e1",
            maxWidth: "1180px",
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
            <thead
              style={{
                position: "sticky",
                top: 0,
                zIndex: 10,
                backgroundColor: "#1e293b",
                color: "#fff",
              }}
            >
              <tr className="fw-normal align-middle">
                <th style={{ width: "35px", backgroundColor: "#1e293b", color: "#fff", padding: "6px 4px", fontWeight: "normal" }}>#</th>
                <th style={{ width: "160px", backgroundColor: "#1e293b", color: "#fff", padding: "6px 4px", fontWeight: "normal" }}>Acción</th>
                <th style={{ width: "80px", backgroundColor: "#1e293b", color: "#fff", padding: "6px 6px", fontWeight: "normal" }}>CC</th>
                <th style={{ width: "180px", backgroundColor: "#1e293b", color: "#fff", padding: "6px 8px", textAlign: "left", fontWeight: "normal" }}>Patente / Descripción</th>
                <th style={{ width: "90px", backgroundColor: "#1e293b", color: "#fff", padding: "6px 4px", fontWeight: "normal" }}>Fecha</th>
                <th style={{ width: "110px", backgroundColor: "#1e293b", color: "#fff", padding: "6px 4px", fontWeight: "normal" }}>Kilometraje</th>
                <th style={{ width: "95px", backgroundColor: "#1e293b", color: "#fff", padding: "6px 4px", fontWeight: "normal" }}>Fecha Service</th>
                <th style={{ width: "115px", backgroundColor: "#1e293b", color: "#fff", padding: "6px 4px", fontWeight: "normal" }}>Km Service</th>
                <th style={{ width: "115px", backgroundColor: "#1e293b", color: "#fff", padding: "6px 4px", fontWeight: "normal" }}>Km Próx. Srv.</th>
                <th style={{ width: "45px", backgroundColor: "#1e293b", color: "#fff", padding: "6px 4px", fontWeight: "normal" }}>Obs.</th>
                <th style={{ width: "105px", backgroundColor: "#1e293b", color: "#fff", padding: "6px 4px", fontWeight: "normal" }}>Estado</th>
                <th style={{ width: "85px", backgroundColor: "#1e293b", color: "#fff", padding: "6px 4px", fontWeight: "normal" }}>Historial</th>
              </tr>
            </thead>
            <tbody>
              {colectivosFiltrados.map((c, idx) => {
                const { reg, kmActuales, fechaKmActual, kmUltimoService, kmProxService, estado } =
                  filaDeColectivo(c);
                const atrasado = estado.label === "Atrasado";
                const isEven = idx % 2 === 0;

                return (
                  <tr
                    key={c._id}
                    style={{
                      backgroundColor: isEven ? "#ffffff" : "#f8fafc",
                      borderBottom: "1px solid #e2e8f0",
                    }}
                  >
                    {/* # */}
                    <td className="text-muted" style={{ fontSize: "0.75rem", padding: "5px 4px" }}>
                      {idx + 1}
                    </td>

                    {/* Acción / Último Service + Kilometraje */}
                    <td style={{ padding: "5px 4px" }}>
                      <div className="d-flex align-items-center justify-content-center gap-1">
                        <button
                          onClick={() => abrirModalService(c._id)}
                          className="btn btn-sm py-0.5 px-2 rounded-2 text-white shadow-sm"
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
                          title="Cargar último service para este colectivo"
                        >
                          + Service
                        </button>
                        <button
                          onClick={() => abrirModalKilometraje(c)}
                          className="btn btn-sm py-0.5 px-2 rounded-2 text-white shadow-sm"
                          style={{
                            backgroundColor: "#0d9488",
                            border: "1px solid #0f766e",
                            fontSize: "0.72rem",
                            fontWeight: 500,
                            transition: "all 0.15s ease",
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.backgroundColor = "#0f766e";
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.backgroundColor = "#0d9488";
                          }}
                          title="Cargar kilometraje actual para este colectivo"
                        >
                          + Km
                        </button>
                      </div>
                    </td>

                    {/* CC */}
                    <td style={{ padding: "5px 6px" }}>
                      <span
                        className="badge px-2 py-1 text-white shadow-sm"
                        style={{
                          backgroundColor: atrasado ? "#991b1b" : "#0f172a",
                          border: "1px solid #475569",
                          fontSize: "0.78rem",
                          letterSpacing: "0.5px",
                          borderRadius: "5px",
                          fontWeight: 700,
                        }}
                      >
                        {c.cc}
                      </span>
                    </td>

                    {/* Patente / Descripción */}
                    <td className="text-start" style={{ padding: "5px 8px" }}>
                      <div className="d-flex flex-column">
                        <span className="fw-semibold text-dark" style={{ fontSize: "0.8rem" }}>
                          {c.patente || c.descripcion || "—"}
                        </span>
                        {(c.descripcion || c.supervisor) && (
                          <span className="text-muted" style={{ fontSize: "0.72rem" }}>
                            {[c.patente && c.descripcion ? c.descripcion : null, c.supervisor ? `Sup: ${c.supervisor}` : null]
                              .filter(Boolean)
                              .join(" — ")}
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Fecha (Fecha lectura kilometraje actual) */}
                    <td style={{ fontSize: "0.76rem", color: "#475569", padding: "5px 4px" }}>
                      {fechaKmActual ? formatFecha(fechaKmActual) : "—"}
                    </td>

                    {/* Kilometraje actual */}
                    <td className="fw-bold" style={{ fontSize: "0.82rem", color: "#0f172a", padding: "5px 4px" }}>
                      {formatKm(kmActuales)}
                    </td>

                    {/* Fecha Service (Fecha último service) */}
                    <td style={{ fontSize: "0.76rem", color: "#475569", padding: "5px 4px" }}>
                      {reg ? formatFecha(reg.fecha) : "—"}
                    </td>

                    {/* Km Service (Kilometraje último service) */}
                    <td className="fw-semibold text-primary" style={{ fontSize: "0.8rem", padding: "5px 4px" }}>
                      {formatKm(kmUltimoService)}
                    </td>

                    {/* Km Próx. Srv. */}
                    <td className="fw-semibold" style={{ fontSize: "0.8rem", color: "#2563eb", padding: "5px 4px" }}>
                      {formatKm(kmProxService)}
                    </td>

                    {/* Obs */}
                    <td style={{ padding: "5px 4px" }}>
                      <button
                        className={`btn btn-sm p-0 rounded-circle d-inline-flex align-items-center justify-content-center ${
                          reg?.observaciones?.trim() ? "btn-outline-primary" : "btn-outline-secondary"
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
                            colectivoId: c._id,
                            cc: c.cc,
                            patente: c.patente,
                            texto: reg?.observaciones || "",
                          })
                        }
                        title={reg?.observaciones?.trim() ? "Editar observaciones" : "Agregar observación"}
                      >
                        <i className={`bi ${reg?.observaciones?.trim() ? "bi-chat-left-text-fill" : "bi-plus"}`}></i>
                      </button>
                    </td>

                    {/* Estado */}
                    <td style={{ padding: "5px 4px" }}>
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
                    </td>

                    {/* Historial */}
                    <td style={{ padding: "5px 4px" }}>
                      <button
                        onClick={() => abrirHistorial(c)}
                        className="btn btn-sm btn-outline-secondary py-0.5 px-2 rounded-2 d-inline-flex align-items-center gap-1 shadow-sm"
                        style={{ fontSize: "0.72rem", fontWeight: 500 }}
                        title="Ver historial de services"
                      >
                        <i className="bi bi-clock-history"></i>
                        <span>Historial</span>
                      </button>
                    </td>
                  </tr>
                );
              })}

              {colectivosFiltrados.length === 0 && (
                <tr>
                  <td colSpan={12} className="text-muted py-4">
                    {loading
                      ? "Cargando datos..."
                      : filtroBusqueda
                      ? `Sin resultados para "${filtroBusqueda}"`
                      : "Sin colectivos registrados"}
                  </td>
                </tr>
              )}
            </tbody>
          </Table>
        </div>
      </Container>

      {/* Modal Cargar Service */}
      <Modal show={showModal} onHide={cerrarModalService} centered contentClassName="border-0 rounded-4 shadow-lg overflow-hidden">
        <Modal.Header
          closeButton
          closeVariant="white"
          style={{
            backgroundColor: "#1e293b",
            color: "#fff",
            padding: "14px 20px",
          }}
        >
          <Modal.Title className="fs-6 fw-bold d-flex align-items-center gap-2 mb-0">
            <i className="bi bi-speedometer2 text-warning"></i>
            <span>
              {colectivoModalPreseleccionado
                ? `${servicioEditandoId ? "Editar" : "Cargar"} Service — CC ${colectivoModalPreseleccionado.cc}`
                : `${servicioEditandoId ? "Editar" : "Cargar"} Service de Colectivo`}
            </span>
          </Modal.Title>
        </Modal.Header>
        <Modal.Body className="p-4 bg-white">
          <Form onSubmit={handleSubmit(onSubmitService)} className="d-flex flex-column align-items-center">
            <div style={{ width: "100%", maxWidth: "340px" }}>
              {/* Selector de Colectivo */}
              <Form.Group className="mb-3">
                <Form.Label className="small fw-semibold text-dark mb-1">
                  Colectivo (CC) <span className="text-danger">*</span>
                </Form.Label>
                <Form.Select
                  {...register("colectivo", { required: "Seleccioná un colectivo" })}
                  isInvalid={!!errors.colectivo}
                  className="rounded-3"
                  style={{ fontSize: "0.86rem" }}
                >
                  <option value="">— Seleccionar Colectivo —</option>
                  {colectivos.map((c) => (
                    <option key={c._id} value={c._id}>
                      CC {c.cc} {c.patente ? `— ${c.patente}` : ""} {c.supervisor ? `(${c.supervisor})` : ""}
                    </option>
                  ))}
                </Form.Select>
                {errors.colectivo && (
                  <Form.Control.Feedback type="invalid" style={{ fontSize: "0.76rem" }}>
                    {errors.colectivo.message}
                  </Form.Control.Feedback>
                )}
              </Form.Group>

              {/* Fecha */}
              <Form.Group className="mb-3">
                <Form.Label className="small fw-semibold text-dark mb-1">
                  Fecha del Service <span className="text-danger">*</span>
                </Form.Label>
                <Form.Control
                  type="date"
                  {...register("fecha", { required: "La fecha es requerida" })}
                  isInvalid={!!errors.fecha}
                  className="rounded-3"
                  style={{ fontSize: "0.86rem" }}
                />
              </Form.Group>

              {/* Kilometraje Último Service */}
              <Form.Group className="mb-3">
                <Form.Label className="small fw-semibold text-dark mb-1">
                  Kilometraje Último Service (Km) <span className="text-danger">*</span>
                </Form.Label>
                <Form.Control
                  type="number"
                  min="0"
                  step="any"
                  placeholder="Ej: 138000"
                  {...register("kilometraje", { required: "El kilometraje es requerido" })}
                  isInvalid={!!errors.kilometraje}
                  className="rounded-3"
                  style={{ fontSize: "0.86rem" }}
                />
                {errors.kilometraje && (
                  <Form.Control.Feedback type="invalid" style={{ fontSize: "0.76rem" }}>
                    {errors.kilometraje.message}
                  </Form.Control.Feedback>
                )}
              </Form.Group>

              {/* Intervalo de Service */}
              <Form.Group className="mb-3">
                <Form.Label className="small fw-semibold text-dark mb-1">
                  Intervalo Próx. Service (Km)
                </Form.Label>
                <Form.Select {...register("intervalo")} className="rounded-3" style={{ fontSize: "0.86rem" }}>
                  <option value="10000">Cada 10.000 km (Estándar)</option>
                  <option value="15000">Cada 15.000 km</option>
                  <option value="20000">Cada 20.000 km</option>
                  <option value="5000">Cada 5.000 km</option>
                </Form.Select>
              </Form.Group>

              {/* Supervisor / Responsable */}
              <Form.Group className="mb-3">
                <Form.Label className="small fw-semibold text-dark mb-1">
                  Supervisor / Responsable
                </Form.Label>
                <Form.Control
                  type="text"
                  placeholder="Nombre de supervisor..."
                  {...register("responsable")}
                  className="rounded-3"
                  style={{ fontSize: "0.86rem" }}
                />
              </Form.Group>

              {/* Observaciones */}
              <Form.Group className="mb-4">
                <Form.Label className="small fw-semibold text-dark mb-1">Observaciones</Form.Label>
                <Form.Control
                  as="textarea"
                  rows={2}
                  placeholder="Filtros cambiados, aceite, detalles..."
                  {...register("observaciones")}
                  className="rounded-3"
                  style={{ fontSize: "0.85rem" }}
                />
              </Form.Group>

              <div className="d-flex justify-content-end gap-2 pt-2 border-top">
                <Button
                  variant="outline-secondary"
                  size="sm"
                  onClick={cerrarModalService}
                  className="rounded-3 px-3 py-1.5"
                  style={{ fontSize: "0.84rem" }}
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  size="sm"
                  className="rounded-3 px-3 py-1.5 fw-semibold shadow-sm text-white"
                  style={{
                    backgroundColor: "#1e293b",
                    borderColor: "#1e293b",
                    fontSize: "0.84rem",
                  }}
                >
                  {servicioEditandoId ? "Guardar Cambios" : "Guardar Service"}
                </Button>
              </div>
            </div>
          </Form>
        </Modal.Body>
      </Modal>

      {/* Modal Cargar Kilometraje Actual */}
      <Modal show={showModalKm} onHide={cerrarModalKilometraje} centered contentClassName="border-0 rounded-4 shadow-lg overflow-hidden">
        <Modal.Header
          closeButton
          closeVariant="white"
          style={{
            backgroundColor: "#1e293b",
            color: "#fff",
            padding: "14px 20px",
          }}
        >
          <Modal.Title className="fs-6 fw-bold d-flex align-items-center gap-2 mb-0">
            <i className="bi bi-speedometer text-info"></i>
            <span>
              {colectivoModalKm
                ? `${kilometroEditandoId ? "Editar" : "Cargar"} Kilometraje — CC ${colectivoModalKm.cc}`
                : `${kilometroEditandoId ? "Editar" : "Cargar"} Kilometraje de Colectivo`}
            </span>
          </Modal.Title>
        </Modal.Header>
        <Modal.Body className="p-4 bg-white">
          <Form onSubmit={handleSubmitKm(onSubmitKilometraje)} className="d-flex flex-column align-items-center">
            <div style={{ width: "100%", maxWidth: "340px" }}>
              {/* Selector de Colectivo */}
              <Form.Group className="mb-3">
                <Form.Label className="small fw-semibold text-dark mb-1">
                  Colectivo (CC) <span className="text-danger">*</span>
                </Form.Label>
                <Form.Select
                  {...registerKm("colectivo", { required: "Seleccioná un colectivo" })}
                  isInvalid={!!errorsKm.colectivo}
                  className="rounded-3"
                  style={{ fontSize: "0.86rem" }}
                >
                  <option value="">— Seleccionar Colectivo —</option>
                  {colectivos.map((c) => (
                    <option key={c._id} value={c._id}>
                      CC {c.cc} {c.patente ? `— ${c.patente}` : ""} {c.supervisor ? `(${c.supervisor})` : ""}
                    </option>
                  ))}
                </Form.Select>
                {errorsKm.colectivo && (
                  <Form.Control.Feedback type="invalid" style={{ fontSize: "0.76rem" }}>
                    {errorsKm.colectivo.message}
                  </Form.Control.Feedback>
                )}
              </Form.Group>

              {/* Fecha de lectura */}
              <Form.Group className="mb-3">
                <Form.Label className="small fw-semibold text-dark mb-1">
                  Fecha de la Lectura <span className="text-danger">*</span>
                </Form.Label>
                <Form.Control
                  type="date"
                  {...registerKm("fecha", { required: "La fecha es requerida" })}
                  isInvalid={!!errorsKm.fecha}
                  className="rounded-3"
                  style={{ fontSize: "0.86rem" }}
                />
                {errorsKm.fecha && (
                  <Form.Control.Feedback type="invalid" style={{ fontSize: "0.76rem" }}>
                    {errorsKm.fecha.message}
                  </Form.Control.Feedback>
                )}
              </Form.Group>

              {/* Kilometraje actual */}
              <Form.Group className="mb-3">
                <Form.Label className="small fw-semibold text-dark mb-1">
                  Kilometraje Actual (Km) <span className="text-danger">*</span>
                </Form.Label>
                <Form.Control
                  type="number"
                  min="0"
                  step="any"
                  placeholder="Ej: 145300"
                  {...registerKm("kilometraje", { required: "El kilometraje es requerido" })}
                  isInvalid={!!errorsKm.kilometraje}
                  className="rounded-3"
                  style={{ fontSize: "0.86rem" }}
                />
                {errorsKm.kilometraje && (
                  <Form.Control.Feedback type="invalid" style={{ fontSize: "0.76rem" }}>
                    {errorsKm.kilometraje.message}
                  </Form.Control.Feedback>
                )}
                {kmActualReferencia?.kilometraje !== undefined && (
                  <Form.Text className="text-muted" style={{ fontSize: "0.74rem" }}>
                    Última lectura registrada: {kmActualReferencia.kilometraje.toLocaleString("es-AR")} km
                    {kmActualReferencia.fecha ? ` (${formatFecha(kmActualReferencia.fecha)})` : ""}
                  </Form.Text>
                )}
              </Form.Group>

              {/* Observaciones */}
              <Form.Group className="mb-4">
                <Form.Label className="small fw-semibold text-dark mb-1">Observaciones</Form.Label>
                <Form.Control
                  as="textarea"
                  rows={2}
                  placeholder="Quién tomó la lectura, novedades, detalles..."
                  {...registerKm("observaciones")}
                  className="rounded-3"
                  style={{ fontSize: "0.85rem" }}
                />
              </Form.Group>

              <div className="d-flex justify-content-end gap-2 pt-2 border-top">
                <Button
                  variant="outline-secondary"
                  size="sm"
                  onClick={cerrarModalKilometraje}
                  className="rounded-3 px-3 py-1.5"
                  style={{ fontSize: "0.84rem" }}
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  size="sm"
                  className="rounded-3 px-3 py-1.5 fw-semibold shadow-sm text-white"
                  style={{
                    backgroundColor: "#0d9488",
                    borderColor: "#0d9488",
                    fontSize: "0.84rem",
                  }}
                >
                  {kilometroEditandoId ? "Guardar Cambios" : "Guardar Kilometraje"}
                </Button>
              </div>
            </div>
          </Form>
        </Modal.Body>
      </Modal>

      {/* Modal Historial de Services */}
      <Modal
        show={historialModal !== null && !showModal && !showModalKm}
        onHide={() => setHistorialModal(null)}
        centered
        size="xl"
        contentClassName="border-0 rounded-4 shadow-lg overflow-hidden"
      >
        <Modal.Header
          closeButton
          closeVariant="white"
          style={{ backgroundColor: "#1e293b", color: "#fff", padding: "14px 20px" }}
        >
          <Modal.Title className="fs-6 fw-bold d-flex align-items-center gap-2 mb-0">
            <i className="bi bi-clock-history text-info"></i>
            <span>
              Historial de Services — CC {historialModal?.cc} ({historialModal?.patente || "Colectivo"})
            </span>
          </Modal.Title>
        </Modal.Header>
        <Modal.Body className="p-3 p-md-4 bg-white" style={{ maxHeight: "70vh", overflowY: "auto" }}>
          {(() => {
            const kmObj = getKmObj(historialModal);
            const fechaLecturaActual = kmObj?.fecha;
            const kilometrajeActual = kmObj?.kilometraje;

            const regTabla = ultimosServices.find(
              (u) =>
                u.colectivo?._id === historialModal?._id ||
                u.colectivo === historialModal?._id ||
                u.cc === historialModal?.cc
            );

            const services =
              Array.isArray(historialServices) && historialServices.length > 0
                ? historialServices
                : regTabla
                ? [regTabla]
                : [];

            // Un evento por registro cargado, sea service o lectura de odometro.
            const lista = [
              ...services.map((r) => ({ ...r, tipo: "service" })),
              ...(Array.isArray(historialKilometros) ? historialKilometros : []).map((r) => ({
                ...r,
                tipo: "kilometraje",
              })),
            ].sort((a, b) => new Date(b.fecha || 0) - new Date(a.fecha || 0));

            // La lectura vigente puede venir inferida de un service y no tener
            // registro propio: sin esto el historial muestra los valores
            // anteriores pero no el actual.
            const soloDia = (f) => String(f || "").split("T")[0];
            const actualYaListada = lista.some(
              (r) =>
                Number(r.kilometraje) === Number(kilometrajeActual) &&
                soloDia(r.fecha) === soloDia(fechaLecturaActual)
            );
            const filaActual =
              typeof kilometrajeActual === "number" && !actualYaListada
                ? {
                    tipo: "actual",
                    _id: "actual",
                    fecha: fechaLecturaActual,
                    kilometraje: kilometrajeActual,
                    origen: kmObj?.origen,
                  }
                : null;

            // Va primero: es la lectura mas reciente del colectivo.
            const listaCompleta = filaActual ? [filaActual, ...lista] : lista;

            return (
              <>
                {cargandoHistorial ? (
                  <div className="text-center py-4 text-muted">Cargando historial...</div>
                ) : (
                  <Table hover size="sm" className="align-middle text-center mb-0" style={{ fontSize: "0.82rem" }}>
                    <thead className="table-dark">
                      <tr>
                        <th style={{ fontWeight: 500 }}>CC</th>
                        <th style={{ fontWeight: 500 }}>Fecha</th>
                        <th style={{ fontWeight: 500 }}>Kilometraje</th>
                        <th style={{ fontWeight: 500 }}>Fecha Service</th>
                        <th style={{ fontWeight: 500 }}>Km Service</th>
                        <th style={{ fontWeight: 500 }}>Km Próx.</th>
                        <th style={{ fontWeight: 500, textAlign: "left" }}>Observaciones</th>
                        <th style={{ fontWeight: 500, width: "90px" }}>Acción</th>
                      </tr>
                    </thead>
                    <tbody>
                      {listaCompleta.length === 0 ? (
                        <tr>
                          <td>
                            <span className="badge px-2 py-1 bg-dark text-white rounded-2 fw-bold">
                              {historialModal?.cc || "—"}
                            </span>
                          </td>
                          <td>{fechaLecturaActual ? formatFecha(fechaLecturaActual) : "—"}</td>
                          <td className="fw-bold text-dark">{formatKm(kilometrajeActual)}</td>
                          <td className="text-muted">—</td>
                          <td className="text-muted">—</td>
                          <td className="text-muted">—</td>
                          <td className="text-start text-muted">Sin services registrados</td>
                          <td>
                            <div className="d-flex align-items-center justify-content-center gap-1">
                              <button
                                onClick={() => historialModal && abrirModalService(historialModal._id)}
                                className="btn btn-sm btn-outline-primary border-0 p-1"
                                title="Cargar el service de este colectivo"
                              >
                                <i className="bi bi-pencil-square fs-6"></i>
                              </button>
                              <button
                                disabled
                                className="btn btn-sm btn-outline-danger border-0 p-1"
                                title="No hay service para borrar"
                              >
                                <i className="bi bi-trash fs-6"></i>
                              </button>
                            </div>
                          </td>
                        </tr>
                      ) : (
                        listaCompleta.map((s) => {
                          const esActual = s.tipo === "actual";
                          // La lectura vigente ocupa las mismas columnas que una
                          // lectura de odometro cargada a mano.
                          const esLectura = s.tipo === "kilometraje" || esActual;
                          return (
                            <tr
                              key={`${s.tipo}-${s._id}`}
                              style={esActual ? { backgroundColor: "#f0f9ff" } : undefined}
                            >
                              <td>
                                <span className="badge px-2 py-1 bg-dark text-white rounded-2 fw-bold">
                                  {historialModal?.cc || s.colectivo?.cc || s.cc || "—"}
                                </span>
                              </td>
                              <td>{esLectura && s.fecha ? formatFecha(s.fecha) : "—"}</td>
                              <td className="fw-bold text-dark">
                                {esLectura ? formatKm(s.kilometraje) : "—"}
                                {esActual && (
                                  <span
                                    className="badge ms-1 text-white rounded-2"
                                    style={{ backgroundColor: "#0d9488", fontSize: "0.66rem", fontWeight: 600 }}
                                  >
                                    Actual
                                  </span>
                                )}
                              </td>
                              <td>{!esLectura && s.fecha ? formatFecha(s.fecha) : "—"}</td>
                              <td className="fw-semibold text-primary">
                                {!esLectura ? formatKm(s.kilometraje) : "—"}
                              </td>
                              <td className="text-secondary fw-semibold">
                                {!esLectura && typeof s.kilometraje === "number"
                                  ? formatKm(s.kilometraje + (s.intervalo || DEFAULT_INTERVALO_KM))
                                  : "—"}
                              </td>
                              <td className="text-start">
                                {esActual
                                  ? `Lectura vigente${s.origen ? ` — tomada de ${ORIGEN_LECTURA[s.origen] || s.origen}` : ""}`
                                  : s.observaciones || "—"}
                              </td>
                              <td>
                                {s._id && !esActual && (
                                  <div className="d-flex align-items-center justify-content-center gap-1">
                                    <button
                                      onClick={() =>
                                        esLectura ? editarKilometrajeHistorial(s) : editarServiceHistorial(s)
                                      }
                                      className="btn btn-sm btn-outline-primary border-0 p-1"
                                      title={esLectura ? "Editar lectura de kilometraje" : "Editar service"}
                                    >
                                      <i className="bi bi-pencil-square fs-6"></i>
                                    </button>
                                    <button
                                      onClick={() =>
                                        esLectura
                                          ? eliminarKilometrajeHistorial(s._id)
                                          : eliminarServiceHistorial(s._id)
                                      }
                                      className="btn btn-sm btn-outline-danger border-0 p-1"
                                      title={esLectura ? "Eliminar lectura de kilometraje" : "Eliminar service"}
                                    >
                                      <i className="bi bi-trash fs-6"></i>
                                    </button>
                                  </div>
                                )}
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </Table>
                )}
              </>
            );
          })()}
        </Modal.Body>
        <Modal.Footer className="bg-light border-0 py-2.5 px-4">
          <Button
            variant="outline-secondary"
            size="sm"
            onClick={() => setHistorialModal(null)}
            className="rounded-3 px-3 py-1"
            style={{ fontSize: "0.84rem" }}
          >
            Cerrar
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Modal Observaciones */}
      <Modal
        show={obsModalText !== null}
        onHide={() => setObsModalText(null)}
        centered
        size="sm"
        contentClassName="border rounded-4 shadow"
      >
        <Modal.Header closeButton style={{ backgroundColor: "#1e293b", color: "#fff", padding: "12px 18px" }}>
          <Modal.Title className="fs-6 fw-bold mb-0">Observaciones — CC {obsModalText?.cc}</Modal.Title>
        </Modal.Header>
        <Modal.Body className="p-3 bg-white">
          <Form.Group>
            <Form.Control
              as="textarea"
              rows={4}
              value={obsModalText?.texto || ""}
              onChange={(e) => setObsModalText((prev) => (prev ? { ...prev, texto: e.target.value } : null))}
              placeholder="Detalles sobre el service..."
              className="rounded-3"
              style={{ fontSize: "0.84rem" }}
              autoFocus
            />
          </Form.Group>
        </Modal.Body>
        <Modal.Footer className="border-0 pt-0 pb-3 px-3 d-flex justify-content-end gap-2">
          <Button
            variant="outline-secondary"
            size="sm"
            onClick={() => setObsModalText(null)}
            className="rounded-2 px-3"
            style={{ fontSize: "0.78rem" }}
          >
            Cancelar
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={guardarObservacion}
            disabled={guardandoObs}
            className="rounded-2 px-3 fw-semibold text-white"
            style={{
              backgroundColor: "#1e293b",
              borderColor: "#1e293b",
              fontSize: "0.78rem",
            }}
          >
            {guardandoObs ? "Guardando..." : "Guardar"}
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
}

export default ColectivosPreventivo;
