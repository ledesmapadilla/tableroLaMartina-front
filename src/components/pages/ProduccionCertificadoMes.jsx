import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import Swal from "sweetalert2";
import { Container, Table, Button, Form, Card } from "react-bootstrap";
import { nuevoWorkbook } from "../../helpers/excel";
import SelectBuscador from "../shared/SelectBuscador";
import { CLIENTES, unirClientes } from "../../utils/clientes";
import { guardarConReglaHorometro, etiquetaFuente } from "../../utils/horometro";
import { useSinGuardar } from "../../utils/sinGuardar";

const MESES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

const FORM_VACIO = {
  fecha: "",
  persona: "",
  cc: "",
  // El cliente es solo informativo: el precio de Variables es el mismo para
  // todos. Viene puesto en Citrusvil (17/09/2026).
  cliente: CLIENTES[0],
  horaIngreso: "",
  horaEgreso: "",
  // El segundo tramo del día, solo en San Pablo.
  horaIngreso2: "",
  horaEgreso2: "",
  horomIngreso: "",
  horomSalida: "",
  lote: "",
  // Si el trabajo quedó terminado; arranca en proceso.
  terminado: false,
  observacion: "",
  tarea: "",
  cantidad: "",
  combustible: "",
  turbo: "",
  combTurbo: "",
};

// Los avisos de esta pantalla van chicos: la carga es rápida y repetitiva, y
// un cartel grande tapa la planilla en cada parte que se guarda.
const avisar = (opciones) =>
  Swal.fire({
    width: "330px",
    padding: "0.85rem",
    customClass: { popup: "swal-compacto" },
    ...opciones,
  });

const soloFecha = (iso) => (iso || "").slice(0, 10);

// Corte grueso entre los tres bloques de la planilla: el turno, lo que pasó en
// el centro de costo y el detalle de la tarea. Va por clase porque index.css
// pisa los bordes de th/td con !important.
const SEP = "sep-bloque";

// Las columnas de texto largo (personal, cliente, lote, observaciones y
// tarea) parten en renglones en vez de ensanchar la tabla: así entra en el
// ancho de la pantalla sin scroll lateral (24/09/2026).
const AJUSTA = { whiteSpace: "normal", wordBreak: "break-word", minWidth: "70px" };

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

// Mismo cálculo que hace el backend, para mostrar el total mientras se carga.
// "HH:mm" -> minutos desde la medianoche. Devuelve null si no es una hora.
const aMinutos = (h) => {
  const m = /^(\d{1,2}):(\d{2})$/.exec((h || "").trim());
  if (!m) return null;
  const hs = Number(m[1]);
  const min = Number(m[2]);
  return hs > 23 || min > 59 ? null : hs * 60 + min;
};

// Los minutos de un tramo. Si el egreso es anterior al ingreso el turno cruzó
// la medianoche (22:00 → 06:00 son 8 horas, no -16).
const minutosDelTramo = (ingreso, egreso) => {
  const i = aMinutos(ingreso);
  const e = aMinutos(egreso);
  if (i === null || e === null) return 0;
  return e >= i ? e - i : 1440 - i + e;
};

const calcularHoras = (ingreso, egreso) =>
  Math.round((minutosDelTramo(ingreso, egreso) / 60) * 100) / 100;

/**
 * Los dos tramos del día no se pueden pisar: el segundo arranca cuando terminó
 * el primero. Es la misma cuenta que hace el backend (`tramosSeSolapan` en
 * partes.controller.js): todo se mide desde la Entrada 1, así también vale
 * para un turno que cruzó la medianoche.
 *
 * Con la Salida 1 sin cargar no hay nada que controlar: ese tramo todavía no
 * dura nada.
 */
const AVISO_SOLAPE = "El segundo tramo se pisa con el primero: la Entrada 2 tiene que ser posterior a la Salida 1";

// Dos nombres de lote son el mismo si coinciden sus letras y números: "L 12",
// "l12" y "L-12" son el mismo lote. Es la misma regla del padrón y del backend.
const comparable = (valor) =>
  (valor || "")
    .toString()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");

/**
 * El desmalezado va con la unidad en la que está medido el lote (23/09/2026):
 * un lote en hectáreas se desmaleza "x Ha" y no "Mecánico", y uno en plantas
 * al revés. Un lote sin medida o fuera del padrón no se controla. Devuelve
 * `{ lote, tarea, medida, correcta }` o null si está bien. Es la misma regla
 * de `desmalezadoFueraDeUnidad` en el backend.
 */
const desmalezadoFueraDeUnidad = ({ lote, tarea }, lotes, tareas) => {
  const delPadron = tareas.find((t) => t._id === tarea);
  if (!delPadron || !comparable(delPadron.tarea).includes("desmalezado")) return null;
  const buscado = comparable(lote);
  const delLote = buscado && lotes.find((l) => comparable(l.nombre) === buscado);
  if (!delLote) return null;

  const enHectareas = delLote.hectareas != null && delLote.plantas == null;
  const enPlantas = delLote.plantas != null && delLote.hectareas == null;
  const unidad = comparable(delPadron.unidad);
  const tareaEnHectareas = unidad.startsWith("hectarea") || unidad === "ha";
  const tareaEnPlantas = unidad.startsWith("planta");

  if (enHectareas && tareaEnPlantas) {
    return { lote: delLote.nombre, tarea: delPadron.tarea, medida: "hectáreas", correcta: "desmalezado x Ha" };
  }
  if (enPlantas && tareaEnHectareas) {
    return { lote: delLote.nombre, tarea: delPadron.tarea, medida: "plantas", correcta: "desmalezado mecánico" };
  }
  return null;
};

// Días entre dos días ("AAAA-MM-DD"). Se comparan como mediodía UTC para que
// no los mueva ningún horario de verano.
const diasEntre = (desde, hasta) =>
  Math.round((Date.parse(`${hasta}T12:00:00Z`) - Date.parse(`${desde}T12:00:00Z`)) / 86400000);

// Hasta cuántos días después del cierre se avisa. Más adelante es una segunda
// pasada y no hay nada que revisar (22/09/2026).
const DIAS_DE_AVISO = 3;

/**
 * El cierre de un lote que ya se dio por terminado con esa misma tarea, si lo
 * que se está cargando cae **dentro de los tres días siguientes**. Terminado un
 * lote no se vuelve a trabajar en él: al otro día es casi siempre un error de
 * carga, y eso es lo que se avisa. Un mes después es una segunda pasada normal,
 * que además se paga aparte, así que no se dice nada (22/09/2026).
 *
 * Se avisa en vez de no dejar guardar porque incluso al día siguiente puede ser
 * un remate legítimo del lote.
 */
const cierreDelLote = ({ lote, tarea, fecha }, cierres) => {
  const buscado = comparable(lote);
  if (!buscado || !tarea || !fecha) return null;
  const cierre = cierres.find(
    (c) => comparable(c.lote) === buscado && String(c.tarea) === String(tarea)
  );
  if (!cierre) return null;
  const dias = diasEntre(cierre.fecha, fecha.slice(0, 10));
  return dias > 0 && dias <= DIAS_DE_AVISO ? { ...cierre, dias } : null;
};

const tramosSeSolapan = ({ horaIngreso, horaEgreso, horaIngreso2, horaEgreso2 }) => {
  const inicio1 = aMinutos(horaIngreso);
  const inicio2 = aMinutos(horaIngreso2);
  if (inicio1 === null || inicio2 === null) return false;

  // Tampoco puede arrancar antes que el primero: eso es la jornada cargada al
  // revés. La única vez que vale es cuando el primero cruzó la medianoche,
  // porque ahí las 03:00 del segundo son más tarde que las 22:00 del primero.
  const fin1 = aMinutos(horaEgreso);
  const cruzaMedianoche = fin1 !== null && fin1 < inicio1;
  if (!cruzaMedianoche && inicio2 < inicio1) return true;

  // Cuánto después de la Entrada 1 arranca el segundo tramo.
  const despues = (inicio2 - inicio1 + 1440) % 1440;
  if (despues < minutosDelTramo(horaIngreso, horaEgreso)) return true;

  // Y no puede dar la vuelta al reloj y pisar al primero por el otro lado.
  return despues + minutosDelTramo(horaIngreso2, horaEgreso2) > 1440;
};

const calcularHorasCC = (ingreso, salida) => {
  const i = Number(ingreso);
  const s = Number(salida);
  if (!Number.isFinite(i) || !Number.isFinite(s) || s <= i) return 0;
  return Math.round((s - i) * 100) / 100;
};

/**
 * Desplegable de filtro con el formato del resto del proyecto: se pinta en
 * rojo cuando está activo y suma una cruz para limpiarlo.
 *
 * Va sobre `SelectBuscador` y no sobre un `<select>` nativo porque el nativo
 * solo salta a la opción que EMPIEZA con lo tipeado: acá las listas de
 * personal y de tareas son largas y se buscan por cualquier parte del texto.
 *
 * Adentro, "sin filtro" es el string `vacio` ("Todos" / "Todas"); el buscador
 * usa "" para eso, así que se traduce en el borde.
 */
