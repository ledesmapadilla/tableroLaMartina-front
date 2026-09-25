import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { Button, Card, Container, Form, Modal, Table } from "react-bootstrap";
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

const formatFecha = (iso) => {
  const [a, m, d] = soloFecha(iso).split("-");
  return d ? `${d}/${m}/${a}` : "—";
};

// Las cantidades van de 8 horas a 60.000 plantas: separador de miles y hasta
// dos decimales, sin arrastrar ceros que no dicen nada.
const nf = new Intl.NumberFormat("es-AR", { maximumFractionDigits: 2 });
// Los litros por planta dan 0,0049: con dos decimales se verían como cero.
const nfFino = new Intl.NumberFormat("es-AR", { maximumFractionDigits: 4 });
const numero = (v) => (v === null || v === undefined ? "—" : nf.format(v));
const numeroFino = (v) => (v === null || v === undefined ? "—" : nfFino.format(v));
const redondear = (v) => Math.round((Number(v) || 0) * 100) / 100;

const comparar = (a, b) => String(a).localeCompare(String(b), "es", { sensitivity: "base" });
// Los CC son "02", "151", "Retro": ordenan bien con comparación numérica.
const compararCC = (a, b) =>
  String(a).localeCompare(String(b), "es", { numeric: true, sensitivity: "base" });

// Litros por hora. Sin horas no hay consumo que calcular.
const consumo = (combustible, horas) => (horas > 0 ? redondear(combustible / horas) : null);
// Igual, pero sin redondear: se usa para litros por unidad.
const razon = (a, b) => (b > 0 ? a / b : null);

/**
 * Desvío contra el valor admisible (Variables › Valores admisibles,
 * 24/09/2026), en porcentaje: cuánto se apartó lo real del admisible.
 * Sin admisible cargado, o sin dato real, no hay desvío.
 */
const desvio = (real, admisible) =>
  real === null || real === undefined || !(admisible > 0) ? null : ((real - admisible) / admisible) * 100;

// El semáforo mira el desvío en contra: en el consumo es gastar de más, en el
// rendimiento es producir de menos. A favor siempre es verde. Rojo: más del 8 %
// en contra (regla del usuario); amarillo: entre el 4 % y el 8 %.
const DESVIO_AMARILLO = 4;
const DESVIO_ROJO = 8;
const SEMAFORO = {
  verde: { backgroundColor: "#dcfce7", color: "#15803d" },
  amarillo: { backgroundColor: "#fef9c3", color: "#a16207" },
  rojo: { backgroundColor: "#fee2e2", color: "#b91c1c" },
};
const semaforo = (d, malSiSube) => {
  if (d === null) return null;
  const enContra = malSiSube ? d : -d;
  if (enContra > DESVIO_ROJO) return "rojo";
  if (enContra > DESVIO_AMARILLO) return "amarillo";
  return "verde";
};
const textoDesvio = (d) =>
  `${d > 0 ? "+" : ""}${d.toLocaleString("es-AR", { maximumFractionDigits: 1, minimumFractionDigits: 1 })} %`;

// Desplegable de filtro con el formato del resto del proyecto: se pinta en
// rojo cuando está activo y suma una cruz para limpiarlo.
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

/**
 * El mismo informe para los dos campos: cambia el establecimiento.
 *
 * Con `soloPersonal` muestra nada más el resumen por personal: es la página
 * que abre el botón Resumen de la planilla de carga (24/09/2026).
 */
