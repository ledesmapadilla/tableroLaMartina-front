import { useState, useRef, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Container } from "react-bootstrap";

import { getIntervalKm } from "../../utils/serviceHelpers";

const MESES = [
  "Enero",
  "Febrero",
  "Marzo",
  "Abril",
  "Mayo",
  "Junio",
  "Julio",
  "Agosto",
  "Septiembre",
  "Octubre",
  "Noviembre",
  "Diciembre",
];
const MES_CAMPO = ["enero", null, "marzo", null, "mayo", null, "julio", null, "septiembre", null, "noviembre", null];
const INICIO_ANIO = 2026;
const INICIO_MES = 5;

function ResumenCamionetas() {
  const navigate = useNavigate();
  const location = useLocation();
  const [anio, setAnio] = useState(() => Number(localStorage.getItem("tablero_anio")) || 2026);
  const [dropAnio, setDropAnio] = useState(false);
  const dropAnioRef = useRef(null);
  const aniosOpciones = Array.from({ length: 6 }, (_, i) => 2026 + i);

  const [programas, setProgramas] = useState([]);
  const [camionetas, setCamionetas] = useState([]);

  const [kmResumen, setKmResumen] = useState({});
  const [serviciosAtrasados, setServiciosAtrasados] = useState(null);
  const [unidadesParadas, setUnidadesParadas] = useState(null);
  const [tareasPendientes, setTareasPendientes] = useState(null);

  useEffect(() => {
    const handler = (e) => {
      if (dropAnioRef.current && !dropAnioRef.current.contains(e.target)) setDropAnio(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  useEffect(() => {
    setProgramas([]);
    setKmResumen({});
    setServiciosAtrasados(null);
    setUnidadesParadas(null);
    setTareasPendientes(null);
    Promise.all([
      fetch("/api/camionetas").then((r) => (r.ok ? r.json() : [])).catch(() => []),
      fetch("/api/services/ultimos").then((r) => (r.ok ? r.json() : [])).catch(() => []),
      fetch("/api/kilometros/ultimos").then((r) => (r.ok ? r.json() : [])).catch(() => []),
    ])
      .then(([camsList, ultimos, ultimosKm]) => {
        const safeCams = Array.isArray(camsList) ? camsList : [];
        const safeUltimos = Array.isArray(ultimos) ? ultimos : [];
        const safeUltimosKm = Array.isArray(ultimosKm) ? ultimosKm : [];
        setCamionetas(safeCams);
        const count = safeUltimosKm.filter((km) => {
          const camId = (km.camioneta?._id ?? km.camioneta)?.toString();
          const camObj = safeCams.find((c) => c._id?.toString() === camId);
          const srv = safeUltimos.find((u) => {
            const srvId = (u.camioneta?._id ?? u.camioneta)?.toString();
            return srvId === camId;
          });
          if (km.kms == null || srv?.kms == null) return false;
          const interval = getIntervalKm(camObj?.patente, srv.kms, km.kms);
          return km.kms - srv.kms >= interval;
        }).length;
        setServiciosAtrasados(count);
      })
      .catch(() => setServiciosAtrasados(0));

    fetch("/api/paradas/abiertas/count")
      .then((r) => (r.ok ? r.json() : { count: 0 }))
      .then((d) => setUnidadesParadas(d && typeof d.count === "number" ? d.count : 0))
      .catch(() => setUnidadesParadas(0));

    fetch("/api/trabajos-camioneta/pendientes/ids")
      .then((r) => (r.ok ? r.json() : []))
      .then((ids) => setTareasPendientes(Array.isArray(ids) ? ids.length : 0))
      .catch(() => setTareasPendientes(0));

    fetch(`/api/programa-checklist/${anio}`)
      .then((r) => (r.ok ? r.json() : []))
      .then((d) => setProgramas(Array.isArray(d) ? d : []))
      .catch(() => setProgramas([]));

    fetch("/api/kilometros")
      .then((r) => (r.ok ? r.json() : []))
      .then((kms) => {
        if (!Array.isArray(kms)) return;
        const res = {};
        kms.forEach((km) => {
          let mesReg, anioReg;
          if (km.mes != null && km.anio != null) {
            mesReg = km.mes;
            anioReg = km.anio;
          } else {
            const fecha = new Date(km.fecha);
            mesReg = fecha.getUTCMonth() + 1;
            anioReg = fecha.getUTCFullYear();
          }
          if (anioReg !== anio) return;
          const id = (km.camioneta?._id ?? km.camioneta)?.toString();
          if (!res[mesReg]) res[mesReg] = new Set();
          res[mesReg].add(id);
        });
        const resumen = {};
        Object.keys(res).forEach((m) => {
          resumen[m] = Array.from(res[m]);
        });
        setKmResumen(resumen);
      })
      .catch(() => setKmResumen({}));
  }, [anio, location.key]);

  const esAntesDeProgramar = (anioEval, mesEval) =>
    anioEval < INICIO_ANIO || (anioEval === INICIO_ANIO && mesEval < INICIO_MES);

  const getKmSinRelevar = (mesIndex) => {
    if (camionetas.length === 0) return null;
    const hoy = new Date();
    const anioActual = hoy.getFullYear();
    const mesActual = hoy.getMonth() + 1;
    const mesNumero = mesIndex + 1;
    if (anio > anioActual) return null;
    if (anio === anioActual && mesNumero > mesActual) return null;
    if (esAntesDeProgramar(anio, mesNumero)) return null;
    const idsConRegistro = new Set(kmResumen[mesNumero] ?? []);
    const conRegistroActivas = camionetas.filter((c) => idsConRegistro.has(c._id?.toString())).length;
    return camionetas.length - conRegistroActivas;
  };

  const getCheckListInfo = (mesIndex) => {
    const campo = MES_CAMPO[mesIndex];
    if (!campo || camionetas.length === 0) return null;
    const hoy = new Date();
    const anioActual = hoy.getFullYear();
    const mesActual = hoy.getMonth() + 1;
    const mesNumero = mesIndex + 1;
    if (anio > anioActual) return null;
    if (anio === anioActual && mesNumero > mesActual) return null;
    if (esAntesDeProgramar(anio, mesNumero)) return null;
    const realizados = camionetas.filter((c) => {
      const prog = programas.find((p) => (p.camioneta?._id ?? p.camioneta)?.toString() === c._id?.toString());
      return prog?.[campo]?.estado === "realizado";
    }).length;
    const pendientes = camionetas.length - realizados;
    return { pendientes };
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
        style={{ backgroundColor: "#1e293b", color: "#fff", height: "54px" }}
      >
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
            <span className="text-white fs-6">Tablero de Control — Camionetas</span>
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
      <Container
        fluid
        className="px-4 py-3 d-flex flex-column flex-grow-1"
        style={{ maxWidth: "1180px", width: "100%", margin: "0 auto", overflowY: "auto" }}
      >
        {/* Selector de Año */}
        <div className="d-flex justify-content-between align-items-center mb-3">
          <div ref={dropAnioRef} style={{ position: "relative" }}>
            <button
              onClick={() => setDropAnio((v) => !v)}
              className="btn btn-sm d-flex align-items-center gap-2 rounded-3 px-3 py-1.5 text-white shadow-sm"
              style={{
                backgroundColor: "#1e293b",
                border: "1px solid #475569",
                fontWeight: 600,
                fontSize: "0.88rem",
              }}
            >
              <i className="bi bi-calendar3"></i>
              <span>Año {anio}</span>
              <i className={`bi bi-chevron-${dropAnio ? "up" : "down"} small opacity-75`}></i>
            </button>
            {dropAnio && (
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
                {aniosOpciones.map((a) => (
                  <div
                    key={a}
                    onClick={() => {
                      setAnio(a);
                      localStorage.setItem("tablero_anio", a);
                      setDropAnio(false);
                    }}
                    style={{
                      padding: "8px 16px",
                      cursor: "pointer",
                      fontWeight: a === anio ? "700" : "400",
                      backgroundColor: a === anio ? "#f1f5f9" : "transparent",
                      color: a === anio ? "#1e293b" : "#334155",
                      fontSize: "0.88rem",
                    }}
                    onMouseEnter={(e) => {
                      if (a !== anio) e.currentTarget.style.backgroundColor = "#f8fafc";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = a === anio ? "#f1f5f9" : "transparent";
                    }}
                  >
                    {a}
                  </div>
                ))}
              </div>
            )}
          </div>

          <span className="text-muted small">
            Monitoreo preventivo y operativo mensual de la flota
          </span>
        </div>

        {/* Grid de los 12 Meses */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(4, 1fr)",
            gap: "12px",
            marginBottom: "16px",
          }}
        >
          {MESES.map((mes, i) => {
            const info = getCheckListInfo(i);
            const esImpar = (i + 1) % 2 !== 0;

            // Colores CheckList
            const clIsPendiente = info !== null && info.pendientes > 0;
            const clIsOk = info !== null && info.pendientes === 0;
            const clBg = clIsPendiente ? "#fee2e2" : clIsOk ? "#dcfce7" : "#f1f5f9";
            const clColor = clIsPendiente ? "#991b1b" : clIsOk ? "#166534" : "#64748b";
            const clBorder = clIsPendiente ? "#fca5a5" : clIsOk ? "#86efac" : "#e2e8f0";

            // Colores Kilometraje
            const kmSinRelevar = getKmSinRelevar(i);
            const kmIsPendiente = kmSinRelevar !== null && kmSinRelevar > 0;
            const kmIsOk = kmSinRelevar !== null && kmSinRelevar === 0;
            const kmBg = kmIsPendiente ? "#fee2e2" : kmIsOk ? "#dcfce7" : "#f1f5f9";
            const kmColor = kmIsPendiente ? "#991b1b" : kmIsOk ? "#166534" : "#64748b";
            const kmBorder = kmIsPendiente ? "#fca5a5" : kmIsOk ? "#86efac" : "#e2e8f0";

            return (
              <div
                key={mes}
                className="bg-white shadow-sm rounded-3 d-flex overflow-hidden"
                style={{
                  border: "1px solid #cbd5e1",
                  minHeight: "78px",
                  transition: "all 0.2s ease",
                }}
              >
                {/* Lado Izquierdo: Nombre del Mes */}
                <div
                  className="d-flex align-items-center justify-content-center p-2 text-white fw-bold"
                  style={{
                    width: "42%",
                    backgroundColor: "#1e293b",
                    fontSize: "0.92rem",
                    cursor: "pointer",
                    transition: "background-color 0.15s ease",
                    letterSpacing: "0.3px",
                  }}
                  onClick={() => navigate("/camionetas", { state: { mes: i + 1, anio } })}
                  onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#334155")}
                  onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "#1e293b")}
                  title={`Ver camionetas para ${mes}`}
                >
                  <span>{mes}</span>
                </div>

                {/* Lado Derecho: Check List + Kilometraje */}
                <div className="d-flex flex-column justify-content-between p-1.5" style={{ width: "58%", gap: "4px" }}>
                  {/* Check List (solo meses impares) */}
                  {esImpar ? (
                    <div
                      className="rounded-2 d-flex align-items-center justify-content-between px-2 py-1"
                      style={{
                        backgroundColor: clBg,
                        color: clColor,
                        border: `1px solid ${clBorder}`,
                        fontSize: "0.72rem",
                        fontWeight: 600,
                        cursor: "pointer",
                        transition: "all 0.15s ease",
                      }}
                      onClick={() => navigate("/camionetas/checklist", { state: { mes: i + 1, anio } })}
                      title="Ir al Resumen de Check List"
                    >
                      <span className="text-truncate">Check List</span>
                      {clIsPendiente && (
                        <span className="badge bg-danger rounded-pill px-1.5 py-0.5 ms-1" style={{ fontSize: "0.68rem" }}>
                          {info.pendientes}
                        </span>
                      )}
                      {clIsOk && <i className="bi bi-check-circle-fill text-success" style={{ fontSize: "0.75rem" }}></i>}
                    </div>
                  ) : (
                    <div
                      className="rounded-2 d-flex align-items-center justify-content-center px-2 py-1 opacity-50"
                      style={{
                        backgroundColor: "#f8fafc",
                        color: "#94a3b8",
                        border: "1px dashed #cbd5e1",
                        fontSize: "0.68rem",
                      }}
                    >
                      <span>— Bimestral —</span>
                    </div>
                  )}

                  {/* Kilometraje */}
                  <div
                    className="rounded-2 d-flex align-items-center justify-content-between px-2 py-1"
                    style={{
                      backgroundColor: kmBg,
                      color: kmColor,
                      border: `1px solid ${kmBorder}`,
                      fontSize: "0.72rem",
                      fontWeight: 600,
                      cursor: "pointer",
                      transition: "all 0.15s ease",
                    }}
                    onClick={() => navigate("/camionetas/services/kilometros", { state: { mes: i + 1, anio } })}
                    title="Ir a Control de Kilómetros"
                  >
                    <span className="text-truncate">Kilómetros</span>
                    {kmIsPendiente && (
                      <span className="badge bg-danger rounded-pill px-1.5 py-0.5 ms-1" style={{ fontSize: "0.68rem" }}>
                        {kmSinRelevar}
                      </span>
                    )}
                    {kmIsOk && <i className="bi bi-check-circle-fill text-success" style={{ fontSize: "0.75rem" }}></i>}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Tarjetas KPI de Resumen Inferiores */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, 1fr)",
            gap: "14px",
            marginTop: "auto",
            paddingBottom: "8px",
          }}
        >
          {/* Tarjeta 1: Services Atrasados */}
          {(() => {
            const hasAtrasados = serviciosAtrasados !== null && serviciosAtrasados > 0;
            const bg = hasAtrasados ? "#fef2f2" : "#f0fdf4";
            const border = hasAtrasados ? "#f87171" : "#86efac";
            const iconBg = hasAtrasados ? "#fee2e2" : "#dcfce7";
            const iconColor = hasAtrasados ? "#dc2626" : "#166534";
            const countColor = hasAtrasados ? "#991b1b" : "#166534";

            return (
              <div
                className="shadow-sm rounded-3 p-3 d-flex align-items-center gap-3 cursor-pointer"
                style={{
                  backgroundColor: bg,
                  border: `1.5px solid ${border}`,
                  cursor: "pointer",
                  transition: "transform 0.15s ease, box-shadow 0.15s ease",
                }}
                onClick={() => navigate("/camionetas/services/ultimo-service")}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = "translateY(-2px)";
                  e.currentTarget.style.boxShadow = "0 6px 16px rgba(0,0,0,0.1)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = "translateY(0)";
                  e.currentTarget.style.boxShadow = "0 2px 8px rgba(0,0,0,0.06)";
                }}
                title="Ver Control de Último Service"
              >
                <div
                  className="rounded-3 d-flex align-items-center justify-content-center flex-shrink-0"
                  style={{
                    width: "44px",
                    height: "44px",
                    backgroundColor: iconBg,
                    color: iconColor,
                    fontSize: "1.3rem",
                  }}
                >
                  <i className="bi bi-calendar-x-fill"></i>
                </div>
                <div className="d-flex flex-column">
                  <span className="small fw-semibold text-secondary" style={{ fontSize: "0.82rem" }}>
                    Services Atrasados
                  </span>
                  <div className="d-flex align-items-baseline gap-2">
                    <span className="fw-bold fs-4" style={{ color: countColor }}>
                      {serviciosAtrasados ?? "—"}
                    </span>
                    <span className="text-muted small" style={{ fontSize: "0.74rem" }}>
                      {hasAtrasados ? "unidades vencidas" : "Al día"}
                    </span>
                  </div>
                </div>
              </div>
            );
          })()}

          {/* Tarjeta 2: Tareas Pendientes */}
          {(() => {
            const hasPendientes = tareasPendientes !== null && tareasPendientes > 0;
            const bg = hasPendientes ? "#fffbeb" : "#f0fdf4";
            const border = hasPendientes ? "#fcd34d" : "#86efac";
            const iconBg = hasPendientes ? "#fef3c7" : "#dcfce7";
            const iconColor = hasPendientes ? "#d97706" : "#166534";
            const countColor = hasPendientes ? "#b45309" : "#166534";

            return (
              <div
                className="shadow-sm rounded-3 p-3 d-flex align-items-center gap-3 cursor-pointer"
                style={{
                  backgroundColor: bg,
                  border: `1.5px solid ${border}`,
                  cursor: "pointer",
                  transition: "transform 0.15s ease, box-shadow 0.15s ease",
                }}
                onClick={() => navigate("/camionetas/services/reparaciones")}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = "translateY(-2px)";
                  e.currentTarget.style.boxShadow = "0 6px 16px rgba(0,0,0,0.1)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = "translateY(0)";
                  e.currentTarget.style.boxShadow = "0 2px 8px rgba(0,0,0,0.06)";
                }}
                title="Ver Planilla General de Reparaciones"
              >
                <div
                  className="rounded-3 d-flex align-items-center justify-content-center flex-shrink-0"
                  style={{
                    width: "44px",
                    height: "44px",
                    backgroundColor: iconBg,
                    color: iconColor,
                    fontSize: "1.3rem",
                  }}
                >
                  <i className="bi bi-tools"></i>
                </div>
                <div className="d-flex flex-column">
                  <span className="small fw-semibold text-secondary" style={{ fontSize: "0.82rem" }}>
                    Tareas Pendientes
                  </span>
                  <div className="d-flex align-items-baseline gap-2">
                    <span className="fw-bold fs-4" style={{ color: countColor }}>
                      {tareasPendientes ?? "—"}
                    </span>
                    <span className="text-muted small" style={{ fontSize: "0.74rem" }}>
                      {hasPendientes ? "por realizar" : "Al día"}
                    </span>
                  </div>
                </div>
              </div>
            );
          })()}

          {/* Tarjeta 3: Unidades Paradas */}
          {(() => {
            const hasParadas = unidadesParadas !== null && unidadesParadas > 0;
            const bg = hasParadas ? "#fef2f2" : "#f0fdf4";
            const border = hasParadas ? "#f87171" : "#86efac";
            const iconBg = hasParadas ? "#fee2e2" : "#dcfce7";
            const iconColor = hasParadas ? "#dc2626" : "#166534";
            const countColor = hasParadas ? "#991b1b" : "#166534";

            return (
              <div
                className="shadow-sm rounded-3 p-3 d-flex align-items-center gap-3 cursor-pointer"
                style={{
                  backgroundColor: bg,
                  border: `1.5px solid ${border}`,
                  cursor: "pointer",
                  transition: "transform 0.15s ease, box-shadow 0.15s ease",
                }}
                onClick={() => navigate("/camionetas/checklist")}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = "translateY(-2px)";
                  e.currentTarget.style.boxShadow = "0 6px 16px rgba(0,0,0,0.1)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = "translateY(0)";
                  e.currentTarget.style.boxShadow = "0 2px 8px rgba(0,0,0,0.06)";
                }}
                title="Ver Resumen de Check List"
              >
                <div
                  className="rounded-3 d-flex align-items-center justify-content-center flex-shrink-0"
                  style={{
                    width: "44px",
                    height: "44px",
                    backgroundColor: iconBg,
                    color: iconColor,
                    fontSize: "1.3rem",
                  }}
                >
                  <i className="bi bi-cone-striped"></i>
                </div>
                <div className="d-flex flex-column">
                  <span className="small fw-semibold text-secondary" style={{ fontSize: "0.82rem" }}>
                    Unidades Paradas
                  </span>
                  <div className="d-flex align-items-baseline gap-2">
                    <span className="fw-bold fs-4" style={{ color: countColor }}>
                      {unidadesParadas ?? "—"}
                    </span>
                    <span className="text-muted small" style={{ fontSize: "0.74rem" }}>
                      {hasParadas ? "fuera de servicio" : "Flota activa"}
                    </span>
                  </div>
                </div>
              </div>
            );
          })()}
        </div>
      </Container>
    </div>
  );
}

export default ResumenCamionetas;
