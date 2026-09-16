import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Swal from "sweetalert2";
import { Container, Card, Table, Button, Form, Modal, Row, Col } from "react-bootstrap";
import TractorIcon from "../shared/TractorIcon";
import LogoNavbar from "../shared/LogoNavbar";
import { api } from "../../services/api";
import { exportarPlanilla } from "../../helpers/excel";
import { compararCC } from "../../utils/ordenCC";
import { Raya, BotonAccion, FiltroTexto } from "../compras/estilos";
import { usePermisos } from "../../context/permisos";

// Los filtros que se llevan de cada unidad y cuántas marcas posibles tiene
// cada uno.
const FILTROS = [
  { campo: "filtroAire", titulo: "Filtro de aire" },
  { campo: "filtroCombustible", titulo: "Filtro de combustible" },
  { campo: "filtroAceite", titulo: "Filtro de aceite" },
];
const MARCAS = 3;

// Formato común de tablas (docs/formato-tablas.md).
const th = {
  backgroundColor: "#1b4332",
  color: "#fff",
  fontSize: "0.66rem",
  fontWeight: 600,
  verticalAlign: "middle",
  padding: "3px 5px",
  whiteSpace: "nowrap",
};
const thCentro = { ...th, textAlign: "center" };
const td = { fontSize: "0.7rem", padding: "1px 5px", verticalAlign: "middle" };
const tdCentro = { ...td, textAlign: "center" };
const campo = { fontSize: "0.82rem" };
// #, CC, descripción, los filtros, observaciones y el lápiz.
const COLUMNAS = 5 + FILTROS.length;

// Las 3 casillas de un filtro para el formulario: lo guardado y el resto vacías.
const casillas = (lista = []) =>
  Array.from({ length: MARCAS }, (_, i) => ({ marca: lista[i]?.marca || "", codigo: lista[i]?.codigo || "" }));

const textoAlternativa = (a) => [a.marca, a.codigo].filter(Boolean).join(" · ");

// Una celda de filtro: una línea por marca, la marca en gris y el código.
function CeldaFiltro({ lista }) {
  if (!lista?.length) return <Raya />;
  return (
    <div className="d-flex flex-column" style={{ gap: "1px" }}>
      {lista.map((a, i) => (
        <span key={i}>
          <span className="text-muted">{a.marca || "—"}</span> <span className="fw-semibold">{a.codigo}</span>
        </span>
      ))}
    </div>
  );
}

/**
 * Repuestos de Tractores: los códigos de filtro de aire, combustible y aceite
 * de cada unidad (tractores, manitou y camiones; las que están en desuso no
 * aparecen), con hasta 3 marcas posibles por filtro.
 */
