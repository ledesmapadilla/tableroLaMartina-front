import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Container, Spinner } from "react-bootstrap";
import Swal from "sweetalert2";
import { api } from "../../services/api";
import { usePermisos } from "../../context/permisos";
import { leerExcelContable } from "../../utils/leerExcelContable";
import { MESES, fechaHora, memoriaTablas } from "../../utils/contable";

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

  const boton = { backgroundColor: "#0e7490", borderColor: "#0e7490", color: "#fff", fontSize: "0.9rem" };
  // Las dos tarjetas del mes miden lo mismo.
  const tarjeta = {
    width: "100%",
    maxWidth: "380px",
    borderRadius: "20px",
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

        {/* Las dos tarjetas del mes: el Excel y la comparativa. */}
        <div className="flex-grow-1 d-flex align-items-center justify-content-center gap-4 flex-wrap">
          <div
            className="d-flex flex-column align-items-center text-center p-4 bg-white"
            style={{ ...tarjeta, alignSelf: "stretch" }}
          >
            <div
              className="mb-3 d-flex align-items-center justify-content-center"
              style={{ width: "66px", height: "66px", borderRadius: "18px", backgroundColor: "#ecfeff" }}
            >
              <i className="bi bi-file-earmark-excel-fill" style={{ fontSize: "2.1rem", color: "#15803d" }}></i>
            </div>

            <span className="fw-bold mb-3" style={{ color: "#164e63", fontSize: "1.1rem" }}>
              Excel mensual
            </span>

            {cargando ? (
              <Spinner animation="border" size="sm" style={{ color: "#0e7490" }} />
            ) : hayTabla ? (
              <>
                {/* Ya hay tabla: el único botón es para verla. Otro Excel
                    recién después de borrarla, desde la tabla: ahí este
                    botón vuelve a ser "Cargar Excel mensual". */}
                <span className="fw-semibold text-break" style={{ color: "#164e63", fontSize: "0.92rem" }}>
                  {tabla?.origen || "Excel del mes"}
                </span>
                <span className="mt-1" style={{ fontSize: "0.78rem", color: "#64748b" }}>
                  Armada {fechaHora(tabla?.fecha)}
                  {tabla?.cargadaPor ? ` por ${tabla.cargadaPor}` : ""}
                </span>
                <button className="btn d-flex align-items-center gap-2 px-4 mt-4" style={boton} onClick={verTabla}>
                  <i className="bi bi-table"></i>
                  Mostrar tabla
                </button>
              </>
            ) : archivo ? (
              <>
                <span className="mb-3" style={{ fontSize: "0.85rem", color: "#64748b" }}>
                  «{archivo.nombre || "Excel del mes"}» todavía no pasó a la tabla.
                </span>
                <button
                  className="btn d-flex align-items-center gap-2 px-4"
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
                <span className="mb-3" style={{ fontSize: "0.85rem", color: "#64748b" }}>
                  Todavía no se cargó el Excel de este mes.
                </span>
                <button
                  className="btn d-flex align-items-center gap-2 px-4 py-2"
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

          {/* La comparativa (05/11/2026): las tareas del mes juntadas por la
              tarea de La Martina que les toca (Equivalencias de tareas). Sale
              de la tabla: sin tabla no hay nada que comparar. */}
          <div
            className="d-flex flex-column align-items-center text-center p-4 bg-white"
            style={{ ...tarjeta, alignSelf: "stretch" }}
          >
            <div
              className="mb-3 d-flex align-items-center justify-content-center"
              style={{ width: "66px", height: "66px", borderRadius: "18px", backgroundColor: "#ecfeff" }}
            >
              <i className="bi bi-bar-chart-line-fill" style={{ fontSize: "2.1rem", color: "#0e7490" }}></i>
            </div>

            <span className="fw-bold mb-3" style={{ color: "#164e63", fontSize: "1.1rem" }}>
              Comparativa
            </span>

            <span className="mb-auto" style={{ fontSize: "0.85rem", color: "#64748b" }}>
              {hayTabla || cargando
                ? "Las tareas del mes agrupadas por tarea de La Martina."
                : "Primero hay que cargar el Excel del mes."}
            </span>
            <button
              className="btn d-flex align-items-center gap-2 px-4 mt-4"
              style={boton}
              onClick={() => navigate(`/contable/${anio}/${mes}/comparativa`)}
              disabled={cargando || !hayTabla}
            >
              <i className="bi bi-bar-chart-line"></i>
              Mostrar comparativa
            </button>
          </div>
        </div>
      </Container>
    </div>
  );
}

export default ContableMes;
