import { useEffect, useState, useRef } from "react";
import { useForm, useWatch } from "react-hook-form";
import { useNavigate } from "react-router-dom";
import Swal from "sweetalert2";
import { Container, Table, Button, Form, Modal, Row, Col, Card } from "react-bootstrap";
import { nuevoWorkbook } from "../../helpers/excel";
import TractorIcon from "../shared/TractorIcon";

const API = "/api/tractores";

const GRUPPO_LABELS = {
  1: "Grupo 1",
  2: "Grupo 2",
  3: "Grupo 3",
  4: "Grupo 4",
  5: "Grupo 5",
  6: "Berdina",
  7: "San Pablo",
};

const GRUPPO_COLORS = {
  1: "#1e40af", // Azul
  2: "#047857", // Verde oscuro
  3: "#b45309", // Ámbar / Dorado
  4: "#6b21a8", // Púrpura
  5: "#c2410c", // Naranja / Óxido
  6: "#b91c1c", // Rojo Berdina
  7: "#4d7c0f", // Verde Oliva San Pablo
};

function SearchableInputDropdown({
  value,
  onChange,
  options,
  placeholder = "— Seleccionar o escribir —",
  isInvalid,
  errorMsg,
}) {
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState("");
  const containerRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const filtered = options.filter((o) =>
    o.toLowerCase().includes(filter.toLowerCase())
  );

  return (
    <div ref={containerRef} className="position-relative">
      <Form.Control
        placeholder={placeholder}
        value={open ? filter : value || ""}
        onFocus={() => {
          setFilter("");
          setOpen(true);
        }}
        onChange={(e) => {
          setFilter(e.target.value);
          onChange(e.target.value);
          setOpen(true);
        }}
        isInvalid={isInvalid}
        className="rounded-3"
        style={{ fontSize: "0.85rem", cursor: "pointer" }}
      />
      {open && (
        <div
          style={{
            position: "absolute",
            top: "100%",
            left: 0,
            right: 0,
            zIndex: 1060,
            backgroundColor: "#fff",
            border: "1px solid #cbd5e1",
            borderRadius: "8px",
            maxHeight: "220px",
            overflowY: "auto",
            boxShadow: "0 8px 24px rgba(0,0,0,0.15)",
            marginTop: "4px",
          }}
        >
          {filtered.length === 0 ? (
            <div className="px-3 py-2 text-muted" style={{ fontSize: "0.82rem" }}>
              Sin coincidencias. Presiona enter para "{filter}"
            </div>
          ) : (
            filtered.map((r) => (
              <div
                key={r}
                className="px-3 py-2"
                style={{
                  cursor: "pointer",
                  fontSize: "0.85rem",
                  backgroundColor: value === r ? "#f1f5f9" : "#fff",
                  fontWeight: value === r ? "600" : "normal",
                  color: value === r ? "#0f172a" : "#334155",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#f8fafc")}
                onMouseLeave={(e) =>
                  (e.currentTarget.style.backgroundColor = value === r ? "#f1f5f9" : "#fff")
                }
                onMouseDown={(e) => {
                  e.preventDefault();
                  onChange(r);
                  setFilter("");
                  setOpen(false);
                }}
              >
                {r}
              </div>
            ))
          )}
        </div>
      )}
      {isInvalid && errorMsg && (
        <Form.Control.Feedback type="invalid" style={{ display: "block", fontSize: "0.78rem" }}>
          {errorMsg}
        </Form.Control.Feedback>
      )}
    </div>
  );
}

function TractoresAltas() {
  const navigate = useNavigate();
  const [tractores, setTractores] = useState([]);
  const [busqueda, setBusqueda] = useState("");
  const [filtroGrupo, setFiltroGrupo] = useState("Todos");
  const [filtroSupervisor, setFiltroSupervisor] = useState("Todos");
  const [filtroEncargado, setFiltroEncargado] = useState("Todos");

  const [showModal, setShowModal] = useState(false);
  const [editando, setEditando] = useState(null);

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    control,
    formState: { errors },
  } = useForm();

  const supervisorValue = useWatch({ control, name: "supervisor" });
  const encargadoValue = useWatch({ control, name: "encargadoGral" });

  const cargar = async () => {
    try {
      const res = await fetch(API);
      const data = res.ok ? await res.json() : [];
      setTractores(Array.isArray(data) ? data : []);
    } catch {
      setTractores([]);
    }
  };

  useEffect(() => {
    cargar();
  }, []);

  const abrirNuevo = () => {
    setEditando(null);
    reset({
      cc: "",
      descripcion: "",
      supervisor: "",
      encargadoGral: "",
      gruppo: 1,
    });
    setShowModal(true);
  };

  const abrirEditar = (t) => {
    setEditando(t._id);
    setValue("cc", t.cc);
    setValue("descripcion", t.descripcion || "");
    setValue("supervisor", t.supervisor || "");
    setValue("encargadoGral", t.encargadoGral || "");
    setValue("gruppo", t.gruppo ?? 1);
    setShowModal(true);
  };

  const cerrarModal = () => {
    setShowModal(false);
    setEditando(null);
    reset();
  };

  const onSubmit = async (data) => {
    try {
      const url = editando ? `${API}/${editando}` : API;
      const method = editando ? "PUT" : "POST";
      const payload = {
        ...data,
        gruppo: Number(data.gruppo),
      };
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        cerrarModal();
        cargar();
        Swal.fire({
          icon: "success",
          title: editando ? "Tractor actualizado" : "Tractor registrado",
          timer: 1500,
          showConfirmButton: false,
        });
      } else {
        const err = await res.json();
        Swal.fire({ icon: "error", title: "Error", text: err.error || "No se pudo guardar el tractor" });
      }
    } catch {
      Swal.fire({ icon: "error", title: "Sin conexión", text: "No se pudo conectar con el servidor" });
    }
  };

  const eliminar = async (id) => {
    const result = await Swal.fire({
      title: "¿Eliminar tractor?",
      text: "Esta acción quitará el tractor de la flota",
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#dc2626",
      cancelButtonColor: "#64748b",
      confirmButtonText: "Sí, eliminar",
      cancelButtonText: "Cancelar",
    });
    if (result.isConfirmed) {
      await fetch(`${API}/${id}`, { method: "DELETE" });
      cargar();
      Swal.fire({ icon: "success", title: "Tractor eliminado", timer: 1200, showConfirmButton: false });
    }
  };

  const supervisoresExistentes = [
    ...new Set([
      "Jorge Rosas",
      "Guillermo Bustos",
      "Carlos Chumiento",
      "brandan alejandro",
      "Elio Rojas",
      "Kevin",
      "Victor",
      "Mario Bustos",
      "Vanegas",
      "SP",
      "ALBERDI",
      ...tractores.map((t) => (t.supervisor || "").trim()).filter(Boolean),
    ]),
  ].sort((a, b) => a.localeCompare(b));

  const encargadosExistentes = [
    ...new Set([
      "Carlos Carro",
      "Tomas Marquez",
      "Victor",
      "Kevin",
      ...tractores.map((t) => (t.encargadoGral || "").trim()).filter(Boolean),
    ]),
  ].sort((a, b) => a.localeCompare(b));

  const exportarExcel = async () => {
    const titulo = "Alta de Flota — Tractores";
    const columnas = ["#", "CC / Tractor", "Grupo", "Supervisor", "Encargado Gral.", "Descripción / Modelo"];
    const fechaHoy = new Date().toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric" });

    const wb = await nuevoWorkbook();
    const ws = wb.addWorksheet("Tractores");

    // Título institucional
    ws.mergeCells(1, 1, 1, columnas.length);
    const celdaTitulo = ws.getCell("A1");
    celdaTitulo.value = titulo;
    celdaTitulo.font = { bold: true, size: 14, color: { argb: "FF1E293B" } };
    celdaTitulo.alignment = { horizontal: "center", vertical: "middle" };
    ws.getRow(1).height = 24;

    // Fecha
    ws.mergeCells(2, 1, 2, columnas.length);
    const celdaFecha = ws.getCell("A2");
    celdaFecha.value = `Fecha de emisión: ${fechaHoy}`;
    celdaFecha.font = { italic: true, size: 10, color: { argb: "FF64748B" } };
    celdaFecha.alignment = { horizontal: "center", vertical: "middle" };
    ws.getRow(2).height = 18;

    ws.addRow([]);

    // Encabezado de columnas
    const filaEncabezado = ws.addRow(columnas);
    filaEncabezado.eachCell((cell) => {
      cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
      cell.alignment = { horizontal: "center", vertical: "middle" };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1E293B" } };
    });
    ws.getRow(4).height = 20;

    tractoresFiltrados.forEach((t, idx) => {
      const gruppoNum = t.gruppo ?? 1;
      const gruppoLabel = GRUPPO_LABELS[gruppoNum] || `Grupo ${gruppoNum}`;
      const fila = ws.addRow([
        idx + 1,
        t.cc,
        gruppoLabel,
        t.supervisor || "—",
        t.encargadoGral || "—",
        t.descripcion || "—",
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
      fila.getCell(6).alignment = { horizontal: "left", vertical: "middle" };
    });

    ws.columns = [
      { width: 6 },
      { width: 16 },
      { width: 16 },
      { width: 24 },
      { width: 22 },
      { width: 40 },
    ];

    const buffer = await wb.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `tractores_alta_${new Date().toISOString().slice(0, 10)}.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const tractoresFiltrados = tractores.filter((t) => {
    const q = busqueda.toLowerCase().trim();
    const matchBusqueda =
      !q ||
      (t.cc || "").toLowerCase().includes(q) ||
      (t.descripcion || "").toLowerCase().includes(q) ||
      (t.supervisor || "").toLowerCase().includes(q) ||
      (t.encargadoGral || "").toLowerCase().includes(q);

    const matchGrupo =
      filtroGrupo === "Todos" || (t.gruppo ?? 1) === Number(filtroGrupo);
    const matchSupervisor =
      filtroSupervisor === "Todos" || (t.supervisor || "").trim() === filtroSupervisor;
    const matchEncargado =
      filtroEncargado === "Todos" || (t.encargadoGral || "").trim() === filtroEncargado;

    return matchBusqueda && matchGrupo && matchSupervisor && matchEncargado;
  });

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
        {/* Lado Izquierdo: Icono e info */}
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
            <TractorIcon size="1.2rem" color="#fff" />
          </div>
          <span className="text-light opacity-75 small ms-1">{tractores.length} Tractores</span>
        </div>

        {/* Título Centrado en la Página */}
        <div
          style={{
            position: "absolute",
            left: "50%",
            top: "50%",
            transform: "translate(-50%, -50%)",
            textAlign: "center",
            width: "max-content",
            pointerEvents: "none",
          }}
        >
          <span className="text-white fs-6 fw-normal" style={{ letterSpacing: "0.3px" }}>
            Alta de Flota — Tractores
          </span>
        </div>

        {/* Botones de Navegación */}
        <div className="d-flex align-items-center gap-2">
          <button
            onClick={() => navigate(-1)}
            className="btn btn-sm btn-outline-light d-flex align-items-center gap-1.5 rounded-3 px-3 py-1"
            style={{ fontSize: "0.82rem" }}
          >
            <i className="bi bi-arrow-left"></i>
            <span>Volver</span>
          </button>
          <button
            onClick={() => navigate("/tractores")}
            className="btn btn-sm btn-outline-light d-flex align-items-center gap-1.5 rounded-3 px-3 py-1"
            style={{ fontSize: "0.82rem" }}
          >
            <TractorIcon size="1rem" color="#fff" />
            <span>Tractores</span>
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

      {/* Contenedor Principal */}
      <Container
        fluid
        className="px-4 py-3 d-flex flex-column flex-grow-1"
        style={{ maxWidth: "1140px", width: "100%", margin: "0 auto", overflow: "hidden" }}
      >
        {/* Fila Superior: Botones Excel y Nuevo Tractor arriba de los filtros con buen espacio */}
        <div className="d-flex align-items-center justify-content-end gap-3 mb-3">
          <Button
            variant="success"
            size="sm"
            onClick={exportarExcel}
            disabled={tractoresFiltrados.length === 0}
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
            <span>Nuevo Tractor</span>
          </Button>
        </div>

        {/* Barra de Filtros */}
        <Card
          className="shadow-sm border-0 rounded-3 px-3 py-2 bg-white flex-shrink-0"
          style={{ marginBottom: "16px" }}
        >
          <div className="d-flex align-items-center justify-content-between w-100 flex-wrap gap-2.5">
            {/* Buscador de Texto */}
            <div style={{ width: "260px" }}>
              <div className="input-group input-group-sm">
                <span
                  className="input-group-text bg-light border-end-0 text-muted"
                  style={{ padding: "3px 9px", height: "32px" }}
                >
                  <i className="bi bi-search" style={{ fontSize: "0.8rem" }}></i>
                </span>
                <Form.Control
                  type="text"
                  placeholder="Buscar CC, descripción..."
                  value={busqueda}
                  onChange={(e) => setBusqueda(e.target.value)}
                  className={`border-start-0 ps-0 ${busqueda ? "fw-bold filtro-activo" : ""}`}
                  style={{
                    fontSize: "0.82rem",
                    height: "32px",
                    padding: "3px 8px",
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
            </div>

            {/* Filtro por Grupo */}
            <div className="d-flex align-items-center">
              <span
                className="fw-bold text-dark small flex-shrink-0 me-2"
                style={{ fontSize: "0.8rem", letterSpacing: "0.1px" }}
              >
                Grupo:
              </span>
              <div className="input-group input-group-sm" style={{ width: "150px" }}>
                <Form.Select
                  size="sm"
                  value={filtroGrupo}
                  onChange={(e) => setFiltroGrupo(e.target.value)}
                  className={`rounded-3 ${filtroGrupo !== "Todos" ? "rounded-end-0 border-end-0 fw-bold filtro-activo" : ""}`}
                  style={{
                    fontSize: "0.82rem",
                    height: "32px",
                    padding: "3px 24px 3px 8px",
                    color: filtroGrupo !== "Todos" ? "#dc2626" : "#1e293b",
                    fontWeight: filtroGrupo !== "Todos" ? "700" : "normal",
                  }}
                >
                  <option value="Todos">Todos</option>
                  <option value="1">Grupo 1</option>
                  <option value="2">Grupo 2</option>
                  <option value="3">Grupo 3</option>
                  <option value="4">Grupo 4</option>
                  <option value="5">Grupo 5</option>
                  <option value="6">Berdina</option>
                  <option value="7">San Pablo</option>
                </Form.Select>
                {filtroGrupo !== "Todos" && (
                  <button
                    className="btn btn-outline-secondary border-start-0 d-flex align-items-center justify-content-center"
                    type="button"
                    onClick={() => setFiltroGrupo("Todos")}
                    title="Limpiar filtro grupo"
                    style={{ padding: "0 6px", height: "32px" }}
                  >
                    <i className="bi bi-x" style={{ fontSize: "0.9rem" }}></i>
                  </button>
                )}
              </div>
            </div>

            {/* Filtro por Supervisor */}
            <div className="d-flex align-items-center">
              <span
                className="fw-bold text-dark small flex-shrink-0 me-2"
                style={{ fontSize: "0.8rem", letterSpacing: "0.1px" }}
              >
                Supervisor:
              </span>
              <div className="input-group input-group-sm" style={{ width: "175px" }}>
                <Form.Select
                  size="sm"
                  value={filtroSupervisor}
                  onChange={(e) => setFiltroSupervisor(e.target.value)}
                  className={`rounded-3 ${filtroSupervisor !== "Todos" ? "rounded-end-0 border-end-0 fw-bold filtro-activo" : ""}`}
                  style={{
                    fontSize: "0.82rem",
                    height: "32px",
                    padding: "3px 24px 3px 8px",
                    color: filtroSupervisor !== "Todos" ? "#dc2626" : "#1e293b",
                    fontWeight: filtroSupervisor !== "Todos" ? "700" : "normal",
                  }}
                >
                  <option value="Todos">Todos</option>
                  {supervisoresExistentes.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </Form.Select>
                {filtroSupervisor !== "Todos" && (
                  <button
                    className="btn btn-outline-secondary border-start-0 d-flex align-items-center justify-content-center"
                    type="button"
                    onClick={() => setFiltroSupervisor("Todos")}
                    title="Limpiar filtro supervisor"
                    style={{ padding: "0 6px", height: "32px" }}
                  >
                    <i className="bi bi-x" style={{ fontSize: "0.9rem" }}></i>
                  </button>
                )}
              </div>
            </div>

            {/* Filtro por Encargado Gral. */}
            <div className="d-flex align-items-center">
              <span
                className="fw-bold text-dark small flex-shrink-0 me-2"
                style={{ fontSize: "0.8rem", letterSpacing: "0.1px" }}
              >
                Encargado:
              </span>
              <div className="input-group input-group-sm" style={{ width: "170px" }}>
                <Form.Select
                  size="sm"
                  value={filtroEncargado}
                  onChange={(e) => setFiltroEncargado(e.target.value)}
                  className={`rounded-3 ${filtroEncargado !== "Todos" ? "rounded-end-0 border-end-0 fw-bold filtro-activo" : ""}`}
                  style={{
                    fontSize: "0.82rem",
                    height: "32px",
                    padding: "3px 24px 3px 8px",
                    color: filtroEncargado !== "Todos" ? "#dc2626" : "#1e293b",
                    fontWeight: filtroEncargado !== "Todos" ? "700" : "normal",
                  }}
                >
                  <option value="Todos">Todos</option>
                  {encargadosExistentes.map((e) => (
                    <option key={e} value={e}>
                      {e}
                    </option>
                  ))}
                </Form.Select>
                {filtroEncargado !== "Todos" && (
                  <button
                    className="btn btn-outline-secondary border-start-0 d-flex align-items-center justify-content-center"
                    type="button"
                    onClick={() => setFiltroEncargado("Todos")}
                    title="Limpiar filtro encargado"
                    style={{ padding: "0 6px", height: "32px" }}
                  >
                    <i className="bi bi-x" style={{ fontSize: "0.9rem" }}></i>
                  </button>
                )}
              </div>
            </div>
          </div>
        </Card>

        {/* Tabla de Tractores */}
        <div
          className="flex-grow-1 shadow-sm rounded-3 bg-white"
          style={{
            overflowY: "auto",
            overflowX: "auto",
            border: "1px solid #cbd5e1",
          }}
        >
          <Table
            hover
            size="sm"
            className="text-center align-middle mb-0"
            style={{ whiteSpace: "nowrap", fontSize: "0.8rem", width: "100%" }}
          >
            <thead style={{ position: "sticky", top: 0, zIndex: 10, backgroundColor: "#1e293b", color: "#fff" }}>
              <tr className="fw-normal align-middle">
                <th style={{ width: "45px", backgroundColor: "#1e293b", color: "#fff", padding: "8px 4px", fontWeight: "normal" }}>
                  #
                </th>
                <th style={{ width: "110px", backgroundColor: "#1e293b", color: "#fff", padding: "8px 8px", fontWeight: "normal" }}>
                  CC / Tractor
                </th>
                <th style={{ width: "125px", backgroundColor: "#1e293b", color: "#fff", padding: "8px 8px", fontWeight: "normal" }}>
                  Grupo
                </th>
                <th style={{ width: "180px", backgroundColor: "#1e293b", color: "#fff", padding: "8px 8px", fontWeight: "normal" }}>
                  Supervisor
                </th>
                <th style={{ width: "160px", backgroundColor: "#1e293b", color: "#fff", padding: "8px 8px", fontWeight: "normal" }}>
                  Encargado Gral.
                </th>
                <th style={{ backgroundColor: "#1e293b", color: "#fff", padding: "8px 12px", textAlign: "left", fontWeight: "normal" }}>
                  Descripción / Modelo
                </th>
                <th style={{ width: "95px", backgroundColor: "#1e293b", color: "#fff", padding: "8px 8px", fontWeight: "normal" }}>
                  Acciones
                </th>
              </tr>
            </thead>
            <tbody>
              {tractoresFiltrados.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-muted py-4" style={{ fontSize: "0.85rem" }}>
                    {busqueda || filtroGrupo !== "Todos" || filtroSupervisor !== "Todos" || filtroEncargado !== "Todos"
                      ? "No se encontraron tractores con los filtros seleccionados"
                      : "No hay tractores registrados en la flota"}
                  </td>
                </tr>
              ) : (
                tractoresFiltrados.map((t, idx) => {
                  const isEven = idx % 2 === 0;
                  const gruppoNum = t.gruppo ?? 1;
                  const gruppoLabel = GRUPPO_LABELS[gruppoNum] || `Grupo ${gruppoNum}`;
                  const gruppoColor = GRUPPO_COLORS[gruppoNum] || "#475569";

                  return (
                    <tr
                      key={t._id}
                      style={{
                        backgroundColor: isEven ? "#ffffff" : "#f8fafc",
                        borderBottom: "1px solid #e2e8f0",
                        height: "44px",
                      }}
                    >
                      <td className="text-muted" style={{ fontSize: "0.76rem" }}>
                        {idx + 1}
                      </td>
                      <td>
                        <span
                          className="badge px-2.5 py-1 text-white shadow-sm"
                          style={{
                            backgroundColor: "#0f172a",
                            border: "1px solid #475569",
                            fontSize: "0.82rem",
                            letterSpacing: "0.5px",
                            borderRadius: "6px",
                            fontWeight: 700,
                          }}
                        >
                          {t.cc}
                        </span>
                      </td>
                      <td>
                        <span
                          className="badge px-2.5 py-1 text-white shadow-sm"
                          style={{
                            backgroundColor: gruppoColor,
                            fontSize: "0.76rem",
                            borderRadius: "6px",
                            fontWeight: 600,
                          }}
                        >
                          {gruppoLabel}
                        </span>
                      </td>
                      <td className="text-secondary fw-medium">
                        {t.supervisor || "—"}
                      </td>
                      <td className="text-secondary fw-medium">
                        {t.encargadoGral || "—"}
                      </td>
                      <td className="text-start ps-3 fw-semibold text-dark" style={{ wordBreak: "break-word" }}>
                        {t.descripcion || "—"}
                      </td>
                      <td>
                        <div className="d-flex justify-content-center align-items-center gap-1.5">
                          <button
                            onClick={() => abrirEditar(t)}
                            className="btn btn-sm btn-outline-primary d-flex align-items-center justify-content-center rounded-2 p-1"
                            style={{ width: "28px", height: "28px" }}
                            title="Editar tractor"
                          >
                            <i className="bi bi-pencil" style={{ fontSize: "0.8rem" }}></i>
                          </button>
                          <button
                            onClick={() => eliminar(t._id)}
                            className="btn btn-sm btn-outline-danger d-flex align-items-center justify-content-center rounded-2 p-1"
                            style={{ width: "28px", height: "28px" }}
                            title="Eliminar tractor"
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
      </Container>

      {/* Modal Nueva / Editar Tractor */}
      <Modal show={showModal} onHide={cerrarModal} centered contentClassName="border-0 shadow-lg rounded-4 overflow-visible">
        <Modal.Header
          closeButton
          closeVariant="white"
          style={{
            backgroundColor: "#1e293b",
            color: "#fff",
            borderTopLeftRadius: "1rem",
            borderTopRightRadius: "1rem",
            borderBottom: "1px solid rgba(255,255,255,0.1)",
          }}
        >
          <Modal.Title className="fs-6 fw-bold d-flex align-items-center gap-2 text-white">
            <TractorIcon size="1.25rem" color="#10b981" />
            <span>{editando ? "Editar Tractor" : "Nuevo Tractor"}</span>
          </Modal.Title>
        </Modal.Header>
        <Form onSubmit={handleSubmit(onSubmit)}>
          <Modal.Body className="p-4" style={{ overflow: "visible" }}>
            <Row className="g-3">
              <Col md={5}>
                <Form.Label className="fw-semibold text-dark small mb-1">
                  CC / Identificación <span className="text-danger">*</span>
                </Form.Label>
                <Form.Control
                  placeholder="Ej: 01, 150, T-04"
                  className="rounded-3"
                  style={{ fontSize: "0.85rem" }}
                  {...register("cc", {
                    required: "El CC es requerido",
                    maxLength: { value: 50, message: "Máximo 50 caracteres" },
                  })}
                  isInvalid={!!errors.cc}
                />
                <Form.Control.Feedback type="invalid" style={{ fontSize: "0.78rem" }}>
                  {errors.cc?.message}
                </Form.Control.Feedback>
              </Col>

              <Col md={7}>
                <Form.Label className="fw-semibold text-dark small mb-1">Grupo Asignado</Form.Label>
                <Form.Select
                  size="sm"
                  className="rounded-3"
                  style={{ fontSize: "0.85rem", height: "36px" }}
                  {...register("gruppo", { required: true })}
                >
                  <option value={1}>Grupo 1 (Jorge Rosas)</option>
                  <option value={2}>Grupo 2 (Guillermo Bustos)</option>
                  <option value={3}>Grupo 3 (Carlos Chumiento)</option>
                  <option value={4}>Grupo 4 (brandan alejandro)</option>
                  <option value={5}>Grupo 5 (Elio Rojas)</option>
                  <option value={6}>Berdina (Kevin)</option>
                  <option value={7}>San Pablo (Victor)</option>
                </Form.Select>
              </Col>

              <Col md={6}>
                <Form.Label className="fw-semibold text-dark small mb-1">Supervisor</Form.Label>
                <input type="hidden" {...register("supervisor")} />
                <SearchableInputDropdown
                  value={supervisorValue}
                  onChange={(val) => setValue("supervisor", val)}
                  options={supervisoresExistentes}
                  placeholder="Seleccionar o escribir..."
                />
              </Col>

              <Col md={6}>
                <Form.Label className="fw-semibold text-dark small mb-1">Encargado Gral.</Form.Label>
                <input type="hidden" {...register("encargadoGral")} />
                <SearchableInputDropdown
                  value={encargadoValue}
                  onChange={(val) => setValue("encargadoGral", val)}
                  options={encargadosExistentes}
                  placeholder="Seleccionar o escribir..."
                />
              </Col>

              <Col md={12}>
                <Form.Label className="fw-semibold text-dark small mb-1">Descripción / Modelo</Form.Label>
                <Form.Control
                  placeholder="Ej: John Deere 5075E 4WD / Pauny 280A"
                  className="rounded-3"
                  style={{ fontSize: "0.85rem" }}
                  {...register("descripcion", {
                    maxLength: { value: 120, message: "Máximo 120 caracteres" },
                  })}
                  isInvalid={!!errors.descripcion}
                />
                <Form.Control.Feedback type="invalid" style={{ fontSize: "0.78rem" }}>
                  {errors.descripcion?.message}
                </Form.Control.Feedback>
              </Col>
            </Row>
          </Modal.Body>
          <Modal.Footer className="bg-light border-0 py-2.5 px-4" style={{ borderBottomLeftRadius: "1rem", borderBottomRightRadius: "1rem" }}>
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

export default TractoresAltas;

