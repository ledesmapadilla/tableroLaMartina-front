import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import Swal from "sweetalert2";
import { Container, Table, Button, Form, Modal } from "react-bootstrap";
import { api } from "../../services/api";
import { cosechaDeParam } from "../../utils/cosechas";
import { SISTEMAS_MANITOU, seccionManitou, unidadManitouValida } from "../../utils/sistemasManitou";
import { usePermisos } from "../../context/permisos";
import NavbarSanPablo from "../shared/NavbarSanPablo";
import TractorIcon from "../shared/TractorIcon";
import Error404 from "./Error404";
import { campo, th as thBase, td, tdCentro } from "../compras/formato";
import { Raya, BotonAccion } from "../compras/estilos";
import {
  estadoDeFila,
  exportarChequeoManitou,
  pasaFiltro,
  hayFiltro,
  FILTRO_CHEQUEO_VACIO,
} from "../../helpers/excelManitou";
import FiltroChequeoManitou from "../shared/FiltroChequeoManitou";

// El slate de Mantenimiento, como los ingresos de San Pablo.
const COLOR = "#1e293b";
const VERDE = "#047857";
const VERDE_OK = "#16a34a";

// El estado de una fila sale de sus repuestos (09/10/2026), uno solo y
// mandando el menos avanzado: Pedir cotización si alguno no se mandó al
// analista, Sin cotizar si el analista no lo cotizó, Cotizado si está
// cotizado pero falta el pedido de compra, Pedido si están todos pedidos.
// Lo ya pedido no cuenta para la cotización.
const ESTADOS_FILA = {
  "Pedir cotización": { fondo: "#fee2e2", color: "#b91c1c" },
  "Sin cotizar": { fondo: "#fef3c7", color: "#b45309" },
  Cotizado: { fondo: "#e0e7ff", color: "#3730a3" },
  Pedido: { fondo: "#dcfce7", color: "#15803d" },
};
const ROJO = "#dc2626";
const GRIS = "#9ca3af";
const th = { ...thBase, backgroundColor: COLOR };
const thCentro = { ...th, textAlign: "center" };

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
          ? "Cargar una tarea"
          : pendientes > 0
            ? `${pendientes} sin resolver de ${total}`
            : `${total === 1 ? "La tarea está resuelta" : `Las ${total} tareas están resueltas`}`
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
 *
 * Con `embebido` (09/10/2026) es una sección de la página de una Manitou
 * desplegada (ManitouGeneralSanPablo): sin barra ni pantalla propia, con el
 * sistema de `idSistema` y las filas y cotizaciones que ya trajo la página.
 * Cada cambio de las filas se le avisa con `onFilas(idSistema, filas)`, para
 * el Excel único de la página. El filtro también es de la página (`filtro`):
 * con uno puesto, un sistema sin filas que pasen no se muestra. Con `plegado`
 * se ve solo el título; tocarlo (o la flecha) llama a `onPlegar`.
 */
