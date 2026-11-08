import { useEffect, useMemo, useRef, useState } from "react";
import Swal from "sweetalert2";
import { useNavigate } from "react-router-dom";
import { Container, Table, Button, Form, Card, Modal } from "react-bootstrap";
import { nuevoWorkbook } from "../../helpers/excel";
import SelectBuscador from "../shared/SelectBuscador";
import { usePermisos } from "../../context/permisos";
import { nombreEstablecimiento } from "../../utils/establecimientos";

/**
 * Jornalizados (02/11/2026): se entra con el botón rojo de la planilla de
 * carga de datos. Una fila por persona y día con el horario en dos tramos,
 * igual que la planilla de partes, y la tarea realizada escrita a mano. No va
 * a la certificación: es una tabla aparte de cada campo, con filtros y su
 * Excel. Lo carga el que puede editar la certificación.
 *
 * Obligatorios: fecha, personal, la tarea y al menos un tramo completo. Con
 * Provisorio se guarda con fecha y personal, con los mismos criterios de la
 * planilla de partes: con un día provisorio sin completar, a esa persona no se
 * le carga otro día (ni provisorio ni completo). El back controla lo mismo.
 */

const FORM_VACIO = {
  fecha: "",
  persona: "",
  horaIngreso: "",
  horaEgreso: "",
  horaIngreso2: "",
  horaEgreso2: "",
  tarea: "",
  provisorio: false,
  // Colchón de horas (08/11/2026), el mismo círculo de la planilla de partes:
  // cuenta las horas del total del día.
  colchonHs: false,
};

// El total de un jornalizado con Colch. Hs.: fondo amarillo y letra roja solo
// detrás del número, como en la planilla de partes.
const ESTILO_COLCHON = { color: "#dc2626", fontWeight: 700, backgroundColor: "#fef08a" };

// El rojo del botón que trae acá.
const ROJO = "#b91c1c";

const avisar = (opciones) =>
  Swal.fire({
    width: "330px",
    padding: "0.85rem",
    customClass: { popup: "swal-compacto" },
    ...opciones,
  });

const avisarProvisorioPendiente = (texto) =>
  avisar({ icon: "warning", title: "Hay un día provisorio sin completar", text: texto, confirmButtonColor: "#1e293b" });

const soloFecha = (iso) => (iso || "").slice(0, 10);

