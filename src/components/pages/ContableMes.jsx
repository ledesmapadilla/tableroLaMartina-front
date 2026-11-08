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

/**
 * La tarjeta de un mes de Contable (05/11/2026): el paso de subir el Excel
 * mensual, antes de la tabla (ContableTabla.jsx).
 *
 * El Excel se lee en el navegador (utils/leerExcelContable.js) y solo se
 * guardan sus filas: el archivo no se sube a ningún lado, para no ocupar
 * lugar en Cloudinary. Una tabla no se pisa: si el mes ya tiene, para subir
 * otro Excel primero hay que borrarla (desde la tabla). El back lo controla
 * igual.
 *
 * `archivo` es el Excel que se guardó en Cloudinary el 05/11/2026, antes de
 * esto (octubre): se pasa a la tabla y se borra.
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

  const [archivo, setArchivo] = useState(null);
  const [tabla, setTabla] = useState(enMemoria?.filas.length ? enMemoria.tabla || {} : null);
  const [cargando, setCargando] = useState(!enMemoria);
  const [trabajando, setTrabajando] = useState(false);

  const rutaExcel = `/contable/excel/${anio}/${mes}`;
  const rutaFilas = `/contable/filas/${anio}/${mes}`;
  const rutaEstado = `/contable/estado/${anio}/${mes}`;
  const titulo = `${MESES[Number(mes) - 1] || ""} ${anio}`;
  const verTabla = () => navigate(`/contable/${anio}/${mes}/tabla`);
  const hayTabla = Boolean(tabla);

  // Un solo pedido y sin las filas: si hay tabla y si quedó un Excel viejo.
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
        setArchivo(datos?.archivo || null);
        setTabla(datos?.tabla || null);
      })
      .catch(() => {})
      .finally(() => vigente && setCargando(false));
    return () => {
      vigente = false;
    };
  }, [rutaEstado, rutaFilas, clave]);

  /** Avisa que la tabla quedó armada y entra a verla. */
  const listo = () => {
    Swal.fire({
      icon: "success",
      title: "Tabla armada",
      timer: 1500,
      showConfirmButton: false,
      width: "300px",
    });
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
      // Si no es la planilla, avisa y no se guarda nada.
      const leidas = await leerExcelContable(await file.arrayBuffer());
      await api.put(rutaFilas, { filas: leidas, origen: file.name });
      listo();
    } catch (err) {
      Swal.fire({ icon: "error", title: "No se pudo cargar", text: err.message, width: "300px" });
      setTrabajando(false);
    }
  };

  // El Excel de octubre, que quedó en Cloudinary: se baja, se lee igual que
  // al subirlo y se borra de ahí.
  const pasarATabla = async () => {
    if (!archivo?.url) return;
    setTrabajando(true);
    try {
      const res = await fetch(archivo.url);
      if (!res.ok) throw new Error("No se pudo bajar el Excel.");
      const leidas = await leerExcelContable(await res.arrayBuffer());
      await api.put(rutaFilas, { filas: leidas, origen: archivo.nombre });
      // Ya está en la tabla: el archivo sale de Cloudinary.
      await api.delete(rutaExcel).catch(() => {});
      listo();
    } catch (err) {
      Swal.fire({ icon: "error", title: "No se pudo leer", text: err.message, width: "300px" });
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
            ) : archivo ? (
              <>
                <span className="mb-1" style={{ fontSize: "0.8rem", color: "#64748b" }}>
                  «{archivo.nombre || "Excel del mes"}» todavía no pasó a la tabla.
                </span>
                <button
                  className="btn btn-sm d-flex align-items-center gap-2 px-3 mt-1"
                  style={boton}
                  onClick={pasarATabla}
                  disabled={!puedeEditar || trabajando}
                >
                  {icono("bi bi-table")}
                  Pasar el Excel a la tabla
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
