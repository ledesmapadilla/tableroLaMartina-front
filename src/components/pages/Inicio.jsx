import { useState } from "react";
import { useNavigate } from "react-router-dom";
import TractorIcon from "../shared/TractorIcon";

const secciones = [
  {
    id: "camionetas",
    titulo: "Camionetas",
    subtitulo: "Flota, checklist, services y reparaciones",
    ruta: "/camionetas",
    bg: "linear-gradient(135deg, #1e293b 0%, #334155 100%)",
    hoverBg: "linear-gradient(135deg, #0f172a 0%, #1e293b 100%)",
    accentColor: "#3b82f6",
    icono: "bi bi-car-front-fill",
  },
  {
    id: "tractores",
    titulo: "Tractores",
    subtitulo: "Maquinaria agrícola, grupos y mantenimiento",
    ruta: "/tractores",
    bg: "linear-gradient(135deg, #1b4332 0%, #2d6a4f 100%)",
    hoverBg: "linear-gradient(135deg, #081c15 0%, #1b4332 100%)",
    accentColor: "#10b981",
    icono: null,
  },
  {
    id: "sanpablo",
    titulo: "Reparaciones San Pablo",
    subtitulo: "Taller interno y registro de tareas Base San Pablo",
    ruta: "/reparaciones/sanpablo",
    bg: "linear-gradient(135deg, #78350f 0%, #92400e 100%)",
    hoverBg: "linear-gradient(135deg, #451a03 0%, #78350f 100%)",
    accentColor: "#f59e0b",
    icono: "bi bi-tools",
  },
  {
    id: "colectivo",
    titulo: "Colectivos",
    subtitulo: "Preventivo y reparaciones de los colectivos",
    ruta: "/colectivo",
    bg: "linear-gradient(135deg, #7f1d1d 0%, #991b1b 100%)",
    hoverBg: "linear-gradient(135deg, #450a0a 0%, #7f1d1d 100%)",
    accentColor: "#ef4444",
    icono: "bi bi-bus-front-fill",
  },
  {
    id: "visitas",
    titulo: "Visitas",
    subtitulo: "Control de ingresos",
    ruta: "/visitas",
    bg: "linear-gradient(135deg, #0e7490 0%, #155e75 100%)",
    hoverBg: "linear-gradient(135deg, #164e63 0%, #0e7490 100%)",
    accentColor: "#06b6d4",
    icono: "bi bi-calendar3",
  },
];