export default function ChequeosManitou({
  embebido = false,
  idSistema: sistemaProp,
  filasIniciales,
  cotizacionesIniciales,
  onFilas,
  filtro,
  plegado = false,
  onPlegar,
}) {
  const { cosecha: param, unidad, sistema: sistemaParam } = useParams();
  const idSistema = sistemaProp ?? sistemaParam;
  // General es la plantilla (ítems y repuestos); en cada Manitou se trabaja
  // con la copia (09/10/2026).
  const esGeneral = unidad === "general";
  const seccion = seccionManitou(unidad);
  const raiz = `/reparaciones/sanpablo/${param}/manitous/${unidad}`;
  const cosecha = cosechaDeParam(param);
  const sistema = unidadManitouValida(unidad) ? SISTEMAS_MANITOU.find((s) => s.id === idSistema) : null;
  const navigate = useNavigate();
  const { puede } = usePermisos();
  const sinEditar = !puede("sanpablo.ingresos", "editar");

  const [filas, setFilas] = useState(filasIniciales ?? []);
  const [cargando, setCargando] = useState(!filasIniciales);
  // Los modales: el ítem (alta o edición) y los problemas de una fila.
  const [modalItem, setModalItem] = useState(null); // { fila?, item, descripcion }
  // La lista de problemas de una fila: se guarda el id, así la lista se ve
  // al día con cada cambio.
  const [filaProblemas, setFilaProblemas] = useState(null);
  const [nuevoProblema, setNuevoProblema] = useState("");
  const [nuevaDuracion, setNuevaDuracion] = useState("");
  // La tarea que se corrige en su renglón: { id, texto, duracion }.
  const [editandoTarea, setEditandoTarea] = useState(null);
  const [guardando, setGuardando] = useState(false);
  // Lo mandado a cotizar, por repuesto: { [repuestoId]: estado }.
  const [cotizaciones, setCotizaciones] = useState(cotizacionesIniciales ?? {});
  // El filtro de arriba (en General no hay: no se chequea).
  const [filtroPropio, setFiltroPropio] = useState(FILTRO_CHEQUEO_VACIO);
  const filtroActivo = filtro ?? filtroPropio;

  const consulta = `cosecha=${cosecha}&seccion=${seccion}&sistema=${idSistema}`;

  // Embebida, lo trae la página una sola vez para todos los sistemas.
  useEffect(() => {
    if (!sistema || filasIniciales) return;
    api
      .get(`/ingresos-sanpablo/chequeos?${consulta}`)
      .then((data) => setFilas(Array.isArray(data) ? data : []))
      .catch(() => setFilas([]))
      .finally(() => setCargando(false));
  }, [consulta, sistema, filasIniciales]);

  useEffect(() => {
    if (cotizacionesIniciales) return;
    api
      .get("/presupuestos-reparaciones")
      .then((data) => setCotizaciones(Object.fromEntries((Array.isArray(data) ? data : []).map((p) => [p.repuesto, p.estado]))))
      .catch(() => setCotizaciones({}));
  }, [cotizacionesIniciales]);

  useEffect(() => {
    if (onFilas) onFilas(idSistema, filas);
  }, [onFilas, idSistema, filas]);

  if (!sistema) return <Error404 />;

  const pasa = (f) => pasaFiltro(f, filtroActivo, cotizaciones);
  const visibles = filas.filter(pasa);
  const conPendientes = filas.filter((f) => (f.problemas || []).some((p) => !p.resuelto)).length;
  if (embebido && hayFiltro(filtroActivo) && !cargando && visibles.length === 0) return null;

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
        if (await cambiar(modalItem.fila, { item: modalItem.item, descripcion: modalItem.descripcion })) setModalItem(null);
      } else {
        const nueva = await api.post("/ingresos-sanpablo/chequeos", {
          cosecha,
          seccion,
          sistema: idSistema,
          item: modalItem.item,
          descripcion: modalItem.descripcion,
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
      text: esGeneral
        ? `${fila.item}. Se borra también de las Manitou, salvo donde tenga problemas o repuestos pedidos o mandados a cotizar.`
        : fila.repuestos?.length
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
    setNuevaDuracion("");
    setEditandoTarea(null);
    setFilaProblemas(f._id);
  };

  // Agrega lo escrito en el renglón de abajo. Devuelve si quedó guardado.
  const agregarProblema = async (e) => {
    e?.preventDefault();
    if (!nuevoProblema.trim()) return true;
    setGuardando(true);
    try {
      reemplazar(await api.post(rutaProblemas(filaAbierta), { texto: nuevoProblema, duracion: nuevaDuracion }));
      setNuevoProblema("");
      setNuevaDuracion("");
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
      Swal.fire({ icon: "success", title: "Tareas guardadas", timer: 1500, showConfirmButton: false, width: "300px" });
    }
  };

  const alternarResuelto = async (p) => {
    try {
      reemplazar(await api.put(`${rutaProblemas(filaAbierta)}/${p._id}`, { resuelto: !p.resuelto }));
    } catch (err) {
      error("No se pudo guardar", err);
    }
  };

  // Corregir una tarea: el texto y la duración, en su renglón.
  const guardarTarea = async (e) => {
    e?.preventDefault();
    if (!editandoTarea.texto.trim()) return;
    setGuardando(true);
    try {
      reemplazar(
        await api.put(`${rutaProblemas(filaAbierta)}/${editandoTarea.id}`, {
          texto: editandoTarea.texto,
          duracion: editandoTarea.duracion,
        })
      );
      setEditandoTarea(null);
    } catch (err) {
      error("No se pudo guardar", err);
    } finally {
      setGuardando(false);
    }
  };

  const borrarProblema = async (p) => {
    const { isConfirmed } = await Swal.fire({
      icon: "warning",
      title: "¿Borrar la tarea?",
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

  // General no lleva OK, Con problema ni Estado. La descripción del ítem va en
// las dos (en las Manitou, la copiada de General).
  const columnas = esGeneral ? 5 : 8;
  const nombreUnidad = esGeneral ? "Manitous General" : `Manitou ${unidad}`;

  // El OK a mano, solo sin problemas: con problemas se marca resolviéndolos.
  const marcarOk = (f) => cambiar(f, { chequeado: !f.chequeado });

  // El estado de la fila (ver ESTADOS_FILA y helpers/excelManitou.js).
  const estadoDe = (f) => estadoDeFila(f, cotizaciones);

  // Embebida, el Excel es uno solo para toda la página (ManitouGeneralSanPablo).
  const exportarExcel = () =>
    exportarChequeoManitou({
      titulo: `Reparaciones San Pablo — ${nombreUnidad} · ${sistema.titulo} — Cosecha ${param}`,
      archivo: `sanpablo_manitou_${unidad}_${idSistema}_${param}_${new Date().toISOString().slice(0, 10)}.xlsx`,
      secciones: [{ sistema, filas }],
      cotizaciones,
      general: esGeneral,
      filtro: esGeneral ? undefined : filtroActivo,
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
      id={embebido ? idSistema : undefined}
      className={embebido ? "mb-3" : undefined}
      style={
        embebido
          ? { scrollMarginTop: "12px" }
          : {
              flex: 1,
              display: "flex",
              flexDirection: "column",
              backgroundColor: "#f8f9fa",
              height: "100%",
              maxHeight: "100vh",
              overflow: "hidden",
            }
      }
    >
      {/* La cosecha y el sistema van en el encabezado de la pantalla. */}
      {!embebido && (
        <NavbarSanPablo
          icono={<i className={sistema.icono}></i>}
          volverA={raiz}
        />
      )}

      <Container
        fluid
        className={embebido ? "p-0 d-flex flex-column" : "px-3 py-3 d-flex flex-column flex-grow-1"}
        style={{ maxWidth: "980px", width: "100%", margin: "0 auto", overflow: embebido ? "visible" : "hidden" }}
      >
        {/* Encabezado: Manitou bien visible, el sistema y la cosecha. Embebida,
            solo el sistema: la Manitou y la cosecha están arriba de la página. */}
        <div
          className={`d-flex align-items-center ${embebido ? "gap-2 mb-1 pb-1" : `gap-3 pb-2 ${esGeneral ? "mb-3" : "mb-2"}`} flex-wrap`}
          style={{ borderBottom: `${embebido ? 2 : 3}px solid ${VERDE}`, cursor: embebido ? "pointer" : undefined }}
          onClick={embebido ? onPlegar : undefined}
          title={embebido ? (plegado ? "Desplegar" : "Agrupar") : undefined}
        >
          <div
            className="d-flex align-items-center justify-content-center"
            style={{
              width: embebido ? "24px" : "44px",
              height: embebido ? "24px" : "44px",
              borderRadius: embebido ? "7px" : "12px",
              background: "linear-gradient(135deg, #064e3b 0%, #047857 100%)",
              boxShadow: "0 6px 16px rgba(4, 120, 87, 0.35)",
              flexShrink: 0,
            }}
          >
            {embebido ? (
              <i className={sistema.icono} style={{ color: "#fff", fontSize: "0.8rem" }}></i>
            ) : (
              <TractorIcon size="1.6rem" color="#fff" />
            )}
          </div>
          {embebido ? (
            <div className="fw-bold" style={{ fontSize: "0.9rem", lineHeight: 1, color: VERDE, letterSpacing: "0.02em" }}>
              {sistema.titulo.toUpperCase()}
            </div>
          ) : (
            <div>
              <div className="fw-bold" style={{ fontSize: "1.5rem", lineHeight: 1, color: VERDE, letterSpacing: "0.02em" }}>
                MANITOU · {sistema.titulo.toUpperCase()}
              </div>
              <div className="text-secondary fw-semibold" style={{ fontSize: "0.82rem" }}>
                {esGeneral ? "General (plantilla)" : `Manitou ${unidad}`} · Cosecha {param}
              </div>
            </div>
          )}
          <div className="ms-auto" />
          {/* Embebida: cuántos ítems tienen tareas sin resolver y la flecha de
              agrupar/desplegar. */}
          {embebido && (
            <span className="d-flex align-items-center gap-2 text-secondary fw-semibold" style={{ fontSize: "0.74rem" }}>
              {conPendientes} con tareas pendientes
              <i className={`bi ${plegado ? "bi-chevron-down" : "bi-chevron-up"}`} style={{ fontSize: "0.9rem", color: COLOR }}></i>
            </span>
          )}
          {!embebido && (
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
          )}
          {/* Los ítems se cargan solo en General, que los copia a las Manitou. */}
          {esGeneral && (
            <Button
              size="sm"
              onClick={() => setModalItem({ item: "", descripcion: "" })}
              disabled={sinEditar}
              title={sinEditar ? "Sin permiso para editar" : undefined}
              className="rounded-3 px-3 d-flex align-items-center gap-2"
              style={{ backgroundColor: COLOR, borderColor: COLOR, fontSize: "0.78rem", height: "30px", fontWeight: 600 }}
            >
              <i className="bi bi-plus-lg"></i>
              <span>Nuevo ítem</span>
            </Button>
          )}
        </div>

        {!embebido && !esGeneral && (
          <FiltroChequeoManitou valor={filtroPropio} onChange={setFiltroPropio} />
        )}

        <div
          className="shadow-sm rounded-3 bg-white"
          style={{
            // Agrupada, solo queda el título.
            display: plegado ? "none" : undefined,
            flex: "0 1 auto",
            minHeight: 0,
            maxWidth: "100%",
            // Embebida crece con sus filas: scrollea la página entera.
            overflowY: embebido ? "visible" : "auto",
            overflowX: "hidden",
            border: "1px solid #cbd5e1",
          }}
        >
          <Table className="mb-0 tabla-informe" style={{ width: "100%" }}>
            <thead style={{ position: "sticky", top: 0, zIndex: 1 }}>
              <tr>
                <th style={{ ...thCentro, width: "36px" }}>#</th>
                {/* La descripción se lleva el resto del ancho. */}
                <th style={{ ...th, width: "24%" }}>Ítem</th>
                <th style={th}>Descripción</th>
                {/* En General (la plantilla) no se chequea: solo ítem y repuestos. */}
                {!esGeneral && <th style={{ ...thCentro, width: "44px" }}>OK</th>}
                {!esGeneral && <th style={{ ...thCentro, width: "64px" }}>Tareas</th>}
                <th style={{ ...thCentro, width: "72px" }}>Repuestos</th>
                {!esGeneral && <th style={{ ...thCentro, width: "108px" }}>Estado</th>}
                <th style={{ ...thCentro, width: "64px" }}></th>
              </tr>
            </thead>
            <tbody>
              {cargando ? (
                <tr>
                  <td colSpan={columnas} className="text-center text-muted py-4" style={td}>
                    Cargando…
                  </td>
                </tr>
              ) : filas.length === 0 ? (
                <tr>
                  <td colSpan={columnas} className="text-center text-muted py-4" style={td}>
                    {esGeneral ? "Sin ítems. Cargalos con Nuevo ítem." : "Sin ítems. Se cargan en General."}
                  </td>
                </tr>
              ) : visibles.length === 0 ? (
                <tr>
                  <td colSpan={columnas} className="text-center text-muted py-4" style={td}>
                    Ningún ítem coincide con los filtros.
                  </td>
                </tr>
              ) : (
                // El número es el de la tabla completa, aun filtrada.
                filas.map((f, idx) => pasa(f) && (
                  <tr key={f._id}>
                    <td style={{ ...tdCentro, color: "#94a3b8" }}>{idx + 1}</td>
                    <td style={{ ...td, fontWeight: 600 }}>{f.item}</td>
                    <td style={{ ...td, color: "#475569" }}>{f.descripcion || <Raya />}</td>
                    {!esGeneral && (
                      <>
                        <td style={{ ...tdCentro, padding: "3px 5px" }}>
                          <CirculoOk
                            marcado={f.chequeado}
                            onClick={() => marcarOk(f)}
                            deshabilitado={sinEditar || (f.problemas || []).length > 0}
                            titulo={
                              (f.problemas || []).length > 0
                                ? f.chequeado
                                  ? "OK: todas las tareas están resueltas"
                                  : "Se marca OK resolviendo las tareas"
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
                      </>
                    )}
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
                            onClick={() => navigate(`${raiz}/${idSistema}/${f._id}`)}
                          />
                        ) : esGeneral ? (
                          <BotonAccion
                            icono="bi-plus-lg"
                            titulo={sinEditar ? "Sin permiso para editar" : "Agregar repuestos"}
                            variante="success"
                            onClick={() => navigate(`${raiz}/${idSistema}/${f._id}`)}
                            deshabilitado={sinEditar}
                          />
                        ) : (
                          <Raya />
                        )}
                      </div>
                    </td>
                    {!esGeneral && (
                      <td style={tdCentro}>
                        {estadoDe(f) ? (
                          <span
                            className="px-2 rounded-1"
                            style={{
                              backgroundColor: ESTADOS_FILA[estadoDe(f)].fondo,
                              color: ESTADOS_FILA[estadoDe(f)].color,
                              fontSize: "0.66rem",
                              fontWeight: 700,
                              whiteSpace: "nowrap",
                            }}
                          >
                            {estadoDe(f)}
                          </span>
                        ) : (
                          <Raya />
                        )}
                      </td>
                    )}
                    <td style={tdCentro}>
                      {/* En General se edita y se borra (y se copia a las
                          Manitou); en una Manitou solo se borra una fila que
                          quedó suelta al borrarse la de General. */}
                      <div className="d-flex justify-content-center align-items-center" style={{ gap: "6px" }}>
                        {esGeneral && (
                          <BotonAccion
                            icono="bi-pencil"
                            titulo={sinEditar ? "Sin permiso para editar" : "Editar el ítem"}
                            variante="primary"
                            onClick={() => setModalItem({ fila: f, item: f.item, descripcion: f.descripcion || "" })}
                            deshabilitado={sinEditar}
                          />
                        )}
                        {(esGeneral || !f.origen) && (
                          <BotonAccion
                            icono="bi-trash"
                            titulo={sinEditar ? "Sin permiso para editar" : "Borrar"}
                            variante="danger"
                            onClick={() => borrar(f)}
                            deshabilitado={sinEditar}
                          />
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
              <div className="mt-3">{etiqueta("Descripción")}</div>
              <Form.Control
                as="textarea"
                rows={2}
                className="rounded-3"
                size="sm"
                style={campo}
                value={modalItem.descripcion}
                placeholder="Una breve descripción (opcional)"
                onChange={(e) => setModalItem({ ...modalItem, descripcion: e.target.value })}
              />
            </Modal.Body>
            {pieModal(() => setModalItem(null), "Guardar", "bi-check-lg", guardando)}
          </Form>
        )}
      </Modal>

      {/* Modal Tareas (antes "problemas"; en el código siguen llamándose así):
          la lista de la fila, cada una con su círculo de resuelta, su
          duración y su borrar, y el renglón para sumar otra. */}
      <Modal
        show={Boolean(filaAbierta)}
        onHide={() => setFilaProblemas(null)}
        centered
        dialogClassName="modal-problemas"
        contentClassName="border-0 shadow-lg rounded-4"
      >
        {encabezadoModal("bi-exclamation-triangle-fill", `Tareas · ${filaAbierta?.item ?? ""}`)}
        {filaAbierta && (
          <>
            <Modal.Body className="p-3">
              <div className="rounded-3 bg-white" style={{ border: "1px solid #cbd5e1", overflow: "hidden" }}>
                <Table className="mb-0 tabla-informe" style={{ width: "100%" }}>
                  <thead>
                    <tr>
                      <th style={{ ...thCentro, width: "70px" }}>Resuelto</th>
                      <th style={th}>Tarea</th>
                      <th style={{ ...thCentro, width: "100px" }}>Duración (días)</th>
                      <th style={{ ...thCentro, width: "70px" }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {(filaAbierta.problemas || []).length === 0 ? (
                      <tr>
                        <td colSpan={4} className="text-center text-muted py-3" style={td}>
                          Sin tareas.
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
                            {editandoTarea?.id === p._id ? (
                              <Form.Control
                                size="sm"
                                className="rounded-3"
                                style={campo}
                                value={editandoTarea.texto}
                                onChange={(e) => setEditandoTarea({ ...editandoTarea, texto: e.target.value })}
                                onKeyDown={(e) => e.key === "Enter" && guardarTarea(e)}
                                autoFocus
                              />
                            ) : (
                              p.texto
                            )}
                          </td>
                          <td style={{ ...tdCentro, color: p.resuelto ? "#94a3b8" : undefined }}>
                            {editandoTarea?.id === p._id ? (
                              <Form.Control
                                size="sm"
                                className="rounded-3"
                                style={campo}
                                value={editandoTarea.duracion}
                                placeholder="Días"
                                onChange={(e) => setEditandoTarea({ ...editandoTarea, duracion: e.target.value })}
                                onKeyDown={(e) => e.key === "Enter" && guardarTarea(e)}
                              />
                            ) : (
                              p.duracion || <Raya />
                            )}
                          </td>
                          <td style={tdCentro}>
                            <div className="d-flex justify-content-center" style={{ gap: "6px" }}>
                              {editandoTarea?.id === p._id ? (
                                <>
                                  <BotonAccion
                                    icono="bi-check-lg"
                                    titulo="Guardar"
                                    variante="success"
                                    onClick={() => guardarTarea()}
                                    deshabilitado={guardando || !editandoTarea.texto.trim()}
                                  />
                                  <BotonAccion icono="bi-x-lg" titulo="Cancelar" onClick={() => setEditandoTarea(null)} />
                                </>
                              ) : (
                                <>
                                  <BotonAccion
                                    icono="bi-pencil"
                                    titulo={sinEditar ? "Sin permiso para editar" : "Editar"}
                                    variante="primary"
                                    onClick={() => setEditandoTarea({ id: p._id, texto: p.texto, duracion: p.duracion || "" })}
                                    deshabilitado={sinEditar}
                                  />
                                  <BotonAccion
                                    icono="bi-trash"
                                    titulo={sinEditar ? "Sin permiso para editar" : "Borrar"}
                                    variante="danger"
                                    onClick={() => borrarProblema(p)}
                                    deshabilitado={sinEditar}
                                  />
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

              {!sinEditar && (
                <Form onSubmit={agregarProblema} className="d-flex gap-2 mt-3">
                  <Form.Control
                    size="sm"
                    className="rounded-3"
                    style={campo}
                    value={nuevoProblema}
                    placeholder="Tarea"
                    onChange={(e) => setNuevoProblema(e.target.value)}
                    autoFocus
                  />
                  <Form.Control
                    size="sm"
                    className="rounded-3 flex-shrink-0"
                    style={{ ...campo, width: "110px" }}
                    value={nuevaDuracion}
                    placeholder="Días"
                    title="Cuánto lleva, en días"
                    onChange={(e) => setNuevaDuracion(e.target.value)}
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
