import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import Swal from "sweetalert2";
import { Container, Table, Button, Form, Card } from "react-bootstrap";
import { nuevoWorkbook } from "../../helpers/excel";
import {
  esConflictoHorometro,
  preguntarQueHacer,
  registrarCambioDeHorometro,
} from "../../utils/horometro";

const MESES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

const FORM_VACIO = {
  fecha: "",
  persona: "",
  cc: "",
  horaIngreso: "",
  horaEgreso: "",
  horomIngreso: "",
  horomSalida: "",
  lote: "",
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
const calcularHoras = (ingreso, egreso) => {
  const aMin = (h) => {
    const m = /^(\d{1,2}):(\d{2})$/.exec((h || "").trim());
    if (!m) return null;
    const hs = Number(m[1]);
    const min = Number(m[2]);
    return hs > 23 || min > 59 ? null : hs * 60 + min;
  };
  const i = aMin(ingreso);
  const e = aMin(egreso);
  if (i === null || e === null) return 0;
  const minutos = e >= i ? e - i : 1440 - i + e;
  return Math.round((minutos / 60) * 100) / 100;
};

const calcularHorasCC = (ingreso, salida) => {
  const i = Number(ingreso);
  const s = Number(salida);
  if (!Number.isFinite(i) || !Number.isFinite(s) || s <= i) return 0;
  return Math.round((s - i) * 100) / 100;
};

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

function ProduccionCertificadoMes() {
  const { anio, mes } = useParams();
  const navigate = useNavigate();

  const [periodo, setPeriodo] = useState({ desde: "", hasta: "" });
  const [cerrado, setCerrado] = useState(false);
  const [fechaCierre, setFechaCierre] = useState(null);
  const [partes, setPartes] = useState([]);
  const [personal, setPersonal] = useState([]);
  const [centros, setCentros] = useState([]);
  const [tareas, setTareas] = useState([]);

  const [busqueda, setBusqueda] = useState("");
  const [filtroFecha, setFiltroFecha] = useState("");
  const [filtroPersona, setFiltroPersona] = useState("Todos");
  const [filtroTarea, setFiltroTarea] = useState("Todas");
  const [filtroCC, setFiltroCC] = useState("Todos");
  const [filtroTurbo, setFiltroTurbo] = useState("Todos");

  const [form, setForm] = useState(FORM_VACIO);
  const [editando, setEditando] = useState(null);
  const [guardando, setGuardando] = useState(false);
  const refPersona = useRef(null);
  const ccPedido = useRef(null);
  const [ccTexto, setCcTexto] = useState("");

  const titulo = `${MESES[Number(mes) - 1] || ""} ${anio}`;

  // ── carga de datos ────────────────────────────────────────────────
  const cargarPeriodo = async () => {
    try {
      const res = await fetch(`/api/periodos/${anio}/${mes}`);
      const data = await res.json();
      const estaCerrado = Boolean(data.cerrado);
      setCerrado(estaCerrado);
      setFechaCierre(soloFecha(data.fechaCierre) || null);
      // Mientras la certificación está abierta el "hasta" acompaña al día de
      // hoy; al cerrarla queda fijo en la fecha de cierre.
      const rango = {
        desde: soloFecha(data.desde),
        hasta: estaCerrado ? soloFecha(data.hasta) : hoyStr(),
      };
      setPeriodo(rango);
      return rango;
    } catch {
      return null;
    }
  };

  const cargarPartes = async (rango) => {
    if (!rango?.desde || !rango?.hasta) return;
    try {
      const res = await fetch(`/api/partes?desde=${rango.desde}&hasta=${rango.hasta}`);
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
      // Un parte fuera del período no pertenece a esta planilla.
      if (rango?.desde && rango?.hasta && (dia < rango.desde || dia > rango.hasta)) return resto;
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
    // Los tres padrones son independientes: pedirlos en fila era esperar tres
    // veces la misma ida y vuelta al servidor.
    const [personas, centrosCosto, listaTareas] = await Promise.all([
      pedir("/api/personal"),
      pedir("/api/centros-costo"),
      pedir("/api/tareas"),
    ]);
    setPersonal(personas);
    setCentros(centrosCosto);
    setTareas(listaTareas);
  };

  useEffect(() => {
    (async () => {
      // El período define qué partes pedir; los padrones no dependen de él.
      const rango = await cargarPeriodo();
      await Promise.all([cargarPadrones(), cargarPartes(rango)]);
      setForm((f) => ({ ...f, fecha: hoyStr() }));
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [anio, mes]);

  // ── período ───────────────────────────────────────────────────────
  const guardarPeriodo = async () => {
    if (cerrado) return;
    if (!periodo.desde || !periodo.hasta) return;
    try {
      const res = await fetch(`/api/periodos/${anio}/${mes}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(periodo),
      });
      if (res.ok) {
        await cargarPartes(periodo);
        avisar({ icon: "success", title: "Período actualizado", timer: 1200, showConfirmButton: false });
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
    const res = await fetch(`/api/periodos/${anio}/${mes}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...rango, cerrado: cerrar, fechaCierre: fecha }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      avisar({ icon: "error", title: "Error", text: err.error || "No se pudo guardar el cierre" });
      return false;
    }
    const nuevo = await cargarPeriodo();
    await cargarPartes(nuevo);
    return true;
  };

  // Fecha del último parte cargado en el período. Es hasta donde llega de
  // verdad la planilla: mientras la certificación está abierta el "hasta"
  // acompaña al día de hoy, que casi nunca es el día del último parte.
  const ultimaCarga = useMemo(
    () =>
      partes.reduce((mayor, p) => {
        const dia = soloFecha(p.fecha);
        return dia > mayor ? dia : mayor;
      }, ""),
    [partes]
  );

  /**
   * El cierre fija el "hasta" del período: si la fecha elegida es anterior a
   * la última carga, los partes posteriores dejan de entrar en la planilla.
   * Por eso cualquier fecha distinta a la propuesta se confirma aparte.
   */
  const confirmarFechaDeCierre = async (fecha) => {
    if (!ultimaCarga || fecha === ultimaCarga) return true;

    const anterior = fecha < ultimaCarga;
    const fuera = anterior ? partes.filter((x) => soloFecha(x.fecha) > fecha).length : 0;

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
    // Viene puesta la del último parte cargado; se puede cambiar, y si se
    // cambia hay que confirmarla. Al corregir se vuelve a preguntar con lo
    // que se había escrito.
    let propuesta = ultimaCarga || periodo.hasta || hoyStr();
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
   * La planilla solo lista los partes del período. Si la fecha queda afuera el
   * parte se guarda igual pero desaparece de la vista, y parece que no se
   * hubiera guardado: antes de eso se avisa y se deja decidir.
   */
  const confirmarFechaFueraDePeriodo = async (fecha) => {
    const dia = soloFecha(fecha);
    if (!dia || !periodo.desde || !periodo.hasta) return true;
    if (dia >= periodo.desde && dia <= periodo.hasta) return true;

    const posterior = dia > periodo.hasta;
    const res = await avisar({
      icon: "warning",
      title: "Fecha fuera del período",
      width: "380px",
      html: `
        <div style="text-align:left;font-size:0.84rem;line-height:1.5">
          <div>Fecha del parte: <b>${formatFecha(dia)}</b></div>
          <div>Período de la certificación: <b>${formatFecha(periodo.desde)}</b> al
            <b>${formatFecha(periodo.hasta)}</b></div>
          <hr style="margin:.55rem 0">
          <div>La fecha es <b>${posterior ? "posterior" : "anterior"}</b> al período, así que el
            parte <b>no va a aparecer en esta planilla</b>.${
              posterior
                ? " Mientras la certificación esté abierta el período llega hasta hoy."
                : ""
            }</div>
        </div>`,
      showCancelButton: true,
      confirmButtonText: "Guardar igual",
      cancelButtonText: "Corregir la fecha",
      confirmButtonColor: "#b45309",
      cancelButtonColor: "#15803d",
      reverseButtons: true,
    });
    return res.isConfirmed;
  };

  // ── alta / edición de partes ──────────────────────────────────────
  const cambiar = (campo, valor) => setForm((f) => ({ ...f, [campo]: valor }));

  const limpiarForm = () => {
    setForm({ ...FORM_VACIO, fecha: form.fecha });
    setCcTexto("");
    setEditando(null);
    refPersona.current?.focus();
  };

  // Manda el parte al backend. Devuelve la respuesta cruda para que el que
  // llama decida qué hacer con un conflicto de horómetro.
  const enviarParte = (datos) =>
    fetch(editando ? `/api/partes/${editando}` : "/api/partes", {
      method: editando ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(datos),
    });

  const guardarParte = async () => {
    if (cerrado) return;
    // Mismos obligatorios que valida el backend.
    const falta = [];
    if (!form.fecha) falta.push("la fecha");
    if (!form.persona) falta.push("la persona");
    if (!form.tarea) falta.push("la tarea");
    if (form.cantidad === "" || form.cantidad === null) falta.push("la cantidad");
    if (falta.length) {
      avisar({
        icon: "warning",
        title: "Faltan datos",
        text: `Falta ${falta.join(", ")}`,
      });
      return;
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

    // Un parte fuera del período se guarda igual, pero no aparece en esta
    // planilla: sin el aviso da la sensación de que no se guardó nada.
    if (!(await confirmarFechaFueraDePeriodo(form.fecha))) return;

    setGuardando(true);
    try {
      let res = await enviarParte(form);

      // El horómetro retrocede: se resuelve con el usuario y se reintenta.
      if (res.status === 409) {
        const conflicto = await res.json().catch(() => ({}));
        if (!esConflictoHorometro(res.status, conflicto)) {
          avisar({ icon: "error", title: "Error", text: conflicto.error || "No se pudo guardar" });
          return;
        }

        const accion = await preguntarQueHacer(conflicto);
        if (accion === "verificar" || accion === null) return;

        if (accion === "descartar") {
          // Se guarda el parte sin la lectura; queda vigente el horómetro anterior.
          res = await enviarParte({ ...form, horomIngreso: "", horomSalida: "" });
        } else if (accion === "cambio") {
          const tractorId = centros.find((c) => c._id === form.cc)?.tractor;
          const cambio = await registrarCambioDeHorometro({
            tractor: typeof tractorId === "object" ? tractorId?._id : tractorId,
            fecha: form.fecha,
            conflicto,
          });
          if (!cambio) return;
          res = await enviarParte(form);
        }
      }

      if (res.ok) {
        const eraEdicion = Boolean(editando);
        const guardado = await res.json().catch(() => null);
        // Si por lo que sea no vino el parte, se recarga el período completo.
        if (guardado?._id) ubicarParte(guardado, periodo);
        else await cargarPartes(periodo);
        limpiarForm();
        avisar({
          icon: "success",
          title: eraEdicion ? "Parte actualizado" : "Parte guardado",
          timer: 1500,
          showConfirmButton: false,
        });
      } else {
        const err = await res.json().catch(() => ({}));
        avisar({ icon: "error", title: "Error", text: err.error || "No se pudo guardar" });
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
    setForm({
      fecha: soloFecha(p.fecha),
      persona: p.persona?._id || "",
      cc: p.cc?._id || "",
      horaIngreso: p.horaIngreso || "",
      horaEgreso: p.horaEgreso || "",
      horomIngreso: p.horomIngreso ?? "",
      horomSalida: p.horomSalida ?? "",
      lote: p.lote || "",
      observacion: p.observacion || "",
      tarea: p.tarea?._id || "",
      cantidad: p.cantidad ?? "",
      combustible: p.combustible ?? "",
      turbo: p.turbo || "",
      combTurbo: p.combTurbo ?? "",
    });
    refPersona.current?.focus();
  };

  // Copia el parte al formulario sin pisarlo: sirve para el rondín de todos
  // los días, donde solo cambia la fecha o la persona.
  const duplicarParte = (p) => {
    if (cerrado) return;
    setEditando(null);
    setCcTexto(p.cc?.cc || "");
    setForm({
      fecha: soloFecha(p.fecha),
      persona: p.persona?._id || "",
      cc: p.cc?._id || "",
      horaIngreso: p.horaIngreso || "",
      horaEgreso: p.horaEgreso || "",
      horomIngreso: p.horomIngreso ?? "",
      horomSalida: p.horomSalida ?? "",
      lote: p.lote || "",
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
  const turbos = useMemo(
    () => centros.filter((c) => (c.equipo || "").trim().toLowerCase() === "turbo"),
    [centros]
  );

  // Elegir el CC arrastra el horómetro con el que quedó la última vez. El
  // backend lo busca sobre todos los partes, no solo los del período en
  // pantalla: el último horómetro de un mes es el primero del siguiente.
  const tipearCC = (texto) => {
    setCcTexto(texto);
    const buscado = texto.trim().toLowerCase();
    const centro = centros.find((c) => String(c.cc).trim().toLowerCase() === buscado);
    elegirCC(centro?._id || "");
  };

  const elegirCC = async (ccId) => {
    setForm((f) => ({ ...f, cc: ccId }));

    // Editando no se pisa: ese parte ya tiene su propio horómetro.
    if (editando) return;
    if (!ccId) {
      setForm((f) => ({ ...f, horomIngreso: "" }));
      return;
    }

    ccPedido.current = ccId;
    try {
      const res = await fetch(`/api/partes/ultimo-horometro/${ccId}`);
      const data = res.ok ? await res.json() : null;
      // Si mientras respondía se eligió otro CC, este dato ya no sirve.
      if (ccPedido.current !== ccId) return;
      const salida = data?.horomSalida;
      setForm((f) => (f.cc === ccId ? { ...f, horomIngreso: salida ?? "" } : f));
    } catch {
      if (ccPedido.current === ccId) setForm((f) => ({ ...f, horomIngreso: "" }));
    }
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

  const hayFiltro =
    Boolean(busqueda) ||
    Boolean(filtroFecha) ||
    filtroPersona !== "Todos" ||
    filtroTarea !== "Todas" ||
    filtroCC !== "Todos" ||
    filtroTurbo !== "Todos";

  const partesFiltrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    return partes.filter((p) => {
      if (filtroFecha && soloFecha(p.fecha) !== filtroFecha) return false;
      if (filtroPersona !== "Todos" && (p.persona?._id || "") !== filtroPersona) return false;
      if (filtroTarea !== "Todas" && (p.tarea?._id || "") !== filtroTarea) return false;
      if (filtroCC !== "Todos" && (p.cc?._id || "") !== filtroCC) return false;
      if (filtroTurbo !== "Todos" && (p.turbo || "") !== filtroTurbo) return false;
      if (!q) return true;
      return [
        p.persona?.apellidoNombre,
        p.cc?.cc,
        p.tarea?.tarea,
        p.turbo,
        p.lote,
        p.observacion,
      ]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q));
    });
  }, [partes, busqueda, filtroFecha, filtroPersona, filtroTarea, filtroCC, filtroTurbo]);

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

  const observacionesUsadas = useMemo(
    () => [...new Set(partes.map((p) => (p.observacion || "").trim()).filter(Boolean))].sort(),
    [partes]
  );

  const totalHorasForm = calcularHoras(form.horaIngreso, form.horaEgreso);
  const horasCCForm = calcularHorasCC(form.horomIngreso, form.horomSalida);

  // ── exportar a Excel ──────────────────────────────────────────────
  const exportarExcel = async () => {
    const wb = await nuevoWorkbook();
    const ws = wb.addWorksheet("Certificación");

    const tituloHoja = `CERTIFICACIÓN DE PRODUCCIÓN - ${titulo.toUpperCase()}`;
    const columnas = [
      "Fecha",
      "Personal",
      "Ingreso",
      "Egreso",
      "Total hs",
      "CC",
      "Horóm. entra",
      "Horóm. salida",
      "Horas CC",
      "Combust.",
      "Turbo",
      "Comb. turbo",
      "Lote",
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
        p.totalHoras || 0,
        p.cc?.cc || "-",
        p.horomIngreso ?? "-",
        p.horomSalida ?? "-",
        p.horasCC || 0,
        p.combustible ?? "-",
        p.turbo || "-",
        p.combTurbo ?? "-",
        p.lote || "-",
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
        // Personal, lote, observaciones y tarea se leen mejor a la izquierda.
        const aIzquierda = [2, 13, 14, 15];
        cell.alignment = aIzquierda.includes(colNumber)
          ? { horizontal: "left", vertical: "middle", wrapText: true }
          : { horizontal: "center", vertical: "middle" };
      });
    });

    ws.columns = [
      { width: 12 }, // Fecha
      { width: 26 }, // Personal
      { width: 10 }, // Ingreso
      { width: 10 }, // Egreso
      { width: 10 }, // Total hs
      { width: 10 }, // CC
      { width: 14 }, // Horóm. entra
      { width: 14 }, // Horóm. salida
      { width: 10 }, // Horas CC
      { width: 11 }, // Combust.
      { width: 12 }, // Turbo
      { width: 12 }, // Comb. turbo
      { width: 14 }, // Lote
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

  const botonExcel = (
    <Button
      size="sm"
      onClick={exportarExcel}
      disabled={partesFiltrados.length === 0}
      className="rounded-3 px-3 d-flex align-items-center gap-2 ms-auto"
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
        {/* Encabezado: mes, período y volver */}
        <div className="d-flex align-items-center justify-content-between gap-3 mb-2 flex-wrap">
          <div className="d-flex align-items-center gap-2">
            <button
              onClick={() => navigate(`/produccion/certificados/${anio}/${mes}`)}
              className="btn btn-sm btn-outline-secondary d-flex align-items-center gap-1 rounded-3 px-2 py-1"
              style={{ fontSize: "0.8rem" }}
            >
              <i className="bi bi-arrow-left"></i>
            </button>
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
            {botonExcel}
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
                  onChange={(e) => cambiar("fecha", e.target.value)}
                  style={estiloCelda}
                />
              </div>

              <div style={{ width: "175px" }}>
                <label className="text-muted d-block" style={{ fontSize: "0.7rem" }}>Personal *</label>
                <Form.Select ref={refPersona} value={form.persona} onChange={(e) => cambiar("persona", e.target.value)} style={estiloCelda}>
                  <option value="">—</option>
                  {personal.map((p) => (
                    <option key={p._id} value={p._id}>{p.apellidoNombre}</option>
                  ))}
                </Form.Select>
              </div>

              <div style={{ width: "78px" }}>
                <label className="text-muted d-block" style={{ fontSize: "0.7rem" }}>Ingreso</label>
                <Form.Control type="time" value={form.horaIngreso} onChange={(e) => cambiar("horaIngreso", e.target.value)} style={estiloCelda} />
              </div>

              <div style={{ width: "78px" }}>
                <label className="text-muted d-block" style={{ fontSize: "0.7rem" }}>Egreso</label>
                <Form.Control type="time" value={form.horaEgreso} onChange={(e) => cambiar("horaEgreso", e.target.value)} style={estiloCelda} />
              </div>

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
                <Form.Control
                  value={ccTexto}
                  onChange={(e) => tipearCC(e.target.value)}
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
                <label className="text-muted d-block" style={{ fontSize: "0.7rem" }}>Horóm. entra</label>
                <Form.Control type="number" step="any" value={form.horomIngreso} onChange={(e) => cambiar("horomIngreso", e.target.value)} style={estiloCelda} />
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
                <Form.Select value={form.turbo} onChange={(e) => cambiar("turbo", e.target.value)} style={estiloCelda}>
                  <option value="">—</option>
                  {turbos.map((t) => (
                    <option key={t._id} value={t.cc}>
                      {t.descripcion ? `${t.cc} - ${t.descripcion}` : t.cc}
                    </option>
                  ))}
                  {/* Un parte viejo puede tener un turbo escrito a mano que ya
                      no está en el padrón: se conserva para no perderlo. */}
                  {form.turbo && !turbos.some((t) => t.cc === form.turbo) && (
                    <option value={form.turbo}>{form.turbo}</option>
                  )}
                </Form.Select>
              </div>

              <div style={{ width: "78px" }}>
                <label className="text-muted d-block" style={{ fontSize: "0.7rem" }}>Comb. turbo</label>
                <Form.Control type="number" value={form.combTurbo} onChange={(e) => cambiar("combTurbo", e.target.value)} style={estiloCelda} />
              </div>

              {botonExcel}
            </div>

            {/* Fila 2: el resto de los datos del parte */}
            <div className="d-flex align-items-end gap-2 flex-wrap mt-2" onKeyDown={alPresionarEnter}>
              <div style={{ width: "120px" }}>
                <label className="text-muted d-block" style={{ fontSize: "0.7rem" }}>Lote</label>
                <Form.Control list="lotes-usados" value={form.lote} onChange={(e) => cambiar("lote", e.target.value)} style={estiloCelda} />
                <datalist id="lotes-usados">
                  {lotesUsados.map((l) => <option key={l} value={l} />)}
                </datalist>
              </div>

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
                <Form.Select value={form.tarea} onChange={(e) => cambiar("tarea", e.target.value)} style={estiloCelda}>
                  <option value="">—</option>
                  {tareasOrdenadas.map((t) => (
                    <option key={t._id} value={t._id}>{t.tarea}</option>
                  ))}
                </Form.Select>
              </div>

              <div style={{ width: "80px" }}>
                <label className="text-muted d-block" style={{ fontSize: "0.7rem" }}>
                  Cantidad <span className="text-danger">*</span>
                </label>
                <Form.Control type="number" value={form.cantidad} onChange={(e) => cambiar("cantidad", e.target.value)} style={estiloCelda} />
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

        {/* Barra de Filtros */}
        <Card className="shadow-sm border-0 rounded-3 px-3 py-2 bg-white flex-shrink-0 mb-2">
          <div className="d-flex align-items-center flex-wrap gap-3">
            {/* Buscador de Texto */}
            <div style={{ width: "240px" }}>
              <div className="input-group input-group-sm">
                <span
                  className="input-group-text bg-light border-end-0 text-muted"
                  style={{ padding: "3px 9px", height: "32px" }}
                >
                  <i className="bi bi-search" style={{ fontSize: "0.8rem" }}></i>
                </span>
                <Form.Control
                  type="text"
                  placeholder="Buscar personal, CC, tarea, lote..."
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
            <div className="d-flex align-items-center gap-2">
              <span className="fw-bold text-dark small flex-shrink-0" style={{ fontSize: "0.8rem" }}>
                Fecha:
              </span>
              <div className="input-group input-group-sm" style={{ width: "150px" }}>
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
              ancho="180px"
              valor={filtroPersona}
              vacio="Todos"
              onChange={setFiltroPersona}
              opciones={personasDelPeriodo}
            />

            {/* Filtro por Tarea */}
            <FiltroSelect
              etiqueta="Tarea"
              ancho="185px"
              valor={filtroTarea}
              vacio="Todas"
              onChange={setFiltroTarea}
              opciones={tareasDelPeriodo}
            />

            {/* Filtro por CC */}
            <FiltroSelect
              etiqueta="CC"
              ancho="120px"
              valor={filtroCC}
              vacio="Todos"
              onChange={setFiltroCC}
              opciones={ccDelPeriodo}
            />

            {/* Filtro por Turbo */}
            <FiltroSelect
              etiqueta="Turbo"
              ancho="130px"
              valor={filtroTurbo}
              vacio="Todos"
              onChange={setFiltroTurbo}
              opciones={turbosDelPeriodo.map((t) => [t, t])}
            />

            {hayFiltro && (
              <span className="text-muted" style={{ fontSize: "0.78rem" }}>
                {partesFiltrados.length} de {partes.length}
              </span>
            )}
          </div>
        </Card>

        {/* Tabla de partes */}
        <div
          className="flex-grow-1 shadow-sm rounded-3 bg-white"
          style={{ overflowY: "auto", overflowX: "auto", border: "1px solid #cbd5e1" }}
        >
          <Table size="sm" className="tabla-certificado tabla-informe text-center align-middle mb-0" style={{ whiteSpace: "nowrap", fontSize: "0.7rem", width: "100%" }}>
            <thead style={{ position: "sticky", top: 0, zIndex: 10, backgroundColor: "#1b4332", color: "#fff" }}>
              <tr className="fw-normal align-middle">
                {[
                  "Fecha", "Personal", "Ingreso", "Egreso", { h: "Total hs", sep: true },
                  "CC", "Horóm. entra", "Horóm. sal.", "Horas CC", { h: "Combust.", sep: true },
                  "Turbo", { h: "Comb. turbo", sep: true }, "Lote", "Observaciones", "Tarea", "Cantidad", "Un.", "",
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
                  <td colSpan={18} className="text-muted py-4" style={{ fontSize: "0.85rem" }}>
                    {hayFiltro
                      ? "Ningún parte coincide con los filtros"
                      : "No hay partes cargados en este período"}
                  </td>
                </tr>
              ) : (
                partesFiltrados.map((p) => (
                  <tr key={p._id} className={editando === p._id ? "fila-editando" : undefined}>
                    <td className="fw-semibold text-dark">{formatFecha(p.fecha)}</td>
                    <td className="text-start ps-2">{p.persona?.apellidoNombre || "—"}</td>
                    <td className="text-secondary">{p.horaIngreso || "—"}</td>
                    <td className="text-secondary">{p.horaEgreso || "—"}</td>
                    <td className={`fw-bold ${SEP}`} style={{ color: "#1b4332" }}>{p.totalHoras || "—"}</td>
                    <td>{p.cc?.cc || "—"}</td>
                    <td className="text-secondary">{p.horomIngreso ?? "—"}</td>
                    <td className="text-secondary">{p.horomSalida ?? "—"}</td>
                    <td className="fw-bold" style={{ color: "#1b4332" }}>{p.horasCC || "—"}</td>
                    <td className={`text-secondary ${SEP}`}>{p.combustible ?? "—"}</td>
                    <td className="text-secondary">{p.turbo || "—"}</td>
                    <td className={`text-secondary ${SEP}`}>{p.combTurbo ?? "—"}</td>
                    <td className="text-secondary">{p.lote || "—"}</td>
                    <td className="text-start ps-2 text-secondary">{p.observacion || "—"}</td>
                    <td className="text-start ps-2">{p.tarea?.tarea || "—"}</td>
                    <td className="fw-semibold">{p.cantidad ?? "—"}</td>
                    <td className="text-secondary">{p.tarea?.unidad || "—"}</td>
                    <td>
                      <div className="d-flex justify-content-center gap-1">
                        {cerrado ? (
                          <span className="text-muted" style={{ fontSize: "0.7rem" }}>—</span>
                        ) : (
                          <>
                          <button
                            onClick={() => duplicarParte(p)}
                            className="btn btn-sm btn-outline-secondary d-flex align-items-center justify-content-center rounded-2 p-0"
                            style={{ width: "22px", height: "22px" }}
                            title="Copiar al formulario"
                          >
                            <i className="bi bi-files" style={{ fontSize: "0.7rem" }}></i>
                          </button>
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
