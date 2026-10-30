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
 * costado del título. Con `subtitulo` (10/10/2026, los responsables de cada
 * Manitou) va un renglón chico debajo del título. Con `etiqueta` ({ texto,
 * color }, 11/10/2026, el estado de cada Manitou) va una pastilla de color
 * al pie de la tarjeta. Con `avance` (21/10/2026, el de la reparación de
 * cada Manitou, de 0 a 100) va una barra con el % arriba de todo (pedido
 * así: más visible). Con `fechaLimite`
 * (28/10/2026, "dd/mm/aaaa") va otro renglón chico debajo del subtítulo;
 * `fechaEtiqueta` cambia el "Fecha límite" de adelante y `fechaAbajo` la
 * lleva al pie de la tarjeta.
 */
export default function TarjetasSanPablo({ tarjetas, base, porFila, maxWidth, chicas = false, iconoChico = false, children }) {
  const navigate = useNavigate();
  const [hoveredCard, setHoveredCard] = useState(null);
  const gap = chicas ? "1rem" : "1.75rem";
  // `iconoChico` (28/10/2026, las Manitou) achica solo el ícono.
  const caja = chicas ? "40px" : iconoChico ? "44px" : "64px";
  const icono = chicas ? "1.3rem" : iconoChico ? "1.45rem" : "2.1rem";

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
                // Para la etiqueta, que va al pie.
                position: "relative",
              }}
              onClick={() => navigate(ruta)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => e.key === "Enter" && navigate(ruta)}
              onMouseEnter={() => setHoveredCard(t.id)}
              onMouseLeave={() => setHoveredCard(null)}
            >
              {/* Con `torta` (21/10/2026, la tarjeta General) el avance va en
                  una torta en lugar del ícono: amarillo lo hecho, el % al
                  centro. */}
              {t.torta && typeof t.avance === "number" ? (
                <div
                  className={`${chicas ? "mb-2" : "mb-3"} d-flex align-items-center justify-content-center`}
                  title={t.avanceTitulo}
                  style={{
                    width: chicas ? "72px" : "104px",
                    height: chicas ? "72px" : "104px",
                    borderRadius: "50%",
                    background: `conic-gradient(#facc15 0 ${Math.min(t.avance, 100)}%, rgba(255, 255, 255, 0.2) 0)`,
                    border: "1px solid rgba(255, 255, 255, 0.35)",
                    boxShadow: "0 6px 16px rgba(0, 0, 0, 0.25)",
                  }}
                >
                  {/* El agujero del centro, con el color de la tarjeta, para leer el %. */}
                  <div
                    className="d-flex align-items-center justify-content-center fw-bold"
                    style={{
                      width: "64%",
                      height: "64%",
                      borderRadius: "50%",
                      background: isHovered ? t.hoverBg : t.bg,
                      color: "#facc15",
                      fontSize: chicas ? "0.9rem" : "1.2rem",
                      lineHeight: 1,
                    }}
                  >
                    {t.avance.toLocaleString("es-AR", { maximumFractionDigits: 1 })}%
                  </div>
                </div>
              ) : (
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
              )}
              <h3
                className="fw-bold mb-0 text-white"
                style={{ fontSize: chicas ? "0.9rem" : "1.2rem", lineHeight: 1.25 }}
              >
                {t.titulo}
              </h3>
              {t.subtitulo && (
                <div
                  className="fw-semibold mt-1"
                  style={{ fontSize: chicas ? "0.7rem" : "0.8rem", lineHeight: 1.2, color: t.accentColor }}
                >
                  {t.subtitulo}
                </div>
              )}
              {t.fechaLimite && (
                <div
                  className={`${t.fechaAbajo ? "" : "mt-3 "}text-nowrap`}
                  style={{
                    fontSize: chicas ? "0.7rem" : "0.8rem",
                    lineHeight: 1.2,
                    color: "#fde68a",
                    // Al pie, sin correr el nombre del centro, como la etiqueta.
                    ...(t.fechaAbajo && {
                      position: "absolute",
                      bottom: chicas ? "10px" : "18px",
                      left: "50%",
                      transform: "translateX(-50%)",
                    }),
                  }}
                  title="Para cuándo tiene que estar reparada"
                >
                  <i className="bi bi-calendar-event me-1"></i>
                  {t.fechaEtiqueta ?? "Fecha límite"}: {t.fechaLimite}
                </div>
              )}
              {/* El avance de la reparación, arriba de todo y bien visible: la
                  barra con el % al lado. Como la etiqueta del pie, no corre el
                  nombre del centro. */}
              {typeof t.avance === "number" && !t.torta && (
                <div
                  className="d-flex align-items-center gap-2"
                  style={{
                    position: "absolute",
                    top: chicas ? "10px" : "16px",
                    left: "50%",
                    transform: "translateX(-50%)",
                    width: "84%",
                  }}
                  title={t.avanceTitulo}
                >
                  <div
                    style={{
                      flex: 1,
                      height: chicas ? "10px" : "14px",
                      borderRadius: "7px",
                      backgroundColor: "rgba(255, 255, 255, 0.22)",
                      border: "1px solid rgba(255, 255, 255, 0.35)",
                      overflow: "hidden",
                    }}
                  >
                    <div
                      style={{
                        width: `${Math.min(t.avance, 100)}%`,
                        height: "100%",
                        // Amarillo: resalta sobre el verde de las Manitou y el
                        // gris de General (el acento verde se perdía).
                        backgroundColor: "#facc15",
                        transition: "width 0.3s",
                      }}
                    />
                  </div>
                  <span className="fw-bold" style={{ fontSize: chicas ? "0.95rem" : "1.25rem", lineHeight: 1, color: "#facc15" }}>
                    {t.avance.toLocaleString("es-AR", { maximumFractionDigits: 1 })}%
                  </span>
                </div>
              )}
              {t.etiqueta && (
                <span
                  className="fw-bold px-2 py-1 rounded-pill d-inline-flex align-items-center gap-1"
                  style={{
                    // Al pie de la tarjeta, sin correr el nombre del centro.
                    position: "absolute",
                    bottom: chicas ? "8px" : "14px",
                    left: "50%",
                    transform: "translateX(-50%)",
                    whiteSpace: "nowrap",
                    backgroundColor: t.etiqueta.color,
                    color: "#fff",
                    fontSize: chicas ? "0.66rem" : "0.74rem",
                    lineHeight: 1,
                  }}
                >
                  <i className="bi bi-circle-fill" style={{ fontSize: "0.45rem" }}></i>
                  {t.etiqueta.texto}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
