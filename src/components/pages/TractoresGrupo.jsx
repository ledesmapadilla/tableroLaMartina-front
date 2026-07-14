import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Container, Button } from "react-bootstrap";

const GRUPOS = {
  1: { label: "Grupo 1", supervisor: "Jorge Rosas", bg: "#4a6fa5" },
  2: { label: "Grupo 2", supervisor: "Guillermo Bustos", bg: "#52735a" },
  3: { label: "Grupo 3", supervisor: "Carlos Chumiento", bg: "#9e8850" },
  4: { label: "Grupo 4", supervisor: "brandan alejandro", bg: "#6b5b7b" },
  5: { label: "Grupo 5", supervisor: "Elio Rojas", bg: "#7a5038" },
  6: { label: "Berdina", supervisor: "Victor", bg: "#7a3535" },
  7: { label: "San Pablo", supervisor: "Kevin", bg: "#5a6f40" },
};

function TractoresGrupo() {
  const navigate = useNavigate();
  const { grupoId } = useParams();
  const [tractores, setTractores] = useState([]);
  const [conTareaPendiente, setConTareaPendiente] = useState(new Set());
  const [paradosIds, setParadosIds] = useState(new Set());

  const infoGrupo = GRUPOS[grupoId] || { label: `Grupo ${grupoId}`, supervisor: "—", bg: "#4a6fa5" };

  useEffect(() => {
    Promise.all([
      fetch("/api/tractores").then((r) => r.json()).catch(() => []),
      fetch("/api/trabajos-tractor/pendientes/ids").then((r) => r.json()).catch(() => []),
      fetch("/api/trabajos-tractor/parados/ids").then((r) => r.json()).catch(() => []),
    ]).then(([tracs, pendientesIds, stopIds]) => {
      // Filtrar los tractores del grupo actual
      const filtrados = (tracs || []).filter((t) => Number(t.gruppo) === Number(grupoId));
      setTractores(filtrados);
      setConTareaPendiente(new Set(pendientesIds));
      setParadosIds(new Set(stopIds));
    });
  }, [grupoId]);

  return (
    <Container className="py-4">
      <div className="d-flex justify-content-between align-items-center">
        <Button onClick={() => navigate("/tractores/services/reparaciones/resumen")} style={{ backgroundColor: "#52735a", border: "none", color: "#fff" }}>
          <i className="bi bi-table me-2"></i>Resumen reparaciones
        </Button>
        <div className="d-flex gap-2">
          <Button onClick={() => navigate(-1)} style={{ backgroundColor: "#fff", border: "1px solid #000", color: "#000" }}>
            <i className="bi bi-arrow-left me-2"></i>Volver
          </Button>
          <Button onClick={() => navigate("/tractores")} style={{ backgroundColor: "#fff", border: "1px solid #000", color: "#000" }}>
            <i className="bi bi-speedometer me-2"></i>Grupos
          </Button>
          <Button onClick={() => navigate("/")} style={{ backgroundColor: "#fff", border: "1px solid #000", color: "#000" }}>
            <i className="bi bi-house-fill me-2"></i>General
          </Button>
        </div>
      </div>

      <div className="text-center" style={{ marginTop: "3rem", marginBottom: "3rem" }}>
        <h2 className="mb-1 fw-bold">Reparaciones Tractores - {infoGrupo.label}</h2>
        <h5 className="text-muted fw-normal">Supervisor: {infoGrupo.supervisor}</h5>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 180px)", gap: "1.2rem", justifyContent: "center", marginBottom: "2rem" }}>
        {tractores.map((t) => {
          const tieneTarea = conTareaPendiente.has(t._id?.toString());
          const estaParado = paradosIds.has(t._id?.toString());
          return (
            <div
              key={t._id}
              onClick={() => navigate(`/tractores/grupo/${grupoId}/reparaciones/${t._id}`, { state: { cc: t.cc, descripcion: t.descripcion } })}
              style={{
                position: "relative",
                backgroundColor: infoGrupo.bg,
                color: "#fff",
                borderRadius: "10px",
                padding: "1.2rem 1.6rem",
                cursor: "pointer",
                boxShadow: "3px 3px 8px rgba(0,0,0,0.25)",
                userSelect: "none",
                transition: "transform 0.15s ease, box-shadow 0.15s ease",
                width: "100%",
                height: "110px",
                textAlign: "center",
                display: "flex",
                flexDirection: "column",
                justifyContent: "center",
                alignItems: "center"
              }}
              onMouseEnter={(e) => { e.currentTarget.style.transform = "scale(1.06)"; e.currentTarget.style.boxShadow = "5px 5px 14px rgba(0,0,0,0.35)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.transform = "scale(1)"; e.currentTarget.style.boxShadow = "3px 3px 8px rgba(0,0,0,0.25)"; }}
            >
              {(estaParado || tieneTarea) && (
                <i
                  className="bi bi-exclamation-triangle-fill"
                  style={{
                    position: "absolute",
                    top: "6px",
                    right: "8px",
                    color: estaParado ? "#ff0000" : "#f5c518",
                    fontSize: "1.1rem"
                  }}
                />
              )}
              <div style={{ fontSize: "1.2rem", fontWeight: "700", wordBreak: "break-all" }}>CC {t.cc}</div>
              <div style={{ fontSize: "0.78rem", opacity: 0.85, marginTop: "4px", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{t.descripcion || "Sin descripción"}</div>
            </div>
          );
        })}
        {tractores.length === 0 && (
          <p className="text-muted mt-4">Sin tractores registrados en este grupo.</p>
        )}
      </div>
    </Container>
  );
}

export default TractoresGrupo;
