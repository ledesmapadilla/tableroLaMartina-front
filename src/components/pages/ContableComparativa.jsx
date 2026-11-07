import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { Button, Card, Container, Modal, Spinner, Table } from "react-bootstrap";
import Swal from "sweetalert2";
import { api } from "../../services/api";
import { CAMPOS_COMPARATIVA, MESES, TIPOS_COMPARATIVA, claveTarea, memoriaTablas } from "../../utils/contable";
import Error404 from "./Error404";
import ContableGraficosCostos from "./ContableGraficosCostos";
import { calcularAjustes, calcularCertificado } from "../../utils/certificado";
import { precioVigente } from "../../utils/altoRendimiento";
import { exportarPlanilla } from "../../helpers/excel";
import SelectBuscador from "../shared/SelectBuscador";

const TH = {
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
const FiltroSelect = ({ etiqueta, ancho, valor, vacio, onChange, opciones, colores = COLORES_BUSCADOR }) => {
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
            colores={colores}
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
 * Las tareas de La Martina que se comparan juntas (06/11/2026). Una de
 * Citrusvil puede estar en varias de La Martina; lo que pagó Citrusvil por
 * ella no se puede repartir, así que esas tareas de La Martina van en una
 * sola fila ("Herbicida + Herbicida Bajo Volumen") y se compara lo pagado
 * contra lo certificado entre todas, sin contar nada dos veces. Las que
 * comparten se encadenan: si A y B comparten una y B y C otra, van A, B y C.
 *
 * → { grupoDe: id de La Martina → id del grupo, tareaDe: id del grupo →
 *     { tarea: nombre (los nombres unidos con " + "), unidad } }
 */
const juntarTareasLM = (equivalencias, tareas) => {
  const padre = new Map();
  const raiz = (x) => {
    while (padre.get(x) !== x) x = padre.get(x);
    return x;
  };
  const unir = (a, b) => {
    const ra = raiz(a);
    const rb = raiz(b);
    if (ra !== rb) padre.set(rb, ra);
  };
  const primeraDe = new Map(); // clave de Citrusvil → primera tarea de La Martina que la tiene
  for (const e of equivalencias) {
    const id = String(e.tarea);
    if (!padre.has(id)) padre.set(id, id);
    for (const c of e.citrusvil || []) {
      const k = claveTarea(c);
      if (primeraDe.has(k)) unir(primeraDe.get(k), id);
      else primeraDe.set(k, id);
    }
  }
  const porId = new Map(tareas.map((t) => [String(t._id), t]));
  const miembros = new Map();
  for (const id of padre.keys()) {
    const r = raiz(id);
    miembros.set(r, [...(miembros.get(r) || []), id]);
  }
  const grupoDe = new Map();
  const tareaDe = new Map();
  for (const [r, ids] of miembros) {
    const lista = ids.map((id) => porId.get(id)).filter(Boolean);
    for (const id of ids) grupoDe.set(id, r);
    tareaDe.set(r, {
      tarea: lista.map((t) => t.tarea).sort(ordenar).join(" + "),
      unidad: lista[0]?.unidad || "",
      juntas: lista.length > 1,
    });
  }
  return { grupoDe, tareaDe };
};

/**
 * Lo certificado en La Martina en el mes, por tarea (la solapa "Certificado
 * en LM", 05/11/2026). Sale del mismo cálculo que Contable - Pagos
 * (utils/certificado.js): una fila por persona y tarea, que acá se juntan por
 * tarea. Las personas que en Pagos están "sin contar" no cuentan.
 *
 * El precio unitario es el de "Pagado por Ctv" para la misma tarea de La
 * Martina en el mismo campo (`preciosCTV`: id de la tarea → precio), y el
 * subtotal, la cantidad certificada por ese precio (05/11/2026): así se ve
 * cuánto valdría lo certificado a lo que paga Citrusvil. Una tarea que no
 * está en Ctv queda sin precio ni subtotal.
 *
 * `conEquivalencia` son los id de las tareas de La Martina que tienen alguna
 * de Citrusvil en Equivalencias de tareas: las demás van destacadas, igual
 * que en "Pagado por Ctv".
 *
 * Con `precioPersonal` (Comparativa costos tarea, 07/11/2026) el precio es
 * el que se le paga a la gente: el de Variables de remuneración del campo,
 * con el mismo cálculo que Pagos (cliente, vigencia, alto rendimiento y
 * correcciones a mano). Si en la tarea hay más de un precio, va el promedio
 * de lo certificado, que es lo que cierra con el subtotal.
 */
const agruparLM = (filasCert, excluidos, almacen, preciosCTV, conEquivalencia, juntas, precioPersonal = false) => {
  const grupos = new Map();
  for (const f of filasCert) {
    if (excluidos.has(f.idPersona)) continue;
    // Las que comparten una tarea de Citrusvil van juntas (juntarTareasLM).
    const id = String(f.idTarea);
    const grupo = juntas.grupoDe.get(id) || id;
    let g = grupos.get(grupo);
    if (!g) {
      const junta = juntas.tareaDe.get(grupo);
      g = {
        clave: `lm:${grupo}`,
        almacen,
        tarea: junta?.tarea || f.tarea,
        unidad: junta?.unidad || f.unidad,
        cantidad: 0,
        precio: preciosCTV.get(grupo) ?? null,
        sinEquivalencia: !conEquivalencia.has(id),
        personas: [],
      };
      grupos.set(grupo, g);
    }
    g.cantidad += f.cantidad || 0;
    g.personas.push(f);
  }
  if (precioPersonal) {
    return [...grupos.values()]
      .map((g) => {
        const conImporte = g.personas.filter((p) => p.importe !== null && p.importe !== undefined);
        const subtotal = conImporte.length ? conImporte.reduce((a, p) => a + p.importe, 0) : null;
        const cantConPrecio = conImporte.reduce((a, p) => a + (p.cantidad || 0), 0);
        const precios = new Set(conImporte.map((p) => p.precio).filter((p) => p !== null && p !== undefined));
        const precio =
          precios.size === 1 ? [...precios][0] : cantConPrecio ? subtotal / cantConPrecio : null;
        return { ...g, precio, subtotal, variosPrecios: precios.size > 1 };
      })
      .sort((a, b) => ordenar(a.tarea, b.tarea));
  }
  return [...grupos.values()]
    .map((g) => ({
      ...g,
      subtotal: g.precio === null ? null : g.cantidad * g.precio,
      // Cada persona también al precio de Ctv, para el detalle.
      personas: g.personas.map((p) => ({
        ...p,
        precio: g.precio,
        importe: g.precio === null ? null : (p.cantidad || 0) * g.precio,
      })),
    }))
    .sort((a, b) => ordenar(a.tarea, b.tarea));
};

/**
 * La solapa "Comparativa" (antes "Comparación") (05/11/2026): lo pagado por Citrusvil contra lo
 * certificado en La Martina, una fila por tarea de La Martina. Las
 * diferencias son Ctv − LM: positiva, Citrusvil pagó más de lo certificado.
 *
 * Van también las que están de un solo lado: una de Citrusvil sin
 * equivalencia (no hay con qué compararla en LM) y una certificada en LM sin
 * nada en Ctv (sin precio de Ctv no se puede valuar). La diferencia va en
 * todas las filas (06/11/2026): lo que falta de un lado cuenta como cero.
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
        // El precio de LM (en la de costos, lo que se le paga a la gente).
        precioLM: null,
        variosPreciosLM: false,
        cantCTV: null,
        cantLM: null,
        subCTV: null,
        subLM: null,
        sinEquivalencia: false,
        // Para el historial: las filas del Excel y el grupo de La Martina.
        filasCtv: [],
        grupoLM: null,
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
    f.filasCtv.push(...(g.filas || []));
    if (g.idLM) f.grupoLM = String(g.idLM);
  }
  for (const g of gruposLM) {
    const f = fila(g.clave, g);
    f.grupoLM = g.clave.slice(3);
    f.cantLM = (f.cantLM || 0) + g.cantidad;
    if (g.subtotal !== null) f.subLM = (f.subLM || 0) + g.subtotal;
    if (g.precio !== null) f.precioLM = g.precio;
    if (g.variosPrecios) f.variosPreciosLM = true;
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
        difCant: (f.cantCTV || 0) - (cantLM || 0),
        dif: (f.subCTV || 0) - (subLM || 0),
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
 * Dos solapas: "Pagado por Ctv" (el Excel de Citrusvil) y "Certificado en LM"
 * (los partes de la planilla de carga de ese campo y ese mes, con el cálculo
 * de Contable - Pagos). La de LM se trae recién al abrirla.
 */
function ContableComparativa({ tipo = "cantidad", graficos = false }) {
  // Con `graficos` (07/11/2026, solo la de costos) se ven los gráficos de
  // precios con los mismos números de la solapa Comparativa.
  const location = useLocation();
  const [rangoInicial] = useState(() => location.state?.rango || null);
  // Cantidad tareas o costos tarea (07/11/2026): por ahora lo mismo.
  const { titulo: nombre, colores: col } = TIPOS_COMPARATIVA[tipo] || TIPOS_COMPARATIVA.cantidad;
  // Los encabezados de las tablas, con el color de esta comparativa.
  const th = { ...TH, backgroundColor: col.oscuro };
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
  // La fila de la Comparativa cuyo historial se está mirando (07/11/2026).
  const [historial, setHistorial] = useState(null);
  const navigate = useNavigate();
  const [solapa, setSolapa] = useState(graficos ? "comp" : "ctv");
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

  // Lo del mes que no depende de las fechas: el período de la certificación,
  // los precios, las correcciones a mano y quiénes están "sin contar".
  const [base, setBase] = useState(null);
  // El rango de fechas de los partes (07/11/2026): arranca con el inicio y el
  // cierre de la certificación y se puede cambiar para traer más o menos.
  const [rango, setRango] = useState(null);

  useEffect(() => {
    if ((solapa !== "lm" && solapa !== "comp") || base || !campo) return;
    let vigente = true;
    const q = `establecimiento=${campo.id}`;
    Promise.all([
      api.get(`/periodos/${anio}/${mes}?${q}`),
      api.get(`/variables?${q}`).catch(() => []),
      api.get(`/cambios/${anio}/${mes}?${q}`).catch(() => []),
      api.get(`/descuentos/${anio}/${mes}?${q}`).catch(() => []),
    ])
      .then(([periodo, variables, cambios, descuentos]) => {
        if (!vigente) return;
        const desde = (periodo?.desde || "").slice(0, 10);
        const hasta = (periodo?.hasta || "").slice(0, 10);
        setBase({
          desde,
          hasta,
          variables: Array.isArray(variables) ? variables : [],
          ajustes: calcularAjustes(Array.isArray(cambios) ? cambios : []),
          excluidos: new Set((Array.isArray(descuentos) ? descuentos : []).filter((d) => d.excluido).map((d) => d.persona)),
        });
        // Desde la comparativa a los gráficos se pasa el rango que se estaba
        // mirando; si no, las fechas de la certificación.
        const valida = (f) => /^(19|20)\d{2}-\d{2}-\d{2}$/.test(f || "");
        setRango(
          valida(rangoInicial?.desde) && valida(rangoInicial?.hasta) && rangoInicial.desde <= rangoInicial.hasta
            ? { desde: rangoInicial.desde, hasta: rangoInicial.hasta }
            : { desde, hasta }
        );
      })
      .catch((err) => {
        if (!vigente) return;
        setBase({ error: err.message });
        setLm({ filas: [], excluidos: new Set(), error: err.message });
      });
    return () => {
      vigente = false;
    };
  }, [solapa, base, campo, anio, mes, rangoInicial]);

  // Un rango que se puede pedir: las dos fechas completas y en orden. Mientras
  // se escribe una fecha a medias no se pide nada.
  const fechaCompleta = (f) => /^(19|20)\d{2}-\d{2}-\d{2}$/.test(f || "");
  const rangoValido = !!rango && fechaCompleta(rango.desde) && fechaCompleta(rango.hasta) && rango.desde <= rango.hasta;
  // Con las fechas de la certificación va igual que Pagos: también los partes
  // posteriores al cierre que se dejaron en este mes y sin los que se pasaron
  // a otro. Con otras fechas, todos los partes del rango, por fecha.
  const esRangoCert = !!base && !!rango && rango.desde === base.desde && rango.hasta === base.hasta;

  // "Certificado en LM": los partes del rango de ese campo, con el cálculo de
  // Contable - Pagos.
  const lmAlDia = !!lm && !!rango && lm.desde === rango.desde && lm.hasta === rango.hasta;
  useEffect(() => {
    if (!base || base.error || !rangoValido || lmAlDia || !campo) return;
    let vigente = true;
    const { desde, hasta } = rango;
    const claveMes = `${anio}-${String(mes).padStart(2, "0")}`;
    const periodo = esRangoCert ? `&periodo=${claveMes}` : "";
    api
      .get(`/partes?desde=${desde}&hasta=${hasta}${periodo}&resumen=1&establecimiento=${campo.id}`)
      .then((partes) => {
        if (!vigente) return;
        // "Uso interno" no es una persona: no se certifica (27/10/2026).
        const deVerdad = (Array.isArray(partes) ? partes : []).filter((p) => !p.persona?.usoInterno);
        const { filas: filasCert, diasPorPersona } = calcularCertificado(
          deVerdad,
          base.variables,
          base.ajustes,
          campo.id
        );
        setLm({ filas: filasCert, excluidos: base.excluidos, dias: diasPorPersona, desde, hasta });
      })
      .catch((err) => vigente && setLm({ filas: [], excluidos: new Set(), error: err.message, desde, hasta }));
    return () => {
      vigente = false;
    };
  }, [base, rango, rangoValido, lmAlDia, esRangoCert, campo, anio, mes]);


  // Clave de Citrusvil → id de La Martina, e id → la tarea de La Martina.
  // Las tareas de La Martina que tienen alguna de Citrusvil.
  const conEquivalencia = useMemo(
    () => new Set(equivalencias.filter((e) => (e.citrusvil || []).length).map((e) => String(e.tarea))),
    [equivalencias]
  );
  // Las tareas de La Martina que comparten una de Citrusvil, juntas.
  const juntas = useMemo(() => juntarTareasLM(equivalencias, tareas), [equivalencias, tareas]);
  // Clave de Citrusvil → el grupo de tareas de La Martina, y grupo → nombre.
  const laMartinaDe = useMemo(() => {
    const m = new Map();
    for (const e of equivalencias)
      for (const c of e.citrusvil || []) m.set(claveTarea(c), juntas.grupoDe.get(String(e.tarea)) || String(e.tarea));
    return m;
  }, [equivalencias, juntas]);
  const tareaLM = juntas.tareaDe;

  // Solo las filas del campo: su "Denominación almacén", comparada sin
  // mayúsculas, acentos ni espacios.
  const filasCampo = useMemo(
    () => (campo ? filas.filter((f) => campo.almacenes.includes(claveTarea(f.almacen))) : []),
    [filas, campo]
  );
  const grupos = useMemo(() => agrupar(filasCampo, laMartinaDe, tareaLM), [filasCampo, laMartinaDe, tareaLM]);

  // El precio de Ctv de cada tarea de La Martina en este campo.
  const preciosCTV = useMemo(() => {
    const m = new Map();
    for (const g of grupos) if (g.idLM && g.precio !== null) m.set(String(g.idLM), g.precio);
    return m;
  }, [grupos]);
  const gruposLM = useMemo(
    () => (lm && campo ? agruparLM(lm.filas, lm.excluidos, campo.titulo, preciosCTV, conEquivalencia, juntas) : []),
    [lm, campo, preciosCTV, conEquivalencia, juntas]
  );

  // En la de costos, la solapa de LM va con lo que se le paga a la gente
  // (Variables de remuneración de ese campo), y la Comparativa también
  // (07/11/2026): cuánto paga Ctv contra cuánto gasta LM.
  const esCostos = tipo === "costos";
  const gruposLMPersonal = useMemo(
    () =>
      esCostos && lm && campo
        ? agruparLM(lm.filas, lm.excluidos, campo.titulo, preciosCTV, conEquivalencia, juntas, true)
        : [],
    [esCostos, lm, campo, preciosCTV, conEquivalencia, juntas]
  );
  // En la de costos, una tarea sin partes en el período no tiene lo pagado
  // de dónde sacar el precio: va el vigente de Variables de remuneración del
  // campo al último día del rango, con el cliente Citrusvil (07/11/2026). Se
  // marca para que se vea que no sale de lo pagado. Con varias tareas juntas
  // ("A + B") y precios distintos, el promedio.
  const gruposComp = useMemo(() => {
    const comparados = compararGrupos(grupos, esCostos ? gruposLMPersonal : gruposLM);
    if (!esCostos || !base?.variables || !rango?.hasta) return comparados;
    const miembros = new Map();
    for (const [id, grupo] of juntas.grupoDe) miembros.set(grupo, [...(miembros.get(grupo) || []), id]);
    return comparados.map((f) => {
      if (f.precioLM !== null || !f.grupoLM) return f;
      const ids = miembros.get(f.grupoLM) || [f.grupoLM];
      const precios = [
        ...new Set(
          ids
            .map((id) => precioVigente(base.variables, id, "Citrusvil", rango.hasta)?.neto)
            .filter((p) => Number.isFinite(p))
        ),
      ];
      if (!precios.length) return f;
      return {
        ...f,
        precioLM: precios.reduce((a, p) => a + p, 0) / precios.length,
        variosPreciosLM: precios.length > 1,
        precioLMVariables: true,
      };
    });
  }, [grupos, gruposLM, gruposLMPersonal, esCostos, base, rango, juntas]);

  // El historial de una fila de la Comparativa, día por día: lo que pagó Ctv
  // (las filas del Excel por su fecha) contra lo certificado en LM (los partes
  // de ese día, de las personas que cuentan). Lo de LM va al precio de Ctv;
  // en la de costos, a lo que se le pagó a la gente ese día.
  const diasHistorial = useMemo(() => {
    if (!historial) return null;
    const porFecha = new Map();
    const dia = (f) => {
      if (!porFecha.has(f)) porFecha.set(f, { fecha: f, ctv: null, subCTV: null, lm: null });
      return porFecha.get(f);
    };
    for (const f of historial.filasCtv) {
      const d = dia(String(f.fecha || "").slice(0, 10));
      d.ctv = (d.ctv || 0) + (f.cantidad || 0);
      d.subCTV = (d.subCTV || 0) + (f.subtotal || 0);
    }
    if (historial.grupoLM && lm?.dias) {
      for (const [idPersona, lista] of lm.dias) {
        if (lm.excluidos.has(idPersona)) continue;
        for (const x of lista) {
          const id = String(x.idTarea);
          if ((juntas.grupoDe.get(id) || id) !== historial.grupoLM) continue;
          const d = dia(x.fecha);
          d.lm = (d.lm || 0) + (x.cantidad || 0);
          if (x.importe !== null && x.importe !== undefined) d.pagadoLM = (d.pagadoLM || 0) + x.importe;
        }
      }
    }
    const precio = historial.precio;
    const conPlata = (d) => {
      const subLM = esCostos ? (d.pagadoLM ?? null) : d.lm === null || precio === null ? null : d.lm * precio;
      return { ...d, subLM, difCant: (d.ctv || 0) - (d.lm || 0), dif: (d.subCTV || 0) - (subLM || 0) };
    };
    const dias = [...porFecha.values()].sort((a, b) => a.fecha.localeCompare(b.fecha)).map(conPlata);
    // Las correcciones a mano (Contable - Pagos) no son de un día: si el
    // total de LM no da la suma de los días, la diferencia va en su renglón.
    const sumaLM = dias.reduce((a, d) => a + (d.lm || 0), 0);
    const ajuste = (historial.cantLM || 0) - sumaLM;
    // En la de costos también la plata: una corrección de precio no cambia
    // la cantidad pero sí lo pagado.
    const ajustePlata = esCostos ? (historial.subLM || 0) - dias.reduce((a, d) => a + (d.subLM || 0), 0) : 0;
    if (Math.abs(ajuste) > 0.0005 || Math.abs(ajustePlata) > 0.005) {
      dias.push(
        conPlata({
          fecha: "ajuste",
          ctv: null,
          subCTV: null,
          lm: Math.abs(ajuste) > 0.0005 ? ajuste : null,
          pagadoLM: esCostos ? ajustePlata : null,
        })
      );
    }
    return dias;
  }, [historial, lm, juntas, esCostos]);

  // Lo de la solapa abierta.
  const esLM = solapa === "lm";
  const esComp = solapa === "comp";
  const activos = esComp ? gruposComp : esLM ? (esCostos ? gruposLMPersonal : gruposLM) : grupos;
  // De dónde salen los precios de la tabla, arriba a la derecha de las solapas.
  const rotuloPrecios =
    esCostos && esLM
      ? "Precios de pago a personal (LM)"
      : esCostos && esComp
        ? "Precios pagados Ctv Vs. precios pagados LM"
        : "Precios pagados por Ctv";
  // En la de costos lo de LM es lo pagado a la gente, no lo certificado.
  const cantLMTitulo = esCostos ? "Cant. pagado LM" : "Cant. certif. LM";
  // Con un rango a medio escribir se sigue viendo lo último que se trajo.
  const cargandoActivo =
    esLM || esComp
      ? !lm || (rangoValido && !lmAlDia && !lm.error) || (cargando && !filas.length)
      : cargando && !filas.length;

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

  // En el Excel, las fechas de los partes de La Martina que se usaron.
  const fechasLM = lm?.desde && lm?.hasta ? ` (partes del ${fecha(lm.desde)} al ${fecha(lm.hasta)})` : "";

  const exportarExcel = async () => {
    try {
      if (esComp) {
        await exportarPlanilla({
          titulo: `${nombre} — ${tituloCampo}${fechasLM} — ${rotuloPrecios}`,
          hoja: "Comparativa",
          archivo: `${nombre} ${tituloCampo}.xlsx`,
          columnas: [
            { titulo: "Detalle de tarea", ancho: 40, negrita: true },
            { titulo: "Unidad", ancho: 12 },
            { titulo: "Precio unitario Ctv", ancho: 18, moneda: true },
            ...(esCostos ? [{ titulo: "Precio unitario LM", ancho: 18, moneda: true }] : []),
            { titulo: "Cant. pagado Ctv", ancho: 12 },
            { titulo: cantLMTitulo, ancho: 12 },
            { titulo: "Dif. cant.", ancho: 12 },
            { titulo: "Subtotal Ctv", ancho: 18, moneda: true },
            { titulo: "Subtotal LM", ancho: 18, moneda: true },
            { titulo: "Diferencia", ancho: 18, moneda: true },
          ],
          filas: [
            ...visibles.map((g) => [
              g.sinEquivalencia ? `${g.tarea} (sin equivalencia)` : g.tarea,
              g.unidad,
              g.precio ?? "-",
              ...(esCostos ? [g.precioLM ?? "-"] : []),
              g.cantCTV ?? "-",
              g.cantLM ?? "-",
              g.difCant ?? "-",
              g.subCTV ?? "-",
              g.subLM ?? "-",
              g.dif ?? "-",
            ]),
            ["TOTAL", "", "", ...(esCostos ? [""] : []), "", "", "", totalComp.subCTV, totalComp.subLM, totalComp.dif],
          ],
        });
        return;
      }
      await exportarPlanilla({
        titulo: `${nombre} — ${tituloCampo} — ${esLM ? `Certificado en LM${fechasLM}` : "Pagado por Ctv"} — ${rotuloPrecios}`,
        hoja: esLM ? "Certificado en LM" : "Pagado por Ctv",
        archivo: `${nombre} ${tituloCampo} ${esLM ? "LM" : "Ctv"}.xlsx`,
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

  if (graficos) {
    return (
      <ContableGraficosCostos
        titulo={`${nombre} - ${tituloCampo}`}
        filas={gruposComp}
        cargando={cargandoActivo}
        colores={col}
        fechas={lm?.desde && lm?.hasta ? `del ${fecha(lm.desde)} al ${fecha(lm.hasta)}` : ""}
      />
    );
  }

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
          <i className={`bi ${tipo === "costos" ? "bi-cash-stack" : "bi-bar-chart-line-fill"}`} style={{ color: col.medio, fontSize: "1.15rem", marginRight: "-0.5rem" }}></i>
          <span className="fw-bold" style={{ color: col.oscuro, fontSize: "1.05rem" }}>
            {nombre} - {tituloCampo}
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
          {/* Los gráficos de precios, solo en la de costos (07/11/2026). */}
          {esCostos && (
            <Button
              size="sm"
              onClick={() =>
                navigate(`/contable/${anio}/${mes}/${TIPOS_COMPARATIVA.costos.ruta}/${campoId}/graficos`, {
                  state: { rango },
                })
              }
              className="rounded-3 px-3 d-flex align-items-center gap-2 ms-auto"
              style={{
                backgroundColor: col.medio,
                borderColor: col.medio,
                fontSize: "0.78rem",
                height: "30px",
                fontWeight: 600,
              }}
              title="Ver los gráficos de precios Ctv contra LM"
            >
              <i className="bi bi-graph-up"></i>
              <span>Gráficos</span>
            </Button>
          )}
          <Button
            size="sm"
            onClick={exportarExcel}
            disabled={cargandoActivo || !activos.length}
            className={`rounded-3 px-3 d-flex align-items-center gap-2 ${esCostos ? "" : "ms-auto"}`}
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
              colores={{ marcada: col.claro, elegida: col.oscuro }}
              etiqueta="Tarea"
              ancho="280px"
              valor={filtro.tarea}
              vacio={FILTRO_VACIO.tarea}
              onChange={(v) => setFiltro((f) => ({ ...f, tarea: v }))}
              opciones={opciones.tarea}
            />
            {/* Las fechas de los partes de La Martina: en rojo cuando no son
                las de la certificación, con la flecha para volver a ellas. */}
            {(esLM || esComp) && rango && (
              <div className="d-flex align-items-center gap-1">
                <span className="fw-bold text-dark small flex-shrink-0" style={{ fontSize: "0.75rem" }}>
                  Fechas LM:
                </span>
                {["desde", "hasta"].map((lado) => (
                  <input
                    key={lado}
                    type="date"
                    className={`form-control rounded-3 ${esRangoCert ? "" : "filtro-activo"}`}
                    value={rango[lado]}
                    max={lado === "desde" ? rango.hasta || undefined : undefined}
                    min={lado === "hasta" ? rango.desde || undefined : undefined}
                    onChange={(e) => setRango((r) => ({ ...r, [lado]: e.target.value }))}
                    title={lado === "desde" ? "Desde" : "Hasta"}
                    style={{
                      width: "132px",
                      fontSize: "0.82rem",
                      height: "32px",
                      padding: "3px 6px",
                      color: esRangoCert ? "#1e293b" : "#dc2626",
                      fontWeight: esRangoCert ? "normal" : 700,
                    }}
                  />
                ))}
                {!esRangoCert && base && (
                  <button
                    className="btn btn-sm btn-outline-secondary d-flex align-items-center justify-content-center flex-shrink-0 rounded-3"
                    type="button"
                    onClick={() => setRango({ desde: base.desde, hasta: base.hasta })}
                    title="Volver a las fechas de la certificación"
                    style={{ padding: "0 8px", height: "32px" }}
                  >
                    <i className="bi bi-arrow-counterclockwise" style={{ fontSize: "0.85rem" }}></i>
                  </button>
                )}
              </div>
            )}
          </div>
        </Card>

        {/* Las solapas, pegadas arriba de la tabla (como las de Equivalencias
            de tareas): lo pagado por Citrusvil y lo certificado en La Martina. */}
        <div className="d-flex align-items-end gap-1 flex-shrink-0" style={{ marginBottom: "-1px" }}>
          {[
            ["ctv", "Pagado por Ctv", "bi-cash-coin"],
            ["lm", "Certificado en LM", "bi-file-earmark-check"],
            ["comp", "Comparativa", "bi-arrow-left-right"],
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
                  borderBottom: activa ? `1px solid ${col.oscuro}` : "1px solid #cbd5e1",
                  borderTopLeftRadius: "0.5rem",
                  borderTopRightRadius: "0.5rem",
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
          <span
            className="ms-auto mb-1 px-2 py-1 rounded-3 fw-semibold d-flex align-items-center gap-1"
            style={{ fontSize: "0.75rem", backgroundColor: col.claro, color: col.oscuro, border: `1px solid ${col.borde}` }}
          >
            <i className={`bi ${esCostos && esLM ? "bi-people-fill" : "bi-cash-coin"}`}></i>
            {rotuloPrecios}
          </span>
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
            <thead style={{ position: "sticky", top: 0, zIndex: 10, backgroundColor: col.oscuro, color: "#fff" }}>
              <tr>
                <th style={th}>Detalle de tarea</th>
                <th style={{ ...th, width: "70px", textAlign: "center" }}>Unidad</th>
                <th style={{ ...th, width: "100px", textAlign: "center" }}>Precio unitario Ctv</th>
                {esCostos && <th style={{ ...th, width: "100px", textAlign: "center" }}>Precio unitario LM</th>}
                {/* Líneas gruesas (col-corte, index.css) que separan el bloque
                    de cantidades del de plata. */}
                <th className="col-corte" style={{ ...th, width: "90px", textAlign: "center" }}>Cant. pagado Ctv</th>
                <th style={{ ...th, width: "90px", textAlign: "center" }}>{cantLMTitulo}</th>
                <th style={{ ...th, width: "80px", textAlign: "center" }}>Dif. cant.</th>
                <th className="col-corte" style={{ ...th, width: "115px", textAlign: "center" }}>Subtotal Ctv</th>
                <th style={{ ...th, width: "115px", textAlign: "center" }}>Subtotal LM</th>
                <th style={{ ...th, width: "115px", textAlign: "center" }}>Diferencia</th>
              </tr>
            </thead>
            <tbody>
              {cargandoActivo ? (
                <tr>
                  <td colSpan={esCostos ? 10 : 9} className="text-center text-muted py-4" style={td}>
                    <Spinner animation="border" size="sm" style={{ color: col.medio }} />
                  </td>
                </tr>
              ) : !visibles.length ? (
                <tr>
                  <td colSpan={esCostos ? 10 : 9} className="text-center text-muted py-4" style={td}>
                    {activos.length ? "Ninguna fila coincide con los filtros" : "No hay nada que comparar en este mes"}
                  </td>
                </tr>
              ) : (
                <>
                  {visibles.map((g) => {
                    // La diferencia en verde si Ctv pagó más que lo certificado
                    // y en rojo si pagó menos.
                    const colorDif = (v) => (v > 0.005 ? "#15803d" : v < -0.005 ? "#dc2626" : undefined);
                    return (
                      <tr
                        key={g.clave}
                        onClick={() => setHistorial(g)}
                        style={{ cursor: "pointer" }}
                        title="Ver el historial día por día"
                      >
                        <td style={td}>
                          <span
                            className={g.sinEquivalencia ? "px-2 rounded-2" : undefined}
                            style={
                              g.sinEquivalencia
                                ? { fontWeight: 700, color: AMBAR_TEXTO, backgroundColor: "#fde68a" }
                                : { fontWeight: 600 }
                            }
                            title={g.sinEquivalencia ? "Sin equivalencia entre las tareas de Ctv y de LM" : undefined}
                          >
                            {g.tarea || raya}
                          </span>
                        </td>
                        <td style={{ ...td, textAlign: "center" }}>{g.unidad || raya}</td>
                        <td style={{ ...td, textAlign: "center", whiteSpace: "nowrap" }}>{pesos(g.precio) ?? raya}</td>
                        {esCostos && (
                          <td
                            style={{ ...td, textAlign: "center", whiteSpace: "nowrap" }}
                            title={
                              g.precioLMVariables
                                ? "Sin partes en el período: precio vigente de Variables de remuneración"
                                : g.variosPreciosLM
                                  ? "Promedio: en el mes hubo más de un precio (cliente, vigencia o alto Rto.)"
                                  : undefined
                            }
                          >
                            {g.variosPreciosLM && <span style={{ color: "#64748b" }}>≈ </span>}
                            <span style={g.precioLMVariables ? { color: "#64748b", fontStyle: "italic" } : undefined}>
                              {pesos(g.precioLM) ?? raya}
                            </span>
                            {g.precioLMVariables && (
                              <span className="ms-1" style={{ fontSize: "0.6rem", color: "#94a3b8" }}>
                                (Variables)
                              </span>
                            )}
                          </td>
                        )}
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
                    <td style={{ ...td, fontWeight: 700, color: col.oscuro }}>TOTAL</td>
                    <td style={td}></td>
                    <td style={td}></td>
                    {esCostos && <td style={td}></td>}
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
            <thead style={{ position: "sticky", top: 0, zIndex: 10, backgroundColor: col.oscuro, color: "#fff" }}>
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
                    <Spinner animation="border" size="sm" style={{ color: col.medio }} />
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
                        {/* Sin precio: la raya gris. Con varios precios de pago
                            al personal, el promedio, con un aviso. */}
                        <td
                          style={{ ...c, textAlign: "center", whiteSpace: "nowrap" }}
                          title={g.variosPrecios ? "Promedio: en el mes hubo más de un precio (cliente, vigencia o alto Rto.)" : undefined}
                        >
                          {g.variosPrecios && <span style={{ color: "#64748b" }}>≈ </span>}
                          {pesos(g.precio) ?? raya}
                        </td>
                        <td style={{ ...c, textAlign: "center", whiteSpace: "nowrap" }}>{pesos(g.subtotal) ?? raya}</td>
                      </tr>
                    );
                  })}
                  <tr className="fila-total">
                    <td style={{ ...td, fontWeight: 700, color: col.oscuro }}>TOTAL</td>
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
            backgroundColor: col.oscuro,
            color: "#fff",
            borderTopLeftRadius: "1rem",
            borderTopRightRadius: "1rem",
            borderBottom: "1px solid rgba(255,255,255,0.1)",
          }}
        >
          <Modal.Title className="fs-6 fw-bold d-flex align-items-center gap-2 text-white flex-wrap">
            <i className="bi bi-bar-chart-line" style={{ color: col.icono }}></i>
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
                style={{ backgroundColor: col.medio, borderColor: col.medio, color: "#fff", fontSize: "0.78rem" }}
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
              <thead style={{ position: "sticky", top: 0, zIndex: 10, backgroundColor: col.oscuro, color: "#fff" }}>
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
                        {detalle.tarea !== f.tarea && (
                          <span className="ms-2" style={{ fontSize: "0.64rem", color: "#64748b" }}>
                            {f.tarea}
                          </span>
                        )}
                        {f.alto && (
                          <span className="ms-2" style={{ fontSize: "0.64rem", color: col.medio, fontWeight: 700 }}>
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
                  <td style={{ ...td, fontWeight: 700, color: col.oscuro }}>TOTAL</td>
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
              <thead style={{ position: "sticky", top: 0, zIndex: 10, backgroundColor: col.oscuro, color: "#fff" }}>
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
                    <td style={{ ...td, fontWeight: 700, color: col.oscuro }}>TOTAL</td>
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

      {/* El historial de una fila de la Comparativa: día por día, Ctv contra LM. */}
      <Modal
        show={Boolean(historial)}
        onHide={() => setHistorial(null)}
        centered
        size="lg"
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
              · {historial?.unidad || "sin unidad"} · Ctv {pesos(historial?.precio) ?? "sin precio"}
              {esCostos && (
                <>
                  {" "}· LM {historial?.variosPreciosLM ? "≈ " : ""}
                  {pesos(historial?.precioLM) ?? "sin precio"}
                  {historial?.precioLMVariables ? " (de Variables, sin partes)" : ""}
                </>
              )}
            </span>
          </Modal.Title>
        </Modal.Header>
        <Modal.Body className="p-3">
          {historial?.sinEquivalencia && (
            <div
              className="d-flex align-items-center gap-2 mb-2 px-3 py-2 rounded-3 flex-wrap"
              style={{ backgroundColor: AMBAR, color: AMBAR_TEXTO, fontSize: "0.8rem" }}
            >
              <i className="bi bi-exclamation-triangle-fill" style={{ color: "#d97706" }}></i>
              <span className="fw-semibold">Sin equivalencia: solo se ve uno de los dos lados.</span>
              <button
                className="btn btn-sm ms-auto d-flex align-items-center gap-1 px-3"
                style={{ backgroundColor: col.medio, borderColor: col.medio, color: "#fff", fontSize: "0.78rem" }}
                onClick={() => navigate("/contable/equivalencias")}
              >
                <i className="bi bi-arrow-left-right"></i>
                Cargar la equivalencia
              </button>
            </div>
          )}
          <div className="rounded-3 bg-white" style={{ maxHeight: "60vh", overflowY: "auto", border: "1px solid #cbd5e1" }}>
            <Table className="mb-0 tabla-informe" style={{ width: "100%" }}>
              <thead style={{ position: "sticky", top: 0, zIndex: 10, backgroundColor: col.oscuro, color: "#fff" }}>
                <tr>
                  <th style={{ ...th, textAlign: "center" }}>Fecha</th>
                  <th className="col-corte" style={{ ...th, textAlign: "center" }}>Cant. pagado Ctv</th>
                  <th style={{ ...th, textAlign: "center" }}>{cantLMTitulo}</th>
                  <th style={{ ...th, textAlign: "center" }}>Dif. cant.</th>
                  <th className="col-corte" style={{ ...th, textAlign: "center" }}>Subtotal Ctv</th>
                  <th style={{ ...th, textAlign: "center" }}>Subtotal LM</th>
                  <th style={{ ...th, textAlign: "center" }}>Diferencia</th>
                </tr>
              </thead>
              <tbody>
                {!diasHistorial?.length ? (
                  <tr>
                    <td colSpan={7} className="text-center text-muted py-4" style={td}>
                      No hay días para mostrar
                    </td>
                  </tr>
                ) : (
                  <>
                    {diasHistorial.map((d) => {
                      const colorDif = (v) => (v > 0.005 ? "#15803d" : v < -0.005 ? "#dc2626" : undefined);
                      return (
                        <tr key={d.fecha}>
                          <td style={{ ...td, textAlign: "center", whiteSpace: "nowrap" }}>
                            {d.fecha === "ajuste" ? (
                              <span style={{ color: "#64748b", fontStyle: "italic" }} title="Correcciones a mano de Contable - Pagos">
                                Correcciones a mano
                              </span>
                            ) : d.fecha ? (
                              fecha(d.fecha)
                            ) : (
                              raya
                            )}
                          </td>
                          <td className="col-corte" style={{ ...td, textAlign: "center" }}>{cantidad(d.ctv) ?? raya}</td>
                          <td style={{ ...td, textAlign: "center" }}>{cantidad(d.lm) ?? raya}</td>
                          <td style={{ ...td, textAlign: "center", fontWeight: 600, color: colorDif(d.difCant) }}>
                            {cantidad(d.difCant)}
                          </td>
                          <td className="col-corte" style={{ ...td, textAlign: "center", whiteSpace: "nowrap" }}>
                            {pesos(d.subCTV) ?? raya}
                          </td>
                          <td style={{ ...td, textAlign: "center", whiteSpace: "nowrap" }}>{pesos(d.subLM) ?? raya}</td>
                          <td style={{ ...td, textAlign: "center", whiteSpace: "nowrap", fontWeight: 700, color: colorDif(d.dif) }}>
                            {pesos(d.dif)}
                          </td>
                        </tr>
                      );
                    })}
                    <tr className="fila-total">
                      <td style={{ ...td, fontWeight: 700, color: col.oscuro }}>TOTAL</td>
                      <td className="col-corte" style={{ ...td, textAlign: "center", fontWeight: 700 }}>
                        {cantidad(historial.cantCTV) ?? raya}
                      </td>
                      <td style={{ ...td, textAlign: "center", fontWeight: 700 }}>{cantidad(historial.cantLM) ?? raya}</td>
                      <td style={{ ...td, textAlign: "center", fontWeight: 700 }}>{cantidad(historial.difCant)}</td>
                      <td className="col-corte" style={{ ...td, textAlign: "center", fontWeight: 700, whiteSpace: "nowrap" }}>
                        {pesos(historial.subCTV) ?? raya}
                      </td>
                      <td style={{ ...td, textAlign: "center", fontWeight: 700, whiteSpace: "nowrap" }}>
                        {pesos(historial.subLM) ?? raya}
                      </td>
                      <td style={{ ...td, textAlign: "center", fontWeight: 700, whiteSpace: "nowrap" }}>{pesos(historial.dif)}</td>
                    </tr>
                  </>
                )}
              </tbody>
            </Table>
          </div>
          {lm?.desde && lm?.hasta && (
            <div className="mt-2 text-muted" style={{ fontSize: "0.72rem" }}>
              Partes de LM del {fecha(lm.desde)} al {fecha(lm.hasta)}. {esCostos ? "Lo de LM es lo que se le pagó al personal." : "Lo de LM va al precio de Ctv."}
            </div>
          )}
        </Modal.Body>
      </Modal>
    </div>
  );
}

export default ContableComparativa;