function Inicio() {
  const navigate = useNavigate();
  const [hoveredCard, setHoveredCard] = useState(null);

  const mainCards = secciones.filter((s) => s.ruta !== "/visitas");
  const visitasCard = secciones.find((s) => s.ruta === "/visitas");

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
        className="d-flex align-items-center justify-content-between px-4 py-2 border-bottom shadow-sm flex-shrink-0 position-relative"
        style={{ backgroundColor: "#1e293b", color: "#fff", height: "54px" }}
      >
        <div className="d-flex align-items-center">
          <img
            src="/logo-la-martina.jpg"
            alt="Logo"
            height="46"
            style={{
              maskImage:
                "linear-gradient(to right, transparent 0%, black 20%, black 80%, transparent 100%), linear-gradient(to bottom, transparent 0%, black 10%, black 90%, transparent 100%)",
              WebkitMaskImage:
                "linear-gradient(to right, transparent 0%, black 20%, black 80%, transparent 100%), linear-gradient(to bottom, transparent 0%, black 10%, black 90%, transparent 100%)",
              maskComposite: "intersect",
              WebkitMaskComposite: "destination-in",
            }}
          />
        </div>

        {/* Título Centrado en el Navbar con & más chica */}
        <div
          style={{
            position: "absolute",
            left: "50%",
            transform: "translateX(-50%)",
            whiteSpace: "nowrap",
          }}
        >
          <span className="text-white fs-6 fw-semibold">
            Tablero de Control{" "}
            <span style={{ fontSize: "0.82em", opacity: 0.85, marginInline: "2px" }}>&</span>{" "}
            Gestión
          </span>
        </div>

        {/* Espaciador derecho para equilibrio visual */}
        <div style={{ width: "46px" }}></div>
      </div>

      {/* Contenedor Central — Sin Scroll, limpio y centrado */}
      <div
        className="flex-grow-1 d-flex flex-column align-items-center justify-content-center p-3"
        style={{ position: "relative", overflow: "hidden" }}
      >
        <div style={{ position: "relative", maxWidth: "960px", width: "100%" }}>
          {/* Grid 2x2 con las 4 tarjetas grandes */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(2, minmax(320px, 1fr))",
              gap: "1.5rem",
              justifyContent: "center",
            }}
          >
            {mainCards.map((s) => {
              const isHovered = hoveredCard === s.id;
              return (
                <div
                  key={s.ruta}
                  className="card-seccion-inicio d-flex flex-column align-items-center justify-content-center p-4 text-center"
                  style={{
                    background: isHovered ? s.hoverBg : s.bg,
                    borderRadius: "20px",
                    height: "calc((100vh - 150px) / 2.3)",
                    minHeight: "210px",
                    maxHeight: "265px",
                    boxShadow: isHovered
                      ? `0 18px 32px -8px rgba(0, 0, 0, 0.45), 0 0 18px ${s.accentColor}40`
                      : "0 8px 20px -4px rgba(0, 0, 0, 0.25)",
                    border: `1px solid ${isHovered ? s.accentColor : "rgba(255, 255, 255, 0.12)"}`,
                    cursor: "pointer",
                    transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
                    transform: isHovered ? "translateY(-4px) scale(1.015)" : "translateY(0) scale(1)",
                    color: "#ffffff",
                    userSelect: "none",
                  }}
                  onClick={() => navigate(s.ruta)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => e.key === "Enter" && navigate(s.ruta)}
                  onMouseEnter={() => setHoveredCard(s.id)}
                  onMouseLeave={() => setHoveredCard(null)}
                >
                  {/* Icono Principal */}
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
                    {s.icono ? (
                      <i className={s.icono} style={{ fontSize: "2.1rem", color: s.accentColor }}></i>
                    ) : (
                      <TractorIcon size="2.1rem" color={s.accentColor} />
                    )}
                  </div>

                  {/* Título */}
                  <h3 className="h4 fw-bold mb-2 tracking-tight text-white">{s.titulo}</h3>

                  {/* Subtítulo */}
                  <p className="small mb-0 text-light opacity-75 px-3" style={{ fontSize: "0.84rem" }}>
                    {s.subtitulo}
                  </p>
                </div>
              );
            })}
          </div>

          {/* Tarjeta Flotante Central "Visitas" */}
          {visitasCard && (
            <div
              className="card-visitas-central d-flex flex-column align-items-center justify-content-center text-white text-center p-2"
              style={{
                position: "absolute",
                top: "50%",
                left: "50%",
                transform:
                  hoveredCard === "visitas"
                    ? "translate(-50%, -50%) scale(1.08)"
                    : "translate(-50%, -50%) scale(1)",
                background: hoveredCard === "visitas" ? visitasCard.hoverBg : visitasCard.bg,
                borderRadius: "18px",
                boxShadow:
                  hoveredCard === "visitas"
                    ? "0 16px 32px rgba(0,0,0,0.5), 0 0 20px rgba(6, 182, 212, 0.4)"
                    : "0 8px 24px rgba(0,0,0,0.35)",
                border: "2px solid rgba(255, 255, 255, 0.3)",
                cursor: "pointer",
                transition: "transform 0.2s cubic-bezier(0.4, 0, 0.2, 1), box-shadow 0.2s ease",
                width: "140px",
                height: "92px",
                zIndex: 20,
                userSelect: "none",
              }}
              onClick={() => navigate(visitasCard.ruta)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => e.key === "Enter" && navigate(visitasCard.ruta)}
              onMouseEnter={() => setHoveredCard("visitas")}
              onMouseLeave={() => setHoveredCard(null)}
            >
              <div
                className="d-flex align-items-center justify-content-center mb-1"
                style={{
                  width: "28px",
                  height: "28px",
                  borderRadius: "8px",
                  backgroundColor: "rgba(255, 255, 255, 0.15)",
                }}
              >
                <i className={visitasCard.icono} style={{ fontSize: "1.1rem", color: "#67e8f9" }}></i>
              </div>
              <span className="fw-bold text-center mb-0" style={{ fontSize: "0.9rem" }}>
                {visitasCard.titulo}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default Inicio;
