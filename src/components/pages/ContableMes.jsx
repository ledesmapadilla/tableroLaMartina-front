import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Container, Spinner } from "react-bootstrap";
import Swal from "sweetalert2";
import { api } from "../../services/api";
import { usePermisos } from "../../context/permisos";
import { leerExcelContable } from "../../utils/leerExcelContable";
import { MESES, TIPOS_COMPARATIVA, fechaHora, memoriaTablas } from "../../utils/contable";

// Lo que acepta el botón. Se controla también al elegir, porque el selector
// de archivos deja cambiar el filtro a "Todos los archivos". La tabla sale
// solo de un .xlsx: exceljs no lee el .xls viejo.
const EXTENSIONES = [".xlsx", ".xlsm"];
const esExcel = (nombre = "") => EXTENSIONES.some((ext) => nombre.toLowerCase().endsWith(ext));

const escapar = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

// Los problemas que encontró la revisión del Excel, de lo más grave a lo menos.
const NIVELES = [
  { nivel: "error", titulo: "Sin esto no se puede armar la tabla", color: "#b91c1c", fondo: "#fef2f2", icono: "bi-x-octagon-fill" },
  { nivel: "aviso", titulo: "Afecta las cuentas o las comparativas", color: "#b45309", fondo: "#fffbeb", icono: "bi-exclamation-triangle-fill" },
  { nivel: "info", titulo: "Advertencias (no frenan la carga)", color: "#0e7490", fondo: "#ecfeff", icono: "bi-info-circle-fill" },
];
const FRENAN = new Set(["error", "aviso"]);

/** La lista de problemas agrupada por nivel, para el html de un Swal. */
const htmlProblemas = (problemas, nombre, pie) =>
  `<div style="text-align:left;font-size:0.82rem">` +
  (nombre ? `<div style="color:#64748b;margin-bottom:8px">${escapar(nombre)}</div>` : "") +
  NIVELES.map((n) => {
    const del = problemas.filter((p) => p.nivel === n.nivel);
    if (!del.length) return "";
    return (
      `<div style="background:${n.fondo};border-radius:10px;padding:8px 10px;margin-bottom:8px">` +
      `<div style="color:${n.color};font-weight:700;margin-bottom:4px"><i class="bi ${n.icono}"></i> ${n.titulo}</div>` +
      `<ul style="margin:0;padding-left:18px;color:#334155">` +
      del.map((p) => `<li style="margin-bottom:4px">${escapar(p.texto)}</li>`).join("") +
      `</ul></div>`
    );
  }).join("") +
  (pie ? `<div style="color:#334155;font-weight:600">${pie}</div>` : "") +
  `</div>`;

/**
 * Muestra lo que encontró la revisión del Excel (utils/leerExcelContable.js,
 * 08/11/2026). Lo que entra en las cuentas o las comparativas frena la carga:
 * se corrige el Excel y se vuelve a subir; el programa no arregla nada por su
 * cuenta (pedido del usuario). Las advertencias solas no frenan: se muestran
 * después de cargar (avisarDespues). → true si se puede cargar.
 */
const revisar = async ({ problemas }, nombre) => {
  if (!problemas.some((p) => FRENAN.has(p.nivel))) return true;
  await Swal.fire({
    icon: "error",
    title: "Hay que corregir el Excel",
    html: htmlProblemas(problemas, nombre, "Corregí el Excel y volvé a cargarlo. No se guardó nada."),
    width: "min(640px, 95vw)",
    confirmButtonText: "Entendido",
    confirmButtonColor: "#1e293b",
  });
  return false;
};

/**
 * Después de cargar: las advertencias, si hubo, y las unidades de Citrusvil
 * nuevas, que hay que decir a cuál de La Martina equivalen (08/11/2026).
 * → true si el usuario eligió ir a Equivalencias.
 */
