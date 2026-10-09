import { useState } from "react";
import { useNavigate } from "react-router-dom";
import TractorIcon from "./TractorIcon";

/**
 * Grilla de tarjetas cuadradas de Reparaciones San Pablo, sin scroll.
 * Cada tarjeta: { id, titulo, bg, hoverBg, accentColor, tractor | icono }
 * y navega a `${base}/${id}`. `porFila` fija cuántas entran por fila;
 * `chicas` achica ícono, título y redondeo para tarjetas de la mitad.
 * `children` va arriba de la grilla, centrado con ella (un encabezado).
 * Una tarjeta puede ocupar `ancho` columnas y tener `alto` veces la altura
 * (09/10/2026, la de Presupuesto: ancho 2, alto 0.5); así el ícono va al
 * costado del título.
 */
export default function TarjetasSanPablo({ tarjetas, base, porFila, maxWidth, chicas = false, children }) {
  const navigate = useNavigate();
  const [hoveredCard, setHoveredCard] = useState(null);
  const gap = chicas ? "1rem" : "1.75rem";
  const caja = chicas ? "40px" : "64px";
  const icono = chicas ? "1.3rem" : "2.1rem";

  return (
    <div
      className="flex-grow-1 d-flex flex-column align-items-center justify-content-center p-4"
      style={{ overflow: "hidden" }}
    >
      {children}
      <div
        className="d-flex flex-wrap justify-content-center"
        style={{ gap, maxWidth, width: "100%" }}
      >
        {tarjetas.map((t) => {
          const isHovered = hoveredCard === t.id;
          const ancho = t.ancho ?? 1;
          const alto = t.alto ?? 1;
          const apaisada = ancho > alto;
          const ruta = `${base}/${t.id}`;
          return (
            <div
              key={t.id}
              className={`d-flex ${apaisada ? "flex-row gap-3 p-2" : "flex-column p-3"} align-items-center justify-content-center text-center`}
              style={{
                background: isHovered ? t.hoverBg : t.bg,
                borderRadius: chicas ? "14px" : "20px",
                width: `calc((100% - ${porFila - 1} * ${gap}) / ${porFila} * ${ancho} + ${ancho - 1} * ${gap})`,
                aspectRatio: `${ancho} / ${alto}`,
                boxShadow: isHovered
                  ? `0 20px 36px -8px rgba(0, 0, 0, 0.45), 0 0 20px ${t.accentColor}40`
                  : "0 10px 25px -4px rgba(0, 0, 0, 0.25)",
                border: `1px solid ${isHovered ? t.accentColor : "rgba(255, 255, 255, 0.12)"}`,
                cursor: "pointer",
                transition: "all 0.22s cubic-bezier(0.4, 0, 0.2, 1)",
                transform: isHovered ? "translateY(-4px)" : "translateY(0)",
                color: "#ffffff",
                userSelect: "none",
              }}
              onClick={() => navigate(ruta)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => e.key === "Enter" && navigate(ruta)}
              onMouseEnter={() => setHoveredCard(t.id)}
              onMouseLeave={() => setHoveredCard(null)}
            >
              <div
                className={`${apaisada ? "" : chicas ? "mb-2" : "mb-3"} d-flex align-items-center justify-content-center`}
                style={{
                  width: caja,
                  height: caja,
                  borderRadius: chicas ? "10px" : "16px",
                  backgroundColor: "rgba(255, 255, 255, 0.1)",
                  border: "1px solid rgba(255, 255, 255, 0.16)",
                  boxShadow: "0 6px 16px rgba(0, 0, 0, 0.15)",
                }}
              >
                {t.tractor ? (
                  <TractorIcon size={icono} color={t.accentColor} />
                ) : (
                  <i className={t.icono} style={{ fontSize: icono, color: t.accentColor }}></i>
                )}
              </div>
              <h3
                className="fw-bold mb-0 text-white"
                style={{ fontSize: chicas ? "0.9rem" : "1.2rem", lineHeight: 1.25 }}
              >
                {t.titulo}
              </h3>
            </div>
          );
        })}
      </div>
    </div>
  );
}
