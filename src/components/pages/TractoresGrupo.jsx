import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import TractorIcon from "../shared/TractorIcon";
import LogoNavbar from "../shared/LogoNavbar";

// Triángulo rojo chillón con signo de exclamación blanco y opacidad oscura de contraste
function IconoAlertaTractor({ size = 20 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      style={{
        filter: "drop-shadow(0 0 5px rgba(0,0,0,0.95)) drop-shadow(0 0 8px rgba(255,0,34,0.85))",
        overflow: "visible",
        display: "inline-block",
      }}
    >
      <path
        d="M12 2.2L1.2 21.2h21.6L12 2.2z"
        fill="#ff0022"
        stroke="#ff0022"
        strokeWidth="1.2"
        strokeLinejoin="round"
      />
      <rect x="11" y="8.5" width="2" height="6.5" rx="1" fill="#ffffff" />
      <circle cx="12" cy="17.8" r="1.25" fill="#ffffff" />
    </svg>
  );
}

const GRUPOS = {
  1: {
    label: "Grupo 1",
    supervisor: "Jorge Rosas",
    bg: "linear-gradient(135deg, #1e3a8a 0%, #1e40af 100%)",
    hoverBg: "linear-gradient(135deg, #172554 0%, #1e3a8a 100%)",
    accent: "#60a5fa",
  },
  2: {
    label: "Grupo 2",
    supervisor: "Guillermo Bustos",
    bg: "linear-gradient(135deg, #065f46 0%, #047857 100%)",
    hoverBg: "linear-gradient(135deg, #022c22 0%, #065f46 100%)",
    accent: "#34d399",
  },
  3: {
    label: "Grupo 3",
    supervisor: "Carlos Chumiento",
    bg: "linear-gradient(135deg, #854d0e 0%, #a16207 100%)",
    hoverBg: "linear-gradient(135deg, #451a03 0%, #854d0e 100%)",
    accent: "#facc15",
  },
  4: {
    label: "Grupo 4",
    supervisor: "brandan alejandro",
    bg: "linear-gradient(135deg, #581c87 0%, #6b21a8 100%)",
    hoverBg: "linear-gradient(135deg, #3b0764 0%, #581c87 100%)",
    accent: "#c084fc",
  },
  5: {
    label: "Grupo 5",
    supervisor: "Elio Rojas",
    bg: "linear-gradient(135deg, #9a3412 0%, #c2410c 100%)",
    hoverBg: "linear-gradient(135deg, #431407 0%, #9a3412 100%)",
    accent: "#fb923c",
  },
  6: {
    label: "Berdina",
    supervisor: "Kevin",
    bg: "linear-gradient(135deg, #991b1b 0%, #b91c1c 100%)",
    hoverBg: "linear-gradient(135deg, #450a0a 0%, #991b1b 100%)",
    accent: "#f87171",
  },
  7: {
    label: "San Pablo",
    supervisor: "Victor",
    bg: "linear-gradient(135deg, #3f6212 0%, #4d7c0f 100%)",
    hoverBg: "linear-gradient(135deg, #1a2e05 0%, #3f6212 100%)",
    accent: "#a3e635",
  },
};

