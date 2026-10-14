import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Swal from "sweetalert2";
import { Container, Card, Table, Button, Form, Modal } from "react-bootstrap";
import TractorIcon from "../shared/TractorIcon";
import LogoNavbar from "../shared/LogoNavbar";
import { api } from "../../services/api";
import { exportarPlanilla } from "../../helpers/excel";
import { compararCC } from "../../utils/ordenCC";
import { FILTROS } from "../../utils/filtrosTractor";
import { Raya, BotonAccion } from "../compras/estilos";
import SesionUsuario from "../shared/SesionUsuario";

// Formato común de tablas (docs/formato-tablas.md), como Tractores › Repuestos.
const VERDE = "#1b4332";
const CIAN = "#0e7490";
const th = {
  backgroundColor: VERDE,
  color: "#fff",
  fontSize: "0.66rem",
  fontWeight: 600,
  verticalAlign: "middle",
  padding: "3px 5px",
  whiteSpace: "nowrap",
};
const thCentro = { ...th, textAlign: "center" };
const td = { fontSize: "0.7rem", padding: "2px 5px", verticalAlign: "middle" };
const tdCentro = { ...td, textAlign: "center" };
const control = { fontSize: "0.7rem", height: "24px", padding: "1px 6px" };

// Cómo se pide cada CC: completo (uno de cada filtro que tiene cargado) o
// parcial (los tipos que se elijan, con su cantidad).
const MODOS = [
  { id: "completo", titulo: "Completo", color: "#15803d" },
  { id: "parcial", titulo: "Parcial", color: "#d97706" },
];

// Lo armado queda en el sessionStorage (14/10/2026): sobrevive al cambiar de
// pantalla y se pierde al cerrar la pestaña. Si el navegador no deja leerlo,
// arranca vacío.
const CLAVE_SESION = "tractores.cotizador";
const leerSesion = () => {
  try {
    return JSON.parse(sessionStorage.getItem(CLAVE_SESION)) || {};
  } catch {
    return {};
  }
};

/**
 * El cotizador de filtros (13/10/2026): se eligen varios CC y de cada uno se
 * dice si va completo o parcial. Al final, el resumen: cada código de filtro
 * con la cantidad total del pedido. De cada filtro se toma la primera marca
 * cargada. No guarda nada en la base: es para armar el pedido o la cotización.
 */
