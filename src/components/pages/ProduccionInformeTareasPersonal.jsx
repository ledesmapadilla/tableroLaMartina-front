import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import Swal from "sweetalert2";
import { Button, Card, Container, Form, InputGroup, Modal, Table } from "react-bootstrap";
import { nuevoWorkbook } from "../../helpers/excel";
import SelectBuscador from "../shared/SelectBuscador";

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

// Un dato que falta va como raya gris, nunca un cero: el cero miente.
const raya = <span style={{ color: "#cbd5e1" }}>—</span>;

/**
 * Lo tipeado en un campo de importe, listo para convertir a número.
 *
 * Los campos se muestran con el punto de los miles, que un `type="number"` no
 * admite; por eso son de texto y hay que limpiarlos antes de usarlos. Si hay
 * coma, es el separador decimal y los puntos son de miles ("12.500,75"); si no,
 * solo se sacan los puntos que separan grupos de tres ("12.500"), pero se
 * respeta un decimal escrito con punto ("12.5").
 */
const sinSeparadores = (texto) => {
  const s = String(texto ?? "").trim();
  if (!s) return "";
  return s.includes(",")
    ? s.replace(/\./g, "").replace(",", ".")
    : s.replace(/\.(?=\d{3}(?:\D|$))/g, "");
};

// El mismo texto con el punto de los miles puesto, para mostrarlo.
const conSeparadores = (texto) => {
  const limpio = sinSeparadores(texto);
  if (limpio === "") return "";
  const n = Number(limpio);
  if (!Number.isFinite(n)) return String(texto);
  return nf.format(n);
};

const claveCliente = (c) => (c || "").trim().toLowerCase();

// Un renglón del informe es una persona, una tarea y un cliente: el precio se
// certifica por cliente, así que el mismo trabajo para dos clientes son dos
// renglones con dos precios, no uno promediado.
const claveDeFila = (idPersona, idTarea, cliente) =>
  `${idPersona}|${idTarea}|${claveCliente(cliente)}`;

// Lo que se descuenta del bruto para llegar al neto. Es el mismo valor que usa
// el backend al guardar el precio; acá solo hace falta para las cargas viejas
// que quedaron sin el bruto calculado.
const RETENCION = 0.205;

/**
 * Precio que rige para una tarea y un cliente en una fecha dada, con su neto y
 * su bruto. Los dos salen de la misma carga de Variables: el que se escribe es
 * el neto y el backend guarda el bruto ya calculado con la retención.
 *
 * Los precios se cargan en **Variables** (`/produccion/certificados/variables`)
 * y son una fila por cada vez que el valor cambió: el que corresponde a un
 * parte es el de la vigencia más nueva que no sea posterior a su fecha. Si el
 * parte cae antes de la primera vigencia cargada, no hay precio: eso es una
 * raya, no un cero.
 *
 * El parte trae el cliente como texto libre. Cuando viene vacío y la tarea
 * tiene precios de un solo cliente se usa ese, que es el único que puede ser;
 * con más de uno no se adivina.
 */
