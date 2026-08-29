import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Container } from "react-bootstrap";

// El primer año con certificados. No se puede retroceder más allá.
const ANIO_INICIAL = 2026;

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

function ProduccionCertificados() {
  const navigate = useNavigate();
  const hoy = new Date();
  const [anio, setAnio] = useState(ANIO_INICIAL);
  const [hovered, setHovered] = useState(null);

  const esAnioEnCurso = anio === hoy.getFullYear();

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
        style={{ maxWidth: "880px", width: "100%", margin: "0 auto" }}
      >
        {/* Encabezado + selector de año */}
        <div className="d-flex align-items-center justify-content-between gap-3 mb-4 flex-wrap">
          <div className="d-flex align-items-center gap-2">
            <div
              className="rounded-3 d-flex align-items-center justify-content-center"
              style={{
                width: "34px",
                height: "34px",
                backgroundColor: "#10b981",
                color: "#fff",
                fontSize: "1.1rem",
                boxShadow: "0 2px 8px rgba(16, 185, 129, 0.3)",
              }}
            >
              <i className="bi bi-file-earmark-text-fill"></i>
            </div>
            <span className="fw-bold" style={{ color: "#1b4332", fontSize: "1rem" }}>
              Certificados
            </span>
          </div>

          {/* Selector de Año */}
          <div
            className="d-flex align-items-center gap-1 rounded-3 shadow-sm bg-white"
            style={{ border: "1px solid #cbd5e1", padding: "3px" }}
          >
            <button
              onClick={() => setAnio((a) => Math.max(ANIO_INICIAL, a - 1))}
              disabled={anio <= ANIO_INICIAL}
              className="btn btn-sm d-flex align-items-center justify-content-center rounded-2 p-0"
              style={{
                width: "30px",
                height: "30px",
                backgroundColor: "transparent",
                border: "none",
                color: anio <= ANIO_INICIAL ? "#cbd5e1" : "#1b4332",
              }}
              title="Año anterior"
            >
              <i className="bi bi-chevron-left"></i>
            </button>

            <span
              className="fw-bold px-2"
              style={{ color: "#1b4332", fontSize: "1.05rem", minWidth: "62px", textAlign: "center" }}
            >
              {anio}
            </span>

            <button
              onClick={() => setAnio((a) => a + 1)}
              className="btn btn-sm d-flex align-items-center justify-content-center rounded-2 p-0"
              style={{
                width: "30px",
                height: "30px",
                backgroundColor: "transparent",
                border: "none",
                color: "#1b4332",
              }}
              title="Año siguiente"
            >
              <i className="bi bi-chevron-right"></i>
            </button>
          </div>
        </div>

        {/* Tarjetas de los meses */}
        <div className="flex-grow-1 d-flex align-items-center justify-content-center">
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(4, 1fr)",
              gap: "1.25rem",
              width: "100%",
            }}
          >
          {MESES.map((mes, idx) => {
            const numeroMes = idx + 1;
            const isHovered = hovered === numeroMes;
            const esMesActual = esAnioEnCurso && numeroMes === hoy.getMonth() + 1;

            return (
              <div
                key={mes}
                className="d-flex flex-column align-items-center justify-content-center text-center p-3"
                style={{
                  background: isHovered
                    ? "linear-gradient(135deg, #081c15 0%, #1b4332 100%)"
                    : "linear-gradient(135deg, #1b4332 0%, #2d6a4f 100%)",
                  borderRadius: "16px",
                  height: "140px",
                  color: "#fff",
                  cursor: "pointer",
                  border: `1px solid ${
                    isHovered ? "#10b981" : esMesActual ? "#6ee7b7" : "rgba(255,255,255,0.12)"
                  }`,
                  boxShadow: isHovered
                    ? "0 14px 24px -8px rgba(0,0,0,0.4), 0 0 14px rgba(16,185,129,0.25)"
                    : "0 6px 14px -6px rgba(0,0,0,0.25)",
                  transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
                  transform: isHovered ? "translateY(-3px)" : "translateY(0)",
                  userSelect: "none",
                }}
                onClick={() => navigate(`/produccion/certificados/${anio}/${numeroMes}`)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) =>
                  e.key === "Enter" && navigate(`/produccion/certificados/${anio}/${numeroMes}`)
                }
                onMouseEnter={() => setHovered(numeroMes)}
                onMouseLeave={() => setHovered(null)}
              >
                <span className="fw-bold" style={{ fontSize: "1.2rem", letterSpacing: "0.2px" }}>
                  {mes}
                </span>
                {esMesActual && (
                  <span
                    className="mt-1 px-2 rounded-pill"
                    style={{
                      backgroundColor: "rgba(110, 231, 183, 0.18)",
                      color: "#6ee7b7",
                      fontSize: "0.68rem",
                      fontWeight: 600,
                      border: "1px solid rgba(110, 231, 183, 0.35)",
                    }}
                  >
                    mes en curso
                  </span>
                )}
              </div>
              );
            })}
          </div>
        </div>
      </Container>
    </div>
  );
}

export default ProduccionCertificados;
