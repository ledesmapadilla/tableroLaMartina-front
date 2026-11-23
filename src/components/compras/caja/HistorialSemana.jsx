import { Button, Modal, Table } from "react-bootstrap";
import { COLOR, CONCEPTOS, DIAS_SEMANA, aFecha, ddmm, pesos, conAcciones } from "./comun";
import CeldaAcciones from "./AccionesMovimiento";

/**
 * El historial de la semana de un concepto (23/11/2026): se abre al tocar
 * Entradas o Gastos en la Semanal del celular. Cada movimiento con su día, su
 * detalle y su monto; arriba, si corresponde, el saldo que vino de la semana
 * anterior (positivo en entradas, negativo en gastos, helpers/cajaSemanas.js).
 * El total del pie es el mismo del recuadro tocado.
 *
 * `concepto`: "ingreso" | "gasto" | null (cerrado).
 */
export default function HistorialSemana({ concepto, semana, jueves, movimientos, anterior, total, onHide, onEditar, onBorrar, sinEditar }) {
  const c = CONCEPTOS[concepto] || CONCEPTOS.ingreso;
  const lista = (movimientos || [])
    .filter((m) => m.concepto === concepto && m.fecha >= semana && m.fecha <= jueves)
    .sort((a, b) => a.fecha.localeCompare(b.fecha) || String(a.createdAt || "").localeCompare(String(b.createdAt || "")));
  // Lo que vino de la semana anterior y va en este concepto.
  const arrastre = concepto === "ingreso" ? Math.max(anterior, 0) : Math.max(-anterior, 0);
  const th = { backgroundColor: COLOR, color: "#fff" };
  const acciones = conAcciones({ onEditar, onBorrar, sinEditar });

  return (
    <Modal show={concepto !== null} onHide={onHide} centered scrollable>
      <Modal.Header closeButton>
        <Modal.Title style={{ fontSize: "1.05rem" }}>
          {concepto === "gasto" ? "Gastos" : "Entradas"} · vie {ddmm(semana)} al jue {ddmm(jueves)}
        </Modal.Title>
      </Modal.Header>
      <Modal.Body>
        {lista.length === 0 && arrastre === 0 ? (
          <div className="text-center fst-italic text-body-tertiary py-2">Sin {concepto === "gasto" ? "gastos" : "entradas"} en la semana</div>
        ) : (
          <Table bordered size="sm" className="mb-0 align-middle" style={{ fontSize: "0.85rem" }}>
            <thead>
              <tr>
                <th style={th}>Día</th>
                <th style={th}>Detalle</th>
                <th className="text-end" style={th}>
                  Monto
                </th>
                {acciones && <th style={{ ...th, width: 34 }}></th>}
              </tr>
            </thead>
            <tbody>
              {arrastre > 0 && (
                <tr>
                  <td className="text-muted" style={{ whiteSpace: "nowrap" }}>
                    –
                  </td>
                  <td className="fst-italic text-muted">Saldo de la semana anterior</td>
                  <td className="text-end fw-semibold" style={{ color: c.color, whiteSpace: "nowrap" }}>
                    {pesos(arrastre)}
                  </td>
                  {acciones && <td></td>}
                </tr>
              )}
              {lista.map((m) => (
                <tr key={m._id}>
                  <td style={{ whiteSpace: "nowrap" }}>
                    {DIAS_SEMANA[aFecha(m.fecha).getDay()]} {ddmm(m.fecha)}
                  </td>
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
                    {pesos(m.monto)}
                  </td>
                  {acciones && <CeldaAcciones mov={m} onEditar={onEditar} onBorrar={onBorrar} />}
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="fw-bold">
                <td colSpan={2} className="text-center">
                  Total {concepto === "gasto" ? "gastos" : "entradas"}
                </td>
                <td className="text-end" style={{ color: c.color, whiteSpace: "nowrap" }}>
                  {pesos(total)}
                </td>
                {acciones && <td></td>}
              </tr>
            </tfoot>
          </Table>
        )}
      </Modal.Body>
      <Modal.Footer>
        <Button variant="outline-secondary" onClick={onHide}>
          Cerrar
        </Button>
      </Modal.Footer>
    </Modal>
  );
}
