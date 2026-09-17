import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import Swal from "sweetalert2";
import { Container, Table, Button, Form, Modal, Row, Col } from "react-bootstrap";
import { api } from "../../services/api";
import { exportarPlanilla } from "../../helpers/excel";
import { compararCC } from "../../utils/ordenCC";
import { cosechaDeParam } from "../../utils/cosechas";
import { useSupervisores, opcionesSupervisor } from "../../utils/supervisores";
import { usePermisos } from "../../context/permisos";
import NavbarSanPablo from "../shared/NavbarSanPablo";
import { campo, th as thBase, td, tdCentro } from "../compras/formato";
import { Raya, BotonAccion } from "../compras/estilos";

// El slate de Mantenimiento, que es la sección de donde se llega.
const COLOR = "#1e293b";
const COLOR_SUAVE = "#f1f5f9";
const th = { ...thBase, backgroundColor: COLOR };
const thCentro = { ...th, textAlign: "center" };

// Hoy como "AAAA-MM-DD" en la hora local: es lo que usa el <input type="date">.
const hoy = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

// La fecha es un día sin hora y viaja como 00:00 UTC: se lee sin pasarla a la
// hora local, que la correría al día anterior.
const aInput = (iso) => (iso ? String(iso).slice(0, 10) : "");
const fechaCorta = (iso) => {
  const [a, m, d] = aInput(iso).split("-");
  return a ? `${d}/${m}/${a}` : "";
};

// Los placeholders y los selects sin elegir van en gris claro.
const GRIS_CLARO = "#a0aec0";
const TEXTO = "#1e293b";
const campoSelect = (valor) => ({ ...campo, color: valor ? TEXTO : GRIS_CLARO });

const AZUL = "#1d4ed8";
const ROJO = "#dc2626";
// Las salidas de escaleras (retiros), como en Escaleras.
const NARANJA = "#c2410c";

/**
 * El círculo de sí / no, como el de "Camioneta parada" del check list: azul
 * con la tilde si es sí, rojo con la cruz si es no. Se usa para Revisada y
 * para Plan de mantenimiento.
 */
function Circulo({ marcada, onClick, titulo, deshabilitado = false, tamano = 20 }) {
  const color = marcada ? AZUL : ROJO;
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={deshabilitado}
      title={`${titulo}: ${marcada ? "sí" : "no"}`}
      className="d-inline-flex align-items-center justify-content-center p-0"
      style={{
        width: `${tamano}px`,
        height: `${tamano}px`,
        borderRadius: "50%",
        border: `2px solid ${color}`,
        backgroundColor: color,
        color: "#fff",
        cursor: deshabilitado ? "default" : "pointer",
        opacity: deshabilitado ? 0.6 : 1,
        flexShrink: 0,
      }}
    >
      <i
        className={`bi ${marcada ? "bi-check-lg" : "bi-x-lg"}`}
        style={{ fontSize: `${tamano * (marcada ? 0.65 : 0.5)}px`, lineHeight: 1 }}
      ></i>
    </button>
  );
}

/**
 * Ingresos al taller de San Pablo de un tipo de equipo (Manitous, por ahora).
 * `equipos` son los equipos del padrón de CC que se ofrecen en el alta.
 */
