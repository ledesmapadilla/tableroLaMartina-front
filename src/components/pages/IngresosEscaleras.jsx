import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import Swal from "sweetalert2";
import { Container, Table, Button, Form, Modal, Row, Col, Card } from "react-bootstrap";
import { api } from "../../services/api";
import { exportarPlanilla } from "../../helpers/excel";
import { usePermisos } from "../../context/permisos";
import { cosechaDeParam } from "../../utils/cosechas";
import { compararCC } from "../../utils/ordenCC";
import { useSupervisores, opcionesSupervisor } from "../../utils/supervisores";
import NavbarSanPablo from "../shared/NavbarSanPablo";
import { campo, th as thBase, td, tdCentro } from "../compras/formato";
import { Raya, BotonAccion } from "../compras/estilos";

// El slate de Mantenimiento, como las demás tablas de San Pablo.
const COLOR = "#1e293b";
const COLOR_SUAVE = "#f1f5f9";
const AZUL = "#1d4ed8";
const ROJO = "#dc2626";
const VERDE = "#15803d";
const NARANJA = "#c2410c";
const GRIS_CLARO = "#a0aec0";
const TEXTO = "#1e293b";
const th = { ...thBase, backgroundColor: COLOR };
const thCentro = { ...th, textAlign: "center" };
const COLUMNAS = 9;

// El equipo del padrón de CC que se ofrece en el retiro.
const EQUIPO_CARRO = "Carro porta escaleras";

// Hoy como "AAAA-MM-DD" en la hora local: es lo que usa el <input type="date">.
const hoy = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

// La fecha es un día sin hora y viaja como 00:00 UTC.
const aInput = (iso) => (iso ? String(iso).slice(0, 10) : "");
const fechaCorta = (iso) => {
  const [a, m, d] = aInput(iso).split("-");
  return a ? `${d}/${m}/${a}` : "";
};

const numeroOVacio = (v) => (v === null || v === undefined ? "" : v);
const suma = (lista, campoNum) => lista.reduce((s, i) => s + (i[campoNum] || 0), 0);

// Qué modal corresponde a una fila.
const modoDe = (i) => (i.baja ? "baja" : i.retiro ? "retiro" : i.nuevas ? "nuevas" : "carro");
// Los movimientos que sacan escaleras del taller.
const sale = (i) => i.retiro || i.baja;

/**
 * Escaleras de Reparaciones San Pablo, dentro de una cosecha.
 *
 * Tiene tres clases de filas:
 *  - Las que entran con un carro porta escaleras: se crean solas con el
 *    ingreso del carro (lo hace el back). El carro, la fecha, quién y la
 *    cantidad se cambian allá; acá se cargan sanas, rotas, reparadas y
 *    observaciones.
 *  - Las nuevas, hechas en el taller ("Nuevas escaleras").
 *  - Los retiros ("Retiro de escaleras"): fecha, supervisor, el carro que se
 *    las lleva y cuántas.
 *  - Las bajas ("Baja de escaleras"): fecha, cuántas, motivo, quién las
 *    desecha y a quién se avisó.
 * El back no deja retirar ni dar de baja más de las que quedan.
 */
