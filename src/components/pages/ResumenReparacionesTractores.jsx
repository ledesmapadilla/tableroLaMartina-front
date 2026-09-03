import { useEffect, useState, useMemo } from "react";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import { Container, Card, Form, Button, Row, Col, Badge, Table, Modal } from "react-bootstrap";
import { nuevoWorkbook } from "../../helpers/excel";
import Swal from "sweetalert2";
import TractorIcon from "../shared/TractorIcon";
import LogoNavbar from "../shared/LogoNavbar";

// Formateo seguro de fechas sin desfase horario UTC
const formatF = (iso) => {
  if (!iso) return "-";
  const str = typeof iso === "string" ? iso.split("T")[0] : new Date(iso).toISOString().split("T")[0];
  const parts = str.split("-");
  if (parts.length === 3) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }
  return str;
};

const pesos = (n) =>
  (Number(n) || 0).toLocaleString("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0,
  });

const CATEGORIAS = [
  "Todas",
  "Motor",
  "Embrague",
  "Transmisión / Caja",
  "Frenos",
  "Hidráulica",
  "Dirección",
  "Mecánica general",
  "Electricidad / Luces",
  "Neumáticos / Rodado",
  "Chapa / Cabina",
  "Toma de Fuerza / Levante",
  "Service Programado",
  "Otros",
];

const CATEGORIA_COLORES = {
  Motor: { bg: "#fee2e2", text: "#991b1b", border: "#f87171" },
  Embrague: { bg: "#ffedd5", text: "#9a3412", border: "#fb923c" },
  "Transmisión / Caja": { bg: "#fef3c7", text: "#92400e", border: "#fcd34d" },
  Frenos: { bg: "#fef3c7", text: "#92400e", border: "#fcd34d" },
  Hidráulica: { bg: "#e0e7ff", text: "#3730a3", border: "#818cf8" },
  Dirección: { bg: "#e0e7ff", text: "#3730a3", border: "#818cf8" },
  "Mecánica general": { bg: "#e2e8f0", text: "#334155", border: "#94a3b8" },
  "Electricidad / Luces": { bg: "#fef9c3", text: "#854d0e", border: "#facc15" },
  "Neumáticos / Rodado": { bg: "#ccfbf1", text: "#115e59", border: "#2dd4bf" },
  "Chapa / Cabina": { bg: "#fae8ff", text: "#86198f", border: "#e879f9" },
  "Toma de Fuerza / Levante": { bg: "#e0f2fe", text: "#0369a1", border: "#7dd3fc" },
  "Service Programado": { bg: "#dcfce7", text: "#166534", border: "#4ade80" },
  Otros: { bg: "#f1f5f9", text: "#475569", border: "#cbd5e1" },
};

const URGENCIA_ESTILOS = {
  alta:  { label: "Crítico", bg: "#dc2626", text: "#ffffff", border: "#b91c1c" },
  media: { label: "Urgente", bg: "#fef3c7", text: "#b45309", border: "#fde047" },
  baja:  { label: "Leve",    bg: "#dcfce7", text: "#15803d", border: "#86efac" },
};

// Los trabajos viejos pueden no tener urgencia; se deduce de prioridad.
const urgenciaNormalizada = (t) => {
  const u = String(t?.urgencia || "").toLowerCase().trim();
  if (u === "alta" || u === "media" || u === "baja") return u;
  const p = String(t?.prioridad || "").toLowerCase().trim();
  if (p === "crítico" || p === "critico") return "alta";
  if (p === "urgente") return "media";
  return "baja";
};

const estadoNormalizado = (estado) => {
  if (!estado) return "Pendiente";
  const lower = String(estado).toLowerCase().trim();
  if (lower === "terminado" || lower === "terminada") return "Terminada";
  if (lower === "en proceso") return "En proceso";
  return "Pendiente";
};

const GRUPOS = {
  1: { label: "Grupo 1", supervisor: "Jorge Rosas", bgGradient: "linear-gradient(135deg, #1e3a8a 0%, #1e40af 100%)" },
  2: { label: "Grupo 2", supervisor: "Guillermo Bustos", bgGradient: "linear-gradient(135deg, #065f46 0%, #047857 100%)" },
  3: { label: "Grupo 3", supervisor: "Carlos Chumiento", bgGradient: "linear-gradient(135deg, #854d0e 0%, #a16207 100%)" },
  4: { label: "Grupo 4", supervisor: "brandan alejandro", bgGradient: "linear-gradient(135deg, #581c87 0%, #6b21a8 100%)" },
  5: { label: "Grupo 5", supervisor: "Elio Rojas", bgGradient: "linear-gradient(135deg, #9a3412 0%, #c2410c 100%)" },
  6: { label: "Berdina", supervisor: "Kevin", bgGradient: "linear-gradient(135deg, #991b1b 0%, #b91c1c 100%)" },
  7: { label: "San Pablo", supervisor: "Victor", bgGradient: "linear-gradient(135deg, #3f6212 0%, #4d7c0f 100%)" },
};

