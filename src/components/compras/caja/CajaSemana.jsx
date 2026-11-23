import { useEffect, useMemo, useState } from "react";
import { Button, Card, Col, Modal, Row, Spinner, Table } from "react-bootstrap";
import { useNavigate } from "react-router-dom";
import { api } from "../../../services/api";
import { COLOR, CONCEPTOS, DIAS_SEMANA, MESES, aFecha, ddmm, hoyIso, masDias, pesos, viernesDe } from "./comun";
import "./caja.css";

/**
 * Caja desde el celular (13/11/2026): la semana, para consultar. Copiada de
 * CargasDelMes del Sistema de Gestión Lepa, pero por semana de viernes a
 * jueves, como la Caja de Contable: una tarjeta por día con lo que entró y
 * salió; al tocar el día se abre el detalle de cada movimiento. Arriba, la
 * semana con flechas y su total. Editar y borrar siguen en Contable › Caja.
 */

const suma = (l) => Math.round(l.reduce((t, x) => t + (Number(x.monto) || 0), 0) * 100) / 100;

export default function CajaMes() {
  const navigate = useNavigate();
  // El viernes que abre la semana elegida; arranca en la de hoy.
  const [semana, setSemana] = useState(() => viernesDe(hoyIso()));
  const [movimientos, setMovimientos] = useState(null);
  const [error, setError] = useState("");
  // El día abierto en el detalle, o null.
  const [diaAbierto, setDiaAbierto] = useState(null);

  // El back devuelve todos los movimientos: se trae una vez y la semana se arma acá.
  useEffect(() => {
    api
      .get("/contable/caja")
      .then(setMovimientos)
      .catch((err) => {
        setMovimientos([]);
        setError(err.message);
      });
  }, []);

  const jueves = masDias(semana, 6);
  const esLaDeHoy = semana === viernesDe(hoyIso());

  const dias = useMemo(() => {
    const porFecha = {};
    (movimientos || []).forEach((m) => {
      if (m.fecha >= semana && m.fecha <= jueves) (porFecha[m.fecha] ||= []).push(m);
    });
    return Array.from({ length: 7 }, (_, i) => {
      const fecha = masDias(semana, i);
      const f = aFecha(fecha);
      const lista = (porFecha[fecha] || []).sort((a, b) => String(a.createdAt || "").localeCompare(String(b.createdAt || "")));
      return {
        fecha,
        dia: f.getDate(),
        mes: f.getMonth(),
        diaSemana: DIAS_SEMANA[f.getDay()],
        movimientos: lista,
        entradas: suma(lista.filter((m) => m.concepto === "ingreso")),
        gastos: suma(lista.filter((m) => m.concepto === "gasto")),
      };
    });
  }, [movimientos, semana, jueves]);

  const entradas = suma(dias.map((d) => ({ monto: d.entradas })));
  const gastos = suma(dias.map((d) => ({ monto: d.gastos })));

  const mover = (n) => {
    setSemana((s) => masDias(s, 7 * n));
    setDiaAbierto(null);
  };

  return (
    <div className="mx-auto px-3 py-3" style={{ maxWidth: "480px" }}>
      <div className="d-flex align-items-center justify-content-between mb-3">
        <h5 className="mb-0 fw-bold" style={{ color: COLOR }}>
          Caja de la semana
        </h5>
        <Button size="sm" variant="outline-secondary" onClick={() => navigate("/compras/caja")}>
          Volver
        </Button>
      </div>

      {/* La semana, de viernes a jueves, con flechas para ir y venir. */}
      <div className="d-flex align-items-center justify-content-between mb-2 rounded-3 px-1" style={{ border: "1px solid #cbd5e1" }}>
        <Button size="sm" variant="link" onClick={() => mover(-1)} style={{ color: COLOR }} aria-label="Semana anterior">
          <i className="bi bi-chevron-left" style={{ fontSize: "1.2rem" }}></i>
        </Button>
        <span className="fw-semibold" style={{ fontSize: "0.92rem" }}>
          vie {ddmm(semana)} al jue {ddmm(jueves)}
        </span>
        <Button
          size="sm"
          variant="link"
          onClick={() => mover(1)}
          disabled={esLaDeHoy}
          style={{ color: COLOR }}
          aria-label="Semana siguiente"
        >
          <i className="bi bi-chevron-right" style={{ fontSize: "1.2rem" }}></i>
        </Button>
      </div>

      {/* El total de la semana: entradas, gastos y lo que queda. */}
      {movimientos && (
        <Row className="g-2 mb-3 text-center">
          {[
            ["Entradas", entradas, CONCEPTOS.ingreso.color],
            ["Gastos", gastos, CONCEPTOS.gasto.color],
            ["Saldo", entradas - gastos, entradas - gastos < 0 ? "#dc2626" : COLOR],
          ].map(([titulo, valor, color]) => (
            <Col xs={4} key={titulo}>
              <div className="rounded-3 py-1 px-1 h-100" style={{ border: "1px solid #cbd5e1" }}>
                <div style={{ fontSize: "0.68rem", color: "#64748b", fontWeight: 600 }}>{titulo}</div>
                <div className="fw-bold" style={{ fontSize: "0.85rem", color, overflowWrap: "anywhere" }}>
                  {pesos(valor)}
                </div>
              </div>
            </Col>
          ))}
        </Row>
      )}

      {error && <div className="text-danger text-center mb-3">{error}</div>}

      {movimientos === null ? (
        <div className="text-center py-5">
          <Spinner animation="border" style={{ color: COLOR }} />
        </div>
      ) : (
        <Row className="g-2">
          {dias.map((d) => {
            const hubo = d.movimientos.length > 0;
            return (
              <Col xs={6} key={d.fecha}>
                {/* Los días sin movimientos no se tocan: no hay detalle. */}
                <Card
                  role={hubo ? "button" : undefined}
                  onClick={hubo ? () => setDiaAbierto(d) : undefined}
                  className="h-100"
                  style={{
                    cursor: hubo ? "pointer" : undefined,
                    backgroundColor: hubo ? "rgba(22, 78, 99, 0.10)" : "#f8f9fa",
                    borderColor: hubo ? "rgba(22, 78, 99, 0.35)" : "#dee2e6",
                  }}
                >
                  <Card.Body className="px-2 py-2" style={{ minHeight: "78px" }}>
                    <div className="text-muted text-uppercase mb-1" style={{ fontSize: "0.75rem" }}>
                      {d.diaSemana} {d.dia}
                    </div>
                    {hubo ? (
                      <>
                        {d.entradas > 0 && (
                          <div className="fw-semibold" style={{ fontSize: "0.92rem", color: CONCEPTOS.ingreso.color }}>
                            + {pesos(d.entradas)}
                          </div>
                        )}
                        {d.gastos > 0 && (
                          <div className="fw-semibold" style={{ fontSize: "0.92rem", color: CONCEPTOS.gasto.color }}>
                            − {pesos(d.gastos)}
                          </div>
                        )}
                      </>
                    ) : (
                      <div className="fst-italic text-body-tertiary" style={{ fontSize: "0.9rem", opacity: 0.7 }}>
                        Sin movimientos
                      </div>
                    )}
                  </Card.Body>
                </Card>
              </Col>
            );
          })}
        </Row>
      )}

      <Modal show={diaAbierto !== null} onHide={() => setDiaAbierto(null)} centered>
        <Modal.Header closeButton>
          <Modal.Title style={{ fontSize: "1.1rem" }}>
            {diaAbierto ? `${diaAbierto.diaSemana} ${diaAbierto.dia} de ${MESES[diaAbierto.mes]}` : ""}
          </Modal.Title>
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
              {(diaAbierto?.movimientos || []).map((m) => {
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
                  {diaAbierto ? pesos(diaAbierto.entradas - diaAbierto.gastos) : ""}
                </td>
              </tr>
            </tfoot>
          </Table>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="outline-secondary" onClick={() => setDiaAbierto(null)}>
            Cerrar
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
}
