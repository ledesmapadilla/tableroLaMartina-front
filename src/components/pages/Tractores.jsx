import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "react-bootstrap";
import TractorIcon from "../shared/TractorIcon";

const gruposInfo = [
  { numero: 1, label: "Grupo 1", supervisor: "Jorge Rosas", bg: "#4a6fa5" },
  { numero: 2, label: "Grupo 2", supervisor: "Guillermo Bustos", bg: "#52735a" },
  { numero: 3, label: "Grupo 3", supervisor: "Carlos Chumiento", bg: "#9e8850" },
  { numero: 4, label: "Grupo 4", supervisor: "brandan alejandro", bg: "#6b5b7b" },
  { numero: 5, label: "Grupo 5", supervisor: "Elio Rojas", bg: "#7a5038" },
  { numero: 6, label: "Berdina", supervisor: "Kevin", bg: "#7a3535" },
  { numero: 7, label: "San Pablo", supervisor: "Victor", bg: "#5a6f40" },
];

function Tractores() {
  const navigate = useNavigate();
  const [tractores, setTractores] = useState([]);

  useEffect(() => {
    fetch("/api/tractores")
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) {
          setTractores(data);
        }
      })
      .catch((e) => console.error("Error al cargar tractores:", e));
  }, []);

  const getCCsPorGrupo = (grupoNum) => {
    const list = tractores
      .filter((t) => Number(t.gruppo ?? 6) === Number(grupoNum))
      .map((t) => String(t.cc || "").replace(/^cc\s*/i, "").trim())
      .filter(Boolean);

    const unicos = [...new Set(list)].sort((a, b) =>
      a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" })
    );

    return unicos.length > 0 ? unicos.join(", ") : "Sin CCs";
  };

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <div className="d-flex align-items-center" style={{ padding: "1rem 2rem 0", position: "relative" }}>
        <h3 className="fw-bold mb-0 w-100 text-center">Tractores</h3>
        <div className="d-flex gap-2" style={{ position: "absolute", right: "2rem" }}>
          <Button onClick={() => navigate(-1)} style={{ backgroundColor: "#fff", border: "1px solid #000", color: "#000" }}>
            <i className="bi bi-arrow-left me-2"></i>Volver
          </Button>
          <Button onClick={() => navigate("/")} style={{ backgroundColor: "#fff", border: "1px solid #000", color: "#000" }}>
            <i className="bi bi-house-fill me-2"></i>General
          </Button>
        </div>
      </div>

      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: "2rem", overflow: "auto" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 230px)", gap: "1.5rem" }}>
          {gruposInfo.map((g) => {
            const ccs = getCCsPorGrupo(g.numero);
            return (
              <div
                key={g.numero}
                className="d-flex flex-column align-items-center justify-content-center text-white"
                style={{
                  backgroundColor: g.bg,
                  borderRadius: "16px",
                  width: "230px",
                  minHeight: "175px",
                  padding: "1rem",
                  boxShadow: "6px 6px 18px rgba(0,0,0,0.35)",
                  cursor: "pointer",
                  transition: "transform 0.2s ease, box-shadow 0.2s ease",
                  userSelect: "none",
                }}
                onClick={() => navigate(`/tractores/grupo/${g.numero}`)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => e.key === "Enter" && navigate(`/tractores/grupo/${g.numero}`)}
                onMouseEnter={(e) => { e.currentTarget.style.transform = "scale(1.06)"; e.currentTarget.style.boxShadow = "8px 8px 24px rgba(0,0,0,0.45)"; }}
                onMouseLeave={(e) => { e.currentTarget.style.transform = "scale(1)"; e.currentTarget.style.boxShadow = "6px 6px 18px rgba(0,0,0,0.35)"; }}
              >
                <TractorIcon size="2.4rem" color="#fff" />
                <h5 className="fw-bold text-center mt-2 mb-0">{g.label}</h5>
                <small className="text-center mt-1 px-2" style={{ opacity: 0.85, fontSize: "0.75rem" }}>{g.supervisor}</small>
                <div
                  className="text-center px-2 mt-2"
                  style={{
                    color: "#000",
                    fontSize: "0.72rem",
                    fontWeight: "600",
                    lineHeight: "1.25",
                    wordBreak: "break-word",
                    width: "100%",
                  }}
                >
                  <strong>CCs:</strong> {ccs}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default Tractores;
