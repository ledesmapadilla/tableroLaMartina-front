import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import TractorIcon from "../shared/TractorIcon";
import NavbarSanPablo from "../shared/NavbarSanPablo";
import { api } from "../../services/api";
import { cosechaDeParam } from "../../utils/cosechas";
import { fmtPct } from "../../utils/sistemasManitou";
import { traerAvancesManitou, avanceTotalManitous } from "../../utils/avanceManitous";

// Una tarjeta por tipo de equipo que se repara en la base San Pablo, dentro de
// una cosecha (/reparaciones/sanpablo/:cosecha). Las que todavía no están
// construidas caen en el 404 (App.jsx).
const tarjetas = [
  {
    id: "manitous",
    titulo: "Manitous",
    bg: "linear-gradient(135deg, #064e3b 0%, #047857 100%)",
    hoverBg: "linear-gradient(135deg, #022c22 0%, #064e3b 100%)",
    accentColor: "#34d399",
    tractor: true,
  },
  {
    id: "colectivos",
    titulo: "Colectivos",
    bg: "linear-gradient(135deg, #7f1d1d 0%, #991b1b 100%)",
    hoverBg: "linear-gradient(135deg, #450a0a 0%, #7f1d1d 100%)",
    accentColor: "#f87171",
    icono: "bi bi-bus-front-fill",
  },
  {
    id: "tolvas",
    titulo: "Tolvas",
    bg: "linear-gradient(135deg, #78350f 0%, #92400e 100%)",
    hoverBg: "linear-gradient(135deg, #451a03 0%, #78350f 100%)",
    accentColor: "#f59e0b",
    icono: "bi bi-minecart-loaded",
  },
  // Los carros porta bines, porta bolsones y porta escaleras, juntos en
  // Carros (28/10/2026, CarrosSanPablo).
  {
    id: "carros",
    titulo: "Carros",
    bg: "linear-gradient(135deg, #312e81 0%, #4338ca 100%)",
    hoverBg: "linear-gradient(135deg, #1e1b4b 0%, #312e81 100%)",
    accentColor: "#818cf8",
    icono: "bi bi-truck-flatbed",
  },
  // Escaleras se entra solo desde Carros › Carros porta escaleras
  // (28/10/2026): su tarjeta se borró.
  {
    id: "pulverizadoras",
    titulo: "Pulverizadoras",
    bg: "linear-gradient(135deg, #1e293b 0%, #334155 100%)",
    hoverBg: "linear-gradient(135deg, #0f172a 0%, #1e293b 100%)",
    accentColor: "#60a5fa",
    icono: "bi bi-droplet-half",
  },
];

