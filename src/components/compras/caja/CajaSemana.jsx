import { useEffect, useMemo, useState } from "react";
import { Button, Card, Col, Row, Spinner } from "react-bootstrap";
import { useNavigate, useSearchParams } from "react-router-dom";
import Swal from "sweetalert2";
import { api } from "../../../services/api";
import { borrarArchivo } from "../../../services/archivos";
import { usePermisos } from "../../../context/permisos";
import { COLOR, CONCEPTOS, DIAS_SEMANA, aFecha, ddmm, hoyIso, masDias, pesos, viernesDe, montoRecuadro } from "./comun";
import DetalleDia from "./DetalleDia";
import HistorialSemana from "./HistorialSemana";
import { SEMANA_VACIA, semanasCaja } from "../../../helpers/cajaSemanas";
import "./caja.css";

/**
 * Caja desde el celular (13/11/2026): la semana, para consultar. Copiada de
 * CargasDelMes del Sistema de Gestión Lepa, pero por semana de viernes a
 * jueves, como la Caja de Contable: una tarjeta por día con lo que entró y
 * salió; al tocar el día se abre el detalle de cada movimiento. Arriba, la
 * semana con flechas y su total. Editar y borrar siguen en Contable › Caja.
 * Desde el 23/11/2026 es "Semanal"; el mes va en CajaMes.
 * Ese mismo día: el saldo de la semana anterior pasa a esta, positivo como
 * entrada y negativo como gasto (helpers/cajaSemanas.js).
 * Desde el 23/11/2026 también es la entrada de Caja (/compras/caja, la página
 * con la tarjeta "Nueva carga" se borró): cada día abre su detalle y, desde
 * ahí, "Nueva carga" lleva al alta con ese día ya puesto.
 */

const suma = (l) => Math.round(l.reduce((t, x) => t + (Number(x.monto) || 0), 0) * 100) / 100;

