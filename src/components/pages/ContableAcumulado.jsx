import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { Button, Container, Spinner, Table } from "react-bootstrap";
import Swal from "sweetalert2";
import { api } from "../../services/api";
import { CAMPOS_COMPARATIVA, MESES, TIPOS_COMPARATIVA, claveTarea } from "../../utils/contable";
import { calcularAjustes, calcularCertificado } from "../../utils/certificado";
import { calcularComparativa } from "../../utils/calculoComparativa";
import Error404 from "./Error404";
import { exportarPlanilla } from "../../helpers/excel";

/**
 * El Acumulado del año de una comparativa y un campo (12/11/2026): una fila
 * por tarea (arriba las de Ctv, abajo la de LM), su unidad, la diferencia de
 * cada mes (Ctv − LM) y el total. En la volumétrica la diferencia es de
 * cantidad; en la de costos, de plata.
 *
 * Cada mes sale del mismo cálculo que su comparativa (utils/calculoComparativa.js),
 * con las fechas de la certificación. Solo se calculan los meses con Excel.
 */

const MES_CORTO = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
const td = { fontSize: "0.7rem", padding: "1px 5px", verticalAlign: "middle" };
const raya = <span style={{ color: "#cbd5e1" }}>—</span>;
const ordenar = (a, b) => String(a).localeCompare(String(b), "es");
const cantidad = (n) => (n === null || n === undefined ? null : n.toLocaleString("es-AR", { maximumFractionDigits: 2 }));
// Sin centavos, para que entren los doce meses sin scroll de costado.
const pesos = (n) =>
  n === null || n === undefined
    ? null
    : n.toLocaleString("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0, minimumFractionDigits: 0 });
const colorDif = (v) => (v > 0.005 ? "#15803d" : v < -0.005 ? "#dc2626" : undefined);

/** Todo lo de un mes, como lo trae la comparativa, y su cálculo. */
async function calcularMes({ tipo, campo, anio, mes, tareas, alquileres, variables }) {
  const q = `establecimiento=${campo.id}`;
  const [datos, eq, periodo, cambios, descuentos] = await Promise.all([
    api.get(`/contable/filas/${anio}/${mes}`),
    api.get(`/contable/equivalencias?anio=${anio}&mes=${mes}&liviano=1`),
    api.get(`/periodos/${anio}/${mes}?${q}`),
    api.get(`/cambios/${anio}/${mes}?${q}`).catch(() => []),
    api.get(`/descuentos/${anio}/${mes}?${q}`).catch(() => []),
  ]);
  const desde = (periodo?.desde || "").slice(0, 10);
  const hasta = (periodo?.hasta || "").slice(0, 10);
  const base = {
    desde,
    hasta,
    variables,
    ajustes: calcularAjustes(Array.isArray(cambios) ? cambios : []),
    excluidos: new Set((Array.isArray(descuentos) ? descuentos : []).filter((d) => d.excluido).map((d) => d.persona)),
  };
  // Los partes con las fechas de la certificación, igual que la comparativa.
  const claveMes = `${anio}-${String(mes).padStart(2, "0")}`;
  const partes = await api.get(`/partes?desde=${desde}&hasta=${hasta}&periodo=${claveMes}&resumen=1&${q}`);
  const deVerdad = (Array.isArray(partes) ? partes : []).filter((p) => !p.persona?.usoInterno);
  const { filas: filasCert } = calcularCertificado(deVerdad, variables, base.ajustes, campo.id);
  return calcularComparativa({
    tipo,
    campo,
    anio,
    mes,
    filas: Array.isArray(datos?.filas) ? datos.filas : [],
    equivalencias: Array.isArray(eq?.equivalencias) ? eq.equivalencias : [],
    costosEq: Array.isArray(eq?.costos) ? eq.costos : [],
    tareas,
    alquileres,
    multiplicadores: new Map(
      (Array.isArray(eq?.multiplicadores) ? eq.multiplicadores : []).map((m) => [claveTarea(m.nombre), m.factor])
    ),
    lm: { filas: filasCert, excluidos: base.excluidos },
    base,
    rango: { desde, hasta },
  }).gruposComp;
}

function ContableAcumulado({ tipo = "cantidad" }) {
  const { titulo: nombre, colores: col } = TIPOS_COMPARATIVA[tipo] || TIPOS_COMPARATIVA.cantidad;
  const esCostos = tipo === "costos";
  const { anio, mes, campo: campoId } = useParams();
  const campo = CAMPOS_COMPARATIVA.find((c) => c.id === campoId);
  // Hasta el mes de la tarjeta desde la que se entra (12/11/2026): desde
  // marzo, enero a marzo.
  const hastaMes = Math.min(12, Math.max(0, Number(mes) || 0));
  const mesesVista = MESES.slice(0, hastaMes);
  const columnas = mesesVista.length + 3;
  const th = {
    backgroundColor: col.oscuro,
    color: "#fff",
    fontSize: "0.66rem",
    fontWeight: 600,
    verticalAlign: "middle",
    padding: "3px 5px",
    whiteSpace: "nowrap",
  };

  // mes (1-12) → filas de la comparativa de ese mes; los que no tienen Excel no están.
  const [porMes, setPorMes] = useState(new Map());
  const [cargando, setCargando] = useState(true);
  const [avance, setAvance] = useState({ hechos: 0, total: 0 });
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!campo) return undefined;
    let vigente = true;
    (async () => {
      try {
        const q = `establecimiento=${campo.id}`;
        // Qué meses tienen Excel, y lo que es de todo el año.
        const [estados, lista, alqs, variables] = await Promise.all([
          Promise.all(mesesVista.map((_, i) => api.get(`/contable/estado/${anio}/${i + 1}`).catch(() => null))),
          api.get("/tareas").catch(() => []),
          esCostos ? api.get("/contable/alquileres").catch(() => []) : [],
          api.get(`/variables?${q}`).catch(() => []),
        ]);
        const meses = estados.map((e, i) => (e?.tabla ? i + 1 : null)).filter(Boolean);
        if (!vigente) return;
        setAvance({ hechos: 0, total: meses.length });
        const tareas = Array.isArray(lista) ? lista : lista?.data || [];
        // De a cuatro meses a la vez (12/11/2026: de a uno tardaba mucho), y
        // la tabla se va armando a medida que llegan.
        const pendientes = [...meses];
        const trabajar = async () => {
          while (pendientes.length && vigente) {
            const m = pendientes.shift();
            const filas = await calcularMes({
              tipo,
              campo,
              anio,
              mes: m,
              tareas,
              alquileres: Array.isArray(alqs) ? alqs : [],
              variables: Array.isArray(variables) ? variables : [],
            });
            if (!vigente) return;
            setPorMes((ant) => new Map(ant).set(m, filas));
            setAvance((a) => ({ ...a, hechos: a.hechos + 1 }));
          }
        };
        await Promise.all(Array.from({ length: Math.min(4, meses.length) }, trabajar));
      } catch (err) {
        if (vigente) setError(err.message);
      } finally {
        if (vigente) setCargando(false);
      }
    })();
    return () => {
      vigente = false;
    };
    // mesesVista sale de mes: con mes alcanza.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [anio, mes, campo, tipo, esCostos]);

  /**
   * Una fila por tarea (la clave de la fila en la comparativa): las de Ctv que
   * la forman, la de LM, la unidad y la diferencia de cada mes.
   */
  const filas = useMemo(() => {
    const m = new Map();
    for (const [mes, lista] of porMes) {
      for (const f of lista) {
        let a = m.get(f.clave);
        if (!a) {
          a = { clave: f.clave, ctv: new Set(), lm: "", unidad: "", sinEquivalencia: false, meses: new Map() };
          m.set(f.clave, a);
        }
        for (const x of f.filasCtv || []) if (x.tarea) a.ctv.add(x.tarea);
        // La de LM: la de costos si la fila está cruzada; si no, la de la fila.
        const deLM = f.tareaLMCostos || (f.clave.startsWith("ctv:") ? "" : f.tarea);
        if (deLM) a.lm = deLM;
        // Una de Ctv sin equivalencia, con la unidad de La Martina (HRA → Horas).
        // (cada fila del Excel ya la trae: unidadLM).
        const unidad = f.clave.startsWith("ctv:") ? f.filasCtv?.[0]?.unidadLM || f.unidad : f.unidad;
        if (unidad) a.unidad = unidad;
        if (f.sinEquivalencia) a.sinEquivalencia = true;
        a.meses.set(mes, esCostos ? f.dif : f.difCant);
      }
    }
    return [...m.values()]
      .map((a) => ({
        ...a,
        ctv: [...a.ctv].sort(ordenar),
        total: [...a.meses.values()].reduce((t, v) => t + (v || 0), 0),
      }))
      .sort((a, b) => ordenar(a.lm || a.ctv[0] || "", b.lm || b.ctv[0] || ""));
  }, [porMes, esCostos]);

  // El total de cada mes: solo en la de costos (en la volumétrica las
  // cantidades son de unidades distintas y no se suman).
  const totales = useMemo(() => {
    const t = new Map();
    for (const f of filas) for (const [mes, v] of f.meses) t.set(mes, (t.get(mes) || 0) + (v || 0));
    return t;
  }, [filas]);

  if (!campo) return <Error404 />;
  const valor = (v) => (esCostos ? pesos(v) : cantidad(v));

  /**
   * El Excel de la tabla, con el formato de todo el proyecto (helpers/excel.js):
   * las tareas de Ctv (una por renglón), la de LM, la unidad, la diferencia de
   * cada mes y el total; en la de costos en pesos y con la fila TOTAL.
   */
  const exportarExcel = async () => {
    const meses = MES_CORTO.slice(0, hastaMes);
    const numero = (v) => (v === undefined || v === null ? "" : v);
    try {
      await exportarPlanilla({
        titulo: `${nombre} — ${campo.titulo} — Acumulado ${anio} (diferencia Ctv − LM)`,
        hoja: "Acumulado",
        archivo: `Acumulado ${nombre} ${campo.titulo} ${anio}-${String(hastaMes).padStart(2, "0")}.xlsx`,
        // Como la pantalla: una sola columna Tarea, arriba las de Ctv y abajo
        // la de LM (12/11/2026). La hoja abre al 90%.
        zoom: 90,
        // Letra más chica (12/11/2026).
        letra: 9,
        columnas: [
          { titulo: "Tarea", ancho: 52 },
          { titulo: "Unidad", ancho: 10 },
          ...meses.map((m) => ({ titulo: m, ancho: esCostos ? 14 : 11, moneda: esCostos })),
          { titulo: "Total", ancho: esCostos ? 16 : 12, moneda: esCostos },
        ],
        filas: [
          ...filas.map((f) => [
            `Ctv: ${f.ctv.length ? f.ctv.join(", ") : "—"}\nLM: ${f.lm || (f.sinEquivalencia ? "sin equivalencia" : "—")}`,
            f.unidad || "",
            ...meses.map((_, i) => numero(f.meses.get(i + 1))),
            f.total,
          ]),
          ...(esCostos
            ? [
                [
                  "TOTAL",
                  "",
                  ...meses.map((_, i) => numero(totales.get(i + 1))),
                  [...totales.values()].reduce((t, v) => t + v, 0),
                ],
              ]
            : []),
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
        style={{ maxWidth: "1320px", width: "100%", margin: "0 auto", minHeight: 0 }}
      >
        {/* Encabezado. El volver está en el navbar de Contable, arriba. */}
        <div className="d-flex align-items-center gap-2 mb-3 flex-wrap">
          <i className="bi bi-calendar3" style={{ color: col.medio, fontSize: "1.1rem" }}></i>
          <span className="fw-bold" style={{ color: col.oscuro, fontSize: "1.05rem" }}>
            {nombre} - {campo.titulo} - Acumulado {anio}
          </span>
          <span style={{ fontSize: "0.76rem", color: "#64748b" }}>
            · diferencia Ctv − LM de cada mes{esCostos ? " ($)" : " (cantidad)"}
          </span>
          {/* Mientras llegan los meses, la tabla ya se ve con los que hay. */}
          {cargando && filas.length > 0 && (
            <span className="ms-auto d-flex align-items-center gap-2" style={{ fontSize: "0.76rem", color: col.medio }}>
              <Spinner animation="border" size="sm" />
              Calculando: {avance.hechos} de {avance.total} meses…
            </span>
          )}
          {/* El Excel, cuando ya están todos los meses. */}
          <Button
            size="sm"
            onClick={exportarExcel}
            disabled={cargando || !filas.length}
            className={`rounded-3 px-3 d-flex align-items-center gap-2 ${cargando && filas.length > 0 ? "" : "ms-auto"}`}
            style={{
              backgroundColor: "#15803d",
              borderColor: "#15803d",
              fontSize: "0.78rem",
              height: "30px",
              fontWeight: 600,
            }}
            title="Exportar la tabla a Excel"
          >
            <i className="bi bi-file-earmark-excel-fill"></i>
            <span>Excel</span>
          </Button>
        </div>

        <div
          className="shadow-sm bg-white"
          style={{
            flex: "1 1 auto",
            minHeight: 0,
            width: "100%",
            overflowY: "auto",
            overflowX: "hidden",
            border: "1px solid #cbd5e1",
            borderRadius: "0.5rem",
          }}
        >
          <Table className="mb-0 tabla-informe" style={{ width: "100%", tableLayout: "fixed" }}>
            <colgroup>
              <col style={{ width: "21%" }} />
              <col style={{ width: "52px" }} />
              {mesesVista.map((_, i) => (
                <col key={i} />
              ))}
              <col style={{ width: esCostos ? "92px" : "70px" }} />
            </colgroup>
            <thead style={{ position: "sticky", top: 0, zIndex: 10, backgroundColor: col.oscuro, color: "#fff" }}>
              <tr>
                <th style={th}>Tarea</th>
                <th style={{ ...th, textAlign: "center" }}>Unidad</th>
                {MES_CORTO.slice(0, hastaMes).map((m) => (
                  <th key={m} style={{ ...th, textAlign: "center" }}>
                    {m}
                  </th>
                ))}
                <th className="col-corte" style={{ ...th, textAlign: "center" }}>
                  Total
                </th>
              </tr>
            </thead>
            <tbody>
              {cargando && !filas.length ? (
                <tr>
                  <td colSpan={columnas} className="text-center text-muted py-4" style={td}>
                    <Spinner animation="border" size="sm" style={{ color: col.medio }} />
                    <span className="ms-2">
                      {avance.total ? `Calculando: ${avance.hechos} de ${avance.total} meses…` : "Buscando los meses con Excel…"}
                    </span>
                  </td>
                </tr>
              ) : error ? (
                <tr>
                  <td colSpan={columnas} className="text-center py-4" style={{ ...td, color: "#dc2626" }}>
                    No se pudo calcular: {error}
                  </td>
                </tr>
              ) : !filas.length ? (
                <tr>
                  <td colSpan={columnas} className="text-center text-muted py-4" style={td}>
                    Ningún mes de {anio} tiene Excel cargado
                  </td>
                </tr>
              ) : (
                <>
                  {filas.map((f) => (
                    <tr key={f.clave}>
                      <td style={td}>
                        {/* Arriba las de Ctv, abajo la de LM. */}
                        <div style={{ color: "#475569" }} title="Tareas de Citrusvil">
                          <span className="fw-semibold" style={{ fontSize: "0.6rem", color: "#94a3b8" }}>
                            Ctv:{" "}
                          </span>
                          {f.ctv.length ? f.ctv.join(", ") : raya}
                        </div>
                        <div className="fw-semibold" style={{ color: col.oscuro }} title="Tarea de La Martina">
                          <span style={{ fontSize: "0.6rem", color: "#94a3b8" }}>LM: </span>
                          {f.lm ? (
                            f.lm
                          ) : (
                            <span style={{ color: "#b45309" }}>{f.sinEquivalencia ? "sin equivalencia" : "—"}</span>
                          )}
                        </div>
                      </td>
                      <td style={{ ...td, textAlign: "center" }}>{f.unidad || raya}</td>
                      {mesesVista.map((_, i) => {
                        const v = f.meses.get(i + 1);
                        return (
                          <td
                            key={i}
                            style={{ ...td, textAlign: "center", whiteSpace: "nowrap", color: colorDif(v), fontSize: "0.66rem" }}
                          >
                            {v === undefined || v === null ? raya : valor(v)}
                          </td>
                        );
                      })}
                      <td
                        className="col-corte"
                        style={{ ...td, textAlign: "center", whiteSpace: "nowrap", fontWeight: 700, color: colorDif(f.total) }}
                      >
                        {valor(f.total)}
                      </td>
                    </tr>
                  ))}
                  {esCostos && (
                    <tr className="fila-total">
                      <td style={{ ...td, fontWeight: 700, color: col.oscuro }}>TOTAL</td>
                      <td style={td}></td>
                      {mesesVista.map((_, i) => {
                        const v = totales.get(i + 1);
                        return (
                          <td
                            key={i}
                            style={{ ...td, textAlign: "center", whiteSpace: "nowrap", fontWeight: 700, color: colorDif(v), fontSize: "0.66rem" }}
                          >
                            {v === undefined ? raya : valor(v)}
                          </td>
                        );
                      })}
                      <td
                        className="col-corte"
                        style={{
                          ...td,
                          textAlign: "center",
                          whiteSpace: "nowrap",
                          fontWeight: 700,
                          color: colorDif([...totales.values()].reduce((t, v) => t + v, 0)),
                        }}
                      >
                        {valor([...totales.values()].reduce((t, v) => t + v, 0))}
                      </td>
                    </tr>
                  )}
                </>
              )}
            </tbody>
          </Table>
        </div>
      </Container>
    </div>
  );
}

export default ContableAcumulado;
