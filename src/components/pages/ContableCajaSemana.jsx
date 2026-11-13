import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  Button,
  Container,
  Form,
  Modal,
  Spinner,
  Table,
} from "react-bootstrap";
import Swal from "sweetalert2";
import { api } from "../../services/api";
import { subirArchivo, borrarArchivo, prepararSubida } from "../../services/archivos";
import { usePermisos } from "../../context/permisos";
import { enCola, traerCaja, deMemoria, aMemoria } from "../../utils/colaCaja";

/**
 * Contable › Caja › una semana (13/11/2026): el control de caja de viernes a
 * jueves (la URL lleva el viernes que la abre: `inicio`). Arriba la cuenta: lo que sobró de la semana anterior + el
 * ingreso fijo (500.000 de entrada, se cambia con el lápiz y vale desde esta
 * semana en adelante) + las entradas − los gastos = lo que pasa a la semana
 * que viene. Abajo las dos tablas, entradas y gastos; los gastos llevan fotos
 * o archivos (Cloudinary, services/archivos.js).
 *
 * La cuenta la arma el back (catalogos/caja.js). Permiso: contable.caja.
 */

const COLOR = "#164e63";
const th = {
  backgroundColor: COLOR,
  color: "#fff",
  fontSize: "0.66rem",
  fontWeight: 600,
  verticalAlign: "middle",
  padding: "3px 5px",
  whiteSpace: "nowrap",
};
const td = { fontSize: "0.7rem", padding: "1px 5px", verticalAlign: "middle" };
const raya = <span style={{ color: "#cbd5e1" }}>—</span>;