const avisarDespues = async ({ problemas }, nombre) => {
  if (problemas.length) {
    await Swal.fire({
      icon: "warning",
      title: "Tabla armada, con advertencias",
      html: htmlProblemas(problemas, nombre, "Se cargó igual: nada de esto cambia las cuentas."),
      width: "min(640px, 95vw)",
      confirmButtonText: "Entendido",
      confirmButtonColor: "#1e293b",
    });
  }
  const unidades = await api.get("/contable/unidades").catch(() => null);
  const nuevas = Array.isArray(unidades?.nuevas) ? unidades.nuevas : [];
  if (!nuevas.length) return false;
  const lista = nuevas
    .map((u) => {
      const tareas = u.tareas.slice(0, 3).map((t) => `«${escapar(t)}»`).join(", ");
      return `<li style="margin-bottom:4px"><b>${escapar(u.unidad)}</b>${tareas ? ` — ${tareas}${u.tareas.length > 3 ? " y otras" : ""}` : ""}</li>`;
    })
    .join("");
  const { isConfirmed } = await Swal.fire({
    icon: "question",
    title: nuevas.length === 1 ? "Hay una unidad nueva" : "Hay unidades nuevas",
    html:
      `<div style="text-align:left;font-size:0.82rem">` +
      `<ul style="margin:0 0 8px;padding-left:18px;color:#334155">${lista}</ul>` +
      `<div style="color:#334155">Hay que decir a qué unidad de La Martina equivale${nuevas.length === 1 ? "" : " cada una"}: hasta entonces esas tareas no se pueden unir en Equivalencias.</div>` +
      `</div>`,
    width: "min(480px, 95vw)",
    showCancelButton: true,
    confirmButtonText: "Ir a Equivalencias",
    cancelButtonText: "Después",
    confirmButtonColor: "#1e293b",
    cancelButtonColor: "#64748b",
  });
  return isConfirmed;
};

/**
 * La tarjeta de un mes de Contable (05/11/2026): el paso de subir el Excel
 * mensual, antes de la tabla (ContableTabla.jsx).
 *
 * El Excel se lee en el navegador (utils/leerExcelContable.js) y solo se
 * guardan sus filas: el archivo no se sube a ningún lado, para no ocupar
 * lugar en Cloudinary. Una tabla no se pisa: si el mes ya tiene, para subir
 * otro Excel primero hay que borrarla (desde la tabla). El back lo controla
 * igual.
 */
