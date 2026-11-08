import { useEffect, useMemo, useState } from "react";
import { Button, Container, Form, Modal, Table } from "react-bootstrap";
import Swal from "sweetalert2";
import { api } from "../../services/api";
import { usePermisos } from "../../context/permisos";
import ModalListaTareas from "../shared/ModalListaTareas";
import PrecioConHistorial from "../shared/PrecioConHistorial";
import { exportarPlanilla } from "../../helpers/excel";

// Las tareas de Citrusvil van con las unidades de La Martina (Altas › Tareas):
// el back traduce las del Excel (HRA y H → Horas, PLA → Plantas…).
const UNIDADES_LA_MARTINA = ["Horas", "Plantas", "Tancadas", "Un", "Hectárea"];

const th = {
  backgroundColor: "#164e63",
  color: "#fff",
  fontSize: "0.66rem",
  fontWeight: 600,
  verticalAlign: "middle",
  padding: "3px 5px",
  whiteSpace: "nowrap",
};
const td = { fontSize: "0.7rem", padding: "1px 5px", verticalAlign: "middle" };
const raya = <span style={{ color: "#cbd5e1" }}>—</span>;

const ordenar = (a, b) => a.localeCompare(b, "es");

/** Las unidades de la respuesta de /contable/equivalencias, siempre con las dos listas. */
const conUnidades = (d) => ({
  nuevas: Array.isArray(d?.unidades?.nuevas) ? d.unidades.nuevas : [],
  cargadas: Array.isArray(d?.unidades?.cargadas) ? d.unidades.cargadas : [],
});

// Cómo quedan las equivalencias después de cada cambio, para mostrarlo en
// pantalla sin esperar a la base (05/11/2026: guardar tardaba segundos). Son
// las mismas reglas que aplica el back.
const vacia = (e) => !(e.citrusvil || []).length && !e.observaciones;

/** LM → Ctv: la tarea de La Martina queda con esas de Citrusvil y esas observaciones. */
const conTareaLM = (eqs, tareaId, citrusvil, observaciones) => {
  const resto = eqs.filter((e) => String(e.tarea) !== String(tareaId));
  const nueva = { tarea: tareaId, citrusvil, observaciones: (observaciones || "").trim() };
  return vacia(nueva) ? resto : [...resto, nueva];
};

/**
 * Ctv → LM: la de Citrusvil queda en exactamente esas tareas de La Martina
 * (puede ser más de una desde el 06/11/2026, o ninguna) y sale de las demás.
 */
const conTareaCtv = (eqs, nombre, tareaIds) => {
  const van = new Set(tareaIds.map(String));
  const lista = eqs.map((e) => {
    const esta = (e.citrusvil || []).includes(nombre);
    if (van.has(String(e.tarea))) return esta ? e : { ...e, citrusvil: [...(e.citrusvil || []), nombre] };
    return esta ? { ...e, citrusvil: e.citrusvil.filter((c) => c !== nombre) } : e;
  });
  for (const id of van) {
    if (!lista.some((e) => String(e.tarea) === id)) lista.push({ tarea: id, citrusvil: [nombre], observaciones: "" });
  }
  return lista.filter((e) => !vacia(e));
};

// El cian de Contable, para las solapas y el buscador.
const COLOR = "#164e63";
const COLOR_SUAVE = "#ecfeff";

// Las dos maneras de mirar la misma equivalencia (05/11/2026).
const SOLAPAS = [
  ["lm", "LM → Ctv", "bi-list-check"],
  ["ctv", "Ctv → LM", "bi-list-ul"],
];

/**
 * Equivalencias de tareas (05/11/2026): qué tareas de Citrusvil equivalen a
 * cada tarea de La Martina.
 *
 * Una fila por cada tarea de La Martina (Altas › Tareas). Con el lápiz se
 * tildan las de Citrusvil que le corresponden: son todas las que aparecen en
 * "Detalle de tarea" de las tablas mensuales de Contable. Una de Citrusvil
 * puede estar en varias de La Martina (06/11/2026); lo que no se deja es que
 * vaya en otra unidad.
 *
 * El botón "Tareas Citrusvil" abre su listado, donde se pueden agregar a las
 * que vienen de los Excel. Las de La Martina se dan de alta solo en
 * Altas › Tareas (05/11/2026): acá no.
 *
 * Dos solapas sobre las mismas equivalencias: "LM → Ctv", una fila por tarea
 * de La Martina con sus tareas de Citrusvil, y "Ctv → LM", una fila por tarea
 * de Citrusvil con las de La Martina que le tocan. En la segunda el lápiz
 * tilda esas tareas y el tacho la deja sin equivalencia.
 */
