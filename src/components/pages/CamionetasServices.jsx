import { useNavigate } from "react-router-dom";
import { Button } from "react-bootstrap";

const tarjetas = [
  {
    titulo: "Kilómetros",
    ruta: "/camionetas/services/kilometros",
    bg: "#1565c0",
    icono: "bi bi-speedometer2",
  },
  {
    titulo: "Último service",
    ruta: "/camionetas/services/ultimo-service",
    bg: "#2e7d32",
    icono: "bi bi-calendar-check-fill",
  },
  {
    titulo: "Reparaciones",
    ruta: "/camionetas/services/reparaciones",
    bg: "#b71c1c",
    icono: "bi bi-tools",
  },
];

function CamionetasServices() {
  const navigate = useNavigate();

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <div className="d-flex justify-content-between align-items-center" style={{ padding: "1rem 2rem 0" }}>
        <h3 className="fw-bold mb-0">Services — Camionetas</h3>
        <div className="d-flex gap-2">
          <Button onClick={() => navigate("/camionetas")} style={{ backgroundColor: "#fff", border: "1px solid #000", color: "#000" }}>
            <i className="bi bi-arrow-left me-2"></i>Camionetas
          </Button>
          <Button onClick={() => navigate("/")} style={{ backgroundColor: "#fff", border: "1px solid #000", color: "#000" }}>
            <i className="bi bi-house-fill me-2"></i>Tablero
          </Button>
        </div>
      </div>
      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: "2.5rem", padding: "2rem", overflow: "hidden" }}>
      {tarjetas.map((t) => (
        <div
          key={t.ruta}
          className="d-flex flex-column align-items-center justify-content-center text-white"
          style={{
            backgroundColor: t.bg,
            borderRadius: "16px",
            width: "250px",
            height: "250px",
            boxShadow: "6px 6px 18px rgba(0,0,0,0.35)",
            cursor: "pointer",
            transition: "transform 0.2s ease, box-shadow 0.2s ease",
            userSelect: "none",
          }}
          onClick={() => navigate(t.ruta)}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => e.key === "Enter" && navigate(t.ruta)}
          onMouseEnter={(e) => { e.currentTarget.style.transform = "scale(1.08)"; e.currentTarget.style.boxShadow = "8px 8px 24px rgba(0,0,0,0.45)"; }}
          onMouseLeave={(e) => { e.currentTarget.style.transform = "scale(1)"; e.currentTarget.style.boxShadow = "6px 6px 18px rgba(0,0,0,0.35)"; }}
        >
          <i className={t.icono} style={{ fontSize: "4rem" }}></i>
          <h2 className="fw-bold text-center mt-3">{t.titulo}</h2>
        </div>
      ))}
      </div>
    </div>
  );
}

export default CamionetasServices;
