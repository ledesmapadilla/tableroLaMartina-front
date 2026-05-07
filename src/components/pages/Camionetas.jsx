import { useNavigate } from "react-router-dom";
import { Button } from "react-bootstrap";

const tarjetas = [
  {
    titulo: "Check List",
    ruta: "/camionetas/checklist",
    bg: "#4a6fa5",
    icono: "bi bi-clipboard2-check-fill",
  },
  {
    titulo: "Services",
    ruta: "/camionetas/services",
    bg: "#52735a",
    icono: "bi bi-gear-fill",
  },
  {
    titulo: "Tablero de Control",
    ruta: "/camionetas/resumen",
    bg: "#6b5b7b",
    icono: "bi bi-speedometer",
  },
];

function Camionetas() {
  const navigate = useNavigate();

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <div className="d-flex align-items-center" style={{ padding: "1rem 2rem 0", position: "relative" }}>
        <h3 className="fw-bold mb-0 w-100 text-center">Camionetas</h3>
        <div className="d-flex gap-2" style={{ position: "absolute", right: "2rem" }}>
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
            className="d-flex flex-column align-items-center justify-content-center text-white"
            style={{
              backgroundColor: t.bg,
              borderRadius: "16px",
              width: "280px",
              height: "280px",
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
            <h2 className="fw-bold text-center mt-3" style={{ paddingLeft: "1.5rem", paddingRight: "1.5rem" }}>{t.titulo}</h2>
          </div>
        ))}
      </div>
    </div>
  );
}

export default Camionetas;

