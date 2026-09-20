import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import TractorIcon from "../shared/TractorIcon";
import LogoNavbar from "../shared/LogoNavbar";
import { usePermisos } from "../../context/permisos";
import { GRUPO } from "../../utils/permisosCatalogo";
import SesionUsuario from "../shared/SesionUsuario";

const tarjetas = [
  {
    id: "preventivo",
    titulo: "Preventivo",
    subtitulo: "Control preventivo, itinerarios y relevamiento",
    permiso: "tractores.preventivo",
    ruta: "/tractores/preventivo",
    bg: "linear-gradient(135deg, #064e3b 0%, #047857 100%)",
    hoverBg: "linear-gradient(135deg, #022c22 0%, #064e3b 100%)",
    accentColor: "#34d399",
    icono: "bi bi-shield-check",
  },
  // La chica del medio, con el estilo de la de Visitas en Mantenimiento.
  {
    id: "repuestos",
    titulo: "Repuestos",
    permiso: "tractores.repuestos",
    ruta: "/tractores/repuestos",
    chica: true,
    bg: "linear-gradient(135deg, #0e7490 0%, #155e75 100%)",
    hoverBg: "linear-gradient(135deg, #164e63 0%, #0e7490 100%)",
    icono: "bi bi-box-seam",
  },
  {
    id: "reparaciones",
    titulo: "Reparaciones",
    subtitulo: "Tareas y reparaciones por grupo y tractor",
    permiso: GRUPO.tractoresReparaciones,
    ruta: "/tractores/reparaciones",
    bg: "linear-gradient(135deg, #312e81 0%, #4338ca 100%)",
    hoverBg: "linear-gradient(135deg, #1e1b4b 0%, #312e81 100%)",
    accentColor: "#818cf8",
    icono: "bi bi-tools",
  },
];

