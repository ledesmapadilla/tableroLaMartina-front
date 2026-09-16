import { useEffect, useRef, useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { usePermisos } from "../../context/permisos";
import { altasPorGrupo, rutaDeAlta, esRutaDeAlta } from "../../utils/altas";
import TractorIcon from "./TractorIcon";

/** El ícono de un alta: los de Bootstrap, y el tractor, que es un SVG propio. */
export function IconoAlta({ icono, color }) {
  if (icono === "tractor") {
    return <TractorIcon size="1em" color={color || "currentColor"} style={{ minWidth: "24px" }} />;
  }
  return <i className={icono} style={{ color, minWidth: "24px" }}></i>;
}

/**
 * El botón "Altas" de todo el proyecto: el mismo en los navbars de Compras y
 * Producción, en la página principal y en la de Mantenimiento. La lista sale
 * de utils/altas.js. Muestra solo las altas que el rol puede abrir, agrupadas.
 *
 * Va sobre fondos oscuros; `colores` lo adapta a la barra donde va:
 *   activo      — fondo del botón abierto o cuando se está en un alta
 *   acento      — color de los íconos del desplegable
 *   marca       — texto del alta en la que se está
 *   marcaFondo  — fondo del alta en la que se está
 *
 * `seccion` es "compras" dentro de Compras: el CC se abre ahí sin salir.
 */
export default function MenuAltas({ seccion, colores }) {
  const { user } = useAuth();
  const { pathname } = useLocation();
  const [abierto, setAbierto] = useState(false);
  const ref = useRef(null);
  const { puede } = usePermisos();
  const grupos = altasPorGrupo(user, puede);

  // Se cierra al hacer click afuera.
  useEffect(() => {
    if (!abierto) return;
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setAbierto(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [abierto]);

  if (grupos.length === 0) return null;
  const activo = abierto || esRutaDeAlta(pathname);

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button
        type="button"
        onClick={() => setAbierto((v) => !v)}
        className="btn btn-sm d-flex align-items-center gap-2 rounded-3 px-3 py-1 text-white"
        style={{
          backgroundColor: activo ? colores.activo : "transparent",
          border: "1px solid rgba(255, 255, 255, 0.22)",
          fontWeight: 600,
          fontSize: "0.86rem",
        }}
      >
        <i className="bi bi-plus-circle-fill"></i>
        <span>Altas</span>
        <i className={`bi bi-chevron-${abierto ? "up" : "down"} small opacity-75`}></i>
      </button>

      {abierto && (
        <div
          className="shadow-lg"
          style={{
            position: "absolute",
            top: "calc(100% + 8px)",
            right: 0,
            minWidth: "220px",
            backgroundColor: "#ffffff",
            borderRadius: "12px",
            border: "1px solid #e2e8f0",
            overflow: "hidden",
            zIndex: 40,
            paddingBottom: "4px",
          }}
        >
          {grupos.map((g) => (
            <div key={g.grupo}>
              <div
                className="px-3 pt-2 pb-1 text-uppercase fw-bold"
                style={{ fontSize: "0.66rem", letterSpacing: "0.6px", color: "#94a3b8" }}
              >
                {g.grupo}
              </div>
              {g.altas.map((a) => (
                <NavLink
                  key={a.to}
                  to={rutaDeAlta(a, seccion)}
                  onClick={() => setAbierto(false)}
                  className="d-flex align-items-center gap-2 px-3 py-2 text-decoration-none"
                  style={({ isActive }) => ({
                    color: isActive ? colores.marca : "#334155",
                    backgroundColor: isActive ? colores.marcaFondo : "transparent",
                    fontWeight: isActive ? 600 : 500,
                    fontSize: "0.88rem",
                  })}
                >
                  <IconoAlta icono={a.icono} color={colores.acento} />
                  <span>{a.label}</span>
                </NavLink>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
