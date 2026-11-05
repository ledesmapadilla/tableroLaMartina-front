import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Button, Card, Container, Modal, Spinner, Table } from "react-bootstrap";
import Swal from "sweetalert2";
import { api } from "../../services/api";
import { CAMPOS_COMPARATIVA, MESES, claveTarea, memoriaTablas } from "../../utils/contable";
import Error404 from "./Error404";
import { calcularAjustes, calcularCertificado } from "../../utils/certificado";
import { exportarPlanilla } from "../../helpers/excel";
import SelectBuscador from "../shared/SelectBuscador";

const th = {
  backgroundColor: "#164e63",
  color: "#fff",
  fontSize: "0.66rem",
  fontWeight: 600,
  verticalAlign: "middle",
  padding: "3px 5px",
  whiteSpace: "nowrap",
};
const td = { fontSize: "0.7rem", padding: "1px 5px", verticalAlign: "middle" };
const raya = <span style={{ color: "#cbd5e1" }}>—</span>;

const ordenar = (a, b) => String(a).localeCompare(String(b), "es");
const cantidad = (n) => (n === null || n === undefined ? null : n.toLocaleString("es-AR", { maximumFractionDigits: 3 }));
const pesos = (n) =>
  n === null || n === undefined
    ? null
    : `$ ${n.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

// La fecha del Excel es un día, sin hora: se muestra en UTC para que no corra.
const fecha = (iso) => (iso ? new Date(iso).toLocaleDateString("es-AR", { timeZone: "UTC" }) : null);

// Las sin equivalencia van en ámbar: es lo que falta cargar.
const AMBAR = "#fef3c7";
const AMBAR_TEXTO = "#92400e";

// Los colores del buscador, en el cian de Contable.
const COLORES_BUSCADOR = { marcada: "#ecfeff", elegida: "#164e63" };

/**
 * Desplegable de filtro con el formato del resto del proyecto (el mismo de la
 * tabla del mes): en rojo cuando está activo y con una cruz para limpiarlo.
 */
const FiltroSelect = ({ etiqueta, ancho, valor, vacio, onChange, opciones }) => {
  const activo = valor !== vacio;
  return (
    <div className="d-flex align-items-center gap-1" style={{ minWidth: 0 }}>
      <span className="fw-bold text-dark small flex-shrink-0" style={{ fontSize: "0.75rem" }}>
        {etiqueta}:
      </span>
      <div className="d-flex align-items-center" style={{ width: ancho, minWidth: 0 }}>
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

const FILTRO_VACIO = { tarea: "Todas" };

/**
 * Las filas del mes juntadas por almacén y por la tarea de La Martina que le
 * toca a cada tarea de Citrusvil (Equivalencias de tareas). Suma cantidad y
 * subtotal; el precio unitario es subtotal / cantidad, que con una sola
 * tarifa es esa misma y con varias es el promedio pesado.
 *
 * Una de Citrusvil sin equivalencia queda con su propio nombre, marcada.
 */
const agrupar = (filas, laMartinaDe, tareaLM) => {
  const grupos = new Map();
  for (const f of filas) {
    // Por clave y no por el texto exacto: una variante escrita distinto
    // (mayúsculas, acentos, espacios, signos) es la misma tarea.
    const idLM = laMartinaDe.get(claveTarea(f.tarea));
    const lm = idLM ? tareaLM.get(idLM) : null;
    const tarea = lm ? lm.tarea : f.tarea || "";
    const clave = `${f.almacen || ""}|${lm ? `lm:${idLM}` : `ctv:${claveTarea(tarea)}`}`;
    let g = grupos.get(clave);
    if (!g) {
      g = {
        clave,
        almacen: f.almacen || "",
        tarea,
        sinEquivalencia: !lm,
        idLM: lm ? idLM : null,
        unidad: lm ? lm.unidad : f.unidad || "",
        cantidad: 0,
        subtotal: 0,
        tareasCtv: new Set(),
        // Las filas del Excel que forman el grupo: el detalle al tocarlo.
        filas: [],
      };
      grupos.set(clave, g);
    }
    g.cantidad += f.cantidad || 0;
    g.subtotal += f.subtotal || 0;
    if (f.tarea) g.tareasCtv.add(f.tarea);
    g.filas.push(f);
  }
  return [...grupos.values()]
    .map((g) => ({ ...g, precio: g.cantidad ? g.subtotal / g.cantidad : null, tareasCtv: [...g.tareasCtv].sort(ordenar) }))
    .sort((a, b) => ordenar(a.almacen, b.almacen) || ordenar(a.tarea, b.tarea));
};

/**
 * Lo certificado en La Martina en el mes, por tarea (la solapa "Certificado
 * en LM", 05/11/2026). Sale del mismo cálculo que Contable - Pagos
 * (utils/certificado.js): una fila por persona y tarea, que acá se juntan por
 * tarea. Las personas que en Pagos están "sin contar" no cuentan.
 *
 * El precio unitario es el de "Pagado por CTV" para la misma tarea de La
 * Martina en el mismo campo (`preciosCTV`: id de la tarea → precio), y el
 * subtotal, la cantidad certificada por ese precio (05/11/2026): así se ve
 * cuánto valdría lo certificado a lo que paga Citrusvil. Una tarea que no
 * está en CTV queda sin precio ni subtotal.
 *
 * `conEquivalencia` son los id de las tareas de La Martina que tienen alguna
 * de Citrusvil en Equivalencias de tareas: las demás van destacadas, igual
 * que en "Pagado por CTV".
 */
const agruparLM = (filasCert, excluidos, almacen, preciosCTV, conEquivalencia) => {
  const grupos = new Map();
  for (const f of filasCert) {
    if (excluidos.has(f.idPersona)) continue;
    let g = grupos.get(f.idTarea);
    if (!g) {
      g = {
        clave: `lm:${f.idTarea}`,
        almacen,
        tarea: f.tarea,
        unidad: f.unidad,
        cantidad: 0,
        precio: preciosCTV.get(String(f.idTarea)) ?? null,
        sinEquivalencia: !conEquivalencia.has(String(f.idTarea)),
        personas: [],
      };
      grupos.set(f.idTarea, g);
    }
    g.cantidad += f.cantidad || 0;
    g.personas.push(f);
  }
  return [...grupos.values()]
    .map((g) => ({
      ...g,
      subtotal: g.precio === null ? null : g.cantidad * g.precio,
      // Cada persona también al precio de CTV, para el detalle.
      personas: g.personas.map((p) => ({
        ...p,
        precio: g.precio,
        importe: g.precio === null ? null : (p.cantidad || 0) * g.precio,
      })),
    }))
    .sort((a, b) => ordenar(a.tarea, b.tarea));
};

/**
 * La solapa "Comparación" (05/11/2026): lo pagado por Citrusvil contra lo
 * certificado en La Martina, una fila por tarea de La Martina. Las
 * diferencias son CTV − LM: positiva, Citrusvil pagó más de lo certificado.
 *
 * Van también las que están de un solo lado: una de Citrusvil sin
 * equivalencia (no hay con qué compararla en LM) y una certificada en LM sin
 * nada en CTV (sin precio de CTV no se puede valuar). En esas la diferencia
 * queda vacía.
 */
const compararGrupos = (gruposCTV, gruposLM) => {
  const filas = new Map();
  const fila = (clave, base) => {
    if (!filas.has(clave)) {
      filas.set(clave, {
        clave,
        tarea: base.tarea,
        unidad: base.unidad,
        precio: null,
        cantCTV: null,
        cantLM: null,
        subCTV: null,
        subLM: null,
        sinEquivalencia: false,
      });
    }
    return filas.get(clave);
  };
  for (const g of gruposCTV) {
    const f = fila(g.idLM ? `lm:${g.idLM}` : `ctv:${g.clave}`, g);
    f.cantCTV = (f.cantCTV || 0) + g.cantidad;
    f.subCTV = (f.subCTV || 0) + g.subtotal;
    if (g.precio !== null) f.precio = g.precio;
    if (g.sinEquivalencia) f.sinEquivalencia = true;
  }
  for (const g of gruposLM) {
    const f = fila(g.clave, g);
    f.cantLM = (f.cantLM || 0) + g.cantidad;
    if (g.subtotal !== null) f.subLM = (f.subLM || 0) + g.subtotal;
    if (g.sinEquivalencia) f.sinEquivalencia = true;
  }
  return [...filas.values()]
    .map((f) => {
      // Con equivalencia y sin partes en LM, lo certificado es cero.
      const conLM = !f.sinEquivalencia && f.cantCTV !== null;
      const cantLM = f.cantLM ?? (conLM ? 0 : null);
      const subLM = f.subLM ?? (conLM && f.cantLM === null ? 0 : null);
      return {
        ...f,
        cantLM,
        subLM,
        difCant: f.cantCTV !== null && cantLM !== null ? f.cantCTV - cantLM : null,
        dif: f.subCTV !== null && subLM !== null ? f.subCTV - subLM : null,
      };
    })
    .sort((a, b) => ordenar(a.tarea, b.tarea));
};

/**
 * La comparativa de un mes de Contable (05/11/2026): la tabla del mes con las
 * tareas de Citrusvil juntadas por la de La Martina que les toca.
 *
 * Es de un campo (Berdina o San Pablo, :campo en la URL): solo van las filas
 * con ese almacén. Se entra desde ContableComparativaCampos.jsx; un campo que
 * no existe da el 404.
 *
 * Dos solapas: "Pagado por CTV" (el Excel de Citrusvil) y "Certificado en LM"
 * (los partes de la planilla de carga de ese campo y ese mes, con el cálculo
 * de Contable - Pagos). La de LM se trae recién al abrirla.
 */
function ContableComparativa() {
  const { anio, mes, campo: campoId } = useParams();
  const campo = CAMPOS_COMPARATIVA.find((c) => c.id === campoId);
  const clave = `${anio}/${mes}`;
  const enMemoria = memoriaTablas.get(clave);

  const [filas, setFilas] = useState(enMemoria?.filas || []);
  const [equivalencias, setEquivalencias] = useState([]);
  const [tareas, setTareas] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [filtro, setFiltro] = useState(FILTRO_VACIO);
  // El grupo que se está mirando en detalle.
  const [detalle, setDetalle] = useState(null);
  const navigate = useNavigate();
  const [solapa, setSolapa] = useState("ctv");
  // Lo certificado en LM: null hasta que se abre la solapa.
  const [lm, setLm] = useState(null);

  const titulo = `${MESES[Number(mes) - 1] || ""} ${anio}`;
  const tituloCampo = campo ? `${campo.titulo} - ${titulo}` : titulo;

  useEffect(() => {
    let vigente = true;
    Promise.all([
      api.get(`/contable/filas/${anio}/${mes}`).catch(() => null),
      api.get("/contable/equivalencias").catch(() => null),
      api.get("/tareas").catch(() => []),
    ])
      .then(([datos, eq, lista]) => {
        if (datos) {
          memoriaTablas.set(clave, { filas: Array.isArray(datos.filas) ? datos.filas : [], tabla: datos.tabla || null });
        }
        if (!vigente) return;
        if (datos) setFilas(Array.isArray(datos.filas) ? datos.filas : []);
        setEquivalencias(Array.isArray(eq?.equivalencias) ? eq.equivalencias : []);
        setTareas(Array.isArray(lista) ? lista : lista?.data || []);
      })
      .finally(() => vigente && setCargando(false));
    return () => {
      vigente = false;
    };
  }, [anio, mes, clave]);

  // "Certificado en LM": los partes del período de ese campo, sus precios,
  // las correcciones a mano y quiénes están "sin contar", igual que Pagos.
  useEffect(() => {
    if ((solapa !== "lm" && solapa !== "comp") || lm || !campo) return;
    let vigente = true;
    const q = `establecimiento=${campo.id}`;
    (async () => {
      try {
        const [periodo, variables, cambios, descuentos] = await Promise.all([
          api.get(`/periodos/${anio}/${mes}?${q}`),
          api.get(`/variables?${q}`).catch(() => []),
          api.get(`/cambios/${anio}/${mes}?${q}`).catch(() => []),
          api.get(`/descuentos/${anio}/${mes}?${q}`).catch(() => []),
        ]);
        const desde = (periodo?.desde || "").slice(0, 10);
        const hasta = (periodo?.hasta || "").slice(0, 10);
        const claveMes = `${anio}-${String(mes).padStart(2, "0")}`;
        const partes = await api.get(
          `/partes?desde=${desde}&hasta=${hasta}&periodo=${claveMes}&resumen=1&${q}`
        );
        // "Uso interno" no es una persona: no se certifica (27/10/2026).
        const deVerdad = (Array.isArray(partes) ? partes : []).filter((p) => !p.persona?.usoInterno);
        const { filas: filasCert } = calcularCertificado(
          deVerdad,
          Array.isArray(variables) ? variables : [],
          calcularAjustes(Array.isArray(cambios) ? cambios : []),
          campo.id
        );
        const excluidos = new Set((Array.isArray(descuentos) ? descuentos : []).filter((d) => d.excluido).map((d) => d.persona));
        if (vigente) setLm({ filas: filasCert, excluidos, desde, hasta });
      } catch (err) {
        if (vigente) setLm({ filas: [], excluidos: new Set(), error: err.message });
      }
    })();
    return () => {
      vigente = false;
    };
  }, [solapa, lm, campo, anio, mes]);


  // Clave de Citrusvil → id de La Martina, e id → la tarea de La Martina.
  // Las tareas de La Martina que tienen alguna de Citrusvil.
  const conEquivalencia = useMemo(
    () => new Set(equivalencias.filter((e) => (e.citrusvil || []).length).map((e) => String(e.tarea))),
    [equivalencias]
  );
  const laMartinaDe = useMemo(() => {
    const m = new Map();
    for (const e of equivalencias) for (const c of e.citrusvil || []) m.set(claveTarea(c), String(e.tarea));
    return m;
  }, [equivalencias]);
  const tareaLM = useMemo(() => new Map(tareas.map((t) => [String(t._id), t])), [tareas]);

  // Solo las filas del campo: su "Denominación almacén", comparada sin
  // mayúsculas, acentos ni espacios.
  const filasCampo = useMemo(
    () => (campo ? filas.filter((f) => campo.almacenes.includes(claveTarea(f.almacen))) : []),
    [filas, campo]
  );
  const grupos = useMemo(() => agrupar(filasCampo, laMartinaDe, tareaLM), [filasCampo, laMartinaDe, tareaLM]);

  // El precio de CTV de cada tarea de La Martina en este campo.
  const preciosCTV = useMemo(() => {
    const m = new Map();
    for (const g of grupos) if (g.idLM && g.precio !== null) m.set(String(g.idLM), g.precio);
    return m;
  }, [grupos]);
  const gruposLM = useMemo(
    () => (lm && campo ? agruparLM(lm.filas, lm.excluidos, campo.titulo, preciosCTV, conEquivalencia) : []),
    [lm, campo, preciosCTV, conEquivalencia]
  );

  const gruposComp = useMemo(() => compararGrupos(grupos, gruposLM), [grupos, gruposLM]);

  // Lo de la solapa abierta.
  const esLM = solapa === "lm";
  const esComp = solapa === "comp";
  const activos = esComp ? gruposComp : esLM ? gruposLM : grupos;
  const cargandoActivo = esLM || esComp ? !lm || (cargando && !filas.length) : cargando && !filas.length;

  // Las opciones salen de todo el mes, no de lo ya filtrado.
  const opciones = useMemo(
    () => ({
      tarea: [...new Set(activos.map((g) => g.tarea).filter(Boolean))].sort(ordenar).map((v) => [v, v]),
    }),
    [activos]
  );
  const visibles = activos.filter(
    (g) =>
      filtro.tarea === FILTRO_VACIO.tarea || g.tarea === filtro.tarea
  );
  const total = visibles.reduce((a, g) => a + (g.subtotal || 0), 0);
  // Los totales de la Comparación: cada columna de plata, sumando lo que hay.
  const sumar = (campoSuma) => visibles.reduce((a, g) => a + (g[campoSuma] || 0), 0);
  const totalComp = esComp ? { subCTV: sumar("subCTV"), subLM: sumar("subLM"), dif: sumar("dif") } : null;
  const sinEquivalencia = activos.filter((g) => g.sinEquivalencia).length;

  const exportarExcel = async () => {
    try {
      if (esComp) {
        await exportarPlanilla({
          titulo: `Comparativa — ${tituloCampo} — Comparación`,
          hoja: "Comparación",
          archivo: `Comparativa ${tituloCampo} Comparación.xlsx`,
          columnas: [
            { titulo: "Detalle de tarea", ancho: 40, negrita: true },
            { titulo: "Unidad", ancho: 12 },
            { titulo: "Precio unitario CTV", ancho: 18, moneda: true },
            { titulo: "Cant. CTV", ancho: 12 },
            { titulo: "Cant. LM", ancho: 12 },
            { titulo: "Dif. cant.", ancho: 12 },
            { titulo: "Subtotal CTV", ancho: 18, moneda: true },
            { titulo: "Subtotal LM", ancho: 18, moneda: true },
            { titulo: "Diferencia", ancho: 18, moneda: true },
          ],
          filas: [
            ...visibles.map((g) => [
              g.sinEquivalencia ? `${g.tarea} (sin equivalencia)` : g.tarea,
              g.unidad,
              g.precio ?? "-",
              g.cantCTV ?? "-",
              g.cantLM ?? "-",
              g.difCant ?? "-",
              g.subCTV ?? "-",
              g.subLM ?? "-",
              g.dif ?? "-",
            ]),
            ["TOTAL", "", "", "", "", "", totalComp.subCTV, totalComp.subLM, totalComp.dif],
          ],
        });
        return;
      }
      await exportarPlanilla({
        titulo: `Comparativa — ${tituloCampo} — ${esLM ? "Certificado en LM" : "Pagado por CTV"}`,
        hoja: esLM ? "Certificado en LM" : "Pagado por CTV",
        archivo: `Comparativa ${tituloCampo} ${esLM ? "LM" : "CTV"}.xlsx`,
        columnas: [
          { titulo: "Denominación almacén", ancho: 22 },
          { titulo: "Detalle de tarea", ancho: 40, negrita: true },
          { titulo: "Cant.", ancho: 12 },
          { titulo: "Unidad", ancho: 12 },
          { titulo: "Precio unitario", ancho: 16, moneda: true },
          { titulo: "Subtotal", ancho: 18, moneda: true },
        ],
        filas: [
          ...visibles.map((g) => [
            g.almacen,
            g.sinEquivalencia ? `${g.tarea} (sin equivalencia)` : g.tarea,
            g.cantidad,
            g.unidad,
            g.precio ?? "-",
            g.subtotal ?? "-",
          ]),
          ["TOTAL", "", "", "", "", total],
        ],
      });
    } catch (err) {
      Swal.fire({ icon: "error", title: "No se pudo exportar", text: err.message, width: "300px" });
    }
  };

  if (!campo) return <Error404 />;

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
        style={{ maxWidth: "1100px", width: "100%", margin: "0 auto", minHeight: 0 }}
      >
        {/* Encabezado. El volver está en el navbar de Contable, arriba. */}
        <div className="d-flex align-items-center gap-3 mb-3 flex-wrap">
          <span className="fw-bold" style={{ color: "#164e63", fontSize: "1.05rem" }}>
            Comparativa - {tituloCampo}
          </span>
          {!cargandoActivo && sinEquivalencia > 0 && (
            <span
              className="px-2 py-1 rounded-3 fw-semibold"
              style={{ fontSize: "0.75rem", backgroundColor: "#fef3c7", color: "#92400e" }}
              title="Se cargan en Contable › Equivalencias tareas"
            >
              {sinEquivalencia} {sinEquivalencia === 1 ? "tarea sin equivalencia" : "tareas sin equivalencia"}
            </span>
          )}
          <Button
            size="sm"
            onClick={exportarExcel}
            disabled={cargandoActivo || !activos.length}
            className="rounded-3 px-3 d-flex align-items-center gap-2 ms-auto"
            style={{
              backgroundColor: "#15803d",
              borderColor: "#15803d",
              fontSize: "0.78rem",
              height: "30px",
              fontWeight: 600,
            }}
            title="Exportar la comparativa a Excel"
          >
            <i className="bi bi-file-earmark-excel-fill"></i>
            <span>Excel</span>
          </Button>
        </div>

        {/* Filtros */}
        <Card className="mb-3 p-2 shadow-sm border-0 rounded-3" style={{ maxWidth: "100%" }}>
          <div className="d-flex align-items-center gap-3 flex-wrap">
            <FiltroSelect
              etiqueta="Tarea"
              ancho="280px"
              valor={filtro.tarea}
              vacio={FILTRO_VACIO.tarea}
              onChange={(v) => setFiltro((f) => ({ ...f, tarea: v }))}
              opciones={opciones.tarea}
            />
          </div>
        </Card>

        {/* Las solapas, pegadas arriba de la tabla (como las de Equivalencias
            de tareas): lo pagado por Citrusvil y lo certificado en La Martina. */}
        <div className="d-flex align-items-end gap-1 flex-shrink-0" style={{ marginBottom: "-1px" }}>
          {[
            ["ctv", "Pagado por CTV", "bi-cash-coin"],
            ["lm", "Certificado en LM", "bi-file-earmark-check"],
            ["comp", "Comparación", "bi-arrow-left-right"],
          ].map(([id, rotulo, icono]) => {
            const activa = solapa === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => {
                  setSolapa(id);
                  setFiltro(FILTRO_VACIO);
                }}
                className="d-flex align-items-center gap-2 px-3 py-1 fw-semibold"
                style={{
                  fontSize: "0.8rem",
                  border: "1px solid #cbd5e1",
                  borderBottom: activa ? "1px solid #164e63" : "1px solid #cbd5e1",
                  borderTopLeftRadius: "0.5rem",
                  borderTopRightRadius: "0.5rem",
                  backgroundColor: activa ? "#164e63" : "#fff",
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

        <div
          className="shadow-sm bg-white"
          style={{
            flex: "1 1 auto",
            minHeight: 0,
            width: "100%",
            overflowY: "auto",
            overflowX: "hidden",
            border: "1px solid #cbd5e1",
            borderRadius: "0 0.5rem 0.5rem 0.5rem",
          }}
        >
          {esComp ? (
          <Table className="mb-0 tabla-informe" style={{ width: "100%" }}>
            <thead style={{ position: "sticky", top: 0, zIndex: 10, backgroundColor: "#164e63", color: "#fff" }}>
              <tr>
                <th style={th}>Detalle de tarea</th>
                <th style={{ ...th, width: "70px", textAlign: "center" }}>Unidad</th>
                <th style={{ ...th, width: "100px", textAlign: "center" }}>Precio unitario CTV</th>
                {/* Líneas gruesas (col-corte, index.css) que separan el bloque
                    de cantidades del de plata. */}
                <th className="col-corte" style={{ ...th, width: "80px", textAlign: "center" }}>Cant. CTV</th>
                <th style={{ ...th, width: "80px", textAlign: "center" }}>Cant. LM</th>
                <th style={{ ...th, width: "80px", textAlign: "center" }}>Dif. cant.</th>
                <th className="col-corte" style={{ ...th, width: "115px", textAlign: "center" }}>Subtotal CTV</th>
                <th style={{ ...th, width: "115px", textAlign: "center" }}>Subtotal LM</th>
                <th style={{ ...th, width: "115px", textAlign: "center" }}>Diferencia</th>
              </tr>
            </thead>
            <tbody>
              {cargandoActivo ? (
                <tr>
                  <td colSpan={9} className="text-center text-muted py-4" style={td}>
                    <Spinner animation="border" size="sm" style={{ color: "#0e7490" }} />
                  </td>
                </tr>
              ) : !visibles.length ? (
                <tr>
                  <td colSpan={9} className="text-center text-muted py-4" style={td}>
                    {activos.length ? "Ninguna fila coincide con los filtros" : "No hay nada que comparar en este mes"}
                  </td>
                </tr>
              ) : (
                <>
                  {visibles.map((g) => {
                    // La diferencia en verde si CTV pagó más que lo certificado
                    // y en rojo si pagó menos.
                    const colorDif = (v) => (v > 0.005 ? "#15803d" : v < -0.005 ? "#dc2626" : undefined);
                    return (
                      <tr key={g.clave}>
                        <td style={td}>
                          <span
                            className={g.sinEquivalencia ? "px-2 rounded-2" : undefined}
                            style={
                              g.sinEquivalencia
                                ? { fontWeight: 700, color: AMBAR_TEXTO, backgroundColor: "#fde68a" }
                                : { fontWeight: 600 }
                            }
                            title={g.sinEquivalencia ? "Sin equivalencia entre las tareas de CTV y de LM" : undefined}
                          >
                            {g.tarea || raya}
                          </span>
                        </td>
                        <td style={{ ...td, textAlign: "center" }}>{g.unidad || raya}</td>
                        <td style={{ ...td, textAlign: "center", whiteSpace: "nowrap" }}>{pesos(g.precio) ?? raya}</td>
                        <td className="col-corte" style={{ ...td, textAlign: "center" }}>{cantidad(g.cantCTV) ?? raya}</td>
                        <td style={{ ...td, textAlign: "center" }}>{cantidad(g.cantLM) ?? raya}</td>
                        <td style={{ ...td, textAlign: "center", fontWeight: 600, color: colorDif(g.difCant) }}>
                          {cantidad(g.difCant) ?? raya}
                        </td>
                        <td className="col-corte" style={{ ...td, textAlign: "center", whiteSpace: "nowrap" }}>
                          {pesos(g.subCTV) ?? raya}
                        </td>
                        <td style={{ ...td, textAlign: "center", whiteSpace: "nowrap" }}>{pesos(g.subLM) ?? raya}</td>
                        <td style={{ ...td, textAlign: "center", whiteSpace: "nowrap", fontWeight: 700, color: colorDif(g.dif) }}>
                          {pesos(g.dif) ?? raya}
                        </td>
                      </tr>
                    );
                  })}
                  <tr className="fila-total">
                    <td style={{ ...td, fontWeight: 700, color: "#164e63" }}>TOTAL</td>
                    <td style={td}></td>
                    <td style={td}></td>
                    <td className="col-corte" style={td}></td>
                    <td style={td}></td>
                    <td style={td}></td>
                    <td className="col-corte" style={{ ...td, textAlign: "center", fontWeight: 700, whiteSpace: "nowrap" }}>
                      {pesos(totalComp.subCTV)}
                    </td>
                    <td style={{ ...td, textAlign: "center", fontWeight: 700, whiteSpace: "nowrap" }}>{pesos(totalComp.subLM)}</td>
                    <td
                      style={{
                        ...td,
                        textAlign: "center",
                        fontWeight: 700,
                        whiteSpace: "nowrap",
                        color: totalComp.dif > 0.005 ? "#15803d" : totalComp.dif < -0.005 ? "#dc2626" : undefined,
                      }}
                    >
                      {pesos(totalComp.dif)}
                    </td>
                  </tr>
                </>
              )}
            </tbody>
          </Table>
          ) : (
          <Table className="mb-0 tabla-informe" style={{ width: "100%" }}>
            <thead style={{ position: "sticky", top: 0, zIndex: 10, backgroundColor: "#164e63", color: "#fff" }}>
              <tr>
                <th style={{ ...th, width: "16%" }}>Denominación almacén</th>
                <th style={th}>Detalle de tarea</th>
                <th style={{ ...th, width: "90px", textAlign: "center" }}>Cant.</th>
                <th style={{ ...th, width: "80px", textAlign: "center" }}>Unidad</th>
                <th style={{ ...th, width: "120px", textAlign: "center" }}>Precio unitario</th>
                <th style={{ ...th, width: "130px", textAlign: "center" }}>Subtotal</th>
              </tr>
            </thead>
            <tbody>
              {cargandoActivo ? (
                <tr>
                  <td colSpan={6} className="text-center text-muted py-4" style={td}>
                    <Spinner animation="border" size="sm" style={{ color: "#0e7490" }} />
                  </td>
                </tr>
              ) : !visibles.length ? (
                <tr>
                  <td colSpan={6} className="text-center text-muted py-4" style={td}>
                    {lm?.error && esLM
                      ? `No se pudo traer lo certificado: ${lm.error}`
                      : activos.length
                        ? "Ninguna fila coincide con los filtros"
                        : esLM
                          ? "No hay partes cargados en este mes"
                          : "Este mes todavía no tiene tabla"}
                  </td>
                </tr>
              ) : (
                <>
                  {visibles.map((g) => {
                    // Las sin equivalencia: solo el nombre de la tarea va
                    // destacado en ámbar, el resto de la fila queda igual.
                    const c = td;
                    return (
                      <tr
                        key={g.clave}
                        onClick={() => setDetalle(g)}
                        style={{ cursor: "pointer" }}
                        title="Ver el detalle"
                      >
                        <td style={c}>{g.almacen || raya}</td>
                        <td style={c}>
                          <span
                            className={g.sinEquivalencia ? "px-2 rounded-2" : undefined}
                            style={
                              g.sinEquivalencia
                                ? { fontWeight: 700, color: AMBAR_TEXTO, backgroundColor: "#fde68a" }
                                : { fontWeight: 600 }
                            }
                            title={g.sinEquivalencia ? "Sin equivalencia: no tiene tarea de La Martina" : undefined}
                          >
                            {g.tarea || raya}
                          </span>
                        </td>
                        <td style={{ ...c, textAlign: "center" }}>{cantidad(g.cantidad) ?? raya}</td>
                        <td style={{ ...c, textAlign: "center" }}>{g.unidad || raya}</td>
                        {/* Sin precio en CTV: la raya gris. */}
                        <td style={{ ...c, textAlign: "center", whiteSpace: "nowrap" }}>{pesos(g.precio) ?? raya}</td>
                        <td style={{ ...c, textAlign: "center", whiteSpace: "nowrap" }}>{pesos(g.subtotal) ?? raya}</td>
                      </tr>
                    );
                  })}
                  <tr className="fila-total">
                    <td style={{ ...td, fontWeight: 700, color: "#164e63" }}>TOTAL</td>
                    <td style={td}></td>
                    <td style={td}></td>
                    <td style={td}></td>
                    <td style={td}></td>
                    <td style={{ ...td, textAlign: "center", fontWeight: 700, whiteSpace: "nowrap" }}>{pesos(total)}</td>
                  </tr>
                </>
              )}
            </tbody>
          </Table>
          )}
        </div>
      </Container>

      {/* El detalle de un grupo: las filas del Excel que lo forman. */}
      <Modal
        show={Boolean(detalle)}
        onHide={() => setDetalle(null)}
        centered
        size="xl"
        contentClassName="border-0 shadow-lg rounded-4"
      >
        <Modal.Header
          closeButton
          closeVariant="white"
          style={{
            backgroundColor: "#164e63",
            color: "#fff",
            borderTopLeftRadius: "1rem",
            borderTopRightRadius: "1rem",
            borderBottom: "1px solid rgba(255,255,255,0.1)",
          }}
        >
          <Modal.Title className="fs-6 fw-bold d-flex align-items-center gap-2 text-white flex-wrap">
            <i className="bi bi-bar-chart-line" style={{ color: "#67e8f9" }}></i>
            <span>{detalle?.tarea}</span>
            <span className="fw-normal" style={{ fontSize: "0.82rem", opacity: 0.8 }}>
              · {detalle?.almacen}
            </span>
          </Modal.Title>
        </Modal.Header>
        <Modal.Body className="p-3">
          {detalle?.sinEquivalencia && (
            <div
              className="d-flex align-items-center gap-2 mb-2 px-3 py-2 rounded-3 flex-wrap"
              style={{ backgroundColor: AMBAR, color: AMBAR_TEXTO, fontSize: "0.8rem" }}
            >
              <i className="bi bi-exclamation-triangle-fill" style={{ color: "#d97706" }}></i>
              <span className="fw-semibold">
                {detalle?.personas
                  ? "Esta tarea de La Martina todavía no tiene ninguna tarea de Citrusvil."
                  : "Esta tarea de Citrusvil todavía no tiene tarea de La Martina."}
              </span>
              <button
                className="btn btn-sm ms-auto d-flex align-items-center gap-1 px-3"
                style={{ backgroundColor: "#0e7490", borderColor: "#0e7490", color: "#fff", fontSize: "0.78rem" }}
                onClick={() => navigate("/contable/equivalencias")}
              >
                <i className="bi bi-arrow-left-right"></i>
                Cargar la equivalencia
              </button>
            </div>
          )}
          {detalle?.personas ? (
          // Certificado en LM: una fila por persona, como en Contable - Pagos.
          <div className="rounded-3 bg-white" style={{ maxHeight: "60vh", overflowY: "auto", border: "1px solid #cbd5e1" }}>
            <Table className="mb-0 tabla-informe" style={{ width: "100%" }}>
              <thead style={{ position: "sticky", top: 0, zIndex: 10, backgroundColor: "#164e63", color: "#fff" }}>
                <tr>
                  <th style={{ ...th, textAlign: "center" }}>Legajo</th>
                  <th style={th}>Personal</th>
                  <th style={th}>Cliente</th>
                  <th style={{ ...th, textAlign: "center" }}>Cant.</th>
                  <th style={{ ...th, textAlign: "center" }}>Unidad</th>
                  <th style={{ ...th, textAlign: "center" }}>Precio unitario</th>
                  <th style={{ ...th, textAlign: "center" }}>Importe</th>
                </tr>
              </thead>
              <tbody>
                {[...detalle.personas]
                  .sort((a, b) => ordenar(a.persona, b.persona) || Number(a.alto) - Number(b.alto))
                  .map((f) => (
                    <tr key={f.clave}>
                      <td style={{ ...td, textAlign: "center" }}>{f.legajo || raya}</td>
                      <td style={td}>
                        {f.persona}
                        {f.alto && (
                          <span className="ms-2" style={{ fontSize: "0.64rem", color: "#0e7490", fontWeight: 700 }}>
                            alto Rto.
                          </span>
                        )}
                      </td>
                      <td style={td}>{f.cliente || raya}</td>
                      <td style={{ ...td, textAlign: "center" }}>{cantidad(f.cantidad) ?? raya}</td>
                      <td style={{ ...td, textAlign: "center" }}>{f.unidad || raya}</td>
                      <td style={{ ...td, textAlign: "center", whiteSpace: "nowrap" }}>{pesos(f.precio) ?? raya}</td>
                      <td style={{ ...td, textAlign: "center", whiteSpace: "nowrap" }}>{pesos(f.importe) ?? raya}</td>
                    </tr>
                  ))}
                <tr className="fila-total">
                  <td style={{ ...td, fontWeight: 700, color: "#164e63" }}>TOTAL</td>
                  <td style={td}></td>
                  <td style={td}></td>
                  <td style={{ ...td, textAlign: "center", fontWeight: 700 }}>{cantidad(detalle.cantidad)}</td>
                  <td style={{ ...td, textAlign: "center", fontWeight: 700 }}>{detalle.unidad}</td>
                  <td style={{ ...td, textAlign: "center", fontWeight: 700, whiteSpace: "nowrap" }}>
                    {pesos(detalle.precio) ?? raya}
                  </td>
                  <td style={{ ...td, textAlign: "center", fontWeight: 700, whiteSpace: "nowrap" }}>
                    {pesos(detalle.subtotal) ?? raya}
                  </td>
                </tr>
              </tbody>
            </Table>
          </div>
          ) : (
          <div className="rounded-3 bg-white" style={{ maxHeight: "60vh", overflowY: "auto", border: "1px solid #cbd5e1" }}>
            <Table className="mb-0 tabla-informe" style={{ width: "100%" }}>
              <thead style={{ position: "sticky", top: 0, zIndex: 10, backgroundColor: "#164e63", color: "#fff" }}>
                <tr>
                  <th style={{ ...th, textAlign: "center" }}>Fecha</th>
                  <th style={{ ...th, textAlign: "center" }}>Documento compras</th>
                  <th style={{ ...th, textAlign: "center" }}>Orden de trabajo</th>
                  <th style={th}>Tarea Citrusvil</th>
                  <th style={{ ...th, textAlign: "center" }}>Cant.</th>
                  <th style={{ ...th, textAlign: "center" }}>Unidad</th>
                  <th style={{ ...th, textAlign: "center" }}>Precio unitario</th>
                  <th style={{ ...th, textAlign: "center" }}>Subtotal</th>
                  <th style={th}>Centro de costo</th>
                  <th style={th}>Activo fijo</th>
                </tr>
              </thead>
              <tbody>
                {(detalle?.filas || []).map((f) => (
                  <tr key={f._id}>
                    <td style={{ ...td, textAlign: "center", whiteSpace: "nowrap" }}>{fecha(f.fecha) ?? raya}</td>
                    <td style={{ ...td, textAlign: "center" }}>{f.documentoCompras || raya}</td>
                    <td style={{ ...td, textAlign: "center" }}>{f.ordenTrabajo || raya}</td>
                    <td style={td}>{f.tarea || raya}</td>
                    <td style={{ ...td, textAlign: "center" }}>{cantidad(f.cantidad) ?? raya}</td>
                    <td style={{ ...td, textAlign: "center" }}>{f.unidad || raya}</td>
                    <td style={{ ...td, textAlign: "center", whiteSpace: "nowrap" }}>{pesos(f.precioUnitario) ?? raya}</td>
                    <td style={{ ...td, textAlign: "center", whiteSpace: "nowrap" }}>{pesos(f.subtotal) ?? raya}</td>
                    <td style={td}>{f.centroCosto || raya}</td>
                    <td style={td}>{f.activoFijo || raya}</td>
                  </tr>
                ))}
                {detalle && (
                  <tr className="fila-total">
                    <td style={{ ...td, fontWeight: 700, color: "#164e63" }}>TOTAL</td>
                    <td style={td}></td>
                    <td style={td}></td>
                    <td style={td}></td>
                    <td style={{ ...td, textAlign: "center", fontWeight: 700 }}>{cantidad(detalle.cantidad)}</td>
                    <td style={{ ...td, textAlign: "center", fontWeight: 700 }}>{detalle.unidad}</td>
                    <td style={{ ...td, textAlign: "center", fontWeight: 700, whiteSpace: "nowrap" }}>
                      {pesos(detalle.precio) ?? raya}
                    </td>
                    <td style={{ ...td, textAlign: "center", fontWeight: 700, whiteSpace: "nowrap" }}>
                      {pesos(detalle.subtotal) ?? raya}
                    </td>
                    <td style={td}></td>
                    <td style={td}></td>
                  </tr>
                )}
              </tbody>
            </Table>
          </div>
          )}
        </Modal.Body>
      </Modal>
    </div>
  );
}

export default ContableComparativa;