const pesos = (n) =>
  `$ ${Number(n || 0).toLocaleString("es-AR", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
/** "2026-11-12" → "12/11" (con el año: "12/11/2026"). */
const ddmm = (s, conAnio = false) => {
  const [a, m, d] = String(s || "").split("-");
  return conAnio ? `${d}/${m}/${a}` : `${d}/${m}`;
};
const DIA_CORTO = ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"];
const diaDe = (s) => {
  const [a, m, d] = s.split("-").map(Number);
  return DIA_CORTO[new Date(a, m - 1, d).getDay()];
};
/** El viernes de al lado: -7 o +7 días. */
const otraSemana = (inicio, dias) => {
  const [a, m, d] = inicio.split("-").map(Number);
  const f = new Date(a, m - 1, d + dias);
  return `${f.getFullYear()}-${String(f.getMonth() + 1).padStart(2, "0")}-${String(f.getDate()).padStart(2, "0")}`;
};

const LISTAS = {
  entradas: {
    titulo: "Entradas",
    singular: "entrada",
    icono: "bi-plus-circle-fill",
    color: "#15803d",
  },
  gastos: {
    titulo: "Gastos",
    singular: "gasto",
    icono: "bi-dash-circle-fill",
    color: "#dc2626",
  },
};

/** Un dato de la cuenta de arriba. */
function Dato({
  titulo,
  valor,
  color = COLOR,
  signo = "",
  extra = null,
  fuerte = false,
}) {
  return (
    <div
      className="bg-white rounded-3 shadow-sm px-3 py-2 d-flex flex-column justify-content-center"
      style={{
        border: `1px solid ${fuerte ? color : "#cbd5e1"}`,
        minWidth: "150px",
        flex: "1 1 150px",
      }}
    >
      <div
        className="d-flex align-items-center gap-2"
        style={{ fontSize: "0.7rem", color: "#64748b", fontWeight: 600 }}
      >
        {titulo}
        {/* El lápiz (u otro botón) contra el borde derecho. */}
        {extra && <span className="ms-auto d-flex">{extra}</span>}
      </div>
      {/* El número, centrado en el box. */}
      <div
        style={{
          fontSize: fuerte ? "1.15rem" : "1rem",
          fontWeight: 700,
          color,
          whiteSpace: "nowrap",
          textAlign: "center",
        }}
      >
        {signo}
        {pesos(valor)}
      </div>
    </div>
  );
}

const sumaMontos = (l) => (l || []).reduce((t, x) => t + (Number(x.monto) || 0), 0);
const redondear = (n) => Math.round(n * 100) / 100;
/** Los totales y el saldo de la semana, con las listas como están en pantalla. */
const conCuenta = (d) => {
  const entradas = redondear(sumaMontos(d.lista.entradas));
  const gastos = redondear(sumaMontos(d.lista.gastos));
  return { ...d, entradas, gastos, saldo: redondear(d.arrastre + d.fijo + entradas - gastos) };
};

const vacio = (fecha) => ({
  _id: null,
  fecha,
  monto: "",
  descripcion: "",
  archivos: [],
});

function ContableCajaSemana() {
  const { inicio } = useParams();
  const navigate = useNavigate();
  const { puede } = usePermisos();
  const sinEditar = !puede("contable.caja", "editar");

  const [cargados, setDatos] = useState(null);
  // Lo traído es de otra semana mientras llega el de esta (al cambiar con las flechas).
  // Mientras llega, lo de la última vez (o lo precargado desde el mes): la
  // semana aparece al instante y se actualiza sola (13/11/2026).
  const datos = cargados?.semana === inicio ? cargados : deMemoria(`semana/${inicio}`);
  useEffect(() => {
    if (cargados) aMemoria(`semana/${cargados.semana}`, cargados);
  }, [cargados]);
  const [error, setError] = useState("");
  // El modal de alta o edición: { lista, original, form }. Las fotos que se
  // están subiendo en el modal van en `subidas` ({ clave, nombre, archivo,
  // fallo, sacada }) y su promesa en `promesas` (clave → promesa).
  const [editando, setEditando] = useState(null);
  // La tabla de lo cargado se ve con el botón Ver.
  const [verTabla, setVerTabla] = useState(false);
  const [subidas, setSubidas] = useState([]);
  const promesas = useRef(new Map());

  // Los guardados van por detrás (13/11/2026: cada respuesta tardaba): la
  // pantalla cambia enseguida y los pedidos salen de a uno, en orden. Solo la
  // respuesta del último pisa lo que se ve.
  const enCurso = useRef(0);
  const [pendientes, setPendientes] = useState(0);
  const inicioActual = useRef(inicio);
  useEffect(() => {
    inicioActual.current = inicio;
  }, [inicio]);

  const traer = useCallback(
    () =>
      // Después de lo que se esté guardando: si no, el sobrante sale viejo.
      traerCaja(`semana/${inicio}`, api)
        .then((d) => {
          setDatos(d);
          setError("");
        })
        .catch((err) => setError(err.message)),
    [inicio],
  );
  useEffect(() => {
    traer();
    // Así la primera foto no espera la firma de Cloudinary.
    if (!sinEditar) prepararSubida();
  }, [traer, sinEditar]);

  /**
   * Cambia la pantalla con `local` y manda `enviar` por detrás. Si falla,
   * avisa y vuelve a traer lo guardado.
   */
  const porDetras = (local, enviar, tituloError = "No se pudo guardar") => {
    if (local)
      setDatos((d) => {
        const base = d?.semana === inicio ? d : deMemoria(`semana/${inicio}`);
        return base ? conCuenta(local(base)) : d;
      });
    enCurso.current += 1;
    setPendientes((n) => n + 1);
    enCola(async () => {
      try {
        const d = await enviar();
        if (enCurso.current === 1 && d?.semana === inicioActual.current) setDatos(d);
      } catch (err) {
        Swal.fire({ icon: "error", title: tituloError, text: err.message, width: "300px" });
        if (inicioActual.current === inicio) traer();
      } finally {
        enCurso.current -= 1;
        setPendientes((n) => n - 1);
      }
    });
  };
  const listo = (titulo = "Guardado") =>
    Swal.fire({ icon: "success", title: titulo, timer: 1400, showConfirmButton: false, width: "300px" });

  const volverAlCalendario = () => {
    const [a, m] = inicio.split("-").map(Number);
    navigate("/contable/caja", { state: { anio: a, mes: m - 1 } });
  };

  /** El ingreso fijo: vale desde esta semana en adelante. */
  const cambiarFijo = async () => {
    const { value, isConfirmed, isDenied } = await Swal.fire({
      title: "Ingreso fijo",
      text: "Vale desde esta semana en adelante; las anteriores no cambian.",
      input: "number",
      inputValue: datos.fijo,
      inputAttributes: { min: "0", step: "1000" },
      width: "320px",
      showCancelButton: true,
      showDenyButton: datos.fijoPropio,
      denyButtonText: "Usar el de la semana anterior",
      confirmButtonText: "Guardar",
      cancelButtonText: "Cancelar",
      confirmButtonColor: "#1e293b",
      denyButtonColor: "#0e7490",
      cancelButtonColor: "#64748b",
      inputValidator: (v) => (v === "" || Number(v) < 0 ? "Poné un monto mayor o igual a cero" : undefined),
    });
    if (!isConfirmed && !isDenied) return;
    const fijo = isDenied ? null : Number(value);
    // Volver al anterior no se sabe cuánto da hasta que contesta el back.
    porDetras(
      fijo === null ? null : (d) => ({ ...d, fijo, fijoPropio: true }),
      () => api.put(`/contable/caja/semana/${inicio}/fijo`, { fijo }),
    );
    listo();
  };

  const abrir = (lista, fila) => {
    const original = fila || null;
    setSubidas([]);
    setEditando({
      lista,
      original,
      form: original
        ? { ...original, monto: String(original.monto).replace(".", ","), archivos: original.archivos || [] }
        : vacio(inicio),
    });
  };
  const cambiar = (campo, valor) => setEditando((e) => ({ ...e, form: { ...e.form, [campo]: valor } }));

  /** Cuando terminen, borra de Cloudinary las subidas que no se van a guardar. */
  const descartar = (claves) =>
    claves.forEach((c) => promesas.current.get(c)?.then((a) => a && borrarArchivo(a)));

  const cerrar = () => {
    // Lo que se subió en este modal y no se guardó no queda suelto en Cloudinary.
    descartar(subidas.map((s) => s.clave));
    promesas.current = new Map();
    setSubidas([]);
    setEditando(null);
  };

  /** Las fotos se suben todas a la vez, apenas se eligen. */
  const agregarArchivos = (ev) => {
    const files = [...(ev.target.files || [])];
    ev.target.value = "";
    for (const f of files) {
      const clave = `${Date.now()}-${Math.random()}`;
      setSubidas((l) => [...l, { clave, nombre: f.name, archivo: null, fallo: false, sacada: false }]);
      const promesa = subirArchivo(f, { achicar: true })
        .then((archivo) => {
          setSubidas((l) => l.map((s) => (s.clave === clave ? { ...s, archivo } : s)));
          return archivo;
        })
        .catch((err) => {
          setSubidas((l) => l.map((s) => (s.clave === clave ? { ...s, fallo: true } : s)));
          Swal.fire({ icon: "error", title: "No se pudo subir", text: `${f.name}: ${err.message}`, width: "300px" });
          return null;
        });
      promesas.current.set(clave, promesa);
    }
  };
  const sacarArchivo = (a) => cambiar("archivos", editando.form.archivos.filter((x) => x !== a));
  const sacarSubida = (clave) => setSubidas((l) => l.map((s) => (s.clave === clave ? { ...s, sacada: true } : s)));

  const guardar = (ev) => {
    ev.preventDefault();
    const { lista, original, form } = editando;
    const monto = Math.round(Number(String(form.monto).replace(",", ".")) * 100) / 100;
    if (!Number.isFinite(monto) || monto <= 0) {
      Swal.fire({ icon: "error", title: "Revisá el monto", text: "Tiene que ser mayor que cero.", width: "300px" });
      return;
    }
    const cuerpo = { fecha: form.fecha, monto, descripcion: form.descripcion.trim() };
    const quedan = subidas.filter((s) => !s.sacada && !s.fallo);
    descartar(subidas.filter((s) => s.sacada).map((s) => s.clave));
    const esperar = quedan.map((s) => promesas.current.get(s.clave));
    const ruta = `/contable/caja/semana/${inicio}/${lista}`;

    // En pantalla ya: la fila nueva (o cambiada), con las fotos que faltan
    // subir marcadas, y sin poder tocarla hasta que se guarde.
    const fila = {
      ...(original || {}),
      ...cuerpo,
      _id: original?._id || `nuevo-${Date.now()}`,
      pendiente: true,
      archivos:
        lista === "gastos"
          ? [...form.archivos, ...quedan.map((s) => s.archivo || { nombre: s.nombre, subiendo: true })]
          : undefined,
    };
    porDetras(
      (d) => {
        const l = d.lista[lista];
        const nueva = original ? l.map((x) => (x._id === original._id ? fila : x)) : [...l, fila];
        return { ...d, lista: { ...d.lista, [lista]: nueva.sort((a, b) => a.fecha.localeCompare(b.fecha)) } };
      },
      async () => {
        if (lista === "gastos") {
          const nuevos = (await Promise.all(esperar)).filter(Boolean);
          cuerpo.archivos = [...form.archivos, ...nuevos];
        }
        const d = original ? await api.put(`${ruta}/${original._id}`, cuerpo) : await api.post(ruta, cuerpo);
        // Los que tenía y se sacaron, fuera de Cloudinary.
        const siguen = new Set(form.archivos.map((a) => a.publicId));
        (original?.archivos || []).filter((a) => !siguen.has(a.publicId)).forEach((a) => borrarArchivo(a));
        return d;
      },
    );
    promesas.current = new Map();
    setSubidas([]);
    setEditando(null);
    listo();
  };

  const borrar = async (lista, fila) => {
    const { isConfirmed } = await Swal.fire({
      icon: "warning",
      title: `¿Borrar ${lista === "gastos" ? "el gasto" : "la entrada"}?`,
      text: `${ddmm(fila.fecha)} · ${pesos(fila.monto)}${fila.descripcion ? ` · ${fila.descripcion}` : ""}. Esta acción no se puede deshacer.`,
      width: "320px",
      showCancelButton: true,
      confirmButtonText: "Sí, borrar",
      cancelButtonText: "Cancelar",
      confirmButtonColor: "#dc2626",
      cancelButtonColor: "#64748b",
    });
    if (!isConfirmed) return;
    porDetras(
      (d) => ({ ...d, lista: { ...d.lista, [lista]: d.lista[lista].filter((x) => x._id !== fila._id) } }),
      async () => {
        const d = await api.delete(`/contable/caja/semana/${inicio}/${lista}/${fila._id}`);
        (fila.archivos || []).forEach((a) => borrarArchivo(a));
        return d;
      },
      "No se pudo borrar",
    );
    listo("Borrado");
  };

  /** Los dos botones grandes de alta (13/11/2026: la hoja pasó a botones). */
  const botonGrande = (lista) => {
    const { singular, icono, color } = LISTAS[lista];
    return (
      <button
        type="button"
        onClick={() => abrir(lista)}
        disabled={sinEditar}
        className="btn d-flex flex-column align-items-center justify-content-center gap-1 shadow-sm"
        style={{
          flex: "0 1 220px",
          minHeight: 64,
          borderRadius: 16,
          backgroundColor: color,
          borderColor: color,
          color: "#fff",
          fontSize: "1rem",
          fontWeight: 700,
        }}
        title={sinEditar ? "Sin permiso para editar" : `Cargar ${singular}`}
      >
        <i className={`bi ${icono}`} style={{ fontSize: "1.2rem" }}></i>
        {singular[0].toUpperCase() + singular.slice(1)}
      </button>
    );
  };

  /** Todo lo cargado en la semana, entradas y gastos juntos, por fecha. */
  const tablaCargado = () => {
    const filas = [
      ...datos.lista.entradas.map((f) => ({ ...f, lista: "entradas" })),
      ...datos.lista.gastos.map((f) => ({ ...f, lista: "gastos" })),
    ].sort((a, b) => a.fecha.localeCompare(b.fecha));
    return (
      <div className="shadow-sm rounded-3 bg-white" style={{ border: "1px solid #cbd5e1", overflowX: "auto" }}>
        <Table className="mb-0 tabla-informe" style={{ width: "100%" }}>
          <thead>
            <tr>
              <th style={{ ...th, width: "28px", textAlign: "center" }}>#</th>
              <th style={{ ...th, width: "80px", textAlign: "center" }}>Tipo</th>
              <th style={{ ...th, width: "80px", textAlign: "center" }}>Fecha</th>
              <th style={th}>Descripción</th>
              <th style={{ ...th, width: "120px", textAlign: "center" }}>Monto</th>
              <th style={{ ...th, width: "90px", textAlign: "center" }}>Archivos</th>
              <th style={{ ...th, width: "70px", textAlign: "center" }}>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {!filas.length ? (
              <tr>
                <td colSpan={7} className="text-center text-muted py-3" style={td}>
                  No hay nada cargado esta semana
                </td>
              </tr>
            ) : (
              filas.map((f, i) => {
                const { color } = LISTAS[f.lista];
                const esGasto = f.lista === "gastos";
                return (
                  <tr key={`${f.lista}-${f._id}`}>
                    <td style={{ ...td, textAlign: "center", color: "#64748b" }}>{i + 1}</td>
                    <td style={{ ...td, textAlign: "center", fontWeight: 600, color }}>
                      {esGasto ? "Gasto" : "Entrada"}
                    </td>
                    <td style={{ ...td, textAlign: "center", whiteSpace: "nowrap" }}>
                      <span style={{ color: "#94a3b8" }}>{diaDe(f.fecha)}</span> {ddmm(f.fecha)}
                    </td>
                    <td style={{ ...td, whiteSpace: "pre-wrap" }}>{f.descripcion || raya}</td>
                    <td style={{ ...td, textAlign: "center", whiteSpace: "nowrap", fontWeight: 600, color }}>
                      {esGasto ? "− " : "+ "}
                      {pesos(f.monto)}
                    </td>
                    <td style={{ ...td, textAlign: "center" }}>
                      {f.archivos?.length ? (
                        <div className="d-flex justify-content-center flex-wrap" style={{ gap: "6px" }}>
                          {f.archivos.map((a, j) =>
                            a.subiendo ? (
                              <Spinner
                                key={j}
                                animation="border"
                                size="sm"
                                style={{ width: "0.8rem", height: "0.8rem", color: "#0e7490" }}
                                title={`Subiendo ${a.nombre}`}
                              />
                            ) : (
                              <a key={j} href={a.url} target="_blank" rel="noreferrer" title={a.nombre || "Archivo"}>
                                <i
                                  className={`bi ${a.tipo === "image" ? "bi-image" : "bi-file-earmark-text"}`}
                                  style={{ fontSize: "0.9rem", color: "#0e7490" }}
                                ></i>
                              </a>
                            ),
                          )}
                        </div>
                      ) : (
                        raya
                      )}
                    </td>
                    <td style={td}>
                      <div className="d-flex justify-content-center align-items-center" style={{ gap: "10px" }}>
                        <button
                          onClick={() => abrir(f.lista, f)}
                          disabled={sinEditar || f.pendiente}
                          className="btn btn-sm btn-outline-primary d-flex align-items-center justify-content-center rounded-2 p-0"
                          style={{ width: "24px", height: "24px" }}
                          title={sinEditar ? "Sin permiso para editar" : f.pendiente ? "Guardando…" : "Editar"}
                        >
                          <i className="bi bi-pencil" style={{ fontSize: "0.8rem" }}></i>
                        </button>
                        <button
                          onClick={() => borrar(f.lista, f)}
                          disabled={sinEditar || f.pendiente}
                          className="btn btn-sm btn-outline-danger d-flex align-items-center justify-content-center rounded-2 p-0"
                          style={{ width: "24px", height: "24px" }}
                          title={sinEditar ? "Sin permiso para editar" : f.pendiente ? "Guardando…" : "Borrar"}
                        >
                          <i className="bi bi-trash" style={{ fontSize: "0.8rem" }}></i>
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </Table>
      </div>
    );
  };

  return (
    <div
      style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        backgroundColor: "#f8f9fa",
        height: "100%",
        overflow: "auto",
      }}
    >
      {/* Todo un poco más abajo (13/11/2026). */}
      <Container className="pb-3" style={{ maxWidth: "900px", paddingTop: "2.5rem" }}>
        {/* Encabezado: volver al calendario, la semana y las flechas. */}
        <div className="d-flex align-items-center gap-2 mb-3 flex-wrap">
          <button
            type="button"
            onClick={volverAlCalendario}
            className="btn btn-sm btn-outline-secondary d-flex align-items-center justify-content-center"
            style={{ width: 32, height: 32 }}
            title="Volver al calendario"
          >
            <i className="bi bi-arrow-left"></i>
          </button>
          <i
            className="bi bi-safe2-fill"
            style={{ color: "#0e7490", fontSize: "1.2rem" }}
          ></i>
          <span
            className="fw-bold"
            style={{ color: COLOR, fontSize: "1.05rem" }}
          >
            Caja
          </span>
          <span
            className="px-2 py-1 rounded-pill"
            style={{
              backgroundColor: "#ecfeff",
              color: COLOR,
              fontSize: "0.8rem",
              fontWeight: 600,
            }}
          >
            vie {ddmm(inicio)} al jue{" "}
            {ddmm(datos?.hasta || otraSemana(inicio, 6), true)}
          </span>
          {/* Lo que todavía se está guardando por detrás. */}
          {pendientes > 0 && (
            <span className="d-flex align-items-center gap-1" style={{ fontSize: "0.75rem", color: "#64748b" }}>
              <Spinner animation="border" size="sm" style={{ width: "0.75rem", height: "0.75rem" }} />
              Guardando…
            </span>
          )}
          <div className="d-flex align-items-center gap-1 ms-auto">
            <button
              type="button"
              onClick={() =>
                navigate(`/contable/caja/semana/${otraSemana(inicio, -7)}`)
              }
              className="btn btn-sm btn-outline-secondary d-flex align-items-center justify-content-center p-0"
              style={{ width: 32, height: 32 }}
              title="Semana anterior"
            >
              <i className="bi bi-chevron-left"></i>
            </button>
            <button
              type="button"
              onClick={() =>
                navigate(`/contable/caja/semana/${otraSemana(inicio, 7)}`)
              }
              className="btn btn-sm btn-outline-secondary d-flex align-items-center justify-content-center p-0"
              style={{ width: 32, height: 32 }}
              title="Semana siguiente"
            >
              <i className="bi bi-chevron-right"></i>
            </button>
          </div>
        </div>

        {error ? (
          <div
            className="alert alert-danger py-2"
            style={{ fontSize: "0.85rem" }}
          >
            {error}
          </div>
        ) : !datos ? (
          <Spinner animation="border" className="d-block mx-auto my-5" />
        ) : (
          <>
            {/* La cuenta de la semana. */}
            <div className="d-flex flex-wrap gap-2 mb-4">
              <Dato
                titulo={
                  datos.inicioCaja && inicio > datos.inicioCaja
                    ? "Sobrante semana anterior"
                    : "Sobrante semana anterior · primera semana de la caja"
                }
                valor={datos.arrastre}
                color={datos.arrastre < 0 ? "#dc2626" : COLOR}
              />
              <Dato
                titulo="Ingreso fijo"
                valor={datos.fijo}
                signo="+ "
                extra={
                  <button
                    type="button"
                    onClick={cambiarFijo}
                    disabled={sinEditar}
                    className="btn btn-link p-0"
                    style={{ fontSize: "0.75rem", lineHeight: 1 }}
                    title={
                      sinEditar
                        ? "Sin permiso para editar"
                        : "Cambiar el ingreso fijo (desde esta semana en adelante)"
                    }
                  >
                    <i className="bi bi-pencil"></i>
                  </button>
                }
              />
              <Dato
                titulo="Entradas"
                valor={datos.entradas}
                signo="+ "
                color="#15803d"
              />
              <Dato
                titulo="Gastos"
                valor={datos.gastos}
                signo="− "
                color="#dc2626"
              />
              <Dato
                titulo="Saldo · pasa a la semana que viene"
                valor={datos.saldo}
                color={datos.saldo < 0 ? "#dc2626" : COLOR}
                fuerte
              />
            </div>

            {/* Cargar: dos botones grandes, uno al lado del otro. */}
            {/* Más separados de los box de arriba, más chicos y centrados. */}
            <div className="d-flex justify-content-center gap-3 mb-4" style={{ marginTop: "2.5rem" }}>
              {botonGrande("entradas")}
              {botonGrande("gastos")}
            </div>

            {/* Ver: muestra u oculta la tabla de lo cargado. */}
            <div className="d-flex justify-content-center mb-3">
              <button
                type="button"
                onClick={() => setVerTabla((v) => !v)}
                className="btn d-flex align-items-center gap-2 px-4"
                style={{
                  borderRadius: 12,
                  backgroundColor: verTabla ? COLOR : "#fff",
                  borderColor: COLOR,
                  color: verTabla ? "#fff" : COLOR,
                  fontWeight: 600,
                  fontSize: "0.9rem",
                }}
              >
                <i className={`bi ${verTabla ? "bi-eye-slash" : "bi-eye"}`}></i>
                {verTabla ? "Ocultar" : "Ver"} lo cargado
                <span
                  className="px-2 rounded-pill"
                  style={{
                    fontSize: "0.72rem",
                    backgroundColor: verTabla ? "rgba(255,255,255,0.2)" : "#ecfeff",
                  }}
                >
                  {datos.lista.entradas.length + datos.lista.gastos.length}
                </span>
              </button>
            </div>
            {verTabla && tablaCargado()}
          </>
        )}
      </Container>

      {/* Alta o edición de una entrada o un gasto. */}
      <Modal
        show={Boolean(editando)}
        onHide={cerrar}
        centered
        contentClassName="border-0 shadow-lg rounded-4"
      >
        {editando && (
          <Form onSubmit={guardar}>
            <Modal.Header
              closeButton
              closeVariant="white"
              style={{
                backgroundColor: COLOR,
                color: "#fff",
                borderTopLeftRadius: "1rem",
                borderTopRightRadius: "1rem",
              }}
            >
              <Modal.Title style={{ fontSize: "1rem" }}>
                {editando.lista === "gastos"
                  ? editando.original
                    ? "Editar gasto"
                    : "Nuevo gasto"
                  : editando.original
                    ? "Editar entrada"
                    : "Nueva entrada"}
              </Modal.Title>
            </Modal.Header>
            <Modal.Body className="d-flex flex-column gap-3">
              <div className="d-flex gap-3">
                <Form.Group style={{ flex: 1 }}>
                  <Form.Label className="fw-semibold small mb-1">
                    Fecha
                  </Form.Label>
                  <Form.Control
                    type="date"
                    required
                    min={inicio}
                    max={datos?.hasta}
                    value={editando.form.fecha}
                    onChange={(e) => cambiar("fecha", e.target.value)}
                  />
                </Form.Group>
                <Form.Group style={{ flex: 1 }}>
                  <Form.Label className="fw-semibold small mb-1">
                    Monto
                  </Form.Label>
                  <Form.Control
                    type="text"
                    inputMode="decimal"
                    required
                    autoFocus
                    value={editando.form.monto}
                    onChange={(e) =>
                      cambiar("monto", e.target.value.replace(/[^\d,.]/g, ""))
                    }
                  />
                </Form.Group>
              </div>
              <Form.Group>
                <Form.Label className="fw-semibold small mb-1">
                  Descripción
                </Form.Label>
                <Form.Control
                  as="textarea"
                  rows={2}
                  maxLength={300}
                  value={editando.form.descripcion}
                  onChange={(e) => cambiar("descripcion", e.target.value)}
                />
              </Form.Group>
              {editando.lista === "gastos" && (
                <Form.Group>
                  <Form.Label className="fw-semibold small mb-1">
                    Fotos y archivos
                  </Form.Label>
                  <div className="d-flex flex-column gap-1 mb-2">
                    {editando.form.archivos.map((a, i) => (
                      <div
                        key={i}
                        className="d-flex align-items-center gap-2"
                        style={{ fontSize: "0.8rem" }}
                      >
                        <i
                          className={`bi ${a.tipo === "image" ? "bi-image" : "bi-file-earmark-text"}`}
                          style={{ color: "#0e7490" }}
                        ></i>
                        <a
                          href={a.url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-truncate"
                          style={{ maxWidth: "320px" }}
                        >
                          {a.nombre || "Archivo"}
                        </a>
                        <button
                          type="button"
                          className="btn btn-link p-0 ms-auto"
                          onClick={() => sacarArchivo(a)}
                          title="Sacar el archivo"
                          style={{ color: "#dc2626", lineHeight: 1 }}
                        >
                          <i className="bi bi-x-lg"></i>
                        </button>
                      </div>
                    ))}
                    {subidas
                      .filter((x) => !x.sacada)
                      .map((x) => (
                        <div key={x.clave} className="d-flex align-items-center gap-2" style={{ fontSize: "0.8rem" }}>
                          {x.fallo ? (
                            <i className="bi bi-exclamation-triangle-fill" style={{ color: "#dc2626" }}></i>
                          ) : x.archivo ? (
                            <i className="bi bi-check-circle-fill" style={{ color: "#15803d" }}></i>
                          ) : (
                            <Spinner animation="border" size="sm" style={{ width: "0.8rem", height: "0.8rem", color: "#0e7490" }} />
                          )}
                          <span className="text-truncate" style={{ maxWidth: "320px", color: x.fallo ? "#dc2626" : undefined }}>
                            {x.nombre}
                            {x.fallo ? " (no se subió)" : x.archivo ? "" : " (subiendo…)"}
                          </span>
                          <button
                            type="button"
                            className="btn btn-link p-0 ms-auto"
                            onClick={() => sacarSubida(x.clave)}
                            title="Sacar el archivo"
                            style={{ color: "#dc2626", lineHeight: 1 }}
                          >
                            <i className="bi bi-x-lg"></i>
                          </button>
                        </div>
                      ))}
                  </div>
                  {/* Se puede guardar sin esperar: lo que falta subir se agrega solo. */}
                  <label
                    className="btn btn-sm btn-outline-secondary d-inline-flex align-items-center gap-2"
                    style={{ fontSize: "0.78rem", cursor: "pointer" }}
                  >
                    <i className="bi bi-paperclip"></i>
                    Agregar foto o archivo
                    <input
                      type="file"
                      multiple
                      hidden
                      accept="image/*,application/pdf,.doc,.docx,.xls,.xlsx"
                      onChange={agregarArchivos}
                    />
                  </label>
                </Form.Group>
              )}
            </Modal.Body>
            <Modal.Footer className="border-0 pt-0">
              <Button variant="outline-secondary" size="sm" onClick={cerrar}>
                Cancelar
              </Button>
              <Button type="submit" size="sm" style={{ backgroundColor: COLOR, borderColor: COLOR }}>
                Guardar
              </Button>
            </Modal.Footer>
          </Form>
        )}
      </Modal>
    </div>
  );
}

export default ContableCajaSemana;