export default function IngresosEscaleras({ icono }) {
  // La cosecha viene de la dirección (RutaCosecha ya la validó).
  const cosecha = cosechaDeParam(useParams().cosecha);
  const { puede } = usePermisos();
  const sinEditar = !puede("sanpablo.ingresos", "editar");
  const supervisores = useSupervisores();

  const [ingresos, setIngresos] = useState([]);
  const [carros, setCarros] = useState([]);
  const [cargando, setCargando] = useState(true);
  // El modal abierto: "nuevas", "carro" o "retiro"; la fila que se edita (null
  // en un alta) y su formulario.
  const [modo, setModo] = useState(null);
  const [editando, setEditando] = useState(null);
  const [form, setForm] = useState(null);
  const [verHistorial, setVerHistorial] = useState(false);
  const [anterior, setAnterior] = useState([]);
  const cosechaAnterior = cosecha - 1;

  useEffect(() => {
    if (!verHistorial) return;
    api
      .get(`/ingresos-sanpablo?cosecha=${cosechaAnterior}&tipo=escaleras`)
      .then((data) => setAnterior(Array.isArray(data) ? data : []))
      .catch(() => setAnterior([]));
  }, [verHistorial, cosechaAnterior]);

  const cargar = () =>
    api
      .get(`/ingresos-sanpablo?cosecha=${cosecha}&tipo=escaleras`)
      .then((data) => setIngresos(Array.isArray(data) ? data : []))
      .catch(() => setIngresos([]))
      .finally(() => setCargando(false));

  useEffect(() => {
    cargar();
    api
      .get("/centros-costo")
      .then((data) =>
        setCarros(
          (Array.isArray(data) ? data : [])
            .filter((c) => (c.equipo || "").trim() === EQUIPO_CARRO)
            .sort((a, b) => compararCC(a.cc, b.cc))
        )
      )
      .catch(() => setCarros([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cosecha]);

  const abrirNuevas = () => {
    setModo("nuevas");
    setEditando(null);
    setForm({ fechaIngreso: hoy(), cantidadEscaleras: "", ingresadoPor: "", observaciones: "" });
  };

  const abrirRetiro = () => {
    setModo("retiro");
    setEditando(null);
    setForm({ fechaIngreso: hoy(), ingresadoPor: "", cc: "", cantidadEscaleras: "", observaciones: "" });
  };

  const abrirBaja = () => {
    setModo("baja");
    setEditando(null);
    setForm({ fechaIngreso: hoy(), cantidadEscaleras: "", motivo: "", ingresadoPor: "", avisadoA: "" });
  };

  const abrirEditar = (i) => {
    const m = modoDe(i);
    setModo(m);
    setEditando(i);
    if (m === "baja") {
      setForm({
        fechaIngreso: aInput(i.fechaIngreso),
        cantidadEscaleras: numeroOVacio(i.cantidadEscaleras),
        motivo: i.motivo || "",
        ingresadoPor: i.ingresadoPor || "",
        avisadoA: i.avisadoA || "",
      });
      return;
    }
    if (m === "carro") {
      setForm({
        escalerasSanas: numeroOVacio(i.escalerasSanas),
        escalerasRotas: numeroOVacio(i.escalerasRotas),
        escalerasReparadas: numeroOVacio(i.escalerasReparadas),
        observaciones: i.observaciones || "",
      });
      return;
    }
    setForm({
      fechaIngreso: aInput(i.fechaIngreso),
      cantidadEscaleras: numeroOVacio(i.cantidadEscaleras),
      ingresadoPor: i.ingresadoPor || "",
      observaciones: i.observaciones || "",
      ...(m === "retiro" ? { cc: i.cc?._id || "" } : {}),
    });
  };

  const cerrar = () => {
    setModo(null);
    setEditando(null);
    setForm(null);
  };

  const guardar = async (e) => {
    e.preventDefault();
    const eraEdicion = Boolean(editando);
    try {
      if (eraEdicion) await api.put(`/ingresos-sanpablo/${editando._id}`, form);
      else
        await api.post("/ingresos-sanpablo", {
          ...form,
          tipo: "escaleras",
          cosecha,
          ...(modo === "retiro" ? { retiro: true } : {}),
          ...(modo === "baja" ? { baja: true } : {}),
        });
      const titulo = eraEdicion
        ? "Escaleras actualizadas"
        : modo === "retiro"
          ? "Retiro registrado"
          : modo === "baja"
            ? "Baja registrada"
            : "Escaleras nuevas registradas";
      cerrar();
      cargar();
      Swal.fire({ icon: "success", title: titulo, timer: 1400, showConfirmButton: false });
    } catch (err) {
      Swal.fire({ icon: "error", title: "No se pudo guardar", text: err.message });
    }
  };

  const eliminar = async (i) => {
    const { isConfirmed } = await Swal.fire({
      title: i.baja ? "¿Borrar la baja?" : i.retiro ? "¿Borrar el retiro?" : "¿Borrar las escaleras nuevas?",
      text: `${i.cantidadEscaleras ?? 0} escaleras del ${fechaCorta(i.fechaIngreso)}`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Sí, borrar",
      cancelButtonText: "Cancelar",
      confirmButtonColor: ROJO,
      cancelButtonColor: "#64748b",
    });
    if (!isConfirmed) return;
    try {
      await api.delete(`/ingresos-sanpablo/${i._id}`);
      cargar();
      Swal.fire({
        icon: "success",
        title: i.baja ? "Baja borrada" : i.retiro ? "Retiro borrado" : "Escaleras borradas",
        timer: 1200,
        showConfirmButton: false,
      });
    } catch (err) {
      Swal.fire({ icon: "error", title: "No se pudo borrar", text: err.message });
    }
  };

  // Totales, arriba de la tabla.
  const deCarros = ingresos.filter((i) => !i.nuevas && !sale(i));
  const nuevas = ingresos.filter((i) => i.nuevas);
  const retiros = ingresos.filter((i) => i.retiro);
  const entraron = suma(deCarros, "cantidadEscaleras") + suma(nuevas, "cantidadEscaleras");
  const retiradas = suma(retiros, "cantidadEscaleras");
  const bajas = suma(
    ingresos.filter((i) => i.baja),
    "cantidadEscaleras"
  );
  const enTaller = entraron - retiradas - bajas;
  const rotas = suma(deCarros, "escalerasRotas");
  const reparadas = suma(deCarros, "escalerasReparadas");
  const totales = [
    ["Entraron", entraron, COLOR],
    ["Nuevas", suma(nuevas, "cantidadEscaleras"), VERDE],
    ["Retiradas", retiradas, NARANJA],
    ["Bajas", bajas, ROJO],
    ["En taller", enTaller, COLOR],
    ["Sanas", suma(deCarros, "escalerasSanas"), AZUL],
    ["Rotas", rotas, ROJO],
    ["Reparadas", reparadas, VERDE],
    ["Rotas sin reparar", rotas - reparadas, ROJO],
  ];

  // Historial: los totales de la cosecha y, por supervisor, lo que retiró la
  // cosecha anterior y lo que ingresó y retiró esta.
  const historial = (() => {
    // Por supervisor: lo que retiró la cosecha anterior y lo que ingresó y
    // retiró esta.
    const porNombre = new Map();
    const sumar = (i, campoSuma) => {
      const nombre = (i.ingresadoPor || "").trim() || "Sin supervisor";
      const fila = porNombre.get(nombre.toLowerCase()) || {
        nombre,
        retiradasAnterior: 0,
        ingresadas: 0,
        retiradas: 0,
      };
      fila[campoSuma] += i.cantidadEscaleras || 0;
      porNombre.set(nombre.toLowerCase(), fila);
    };
    for (const i of anterior) if (i.retiro) sumar(i, "retiradasAnterior");
    // Solo lo de los supervisores: ni las bajas ni las escaleras nuevas (esas las
    // carga quien las construye).
    for (const i of ingresos) if (!i.baja && !i.nuevas) sumar(i, i.retiro ? "retiradas" : "ingresadas");
    const porSupervisor = [...porNombre.values()].sort((a, b) =>
      a.nombre.localeCompare(b.nombre, "es", { sensitivity: "base" })
    );
    const retiradasAnterior = anterior.filter((i) => i.retiro).reduce((t, i) => t + (i.cantidadEscaleras || 0), 0);
    const total = (campoSuma) => porSupervisor.reduce((t, f) => t + f[campoSuma], 0);
    return { porSupervisor, retiradasAnterior, ingresadas: total("ingresadas"), retiradas: total("retiradas") };
  })();

  // En un retiro: los carros que todavía no se llevaron escaleras en la cosecha
  // (el del retiro que se edita sigue estando).
  const carrosLibres = carros.filter(
    (c) => !ingresos.some((i) => i.retiro && i.cc?._id === c._id && i._id !== editando?._id)
  );

  // En el modal de un carro: las que falta clasificar como sanas o rotas.
  const esCarro = modo === "carro" && Boolean(form);
  const sinClasificar = esCarro
    ? (editando.cantidadEscaleras || 0) - (Number(form.escalerasSanas) || 0) - (Number(form.escalerasRotas) || 0)
    : 0;
  const reparadasDeMas = esCarro && (Number(form.escalerasReparadas) || 0) > (Number(form.escalerasRotas) || 0);
  const hayError = esCarro && (sinClasificar < 0 || reparadasDeMas);

  const campoNumero = (campoNum, rotulo, color) => (
    <Col xs={4} key={campoNum}>
      <Form.Label className="fw-semibold small mb-1 text-nowrap" style={{ color }}>
        {rotulo}
      </Form.Label>
      <Form.Control
        type="number"
        min={0}
        step={1}
        className="rounded-3"
        style={campo}
        value={form[campoNum]}
        onChange={(e) => setForm({ ...form, [campoNum]: e.target.value })}
        placeholder="0"
      />
    </Col>
  );

  const campoFecha = (
    <Col xs={6}>
      <Form.Label className="fw-semibold text-dark small mb-1">
        Fecha <span className="text-danger">*</span>
      </Form.Label>
      <Form.Control
        type="date"
        className="rounded-3"
        style={campo}
        value={form?.fechaIngreso || ""}
        onChange={(e) => setForm({ ...form, fechaIngreso: e.target.value })}
        required
      />
    </Col>
  );

  const campoCantidad = (
    <Col xs={6}>
      <Form.Label className="fw-semibold text-dark small mb-1">
        Cantidad <span className="text-danger">*</span>
      </Form.Label>
      <Form.Control
        type="number"
        min={1}
        step={1}
        className="rounded-3"
        style={campo}
        value={form?.cantidadEscaleras ?? ""}
        onChange={(e) => setForm({ ...form, cantidadEscaleras: e.target.value })}
        placeholder="0"
        required
      />
    </Col>
  );

  const campoObservaciones = (placeholder) => (
    <Col xs={12}>
      <Form.Label className="fw-semibold text-dark small mb-1">Observaciones</Form.Label>
      <Form.Control
        as="textarea"
        rows={2}
        className="rounded-3"
        style={campo}
        value={form?.observaciones || ""}
        onChange={(e) => setForm({ ...form, observaciones: e.target.value })}
        placeholder={placeholder}
      />
    </Col>
  );

  // La planilla sigue la tabla: mismas columnas y mismo orden.
  const exportarExcel = () =>
    exportarPlanilla({
      titulo: `Reparaciones San Pablo — Escaleras — Cosecha ${cosecha}`,
      columnas: [
        { titulo: "Fecha", ancho: 12 },
        { titulo: "Quién", ancho: 24 },
        { titulo: "Carro porta escaleras", ancho: 26 },
        { titulo: "Cant.", ancho: 10 },
        { titulo: "Cant. sanas", ancho: 12 },
        { titulo: "Cant. rotas", ancho: 12 },
        { titulo: "Reparadas", ancho: 12 },
        { titulo: "Observaciones", ancho: 44 },
      ],
      filas: ingresos.map((i) => {
        const m = modoDe(i);
        const carro = [i.cc?.cc, i.cc?.descripcion].filter(Boolean).join(" · ");
        const numero = (v) => (v == null ? "" : v);
        return [
          fechaCorta(i.fechaIngreso),
          i.ingresadoPor || "",
          m === "nuevas" ? "Nuevas" : m === "baja" ? "Baja" : m === "retiro" ? `Retiro · ${carro}` : carro,
          i.cantidadEscaleras == null ? "" : sale(i) ? -i.cantidadEscaleras : i.cantidadEscaleras,
          m === "carro" ? numero(i.escalerasSanas) : "",
          m === "carro" ? numero(i.escalerasRotas) : "",
          m === "carro" ? numero(i.escalerasReparadas) : "",
          m === "baja"
            ? [i.motivo, i.avisadoA && `Avisado a ${i.avisadoA}`].filter(Boolean).join(" · ")
            : i.observaciones || "",
        ];
      }),
      hoja: "Escaleras",
      archivo: `sanpablo_escaleras_${cosecha}_${new Date().toISOString().slice(0, 10)}.xlsx`,
    });

  const tituloModal =
    modo === "baja"
      ? editando
        ? "Editar baja de escaleras"
        : "Baja de escaleras"
      : modo === "retiro"
      ? editando
        ? "Editar retiro de escaleras"
        : "Retiro de escaleras"
      : modo === "nuevas"
        ? editando
          ? "Editar escaleras nuevas"
          : "Nuevas escaleras"
        : `Escaleras del carro ${editando?.cc?.cc || ""}`;

  const botonEncabezado = (texto, iconoBoton, onClick, color) => (
    <Button
      size="sm"
      onClick={onClick}
      disabled={sinEditar}
      title={sinEditar ? "Sin permiso para editar" : undefined}
      className="rounded-3 px-3 d-flex align-items-center gap-2"
      style={{ backgroundColor: color, borderColor: color, fontSize: "0.78rem", height: "30px", fontWeight: 600 }}
    >
      <i className={`bi ${iconoBoton}`}></i>
      <span>{texto}</span>
    </Button>
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
      <NavbarSanPablo
        titulo={`Cosecha ${cosecha} · Escaleras`}
        icono={icono}
        volverA={`/reparaciones/sanpablo/${cosecha}`}
      />

      <Container
        fluid
        className="px-3 py-3 d-flex flex-column flex-grow-1"
        style={{ maxWidth: "1060px", width: "100%", margin: "0 auto", overflow: "hidden" }}
      >
        <div className="d-flex align-items-center gap-2 mb-3 flex-wrap">
          <span className="fw-bold" style={{ color: COLOR, fontSize: "1.05rem" }}>
            Movimientos
          </span>
          <span className="text-muted" style={{ fontSize: "0.76rem" }}>
            <i className="bi bi-info-circle me-1"></i>
            Las de los carros entran solas con cada ingreso de Carros porta escaleras
          </span>
          <div className="d-flex align-items-center gap-2 ms-auto">
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
              variant="outline-secondary"
              onClick={() => setVerHistorial(true)}
              className="rounded-3 px-3 d-flex align-items-center gap-2"
              style={{ fontSize: "0.78rem", height: "30px", fontWeight: 600 }}
            >
              <i className="bi bi-clock-history"></i>
              <span>Historial</span>
            </Button>
            {botonEncabezado("Baja de escaleras", "bi-trash3", abrirBaja, ROJO)}
            {botonEncabezado("Retiro de escaleras", "bi-box-arrow-right", abrirRetiro, NARANJA)}
            {botonEncabezado("Nuevas escaleras", "bi-plus-lg", abrirNuevas, COLOR)}
          </div>
        </div>

        {/* Totales, fuera de la tabla. */}
        <Card className="mb-3 px-3 py-2 shadow-sm border-0 rounded-3 flex-shrink-0">
          <div className="d-flex justify-content-around align-items-center flex-wrap gap-3">
            {totales.map(([rotulo, valor, color]) => (
              <div key={rotulo} className="d-flex flex-column align-items-center lh-sm">
                <span className="fw-bold" style={{ fontSize: "1.3rem", color }}>
                  {cargando ? "—" : valor}
                </span>
                <span className="text-muted" style={{ fontSize: "0.7rem" }}>
                  {rotulo}
                </span>
              </div>
            ))}
          </div>
        </Card>

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
          <Table className="mb-0 tabla-informe" style={{ width: "100%", minWidth: "860px" }}>
            <thead style={{ position: "sticky", top: 0, zIndex: 10 }}>
              <tr>
                <th style={thCentro}>Fecha</th>
                <th style={th}>Quién</th>
                <th style={thCentro}>Carro porta escaleras</th>
                <th style={thCentro}>Cant.</th>
                <th style={thCentro}>Cant. sanas</th>
                <th style={thCentro}>Cant. rotas</th>
                <th style={thCentro}>Reparadas</th>
                <th style={th}>Observaciones</th>
                <th style={thCentro}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {ingresos.length === 0 ? (
                <tr>
                  <td colSpan={COLUMNAS} className="text-center text-muted py-4" style={td}>
                    {cargando ? "Cargando…" : "No hay movimientos de escaleras todavía"}
                  </td>
                </tr>
              ) : (
                ingresos.map((i) => {
                  const m = modoDe(i);
                  return (
                    <tr key={i._id}>
                      <td style={{ ...tdCentro, whiteSpace: "nowrap" }}>{fechaCorta(i.fechaIngreso) || <Raya />}</td>
                      <td style={td}>{i.ingresadoPor || <Raya />}</td>
                      <td style={{ ...tdCentro, fontWeight: 700, whiteSpace: "nowrap" }}>
                        {m === "nuevas" && (
                          <span
                            className="px-2 rounded-pill"
                            style={{ backgroundColor: "#dcfce7", color: VERDE, fontSize: "0.66rem" }}
                          >
                            Nuevas
                          </span>
                        )}
                        {m === "retiro" && (
                          <span
                            className="px-2 me-1 rounded-pill"
                            style={{ backgroundColor: "#ffedd5", color: NARANJA, fontSize: "0.66rem" }}
                          >
                            Retiro
                          </span>
                        )}
                        {m === "baja" && (
                          <span
                            className="px-2 rounded-pill"
                            style={{ backgroundColor: "#fee2e2", color: ROJO, fontSize: "0.66rem" }}
                          >
                            Baja
                          </span>
                        )}
                        {(m === "carro" || m === "retiro") && (
                          <>
                            {i.cc?.cc || <Raya />}
                            {i.cc?.descripcion && (
                              <span className="text-muted fw-normal" style={{ fontSize: "0.66rem" }}>
                                {" "}
                                · {i.cc.descripcion}
                              </span>
                            )}
                          </>
                        )}
                      </td>
                      <td
                        style={{
                          ...tdCentro,
                          fontWeight: 700,
                          color: m === "baja" ? ROJO : m === "retiro" ? NARANJA : undefined,
                        }}
                      >
                        {i.cantidadEscaleras == null ? <Raya /> : sale(i) ? `−${i.cantidadEscaleras}` : i.cantidadEscaleras}
                      </td>
                      {m === "carro" ? (
                        <>
                          <td style={{ ...tdCentro, color: AZUL }}>{i.escalerasSanas ?? <Raya />}</td>
                          <td style={{ ...tdCentro, color: ROJO }}>{i.escalerasRotas ?? <Raya />}</td>
                          <td style={{ ...tdCentro, color: VERDE }}>{i.escalerasReparadas ?? <Raya />}</td>
                        </>
                      ) : (
                        <>
                          <td style={tdCentro}><Raya /></td>
                          <td style={tdCentro}><Raya /></td>
                          <td style={tdCentro}><Raya /></td>
                        </>
                      )}
                      {/* En una baja: el motivo y a quién se avisó. */}
                      <td style={td}>
                        {m === "baja" ? (
                          <>
                            {i.motivo}
                            {i.avisadoA && (
                              <span className="text-muted" style={{ fontSize: "0.66rem" }}>
                                {" "}
                                · Avisado a {i.avisadoA}
                              </span>
                            )}
                          </>
                        ) : (
                          i.observaciones || <Raya />
                        )}
                      </td>
                      <td style={tdCentro}>
                        <div className="d-flex justify-content-center align-items-center" style={{ gap: "6px" }}>
                          <BotonAccion
                            icono="bi-pencil"
                            titulo={
                              sinEditar
                                ? "Sin permiso para editar"
                                : m === "carro"
                                  ? "Cargar sanas, rotas y reparadas"
                                  : "Editar"
                            }
                            variante="primary"
                            onClick={() => abrirEditar(i)}
                            deshabilitado={sinEditar}
                          />
                          {/* Las de un carro se borran borrando el ingreso del carro. */}
                          {m !== "carro" && (
                            <BotonAccion
                              icono="bi-trash"
                              titulo={sinEditar ? "Sin permiso para editar" : "Borrar"}
                              variante="danger"
                              onClick={() => eliminar(i)}
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
            backgroundColor: modo === "baja" ? ROJO : modo === "retiro" ? NARANJA : COLOR,
            color: "#fff",
            borderTopLeftRadius: "1rem",
            borderTopRightRadius: "1rem",
            borderBottom: "1px solid rgba(255,255,255,0.1)",
          }}
        >
          <Modal.Title className="fs-6 fw-normal d-flex align-items-center gap-2 text-white">
            <i
              className={`bi ${modo === "baja" ? "bi-trash3" : modo === "retiro" ? "bi-box-arrow-right" : "bi-bar-chart-steps"}`}
            ></i>
            <span>{tituloModal}</span>
          </Modal.Title>
        </Modal.Header>
        {form && (
          <Form onSubmit={guardar}>
            <Modal.Body className="p-4">
              {modo === "nuevas" && (
                <Row className="g-3 form-ingresos">
                  {campoFecha}
                  {campoCantidad}
                  <Col xs={12}>
                    <Form.Label className="fw-semibold text-dark small mb-1">
                      Quién las construye <span className="text-danger">*</span>
                    </Form.Label>
                    <Form.Control
                      className="rounded-3"
                      style={campo}
                      value={form.ingresadoPor}
                      onChange={(e) => setForm({ ...form, ingresadoPor: e.target.value })}
                      placeholder="Nombre de quien las construye"
                      maxLength={80}
                      required
                    />
                  </Col>
                  {campoObservaciones("Medida, material…")}
                </Row>
              )}

              {modo === "retiro" && (
                <Row className="g-3 form-ingresos">
                  {campoFecha}
                  {campoCantidad}
                  <Col xs={12}>
                    <Form.Label className="fw-semibold text-dark small mb-1">
                      Supervisor <span className="text-danger">*</span>
                    </Form.Label>
                    <Form.Select
                      className="rounded-3"
                      style={{ ...campo, color: form.ingresadoPor ? TEXTO : GRIS_CLARO }}
                      value={form.ingresadoPor}
                      onChange={(e) => setForm({ ...form, ingresadoPor: e.target.value })}
                      required
                    >
                      <option value="">Elegir supervisor…</option>
                      {opcionesSupervisor(supervisores, form.ingresadoPor).map((s) => (
                        <option key={s} value={s} style={{ color: TEXTO }}>
                          {s}
                        </option>
                      ))}
                    </Form.Select>
                  </Col>
                  <Col xs={12}>
                    <Form.Label className="fw-semibold text-dark small mb-1">
                      Carro porta escaleras <span className="text-danger">*</span>
                    </Form.Label>
                    <Form.Select
                      className="rounded-3"
                      style={{ ...campo, color: form.cc ? TEXTO : GRIS_CLARO }}
                      value={form.cc}
                      onChange={(e) => setForm({ ...form, cc: e.target.value })}
                      required
                    >
                      <option value="">Elegir carro…</option>
                      {carrosLibres.map((c) => (
                        <option key={c._id} value={c._id} style={{ color: TEXTO }}>
                          {c.cc}
                          {c.descripcion ? ` · ${c.descripcion}` : ""}
                        </option>
                      ))}
                    </Form.Select>
                    {carrosLibres.length === 0 && (
                      <div className="text-muted mt-1" style={{ fontSize: "0.72rem" }}>
                        {carros.length === 0
                          ? `No hay CC con equipo ${EQUIPO_CARRO} en Centros de costo.`
                          : `Todos los carros ya tienen un retiro en la cosecha ${cosecha}.`}
                      </div>
                    )}
                  </Col>
                  {campoObservaciones("Para dónde van…")}
                </Row>
              )}

              {modo === "baja" && (
                <Row className="g-3 form-ingresos">
                  {campoFecha}
                  {campoCantidad}
                  <Col xs={12}>
                    <Form.Label className="fw-semibold text-dark small mb-1">
                      Motivo <span className="text-danger">*</span>
                    </Form.Label>
                    <Form.Control
                      as="textarea"
                      rows={2}
                      className="rounded-3"
                      style={campo}
                      value={form.motivo}
                      onChange={(e) => setForm({ ...form, motivo: e.target.value })}
                      placeholder="Por qué se desechan…"
                      required
                    />
                  </Col>
                  <Col xs={12}>
                    <Form.Label className="fw-semibold text-dark small mb-1">
                      Quién las desecha <span className="text-danger">*</span>
                    </Form.Label>
                    <Form.Control
                      className="rounded-3"
                      style={campo}
                      value={form.ingresadoPor}
                      onChange={(e) => setForm({ ...form, ingresadoPor: e.target.value })}
                      placeholder="Nombre"
                      maxLength={80}
                      required
                    />
                  </Col>
                  <Col xs={12}>
                    <Form.Label className="fw-semibold text-dark small mb-1">
                      A quién se avisa <span className="text-danger">*</span>
                    </Form.Label>
                    <Form.Control
                      className="rounded-3"
                      style={campo}
                      value={form.avisadoA}
                      onChange={(e) => setForm({ ...form, avisadoA: e.target.value })}
                      placeholder="Nombre"
                      maxLength={80}
                      required
                    />
                  </Col>
                </Row>
              )}

              {modo === "carro" && (
                <>
                  {/* Lo que viene del ingreso del carro, solo para ver. */}
                  <div
                    className="mb-3 px-3 py-2 rounded-3"
                    style={{ backgroundColor: COLOR_SUAVE, fontSize: "0.8rem", color: "#475569" }}
                  >
                    <i className="bi bi-lock-fill me-1"></i>
                    Entraron el {fechaCorta(editando.fechaIngreso)}
                    {editando.ingresadoPor ? ` con ${editando.ingresadoPor}` : ""}:{" "}
                    <strong>{editando.cantidadEscaleras ?? 0} escaleras</strong>. Eso se cambia en Carros porta
                    escaleras.
                  </div>

                  <Row className="g-3 form-ingresos">
                    {campoNumero("escalerasSanas", "Cant. sanas", AZUL)}
                    {campoNumero("escalerasRotas", "Cant. rotas", ROJO)}
                    {campoNumero("escalerasReparadas", "Reparadas", VERDE)}
                    <Col xs={12}>
                      <div
                        style={{ fontSize: "0.74rem", color: hayError ? ROJO : "#64748b" }}
                        className={hayError ? "fw-semibold" : ""}
                      >
                        {sinClasificar < 0
                          ? `Sanas y rotas suman más que las ${editando.cantidadEscaleras ?? 0} que trajo el carro`
                          : reparadasDeMas
                            ? "Las reparadas no pueden ser más que las rotas"
                            : `Sin clasificar: ${sinClasificar} · Rotas sin reparar: ${
                                (Number(form.escalerasRotas) || 0) - (Number(form.escalerasReparadas) || 0)
                              }`}
                      </div>
                    </Col>
                    {campoObservaciones("Qué tienen las rotas…")}
                  </Row>
                </>
              )}
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
                disabled={hayError}
                className="rounded-3 px-3 py-1 shadow-sm d-flex align-items-center gap-1"
                style={{ backgroundColor: VERDE, borderColor: VERDE, fontSize: "0.84rem", fontWeight: 600 }}
              >
                <i className="bi bi-check-lg"></i>
                <span>Guardar</span>
              </Button>
            </Modal.Footer>
          </Form>
        )}
      </Modal>

      {/* Historial de movimientos, con totales y el detalle por supervisor. */}
      <Modal
        show={verHistorial}
        onHide={() => setVerHistorial(false)}
        centered
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
            <i className="bi bi-clock-history"></i>
            <span>Historial de escaleras · Cosecha {cosecha}</span>
          </Modal.Title>
        </Modal.Header>
        <Modal.Body className="p-3">
          {/* Por supervisor */}
          <div className="fw-semibold mb-1" style={{ color: COLOR, fontSize: "0.82rem" }}>
            Por supervisor
          </div>
          <div className="rounded-3 bg-white" style={{ border: "1px solid #cbd5e1", overflowX: "auto" }}>
            <Table className="mb-0 tabla-informe" style={{ width: "100%" }}>
              <thead>
                <tr>
                  <th style={th}>Supervisor</th>
                  <th style={thCentro}>Retiradas {cosechaAnterior}</th>
                  <th style={thCentro}>Ingresadas {cosecha}</th>
                  <th style={thCentro}>Retiradas {cosecha}</th>
                </tr>
              </thead>
              <tbody>
                {historial.porSupervisor.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="text-center text-muted py-3" style={td}>
                      No hay movimientos todavía
                    </td>
                  </tr>
                ) : (
                  historial.porSupervisor.map((f) => (
                    <tr key={f.nombre}>
                      <td style={td}>{f.nombre}</td>
                      <td style={{ ...tdCentro, color: "#64748b" }}>{f.retiradasAnterior || <Raya />}</td>
                      <td style={{ ...tdCentro, color: COLOR }}>{f.ingresadas || <Raya />}</td>
                      <td style={{ ...tdCentro, color: NARANJA }}>{f.retiradas || <Raya />}</td>
                    </tr>
                  ))
                )}
                {historial.porSupervisor.length > 0 && (
                  <tr className="fila-total">
                    <td style={{ ...td, fontWeight: 700, color: COLOR }}>TOTAL</td>
                    <td style={{ ...tdCentro, fontWeight: 700 }}>{historial.retiradasAnterior}</td>
                    <td style={{ ...tdCentro, fontWeight: 700 }}>{historial.ingresadas}</td>
                    <td style={{ ...tdCentro, fontWeight: 700 }}>{historial.retiradas}</td>
                  </tr>
                )}
              </tbody>
            </Table>
          </div>
        </Modal.Body>
      </Modal>
    </div>
  );
}
