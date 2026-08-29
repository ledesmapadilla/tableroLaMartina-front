import { useEffect, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import TractorIcon from "../shared/TractorIcon";
import LogoNavbar from "../shared/LogoNavbar";

const GRUPOS = {
  1: { label: "Grupo 1", supervisor: "Jorge Rosas" },
  2: { label: "Grupo 2", supervisor: "Guillermo Bustos" },
  3: { label: "Grupo 3", supervisor: "Carlos Chumiento" },
  4: { label: "Grupo 4", supervisor: "brandan alejandro" },
  5: { label: "Grupo 5", supervisor: "Elio Rojas" },
  6: { label: "Berdina", supervisor: "Kevin" },
  7: { label: "San Pablo", supervisor: "Victor" },
};

function ReparacionesTractor() {
  const navigate = useNavigate();
  const { grupoId, tractorId } = useParams();
  const { state } = useLocation();

  const [tractor, setTractor] = useState(null);
  const [hoveredCard, setHoveredCard] = useState(null);

  const infoGrupo = GRUPOS[grupoId] || { label: `Grupo ${grupoId}`, supervisor: "—" };

  useEffect(() => {
    fetch(`/api/tractores/${tractorId}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data) setTractor(data);
      })
      .catch(() => {});
  }, [tractorId]);

  const rawCC = tractor?.cc || state?.cc || "CC —";
  const cleanCC = String(rawCC).replace(/^cc\s*/i, "").trim();
  const descripcion = tractor?.descripcion || state?.descripcion || "";

  const tarjetas = [
    {
      id: "reportar",
      titulo: "Reporte Falla",
      subtitulo: "Registrar novedades, problemas o mejoras requeridas",
      ruta: `/tractores/grupo/${grupoId}/reparaciones/${tractorId}/reportar`,
      bg: "linear-gradient(135deg, #7f1d1d 0%, #991b1b 100%)",
      hoverBg: "linear-gradient(135deg, #450a0a 0%, #7f1d1d 100%)",
      accentColor: "#ef4444",
      icono: "bi bi-megaphone-fill",
    },
    {
      id: "tareas",
      titulo: "Tareas",
      subtitulo: "Gestión de tareas, diagnósticos y repuestos",
      ruta: `/tractores/grupo/${grupoId}/reparaciones/${tractorId}/tareas`,
      bg: "linear-gradient(135deg, #78350f 0%, #92400e 100%)",
      hoverBg: "linear-gradient(135deg, #451a03 0%, #78350f 100%)",
      accentColor: "#f59e0b",
      icono: "bi bi-tools",
    },
    {
      id: "historial",
      titulo: "Historial",
      subtitulo: "Registro histórico de reparaciones del tractor",
      ruta: `/tractores/grupo/${grupoId}/reparaciones/${tractorId}/historial`,
      bg: "linear-gradient(135deg, #1e293b 0%, #334155 100%)",
      hoverBg: "linear-gradient(135deg, #0f172a 0%, #1e293b 100%)",
      accentColor: "#3b82f6",
      icono: "bi bi-clock-history",
    },
  ];

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
            <span className="text-light opacity-90 small">Tractor:</span>
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
              CC {cleanCC}
            </span>
            <span className="text-light opacity-75 small">
              • {infoGrupo.label}
            </span>
            {descripcion && (
              <span className="text-light opacity-75 small">
                • {descripcion}
              </span>
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
          <button
            onClick={() => navigate(`/tractores/grupo/${grupoId}`)}
            className="btn btn-sm btn-outline-light d-flex align-items-center gap-2 rounded-3 px-3 py-1"
            style={{ fontSize: "0.82rem" }}
          >
            <i className="bi bi-grid-fill"></i>
            <span>{infoGrupo.label}</span>
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

      {/* Contenedor de las 3 Tarjetas (Reporte Falla, Tareas, Historial) */}
      <div
        className="flex-grow-1 d-flex flex-column align-items-center justify-content-center p-4"
        style={{ overflow: "hidden" }}
      >
        <div
          className="d-flex justify-content-center align-items-center"
          style={{
            gap: "2rem",
            maxWidth: "1080px",
            width: "100%",
          }}
        >
          {tarjetas.map((t) => {
            const isHovered = hoveredCard === t.id;
            return (
              <div
                key={t.id}
                className="card-seccion-tractor-hub d-flex flex-column align-items-center justify-content-center p-4 text-center"
                style={{
                  background: isHovered ? t.hoverBg : t.bg,
                  borderRadius: "22px",
                  width: "310px",
                  height: "285px",
                  boxShadow: isHovered
                    ? `0 20px 36px -8px rgba(0, 0, 0, 0.45), 0 0 20px ${t.accentColor}40`
                    : "0 10px 25px -4px rgba(0, 0, 0, 0.25)",
                  border: `1px solid ${isHovered ? t.accentColor : "rgba(255, 255, 255, 0.12)"}`,
                  cursor: "pointer",
                  transition: "all 0.22s cubic-bezier(0.4, 0, 0.2, 1)",
                  transform: isHovered ? "translateY(-5px) scale(1.02)" : "translateY(0) scale(1)",
                  color: "#ffffff",
                  userSelect: "none",
                }}
                onClick={() =>
                  navigate(t.ruta, {
                    state: { cc: rawCC, descripcion, grupoId, grupoLabel: infoGrupo.label },
                  })
                }
                role="button"
                tabIndex={0}
                onKeyDown={(e) =>
                  e.key === "Enter" &&
                  navigate(t.ruta, {
                    state: { cc: rawCC, descripcion, grupoId, grupoLabel: infoGrupo.label },
                  })
                }
                onMouseEnter={() => setHoveredCard(t.id)}
                onMouseLeave={() => setHoveredCard(null)}
              >
                {/* Icono Principal */}
                <div
                  className="mb-3 d-flex align-items-center justify-content-center"
                  style={{
                    width: "68px",
                    height: "68px",
                    borderRadius: "18px",
                    backgroundColor: "rgba(255, 255, 255, 0.1)",
                    border: "1px solid rgba(255, 255, 255, 0.16)",
                    boxShadow: "0 6px 16px rgba(0, 0, 0, 0.15)",
                  }}
                >
                  <i className={t.icono} style={{ fontSize: "2.3rem", color: t.accentColor }}></i>
                </div>

                {/* Título */}
                <h3 className="fw-bold mb-2 tracking-tight text-white" style={{ fontSize: "1.4rem" }}>
                  {t.titulo}
                </h3>

                {/* Subtítulo */}
                <p className="small mb-0 text-light opacity-75 px-3" style={{ fontSize: "0.86rem", lineHeight: "1.35" }}>
                  {t.subtitulo}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default ReparacionesTractor;
