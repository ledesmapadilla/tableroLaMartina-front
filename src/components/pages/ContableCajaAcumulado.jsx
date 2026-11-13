import { Fragment, useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Container, Table } from "react-bootstrap";
import { api } from "../../services/api";
import { MESES } from "../../utils/contable";
import { traerCaja, deMemoria } from "../../utils/colaCaja";

/**
 * Contable › Caja › Acumulado (13/11/2026): el año entero, semana por semana
 * (viernes a jueves) y agrupado por mes, con el subtotal de cada mes y el
 * total del año. Van todas las semanas del año, tengan movimientos o no; las
 * de antes de que arrancara la caja y las que todavía no empezaron, en gris y
 * sin números, y no entran en los totales. Tocar una semana abre su control
 * de caja (las futuras no se abren).
 *
 * El back arma las cuentas (GET /contable/caja/anio/:anio). Permiso: contable.caja.
 */

const COLOR = "#164e63";
const PRIMER_ANIO = 2026;
const th = {
  backgroundColor: COLOR,
  color: "#fff",
  fontSize: "0.66rem",
  fontWeight: 600,
  verticalAlign: "middle",
  padding: "3px 5px",
  whiteSpace: "nowrap",
  textAlign: "center",
};
const td = { fontSize: "0.7rem", padding: "1px 5px", verticalAlign: "middle" };
const num = { ...td, textAlign: "center", whiteSpace: "nowrap" };
const subtotal = { backgroundColor: "#ecfeff", fontWeight: 700, color: COLOR };

