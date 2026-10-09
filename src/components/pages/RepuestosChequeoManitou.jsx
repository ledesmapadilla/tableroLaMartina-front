import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import Swal from "sweetalert2";
import { Container, Table, Form } from "react-bootstrap";
import { api } from "../../services/api";
import { cosechaDeParam } from "../../utils/cosechas";
import { SISTEMAS_MANITOU, MANITOUS_DESPLEGADAS, seccionManitou, unidadManitouValida } from "../../utils/sistemasManitou";
import { usePermisos } from "../../context/permisos";
import NavbarSanPablo from "../shared/NavbarSanPablo";
import TractorIcon from "../shared/TractorIcon";
import Error404 from "./Error404";
import { campo, th as thBase, td, tdCentro } from "../compras/formato";
import { Raya, BotonAccion } from "../compras/estilos";
import { fmtNro } from "../compras/nroPedido";
import { exportarPlanilla } from "../../helpers/excel";
import { fmtPresupuesto } from "../compras/presupuestos";
import { opcionElegida } from "../compras/precioElegido";

// Los mismos colores que la tabla de chequeo del sistema.
const COLOR = "#1e293b";
const COLOR_SUAVE = "#f1f5f9";
const VERDE = "#047857";
const ROJO = "#dc2626";
const th = { ...thBase, backgroundColor: COLOR };
const thCentro = { ...th, textAlign: "center" };

const URGENCIAS = ["Baja", "Media", "Alta", "Crítica"];
// La urgencia arranca en Baja; se cambia si hace falta.
const REPUESTO_INIT = { nombre_repuesto: "", cant: "", unidad: "", urgencia: "Baja", descripcion: "" };

const fmtPrecio = (v) =>
  new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 2 }).format(v);

// El precio unitario que cotizó el analista (el proveedor que vale), o null
// mientras no esté cotizado o la cotización no tenga precio.
const precioCotizado = (p) => (p?.estado === "Cotizado" ? opcionElegida(p)?.precio ?? null : null);

const estadoRepuesto = (r) =>
  r.pedido && r.nro_pedido ? `Pedido ${fmtNro(r.nro_pedido, "sanpablo", "reparaciones")}` : r.pedido ? "Pedido" : "Sin pedir";

/**
 * Los repuestos de un ítem de una Manitou o de General (08/10/2026): una hoja
 * propia, con la tabla de lo cargado y un renglón al pie para ir sumando.
 * Guardar lo anota en la fila sin pedirlo; Pedir genera el pedido en Compras
 * (San Pablo, grupo Manitou). Uno guardado se corrige en su renglón o se pide
 * desde ahí; uno pedido queda fijo y se sigue en Compras.
 */
