import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Container } from "react-bootstrap";
import { nombreEstablecimiento } from "../../utils/establecimientos";

/**
 * Elegir el campo dentro de una variable (18/09/2026).
 *
 * Variables dejó de colgar de cada campo y pasó a la entrada de Producción,
 * así que lo que sí es de un campo —hoy los lotes— pide este paso en el medio.
 * Los colores son los mismos con los que cada campo se ve en la entrada, para
 * que se reconozcan de un vistazo.
 */
const CAMPOS = [
  {
    id: "caspinchango",
    titulo: nombreEstablecimiento("caspinchango"),
    icono: "bi bi-file-earmark-text-fill",
    colores: {
      fondo: "linear-gradient(135deg, #1b4332 0%, #2d6a4f 100%)",
      fondoHover: "linear-gradient(135deg, #081c15 0%, #1b4332 100%)",
      borde: "#10b981",
      icono: "#6ee7b7",
      brillo: "rgba(16,185,129,0.25)",
    },
  },
  {
    id: "san-pablo",
    titulo: "San Pablo",
    icono: "bi bi-tree-fill",
    colores: {
      fondo: "linear-gradient(135deg, #7f1d1d 0%, #a13d3d 100%)",
      fondoHover: "linear-gradient(135deg, #450a0a 0%, #7f1d1d 100%)",
      borde: "#ef4444",
      icono: "#fca5a5",
      brillo: "rgba(239,68,68,0.25)",
    },
  },
];

function ProduccionCampoMenu({ titulo, subtitulo = "", base }) {
  const navigate = useNavigate();
  const [hovered, setHovered] = useState(null);

  return (
    <div
      style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        backgroundColor: "#f8f9fa",
        height: "100%",
        overflow: "hidden",
      }}
    >
      <Container
        fluid
        className="px-4 py-3 d-flex flex-column flex-grow-1"
        style={{ maxWidth: "940px", width: "100%", margin: "0 auto" }}
      >
        {/* Encabezado. El volver está en el navbar de Producción, arriba. */}
        <div className="d-flex align-items-center gap-2 mb-4">
          <span className="fw-bold" style={{ color: "#1b4332", fontSize: "1.05rem" }}>
            {titulo}
          </span>
          {subtitulo && (
            <span className="text-muted" style={{ fontSize: "0.78rem" }}>
              {subtitulo}
            </span>
          )}
        </div>

        <div className="flex-grow-1 d-flex align-items-center justify-content-center">
          <div
            style={{
              display: "grid",
              gridTemplateColumns: `repeat(${CAMPOS.length}, 1fr)`,
              gap: "1.75rem",
              width: "100%",
              maxWidth: "640px",
              margin: "0 auto",
            }}
          >
            {CAMPOS.map((c) => {
              const isHovered = hovered === c.id;
              const ir = () => navigate(`${base}/${c.id}`);
              return (
                <div
                  key={c.id}
                  className="d-flex flex-column align-items-center justify-content-center text-center p-4"
                  style={{
                    background: isHovered ? c.colores.fondoHover : c.colores.fondo,
                    borderRadius: "20px",
                    height: "230px",
                    color: "#fff",
                    cursor: "pointer",
                    border: `1px solid ${isHovered ? c.colores.borde : "rgba(255,255,255,0.12)"}`,
                    boxShadow: isHovered
                      ? `0 18px 30px -10px rgba(0,0,0,0.4), 0 0 16px ${c.colores.brillo}`
                      : "0 8px 18px -6px rgba(0,0,0,0.25)",
                    transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
                    transform: isHovered ? "translateY(-4px)" : "translateY(0)",
                    userSelect: "none",
                  }}
                  onClick={ir}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => e.key === "Enter" && ir()}
                  onMouseEnter={() => setHovered(c.id)}
                  onMouseLeave={() => setHovered(null)}
                >
                  <div
                    className="mb-3 d-flex align-items-center justify-content-center"
                    style={{
                      width: "66px",
                      height: "66px",
                      borderRadius: "18px",
                      backgroundColor: "rgba(255,255,255,0.1)",
                      border: "1px solid rgba(255,255,255,0.16)",
                    }}
                  >
                    <i className={c.icono} style={{ fontSize: "2.1rem", color: c.colores.icono }}></i>
                  </div>

                  <span className="fw-bold" style={{ fontSize: "1.25rem", letterSpacing: "0.2px" }}>
                    {c.titulo}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </Container>
    </div>
  );
}

export default ProduccionCampoMenu;
