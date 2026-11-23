import { useEffect, useMemo, useState } from "react";
import { Button, Col, Row, Spinner, Table } from "react-bootstrap";
import { useNavigate } from "react-router-dom";
import { api } from "../../../services/api";
import { COLOR, CONCEPTOS, MESES, ddmm, hoyIso, masDias, pesos, viernesDe } from "./comun";
import { SEMANA_VACIA, semanasCaja } from "../../../helpers/cajaSemanas";
import "./caja.css";

/**
 * Caja desde el celular, resumen del mes (23/11/2026): el botón "Mensual" del
 * inicio de Caja. El mes con flechas, lo que entró, lo que salió y el saldo,
 * y abajo una fila por semana (viernes a jueves). Como en Contable › Caja,
 * cada semana va en el mes de su viernes. Al tocar una semana se abre la
 * pantalla Semanal en esa semana. Solo consulta.
 *
 * Arrastre (23/11/2026, helpers/cajaSemanas.js): el saldo positivo de una
 * semana entra como entrada de la siguiente; el negativo no pasa. Por eso el
 * saldo del mes es el de su última semana, y si alguna cerró en negativo no
 * coincide con entradas − gastos.
 */

const suma = (l) => Math.round(l.reduce((t, x) => t + (Number(x) || 0), 0) * 100) / 100;

/** Los viernes de un mes ("2026-11"), igual que ContableCaja.jsx. */
const viernesDelMes = (mes) => {
  let v = viernesDe(`${mes}-01`);
  if (v < `${mes}-01`) v = masDias(v, 7);
  const lista = [];
  for (; v.startsWith(mes); v = masDias(v, 7)) lista.push(v);
  return lista;
};

