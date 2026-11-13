import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Container, Form } from "react-bootstrap";
import { MESES } from "../../utils/contable";
import { api } from "../../services/api";
import { traerCaja, deMemoria, semanasLocales } from "../../utils/colaCaja";

/**
 * Caja (13/11/2026): la página que abre la tarjeta Caja de Contable. Copia el
 * formato de Personal › Asistencia del Sistema de Gestión Lepa: año y mes
 * arriba (con flechas) y las semanas del mes. Sin "Gastos semanal".
 *
 * La semana de la caja va de viernes a jueves: una tarjeta por semana, en
 * el mes de su viernes (así ninguna sale en dos meses), con su saldo. Abre el
 * control de caja de esa semana (ContableCajaSemana.jsx). La de hoy va en
 * amarillo y las que todavía no empezaron, apagadas.
 * Acceso: permiso contable.caja (Altas › Usuarios › Roles).
 */

const PRIMER_ANIO = 2026;

/** "2026-11-05" → "05/11" */
const ddmm = (s) => {
  const [, m, d] = s.split("-");
  return `${d}/${m}`;
};
const pesos = (n) =>
  `$ ${Number(n || 0).toLocaleString("es-AR", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
const hoyIso = () => {
  const h = new Date();
  return `${h.getFullYear()}-${String(h.getMonth() + 1).padStart(2, "0")}-${String(h.getDate()).padStart(2, "0")}`;
};

function ContableCaja() {
  const hoy = new Date();
  const navigate = useNavigate();
  const location = useLocation();
  // Al volver (botón atrás) se abre en el mes que se estaba mirando.
  const [anio, setAnio] = useState(location.state?.anio ?? hoy.getFullYear());
  const [mes, setMes] = useState(location.state?.mes ?? hoy.getMonth());
  const anios = Array.from({ length: 10 }, (_, i) => PRIMER_ANIO + i);

  // Además de cambiar el mes, lo deja en el historial para el botón atrás.
  const cambiarMes = (nuevoAnio, nuevoMes) => {
    setAnio(nuevoAnio);
    setMes(nuevoMes);
    navigate(location.pathname, {
      replace: true,
      state: { anio: nuevoAnio, mes: nuevoMes },
    });
  };

  // Las flechas del mes: -1 el anterior, 1 el siguiente, dentro de los años del selector.
  const ultimoAnio = anios[anios.length - 1];
  const hayAnterior = anio > PRIMER_ANIO || mes > 0;
  const haySiguiente = anio < ultimoAnio || mes < 11;
  const moverMes = (paso) => {
    const total = anio * 12 + mes + paso;
    const nuevoAnio = Math.floor(total / 12);
    if (nuevoAnio < PRIMER_ANIO || nuevoAnio > ultimoAnio) return;
    cambiarMes(nuevoAnio, total % 12);
  };

  // Las semanas del mes con su cuenta (el back: GET /contable/caja/mes).
  // Se guardan con la clave del mes: lo de otro mes no se muestra mientras llega.
  // Mientras tanto van las de la última vez (utils/colaCaja.js) o, si no hay,
  // las tarjetas sin la cuenta: la página aparece al instante (13/11/2026).
  const clave = `mes/${anio}/${mes + 1}`;
  const [cargado, setCargado] = useState({
    clave: null,
    semanas: [],
    error: "",
  });
  useEffect(() => {
    let vigente = true;
    // Después de lo que se esté guardando desde una semana.
    traerCaja(clave, api)
      .then((l) => {
        if (!vigente) return;
        const semanas = Array.isArray(l) ? l : [];
        setCargado({ clave, semanas, error: "" });
        // Lo que se abre después ya queda listo: el código de la semana y
        // las semanas que ya empezaron, por detrás.
        import("./ContableCajaSemana").catch(() => {});
        const hoy = hoyIso();
        semanas
          .filter((w) => w.semana <= hoy)
          .forEach((w) => traerCaja(`semana/${w.semana}`, api).catch(() => {}));
      })
      .catch(
        (err) =>
          vigente && setCargado({ clave, semanas: [], error: err.message }),
      );
    return () => {
      vigente = false;
    };
  }, [anio, mes, clave]);
  const listo = cargado.clave === clave;
  const semanas = listo ? cargado.semanas : deMemoria(clave) || semanasLocales(anio, mes + 1);
  const hoyTexto = hoyIso();

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
      <Container className="py-3 d-flex flex-column flex-grow-1" style={{ maxWidth: "900px" }}>
        {/* Encabezado. El volver está en el navbar de Contable, arriba. */}
        <div className="d-flex align-items-center gap-2 mb-3">
          <div
            className="rounded-3 d-flex align-items-center justify-content-center"
            style={{
              width: "34px",
              height: "34px",
              backgroundColor: "#0e7490",
              color: "#fff",
              fontSize: "1.1rem",
            }}
          >
            <i className="bi bi-safe2-fill"></i>
          </div>
          <span
            className="fw-bold"
            style={{ color: "#164e63", fontSize: "1.05rem" }}
          >
            Caja
          </span>
        </div>

        {/* Selectores */}
        <div className="d-flex align-items-center gap-3 mb-4">
          <Form.Select
            value={anio}
            onChange={(e) => cambiarMes(Number(e.target.value), mes)}
            style={{ width: 100 }}
          >
            {anios.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </Form.Select>
          {/* El mes con flechas para el anterior y el siguiente (13/11/2026):
              pasan de año en enero y diciembre. */}
          <div className="d-flex align-items-center gap-1">
            <button
              type="button"
              onClick={() => moverMes(-1)}
              disabled={!hayAnterior}
              className="btn btn-sm btn-outline-secondary d-flex align-items-center justify-content-center p-0"
              style={{ width: 32, height: 32 }}
              title="Mes anterior"
            >
              <i className="bi bi-chevron-left"></i>
            </button>
            <Form.Select
              value={mes}
              onChange={(e) => cambiarMes(anio, Number(e.target.value))}
              style={{ width: 140 }}
            >
              {MESES.map((nombre, i) => (
                <option key={i} value={i}>
                  {nombre}
                </option>
              ))}
            </Form.Select>
            <button
              type="button"
              onClick={() => moverMes(1)}
              disabled={!haySiguiente}
              className="btn btn-sm btn-outline-secondary d-flex align-items-center justify-content-center p-0"
              style={{ width: 32, height: 32 }}
              title="Mes siguiente"
            >
              <i className="bi bi-chevron-right"></i>
            </button>
          </div>
          {/* Acumulado (13/11/2026): el año por mes y semana, del año que se mira. */}
          <button
            type="button"
            className="btn btn-sm d-flex align-items-center gap-2 px-3 fw-semibold rounded-3 ms-auto"
            style={{ backgroundColor: "#0e7490", borderColor: "#0e7490", color: "#fff", fontSize: "0.78rem", height: "32px" }}
            onClick={() => navigate("/contable/caja/acumulado", { state: { anio } })}
            title={`Acumulado de ${anio}, por mes y semana`}
          >
            <i className="bi bi-calendar3"></i>
            Acumulado {anio}
          </button>
        </div>

        {listo && cargado.error && (
          <div
            className="alert alert-danger py-2"
            style={{ fontSize: "0.85rem" }}
          >
            {cargado.error}
          </div>
        )}

        {/* Una tarjeta por semana (viernes a jueves), con el formato de las
            de Asistencia: gris las pasadas, amarilla la de hoy, apagadas las
            que no empezaron. */}
        <div
          style={{
            // Centradas en la página, a lo ancho y a lo alto del espacio que
            // queda abajo de los selectores (13/11/2026).
            display: "flex",
            flexWrap: "wrap",
            justifyContent: "center",
            alignContent: "center",
            flex: "1 1 auto",
            paddingBottom: "8vh",
            gap: 12,
          }}
        >
          {semanas.map((w, i) => {
            const futura = w.semana > hoyTexto;
            const actual = !futura && w.hasta >= hoyTexto;
            const bgBase = futura ? "#3a3a3a" : actual ? "#fff3cd" : "#c0c0c0";
            const bgHover = futura ? "#3a3a3a" : actual ? "#ffe69c" : "#a8a8a8";
            const abrir = () =>
              !futura && navigate(`/contable/caja/semana/${w.semana}`);
            return (
              <div
                key={w.semana}
                role="button"
                tabIndex={futura ? -1 : 0}
                onClick={abrir}
                onKeyDown={(e) => e.key === "Enter" && abrir()}
                className="text-center d-flex flex-column align-items-center justify-content-center"
                style={{
                  padding: "10px 6px",
                  minHeight: 110,
                  width: 170,
                  // Bordes bien redondeados, como las tarjetas de los meses.
                  borderRadius: 16,
                  background: bgBase,
                  border: "2px solid #ffc107",
                  userSelect: "none",
                  transition: "background 0.15s",
                  cursor: futura ? "not-allowed" : "pointer",
                  opacity: futura ? 0.4 : 1,
                  color: futura ? "#fff" : "#000",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = bgHover;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = bgBase;
                }}
              >
                <span style={{ fontSize: "1rem", fontWeight: 700 }}>
                  Semana {i + 1}
                </span>
                <span style={{ fontSize: "0.75rem", marginTop: 2 }}>
                  vie {ddmm(w.semana)} al jue {ddmm(w.hasta)}
                </span>
                {/* Antes de la primera semana con algo cargado no hay caja. */}
                {/* Sin la cuenta todavía (la primera vez que se abre el mes). */}
                {!futura && w.saldo === undefined && (
                  <span style={{ fontSize: "0.95rem", marginTop: 8, color: "#475569" }}>…</span>
                )}
                {!futura && w.saldo !== undefined && (!w.inicioCaja || w.semana < w.inicioCaja) && (
                  <span style={{ fontSize: "0.7rem", marginTop: 8, color: "#475569" }}>
                    caja sin empezar
                  </span>
                )}
                {!futura && w.inicioCaja && w.semana >= w.inicioCaja && (
                  <>
                    <span
                      style={{
                        fontSize: "0.68rem",
                        marginTop: 8,
                        color: "#475569",
                      }}
                    >
                      Saldo
                    </span>
                    <span
                      style={{
                        fontSize: "0.95rem",
                        fontWeight: 700,
                        color: w.saldo < 0 ? "#dc2626" : "#164e63",
                      }}
                    >
                      {pesos(w.saldo)}
                    </span>
                    <span style={{ fontSize: "0.66rem", color: "#475569" }}>
                      {w.movimientos
                        ? `${w.movimientos} movimiento${w.movimientos > 1 ? "s" : ""}`
                        : "sin movimientos"}
                    </span>
                  </>
                )}
              </div>
            );
          })}
        </div>
      </Container>
    </div>
  );
}

export default ContableCaja;
