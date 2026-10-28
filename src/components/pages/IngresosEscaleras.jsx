import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import Swal from "sweetalert2";
import { Container, Table, Button, Form, Modal, Row, Col, Card } from "react-bootstrap";
import { api } from "../../services/api";
import { exportarPlanilla } from "../../helpers/excel";
import { usePermisos } from "../../context/permisos";
import { cosechaDeParam } from "../../utils/cosechas";
import { compararCC } from "../../utils/ordenCC";
import { useSupervisores, opcionesSupervisor } from "../../utils/supervisores";
import NavbarSanPablo from "../shared/NavbarSanPablo";
import { CeldaFrente, SelectFrente, ModalAltaFrente } from "../shared/FrenteSanPablo";
import HistorialCarros from "../shared/HistorialCarros";
import ControlAnioPasado from "../shared/ControlAnioPasado";
import { textoFrente } from "../../utils/frentes";
import { campo, th as thBase, td, tdCentro } from "../compras/formato";
import { Raya, BotonAccion } from "../compras/estilos";

// El slate de Mantenimiento, como las demás tablas de San Pablo.
const COLOR = "#1e293b";
const COLOR_SUAVE = "#f1f5f9";
const AZUL = "#1d4ed8";
const ROJO = "#dc2626";
const VERDE = "#15803d";
const NARANJA = "#c2410c";
// El control con el año pasado: un color que no usa ninguna acción.
const TURQUESA = "#0f766e";
const GRIS_CLARO = "#a0aec0";
const TEXTO = "#1e293b";
const th = { ...thBase, backgroundColor: COLOR };
const thCentro = { ...th, textAlign: "center" };
// Las columnas de cada solapa: los egresos no llevan sanas, rotas ni
// reparadas.
const COLUMNAS = { ingresos: 11, egresos: 8 };

// Los encargados del ingreso y el retiro (08/10/2026), obligatorio en los dos.
// El back controla la misma lista.
const ENCARGADOS = ["Germán Diaz", "Luis Paredes", "Daniel Perea", "Carlos Chumiento", "Nicolás Galvan"];
// La zona de cada uno, como referencia debajo de la tabla.
const ZONA_ENCARGADO = {
  "Germán Diaz": "Citrusvil Sur",
  "Luis Paredes": "Citrusvil Norte",
  "Daniel Perea": "Citromax Sur",
  "Carlos Chumiento": "Citromax Norte",
  "Nicolás Galvan": "Early Crop",
};

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

// En el ingreso, el carro "S/N": vienen sin carro (06/10/2026). Se guarda
// como cc null.
const SIN_NUMERO = "sn";

const numeroOVacio = (v) => (v === null || v === undefined ? "" : v);
const suma = (lista, campoNum) => lista.reduce((s, i) => s + (i[campoNum] || 0), 0);

// Qué modal corresponde a una fila.
const modoDe = (i) =>
  i.estadoInicial ? "estadoInicial" : i.reparacion ? "reparacion" : i.baja ? "baja" : i.retiro ? "retiro" : i.nuevas ? "nuevas" : i.sinCarro ? "sinCarro" : "carro";
// Los movimientos que sacan escaleras del taller.
const sale = (i) => i.retiro || i.baja;
// Qué historial abre cada total al tocarlo (28/10/2026).
const HISTORIAL_DE_TOTAL = { Reparadas: "reparadas", Retiradas: "retiradas", "Dadas de baja": "bajas" };

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
 *  - Las reparaciones (25/10/2026): no mueven escaleras, suman a las
 *    reparadas y se restan de las rotas. Desde el 28/10/2026 se cargan
 *    tocando el total de Rotas (fecha, cantidad, quién repara y
 *    observaciones), y tocando el de Reparadas se ve su historial. La de los
 *    carros va en su página (botón "Reparación carros", ReparacionCarros).
 *  - El estado inicial (botón "Rotas", 27/10/2026): fecha, cuántas había
 *    rotas y observaciones. Es una reparación más (suma a las rotas), uno
 *    solo por cosecha.
 * El back no deja retirar ni dar de baja más de las que quedan.
 */
