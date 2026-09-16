import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, Form } from "react-bootstrap";
import NavbarSanPablo from "../shared/NavbarSanPablo";
import { cosechasDisponibles, cosechaActual } from "../../utils/cosechas";

// El verde de la tarjeta Manitous.
const FONDO = "linear-gradient(135deg, #064e3b 0%, #047857 100%)";
const FONDO_HOVER = "linear-gradient(135deg, #022c22 0%, #064e3b 100%)";
const ACENTO = "#34d399";

/**
 * Entrada de Reparaciones San Pablo: al elegir el año en el select se entra a
 * esa cosecha, donde están las tarjetas de siempre (Manitous, Tolvas…) con sus
 * ingresos. La lista de años sigue sola (utils/cosechas.js).
 *
 * Viene marcado el año actual. Como elegir el mismo año en el select no lo
 * cambia, a ese se entra tocando la tarjeta.
 */
export default function CosechasSanPablo() {
  const navigate = useNavigate();
  const cosechas = cosechasDisponibles();
  const marcada = cosechaActual();
  const [hover, setHover] = useState(false);

  const entrar = (anio) => navigate(`/reparaciones/sanpablo/${anio}`);

  return (
    <div
      style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        backgroundColor: "#f8f9fa",
        height: "100%",
        maxHeight: "100vh",
        overflow: "hidden",
      }}
    >
      <NavbarSanPablo icono={<i className="bi bi-tools"></i>} volverA="/inicio" />

      <div
        className="flex-grow-1 d-flex flex-column align-items-center justify-content-center p-4"
        style={{ overflow: "hidden" }}
      >
        <Card
          className="border-0 rounded-4 text-white"
          style={{
            width: "320px",
            background: hover ? FONDO_HOVER : FONDO,
            boxShadow: hover
              ? `0 20px 36px -8px rgba(0, 0, 0, 0.45), 0 0 20px ${ACENTO}40`
              : "0 10px 25px -4px rgba(0, 0, 0, 0.25)",
            cursor: "pointer",
            transition: "all 0.22s cubic-bezier(0.4, 0, 0.2, 1)",
          }}
          onClick={() => entrar(marcada)}
          onMouseEnter={() => setHover(true)}
          onMouseLeave={() => setHover(false)}
          title={`Entrar a la cosecha ${marcada}`}
        >
          <div className="p-4 d-flex flex-column align-items-center gap-3">
            <div
              className="d-flex align-items-center justify-content-center"
              style={{
                width: "56px",
                height: "56px",
                borderRadius: "16px",
                backgroundColor: "rgba(255, 255, 255, 0.1)",
                border: "1px solid rgba(255, 255, 255, 0.16)",
              }}
            >
              {/* Bootstrap Icons no tiene limón: va el emoji. */}
              <span role="img" aria-label="Limón" style={{ fontSize: "1.9rem", lineHeight: 1 }}>
                🍋
              </span>
            </div>
            <Form.Label htmlFor="cosecha-sanpablo" className="fw-semibold mb-0" style={{ fontSize: "1rem" }}>
              Para cosecha
            </Form.Label>
            <Form.Select
              id="cosecha-sanpablo"
              value={marcada}
              // Que tocar el select no cuente como tocar la tarjeta.
              onClick={(e) => e.stopPropagation()}
              onChange={(e) => entrar(e.target.value)}
              className="rounded-3 text-center fw-bold"
              style={{ fontSize: "1.4rem", color: "#064e3b", cursor: "pointer" }}
              autoFocus
            >
              {cosechas.map((anio) => (
                <option key={anio} value={anio}>
                  {anio}
                </option>
              ))}
            </Form.Select>
          </div>
        </Card>
      </div>
    </div>
  );
}
