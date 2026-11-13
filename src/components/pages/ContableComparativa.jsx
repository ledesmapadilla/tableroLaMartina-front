import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { Button, Card, Container, Modal, Spinner, Table } from "react-bootstrap";
import Swal from "sweetalert2";
import { api } from "../../services/api";
import { usePermisos } from "../../context/permisos";
import { CAMPOS_COMPARATIVA, MESES, TIPOS_COMPARATIVA, claveTarea, memoriaTablas } from "../../utils/contable";
import Error404 from "./Error404";
import ContableGraficosCostos from "./ContableGraficosCostos";
import ContableResultadoCostos from "./ContableResultadoCostos";
import { calcularAjustes, calcularCertificado } from "../../utils/certificado";
import { exportarPlanilla } from "../../helpers/excel";
import SelectBuscador from "../shared/SelectBuscador";
import AyudaColumna from "../shared/AyudaColumna";
import { ayudasComparativa } from "../../utils/ayudaComparativa";
import { calcularComparativa } from "../../utils/calculoComparativa";
import { BotonesObservacion, ModalesObservacion } from "../shared/ObservacionesComparativa";
import { useObservaciones } from "../../utils/observacionesComparativa";

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
// El botón Costos, de otro color que Gráficos para no confundirlos (07/11/2026):
// el cian de Contable.
const COLOR_COSTOS = "#0e7490";

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
function ContableComparativa({ tipo = "cantidad", graficos = false, resultado = false }) {
  // Con `resultado` (07/11/2026, solo la de costos) se ve la página Costos:
  // por tarea, lo pagado por Ctv menos el personal y el gasoil de LM.
  // Con `graficos` (07/11/2026, solo la de costos) se ven los gráficos de
  // precios con los mismos números de la solapa Comparativa.
  const location = useLocation();
  const [rangoInicial] = useState(() => location.state?.rango || null);
  // Volumétrica (antes cantidad tareas) o costos tarea (07/11/2026): por ahora lo mismo.
  const { titulo: nombre, colores: col, ruta: rutaTipo } = TIPOS_COMPARATIVA[tipo] || TIPOS_COMPARATIVA.cantidad;
  // Los encabezados de las tablas, con el color de esta comparativa.
  const th = { ...TH, backgroundColor: col.oscuro };
  const { anio, mes, campo: campoId } = useParams();
  const campo = CAMPOS_COMPARATIVA.find((c) => c.id === campoId);
  const clave = `${anio}/${mes}`;
  // Las observaciones de cada fila de la solapa Comparativa (12/11/2026) y la
  // fila cuyo modal está abierto: { clave, tarea, modo: "agregar" | "ver" }.
  const observaciones = useObservaciones({ anio, mes, campo: campo?.id, tipo });
  const [obsFila, setObsFila] = useState(null);
  const enMemoria = memoriaTablas.get(clave);

  const [filas, setFilas] = useState(enMemoria?.filas || []);
  const [equivalencias, setEquivalencias] = useState([]);
  // Las equivalencias solo para costos (Equivalencias › Ctv → LM, "LM en
  // costos"): [{ nombre de Citrusvil, tareas: [id de La Martina] }].
  const [costosEq, setCostosEq] = useState([]);
  // Las tareas de Ctv que se multiplican (12/11/2026, doble pasada): clave → factor.
  const [multiplicadores, setMultiplicadores] = useState(new Map());
  const [tareas, setTareas] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [filtro, setFiltro] = useState(FILTRO_VACIO);
  // El grupo que se está mirando en detalle.
  const [detalle, setDetalle] = useState(null);
  // La fila de la Comparativa cuyo historial se está mirando (07/11/2026).
  const [historial, setHistorial] = useState(null);
  const navigate = useNavigate();
  // El botón Costos se ve solo con "Ver" en Contable › Comparativa costos
  // tarea › Costos (Altas › Usuarios › Roles, 11/11/2026).
  const { puede } = usePermisos();
  const verCostos = puede("contable.costos", "ver");
  const [solapa, setSolapa] = useState(graficos || resultado ? "comp" : "ctv");
  // El precio del gasoil con su fecha (Equivalencias tareas/variables), para
  // la página Costos. Del más nuevo al más viejo.
  const [preciosGasoil, setPreciosGasoil] = useState([]);
  // Los alquileres con sus montos (12/11/2026), para la de costos.
  const [alquileres, setAlquileres] = useState([]);
  // Lo certificado en LM: null hasta que se abre la solapa.
  const [lm, setLm] = useState(null);

  const titulo = `${MESES[Number(mes) - 1] || ""} ${anio}`;
  const tituloCampo = campo ? `${campo.titulo} - ${titulo}` : titulo;

  useEffect(() => {
    let vigente = true;
    Promise.all([
      api.get(`/contable/filas/${anio}/${mes}`).catch(() => null),
      api.get(`/contable/equivalencias?anio=${anio}&mes=${mes}&liviano=1`).catch(() => null),
      api.get("/tareas").catch(() => []),
      resultado ? api.get("/contable/gasoil").catch(() => []) : [],
      tipo === "costos" ? api.get("/contable/alquileres").catch(() => []) : [],
    ])
      .then(([datos, eq, lista, gasoil, alqs]) => {
        if (datos) {
          memoriaTablas.set(clave, { filas: Array.isArray(datos.filas) ? datos.filas : [], tabla: datos.tabla || null });
        }
        if (!vigente) return;
        if (datos) setFilas(Array.isArray(datos.filas) ? datos.filas : []);
        setEquivalencias(Array.isArray(eq?.equivalencias) ? eq.equivalencias : []);
        setCostosEq(Array.isArray(eq?.costos) ? eq.costos : []);
        setMultiplicadores(
          new Map((Array.isArray(eq?.multiplicadores) ? eq.multiplicadores : []).map((m) => [claveTarea(m.nombre), m.factor]))
        );
        setTareas(Array.isArray(lista) ? lista : lista?.data || []);
        setPreciosGasoil(Array.isArray(gasoil) ? gasoil : []);
        setAlquileres(Array.isArray(alqs) ? alqs : []);
      })
      .finally(() => vigente && setCargando(false));
    return () => {
      vigente = false;
    };
  }, [anio, mes, clave, resultado, tipo]);

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
    // El período del mes siguiente, para el precio del gasoil de la página
    // Costos (07/11/2026). Si todavía no está cargado, el back da el de por
    // defecto (el 25).
    const sigAnio = Number(mes) === 12 ? Number(anio) + 1 : Number(anio);
    const sigMes = Number(mes) === 12 ? 1 : Number(mes) + 1;
    Promise.all([
      api.get(`/periodos/${anio}/${mes}?${q}`),
      resultado ? api.get(`/periodos/${sigAnio}/${sigMes}?${q}`).catch(() => null) : null,
      api.get(`/variables?${q}`).catch(() => []),
      api.get(`/cambios/${anio}/${mes}?${q}`).catch(() => []),
      api.get(`/descuentos/${anio}/${mes}?${q}`).catch(() => []),
    ])
      .then(([periodo, siguiente, variables, cambios, descuentos]) => {
        if (!vigente) return;
        const desde = (periodo?.desde || "").slice(0, 10);
        const hasta = (periodo?.hasta || "").slice(0, 10);
        setBase({
          desde,
          hasta,
          hastaSiguiente: (siguiente?.hasta || "").slice(0, 10),
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
  }, [solapa, base, campo, anio, mes, rangoInicial, resultado]);

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
        // Los litros de gasoil de cada parte (máquina + turbo), por tarea y
        // día: la página Costos los valúa al precio del gasoil de ese día.
        const litros = deVerdad
          .map((p) => ({
            idTarea: String(p.tarea?._id || p.tarea || ""),
            fecha: String(p.fecha || "").slice(0, 10),
            litros: (Number(p.combustible) || 0) + (Number(p.combTurbo) || 0),
          }))
          .filter((x) => x.idTarea && x.litros > 0);
        setLm({ filas: filasCert, excluidos: base.excluidos, dias: diasPorPersona, litros, desde, hasta });
      })
      .catch((err) => vigente && setLm({ filas: [], excluidos: new Set(), error: err.message, desde, hasta }));
    return () => {
      vigente = false;
    };
  }, [base, rango, rangoValido, lmAlDia, esRangoCert, campo, anio, mes]);


  // En la de costos, la solapa de LM va con lo que se le paga a la gente
  // (Variables de remuneración de ese campo), y la Comparativa también
  // (07/11/2026): cuánto paga Ctv contra cuánto gasta LM.
  const esCostos = tipo === "costos";
  // La volumétrica va sin plata (12/11/2026): solo cantidades en las tres
  // solapas, los detalles, el historial y el Excel. Lo que se sacó está
  // anotado en _claude/volumetrica-sin-plata.md; para volver a ponerlo,
  // `conPlata = true`.
  const conPlata = esCostos;
  // El ayudamemoria de cada columna (ⓘ en los encabezados, 12/11/2026).
  const ayudas = useMemo(() => ayudasComparativa({ esCostos }), [esCostos]);

  // Todo el cálculo de la comparativa del mes, en utils/calculoComparativa.js
  // (12/11/2026): lo usa también el Acumulado, mes por mes.
  const calculo = useMemo(
    () =>
      calcularComparativa({
        tipo,
        campo,
        anio,
        mes,
        filas,
        equivalencias,
        costosEq,
        tareas,
        alquileres,
        multiplicadores,
        lm,
        base,
        rango,
      }),
    [tipo, campo, anio, mes, filas, equivalencias, costosEq, tareas, alquileres, multiplicadores, lm, base, rango]
  );
  const { juntas, grupos, gruposLM, gruposLMCostos, gruposComp } = calculo;

  /**
   * La página Costos (07/11/2026): por cada fila de la Comparativa de costos,
   * lo pagado por Ctv, lo pagado al personal de LM y el gasoil de los partes
   * de esas tareas, valuado al precio del gasoil vigente a la fecha del
   * cierre siguiente, el de la certificación del mes que viene (pedido del
   * usuario, 07/11/2026; Equivalencias tareas/variables), uno solo para todo
   * el período. Resultado = Ctv − personal − gasoil. En una fila cruzada ("LM
   * en costos") el gasoil sale de las dos tareas: la de siempre y la de
   * costos. Sin precio a esa fecha, los litros quedan sin valor y se avisa.
   */
  const gasoilCierre = useMemo(() => {
    const cierre = base?.hastaSiguiente || base?.hasta || "";
    const vigente = cierre ? preciosGasoil.find((p) => String(p.fecha).slice(0, 10) <= cierre) : null;
    return { cierre, precio: vigente?.precio ?? null, desde: vigente ? String(vigente.fecha).slice(0, 10) : "" };
  }, [base, preciosGasoil]);
  const filasResultado = useMemo(() => {
    if (!resultado) return [];
    const precio = gasoilCierre.precio;
    const porGrupo = new Map();
    for (const x of lm?.litros || []) {
      const grupo = juntas.grupoDe.get(x.idTarea) || x.idTarea;
      const g = porGrupo.get(grupo) || { litros: 0, pesos: 0, sinPrecio: 0 };
      g.litros += x.litros;
      if (precio === null) g.sinPrecio += x.litros;
      else g.pesos += x.litros * precio;
      porGrupo.set(grupo, g);
    }
    return gruposComp.map((f) => {
      const grupos = [...new Set([f.grupoLM, f.grupoCtv, ...(f.gruposLM || []), ...(f.gruposCtv || [])].filter(Boolean))];
      const datos = grupos.map((g) => porGrupo.get(g)).filter(Boolean);
      const litros = datos.length ? datos.reduce((a, d) => a + d.litros, 0) : null;
      const gasoil = datos.length ? datos.reduce((a, d) => a + d.pesos, 0) : null;
      const litrosSinPrecio = datos.reduce((a, d) => a + d.sinPrecio, 0);
      return {
        ...f,
        litros,
        gasoil,
        litrosSinPrecio,
        resultado: (f.subCTV || 0) - (f.subLM || 0) - (gasoil || 0),
      };
    });
  }, [resultado, gasoilCierre, lm, juntas, gruposComp]);

  // El historial de una fila de la Comparativa, día por día: lo que pagó Ctv
  // (las filas del Excel por su fecha) contra lo certificado en LM (los partes
  // de ese día, de las personas que cuentan). Lo de LM va al precio de Ctv;
  // en la de costos, a lo que se le pagó a la gente ese día.
  const diasHistorial = useMemo(() => {
    if (!historial) return null;
    // El nombre de cada tarea de La Martina, para la columna Tarea (12/11/2026).
    const nombreDe = (g) =>
      juntas.tareaDe.get(g)?.tarea || tareas.find((t) => String(t._id) === g)?.tarea || "Tarea borrada";
    const principal = historial.grupoLM ? nombreDe(historial.grupoLM) : historial.tarea;
    const porFecha = new Map();
    // `grupo`: una tarea que suma al subtotal va en su propio renglón.
    const dia = (f, grupo = null) => {
      const k = grupo ? `${f}|${grupo}` : f;
      if (!porFecha.has(k)) {
        porFecha.set(k, {
          clave: k,
          fecha: f,
          tareaLM: grupo ? nombreDe(grupo) : principal,
          extra: Boolean(grupo),
          ctv: null,
          subCTV: null,
          lm: null,
        });
      }
      return porFecha.get(k);
    };
    for (const f of historial.filasCtv) {
      const d = dia(String(f.fecha || "").slice(0, 10));
      d.ctv = (d.ctv || 0) + (f.cantidad || 0);
      d.subCTV = (d.subCTV || 0) + (f.subtotal || 0);
    }
    // Los grupos de LM de la fila: uno, o varios en una juntada de costos.
    const gruposH = new Set([historial.grupoLM, ...(historial.gruposLM || [])].filter(Boolean));
    const soloPlata = new Set(historial.gruposSoloPlata || []);
    if (gruposH.size && lm?.dias) {
      for (const [idPersona, lista] of lm.dias) {
        if (lm.excluidos.has(idPersona)) continue;
        for (const x of lista) {
          const id = String(x.idTarea);
          const grupo = juntas.grupoDe.get(id) || id;
          if (!gruposH.has(grupo)) continue;
          const d = dia(x.fecha, soloPlata.has(grupo) ? grupo : null);
          // De una tarea extra de costos, la cantidad va aparte, solo para
          // ver: no se suma a la de la fila (12/11/2026).
          if (!soloPlata.has(grupo)) d.lm = (d.lm || 0) + (x.cantidad || 0);
          else d.lmInfo = (d.lmInfo || 0) + (x.cantidad || 0);
          if (x.importe !== null && x.importe !== undefined) d.pagadoLM = (d.pagadoLM || 0) + x.importe;
        }
      }
    }
    const precio = historial.precio;
    const conPlata = (d) => {
      const subLM = esCostos ? (d.pagadoLM ?? null) : d.lm === null || precio === null ? null : d.lm * precio;
      return {
        ...d,
        subLM,
        difCant: d.extra ? null : (d.ctv || 0) - (d.lm || 0),
        dif: (d.subCTV || 0) - (subLM || 0),
      };
    };
    const dias = [...porFecha.values()]
      .sort((a, b) => a.fecha.localeCompare(b.fecha) || Number(a.extra) - Number(b.extra))
      .map(conPlata);
    // Los alquileres de la fila (12/11/2026): un renglón cada uno con su
    // monto, así no quedan como corrección a mano. Sin tareas en la fila,
    // cada uno cuenta 1.
    const soloAlquiler = !historial.grupoLM && !(historial.gruposLM || []).length;
    for (const a of historial.alquileresFila || []) {
      dias.push(
        conPlata({
          clave: `alq:${a.nombre}`,
          fecha: `alq:${a.nombre}`,
          alquiler: a.nombre,
          tareaLM: a.nombre,
          ctv: null,
          subCTV: null,
          lm: soloAlquiler ? 1 : null,
          pagadoLM: a.monto,
        })
      );
    }
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
          clave: "ajuste",
          fecha: "ajuste",
          ctv: null,
          subCTV: null,
          lm: Math.abs(ajuste) > 0.0005 ? ajuste : null,
          pagadoLM: esCostos ? ajustePlata : null,
        })
      );
    }
    return dias;
  }, [historial, lm, juntas, esCostos, tareas]);

  // El historial de la página Costos (07/11/2026): el de arriba más los litros
  // de gasoil de cada día (de las dos tareas en una fila cruzada), lo que
  // valen al precio del gasoil del cierre siguiente y el resultado del día.
  const diasCostos = useMemo(() => {
    if (!resultado || !historial || !diasHistorial) return null;
    const grupos = new Set(
      [historial.grupoLM, historial.grupoCtv, ...(historial.gruposLM || []), ...(historial.gruposCtv || [])].filter(Boolean)
    );
    const litrosDia = new Map();
    for (const x of lm?.litros || []) {
      const g = juntas.grupoDe.get(x.idTarea) || x.idTarea;
      if (grupos.has(g)) litrosDia.set(x.fecha, (litrosDia.get(x.fecha) || 0) + x.litros);
    }
    const dias = diasHistorial.map((d) => ({ ...d }));
    const porFecha = new Map(dias.filter((d) => !d.extra && !d.alquiler).map((d) => [d.fecha, d]));
    for (const [f, litros] of litrosDia) {
      let d = porFecha.get(f);
      if (!d) {
        d = { clave: f, fecha: f, tareaLM: diasHistorial[0]?.tareaLM, ctv: null, subCTV: null, lm: null, subLM: null };
        dias.push(d);
        porFecha.set(f, d);
      }
      d.litros = litros;
    }
    const precio = gasoilCierre.precio;
    return dias
      .map((d) => {
        const gasoil = d.litros && precio !== null ? d.litros * precio : null;
        return { ...d, gasoil, resultado: (d.subCTV || 0) - (d.subLM || 0) - (gasoil || 0) };
      })
      .sort((a, b) =>
        a.fecha === "ajuste"
          ? 1
          : b.fecha === "ajuste"
            ? -1
            : a.fecha.localeCompare(b.fecha) || Number(Boolean(a.extra)) - Number(Boolean(b.extra))
      );
  }, [resultado, historial, diasHistorial, lm, juntas, gasoilCierre]);

  // Si la fila del historial junta varias tareas o alquileres: columna Tarea.
  const historialVarias = Boolean(historial?.gruposSoloPlata?.length || historial?.alquileresFila?.length);

  // Lo de la solapa abierta.
  const esLM = solapa === "lm";
  // La tabla de las solapas Ctv y LM es la misma: la ayuda, la de la que está abierta.
  const ayudaSolapa = esLM ? ayudas.lm : ayudas.ctv;
  const esComp = solapa === "comp";
  const activos = esComp ? gruposComp : esLM ? (esCostos ? gruposLMCostos : gruposLM) : grupos;
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
          titulo: `${nombre} — ${tituloCampo}${fechasLM}${conPlata ? ` — ${rotuloPrecios}` : ""}`,
          hoja: "Comparativa",
          archivo: `${nombre} ${tituloCampo}.xlsx`,
          columnas: [
            { titulo: "Detalle de tarea", ancho: 40, negrita: true },
            { titulo: "Unidad", ancho: 12 },
            ...(conPlata ? [{ titulo: "Precio unitario Ctv", ancho: 18, moneda: true }] : []),
            ...(esCostos ? [{ titulo: "Precio unitario LM", ancho: 18, moneda: true }] : []),
            { titulo: "Cant. pagado Ctv", ancho: 12 },
            { titulo: cantLMTitulo, ancho: 12 },
            { titulo: "Dif. cant.", ancho: 12 },
            ...(conPlata
              ? [
                  { titulo: "Subtotal Ctv", ancho: 18, moneda: true },
                  { titulo: "Subtotal LM", ancho: 18, moneda: true },
                  { titulo: "Diferencia", ancho: 18, moneda: true },
                ]
              : []),
          ],
          filas: [
            ...visibles.map((g) => [
              g.sinEquivalencia ? `${g.tarea} (sin equivalencia)` : g.tarea,
              g.unidad,
              ...(conPlata ? [g.precio ?? "-"] : []),
              ...(esCostos ? [g.precioLM ?? "-"] : []),
              g.cantCTV ?? "-",
              g.cantLM ?? "-",
              g.difCant ?? "-",
              ...(conPlata ? [g.subCTV ?? "-", g.subLM ?? "-", g.dif ?? "-"] : []),
            ]),
            // Sin plata no hay total: las cantidades son de unidades distintas.
            ...(conPlata
              ? [["TOTAL", "", "", ...(esCostos ? [""] : []), "", "", "", totalComp.subCTV, totalComp.subLM, totalComp.dif]]
              : []),
          ],
        });
        return;
      }
      await exportarPlanilla({
        titulo: `${nombre} — ${tituloCampo} — ${esLM ? `Certificado en LM${fechasLM}` : "Pagado por Ctv"}${conPlata ? ` — ${rotuloPrecios}` : ""}`,
        hoja: esLM ? "Certificado en LM" : "Pagado por Ctv",
        archivo: `${nombre} ${tituloCampo} ${esLM ? "LM" : "Ctv"}.xlsx`,
        columnas: [
          { titulo: "Denominación almacén", ancho: 22 },
          { titulo: "Detalle de tarea", ancho: 40, negrita: true },
          { titulo: "Cant.", ancho: 12 },
          { titulo: "Unidad", ancho: 12 },
          ...(conPlata
            ? [
                { titulo: "Precio unitario", ancho: 16, moneda: true },
                { titulo: "Subtotal", ancho: 18, moneda: true },
              ]
            : []),
        ],
        filas: [
          ...visibles.map((g) => [
            g.almacen,
            g.sinEquivalencia ? `${g.tarea} (sin equivalencia)` : g.tarea,
            g.cantidad,
            g.unidad,
            ...(conPlata ? [g.precio ?? "-", g.subtotal ?? "-"] : []),
          ]),
          ...(conPlata ? [["TOTAL", "", "", "", "", total]] : []),
        ],
      });
    } catch (err) {
      Swal.fire({ icon: "error", title: "No se pudo exportar", text: err.message, width: "300px" });
    }
  };

  if (!campo) return <Error404 />;

  if (resultado) {
    return (
      <ContableResultadoCostos
        titulo={`Costos - ${tituloCampo}`}
        filas={filasResultado}
        cargando={cargandoActivo}
        colores={col}
        fechas={lm?.desde && lm?.hasta ? `del ${fecha(lm.desde)} al ${fecha(lm.hasta)}` : ""}
        gasoil={gasoilCierre}
        historial={historial}
        diasHistorial={diasCostos}
        historialVarias={historialVarias}
        onVerHistorial={setHistorial}
        onCerrarHistorial={() => setHistorial(null)}
      />
    );
  }

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
        // La de costos tiene más columnas: más ancha, para que entre
        // Observaciones (12/11/2026).
        style={{ maxWidth: esCostos ? "1320px" : "1100px", width: "100%", margin: "0 auto", minHeight: 0 }}
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
          {/* Costos (07/11/2026): lo pagado por Ctv menos el personal y el
              gasoil de LM, por tarea. Solo para quien la ve (Roles). */}
          {esCostos && verCostos && (
            <Button
              size="sm"
              onClick={() =>
                navigate(`/contable/${anio}/${mes}/${TIPOS_COMPARATIVA.costos.ruta}/${campoId}/costos`, {
                  state: { rango },
                })
              }
              className="rounded-3 px-3 d-flex align-items-center gap-2"
              style={{
                backgroundColor: COLOR_COSTOS,
                borderColor: COLOR_COSTOS,
                fontSize: "0.78rem",
                height: "30px",
                fontWeight: 600,
              }}
              title="Lo pagado por Ctv menos el personal y el gasoil de LM"
            >
              <i className="bi bi-calculator"></i>
              <span>Costos</span>
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
            {/* La evolución de las tarifas de Ctv y el acumulado del año
                (12/11/2026): a la derecha, a la altura del filtro de tarea. */}
            <button
              type="button"
              className="btn btn-sm d-flex align-items-center gap-2 px-3 fw-semibold ms-auto rounded-3"
              style={{ backgroundColor: "#fff", borderColor: col.medio, color: col.oscuro, fontSize: "0.78rem", height: "32px" }}
              onClick={() => navigate(`/contable/${anio}/${mes}/${rutaTipo}/${campo.id}/tarifas`)}
              title={`Precio unitario de Ctv de cada mes de ${anio}`}
            >
              <i className="bi bi-graph-up-arrow"></i>
              Evolución tarifas Ctv
            </button>
            <button
              type="button"
              className="btn btn-sm d-flex align-items-center gap-2 px-3 fw-semibold rounded-3"
              style={{ backgroundColor: col.medio, borderColor: col.medio, color: "#fff", fontSize: "0.78rem", height: "32px" }}
              onClick={() => navigate(`/contable/${anio}/${mes}/${rutaTipo}/${campo.id}/acumulado`)}
              title={`Diferencia de cada mes de ${anio}`}
            >
              <i className="bi bi-calendar3"></i>
              Acumulado {anio}
            </button>
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
          {conPlata && (
            <span
              className="ms-auto mb-1 px-2 py-1 rounded-3 fw-semibold d-flex align-items-center gap-1"
              style={{ fontSize: "0.75rem", backgroundColor: col.claro, color: col.oscuro, border: `1px solid ${col.borde}` }}
            >
              <i className={`bi ${esCostos && esLM ? "bi-people-fill" : "bi-cash-coin"}`}></i>
              {rotuloPrecios}
            </span>
          )}
        </div>

        <div
          className="shadow-sm bg-white"
          style={{
            flex: "1 1 auto",
            minHeight: 0,
            width: "100%",
            overflowY: "auto",
            // Sin scroll de costado (pedido del usuario, 12/11/2026).
            overflowX: "hidden",
            border: "1px solid #cbd5e1",
            borderRadius: "0 0.5rem 0.5rem 0.5rem",
          }}
        >
          {esComp ? (
          <Table className="mb-0 tabla-informe" style={{ width: "100%" }}>
            <thead style={{ position: "sticky", top: 0, zIndex: 10, backgroundColor: col.oscuro, color: "#fff" }}>
              <tr>
                <th style={th}>Detalle de tarea<AyudaColumna titulo={"Detalle de tarea"} ayuda={ayudas.comp.tarea} color={col.icono} /></th>
                <th style={{ ...th, width: "70px", textAlign: "center" }}>Unidad<AyudaColumna titulo={"Unidad"} ayuda={ayudas.comp.unidad} color={col.icono} /></th>
                {/* Líneas gruesas (col-corte, index.css): después de la tarea y
                    su unidad, y entre los bloques de precios, cantidades y plata. */}
                {conPlata && (
                  <th className="col-corte" style={{ ...th, width: "100px", textAlign: "center" }}>Precio unitario Ctv<AyudaColumna titulo={"Precio unitario Ctv"} ayuda={ayudas.comp.precioCtv} color={col.icono} /></th>
                )}
                {esCostos && <th style={{ ...th, width: "100px", textAlign: "center" }}>Precio unitario LM<AyudaColumna titulo={"Precio unitario LM"} ayuda={ayudas.comp.precioLM} color={col.icono} /></th>}
                <th className="col-corte" style={{ ...th, width: "90px", textAlign: "center" }}>Cant. pagado Ctv<AyudaColumna titulo={"Cant. pagado Ctv"} ayuda={ayudas.comp.cantCtv} color={col.icono} /></th>
                <th style={{ ...th, width: "90px", textAlign: "center" }}>{cantLMTitulo}<AyudaColumna titulo={cantLMTitulo} ayuda={ayudas.comp.cantLM} color={col.icono} /></th>
                <th style={{ ...th, width: "80px", textAlign: "center" }}>Dif. cant.<AyudaColumna titulo={"Dif. cant."} ayuda={ayudas.comp.difCant} color={col.icono} /></th>
                {conPlata && (
                  <>
                    <th className="col-corte" style={{ ...th, width: "115px", textAlign: "center" }}>Subtotal Ctv<AyudaColumna titulo={"Subtotal Ctv"} ayuda={ayudas.comp.subCtv} color={col.icono} /></th>
                    <th style={{ ...th, width: "115px", textAlign: "center" }}>Subtotal LM<AyudaColumna titulo={"Subtotal LM"} ayuda={ayudas.comp.subLM} color={col.icono} /></th>
                    <th style={{ ...th, width: "115px", textAlign: "center" }}>Diferencia<AyudaColumna titulo={"Diferencia"} ayuda={ayudas.comp.dif} color={col.icono} /></th>
                  </>
                )}
                {/* Cualquiera escribe con el "+"; el ojo, si hay algo (12/11/2026). */}
                <th className="col-corte" style={{ ...th, width: "95px", minWidth: "95px", textAlign: "center" }}>Observaciones</th>
              </tr>
            </thead>
            <tbody>
              {cargandoActivo ? (
                <tr>
                  <td colSpan={esCostos ? 11 : conPlata ? 10 : 6} className="text-center text-muted py-4" style={td}>
                    <Spinner animation="border" size="sm" style={{ color: col.medio }} />
                  </td>
                </tr>
              ) : !visibles.length ? (
                <tr>
                  <td colSpan={esCostos ? 11 : conPlata ? 10 : 6} className="text-center text-muted py-4" style={td}>
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
                          {g.tareaLMCostos && (
                            <div
                              style={{ fontSize: "0.62rem", color: "#64748b" }}
                              title="Equivalencia de costos (Equivalencias › Ctv → LM)"
                            >
                              LM: {g.tareaLMCostos}
                              {g.sinMontoAlquiler && !g.tareasCtvCostos?.length && (
                                <span className="ms-1" style={{ color: "#dc2626", fontWeight: 600 }}>
                                  · alquiler sin monto cargado a esa fecha
                                </span>
                              )}
                            </div>
                          )}
                          {/* Una fila juntada de costos (12/11/2026): de qué tareas de Ctv viene. */}
                          {g.tareasCtvCostos?.length > 0 && (
                            <div
                              style={{ fontSize: "0.62rem", color: "#64748b" }}
                              title="Equivalencia de costos (Equivalencias › Ctv → LM): se suman todas"
                            >
                              {g.alquileresFila?.length > 0 && <i className="bi bi-key-fill me-1"></i>}
                              Ctv: {g.tareasCtvCostos.join(", ")}
                              {g.sinMontoAlquiler && (
                                <span className="ms-1" style={{ color: "#dc2626", fontWeight: 600 }}>
                                  · alquiler sin monto cargado a esa fecha
                                </span>
                              )}
                            </div>
                          )}
                        </td>
                        <td style={{ ...td, textAlign: "center" }}>{g.unidad || raya}</td>
                        {conPlata && (
                          <td className="col-corte" style={{ ...td, textAlign: "center", whiteSpace: "nowrap" }}>
                            {pesos(g.precio) ?? raya}
                          </td>
                        )}
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
                            <span style={g.precioLMVariables ? { color: "#64748b", fontStyle: "italic" } : undefined}>
                              {/* El promedio, entre paréntesis con el ≈ adentro (12/11/2026). */}
                              {g.variosPreciosLM && g.precioLM !== null ? `(≈ ${pesos(g.precioLM)})` : pesos(g.precioLM) ?? raya}
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
                        {conPlata && (
                          <>
                            <td className="col-corte" style={{ ...td, textAlign: "center", whiteSpace: "nowrap" }}>
                              {pesos(g.subCTV) ?? raya}
                            </td>
                            <td style={{ ...td, textAlign: "center", whiteSpace: "nowrap" }}>{pesos(g.subLM) ?? raya}</td>
                            <td style={{ ...td, textAlign: "center", whiteSpace: "nowrap", fontWeight: 700, color: colorDif(g.dif) }}>
                              {pesos(g.dif) ?? raya}
                            </td>
                          </>
                        )}
                        <td className="col-corte" style={td}>
                          <BotonesObservacion
                            notas={observaciones.porClave.get(g.clave)}
                            onAgregar={() => setObsFila({ clave: g.clave, tarea: g.tarea, modo: "agregar" })}
                            onVer={() => setObsFila({ clave: g.clave, tarea: g.tarea, modo: "ver" })}
                          />
                        </td>
                      </tr>
                    );
                  })}
                  {/* Sin plata no hay total: las cantidades son de unidades distintas. */}
                  {conPlata && (
                  <tr className="fila-total">
                    <td style={{ ...td, fontWeight: 700, color: col.oscuro }}>TOTAL</td>
                    <td style={td}></td>
                    <td className="col-corte" style={td}></td>
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
                    <td className="col-corte" style={td}></td>
                  </tr>
                  )}
                </>
              )}
            </tbody>
          </Table>
          ) : (
          <Table className="mb-0 tabla-informe" style={{ width: "100%" }}>
            <thead style={{ position: "sticky", top: 0, zIndex: 10, backgroundColor: col.oscuro, color: "#fff" }}>
              <tr>
                <th style={{ ...th, width: "16%" }}>Denominación almacén<AyudaColumna titulo={"Denominación almacén"} ayuda={ayudaSolapa.almacen} color={col.icono} /></th>
                <th style={th}>Detalle de tarea<AyudaColumna titulo={"Detalle de tarea"} ayuda={ayudaSolapa.tarea} color={col.icono} /></th>
                <th style={{ ...th, width: "90px", textAlign: "center" }}>Cant.<AyudaColumna titulo={"Cant."} ayuda={ayudaSolapa.cantidad} color={col.icono} /></th>
                <th style={{ ...th, width: "80px", textAlign: "center" }}>Unidad<AyudaColumna titulo={"Unidad"} ayuda={ayudaSolapa.unidad} color={col.icono} /></th>
                {conPlata && (
                  <>
                    <th style={{ ...th, width: "120px", textAlign: "center" }}>Precio unitario<AyudaColumna titulo={"Precio unitario"} ayuda={ayudaSolapa.precio} color={col.icono} /></th>
                    <th style={{ ...th, width: "130px", textAlign: "center" }}>Subtotal<AyudaColumna titulo={"Subtotal"} ayuda={ayudaSolapa.subtotal} color={col.icono} /></th>
                  </>
                )}
              </tr>
            </thead>
            <tbody>
              {cargandoActivo ? (
                <tr>
                  <td colSpan={conPlata ? 6 : 4} className="text-center text-muted py-4" style={td}>
                    <Spinner animation="border" size="sm" style={{ color: col.medio }} />
                  </td>
                </tr>
              ) : !visibles.length ? (
                <tr>
                  <td colSpan={conPlata ? 6 : 4} className="text-center text-muted py-4" style={td}>
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
                        {conPlata && (
                          <>
                            <td
                              style={{ ...c, textAlign: "center", whiteSpace: "nowrap" }}
                              title={g.variosPrecios ? "Promedio: en el mes hubo más de un precio (cliente, vigencia o alto Rto.)" : undefined}
                            >
                              {g.variosPrecios && g.precio !== null ? `(≈ ${pesos(g.precio)})` : pesos(g.precio) ?? raya}
                            </td>
                            <td style={{ ...c, textAlign: "center", whiteSpace: "nowrap" }}>{pesos(g.subtotal) ?? raya}</td>
                          </>
                        )}
                      </tr>
                    );
                  })}
                  {/* Sin plata no hay total: las cantidades son de unidades distintas. */}
                  {conPlata && (
                    <tr className="fila-total">
                      <td style={{ ...td, fontWeight: 700, color: col.oscuro }}>TOTAL</td>
                      <td style={td}></td>
                      <td style={td}></td>
                      <td style={td}></td>
                      <td style={td}></td>
                      <td style={{ ...td, textAlign: "center", fontWeight: 700, whiteSpace: "nowrap" }}>{pesos(total)}</td>
                    </tr>
                  )}
                </>
              )}
            </tbody>
          </Table>
          )}
        </div>
      </Container>

      {/* Escribir y ver las observaciones de una fila de la Comparativa. */}
      <ModalesObservacion
        fila={obsFila}
        onCerrar={() => setObsFila(null)}
        notas={obsFila ? observaciones.porClave.get(obsFila.clave) || [] : []}
        onAgregar={observaciones.agregar}
        onBorrar={observaciones.borrar}
        color={col.oscuro}
      />

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
                onClick={() => navigate(`/contable/${anio}/${mes}/equivalencias`)}
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
                  {conPlata && (
                    <>
                      <th style={{ ...th, textAlign: "center" }}>Precio unitario</th>
                      <th style={{ ...th, textAlign: "center" }}>Importe</th>
                    </>
                  )}
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
                      <td style={{ ...td, textAlign: "center" }}>
                        {cantidad(f.cantidad) ?? raya}
                        {f.factor && (
                          <span className="ms-1" style={{ fontSize: "0.6rem", color: "#7c3aed", fontWeight: 700 }} title="Multiplicada (Equivalencias › Ctv → LM)">
                            ×{f.factor}
                          </span>
                        )}
                      </td>
                      <td style={{ ...td, textAlign: "center" }}>{f.unidad || raya}</td>
                      {conPlata && (
                        <>
                          <td style={{ ...td, textAlign: "center", whiteSpace: "nowrap" }}>{pesos(f.precio) ?? raya}</td>
                          <td style={{ ...td, textAlign: "center", whiteSpace: "nowrap" }}>{pesos(f.importe) ?? raya}</td>
                        </>
                      )}
                    </tr>
                  ))}
                <tr className="fila-total">
                  <td style={{ ...td, fontWeight: 700, color: col.oscuro }}>TOTAL</td>
                  <td style={td}></td>
                  <td style={td}></td>
                  <td style={{ ...td, textAlign: "center", fontWeight: 700 }}>{cantidad(detalle.cantidad)}</td>
                  <td style={{ ...td, textAlign: "center", fontWeight: 700 }}>{detalle.unidad}</td>
                  {conPlata && (
                    <>
                      <td style={{ ...td, textAlign: "center", fontWeight: 700, whiteSpace: "nowrap" }}>
                        {pesos(detalle.precio) ?? raya}
                      </td>
                      <td style={{ ...td, textAlign: "center", fontWeight: 700, whiteSpace: "nowrap" }}>
                        {pesos(detalle.subtotal) ?? raya}
                      </td>
                    </>
                  )}
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
                  {conPlata && (
                    <>
                      <th style={{ ...th, textAlign: "center" }}>Precio unitario</th>
                      <th style={{ ...th, textAlign: "center" }}>Subtotal</th>
                    </>
                  )}
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
                    <td style={{ ...td, textAlign: "center" }}>
                      {cantidad(f.cantidad) ?? raya}
                      {f.factor && (
                        <span className="ms-1" style={{ fontSize: "0.6rem", color: "#7c3aed", fontWeight: 700 }} title="Multiplicada (Equivalencias › Ctv → LM)">
                          ×{f.factor}
                        </span>
                      )}
                    </td>
                    <td style={{ ...td, textAlign: "center" }}>{f.unidad || raya}</td>
                    {conPlata && (
                      <>
                        <td style={{ ...td, textAlign: "center", whiteSpace: "nowrap" }}>{pesos(f.precioUnitario) ?? raya}</td>
                        <td style={{ ...td, textAlign: "center", whiteSpace: "nowrap" }}>{pesos(f.subtotal) ?? raya}</td>
                      </>
                    )}
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
                    {conPlata && (
                      <>
                        <td style={{ ...td, textAlign: "center", fontWeight: 700, whiteSpace: "nowrap" }}>
                          {pesos(detalle.precio) ?? raya}
                        </td>
                        <td style={{ ...td, textAlign: "center", fontWeight: 700, whiteSpace: "nowrap" }}>
                          {pesos(detalle.subtotal) ?? raya}
                        </td>
                      </>
                    )}
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
        // Más ancho con la columna Tarea LM, así no hay scroll de costado.
        size={historialVarias ? "xl" : "lg"}
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
              {conPlata && <> · Ctv {pesos(historial?.precio) ?? "sin precio"}</>}
              {esCostos && (
                <>
                  {" "}· LM{" "}
                  {historial?.variosPreciosLM && historial?.precioLM !== null
                    ? `(≈ ${pesos(historial.precioLM)})`
                    : pesos(historial?.precioLM) ?? "sin precio"}
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
                onClick={() => navigate(`/contable/${anio}/${mes}/equivalencias`)}
              >
                <i className="bi bi-arrow-left-right"></i>
                Cargar la equivalencia
              </button>
            </div>
          )}
          <div className="rounded-3 bg-white" style={{ maxHeight: "60vh", overflowY: "auto", overflowX: "hidden", border: "1px solid #cbd5e1" }}>
            <Table className="mb-0 tabla-informe" style={{ width: "100%" }}>
              <thead style={{ position: "sticky", top: 0, zIndex: 10, backgroundColor: col.oscuro, color: "#fff" }}>
                <tr>
                  <th style={{ ...th, textAlign: "center" }}>Fecha<AyudaColumna titulo={"Fecha"} ayuda={ayudas.comp.fecha} color={col.icono} /></th>
                  {/* A qué tarea va cada valor, si la fila junta varias (12/11/2026). */}
                  {historialVarias && <th style={th}>Tarea LM</th>}
                  <th className="col-corte" style={{ ...th, textAlign: "center" }}>Cant. pagado Ctv<AyudaColumna titulo={"Cant. pagado Ctv"} ayuda={ayudas.comp.cantCtv} color={col.icono} /></th>
                  <th style={{ ...th, textAlign: "center" }}>{cantLMTitulo}<AyudaColumna titulo={cantLMTitulo} ayuda={ayudas.comp.cantLM} color={col.icono} /></th>
                  <th style={{ ...th, textAlign: "center" }}>Dif. cant.<AyudaColumna titulo={"Dif. cant."} ayuda={ayudas.comp.difCant} color={col.icono} /></th>
                  {conPlata && (
                    <>
                      <th className="col-corte" style={{ ...th, textAlign: "center" }}>Subtotal Ctv<AyudaColumna titulo={"Subtotal Ctv"} ayuda={ayudas.comp.subCtv} color={col.icono} /></th>
                      <th style={{ ...th, textAlign: "center" }}>Subtotal LM<AyudaColumna titulo={"Subtotal LM"} ayuda={ayudas.comp.subLM} color={col.icono} /></th>
                      <th style={{ ...th, textAlign: "center" }}>Diferencia<AyudaColumna titulo={"Diferencia"} ayuda={ayudas.comp.dif} color={col.icono} /></th>
                    </>
                  )}
                </tr>
              </thead>
              <tbody>
                {!diasHistorial?.length ? (
                  <tr>
                    <td colSpan={(conPlata ? 7 : 4) + (historialVarias ? 1 : 0)} className="text-center text-muted py-4" style={td}>
                      No hay días para mostrar
                    </td>
                  </tr>
                ) : (
                  <>
                    {diasHistorial.map((d) => {
                      const colorDif = (v) => (v > 0.005 ? "#15803d" : v < -0.005 ? "#dc2626" : undefined);
                      return (
                        <tr key={d.clave || d.fecha}>
                          <td style={{ ...td, textAlign: "center", whiteSpace: "nowrap" }}>
                            {d.alquiler ? (
                              historialVarias ? (
                                <span style={{ color: "#64748b", fontStyle: "italic" }}>Del mes</span>
                              ) : (
                                <span style={{ color: "#7c3aed", fontWeight: 600 }} title="Monto del alquiler del mes (Equivalencias)">
                                  <i className="bi bi-key-fill me-1"></i>
                                  {d.alquiler}
                                </span>
                              )
                            ) : d.fecha === "ajuste" ? (
                              <span style={{ color: "#64748b", fontStyle: "italic" }} title="Correcciones a mano de Contable - Pagos">
                                Correcciones a mano
                              </span>
                            ) : d.fecha ? (
                              fecha(d.fecha)
                            ) : (
                              raya
                            )}
                          </td>
                          {historialVarias && (
                            <td style={{ ...td, color: d.extra || d.alquiler ? "#7c3aed" : undefined }}>
                              {d.alquiler && <i className="bi bi-key-fill me-1"></i>}
                              {d.fecha === "ajuste" ? raya : d.tareaLM || raya}
                              {d.extra && <span style={{ fontSize: "0.62rem", color: "#94a3b8" }}> (suma al subtotal)</span>}
                            </td>
                          )}
                          <td className="col-corte" style={{ ...td, textAlign: "center" }}>{cantidad(d.ctv) ?? raya}</td>
                          <td style={{ ...td, textAlign: "center" }}>
                            {d.extra ? (
                              <span style={{ color: "#94a3b8" }} title="Horas de esta tarea: no se suman a las de la fila">
                                {cantidad(d.lmInfo) ?? raya}
                              </span>
                            ) : (
                              cantidad(d.lm) ?? raya
                            )}
                          </td>
                          <td style={{ ...td, textAlign: "center", fontWeight: 600, color: colorDif(d.difCant) }}>
                            {d.difCant === null ? raya : cantidad(d.difCant)}
                          </td>
                          {conPlata && (
                            <>
                              <td className="col-corte" style={{ ...td, textAlign: "center", whiteSpace: "nowrap" }}>
                                {pesos(d.subCTV) ?? raya}
                              </td>
                              <td style={{ ...td, textAlign: "center", whiteSpace: "nowrap" }}>{pesos(d.subLM) ?? raya}</td>
                              <td style={{ ...td, textAlign: "center", whiteSpace: "nowrap", fontWeight: 700, color: colorDif(d.dif) }}>
                                {pesos(d.dif)}
                              </td>
                            </>
                          )}
                        </tr>
                      );
                    })}
                    <tr className="fila-total">
                      <td style={{ ...td, fontWeight: 700, color: col.oscuro }}>TOTAL</td>
                      {historialVarias && <td style={td}></td>}
                      <td className="col-corte" style={{ ...td, textAlign: "center", fontWeight: 700 }}>
                        {cantidad(historial.cantCTV) ?? raya}
                      </td>
                      <td style={{ ...td, textAlign: "center", fontWeight: 700 }}>{cantidad(historial.cantLM) ?? raya}</td>
                      <td style={{ ...td, textAlign: "center", fontWeight: 700 }}>{cantidad(historial.difCant)}</td>
                      {conPlata && (
                        <>
                          <td className="col-corte" style={{ ...td, textAlign: "center", fontWeight: 700, whiteSpace: "nowrap" }}>
                            {pesos(historial.subCTV) ?? raya}
                          </td>
                          <td style={{ ...td, textAlign: "center", fontWeight: 700, whiteSpace: "nowrap" }}>
                            {pesos(historial.subLM) ?? raya}
                          </td>
                          <td style={{ ...td, textAlign: "center", fontWeight: 700, whiteSpace: "nowrap" }}>{pesos(historial.dif)}</td>
                        </>
                      )}
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
