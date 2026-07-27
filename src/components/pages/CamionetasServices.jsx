import { useNavigate } from "react-router-dom";
import { Button } from "react-bootstrap";

const tarjetas = [
  {
    titulo: "Kilómetros",
    ruta: "/camionetas/services/kilometros",
    bg: "rgba(74, 111, 165, 0.85)",
    bgHover: "rgba(74, 111, 165, 0.65)",
    icono: "bi bi-speedometer2",
  },
  {
    titulo: "Último service",
    ruta: "/camionetas/services/ultimo-service",
    bg: "rgba(35, 115, 60, 0.92)",
    bgHover: "rgba(45, 140, 75, 0.78)",
    icono: "bi bi-calendar-check-fill",
  },
  {
    titulo: "Reparaciones",
    ruta: "/camionetas/services/reparaciones",
    bg: "rgba(255, 0, 0, 0.9)",
    bgHover: "rgba(255, 30, 30, 0.75)",
    icono: "bi bi-tools",
  },
];

function CamionetasServices() {
  const navigate = useNavigate();

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <div className="d-flex align-items-center" style={{ padding: "1rem 2rem 0", position: "relative" }}>
        <h3 className="fw-bold mb-0 w-100 text-center">Services - Camionetas</h3>
        <div className="d-flex gap-2" style={{ position: "absolute", right: "2rem" }}>
          <Button onClick={() => navigate(-1)} style={{ backgroundColor: "#fff", border: "1px solid #000", color: "#000" }}>
            <i className="bi bi-arrow-left me-2"></i>Volver
          </Button>
          <Button onClick={() => navigate("/camionetas/resumen")} style={{ backgroundColor: "#fff", border: "1px solid #000", color: "#000" }}>
            <i className="bi bi-speedometer me-2"></i>Tablero
          </Button>
          <Button onClick={() => navigate("/")} style={{ backgroundColor: "#fff", border: "1px solid #000", color: "#000" }}>
            <i className="bi bi-house-fill me-2"></i>General
          </Button>
        </div>
      </div>
      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: "2.5rem", padding: "2rem", overflow: "hidden" }}>
      {tarjetas.map((t) => (
        <div
          key={t.ruta}
          className="d-flex flex-column align-items-center justify-content-center text-black"
          style={{
            backgroundColor: t.bg,
            borderRadius: "16px",
            width: "250px",
            height: "250px",
            boxShadow: "6px 6px 18px rgba(0,0,0,0.25)",
            cursor: "pointer",
            transition: "transform 0.2s ease, box-shadow 0.2s ease, background-color 0.2s ease",
            userSelect: "none",
            backdropFilter: "blur(4px)",
          }}
          onClick={() => navigate(t.ruta)}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => e.key === "Enter" && navigate(t.ruta)}
          onMouseEnter={(e) => { e.currentTarget.style.transform = "scale(1.08)"; e.currentTarget.style.boxShadow = "8px 8px 24px rgba(0,0,0,0.35)"; e.currentTarget.style.backgroundColor = t.bgHover; }}
          onMouseLeave={(e) => { e.currentTarget.style.transform = "scale(1)"; e.currentTarget.style.boxShadow = "6px 6px 18px rgba(0,0,0,0.25)"; e.currentTarget.style.backgroundColor = t.bg; }}
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


