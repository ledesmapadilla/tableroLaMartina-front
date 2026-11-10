import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { Button, Card, Container, Form, Spinner, Table } from "react-bootstrap";
import Swal from "sweetalert2";
import { descargar, nuevoWorkbook } from "../../helpers/excel";
import { CLIENTE_POR_DEFECTO, claveCliente, clienteDe, useClientes } from "../../utils/clientes";

/**
 * Reporte mensual (07/11/2026), del botón al lado de Jornalizados en la
 * planilla de partes: todos los partes del período del campo, separados por
 * tarea. Cada tarea es un renglón de título y adentro va un renglón por día y
 * lote (sumando a todas las personas) con fecha, tarea, lote, cantidad y
 * unidad, y al final el total de la tarea. Un parte de varios lotes va con
 * todos sus lotes en el mismo renglón ("11, 19").
 *
 * Los partes son los mismos de la planilla: los del período de la
 * certificación, con los posteriores al cierre que se dejaron en el mes.
 * "Uso interno" no es una persona y no entra (27/10/2026). Un parte cuya
 * tarea se borró va en "Sin tarea", para que se vea y se corrija.
 */

const COLOR = "#1b4332";
const MESES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];
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
const td = { fontSize: "0.7rem", padding: "1px 5px", verticalAlign: "middle", textAlign: "center" };
const raya = <span style={{ color: "#cbd5e1" }}>—</span>;
const SIN_TAREA = "Sin tarea";
// El valor del filtro de cliente que trae todos los partes.
const TODOS = "";

const soloFecha = (f) => String(f || "").slice(0, 10);
const fechaCorta = (f) => {
  const [a, m, d] = soloFecha(f).split("-");
  return d ? `${d}/${m}/${a}` : "";
};
// Los lotes de un parte, como en la planilla (lotesDelParte): los de `lotes`
// si tiene varios, si no el de `lote`.
const lotesTexto = (p) =>
  (Array.isArray(p?.lotes) && p.lotes.length ? p.lotes.map((l) => l.lote) : [p?.lote])
    .map((l) => String(l || "").trim())
    .filter(Boolean)
    .join(", ");
// El formato de la cantidad en el Excel: "#,##0.###" deja la coma sola en un
// entero ("8,"), así que los enteros van sin decimales (07/11/2026).
const formatoCant = (v) => (Number.isInteger(Math.round(v * 1000) / 1000) ? "#,##0" : "#,##0.###");
// La cantidad redondeada a tres decimales: una suma con arrastre (2854,0000001)
// no deja de ser entera.
const redondear = (v) => (typeof v === "number" ? Math.round(v * 1000) / 1000 : v);
const cantidad = (n) => (n === null || n === undefined ? null : n.toLocaleString("es-AR", { maximumFractionDigits: 3 }));

