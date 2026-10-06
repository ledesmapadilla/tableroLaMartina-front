import { Modal, Table } from "react-bootstrap";
import { compararCC } from "../../utils/ordenCC";
import { th as thBase, td, tdCentro } from "../compras/formato";
import { Raya } from "../compras/estilos";

// El slate de Mantenimiento.
const COLOR = "#1e293b";
const COLOR_SUAVE = "#f1f5f9";
const NARANJA = "#c2410c";
const th = { ...thBase, backgroundColor: COLOR };
const thCentro = { ...th, textAlign: "center" };

// La fecha es un día sin hora y viaja como 00:00 UTC: se lee sin pasarla a la
// hora local, que la correría al día anterior.
const fechaCorta = (iso) => {
  const [a, m, d] = (iso ? String(iso).slice(0, 10) : "").split("-");
  return a ? `${d}/${m}/${a}` : "";
};

/**
 * Historial de los carros porta escaleras de una cosecha: una fila por carro
 * con su entrada y su salida. Arriba, los que siguen en San Pablo.
 *
 * Sale de los movimientos de Escaleras de la cosecha (06/10/2026): la entrada
 * es el Ingreso con ese carro (o, lo cargado antes, la fila que dejó el
 * ingreso del carro) y la salida, el Retiro de escaleras que se lo lleva. Un
 * carro entra y sale una sola vez por cosecha.
 */
export default function HistorialCarros({ show, onHide, cosecha, ingresos }) {
  const porCarro = new Map();
  const filaDe = (i) => {
    const clave = i.cc?._id || "sin-carro";
    if (!porCarro.has(clave)) {
      porCarro.set(clave, { clave, cc: i.cc?.cc || "", descripcion: i.cc?.descripcion || "", entrada: null, salida: null });
    }
    return porCarro.get(clave);
  };
  // Solo los movimientos con carro: las nuevas, las bajas y los ingresos S/N
  // no tienen.
  for (const i of ingresos) {
    if (!i.cc || i.nuevas || i.baja) continue;
    const fila = filaDe(i);
    if (i.retiro) fila.salida = { fecha: i.fechaIngreso, quien: i.ingresadoPor };
    else fila.entrada = { fecha: i.fechaIngreso, quien: i.ingresadoPor };
  }
  const historial = [...porCarro.values()].sort((a, b) => compararCC(a.cc, b.cc));
  // Los que entraron y todavía no salieron.
  const carrosEnSanPablo = historial.filter((f) => f.entrada && !f.salida);
  const enSanPablo = carrosEnSanPablo.length;

  return (
    <Modal show={show} onHide={onHide} centered scrollable size="lg" contentClassName="border-0 shadow-lg rounded-4">
      <Modal.Header
        closeButton
        closeVariant="white"
        style={{
          backgroundColor: COLOR,
          color: "#fff",
          borderTopLeftRadius: "1rem",
          borderTopRightRadius: "1rem",
          borderBottom: "1px solid rgba(255,255,255,0.1)",
        }}
      >
        <Modal.Title className="fs-6 fw-normal d-flex align-items-center gap-2 text-white">
          <i className="bi bi-clock-history"></i>
          <span>Historial de carros · Cosecha {cosecha}</span>
        </Modal.Title>
      </Modal.Header>
      <Modal.Body className="p-3">
        <div
          className="mb-3 px-3 py-2 rounded-3 d-flex align-items-center gap-2 flex-wrap"
          style={{ backgroundColor: COLOR_SUAVE, color: COLOR }}
        >
          <span className="fw-bold" style={{ fontSize: "1.3rem" }}>
            {enSanPablo}
          </span>
          <span style={{ fontSize: "0.8rem" }}>
            {enSanPablo === 1 ? "carro en San Pablo" : "carros en San Pablo"}
            {enSanPablo > 0 && ":"}
          </span>
          {carrosEnSanPablo.map((f) => (
            <span
              key={f.clave}
              className="px-2 rounded-pill bg-white fw-bold"
              style={{ fontSize: "0.74rem", border: "1px solid #cbd5e1" }}
            >
              {f.cc}
            </span>
          ))}
        </div>
        <div className="rounded-3 bg-white" style={{ border: "1px solid #cbd5e1", overflowX: "auto" }}>
          <Table className="mb-0 tabla-informe" style={{ width: "100%" }}>
            <thead>
              <tr>
                <th style={th}>Carro</th>
                <th style={thCentro}>Fecha entrada</th>
                <th style={th}>Quién entra</th>
                <th style={thCentro}>Fecha salida</th>
                <th style={th}>Quién sale</th>
              </tr>
            </thead>
            <tbody>
              {historial.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-center text-muted py-3" style={td}>
                    No hay movimientos todavía
                  </td>
                </tr>
              ) : (
                historial.map((f) => (
                  <tr key={f.clave}>
                    <td style={{ ...td, fontWeight: 700, whiteSpace: "nowrap" }}>
                      {f.cc || <Raya />}
                      {f.descripcion && (
                        <span className="text-muted fw-normal" style={{ fontSize: "0.66rem" }}>
                          {" "}
                          · {f.descripcion}
                        </span>
                      )}
                    </td>
                    <td style={{ ...tdCentro, whiteSpace: "nowrap" }}>{fechaCorta(f.entrada?.fecha) || <Raya />}</td>
                    <td style={td}>{f.entrada?.quien || <Raya />}</td>
                    <td style={{ ...tdCentro, whiteSpace: "nowrap", color: NARANJA }}>
                      {fechaCorta(f.salida?.fecha) || <Raya />}
                    </td>
                    <td style={td}>{f.salida?.quien || <Raya />}</td>
                  </tr>
                ))
              )}
            </tbody>
          </Table>
        </div>
      </Modal.Body>
    </Modal>
  );
}
