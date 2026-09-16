import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import TractorIcon from "../shared/TractorIcon";
import NavbarSanPablo from "../shared/NavbarSanPablo";

// Una tarjeta por tipo de equipo que se repara en la base San Pablo, dentro de
// una cosecha (/reparaciones/sanpablo/:cosecha). Las que todavía no están
// construidas caen en el 404 (App.jsx).
const tarjetas = [
  {
    id: "manitous",
    titulo: "Manitous",
    bg: "linear-gradient(135deg, #064e3b 0%, #047857 100%)",
    hoverBg: "linear-gradient(135deg, #022c22 0%, #064e3b 100%)",
    accentColor: "#34d399",
    tractor: true,
  },
  {
    id: "colectivos",
    titulo: "Colectivos",
    bg: "linear-gradient(135deg, #7f1d1d 0%, #991b1b 100%)",
    hoverBg: "linear-gradient(135deg, #450a0a 0%, #7f1d1d 100%)",
    accentColor: "#f87171",
    icono: "bi bi-bus-front-fill",
  },
  {
    id: "tolvas",
    titulo: "Tolvas",
    bg: "linear-gradient(135deg, #78350f 0%, #92400e 100%)",
    hoverBg: "linear-gradient(135deg, #451a03 0%, #78350f 100%)",
    accentColor: "#f59e0b",
    icono: "bi bi-minecart-loaded",
  },
  {
    id: "carros-porta-bines",
    titulo: "Carros porta bines",
    bg: "linear-gradient(135deg, #312e81 0%, #4338ca 100%)",
    hoverBg: "linear-gradient(135deg, #1e1b4b 0%, #312e81 100%)",
    accentColor: "#818cf8",
    icono: "bi bi-box-seam-fill",
  },
  {
    id: "carros-porta-escaleras",
    titulo: "Carros porta escaleras",
    bg: "linear-gradient(135deg, #0e7490 0%, #155e75 100%)",
    hoverBg: "linear-gradient(135deg, #164e63 0%, #0e7490 100%)",
    accentColor: "#67e8f9",
    icono: "bi bi-ladder",
  },
  {
    id: "escaleras",
    titulo: "Escaleras",
    bg: "linear-gradient(135deg, #365314 0%, #4d7c0f 100%)",
    hoverBg: "linear-gradient(135deg, #1a2e05 0%, #365314 100%)",
    accentColor: "#a3e635",
    icono: "bi bi-bar-chart-steps",
  },
  {
    id: "pulverizadoras",
    titulo: "Pulverizadoras",
    bg: "linear-gradient(135deg, #1e293b 0%, #334155 100%)",
    hoverBg: "linear-gradient(135deg, #0f172a 0%, #1e293b 100%)",
    accentColor: "#60a5fa",
    icono: "bi bi-droplet-half",
  },
];

function ReparacionesSanPablo() {
  const navigate = useNavigate();
  const { cosecha } = useParams();
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
      <NavbarSanPablo titulo={`Cosecha ${cosecha}`} icono={<i className="bi bi-tools"></i>} />

      {/* Las 7 tarjetas en dos filas (4 y 3, centradas), sin scroll: el
          ancho se limita al alto disponible para que entren las dos filas. */}
      <div
        className="flex-grow-1 d-flex flex-column align-items-center justify-content-center p-4"
        style={{ overflow: "hidden" }}
      >
        <div
          className="d-flex flex-wrap justify-content-center"
          style={{
            gap: "1.75rem",
            maxWidth: "min(1000px, calc((100vh - 200px) * 2))",
            width: "100%",
          }}
        >
          {tarjetas.map((t) => {
            const isHovered = hoveredCard === t.id;
            const ruta = `/reparaciones/sanpablo/${cosecha}/${t.id}`;
            return (
              <div
                key={t.id}
                className="d-flex flex-column align-items-center justify-content-center p-3 text-center"
                style={{
                  background: isHovered ? t.hoverBg : t.bg,
                  borderRadius: "20px",
                  width: "calc((100% - 3 * 1.75rem) / 4)",
                  aspectRatio: "1 / 1",
                  boxShadow: isHovered
                    ? `0 20px 36px -8px rgba(0, 0, 0, 0.45), 0 0 20px ${t.accentColor}40`
                    : "0 10px 25px -4px rgba(0, 0, 0, 0.25)",
                  border: `1px solid ${isHovered ? t.accentColor : "rgba(255, 255, 255, 0.12)"}`,
                  cursor: "pointer",
                  transition: "all 0.22s cubic-bezier(0.4, 0, 0.2, 1)",
                  transform: isHovered ? "translateY(-4px)" : "translateY(0)",
                  color: "#ffffff",
                  userSelect: "none",
                }}
                onClick={() => navigate(ruta)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => e.key === "Enter" && navigate(ruta)}
                onMouseEnter={() => setHoveredCard(t.id)}
                onMouseLeave={() => setHoveredCard(null)}
              >
                <div
                  className="mb-3 d-flex align-items-center justify-content-center"
                  style={{
                    width: "64px",
                    height: "64px",
                    borderRadius: "16px",
                    backgroundColor: "rgba(255, 255, 255, 0.1)",
                    border: "1px solid rgba(255, 255, 255, 0.16)",
                    boxShadow: "0 6px 16px rgba(0, 0, 0, 0.15)",
                  }}
                >
                  {t.tractor ? (
                    <TractorIcon size="2.1rem" color={t.accentColor} />
                  ) : (
                    <i className={t.icono} style={{ fontSize: "2.1rem", color: t.accentColor }}></i>
                  )}
                </div>
                <h3 className="fw-bold mb-0 text-white" style={{ fontSize: "1.2rem", lineHeight: 1.25 }}>
                  {t.titulo}
                </h3>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default ReparacionesSanPablo;