const FiltroSelect = ({ etiqueta, ancho, valor, vacio, onChange, opciones }) => {
  const activo = valor !== vacio;
  return (
    // minWidth 0 para que el filtro pueda achicarse: si no, el ancho mínimo
    // del select empuja la fila y los últimos filtros bajan a un segundo
    // renglón.
    <div className="d-flex align-items-center gap-1" style={{ minWidth: 0 }}>
      <span className="fw-bold text-dark small flex-shrink-0" style={{ fontSize: "0.75rem" }}>
        {etiqueta}:
      </span>
      <div className="d-flex align-items-center" style={{ width: ancho, minWidth: 0 }}>
        <div style={{ flex: "1 1 auto", minWidth: 0 }}>
          <SelectBuscador
            opciones={opciones.map(([id, texto]) => ({ valor: id, texto }))}
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

/**
 * La planilla de carga de partes de un mes.
 *
 * Es la misma para los dos campos: cambia el establecimiento con el que se
 * piden y se guardan los partes y el período. En San Pablo el día se corta al
 * mediodía, así que el turno tiene dos tramos (`dosTurnos`) y el trabajo se
 * marca como en proceso o terminado (`conEstado`). Berdina (la clave
 * `caspinchango`) no lleva ninguna de las dos cosas (17/09/2026).
 */
/**
 * El círculo de estado del trabajo: verde con la tilde si está terminado, rojo
 * con la cruz si sigue en proceso. Es el mismo de Reparaciones San Pablo.
 */
function CirculoEstado({
  terminado,
  onClick,
  deshabilitado = false,
  tamano = 20,
  inactivo = false,
  // En la tabla el círculo solo muestra cómo está: el estado se cambia
  // editando el parte (18/09/2026). Va como span y no como botón apagado para
  // que se lea igual de bien que el resto de la fila.
  soloLectura = false,
}) {
  const color = inactivo ? "#cbd5e1" : terminado ? "#15803d" : "#dc2626";
  const estado = inactivo
    ? "Esta tarea no lleva estado"
    : terminado
      ? "Terminado"
      : "En proceso";
  const estilo = {
    width: `${tamano}px`,
    height: `${tamano}px`,
    borderRadius: "50%",
    border: `2px solid ${color}`,
    backgroundColor: color,
    color: "#fff",
    cursor: deshabilitado || inactivo || soloLectura ? "default" : "pointer",
    opacity: deshabilitado && !inactivo ? 0.6 : 1,
    flexShrink: 0,
  };
  const tilde = (
    <i
      className={`bi ${terminado ? "bi-check-lg" : "bi-x-lg"}`}
      style={{ fontSize: `${tamano * (terminado ? 0.65 : 0.5)}px`, lineHeight: 1 }}
    ></i>
  );

  if (soloLectura) {
    return (
      <span
        title={inactivo ? estado : `${estado} — se cambia editando el parte`}
        className="d-inline-flex align-items-center justify-content-center p-0"
        style={estilo}
      >
        {tilde}
      </span>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={deshabilitado}
      title={estado}
      className="d-inline-flex align-items-center justify-content-center p-0"
      style={estilo}
    >
      {tilde}
    </button>
  );
}

function ProduccionCertificadoMes({
  establecimiento = "caspinchango",
  dosTurnos = false,
  conEstado = false,
  // El lote sale del padrón de Variables › Lotes en vez de escribirse a mano.
  conPadronDeLotes = false,
  // Tareas que llevan estado (en proceso / terminado). Vacío, lo llevan todas
  // las de la pantalla que tenga `conEstado`.
  tareasConEstado = [],
  tareasDestacadas = [],
  // Tareas que se cargan sin cantidad: alcanza con que el nombre las contenga
  // ("desmalezado" toma todos los desmalezados). Vacío, la cantidad es
  // obligatoria siempre.
  tareasSinCantidad = [],
}) {
  const { anio, mes } = useParams();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  // Todas las llamadas de partes y de períodos van con el establecimiento.
  const qEstab = `establecimiento=${establecimiento}`;
  const [periodo, setPeriodo] = useState({ desde: "", hasta: "" });
  const [cerrado, setCerrado] = useState(false);
  const [fechaCierre, setFechaCierre] = useState(null);
  const [partes, setPartes] = useState([]);
  const [personal, setPersonal] = useState([]);
  const [centros, setCentros] = useState([]);
  const [tareas, setTareas] = useState([]);
  const [lotes, setLotes] = useState([]);
  // Los lotes que ya se dieron por terminados, con la tarea y la fecha del
  // cierre: `[{ lote, tarea, fecha }]`.
  const [cierresDeLotes, setCierresDeLotes] = useState([]);

  const [busqueda, setBusqueda] = useState("");
  const [filtroFecha, setFiltroFecha] = useState("");
  const [filtroPersona, setFiltroPersona] = useState("Todos");
  const [filtroTarea, setFiltroTarea] = useState("Todas");
  const [filtroCC, setFiltroCC] = useState("Todos");
  const [filtroTurbo, setFiltroTurbo] = useState("Todos");
  // Arranca en "Todos": filtrar por un cliente escondería los partes del otro.
  const [filtroCliente, setFiltroCliente] = useState("Todos");

  const [form, setForm] = useState(FORM_VACIO);
  const [editando, setEditando] = useState(null);
  const [guardando, setGuardando] = useState(false);
  const refPersona = useRef(null);

  // Un parte a medio cargar o en edición frena la recarga sola por versión
  // nueva. La fecha y el cliente no cuentan: quedan puestos entre parte y parte.
  useSinGuardar(
    Boolean(editando) ||
      Object.entries(form).some(
        ([campo, valor]) =>
          !["fecha", "cliente", "terminado"].includes(campo) && String(valor ?? "").trim() !== ""
      )
  );

  // Último pedido del horómetro de entrada ("cc|fecha"): una respuesta vieja
  // no pisa lo que ya cambió en pantalla.
  const ccPedido = useRef(null);
  // El valor que puso el sistema en Horóm. entra. Si el que está en el campo
  // es otro, lo escribió una persona y no se toca.
  const horomAuto = useRef("");
  // De dónde salió ese valor ({ horometro, fecha, fuente, campo }): puede ser
  // de otro parte, pero también de un service, una reparación o una visita.
  const [origenHorom, setOrigenHorom] = useState(null);
  const [ccTexto, setCcTexto] = useState("");

  const titulo = `${MESES[Number(mes) - 1] || ""} ${anio}`;
  // Clave del certificado ("2026-08"): marca los partes con fecha posterior al
  // cierre que se dejaron en este mes con una explicación.
  const clavePeriodo = `${anio}-${String(mes).padStart(2, "0")}`;
  const nombreMes = MESES[Number(mes) - 1] || "";
  const mesSiguiente = MESES[Number(mes) % 12] || "";

  // ── carga de datos ────────────────────────────────────────────────
  const cargarPeriodo = async () => {
    try {
      const res = await fetch(`/api/periodos/${anio}/${mes}?${qEstab}`);
      const data = await res.json();
      const estaCerrado = Boolean(data.cerrado);
      setCerrado(estaCerrado);
      setFechaCierre(soloFecha(data.fechaCierre) || null);
      // El "hasta" es la fecha de cierre (por defecto el 25), también con la
      // certificación abierta: nada posterior entra en este mes salvo que se
      // lo deje con una explicación.
      const rango = { desde: soloFecha(data.desde), hasta: soloFecha(data.hasta) };
      setPeriodo(rango);
      return rango;
    } catch {
      return null;
    }
  };

  const cargarPartes = async (rango) => {
    if (!rango?.desde || !rango?.hasta) return;
    try {
      const res = await fetch(
        `/api/partes?desde=${rango.desde}&hasta=${rango.hasta}&periodo=${clavePeriodo}&${qEstab}`
      );
      const data = res.ok ? await res.json() : [];
      setPartes(Array.isArray(data) ? data : []);
    } catch {
      setPartes([]);
    }
  };

  // El backend devuelve el parte recién guardado ya poblado, así que se lo
  // acomoda en la lista que está en pantalla en lugar de volver a pedir todo
  // el período: esa recarga era casi un segundo de espera después de cada
  // alta. El orden es el mismo que usa el backend: por fecha y, dentro del
  // día, por orden de carga.
  const ubicarParte = (parte, rango) => {
    const dia = soloFecha(parte.fecha);
    setPartes((actuales) => {
      const resto = actuales.filter((x) => x._id !== parte._id);
      // Un parte fuera del período no pertenece a esta planilla, salvo que se
      // lo haya dejado en este mes con una explicación.
      const fuera = rango?.desde && rango?.hasta && (dia < rango.desde || dia > rango.hasta);
      if (fuera && parte.periodo !== clavePeriodo) return resto;
      return [...resto, parte].sort(
        (a, b) =>
          soloFecha(a.fecha).localeCompare(soloFecha(b.fecha)) ||
          String(a.createdAt || "").localeCompare(String(b.createdAt || ""))
      );
    });
  };

  const cargarPadrones = async () => {
    const pedir = async (url) => {
      try {
        const res = await fetch(url);
        const data = res.ok ? await res.json() : [];
        return Array.isArray(data) ? data : [];
      } catch {
        return [];
      }
    };
    // Los padrones son independientes: pedirlos en fila era esperar varias
    // veces la misma ida y vuelta al servidor.
    const [personas, centrosCosto, listaTareas, padronLotes, cierres] = await Promise.all([
      pedir("/api/personal"),
      pedir("/api/centros-costo"),
      pedir("/api/tareas"),
      // Los lotes son del campo y solo los usa la planilla que los tiene.
      conPadronDeLotes ? pedir(`/api/lotes?${qEstab}`) : Promise.resolve([]),
      // Los lotes que ya se terminaron, para avisar si se carga trabajo
      // después del cierre. Vienen todos de una vez: son pocos y así no hay
      // que preguntar en cada parte que se guarda.
      conEstado ? pedir(`/api/partes/cierres-de-lotes?${qEstab}`) : Promise.resolve([]),
    ]);
    setPersonal(personas);
    setCentros(centrosCosto);
    setTareas(listaTareas);
    setLotes(padronLotes);
    setCierresDeLotes(cierres);
  };

  // Solo el listado de cierres, para después de marcar o desmarcar un lote.
  const cargarCierres = async () => {
    if (!conEstado) return;
    try {
      const res = await fetch(`/api/partes/cierres-de-lotes?${qEstab}`);
      const data = res.ok ? await res.json() : [];
      setCierresDeLotes(Array.isArray(data) ? data : []);
    } catch {
      // Sin el listado no se avisa nada, pero la planilla sigue andando.
    }
  };
  useEffect(() => {
    (async () => {
      // Los padrones no dependen del período, así que salen junto con él en
      // vez de esperarlo: era una ida y vuelta de más contra un cluster que
      // está lejos. Los partes sí necesitan el rango.
      const [rango] = await Promise.all([cargarPeriodo(), cargarPadrones()]);
      await cargarPartes(rango);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [anio, mes]);

  // ── período ───────────────────────────────────────────────────────
  // Qué se corrió en los meses de al lado al guardar un corte, para contarlo
  // en pantalla. Null si no se tocó ninguno.
  const cortesCorridos = (guardado) => {
    if (!guardado?.cierreAnterior && !guardado?.inicioSiguiente) return null;
    const lineas = [];
    if (guardado.cierreAnterior) {
      const mesAnterior = MESES[(Number(mes) + 10) % 12] || "";
      lineas.push(
        `El cierre de <b>${mesAnterior}</b> pasó al <b>${formatFecha(guardado.cierreAnterior)}</b>` +
          (guardado.anteriorCerrado ? ` (${mesAnterior} está cerrado).` : ".")
      );
    }
    if (guardado.inicioSiguiente) {
      const mesSiguiente = MESES[Number(mes) % 12] || "";
      lineas.push(
        `El inicio de <b>${mesSiguiente}</b> pasó al <b>${formatFecha(guardado.inicioSiguiente)}</b>` +
          (guardado.siguienteCerrado ? ` (${mesSiguiente} está cerrado).` : ".")
      );
    }
    const n = guardado.partesMovidos || 0;
    if (n) lineas.push(`<b>${n}</b> parte${n === 1 ? "" : "s"} cambi${n === 1 ? "ó" : "aron"} de mes.`);
    return lineas.map((l) => `<div>${l}</div>`).join("");
  };

  const guardarPeriodo = async () => {
    if (cerrado) return;
    if (!periodo.desde || !periodo.hasta) return;
    try {
      const res = await fetch(`/api/periodos/${anio}/${mes}?${qEstab}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(periodo),
      });
      if (res.ok) {
        const guardado = await res.json().catch(() => ({}));
        await cargarPartes(periodo);
        // Entre dos meses hay un solo corte: si el backend corrió el mes de al
        // lado, se avisa.
        const corrido = cortesCorridos(guardado);
        if (corrido) {
          avisar({ icon: "info", title: "Período actualizado", html: corrido });
        } else {
          avisar({ icon: "success", title: "Período actualizado", timer: 1200, showConfirmButton: false });
        }
      } else {
        const err = await res.json();
        avisar({ icon: "error", title: "Error", text: err.error || "No se pudo guardar el período" });
      }
    } catch {
      avisar({ icon: "error", title: "Sin conexión", text: "No se pudo conectar con el servidor" });
    }
  };

  // Guarda el período junto con el estado de cierre y refresca la pantalla.
  const guardarCierre = async (rango, cerrar, fecha) => {
    const res = await fetch(`/api/periodos/${anio}/${mes}?${qEstab}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...rango, cerrado: cerrar, fechaCierre: fecha }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      avisar({ icon: "error", title: "Error", text: err.error || "No se pudo guardar el cierre" });
      return false;
    }
    // La fecha elegida en el modal pasa a ser el "al" de arriba enseguida,
    // sin esperar la recarga.
    const guardado = await res.json().catch(() => null);
    if (guardado?.hasta) {
      setPeriodo({ desde: soloFecha(guardado.desde), hasta: soloFecha(guardado.hasta) });
    }
    const nuevo = await cargarPeriodo();
    await cargarPartes(nuevo);
    // Cerrar en otra fecha corre el inicio del mes siguiente.
    const corrido = cortesCorridos(guardado);
    if (corrido) await avisar({ icon: "info", title: "Corte actualizado", html: corrido });
    return true;
  };

  // Fecha del último parte del rango. Los que se dejaron en este mes con fecha
  // posterior al cierre no cuentan: no dependen del "hasta" y no se caen si se
  // cierra antes.
  const ultimaCarga = useMemo(
    () =>
      partes.reduce((mayor, p) => {
        if (p.periodo === clavePeriodo) return mayor;
        const dia = soloFecha(p.fecha);
        return dia > mayor ? dia : mayor;
      }, ""),
    [partes, clavePeriodo]
  );

  /**
   * El cierre fija el "hasta" del período: si la fecha elegida es anterior a
   * la última carga, los partes posteriores dejan de entrar en la planilla.
   * Por eso cualquier fecha distinta a la propuesta se confirma aparte.
   */
  const confirmarFechaDeCierre = async (fecha) => {
    if (!ultimaCarga || fecha === ultimaCarga) return true;

    const anterior = fecha < ultimaCarga;
    const fuera = anterior
      ? partes.filter((x) => x.periodo !== clavePeriodo && soloFecha(x.fecha) > fecha).length
      : 0;

    const res = await avisar({
      icon: "warning",
      title: "¿Cerrar en esa fecha?",
      width: "380px",
      html: `
        <div style="text-align:left;font-size:0.84rem;line-height:1.5">
          <div>Fecha de cierre elegida: <b>${formatFecha(fecha)}</b></div>
          <div>Último parte cargado: <b>${formatFecha(ultimaCarga)}</b></div>
          <hr style="margin:.55rem 0">
          ${
            anterior
              ? `<div><b>${fuera}</b> parte${fuera === 1 ? "" : "s"} posterior${
                  fuera === 1 ? "" : "es"
                } a esa fecha <b>quedan fuera</b> de la certificación.</div>`
              : `<div>La certificación va a cerrar más allá del último parte cargado.</div>`
          }
        </div>`,
      showCancelButton: true,
      confirmButtonText: "Cerrar igual",
      cancelButtonText: "Corregir la fecha",
      confirmButtonColor: "#b45309",
      cancelButtonColor: "#15803d",
      reverseButtons: true,
    });
    return res.isConfirmed;
  };

  const cerrarCertificacion = async () => {
    // Viene puesta la fecha de cierre del período (por defecto el 25); se
    // puede cambiar, y si no coincide con el último parte hay que confirmarla.
    // Al corregir se vuelve a preguntar con lo que se había escrito.
    let propuesta = periodo.hasta || ultimaCarga || hoyStr();
    let fecha;

    for (;;) {
      const { value } = await avisar({
        title: "Cerrar certificación",
        text: "Indique la fecha de cierre. Después no se pueden agregar ni modificar partes.",
        input: "date",
        inputValue: propuesta,
        showCancelButton: true,
        confirmButtonColor: "#1b4332",
        cancelButtonColor: "#64748b",
        confirmButtonText: "Cerrar certificación",
        cancelButtonText: "Cancelar",
        inputValidator: (v) => (!v ? "Hay que indicar la fecha de cierre" : undefined),
      });
      if (!value) return;
      propuesta = value;
      if (await confirmarFechaDeCierre(value)) {
        fecha = value;
        break;
      }
    }

    // El cierre fija el "hasta" del período en la fecha elegida.
    const ok = await guardarCierre({ desde: periodo.desde, hasta: fecha }, true, fecha);
    if (ok) {
      avisar({ icon: "success", title: "Certificación cerrada", timer: 1400, showConfirmButton: false });
    }
  };

  const permitirEditar = async () => {
    const result = await avisar({
      title: "¿Permitir editar?",
      text: "La certificación vuelve a quedar abierta para agregar y modificar partes.",
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#b45309",
      cancelButtonColor: "#64748b",
      confirmButtonText: "Sí, permitir editar",
      cancelButtonText: "Cancelar",
    });
    if (!result.isConfirmed) return;

    const ok = await guardarCierre({ desde: periodo.desde, hasta: periodo.hasta }, false, null);
    if (ok) {
      avisar({ icon: "success", title: "Certificación abierta", timer: 1400, showConfirmButton: false });
    }
  };

  /**
   * A qué certificado va el parte según su fecha. Devuelve los campos que hay
   * que sumarle al guardado, o null si el usuario prefiere corregir la fecha.
   *  - Dentro del período: va a esta planilla.
   *  - Anterior al período: se guarda igual pero no aparece acá; se avisa,
   *    porque si no parece que no se hubiera guardado.
   *  - Posterior a la fecha de cierre: por regla va al mes siguiente. Para
   *    dejarlo en este hay que explicar por qué; la explicación se anota en
   *    observaciones y el parte queda asignado a este certificado.
   */
  const resolverFechaDelParte = async (fecha) => {
    const dia = soloFecha(fecha);
    const porFecha = { periodo: null, motivoFueraDeCierre: "" };
    if (!dia || !periodo.desde || !periodo.hasta) return porFecha;
    if (dia >= periodo.desde && dia <= periodo.hasta) return porFecha;

    if (dia < periodo.desde) {
      const res = await avisar({
        icon: "warning",
        title: "Fecha anterior al período",
        width: "380px",
        html: `
          <div style="text-align:left;font-size:0.84rem;line-height:1.5">
            <div>Fecha del parte: <b>${formatFecha(dia)}</b></div>
            <div>Período de la certificación: <b>${formatFecha(periodo.desde)}</b> al
              <b>${formatFecha(periodo.hasta)}</b></div>
            <hr style="margin:.55rem 0">
            <div>La fecha es <b>anterior</b> al período, así que el parte
              <b>no va a aparecer en esta planilla</b>.</div>
          </div>`,
        showCancelButton: true,
        confirmButtonText: "Guardar igual",
        cancelButtonText: "Corregir la fecha",
        confirmButtonColor: "#b45309",
        cancelButtonColor: "#15803d",
        reverseButtons: true,
      });
      return res.isConfirmed ? porFecha : null;
    }

    // Posterior al cierre. Si el parte ya estaba en este mes con su
    // explicación, se respeta y no se vuelve a preguntar.
    const previo = editando ? partes.find((x) => x._id === editando) : null;
    if (previo?.periodo === clavePeriodo && previo.motivoFueraDeCierre) {
      return { periodo: clavePeriodo, motivoFueraDeCierre: previo.motivoFueraDeCierre };
    }

    const res = await avisar({
      icon: "warning",
      title: "Fecha posterior al cierre",
      width: "420px",
      html: `
        <div style="text-align:left;font-size:0.84rem;line-height:1.5">
          <div>Fecha del parte: <b>${formatFecha(dia)}</b></div>
          <div>Cierre de ${nombreMes}: <b>${formatFecha(periodo.hasta)}</b></div>
          <hr style="margin:.55rem 0">
          <div>Por su fecha el parte corresponde a <b>${mesSiguiente}</b>. Para dejarlo
            en <b>${nombreMes}</b> explique por qué: la explicación queda en
            observaciones.</div>
        </div>`,
      input: "textarea",
      inputPlaceholder: "Explicación",
      inputAttributes: { maxlength: "200" },
      showDenyButton: true,
      showCancelButton: true,
      confirmButtonText: `Dejar en ${nombreMes}`,
      denyButtonText: `Pasar a ${mesSiguiente}`,
      cancelButtonText: "Corregir la fecha",
      confirmButtonColor: "#b45309",
      denyButtonColor: "#1b4332",
      cancelButtonColor: "#64748b",
      // Solo se valida al dejarlo en este mes: pasarlo al siguiente no pide nada.
      inputValidator: (v) =>
        !(v || "").trim() ? "Escriba la explicación para dejarlo en este mes" : undefined,
    });
    if (res.isDenied) return porFecha;
    if (!res.isConfirmed) return null;

    const motivo = String(res.value || "").trim();
    const nota = `Posterior al cierre: ${motivo}`;
    const obs = (form.observacion || "").trim();
    return {
      periodo: clavePeriodo,
      motivoFueraDeCierre: motivo,
      observacion: obs ? `${obs} · ${nota}` : nota,
    };
  };

  // El cartel que explica qué hizo el reparto al guardar el parte. Solo
  // aparece cuando hubo algo que repartir o que deshacer: en las tareas que se
  // cargan a mano no molesta.
  const contarElReparto = (reparto) => {
    if (!reparto) return;
    if (reparto.aviso) {
      return avisar({ icon: "warning", title: "Sin repartir", text: reparto.aviso });
    }
    if (reparto.estado === "limpiado") {
      return avisar({
        icon: "info",
        title: "El lote volvió a estar en proceso",
        text: "Se borraron las cantidades que había repartido el cierre.",
        timer: 3000,
        timerProgressBar: true,
      });
    }
    if (reparto.estado !== "repartido") return;
    const [anio, mes] = String(reparto.mes || "").split("-");
    const enMes = anio ? ` Se paga en ${MESES[Number(mes) - 1]} de ${anio}.` : "";
    avisar({
      icon: "success",
      title: `Lote ${reparto.lote} terminado`,
      text:
        `Se repartieron ${reparto.medida} ${(reparto.unidad || "").toLowerCase()} entre ` +
        `${reparto.jornadas} ${reparto.jornadas === 1 ? "jornada" : "jornadas"}, ` +
        `según las horas de cada una.${enMes}`,
      timer: 4000,
      timerProgressBar: true,
    });
  };

  // ── alta / edición de partes ──────────────────────────────────────
  const cambiar = (campo, valor) => setForm((f) => ({ ...f, [campo]: valor }));

  const limpiarForm = () => {
    // La fecha arranca vacía también después de guardar: se completa en cada parte.
    setForm(FORM_VACIO);
    setCcTexto("");
    horomAuto.current = "";
    ccPedido.current = null;
    setOrigenHorom(null);
    setEditando(null);
    refPersona.current?.focus();
  };

  // Manda el parte al backend. Devuelve la respuesta cruda para que el que
  // llama decida qué hacer con un conflicto de horómetro.
  const enviarParte = (datos) =>
    fetch(editando ? `/api/partes/${editando}` : "/api/partes", {
      method: editando ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...datos, establecimiento }),
    });

  const guardarParte = async () => {
    if (cerrado) return;
    // Mismos obligatorios que valida el backend.
    const falta = [];
    if (!form.fecha) falta.push("la fecha");
    if (!form.persona) falta.push("la persona");
    if (!form.tarea) falta.push("la tarea");
    if (pideCantidad && (form.cantidad === "" || form.cantidad === null)) falta.push("la cantidad");
    if (falta.length) {
      avisar({
        icon: "warning",
        title: "Faltan datos",
        text: `Falta ${falta.join(", ")}`,
      });
      return;
    }

    // Marcado terminado y después se borró el lote: no se guarda así.
    if (estadoEnForm && form.terminado && !String(form.lote || "").trim()) {
      avisar({
        icon: "warning",
        title: "Falta el lote",
        text: "Un parte terminado tiene que llevar el lote. Elíjalo o desmarque Terminado.",
      });
      return;
    }

    // Los dos tramos del día no se pueden pisar.
    if (dosTurnos && tramosSeSolapan(form)) {
      avisar({
        icon: "error",
        title: "Horarios que se pisan",
        html: `
          <div style="text-align:left;font-size:0.84rem;line-height:1.5">
            El segundo tramo no puede arrancar antes de que termine el primero.
            <div style="color:#64748b;margin-top:.4rem">
              La <b>Entrada 2</b> tiene que ser posterior a la <b>Salida 1</b>.
            </div>
          </div>`,
      });
      return;
    }

    // El desmalezado tiene que coincidir con la medida del lote: no se guarda.
    const unidadMal = desmalezadoFueraDeUnidad(form, lotes, tareas);
    if (unidadMal) {
      avisar({
        icon: "error",
        title: "Desmalezado que no corresponde",
        html: `
          <div style="text-align:left;font-size:0.84rem;line-height:1.5">
            <div>El lote <b>${unidadMal.lote}</b> está medido en <b>${unidadMal.medida}</b>.</div>
            <div style="margin-top:.4rem">No va <b>${unidadMal.tarea}</b>: va el
              <b>${unidadMal.correcta}</b>.</div>
          </div>`,
      });
      return;
    }

    // Un lote terminado no se vuelve a trabajar en los días siguientes. Se
    // controla al cargarlo y al cambiarle la fecha a uno que ya estaba; el
    // aviso deja guardar igual, porque puede ser un remate del lote.
    const fechaAnterior = editando
      ? soloFecha(partes.find((p) => p._id === editando)?.fecha)
      : null;
    if (!editando || fechaAnterior !== soloFecha(form.fecha)) {
      const cierre = cierreDelLote(form, cierresDeLotes);
      if (cierre) {
        const nombreTarea = tareas.find((t) => t._id === form.tarea)?.tarea || "esa tarea";
        const res = await avisar({
          icon: "warning",
          title: "El lote ya estaba terminado",
          width: "400px",
          html: `
            <div style="text-align:left;font-size:0.84rem;line-height:1.5">
              <div>El lote <b>${cierre.lote}</b> se dio por terminado el
                <b>${formatFecha(cierre.fecha)}</b> con <b>${nombreTarea}</b>.</div>
              <div style="margin-top:.4rem">Este parte es del
                <b>${formatFecha(soloFecha(form.fecha))}</b>,
                ${cierre.dias === 1 ? "el día siguiente" : `${cierre.dias} días después`}.</div>
              <hr style="margin:.55rem 0">
              <div style="color:#64748b">Si es lo que quedó por terminar está bien y se puede
                guardar. Si no, revise el lote, la tarea o la fecha.</div>
            </div>`,
          showCancelButton: true,
          confirmButtonText: "Guardar igual",
          cancelButtonText: "Corregir",
          confirmButtonColor: "#b45309",
          cancelButtonColor: "#15803d",
          reverseButtons: true,
        });
        if (!res.isConfirmed) return;
      }
    }

    // El CC se escribe a mano: si no coincide con ninguno del padrón, no entra.
    if (ccTexto.trim() && !form.cc) {
      avisar({
        icon: "error",
        title: "CC inexistente",
        html: `
          <div style="text-align:left;font-size:0.84rem;line-height:1.5">
            El centro de costo <b>${ccTexto.trim()}</b> no está dado de alta.
            <div style="color:#64748b;margin-top:.4rem">
              Corrija el número, o délo de alta en <b>Altas de CC</b>.
            </div>
          </div>`,
      });
      return;
    }

    // A qué certificado va el parte según su fecha: la fecha de cierre manda.
    const segunFecha = await resolverFechaDelParte(form.fecha);
    if (!segunFecha) return;
    // Terminado solo en las tareas con círculo: si se marcó con herbicida y
    // después se cambió a pulverizado, no queda guardado (25/09/2026).
    const datos = { ...form, ...segunFecha, terminado: estadoEnForm && Boolean(form.terminado) };

    setGuardando(true);
    try {
      // El horómetro retrocede: el aviso común lo resuelve con el usuario y
      // reintenta. Descartar guarda el parte sin la lectura, así queda vigente
      // el horómetro anterior.
      const tractorId = centros.find((c) => c._id === form.cc)?.tractor;
      const { ok, res, cuerpo, cancelado } = await guardarConReglaHorometro({
        tractor: typeof tractorId === "object" ? tractorId?._id : tractorId,
        fecha: form.fecha,
        enviar: ({ sinHorometro }) =>
          enviarParte(sinHorometro ? { ...datos, horomIngreso: "", horomSalida: "" } : datos),
      });
      if (cancelado) return;

      if (ok) {
        const eraEdicion = Boolean(editando);
        const guardado = await res.json().catch(() => null);
        // Lo normal es acomodar la fila que se guardó y no volver a pedir todo
        // el período: esa recarga es casi un segundo de espera. Solo se
        // recarga cuando el backend avisa que rehizo o deshizo el reparto de un
        // lote, porque ahí cambiaron también otras filas. Si por lo que sea no
        // vino el parte, también.
        const tocoElReparto = ["repartido", "limpiado"].includes(guardado?.reparto?.estado);
        if (guardado?._id && !tocoElReparto) {
          ubicarParte(guardado, periodo);
        } else {
          await cargarPartes(periodo);
        }
        // Un parte que se guarda terminado (o que deja de estarlo) cambia el
        // listado de cierres. No se espera: no tiene que frenar la carga.
        const cambioElEstado = guardado?.terminado || form.terminado;
        if (cambioElEstado) cargarCierres();
        limpiarForm();

        // Si el estado del lote movió el pago, eso es lo que hay que contar;
        // el "guardado" de siempre sobra.
        const reparto = guardado?.reparto;
        if (reparto?.aviso || reparto?.estado === "repartido" || reparto?.estado === "limpiado") {
          contarElReparto(reparto);
        } else {
          avisar({
            icon: "success",
            title: eraEdicion ? "Parte actualizado" : "Parte guardado",
            timer: 1500,
            showConfirmButton: false,
          });
        }
      } else {
        // El cuerpo del error ya lo leyó guardarConReglaHorometro.
        avisar({ icon: "error", title: "Error", text: cuerpo?.error || "No se pudo guardar" });
      }
    } catch {
      avisar({ icon: "error", title: "Sin conexión", text: "No se pudo conectar con el servidor" });
    } finally {
      setGuardando(false);
    }
  };

  // Enter guarda y deja todo listo para el parte siguiente.
  const alPresionarEnter = (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      guardarParte();
    }
  };

  const editarParte = (p) => {
    if (cerrado) return;
    setEditando(p._id);
    setCcTexto(p.cc?.cc || "");
    // El parte que se edita trae su propio horómetro: nada de esto lo puso el
    // sistema, así que tampoco se pisa si después se cambia la fecha.
    horomAuto.current = "";
    ccPedido.current = null;
    setOrigenHorom(null);
    setForm({
      fecha: soloFecha(p.fecha),
      persona: p.persona?._id || "",
      cc: p.cc?._id || "",
      cliente: p.cliente || CLIENTES[0],
      horaIngreso: p.horaIngreso || "",
      horaEgreso: p.horaEgreso || "",
      horaIngreso2: p.horaIngreso2 || "",
      horaEgreso2: p.horaEgreso2 || "",
      horomIngreso: p.horomIngreso ?? "",
      horomSalida: p.horomSalida ?? "",
      lote: p.lote || "",
      terminado: Boolean(p.terminado),
      observacion: p.observacion || "",
      tarea: p.tarea?._id || "",
      cantidad: p.cantidad ?? "",
      combustible: p.combustible ?? "",
      turbo: p.turbo || "",
      combTurbo: p.combTurbo ?? "",
    });
    refPersona.current?.focus();
  };

  const eliminarParte = async (p) => {
    if (cerrado) return;
    const result = await avisar({
      title: "¿Eliminar parte?",
      text: `${p.persona?.apellidoNombre || ""} — ${formatFecha(p.fecha)}`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#dc2626",
      cancelButtonColor: "#64748b",
      confirmButtonText: "Sí, eliminar",
      cancelButtonText: "Cancelar",
    });
    if (!result.isConfirmed) return;

    try {
      const res = await fetch(`/api/partes/${p._id}`, { method: "DELETE" });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        avisar({ icon: "error", title: "Error", text: err.error || "No se pudo eliminar el parte" });
        return;
      }
      setPartes((actuales) => actuales.filter((x) => x._id !== p._id));
      // Sacar una jornada de un lote terminado cambia el reparto de las demás:
      // solo en ese caso hay que volver a pedir el mes.
      const { reparto } = await res.json().catch(() => ({}));
      if (reparto?.estado === "repartido") await cargarPartes(periodo);
      // Si el que se borró era el que cerraba el lote, el listado cambió.
      if (p.terminado) cargarCierres();
      avisar({
        icon: "success",
        title: "Parte eliminado",
        timer: 1300,
        showConfirmButton: false,
      });
    } catch {
      avisar({ icon: "error", title: "Sin conexión", text: "No se pudo conectar con el servidor" });
    }
  };

  // ── datos derivados ───────────────────────────────────────────────
  const lotesUsados = useMemo(
    () => [...new Set(partes.map((p) => (p.lote || "").trim()).filter(Boolean))].sort(),
    [partes]
  );
  /**
   * Los clientes que se ofrecen al cargar un parte: los dos de siempre más los
   * que ya se escribieron en el período. Es un dato informativo, el precio no
   * depende de él.
   */
  const clientesUsados = useMemo(() => {
    const enPartes = [...new Set(partes.map((p) => (p.cliente || "").trim()).filter(Boolean))].sort(
      (a, b) => a.localeCompare(b, "es", { sensitivity: "base" })
    );
    return unirClientes(enPartes);
  }, [partes]);
  const turbos = useMemo(
    () => centros.filter((c) => (c.equipo || "").trim().toLowerCase() === "turbo"),
    [centros]
  );

  // El CC se elige de una lista que se va filtrando al escribir: el número, y
  // al costado el equipo y la descripción para reconocer la máquina.
  const opcionesCC = useMemo(
    () =>
      centros
        .map((c) => ({
          valor: String(c.cc).trim(),
          texto: String(c.cc).trim(),
          detalle: [c.equipo, c.descripcion].filter(Boolean).join(" · "),
        }))
        .sort((a, b) => a.texto.localeCompare(b.texto, "es", { numeric: true })),
    [centros]
  );

  // Elegir el CC arrastra el horómetro con el que quedó la máquina.
  const tipearCC = (texto) => {
    setCcTexto(texto);
    const buscado = texto.trim().toLowerCase();
    const centro = centros.find((c) => String(c.cc).trim().toLowerCase() === buscado);
    elegirCC(centro?._id || "");
  };

  /**
   * Completa el horómetro de entrada: es la lectura con la que quedó esa
   * máquina **antes de la fecha del parte** (o más temprano ese mismo día). Va
   * con la fecha para que cargar o corregir un día atrasado no arrastre el
   * horómetro de un día posterior que ya está cargado.
   *
   * **El horómetro es uno solo para todo el proyecto**: si el CC está enlazado
   * a un tractor, el backend mira también los services, las reparaciones, las
   * visitas y las cargas manuales, no solo los partes. Una lectura tomada en
   * el taller es la que arrastra el próximo parte, y la del parte es la que
   * ven el preventivo y las reparaciones.
   */
  const traerHorometroEntra = async (ccId, fecha) => {
    if (!ccId) {
      horomAuto.current = "";
      setOrigenHorom(null);
      setForm((f) => ({ ...f, horomIngreso: "" }));
      return;
    }

    const dia = soloFecha(fecha);
    const pedido = `${ccId}|${dia}`;
    ccPedido.current = pedido;
    try {
      // Sin fecha todavía, el backend devuelve la última lectura de todas.
      const res = await fetch(
        `/api/partes/ultimo-horometro/${ccId}${dia ? `?fecha=${dia}` : ""}`
      );
      const data = res.ok ? await res.json() : null;
      // Si mientras respondía cambió el CC o la fecha, este dato ya no sirve.
      if (ccPedido.current !== pedido) return;
      const lectura = data?.horometro ?? "";
      horomAuto.current = String(lectura);
      setOrigenHorom(lectura === "" || lectura === null ? null : data);
      setForm((f) => (f.cc === ccId ? { ...f, horomIngreso: lectura ?? "" } : f));
    } catch {
      if (ccPedido.current !== pedido) return;
      horomAuto.current = "";
      setOrigenHorom(null);
      setForm((f) => (f.cc === ccId ? { ...f, horomIngreso: "" } : f));
    }
  };

  const elegirCC = (ccId) => {
    setForm((f) => ({ ...f, cc: ccId }));
    // Editando no se pisa: ese parte ya tiene su propio horómetro.
    if (editando) return;
    traerHorometroEntra(ccId, form.fecha);
  };

  // Cambiar la fecha cambia cuál es el día anterior de esa máquina, así que el
  // horómetro de entrada se vuelve a pedir. Lo escrito a mano no se pisa: solo
  // se reemplaza lo que había puesto el sistema.
  const cambiarFecha = (fecha) => {
    cambiar("fecha", fecha);
    if (editando || !form.cc) return;
    if (String(form.horomIngreso ?? "") !== String(horomAuto.current ?? "")) return;
    traerHorometroEntra(form.cc, fecha);
  };

  const tareasOrdenadas = useMemo(() => {
    const esOtra = (t) => /^otra$/i.test((t.tarea || "").trim());
    const alfabetico = (a, b) =>
      (a.tarea || "").localeCompare(b.tarea || "", "es", { sensitivity: "base", numeric: true });
    return [
      ...tareas.filter((t) => !esOtra(t)).sort(alfabetico),
      // "Otra" es el cajón de sastre: va al final, no entre la N y la P.
      ...tareas.filter(esOtra),
    ];
  }, [tareas]);

  // Opciones de los desplegables con buscador de la fila de carga.
  const opcionesPersonal = useMemo(
    () => personal.map((p) => ({ valor: p._id, texto: p.apellidoNombre })),
    [personal]
  );

  // Las tareas de todos los días van primero y en negrita; el resto sigue
  // alfabético abajo. Se comparan sin acentos ni mayúsculas.
  const opcionesTarea = useMemo(() => {
    const limpio = (t) =>
      (t || "")
        .toString()
        .normalize("NFD")
        .replace(/[̀-ͯ]/g, "")
        .trim()
        .toLowerCase();
    const orden = new Map(tareasDestacadas.map((t, i) => [limpio(t), i]));
    const SIN_DESTACAR = Number.MAX_SAFE_INTEGER;
    const puesto = (t) => (orden.has(limpio(t.tarea)) ? orden.get(limpio(t.tarea)) : SIN_DESTACAR);
    return [...tareasOrdenadas]
      .sort((a, b) => puesto(a) - puesto(b))
      .map((t) => ({ valor: t._id, texto: t.tarea, destacada: puesto(t) !== SIN_DESTACAR }));
  }, [tareasOrdenadas, tareasDestacadas]);

  // El lote se elige del padrón; igual se puede escribir uno que todavía no
  // esté dado de alta, para no trabar la carga.
  const opcionesLote = useMemo(
    () => lotes.map((l) => ({ valor: l.nombre, texto: l.nombre })),
    [lotes]
  );

  const opcionesTurbo = useMemo(() => {
    const delPadron = turbos.map((t) => ({
      valor: t.cc,
      texto: t.descripcion ? `${t.cc} - ${t.descripcion}` : t.cc,
    }));
    // Un parte viejo puede tener un turbo escrito a mano que ya no está en el
    // padrón: se conserva para no perderlo.
    if (form.turbo && !turbos.some((t) => t.cc === form.turbo)) {
      delPadron.push({ valor: form.turbo, texto: form.turbo });
    }
    return delPadron;
  }, [turbos, form.turbo]);

  const hayFiltro =
    Boolean(busqueda) ||
    Boolean(filtroFecha) ||
    filtroPersona !== "Todos" ||
    filtroTarea !== "Todas" ||
    filtroCC !== "Todos" ||
    filtroTurbo !== "Todos" ||
    filtroCliente !== "Todos";

  const partesFiltrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    return partes.filter((p) => {
      if (filtroFecha && soloFecha(p.fecha) !== filtroFecha) return false;
      if (filtroPersona !== "Todos" && (p.persona?._id || "") !== filtroPersona) return false;
      if (filtroTarea !== "Todas" && (p.tarea?._id || "") !== filtroTarea) return false;
      if (filtroCC !== "Todos" && (p.cc?._id || "") !== filtroCC) return false;
      if (filtroTurbo !== "Todos" && (p.turbo || "") !== filtroTurbo) return false;
      if (filtroCliente !== "Todos" && (p.cliente || "").trim() !== filtroCliente) return false;
      if (!q) return true;
      return [
        p.persona?.apellidoNombre,
        p.cc?.cc,
        p.cliente,
        p.tarea?.tarea,
        p.turbo,
        p.lote,
        p.observacion,
      ]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q));
    });
  }, [partes, busqueda, filtroFecha, filtroPersona, filtroTarea, filtroCC, filtroTurbo, filtroCliente]);

  // Opciones de los desplegables: solo lo que aparece en el período cargado.
  const personasDelPeriodo = useMemo(() => {
    const m = new Map();
    partes.forEach((p) => p.persona && m.set(p.persona._id, p.persona.apellidoNombre));
    return [...m.entries()].sort((a, b) => a[1].localeCompare(b[1], "es", { sensitivity: "base" }));
  }, [partes]);

  const tareasDelPeriodo = useMemo(() => {
    const m = new Map();
    partes.forEach((p) => p.tarea && m.set(p.tarea._id, p.tarea.tarea));
    return [...m.entries()].sort((a, b) => a[1].localeCompare(b[1], "es", { sensitivity: "base" }));
  }, [partes]);

  const ccDelPeriodo = useMemo(() => {
    const m = new Map();
    partes.forEach((p) => p.cc && m.set(p.cc._id, p.cc.cc));
    return [...m.entries()].sort((a, b) =>
      String(a[1]).localeCompare(String(b[1]), "es", { numeric: true, sensitivity: "base" })
    );
  }, [partes]);

  const turbosDelPeriodo = useMemo(
    () =>
      [...new Set(partes.map((p) => (p.turbo || "").trim()).filter(Boolean))].sort((a, b) =>
        a.localeCompare(b, "es", { numeric: true, sensitivity: "base" })
      ),
    [partes]
  );

  // Para el filtro solo sirven los clientes que están en pantalla: ofrecer uno
  // que nadie cargó daría siempre cero filas.
  const clientesDelPeriodo = useMemo(
    () =>
      [...new Set(partes.map((p) => (p.cliente || "").trim()).filter(Boolean))].sort((a, b) =>
        a.localeCompare(b, "es", { sensitivity: "base" })
      ),
    [partes]
  );

  const observacionesUsadas = useMemo(
    () => [...new Set(partes.map((p) => (p.observacion || "").trim()).filter(Boolean))].sort(),
    [partes]
  );

  // Qué tareas llevan el círculo de estado: las que tengan alguno de esos
  // nombres (herbicida y desmalezado en San Pablo).
  const llevaEstado = (nombreTarea) => {
    if (!conEstado) return false;
    if (tareasConEstado.length === 0) return true;
    const limpio = (t) =>
      (t || "").toString().normalize("NFD").replace(/[̀-ͯ]/g, "").trim().toLowerCase();
    return tareasConEstado.some((s) => limpio(nombreTarea).includes(limpio(s)));
  };
  const estadoEnForm = llevaEstado(tareas.find((t) => t._id === form.tarea)?.tarea);

  // La cantidad es obligatoria salvo en las tareas exentas (desmalezado y
  // herbicida en San Pablo).
  const pideCantidad = (() => {
    if (tareasSinCantidad.length === 0) return true;
    const limpio = (t) =>
      (t || "").toString().normalize("NFD").replace(/[̀-ͯ]/g, "").trim().toLowerCase();
    const elegida = tareas.find((t) => t._id === form.tarea);
    if (!elegida) return true;
    return !tareasSinCantidad.some((s) => limpio(elegida.tarea).includes(limpio(s)));
  })();

  // El total suma los dos tramos: el segundo vacío no suma nada.
  const totalHorasForm =
    calcularHoras(form.horaIngreso, form.horaEgreso) +
    (dosTurnos ? calcularHoras(form.horaIngreso2, form.horaEgreso2) : 0);
  const horasCCForm = calcularHorasCC(form.horomIngreso, form.horomSalida);

  // De dónde salió el horómetro de entrada que puso el sistema. Se muestra
  // mientras sea ese valor: apenas alguien lo escribe a mano, la pista sobra.
  const pistaHorometro =
    origenHorom && String(form.horomIngreso ?? "") === String(horomAuto.current ?? "")
      ? `Última lectura de la máquina: ${origenHorom.horometro} · ` +
        `${etiquetaFuente(origenHorom.fuente, origenHorom.campo)} del ${formatFecha(origenHorom.fecha)}`
      : "";

  // ── exportar a Excel ──────────────────────────────────────────────
  const exportarExcel = async () => {
    const wb = await nuevoWorkbook();
    const ws = wb.addWorksheet("Certificación");

    const tituloHoja = `CERTIFICACIÓN DE PRODUCCIÓN - ${titulo.toUpperCase()}`;
    const columnas = [
      "Fecha",
      "Personal",
      ...(dosTurnos ? ["Entrada 1", "Salida 1", "Entrada 2", "Salida 2"] : ["Ingreso", "Egreso"]),
      "Total hs",
      "CC",
      "Horóm. entra",
      "Horóm. salida",
      "Horas CC",
      "Combust.",
      "Turbo",
      "Comb. turbo",
      "Cliente",
      "Lote",
      ...(conEstado ? ["Estado"] : []),
      "Observaciones",
      "Tarea",
      "Cantidad",
      "Un.",
    ];

    ws.mergeCells(1, 1, 1, columnas.length);
    const celdaTitulo = ws.getCell("A1");
    celdaTitulo.value = tituloHoja;
    celdaTitulo.font = { bold: true, size: 14, color: { argb: "FF000000" } };
    celdaTitulo.alignment = { horizontal: "center", vertical: "middle" };
    ws.getRow(1).height = 28;

    ws.mergeCells(2, 1, 2, 6);
    const celdaPeriodo = ws.getCell("A2");
    celdaPeriodo.value =
      `Período: ${formatFecha(periodo.desde)} al ${formatFecha(periodo.hasta)}` +
      (cerrado ? `  —  CERRADA el ${formatFecha(fechaCierre)}` : "");
    celdaPeriodo.font = { bold: true, size: 11 };
    celdaPeriodo.alignment = { horizontal: "left", vertical: "middle" };
    ws.getRow(2).height = 18;

    ws.addRow([]);

    const filaEnc = ws.addRow(columnas);
    filaEnc.eachCell((cell) => {
      cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
      cell.alignment = { horizontal: "center", vertical: "middle" };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1B4332" } };
      cell.border = {
        top: { style: "thin", color: { argb: "FFA0A0A0" } },
        left: { style: "thin", color: { argb: "FFA0A0A0" } },
        bottom: { style: "medium", color: { argb: "FF808080" } },
        right: { style: "thin", color: { argb: "FFA0A0A0" } },
      };
    });
    ws.getRow(4).height = 20;

    // Se baja lo que se está viendo, pero agrupado por persona: es como se
    // revisa y se firma la certificación.
    const ordenados = [...partesFiltrados].sort((a, b) => {
      const pa = a.persona?.apellidoNombre || "";
      const pb = b.persona?.apellidoNombre || "";
      const porPersona = pa.localeCompare(pb, "es", { sensitivity: "base" });
      if (porPersona !== 0) return porPersona;
      return soloFecha(a.fecha).localeCompare(soloFecha(b.fecha));
    });

    ordenados.forEach((p, idx) => {
      const prox = ordenados[idx + 1];
      const cambiaPersona =
        !prox || (p.persona?._id || "") !== (prox.persona?._id || "");

      const fila = ws.addRow([
        formatFecha(p.fecha),
        p.persona?.apellidoNombre || "-",
        p.horaIngreso || "-",
        p.horaEgreso || "-",
        ...(dosTurnos ? [p.horaIngreso2 || "-", p.horaEgreso2 || "-"] : []),
        p.totalHoras || 0,
        p.cc?.cc || "-",
        p.horomIngreso ?? "-",
        p.horomSalida ?? "-",
        p.horasCC || 0,
        p.combustible ?? "-",
        p.turbo || "-",
        p.combTurbo ?? "-",
        p.cliente || "-",
        p.lote || "-",
        ...(conEstado ? [llevaEstado(p.tarea?.tarea) ? (p.terminado ? "Terminado" : "En proceso") : "-"] : []),
        p.observacion || "-",
        p.tarea?.tarea || "-",
        p.cantidad ?? "-",
        p.tarea?.unidad || "-",
      ]);

      // Línea gruesa al terminar cada persona, como en la planilla de papel.
      const bottom = cambiaPersona
        ? { style: "medium", color: { argb: "FF1B4332" } }
        : { style: "thin", color: { argb: "FFE2E8F0" } };

      fila.eachCell({ includeEmpty: true }, (cell, colNumber) => {
        cell.border = {
          top: { style: "thin", color: { argb: "FFE2E8F0" } },
          left: { style: "thin", color: { argb: "FFE2E8F0" } },
          bottom,
          right: { style: "thin", color: { argb: "FFE2E8F0" } },
        };
        // Personal, cliente, lote, observaciones y tarea se leen mejor a la
        // izquierda.
        // Personal y, más a la derecha, cliente, lote, observaciones y tarea:
        // con los dos tramos esas cuatro se corren dos columnas.
        const corrimiento = dosTurnos ? 2 : 0;
        // Observaciones y tarea se corren una más con la columna de estado.
        const conEstadoCol = conEstado ? 1 : 0;
        const aIzquierda = [
          2,
          13 + corrimiento,
          14 + corrimiento,
          15 + corrimiento + conEstadoCol,
          16 + corrimiento + conEstadoCol,
        ];
        cell.alignment = aIzquierda.includes(colNumber)
          ? { horizontal: "left", vertical: "middle", wrapText: true }
          : { horizontal: "center", vertical: "middle" };
      });
    });

    ws.columns = [
      { width: 12 }, // Fecha
      { width: 26 }, // Personal
      { width: 10 }, // Ingreso / Entrada 1
      { width: 10 }, // Egreso / Salida 1
      ...(dosTurnos ? [{ width: 10 }, { width: 10 }] : []), // Entrada 2 / Salida 2
      { width: 10 }, // Total hs
      { width: 10 }, // CC
      { width: 14 }, // Horóm. entra
      { width: 14 }, // Horóm. salida
      { width: 10 }, // Horas CC
      { width: 11 }, // Combust.
      { width: 12 }, // Turbo
      { width: 12 }, // Comb. turbo
      { width: 22 }, // Cliente
      { width: 14 }, // Lote
      ...(conEstado ? [{ width: 12 }] : []), // Estado
      { width: 28 }, // Observaciones
      { width: 30 }, // Tarea
      { width: 11 }, // Cantidad
      { width: 12 }, // Un.
    ];

    const buffer = await wb.xlsx.writeBuffer();
    const blob = new Blob([buffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Certificacion_${titulo.replace(/\s+/g, "_")}.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const estiloCelda = { fontSize: "0.78rem", height: "30px", padding: "2px 6px" };
  // Los dos tramos del día pisándose: los campos del segundo van en rojo hasta
  // que se arregle, y guardar avisa lo mismo.
  const estiloCeldaPisada = { ...estiloCelda, borderColor: "#dc2626", color: "#dc2626" };
  const seSolapan = dosTurnos && tramosSeSolapan(form);

  const botonExcel = (
    <Button
      size="sm"
      onClick={exportarExcel}
      disabled={partesFiltrados.length === 0}
      className="rounded-3 px-3 d-flex align-items-center gap-2"
      style={{
        backgroundColor: "#15803d",
        borderColor: "#15803d",
        fontSize: "0.78rem",
        height: "30px",
        fontWeight: 600,
      }}
      title="Exportar a Excel, ordenado por personal"
    >
      <i className="bi bi-file-earmark-excel-fill"></i>
      <span>Excel</span>
    </Button>
  );

  // Abre el resumen por personal del mismo mes, el del Informe del mes
  // (24/09/2026). Cuadrado y del doble de alto que Excel, que va debajo. La
  // ruta sale de la de la planilla, así sirve para los dos campos.
  const botonResumen = (
    <Button
      size="sm"
      onClick={() => navigate(pathname.replace(/\/planilla\/?$/, "/informes/resumen"))}
      // Enter en el botón no tiene que guardar el parte de la fila.
      onKeyDown={(e) => e.stopPropagation()}
      className="rounded-3 p-0 d-flex flex-column align-items-center justify-content-center"
      style={{
        backgroundColor: "#1b4332",
        borderColor: "#1b4332",
        fontSize: "0.72rem",
        width: "60px",
        height: "60px",
        fontWeight: 600,
        lineHeight: 1.1,
      }}
      title="Ver el resumen por personal del mes"
    >
      <i className="bi bi-people-fill" style={{ fontSize: "1.1rem" }}></i>
      <span>Resumen</span>
    </Button>
  );

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
        {/* Encabezado: mes y período. El volver está en el navbar, arriba. */}
        <div className="d-flex align-items-center justify-content-between gap-3 mb-2 flex-wrap">
          <div className="d-flex align-items-center gap-2">
            <span className="fw-bold" style={{ color: "#1b4332", fontSize: "1.05rem" }}>
              {titulo}
            </span>          </div>

          {/* Cerrar / reabrir la certificación */}
          <div className="d-flex align-items-center gap-2">
            <Button
              size="sm"
              onClick={cerrado ? permitirEditar : cerrarCertificacion}
              className="rounded-3 px-3 d-flex align-items-center gap-2"
              style={{
                backgroundColor: cerrado ? "#b45309" : "#0e7490",
                borderColor: "transparent",
                fontSize: "0.78rem",
                height: "30px",
                fontWeight: 600,
              }}
              title={cerrado ? "Reabrir la certificación para poder editarla" : "Cerrar la certificación e impedir nuevos partes"}
            >
              <i className={`bi bi-${cerrado ? "unlock-fill" : "lock-fill"}`}></i>
              <span>{cerrado ? "Permitir editar" : "Cerrar certificación"}</span>
            </Button>
            {cerrado && fechaCierre && (
              <span className="text-muted" style={{ fontSize: "0.72rem" }}>
                Cerrada el {formatFecha(fechaCierre)}
              </span>
            )}
          </div>

          <div className="d-flex align-items-center gap-2">
            <span className="fw-bold text-dark" style={{ fontSize: "0.78rem" }}>
              Período:
            </span>
            <Form.Control
              type="date"
              size="sm"
              value={periodo.desde}
              disabled={cerrado}
              title="Arranca el día siguiente al cierre del mes anterior. Se puede corregir a mano."
              onChange={(e) => setPeriodo((p) => ({ ...p, desde: e.target.value }))}
              style={{ fontSize: "0.78rem", height: "30px", width: "140px" }}
            />
            <span className="text-muted" style={{ fontSize: "0.78rem" }}>
              al
            </span>
            <Form.Control
              type="date"
              size="sm"
              value={periodo.hasta}
              disabled={cerrado}
              title="Fecha de cierre: por defecto el 25. Un parte posterior va al mes siguiente, salvo que se lo deje en este con una explicación."
              onChange={(e) => setPeriodo((p) => ({ ...p, hasta: e.target.value }))}
              style={{ fontSize: "0.78rem", height: "30px", width: "140px" }}
            />
            <Button
              size="sm"
              onClick={guardarPeriodo}
              disabled={cerrado}
              className="rounded-3 px-2 py-1"
              style={{ backgroundColor: "#1b4332", borderColor: "#1b4332", fontSize: "0.78rem" }}
              title="Guardar el período y recargar"
            >
              <i className="bi bi-check-lg"></i>
            </Button>
          </div>
        </div>

        {/* Con la certificación cerrada no se cargan partes nuevos */}
        {cerrado && (
          <Card className="shadow-sm border-0 rounded-3 px-3 py-2 bg-white flex-shrink-0 mb-2 d-flex flex-row align-items-center gap-2">
            <i className="bi bi-lock-fill" style={{ color: "#b45309" }}></i>
            <span className="text-dark" style={{ fontSize: "0.8rem" }}>
              Certificación cerrada{fechaCierre ? ` el ${formatFecha(fechaCierre)}` : ""}. No se pueden agregar ni
              modificar partes. Use <span className="fw-semibold">Permitir editar</span> para reabrirla.
            </span>
            <div className="ms-auto d-flex flex-column align-items-end gap-1">
              {botonResumen}
              {botonExcel}
            </div>
          </Card>
        )}

        {/* Fila de carga */}
        {!cerrado && (
          <Card className="shadow-sm border-0 rounded-3 px-2 py-2 bg-white flex-shrink-0 mb-2">
            {/* Fila 1: persona, turno y datos del centro de costo */}
            <div className="d-flex align-items-end gap-2 flex-wrap" onKeyDown={alPresionarEnter}>
              <div style={{ width: "120px" }}>
                <label className="text-muted d-block" style={{ fontSize: "0.7rem" }}>
                  Fecha <span className="text-danger">*</span>
                </label>
                <Form.Control
                  type="date"
                  max={hoyStr()}
                  value={form.fecha}
                  onChange={(e) => cambiarFecha(e.target.value)}
                  style={estiloCelda}
                />
              </div>

              <div style={{ width: "175px" }}>
                <label className="text-muted d-block" style={{ fontSize: "0.7rem" }}>Personal *</label>
                {/* Desplegables con buscador: se filtra por cualquier pedazo del
                    texto, no solo por cómo empieza. */}
                <SelectBuscador
                  inputRef={refPersona}
                  opciones={opcionesPersonal}
                  valor={form.persona}
                  onChange={(v) => cambiar("persona", v)}
                  placeholder="—"
                  style={estiloCelda}
                />
              </div>

              <div style={{ width: "78px" }}>
                <label className="text-muted d-block" style={{ fontSize: "0.7rem" }}>
                  {dosTurnos ? "Entrada 1" : "Ingreso"}
                </label>
                <Form.Control type="time" value={form.horaIngreso} onChange={(e) => cambiar("horaIngreso", e.target.value)} style={estiloCelda} />
              </div>

              <div style={{ width: "78px" }}>
                <label className="text-muted d-block" style={{ fontSize: "0.7rem" }}>
                  {dosTurnos ? "Salida 1" : "Egreso"}
                </label>
                <Form.Control type="time" value={form.horaEgreso} onChange={(e) => cambiar("horaEgreso", e.target.value)} style={estiloCelda} />
              </div>

              {/* El día se corta al mediodía y se retoma a la tarde. Los dos
                  tramos no se pueden pisar: mientras se pisen, los campos van
                  en rojo y el parte no se guarda. */}
              {dosTurnos && (
                <>
                  <div style={{ width: "78px" }}>
                    <label
                      className={seSolapan ? "text-danger d-block fw-semibold" : "text-muted d-block"}
                      style={{ fontSize: "0.7rem" }}
                    >
                      Entrada 2
                    </label>
                    <Form.Control
                      type="time"
                      value={form.horaIngreso2}
                      onChange={(e) => cambiar("horaIngreso2", e.target.value)}
                      style={seSolapan ? estiloCeldaPisada : estiloCelda}
                      title={seSolapan ? AVISO_SOLAPE : undefined}
                    />
                  </div>

                  <div style={{ width: "78px" }}>
                    <label className="text-muted d-block" style={{ fontSize: "0.7rem" }}>Salida 2</label>
                    <Form.Control
                      type="time"
                      value={form.horaEgreso2}
                      onChange={(e) => cambiar("horaEgreso2", e.target.value)}
                      style={seSolapan ? estiloCeldaPisada : estiloCelda}
                      title={seSolapan ? AVISO_SOLAPE : undefined}
                    />
                  </div>
                </>
              )}

              <div style={{ width: "56px" }}>
                <label className="text-muted d-block" style={{ fontSize: "0.7rem" }}>Total</label>
                <div
                  className="d-flex align-items-center justify-content-center rounded-2 fw-bold"
                  style={{ ...estiloCelda, backgroundColor: "#e8f5ee", color: "#1b4332", border: "1px solid #a7d8bf" }}
                  title="Se calcula solo"
                >
                  {totalHorasForm || "—"}
                </div>
              </div>

              <div style={{ alignSelf: "stretch", borderLeft: "7px solid #cbd5e1", margin: "0 2px" }} />

              <div style={{ width: "110px" }}>
                <label className="text-muted d-block" style={{ fontSize: "0.7rem" }}>CC</label>
                {/* Libre: lo tipeado que no esté en la lista queda escrito y
                    en rojo, y al guardar se avisa que ese CC no existe. */}
                <SelectBuscador
                  libre
                  opciones={opcionesCC}
                  valor={ccTexto}
                  onChange={tipearCC}
                  placeholder="Nº"
                  title={
                    ccTexto && !form.cc
                      ? "Ese CC no está en el listado"
                      : "Escriba el número de CC"
                  }
                  style={{
                    ...estiloCelda,
                    // Rojo mientras lo tipeado no coincida con ningún CC.
                    borderColor: ccTexto && !form.cc ? "#dc2626" : undefined,
                  }}
                />
              </div>

              <div style={{ width: "92px" }}>
                <label className="text-muted d-block" style={{ fontSize: "0.7rem" }}>
                  Horóm. entra
                  {/* La lectura sale de todo el proyecto (parte, service,
                      reparación, visita o carga manual): el ícono cuenta de
                      cuál y de qué día, sin ocupar lugar en la fila. */}
                  {pistaHorometro && (
                    <i
                      className="bi bi-info-circle ms-1"
                      style={{ color: "#1b4332", cursor: "help" }}
                      title={pistaHorometro}
                    ></i>
                  )}
                </label>
                <Form.Control
                  type="number"
                  step="any"
                  value={form.horomIngreso}
                  onChange={(e) => cambiar("horomIngreso", e.target.value)}
                  title={pistaHorometro || undefined}
                  style={estiloCelda}
                />
              </div>

              <div style={{ width: "92px" }}>
                <label className="text-muted d-block" style={{ fontSize: "0.7rem" }}>Horóm. salida</label>
                <Form.Control type="number" step="any" value={form.horomSalida} onChange={(e) => cambiar("horomSalida", e.target.value)} style={estiloCelda} />
              </div>

              <div style={{ width: "64px" }}>
                <label className="text-muted d-block" style={{ fontSize: "0.7rem" }}>Horas CC</label>
                <div
                  className="d-flex align-items-center justify-content-center rounded-2 fw-bold"
                  style={{ ...estiloCelda, backgroundColor: "#e8f5ee", color: "#1b4332", border: "1px solid #a7d8bf" }}
                  title="Se calcula solo"
                >
                  {horasCCForm || "—"}
                </div>
              </div>

              <div style={{ width: "78px" }}>
                <label className="text-muted d-block" style={{ fontSize: "0.7rem" }}>Combust.</label>
                <Form.Control type="number" value={form.combustible} onChange={(e) => cambiar("combustible", e.target.value)} style={estiloCelda} />
              </div>

              <div style={{ width: "110px" }}>
                <label className="text-muted d-block" style={{ fontSize: "0.7rem" }}>Turbo</label>
                <SelectBuscador
                  opciones={opcionesTurbo}
                  valor={form.turbo}
                  onChange={(v) => cambiar("turbo", v)}
                  placeholder="—"
                  style={estiloCelda}
                />
              </div>

              <div style={{ width: "78px" }}>
                <label className="text-muted d-block" style={{ fontSize: "0.7rem" }}>Comb. turbo</label>
                <Form.Control type="number" value={form.combTurbo} onChange={(e) => cambiar("combTurbo", e.target.value)} style={estiloCelda} />
              </div>

              {/* Pegado a la derecha, justo arriba de Excel. */}
              <div className="ms-auto">{botonResumen}</div>
            </div>

            {/* Fila 2: el resto de los datos del parte */}
            <div className="d-flex align-items-end gap-2 flex-wrap mt-2" onKeyDown={alPresionarEnter}>
              <div style={{ width: "120px" }}>
                <label className="text-muted d-block" style={{ fontSize: "0.7rem" }}>Lote</label>
                {conPadronDeLotes ? (
                  <SelectBuscador
                    libre
                    opciones={opcionesLote}
                    valor={form.lote}
                    onChange={(v) => cambiar("lote", v)}
                    placeholder="Lote"
                    title="Los lotes se dan de alta en Variables › Lotes"
                    style={estiloCelda}
                  />
                ) : (
                  <>
                    <Form.Control list="lotes-usados" value={form.lote} onChange={(e) => cambiar("lote", e.target.value)} style={estiloCelda} />
                    <datalist id="lotes-usados">
                      {lotesUsados.map((l) => <option key={l} value={l} />)}
                    </datalist>
                  </>
                )}
              </div>

              {/* El rótulo es el estado: arriba del círculo dice en qué está. */}
              {conEstado && (
                <div style={{ width: "72px" }}>
                  <label
                    className="d-block fw-semibold text-center"
                    style={{
                      fontSize: "0.7rem",
                      color: !estadoEnForm ? "#94a3b8" : form.terminado ? "#15803d" : "#dc2626",
                    }}
                  >
                    {!estadoEnForm ? "—" : form.terminado ? "Terminado" : "En proceso"}
                  </label>
                  <div className="d-flex align-items-center justify-content-center" style={{ height: "30px" }}>
                    <CirculoEstado
                      terminado={form.terminado}
                      inactivo={!estadoEnForm}
                      onClick={() => {
                        if (!estadoEnForm) return;
                        // Terminado es el lote terminado: sin lote no hay qué
                        // dar por terminado (24/09/2026). Desmarcar sí se puede.
                        if (!form.terminado && !String(form.lote || "").trim()) {
                          avisar({
                            icon: "warning",
                            title: "Falta el lote",
                            text: "Elija el lote antes de marcarlo como terminado",
                          });
                          return;
                        }
                        cambiar("terminado", !form.terminado);
                      }}
                      deshabilitado={!estadoEnForm}
                      tamano={20}
                    />
                  </div>
                </div>
              )}

              <div style={{ width: "150px" }}>
                <label className="text-muted d-block" style={{ fontSize: "0.7rem" }}>Observaciones</label>
                <Form.Control list="obs-usadas" value={form.observacion} onChange={(e) => cambiar("observacion", e.target.value)} style={estiloCelda} />
                <datalist id="obs-usadas">
                  {observacionesUsadas.map((o) => <option key={o} value={o} />)}
                </datalist>
              </div>

              <div style={{ width: "185px" }}>
                <label className="text-muted d-block" style={{ fontSize: "0.7rem" }}>
                  Tarea <span className="text-danger">*</span>
                </label>
                <SelectBuscador
                  opciones={opcionesTarea}
                  valor={form.tarea}
                  onChange={(v) => cambiar("tarea", v)}
                  placeholder="—"
                  style={estiloCelda}
                />
              </div>

              <div style={{ width: "80px" }}>
                <label className="text-muted d-block" style={{ fontSize: "0.7rem" }}>
                  Cantidad {pideCantidad && <span className="text-danger">*</span>}
                </label>
                <Form.Control type="number" value={form.cantidad} onChange={(e) => cambiar("cantidad", e.target.value)} style={estiloCelda} />
              </div>

              <div style={{ width: "140px" }}>
                <label className="text-muted d-block" style={{ fontSize: "0.7rem" }}>
                  Cliente
                </label>
                {/* Desplegable con buscador en vez del datalist: el clic abre
                    la lista, que con el datalist solo aparecía al tipear. Va en
                    modo libre, porque el cliente sigue siendo texto y se puede
                    escribir uno que todavía no está en la lista. */}
                <SelectBuscador
                  libre
                  opciones={clientesUsados.map((c) => ({ valor: c, texto: c }))}
                  valor={form.cliente}
                  onChange={(v) => cambiar("cliente", v)}
                  placeholder="Cliente"
                  title="Solo informativo: el precio de la tarea no depende del cliente"
                  style={estiloCelda}
                />
              </div>

              <Button
                size="sm"
                onClick={guardarParte}
                disabled={guardando}
                className="rounded-3 px-3 d-flex align-items-center gap-1 ms-4"
                style={{ backgroundColor: editando ? "#0e7490" : "#15803d", borderColor: "transparent", fontSize: "0.78rem", height: "30px", fontWeight: 600 }}
              >
                <i className={`bi bi-${editando ? "check-lg" : "plus-lg"}`}></i>
                <span>{editando ? "Guardar" : "Agregar"}</span>
              </Button>

              {editando && (
                <Button
                  size="sm"
                  variant="outline-secondary"
                  onClick={limpiarForm}
                  className="rounded-3 px-2"
                  style={{ fontSize: "0.78rem", height: "30px" }}
                >
                  Cancelar
                </Button>
              )}

              {/* Pegado a la derecha, a la altura de Agregar. */}
              <div className="ms-auto">{botonExcel}</div>
            </div>
          </Card>
        )}

        {/* Avisos compactos + el corte grueso, que tiene que pisar el borde
            que index.css le pone a todas las celdas de tabla con !important. */}
        <style>{`
          .swal-compacto .swal2-title {
            font-size: 1rem !important;
            padding: 0 !important;
            line-height: 1.3;
          }
          .swal-compacto .swal2-html-container {
            font-size: 0.82rem !important;
            margin: 0.4rem 0 0 !important;
          }
          .swal-compacto .swal2-icon {
            width: 2.4em !important;
            height: 2.4em !important;
            margin: 0.4rem auto 0.3rem !important;
          }
          .swal-compacto .swal2-icon .swal2-icon-content { font-size: 1.6em !important; }
          .swal-compacto .swal2-actions { margin: 0.7rem 0 0.2rem !important; }
          .swal-compacto .swal2-styled {
            font-size: 0.82rem !important;
            padding: 0.4em 1.1em !important;
          }
          .swal-compacto .swal2-input,
          .swal-compacto .swal2-select {
            font-size: 0.85rem !important;
            height: 2.2em !important;
            margin: 0.5rem auto 0 !important;
          }
          .swal-compacto .swal2-validation-message { font-size: 0.78rem !important; }
          .tabla-certificado th.sep-bloque,
          .tabla-certificado td.sep-bloque {
            border-right: 3px solid #000000 !important;
          }
        `}</style>

        {/* Corte entre la carga y la tabla: fino pero oscuro, para que se vea
            dónde termina lo que se escribe y empieza lo cargado. */}
        <div
          className="flex-shrink-0 mb-2"
          style={{ borderTop: "2px solid #1b4332" }}
        />

        {/* Barra de Filtros */}
        <Card className="shadow-sm border-0 rounded-3 px-3 py-2 bg-white flex-shrink-0 mb-2">
          {/* Una sola fila: nowrap para que no se parta y justify-between para
              que el sobrante se reparta entre los filtros en vez de dejar un
              hueco muerto a la derecha. */}
          <div className="d-flex align-items-center flex-nowrap justify-content-between gap-3 w-100">
            {/* Buscador de Texto */}
            <div style={{ width: "205px", minWidth: 0, flexShrink: 1 }}>
              <div className="input-group input-group-sm">
                <span
                  className="input-group-text bg-light border-end-0 text-muted"
                  style={{ padding: "3px 9px", height: "32px" }}
                >
                  <i className="bi bi-search" style={{ fontSize: "0.8rem" }}></i>
                </span>
                <Form.Control
                  type="text"
                  placeholder="Buscar..."
                  title="Busca en personal, CC, cliente, tarea, lote y observaciones"
                  value={busqueda}
                  onChange={(e) => setBusqueda(e.target.value)}
                  className={`border-start-0 ps-0 ${busqueda ? "fw-bold filtro-activo" : ""}`}
                  style={{
                    fontSize: "0.82rem",
                    height: "32px",
                    padding: "3px 8px",
                    color: busqueda ? "#dc2626" : "#1e293b",
                    fontWeight: busqueda ? "700" : "normal",
                  }}
                />
                {busqueda && (
                  <button
                    className="btn btn-outline-secondary border-start-0 d-flex align-items-center justify-content-center"
                    type="button"
                    onClick={() => setBusqueda("")}
                    title="Limpiar búsqueda"
                    style={{ padding: "0 6px", height: "32px" }}
                  >
                    <i className="bi bi-x" style={{ fontSize: "0.9rem" }}></i>
                  </button>
                )}
              </div>
            </div>

            {/* Filtro por Fecha */}
            <div className="d-flex align-items-center gap-1" style={{ minWidth: 0 }}>
              <span className="fw-bold text-dark small flex-shrink-0" style={{ fontSize: "0.75rem" }}>
                Fecha:
              </span>
              <div className="input-group input-group-sm" style={{ width: "134px", minWidth: 0 }}>
                <Form.Control
                  type="date"
                  value={filtroFecha}
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

            {/* Filtro por Personal */}
            <FiltroSelect
              etiqueta="Personal"
              ancho="168px"
              valor={filtroPersona}
              vacio="Todos"
              onChange={setFiltroPersona}
              opciones={personasDelPeriodo}
            />

            {/* Filtro por Tarea */}
            <FiltroSelect
              etiqueta="Tarea"
              ancho="168px"
              valor={filtroTarea}
              vacio="Todas"
              onChange={setFiltroTarea}
              opciones={tareasDelPeriodo}
            />

            {/* Filtro por CC */}
            <FiltroSelect
              etiqueta="CC"
              ancho="98px"
              valor={filtroCC}
              vacio="Todos"
              onChange={setFiltroCC}
              opciones={ccDelPeriodo}
            />

            {/* Filtro por Cliente */}
            <FiltroSelect
              etiqueta="Cliente"
              ancho="132px"
              valor={filtroCliente}
              vacio="Todos"
              onChange={setFiltroCliente}
              opciones={clientesDelPeriodo.map((c) => [c, c])}
            />

            {/* Filtro por Turbo */}
            <FiltroSelect
              etiqueta="Turbo"
              ancho="112px"
              valor={filtroTurbo}
              vacio="Todos"
              onChange={setFiltroTurbo}
              opciones={turbosDelPeriodo.map((t) => [t, t])}
            />

            {hayFiltro && (
              <span
                className="text-muted flex-shrink-0"
                style={{ fontSize: "0.75rem", whiteSpace: "nowrap" }}
              >
                {partesFiltrados.length} de {partes.length}
              </span>
            )}
          </div>
        </Card>

        {/* Tabla de partes */}
        <div
          className="flex-grow-1 shadow-sm rounded-3 bg-white"
          style={{ overflowY: "auto", overflowX: "hidden", border: "1px solid #cbd5e1" }}
        >
          <Table size="sm" className="tabla-certificado tabla-informe text-center align-middle mb-0" style={{ whiteSpace: "nowrap", fontSize: "0.7rem", width: "100%" }}>
            <thead style={{ position: "sticky", top: 0, zIndex: 10, backgroundColor: "#1b4332", color: "#fff" }}>
              <tr className="fw-normal align-middle">
                {[
                  "Fecha", "Personal",
                  ...(dosTurnos
                    ? ["Entrada 1", "Salida 1", "Entrada 2", "Salida 2"]
                    : ["Ingreso", "Egreso"]),
                  { h: "Total hs", sep: true },
                  "CC", "Horóm. entra", "Horóm. sal.", "Horas CC", { h: "Combust.", sep: true },
                  "Turbo", { h: "Comb. turbo", sep: true }, "Cliente", "Lote", ...(conEstado ? [""] : []), "Observaciones", "Tarea", "Cantidad", "Un.", "",
                ].map((col, i) => {
                  const { h, sep } = typeof col === "string" ? { h: col, sep: false } : col;
                  return (
                    <th
                      key={i}
                      className={sep ? SEP : undefined}
                      style={{
                        backgroundColor: "#1b4332",
                        color: "#fff",
                        padding: "3px 5px",
                        fontSize: "0.66rem",
                        fontWeight: 600,
                        // El encabezado también parte ("Horóm. entra" en dos
                        // renglones) para no ser él el que ensancha la tabla.
                        whiteSpace: "normal",
                      }}
                    >
                      {h}
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {partesFiltrados.length === 0 ? (
                <tr>
                  <td colSpan={19} className="text-muted py-4" style={{ fontSize: "0.85rem" }}>
                    {hayFiltro
                      ? "Ningún parte coincide con los filtros"
                      : "No hay partes cargados en este período"}
                  </td>
                </tr>
              ) : (
                partesFiltrados.map((p) => (
                  <tr key={p._id} className={editando === p._id ? "fila-editando" : undefined}>
                    <td className="fw-semibold text-dark">
                      {formatFecha(p.fecha)}
                      {/* Posterior al cierre pero dejado en este mes: con su
                          explicación va en ámbar; sin ella en rojo, hasta que
                          se la cargue editando el parte. */}
                      {periodo.hasta && soloFecha(p.fecha) > periodo.hasta && (
                        <i
                          className={`bi ${
                            p.motivoFueraDeCierre ? "bi-info-circle-fill" : "bi-exclamation-triangle-fill"
                          } ms-1`}
                          style={{ color: p.motivoFueraDeCierre ? "#b45309" : "#dc2626" }}
                          title={
                            p.motivoFueraDeCierre
                              ? `Posterior al cierre: ${p.motivoFueraDeCierre}`
                              : "Posterior al cierre y sin explicación: edite el parte para cargarla"
                          }
                        ></i>
                      )}
                    </td>
                    <td className="text-start ps-2" style={AJUSTA}>{p.persona?.apellidoNombre || "—"}</td>
                    <td className="text-secondary">{p.horaIngreso || "—"}</td>
                    <td className="text-secondary">{p.horaEgreso || "—"}</td>
                    {dosTurnos && (
                      <>
                        <td className="text-secondary">{p.horaIngreso2 || "—"}</td>
                        <td className="text-secondary">{p.horaEgreso2 || "—"}</td>
                      </>
                    )}
                    <td className={`fw-bold ${SEP}`} style={{ color: "#1b4332" }}>{p.totalHoras || "—"}</td>
                    <td>{p.cc?.cc || "—"}</td>
                    <td className="text-secondary">{p.horomIngreso ?? "—"}</td>
                    <td className="text-secondary">{p.horomSalida ?? "—"}</td>
                    <td className="fw-bold" style={{ color: "#1b4332" }}>{p.horasCC || "—"}</td>
                    <td className={`text-secondary ${SEP}`}>{p.combustible ?? "—"}</td>
                    <td className="text-secondary">{p.turbo || "—"}</td>
                    <td className={`text-secondary ${SEP}`}>{p.combTurbo ?? "—"}</td>
                    {/* Informativo: el precio de la tarea no depende de él. */}
                    <td className="text-start ps-2 text-secondary" style={AJUSTA}>{p.cliente || "—"}</td>
                    {/* El lote terminado se marca: número blanco sobre verde.
                        En proceso va como cualquier otro dato. */}
                    <td className="text-secondary" style={AJUSTA}>
                      {p.lote ? (
                        llevaEstado(p.tarea?.tarea) && p.terminado ? (
                          <span
                            className="px-2 rounded-pill fw-semibold"
                            style={{ backgroundColor: "#15803d", color: "#fff" }}
                          >
                            {p.lote}
                          </span>
                        ) : (
                          p.lote
                        )
                      ) : (
                        "—"
                      )}
                    </td>
                    {/* Solo muestra cómo está: para cambiarlo hay que editar
                        el parte. */}
                    {conEstado && (
                      <td style={{ padding: "3px 5px" }}>
                        {llevaEstado(p.tarea?.tarea) ? (
                          <CirculoEstado terminado={p.terminado} tamano={18} soloLectura />
                        ) : (
                          <span className="text-secondary">—</span>
                        )}
                      </td>
                    )}
                    <td className="text-start ps-2 text-secondary" style={AJUSTA}>{p.observacion || "—"}</td>
                    <td className="text-start ps-2" style={AJUSTA}>{p.tarea?.tarea || "—"}</td>
                    {/* La cantidad de un lote terminado la escribió el reparto, no
                        una persona: se marca para que se entienda de dónde salió. */}
                    <td className="fw-semibold" style={p.repartido ? { color: "#15803d" } : undefined}
                        title={p.repartido ? "Repartida al terminar el lote, según las horas de la jornada" : undefined}>
                      {p.cantidad ?? "—"}
                    </td>
                    <td className="text-secondary">{p.tarea?.unidad || "—"}</td>
                    <td>
                      <div className="d-flex justify-content-center gap-1">
                        {cerrado ? (
                          <span className="text-muted" style={{ fontSize: "0.7rem" }}>—</span>
                        ) : (
                          <>
                            <button
                              onClick={() => editarParte(p)}
                              className="btn btn-sm btn-outline-primary d-flex align-items-center justify-content-center rounded-2 p-0"
                              style={{ width: "22px", height: "22px" }}
                              title="Editar"
                            >
                              <i className="bi bi-pencil" style={{ fontSize: "0.7rem" }}></i>
                            </button>
                            <button
                              onClick={() => eliminarParte(p)}
                              className="btn btn-sm btn-outline-danger d-flex align-items-center justify-content-center rounded-2 p-0"
                              style={{ width: "22px", height: "22px" }}
                              title="Eliminar"
                            >
                              <i className="bi bi-trash" style={{ fontSize: "0.7rem" }}></i>
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </Table>
        </div>
      </Container>
    </div>
  );
}

export default ProduccionCertificadoMes;
