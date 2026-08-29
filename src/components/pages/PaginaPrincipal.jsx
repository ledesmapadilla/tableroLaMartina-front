import { useState } from "react";
import { useNavigate } from "react-router-dom";

const secciones = [
  {
    id: "compras",
    titulo: "Compras",
    subtitulo: "Pedidos, proveedores y órdenes de compra",
    ruta: "/compras",
    bg: "linear-gradient(135deg, #78350f 0%, #92400e 100%)",
    hoverBg: "linear-gradient(135deg, #451a03 0%, #78350f 100%)",
    accentColor: "#f59e0b",
    icono: "bi bi-cart-fill",
  },
  {
    id: "mantenimiento",
    titulo: "Mantenimiento",
    subtitulo: "Camionetas, tractores, colectivos y visitas",
    ruta: "/inicio",
    bg: "linear-gradient(135deg, #1e293b 0%, #334155 100%)",
    hoverBg: "linear-gradient(135deg, #0f172a 0%, #1e293b 100%)",
    accentColor: "#3b82f6",
    icono: "bi bi-tools",
  },
  {
    id: "produccion",
    titulo: "Producción",
    subtitulo: "Seguimiento y control de producción",
    ruta: "/produccion",
    bg: "linear-gradient(135deg, #1b4332 0%, #2d6a4f 100%)",
    hoverBg: "linear-gradient(135deg, #081c15 0%, #1b4332 100%)",
    accentColor: "#10b981",
    icono: "bi bi-graph-up-arrow",
  },
];

function PaginaPrincipal() {
  const navigate = useNavigate();
  const [hoveredCard, setHoveredCard] = useState(null);

  return (
    <div
      style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        height: "100%",
        maxHeight: "100vh",
        overflow: "hidden",
        background: "linear-gradient(135deg, #0f172a 0%, #1e293b 55%, #334155 100%)",
        color: "#ffffff",
        userSelect: "none",
      }}
    >
      {/* Cabecera */}
      <div className="d-flex flex-column align-items-center pt-4 flex-shrink-0">
        <img
          src="/logo-la-martina.jpg"
          alt="Logo La Martina"
          height="58"
          style={{
            maskImage:
              "linear-gradient(to right, transparent 0%, black 18%, black 82%, transparent 100%), linear-gradient(to bottom, transparent 0%, black 10%, black 90%, transparent 100%)",
            WebkitMaskImage:
              "linear-gradient(to right, transparent 0%, black 18%, black 82%, transparent 100%), linear-gradient(to bottom, transparent 0%, black 10%, black 90%, transparent 100%)",
            maskComposite: "intersect",
            WebkitMaskComposite: "destination-in",
          }}
        />
        <h1
          className="fw-bold text-center mb-0 mt-3"
          style={{
            fontSize: "clamp(1.8rem, 4.5vw, 3.2rem)",
            letterSpacing: "0.03em",
            textShadow: "0 6px 24px rgba(0, 0, 0, 0.45)",
          }}
        >
          Página Principal
        </h1>
      </div>

      {/* Tarjetas */}
      <div className="flex-grow-1 d-flex align-items-center justify-content-center p-4">
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, minmax(240px, 1fr))",
            gap: "1.75rem",
            maxWidth: "1040px",
            width: "100%",
          }}
        >
          {secciones.map((s) => {
            const isHovered = hoveredCard === s.id;
            return (
              <div
                key={s.id}
                className="d-flex flex-column align-items-center justify-content-center p-4 text-center"
                style={{
                  background: isHovered ? s.hoverBg : s.bg,
                  borderRadius: "20px",
                  height: "calc(100vh - 290px)",
                  minHeight: "230px",
                  maxHeight: "320px",
                  boxShadow: isHovered
                    ? `0 18px 32px -8px rgba(0, 0, 0, 0.45), 0 0 18px ${s.accentColor}40`
                    : "0 8px 20px -4px rgba(0, 0, 0, 0.25)",
                  border: `1px solid ${isHovered ? s.accentColor : "rgba(255, 255, 255, 0.12)"}`,
                  cursor: "pointer",
                  transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
                  transform: isHovered ? "translateY(-4px) scale(1.015)" : "translateY(0) scale(1)",
                  color: "#ffffff",
                }}
                onClick={() => navigate(s.ruta)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => e.key === "Enter" && navigate(s.ruta)}
                onMouseEnter={() => setHoveredCard(s.id)}
                onMouseLeave={() => setHoveredCard(null)}
              >
                <div
                  className="mb-3 d-flex align-items-center justify-content-center"
                  style={{
                    width: "72px",
                    height: "72px",
                    borderRadius: "18px",
                    backgroundColor: "rgba(255, 255, 255, 0.1)",
                    border: "1px solid rgba(255, 255, 255, 0.16)",
                    boxShadow: "0 4px 12px rgba(0, 0, 0, 0.15)",
                  }}
                >
                  <i className={s.icono} style={{ fontSize: "2.5rem", color: s.accentColor }}></i>
                </div>

                <h3 className="h3 fw-bold mb-2 text-white">{s.titulo}</h3>

                <p className="small mb-0 text-light opacity-75 px-2" style={{ fontSize: "0.86rem" }}>
                  {s.subtitulo}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default PaginaPrincipal;
