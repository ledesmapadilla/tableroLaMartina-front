import { useEffect, useState } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import TractorIcon from "./TractorIcon";
import { IconoAlta } from "./MenuAltas";
import { useAuth } from "../../context/AuthContext";
import { altasPorGrupo, esRutaDeAlta } from "../../utils/altas";
import { usePermisos } from "../../context/permisos";
import { GRUPO } from "../../utils/permisosCatalogo";

// Las altas de cada vehículo ya no cuelgan de él: están todas juntas en
// "Altas", la misma lista que el botón de los navbars (utils/altas.js).
// `permiso`: el link se ve si el rol ve alguna de esas pantallas (Roles).
const links = [
  { to: "/", label: "Principal", icon: "bi bi-house-fill", end: true },
  { to: "/inicio", label: "Mantenimiento", icon: "bi bi-tools", end: true, permiso: GRUPO.mantenimiento },
  { to: "/camionetas", label: "Camionetas", icon: "bi bi-car-front-fill", permiso: GRUPO.camionetas },
  {
    to: "/tractores",
    label: "Tractores",
    permiso: GRUPO.tractores,
    customIcon: <TractorIcon size="1.25rem" color="#fff" style={{ minWidth: "24px" }} />,
  },
  { to: "/colectivo", label: "Colectivos", icon: "bi bi-bus-front-fill", permiso: GRUPO.colectivos },
];

function Icono({ icon, customIcon }) {
  if (customIcon) return customIcon;
  return <i className={icon} style={{ minWidth: "24px" }}></i>;
}

function Sidebar() {
  const [open, setOpen] = useState({});
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { puede } = usePermisos();
  const gruposAltas = altasPorGrupo(user, puede);

  const salir = () => {
    logout();
    navigate("/login", { replace: true });
  };

  useEffect(() => { setOpen({}); }, [location.pathname]);

  const toggle = (key) => setOpen((prev) => ({ ...prev, [key]: !prev[key] }));

  const hasOpen = Object.values(open).some(Boolean);

  return (
    <nav className={`sidebar${hasOpen ? " sidebar--expanded" : ""}`}>
      <NavLink
        to="/"
        className="sidebar-brand d-flex align-items-center justify-content-center text-decoration-none"
        title="Inicio — Menú Principal"
        style={{ cursor: "pointer" }}
      >
        <img
          src="/logo-la-martina.jpg"
          alt="Logo La Martina"
          style={{
            height: "36px",
            minWidth: "36px",
            objectFit: "contain",
            maskImage:
              "linear-gradient(to right, transparent 0%, black 15%, black 85%, transparent 100%), linear-gradient(to bottom, transparent 0%, black 10%, black 90%, transparent 100%)",
            WebkitMaskImage:
              "linear-gradient(to right, transparent 0%, black 15%, black 85%, transparent 100%), linear-gradient(to bottom, transparent 0%, black 10%, black 90%, transparent 100%)",
            maskComposite: "intersect",
            WebkitMaskComposite: "destination-in",
          }}
        />
      </NavLink>

      {links.filter((l) => !l.permiso || puede(l.permiso)).map((link) => (
        <NavLink
          key={link.to}
          to={link.to}
          end={link.end}
          className={({ isActive }) => `sidebar-link${isActive ? " sidebar-link--active" : ""}`}
        >
          <Icono icon={link.icon} customIcon={link.customIcon} />
          <span className="sidebar-label">{link.label}</span>
        </NavLink>
      ))}

      {/* Altas de todo el proyecto, agrupadas: las que el rol puede abrir. */}
      {gruposAltas.length > 0 && (
        <div>
          <div
            className={`sidebar-link sidebar-link--parent${esRutaDeAlta(location.pathname) ? " sidebar-link--active" : ""}`}
            onClick={() => toggle("altas")}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => e.key === "Enter" && toggle("altas")}
          >
            <i className="bi bi-plus-circle-fill" style={{ minWidth: "24px" }}></i>
            <span className="sidebar-label">Altas</span>
            <i className={`bi bi-chevron-${open.altas ? "up" : "down"} sidebar-label sidebar-chevron`}></i>
          </div>

          {open.altas && (
            <div className="sidebar-submenu">
              {gruposAltas.map((g) => (
                <div key={g.grupo}>
                  <div className="sidebar-submenu-titulo">{g.grupo}</div>
                  {g.altas.map((a) => (
                    <NavLink
                      key={a.to}
                      to={a.to}
                      onClick={() => setOpen({})}
                      className={({ isActive }) =>
                        `sidebar-submenu-link${isActive ? " sidebar-submenu-link--active" : ""}`
                      }
                    >
                      <IconoAlta icono={a.icono} />
                      <span className="sidebar-label">{a.label}</span>
                    </NavLink>
                  ))}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* La sesión es del proyecto, no de Compras: se cierra también desde acá.
          Va al pie, empujado por el margin-top automático, y se pliega con el
          resto del sidebar. */}
      {user && (
        <div
          className="sidebar-link sidebar-sesion"
          role="button"
          tabIndex={0}
          onClick={salir}
          onKeyDown={(e) => e.key === "Enter" && salir()}
          title={`Cerrar la sesión de ${user.nombre}`}
        >
          <i className="bi bi-box-arrow-right" style={{ minWidth: "24px" }}></i>
          <span className="sidebar-label">
            Salir
            <span style={{ opacity: 0.6, fontSize: "0.82rem" }}> · {user.nombre}</span>
          </span>
        </div>
      )}
    </nav>
  );
}

export default Sidebar;