export default function CajaSemana() {
  const navigate = useNavigate();
  const { puede } = usePermisos();
  const sinEditar = !puede("compras.caja", "editar");
  // ?semana=<día> abre esa semana (23/11/2026): llega así desde el resumen
  // del mes (con &desde=mes, y entonces Volver regresa al mes) y al terminar
  // una carga.
  const [params] = useSearchParams();
  const pedida = params.get("semana");
  const valida = /^\d{4}-\d{2}-\d{2}$/.test(pedida || "");
  const desdeMes = params.get("desde") === "mes";
  // El viernes que abre la semana elegida; arranca en la pedida o en la de hoy.
  const [semana, setSemana] = useState(() => viernesDe(valida ? pedida : hoyIso()));
  const [movimientos, setMovimientos] = useState(null);
  const [error, setError] = useState("");
  // El día abierto en el detalle, o null.
  // La fecha del día abierto: el detalle se arma de los movimientos, así al
  // borrar uno se actualiza solo.
  const [fechaAbierta, setFechaAbierta] = useState(null);
  // El historial de Entradas o de Gastos de la semana (23/11/2026): "ingreso", "gasto" o null.
  const [historial, setHistorial] = useState(null);

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

  const diaAbierto = dias.find((d) => d.fecha === fechaAbierta) || null;

  // Editar y borrar desde el celular (23/11/2026). Editar abre la pantalla de
  // carga con el movimiento; al volver, la semana se trae de nuevo.
  const editar = (m) => navigate(`/compras/caja/nuevo?editar=${m._id}&fecha=${m.fecha}`);
  const borrar = async (m) => {
    const c = CONCEPTOS[m.concepto] || CONCEPTOS.gasto;
    const { isConfirmed } = await Swal.fire({
      icon: "warning",
      title: `¿Borrar el ${c.texto.toLowerCase()}?`,
      text: `${ddmm(m.fecha)} · ${pesos(m.monto)}${m.descripcion ? ` · ${m.descripcion}` : ""}. Esta acción no se puede deshacer.`,
      width: "320px",
      showCancelButton: true,
      confirmButtonText: "Sí, borrar",
      cancelButtonText: "Cancelar",
      confirmButtonColor: "#dc2626",
      cancelButtonColor: "#64748b",
    });
    if (!isConfirmed) return;
    try {
      await api.delete(`/contable/caja/${m._id}`);
      // Los adjuntos los borra la pantalla (caja.controller.js).
      (m.archivos || []).forEach((a) => borrarArchivo(a));
      setMovimientos((l) => (l || []).filter((x) => x._id !== m._id));
      Swal.fire({ icon: "success", title: "Borrado", timer: 1400, showConfirmButton: false, width: "300px" });
    } catch (err) {
      Swal.fire({ icon: "error", title: "No se pudo borrar", text: err.message, width: "300px" });
    }
  };

  // Los totales salen de la cadena de semanas, con lo que viene de la anterior.
  const cadena = useMemo(() => semanasCaja(movimientos, hoyIso()), [movimientos]);
  const { anterior, entradas, gastos, saldo } = cadena[semana] || SEMANA_VACIA;

  const mover = (n) => {
    setSemana((s) => masDias(s, 7 * n));
    setFechaAbierta(null);
    setHistorial(null);
  };

  return (
    <div className="mx-auto px-3 py-3" style={{ maxWidth: "480px" }}>
      <div className="d-flex align-items-center justify-content-between mb-3">
        <h5 className="mb-0 fw-bold" style={{ color: COLOR }}>
          Caja de la semana
        </h5>
        <div className="d-flex gap-2">
          <Button
            size="sm"
            className="rounded-4"
            style={{ backgroundColor: "rgba(22, 78, 99, 0.12)", borderColor: COLOR, color: COLOR, fontWeight: 600 }}
            onClick={() => navigate("/compras/caja/mes")}
          >
            Mensual
          </Button>
          <Button size="sm" variant="outline-secondary" onClick={() => navigate(desdeMes ? "/compras/caja/mes" : "/compras")}>
            Volver
          </Button>
        </div>
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
            ["Entradas", entradas, CONCEPTOS.ingreso.color, "ingreso"],
            ["Gastos", gastos, CONCEPTOS.gasto.color, "gasto"],
            ["Saldo", saldo, saldo < 0 ? "#dc2626" : COLOR, null],
          ].map(([titulo, valor, color, concepto]) => {
            // Un renglón siempre: con números grandes, letra más chica y el $ al título.
            const m = montoRecuadro(valor, titulo === "Saldo" ? 0.98 : 0.85);
            return (
            <Col xs={4} key={titulo}>
              {/* El saldo, destacado (23/11/2026): relleno con su color y letra blanca. */}
              {/* Entradas y Gastos se tocan: abren su historial de la semana. */}
              <div
                role={concepto ? "button" : undefined}
                onClick={concepto ? () => setHistorial(concepto) : undefined}
                className="rounded-3 py-1 px-1 h-100"
                style={
                  titulo === "Saldo"
                    ? { border: `1px solid ${color}`, backgroundColor: color, boxShadow: "0 2px 6px rgba(0,0,0,0.18)" }
                    : { border: `1px solid ${color}`, cursor: "pointer", backgroundColor: "#fff" }
                }
              >
                <div style={{ fontSize: "0.68rem", color: titulo === "Saldo" ? "rgba(255,255,255,0.85)" : "#64748b", fontWeight: 600 }}>
                  {titulo}
                  {m.grande && " $"}
                  {concepto && <i className="bi bi-chevron-right ms-1" style={{ fontSize: "0.6rem" }}></i>}
                </div>
                <div
                  className="fw-bold"
                  style={{
                    fontSize: m.tam,
                    color: titulo === "Saldo" ? "#fff" : color,
                    whiteSpace: "nowrap",
                  }}
                >
                  {m.texto}
                </div>
                {((titulo === "Entradas" && anterior > 0) || (titulo === "Gastos" && anterior < 0)) && (
                  <div className="text-muted" style={{ fontSize: "0.64rem" }}>
                    ant. {pesos(Math.abs(anterior))}
                  </div>
                )}
              </div>
            </Col>
            );
          })}
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
            // Todos los días hasta hoy se tocan, aunque estén vacíos: desde el
            // detalle se carga. Los que todavía no llegaron, no.
            const tocable = d.fecha <= hoyIso();
            return (
              <Col xs={6} key={d.fecha}>
                <Card
                  role={tocable ? "button" : undefined}
                  onClick={tocable ? () => setFechaAbierta(d.fecha) : undefined}
                  className="h-100"
                  style={{
                    cursor: tocable ? "pointer" : undefined,
                    opacity: tocable ? 1 : 0.55,
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

      <HistorialSemana
        concepto={historial}
        semana={semana}
        jueves={jueves}
        movimientos={movimientos}
        anterior={anterior}
        total={historial === "gasto" ? gastos : entradas}
        onHide={() => setHistorial(null)}
        sinEditar={sinEditar}
        onEditar={editar}
        onBorrar={borrar}
      />
      <DetalleDia
        dia={diaAbierto}
        onHide={() => setFechaAbierta(null)}
        sinEditar={sinEditar}
        onEditar={editar}
        onBorrar={borrar}
        onNueva={(fecha) => navigate(`/compras/caja/nuevo?fecha=${fecha}`)}
      />
    </div>
  );
}
