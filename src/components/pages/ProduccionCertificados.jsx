import { useEffect, useState } from "react";
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

// "2026-07-26T00:00:00.000Z" -> "26/07"
const ddmm = (iso) => {
  const [, m, d] = (iso || "").slice(0, 10).split("-");
  return d ? `${d}/${m}` : "";
};

function ProduccionCertificados() {
  const navigate = useNavigate();
  const hoy = new Date();
  const [anio, setAnio] = useState(ANIO_INICIAL);
  const [hovered, setHovered] = useState(null);
  const [periodos, setPeriodos] = useState([]);

  const esAnioEnCurso = anio === hoy.getFullYear();
  const mesEnCurso = esAnioEnCurso ? hoy.getMonth() + 1 : null;

  // Los 12 períodos del año en una sola consulta. Los meses que nadie tocó
  // vienen con el corte sugerido, que es el que van a tener al abrirlos.
  useEffect(() => {
    let vigente = true;
    (async () => {
      try {
        const res = await fetch(`/api/periodos/${anio}`);
        const data = res.ok ? await res.json() : [];
        if (vigente) setPeriodos(Array.isArray(data) ? data : []);
      } catch {
        if (vigente) setPeriodos([]);
      }
    })();
    return () => {
      vigente = false;
    };
  }, [anio]);

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
            const esMesActual = numeroMes === mesEnCurso;
            const periodo = periodos.find((x) => x.mes === numeroMes);
            // Solo los meses cerrados muestran el período: hasta que se cierra
            // el "hasta" acompaña al día de hoy y el corte todavía no es real.
            const rango =
              periodo?.cerrado ? `${ddmm(periodo.desde)} al ${ddmm(periodo.hasta)}` : "";

            // El mes en curso va en verde claro, con borde y resplandor
            // propios: es la tarjeta a la que se entra todos los días.
            const fondo = esMesActual
              ? isHovered
                ? "linear-gradient(135deg, #059669 0%, #065f46 100%)"
                : "linear-gradient(135deg, #10b981 0%, #047857 100%)"
              : isHovered
                ? "linear-gradient(135deg, #081c15 0%, #1b4332 100%)"
                : "linear-gradient(135deg, #1b4332 0%, #2d6a4f 100%)";

            return (
              <div
                key={mes}
                className="d-flex flex-column align-items-center justify-content-center text-center p-3"
                style={{
                  background: fondo,
                  borderRadius: "16px",
                  height: "140px",
                  color: "#fff",
                  cursor: "pointer",
                  border: esMesActual
                    ? "2px solid #a7f3d0"
                    : `1px solid ${isHovered ? "#10b981" : "rgba(255,255,255,0.12)"}`,
                  boxShadow: esMesActual
                    ? "0 0 0 3px rgba(16,185,129,0.22), 0 14px 26px -8px rgba(0,0,0,0.35)"
                    : isHovered
                      ? "0 14px 24px -8px rgba(0,0,0,0.4), 0 0 14px rgba(16,185,129,0.25)"
                      : "0 6px 14px -6px rgba(0,0,0,0.25)",
                  transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
                  transform: isHovered
                    ? "translateY(-3px)"
                    : esMesActual
                      ? "scale(1.04)"
                      : "translateY(0)",
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
                {/* El certificado no cubre el mes calendario: cerrado ya tiene
                    sus fechas reales y se muestran */}
                {rango && (
                  <span
                    className="mt-1 d-flex align-items-center gap-1"
                    style={{
                      fontSize: "0.72rem",
                      color: esMesActual ? "rgba(255,255,255,0.95)" : "rgba(255,255,255,0.7)",
                      fontWeight: esMesActual ? 600 : 400,
                    }}
                  >
                    <i className="bi bi-calendar3" style={{ fontSize: "0.68rem" }}></i>
                    {rango}
                  </span>
                )}
                {esMesActual && (
                  <span
                    className="mt-1 px-2 rounded-pill"
                    style={{
                      backgroundColor: "rgba(255,255,255,0.22)",
                      color: "#fff",
                      fontSize: "0.68rem",
                      fontWeight: 700,
                      border: "1px solid rgba(255,255,255,0.45)",
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
