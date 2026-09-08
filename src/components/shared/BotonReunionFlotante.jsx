import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Modal } from "react-bootstrap";

/**
 * Atajo para la reunión: las planillas que se miran todas juntas cuando se
 * repasa el estado de la flota. Va pegado abajo del botón de tablero y abre un
 * modal con los cuatro destinos, para no tener que ir buscándolos por el menú.
 *
 * Para sumar o sacar una planilla se toca `DESTINOS` y nada más.
 */
const DESTINOS = [
  {
    titulo: "Control de último service",
    detalle: "Flota de tractores",
    icono: "bi-speedometer2",
    color: "#4a6fa5",
    bg: "#eef3fa",
    to: "/tractores/preventivo",
  },
  {
    titulo: "Planilla general de reparaciones",
    detalle: "Flota de camiones",
    icono: "bi-truck",
    color: "#52735a",
    bg: "#edf5ef",
    to: "/camionetas/services/reparaciones/resumen",
  },
  {
    titulo: "Planilla de reparaciones",
    detalle: "Maquinaria y tractores",
    icono: "bi-tools",
    color: "#9e8850",
    bg: "#fcf8ee",
    to: "/tractores/services/reparaciones/resumen",
  },
  {
    titulo: "Pendientes",
    detalle: "Todavía no está hecha",
    icono: "bi-list-check",
    color: "#6b5b7b",
    bg: "#f6f2f9",
    to: "/pendientes",
  },
];

function BotonReunionFlotante() {
  const navigate = useNavigate();
  const [hovered, setHovered] = useState(false);
  const [abierto, setAbierto] = useState(false);
  const [tocado, setTocado] = useState(null);

  const ir = (to) => {
    setAbierto(false);
    navigate(to);
  };

  return (
    <>
      <button
        onClick={() => setAbierto(true)}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        title="Reunión — planillas de la flota"
        style={{
          position: "fixed",
          // Pegado abajo del botón de tablero, que mide 44px y arranca en 25%.
          top: "calc(25% + 50px)",
          right: 0,
          zIndex: 1040,
          width: "44px",
          height: "44px",
          backgroundColor: abierto ? "#0f172a" : hovered ? "#334155" : "#1e293b",
          color: "#ffffff",
          borderTopLeftRadius: "12px",
          borderBottomLeftRadius: "12px",
          borderTopRightRadius: "0px",
          borderBottomRightRadius: "0px",
          border: "1px solid #475569",
          borderRight: "none",
          boxShadow: hovered
            ? "-4px 4px 14px rgba(0, 0, 0, 0.35)"
            : "-2px 3px 8px rgba(0, 0, 0, 0.22)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          cursor: "pointer",
          transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
          transform: hovered ? "translateX(-3px)" : "translateX(0)",
          padding: 0,
          outline: "none",
        }}
      >
        <i
          className="bi bi-people-fill"
          style={{
            fontSize: "1.25rem",
            color: abierto ? "#38bdf8" : "#ffffff",
            transition: "transform 0.2s ease",
            transform: hovered ? "scale(1.1)" : "scale(1)",
          }}
        ></i>
      </button>

      <Modal show={abierto} onHide={() => setAbierto(false)} centered>
        <Modal.Header
          closeButton
          closeVariant="white"
          style={{ backgroundColor: "#1e293b", color: "#fff", borderBottom: "1px solid #475569" }}
        >
          <Modal.Title style={{ fontSize: "1rem", display: "flex", alignItems: "center", gap: 8 }}>
            <i className="bi bi-people-fill"></i>
            Reunión
          </Modal.Title>
        </Modal.Header>

        <Modal.Body style={{ display: "flex", flexDirection: "column", gap: 10, padding: 16 }}>
          {DESTINOS.map((d) => (
            <button
              key={d.to}
              onClick={() => ir(d.to)}
              onMouseEnter={() => setTocado(d.to)}
              onMouseLeave={() => setTocado(null)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                width: "100%",
                textAlign: "left",
                padding: "12px 14px",
                borderRadius: 10,
                border: `1px solid ${tocado === d.to ? d.color : "#e2e8f0"}`,
                backgroundColor: tocado === d.to ? d.bg : "#ffffff",
                cursor: "pointer",
                transition: "all 0.15s ease",
              }}
            >
              <span
                className="rounded-3 d-flex align-items-center justify-content-center"
                style={{
                  width: 36,
                  height: 36,
                  flexShrink: 0,
                  backgroundColor: d.bg,
                  color: d.color,
                  fontSize: "1.1rem",
                }}
              >
                <i className={`bi ${d.icono}`}></i>
              </span>
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ display: "block", fontWeight: 600, fontSize: "0.9rem", color: "#1e293b" }}>
                  {d.titulo}
                </span>
                <span style={{ display: "block", fontSize: "0.78rem", color: "#64748b" }}>
                  {d.detalle}
                </span>
              </span>
              <i className="bi bi-chevron-right" style={{ color: d.color, fontSize: "0.85rem" }}></i>
            </button>
          ))}
        </Modal.Body>
      </Modal>
    </>
  );
}

export default BotonReunionFlotante;
