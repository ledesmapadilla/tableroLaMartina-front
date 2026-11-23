import { Button, Modal, Table } from "react-bootstrap";
import { COLOR, CONCEPTOS, MESES, pesos } from "./comun";

/**
 * El detalle de un día de caja en el celular: cada movimiento con su monto y
 * el saldo del día. Lo usan la semana y el mes (23/11/2026).
 * `dia`: { diaSemana, dia, mes, movimientos, entradas, gastos } o null.
 */
export default function DetalleDia({ dia, onHide }) {
  return (
    <Modal show={dia !== null} onHide={onHide} centered>
      <Modal.Header closeButton>
        <Modal.Title style={{ fontSize: "1.1rem" }}>{dia ? `${dia.diaSemana} ${dia.dia} de ${MESES[dia.mes]}` : ""}</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <Table bordered size="sm" className="mb-0 align-middle" style={{ fontSize: "0.85rem" }}>
          <thead>
            <tr>
              <th style={{ backgroundColor: COLOR, color: "#fff" }}>Detalle</th>
              <th className="text-end" style={{ backgroundColor: COLOR, color: "#fff" }}>
                Monto
              </th>
            </tr>
          </thead>
          <tbody>
            {(dia?.movimientos || []).map((m) => {
              const c = CONCEPTOS[m.concepto] || CONCEPTOS.gasto;
              return (
                <tr key={m._id}>
                  <td style={{ overflowWrap: "anywhere" }}>
                    <div>{m.descripcion || <span className="text-muted fst-italic">{c.texto}</span>}</div>
                    {m.observaciones && <div className="text-muted" style={{ fontSize: "0.75rem" }}>{m.observaciones}</div>}
                    {(m.archivos || []).length > 0 && (
                      <div className="d-flex gap-2 flex-wrap mt-1">
                        {m.archivos.map((a, i) => (
                          <a key={a.publicId || i} href={a.url} target="_blank" rel="noreferrer" style={{ fontSize: "0.75rem" }}>
                            <i className={`bi ${a.tipo === "image" ? "bi-image" : "bi-paperclip"} me-1`}></i>
                            {a.tipo === "image" ? `Foto ${i + 1}` : a.nombre || `Archivo ${i + 1}`}
                          </a>
                        ))}
                      </div>
                    )}
                  </td>
                  <td className="text-end fw-semibold" style={{ color: c.color, whiteSpace: "nowrap" }}>
                    {c.signo}
                    {pesos(m.monto)}
                  </td>
                </tr>
              );
            })}
          </tbody>
          {/* El saldo del día es lo primero que se mira: abajo y en negrita. */}
          <tfoot>
            <tr className="fw-bold">
              <td className="text-center">Saldo del día</td>
              <td className="text-end" style={{ whiteSpace: "nowrap" }}>
                {dia ? pesos(dia.entradas - dia.gastos) : ""}
              </td>
            </tr>
          </tfoot>
        </Table>
      </Modal.Body>
      <Modal.Footer>
        <Button variant="outline-secondary" onClick={onHide}>
          Cerrar
        </Button>
      </Modal.Footer>
    </Modal>
  );
}
