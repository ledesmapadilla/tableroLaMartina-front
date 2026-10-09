import { useState } from "react";
import { Modal, Table } from "react-bootstrap";
import { compararCC } from "../../utils/ordenCC";
import { th as thBase, td, tdCentro } from "../compras/formato";
import { Raya } from "../compras/estilos";
import { textoFrente } from "../../utils/frentes";

// El slate de Mantenimiento.
const COLOR = "#1e293b";
const COLOR_SUAVE = "#f1f5f9";
const NARANJA = "#c2410c";
const ROJO = "#dc2626";
const VERDE = "#15803d";
const th = { ...thBase, backgroundColor: COLOR };
const thCentro = { ...th, textAlign: "center" };

const SIN_CARRO = "sin-carro";
const SIN_ENCARGADO = "sin-encargado";

// Las solapas (09/10/2026): por carro, como era, y por encargado.
const SOLAPAS = [
  ["carro", "Por carro", "bi-truck"],
  ["encargado", "Por encargado", "bi-person-fill"],
];

/**
 * Control con el año pasado (08/10/2026): las escaleras que salieron en los
 * retiros de la cosecha anterior y las que entraron en los ingresos de esta.
 * La diferencia es lo que falta volver (en rojo) o lo que vino de más.
 *
 * Dos solapas: por carro (los ingresos S/N van juntos en una fila al final) y
 * por encargado (09/10/2026; los movimientos sin encargado, al final). Las
 * nuevas y las bajas no entran: no son de ningún carro.
 */
export default function ControlAnioPasado({ show, onHide, cosecha, cosechaAnterior, anterior, ingresos }) {
  const [solapa, setSolapa] = useState("carro");

  // Agrupa los retiros del año pasado y los ingresos de este por la clave de
  // la solapa. `nueva` arma la fila la primera vez que aparece una clave.
  const agrupar = (claveDe, nueva) => {
    const grupos = new Map();
    const filaDe = (i) => {
      const clave = claveDe(i);
      if (!grupos.has(clave)) grupos.set(clave, { clave, ...nueva(i), salieron: 0, ingresaron: 0, frentes: new Set() });
      return grupos.get(clave);
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
    return [...grupos.values()];
  };

  const filas =
    solapa === "carro"
      ? agrupar(
          (i) => i.cc?._id || SIN_CARRO,
          (i) => ({ cc: i.cc?.cc || "", descripcion: i.cc?.descripcion || "" })
        ).sort((a, b) => {
          if (a.clave === SIN_CARRO || b.clave === SIN_CARRO) return (a.clave === SIN_CARRO) - (b.clave === SIN_CARRO);
          return compararCC(a.cc, b.cc);
        })
      : agrupar(
          (i) => i.encargado || SIN_ENCARGADO,
          () => ({})
        ).sort((a, b) => {
          if (a.clave === SIN_ENCARGADO || b.clave === SIN_ENCARGADO)
            return (a.clave === SIN_ENCARGADO) - (b.clave === SIN_ENCARGADO);
          return a.clave.localeCompare(b.clave, "es");
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

  const primeraCelda = (f) =>
    solapa === "carro" ? (
      <td style={{ ...td, fontWeight: 700, whiteSpace: "nowrap" }}>
        {f.clave === SIN_CARRO ? "S/N" : f.cc || <Raya />}
        {f.descripcion && (
          <span className="text-muted fw-normal" style={{ fontSize: "0.66rem" }}>
            {" "}
            · {f.descripcion}
          </span>
        )}
      </td>
    ) : (
      <td style={{ ...td, fontWeight: 700, whiteSpace: "nowrap" }}>
        {f.clave === SIN_ENCARGADO ? <span className="text-muted fw-normal">Sin encargado</span> : f.clave}
      </td>
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
        {/* Las solapas, pegadas arriba de la tabla, como en Escaleras. */}
        <div className="d-flex align-items-end gap-1" style={{ marginBottom: "-1px", position: "relative" }}>
          {SOLAPAS.map(([clave, rotulo, icono]) => {
            const activa = solapa === clave;
            return (
              <button
                key={clave}
                type="button"
                onClick={() => setSolapa(clave)}
                className="d-flex align-items-center gap-2 px-3 py-1 fw-semibold"
                style={{
                  fontSize: "0.8rem",
                  border: "1px solid #cbd5e1",
                  borderBottom: activa ? `1px solid ${COLOR}` : "1px solid #cbd5e1",
                  borderTopLeftRadius: "0.5rem",
                  borderTopRightRadius: "0.5rem",
                  backgroundColor: activa ? COLOR : "#fff",
                  color: activa ? "#fff" : "#475569",
                  cursor: "pointer",
                }}
              >
                <i className={`bi ${icono}`}></i>
                <span>{rotulo}</span>
              </button>
            );
          })}
        </div>
        <div className="rounded-3 bg-white" style={{ border: "1px solid #cbd5e1", borderTopLeftRadius: 0, overflowX: "auto" }}>
          <Table className="mb-0 tabla-informe" style={{ width: "100%" }}>
            <thead>
              <tr>
                <th style={th}>{solapa === "carro" ? "Carro" : "Encargado"}</th>
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
                  <tr key={f.clave} style={f.clave === SIN_ENCARGADO ? { backgroundColor: COLOR_SUAVE } : undefined}>
                    {primeraCelda(f)}
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
          {solapa === "encargado" && " Por encargado: el de cada retiro y el de cada ingreso."}
        </div>
      </Modal.Body>
    </Modal>
  );
}
