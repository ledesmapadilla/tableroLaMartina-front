import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useForm, useWatch } from "react-hook-form";
import { Button, Modal, Form, Table, Container, Badge } from "react-bootstrap";
import Swal from "sweetalert2";
import { nuevoWorkbook } from "../../helpers/excel";
import TractorIcon from "../shared/TractorIcon";
import LogoNavbar from "../shared/LogoNavbar";
import { guardarConReglaHorometro } from "../../utils/horometro";

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

// Intervalo estándar de mantenimiento para tractores (en horas)
const DEFAULT_INTERVALO_HS = 250;

// Horas con las que hay que hacer la cuenta del service. Cuando hubo cambio de
// horómetro la lectura sola miente: hay que sumarle las horas de los anteriores.
const horasDe = (obj) =>
  typeof obj?.acumuladas === "number" ? obj.acumuladas : obj?.horometro;

// De donde se tomo la lectura vigente de horometro.
const ORIGEN_LECTURA = {
  manual: "carga manual",
  visita: "visita",
  service: "service",
  reparacion: "reparación",
  produccion: "certificaciones",
};

// Cada fuente con su color, para que en el historial se vea de un vistazo de
// dónde salió la lectura.
const ORIGEN_ESTILO = {
  manual: { bg: "#e0e7ff", color: "#3730a3", border: "#818cf8", icono: "bi-pencil-fill" },
  visita: { bg: "#e0f2fe", color: "#0369a1", border: "#7dd3fc", icono: "bi-clipboard-check-fill" },
  service: { bg: "#dcfce7", color: "#166534", border: "#86efac", icono: "bi-tools" },
  reparacion: { bg: "#fef3c7", color: "#92400e", border: "#fcd34d", icono: "bi-wrench-adjustable" },
  produccion: { bg: "#fae8ff", color: "#86198f", border: "#e879f9", icono: "bi-journal-text" },
};

const BadgeHorometro = ({ numero }) => {
  if (!numero || numero < 2) return null;
  return (
    <span
      className="badge ms-1 rounded-2 fw-bold"
      style={{ backgroundColor: "#7c2d12", color: "#fff", fontSize: "0.64rem" }}
      title={`Lectura del ${numero}° horómetro de esta máquina`}
    >
      H{numero}
    </span>
  );
};

const BadgeOrigen = ({ origen }) => {
  if (!origen) return <span className="text-muted">—</span>;
  const e = ORIGEN_ESTILO[origen] || { bg: "#f1f5f9", color: "#475569", border: "#cbd5e1", icono: "bi-question-circle" };
  return (
    <span
      className="badge px-2 py-1 rounded-2 fw-semibold"
      style={{ backgroundColor: e.bg, color: e.color, border: `1px solid ${e.border}`, fontSize: "0.7rem" }}
    >
      <i className={`bi ${e.icono} me-1`}></i>
      {ORIGEN_LECTURA[origen] || origen}
    </span>
  );
};

