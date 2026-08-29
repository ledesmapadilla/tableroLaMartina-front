import { useEffect, useRef, useState } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import LogoNavbar from "./LogoNavbar";

const menu = [
  {
    id: "certificados",
    label: "Certificados",
    icon: "bi bi-file-earmark-text-fill",
    to: "/produccion/certificados",
  },
  {
    id: "altas",
    label: "Altas",
    icon: "bi bi-plus-circle-fill",
    items: [
      { to: "/produccion/altas/cc", label: "CC", icon: "bi bi-diagram-3-fill" },
      { to: "/produccion/altas/personal", label: "Personal", icon: "bi bi-people-fill" },
      { to: "/produccion/altas/tareas", label: "Tareas", icon: "bi bi-list-check" },
    ],
  },
];

function NavbarProduccion() {
  const navigate = useNavigate();
  const location = useLocation();
  const [abierto, setAbierto] = useState(null);
  const navRef = useRef(null);

  // Cerrar el desplegable al navegar o al hacer click afuera
  useEffect(() => setAbierto(null), [location.pathname]);

  useEffect(() => {
    const handler = (e) => {
      if (navRef.current && !navRef.current.contains(e.target)) setAbierto(null);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div
      ref={navRef}
      className="d-flex align-items-center justify-content-between px-4 py-2 border-bottom shadow-sm flex-shrink-0"
      style={{
        backgroundColor: "#1b4332",
        color: "#fff",
        height: "54px",
        position: "relative",
        zIndex: 30,
      }}
    >
      <LogoNavbar />

      {/* Lado izquierdo: identidad de la sección */}
      <div className="d-flex align-items-center gap-3">
        <div
          className="d-flex align-items-center gap-2"
          role="button"
          onClick={() => navigate("/produccion")}
          style={{ cursor: "pointer" }}
        >
          <div
            className="rounded-3 d-flex align-items-center justify-content-center"
            style={{
              width: "34px",
              height: "34px",
              backgroundColor: "#10b981",
              color: "#fff",
              fontSize: "1.15rem",
              boxShadow: "0 2px 8px rgba(16, 185, 129, 0.3)",
            }}
          >
            <i className="bi bi-graph-up-arrow"></i>
          </div>
          <span className="text-white fw-semibold">Producción</span>
        </div>
      </div>

      {/* Lado derecho: menús de la sección */}
      <div className="d-flex align-items-center gap-2">
        {menu.map((m) => {
          // Sin items es un link directo; con items, un desplegable.
          if (!m.items) {
            const activo = location.pathname.startsWith(m.to);
            return (
              <button
                key={m.id}
                onClick={() => navigate(m.to)}
                className="btn btn-sm d-flex align-items-center gap-2 rounded-3 px-3 py-1 text-white"
                style={{
                  backgroundColor: activo ? "#2d6a4f" : "transparent",
                  border: "1px solid rgba(255, 255, 255, 0.22)",
                  fontWeight: 600,
                  fontSize: "0.86rem",
                }}
              >
                <i className={m.icon}></i>
                <span>{m.label}</span>
              </button>
            );
          }

          const activo = m.items.some((i) => location.pathname.startsWith(i.to));
          const estaAbierto = abierto === m.id;
          return (
            <div key={m.id} style={{ position: "relative" }}>
              <button
                onClick={() => setAbierto(estaAbierto ? null : m.id)}
                className="btn btn-sm d-flex align-items-center gap-2 rounded-3 px-3 py-1 text-white"
                style={{
                  backgroundColor: estaAbierto || activo ? "#2d6a4f" : "transparent",
                  border: "1px solid rgba(255, 255, 255, 0.22)",
                  fontWeight: 600,
                  fontSize: "0.86rem",
                }}
              >
                <i className={m.icon}></i>
                <span>{m.label}</span>
                <i className={`bi bi-chevron-${estaAbierto ? "up" : "down"} small opacity-75`}></i>
              </button>

              {estaAbierto && (
                <div
                  className="shadow-lg"
                  style={{
                    position: "absolute",
                    top: "calc(100% + 8px)",
                    right: 0,
                    minWidth: "190px",
                    backgroundColor: "#ffffff",
                    borderRadius: "12px",
                    border: "1px solid #e2e8f0",
                    overflow: "hidden",
                    zIndex: 40,
                  }}
                >
                  {m.items.map((i) => (
                    <NavLink
                      key={i.to}
                      to={i.to}
                      className="d-flex align-items-center gap-2 px-3 py-2 text-decoration-none"
                      style={({ isActive }) => ({
                        color: isActive ? "#1b4332" : "#334155",
                        backgroundColor: isActive ? "#e8f5ee" : "transparent",
                        fontWeight: isActive ? 600 : 500,
                        fontSize: "0.88rem",
                      })}
                    >
                      <i className={i.icon} style={{ color: "#2d6a4f", minWidth: "20px" }}></i>
                      <span>{i.label}</span>
                    </NavLink>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default NavbarProduccion;
