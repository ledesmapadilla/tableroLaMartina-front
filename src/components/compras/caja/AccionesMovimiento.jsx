/**
 * Editar y borrar un movimiento desde el celular (23/11/2026): una columna
 * angosta al final de la tabla, solo con los íconos (lápiz arriba, tacho
 * abajo), en el detalle del día y en el historial de la semana. Sin permiso
 * de editar la columna no está (conAcciones, en comun.js).
 */
const boton = { fontSize: "1rem", lineHeight: 1 };

export default function CeldaAcciones({ mov, onEditar, onBorrar }) {
  return (
    <td className="text-center" style={{ width: 34, verticalAlign: "middle" }}>
      <div className="d-flex flex-column align-items-center gap-2">
        {onEditar && (
          <button
            type="button"
            className="caja-cel-radio border-0 bg-transparent p-0"
            style={{ ...boton, color: "#1d4ed8" }}
            onClick={() => onEditar(mov)}
            aria-label="Editar"
            title="Editar"
          >
            <i className="bi bi-pencil-fill"></i>
          </button>
        )}
        {onBorrar && (
          <button
            type="button"
            className="caja-cel-radio border-0 bg-transparent p-0"
            style={{ ...boton, color: "#dc2626" }}
            onClick={() => onBorrar(mov)}
            aria-label="Borrar"
            title="Borrar"
          >
            <i className="bi bi-trash-fill"></i>
          </button>
        )}
      </div>
    </td>
  );
}
