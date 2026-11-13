import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { Button, Container, Spinner, Table } from "react-bootstrap";
import Swal from "sweetalert2";
import { api } from "../../services/api";
import { CAMPOS_COMPARATIVA, MESES, TIPOS_COMPARATIVA, claveTarea } from "../../utils/contable";
import Error404 from "./Error404";
import { exportarPlanilla } from "../../helpers/excel";

/**
 * Evolución de las tarifas de Citrusvil (12/11/2026): una fila por tarea de
 * Ctv del campo, su unidad (con la nomenclatura de La Martina) y el precio
 * unitario de cada mes, de enero hasta el mes de la tarjeta desde la que se
 * entra. Cada mes lleva el porcentaje contra el mes anterior con precio:
 * verde si subió, rojo si bajó, gris si quedó igual.
 *
 * El precio del mes es el del Excel: subtotal / cantidad de esa tarea en el
 * campo (si vino con más de un precio, el ponderado). Sin multiplicar por la
 * doble pasada: la tarifa es la misma.
 */

const MES_CORTO = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
const ordenar = (a, b) => String(a).localeCompare(String(b), "es");
// Corto, para que entren todos los meses (12/11/2026): sin centavos desde
// $ 100 y sin espacio después del signo.
const pesos = (n) =>
  "$" + n.toLocaleString("es-AR", { minimumFractionDigits: 0, maximumFractionDigits: Math.abs(n) >= 100 ? 0 : 2 });
const porcentaje = (n) =>
  `${n > 0 ? "+" : ""}${n.toLocaleString("es-AR", { maximumFractionDigits: Math.abs(n) >= 10 ? 0 : 1 })}%`;

// Los tres estados de un mes contra el anterior.
const ESTADOS = {
  sube: { color: "#15803d", fondo: "#dcfce7", borde: "#bbf7d0", flecha: "bi-caret-up-fill", texto: "Subió" },
  baja: { color: "#b91c1c", fondo: "#fee2e2", borde: "#fecaca", flecha: "bi-caret-down-fill", texto: "Bajó" },
  igual: { color: "#64748b", fondo: "#f1f5f9", borde: "#e2e8f0", flecha: "bi-dash", texto: "Igual" },
};
const estadoDe = (cambio) => (cambio > 0.005 ? "sube" : cambio < -0.005 ? "baja" : "igual");

