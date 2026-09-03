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

// Un informe por tarjeta. Para sumar otro alcanza con agregar una entrada acá
// y su ruta en App.jsx.
const INFORMES = [
  {
    id: "mes",
    titulo: "Informe del mes",
    subtitulo: "Personal, centros de costo, combustible, producción y rendimiento",
    icono: "bi bi-clipboard-data-fill",
    destino: "mes",
  },
  {
    id: "tareas-personal",
    titulo: "Tareas por personal",
    subtitulo: "Qué tareas hizo cada persona y qué cantidad de cada una",
    icono: "bi bi-person-lines-fill",
    destino: "tareas-personal",
  },
];

function ProduccionInformesMenu() {
  const { anio, mes } = useParams();
  const navigate = useNavigate();
  const [hovered, setHovered] = useState(null);

  const titulo = `${MESES[Number(mes) - 1] || ""} ${anio}`;
  const ir = (destino) =>
    navigate(`/produccion/certificados/${anio}/${mes}/informes/${destino}`);

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
        {/* Encabezado: volver al mes */}
        <div className="d-flex align-items-center gap-2 mb-4">
          <button
            onClick={() => navigate(`/produccion/certificados/${anio}/${mes}`)}
            className="btn btn-sm btn-outline-secondary d-flex align-items-center gap-1 rounded-3 px-2 py-1"
            style={{ fontSize: "0.8rem" }}
            title="Volver al mes"
          >
            <i className="bi bi-arrow-left"></i>
          </button>
          <span className="fw-bold" style={{ color: "#1b4332", fontSize: "1.05rem" }}>
            Informes - {titulo}
          </span>
        </div>

        {/* Tarjetas de informes */}
        <div className="flex-grow-1 d-flex align-items-center justify-content-center">
          <div
            style={{
              display: "grid",
              // Con pocos informes las tarjetas quedan centradas en vez de
              // pegadas a la izquierda.
              gridTemplateColumns: `repeat(${Math.min(INFORMES.length, 3)}, minmax(0, 1fr))`,
              gap: "1.75rem",
              width: "100%",
              maxWidth: INFORMES.length < 3 ? `${INFORMES.length * 320}px` : "100%",
              margin: "0 auto",
            }}
          >
            {INFORMES.map((i) => {
              const isHovered = hovered === i.id;
              return (
                <div
                  key={i.id}
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
                  onClick={() => ir(i.destino)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => e.key === "Enter" && ir(i.destino)}
                  onMouseEnter={() => setHovered(i.id)}
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
                    <i className={i.icono} style={{ fontSize: "2.1rem", color: "#6ee7b7" }}></i>
                  </div>

                  <span className="fw-bold" style={{ fontSize: "1.2rem", letterSpacing: "0.2px" }}>
                    {i.titulo}
                  </span>

                  <span
                    className="mt-2 px-2"
                    style={{ fontSize: "0.8rem", color: "rgba(255,255,255,0.72)" }}
                  >
                    {i.subtitulo}
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

export default ProduccionInformesMenu;
