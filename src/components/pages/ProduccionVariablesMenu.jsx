import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Container } from "react-bootstrap";

/**
 * Las variables de la certificación de un campo (17/09/2026).
 *
 * Antes Variables era una sola pantalla (los precios). Ahora es un menú:
 * arranca con Remuneración, que es esa misma pantalla, y Lotes, donde se dan
 * de alta los lotes con sus cantidades. Las dos valen para todos los meses,
 * por eso cuelgan de la pantalla de certificados y no de un año y mes.
 */
const OPCIONES = [
  {
    id: "remuneracion",
    titulo: "Remuneración",
    subtitulo: "El precio con el que se paga cada tarea",
    icono: "bi bi-sliders",
    destino: "remuneracion",
    colores: {
      fondo: "linear-gradient(135deg, #1b4332 0%, #2d6a4f 100%)",
      fondoHover: "linear-gradient(135deg, #081c15 0%, #1b4332 100%)",
      borde: "#10b981",
      icono: "#6ee7b7",
      brillo: "rgba(16,185,129,0.25)",
    },
  },
  {
    id: "lotes",
    titulo: "Lotes",
    subtitulo: "Los lotes del campo, con sus hectáreas y plantas",
    icono: "bi bi-map-fill",
    destino: "lotes",
    colores: {
      fondo: "linear-gradient(135deg, #7c2d12 0%, #b45309 100%)",
      fondoHover: "linear-gradient(135deg, #431407 0%, #7c2d12 100%)",
      borde: "#fbbf24",
      icono: "#fde68a",
      brillo: "rgba(251,191,36,0.25)",
    },
  },
];

function ProduccionVariablesMenu({ base = "/produccion/certificados" }) {
  const navigate = useNavigate();
  const [hovered, setHovered] = useState(null);

  const ir = (destino) => navigate(`${base}/variables/${destino}`);

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
            Variables
          </span>
          <span className="text-muted" style={{ fontSize: "0.78rem" }}>
            Rigen para todos los meses
          </span>
        </div>

        <div className="flex-grow-1 d-flex align-items-center justify-content-center">
          <div
            style={{
              display: "grid",
              gridTemplateColumns: `repeat(${OPCIONES.length}, 1fr)`,
              gap: "1.75rem",
              width: "100%",
              maxWidth: "640px",
              margin: "0 auto",
            }}
          >
            {OPCIONES.map((o) => {
              const isHovered = hovered === o.id;
              return (
                <div
                  key={o.id}
                  className="d-flex flex-column align-items-center justify-content-center text-center p-4"
                  style={{
                    background: isHovered ? o.colores.fondoHover : o.colores.fondo,
                    borderRadius: "20px",
                    height: "230px",
                    color: "#fff",
                    cursor: "pointer",
                    border: `1px solid ${isHovered ? o.colores.borde : "rgba(255,255,255,0.12)"}`,
                    boxShadow: isHovered
                      ? `0 18px 30px -10px rgba(0,0,0,0.4), 0 0 16px ${o.colores.brillo}`
                      : "0 8px 18px -6px rgba(0,0,0,0.25)",
                    transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
                    transform: isHovered ? "translateY(-4px)" : "translateY(0)",
                    userSelect: "none",
                  }}
                  onClick={() => ir(o.destino)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => e.key === "Enter" && ir(o.destino)}
                  onMouseEnter={() => setHovered(o.id)}
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
                    <i className={o.icono} style={{ fontSize: "2.1rem", color: o.colores.icono }}></i>
                  </div>

                  <span className="fw-bold" style={{ fontSize: "1.25rem", letterSpacing: "0.2px" }}>
                    {o.titulo}
                  </span>

                  <span
                    className="mt-2 px-2"
                    style={{ fontSize: "0.82rem", color: "rgba(255,255,255,0.72)" }}
                  >
                    {o.subtitulo}
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

export default ProduccionVariablesMenu;
