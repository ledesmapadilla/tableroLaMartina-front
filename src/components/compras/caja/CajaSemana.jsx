import { useEffect, useMemo, useState } from "react";
import { Button, Card, Col, Row, Spinner } from "react-bootstrap";
import { useNavigate, useSearchParams } from "react-router-dom";
import { api } from "../../../services/api";
import { COLOR, CONCEPTOS, DIAS_SEMANA, aFecha, ddmm, hoyIso, masDias, pesos, viernesDe } from "./comun";
import DetalleDia from "./DetalleDia";
import "./caja.css";

/**
 * Caja desde el celular (13/11/2026): la semana, para consultar. Copiada de
 * CargasDelMes del Sistema de Gestión Lepa, pero por semana de viernes a
 * jueves, como la Caja de Contable: una tarjeta por día con lo que entró y
 * salió; al tocar el día se abre el detalle de cada movimiento. Arriba, la
 * semana con flechas y su total. Editar y borrar siguen en Contable › Caja.
 * Desde el 23/11/2026 es "Semanal" (/compras/caja/semana); el mes va en CajaMes.
 */

const suma = (l) => Math.round(l.reduce((t, x) => t + (Number(x.monto) || 0), 0) * 100) / 100;

export default function CajaSemana() {
  const navigate = useNavigate();
  // Desde el resumen del mes llega con ?semana=<viernes> (23/11/2026); y
  // Volver regresa al mes.
  const [params] = useSearchParams();
  const pedida = params.get("semana");
  const desdeMes = /^\d{4}-\d{2}-\d{2}$/.test(pedida || "");
  // El viernes que abre la semana elegida; arranca en la pedida o en la de hoy.
  const [semana, setSemana] = useState(() => viernesDe(desdeMes ? pedida : hoyIso()));
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
        <Button size="sm" variant="outline-secondary" onClick={() => navigate(desdeMes ? "/compras/caja/mes" : "/compras/caja")}>
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

      <DetalleDia dia={diaAbierto} onHide={() => setDiaAbierto(null)} />
    </div>
  );
}
