import { Form } from "react-bootstrap";
import { campo } from "../compras/formato";
import { Raya } from "../compras/estilos";

// Los frentes de San Pablo (02/10/2026): se dan de alta en Carros porta
// escaleras y se eligen ahí y en Escaleras. Cada uno tiene nombre y cliente.

const GRIS_CLARO = "#a0aec0";
const TEXTO = "#1e293b";

// El frente en la tabla: el nombre y, al lado, el cliente en gris.
export function CeldaFrente({ frente }) {
  if (!frente?.nombre) return <Raya />;
  return (
    <span>
      {frente.nombre}
      {frente.cliente && (
        <span className="text-muted" style={{ fontSize: "0.66rem" }}>
          {" "}
          · {frente.cliente}
        </span>
      )}
    </span>
  );
}

// El desplegable con los frentes dados de alta.
export function SelectFrente({ frentes, valor, onChange, required = false }) {
  return (
    <>
      <Form.Select
        className="rounded-3"
        style={{ ...campo, color: valor ? TEXTO : GRIS_CLARO }}
        value={valor || ""}
        onChange={(e) => onChange(e.target.value)}
        required={required}
      >
        <option value="">Elegir frente…</option>
        {frentes.map((f) => (
          <option key={f._id} value={f._id} style={{ color: TEXTO }}>
            {f.nombre}
            {f.cliente ? ` · ${f.cliente}` : ""}
          </option>
        ))}
      </Form.Select>
      {frentes.length === 0 && (
        <div className="text-muted mt-1" style={{ fontSize: "0.72rem" }}>
          No hay frentes dados de alta: se agregan con el botón Alta de frente de Carros porta escaleras.
        </div>
      )}
    </>
  );
}
