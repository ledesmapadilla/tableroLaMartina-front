import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import LogoNavbar from "../shared/LogoNavbar";

// La grilla tiene que entrar entera en la pantalla: se elige la cantidad de
// columnas mas cuadrada posible y las filas se reparten el alto disponible.
// Asi la pagina no scrollea aunque cambie la cantidad de colectivos.
const calcularColumnas = (total) => {
  if (total <= 0) return 1;
  return Math.min(8, Math.max(3, Math.ceil(Math.sqrt(total * 1.9))));
};

function ColectivosReparaciones() {
  const navigate = useNavigate();
  const [colectivos, setColectivos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [hoveredCard, setHoveredCard] = useState(null);

  useEffect(() => {
    fetch("/api/colectivos")
      .then((r) => (r.ok ? r.json() : []))
      .then((d) => setColectivos(Array.isArray(d) ? d : []))
      .catch(() => setColectivos([]))
      .finally(() => setLoading(false));
  }, []);

  const ordenados = useMemo(
    () =>
      [...colectivos].sort((a, b) =>
        String(a.cc || "").localeCompare(String(b.cc || ""), undefined, {
          numeric: true,
          sensitivity: "base",
        })
      ),
    [colectivos]
  );

  const columnas = calcularColumnas(ordenados.length);
  const filas = Math.max(1, Math.ceil(ordenados.length / columnas));

  return (
    <div
      style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        backgroundColor: "#f8f9fa",
        height: "100%",
        maxHeight: "100vh",
        overflow: "hidden",
      }}
    >
      {/* Barra de Cabecera Institucional */}
      <div
        className="d-flex align-items-center justify-content-between px-4 py-2 border-bottom shadow-sm flex-shrink-0"
        style={{ backgroundColor: "#1e293b", color: "#fff", height: "54px", position: "relative" }}
      >
        <LogoNavbar />
        <div className="d-flex align-items-center gap-3">
          <div
            className="rounded-3 d-flex align-items-center justify-content-center me-1"
            style={{
              width: "34px",
              height: "34px",
              backgroundColor: "#4338ca",
              color: "#fff",
              fontSize: "1.15rem",
              boxShadow: "0 2px 8px rgba(67, 56, 202, 0.3)",
            }}
          >
            <i className="bi bi-tools"></i>
          </div>
          <div className="d-flex align-items-center gap-2">
            <span className="text-white fs-6 fw-semibold">Colectivos — Reparaciones</span>
            {ordenados.length > 0 && (
              <span className="text-light opacity-75 small">• {ordenados.length} Unidades</span>
            )}
          </div>
        </div>

        {/* Botones de Navegación */}
        <div className="d-flex align-items-center gap-2">
          <button
            onClick={() => navigate(-1)}
            className="btn btn-sm btn-outline-light d-flex align-items-center gap-1.5 rounded-3 px-3 py-1"
            style={{ fontSize: "0.82rem" }}
          >
            <i className="bi bi-arrow-left"></i>
            <span>Volver</span>
          </button>
          <button
            onClick={() => navigate("/colectivo/preventivo")}
            className="btn btn-sm btn-outline-light d-flex align-items-center gap-1.5 rounded-3 px-3 py-1"
            style={{ fontSize: "0.82rem" }}
          >
            <i className="bi bi-shield-check"></i>
            <span>Preventivo</span>
          </button>
          <button
            onClick={() => navigate("/colectivo")}
            className="btn btn-sm btn-outline-light d-flex align-items-center gap-2 rounded-3 px-3 py-1"
            style={{ fontSize: "0.82rem" }}
          >
            <i className="bi bi-bus-front-fill"></i>
            <span>Colectivos</span>
          </button>
          <button
            onClick={() => navigate("/")}
            className="btn btn-sm btn-light text-dark d-flex align-items-center gap-1.5 rounded-3 px-3 py-1"
            style={{ fontSize: "0.82rem" }}
          >
            <i className="bi bi-house-door-fill"></i>
            <span>General</span>
          </button>
        </div>
      </div>

      {/* Grilla de Colectivos: una tarjeta por unidad, todas en una sola pantalla */}
      <div className="flex-grow-1 p-3 d-flex" style={{ overflow: "hidden", minHeight: 0 }}>
        {ordenados.length === 0 ? (
          <div className="flex-grow-1 d-flex align-items-center justify-content-center text-muted">
            {loading ? "Cargando colectivos..." : "Sin colectivos registrados"}
          </div>
        ) : (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: `repeat(${columnas}, minmax(0, 1fr))`,
              gridTemplateRows: `repeat(${filas}, minmax(0, 1fr))`,
              gap: "0.7rem",
              width: "100%",
              height: "100%",
              maxWidth: "1180px",
              margin: "0 auto",
            }}
          >
            {ordenados.map((c) => {
              const isHovered = hoveredCard === c._id;
              return (
                <div
                  key={c._id}
                  className="d-flex flex-column align-items-center justify-content-center text-white text-center px-2"
                  style={{
                    background: isHovered
                      ? "linear-gradient(135deg, #1e1b4b 0%, #312e81 100%)"
                      : "linear-gradient(135deg, #312e81 0%, #4338ca 100%)",
                    borderRadius: "14px",
                    minHeight: 0,
                    overflow: "hidden",
                    boxShadow: isHovered
                      ? "0 12px 24px -6px rgba(0, 0, 0, 0.4), 0 0 14px rgba(129, 140, 248, 0.35)"
                      : "0 5px 14px -2px rgba(0, 0, 0, 0.22)",
                    border: `1px solid ${isHovered ? "#818cf8" : "rgba(255, 255, 255, 0.14)"}`,
                    transition: "all 0.18s cubic-bezier(0.4, 0, 0.2, 1)",
                    transform: isHovered ? "translateY(-3px) scale(1.03)" : "translateY(0) scale(1)",
                    userSelect: "none",
                  }}
                  onMouseEnter={() => setHoveredCard(c._id)}
                  onMouseLeave={() => setHoveredCard(null)}
                  title={`CC ${c.cc}${c.patente ? ` — ${c.patente}` : ""}`}
                >
                  <i
                    className="bi bi-bus-front-fill mb-1"
                    style={{ fontSize: "1.35rem", color: "#c7d2fe" }}
                  ></i>

                  <span className="fw-bold" style={{ fontSize: "1.02rem", letterSpacing: "0.3px" }}>
                    CC {c.cc}
                  </span>

                  {c.patente && (
                    <span
                      className="badge mt-1 px-2 py-1"
                      style={{
                        backgroundColor: "rgba(255, 255, 255, 0.14)",
                        border: "1px solid rgba(255, 255, 255, 0.2)",
                        fontSize: "0.68rem",
                        fontWeight: 600,
                        letterSpacing: "0.4px",
                      }}
                    >
                      {c.patente}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

export default ColectivosReparaciones;
