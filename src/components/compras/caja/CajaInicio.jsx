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
    <div className="caja-cel-centrado d-flex align-items-center justify-content-center px-3">
      {/* El ancho lo fija la columna y no la tarjeta, así "Ver" queda alineado
          con el borde derecho de la tarjeta. */}
      <div className="w-100" style={{ maxWidth: "240px" }}>
        <div className="d-flex justify-content-end mb-4">
          <Button
            size="sm"
            className="rounded-4"
            style={{ backgroundColor: "rgba(22, 78, 99, 0.12)", borderColor: COLOR, color: COLOR, fontWeight: 600 }}
            onClick={() => navigate("/compras/caja/mes")}
          >
            Ver
          </Button>
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
