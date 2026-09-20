import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Container } from "react-bootstrap";
import { usePermisos } from "../../context/permisos";
import { grillaCentrada } from "../../utils/grillaTarjetas";

/**
 * Las variables de Producción (17/09/2026, movidas a la entrada el
 * 18/09/2026).
 *
 * Antes Variables era una sola pantalla (los precios) y colgaba de adentro de
 * cada campo. Ahora es la tarjeta chica del medio en la entrada de Producción,
 * porque lo que hay acá vale para todos los campos y para todos los meses:
 * Remuneración (el precio de cada tarea), Lotes (el padrón de cada campo) y
 * Valores admisibles.
 */
const OPCIONES = [
  {
    id: "remuneracion",
    titulo: "Remuneración",
    subtitulo: "El precio con el que se paga cada tarea",
    icono: "bi bi-sliders",
    destino: "remuneracion",
    permiso: "produccion.variables",
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
    subtitulo: "Los lotes de cada campo, con sus hectáreas y plantas",
    icono: "bi bi-map-fill",
    destino: "lotes",
    permiso: "produccion.lotes",
    colores: {
      fondo: "linear-gradient(135deg, #7c2d12 0%, #b45309 100%)",
      fondoHover: "linear-gradient(135deg, #431407 0%, #7c2d12 100%)",
      borde: "#fbbf24",
      icono: "#fde68a",
      brillo: "rgba(251,191,36,0.25)",
    },
  },
  {
    id: "admisibles",
    titulo: "Valores admisibles",
    subtitulo: "El consumo admisible con el que se mide el desvío",
    icono: "bi bi-speedometer2",
    destino: "admisibles",
    permiso: "produccion.admisibles",
    colores: {
      fondo: "linear-gradient(135deg, #3730a3 0%, #4f46e5 100%)",
      fondoHover: "linear-gradient(135deg, #1e1b4b 0%, #3730a3 100%)",
      borde: "#818cf8",
      icono: "#c7d2fe",
      brillo: "rgba(129,140,248,0.25)",
    },
  },
];

function ProduccionVariablesMenu({ base = "/produccion" }) {
  const navigate = useNavigate();
  const { puede } = usePermisos();
  const [hovered, setHovered] = useState(null);

  // Cada tarjeta tiene su fila en la tabla de Roles: se muestran las que el
  // rol puede ver.
  const opciones = OPCIONES.filter((o) => puede(o.permiso));

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
            style={{ ...grillaCentrada(opciones.length, { ancho: 300 }), gap: "1.75rem" }}
          >
            {opciones.map((o) => {
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
