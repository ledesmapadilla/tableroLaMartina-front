import { useLocation, useNavigate } from "react-router-dom";
import LogoNavbar from "./LogoNavbar";
import SesionUsuario from "./SesionUsuario";
import MenuAltas from "./MenuAltas";

/**
 * En qué establecimiento se está parado, sacado de la URL.
 *
 * Devuelve null donde no corresponde ninguno: en la pantalla que los elige y
 * en las altas, que son padrones de La Martina y se comparten entre los dos.
 */
const establecimientoDe = (pathname) => {
  if (pathname.startsWith("/produccion/san-pablo")) {
    return { nombre: "San Pablo", fondo: "#a13d3d", borde: "#ef4444" };
  }
  if (pathname.startsWith("/produccion/certificados")) {
    return { nombre: "Caspinchango", fondo: "#2d6a4f", borde: "#6ee7b7" };
  }
  return null;
};

function NavbarProduccion() {
  const navigate = useNavigate();
  const location = useLocation();
  const establecimiento = establecimientoDe(location.pathname);

  return (
    <div
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

        {/* En qué campo se está trabajando. Las pantallas de los dos son
            iguales, así que el cartel es lo único que las distingue: va grande
            y con el color de su tarjeta. */}
        {establecimiento && (
          <div
            className="d-flex align-items-center gap-2 rounded-3 px-3 py-1"
            style={{
              backgroundColor: establecimiento.fondo,
              border: `1px solid ${establecimiento.borde}`,
              boxShadow: "0 2px 8px rgba(0,0,0,0.25)",
            }}
            title={`Está viendo ${establecimiento.nombre}`}
          >
            <i className="bi bi-geo-alt-fill" style={{ color: establecimiento.borde }}></i>
            <span
              className="fw-bold text-white"
              style={{ fontSize: "0.95rem", letterSpacing: "0.3px" }}
            >
              {establecimiento.nombre}
            </span>
          </div>
        )}
      </div>

      {/* Lado derecho: navegación, altas y sesión */}
      <div className="d-flex align-items-center gap-2">
        {/* Volver y General, igual que en Camionetas y Tractores. Al vivir en
            el navbar aparecen en todas las pantallas de Producción. */}
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

        {/* Altas: el mismo botón en todo el proyecto (utils/altas.js). */}
        <MenuAltas colores={{ activo: "#2d6a4f", acento: "#2d6a4f", marca: "#1b4332", marcaFondo: "#e8f5ee" }} />

        {/* La sesión es del proyecto, no de Compras: también se cierra desde acá. */}
        <span style={{ width: "1px", height: "24px", backgroundColor: "rgba(255,255,255,0.22)" }} />
        <SesionUsuario />
      </div>
    </div>
  );
}

export default NavbarProduccion;
