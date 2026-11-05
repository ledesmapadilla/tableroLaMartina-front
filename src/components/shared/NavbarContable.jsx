import { useNavigate } from "react-router-dom";
import LogoNavbar from "./LogoNavbar";
import SesionUsuario from "./SesionUsuario";
import MenuAltas from "./MenuAltas";

/**
 * El navbar de Contable (05/11/2026): el de Producción con el cian de la
 * tarjeta de la principal. Va en todas las pantallas de /contable.
 */
function NavbarContable() {
  const navigate = useNavigate();

  return (
    <div
      className="d-flex align-items-center justify-content-between px-4 py-2 border-bottom shadow-sm flex-shrink-0"
      style={{
        backgroundColor: "#164e63",
        color: "#fff",
        height: "54px",
        position: "relative",
        zIndex: 30,
      }}
    >
      <LogoNavbar />

      {/* Lado izquierdo: identidad de la sección */}
      <div
        className="d-flex align-items-center gap-2"
        role="button"
        onClick={() => navigate("/contable")}
        style={{ cursor: "pointer" }}
      >
        <div
          className="rounded-3 d-flex align-items-center justify-content-center"
          style={{
            width: "34px",
            height: "34px",
            backgroundColor: "#0891b2",
            color: "#fff",
            fontSize: "1.15rem",
            boxShadow: "0 2px 8px rgba(34, 211, 238, 0.3)",
          }}
        >
          <i className="bi bi-calculator-fill"></i>
        </div>
        <span className="text-white fw-semibold">Contable</span>
      </div>

      {/* Lado derecho: navegación, altas y sesión */}
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

        <MenuAltas colores={{ activo: "#0e7490", acento: "#0e7490", marca: "#164e63", marcaFondo: "#ecfeff" }} />

        <span style={{ width: "1px", height: "24px", backgroundColor: "rgba(255,255,255,0.22)" }} />
        <SesionUsuario />
      </div>
    </div>
  );
}

export default NavbarContable;