const hoyStr = () => {
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${dd}`;
};

const formatFecha = (iso) => {
  const [a, m, d] = soloFecha(iso).split("-");
  return d ? `${d}/${m}/${a}` : "—";
};

// Las mismas cuentas de la planilla de partes (y del backend): "HH:mm" a
// minutos, un tramo que cruza la medianoche y los dos tramos que no se pisan.
const aMinutos = (h) => {
  const m = /^(\d{1,2}):(\d{2})$/.exec((h || "").trim());
  if (!m) return null;
  const hs = Number(m[1]);
  const min = Number(m[2]);
  return hs > 23 || min > 59 ? null : hs * 60 + min;
};

const minutosDelTramo = (ingreso, egreso) => {
  const i = aMinutos(ingreso);
  const e = aMinutos(egreso);
  if (i === null || e === null) return 0;
  return e >= i ? e - i : 1440 - i + e;
};

const calcularHoras = (ingreso, egreso) =>
  Math.round((minutosDelTramo(ingreso, egreso) / 60) * 100) / 100;

const AVISO_SOLAPE = "El segundo tramo se pisa con el primero: la Entrada 2 tiene que ser posterior a la Salida 1";

const tramosSeSolapan = ({ horaIngreso, horaEgreso, horaIngreso2, horaEgreso2 }) => {
  const inicio1 = aMinutos(horaIngreso);
  const inicio2 = aMinutos(horaIngreso2);
  if (inicio1 === null || inicio2 === null) return false;
  const fin1 = aMinutos(horaEgreso);
  const cruzaMedianoche = fin1 !== null && fin1 < inicio1;
  if (!cruzaMedianoche && inicio2 < inicio1) return true;
  const despues = (inicio2 - inicio1 + 1440) % 1440;
  if (despues < minutosDelTramo(horaIngreso, horaEgreso)) return true;
  return despues + minutosDelTramo(horaIngreso2, horaEgreso2) > 1440;
};

// Al menos un tramo con entrada y salida.
const tieneTramoCompleto = (f) => Boolean((f.horaIngreso && f.horaEgreso) || (f.horaIngreso2 && f.horaEgreso2));

const nfHoras = new Intl.NumberFormat("es-AR", { maximumFractionDigits: 2 });

// El desplegable de filtro del resto del proyecto (ver formato-tablas.md):
// en rojo cuando está activo, con la cruz para limpiarlo.
const FiltroSelect = ({ etiqueta, ancho, valor, vacio, onChange, opciones }) => {
  const activo = valor !== vacio;
  return (
    <div className="d-flex align-items-center gap-1" style={{ minWidth: 0 }}>
      <span className="fw-bold text-dark small flex-shrink-0" style={{ fontSize: "0.75rem" }}>
        {etiqueta}:
      </span>
      <div className="d-flex align-items-center" style={{ width: ancho, minWidth: 0 }}>
        <div style={{ flex: "1 1 auto", minWidth: 0 }}>
          <SelectBuscador
            opciones={opciones.map(([id, texto]) => ({ valor: id, texto }))}
            valor={activo ? valor : ""}
            onChange={(v) => onChange(v || vacio)}
            vacio={vacio}
            placeholder={vacio}
            className={`rounded-3 ${activo ? "rounded-end-0 border-end-0 fw-bold filtro-activo" : ""}`}
            style={{
              fontSize: "0.82rem",
              height: "32px",
              padding: "3px 24px 3px 8px",
              color: activo ? "#dc2626" : "#1e293b",
              fontWeight: activo ? "700" : "normal",
            }}
          />
        </div>
        {activo && (
          <button
            className="btn btn-sm btn-outline-secondary border-start-0 rounded-start-0 d-flex align-items-center justify-content-center flex-shrink-0"
            type="button"
            onClick={() => onChange(vacio)}
            title={`Limpiar filtro ${etiqueta.toLowerCase()}`}
            style={{ padding: "0 6px", height: "32px" }}
          >
            <i className="bi bi-x" style={{ fontSize: "0.9rem" }}></i>
          </button>
        )}
      </div>
    </div>
  );
};

// Un filtro de fecha con el mismo formato: rojo si está puesto y la cruz al
// costado.
const FiltroFecha = ({ etiqueta, valor, onChange }) => (
  <div className="d-flex align-items-center gap-1" style={{ minWidth: 0 }}>
    <span className="fw-bold text-dark small flex-shrink-0" style={{ fontSize: "0.75rem" }}>
      {etiqueta}:
    </span>
    <div className="input-group input-group-sm" style={{ width: "140px", minWidth: 0 }}>
      <Form.Control
        type="date"
        value={valor}
        onChange={(e) => onChange(e.target.value)}
        className={`rounded-3 ${valor ? "rounded-end-0 border-end-0 fw-bold filtro-activo" : ""}`}
        style={{
          fontSize: "0.82rem",
          height: "32px",
          padding: "3px 8px",
          color: valor ? "#dc2626" : "#1e293b",
          fontWeight: valor ? "700" : "normal",
        }}
      />
      {valor && (
        <button
          className="btn btn-outline-secondary border-start-0 d-flex align-items-center justify-content-center"
          type="button"
          onClick={() => onChange("")}
          title={`Limpiar filtro ${etiqueta.toLowerCase()}`}
          style={{ padding: "0 6px", height: "32px" }}
        >
          <i className="bi bi-x" style={{ fontSize: "0.9rem" }}></i>
        </button>
      )}
    </div>
  </div>
);

const th = {
  backgroundColor: "#1b4332",
  color: "#fff",
  fontSize: "0.66rem",
  fontWeight: 600,
  verticalAlign: "middle",
  padding: "3px 5px",
  whiteSpace: "nowrap",
  textAlign: "center",
};
const td = { fontSize: "0.7rem", padding: "1px 5px", verticalAlign: "middle", textAlign: "center" };
const Raya = () => <span style={{ color: "#cbd5e1" }}>—</span>;

// La tarea entera, de solo lectura (formato-sweetalert.md, 4 bis).
const verTarea = (f) =>
  Swal.fire({
    title: "Tarea realizada",
    // Solo la tarea: el nombre y la fecha ya están en la fila.
    html: `<div style="text-align:left;white-space:pre-wrap;word-break:break-word"></div>`,
    width: "440px",
    confirmButtonText: "Cerrar",
    confirmButtonColor: "#1e293b",
    // El texto va con textContent: lo escribió una persona, no es html.
    didOpen: (popup) => {
      const caja = popup.querySelector(".swal2-html-container div:last-child");
      if (caja) caja.textContent = f.tarea || "";
    },
  });

// La planilla, o con `resumen` el resumen por personal (botón Resumen).
export default function ProduccionJornalizados({ establecimiento = "caspinchango", resumen = false }) {
  return resumen ? (
    <ResumenJornalizados establecimiento={establecimiento} />
  ) : (
    <PlanillaJornalizados establecimiento={establecimiento} />
  );
}

const redondear = (v) => Math.round((Number(v) || 0) * 100) / 100;
const MESES = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
// "2026-10" → "Octubre 2026".
const nombreMes = (clave) => {
  const [a, m] = clave.split("-");
  return `${MESES[Number(m) - 1] || m} ${a}`;
};
// Un jornal cada 8 horas trabajadas; lo que no llega a otro jornal queda
// como horas de más (02/11/2026).
const HS_JORNAL = 8;
const jornalesDe = (horas) => {
  const jornales = Math.floor((horas + 1e-9) / HS_JORNAL);
  return { jornales, resto: redondear(horas - jornales * HS_JORNAL) };
};
const comparar = (a, b) => String(a).localeCompare(String(b), "es", { sensitivity: "base" });

/**
 * Resumen por personal de los jornalizados (02/11/2026): igual que el
 * Resumen de la planilla de carga de datos (ProduccionInformeMes con
 * soloPersonal). Una fila por persona con días trabajados, promedio y total de
 * horas, la fila TOTAL, el "Ver" con sus días y el Excel. Filtra por fechas y
 * personal; sin fechas toma todo lo cargado en el campo.
 */
function ResumenJornalizados({ establecimiento }) {
  const campo = nombreEstablecimiento(establecimiento);
  const [jornales, setJornales] = useState([]);
  const [cargando, setCargando] = useState(true);
  // Mes ("2026-10") y quincena: la 1° va del 1 al 15 y la 2° del 16 al
  // último día del mes. Los dos llenan Desde y Hasta, que es lo que filtra:
  // así se puede correr una fecha a mano.
  const [mes, setMes] = useState("Todos");
  const [quincena, setQuincena] = useState("Todas");
  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState("");
  const [filtroPersona, setFiltroPersona] = useState("Todos");
  const [verPersona, setVerPersona] = useState(null);

  useEffect(() => {
    let vigente = true;
    fetch(`/api/jornalizados?establecimiento=${establecimiento}`)
      .then((res) => (res.ok ? res.json() : []))
      .catch(() => [])
      .then((lista) => {
        if (!vigente) return;
        setJornales(Array.isArray(lista) ? lista : []);
        setCargando(false);
      });
    return () => {
      vigente = false;
    };
  }, [establecimiento]);

  // Las opciones del filtro salen de todo lo cargado.
  const personas = useMemo(() => {
    const mapa = new Map();
    jornales.forEach((j) => j.persona?._id && mapa.set(j.persona._id, j.persona.apellidoNombre));
    return [...mapa.entries()].sort((a, b) => comparar(a[1], b[1]));
  }, [jornales]);

  // Los meses que tienen algo cargado, del más nuevo al más viejo.
  const meses = useMemo(() => {
    const claves = new Set(jornales.map((j) => soloFecha(j.fecha).slice(0, 7)).filter(Boolean));
    return [...claves].sort().reverse().map((k) => [k, nombreMes(k)]);
  }, [jornales]);

  // Elegir mes o quincena pone las fechas. Una quincena sin mes toma el mes
  // más nuevo que tenga algo cargado.
  const elegirPeriodo = (nuevoMes, nuevaQuincena) => {
    let m = nuevoMes;
    if (m === "Todos" && nuevaQuincena !== "Todas") m = meses[0]?.[0] || "Todos";
    setMes(m);
    setQuincena(m === "Todos" ? "Todas" : nuevaQuincena);
    if (m === "Todos") {
      setDesde("");
      setHasta("");
      return;
    }
    const [a, mm] = m.split("-").map(Number);
    const ultimo = new Date(a, mm, 0).getDate();
    const dia = (d) => `${m}-${String(d).padStart(2, "0")}`;
    setDesde(dia(nuevaQuincena === "2" ? 16 : 1));
    setHasta(dia(nuevaQuincena === "1" ? 15 : ultimo));
  };
  // Una fecha cambiada a mano ya no es el mes ni la quincena elegidos.
  const cambiarFecha = (setter) => (valor) => {
    setter(valor);
    setMes("Todos");
    setQuincena("Todas");
  };

  const filtrados = jornales.filter((j) => {
    const dia = soloFecha(j.fecha);
    if (desde && dia < desde) return false;
    if (hasta && dia > hasta) return false;
    if (filtroPersona !== "Todos" && j.persona?._id !== filtroPersona) return false;
    return true;
  });

  // Una fila por persona. Los días son fechas distintas, como en el resumen
  // de la carga de datos.
  const porPersona = new Map();
  for (const j of filtrados) {
    const id = j.persona?._id || "sin-persona";
    if (!porPersona.has(id)) {
      porPersona.set(id, { id, nombre: j.persona?.apellidoNombre || "(sin persona)", dias: new Set(), horas: 0, registros: [] });
    }
    const fila = porPersona.get(id);
    fila.dias.add(soloFecha(j.fecha));
    fila.horas += Number(j.totalHoras) || 0;
    fila.registros.push(j);
  }
  const filas = [...porPersona.values()]
    .map((f) => ({
      ...f,
      dias: f.dias.size,
      horas: redondear(f.horas),
      promedio: f.dias.size ? redondear(f.horas / f.dias.size) : 0,
      ...jornalesDe(f.horas),
    }))
    .sort((a, b) => comparar(a.nombre, b.nombre));
  const totales = {
    // Suma de los días de cada uno: dos personas el mismo día son dos.
    dias: filas.reduce((s, f) => s + f.dias, 0),
    horas: redondear(filas.reduce((s, f) => s + f.horas, 0)),
    // Los jornales de cada uno sumados, y aparte lo que le sobra a cada uno.
    jornales: filas.reduce((s, f) => s + f.jornales, 0),
    resto: redondear(filas.reduce((s, f) => s + f.resto, 0)),
  };
  const numero = (v) => nfHoras.format(v || 0);
  // "10 +7,5": los jornales completos y las horas que sobran.
  const textoJornales = (j, resto) => (resto ? `${j} +${numero(resto)}` : String(j));
  const celdaJornales = (j, resto, negrita = false) => (
    <td style={{ ...td, fontWeight: negrita ? 700 : 600, whiteSpace: "nowrap" }}>
      {j}
      {resto > 0 && (
        <span className="ms-1" style={{ color: "#b45309", fontWeight: 600 }} title={`${numero(resto)} hs más`}>
          +{numero(resto)}
        </span>
      )}
    </td>
  );
  const hayFiltro = Boolean(desde || hasta || filtroPersona !== "Todos");
  const textoPeriodo =
    desde || hasta
      ? `${desde ? formatFecha(desde) : "el principio"} al ${hasta ? formatFecha(hasta) : "hoy"}`
      : "todo lo cargado";

  const exportarExcel = async () => {
    const wb = await nuevoWorkbook();
    const ws = wb.addWorksheet("Resumen por personal");
    const columnas = ["Personal", "Días trabajados", "Jornales (8 hs)", "Prom. hs/día", "Total horas"];

    ws.mergeCells(1, 1, 1, columnas.length);
    const celdaTitulo = ws.getCell("A1");
    celdaTitulo.value = `RESUMEN POR PERSONAL - JORNALIZADOS - ${campo.toUpperCase()}`;
    celdaTitulo.font = { bold: true, size: 14, color: { argb: "FF000000" } };
    celdaTitulo.alignment = { horizontal: "center", vertical: "middle" };
    ws.getRow(1).height = 28;

    ws.mergeCells(2, 1, 2, columnas.length);
    const celdaPeriodo = ws.getCell("A2");
    celdaPeriodo.value = `Período: ${textoPeriodo}`;
    celdaPeriodo.font = { bold: true, size: 11 };
    ws.getRow(2).height = 18;
    ws.addRow([]);

    const filaEnc = ws.addRow(columnas);
    filaEnc.eachCell((cell) => {
      cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
      cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1B4332" } };
      cell.border = {
        top: { style: "thin", color: { argb: "FFA0A0A0" } },
        left: { style: "thin", color: { argb: "FFA0A0A0" } },
        bottom: { style: "medium", color: { argb: "FF808080" } },
        right: { style: "thin", color: { argb: "FFA0A0A0" } },
      };
    });
    ws.getRow(4).height = 20;

    const borde = { style: "thin", color: { argb: "FFE2E8F0" } };
    filas.forEach((f) => {
      const fila = ws.addRow([f.nombre, f.dias, textoJornales(f.jornales, f.resto), f.promedio, f.horas]);
      fila.eachCell({ includeEmpty: true }, (cell, col) => {
        cell.border = { top: borde, left: borde, bottom: borde, right: borde };
        cell.alignment = { horizontal: col === 1 ? "left" : "center", vertical: "middle" };
      });
    });

    const filaTotal = ws.addRow(["TOTAL", totales.dias, textoJornales(totales.jornales, totales.resto), "", totales.horas]);
    filaTotal.eachCell({ includeEmpty: true }, (cell, col) => {
      cell.font = { bold: true, color: { argb: "FF1B4332" } };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE8F5EE" } };
      cell.border = { top: { style: "medium", color: { argb: "FF1B4332" } }, left: borde, bottom: borde, right: borde };
      cell.alignment = { horizontal: col === 1 ? "left" : "center", vertical: "middle" };
    });

    ws.columns = [{ width: 30 }, { width: 14 }, { width: 14 }, { width: 14 }, { width: 14 }];

    const buffer = await wb.xlsx.writeBuffer();
    const blob = new Blob([buffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Resumen_jornalizados_${campo.replace(/\s+/g, "_")}.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const thIzq = { ...th, textAlign: "left" };
  const tdIzq = { ...td, textAlign: "left" };

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
      <Container fluid className="px-3 py-2 d-flex flex-column flex-grow-1" style={{ overflow: "hidden" }}>
        {/* Encabezado. El volver está en el navbar, arriba. */}
        <div className="d-flex align-items-center gap-2 mb-2 flex-wrap">
          <i className="bi bi-person-badge-fill" style={{ color: ROJO, fontSize: "1.05rem" }}></i>
          <span className="fw-bold" style={{ color: "#1b4332", fontSize: "1.05rem" }}>
            Resumen por personal - Jornalizados · {campo}
          </span>
          <span
            className="px-2 py-1 rounded-3"
            style={{ fontSize: "0.76rem", backgroundColor: "#e8f5ee", color: "#1b4332", fontWeight: 600 }}
          >
            {textoPeriodo}
          </span>
          <Button
            size="sm"
            onClick={exportarExcel}
            disabled={filas.length === 0}
            className="rounded-3 px-3 d-flex align-items-center gap-2 ms-auto"
            style={{ backgroundColor: "#15803d", borderColor: "#15803d", fontSize: "0.78rem", height: "30px", fontWeight: 600 }}
            title="Exportar el resumen a Excel"
          >
            <i className="bi bi-file-earmark-excel-fill"></i>
            <span>Excel</span>
          </Button>
        </div>

        {/* Filtros */}
        <Card className="mb-2 p-2 shadow-sm border-0 rounded-3 flex-shrink-0">
          <div className="d-flex align-items-center gap-3 flex-wrap">
            <FiltroSelect
              etiqueta="Mes"
              ancho="160px"
              valor={mes}
              vacio="Todos"
              onChange={(v) => elegirPeriodo(v, quincena)}
              opciones={meses}
            />
            <FiltroSelect
              etiqueta="Quincena"
              ancho="215px"
              valor={quincena}
              vacio="Todas"
              onChange={(v) => elegirPeriodo(mes, v)}
              opciones={[
                ["1", "1° (1 al 15)"],
                ["2", "2° (16 a fin de mes)"],
              ]}
            />
            <FiltroFecha etiqueta="Desde" valor={desde} onChange={cambiarFecha(setDesde)} />
            <FiltroFecha etiqueta="Hasta" valor={hasta} onChange={cambiarFecha(setHasta)} />
            {/* Personal un poco más separado: es otro tipo de filtro. */}
            <div className="ms-4" />
            <FiltroSelect
              etiqueta="Personal"
              ancho="190px"
              valor={filtroPersona}
              vacio="Todos"
              onChange={setFiltroPersona}
              opciones={personas}
            />
          </div>
        </Card>

        {/* Tabla */}
        <div className="flex-grow-1" style={{ overflow: "auto", minHeight: 0 }}>
          {/* Angosta (02/11/2026): son cuatro números por persona. */}
          <div
            className="bg-white rounded-3 shadow-sm"
            style={{ border: "1px solid #e2e8f0", overflow: "clip", maxWidth: "800px" }}
          >
            <Table className="mb-0 tabla-informe" style={{ width: "100%" }}>
              <thead style={{ position: "sticky", top: 0, zIndex: 2 }}>
                <tr>
                  <th style={{ ...thIzq, minWidth: "110px" }}>Personal</th>
                  <th style={th}>Días<br />trabajados</th>
                  <th style={th} title="Un jornal cada 8 hs; con + las horas que sobran">
                    Jornales<br />(8 hs)
                  </th>
                  <th style={th}>Prom.<br />hs/día</th>
                  <th style={th}>Total<br />horas</th>
                  <th style={{ ...th, width: "52px" }}></th>
                </tr>
              </thead>
              <tbody>
                {cargando || filas.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center text-muted py-4" style={td}>
                      {cargando
                        ? "Cargando…"
                        : hayFiltro
                          ? "Ningún jornalizado coincide con los filtros"
                          : "No hay jornalizados cargados"}
                    </td>
                  </tr>
                ) : (
                  <>
                    {filas.map((f) => (
                      <tr key={f.id}>
                        <td style={{ ...tdIzq, fontWeight: 500 }}>{f.nombre}</td>
                        <td style={td}>{f.dias}</td>
                        {celdaJornales(f.jornales, f.resto)}
                        <td style={td}>{numero(f.promedio)}</td>
                        <td style={{ ...td, fontWeight: 600 }}>{numero(f.horas)}</td>
                        <td style={td}>
                          <button
                            onClick={() => setVerPersona(f)}
                            className="btn btn-sm btn-outline-success rounded-3"
                            style={{ fontSize: "0.64rem", padding: "0 8px", height: "20px", fontWeight: 600 }}
                            title={`Ver los jornalizados de ${f.nombre}`}
                          >
                            Ver
                          </button>
                        </td>
                      </tr>
                    ))}
                    <tr className="fila-total">
                      <td style={{ ...tdIzq, fontWeight: 700, color: "#1b4332" }}>TOTAL</td>
                      <td style={{ ...td, fontWeight: 700 }}>{totales.dias}</td>
                      {celdaJornales(totales.jornales, totales.resto, true)}
                      <td style={td}></td>
                      <td style={{ ...td, fontWeight: 700 }}>{numero(totales.horas)}</td>
                      <td style={td}></td>
                    </tr>
                  </>
                )}
              </tbody>
            </Table>
          </div>
        </div>
      </Container>

      {/* Detalle de una persona: los días que arman su fila */}
      <Modal show={Boolean(verPersona)} onHide={() => setVerPersona(null)} size="xl" scrollable centered>
        <Modal.Header closeButton style={{ backgroundColor: "#1b4332", color: "#fff" }}>
          <Modal.Title style={{ fontSize: "1rem", fontWeight: 700 }}>
            {verPersona?.nombre} — Jornalizados · {campo}
          </Modal.Title>
        </Modal.Header>
        <Modal.Body style={{ backgroundColor: "#f8f9fa" }}>
          <div className="d-flex flex-wrap gap-2 mb-3">
            {[
              ["Días trabajados", verPersona?.dias ?? 0],
              ["Jornales (8 hs)", verPersona ? textoJornales(verPersona.jornales, verPersona.resto) : 0],
              ["Prom. hs/día", numero(verPersona?.promedio)],
              ["Total horas", numero(verPersona?.horas)],
            ].map(([etiqueta, valor]) => (
              <div
                key={etiqueta}
                className="px-3 py-2 rounded-3 bg-white"
                style={{ border: "1px solid #e2e8f0", minWidth: "130px" }}
              >
                <div style={{ fontSize: "0.7rem", color: "#64748b" }}>{etiqueta}</div>
                <div className="fw-bold" style={{ fontSize: "1.05rem", color: "#1b4332" }}>
                  {valor}
                </div>
              </div>
            ))}
          </div>
          <div className="bg-white rounded-3" style={{ border: "1px solid #e2e8f0", overflow: "clip" }}>
            <Table className="mb-0 tabla-informe">
              <thead style={{ position: "sticky", top: 0, zIndex: 2 }}>
                <tr>
                  {/* Las de números al mínimo y la tarea con todo el resto:
                      es lo que hay que poder leer. */}
                  {["Fecha", "Entrada 1", "Salida 1", "Entrada 2", "Salida 2", "Total hs"].map((c) => (
                    <th key={c} style={{ ...th, width: "1%", padding: "3px 6px" }}>
                      {c}
                    </th>
                  ))}
                  <th style={{ ...thIzq, width: "100%" }}>Tarea realizada</th>
                </tr>
              </thead>
              <tbody>
                {(verPersona?.registros || []).map((j) => (
                  <tr key={j._id} className={j.provisorio ? "fila-provisoria" : undefined}>
                    <td style={{ ...td, whiteSpace: "nowrap" }}>
                      {formatFecha(j.fecha)}
                      {j.provisorio && (
                        <i className="bi bi-hourglass-split ms-1" style={{ color: "#b45309" }} title="Provisorio"></i>
                      )}
                    </td>
                    <td style={td}>{j.horaIngreso || <Raya />}</td>
                    <td style={td}>{j.horaEgreso || <Raya />}</td>
                    <td style={td}>{j.horaIngreso2 || <Raya />}</td>
                    <td style={td}>{j.horaEgreso2 || <Raya />}</td>
                    <td style={{ ...td, fontWeight: 600 }}>{numero(j.totalHoras)}</td>
                    <td style={{ ...tdIzq, whiteSpace: "pre-wrap", wordBreak: "break-word", fontSize: "0.78rem", padding: "3px 8px" }}>
                      {j.tarea || <Raya />}
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </div>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="outline-secondary" size="sm" onClick={() => setVerPersona(null)}>
            Cerrar
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
}

function PlanillaJornalizados({ establecimiento }) {
  const { puede } = usePermisos();
  const navigate = useNavigate();
  const editable = puede("produccion.certificacion", "editar");
  const campo = nombreEstablecimiento(establecimiento);

  const [filas, setFilas] = useState([]);
  const [personal, setPersonal] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [form, setForm] = useState(FORM_VACIO);
  const [editando, setEditando] = useState(null);
  const [guardando, setGuardando] = useState(false);
  const refPersona = useRef(null);

  // Filtros.
  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState("");
  const [filtroPersona, setFiltroPersona] = useState("Todos");
  const [soloProvisorios, setSoloProvisorios] = useState(false);

  useEffect(() => {
    let vigente = true;
    const pedir = async (url) => {
      try {
        const res = await fetch(url);
        const data = res.ok ? await res.json() : [];
        return Array.isArray(data) ? data : [];
      } catch {
        return [];
      }
    };
    Promise.all([pedir(`/api/jornalizados?establecimiento=${establecimiento}`), pedir("/api/personal")]).then(
      ([lista, personas]) => {
        if (!vigente) return;
        setFilas(lista);
        // "Uso interno" no es una persona: no trabaja jornales.
        setPersonal(personas.filter((p) => !p.usoInterno));
        setCargando(false);
      }
    );
    return () => {
      vigente = false;
    };
  }, [establecimiento]);

  const opcionesPersonal = useMemo(
    () =>
      [...personal]
        .sort((a, b) => a.apellidoNombre.localeCompare(b.apellidoNombre, "es", { sensitivity: "base" }))
        .map((p) => ({ valor: p._id, texto: p.apellidoNombre })),
    [personal]
  );

  // Las opciones del filtro salen de todo lo cargado, no de lo filtrado.
  const personasCargadas = useMemo(() => {
    const mapa = new Map();
    filas.forEach((f) => f.persona?._id && mapa.set(f.persona._id, f.persona.apellidoNombre));
    return [...mapa.entries()].sort((a, b) => a[1].localeCompare(b[1], "es", { sensitivity: "base" }));
  }, [filas]);

  const cantidadProvisorios = filas.filter((f) => f.provisorio).length;
  // Lo más nuevo arriba y, dentro del mismo día, por apellido (no por orden de carga).
  const filtradas = filas
    .filter((f) => {
      const dia = soloFecha(f.fecha);
      if (desde && dia < desde) return false;
      if (hasta && dia > hasta) return false;
      if (filtroPersona !== "Todos" && f.persona?._id !== filtroPersona) return false;
      if (soloProvisorios && !f.provisorio) return false;
      return true;
    })
    .sort(
      (a, b) =>
        soloFecha(b.fecha).localeCompare(soloFecha(a.fecha)) ||
        (a.persona?.apellidoNombre || "").localeCompare(b.persona?.apellidoNombre || "", "es", { sensitivity: "base" })
    );
  const hayFiltro = Boolean(desde || hasta || soloProvisorios || filtroPersona !== "Todos");
  const totalHoras = Math.round(filtradas.reduce((s, f) => s + (f.totalHoras || 0), 0) * 100) / 100;


  const cambiar = (campoForm, valor) => setForm((f) => ({ ...f, [campoForm]: valor }));
  const seSolapan = !form.provisorio && tramosSeSolapan(form);
  const totalForm = calcularHoras(form.horaIngreso, form.horaEgreso) + calcularHoras(form.horaIngreso2, form.horaEgreso2);

  /**
   * El otro día que esa persona dejó en provisorio, entre lo que está en
   * pantalla (que es todo lo del campo). Igual que en la planilla de partes.
   */
  const diaProvisorioPendiente = (persona, fecha) => {
    const dia = soloFecha(fecha);
    if (!persona || !dia) return null;
    const otro = filas.find(
      (f) => f.provisorio && f._id !== editando && (f.persona?._id || f.persona) === persona && soloFecha(f.fecha) !== dia
    );
    return otro ? soloFecha(otro.fecha) : null;
  };
  const textoPendiente = (dia) =>
    `Esta persona tiene un jornalizado provisorio del ${formatFecha(dia)}. ` +
    "Hay que completarlo con los datos reales antes de cargarle otro día.";

  const alternarProvisorio = () => {
    if (!form.provisorio) {
      const pendiente = diaProvisorioPendiente(form.persona, form.fecha);
      if (pendiente) {
        avisarProvisorioPendiente(textoPendiente(pendiente));
        return;
      }
    }
    cambiar("provisorio", !form.provisorio);
  };

  const limpiarForm = () => {
    // La fecha queda: se cargan varias personas del mismo día. Provisorio se
    // apaga solo, como en la planilla.
    setForm((f) => ({ ...FORM_VACIO, fecha: editando ? "" : f.fecha }));
    setEditando(null);
    refPersona.current?.focus();
  };

  const ubicar = (fila) =>
    setFilas((actuales) =>
      [...actuales.filter((x) => x._id !== fila._id), fila].sort(
        (a, b) =>
          soloFecha(a.fecha).localeCompare(soloFecha(b.fecha)) ||
          String(a.createdAt || "").localeCompare(String(b.createdAt || ""))
      )
    );

  const guardar = async () => {
    if (guardando || !editable) return;
    // Los mismos obligatorios que valida el back. Un provisorio solo pide
    // fecha y personal.
    const falta = [!form.fecha && "la fecha", !form.persona && "el personal"];
    if (!form.provisorio) {
      falta.push(!tieneTramoCompleto(form) && "un horario completo (entrada y salida)");
      falta.push(!form.tarea.trim() && "la tarea realizada");
    } else if (form.colchonHs) {
      // Con Colch. Hs. la tarea realizada va siempre (08/11/2026).
      falta.push(!form.tarea.trim() && "la tarea realizada (con Colch. Hs. es obligatoria)");
    }
    const faltan = falta.filter(Boolean);
    if (faltan.length) {
      avisar({ icon: "warning", title: "Faltan datos", text: `Complete ${faltan.join(", ")}.`, confirmButtonColor: "#1e293b" });
      return;
    }
    if (seSolapan) {
      avisar({ icon: "warning", title: "Los tramos se pisan", text: AVISO_SOLAPE, confirmButtonColor: "#1e293b" });
      return;
    }

    // Con un día en provisorio no se le carga otro. Corregir uno completo de
    // otro día sin cambiarle la fecha ni la persona sí se deja.
    const anterior = editando ? filas.find((f) => f._id === editando) : null;
    const cargaOtroDia =
      form.provisorio ||
      !anterior ||
      soloFecha(anterior.fecha) !== form.fecha ||
      (anterior.persona?._id || anterior.persona) !== form.persona;
    const pendiente = cargaOtroDia ? diaProvisorioPendiente(form.persona, form.fecha) : null;
    if (pendiente) {
      avisarProvisorioPendiente(textoPendiente(pendiente));
      return;
    }

    setGuardando(true);
    try {
      const res = await fetch(editando ? `/api/jornalizados/${editando}` : "/api/jornalizados", {
        method: editando ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, establecimiento }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (data.motivo === "PROVISORIO_PENDIENTE") avisarProvisorioPendiente(data.error);
        else avisar({ icon: "error", title: "No se pudo guardar", text: data.error || "Error al guardar" });
        return;
      }
      ubicar(data);
      limpiarForm();
      avisar({
        icon: "success",
        title: data.provisorio ? "Provisorio guardado" : "Guardado",
        timer: 1400,
        showConfirmButton: false,
        width: "300px",
      });
    } catch {
      avisar({ icon: "error", title: "Sin conexión", text: "No se pudo guardar" });
    } finally {
      setGuardando(false);
    }
  };

  // Enter guarda, salvo en la tarea realizada, donde baja de renglón.
  const alPresionarEnter = (e) => {
    if (e.key === "Enter" && e.target.tagName !== "TEXTAREA") {
      e.preventDefault();
      guardar();
    }
  };

  const editar = (f) => {
    setEditando(f._id);
    setForm({
      fecha: soloFecha(f.fecha),
      persona: f.persona?._id || "",
      horaIngreso: f.horaIngreso || "",
      horaEgreso: f.horaEgreso || "",
      horaIngreso2: f.horaIngreso2 || "",
      horaEgreso2: f.horaEgreso2 || "",
      tarea: f.tarea || "",
      // Sigue en provisorio hasta que se apague el botón.
      provisorio: Boolean(f.provisorio),
      colchonHs: Boolean(f.colchonHs),
    });
    refPersona.current?.focus();
  };

  const eliminar = async (f) => {
    const { isConfirmed } = await Swal.fire({
      icon: "warning",
      title: "¿Eliminar el jornalizado?",
      text: `${f.persona?.apellidoNombre || ""} — ${formatFecha(f.fecha)}`,
      width: "320px",
      showCancelButton: true,
      confirmButtonText: "Sí, eliminar",
      cancelButtonText: "Cancelar",
      confirmButtonColor: "#dc2626",
      cancelButtonColor: "#64748b",
    });
    if (!isConfirmed) return;
    try {
      const res = await fetch(`/api/jornalizados/${f._id}`, { method: "DELETE" });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        avisar({ icon: "error", title: "No se pudo eliminar", text: err.error || "Error al eliminar" });
        return;
      }
      setFilas((actuales) => actuales.filter((x) => x._id !== f._id));
      if (editando === f._id) limpiarForm();
    } catch {
      avisar({ icon: "error", title: "Sin conexión", text: "No se pudo eliminar" });
    }
  };

  // ── Excel: lo que se está viendo, con los filtros puestos ──
  const exportarExcel = async () => {
    const wb = await nuevoWorkbook();
    const ws = wb.addWorksheet("Jornalizados");
    const columnas = ["Fecha", "Personal", "Entrada 1", "Salida 1", "Entrada 2", "Salida 2", "Total hs", "Tarea realizada"];

    ws.mergeCells(1, 1, 1, columnas.length);
    const celdaTitulo = ws.getCell("A1");
    celdaTitulo.value = `JORNALIZADOS - ${campo.toUpperCase()}`;
    celdaTitulo.font = { bold: true, size: 14, color: { argb: "FF000000" } };
    celdaTitulo.alignment = { horizontal: "center", vertical: "middle" };
    ws.getRow(1).height = 28;

    ws.mergeCells(2, 1, 2, 6);
    const celdaPeriodo = ws.getCell("A2");
    celdaPeriodo.value =
      desde || hasta
        ? `Período: ${desde ? formatFecha(desde) : "el principio"} al ${hasta ? formatFecha(hasta) : "hoy"}`
        : "Período: todo lo cargado";
    celdaPeriodo.font = { bold: true, size: 11 };
    ws.getRow(2).height = 18;
    ws.addRow([]);

    const filaEnc = ws.addRow(columnas);
    filaEnc.eachCell((cell) => {
      cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
      cell.alignment = { horizontal: "center", vertical: "middle" };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1B4332" } };
      cell.border = {
        top: { style: "thin", color: { argb: "FFA0A0A0" } },
        left: { style: "thin", color: { argb: "FFA0A0A0" } },
        bottom: { style: "medium", color: { argb: "FF808080" } },
        right: { style: "thin", color: { argb: "FFA0A0A0" } },
      };
    });
    ws.getRow(4).height = 20;

    const borde = { style: "thin", color: { argb: "FFE2E8F0" } };
    filtradas.forEach((f) => {
      const fila = ws.addRow([
        formatFecha(f.fecha) + (f.provisorio ? " (provisorio)" : ""),
        f.persona?.apellidoNombre || "-",
        f.horaIngreso || "-",
        f.horaEgreso || "-",
        f.horaIngreso2 || "-",
        f.horaEgreso2 || "-",
        f.totalHoras || 0,
        f.tarea || "-",
      ]);
      fila.eachCell({ includeEmpty: true }, (cell, col) => {
        cell.border = { top: borde, left: borde, bottom: borde, right: borde };
        cell.alignment =
          col === 2 || col === 8
            ? { horizontal: "left", vertical: "top", wrapText: true }
            : { horizontal: "center", vertical: "top" };
        if (f.provisorio) cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFEF3C7" } };
      });
    });

    const filaTotal = ws.addRow(["TOTAL", "", "", "", "", "", totalHoras, ""]);
    filaTotal.eachCell({ includeEmpty: true }, (cell, col) => {
      cell.font = { bold: true, color: { argb: "FF1B4332" } };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE8F5EE" } };
      cell.border = { top: { style: "medium", color: { argb: "FF1B4332" } }, left: borde, bottom: borde, right: borde };
      cell.alignment = { horizontal: col === 1 ? "left" : "center", vertical: "middle" };
    });

    ws.columns = [
      { width: 14 },
      { width: 26 },
      { width: 10 },
      { width: 10 },
      { width: 10 },
      { width: 10 },
      { width: 10 },
      { width: 70 },
    ];

    const buffer = await wb.xlsx.writeBuffer();
    const blob = new Blob([buffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Jornalizados_${campo.replace(/\s+/g, "_")}.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const estiloCelda = { fontSize: "0.78rem", height: "30px", padding: "2px 6px" };
  const estiloCeldaPisada = { ...estiloCelda, borderColor: "#dc2626", color: "#dc2626" };
  const obligatorio = !form.provisorio && <span className="text-danger">*</span>;
  const rotulo = (texto, rojo = false) => (
    <label className={rojo ? "text-danger d-block fw-semibold" : "text-muted d-block"} style={{ fontSize: "0.7rem" }}>
      {texto}
    </label>
  );
  const hora = (campoForm, texto, pisada = false) => (
    <div style={{ width: "78px" }}>
      {rotulo(texto, pisada && campoForm === "horaIngreso2")}
      <Form.Control
        type="time"
        value={form[campoForm]}
        onChange={(e) => cambiar(campoForm, e.target.value)}
        style={pisada ? estiloCeldaPisada : estiloCelda}
        title={pisada ? AVISO_SOLAPE : "Al menos un tramo con entrada y salida"}
      />
    </div>
  );

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
      <Container fluid className="px-3 py-2 d-flex flex-column flex-grow-1" style={{ overflow: "hidden" }}>
        {/* Encabezado. El volver está en el navbar, arriba. */}
        <div className="d-flex align-items-center gap-2 mb-2 flex-wrap">
          <i className="bi bi-person-badge-fill" style={{ color: ROJO, fontSize: "1.05rem" }}></i>
          <span className="fw-bold" style={{ color: "#1b4332", fontSize: "1.05rem" }}>
            Jornalizados · {campo}
          </span>
          <Button
            size="sm"
            onClick={exportarExcel}
            disabled={filtradas.length === 0}
            className="rounded-3 px-3 d-flex align-items-center gap-2 ms-auto"
            style={{ backgroundColor: "#15803d", borderColor: "#15803d", fontSize: "0.78rem", height: "30px", fontWeight: 600 }}
            title="Exportar a Excel lo que se está viendo"
          >
            <i className="bi bi-file-earmark-excel-fill"></i>
            <span>Excel</span>
          </Button>
        </div>

        {/* Fila de carga: lo mismo que la planilla de partes hasta el total, y
            después la tarea realizada con lugar para escribir. */}
        {editable && (
          <Card className="shadow-sm border-0 rounded-3 px-2 py-2 bg-white flex-shrink-0 mb-2">
            <div className="d-flex align-items-start gap-2 flex-wrap" onKeyDown={alPresionarEnter}>
              <div style={{ width: "120px" }}>
                {rotulo(<>Fecha <span className="text-danger">*</span></>)}
                <Form.Control
                  type="date"
                  max={hoyStr()}
                  value={form.fecha}
                  onChange={(e) => cambiar("fecha", e.target.value)}
                  style={estiloCelda}
                />
              </div>

              <div style={{ width: "190px" }}>
                {rotulo(<>Personal <span className="text-danger">*</span></>)}
                <SelectBuscador
                  inputRef={refPersona}
                  opciones={opcionesPersonal}
                  valor={form.persona}
                  onChange={(v) => cambiar("persona", v)}
                  placeholder="—"
                  style={estiloCelda}
                />
              </div>

              {hora("horaIngreso", "Entrada 1")}
              {hora("horaEgreso", "Salida 1")}
              {hora("horaIngreso2", "Entrada 2", seSolapan)}
              {hora("horaEgreso2", "Salida 2", seSolapan)}

              <div style={{ width: "56px" }}>
                {rotulo("Total")}
                <div
                  className="d-flex align-items-center justify-content-center rounded-2 fw-bold"
                  style={{ ...estiloCelda, backgroundColor: "#e8f5ee", color: "#1b4332", border: "1px solid #a7d8bf" }}
                  title="Se calcula solo"
                >
                  {totalForm ? nfHoras.format(totalForm) : "—"}
                </div>
                {/* Colch. Hs. (08/11/2026): cuenta las horas del total. Se
                    prende y se apaga tocándolo. Solo en Berdina. */}
                {establecimiento !== "san-pablo" && (
                <div className="mt-1">
                  {rotulo(
                    <span className="d-block text-center fw-semibold" style={{ color: form.colchonHs ? "#dc2626" : "#64748b" }}>
                      Colch. Hs.
                    </span>
                  )}
                  <div className="d-flex align-items-center justify-content-center" style={{ height: "24px" }}>
                    <button
                      type="button"
                      onClick={() => cambiar("colchonHs", !form.colchonHs)}
                      // Enter en el círculo no tiene que guardar.
                      onKeyDown={(e) => e.stopPropagation()}
                      aria-pressed={form.colchonHs}
                      title={
                        form.colchonHs
                          ? "Colchón de horas: cuenta las horas del total. La tarea realizada es obligatoria. Tocar para apagarlo."
                          : "Marcar como colchón de horas: cuenta las horas del total"
                      }
                      className="p-0 d-flex align-items-center justify-content-center"
                      style={{
                        width: "20px",
                        height: "20px",
                        borderRadius: "50%",
                        border: `2px solid ${form.colchonHs ? "#dc2626" : "#94a3b8"}`,
                        backgroundColor: form.colchonHs ? "#fef08a" : "#fff",
                        cursor: "pointer",
                      }}
                    >
                      {form.colchonHs && <i className="bi bi-check-lg" style={{ fontSize: "0.75rem", color: "#dc2626", lineHeight: 1 }}></i>}
                    </button>
                  </div>
                </div>
                )}
              </div>

              <div style={{ alignSelf: "stretch", borderLeft: "7px solid #cbd5e1", margin: "0 2px" }} />

              <div style={{ flex: "1 1 320px", minWidth: "260px" }}>
                {rotulo(<>Tarea realizada {obligatorio}</>)}
                <Form.Control
                  as="textarea"
                  rows={3}
                  value={form.tarea}
                  onChange={(e) => cambiar("tarea", e.target.value)}
                  style={{ fontSize: "0.78rem", padding: "4px 6px", resize: "vertical" }}
                />
              </div>

              <div className="d-flex flex-column gap-1" style={{ paddingTop: "17px" }}>
                {/* Valores provisorios, como en la planilla de partes: se
                    guarda con fecha y personal, sin validar el resto. */}
                <button
                  type="button"
                  onClick={alternarProvisorio}
                  onKeyDown={(e) => e.stopPropagation()}
                  className="btn btn-sm d-flex align-items-center gap-1 rounded-3"
                  style={{
                    fontSize: "0.78rem",
                    height: "30px",
                    padding: "0 10px",
                    border: `1px solid ${form.provisorio ? "#b45309" : "#cbd5e1"}`,
                    backgroundColor: form.provisorio ? "#fef3c7" : "#fff",
                    color: form.provisorio ? "#92400e" : "#1e293b",
                    fontWeight: form.provisorio ? 700 : 500,
                  }}
                  title={
                    form.provisorio
                      ? "Valores provisorios: se guarda sin validar. Apáguelo al cargar los datos reales."
                      : "Guardar con valores provisorios, sin validar, para completar después"
                  }
                  aria-pressed={form.provisorio}
                >
                  <i className={`bi ${form.provisorio ? "bi-hourglass-split" : "bi-hourglass"}`}></i>
                  Provisorio
                </button>
                <Button
                  size="sm"
                  onClick={guardar}
                  disabled={guardando}
                  className="rounded-3 px-3 d-flex align-items-center justify-content-center gap-1"
                  style={{ backgroundColor: editando ? "#0e7490" : "#15803d", borderColor: "transparent", fontSize: "0.78rem", height: "30px", fontWeight: 600 }}
                  title="Guardar (Enter)"
                >
                  <i className={`bi bi-${editando ? "check-lg" : "plus-lg"}`}></i>
                  <span>{editando ? "Guardar" : "Agregar"}</span>
                </Button>
                {editando && (
                  <Button
                    size="sm"
                    variant="outline-secondary"
                    onClick={limpiarForm}
                    className="rounded-3 px-3"
                    style={{ fontSize: "0.78rem", height: "30px" }}
                  >
                    Cancelar
                  </Button>
                )}
              </div>
            </div>
          </Card>
        )}

        {/* Filtros */}
        <Card className="mb-2 p-2 shadow-sm border-0 rounded-3 flex-shrink-0">
          <div className="d-flex align-items-center gap-3 flex-wrap">
            <FiltroFecha etiqueta="Desde" valor={desde} onChange={setDesde} />
            <FiltroFecha etiqueta="Hasta" valor={hasta} onChange={setHasta} />
            <FiltroSelect
              etiqueta="Personal"
              ancho="190px"
              valor={filtroPersona}
              vacio="Todos"
              onChange={setFiltroPersona}
              opciones={personasCargadas}
            />
            {/* Los provisorios que quedan por completar: solo aparece cuando
                hay alguno (o con el filtro puesto, para poder sacarlo). */}
            {(cantidadProvisorios > 0 || soloProvisorios) && (
              <button
                type="button"
                onClick={() => setSoloProvisorios((v) => !v)}
                className="btn btn-sm d-flex align-items-center gap-1 flex-shrink-0 rounded-pill"
                style={{
                  fontSize: "0.78rem",
                  height: "32px",
                  padding: "0 10px",
                  border: `1px solid ${soloProvisorios ? "#b45309" : "#cbd5e1"}`,
                  backgroundColor: soloProvisorios ? "#fef3c7" : "#fff",
                  color: soloProvisorios ? "#92400e" : "#1e293b",
                  fontWeight: soloProvisorios ? 700 : 500,
                }}
                title={soloProvisorios ? "Mostrar todos" : "Mostrar solo los provisorios, sin completar"}
                aria-pressed={soloProvisorios}
              >
                <i className="bi bi-hourglass-split" style={{ color: "#b45309" }}></i>
                Provisorios
                <span
                  className="rounded-pill px-1"
                  style={{ backgroundColor: "#b45309", color: "#fff", fontSize: "0.68rem", minWidth: "18px" }}
                >
                  {cantidadProvisorios}
                </span>
              </button>
            )}
            {/* Resumen por personal (02/11/2026), como el de la carga de datos. */}
            <Button
              size="sm"
              onClick={() => navigate(`/produccion/jornalizados/${establecimiento}/resumen`)}
              className="rounded-3 px-3 d-flex align-items-center gap-2 ms-auto"
              style={{ backgroundColor: ROJO, borderColor: ROJO, fontSize: "0.78rem", height: "30px", fontWeight: 600 }}
              title="Resumen de los jornalizados"
            >
              <i className="bi bi-clipboard-data-fill"></i>
              <span>Resumen</span>
            </Button>
          </div>
        </Card>

        {/* Tabla */}
        <div
          className="flex-grow-1 shadow-sm rounded-3 bg-white"
          style={{ minHeight: 0, overflowY: "auto", overflowX: "auto", border: "1px solid #cbd5e1" }}
        >
          <Table size="sm" className="tabla-informe mb-0" style={{ width: "100%" }}>
            <thead style={{ position: "sticky", top: 0, zIndex: 10, backgroundColor: "#1b4332", color: "#fff" }}>
              <tr>
                <th style={th}>Fecha</th>
                <th style={th}>Personal</th>
                <th style={th}>Entrada 1</th>
                <th style={th}>Salida 1</th>
                <th style={th}>Entrada 2</th>
                <th style={th}>Salida 2</th>
                <th style={th}>Total hs</th>
                <th style={th}>Tarea</th>
                {editable && <th style={th}></th>}
              </tr>
            </thead>
            <tbody>
              {filtradas.length === 0 ? (
                <tr>
                  <td colSpan={editable ? 9 : 8} className="text-center text-muted py-4" style={td}>
                    {cargando
                      ? "Cargando…"
                      : hayFiltro
                        ? "Ningún jornalizado coincide con los filtros"
                        : "No hay jornalizados cargados"}
                  </td>
                </tr>
              ) : (
                <>
                  {filtradas.map((f) => (
                    <tr
                      key={f._id}
                      className={
                        [f.provisorio && "fila-provisoria", editando === f._id && "fila-editando"].filter(Boolean).join(" ") ||
                        undefined
                      }
                    >
                      <td style={{ ...td, fontWeight: 600, whiteSpace: "nowrap" }}>
                        {formatFecha(f.fecha)}
                        {f.provisorio && (
                          <i
                            className="bi bi-hourglass-split ms-1"
                            style={{ color: "#b45309" }}
                            title="Provisorio: faltan los datos reales. Edítelo, complételo y apague Provisorio."
                          ></i>
                        )}
                      </td>
                      <td style={{ ...td, textAlign: "left", whiteSpace: "nowrap" }}>{f.persona?.apellidoNombre || <Raya />}</td>
                      <td style={{ ...td, color: "#64748b" }}>{f.horaIngreso || <Raya />}</td>
                      <td style={{ ...td, color: "#64748b" }}>{f.horaEgreso || <Raya />}</td>
                      <td style={{ ...td, color: "#64748b" }}>{f.horaIngreso2 || <Raya />}</td>
                      <td style={{ ...td, color: "#64748b" }}>{f.horaEgreso2 || <Raya />}</td>
                      <td style={{ ...td, fontWeight: 700, color: "#1b4332" }} title={f.colchonHs ? "Colch. Hs.: colchón de horas" : undefined}>
                        {f.colchonHs ? (
                          <span className="px-2 rounded-2" style={ESTILO_COLCHON}>
                            {f.totalHoras ? nfHoras.format(f.totalHoras) : "—"}
                          </span>
                        ) : f.totalHoras ? (
                          nfHoras.format(f.totalHoras)
                        ) : (
                          <Raya />
                        )}
                      </td>
                      {/* La tarea se lee entera con el ojo. */}
                      <td style={td}>
                        {f.tarea ? (
                          <button
                            type="button"
                            onClick={() => verTarea(f)}
                            className="btn btn-sm btn-outline-secondary d-inline-flex align-items-center justify-content-center rounded-2 p-0"
                            style={{ width: "22px", height: "22px" }}
                            title="Ver la tarea realizada"
                          >
                            <i className="bi bi-eye" style={{ fontSize: "0.75rem" }}></i>
                          </button>
                        ) : (
                          <Raya />
                        )}
                      </td>
                      {editable && (
                        <td style={td}>
                          <div className="d-flex justify-content-center gap-1">
                            <button
                              onClick={() => editar(f)}
                              className="btn btn-sm btn-outline-primary d-flex align-items-center justify-content-center rounded-2 p-0"
                              style={{ width: "22px", height: "22px" }}
                              title="Editar"
                            >
                              <i className="bi bi-pencil" style={{ fontSize: "0.7rem" }}></i>
                            </button>
                            <button
                              onClick={() => eliminar(f)}
                              className="btn btn-sm btn-outline-danger d-flex align-items-center justify-content-center rounded-2 p-0"
                              style={{ width: "22px", height: "22px" }}
                              title="Eliminar"
                            >
                              <i className="bi bi-trash" style={{ fontSize: "0.7rem" }}></i>
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}
                  <tr className="fila-total">
                    <td style={{ ...td, textAlign: "left", fontWeight: 700, color: "#1b4332" }}>TOTAL</td>
                    <td style={td} colSpan={5}></td>
                    <td style={{ ...td, fontWeight: 700 }}>{nfHoras.format(totalHoras)}</td>
                    <td style={td} colSpan={editable ? 2 : 1}></td>
                  </tr>
                </>
              )}
            </tbody>
          </Table>
        </div>
      </Container>
    </div>
  );
}
