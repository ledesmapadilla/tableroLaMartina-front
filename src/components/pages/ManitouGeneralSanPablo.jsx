import { useCallback, useEffect, useState } from "react";
import { useLocation, useParams } from "react-router-dom";
import Swal from "sweetalert2";
import { Button, Form, Modal } from "react-bootstrap";
import { api } from "../../services/api";
import { cosechaDeParam } from "../../utils/cosechas";
import { usePermisos } from "../../context/permisos";
import TractorIcon from "../shared/TractorIcon";
import NavbarSanPablo from "../shared/NavbarSanPablo";
import TarjetasSanPablo from "../shared/TarjetasSanPablo";
import { SISTEMAS_MANITOU, MANITOUS_DESPLEGADAS, seccionManitou, unidadManitouValida } from "../../utils/sistemasManitou";
import ChequeosManitou from "./ChequeosManitou";
import { exportarChequeoManitou, pasaFiltro, hayFiltro, FILTRO_CHEQUEO_VACIO } from "../../helpers/excelManitou";
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

function ManitouGeneralSanPablo() {
  const { cosecha: param, unidad } = useParams();
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

  // ── Desplegada (09/10/2026) ──
  // Todos los sistemas en una página: se traen juntos y las cotizaciones
  // una sola vez.
  const desplegada = MANITOUS_DESPLEGADAS.includes(unidad);
  const { hash } = useLocation();
  const [datos, setDatos] = useState(null); // { filas: { [sistema]: [] }, cotizaciones }
  // Un solo filtro para todos los sistemas.
  const [filtro, setFiltro] = useState(FILTRO_CHEQUEO_VACIO);
  // Los sistemas agrupados (solo el título), por id.
  const [plegados, setPlegados] = useState(() => new Set());
  const plegar = (id) =>
    setPlegados((prev) => {
      const nuevo = new Set(prev);
      if (nuevo.has(id)) nuevo.delete(id);
      else nuevo.add(id);
      return nuevo;
    });

  useEffect(() => {
    if (!desplegada) return;
    // Un solo pedido con los ocho sistemas (antes era uno por sistema).
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

  const exportarExcel = () =>
    exportarChequeoManitou({
      titulo: `Reparaciones San Pablo — Manitou ${unidad} — Cosecha ${param}`,
      archivo: `sanpablo_manitou_${unidad}_${param}_${new Date().toISOString().slice(0, 10)}.xlsx`,
      secciones: SISTEMAS_MANITOU.map((s) => ({ sistema: s, filas: filasDeSistema(s.id) })),
      cotizaciones: datos.cotizaciones,
      general: esGeneral,
      filtro: esGeneral ? undefined : filtro,
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

  const quitar = (i) => guardarLista(responsables.filter((_, j) => j !== i));

  // Arriba, bien visible, que es Manitou, y los responsables.
  const encabezado = (ancho) => (
    <div
      className={`d-flex align-items-start justify-content-between gap-3 pb-3 ${desplegada ? "mb-2" : "mb-4"}`}
      style={{ maxWidth: ancho, width: "100%", borderBottom: `3px solid ${VERDE}` }}
    >
      <div className="d-flex align-items-center gap-3">
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

      {/* Los botones y, debajo, los responsables cargados. Desplegada, un
          solo Excel con todos los sistemas. */}
      <div className="d-flex flex-column align-items-end gap-1">
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
            {/* General no se chequea: no lleva filtros. */}
            {/* Una línea: a la izquierda agrupar o desplegar todos los sistemas
                (cada uno se agrupa también tocando su título), a la derecha
                los filtros. */}
            <div className="d-flex flex-wrap align-items-center justify-content-between gap-2 mb-2">
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
              {!esGeneral && <FiltroChequeoManitou valor={filtro} onChange={setFiltro} className="" />}
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
                />
              ))
            )}
          </div>
        </div>
      ) : (
        /* Las 8 tarjetas en dos filas de 4, sin scroll, a la mitad del tamaño
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
    </div>
  );
}

export default ManitouGeneralSanPablo;
