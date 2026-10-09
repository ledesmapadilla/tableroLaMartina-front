import { Card, Form } from "react-bootstrap";
import { OPCIONES_CHEQUEO, OPCIONES_ESTADO } from "../../helpers/excelManitou";

const ALTO = "26px";

/**
 * Un filtro en una sola línea: el rótulo al costado y no arriba, para que la
 * barra sea baja. Por lo demás, como el FiltroSelect de compras/estilos.jsx:
 * activo va en rojo y negrita (`filtro-activo`), con la cruz para limpiarlo.
 */
function FiltroCompacto({ etiqueta, ancho, valor, opciones, onChange }) {
  return (
    <div className="d-flex align-items-center gap-1">
      <span className="fw-bold text-dark" style={{ fontSize: "0.72rem" }}>
        {etiqueta}
      </span>
      <div className="input-group input-group-sm" style={{ width: ancho }}>
        <Form.Select
          size="sm"
          value={valor}
          onChange={(e) => onChange(e.target.value)}
          className={`rounded-3 ${valor ? "rounded-end-0 border-end-0 fw-bold filtro-activo" : ""}`}
          style={{
            fontSize: "0.76rem",
            height: ALTO,
            padding: "1px 22px 1px 6px",
            backgroundPosition: "right 6px center",
            color: valor ? "#dc2626" : "#1e293b",
            fontWeight: valor ? "700" : "normal",
          }}
        >
          <option value="">Todos</option>
          {opciones.map((o) => (
            <option key={o}>{o}</option>
          ))}
        </Form.Select>
        {valor && (
          <button
            className="btn btn-outline-secondary border-start-0 d-flex align-items-center justify-content-center sin-zoom"
            type="button"
            onClick={() => onChange("")}
            title={`Limpiar filtro ${etiqueta.toLowerCase()}`}
            style={{ padding: "0 5px", height: ALTO }}
          >
            <i className="bi bi-x" style={{ fontSize: "0.85rem" }}></i>
          </button>
        )}
      </div>
    </div>
  );
}

/**
 * La barra de filtros de la tabla de una Manitou (09/10/2026), como en el
 * resto del proyecto (docs/formato-tablas.md, "Barra de filtros") pero baja:
 * el chequeo y el estado, en una línea. `valor` es { chequeo, estado }. En la
 * página desplegada es una sola para todos los sistemas; en la de un sistema,
 * una por tabla. Centrada salvo que `className` diga otra cosa.
 */
export default function FiltroChequeoManitou({ valor, onChange, className = "mb-2 align-self-center mx-auto" }) {
  return (
    <Card className={`px-2 py-1 shadow-sm border-0 rounded-3 ${className}`} style={{ width: "fit-content" }}>
      <div className="d-flex flex-wrap align-items-center gap-3">
        <FiltroCompacto
          etiqueta="Chequeo"
          ancho="120px"
          valor={valor.chequeo}
          opciones={OPCIONES_CHEQUEO}
          onChange={(chequeo) => onChange({ ...valor, chequeo })}
        />
        <FiltroCompacto
          etiqueta="Estado"
          ancho="145px"
          valor={valor.estado}
          opciones={OPCIONES_ESTADO}
          onChange={(estado) => onChange({ ...valor, estado })}
        />
      </div>
    </Card>
  );
}
