import { useState } from "react";
import { useNavigate } from "react-router-dom";

const tarjetas = [
  {
    id: "kilometros",
    titulo: "Kilómetros",
    subtitulo: "Registro y control de odómetros mensuales",
    ruta: "/camionetas/services/kilometros",
    bg: "linear-gradient(135deg, #1e293b 0%, #334155 100%)",
    hoverBg: "linear-gradient(135deg, #0f172a 0%, #1e293b 100%)",
    accentColor: "#3b82f6",
    icono: "bi bi-speedometer2",
  },
  {
    id: "ultimo-service",
    titulo: "Último Service",
    subtitulo: "Control de fechas e intervalos cada 10.000 Km",
    ruta: "/camionetas/services/ultimo-service",
    bg: "linear-gradient(135deg, #14532d 0%, #166534 100%)",
    hoverBg: "linear-gradient(135deg, #052e16 0%, #14532d 100%)",
    accentColor: "#10b981",
    icono: "bi bi-calendar-check-fill",
  },
  {
    id: "checklist",
    titulo: "Check List",
    subtitulo: "Control bimestral de estado y novedades",
    ruta: "/camionetas/checklist",
    bg: "linear-gradient(135deg, #78350f 0%, #92400e 100%)",
    hoverBg: "linear-gradient(135deg, #451a03 0%, #78350f 100%)",
    accentColor: "#f59e0b",
    icono: "bi bi-clipboard2-check-fill",
  },
];

function CamionetasPreventivo() {
  const navigate = useNavigate();
  const [hoveredCard, setHoveredCard] = useState(null);

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
      {/* Barra de Cabecera */}
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
            <i className="bi bi-shield-check"></i>
          </div>
          <div className="d-flex align-items-center gap-2">
            <span className="text-white fs-6">Camionetas - Mantenimiento Preventivo</span>
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

      {/* Contenedor de las 3 Tarjetas en Grid horizontal */}
      <div
        className="flex-grow-1 d-flex flex-column align-items-center justify-content-center p-4"
        style={{ overflow: "hidden" }}
      >
        <div style={{ maxWidth: "1050px", width: "100%" }}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(3, minmax(260px, 1fr))",
              gap: "1.5rem",
              justifyContent: "center",
            }}
          >
            {tarjetas.map((t) => {
              const isHovered = hoveredCard === t.id;
              return (
                <div
                  key={t.ruta}
                  className="card-seccion-preventivo d-flex flex-column align-items-center justify-content-center p-4 text-center"
                  style={{
                    background: isHovered ? t.hoverBg : t.bg,
                    borderRadius: "20px",
                    height: "calc(100vh - 280px)",
                    minHeight: "240px",
                    maxHeight: "320px",
                    boxShadow: isHovered
                      ? `0 18px 32px -8px rgba(0, 0, 0, 0.45), 0 0 18px ${t.accentColor}40`
                      : "0 8px 20px -4px rgba(0, 0, 0, 0.25)",
                    border: `1px solid ${isHovered ? t.accentColor : "rgba(255, 255, 255, 0.12)"}`,
                    cursor: "pointer",
                    transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
                    transform: isHovered ? "translateY(-4px) scale(1.015)" : "translateY(0) scale(1)",
                    color: "#ffffff",
                    userSelect: "none",
                  }}
                  onClick={() => navigate(t.ruta)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => e.key === "Enter" && navigate(t.ruta)}
                  onMouseEnter={() => setHoveredCard(t.id)}
                  onMouseLeave={() => setHoveredCard(null)}
                >
                  <div
                    className="mb-2.5 d-flex align-items-center justify-content-center"
                    style={{
                      width: "60px",
                      height: "60px",
                      borderRadius: "16px",
                      backgroundColor: "rgba(255, 255, 255, 0.1)",
                      border: "1px solid rgba(255, 255, 255, 0.16)",
                      boxShadow: "0 4px 12px rgba(0, 0, 0, 0.15)",
                    }}
                  >
                    <i className={t.icono} style={{ fontSize: "2.1rem", color: t.accentColor }}></i>
                  </div>

                  <h3 className="h4 fw-bold mb-2 tracking-tight text-white">{t.titulo}</h3>

                  <p className="small mb-0 text-light opacity-75 px-3" style={{ fontSize: "0.84rem", lineHeight: "1.35" }}>
                    {t.subtitulo}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

export default CamionetasPreventivo;
