import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import Swal from "sweetalert2";
import { Container, Table, Button, Form, Modal, Row, Col } from "react-bootstrap";
import { api } from "../../services/api";
import { compararCC } from "../../utils/ordenCC";
import { cosechaDeParam } from "../../utils/cosechas";
import { SISTEMAS_MANITOU } from "../../utils/sistemasManitou";
import { usePermisos } from "../../context/permisos";
import NavbarSanPablo from "../shared/NavbarSanPablo";
import TractorIcon from "../shared/TractorIcon";
import Error404 from "./Error404";
import { campo, th as thBase, td, tdCentro } from "../compras/formato";
import { Raya, BotonAccion } from "../compras/estilos";
import { fmtNro } from "../compras/nroPedido";

// El slate de Mantenimiento, como los ingresos de San Pablo.
const COLOR = "#1e293b";
const COLOR_SUAVE = "#f1f5f9";
const VERDE = "#047857";
const VERDE_OK = "#16a34a";
const ROJO = "#dc2626";
const th = { ...thBase, backgroundColor: COLOR };
const thCentro = { ...th, textAlign: "center" };

const SECCION = "manitous-general";
const URGENCIAS = ["Baja", "Media", "Alta", "Crítica"];
const REPUESTO_INIT = { nombre_repuesto: "", cant: "", unidad: "", cc: "", urgencia: "", descripcion: "" };

/**
 * El círculo de OK, como el de "Camioneta parada" del check list de
 * camionetas: vacío con borde oscuro y, tocado, lleno de verde con la tilde
 * blanca. Se guarda en el campo `chequeado`.
 */
function CirculoOk({ marcado, onClick, deshabilitado, tamano = 18 }) {
  const RELLENO = VERDE_OK;
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={deshabilitado}
      title={`OK: ${marcado ? "sí" : "no"}`}
      className="d-inline-flex align-items-center justify-content-center p-0"
      style={{
        width: `${tamano}px`,
        height: `${tamano}px`,
        borderRadius: "50%",
        border: `2px solid ${marcado ? RELLENO : "#333"}`,
        backgroundColor: marcado ? RELLENO : "#fff",
        color: "#fff",
        cursor: deshabilitado ? "default" : "pointer",
        opacity: deshabilitado ? 0.6 : 1,
        transition: "background-color 0.15s, border-color 0.15s",
        flexShrink: 0,
      }}
    >
      {marcado && <i className="bi bi-check-lg" style={{ fontSize: `${tamano * 0.7}px`, lineHeight: 1 }}></i>}
    </button>
  );
}

/**
 * La x de "Con problema": roja, con borde y sin relleno. Abre el modal del
 * problema; con el problema escrito pasa a ser el ojo, lleno de rojo.
 */
function CirculoProblema({ conProblema, onClick, deshabilitado, tamano = 18 }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={deshabilitado}
      title={conProblema ? "Ver el problema" : "Cargar un problema"}
      className="d-inline-flex align-items-center justify-content-center p-0"
      style={{
        width: `${tamano}px`,
        height: `${tamano}px`,
        borderRadius: "50%",
        border: `2px solid ${ROJO}`,
        backgroundColor: conProblema ? ROJO : "#fff",
        color: conProblema ? "#fff" : ROJO,
        cursor: deshabilitado ? "default" : "pointer",
        opacity: deshabilitado ? 0.6 : 1,
        flexShrink: 0,
      }}
    >
      <i
        className={`bi ${conProblema ? "bi-eye-fill" : "bi-x-lg"}`}
        style={{ fontSize: `${tamano * (conProblema ? 0.55 : 0.5)}px`, lineHeight: 1 }}
      ></i>
    </button>
  );
}

/**
 * La tabla de chequeo de un sistema de Manitous › General (Motor, Torre…) en
 * una cosecha (06/10/2026): ítem, OK, con problema y los repuestos,
 * que se piden a Compras desde la fila.
 */
