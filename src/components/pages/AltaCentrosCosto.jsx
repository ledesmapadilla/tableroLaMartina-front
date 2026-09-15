import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import Swal from "sweetalert2";
import { Container, Card, Table, Button, Form, Modal, Row, Col } from "react-bootstrap";
import { api } from "../../services/api";
import { exportarPlanilla } from "../../helpers/excel";
import { compararCC } from "../../utils/ordenCC";
import { BORDO, BORDO_SUAVE, campo, th as thBase, td, tdCentro } from "../compras/formato";
import { Raya, BotonAccion, BotonLimpiar, FiltroTexto, FiltroSelect } from "../compras/estilos";
import { usePermisos } from "../../context/permisos";

// El verde de Producción y su clarito, para cuando la pantalla se abre ahí.
const VERDE = "#1b4332";
const VERDE_SUAVE = "#e8f5ee";

// Equipos con los que se puede asociar un CC. Para sumar uno nuevo alcanza
// con agregarlo acá: alimenta el selector del alta y el filtro del listado.
const EQUIPOS = [
  "Tractor",
  "Turbo",
  "Chancho",
  "Nodriza",
  "Martignani",
  "Metalfor",
  "Jacto",
  "Tk. riego",
  "Herbicida",
  "Desmalezadora",
  "Abonadora",
  "Camioneta",
  "Camión",
  "Otros",
];

// Equipos cuyo padrón se maneja en su propia pantalla: acá no se dan de alta
// ni de baja, y no se les cambia el CC, el equipo ni la descripción. Sí se les
// completan los datos de Compras (grupo, marca, observaciones). Es la misma
// regla que aplica el back (centroscosto.controller.js).
const EQUIPOS_GESTIONADOS = {
  Tractor: "Tractores",
  Camioneta: "Camionetas",
};

// Qué pantalla manda sobre un CC. El que está enlazado a un tractor es de
// Tractores aunque su equipo diga "Camión" (el CC 901 es un camión cargado en
// Tractores para llevar sus services por km); si no, se decide por el equipo.
const pantallaQueManda = (c) =>
  c.tractor ? "Tractores" : EQUIPOS_GESTIONADOS[(c.equipo || "").trim()] || null;
const EQUIPOS_ELEGIBLES = EQUIPOS.filter((e) => !EQUIPOS_GESTIONADOS[e]);

// El listado va agrupado por equipo, en el orden de EQUIPOS, y dentro de cada
// equipo por número de CC. Los que no tienen equipo cargado van al final.
const ordenEquipo = (equipo) => {
  const i = EQUIPOS.indexOf((equipo || "").trim());
  return i === -1 ? EQUIPOS.length : i;
};

const ordenarCentros = (lista) =>
  [...lista].sort((a, b) => {
    const dif = ordenEquipo(a.equipo) - ordenEquipo(b.equipo);
    return dif !== 0 ? dif : compararCC(a.cc, b.cc);
  });

const FORM_INIT = { cc: "", equipo: "", descripcion: "", grupo: "", marca: "", observaciones: "" };
const FILTROS_INIT = { buscar: "", equipo: "", grupo: "" };
const COLUMNAS = 7;

/**
 * Centros de costo: un solo padrón para todo el proyecto.
 *
 * Reemplaza a las dos pantallas que había hasta el 13/09/2026 sobre el mismo
 * registro: la de Producción cargaba CC, equipo y descripción, y la de
 * Compras grupo, marca y observaciones, así que nadie veía la ficha entera.
 *
 * Se abre desde /produccion/altas/cc y desde /compras/altas/centros-costo,
 * cada una dentro de la barra de su sección y con su color.
 */
