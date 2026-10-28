import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import Swal from "sweetalert2";
import { Container, Table, Button, Form, Modal, Row, Col } from "react-bootstrap";
import { api } from "../../services/api";
import { usePermisos } from "../../context/permisos";
import { cosechaDeParam } from "../../utils/cosechas";
import { compararCC } from "../../utils/ordenCC";
import NavbarSanPablo from "../shared/NavbarSanPablo";
import { campo, th as thBase, td, tdCentro } from "../compras/formato";
import { Raya, BotonAccion } from "../compras/estilos";

// Los colores de Carros porta escaleras / Escaleras (IngresosEscaleras).
const COLOR = "#1e293b";
const COLOR_SUAVE = "#f1f5f9";
const ROJO = "#dc2626";
const VERDE = "#15803d";
const th = { ...thBase, backgroundColor: COLOR };
const thCentro = { ...th, textAlign: "center" };

const EQUIPO_CARRO = "Carro porta escaleras";

const hoy = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
// La fecha es un día sin hora y viaja como 00:00 UTC.
const aInput = (iso) => (iso ? String(iso).slice(0, 10) : "");
const fechaCorta = (iso) => {
  const [a, m, d] = aInput(iso).split("-");
  return a ? `${d}/${m}/${a}` : "";
};
const numeroOVacio = (v) => (v === null || v === undefined ? "" : v);
const suma = (lista, campoNum) => lista.reduce((s, i) => s + (i[campoNum] || 0), 0);
const sale = (i) => i.retiro || i.baja;

/**
 * Reparación de Carros porta escaleras / Escaleras (28/10/2026), desde el
 * botón "Reparación". Dos solapas:
 *  - Carros porta escaleras: todos los carros del padrón de CC, uno por fila,
 *    con la fecha, los trabajos a realizar y observaciones de su reparación
 *    en la cosecha (una por carro).
 *  - Escaleras: las reparaciones de escaleras (fecha, cuántas, quién repara y
 *    observaciones) y la fila de Rotas (el estado inicial), con lo acumulado
 *    de rotas y reparadas.
 * Cada solapa tiene una sola fecha límite, arriba de la tabla.
 */