export default function ChequeosManitou() {
  const { cosecha: param, sistema: idSistema } = useParams();
  const cosecha = cosechaDeParam(param);
  const sistema = SISTEMAS_MANITOU.find((s) => s.id === idSistema);
  const { puede } = usePermisos();
  const sinEditar = !puede("sanpablo.ingresos", "editar");

  const [filas, setFilas] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [centros, setCentros] = useState([]);
  // Los modales: el ítem (alta o edición) y el pedido de un repuesto. Cada
  // uno guarda la fila sobre la que trabaja.
  const [modalItem, setModalItem] = useState(null); // { fila?, item }
  // El problema de una fila: se escribe al tocar la x y se ve desde el ojo.
  const [modalProblema, setModalProblema] = useState(null); // { fila, problema, ver }
  const [modalRepuesto, setModalRepuesto] = useState(null); // { fila, form }
  const [guardando, setGuardando] = useState(false);

  const consulta = `cosecha=${cosecha}&seccion=${SECCION}&sistema=${idSistema}`;

  useEffect(() => {
    if (!sistema) return;
    api
      .get(`/ingresos-sanpablo/chequeos?${consulta}`)
      .then((data) => setFilas(Array.isArray(data) ? data : []))
      .catch(() => setFilas([]))
      .finally(() => setCargando(false));
  }, [consulta, sistema]);

  // Los C.C. de las Manitous, para el pedido de repuestos.
  useEffect(() => {
    api
      .get("/centros-costo")
      .then((data) =>
        setCentros(
          (Array.isArray(data) ? data : [])
            .filter((c) => (c.equipo || "").trim() === "Manitou")
            .sort((a, b) => compararCC(a.cc, b.cc))
        )
      )
      .catch(() => setCentros([]));
  }, []);

  if (!sistema) return <Error404 />;

  const reemplazar = (fila) => setFilas((prev) => prev.map((f) => (f._id === fila._id ? fila : f)));
  const error = (titulo, err) => Swal.fire({ icon: "error", title: titulo, text: err.message });

  const cambiar = async (fila, cambios) => {
    try {
      reemplazar(await api.put(`/ingresos-sanpablo/chequeos/${fila._id}`, cambios));
      return true;
    } catch (err) {
      error("No se pudo guardar", err);
      return false;
    }
  };

  // ── Ítem ──
  const guardarItem = async (e) => {
    e.preventDefault();
    setGuardando(true);
    try {
      if (modalItem.fila) {
        if (await cambiar(modalItem.fila, { item: modalItem.item })) setModalItem(null);
      } else {
        const nueva = await api.post("/ingresos-sanpablo/chequeos", {
          cosecha,
          seccion: SECCION,
          sistema: idSistema,
          item: modalItem.item,
        });
        setFilas((prev) => [...prev, nueva]);
        setModalItem(null);
      }
    } catch (err) {
      error("No se pudo guardar", err);
    } finally {
      setGuardando(false);
    }
  };

  const borrar = async (fila) => {
    const { isConfirmed } = await Swal.fire({
      icon: "warning",
      title: "¿Borrar el ítem?",
      text: fila.repuestos?.length
        ? `${fila.item}. Los repuestos ya pedidos siguen en Compras.`
        : fila.item,
      showCancelButton: true,
      confirmButtonText: "Borrar",
      cancelButtonText: "Cancelar",
      confirmButtonColor: ROJO,
    });
    if (!isConfirmed) return;
    try {
      await api.delete(`/ingresos-sanpablo/chequeos/${fila._id}`);
      setFilas((prev) => prev.filter((f) => f._id !== fila._id));
    } catch (err) {
      error("No se pudo borrar", err);
    }
  };

  // ── Con problema ──
  // La x guarda el problema escrito; desde el ojo se corrige o se saca.
  const guardarProblema = async (e) => {
    e.preventDefault();
    setGuardando(true);
    const ok = await cambiar(modalProblema.fila, { tarea: "x", problema: modalProblema.problema });
    setGuardando(false);
    if (ok) setModalProblema(null);
  };

  const sacarProblema = async () => {
    const { isConfirmed } = await Swal.fire({
      icon: "question",
      title: "¿Sacar el problema?",
      text: "Se borra lo escrito.",
      showCancelButton: true,
      confirmButtonText: "Sacar",
      cancelButtonText: "Cancelar",
      confirmButtonColor: ROJO,
    });
    if (!isConfirmed) return;
    setGuardando(true);
    const ok = await cambiar(modalProblema.fila, { tarea: null });
    setGuardando(false);
    if (ok) setModalProblema(null);
  };

  // ── Repuestos ──
  // Guardar lo anota en la fila sin pedirlo; Pedir genera el pedido en
  // Compras. Uno ya guardado (`repuestoId`) se corrige o se pide igual.
  const enviarRepuesto = async (e) => {
    e.preventDefault();
    const pedirlo = e.nativeEvent.submitter?.value === "pedir";
    const { fila, form, repuestoId } = modalRepuesto;
    const base = `/ingresos-sanpablo/chequeos/${fila._id}/repuestos`;
    const datos = { ...form, cant: Number(form.cant), pedir: pedirlo };
    setGuardando(true);
    try {
      const nueva = repuestoId ? await api.put(`${base}/${repuestoId}`, datos) : await api.post(base, datos);
      reemplazar(nueva);
      setModalRepuesto(null);
      const r = repuestoId ? nueva.repuestos.find((x) => x._id === repuestoId) : nueva.repuestos.at(-1);
      Swal.fire({
        icon: "success",
        title: pedirlo ? "Repuesto pedido" : "Repuesto guardado",
        text: pedirlo && r?.nro_pedido ? `Pedido ${fmtNro(r.nro_pedido, "sanpablo", "reparaciones")} en Compras.` : undefined,
        timer: 1600,
        showConfirmButton: false,
      });
    } catch (err) {
      error(pedirlo ? "No se pudo pedir" : "No se pudo guardar", err);
    } finally {
      setGuardando(false);
    }
  };

  const borrarRepuesto = async () => {
    const { fila, repuestoId, form } = modalRepuesto;
    const { isConfirmed } = await Swal.fire({
      icon: "warning",
      title: "¿Borrar el repuesto?",
      text: form.nombre_repuesto,
      showCancelButton: true,
      confirmButtonText: "Borrar",
      cancelButtonText: "Cancelar",
      confirmButtonColor: ROJO,
    });
    if (!isConfirmed) return;
    setGuardando(true);
    try {
      reemplazar(await api.delete(`/ingresos-sanpablo/chequeos/${fila._id}/repuestos/${repuestoId}`));
      setModalRepuesto(null);
    } catch (err) {
      error("No se pudo borrar", err);
    } finally {
      setGuardando(false);
    }
  };

  const abrirRepuesto = (fila, r) =>
    setModalRepuesto({
      fila,
      repuestoId: r._id,
      form: {
        nombre_repuesto: r.nombre_repuesto,
        cant: String(r.cant),
        unidad: r.unidad,
        cc: r.cc,
        urgencia: r.urgencia,
        descripcion: r.descripcion || "",
      },
    });

  const cambiarRepuesto = (campoForm, valor) =>
    setModalRepuesto((m) => ({ ...m, form: { ...m.form, [campoForm]: valor } }));

  const chequeados = filas.filter((f) => f.chequeado).length;
  const conProblema = filas.filter((f) => f.tarea === "x").length;

  const encabezadoModal = (icono, texto) => (
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
        <i className={`bi ${icono}`}></i>
        <span>{texto}</span>
      </Modal.Title>
    </Modal.Header>
  );

  const pieModal = (onCancelar, textoOk, iconoOk, deshabilitado) => (
    <Modal.Footer
      className="bg-light border-0 py-2 px-4"
      style={{ borderBottomLeftRadius: "1rem", borderBottomRightRadius: "1rem" }}
    >
      <Button
        variant="outline-secondary"
        size="sm"
        onClick={onCancelar}
        className="rounded-3 px-3 py-1"
        style={{ fontSize: "0.84rem" }}
      >
        Cancelar
      </Button>
      <Button
        size="sm"
        type="submit"
        disabled={deshabilitado}
        className="rounded-3 px-3 py-1 shadow-sm d-flex align-items-center gap-1"
        style={{ backgroundColor: "#15803d", borderColor: "#15803d", fontSize: "0.84rem", fontWeight: 600 }}
      >
        <i className={`bi ${iconoOk}`}></i>
        <span>{textoOk}</span>
      </Button>
    </Modal.Footer>
  );

  const etiqueta = (texto, obligatorio = false) => (
    <Form.Label className="fw-semibold text-dark small mb-1">
      {texto} {obligatorio && <span className="text-danger">*</span>}
    </Form.Label>
  );

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
      {/* La cosecha y el sistema van en el encabezado de la pantalla. */}
      <NavbarSanPablo
        icono={<i className={sistema.icono}></i>}
        volverA={`/reparaciones/sanpablo/${param}/manitous/general`}
      />

      <Container
        fluid
        className="px-3 py-3 d-flex flex-column flex-grow-1"
        style={{ maxWidth: "980px", width: "100%", margin: "0 auto", overflow: "hidden" }}
      >
        {/* Encabezado: Manitou bien visible, el sistema y la cosecha. */}
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
          <div>
            <div className="fw-bold" style={{ fontSize: "1.5rem", lineHeight: 1, color: VERDE, letterSpacing: "0.02em" }}>
              MANITOU · {sistema.titulo.toUpperCase()}
            </div>
            <div className="text-secondary fw-semibold" style={{ fontSize: "0.82rem" }}>
              General · Cosecha {param}
            </div>
          </div>
          {!cargando && (
            <span
              className="px-2 py-1 rounded-3"
              style={{ fontSize: "0.76rem", backgroundColor: COLOR_SUAVE, color: COLOR, fontWeight: 600 }}
            >
              {filas.length} {filas.length === 1 ? "ítem" : "ítems"} · {chequeados} OK
              {conProblema > 0 && ` · ${conProblema} con problema`}
            </span>
          )}
          <div className="ms-auto" />
          <Button
            size="sm"
            onClick={() => setModalItem({ item: "" })}
            disabled={sinEditar}
            title={sinEditar ? "Sin permiso para editar" : undefined}
            className="rounded-3 px-3 d-flex align-items-center gap-2"
            style={{ backgroundColor: COLOR, borderColor: COLOR, fontSize: "0.78rem", height: "30px", fontWeight: 600 }}
          >
            <i className="bi bi-plus-lg"></i>
            <span>Nuevo ítem</span>
          </Button>
        </div>

        <div
          className="shadow-sm rounded-3 bg-white"
          style={{
            flex: "0 1 auto",
            minHeight: 0,
            maxWidth: "100%",
            overflowY: "auto",
            overflowX: "hidden",
            border: "1px solid #cbd5e1",
          }}
        >
          <Table className="mb-0 tabla-informe" style={{ width: "100%" }}>
            <thead style={{ position: "sticky", top: 0, zIndex: 1 }}>
              <tr>
                <th style={{ ...thCentro, width: "36px" }}>#</th>
                <th style={th}>Ítem</th>
                <th style={{ ...thCentro, width: "90px" }}>OK</th>
                <th style={{ ...thCentro, width: "90px" }}>Con problema</th>
                <th style={th}>Repuestos</th>
                <th style={{ ...thCentro, width: "70px" }}></th>
              </tr>
            </thead>
            <tbody>
              {cargando ? (
                <tr>
                  <td colSpan={6} className="text-center text-muted py-4" style={td}>
                    Cargando…
                  </td>
                </tr>
              ) : filas.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center text-muted py-4" style={td}>
                    Sin ítems. Cargalos con Nuevo ítem.
                  </td>
                </tr>
              ) : (
                filas.map((f, idx) => (
                  <tr key={f._id}>
                    <td style={{ ...tdCentro, color: "#94a3b8" }}>{idx + 1}</td>
                    <td style={{ ...td, fontWeight: 600 }}>{f.item}</td>
                    <td style={{ ...tdCentro, padding: "3px 5px" }}>
                      <CirculoOk
                        marcado={f.chequeado}
                        onClick={() => cambiar(f, { chequeado: !f.chequeado })}
                        deshabilitado={sinEditar}
                      />
                    </td>
                    <td style={{ ...tdCentro, padding: "3px 5px" }}>
                      <div className="d-flex justify-content-center align-items-center">
                        {/* El ojo se puede abrir para leer aun sin permiso. */}
                        <CirculoProblema
                          conProblema={f.tarea === "x"}
                          onClick={() =>
                            setModalProblema(
                              f.tarea === "x"
                                ? { fila: f, problema: f.problema, ver: true }
                                : { fila: f, problema: "", ver: false }
                            )
                          }
                          deshabilitado={sinEditar && f.tarea !== "x"}
                        />
                      </div>
                    </td>
                    <td style={td}>
                      <div className="d-flex align-items-start gap-2">
                        <BotonAccion
                          icono="bi-plus-lg"
                          titulo={sinEditar ? "Sin permiso para editar" : "Agregar un repuesto"}
                          variante="success"
                          onClick={() => setModalRepuesto({ fila: f, form: { ...REPUESTO_INIT } })}
                          deshabilitado={sinEditar}
                        />
                        <div className="d-flex flex-column" style={{ minWidth: 0 }}>
                          {f.repuestos?.length ? (
                            f.repuestos.map((r) => (
                              <span
                                key={r._id}
                                title={[r.descripcion, `Urgencia ${r.urgencia}`, r.solicita && `Pidió ${r.solicita}`]
                                  .filter(Boolean)
                                  .join(" · ")}
                              >
                                {r.nombre_repuesto}
                                <span className="text-muted" style={{ fontSize: "0.66rem" }}>
                                  {" "}
                                  · {r.cant} {r.unidad} · {r.cc}
                                  {r.pedido && r.nro_pedido ? ` · Pedido ${fmtNro(r.nro_pedido, "sanpablo", "reparaciones")}` : ""}
                                </span>
                                {/* Guardado y sin pedir: se abre para corregirlo o pedirlo. */}
                                {!r.pedido && (
                                  <button
                                    type="button"
                                    onClick={() => abrirRepuesto(f, r)}
                                    className="ms-1 px-1 rounded-1 border-0"
                                    style={{
                                      backgroundColor: "#fef3c7",
                                      color: "#b45309",
                                      fontSize: "0.6rem",
                                      fontWeight: 700,
                                      cursor: "pointer",
                                    }}
                                    title="Guardado, sin pedir: abrir para corregirlo o pedirlo"
                                  >
                                    Sin pedir
                                  </button>
                                )}
                              </span>
                            ))
                          ) : (
                            <span style={{ lineHeight: "24px" }}>
                              <Raya />
                            </span>
                          )}
                        </div>
                      </div>
                    </td>
                    <td style={tdCentro}>
                      <div className="d-flex justify-content-center align-items-center" style={{ gap: "6px" }}>
                        <BotonAccion
                          icono="bi-pencil"
                          titulo={sinEditar ? "Sin permiso para editar" : "Editar el ítem"}
                          variante="primary"
                          onClick={() => setModalItem({ fila: f, item: f.item })}
                          deshabilitado={sinEditar}
                        />
                        <BotonAccion
                          icono="bi-trash"
                          titulo={sinEditar ? "Sin permiso para editar" : "Borrar"}
                          variante="danger"
                          onClick={() => borrar(f)}
                          deshabilitado={sinEditar}
                        />
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </Table>
        </div>
      </Container>

      {/* Modal Ítem (nuevo o editar) */}
      <Modal
        show={Boolean(modalItem)}
        onHide={() => setModalItem(null)}
        centered
        size="sm"
        contentClassName="border-0 shadow-lg rounded-4"
      >
        {encabezadoModal(modalItem?.fila ? "bi-pencil" : "bi-plus-lg", modalItem?.fila ? "Editar ítem" : "Nuevo ítem")}
        {modalItem && (
          <Form onSubmit={guardarItem}>
            <Modal.Body className="p-4">
              {etiqueta("Ítem", true)}
              <Form.Control
                className="rounded-3"
                size="sm"
                style={campo}
                value={modalItem.item}
                placeholder={`Qué se revisa del ${sistema.titulo.toLowerCase()}`}
                onChange={(e) => setModalItem({ ...modalItem, item: e.target.value })}
                autoFocus
                required
              />
            </Modal.Body>
            {pieModal(() => setModalItem(null), "Guardar", "bi-check-lg", guardando)}
          </Form>
        )}
      </Modal>

      {/* Modal Descripción del problema: se escribe al tocar la x y se ve (y
          corrige o se saca) desde el ojo. */}
      <Modal
        show={Boolean(modalProblema)}
        onHide={() => setModalProblema(null)}
        centered
        contentClassName="border-0 shadow-lg rounded-4"
      >
        {encabezadoModal("bi-exclamation-triangle-fill", `Problema · ${modalProblema?.fila.item ?? ""}`)}
        {modalProblema && (
          <Form onSubmit={guardarProblema}>
            <Modal.Body className="p-4">
              {etiqueta("Descripción del problema", true)}
              <Form.Control
                as="textarea"
                rows={5}
                className="rounded-3"
                style={campo}
                value={modalProblema.problema}
                placeholder="Qué problema tiene"
                onChange={(e) => setModalProblema({ ...modalProblema, problema: e.target.value })}
                readOnly={sinEditar}
                autoFocus={!modalProblema.ver}
                required
              />
              {modalProblema.ver && !sinEditar && (
                <Button
                  variant="outline-danger"
                  size="sm"
                  onClick={sacarProblema}
                  disabled={guardando}
                  className="rounded-3 mt-3 d-flex align-items-center gap-1"
                  style={{ fontSize: "0.8rem" }}
                >
                  <i className="bi bi-x-circle"></i>
                  <span>Sacar el problema</span>
                </Button>
              )}
            </Modal.Body>
            {pieModal(() => setModalProblema(null), "Guardar", "bi-check-lg", sinEditar || guardando)}
          </Form>
        )}
      </Modal>

      {/* Modal Repuesto: se guarda en la fila o se pide, y pedido entra a
          Compras como un pedido de San Pablo del grupo Manitou. */}
      <Modal
        show={Boolean(modalRepuesto)}
        onHide={() => setModalRepuesto(null)}
        centered
        contentClassName="border-0 shadow-lg rounded-4"
      >
        {encabezadoModal("bi-box-seam", `Repuesto · ${modalRepuesto?.fila.item ?? ""}`)}
        {modalRepuesto && (
          <Form onSubmit={enviarRepuesto}>
            <Modal.Body className="p-4">
              <Row className="g-3">
                <Col xs={12}>
                  {etiqueta("Nombre de repuesto", true)}
                  <Form.Control
                    className="rounded-3"
                    size="sm"
                    style={campo}
                    value={modalRepuesto.form.nombre_repuesto}
                    onChange={(e) => cambiarRepuesto("nombre_repuesto", e.target.value)}
                    autoFocus
                    required
                  />
                </Col>
                <Col xs={4}>
                  {etiqueta("Cant.", true)}
                  <Form.Control
                    type="number"
                    min={1}
                    step="any"
                    className="rounded-3"
                    size="sm"
                    style={campo}
                    value={modalRepuesto.form.cant}
                    onChange={(e) => cambiarRepuesto("cant", e.target.value)}
                    required
                  />
                </Col>
                <Col xs={4}>
                  {etiqueta("Un.", true)}
                  <Form.Control
                    className="rounded-3"
                    size="sm"
                    style={campo}
                    value={modalRepuesto.form.unidad}
                    placeholder="Un, L, Kg…"
                    onChange={(e) => cambiarRepuesto("unidad", e.target.value)}
                    required
                  />
                </Col>
                <Col xs={4}>
                  {etiqueta("C.C.", true)}
                  <Form.Select
                    className="rounded-3"
                    size="sm"
                    style={campo}
                    value={modalRepuesto.form.cc}
                    onChange={(e) => cambiarRepuesto("cc", e.target.value)}
                    required
                  >
                    <option value="">Elegir…</option>
                    {centros.map((c) => (
                      <option key={c._id} value={c.cc}>
                        {c.cc}
                      </option>
                    ))}
                  </Form.Select>
                </Col>
                <Col xs={12}>
                  {etiqueta("Urgencia", true)}
                  <Form.Select
                    className="rounded-3"
                    size="sm"
                    style={campo}
                    value={modalRepuesto.form.urgencia}
                    onChange={(e) => cambiarRepuesto("urgencia", e.target.value)}
                    required
                  >
                    <option value="">Elegir…</option>
                    {URGENCIAS.map((u) => (
                      <option key={u} value={u}>
                        {u}
                      </option>
                    ))}
                  </Form.Select>
                </Col>
                <Col xs={12}>
                  {etiqueta("Descripción")}
                  <Form.Control
                    as="textarea"
                    rows={3}
                    className="rounded-3"
                    style={campo}
                    value={modalRepuesto.form.descripcion}
                    onChange={(e) => cambiarRepuesto("descripcion", e.target.value)}
                  />
                </Col>
              </Row>
            </Modal.Body>
            {/* Guardar lo deja en la fila sin pedir; Pedir lo manda a Compras. */}
            <Modal.Footer
              className="bg-light border-0 py-2 px-4"
              style={{ borderBottomLeftRadius: "1rem", borderBottomRightRadius: "1rem" }}
            >
              {modalRepuesto.repuestoId && (
                <Button
                  variant="outline-danger"
                  size="sm"
                  onClick={borrarRepuesto}
                  disabled={guardando}
                  className="rounded-3 px-3 py-1 me-auto d-flex align-items-center gap-1"
                  style={{ fontSize: "0.84rem" }}
                >
                  <i className="bi bi-trash"></i>
                  <span>Borrar</span>
                </Button>
              )}
              <Button
                variant="outline-secondary"
                size="sm"
                onClick={() => setModalRepuesto(null)}
                className="rounded-3 px-3 py-1"
                style={{ fontSize: "0.84rem" }}
              >
                Cancelar
              </Button>
              <Button
                size="sm"
                type="submit"
                value="guardar"
                disabled={guardando}
                className="rounded-3 px-3 py-1 shadow-sm d-flex align-items-center gap-1"
                style={{ backgroundColor: COLOR, borderColor: COLOR, fontSize: "0.84rem", fontWeight: 600 }}
              >
                <i className="bi bi-floppy-fill"></i>
                <span>Guardar</span>
              </Button>
              <Button
                size="sm"
                type="submit"
                value="pedir"
                disabled={guardando}
                className="rounded-3 px-3 py-1 shadow-sm d-flex align-items-center gap-1"
                style={{ backgroundColor: "#15803d", borderColor: "#15803d", fontSize: "0.84rem", fontWeight: 600 }}
              >
                <i className="bi bi-send-fill"></i>
                <span>Pedir</span>
              </Button>
            </Modal.Footer>
          </Form>
        )}
      </Modal>
    </div>
  );
}