function ResumenReparacionesTractores() {
  const navigate = useNavigate();
  const { grupoId } = useParams();
  const { state } = useLocation();

  const esModoGrupo = Boolean(grupoId);
  const infoGrupo = esModoGrupo
    ? GRUPOS[grupoId] || { label: state?.grupoLabel || `Grupo ${grupoId}`, supervisor: "—" }
    : null;

  const [trabajos, setTrabajos] = useState([]);
  const [tractores, setTractores] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [paradosIds, setParadosIds] = useState(new Set());

  // Filtros
  const [busqueda, setBusqueda] = useState("");
  const [filtroTractor, setFiltroTractor] = useState("Todos");
  const [filtroCategoria, setFiltroCategoria] = useState("Todas");
  const [filtroTaller, setFiltroTaller] = useState("Todos");
  const [filtroEstado, setFiltroEstado] = useState("Pendientes / En proceso");

  // Modal de Detalle
  const [trabajoSeleccionado, setTrabajoSeleccionado] = useState(null);
  const [showModal, setShowModal] = useState(false);

  const cargarDatos = () => {
    setCargando(true);
    Promise.all([
      fetch("/api/trabajos-tractor").then((r) => (r.ok ? r.json() : [])).catch(() => []),
      fetch("/api/tractores").then((r) => (r.ok ? r.json() : [])).catch(() => []),
      fetch("/api/trabajos-tractor/parados/ids").then((r) => (r.ok ? r.json() : [])).catch(() => []),
    ]).then(([trabs, tracs, paradosData]) => {
      setTrabajos(Array.isArray(trabs) ? trabs : []);
      setTractores(Array.isArray(tracs) ? tracs : []);
      setParadosIds(new Set(Array.isArray(paradosData) ? paradosData : []));
      setCargando(false);
    });
  };

  useEffect(() => {
    cargarDatos();
  }, [grupoId]);

  const getTractorInfo = (t) => {
    if (!t) return { cleanCC: "—", descripcion: "", grupoNum: 1, infoG: GRUPOS[1], tractorId: null };
    const rawCC = String(t.tractor?.cc || t.tractor || "—").replace(/^cc\s*/i, "").trim();
    const tracObj = tractores.find(
      (tr) =>
        String(tr.cc).replace(/^cc\s*/i, "").trim() === rawCC ||
        String(tr._id) === String(t.tractor?._id || t.tractor)
    );
    const grupoNum = tracObj?.gruppo || t.tractor?.gruppo || 1;
    const infoG = GRUPOS[grupoNum] || {
      label: `Grupo ${grupoNum}`,
      supervisor: tracObj?.supervisor || t.tractor?.supervisor || "—",
    };
    return {
      cleanCC: rawCC,
      descripcion: tracObj?.descripcion || t.tractor?.descripcion || "",
      grupoNum,
      infoG,
      tractorId: tracObj?._id || t.tractor?._id,
    };
  };

  // Un tractor esta parado si este trabajo lo dejo parado o si tiene alguna
  // parada abierta en otro trabajo (mismo criterio que la pantalla de grupos).
  const estaTractorParado = (t, tractorInfo) => {
    const id = tractorInfo?.tractorId ? String(tractorInfo.tractorId) : null;
    return Boolean(t.maquinaParada || (id && paradosIds.has(id)));
  };

  // Lista de tractores (CC) para el filtro
  const listaTractores = useMemo(() => {
    const setCC = new Set();
    const tracsFiltrados = esModoGrupo
      ? tractores.filter((t) => Number(t.gruppo) === Number(grupoId))
      : tractores;

    tracsFiltrados.forEach((t) => {
      if (t.cc) {
        const clean = String(t.cc).replace(/^cc\s*/i, "").trim();
        if (clean) setCC.add(clean);
      }
    });

    trabajos.forEach((t) => {
      const tractorInfo = getTractorInfo(t);
      if (esModoGrupo && Number(tractorInfo.grupoNum) !== Number(grupoId)) return;
      if (tractorInfo.cleanCC && tractorInfo.cleanCC !== "—") {
        setCC.add(tractorInfo.cleanCC);
      }
    });

    return Array.from(setCC)
      .sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" }))
      .map((clean) => ({ clean, label: `CC ${clean}` }));
  }, [tractores, trabajos, esModoGrupo, grupoId]);

  // Filtrado y Ordenamiento: Por Tractor (CC) y dentro de cada tractor por Fecha descendente
  const trabajosFiltrados = useMemo(() => {
    return trabajos
      .filter((t) => {
        const tractorInfo = getTractorInfo(t);

        // Si estamos en modo de un grupo específico, filtrar solo ese grupo
        if (esModoGrupo && Number(tractorInfo.grupoNum) !== Number(grupoId)) {
          return false;
        }

        // Filtro por Tractor
        if (filtroTractor !== "Todos") {
          if (tractorInfo.cleanCC !== filtroTractor) return false;
        }

        // Filtro por Estado
        if (filtroEstado === "Pendientes / En proceso" || filtroEstado === "Pendiente / En proceso") {
          const est = estadoNormalizado(t.estado);
          if (est !== "Pendiente" && est !== "En proceso") return false;
        } else if (filtroEstado !== "Todas") {
          const est = estadoNormalizado(t.estado);
          if (filtroEstado !== est) return false;
        }

        // Filtro por Categoría
        if (filtroCategoria !== "Todas") {
          const parte = t.parte || "Otros";
          if (parte !== filtroCategoria) return false;
        }

        // Filtro por Taller
        if (filtroTaller !== "Todos") {
          if (filtroTaller === "Taller Propio" && t.taller === "Tercero") return false;
          if (filtroTaller === "Tercero" && t.taller !== "Tercero") return false;
        }

        // Buscador por texto
        if (busqueda.trim()) {
          const q = busqueda.toLowerCase().trim();
          const enCC = tractorInfo.cleanCC.toLowerCase().includes(q) || `cc ${tractorInfo.cleanCC}`.toLowerCase().includes(q);
          const enDescTractor = (tractorInfo.descripcion || "").toLowerCase().includes(q);
          const enDiag = (t.diagnostico || "").toLowerCase().includes(q);
          const enRep = (t.reparacion || "").toLowerCase().includes(q);
          const enDesc = (t.descripcion || "").toLowerCase().includes(q);
          const enResp = (t.responsable || tractorInfo.infoG.supervisor || "").toLowerCase().includes(q);
          const enTaller = (t.nombreTaller || t.taller || "").toLowerCase().includes(q);
          const enParte = (t.parte || "").toLowerCase().includes(q);
          const enRepuestos = (t.repuestos || []).some((r) =>
            (r.repuesto || "").toLowerCase().includes(q) || (r.proveedor || "").toLowerCase().includes(q)
          );
          if (!enCC && !enDescTractor && !enDiag && !enRep && !enDesc && !enResp && !enTaller && !enParte && !enRepuestos) {
            return false;
          }
        }

        return true;
      })
      .sort((a, b) => {
        const tractorInfoA = getTractorInfo(a);
        const tractorInfoB = getTractorInfo(b);

        // Si estamos en modo global, primero ordenar por Grupo numérico si corresponde
        if (!esModoGrupo && tractorInfoA.grupoNum !== tractorInfoB.grupoNum) {
          return tractorInfoA.grupoNum - tractorInfoB.grupoNum;
        }

        // Ordenar por Tractor (CC natural / numérico)
        const comp = tractorInfoA.cleanCC.localeCompare(tractorInfoB.cleanCC, undefined, { numeric: true, sensitivity: "base" });
        if (comp !== 0) return comp;

        // Dentro de cada tractor, ordenar por Fecha descendente
        const fA = a.fecha ? new Date(a.fecha).getTime() : 0;
        const fB = b.fecha ? new Date(b.fecha).getTime() : 0;
        return fB - fA;
      });
  }, [trabajos, tractores, esModoGrupo, grupoId, filtroTractor, filtroEstado, filtroCategoria, filtroTaller, busqueda]);

  // Mapa de intercalación de 2 tonos para etiquetas por tractor
  const tractorColorMap = useMemo(() => {
    const map = new Map();
    let currentTone = 0;
    let lastCC = null;

    trabajosFiltrados.forEach((t) => {
      const cc = getTractorInfo(t).cleanCC;
      if (lastCC !== null && cc !== lastCC) {
        currentTone = (currentTone + 1) % 2;
      }
      if (!map.has(cc)) {
        map.set(cc, currentTone);
      }
      lastCC = cc;
    });
    return map;
  }, [trabajosFiltrados]);

  const abrirDetalle = (t) => {
    setTrabajoSeleccionado(t);
    setShowModal(true);
  };

  // Eliminar trabajo
  const handleEliminarTrabajo = async (trabajoId) => {
    const result = await Swal.fire({
      title: "¿Eliminar registro?",
      text: "Esta acción no se puede deshacer.",
      icon: "warning",
      width: "320px",
      showCancelButton: true,
      confirmButtonColor: "#ef4444",
      cancelButtonColor: "#64748b",
      confirmButtonText: "Sí, borrar",
      cancelButtonText: "Cancelar",
    });

    if (!result.isConfirmed) return;

    try {
      const res = await fetch(`/api/trabajos-tractor/${trabajoId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        Swal.fire({
          icon: "success",
          title: "Registro eliminado",
          width: "300px",
          timer: 1400,
          showConfirmButton: false,
        });
        cargarDatos();
      } else {
        Swal.fire({
          icon: "error",
          title: "Error",
          text: "No se pudo eliminar el registro.",
          width: "300px",
          confirmButtonColor: "#1e293b",
        });
      }
    } catch {
      Swal.fire({
        icon: "error",
        title: "Error",
        text: "Error de conexión con el servidor.",
        width: "300px",
        confirmButtonColor: "#1e293b",
      });
    }
  };

  // Exportar Excel
  const exportarExcel = async () => {
    const wb = await nuevoWorkbook();
    const ws = wb.addWorksheet("Planilla General Reparaciones");

    const titulo = esModoGrupo
      ? `PLANILLA DE REPARACIONES - ${infoGrupo.label.toUpperCase()} (${infoGrupo.supervisor.toUpperCase()})`
      : "PLANILLA GENERAL DE REPARACIONES - MAQUINARIA Y TRACTORES";
    const fechaHoy = formatF(new Date().toISOString());

    const columnas = esModoGrupo
      ? [
          "Tractor",
          "Descripción",
          "Fecha",
          "Horómetro",
          "Categoría",
          "Diagnóstico",
          "Reparación",
          "Estado",
          "Taller",
          "Responsable",
          "Repuestos Utilizados",
          "Observaciones",
        ]
      : [
          "Tractor",
          "Descripción",
          "Grupo / Supervisor",
          "Fecha",
          "Horómetro",
          "Categoría",
          "Diagnóstico",
          "Reparación",
          "Estado",
          "Taller",
          "Responsable",
          "Repuestos Utilizados",
          "Observaciones",
        ];

    ws.mergeCells(1, 1, 1, columnas.length);
    const celdaTitulo = ws.getCell("A1");
    celdaTitulo.value = titulo;
    celdaTitulo.font = { bold: true, size: 14, color: { argb: "FF000000" } };
    celdaTitulo.alignment = { horizontal: "center", vertical: "middle" };
    ws.getRow(1).height = 28;

    ws.mergeCells(2, 1, 2, 4);
    const celdaFecha = ws.getCell("A2");
    celdaFecha.value = `Fecha: ${fechaHoy}`;
    celdaFecha.font = { bold: true, size: 11, color: { argb: "FF000000" } };
    celdaFecha.alignment = { horizontal: "left", vertical: "middle" };
    ws.getRow(2).height = 18;

    ws.addRow([]);

    const filaEnc = ws.addRow(columnas);
    filaEnc.eachCell((cell) => {
      cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
      cell.alignment = { horizontal: "center", vertical: "middle" };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1E293B" } };
      cell.border = {
        top: { style: "thin", color: { argb: "FFA0A0A0" } },
        left: { style: "thin", color: { argb: "FFA0A0A0" } },
        bottom: { style: "medium", color: { argb: "FF808080" } },
        right: { style: "thin", color: { argb: "FFA0A0A0" } },
      };
    });
    ws.getRow(4).height = 20;

    trabajosFiltrados.forEach((t, idx) => {
      const proxTrabajo = trabajosFiltrados[idx + 1];
      const tractorInfo = getTractorInfo(t);
      const ccActual = tractorInfo.cleanCC;
      const ccProx = proxTrabajo ? getTractorInfo(proxTrabajo).cleanCC : null;
      const esCambioTractor = !proxTrabajo || (ccActual !== ccProx);

      const repList = (t.repuestos || [])
        .map((r) => `${r.repuesto || "Repuesto"} (x${r.cantidad || 1}) - ${pesos(r.precio)}`)
        .join(", ");

      const tallerStr =
        t.taller === "Tercero" ? `Tercero: ${t.nombreTaller || "Externo"}` : t.taller || "Taller Propio";

      const valoresFila = esModoGrupo
        ? [
            `CC ${ccActual}`,
            tractorInfo.descripcion || "-",
            formatF(t.fecha),
            t.horometro ? `${t.horometro} hs` : "-",
            t.parte || "Mecánica general",
            t.diagnostico || t.descripcion || "-",
            t.reparacion || t.descripcion || "-",
            estadoNormalizado(t.estado),
            tallerStr,
            t.responsable || infoGrupo.supervisor || "-",
            repList || "-",
            t.observaciones || "-",
          ]
        : [
            `CC ${ccActual}`,
            tractorInfo.descripcion || "-",
            `${tractorInfo.infoG.label} (${tractorInfo.infoG.supervisor})`,
            formatF(t.fecha),
            t.horometro ? `${t.horometro} hs` : "-",
            t.parte || "Mecánica general",
            t.diagnostico || t.descripcion || "-",
            t.reparacion || t.descripcion || "-",
            estadoNormalizado(t.estado),
            tallerStr,
            t.responsable || tractorInfo.infoG.supervisor || "-",
            repList || "-",
            t.observaciones || "-",
          ];

      const fila = ws.addRow(valoresFila);

      const bottomBorder = esCambioTractor
        ? { style: "medium", color: { argb: "FF1E293B" } }
        : { style: "thin", color: { argb: "FFE2E8F0" } };

      const colIndicesTexto = esModoGrupo ? [6, 7, 11, 12] : [7, 8, 12, 13];

      fila.eachCell({ includeEmpty: true }, (cell, colNumber) => {
        cell.border = {
          top: { style: "thin", color: { argb: "FFE2E8F0" } },
          left: { style: "thin", color: { argb: "FFE2E8F0" } },
          bottom: bottomBorder,
          right: { style: "thin", color: { argb: "FFE2E8F0" } },
        };
        if (Boolean(t.maquinaParada)) {
          cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFEE2E2" } };
        }
        // El CC de un tractor parado va en rojo, igual que en pantalla.
        if (colNumber === 1 && estaTractorParado(t, tractorInfo)) {
          cell.font = { bold: true, color: { argb: "FF991B1B" } };
        }
        if (colIndicesTexto.includes(colNumber)) {
          cell.alignment = { horizontal: "left", vertical: "middle", wrapText: true };
        } else {
          cell.alignment = { horizontal: "center", vertical: "middle" };
        }
      });
    });

    ws.columns = esModoGrupo
      ? [
          { width: 14 }, // Tractor CC
          { width: 25 }, // Descripción
          { width: 14 }, // Fecha
          { width: 14 }, // Horómetro
          { width: 20 }, // Categoría
          { width: 35 }, // Diagnóstico
          { width: 35 }, // Reparación
          { width: 14 }, // Estado
          { width: 24 }, // Taller
          { width: 20 }, // Responsable
          { width: 35 }, // Repuestos
          { width: 30 }, // Observaciones
        ]
      : [
          { width: 14 }, // Tractor CC
          { width: 22 }, // Descripción
          { width: 25 }, // Grupo / Supervisor
          { width: 14 }, // Fecha
          { width: 14 }, // Horómetro
          { width: 20 }, // Categoría
          { width: 35 }, // Diagnóstico
          { width: 35 }, // Reparación
          { width: 14 }, // Estado
          { width: 24 }, // Taller
          { width: 20 }, // Responsable
          { width: 35 }, // Repuestos
          { width: 30 }, // Observaciones
        ];

    const buffer = await wb.xlsx.writeBuffer();
    const blob = new Blob([buffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const nombreArchivo = esModoGrupo
      ? `Planilla_Reparaciones_${infoGrupo.label.replace(/\s+/g, "_")}_${fechaHoy.replace(/\//g, "-")}.xlsx`
      : `Planilla_Reparaciones_General_Tractores_${fechaHoy.replace(/\//g, "-")}.xlsx`;
    a.download = nombreArchivo;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div
      style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        backgroundColor: "#f8f9fa",
        minHeight: "100%",
        overflowY: "auto",
      }}
    >
      {/* Barra de Cabecera Institucional Fuera de la Tabla */}
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
            <i className="bi bi-table"></i>
          </div>
          <div className="d-flex align-items-center gap-2">
            <span className="text-white fs-6">
              {esModoGrupo ? "Planilla de Reparaciones" : "Planilla General de Reparaciones"}
            </span>
            <span className="text-light opacity-75 small">•</span>
            {esModoGrupo ? (
              <>
                <span
                  className="badge px-3 py-1 fw-bold text-white shadow-sm"
                  style={{
                    backgroundColor: "#0f172a",
                    border: "1px solid #475569",
                    fontSize: "0.92rem",
                    letterSpacing: "0.5px",
                    borderRadius: "8px",
                  }}
                >
                  {infoGrupo.label}
                </span>
                <span className="text-light opacity-75 small">• Supervisor: {infoGrupo.supervisor}</span>
              </>
            ) : (
              <span className="text-light opacity-75 small">Todos los Tractores</span>
            )}
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
          {esModoGrupo ? (
            <button
              onClick={() => navigate(`/tractores/grupo/${grupoId}`)}
              className="btn btn-sm btn-outline-light d-flex align-items-center gap-2 rounded-3 px-3 py-1"
              style={{ fontSize: "0.82rem" }}
            >
              <i className="bi bi-grid-fill"></i>
              <span>{infoGrupo.label}</span>
            </button>
          ) : null}
          <button
            onClick={() => navigate("/tractores/reparaciones")}
            className="btn btn-sm btn-outline-light d-flex align-items-center gap-2 rounded-3 px-3 py-1"
            style={{ fontSize: "0.82rem" }}
          >
            <TractorIcon size="1.05rem" color="#fff" />
            <span>Reparaciones</span>
          </button>
          <button
            onClick={() => navigate("/tractores")}
            className="btn btn-sm btn-outline-light d-flex align-items-center gap-2 rounded-3 px-3 py-1"
            style={{ fontSize: "0.82rem" }}
          >
            <i className="bi bi-grid-fill"></i>
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

      <Container fluid className="px-4 py-3">
        {/* Fila Superior: Título Centrado en la Página y Botón Excel a la derecha */}
        <div className="position-relative d-flex align-items-center justify-content-center mb-3">
          <div className="text-center">
            {esModoGrupo ? (
              <div className="d-flex align-items-center justify-content-center gap-2">
                <h5 className="fw-bold text-dark mb-0 fs-5">{infoGrupo.label}</h5>
                <span className="text-muted small">• Supervisor: {infoGrupo.supervisor}</span>
              </div>
            ) : (
              <div className="d-flex align-items-center justify-content-center gap-2">
                <h5 className="fw-bold text-dark mb-0 fs-5">Planilla General — Todos los Grupos</h5>
                <span className="text-muted small">• Maquinaria Completa</span>
              </div>
            )}
          </div>

          <div className="position-absolute end-0">
            <Button
              variant="success"
              size="sm"
              onClick={exportarExcel}
              disabled={trabajosFiltrados.length === 0}
              className="d-inline-flex align-items-center gap-1.5 rounded-3 px-3 py-1.5 shadow-sm"
              style={{ fontSize: "0.82rem", backgroundColor: "#15803d", borderColor: "#15803d" }}
              title="Exportar a Excel"
            >
              <i className="bi bi-file-earmark-excel-fill"></i>
              <span>Excel</span>
            </Button>
          </div>
        </div>

        {/* Barra de Filtros */}
        <Card
          className="shadow-sm border-0 rounded-3 px-3 py-2 bg-white"
          style={{ marginBottom: "18px" }}
        >
          <div className="d-flex align-items-center justify-content-between w-100 flex-nowrap gap-3">
            {/* Buscador de Texto */}
            <div style={{ width: "260px" }}>
              <div className="input-group input-group-sm">
                <span
                  className="input-group-text bg-light border-end-0 text-muted"
                  style={{ padding: "3px 9px", height: "32px" }}
                >
                  <i className="bi bi-search" style={{ fontSize: "0.8rem" }}></i>
                </span>
                <Form.Control
                  type="text"
                  placeholder="Buscar tractor, falla, taller..."
                  value={busqueda}
                  onChange={(e) => setBusqueda(e.target.value)}
                  className={`border-start-0 ps-0 ${busqueda ? "fw-bold filtro-activo" : ""}`}
                  style={{
                    fontSize: "0.82rem",
                    height: "32px",
                    padding: "3px 8px",
                    color: busqueda ? "#dc2626" : "#1e293b",
                    fontWeight: busqueda ? "700" : "normal",
                  }}
                />
                {busqueda && (
                  <button
                    className="btn btn-outline-secondary border-start-0 d-flex align-items-center justify-content-center"
                    type="button"
                    onClick={() => setBusqueda("")}
                    title="Limpiar búsqueda"
                    style={{ padding: "0 7px", height: "32px" }}
                  >
                    <i className="bi bi-x" style={{ fontSize: "0.9rem" }}></i>
                  </button>
                )}
              </div>
            </div>

            {/* Filtro por Tractor (CC) */}
            <div className="d-flex align-items-center gap-2">
              <span
                className="fw-bold text-dark small flex-shrink-0 me-1"
                style={{ fontSize: "0.8rem", letterSpacing: "0.1px" }}
              >
                Tractor:
              </span>
              <div className="input-group input-group-sm" style={{ width: "165px" }}>
                <Form.Select
                  size="sm"
                  value={filtroTractor}
                  onChange={(e) => setFiltroTractor(e.target.value)}
                  className={`rounded-3 ${filtroTractor !== "Todos" ? "rounded-end-0 border-end-0 fw-bold filtro-activo" : ""}`}
                  style={{
                    fontSize: "0.82rem",
                    height: "32px",
                    padding: "3px 24px 3px 8px",
                    color: filtroTractor !== "Todos" ? "#dc2626" : "#1e293b",
                    fontWeight: filtroTractor !== "Todos" ? "700" : "normal",
                  }}
                >
                  <option value="Todos">Todos</option>
                  {listaTractores.map((trac) => (
                    <option key={trac.clean} value={trac.clean}>
                      {trac.label}
                    </option>
                  ))}
                </Form.Select>
                {filtroTractor !== "Todos" && (
                  <button
                    className="btn btn-outline-secondary border-start-0 d-flex align-items-center justify-content-center"
                    type="button"
                    onClick={() => setFiltroTractor("Todos")}
                    title="Limpiar filtro tractor"
                    style={{ padding: "0 6px", height: "32px" }}
                  >
                    <i className="bi bi-x" style={{ fontSize: "0.9rem" }}></i>
                  </button>
                )}
              </div>
            </div>

            {/* Filtro por Categoría */}
            <div className="d-flex align-items-center gap-2">
              <span
                className="fw-bold text-dark small flex-shrink-0 me-1"
                style={{ fontSize: "0.8rem", letterSpacing: "0.1px" }}
              >
                Categoría:
              </span>
              <div className="input-group input-group-sm" style={{ width: "175px" }}>
                <Form.Select
                  size="sm"
                  value={filtroCategoria}
                  onChange={(e) => setFiltroCategoria(e.target.value)}
                  className={`rounded-3 ${filtroCategoria !== "Todas" ? "rounded-end-0 border-end-0 fw-bold filtro-activo" : ""}`}
                  style={{
                    fontSize: "0.82rem",
                    height: "32px",
                    padding: "3px 24px 3px 8px",
                    color: filtroCategoria !== "Todas" ? "#dc2626" : "#1e293b",
                    fontWeight: filtroCategoria !== "Todas" ? "700" : "normal",
                  }}
                >
                  {CATEGORIAS.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </Form.Select>
                {filtroCategoria !== "Todas" && (
                  <button
                    className="btn btn-outline-secondary border-start-0 d-flex align-items-center justify-content-center"
                    type="button"
                    onClick={() => setFiltroCategoria("Todas")}
                    title="Limpiar filtro categoría"
                    style={{ padding: "0 6px", height: "32px" }}
                  >
                    <i className="bi bi-x" style={{ fontSize: "0.9rem" }}></i>
                  </button>
                )}
              </div>
            </div>

            {/* Filtro por Taller */}
            <div className="d-flex align-items-center gap-2">
              <span
                className="fw-bold text-dark small flex-shrink-0 me-1"
                style={{ fontSize: "0.8rem", letterSpacing: "0.1px" }}
              >
                Taller:
              </span>
              <div className="input-group input-group-sm" style={{ width: "155px" }}>
                <Form.Select
                  size="sm"
                  value={filtroTaller}
                  onChange={(e) => setFiltroTaller(e.target.value)}
                  className={`rounded-3 ${filtroTaller !== "Todos" ? "rounded-end-0 border-end-0 fw-bold filtro-activo" : ""}`}
                  style={{
                    fontSize: "0.82rem",
                    height: "32px",
                    padding: "3px 24px 3px 8px",
                    color: filtroTaller !== "Todos" ? "#dc2626" : "#1e293b",
                    fontWeight: filtroTaller !== "Todos" ? "700" : "normal",
                  }}
                >
                  <option value="Todos">Todos</option>
                  <option value="Taller Propio">Taller Propio</option>
                  <option value="Tercero">Tercero</option>
                </Form.Select>
                {filtroTaller !== "Todos" && (
                  <button
                    className="btn btn-outline-secondary border-start-0 d-flex align-items-center justify-content-center"
                    type="button"
                    onClick={() => setFiltroTaller("Todos")}
                    title="Limpiar filtro taller"
                    style={{ padding: "0 6px", height: "32px" }}
                  >
                    <i className="bi bi-x" style={{ fontSize: "0.9rem" }}></i>
                  </button>
                )}
              </div>
            </div>

            {/* Filtro por Estado */}
            <div className="d-flex align-items-center gap-2">
              <span
                className="fw-bold text-dark small flex-shrink-0 me-1"
                style={{ fontSize: "0.8rem", letterSpacing: "0.1px" }}
              >
                Estado:
              </span>
              <div className="input-group input-group-sm" style={{ width: "205px" }}>
                <Form.Select
                  size="sm"
                  value={filtroEstado}
                  onChange={(e) => setFiltroEstado(e.target.value)}
                  className={`rounded-3 ${filtroEstado !== "Todas" ? "rounded-end-0 border-end-0 fw-bold filtro-activo" : ""}`}
                  style={{
                    fontSize: "0.82rem",
                    height: "32px",
                    padding: "3px 24px 3px 8px",
                    color: filtroEstado !== "Todas" ? "#dc2626" : "#1e293b",
                    fontWeight: filtroEstado !== "Todas" ? "700" : "normal",
                  }}
                >
                  <option value="Pendientes / En proceso">Pendientes / En proceso</option>
                  <option value="Todas">Todas</option>
                  <option value="Pendiente">Pendiente</option>
                  <option value="En proceso">En proceso</option>
                  <option value="Terminada">Terminada</option>
                </Form.Select>
                {filtroEstado !== "Todas" && (
                  <button
                    className="btn btn-outline-secondary border-start-0 d-flex align-items-center justify-content-center"
                    type="button"
                    onClick={() => setFiltroEstado("Todas")}
                    title="Limpiar filtro estado"
                    style={{ padding: "0 6px", height: "32px" }}
                  >
                    <i className="bi bi-x" style={{ fontSize: "0.9rem" }}></i>
                  </button>
                )}
              </div>
            </div>
          </div>
        </Card>

        {/* Estilos CSS para separación de tractores y hover */}
        <style>{`
          .tabla-general-reparaciones {
            width: 100%;
            border-collapse: collapse !important;
          }
          .tabla-general-reparaciones th {
            border: none !important;
            border-bottom: 2px solid #0f172a !important;
          }
          .tabla-general-reparaciones tr.fila-mismo-tractor td {
            border-bottom: 1px solid #e2e8f0 !important;
            border-top: none !important;
          }
          .tabla-general-reparaciones tr.fila-cambio-tractor td {
            border-bottom: 3px solid #1e293b !important;
            border-top: none !important;
          }
          .tabla-general-reparaciones tr.fila-critica td,
          .tabla-general-reparaciones tr.fila-critica td div,
          .tabla-general-reparaciones tr.fila-critica td span:not(.badge) {
            color: #dc2626 !important;
          }
          .tabla-general-reparaciones tbody tr:hover {
            background-color: #f1f5f9 !important;
          }
        `}</style>

        {/* Contenedor de la Tabla */}
        <div
          className="shadow-sm bg-white"
          style={{
            borderRadius: "10px",
            border: "1px solid #cbd5e1",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              maxHeight: "calc(100vh - 230px)",
              minHeight: "300px",
              overflowY: "auto",
              overflowX: "auto",
            }}
          >
            <table
              className="tabla-general-reparaciones align-middle mb-0"
              style={{
                fontSize: "0.81rem",
              }}
            >
              <thead
                style={{
                  position: "sticky",
                  top: 0,
                  zIndex: 2,
                }}
              >
                <tr className="align-middle">
                  <th
                    style={{
                      width: "115px",
                      padding: "8px 10px",
                      backgroundColor: "#1e293b",
                      color: "#ffffff",
                      fontWeight: "normal",
                      textAlign: "center",
                      fontSize: "0.8rem",
                    }}
                  >
                    Tractor
                  </th>
                  <th
                    style={{
                      width: "95px",
                      padding: "8px 10px",
                      backgroundColor: "#1e293b",
                      color: "#ffffff",
                      fontWeight: "normal",
                      textAlign: "center",
                      fontSize: "0.8rem",
                    }}
                  >
                    Fecha
                  </th>
                  <th
                    style={{
                      width: "145px",
                      padding: "8px 10px",
                      backgroundColor: "#1e293b",
                      color: "#ffffff",
                      fontWeight: "normal",
                      textAlign: "center",
                      fontSize: "0.8rem",
                    }}
                  >
                    Categoría
                  </th>
                  <th
                    style={{
                      width: "100px",
                      padding: "8px 10px",
                      backgroundColor: "#1e293b",
                      color: "#ffffff",
                      fontWeight: "normal",
                      textAlign: "center",
                      fontSize: "0.8rem",
                    }}
                  >
                    Urgencia
                  </th>
                  <th
                    style={{
                      minWidth: "210px",
                      padding: "8px 10px",
                      backgroundColor: "#1e293b",
                      color: "#ffffff",
                      fontWeight: "normal",
                      textAlign: "center",
                      fontSize: "0.8rem",
                    }}
                  >
                    Diagnóstico
                  </th>
                  <th
                    style={{
                      minWidth: "220px",
                      padding: "8px 10px",
                      backgroundColor: "#1e293b",
                      color: "#ffffff",
                      fontWeight: "normal",
                      textAlign: "center",
                      fontSize: "0.8rem",
                    }}
                  >
                    Reparación
                  </th>
                  <th
                    style={{
                      width: "135px",
                      padding: "8px 10px",
                      backgroundColor: "#1e293b",
                      color: "#ffffff",
                      fontWeight: "normal",
                      textAlign: "center",
                      fontSize: "0.8rem",
                    }}
                  >
                    Taller
                  </th>
                  <th
                    style={{
                      width: "105px",
                      padding: "8px 10px",
                      backgroundColor: "#1e293b",
                      color: "#ffffff",
                      fontWeight: "normal",
                      textAlign: "center",
                      fontSize: "0.8rem",
                    }}
                  >
                    Repuestos
                  </th>
                  <th
                    style={{
                      width: "105px",
                      padding: "8px 10px",
                      textAlign: "center",
                      backgroundColor: "#1e293b",
                      color: "#ffffff",
                      fontWeight: "normal",
                      fontSize: "0.8rem",
                    }}
                  >
                    Estado
                  </th>
                  <th
                    style={{
                      width: "125px",
                      padding: "8px 10px",
                      backgroundColor: "#1e293b",
                      color: "#ffffff",
                      fontWeight: "normal",
                      textAlign: "center",
                      fontSize: "0.8rem",
                    }}
                  >
                    Responsable
                  </th>
                  <th
                    style={{
                      width: "60px",
                      padding: "8px 6px",
                      textAlign: "center",
                      backgroundColor: "#1e293b",
                      color: "#ffffff",
                      fontWeight: "normal",
                      fontSize: "0.8rem",
                    }}
                  >
                    Acción
                  </th>
                </tr>
              </thead>
              <tbody>
                {cargando ? (
                  <tr>
                    <td colSpan={11} className="text-center py-4 text-muted">
                      <div className="spinner-border spinner-border-sm text-primary me-2" role="status"></div>
                      Cargando planilla de reparaciones...
                    </td>
                  </tr>
                ) : trabajosFiltrados.length === 0 ? (
                  <tr>
                    <td colSpan={11} className="text-center py-4 text-muted">
                      <i className="bi bi-inbox fs-2 d-block mb-2 text-secondary opacity-50"></i>
                      No se encontraron reparaciones registradas con los filtros seleccionados.
                    </td>
                  </tr>
                ) : (
                  trabajosFiltrados.map((t, idx) => {
                    const estiloCat = CATEGORIA_COLORES[t.parte] || CATEGORIA_COLORES["Otros"];
                    const urg = urgenciaNormalizada(t);
                    const estiloUrg = URGENCIA_ESTILOS[urg];
                    const esCritica = urg === "alta";
                    const est = estadoNormalizado(t.estado);
                    const esTerminada = est === "Terminada";
                    const esEnProceso = est === "En proceso";
                    const tractorInfo = getTractorInfo(t);

                    // Detectar si la siguiente fila pertenece a un tractor diferente
                    const proxTrabajo = trabajosFiltrados[idx + 1];
                    const ccActual = tractorInfo.cleanCC;
                    const ccProx = proxTrabajo ? getTractorInfo(proxTrabajo).cleanCC : null;
                    const esCambioTractor = !proxTrabajo || (ccActual !== ccProx);

                    // 2 tonos intercalados de fondo de badge según tractor.
                    // Un tractor parado se marca con el CC en rojo.
                    const tonoIndex = tractorColorMap.get(ccActual) ?? 0;
                    const tractorParado = estaTractorParado(t, tractorInfo);
                    const bgBadge = tractorParado
                      ? "#991b1b"
                      : tonoIndex === 0
                      ? "#1e293b"
                      : "#475569";
                    const borderBadge = tractorParado
                      ? "#7f1d1d"
                      : tonoIndex === 0
                      ? "#0f172a"
                      : "#334155";

                    return (
                      <tr
                        key={t._id}
                        className={`${esCambioTractor ? "fila-cambio-tractor" : "fila-mismo-tractor"} ${Boolean(t.maquinaParada) ? "tr-parada" : ""} ${esCritica ? "fila-critica" : ""}`}
                        style={{
                          backgroundColor: Boolean(t.maquinaParada) ? "#fee2e2" : undefined,
                        }}
                      >
                        {/* Tractor / CC */}
                        <td className="text-center" style={{ padding: "4px 8px" }}>
                          <span
                            className="badge px-2 py-0.5 fw-bold text-white shadow-sm"
                            style={{
                              backgroundColor: bgBadge,
                              border: `1px solid ${borderBadge}`,
                              fontSize: "0.74rem",
                              cursor: tractorInfo.tractorId ? "pointer" : "default",
                              letterSpacing: "0.4px",
                            }}
                            onClick={() => {
                              if (tractorInfo.tractorId) {
                                navigate(`/tractores/grupo/${tractorInfo.grupoNum}/reparaciones/${tractorInfo.tractorId}`, {
                                  state: { cc: `CC ${tractorInfo.cleanCC}`, descripcion: tractorInfo.descripcion },
                                });
                              }
                            }}
                            title="Ir al menú de reparaciones de este tractor"
                          >
                            CC {tractorInfo.cleanCC}
                          </span>
                          {tractorInfo.descripcion && (
                            <div
                              className="text-muted text-truncate"
                              style={{
                                fontSize: "0.62rem",
                                lineHeight: "1.1",
                                marginTop: "2px",
                                maxWidth: "100px",
                                marginInline: "auto",
                              }}
                              title={tractorInfo.descripcion}
                            >
                              {tractorInfo.descripcion}
                            </div>
                          )}
                        </td>

                        {/* Fecha */}
                        <td
                          className="fw-semibold text-dark text-center"
                          style={{ padding: "4px 8px", fontSize: "0.78rem" }}
                        >
                          {formatF(t.fecha)}
                        </td>

                        {/* Categoría */}
                        <td className="text-center" style={{ padding: "4px 8px" }}>
                          <span
                            className="badge fw-medium px-2 py-0.5"
                            style={{
                              backgroundColor: estiloCat.bg,
                              color: estiloCat.text,
                              border: `1px solid ${estiloCat.border}`,
                              fontSize: "0.72rem",
                              borderRadius: "5px",
                            }}
                          >
                            {t.parte || "Mecánica general"}
                          </span>
                        </td>

                        {/* Urgencia */}
                        <td className="text-center" style={{ padding: "4px 8px" }}>
                          <span
                            className="badge fw-semibold px-2 py-0.5"
                            style={{
                              backgroundColor: estiloUrg.bg,
                              color: estiloUrg.text,
                              border: `1px solid ${estiloUrg.border}`,
                              fontSize: "0.72rem",
                              borderRadius: "5px",
                            }}
                          >
                            {estiloUrg.label}
                          </span>
                        </td>

                        {/* Diagnóstico (clicable para ver detalle) */}
                        <td style={{ padding: "4px 8px" }}>
                          <div
                            className="fw-medium text-dark text-truncate"
                            style={{ maxWidth: "230px", cursor: "pointer" }}
                            title={t.diagnostico || t.descripcion || "—"}
                            onClick={() => abrirDetalle(t)}
                          >
                            {t.diagnostico || t.descripcion || "—"}
                          </div>
                          {t.maquinaParada && (
                            <span
                              className="badge bg-danger-subtle text-danger border border-danger-subtle px-1 py-0 mt-0.5"
                              style={{ fontSize: "0.64rem" }}
                            >
                              <i className="bi bi-exclamation-triangle-fill me-1"></i>Parada
                            </span>
                          )}
                        </td>

                        {/* Reparación Realizada */}
                        <td style={{ padding: "4px 8px" }}>
                          <div
                            className="text-secondary text-truncate"
                            style={{ maxWidth: "240px", cursor: "pointer" }}
                            title={t.reparacion || t.descripcion || "—"}
                            onClick={() => abrirDetalle(t)}
                          >
                            {t.reparacion || t.descripcion || <span className="text-muted fst-italic">Sin detalle de avance</span>}
                          </div>
                        </td>

                        {/* Taller */}
                        <td className="text-center" style={{ padding: "4px 8px" }}>
                          {t.taller === "Tercero" ? (
                            <span
                              className="badge px-1.5 py-0.5 fw-medium"
                              style={{
                                backgroundColor: "#fed7aa",
                                color: "#9a3412",
                                border: "1px solid #f97316",
                                fontSize: "0.71rem",
                              }}
                            >
                              <i className="bi bi-building me-1"></i>
                              {t.nombreTaller || "Tercero"}
                            </span>
                          ) : (
                            <span
                              className="badge px-1.5 py-0.5 fw-medium"
                              style={{
                                backgroundColor: "#f0fdf4",
                                color: "#166534",
                                border: "1px solid #bbf7d0",
                                fontSize: "0.71rem",
                              }}
                            >
                              <i className="bi bi-wrench me-1"></i>T. Propio
                            </span>
                          )}
                        </td>

                        {/* Repuestos */}
                        <td className="text-center" style={{ padding: "4px 8px" }}>
                          {t.repuestos && t.repuestos.length > 0 ? (
                            <span
                              className="badge bg-primary-subtle text-primary border border-primary-subtle px-1.5 py-0.5 cursor-pointer"
                              style={{ fontSize: "0.71rem", cursor: "pointer" }}
                              onClick={() => abrirDetalle(t)}
                              title="Ver repuestos utilizados"
                            >
                              <i className="bi bi-box-seam me-1"></i>
                              {t.repuestos.length}
                            </span>
                          ) : (
                            <span className="text-muted small fst-italic">—</span>
                          )}
                        </td>

                        {/* Estado */}
                        <td className="text-center" style={{ padding: "4px 8px" }}>
                          <span
                            className="badge px-1.5 py-0.5 fw-semibold"
                            style={{
                              backgroundColor: esTerminada ? "#dcfce7" : esEnProceso ? "#fef3c7" : "#fee2e2",
                              color: esTerminada ? "#15803d" : esEnProceso ? "#b45309" : "#b91c1c",
                              border: `1px solid ${
                                esTerminada ? "#86efac" : esEnProceso ? "#fde047" : "#fca5a5"
                              }`,
                              fontSize: "0.72rem",
                              borderRadius: "4px",
                            }}
                          >
                            {esTerminada ? "Terminada" : esEnProceso ? "En proceso" : "Pendiente"}
                          </span>
                        </td>

                        {/* Responsable */}
                        <td className="text-center" style={{ padding: "4px 8px", fontSize: "0.76rem" }}>
                          <span className="text-dark fw-medium" title={t.responsable || tractorInfo.infoG.supervisor || "—"}>
                            {t.responsable || tractorInfo.infoG.supervisor || "—"}
                          </span>
                        </td>

                        {/* Acción */}
                        <td className="text-center" style={{ padding: "4px 6px" }}>
                          <div className="d-inline-flex align-items-center gap-1">
                            <Button
                              variant="outline-dark"
                              size="sm"
                              className="p-0 d-inline-flex align-items-center justify-content-center rounded-2"
                              style={{ width: "22px", height: "22px", fontSize: "0.72rem" }}
                              onClick={() => abrirDetalle(t)}
                              title="Ver ficha completa"
                            >
                              <i className="bi bi-eye"></i>
                            </Button>
                            <Button
                              variant="outline-danger"
                              size="sm"
                              className="p-0 d-inline-flex align-items-center justify-content-center rounded-2"
                              style={{ width: "22px", height: "22px", fontSize: "0.72rem" }}
                              onClick={() => handleEliminarTrabajo(t._id)}
                              title="Eliminar trabajo"
                            >
                              <i className="bi bi-trash3-fill"></i>
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </Container>

      {/* Modal de Detalle Completo de la Reparación */}
      <Modal show={showModal} onHide={() => setShowModal(false)} size="lg" centered>
        {trabajoSeleccionado && (
          <>
            <Modal.Header
              closeButton
              closeVariant="white"
              data-bs-theme="dark"
              style={{ backgroundColor: "#1e293b", color: "#fff", borderBottom: "none" }}
            >
              <Modal.Title className="fs-6 d-flex align-items-center gap-2">
                <i className="bi bi-tools text-warning"></i>
                <span>
                  Ficha de Reparación - CC {getTractorInfo(trabajoSeleccionado).cleanCC} ({formatF(trabajoSeleccionado.fecha)})
                </span>
              </Modal.Title>
            </Modal.Header>

            <Modal.Body className="p-4 bg-light">
              {/* Tarjeta de Resumen Rápido */}
              <Card className="border-0 shadow-sm rounded-3 p-3 mb-3 bg-white">
                <Row className="g-3">
                  <Col sm={3}>
                    {(() => {
                      const info = getTractorInfo(trabajoSeleccionado);
                      return (
                        <>
                          <div className="text-muted small">Tractor</div>
                          <div className="fw-bold text-dark fs-6">
                            CC {info.cleanCC}
                          </div>
                          <div className="text-muted small">
                            {info.infoG.label} ({info.infoG.supervisor})
                          </div>
                          {info.descripcion && (
                            <div className="text-muted small">{info.descripcion}</div>
                          )}
                        </>
                      );
                    })()}
                  </Col>
                  <Col sm={2}>
                    <div className="text-muted small">Categoría</div>
                    <div>
                      <Badge
                        bg="light"
                        className="text-dark border"
                        style={{ fontSize: "0.8rem", fontWeight: "600" }}
                      >
                        {trabajoSeleccionado.parte || "Mecánica general"}
                      </Badge>
                    </div>
                  </Col>
                  <Col sm={2}>
                    <div className="text-muted small">Horómetro</div>
                    <div className="fw-semibold text-dark">
                      {trabajoSeleccionado.horometro ? `${trabajoSeleccionado.horometro} hs` : "—"}
                    </div>
                  </Col>
                  <Col sm={2}>
                    <div className="text-muted small">Estado</div>
                    <div>
                      <span
                        className="badge px-2 py-1 fw-semibold"
                        style={{
                          backgroundColor:
                            estadoNormalizado(trabajoSeleccionado.estado) === "Terminada"
                              ? "#d1fae5"
                              : estadoNormalizado(trabajoSeleccionado.estado) === "En proceso"
                              ? "#fef3c7"
                              : "#fee2e2",
                          color:
                            estadoNormalizado(trabajoSeleccionado.estado) === "Terminada"
                              ? "#065f46"
                              : estadoNormalizado(trabajoSeleccionado.estado) === "En proceso"
                              ? "#92400e"
                              : "#991b1b",
                          border: `1px solid ${
                            estadoNormalizado(trabajoSeleccionado.estado) === "Terminada"
                              ? "#a7f3d0"
                              : estadoNormalizado(trabajoSeleccionado.estado) === "En proceso"
                              ? "#fde68a"
                              : "#fca5a5"
                          }`,
                        }}
                      >
                        {estadoNormalizado(trabajoSeleccionado.estado)}
                      </span>
                    </div>
                  </Col>
                  <Col sm={3}>
                    <div className="text-muted small">Lugar / Taller</div>
                    <div className="fw-semibold text-dark">
                      {trabajoSeleccionado.taller === "Tercero"
                        ? `Tercero (${trabajoSeleccionado.nombreTaller || "Externo"})`
                        : "Taller Propio"}
                    </div>
                  </Col>
                </Row>
              </Card>

              {/* Diagnóstico */}
              <Card className="border-0 shadow-sm rounded-3 p-3 mb-3 bg-white">
                <div className="d-flex align-items-center justify-content-between mb-2">
                  <div className="fw-bold text-dark">
                    <i className="bi bi-clipboard2-pulse me-2 text-primary"></i>Diagnóstico Técnico
                  </div>
                  {trabajoSeleccionado.maquinaParada && (
                    <span className="badge bg-danger-subtle text-danger border border-danger-subtle px-2 py-1">
                      <i className="bi bi-exclamation-triangle-fill me-1"></i>Tractor Parado
                    </span>
                  )}
                </div>
                <div className="text-dark small" style={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
                  {trabajoSeleccionado.diagnostico || trabajoSeleccionado.descripcion || "Sin diagnóstico especificado."}
                </div>
              </Card>

              {/* Descripción de la Falla / Motivo Original (si difiere de diagnóstico y reparación) */}
              {trabajoSeleccionado.descripcion &&
                trabajoSeleccionado.descripcion.trim() !== (trabajoSeleccionado.diagnostico || "").trim() &&
                trabajoSeleccionado.descripcion.trim() !== (trabajoSeleccionado.reparacion || "").trim() && (
                  <Card className="border-0 shadow-sm rounded-3 p-3 mb-3 bg-white">
                    <div className="fw-bold text-dark mb-2">
                      <i className="bi bi-card-text me-2 text-primary"></i>Descripción de la Falla / Motivo Original
                    </div>
                    <div className="text-dark small" style={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
                      {trabajoSeleccionado.descripcion}
                    </div>
                  </Card>
              )}

              {/* Reparaciones Realizadas / Avance */}
              <Card className="border-0 shadow-sm rounded-3 p-3 mb-3 bg-white">
                <div className="fw-bold text-dark mb-2">
                  <i className="bi bi-check2-square me-2 text-success"></i>Detalle de Reparación Realizada / Avance
                </div>
                <div className="text-dark small" style={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
                  {trabajoSeleccionado.reparacion || trabajoSeleccionado.descripcion || <span className="text-muted fst-italic">Sin avance asentado.</span>}
                </div>
              </Card>

              {/* Repuestos e Insumos */}
              <Card className="border-0 shadow-sm rounded-3 p-3 mb-3 bg-white">
                <div className="d-flex align-items-center justify-content-between mb-2">
                  <div className="fw-bold text-dark">
                    <i className="bi bi-box-seam me-2 text-warning"></i>Repuestos Utilizados
                  </div>
                  {trabajoSeleccionado.repuestos?.length > 0 && (
                    <span className="text-muted small">
                      {trabajoSeleccionado.repuestos.length} {trabajoSeleccionado.repuestos.length === 1 ? "ítem" : "ítems"}
                    </span>
                  )}
                </div>

                {trabajoSeleccionado.repuestos && trabajoSeleccionado.repuestos.length > 0 ? (
                  <div className="table-responsive">
                    <Table size="sm" className="mb-0 align-middle" style={{ fontSize: "0.82rem" }}>
                      <thead className="table-light">
                        <tr>
                          <th>Repuesto</th>
                          <th className="text-center">Cant.</th>
                          <th className="text-end">Precio Unit.</th>
                          <th className="text-end">Subtotal</th>
                          <th>Proveedor</th>
                          <th className="text-center">Estado</th>
                          <th>Observaciones</th>
                        </tr>
                      </thead>
                      <tbody>
                        {trabajoSeleccionado.repuestos.map((r, rIdx) => (
                          <tr key={rIdx}>
                            <td className="fw-semibold">{r.repuesto || "Repuesto"}</td>
                            <td className="text-center">{r.cantidad || 1}</td>
                            <td className="text-end">{pesos(r.precio)}</td>
                            <td className="text-end fw-bold">{pesos((r.cantidad || 1) * (r.precio || 0))}</td>
                            <td>{r.proveedor || "—"}</td>
                            <td className="text-center">
                              <span className="badge bg-secondary-subtle text-dark border px-2 py-0.5">
                                {r.estado || "Colocado"}
                              </span>
                            </td>
                            <td className="text-muted">{r.observaciones || "—"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </Table>
                  </div>
                ) : (
                  <div className="text-muted small fst-italic">No se asociaron repuestos a este trabajo.</div>
                )}
              </Card>

              {/* Observaciones y Responsable */}
              {(trabajoSeleccionado.observaciones || trabajoSeleccionado.responsable || getTractorInfo(trabajoSeleccionado).infoG.supervisor) && (
                <Card className="border-0 shadow-sm rounded-3 p-3 bg-white">
                  <Row className="g-3">
                    {(trabajoSeleccionado.responsable || getTractorInfo(trabajoSeleccionado).infoG.supervisor) && (
                      <Col sm={6}>
                        <div className="text-muted small">Mecánico / Responsable de Ejecución</div>
                        <div className="fw-semibold text-dark">
                          {trabajoSeleccionado.responsable || getTractorInfo(trabajoSeleccionado).infoG.supervisor}
                        </div>
                      </Col>
                    )}
                    {trabajoSeleccionado.observaciones && (
                      <Col sm={6}>
                        <div className="text-muted small">Observaciones Adicionales</div>
                        <div className="text-dark small">{trabajoSeleccionado.observaciones}</div>
                      </Col>
                    )}
                  </Row>
                </Card>
              )}
            </Modal.Body>

            <Modal.Footer className="border-top-0 bg-white">
              <Button
                variant="outline-secondary"
                size="sm"
                className="rounded-3 px-3"
                onClick={() => setShowModal(false)}
              >
                Cerrar
              </Button>
            </Modal.Footer>
          </>
        )}
      </Modal>
    </div>
  );
}

export default ResumenReparacionesTractores;
