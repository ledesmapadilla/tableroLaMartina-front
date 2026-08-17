import { useEffect, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import TractorIcon from "../shared/TractorIcon";

const GRUPOS = {
  1: { label: "Grupo 1", supervisor: "Jorge Rosas" },
  2: { label: "Grupo 2", supervisor: "Guillermo Bustos" },
  3: { label: "Grupo 3", supervisor: "Carlos Chumiento" },
  4: { label: "Grupo 4", supervisor: "brandan alejandro" },
  5: { label: "Grupo 5", supervisor: "Elio Rojas" },
  6: { label: "Berdina", supervisor: "Kevin" },
  7: { label: "San Pablo", supervisor: "Victor" },
};

function TareasTractor() {
  const navigate = useNavigate();
  const { grupoId, tractorId } = useParams();
  const { state } = useLocation();

  const [tractor, setTractor] = useState(null);
  const [hoveredCard, setHoveredCard] = useState(null);

  const infoGrupo = GRUPOS[grupoId] || { label: state?.grupoLabel || `Grupo ${grupoId}`, supervisor: "—" };

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
      id: "vieja",
      titulo: "Vieja",
      subtitulo: "Planilla tradicional histórica con edición en tabla y exportación a Excel",
      ruta: `/tractores/grupo/${grupoId}/reparaciones/${tractorId}/tareas/vieja`,
      bg: "linear-gradient(135deg, #1e293b 0%, #334155 100%)",
      hoverBg: "linear-gradient(135deg, #0f172a 0%, #1e293b 100%)",
      accentColor: "#38bdf8",
      icono: "bi bi-table",
    },
    {
      id: "nueva",
      titulo: "Nueva",
      subtitulo: "Gestión interactiva de tareas por tarjetas, diagnósticos y repuestos",
      ruta: `/tractores/grupo/${grupoId}/reparaciones/${tractorId}/tareas/nueva`,
      bg: "linear-gradient(135deg, #78350f 0%, #92400e 100%)",
      hoverBg: "linear-gradient(135deg, #451a03 0%, #78350f 100%)",
      accentColor: "#f59e0b",
      icono: "bi bi-tools",
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
        style={{ backgroundColor: "#1e293b", color: "#fff", height: "54px" }}
      >
        <div className="d-flex align-items-center gap-3">
          <div
            className="rounded-3 d-flex align-items-center justify-content-center me-1"
            style={{
              width: "34px",
              height: "34px",
              backgroundColor: "#f59e0b",
              color: "#fff",
              fontSize: "1.15rem",
              boxShadow: "0 2px 8px rgba(245, 158, 11, 0.3)",
            }}
          >
            <i className="bi bi-tools"></i>
          </div>
          <div className="d-flex align-items-center gap-2">
            <span className="text-light opacity-90 small">Tareas Tractor:</span>
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
            <span className="text-light opacity-75 small">• {infoGrupo.label}</span>
            {descripcion && <span className="text-light opacity-75 small">• {descripcion}</span>}
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
            onClick={() => navigate(`/tractores/grupo/${grupoId}/reparaciones/${tractorId}`)}
            className="btn btn-sm btn-outline-light d-flex align-items-center gap-2 rounded-3 px-3 py-1"
            style={{ fontSize: "0.82rem" }}
          >
            <TractorIcon size="1.05rem" color="#fff" />
            <span>Menú Tractor</span>
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
            onClick={() => navigate("/")}
            className="btn btn-sm btn-light text-dark d-flex align-items-center gap-1.5 rounded-3 px-3 py-1"
            style={{ fontSize: "0.82rem" }}
          >
            <i className="bi bi-house-door-fill"></i>
            <span>General</span>
          </button>
        </div>
      </div>

      {/* Contenedor Central de las 2 Tarjetas (Vieja y Nueva) */}
      <div
        className="flex-grow-1 d-flex flex-column align-items-center justify-content-center p-4"
        style={{ overflow: "hidden" }}
      >
        <div
          className="d-flex justify-content-center align-items-center"
          style={{
            gap: "2.5rem",
            maxWidth: "840px",
            width: "100%",
          }}
        >
          {tarjetas.map((t) => {
            const isHovered = hoveredCard === t.id;
            return (
              <div
                key={t.id}
                className="d-flex flex-column align-items-center justify-content-center p-4 text-center text-white"
                style={{
                  background: isHovered ? t.hoverBg : t.bg,
                  borderRadius: "22px",
                  width: "340px",
                  height: "285px",
                  boxShadow: isHovered
                    ? `0 20px 36px -8px rgba(0, 0, 0, 0.45), 0 0 20px ${t.accentColor}40`
                    : "0 10px 25px -4px rgba(0, 0, 0, 0.25)",
                  border: `1px solid ${isHovered ? t.accentColor : "rgba(255, 255, 255, 0.12)"}`,
                  cursor: "pointer",
                  transition: "all 0.22s cubic-bezier(0.4, 0, 0.2, 1)",
                  transform: isHovered ? "translateY(-5px) scale(1.02)" : "translateY(0) scale(1)",
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
                <h3 className="fw-bold mb-2 tracking-tight text-white" style={{ fontSize: "1.5rem" }}>
                  {t.titulo}
                </h3>

                {/* Subtítulo */}
                <p
                  className="small mb-0 text-light opacity-75 px-3"
                  style={{ fontSize: "0.88rem", lineHeight: "1.35" }}
                >
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

export default TareasTractor;
