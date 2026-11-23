/**
 * Editar y borrar un movimiento desde el celular (23/11/2026): un lápiz y un
 * tacho debajo del detalle, en el detalle del día y en el historial de la
 * semana. Sin permiso de editar no aparecen.
 */
export default function AccionesMovimiento({ mov, onEditar, onBorrar, sinEditar }) {
  if (sinEditar || (!onEditar && !onBorrar)) return null;
  const estilo = { fontSize: "0.78rem", fontWeight: 600 };
  return (
    <div className="d-flex gap-3 mt-1">
      {onEditar && (
        <button type="button" className="caja-cel-radio border-0 bg-transparent p-0" style={{ ...estilo, color: "#1d4ed8" }} onClick={() => onEditar(mov)}>
          <i className="bi bi-pencil-fill me-1"></i>
          Editar
        </button>
      )}
      {onBorrar && (
        <button type="button" className="caja-cel-radio border-0 bg-transparent p-0" style={{ ...estilo, color: "#dc2626" }} onClick={() => onBorrar(mov)}>
          <i className="bi bi-trash-fill me-1"></i>
          Borrar
        </button>
      )}
    </div>
  );
}
