import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";

function BotonTableroFlotante() {
  const navigate = useNavigate();
  const location = useLocation();
  const [hovered, setHovered] = useState(false);

  // Si ya estamos en el tablero de control de camionetas, podemos mantenerlo visible o con estilo activo
  const esTableroActual = location.pathname === "/camionetas/resumen";

  return (
    <button
      onClick={() => navigate("/camionetas/resumen")}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      title="Tablero de Control - Camionetas"
      style={{
        position: "fixed",
        top: "25%",
        right: 0,
        zIndex: 1040,
        width: "44px",
        height: "44px",
        backgroundColor: esTableroActual ? "#0f172a" : hovered ? "#334155" : "#1e293b",
        color: "#ffffff",
        borderTopLeftRadius: "12px",
        borderBottomLeftRadius: "12px",
        borderTopRightRadius: "0px",
        borderBottomRightRadius: "0px",
        border: "1px solid #475569",
        borderRight: "none",
        boxShadow: hovered
          ? "-4px 4px 14px rgba(0, 0, 0, 0.35)"
          : "-2px 3px 8px rgba(0, 0, 0, 0.22)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        cursor: "pointer",
        transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
        transform: hovered ? "translateX(-3px)" : "translateX(0)",
        padding: 0,
        outline: "none",
      }}
    >
      <i
        className="bi bi-car-front-fill"
        style={{
          fontSize: "1.25rem",
          color: esTableroActual ? "#38bdf8" : "#ffffff",
          transition: "transform 0.2s ease",
          transform: hovered ? "scale(1.1)" : "scale(1)",
        }}
      ></i>
    </button>
  );
}

export default BotonTableroFlotante;