function ContableMes() {
  const { anio, mes } = useParams();
  const navigate = useNavigate();
  const { puede } = usePermisos();
  const puedeEditar = puede("contable.excel", "editar");
  const input = useRef(null);

  // Si la tabla del mes ya se trajo, se sabe que existe sin esperar a la base.
  const clave = `${anio}/${mes}`;
  const enMemoria = memoriaTablas.get(clave);

  const [tabla, setTabla] = useState(enMemoria?.filas.length ? enMemoria.tabla || {} : null);
  const [cargando, setCargando] = useState(!enMemoria);
  const [trabajando, setTrabajando] = useState(false);

  const rutaFilas = `/contable/filas/${anio}/${mes}`;
  const rutaEstado = `/contable/estado/${anio}/${mes}`;
  const titulo = `${MESES[Number(mes) - 1] || ""} ${anio}`;
  const verTabla = () => navigate(`/contable/${anio}/${mes}/tabla`);
  const hayTabla = Boolean(tabla);

  // Un solo pedido y sin las filas: si hay tabla.
  // Antes traía la tabla entera solo para saber si existía (05/11/2026).
  useEffect(() => {
    let vigente = true;
    api
      .get(rutaEstado)
      .then((datos) => {
        if (datos?.tabla) {
          // Hay tabla: se va trayendo por detrás, así "Mostrar tabla" abre
          // enseguida en vez de esperar a la base.
          api
            .get(rutaFilas)
            .then((d) =>
              memoriaTablas.set(clave, { filas: Array.isArray(d?.filas) ? d.filas : [], tabla: d?.tabla || null })
            )
            .catch(() => {});
        } else {
          memoriaTablas.delete(clave);
        }
        if (!vigente) return;
        setTabla(datos?.tabla || null);
      })
      .catch(() => {})
      .finally(() => vigente && setCargando(false));
    return () => {
      vigente = false;
    };
  }, [rutaEstado, rutaFilas, clave]);

  /**
   * La tabla quedó armada: muestra las advertencias y las unidades nuevas, si
   * hay, y entra a verla (o a Equivalencias, si eligió cargar las unidades).
   */
  const listo = async (leido, nombre) => {
    const sinNada = !leido.problemas.length;
    if (sinNada) {
      Swal.fire({
        icon: "success",
        title: "Tabla armada",
        timer: 1500,
        showConfirmButton: false,
        width: "300px",
      });
    }
    if (await avisarDespues(leido, nombre)) return navigate("/contable/equivalencias");
    verTabla();
  };

  const alElegir = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // así se puede volver a elegir el mismo archivo
    if (!file) return;
    if (!esExcel(file.name)) {
      Swal.fire({
        icon: "warning",
        title: "No es un Excel",
        text: `Tiene que ser un archivo ${EXTENSIONES.join(" o ")}.`,
        width: "320px",
        confirmButtonColor: "#1e293b",
      });
      return;
    }
    setTrabajando(true);
    try {
      // Si encuentra problemas que frenan la carga los muestra y no se guarda
      // nada; las advertencias se muestran después de cargar.
      const leido = await leerExcelContable(await file.arrayBuffer());
      if (!(await revisar(leido, file.name))) {
        setTrabajando(false);
        return;
      }
      await api.put(rutaFilas, { filas: leido.filas, origen: file.name });
      await listo(leido, file.name);
    } catch (err) {
      Swal.fire({ icon: "error", title: "No se pudo cargar", text: err.message, width: "300px" });
      setTrabajando(false);
    }
  };

  const boton = { backgroundColor: "#0e7490", borderColor: "#0e7490", color: "#fff", fontSize: "0.82rem" };
  // Las tarjetas del mes miden lo mismo, y lo justo para su contenido
  // (06/11/2026: a la mitad del alto que tenían).
  const tarjeta = {
    width: "100%",
    maxWidth: "270px",
    borderRadius: "16px",
    border: "1px solid #cbd5e1",
    boxShadow: "0 8px 18px -6px rgba(0,0,0,0.15)",
  };
  const icono = (clase) => (trabajando ? <Spinner animation="border" size="sm" /> : <i className={clase}></i>);

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
        style={{ maxWidth: "940px", width: "100%", margin: "0 auto" }}
      >
        {/* Encabezado. El volver está en el navbar de Contable, arriba. */}
        <div className="d-flex align-items-center gap-2 mb-4">
          <span className="fw-bold" style={{ color: "#164e63", fontSize: "1.05rem" }}>
            Contable - {titulo}
          </span>
        </div>

        <input
          ref={input}
          type="file"
          accept={EXTENSIONES.join(",")}
          onChange={alElegir}
          style={{ display: "none" }}
        />

        {/* Las tarjetas del mes (07/11/2026): el Excel arriba, en el medio, y
            abajo las dos comparativas. */}
        <div className="flex-grow-1 d-flex align-items-center justify-content-center">
        <div className="d-flex flex-column align-items-center gap-4" style={{ width: "100%" }}>
          <div className="d-flex justify-content-center" style={{ width: "100%" }}>
          {/* Destacada (07/11/2026): es la que hay que cargar primero. Borde
              verde grueso, franja arriba, un poco más grande y más sombra. */}
          <div
            className="d-flex flex-column align-items-center text-center px-4 pb-3 bg-white overflow-hidden"
            style={{
              ...tarjeta,
              maxWidth: "320px",
              border: "2px solid #15803d",
              boxShadow: "0 12px 26px -8px rgba(21,128,61,0.35)",
            }}
          >
            <div className="mb-3" style={{ height: "6px", backgroundColor: "#15803d", alignSelf: "stretch", margin: "0 -1.5rem" }}></div>
            <div
              className="mb-2 d-flex align-items-center justify-content-center"
              style={{ width: "48px", height: "48px", borderRadius: "14px", backgroundColor: "#dcfce7" }}
            >
              <i className="bi bi-file-earmark-excel-fill" style={{ fontSize: "1.6rem", color: "#15803d" }}></i>
            </div>

            <span className="fw-bold mb-1" style={{ color: "#14532d", fontSize: "1.1rem" }}>
              Excel mensual
            </span>

            {cargando ? (
              <Spinner animation="border" size="sm" style={{ color: "#0e7490" }} />
            ) : hayTabla ? (
              <>
                {/* Ya hay tabla: el único botón es para verla. Otro Excel
                    recién después de borrarla, desde la tabla: ahí este
                    botón vuelve a ser "Cargar Excel mensual". */}
                <span className="fw-semibold text-break" style={{ color: "#164e63", fontSize: "0.85rem" }}>
                  {tabla?.origen || "Excel del mes"}
                </span>
                <span style={{ fontSize: "0.74rem", color: "#64748b" }}>
                  Armada {fechaHora(tabla?.fecha)}
                  {tabla?.cargadaPor ? ` por ${tabla.cargadaPor}` : ""}
                </span>
                <button className="btn btn-sm d-flex align-items-center gap-2 px-3 mt-2" style={boton} onClick={verTabla}>
                  <i className="bi bi-table"></i>
                  Mostrar tabla
                </button>
              </>
            ) : (
              <>
                <span className="mb-1" style={{ fontSize: "0.8rem", color: "#64748b" }}>
                  Todavía no se cargó el Excel de este mes.
                </span>
                <button
                  className="btn btn-sm d-flex align-items-center gap-2 px-3 mt-1"
                  style={boton}
                  onClick={() => input.current?.click()}
                  disabled={!puedeEditar || trabajando}
                >
                  {icono("bi bi-upload")}
                  Cargar Excel mensual
                </button>
              </>
            )}
          </div>
          </div>

          <div className="d-flex justify-content-center gap-4 flex-wrap" style={{ width: "100%" }}>
          {/* Las comparativas (05/11/2026): las tareas del mes juntadas por la
              tarea de La Martina que les toca (Equivalencias de tareas). Salen
              de la tabla: sin tabla no hay nada que comparar. Desde el
              07/11/2026 son dos, cantidad y costos; por ahora hacen lo mismo. */}
          {[
            // El texto de cada una (07/11/2026, pedido del usuario).
            [TIPOS_COMPARATIVA.cantidad, "bi-bar-chart-line", "Comparación de tareas con precios Citrusvil."],
            [TIPOS_COMPARATIVA.costos, "bi-cash-stack", "Comparación pagado vs. gastado."],
          ].map(([t, ico, texto]) => (
            <div
              key={t.ruta}
              className="d-flex flex-column align-items-center text-center px-4 py-3 bg-white"
              style={{ ...tarjeta, alignSelf: "stretch" }}
            >
              <div
                className="mb-2 d-flex align-items-center justify-content-center"
                style={{ width: "40px", height: "40px", borderRadius: "12px", backgroundColor: t.colores.claro }}
              >
                <i className={`bi ${ico}`} style={{ fontSize: "1.3rem", color: t.colores.medio }}></i>
              </div>

              <span className="fw-bold mb-1" style={{ color: t.colores.oscuro, fontSize: "1rem" }}>
                {t.titulo}
              </span>

              <span className="mb-auto" style={{ fontSize: "0.8rem", color: "#64748b" }}>
                {hayTabla || cargando ? texto : "Primero hay que cargar el Excel del mes."}
              </span>
              <button
                className="btn btn-sm d-flex align-items-center gap-2 px-3 mt-2"
                style={{ ...boton, backgroundColor: t.colores.medio, borderColor: t.colores.medio }}
                onClick={() => navigate(`/contable/${anio}/${mes}/${t.ruta}`)}
                disabled={cargando || !hayTabla}
              >
                <i className={`bi ${ico}`}></i>
                Mostrar comparativa
              </button>
            </div>
          ))}
          </div>
        </div>
        </div>
      </Container>
    </div>
  );
}

export default ContableMes;
