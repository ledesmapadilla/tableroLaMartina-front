import { useEffect, useId, useRef, useState } from "react";
import { Container, Form, Spinner, Table } from "react-bootstrap";

/**
 * Los gráficos de la Comparativa costos tarea (07/11/2026): por cada tarea de
 * La Martina, el precio unitario que paga Ctv contra el que LM le paga al
 * personal, y la diferencia (Ctv − LM) en pesos y en porcentaje. El
 * porcentaje es sobre el precio de Ctv (07/11/2026): qué parte de lo que
 * paga Ctv representa la diferencia.
 *
 * Dos solapas (07/11/2026): "Tarifas" (el precio unitario) y "Total del
 * mes" (lo pagado en el mes: Ctv contra lo que LM le pagó al personal). En
 * las dos el porcentaje es sobre lo de Ctv.
 *
 * Arriba la tabla y abajo las barras de la diferencia, con el switch $ / %
 * como el de los gráficos de los informes (GraficoConsumoCC.jsx). Las filas
 * llegan ya armadas desde ContableComparativa.jsx (las de la solapa
 * Comparativa).
 */

const GRILLA = "#e2e8f0";
const TEXTO = "#475569";
const TEXTO_SUAVE = "#94a3b8";
const VERDE = "#15803d";
const VERDE_HOVER = "#22a052";
const ROJO = "#dc2626";
const ROJO_HOVER = "#ef4444";
const ALTO_GRAFICO = 300;
// Los nombres van parados a 90° y partidos en renglones (07/11/2026), para
// que no ocupen tanto alto: cada renglón de hasta LARGO_RENGLON letras, y
// tantos renglones como entren en el ancho de la barra (hasta MAX_RENGLONES).
const LARGO_RENGLON = 14;
const MAX_RENGLONES = 3;
const ALTO_RENGLON = 10.5;
const LETRA = 5.4;