export default function TractoresRepuestos() {
  const { puede } = usePermisos();
  const sinEditar = !puede("tractores.repuestos", "editar");
  const navigate = useNavigate();

  const [tractores, setTractores] = useState([]);
  // Los repuestos guardados, por id de tractor.
  const [repuestos, setRepuestos] = useState({});
  const [cargando, setCargando] = useState(true);
  const [buscar, setBuscar] = useState("");
  // El tractor que se está editando y sus casillas.
  const [editando, setEditando] = useState(null);
  const [form, setForm] = useState({});
  const [guardando, setGuardando] = useState(false);

  const cargar = () =>
    Promise.all([api.get("/tractores"), api.get("/repuestos-tractor")])
      .then(([ts, rs]) => {
        setTractores(Array.isArray(ts) ? ts : []);
        setRepuestos(Object.fromEntries((Array.isArray(rs) ? rs : []).map((r) => [String(r.tractor), r])));
      })
      .catch((err) => Swal.fire({ icon: "error", title: "No se pudieron cargar los repuestos", text: err.message }))
      .finally(() => setCargando(false));

  useEffect(() => {
    cargar();
  }, []);

  const repuestoDe = (t) => repuestos[String(t._id)] || {};

  // Las marcas ya cargadas, para sugerirlas al completar y no escribir la
  // misma de dos maneras.
  const marcas = [
    ...new Set(
      Object.values(repuestos)
        .flatMap((r) => FILTROS.flatMap((f) => (r[f.campo] || []).map((a) => (a.marca || "").trim())))
        .filter(Boolean)
    ),
  ].sort((a, b) => a.localeCompare(b, "es"));

  const q = buscar.toLowerCase().trim();
  const lista = [...tractores]
    .sort((a, b) => compararCC(a.cc, b.cc))
    .filter((t) => {
      if (!q) return true;
      const r = repuestoDe(t);
      const textos = [
        t.cc,
        t.descripcion,
        r.observaciones,
        ...FILTROS.flatMap((f) => (r[f.campo] || []).flatMap((a) => [a.marca, a.codigo])),
      ];
      return textos.some((v) => (v || "").toLowerCase().includes(q));
    });
  const hayFiltros = Boolean(buscar);

  const abrir = (t) => {
    const r = repuestoDe(t);
    setEditando(t);
    setForm({
      ...Object.fromEntries(FILTROS.map((f) => [f.campo, casillas(r[f.campo])])),
      observaciones: r.observaciones || "",
    });
  };

  const cerrar = () => {
    setEditando(null);
    setForm({});
  };

  const setCasilla = (campoFiltro, i, clave, valor) =>
    setForm((f) => ({
      ...f,
      [campoFiltro]: f[campoFiltro].map((a, j) => (j === i ? { ...a, [clave]: valor } : a)),
    }));

  const guardar = async (e) => {
    e.preventDefault();
    setGuardando(true);
    try {
      const r = await api.put(`/repuestos-tractor/${editando._id}`, form);
      setRepuestos((prev) => ({ ...prev, [String(editando._id)]: r }));
      cerrar();
      Swal.fire({ icon: "success", title: "Filtros guardados", timer: 1300, showConfirmButton: false });
    } catch (err) {
      Swal.fire({ icon: "error", title: "No se pudo guardar", text: err.message });
    } finally {
      setGuardando(false);
    }
  };

  const exportarExcel = () =>
    exportarPlanilla({
      titulo: "Repuestos de Tractores — Filtros",
      columnas: [
        { titulo: "CC", ancho: 10 },
        { titulo: "Descripción", ancho: 26 },
        ...FILTROS.flatMap((f) =>
          Array.from({ length: MARCAS }, (_, i) => ({ titulo: `${f.titulo} ${i + 1}`, ancho: 22 }))
        ),
        { titulo: "Observaciones", ancho: 40 },
      ],
      filas: lista.map((t) => {
        const r = repuestoDe(t);
        return [
          t.cc,
          t.descripcion || "",
          ...FILTROS.flatMap((f) =>
            Array.from({ length: MARCAS }, (_, i) => {
              const a = (r[f.campo] || [])[i];
              return a ? textoAlternativa(a) : "";
            })
          ),
          r.observaciones || "",
        ];
      }),
      hoja: "Filtros",
      archivo: `repuestos_tractores_${new Date().toISOString().slice(0, 10)}.xlsx`,
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
      {/* Barra de Cabecera Institucional */}
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
              backgroundColor: "#0e7490",
              color: "#fff",
              fontSize: "1.15rem",
              boxShadow: "0 2px 8px rgba(14, 116, 144, 0.35)",
            }}
          >
            <i className="bi bi-box-seam"></i>
          </div>
          <span className="text-white fs-6 fw-semibold">Tractores — Repuestos</span>
        </div>

        <div className="d-flex align-items-center gap-2">
          <button
            onClick={() => navigate(-1)}
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
        </div>
      </div>

      <Container
        fluid
        className="px-3 py-2 d-flex flex-column flex-grow-1"
        style={{ maxWidth: "1080px", width: "100%", margin: "0 auto", overflow: "hidden" }}
      >
        {/* Encabezado, filtros y tabla van del mismo ancho: el del Container. */}
        <div className="d-flex align-items-center gap-2 mb-2 flex-wrap">
          <span className="fw-bold" style={{ color: "#1b4332", fontSize: "1.05rem" }}>
            Filtros
          </span>
          <Button
            size="sm"
            onClick={exportarExcel}
            disabled={lista.length === 0}
            className="rounded-3 px-3 d-flex align-items-center gap-2 ms-auto"
            style={{ backgroundColor: "#15803d", borderColor: "#15803d", fontSize: "0.78rem", height: "30px", fontWeight: 600 }}
            title="Exportar a Excel"
          >
            <i className="bi bi-file-earmark-excel-fill"></i>
            <span>Excel</span>
          </Button>
        </div>

        {/* Filtros */}
        <Card className="mb-3 p-2 shadow-sm border-0 rounded-3 flex-shrink-0">
          <div className="d-flex align-items-end justify-content-center gap-2 flex-wrap">
            <FiltroTexto
              etiqueta="Buscar"
              ancho="240px"
              valor={buscar}
              onChange={setBuscar}
              placeholder="CC, descripción, marca, código…"
            />
          </div>
        </Card>

        {/* Tabla */}
        <div
          className="shadow-sm rounded-3 bg-white"
          style={{
            flex: "1 1 auto",
            minHeight: 0,
            maxWidth: "100%",
            overflowY: "auto",
            overflowX: "auto",
            border: "1px solid #cbd5e1",
          }}
        >
          <Table className="mb-0 tabla-informe" style={{ width: "100%", minWidth: "860px" }}>
            <thead style={{ position: "sticky", top: 0, zIndex: 10, backgroundColor: "#1b4332", color: "#fff" }}>
              <tr>
                <th style={thCentro}>#</th>
                <th style={thCentro}>CC</th>
                <th style={thCentro}>Descripción</th>
                {FILTROS.map((f) => (
                  <th key={f.campo} style={{ ...thCentro, minWidth: "160px" }}>
                    {f.titulo}
                    <div style={{ fontSize: "0.6rem", fontWeight: 400, opacity: 0.75 }}>
                      Marca · código
                    </div>
                  </th>
                ))}
                <th style={{ ...thCentro, minWidth: "150px" }}>Observaciones</th>
                <th style={thCentro}></th>
              </tr>
            </thead>
            <tbody>
              {lista.length === 0 ? (
                <tr>
                  <td colSpan={COLUMNAS} className="text-center text-muted py-4" style={td}>
                    {cargando
                      ? "Cargando…"
                      : hayFiltros
                        ? "Ninguna unidad coincide con los filtros"
                        : "No hay tractores cargados"}
                  </td>
                </tr>
              ) : (
                lista.map((t, idx) => {
                  const r = repuestoDe(t);
                  return (
                    <tr key={t._id}>
                      <td style={{ ...tdCentro, color: "#94a3b8" }}>{idx + 1}</td>
                      <td style={{ ...tdCentro, fontWeight: 700 }}>{t.cc}</td>
                      <td style={td}>{t.descripcion || <Raya />}</td>
                      {FILTROS.map((f) => (
                        <td key={f.campo} style={td}>
                          <CeldaFiltro lista={r[f.campo]} />
                        </td>
                      ))}
                      <td style={{ ...td, whiteSpace: "pre-wrap" }}>{r.observaciones || <Raya />}</td>
                      <td style={tdCentro}>
                        <div className="d-flex justify-content-center">
                          <BotonAccion
                            icono="bi-pencil"
                            titulo={sinEditar ? "Sin permiso para editar" : "Completar filtros"}
                            variante="primary"
                            onClick={() => abrir(t)}
                            deshabilitado={sinEditar}
                          />
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

      {/* Modal: los filtros de una unidad, con sus 3 marcas posibles */}
      <Modal show={Boolean(editando)} onHide={cerrar} centered size="lg" contentClassName="border-0 shadow-lg rounded-4">
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
          <Modal.Title className="fs-6 fw-bold d-flex align-items-center gap-2 text-white">
            <i className="bi bi-box-seam" style={{ color: "#67e8f9" }}></i>
            <span>
              Filtros — CC {editando?.cc}
              {editando?.descripcion ? ` (${editando.descripcion})` : ""}
            </span>
          </Modal.Title>
        </Modal.Header>
        <Form onSubmit={guardar}>
          <Modal.Body className="p-4">
            <Row className="g-3">
              {FILTROS.map((f) => (
                <Col md={4} key={f.campo}>
                  <div className="fw-bold mb-2" style={{ color: "#1b4332", fontSize: "0.86rem" }}>
                    {f.titulo}
                  </div>
                  {(form[f.campo] || []).map((a, i) => (
                    <div key={i} className="d-flex align-items-center gap-1 mb-2">
                      <span className="text-muted flex-shrink-0" style={{ fontSize: "0.72rem", width: "12px" }}>
                        {i + 1}
                      </span>
                      <Form.Control
                        className="rounded-3"
                        style={campo}
                        placeholder="Marca"
                        value={a.marca}
                        onChange={(e) => setCasilla(f.campo, i, "marca", e.target.value)}
                        list="marcas-filtros"
                        autoComplete="off"
                        maxLength={40}
                      />
                      <Form.Control
                        className="rounded-3"
                        style={campo}
                        placeholder="Código"
                        value={a.codigo}
                        onChange={(e) => setCasilla(f.campo, i, "codigo", e.target.value)}
                        maxLength={40}
                      />
                    </div>
                  ))}
                </Col>
              ))}
            </Row>
            <Form.Label className="fw-semibold text-dark small mb-1 mt-2">Observaciones</Form.Label>
            <Form.Control
              as="textarea"
              rows={2}
              className="rounded-3"
              style={campo}
              value={form.observaciones || ""}
              onChange={(e) => setForm((f) => ({ ...f, observaciones: e.target.value }))}
              maxLength={500}
            />
            <datalist id="marcas-filtros">
              {marcas.map((m) => (
                <option key={m} value={m} />
              ))}
            </datalist>
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
              <span>{guardando ? "Guardando…" : "Guardar"}</span>
            </Button>
          </Modal.Footer>
        </Form>
      </Modal>
    </div>
  );
}
