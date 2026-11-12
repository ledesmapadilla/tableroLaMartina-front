import { OverlayTrigger, Popover } from "react-bootstrap";

/**
 * El ayudamemoria de una columna (12/11/2026): un ⓘ chico al lado del
 * nombre en el encabezado. Al pasar el mouse (o tocarlo en el celular) abre
 * un globito con de dónde sale el dato y cómo se calcula.
 *
 * `titulo`: el nombre de la columna. `ayuda`: { origen, calculo }.
 * `color`: el del ícono, que va sobre el encabezado oscuro.
 */
export default function AyudaColumna({ titulo, ayuda, color = "#e2e8f0" }) {
  if (!ayuda) return null;
  const globo = (
    <Popover style={{ maxWidth: "320px", fontSize: "0.75rem" }}>
      <Popover.Header as="div" className="fw-bold" style={{ fontSize: "0.78rem" }}>
        {titulo}
      </Popover.Header>
      <Popover.Body style={{ padding: "8px 10px", color: "#334155", lineHeight: 1.35 }}>
        {ayuda.origen && (
          <div className={ayuda.calculo ? "mb-2" : undefined}>
            <div className="fw-bold" style={{ color: "#0f172a" }}>
              <i className="bi bi-database me-1"></i>De dónde sale
            </div>
            {ayuda.origen}
          </div>
        )}
        {ayuda.calculo && (
          <div>
            <div className="fw-bold" style={{ color: "#0f172a" }}>
              <i className="bi bi-calculator me-1"></i>Cómo se calcula
            </div>
            {ayuda.calculo}
          </div>
        )}
      </Popover.Body>
    </Popover>
  );
  return (
    <OverlayTrigger trigger={["hover", "focus"]} placement="bottom" overlay={globo}>
      {/* Un botón para que en el celular el toque le dé foco y lo abra. */}
      <button
        type="button"
        aria-label={`Ayuda: ${titulo}`}
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "none",
          border: "none",
          padding: 0,
          marginLeft: "4px",
          color,
          cursor: "help",
          lineHeight: 1,
          verticalAlign: "middle",
        }}
      >
        <i className="bi bi-info-circle" style={{ fontSize: "0.68rem" }}></i>
      </button>
    </OverlayTrigger>
  );
}
