import { useEffect, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { Container, Button, Table } from "react-bootstrap";

const formatF = (iso) =>
  iso ? new Date(iso).toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric" }) : "—";

const ESTADOS = ["pendiente", "en proceso", "terminada"];
const ESTADO_COLORES = { pendiente: "#8b4a4a", "en proceso": "#c08a2d", terminada: "#52735a" };
const ESTADO_LABELS = { pendiente: "Pendiente", "en proceso": "En proceso", terminada: "Terminada" };
const URGENCIA_COLORES = { baja: "#7aaa80", media: "#c8a800", alta: "#8b4a4a" };

function HistorialReparaciones() {
  const navigate = useNavigate();
  const { camionetaId } = useParams();
  const { state } = useLocation();
  const patente = state?.patente ?? "—";
  const marca   = state?.marca   ?? "";

  const [trabajos, setTrabajos] = useState([]);
  const [respCamioneta, setRespCamioneta] = useState("");

  const cargar = () => {
    fetch(`/api/trabajos-camioneta/${camionetaId}`)
      .then((r) => r.json())
      .then((data) => setTrabajos(Array.isArray(data) ? data : []))
      .catch(() => setTrabajos([]));
  };

  useEffect(() => {
    cargar();
    fetch(`/api/camionetas/${camionetaId}`)
      .then((r) => r.json())
      .then((c) => setRespCamioneta(c?.responsable || ""))
      .catch(() => setRespCamioneta(""));
  }, [camionetaId]);

  const cambiarEstado = async (t) => {
    const actual = t.estado ?? "pendiente";
    const nuevoEstado = ESTADOS[(ESTADOS.indexOf(actual) + 1) % ESTADOS.length];
    try {
      await fetch(`/api/trabajos-camioneta/${t._id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ estado: nuevoEstado }),
      });
      cargar();
    } catch { /* noop */ }
  };

  const historial = trabajos.filter((t) => t.estado === "terminada" || t.estado === "en proceso");

  return (
    <Container className="py-4">

      {/* Botones */}
      <div className="d-flex justify-content-end gap-2 w-75 mx-auto">
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

      {/* Título */}
      <div className="text-center w-75 mx-auto" style={{ marginTop: "2rem", marginBottom: "1.5rem" }}>
        <h3 className="fw-bold mb-0">Historial de reparaciones: {patente}{marca ? ` — ${marca}` : ""}</h3>
        <p className="text-muted mb-0" style={{ fontSize: "0.9rem" }}>Tareas en proceso y terminadas</p>
      </div>

      {/* Tabla */}
      <div className="d-flex justify-content-center">
        <div style={{ width: "75%", maxHeight: "78vh", overflowY: "auto", border: "1px solid #dee2e6", borderRadius: "4px" }}>
          <Table striped bordered hover size="sm" className="text-center align-middle mb-0" style={{ fontSize: "0.78rem" }}>
            <thead className="table-dark" style={{ position: "sticky", top: 0, zIndex: 1 }}>
              <tr className="fw-normal align-middle">
                <th className="fw-normal" style={{ width: "120px" }}>Fecha</th>
                <th className="fw-normal" style={{ minWidth: "200px", whiteSpace: "normal" }}>Reparación requerida</th>
                <th className="fw-normal" style={{ width: "180px" }}>Responsable</th>
                <th className="fw-normal" style={{ width: "120px" }}>Estado</th>
                <th className="fw-normal" style={{ width: "100px" }}>Urgencia</th>
                <th className="fw-normal" style={{ width: "80px" }}></th>
              </tr>
            </thead>
            <tbody>
              {historial.length === 0 && <tr><td colSpan={6} className="text-muted py-3">Sin registros</td></tr>}
              {historial.map((t) => (
                <tr key={t._id}>
                  <td>{formatF(t.fecha)}</td>
                  <td className="text-start" style={{ minWidth: "200px", whiteSpace: "normal", wordBreak: "break-word" }}>{t.descripcion}</td>
                  <td>{t.responsable || respCamioneta || "—"}</td>
                  <td>
                    <Button
                      size="sm"
                      onClick={() => cambiarEstado(t)}
                      style={{ backgroundColor: ESTADO_COLORES[t.estado ?? "pendiente"], border: "none", color: "#fff", fontSize: "0.78rem", fontWeight: "600", minWidth: "100px" }}
                    >
                      {ESTADO_LABELS[t.estado ?? "pendiente"]}
                    </Button>
                  </td>
                  <td>
                    <span style={{ display: "inline-block", backgroundColor: URGENCIA_COLORES[t.urgencia ?? "baja"], color: "#fff", borderRadius: "6px", padding: "4px 12px", fontSize: "0.78rem", fontWeight: "600", textTransform: "capitalize" }}>
                      {t.urgencia ?? "baja"}
                    </span>
                  </td>
                  <td>
                    <Button size="sm"
                      onClick={() => navigate(`/camionetas/services/reparaciones/${camionetaId}/tarea/${t._id}`, {
                        state: { patente, marca, trabajo: t }
                      })}
                      style={{ backgroundColor: "#4a6fa5", border: "none" }}>
                      Ver
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        </div>
      </div>
    </Container>
  );
}

export default HistorialReparaciones;
