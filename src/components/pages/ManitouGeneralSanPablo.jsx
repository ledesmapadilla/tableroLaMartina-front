import { useCallback, useEffect, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import Swal from "sweetalert2";
import { Button, Form, Modal, Table } from "react-bootstrap";
import { api } from "../../services/api";
import { cosechaDeParam } from "../../utils/cosechas";
import { usePermisos } from "../../context/permisos";
import TractorIcon from "../shared/TractorIcon";
import NavbarSanPablo from "../shared/NavbarSanPablo";
import TarjetasSanPablo from "../shared/TarjetasSanPablo";
import {
  SISTEMAS_MANITOU,
  MANITOUS_DESPLEGADAS,
  seccionManitou,
  unidadManitouValida,
  avanceManitou,
  fmtPct,
} from "../../utils/sistemasManitou";
import ChequeosManitou from "./ChequeosManitou";
import {
  exportarChequeoManitou,
  exportarRepuestosManitou,
  tareasConRepuestos,
  pasaFiltro,
  hayFiltro,
  FILTRO_CHEQUEO_VACIO,
} from "../../helpers/excelManitou";
import { th as thBase, td } from "../compras/formato";
import FiltroChequeoManitou from "../shared/FiltroChequeoManitou";
import Error404 from "./Error404";

// Cian, para distinguirlas de las tarjetas verdes de Manitous.
const cian = {
  bg: "linear-gradient(135deg, #164e63 0%, #0e7490 100%)",
  hoverBg: "linear-gradient(135deg, #083344 0%, #164e63 100%)",
  accentColor: "#22d3ee",
};
// El verde de Manitous, para el título.
const VERDE = "#047857";
const COLOR = "#1e293b";
const ANCHO = "min(500px, calc(100vh - 200px))";
// La página desplegada: el ancho de la tabla de un sistema.
const ANCHO_DESPLEGADA = "980px";
const th = { ...thBase, backgroundColor: COLOR };
const thCentro = { ...th, textAlign: "center" };

// El color de cada estado de un repuesto en la tabla de Repuestos.
const ESTADOS_REPUESTO = {
  "Sin cotizar": { fondo: "#fee2e2", color: "#b91c1c" },
  "Para cotizar": { fondo: "#e0e7ff", color: "#3730a3" },
  Cotizado: { fondo: "#fef3c7", color: "#b45309" },
  Pedido: { fondo: "#dcfce7", color: "#15803d" },
};

// Manitous › General o una Manitou: una tarjeta por sistema de la máquina
// (06/10/2026; las Manitou desde el 09/10/2026, con lo copiado de General),
// cada una con su tabla de chequeo (ChequeosManitou).
const tarjetas = SISTEMAS_MANITOU.map((t) => ({ ...t, ...cian }));

// En General, abajo, la del presupuesto (09/10/2026): de la mitad de alto y
// el doble de ancho. Abre PresupuestoManitous.
const tarjetaPresupuesto = {
  id: "presupuesto",
  titulo: "Presupuesto",
  icono: "bi bi-currency-dollar",
  ancho: 2,
  alto: 0.5,
  bg: "linear-gradient(135deg, #1e293b 0%, #334155 100%)",
  hoverBg: "linear-gradient(135deg, #0f172a 0%, #1e293b 100%)",
  accentColor: "#34d399",
};
// Con la tarjeta del presupuesto la grilla es más alta: un poco más angosta
// para que siga entrando sin scroll.
const ANCHO_GENERAL = "min(500px, calc((100vh - 200px) * 0.8))";

// En qué está la Manitou (11/10/2026): un círculo por estado, se marca uno
// solo y tocar el marcado lo desmarca.
const ESTADOS_MANITOU = [
  { id: "reparacion", titulo: "En reparación", color: "#ea580c" },
  { id: "espera", titulo: "En espera", color: "#2563eb" },
];

function ManitouGeneralSanPablo() {
  const { cosecha: param, unidad } = useParams();
  const navigate = useNavigate();
  // General (la plantilla) o una Manitou: cada una con sus responsables.
  const seccion = seccionManitou(unidad);
  const esGeneral = unidad === "general";
  const cosecha = cosechaDeParam(param);
  const { puede } = usePermisos();
  const sinEditar = !puede("sanpablo.ingresos", "editar");

  // Los responsables guardados (se ven afuera, uno abajo del otro) y, con el
  // modal abierto, el nombre que se está escribiendo.
  const [responsables, setResponsables] = useState([]);
  const [nombre, setNombre] = useState(null);
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    if (!unidadManitouValida(unidad)) return;
    api
      .get(`/ingresos-sanpablo/responsables?cosecha=${cosecha}&seccion=${seccion}`)
      .then((r) => setResponsables(r.nombres))
      .catch(() => setResponsables([]));
  }, [cosecha, seccion, unidad]);

  // El estado de la Manitou en la cosecha (no en General).
  const [estadoManitou, setEstadoManitou] = useState(null);
  useEffect(() => {
    if (esGeneral || !unidadManitouValida(unidad)) return;
    api
      .get(`/ingresos-sanpablo/estado-manitou?cosecha=${cosecha}`)
      .then((lista) => setEstadoManitou((Array.isArray(lista) ? lista : []).find((d) => d.seccion === seccion)?.estado ?? null))
      .catch(() => setEstadoManitou(null));
  }, [esGeneral, unidad, cosecha, seccion]);

  const marcarEstado = async (id) => {
    const nuevo = estadoManitou === id ? null : id;
    try {
      const doc = await api.put("/ingresos-sanpablo/estado-manitou", { cosecha, seccion, estado: nuevo });
      setEstadoManitou(doc.estado ?? null);
    } catch (err) {
      Swal.fire({ icon: "error", title: "No se pudo guardar", text: err.message, width: "300px" });
    }
  };

  // ── Fecha límite (28/10/2026) ──
  // La de esta Manitou, en el panel de avance, que no pasa la total (la de
  // arriba de las tarjetas de Manitous). Las dos en "AAAA-MM-DD" o "".
  const [fechaLimite, setFechaLimite] = useState({ total: "", propia: "" });
  useEffect(() => {
    if (esGeneral || !unidadManitouValida(unidad)) return;
    api
      .get(`/ingresos-sanpablo/fecha-limite-manitou?cosecha=${cosecha}`)
      .then((r) =>
        setFechaLimite({
          total: r.fecha ? r.fecha.slice(0, 10) : "",
          propia: r.porManitou?.[seccion] ? r.porManitou[seccion].slice(0, 10) : "",
        })
      )
      .catch(() => setFechaLimite({ total: "", propia: "" }));
  }, [esGeneral, unidad, cosecha, seccion]);

  // Se guarda al elegirla; vacía la borra.
  const guardarFechaLimite = async (valor) => {
    if (valor && fechaLimite.total && valor > fechaLimite.total) {
      Swal.fire({
        icon: "error",
        title: "Fecha fuera de término",
        text: `No puede pasar la fecha límite de las Manitou (${fechaLimite.total.split("-").reverse().join("/")}).`,
        width: "300px",
      });
      return;
    }
    const anterior = fechaLimite.propia;
    setFechaLimite((f) => ({ ...f, propia: valor }));
    try {
      await api.put("/ingresos-sanpablo/fecha-limite-manitou", { cosecha, seccion, fecha: valor || null });
    } catch (err) {
      setFechaLimite((f) => ({ ...f, propia: anterior }));
      Swal.fire({ icon: "error", title: "No se pudo guardar", text: err.message, width: "300px" });
    }
  };

  // ── Pesos de los sistemas (21/10/2026) ──
  // Cuánto pesa cada sistema en la reparación, en %: se cargan a mano en
  // General y valen para las cinco Manitou, donde dan el avance.
  const [pesos, setPesos] = useState({});
  // El modal de General: null cerrado o { [sistema]: "texto del input" }.
  const [pesosForm, setPesosForm] = useState(null);
  useEffect(() => {
    if (!unidadManitouValida(unidad)) return;
    api
      .get(`/ingresos-sanpablo/pesos-manitou?cosecha=${cosecha}`)
      .then((r) => setPesos(r?.pesos || {}))
      .catch(() => setPesos({}));
  }, [unidad, cosecha]);

  const sumaPesosForm = pesosForm ? SISTEMAS_MANITOU.reduce((t, s) => t + (Number(pesosForm[s.id]) || 0), 0) : 0;
  const pesosCompletos = pesosForm && SISTEMAS_MANITOU.every((s) => pesosForm[s.id] !== "" && Number(pesosForm[s.id]) >= 0);
  const sumanCien = Math.abs(sumaPesosForm - 100) < 0.01;

  const abrirPesos = () =>
    setPesosForm(Object.fromEntries(SISTEMAS_MANITOU.map((s) => [s.id, pesos[s.id] === undefined ? "" : String(pesos[s.id])])));

  const guardarPesos = async (e) => {
    e.preventDefault();
    setGuardando(true);
    try {
      const r = await api.put("/ingresos-sanpablo/pesos-manitou", { cosecha, pesos: pesosForm });
      setPesos(r.pesos || {});
      setPesosForm(null);
      Swal.fire({ icon: "success", title: "Pesos guardados", timer: 1500, showConfirmButton: false, width: "300px" });
    } catch (err) {
      Swal.fire({ icon: "error", title: "No se pudo guardar", text: err.message, width: "300px" });
    } finally {
      setGuardando(false);
    }
  };

  // ── Desplegada (09/10/2026) ──
  // Todos los sistemas en una página: se traen juntos y las cotizaciones
  // una sola vez.
  const desplegada = MANITOUS_DESPLEGADAS.includes(unidad);
  const { hash } = useLocation();
  const [datos, setDatos] = useState(null); // { filas: { [sistema]: [] }, cotizaciones }
  // Un solo filtro para todos los sistemas.
  const [filtro, setFiltro] = useState(FILTRO_CHEQUEO_VACIO);
  // Los sistemas agrupados (solo el título), por id. Se abre con todos
  // agrupados (10/10/2026), salvo el sistema al que se vuelve desde sus
  // repuestos (#sistema).
  const [plegados, setPlegados] = useState(
    () => new Set(SISTEMAS_MANITOU.map((s) => s.id).filter((id) => `#${id}` !== window.location.hash))
  );
  const plegar = (id) =>
    setPlegados((prev) => {
      const nuevo = new Set(prev);
      if (nuevo.has(id)) nuevo.delete(id);
      else nuevo.add(id);
      return nuevo;
    });

  // El estado de ingreso de cada sistema (10/10/2026): { [sistema]: doc }.
  const [estadosIngreso, setEstadosIngreso] = useState({});
  useEffect(() => {
    if (!desplegada || esGeneral) return;
    api
      .get(`/ingresos-sanpablo/estado-ingreso?cosecha=${cosecha}&seccion=${seccion}`)
      .then((lista) => setEstadosIngreso(Object.fromEntries((Array.isArray(lista) ? lista : []).map((d) => [d.sistema, d]))))
      .catch(() => setEstadosIngreso({}));
  }, [desplegada, esGeneral, cosecha, seccion]);
  const alCambiarEstadoIngreso = useCallback((doc) => setEstadosIngreso((prev) => ({ ...prev, [doc.sistema]: doc })), []);

  useEffect(() => {
    if (!desplegada) return;
    // Un solo pedido con todos los sistemas (antes era uno por sistema).
    Promise.all([
      api.get(`/ingresos-sanpablo/chequeos?cosecha=${cosecha}&seccion=${seccion}`).catch(() => []),
      api.get("/presupuestos-reparaciones").catch(() => []),
    ]).then(([todas, presupuestos]) => {
      const lista = Array.isArray(todas) ? todas : [];
      setDatos({
        filas: Object.fromEntries(SISTEMAS_MANITOU.map((s) => [s.id, lista.filter((f) => f.sistema === s.id)])),
        cotizaciones: Object.fromEntries((Array.isArray(presupuestos) ? presupuestos : []).map((p) => [p.repuesto, p.estado])),
      });
    });
  }, [desplegada, cosecha, seccion]);

  // Las filas al día de cada sistema (cada tabla avisa sus cambios), para
  // el Excel único de la página.
  const [filasVivas, setFilasVivas] = useState({});
  const alCambiarFilas = useCallback((idSistema, filas) => {
    setFilasVivas((prev) => (prev[idSistema] === filas ? prev : { ...prev, [idSistema]: filas }));
  }, []);
  const filasDeSistema = (id) => filasVivas[id] ?? datos.filas[id];

  // El avance de esta Manitou con los pesos de General: se mueve con cada OK.
  const avance =
    desplegada && !esGeneral && datos
      ? avanceManitou(Object.fromEntries(SISTEMAS_MANITOU.map((s) => [s.id, filasDeSistema(s.id)])), pesos)
      : null;

  const exportarExcel = () =>
    exportarChequeoManitou({
      titulo: `Reparaciones San Pablo — Manitou ${unidad} — Cosecha ${param}`,
      archivo: `sanpablo_manitou_${unidad}_${param}_${new Date().toISOString().slice(0, 10)}.xlsx`,
      secciones: SISTEMAS_MANITOU.map((s) => ({ sistema: s, filas: filasDeSistema(s.id) })),
      cotizaciones: datos.cotizaciones,
      general: esGeneral,
      filtro: esGeneral ? undefined : filtro,
    });

  // ── Repuestos (13/10/2026) ──
  // Todos los repuestos de la Manitou en una tabla, por tarea, con su
  // Excel. Sigue el filtro de la página, como el Excel de la página.
  const [verRepuestos, setVerRepuestos] = useState(false);
  const tareasRepuestos =
    datos && !esGeneral
      ? tareasConRepuestos(
          SISTEMAS_MANITOU.map((s) => ({ sistema: s, filas: filasDeSistema(s.id) })),
          datos.cotizaciones,
          filtro
        )
      : [];
  // Filtro por estado del modal (20/10/2026): quedan los repuestos de ese
  // estado y se va la tarea que se queda sin ninguno. El Excel lo sigue.
  const [filtroEstadoRepuesto, setFiltroEstadoRepuesto] = useState("Todos");
  const repuestosFiltrados =
    filtroEstadoRepuesto === "Todos"
      ? tareasRepuestos
      : tareasRepuestos
          .map((t) => ({ ...t, repuestos: t.repuestos.filter((r) => r.estado === filtroEstadoRepuesto) }))
          .filter((t) => t.repuestos.length > 0);
  const exportarRepuestos = () =>
    exportarRepuestosManitou({
      titulo: `Repuestos — Manitou ${unidad} — Cosecha ${param}`,
      archivo: `sanpablo_manitou_repuestos_${unidad}_${param}_${new Date().toISOString().slice(0, 10)}.xlsx`,
      tareas: repuestosFiltrados,
    });

  // Al volver de los repuestos (#sistema), a la tabla de ese sistema.
  useEffect(() => {
    if (datos && hash) document.getElementById(hash.slice(1))?.scrollIntoView();
  }, [datos, hash]);

  const cerrar = () => setNombre(null);

  // Se guarda la lista entera: la de ahora con el nombre nuevo, o sin uno.
  const guardarLista = async (nombres) => {
    setGuardando(true);
    try {
      const r = await api.put("/ingresos-sanpablo/responsables", { cosecha, seccion, nombres });
      setResponsables(r.nombres);
      return true;
    } catch (err) {
      Swal.fire({ icon: "error", title: "No se pudo guardar", text: err.message });
      return false;
    } finally {
      setGuardando(false);
    }
  };

  const agregar = async (e) => {
    e.preventDefault();
    if (!nombre.trim()) return;
    if (await guardarLista([...responsables, nombre])) cerrar();
  };

  // Sacar a un responsable se confirma (11/10/2026): es sacar algo cargado.
  const quitar = async (i) => {
    const { isConfirmed } = await Swal.fire({
      icon: "warning",
      title: "¿Quitar el responsable?",
      text: responsables[i],
      width: "320px",
      showCancelButton: true,
      confirmButtonText: "Sí, quitar",
      cancelButtonText: "Cancelar",
      confirmButtonColor: "#dc2626",
      cancelButtonColor: "#64748b",
    });
    if (isConfirmed) guardarLista(responsables.filter((_, j) => j !== i));
  };

  // Arriba, bien visible, que es Manitou, y los responsables.
  const encabezado = (ancho) => (
    <div
      className={`d-flex align-items-start justify-content-between gap-3 pb-3 ${desplegada ? "mb-2" : "mb-4"}`}
      style={{ maxWidth: ancho, width: "100%", borderBottom: `3px solid ${VERDE}` }}
    >
      <div className="d-flex align-items-center gap-3" style={{ flex: "1 1 0", minWidth: 0 }}>
        <div
          className="d-flex align-items-center justify-content-center"
          style={{
            width: "56px",
            height: "56px",
            borderRadius: "14px",
            background: "linear-gradient(135deg, #064e3b 0%, #047857 100%)",
            boxShadow: "0 6px 16px rgba(4, 120, 87, 0.35)",
            flexShrink: 0,
          }}
        >
          <TractorIcon size="2rem" color="#fff" />
        </div>
        <div>
          <div className="fw-bold" style={{ fontSize: "2rem", lineHeight: 1, color: VERDE, letterSpacing: "0.02em" }}>
            {desplegada ? `MANITOU ${esGeneral ? "GENERAL" : unidad}` : "MANITOU"}
          </div>
          <div className="text-secondary fw-semibold" style={{ fontSize: "0.9rem" }}>
            {desplegada ? `${esGeneral ? "Plantilla · " : ""}Cosecha ${param}` : `${esGeneral ? "General (plantilla)" : `Manitou ${unidad}`} · Cosecha ${param}`}
          </div>
        </div>
      </div>

      {/* En reparación / En espera, centrados entre el título y los botones: lleno el marcado. */}
      {!esGeneral && (
        <div className="d-flex align-items-center gap-3 align-self-center flex-shrink-0">
          {ESTADOS_MANITOU.map((e) => {
            const marcado = estadoManitou === e.id;
            return (
              <button
                key={e.id}
                type="button"
                onClick={() => marcarEstado(e.id)}
                disabled={sinEditar}
                className="btn btn-link p-0 text-decoration-none d-flex align-items-center gap-1"
                title={sinEditar ? "Sin permiso para editar" : marcado ? "Desmarcar" : `Marcar ${e.titulo.toLowerCase()}`}
                style={{ fontSize: "0.82rem", fontWeight: marcado ? 700 : 600, color: marcado ? e.color : "#64748b", opacity: 1 }}
              >
                <span
                  className="d-inline-flex align-items-center justify-content-center"
                  style={{
                    width: "16px",
                    height: "16px",
                    borderRadius: "50%",
                    border: `2px solid ${marcado ? e.color : "#94a3b8"}`,
                    backgroundColor: marcado ? e.color : "#fff",
                    transition: "background-color 0.15s, border-color 0.15s",
                  }}
                >
                  {marcado && <i className="bi bi-check-lg" style={{ color: "#fff", fontSize: "0.7rem", lineHeight: 1 }}></i>}
                </span>
                <span>{e.titulo}</span>
              </button>
            );
          })}
        </div>
      )}

      {/* Los botones y, debajo, los responsables cargados. Desplegada, un
          solo Excel con todos los sistemas. */}
      <div className="d-flex flex-column align-items-end gap-1 align-self-stretch" style={{ flex: "1 1 0", minWidth: 0 }}>
        <div className="d-flex gap-2">
          {desplegada && (
            <Button
              size="sm"
              onClick={exportarExcel}
              disabled={!datos}
              className="rounded-3 px-3 py-1 shadow-sm d-flex align-items-center gap-1"
              style={{ backgroundColor: "#15803d", borderColor: "#15803d", fontSize: "0.84rem", fontWeight: 600 }}
              title="Exportar a Excel"
            >
              <i className="bi bi-file-earmark-excel-fill"></i>
              <span>Excel</span>
            </Button>
          )}
          <Button
            size="sm"
            onClick={() => setNombre("")}
            disabled={sinEditar}
            className="rounded-3 px-3 py-1 shadow-sm d-flex align-items-center gap-1"
            style={{ backgroundColor: COLOR, borderColor: COLOR, fontSize: "0.84rem", fontWeight: 600 }}
          >
            <i className="bi bi-person-plus-fill"></i>
            <span>Responsable</span>
          </Button>
        </div>
        {responsables.map((r, i) => (
          <div
            key={r}
            className="d-flex align-items-center gap-1 fw-semibold"
            style={{ fontSize: "0.85rem", color: COLOR }}
          >
            <i className="bi bi-person-fill text-secondary"></i>
            <span>{r}</span>
            {!sinEditar && (
              <button
                type="button"
                onClick={() => quitar(i)}
                disabled={guardando}
                title="Quitar"
                className="btn btn-link p-0 text-danger"
                style={{ fontSize: "0.8rem", lineHeight: 1 }}
              >
                <i className="bi bi-x-lg"></i>
              </button>
            )}
          </div>
        ))}
        {/* Los pesos de los sistemas se cargan en General (21/10/2026):
            abajo de los responsables, apoyado en la línea verde (el -1rem
            se come el pb-3 del encabezado). */}
        {esGeneral && (
          <Button
            size="sm"
            onClick={abrirPesos}
            className="rounded-3 rounded-bottom-0 px-3 py-1 shadow-sm d-flex align-items-center gap-1 mt-auto"
            style={{ backgroundColor: VERDE, borderColor: VERDE, fontSize: "0.84rem", fontWeight: 600, marginBottom: "-1rem" }}
            title="Cuánto pesa cada sistema en la reparación"
          >
            <i className="bi bi-percent"></i>
            <span>Pesos</span>
          </Button>
        )}
      </div>
    </div>
  );

  // El avance de la reparación (21/10/2026), centrado abajo del encabezado:
  // el total con los pesos de General. El de cada sistema va al lado de su
  // título (ChequeosManitou, prop avance).
  const barra = (pct, alto) => (
    <div style={{ width: "100%", height: alto, borderRadius: alto, backgroundColor: "#e2e8f0", overflow: "hidden" }}>
      <div style={{ width: `${Math.min(pct, 100)}%`, height: "100%", backgroundColor: VERDE, transition: "width 0.3s" }} />
    </div>
  );
  const panelAvance = avance && (
    // Una sola línea en tres partes iguales a los costados: el título a la
    // izquierda, la barra en el medio (su centro, el de la página) y el % a
    // su derecha.
    <div className="bg-white rounded-4 shadow-sm px-3 py-2 mb-3" style={{ border: "1px solid #cbd5e1" }}>
      <div className="align-items-center" style={{ display: "grid", gridTemplateColumns: "1fr minmax(100px, 280px) 1fr", columnGap: "12px" }}>
        <span className="fw-bold text-secondary text-uppercase" style={{ fontSize: "0.72rem", letterSpacing: "0.08em" }}>
          Avance de la reparación
        </span>
        {avance.total === null ? (
          <span className="text-muted fw-semibold text-center" style={{ fontSize: "0.9rem" }}>
            Sin pesos cargados: se cargan en Manitous › General
          </span>
        ) : (
          barra(avance.total, "8px")
        )}
        {/* El % y, a la derecha, la fecha límite de esta Manitou. */}
        <div className="d-flex align-items-center gap-3">
          {avance.total !== null && (
            <span className="fw-bold" style={{ fontSize: "1.4rem", lineHeight: 1, color: VERDE }}>
              {fmtPct(avance.total)}
            </span>
          )}
          <div className="ms-auto d-flex align-items-center gap-2">
            <span className="fw-bold text-secondary text-uppercase text-nowrap" style={{ fontSize: "0.72rem", letterSpacing: "0.08em" }}>
              Fecha límite
            </span>
            <input
              type="date"
              className="form-control form-control-sm"
              style={{ width: "auto" }}
              value={fechaLimite.propia}
              max={fechaLimite.total || undefined}
              onChange={(e) => guardarFechaLimite(e.target.value)}
              disabled={sinEditar}
              title={
                sinEditar
                  ? "Sin permiso para editar"
                  : fechaLimite.total
                  ? `Hasta el ${fechaLimite.total.split("-").reverse().join("/")}, la fecha límite de las Manitou`
                  : "Para cuándo tiene que estar reparada"
              }
            />
          </div>
        </div>
      </div>
    </div>
  );

  const modalResponsable = (
    <Modal show={nombre !== null} onHide={cerrar} centered size="sm" contentClassName="border-0 shadow-lg rounded-4">
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
          <i className="bi bi-person-plus-fill"></i>
          <span>Responsable</span>
        </Modal.Title>
      </Modal.Header>
      {nombre !== null && (
        <Form onSubmit={agregar}>
          <Modal.Body className="p-4">
            <Form.Label className="fw-semibold text-dark small mb-1">Responsable</Form.Label>
            <Form.Control
              className="rounded-3"
              size="sm"
              value={nombre}
              placeholder="Nombre del responsable"
              onChange={(e) => setNombre(e.target.value)}
              autoFocus
              required
            />
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
              disabled={guardando}
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
  );

  // Pesos: un % por sistema, que tienen que sumar 100. Sin permiso de editar
  // se ven y no se guardan.
  const modalPesos = (
    <Modal show={pesosForm !== null} onHide={() => setPesosForm(null)} centered size="sm" contentClassName="border-0 shadow-lg rounded-4">
      <Modal.Header
        closeButton
        closeVariant="white"
        style={{
          backgroundColor: VERDE,
          color: "#fff",
          borderTopLeftRadius: "1rem",
          borderTopRightRadius: "1rem",
          borderBottom: "1px solid rgba(255,255,255,0.1)",
        }}
      >
        <Modal.Title className="fs-6 fw-normal d-flex align-items-center gap-2 text-white">
          <i className="bi bi-percent"></i>
          <span>Pesos de la reparación</span>
        </Modal.Title>
      </Modal.Header>
      {pesosForm && (
        <Form onSubmit={guardarPesos}>
          <Modal.Body className="p-3">
            <div className="text-secondary mb-2" style={{ fontSize: "0.76rem" }}>
              Cuánto pesa cada sistema en la reparación. Vale para las cinco Manitou.
            </div>
            {SISTEMAS_MANITOU.map((s) => (
              <div
                key={s.id}
                className="d-flex align-items-center justify-content-between gap-2 py-1"
                style={{ borderBottom: "1px solid #e2e8f0" }}
              >
                <span className="d-flex align-items-center gap-2 fw-semibold" style={{ fontSize: "0.82rem", color: COLOR }}>
                  <i className={s.icono} style={{ color: "#0e7490" }}></i>
                  {s.titulo}
                </span>
                <div className="d-flex align-items-center gap-1">
                  <Form.Control
                    type="number"
                    min="0"
                    max="100"
                    step="any"
                    inputMode="decimal"
                    size="sm"
                    className="rounded-3 text-end"
                    style={{ width: "80px", fontSize: "0.82rem" }}
                    value={pesosForm[s.id]}
                    onChange={(e) => setPesosForm((f) => ({ ...f, [s.id]: e.target.value }))}
                    disabled={sinEditar}
                    required
                  />
                  <span className="text-secondary" style={{ fontSize: "0.82rem" }}>
                    %
                  </span>
                </div>
              </div>
            ))}
            <div
              className="d-flex align-items-center justify-content-between pt-2 fw-bold"
              style={{ fontSize: "0.86rem", color: sumanCien ? VERDE : "#dc2626" }}
            >
              <span>Total</span>
              <span>{fmtPct(sumaPesosForm)}</span>
            </div>
            {!sumanCien && (
              <div className="text-end" style={{ fontSize: "0.72rem", color: "#dc2626" }}>
                Tienen que sumar 100%.
              </div>
            )}
          </Modal.Body>
          <Modal.Footer
            className="bg-light border-0 py-2 px-4"
            style={{ borderBottomLeftRadius: "1rem", borderBottomRightRadius: "1rem" }}
          >
            <Button
              variant="outline-secondary"
              size="sm"
              onClick={() => setPesosForm(null)}
              className="rounded-3 px-3 py-1"
              style={{ fontSize: "0.84rem" }}
            >
              Cancelar
            </Button>
            <Button
              size="sm"
              type="submit"
              disabled={sinEditar || guardando || !pesosCompletos || !sumanCien}
              className="rounded-3 px-3 py-1 shadow-sm d-flex align-items-center gap-1"
              style={{ backgroundColor: "#15803d", borderColor: "#15803d", fontSize: "0.84rem", fontWeight: 600 }}
              title={sinEditar ? "Sin permiso para editar" : undefined}
            >
              <i className="bi bi-check-lg"></i>
              <span>Guardar</span>
            </Button>
          </Modal.Footer>
        </Form>
      )}
    </Modal>
  );

  // Repuestos: la tabla por tarea, cada repuesto con su estado, y el Excel.
  const modalRepuestos = (
    <Modal
      show={verRepuestos}
      onHide={() => setVerRepuestos(false)}
      centered
      size="lg"
      scrollable
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
          <i className="bi bi-gear-fill"></i>
          <span>Repuestos · Manitou {unidad}</span>
        </Modal.Title>
      </Modal.Header>
      <Modal.Body className="p-3">
        <div className="d-flex align-items-center justify-content-between gap-2 mb-2">
          <span className="text-secondary" style={{ fontSize: "0.76rem" }}>
            {hayFiltro(filtro) ? "Con los filtros de la página. " : ""}Los de cantidad 0 no salen: no hacen falta.
          </span>
          <div className="d-flex align-items-center gap-2 ms-auto flex-shrink-0">
            <span className="fw-bold text-dark" style={{ fontSize: "0.78rem" }}>
              Estado:
            </span>
            <div className="input-group input-group-sm" style={{ width: "150px" }}>
              <Form.Select
                size="sm"
                value={filtroEstadoRepuesto}
                onChange={(e) => setFiltroEstadoRepuesto(e.target.value)}
                className={`rounded-3 ${filtroEstadoRepuesto !== "Todos" ? "rounded-end-0 border-end-0 fw-bold filtro-activo" : ""}`}
                style={{
                  fontSize: "0.78rem",
                  height: "30px",
                  padding: "2px 24px 2px 8px",
                  color: filtroEstadoRepuesto !== "Todos" ? "#dc2626" : "#1e293b",
                }}
              >
                <option value="Todos">Todos</option>
                {Object.keys(ESTADOS_REPUESTO).map((e) => (
                  <option key={e} value={e}>
                    {e}
                  </option>
                ))}
              </Form.Select>
              {filtroEstadoRepuesto !== "Todos" && (
                <button
                  className="btn btn-outline-secondary border-start-0 d-flex align-items-center justify-content-center"
                  type="button"
                  onClick={() => setFiltroEstadoRepuesto("Todos")}
                  title="Limpiar filtro estado"
                  style={{ padding: "0 6px", height: "30px" }}
                >
                  <i className="bi bi-x" style={{ fontSize: "0.9rem" }}></i>
                </button>
              )}
            </div>
          </div>
          <Button
            size="sm"
            onClick={exportarRepuestos}
            disabled={repuestosFiltrados.length === 0}
            className="rounded-3 px-3 py-1 shadow-sm d-flex align-items-center gap-1 flex-shrink-0"
            style={{ backgroundColor: "#15803d", borderColor: "#15803d", fontSize: "0.78rem", fontWeight: 600 }}
            title="Exportar a Excel"
          >
            <i className="bi bi-file-earmark-excel-fill"></i>
            <span>Excel</span>
          </Button>
        </div>
        {repuestosFiltrados.length === 0 ? (
          <div className="text-center text-muted py-4" style={{ fontSize: "0.85rem" }}>
            {tareasRepuestos.length === 0 ? "No hay repuestos cargados." : `No hay repuestos en "${filtroEstadoRepuesto}".`}
          </div>
        ) : (
          <div className="rounded-3 bg-white" style={{ border: "1px solid #cbd5e1", overflow: "hidden" }}>
            <Table className="mb-0 tabla-informe" style={{ width: "100%" }}>
              <thead>
                <tr>
                  <th style={{ ...thCentro, width: "36px" }}>#</th>
                  <th style={{ ...th, width: "30%" }}>Tarea</th>
                  <th style={th}>Repuesto</th>
                  <th style={{ ...thCentro, width: "70px" }}>Cant.</th>
                  <th style={{ ...thCentro, width: "100px" }}>Estado</th>
                </tr>
              </thead>
              <tbody>
                {/* Un renglón por repuesto; la tarea ocupa los de sus repuestos. */}
                {repuestosFiltrados.flatMap((t, idx) =>
                  t.repuestos.map((r, i) => (
                    <tr key={r._id}>
                      {i === 0 && (
                        <>
                          <td rowSpan={t.repuestos.length} style={{ ...td, textAlign: "center", color: "#94a3b8" }}>
                            {idx + 1}
                          </td>
                          <td rowSpan={t.repuestos.length} style={td}>
                            <div className="fw-semibold">{t.tarea}</div>
                            <div className="text-secondary" style={{ fontSize: "0.64rem" }}>
                              {t.sistema.titulo}
                            </div>
                          </td>
                        </>
                      )}
                      <td style={td}>{r.nombre_repuesto}</td>
                      <td style={{ ...td, textAlign: "center", whiteSpace: "nowrap" }}>
                        {r.cant} {r.unidad}
                      </td>
                      <td style={{ ...td, textAlign: "center" }}>
                        <span
                          className="px-1 rounded-1"
                          style={{
                            backgroundColor: ESTADOS_REPUESTO[r.estado]?.fondo,
                            color: ESTADOS_REPUESTO[r.estado]?.color,
                            fontSize: "0.62rem",
                            fontWeight: 700,
                            whiteSpace: "nowrap",
                          }}
                        >
                          {r.estado}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </Table>
          </div>
        )}
      </Modal.Body>
    </Modal>
  );

  if (!unidadManitouValida(unidad)) return <Error404 />;

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
      {/* La cosecha y Manitou › General ya están en el encabezado de abajo. */}
      <NavbarSanPablo
        icono={<i className="bi bi-grid-fill"></i>}
        volverA={`/reparaciones/sanpablo/${param}/manitous`}
      />

      {desplegada ? (
        // Todos los sistemas en una sola página, uno debajo del otro, y la
        // página entera scrollea.
        <div className="flex-grow-1 px-3 py-3" style={{ overflowY: "auto" }}>
          <div style={{ maxWidth: ANCHO_DESPLEGADA, margin: "0 auto" }}>
            {encabezado(ANCHO_DESPLEGADA)}
            {panelAvance}
            {/* General no se chequea: no lleva filtros. */}
            {/* Una línea: a la izquierda agrupar o desplegar todos los sistemas
                (cada uno se agrupa también tocando su título), a la derecha
                los filtros. */}
            <div className="d-flex flex-wrap align-items-center justify-content-between gap-2 mb-4">
              <div className="d-flex gap-2">
                <button
                  type="button"
                  onClick={() => setPlegados(new Set(SISTEMAS_MANITOU.map((s) => s.id)))}
                  className="btn btn-sm btn-outline-secondary rounded-3 px-2 py-0 d-flex align-items-center gap-1"
                  style={{ height: "26px", fontSize: "0.74rem", fontWeight: 600 }}
                >
                  <i className="bi bi-chevron-bar-contract"></i>
                  <span>Agrupar todo</span>
                </button>
                <button
                  type="button"
                  onClick={() => setPlegados(new Set())}
                  className="btn btn-sm btn-outline-secondary rounded-3 px-2 py-0 d-flex align-items-center gap-1"
                  style={{ height: "26px", fontSize: "0.74rem", fontWeight: 600 }}
                >
                  <i className="bi bi-chevron-bar-expand"></i>
                  <span>Desplegar todo</span>
                </button>
              </div>
              {/* A la derecha, los botones Presupuesto y Repuestos y los filtros.
                  Presupuesto lleva a la tarjeta de General (20/10/2026). */}
              {!esGeneral && (
                <div className="d-flex align-items-center gap-4">
                  <div className="d-flex align-items-center gap-2">
                  <button
                    type="button"
                    onClick={() => navigate(`/reparaciones/sanpablo/${param}/manitous/general/presupuesto`)}
                    className="btn btn-sm rounded-3 px-2 py-0 d-flex align-items-center gap-1"
                    style={{ height: "26px", fontSize: "0.74rem", fontWeight: 600, backgroundColor: "#059669", borderColor: "#059669", color: "#fff" }}
                    title="El presupuesto de las Manitous"
                  >
                    <i className="bi bi-currency-dollar"></i>
                    <span>Presupuesto</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setVerRepuestos(true)}
                    disabled={!datos}
                    className="btn btn-sm rounded-3 px-2 py-0 d-flex align-items-center gap-1"
                    style={{ height: "26px", fontSize: "0.74rem", fontWeight: 600, backgroundColor: COLOR, borderColor: COLOR, color: "#fff" }}
                    title="Todos los repuestos de la Manitou, por tarea"
                  >
                    <i className="bi bi-gear-fill"></i>
                    <span>Repuestos</span>
                  </button>
                  </div>
                  <FiltroChequeoManitou valor={filtro} onChange={setFiltro} className="" />
                </div>
              )}
            </div>
            {!datos ? (
              <div className="text-center text-muted py-5">Cargando…</div>
            ) : hayFiltro(filtro) &&
              !SISTEMAS_MANITOU.some((s) =>
                filasDeSistema(s.id).some((f) => pasaFiltro(f, filtro, datos.cotizaciones))
              ) ? (
              <div className="text-center text-muted py-5">Ningún ítem coincide con los filtros.</div>
            ) : (
              SISTEMAS_MANITOU.map((s) => (
                <ChequeosManitou
                  key={s.id}
                  embebido
                  idSistema={s.id}
                  filasIniciales={datos.filas[s.id]}
                  cotizacionesIniciales={datos.cotizaciones}
                  onFilas={alCambiarFilas}
                  filtro={filtro}
                  plegado={plegados.has(s.id)}
                  onPlegar={() => plegar(s.id)}
                  estadoIngreso={estadosIngreso[s.id]}
                  onEstadoIngreso={esGeneral ? undefined : alCambiarEstadoIngreso}
                  avance={avance?.porSistema.find((p) => p.sistema.id === s.id)}
                />
              ))
            )}
          </div>
        </div>
      ) : (
        /* Las 7 tarjetas en dos filas (4 y 3), sin scroll, a la mitad del tamaño
           de las de la cosecha. Arriba, bien visible, que es Manitou, y los
           responsables. */
        <TarjetasSanPablo
          tarjetas={esGeneral ? [...tarjetas, tarjetaPresupuesto] : tarjetas}
          base={`/reparaciones/sanpablo/${param}/manitous/${unidad}`}
          porFila={4}
          maxWidth={esGeneral ? ANCHO_GENERAL : ANCHO}
          chicas
        >
          {encabezado(esGeneral ? ANCHO_GENERAL : ANCHO)}
        </TarjetasSanPablo>
      )}

      {/* Modal Responsable: un solo campo; cada uno que se guarda se suma
          abajo del botón. */}
      {modalResponsable}
      {modalPesos}
      {modalRepuestos}
    </div>
  );
}

export default ManitouGeneralSanPablo;