function ProduccionReporteMensual({ establecimiento = "caspinchango" }) {
  const { anio, mes } = useParams();
  // { clave del rango que se pidió, lista }
  const [partes, setPartes] = useState({ clave: "", lista: [] });
  const [periodo, setPeriodo] = useState(null);
  // El filtro Desde / Hasta (07/11/2026): arranca con las fechas de la
  // certificación y se puede cambiar para traer más o menos días.
  const [rango, setRango] = useState(null);
  // No se pudo traer el período: no hay nada que esperar.
  const [sinPeriodo, setSinPeriodo] = useState(false);
  // El filtro de cliente (10/11/2026): arranca en Citrusvil. Un parte sin
  // cliente cuenta como Citrusvil, igual que en la planilla.
  const [cliente, setCliente] = useState(CLIENTE_POR_DEFECTO);
  const { activos: clientesActivos } = useClientes();

  const campo = establecimiento === "san-pablo" ? "San Pablo" : "Berdina";
  const titulo = `${campo} - ${MESES[Number(mes) - 1] || ""} ${anio}`;
  const clavePeriodo = `${anio}-${String(mes).padStart(2, "0")}`;
  const q = `establecimiento=${establecimiento}`;

  useEffect(() => {
    let vigente = true;
    fetch(`/api/periodos/${anio}/${mes}?${q}`)
      .then((r) => r.json())
      .then((p) => {
        if (!vigente) return;
        const fechas = { desde: soloFecha(p?.desde), hasta: soloFecha(p?.hasta) };
        setPeriodo(fechas);
        setRango(fechas);
      })
      .catch(() => {
        if (!vigente) return;
        setPeriodo({ desde: "", hasta: "" });
        setSinPeriodo(true);
      });
    return () => {
      vigente = false;
    };
  }, [anio, mes, q]);

  // Un rango que se puede pedir: las dos fechas completas y en orden. Mientras
  // se escribe una fecha a medias no se pide nada.
  const fechaCompleta = (f) => /^(19|20)\d{2}-\d{2}-\d{2}$/.test(f || "");
  const rangoValido = !!rango && fechaCompleta(rango.desde) && fechaCompleta(rango.hasta) && rango.desde <= rango.hasta;
  // Con las fechas de la certificación van los mismos partes de la planilla
  // (también los posteriores al cierre que se dejaron en el mes); con otras
  // fechas, todos los partes del rango.
  const esPeriodo = !!periodo && !!rango && rango.desde === periodo.desde && rango.hasta === periodo.hasta;

  // Los partes llegan con el rango que se pidió: mientras no sean los del rango
  // elegido, se está cargando.
  const claveRango = rangoValido ? `${rango.desde}|${rango.hasta}|${esPeriodo ? clavePeriodo : ""}` : "";
  useEffect(() => {
    if (!claveRango) return;
    let vigente = true;
    const [desde, hasta, per] = claveRango.split("|");
    fetch(`/api/partes?desde=${desde}&hasta=${hasta}${per ? `&periodo=${per}` : ""}&resumen=1&${q}`)
      .then((r) => (r.ok ? r.json() : []))
      .then((lista) => vigente && setPartes({ clave: claveRango, lista: Array.isArray(lista) ? lista : [] }))
      .catch(() => vigente && setPartes({ clave: claveRango, lista: [] }));
    return () => {
      vigente = false;
    };
  }, [claveRango, q]);
  const cargando = !sinPeriodo && (!claveRango ? !rango : partes.clave !== claveRango);

  // Las opciones del filtro de cliente: los del padrón y los que aparecen en
  // los partes del rango (un cliente inactivo con partes también se puede ver).
  const opcionesCliente = useMemo(() => {
    const lista = [...clientesActivos];
    for (const c of [CLIENTE_POR_DEFECTO, ...partes.lista.map(clienteDe)]) {
      if (!lista.some((x) => claveCliente(x) === claveCliente(c))) lista.push(c);
    }
    return lista.sort((a, b) => a.localeCompare(b, "es", { sensitivity: "base" }));
  }, [clientesActivos, partes]);

  // [{ tarea, unidad, dias: [{ fecha, lote, cantidad }], total, conCantidad }]
  const grupos = useMemo(() => {
    const porTarea = new Map();
    for (const p of partes.lista) {
      if (p.persona?.usoInterno) continue;
      if (cliente !== TODOS && claveCliente(clienteDe(p)) !== claveCliente(cliente)) continue;
      const nombre = p.tarea?.tarea || SIN_TAREA;
      const clave = p.tarea?._id || SIN_TAREA;
      let g = porTarea.get(clave);
      if (!g) {
        g = { clave, tarea: nombre, unidad: p.tarea?.unidad || "", dias: new Map(), total: 0, conCantidad: false };
        porTarea.set(clave, g);
      }
      const f = soloFecha(p.fecha);
      const lote = lotesTexto(p);
      const claveDia = `${f}|${lote}`;
      const d = g.dias.get(claveDia) || { clave: claveDia, fecha: f, lote, cantidad: null };
      if (p.cantidad !== null && p.cantidad !== undefined && p.cantidad !== "") {
        d.cantidad = (d.cantidad || 0) + Number(p.cantidad);
        g.total += Number(p.cantidad);
        g.conCantidad = true;
      }
      g.dias.set(claveDia, d);
    }
    return (
      [...porTarea.values()]
        .map((g) => ({
          ...g,
          dias: [...g.dias.values()].sort(
            (a, b) => a.fecha.localeCompare(b.fecha) || a.lote.localeCompare(b.lote, "es", { numeric: true })
          ),
        }))
        // "Sin tarea" al final, para que se vea aparte.
        .sort((a, b) =>
          a.tarea === SIN_TAREA
            ? 1
            : b.tarea === SIN_TAREA
              ? -1
              : a.tarea.localeCompare(b.tarea, "es", { sensitivity: "base" })
        )
    );
  }, [partes, cliente]);

  /**
   * El Excel igual que la pantalla (07/11/2026): cada tarea con su renglón de
   * título verde claro, los días adentro y el "Total <tarea>" a la derecha,
   * pegado a los valores, con la línea gruesa arriba como la fila de total.
   */
  const exportarExcel = async () => {
    try {
      const wb = await nuevoWorkbook();
      const ws = wb.addWorksheet("Reporte mensual");
      const N = 5;
      const fino = { style: "thin", color: { argb: "FFE2E8F0" } };
      const bordes = { top: fino, bottom: fino, left: fino, right: fino };
      const grueso = { style: "medium", color: { argb: "FF1B4332" } };

      ws.mergeCells(1, 1, 1, N);
      const t = ws.getCell("A1");
      t.value = `Reporte mensual — ${titulo}`;
      t.font = { bold: true, size: 14, color: { argb: "FF1B4332" } };
      t.alignment = { horizontal: "center", vertical: "middle" };
      ws.getRow(1).height = 24;

      ws.mergeCells(2, 1, 2, N);
      const sub = ws.getCell("A2");
      sub.value = `${rango?.desde ? `Del ${fechaCorta(rango.desde)} al ${fechaCorta(rango.hasta)}${esPeriodo ? " (período de la certificación)" : ""} · ` : ""}Cliente: ${cliente || "Todos"} · Fecha de emisión: ${new Date().toLocaleDateString("es-AR")}`;
      sub.font = { italic: true, size: 10, color: { argb: "FF64748B" } };
      sub.alignment = { horizontal: "center", vertical: "middle" };
      ws.addRow([]);

      const enc = ws.addRow(["Fecha", "Tarea", "Lote", "Cant.", "Unidad"]);
      enc.height = 20;
      enc.eachCell((c) => {
        c.font = { bold: true, color: { argb: "FFFFFFFF" } };
        c.alignment = { horizontal: "center", vertical: "middle" };
        c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1B4332" } };
      });

      for (const g of grupos) {
        const sinTarea = g.tarea === SIN_TAREA;
        // El título de la tarea, cruzando todas las columnas.
        const filaTitulo = ws.addRow([g.tarea]);
        ws.mergeCells(filaTitulo.number, 1, filaTitulo.number, N);
        const ct = filaTitulo.getCell(1);
        ct.font = { bold: true, color: { argb: sinTarea ? "FF92400E" : "FF1B4332" } };
        ct.fill = { type: "pattern", pattern: "solid", fgColor: { argb: sinTarea ? "FFFDE68A" : "FFE8F5EE" } };
        ct.alignment = { horizontal: "left", vertical: "middle" };
        ct.border = { ...bordes, top: { style: "medium", color: { argb: sinTarea ? "FFD97706" : "FF1B4332" } } };

        for (const d of g.dias) {
          const fila = ws.addRow([fechaCorta(d.fecha), g.tarea, d.lote || "—", redondear(d.cantidad) ?? "—", g.unidad || "—"]);
          fila.eachCell({ includeEmpty: true }, (c, nro) => {
            c.alignment = { horizontal: nro === 2 ? "left" : "center", vertical: "middle" };
            c.border = bordes;
            if (nro === 4 && typeof c.value === "number") c.numFmt = formatoCant(c.value);
          });
        }

        // El total: el rótulo a la derecha, pegado a los valores.
        const filaTotal = ws.addRow([`Total ${g.tarea}`, "", "", g.conCantidad ? redondear(g.total) : "—", g.unidad || "—"]);
        ws.mergeCells(filaTotal.number, 1, filaTotal.number, 3);
        filaTotal.eachCell({ includeEmpty: true }, (c, nro) => {
          c.font = { bold: true, color: { argb: nro === 1 ? "FF1B4332" : "FF000000" } };
          c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE8F5EE" } };
          c.alignment = { horizontal: nro === 1 ? "right" : "center", vertical: "middle" };
          c.border = { ...bordes, top: grueso };
          if (nro === 4 && typeof c.value === "number") c.numFmt = formatoCant(c.value);
        });
      }

      ws.columns = [{ width: 14 }, { width: 42 }, { width: 14 }, { width: 12 }, { width: 12 }];
      await descargar(wb, `Reporte mensual ${titulo}.xlsx`);
    } catch (err) {
      Swal.fire({ icon: "error", title: "No se pudo exportar", text: err.message, width: "300px" });
    }
  };

  return (
    <div
      style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        backgroundColor: "#f8f9fa",
        height: "100%",
        overflow: "hidden",
      }}
    >
      <Container
        fluid
        className="px-4 py-3 d-flex flex-column flex-grow-1"
        style={{ maxWidth: "900px", width: "100%", margin: "0 auto", minHeight: 0 }}
      >
        {/* Encabezado: título, período y Excel. */}
        <div className="d-flex align-items-center gap-3 mb-3 flex-wrap">
          <span className="fw-bold d-flex align-items-center gap-2" style={{ color: COLOR, fontSize: "1.05rem" }}>
            <i className="bi bi-journal-text"></i>
            Reporte mensual - {titulo}
          </span>
          <Button
            size="sm"
            onClick={exportarExcel}
            disabled={cargando || !grupos.length}
            className="rounded-3 px-3 d-flex align-items-center gap-2 ms-auto"
            style={{ backgroundColor: "#15803d", borderColor: "#15803d", fontSize: "0.78rem", height: "30px", fontWeight: 600 }}
            title="Exportar el reporte a Excel"
          >
            <i className="bi bi-file-earmark-excel-fill"></i>
            <span>Excel</span>
          </Button>
        </div>

        {/* Filtro Desde / Hasta (07/11/2026). */}
        <Card className="mb-3 p-2 shadow-sm border-0 rounded-3 flex-shrink-0">
          <div className="d-flex align-items-end gap-3 flex-wrap">
            {[
              ["desde", "Desde"],
              ["hasta", "Hasta"],
            ].map(([k, rotulo]) => (
              <div key={k}>
                <Form.Label className="fw-semibold text-dark mb-1" style={{ fontSize: "0.74rem" }}>
                  {rotulo}
                </Form.Label>
                <Form.Control
                  type="date"
                  size="sm"
                  value={rango?.[k] || ""}
                  onChange={(e) => setRango((r) => ({ ...r, [k]: e.target.value }))}
                  disabled={!rango}
                  className="text-center"
                  style={{
                    width: "140px",
                    fontSize: "0.78rem",
                    // Distinta de la certificación: se marca, como un filtro activo.
                    ...(periodo && rango && rango[k] !== periodo[k] ? { color: "#dc2626", fontWeight: 700 } : {}),
                  }}
                />
              </div>
            ))}
            <div>
              <Form.Label className="fw-semibold text-dark mb-1" style={{ fontSize: "0.74rem" }}>
                Cliente
              </Form.Label>
              <Form.Select
                size="sm"
                value={cliente}
                onChange={(e) => setCliente(e.target.value)}
                style={{
                  width: "160px",
                  fontSize: "0.78rem",
                  // Distinto de Citrusvil: se marca, como un filtro activo.
                  ...(claveCliente(cliente) !== claveCliente(CLIENTE_POR_DEFECTO) ? { color: "#dc2626", fontWeight: 700 } : {}),
                }}
              >
                {opcionesCliente.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
                <option value={TODOS}>Todos</option>
              </Form.Select>
            </div>
            {rango && !esPeriodo && (
              <Button
                size="sm"
                variant="outline-secondary"
                onClick={() => setRango(periodo)}
                className="rounded-3 px-3 d-flex align-items-center gap-2"
                style={{ fontSize: "0.76rem", height: "30px" }}
                title="Volver a las fechas de la certificación"
              >
                <i className="bi bi-arrow-counterclockwise"></i>
                <span>Período de la certificación</span>
              </Button>
            )}
            {rango && !rangoValido && (
              <span style={{ fontSize: "0.74rem", color: "#dc2626" }}>
                Completá las dos fechas (Desde no puede ser posterior a Hasta).
              </span>
            )}
          </div>
        </Card>

        <div
          className="shadow-sm rounded-3 bg-white"
          style={{
            flex: "1 1 auto",
            minHeight: 0,
            maxWidth: "100%",
            overflowY: "auto",
            overflowX: "auto",
            border: "1px solid #cbd5e1",
          }}
        >
          <Table className="mb-0 tabla-informe" style={{ width: "100%" }}>
            <thead style={{ position: "sticky", top: 0, zIndex: 10, backgroundColor: COLOR, color: "#fff" }}>
              <tr>
                <th style={{ ...th, width: "110px" }}>Fecha</th>
                <th style={{ ...th, textAlign: "left" }}>Tarea</th>
                <th style={{ ...th, width: "90px" }}>Lote</th>
                <th style={{ ...th, width: "100px" }}>Cant.</th>
                <th style={{ ...th, width: "90px" }}>Unidad</th>
              </tr>
            </thead>
            <tbody>
              {cargando ? (
                <tr>
                  <td colSpan={5} className="text-center text-muted py-4" style={td}>
                    <Spinner animation="border" size="sm" style={{ color: COLOR }} />
                  </td>
                </tr>
              ) : !grupos.length ? (
                <tr>
                  <td colSpan={5} className="text-center text-muted py-4" style={td}>
                    No hay partes cargados en este período{cliente ? ` para ${cliente}` : ""}
                  </td>
                </tr>
              ) : (
                grupos.map((g) => <GrupoTarea key={g.clave} g={g} />)
              )}
            </tbody>
          </Table>
        </div>
      </Container>
    </div>
  );
}

