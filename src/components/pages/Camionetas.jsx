import { useState } from "react";
import { useNavigate } from "react-router-dom";

const tarjetas = [
  {
    id: "preventivo",
    titulo: "Preventivo",
    subtitulo: "Check List bimestral y Tablero de Control general",
    ruta: "/camionetas/preventivo",
    bg: "linear-gradient(135deg, #1e293b 0%, #334155 100%)",
    hoverBg: "linear-gradient(135deg, #0f172a 0%, #1e293b 100%)",
    accentColor: "#3b82f6",
    icono: "bi bi-shield-check",
  },
  {
    id: "reparaciones",
    titulo: "Reparaciones",
    subtitulo: "Tareas y reparaciones por camioneta",
    ruta: "/camionetas/services/reparaciones",
    bg: "linear-gradient(135deg, #78350f 0%, #92400e 100%)",
    hoverBg: "linear-gradient(135deg, #451a03 0%, #78350f 100%)",
    accentColor: "#f59e0b",
    icono: "bi bi-tools",
  },
];

function Camionetas() {
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
            <i className="bi bi-car-front-fill"></i>
          </div>
          <div className="d-flex align-items-center gap-2">
            <span className="text-white fs-6">Gestión de Camionetas</span>
            <span className="text-light opacity-75 small">- 16 Unidades</span>
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
            onClick={() => navigate("/")}
            className="btn btn-sm btn-light text-dark d-flex align-items-center gap-1.5 rounded-3 px-3 py-1"
            style={{ fontSize: "0.82rem" }}
          >
            <i className="bi bi-house-door-fill"></i>
            <span>General</span>
          </button>
        </div>
      </div>

      {/* Contenedor Central con las 2 Tarjetas Principales */}
      <div
        className="flex-grow-1 d-flex flex-column align-items-center justify-content-center p-4"
        style={{ overflow: "hidden" }}
      >
        <div
          className="d-flex justify-content-center align-items-center"
          style={{
            gap: "2.5rem",
            maxWidth: "880px",
            width: "100%",
          }}
        >
          {tarjetas.map((t) => {
            const isHovered = hoveredCard === t.id;
            return (
              <div
                key={t.ruta}
                className="card-seccion-camionetas d-flex flex-column align-items-center justify-content-center p-4 text-center"
                style={{
                  background: isHovered ? t.hoverBg : t.bg,
                  borderRadius: "22px",
                  width: "360px",
                  height: "290px",
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
                onClick={() => navigate(t.ruta)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => e.key === "Enter" && navigate(t.ruta)}
                onMouseEnter={() => setHoveredCard(t.id)}
                onMouseLeave={() => setHoveredCard(null)}
              >
                {/* Icono Principal */}
                <div
                  className="mb-3 d-flex align-items-center justify-content-center"
                  style={{
                    width: "72px",
                    height: "72px",
                    borderRadius: "18px",
                    backgroundColor: "rgba(255, 255, 255, 0.1)",
                    border: "1px solid rgba(255, 255, 255, 0.16)",
                    boxShadow: "0 6px 16px rgba(0, 0, 0, 0.15)",
                  }}
                >
                  <i className={t.icono} style={{ fontSize: "2.4rem", color: t.accentColor }}></i>
                </div>

                {/* Título */}
                <h3 className="fw-bold mb-2 tracking-tight text-white" style={{ fontSize: "1.5rem" }}>
                  {t.titulo}
                </h3>

                {/* Subtítulo */}
                <p className="small mb-0 text-light opacity-75 px-3" style={{ fontSize: "0.88rem", lineHeight: "1.4" }}>
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

export default Camionetas;