export default function TractoresCotizador() {
  const navigate = useNavigate();

  const [tractores, setTractores] = useState([]);
  const [repuestos, setRepuestos] = useState({});
  const [cargando, setCargando] = useState(true);
  // Los CC elegidos, por id de tractor, en el orden en que se eligieron.
  const [elegidos, setElegidos] = useState(() => leerSesion().elegidos || []);
  // { [tractorId]: "completo" | "parcial" }; sin marcar, completo.
  const [modos, setModos] = useState(() => leerSesion().modos || {});
  // { [tractorId]: cantidad }: cuántos de cada filtro en el completo (1).
  const [cantCompleto, setCantCompleto] = useState(() => leerSesion().cantCompleto || {});
  // { [tractorId]: { [campo]: cant } }: los tipos de filtro del parcial.
  const [parciales, setParciales] = useState(() => leerSesion().parciales || {});
  // El modal del parcial: el CC y las cantidades que se están cargando.
  const [modalParcial, setModalParcial] = useState(null); // { t, cants: { [campo]: cant } }

  useEffect(() => {
    try {
      sessionStorage.setItem(CLAVE_SESION, JSON.stringify({ elegidos, modos, cantCompleto, parciales }));
    } catch {
      // Sin sessionStorage el cotizador anda igual; solo no se recuerda.
    }
  }, [elegidos, modos, cantCompleto, parciales]);

  useEffect(() => {
    Promise.all([api.get("/tractores"), api.get("/repuestos-tractor")])
      .then(([ts, rs]) => {
        setTractores(Array.isArray(ts) ? ts : []);
        setRepuestos(Object.fromEntries((Array.isArray(rs) ? rs : []).map((r) => [String(r.tractor), r])));
      })
      .catch((err) => Swal.fire({ icon: "error", title: "No se pudieron cargar los filtros", text: err.message, width: "300px" }))
      .finally(() => setCargando(false));
  }, []);

  const repuestoDe = (t) => repuestos[String(t._id)] || {};
  // Los filtros cargados de un tipo, sin los renglones vacíos.
  const alternativas = (t, campo) => (repuestoDe(t)[campo] || []).filter((a) => a.codigo || a.marca);
  // Solo los CC con algún filtro cargado: los demás no tienen qué pedir.
  const conFiltros = [...tractores]
    .filter((t) => FILTROS.some((f) => alternativas(t, f.campo).length > 0))
    .sort((a, b) => compararCC(a.cc, b.cc));

  const visibles = conFiltros;

  const porId = Object.fromEntries(tractores.map((t) => [String(t._id), t]));
  const seleccion = elegidos.map((id) => porId[id]).filter(Boolean);

  const alternar = (t) => {
    const id = String(t._id);
    setElegidos((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };
  const elegirVisibles = () =>
    setElegidos((prev) => [...prev, ...visibles.map((t) => String(t._id)).filter((id) => !prev.includes(id))]);

  // Los tipos de filtro que tiene cargados un CC.
  const tiposDe = (t) => FILTROS.filter((f) => alternativas(t, f.campo).length > 0);
  const modoDe = (t) => modos[String(t._id)] || "completo";
  const cantCompletoDe = (t) => cantCompleto[String(t._id)] ?? 1;
  // El parcial guardado, como [{ campo, cant }] y solo lo que tiene cantidad.
  const parcialDe = (t) =>
    Object.entries(parciales[String(t._id)] || {})
      .map(([campo, cant]) => ({ campo, cant }))
      .filter((p) => Number(p.cant) > 0);

  // Completo se marca directo; Parcial abre el modal, y se marca recién al
  // aceptarlo.
  const elegirModo = (t, modo) => {
    if (modo === "parcial") abrirParcial(t);
    else setModos((prev) => ({ ...prev, [String(t._id)]: modo }));
  };
  const abrirParcial = (t) => setModalParcial({ t, cants: { ...(parciales[String(t._id)] || {}) } });
  const aceptarParcial = (e) => {
    e.preventDefault();
    const id = String(modalParcial.t._id);
    setParciales((prev) => ({ ...prev, [id]: modalParcial.cants }));
    setModos((prev) => ({ ...prev, [id]: "parcial" }));
    setModalParcial(null);
  };
  const hayParcial = modalParcial && Object.values(modalParcial.cants).some((c) => Number(c) > 0);

  // Lo que se pide de un CC: [{ campo, cant }].
  const pedidoDe = (t) =>
    modoDe(t) === "completo" ? tiposDe(t).map((f) => ({ campo: f.campo, cant: cantCompletoDe(t) })) : parcialDe(t);
  // El parcial en una línea: "Aire 2 · Aceite 1".
  const textoParcial = (t) =>
    parcialDe(t)
      .map((p) => `${FILTROS.find((f) => f.campo === p.campo)?.titulo.replace(/^Filtro (de )?/, "")} ${p.cant}`)
      .join(" · ");

  // ── Resumen ──
  // Cada código de filtro con la cantidad total. Se agrupa por tipo, marca y
  // código (la primera marca cargada); lo de cantidad 0 no se pide.
  const grupos = new Map();
  for (const t of seleccion) {
    for (const { campo, cant } of pedidoDe(t)) {
      const f = FILTROS.find((x) => x.campo === campo);
      const a = f && alternativas(t, campo)[0];
      const n = Number(cant);
      if (!a || !(n > 0)) continue;
      const clave = [campo, (a.marca || "").trim().toLowerCase(), (a.codigo || "").trim().toLowerCase()].join("|");
      const g = grupos.get(clave) || { filtro: f, orden: FILTROS.indexOf(f), marca: a.marca, codigo: a.codigo, cant: 0, ccs: [] };
      g.cant += n;
      g.ccs.push(t.cc);
      grupos.set(clave, g);
    }
  }
  const resumen = [...grupos.values()].sort(
    (a, b) => a.orden - b.orden || (a.codigo || "").localeCompare(b.codigo || "", "es")
  );
  const totalFiltros = resumen.reduce((acc, g) => acc + g.cant, 0);

  // Limpiar: borra todo lo armado (CC, modos, cantidades y parciales) para
  // empezar una cotización nueva.
  const hayAlgo =
    elegidos.length > 0 ||
    Object.keys(modos).length > 0 ||
    Object.keys(cantCompleto).length > 0 ||
    Object.keys(parciales).length > 0;
  const limpiar = async () => {
    const { isConfirmed } = await Swal.fire({
      icon: "warning",
      title: "¿Limpiar la cotización?",
      text: "Se borran los CC elegidos y sus cantidades.",
      width: "320px",
      showCancelButton: true,
      confirmButtonText: "Sí, limpiar",
      cancelButtonText: "Cancelar",
      confirmButtonColor: "#dc2626",
      cancelButtonColor: "#64748b",
    });
    if (!isConfirmed) return;
    setElegidos([]);
    setModos({});
    setCantCompleto({});
    setParciales({});
  };

  const exportarExcel = () =>
    exportarPlanilla({
      titulo: "Cotizador de filtros — Tractores",
      columnas: [
        { titulo: "Filtro", ancho: 24 },
        { titulo: "Marca", ancho: 18 },
        { titulo: "Código", ancho: 22 },
        { titulo: "Cantidad", ancho: 12 },
        { titulo: "CC", ancho: 40 },
      ],
      filas: [
        ...resumen.map((g) => [g.filtro.titulo, g.marca || "", g.codigo || "", g.cant, g.ccs.join(", ")]),
        ["TOTAL", "", "", totalFiltros, ""],
      ],
      hoja: "Pedido",
      archivo: `cotizador_filtros_${new Date().toISOString().slice(0, 10)}.xlsx`,
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
      {/* Barra de Cabecera Institucional, como Tractores › Repuestos */}
      <div
        className="d-flex align-items-center justify-content-between px-4 py-2 border-bottom shadow-sm flex-shrink-0"
        style={{ backgroundColor: "#1e293b", color: "#fff", height: "54px", position: "relative" }}
      >
        <LogoNavbar />
        <div className="d-flex align-items-center gap-3">
          <div
            className="rounded-3 d-flex align-items-center justify-content-center me-1"
            style={{
              width: "34px",
              height: "34px",
              backgroundColor: CIAN,
              color: "#fff",
              fontSize: "1.15rem",
              boxShadow: "0 2px 8px rgba(14, 116, 144, 0.35)",
            }}
          >
            <i className="bi bi-calculator-fill"></i>
          </div>
          <span className="text-white fs-6 fw-semibold">Tractores — Cotizador</span>
        </div>

        <div className="d-flex align-items-center gap-2">
          <button
            onClick={() => navigate("/tractores/repuestos")}
            className="btn btn-sm btn-outline-light d-flex align-items-center gap-1.5 rounded-3 px-3 py-1"
            style={{ fontSize: "0.82rem" }}
          >
            <i className="bi bi-arrow-left"></i>
            <span>Volver</span>
          </button>
          <button
            onClick={() => navigate("/tractores")}
            className="btn btn-sm btn-outline-light d-flex align-items-center gap-2 rounded-3 px-3 py-1"
            style={{ fontSize: "0.82rem" }}
          >
            <TractorIcon size="1.05rem" color="#fff" />
            <span>Tractores</span>
          </button>
          <button
            onClick={() => navigate("/")}
            className="btn btn-sm btn-light text-dark d-flex align-items-center gap-1.5 rounded-3 px-3 py-1"
            style={{ fontSize: "0.82rem" }}
          >
            <i className="bi bi-house-door-fill"></i>
            <span>General</span>
          </button>
          <span style={{ width: "1px", height: "24px", backgroundColor: "rgba(255,255,255,0.22)" }} />
          <SesionUsuario mostrarRol />
        </div>
      </div>

      <div className="flex-grow-1" style={{ overflowY: "auto" }}>
        <Container fluid className="px-3 py-3" style={{ maxWidth: "1080px", width: "100%", margin: "0 auto" }}>
          {/* 1. Elegir los CC */}
          <Card className="mb-3 p-3 shadow-sm border-0 rounded-3">
            {/* Título a la izquierda, Limpiar al medio, Elegir todos/Ninguno a la
                derecha: los dos costados con flex 1 dejan Limpiar centrado. */}
            <div className="d-flex align-items-end gap-2 flex-wrap mb-4">
              <span className="fw-bold me-2" style={{ color: VERDE, fontSize: "1.05rem", flex: 1 }}>
                Elegir CC
              </span>
              <Button
                size="sm"
                variant="outline-danger"
                onClick={limpiar}
                disabled={!hayAlgo}
                className="rounded-3 px-3 d-flex align-items-center gap-2"
                style={{ fontSize: "0.78rem", height: "30px", fontWeight: 600 }}
                title="Empezar una cotización nueva"
              >
                <i className="bi bi-eraser-fill"></i>
                <span>Limpiar</span>
              </Button>
              <div className="d-flex gap-2 justify-content-end" style={{ flex: 1 }}>
                <button
                  type="button"
                  onClick={elegirVisibles}
                  disabled={visibles.length === 0}
                  className="btn btn-sm btn-outline-secondary rounded-3 px-2 py-0"
                  style={{ height: "26px", fontSize: "0.74rem", fontWeight: 600 }}
                >
                  Elegir todos
                </button>
                <button
                  type="button"
                  onClick={() => setElegidos([])}
                  disabled={elegidos.length === 0}
                  className="btn btn-sm btn-outline-secondary rounded-3 px-2 py-0"
                  style={{ height: "26px", fontSize: "0.74rem", fontWeight: 600 }}
                >
                  Ninguno
                </button>
              </div>
            </div>
            {cargando ? (
              <div className="text-center text-muted py-3" style={{ fontSize: "0.85rem" }}>
                Cargando…
              </div>
            ) : visibles.length === 0 ? (
              <div className="text-center text-muted py-3" style={{ fontSize: "0.85rem" }}>
                No hay CC con filtros cargados
              </div>
            ) : (
              <div className="d-flex flex-wrap gap-1">
                {visibles.map((t) => {
                  const marcado = elegidos.includes(String(t._id));
                  return (
                    <button
                      key={t._id}
                      type="button"
                      onClick={() => alternar(t)}
                      className="btn btn-sm rounded-3 px-2 py-0 d-flex align-items-center gap-1"
                      title={t.descripcion || undefined}
                      style={{
                        height: "26px",
                        fontSize: "0.74rem",
                        fontWeight: marcado ? 700 : 600,
                        backgroundColor: marcado ? CIAN : "#fff",
                        borderColor: marcado ? CIAN : "#cbd5e1",
                        color: marcado ? "#fff" : "#1e293b",
                      }}
                    >
                      {marcado && <i className="bi bi-check-lg"></i>}
                      <span>{t.cc}</span>
                    </button>
                  );
                })}
              </div>
            )}
            <div className="text-secondary mt-2" style={{ fontSize: "0.7rem" }}>
              Salen solo los CC que tienen algún filtro cargado en Repuestos.
            </div>
          </Card>

          {/* 2. Los filtros de cada CC elegido: la marca y la cantidad */}
          {seleccion.length > 0 && (
            <>
              <div className="fw-bold mb-2" style={{ color: VERDE, fontSize: "1.05rem" }}>
                Filtros de los CC elegidos
              </div>
              {/* Angosta: del ancho de lo que tiene, no de la página. */}
              <div
                className="shadow-sm rounded-3 bg-white mb-3"
                style={{ overflowX: "auto", border: "1px solid #cbd5e1", width: "fit-content", maxWidth: "100%" }}
              >
                <Table className="mb-0 tabla-informe">
                  <thead>
                    <tr>
                      <th style={{ ...thCentro, width: "56px" }}>CC</th>
                      <th style={{ ...th, minWidth: "140px" }}>Descripción</th>
                      <th style={thCentro}>Pedido</th>
                      <th style={{ ...thCentro, width: "30px" }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {seleccion.map((t) => {
                      const modo = modoDe(t);
                      // Un círculo para tildar; se marca uno solo.
                      const circulo = (m) => {
                        const marcado = modo === m.id;
                        return (
                          <button
                            type="button"
                            onClick={() => elegirModo(t, m.id)}
                            className="btn btn-link p-0 text-decoration-none d-flex align-items-center gap-1 flex-shrink-0"
                            style={{ fontSize: "0.72rem", fontWeight: marcado ? 700 : 600, color: marcado ? m.color : "#64748b" }}
                          >
                            <span
                              className="d-inline-flex align-items-center justify-content-center"
                              style={{
                                width: "14px",
                                height: "14px",
                                borderRadius: "50%",
                                border: `2px solid ${marcado ? m.color : "#94a3b8"}`,
                                backgroundColor: marcado ? m.color : "#fff",
                              }}
                            >
                              {marcado && <i className="bi bi-check-lg" style={{ color: "#fff", fontSize: "0.6rem", lineHeight: 1 }}></i>}
                            </span>
                            <span>{m.titulo}</span>
                          </button>
                        );
                      };
                      return (
                        <tr key={t._id}>
                          <td style={{ ...tdCentro, fontWeight: 700 }}>{t.cc}</td>
                          <td style={td}>{t.descripcion || <Raya />}</td>
                          <td style={{ ...td, padding: "3px 8px" }}>
                            <div className="d-flex align-items-center" style={{ whiteSpace: "nowrap", gap: "2rem" }}>
                              {/* Completo, con la cantidad de cada filtro al lado. */}
                              <div className="d-flex align-items-center gap-1">
                                {circulo(MODOS[0])}
                                <Form.Control
                                  size="sm"
                                  type="number"
                                  min={1}
                                  step={1}
                                  disabled={modo !== "completo"}
                                  className="rounded-2 text-center"
                                  style={{ ...control, width: "44px" }}
                                  value={modo === "completo" ? cantCompletoDe(t) : 0}
                                  onChange={(e) => setCantCompleto((prev) => ({ ...prev, [String(t._id)]: e.target.value }))}
                                  title="Cuántos de cada filtro"
                                />
                              </div>
                              {/* Parcial: abre el modal; lo elegido queda en una línea, con el lápiz para editarlo. */}
                              <div className="d-flex align-items-center gap-1">
                                {circulo(MODOS[1])}
                                {modo === "parcial" && (
                                  <>
                                    <span className="fw-semibold" style={{ color: "#1e293b" }}>
                                      {textoParcial(t)}
                                    </span>
                                    <BotonAccion icono="bi-pencil" titulo="Editar el parcial" variante="primary" onClick={() => abrirParcial(t)} />
                                  </>
                                )}
                              </div>
                            </div>
                          </td>
                          <td style={tdCentro}>
                            <button
                              type="button"
                              onClick={() => alternar(t)}
                              className="btn btn-link p-0 text-danger"
                              style={{ fontSize: "0.8rem", lineHeight: 1 }}
                              title="Sacar este CC"
                            >
                              <i className="bi bi-x-lg"></i>
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </Table>
              </div>

              {/* 3. El resumen: cada código con la cantidad del pedido. Título,
                  Excel y tabla van del ancho de la tabla: el Excel queda a su borde. */}
              <div style={{ width: "fit-content", maxWidth: "100%" }}>
              <div className="d-flex align-items-center gap-2 mb-2">
                <span className="fw-bold" style={{ color: VERDE, fontSize: "1.05rem" }}>
                  Resumen del pedido
                </span>
                <Button
                  size="sm"
                  onClick={exportarExcel}
                  disabled={resumen.length === 0}
                  className="rounded-3 px-3 d-flex align-items-center gap-2 ms-auto"
                  style={{ backgroundColor: "#15803d", borderColor: "#15803d", fontSize: "0.78rem", height: "30px", fontWeight: 600 }}
                  title="Exportar a Excel"
                >
                  <i className="bi bi-file-earmark-excel-fill"></i>
                  <span>Excel</span>
                </Button>
              </div>
              <div
                className="shadow-sm rounded-3 bg-white"
                style={{ overflowX: "auto", border: "1px solid #cbd5e1", width: "fit-content", maxWidth: "100%" }}
              >
                <Table className="mb-0 tabla-informe">
                  <thead>
                    <tr>
                      <th style={th}>Filtro</th>
                      <th style={th}>Marca</th>
                      <th style={th}>Código</th>
                      <th style={{ ...thCentro, width: "80px" }}>Cantidad</th>
                      <th style={th}>CC</th>
                    </tr>
                  </thead>
                  <tbody>
                    {resumen.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="text-center text-muted py-3" style={td}>
                          No hay nada para pedir
                        </td>
                      </tr>
                    ) : (
                      <>
                        {resumen.map((g) => (
                          <tr key={`${g.filtro.campo}|${g.marca}|${g.codigo}`}>
                            <td style={td}>{g.filtro.titulo}</td>
                            <td style={td}>{g.marca || <Raya />}</td>
                            <td style={{ ...td, fontWeight: 700 }}>{g.codigo || <Raya />}</td>
                            <td style={{ ...tdCentro, fontWeight: 700 }}>{g.cant}</td>
                            <td style={{ ...td, color: "#64748b" }}>{g.ccs.join(", ")}</td>
                          </tr>
                        ))}
                        <tr className="fila-total">
                          <td colSpan={3} style={{ ...td, fontWeight: 700, color: VERDE }}>
                            TOTAL
                          </td>
                          <td style={{ ...tdCentro, fontWeight: 700, color: VERDE }}>{totalFiltros}</td>
                          <td style={td}></td>
                        </tr>
                      </>
                    )}
                  </tbody>
                </Table>
              </div>
              </div>
            </>
          )}
        </Container>
      </div>

      {/* Modal Parcial: cada tipo de filtro que tiene el CC con su cantidad;
          en 0 no se pide. */}
      <Modal
        show={Boolean(modalParcial)}
        onHide={() => setModalParcial(null)}
        centered
        size="sm"
        contentClassName="border-0 shadow-lg rounded-4"
      >
        <Modal.Header
          closeButton
          closeVariant="white"
          style={{
            backgroundColor: "#1e293b",
            color: "#fff",
            borderTopLeftRadius: "1rem",
            borderTopRightRadius: "1rem",
            borderBottom: "1px solid rgba(255,255,255,0.1)",
          }}
        >
          <Modal.Title className="fs-6 fw-normal d-flex align-items-center gap-2 text-white">
            <i className="bi bi-funnel-fill"></i>
            <span>Parcial · CC {modalParcial?.t.cc}</span>
          </Modal.Title>
        </Modal.Header>
        {modalParcial && (
          <Form onSubmit={aceptarParcial}>
            <Modal.Body className="p-3">
              <div className="d-flex flex-column gap-2">
                {tiposDe(modalParcial.t).map((f) => (
                  <div key={f.campo} className="d-flex align-items-center justify-content-between gap-2">
                    <span className="fw-semibold text-dark" style={{ fontSize: "0.82rem" }}>
                      {f.titulo}
                    </span>
                    <Form.Control
                      size="sm"
                      type="number"
                      min={0}
                      step={1}
                      className="rounded-3 text-center"
                      style={{ width: "64px", fontSize: "0.82rem" }}
                      value={modalParcial.cants[f.campo] ?? ""}
                      placeholder="0"
                      onChange={(e) =>
                        setModalParcial((m) => ({ ...m, cants: { ...m.cants, [f.campo]: e.target.value } }))
                      }
                    />
                  </div>
                ))}
              </div>
            </Modal.Body>
            <Modal.Footer
              className="bg-light border-0 py-2 px-3"
              style={{ borderBottomLeftRadius: "1rem", borderBottomRightRadius: "1rem" }}
            >
              <Button
                variant="outline-secondary"
                size="sm"
                onClick={() => setModalParcial(null)}
                className="rounded-3 px-3 py-1"
                style={{ fontSize: "0.84rem" }}
              >
                Cancelar
              </Button>
              <Button
                size="sm"
                type="submit"
                disabled={!hayParcial}
                className="rounded-3 px-3 py-1 shadow-sm d-flex align-items-center gap-1"
                style={{ backgroundColor: "#15803d", borderColor: "#15803d", fontSize: "0.84rem", fontWeight: 600 }}
                title={hayParcial ? undefined : "Poné la cantidad de algún filtro"}
              >
                <i className="bi bi-check-lg"></i>
                <span>Aceptar</span>
              </Button>
            </Modal.Footer>
          </Form>
        )}
      </Modal>
    </div>
  );
}