export default function CajaMes() {
  const navigate = useNavigate();
  // El mes como "aaaa-mm"; arranca en el de la semana de hoy.
  const mesDeHoy = viernesDe(hoyIso()).slice(0, 7);
  const [mes, setMes] = useState(mesDeHoy);
  const [movimientos, setMovimientos] = useState(null);
  const [error, setError] = useState("");

  // El back devuelve todos los movimientos: se trae una vez y el mes se arma acá.
  useEffect(() => {
    api
      .get("/contable/caja")
      .then(setMovimientos)
      .catch((err) => {
        setMovimientos([]);
        setError(err.message);
      });
  }, []);

  const [anio, nroMes] = mes.split("-").map(Number);
  const mover = (n) => {
    const f = new Date(anio, nroMes - 1 + n, 1);
    setMes(`${f.getFullYear()}-${String(f.getMonth() + 1).padStart(2, "0")}`);
  };

  // Las semanas del mes, hasta la de hoy: las que todavía no empezaron no van.
  // La cadena de semanas con el arrastre, de toda la caja.
  const cadena = useMemo(() => semanasCaja(movimientos, hoyIso()), [movimientos]);
  const semanas = useMemo(() => {
    const hoy = hoyIso();
    return viernesDelMes(mes)
      .filter((v) => v <= hoy)
      .map((viernes) => ({ viernes, jueves: masDias(viernes, 6), ...(cadena[viernes] || SEMANA_VACIA) }));
  }, [cadena, mes]);

  // Entradas del mes: lo que vino de la semana anterior al mes más lo
  // ingresado en el mes (los arrastres de adentro no se cuentan dos veces).
  const entradas = suma([semanas[0]?.anterior, ...semanas.map((s) => s.ingresos)]);
  const gastos = suma(semanas.map((s) => s.gastos));
  const saldo = semanas.length ? semanas[semanas.length - 1].saldo : 0;
  const cantidad = semanas.reduce((t, s) => t + s.cantidad, 0);
  const raya = <span style={{ color: "#94a3b8" }}>–</span>;

  return (
    <div className="mx-auto px-3 py-3" style={{ maxWidth: "480px" }}>
      <div className="d-flex align-items-center justify-content-between mb-3">
        <h5 className="mb-0 fw-bold" style={{ color: COLOR }}>
          Caja del mes
        </h5>
        <Button size="sm" variant="outline-secondary" onClick={() => navigate("/compras/caja")}>
          Volver
        </Button>
      </div>

      {/* El mes, con flechas para ir y venir. */}
      <div className="d-flex align-items-center justify-content-between mb-2 rounded-3 px-1" style={{ border: "1px solid #cbd5e1" }}>
        <Button size="sm" variant="link" onClick={() => mover(-1)} style={{ color: COLOR }} aria-label="Mes anterior">
          <i className="bi bi-chevron-left" style={{ fontSize: "1.2rem" }}></i>
        </Button>
        <span className="fw-semibold" style={{ fontSize: "0.92rem" }}>
          {MESES[nroMes - 1]} {anio}
        </span>
        <Button size="sm" variant="link" onClick={() => mover(1)} disabled={mes >= mesDeHoy} style={{ color: COLOR }} aria-label="Mes siguiente">
          <i className="bi bi-chevron-right" style={{ fontSize: "1.2rem" }}></i>
        </Button>
      </div>

      {/* El total del mes: entradas, gastos y lo que queda. */}
      {movimientos && (
        <Row className="g-2 mb-3 text-center">
          {[
            ["Entradas", entradas, CONCEPTOS.ingreso.color],
            ["Gastos", gastos, CONCEPTOS.gasto.color],
            ["Saldo", saldo, saldo < 0 ? "#dc2626" : COLOR],
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
        // Cuatro columnas en ~360px: la semana va en dos renglones y la letra
        // un poco más chica que en el resto de la pantalla.
        <Table className="mb-0 tabla-informe w-100" style={{ fontSize: "0.78rem" }}>
          <thead>
            <tr>
              <th style={{ backgroundColor: COLOR, color: "#fff" }}>Semana</th>
              {["Entradas", "Gastos", "Saldo"].map((t) => (
                <th key={t} className="text-center" style={{ backgroundColor: COLOR, color: "#fff" }}>
                  {t}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {semanas.map((s) => {
              return (
                <tr
                  key={s.viernes}
                  role="button"
                  onClick={() => navigate(`/compras/caja/semana?semana=${s.viernes}`)}
                  style={{ cursor: "pointer" }}
                >
                  <td style={{ whiteSpace: "nowrap", lineHeight: 1.2 }}>
                    <div>{ddmm(s.viernes)} al</div>
                    <div>
                      {ddmm(s.jueves)}
                      <span className="text-muted ms-1" style={{ fontSize: "0.68rem" }}>
                        ({s.cantidad})
                      </span>
                    </div>
                  </td>
                  <td className="text-center fw-semibold" style={{ color: CONCEPTOS.ingreso.color, whiteSpace: "nowrap", lineHeight: 1.2 }}>
                    {s.entradas > 0 ? pesos(s.entradas) : raya}
                    {s.anterior > 0 && (
                      <div className="fw-normal text-muted" style={{ fontSize: "0.64rem" }}>
                        ant. {pesos(s.anterior)}
                      </div>
                    )}
                  </td>
                  <td className="text-center fw-semibold" style={{ color: CONCEPTOS.gasto.color, whiteSpace: "nowrap" }}>
                    {s.gastos > 0 ? pesos(s.gastos) : raya}
                  </td>
                  <td className="text-center fw-semibold" style={{ color: s.saldo < 0 ? "#dc2626" : COLOR, whiteSpace: "nowrap" }}>
                    {s.cantidad > 0 || s.anterior > 0 ? pesos(s.saldo) : raya}
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="fila-total fw-bold">
              <td>
                Total <span className="text-muted fw-normal" style={{ fontSize: "0.68rem" }}>({cantidad})</span>
              </td>
              <td className="text-center" style={{ color: CONCEPTOS.ingreso.color, whiteSpace: "nowrap" }}>
                {pesos(entradas)}
              </td>
              <td className="text-center" style={{ color: CONCEPTOS.gasto.color, whiteSpace: "nowrap" }}>
                {pesos(gastos)}
              </td>
              <td className="text-center" style={{ color: saldo < 0 ? "#dc2626" : COLOR, whiteSpace: "nowrap" }}>
                {pesos(saldo)}
              </td>
            </tr>
          </tfoot>
        </Table>
      )}
    </div>
  );
}
