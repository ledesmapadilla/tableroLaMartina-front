import { Fragment, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import Swal from "sweetalert2";
import { Container, Table, Button, Form, Modal } from "react-bootstrap";
import { api } from "../../services/api";
import { cosechaDeParam } from "../../utils/cosechas";
import { SISTEMAS_MANITOU, seccionManitou, unidadManitouValida, fmtPct } from "../../utils/sistemasManitou";
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
// analista, Cotizando si el analista no lo cotizó, Cotizado si está
// cotizado pero falta el pedido de compra, Pedido si están todos pedidos.
// Lo ya pedido no cuenta para la cotización.
const ESTADOS_FILA = {
  "Pedir cotización": { fondo: "#fee2e2", color: "#b91c1c" },
  "Cotizando": { fondo: "#fef3c7", color: "#b45309" },
  Cotizado: { fondo: "#e0e7ff", color: "#3730a3" },
  Pedido: { fondo: "#dcfce7", color: "#15803d" },
};
const ROJO = "#dc2626";
const th = { ...thBase, backgroundColor: COLOR };
const thCentro = { ...th, textAlign: "center" };

/**
 * El círculo de OK, como el de "Camioneta parada" del check list de
 * camionetas: vacío con borde oscuro y, tocado, lleno de verde con la tilde
 * blanca. Se guarda en el campo `chequeado`.
 */
/**
 * Un % de una tarea que se escribe en la tabla (21/10/2026): una cajita
 * chica, con el número centrado. Se guarda al salir del campo o con Enter;
 * vacío lo borra. `onGuardar(valor)` guarda; después se muestra lo que quedó
 * en la fila (`actual`). `color(valor)` pinta el número.
 */
function CampoPorcentaje({ actual, onGuardar, deshabilitado, titulo, color = () => "#000", oculto = false }) {
  // Lo que se está escribiendo; null muestra lo guardado.
  const [borrador, setBorrador] = useState(null);
  const valor = borrador ?? actual ?? "";
  // Con `oculto` (el peso, 21/10/2026) el valor no se ve: hay un ojo que se
  // toca para verlo y escribirlo (un + si todavía no tiene); al salir se
  // vuelve a tapar.
  const [visible, setVisible] = useState(false);

  const guardar = async () => {
    if (borrador !== null) {
      const nuevo = borrador === "" ? null : Number(borrador);
      if (nuevo !== (actual ?? null)) await onGuardar(nuevo);
      // Guardado o no, vuelve a mostrar lo que tiene la fila.
      setBorrador(null);
    }
    setVisible(false);
  };

  const caja = { width: "38px", height: "20px", borderRadius: "4px" };
  if (oculto && !visible) {
    return (
      <div className="d-flex align-items-center justify-content-center">
        {/* Con peso, el ojo para verlo; sin cargar, el + para escribirlo. */}
        {actual === null || actual === undefined ? (
          <BotonAccion
            icono="bi-plus-lg"
            titulo={deshabilitado ? "Sin permiso para editar" : "Cargar el peso"}
            variante="success"
            onClick={() => setVisible(true)}
            deshabilitado={deshabilitado}
          />
        ) : (
          <BotonAccion icono="bi-eye" titulo="Ver el peso" variante="secondary" onClick={() => setVisible(true)} />
        )}
      </div>
    );
  }
  // Destapado sin permiso de editar: el número, y tocándolo se tapa.
  if (oculto && deshabilitado) {
    return (
      <button
        type="button"
        className="btn btn-link p-0 text-decoration-none fw-bold"
        style={{ fontSize: "0.7rem", color: "#000" }}
        onClick={() => setVisible(false)}
        title="Tocar para tapar"
      >
        {actual === null || actual === undefined ? "–" : `${actual}%`}
      </button>
    );
  }

  const tono = color(valor);
  return (
    <div className="d-flex align-items-center justify-content-center" style={{ gap: "2px" }}>
      <input
        type="number"
        min="0"
        max="100"
        step="any"
        inputMode="decimal"
        // Sin la clase fw-bold: index.css pinta de rojo los input.fw-bold (los
        // filtros con valor) y taparía el color de acá.
        className="form-control form-control-sm text-center"
        style={{ ...caja, fontSize: "0.7rem", padding: "0 2px", fontWeight: 700, color: tono }}
        value={valor}
        placeholder="0"
        // Destapado, el cursor ya queda adentro.
        autoFocus={oculto}
        onChange={(e) => setBorrador(e.target.value)}
        onBlur={guardar}
        onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
        disabled={deshabilitado}
        title={deshabilitado ? "Sin permiso para editar" : titulo}
      />
      <span className="fw-bold" style={{ fontSize: "0.68rem", color: tono }}>
        %
      </span>
    </div>
  );
}

// El color del avance: gris sin cargar o en 0, ámbar a medias, verde al 100.
const colorAvance = (valor) => {
  const n = Number(valor) || 0;
  return valor === "" ? "#94a3b8" : n >= 100 ? VERDE_OK : n > 0 ? "#b45309" : "#64748b";
};

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
 * El modal de las reparaciones de una fila de una Manitou (11/10/2026): una
 * tabla con el problema, el trabajo a realizar (`detalle`), el círculo de
 * realizado con el + de los detalles de la reparación (`notas`, 18/10/2026,
 * se escriben en un renglón que se abre abajo) y el editar y borrar, y abajo
 * el renglón para sumar otra. Los
 * círculos, las ediciones y los borrados se guardan al tocarlos; Guardar
 * suma lo que haya quedado escrito y cierra. `onGuardar(lista)` manda la
 * lista entera y devuelve si quedó guardada.
 */
function ModalReparaciones({ fila, onHide, onGuardar, sinEditar, encabezado }) {
  const [nuevo, setNuevo] = useState({ problema: "", detalle: "" });
  // La que se corrige en su renglón: { id, problema, detalle }.
  const [editando, setEditando] = useState(null);
  // Los detalles abiertos debajo de su renglón: { id, texto }.
  const [notas, setNotas] = useState(null);
  const [guardando, setGuardando] = useState(false);
  const lista = fila?.reparaciones ?? [];

  const guardar = async (nuevaLista) => {
    setGuardando(true);
    try {
      return await onGuardar(nuevaLista);
    } finally {
      setGuardando(false);
    }
  };

  const conEdicion = (l) =>
    editando?.problema.trim()
      ? l.map((r) => (r._id === editando.id ? { ...r, problema: editando.problema, detalle: editando.detalle } : r))
      : l;
  const conNotas = (l) => {
    const r = notas && l.find((x) => x._id === notas.id);
    return r && (r.notas || "") !== notas.texto ? l.map((x) => (x === r ? { ...x, notas: notas.texto } : x)) : l;
  };
  const conNuevo = (l) => (nuevo.problema.trim() ? [...l, { ...nuevo, realizado: false }] : l);

  const abrirNotas = (r) => setNotas(notas?.id === r._id ? null : { id: r._id, texto: r.notas || "" });

  const guardarNotas = async () => {
    if (await guardar(conNotas(lista))) setNotas(null);
  };

  const agregar = async (e) => {
    e?.preventDefault();
    if (!nuevo.problema.trim()) return;
    if (await guardar(conNuevo(lista))) setNuevo({ problema: "", detalle: "" });
  };

  const guardarEdicion = async (e) => {
    e?.preventDefault();
    if (!editando.problema.trim()) return;
    if (await guardar(conEdicion(lista))) setEditando(null);
  };

  const alternar = (r) => guardar(lista.map((x) => (x._id === r._id ? { ...x, realizado: !x.realizado } : x)));

  const borrar = async (r) => {
    const { isConfirmed } = await Swal.fire({
      icon: "warning",
      title: "¿Borrar la reparación?",
      text: r.problema,
      width: "320px",
      showCancelButton: true,
      confirmButtonText: "Sí, borrar",
      cancelButtonText: "Cancelar",
      confirmButtonColor: "#dc2626",
      cancelButtonColor: "#64748b",
    });
    if (!isConfirmed) return;
    guardar(lista.filter((x) => x._id !== r._id));
  };

  const cerrar = () => {
    setNuevo({ problema: "", detalle: "" });
    setEditando(null);
    setNotas(null);
    onHide();
  };

  // Guardar: lo que quedó a medio editar o escrito sin Agregar, y se cierra.
  const guardarYCerrar = async () => {
    const final = conNuevo(conNotas(conEdicion(lista)));
    if (!sinEditar && final !== lista && !(await guardar(final))) return;
    cerrar();
    if (!sinEditar) {
      Swal.fire({ icon: "success", title: "Guardado", timer: 1500, showConfirmButton: false, width: "300px" });
    }
  };

  const campoRenglon = (valor, onChange, placeholder, autoFocus) => (
    <Form.Control
      className="rounded-3"
      size="sm"
      style={campo}
      value={valor}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={(e) => e.key === "Enter" && guardarEdicion(e)}
      autoFocus={autoFocus}
    />
  );

  return (
    <Modal show={Boolean(fila)} onHide={cerrar} centered size="lg" contentClassName="border-0 shadow-lg rounded-4">
      {encabezado}
      <Modal.Body className="p-4">
        <Table className="mb-0 tabla-informe" style={{ width: "100%", border: "1px solid #cbd5e1" }}>
          <thead>
            <tr>
              <th style={{ ...thCentro, width: "36px" }}>#</th>
              <th style={{ ...th, width: "36%" }}>Problema</th>
              {/* La línea fuerte separa el problema de lo que se hizo. */}
              <th className="col-corte" style={th}>Trabajo a realizar</th>
              <th style={{ ...thCentro, width: "96px" }}>Realizado</th>
              {!sinEditar && <th style={{ ...thCentro, width: "72px" }}></th>}
            </tr>
          </thead>
          <tbody>
            {lista.length === 0 ? (
              <tr>
                <td colSpan={sinEditar ? 4 : 5} className="text-center text-muted py-3" style={td}>
                  Sin reparaciones.
                </td>
              </tr>
            ) : (
              lista.map((r, i) => {
                const enEdicion = editando?.id === r._id;
                const notasAbiertas = notas?.id === r._id;
                return (
                  <Fragment key={r._id}>
                  <tr>
                    <td style={{ ...tdCentro, color: "#94a3b8" }}>{i + 1}</td>
                    <td style={{ ...td, whiteSpace: "pre-wrap" }}>
                      {enEdicion
                        ? campoRenglon(editando.problema, (v) => setEditando({ ...editando, problema: v }), "Problema", true)
                        : r.problema}
                    </td>
                    <td className="col-corte" style={{ ...td, whiteSpace: "pre-wrap", color: "#475569" }}>
                      {enEdicion
                        ? campoRenglon(editando.detalle, (v) => setEditando({ ...editando, detalle: v }), "Trabajo a realizar")
                        : r.detalle || <Raya />}
                    </td>
                    <td style={{ ...tdCentro, padding: "3px 5px" }}>
                      {/* El + abre los detalles de la reparación; escritos, pasa
                          a ser el ojo, que se abre aun sin permiso. */}
                      <div className="d-flex justify-content-center align-items-center" style={{ gap: "6px" }}>
                        <CirculoOk
                          marcado={r.realizado}
                          onClick={() => alternar(r)}
                          deshabilitado={sinEditar || guardando}
                          titulo={r.realizado ? "Realizado" : "Marcar como realizado"}
                        />
                        {r.notas ? (
                          <BotonAccion
                            icono="bi-eye"
                            titulo="Ver los detalles de la reparación"
                            variante="primary"
                            onClick={() => abrirNotas(r)}
                          />
                        ) : (
                          <BotonAccion
                            icono="bi-plus-lg"
                            titulo={sinEditar ? "Sin permiso para editar" : "Escribir los detalles de la reparación"}
                            variante="success"
                            onClick={() => abrirNotas(r)}
                            deshabilitado={sinEditar}
                          />
                        )}
                      </div>
                    </td>
                    {!sinEditar && (
                      <td style={tdCentro}>
                        {/* Lápiz y borrar; editando, guardar y cancelar. */}
                        <div className="d-flex justify-content-center" style={{ gap: "6px" }}>
                          {enEdicion ? (
                            <>
                              <BotonAccion
                                icono="bi-check-lg"
                                titulo="Guardar"
                                variante="success"
                                onClick={() => guardarEdicion()}
                                deshabilitado={guardando || !editando.problema.trim()}
                              />
                              <BotonAccion icono="bi-x-lg" titulo="Cancelar" onClick={() => setEditando(null)} />
                            </>
                          ) : (
                            <>
                              <BotonAccion
                                icono="bi-pencil"
                                titulo="Editar"
                                variante="primary"
                                onClick={() => setEditando({ id: r._id, problema: r.problema, detalle: r.detalle || "" })}
                              />
                              <BotonAccion icono="bi-trash" titulo="Borrar" variante="danger" onClick={() => borrar(r)} />
                            </>
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                  {/* Los detalles, en un renglón abajo: sin permiso, solo se leen. */}
                  {notasAbiertas && (
                    <tr>
                      <td style={tdCentro}></td>
                      <td colSpan={sinEditar ? 3 : 4} style={{ ...td, backgroundColor: "#f8fafc" }}>
                        <div className="fw-semibold text-secondary mb-1" style={{ fontSize: "0.74rem" }}>
                          Detalles de la reparación
                        </div>
                        {sinEditar ? (
                          <div style={{ whiteSpace: "pre-wrap", color: "#475569" }}>{r.notas}</div>
                        ) : (
                          <div className="d-flex align-items-start" style={{ gap: "6px" }}>
                            <Form.Control
                              as="textarea"
                              rows={3}
                              className="rounded-3"
                              size="sm"
                              style={campo}
                              value={notas.texto}
                              placeholder="Qué se hizo, repuestos usados, observaciones…"
                              onChange={(e) => setNotas({ ...notas, texto: e.target.value })}
                              autoFocus
                            />
                            <BotonAccion
                              icono="bi-check-lg"
                              titulo="Guardar"
                              variante="success"
                              onClick={guardarNotas}
                              deshabilitado={guardando}
                            />
                            <BotonAccion icono="bi-x-lg" titulo="Cancelar" onClick={() => setNotas(null)} />
                          </div>
                        )}
                      </td>
                    </tr>
                  )}
                  </Fragment>
                );
              })
            )}
          </tbody>
        </Table>
        {!sinEditar && (
          <Form onSubmit={agregar} className="d-flex gap-2 mt-3">
            <Form.Control
              className="rounded-3"
              size="sm"
              style={{ ...campo, flex: "0 0 36%" }}
              value={nuevo.problema}
              placeholder="Problema"
              onChange={(e) => setNuevo({ ...nuevo, problema: e.target.value })}
              autoFocus
            />
            <Form.Control
              className="rounded-3"
              size="sm"
              style={campo}
              value={nuevo.detalle}
              placeholder="Trabajo a realizar"
              onChange={(e) => setNuevo({ ...nuevo, detalle: e.target.value })}
            />
            <Button
              size="sm"
              type="submit"
              disabled={guardando || !nuevo.problema.trim()}
              className="rounded-3 px-3 d-flex align-items-center gap-1"
              style={{ backgroundColor: "#15803d", borderColor: "#15803d", fontSize: "0.84rem", fontWeight: 600, whiteSpace: "nowrap" }}
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
          onClick={guardarYCerrar}
          disabled={guardando}
          className="rounded-3 px-3 py-1 shadow-sm d-flex align-items-center gap-1"
          style={{ backgroundColor: "#15803d", borderColor: "#15803d", fontSize: "0.84rem", fontWeight: 600 }}
        >
          <i className="bi bi-check-lg"></i>
          <span>Guardar</span>
        </Button>
      </Modal.Footer>
    </Modal>
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
 *
 * Con `onEstadoIngreso` (10/10/2026, solo en las Manitou) el título lleva
 * "(estado ingreso)": un modal con las tareas de los problemas con que llegó
 * la máquina en ese sistema, cada una con su círculo de solucionado.
 * `estadoIngreso` es lo guardado ({ tareas }) y cada cambio se le pasa a
 * `onEstadoIngreso`.
 *
 * Con `avance` (21/10/2026, solo en las Manitou) el título lleva el avance
 * del sistema: { parte (0 a 1), hechas, tareas, peso, aporte }, de
 * avanceManitou en utils/sistemasManitou.js.
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
  estadoIngreso,
  onEstadoIngreso,
  avance,
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
  // El modal del ítem (alta o edición).
  const [modalItem, setModalItem] = useState(null); // { fila?, item, descripcion }
  const [guardando, setGuardando] = useState(false);
  // La fila con el modal de reparaciones abierto (su id).
  const [filaReparaciones, setFilaReparaciones] = useState(null);
  // El modal del estado de ingreso y la tarea que se está escribiendo.
  const [modalIngreso, setModalIngreso] = useState(false);
  const [nuevaTareaIngreso, setNuevaTareaIngreso] = useState("");
  // La tarea de ingreso que se corrige en su renglón: { id, texto }.
  const [editandoIngreso, setEditandoIngreso] = useState(null);
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
      title: "¿Borrar la tarea?",
      text: esGeneral
        ? `${fila.item}. Se borra también de las Manitou, salvo donde tenga problemas o repuestos pedidos o mandados a cotizar.`
        : fila.repuestos?.length
          ? `${fila.item}. Los repuestos ya pedidos siguen en Compras.`
          : fila.item,
      width: "320px",
      showCancelButton: true,
      confirmButtonText: "Sí, borrar",
      cancelButtonText: "Cancelar",
      confirmButtonColor: ROJO,
      cancelButtonColor: "#64748b",
    });
    if (!isConfirmed) return;
    try {
      await api.delete(`/ingresos-sanpablo/chequeos/${fila._id}`);
      setFilas((prev) => prev.filter((f) => f._id !== fila._id));
    } catch (err) {
      error("No se pudo borrar", err);
    }
  };
  // General no lleva OK ni Estado. La descripción del ítem va en
// las dos (en las Manitou, la copiada de General).
  const columnas = esGeneral ? 6 : 9;
  // La suma de los pesos de las tareas que aplican (21/10/2026), para el
  // encabezado de la columna Peso.
  const sumaPesos = filas.filter((f) => !f.no_aplica).reduce((t, f) => t + (Number(f.peso) || 0), 0);
  const nombreUnidad = esGeneral ? "Manitous General" : `Manitou ${unidad}`;

  // Las reparaciones de una fila (11/10/2026), solo en las Manitou: el +
  // abre el modal y, con alguna cargada, el ojo (que se abre aun sin
  // permiso). Se guarda el id, así el modal se ve al día con cada cambio.
  const filaConReparaciones = filaReparaciones ? filas.find((f) => f._id === filaReparaciones) : null;
  const guardarReparaciones = (lista) => cambiar(filaConReparaciones, { reparaciones: lista });

  // ── Estado de ingreso ──
  // Las tareas con los problemas que trajo la máquina, cada una con su
  // círculo de solucionado. Cada cambio guarda la lista entera.
  const tareasIngreso = estadoIngreso?.tareas ?? [];
  const pendientesIngreso = tareasIngreso.filter((t) => !t.solucionado).length;

  const guardarTareasIngreso = async (tareas) => {
    setGuardando(true);
    try {
      const doc = await api.put("/ingresos-sanpablo/estado-ingreso", { cosecha, seccion, sistema: idSistema, tareas });
      onEstadoIngreso(doc);
      return true;
    } catch (err) {
      error("No se pudo guardar", err);
      return false;
    } finally {
      setGuardando(false);
    }
  };

  const agregarTareaIngreso = async (e) => {
    e?.preventDefault();
    if (!nuevaTareaIngreso.trim()) return;
    if (await guardarTareasIngreso([...tareasIngreso, { texto: nuevaTareaIngreso, solucionado: false }])) {
      setNuevaTareaIngreso("");
    }
  };

  // Guardar: las tareas, los círculos y los borrados ya se guardaron al
  // tocarlos; acá se guarda lo que haya quedado pendiente, y se cierra.
  const guardarIngreso = async () => {
    // Lo que quedó a medio editar o escrito sin Agregar, en un solo guardado.
    let tareas = tareasIngreso;
    if (editandoIngreso?.texto.trim()) {
      tareas = tareas.map((x) => (x._id === editandoIngreso.id ? { ...x, texto: editandoIngreso.texto } : x));
    }
    if (nuevaTareaIngreso.trim()) tareas = [...tareas, { texto: nuevaTareaIngreso, solucionado: false }];
    if (!sinEditar && tareas !== tareasIngreso) {
      if (!(await guardarTareasIngreso(tareas))) return;
      setNuevaTareaIngreso("");
    }
    setEditandoIngreso(null);
    setModalIngreso(false);
    if (!sinEditar) {
      Swal.fire({ icon: "success", title: "Guardado", timer: 1500, showConfirmButton: false, width: "300px" });
    }
  };

  const guardarEdicionIngreso = async (e) => {
    e?.preventDefault();
    if (!editandoIngreso.texto.trim()) return;
    const tareas = tareasIngreso.map((x) => (x._id === editandoIngreso.id ? { ...x, texto: editandoIngreso.texto } : x));
    if (await guardarTareasIngreso(tareas)) setEditandoIngreso(null);
  };

  const alternarTareaIngreso = (t) =>
    guardarTareasIngreso(tareasIngreso.map((x) => (x._id === t._id ? { ...x, solucionado: !x.solucionado } : x)));

  const borrarTareaIngreso = async (t) => {
    const { isConfirmed } = await Swal.fire({
      icon: "warning",
      title: "¿Borrar la tarea?",
      text: t.texto,
      width: "320px",
      showCancelButton: true,
      confirmButtonText: "Sí, borrar",
      cancelButtonText: "Cancelar",
      confirmButtonColor: "#dc2626",
      cancelButtonColor: "#64748b",
    });
    if (!isConfirmed) return;
    guardarTareasIngreso(tareasIngreso.filter((x) => x._id !== t._id));
  };

  // El OK a mano, solo sin problemas: con problemas se marca resolviéndolos.

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
          style={{ borderBottom: `${embebido ? 2 : 3}px solid ${VERDE}`, cursor: embebido ? "pointer" : undefined, position: "relative" }}
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
          {/* El estado de ingreso: rojo con tareas sin solucionar, verde con
              todas solucionadas, gris sin cargar. No pliega el sistema. */}
          {embebido && onEstadoIngreso && (
            <button
              type="button"
              className="btn btn-link p-0 text-decoration-none fw-semibold"
              onClick={(e) => {
                e.stopPropagation();
                setNuevaTareaIngreso("");
                setEditandoIngreso(null);
                setModalIngreso(true);
              }}
              title={
                tareasIngreso.length === 0
                  ? "Cargar los problemas con que ingresó"
                  : pendientesIngreso
                    ? `${pendientesIngreso} sin solucionar de ${tareasIngreso.length}`
                    : "Todo solucionado"
              }
              style={{
                fontSize: "0.74rem",
                lineHeight: 1,
                color: tareasIngreso.length === 0 ? "#64748b" : pendientesIngreso ? "#b91c1c" : VERDE_OK,
              }}
            >
              (estado ingreso)
            </button>
          )}
          {/* El avance del sistema: el promedio de sus tareas y lo que aporta al
              total. Centrado en la línea del título, aparte del resto. */}
          {embebido && avance && (
            <div
              className="d-flex align-items-center gap-2"
              // El calc descuenta la mitad del pb-1 de la línea del título.
              style={{ position: "absolute", left: "50%", top: "calc(50% - 2px)", transform: "translate(-50%, -50%)", fontSize: "0.8rem" }}
              title={`${avance.hechas}/${avance.tareas} tareas al 100%${
                avance.peso !== null ? ` · aporta ${fmtPct(avance.aporte)} de ${fmtPct(avance.peso)}` : ""
              }`}
            >
              <div style={{ width: "120px", height: "8px", borderRadius: "4px", backgroundColor: "#e2e8f0", overflow: "hidden" }}>
                <div style={{ width: `${Math.min(avance.parte * 100, 100)}%`, height: "100%", backgroundColor: VERDE }} />
              </div>
              <span className="fw-bold" style={{ color: avance.parte > 0 ? VERDE : "#94a3b8" }}>
                {fmtPct(avance.parte * 100)}
              </span>
            </div>
          )}
          <div className="ms-auto" />
          {/* El peso del sistema en la reparación (cargado en General), solo el %. */}
          {embebido && avance && avance.peso !== null && (
            <span className="fw-bold" style={{ fontSize: "0.8rem", color: COLOR }} title="Lo que pesa este sistema en la reparación">
              {fmtPct(avance.peso)}
            </span>
          )}
          {/* Embebida: la flecha de agrupar/desplegar. */}
          {embebido && (
            <span className="d-flex align-items-center gap-2 text-secondary fw-semibold" style={{ fontSize: "0.74rem" }}>
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
                <th style={{ ...th, width: "24%" }}>Tarea</th>
                <th style={th}>Descripción</th>
                {/* El peso de la tarea en su sistema (21/10/2026): se carga en
                    General y se copia a cada Manitou, donde se puede cambiar
                    para esa máquina. Con la suma debajo: tiene que dar 100. */}
                <th style={{ ...thCentro, width: "56px", lineHeight: 1.15 }} title="Los pesos de las tareas del sistema tienen que sumar 100%">
                  Peso
                  <div style={{ fontSize: "0.62rem", fontWeight: 700 }}>{fmtPct(sumaPesos)}</div>
                </th>
                {/* En General (la plantilla) no se chequea: solo ítem y repuestos.
                    La columna Tareas (la lista de problemas) se sacó el
                    10/10/2026. */}
                {!esGeneral && <th style={{ ...thCentro, width: "96px" }}>Detalle reparación</th>}
                {!esGeneral && <th style={{ ...thCentro, width: "60px" }}>Avance</th>}
                {/* La línea fuerte separa lo del chequeo de lo de los repuestos. */}
                <th className="col-corte" style={{ ...thCentro, width: "72px" }}>Repuestos</th>
                {!esGeneral && <th style={{ ...thCentro, width: "108px" }}>Estado</th>}
                <th style={{ ...thCentro, width: esGeneral ? "64px" : "76px" }}></th>
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
                    <td style={{ ...td, color: "#475569" }}>
                      {f.no_aplica ? <span style={{ fontWeight: 700 }}>NO APLICA</span> : f.descripcion || <Raya />}
                    </td>
                    {/* En General a la vista; en una Manitou tapado con el ojo. */}
                    <td style={{ ...tdCentro, padding: "3px 4px" }}>
                      {f.no_aplica ? (
                        <Raya />
                      ) : (
                        <CampoPorcentaje
                          actual={f.peso}
                          onGuardar={(peso) => cambiar(f, { peso })}
                          deshabilitado={sinEditar}
                          titulo={
                            esGeneral
                              ? "Cuánto pesa la tarea en el sistema (se copia a cada Manitou)"
                              : f.pesoPropio
                                ? "Cambiado en esta Manitou. Vacío vuelve al de General"
                                : "El de General. Cambiarlo acá vale solo para esta Manitou"
                          }
                          oculto={!esGeneral}
                        />
                      )}
                    </td>
                    {!esGeneral && (
                      <td style={{ ...tdCentro, padding: "3px 5px" }}>
                        {/* Escrita, el ojo se abre aun sin permiso. */}
                        <div className="d-flex justify-content-center align-items-center">
                          {f.no_aplica ? (
                            <Raya />
                          ) : f.reparaciones?.length ? (
                            <BotonAccion
                              icono="bi-eye"
                              titulo="Ver el detalle de la reparación"
                              variante="primary"
                              onClick={() => setFilaReparaciones(f._id)}
                            />
                          ) : (
                            <BotonAccion
                              icono="bi-plus-lg"
                              titulo={sinEditar ? "Sin permiso para editar" : "Escribir el detalle de la reparación"}
                              variante="success"
                              onClick={() => setFilaReparaciones(f._id)}
                              deshabilitado={sinEditar}
                            />
                          )}
                        </div>
                      </td>
                    )}
                    {!esGeneral && (
                      <td style={{ ...tdCentro, padding: "3px 5px" }}>
                        {/* El % de la tarea (21/10/2026; antes el círculo de
                            OK). Lo que no aplica a esta Manitou no lleva. */}
                        {!f.no_aplica && (
                          <CampoPorcentaje
                            // Una tarea vieja con OK y sin % muestra 100.
                            actual={f.avance ?? (f.chequeado ? 100 : null)}
                            onGuardar={(avance) => cambiar(f, { avance })}
                            deshabilitado={sinEditar}
                            titulo="Cuánto lleva la tarea, de 0 a 100"
                            color={colorAvance}
                          />
                        )}
                      </td>
                    )}
                    <td className="col-corte" style={{ ...tdCentro, padding: "3px 5px" }}>
                      {/* Solo el botón: los repuestos tienen su hoja. Con
                          repuestos, el + pasa a ser el ojo, que se puede abrir
                          aun sin permiso. */}
                      <div className="d-flex justify-content-center align-items-center">
                        {/* Lo que no aplica no lleva repuestos ni estado. */}
                        {f.no_aplica ? (
                          <Raya />
                        ) : f.repuestos?.length ? (
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
                        {!f.no_aplica && estadoDe(f) ? (
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
                          Manitou); en una Manitou se marca "no aplica" (10/10/2026) y solo
                          se borra una fila que quedó suelta al borrarse la de
                          General. */}
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
                        {!esGeneral && (
                          // "N/A" escrito, más claro que un ícono: lleno
                          // cuando la tarea no aplica.
                          <button
                            type="button"
                            onClick={() => cambiar(f, { no_aplica: !f.no_aplica })}
                            disabled={sinEditar}
                            className={`btn btn-sm ${f.no_aplica ? "btn-warning" : "btn-outline-secondary"} rounded-2 p-0`}
                            style={{ width: "34px", height: "24px", fontSize: "0.66rem", fontWeight: 700, lineHeight: 1 }}
                            title={
                              sinEditar
                                ? "Sin permiso para editar"
                                : f.no_aplica
                                  ? "No aplica a esta Manitou. Tocá para que vuelva a aplicar"
                                  : "Marcar que no aplica a esta Manitou"
                            }
                          >
                            N/A
                          </button>
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

      <ModalReparaciones
        fila={filaConReparaciones}
        onHide={() => setFilaReparaciones(null)}
        onGuardar={guardarReparaciones}
        sinEditar={sinEditar}
        encabezado={encabezadoModal("bi-tools", `Detalle reparación · ${filaConReparaciones?.item ?? ""}`)}
      />

      {/* Modal Estado de ingreso: las tareas, cada una con su círculo de
          solucionado y su borrar, y el renglón para sumar otra. */}
      <Modal
        show={modalIngreso}
        onHide={() => setModalIngreso(false)}
        centered
        size="lg"
        contentClassName="border-0 shadow-lg rounded-4"
      >
        {encabezadoModal("bi-clipboard2-pulse", `Estado de ingreso · ${sistema.titulo}`)}
        <Modal.Body className="p-4">
          <div className="text-secondary small mb-2">Problemas que trajo la máquina cuando se la ingresó.</div>
          <Table className="mb-0 tabla-informe" style={{ width: "100%", border: "1px solid #cbd5e1" }}>
            <thead>
              <tr>
                <th style={{ ...thCentro, width: "36px" }}>#</th>
                <th style={th}>Tarea</th>
                <th style={{ ...thCentro, width: "96px" }}>Solucionado</th>
                {!sinEditar && <th style={{ ...thCentro, width: "72px" }}></th>}
              </tr>
            </thead>
            <tbody>
              {tareasIngreso.length === 0 ? (
                <tr>
                  <td colSpan={sinEditar ? 3 : 4} className="text-center text-muted py-3" style={td}>
                    Sin tareas.
                  </td>
                </tr>
              ) : (
                tareasIngreso.map((t, i) => (
                  <tr key={t._id}>
                    <td style={{ ...tdCentro, color: "#94a3b8" }}>{i + 1}</td>
                    <td style={{ ...td, whiteSpace: "pre-wrap" }}>
                      {editandoIngreso?.id === t._id ? (
                        <Form.Control
                          className="rounded-3"
                          size="sm"
                          style={campo}
                          value={editandoIngreso.texto}
                          onChange={(e) => setEditandoIngreso({ ...editandoIngreso, texto: e.target.value })}
                          onKeyDown={(e) => e.key === "Enter" && guardarEdicionIngreso(e)}
                          autoFocus
                        />
                      ) : (
                        t.texto
                      )}
                    </td>
                    <td style={{ ...tdCentro, padding: "3px 5px" }}>
                      <CirculoOk
                        marcado={t.solucionado}
                        onClick={() => alternarTareaIngreso(t)}
                        deshabilitado={sinEditar || guardando}
                        titulo={t.solucionado ? "Solucionado" : "Marcar como solucionado"}
                      />
                    </td>
                    {!sinEditar && (
                      <td style={tdCentro}>
                        {/* Lápiz y borrar; editando, guardar y cancelar. */}
                        <div className="d-flex justify-content-center" style={{ gap: "6px" }}>
                          {editandoIngreso?.id === t._id ? (
                            <>
                              <BotonAccion
                                icono="bi-check-lg"
                                titulo="Guardar"
                                variante="success"
                                onClick={() => guardarEdicionIngreso()}
                                deshabilitado={guardando || !editandoIngreso.texto.trim()}
                              />
                              <BotonAccion icono="bi-x-lg" titulo="Cancelar" onClick={() => setEditandoIngreso(null)} />
                            </>
                          ) : (
                            <>
                              <BotonAccion
                                icono="bi-pencil"
                                titulo="Editar la tarea"
                                variante="primary"
                                onClick={() => setEditandoIngreso({ id: t._id, texto: t.texto })}
                              />
                              <BotonAccion icono="bi-trash" titulo="Borrar" variante="danger" onClick={() => borrarTareaIngreso(t)} />
                            </>
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </Table>
          {!sinEditar && (
            <Form onSubmit={agregarTareaIngreso} className="d-flex gap-2 mt-3">
              <Form.Control
                className="rounded-3"
                size="sm"
                style={campo}
                value={nuevaTareaIngreso}
                placeholder="Tarea"
                onChange={(e) => setNuevaTareaIngreso(e.target.value)}
                autoFocus
              />
              <Button
                size="sm"
                type="submit"
                disabled={guardando || !nuevaTareaIngreso.trim()}
                className="rounded-3 px-3 d-flex align-items-center gap-1"
                style={{ backgroundColor: "#15803d", borderColor: "#15803d", fontSize: "0.84rem", fontWeight: 600, whiteSpace: "nowrap" }}
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
            onClick={guardarIngreso}
            disabled={guardando}
            className="rounded-3 px-3 py-1 shadow-sm d-flex align-items-center gap-1"
            style={{ backgroundColor: "#15803d", borderColor: "#15803d", fontSize: "0.84rem", fontWeight: 600 }}
          >
            <i className="bi bi-check-lg"></i>
            <span>Guardar</span>
          </Button>
        </Modal.Footer>
      </Modal>

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
    </div>
  );
}
