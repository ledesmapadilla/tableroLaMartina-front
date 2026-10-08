import { Modal, Table } from "react-bootstrap";
import { compararCC } from "../../utils/ordenCC";
import { th as thBase, td, tdCentro } from "../compras/formato";
import { Raya } from "../compras/estilos";
import { textoFrente } from "../../utils/frentes";

// El slate de Mantenimiento.
const COLOR = "#1e293b";
const NARANJA = "#c2410c";
const ROJO = "#dc2626";
const VERDE = "#15803d";
const th = { ...thBase, backgroundColor: COLOR };
const thCentro = { ...th, textAlign: "center" };

const SIN_CARRO = "sin-carro";

/**
 * Control con el año pasado (08/10/2026): por carro, las escaleras que salieron
 * en los retiros de la cosecha anterior y las que entraron en los ingresos de
 * esta. La diferencia es lo que falta volver (en rojo) o lo que vino de más.
 *
 * Los ingresos S/N van juntos en una fila al final. Las nuevas y las bajas no
 * entran: no son de ningún carro.
 */
export default function ControlAnioPasado({ show, onHide, cosecha, cosechaAnterior, anterior, ingresos }) {
  const porCarro = new Map();
  const filaDe = (i) => {
    const clave = i.cc?._id || SIN_CARRO;
    if (!porCarro.has(clave)) {
      porCarro.set(clave, {
        clave,
        cc: i.cc?.cc || "",
        descripcion: i.cc?.descripcion || "",
        salieron: 0,
        ingresaron: 0,
        frentes: new Set(),
      });
    }
    return porCarro.get(clave);
  };
  for (const i of anterior) {
    if (!i.retiro) continue;
    const fila = filaDe(i);
    fila.salieron += i.cantidadEscaleras || 0;
    if (textoFrente(i.frente)) fila.frentes.add(textoFrente(i.frente));
  }
  for (const i of ingresos) {
    if (i.retiro || i.baja || i.nuevas) continue;
    const fila = filaDe(i);
    fila.ingresaron += i.cantidadEscaleras || 0;
    if (textoFrente(i.frente)) fila.frentes.add(textoFrente(i.frente));
  }
  const filas = [...porCarro.values()].sort((a, b) => {
    if (a.clave === SIN_CARRO || b.clave === SIN_CARRO) return (a.clave === SIN_CARRO) - (b.clave === SIN_CARRO);
    return compararCC(a.cc, b.cc);
  });
  const total = (campo) => filas.reduce((t, f) => t + f[campo], 0);
  const salieron = total("salieron");
  const ingresaron = total("ingresaron");

  // Negativa: faltan volver. Positiva: vinieron de más.
  const diferencia = (n) =>
    n === 0 ? (
      <span style={{ color: VERDE }}>0</span>
    ) : (
      <span style={{ color: n < 0 ? ROJO : VERDE }}>{n > 0 ? `+${n}` : n}</span>
    );

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
          <i className="bi bi-arrow-left-right"></i>
          <span>
            Control con año pasado · Salieron {cosechaAnterior} / Ingresaron {cosecha}
          </span>
        </Modal.Title>
      </Modal.Header>
      <Modal.Body className="p-3">
        <div className="rounded-3 bg-white" style={{ border: "1px solid #cbd5e1", overflowX: "auto" }}>
          <Table className="mb-0 tabla-informe" style={{ width: "100%" }}>
            <thead>
              <tr>
                <th style={th}>Carro</th>
                <th style={th}>Frente</th>
                <th style={thCentro}>Salieron {cosechaAnterior}</th>
                <th style={thCentro}>Ingresaron {cosecha}</th>
                <th style={thCentro}>Diferencia</th>
              </tr>
            </thead>
            <tbody>
              {filas.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-center text-muted py-3" style={td}>
                    No hay movimientos todavía
                  </td>
                </tr>
              ) : (
                filas.map((f) => (
                  <tr key={f.clave}>
                    <td style={{ ...td, fontWeight: 700, whiteSpace: "nowrap" }}>
                      {f.clave === SIN_CARRO ? "S/N" : f.cc || <Raya />}
                      {f.descripcion && (
                        <span className="text-muted fw-normal" style={{ fontSize: "0.66rem" }}>
                          {" "}
                          · {f.descripcion}
                        </span>
                      )}
                    </td>
                    <td style={td}>{[...f.frentes].join(" · ") || <Raya />}</td>
                    <td style={{ ...tdCentro, color: NARANJA }}>{f.salieron || <Raya />}</td>
                    <td style={{ ...tdCentro, color: COLOR }}>{f.ingresaron || <Raya />}</td>
                    <td style={{ ...tdCentro, fontWeight: 700 }}>{diferencia(f.ingresaron - f.salieron)}</td>
                  </tr>
                ))
              )}
              {filas.length > 0 && (
                <tr className="fila-total">
                  <td colSpan={2} style={{ ...td, fontWeight: 700, color: COLOR }}>
                    TOTAL
                  </td>
                  <td style={{ ...tdCentro, fontWeight: 700 }}>{salieron}</td>
                  <td style={{ ...tdCentro, fontWeight: 700 }}>{ingresaron}</td>
                  <td style={{ ...tdCentro, fontWeight: 700 }}>{diferencia(ingresaron - salieron)}</td>
                </tr>
              )}
            </tbody>
          </Table>
        </div>
        <div className="mt-2 text-muted" style={{ fontSize: "0.7rem" }}>
          Diferencia en rojo: escaleras que salieron y todavía no volvieron. No cuentan las nuevas ni las bajas.
        </div>
      </Modal.Body>
    </Modal>
  );
}