const precioVigente = (variables, idTarea, cliente, fecha) => {
  const deLaTarea = variables.filter((v) => (v.tarea?._id || v.tarea) === idTarea);
  if (deLaTarea.length === 0) return null;

  const clave = claveCliente(cliente);
  const clientes = new Set(deLaTarea.map((v) => claveCliente(v.cliente)));
  const delCliente = clave
    ? deLaTarea.filter((v) => claveCliente(v.cliente) === clave)
    : clientes.size === 1
    ? deLaTarea
    : [];

  const dia = soloFecha(fecha);
  const vigentes = delCliente
    .filter((v) => v.vigenciaDesde && soloFecha(v.vigenciaDesde) <= dia)
    .sort((a, b) => soloFecha(b.vigenciaDesde).localeCompare(soloFecha(a.vigenciaDesde)));

  const neto = vigentes[0]?.neto;
  if (!Number.isFinite(neto)) return null;

  // El bruto se guarda con el precio; si una carga vieja no lo tiene, se
  // rehace la misma cuenta que hace el backend.
  const bruto = vigentes[0]?.bruto;
  return {
    neto,
    bruto: Number.isFinite(bruto) ? bruto : redondear(neto / (1 - RETENCION)),
  };
};

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
  const [periodo, setPeriodo] = useState({ desde: "", hasta: "" });
  const [cerrado, setCerrado] = useState(false);
  const [partes, setPartes] = useState([]);
  const [variables, setVariables] = useState([]);
  const [cargando, setCargando] = useState(true);

  // Descuentos cargados a mano, por id de persona: { descAntic, retJudicial }.
  const [descuentos, setDescuentos] = useState({});
  // Celda que se está editando: { idPersona, campo } mientras dura la edición.
  const [editando, setEditando] = useState(null);
  const [valorEditado, setValorEditado] = useState("");

  // Personas apagadas con el ojo: se siguen viendo, tachadas, pero no entran
  // en los totales de abajo. Se guarda junto con los descuentos, por persona y
  // período, así la marca aguanta el refresco.
  const [excluidos, setExcluidos] = useState(() => new Set());

  // Personas plegadas con el "−": se les esconden las filas de tarea y queda
  // solo la de su total. Es una comodidad de la pantalla, no se guarda.
  const [plegados, setPlegados] = useState(() => new Set());

  const alternarPlegado = (idPersona) =>
    setPlegados((actuales) => {
      const nuevos = new Set(actuales);
      if (nuevos.has(idPersona)) nuevos.delete(idPersona);
      else nuevos.add(idPersona);
      return nuevos;
    });

  const conExcluido = (idPersona, excluido) => {
    setExcluidos((actuales) => {
      const nuevos = new Set(actuales);
      if (excluido) nuevos.add(idPersona);
      else nuevos.delete(idPersona);
      return nuevos;
    });
  };

  const alternarExcluido = async (idPersona) => {
    const excluido = !excluidos.has(idPersona);
    conExcluido(idPersona, excluido);
    try {
      const res = await fetch(`/api/descuentos/${anio}/${mes}/${idPersona}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ excluido }),
      });
      if (!res.ok) throw new Error("No se pudo guardar");
    } catch {
      conExcluido(idPersona, !excluido);
      Swal.fire({
        icon: "error",
        title: "No se guardó",
        text: "No se pudo guardar la marca. Probá de nuevo.",
      });
    }
  };

  // Correcciones del período. No tocan los partes: la planilla de carga queda
  // como está y el informe aplica estos valores por encima.
  const [cambios, setCambios] = useState([]);

  // Modal del renglón: `verFila` es la fila que se está corrigiendo, null con
  // el modal cerrado.
  const [verFila, setVerFila] = useState(null);
  const [guardandoFila, setGuardandoFila] = useState(false);
  const [edicion, setEdicion] = useState({ cantidad: "", precioUnitario: "", detalle: "" });

  // Modal del historial: la fila cuyos cambios se están mirando y corrigiendo.
  const [verHistorial, setVerHistorial] = useState(null);
  const [guardandoHistorial, setGuardandoHistorial] = useState(null);

  // Modal de carga: se elige la persona y se cargan sus dos importes.
  const [showCarga, setShowCarga] = useState(false);
  const [guardandoCarga, setGuardandoCarga] = useState(false);
  const [carga, setCarga] = useState({ persona: "", descAntic: "", retJudicial: "" });

  const [filtroFecha, setFiltroFecha] = useState("");
  const [filtroPersona, setFiltroPersona] = useState("Todos");
  const [filtroLegajo, setFiltroLegajo] = useState("Todos");
  const [filtroCC, setFiltroCC] = useState("Todos");
  const [filtroTarea, setFiltroTarea] = useState("Todas");

  const hayFiltro =
    Boolean(filtroFecha) ||
    filtroPersona !== "Todos" ||
    filtroLegajo !== "Todos" ||
    filtroCC !== "Todos" ||
    filtroTarea !== "Todas";

  const titulo = `${MESES[Number(mes) - 1] || ""} ${anio}`;

  useEffect(() => {
    (async () => {
      setCargando(true);
      try {
        // Solo los partes dependen del período: los precios, los descuentos y
        // las correcciones se piden en paralelo con él en vez de esperarlo, que
        // era una ida y vuelta de más contra un cluster que está lejos.
        const [resPeriodo, resVariables, resDescuentos, resCambios] = await Promise.all([
          fetch(`/api/periodos/${anio}/${mes}`),
          // Los precios se traen enteros, no por período: la vigencia que rige
          // un parte puede ser de meses anteriores.
          fetch("/api/variables"),
          fetch(`/api/descuentos/${anio}/${mes}`),
          fetch(`/api/cambios/${anio}/${mes}`),
        ]);

        const data = await resPeriodo.json();
        const estaCerrado = Boolean(data.cerrado);
        // Mientras la certificación está abierta el período llega hasta hoy,
        // igual que en la planilla de carga.
        const rango = {
          desde: soloFecha(data.desde),
          hasta: estaCerrado ? soloFecha(data.hasta) : hoyStr(),
        };
        setCerrado(estaCerrado);
        setPeriodo(rango);

        // `resumen=1`: el informe suma cantidades y filtra, no necesita
        // horarios, horómetros ni combustible. Es la mitad del cuerpo.
        const resPartes = await fetch(
          `/api/partes?desde=${rango.desde}&hasta=${rango.hasta}&resumen=1`
        );
        const lista = resPartes.ok ? await resPartes.json() : [];
        const precios = resVariables.ok ? await resVariables.json() : [];
        const cargados = resDescuentos.ok ? await resDescuentos.json() : [];
        const correcciones = resCambios.ok ? await resCambios.json() : [];
        setPartes(Array.isArray(lista) ? lista : []);
        setVariables(Array.isArray(precios) ? precios : []);
        setCambios(Array.isArray(correcciones) ? correcciones : []);
        const filasDescuento = Array.isArray(cargados) ? cargados : [];
        setDescuentos(
          Object.fromEntries(
            filasDescuento.map((d) => [
              d.persona,
              { descAntic: d.descAntic || 0, retJudicial: d.retJudicial || 0 },
            ])
          )
        );
        setExcluidos(new Set(filasDescuento.filter((d) => d.excluido).map((d) => d.persona)));
      } catch {
        setPartes([]);
        setVariables([]);
        setDescuentos({});
        setExcluidos(new Set());
        setCambios([]);
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
        if (filtroLegajo !== "Todos" && (p.persona?.legajo || "") !== filtroLegajo) return false;
        if (filtroTarea !== "Todas" && (p.tarea?._id || "") !== filtroTarea) return false;
        if (filtroCC !== "Todos" && p.cc?.cc !== filtroCC && (p.turbo || "").trim() !== filtroCC) {
          return false;
        }
        return true;
      }),
    [partes, filtroFecha, filtroPersona, filtroLegajo, filtroCC, filtroTarea]
  );

  // Las opciones salen de todo el período, no de lo ya filtrado: si no, elegir
  // una persona vaciaría el resto de los desplegables.
  const personasDelPeriodo = useMemo(() => {
    const m = new Map();
    partes.forEach((p) => p.persona && m.set(p.persona._id, p.persona.apellidoNombre));
    return [...m.entries()].sort((a, b) => comparar(a[1], b[1]));
  }, [partes]);

  // El legajo de cada persona, para el filtro. La gente sin legajo cargado no
  // entra: no hay número por el que elegirla.
  const legajosDelPeriodo = useMemo(() => {
    const m = new Map();
    partes.forEach((p) => {
      const legajo = (p.persona?.legajo || "").trim();
      if (legajo) m.set(legajo, `${legajo} — ${p.persona.apellidoNombre}`);
    });
    return [...m.entries()].sort((a, b) => compararCC(a[0], b[0]));
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
   * El valor que rige para cada renglón corregido, por `persona|tarea`.
   *
   * Los cambios llegan del más nuevo al más viejo, así que el primero de cada
   * campo es el que manda; los otros son historial y se miran en la planilla.
   */
  const ajustes = useMemo(() => {
    // Por renglón exacto (persona, tarea y cliente) y, aparte, por persona y
    // tarea sin mirar el cliente: el segundo es el que salva la corrección
    // cuando en la planilla le cambian el cliente al parte.
    const porRenglon = new Map();
    const porTarea = new Map();

    for (const c of cambios) {
      const idPersona = c.persona?._id || c.persona;
      const idTarea = c.tarea?._id || c.tarea;

      for (const [mapa, clave] of [
        [porRenglon, claveDeFila(idPersona, idTarea, c.cliente)],
        [porTarea, `${idPersona}|${idTarea}`],
      ]) {
        const actual = mapa.get(clave) || {};
        if (actual[c.campo] === undefined) mapa.set(clave, { ...actual, [c.campo]: c.nuevo });
      }
    }
    return { porRenglon, porTarea };
  }, [cambios]);

  /**
   * Una fila por persona y tarea con la cantidad acumulada del período y su
   * importe.
   *
   * Las cantidades solo se suman dentro de la misma tarea: cada una tiene su
   * unidad (horas, plantas, bins) y mezclarlas no significaría nada. La plata
   * sí, así que el total de cada persona va en la columna de precio total.
   */
  const { filas, totalPorPersona, numeroPorPersona } = useMemo(() => {
    const mapa = new Map();

    for (const p of partesFiltrados) {
      const idPersona = p.persona?._id || "sin-persona";
      const idTarea = p.tarea?._id || "sin-tarea";
      const clave = claveDeFila(idPersona, idTarea, p.cliente);
      if (!mapa.has(clave)) {
        mapa.set(clave, {
          clave,
          idPersona,
          idTarea,
          persona: p.persona?.apellidoNombre || "(sin persona)",
          legajo: p.persona?.legajo || "",
          tarea: p.tarea?.tarea || "(sin tarea)",
          cliente: (p.cliente || "").trim(),
          unidad: p.tarea?.unidad || "",
          cantidad: 0,
          // Lo que sí tiene precio se suma aparte: una tarea puede tener partes
          // de distintos clientes o de antes de la primera vigencia cargada.
          cantidadConPrecio: 0,
          importe: 0,
          importeBruto: 0,
          precios: new Set(),
        });
      }

      const fila = mapa.get(clave);
      const cantidad = Number(p.cantidad) || 0;
      fila.cantidad += cantidad;

      // El precio se busca parte por parte: depende del cliente al que se le
      // certifica y de la vigencia que regía ese día.
      const precio = precioVigente(variables, idTarea, p.cliente, p.fecha);
      if (precio !== null) {
        fila.cantidadConPrecio += cantidad;
        fila.importe += cantidad * precio.neto;
        fila.importeBruto += cantidad * precio.bruto;
        fila.precios.add(precio.neto);
      }
    }

    // Cuántos renglones hay por persona y tarea: define si una corrección
    // huérfana se puede reubicar sin ambigüedad.
    const renglonesPorTarea = new Map();
    for (const f of mapa.values()) {
      const clave = `${f.idPersona}|${f.idTarea}`;
      renglonesPorTarea.set(clave, (renglonesPorTarea.get(clave) || 0) + 1);
    }

    const lista = [...mapa.values()]
      .map((f) => {
        const conPrecio = redondear(f.cantidadConPrecio);
        // Sin precio cargado en Variables no hay importe que mostrar: va una
        // raya, no un cero que parezca trabajo sin costo.
        const hayPrecio = f.precios.size > 0;
        // Con un solo precio se muestra ese; si en el período hubo más de uno
        // (cambio de vigencia o dos clientes) se muestra el promedio de lo que
        // realmente se certificó, que es lo que cierra con el importe.
        const dePartes = !hayPrecio
          ? null
          : f.precios.size === 1
          ? [...f.precios][0]
          : conPrecio
          ? redondear(f.importe / conPrecio)
          : null;

        // Lo corregido a mano manda sobre lo que sale de los partes. Los
        // partes no se tocan: el ajuste vive aparte y se aplica acá.
        /**
         * La corrección de este renglón.
         *
         * Primero la del renglón exacto. Si no hay, se usa la de la misma
         * persona y tarea aunque sea de otro cliente, pero solo cuando ese par
         * tiene un único renglón: es el caso de haberle cambiado el cliente al
         * parte en la planilla, y la corrección no se tiene que perder. Con
         * dos clientes en juego no se reubica, porque no se sabe a cuál iba y
         * aplicarla a los dos duplicaría el importe.
         */
        const clavePorTarea = `${f.idPersona}|${f.idTarea}`;
        const ajuste =
          ajustes.porRenglon.get(claveDeFila(f.idPersona, f.idTarea, f.cliente)) ||
          (renglonesPorTarea.get(clavePorTarea) === 1
            ? ajustes.porTarea.get(clavePorTarea)
            : null) ||
          {};
        const cantidad =
          ajuste.cantidad !== undefined ? redondear(ajuste.cantidad) : redondear(f.cantidad);
        const precio = ajuste.precioUnitario !== undefined ? ajuste.precioUnitario : dePartes;
        const corregida = ajuste.cantidad !== undefined || ajuste.precioUnitario !== undefined;

        // Con algo corregido el importe se rehace de cero: la suma parte por
        // parte ya no aplica, porque el número de arriba lo puso una persona.
        const importe = corregida
          ? precio === null
            ? null
            : redondear(cantidad * precio)
          : hayPrecio
          ? redondear(f.importe)
          : null;

        return {
          ...f,
          cantidad,
          precio,
          corregida,
          cantidadCorregida: ajuste.cantidad !== undefined,
          precioCorregido: ajuste.precioUnitario !== undefined,
          variosPrecios: !corregida && f.precios.size > 1,
          // Queda marcado cuando parte de la cantidad se quedó sin precio: el
          // importe de esa fila es parcial. Corregida a mano no aplica.
          sinPrecio: corregida ? 0 : redondear(f.cantidad - conPrecio),
          importe,
          importeBruto:
            importe === null
              ? null
              : corregida
              ? redondear(importe / (1 - RETENCION))
              : redondear(f.importeBruto),
        };
      })
      .sort(
        (a, b) =>
          comparar(a.persona, b.persona) ||
          comparar(a.tarea, b.tarea) ||
          comparar(a.cliente, b.cliente)
      );

    // El total de una persona suma solo las tareas con precio cargado; si no
    // tiene ninguno, no hay total que mostrar.
    // Solo se acumula el neto: el bruto del total no se suma, se calcula
    // después a partir de ese neto ya descontado.
    const totales = new Map();
    // La numeración de la columna # cuenta personas, no filas: acompaña al
    // nombre, que también va una sola vez por bloque.
    const numeros = new Map();
    for (const f of lista) {
      if (!numeros.has(f.idPersona)) numeros.set(f.idPersona, numeros.size + 1);
      if (f.importe === null) continue;
      totales.set(f.idPersona, redondear((totales.get(f.idPersona) || 0) + f.importe));
    }

    return { filas: lista, totalPorPersona: totales, numeroPorPersona: numeros };
  }, [partesFiltrados, variables, ajustes]);

  // ── descuentos por persona ────────────────────────────────────────
  const SIN_DESCUENTO = { descAntic: 0, retJudicial: 0 };
  const descuentoDe = (idPersona) => descuentos[idPersona] || SIN_DESCUENTO;

  /**
   * Totales de una persona.
   *
   * Al neto certificado se le restan el anticipo y la retención: eso es lo que
   * efectivamente se le paga. El bruto NO es la suma de los brutos de cada
   * tarea, sino ese mismo neto llevado a bruto con la retención, que es la
   * cuenta que se usa para pagar.
   */
  const totalesDe = (idPersona) => {
    const certificado = totalPorPersona.get(idPersona);
    if (certificado === undefined) return { neto: undefined, bruto: undefined };
    const { descAntic, retJudicial } = descuentoDe(idPersona);
    const neto = redondear(certificado - (descAntic || 0) - (retJudicial || 0));
    return { neto, bruto: redondear(neto / (1 - RETENCION)) };
  };

  // Escape cierra la edición sin guardar, pero el blur del input llega
  // después: esta bandera le avisa que no toque nada.
  const cancelado = useRef(false);

  const abrirEdicion = (idPersona, campo) => {
    cancelado.current = false;
    setEditando({ idPersona, campo });
    setValorEditado(String(descuentoDe(idPersona)[campo] || ""));
  };

  const cerrarEdicion = () => {
    setEditando(null);
    setValorEditado("");
  };

  // Un texto de formulario a número: vacío es cero, y lo que no sea un número
  // mayor o igual a cero no se guarda.
  const aImporte = (texto) => {
    // Limpia el punto de los miles antes de convertir: los campos de importe
    // se muestran formateados y llegan como "12.500,75".
    const limpio = sinSeparadores(texto);
    const valor = limpio === "" ? 0 : Number(limpio);
    return Number.isFinite(valor) && valor >= 0 ? redondear(valor) : null;
  };

  /**
   * Guarda los dos importes de una persona. Lo usan la edición de la celda y
   * el modal de carga: los dos terminan pisando la misma fila del período.
   */
  const guardarDescuentos = async (idPersona, nuevo) => {
    const anterior = descuentoDe(idPersona);
    if (nuevo.descAntic === anterior.descAntic && nuevo.retJudicial === anterior.retJudicial) {
      return true;
    }

    // Se pinta enseguida y se revierte si el guardado falla: así el número no
    // parpadea en cada tecleo.
    setDescuentos((d) => ({ ...d, [idPersona]: nuevo }));
    try {
      const res = await fetch(`/api/descuentos/${anio}/${mes}/${idPersona}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(nuevo),
      });
      if (!res.ok) throw new Error("No se pudo guardar");
      return true;
    } catch {
      setDescuentos((d) => ({ ...d, [idPersona]: anterior }));
      Swal.fire({
        icon: "error",
        title: "No se guardó",
        text: "No se pudo guardar el importe. Probá de nuevo.",
      });
      return false;
    }
  };

  const guardarDescuento = async (idPersona, campo, texto) => {
    const anterior = descuentoDe(idPersona);
    cerrarEdicion();

    const valor = aImporte(texto);
    if (valor === null) {
      Swal.fire({
        icon: "warning",
        title: "Importe inválido",
        text: "Tiene que ser un número mayor o igual a cero.",
      });
      return;
    }

    await guardarDescuentos(idPersona, { ...anterior, [campo]: valor });
  };

  /**
   * Celda de un descuento. Sin importe cargado va una raya; con importe, el
   * número se edita ahí mismo al hacer clic. Cargarlo por primera vez es el
   * botón de arriba, que además deja elegir a quién.
   */
  const celdaDescuento = (idPersona, campo) => {
    const valor = descuentoDe(idPersona)[campo];
    const enEdicion = editando?.idPersona === idPersona && editando?.campo === campo;

    if (enEdicion) {
      return (
        <input
          type="number"
          step="any"
          min="0"
          autoFocus
          className="form-control form-control-sm text-center"
          style={{ fontSize: "0.62rem", height: "22px", padding: "0 2px" }}
          value={valorEditado}
          onChange={(e) => setValorEditado(e.target.value)}
          onBlur={() => {
            if (cancelado.current) return cerrarEdicion();
            guardarDescuento(idPersona, campo, valorEditado);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              e.currentTarget.blur();
            }
            if (e.key === "Escape") {
              e.preventDefault();
              cancelado.current = true;
              e.currentTarget.blur();
            }
          }}
        />
      );
    }

    if (!valor) return raya;

    return (
      <button
        onClick={() => abrirEdicion(idPersona, campo)}
        className="btn btn-link p-0 text-decoration-none"
        // Más chico que el resto: la columna es angosta y el importe entero
        // tiene que entrar en un renglón.
        style={{ fontSize: "0.62rem", color: "#b45309", fontWeight: 600 }}
        title="Editar el importe"
      >
        {pesos(valor)}
      </button>
    );
  };

  /**
   * Totales de toda la tabla, con lo que hay a la vista.
   *
   * Las personas apagadas con el ojo no suman. El bruto sigue la misma regla
   * que el de cada persona: no se suman los brutos, se lleva a bruto el neto
   * ya descontado.
   */
  // Plegar y desplegar toda la tabla de una. Se considera plegada cuando no
  // queda ninguna persona con el detalle a la vista.
  const todasPlegadas =
    filas.length > 0 && filas.every((f) => plegados.has(f.idPersona));

  const alternarTodas = () =>
    setPlegados(todasPlegadas ? new Set() : new Set(filas.map((f) => f.idPersona)));

  const totalGeneral = useMemo(() => {
    const personas = new Set(
      filas.map((f) => f.idPersona).filter((id) => !excluidos.has(id))
    );

    let descAntic = 0;
    let retJudicial = 0;
    let neto = 0;
    for (const id of personas) {
      const d = descuentoDe(id);
      descAntic += d.descAntic || 0;
      retJudicial += d.retJudicial || 0;
      neto += totalesDe(id).neto ?? 0;
    }

    return {
      personas: personas.size,
      descAntic: redondear(descAntic),
      retJudicial: redondear(retJudicial),
      neto: redondear(neto),
      bruto: redondear(neto / (1 - RETENCION)),
    };
    // descuentoDe y totalesDe se rehacen en cada render, pero solo dependen de
    // estos tres: alcanza con mirarlos a ellos.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filas, excluidos, descuentos, totalPorPersona]);

  // ── corrección de un renglón ──────────────────────────────────────
  // Los cambios de un renglón, del más nuevo al más viejo (así llegan).
  // Misma regla que usa el cálculo: los del renglón exacto y, si no hay
  // ninguno, los de la misma persona y tarea cuando ese par tiene un solo
  // renglón. Así el historial muestra lo mismo que se está aplicando.
  const cambiosDeLaFila = (fila) => {
    const delRenglon = cambios.filter(
      (c) =>
        claveDeFila(c.persona?._id || c.persona, c.tarea?._id || c.tarea, c.cliente) ===
        claveDeFila(fila.idPersona, fila.idTarea, fila.cliente)
    );
    if (delRenglon.length) return delRenglon;

    const hayUnoSolo =
      filas.filter((f) => f.idPersona === fila.idPersona && f.idTarea === fila.idTarea).length === 1;
    if (!hayUnoSolo) return [];

    return cambios.filter(
      (c) =>
        (c.persona?._id || c.persona) === fila.idPersona &&
        (c.tarea?._id || c.tarea) === fila.idTarea
    );
  };

  const verHistorialFila = (fila) => {
    if (cambiosDeLaFila(fila).length === 0) {
      Swal.fire({
        icon: "info",
        title: "Sin correcciones",
        text: "Este renglón no tiene correcciones: la cantidad y el precio salen de los partes cargados en la planilla.",
      });
      return;
    }
    setVerHistorial(fila);
  };

  /**
   * Corrige un registro del historial.
   *
   * Se puede arreglar el valor y el motivo; el campo, el valor anterior y la
   * fecha son lo que pasó y no se reescriben. Si el registro corregido es el
   * que rige, el informe se rehace solo.
   */
  const guardarCambioDelHistorial = async (cambio, campo, texto) => {
    const valor = campo === "nuevo" ? aImporte(texto) : (texto || "").trim();

    if (campo === "nuevo" && valor === null) {
      Swal.fire({
        icon: "warning",
        title: "Valor inválido",
        text: "Tiene que ser un número mayor o igual a cero.",
      });
      return;
    }
    if (campo === "detalle" && !valor) {
      Swal.fire({
        icon: "warning",
        title: "Falta el detalle",
        text: "El motivo no puede quedar vacío.",
      });
      return;
    }
    if (valor === cambio[campo]) return;

    setGuardandoHistorial(cambio._id);
    try {
      const res = await fetch(`/api/cambios/${cambio._id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [campo]: valor }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "No se pudo guardar");
      }
      const guardado = await res.json();
      setCambios((actuales) => actuales.map((c) => (c._id === guardado._id ? guardado : c)));
      Swal.fire({
        icon: "success",
        title: "Corrección actualizada",
        timer: 1200,
        showConfirmButton: false,
      });
    } catch (e) {
      Swal.fire({ icon: "error", title: "No se guardó", text: e.message });
    } finally {
      setGuardandoHistorial(null);
    }
  };

  const abrirEdicionFila = (fila) => {
    // Ya formateados: el campo arranca sin foco, así que se muestra como se
    // lee, con el punto de los miles.
    setEdicion({
      cantidad: fila.cantidad === null ? "" : conSeparadores(fila.cantidad),
      precioUnitario: fila.precio === null ? "" : conSeparadores(fila.precio),
      detalle: "",
    });
    setVerFila(fila);
  };

  /**
   * Guarda la corrección de un renglón.
   *
   * No toca los partes: se registra un cambio aparte, con su motivo, y el
   * informe lo aplica por encima de lo que sale de la planilla. Se guarda un
   * registro por campo cambiado, así el historial queda parejo.
   */
  const guardarEdicionFila = async () => {
    const fila = verFila;
    if (!fila) return;

    const cantidad = aImporte(edicion.cantidad);
    const precio = aImporte(edicion.precioUnitario);
    if (cantidad === null || precio === null) {
      Swal.fire({
        icon: "warning",
        title: "Valor inválido",
        text: "La cantidad y el precio tienen que ser números mayores o iguales a cero.",
      });
      return;
    }

    if (!edicion.detalle) {
      Swal.fire({
        icon: "warning",
        title: "Falta el detalle",
        text: "Elegí el detalle del cambio: sin motivo la corrección no se puede justificar después.",
      });
      return;
    }

    // Solo se registra lo que efectivamente cambió.
    const aGuardar = [];
    if (cantidad !== fila.cantidad) {
      aGuardar.push({ campo: "cantidad", anterior: fila.cantidad, nuevo: cantidad });
    }
    if (precio !== fila.precio) {
      aGuardar.push({ campo: "precioUnitario", anterior: fila.precio, nuevo: precio });
    }

    if (aGuardar.length === 0) {
      Swal.fire({ icon: "info", title: "Sin cambios", text: "No cambiaste ningún valor." });
      return;
    }

    const confirma = await Swal.fire({
      icon: "question",
      title: "¿Guardar la corrección?",
      html: `
        <div style="text-align:left;font-size:0.86rem;line-height:1.6">
          <b>${fila.persona}</b> — ${fila.tarea}
          <div style="margin-top:.5rem">
            ${aGuardar
              .map(
                (c) =>
                  `${c.campo === "cantidad" ? "Cantidad" : "Precio unitario"}: ` +
                  `<b>${c.campo === "cantidad" ? numero(c.anterior) : pesos(c.anterior || 0)}</b> → ` +
                  `<b>${c.campo === "cantidad" ? numero(c.nuevo) : pesos(c.nuevo)}</b>`
              )
              .join("<br>")}
          </div>
          <div style="color:#64748b;margin-top:.6rem">
            Motivo: ${edicion.detalle}.<br>
            La planilla de carga no se modifica: los partes quedan como están.
          </div>
        </div>`,
      showCancelButton: true,
      confirmButtonColor: "#1b4332",
      cancelButtonColor: "#64748b",
      confirmButtonText: "Sí, guardar",
      cancelButtonText: "Cancelar",
    });
    if (!confirma.isConfirmed) return;

    setGuardandoFila(true);
    try {
      const guardados = [];
      for (const c of aGuardar) {
        const res = await fetch("/api/cambios", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            persona: fila.idPersona,
            cliente: fila.cliente,
            tarea: fila.idTarea,
            anio: Number(anio),
            mes: Number(mes),
            detalle: edicion.detalle,
            ...c,
          }),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error || "No se pudo guardar la corrección");
        }
        guardados.push(await res.json());
      }

      // Los nuevos van adelante: la lista está ordenada del más nuevo al más
      // viejo y de ahí sale el valor que rige.
      setCambios((actuales) => [...guardados, ...actuales]);
      setVerFila(null);
      Swal.fire({
        icon: "success",
        title: "Corrección guardada",
        timer: 1500,
        showConfirmButton: false,
      });
    } catch (e) {
      Swal.fire({ icon: "error", title: "No se guardó", text: e.message });
    } finally {
      setGuardandoFila(false);
    }
  };

  // ── modal de carga ────────────────────────────────────────────────
  // Al elegir la persona se traen los importes que ya tenga, así el mismo
  // modal sirve para cargar y para corregir.
  const elegirPersonaCarga = (idPersona) => {
    const actual = descuentoDe(idPersona);
    setCarga({
      persona: idPersona,
      descAntic: actual.descAntic ? String(actual.descAntic) : "",
      retJudicial: actual.retJudicial ? String(actual.retJudicial) : "",
    });
  };

  // Sin persona se abre en blanco, desde el botón de arriba; con persona llega
  // desde el lápiz de su fila, ya cargada y lista para corregir.
  const abrirCarga = (idPersona = "") => {
    if (idPersona) elegirPersonaCarga(idPersona);
    else setCarga({ persona: "", descAntic: "", retJudicial: "" });
    setShowCarga(true);
  };

  const guardarCarga = async () => {
    if (!carga.persona) {
      Swal.fire({ icon: "warning", title: "Falta la persona", text: "Elegí a quién cargarle el importe." });
      return;
    }
    const descAntic = aImporte(carga.descAntic);
    const retJudicial = aImporte(carga.retJudicial);
    if (descAntic === null || retJudicial === null) {
      Swal.fire({
        icon: "warning",
        title: "Importe inválido",
        text: "Los dos tienen que ser números mayores o iguales a cero.",
      });
      return;
    }

    setGuardandoCarga(true);
    const ok = await guardarDescuentos(carga.persona, { descAntic, retJudicial });
    setGuardandoCarga(false);
    if (ok) setShowCarga(false);
  };

  const exportarExcel = async () => {
    const wb = await nuevoWorkbook();
    const ws = wb.addWorksheet("Tareas por personal");
    const columnas = [
      "#", "Legajo", "Personal", "Tarea", "Cliente", "Unidad", "Cantidad", "$ unitario",
      "Desc/Antic.", "Ret. Judicial", "$ total neto", "$ total bruto",
    ];
    // La línea fuerte va antes del neto; el rótulo del total, en cambio, corta
    // en el $ unitario, antes de las dos columnas de descuento. Igual que en
    // pantalla.
    const COL_NETO = columnas.length - 1;
    const COL_BRUTO = columnas.length;
    // Desde el $ unitario en adelante todo es plata.
    const PRIMERA_PLATA = 8;
    const COL_DESC = 9;

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
      // El número, el legajo y el nombre van una sola vez por persona, igual
      // que en pantalla.
      const primeraDePersona = idx === 0 || filas[idx - 1].idPersona !== f.idPersona;
      const fila = ws.addRow([
        primeraDePersona ? numeroPorPersona.get(f.idPersona) : null,
        primeraDePersona ? f.legajo || "—" : null,
        primeraDePersona ? f.persona : null,
        f.tarea,
        f.cliente || "—",
        f.unidad || "—",
        f.cantidad || null,
        f.precio,
        // Los descuentos son de la persona: van en su fila de total.
        null,
        null,
        f.importe,
        f.importeBruto,
      ]);
      fila.eachCell({ includeEmpty: true }, (cell, colNumber) => {
        cell.border = {
          top: { style: "thin", color: { argb: "FFE2E8F0" } },
          left:
            colNumber === COL_NETO
              ? { style: "medium", color: { argb: "FF1B4332" } }
              : { style: "thin", color: { argb: "FFE2E8F0" } },
          bottom: { style: "thin", color: { argb: "FFE2E8F0" } },
          right: { style: "thin", color: { argb: "FFE2E8F0" } },
        };
        // El nombre, la tarea y el cliente van a la izquierda; el resto centrado.
        cell.alignment =
          colNumber >= 3 && colNumber <= 5
            ? { horizontal: "left", vertical: "middle" }
            : { horizontal: "center", vertical: "middle" };
        if (colNumber >= PRIMERA_PLATA) cell.numFmt = '"$"#,##0.00';
        // Apagada con el ojo: se exporta tachada, igual que se ve, y no entra
        // en el total general.
        if (excluidos.has(f.idPersona)) {
          cell.font = { strike: true, color: { argb: "FF94A3B8" } };
        }
      });

      // Igual que en pantalla: cada persona cierra con su total y una línea
      // gruesa.
      if (ultimaDePersona) {
        const { neto, bruto } = totalesDe(f.idPersona);
        const suyos = descuentoDe(f.idPersona);
        const celdas = new Array(COL_BRUTO).fill(null);
        celdas[0] = `Total ${f.persona}`;
        celdas[COL_DESC - 1] = suyos.descAntic || null;
        celdas[COL_DESC] = suyos.retJudicial || null;
        celdas[COL_NETO - 1] = neto ?? null;
        celdas[COL_BRUTO - 1] = bruto ?? null;
        const filaTotal = ws.addRow(celdas);
        filaTotal.eachCell({ includeEmpty: true }, (cell, colNumber) => {
          // Sin relleno, igual que en pantalla: la negrita y las líneas
          // alcanzan para distinguirla.
          cell.font = excluidos.has(f.idPersona)
            ? { bold: true, strike: true, color: { argb: "FF94A3B8" } }
            : { bold: true };
          cell.border = {
            top: { style: "thin", color: { argb: "FF1B4332" } },
            bottom: { style: "medium", color: { argb: "FF1B4332" } },
            left:
              colNumber === COL_NETO
                ? { style: "medium", color: { argb: "FF1B4332" } }
                : undefined,
          };
          cell.alignment = { horizontal: colNumber === 1 ? "right" : "center", vertical: "middle" };
          if (colNumber >= COL_DESC) cell.numFmt = '"$"#,##0.00';
        });
        // Igual que en pantalla: el rótulo llega hasta el $ unitario.
        ws.mergeCells(filaTotal.number, 1, filaTotal.number, COL_DESC - 1);
      }
    });

    // Cierre: el total general, sin las personas apagadas con el ojo.
    if (filas.length > 0) {
      const celdas = new Array(COL_BRUTO).fill(null);
      celdas[0] =
        `TOTAL GENERAL (${totalGeneral.personas} ` +
        `${totalGeneral.personas === 1 ? "persona" : "personas"}` +
        (excluidos.size > 0 ? `, ${excluidos.size} sin contar` : "") +
        ")";
      celdas[COL_DESC - 1] = totalGeneral.descAntic || null;
      celdas[COL_DESC] = totalGeneral.retJudicial || null;
      celdas[COL_NETO - 1] = totalGeneral.neto;
      celdas[COL_BRUTO - 1] = totalGeneral.bruto;

      const filaGeneral = ws.addRow(celdas);
      filaGeneral.height = 22;
      filaGeneral.eachCell({ includeEmpty: true }, (cell, colNumber) => {
        // Dada vuelta, igual que en pantalla: fondo oscuro y letra clara.
        cell.font = { bold: true, size: 11, color: { argb: "FFFFFFFF" } };
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1B4332" } };
        cell.border = {
          top: { style: "thick", color: { argb: "FF1B4332" } },
          bottom: { style: "medium", color: { argb: "FF1B4332" } },
          left:
            colNumber === COL_NETO ? { style: "medium", color: { argb: "FFA7D8BF" } } : undefined,
        };
        cell.alignment = { horizontal: colNumber === 1 ? "right" : "center", vertical: "middle" };
        if (colNumber >= COL_DESC) cell.numFmt = '"$"#,##0.00';
      });
      ws.mergeCells(filaGeneral.number, 1, filaGeneral.number, COL_DESC - 1);
    }

    ws.columns = [
      { width: 6 },
      { width: 8 },
      { width: 30 },
      { width: 34 },
      { width: 16 },
      { width: 12 },
      { width: 14 },
      { width: 16 },
      { width: 15 },
      { width: 15 },
      { width: 16 },
      { width: 16 },
    ];

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

        {/* Filtros. La tarjeta toma el ancho de su contenido y se centra en la
            página, igual que la tabla. */}
        <Card
          className="mb-3 p-2 shadow-sm border-0 rounded-3"
          style={{ alignSelf: "center", maxWidth: "100%" }}
        >
          <div className="d-flex align-items-center justify-content-center gap-3 flex-wrap">
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
              etiqueta="Legajo"
              ancho="185px"
              valor={filtroLegajo}
              vacio="Todos"
              onChange={setFiltroLegajo}
              opciones={legajosDelPeriodo}
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

        {/* La última fila de cada persona cierra con una línea gruesa, para
            que los bloques se separen de un vistazo. */}
        <style>{`
          .tabla-tareas-personal tr.fin-persona > td {
            border-bottom: 2px solid #1b4332 !important;
          }
          /* La fila del total va sin fondo: se distingue por la negrita y las
             líneas, no por el sombreado (le gana también a la cebra). */
          .tabla-tareas-personal tr.total-persona > td {
            background-color: transparent !important;
            border-top: 1px solid #1b4332 !important;
          }
          /* Las dos columnas de total se separan del resto con una línea
             fuerte, que va antes del neto. Se cuenta desde el final para que
             también valga en la fila del total, donde el rótulo se lleva las
             primeras columnas en un colSpan. */
          .tabla-tareas-personal th:nth-last-child(3),
          .tabla-tareas-personal td:nth-last-child(3) {
            border-left: 2px solid #1b4332 !important;
          }
          /* Persona sacada de la cuenta: se tacha todo su bloque y se apaga,
             pero se sigue viendo. El ojo queda legible para poder volver. */
          .tabla-tareas-personal tr.persona-excluida > td {
            text-decoration: line-through;
            color: #94a3b8 !important;
          }
          /* El importe de un descuento es un botón, y Bootstrap le saca el
             subrayado: hay que tacharlo aparte. */
          .tabla-tareas-personal tr.persona-excluida .btn-link {
            text-decoration: line-through !important;
            color: #94a3b8 !important;
          }
          /* Los controles (el ojo, el lápiz) se quedan sin tachar: hay que
             poder verlos para volver atrás. */
          .tabla-tareas-personal tr.persona-excluida .sin-tachar {
            text-decoration: none !important;
          }
          /* La columna del ojo se separa del resto con una línea apenas más
             marcada que la de las celdas. Va por clase y no por posición
             porque en las filas de total la primera celda es un colSpan. */
          .tabla-tareas-personal th.col-ojo,
          .tabla-tareas-personal td.col-ojo {
            border-right: 2px solid #94a3b8 !important;
          }
          /* Cierre de la tabla: el total general se da vuelta contra el resto
             —fondo oscuro y letra clara— para que se lea como el cierre y no
             se confunda con el total de cada persona. */
          .tabla-tareas-personal tr.total-general > td {
            background-color: #1b4332 !important;
            color: #fff !important;
            border-top: 3px solid #1b4332 !important;
            height: 34px;
            font-size: 0.78rem;
          }
          /* Sobre el fondo oscuro, la línea de los totales tiene que ser clara
             para seguir viéndose. */
          .tabla-tareas-personal tr.total-general > td:nth-last-child(3) {
            border-left: 2px solid #a7d8bf !important;
          }
        `}</style>

        {/* La tabla se lleva el alto que sobra y hace su propio scroll con el
            encabezado fijo, pero solo el ancho de sus columnas: `alignSelf`
            evita que el marco se estire hasta el borde de la pantalla y la
            deja centrada en la página. */}
        <div
          className="d-flex flex-column"
          style={{ flex: "1 1 auto", minHeight: 0, alignSelf: "center", maxWidth: "100%" }}
        >
          {/* El botón va sobre las columnas de descuento: se apoya en el borde
              derecho de la tabla y se corre el ancho de las dos columnas de
              total, que son las que quedan a su derecha. */}
          <div className="d-flex align-items-center mb-1" style={{ paddingRight: "220px" }}>
            {/* Pliega y despliega toda la tabla de una: el mismo botón que
                tiene cada persona, pero para todas. */}
            <Button
              size="sm"
              variant="outline-secondary"
              onClick={alternarTodas}
              disabled={filas.length === 0}
              className="rounded-3 px-2 d-flex align-items-center gap-1 me-auto"
              style={{ fontSize: "0.78rem", height: "28px", fontWeight: 600 }}
              title={
                todasPlegadas
                  ? "Ver el detalle de todas las personas"
                  : "Dejar solo los totales de cada persona"
              }
            >
              <i className={`bi bi-${todasPlegadas ? "plus" : "dash"}-lg`}></i>
              <span>{todasPlegadas ? "Ver detalle" : "Solo totales"}</span>
            </Button>

            <Button
              size="sm"
              onClick={() => abrirCarga()}
              disabled={personasDelPeriodo.length === 0}
              className="rounded-3 px-3 d-flex align-items-center gap-2"
              style={{
                backgroundColor: "#0e7490",
                borderColor: "#0e7490",
                fontSize: "0.78rem",
                height: "28px",
                fontWeight: 600,
              }}
              title="Cargar Desc/Antic. o Ret. Judicial de una persona"
            >
              <i className="bi bi-plus-lg"></i>
              <span>Descuentos</span>
            </Button>
          </div>

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
          <Table
            className="mb-0 tabla-informe tabla-tareas-personal"
            style={{ width: "auto", minWidth: "1345px" }}
          >
            <thead style={{ position: "sticky", top: 0, zIndex: 10, backgroundColor: "#1b4332", color: "#fff" }}>
              <tr>
                <th
                  className="col-ojo"
                  style={{ ...th, textAlign: "center", minWidth: "48px" }}
                  title="Apagar a una persona la saca de los totales de abajo"
                >
                  <i className="bi bi-eye"></i>
                </th>
                <th style={{ ...th, textAlign: "center", minWidth: "36px" }}>#</th>
                <th style={{ ...th, textAlign: "center", minWidth: "48px" }}>Legajo</th>
                <th style={{ ...th, textAlign: "left", minWidth: "190px" }}>Personal</th>
                <th style={{ ...th, textAlign: "left", minWidth: "220px" }}>Tarea</th>
                <th style={{ ...th, textAlign: "left", minWidth: "110px" }}>Cliente</th>
                <th style={{ ...th, textAlign: "center", minWidth: "80px" }}>Unidad</th>
                <th style={{ ...th, textAlign: "center", minWidth: "90px" }}>Cantidad</th>
                <th style={{ ...th, textAlign: "center", minWidth: "110px" }}>$ unitario</th>
                {/* Los dos rótulos son largos y las columnas casi siempre van
                    vacías: se parten en dos renglones y van más chicas, para
                    no robarle ancho a lo que sí se lee. */}
                <th
                  style={{
                    ...th,
                    textAlign: "center",
                    minWidth: "62px",
                    whiteSpace: "normal",
                    fontSize: "0.6rem",
                  }}
                >
                  Desc/Antic.
                </th>
                <th
                  style={{
                    ...th,
                    textAlign: "center",
                    minWidth: "62px",
                    whiteSpace: "normal",
                    fontSize: "0.6rem",
                  }}
                >
                  Ret. Judicial
                </th>
                <th style={{ ...th, textAlign: "center", minWidth: "110px" }}>$ total neto</th>
                <th style={{ ...th, textAlign: "center", minWidth: "110px" }}>$ total bruto</th>
                <th style={{ ...th, textAlign: "center", minWidth: "66px" }}></th>
              </tr>
            </thead>
            <tbody>
              {cargando || filas.length === 0 ? (
                <tr>
                  <td colSpan={14} className="text-center text-muted py-4" style={td}>
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
                  const { neto: total, bruto: totalBruto } = totalesDe(f.idPersona);
                  const excluida = excluidos.has(f.idPersona);
                  const plegada = plegados.has(f.idPersona);
                  return (
                    <Fragment key={f.clave}>
                      {/* Plegada, las filas de tarea se esconden y queda solo
                          la del total. */}
                      <tr
                        className={excluida ? "persona-excluida" : undefined}
                        hidden={plegada}
                      >
                        {/* El ojo apaga a la persona: se sigue viendo, tachada,
                            pero deja de sumar abajo. */}
                        <td style={{ ...td, textAlign: "center" }} className="sin-tachar col-ojo">
                          {primeraDePersona && (
                            <button
                              onClick={() => alternarExcluido(f.idPersona)}
                              className="btn btn-sm p-0 border-0 bg-transparent"
                              style={{ lineHeight: 1, color: excluida ? "#dc2626" : "#64748b" }}
                              title={
                                excluida
                                  ? `Volver a contar a ${f.persona} en los totales`
                                  : `Sacar a ${f.persona} de los totales`
                              }
                            >
                              <i
                                className={`bi bi-eye${excluida ? "-slash" : ""}-fill`}
                                style={{ fontSize: "0.8rem" }}
                              ></i>
                            </button>
                          )}
                        </td>

                        {/* El número, el legajo y el nombre van una sola vez
                            por persona: el bloque se lee como una ficha. */}
                        <td style={{ ...td, textAlign: "center", color: "#94a3b8" }}>
                          {primeraDePersona ? numeroPorPersona.get(f.idPersona) : ""}
                        </td>
                        <td style={{ ...td, textAlign: "center", color: "#64748b" }}>
                          {primeraDePersona ? f.legajo || raya : ""}
                        </td>
                        <td style={{ ...td, fontWeight: 500 }}>{primeraDePersona ? f.persona : ""}</td>
                        <td style={td}>{f.tarea}</td>
                        {/* El precio se certifica por cliente: sin él la fila
                            no se puede valorizar, así que se marca en rojo. */}
                        <td style={{ ...td, color: f.cliente ? "#64748b" : "#dc2626" }}>
                          {f.cliente || "Sin cliente"}
                        </td>
                        <td style={{ ...td, textAlign: "center", color: "#64748b" }}>{f.unidad || raya}</td>
                        {/* Un valor corregido a mano se marca: el número ya no
                            sale de los partes. */}
                        <td
                          style={{ ...td, textAlign: "center", fontWeight: 600 }}
                          title={f.cantidadCorregida ? "Corregida a mano en el informe" : undefined}
                        >
                          {f.cantidad ? numero(f.cantidad) : raya}
                          {f.cantidadCorregida && (
                            <i
                              className="bi bi-pencil-fill ms-1"
                              style={{ color: "#b45309", fontSize: "0.55rem" }}
                            ></i>
                          )}
                        </td>
                        <td
                          style={{ ...td, textAlign: "center", color: "#64748b" }}
                          title={
                            f.precioCorregido
                              ? "Corregido a mano en el informe"
                              : f.variosPrecios
                              ? "Promedio: en el período rigió más de un precio para esta tarea"
                              : undefined
                          }
                        >
                          {f.precio === null ? raya : pesos(f.precio)}
                          {f.variosPrecios && <span style={{ color: "#b45309" }}> *</span>}
                          {f.precioCorregido && (
                            <i
                              className="bi bi-pencil-fill ms-1"
                              style={{ color: "#b45309", fontSize: "0.55rem" }}
                            ></i>
                          )}
                        </td>
                        {/* Los descuentos son de la persona, no de la tarea:
                            van abajo, en la fila que cierra su bloque. */}
                        <td style={td}></td>
                        <td style={td}></td>

                        {/* Neto y bruto, con el mismo formato: en gris y sin
                            negrita, porque en estas dos columnas el número que
                            se destaca es el total de cada persona. */}
                        {[f.importe, f.importeBruto].map((importe, i) => (
                          <td
                            key={i}
                            style={{ ...td, textAlign: "center", color: "#64748b" }}
                            title={
                              f.sinPrecio
                                ? `Parcial: ${numero(f.sinPrecio)} sin precio cargado en Variables`
                                : undefined
                            }
                          >
                            {importe === null ? raya : pesos(importe)}
                            {importe !== null && f.sinPrecio > 0 && (
                              <span style={{ color: "#b45309" }}> *</span>
                            )}
                          </td>
                        ))}

                        {/* Acciones, al final de la fila: abre los partes que
                            arman el renglón. En los totales no va ninguno. */}
                        <td style={{ ...td, textAlign: "center" }} className="sin-tachar">
                          <div className="d-flex justify-content-center gap-1">
                            <button
                              onClick={() => abrirEdicionFila(f)}
                              className="btn btn-sm btn-outline-primary d-flex align-items-center justify-content-center rounded-2 p-0"
                              style={{ width: "20px", height: "20px" }}
                              title={`Corregir la cantidad o el precio de ${f.tarea}`}
                            >
                              <i className="bi bi-pencil" style={{ fontSize: "0.65rem" }}></i>
                            </button>

                            {/* Historial de las correcciones de este renglón.
                                Se pinta en ámbar cuando tiene alguna. */}
                            <button
                              onClick={() => verHistorialFila(f)}
                              className={`btn btn-sm d-flex align-items-center justify-content-center rounded-2 p-0 ${
                                f.corregida ? "btn-warning" : "btn-outline-secondary"
                              }`}
                              style={{ width: "20px", height: "20px" }}
                              title={
                                f.corregida
                                  ? "Ver el historial de correcciones"
                                  : "Sin correcciones"
                              }
                            >
                              <i className="bi bi-clock-history" style={{ fontSize: "0.65rem" }}></i>
                            </button>
                          </div>
                        </td>
                      </tr>

                      {/* Cierre del bloque: el total de la persona, en la
                          columna de precio total. */}
                      {ultimaDePersona && (
                        <tr
                          className={`total-persona fin-persona${
                            excluida ? " persona-excluida" : ""
                          }`}
                        >
                          {/* Plegar y desplegar el detalle de la persona. Va en
                              la columna del ojo, a la altura de su total. */}
                          <td
                            style={{ ...td, textAlign: "center" }}
                            className="sin-tachar col-ojo"
                          >
                            <div className="d-flex align-items-center justify-content-center gap-1">
                              <button
                                onClick={() => alternarPlegado(f.idPersona)}
                                className="btn btn-sm btn-outline-secondary d-flex align-items-center justify-content-center rounded-2 p-0"
                                style={{ width: "18px", height: "18px" }}
                                title={
                                  plegada
                                    ? `Ver el detalle de ${f.persona}`
                                    : `Esconder el detalle de ${f.persona}`
                                }
                              >
                                <i
                                  className={`bi bi-${plegada ? "plus" : "dash"}-lg`}
                                  style={{ fontSize: "0.6rem" }}
                                ></i>
                              </button>

                              {/* Plegada, esta es la única fila que se ve de la
                                  persona: el ojo tiene que estar acá o no habría
                                  cómo sacarla de los totales. */}
                              {plegada && (
                                <button
                                  onClick={() => alternarExcluido(f.idPersona)}
                                  className="btn btn-sm p-0 border-0 bg-transparent"
                                  style={{ lineHeight: 1, color: excluida ? "#dc2626" : "#64748b" }}
                                  title={
                                    excluida
                                      ? `Volver a contar a ${f.persona} en los totales`
                                      : `Sacar a ${f.persona} de los totales`
                                  }
                                >
                                  <i
                                    className={`bi bi-eye${excluida ? "-slash" : ""}-fill`}
                                    style={{ fontSize: "0.75rem" }}
                                  ></i>
                                </button>
                              )}
                            </div>
                          </td>

                          {/* El rótulo cruza las columnas hasta el $ unitario y
                              va alineado a la derecha: corta antes de las dos
                              columnas de descuento, lejos de los nombres. */}
                          <td
                            colSpan={8}
                            style={{ ...td, fontWeight: 700, color: "#1b4332", textAlign: "right" }}
                          >
                            Total {f.persona}
                          </td>
                          {/* Los descuentos van acá, junto a los totales que
                              modifican. El número se edita en la celda; para
                              cargarlo de cero está el botón de arriba. */}
                          <td style={{ ...td, textAlign: "center" }}>
                            {celdaDescuento(f.idPersona, "descAntic")}
                          </td>
                          <td style={{ ...td, textAlign: "center" }}>
                            {celdaDescuento(f.idPersona, "retJudicial")}
                          </td>
                          <td style={{ ...td, textAlign: "center", fontWeight: 700, color: "#1b4332" }}>
                            {total === undefined ? raya : pesos(total)}
                          </td>
                          <td style={{ ...td, textAlign: "center", fontWeight: 700, color: "#1b4332" }}>
                            {totalBruto === undefined ? raya : pesos(totalBruto)}
                          </td>
                          <td style={td}></td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })
              )}

              {/* Cierre de la tabla: lo que suma todo lo que quedó prendido */}
              {!cargando && filas.length > 0 && (
                <tr className="total-general">
                  {/* El color de la letra lo pone la clase: acá va oscuro y la
                      fila está dada vuelta. */}
                  <td colSpan={9} style={{ ...td, fontWeight: 700, textAlign: "right" }}>
                    TOTAL GENERAL
                    <span
                      className="fw-normal ms-2"
                      style={{ fontSize: "0.68rem", color: "#a7d8bf" }}
                    >
                      {totalGeneral.personas}{" "}
                      {totalGeneral.personas === 1 ? "persona" : "personas"}
                      {excluidos.size > 0 ? ` · ${excluidos.size} sin contar` : ""}
                    </span>
                  </td>
                  {/* Más chicos, igual que las celdas de arriba: la columna es
                      angosta. */}
                  <td style={{ ...td, textAlign: "center", fontWeight: 700, fontSize: "0.64rem" }}>
                    {totalGeneral.descAntic ? pesos(totalGeneral.descAntic) : raya}
                  </td>
                  <td style={{ ...td, textAlign: "center", fontWeight: 700, fontSize: "0.64rem" }}>
                    {totalGeneral.retJudicial ? pesos(totalGeneral.retJudicial) : raya}
                  </td>
                  <td style={{ ...td, textAlign: "center", fontWeight: 700 }}>
                    {pesos(totalGeneral.neto)}
                  </td>
                  <td style={{ ...td, textAlign: "center", fontWeight: 700 }}>
                    {pesos(totalGeneral.bruto)}
                  </td>
                  <td style={td}></td>
                </tr>
              )}
            </tbody>
            </Table>
          </div>
        </div>
      </Container>

      {/* Historial de correcciones de un renglón. El valor y el motivo de cada
          registro se pueden corregir; el campo, el valor anterior y la fecha
          son lo que pasó y quedan como están. */}
      <Modal show={Boolean(verHistorial)} onHide={() => setVerHistorial(null)} size="lg" centered>
        <Modal.Header closeButton closeVariant="white" style={{ backgroundColor: "#1b4332", color: "#fff" }}>
          <Modal.Title className="fs-6 fw-bold d-flex align-items-center gap-2 text-white">
            <i className="bi bi-clock-history" style={{ color: "#f59e0b" }}></i>
            <span>Historial de correcciones</span>
          </Modal.Title>
        </Modal.Header>

        <Modal.Body style={{ backgroundColor: "#f8f9fa" }}>
          <div className="fw-bold mb-2" style={{ color: "#1b4332", fontSize: "0.86rem" }}>
            {verHistorial?.persona} — {verHistorial?.tarea}
          </div>

          <div className="bg-white rounded-3" style={{ border: "1px solid #e2e8f0", overflow: "auto" }}>
            <Table className="mb-0 tabla-informe" style={{ width: "100%", tableLayout: "fixed" }}>
              <thead>
                <tr>
                  {/* El detalle es texto libre y se lee mal en una columna
                      angosta: se lleva todo el ancho que sobra y el resto se
                      ajusta a lo que ocupa su contenido. */}
                  <th style={{ ...th, textAlign: "center", width: "72px" }}>Fecha</th>
                  <th style={{ ...th, textAlign: "left", width: "108px" }}>Campo</th>
                  <th style={{ ...th, textAlign: "center", width: "68px" }}>Antes</th>
                  <th style={{ ...th, textAlign: "center", width: "108px" }}>Después</th>
                  <th style={{ ...th, textAlign: "left", width: "auto" }}>Detalle</th>
                </tr>
              </thead>
              <tbody>
                {(verHistorial ? cambiosDeLaFila(verHistorial) : []).map((c, i) => {
                  const esCantidad = c.campo === "cantidad";
                  const fmt = (v) =>
                    v === null || v === undefined ? raya : esCantidad ? numero(v) : pesos(v);
                  const guardando = guardandoHistorial === c._id;
                  // Solo el primero de cada campo es el que rige; los de abajo
                  // ya fueron reemplazados.
                  const rige =
                    i ===
                    (verHistorial ? cambiosDeLaFila(verHistorial) : []).findIndex(
                      (x) => x.campo === c.campo
                    );

                  return (
                    <tr key={c._id}>
                      <td style={{ ...td, textAlign: "center", whiteSpace: "nowrap" }}>
                        {formatFecha(c.createdAt)}
                      </td>
                      <td style={td}>
                        {esCantidad ? "Cantidad" : "Precio unitario"}
                        {rige && (
                          <span
                            className="badge ms-1"
                            style={{ backgroundColor: "#10b981", fontSize: "0.55rem" }}
                          >
                            rige
                          </span>
                        )}
                      </td>
                      <td
                        style={{
                          ...td,
                          textAlign: "center",
                          color: "#94a3b8",
                          textDecoration: "line-through",
                        }}
                      >
                        {fmt(c.anterior)}
                      </td>
                      {/* El precio lleva el signo en el prefijo: adentro es un
                          number, que no admite separadores. La cantidad no es
                          plata, así que va sin prefijo. */}
                      <td style={{ ...td, textAlign: "center" }}>
                        <InputGroup size="sm">
                          {!esCantidad && (
                            <InputGroup.Text
                              className="bg-light text-muted fw-bold px-1"
                              style={{ fontSize: "0.72rem" }}
                            >
                              $
                            </InputGroup.Text>
                          )}
                          <Form.Control
                            type="number"
                            step="any"
                            min="0"
                            disabled={guardando}
                            defaultValue={c.nuevo}
                            className="text-center fw-bold"
                            style={{ fontSize: "0.72rem", height: "24px", padding: "0 4px", color: "#1b4332" }}
                            onBlur={(e) => guardarCambioDelHistorial(c, "nuevo", e.target.value)}
                          />
                        </InputGroup>
                      </td>
                      <td style={td}>
                        <Form.Control
                          size="sm"
                          disabled={guardando}
                          defaultValue={c.detalle}
                          style={{ fontSize: "0.72rem", height: "24px", padding: "0 6px" }}
                          onBlur={(e) => guardarCambioDelHistorial(c, "detalle", e.target.value)}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </Table>
          </div>

          <span className="text-muted d-block mt-2" style={{ fontSize: "0.72rem" }}>
            Se guarda al salir del campo. Rige el cambio más nuevo de cada
            campo. Estas correcciones no modifican los partes de la planilla.
          </span>
        </Modal.Body>

        <Modal.Footer className="bg-light border-0 py-2 px-4">
          <Button
            variant="outline-secondary"
            size="sm"
            onClick={() => setVerHistorial(null)}
            className="rounded-3 px-3"
            style={{ fontSize: "0.84rem" }}
          >
            Cerrar
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Corrección de un renglón. Lo único que se toca acá es el precio y la
          cantidad total; el resto se corrige en la planilla. */}
      <Modal
        show={Boolean(verFila)}
        onHide={() => setVerFila(null)}
        centered
        contentClassName="border-0 shadow-lg rounded-4"
      >
        <Modal.Header
          closeButton
          closeVariant="white"
          style={{
            backgroundColor: "#1b4332",
            color: "#fff",
            borderTopLeftRadius: "1rem",
            borderTopRightRadius: "1rem",
          }}
        >
          <Modal.Title className="fs-6 fw-bold d-flex align-items-center gap-2 text-white">
            <i className="bi bi-pencil-square" style={{ color: "#10b981" }}></i>
            <span>Corregir renglón</span>
          </Modal.Title>
        </Modal.Header>

        <Modal.Body className="p-4">
          <div className="rounded-3 px-3 py-2 mb-3" style={{ backgroundColor: "#e8f5ee" }}>
            <div className="fw-bold" style={{ color: "#1b4332", fontSize: "0.88rem" }}>
              {verFila?.persona}
            </div>
            <div className="text-muted" style={{ fontSize: "0.78rem" }}>
              {verFila?.tarea}
              {verFila?.unidad ? ` · ${verFila.unidad}` : ""}
            </div>
          </div>

          <div className="d-flex gap-3">
            {/* Van como texto y no como number: el punto de los miles hace
                legible un 1.250.000, y un input numérico no lo admite. Se
                formatea al salir del campo y se limpia al entrar, para poder
                tipear sin pelear con los puntos. */}
            <div>
              <Form.Label className="fw-semibold text-dark small mb-1">Cantidad total</Form.Label>
              <Form.Control
                type="text"
                inputMode="decimal"
                className="rounded-3 text-center fw-bold"
                style={{ fontSize: "0.85rem", width: "150px", color: "#1b4332" }}
                value={edicion.cantidad}
                onChange={(e) => setEdicion((c) => ({ ...c, cantidad: e.target.value }))}
                onFocus={(e) =>
                  setEdicion((c) => ({ ...c, cantidad: sinSeparadores(e.target.value) }))
                }
                onBlur={(e) =>
                  setEdicion((c) => ({ ...c, cantidad: conSeparadores(e.target.value) }))
                }
              />
            </div>
            <div>
              <Form.Label className="fw-semibold text-dark small mb-1">Precio unitario</Form.Label>
              <InputGroup style={{ width: "150px" }}>
                <InputGroup.Text className="bg-light text-muted fw-bold" style={{ fontSize: "0.85rem" }}>
                  $
                </InputGroup.Text>
                <Form.Control
                  type="text"
                  inputMode="decimal"
                  className="text-center fw-bold"
                  style={{ fontSize: "0.85rem", color: "#1b4332" }}
                  value={edicion.precioUnitario}
                  onChange={(e) => setEdicion((c) => ({ ...c, precioUnitario: e.target.value }))}
                  onFocus={(e) =>
                    setEdicion((c) => ({ ...c, precioUnitario: sinSeparadores(e.target.value) }))
                  }
                  onBlur={(e) =>
                    setEdicion((c) => ({ ...c, precioUnitario: conSeparadores(e.target.value) }))
                  }
                />
              </InputGroup>
            </div>
          </div>

          <Form.Label className="fw-semibold text-dark small mb-1 mt-3">
            Detalle de cambio <span className="text-danger">*</span>
          </Form.Label>
          {/* Texto libre: el motivo de un ajuste no entra en una lista cerrada. */}
          <Form.Control
            as="textarea"
            rows={2}
            maxLength={300}
            placeholder="Por qué se corrige este renglón"
            className="rounded-3"
            style={{ fontSize: "0.85rem" }}
            value={edicion.detalle}
            onChange={(e) => setEdicion((c) => ({ ...c, detalle: e.target.value }))}
          />

          <span className="text-muted d-block mt-3" style={{ fontSize: "0.72rem" }}>
            La planilla de carga no se modifica: los partes quedan como están y
            el informe muestra este valor por encima. Para corregir un parte —la
            fecha, el CC, los horarios— hay que ir a la planilla del mes.
          </span>
        </Modal.Body>

        <Modal.Footer
          className="bg-light border-0 py-2 px-4"
          style={{ borderBottomLeftRadius: "1rem", borderBottomRightRadius: "1rem" }}
        >
          <Button
            variant="outline-secondary"
            size="sm"
            onClick={() => setVerFila(null)}
            className="rounded-3 px-3"
            style={{ fontSize: "0.84rem" }}
          >
            Cancelar
          </Button>
          <Button
            size="sm"
            onClick={guardarEdicionFila}
            disabled={guardandoFila}
            className="rounded-3 px-3"
            style={{ backgroundColor: "#1b4332", borderColor: "#1b4332", fontSize: "0.84rem", fontWeight: 600 }}
          >
            Guardar
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Carga de los descuentos de una persona */}
      <Modal
        show={showCarga}
        onHide={() => setShowCarga(false)}
        centered
        contentClassName="border-0 shadow-lg rounded-4 overflow-visible"
      >
        <Modal.Header
          closeButton
          closeVariant="white"
          style={{
            backgroundColor: "#1b4332",
            color: "#fff",
            borderTopLeftRadius: "1rem",
            borderTopRightRadius: "1rem",
            borderBottom: "1px solid rgba(255,255,255,0.1)",
          }}
        >
          <Modal.Title className="fs-6 fw-bold d-flex align-items-center gap-2 text-white">
            <i className="bi bi-cash-coin" style={{ color: "#f59e0b" }}></i>
            <span>Descuentos de {titulo}</span>
          </Modal.Title>
        </Modal.Header>

        <Modal.Body className="p-4" style={{ overflow: "visible" }}>
          <Form.Label className="fw-semibold text-dark small mb-1">
            Personal <span className="text-danger">*</span>
          </Form.Label>
          {/* Solo la gente con partes en el período: cargarle un descuento a
              alguien que no está en el informe no se vería en ningún lado. */}
          <SelectBuscador
            opciones={personasDelPeriodo.map(([id, nombre]) => ({ valor: id, texto: nombre }))}
            valor={carga.persona}
            onChange={elegirPersonaCarga}
            vacio="— Seleccionar —"
            placeholder="— Seleccionar —"
            className="rounded-3"
            style={{ fontSize: "0.85rem", height: "38px" }}
          />

          {/* El signo va en el prefijo del campo: adentro es un number, que no
              admite el 12.500,00 con separadores. Igual que en Variables. */}
          <div className="d-flex gap-3 mt-3">
            {[
              ["descAntic", "Desc/Antic."],
              ["retJudicial", "Ret. Judicial"],
            ].map(([campo, etiqueta]) => (
              <div key={campo}>
                <Form.Label className="fw-semibold text-dark small mb-1">{etiqueta}</Form.Label>
                <InputGroup style={{ width: "150px" }}>
                  <InputGroup.Text
                    className="bg-light text-muted fw-bold"
                    style={{ fontSize: "0.85rem" }}
                  >
                    $
                  </InputGroup.Text>
                  <Form.Control
                    type="number"
                    step="any"
                    min="0"
                    className="text-center fw-bold"
                    style={{ fontSize: "0.85rem", color: "#1b4332" }}
                    value={carga[campo]}
                    onChange={(e) => setCarga((c) => ({ ...c, [campo]: e.target.value }))}
                  />
                </InputGroup>
              </div>
            ))}
          </div>

          <span className="text-muted d-block mt-3" style={{ fontSize: "0.72rem" }}>
            Los dos importes se restan del total neto de la persona. Dejarlos
            vacíos vale como cero.
          </span>
        </Modal.Body>

        <Modal.Footer
          className="bg-light border-0 py-2 px-4"
          style={{ borderBottomLeftRadius: "1rem", borderBottomRightRadius: "1rem" }}
        >
          <Button
            variant="outline-secondary"
            size="sm"
            onClick={() => setShowCarga(false)}
            className="rounded-3 px-3 py-1.5"
            style={{ fontSize: "0.84rem" }}
          >
            Cancelar
          </Button>
          <Button
            size="sm"
            onClick={guardarCarga}
            disabled={guardandoCarga}
            className="rounded-3 px-3 py-1.5"
            style={{ backgroundColor: "#1b4332", borderColor: "#1b4332", fontSize: "0.84rem", fontWeight: 600 }}
          >
            Guardar
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
}

export default ProduccionInformeTareasPersonal;
