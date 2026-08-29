import { useEffect, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import LogoNavbar from "../shared/LogoNavbar";

function CamionetaMenuReparaciones() {
  const navigate = useNavigate();
  const { camionetaId } = useParams();
  const { state } = useLocation();

  const [camioneta, setCamioneta] = useState(null);
  const [hoveredCard, setHoveredCard] = useState(null);

  useEffect(() => {
    fetch(`/api/camionetas/${camionetaId}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data) setCamioneta(data);
      })
      .catch(() => {});
  }, [camionetaId]);

  const patente = camioneta?.patente || state?.patente || "Camioneta";
  const marca = camioneta?.marca || state?.marca || "";

  const tarjetas = [
    {
      id: "reportar",
      titulo: "Reportar Falla",
      subtitulo: "Registrar novedades, problemas o mejoras requeridas",
      ruta: `/camionetas/services/reparaciones/${camionetaId}/reportar`,
      bg: "linear-gradient(135deg, #7f1d1d 0%, #991b1b 100%)",
      hoverBg: "linear-gradient(135deg, #450a0a 0%, #7f1d1d 100%)",
      accentColor: "#ef4444",
      icono: "bi bi-megaphone-fill",
    },
    {
      id: "tareas",
      titulo: "Tareas",
      subtitulo: "Gestión de tareas, diagnósticos y repuestos",
      ruta: `/camionetas/services/reparaciones/${camionetaId}/tareas`,
      bg: "linear-gradient(135deg, #78350f 0%, #92400e 100%)",
      hoverBg: "linear-gradient(135deg, #451a03 0%, #78350f 100%)",
      accentColor: "#f59e0b",
      icono: "bi bi-tools",
    },
    {
      id: "historial",
      titulo: "Historial",
      subtitulo: "Registro histórico de reparaciones",
      ruta: `/camionetas/services/reparaciones/${camionetaId}/historial`,
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
              backgroundColor: "#3b82f6",
              color: "#fff",
              fontSize: "1.15rem",
              boxShadow: "0 2px 8px rgba(59, 130, 246, 0.3)",
            }}
          >
            <i className="bi bi-car-front-fill"></i>
          </div>
          <div className="d-flex align-items-center gap-2">
            <span className="text-light opacity-90 small">Camioneta:</span>
            <span
              className="badge px-3 py-1 fw-bold text-white shadow-sm"
              style={{
                backgroundColor: "#0f172a",
                border: "1px solid #475569",
                fontSize: "0.92rem",
                letterSpacing: "1.2px",
                borderRadius: "8px",
              }}
            >
              {patente}
            </span>
            {marca && (
              <span className="text-light opacity-75 small">
                • {marca}
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
            onClick={() => navigate("/camionetas/services/reparaciones")}
            className="btn btn-sm btn-outline-light d-flex align-items-center gap-2 rounded-3 px-3 py-1"
            style={{ fontSize: "0.82rem" }}
          >
            <i className="bi bi-grid-3x3-gap-fill me-1"></i>
            <span>Todas las Camionetas</span>
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

      {/* Contenedor de las 3 Tarjetas (Reportar Falla, Tareas, Historial) */}
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
                key={t.ruta}
                className="card-seccion-camioneta-hub d-flex flex-column align-items-center justify-content-center p-4 text-center"
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
                onClick={() => navigate(t.ruta, { state: { patente, marca } })}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => e.key === "Enter" && navigate(t.ruta, { state: { patente, marca } })}
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

export default CamionetaMenuReparaciones;