function ContableEquivalencias() {
  const { puede } = usePermisos();
  const sinEditar = !puede("contable.equivalencias", "editar");
  const [verCitrusvil, setVerCitrusvil] = useState(false);
  const [solapa, setSolapa] = useState("lm");

  // El modal de la solapa Ctv → LM: la tarea de Citrusvil y las de La
  // Martina tildadas para ella.
  const [editandoCtv, setEditandoCtv] = useState(null);
  const [elegidasLM, setElegidasLM] = useState([]);
  // La de costos (07/11/2026): si en la Comparativa de costos va con otras
  // tareas de La Martina, y cuáles.
  const [distintaCostos, setDistintaCostos] = useState(false);
  const [elegidasCostos, setElegidasCostos] = useState([]);

  const [tareas, setTareas] = useState([]);
  const [equivalencias, setEquivalencias] = useState([]);
  const [citrusvil, setCitrusvil] = useState([]);
  // Las equivalencias solo para la Comparativa de costos: [{ nombre, tareas }].
  const [costos, setCostos] = useState([]);
  // Las unidades de Citrusvil que no se reconocían (08/11/2026): las nuevas,
  // que hay que decir a cuál de La Martina equivalen, y las ya cargadas.
  const [unidades, setUnidades] = useState({ nuevas: [], cargadas: [] });
  const [eleccionUnidad, setEleccionUnidad] = useState({}); // forma → unidad elegida
  const [guardandoUnidad, setGuardandoUnidad] = useState(null);
  const [cargando, setCargando] = useState(true);

  // El modal de editar: la tarea de La Martina, lo tildado y las observaciones.
  const [editando, setEditando] = useState(null);
  const [tildadas, setTildadas] = useState([]);
  const [observaciones, setObservaciones] = useState("");

  const traer = () =>
    api.get("/contable/equivalencias").then((d) => {
      setEquivalencias(Array.isArray(d?.equivalencias) ? d.equivalencias : []);
      setCitrusvil(Array.isArray(d?.citrusvil) ? d.citrusvil : []);
      setCostos(Array.isArray(d?.costos) ? d.costos : []);
      setUnidades(conUnidades(d));
    });

  useEffect(() => {
    let vigente = true;
    Promise.all([
      api.get("/tareas").catch(() => []),
      api.get("/contable/equivalencias").catch(() => null),
    ])
      .then(([lista, d]) => {
        if (!vigente) return;
        const arr = Array.isArray(lista) ? lista : lista?.data || [];
        setTareas([...arr].sort((a, b) => ordenar(a.tarea || "", b.tarea || "")));
        setEquivalencias(Array.isArray(d?.equivalencias) ? d.equivalencias : []);
        setCitrusvil(Array.isArray(d?.citrusvil) ? d.citrusvil : []);
        setCostos(Array.isArray(d?.costos) ? d.costos : []);
        setUnidades(conUnidades(d));
      })
      .finally(() => vigente && setCargando(false));
    return () => {
      vigente = false;
    };
  }, []);

  // Tarea de La Martina → su equivalencia, y Citrusvil → en qué tareas está
  // (puede ser más de una).
  const porTarea = useMemo(() => new Map(equivalencias.map((e) => [String(e.tarea), e])), [equivalencias]);
  const tareasDeCitrusvil = useMemo(() => {
    const m = new Map();
    for (const e of equivalencias)
      for (const c of e.citrusvil || []) m.set(c, [...(m.get(c) || []), String(e.tarea)]);
    return m;
  }, [equivalencias]);
  const nombreTarea = useMemo(() => new Map(tareas.map((t) => [String(t._id), t.tarea])), [tareas]);
  // Citrusvil → las tareas de La Martina con las que va en costos (si tiene).
  const costosDe = useMemo(() => new Map(costos.map((c) => [c.nombre, (c.tareas || []).map(String)])), [costos]);

  // Las de Citrusvil (de los Excel y agregadas, con su unidad) y también las
  // que quedaron en alguna equivalencia aunque ya no estén en ningún lado.
  const unidadCitrusvil = useMemo(() => new Map(citrusvil.map((c) => [c.nombre, c.unidad])), [citrusvil]);
  const unidadNueva = useMemo(() => new Set(citrusvil.filter((c) => c.unidadNueva).map((c) => c.nombre)), [citrusvil]);
  const todasCitrusvil = useMemo(
    () =>
      [...new Set([...citrusvil.map((c) => c.nombre), ...tareasDeCitrusvil.keys(), ...costosDe.keys()])].sort(ordenar),
    [citrusvil, tareasDeCitrusvil, costosDe]
  );

  const abrirEditar = (t) => {
    const e = porTarea.get(String(t._id));
    setEditando(t);
    setTildadas(e?.citrusvil || []);
    setObservaciones(e?.observaciones || "");
  };
  const cerrar = () => {
    setEditando(null);
  };

  /**
   * Una de Citrusvil y una de La Martina solo son equivalentes si van en la
   * misma unidad (05/11/2026). Si no, avisa y devuelve false. Si a una le
   * falta la unidad, no se controla (el back hace lo mismo).
   */
  const mismaUnidad = (ctv, tareaLM) => {
    const uCtv = unidadCitrusvil.get(ctv);
    // Una unidad que no se reconoce (08/11/2026): primero hay que decir a
    // cuál de La Martina equivale, arriba. El back lo controla igual.
    if (unidadNueva.has(ctv)) {
      Swal.fire({
        icon: "warning",
        title: "Unidad nueva",
        text: `«${ctv}» va en «${uCtv}», una unidad nueva: primero decí a qué unidad de La Martina equivale, arriba en Unidades nuevas de Citrusvil.`,
        width: "340px",
        confirmButtonColor: "#1e293b",
      });
      return false;
    }
    const uLM = tareaLM?.unidad;
    if (!uCtv || !uLM || uCtv === uLM) return true;
    Swal.fire({
      icon: "warning",
      title: "No coinciden las unidades",
      text: `«${ctv}» va en ${uCtv} y ${tareaLM.tarea} en ${uLM}: con distinta unidad no puede ser equivalencia.`,
      width: "340px",
      confirmButtonColor: "#1e293b",
    });
    return false;
  };

  // Destildar siempre se puede; tildar, solo con la misma unidad.
  const tildar = (c) => {
    if (tildadas.includes(c)) return setTildadas((ant) => ant.filter((x) => x !== c));
    if (!mismaUnidad(c, editando)) return;
    setTildadas((ant) => [...ant, c]);
  };

  /**
   * El cambio se ve enseguida y se guarda por detrás: la base tarda segundos
   * en contestar. Si el back lo rechaza, avisa y vuelve a traer lo guardado,
   * así la pantalla nunca queda mostrando algo que no está.
   */
  const guardarPorDetras = (nuevas, llamada, error = "No se pudo guardar") => {
    setEquivalencias(nuevas);
    llamada().catch((err) => {
      Swal.fire({ icon: "error", title: error, text: err.message, width: "300px" });
      traer().catch(() => {});
    });
  };

  const guardar = (ev) => {
    ev.preventDefault();
    const tareaId = editando._id;
    const lista = [...tildadas];
    guardarPorDetras(conTareaLM(equivalencias, tareaId, lista, observaciones), () =>
      api.put(`/contable/equivalencias/${tareaId}`, { citrusvil: lista, observaciones })
    );
    setEditando(null);
    Swal.fire({ icon: "success", title: "Guardado", timer: 1500, showConfirmButton: false, width: "300px" });
  };

  const agregarCitrusvil = async (nombre, unidad) => {
    await api.post("/contable/tareas-citrusvil", { nombre, unidad });
    await traer();
  };
  const borrarCitrusvil = async (fila) => {
    await api.delete(`/contable/tareas-citrusvil/${fila.id}`);
    await traer();
  };

  /** Guarda a qué unidad de La Martina equivale una unidad nueva de Citrusvil. */
  const guardarUnidad = async (forma) => {
    const unidad = eleccionUnidad[forma];
    if (!unidad) return;
    setGuardandoUnidad(forma);
    try {
      await api.put("/contable/unidades", { forma, unidad });
      await traer();
      Swal.fire({ icon: "success", title: "Guardado", timer: 1500, showConfirmButton: false, width: "300px" });
    } catch (err) {
      Swal.fire({ icon: "error", title: "No se pudo guardar", text: err.message, width: "300px" });
    } finally {
      setGuardandoUnidad(null);
    }
  };
  /** La unidad vuelve a quedar sin equivalencia (se puede volver a cargar). */
  const sacarUnidad = async (u) => {
    setGuardandoUnidad(u.forma);
    try {
      await api.delete(`/contable/unidades/${u._id}`);
      await traer();
    } catch (err) {
      Swal.fire({ icon: "error", title: "No se pudo sacar", text: err.message, width: "300px" });
    } finally {
      setGuardandoUnidad(null);
    }
  };

  const filasCitrusvil = citrusvil.map((c) => ({
    clave: c.nombre,
    id: c._id,
    nombre: c.nombre,
    unidad: c.unidad,
    detalle: c.origen === "agregada" ? "agregada" : null,
    // Solo las agregadas a mano: las de los Excel salen de las tablas.
    borrable: c.origen === "agregada",
  }));

  const abrirEditarCtv = (c) => {
    setEditandoCtv(c);
    setElegidasLM(tareasDeCitrusvil.get(c) || []);
    setElegidasCostos(costosDe.get(c) || []);
    setDistintaCostos(costosDe.has(c));
  };
  const tildarCostos = (t) => {
    const id = String(t._id);
    if (elegidasCostos.includes(id)) return setElegidasCostos((ant) => ant.filter((x) => x !== id));
    if (!mismaUnidad(editandoCtv, t)) return;
    setElegidasCostos((ant) => [...ant, id]);
  };
  /**
   * La de costos se guarda aparte y solo si cambió. Se ve enseguida; si el
   * back la rechaza, avisa y vuelve a traer lo guardado.
   */
  const guardarCostos = (nombre, ids) => {
    const antes = costosDe.get(nombre) || [];
    if (antes.length === ids.length && antes.every((id) => ids.includes(id))) return;
    setCostos((ant) => [...ant.filter((c) => c.nombre !== nombre), ...(ids.length ? [{ nombre, tareas: ids }] : [])]);
    api.put("/contable/equivalencias-costos", { nombre, tareas: ids }).catch((err) => {
      Swal.fire({ icon: "error", title: "No se pudo guardar", text: err.message, width: "300px" });
      traer().catch(() => {});
    });
  };
  // Destildar siempre se puede; tildar, solo con la misma unidad.
  const tildarLM = (t) => {
    const id = String(t._id);
    if (elegidasLM.includes(id)) return setElegidasLM((ant) => ant.filter((x) => x !== id));
    if (!mismaUnidad(editandoCtv, t)) return;
    setElegidasLM((ant) => [...ant, id]);
  };
  const cerrarCtv = () => {
    setEditandoCtv(null);
  };
  const guardarCtv = (ev) => {
    ev.preventDefault();
    const nombre = editandoCtv;
    const ids = [...elegidasLM];
    guardarPorDetras(conTareaCtv(equivalencias, nombre, ids), () =>
      api.put("/contable/equivalencias-ctv", { nombre, tareas: ids })
    );
    // Sin tildar "distinta en costos", o sin ninguna elegida, va con la de siempre.
    guardarCostos(nombre, distintaCostos ? [...elegidasCostos] : []);
    setEditandoCtv(null);
    Swal.fire({ icon: "success", title: "Guardado", timer: 1500, showConfirmButton: false, width: "300px" });
  };
  const quitarCtv = async (c) => {
    const { isConfirmed } = await Swal.fire({
      icon: "warning",
      title: "¿Quitar la equivalencia?",
      text: `«${c}» queda sin tareas de La Martina (también la de costos). Esta acción no se puede deshacer.`,
      width: "320px",
      showCancelButton: true,
      confirmButtonText: "Sí, quitar",
      cancelButtonText: "Cancelar",
      confirmButtonColor: "#dc2626",
      cancelButtonColor: "#64748b",
    });
    if (!isConfirmed) return;
    guardarPorDetras(
      conTareaCtv(equivalencias, c, []),
      () => api.put("/contable/equivalencias-ctv", { nombre: c, tareas: [] }),
      "No se pudo quitar"
    );
    guardarCostos(c, []);
  };
  const unidadTarea = new Map(tareas.map((t) => [String(t._id), t.unidad]));

  /**
   * El Excel de la solapa abierta, con el formato de todo el proyecto
   * (helpers/excel.js): las mismas columnas que la pantalla, sin Acciones.
   * Las tareas de Citrusvil de cada fila van una por renglón.
   */
  const exportarExcel = async () => {
    const fecha = new Date().toISOString().slice(0, 10);
    try {
      if (solapa === "lm") {
        await exportarPlanilla({
          titulo: "Equivalencias de tareas — LM → Ctv",
          hoja: "LM → Ctv",
          archivo: `Equivalencias LM a Ctv ${fecha}.xlsx`,
          columnas: [
            { titulo: "#", ancho: 5 },
            { titulo: "Tarea La Martina", ancho: 38, negrita: true },
            { titulo: "Unidades", ancho: 12 },
            { titulo: "Tareas Citrusvil", ancho: 50 },
            { titulo: "Unidad Ctv", ancho: 12 },
            { titulo: "Observaciones", ancho: 40 },
          ],
          filas: tareas.map((t, i) => {
            const e = porTarea.get(String(t._id));
            const ctv = [...(e?.citrusvil || [])].sort(ordenar);
            return [
              i + 1,
              t.tarea,
              t.unidad || "",
              ctv.join("\n"),
              // La unidad de cada una, renglón por renglón como en pantalla.
              ctv.map((c) => unidadCitrusvil.get(c) || "—").join("\n"),
              e?.observaciones || "",
            ];
          }),
        });
      } else {
        await exportarPlanilla({
          titulo: "Equivalencias de tareas — Ctv → LM",
          hoja: "Ctv → LM",
          archivo: `Equivalencias Ctv a LM ${fecha}.xlsx`,
          columnas: [
            { titulo: "#", ancho: 5 },
            { titulo: "Tarea Citrusvil", ancho: 45, negrita: true },
            { titulo: "Unidades", ancho: 12 },
            { titulo: "Tarea La Martina", ancho: 38 },
            { titulo: "Unidad La Martina", ancho: 16 },
            { titulo: "Tarea LM en costos", ancho: 38 },
            { titulo: "Observaciones", ancho: 40 },
          ],
          filas: todasCitrusvil.map((c, i) => {
            const ids = tareasDeCitrusvil.get(c) || [];
            return [
              i + 1,
              c,
              unidadCitrusvil.get(c) || "",
              ids.map((id) => nombreTarea.get(id) || "Tarea borrada").join("\n"),
              ids.map((id) => unidadTarea.get(id) || "—").join("\n"),
              costosDe.has(c)
                ? costosDe.get(c).map((id) => nombreTarea.get(id) || "Tarea borrada").join("\n")
                : "La misma",
              ids.map((id) => porTarea.get(id)?.observaciones).filter(Boolean).join("\n"),
            ];
          }),
        });
      }
    } catch (err) {
      Swal.fire({ icon: "error", title: "No se pudo exportar", text: err.message, width: "300px" });
    }
  };

  const borrar = async (t) => {
    const { isConfirmed } = await Swal.fire({
      icon: "warning",
      title: "¿Borrar la equivalencia?",
      text: `Se sacan las tareas de Citrusvil y las observaciones de «${t.tarea}». Esta acción no se puede deshacer.`,
      width: "320px",
      showCancelButton: true,
      confirmButtonText: "Sí, borrar",
      cancelButtonText: "Cancelar",
      confirmButtonColor: "#dc2626",
      cancelButtonColor: "#64748b",
    });
    if (!isConfirmed) return;
    guardarPorDetras(
      equivalencias.filter((e) => String(e.tarea) !== String(t._id)),
      () => api.delete(`/contable/equivalencias/${t._id}`),
      "No se pudo borrar"
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
        overflow: "hidden",
      }}
    >
      <Container
        fluid
        className="px-4 py-3 d-flex flex-column flex-grow-1"
        style={{ maxWidth: "1100px", width: "100%", margin: "0 auto", minHeight: 0 }}
      >
        {/* Encabezado. El volver está en el navbar de Contable, arriba. */}
        <div className="d-flex align-items-center gap-3 mb-3 flex-wrap">
          <span className="fw-bold" style={{ color: "#164e63", fontSize: "1.05rem" }}>
            Equivalencias de tareas
          </span>
          {/* El Excel de la solapa abierta, arriba a la derecha como en el
              resto del proyecto. */}
          <Button
            size="sm"
            onClick={exportarExcel}
            disabled={cargando}
            className="rounded-3 px-3 d-flex align-items-center gap-2 ms-auto"
            style={{
              backgroundColor: "#15803d",
              borderColor: "#15803d",
              fontSize: "0.78rem",
              height: "30px",
              fontWeight: 600,
            }}
            title="Exportar la solapa abierta a Excel"
          >
            <i className="bi bi-file-earmark-excel-fill"></i>
            <span>Excel</span>
          </Button>
        </div>

        {/* Gasoil y dólar (07/11/2026): cada uno con su precio vigente, su
            fecha y su historial. */}
        <div
          className="d-flex flex-column gap-2 bg-white shadow-sm rounded-3 px-3 py-2 mb-3 flex-shrink-0 align-self-start"
          style={{ border: "1px solid #cbd5e1" }}
        >
          <PrecioConHistorial
            titulo="Gasoil"
            nombre="gasoil"
            icono="bi-fuel-pump-fill"
            ruta="/contable/gasoil"
            unidad="por litro"
            color={COLOR}
            sinEditar={sinEditar}
          />
          <PrecioConHistorial
            titulo="$/dólar"
            subtitulo="oficial, venta"
            nombre="dólar"
            icono="bi-currency-dollar"
            ruta="/contable/dolar"
            unidad="por dólar"
            color={COLOR}
            sinEditar={sinEditar}
          />
        </div>

        {/* Unidades de Citrusvil (08/11/2026): una unidad nueva del Excel se
            deja cargar y acá se dice a cuál de La Martina equivale. Hasta
            entonces esas tareas no se pueden unir. Las ya cargadas, abajo,
            con la cruz para sacarlas. */}
        {(unidades.nuevas.length > 0 || unidades.cargadas.length > 0) && (
          <div
            className="d-flex flex-column gap-2 bg-white shadow-sm rounded-3 px-3 py-2 mb-3 flex-shrink-0 align-self-start"
            style={{ border: `1px solid ${unidades.nuevas.length ? "#fcd34d" : "#cbd5e1"}`, maxWidth: "100%" }}
          >
            {unidades.nuevas.length > 0 && (
              <>
                <div className="d-flex align-items-center gap-2" style={{ fontSize: "0.8rem", color: "#92400e", fontWeight: 700 }}>
                  <i className="bi bi-exclamation-triangle-fill" style={{ color: "#d97706" }}></i>
                  Unidades nuevas de Citrusvil
                  <span className="fw-normal" style={{ color: "#64748b" }}>
                    · decí a qué unidad de La Martina equivale cada una
                  </span>
                </div>
                {unidades.nuevas.map((u) => (
                  <div key={u.forma} className="d-flex align-items-center gap-2 flex-wrap" style={{ fontSize: "0.78rem" }}>
                    <span className="fw-bold" style={{ color: COLOR, minWidth: "60px" }}>
                      {u.unidad}
                    </span>
                    <span style={{ color: "#94a3b8" }}>=</span>
                    <Form.Select
                      size="sm"
                      value={eleccionUnidad[u.forma] || ""}
                      onChange={(e) => setEleccionUnidad((ant) => ({ ...ant, [u.forma]: e.target.value }))}
                      disabled={sinEditar || guardandoUnidad === u.forma}
                      style={{ width: "130px", fontSize: "0.78rem" }}
                    >
                      <option value="">Elegí…</option>
                      {UNIDADES_LA_MARTINA.map((x) => (
                        <option key={x} value={x}>
                          {x}
                        </option>
                      ))}
                    </Form.Select>
                    <Button
                      size="sm"
                      onClick={() => guardarUnidad(u.forma)}
                      disabled={sinEditar || !eleccionUnidad[u.forma] || guardandoUnidad === u.forma}
                      style={{ backgroundColor: COLOR, borderColor: COLOR, fontSize: "0.74rem" }}
                    >
                      Guardar
                    </Button>
                    <span style={{ color: "#64748b", fontSize: "0.72rem" }}>
                      {u.tareas.slice(0, 3).join(", ")}
                      {u.tareas.length > 3 ? ` y ${u.tareas.length - 3} más` : ""}
                    </span>
                  </div>
                ))}
              </>
            )}
            {unidades.cargadas.length > 0 && (
              <div className="d-flex align-items-center gap-2 flex-wrap" style={{ fontSize: "0.74rem", color: "#475569" }}>
                <span className="fw-semibold" style={{ color: COLOR }}>
                  Unidades de Citrusvil cargadas:
                </span>
                {unidades.cargadas.map((u) => (
                  <span
                    key={u._id}
                    className="d-inline-flex align-items-center gap-1 px-2 rounded-pill"
                    style={{ backgroundColor: COLOR_SUAVE, border: "1px solid #a5f3fc" }}
                  >
                    {u.forma} = {u.unidad}
                    {!sinEditar && (
                      <button
                        type="button"
                        className="btn btn-link p-0"
                        onClick={() => sacarUnidad(u)}
                        disabled={guardandoUnidad === u.forma}
                        title="Sacar la equivalencia de esta unidad"
                        style={{ fontSize: "0.8rem", color: "#64748b", lineHeight: 1 }}
                      >
                        <i className="bi bi-x"></i>
                      </button>
                    )}
                  </span>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Las solapas, pegadas arriba de la tabla (como las de Ingresos de
            escaleras). */}
        <div className="d-flex align-items-end gap-1 flex-shrink-0" style={{ marginBottom: "-1px" }}>
          {SOLAPAS.map(([clave, rotulo, icono]) => {
            const activa = solapa === clave;
            const cantidad = clave === "lm" ? tareas.length : todasCitrusvil.length;
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
                <i className={`bi ${icono}`}></i>
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

          {/* A la altura de las solapas, a la derecha: el alta de las de
              Citrusvil (Ctv). Las de La Martina se dan de alta solo en
              Altas › Tareas. */}
          <div className="ms-auto d-flex align-items-center gap-2 mb-1">
            <button
              className="btn btn-sm d-flex align-items-center gap-2 px-3"
              style={{
                backgroundColor: "#0e7490",
                borderColor: "#0e7490",
                color: "#fff",
                fontSize: "0.78rem",
                height: "30px",
                fontWeight: 600,
              }}
              onClick={() => setVerCitrusvil(true)}
              disabled={cargando}
            >
              <i className="bi bi-plus-lg"></i>
              Agregar tarea Ctv
            </button>
          </div>
        </div>

        <div
          className="shadow-sm bg-white"
          style={{
            flex: "1 1 auto",
            minHeight: 0,
            width: "100%",
            overflowY: "auto",
            overflowX: "hidden",
            border: "1px solid #cbd5e1",
            borderRadius: "0 0.5rem 0.5rem 0.5rem",
          }}
        >
          {solapa === "lm" ? (
          <Table className="mb-0 tabla-informe" style={{ width: "100%" }}>
            <thead style={{ position: "sticky", top: 0, zIndex: 10, backgroundColor: "#164e63", color: "#fff" }}>
              <tr>
                <th style={{ ...th, width: "28px", textAlign: "center" }}>#</th>
                <th style={{ ...th, width: "26%" }}>Tarea La Martina</th>
                {/* La unidad de la tarea de La Martina (Altas › Tareas). */}
                <th style={{ ...th, width: "80px", textAlign: "center" }}>Unidades</th>
                <th style={th}>Tareas Citrusvil</th>
                {/* La unidad de cada tarea de Citrusvil, renglón por renglón. */}
                <th style={{ ...th, width: "80px", textAlign: "center" }}>Unidad Ctv</th>
                <th style={{ ...th, width: "26%" }}>Observaciones</th>
                <th style={{ ...th, width: "70px", textAlign: "center" }}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {cargando || !tareas.length ? (
                <tr>
                  <td colSpan={7} className="text-center text-muted py-4" style={td}>
                    {cargando ? "Cargando…" : "No hay tareas de La Martina cargadas (Altas › Tareas)"}
                  </td>
                </tr>
              ) : (
                tareas.map((t, i) => {
                  const e = porTarea.get(String(t._id));
                  const lista = [...(e?.citrusvil || [])].sort(ordenar);
                  return (
                    <tr key={t._id}>
                      <td style={{ ...td, textAlign: "center", color: "#64748b" }}>{i + 1}</td>
                      <td style={{ ...td, fontWeight: 600 }}>{t.tarea}</td>
                      <td style={{ ...td, textAlign: "center" }}>{t.unidad || raya}</td>
                      <td style={td}>
                        {lista.length
                          ? lista.map((c) => (
                              // En un renglón cada una, para que su unidad
                              // quede a la misma altura en la columna de al lado.
                              <div key={c} className="d-flex align-items-start gap-1" style={{ whiteSpace: "nowrap" }}>
                                <i className="bi bi-check2" style={{ color: "#0e7490" }}></i>
                                <span>{c}</span>
                              </div>
                            ))
                          : raya}
                      </td>
                      <td style={{ ...td, textAlign: "center" }}>
                        {lista.length
                          ? lista.map((c) => (
                              <div key={c} style={{ whiteSpace: "nowrap" }}>
                                {unidadCitrusvil.get(c) || raya}
                              </div>
                            ))
                          : raya}
                      </td>
                      <td style={{ ...td, whiteSpace: "pre-wrap" }}>{e?.observaciones || raya}</td>
                      <td style={td}>
                        <div className="d-flex justify-content-center align-items-center" style={{ gap: "10px" }}>
                          <button
                            onClick={() => abrirEditar(t)}
                            disabled={sinEditar}
                            className="btn btn-sm btn-outline-primary d-flex align-items-center justify-content-center rounded-2 p-0"
                            style={{ width: "24px", height: "24px" }}
                            title={sinEditar ? "Sin permiso para editar" : "Editar"}
                          >
                            <i className="bi bi-pencil" style={{ fontSize: "0.8rem" }}></i>
                          </button>
                          <button
                            onClick={() => borrar(t)}
                            disabled={sinEditar || !e}
                            className="btn btn-sm btn-outline-danger d-flex align-items-center justify-content-center rounded-2 p-0"
                            style={{ width: "24px", height: "24px" }}
                            title={sinEditar ? "Sin permiso para editar" : !e ? "No tiene equivalencia" : "Borrar"}
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
          ) : (
          // Ctv → LM: una fila por tarea de Citrusvil.
          <Table className="mb-0 tabla-informe" style={{ width: "100%" }}>
            <thead style={{ position: "sticky", top: 0, zIndex: 10, backgroundColor: "#164e63", color: "#fff" }}>
              <tr>
                <th style={{ ...th, width: "28px", textAlign: "center" }}>#</th>
                <th style={{ ...th, width: "30%" }}>Tarea Citrusvil</th>
                <th style={{ ...th, width: "80px", textAlign: "center" }}>Unidades</th>
                <th style={{ ...th, width: "24%" }}>Tarea La Martina</th>
                {/* La de la Comparativa de costos, si no es la misma (07/11/2026). */}
                <th style={{ ...th, width: "18%" }}>LM en costos</th>
                <th style={th}>Observaciones</th>
                <th style={{ ...th, width: "70px", textAlign: "center" }}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {cargando || !todasCitrusvil.length ? (
                <tr>
                  <td colSpan={7} className="text-center text-muted py-4" style={td}>
                    {cargando ? "Cargando…" : "Todavía no hay tareas de Citrusvil"}
                  </td>
                </tr>
              ) : (
                todasCitrusvil.map((c, i) => {
                  const ids = tareasDeCitrusvil.get(c) || [];
                  const unidadCtv = unidadCitrusvil.get(c);
                  const obs = ids.map((id) => porTarea.get(id)?.observaciones).filter(Boolean);
                  return (
                    <tr key={c}>
                      <td style={{ ...td, textAlign: "center", color: "#64748b" }}>{i + 1}</td>
                      <td style={{ ...td, fontWeight: 600 }}>{c}</td>
                      <td style={{ ...td, textAlign: "center" }}>{unidadCtv || raya}</td>
                      <td style={td}>
                        {/* Puede tener varias: una por renglón, con su unidad
                            (en rojo si no es la de Citrusvil, para revisarla). */}
                        {ids.length
                          ? ids.map((id) => {
                              const unidadLM = unidadTarea.get(id);
                              const otraUnidad = unidadCtv && unidadLM && unidadCtv !== unidadLM;
                              return (
                                <div key={id} className="d-flex align-items-start gap-1">
                                  <i className="bi bi-check2" style={{ color: "#0e7490" }}></i>
                                  <span>
                                    {nombreTarea.get(id) || "Tarea borrada"}
                                    {unidadLM && (
                                      <span
                                        className="ms-1"
                                        style={{ color: otraUnidad ? "#dc2626" : "#94a3b8", fontWeight: otraUnidad ? 700 : 400 }}
                                        title={otraUnidad ? "No es la misma unidad que la de Citrusvil" : undefined}
                                      >
                                        ({unidadLM})
                                      </span>
                                    )}
                                  </span>
                                </div>
                              );
                            })
                          : raya}
                      </td>
                      <td style={td}>
                        {costosDe.has(c) ? (
                          costosDe.get(c).map((id) => (
                            <div key={id} className="d-flex align-items-start gap-1">
                              <i className="bi bi-cash-stack" style={{ color: "#7c3aed" }}></i>
                              <span style={{ fontWeight: 600 }}>{nombreTarea.get(id) || "Tarea borrada"}</span>
                            </div>
                          ))
                        ) : (
                          <span style={{ color: "#94a3b8" }}>La misma</span>
                        )}
                      </td>
                      <td style={{ ...td, whiteSpace: "pre-wrap" }}>{obs.length ? obs.join("\n") : raya}</td>
                      <td style={td}>
                        <div className="d-flex justify-content-center align-items-center" style={{ gap: "10px" }}>
                          <button
                            onClick={() => abrirEditarCtv(c)}
                            disabled={sinEditar}
                            className="btn btn-sm btn-outline-primary d-flex align-items-center justify-content-center rounded-2 p-0"
                            style={{ width: "24px", height: "24px" }}
                            title={sinEditar ? "Sin permiso para editar" : "Editar"}
                          >
                            <i className="bi bi-pencil" style={{ fontSize: "0.8rem" }}></i>
                          </button>
                          <button
                            onClick={() => quitarCtv(c)}
                            disabled={sinEditar || (!ids.length && !costosDe.has(c))}
                            className="btn btn-sm btn-outline-danger d-flex align-items-center justify-content-center rounded-2 p-0"
                            style={{ width: "24px", height: "24px" }}
                            title={sinEditar ? "Sin permiso para editar" : !ids.length && !costosDe.has(c) ? "No tiene equivalencia" : "Borrar"}
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
          )}
        </div>
      </Container>

      {/* Editar: tildar las de Citrusvil que equivalen a esta tarea. */}
      <Modal
        show={Boolean(editando)}
        onHide={cerrar}
        centered
        contentClassName="border-0 shadow-lg rounded-4 overflow-visible"
      >
        <Modal.Header
          closeButton
          closeVariant="white"
          style={{
            backgroundColor: "#164e63",
            color: "#fff",
            borderTopLeftRadius: "1rem",
            borderTopRightRadius: "1rem",
            borderBottom: "1px solid rgba(255,255,255,0.1)",
          }}
        >
          <Modal.Title className="fs-6 fw-bold d-flex align-items-center gap-2 text-white">
            <i className="bi bi-arrow-left-right" style={{ color: "#67e8f9" }}></i>
            <span>{editando?.tarea}</span>
          </Modal.Title>
        </Modal.Header>
        <Form onSubmit={guardar}>
          <Modal.Body className="p-4">
            <Form.Label className="fw-semibold text-dark small mb-1">Tareas Citrusvil</Form.Label>
            {!todasCitrusvil.length ? (
              <div className="text-muted small mb-3">
                Todavía no hay tareas de Citrusvil: salen de las tablas mensuales de Contable.
              </div>
            ) : (
              <div
                className="rounded-3 border mb-3 px-2 py-1"
                style={{ maxHeight: "45vh", overflowY: "auto", fontSize: "0.8rem" }}
              >
                {todasCitrusvil.map((c) => {
                  // Ya no se bloquea: se avisa en qué otras tareas está.
                  const otras = (tareasDeCitrusvil.get(c) || []).filter((id) => id !== String(editando?._id));
                  return (
                    <Form.Check
                      key={c}
                      id={`citrusvil-${c}`}
                      type="checkbox"
                      className="my-1"
                      checked={tildadas.includes(c)}
                      onChange={() => tildar(c)}
                      label={
                        <span style={{ color: "#1e293b" }}>
                          {c}
                          {unidadCitrusvil.get(c) && (
                            <span className="ms-1" style={{ fontSize: "0.72rem", color: "#94a3b8" }}>
                              [{unidadCitrusvil.get(c)}]
                            </span>
                          )}
                          {otras.length > 0 && (
                            <span className="ms-1" style={{ fontSize: "0.72rem", color: "#0e7490" }}>
                              (también en {otras.map((id) => nombreTarea.get(id) || "otra tarea").join(", ")})
                            </span>
                          )}
                        </span>
                      }
                    />
                  );
                })}
              </div>
            )}

            <Form.Label className="fw-semibold text-dark small mb-1">Observaciones</Form.Label>
            <Form.Control
              as="textarea"
              rows={3}
              className="rounded-3"
              style={{ fontSize: "0.85rem" }}
              value={observaciones}
              onChange={(e) => setObservaciones(e.target.value)}
              maxLength={500}
            />
          </Modal.Body>
          <Modal.Footer
            className="bg-light border-0 py-2.5 px-4"
            style={{ borderBottomLeftRadius: "1rem", borderBottomRightRadius: "1rem" }}
          >
            <Button
              variant="outline-secondary"
              size="sm"
              onClick={cerrar}
             
              className="rounded-3 px-3 py-1.5"
              style={{ fontSize: "0.84rem" }}
            >
              Cancelar
            </Button>
            <Button
              variant="success"
              size="sm"
              type="submit"
             
              className="rounded-3 px-3.5 py-1.5 shadow-sm d-flex align-items-center gap-1.5"
              style={{ backgroundColor: "#15803d", borderColor: "#15803d", fontSize: "0.84rem", fontWeight: 600 }}
            >
              <i className="bi bi-check-lg"></i>
              <span>Guardar</span>
            </Button>
          </Modal.Footer>
        </Form>
      </Modal>

      {/* Ctv → LM: elegir con qué tarea de La Martina va esta de Citrusvil. */}
      <Modal show={Boolean(editandoCtv)} onHide={cerrarCtv} centered contentClassName="border-0 shadow-lg rounded-4 overflow-visible">
        <Modal.Header
          closeButton
          closeVariant="white"
          style={{
            backgroundColor: "#164e63",
            color: "#fff",
            borderTopLeftRadius: "1rem",
            borderTopRightRadius: "1rem",
            borderBottom: "1px solid rgba(255,255,255,0.1)",
          }}
        >
          <Modal.Title className="fs-6 fw-bold d-flex align-items-center gap-2 text-white">
            <i className="bi bi-arrow-left-right" style={{ color: "#67e8f9" }}></i>
            <span>{editandoCtv}</span>
          </Modal.Title>
        </Modal.Header>
        <Form onSubmit={guardarCtv}>
          <Modal.Body className="p-4" style={{ overflow: "visible" }}>
            <Form.Label className="fw-semibold text-dark small mb-1">
              Tareas La Martina
              {unidadCitrusvil.get(editandoCtv) && (
                <span className="ms-1 fw-normal" style={{ color: "#94a3b8" }}>
                  (la de Citrusvil va en {unidadCitrusvil.get(editandoCtv)})
                </span>
              )}
            </Form.Label>
            {/* Se pueden tildar varias (06/11/2026); con otra unidad, avisa.
                Con la lista de costos abierta, las dos más bajas: así Guardar
                sigue entrando en la pantalla. */}
            <div
              className="rounded-3 border px-2 py-1"
              style={{ maxHeight: distintaCostos ? "24vh" : "45vh", overflowY: "auto", fontSize: "0.8rem" }}
            >
              {tareas.map((t) => (
                <Form.Check
                  key={t._id}
                  id={`lm-${t._id}`}
                  type="checkbox"
                  className="my-1"
                  checked={elegidasLM.includes(String(t._id))}
                  onChange={() => tildarLM(t)}
                  label={
                    <span style={{ color: "#1e293b" }}>
                      {t.tarea}
                      {t.unidad && (
                        <span className="ms-1" style={{ fontSize: "0.72rem", color: "#94a3b8" }}>
                          [{t.unidad}]
                        </span>
                      )}
                    </span>
                  }
                />
              ))}
            </div>

            {/* La de la Comparativa de costos (07/11/2026): sin tildar, va con
                las mismas de arriba. */}
            <Form.Check
              type="switch"
              id="distinta-costos"
              className="mt-3 mb-1 small fw-semibold text-dark"
              checked={distintaCostos}
              onChange={(e) => setDistintaCostos(e.target.checked)}
              label="En la comparativa de costos va con otra tarea"
            />
            {distintaCostos && (
              <div
                className="rounded-3 border px-2 py-1"
                style={{ maxHeight: "24vh", overflowY: "auto", fontSize: "0.8rem", borderColor: "#c4b5fd" }}
              >
                {tareas.map((t) => (
                  <Form.Check
                    key={t._id}
                    id={`costos-${t._id}`}
                    type="checkbox"
                    className="my-1"
                    checked={elegidasCostos.includes(String(t._id))}
                    onChange={() => tildarCostos(t)}
                    label={
                      <span style={{ color: "#1e293b" }}>
                        {t.tarea}
                        {t.unidad && (
                          <span className="ms-1" style={{ fontSize: "0.72rem", color: "#94a3b8" }}>
                            [{t.unidad}]
                          </span>
                        )}
                      </span>
                    }
                  />
                ))}
              </div>
            )}
          </Modal.Body>
          <Modal.Footer
            className="bg-light border-0 py-2.5 px-4"
            style={{ borderBottomLeftRadius: "1rem", borderBottomRightRadius: "1rem" }}
          >
            <Button
              variant="outline-secondary"
              size="sm"
              onClick={cerrarCtv}
             
              className="rounded-3 px-3 py-1.5"
              style={{ fontSize: "0.84rem" }}
            >
              Cancelar
            </Button>
            <Button
              variant="success"
              size="sm"
              type="submit"
             
              className="rounded-3 px-3.5 py-1.5 shadow-sm d-flex align-items-center gap-1.5"
              style={{ backgroundColor: "#15803d", borderColor: "#15803d", fontSize: "0.84rem", fontWeight: 600 }}
            >
              <i className="bi bi-check-lg"></i>
              <span>Guardar</span>
            </Button>
          </Modal.Footer>
        </Form>
      </Modal>

      <ModalListaTareas
        show={verCitrusvil}
        onHide={() => setVerCitrusvil(false)}
        titulo="Tareas Citrusvil"
        etiqueta="Tarea Ctv"
        icono="bi bi-list-ul"
        filas={filasCitrusvil}
        unidades={UNIDADES_LA_MARTINA}
        puedeAgregar={!sinEditar}
        aviso="Las que vienen de los Excel mensuales aparecen solas. Las agregadas a mano se pueden borrar si no están en ninguna equivalencia."
        onAgregar={agregarCitrusvil}
        onBorrar={borrarCitrusvil}
      />
    </div>
  );
}

export default ContableEquivalencias;