function TractoresGrupo() {
  const navigate = useNavigate();
  const { grupoId } = useParams();
  const [tractores, setTractores] = useState([]);
  const [conTareaPendiente, setConTareaPendiente] = useState(new Set());
  const [paradosIds, setParadosIds] = useState(new Set());
  const [hoveredId, setHoveredId] = useState(null);

  const infoGrupo = GRUPOS[grupoId] || {
    label: `Grupo ${grupoId}`,
    supervisor: "—",
    bg: "linear-gradient(135deg, #1e293b 0%, #334155 100%)",
    hoverBg: "linear-gradient(135deg, #0f172a 0%, #1e293b 100%)",
    accent: "#38bdf8",
  };

  useEffect(() => {
    Promise.all([
      fetch("/api/tractores").then((r) => (r.ok ? r.json() : [])).catch(() => []),
      fetch("/api/trabajos-tractor/pendientes/ids").then((r) => (r.ok ? r.json() : [])).catch(() => []),
      fetch("/api/trabajos-tractor/parados/ids").then((r) => (r.ok ? r.json() : [])).catch(() => []),
    ]).then(([tracs, pendientesIds, stopIds]) => {
      const safeTracs = Array.isArray(tracs) ? tracs : [];
      const filtrados = safeTracs.filter((t) => Number(t.gruppo) === Number(grupoId));
      setTractores(filtrados);
      setConTareaPendiente(new Set(Array.isArray(pendientesIds) ? pendientesIds : []));
      setParadosIds(new Set(Array.isArray(stopIds) ? stopIds : []));
    });
  }, [grupoId]);

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
              backgroundColor: "#4338ca",
              color: "#fff",
              fontSize: "1.15rem",
              boxShadow: "0 2px 8px rgba(67, 56, 202, 0.3)",
            }}
          >
            <TractorIcon size="1.2rem" color="#fff" />
          </div>
          <div className="d-flex align-items-center gap-2">
            <span className="text-white fs-6 fw-semibold">
              Tractores - Reparaciones {infoGrupo.label}
            </span>
            <span className="text-light opacity-75 small">
              - {infoGrupo.supervisor} • {tractores.length} {tractores.length === 1 ? "Unidad" : "Unidades"}
            </span>
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
            className="btn btn-sm btn-outline-light d-flex align-items-center gap-2 rounded-3 px-3 py-1"
            style={{ fontSize: "0.82rem" }}
          >
            <i className="bi bi-grid-fill"></i>
            <span>Grupos</span>
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

      {/* Barra de Acciones y Título de Grupo y Responsable */}
      <div
        className="px-4 pt-3 pb-1 d-flex align-items-center justify-content-between flex-wrap gap-2 flex-shrink-0"
        style={{ maxWidth: "1120px", width: "100%", margin: "0 auto" }}
      >
        <button
          onClick={() => navigate(`/tractores/grupo/${grupoId}/resumen`)}
          className="btn d-inline-flex align-items-center gap-2 rounded-3 px-3 py-1.5 text-white"
          style={{
            background: "linear-gradient(135deg, #1e293b 0%, #334155 100%)",
            border: "1px solid rgba(255, 255, 255, 0.12)",
            boxShadow: "0 4px 12px rgba(0, 0, 0, 0.18)",
            fontSize: "0.82rem",
            transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
            cursor: "pointer",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = "linear-gradient(135deg, #0f172a 0%, #1e293b 100%)";
            e.currentTarget.style.transform = "translateY(-2px)";
            e.currentTarget.style.boxShadow =
              "0 8px 18px rgba(0, 0, 0, 0.3), 0 0 12px rgba(56, 189, 248, 0.35)";
            e.currentTarget.style.borderColor = "#38bdf8";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = "linear-gradient(135deg, #1e293b 0%, #334155 100%)";
            e.currentTarget.style.transform = "translateY(0)";
            e.currentTarget.style.boxShadow = "0 4px 12px rgba(0, 0, 0, 0.18)";
            e.currentTarget.style.borderColor = "rgba(255, 255, 255, 0.12)";
          }}
        >
          <div
            className="rounded-2 d-flex align-items-center justify-content-center"
            style={{
              width: "24px",
              height: "24px",
              backgroundColor: "rgba(56, 189, 248, 0.2)",
              border: "1px solid rgba(56, 189, 248, 0.4)",
              color: "#38bdf8",
              fontSize: "0.85rem",
            }}
          >
            <i className="bi bi-table"></i>
          </div>
          <span>Resumen General</span>
        </button>

        {/* Grupo y Responsable centrados */}
        <div className="text-center me-auto ms-auto" style={{ transform: "translateX(-45px)" }}>
          <h3 className="fw-bold text-dark mb-0" style={{ fontSize: "1.45rem", letterSpacing: "-0.3px" }}>
            {infoGrupo.label}
          </h3>
          <div className="text-secondary small" style={{ fontSize: "0.86rem" }}>
            Responsable: <span className="fw-semibold text-dark">{infoGrupo.supervisor}</span>
          </div>
        </div>
      </div>

      {/* Grilla Limpia y Moderna de Tractores del Grupo */}
      <div
        className="flex-grow-1 p-4 d-flex align-items-center justify-content-center"
        style={{
          overflowY: "auto",
        }}
      >
        <div
          className="d-flex flex-wrap justify-content-center align-items-center"
          style={{
            gap: "1.25rem",
            maxWidth: "1080px",
            width: "100%",
          }}
        >
          {tractores.map((t) => {
            const id = t._id?.toString();
            const tieneTarea = conTareaPendiente.has(id);
            const estaParado = paradosIds.has(id);
            const isHovered = hoveredId === id;
            const cleanCC = String(t.cc || "").replace(/^cc\s*/i, "").trim();

            return (
              <div
                key={t._id}
                className="d-flex flex-column align-items-center justify-content-center p-3 text-center text-white"
                style={{
                  position: "relative",
                  background: isHovered ? infoGrupo.hoverBg : infoGrupo.bg,
                  borderRadius: "16px",
                  width: "190px",
                  height: "115px",
                  boxShadow: isHovered
                    ? `0 14px 28px -6px rgba(0, 0, 0, 0.4), 0 0 16px ${infoGrupo.accent}40`
                    : "0 6px 16px -2px rgba(0, 0, 0, 0.25)",
                  border: isHovered
                    ? `1px solid ${infoGrupo.accent}`
                    : "1px solid rgba(255, 255, 255, 0.14)",
                  cursor: "pointer",
                  transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
                  transform: isHovered ? "translateY(-4px) scale(1.03)" : "translateY(0) scale(1)",
                  userSelect: "none",
                }}
                onClick={() =>
                  navigate(`/tractores/grupo/${grupoId}/reparaciones/${t._id}`, {
                    state: { cc: t.cc, descripcion: t.descripcion },
                  })
                }
                role="button"
                tabIndex={0}
                onKeyDown={(e) =>
                  e.key === "Enter" &&
                  navigate(`/tractores/grupo/${grupoId}/reparaciones/${t._id}`, {
                    state: { cc: t.cc, descripcion: t.descripcion },
                  })
                }
                onMouseEnter={() => setHoveredId(id)}
                onMouseLeave={() => setHoveredId(null)}
              >
                {/* Alertas: Rojo neón con exclamación blanca si está parado, Amarillo si tiene tareas pendientes */}
                {estaParado ? (
                  <div
                    style={{
                      position: "absolute",
                      top: "8px",
                      right: "9px",
                      zIndex: 10,
                    }}
                    title="Tractor Parado"
                  >
                    <IconoAlertaTractor size={20} />
                  </div>
                ) : tieneTarea ? (
                  <i
                    className="bi bi-exclamation-triangle-fill text-warning"
                    style={{
                      position: "absolute",
                      top: "8px",
                      right: "9px",
                      color: "#facc15",
                      fontSize: "1.15rem",
                      filter: "drop-shadow(0 0 4px rgba(0, 0, 0, 0.95))",
                    }}
                    title="Tareas Pendientes / En proceso"
                  />
                ) : null}

                {/* Código de CC del Tractor */}
                <div
                  className="fw-bold tracking-tight text-white mb-0.5"
                  style={{
                    fontSize: "1.45rem",
                    letterSpacing: "0.5px",
                  }}
                >
                  {cleanCC}
                </div>

                {/* Descripción / Modelo */}
                <div
                  className="small text-light opacity-75 text-truncate w-100 px-2"
                  title={t.descripcion}
                  style={{ fontSize: "0.8rem", lineHeight: "1.2" }}
                >
                  {t.descripcion || "Sin descripción"}
                </div>
              </div>
            );
          })}

          {tractores.length === 0 && (
            <div className="text-center py-5 w-100">
              <i className="bi bi-inbox fs-1 text-muted"></i>
              <p className="text-muted mt-2">Sin tractores registrados en este grupo.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default TractoresGrupo;