export default function RepuestosChequeoManitou() {
  const { cosecha: param, unidad, sistema: idSistema, fila: idFila } = useParams();
  // General es la plantilla: ahí se cargan, corrigen y borran, y el back lo
  // copia a cada Manitou. En una Manitou, de lo copiado solo se cambia la
  // cantidad; ahí se cotiza y se pide, con el C.C. de la unidad (09/10/2026).
  const esGeneral = unidad === "general";
  const raiz = `/reparaciones/sanpablo/${param}/manitous/${unidad}`;
  const cosecha = cosechaDeParam(param);
  const sistema = unidadManitouValida(unidad) ? SISTEMAS_MANITOU.find((s) => s.id === idSistema) : null;
  const { puede } = usePermisos();
  const sinEditar = !puede("sanpablo.ingresos", "editar");

  const [fila, setFila] = useState(null);
  const [cargando, setCargando] = useState(true);
  // El renglón que se escribe: uno nuevo al pie o, con `repuestoId`, uno
  // guardado que se corrige en su lugar.
  const [form, setForm] = useState({ ...REPUESTO_INIT });
  const [repuestoId, setRepuestoId] = useState(null);
  const [guardando, setGuardando] = useState(false);
  // Lo que ya se mandó a cotizar (Presupuestos reparaciones del analista),
  // por repuesto: { [repuestoId]: presupuesto }.
  const [presupuestos, setPresupuestos] = useState({});

  // No hay GET de una fila sola: sale de la tabla del sistema.
  useEffect(() => {
    if (!sistema) return;
    api
      .get(`/ingresos-sanpablo/chequeos?cosecha=${cosecha}&seccion=${seccionManitou(unidad)}&sistema=${idSistema}`)
      .then((data) => setFila((Array.isArray(data) ? data : []).find((f) => f._id === idFila) || null))
      .catch(() => setFila(null))
      .finally(() => setCargando(false));
  }, [cosecha, unidad, idSistema, idFila, sistema]);

  useEffect(() => {
    api
      .get(`/presupuestos-reparaciones?chequeo=${idFila}`)
      .then((data) => setPresupuestos(Object.fromEntries((Array.isArray(data) ? data : []).map((p) => [p.repuesto, p]))))
      .catch(() => setPresupuestos({}));
  }, [idFila]);

  if (!sistema || (!cargando && !fila)) return <Error404 />;

  const ruta = `/ingresos-sanpablo/chequeos/${idFila}/repuestos`;
  const error = (titulo, err) => Swal.fire({ icon: "error", title: titulo, text: err.message, width: "300px" });

  const renglonNuevo = () => {
    setForm({ ...REPUESTO_INIT });
    setRepuestoId(null);
  };

  const avisarPedido = (r) =>
    Swal.fire({
      icon: "success",
      title: "Repuesto pedido",
      text: r?.nro_pedido ? `Pedido ${fmtNro(r.nro_pedido, "sanpablo", "reparaciones")} en Compras.` : undefined,
      timer: 1600,
      showConfirmButton: false,
      width: "300px",
    });

  // El aviso de éxito que se cierra solo (docs/formato-sweetalert.md).
  const avisar = (title) => Swal.fire({ icon: "success", title, timer: 1500, showConfirmButton: false, width: "300px" });

  const enviar = async (e) => {
    e.preventDefault();
    const pedirlo = e.nativeEvent.submitter?.value === "pedir";
    const datos = { ...form, cant: Number(form.cant), pedir: pedirlo };
    setGuardando(true);
    try {
      const nueva = repuestoId ? await api.put(`${ruta}/${repuestoId}`, datos) : await api.post(ruta, datos);
      setFila(nueva);
      renglonNuevo();
      if (pedirlo) avisarPedido(repuestoId ? nueva.repuestos.find((x) => x._id === repuestoId) : nueva.repuestos.at(-1));
      else avisar("Repuesto guardado");
    } catch (err) {
      error(pedirlo ? "No se pudo pedir" : "No se pudo guardar", err);
    } finally {
      setGuardando(false);
    }
  };

  // Pedir uno guardado sin abrirlo: va con lo que ya tiene.
  const pedirGuardado = async (r) => {
    setGuardando(true);
    try {
      const nueva = await api.put(`${ruta}/${r._id}`, {
        nombre_repuesto: r.nombre_repuesto,
        cant: r.cant,
        unidad: r.unidad,
        urgencia: r.urgencia,
        descripcion: r.descripcion || "",
        pedir: true,
      });
      setFila(nueva);
      if (repuestoId === r._id) renglonNuevo();
      avisarPedido(nueva.repuestos.find((x) => x._id === r._id));
    } catch (err) {
      error("No se pudo pedir", err);
    } finally {
      setGuardando(false);
    }
  };

  // ── Cotizar ──
  // Manda el repuesto a Presupuestos reparaciones, donde el analista lo
  // cotiza. Cada repuesto va una sola vez; de ahí en más se ve su estado.
  const mandarACotizar = async (lista) => {
    setGuardando(true);
    try {
      // De a uno: el número del presupuesto sale del último guardado.
      for (const r of lista) {
        const p = await api.post("/presupuestos-reparaciones", { chequeo: idFila, repuesto: r._id });
        setPresupuestos((m) => ({ ...m, [r._id]: p }));
      }
      Swal.fire({
        icon: "success",
        title: lista.length === 1 ? "Mandado a cotizar" : `${lista.length} repuestos mandados a cotizar`,
        text: "Lo cotiza el analista en Presupuestos reparaciones.",
        timer: 1800,
        showConfirmButton: false,
        width: "300px",
      });
    } catch (err) {
      error("No se pudo mandar a cotizar", err);
    } finally {
      setGuardando(false);
    }
  };

  const borrar = async (r) => {
    const { isConfirmed } = await Swal.fire({
      icon: "warning",
      title: "¿Borrar el repuesto?",
      text: esGeneral
        ? `${r.nombre_repuesto}. Se borra también de las Manitou, salvo donde ya se pidió o se mandó a cotizar.`
        : r.nombre_repuesto,
      width: "320px",
      showCancelButton: true,
      confirmButtonText: "Sí, borrar",
      cancelButtonText: "Cancelar",
      confirmButtonColor: ROJO,
      cancelButtonColor: "#64748b",
    });
    if (!isConfirmed) return;
    setGuardando(true);
    try {
      setFila(await api.delete(`${ruta}/${r._id}`));
      if (repuestoId === r._id) renglonNuevo();
      avisar("Repuesto borrado");
    } catch (err) {
      error("No se pudo borrar", err);
    } finally {
      setGuardando(false);
    }
  };

  const editar = (r) => {
    setRepuestoId(r._id);
    setForm({
      nombre_repuesto: r.nombre_repuesto,
      cant: String(r.cant),
      unidad: r.unidad,
      urgencia: r.urgencia,
      descripcion: r.descripcion || "",
    });
  };

  const cambiar = (campoForm, valor) => setForm((f) => ({ ...f, [campoForm]: valor }));

  // Los campos van atados al form por `form=`, porque un <form> no puede
  // envolver renglones de una tabla. De un repuesto copiado de General, en
  // la Manitou solo se escribe la cantidad: lo demás se ve como texto.
  const renglonForm = (nro) => {
    const control = { form: "form-repuesto", size: "sm", className: "rounded-3", style: { ...campo, fontSize: "0.76rem" } };
    const soloCant = Boolean(repuestos.find((r) => r._id === repuestoId)?.origen);
    const cancelar = repuestoId && (
      <button
        type="button"
        onClick={renglonNuevo}
        className="btn btn-link btn-sm p-0 text-secondary"
        style={{ fontSize: "0.72rem" }}
      >
        Cancelar
      </button>
    );
    const guardar = (
      <button
        type="submit"
        form="form-repuesto"
        value="guardar"
        disabled={guardando}
        className="btn btn-sm btn-outline-dark rounded-2 px-2 py-0"
        style={{ height: "24px", fontSize: "0.72rem", fontWeight: 600 }}
        title={esGeneral ? "Guardar (se copia a las Manitou)" : "Guardar sin pedir"}
      >
        Guardar
      </button>
    );
    return (
      <tr key={repuestoId || "nuevo"} style={{ backgroundColor: COLOR_SUAVE }}>
        <td style={{ ...tdCentro, color: "#94a3b8" }}>{nro}</td>
        <td style={{ ...td, padding: "3px 4px", fontWeight: soloCant ? 600 : undefined }}>
          {soloCant ? (
            form.nombre_repuesto
          ) : (
            <Form.Control
              {...control}
              value={form.nombre_repuesto}
              placeholder="Nombre de repuesto"
              onChange={(e) => cambiar("nombre_repuesto", e.target.value)}
              autoFocus
              required
            />
          )}
        </td>
        <td style={{ ...td, padding: "3px 4px" }}>
          <Form.Control
            {...control}
            type="number"
            min={1}
            step="any"
            value={form.cant}
            onChange={(e) => cambiar("cant", e.target.value)}
            autoFocus={soloCant}
            required
          />
        </td>
        <td style={soloCant ? tdCentro : { ...td, padding: "3px 4px" }}>
          {soloCant ? (
            form.unidad
          ) : (
            <Form.Control
              {...control}
              value={form.unidad}
              placeholder="Un, L…"
              onChange={(e) => cambiar("unidad", e.target.value)}
              required
            />
          )}
        </td>
        {/* El C.C. es el de la Manitou; General no lleva. */}
        {!esGeneral && <td style={tdCentro}>{unidad}</td>}
        <td style={soloCant ? tdCentro : { ...td, padding: "3px 4px" }}>
          {soloCant ? (
            form.urgencia
          ) : (
            <Form.Select {...control} value={form.urgencia} onChange={(e) => cambiar("urgencia", e.target.value)} required>
              <option value="">Urgencia</option>
              {URGENCIAS.map((u) => (
                <option key={u} value={u}>
                  {u}
                </option>
              ))}
            </Form.Select>
          )}
        </td>
        <td style={soloCant ? td : { ...td, padding: "3px 4px" }}>
          {soloCant ? (
            form.descripcion || <Raya />
          ) : (
            <Form.Control
              {...control}
              value={form.descripcion}
              placeholder="Opcional"
              onChange={(e) => cambiar("descripcion", e.target.value)}
            />
          )}
        </td>
        {esGeneral ? (
          <td style={tdCentro}>
            <div className="d-flex justify-content-center align-items-center" style={{ gap: "8px" }}>
              {cancelar}
              {guardar}
            </div>
          </td>
        ) : (
          <>
            <td style={tdCentro}>{cancelar}</td>
            <td style={tdCentro}></td>
            <td style={tdCentro}></td>
            <td style={tdCentro}>
              {/* Guardar lo deja en la fila sin pedir; Pedir lo manda a Compras. */}
              <div className="d-flex justify-content-center align-items-center" style={{ gap: "6px" }}>
                {guardar}
                <button
                  type="submit"
                  form="form-repuesto"
                  value="pedir"
                  disabled={guardando}
                  className="btn btn-sm btn-success rounded-2 px-2 py-0 d-flex align-items-center gap-1"
                  style={{ height: "24px", fontSize: "0.72rem", fontWeight: 600 }}
                  title="Pedirlo a Compras"
                >
                  <span>Pedir</span>
                  <i className="bi bi-send-fill" style={{ fontSize: "0.7rem" }}></i>
                </button>
              </div>
            </td>
          </>
        )}
      </tr>
    );
  };

  const repuestos = fila?.repuestos || [];
  const sinCotizar = repuestos.filter((r) => !presupuestos[r._id]);
  const totalDe = (r) => {
    const precio = precioCotizado(presupuestos[r._id]);
    return precio === null ? null : precio * r.cant;
  };
  const totalGeneral = repuestos.reduce((acc, r) => acc + (totalDe(r) ?? 0), 0);
  const sinPrecio = repuestos.filter((r) => totalDe(r) === null).length;

  // General no lleva C.C., estado, precios ni total: es la plantilla.
  const columnas = esGeneral ? 7 : 11;
  const nombreUnidad = esGeneral ? "Manitous General" : `Manitou ${unidad}`;

  // La planilla sigue la tabla: mismas columnas y mismo orden.
  const exportarExcel = () =>
    exportarPlanilla({
      titulo: `Reparaciones San Pablo — ${nombreUnidad} · ${sistema.titulo} · ${fila?.item || ""} — Cosecha ${param}`,
      columnas: esGeneral
        ? [
            { titulo: "#", ancho: 6 },
            { titulo: "Repuesto", ancho: 32 },
            { titulo: "Cant.", ancho: 8 },
            { titulo: "Un.", ancho: 8 },
            { titulo: "Urgencia", ancho: 11 },
            { titulo: "Descripción", ancho: 40 },
          ]
        : [
            { titulo: "#", ancho: 6 },
            { titulo: "Repuesto", ancho: 32 },
            { titulo: "Cant.", ancho: 8 },
            { titulo: "Un.", ancho: 8 },
            { titulo: "C.C.", ancho: 10 },
            { titulo: "Urgencia", ancho: 11 },
            { titulo: "Descripción", ancho: 40 },
            { titulo: "Estado", ancho: 16 },
            { titulo: "Precio unit. sin IVA", ancho: 18, moneda: true },
            { titulo: "Total sin IVA", ancho: 16, moneda: true },
          ],
      filas: esGeneral
        ? repuestos.map((r, idx) => [idx + 1, r.nombre_repuesto, r.cant, r.unidad, r.urgencia, r.descripcion || ""])
        : repuestos
            .map((r, idx) => [
              idx + 1,
              r.nombre_repuesto,
              r.cant,
              r.unidad,
              r.cc,
              r.urgencia,
              r.descripcion || "",
              estadoRepuesto(r),
              precioCotizado(presupuestos[r._id]) ?? "",
              totalDe(r) ?? "",
            ])
            .concat(repuestos.length ? [["TOTAL", "", "", "", "", "", "", "", "", totalGeneral]] : []),
      hoja: "Repuestos",
      archivo: `sanpablo_manitou_repuestos_${unidad}_${idSistema}_${param}_${new Date().toISOString().slice(0, 10)}.xlsx`,
    });

  return (
    <div
      style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        backgroundColor: "#f8f9fa",
        height: "100%",
        maxHeight: "100vh",
        overflow: "hidden",
      }}
    >
      <NavbarSanPablo
        icono={<i className="bi bi-box-seam"></i>}
        volverA={MANITOUS_DESPLEGADAS.includes(unidad) ? `${raiz}#${idSistema}` : `${raiz}/${idSistema}`}
      />

      <Container
        fluid
        className="px-3 py-3 d-flex flex-column flex-grow-1"
        style={{ maxWidth: esGeneral ? "980px" : "1360px", width: "100%", margin: "0 auto", overflow: "hidden" }}
      >
        {/* Encabezado: el ítem, con la Manitou, el sistema y la cosecha debajo. */}
        <div
          className="d-flex align-items-center gap-3 mb-3 pb-2 flex-wrap"
          style={{ borderBottom: `3px solid ${VERDE}` }}
        >
          <div
            className="d-flex align-items-center justify-content-center"
            style={{
              width: "44px",
              height: "44px",
              borderRadius: "12px",
              background: "linear-gradient(135deg, #064e3b 0%, #047857 100%)",
              boxShadow: "0 6px 16px rgba(4, 120, 87, 0.35)",
              flexShrink: 0,
            }}
          >
            <TractorIcon size="1.6rem" color="#fff" />
          </div>
          <div style={{ minWidth: 0 }}>
            <div className="fw-bold" style={{ fontSize: "1.5rem", lineHeight: 1, color: VERDE, letterSpacing: "0.02em" }}>
              REPUESTOS · {(fila?.item || "").toUpperCase()}
            </div>
            <div className="text-secondary fw-semibold" style={{ fontSize: "0.82rem" }}>
              {esGeneral ? "General (plantilla)" : `Manitou ${unidad}`} · {sistema.titulo} · Cosecha {param}
            </div>
          </div>
          <div className="ms-auto" />
          <button
            type="button"
            onClick={exportarExcel}
            disabled={repuestos.length === 0}
            className="btn btn-sm rounded-3 px-3 d-flex align-items-center gap-2"
            style={{ backgroundColor: "#15803d", borderColor: "#15803d", color: "#fff", fontSize: "0.78rem", height: "30px", fontWeight: 600 }}
            title="Exportar a Excel"
          >
            <i className="bi bi-file-earmark-excel-fill"></i>
            <span>Excel</span>
          </button>
        </div>

        {/* Cotizar todos: manda los que todavía no se mandaron. En General
            no se cotiza: es la plantilla. */}
        {!esGeneral && (
          <div className="d-flex justify-content-end mb-2">
            <button
              type="button"
              onClick={() => mandarACotizar(sinCotizar)}
              disabled={sinEditar || guardando || sinCotizar.length === 0}
              title={
                sinEditar
                  ? "Sin permiso para editar"
                  : sinCotizar.length === 0
                    ? "Todos los repuestos ya se mandaron a cotizar"
                    : `Mandar a cotizar ${sinCotizar.length === 1 ? "el repuesto que falta" : `los ${sinCotizar.length} que faltan`}`
              }
              className="btn btn-sm rounded-3 px-3 d-flex align-items-center gap-2"
              style={{ backgroundColor: COLOR, borderColor: COLOR, color: "#fff", fontSize: "0.78rem", height: "30px", fontWeight: 600 }}
            >
              <i className="bi bi-currency-dollar"></i>
              <span>Cotizar</span>
            </button>
          </div>
        )}

        <Form id="form-repuesto" onSubmit={enviar} />
        <div
          className="shadow-sm rounded-3 bg-white"
          style={{
            flex: "0 1 auto",
            minHeight: 0,
            maxWidth: "100%",
            overflow: "auto",
            border: "1px solid #cbd5e1",
          }}
        >
          <Table className="mb-0 tabla-informe" style={{ width: "100%", minWidth: esGeneral ? "760px" : "1150px" }}>
            <thead style={{ position: "sticky", top: 0, zIndex: 1 }}>
              <tr>
                <th style={{ ...thCentro, width: "36px" }}>#</th>
                <th style={{ ...th, minWidth: "220px" }}>Repuesto</th>
                <th style={{ ...thCentro, width: "56px" }}>Cant.</th>
                <th style={{ ...thCentro, width: "56px" }}>Un.</th>
                {!esGeneral && <th style={{ ...thCentro, width: "72px" }}>C.C.</th>}
                <th style={{ ...thCentro, width: "86px" }}>Urgencia</th>
                <th style={{ ...th, minWidth: "220px" }}>Descripción</th>
                {!esGeneral && (
                  <>
                    <th style={{ ...thCentro, width: "100px" }}>Estado</th>
                    <th style={{ ...thCentro, width: "104px" }}>Precio unit. sin IVA</th>
                    <th style={{ ...thCentro, width: "96px" }}>Total sin IVA</th>
                  </>
                )}
                <th style={{ ...thCentro, width: esGeneral ? "130px" : "150px" }}></th>
              </tr>
            </thead>
            <tbody>
              {cargando ? (
                <tr>
                  <td colSpan={columnas} className="text-center text-muted py-4" style={td}>
                    Cargando…
                  </td>
                </tr>
              ) : (
                <>
                  {repuestos.map((r, idx) =>
                    repuestoId === r._id ? (
                      renglonForm(idx + 1)
                    ) : (
                      <tr key={r._id}>
                        <td style={{ ...tdCentro, color: "#94a3b8" }}>{idx + 1}</td>
                        <td style={{ ...td, fontWeight: 600 }}>{r.nombre_repuesto}</td>
                        <td style={tdCentro}>{r.cant}</td>
                        <td style={tdCentro}>{r.unidad}</td>
                        {!esGeneral && <td style={tdCentro}>{r.cc}</td>}
                        <td style={tdCentro}>{r.urgencia}</td>
                        <td style={td}>{r.descripcion || <Raya />}</td>
                        {!esGeneral && (
                          <>
                            <td style={tdCentro}>
                              <span
                                className="px-1 rounded-1"
                                style={{
                                  backgroundColor: r.pedido ? "#dcfce7" : "#fef3c7",
                                  color: r.pedido ? "#15803d" : "#b45309",
                                  fontSize: "0.66rem",
                                  fontWeight: 700,
                                }}
                                title={r.solicita ? `Pidió ${r.solicita}` : undefined}
                              >
                                {estadoRepuesto(r)}
                              </span>
                            </td>
                            {/* Precio: el unitario de la cotización del analista, y el
                                total por la cantidad. Sin IVA, como cotiza el analista. */}
                            <td style={tdCentro}>
                              {precioCotizado(presupuestos[r._id]) !== null ? fmtPrecio(precioCotizado(presupuestos[r._id])) : <Raya />}
                            </td>
                            <td style={tdCentro}>{totalDe(r) !== null ? fmtPrecio(totalDe(r)) : <Raya />}</td>
                          </>
                        )}
                        <td style={tdCentro}>
                          <div className="d-flex justify-content-center align-items-center" style={{ gap: "6px" }}>
                            {/* Cotizar va en todos los renglones de una Manitou; ya
                                mandado, queda su estado en Presupuestos reparaciones. */}
                            {esGeneral ? null : presupuestos[r._id] ? (
                              <span
                                className="px-1 rounded-1"
                                style={{
                                  backgroundColor: presupuestos[r._id].estado === "Cotizado" ? "#dcfce7" : "#e0e7ff",
                                  color: presupuestos[r._id].estado === "Cotizado" ? "#15803d" : "#3730a3",
                                  fontSize: "0.66rem",
                                  fontWeight: 700,
                                  whiteSpace: "nowrap",
                                }}
                                title={`Presupuesto ${fmtPresupuesto(presupuestos[r._id].nro)}`}
                              >
                                {presupuestos[r._id].estado}
                              </span>
                            ) : (
                              <button
                                type="button"
                                onClick={() => mandarACotizar([r])}
                                disabled={sinEditar || guardando}
                                className="btn btn-sm rounded-2 px-2 py-0"
                                style={{ height: "24px", fontSize: "0.72rem", fontWeight: 600, backgroundColor: COLOR, borderColor: COLOR, color: "#fff" }}
                                title={sinEditar ? "Sin permiso para editar" : "Mandarlo a cotizar"}
                              >
                                Cotizar
                              </button>
                            )}
                            {/* Lo pedido se sigue en Compras: acá ya no se toca. */}
                            {!r.pedido && (
                              <>
                                {!esGeneral && (
                                  <BotonAccion
                                    icono="bi-send"
                                    titulo={sinEditar ? "Sin permiso para editar" : "Pedirlo a Compras"}
                                    variante="success"
                                    onClick={() => pedirGuardado(r)}
                                    deshabilitado={sinEditar || guardando}
                                  />
                                )}
                                <BotonAccion
                                  icono="bi-pencil"
                                  titulo={sinEditar ? "Sin permiso para editar" : r.origen ? "Cambiar la cantidad" : "Corregir"}
                                  variante="primary"
                                  onClick={() => editar(r)}
                                  deshabilitado={sinEditar || guardando}
                                />
                                {/* Lo copiado de General se borra en General. */}
                                {!r.origen && (
                                  <BotonAccion
                                    icono="bi-trash"
                                    titulo={sinEditar ? "Sin permiso para editar" : "Borrar"}
                                    variante="danger"
                                    onClick={() => borrar(r)}
                                    deshabilitado={sinEditar || guardando}
                                  />
                                )}
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    )
                  )}
                  {/* El renglón para cargar uno nuevo, mientras no se corrige
                      otro. Solo en General: de ahí se copia a las Manitou. */}
                  {esGeneral && !sinEditar && !repuestoId && renglonForm(repuestos.length + 1)}
                  {/* El total de lo cotizado; lo que falta cotizar no suma. */}
                  {!esGeneral && repuestos.length > 0 && (
                    <tr className="fila-total">
                      <td colSpan={2} style={{ ...td, fontWeight: 700, color: COLOR }}>
                        TOTAL
                        {sinPrecio > 0 && (
                          <span className="ms-2 text-muted fw-normal" style={{ fontSize: "0.7rem" }}>
                            {sinPrecio === 1 ? "1 repuesto sin cotizar" : `${sinPrecio} repuestos sin cotizar`}
                          </span>
                        )}
                      </td>
                      <td colSpan={7} style={td}></td>
                      <td style={{ ...tdCentro, fontWeight: 700, color: COLOR }}>{fmtPrecio(totalGeneral)}</td>
                      <td style={td}></td>
                    </tr>
                  )}
                  {(sinEditar || !esGeneral) && repuestos.length === 0 && (
                    <tr>
                      <td colSpan={columnas} className="text-center text-muted py-4" style={td}>
                        {esGeneral ? "Sin repuestos." : "Sin repuestos. Se cargan en General."}
                      </td>
                    </tr>
                  )}
                </>
              )}
            </tbody>
          </Table>
        </div>
      </Container>
    </div>
  );
}
