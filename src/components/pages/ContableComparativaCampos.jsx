import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Container } from "react-bootstrap";
import { CAMPOS_COMPARATIVA, MESES, TIPOS_COMPARATIVA } from "../../utils/contable";

/**
 * La entrada de la Comparativa de un mes (05/11/2026): una tarjeta por campo,
 * con los colores de la entrada de Producción. Cada una lleva a la tabla de
 * ese campo (ContableComparativa.jsx).
 */
function ContableComparativaCampos({ tipo = "cantidad" }) {
  const { ruta, titulo: nombre, colores: col } = TIPOS_COMPARATIVA[tipo] || TIPOS_COMPARATIVA.cantidad;
  const { anio, mes } = useParams();
  const navigate = useNavigate();
  const [hovered, setHovered] = useState(null);
  const titulo = `${MESES[Number(mes) - 1] || ""} ${anio}`;
  const ir = (c) => navigate(`/contable/${anio}/${mes}/${ruta}/${c.id}`);

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
        {/* Encabezado. El volver está en el navbar de Contable, arriba. */}
        <div className="d-flex align-items-center gap-2 mb-4">
          <i className={`bi ${tipo === "costos" ? "bi-cash-stack" : "bi-bar-chart-line-fill"}`} style={{ color: col.medio, fontSize: "1.15rem" }}></i>
          <span className="fw-bold" style={{ color: col.oscuro, fontSize: "1.05rem" }}>
            {nombre} - {titulo}
          </span>
        </div>

        <div className="flex-grow-1 d-flex align-items-center justify-content-center">
          <div
            className="d-flex justify-content-center align-items-center"
            style={{ gap: "1.75rem", width: "100%", maxWidth: "640px", margin: "0 auto" }}
          >
            {CAMPOS_COMPARATIVA.map((c) => {
              const isHovered = hovered === c.id;
              return (
                <div
                  key={c.id}
                  className="d-flex flex-column align-items-center justify-content-center text-center p-4"
                  style={{
                    background: isHovered ? c.colores.fondoHover : c.colores.fondo,
                    borderRadius: "20px",
                    flex: 1,
                    maxWidth: "300px",
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
                  onClick={() => ir(c)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => e.key === "Enter" && ir(c)}
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
                  <span className="mt-2 px-2" style={{ fontSize: "0.82rem", color: "rgba(255,255,255,0.72)" }}>
                    Pagado por Ctv y certificado en LM
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

export default ContableComparativaCampos;