function Tractores() {
  const { puede } = usePermisos();
  const navigate = useNavigate();
  const [hoveredCard, setHoveredCard] = useState(null);
  const [totalTractores, setTotalTractores] = useState(0);

  useEffect(() => {
    fetch("/api/tractores")
      .then((r) => (r.ok ? r.json() : []))
      .then((d) => setTotalTractores(Array.isArray(d) ? d.length : 0))
      .catch(() => setTotalTractores(0));
  }, []);

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
      {/* Barra de Cabecera Institucional */}
      <div
        className="d-flex align-items-center justify-content-between px-4 py-2 border-bottom shadow-sm flex-shrink-0"
        style={{ backgroundColor: "#1e293b", color: "#fff", height: "54px", position: "relative" }}
      >
        <LogoNavbar />
        <div className="d-flex align-items-center gap-3">
          <div
            className="rounded-3 d-flex align-items-center justify-content-center me-1"
            style={{
              width: "34px",
              height: "34px",
              backgroundColor: "#10b981",
              color: "#fff",
              fontSize: "1.15rem",
              boxShadow: "0 2px 8px rgba(16, 185, 129, 0.3)",
            }}
          >
            <TractorIcon size="1.25rem" color="#fff" />
          </div>
          <div className="d-flex align-items-center gap-2">
            <span className="text-white fs-6 fw-semibold">Gestión de Tractores</span>
            {totalTractores > 0 && (
              <span className="text-light opacity-75 small">- {totalTractores} Unidades</span>
            )}
          </div>
        </div>

        {/* Botones de Navegación */}
        <div className="d-flex align-items-center gap-2">
          <button
            onClick={() => navigate(-1)}
            className="btn btn-sm btn-outline-light d-flex align-items-center gap-1.5 rounded-3 px-3 py-1"
            style={{ fontSize: "0.82rem" }}
          >
            <i className="bi bi-arrow-left"></i>
            <span>Volver</span>
          </button>
          <button
            onClick={() => navigate("/")}
            className="btn btn-sm btn-light text-dark d-flex align-items-center gap-1.5 rounded-3 px-3 py-1"
            style={{ fontSize: "0.82rem" }}
          >
            <i className="bi bi-house-door-fill"></i>
            <span>General</span>
          </button>

          {/* Quién está logueado: a la vista en toda la sección, igual que en
              Compras y Producción. La sesión es del proyecto entero. */}
          <span style={{ width: "1px", height: "24px", backgroundColor: "rgba(255,255,255,0.22)" }} />
          <SesionUsuario mostrarRol />
        </div>
      </div>

      {/* Contenedor Central: las 2 tarjetas principales y la chica en el medio */}
      <div
        className="flex-grow-1 d-flex flex-column align-items-center justify-content-center p-4"
        style={{ overflow: "hidden" }}
      >
        <div
          className="d-flex justify-content-center align-items-center"
          style={{
            gap: "2.5rem",
            maxWidth: "960px",
            width: "100%",
          }}
        >
          {tarjetas.filter((t) => !t.permiso || puede(t.permiso)).map((t) => {
            const isHovered = hoveredCard === t.id;
            if (t.chica) {
              return (
                <div
                  key={t.ruta}
                  className="d-flex flex-column align-items-center justify-content-center text-white text-center p-2 flex-shrink-0"
                  style={{
                    background: isHovered ? t.hoverBg : t.bg,
                    borderRadius: "18px",
                    boxShadow: isHovered
                      ? "0 16px 32px rgba(0,0,0,0.5), 0 0 20px rgba(6, 182, 212, 0.4)"
                      : "0 8px 24px rgba(0,0,0,0.35)",
                    border: "2px solid rgba(255, 255, 255, 0.3)",
                    cursor: "pointer",
                    transition: "transform 0.2s cubic-bezier(0.4, 0, 0.2, 1), box-shadow 0.2s ease",
                    transform: isHovered ? "scale(1.08)" : "scale(1)",
                    width: "104px",
                    height: "70px",
                    userSelect: "none",
                  }}
                  onClick={() => navigate(t.ruta)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => e.key === "Enter" && navigate(t.ruta)}
                  onMouseEnter={() => setHoveredCard(t.id)}
                  onMouseLeave={() => setHoveredCard(null)}
                >
                  <div
                    className="d-flex align-items-center justify-content-center mb-1"
                    style={{
                      width: "28px",
                      height: "28px",
                      borderRadius: "8px",
                      backgroundColor: "rgba(255, 255, 255, 0.15)",
                    }}
                  >
                    <i className={t.icono} style={{ fontSize: "1.1rem", color: "#67e8f9" }}></i>
                  </div>
                  <span className="fw-bold text-center mb-0" style={{ fontSize: "0.9rem" }}>
                    {t.titulo}
                  </span>
                </div>
              );
            }
            return (
              <div
                key={t.ruta}
                className="card-seccion-tractores d-flex flex-column align-items-center justify-content-center p-4 text-center"
                style={{
                  background: isHovered ? t.hoverBg : t.bg,
                  borderRadius: "22px",
                  width: "360px",
                  height: "290px",
                  boxShadow: isHovered
                    ? `0 20px 36px -8px rgba(0, 0, 0, 0.45), 0 0 20px ${t.accentColor}40`
                    : "0 10px 25px -4px rgba(0, 0, 0, 0.25)",
                  border: `1px solid ${isHovered ? t.accentColor : "rgba(255, 255, 255, 0.12)"}`,
                  cursor: "pointer",
                  transition: "all 0.22s cubic-bezier(0.4, 0, 0.2, 1)",
                  transform: isHovered ? "translateY(-5px) scale(1.02)" : "translateY(0) scale(1)",
                  color: "#ffffff",
                  userSelect: "none",
                }}
                onClick={() => navigate(t.ruta)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => e.key === "Enter" && navigate(t.ruta)}
                onMouseEnter={() => setHoveredCard(t.id)}
                onMouseLeave={() => setHoveredCard(null)}
              >
                {/* Icono Principal */}
                <div
                  className="mb-3 d-flex align-items-center justify-content-center"
                  style={{
                    width: "72px",
                    height: "72px",
                    borderRadius: "18px",
                    backgroundColor: "rgba(255, 255, 255, 0.1)",
                    border: "1px solid rgba(255, 255, 255, 0.16)",
                    boxShadow: "0 6px 16px rgba(0, 0, 0, 0.15)",
                  }}
                >
                  <i className={t.icono} style={{ fontSize: "2.4rem", color: t.accentColor }}></i>
                </div>

                {/* Título */}
                <h3 className="fw-bold mb-2 tracking-tight text-white" style={{ fontSize: "1.5rem" }}>
                  {t.titulo}
                </h3>

                {/* Subtítulo */}
                <p className="small mb-0 text-light opacity-75 px-3" style={{ fontSize: "0.88rem", lineHeight: "1.4" }}>
                  {t.subtitulo}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default Tractores;
