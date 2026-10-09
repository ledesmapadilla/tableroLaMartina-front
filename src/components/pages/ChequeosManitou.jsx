import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import Swal from "sweetalert2";
import { Container, Table, Button, Form, Modal } from "react-bootstrap";
import { api } from "../../services/api";
import { cosechaDeParam } from "../../utils/cosechas";
import { SISTEMAS_MANITOU } from "../../utils/sistemasManitou";
import { usePermisos } from "../../context/permisos";
import NavbarSanPablo from "../shared/NavbarSanPablo";
import TractorIcon from "../shared/TractorIcon";
import Error404 from "./Error404";
import { campo, th as thBase, td, tdCentro } from "../compras/formato";
import { Raya, BotonAccion } from "../compras/estilos";
import { fmtNro } from "../compras/nroPedido";
import { exportarPlanilla } from "../../helpers/excel";

// El slate de Mantenimiento, como los ingresos de San Pablo.
const COLOR = "#1e293b";
const VERDE = "#047857";
const VERDE_OK = "#16a34a";

// El estado de una fila sale de sus repuestos (08/10/2026): manda el menos
// avanzado. Pendiente si alguno no está pedido ni cotizado; Cotizado si todos
// están cotizados o pedidos; Pedido si están todos pedidos.
const ESTADOS_FILA = {
  Pedido: { fondo: "#dcfce7", color: "#15803d" },
  Cotizado: { fondo: "#e0e7ff", color: "#3730a3" },
  Pendiente: { fondo: "#fef3c7", color: "#b45309" },
};
const ROJO = "#dc2626";
const GRIS = "#9ca3af";
const th = { ...thBase, backgroundColor: COLOR };
const thCentro = { ...th, textAlign: "center" };

const SECCION = "manitous-general";

/**
 * El círculo de OK, como el de "Camioneta parada" del check list de
 * camionetas: vacío con borde oscuro y, tocado, lleno de verde con la tilde
 * blanca. Se guarda en el campo `chequeado`.
 */
