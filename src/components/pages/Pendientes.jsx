import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useForm, useWatch } from "react-hook-form";
import Swal from "sweetalert2";
import { Container, Table, Button, Form, Modal, Row, Col, Card } from "react-bootstrap";
import { nuevoWorkbook } from "../../helpers/excel";
import LogoNavbar from "../shared/LogoNavbar";

const API = "/api/pendientes";

// Los dos listados viven acá: sumar un sector o una persona es tocar esta
// lista y nada más, sin migrar la base (el back los guarda como texto).
const SECTORES = ["Camionetas", "Tractores", "Colectivos", "Otros"];
const RESPONSABLES = ["Victor", "Kevin", "Jorge", "Nacho", "Javier", "Otro"];

// Colores muted, los mismos de todo el proyecto.
const ESTADOS = {
  Pendiente: { color: "#9e8850", bg: "#fcf8ee" },
  "En curso": { color: "#4a6fa5", bg: "#eef3fa" },
  Terminada: { color: "#52735a", bg: "#edf5ef" },
};
const ESTADO_POR_DEFECTO = "Pendiente";

const hoy = () => new Date().toISOString().slice(0, 10);

// "2026-09-08" -> "08/09/2026". Se parte el texto en vez de usar Date para que
// la zona horaria no corra la fecha un día.
const fechaLinda = (fecha) => {
  const [a, m, d] = String(fecha || "").split("-");
  return a && m && d ? `${d}/${m}/${a}` : "—";
};