const pesos = (n) =>
  `$ ${Number(n || 0).toLocaleString("es-AR", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
const ddmm = (s) => {
  const [, m, d] = s.split("-");
  return `${d}/${m}`;
};
const hoyIso = () => {
  const h = new Date();
  return `${h.getFullYear()}-${String(h.getMonth() + 1).padStart(2, "0")}-${String(h.getDate()).padStart(2, "0")}`;
};
const suma = (l, campo) =>
  Math.round(l.reduce((t, x) => t + (Number(x[campo]) || 0), 0) * 100) / 100;
const rojoSiNegativo = (n) => (n < 0 ? { color: "#dc2626" } : {});

function ContableCajaAcumulado() {
  const navigate = useNavigate();
  const location = useLocation();
  const ultimoAnio = new Date().getFullYear();
  const [anio, setAnio] = useState(location.state?.anio ?? ultimoAnio);

  const clave = `anio/${anio}`;
  const [cargado, setCargado] = useState({
    clave: null,
    semanas: [],
    error: "",
  });
  useEffect(() => {
    let vigente = true;
    traerCaja(clave, api)
      .then(
        (l) =>
          vigente &&
          setCargado({ clave, semanas: Array.isArray(l) ? l : [], error: "" }),
      )
      .catch(
        (err) =>
          vigente && setCargado({ clave, semanas: [], error: err.message }),
      );
    return () => {
      vigente = false;
    };
  }, [clave]);
  const listo = cargado.clave === clave;
  const todas = listo ? cargado.semanas : deMemoria(clave);

  // Todas las semanas del año; con cuenta, las que ya empezaron y desde que
  // arrancó la caja (13/11/2026: van todas aunque no hayan tenido actividad).
  const hoy = hoyIso();
  const conCuenta = (w) =>
    w.semana <= hoy && w.inicioCaja && w.semana >= w.inicioCaja;
  const semanas = (todas || []).filter(conCuenta);
  const meses = MESES.map((nombre, i) => {
    const filas = (todas || []).filter(
      (w) => Number(w.semana.slice(5, 7)) === i + 1,
    );
    return { nombre, filas, semanas: filas.filter(conCuenta) };
  }).filter((m) => m.filas.length);
  const inicioCaja = (todas || []).find((w) => w.inicioCaja)?.inicioCaja;

  // Los meses abiertos (13/11/2026): se ve el resultado de cada mes y sus
  // semanas, con el botón de la fila. Arrancan cerrados.
  const [abiertos, setAbiertos] = useState(() => new Set());
  const alternar = (nombre) =>
    setAbiertos((ant) => {
      const nuevo = new Set(ant);
      if (nuevo.has(nombre)) nuevo.delete(nombre);
      else nuevo.add(nombre);
      return nuevo;
    });

  const cambiarAnio = (a) => {
    setAnio(a);
    navigate(location.pathname, { replace: true, state: { anio: a } });
  };
  const abrirSemana = (w) => navigate(`/contable/caja/semana/${w.semana}`);

  return (
    <div
      style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        backgroundColor: "#f8f9fa",
        height: "100%",
        overflow: "auto",
      }}
    >
      <Container className="py-3" style={{ maxWidth: "900px" }}>
        {/* Encabezado: volver a Caja, el título y el año con flechas. */}
        <div className="d-flex align-items-center gap-2 mb-3 flex-wrap">
          <button
            type="button"
            onClick={() => navigate("/contable/caja")}
            className="btn btn-sm btn-outline-secondary d-flex align-items-center justify-content-center"
            style={{ width: 32, height: 32 }}
            title="Volver a Caja"
          >
            <i className="bi bi-arrow-left"></i>
          </button>
          <i
            className="bi bi-safe2-fill"
            style={{ color: "#0e7490", fontSize: "1.2rem" }}
          ></i>
          <span
            className="fw-bold"
            style={{ color: COLOR, fontSize: "1.05rem" }}
          >
            Caja · Acumulado
          </span>
          <div className="d-flex align-items-center gap-1 ms-auto">
            <button
              type="button"
              onClick={() => cambiarAnio(anio - 1)}
              disabled={anio <= PRIMER_ANIO}
              className="btn btn-sm btn-outline-secondary d-flex align-items-center justify-content-center p-0"
              style={{ width: 32, height: 32 }}
              title="Año anterior"
            >
              <i className="bi bi-chevron-left"></i>
            </button>
            <span
              className="fw-bold px-2"
              style={{
                color: COLOR,
                fontSize: "1rem",
                minWidth: 56,
                textAlign: "center",
              }}
            >
              {anio}
            </span>
            <button
              type="button"
              onClick={() => cambiarAnio(anio + 1)}
              disabled={anio >= ultimoAnio}
              className="btn btn-sm btn-outline-secondary d-flex align-items-center justify-content-center p-0"
              style={{ width: 32, height: 32 }}
              title="Año siguiente"
            >
              <i className="bi bi-chevron-right"></i>
            </button>
          </div>
        </div>

        {listo && cargado.error ? (
          <div
            className="alert alert-danger py-2"
            style={{ fontSize: "0.85rem" }}
          >
            {cargado.error}
          </div>
        ) : (
          <div
            className="shadow-sm rounded-3 bg-white"
            style={{ border: "1px solid #cbd5e1", overflowX: "auto" }}
          >
            <Table className="mb-0 tabla-informe" style={{ width: "100%" }}>
              <thead>
                <tr>
                  <th style={{ ...th, width: "150px" }}>Mes / semana</th>
                  <th style={th}>Sobrante anterior</th>
                  <th style={th}>Ingreso fijo</th>
                  <th style={th}>Entradas</th>
                  <th style={th}>Gastos</th>
                  <th style={th}>Saldo</th>
                  <th style={{ ...th, width: "70px" }}>Semanas</th>
                </tr>
              </thead>
              <tbody>
                {!todas ? (
                  <tr>
                    <td colSpan={7} className="text-center text-muted py-4" style={td}>
                      Cargando…
                    </td>
                  </tr>
                ) : (
                  meses.map((m, iMes) => {
                    const abierto = abiertos.has(m.nombre);
                    const primera = m.semanas[0];
                    const ultima = m.semanas[m.semanas.length - 1];
                    const gris = { color: "#94a3b8" };
                    // Un mes sin semanas con cuenta: antes de que arrancara la
                    // caja o todavía por venir.
                    const sinCuenta = !m.semanas.length;
                    const futuro = sinCuenta && m.filas[0].semana > hoy;
                    return (
                      <Fragment key={m.nombre}>
                        {/* El resultado del mes: con cuánto arrancó, lo que entró y
                            salió en sus semanas y con cuánto cerró. La línea negra
                            de arriba separa un mes del otro. */}
                        <tr className={iMes > 0 ? "fila-inicio-grupo" : undefined}>
                          <td style={{ ...td, ...subtotal, ...(sinCuenta ? gris : {}) }}>{m.nombre}</td>
                          {sinCuenta ? (
                            <td colSpan={5} style={{ ...num, ...subtotal, ...gris, fontStyle: "italic", fontWeight: 400 }}>
                              {futuro ? "todavía no empezó" : "caja sin empezar"}
                            </td>
                          ) : (
                            <>
                              <td style={{ ...num, ...subtotal, ...rojoSiNegativo(primera.arrastre) }}>
                                {pesos(primera.arrastre)}
                              </td>
                              <td style={{ ...num, ...subtotal }}>{pesos(suma(m.semanas, "fijo"))}</td>
                              <td style={{ ...num, ...subtotal, color: "#15803d" }}>
                                {suma(m.semanas, "entradas") ? pesos(suma(m.semanas, "entradas")) : "—"}
                              </td>
                              <td style={{ ...num, ...subtotal, color: "#dc2626" }}>
                                {suma(m.semanas, "gastos") ? pesos(suma(m.semanas, "gastos")) : "—"}
                              </td>
                              <td style={{ ...num, ...subtotal, ...rojoSiNegativo(ultima.saldo) }}>
                                {pesos(ultima.saldo)}
                              </td>
                            </>
                          )}
                          <td style={{ ...num, ...subtotal }}>
                            {/* Abre y cierra la tabla de las semanas del mes. */}
                            <button
                              type="button"
                              onClick={() => alternar(m.nombre)}
                              className="btn btn-sm d-inline-flex align-items-center gap-1 px-2 py-0"
                              style={{
                                fontSize: "0.68rem",
                                borderRadius: 8,
                                backgroundColor: abierto ? COLOR : "#fff",
                                borderColor: COLOR,
                                color: abierto ? "#fff" : COLOR,
                              }}
                              title={abierto ? "Ocultar las semanas" : "Ver las semanas del mes"}
                            >
                              <i className={`bi ${abierto ? "bi-chevron-up" : "bi-chevron-down"}`}></i>
                              {m.filas.length}
                            </button>
                          </td>
                        </tr>
                        {abierto &&
                          m.filas.map((w) => {
                            const futura = w.semana > hoy;
                            const cuenta = conCuenta(w);
                            return (
                              <tr
                                key={w.semana}
                                onClick={() => !futura && abrirSemana(w)}
                                style={{ cursor: futura ? "default" : "pointer" }}
                                title={futura ? "Todavía no empezó" : "Abrir la semana"}
                              >
                                <td style={{ ...td, paddingLeft: 18, whiteSpace: "nowrap", ...(cuenta ? {} : gris) }}>
                                  vie {ddmm(w.semana)} al jue {ddmm(w.hasta)}
                                </td>
                                {cuenta ? (
                                  <>
                                    <td style={{ ...num, ...rojoSiNegativo(w.arrastre) }}>{pesos(w.arrastre)}</td>
                                    <td style={num}>{pesos(w.fijo)}</td>
                                    <td style={{ ...num, color: "#15803d" }}>{w.entradas ? pesos(w.entradas) : "—"}</td>
                                    <td style={{ ...num, color: "#dc2626" }}>{w.gastos ? pesos(w.gastos) : "—"}</td>
                                    <td style={{ ...num, fontWeight: 600, ...rojoSiNegativo(w.saldo) }}>
                                      {pesos(w.saldo)}
                                    </td>
                                  </>
                                ) : (
                                  <td colSpan={5} style={{ ...num, ...gris, fontStyle: "italic" }}>
                                    {futura ? "todavía no empezó" : "caja sin empezar"}
                                  </td>
                                )}
                                <td style={td}></td>
                              </tr>
                            );
                          })}
                      </Fragment>
                    );
                  })
                )}
                {semanas.length > 0 && (
                  <tr className="fila-total">
                    <td style={{ ...td, fontWeight: 700, color: "#1b4332" }}>TOTAL</td>
                    <td style={{ ...num, fontWeight: 700, ...rojoSiNegativo(semanas[0].arrastre) }}>
                      {pesos(semanas[0].arrastre)}
                    </td>
                    <td style={{ ...num, fontWeight: 700 }}>{pesos(suma(semanas, "fijo"))}</td>
                    <td style={{ ...num, fontWeight: 700 }}>{pesos(suma(semanas, "entradas"))}</td>
                    <td style={{ ...num, fontWeight: 700 }}>{pesos(suma(semanas, "gastos"))}</td>
                    <td style={{ ...num, fontWeight: 700, ...rojoSiNegativo(semanas[semanas.length - 1].saldo) }}>
                      {pesos(semanas[semanas.length - 1].saldo)}
                    </td>
                    <td style={td}></td>
                  </tr>
                )}
              </tbody>
            </Table>
          </div>
        )}
        {semanas.length > 0 && (
          <div
            className="mt-2"
            style={{ fontSize: "0.72rem", color: "#64748b" }}
          >
            En cada mes y en el total, "Sobrante anterior" es con el que arrancó
            y "Saldo" con el que cerró. El botón de la derecha abre las semanas
            del mes.
            {inicioCaja &&
              inicioCaja.startsWith(String(anio)) &&
              ` La caja arrancó el vie ${ddmm(inicioCaja)}.`}
          </div>
        )}
      </Container>
    </div>
  );
}

export default ContableCajaAcumulado;