export default function IngresosSanPablo({ tipo, titulo, equipos, icono }) {
  // La cosecha viene de la dirección (RutaCosecha ya la validó).
  const cosecha = cosechaDeParam(useParams().cosecha);
  const { puede } = usePermisos();
  const sinEditar = !puede("sanpablo.ingresos", "editar");
  // Los carros porta escaleras cargan además cuántas escaleras traen.
  const conEscaleras = tipo === "carros-porta-escaleras";
  // Los carros porta escaleras suman la cantidad de escaleras y la fecha de egreso.
  const columnas = conEscaleras ? 9 : 7;

  const [ingresos, setIngresos] = useState([]);
  const [centros, setCentros] = useState([]);
  const supervisores = useSupervisores();
  const [cargando, setCargando] = useState(true);
  const [form, setForm] = useState(null);
  // El ingreso que se está editando, o null en uno nuevo.
  const [editando, setEditando] = useState(null);

  const cargar = () =>
    api
      .get(`/ingresos-sanpablo?cosecha=${cosecha}&tipo=${tipo}`)
      .then((data) => setIngresos(Array.isArray(data) ? data : []))
      .catch(() => setIngresos([]))
      .finally(() => setCargando(false));

  useEffect(() => {
    cargar();
    api
      .get("/centros-costo")
      .then((data) =>
        setCentros(
          (Array.isArray(data) ? data : [])
            .filter((c) => equipos.includes((c.equipo || "").trim()))
            .sort((a, b) => compararCC(a.cc, b.cc))
        )
      )
      .catch(() => setCentros([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tipo, cosecha]);

  const abrirNuevo = () => {
    setEditando(null);
    setForm({
      cc: "",
      fechaIngreso: hoy(),
      fechaEgreso: "",
      ingresadoPor: "",
      revisada: false,
      planMantenimiento: false,
      cantidadEscaleras: "",
      observaciones: "",
    });
  };

  const abrirEditar = (i) => {
    setEditando(i);
    setForm({
      cc: i.cc?._id || "",
      fechaIngreso: aInput(i.fechaIngreso),
      fechaEgreso: aInput(i.fechaEgreso),
      ingresadoPor: i.ingresadoPor || "",
      revisada: Boolean(i.revisada),
      planMantenimiento: Boolean(i.planMantenimiento),
      cantidadEscaleras: i.cantidadEscaleras ?? "",
      observaciones: i.observaciones || "",
    });
  };

  const cerrar = () => {
    setForm(null);
    setEditando(null);
  };

  const guardar = async (e) => {
    e.preventDefault();
    const eraEdicion = Boolean(editando);
    try {
      if (eraEdicion) await api.put(`/ingresos-sanpablo/${editando._id}`, form);
      else await api.post("/ingresos-sanpablo", { ...form, tipo, cosecha });
      cerrar();
      cargar();
      Swal.fire({
        icon: "success",
        title: eraEdicion ? "Ingreso actualizado" : "Ingreso registrado",
        timer: 1400,
        showConfirmButton: false,
      });
    } catch (err) {
      Swal.fire({ icon: "error", title: "No se pudo guardar", text: err.message });
    }
  };

  // Marcar o desmarcar un sí / no (revisada, planMantenimiento) desde la
  // tabla, sin abrir el modal.
  const alternar = async (i, campoSiNo) => {
    const valor = !i[campoSiNo];
    const poner = (v) => setIngresos((lista) => lista.map((x) => (x._id === i._id ? { ...x, [campoSiNo]: v } : x)));
    poner(valor);
    try {
      await api.put(`/ingresos-sanpablo/${i._id}`, { [campoSiNo]: valor });
    } catch (err) {
      poner(!valor);
      Swal.fire({ icon: "error", title: "No se pudo guardar", text: err.message });
    }
  };

  const eliminar = async (i) => {
    const { isConfirmed } = await Swal.fire({
      title: "¿Borrar el ingreso?",
      text: `${i.cc?.cc || "Equipo"} — ingresado el ${fechaCorta(i.fechaIngreso)}`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Sí, borrar",
      cancelButtonText: "Cancelar",
      confirmButtonColor: "#dc2626",
      cancelButtonColor: "#64748b",
    });
    if (!isConfirmed) return;
    try {
      await api.delete(`/ingresos-sanpablo/${i._id}`);
      cargar();
      Swal.fire({ icon: "success", title: "Ingreso borrado", timer: 1200, showConfirmButton: false });
    } catch (err) {
      Swal.fire({ icon: "error", title: "No se pudo borrar", text: err.message });
    }
  };

  // Las salidas son de los retiros de Escaleras: no son ingresos ni se revisan.
  const entradas = ingresos.filter((i) => !i.salida);

  // La planilla sigue la tabla: mismas columnas y mismo orden.
  const exportarExcel = () =>
    exportarPlanilla({
      titulo: `Reparaciones San Pablo — ${titulo} — Cosecha ${cosecha}`,
      columnas: [
        { titulo: "Equipo (CC)", ancho: 24 },
        ...(conEscaleras ? [{ titulo: "Cant. escaleras", ancho: 14 }] : []),
        { titulo: "Fecha ingreso", ancho: 14 },
        ...(conEscaleras ? [{ titulo: "Fecha egreso", ancho: 14 }] : []),
        { titulo: "Quién lo ingresa", ancho: 24 },
        { titulo: "Revisada", ancho: 12 },
        { titulo: "Plan de mantenimiento", ancho: 20 },
        { titulo: "Observaciones", ancho: 40 },
      ],
      filas: ingresos.map((i) => {
        const cc = [i.cc?.cc, i.cc?.descripcion].filter(Boolean).join(" · ");
        return [
          i.salida ? `Salida · ${cc}` : cc,
          ...(conEscaleras ? [i.cantidadEscaleras == null ? "" : i.salida ? -i.cantidadEscaleras : i.cantidadEscaleras] : []),
          fechaCorta(i.fechaIngreso),
          ...(conEscaleras ? [fechaCorta(i.fechaEgreso)] : []),
          i.ingresadoPor || "",
          i.salida ? "" : i.revisada ? "Sí" : "No",
          i.salida ? "" : i.planMantenimiento ? "Sí" : "No",
          i.observaciones || "",
        ];
      }),
      hoja: titulo.slice(0, 31),
      archivo: `sanpablo_${tipo}_${cosecha}_${new Date().toISOString().slice(0, 10)}.xlsx`,
    });
  const salidas = ingresos.length - entradas.length;
  const sinRevisar = entradas.filter((i) => !i.revisada).length;

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
        titulo={`Cosecha ${cosecha} · ${titulo}`}
        icono={icono}
        volverA={`/reparaciones/sanpablo/${cosecha}`}
      />

      <Container
        fluid
        className="px-3 py-3 d-flex flex-column flex-grow-1"
        style={{ maxWidth: "900px", width: "100%", margin: "0 auto", overflow: "hidden" }}
      >
        {/* Encabezado de la pantalla */}
        <div className="d-flex align-items-center gap-2 mb-3 flex-wrap">
          <span className="fw-bold" style={{ color: COLOR, fontSize: "1.05rem" }}>
            Ingresos
          </span>
          {!cargando && (
            <span
              className="px-2 py-1 rounded-3"
              style={{ fontSize: "0.76rem", backgroundColor: COLOR_SUAVE, color: COLOR, fontWeight: 600 }}
            >
              {entradas.length} {entradas.length === 1 ? "ingreso" : "ingresos"}
              {sinRevisar > 0 && ` · ${sinRevisar} sin revisar`}
              {salidas > 0 && ` · ${salidas} ${salidas === 1 ? "salida" : "salidas"}`}
            </span>
          )}
          <div className="ms-auto" />
          <Button
            size="sm"
            onClick={exportarExcel}
            disabled={ingresos.length === 0}
            className="rounded-3 px-3 d-flex align-items-center gap-2"
            style={{ backgroundColor: "#15803d", borderColor: "#15803d", fontSize: "0.78rem", height: "30px", fontWeight: 600 }}
            title="Exportar a Excel"
          >
            <i className="bi bi-file-earmark-excel-fill"></i>
            <span>Excel</span>
          </Button>
          <Button
            size="sm"
            onClick={abrirNuevo}
            disabled={sinEditar}
            title={sinEditar ? "Sin permiso para editar" : undefined}
            className="rounded-3 px-3 d-flex align-items-center gap-2"
            style={{ backgroundColor: COLOR, borderColor: COLOR, fontSize: "0.78rem", height: "30px", fontWeight: 600 }}
          >
            <i className="bi bi-plus-lg"></i>
            <span>Nuevo ingreso</span>
          </Button>
        </div>

        <div
          className="shadow-sm rounded-3 bg-white"
          style={{
            flex: "0 1 auto",
            minHeight: 0,
            maxWidth: "100%",
            overflowY: "auto",
            overflowX: "auto",
            border: "1px solid #cbd5e1",
          }}
        >
          <Table className="mb-0 tabla-informe" style={{ width: "100%", minWidth: conEscaleras ? "800px" : "700px" }}>
            <thead style={{ position: "sticky", top: 0, zIndex: 10 }}>
              <tr>
                <th style={thCentro}>Equipo (CC)</th>
                {conEscaleras && <th style={thCentro}>Cant. escaleras</th>}
                <th style={thCentro}>Fecha ingreso</th>
                {conEscaleras && <th style={thCentro}>Fecha egreso</th>}
                <th style={th}>Quién lo ingresa</th>
                <th style={thCentro}>Revisada</th>
                <th style={thCentro}>Plan de mantenimiento</th>
                <th style={th}>Observaciones</th>
                <th style={thCentro}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {ingresos.length === 0 ? (
                <tr>
                  <td colSpan={columnas} className="text-center text-muted py-4" style={td}>
                    {cargando ? "Cargando…" : "No hay ingresos cargados"}
                  </td>
                </tr>
              ) : (
                ingresos.map((i) =>
                  i.salida ? (
                    <tr key={i._id}>
                      <td style={{ ...tdCentro, fontWeight: 700, whiteSpace: "nowrap" }}>
                        <span
                          className="px-2 me-1 rounded-pill"
                          style={{ backgroundColor: "#ffedd5", color: NARANJA, fontSize: "0.66rem" }}
                        >
                          Salida
                        </span>
                        {i.cc?.cc || <Raya />}
                        {i.cc?.descripcion && (
                          <span className="text-muted fw-normal" style={{ fontSize: "0.66rem" }}>
                            {" "}
                            · {i.cc.descripcion}
                          </span>
                        )}
                      </td>
                      {conEscaleras && (
                        <td style={{ ...tdCentro, fontWeight: 700, color: NARANJA }}>
                          {i.cantidadEscaleras == null ? <Raya /> : `−${i.cantidadEscaleras}`}
                        </td>
                      )}
                      <td style={{ ...tdCentro, whiteSpace: "nowrap" }}>{fechaCorta(i.fechaIngreso) || <Raya />}</td>
                      {conEscaleras && (
                        <td style={tdCentro}>
                          <Raya />
                        </td>
                      )}
                      <td style={td}>{i.ingresadoPor || <Raya />}</td>
                      <td style={tdCentro}>
                        <Raya />
                      </td>
                      <td style={tdCentro}>
                        <Raya />
                      </td>
                      <td style={td}>{i.observaciones || <Raya />}</td>
                      <td style={tdCentro}>
                        <i
                          className="bi bi-lock-fill text-muted"
                          style={{ fontSize: "0.75rem" }}
                          title="Salida de un retiro de escaleras: se cambia en Escaleras"
                        ></i>
                      </td>
                    </tr>
                  ) : (
                    <tr key={i._id}>
                      <td style={{ ...tdCentro, fontWeight: 700, whiteSpace: "nowrap" }}>
                        {i.cc?.cc || <Raya />}
                        {i.cc?.descripcion && (
                          <span className="text-muted fw-normal" style={{ fontSize: "0.66rem" }}>
                            {" "}
                            · {i.cc.descripcion}
                          </span>
                        )}
                      </td>
                      {conEscaleras && <td style={tdCentro}>{i.cantidadEscaleras ?? <Raya />}</td>}
                      <td style={{ ...tdCentro, whiteSpace: "nowrap" }}>{fechaCorta(i.fechaIngreso) || <Raya />}</td>
                      {conEscaleras && (
                        <td style={{ ...tdCentro, whiteSpace: "nowrap" }}>{fechaCorta(i.fechaEgreso) || <Raya />}</td>
                      )}
                      <td style={td}>{i.ingresadoPor || <Raya />}</td>
                      <td style={{ ...tdCentro, padding: "3px 5px" }}>
                        <Circulo
                          marcada={i.revisada}
                          titulo="Revisada"
                          onClick={() => alternar(i, "revisada")}
                          deshabilitado={sinEditar}
                          tamano={18}
                        />
                      </td>
                      <td style={{ ...tdCentro, padding: "3px 5px" }}>
                        <Circulo
                          marcada={i.planMantenimiento}
                          titulo="Plan de mantenimiento"
                          onClick={() => alternar(i, "planMantenimiento")}
                          deshabilitado={sinEditar}
                          tamano={18}
                        />
                      </td>
                      <td style={td}>{i.observaciones || <Raya />}</td>
                      <td style={tdCentro}>
                        <div className="d-flex justify-content-center align-items-center" style={{ gap: "6px" }}>
                          <BotonAccion
                            icono="bi-pencil"
                            titulo={sinEditar ? "Sin permiso para editar" : "Editar"}
                            variante="primary"
                            onClick={() => abrirEditar(i)}
                            deshabilitado={sinEditar}
                          />
                          <BotonAccion
                            icono="bi-trash"
                            titulo={sinEditar ? "Sin permiso para editar" : "Borrar"}
                            variante="danger"
                            onClick={() => eliminar(i)}
                            deshabilitado={sinEditar}
                          />
                        </div>
                      </td>
                    </tr>
                  )
                )
              )}
            </tbody>
          </Table>
        </div>
      </Container>

      {/* Modal Nuevo / Editar ingreso */}
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
            backgroundColor: COLOR,
            color: "#fff",
            borderTopLeftRadius: "1rem",
            borderTopRightRadius: "1rem",
            borderBottom: "1px solid rgba(255,255,255,0.1)",
          }}
        >
          <Modal.Title className="fs-6 fw-normal d-flex align-items-center gap-2 text-white">
            <i className="bi bi-box-arrow-in-right"></i>
            <span>{editando ? "Editar ingreso" : "Nuevo ingreso"}</span>
          </Modal.Title>
        </Modal.Header>
        {form && (
          <Form onSubmit={guardar}>
            <Modal.Body className="p-4">
              <Row className="g-3 form-ingresos">
                <Col xs={conEscaleras ? 8 : 12}>
                  <Form.Label className="fw-semibold text-dark small mb-1">
                    Equipo (CC) <span className="text-danger">*</span>
                  </Form.Label>
                  <Form.Select
                    className="rounded-3"
                    style={campoSelect(form.cc)}
                    value={form.cc}
                    onChange={(e) => setForm({ ...form, cc: e.target.value })}
                    required
                  >
                    <option value="">Elegir equipo…</option>
                    {centros.map((c) => {
                      // Un carro porta escaleras entra una sola vez por cosecha: el que ya
                      // tiene ingreso no se puede elegir (salvo el que se está editando).
                      const yaIngresado =
                        conEscaleras &&
                        ingresos.some((i) => !i.salida && i.cc?._id === c._id && i._id !== editando?._id);
                      return (
                        <option key={c._id} value={c._id} style={{ color: yaIngresado ? GRIS_CLARO : TEXTO }} disabled={yaIngresado}>
                          {c.cc}
                          {c.descripcion ? ` · ${c.descripcion}` : ""}
                          {yaIngresado ? " (ya ingresado)" : ""}
                        </option>
                      );
                    })}
                  </Form.Select>
                  {centros.length === 0 && (
                    <div className="text-muted mt-1" style={{ fontSize: "0.72rem" }}>
                      No hay CC con equipo {equipos.join(" / ")} en Centros de costo.
                    </div>
                  )}
                </Col>

                {conEscaleras && (
                  <Col xs={4}>
                    <Form.Label className="fw-semibold text-dark small mb-1 text-nowrap">
                      Cant. escaleras <span className="text-danger">*</span>
                    </Form.Label>
                    <Form.Control
                      type="number"
                      min={0}
                      step={1}
                      className="rounded-3"
                      style={campo}
                      value={form.cantidadEscaleras}
                      onChange={(e) => setForm({ ...form, cantidadEscaleras: e.target.value })}
                      placeholder="0"
                      required
                    />
                  </Col>
                )}

                <Col xs={6}>
                  <Form.Label className="fw-semibold text-dark small mb-1">
                    Fecha ingreso <span className="text-danger">*</span>
                  </Form.Label>
                  <Form.Control
                    type="date"
                    className="rounded-3"
                    style={campo}
                    value={form.fechaIngreso}
                    onChange={(e) => setForm({ ...form, fechaIngreso: e.target.value })}
                    required
                  />
                </Col>

                {conEscaleras && (
                  <Col xs={6}>
                    <Form.Label className="fw-semibold text-dark small mb-1">Fecha egreso</Form.Label>
                    <Form.Control
                      type="date"
                      className="rounded-3"
                      style={campo}
                      value={form.fechaEgreso}
                      min={form.fechaIngreso || undefined}
                      onChange={(e) => setForm({ ...form, fechaEgreso: e.target.value })}
                    />
                  </Col>
                )}

                <Col xs={conEscaleras ? 12 : 6}>
                  <Form.Label className="fw-semibold text-dark small mb-1">Quién lo ingresa</Form.Label>
                  <Form.Select
                    className="rounded-3"
                    style={campoSelect(form.ingresadoPor)}
                    value={form.ingresadoPor}
                    onChange={(e) => setForm({ ...form, ingresadoPor: e.target.value })}
                  >
                    <option value="">Elegir supervisor…</option>
                    {opcionesSupervisor(supervisores, form.ingresadoPor).map((s) => (
                      <option key={s} value={s} style={{ color: TEXTO }}>
                        {s}
                      </option>
                    ))}
                  </Form.Select>
                </Col>

                {[
                  ["revisada", "Revisada"],
                  ["planMantenimiento", "Plan de mantenimiento"],
                ].map(([campoSiNo, rotulo]) => (
                  <Col xs={6} key={campoSiNo} className="d-flex flex-column">
                    <Form.Label className="fw-semibold text-dark small mb-1">{rotulo}</Form.Label>
                    <div className="d-flex align-items-center gap-2 flex-grow-1">
                      <Circulo
                        marcada={form[campoSiNo]}
                        titulo={rotulo}
                        onClick={() => setForm({ ...form, [campoSiNo]: !form[campoSiNo] })}
                        tamano={24}
                      />
                      <span className="fw-semibold" style={{ fontSize: "0.8rem", color: form[campoSiNo] ? AZUL : ROJO }}>
                        {form[campoSiNo] ? "Sí" : "No"}
                      </span>
                    </div>
                  </Col>
                ))}

                <Col xs={12}>
                  <Form.Label className="fw-semibold text-dark small mb-1">Observaciones</Form.Label>
                  <Form.Control
                    as="textarea"
                    rows={2}
                    className="rounded-3"
                    style={campo}
                    value={form.observaciones}
                    onChange={(e) => setForm({ ...form, observaciones: e.target.value })}
                    placeholder="Qué trae, qué se le nota…"
                  />
                </Col>
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
                className="rounded-3 px-3 py-1 shadow-sm d-flex align-items-center gap-1"
                style={{ backgroundColor: "#15803d", borderColor: "#15803d", fontSize: "0.84rem", fontWeight: 600 }}
              >
                <i className="bi bi-check-lg"></i>
                <span>Guardar</span>
              </Button>
            </Modal.Footer>
          </Form>
        )}
      </Modal>
    </div>
  );
}