function getEstadoTractor(hsActuales, hsUltimoService, intervalo = DEFAULT_INTERVALO_HS, esParado = false) {
  if (esParado) {
    return {
      label: "Parado",
      bg: "#fee2e2",
      color: "#991b1b",
    };
  }

  if (typeof hsUltimoService !== "number" || isNaN(hsUltimoService)) {
    return {
      label: "Sin service",
      bg: "#f1f5f9",
      color: "#64748b",
    };
  }

  if (typeof hsActuales !== "number" || isNaN(hsActuales)) {
    return {
      label: "Al día",
      bg: "#dcfce7",
      color: "#166534",
    };
  }

  const hsProxService = hsUltimoService + intervalo;
  const diferencia = hsProxService - hsActuales;

  if (diferencia <= 0) {
    return {
      label: "Atrasado",
      bg: "#dc2626",
      color: "#ffffff",
    };
  }

  if (diferencia <= 50) {
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

function TractoresPreventivo() {
  const navigate = useNavigate();
  const [tractores, setTractores] = useState([]);
  const [ultimosServices, setUltimosServices] = useState([]);
  const [ultimosHorometros, setUltimosHorometros] = useState({});
  const [paradasTractores, setParadasTractores] = useState(new Set());
  const [loading, setLoading] = useState(true);

  const [año, setAnio] = useState(2026);
  const [dropAño, setDropAño] = useState(false);
  const dropAñoRef = useRef(null);

  const [filtroBusqueda, setFiltroBusqueda] = useState("");
  const [filtroGrupo, setFiltroGrupo] = useState("TODOS");

  // Modal Cargar Service
  const [showModal, setShowModal] = useState(false);
  const [tractorModalPreseleccionado, setTractorModalPreseleccionado] = useState(null);
  const [servicioEditandoId, setServicioEditandoId] = useState(null);

  // Modal Cargar Horometro actual
  const [showModalHm, setShowModalHm] = useState(false);
  const [tractorModalHm, setTractorModalHm] = useState(null);
  const [horometroEditandoId, setHorometroEditandoId] = useState(null);
  const [hmActualReferencia, setHmActualReferencia] = useState(null);

  // Modal Observaciones
  const [obsModalText, setObsModalText] = useState(null);
  const [guardandoObs, setGuardandoObs] = useState(false);

  // Modal Historial
  const [historialModal, setHistorialModal] = useState(null);
  const [historialServices, setHistorialServices] = useState([]);
  const [historialHorometros, setHistorialHorometros] = useState([]);
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
      tractor: "",
      fecha: new Date().toISOString().split("T")[0],
      responsable: "",
      horometro: "",
      intervalo: 250,
      observaciones: "",
    },
  });

  const {
    register: registerHm,
    handleSubmit: handleSubmitHm,
    reset: resetHm,
    formState: { errors: errorsHm },
  } = useForm({
    defaultValues: {
      tractor: "",
      fecha: new Date().toISOString().split("T")[0],
      horometro: "",
      observaciones: "",
    },
  });

  const tractorSeleccionadoId = useWatch({ control, name: "tractor" });

  const cargarTractores = () =>
    fetch("/api/tractores")
      .then((r) => (r.ok ? r.json() : []))
      .then((d) => setTractores(Array.isArray(d) ? d : []))
      .catch(() => setTractores([]));

  const cargarParadas = () =>
    fetch("/api/trabajos-tractor")
      .then((r) => (r.ok ? r.json() : []))
      .then((trabajos) => {
        const paradas = new Set();
        if (Array.isArray(trabajos)) {
          trabajos.forEach((t) => {
            const est = String(t.estado || "").toLowerCase().trim();
            const esTerminada = ["terminada", "terminado", "realizado", "realizada", "finalizado", "finalizada"].includes(est);
            if (t.maquinaParada && !esTerminada && t.tractor) {
              const tractorId = (t.tractor._id || t.tractor).toString();
              paradas.add(tractorId);
            }
          });
        }
        setParadasTractores(paradas);
      })
      .catch(() => setParadasTractores(new Set()));

  const cargarTabla = (anio) =>
    Promise.all([
      fetch(`/api/services-tractor/ultimos/${anio}`)
        .then((r) => (r.ok ? r.json() : []))
        .then((d) => setUltimosServices(Array.isArray(d) ? d : []))
        .catch(() => setUltimosServices([])),
      fetch("/api/services-tractor/ultimos-horometros")
        .then((r) => (r.ok ? r.json() : {}))
        .then((d) => setUltimosHorometros(d || {}))
        .catch(() => setUltimosHorometros({})),
      cargarParadas(),
    ]);

  useEffect(() => {
    setLoading(true);
    Promise.all([cargarTractores(), cargarTabla(año)]).finally(() => setLoading(false));
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
    const t = tractores.find((t) => t._id === tractorSeleccionadoId);
    if (t?.supervisor) {
      setValue("responsable", t.supervisor);
    }
  }, [tractorSeleccionadoId, tractores, setValue, servicioEditandoId]);

  const abrirModalService = (tractorId = "") => {
    const t = tractores.find((t) => t._id === tractorId);
    const reg = ultimosServices.find(
      (u) => u.tractor?._id === tractorId || u.tractor === tractorId
    );
    const hmActualObj = t?.cc ? ultimosHorometros[t.cc] : null;

    setServicioEditandoId(null);
    setTractorModalPreseleccionado(t || null);
    reset({
      tractor: tractorId || "",
      fecha: new Date().toISOString().split("T")[0],
      responsable: t?.supervisor || "",
      horometro: reg?.horometro ?? hmActualObj?.horometro ?? "",
      intervalo: reg?.intervalo ?? 250,
      observaciones: "",
    });
    setShowModal(true);
  };

  const cerrarModalService = () => {
    setShowModal(false);
    setTractorModalPreseleccionado(null);
    setServicioEditandoId(null);
  };

  const onSubmitService = async (data) => {
    const editando = Boolean(servicioEditandoId);
    try {
      const { ok, cuerpo, cancelado } = await guardarConReglaHorometro({
        tractor: data.tractor,
        fecha: data.fecha,
        enviar: ({ sinHorometro }) =>
          fetch(
            editando ? `/api/services-tractor/${servicioEditandoId}` : "/api/services-tractor",
            {
              method: editando ? "PUT" : "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(sinHorometro ? { ...data, horometro: "" } : data),
            }
          ),
      });
      if (cancelado) return;
      if (ok) {
        const tractorHistorial = historialModal;
        cerrarModalService();
        await cargarTabla(año);
        // Si la edicion salio del historial, refrescarlo antes de mostrarlo.
        if (tractorHistorial) await abrirHistorial(tractorHistorial);
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
        Swal.fire({ icon: "error", title: "Error", text: cuerpo?.error || "No se pudo guardar", width: "320px" });
      }
    } catch {
      Swal.fire({ icon: "error", title: "Sin conexión", text: "No se pudo conectar con el servidor", width: "320px" });
    }
  };

  const abrirModalHorometro = (tractor) => {
    const cleanCC = String(tractor?.cc || "").replace(/^cc\s*/i, "").trim();
    const hmObj = ultimosHorometros[tractor?.cc] || ultimosHorometros[cleanCC];

    setHorometroEditandoId(null);
    setTractorModalHm(tractor || null);
    setHmActualReferencia(hmObj || null);
    resetHm({
      tractor: tractor?._id || "",
      fecha: new Date().toISOString().split("T")[0],
      horometro: "",
      observaciones: "",
    });
    setShowModalHm(true);
  };

  const cerrarModalHorometro = () => {
    setShowModalHm(false);
    setTractorModalHm(null);
    setHmActualReferencia(null);
    setHorometroEditandoId(null);
  };

  const editarHorometroHistorial = (h) => {
    const tractorId = (h.tractor?._id || h.tractor || historialModal?._id || "").toString();
    const t = tractores.find((x) => x._id === tractorId) || historialModal;

    setHorometroEditandoId(h._id);
    setTractorModalHm(t || null);
    setHmActualReferencia(null);
    resetHm({
      tractor: tractorId,
      fecha: h.fecha ? String(h.fecha).split("T")[0] : new Date().toISOString().split("T")[0],
      horometro: h.horometro ?? "",
      observaciones: h.observaciones || "",
    });
    setShowModalHm(true);
  };

  const eliminarHorometroHistorial = async (horometroId) => {
    const result = await Swal.fire({
      title: "¿Eliminar lectura de horómetro?",
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
      const res = await fetch(`/api/horometros-tractor/${horometroId}`, { method: "DELETE" });
      if (res.ok) {
        if (historialModal) await abrirHistorial(historialModal);
        await cargarTabla(año);
        Swal.fire({
          icon: "success",
          title: "Eliminada",
          text: "La lectura de horómetro fue eliminada.",
          timer: 1300,
          showConfirmButton: false,
        });
      }
    } catch {
      Swal.fire({ icon: "error", title: "Error", text: "No se pudo eliminar" });
    }
  };

  const onSubmitHorometro = async (data) => {
    const editando = Boolean(horometroEditandoId);

    // Bajar el horometro es legitimo (corregir una carga erronea) pero nunca
    // deberia pasar por descuido: se avisa y decide el usuario.
    const nuevo = Number(data.horometro);
    const cleanCC = String(tractorModalHm?.cc || "").replace(/^cc\s*/i, "").trim();
    const hmObj = ultimosHorometros[tractorModalHm?.cc] || ultimosHorometros[cleanCC];
    const actual = hmObj?.horometro;

    if (Number.isFinite(nuevo) && typeof actual === "number" && nuevo < actual) {
      // La correccion hacia abajo solo pisa a la tabla si la carga manual es al
      // menos tan reciente como la lectura vigente. Si no, la tabla no cambia y
      // conviene decirlo en vez de prometer algo que no va a pasar.
      const pisaLaTabla = String(data.fecha || "") >= String(hmObj?.fecha || "");
      const confirmacion = await Swal.fire({
        icon: "warning",
        title: "El horómetro es menor al registrado",
        html:
          `La última lectura de <b>CC ${tractorModalHm?.cc ?? "—"}</b> es de ` +
          `<b>${actual.toLocaleString("es-AR")} hs</b>` +
          `${hmObj?.fecha ? ` (${formatFecha(hmObj.fecha)})` : ""}` +
          ` y estás cargando <b>${nuevo.toLocaleString("es-AR")} hs</b>.<br/><br/>` +
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
      // Acá la lectura es el registro: descartarla sería guardar una fila
      // vacía, así que esa opción cancela la carga.
      const { ok, cuerpo, cancelado } = await guardarConReglaHorometro({
        tractor: data.tractor,
        fecha: data.fecha,
        descartarCancela: true,
        enviar: () =>
          fetch(
            editando ? `/api/horometros-tractor/${horometroEditandoId}` : "/api/horometros-tractor",
            {
              method: editando ? "PUT" : "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(data),
            }
          ),
      });
      if (cancelado) return;
      if (ok) {
        const tractorHistorial = historialModal;
        cerrarModalHorometro();
        await cargarTabla(año);
        if (tractorHistorial) await abrirHistorial(tractorHistorial);
        Swal.fire({
          icon: "success",
          title: editando ? "Horómetro actualizado" : "Horómetro cargado",
          text: editando
            ? "Los cambios de la lectura fueron guardados exitosamente."
            : "La lectura de horómetro fue registrada exitosamente.",
          timer: 1500,
          showConfirmButton: false,
          width: "320px",
        });
      } else {
        Swal.fire({ icon: "error", title: "Error", text: cuerpo?.error || "No se pudo guardar", width: "320px" });
      }
    } catch {
      Swal.fire({ icon: "error", title: "Sin conexión", text: "No se pudo conectar con el servidor", width: "320px" });
    }
  };

  const guardarObservacion = async () => {
    if (!obsModalText) return;
    setGuardandoObs(true);
    try {
      if (obsModalText.serviceId) {
        const res = await fetch(`/api/services-tractor/${obsModalText.serviceId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ observaciones: obsModalText.texto }),
        });
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
      } else {
        const res = await fetch("/api/services-tractor", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            tractor: obsModalText.tractorId,
            fecha: new Date().toISOString().split("T")[0],
            horometro: 0,
            observaciones: obsModalText.texto,
          }),
        });
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
      }
    } catch {
      Swal.fire({ icon: "error", title: "Sin conexión", text: "No se pudo conectar", width: "300px" });
    } finally {
      setGuardandoObs(false);
    }
  };

  const abrirHistorial = async (tractor) => {
    setHistorialModal(tractor);
    setCargandoHistorial(true);
    try {
      const [resSrv, resHm] = await Promise.all([
        fetch(`/api/services-tractor/historial/${tractor._id}`),
        fetch(`/api/horometros-tractor/historial/${tractor._id}`),
      ]);
      const srv = resSrv.ok ? await resSrv.json() : [];
      const hm = resHm.ok ? await resHm.json() : [];
      setHistorialServices(Array.isArray(srv) ? srv : []);
      setHistorialHorometros(Array.isArray(hm) ? hm : []);
    } catch {
      setHistorialServices([]);
      setHistorialHorometros([]);
    } finally {
      setCargandoHistorial(false);
    }
  };

  const editarServiceHistorial = (s) => {
    const tractorId = (s.tractor?._id || s.tractor || historialModal?._id || "").toString();
    const t = tractores.find((x) => x._id === tractorId) || historialModal;

    setServicioEditandoId(s._id);
    setTractorModalPreseleccionado(t || null);
    reset({
      tractor: tractorId,
      fecha: s.fecha ? String(s.fecha).split("T")[0] : new Date().toISOString().split("T")[0],
      responsable: s.responsable || t?.supervisor || "",
      horometro: s.horometro ?? "",
      intervalo: s.intervalo ?? DEFAULT_INTERVALO_HS,
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
      const res = await fetch(`/api/services-tractor/${serviceId}`, { method: "DELETE" });
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

  const tractoresFiltrados = tractores.filter((t) => {
    const matchBusqueda =
      (t.cc || "").toLowerCase().includes(filtroBusqueda.toLowerCase()) ||
      (t.descripcion || "").toLowerCase().includes(filtroBusqueda.toLowerCase()) ||
      (t.supervisor || "").toLowerCase().includes(filtroBusqueda.toLowerCase());

    if (!matchBusqueda) return false;

    if (filtroGrupo === "TODOS") return true;
    if (filtroGrupo === "OTROS") return !t.gruppo || t.gruppo > 5;
    return String(t.gruppo) === String(filtroGrupo);
  });

  const exportarExcel = async () => {
    const titulo = `Control de Último Service - Flota de Tractores (${año})`;
    const columnas = [
      "#",
      "CC",
      "Descripción",
      "Supervisor",
      "Grupo",
      "Fecha",
      "Horómetro",
      "Fecha Service",
      "Horómetro Service",
      "Hm. Próx. Service",
      "Observaciones",
      "Estado",
    ];
    const fechaHoy = new Date().toLocaleDateString("es-AR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });

    const wb = await nuevoWorkbook();
    const ws = wb.addWorksheet("Último Service Tractores");

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

    tractoresFiltrados.forEach((t, idx) => {
      const reg = ultimosServices.find(
        (u) => u.tractor?._id === t._id || u.tractor === t._id
      );
      const cleanCC = String(t.cc || "").replace(/^cc\s*/i, "").trim();
      const hmObj = ultimosHorometros[t.cc] || ultimosHorometros[cleanCC];
      const hsActuales = horasDe(hmObj);
      const fechaHsActual = hmObj?.fecha;
      const hsUltimoService = typeof horasDe(reg) === "number" ? horasDe(reg) : null;
      const intervalo = reg?.intervalo || DEFAULT_INTERVALO_HS;
      const hsProxService = hsUltimoService !== null ? hsUltimoService + intervalo : null;

      const estaParado = paradasTractores.has(t._id?.toString());
      const estado = getEstadoTractor(hsActuales, hsUltimoService, intervalo, estaParado);

      const fila = ws.addRow([
        idx + 1,
        t.cc,
        t.descripcion || "—",
        t.supervisor || "—",
        t.gruppo ? `Grupo ${t.gruppo}` : "—",
        fechaHsActual ? formatFecha(fechaHsActual) : "—",
        hsActuales !== undefined && hsActuales !== null ? `${hsActuales.toLocaleString("es-AR")} hs` : "—",
        reg ? formatFecha(reg.fecha) : "—",
        hsUltimoService !== null ? `${hsUltimoService.toLocaleString("es-AR")} hs` : "—",
        hsProxService !== null ? `${hsProxService.toLocaleString("es-AR")} hs` : "—",
        reg?.observaciones || "—",
        estado.label,
      ]);
      fila.height = 20;

      const isOdd = idx % 2 === 1;
      const zebraBg = isOdd ? { type: "pattern", pattern: "solid", fgColor: { argb: "FFF8FAFC" } } : undefined;

      fila.eachCell({ includeEmpty: true }, (cell) => {
        cell.alignment = { horizontal: "center", vertical: "middle" };
        cell.border = thinBorder;
        if (estaParado) {
          cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFEE2E2" } };
        } else if (zebraBg) {
          cell.fill = zebraBg;
        }
      });
      fila.getCell(2).font = { bold: true };
      fila.getCell(3).alignment = { horizontal: "left", vertical: "middle" };
      fila.getCell(4).alignment = { horizontal: "left", vertical: "middle" };
      fila.getCell(11).alignment = { horizontal: "left", vertical: "middle" };
    });

    ws.columns = [
      { width: 6 },
      { width: 14 },
      { width: 26 },
      { width: 20 },
      { width: 14 },
      { width: 15 },
      { width: 16 },
      { width: 15 },
      { width: 18 },
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
    a.download = `ultimo_service_tractores_${año}.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const totalTractores = tractores.length;

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
              backgroundColor: "#10b981",
              color: "#fff",
              fontSize: "1.15rem",
              boxShadow: "0 2px 8px rgba(16, 185, 129, 0.3)",
            }}
          >
            <TractorIcon size="1.2rem" color="#fff" />
          </div>
          <div className="d-flex align-items-center gap-2">
            <span className="text-white fs-6 fw-semibold">Tractores — Control de Último Service</span>
            <span className="text-light opacity-75 small">• {totalTractores} Unidades</span>
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
            onClick={() => navigate("/tractores/reparaciones")}
            className="btn btn-sm btn-outline-light d-flex align-items-center gap-1.5 rounded-3 px-3 py-1"
            style={{ fontSize: "0.82rem" }}
          >
            <i className="bi bi-tools"></i>
            <span>Reparaciones</span>
          </button>
          <button
            onClick={() => navigate("/tractores")}
            className="btn btn-sm btn-outline-light d-flex align-items-center gap-2 rounded-3 px-3 py-1"
            style={{ fontSize: "0.82rem" }}
          >
            <TractorIcon size="1.05rem" color="#fff" />
            <span>Tractores</span>
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

            {/* Buscador por CC o Descripción */}
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
                placeholder="Buscar CC o modelo..."
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

            {/* Filtro por Grupo */}
            <Form.Select
              size="sm"
              value={filtroGrupo}
              onChange={(e) => setFiltroGrupo(e.target.value)}
              className="rounded-3 shadow-sm"
              style={{ width: "175px", fontSize: "0.84rem", borderColor: "#cbd5e1" }}
            >
              <option value="TODOS">Todos los Grupos</option>
              <option value="1">Grupo 1</option>
              <option value="2">Grupo 2</option>
              <option value="3">Grupo 3</option>
              <option value="4">Grupo 4</option>
              <option value="5">Grupo 5 (Parados)</option>
              <option value="OTROS">Otros / Sin Grupo</option>
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

        {/* Tabla de Último Service de Tractores */}
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
            size="sm"
            className="tabla-informe text-center align-middle mb-0"
            style={{ whiteSpace: "nowrap", fontSize: "0.7rem", width: "100%" }}
          >
            <thead
              style={{
                position: "sticky",
                top: 0,
                zIndex: 10,
                backgroundColor: "#1b4332",
                color: "#fff",
              }}
            >
              <tr className="fw-normal align-middle">
                {[
                  { h: "#", w: "35px" },
                  { h: "Acción", w: "175px" },
                  { h: "CC", w: "90px" },
                  { h: "Descripción", w: "180px", izq: true },
                  { h: "Fecha", w: "90px" },
                  { h: "Horómetro", w: "105px" },
                  { h: "Fecha Service", w: "95px" },
                  { h: "Horómetro Service", w: "125px" },
                  { h: "Hm. Próx. Srv.", w: "115px" },
                  { h: "Obs.", w: "45px" },
                  { h: "Estado", w: "105px" },
                  { h: "Historial", w: "85px" },
                ].map(({ h, w, izq }) => (
                  <th
                    key={h}
                    style={{
                      width: w,
                      backgroundColor: "#1b4332",
                      color: "#fff",
                      padding: "3px 5px",
                      fontSize: "0.66rem",
                      fontWeight: 600,
                      textAlign: izq ? "left" : "center",
                    }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {tractoresFiltrados.map((t, idx) => {
                const estaParado = paradasTractores.has(t._id?.toString());
                const reg = ultimosServices.find(
                  (u) => u.tractor?._id === t._id || u.tractor === t._id
                );
                const cleanCC = String(t.cc || "").replace(/^cc\s*/i, "").trim();
                const hmObj = ultimosHorometros[t.cc] || ultimosHorometros[cleanCC];
                const hsActuales = horasDe(hmObj);
                const fechaHsActual = hmObj?.fecha;
                const hsUltimoService = typeof horasDe(reg) === "number" ? horasDe(reg) : null;
                const intervalo = reg?.intervalo || DEFAULT_INTERVALO_HS;
                const hsProxService = hsUltimoService !== null ? hsUltimoService + intervalo : null;
                const estado = getEstadoTractor(hsActuales, hsUltimoService, intervalo, estaParado);

                return (
                  <tr
                    key={t._id}
                  >
                    {/* # */}
                    <td className="text-muted" style={{ fontSize: "0.68rem", padding: "2px 4px" }}>
                      {idx + 1}
                    </td>

                    {/* Acción / Último Service + Horómetro */}
                    <td style={{ padding: "2px 4px" }}>
                      <div className="d-flex align-items-center justify-content-center gap-1">
                        <button
                          onClick={() => abrirModalService(t._id)}
                          className="btn btn-sm py-0.5 px-2 rounded-2 text-white shadow-sm"
                          style={{
                            backgroundColor: "#1e293b",
                            border: "1px solid #475569",
                            fontSize: "0.68rem",
                            fontWeight: 500,
                            transition: "all 0.15s ease",
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.backgroundColor = "#334155";
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.backgroundColor = "#1e293b";
                          }}
                          title="Cargar último service para este tractor"
                        >
                          + Service
                        </button>
                        <button
                          onClick={() => abrirModalHorometro(t)}
                          className="btn btn-sm py-0.5 px-2 rounded-2 text-white shadow-sm"
                          style={{
                            backgroundColor: "#0d9488",
                            border: "1px solid #0f766e",
                            fontSize: "0.68rem",
                            fontWeight: 500,
                            transition: "all 0.15s ease",
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.backgroundColor = "#0f766e";
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.backgroundColor = "#0d9488";
                          }}
                          title="Cargar horómetro actual para este tractor"
                        >
                          + Horóm.
                        </button>
                      </div>
                    </td>

                    {/* CC */}
                    <td style={{ padding: "2px 5px" }}>
                      <span
                        className="badge px-2 py-0.5 text-white shadow-sm"
                        style={{
                          backgroundColor: estaParado ? "#991b1b" : "#0f172a",
                          border: "1px solid #475569",
                          fontSize: "0.72rem",
                          letterSpacing: "0.5px",
                          borderRadius: "5px",
                          fontWeight: 700,
                        }}
                      >
                        {t.cc}
                      </span>
                    </td>

                    {/* Descripción */}
                    <td className="text-start" style={{ padding: "2px 8px" }}>
                      <div className="d-flex flex-column">
                        <span className="fw-semibold text-dark" style={{ fontSize: "0.72rem" }}>
                          {t.descripcion || "—"}
                        </span>
                        {t.supervisor && (
                          <span className="text-muted" style={{ fontSize: "0.66rem" }}>
                            Sup: {t.supervisor} {t.gruppo ? `(G${t.gruppo})` : ""}
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Fecha (Fecha lectura horómetro actual) */}
                    <td style={{ fontSize: "0.68rem", color: "#475569", padding: "2px 4px" }}>
                      {fechaHsActual ? formatFecha(fechaHsActual) : "—"}
                    </td>

                    {/* Horómetro (Horómetro actual) */}
                    <td className="fw-bold" style={{ fontSize: "0.74rem", color: "#0f172a", padding: "2px 4px" }}>
                      {hsActuales !== undefined && hsActuales !== null ? `${hsActuales.toLocaleString("es-AR")} hs` : "—"}
                      <BadgeHorometro numero={hmObj?.numeroHorometro} />
                    </td>

                    {/* Fecha Service (Fecha último service) */}
                    <td style={{ fontSize: "0.68rem", color: "#475569", padding: "2px 4px" }}>
                      {reg ? formatFecha(reg.fecha) : "—"}
                    </td>

                    {/* Horómetro Service (Horómetro último service) */}
                    <td className="fw-semibold text-primary" style={{ fontSize: "0.72rem", padding: "2px 4px" }}>
                      {hsUltimoService !== null ? `${hsUltimoService.toLocaleString("es-AR")} hs` : "—"}
                      <BadgeHorometro numero={reg?.numeroHorometro} />
                    </td>

                    {/* Hm. Próx. Srv. */}
                    <td className="fw-semibold" style={{ fontSize: "0.72rem", color: "#2563eb", padding: "2px 4px" }}>
                      {hsProxService !== null ? `${hsProxService.toLocaleString("es-AR")} hs` : "—"}
                    </td>

                    {/* Obs */}
                    <td style={{ padding: "2px 4px" }}>
                      <button
                        className={`btn btn-sm p-0 rounded-circle d-inline-flex align-items-center justify-content-center ${
                          reg?.observaciones?.trim()
                            ? "btn-outline-primary"
                            : "btn-outline-secondary"
                        }`}
                        style={{
                          width: "22px",
                          height: "22px",
                          fontSize: "0.68rem",
                          opacity: reg?.observaciones?.trim() ? 1 : 0.6,
                        }}
                        onClick={() =>
                          setObsModalText({
                            serviceId: reg?._id,
                            tractorId: t._id,
                            cc: t.cc,
                            descripcion: t.descripcion,
                            texto: reg?.observaciones || "",
                          })
                        }
                        title={reg?.observaciones?.trim() ? "Editar observaciones" : "Agregar observación"}
                      >
                        <i className={`bi ${reg?.observaciones?.trim() ? "bi-chat-left-text-fill" : "bi-plus"}`}></i>
                      </button>
                    </td>

                    {/* Estado */}
                    <td style={{ padding: "2px 4px" }}>
                      <span
                        className="badge py-0.5 px-2 border-0 shadow-sm"
                        style={{
                          backgroundColor: estado.bg,
                          color: estado.color,
                          fontSize: "0.7rem",
                          fontWeight: 600,
                          borderRadius: "6px",
                        }}
                      >
                        {estado.label}
                      </span>
                    </td>

                    {/* Historial */}
                    <td style={{ padding: "2px 4px" }}>
                      <button
                        onClick={() => abrirHistorial(t)}
                        className="btn btn-sm btn-outline-secondary py-0.5 px-2 rounded-2 d-inline-flex align-items-center gap-1 shadow-sm"
                        style={{ fontSize: "0.68rem", fontWeight: 500 }}
                        title="Ver historial de services"
                      >
                        <i className="bi bi-clock-history"></i>
                        <span>Historial</span>
                      </button>
                    </td>
                  </tr>
                );
              })}

              {tractoresFiltrados.length === 0 && (
                <tr>
                  <td colSpan={12} className="text-muted py-4">
                    {loading
                      ? "Cargando datos..."
                      : filtroBusqueda
                      ? `Sin resultados para "${filtroBusqueda}"`
                      : "Sin tractores registrados"}
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
              {tractorModalPreseleccionado
                ? `${servicioEditandoId ? "Editar" : "Cargar"} Service — CC ${tractorModalPreseleccionado.cc}`
                : `${servicioEditandoId ? "Editar" : "Cargar"} Service de Tractor`}
            </span>
          </Modal.Title>
        </Modal.Header>
        <Modal.Body className="p-4 bg-white">
          <Form onSubmit={handleSubmit(onSubmitService)} className="d-flex flex-column align-items-center">
            <div style={{ width: "100%", maxWidth: "340px" }}>
              {/* Selector de Tractor */}
              <Form.Group className="mb-3">
                <Form.Label className="small fw-semibold text-dark mb-1">
                  Tractor (CC) <span className="text-danger">*</span>
                </Form.Label>
                <Form.Select
                  {...register("tractor", { required: "Seleccioná un tractor" })}
                  isInvalid={!!errors.tractor}
                  className="rounded-3"
                  style={{ fontSize: "0.86rem" }}
                >
                  <option value="">— Seleccionar Tractor —</option>
                  {tractores.map((t) => (
                    <option key={t._id} value={t._id}>
                      CC {t.cc} {t.descripcion ? `— ${t.descripcion}` : ""} {t.supervisor ? `(${t.supervisor})` : ""}
                    </option>
                  ))}
                </Form.Select>
                {errors.tractor && (
                  <Form.Control.Feedback type="invalid" style={{ fontSize: "0.76rem" }}>
                    {errors.tractor.message}
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

              {/* Horómetro Último Service */}
              <Form.Group className="mb-3">
                <Form.Label className="small fw-semibold text-dark mb-1">
                  Horómetro Último Service (Hs) <span className="text-danger">*</span>
                </Form.Label>
                <Form.Control
                  type="number"
                  min="0"
                  step="any"
                  placeholder="Ej: 2450"
                  {...register("horometro", { required: "El horómetro es requerido" })}
                  isInvalid={!!errors.horometro}
                  className="rounded-3"
                  style={{ fontSize: "0.86rem" }}
                />
                {errors.horometro && (
                  <Form.Control.Feedback type="invalid" style={{ fontSize: "0.76rem" }}>
                    {errors.horometro.message}
                  </Form.Control.Feedback>
                )}
              </Form.Group>

              {/* Intervalo de Service */}
              <Form.Group className="mb-3">
                <Form.Label className="small fw-semibold text-dark mb-1">
                  Intervalo Próx. Service (Horas)
                </Form.Label>
                <Form.Select
                  {...register("intervalo")}
                  className="rounded-3"
                  style={{ fontSize: "0.86rem" }}
                >
                  <option value="250">Cada 250 horas (Estándar)</option>
                  <option value="500">Cada 500 horas</option>
                  <option value="1000">Cada 1000 horas</option>
                  <option value="100">Cada 100 horas</option>
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
                <Form.Label className="small fw-semibold text-dark mb-1">
                  Observaciones
                </Form.Label>
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

      {/* Modal Cargar Horómetro Actual */}
      <Modal show={showModalHm} onHide={cerrarModalHorometro} centered contentClassName="border-0 rounded-4 shadow-lg overflow-hidden">
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
            <i className="bi bi-stopwatch-fill text-info"></i>
            <span>
              {tractorModalHm
                ? `${horometroEditandoId ? "Editar" : "Cargar"} Horómetro — CC ${tractorModalHm.cc}`
                : `${horometroEditandoId ? "Editar" : "Cargar"} Horómetro de Tractor`}
            </span>
          </Modal.Title>
        </Modal.Header>
        <Modal.Body className="p-4 bg-white">
          <Form onSubmit={handleSubmitHm(onSubmitHorometro)} className="d-flex flex-column align-items-center">
            <div style={{ width: "100%", maxWidth: "340px" }}>
              {/* Selector de Tractor */}
              <Form.Group className="mb-3">
                <Form.Label className="small fw-semibold text-dark mb-1">
                  Tractor (CC) <span className="text-danger">*</span>
                </Form.Label>
                <Form.Select
                  {...registerHm("tractor", { required: "Seleccioná un tractor" })}
                  isInvalid={!!errorsHm.tractor}
                  className="rounded-3"
                  style={{ fontSize: "0.86rem" }}
                >
                  <option value="">— Seleccionar Tractor —</option>
                  {tractores.map((t) => (
                    <option key={t._id} value={t._id}>
                      CC {t.cc} {t.descripcion ? `— ${t.descripcion}` : ""} {t.supervisor ? `(${t.supervisor})` : ""}
                    </option>
                  ))}
                </Form.Select>
                {errorsHm.tractor && (
                  <Form.Control.Feedback type="invalid" style={{ fontSize: "0.76rem" }}>
                    {errorsHm.tractor.message}
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
                  {...registerHm("fecha", { required: "La fecha es requerida" })}
                  isInvalid={!!errorsHm.fecha}
                  className="rounded-3"
                  style={{ fontSize: "0.86rem" }}
                />
                {errorsHm.fecha && (
                  <Form.Control.Feedback type="invalid" style={{ fontSize: "0.76rem" }}>
                    {errorsHm.fecha.message}
                  </Form.Control.Feedback>
                )}
              </Form.Group>

              {/* Horómetro actual */}
              <Form.Group className="mb-3">
                <Form.Label className="small fw-semibold text-dark mb-1">
                  Horómetro Actual (Hs) <span className="text-danger">*</span>
                </Form.Label>
                <Form.Control
                  type="number"
                  min="0"
                  step="any"
                  placeholder="Ej: 2680"
                  {...registerHm("horometro", { required: "El horómetro es requerido" })}
                  isInvalid={!!errorsHm.horometro}
                  className="rounded-3"
                  style={{ fontSize: "0.86rem" }}
                />
                {errorsHm.horometro && (
                  <Form.Control.Feedback type="invalid" style={{ fontSize: "0.76rem" }}>
                    {errorsHm.horometro.message}
                  </Form.Control.Feedback>
                )}
                {hmActualReferencia?.horometro !== undefined && (
                  <Form.Text className="text-muted" style={{ fontSize: "0.74rem" }}>
                    Última lectura registrada: {hmActualReferencia.horometro.toLocaleString("es-AR")} hs
                    {hmActualReferencia.fecha ? ` (${formatFecha(hmActualReferencia.fecha)})` : ""}
                  </Form.Text>
                )}
              </Form.Group>

              {/* Observaciones */}
              <Form.Group className="mb-4">
                <Form.Label className="small fw-semibold text-dark mb-1">
                  Observaciones
                </Form.Label>
                <Form.Control
                  as="textarea"
                  rows={2}
                  placeholder="Quién tomó la lectura, novedades, detalles..."
                  {...registerHm("observaciones")}
                  className="rounded-3"
                  style={{ fontSize: "0.85rem" }}
                />
              </Form.Group>

              <div className="d-flex justify-content-end gap-2 pt-2 border-top">
                <Button
                  variant="outline-secondary"
                  size="sm"
                  onClick={cerrarModalHorometro}
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
                  {horometroEditandoId ? "Guardar Cambios" : "Guardar Horómetro"}
                </Button>
              </div>
            </div>
          </Form>
        </Modal.Body>
      </Modal>

      {/* Modal Historial de Services */}
      <Modal
        show={historialModal !== null && !showModal && !showModalHm}
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
              Historial de Services — CC {historialModal?.cc} ({historialModal?.descripcion || "Tractor"})
            </span>
          </Modal.Title>
        </Modal.Header>
        <Modal.Body className="p-3 p-md-4 bg-white" style={{ maxHeight: "70vh", overflowY: "auto" }}>
          {(() => {
            const cleanCC = String(historialModal?.cc || "").replace(/^cc\s*/i, "").trim();
            const hmObj = ultimosHorometros[historialModal?.cc] || ultimosHorometros[cleanCC];
            const fechaLecturaActual = hmObj?.fecha;
            const horometroActual = hmObj?.horometro;

            const regTabla = ultimosServices.find(
              (u) =>
                u.tractor?._id === historialModal?._id ||
                u.tractor === historialModal?._id ||
                u.cc === historialModal?.cc
            );

            const services =
              Array.isArray(historialServices) && historialServices.length > 0
                ? historialServices
                : regTabla
                ? [regTabla]
                : [];

            // Un evento por registro cargado, sea service o lectura de horometro.
            const lista = [
              ...services.map((r) => ({ ...r, tipo: "service" })),
              ...(Array.isArray(historialHorometros) ? historialHorometros : []).map((r) => ({
                ...r,
                tipo: "horometro",
              })),
            ].sort((a, b) => new Date(b.fecha || 0) - new Date(a.fecha || 0));

            // La lectura vigente puede venir inferida de una visita / service /
            // reparacion y no tener registro propio: sin esto el historial
            // muestra los valores anteriores pero no el actual.
            const soloDia = (f) => String(f || "").split("T")[0];
            const actualYaListada = lista.some(
              (r) =>
                Number(r.horometro) === Number(horometroActual) &&
                soloDia(r.fecha) === soloDia(fechaLecturaActual)
            );
            const filaActual =
              typeof horometroActual === "number" && !actualYaListada
                ? {
                    tipo: "actual",
                    _id: "actual",
                    fecha: fechaLecturaActual,
                    horometro: horometroActual,
                    origen: hmObj?.origen,
                  }
                : null;

            // Va primero: es la lectura mas reciente del tractor.
            const listaCompleta = filaActual ? [filaActual, ...lista] : lista;

            return (
              <>
                <style>{`
                  .tabla-historial th,
                  .tabla-historial td {
                    padding: 2px 6px !important;
                    line-height: 1.25;
                    white-space: nowrap;
                  }
                  .tabla-historial tbody tr { height: 26px; }
                  .tabla-historial .badge {
                    padding: 1px 6px !important;
                    font-weight: 600;
                  }
                  .tabla-historial .btn {
                    padding: 0 !important;
                    width: 20px;
                    height: 20px;
                    line-height: 1;
                  }
                  .tabla-historial .btn i { font-size: 0.72rem !important; }
                `}</style>

                {cargandoHistorial ? (
                  <div className="text-center py-4 text-muted">Cargando historial...</div>
                ) : (
                  <Table
                    hover
                    size="sm"
                    className="tabla-historial align-middle text-center mb-0"
                    style={{ fontSize: "0.78rem" }}
                  >
                    <thead className="table-dark">
                      <tr>
                        <th style={{ fontWeight: 500 }}>CC</th>
                        <th style={{ fontWeight: 500 }}>Fecha</th>
                        <th style={{ fontWeight: 500 }}>Horómetro</th>
                        <th style={{ fontWeight: 500 }}>Origen</th>
                        <th style={{ fontWeight: 500 }}>Fecha Service</th>
                        <th style={{ fontWeight: 500 }}>Horómetro Service</th>
                        <th style={{ fontWeight: 500 }}>Hm. Próx.</th>
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
                          <td className="fw-bold text-dark">
                            {horometroActual !== undefined && horometroActual !== null
                              ? `${horometroActual.toLocaleString("es-AR")} hs`
                              : "—"}
                          </td>
                          <td><BadgeOrigen origen={hmObj?.origen} /></td>
                          <td className="text-muted">—</td>
                          <td className="text-muted">—</td>
                          <td className="text-muted">—</td>
                          <td className="text-start text-muted">Sin services registrados</td>
                          <td>
                            <div className="d-flex align-items-center justify-content-center gap-1">
                              <button
                                onClick={() => historialModal && abrirModalService(historialModal._id)}
                                className="btn btn-sm btn-outline-primary border-0 p-1"
                                title="Cargar el service de este tractor"
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
                          // lectura de horometro cargada a mano.
                          const esLectura = s.tipo === "horometro" || esActual;
                          return (
                            <tr
                              key={`${s.tipo}-${s._id}`}
                              style={esActual ? { backgroundColor: "#f0f9ff" } : undefined}
                            >
                              <td>
                                <span className="badge px-2 py-1 bg-dark text-white rounded-2 fw-bold">
                                  {historialModal?.cc || s.tractor?.cc || s.cc || "—"}
                                </span>
                              </td>
                              <td>{esLectura && s.fecha ? formatFecha(s.fecha) : "—"}</td>
                              <td className="fw-bold text-dark">
                                {esLectura && typeof s.horometro === "number"
                                  ? `${s.horometro.toLocaleString("es-AR")} hs`
                                  : "—"}
                                {esLectura && <BadgeHorometro numero={s.numeroHorometro ?? hmObj?.numeroHorometro} />}
                                {esActual && (
                                  <span
                                    className="badge ms-1 text-white rounded-2"
                                    style={{ backgroundColor: "#0d9488", fontSize: "0.66rem", fontWeight: 600 }}
                                  >
                                    Actual
                                  </span>
                                )}
                              </td>
                              <td>
                                <BadgeOrigen origen={esLectura ? s.origen : "service"} />
                              </td>
                              <td>{!esLectura && s.fecha ? formatFecha(s.fecha) : "—"}</td>
                              <td className="fw-semibold text-primary">
                                {!esLectura && typeof s.horometro === "number"
                                  ? `${s.horometro.toLocaleString("es-AR")} hs`
                                  : "—"}
                                {!esLectura && <BadgeHorometro numero={s.numeroHorometro} />}
                              </td>
                              <td className="text-secondary fw-semibold">
                                {!esLectura && typeof s.horometro === "number"
                                  ? `${(s.horometro + (s.intervalo || DEFAULT_INTERVALO_HS)).toLocaleString("es-AR")} hs`
                                  : "—"}
                              </td>
                              <td className="text-start">
                                {esActual ? "Lectura vigente" : s.observaciones || "—"}
                              </td>
                              <td>
                                {s._id && !esActual && (
                                  <div className="d-flex align-items-center justify-content-center gap-1">
                                    <button
                                      onClick={() =>
                                        esLectura ? editarHorometroHistorial(s) : editarServiceHistorial(s)
                                      }
                                      className="btn btn-sm btn-outline-primary border-0 p-1"
                                      title={esLectura ? "Editar lectura de horómetro" : "Editar service"}
                                    >
                                      <i className="bi bi-pencil-square fs-6"></i>
                                    </button>
                                    <button
                                      onClick={() =>
                                        esLectura
                                          ? eliminarHorometroHistorial(s._id)
                                          : eliminarServiceHistorial(s._id)
                                      }
                                      className="btn btn-sm btn-outline-danger border-0 p-1"
                                      title={esLectura ? "Eliminar lectura de horómetro" : "Eliminar service"}
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
          <Modal.Title className="fs-6 fw-bold mb-0">
            Observaciones — CC {obsModalText?.cc}
          </Modal.Title>
        </Modal.Header>
        <Modal.Body className="p-3 bg-white">
          <Form.Group>
            <Form.Control
              as="textarea"
              rows={4}
              value={obsModalText?.texto || ""}
              onChange={(e) =>
                setObsModalText((prev) => (prev ? { ...prev, texto: e.target.value } : null))
              }
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

export default TractoresPreventivo;
