import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Container, Button } from "react-bootstrap";

function ServicesReparaciones() {
  const navigate = useNavigate();
  const [camionetas, setCamionetas] = useState([]);

  useEffect(() => {
    fetch("/api/camionetas").then((r) => r.json()).then(setCamionetas).catch(() => setCamionetas([]));
  }, []);

  return (
    <Container className="py-4">
      <div style={{ position: "relative", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: "2.5rem" }}>
        <h2 className="mb-0 fw-bold text-center">Trabajos Realizados en Camionetas</h2>
        <div className="d-flex gap-2" style={{ position: "absolute", right: 0 }}>
          <Button onClick={() => navigate("/camionetas/services")} style={{ backgroundColor: "#fff", border: "1px solid #000", color: "#000" }}>
            <i className="bi bi-arrow-left me-2"></i>Services
          </Button>
          <Button onClick={() => navigate("/camionetas/resumen")} style={{ backgroundColor: "#fff", border: "1px solid #000", color: "#000" }}>
            <i className="bi bi-speedometer me-2"></i>Tablero
          </Button>
          <Button onClick={() => navigate("/")} style={{ backgroundColor: "#fff", border: "1px solid #000", color: "#000" }}>
            <i className="bi bi-house-fill me-2"></i>General
          </Button>
        </div>
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: "1.2rem", justifyContent: "center", marginBottom: "2rem" }}>
        {camionetas.map((c) => (
          <div
            key={c._id}
            onClick={() => navigate(`/camionetas/services/reparaciones/${c._id}`, { state: { patente: c.patente, marca: c.marca } })}
            style={{
              backgroundColor: "#4a6fa5",
              color: "#fff",
              borderRadius: "10px",
              padding: "1.2rem 1.6rem",
              cursor: "pointer",
              boxShadow: "3px 3px 8px rgba(0,0,0,0.25)",
              userSelect: "none",
              transition: "transform 0.15s ease, box-shadow 0.15s ease",
              width: "160px",
              height: "100px",
              textAlign: "center",
            }}
            onMouseEnter={(e) => { e.currentTarget.style.transform = "scale(1.06)"; e.currentTarget.style.boxShadow = "5px 5px 14px rgba(0,0,0,0.35)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.transform = "scale(1)"; e.currentTarget.style.boxShadow = "3px 3px 8px rgba(0,0,0,0.25)"; }}
          >
            <div style={{ fontSize: "1.4rem", fontWeight: "700" }}>{c.patente}</div>
            <div style={{ fontSize: "0.85rem", opacity: 0.85, marginTop: "4px" }}>{c.marca}</div>
          </div>
        ))}
        {camionetas.length === 0 && (
          <p className="text-muted">Sin camionetas registradas.</p>
        )}
      </div>
    </Container>
  );
}

export default ServicesReparaciones;
