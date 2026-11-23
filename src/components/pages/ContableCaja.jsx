import { useEffect, useMemo, useRef, useState } from "react";
import { Button, Card, Container, Form, Modal, Spinner, Table } from "react-bootstrap";
import Swal from "sweetalert2";
import { api } from "../../services/api";
import { subirArchivo, borrarArchivo, prepararSubida } from "../../services/archivos";
import { usePermisos } from "../../context/permisos";
import { FiltroSelect } from "../compras/estilos";
import { exportarPlanilla } from "../../helpers/excel";
import { formatearMonto, leerMonto, montoAInput } from "../../helpers/montoInput";
import { SEMANA_VACIA, semanasCaja } from "../../helpers/cajaSemanas";

/**
 * Contable › Caja (13/11/2026, segunda versión): la tarjeta Caja abre directo
 * esta tabla con los ingresos y gastos de la caja. El modelo es la página de
 * Gasoil del Sistema de Gestión Lepa: filtros arriba (concepto y rango de
 * fechas), "Nuevo movimiento" a la derecha, la tabla con editar y borrar, y
 * el total al pie cuando hay algún filtro. Reemplaza a la caja por semanas
 * con ingreso fijo y sobrante, que el usuario hizo sacar.
 *
 * Los guardados van por detrás (la tabla cambia al instante) y las fotos se
 * suben en paralelo; se puede guardar sin esperar a que terminen.
 * Back: /api/contable/caja. Permiso: contable.caja.
 */

const COLOR = "#164e63";
const CONCEPTOS = {
  ingreso: { texto: "Ingreso", color: "#15803d", signo: "+ " },
  gasto: { texto: "Gasto", color: "#dc2626", signo: "− " },
};

const th = {
  backgroundColor: COLOR,
  color: "#fff",
  fontSize: "0.66rem",
  fontWeight: 600,
  verticalAlign: "middle",
  padding: "3px 5px",
  whiteSpace: "nowrap",
  textAlign: "center",
};
const td = { fontSize: "0.7rem", padding: "1px 5px", verticalAlign: "middle" };
const raya = <span style={{ color: "#cbd5e1" }}>—</span>;

