import { useEffect, useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import TractorIcon from "./TractorIcon";

const links = [
  { to: "/", label: "Inicio", icon: "bi bi-house-fill", end: true },
  {
    to: "/camionetas",
    label: "Camionetas",
    icon: "bi bi-car-front-fill",
    submenu: [
      { to: "/camionetas/altas", label: "Alta Flota", icon: "bi bi-plus-circle-fill" },
    ],
  },
  {
    to: "/tractores",
    label: "Tractores",
    customIcon: <TractorIcon size="1.25rem" color="#fff" style={{ minWidth: "24px" }} />,
    submenu: [
      { to: "/tractores/altas", label: "Alta Tractores", icon: "bi bi-plus-circle-fill" },
    ],
  },
  {
    to: "/colectivo",
    label: "Colectivos",
    icon: "bi bi-bus-front-fill",
    submenu: [
      { to: "/colectivos/altas", label: "Alta Colectivos", icon: "bi bi-plus-circle-fill" },
    ],
  },
];

function Icono({ icon, customIcon }) {
  if (customIcon) return customIcon;
  return <i className={icon} style={{ minWidth: "24px" }}></i>;
}

function Sidebar() {
  const [open, setOpen] = useState({});
  const location = useLocation();

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

      {links.map((link) =>
        link.submenu ? (
          <div key={link.to}>
            <div
              className="sidebar-link sidebar-link--parent"
              onClick={() => toggle(link.to)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => e.key === "Enter" && toggle(link.to)}
            >
              <Icono icon={link.icon} customIcon={link.customIcon} />
              <span className="sidebar-label">{link.label}</span>
              <i className={`bi bi-chevron-${open[link.to] ? "up" : "down"} sidebar-label sidebar-chevron`}></i>
            </div>

            {open[link.to] && (
              <div className="sidebar-submenu">
                {link.submenu.map((sub) => (
                  <NavLink
                    key={sub.to}
                    to={sub.to}
                    onClick={() => setOpen({})}
                    className={({ isActive }) =>
                      `sidebar-submenu-link${isActive ? " sidebar-submenu-link--active" : ""}`
                    }
                  >
                    <i className={sub.icon} style={{ minWidth: "24px" }}></i>
                    <span className="sidebar-label">{sub.label}</span>
                  </NavLink>
                ))}
              </div>
            )}
          </div>
        ) : (
          <NavLink
            key={link.to}
            to={link.to}
            end={link.end}
            className={({ isActive }) => `sidebar-link${isActive ? " sidebar-link--active" : ""}`}
          >
            <Icono icon={link.icon} customIcon={link.customIcon} />
            <span className="sidebar-label">{link.label}</span>
          </NavLink>
        )
      )}
    </nav>
  );
}

export default Sidebar;