// Una tarea: su renglón de título, un renglón por día y lote, y su total.
function GrupoTarea({ g }) {
  const sinTarea = g.tarea === SIN_TAREA;
  return (
    <>
      <tr>
        <td
          colSpan={5}
          style={{
            ...td,
            textAlign: "left",
            fontWeight: 700,
            fontSize: "0.74rem",
            color: sinTarea ? "#92400e" : COLOR,
            backgroundColor: sinTarea ? "#fde68a" : "#e8f5ee",
            borderTop: `2px solid ${sinTarea ? "#d97706" : COLOR}`,
          }}
          title={sinTarea ? "Partes cuya tarea se borró o no tienen: hay que corregirlos en la planilla" : undefined}
        >
          {g.tarea}
        </td>
      </tr>
      {g.dias.map((d) => (
        <tr key={d.clave}>
          <td style={td}>{fechaCorta(d.fecha)}</td>
          <td style={{ ...td, textAlign: "left" }}>{g.tarea}</td>
          <td style={td}>{d.lote || raya}</td>
          <td style={td}>{cantidad(d.cantidad) ?? raya}</td>
          <td style={td}>{g.unidad || raya}</td>
        </tr>
      ))}
      <tr className="fila-total">
        {/* El rótulo a la derecha, pegado a los valores. */}
        <td colSpan={3} style={{ ...td, textAlign: "right", fontWeight: 700, color: COLOR }}>
          Total {g.tarea}
        </td>
        <td style={{ ...td, fontWeight: 700 }}>{g.conCantidad ? cantidad(g.total) : raya}</td>
        <td style={{ ...td, fontWeight: 700 }}>{g.unidad || raya}</td>
      </tr>
    </>
  );
}

export default ProduccionReporteMensual;
