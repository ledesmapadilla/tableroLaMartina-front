import { Fragment, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Card, Container, Spinner, Table } from "react-bootstrap";
import Swal from "sweetalert2";
import { api } from "../../services/api";
import { usePermisos } from "../../context/permisos";
import { MESES, fechaHora, memoriaTablas } from "../../utils/contable";
import SelectBuscador from "../shared/SelectBuscador";

// La fecha del Excel es un día, sin hora: se muestra en UTC para que no corra.
const fecha = (iso) => (iso ? new Date(iso).toLocaleDateString("es-AR", { timeZone: "UTC" }) : null);
const cantidad = (n) =>
  n === null || n === undefined ? null : n.toLocaleString("es-AR", { maximumFractionDigits: 3 });
const pesos = (n) =>
  n === null || n === undefined
    ? null
    : `$ ${n.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

// Las columnas, en el orden y con los nombres del Excel. Las `largo` son de
// texto y se parten en renglones: así la tabla entra a lo ancho sin scroll
// lateral. Los números, fechas y códigos van siempre en un renglón.
const COLUMNAS = [
  { campo: "documentoCompras", titulo: "Documento compras", centro: true },
  { campo: "ordenTrabajo", titulo: "Orden de trabajo", centro: true },
  { campo: "fecha", titulo: "Fecha", centro: true, ver: fecha },
  { campo: "almacen", titulo: "Almacén" },
  { campo: "contratista", titulo: "Contratista", largo: true },
  { campo: "nroServicio", titulo: "N° servicio", centro: true },
  { campo: "tarea", titulo: "Detalle de tarea", largo: true },
  { campo: "cantidad", titulo: "Cant.", centro: true, ver: cantidad },
  { campo: "unidad", titulo: "Unidad", centro: true },
  { campo: "precioUnitario", titulo: "Precio unitario", derecha: true, ver: pesos },
  { campo: "subtotal", titulo: "Subtotal", derecha: true, ver: pesos },
  { campo: "ordenControl", titulo: "Orden de control", largo: true },
  { campo: "centroCosteCodigo", titulo: "Centro de coste", centro: true },
  { campo: "centroCosto", titulo: "Centro de costo", largo: true },
  { campo: "activoFijo", titulo: "Activo fijo", largo: true },
];
const I_TAREA = COLUMNAS.findIndex((c) => c.campo === "tarea");

/**
 * Las filas agrupadas por tarea, como el Excel: cada tarea con su subtotal de
 * cantidad y de importe. Van en el orden en que vinieron.
 */
const agruparPorTarea = (filas) => {
  const grupos = [];
  for (const f of filas) {
    const ultimo = grupos[grupos.length - 1];
    if (ultimo && ultimo.tarea === (f.tarea || "")) ultimo.filas.push(f);
    else grupos.push({ tarea: f.tarea || "", filas: [f] });
  }
  for (const g of grupos) {
    g.cantidad = g.filas.reduce((a, f) => a + (f.cantidad || 0), 0);
    g.subtotal = g.filas.reduce((a, f) => a + (f.subtotal || 0), 0);
  }
  return grupos;
};

const th = {
  backgroundColor: "#164e63",
  color: "#fff",
  fontSize: "0.66rem",
  fontWeight: 600,
  verticalAlign: "middle",
  padding: "3px 5px",
  // Se parten en dos renglones: con quince columnas, en uno no entran.
  whiteSpace: "normal",
  lineHeight: 1.15,
};
const td = { fontSize: "0.7rem", padding: "1px 5px", verticalAlign: "middle" };
const raya = <span style={{ color: "#cbd5e1" }}>—</span>;

// Los colores del buscador, en el cian de Contable.
const COLORES_BUSCADOR = { marcada: "#ecfeff", elegida: "#164e63" };

/**
 * Desplegable de filtro con el formato del resto del proyecto (el de la
 * planilla de partes): se pinta en rojo cuando está activo y suma una cruz
 * para limpiarlo. Va sobre SelectBuscador porque las listas (tareas, centros
 * de costo, activos fijos) son largas y se buscan por cualquier parte.
 *
 * Adentro, "sin filtro" es el string `vacio` ("Todos" / "Todas"); el buscador
 * usa "" para eso, así que se traduce en el borde.
 */
const FiltroSelect = ({ etiqueta, ancho, fijo, valor, vacio, onChange, opciones }) => {
  const activo = valor !== vacio;
  return (
    // `ancho` es lo que mide el filtro cómodo: si no entran todos en la fila,
    // se achican parejo en vez de bajar a un segundo renglón. Con `fijo`, es
    // el ancho de la caja y no crece: para los de valores cortos (fecha,
    // almacén), que no necesitan más.
    <div
      className="d-flex align-items-center gap-1"
      style={fijo ? { flex: "0 0 auto" } : { flex: `1 1 ${ancho}`, minWidth: 0 }}
    >
      <span className="fw-bold text-dark small flex-shrink-0" style={{ fontSize: "0.75rem" }}>
        {etiqueta}:
      </span>
      <div className="d-flex align-items-center" style={fijo ? { width: ancho } : { flex: "1 1 auto", minWidth: 0 }}>
        <div style={{ flex: "1 1 auto", minWidth: 0 }}>
          <SelectBuscador
            opciones={opciones.map(([id, texto]) => ({ valor: id, texto }))}
            colores={COLORES_BUSCADOR}
            valor={activo ? valor : ""}
            onChange={(v) => onChange(v || vacio)}
            vacio={vacio}
            placeholder={vacio}
            className={`rounded-3 ${activo ? "rounded-end-0 border-end-0 fw-bold filtro-activo" : ""}`}
            style={{
              fontSize: "0.82rem",
              height: "32px",
              padding: "3px 24px 3px 8px",
              color: activo ? "#dc2626" : "#1e293b",
              fontWeight: activo ? "700" : "normal",
            }}
          />
        </div>
        {activo && (
          <button
            className="btn btn-sm btn-outline-secondary border-start-0 rounded-start-0 d-flex align-items-center justify-content-center flex-shrink-0"
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

// Los filtros de la tabla: campo de la fila, rótulo, ancho y el texto de
// "sin filtro". Las opciones salen de todas las filas del mes, no de las ya
// filtradas: si no, elegir una tarea vacía los demás desplegables.
const FILTROS = [
  // Fecha y almacén tienen valores cortos ("26/10/2026", "San Pablo"): caja
  // fija y chica, y el lugar que sobra va a los de textos largos.
  { campo: "fecha", etiqueta: "Fecha", ancho: "112px", fijo: true, vacio: "Todas" },
  { campo: "almacen", etiqueta: "Almacén", ancho: "112px", fijo: true, vacio: "Todos" },
  { campo: "contratista", etiqueta: "Contratista", ancho: "200px", vacio: "Todos" },
  { campo: "tarea", etiqueta: "Tarea", ancho: "220px", vacio: "Todas" },
  { campo: "centroCosto", etiqueta: "CC", ancho: "170px", vacio: "Todos" },
  { campo: "activoFijo", etiqueta: "Activo fijo", ancho: "220px", vacio: "Todos" },
];
const FILTRO_VACIO = Object.fromEntries(FILTROS.map((f) => [f.campo, f.vacio]));

/** Las opciones de un filtro: los valores distintos de esa columna, ordenados. */
const opcionesDe = (filas, campo) => {
  const valores = [...new Set(filas.map((f) => f[campo]).filter((v) => v !== null && v !== undefined && v !== ""))];
  // La fecha va en orden de calendario y se muestra como día.
  if (campo === "fecha") return valores.sort().map((v) => [v, fecha(v)]);
  return valores.sort((a, b) => String(a).localeCompare(String(b), "es")).map((v) => [v, String(v)]);
};

/**
 * La tabla de un mes de Contable (05/11/2026), armada desde el Excel mensual
 * en la pantalla anterior (ContableMes.jsx). Ya es del sistema: el Excel no
 * se guardó.
 *
 * Una tabla no se pisa: "Borrar tabla" la saca (con el Excel, si quedó alguno
 * guardado) y vuelve a la pantalla anterior, donde ya se puede subir otro.
 */
function ContableTabla() {
  const { anio, mes } = useParams();
  const navigate = useNavigate();
  const { puede } = usePermisos();
  const puedeEditar = puede("contable.excel", "editar");

  // Lo que ya se trajo de este mes se muestra enseguida (utils/contable.js):
  // la base tarda segundos y al volver a la pantalla no hay por qué esperarla.
  const clave = `${anio}/${mes}`;
  const enMemoria = memoriaTablas.get(clave);

  const [filas, setFilas] = useState(enMemoria?.filas || []);
  const [tabla, setTabla] = useState(enMemoria?.tabla || null);
  const [cargando, setCargando] = useState(!enMemoria);
  const [borrando, setBorrando] = useState(false);
  const [filtro, setFiltro] = useState(FILTRO_VACIO);

  const rutaFilas = `/contable/filas/${anio}/${mes}`;
  const titulo = `${MESES[Number(mes) - 1] || ""} ${anio}`;
  const alMes = () => navigate(`/contable/${anio}/${mes}`, { replace: true });

  // Siempre se pide lo actualizado; si ya había algo en pantalla, se cambia
  // sin cartel de carga cuando llega.
  useEffect(() => {
    let vigente = true;
    api
      .get(rutaFilas)
      .then((datos) => {
        const nuevo = { filas: Array.isArray(datos?.filas) ? datos.filas : [], tabla: datos?.tabla || null };
        memoriaTablas.set(clave, nuevo);
        if (!vigente) return;
        setFilas(nuevo.filas);
        setTabla(nuevo.tabla);
      })
      .catch(() => {})
      .finally(() => vigente && setCargando(false));
    return () => {
      vigente = false;
    };
  }, [rutaFilas, clave]);

  const opciones = useMemo(
    () => Object.fromEntries(FILTROS.map((f) => [f.campo, opcionesDe(filas, f.campo)])),
    [filas]
  );
  const hayFiltro = FILTROS.some((f) => filtro[f.campo] !== f.vacio);
  // Los subtotales y el total son de lo que se está mirando.
  const filtradas = useMemo(
    () =>
      hayFiltro
        ? filas.filter((fila) => FILTROS.every((f) => filtro[f.campo] === f.vacio || fila[f.campo] === filtro[f.campo]))
        : filas,
    [filas, filtro, hayFiltro]
  );
  const grupos = useMemo(() => agruparPorTarea(filtradas), [filtradas]);
  const total = useMemo(
    () => ({
      cantidad: filtradas.reduce((a, f) => a + (f.cantidad || 0), 0),
      subtotal: filtradas.reduce((a, f) => a + (f.subtotal || 0), 0),
    }),
    [filtradas]
  );

  /** Borra la tabla del mes y su Excel, preguntando antes, y vuelve al mes. */
  const borrar = async () => {
    const { isConfirmed } = await Swal.fire({
      icon: "warning",
      title: "¿Borrar la tabla?",
      // Sin "no se puede deshacer" (13/11/2026, pedido del usuario).
      text: "Se borran la tabla del mes y su Excel.",
      width: "340px",
      showCancelButton: true,
      confirmButtonText: "Sí, borrar",
      cancelButtonText: "Cancelar",
      confirmButtonColor: "#dc2626",
      cancelButtonColor: "#64748b",
    });
    if (!isConfirmed) return;
    setBorrando(true);
    try {
      await api.delete(rutaFilas);
      memoriaTablas.delete(clave);
      alMes();
    } catch (err) {
      Swal.fire({ icon: "error", title: "No se pudo borrar", text: err.message, width: "300px" });
      setBorrando(false);
    }
  };

  const celda = (c, f) => {
    const v = f[c.campo];
    const texto = v === null || v === undefined || v === "" ? null : c.ver ? c.ver(v) : v;
    return (
      <td
        key={c.campo}
        style={{
          ...td,
          textAlign: c.derecha ? "right" : c.centro ? "center" : "left",
          whiteSpace: c.largo ? "normal" : "nowrap",
        }}
      >
        {texto ?? raya}
      </td>
    );
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
      <Container fluid className="px-4 py-3 d-flex flex-column flex-grow-1" style={{ minHeight: 0 }}>
        {/* Encabezado. El volver está en el navbar de Contable, arriba. */}
        <div className="d-flex align-items-center gap-3 mb-3 flex-wrap">
          <span className="fw-bold" style={{ color: "#164e63", fontSize: "1.05rem" }}>
            Contable - {titulo}
          </span>

          {!cargando && filas.length > 0 && (
            <div className="ms-auto d-flex align-items-center gap-2 flex-wrap">
              <div className="d-flex flex-column text-end me-2" style={{ lineHeight: 1.15 }}>
                <span className="fw-semibold" style={{ color: "#164e63", fontSize: "0.8rem" }}>
                  <i className="bi bi-file-earmark-excel-fill me-1" style={{ color: "#15803d" }}></i>
                  {tabla?.origen || "Excel del mes"}
                </span>
                <span style={{ fontSize: "0.7rem", color: "#64748b" }}>
                  Armada {fechaHora(tabla?.fecha)}
                  {tabla?.cargadaPor ? ` por ${tabla.cargadaPor}` : ""}
                </span>
              </div>
              <button
                className="btn btn-sm btn-outline-danger d-flex align-items-center gap-2 px-3"
                style={{ fontSize: "0.82rem" }}
                onClick={borrar}
                disabled={!puedeEditar || borrando}
              >
                {borrando ? <Spinner animation="border" size="sm" /> : <i className="bi bi-trash"></i>}
                Borrar tabla
              </button>
            </div>
          )}
        </div>

        {cargando ? (
          <div className="flex-grow-1 d-flex align-items-center justify-content-center">
            <Spinner animation="border" style={{ color: "#0e7490" }} />
          </div>
        ) : !filas.length ? (
          <div className="flex-grow-1 d-flex flex-column align-items-center justify-content-center text-center">
            <i className="bi bi-table mb-2" style={{ fontSize: "2.2rem", color: "#94a3b8" }}></i>
            <span style={{ fontSize: "0.88rem", color: "#64748b" }}>Este mes todavía no tiene tabla.</span>
            <button
              className="btn btn-sm d-flex align-items-center gap-2 px-3 mt-3"
              style={{ backgroundColor: "#0e7490", borderColor: "#0e7490", color: "#fff", fontSize: "0.82rem" }}
              onClick={alMes}
            >
              <i className="bi bi-upload"></i>
              Cargar Excel mensual
            </button>
          </div>
        ) : (
          <>
            {/* Los filtros, con el formato del proyecto (docs/formato-tablas.md). */}
            <Card className="mb-3 p-2 shadow-sm border-0 rounded-3" style={{ maxWidth: "100%" }}>
              <div className="d-flex align-items-center gap-2 flex-nowrap">
                {FILTROS.map((f) => (
                  <FiltroSelect
                    key={f.campo}
                    etiqueta={f.etiqueta}
                    ancho={f.ancho}
                    fijo={f.fijo}
                    valor={filtro[f.campo]}
                    vacio={f.vacio}
                    onChange={(v) => setFiltro((anterior) => ({ ...anterior, [f.campo]: v }))}
                    opciones={opciones[f.campo]}
                  />
                ))}
              </div>
            </Card>
          <div
            className="shadow-sm rounded-3 bg-white"
            style={{
              flex: "1 1 auto",
              minHeight: 0,
              width: "100%",
              overflowY: "auto",
              // Sin scroll lateral: la tabla va al ancho de la pantalla y los
              // textos largos se parten en renglones.
              overflowX: "hidden",
              border: "1px solid #cbd5e1",
            }}
          >
            <Table className="mb-0 tabla-informe" style={{ width: "100%" }}>
              <thead style={{ position: "sticky", top: 0, zIndex: 10, backgroundColor: "#164e63", color: "#fff" }}>
                <tr>
                  {COLUMNAS.map((c) => (
                    <th key={c.campo} style={{ ...th, textAlign: c.derecha ? "right" : c.centro ? "center" : "left" }}>
                      {c.titulo}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {!filtradas.length && (
                  <tr>
                    <td colSpan={COLUMNAS.length} className="text-center text-muted py-4" style={td}>
                      Ninguna fila coincide con los filtros
                    </td>
                  </tr>
                )}
                {grupos.map((g, i) => (
                  <Fragment key={`${g.tarea}-${i}`}>
                    {g.filas.map((f) => (
                      <tr key={f._id}>{COLUMNAS.map((c) => celda(c, f))}</tr>
                    ))}
                    {/* El subtotal de la tarea, como en el Excel. */}
                    <tr className="fila-fin-grupo">
                      {COLUMNAS.map((c, j) => {
                        const fondo = { ...td, backgroundColor: "#ecfeff" };
                        const estilo = { ...fondo, fontWeight: 700, color: "#164e63", whiteSpace: "nowrap" };
                        if (j === I_TAREA)
                          return <td key={c.campo} style={{ ...estilo, whiteSpace: "normal" }}>Subtotal {g.tarea}</td>;
                        if (c.campo === "cantidad")
                          return <td key={c.campo} style={{ ...estilo, textAlign: "center" }}>{cantidad(g.cantidad)}</td>;
                        if (c.campo === "subtotal")
                          return <td key={c.campo} style={{ ...estilo, textAlign: "right" }}>{pesos(g.subtotal)}</td>;
                        return <td key={c.campo} style={fondo}></td>;
                      })}
                    </tr>
                  </Fragment>
                ))}
                {filtradas.length > 0 && (
                <tr className="fila-total">
                  {COLUMNAS.map((c, j) => {
                    const estilo = { ...td, fontWeight: 700, whiteSpace: "nowrap" };
                    if (j === 0) return <td key={c.campo} style={{ ...estilo, color: "#164e63" }}>TOTAL</td>;
                    if (c.campo === "cantidad")
                      return <td key={c.campo} style={{ ...estilo, textAlign: "center" }}>{cantidad(total.cantidad)}</td>;
                    if (c.campo === "subtotal")
                      return <td key={c.campo} style={{ ...estilo, textAlign: "right" }}>{pesos(total.subtotal)}</td>;
                    return <td key={c.campo} style={td}></td>;
                  })}
                </tr>
                )}
              </tbody>
            </Table>
          </div>
          </>
        )}
      </Container>
    </div>
  );
}

export default ContableTabla;
