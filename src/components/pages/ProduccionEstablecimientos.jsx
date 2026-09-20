import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Container } from "react-bootstrap";
import { nombreEstablecimiento } from "../../utils/establecimientos";

// Los campos donde se produce. Es la entrada de Producción: todo lo demás
// cuelga de uno de estos. Para sumar otro alcanza con agregar una entrada acá
// y su ruta en App.jsx.
//
// Cada uno lleva su color, para distinguirlos de un vistazo.
//
// En el medio va la tarjeta chica de Variables (18/09/2026), con el estilo de
// la de Repuestos en Tractores: no es un campo, es lo que vale para todos
// (precios, lotes, valores admisibles).
const ESTABLECIMIENTOS = [
  {
    id: "caspinchango",
    // El nombre sale de utils/establecimientos.js: la clave sigue siendo
    // caspinchango, pero el campo se llama Berdina en todo el proyecto.
    titulo: nombreEstablecimiento("caspinchango"),
    subtitulo: "Certificaciones mensuales del personal",
    icono: "bi bi-file-earmark-text-fill",
    destino: "/produccion/certificados",
    colores: {
      fondo: "linear-gradient(135deg, #1b4332 0%, #2d6a4f 100%)",
      fondoHover: "linear-gradient(135deg, #081c15 0%, #1b4332 100%)",
      borde: "#10b981",
      icono: "#6ee7b7",
      brillo: "rgba(16,185,129,0.25)",
    },
  },
  {
    id: "variables",
    titulo: "Variables",
    icono: "bi bi-sliders",
    destino: "/produccion/variables",
    chica: true,
    colores: {
      fondo: "linear-gradient(135deg, #0e7490 0%, #155e75 100%)",
      fondoHover: "linear-gradient(135deg, #164e63 0%, #0e7490 100%)",
      borde: "#67e8f9",
      icono: "#67e8f9",
      brillo: "rgba(6,182,212,0.4)",
    },
  },
  {
    id: "san-pablo",
    titulo: "San Pablo",
    subtitulo: "Certificaciones mensuales del personal",
    icono: "bi bi-tree-fill",
    destino: "/produccion/san-pablo",
    colores: {
      fondo: "linear-gradient(135deg, #7f1d1d 0%, #a13d3d 100%)",
      fondoHover: "linear-gradient(135deg, #450a0a 0%, #7f1d1d 100%)",
      borde: "#ef4444",
      icono: "#fca5a5",
      brillo: "rgba(239,68,68,0.25)",
    },
  },
];

function ProduccionEstablecimientos() {
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
            Establecimientos
          </span>
        </div>

        {/* Tarjetas de los campos */}
        <div className="flex-grow-1 d-flex align-items-center justify-content-center">
          <div
            className="d-flex justify-content-center align-items-center"
            style={{
              gap: "1.75rem",
              width: "100%",
              maxWidth: "740px",
              margin: "0 auto",
            }}
          >
            {ESTABLECIMIENTOS.map((e) => {
              const isHovered = hovered === e.id;

              // La chica del medio: solo el ícono y el título.
              if (e.chica) {
                return (
                  <div
                    key={e.id}
                    className="d-flex flex-column align-items-center justify-content-center text-center p-2 flex-shrink-0"
                    style={{
                      background: isHovered ? e.colores.fondoHover : e.colores.fondo,
                      borderRadius: "18px",
                      width: "104px",
                      height: "70px",
                      color: "#fff",
                      cursor: "pointer",
                      border: "2px solid rgba(255,255,255,0.3)",
                      boxShadow: isHovered
                        ? `0 16px 32px rgba(0,0,0,0.5), 0 0 20px ${e.colores.brillo}`
                        : "0 8px 24px rgba(0,0,0,0.35)",
                      transition: "transform 0.2s cubic-bezier(0.4, 0, 0.2, 1), box-shadow 0.2s ease",
                      transform: isHovered ? "scale(1.08)" : "scale(1)",
                      userSelect: "none",
                    }}
                    onClick={() => navigate(e.destino)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(t) => t.key === "Enter" && navigate(e.destino)}
                    onMouseEnter={() => setHovered(e.id)}
                    onMouseLeave={() => setHovered(null)}
                  >
                    <div
                      className="d-flex align-items-center justify-content-center mb-1"
                      style={{
                        width: "28px",
                        height: "28px",
                        borderRadius: "8px",
                        backgroundColor: "rgba(255,255,255,0.15)",
                      }}
                    >
                      <i className={e.icono} style={{ fontSize: "1.1rem", color: e.colores.icono }}></i>
                    </div>
                    <span className="fw-bold text-center mb-0" style={{ fontSize: "0.9rem" }}>
                      {e.titulo}
                    </span>
                  </div>
                );
              }

              return (
                <div
                  key={e.id}
                  className="d-flex flex-column align-items-center justify-content-center text-center p-4"
                  style={{
                    background: isHovered ? e.colores.fondoHover : e.colores.fondo,
                    borderRadius: "20px",
                    flex: 1,
                    maxWidth: "300px",
                    height: "230px",
                    color: "#fff",
                    cursor: "pointer",
                    border: `1px solid ${isHovered ? e.colores.borde : "rgba(255,255,255,0.12)"}`,
                    boxShadow: isHovered
                      ? `0 18px 30px -10px rgba(0,0,0,0.4), 0 0 16px ${e.colores.brillo}`
                      : "0 8px 18px -6px rgba(0,0,0,0.25)",
                    transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
                    transform: isHovered ? "translateY(-4px)" : "translateY(0)",
                    userSelect: "none",
                  }}
                  onClick={() => navigate(e.destino)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(t) => t.key === "Enter" && navigate(e.destino)}
                  onMouseEnter={() => setHovered(e.id)}
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
                    <i className={e.icono} style={{ fontSize: "2.1rem", color: e.colores.icono }}></i>
                  </div>

                  <span className="fw-bold" style={{ fontSize: "1.25rem", letterSpacing: "0.2px" }}>
                    {e.titulo}
                  </span>

                  <span
                    className="mt-2 px-2"
                    style={{ fontSize: "0.82rem", color: "rgba(255,255,255,0.72)" }}
                  >
                    {e.subtitulo}
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

export default ProduccionEstablecimientos;
