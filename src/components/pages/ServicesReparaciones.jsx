import { useNavigate } from "react-router-dom";
import { Container, Button } from "react-bootstrap";

function ServicesReparaciones() {
  const navigate = useNavigate();
  return (
    <Container className="py-4">
      <div className="d-flex justify-content-between align-items-center mb-4">
        <div className="d-flex align-items-center gap-3">
          <i className="bi bi-tools text-danger" style={{ fontSize: "2.5rem" }}></i>
          <h2 className="mb-0 fw-bold">Reparaciones</h2>
        </div>
        <div className="d-flex gap-2">
          <Button onClick={() => navigate("/camionetas/services")} style={{ backgroundColor: "#fff", border: "1px solid #000", color: "#000" }}>
            <i className="bi bi-arrow-left me-2"></i>Services
          </Button>
          <Button onClick={() => navigate("/")} style={{ backgroundColor: "#fff", border: "1px solid #000", color: "#000" }}>
            <i className="bi bi-house-fill me-2"></i>Tablero
          </Button>
        </div>
      </div>
    </Container>
  );
}

export default ServicesReparaciones;