function ReparacionesSanPablo() {
  const navigate = useNavigate();
  const { cosecha } = useParams();
  const [hoveredCard, setHoveredCard] = useState(null);

  // El avance total de las Manitou en reparación (21/10/2026), en su
  // tarjeta: el mismo que la tarjeta General de Manitous.
  const [avanceManitous, setAvanceManitous] = useState(null);
  // La fecha límite de las Manitou (28/10/2026), la que se carga adentro, en
  // dd/mm/aaaa; "" si no se cargó.
  const [fechaLimite, setFechaLimite] = useState("");
  useEffect(() => {
    const nro = cosechaDeParam(cosecha);
    traerAvancesManitou(nro).then((a) => setAvanceManitous(avanceTotalManitous(a)));
    api
      .get(`/ingresos-sanpablo/fecha-limite-manitou?cosecha=${nro}`)
      .then((r) => setFechaLimite(r.fecha ? r.fecha.slice(0, 10).split("-").reverse().join("/") : ""))
      .catch(() => setFechaLimite(""));
  }, [cosecha]);

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
      <NavbarSanPablo titulo={`Cosecha ${cosecha}`} icono={<i className="bi bi-tools"></i>} />

      {/* Las 5 tarjetas en dos filas (3 y 2, centradas), sin scroll: el
          ancho se limita al alto disponible para que entren las dos filas. */}
      <div
        className="flex-grow-1 d-flex flex-column align-items-center justify-content-center p-4"
        style={{ overflow: "hidden" }}
      >
        <div
          className="d-flex flex-wrap justify-content-center"
          style={{
            gap: "1.75rem",
            maxWidth: "min(800px, calc((100vh - 200px) * 1.5))",
            width: "100%",
          }}
        >
          {tarjetas.map((t) => {
            const isHovered = hoveredCard === t.id;
            const ruta = `/reparaciones/sanpablo/${cosecha}/${t.id}`;
            return (
              <div
                key={t.id}
                className="d-flex flex-column align-items-center justify-content-center p-3 text-center"
                style={{
                  background: isHovered ? t.hoverBg : t.bg,
                  borderRadius: "20px",
                  width: "calc((100% - 2 * 1.75rem) / 3)",
                  aspectRatio: "1 / 1",
                  boxShadow: isHovered
                    ? `0 20px 36px -8px rgba(0, 0, 0, 0.45), 0 0 20px ${t.accentColor}40`
                    : "0 10px 25px -4px rgba(0, 0, 0, 0.25)",
                  border: `1px solid ${isHovered ? t.accentColor : "rgba(255, 255, 255, 0.12)"}`,
                  cursor: "pointer",
                  transition: "all 0.22s cubic-bezier(0.4, 0, 0.2, 1)",
                  transform: isHovered ? "translateY(-4px)" : "translateY(0)",
                  color: "#ffffff",
                  userSelect: "none",
                  // Para el avance, que va al pie.
                  position: "relative",
                }}
                onClick={() => navigate(ruta)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => e.key === "Enter" && navigate(ruta)}
                onMouseEnter={() => setHoveredCard(t.id)}
                onMouseLeave={() => setHoveredCard(null)}
              >
                <div
                  className="mb-3 d-flex align-items-center justify-content-center"
                  style={{
                    width: "64px",
                    height: "64px",
                    borderRadius: "16px",
                    backgroundColor: "rgba(255, 255, 255, 0.1)",
                    border: "1px solid rgba(255, 255, 255, 0.16)",
                    boxShadow: "0 6px 16px rgba(0, 0, 0, 0.15)",
                  }}
                >
                  {t.tractor ? (
                    <TractorIcon size="2.1rem" color={t.accentColor} />
                  ) : (
                    <i className={t.icono} style={{ fontSize: "2.1rem", color: t.accentColor }}></i>
                  )}
                </div>
                <h3 className="fw-bold mb-0 text-white" style={{ fontSize: "1.2rem", lineHeight: 1.25 }}>
                  {t.titulo}
                </h3>
                {/* Manitous: la fecha límite arriba. */}
                {t.id === "manitous" && fechaLimite && (
                  <div
                    className="fw-semibold"
                    style={{ position: "absolute", top: "14px", left: 0, right: 0, fontSize: "0.85rem", color: t.accentColor }}
                    title="Para cuándo tienen que estar reparadas las Manitou"
                  >
                    <i className="bi bi-calendar-event me-1"></i>
                    Fecha límite: {fechaLimite}
                  </div>
                )}
                {/* Manitous: el avance de la reparación al pie de la tarjeta
                    (en las de cada Manitou va arriba). */}
                {t.id === "manitous" && avanceManitous !== null && (
                  <div
                    className="d-flex align-items-center gap-2"
                    style={{ position: "absolute", bottom: "16px", left: "50%", transform: "translateX(-50%)", width: "84%" }}
                    title={`Avance de la reparación de las Manitou: ${fmtPct(avanceManitous)}`}
                  >
                    <div
                      style={{
                        flex: 1,
                        height: "14px",
                        borderRadius: "7px",
                        backgroundColor: "rgba(255, 255, 255, 0.22)",
                        border: "1px solid rgba(255, 255, 255, 0.35)",
                        overflow: "hidden",
                      }}
                    >
                      <div style={{ width: `${Math.min(avanceManitous, 100)}%`, height: "100%", backgroundColor: "#facc15" }} />
                    </div>
                    <span className="fw-bold" style={{ fontSize: "1.25rem", lineHeight: 1, color: "#facc15" }}>
                      {fmtPct(avanceManitous)}
                    </span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default ReparacionesSanPablo;