export default function IngresosEscaleras({ icono }) {
  // La cosecha viene de la dirección (RutaCosecha ya la validó).
  const cosecha = cosechaDeParam(useParams().cosecha);
  const navigate = useNavigate();
  const { puede } = usePermisos();
  const sinEditar = !puede("sanpablo.ingresos", "editar");
  const supervisores = useSupervisores();

  const [ingresos, setIngresos] = useState([]);
  // Las reparaciones vienen con los movimientos pero van aparte: no entran ni
  // salen escaleras.
  const [reparaciones, setReparaciones] = useState([]);
  const [carros, setCarros] = useState([]);
  // Los frentes se dan de alta acá.
  const [frentes, setFrentes] = useState([]);
  const [altaFrente, setAltaFrente] = useState(false);
  const [cargando, setCargando] = useState(true);
  // El modal abierto: "nuevas", "carro" o "retiro"; la fila que se edita (null
  // en un alta) y su formulario.
  const [modo, setModo] = useState(null);
  const [editando, setEditando] = useState(null);
  const [form, setForm] = useState(null);
  // Ingresos (nuevas, ingresos y lo de los carros) y egresos (retiros y
  // bajas) van en solapas separadas (06/10/2026); las reparaciones, en la
  // tercera (25/10/2026).
  const [solapa, setSolapa] = useState("ingresos");
  const [anterior, setAnterior] = useState([]);
  // El historial de los carros porta escaleras (06/10/2026): sale de estos
  // mismos movimientos.
  const [verHistorialCarros, setVerHistorialCarros] = useState(false);
  // El control con el año pasado (08/10/2026): por carro, lo que salió en la
  // cosecha anterior contra lo que ingresó en esta.
  const [verControl, setVerControl] = useState(false);
  // El historial que se abre tocando un total (28/10/2026): "reparadas",
  // "retiradas", "bajas" o null.
  const [historial, setHistorial] = useState(null);
  const cosechaAnterior = cosecha - 1;

  useEffect(() => {
    if (!verControl) return;
    api
      .get(`/ingresos-sanpablo?cosecha=${cosechaAnterior}&tipo=escaleras`)
      .then((data) => setAnterior(Array.isArray(data) ? data.filter((i) => !i.reparacion) : []))
      .catch(() => setAnterior([]));
  }, [verControl, cosechaAnterior]);

  const cargarFrentes = () =>
    api
      .get("/ingresos-sanpablo/frentes")
      .then((data) => setFrentes(Array.isArray(data) ? data : []))
      .catch(() => setFrentes([]));

  const cargar = () =>
    api
      .get(`/ingresos-sanpablo?cosecha=${cosecha}&tipo=escaleras`)
      .then((data) => {
        const filas = Array.isArray(data) ? data : [];
        setIngresos(filas.filter((i) => !i.reparacion));
        setReparaciones(filas.filter((i) => i.reparacion));
      })
      .catch(() => {
        setIngresos([]);
        setReparaciones([]);
      })
      .finally(() => setCargando(false));

  useEffect(() => {
    cargar();
    cargarFrentes();
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

  const abrirSinCarro = () => {
    setModo("sinCarro");
    setEditando(null);
    setForm({
      fechaIngreso: hoy(),
      cantidadEscaleras: "",
      ingresadoPor: "",
      frente: "",
      encargado: "",
      cc: "",
      observaciones: "",
    });
  };

  const abrirRetiro = () => {
    setModo("retiro");
    setEditando(null);
    setForm({
      fechaIngreso: hoy(),
      ingresadoPor: "",
      cc: "",
      frente: "",
      encargado: "",
      cantidadEscaleras: "",
      observaciones: "",
    });
  };

  const abrirBaja = () => {
    setModo("baja");
    setEditando(null);
    setForm({ fechaIngreso: hoy(), cantidadEscaleras: "", motivo: "", ingresadoPor: "", avisadoA: "" });
  };

  // Escaleras reparadas (28/10/2026): se abre tocando el total de rotas.
  // Restan de las rotas.
  const abrirReparacion = () => {
    setModo("reparacion");
    setEditando(null);
    setForm({ fechaIngreso: hoy(), escalerasReparadas: "", reparadoPor: "", observaciones: "" });
  };

  // Uno solo por cosecha: si ya está, el botón lo abre para editar.
  const abrirEstadoInicial = () => {
    const existente = reparaciones.find((i) => i.estadoInicial);
    if (existente) return abrirEditar(existente);
    setModo("estadoInicial");
    setEditando(null);
    setForm({ fechaIngreso: hoy(), escalerasRotas: "", observaciones: "" });
  };

  const abrirEditar = (i) => {
    const m = modoDe(i);
    setModo(m);
    setEditando(i);
    if (m === "estadoInicial") {
      setForm({
        fechaIngreso: aInput(i.fechaIngreso),
        escalerasRotas: numeroOVacio(i.escalerasRotas),
        observaciones: i.observaciones || "",
      });
      return;
    }
    if (m === "reparacion") {
      setForm({
        fechaIngreso: aInput(i.fechaIngreso),
        escalerasReparadas: numeroOVacio(i.escalerasReparadas),
        reparadoPor: i.reparadoPor || "",
        observaciones: i.observaciones || "",
      });
      return;
    }
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
      ...(m === "sinCarro"
        ? {
            cc: i.cc?._id || SIN_NUMERO,
            escalerasSanas: numeroOVacio(i.escalerasSanas),
            escalerasRotas: numeroOVacio(i.escalerasRotas),
            escalerasReparadas: numeroOVacio(i.escalerasReparadas),
          }
        : {}),
      ...(m === "retiro" || m === "sinCarro" ? { frente: i.frente?._id || "", encargado: i.encargado || "" } : {}),
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
    // "S/N" es un ingreso sin carro.
    const datos = form.cc === SIN_NUMERO ? { ...form, cc: null } : form;
    try {
      if (eraEdicion) await api.put(`/ingresos-sanpablo/${editando._id}`, datos);
      else
        await api.post("/ingresos-sanpablo", {
          ...datos,
          tipo: "escaleras",
          cosecha,
          ...(modo === "retiro" ? { retiro: true } : {}),
          ...(modo === "baja" ? { baja: true } : {}),
          ...(modo === "sinCarro" ? { sinCarro: true } : {}),
          ...(modo === "estadoInicial" ? { estadoInicial: true } : {}),
          ...(modo === "reparacion" ? { reparacion: true } : {}),
        });
      const titulo = eraEdicion
        ? modo === "estadoInicial"
          ? "Rotas actualizadas"
          : modo === "reparacion"
            ? "Reparación actualizada"
            : "Escaleras actualizadas"
        : modo === "estadoInicial"
          ? "Rotas registradas"
          : modo === "reparacion"
          ? "Reparadas registradas"
          : modo === "retiro"
          ? "Retiro registrado"
          : modo === "baja"
            ? "Baja registrada"
            : modo === "sinCarro"
              ? "Ingreso registrado"
              : "Escaleras nuevas registradas";
      // Las rotas y las reparadas van en los totales: la solapa no cambia.
      if (!eraEdicion && modo !== "estadoInicial" && modo !== "reparacion") setSolapa(modo === "retiro" || modo === "baja" ? "egresos" : "ingresos");
      cerrar();
      cargar();
      Swal.fire({ icon: "success", title: titulo, timer: 1500, showConfirmButton: false, width: "300px" });
    } catch (err) {
      Swal.fire({ icon: "error", title: "No se pudo guardar", text: err.message, width: "300px" });
    }
  };

  const eliminar = async (i) => {
    const { isConfirmed } = await Swal.fire({
      title: i.reparacion
        ? "¿Borrar la reparación?"
        : i.baja
        ? "¿Borrar la baja?"
        : i.retiro
          ? "¿Borrar el retiro?"
          : i.sinCarro
            ? "¿Borrar el ingreso?"
            : "¿Borrar las escaleras nuevas?",
      text: i.reparacion
        ? `${i.escalerasReparadas ?? 0} reparadas del ${fechaCorta(i.fechaIngreso)}`
        : `${i.cantidadEscaleras ?? 0} escaleras del ${fechaCorta(i.fechaIngreso)}`,
      icon: "warning",
      width: "320px",
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
        title: i.reparacion ? "Reparación borrada" : i.baja ? "Baja borrada" : i.retiro ? "Retiro borrado" : i.sinCarro ? "Ingreso borrado" : "Escaleras borradas",
        timer: 1500,
        showConfirmButton: false,
        width: "300px",
      });
    } catch (err) {
      Swal.fire({ icon: "error", title: "No se pudo borrar", text: err.message, width: "300px" });
    }
  };

  // Por número de CC del carro (08/10/2026); los que no tienen carro (nuevas,
  // bajas, S/N) al final. El sort es estable: a igual CC queda el orden por fecha.
  const porCC = (lista) =>
    [...lista].sort((a, b) => {
      if (!a.cc?.cc || !b.cc?.cc) return (a.cc?.cc ? 0 : 1) - (b.cc?.cc ? 0 : 1);
      return compararCC(a.cc.cc, b.cc.cc);
    });

  // Los movimientos de la solapa abierta.
  const movimientosSolapa = porCC(
    ingresos.filter((i) => (solapa === "egresos" ? sale(i) : !sale(i)))
  );

  // Totales, arriba de la tabla. Sanas, rotas y reparadas se cargan en los
  // ingresos (y en lo que dejó la página vieja de los carros); rotas y
  // reparadas, también en las reparaciones.
  const deCarros = ingresos.filter((i) => !i.nuevas && !i.sinCarro && !sale(i));
  const clasificadas = ingresos.filter((i) => !i.nuevas && !sale(i));
  const nuevas = ingresos.filter((i) => i.nuevas);
  const sinCarro = ingresos.filter((i) => i.sinCarro);
  const retiros = ingresos.filter((i) => i.retiro);
  const entraron =
    suma(deCarros, "cantidadEscaleras") + suma(nuevas, "cantidadEscaleras") + suma(sinCarro, "cantidadEscaleras");
  const retiradas = suma(retiros, "cantidadEscaleras");
  const bajas = suma(
    ingresos.filter((i) => i.baja),
    "cantidadEscaleras"
  );
  const enTaller = entraron - retiradas - bajas;
  // Las rotas del estado inicial entran acá: es una reparación más.
  const rotas = suma(clasificadas, "escalerasRotas") + suma(reparaciones, "escalerasRotas");
  const reparadas = suma(clasificadas, "escalerasReparadas") + suma(reparaciones, "escalerasReparadas");
  const total = suma(sinCarro, "cantidadEscaleras") + suma(nuevas, "cantidadEscaleras");
  const totales = [
    ["Ingresos", suma(sinCarro, "cantidadEscaleras"), AZUL],
    ["Nuevas", suma(nuevas, "cantidadEscaleras"), VERDE],
    ["Total", total, COLOR],
    ["Retiradas", retiradas, NARANJA],
    ["Dadas de baja", bajas, ROJO],
    ["En taller", enTaller, COLOR],
    // Las sanas (27/10/2026): el total menos las rotas, más las reparadas.
    ["Sanas", total - rotas + reparadas, AZUL],
    // Las reparadas se descuentan de las rotas (27/10/2026): son las que
    // siguen rotas.
    ["Rotas", rotas - reparadas, ROJO],
    ["Reparadas", reparadas, VERDE],
  ];

  // Los historiales de los totales, de la más nueva a la más vieja: las
  // reparaciones (sin la fila de Rotas), los retiros y las bajas.
  const masNuevaPrimero = (lista) =>
    [...lista].sort(
      (a, b) =>
        aInput(b.fechaIngreso).localeCompare(aInput(a.fechaIngreso)) ||
        String(b.createdAt || "").localeCompare(String(a.createdAt || ""))
    );
  const historialReparadas = masNuevaPrimero(reparaciones.filter((i) => !i.estadoInicial));
  const carroDe = (i) => (
    <>
      {i.cc?.cc || <Raya />}
      {i.cc?.descripcion && (
        <span className="text-muted fw-normal" style={{ fontSize: "0.66rem" }}>
          {" "}
          · {i.cc.descripcion}
        </span>
      )}
    </>
  );
  const HISTORIALES = {
    reparadas: {
      titulo: "Escaleras reparadas",
      color: VERDE,
      filas: historialReparadas,
      campoCant: "escalerasReparadas",
      vacio: "Todavía no hay escaleras reparadas",
      columnas: [
        ["Quién repara", (i) => i.reparadoPor || <Raya />],
        ["Observaciones", (i) => i.observaciones || <Raya />],
      ],
    },
    retiradas: {
      titulo: "Escaleras retiradas",
      color: NARANJA,
      filas: masNuevaPrimero(ingresos.filter((i) => i.retiro)),
      campoCant: "cantidadEscaleras",
      vacio: "Todavía no hay retiros",
      columnas: [
        ["Frente", (i) => <CeldaFrente frente={i.frente} />],
        ["Encargado", (i) => i.encargado || <Raya />],
        ["Quién retira", (i) => i.ingresadoPor || <Raya />],
        ["Carro", carroDe],
        ["Observaciones", (i) => i.observaciones || <Raya />],
      ],
    },
    bajas: {
      titulo: "Escaleras dadas de baja",
      color: ROJO,
      filas: masNuevaPrimero(ingresos.filter((i) => i.baja)),
      campoCant: "cantidadEscaleras",
      vacio: "Todavía no hay bajas",
      columnas: [
        ["Motivo", (i) => i.motivo || <Raya />],
        ["Quién las desecha", (i) => i.ingresadoPor || <Raya />],
        ["Avisado a", (i) => i.avisadoA || <Raya />],
      ],
    },
  };
  const verHistorial = historial && HISTORIALES[historial];

  // En un retiro: los carros que todavía no se llevaron escaleras en la cosecha
  // (el del retiro que se edita sigue estando).
  const carrosLibres = carros.filter(
    (c) => !ingresos.some((i) => i.retiro && i.cc?._id === c._id && i._id !== editando?._id)
  );

  // En un ingreso: los carros que todavía no entraron en la cosecha (el del
  // ingreso que se edita sigue estando). Un carro entra una sola vez.
  const carrosSinEntrar = carros.filter(
    (c) => !ingresos.some((i) => !i.nuevas && !sale(i) && i.cc?._id === c._id && i._id !== editando?._id)
  );

  // En el modal de un carro de la página vieja: las que falta clasificar como
  // sanas o rotas. El ingreso ya no las pregunta (27/10/2026).
  const esCarro = modo === "carro" && Boolean(form);
  const cantidadQueEntro = editando?.cantidadEscaleras || 0;
  const sinClasificar = esCarro
    ? cantidadQueEntro - (Number(form.escalerasSanas) || 0) - (Number(form.escalerasRotas) || 0)
    : 0;
  const reparadasDeMas = esCarro && (Number(form.escalerasReparadas) || 0) > (Number(form.escalerasRotas) || 0);
  // En el estado inicial (27/10/2026) y en las reparadas: en la cosecha no
  // puede haber más reparadas que rotas. Cuenta todo menos la fila que se
  // edita.
  const cuentaRotas = (modo === "estadoInicial" || modo === "reparacion") && Boolean(form);
  const otras = [...clasificadas, ...reparaciones].filter((i) => i._id !== editando?._id);
  const rotasCosecha = suma(otras, "escalerasRotas") + (cuentaRotas ? Number(form.escalerasRotas) || 0 : 0);
  const reparadasCosecha =
    suma(otras, "escalerasReparadas") + (cuentaRotas ? Number(form.escalerasReparadas) || 0 : 0);
  const masReparadasQueRotas = cuentaRotas && reparadasCosecha > rotasCosecha;
  // Las que quedan hoy sin reparar, sin contar la fila que se carga: es el
  // tope de una reparación (28/10/2026).
  const pendientes = suma(otras, "escalerasRotas") - suma(otras, "escalerasReparadas");
  const cantReparada = cuentaRotas ? Number(form.escalerasReparadas) || 0 : 0;
  const hayError = (esCarro && (sinClasificar < 0 || reparadasDeMas)) || masReparadasQueRotas;
  // El aviso abajo de los campos.
  const avisoRotas = cuentaRotas && (
    <Col xs={12}>
      <div
        style={{ fontSize: "0.74rem", color: masReparadasQueRotas ? ROJO : "#64748b" }}
        className={masReparadasQueRotas ? "fw-semibold" : ""}
      >
        {modo === "reparacion"
          ? masReparadasQueRotas
            ? `Quedan ${Math.max(pendientes, 0)} rotas sin reparar: no se pueden reparar ${cantReparada}`
            : `Quedan ${pendientes} rotas sin reparar${cantReparada ? `; después de esta, ${pendientes - cantReparada}` : ""}`
          : masReparadasQueRotas
            ? `Las reparadas (${reparadasCosecha}) no pueden ser más que las rotas (${rotasCosecha})`
            : `Rotas sin reparar: ${rotasCosecha - reparadasCosecha}`}
      </div>
    </Col>
  );

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

  // Sanas, rotas y reparadas, con lo que falta clasificar abajo.
  const camposClasificacion = esCarro && (
    <>
      {campoNumero("escalerasSanas", "Cant. sanas", AZUL)}
      {campoNumero("escalerasRotas", "Cant. rotas", ROJO)}
      {campoNumero("escalerasReparadas", "Reparadas", VERDE)}
      <Col xs={12}>
        <div
          style={{ fontSize: "0.74rem", color: hayError ? ROJO : "#64748b" }}
          className={hayError ? "fw-semibold" : ""}
        >
          {sinClasificar < 0
            ? `Sanas y rotas suman más que las ${cantidadQueEntro} que entraron`
            : reparadasDeMas
              ? "Las reparadas no pueden ser más que las rotas"
              : `Sin clasificar: ${sinClasificar} · Rotas sin reparar: ${
                  (Number(form.escalerasRotas) || 0) - (Number(form.escalerasReparadas) || 0)
                }`}
        </div>
      </Col>
    </>
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

  const campoObservaciones = (placeholder, filas = 2) => (
    <Col xs={12}>
      <Form.Label className="fw-semibold text-dark small mb-1">Observaciones</Form.Label>
      <Form.Control
        as="textarea"
        rows={filas}
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
        { titulo: "Frente", ancho: 22 },
        { titulo: "Encargado", ancho: 20 },
        { titulo: "Ingresa/Retira", ancho: 24 },
        { titulo: "Carro porta escaleras", ancho: 26 },
        { titulo: "Cant.", ancho: 10 },
        { titulo: "Cant. sanas", ancho: 12 },
        { titulo: "Cant. rotas", ancho: 12 },
        { titulo: "Reparadas", ancho: 12 },
        { titulo: "Observaciones", ancho: 44 },
      ],
      filas: porCC(ingresos).map((i) => {
        const m = modoDe(i);
        const carro = [i.cc?.cc, i.cc?.descripcion].filter(Boolean).join(" · ");
        const numero = (v) => (v == null ? "" : v);
        return [
          fechaCorta(i.fechaIngreso),
          textoFrente(i.frente),
          i.encargado || "",
          i.ingresadoPor || "",
          m === "nuevas"
            ? "Nuevas"
            : m === "sinCarro"
              ? carro || "S/N"
              : m === "baja"
                ? "Baja"
                : m === "retiro"
                  ? `Retiro · ${carro}`
                  : carro,
          i.cantidadEscaleras == null ? "" : sale(i) ? -i.cantidadEscaleras : i.cantidadEscaleras,
          m === "carro" || m === "sinCarro" ? numero(i.escalerasSanas) : "",
          m === "carro" || m === "sinCarro" ? numero(i.escalerasRotas) : "",
          m === "carro" || m === "sinCarro" ? numero(i.escalerasReparadas) : "",
          m === "baja"
            ? [i.motivo, i.avisadoA && `Avisado a ${i.avisadoA}`].filter(Boolean).join(" · ")
            : i.observaciones || "",
        ];
      }),
      hoja: "Escaleras",
      archivo: `sanpablo_escaleras_${cosecha}_${new Date().toISOString().slice(0, 10)}.xlsx`,
    });

  const tituloModal =
    modo === "estadoInicial"
      ? editando
        ? "Editar rotas"
        : "Rotas"
      : modo === "reparacion"
      ? editando
        ? "Editar escaleras reparadas"
        : "Escaleras reparadas"
      : modo === "baja"
      ? editando
        ? "Editar baja de escaleras"
        : "Baja de escaleras"
      : modo === "retiro"
      ? editando
        ? "Editar retiro de escaleras"
        : "Retiro de escaleras"
      : modo === "sinCarro"
      ? editando
        ? "Editar ingreso de escaleras"
        : "Ingreso de escaleras"
      : modo === "nuevas"
        ? editando
          ? "Editar escaleras nuevas"
          : "Nuevas escaleras"
        : `Escaleras del carro ${editando?.cc?.cc || ""}`;

  // Los botones del encabezado son nueve (08/10/2026): letra chica, el texto en
  // un renglón y, si no entran, bajan enteros a otra fila.
  const claseBoton = "rounded-3 px-2 d-flex align-items-center gap-1 text-nowrap flex-shrink-0";
  const estiloBoton = { fontSize: "0.66rem", height: "25px", fontWeight: 600 };

  const botonEncabezado = (texto, iconoBoton, onClick, color) => (
    <Button
      size="sm"
      onClick={onClick}
      disabled={sinEditar}
      title={sinEditar ? "Sin permiso para editar" : undefined}
      className={claseBoton}
      style={{ ...estiloBoton, backgroundColor: color, borderColor: color }}
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
        titulo="Carros porta escaleras / Escaleras"
        sinSeccion
        cosecha={cosecha}
        icono={icono}
        // Se entra desde Carros › Carros porta escaleras (28/10/2026).
        volverA={`/reparaciones/sanpablo/${cosecha}/carros`}
      />

      <Container
        fluid
        className="px-3 py-3 d-flex flex-column flex-grow-1"
        style={{ maxWidth: "1160px", width: "100%", margin: "0 auto", overflow: "hidden" }}
      >
        <div className="d-flex align-items-center gap-2 mb-3 flex-wrap">
          <span className="fw-bold" style={{ color: COLOR, fontSize: "1.05rem" }}>
            Movimientos
          </span>
          <div className="d-flex align-items-center gap-3 ms-auto flex-wrap justify-content-end">
            <Button
              size="sm"
              variant="outline-secondary"
              onClick={() => setAltaFrente(true)}
              disabled={sinEditar}
              title={sinEditar ? "Sin permiso para editar" : "Dar de alta un frente"}
              className={claseBoton}
              style={estiloBoton}
            >
              <i className="bi bi-geo-alt"></i>
              <span>Alta de frente</span>
            </Button>
            <Button
              size="sm"
              variant="outline-secondary"
              onClick={() => setVerHistorialCarros(true)}
              className={claseBoton}
              style={estiloBoton}
            >
              <i className="bi bi-clock-history"></i>
              <span>Historial carros</span>
            </Button>
            {botonEncabezado("Rotas", "bi-flag", abrirEstadoInicial, COLOR)}
            {/* La reparación de los carros va en su página (28/10/2026); la de
                las escaleras, tocando las rotas en los totales. */}
            <Button
              size="sm"
              onClick={() => navigate(`/reparaciones/sanpablo/${cosecha}/escaleras/reparacion`)}
              className={claseBoton}
              style={{ ...estiloBoton, backgroundColor: VERDE, borderColor: VERDE }}
            >
              <i className="bi bi-tools"></i>
              <span>Reparación carros</span>
            </Button>
            {botonEncabezado("Baja de escaleras", "bi-trash3", abrirBaja, ROJO)}
            {botonEncabezado("Retiro de escaleras", "bi-box-arrow-right", abrirRetiro, NARANJA)}
            {botonEncabezado("Ingreso", "bi-box-arrow-in-down", abrirSinCarro, AZUL)}
            {botonEncabezado("Nuevas escaleras", "bi-plus-lg", abrirNuevas, COLOR)}
            <Button
              size="sm"
              onClick={exportarExcel}
              disabled={ingresos.length === 0}
              className={claseBoton}
              style={{ ...estiloBoton, backgroundColor: "#15803d", borderColor: "#15803d" }}
              title="Exportar a Excel"
            >
              <i className="bi bi-file-earmark-excel-fill"></i>
              <span>Excel</span>
            </Button>
          </div>
        </div>

        {/* Totales, fuera de la tabla. */}
        <Card
          className="mb-3 px-3 py-2 shadow-sm rounded-3 flex-shrink-0"
          style={{ border: "1px solid #000" }}
        >
          <div className="d-flex justify-content-around align-items-center flex-wrap gap-3">
            {totales.map(([rotulo, valor, color]) =>
              rotulo === "En taller" ? (
                // Lo que hay hoy en el taller es el número que más se mira: va
                // en un recuadro oscuro y más grande.
                <div
                  key={rotulo}
                  className="d-flex flex-column align-items-center lh-sm px-3 py-1 rounded-3 shadow-sm"
                  style={{ backgroundColor: COLOR, color: "#fff" }}
                >
                  <span className="fw-bold" style={{ fontSize: "1.75rem" }}>
                    {cargando ? "—" : valor}
                  </span>
                  <span className="fw-semibold" style={{ fontSize: "0.74rem", color: "rgba(255,255,255,0.8)" }}>
                    {rotulo}
                  </span>
                </div>
              ) : (
              <div key={rotulo} className="d-flex flex-column align-items-center lh-sm">
                {/* Rotas abre la carga de reparadas; Reparadas, Retiradas y
                    Dadas de baja, su historial (28/10/2026). */}
                {rotulo === "Rotas" || HISTORIAL_DE_TOTAL[rotulo] ? (
                  <button
                    type="button"
                    onClick={rotulo === "Rotas" ? abrirReparacion : () => setHistorial(HISTORIAL_DE_TOTAL[rotulo])}
                    disabled={rotulo === "Rotas" && sinEditar}
                    className="btn btn-link p-0 fw-bold"
                    style={{ fontSize: "1.3rem", color, lineHeight: 1.2, textDecoration: "underline" }}
                    title={
                      rotulo === "Rotas"
                        ? sinEditar
                          ? "Sin permiso para editar"
                          : "Cargar escaleras reparadas"
                        : `Ver el historial de las ${rotulo.toLowerCase()}`
                    }
                  >
                    {cargando ? "—" : valor}
                  </button>
                ) : (
                <span className="fw-bold" style={{ fontSize: "1.3rem", color }}>
                  {cargando ? "—" : valor}
                </span>
                )}
                <span className="text-muted" style={{ fontSize: "0.7rem" }}>
                  {rotulo}
                </span>
              </div>
              )
            )}
          </div>
        </Card>

        {/* Las solapas, pegadas arriba de la tabla, y al centro el control
            con el año pasado. */}
        <div
          className="d-flex align-items-end gap-1 flex-shrink-0"
          style={{ marginBottom: "-1px", position: "relative" }}
        >
          {[
            ["ingresos", "Ingresos", "bi-box-arrow-in-down", ingresos.filter((i) => !sale(i)).length],
            ["egresos", "Egresos", "bi-box-arrow-right", ingresos.filter(sale).length],
          ].map(([clave, rotulo, iconoSolapa, cantidad]) => {
            const activa = solapa === clave;
            return (
              <button
                key={clave}
                type="button"
                onClick={() => setSolapa(clave)}
                className="d-flex align-items-center gap-2 px-3 py-1 fw-semibold"
                style={{
                  fontSize: "0.8rem",
                  border: "1px solid #cbd5e1",
                  borderBottom: activa ? `1px solid ${COLOR}` : "1px solid #cbd5e1",
                  borderTopLeftRadius: "0.5rem",
                  borderTopRightRadius: "0.5rem",
                  backgroundColor: activa ? COLOR : "#fff",
                  color: activa ? "#fff" : "#475569",
                  cursor: "pointer",
                }}
              >
                <i className={`bi ${iconoSolapa}`}></i>
                <span>{rotulo}</span>
                <span
                  className="px-2 rounded-pill"
                  style={{
                    fontSize: "0.68rem",
                    backgroundColor: activa ? "rgba(255,255,255,0.2)" : COLOR_SUAVE,
                    color: activa ? "#fff" : COLOR,
                  }}
                >
                  {cargando ? "—" : cantidad}
                </span>
              </button>
            );
          })}
          <Button
            size="sm"
            onClick={() => setVerControl(true)}
            className={`${claseBoton} mb-1`}
            style={{
              ...estiloBoton,
              backgroundColor: TURQUESA,
              borderColor: TURQUESA,
              position: "absolute",
              left: "50%",
              bottom: 0,
              transform: "translateX(-50%)",
            }}
            title={`Lo que salió en la cosecha ${cosechaAnterior} contra lo que ingresó en esta`}
          >
            <i className="bi bi-arrow-left-right"></i>
            <span>Control con año pasado</span>
          </Button>
        </div>

        <div
          className="shadow-sm bg-white"
          style={{
            flex: "0 1 auto",
            minHeight: 0,
            maxWidth: "100%",
            overflowY: "auto",
            overflowX: "hidden",
            border: "1px solid #cbd5e1",
            borderRadius: "0 0.5rem 0.5rem 0.5rem",
          }}
        >
          <Table className="mb-0 tabla-informe" style={{ width: "100%" }}>
            <thead style={{ position: "sticky", top: 0, zIndex: 10 }}>
              <tr>
                <th style={thCentro}>Fecha</th>
                <th style={th}>Frente</th>
                <th style={th}>Encargado</th>
                <th style={th}>{solapa === "ingresos" ? "Quién ingresa" : "Quién retira / desecha"}</th>
                <th style={thCentro}>Carro porta escaleras</th>
                <th style={thCentro}>Cant.</th>
                {solapa === "ingresos" && (
                  <>
                    <th style={thCentro}>Cant. sanas</th>
                    <th style={thCentro}>Cant. rotas</th>
                    <th style={thCentro}>Reparadas</th>
                  </>
                )}
                <th style={th}>{solapa === "ingresos" ? "Observaciones" : "Observaciones / motivo"}</th>
                <th style={thCentro}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {movimientosSolapa.length === 0 ? (
                <tr>
                  <td colSpan={COLUMNAS[solapa]} className="text-center text-muted py-4" style={td}>
                    {cargando
                      ? "Cargando…"
                      : solapa === "ingresos"
                        ? "No hay ingresos de escaleras todavía"
                        : "No hay retiros ni bajas todavía"}
                  </td>
                </tr>
              ) : (
                movimientosSolapa.map((i) => {
                  const m = modoDe(i);
                  return (
                    <tr key={i._id}>
                      <td style={{ ...tdCentro, whiteSpace: "nowrap" }}>{fechaCorta(i.fechaIngreso) || <Raya />}</td>
                      {/* Las de un carro traen el frente de su carro. */}
                      <td style={td}>
                        <CeldaFrente frente={i.frente} />
                      </td>
                      <td style={td}>{i.encargado || <Raya />}</td>
                      <td style={td}>{i.ingresadoPor || <Raya />}</td>
                      <td style={{ ...tdCentro, fontWeight: 700 }}>
                        {m === "nuevas" && (
                          <span
                            className="px-2 rounded-pill"
                            style={{ backgroundColor: "#dcfce7", color: VERDE, fontSize: "0.66rem" }}
                          >
                            Nuevas
                          </span>
                        )}
                        {m === "sinCarro" && !i.cc && "S/N"}
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
                        {(m === "carro" || m === "retiro" || (m === "sinCarro" && i.cc)) && (
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
                      {solapa === "ingresos" &&
                        (m === "carro" || m === "sinCarro" ? (
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
                        ))}
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

        {/* Referencia: la zona de cada encargado. */}
        <div
          className="d-flex flex-wrap justify-content-center align-items-center gap-2 mt-2 flex-shrink-0"
          style={{ fontSize: "0.72rem" }}
        >
          <span className="fw-semibold text-muted">Encargados:</span>
          {ENCARGADOS.map((e) => (
            <span
              key={e}
              className="px-2 py-1 rounded-pill"
              style={{ backgroundColor: COLOR_SUAVE, border: "1px solid #cbd5e1", color: TEXTO }}
            >
              <span className="fw-semibold">{e}</span>
              <span className="text-muted"> · {ZONA_ENCARGADO[e]}</span>
            </span>
          ))}
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
            backgroundColor:
              modo === "estadoInicial"
                ? COLOR
                : modo === "reparacion"
                ? VERDE
                : modo === "baja"
                  ? ROJO
                  : modo === "retiro"
                    ? NARANJA
                    : modo === "sinCarro"
                      ? AZUL
                      : COLOR,
            color: "#fff",
            borderTopLeftRadius: "1rem",
            borderTopRightRadius: "1rem",
            borderBottom: "1px solid rgba(255,255,255,0.1)",
          }}
        >
          <Modal.Title className="fs-6 fw-normal d-flex align-items-center gap-2 text-white">
            <i
              className={`bi ${
                modo === "estadoInicial"
                  ? "bi-flag"
                  : modo === "reparacion"
                  ? "bi-tools"
                  : modo === "baja"
                  ? "bi-trash3"
                  : modo === "retiro"
                    ? "bi-box-arrow-right"
                    : modo === "sinCarro"
                      ? "bi-box-arrow-in-down"
                      : "bi-bar-chart-steps"
              }`}
            ></i>
            <span>{tituloModal}</span>
          </Modal.Title>
        </Modal.Header>
        {form && (
          <Form onSubmit={guardar}>
            <Modal.Body className={modo === "sinCarro" ? "px-4 py-3" : "p-4"}>
              {modo === "estadoInicial" && (
                <Row className="g-3 form-ingresos">
                  {campoFecha}
                  <Col xs={6}>
                    <Form.Label className="fw-semibold small mb-1" style={{ color: ROJO }}>
                      Escaleras rotas <span className="text-danger">*</span>
                    </Form.Label>
                    <Form.Control
                      type="number"
                      min={0}
                      step={1}
                      className="rounded-3"
                      style={campo}
                      value={form.escalerasRotas}
                      onChange={(e) => setForm({ ...form, escalerasRotas: e.target.value })}
                      placeholder="0"
                      required
                    />
                  </Col>
                  {avisoRotas}
                  {campoObservaciones("Cómo estaban las escaleras al empezar…")}
                </Row>
              )}

              {modo === "reparacion" && (
                <Row className="g-3 form-ingresos">
                  {campoFecha}
                  <Col xs={6}>
                    <Form.Label className="fw-semibold small mb-1" style={{ color: VERDE }}>
                      Cantidad <span className="text-danger">*</span>
                    </Form.Label>
                    <Form.Control
                      type="number"
                      min={1}
                      max={Math.max(pendientes, 1)}
                      step={1}
                      className="rounded-3"
                      style={campo}
                      value={form.escalerasReparadas}
                      onChange={(e) => setForm({ ...form, escalerasReparadas: e.target.value })}
                      placeholder="0"
                      required
                    />
                  </Col>
                  <Col xs={12}>
                    <Form.Label className="fw-semibold text-dark small mb-1">Quién repara</Form.Label>
                    <Form.Control
                      className="rounded-3"
                      style={campo}
                      value={form.reparadoPor}
                      onChange={(e) => setForm({ ...form, reparadoPor: e.target.value })}
                      maxLength={80}
                    />
                  </Col>
                  {avisoRotas}
                  {campoObservaciones("Qué se reparó…")}
                </Row>
              )}

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

              {modo === "sinCarro" && (
                <Row className="g-2 form-ingresos">
                  {campoFecha}
                  {campoCantidad}
                  <Col xs={6}>
                    <Form.Label className="fw-semibold text-dark small mb-1">
                      Quién las trae <span className="text-danger">*</span>
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
                  <Col xs={6}>
                    <Form.Label className="fw-semibold text-dark small mb-1">
                      Encargado <span className="text-danger">*</span>
                    </Form.Label>
                    <Form.Select
                      className="rounded-3"
                      style={{ ...campo, color: form.encargado ? TEXTO : GRIS_CLARO }}
                      value={form.encargado}
                      onChange={(e) => setForm({ ...form, encargado: e.target.value })}
                      required
                    >
                      <option value="">Elegir encargado…</option>
                      {ENCARGADOS.map((e) => (
                        <option key={e} value={e} style={{ color: TEXTO }}>
                          {e}
                        </option>
                      ))}
                    </Form.Select>
                  </Col>
                  <Col xs={6}>
                    <Form.Label className="fw-semibold text-dark small mb-1">Frente</Form.Label>
                    <SelectFrente
                      frentes={frentes}
                      valor={form.frente}
                      onChange={(v) => setForm({ ...form, frente: v })}
                    />
                  </Col>
                  {/* El carro en que vienen, o S/N si no vienen en ninguno. */}
                  <Col xs={6}>
                    <Form.Label className="fw-semibold text-dark small mb-1">
                      Carro <span className="text-danger">*</span>
                    </Form.Label>
                    <Form.Select
                      className="rounded-3"
                      style={{ ...campo, color: form.cc ? TEXTO : GRIS_CLARO }}
                      value={form.cc}
                      onChange={(e) => setForm({ ...form, cc: e.target.value })}
                      required
                    >
                      <option value="">Elegir carro…</option>
                      <option value={SIN_NUMERO} style={{ color: TEXTO }}>
                        S/N
                      </option>
                      {carrosSinEntrar.map((c) => (
                        <option key={c._id} value={c._id} style={{ color: TEXTO }}>
                          {c.cc}
                          {c.descripcion ? ` · ${c.descripcion}` : ""}
                        </option>
                      ))}
                    </Form.Select>
                  </Col>
                  {campoObservaciones("De dónde vienen, cómo llegaron…", 1)}
                </Row>
              )}

              {modo === "retiro" && (
                <Row className="g-3 form-ingresos">
                  {campoFecha}
                  {campoCantidad}
                  {/* El frente, arriba y obligatorio: es adónde van. */}
                  <Col xs={12}>
                    <Form.Label className="fw-semibold text-dark small mb-1">
                      Frente <span className="text-danger">*</span>
                    </Form.Label>
                    <SelectFrente
                      frentes={frentes}
                      valor={form.frente}
                      onChange={(v) => setForm({ ...form, frente: v })}
                      required
                    />
                  </Col>
                  <Col xs={12}>
                    <Form.Label className="fw-semibold text-dark small mb-1">
                      Encargado <span className="text-danger">*</span>
                    </Form.Label>
                    <Form.Select
                      className="rounded-3"
                      style={{ ...campo, color: form.encargado ? TEXTO : GRIS_CLARO }}
                      value={form.encargado}
                      onChange={(e) => setForm({ ...form, encargado: e.target.value })}
                      required
                    >
                      <option value="">Elegir encargado…</option>
                      {ENCARGADOS.map((e) => (
                        <option key={e} value={e} style={{ color: TEXTO }}>
                          {e}
                        </option>
                      ))}
                    </Form.Select>
                  </Col>
                  <Col xs={12}>
                    <Form.Label className="fw-semibold text-dark small mb-1">
                      Quién retira <span className="text-danger">*</span>
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
                    {/* Angosto: alcanza para el número de CC. */}
                    <Form.Select
                      className="rounded-3"
                      style={{ ...campo, maxWidth: "180px", color: form.cc ? TEXTO : GRIS_CLARO }}
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
                    <strong>{editando.cantidadEscaleras ?? 0} escaleras</strong>
                    {editando.frente?.nombre ? ` del frente ${editando.frente.nombre}` : ""}.
                  </div>

                  <Row className="g-3 form-ingresos">
                    {camposClasificacion}
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

      <ModalAltaFrente
        show={altaFrente}
        onHide={() => setAltaFrente(false)}
        frentes={frentes}
        onGuardado={cargarFrentes}
      />

      <HistorialCarros
        show={verHistorialCarros}
        onHide={() => setVerHistorialCarros(false)}
        cosecha={cosecha}
        ingresos={ingresos}
      />

      {/* El historial de un total (28/10/2026): las reparadas, los retiros o
          las bajas, de la más nueva a la más vieja. Desde acá se corrigen o
          se borran; al tocar una acción se cierra. */}
      <Modal
        show={Boolean(verHistorial)}
        onHide={() => setHistorial(null)}
        centered
        size="lg"
        scrollable
        contentClassName="border-0 shadow-lg rounded-4"
      >
        {verHistorial && (
          <>
            <Modal.Header
              closeButton
              closeVariant="white"
              style={{
                backgroundColor: verHistorial.color,
                color: "#fff",
                borderTopLeftRadius: "1rem",
                borderTopRightRadius: "1rem",
              }}
            >
              <Modal.Title className="fs-6 fw-normal d-flex align-items-center gap-2 text-white">
                <i className="bi bi-clock-history"></i>
                <span>
                  {verHistorial.titulo} · Cosecha {cosecha}
                </span>
              </Modal.Title>
            </Modal.Header>
            <Modal.Body className="p-3">
              <div className="rounded-3 bg-white" style={{ border: "1px solid #cbd5e1", overflow: "auto" }}>
                <Table className="mb-0 tabla-informe" style={{ width: "100%" }}>
                  <thead>
                    <tr>
                      <th style={thCentro}>Fecha</th>
                      <th style={thCentro}>Cant.</th>
                      {verHistorial.columnas.map(([titulo]) => (
                        <th key={titulo} style={th}>
                          {titulo}
                        </th>
                      ))}
                      <th style={thCentro}>Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {verHistorial.filas.length === 0 ? (
                      <tr>
                        <td colSpan={verHistorial.columnas.length + 3} className="text-center text-muted py-4" style={td}>
                          {verHistorial.vacio}
                        </td>
                      </tr>
                    ) : (
                      <>
                        {verHistorial.filas.map((i) => (
                          <tr key={i._id}>
                            <td style={{ ...tdCentro, whiteSpace: "nowrap" }}>{fechaCorta(i.fechaIngreso)}</td>
                            <td style={{ ...tdCentro, fontWeight: 700, color: verHistorial.color }}>
                              {i[verHistorial.campoCant] ?? <Raya />}
                            </td>
                            {verHistorial.columnas.map(([titulo, celda]) => (
                              <td key={titulo} style={td}>
                                {celda(i)}
                              </td>
                            ))}
                            <td style={tdCentro}>
                              <div className="d-flex justify-content-center align-items-center" style={{ gap: "6px" }}>
                                <BotonAccion
                                  icono="bi-pencil"
                                  titulo={sinEditar ? "Sin permiso para editar" : "Editar"}
                                  variante="primary"
                                  onClick={() => {
                                    setHistorial(null);
                                    abrirEditar(i);
                                  }}
                                  deshabilitado={sinEditar}
                                />
                                <BotonAccion
                                  icono="bi-trash"
                                  titulo={sinEditar ? "Sin permiso para editar" : "Borrar"}
                                  variante="danger"
                                  onClick={() => {
                                    // Se cierra antes de preguntar, como al editar.
                                    setHistorial(null);
                                    eliminar(i);
                                  }}
                                  deshabilitado={sinEditar}
                                />
                              </div>
                            </td>
                          </tr>
                        ))}
                        <tr className="fila-total">
                          <td style={{ ...tdCentro, fontWeight: 700, color: COLOR }}>TOTAL</td>
                          <td style={{ ...tdCentro, fontWeight: 700, color: verHistorial.color }}>
                            {suma(verHistorial.filas, verHistorial.campoCant)}
                          </td>
                          <td colSpan={verHistorial.columnas.length + 1} style={td}></td>
                        </tr>
                      </>
                    )}
                  </tbody>
                </Table>
              </div>
              {/* Las reparadas cargadas en un ingreso suman al total de arriba
                  pero no son de este historial. */}
              {historial === "reparadas" && reparadas !== suma(historialReparadas, "escalerasReparadas") && (
                <div className="text-muted mt-2" style={{ fontSize: "0.72rem" }}>
                  Hay {reparadas - suma(historialReparadas, "escalerasReparadas")} reparadas más cargadas en los ingresos.
                </div>
              )}
            </Modal.Body>
          </>
        )}
      </Modal>

      <ControlAnioPasado
        show={verControl}
        onHide={() => setVerControl(false)}
        cosecha={cosecha}
        cosechaAnterior={cosechaAnterior}
        anterior={anterior}
        ingresos={ingresos}
      />
    </div>
  );
}