function ContableTarifasCtv({ tipo = "cantidad" }) {
  const { colores: col } = TIPOS_COMPARATIVA[tipo] || TIPOS_COMPARATIVA.cantidad;
  const { anio, mes, campo: campoId } = useParams();
  const campo = CAMPOS_COMPARATIVA.find((c) => c.id === campoId);
  // Hasta el mes de la tarjeta: desde marzo, enero a marzo.
  const hastaMes = Math.min(12, Math.max(0, Number(mes) || 0));

  // mes (1-12) → filas del Excel de ese mes, solo del campo.
  const [porMes, setPorMes] = useState(new Map());
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!campo) return undefined;
    let vigente = true;
    const meses = Array.from({ length: hastaMes }, (_, i) => i + 1);
    // Solo los Excel de los meses: cada fila ya trae su unidad en la
    // nomenclatura de La Martina (unidadLM).
    Promise.all(meses.map((m) => api.get(`/contable/filas/${anio}/${m}`).catch(() => null)))
      .then((lista) => {
        if (!vigente) return;
        const m = new Map();
        lista.forEach((d, i) => {
          const filas = (Array.isArray(d?.filas) ? d.filas : []).filter((f) =>
            campo.almacenes.includes(claveTarea(f.almacen))
          );
          if (filas.length) m.set(i + 1, filas);
        });
        setPorMes(m);
      })
      .catch((err) => vigente && setError(err.message))
      .finally(() => vigente && setCargando(false));
    return () => {
      vigente = false;
    };
  }, [anio, campo, hastaMes]);

  // Una fila por tarea de Ctv (por su clave: la misma escrita distinto es una).
  const filas = useMemo(() => {
    const t = new Map();
    for (const [m, lista] of porMes) {
      for (const f of lista) {
        const k = claveTarea(f.tarea);
        if (!k) continue;
        let a = t.get(k);
        if (!a) {
          a = { clave: k, tarea: f.tarea, unidad: f.unidadLM || f.unidad || "", meses: new Map() };
          t.set(k, a);
        }
        const s = a.meses.get(m) || { cantidad: 0, subtotal: 0 };
        s.cantidad += f.cantidad || 0;
        s.subtotal += f.subtotal || 0;
        a.meses.set(m, s);
      }
    }
    return [...t.values()]
      .map((a) => {
        // El precio de cada mes y cómo cambió respecto del anterior con precio.
        const precios = new Map();
        let anterior = null;
        for (let m = 1; m <= hastaMes; m++) {
          const s = a.meses.get(m);
          if (!s || !s.cantidad) continue;
          const precio = s.subtotal / s.cantidad;
          const cambio = anterior ? ((precio - anterior) / anterior) * 100 : null;
          precios.set(m, { precio, cambio });
          anterior = precio;
        }
        // El acumulado (12/11/2026): del precio de enero al del último mes que
        // se muestra. Si enero no tiene, desde el primero con precio; si el
        // último no tiene, hasta el último con precio.
        const conPrecio = [...precios.keys()].sort((x, y) => x - y);
        const desde = conPrecio[0];
        const hasta = conPrecio[conPrecio.length - 1];
        const acumulado =
          conPrecio.length > 1
            ? {
                desde,
                hasta,
                pesos: precios.get(hasta).precio - precios.get(desde).precio,
                cambio: ((precios.get(hasta).precio - precios.get(desde).precio) / precios.get(desde).precio) * 100,
              }
            : null;
        return { ...a, precios, acumulado };
      })
      .filter((a) => a.precios.size)
      .sort((a, b) => ordenar(a.tarea, b.tarea));
  }, [porMes, hastaMes]);

  if (!campo) return <Error404 />;
  const columnas = hastaMes + 3;
  const th = {
    backgroundColor: col.oscuro,
    color: "#fff",
    fontSize: "0.7rem",
    fontWeight: 600,
    verticalAlign: "middle",
    padding: "4px 6px",
    whiteSpace: "nowrap",
    letterSpacing: "0.2px",
  };
  // Celdas bajas, para que entren más tareas sin scroll (12/11/2026).
  const td = { fontSize: "0.7rem", padding: "2px 5px", verticalAlign: "middle", lineHeight: 1.25 };
  const raya = <span style={{ color: "#cbd5e1" }}>—</span>;
  const periodo = hastaMes > 1 ? `Enero a ${MESES[hastaMes - 1]} ${anio}` : `${MESES[hastaMes - 1] || ""} ${anio}`;

  /**
   * El Excel de la tabla, con el formato de todo el proyecto (helpers/excel.js):
   * la tarea, la unidad, el precio de cada mes, y el acumulado en pesos y en
   * porcentaje. El porcentaje de cada mes va en su columna, al lado del precio.
   */
  const exportarExcel = async () => {
    const meses = MES_CORTO.slice(0, hastaMes);
    try {
      await exportarPlanilla({
        titulo: `Evolución tarifas Ctv — ${campo.titulo} — ${periodo}`,
        hoja: "Tarifas Ctv",
        archivo: `Evolucion tarifas Ctv ${campo.titulo} ${anio}-${String(hastaMes).padStart(2, "0")}.xlsx`,
        columnas: [
          { titulo: "Tarea Ctv", ancho: 44, negrita: true },
          { titulo: "Unidad", ancho: 10 },
          ...meses.flatMap((m) => [
            { titulo: m, ancho: 13, moneda: true },
            { titulo: `${m} %`, ancho: 8 },
          ]),
          { titulo: "Acumulado $", ancho: 14, moneda: true },
          { titulo: "Acumulado %", ancho: 12 },
        ],
        filas: filas.map((f) => [
          f.tarea,
          f.unidad || "",
          ...meses.flatMap((_, i) => {
            const p = f.precios.get(i + 1);
            return [p ? p.precio : "", p && p.cambio !== null ? porcentaje(p.cambio) : ""];
          }),
          f.acumulado ? f.acumulado.pesos : "",
          f.acumulado ? porcentaje(f.acumulado.cambio) : "",
        ]),
      });
    } catch (err) {
      Swal.fire({ icon: "error", title: "No se pudo exportar", text: err.message, width: "300px" });
    }
  };

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", backgroundColor: "#f8f9fa", height: "100%", overflow: "hidden" }}>
      <Container
        fluid
        className="px-4 py-3 d-flex flex-column flex-grow-1"
        style={{ maxWidth: "1320px", width: "100%", margin: "0 auto", minHeight: 0 }}
      >
        {/* Encabezado: título y de qué es. El volver está en el navbar de
            Contable, arriba. */}
        <div
          className="d-flex align-items-center gap-3 flex-wrap bg-white rounded-4 shadow-sm px-3 py-2 mb-2"
          style={{ border: `1px solid ${col.borde}` }}
        >
          <div
            className="d-flex align-items-center justify-content-center flex-shrink-0"
            style={{ width: "34px", height: "34px", borderRadius: "10px", backgroundColor: col.claro }}
          >
            <i className="bi bi-graph-up-arrow" style={{ color: col.medio, fontSize: "1.25rem" }}></i>
          </div>
          <div className="d-flex flex-column" style={{ lineHeight: 1.25 }}>
            <span className="fw-bold" style={{ color: col.oscuro, fontSize: "1.08rem" }}>
              Evolución tarifas Ctv
            </span>
            <span style={{ fontSize: "0.78rem", color: "#64748b" }}>
              {campo.titulo} · {periodo} · precio unitario del Excel de cada mes
            </span>
          </div>
          <Button
            size="sm"
            onClick={exportarExcel}
            disabled={cargando || !filas.length}
            className="rounded-3 px-3 d-flex align-items-center gap-2 ms-auto"
            style={{
              backgroundColor: "#15803d",
              borderColor: "#15803d",
              fontSize: "0.78rem",
              height: "30px",
              fontWeight: 600,
            }}
            title="Exportar la tabla a Excel"
          >
            <i className="bi bi-file-earmark-excel-fill"></i>
            <span>Excel</span>
          </Button>
        </div>

        <div
          className="bg-white rounded-4 shadow-sm"
          style={{
            flex: "1 1 auto",
            minHeight: 0,
            width: "100%",
            overflowY: "auto",
            overflowX: "hidden",
            border: "1px solid #cbd5e1",
          }}
        >
          <Table className="mb-0 tabla-informe" style={{ width: "100%", tableLayout: "fixed" }}>
            <colgroup>
              <col style={{ width: "17%" }} />
              <col style={{ width: "56px" }} />
              {Array.from({ length: hastaMes }, (_, i) => (
                <col key={i} />
              ))}
              <col style={{ width: "92px" }} />
            </colgroup>
            <thead style={{ position: "sticky", top: 0, zIndex: 10, backgroundColor: col.oscuro, color: "#fff" }}>
              <tr>
                <th style={{ ...th, paddingLeft: "10px" }}>Tarea Ctv</th>
                <th style={{ ...th, textAlign: "center" }}>Unidad</th>
                {MES_CORTO.slice(0, hastaMes).map((m) => (
                  <th key={m} style={{ ...th, textAlign: "center" }}>
                    {m}
                  </th>
                ))}
                {/* De enero al último mes que se muestra (12/11/2026). */}
                <th
                  className="col-corte"
                  style={{ ...th, textAlign: "center" }}
                  title={`Diferencia entre el precio de ${MESES[hastaMes - 1] || "este mes"} y el de Enero`}
                >
                  Acumulado
                </th>
              </tr>
            </thead>
            <tbody>
              {cargando ? (
                <tr>
                  <td colSpan={columnas} className="text-center text-muted py-5" style={td}>
                    <Spinner animation="border" size="sm" style={{ color: col.medio }} />
                  </td>
                </tr>
              ) : error ? (
                <tr>
                  <td colSpan={columnas} className="text-center py-5" style={{ ...td, color: "#dc2626" }}>
                    No se pudo traer: {error}
                  </td>
                </tr>
              ) : !filas.length ? (
                <tr>
                  <td colSpan={columnas} className="text-center text-muted py-5" style={td}>
                    Ningún mes hasta {MESES[hastaMes - 1] || "este"} tiene Excel con tareas de {campo.titulo}
                  </td>
                </tr>
              ) : (
                filas.map((f) => (
                  <tr key={f.clave}>
                    <td style={{ ...td, paddingLeft: "10px", fontWeight: 600, color: "#1e293b" }}>{f.tarea}</td>
                    <td style={{ ...td, textAlign: "center" }}>
                      {/* Texto solo, sin recuadro: así no se sale de la columna. */}
                      {f.unidad ? <span style={{ color: "#475569" }}>{f.unidad}</span> : raya}
                    </td>
                    {Array.from({ length: hastaMes }, (_, i) => {
                      const p = f.precios.get(i + 1);
                      if (!p) {
                        return (
                          <td key={i} style={{ ...td, textAlign: "center" }}>
                            {raya}
                          </td>
                        );
                      }
                      const e = p.cambio === null ? null : ESTADOS[estadoDe(p.cambio)];
                      return (
                        <td
                          key={i}
                          style={{ ...td, textAlign: "center" }}
                          title={p.cambio === null ? "Primer mes con precio" : `${porcentaje(p.cambio)} respecto del mes anterior con precio`}
                        >
                          <div className="d-inline-flex flex-column align-items-center justify-content-center" style={{ gap: "1px", whiteSpace: "nowrap" }}>
                            <span style={{ fontWeight: 600, color: e && e !== ESTADOS.igual ? e.color : "#1e293b", whiteSpace: "nowrap" }}>
                              {pesos(p.precio)}
                            </span>
                            {/* El porcentaje, más chico, abajo del precio (12/11/2026). */}
                            {e && (
                              <span
                                className="d-inline-flex align-items-center rounded-pill"
                                style={{
                                  fontSize: "0.56rem",
                                  fontWeight: 700,
                                  color: e.color,
                                  backgroundColor: e.fondo,
                                  padding: "0 4px",
                                  whiteSpace: "nowrap",
                                  gap: "1px",
                                }}
                              >
                                <i className={`bi ${e.flecha}`} style={{ fontSize: "0.55rem" }}></i>
                                {porcentaje(p.cambio)}
                              </span>
                            )}
                          </div>
                        </td>
                      );
                    })}
                    <td
                      className="col-corte"
                      style={{ ...td, textAlign: "center" }}
                      title={
                        f.acumulado
                          ? `De ${MESES[f.acumulado.desde - 1]} a ${MESES[f.acumulado.hasta - 1]}: ${porcentaje(f.acumulado.cambio)}`
                          : "Hace falta más de un mes con precio"
                      }
                    >
                      {f.acumulado ? (
                        (() => {
                          const e = ESTADOS[estadoDe(f.acumulado.cambio)];
                          return (
                            <div className="d-inline-flex flex-column align-items-center justify-content-center" style={{ gap: "1px", whiteSpace: "nowrap" }}>
                              <span style={{ fontWeight: 700, color: e.color }}>
                                {f.acumulado.pesos > 0 ? "+" : f.acumulado.pesos < 0 ? "−" : ""}
                                {pesos(Math.abs(f.acumulado.pesos))}
                              </span>
                              <span
                                className="d-inline-flex align-items-center rounded-pill"
                                style={{ fontSize: "0.56rem", fontWeight: 700, color: e.color, backgroundColor: e.fondo, padding: "0 4px", gap: "1px" }}
                              >
                                <i className={`bi ${e.flecha}`} style={{ fontSize: "0.55rem" }}></i>
                                {porcentaje(f.acumulado.cambio)}
                              </span>
                            </div>
                          );
                        })()
                      ) : (
                        raya
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </Table>
        </div>
      </Container>
    </div>
  );
}

export default ContableTarifasCtv;