export default function AltaCentrosCosto() {
  // Ver sin editar (tabla de Roles): nuevo, editar y borrar quedan a la vista
  // pero deshabilitados.
  const { puede } = usePermisos();
  const sinEditar = !puede("altas.centrosCosto", "editar");
  const { pathname } = useLocation();
  const enCompras = pathname.startsWith("/compras");
  const color = enCompras ? BORDO : VERDE;
  const colorSuave = enCompras ? BORDO_SUAVE : VERDE_SUAVE;
  const th = { ...thBase, backgroundColor: color };
  const thCentro = { ...th, textAlign: "center" };

  const [centros, setCentros] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [filtros, setFiltros] = useState(FILTROS_INIT);
  const [form, setForm] = useState(FORM_INIT);
  // El CC que se está editando, o null en un alta nueva.
  const [editando, setEditando] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const setF = (k, v) => setFiltros((f) => ({ ...f, [k]: v }));
  const hayFiltros = Object.values(filtros).some((v) => v !== "");

  const cargar = () =>
    api
      .get("/centros-costo")
      .then((data) => setCentros(Array.isArray(data) ? data : []))
      .catch(() => setCentros([]))
      .finally(() => setCargando(false));

  useEffect(() => {
    cargar();
  }, []);

  const grupos = [...new Set(centros.map((c) => (c.grupo || "").trim()).filter(Boolean))].sort((a, b) =>
    a.localeCompare(b)
  );

  const lista = ordenarCentros(centros).filter((c) => {
    const q = filtros.buscar.toLowerCase().trim();
    if (q && ![c.cc, c.descripcion, c.marca, c.observaciones].some((v) => (v || "").toLowerCase().includes(q))) {
      return false;
    }
    if (filtros.equipo && (c.equipo || "").trim() !== filtros.equipo) return false;
    if (filtros.grupo && (c.grupo || "").trim() !== filtros.grupo) return false;
    return true;
  });

  const avisarGestionado = (c) => {
    const pantalla = pantallaQueManda(c);
    return Swal.fire({
      icon: "info",
      title: `Se administra desde ${pantalla}`,
      text: `El CC ${c.cc} se da de alta y de baja en la pantalla de ${pantalla}. Desde acá solo se completan el grupo, la marca y las observaciones.`,
      confirmButtonColor: color,
    });
  };

  const abrirNuevo = () => {
    setEditando(null);
    setForm(FORM_INIT);
    setShowModal(true);
  };

  const abrirEditar = (c) => {
    setEditando(c);
    setForm({
      cc: c.cc || "",
      equipo: c.equipo || "",
      descripcion: c.descripcion || "",
      grupo: c.grupo || "",
      marca: c.marca || "",
      observaciones: c.observaciones || "",
    });
    setShowModal(true);
  };

  const cerrar = () => {
    setShowModal(false);
    setEditando(null);
    setForm(FORM_INIT);
  };

  const gestionadoEnEdicion = Boolean(editando) && Boolean(pantallaQueManda(editando));

  // Un equipo viejo que ya no está en la lista se sigue ofreciendo: si no, el
  // selector lo mostraría vacío y al guardar se borraría.
  const opcionesEquipo =
    form.equipo && !EQUIPOS_ELEGIBLES.includes(form.equipo) ? [...EQUIPOS_ELEGIBLES, form.equipo] : EQUIPOS_ELEGIBLES;

  const guardar = async (e) => {
    e.preventDefault();
    const eraEdicion = Boolean(editando);
    const limpio = Object.fromEntries(Object.entries(form).map(([k, v]) => [k, (v || "").trim()]));
    // En un CC de Tractores o Camionetas solo viajan los datos de Compras: el
    // resto se cambia en la pantalla del equipo.
    const datos = gestionadoEnEdicion
      ? { grupo: limpio.grupo, marca: limpio.marca, observaciones: limpio.observaciones }
      : limpio;
    try {
      if (eraEdicion) await api.put(`/centros-costo/${editando._id}`, datos);
      else await api.post("/centros-costo", datos);
      cerrar();
      cargar();
      Swal.fire({
        icon: "success",
        title: eraEdicion ? "CC actualizado" : "CC registrado",
        timer: 1500,
        showConfirmButton: false,
      });
    } catch (err) {
      Swal.fire({ icon: "error", title: "No se pudo guardar", text: err.message });
    }
  };

  const eliminar = async (c) => {
    if (pantallaQueManda(c)) {
      avisarGestionado(c);
      return;
    }
    const { isConfirmed } = await Swal.fire({
      title: `¿Borrar el CC ${c.cc}?`,
      text: "Se quita del padrón de todo el proyecto: deja de aparecer en Producción y en Compras.",
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Sí, borrar",
      cancelButtonText: "Cancelar",
      confirmButtonColor: "#dc2626",
      cancelButtonColor: "#64748b",
    });
    if (!isConfirmed) return;
    try {
      await api.delete(`/centros-costo/${c._id}`);
      cargar();
      Swal.fire({ icon: "success", title: "CC borrado", timer: 1200, showConfirmButton: false });
    } catch (err) {
      Swal.fire({ icon: "error", title: "No se pudo borrar", text: err.message });
    }
  };

  const exportarExcel = () =>
    exportarPlanilla({
      titulo: "Centros de costo — La Martina",
      columnas: [
        { titulo: "CC", ancho: 14 },
        { titulo: "Equipo", ancho: 18 },
        { titulo: "Descripción", ancho: 40 },
        { titulo: "Grupo", ancho: 18 },
        { titulo: "Marca", ancho: 18 },
        { titulo: "Observaciones", ancho: 40 },
      ],
      filas: lista.map((c) => [
        c.cc,
        c.equipo || "",
        c.descripcion || "",
        c.grupo || "",
        c.marca || "",
        c.observaciones || "",
      ]),
      hoja: "CC",
      archivo: `centros_costo_${new Date().toISOString().slice(0, 10)}.xlsx`,
    });

  return (
    <div
      style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        backgroundColor: "#f8f9fa",
        height: "100%",
        overflow: "hidden",
      }}
    >
      {/* El ancho de la página lo fija el Container: encabezado, filtros y
          tabla comparten el mismo borde izquierdo y derecho. */}
      <Container
        fluid
        className="px-3 py-2 d-flex flex-column flex-grow-1"
        style={{ maxWidth: "1120px", width: "100%", margin: "0 auto", overflow: "hidden" }}
      >
        {/* Encabezado. El volver está en el navbar de la sección, arriba. */}
        <div className="d-flex align-items-center gap-2 mb-2 flex-wrap">
          <span className="fw-bold" style={{ color, fontSize: "1.05rem" }}>
            Centros de costo
          </span>
          {!cargando && (
            <span
              className="px-2 py-1 rounded-3"
              style={{ fontSize: "0.76rem", backgroundColor: colorSuave, color, fontWeight: 600 }}
            >
              {lista.length} {lista.length === 1 ? "centro" : "centros"}
            </span>
          )}
          <span className="text-muted" style={{ fontSize: "0.76rem" }}>
            Un solo padrón para Producción, Compras y Mantenimiento
          </span>

          <div className="d-flex align-items-center gap-2 ms-auto">
            <Button
              size="sm"
              onClick={exportarExcel}
              disabled={lista.length === 0}
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
              style={{ backgroundColor: color, borderColor: color, fontSize: "0.78rem", height: "30px", fontWeight: 600 }}
            >
              <i className="bi bi-plus-lg"></i>
              <span>Nuevo CC</span>
            </Button>
          </div>
        </div>

        {/* Filtros, con el rótulo arriba del campo. */}
        <Card className="mb-3 p-2 shadow-sm border-0 rounded-3 flex-shrink-0">
          <div className="d-flex align-items-end justify-content-center gap-2 flex-wrap">
            <FiltroTexto
              etiqueta="Buscar"
              ancho="220px"
              valor={filtros.buscar}
              onChange={(v) => setF("buscar", v)}
              placeholder="CC, descripción, marca…"
            />
            <FiltroSelect
              etiqueta="Equipo"
              ancho="150px"
              valor={filtros.equipo}
              vacio="Todos"
              onChange={(v) => setF("equipo", v)}
              opciones={EQUIPOS}
            />
            <FiltroSelect
              etiqueta="Grupo"
              ancho="170px"
              valor={filtros.grupo}
              vacio="Todos"
              onChange={(v) => setF("grupo", v)}
              opciones={grupos}
            />
            {hayFiltros && <BotonLimpiar onClick={() => setFiltros(FILTROS_INIT)} />}
          </div>
        </Card>

        <div
          className="flex-grow-1 shadow-sm rounded-3 bg-white"
          style={{ minHeight: 0, maxWidth: "100%", overflowY: "auto", overflowX: "auto", border: "1px solid #cbd5e1" }}
        >
          <Table className="mb-0 tabla-informe" style={{ width: "100%", minWidth: "860px" }}>
            <thead style={{ position: "sticky", top: 0, zIndex: 10 }}>
              <tr>
                <th style={thCentro}>CC</th>
                <th style={thCentro}>Equipo</th>
                <th style={th}>Descripción</th>
                <th style={th}>Grupo</th>
                <th style={th}>Marca</th>
                <th style={th}>Observaciones</th>
                <th style={thCentro}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {lista.length === 0 ? (
                <tr>
                  <td colSpan={COLUMNAS} className="text-center text-muted py-4" style={td}>
                    {cargando
                      ? "Cargando…"
                      : hayFiltros
                        ? "Ningún CC coincide con los filtros"
                        : "No hay centros de costo cargados"}
                  </td>
                </tr>
              ) : (
                lista.map((c) => {
                  const pantalla = pantallaQueManda(c);
                  return (
                    <tr key={c._id}>
                      <td style={{ ...tdCentro, fontWeight: 700 }}>{c.cc}</td>
                      <td style={tdCentro}>{c.equipo || <Raya />}</td>
                      <td style={td}>{c.descripcion || <Raya />}</td>
                      <td style={td}>{c.grupo || <Raya />}</td>
                      <td style={td}>{c.marca || <Raya />}</td>
                      <td style={td}>{c.observaciones || <Raya />}</td>
                      <td style={tdCentro}>
                        <div className="d-flex justify-content-center align-items-center" style={{ gap: "6px" }}>
                          <BotonAccion
                            icono="bi-pencil"
                            titulo={
                              sinEditar
                                ? "Sin permiso para editar"
                                : pantalla
                                  ? "Completar grupo, marca y observaciones"
                                  : "Editar"
                            }
                            variante="primary"
                            onClick={() => abrirEditar(c)}
                            deshabilitado={sinEditar}
                          />
                          {/* Los de Tractores y Camionetas se borran en su
                              pantalla: el candado lo explica. */}
                          {pantalla ? (
                            <BotonAccion
                              icono="bi-lock-fill"
                              titulo={`Se da de alta y de baja en ${pantalla}`}
                              onClick={() => avisarGestionado(c)}
                            />
                          ) : (
                            <BotonAccion
                              icono="bi-trash"
                              titulo={sinEditar ? "Sin permiso para editar" : "Borrar"}
                              variante="danger"
                              onClick={() => eliminar(c)}
                              deshabilitado={sinEditar}
                            />
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </Table>
        </div>
      </Container>

      {/* Modal Nuevo / Editar CC: la ficha entera, con los datos del equipo y
          los de Compras. */}
      <Modal
        show={showModal}
        onHide={cerrar}
        centered
        dialogClassName="modal-cc"
        contentClassName="border-0 shadow-lg rounded-4"
      >
        <Modal.Header
          closeButton
          closeVariant="white"
          style={{
            backgroundColor: color,
            color: "#fff",
            borderTopLeftRadius: "1rem",
            borderTopRightRadius: "1rem",
            borderBottom: "1px solid rgba(255,255,255,0.1)",
          }}
        >
          <Modal.Title className="fs-6 fw-bold d-flex align-items-center gap-2 text-white">
            <i className="bi bi-diagram-3-fill"></i>
            <span>{editando ? `Editar CC ${editando.cc}` : "Nuevo CC"}</span>
          </Modal.Title>
        </Modal.Header>
        <Form onSubmit={guardar}>
          <Modal.Body className="p-4">
            {gestionadoEnEdicion && (
              <div
                className="mb-3 px-3 py-2 rounded-3"
                style={{ backgroundColor: "#f1f5f9", fontSize: "0.8rem", color: "#475569" }}
              >
                <i className="bi bi-lock-fill me-1"></i>
                El CC, el equipo y la descripción se cambian en la pantalla de{" "}
                {pantallaQueManda(editando)}. Acá se completan los datos de Compras.
              </div>
            )}

            <Row className="g-3">
              <Col xs={5}>
                <Form.Label className="fw-semibold text-dark small mb-1">
                  CC <span className="text-danger">*</span>
                </Form.Label>
                <Form.Control
                  className="rounded-3"
                  style={campo}
                  value={form.cc}
                  onChange={(e) => setForm({ ...form, cc: e.target.value })}
                  maxLength={50}
                  disabled={gestionadoEnEdicion}
                  required
                />
              </Col>

              <Col xs={7}>
                <Form.Label className="fw-semibold text-dark small mb-1">Equipo</Form.Label>
                {gestionadoEnEdicion ? (
                  <Form.Control className="rounded-3" style={campo} value={form.equipo} disabled />
                ) : (
                  <Form.Select
                    className="rounded-3"
                    style={campo}
                    value={form.equipo}
                    onChange={(e) => setForm({ ...form, equipo: e.target.value })}
                  >
                    <option value="">— Sin equipo —</option>
                    {opcionesEquipo.map((eq) => (
                      <option key={eq} value={eq}>
                        {eq}
                      </option>
                    ))}
                  </Form.Select>
                )}
              </Col>

              <Col xs={12}>
                <Form.Label className="fw-semibold text-dark small mb-1">Descripción</Form.Label>
                <Form.Control
                  className="rounded-3"
                  style={campo}
                  value={form.descripcion}
                  onChange={(e) => setForm({ ...form, descripcion: e.target.value })}
                  maxLength={120}
                  disabled={gestionadoEnEdicion}
                />
              </Col>

              {/* El grupo ofrece los que ya existen, para no cargar el mismo
                  con otro nombre: con él Compras filtra los CC de un pedido. */}
              <Col xs={6}>
                <Form.Label className="fw-semibold text-dark small mb-1">Grupo</Form.Label>
                <Form.Control
                  className="rounded-3"
                  style={campo}
                  value={form.grupo}
                  onChange={(e) => setForm({ ...form, grupo: e.target.value })}
                  list="grupos-cc"
                  autoComplete="off"
                />
                <datalist id="grupos-cc">
                  {grupos.map((g) => (
                    <option key={g} value={g} />
                  ))}
                </datalist>
              </Col>

              <Col xs={6}>
                <Form.Label className="fw-semibold text-dark small mb-1">Marca</Form.Label>
                <Form.Control
                  className="rounded-3"
                  style={campo}
                  value={form.marca}
                  onChange={(e) => setForm({ ...form, marca: e.target.value })}
                />
              </Col>

              <Col xs={12}>
                <Form.Label className="fw-semibold text-dark small mb-1">Observaciones</Form.Label>
                <Form.Control
                  as="textarea"
                  rows={2}
                  className="rounded-3"
                  style={campo}
                  value={form.observaciones}
                  onChange={(e) => setForm({ ...form, observaciones: e.target.value })}
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
      </Modal>
    </div>
  );
}
