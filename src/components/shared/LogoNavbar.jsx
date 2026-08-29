import { useState } from "react";
import { Link } from "react-router-dom";

/**
 * Logo de La Martina centrado en la barra de cabecera de cada página.
 * Al hacer click lleva a la página principal.
 * El navbar contenedor debe tener position: relative.
 */
function LogoNavbar({ height = 42 }) {
  const [hovered, setHovered] = useState(false);

  return (
    <Link
      to="/"
      title="Ir a la página principal"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        position: "absolute",
        left: "50%",
        top: "50%",
        transform: hovered
          ? "translate(-50%, -50%) scale(1.06)"
          : "translate(-50%, -50%) scale(1)",
        display: "flex",
        alignItems: "center",
        lineHeight: 0,
        zIndex: 10,
        transition: "transform 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
      }}
    >
      <img
        src="/logo-la-martina.jpg"
        alt="La Martina — Página principal"
        height={height}
        style={{
          maskImage:
            "linear-gradient(to right, transparent 0%, black 20%, black 80%, transparent 100%), linear-gradient(to bottom, transparent 0%, black 10%, black 90%, transparent 100%)",
          WebkitMaskImage:
            "linear-gradient(to right, transparent 0%, black 20%, black 80%, transparent 100%), linear-gradient(to bottom, transparent 0%, black 10%, black 90%, transparent 100%)",
          maskComposite: "intersect",
          WebkitMaskComposite: "destination-in",
        }}
      />
    </Link>
  );
}

export default LogoNavbar;
