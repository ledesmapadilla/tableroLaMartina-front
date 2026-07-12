import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Container, Button } from "react-bootstrap";

function ServicesReparaciones() {
  const navigate = useNavigate();
  const [camionetas, setCamionetas] = useState([]);
  const [conTareaPendiente, setConTareaPendiente] = useState(new Set());
  const [paradasIds, setParadasIds] = useState(new Set());

  useEffect(() => {
    Promise.all([
      fetch("/api/camionetas").then((r) => r.json()).catch(() => []),
      fetch("/api/trabajos-camioneta/pendientes/ids").then((r) => r.json()).catch(() => []),
      fetch("/api/paradas/abiertas/ids").then((r) => r.json()).catch(() => []),
    ]).then(([cams, pendientesIds, abIds]) => {
      setCamionetas(cams);
      setConTareaPendiente(new Set(pendientesIds));
      setParadasIds(new Set(abIds));
    });
  }, []);

  return (
    <Container className="py-4">
      <div className="d-flex justify-content-between align-items-center">
        <Button onClick={() => navigate("/camionetas/services/reparaciones/resumen")} style={{ backgroundColor: "#52735a", border: "none", color: "#fff" }}>
          <i className="bi bi-table me-2"></i>Resumen reparaciones
        </Button>
        <div className="d-flex gap-2">
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

      <div className="text-center" style={{ marginTop: "4rem", marginBottom: "4rem" }}>
        <h2 className="mb-0 fw-bold">Reparaciones Camionetas</h2>
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: "1.2rem", justifyContent: "center", marginBottom: "2rem" }}>
        {camionetas.map((c) => {
          const tieneTarea = conTareaPendiente.has(c._id?.toString());
          const estaParada = paradasIds.has(c._id?.toString());
          return (
            <div
              key={c._id}
              onClick={() => navigate(`/camionetas/services/reparaciones/${c._id}`, { state: { patente: c.patente, marca: c.marca } })}
              style={{
                position: "relative",
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
              {(estaParada || tieneTarea) && (
                <i
                  className="bi bi-exclamation-triangle-fill"
                  style={{
                    position: "absolute",
                    top: "6px",
                    right: "8px",
                    color: estaParada ? "#ff0000" : "#f5c518",
                    fontSize: "1.1rem"
                  }}
                />
              )}
              <div style={{ fontSize: "1.4rem", fontWeight: "700" }}>{c.patente}</div>
              <div style={{ fontSize: "0.85rem", opacity: 0.85, marginTop: "4px" }}>{c.marca}</div>
            </div>
          );
        })}
        {camionetas.length === 0 && (
          <p className="text-muted">Sin camionetas registradas.</p>
        )}
      </div>
    </Container>
  );
}

export default ServicesReparaciones;
