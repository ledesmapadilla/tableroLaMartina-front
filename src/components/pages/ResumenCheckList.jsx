import { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Container, Table, Button } from "react-bootstrap";

const MESES = ["enero", "marzo", "mayo", "julio", "septiembre", "noviembre"];
const AÑO_DESDE = 2026;
const AÑOS = Array.from({ length: 10 }, (_, i) => AÑO_DESDE + i);

const SOMBRA = "3px 3px 6px rgba(0,0,0,0.45)";

const getEstiloBtn = (estado, puntuacion) => {
  if (estado !== "realizado") return { backgroundColor: "#555", color: "#fff", border: "none", boxShadow: SOMBRA };
  if (puntuacion <= 4)  return { backgroundColor: "#e07070", color: "#fff", border: "none", boxShadow: SOMBRA };
  if (puntuacion <= 7)  return { backgroundColor: "#d4b84a", color: "#fff", border: "none", boxShadow: SOMBRA };
  return { backgroundColor: "#6dbf7e", color: "#fff", border: "none", boxShadow: SOMBRA };
};

function ResumenCheckList() {
  const navigate = useNavigate();
  const [año, setAño] = useState(new Date().getFullYear());
  const [camionetas, setCamionetas] = useState([]);
  const [programas, setProgramas] = useState([]);
  const [dropdownAbierto, setDropdownAbierto] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    const handler = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target))
        setDropdownAbierto(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  useEffect(() => {
    fetch("/api/camionetas")
      .then((r) => r.json())
      .then(setCamionetas)
      .catch(() => setCamionetas([]));
  }, []);

  useEffect(() => {
    fetch(`/api/programa-checklist/${año}`)
      .then((r) => r.json())
      .then(setProgramas)
      .catch(() => setProgramas([]));
  }, [año]);

  const getMes = (camionetaId, mes) => {
    const prog = programas.find((p) => p.camioneta?._id === camionetaId);
    return prog?.[mes] ?? { estado: "pendiente", puntuacion: null };
  };

  return (
    <Container className="py-4">

      {/* Encabezado */}
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h3 className="fw-bold mb-0">Resumen Check List — Camionetas</h3>
        <div className="d-flex gap-2">
          <Button onClick={() => navigate("/camionetas")} style={{ backgroundColor: "#fff", border: "1px solid #000", color: "#000" }}>
            <i className="bi bi-arrow-left me-2"></i>Camionetas
          </Button>
          <Button onClick={() => navigate("/")} style={{ backgroundColor: "#fff", border: "1px solid #000", color: "#000" }}>
            <i className="bi bi-house-fill me-2"></i>Tablero
          </Button>
        </div>
      </div>

      {/* Selector de año */}
      <div className="d-flex align-items-center gap-2 mb-4" ref={dropdownRef} style={{ position: "relative" }}>
        <span
          onClick={() => setDropdownAbierto((v) => !v)}
          style={{ display: "inline-block", backgroundColor: "#666", color: "#fff", borderRadius: "4px", padding: "6px 28px", boxShadow: "3px 3px 6px rgba(0,0,0,0.45)", fontWeight: "bold", fontSize: "1.4rem", cursor: "pointer", userSelect: "none" }}
        >
          {año}
        </span>

        {dropdownAbierto && (
          <div style={{ position: "absolute", top: "110%", left: 0, backgroundColor: "#fff", border: "1.5px solid #aaa", borderRadius: "6px", boxShadow: "3px 3px 10px rgba(0,0,0,0.25)", zIndex: 200, minWidth: "90px" }}>
            {AÑOS.map((a) => (
              <div
                key={a}
                onClick={() => { setAño(a); setDropdownAbierto(false); }}
                style={{ padding: "6px 18px", cursor: "pointer", fontWeight: a === año ? "bold" : "normal", backgroundColor: a === año ? "#e3f0ff" : "transparent", borderRadius: "4px" }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = "#e3f0ff"}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = a === año ? "#e3f0ff" : "transparent"}
              >
                {a}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Tabla */}
      <Table bordered className="text-center align-middle w-75 mx-auto">
        <thead className="table-dark">
          <tr>
            <th>Camioneta</th>
            {MESES.map((m) => (
              <th key={m} style={{ textTransform: "capitalize" }}>{m}</th>
            ))}
            <th>Promedio</th>
          </tr>
        </thead>
        <tbody>
          {camionetas.map((c) => {
            const puntuaciones = MESES.map((mes) => getMes(c._id, mes))
              .filter(({ estado, puntuacion }) => estado === "realizado" && puntuacion != null)
              .map(({ puntuacion }) => puntuacion);
            const promedio = puntuaciones.length > 0
              ? (puntuaciones.reduce((a, b) => a + b, 0) / puntuaciones.length).toFixed(1)
              : null;
            return (
              <tr key={c._id}>
                <td className="fw-semibold text-start">
                  <span style={{ display: "inline-block", backgroundColor: "#2979c0", color: "#fff", borderRadius: "4px", padding: "2px 10px", boxShadow: "3px 3px 6px rgba(0,0,0,0.45)" }}>
                    {c.patente} — {c.marca}
                  </span>
                </td>
                {MESES.map((mes) => {
                  const { estado, puntuacion } = getMes(c._id, mes);
                  return (
                    <td key={mes}>
                      <Button
                        size="sm"
                        className="btn-placa"
                        style={getEstiloBtn(estado, puntuacion)}
                        onClick={() => navigate("/camionetas/checklist/form", { state: { mes, camionetaId: c._id } })}
                      >
                        {estado === "realizado"
                          ? <>Realizado {puntuacion != null && <span style={{ fontWeight: "bold", marginLeft: "4px" }}>({puntuacion})</span>}</>
                          : "Pendiente"}
                      </Button>
                    </td>
                  );
                })}
                <td className="fw-bold" style={{ fontSize: "1rem" }}>
                  {promedio != null
                    ? <span style={{ display: "inline-block", backgroundColor: promedio >= 8 ? "#6dbf7e" : promedio >= 5 ? "#d4b84a" : "#e07070", color: "#fff", borderRadius: "4px", padding: "2px 12px", boxShadow: SOMBRA }}>{promedio}</span>
                    : <span className="text-muted">—</span>}
                </td>
              </tr>
            );
          })}
        </tbody>
      </Table>

    </Container>
  );
}

export default ResumenCheckList;
