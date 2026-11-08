import { useState } from "react";
import { Button, Container, Modal, Spinner, Table } from "react-bootstrap";
import Swal from "sweetalert2";
import { exportarPlanilla } from "../../helpers/excel";

/**
 * Costos (07/11/2026), desde la Comparativa costos tarea: por cada tarea de
 * La Martina, lo pagado por Ctv, lo que LM le pagó al personal (lo mismo de
 * la Comparativa), los litros de gasoil de los partes del período y lo que
 * valen, y el resultado: Ctv − personal − gasoil.
 *
 * El gasoil sale de la planilla de partes (combustible + turbo), valuado al
 * precio del gasoil vigente a la fecha del cierre siguiente (el de la
 * certificación del mes que viene; Contable › Equivalencias
 * tareas/variables), uno solo para el período. Las filas llegan armadas
 * desde ContableComparativa.jsx.
 *
 * Abajo, la torta del resultado por tarea de LM (07/11/2026). Tocando una
 * tarea se abre su historial día por día: lo de Ctv, lo del personal, el
 * gasoil y el resultado de cada día.
 */

const raya = <span style={{ color: "#cbd5e1" }}>—</span>;
const pesos = (n) =>
  n === null || n === undefined
    ? null
    : `$ ${n.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
// La cantidad pagada por Ctv: hasta tres decimales, como en la Comparativa.
const cantidad = (n) => (n === null || n === undefined ? null : n.toLocaleString("es-AR", { maximumFractionDigits: 3 }));
const litrosTexto = (n) => (n === null || n === undefined ? null : n.toLocaleString("es-AR", { maximumFractionDigits: 2 }));
const VERDE = "#15803d";
const ROJO = "#dc2626";
const colorRes = (v) => (v > 0.005 ? VERDE : v < -0.005 ? ROJO : undefined);
const ordenar = (a, b) => a.localeCompare(b, "es");
const fechaCorta = (f) => {
  const [a, m, d] = String(f || "").slice(0, 10).split("-");
  return d ? `${d}/${m}/${a}` : "";
};
const porcentaje = (n) => `${n.toLocaleString("es-AR", { maximumFractionDigits: 1 })} %`;
const TEXTO = "#475569";

// Una porción de torta, del ángulo a0 al a1 (en radianes, desde arriba). La
// misma que la de Gráficos (ContableGraficosCostos.jsx).
const porcion = (cx, cy, radio, a0, a1) => {
  if (a1 - a0 >= Math.PI * 2 - 1e-9) {
    return `M${cx},${cy - radio}A${radio},${radio} 0 1 1 ${cx - 0.01},${cy - radio}Z`;
  }
  const punto = (ang) => [cx + radio * Math.sin(ang), cy - radio * Math.cos(ang)];
  const [x0, y0] = punto(a0);
  const [x1, y1] = punto(a1);
  return `M${cx},${cy}L${x0},${y0}A${radio},${radio} 0 ${a1 - a0 > Math.PI ? 1 : 0} 1 ${x1},${y1}Z`;
};

// Los colores de las porciones, los mismos de la torta de Gráficos.
const COLORES_TORTA = [
  "#6d28d9", "#0e7490", "#15803d", "#c2410c", "#be185d", "#4338ca",
  "#a16207", "#0f766e", "#7c3aed", "#b91c1c", "#0369a1", "#65a30d",
];
// Las porciones de menos de este porcentaje van juntas en "Otras".
const MINIMO_PORCION = 3;

/**
 * El resultado por tarea de LM (07/11/2026): de todo el resultado a favor del
 * período, cuánto aportó cada tarea. Solo entran las tareas con resultado a
 * favor; las que dieron en contra van aparte, porque una porción negativa no
 * se puede dibujar. Abajo, el resultado neto (el TOTAL de la tabla).
 */
function TortaResultado({ tareas, col }) {
  const [encima, setEncima] = useState(null);
  const aFavor = tareas.filter((t) => t.resultado > 0.005).sort((a, b) => b.resultado - a.resultado);
  const enContra = tareas.filter((t) => t.resultado < -0.005).sort((a, b) => a.resultado - b.resultado);
  const totalAFavor = aFavor.reduce((a, t) => a + t.resultado, 0);
  const totalEnContra = enContra.reduce((a, t) => a + t.resultado, 0);

  // Las porciones, con las chicas juntas en "Otras".
  const grandes = aFavor.filter((t) => (t.resultado / totalAFavor) * 100 >= MINIMO_PORCION);
  const chicas = aFavor.filter((t) => (t.resultado / totalAFavor) * 100 < MINIMO_PORCION);
  const porciones = [
    ...grandes.map((t, i) => ({
      clave: t.clave,
      nombre: t.tarea,
      valor: t.resultado,
      color: COLORES_TORTA[i % COLORES_TORTA.length],
    })),
    ...(chicas.length
      ? [
          {
            clave: "otras",
            nombre: `Otras (${chicas.length} ${chicas.length === 1 ? "tarea" : "tareas"})`,
            detalle: chicas.map((t) => t.tarea).join(", "),
            valor: chicas.reduce((a, t) => a + t.resultado, 0),
            color: "#94a3b8",
          },
        ]
      : []),
  ];

  const radio = 160;
  const cx = radio + 10;
  const cy = radio + 10;
  let angulo = 0;
  const arcos = porciones.map((x) => {
    const a0 = angulo;
    angulo += (x.valor / totalAFavor) * Math.PI * 2;
    return { ...x, a0, a1: angulo, pct: (x.valor / totalAFavor) * 100 };
  });

  return (
    <div className="bg-white rounded-3 shadow-sm flex-shrink-0 mb-2 mt-3" style={{ border: `2px solid ${col.oscuro}` }}>
      <div className="d-flex align-items-center gap-2 px-2" style={{ height: 38, borderBottom: "1px solid #e2e8f0" }}>
        <span className="fw-bold text-truncate" style={{ color: col.oscuro, fontSize: "0.95rem" }}>
          Resultado por tarea LM
          <span className="fw-normal ms-1" style={{ color: TEXTO, fontSize: "0.74rem" }}>
            (Ctv − personal − gasoil, solo las tareas con resultado a favor)
          </span>
        </span>
      </div>
      {!aFavor.length ? (
        <div className="text-muted text-center py-4" style={{ fontSize: "0.76rem" }}>
          Ninguna tarea tuvo resultado a favor en el período
        </div>
      ) : (
        <div className="d-flex align-items-center gap-4 p-3 flex-wrap justify-content-center">
          <svg width={cx * 2} height={cy * 2} style={{ flexShrink: 0 }} onMouseLeave={() => setEncima(null)}>
            {arcos.map((x) => (
              <path
                key={x.clave}
                d={porcion(cx, cy, encima === x.clave ? radio + 6 : radio, x.a0, x.a1)}
                fill={x.color}
                stroke="#fff"
                strokeWidth={1.5}
                onMouseEnter={() => setEncima(x.clave)}
              >
                <title>{`${x.nombre}: ${pesos(x.valor)} (${porcentaje(x.pct)})${x.detalle ? ` — ${x.detalle}` : ""}`}</title>
              </path>
            ))}
            {arcos.map((x) => {
              // El porcentaje adentro de la porción, si entra.
              if (x.pct < 6) return null;
              const medio = (x.a0 + x.a1) / 2;
              return (
                <text
                  key={`t-${x.clave}`}
                  x={cx + radio * 0.62 * Math.sin(medio)}
                  y={cy - radio * 0.62 * Math.cos(medio) + 4}
                  textAnchor="middle"
                  fontSize="13"
                  fontWeight="700"
                  fill="#fff"
                  pointerEvents="none"
                >
                  {Math.round(x.pct).toLocaleString("es-AR")} %
                </text>
              );
            })}
          </svg>

          {/* La referencia: cada porción con su plata y su parte */}
          <div style={{ minWidth: 260, flex: "1 1 260px", maxWidth: 520 }}>
            {arcos.map((x) => (
              <div
                key={x.clave}
                className="d-flex align-items-start gap-2 px-2 py-1 rounded-2"
                style={{ fontSize: "0.74rem", backgroundColor: encima === x.clave ? "#f1f5f9" : undefined }}
                onMouseEnter={() => setEncima(x.clave)}
                onMouseLeave={() => setEncima(null)}
                title={x.detalle}
              >
                <span className="flex-shrink-0 rounded-1" style={{ width: 12, height: 12, marginTop: 2, backgroundColor: x.color }}></span>
                <span className="fw-semibold" style={{ color: "#1e293b", flex: "1 1 auto", minWidth: 0, overflowWrap: "anywhere" }}>
                  {x.nombre}
                </span>
                <span className="flex-shrink-0" style={{ color: VERDE, fontWeight: 700 }}>
                  {pesos(x.valor)}
                </span>
                <span className="flex-shrink-0 text-end" style={{ color: TEXTO, width: 52 }}>
                  {porcentaje(x.pct)}
                </span>
              </div>
            ))}
            <div
              className="d-flex align-items-center gap-2 px-2 pt-2 mt-1"
              style={{ fontSize: "0.76rem", borderTop: "1px solid #e2e8f0" }}
            >
              <span className="fw-bold" style={{ color: col.oscuro, flex: "1 1 auto" }}>
                Resultado a favor
              </span>
              <span className="fw-bold" style={{ color: VERDE }}>
                {pesos(totalAFavor)}
              </span>
              <span style={{ width: 52 }}></span>
            </div>
            {enContra.length > 0 && (
              <div className="px-2 pt-2" style={{ fontSize: "0.72rem", color: TEXTO }}>
                <div className="d-flex align-items-center gap-2">
                  <span className="fw-bold" style={{ color: ROJO, flex: "1 1 auto" }}>
                    Con resultado en contra (no entran en la torta)
                  </span>
                  <span className="fw-bold" style={{ color: ROJO }}>
                    {pesos(totalEnContra)}
                  </span>
                  <span style={{ width: 52 }}></span>
                </div>
                {enContra.map((t) => (
                  <div key={t.clave} className="d-flex align-items-center gap-2 ps-2">
                    <span style={{ flex: "1 1 auto", minWidth: 0, overflowWrap: "anywhere" }}>{t.tarea}</span>
                    <span style={{ color: ROJO }}>{pesos(t.resultado)}</span>
                    <span style={{ width: 52 }}></span>
                  </div>
                ))}
                <div
                  className="d-flex align-items-center gap-2 pt-1 mt-1"
                  style={{ borderTop: "1px solid #f1f5f9", fontSize: "0.76rem" }}
                >
                  <span className="fw-bold" style={{ color: col.oscuro, flex: "1 1 auto" }}>
                    Resultado neto del período
                  </span>
                  <span className="fw-bold" style={{ color: colorRes(totalAFavor + totalEnContra) }}>
                    {pesos(totalAFavor + totalEnContra)}
                  </span>
                  <span style={{ width: 52 }}></span>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function ContableResultadoCostos({
  titulo,
  filas,
  cargando,
  colores: col,
  fechas,
  gasoil,
  historial,
  diasHistorial,
  onVerHistorial,
  onCerrarHistorial,
}) {
  const th = {
    backgroundColor: col.oscuro,
    color: "#fff",
    fontSize: "0.66rem",
    fontWeight: 600,
    verticalAlign: "middle",
    padding: "3px 5px",
    whiteSpace: "nowrap",
    textAlign: "center",
  };
  const td = { fontSize: "0.7rem", padding: "1px 5px", verticalAlign: "middle", textAlign: "center", whiteSpace: "nowrap" };

  const lista = [...filas].sort((a, b) => ordenar(a.tarea || "", b.tarea || ""));
  const suma = (k) => lista.reduce((a, f) => a + (f[k] || 0), 0);
  const total = {
    subCTV: suma("subCTV"),
    subLM: suma("subLM"),
    litros: suma("litros"),
    gasoil: suma("gasoil"),
    resultado: suma("resultado"),
  };

  const exportarExcel = async () => {
    try {
      await exportarPlanilla({
        titulo: `${titulo}${fechas ? ` — partes de LM ${fechas}` : ""}${
          gasoil?.precio !== null && gasoil?.precio !== undefined ? ` — gasoil ${pesos(gasoil.precio)}/L` : ""
        }`,
        hoja: "Costos",
        archivo: `${titulo}.xlsx`,
        columnas: [
          { titulo: "Tarea LM", ancho: 40, negrita: true },
          { titulo: "Unidad", ancho: 12 },
          { titulo: "Cant.", ancho: 12 },
          { titulo: "Pagado por Ctv", ancho: 18, moneda: true },
          { titulo: "Costo personal LM", ancho: 18, moneda: true },
          { titulo: "Lts gasoil", ancho: 12 },
          { titulo: "Costo gasoil", ancho: 18, moneda: true },
          { titulo: "Resultado", ancho: 18, moneda: true },
        ],
        filas: [
          ...lista.map((f) => [
            f.tareaLMCostos ? `${f.tarea} (LM: ${f.tareaLMCostos})` : f.sinEquivalencia ? `${f.tarea} (sin equivalencia)` : f.tarea,
            f.unidad || "",
            f.cantCTV ?? "-",
            f.subCTV ?? "-",
            f.subLM ?? "-",
            f.litros ?? "-",
            f.gasoil ?? "-",
            f.resultado,
          ]),
          ["TOTAL", "", "", total.subCTV, total.subLM, total.litros, total.gasoil, total.resultado],
        ],
      });
    } catch (err) {
      Swal.fire({ icon: "error", title: "No se pudo exportar", text: err.message, width: "300px" });
    }
  };

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", backgroundColor: "#f8f9fa", height: "100%", overflow: "hidden" }}>
      <Container
        fluid
        className="px-4 py-3 d-flex flex-column flex-grow-1"
        style={{ maxWidth: "1100px", width: "100%", margin: "0 auto", minHeight: 0, overflowY: "auto" }}
      >
        <div className="d-flex align-items-center gap-2 mb-1 flex-wrap">
          <i className="bi bi-calculator" style={{ color: col.medio, fontSize: "1.15rem" }}></i>
          <span className="fw-bold" style={{ color: col.oscuro, fontSize: "1.05rem" }}>
            {titulo}
          </span>
          <Button
            size="sm"
            onClick={exportarExcel}
            disabled={cargando || !lista.length}
            className="rounded-3 px-3 d-flex align-items-center gap-2 ms-auto"
            style={{ backgroundColor: "#15803d", borderColor: "#15803d", fontSize: "0.78rem", height: "30px", fontWeight: 600 }}
            title="Exportar la tabla a Excel"
          >
            <i className="bi bi-file-earmark-excel-fill"></i>
            <span>Excel</span>
          </Button>
        </div>
        <div className="mb-3" style={{ fontSize: "0.74rem", color: "#64748b" }}>
          Resultado = pagado por Ctv − costo del personal de LM − gasoil. El gasoil son los litros de los partes (máquina
          + turbo) al precio vigente a la fecha del cierre siguiente (el de la certificación del mes que viene).
          {fechas ? ` Partes de LM ${fechas}.` : ""}
        </div>

        {/* El precio del gasoil que se usa, con su fecha. */}
        {!cargando && gasoil?.precio !== null && gasoil?.precio !== undefined && (
          <div className="d-flex align-items-center gap-2 mb-3 flex-wrap flex-shrink-0" style={{ fontSize: "0.78rem" }}>
            <span
              className="d-flex align-items-center gap-2 px-3 py-1 rounded-pill"
              style={{ backgroundColor: "#fff", border: "1px solid #cbd5e1", color: col.oscuro }}
            >
              <i className="bi bi-fuel-pump-fill"></i>
              <span>
                Gasoil <strong>{pesos(gasoil.precio)}</strong> por litro
              </span>
              <span style={{ color: "#64748b" }}>
                · vigente desde el {fechaCorta(gasoil.desde)} (cierre siguiente {fechaCorta(gasoil.cierre)})
              </span>
            </span>
          </div>
        )}

        {/* Aviso: sin precio del gasoil a la fecha de cierre. */}
        {!cargando && (gasoil?.precio === null || gasoil?.precio === undefined) && (
          <div
            className="d-flex align-items-center gap-2 rounded-3 px-3 py-2 mb-3 flex-shrink-0"
            style={{ backgroundColor: "#fef3c7", border: "1px solid #fcd34d", color: "#92400e", fontSize: "0.76rem" }}
          >
            <i className="bi bi-exclamation-triangle-fill"></i>
            <span>
              No hay precio del gasoil vigente al cierre siguiente
              {gasoil?.cierre ? ` (${fechaCorta(gasoil.cierre)})` : ""}: se carga en Contable › Equivalencias
              tareas/variables. Mientras tanto los litros no tienen valor.
            </span>
          </div>
        )}

        <div
          className="shadow-sm rounded-3 bg-white flex-shrink-0"
          style={{ maxWidth: "100%", overflowX: "auto", border: "1px solid #cbd5e1" }}
        >
          <Table className="mb-0 tabla-informe" style={{ width: "100%" }}>
            <thead>
              <tr>
                <th style={{ ...th, textAlign: "left" }}>Tarea LM</th>
                <th style={{ ...th, width: "70px" }}>Unidad</th>
                {/* La cantidad pagada por Ctv (07/11/2026). */}
                <th style={{ ...th, width: "80px" }} title="Cantidad pagada por Ctv">
                  Cant.
                </th>
                <th className="col-corte" style={{ ...th, width: "125px" }}>Pagado por Ctv</th>
                <th style={{ ...th, width: "125px" }}>Costo personal LM</th>
                <th className="col-corte" style={{ ...th, width: "90px" }}>Lts gasoil</th>
                <th style={{ ...th, width: "125px" }}>Costo gasoil</th>
                <th className="col-corte" style={{ ...th, width: "130px" }}>Resultado</th>
              </tr>
            </thead>
            <tbody>
              {cargando ? (
                <tr>
                  <td colSpan={8} className="text-center text-muted py-4" style={td}>
                    <Spinner animation="border" size="sm" style={{ color: col.medio }} />
                  </td>
                </tr>
              ) : !lista.length ? (
                <tr>
                  <td colSpan={8} className="text-center text-muted py-4" style={td}>
                    No hay nada que comparar en este período
                  </td>
                </tr>
              ) : (
                <>
                  {lista.map((f) => (
                    <tr
                      key={f.clave}
                      onClick={() => onVerHistorial(f)}
                      style={{ cursor: "pointer" }}
                      title="Ver el historial día por día"
                    >
                      <td style={{ ...td, textAlign: "left", whiteSpace: "normal" }}>
                        <span
                          className={f.sinEquivalencia ? "px-2 rounded-2" : undefined}
                          style={
                            f.sinEquivalencia
                              ? { fontWeight: 700, color: "#92400e", backgroundColor: "#fde68a" }
                              : { fontWeight: 600 }
                          }
                          title={f.sinEquivalencia ? "Sin equivalencia entre las tareas de Ctv y de LM" : undefined}
                        >
                          {f.tarea || raya}
                        </span>
                        {f.tareaLMCostos && (
                          <div style={{ fontSize: "0.62rem", color: "#64748b" }} title="Equivalencia de costos">
                            LM: {f.tareaLMCostos}
                          </div>
                        )}
                      </td>
                      <td style={td}>{f.unidad || raya}</td>
                      <td style={td}>{cantidad(f.cantCTV) ?? raya}</td>
                      <td className="col-corte" style={td}>{pesos(f.subCTV) ?? raya}</td>
                      <td style={td}>{pesos(f.subLM) ?? raya}</td>
                      <td
                        className="col-corte"
                        style={td}
                      >
                        {litrosTexto(f.litros) ?? raya}
                      </td>
                      <td style={td}>{pesos(f.gasoil) ?? raya}</td>
                      <td className="col-corte" style={{ ...td, fontWeight: 700, color: colorRes(f.resultado) }}>
                        {pesos(f.resultado)}
                      </td>
                    </tr>
                  ))}
                  <tr className="fila-total">
                    <td style={{ ...td, textAlign: "left", fontWeight: 700, color: col.oscuro }}>TOTAL</td>
                    <td style={td}></td>
                    <td style={td}></td>
                    <td className="col-corte" style={{ ...td, fontWeight: 700 }}>{pesos(total.subCTV)}</td>
                    <td style={{ ...td, fontWeight: 700 }}>{pesos(total.subLM)}</td>
                    <td className="col-corte" style={{ ...td, fontWeight: 700 }}>{litrosTexto(total.litros)}</td>
                    <td style={{ ...td, fontWeight: 700 }}>{pesos(total.gasoil)}</td>
                    <td className="col-corte" style={{ ...td, fontWeight: 700, color: colorRes(total.resultado) }}>
                      {pesos(total.resultado)}
                    </td>
                  </tr>
                </>
              )}
            </tbody>
          </Table>
        </div>

        {/* El resultado por tarea de LM (07/11/2026). */}
        {!cargando && lista.length > 0 && <TortaResultado tareas={lista} col={col} />}
      </Container>

      {/* El historial de una tarea, día por día (07/11/2026). */}
      <Modal
        show={Boolean(historial)}
        onHide={onCerrarHistorial}
        centered
        size="xl"
        contentClassName="border-0 shadow-lg rounded-4"
      >
        <Modal.Header
          closeButton
          closeVariant="white"
          style={{
            backgroundColor: col.oscuro,
            color: "#fff",
            borderTopLeftRadius: "1rem",
            borderTopRightRadius: "1rem",
            borderBottom: "1px solid rgba(255,255,255,0.1)",
          }}
        >
          <Modal.Title className="fs-6 fw-bold d-flex align-items-center gap-2 text-white flex-wrap">
            <i className="bi bi-clock-history" style={{ color: col.icono }}></i>
            <span>{historial?.tarea}</span>
            <span className="fw-normal" style={{ fontSize: "0.82rem", opacity: 0.8 }}>
              · {historial?.unidad || "sin unidad"}
              {historial?.tareaLMCostos ? ` · LM: ${historial.tareaLMCostos}` : ""}
            </span>
          </Modal.Title>
        </Modal.Header>
        <Modal.Body className="p-3">
          <div className="rounded-3 bg-white" style={{ maxHeight: "60vh", overflowY: "auto", border: "1px solid #cbd5e1" }}>
            <Table className="mb-0 tabla-informe" style={{ width: "100%" }}>
              <thead style={{ position: "sticky", top: 0, zIndex: 10, backgroundColor: col.oscuro, color: "#fff" }}>
                <tr>
                  <th style={th}>Fecha</th>
                  <th className="col-corte" style={th}>Cant. pagado Ctv</th>
                  <th style={th}>Cant. pagado LM</th>
                  <th className="col-corte" style={th}>Pagado por Ctv</th>
                  <th style={th}>Costo personal LM</th>
                  <th className="col-corte" style={th}>Lts gasoil</th>
                  <th style={th}>Costo gasoil</th>
                  <th className="col-corte" style={th}>Resultado</th>
                </tr>
              </thead>
              <tbody>
                {!diasHistorial?.length ? (
                  <tr>
                    <td colSpan={8} className="text-center text-muted py-4" style={td}>
                      No hay días para mostrar
                    </td>
                  </tr>
                ) : (
                  <>
                    {diasHistorial.map((d) => (
                      <tr key={d.fecha}>
                        <td style={td}>
                          {d.fecha === "ajuste" ? (
                            <span style={{ color: "#64748b", fontStyle: "italic" }} title="Correcciones a mano de Contable - Pagos">
                              Correcciones a mano
                            </span>
                          ) : d.fecha ? (
                            fechaCorta(d.fecha)
                          ) : (
                            raya
                          )}
                        </td>
                        <td className="col-corte" style={td}>{cantidad(d.ctv) ?? raya}</td>
                        <td style={td}>{cantidad(d.lm) ?? raya}</td>
                        <td className="col-corte" style={td}>{pesos(d.subCTV) ?? raya}</td>
                        <td style={td}>{pesos(d.subLM) ?? raya}</td>
                        <td className="col-corte" style={td}>{litrosTexto(d.litros) ?? raya}</td>
                        <td style={td}>{pesos(d.gasoil) ?? raya}</td>
                        <td className="col-corte" style={{ ...td, fontWeight: 700, color: colorRes(d.resultado) }}>
                          {pesos(d.resultado)}
                        </td>
                      </tr>
                    ))}
                    <tr className="fila-total">
                      <td style={{ ...td, fontWeight: 700, color: col.oscuro }}>TOTAL</td>
                      <td className="col-corte" style={{ ...td, fontWeight: 700 }}>{cantidad(historial?.cantCTV) ?? raya}</td>
                      <td style={{ ...td, fontWeight: 700 }}>{cantidad(historial?.cantLM) ?? raya}</td>
                      <td className="col-corte" style={{ ...td, fontWeight: 700 }}>{pesos(historial?.subCTV) ?? raya}</td>
                      <td style={{ ...td, fontWeight: 700 }}>{pesos(historial?.subLM) ?? raya}</td>
                      <td className="col-corte" style={{ ...td, fontWeight: 700 }}>{litrosTexto(historial?.litros) ?? raya}</td>
                      <td style={{ ...td, fontWeight: 700 }}>{pesos(historial?.gasoil) ?? raya}</td>
                      <td className="col-corte" style={{ ...td, fontWeight: 700, color: colorRes(historial?.resultado) }}>
                        {pesos(historial?.resultado)}
                      </td>
                    </tr>
                  </>
                )}
              </tbody>
            </Table>
          </div>
          <div className="mt-2 text-muted" style={{ fontSize: "0.72rem" }}>
            {fechas ? `Partes de LM ${fechas}. ` : ""}Lo de LM es lo que se le pagó al personal; el gasoil, los litros de
            los partes al precio del cierre siguiente.
          </div>
        </Modal.Body>
      </Modal>
    </div>
  );
}

export default ContableResultadoCostos;
