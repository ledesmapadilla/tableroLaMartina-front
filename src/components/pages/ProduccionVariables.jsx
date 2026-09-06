import { useEffect, useMemo, useState } from "react";
import { useForm, Controller } from "react-hook-form";
import Swal from "sweetalert2";
import { Container, Table, Button, Form, Modal, Row, Col, Card, InputGroup } from "react-bootstrap";
import { nuevoWorkbook } from "../../helpers/excel";
import { unirClientes } from "../../utils/clientes";
import SelectBuscador from "../shared/SelectBuscador";

const API_VARIABLES = "/api/variables";
const API_TAREAS = "/api/tareas";

const soloFecha = (iso) => (iso || "").slice(0, 10);

const formatFecha = (iso) => {
  const [a, m, d] = soloFecha(iso).split("-");
  return d ? `${d}/${m}/${a}` : "—";
};

const hoyStr = () => {
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${dd}`;
};

// Formato de moneda argentino: $ 12.500,00.
const formatPesos = (valor) =>
  valor === null || valor === undefined || valor === ""
    ? "—"
    : Number(valor).toLocaleString("es-AR", {
        style: "currency",
        currency: "ARS",
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });

const ESTADOS = ["Todas", "Con precio", "Sin precio"];

// Lo que se descuenta del bruto para llegar al neto. El que se carga es el
// neto: el bruto es cuenta, acá y en el backend, que es el que lo guarda.
const RETENCION = 0.205;

const brutoDesdeNeto = (neto) => {
  const valor = Number(neto);
  if (neto === "" || neto === null || neto === undefined || !Number.isFinite(valor)) return null;
  return Math.round((valor / (1 - RETENCION)) * 100) / 100;
};

// Para ordenar el historial y saber cuál rige: manda la vigencia, y si no está
// cargada se cae a la fecha de carga.
const cuandoRige = (v) => soloFecha(v.vigenciaDesde) || soloFecha(v.fecha) || "";

/**
 * Variables de la certificación: el precio con el que se paga cada tarea.
 *
 * La pantalla se lee **por cliente**: arriba se elige a quién se le certifica y
 * la tabla muestra el precio vigente de cada tarea para ese cliente. Los
 * clientes salen de la carga de datos (los partes) más los que ya tienen algún
 * precio, así el mismo nombre no se escribe de dos formas.
 *
 * Cada carga de precio es una fila propia: la última vigencia es la que rige y
 * las anteriores quedan en el **historial** de esa tarea y ese cliente.
 *
 * No depende del mes: por eso cuelga de `/produccion/certificados/variables` y
 * no de un año y mes.
 */
function ProduccionVariables() {
  const [tareas, setTareas] = useState([]);
  const [precios, setPrecios] = useState([]);
  const [clientes, setClientes] = useState([]);
  const [cliente, setCliente] = useState("");
  const [busqueda, setBusqueda] = useState("");
  const [filtroEstado, setFiltroEstado] = useState("Todas");

  // Modal de carga / edición. `editando` es el id de la carga que se corrige;
  // en el alta va en null.
  const [showModal, setShowModal] = useState(false);
  const [editando, setEditando] = useState(null);
  const [tareaFija, setTareaFija] = useState(null);

  // Modal de historial: la fila que se está mirando.
  const [historialDe, setHistorialDe] = useState(null);

  const {
    register,
    handleSubmit,
    reset,
    watch,
    control,
    formState: { errors },
  } = useForm();

  // El bruto del modal se recalcula mientras se tipea el neto.
  const netoTipeado = watch("neto");

  const cargar = async () => {
    try {
      const [resTareas, resPrecios, resClientesPartes, resClientesPrecios] = await Promise.all([
        fetch(API_TAREAS),
        fetch(API_VARIABLES),
        fetch("/api/partes/clientes"),
        fetch(`${API_VARIABLES}/clientes`),
      ]);
      const datosTareas = resTareas.ok ? await resTareas.json() : [];
      const datosPrecios = resPrecios.ok ? await resPrecios.json() : [];
      const dePartes = resClientesPartes.ok ? await resClientesPartes.json() : [];
      const dePrecios = resClientesPrecios.ok ? await resClientesPrecios.json() : [];

      setTareas(Array.isArray(datosTareas) ? datosTareas : []);
      setPrecios(Array.isArray(datosPrecios) ? datosPrecios : []);
      setClientes(unirClientes(dePartes, dePrecios));
    } catch {
      setTareas([]);
      setPrecios([]);
      setClientes(unirClientes());
    }
  };

  useEffect(() => {
    cargar();
  }, []);

  // El primer cliente de la lista es el que se abre por defecto; si el elegido
  // deja de existir se vuelve a ese.
  useEffect(() => {
    if (!clientes.length) return;
    setCliente((actual) => (actual && clientes.includes(actual) ? actual : clientes[0]));
  }, [clientes]);

  // Todas las cargas del cliente elegido, agrupadas por tarea y ordenadas de la
  // vigencia más nueva a la más vieja.
  const historialPorTarea = useMemo(() => {
    const mapa = new Map();
    for (const p of precios) {
      // Sin distinguir mayúsculas ni espacios: el cliente es texto libre y
      // "San Miguel" y "san miguel" son el mismo.
      if ((p.cliente || "").trim().toLowerCase() !== cliente.trim().toLowerCase()) continue;
      const id = p.tarea?._id || p.tarea;
      if (!mapa.has(id)) mapa.set(id, []);
      mapa.get(id).push(p);
    }
    for (const lista of mapa.values()) {
      lista.sort((a, b) => cuandoRige(b).localeCompare(cuandoRige(a)));
    }
    return mapa;
  }, [precios, cliente]);

  // Una fila por tarea, con el precio que rige hoy para el cliente elegido.
  const filas = useMemo(
    () =>
      tareas
        .map((t) => {
          const historial = historialPorTarea.get(t._id) || [];
          const vigente = historial[0] || null;
          return {
            _id: t._id,
            tarea: t.tarea,
            unidad: t.unidad || "",
            empresa: t.empresa || "",
            vigente,
            historial,
          };
        })
        .sort((a, b) => a.tarea.localeCompare(b.tarea, "es", { sensitivity: "base" })),
    [tareas, historialPorTarea]
  );

  const filasFiltradas = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    return filas.filter((f) => {
      if (filtroEstado === "Con precio" && !f.vigente) return false;
      if (filtroEstado === "Sin precio" && f.vigente) return false;
      if (!q) return true;
      return [f.tarea, f.unidad, f.empresa].filter(Boolean).some((v) => v.toLowerCase().includes(q));
    });
  }, [filas, busqueda, filtroEstado]);

  // Los precios se cargan de a tandas: todos los de la lista arrancan la misma
  // vigencia. Se propone la primera vigencia que se cargó hoy, así solo hay que
  // escribirla en el primer precio del día.
  const vigenciaSugerida = useMemo(() => {
    const hoy = hoyStr();
    const delDia = precios
      .filter((p) => soloFecha(p.fecha) === hoy && p.vigenciaDesde)
      .sort((a, b) => (a.createdAt || "").localeCompare(b.createdAt || ""));
    return soloFecha(delDia[0]?.vigenciaDesde);
  }, [precios]);

  const conPrecio = filas.filter((f) => f.vigente).length;
  const hayFiltro = Boolean(busqueda) || filtroEstado !== "Todas";

  // Las tareas del desplegable del modal, ordenadas por nombre.
  const opcionesTareas = useMemo(
    () =>
      tareas
        .slice()
        .sort((a, b) => a.tarea.localeCompare(b.tarea, "es", { sensitivity: "base" }))
        .map((t) => ({
          valor: t._id,
          texto: t.unidad ? `${t.tarea} (${t.unidad})` : t.tarea,
        })),
    [tareas]
  );

  // ── carga y edición ───────────────────────────────────────────────
  // Un solo botón para toda la tabla: se elige la tarea adentro del modal.
  const abrirAlta = (tarea = null) => {
    setEditando(null);
    setTareaFija(tarea);
    reset({
      tarea: tarea?._id || "",
      cliente,
      neto: "",
      fecha: hoyStr(),
      vigenciaDesde: vigenciaSugerida,
    });
    setShowModal(true);
  };

  // Editar corrige la carga, no agrega otra al historial.
  const abrirEditar = (carga) => {
    setEditando(carga._id);
    setTareaFija(carga.tarea);
    reset({
      tarea: carga.tarea?._id || "",
      cliente: carga.cliente || "",
      neto: carga.neto ?? "",
      fecha: soloFecha(carga.fecha),
      vigenciaDesde: soloFecha(carga.vigenciaDesde),
    });
    setShowModal(true);
  };

  /**
   * Desde la fila siempre se carga un precio NUEVO, nunca se pisa el vigente.
   *
   * Cambiar un precio es un hecho con fecha: el valor viejo tiene que quedar
   * en el historial para saber con qué se certificó cada mes. Pisarlo dejaba
   * una sola carga por tarea y el historial vacío. Para corregir una carga mal
   * tipeada está el lápiz de adentro del historial.
   *
   * El neto viene puesto con el que rige, que es lo que se va a retocar.
   */
  const nuevoPrecioDesdeFila = (f) => {
    setEditando(null);
    setTareaFija({ _id: f._id, tarea: f.tarea, unidad: f.unidad });
    reset({
      tarea: f._id,
      cliente,
      neto: f.vigente?.neto ?? "",
      fecha: hoyStr(),
      vigenciaDesde: vigenciaSugerida,
    });
    setShowModal(true);
  };

  const cerrarModal = () => {
    setShowModal(false);
    setEditando(null);
    setTareaFija(null);
    reset();
  };

  const onSubmit = async (data) => {
    try {
      const res = await fetch(editando ? `${API_VARIABLES}/${editando}` : API_VARIABLES, {
        method: editando ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (res.ok) {
        const guardado = await res.json().catch(() => null);
        cerrarModal();
        await cargar();
        // Cargar un precio de otro cliente cambia la vista a ese cliente: si no,
        // parece que no se guardó nada.
        if (guardado?.cliente) setCliente(guardado.cliente);
        Swal.fire({
          icon: "success",
          title: editando ? "Precio actualizado" : "Precio cargado",
          timer: 1400,
          showConfirmButton: false,
        });
      } else {
        const err = await res.json().catch(() => ({}));
        Swal.fire({ icon: "error", title: "Error", text: err.error || "No se pudo guardar" });
      }
    } catch {
      Swal.fire({ icon: "error", title: "Sin conexión", text: "No se pudo conectar con el servidor" });
    }
  };

  // Devuelve true si se borró, para que el que llama sepa si cerrar el modal.
  const borrarCarga = async (carga, tareaTexto) => {
    // Borrar una carga no siempre deja la tarea sin precio: si tenía historial,
    // vuelve a regir la carga anterior. Conviene decirlo antes de borrar.
    const idTarea = carga.tarea?._id || carga.tarea;
    const anteriores = precios.filter(
      (p) =>
        p._id !== carga._id &&
        (p.tarea?._id || p.tarea) === idTarea &&
        (p.cliente || "").trim().toLowerCase() === (carga.cliente || "").trim().toLowerCase()
    );
    const quedaVigente = anteriores.sort((a, b) =>
      soloFecha(b.vigenciaDesde).localeCompare(soloFecha(a.vigenciaDesde))
    )[0];

    const result = await Swal.fire({
      title: "¿Borrar este precio?",
      html: `<div style="font-size:0.86rem">${tareaTexto}<br><b>${formatPesos(carga.neto)}</b> neto — vigencia ${
        carga.vigenciaDesde ? formatFecha(carga.vigenciaDesde) : "sin fecha"
      }<div style="color:#64748b;margin-top:.5rem;font-size:0.8rem">${
        quedaVigente
          ? `Va a volver a regir <b>${formatPesos(quedaVigente.neto)}</b>, del ${formatFecha(
              quedaVigente.vigenciaDesde
            )}.`
          : "La tarea queda <b>sin precio</b> para este cliente."
      }</div></div>`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#dc2626",
      cancelButtonColor: "#64748b",
      confirmButtonText: "Sí, borrar",
      cancelButtonText: "Cancelar",
    });
    if (!result.isConfirmed) return false;

    try {
      const res = await fetch(`${API_VARIABLES}/${carga._id}`, { method: "DELETE" });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        Swal.fire({ icon: "error", title: "Error", text: err.error || "No se pudo borrar" });
        return false;
      }
      await cargar();
      Swal.fire({ icon: "success", title: "Precio borrado", timer: 1200, showConfirmButton: false });
      return true;
    } catch {
      Swal.fire({ icon: "error", title: "Sin conexión", text: "No se pudo conectar con el servidor" });
      return false;
    }
  };

  // Borrar desde el modal de edición: es la forma de dejar una tarea sin
  // precio, que antes solo se podía hacer entrando al historial.
  const borrarDesdeModal = async () => {
    const carga = precios.find((p) => p._id === editando);
    if (!carga) return;
    const texto = tareaFija?.tarea || "Este precio";
    if (await borrarCarga(carga, `${texto} — ${carga.cliente || "sin cliente"}`)) {
      cerrarModal();
    }
  };

  // El historial se mira sobre los datos ya cargados: al borrar o editar se
  // recalcula solo con la fila que corresponde.
  const historialAbierto = useMemo(
    () => (historialDe ? filas.find((f) => f._id === historialDe) || null : null),
    [historialDe, filas]
  );

  // ── Excel ─────────────────────────────────────────────────────────
  const exportarExcel = async () => {
    const wb = await nuevoWorkbook();
    const ws = wb.addWorksheet("Variables");
    const columnas = ["#", "Tarea", "Unidad", "$ neto", "$ bruto", "Fecha", "Vigencia desde"];

    ws.mergeCells(1, 1, 1, columnas.length);
    const celdaTitulo = ws.getCell("A1");
    celdaTitulo.value = `VARIABLES DE LA CERTIFICACIÓN - ${(cliente || "").toUpperCase()}`;
    celdaTitulo.font = { bold: true, size: 14 };
    celdaTitulo.alignment = { horizontal: "center", vertical: "middle" };
    ws.getRow(1).height = 28;

    ws.mergeCells(2, 1, 2, columnas.length);
    const celdaFecha = ws.getCell("A2");
    celdaFecha.value = `Fecha de emisión: ${formatFecha(hoyStr())}`;
    celdaFecha.font = { italic: true, size: 10, color: { argb: "FF64748B" } };
    celdaFecha.alignment = { horizontal: "center", vertical: "middle" };
    ws.getRow(2).height = 18;

    ws.addRow([]);

    const filaEncabezado = ws.addRow(columnas);
    filaEncabezado.eachCell((cell) => {
      cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
      cell.alignment = { horizontal: "center", vertical: "middle" };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1B4332" } };
    });
    ws.getRow(4).height = 20;

    filasFiltradas.forEach((f, idx) => {
      const v = f.vigente;
      const fila = ws.addRow([
        idx + 1,
        f.tarea,
        f.unidad || "—",
        v?.neto ?? "—",
        v?.bruto ?? "—",
        v?.fecha ? formatFecha(v.fecha) : "—",
        v?.vigenciaDesde ? formatFecha(v.vigenciaDesde) : "—",
      ]);
      fila.eachCell((cell) => {
        cell.alignment = { horizontal: "center", vertical: "middle" };
        cell.border = {
          top: { style: "thin", color: { argb: "FFE2E8F0" } },
          bottom: { style: "thin", color: { argb: "FFE2E8F0" } },
          left: { style: "thin", color: { argb: "FFE2E8F0" } },
          right: { style: "thin", color: { argb: "FFE2E8F0" } },
        };
      });
      fila.getCell(2).alignment = { horizontal: "left", vertical: "middle" };
      // Los importes van como número con formato de moneda, para que en el
      // Excel se puedan sumar.
      [4, 5].forEach((col) => {
        if (typeof fila.getCell(col).value === "number") {
          fila.getCell(col).numFmt = '"$" #,##0.00';
        }
      });
    });

    ws.columns = [
      { width: 6 },
      { width: 44 },
      { width: 14 },
      { width: 14 },
      { width: 14 },
      { width: 14 },
      { width: 16 },
    ];

    const buffer = await wb.xlsx.writeBuffer();
    const blob = new Blob([buffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `variables_${(cliente || "certificacion").replace(/\s+/g, "_")}_${hoyStr()}.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Mismo encabezado que las tablas de los informes.
  const estiloTh = {
    backgroundColor: "#1b4332",
    color: "#fff",
    fontSize: "0.66rem",
    fontWeight: 600,
    verticalAlign: "middle",
    padding: "3px 5px",
    whiteSpace: "nowrap",
  };

  // Las dos fechas se confunden entre sí, así que la aclaración del modal va
  // también en el encabezado de la columna.
  const th = (texto, extra = {}, leyenda = "") => (
    <th
      style={{
        ...estiloTh,
        ...(leyenda ? { whiteSpace: "normal", lineHeight: 1.15 } : null),
        ...extra,
      }}
    >
      {texto}
      {leyenda && (
        <span
          className="d-block"
          style={{ fontSize: "0.6rem", fontWeight: 400, color: "rgba(255,255,255,0.65)" }}
        >
          {leyenda}
        </span>
      )}
    </th>
  );

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
      <Container
        fluid
        className="px-4 py-3 d-flex flex-column flex-grow-1"
        style={{ maxWidth: "1020px", width: "100%", margin: "0 auto", overflow: "hidden" }}
      >
        {/* Encabezado: título + acciones de toda la tabla. El volver está en el
            navbar de Producción, arriba. */}
        <div className="d-flex align-items-center justify-content-between gap-3 mb-3 flex-wrap">
          <div className="d-flex align-items-center gap-2">
            <div
              className="rounded-3 d-flex align-items-center justify-content-center"
              style={{
                width: "34px",
                height: "34px",
                backgroundColor: "#334155",
                color: "#fff",
                fontSize: "1.1rem",
                boxShadow: "0 2px 8px rgba(51, 65, 85, 0.3)",
              }}
            >
              <i className="bi bi-sliders"></i>
            </div>
            <div className="d-flex flex-column lh-sm">
              <span className="fw-bold" style={{ color: "#1b4332", fontSize: "1rem" }}>
                Variables
              </span>
              <span className="text-muted" style={{ fontSize: "0.78rem" }}>
                {conPrecio} de {filas.length} tareas con precio · rigen para todos los meses
              </span>
            </div>
          </div>

          <div className="d-flex align-items-center gap-2">
            <Button
              variant="success"
              size="sm"
              onClick={exportarExcel}
              disabled={filasFiltradas.length === 0}
              className="d-inline-flex align-items-center gap-1 rounded-3 px-3 shadow-sm"
              style={{ fontSize: "0.82rem", backgroundColor: "#15803d", borderColor: "#15803d" }}
              title="Exportar a Excel"
            >
              <i className="bi bi-file-earmark-excel-fill"></i>
              <span>Excel</span>
            </Button>

            {/* Un solo botón de carga para toda la tabla */}
            <Button
              size="sm"
              onClick={() => abrirAlta()}
              disabled={tareas.length === 0}
              className="d-inline-flex align-items-center gap-1 rounded-3 px-3 shadow-sm"
              style={{
                backgroundColor: "#1b4332",
                borderColor: "#1b4332",
                fontSize: "0.82rem",
                fontWeight: 600,
              }}
            >
              <i className="bi bi-plus-lg"></i>
              <span>Cargar precio</span>
            </Button>
          </div>
        </div>

        {/* Cliente + buscador + estado */}
        <Card className="shadow-sm border-0 rounded-3 px-3 py-2 bg-white flex-shrink-0 mb-2">
          <div className="d-flex align-items-center gap-3 flex-wrap">
            {/* El cliente manda: la tabla muestra los precios de ese cliente */}
            <div className="d-flex align-items-center gap-2">
              <span className="fw-bold text-dark flex-shrink-0" style={{ fontSize: "0.82rem" }}>
                Cliente:
              </span>
              <Form.Select
                size="sm"
                value={cliente}
                onChange={(e) => setCliente(e.target.value)}
                className="rounded-3 fw-bold"
                style={{
                  fontSize: "0.85rem",
                  height: "32px",
                  width: "210px",
                  padding: "3px 24px 3px 8px",
                  color: "#1b4332",
                  borderColor: "#1b4332",
                }}
                title="Los clientes salen de la carga de datos y de los precios ya cargados"
              >
                {clientes.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </Form.Select>
            </div>

            <div style={{ width: "220px" }}>
              <div className="input-group input-group-sm">
                <span
                  className="input-group-text bg-light border-end-0 text-muted"
                  style={{ padding: "3px 9px", height: "32px" }}
                >
                  <i className="bi bi-search" style={{ fontSize: "0.8rem" }}></i>
                </span>
                <Form.Control
                  type="text"
                  placeholder="Buscar tarea..."
                  value={busqueda}
                  onChange={(e) => setBusqueda(e.target.value)}
                  className={`border-start-0 ${busqueda ? "fw-bold filtro-activo" : ""}`}
                  style={{
                    fontSize: "0.82rem",
                    height: "32px",
                    padding: "3px 8px 3px 10px",
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
                    style={{ padding: "0 7px", height: "32px" }}
                  >
                    <i className="bi bi-x" style={{ fontSize: "0.9rem" }}></i>
                  </button>
                )}
              </div>
            </div>

            {/* Ver qué falta cargar es la mitad del trabajo de esta pantalla */}
            <div className="d-flex align-items-center gap-2">
              <span className="fw-bold text-dark small flex-shrink-0" style={{ fontSize: "0.8rem" }}>
                Estado:
              </span>
              <div className="input-group input-group-sm" style={{ width: "150px" }}>
                <Form.Select
                  size="sm"
                  value={filtroEstado}
                  onChange={(e) => setFiltroEstado(e.target.value)}
                  className={`rounded-3 ${filtroEstado !== "Todas" ? "rounded-end-0 border-end-0 fw-bold filtro-activo" : ""}`}
                  style={{
                    fontSize: "0.82rem",
                    height: "32px",
                    padding: "3px 24px 3px 8px",
                    color: filtroEstado !== "Todas" ? "#dc2626" : "#1e293b",
                    fontWeight: filtroEstado !== "Todas" ? "700" : "normal",
                  }}
                >
                  {ESTADOS.map((e) => (
                    <option key={e} value={e}>
                      {e}
                    </option>
                  ))}
                </Form.Select>
                {filtroEstado !== "Todas" && (
                  <button
                    className="btn btn-outline-secondary border-start-0 d-flex align-items-center justify-content-center"
                    type="button"
                    onClick={() => setFiltroEstado("Todas")}
                    title="Limpiar filtro"
                    style={{ padding: "0 6px", height: "32px" }}
                  >
                    <i className="bi bi-x" style={{ fontSize: "0.9rem" }}></i>
                  </button>
                )}
              </div>
            </div>

            {hayFiltro && (
              <span className="text-muted" style={{ fontSize: "0.78rem" }}>
                {filasFiltradas.length} de {filas.length}
              </span>
            )}
          </div>
        </Card>

        {/* Tabla: el precio vigente de cada tarea para el cliente elegido */}
        <div
          className="flex-grow-1 shadow-sm rounded-3 bg-white"
          style={{ overflowY: "auto", overflowX: "auto", border: "1px solid #cbd5e1" }}
        >
          {/* Mismo estilo que las tablas de los informes: cebra, hover y bordes
              los pone `tabla-informe` desde index.css. */}
          <Table
            className="text-center align-middle mb-0 tabla-informe"
            style={{ whiteSpace: "nowrap", fontSize: "0.7rem", width: "100%" }}
          >
            <thead
              style={{ position: "sticky", top: 0, zIndex: 10, backgroundColor: "#1b4332", color: "#fff" }}
            >
              <tr className="align-middle">
                {th("#", { width: "40px" })}
                {th("Tarea", { textAlign: "left" })}
                {th("Unidad", { width: "100px" })}
                {/* Primero el neto, que es el que se carga; el bruto es cuenta */}
                {th("$ neto", { width: "115px" })}
                {th("$ bruto", { width: "115px" })}
                {th("Fecha", { width: "125px" }, "Cuándo se cargó el valor")}
                {th("Vigencia desde", { width: "125px" }, "Desde cuándo se aplica")}
                {th("Acciones", { width: "125px" })}
              </tr>
            </thead>
            <tbody>
              {filasFiltradas.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-muted py-4" style={{ fontSize: "0.8rem" }}>
                    {hayFiltro
                      ? "Ninguna tarea coincide con los filtros"
                      : "No hay tareas dadas de alta"}
                  </td>
                </tr>
              ) : (
                filasFiltradas.map((f, idx) => {
                  const v = f.vigente;
                  return (
                    <tr key={f._id}>
                      <td className="text-muted">{idx + 1}</td>
                      <td className="text-start fw-semibold text-dark">{f.tarea}</td>
                      <td className="text-secondary">{f.unidad || raya}</td>
                      <td className="fw-bold" style={{ color: "#1b4332" }}>
                        {v ? formatPesos(v.neto) : raya}
                      </td>
                      <td className="fw-bold" style={{ color: "#1b4332" }}>
                        {v ? formatPesos(v.bruto) : raya}
                      </td>
                      <td className="text-secondary">{v?.fecha ? formatFecha(v.fecha) : raya}</td>
                      <td className="text-secondary">
                        {v?.vigenciaDesde ? formatFecha(v.vigenciaDesde) : raya}
                      </td>
                      <td>
                        <div
                          className="d-flex justify-content-center align-items-center"
                          style={{ gap: "10px" }}
                        >
                          {/* Siempre carga un precio nuevo con su vigencia: el
                              vigente queda en el historial. Corregir una carga
                              mal tipeada se hace desde el historial. */}
                          <button
                            onClick={() => nuevoPrecioDesdeFila(f)}
                            className="btn btn-sm btn-outline-primary rounded-2 py-0 px-2"
                            style={{ height: "24px", fontSize: "0.72rem", fontWeight: 600 }}
                            title={
                              v
                                ? "Cargar un precio nuevo: el actual pasa al historial"
                                : "Cargar el precio de esta tarea"
                            }
                          >
                            {v ? "Nuevo precio" : "Cargar"}
                          </button>
                          <button
                            onClick={() => setHistorialDe(f._id)}
                            disabled={f.historial.length === 0}
                            className="btn btn-sm btn-outline-secondary d-flex align-items-center justify-content-center rounded-2 p-0 position-relative"
                            style={{
                              width: "24px",
                              height: "24px",
                              opacity: f.historial.length ? 1 : 0.35,
                            }}
                            title={
                              f.historial.length
                                ? `Historial (${f.historial.length} ${f.historial.length === 1 ? "carga" : "cargas"})`
                                : "Sin cargas todavía"
                            }
                          >
                            <i className="bi bi-clock-history" style={{ fontSize: "0.8rem" }}></i>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </Table>
        </div>
      </Container>

      {/* Modal de carga / edición de un precio */}
      <Modal
        show={showModal}
        onHide={cerrarModal}
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
            <i className="bi bi-sliders" style={{ color: "#10b981" }}></i>
            <span>{editando ? "Editar" : "Cargar precio"}</span>
          </Modal.Title>
        </Modal.Header>
        <Form onSubmit={handleSubmit(onSubmit)}>
          <Modal.Body className="p-4" style={{ overflow: "visible" }}>
            <Row className="g-3">
              {/* Primero el cliente: el precio es de un cliente y una tarea, y
                  se elige en ese orden. Los dos van angostos, no a todo el
                  ancho del modal. */}
              <Col md={12} className="text-center">
                <Form.Label className="fw-semibold text-dark small mb-1">
                  Cliente <span className="text-danger">*</span>
                </Form.Label>
                {/* Se ofrece la lista pero se puede escribir uno nuevo: en la
                    planilla el cliente también es texto libre. */}
                <Form.Control
                  list="clientes-conocidos"
                  className="rounded-3 mx-auto text-center"
                  style={{ fontSize: "0.85rem", maxWidth: "180px" }}
                  {...register("cliente", { required: "Hay que indicar el cliente" })}
                  isInvalid={!!errors.cliente}
                />
                <datalist id="clientes-conocidos">
                  {clientes.map((c) => (
                    <option key={c} value={c} />
                  ))}
                </datalist>
                <Form.Control.Feedback type="invalid" style={{ fontSize: "0.78rem" }}>
                  {errors.cliente?.message}
                </Form.Control.Feedback>
              </Col>

              <Col md={12} className="text-center">
                <Form.Label className="fw-semibold text-dark small mb-1">
                  Tarea <span className="text-danger">*</span>
                </Form.Label>
                {/* Desplegable con buscador: la tarea se encuentra escribiendo
                    cualquier pedazo del nombre, no solo el comienzo. */}
                <div className="mx-auto" style={{ maxWidth: "240px" }}>
                  <Controller
                    name="tarea"
                    control={control}
                    rules={{ required: "Hay que elegir la tarea" }}
                    defaultValue=""
                    render={({ field }) => (
                      <SelectBuscador
                        opciones={opcionesTareas}
                        valor={field.value || ""}
                        onChange={field.onChange}
                        vacio="— Seleccionar —"
                        placeholder="— Seleccionar —"
                        // Editando no se cambia de tarea: para eso se borra y se
                        // carga de nuevo.
                        disabled={Boolean(editando)}
                        invalido={!!errors.tarea}
                        className="rounded-3 text-center"
                        style={{ fontSize: "0.85rem", height: "38px" }}
                        inputRef={field.ref}
                      />
                    )}
                  />
                  {/* El aviso va a mano: el invalid-feedback de Bootstrap pide
                      ser hermano del campo, y acá el input queda adentro. */}
                  {errors.tarea && (
                    <span className="text-danger d-block" style={{ fontSize: "0.78rem" }}>
                      {errors.tarea.message}
                    </span>
                  )}
                </div>
                {tareaFija?.unidad && (
                  <span className="text-muted d-block mt-1" style={{ fontSize: "0.72rem" }}>
                    Precio por {tareaFija.unidad.toLowerCase()}
                  </span>
                )}
              </Col>

              {/* Se carga el neto; el bruto es cuenta y va al lado, para ver
                  contra qué número se está cargando. */}
              <Col md={6} className="text-center">
                <Form.Label className="fw-semibold text-dark small mb-1">
                  $ neto <span className="text-danger">*</span>
                </Form.Label>
                {/* El signo va en el prefijo del campo: adentro es un number,
                    que no admite el 12.500,00 con separadores. */}
                <InputGroup className="mx-auto" style={{ maxWidth: "165px" }}>
                  <InputGroup.Text
                    className="bg-light text-muted fw-bold"
                    style={{ fontSize: "0.85rem" }}
                  >
                    $
                  </InputGroup.Text>
                  <Form.Control
                    type="number"
                    step="any"
                    className="text-center fw-bold"
                    style={{ fontSize: "0.85rem", color: "#1b4332" }}
                    {...register("neto", {
                      required: "Hay que cargar el neto",
                      min: { value: 0, message: "No puede ser negativo" },
                    })}
                    isInvalid={!!errors.neto}
                  />
                  <Form.Control.Feedback type="invalid" style={{ fontSize: "0.78rem" }}>
                    {errors.neto?.message}
                  </Form.Control.Feedback>
                </InputGroup>
              </Col>

              <Col md={6} className="text-center">
                <Form.Label className="fw-semibold text-dark small mb-1">$ bruto</Form.Label>
                <div
                  className="rounded-3 d-flex align-items-center justify-content-center px-2 fw-bold mx-auto"
                  style={{
                    height: "38px",
                    maxWidth: "165px",
                    fontSize: "0.85rem",
                    backgroundColor: "#e8f5ee",
                    border: "1px solid #a7d8bf",
                    color: "#1b4332",
                  }}
                  title="Se calcula solo a partir del neto"
                >
                  {formatPesos(brutoDesdeNeto(netoTipeado))}
                </div>
                {/* La cuenta a la vista, para saber contra qué se está cargando */}
                <span className="text-muted d-block mt-1" style={{ fontSize: "0.72rem" }}>
                  Bruto = neto / (1 - {String(RETENCION).replace(".", ",")})
                </span>
              </Col>

              <Col md={6} className="text-center">
                <Form.Label className="fw-semibold text-dark small mb-1">
                  Fecha <span className="text-danger">*</span>
                </Form.Label>
                <Form.Control
                  type="date"
                  className="rounded-3 text-center mx-auto"
                  style={{ fontSize: "0.85rem", maxWidth: "165px" }}
                  {...register("fecha", { required: "Falta la fecha" })}
                  isInvalid={!!errors.fecha}
                />
                <Form.Control.Feedback type="invalid" style={{ fontSize: "0.78rem" }}>
                  {errors.fecha?.message}
                </Form.Control.Feedback>
                <span className="text-muted d-block mt-1" style={{ fontSize: "0.72rem" }}>
                  Cuándo se cargó el valor
                </span>
              </Col>

              <Col md={6} className="text-center">
                <Form.Label className="fw-semibold text-dark small mb-1">
                  Vigencia desde <span className="text-danger">*</span>
                </Form.Label>
                <Form.Control
                  type="date"
                  className="rounded-3 text-center mx-auto"
                  style={{ fontSize: "0.85rem", maxWidth: "165px" }}
                  {...register("vigenciaDesde", { required: "Falta la fecha de vigencia" })}
                  isInvalid={!!errors.vigenciaDesde}
                />
                <Form.Control.Feedback type="invalid" style={{ fontSize: "0.78rem" }}>
                  {errors.vigenciaDesde?.message}
                </Form.Control.Feedback>
                <span className="text-muted d-block mt-1" style={{ fontSize: "0.72rem" }}>
                  Desde cuándo se aplica
                </span>
              </Col>
            </Row>
          </Modal.Body>
          <Modal.Footer
            className="bg-light border-0 py-2 px-4"
            style={{ borderBottomLeftRadius: "1rem", borderBottomRightRadius: "1rem" }}
          >
            {/* Borrar es la forma de dejar la tarea sin precio. Solo al
                editar: en un alta todavía no hay nada que borrar. */}
            {editando && (
              <Button
                variant="outline-danger"
                size="sm"
                type="button"
                onClick={borrarDesdeModal}
                className="rounded-3 px-3 d-flex align-items-center gap-1 me-auto"
                style={{ fontSize: "0.84rem" }}
                title="Borrar el precio y dejar la tarea sin valor cargado"
              >
                <i className="bi bi-trash"></i>
                <span>Borrar precio</span>
              </Button>
            )}

            <Button
              variant="outline-secondary"
              size="sm"
              onClick={cerrarModal}
              className="rounded-3 px-3"
              style={{ fontSize: "0.84rem" }}
            >
              Cancelar
            </Button>
            <Button
              variant="success"
              size="sm"
              type="submit"
              className="rounded-3 px-3 shadow-sm d-flex align-items-center gap-1"
              style={{
                backgroundColor: "#15803d",
                borderColor: "#15803d",
                fontSize: "0.84rem",
                fontWeight: 600,
              }}
            >
              <i className="bi bi-check-lg"></i>
              <span>Guardar</span>
            </Button>
          </Modal.Footer>
        </Form>
      </Modal>

      {/* Modal de historial de una tarea para el cliente elegido */}
      <Modal
        show={Boolean(historialAbierto)}
        onHide={() => setHistorialDe(null)}
        centered
        size="lg"
        contentClassName="border-0 shadow-lg rounded-4"
      >
        <Modal.Header
          closeButton
          closeVariant="white"
          style={{
            backgroundColor: "#334155",
            color: "#fff",
            borderTopLeftRadius: "1rem",
            borderTopRightRadius: "1rem",
          }}
        >
          <Modal.Title className="fs-6 fw-bold d-flex align-items-center gap-2 text-white">
            <i className="bi bi-clock-history" style={{ color: "#cbd5e1" }}></i>
            <span>
              {historialAbierto?.tarea} — {cliente}
            </span>
          </Modal.Title>
        </Modal.Header>
        <Modal.Body className="p-0">
          {/* Mismo estilo que la tabla de atrás */}
          <Table
            className="text-center align-middle mb-0 tabla-informe"
            style={{ fontSize: "0.7rem", width: "100%" }}
          >
            <thead>
              <tr className="align-middle">
                {th("Vigencia desde", { width: "150px" }, "Desde cuándo se aplica")}
                {th("$ neto")}
                {th("$ bruto")}
                {th("Fecha", { width: "150px" }, "Cuándo se cargó el valor")}
                {th("Acciones", { width: "110px" })}
              </tr>
            </thead>
            <tbody>
              {(historialAbierto?.historial || []).map((h, idx) => (
                <tr key={h._id}>
                  <td className="fw-semibold text-dark">
                    {h.vigenciaDesde ? formatFecha(h.vigenciaDesde) : raya}
                    {/* La primera es la que está rigiendo hoy */}
                    {idx === 0 && (
                      <span
                        className="ms-2 px-2 rounded-pill"
                        style={{
                          backgroundColor: "#dcfce7",
                          color: "#15803d",
                          fontSize: "0.68rem",
                          fontWeight: 700,
                        }}
                      >
                        vigente
                      </span>
                    )}
                  </td>
                  <td className="fw-bold" style={{ color: "#1b4332" }}>
                    {formatPesos(h.neto)}
                  </td>
                  <td className="fw-bold" style={{ color: "#1b4332" }}>
                    {formatPesos(h.bruto)}
                  </td>
                  <td className="text-secondary">{h.fecha ? formatFecha(h.fecha) : "—"}</td>
                  <td>
                    <div className="d-flex justify-content-center align-items-center" style={{ gap: "10px" }}>
                      <button
                        onClick={() => {
                          setHistorialDe(null);
                          abrirEditar(h);
                        }}
                        className="btn btn-sm btn-outline-primary d-flex align-items-center justify-content-center rounded-2 p-0"
                        style={{ width: "24px", height: "24px" }}
                        title="Editar esta carga"
                      >
                        <i className="bi bi-pencil" style={{ fontSize: "0.8rem" }}></i>
                      </button>
                      <button
                        onClick={() => borrarCarga(h, historialAbierto.tarea)}
                        className="btn btn-sm btn-outline-danger d-flex align-items-center justify-content-center rounded-2 p-0"
                        style={{ width: "24px", height: "24px" }}
                        title="Borrar esta carga"
                      >
                        <i className="bi bi-trash" style={{ fontSize: "0.8rem" }}></i>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Modal.Body>
        <Modal.Footer
          className="bg-light border-0 py-2 px-4"
          style={{ borderBottomLeftRadius: "1rem", borderBottomRightRadius: "1rem" }}
        >
          <span className="text-muted me-auto" style={{ fontSize: "0.76rem" }}>
            Rige el precio de la vigencia más nueva
          </span>
          <Button
            variant="outline-secondary"
            size="sm"
            onClick={() => setHistorialDe(null)}
            className="rounded-3 px-3"
            style={{ fontSize: "0.84rem" }}
          >
            Cerrar
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
}

export default ProduccionVariables;