const pesos = (n) =>
  `$ ${Number(n || 0).toLocaleString("es-AR", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
const dmy = (s) => (s ? s.split("-").reverse().join("/") : "");
const hoyIso = () => {
  const h = new Date();
  return `${h.getFullYear()}-${String(h.getMonth() + 1).padStart(2, "0")}-${String(h.getDate()).padStart(2, "0")}`;
};
const ordenar = (l) =>
  [...l].sort((a, b) => b.fecha.localeCompare(a.fecha) || String(b.createdAt || "").localeCompare(String(a.createdAt || "")));
const suma = (l) => Math.round(l.reduce((t, x) => t + (Number(x.monto) || 0), 0) * 100) / 100;

// Lo último que se trajo: al volver a la página se ve al instante y se
// actualiza cuando contesta el back. Vive mientras la pestaña está abierta.
let ultimos = null;
// Los guardados salen de a uno y en orden, por detrás.
let cola = Promise.resolve();

// ── Semanas de viernes a jueves (13/11/2026) ──
const MESES_NOMBRE = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
const aIso = (f) => `${f.getFullYear()}-${String(f.getMonth() + 1).padStart(2, "0")}-${String(f.getDate()).padStart(2, "0")}`;
const aFecha = (s) => {
  const [a, m, d] = s.split("-").map(Number);
  return new Date(a, m - 1, d);
};
const masDias = (s, n) => {
  const f = aFecha(s);
  f.setDate(f.getDate() + n);
  return aIso(f);
};
/** El viernes que abre la semana de esa fecha. */
const viernesDe = (s) => masDias(s, -((aFecha(s).getDay() + 2) % 7));
/** Los viernes de un mes ("2026-11"): cada semana va en el mes de su viernes. */
const viernesDelMes = (mes) => {
  let v = viernesDe(`${mes}-01`);
  if (v < `${mes}-01`) v = masDias(v, 7);
  const lista = [];
  for (; v.startsWith(mes); v = masDias(v, 7)) lista.push(v);
  return lista;
};
const ddmm = (s) => s.slice(8, 10) + "/" + s.slice(5, 7);
const nombreMes = (mes) => `${MESES_NOMBRE[Number(mes.slice(5, 7)) - 1]} ${mes.slice(0, 4)}`;

const vacio = () => ({ fecha: hoyIso(), concepto: "gasto", monto: "", descripcion: "", observaciones: "", archivos: [] });

function ContableCaja() {
  const { puede } = usePermisos();
  const sinEditar = !puede("contable.caja", "editar");

  const [movimientos, setMovimientos] = useState(ultimos);
  const [error, setError] = useState("");
  const [pendientes, setPendientes] = useState(0);

  // Filtro: concepto ("Ingreso" / "Gasto", como lo muestra el select).
  const [filtroConcepto, setFiltroConcepto] = useState("");

  // El modal: { original, form }. Las fotos que se están subiendo van en
  // `subidas` ({ clave, nombre, archivo, fallo, sacada }) y su promesa en `promesas`.
  const [editando, setEditando] = useState(null);
  const [subidas, setSubidas] = useState([]);
  const promesas = useRef(new Map());

  const traer = () =>
    cola
      .then(() => api.get("/contable/caja"))
      .then((l) => {
        ultimos = Array.isArray(l) ? l : [];
        setMovimientos(ultimos);
        setError("");
      })
      .catch((err) => setError(err.message));

  useEffect(() => {
    traer();
    // Así la primera foto no espera la firma de Cloudinary.
    if (!sinEditar) prepararSubida();
  }, [sinEditar]);

  /** Cambia la tabla con `local` y manda `enviar` por detrás; si falla, avisa y vuelve a traer. */
  const porDetras = (local, enviar, tituloError = "No se pudo guardar") => {
    setMovimientos((l) => {
      const nueva = ordenar(local(l || []));
      ultimos = nueva;
      return nueva;
    });
    setPendientes((n) => n + 1);
    cola = cola
      .then(async () => {
        const resultado = await enviar();
        if (resultado?.reemplazar) {
          setMovimientos((l) => {
            const nueva = ordenar((l || []).map((x) => (x._id === resultado.reemplazar ? resultado.con : x)));
            ultimos = nueva;
            return nueva;
          });
        }
      })
      .catch((err) => {
        Swal.fire({ icon: "error", title: tituloError, text: err.message, width: "300px" });
        traer();
      })
      .finally(() => setPendientes((n) => n - 1));
  };
  const listo = (titulo = "Guardado") =>
    Swal.fire({ icon: "success", title: titulo, timer: 1400, showConfirmButton: false, width: "300px" });

  // ── Filtros ──
  const filtrados = useMemo(() => {
    const concepto = filtroConcepto === "Ingreso" ? "ingreso" : filtroConcepto === "Gasto" ? "gasto" : "";
    return (movimientos || []).filter(
      (m) => !concepto || m.concepto === concepto
    );
  }, [movimientos, filtroConcepto]);
  const hayFiltro = Boolean(filtroConcepto);
  const totalIngresos = suma(filtrados.filter((m) => m.concepto === "ingreso"));
  const totalGastos = suma(filtrados.filter((m) => m.concepto === "gasto"));

  // ── El saldo total de la caja (todo, sin filtros) ──
  const saldoTotal = useMemo(
    () =>
      Math.round(
        (movimientos || []).reduce((t, m) => t + (m.concepto === "ingreso" ? 1 : -1) * (Number(m.monto) || 0), 0) * 100
      ) / 100,
    [movimientos]
  );

  // ── La semana elegida (viernes a jueves): arranca en la de hoy ──
  const [semana, setSemana] = useState(() => viernesDe(hoyIso()));
  const mesSemana = semana.slice(0, 7);
  // Los meses para elegir: del primer movimiento (o de este mes) al último (o a este mes).
  const mesesElegibles = useMemo(() => {
    const fechas = (movimientos || []).map((m) => m.fecha).concat(hoyIso()).sort();
    const desdeMes = viernesDe(fechas[0]).slice(0, 7);
    const hastaMes = fechas[fechas.length - 1].slice(0, 7);
    const lista = [];
    for (let m = desdeMes; m <= hastaMes; ) {
      lista.push(m);
      const [a, mm] = m.split("-").map(Number);
      m = mm === 12 ? `${a + 1}-01` : `${a}-${String(mm + 1).padStart(2, "0")}`;
    }
    return lista.reverse();
  }, [movimientos]);
  const semanasDelMes = useMemo(() => viernesDelMes(mesSemana), [mesSemana]);
  const elegirMes = (mes) => {
    const lista = viernesDelMes(mes);
    const actual = viernesDe(hoyIso());
    setSemana(lista.includes(actual) ? actual : lista[0]);
  };
  // Los totales de la semana con el arrastre (23/11/2026, helpers/cajaSemanas.js):
  // el saldo de la semana anterior pasa a esta, positivo como entrada y
  // negativo como gasto.
  const cadena = useMemo(() => semanasCaja(movimientos, hoyIso()), [movimientos]);
  const {
    anterior: anteriorSemana,
    entradas: ingresosSemana,
    gastos: gastosSemana,
    saldo: saldoSemana,
  } = cadena[semana] || SEMANA_VACIA;

  // ── Alta y edición ──
  const abrir = (mov) => {
    setSubidas([]);
    setEditando({
      original: mov || null,
      form: mov
        ? {
            ...mov,
            monto: montoAInput(mov.monto),
            descripcion: mov.descripcion || "",
            observaciones: mov.observaciones || "",
            archivos: mov.archivos || [],
          }
        : vacio(),
    });
  };
  const cambiar = (campo, valor) => setEditando((e) => ({ ...e, form: { ...e.form, [campo]: valor } }));

  /** Cuando terminen, borra de Cloudinary las subidas que no se van a guardar. */
  const descartar = (claves) => claves.forEach((c) => promesas.current.get(c)?.then((a) => a && borrarArchivo(a)));
  const cerrar = () => {
    descartar(subidas.map((s) => s.clave));
    promesas.current = new Map();
    setSubidas([]);
    setEditando(null);
  };

  /** Las fotos se suben todas a la vez, apenas se eligen. */
  const agregarArchivos = (ev) => {
    const files = [...(ev.target.files || [])];
    ev.target.value = "";
    for (const f of files) {
      const clave = `${Date.now()}-${Math.random()}`;
      setSubidas((l) => [...l, { clave, nombre: f.name, archivo: null, fallo: false, sacada: false }]);
      const promesa = subirArchivo(f, { achicar: true })
        .then((archivo) => {
          setSubidas((l) => l.map((s) => (s.clave === clave ? { ...s, archivo } : s)));
          return archivo;
        })
        .catch((err) => {
          setSubidas((l) => l.map((s) => (s.clave === clave ? { ...s, fallo: true } : s)));
          Swal.fire({ icon: "error", title: "No se pudo subir", text: `${f.name}: ${err.message}`, width: "300px" });
          return null;
        });
      promesas.current.set(clave, promesa);
    }
  };
  const sacarArchivo = (a) => cambiar("archivos", editando.form.archivos.filter((x) => x !== a));
  const sacarSubida = (clave) => setSubidas((l) => l.map((s) => (s.clave === clave ? { ...s, sacada: true } : s)));

  const guardar = (ev) => {
    ev.preventDefault();
    const { original, form } = editando;
    const monto = leerMonto(form.monto);
    const faltan = [
      !form.fecha && "la fecha",
      !(monto > 0) && "el monto",
      !form.descripcion.trim() && "la descripción",
    ].filter(Boolean);
    if (faltan.length) {
      const lista = faltan.length > 1 ? `${faltan.slice(0, -1).join(", ")} y ${faltan.at(-1)}` : faltan[0];
      Swal.fire({ icon: "error", title: "Faltan datos", text: `Completá ${lista}.`, width: "300px" });
      return;
    }
    const cuerpo = {
      fecha: form.fecha,
      concepto: form.concepto,
      monto,
      descripcion: form.descripcion.trim(),
      observaciones: form.observaciones.trim(),
    };
    const quedan = subidas.filter((s) => !s.sacada && !s.fallo);
    descartar(subidas.filter((s) => s.sacada).map((s) => s.clave));
    const esperar = quedan.map((s) => promesas.current.get(s.clave));
    const idLocal = original?._id || `nuevo-${Date.now()}`;
    // En la tabla ya, con las fotos que faltan subir marcadas y sin poder
    // tocarla hasta que se guarde.
    const fila = {
      ...(original || {}),
      ...cuerpo,
      _id: idLocal,
      pendiente: true,
      createdAt: original?.createdAt || new Date().toISOString(),
      archivos: [...form.archivos, ...quedan.map((s) => s.archivo || { nombre: s.nombre, subiendo: true })],
    };
    porDetras(
      (l) => (original ? l.map((x) => (x._id === original._id ? fila : x)) : [fila, ...l]),
      async () => {
        const nuevos = (await Promise.all(esperar)).filter(Boolean);
        cuerpo.archivos = [...form.archivos, ...nuevos];
        const d = original ? await api.put(`/contable/caja/${original._id}`, cuerpo) : await api.post("/contable/caja", cuerpo);
        // Los adjuntos que tenía y se sacaron, fuera de Cloudinary.
        const siguen = new Set(form.archivos.map((a) => a.publicId));
        (original?.archivos || []).filter((a) => !siguen.has(a.publicId)).forEach((a) => borrarArchivo(a));
        return { reemplazar: idLocal, con: d };
      }
    );
    promesas.current = new Map();
    setSubidas([]);
    setEditando(null);
    listo();
  };

  const borrar = async (mov) => {
    const { isConfirmed } = await Swal.fire({
      icon: "warning",
      title: `¿Borrar el ${mov.concepto === "ingreso" ? "ingreso" : "gasto"}?`,
      text: `${dmy(mov.fecha)} · ${pesos(mov.monto)}${mov.descripcion ? ` · ${mov.descripcion}` : ""}`,
      width: "320px",
      showCancelButton: true,
      confirmButtonText: "Sí, borrar",
      cancelButtonText: "Cancelar",
      confirmButtonColor: "#dc2626",
      cancelButtonColor: "#64748b",
    });
    if (!isConfirmed) return;
    porDetras(
      (l) => l.filter((x) => x._id !== mov._id),
      async () => {
        await api.delete(`/contable/caja/${mov._id}`);
        (mov.archivos || []).forEach((a) => borrarArchivo(a));
      },
      "No se pudo borrar"
    );
    listo("Borrado");
  };

  const exportarExcel = async () => {
    if (!filtrados.length) {
      Swal.fire({ icon: "info", title: "No hay movimientos para exportar", width: "300px", confirmButtonColor: "#1e293b" });
      return;
    }
    try {
      await exportarPlanilla({
        titulo: `Caja${filtroConcepto ? ` — ${filtroConcepto}s` : ""}`,
        hoja: "Caja",
        archivo: `Caja ${hoyIso()}.xlsx`,
        columnas: [
          { titulo: "Fecha", ancho: 12 },
          { titulo: "Concepto", ancho: 11 },
          { titulo: "Monto", ancho: 16, moneda: true },
          { titulo: "Descripción", ancho: 40 },
          { titulo: "Adjuntos", ancho: 10 },
          { titulo: "Observaciones", ancho: 40 },
        ],
        filas: filtrados.map((m) => [
          dmy(m.fecha),
          CONCEPTOS[m.concepto]?.texto || m.concepto,
          m.concepto === "gasto" ? -m.monto : m.monto,
          m.descripcion || "",
          (m.archivos || []).length || "",
          m.observaciones || "",
        ]),
      });
    } catch (err) {
      Swal.fire({ icon: "error", title: "No se pudo exportar", text: err.message, width: "300px" });
    }
  };

  const columnas = 7;

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", backgroundColor: "#f8f9fa", height: "100%", overflow: "hidden" }}>
      <Container className="py-3 d-flex flex-column flex-grow-1" style={{ maxWidth: "1100px", minHeight: 0 }}>
        {/* Encabezado (13/11/2026): Caja a la izquierda, el saldo total de la caja
            al centro y Nuevo movimiento con el Excel a la derecha. La grilla de
            tres columnas deja el saldo centrado en la página. El volver está en
            el navbar de Contable, arriba. */}
        <div className="mb-3" style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr", alignItems: "center", gap: "0.5rem" }}>
          <div className="d-flex align-items-center gap-2">
            <div
              className="rounded-3 d-flex align-items-center justify-content-center"
              style={{ width: 34, height: 34, backgroundColor: "#0e7490", color: "#fff", fontSize: "1.1rem" }}
            >
              <i className="bi bi-safe2-fill"></i>
            </div>
            <span className="fw-bold" style={{ color: COLOR, fontSize: "1.05rem" }}>
              Caja
            </span>
            {pendientes > 0 && (
              <span className="d-flex align-items-center gap-1 ms-2" style={{ fontSize: "0.75rem", color: "#64748b" }}>
                <Spinner animation="border" size="sm" style={{ width: "0.75rem", height: "0.75rem" }} />
                Guardando…
              </span>
            )}
          </div>

          <div
            className="d-flex align-items-baseline gap-2 bg-white rounded-3 shadow-sm px-3 py-1"
            style={{ border: `1px solid ${saldoTotal < 0 ? "#fecaca" : "#cbd5e1"}` }}
            title="Todos los ingresos menos todos los gastos (sin filtros)"
          >
            <span className="fw-semibold" style={{ fontSize: "0.8rem", color: "#64748b" }}>
              Saldo
            </span>
            <span className="fw-bold" style={{ fontSize: "1.15rem", color: saldoTotal < 0 ? "#dc2626" : COLOR, whiteSpace: "nowrap" }}>
              {movimientos ? pesos(saldoTotal) : "…"}
            </span>
          </div>

          <div className="d-flex align-items-center gap-2 justify-content-end">
            <button
              type="button"
              onClick={() => abrir()}
              disabled={sinEditar}
              className="btn btn-sm d-flex align-items-center gap-2 px-3"
              style={{ backgroundColor: COLOR, borderColor: COLOR, color: "#fff", fontSize: "0.78rem", height: "30px", fontWeight: 600 }}
              title={sinEditar ? "Sin permiso para editar" : "Cargar un ingreso o un gasto"}
            >
              <i className="bi bi-plus-lg"></i>
              Nuevo movimiento
            </button>
            <Button
              size="sm"
              onClick={exportarExcel}
              className="rounded-3 px-3 d-flex align-items-center gap-2"
              style={{ backgroundColor: "#15803d", borderColor: "#15803d", fontSize: "0.78rem", height: "30px", fontWeight: 600 }}
              title="Exportar lo filtrado a Excel"
            >
              <i className="bi bi-file-earmark-excel-fill"></i>
              Excel
            </Button>
          </div>
        </div>

        {/* Arriba de la tabla: Mes, Semana y Concepto contra el margen
            izquierdo y, a la derecha, las entradas, los gastos y el saldo de la
            semana elegida (viernes a jueves). Desde/Hasta se sacaron el
            13/11/2026. */}
        <Card className="mb-3 p-2 shadow-sm border-0 rounded-3 flex-shrink-0">
          <div className="d-flex align-items-end gap-3 flex-wrap">
              <div className="d-flex flex-column">
                <span className="fw-bold text-dark mb-1" style={{ fontSize: "0.72rem" }}>
                  Mes
                </span>
                <Form.Select
                  size="sm"
                  value={mesSemana}
                  onChange={(e) => elegirMes(e.target.value)}
                  className="rounded-3"
                  style={{ fontSize: "0.82rem", height: "32px", width: 150 }}
                >
                  {mesesElegibles.map((m) => (
                    <option key={m} value={m}>
                      {nombreMes(m)}
                    </option>
                  ))}
                </Form.Select>
              </div>
              <div className="d-flex flex-column">
                <span className="fw-bold text-dark mb-1" style={{ fontSize: "0.72rem" }}>
                  Semana
                </span>
                <Form.Select
                  size="sm"
                  value={semana}
                  onChange={(e) => setSemana(e.target.value)}
                  className="rounded-3"
                  style={{ fontSize: "0.82rem", height: "32px", width: 170 }}
                >
                  {semanasDelMes.map((v) => (
                    <option key={v} value={v}>
                      vie {ddmm(v)} al jue {ddmm(masDias(v, 6))}
                    </option>
                  ))}
                </Form.Select>
              </div>
            <FiltroSelect
              etiqueta="Concepto"
              ancho={140}
              valor={filtroConcepto}
              vacio="Todos"
              onChange={setFiltroConcepto}
              opciones={["Ingreso", "Gasto"]}
            />
            <div className="d-flex align-items-end gap-2 ms-auto flex-wrap">
              {[
                ["Entradas", ingresosSemana, "#15803d", "+ "],
                ["Gastos", gastosSemana, "#dc2626", "− "],
                ["Saldo", saldoSemana, saldoSemana < 0 ? "#dc2626" : COLOR, ""],
              ].map(([titulo, valor, color, signo]) => (
                <div
                  key={titulo}
                  className="d-flex flex-column align-items-center justify-content-center rounded-3 px-2"
                  style={{ border: `1px solid ${titulo === "Saldo" ? color : "#cbd5e1"}`, minHeight: 50, minWidth: 104 }}
                >
                  <span style={{ fontSize: "0.66rem", color: "#64748b", fontWeight: 600 }}>{titulo} semana</span>
                  <span className="fw-bold" style={{ fontSize: "0.9rem", color, whiteSpace: "nowrap" }}>
                    {signo}
                    {pesos(valor)}
                  </span>
                  {((titulo === "Entradas" && anteriorSemana > 0) || (titulo === "Gastos" && anteriorSemana < 0)) && (
                    <span style={{ fontSize: "0.6rem", color: "#64748b", lineHeight: 1, whiteSpace: "nowrap" }}>
                      incl. {pesos(Math.abs(anteriorSemana))} anterior
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        </Card>

        {error && (
          <div className="alert alert-danger py-2" style={{ fontSize: "0.85rem" }}>
            {error}
          </div>
        )}

        {/* La tabla, con el scroll adentro del marco. */}
        <div
          className="shadow-sm rounded-3 bg-white"
          style={{ flex: "0 1 auto", minHeight: 0, overflowY: "auto", overflowX: "auto", border: "1px solid #cbd5e1" }}
        >
          <Table className="mb-0 tabla-informe" style={{ width: "100%" }}>
            <thead style={{ position: "sticky", top: 0, zIndex: 10, backgroundColor: COLOR }}>
              <tr>
                <th style={{ ...th, width: 80 }}>Fecha</th>
                <th style={{ ...th, width: 80 }}>Concepto</th>
                <th style={{ ...th, width: 120 }}>Monto</th>
                <th style={{ ...th, textAlign: "left" }}>Descripción</th>
                <th style={{ ...th, width: 80 }}>Adjunto</th>
                <th style={{ ...th, textAlign: "left" }}>Observaciones</th>
                <th style={{ ...th, width: 70 }}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {!movimientos ? (
                <tr>
                  <td colSpan={columnas} className="text-center text-muted py-4" style={td}>
                    Cargando…
                  </td>
                </tr>
              ) : !filtrados.length ? (
                <tr>
                  <td colSpan={columnas} className="text-center text-muted py-4" style={td}>
                    {hayFiltro ? "Ningún movimiento coincide con los filtros" : "No hay movimientos cargados"}
                  </td>
                </tr>
              ) : (
                filtrados.map((m) => {
                  const c = CONCEPTOS[m.concepto] || CONCEPTOS.gasto;
                  return (
                    <tr key={m._id}>
                      <td style={{ ...td, textAlign: "center", whiteSpace: "nowrap" }}>{dmy(m.fecha)}</td>
                      <td style={{ ...td, textAlign: "center", fontWeight: 600, color: c.color }}>{c.texto}</td>
                      <td style={{ ...td, textAlign: "center", whiteSpace: "nowrap", fontWeight: 600, color: c.color }}>
                        {c.signo}
                        {pesos(m.monto)}
                      </td>
                      <td style={{ ...td, whiteSpace: "pre-wrap" }}>{m.descripcion || raya}</td>
                      <td style={{ ...td, textAlign: "center" }}>
                        {m.archivos?.length ? (
                          <div className="d-flex justify-content-center flex-wrap" style={{ gap: 6 }}>
                            {m.archivos.map((a, j) =>
                              a.subiendo ? (
                                <Spinner
                                  key={j}
                                  animation="border"
                                  size="sm"
                                  style={{ width: "0.8rem", height: "0.8rem", color: "#0e7490" }}
                                  title={`Subiendo ${a.nombre}`}
                                />
                              ) : (
                                <a key={j} href={a.url} target="_blank" rel="noreferrer" title={a.nombre || "Adjunto"}>
                                  <i
                                    className={`bi ${a.tipo === "image" ? "bi-image" : "bi-file-earmark-text"}`}
                                    style={{ fontSize: "0.9rem", color: "#0e7490" }}
                                  ></i>
                                </a>
                              )
                            )}
                          </div>
                        ) : (
                          raya
                        )}
                      </td>
                      <td style={{ ...td, whiteSpace: "pre-wrap" }}>{m.observaciones || raya}</td>
                      <td style={td}>
                        <div className="d-flex justify-content-center align-items-center" style={{ gap: 10 }}>
                          <button
                            onClick={() => abrir(m)}
                            disabled={sinEditar || m.pendiente}
                            className="btn btn-sm btn-outline-primary d-flex align-items-center justify-content-center rounded-2 p-0"
                            style={{ width: 24, height: 24 }}
                            title={sinEditar ? "Sin permiso para editar" : m.pendiente ? "Guardando…" : "Editar"}
                          >
                            <i className="bi bi-pencil" style={{ fontSize: "0.8rem" }}></i>
                          </button>
                          <button
                            onClick={() => borrar(m)}
                            disabled={sinEditar || m.pendiente}
                            className="btn btn-sm btn-outline-danger d-flex align-items-center justify-content-center rounded-2 p-0"
                            style={{ width: 24, height: 24 }}
                            title={sinEditar ? "Sin permiso para editar" : m.pendiente ? "Guardando…" : "Borrar"}
                          >
                            <i className="bi bi-trash" style={{ fontSize: "0.8rem" }}></i>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
              {/* El total, solo con algún filtro puesto (como en Gasoil del Sistema de Gestión Lepa). */}
              {hayFiltro && filtrados.length > 0 && (
                <tr className="fila-total">
                  <td colSpan={2} style={{ ...td, fontWeight: 700, color: "#1b4332" }}>
                    TOTAL ({filtrados.length} {filtrados.length === 1 ? "movimiento" : "movimientos"})
                  </td>
                  <td style={{ ...td, textAlign: "center", whiteSpace: "nowrap", fontWeight: 700 }}>
                    {totalIngresos > 0 && <div style={{ color: "#15803d" }}>+ {pesos(totalIngresos)}</div>}
                    {totalGastos > 0 && <div style={{ color: "#dc2626" }}>− {pesos(totalGastos)}</div>}
                  </td>
                  <td colSpan={columnas - 3} style={td}></td>
                </tr>
              )}
            </tbody>
          </Table>
        </div>
      </Container>

      {/* Alta o edición de un movimiento. */}
      <Modal show={Boolean(editando)} onHide={cerrar} centered contentClassName="border-0 shadow-lg rounded-4">
        {editando && (
          <Form onSubmit={guardar}>
            <Modal.Header
              closeButton
              closeVariant="white"
              style={{ backgroundColor: COLOR, color: "#fff", borderTopLeftRadius: "1rem", borderTopRightRadius: "1rem" }}
            >
              <Modal.Title style={{ fontSize: "1rem" }}>{editando.original ? "Editar movimiento" : "Nuevo movimiento"}</Modal.Title>
            </Modal.Header>
            <Modal.Body className="d-flex flex-column gap-3">
              {/* Concepto: dos botones, ingreso o gasto. */}
              <div className="d-flex gap-2">
                {Object.entries(CONCEPTOS).map(([valor, c]) => {
                  const activo = editando.form.concepto === valor;
                  return (
                    <button
                      key={valor}
                      type="button"
                      onClick={() => cambiar("concepto", valor)}
                      className="btn btn-sm flex-fill fw-semibold"
                      style={{
                        borderRadius: 10,
                        backgroundColor: activo ? c.color : "#fff",
                        borderColor: c.color,
                        color: activo ? "#fff" : c.color,
                      }}
                    >
                      {c.texto}
                    </button>
                  );
                })}
              </div>
              <div className="d-flex gap-3">
                <Form.Group style={{ flex: 1 }}>
                  <Form.Label className="fw-semibold small mb-1">
                    Fecha <span className="text-danger">*</span>
                  </Form.Label>
                  <Form.Control type="date" value={editando.form.fecha} onChange={(e) => cambiar("fecha", e.target.value)} />
                </Form.Group>
                <Form.Group style={{ flex: 1 }}>
                  <Form.Label className="fw-semibold small mb-1">
                    Monto <span className="text-danger">*</span>
                  </Form.Label>
                  <Form.Control
                    type="text"
                    inputMode="decimal"
                    autoFocus
                    value={editando.form.monto}
                    onChange={(e) => cambiar("monto", formatearMonto(e.target.value))}
                  />
                </Form.Group>
              </div>
              <Form.Group>
                <Form.Label className="fw-semibold small mb-1">
                  Descripción <span className="text-danger">*</span>
                </Form.Label>
                <Form.Control
                  type="text"
                  maxLength={300}
                  value={editando.form.descripcion}
                  onChange={(e) => cambiar("descripcion", e.target.value)}
                />
              </Form.Group>
              <Form.Group>
                <Form.Label className="fw-semibold small mb-1">Observaciones</Form.Label>
                <Form.Control
                  as="textarea"
                  rows={2}
                  maxLength={1000}
                  value={editando.form.observaciones}
                  onChange={(e) => cambiar("observaciones", e.target.value)}
                />
              </Form.Group>
              <Form.Group>
                <Form.Label className="fw-semibold small mb-1">Adjunto</Form.Label>
                <div className="d-flex flex-column gap-1 mb-2">
                  {editando.form.archivos.map((a, i) => (
                    <div key={i} className="d-flex align-items-center gap-2" style={{ fontSize: "0.8rem" }}>
                      <i className={`bi ${a.tipo === "image" ? "bi-image" : "bi-file-earmark-text"}`} style={{ color: "#0e7490" }}></i>
                      <a href={a.url} target="_blank" rel="noreferrer" className="text-truncate" style={{ maxWidth: 320 }}>
                        {a.nombre || "Adjunto"}
                      </a>
                      <button
                        type="button"
                        className="btn btn-link p-0 ms-auto"
                        onClick={() => sacarArchivo(a)}
                        title="Sacar el adjunto"
                        style={{ color: "#dc2626", lineHeight: 1 }}
                      >
                        <i className="bi bi-x-lg"></i>
                      </button>
                    </div>
                  ))}
                  {subidas
                    .filter((x) => !x.sacada)
                    .map((x) => (
                      <div key={x.clave} className="d-flex align-items-center gap-2" style={{ fontSize: "0.8rem" }}>
                        {x.fallo ? (
                          <i className="bi bi-exclamation-triangle-fill" style={{ color: "#dc2626" }}></i>
                        ) : x.archivo ? (
                          <i className="bi bi-check-circle-fill" style={{ color: "#15803d" }}></i>
                        ) : (
                          <Spinner animation="border" size="sm" style={{ width: "0.8rem", height: "0.8rem", color: "#0e7490" }} />
                        )}
                        <span className="text-truncate" style={{ maxWidth: 320, color: x.fallo ? "#dc2626" : undefined }}>
                          {x.nombre}
                          {x.fallo ? " (no se subió)" : x.archivo ? "" : " (subiendo…)"}
                        </span>
                        <button
                          type="button"
                          className="btn btn-link p-0 ms-auto"
                          onClick={() => sacarSubida(x.clave)}
                          title="Sacar el adjunto"
                          style={{ color: "#dc2626", lineHeight: 1 }}
                        >
                          <i className="bi bi-x-lg"></i>
                        </button>
                      </div>
                    ))}
                </div>
                {/* Se puede guardar sin esperar: lo que falta subir se agrega solo. */}
                <label className="btn btn-sm btn-outline-secondary d-inline-flex align-items-center gap-2" style={{ fontSize: "0.78rem", cursor: "pointer" }}>
                  <i className="bi bi-paperclip"></i>
                  Agregar foto o archivo
                  <input type="file" multiple hidden accept="image/*,application/pdf,.doc,.docx,.xls,.xlsx" onChange={agregarArchivos} />
                </label>
              </Form.Group>
            </Modal.Body>
            <Modal.Footer className="border-0 pt-0">
              <Button variant="outline-secondary" size="sm" onClick={cerrar}>
                Cancelar
              </Button>
              <Button type="submit" size="sm" style={{ backgroundColor: COLOR, borderColor: COLOR }}>
                Guardar
              </Button>
            </Modal.Footer>
          </Form>
        )}
      </Modal>
    </div>
  );
}

export default ContableCaja;
