import { Fragment, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Button, Card, Container, Form, Table } from "react-bootstrap";
import { nuevoWorkbook } from "../../helpers/excel";

const MESES = [
  "Enero",
  "Febrero",
  "Marzo",
  "Abril",
  "Mayo",
  "Junio",
  "Julio",
  "Agosto",
  "Septiembre",
  "Octubre",
  "Noviembre",
  "Diciembre",
];

const soloFecha = (iso) => (iso || "").slice(0, 10);

const hoyStr = () => {
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${dd}`;
};

const formatFecha = (iso) => {
  const [a, m, d] = soloFecha(iso).split("-");
  return d ? `${d}/${m}/${a}` : "—";
};

const nf = new Intl.NumberFormat("es-AR", { maximumFractionDigits: 2 });
const numero = (v) => (v === null || v === undefined ? "—" : nf.format(v));
const redondear = (v) => Math.round((Number(v) || 0) * 100) / 100;

const pesos = (n) =>
  (Number(n) || 0).toLocaleString("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 2,
  });

/**
 * Precio unitario de cada tarea, por id de tarea.
 *
 * Estos valores se establecen en **Variables** del mes
 * (`/produccion/certificados/:anio/:mes/variables`), que todavía no tiene
 * pantalla ni endpoint. Hasta que exista, el mapa llega vacío y las dos
 * columnas de precio muestran una raya; cuando esté, alcanza con cargarlo
 * desde ahí y el resto del informe ya calcula solo.
 */
const PRECIOS_POR_TAREA = {};

const comparar = (a, b) => String(a).localeCompare(String(b), "es", { sensitivity: "base" });
const compararCC = (a, b) =>
  String(a).localeCompare(String(b), "es", { numeric: true, sensitivity: "base" });

// Mismo desplegable de filtro que el resto de Producción: se pinta en rojo
// cuando está activo y suma una cruz para limpiarlo.
const FiltroSelect = ({ etiqueta, ancho, valor, vacio, onChange, opciones }) => {
  const activo = valor !== vacio;
  return (
    <div className="d-flex align-items-center gap-2">
      <span className="fw-bold text-dark small flex-shrink-0" style={{ fontSize: "0.8rem" }}>
        {etiqueta}:
      </span>
      <div className="input-group input-group-sm" style={{ width: ancho }}>
        <Form.Select
          size="sm"
          value={valor}
          onChange={(e) => onChange(e.target.value)}
          className={`rounded-3 ${activo ? "rounded-end-0 border-end-0 fw-bold filtro-activo" : ""}`}
          style={{
            fontSize: "0.82rem",
            height: "32px",
            padding: "3px 24px 3px 8px",
            color: activo ? "#dc2626" : "#1e293b",
            fontWeight: activo ? "700" : "normal",
          }}
        >
          <option value={vacio}>{vacio}</option>
          {opciones.map(([id, texto]) => (
            <option key={id} value={id}>
              {texto}
            </option>
          ))}
        </Form.Select>
        {activo && (
          <button
            className="btn btn-outline-secondary border-start-0 d-flex align-items-center justify-content-center"
            type="button"
            onClick={() => onChange(vacio)}
            title={`Limpiar filtro ${etiqueta.toLowerCase()}`}
            style={{ padding: "0 6px", height: "32px" }}
          >
            <i className="bi bi-x" style={{ fontSize: "0.9rem" }}></i>
          </button>
        )}
      </div>
    </div>
  );
};

function ProduccionInformeTareasPersonal() {
  const { anio, mes } = useParams();
  const navigate = useNavigate();

  const [periodo, setPeriodo] = useState({ desde: "", hasta: "" });
  const [cerrado, setCerrado] = useState(false);
  const [partes, setPartes] = useState([]);
  const [cargando, setCargando] = useState(true);

  const [filtroFecha, setFiltroFecha] = useState("");
  const [filtroPersona, setFiltroPersona] = useState("Todos");
  const [filtroCC, setFiltroCC] = useState("Todos");
  const [filtroTarea, setFiltroTarea] = useState("Todas");

  const hayFiltro =
    Boolean(filtroFecha) ||
    filtroPersona !== "Todos" ||
    filtroCC !== "Todos" ||
    filtroTarea !== "Todas";

  const titulo = `${MESES[Number(mes) - 1] || ""} ${anio}`;

  useEffect(() => {
    (async () => {
      setCargando(true);
      try {
        const res = await fetch(`/api/periodos/${anio}/${mes}`);
        const data = await res.json();
        const estaCerrado = Boolean(data.cerrado);
        // Mientras la certificación está abierta el período llega hasta hoy,
        // igual que en la planilla de carga.
        const rango = {
          desde: soloFecha(data.desde),
          hasta: estaCerrado ? soloFecha(data.hasta) : hoyStr(),
        };
        setCerrado(estaCerrado);
        setPeriodo(rango);

        const resPartes = await fetch(`/api/partes?desde=${rango.desde}&hasta=${rango.hasta}`);
        const lista = resPartes.ok ? await resPartes.json() : [];
        setPartes(Array.isArray(lista) ? lista : []);
      } catch {
        setPartes([]);
      } finally {
        setCargando(false);
      }
    })();
  }, [anio, mes]);

  // Los filtros recortan los partes antes de sumar: la tabla y el Excel
  // muestran siempre lo mismo que se está mirando.
  const partesFiltrados = useMemo(
    () =>
      partes.filter((p) => {
        if (filtroFecha && soloFecha(p.fecha) !== filtroFecha) return false;
        if (filtroPersona !== "Todos" && (p.persona?._id || "") !== filtroPersona) return false;
        if (filtroTarea !== "Todas" && (p.tarea?._id || "") !== filtroTarea) return false;
        if (filtroCC !== "Todos" && p.cc?.cc !== filtroCC && (p.turbo || "").trim() !== filtroCC) {
          return false;
        }
        return true;
      }),
    [partes, filtroFecha, filtroPersona, filtroCC, filtroTarea]
  );

  // Las opciones salen de todo el período, no de lo ya filtrado: si no, elegir
  // una persona vaciaría el resto de los desplegables.
  const personasDelPeriodo = useMemo(() => {
    const m = new Map();
    partes.forEach((p) => p.persona && m.set(p.persona._id, p.persona.apellidoNombre));
    return [...m.entries()].sort((a, b) => comparar(a[1], b[1]));
  }, [partes]);

  const tareasDelPeriodo = useMemo(() => {
    const m = new Map();
    partes.forEach((p) => p.tarea && m.set(p.tarea._id, p.tarea.tarea));
    return [...m.entries()].sort((a, b) => comparar(a[1], b[1]));
  }, [partes]);

  const ccsDelPeriodo = useMemo(() => {
    const codigos = new Set();
    partes.forEach((p) => {
      if (p.cc?.cc) codigos.add(p.cc.cc);
      const turbo = (p.turbo || "").trim();
      if (turbo) codigos.add(turbo);
    });
    return [...codigos].sort(compararCC).map((c) => [c, c]);
  }, [partes]);

  /**
   * Una fila por persona y tarea con la cantidad acumulada del período y su
   * importe.
   *
   * Las cantidades solo se suman dentro de la misma tarea: cada una tiene su
   * unidad (horas, plantas, bins) y mezclarlas no significaría nada. La plata
   * sí, así que el total de cada persona va en la columna de precio total.
   */
  const { filas, totalPorPersona } = useMemo(() => {
    const mapa = new Map();

    for (const p of partesFiltrados) {
      const idPersona = p.persona?._id || "sin-persona";
      const idTarea = p.tarea?._id || "sin-tarea";
      const clave = `${idPersona}|${idTarea}`;
      if (!mapa.has(clave)) {
        mapa.set(clave, {
          clave,
          idPersona,
          idTarea,
          persona: p.persona?.apellidoNombre || "(sin persona)",
          tarea: p.tarea?.tarea || "(sin tarea)",
          unidad: p.tarea?.unidad || "",
          cantidad: 0,
        });
      }
      mapa.get(clave).cantidad += Number(p.cantidad) || 0;
    }

    const lista = [...mapa.values()]
      .map((f) => {
        const cantidad = redondear(f.cantidad);
        // Sin precio cargado en Variables no hay importe que mostrar: va una
        // raya, no un cero que parezca trabajo sin costo.
        const precio = PRECIOS_POR_TAREA[f.idTarea] ?? null;
        return {
          ...f,
          cantidad,
          precio,
          importe: precio === null ? null : redondear(cantidad * precio),
        };
      })
      .sort((a, b) => comparar(a.persona, b.persona) || comparar(a.tarea, b.tarea));

    // El total de una persona suma solo las tareas con precio cargado; si no
    // tiene ninguno, no hay total que mostrar.
    const totales = new Map();
    for (const f of lista) {
      if (f.importe === null) continue;
      totales.set(f.idPersona, redondear((totales.get(f.idPersona) || 0) + f.importe));
    }

    return { filas: lista, totalPorPersona: totales };
  }, [partesFiltrados]);

  const exportarExcel = async () => {
    const wb = await nuevoWorkbook();
    const ws = wb.addWorksheet("Tareas por personal");
    const columnas = ["Personal", "Tarea", "Unidad", "Cantidad", "$ unitario", "$ total"];

    ws.mergeCells(1, 1, 1, columnas.length);
    const celdaTitulo = ws.getCell("A1");
    celdaTitulo.value = `TAREAS POR PERSONAL - ${titulo.toUpperCase()}`;
    celdaTitulo.font = { bold: true, size: 14 };
    celdaTitulo.alignment = { horizontal: "center", vertical: "middle" };
    ws.getRow(1).height = 28;

    ws.mergeCells(2, 1, 2, columnas.length);
    const celdaPeriodo = ws.getCell("A2");
    celdaPeriodo.value =
      `Período: ${formatFecha(periodo.desde)} al ${formatFecha(periodo.hasta)}` +
      (cerrado ? "  —  CERRADA" : "  —  abierta, llega hasta hoy");
    celdaPeriodo.font = { bold: true, size: 11 };

    ws.addRow([]);

    const filaEnc = ws.addRow(columnas);
    filaEnc.eachCell((cell) => {
      cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
      cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1B4332" } };
      cell.border = {
        top: { style: "thin", color: { argb: "FFA0A0A0" } },
        left: { style: "thin", color: { argb: "FFA0A0A0" } },
        bottom: { style: "medium", color: { argb: "FF808080" } },
        right: { style: "thin", color: { argb: "FFA0A0A0" } },
      };
    });
    ws.getRow(4).height = 22;

    filas.forEach((f, idx) => {
      const ultimaDePersona = idx === filas.length - 1 || filas[idx + 1].idPersona !== f.idPersona;
      const fila = ws.addRow([
        f.persona,
        f.tarea,
        f.unidad || "—",
        f.cantidad || null,
        f.precio,
        f.importe,
      ]);
      fila.eachCell({ includeEmpty: true }, (cell, colNumber) => {
        cell.border = {
          top: { style: "thin", color: { argb: "FFE2E8F0" } },
          // La columna del importe se separa con una línea fuerte, igual que
          // en pantalla.
          left:
            colNumber === 6
              ? { style: "medium", color: { argb: "FF1B4332" } }
              : { style: "thin", color: { argb: "FFE2E8F0" } },
          bottom: { style: "thin", color: { argb: "FFE2E8F0" } },
          right: { style: "thin", color: { argb: "FFE2E8F0" } },
        };
        cell.alignment =
          colNumber <= 2
            ? { horizontal: "left", vertical: "middle" }
            : { horizontal: "center", vertical: "middle" };
        if (colNumber >= 5) cell.numFmt = '"$"#,##0.00';
      });

      // Igual que en pantalla: cada persona cierra con su total y una línea
      // gruesa.
      if (ultimaDePersona) {
        const total = totalPorPersona.get(f.idPersona);
        const filaTotal = ws.addRow([`Total ${f.persona}`, null, null, null, null, total ?? null]);
        filaTotal.eachCell({ includeEmpty: true }, (cell, colNumber) => {
          cell.font = { bold: true };
          cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE8F5EE" } };
          cell.border = {
            top: { style: "thin", color: { argb: "FF1B4332" } },
            bottom: { style: "medium", color: { argb: "FF1B4332" } },
            left: colNumber === 6 ? { style: "medium", color: { argb: "FF1B4332" } } : undefined,
          };
          cell.alignment = { horizontal: colNumber === 1 ? "right" : "center", vertical: "middle" };
          if (colNumber === 6) cell.numFmt = '"$"#,##0.00';
        });
        // Igual que en pantalla: el rótulo cruza todo hasta el importe.
        ws.mergeCells(filaTotal.number, 1, filaTotal.number, 5);
      }
    });

    ws.columns = [{ width: 30 }, { width: 34 }, { width: 12 }, { width: 14 }, { width: 16 }, { width: 16 }];

    const buffer = await wb.xlsx.writeBuffer();
    const blob = new Blob([buffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Tareas_por_personal_${titulo.replace(/\s+/g, "_")}.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const th = {
    backgroundColor: "#1b4332",
    color: "#fff",
    fontSize: "0.66rem",
    fontWeight: 600,
    verticalAlign: "middle",
    padding: "3px 5px",
    whiteSpace: "nowrap",
  };
  const td = { fontSize: "0.7rem", padding: "1px 5px", verticalAlign: "middle" };
  const raya = <span style={{ color: "#cbd5e1" }}>—</span>;

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
      <Container fluid className="px-3 py-2 d-flex flex-column flex-grow-1" style={{ overflow: "hidden" }}>
        {/* Encabezado */}
        <div className="d-flex align-items-center gap-2 mb-2 flex-wrap">
          <button
            onClick={() => navigate(`/produccion/certificados/${anio}/${mes}/informes`)}
            className="btn btn-sm btn-outline-secondary d-flex align-items-center gap-1 rounded-3 px-2 py-1"
            style={{ fontSize: "0.8rem" }}
            title="Volver a los informes"
          >
            <i className="bi bi-arrow-left"></i>
          </button>
          <span className="fw-bold" style={{ color: "#1b4332", fontSize: "1.05rem" }}>
            Tareas por personal - {titulo}
          </span>
          {periodo.desde && (
            <span
              className="px-2 py-1 rounded-3"
              style={{ fontSize: "0.76rem", backgroundColor: "#e8f5ee", color: "#1b4332", fontWeight: 600 }}
            >
              {formatFecha(periodo.desde)} al {formatFecha(periodo.hasta)}
              {cerrado ? " · cerrada" : ""}
            </span>
          )}

          <Button
            size="sm"
            onClick={exportarExcel}
            disabled={filas.length === 0}
            className="rounded-3 px-3 d-flex align-items-center gap-2 ms-auto"
            style={{
              backgroundColor: "#15803d",
              borderColor: "#15803d",
              fontSize: "0.78rem",
              height: "30px",
              fontWeight: 600,
            }}
            title="Exportar a Excel"
          >
            <i className="bi bi-file-earmark-excel-fill"></i>
            <span>Excel</span>
          </Button>
        </div>

        {/* Filtros */}
        <Card className="mb-3 p-2 shadow-sm border-0 rounded-3">
          <div className="d-flex align-items-center gap-3 flex-wrap">
            <div className="d-flex align-items-center gap-2">
              <span className="fw-bold text-dark small flex-shrink-0" style={{ fontSize: "0.8rem" }}>
                Fecha:
              </span>
              <div className="input-group input-group-sm" style={{ width: "150px" }}>
                <Form.Control
                  type="date"
                  value={filtroFecha}
                  min={periodo.desde || undefined}
                  max={periodo.hasta || undefined}
                  onChange={(e) => setFiltroFecha(e.target.value)}
                  className={`rounded-3 ${filtroFecha ? "rounded-end-0 border-end-0 fw-bold filtro-activo" : ""}`}
                  style={{
                    fontSize: "0.82rem",
                    height: "32px",
                    padding: "3px 8px",
                    color: filtroFecha ? "#dc2626" : "#1e293b",
                    fontWeight: filtroFecha ? "700" : "normal",
                  }}
                />
                {filtroFecha && (
                  <button
                    className="btn btn-outline-secondary border-start-0 d-flex align-items-center justify-content-center"
                    type="button"
                    onClick={() => setFiltroFecha("")}
                    title="Limpiar filtro fecha"
                    style={{ padding: "0 6px", height: "32px" }}
                  >
                    <i className="bi bi-x" style={{ fontSize: "0.9rem" }}></i>
                  </button>
                )}
              </div>
            </div>

            <FiltroSelect
              etiqueta="Personal"
              ancho="180px"
              valor={filtroPersona}
              vacio="Todos"
              onChange={setFiltroPersona}
              opciones={personasDelPeriodo}
            />

            <FiltroSelect
              etiqueta="CC"
              ancho="130px"
              valor={filtroCC}
              vacio="Todos"
              onChange={setFiltroCC}
              opciones={ccsDelPeriodo}
            />

            <FiltroSelect
              etiqueta="Tarea"
              ancho="185px"
              valor={filtroTarea}
              vacio="Todas"
              onChange={setFiltroTarea}
              opciones={tareasDelPeriodo}
            />

            {filas.length > 0 && (
              <span className="text-muted" style={{ fontSize: "0.78rem" }}>
                {filas.length} {filas.length === 1 ? "fila" : "filas"}
              </span>
            )}
          </div>
        </Card>

        {/* La última fila de cada persona cierra con una línea gruesa, para
            que los bloques se separen de un vistazo. */}
        <style>{`
          .tabla-tareas-personal tr.fin-persona > td {
            border-bottom: 2px solid #1b4332 !important;
          }
          /* La columna del importe se separa del resto con una línea fuerte. */
          .tabla-tareas-personal th:last-child,
          .tabla-tareas-personal td:last-child {
            border-left: 2px solid #1b4332 !important;
          }
        `}</style>

        {/* La tabla se lleva el alto que sobra y hace su propio scroll con el
            encabezado fijo, pero solo el ancho de sus columnas: `alignSelf`
            evita que el marco se estire hasta el borde de la pantalla. */}
        <div
          className="shadow-sm rounded-3 bg-white"
          style={{
            flex: "1 1 auto",
            minHeight: 0,
            alignSelf: "flex-start",
            maxWidth: "100%",
            overflowY: "auto",
            overflowX: "auto",
            border: "1px solid #cbd5e1",
          }}
        >
          <Table
            className="mb-0 tabla-informe tabla-tareas-personal"
            style={{ width: "auto", minWidth: "820px" }}
          >
            <thead style={{ position: "sticky", top: 0, zIndex: 10, backgroundColor: "#1b4332", color: "#fff" }}>
              <tr>
                <th style={{ ...th, textAlign: "left", minWidth: "190px" }}>Personal</th>
                <th style={{ ...th, textAlign: "left", minWidth: "220px" }}>Tarea</th>
                <th style={{ ...th, textAlign: "center", minWidth: "80px" }}>Unidad</th>
                <th style={{ ...th, textAlign: "center", minWidth: "90px" }}>Cantidad</th>
                <th style={{ ...th, textAlign: "center", minWidth: "110px" }}>$ unitario</th>
                <th style={{ ...th, textAlign: "center", minWidth: "110px" }}>$ total</th>
              </tr>
            </thead>
            <tbody>
              {cargando || filas.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center text-muted py-4" style={td}>
                    {cargando
                      ? "Cargando…"
                      : hayFiltro
                      ? "Ningún parte coincide con los filtros"
                      : "No hay partes cargados en este período"}
                  </td>
                </tr>
              ) : (
                filas.map((f, idx) => {
                  const primeraDePersona = idx === 0 || filas[idx - 1].idPersona !== f.idPersona;
                  const ultimaDePersona =
                    idx === filas.length - 1 || filas[idx + 1].idPersona !== f.idPersona;
                  const total = totalPorPersona.get(f.idPersona);
                  return (
                    <Fragment key={f.clave}>
                      <tr>
                        {/* El nombre va una sola vez por persona: el bloque se
                            lee como una ficha. */}
                        <td style={{ ...td, fontWeight: 500 }}>{primeraDePersona ? f.persona : ""}</td>
                        <td style={td}>{f.tarea}</td>
                        <td style={{ ...td, textAlign: "center", color: "#64748b" }}>{f.unidad || raya}</td>
                        <td style={{ ...td, textAlign: "center", fontWeight: 600 }}>
                          {f.cantidad ? numero(f.cantidad) : raya}
                        </td>
                        <td style={{ ...td, textAlign: "center", color: "#64748b" }}>
                          {f.precio === null ? raya : pesos(f.precio)}
                        </td>
                        <td style={{ ...td, textAlign: "center", fontWeight: 600 }}>
                          {f.importe === null ? raya : pesos(f.importe)}
                        </td>
                      </tr>

                      {/* Cierre del bloque: el total de la persona, en la
                          columna de precio total. */}
                      {ultimaDePersona && (
                        <tr className="fila-total fin-persona">
                          {/* El rótulo cruza todas las columnas hasta el
                              importe y va alineado a la derecha: queda pegado
                              a la línea del $ total, lejos de los nombres. */}
                          <td
                            colSpan={5}
                            style={{ ...td, fontWeight: 700, color: "#1b4332", textAlign: "right" }}
                          >
                            Total {f.persona}
                          </td>
                          <td style={{ ...td, textAlign: "center", fontWeight: 700, color: "#1b4332" }}>
                            {total === undefined ? raya : pesos(total)}
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })
              )}
            </tbody>
            </Table>
        </div>
      </Container>
    </div>
  );
}

export default ProduccionInformeTareasPersonal;