function CirculoOk({ marcado, onClick, deshabilitado, titulo, tamano = 18 }) {
  const RELLENO = VERDE_OK;
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={deshabilitado}
      title={titulo || `OK: ${marcado ? "sí" : "no"}`}
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
 * El círculo de "Con problema" (08/10/2026): una fila puede tener varios
 * problemas. Sin ninguno es la x roja, que abre la lista para cargar el
 * primero. Con alguno sin resolver es el signo de pregunta lleno de rojo; con
 * todos resueltos, el signo de pregunta sin relleno (gris, porque la fila
 * queda OK).
 */
function CirculoProblema({ total, pendientes, apagado, onClick, deshabilitado, tamano = 18 }) {
  const color = apagado && !pendientes ? GRIS : ROJO;
  const lleno = pendientes > 0;
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={deshabilitado}
      title={
        total === 0
          ? "Cargar un problema"
          : pendientes > 0
            ? `${pendientes} sin resolver de ${total}`
            : `${total === 1 ? "El problema está resuelto" : `Los ${total} problemas están resueltos`}`
      }
      className="d-inline-flex align-items-center justify-content-center p-0"
      style={{
        width: `${tamano}px`,
        height: `${tamano}px`,
        borderRadius: "50%",
        border: `2px solid ${color}`,
        backgroundColor: lleno ? color : "#fff",
        color: lleno ? "#fff" : color,
        transition: "background-color 0.15s, border-color 0.15s, color 0.15s",
        cursor: deshabilitado ? "default" : "pointer",
        opacity: deshabilitado ? 0.6 : 1,
        flexShrink: 0,
      }}
    >
      <i
        className={`bi ${total > 0 ? "bi-question-lg" : "bi-x-lg"}`}
        style={{ fontSize: `${tamano * (total > 0 ? 0.6 : 0.5)}px`, lineHeight: 1 }}
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
  const navigate = useNavigate();
  const { puede } = usePermisos();
  const sinEditar = !puede("sanpablo.ingresos", "editar");

  const [filas, setFilas] = useState([]);
  const [cargando, setCargando] = useState(true);
  // Los modales: el ítem (alta o edición) y los problemas de una fila.
  const [modalItem, setModalItem] = useState(null); // { fila?, item }
  // La lista de problemas de una fila: se guarda el id, así la lista se ve
  // al día con cada cambio.
  const [filaProblemas, setFilaProblemas] = useState(null);
  const [nuevoProblema, setNuevoProblema] = useState("");
  const [guardando, setGuardando] = useState(false);
  // Lo mandado a cotizar, por repuesto: { [repuestoId]: estado }.
  const [cotizaciones, setCotizaciones] = useState({});

  const consulta = `cosecha=${cosecha}&seccion=${SECCION}&sistema=${idSistema}`;

  useEffect(() => {
    if (!sistema) return;
    api
      .get(`/ingresos-sanpablo/chequeos?${consulta}`)
      .then((data) => setFilas(Array.isArray(data) ? data : []))
      .catch(() => setFilas([]))
      .finally(() => setCargando(false));
  }, [consulta, sistema]);

  useEffect(() => {
    api
      .get("/presupuestos-reparaciones")
      .then((data) => setCotizaciones(Object.fromEntries((Array.isArray(data) ? data : []).map((p) => [p.repuesto, p.estado]))))
      .catch(() => setCotizaciones({}));
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
  // Una fila tiene una lista de problemas. Cada uno se marca resuelto con su
  // círculo; con problemas, la fila es OK solo cuando están todos resueltos
  // (lo calcula el back). Sin problemas, el OK se marca a mano.
  const pendientesDe = (f) => (f.problemas || []).filter((p) => !p.resuelto).length;
  const filaAbierta = filaProblemas ? filas.find((f) => f._id === filaProblemas) : null;
  const rutaProblemas = (f) => `/ingresos-sanpablo/chequeos/${f._id}/problemas`;

  const abrirProblemas = (f) => {
    setNuevoProblema("");
    setFilaProblemas(f._id);
  };

  // Agrega lo escrito en el renglón de abajo. Devuelve si quedó guardado.
  const agregarProblema = async (e) => {
    e?.preventDefault();
    if (!nuevoProblema.trim()) return true;
    setGuardando(true);
    try {
      reemplazar(await api.post(rutaProblemas(filaAbierta), { texto: nuevoProblema }));
      setNuevoProblema("");
      return true;
    } catch (err) {
      error("No se pudo guardar", err);
      return false;
    } finally {
      setGuardando(false);
    }
  };

  // Guardar: los círculos y los borrados ya se guardaron al tocarlos; acá se
  // suma lo que haya quedado escrito sin Agregar, y se cierra.
  const guardarProblemas = async () => {
    if (!sinEditar && !(await agregarProblema())) return;
    setFilaProblemas(null);
    if (!sinEditar) {
      Swal.fire({ icon: "success", title: "Problemas guardados", timer: 1500, showConfirmButton: false, width: "300px" });
    }
  };

  const alternarResuelto = async (p) => {
    try {
      reemplazar(await api.put(`${rutaProblemas(filaAbierta)}/${p._id}`, { resuelto: !p.resuelto }));
    } catch (err) {
      error("No se pudo guardar", err);
    }
  };

  const borrarProblema = async (p) => {
    const { isConfirmed } = await Swal.fire({
      icon: "warning",
      title: "¿Borrar el problema?",
      text: p.texto,
      width: "320px",
      showCancelButton: true,
      confirmButtonText: "Sí, borrar",
      cancelButtonText: "Cancelar",
      confirmButtonColor: "#dc2626",
      cancelButtonColor: "#64748b",
    });
    if (!isConfirmed) return;
    try {
      reemplazar(await api.delete(`${rutaProblemas(filaAbierta)}/${p._id}`));
    } catch (err) {
      error("No se pudo borrar", err);
    }
  };

  // El OK a mano, solo sin problemas: con problemas se marca resolviéndolos.
  const marcarOk = (f) => cambiar(f, { chequeado: !f.chequeado });

  const estadoDeRepuesto = (r) => (r.pedido ? "Pedido" : cotizaciones[r._id] === "Cotizado" ? "Cotizado" : "Pendiente");
  const estadoDeFila = (f) => {
    const estados = (f.repuestos || []).map(estadoDeRepuesto);
    if (estados.length === 0) return null;
    if (estados.includes("Pendiente")) return "Pendiente";
    if (estados.includes("Cotizado")) return "Cotizado";
    return "Pedido";
  };

  const estadoRepuesto = (r) =>
    r.pedido && r.nro_pedido ? `Pedido ${fmtNro(r.nro_pedido, "sanpablo", "reparaciones")}` : r.pedido ? "Pedido" : "Sin pedir";

  // La planilla sigue la tabla, con un renglón por repuesto: el ítem se
  // repite para poder filtrarlo en el Excel.
  const exportarExcel = () =>
    exportarPlanilla({
      titulo: `Reparaciones San Pablo — Manitou · ${sistema.titulo} — Cosecha ${param}`,
      columnas: [
        { titulo: "#", ancho: 6 },
        { titulo: "Ítem", ancho: 34 },
        { titulo: "OK", ancho: 8 },
        { titulo: "Con problema", ancho: 40 },
        { titulo: "Repuesto", ancho: 30 },
        { titulo: "Cant.", ancho: 8 },
        { titulo: "Un.", ancho: 8 },
        { titulo: "C.C.", ancho: 10 },
        { titulo: "Urgencia", ancho: 11 },
        { titulo: "Descripción", ancho: 36 },
        { titulo: "Estado", ancho: 16 },
        { titulo: "Estado del ítem", ancho: 14 },
      ],
      filas: filas.flatMap((f, idx) => {
        const problemas = (f.problemas || []).map((p) => `${p.texto}${p.resuelto ? " (resuelto)" : ""}`).join(" · ");
        const base = [idx + 1, f.item, f.chequeado ? "Sí" : "", problemas];
        const repuestos = f.repuestos || [];
        if (repuestos.length === 0) return [[...base, "", "", "", "", "", "", "", ""]];
        return repuestos.map((r) => [
          ...base,
          r.nombre_repuesto,
          r.cant,
          r.unidad,
          r.cc,
          r.urgencia,
          r.descripcion || "",
          estadoRepuesto(r),
          estadoDeFila(f),
        ]);
      }),
      hoja: "Chequeo",
      archivo: `sanpablo_manitou_${idSistema}_${param}_${new Date().toISOString().slice(0, 10)}.xlsx`,
    });

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
          <div className="ms-auto" />
          <Button
            size="sm"
            onClick={exportarExcel}
            disabled={filas.length === 0}
            className="rounded-3 px-3 d-flex align-items-center gap-2"
            style={{ backgroundColor: "#15803d", borderColor: "#15803d", fontSize: "0.78rem", height: "30px", fontWeight: 600 }}
            title="Exportar a Excel"
          >
            <i className="bi bi-file-earmark-excel-fill"></i>
            <span>Excel</span>
          </Button>
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
                <th style={{ ...thCentro, width: "90px" }}>Repuestos</th>
                <th style={{ ...thCentro, width: "100px" }}>Estado</th>
                <th style={{ ...thCentro, width: "70px" }}></th>
              </tr>
            </thead>
            <tbody>
              {cargando ? (
                <tr>
                  <td colSpan={7} className="text-center text-muted py-4" style={td}>
                    Cargando…
                  </td>
                </tr>
              ) : filas.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center text-muted py-4" style={td}>
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
                        onClick={() => marcarOk(f)}
                        deshabilitado={sinEditar || (f.problemas || []).length > 0}
                        titulo={
                          (f.problemas || []).length > 0
                            ? f.chequeado
                              ? "OK: todos los problemas están resueltos"
                              : "Se marca OK resolviendo los problemas"
                            : undefined
                        }
                      />
                    </td>
                    <td style={{ ...tdCentro, padding: "3px 5px" }}>
                      <div className="d-flex justify-content-center align-items-center">
                        {/* Con problemas se puede abrir para leer aun sin permiso. */}
                        <CirculoProblema
                          total={(f.problemas || []).length}
                          pendientes={pendientesDe(f)}
                          apagado={f.chequeado}
                          onClick={() => abrirProblemas(f)}
                          deshabilitado={sinEditar && !(f.problemas || []).length}
                        />
                      </div>
                    </td>
                    <td style={{ ...tdCentro, padding: "3px 5px" }}>
                      {/* Solo el botón: los repuestos tienen su hoja. Con
                          repuestos, el + pasa a ser el ojo, que se puede abrir
                          aun sin permiso. */}
                      <div className="d-flex justify-content-center align-items-center">
                        {f.repuestos?.length ? (
                          <BotonAccion
                            icono="bi-eye"
                            titulo="Ver los repuestos"
                            variante="primary"
                            onClick={() => navigate(`/reparaciones/sanpablo/${param}/manitous/general/${idSistema}/${f._id}`)}
                          />
                        ) : (
                          <BotonAccion
                            icono="bi-plus-lg"
                            titulo={sinEditar ? "Sin permiso para editar" : "Agregar repuestos"}
                            variante="success"
                            onClick={() => navigate(`/reparaciones/sanpablo/${param}/manitous/general/${idSistema}/${f._id}`)}
                            deshabilitado={sinEditar}
                          />
                        )}
                      </div>
                    </td>
                    <td style={tdCentro}>
                      {estadoDeFila(f) ? (
                        <span
                          className="px-2 rounded-1"
                          style={{
                            backgroundColor: ESTADOS_FILA[estadoDeFila(f)].fondo,
                            color: ESTADOS_FILA[estadoDeFila(f)].color,
                            fontSize: "0.66rem",
                            fontWeight: 700,
                          }}
                        >
                          {estadoDeFila(f)}
                        </span>
                      ) : (
                        <Raya />
                      )}
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

      {/* Modal Problemas: la lista de la fila, cada uno con su círculo de
          resuelto y su borrar, y el renglón para sumar otro. */}
      <Modal
        show={Boolean(filaAbierta)}
        onHide={() => setFilaProblemas(null)}
        centered
        contentClassName="border-0 shadow-lg rounded-4"
      >
        {encabezadoModal("bi-exclamation-triangle-fill", `Problemas · ${filaAbierta?.item ?? ""}`)}
        {filaAbierta && (
          <>
            <Modal.Body className="p-3">
              <div className="rounded-3 bg-white" style={{ border: "1px solid #cbd5e1", overflow: "hidden" }}>
                <Table className="mb-0 tabla-informe" style={{ width: "100%" }}>
                  <thead>
                    <tr>
                      <th style={{ ...thCentro, width: "70px" }}>Resuelto</th>
                      <th style={th}>Problema</th>
                      <th style={{ ...thCentro, width: "44px" }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {(filaAbierta.problemas || []).length === 0 ? (
                      <tr>
                        <td colSpan={3} className="text-center text-muted py-3" style={td}>
                          Sin problemas.
                        </td>
                      </tr>
                    ) : (
                      filaAbierta.problemas.map((p) => (
                        <tr key={p._id}>
                          <td style={{ ...tdCentro, padding: "3px 5px" }}>
                            <div className="d-flex justify-content-center">
                              <CirculoOk
                                marcado={p.resuelto}
                                onClick={() => alternarResuelto(p)}
                                deshabilitado={sinEditar}
                                titulo={p.resuelto ? "Resuelto" : "Marcar resuelto"}
                              />
                            </div>
                          </td>
                          <td
                            style={{
                              ...td,
                              whiteSpace: "pre-wrap",
                              color: p.resuelto ? "#94a3b8" : undefined,
                              textDecoration: p.resuelto ? "line-through" : undefined,
                            }}
                          >
                            {p.texto}
                          </td>
                          <td style={tdCentro}>
                            <div className="d-flex justify-content-center">
                              <BotonAccion
                                icono="bi-trash"
                                titulo={sinEditar ? "Sin permiso para editar" : "Borrar"}
                                variante="danger"
                                onClick={() => borrarProblema(p)}
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

              {!sinEditar && (
                <Form onSubmit={agregarProblema} className="d-flex gap-2 mt-3">
                  <Form.Control
                    size="sm"
                    className="rounded-3"
                    style={campo}
                    value={nuevoProblema}
                    onChange={(e) => setNuevoProblema(e.target.value)}
                    autoFocus
                  />
                  <Button
                    size="sm"
                    type="submit"
                    disabled={guardando || !nuevoProblema.trim()}
                    className="rounded-3 px-3 d-flex align-items-center gap-1 flex-shrink-0"
                    style={{ backgroundColor: COLOR, borderColor: COLOR, fontSize: "0.8rem", fontWeight: 600 }}
                  >
                    <i className="bi bi-plus-lg"></i>
                    <span>Agregar</span>
                  </Button>
                </Form>
              )}
            </Modal.Body>
            <Modal.Footer
              className="bg-light border-0 py-2 px-4"
              style={{ borderBottomLeftRadius: "1rem", borderBottomRightRadius: "1rem" }}
            >
              <Button
                size="sm"
                onClick={guardarProblemas}
                disabled={guardando}
                className="rounded-3 px-3 py-1 shadow-sm d-flex align-items-center gap-1"
                style={{ backgroundColor: "#15803d", borderColor: "#15803d", fontSize: "0.84rem", fontWeight: 600 }}
              >
                <i className="bi bi-check-lg"></i>
                <span>Guardar</span>
              </Button>
            </Modal.Footer>
          </>
        )}
      </Modal>
    </div>
  );
}
