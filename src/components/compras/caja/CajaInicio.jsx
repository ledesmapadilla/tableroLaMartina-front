import { Button, Card } from "react-bootstrap";
import { useNavigate } from "react-router-dom";
import { usePermisos } from "../../../context/permisos";
import { COLOR, useAltoVista } from "./comun";
import "./caja.css";

/**
 * Caja desde el celular (13/11/2026): la entrada. Una sola tarjeta grande
 * para cargar y "Ver" para el mes, como /gasoil/carga del Sistema de Gestión
 * Lepa. La tabla completa, con editar y borrar, sigue en Contable › Caja.
 */
export default function CajaInicio() {
  const navigate = useNavigate();
  const { puede } = usePermisos();
  const sinEditar = !puede("compras.caja", "editar");
  useAltoVista();

  return (
    <div className="caja-cel-centrado position-relative d-flex align-items-center justify-content-center px-3">
      {/* Volver a Compras, arriba de todo a la derecha como en las otras
          pantallas de Caja; no corre la tarjeta del centro. */}
      <Button
        size="sm"
        variant="outline-secondary"
        className="position-absolute"
        style={{ top: "12px", right: "16px" }}
        onClick={() => navigate("/compras")}
      >
        Volver
      </Button>
      {/* El ancho lo fija la columna y no la tarjeta, así los botones de
          arriba quedan alineados con los bordes de la tarjeta. */}
      <div className="w-100" style={{ maxWidth: "240px" }}>
        {/* Semanal a la izquierda y Mensual a la derecha (23/11/2026: "Ver"
            pasó a ser "Semanal" y se sumó "Mensual"). */}
        <div className="d-flex justify-content-between align-items-center mb-4">
          {[
            ["Semanal", "/compras/caja/semana"],
            ["Mensual", "/compras/caja/mes"],
          ].map(([texto, ruta]) => (
            <Button
              key={ruta}
              size="sm"
              className="rounded-4"
              style={{ backgroundColor: "rgba(22, 78, 99, 0.12)", borderColor: COLOR, color: COLOR, fontWeight: 600 }}
              onClick={() => navigate(ruta)}
            >
              {texto}
            </Button>
          ))}
        </div>

        <Card
          role={sinEditar ? undefined : "button"}
          onClick={sinEditar ? undefined : () => navigate("/compras/caja/nuevo")}
          className="text-center rounded-4 w-100"
          style={{
            cursor: sinEditar ? "not-allowed" : "pointer",
            opacity: sinEditar ? 0.5 : 1,
            borderColor: COLOR,
            backgroundColor: "rgba(22, 78, 99, 0.12)",
          }}
          title={sinEditar ? "Sin permiso para editar" : undefined}
        >
          <Card.Body className="py-4">
            <i className="bi bi-safe2-fill" style={{ fontSize: "2rem", lineHeight: 1, color: COLOR }}></i>
            <Card.Title className="mt-2 mb-0" style={{ fontSize: "1.15rem", color: COLOR }}>
              Nueva carga
            </Card.Title>
          </Card.Body>
        </Card>
      </div>
    </div>
  );
}
