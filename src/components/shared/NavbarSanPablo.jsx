import { useNavigate } from "react-router-dom";
import LogoNavbar from "./LogoNavbar";
import SesionUsuario from "./SesionUsuario";

/**
 * La barra de Reparaciones San Pablo: el slate de Mantenimiento, el ícono de
 * la pantalla y Volver al nivel de arriba (las cosechas, las tarjetas de una
 * cosecha o la tabla de una tarjeta).
 *
 * `titulo` va después de "Reparaciones San Pablo" (por ejemplo "Cosecha 2027
 * · Manitous"); sin título queda solo el nombre de la sección.
 */
export default function NavbarSanPablo({ titulo, icono, volverA = "/reparaciones/sanpablo" }) {
  const navigate = useNavigate();
  return (
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
            backgroundColor: "#f59e0b",
            color: "#fff",
            fontSize: "1.15rem",
            boxShadow: "0 2px 8px rgba(245, 158, 11, 0.3)",
          }}
        >
          {icono}
        </div>
        <span className="text-white fs-6 fw-semibold">
          Reparaciones San Pablo{titulo ? ` · ${titulo}` : ""}
        </span>
      </div>
      <div className="d-flex align-items-center gap-2">
        <button
          onClick={() => navigate(volverA)}
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

        {/* Quién está logueado, como en el resto de Mantenimiento: faltaba en
            todas las pantallas de San Pablo (24/09/2026). */}
        <span style={{ width: "1px", height: "24px", backgroundColor: "rgba(255,255,255,0.22)" }} />
        <SesionUsuario mostrarRol />
      </div>
    </div>
  );
}