function ProduccionInformeMes({ establecimiento = "caspinchango", soloPersonal = false }) {
  const { anio, mes } = useParams();
  const [periodo, setPeriodo] = useState({ desde: "", hasta: "" });
  const [cerrado, setCerrado] = useState(false);
  const [partes, setPartes] = useState([]);
  const [cargando, setCargando] = useState(true);
  // Persona cuyo detalle se está mirando (el botón "Ver" de cada fila).
  const [verPersona, setVerPersona] = useState(null);

  const [filtroFecha, setFiltroFecha] = useState("");
  const [filtroPersona, setFiltroPersona] = useState("Todos");
  const [filtroCC, setFiltroCC] = useState("Todos");
  const [filtroTarea, setFiltroTarea] = useState("Todas");

  const hayFiltro =
    Boolean(filtroFecha) ||
    filtroPersona !== "Todos" ||
    filtroCC !== "Todos" ||
    filtroTarea !== "Todas";

  // Los valores admisibles de cada tarea, por id de tarea. Son los mismos para
  // todos los campos y todos los meses.
  const [admisibles, setAdmisibles] = useState(new Map());
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/admisibles");
        const lista = res.ok ? await res.json() : [];
        setAdmisibles(new Map((Array.isArray(lista) ? lista : []).map((a) => [String(a.tarea?._id || a.tarea), a])));
      } catch {
        setAdmisibles(new Map());
      }
    })();
  }, []);
  // Admisible y desvío de una fila por CC y tarea: el consumo contra los
  // lts/hs de turno, y el rendimiento contra las unidades por hora de turno.
  const contraAdmisible = (f) => {
    const a = admisibles.get(String(f.idTarea));
    const consumoAdm = a?.consumo ?? null;
    const rendimientoAdm = a?.rendimiento ?? null;
    return {
      consumoAdm,
      desvioConsumo: desvio(f.consumo, consumoAdm),
      rendimientoAdm,
      desvioRendimiento: desvio(f.rendimiento, rendimientoAdm),
    };
  };

  const titulo = `${MESES[Number(mes) - 1] || ""} ${anio}`;
  // Los partes y el período son del establecimiento en el que se está parado.
  const qEstab = `establecimiento=${establecimiento}`;

  useEffect(() => {
    (async () => {
      setCargando(true);
      try {
        const res = await fetch(`/api/periodos/${anio}/${mes}?${qEstab}`);
        const data = await res.json();
        const estaCerrado = Boolean(data.cerrado);
        // El período llega hasta su fecha de cierre (por defecto el 25), igual
        // que en la planilla de carga; `periodo` suma los partes posteriores
        // que se dejaron en este mes con una explicación.
        const rango = { desde: soloFecha(data.desde), hasta: soloFecha(data.hasta) };
        setCerrado(estaCerrado);
        setPeriodo(rango);

        const clave = `${anio}-${String(mes).padStart(2, "0")}`;
        const resPartes = await fetch(
          `/api/partes?desde=${rango.desde}&hasta=${rango.hasta}&periodo=${clave}&${qEstab}`
        );
        const lista = resPartes.ok ? await resPartes.json() : [];
        setPartes(Array.isArray(lista) ? lista : []);
      } catch {
        setPartes([]);
      } finally {
        setCargando(false);
      }
    })();
  }, [anio, mes, qEstab]);

  /**
   * Los filtros recortan los partes antes de sumar: todas las tablas y el
   * Excel muestran siempre lo mismo que se está mirando.
   *
   * El filtro de CC va por **código** y no por id: así la misma opción sirve
   * para el CC del parte y para el turbo, que se guarda como el código de su
   * centro de costo.
   */
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
   * Una fila por persona: días trabajados, promedio de horas por día, total de
   * horas, combustible y el total de cada tarea que hizo.
   *
   * - Día trabajado = fecha distinta. Dos partes el mismo día son un día.
   * - Promedio = total de horas / días trabajados (no sobre los días del mes).
   * - Solo se listan las tareas que aparecen en el período: de las 21 del alta,
   *   un mes usa media docena.
   */
  const { filas, tareas, totalesPersonal } = useMemo(() => {
    const porPersona = new Map();
    const usadas = new Map();

    for (const p of partesFiltrados) {
      const id = p.persona?._id || "sin-persona";
      const nombre = p.persona?.apellidoNombre || "(sin persona)";
      if (!porPersona.has(id)) {
        porPersona.set(id, { id, nombre, dias: new Set(), horas: 0, combustible: 0, tareas: new Map() });
      }
      const fila = porPersona.get(id);
      // El renglón de pago de un lote terminado no es un día trabajado: paga
      // una jornada de otra certificación (25/09/2026).
      if (!p.pagoDe) fila.dias.add(soloFecha(p.fecha));
      fila.horas += Number(p.totalHoras) || 0;
      // El de la máquina. En Berdina suma también el del turbo, como los
      // totales de su planilla mensual (24/09/2026); San Pablo no lo mezcla.
      fila.combustible += Number(p.combustible) || 0;
      if (establecimiento !== "san-pablo") fila.combustible += Number(p.combTurbo) || 0;

      if (p.tarea?._id) {
        usadas.set(p.tarea._id, { id: p.tarea._id, nombre: p.tarea.tarea, unidad: p.tarea.unidad });
        fila.tareas.set(p.tarea._id, (fila.tareas.get(p.tarea._id) || 0) + (Number(p.cantidad) || 0));
      }
    }

    const listaTareas = [...usadas.values()].sort((a, b) => comparar(a.nombre, b.nombre));

    const listaFilas = [...porPersona.values()]
      .map((f) => ({
        id: f.id,
        nombre: f.nombre,
        dias: f.dias.size,
        horas: redondear(f.horas),
        combustible: redondear(f.combustible),
        promedio: f.dias.size ? redondear(f.horas / f.dias.size) : 0,
        tareas: f.tareas,
      }))
      .sort((a, b) => comparar(a.nombre, b.nombre));

    const sumaTareas = new Map();
    listaTareas.forEach((t) =>
      sumaTareas.set(
        t.id,
        redondear(listaFilas.reduce((acc, f) => acc + (f.tareas.get(t.id) || 0), 0))
      )
    );

    return {
      filas: listaFilas,
      tareas: listaTareas,
      totalesPersonal: {
        // Suma de los días de cada uno (jornales del mes), no los días
        // distintos del período: dos personas el mismo día son dos.
        dias: listaFilas.reduce((acc, f) => acc + f.dias, 0),
        horas: redondear(listaFilas.reduce((acc, f) => acc + f.horas, 0)),
        combustible: redondear(listaFilas.reduce((acc, f) => acc + f.combustible, 0)),
        tareas: sumaTareas,
      },
    };
  }, [partesFiltrados, establecimiento]);

  // Los partes de la persona abierta, del más viejo al más nuevo. Es de dónde
  // sale cada número de su fila, sin tener que volver a la planilla.
  const detalle = useMemo(() => {
    if (!verPersona) return [];
    return partesFiltrados
      .filter((p) => (p.persona?._id || "sin-persona") === verPersona.id)
      .sort(
        (a, b) =>
          soloFecha(a.fecha).localeCompare(soloFecha(b.fecha)) ||
          String(a.createdAt || "").localeCompare(String(b.createdAt || ""))
      );
  }, [partesFiltrados, verPersona]);

  /**
   * Las tres miradas por centro de costo.
   *
   * Dos columnas de horas: las del **turno** (`totalHoras`, siempre cargadas) y
   * las del **horómetro del CC** (`horasCC`, que dependen de que alguien tome
   * las lecturas), y un consumo para cada una.
   *
   * El **turbo es un CC más**: el parte guarda el CC del turbo en `turbo` y su
   * carga en `combTurbo`. Como el turbo no tiene horas propias, se le imputan
   * las del CC de esa misma fila del parte.
   *
   * Los partes sin CC ni turbo quedan afuera de estas tres tablas.
   */
  const { porCC, porTarea, totalesCC } = useMemo(() => {
    const cc = new Map();
    const tarea = new Map();

    const sumar = (mapa, clave, base, combustible, horasTurno, horasCC, cantidad = 0) => {
      if (!mapa.has(clave)) {
        mapa.set(clave, { id: clave, ...base, combustible: 0, horasTurno: 0, horasCC: 0, cantidad: 0 });
      }
      const fila = mapa.get(clave);
      fila.combustible += combustible;
      fila.horasTurno += horasTurno;
      fila.horasCC += horasCC;
      fila.cantidad += cantidad;
    };

    for (const p of partesFiltrados) {
      const horasTurno = Number(p.totalHoras) || 0;
      const horasCC = Number(p.horasCC) || 0;
      const nombreTarea = p.tarea?.tarea || "(sin tarea)";
      const idTarea = p.tarea?._id || "sin-tarea";
      const unidad = p.tarea?.unidad || "";
      const cantidad = Number(p.cantidad) || 0;

      if (p.cc?._id) {
        const combustible = Number(p.combustible) || 0;
        sumar(cc, p.cc._id, { cc: p.cc.cc, equipo: p.cc.equipo || "" }, combustible, horasTurno, horasCC);
        sumar(
          tarea,
          `${p.cc._id}|${idTarea}`,
          { cc: p.cc.cc, tarea: nombreTarea, idTarea, unidad },
          combustible,
          horasTurno,
          horasCC,
          cantidad
        );
      }

      const turbo = (p.turbo || "").trim();
      if (turbo) {
        // El turbo va como un CC aparte, con su propia carga y las horas del
        // CC con el que trabajó ese día.
        const combTurbo = Number(p.combTurbo) || 0;
        sumar(cc, `turbo:${turbo}`, { cc: turbo, equipo: "Turbo" }, combTurbo, horasTurno, horasCC);
        sumar(
          tarea,
          `turbo:${turbo}|${idTarea}`,
          { cc: turbo, tarea: nombreTarea, idTarea, unidad },
          combTurbo,
          horasTurno,
          horasCC,
          cantidad
        );
      }
    }

    const cerrarFila = (f) => ({
      ...f,
      combustible: redondear(f.combustible),
      horasTurno: redondear(f.horasTurno),
      horasCC: redondear(f.horasCC),
      cantidad: redondear(f.cantidad),
      consumo: consumo(f.combustible, f.horasTurno),
      consumoCC: consumo(f.combustible, f.horasCC),
      // Producción: cuántos litros costó cada unidad, cuántas unidades salieron
      // por litro y cuántas por hora de turno.
      ltsPorUnidad: razon(f.combustible, f.cantidad),
      unidadPorLts: razon(f.cantidad, f.combustible),
      rendimiento: razon(f.cantidad, f.horasTurno),
    });

    const listaCC = [...cc.values()].map(cerrarFila).sort((a, b) => compararCC(a.cc, b.cc));

    const listaTarea = [...tarea.values()]
      .map(cerrarFila)
      .sort((a, b) => compararCC(a.cc, b.cc) || comparar(a.tarea, b.tarea));

    // Los totales se sacan de los partes y no de las filas: un parte con turbo
    // aporta sus horas a dos filas (la del CC y la del turbo) y sumándolas las
    // horas quedarían contadas dos veces. El combustible sí se suma entero.
    let combustible = 0;
    let horasTurno = 0;
    let horasCC = 0;
    for (const p of partesFiltrados) {
      if (!p.cc?._id && !(p.turbo || "").trim()) continue;
      combustible += (Number(p.combustible) || 0) + (Number(p.combTurbo) || 0);
      horasTurno += Number(p.totalHoras) || 0;
      horasCC += Number(p.horasCC) || 0;
    }

    return {
      porCC: listaCC,
      porTarea: listaTarea,
      totalesCC: {
        combustible: redondear(combustible),
        horasTurno: redondear(horasTurno),
        horasCC: redondear(horasCC),
        consumo: consumo(combustible, horasTurno),
        consumoCC: consumo(combustible, horasCC),
      },
    };
  }, [partesFiltrados]);

  const exportarExcel = async () => {
    const wb = await nuevoWorkbook();

    const encabezar = (ws, columnas, subtitulo) => {
      ws.mergeCells(1, 1, 1, columnas.length);
      const celdaTitulo = ws.getCell("A1");
      celdaTitulo.value = `${subtitulo} - ${titulo.toUpperCase()}`;
      celdaTitulo.font = { bold: true, size: 14 };
      celdaTitulo.alignment = { horizontal: "center", vertical: "middle" };
      ws.getRow(1).height = 28;

      ws.mergeCells(2, 1, 2, Math.min(4, columnas.length));
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
      ws.getRow(4).height = 30;
    };

    const bordear = (fila, alIzquierda = [1]) =>
      fila.eachCell({ includeEmpty: true }, (cell, colNumber) => {
        cell.border = {
          top: { style: "thin", color: { argb: "FFE2E8F0" } },
          left: { style: "thin", color: { argb: "FFE2E8F0" } },
          bottom: { style: "thin", color: { argb: "FFE2E8F0" } },
          right: { style: "thin", color: { argb: "FFE2E8F0" } },
        };
        cell.alignment = alIzquierda.includes(colNumber)
          ? { horizontal: "left", vertical: "middle" }
          : { horizontal: "center", vertical: "middle" };
      });

    // El desvío va con el mismo semáforo que en pantalla.
    const COLOR_EXCEL = {
      verde: { fondo: "FFDCFCE7", letra: "FF15803D" },
      amarillo: { fondo: "FFFEF9C3", letra: "FFA16207" },
      rojo: { fondo: "FFFEE2E2", letra: "FFB91C1C" },
    };
    const pintarDesvio = (cell, d, malSiSube) => {
      const color = semaforo(d, malSiSube);
      if (!color) return;
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: COLOR_EXCEL[color].fondo } };
      cell.font = { bold: true, color: { argb: COLOR_EXCEL[color].letra } };
      cell.numFmt = '+0.0" %";-0.0" %";0.0" %"';
    };

    const resaltarTotal = (fila) =>
      fila.eachCell({ includeEmpty: true }, (cell) => {
        cell.font = { bold: true };
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE8F5EE" } };
        cell.border = { top: { style: "medium", color: { argb: "FF1B4332" } } };
      });

    // Hoja 1: por personal
    const ws0 = wb.addWorksheet("Por personal");
    const cols0 = [
      "Personal",
      "Días trabajados",
      "Prom. hs/día",
      "Total horas",
      "Combustible (lts)",
      ...tareas.map((t) => `${t.nombre} (${t.unidad || "—"})`),
    ];
    encabezar(ws0, cols0, "RESUMEN POR PERSONAL");
    filas.forEach((f) =>
      bordear(
        ws0.addRow([
          f.nombre,
          f.dias,
          f.promedio,
          f.horas,
          f.combustible,
          ...tareas.map((t) => (f.tareas.has(t.id) ? redondear(f.tareas.get(t.id)) : null)),
        ])
      )
    );
    resaltarTotal(
      ws0.addRow([
        "TOTAL",
        totalesPersonal.dias,
        null,
        totalesPersonal.horas,
        totalesPersonal.combustible,
        ...tareas.map((t) => totalesPersonal.tareas.get(t.id) ?? null),
      ])
    );
    ws0.columns = [
      { width: 28 },
      { width: 15 },
      { width: 13 },
      { width: 13 },
      { width: 16 },
      ...tareas.map(() => ({ width: 18 })),
    ];

    // Hoja 2: por centro de costo
    const ws1 = wb.addWorksheet("Por CC");
    const cols1 = [
      "CC",
      "Equipo",
      "Combustible (lts)",
      "Hs turno",
      "Hs CC",
      "Consumo (lts/hs turno)",
      "Consumo (lts/hs CC)",
    ];
    encabezar(ws1, cols1, "COMBUSTIBLE POR CC");
    porCC.forEach((f) =>
      bordear(
        ws1.addRow([f.cc, f.equipo || "—", f.combustible, f.horasTurno, f.horasCC, f.consumo, f.consumoCC]),
        [1, 2]
      )
    );
    resaltarTotal(
      ws1.addRow([
        "TOTAL",
        null,
        totalesCC.combustible,
        totalesCC.horasTurno,
        totalesCC.horasCC,
        totalesCC.consumo,
        totalesCC.consumoCC,
      ])
    );
    ws1.columns = [
      { width: 12 },
      { width: 16 },
      { width: 18 },
      { width: 11 },
      { width: 11 },
      { width: 20 },
      { width: 18 },
    ];

    // Hoja 3: por CC y tarea
    const ws2 = wb.addWorksheet("Por CC y tarea");
    const cols2 = [
      "CC",
      "Tarea",
      "Combustible (lts)",
      "Hs turno",
      "Hs CC",
      "Lts/hs turno",
      "Lts/hs CC",
      "Admisible (lts/hs)",
      "Desvío (%)",
    ];
    encabezar(ws2, cols2, "COMBUSTIBLE POR CC Y TAREA");
    porTarea.forEach((f) => {
      const a = contraAdmisible(f);
      const fila = ws2.addRow([
        f.cc,
        f.tarea,
        f.combustible,
        f.horasTurno,
        f.horasCC,
        f.consumo,
        f.consumoCC,
        a.consumoAdm,
        a.desvioConsumo === null ? null : Math.round(a.desvioConsumo * 10) / 10,
      ]);
      bordear(fila, [1, 2]);
      pintarDesvio(fila.getCell(9), a.desvioConsumo, true);
    });
    ws2.columns = [
      { width: 12 },
      { width: 28 },
      { width: 18 },
      { width: 11 },
      { width: 11 },
      { width: 13 },
      { width: 12 },
      { width: 12 },
      { width: 12 },
    ];

    // Hoja 4: producción y rendimiento
    const ws3 = wb.addWorksheet("Producción y rendimiento");
    const cols3 = [
      "CC",
      "Tarea",
      "Combustible (lts)",
      "Cantidad producida",
      "Unidad",
      "Consumo (lts/unidad)",
      "Consumo (unidad/lts)",
      "Rendimiento (un/hs turno)",
      "Admisible (un/hs)",
      "Desvío (%)",
    ];
    encabezar(ws3, cols3, "PRODUCCIÓN Y RENDIMIENTO POR CC Y TAREA");
    porTarea.forEach((f) => {
      const a = contraAdmisible(f);
      const fila = ws3.addRow([
        f.cc,
        f.tarea,
        f.combustible,
        f.cantidad,
        f.unidad || "—",
        f.ltsPorUnidad === null ? null : Math.round(f.ltsPorUnidad * 10000) / 10000,
        f.unidadPorLts === null ? null : redondear(f.unidadPorLts),
        f.rendimiento === null ? null : redondear(f.rendimiento),
        a.rendimientoAdm,
        a.desvioRendimiento === null ? null : Math.round(a.desvioRendimiento * 10) / 10,
      ]);
      bordear(fila, [1, 2, 5]);
      pintarDesvio(fila.getCell(10), a.desvioRendimiento, false);
    });
    ws3.columns = [
      { width: 12 },
      { width: 28 },
      { width: 18 },
      { width: 18 },
      { width: 11 },
      { width: 20 },
      { width: 20 },
      { width: 22 },
      { width: 12 },
      { width: 12 },
    ];

    // El resumen solo baja lo que muestra: la hoja por personal.
    if (soloPersonal) [ws1, ws2, ws3].forEach((ws) => wb.removeWorksheet(ws.id));

    const buffer = await wb.xlsx.writeBuffer();
    const blob = new Blob([buffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${soloPersonal ? "Resumen_personal" : "Informe"}_${titulo.replace(/\s+/g, "_")}.xlsx`;
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

  const rotulo = (texto) => (
    <div className="fw-bold mb-1" style={{ color: "#1b4332", fontSize: "0.82rem" }}>
      {texto}
    </div>
  );

  // Contenedor de cada tabla. "clip" y no "auto": un marco con scroll propio no
  // deja que la fila de títulos quede fija al bajar por la página (24/09/2026).
  // La más ancha pide 820px, que entra en cualquier monitor.
  const marco = { overflow: "clip", border: "1px solid #e2e8f0", display: "inline-block", maxWidth: "100%" };

  // Celda de número: sin dato va una raya gris, no un cero que miente.
  const celdaNumero = (valor, negrita = false) => (
    <td style={{ ...td, textAlign: "center", fontWeight: negrita ? 600 : 400 }}>
      {valor === null || valor === 0 ? <span style={{ color: "#cbd5e1" }}>—</span> : numero(valor)}
    </td>
  );

  // El desvío: el porcentaje con su signo, en una píldora con el color del
  // semáforo. Sin admisible cargado va la raya.
  const celdaDesvio = (d, malSiSube) => {
    const color = semaforo(d, malSiSube);
    return (
      <td style={{ ...td, textAlign: "center" }}>
        {color === null ? (
          <span style={{ color: "#cbd5e1" }}>—</span>
        ) : (
          <span
            className="px-2 rounded-pill fw-semibold d-inline-block"
            style={{ ...SEMAFORO[color], minWidth: "58px" }}
            title={
              malSiSube
                ? "Consumo contra el admisible: arriba es gastar de más"
                : "Rendimiento contra el admisible: abajo es producir de menos"
            }
          >
            {textoDesvio(d)}
          </span>
        )}
      </td>
    );
  };

  const sinDatos = (columnas, texto) => (
    <tr>
      <td colSpan={columnas} className="text-center text-muted py-4" style={td}>
        {cargando ? "Cargando…" : hayFiltro ? "Ningún parte coincide con los filtros" : texto}
      </td>
    </tr>
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
        {/* Encabezado. El volver está en el navbar de Producción, arriba. */}
        <div className="d-flex align-items-center gap-2 mb-2 flex-wrap">
          <span className="fw-bold" style={{ color: "#1b4332", fontSize: "1.05rem" }}>
            {soloPersonal ? "Resumen por personal" : "Informe del mes"} - {titulo}
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
            disabled={filas.length === 0 && porCC.length === 0}
            className="rounded-3 px-3 d-flex align-items-center gap-2 ms-auto"
            style={{
              backgroundColor: "#15803d",
              borderColor: "#15803d",
              fontSize: "0.78rem",
              height: "30px",
              fontWeight: 600,
            }}
            title={soloPersonal ? "Exportar el resumen a Excel" : "Exportar las cuatro tablas a Excel"}
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
          </div>
        </Card>

        {/* Cortes gruesos adentro de cada tabla: separan las horas de los
            consumos, y los consumos del admisible y su desvío. En el resumen por personal separa las horas y el
            combustible de las tareas (24/09/2026). Van por posición de
            columna y no celda por celda, y con
            !important porque index.css pisa los bordes de th/td. */}
        <style>{`
          .tabla-personal th:nth-child(5),
          .tabla-personal td:nth-child(5),
          .tabla-cc th:nth-child(5),
          .tabla-cc td:nth-child(5),
          .tabla-cc-tarea th:nth-child(5),
          .tabla-cc-tarea td:nth-child(5),
          .tabla-cc-tarea th:nth-child(7),
          .tabla-cc-tarea td:nth-child(7),
          .tabla-produccion th:nth-child(8),
          .tabla-produccion td:nth-child(8) {
            border-right: 3px solid #1b4332 !important;
          }
          /* Los títulos de cada tabla quedan fijos arriba al bajar por ella
             (24/09/2026). */
          .tabla-personal thead th,
          .tabla-cc thead th,
          .tabla-cc-tarea thead th,
          .tabla-produccion thead th,
          .tabla-detalle thead th {
            position: sticky;
            top: 0;
            z-index: 2;
          }
        `}</style>

        <div className="flex-grow-1" style={{ overflow: "auto" }}>
          {/* ── Resumen por personal ── */}
          <div className="mb-5">
            {rotulo("Resumen por personal")}
            {/* Sin scroll lateral (24/09/2026): la tabla va al ancho de la
                pantalla y son las columnas las que se angostan. Con las ~17
                tareas de Berdina, cada título baja en varios renglones.
                "clip" y no "hidden": hidden lo vuelve un contenedor de scroll
                y los títulos fijos dejan de quedarse arriba. */}
            <div
              className="bg-white rounded-3 shadow-sm"
              style={{ ...marco, display: "block", overflow: "clip" }}
            >
              <Table
                className="mb-0 tabla-informe tabla-personal"
                style={{ width: "100%" }}
              >
                <thead>
                  <tr>
                    <th style={{ ...th, textAlign: "left", minWidth: "110px", whiteSpace: "normal" }}>Personal</th>
                    <th style={{ ...th, textAlign: "center" }}>Días<br />trabajados</th>
                    <th style={{ ...th, textAlign: "center" }}>Prom.<br />hs/día</th>
                    <th style={{ ...th, textAlign: "center" }}>Total<br />horas</th>
                    <th style={{ ...th, textAlign: "center" }}>Combustible<br />(lts)</th>
                    {tareas.map((t) => (
                      <th
                        key={t.id}
                        style={{ ...th, textAlign: "center", whiteSpace: "normal", overflowWrap: "anywhere", padding: "3px 3px" }}
                      >
                        {t.nombre}
                        <div style={{ fontSize: "0.6rem", fontWeight: 400, opacity: 0.75 }}>
                          {t.unidad || "—"}
                        </div>
                      </th>
                    ))}
                    <th style={{ ...th, width: "52px" }}></th>
                  </tr>
                </thead>
                <tbody>
                  {cargando || filas.length === 0 ? (
                    sinDatos(6 + tareas.length, "No hay partes cargados en este período")
                  ) : (
                    <>
                      {filas.map((f) => (
                        <tr key={f.id}>
                          <td style={{ ...td, fontWeight: 500 }}>{f.nombre}</td>
                          <td style={{ ...td, textAlign: "center" }}>{f.dias}</td>
                          <td style={{ ...td, textAlign: "center" }}>{numero(f.promedio)}</td>
                          <td style={{ ...td, textAlign: "center", fontWeight: 600 }}>{numero(f.horas)}</td>
                          {celdaNumero(f.combustible)}
                          {tareas.map((t) => (
                            <td key={t.id} style={{ ...td, textAlign: "center" }}>
                              {f.tareas.has(t.id) ? (
                                numero(redondear(f.tareas.get(t.id)))
                              ) : (
                                <span style={{ color: "#cbd5e1" }}>—</span>
                              )}
                            </td>
                          ))}
                          <td style={{ ...td, textAlign: "center" }}>
                            <button
                              onClick={() => setVerPersona(f)}
                              className="btn btn-sm btn-outline-success rounded-3"
                              style={{ fontSize: "0.64rem", padding: "0 8px", height: "20px", fontWeight: 600 }}
                              title={`Ver los partes de ${f.nombre}`}
                            >
                              Ver
                            </button>
                          </td>
                        </tr>
                      ))}
                      <tr className="fila-total">
                        <td style={{ ...td, fontWeight: 700, color: "#1b4332" }}>TOTAL</td>
                        <td style={{ ...td, textAlign: "center", fontWeight: 700 }}>{totalesPersonal.dias}</td>
                        <td style={{ ...td, textAlign: "center" }}></td>
                        <td style={{ ...td, textAlign: "center", fontWeight: 700 }}>
                          {numero(totalesPersonal.horas)}
                        </td>
                        <td style={{ ...td, textAlign: "center", fontWeight: 700 }}>
                          {numero(totalesPersonal.combustible)}
                        </td>
                        {tareas.map((t) => (
                          <td key={t.id} style={{ ...td, textAlign: "center", fontWeight: 700 }}>
                            {numero(totalesPersonal.tareas.get(t.id))}
                          </td>
                        ))}
                        <td style={td}></td>
                      </tr>
                    </>
                  )}
                </tbody>
              </Table>
            </div>
          </div>

          {/* ── Por centro de costo ── */}
          {!soloPersonal && (
          <>
          <div className="mb-5">
            {rotulo("Por centro de costo")}
            <div className="bg-white rounded-3 shadow-sm" style={marco}>
              <Table className="mb-0 tabla-informe tabla-cc" style={{ width: "auto", minWidth: "620px" }}>
                <thead>
                  <tr>
                    <th style={{ ...th, textAlign: "left", minWidth: "90px" }}>CC</th>
                    <th style={{ ...th, textAlign: "left", minWidth: "110px" }}>Equipo</th>
                    <th style={{ ...th, textAlign: "center" }}>Combustible<br />(lts)</th>
                    <th style={{ ...th, textAlign: "center" }}>Hs<br />turno</th>
                    <th style={{ ...th, textAlign: "center" }}>Hs<br />CC</th>
                    <th style={{ ...th, textAlign: "center" }}>
                      Consumo
                      <div style={{ fontSize: "0.6rem", fontWeight: 400, opacity: 0.75 }}>lts / hs turno</div>
                    </th>
                    <th style={{ ...th, textAlign: "center" }}>
                      Consumo
                      <div style={{ fontSize: "0.6rem", fontWeight: 400, opacity: 0.75 }}>lts / hs CC</div>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {cargando || porCC.length === 0 ? (
                    sinDatos(7, "No hay partes con centro de costo en este período")
                  ) : (
                    <>
                      {porCC.map((f) => (
                        <tr key={f.id}>
                          <td style={{ ...td, fontWeight: 600 }}>{f.cc}</td>
                          <td style={td}>{f.equipo || "—"}</td>
                          {celdaNumero(f.combustible)}
                          {celdaNumero(f.horasTurno)}
                          {celdaNumero(f.horasCC)}
                          {celdaNumero(f.consumo, true)}
                          {celdaNumero(f.consumoCC, true)}
                        </tr>
                      ))}
                      <tr className="fila-total">
                        <td style={{ ...td, fontWeight: 700, color: "#1b4332" }}>TOTAL</td>
                        <td style={td}></td>
                        <td style={{ ...td, textAlign: "center", fontWeight: 700 }}>
                          {numero(totalesCC.combustible)}
                        </td>
                        <td style={{ ...td, textAlign: "center", fontWeight: 700 }}>
                          {numero(totalesCC.horasTurno)}
                        </td>
                        <td style={{ ...td, textAlign: "center", fontWeight: 700 }}>
                          {numero(totalesCC.horasCC)}
                        </td>
                        <td style={{ ...td, textAlign: "center", fontWeight: 700 }}>
                          {numero(totalesCC.consumo)}
                        </td>
                        <td style={{ ...td, textAlign: "center", fontWeight: 700 }}>
                          {totalesCC.consumoCC === null ? (
                            <span style={{ color: "#cbd5e1" }}>—</span>
                          ) : (
                            numero(totalesCC.consumoCC)
                          )}
                        </td>
                      </tr>
                    </>
                  )}
                </tbody>
              </Table>
            </div>
          </div>

          {/* ── Por centro de costo y tarea ── */}
          <div className="mb-5">
            {rotulo("Por centro de costo y tarea")}
            <div className="bg-white rounded-3 shadow-sm" style={marco}>
              <Table
                className="mb-0 tabla-informe tabla-cc-tarea"
                style={{ width: "auto", minWidth: "780px" }}
              >
                <thead>
                  <tr>
                    <th style={{ ...th, textAlign: "left", minWidth: "90px" }}>CC</th>
                    <th style={{ ...th, textAlign: "left", minWidth: "160px" }}>Tarea</th>
                    <th style={{ ...th, textAlign: "center" }}>Combustible<br />(lts)</th>
                    <th style={{ ...th, textAlign: "center" }}>Hs<br />turno</th>
                    <th style={{ ...th, textAlign: "center" }}>Hs<br />CC</th>
                    <th style={{ ...th, textAlign: "center" }}>
                      Lts/hs
                      <div style={{ fontSize: "0.6rem", fontWeight: 400, opacity: 0.75 }}>hs turno</div>
                    </th>
                    <th style={{ ...th, textAlign: "center" }}>
                      Lts/hs
                      <div style={{ fontSize: "0.6rem", fontWeight: 400, opacity: 0.75 }}>hs CC</div>
                    </th>
                    <th style={{ ...th, textAlign: "center" }}>
                      Admisible
                      <div style={{ fontSize: "0.6rem", fontWeight: 400, opacity: 0.75 }}>lts / hs</div>
                    </th>
                    <th style={{ ...th, textAlign: "center" }}>
                      Desvío (%)
                      <div style={{ fontSize: "0.6rem", fontWeight: 400, opacity: 0.75 }}>lts/hs turno</div>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {cargando || porTarea.length === 0
                    ? sinDatos(9, "No hay partes con centro de costo en este período")
                    : porTarea.map((f) => {
                        const a = contraAdmisible(f);
                        return (
                          <tr key={f.id}>
                            <td style={{ ...td, fontWeight: 600 }}>{f.cc}</td>
                            <td style={td}>{f.tarea}</td>
                            {celdaNumero(f.combustible)}
                            {celdaNumero(f.horasTurno)}
                            {celdaNumero(f.horasCC)}
                            {celdaNumero(f.consumo, true)}
                            {celdaNumero(f.consumoCC, true)}
                            {/* Contra el consumo admisible de la tarea */}
                            {celdaNumero(a.consumoAdm)}
                            {celdaDesvio(a.desvioConsumo, true)}
                          </tr>
                        );
                      })}
                </tbody>
              </Table>
            </div>
          </div>

          {/* ── Producción y rendimiento ── */}
          <div className="mb-4">
            {rotulo("Producción y rendimiento por centro de costo y tarea")}
            <div className="bg-white rounded-3 shadow-sm" style={marco}>
              <Table
                className="mb-0 tabla-informe tabla-produccion"
                style={{ width: "auto", minWidth: "820px" }}
              >
                <thead>
                  <tr>
                    <th style={{ ...th, textAlign: "left", minWidth: "90px" }}>CC</th>
                    <th style={{ ...th, textAlign: "left", minWidth: "160px" }}>Tarea</th>
                    <th style={{ ...th, textAlign: "center" }}>Combustible<br />(lts)</th>
                    <th style={{ ...th, textAlign: "center" }}>
                      Cant. producida
                      <div style={{ fontSize: "0.6rem", fontWeight: 400, opacity: 0.75 }}>de la tarea</div>
                    </th>
                    <th style={{ ...th, textAlign: "center" }}>Unidad</th>
                    <th style={{ ...th, textAlign: "center" }}>
                      Consumo
                      <div style={{ fontSize: "0.6rem", fontWeight: 400, opacity: 0.75 }}>lts / unidad</div>
                    </th>
                    <th style={{ ...th, textAlign: "center" }}>
                      Consumo
                      <div style={{ fontSize: "0.6rem", fontWeight: 400, opacity: 0.75 }}>unidad / lts</div>
                    </th>
                    <th style={{ ...th, textAlign: "center" }}>
                      Rendimiento
                      <div style={{ fontSize: "0.6rem", fontWeight: 400, opacity: 0.75 }}>un / hs turno</div>
                    </th>
                    <th style={{ ...th, textAlign: "center" }}>
                      Admisible
                      <div style={{ fontSize: "0.6rem", fontWeight: 400, opacity: 0.75 }}>un / hs</div>
                    </th>
                    <th style={{ ...th, textAlign: "center" }}>
                      Desvío (%)
                      <div style={{ fontSize: "0.6rem", fontWeight: 400, opacity: 0.75 }}>rendimiento</div>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {cargando || porTarea.length === 0
                    ? sinDatos(10, "No hay partes con centro de costo en este período")
                    : porTarea.map((f) => {
                        const a = contraAdmisible(f);
                        return (
                        <tr key={f.id}>
                          <td style={{ ...td, fontWeight: 600 }}>{f.cc}</td>
                          <td style={td}>{f.tarea}</td>
                          {celdaNumero(f.combustible)}
                          {celdaNumero(f.cantidad)}
                          <td style={{ ...td, textAlign: "center" }}>{f.unidad || "—"}</td>
                          <td style={{ ...td, textAlign: "center", fontWeight: 600 }}>
                            {f.ltsPorUnidad === null ? (
                              <span style={{ color: "#cbd5e1" }}>—</span>
                            ) : (
                              numeroFino(f.ltsPorUnidad)
                            )}
                          </td>
                          {celdaNumero(f.unidadPorLts === null ? null : redondear(f.unidadPorLts), true)}
                          {celdaNumero(f.rendimiento === null ? null : redondear(f.rendimiento), true)}
                          {/* Contra el rendimiento admisible de la tarea */}
                          {celdaNumero(a.rendimientoAdm)}
                          {celdaDesvio(a.desvioRendimiento, false)}
                        </tr>
                        );
                      })}
                </tbody>
              </Table>
            </div>
          </div>
          </>
          )}
        </div>
      </Container>

      {/* Detalle de una persona: los partes que arman su fila */}
      <Modal show={Boolean(verPersona)} onHide={() => setVerPersona(null)} size="xl" scrollable centered>
        <Modal.Header closeButton style={{ backgroundColor: "#1b4332", color: "#fff" }}>
          <Modal.Title style={{ fontSize: "1rem", fontWeight: 700 }}>
            {verPersona?.nombre} — {titulo}
          </Modal.Title>
        </Modal.Header>
        <Modal.Body style={{ backgroundColor: "#f8f9fa" }}>
          <div className="d-flex flex-wrap gap-2 mb-3">
            {[
              ["Días trabajados", verPersona?.dias ?? 0],
              ["Prom. hs/día", numero(verPersona?.promedio ?? 0)],
              ["Total horas", numero(verPersona?.horas ?? 0)],
            ].map(([etiqueta, valor]) => (
              <div
                key={etiqueta}
                className="px-3 py-2 rounded-3 bg-white"
                style={{ border: "1px solid #e2e8f0", minWidth: "130px" }}
              >
                <div style={{ fontSize: "0.7rem", color: "#64748b" }}>{etiqueta}</div>
                <div className="fw-bold" style={{ fontSize: "1.05rem", color: "#1b4332" }}>
                  {valor}
                </div>
              </div>
            ))}
          </div>

          {/* "clip": el que scrollea es el cuerpo de la ventana, y así los
              títulos quedan fijos arriba. */}
          <div className="bg-white rounded-3" style={{ border: "1px solid #e2e8f0", overflow: "clip" }}>
            <Table className="mb-0 tabla-informe tabla-detalle">
              <thead>
                <tr>
                  {[
                    "Fecha",
                    "Ingreso",
                    "Egreso",
                    "Total hs",
                    "Combust.",
                    "CC",
                    "Tarea",
                    "Cantidad",
                    "Un.",
                    "Lote",
                    "Observación",
                  ].map((c) => (
                    <th
                      key={c}
                      style={{ ...th, textAlign: c === "Tarea" || c === "Observación" ? "left" : "center" }}
                    >
                      {c}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {detalle.length === 0 ? (
                  <tr>
                    <td colSpan={11} className="text-center text-muted py-4" style={td}>
                      Sin partes en el período
                    </td>
                  </tr>
                ) : (
                  detalle.map((p) => (
                    <tr key={p._id}>
                      <td style={{ ...td, textAlign: "center", whiteSpace: "nowrap" }}>{formatFecha(p.fecha)}</td>
                      <td style={{ ...td, textAlign: "center" }}>{p.horaIngreso || "—"}</td>
                      <td style={{ ...td, textAlign: "center" }}>{p.horaEgreso || "—"}</td>
                      <td style={{ ...td, textAlign: "center", fontWeight: 600 }}>{numero(p.totalHoras || 0)}</td>
                      <td style={{ ...td, textAlign: "center" }}>
                        {p.combustible === null || p.combustible === undefined ? "—" : numero(p.combustible)}
                      </td>
                      <td style={{ ...td, textAlign: "center" }}>{p.cc?.cc || "—"}</td>
                      <td style={td}>{p.tarea?.tarea || "—"}</td>
                      <td style={{ ...td, textAlign: "center" }}>
                        {p.cantidad === null || p.cantidad === undefined ? "—" : numero(p.cantidad)}
                      </td>
                      <td style={{ ...td, textAlign: "center" }}>{p.tarea?.unidad || "—"}</td>
                      <td style={{ ...td, textAlign: "center" }}>{p.lote || "—"}</td>
                      <td style={td}>{p.observacion || "—"}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </Table>
          </div>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="outline-secondary" size="sm" onClick={() => setVerPersona(null)}>
            Cerrar
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
}

export default ProduccionInformeMes;
