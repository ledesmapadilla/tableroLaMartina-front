import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Container } from "react-bootstrap";

const MESES = [
  "Enero",
  "Febrero",
  "Marzo",
  "Abril",
  "Mayo",
  "Junio",
  "Julio",
  "Agosto",
  "Septiembre",
  "Octubre",
  "Noviembre",
  "Diciembre",
];

// Qué se puede hacer dentro de un mes. La planilla de carga es una de las
// opciones, no la pantalla del mes: por eso el mes entra acá y no directo a
// los partes.
const OPCIONES = [
  {
    id: "certificados",
    titulo: "Datos certificación",
    subtitulo: "Carga de los partes diarios del mes",
    icono: "bi bi-file-earmark-text-fill",
    destino: "planilla",
  },
  {
    id: "informes",
    titulo: "Informes",
    subtitulo: "Resúmenes y exportaciones del período",
    icono: "bi bi-bar-chart-fill",
    destino: "informes",
  },
  {
    id: "variables",
    titulo: "Variables",
    subtitulo: "Variables de la certificación",
    icono: "bi bi-sliders",
    destino: "variables",
  },
];

function ProduccionCertificadoMenu() {
  const { anio, mes } = useParams();
  const navigate = useNavigate();
  const [hovered, setHovered] = useState(null);

  const titulo = `${MESES[Number(mes) - 1] || ""} ${anio}`;
  const ir = (destino) => navigate(`/produccion/certificados/${anio}/${mes}/${destino}`);

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
        {/* Encabezado: volver a la grilla de meses + mes */}
        <div className="d-flex align-items-center gap-2 mb-4">
          <button
            onClick={() => navigate("/produccion/certificados")}
            className="btn btn-sm btn-outline-secondary d-flex align-items-center gap-1 rounded-3 px-2 py-1"
            style={{ fontSize: "0.8rem" }}
            title="Volver a los meses"
          >
            <i className="bi bi-arrow-left"></i>
          </button>
          <span className="fw-bold" style={{ color: "#1b4332", fontSize: "1.05rem" }}>
            {titulo}
          </span>
        </div>

        {/* Tarjetas del mes */}
        <div className="flex-grow-1 d-flex align-items-center justify-content-center">
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(3, 1fr)",
              gap: "1.75rem",
              width: "100%",
            }}
          >
            {OPCIONES.map((o) => {
              const isHovered = hovered === o.id;
              return (
                <div
                  key={o.id}
                  className="d-flex flex-column align-items-center justify-content-center text-center p-4"
                  style={{
                    background: isHovered
                      ? "linear-gradient(135deg, #081c15 0%, #1b4332 100%)"
                      : "linear-gradient(135deg, #1b4332 0%, #2d6a4f 100%)",
                    borderRadius: "20px",
                    height: "230px",
                    color: "#fff",
                    cursor: "pointer",
                    border: `1px solid ${isHovered ? "#10b981" : "rgba(255,255,255,0.12)"}`,
                    boxShadow: isHovered
                      ? "0 18px 30px -10px rgba(0,0,0,0.4), 0 0 16px rgba(16,185,129,0.25)"
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
                    <i className={o.icono} style={{ fontSize: "2.1rem", color: "#6ee7b7" }}></i>
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

export default ProduccionCertificadoMenu;