const raya = <span style={{ color: "#cbd5e1" }}>—</span>;
const pesos = (n) =>
  n === null || n === undefined
    ? null
    : `$ ${n.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const porcentaje = (n) =>
  n === null || n === undefined ? null : `${n.toLocaleString("es-AR", { maximumFractionDigits: 1 })} %`;
const nf = new Intl.NumberFormat("es-AR", { maximumFractionDigits: 2 });
const cantidad = (n) => (n === null || n === undefined ? null : n.toLocaleString("es-AR", { maximumFractionDigits: 3 }));

// Las dos vistas: qué se compara en cada una. Total del mes primero: es la
// que se abre al entrar (07/11/2026).
const VISTAS = [
  ["mes", "Total del mes", "bi-calendar3"],
  ["tarifas", "Tarifas", "bi-tag"],
];
const colorDif = (v) => (v > 0.005 ? VERDE : v < -0.005 ? ROJO : undefined);
// El nombre en renglones, cortando entre palabras. Lo que no entra en
// `maximo` renglones termina con "…" (el nombre completo está en el mouse).
const renglones = (texto, maximo) => {
  const lineas = [];
  for (const palabra of String(texto).split(/\s+/).filter(Boolean)) {
    const ultima = lineas[lineas.length - 1];
    if (ultima !== undefined && `${ultima} ${palabra}`.length <= LARGO_RENGLON) {
      lineas[lineas.length - 1] = `${ultima} ${palabra}`;
    } else {
      // Una palabra más larga que el renglón se parte.
      for (let i = 0; i < palabra.length; i += LARGO_RENGLON) lineas.push(palabra.slice(i, i + LARGO_RENGLON));
    }
  }
  if (lineas.length <= maximo) return lineas;
  const quedan = lineas.slice(0, maximo);
  const fin = quedan[maximo - 1];
  quedan[maximo - 1] = `${fin.length >= LARGO_RENGLON ? fin.slice(0, LARGO_RENGLON - 1) : fin}…`;
  return quedan;
};

// Divisiones redondas del eje entre el mínimo y el máximo, con el cero
// siempre adentro: las diferencias pueden ser negativas.
const divisiones = (minimo, maximo) => {
  const lo = Math.min(0, minimo);
  const hi = Math.max(0, maximo);
  if (!(hi - lo > 0)) return [0, 1];
  const crudo = (hi - lo) / 5;
  const potencia = 10 ** Math.floor(Math.log10(crudo));
  const paso = [1, 2, 2.5, 5, 10].map((m) => m * potencia).find((p) => p >= crudo);
  const desde = Math.floor(lo / paso + 1e-9);
  const hasta = Math.ceil(hi / paso - 1e-9);
  return Array.from({ length: hasta - desde + 1 }, (_, i) => Number(((desde + i) * paso).toPrecision(12)));
};

// Barra con la punta redondeada del lado del valor y la base recta en el cero.
const caminoBarra = (x, yCero, ancho, alto, negativa) => {
  const r = Math.min(4, ancho / 2, alto);
  if (negativa) {
    const yFin = yCero + alto;
    return (
      `M${x},${yCero}V${yFin - r}Q${x},${yFin} ${x + r},${yFin}` +
      `H${x + ancho - r}Q${x + ancho},${yFin} ${x + ancho},${yFin - r}V${yCero}Z`
    );
  }
  const yTop = yCero - alto;
  return (
    `M${x},${yCero}V${yTop + r}Q${x},${yTop} ${x + r},${yTop}` +
    `H${x + ancho - r}Q${x + ancho},${yTop} ${x + ancho},${yTop + r}V${yCero}Z`
  );
};

// Los colores de las porciones: distintos entre sí y legibles sobre blanco.
const COLORES_TORTA = [
  "#6d28d9", "#0e7490", "#15803d", "#c2410c", "#be185d", "#4338ca",
  "#a16207", "#0f766e", "#7c3aed", "#b91c1c", "#0369a1", "#65a30d",
];
// Las porciones de menos de este porcentaje van juntas en "Otras".
const MINIMO_PORCION = 3;

// Una porción de torta, del ángulo a0 al a1 (en radianes, desde arriba).
const porcion = (cx, cy, radio, a0, a1) => {
  if (a1 - a0 >= Math.PI * 2 - 1e-9) {
    return `M${cx},${cy - radio}A${radio},${radio} 0 1 1 ${cx - 0.01},${cy - radio}Z`;
  }
  const p = (ang) => [cx + radio * Math.sin(ang), cy - radio * Math.cos(ang)];
  const [x0, y0] = p(a0);
  const [x1, y1] = p(a1);
  return `M${cx},${cy}L${x0},${y0}A${radio},${radio} 0 ${a1 - a0 > Math.PI ? 1 : 0} 1 ${x1},${y1}Z`;
};

/**
 * La torta de la diferencia del mes (07/11/2026): de lo que Ctv pagó de más
 * sobre lo que LM le pagó al personal, cuánto aportó cada tarea. Solo entran
 * las tareas con diferencia a favor; las que dieron en contra van aparte, porque
 * una porción negativa no se puede dibujar.
 */
function TortaDiferencias({ tareas, col }) {
  const [encima, setEncima] = useState(null);
  const conDif = tareas.map((t) => ({ ...t, dif: (t.subCTV || 0) - (t.subLM || 0) }));
  const aFavor = conDif.filter((t) => t.dif > 0.005).sort((a, b) => b.dif - a.dif);
  const enContra = conDif.filter((t) => t.dif < -0.005).sort((a, b) => a.dif - b.dif);
  const totalAFavor = aFavor.reduce((a, t) => a + t.dif, 0);
  const totalEnContra = enContra.reduce((a, t) => a + t.dif, 0);

  // Las porciones, con las chicas juntas en "Otras".
  const grandes = aFavor.filter((t) => (t.dif / totalAFavor) * 100 >= MINIMO_PORCION);
  const chicas = aFavor.filter((t) => (t.dif / totalAFavor) * 100 < MINIMO_PORCION);
  const porciones = [
    ...grandes.map((t, i) => ({ clave: t.clave, nombre: t.tarea, valor: t.dif, color: COLORES_TORTA[i % COLORES_TORTA.length] })),
    ...(chicas.length
      ? [
          {
            clave: "otras",
            nombre: `Otras (${chicas.length} ${chicas.length === 1 ? "tarea" : "tareas"})`,
            detalle: chicas.map((t) => t.tarea).join(", "),
            valor: chicas.reduce((a, t) => a + t.dif, 0),
            color: "#94a3b8",
          },
        ]
      : []),
  ];

  // Más grande (07/11/2026).
  const radio = 160;
  const cx = radio + 10;
  const cy = radio + 10;
  let angulo = 0;
  const arcos = porciones.map((p) => {
    const a0 = angulo;
    angulo += (p.valor / totalAFavor) * Math.PI * 2;
    return { ...p, a0, a1: angulo, pct: (p.valor / totalAFavor) * 100 };
  });

  return (
    <div className="bg-white rounded-3 shadow-sm flex-shrink-0 mb-2 mt-3" style={{ border: `2px solid ${col.oscuro}` }}>
      <div className="d-flex align-items-center gap-2 px-2" style={{ height: 38, borderBottom: "1px solid #e2e8f0" }}>
        <span className="fw-bold text-truncate" style={{ color: col.oscuro, fontSize: "0.95rem" }}>
          Cómo se repartió la diferencia del mes
          <span className="fw-normal ms-1" style={{ color: TEXTO, fontSize: "0.74rem" }}>
            (Ctv − LM, solo las tareas con diferencia a favor)
          </span>
        </span>
      </div>
      {!aFavor.length ? (
        <div className="text-muted text-center py-4" style={{ fontSize: "0.76rem" }}>
          Ninguna tarea tuvo diferencia a favor en el mes
        </div>
      ) : (
        <div className="d-flex align-items-center gap-4 p-3 flex-wrap justify-content-center">
          <svg width={cx * 2} height={cy * 2} style={{ flexShrink: 0 }} onMouseLeave={() => setEncima(null)}>
            {arcos.map((p) => (
              <path
                key={p.clave}
                d={porcion(cx, cy, encima === p.clave ? radio + 6 : radio, p.a0, p.a1)}
                fill={p.color}
                stroke="#fff"
                strokeWidth={1.5}
                onMouseEnter={() => setEncima(p.clave)}
                style={{ cursor: "default" }}
              >
                <title>{`${p.nombre}: ${pesos(p.valor)} (${porcentaje(p.pct)})${p.detalle ? ` — ${p.detalle}` : ""}`}</title>
              </path>
            ))}
            {arcos.map((p) => {
              // El porcentaje adentro de la porción, si entra.
              if (p.pct < 6) return null;
              const medio = (p.a0 + p.a1) / 2;
              const x = cx + radio * 0.62 * Math.sin(medio);
              const y = cy - radio * 0.62 * Math.cos(medio);
              return (
                <text key={`t-${p.clave}`} x={x} y={y + 4} textAnchor="middle" fontSize="13" fontWeight="700" fill="#fff" pointerEvents="none">
                  {nf.format(Math.round(p.pct))} %
                </text>
              );
            })}
          </svg>

          {/* La referencia: cada porción con su plata y su parte */}
          <div style={{ minWidth: 260, flex: "1 1 260px", maxWidth: 520 }}>
            {arcos.map((p) => (
              <div
                key={p.clave}
                className="d-flex align-items-start gap-2 px-2 py-1 rounded-2"
                style={{ fontSize: "0.74rem", backgroundColor: encima === p.clave ? "#f1f5f9" : undefined }}
                onMouseEnter={() => setEncima(p.clave)}
                onMouseLeave={() => setEncima(null)}
                title={p.detalle}
              >
                <span className="flex-shrink-0 rounded-1" style={{ width: 12, height: 12, marginTop: 2, backgroundColor: p.color }}></span>
                {/* El nombre largo sigue en otro renglón, no se corta. */}
                <span className="fw-semibold" style={{ color: "#1e293b", flex: "1 1 auto", minWidth: 0, overflowWrap: "anywhere" }}>
                  {p.nombre}
                </span>
                <span className="flex-shrink-0" style={{ color: VERDE, fontWeight: 700 }}>
                  {pesos(p.valor)}
                </span>
                <span className="flex-shrink-0 text-end" style={{ color: TEXTO, width: 52 }}>
                  {porcentaje(p.pct)}
                </span>
              </div>
            ))}
            <div
              className="d-flex align-items-center gap-2 px-2 pt-2 mt-1"
              style={{ fontSize: "0.76rem", borderTop: "1px solid #e2e8f0" }}
            >
              <span className="fw-bold" style={{ color: col.oscuro, flex: "1 1 auto" }}>
                Diferencia a favor
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
                    Con diferencia en contra (no entran en la torta)
                  </span>
                  <span className="fw-bold" style={{ color: ROJO }}>
                    {pesos(totalEnContra)}
                  </span>
                  <span style={{ width: 52 }}></span>
                </div>
                {enContra.map((t) => (
                  <div key={t.clave} className="d-flex align-items-center gap-2 ps-2">
                    <span style={{ flex: "1 1 auto", minWidth: 0, overflowWrap: "anywhere" }}>
                      {t.tarea}
                    </span>
                    <span style={{ color: ROJO }}>{pesos(t.dif)}</span>
                    <span style={{ width: 52 }}></span>
                  </div>
                ))}
                <div
                  className="d-flex align-items-center gap-2 pt-1 mt-1"
                  style={{ borderTop: "1px solid #f1f5f9", fontSize: "0.76rem" }}
                >
                  <span className="fw-bold" style={{ color: col.oscuro, flex: "1 1 auto" }}>
                    Diferencia neta del mes
                  </span>
                  <span className="fw-bold" style={{ color: colorDif(totalAFavor + totalEnContra) }}>
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

function ContableGraficosCostos({ titulo, filas, cargando, colores: col, fechas }) {
  const idSwitch = useId();
  const [porcentajeElegido, setEnPorcentaje] = useState(false);
  const [vista, setVista] = useState("mes");
  const esMes = vista === "mes";
  // En el total del mes va siempre en pesos, sin switch (07/11/2026).
  const enPorcentaje = porcentajeElegido && !esMes;
  const [encima, setEncima] = useState(null);
  const [ancho, setAncho] = useState(0);
  const refCaja = useRef(null);

  useEffect(() => {
    const caja = refCaja.current;
    if (!caja) return undefined;
    const obs = new ResizeObserver(([e]) => setAncho(Math.floor(e.contentRect.width)));
    obs.observe(caja);
    return () => obs.disconnect();
  }, [cargando]);

  // Las tareas de La Martina, con los dos precios y la diferencia.
  const tareas = filas
    // En Tarifas, las tareas de La Martina. En el total del mes también las
    // de Ctv sin equivalencia (07/11/2026): lo que pagó Ctv por ellas es
    // diferencia igual, y así el total da lo mismo que la Comparativa.
    .filter((g) => esMes || String(g.clave).startsWith("lm:"))
    .map((g) => {
      const hay = g.precio !== null && g.precio !== undefined && g.precioLM !== null && g.precioLM !== undefined;
      const difPrecio = hay ? g.precio - g.precioLM : null;
      const pctPrecio = hay && g.precio ? (difPrecio / g.precio) * 100 : null;
      // El mes: lo pagado por Ctv contra lo que LM le pagó a la gente. Lo que
      // falta de un lado cuenta como cero, igual que en la Comparativa.
      const hayMes = (g.subCTV !== null && g.subCTV !== undefined) || (g.subLM !== null && g.subLM !== undefined);
      const difMes = hayMes ? (g.subCTV || 0) - (g.subLM || 0) : null;
      const pctMes = hayMes && g.subCTV ? (difMes / g.subCTV) * 100 : null;
      return {
        ...g,
        difPrecio,
        difV: esMes ? difMes : difPrecio,
        pct: esMes ? pctMes : pctPrecio,
      };
    })
    .sort((a, b) => String(a.tarea).localeCompare(String(b.tarea), "es"));

  const campo = enPorcentaje ? "pct" : "difV";
  // De menor a mayor: la de más diferencia a favor, a la derecha.
  const datos = tareas.filter((t) => t[campo] !== null).sort((a, b) => a[campo] - b[campo]);
  const sinDato = tareas.length - datos.length;
  const formato = (v) => (enPorcentaje ? `${nf.format(v)} %` : `$ ${nf.format(v)}`);

  const escala = divisiones(Math.min(...datos.map((d) => d[campo]), 0), Math.max(...datos.map((d) => d[campo]), 0));
  const minimo = escala[0];
  const tope = escala[escala.length - 1];
  const largoEje0 = Math.max(...escala.map((v) => formato(v).length));
  // Cuántos renglones entran en el ancho de cada barra.
  const pasoX0 = datos.length ? Math.max(0, ancho - (largoEje0 * 6 + 14) - 10) / datos.length : 0;
  const maxRenglones = Math.max(1, Math.min(MAX_RENGLONES, Math.floor((pasoX0 - 2) / ALTO_RENGLON)));
  const nombres = new Map(datos.map((d) => [d.clave, renglones(d.tarea, maxRenglones)]));
  const largoNombre = Math.max(4, ...[...nombres.values()].flat().map((l) => l.length));
  const largoEje = Math.max(...escala.map((v) => formato(v).length));
  const m = { arriba: 18, derecha: 10, abajo: Math.round(largoNombre * LETRA) + 24, izquierda: largoEje * 6 + 14 };
  const altoSvg = ALTO_GRAFICO + m.abajo;
  const anchoPlot = Math.max(0, ancho - m.izquierda - m.derecha);
  const pasoX = datos.length ? anchoPlot / datos.length : 0;
  const anchoBarra = Math.max(3, Math.min(34, pasoX - 6));
  const conValor = pasoX >= 46;
  const y = (v) => m.arriba + ALTO_GRAFICO - m.arriba - ((v - minimo) / (tope - minimo || 1)) * (ALTO_GRAFICO - m.arriba);
  const yCero = y(0);

  const totalMes = tareas.reduce(
    (t, g) => ({ ctv: t.ctv + (g.subCTV || 0), lm: t.lm + (g.subLM || 0) }),
    { ctv: 0, lm: 0 }
  );
  const difTotalMes = totalMes.ctv - totalMes.lm;

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

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", backgroundColor: "#f8f9fa", height: "100%", overflow: "hidden" }}>
      <Container
        fluid
        className="px-4 py-3 d-flex flex-column flex-grow-1"
        style={{ maxWidth: "1100px", width: "100%", margin: "0 auto", minHeight: 0, overflowY: "auto" }}
      >
        <div className="d-flex align-items-center gap-2 mb-1 flex-wrap">
          <i className="bi bi-graph-up" style={{ color: col.medio, fontSize: "1.15rem" }}></i>
          <span className="fw-bold" style={{ color: col.oscuro, fontSize: "1.05rem" }}>
            Gráficos - {titulo}
          </span>
        </div>
        <div className="mb-3" style={{ fontSize: "0.74rem", color: "#64748b" }}>
          {esMes
            ? "Lo pagado en el mes por Ctv contra lo que LM le pagó al personal."
            : "Precio unitario que paga Ctv contra el que LM le paga al personal."}{" "}
          Diferencia = Ctv − LM; el porcentaje es qué parte de lo que paga Ctv es la diferencia.
          {esMes ? "" : " Una tarea sin partes en el período va con el precio vigente de Variables, marcado «(Variables)»."}
          {fechas ? ` Partes de LM ${fechas}.` : ""}
        </div>

        {/* Las solapas, con el formato de las de la Comparativa. */}
        <div className="d-flex align-items-end gap-1 flex-shrink-0 mb-2">
          {VISTAS.map(([id, rotulo, icono]) => {
            const activa = vista === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => {
                  setVista(id);
                  setEncima(null);
                }}
                className="d-flex align-items-center gap-2 px-3 py-1 fw-semibold"
                style={{
                  fontSize: "0.8rem",
                  border: "1px solid #cbd5e1",
                  borderBottom: activa ? `1px solid ${col.oscuro}` : "1px solid #cbd5e1",
                  borderRadius: "0.5rem",
                  backgroundColor: activa ? col.oscuro : "#fff",
                  color: activa ? "#fff" : "#475569",
                  cursor: activa ? "default" : "pointer",
                }}
              >
                <i className={`bi ${icono}`}></i>
                <span>{rotulo}</span>
              </button>
            );
          })}
        </div>

        {cargando ? (
          <div className="text-center py-5">
            <Spinner animation="border" size="sm" style={{ color: col.medio }} />
          </div>
        ) : (
          <>
            {/* La tabla de precios por tarea de La Martina */}
            <div
              className="shadow-sm bg-white rounded-3 mb-4 flex-shrink-0"
              style={{ border: "1px solid #cbd5e1", overflow: "hidden" }}
            >
              <Table className="mb-0 tabla-informe" style={{ width: "100%" }}>
                <thead>
                  <tr>
                    <th style={{ ...th, textAlign: "left" }}>{esMes ? "Tarea" : "Tarea LM"}</th>
                    <th style={{ ...th, width: "70px" }}>Unidad</th>
                    {esMes ? (
                      <>
                        <th className="col-corte" style={{ ...th, width: "95px" }}>Cant. pagado Ctv</th>
                        <th style={{ ...th, width: "95px" }}>Cant. pagado LM</th>
                        <th className="col-corte" style={{ ...th, width: "125px" }}>Pagado Ctv</th>
                        <th style={{ ...th, width: "125px" }}>Pagado LM</th>
                      </>
                    ) : (
                      <>
                        <th className="col-corte" style={{ ...th, width: "130px" }}>Precio Ctv</th>
                        <th style={{ ...th, width: "130px" }}>Precio LM</th>
                      </>
                    )}
                    <th className="col-corte" style={{ ...th, width: "130px" }}>Diferencia $</th>
                    <th style={{ ...th, width: "100px" }}>Diferencia %</th>
                  </tr>
                </thead>
                <tbody>
                  {!tareas.length ? (
                    <tr>
                      <td colSpan={esMes ? 8 : 6} className="text-muted py-4" style={td}>
                        No hay tareas de La Martina para comparar
                      </td>
                    </tr>
                  ) : (
                    tareas.map((t) => (
                      <tr key={t.clave}>
                        <td style={{ ...td, textAlign: "left", fontWeight: 600, whiteSpace: "normal" }}>
                          <span
                            className={t.sinEquivalencia ? "px-2 rounded-2" : undefined}
                            style={t.sinEquivalencia ? { fontWeight: 700, color: "#92400e", backgroundColor: "#fde68a" } : undefined}
                            title={t.sinEquivalencia ? "Sin equivalencia entre las tareas de Ctv y de LM" : undefined}
                          >
                            {t.tarea}
                          </span>
                        </td>
                        <td style={td}>{t.unidad || raya}</td>
                        {esMes ? (
                          <>
                            <td className="col-corte" style={td}>{cantidad(t.cantCTV) ?? raya}</td>
                            <td style={td}>{cantidad(t.cantLM) ?? raya}</td>
                            <td className="col-corte" style={td}>{pesos(t.subCTV) ?? raya}</td>
                            <td style={td}>{pesos(t.subLM) ?? raya}</td>
                          </>
                        ) : (
                          <>
                        <td className="col-corte" style={td}>{pesos(t.precio) ?? raya}</td>
                        <td
                          style={td}
                          title={
                            t.precioLMVariables
                              ? "Sin partes en el período: precio vigente de Variables de remuneración"
                              : t.variosPreciosLM
                                ? "Promedio: en el mes hubo más de un precio (cliente, vigencia o alto Rto.)"
                                : undefined
                          }
                        >
                          {t.variosPreciosLM && t.precioLM !== null && <span style={{ color: "#64748b" }}>≈ </span>}
                          <span style={t.precioLMVariables ? { color: "#64748b", fontStyle: "italic" } : undefined}>
                            {pesos(t.precioLM) ?? raya}
                          </span>
                          {t.precioLMVariables && (
                            <span className="ms-1" style={{ fontSize: "0.6rem", color: "#94a3b8" }}>
                              (Variables)
                            </span>
                          )}
                        </td>
                          </>
                        )}
                        <td className="col-corte" style={{ ...td, fontWeight: 700, color: colorDif(t.difV) }}>
                          {pesos(t.difV) ?? raya}
                        </td>
                        <td style={{ ...td, fontWeight: 700, color: colorDif(t.pct) }}>{porcentaje(t.pct) ?? raya}</td>
                      </tr>
                    ))
                  )}
                  {esMes && tareas.length > 0 && (
                    <tr className="fila-total">
                      <td style={{ ...td, textAlign: "left", fontWeight: 700, color: col.oscuro }}>TOTAL</td>
                      <td style={td}></td>
                      <td className="col-corte" style={td}></td>
                      <td style={td}></td>
                      <td className="col-corte" style={{ ...td, fontWeight: 700 }}>{pesos(totalMes.ctv)}</td>
                      <td style={{ ...td, fontWeight: 700 }}>{pesos(totalMes.lm)}</td>
                      <td className="col-corte" style={{ ...td, fontWeight: 700, color: colorDif(difTotalMes) }}>
                        {pesos(difTotalMes)}
                      </td>
                      <td style={{ ...td, fontWeight: 700, color: colorDif(difTotalMes) }}>
                        {totalMes.ctv ? porcentaje((difTotalMes / totalMes.ctv) * 100) : raya}
                      </td>
                    </tr>
                  )}
                </tbody>
              </Table>
            </div>

            {/* El switch $ / %, arriba a la derecha del gráfico, como en los
                informes. En el total del mes no va: queda en pesos. */}
            <div
              className="d-flex align-items-center justify-content-end gap-2 mb-2"
              style={{ fontSize: "1rem", visibility: esMes ? "hidden" : "visible" }}
            >
              <span style={{ color: enPorcentaje ? TEXTO_SUAVE : col.oscuro, fontWeight: enPorcentaje ? 400 : 700 }}>$</span>
              <Form.Check
                type="switch"
                id={idSwitch}
                checked={porcentajeElegido}
                onChange={(e) => {
                  setEnPorcentaje(e.target.checked);
                  setEncima(null);
                }}
                className="mb-0"
                style={{ fontSize: "1.45rem", lineHeight: 1 }}
                title="Cambiar entre la diferencia en pesos y en porcentaje"
              />
              <span style={{ color: enPorcentaje ? col.oscuro : TEXTO_SUAVE, fontWeight: enPorcentaje ? 700 : 400 }}>%</span>
            </div>

            <div
              className="bg-white rounded-3 shadow-sm d-flex flex-column flex-shrink-0 mb-2"
              style={{ border: `2px solid ${col.oscuro}` }}
            >
              <div className="d-flex align-items-center gap-2 px-2" style={{ height: 38, borderBottom: "1px solid #e2e8f0" }}>
                <span className="fw-bold text-truncate" style={{ color: col.oscuro, fontSize: "0.95rem" }}>
                  {esMes ? "Diferencia de lo pagado en el mes Ctv − LM" : "Diferencia de precio unitario Ctv − LM"}
                  <span className="fw-normal ms-1" style={{ color: TEXTO, fontSize: "0.74rem" }}>
                    ({enPorcentaje ? "% de lo que paga Ctv" : esMes ? "$ del mes" : "$ por unidad"})
                  </span>
                </span>
              </div>

              <div ref={refCaja} className="position-relative" style={{ height: datos.length ? altoSvg : 160 }}>
                {datos.length === 0 ? (
                  <div className="d-flex align-items-center justify-content-center h-100 text-muted" style={{ fontSize: "0.76rem" }}>
                    {esMes ? "No hay nada pagado en el mes" : "Ninguna tarea tiene los dos precios"}
                  </div>
                ) : (
                  ancho > 0 && (
                    <svg width={ancho} height={altoSvg} style={{ display: "block" }} onMouseLeave={() => setEncima(null)}>
                      {escala.map((v) => (
                        <g key={v}>
                          <line
                            x1={m.izquierda}
                            x2={ancho - m.derecha}
                            y1={y(v)}
                            y2={y(v)}
                            stroke={v === 0 ? "#94a3b8" : GRILLA}
                            strokeWidth={1}
                          />
                          <text x={m.izquierda - 6} y={y(v) + 3} textAnchor="end" fontSize="10" fill={TEXTO_SUAVE}>
                            {formato(v)}
                          </text>
                        </g>
                      ))}
                      {datos.map((d, i) => {
                        const valor = d[campo];
                        const negativa = valor < 0;
                        const xBanda = m.izquierda + i * pasoX;
                        const x = xBanda + (pasoX - anchoBarra) / 2;
                        const xCentro = xBanda + pasoX / 2;
                        const alto = Math.max(1, Math.abs(y(valor) - yCero));
                        const activa = encima?.clave === d.clave;
                        const color = negativa ? (activa ? ROJO_HOVER : ROJO) : activa ? VERDE_HOVER : VERDE;
                        const yValor = negativa ? yCero + alto + 11 : yCero - alto - 4;
                        const yNombre = ALTO_GRAFICO + 14;
                        return (
                          <g key={d.clave}>
                            <path d={caminoBarra(x, yCero, anchoBarra, alto, negativa)} fill={color} />
                            {conValor && (
                              <text x={xCentro} y={yValor} textAnchor="middle" fontSize="9.5" fill={TEXTO}>
                                {formato(valor)}
                              </text>
                            )}
                            {/* Girado 90°: cada renglón queda al lado del otro,
                                centrados bajo la barra. */}
                            <text
                              fontSize="9.5"
                              fontWeight="700"
                              fill={col.oscuro}
                              textAnchor="end"
                              transform={`translate(${xCentro} ${yNombre}) rotate(-90)`}
                            >
                              <title>{d.tarea}</title>
                              {(nombres.get(d.clave) || []).map((linea, j, todas) => (
                                <tspan key={j} x={0} y={(j - (todas.length - 1) / 2) * ALTO_RENGLON + 3.5}>
                                  {linea}
                                </tspan>
                              ))}
                            </text>
                            <rect
                              x={xBanda}
                              y={m.arriba}
                              width={pasoX}
                              height={ALTO_GRAFICO - m.arriba}
                              fill="transparent"
                              onMouseEnter={() => setEncima({ ...d, x: xCentro, y: negativa ? yCero : yCero - alto })}
                            />
                          </g>
                        );
                      })}
                    </svg>
                  )
                )}

                {encima && (
                  <div
                    className="position-absolute rounded-2 shadow-sm px-2 py-1"
                    style={{
                      left: Math.min(Math.max(encima.x, 110), ancho - 110),
                      top: encima.y < 80 ? encima.y + 8 : encima.y - 8,
                      transform: encima.y < 80 ? "translate(-50%, 0)" : "translate(-50%, -100%)",
                      background: "#fff",
                      border: "1px solid #e2e8f0",
                      fontSize: "0.72rem",
                      pointerEvents: "none",
                      whiteSpace: "nowrap",
                    }}
                  >
                    <div className="fw-bold" style={{ color: "#0f172a" }}>
                      {encima.tarea}
                    </div>
                    <div style={{ color: TEXTO }}>
                      {esMes ? (
                        <>
                          Ctv {pesos(encima.subCTV) ?? "$ 0,00"} · LM {pesos(encima.subLM) ?? "$ 0,00"}
                        </>
                      ) : (
                        <>
                          Ctv {pesos(encima.precio)} · LM {encima.variosPreciosLM ? "≈ " : ""}
                          {pesos(encima.precioLM)}
                          {encima.precioLMVariables ? " (de Variables, sin partes)" : ""}
                        </>
                      )}
                    </div>
                    <div className="fw-bold" style={{ color: colorDif(encima.difV) }}>
                      {pesos(encima.difV)}
                      {encima.pct !== null ? ` · ${porcentaje(encima.pct)}` : ""}
                    </div>
                  </div>
                )}
              </div>

              {sinDato > 0 && datos.length > 0 && (
                <div className="px-2 pb-1" style={{ fontSize: "0.66rem", color: TEXTO_SUAVE }}>
                  {sinDato} {sinDato === 1 ? "tarea no tiene" : "tareas no tienen"}{" "}
                  {esMes ? "nada pagado" : "uno de los dos precios"}: no aparecen.
                </div>
              )}
            </div>

            {/* La torta del total del mes: cómo se repartió la diferencia. */}
            {esMes && <TortaDiferencias tareas={tareas} col={col} />}
          </>
        )}
      </Container>
    </div>
  );
}

export default ContableGraficosCostos;