export default function ReparacionEscaleras() {
  const cosecha = cosechaDeParam(useParams().cosecha);
  const { puede } = usePermisos();
  const sinEditar = !puede("sanpablo.ingresos", "editar");

  const [solapa, setSolapa] = useState("carros");
  const [cargando, setCargando] = useState(true);
  const [carros, setCarros] = useState([]);
  // { [id del CC]: reparación }.
  const [repCarros, setRepCarros] = useState({});
  // Todas las filas de Escaleras: las reparaciones van en la tabla y el resto
  // cuenta para no reparar más de las rotas.
  const [escaleras, setEscaleras] = useState([]);
  // La fecha límite de cada solapa, "AAAA-MM-DD" o "".
  const [fechasLimite, setFechasLimite] = useState({ carros: "", escaleras: "" });

  // El modal: "carro", "reparacion" o "estadoInicial"; lo que se edita y el
  // formulario.
  const [modo, setModo] = useState(null);
  const [editando, setEditando] = useState(null);
  const [form, setForm] = useState(null);
  const [guardando, setGuardando] = useState(false);

  const cargarCarros = () =>
    api
      .get(`/ingresos-sanpablo/reparaciones-carros?cosecha=${cosecha}`)
      .then((lista) => setRepCarros(Object.fromEntries((Array.isArray(lista) ? lista : []).map((r) => [r.cc, r]))))
      .catch(() => setRepCarros({}));

  const cargarEscaleras = () =>
    api
      .get(`/ingresos-sanpablo?cosecha=${cosecha}&tipo=escaleras`)
      .then((data) => setEscaleras(Array.isArray(data) ? data : []))
      .catch(() => setEscaleras([]));

  useEffect(() => {
    api
      .get(`/ingresos-sanpablo/fecha-limite-escaleras?cosecha=${cosecha}`)
      .then((r) => setFechasLimite({ carros: aInput(r.carros), escaleras: aInput(r.escaleras) }))
      .catch(() => setFechasLimite({ carros: "", escaleras: "" }));
    Promise.all([
      cargarCarros(),
      cargarEscaleras(),
      api
        .get("/centros-costo")
        .then((data) =>
          setCarros(
            (Array.isArray(data) ? data : [])
              .filter((c) => (c.equipo || "").trim() === EQUIPO_CARRO)
              .sort((a, b) => compararCC(a.cc, b.cc))
          )
        )
        .catch(() => setCarros([])),
    ]).finally(() => setCargando(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cosecha]);

  const reparaciones = escaleras.filter((i) => i.reparacion);
  const clasificadas = escaleras.filter((i) => !i.nuevas && !sale(i) && !i.reparacion);

  // De la más vieja a la más nueva, con lo que se va sumando de rotas y
  // reparadas en cada fila.
  const reparacionesAcumuladas = (() => {
    let rotasHasta = 0;
    let reparadasHasta = 0;
    return [...reparaciones]
      .sort(
        (a, b) =>
          aInput(a.fechaIngreso).localeCompare(aInput(b.fechaIngreso)) ||
          String(a.createdAt || "").localeCompare(String(b.createdAt || ""))
      )
      .map((i) => {
        rotasHasta += i.escalerasRotas || 0;
        reparadasHasta += i.escalerasReparadas || 0;
        return { ...i, rotasHasta, reparadasHasta };
      });
  })();

  // Se guarda al elegirla; vacía la borra.
  const guardarFechaLimite = async (valor) => {
    const anterior = fechasLimite[solapa];
    setFechasLimite((f) => ({ ...f, [solapa]: valor }));
    try {
      await api.put("/ingresos-sanpablo/fecha-limite-escaleras", { cosecha, solapa, fecha: valor || null });
    } catch (err) {
      setFechasLimite((f) => ({ ...f, [solapa]: anterior }));
      Swal.fire({ icon: "error", title: "No se pudo guardar", text: err.message, width: "300px" });
    }
  };

  // ── Modal ──
  const abrirCarro = (c) => {
    const r = repCarros[c._id];
    setModo("carro");
    setEditando(c);
    setForm({
      fecha: r ? aInput(r.fecha) : hoy(),
      trabajos: r?.trabajos || "",
      observaciones: r?.observaciones || "",
    });
  };

  const abrirReparacion = (i = null) => {
    setModo("reparacion");
    setEditando(i);
    setForm({
      fechaIngreso: i ? aInput(i.fechaIngreso) : hoy(),
      escalerasReparadas: i ? numeroOVacio(i.escalerasReparadas) : "",
      reparadoPor: i?.reparadoPor || "",
      observaciones: i?.observaciones || "",
    });
  };

  const abrirEstadoInicial = (i) => {
    setModo("estadoInicial");
    setEditando(i);
    setForm({
      fechaIngreso: aInput(i.fechaIngreso),
      escalerasRotas: numeroOVacio(i.escalerasRotas),
      observaciones: i.observaciones || "",
    });
  };

  const cerrar = () => {
    setModo(null);
    setEditando(null);
    setForm(null);
  };

  // En la cosecha no puede haber más reparadas que rotas: cuenta todo menos
  // la fila que se edita.
  const cuentaRotas = (modo === "reparacion" || modo === "estadoInicial") && Boolean(form);
  const otras = [...clasificadas, ...reparaciones].filter((i) => i._id !== editando?._id);
  const rotasCosecha = suma(otras, "escalerasRotas") + (cuentaRotas ? Number(form.escalerasRotas) || 0 : 0);
  const reparadasCosecha =
    suma(otras, "escalerasReparadas") + (cuentaRotas ? Number(form.escalerasReparadas) || 0 : 0);
  const masReparadasQueRotas = cuentaRotas && reparadasCosecha > rotasCosecha;

  const guardar = async (e) => {
    e.preventDefault();
    setGuardando(true);
    try {
      if (modo === "carro") {
        await api.put("/ingresos-sanpablo/reparaciones-carros", { ...form, cosecha, cc: editando._id });
        await cargarCarros();
      } else {
        if (editando) await api.put(`/ingresos-sanpablo/${editando._id}`, form);
        else await api.post("/ingresos-sanpablo", { ...form, tipo: "escaleras", cosecha, reparacion: true });
        await cargarEscaleras();
      }
      cerrar();
      Swal.fire({ icon: "success", title: "Guardado", timer: 1500, showConfirmButton: false, width: "300px" });
    } catch (err) {
      Swal.fire({ icon: "error", title: "No se pudo guardar", text: err.message, width: "300px" });
    } finally {
      setGuardando(false);
    }
  };

  const borrarCarro = async (c) => {
    const r = repCarros[c._id];
    const { isConfirmed } = await Swal.fire({
      icon: "warning",
      title: "¿Borrar la reparación?",
      text: `La del carro ${c.cc}. Esta acción no se puede deshacer.`,
      width: "320px",
      showCancelButton: true,
      confirmButtonText: "Sí, borrar",
      cancelButtonText: "Cancelar",
      confirmButtonColor: ROJO,
      cancelButtonColor: "#64748b",
    });
    if (!isConfirmed) return;
    try {
      await api.delete(`/ingresos-sanpablo/reparaciones-carros/${r._id}`);
      await cargarCarros();
      Swal.fire({ icon: "success", title: "Borrada", timer: 1500, showConfirmButton: false, width: "300px" });
    } catch (err) {
      Swal.fire({ icon: "error", title: "No se pudo borrar", text: err.message, width: "300px" });
    }
  };

  const borrarEscaleras = async (i) => {
    const { isConfirmed } = await Swal.fire({
      icon: "warning",
      title: i.estadoInicial ? "¿Borrar las rotas?" : "¿Borrar la reparación?",
      text: `La del ${fechaCorta(i.fechaIngreso)}. Esta acción no se puede deshacer.`,
      width: "320px",
      showCancelButton: true,
      confirmButtonText: "Sí, borrar",
      cancelButtonText: "Cancelar",
      confirmButtonColor: ROJO,
      cancelButtonColor: "#64748b",
    });
    if (!isConfirmed) return;
    try {
      await api.delete(`/ingresos-sanpablo/${i._id}`);
      await cargarEscaleras();
      Swal.fire({ icon: "success", title: "Borrada", timer: 1500, showConfirmButton: false, width: "300px" });
    } catch (err) {
      Swal.fire({ icon: "error", title: "No se pudo borrar", text: err.message, width: "300px" });
    }
  };

  // ── Campos del modal ──
  const campoFecha = (clave, rotulo, xs = 6) => (
    <Col xs={xs}>
      <Form.Label className="fw-semibold text-dark small mb-1">
        {rotulo} <span className="text-danger">*</span>
      </Form.Label>
      <Form.Control
        type="date"
        className="rounded-3"
        style={campo}
        value={form[clave]}
        onChange={(e) => setForm({ ...form, [clave]: e.target.value })}
        required
      />
    </Col>
  );

  const campoTexto = (clave, rotulo, { requerido = false, filas = 2 } = {}) => (
    <Col xs={12}>
      <Form.Label className="fw-semibold text-dark small mb-1">
        {rotulo} {requerido && <span className="text-danger">*</span>}
      </Form.Label>
      <Form.Control
        as="textarea"
        rows={filas}
        className="rounded-3"
        style={campo}
        value={form[clave]}
        onChange={(e) => setForm({ ...form, [clave]: e.target.value })}
        required={requerido}
      />
    </Col>
  );

  const campoCantidad = (clave, rotulo, color) => (
    <Col xs={6}>
      <Form.Label className="fw-semibold small mb-1" style={{ color }}>
        {rotulo} <span className="text-danger">*</span>
      </Form.Label>
      <Form.Control
        type="number"
        min={0}
        step={1}
        className="rounded-3"
        style={campo}
        value={form[clave]}
        onChange={(e) => setForm({ ...form, [clave]: e.target.value })}
        placeholder="0"
        required
      />
    </Col>
  );

  const avisos = cuentaRotas && (
    <Col xs={12}>
      {(
        <div
          style={{ fontSize: "0.74rem", color: masReparadasQueRotas ? ROJO : "#64748b" }}
          className={masReparadasQueRotas ? "fw-semibold" : ""}
        >
          {masReparadasQueRotas
            ? `Las reparadas (${reparadasCosecha}) no pueden ser más que las rotas (${rotasCosecha})`
            : `Rotas sin reparar: ${rotasCosecha - reparadasCosecha}`}
        </div>
      )}
    </Col>
  );

  const tituloModal =
    modo === "carro"
      ? `Reparación del carro ${editando?.cc || ""}`
      : modo === "estadoInicial"
      ? "Editar rotas"
      : editando
      ? "Editar reparación de escaleras"
      : "Reparación de escaleras";

  // ── Tablas ──
  const acciones = (onEditar, onBorrar, tituloEditar = "Editar") => (
    <div className="d-flex justify-content-center align-items-center" style={{ gap: "6px" }}>
      <BotonAccion
        icono="bi-pencil"
        titulo={sinEditar ? "Sin permiso para editar" : tituloEditar}
        variante="primary"
        onClick={onEditar}
        deshabilitado={sinEditar}
      />
      {onBorrar && (
        <BotonAccion
          icono="bi-trash"
          titulo={sinEditar ? "Sin permiso para editar" : "Borrar"}
          variante="danger"
          onClick={onBorrar}
          deshabilitado={sinEditar}
        />
      )}
    </div>
  );

  const filaVacia = (columnas, texto) => (
    <tr>
      <td colSpan={columnas} className="text-center text-muted py-4" style={td}>
        {cargando ? "Cargando…" : texto}
      </td>
    </tr>
  );

  const tablaCarros = (
    <Table className="mb-0 tabla-informe" style={{ width: "100%" }}>
      <thead style={{ position: "sticky", top: 0, zIndex: 10 }}>
        <tr>
          <th style={thCentro}>Carro porta escaleras</th>
          <th style={thCentro}>Fecha</th>
          <th style={th}>Trabajos a realizar</th>
          <th style={th}>Observaciones</th>
          <th style={thCentro}>Acciones</th>
        </tr>
      </thead>
      <tbody>
        {carros.length === 0
          ? filaVacia(5, "No hay carros porta escaleras en el padrón de CC")
          : carros.map((c) => {
              const r = repCarros[c._id];
              return (
                <tr key={c._id}>
                  <td style={{ ...tdCentro, fontWeight: 700, whiteSpace: "nowrap" }}>
                    {c.cc}
                    {c.descripcion && (
                      <span className="text-muted fw-normal" style={{ fontSize: "0.66rem" }}>
                        {" "}
                        · {c.descripcion}
                      </span>
                    )}
                  </td>
                  <td style={{ ...tdCentro, whiteSpace: "nowrap" }}>{r ? fechaCorta(r.fecha) : <Raya />}</td>
                  <td style={td}>{r?.trabajos || <Raya />}</td>
                  <td style={td}>{r?.observaciones || <Raya />}</td>
                  <td style={tdCentro}>
                    {acciones(() => abrirCarro(c), r && (() => borrarCarro(c)), r ? "Editar" : "Cargar la reparación")}
                  </td>
                </tr>
              );
            })}
      </tbody>
    </Table>
  );

  const tablaEscaleras = (
    <Table className="mb-0 tabla-informe" style={{ width: "100%" }}>
      <thead style={{ position: "sticky", top: 0, zIndex: 10 }}>
        <tr>
          <th style={thCentro}>Fecha</th>
          <th style={thCentro}>Escaleras rotas</th>
          <th style={thCentro}>Escaleras reparadas</th>
          <th style={th}>Quién repara</th>
          <th style={thCentro}>Rotas acumuladas</th>
          <th style={thCentro}>Reparadas acumuladas</th>
          <th style={th}>Observaciones</th>
          <th style={thCentro}>Acciones</th>
        </tr>
      </thead>
      <tbody>
        {reparaciones.length === 0
          ? filaVacia(8, "No hay reparaciones de escaleras todavía")
          : reparacionesAcumuladas.map((i) => (
              <tr key={i._id}>
                <td style={{ ...tdCentro, whiteSpace: "nowrap" }}>{fechaCorta(i.fechaIngreso) || <Raya />}</td>
                <td style={{ ...tdCentro, fontWeight: 700, color: ROJO }}>{i.escalerasRotas ?? <Raya />}</td>
                <td style={{ ...tdCentro, fontWeight: 700, color: VERDE }}>{i.escalerasReparadas ?? <Raya />}</td>
                <td style={td}>{i.reparadoPor || <Raya />}</td>
                <td style={{ ...tdCentro, color: ROJO }}>{i.rotasHasta}</td>
                <td style={{ ...tdCentro, color: VERDE }}>{i.reparadasHasta}</td>
                <td style={td}>
                  {i.estadoInicial && (
                    <span className="fw-semibold me-1" style={{ color: COLOR }}>
                      Rotas{i.observaciones ? " ·" : ""}
                    </span>
                  )}
                  {i.observaciones || (!i.estadoInicial && <Raya />)}
                </td>
                <td style={tdCentro}>
                  {acciones(
                    () => (i.estadoInicial ? abrirEstadoInicial(i) : abrirReparacion(i)),
                    () => borrarEscaleras(i)
                  )}
                </td>
              </tr>
            ))}
        {reparaciones.length > 0 && (
          <tr className="fila-total">
            <td style={{ ...tdCentro, fontWeight: 700, color: COLOR }}>TOTAL</td>
            <td style={{ ...tdCentro, fontWeight: 700, color: ROJO }}>{suma(reparaciones, "escalerasRotas")}</td>
            <td style={{ ...tdCentro, fontWeight: 700, color: VERDE }}>{suma(reparaciones, "escalerasReparadas")}</td>
            <td style={td}></td>
            <td colSpan={2} style={{ ...tdCentro, fontWeight: 700, color: ROJO }}>
              Rotas sin reparar: {suma(reparaciones, "escalerasRotas") - suma(reparaciones, "escalerasReparadas")}
            </td>
            <td colSpan={2} style={td}></td>
          </tr>
        )}
      </tbody>
    </Table>
  );

  const solapas = [
    ["carros", "Carros porta escaleras", "bi-truck-flatbed", Object.keys(repCarros).length],
    ["escaleras", "Escaleras", "bi-bar-chart-steps", reparaciones.length],
  ];

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
        titulo="Reparación"
        sinSeccion
        cosecha={cosecha}
        icono={<i className="bi bi-tools"></i>}
        volverA={`/reparaciones/sanpablo/${cosecha}/escaleras`}
      />

      <Container
        fluid
        className="px-3 py-3 d-flex flex-column flex-grow-1"
        style={{ maxWidth: "1160px", width: "100%", margin: "0 auto", overflow: "hidden" }}
      >
        {/* Las solapas, pegadas arriba de la tabla; a la derecha, la carga de
            una reparación de escaleras. */}
        <div className="d-flex align-items-end gap-1 flex-shrink-0" style={{ marginBottom: "-1px" }}>
          {solapas.map(([clave, rotulo, iconoSolapa, cantidad]) => {
            const activa = solapa === clave;
            return (
              <button
                key={clave}
                type="button"
                onClick={() => setSolapa(clave)}
                className="d-flex align-items-center gap-2 px-3 py-1 fw-semibold"
                style={{
                  fontSize: "0.8rem",
                  border: "1px solid #cbd5e1",
                  borderBottom: activa ? `1px solid ${COLOR}` : "1px solid #cbd5e1",
                  borderTopLeftRadius: "0.5rem",
                  borderTopRightRadius: "0.5rem",
                  backgroundColor: activa ? COLOR : "#fff",
                  color: activa ? "#fff" : "#475569",
                  cursor: "pointer",
                }}
              >
                <i className={`bi ${iconoSolapa}`}></i>
                <span>{rotulo}</span>
                <span
                  className="px-2 rounded-pill"
                  style={{
                    fontSize: "0.68rem",
                    backgroundColor: activa ? "rgba(255,255,255,0.2)" : COLOR_SUAVE,
                    color: activa ? "#fff" : COLOR,
                  }}
                >
                  {cargando ? "—" : cantidad}
                </span>
              </button>
            );
          })}
          {/* La fecha límite de la solapa, fuera de la tabla. */}
          <div className="d-flex align-items-center gap-2 ms-auto mb-1">
            <span className="fw-bold text-nowrap" style={{ color: COLOR, fontSize: "0.8rem" }}>
              <i className="bi bi-calendar-event me-1"></i>
              Fecha límite
            </span>
            <Form.Control
              type="date"
              size="sm"
              className="rounded-3"
              style={{ width: "auto", fontSize: "0.8rem", height: "27px" }}
              value={fechasLimite[solapa]}
              onChange={(e) => guardarFechaLimite(e.target.value)}
              disabled={sinEditar}
              title={sinEditar ? "Sin permiso para editar" : solapa === "carros" ? "Para cuándo tienen que estar reparados los carros" : "Para cuándo tienen que estar reparadas las escaleras"}
            />
          </div>
          {solapa === "escaleras" && (
            <Button
              size="sm"
              onClick={() => abrirReparacion()}
              disabled={sinEditar}
              title={sinEditar ? "Sin permiso para editar" : undefined}
              className="rounded-3 px-2 d-flex align-items-center gap-1 text-nowrap ms-3 mb-1"
              style={{ fontSize: "0.72rem", height: "27px", fontWeight: 600, backgroundColor: VERDE, borderColor: VERDE }}
            >
              <i className="bi bi-plus-lg"></i>
              <span>Reparación de escaleras</span>
            </Button>
          )}
        </div>

        <div
          className="shadow-sm bg-white"
          style={{
            flex: "0 1 auto",
            minHeight: 0,
            maxWidth: "100%",
            overflowY: "auto",
            overflowX: "hidden",
            border: "1px solid #cbd5e1",
            borderRadius: "0 0.5rem 0.5rem 0.5rem",
          }}
        >
          {solapa === "carros" ? tablaCarros : tablaEscaleras}
        </div>
      </Container>

      <Modal
        show={Boolean(form)}
        onHide={cerrar}
        centered
        dialogClassName="modal-cc"
        contentClassName="border-0 shadow-lg rounded-4"
      >
        <Modal.Header
          closeButton
          closeVariant="white"
          style={{
            backgroundColor: modo === "estadoInicial" ? COLOR : VERDE,
            color: "#fff",
            borderTopLeftRadius: "1rem",
            borderTopRightRadius: "1rem",
            borderBottom: "1px solid rgba(255,255,255,0.1)",
          }}
        >
          <Modal.Title className="fs-6 fw-normal d-flex align-items-center gap-2 text-white">
            <i className={`bi ${modo === "estadoInicial" ? "bi-flag" : "bi-tools"}`}></i>
            <span>{tituloModal}</span>
          </Modal.Title>
        </Modal.Header>
        {form && (
          <Form onSubmit={guardar}>
            <Modal.Body className="p-4">
              <Row className="g-3 form-ingresos">
                {modo === "carro" && (
                  <>
                    {campoFecha("fecha", "Fecha")}
                    {campoTexto("trabajos", "Trabajos a realizar", { requerido: true, filas: 3 })}
                    {campoTexto("observaciones", "Observaciones")}
                  </>
                )}
                {modo === "reparacion" && (
                  <>
                    {campoFecha("fechaIngreso", "Fecha")}
                    {campoCantidad("escalerasReparadas", "Escaleras reparadas", VERDE)}
                    <Col xs={6}>
                      <Form.Label className="fw-semibold text-dark small mb-1">
                        Quién repara <span className="text-danger">*</span>
                      </Form.Label>
                      <Form.Control
                        className="rounded-3"
                        style={campo}
                        value={form.reparadoPor}
                        onChange={(e) => setForm({ ...form, reparadoPor: e.target.value })}
                        maxLength={80}
                        required
                      />
                    </Col>
                    {campoTexto("observaciones", "Observaciones")}
                  </>
                )}
                {modo === "estadoInicial" && (
                  <>
                    {campoFecha("fechaIngreso", "Fecha")}
                    {campoCantidad("escalerasRotas", "Escaleras rotas", ROJO)}
                    {campoTexto("observaciones", "Observaciones")}
                  </>
                )}
                {avisos}
              </Row>
            </Modal.Body>
            <Modal.Footer
              className="bg-light border-0 py-2 px-4"
              style={{ borderBottomLeftRadius: "1rem", borderBottomRightRadius: "1rem" }}
            >
              <Button
                variant="outline-secondary"
                size="sm"
                onClick={cerrar}
                className="rounded-3 px-3 py-1"
                style={{ fontSize: "0.84rem" }}
              >
                Cancelar
              </Button>
              <Button
                size="sm"
                type="submit"
                disabled={guardando || masReparadasQueRotas}
                className="rounded-3 px-3 py-1 shadow-sm d-flex align-items-center gap-1"
                style={{ backgroundColor: VERDE, borderColor: VERDE, fontSize: "0.84rem", fontWeight: 600 }}
              >
                <i className="bi bi-check-lg"></i>
                <span>{guardando ? "Guardando…" : "Guardar"}</span>
              </Button>
            </Modal.Footer>
          </Form>
        )}
      </Modal>
    </div>
  );
}