const FiltroSelect = ({ etiqueta, ancho, valor, vacio, onChange, opciones }) => {
  const activo = valor !== vacio;
  return (
    <div className="d-flex align-items-center gap-2">
      <span className="fw-bold text-dark small flex-shrink-0" style={{ fontSize: "0.8rem" }}>
        {etiqueta}:
      </span>
      <div className="input-group input-group-sm" style={{ width: ancho }}>
        <Form.Select
          size="sm"
          value={valor}
          onChange={(e) => onChange(e.target.value)}
          className={`rounded-3 ${activo ? "rounded-end-0 border-end-0 fw-bold filtro-activo" : ""}`}
          style={{
            fontSize: "0.82rem",
            height: "32px",
            padding: "3px 24px 3px 8px",
            color: activo ? "#dc2626" : "#1e293b",
            fontWeight: activo ? "700" : "normal",
          }}
        >
          <option value={vacio}>{vacio}</option>
          {opciones.map((texto) => (
            <option key={texto} value={texto}>
              {texto}
            </option>
          ))}
        </Form.Select>
        {activo && (
          <button
            className="btn btn-outline-secondary border-start-0 d-flex align-items-center justify-content-center"
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

function Pendientes() {
  const navigate = useNavigate();
  const [pendientes, setPendientes] = useState([]);
  const [cargando, setCargando] = useState(true);

  const [filtroSector, setFiltroSector] = useState("Todos");
  const [filtroResponsable, setFiltroResponsable] = useState("Todos");
  const [filtroEstado, setFiltroEstado] = useState("Todos");
  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState("");
  const [busqueda, setBusqueda] = useState("");

  const [showModal, setShowModal] = useState(false);
  const [editando, setEditando] = useState(null);

  const {
    register,
    handleSubmit,
    reset,
    control,
    formState: { errors },
  } = useForm({
    defaultValues: {
      fecha: hoy(),
      sector: "",
      estado: ESTADO_POR_DEFECTO,
      responsable: "",
      otroResponsable: "",
      observaciones: "",
    },
  });

  // Cuando el responsable es "Otro" se escribe el nombre a mano.
  const responsableElegido = useWatch({ control, name: "responsable" });

  const cargar = async () => {
    setCargando(true);
    try {
      const res = await fetch(API);
      const data = res.ok ? await res.json() : [];
      setPendientes(Array.isArray(data) ? data : []);
    } catch {
      setPendientes([]);
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    cargar();
  }, []);

  const abrirNuevo = () => {
    setEditando(null);
    reset({
      fecha: hoy(),
      sector: "",
      estado: ESTADO_POR_DEFECTO,
      responsable: "",
      otroResponsable: "",
      observaciones: "",
    });
    setShowModal(true);
  };

  const abrirEditar = (p) => {
    setEditando(p._id);
    // Un responsable que no está en la lista se cargó como "Otro": vuelve al
    // formulario con el nombre en el campo de texto.
    const esDeLaLista = RESPONSABLES.includes(p.responsable);
    reset({
      fecha: p.fecha || hoy(),
      sector: p.sector || "",
      estado: p.estado || ESTADO_POR_DEFECTO,
      responsable: esDeLaLista ? p.responsable : p.responsable ? "Otro" : "",
      otroResponsable: esDeLaLista ? "" : p.responsable || "",
      observaciones: p.observaciones || "",
    });
    setShowModal(true);
  };

  const cerrarModal = () => {
    setShowModal(false);
    setEditando(null);
    reset();
  };

  const onSubmit = async (data) => {
    const { otroResponsable, ...resto } = data;
    const cuerpo = {
      ...resto,
      responsable:
        data.responsable === "Otro" && otroResponsable.trim()
          ? otroResponsable.trim()
          : data.responsable,
    };
    try {
      const url = editando ? `${API}/${editando}` : API;
      const res = await fetch(url, {
        method: editando ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(cuerpo),
      });
      if (res.ok) {
        cerrarModal();
        cargar();
        Swal.fire({
          icon: "success",
          title: editando ? "Pendiente actualizado" : "Pendiente registrado",
          timer: 1500,
          showConfirmButton: false,
        });
      } else {
        const err = await res.json();
        Swal.fire({ icon: "error", title: "Error", text: err.error || "No se pudo guardar" });
      }
    } catch {
      Swal.fire({ icon: "error", title: "Sin conexión", text: "No se pudo conectar con el servidor" });
    }
  };

  const eliminar = async (p) => {
    const result = await Swal.fire({
      title: "¿Eliminar pendiente?",
      text: `Se quitará el pendiente de ${p.sector} del ${fechaLinda(p.fecha)}`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#dc2626",
      cancelButtonColor: "#64748b",
      confirmButtonText: "Sí, eliminar",
      cancelButtonText: "Cancelar",
    });
    if (result.isConfirmed) {
      await fetch(`${API}/${p._id}`, { method: "DELETE" });
      cargar();
      Swal.fire({ icon: "success", title: "Pendiente eliminado", timer: 1200, showConfirmButton: false });
    }
  };

  // Las opciones salen de todo lo cargado y no de lo ya filtrado: si no,
  // elegir un sector vaciaría el desplegable de responsables.
  const sectoresDisponibles = useMemo(() => {
    const usados = pendientes.map((p) => p.sector).filter(Boolean);
    return [...new Set([...SECTORES, ...usados])];
  }, [pendientes]);

  const responsablesDisponibles = useMemo(() => {
    const usados = pendientes.map((p) => p.responsable).filter(Boolean);
    // "Otro" no se ofrece como filtro: en la tabla figura el nombre escrito.
    return [...new Set([...RESPONSABLES.filter((r) => r !== "Otro"), ...usados])];
  }, [pendientes]);

  const hayFiltro =
    filtroSector !== "Todos" ||
    filtroResponsable !== "Todos" ||
    filtroEstado !== "Todos" ||
    !!desde ||
    !!hasta ||
    !!busqueda.trim();

  const filtrados = useMemo(() => {
    const q = busqueda.toLowerCase().trim();
    return pendientes
      .filter((p) => filtroSector === "Todos" || p.sector === filtroSector)
      .filter((p) => filtroResponsable === "Todos" || p.responsable === filtroResponsable)
      .filter((p) => filtroEstado === "Todos" || (p.estado || ESTADO_POR_DEFECTO) === filtroEstado)
      .filter((p) => !desde || (p.fecha || "") >= desde)
      .filter((p) => !hasta || (p.fecha || "") <= hasta)
      .filter((p) => !q || (p.observaciones || "").toLowerCase().includes(q))
      .sort((a, b) => (b.fecha || "").localeCompare(a.fecha || ""));
  }, [pendientes, filtroSector, filtroResponsable, filtroEstado, desde, hasta, busqueda]);

  const limpiarFiltros = () => {
    setFiltroSector("Todos");
    setFiltroResponsable("Todos");
    setFiltroEstado("Todos");
    setDesde("");
    setHasta("");
    setBusqueda("");
  };

  const exportarExcel = async () => {
    const columnas = ["#", "Fecha", "Sector", "Responsable", "Estado", "Observaciones"];
    const fechaHoy = new Date().toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric" });

    const wb = await nuevoWorkbook();
    const ws = wb.addWorksheet("Pendientes");

    ws.mergeCells(1, 1, 1, columnas.length);
    const celdaTitulo = ws.getCell("A1");
    celdaTitulo.value = "Pendientes";
    celdaTitulo.font = { bold: true, size: 14, color: { argb: "FF1B4332" } };
    celdaTitulo.alignment = { horizontal: "center", vertical: "middle" };
    ws.getRow(1).height = 24;

    ws.mergeCells(2, 1, 2, columnas.length);
    const celdaFecha = ws.getCell("A2");
    celdaFecha.value = `Fecha de emisión: ${fechaHoy}`;
    celdaFecha.font = { italic: true, size: 10, color: { argb: "FF64748B" } };
    celdaFecha.alignment = { horizontal: "center", vertical: "middle" };
    ws.getRow(2).height = 18;

    ws.addRow([]);

    const filaEncabezado = ws.addRow(columnas);
    filaEncabezado.eachCell((cell) => {
      cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
      cell.alignment = { horizontal: "center", vertical: "middle" };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1B4332" } };
    });
    ws.getRow(4).height = 20;

    filtrados.forEach((p, idx) => {
      const fila = ws.addRow([
        idx + 1,
        fechaLinda(p.fecha),
        p.sector || "—",
        p.responsable || "—",
        p.estado || ESTADO_POR_DEFECTO,
        p.observaciones || "—",
      ]);
      fila.eachCell((cell) => {
        cell.alignment = { horizontal: "center", vertical: "middle" };
        cell.border = {
          top: { style: "thin", color: { argb: "FFE2E8F0" } },
          bottom: { style: "thin", color: { argb: "FFE2E8F0" } },
          left: { style: "thin", color: { argb: "FFE2E8F0" } },
          right: { style: "thin", color: { argb: "FFE2E8F0" } },
        };
      });
      fila.getCell(6).alignment = { horizontal: "left", vertical: "middle", wrapText: true };
    });

    ws.columns = [{ width: 6 }, { width: 14 }, { width: 16 }, { width: 18 }, { width: 14 }, { width: 60 }];

    const buffer = await wb.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `pendientes_${new Date().toISOString().slice(0, 10)}.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Los mismos dos objetos que el resto de las tablas del proyecto
  // (docs/formato-tablas.md). El aspecto base sale de la clase `tabla-informe`.
  const th = {
    backgroundColor: "#1b4332",
    color: "#fff",
    fontSize: "0.66rem",
    fontWeight: 600,
    verticalAlign: "middle",
    padding: "3px 5px",
    whiteSpace: "nowrap",
  };
  const td = { fontSize: "0.7rem", padding: "1px 5px", verticalAlign: "middle" };

  // Un dato que falta va como raya gris, nunca vacío.
  const raya = <span style={{ color: "#cbd5e1" }}>—</span>;

  // Lo cargado antes de que existiera el estado se lee como "Pendiente".
  const badgeEstado = (estado) => {
    const nombre = estado || ESTADO_POR_DEFECTO;
    const { color, bg } = ESTADOS[nombre] || { color: "#475569", bg: "#f1f5f9" };
    return (
      <span
        className="rounded-2 d-inline-block px-2"
        style={{ backgroundColor: bg, color, fontWeight: 600, fontSize: "0.66rem", whiteSpace: "nowrap" }}
      >
        {nombre}
      </span>
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
        {/* Lado izquierdo: ícono y cuenta */}
        <div className="d-flex align-items-center gap-2">
          <div
            className="rounded-3 d-flex align-items-center justify-content-center me-1"
            style={{
              width: "34px",
              height: "34px",
              backgroundColor: "#10b981",
              color: "#fff",
              fontSize: "1.15rem",
              boxShadow: "0 2px 8px rgba(16, 185, 129, 0.3)",
            }}
          >
            <i className="bi bi-list-check"></i>
          </div>
          <span className="text-light opacity-75 small ms-1">
            {hayFiltro
              ? `${filtrados.length} de ${pendientes.length} pendientes`
              : `${pendientes.length} pendientes`}
          </span>
        </div>

        {/* Título (corrido a la izquierda: el logo ocupa el centro) */}
        <div
          style={{
            marginRight: "auto",
            marginLeft: "0.9rem",
            width: "max-content",
            pointerEvents: "none",
          }}
        >
          <span className="text-white fs-6 fw-normal" style={{ letterSpacing: "0.3px" }}>
            Pendientes
          </span>
        </div>

        {/* Botones de Navegación */}
        <div className="d-flex align-items-center gap-2">
          {/* A Pendientes se entra desde el botón de Reunión, que se aprieta en
              cualquier pantalla: se vuelve a la anterior, no a una fija. */}
          <button
            onClick={() => navigate(-1)}
            className="btn btn-sm btn-outline-light d-flex align-items-center gap-1.5 rounded-3 px-3 py-1"
            style={{ fontSize: "0.82rem" }}
          >
            <i className="bi bi-arrow-left"></i>
            <span>Volver</span>
          </button>
          <button
            onClick={() => navigate("/inicio")}
            className="btn btn-sm btn-outline-light d-flex align-items-center gap-1.5 rounded-3 px-3 py-1"
            style={{ fontSize: "0.82rem" }}
          >
            <i className="bi bi-grid-fill"></i>
            <span>Mantenimiento</span>
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
        className="px-4 py-3 d-flex flex-column flex-grow-1"
        style={{ maxWidth: "1140px", width: "100%", margin: "0 auto", overflow: "hidden" }}
      >
        {/* Botones de acción, arriba de los filtros */}
        <div className="d-flex align-items-center justify-content-end gap-3 mb-3">
            <Button
              variant="success"
              size="sm"
              onClick={exportarExcel}
              disabled={filtrados.length === 0}
              className="d-inline-flex align-items-center gap-1.5 rounded-3 px-3 py-1.5 shadow-sm"
              style={{ fontSize: "0.82rem", backgroundColor: "#15803d", borderColor: "#15803d" }}
              title="Exportar a Excel"
            >
              <i className="bi bi-file-earmark-excel-fill"></i>
              <span>Excel</span>
            </Button>

            <Button
              variant="primary"
              size="sm"
              onClick={abrirNuevo}
              className="d-inline-flex align-items-center rounded-3 px-3.5 py-1.5 shadow-sm"
              style={{
                backgroundColor: "#1e293b",
                borderColor: "#1e293b",
                fontSize: "0.82rem",
                fontWeight: 600,
              }}
            >
              <span>Nuevo Pendiente</span>
            </Button>
        </div>

        {/* Barra de filtros */}
        <Card className="mb-3 p-2 shadow-sm border-0 rounded-3 flex-shrink-0">
          <div className="d-flex align-items-center gap-3 flex-wrap">
            <FiltroSelect
              etiqueta="Sector"
              ancho="150px"
              valor={filtroSector}
              vacio="Todos"
              onChange={setFiltroSector}
              opciones={sectoresDisponibles}
            />

            <FiltroSelect
              etiqueta="Responsable"
              ancho="150px"
              valor={filtroResponsable}
              vacio="Todos"
              onChange={setFiltroResponsable}
              opciones={responsablesDisponibles}
            />

            <FiltroSelect
              etiqueta="Estado"
              ancho="140px"
              valor={filtroEstado}
              vacio="Todos"
              onChange={setFiltroEstado}
              opciones={Object.keys(ESTADOS)}
            />

            <div className="d-flex align-items-center gap-2">
              <span className="fw-bold text-dark small flex-shrink-0" style={{ fontSize: "0.8rem" }}>
                Desde:
              </span>
              <Form.Control
                type="date"
                size="sm"
                value={desde}
                onChange={(e) => setDesde(e.target.value)}
                className={`rounded-3 ${desde ? "fw-bold filtro-activo" : ""}`}
                style={{
                  width: "150px",
                  fontSize: "0.82rem",
                  height: "32px",
                  color: desde ? "#dc2626" : "#1e293b",
                  fontWeight: desde ? "700" : "normal",
                }}
              />
            </div>

            <div className="d-flex align-items-center gap-2">
              <span className="fw-bold text-dark small flex-shrink-0" style={{ fontSize: "0.8rem" }}>
                Hasta:
              </span>
              <Form.Control
                type="date"
                size="sm"
                value={hasta}
                onChange={(e) => setHasta(e.target.value)}
                className={`rounded-3 ${hasta ? "fw-bold filtro-activo" : ""}`}
                style={{
                  width: "150px",
                  fontSize: "0.82rem",
                  height: "32px",
                  color: hasta ? "#dc2626" : "#1e293b",
                  fontWeight: hasta ? "700" : "normal",
                }}
              />
            </div>

            <div className="input-group input-group-sm" style={{ width: "260px" }}>
              <span
                className="input-group-text bg-light border-end-0 text-muted"
                style={{ padding: "3px 9px", height: "32px" }}
              >
                <i className="bi bi-search" style={{ fontSize: "0.8rem" }}></i>
              </span>
              <Form.Control
                type="text"
                placeholder="Buscar en observaciones..."
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                className={`border-start-0 ${busqueda ? "fw-bold filtro-activo" : ""}`}
                style={{
                  fontSize: "0.82rem",
                  height: "32px",
                  padding: "3px 8px 3px 10px",
                  color: busqueda ? "#dc2626" : "#1e293b",
                  fontWeight: busqueda ? "700" : "normal",
                }}
              />
              {busqueda && (
                <button
                  className="btn btn-outline-secondary border-start-0 d-flex align-items-center justify-content-center"
                  type="button"
                  onClick={() => setBusqueda("")}
                  title="Limpiar búsqueda"
                  style={{ padding: "0 7px", height: "32px" }}
                >
                  <i className="bi bi-x" style={{ fontSize: "0.9rem" }}></i>
                </button>
              )}
            </div>

            {hayFiltro && (
              <button
                className="btn btn-sm btn-outline-secondary rounded-3 d-flex align-items-center gap-1"
                type="button"
                onClick={limpiarFiltros}
                style={{ fontSize: "0.78rem", height: "32px" }}
              >
                <i className="bi bi-x-circle"></i>
                <span>Limpiar</span>
              </button>
            )}
          </div>
        </Card>

        {/* Tabla de pendientes — marco con el scroll adentro, nunca en la
            página, y centrada en vez de estirada al ancho de la pantalla. */}
        <div
          className="shadow-sm rounded-3 bg-white"
          style={{
            flex: "1 1 auto",
            minHeight: 0,
            alignSelf: "center",
            maxWidth: "100%",
            overflowY: "auto",
            overflowX: "auto",
            border: "1px solid #cbd5e1",
          }}
        >
          <Table className="mb-0 tabla-informe" style={{ width: "auto", minWidth: "820px" }}>
            <thead style={{ position: "sticky", top: 0, zIndex: 10, backgroundColor: "#1b4332", color: "#fff" }}>
              <tr>
                <th style={{ ...th, width: "42px", textAlign: "center" }}>#</th>
                <th style={{ ...th, width: "90px", textAlign: "center" }}>Fecha</th>
                <th style={{ ...th, width: "110px", textAlign: "center" }}>Sector</th>
                <th style={{ ...th, width: "120px", textAlign: "center" }}>Responsable</th>
                <th style={{ ...th, width: "100px", textAlign: "center" }}>Estado</th>
                <th style={{ ...th, textAlign: "left", minWidth: "340px" }}>Observaciones</th>
                <th style={{ ...th, width: "80px", textAlign: "center" }}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filtrados.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center text-muted py-4" style={td}>
                    {cargando
                      ? "Cargando…"
                      : hayFiltro
                      ? "Ningún pendiente coincide con los filtros"
                      : "No hay pendientes cargados"}
                  </td>
                </tr>
              ) : (
                filtrados.map((p, idx) => (
                  <tr key={p._id}>
                    <td style={{ ...td, textAlign: "center", color: "#94a3b8" }}>{idx + 1}</td>
                    <td style={{ ...td, textAlign: "center" }}>{fechaLinda(p.fecha)}</td>
                    <td style={{ ...td, textAlign: "center" }}>{p.sector || raya}</td>
                    <td style={{ ...td, textAlign: "center" }}>{p.responsable || raya}</td>
                    <td style={{ ...td, textAlign: "center" }}>{badgeEstado(p.estado)}</td>
                    <td style={{ ...td, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
                      {p.observaciones || raya}
                    </td>
                    <td style={{ ...td, textAlign: "center" }}>
                      <div className="d-flex justify-content-center align-items-center" style={{ gap: "8px" }}>
                        <button
                          onClick={() => abrirEditar(p)}
                          className="btn btn-sm btn-outline-primary d-flex align-items-center justify-content-center rounded-2 p-0"
                          style={{ width: "22px", height: "22px" }}
                          title="Editar"
                        >
                          <i className="bi bi-pencil" style={{ fontSize: "0.72rem" }}></i>
                        </button>
                        <button
                          onClick={() => eliminar(p)}
                          className="btn btn-sm btn-outline-danger d-flex align-items-center justify-content-center rounded-2 p-0"
                          style={{ width: "22px", height: "22px" }}
                          title="Eliminar"
                        >
                          <i className="bi bi-trash" style={{ fontSize: "0.72rem" }}></i>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </Table>
        </div>
      </Container>

      {/* Modal Nuevo / Editar Pendiente */}
      <Modal
        show={showModal}
        onHide={cerrarModal}
        centered
        contentClassName="border-0 shadow-lg rounded-4 overflow-visible"
      >
        <Modal.Header
          closeButton
          closeVariant="white"
          style={{
            // Los modales de Mantenimiento van con el azul institucional; el
            // verde queda para el encabezado de la tabla.
            backgroundColor: "#1e293b",
            color: "#fff",
            borderTopLeftRadius: "1rem",
            borderTopRightRadius: "1rem",
            borderBottom: "1px solid rgba(255,255,255,0.1)",
          }}
        >
          <Modal.Title className="fs-6 fw-bold d-flex align-items-center gap-2 text-white">
            <i className="bi bi-list-check" style={{ color: "#10b981" }}></i>
            <span>{editando ? "Editar Pendiente" : "Nuevo Pendiente"}</span>
          </Modal.Title>
        </Modal.Header>
        <Form onSubmit={handleSubmit(onSubmit)}>
          <Modal.Body className="p-4" style={{ overflow: "visible" }}>
            <Row className="g-3">
              <Col md={4}>
                <Form.Label className="fw-semibold text-dark small mb-1">
                  Fecha <span className="text-danger">*</span>
                </Form.Label>
                <Form.Control
                  type="date"
                  className="rounded-3"
                  style={{ fontSize: "0.85rem" }}
                  {...register("fecha", { required: "La fecha es requerida" })}
                  isInvalid={!!errors.fecha}
                />
                <Form.Control.Feedback type="invalid" style={{ fontSize: "0.78rem" }}>
                  {errors.fecha?.message}
                </Form.Control.Feedback>
              </Col>

              <Col md={4}>
                <Form.Label className="fw-semibold text-dark small mb-1">
                  Sector <span className="text-danger">*</span>
                </Form.Label>
                <Form.Select
                  className="rounded-3"
                  style={{ fontSize: "0.85rem" }}
                  {...register("sector", { required: "El sector es requerido" })}
                  isInvalid={!!errors.sector}
                >
                  <option value="">Elegir…</option>
                  {SECTORES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </Form.Select>
                <Form.Control.Feedback type="invalid" style={{ fontSize: "0.78rem" }}>
                  {errors.sector?.message}
                </Form.Control.Feedback>
              </Col>

              <Col md={4}>
                <Form.Label className="fw-semibold text-dark small mb-1">
                  Estado <span className="text-danger">*</span>
                </Form.Label>
                <Form.Select
                  className="rounded-3"
                  style={{ fontSize: "0.85rem" }}
                  {...register("estado", { required: "El estado es requerido" })}
                  isInvalid={!!errors.estado}
                >
                  {Object.keys(ESTADOS).map((e) => (
                    <option key={e} value={e}>
                      {e}
                    </option>
                  ))}
                </Form.Select>
                <Form.Control.Feedback type="invalid" style={{ fontSize: "0.78rem" }}>
                  {errors.estado?.message}
                </Form.Control.Feedback>
              </Col>

              {/* Angosto a propósito: son nombres cortos y así queda a la par
                  del campo de "¿Quién?" cuando se elige Otro. */}
              <Col md={4}>
                <Form.Label className="fw-semibold text-dark small mb-1">
                  Responsable <span className="text-danger">*</span>
                </Form.Label>
                <Form.Select
                  className="rounded-3"
                  style={{ fontSize: "0.85rem" }}
                  {...register("responsable", { required: "El responsable es requerido" })}
                  isInvalid={!!errors.responsable}
                >
                  <option value="">Elegir…</option>
                  {RESPONSABLES.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </Form.Select>
                <Form.Control.Feedback type="invalid" style={{ fontSize: "0.78rem" }}>
                  {errors.responsable?.message}
                </Form.Control.Feedback>
              </Col>

              {/* Con "Otro" se escribe el nombre; si queda vacío se guarda
                  "Otro" tal cual. */}
              {responsableElegido === "Otro" && (
                <Col md={4}>
                  <Form.Label className="fw-semibold text-dark small mb-1">¿Quién?</Form.Label>
                  <Form.Control
                    className="rounded-3"
                    placeholder="Nombre"
                    style={{ fontSize: "0.85rem" }}
                    {...register("otroResponsable", {
                      maxLength: { value: 40, message: "Máximo 40 caracteres" },
                    })}
                    isInvalid={!!errors.otroResponsable}
                  />
                  <Form.Control.Feedback type="invalid" style={{ fontSize: "0.78rem" }}>
                    {errors.otroResponsable?.message}
                  </Form.Control.Feedback>
                </Col>
              )}

              <Col md={12}>
                <Form.Label className="fw-semibold text-dark small mb-1">Observaciones</Form.Label>
                <Form.Control
                  as="textarea"
                  rows={3}
                  className="rounded-3"
                  style={{ fontSize: "0.85rem" }}
                  {...register("observaciones", {
                    maxLength: { value: 500, message: "Máximo 500 caracteres" },
                  })}
                  isInvalid={!!errors.observaciones}
                />
                <Form.Control.Feedback type="invalid" style={{ fontSize: "0.78rem" }}>
                  {errors.observaciones?.message}
                </Form.Control.Feedback>
              </Col>
            </Row>
          </Modal.Body>
          <Modal.Footer
            className="bg-light border-0 py-2.5 px-4"
            style={{ borderBottomLeftRadius: "1rem", borderBottomRightRadius: "1rem" }}
          >
            <Button
              variant="outline-secondary"
              size="sm"
              onClick={cerrarModal}
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
    </div>
  );
}

export default Pendientes;
