import { useEffect, useState } from "react";
import { useParams, useLocation, useNavigate } from "react-router-dom";
import { Container, Button, Form, Table, InputGroup } from "react-bootstrap";
import Swal from "sweetalert2";

const SOMBRA = "3px 3px 6px rgba(0,0,0,0.35)";
const FILA_VACIA        = { nombre: "", costo: "", observaciones: "" };
const TRABAJO_VACIO     = { descripcion: "", hecho: false };

const formatearPeso = (v) => {
  if (v === "" || v == null) return "";
  const n = parseFloat(String(v).replace(/\./g, "").replace(",", "."));
  return isNaN(n) ? "" : n.toLocaleString("es-AR", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
};
const parsearPeso = (v) => parseFloat(String(v).replace(/\./g, "").replace(",", ".")) || 0;

const URGENCIA_COLORES = { baja: "#7aaa80", media: "#c8a800", alta: "#8b4a4a" };
const ESTADOS = ["pendiente", "en proceso", "terminada"];
const ESTADO_COLORES = { pendiente: "#8b4a4a", "en proceso": "#c08a2d", terminada: "#52735a" };
const ESTADO_ICONOS = { pendiente: "bi-clock", "en proceso": "bi-arrow-repeat", terminada: "bi-check-lg" };
const ESTADO_LABELS = { pendiente: "Pendiente", "en proceso": "En proceso", terminada: "Terminada" };

function TareaDetalle() {
  const { camionetaId, trabajoId } = useParams();
  const { state } = useLocation();
  const navigate = useNavigate();

  const patente = state?.patente ?? "—";
  const marca   = state?.marca   ?? "";

  const [loading,      setLoading]      = useState(true);
  const [fecha,        setFecha]        = useState("");
  const [descripcion,  setDescripcion]  = useState("");
  const [urgencia,     setUrgencia]     = useState("baja");
  const [responsable,  setResponsable]  = useState("");
  const [responsablesLista, setResponsablesLista] = useState([]);
  const [estado,       setEstado]       = useState("pendiente");
  const [detalle,           setDetalle]           = useState("");
  const [trabajosRealizados,setTrabajosRealizados] = useState([]);
  const [nuevoTrabajo,      setNuevoTrabajo]       = useState(TRABAJO_VACIO);
  const [repuestos,         setRepuestos]          = useState([]);
  const [nuevaFila,         setNuevaFila]          = useState(FILA_VACIA);

  /* ── Cargar datos ── */
  useEffect(() => {
    const cargarDesdeObj = (t) => {
      setFecha(t.fecha ? t.fecha.split("T")[0] : "");
      setDescripcion(t.descripcion ?? "");
      setUrgencia(t.urgencia ?? "baja");
      setResponsable(t.responsable ?? "");
      setEstado(t.estado ?? "pendiente");
      setDetalle(t.detalle ?? "");
      setTrabajosRealizados(t.trabajosRealizados ?? []);
      setRepuestos(t.repuestos ? t.repuestos.map((r) => ({ ...r, costo: formatearPeso(r.costo) })) : []);
      setLoading(false);
    };

    // Siempre buscar del backend para tener datos frescos
    fetch(`/api/trabajos-camioneta/tarea/${trabajoId}`)
      .then((r) => r.json())
      .then(cargarDesdeObj)
      .catch(() => {
        // Si falla el fetch, usar los datos del state como fallback
        if (state?.trabajo) cargarDesdeObj(state.trabajo);
        else setLoading(false);
      });
  }, [trabajoId]);

  /* ── Cargar lista de responsables (de las camionetas) ── */
  useEffect(() => {
    fetch("/api/camionetas")
      .then((r) => r.json())
      .then((data) => {
        const lista = [...new Set(
          (Array.isArray(data) ? data : []).map((c) => (c.responsable || "").trim()).filter(Boolean)
        )].sort((a, b) => a.localeCompare(b));
        setResponsablesLista(lista);
      })
      .catch(() => setResponsablesLista([]));
  }, []);

  /* ── Trabajos realizados ── */
  const agregarTrabajo = () => {
    if (!nuevoTrabajo.descripcion.trim()) return;
    setTrabajosRealizados((prev) => [...prev, { ...nuevoTrabajo }]);
    setNuevoTrabajo(TRABAJO_VACIO);
  };
  const eliminarTrabajo = (idx) => setTrabajosRealizados((prev) => prev.filter((_, i) => i !== idx));
  const toggleTrabajo   = (idx) =>
    setTrabajosRealizados((prev) => prev.map((t, i) => i === idx ? { ...t, hecho: !t.hecho } : t));
  const editarTrabajo   = (idx, valor) =>
    setTrabajosRealizados((prev) => prev.map((t, i) => i === idx ? { ...t, descripcion: valor } : t));

  /* ── Repuestos ── */
  const agregarFila = () => {
    if (!nuevaFila.nombre.trim()) return;
    setRepuestos((prev) => [...prev, { ...nuevaFila, costo: formatearPeso(nuevaFila.costo) }]);
    setNuevaFila(FILA_VACIA);
  };
  const eliminarFila = (idx) => setRepuestos((prev) => prev.filter((_, i) => i !== idx));
  const editarFila   = (idx, campo, valor) =>
    setRepuestos((prev) => prev.map((r, i) => i === idx ? { ...r, [campo]: valor } : r));

  const totalRepuestos = repuestos.reduce((acc, r) => acc + parsearPeso(r.costo), 0);

  /* ── Guardar ── */
  const guardar = async () => {
    if (!descripcion.trim()) {
      Swal.fire({ icon: "warning", title: "La descripción es requerida" });
      return;
    }
    const lista = repuestos.map(({ nombre, costo, observaciones }) => ({
      nombre, costo: parsearPeso(costo), observaciones,
    }));
    try {
      const res = await fetch(`/api/trabajos-camioneta/${trabajoId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fecha, descripcion, urgencia, responsable, estado, detalle, trabajosRealizados, repuestos: lista }),
      });
      if (res.ok) {
        Swal.fire({ icon: "success", title: "Reparación guardada", timer: 1500, showConfirmButton: false });
        navigate(-1);
      } else {
        const err = await res.json();
        Swal.fire({ icon: "error", title: "Error", text: err.error });
      }
    } catch {
      Swal.fire({ icon: "error", title: "Sin conexión" });
    }
  };

  if (loading) return <Container className="py-5 text-center text-muted">Cargando...</Container>;

  return (
    <Container className="py-4">

      {/* Botones navegación */}
      <div className="d-flex justify-content-end gap-2 mb-2 w-75 mx-auto">
        <Button onClick={() => navigate(-1)} style={{ backgroundColor: "#fff", border: "1px solid #000", color: "#000" }}>
          <i className="bi bi-arrow-left me-2"></i>Volver
        </Button>
        <Button onClick={() => navigate("/camionetas/resumen")} style={{ backgroundColor: "#fff", border: "1px solid #000", color: "#000" }}>
          <i className="bi bi-speedometer me-2"></i>Tablero
        </Button>
        <Button onClick={() => navigate("/")} style={{ backgroundColor: "#fff", border: "1px solid #000", color: "#000" }}>
          <i className="bi bi-house-fill me-2"></i>General
        </Button>
      </div>

      {/* Título */}
      <h3 className="fw-bold mb-4 w-75 mx-auto text-center">
        Reparación —{" "}
        <span style={{ backgroundColor: "#4a6fa5", color: "#fff", borderRadius: "4px", padding: "2px 10px", boxShadow: SOMBRA, fontSize: "1rem" }}>
          {patente}
        </span>
        {marca ? <span className="text-muted fs-5 fw-normal ms-2">— {marca}</span> : ""}
      </h3>

      {/* Estado */}
      <div className="w-75 mx-auto mb-3 d-flex align-items-center gap-3">
        <span className="fw-semibold">Estado:</span>
        <Button
          onClick={() => setEstado((e) => ESTADOS[(ESTADOS.indexOf(e ?? "pendiente") + 1) % ESTADOS.length])}
          style={{
            backgroundColor: ESTADO_COLORES[estado ?? "pendiente"],
            border: "none",
            boxShadow: SOMBRA,
            minWidth: "140px",
            fontWeight: "600",
          }}
        >
          <i className={`bi ${ESTADO_ICONOS[estado ?? "pendiente"]} me-2`}></i>{ESTADO_LABELS[estado ?? "pendiente"]}
        </Button>
        <span className="text-muted" style={{ fontSize: "0.85rem" }}>
          (hacé click para cambiar)
        </span>
        <Button onClick={guardar} className="ms-auto" style={{ backgroundColor: "#2c2c2c", border: "none", color: "#fff" }}>
          <i className="bi bi-save me-2"></i>Guardar
        </Button>
      </div>

      {/* Info básica */}
      <div className="w-75 mx-auto bg-light rounded p-3 mb-3">
        <div className="px-2 py-1 fw-bold text-white rounded mb-3" style={{ backgroundColor: "#2c2c2c", fontSize: "0.85rem" }}>
          DATOS GENERALES
        </div>
        <div className="d-flex gap-3 flex-wrap">
          <div>
            <Form.Label className="fw-semibold">Fecha</Form.Label>
            <Form.Control
              type="date"
              style={{ width: "160px" }}
              value={fecha}
              onChange={(e) => setFecha(e.target.value)}
            />
          </div>
          <div style={{ flex: 1, minWidth: "200px" }}>
            <Form.Label className="fw-semibold">Descripción</Form.Label>
            <Form.Control
              type="text"
              placeholder="Ej: Cambio de correa"
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
            />
          </div>
          <div>
            <Form.Label className="fw-semibold">Urgencia</Form.Label>
            <div>
              <span
                style={{
                  display: "inline-block",
                  padding: "6px 16px",
                  borderRadius: "6px",
                  backgroundColor: URGENCIA_COLORES[urgencia ?? "baja"],
                  color: "#fff",
                  fontWeight: "600",
                  textTransform: "capitalize",
                }}
              >
                {urgencia ?? "baja"}
              </span>
            </div>
          </div>
          <div>
            <Form.Label className="fw-semibold">Responsable</Form.Label>
            <Form.Control
              list="responsables-list"
              placeholder="Seleccionar o escribir nombre"
              style={{ width: "220px" }}
              value={responsable}
              onChange={(e) => setResponsable(e.target.value)}
            />
            <datalist id="responsables-list">
              {responsablesLista.map((r) => (
                <option key={r} value={r} />
              ))}
            </datalist>
          </div>
        </div>
      </div>

      {/* Detalle */}
      <div className="w-75 mx-auto mb-3">
        <div className="px-2 py-1 fw-bold text-white rounded mb-2" style={{ backgroundColor: "#2c2c2c", fontSize: "0.85rem" }}>
          DESCRIPCIÓN DEL PROBLEMA
        </div>
        <Form.Control
          as="textarea"
          rows={6}
          placeholder="Describí aquí el detalle completo de la reparación..."
          value={detalle}
          onChange={(e) => setDetalle(e.target.value)}
          style={{ resize: "vertical", fontSize: "0.95rem" }}
        />
      </div>

      {/* Trabajos realizados */}
      <div className="w-75 mx-auto mb-3">
        <div className="px-2 py-1 fw-bold text-white rounded mb-2" style={{ backgroundColor: "#2c2c2c", fontSize: "0.85rem" }}>
          TRABAJOS REALIZADOS
        </div>
        <div className="d-flex flex-column gap-1 mb-2">
          {trabajosRealizados.length === 0 && (
            <div className="text-muted" style={{ fontSize: "0.9rem" }}>Sin trabajos cargados</div>
          )}
          {trabajosRealizados.map((tr, idx) => (
            <div key={idx} className="d-flex align-items-center gap-2">
              <input
                type="checkbox"
                checked={tr.hecho}
                onChange={() => toggleTrabajo(idx)}
                style={{ width: "18px", height: "18px", cursor: "pointer", accentColor: "#52735a", flexShrink: 0 }}
              />
              <Form.Control
                size="sm"
                value={tr.descripcion}
                onChange={(e) => editarTrabajo(idx, e.target.value)}
                style={{
                  textDecoration: tr.hecho ? "line-through" : "none",
                  color: tr.hecho ? "#888" : "#000",
                  flex: 1,
                }}
              />
              <button type="button" onClick={() => eliminarTrabajo(idx)}
                style={{ background: "none", border: "none", color: "#7a4040", cursor: "pointer", fontSize: "1rem", flexShrink: 0 }}>
                <i className="bi bi-trash"></i>
              </button>
            </div>
          ))}
        </div>
        {/* Fila agregar */}
        <div className="d-flex align-items-center gap-2">
          <input type="checkbox" disabled style={{ width: "18px", height: "18px", flexShrink: 0, opacity: 0.3 }} />
          <Form.Control
            size="sm"
            placeholder="Nuevo trabajo..."
            value={nuevoTrabajo.descripcion}
            onChange={(e) => setNuevoTrabajo((p) => ({ ...p, descripcion: e.target.value }))}
            onKeyDown={(e) => e.key === "Enter" && agregarTrabajo()}
            style={{ flex: 1 }}
          />
          <Button type="button" size="sm" onClick={agregarTrabajo}
            style={{ backgroundColor: "#52735a", border: "none", fontSize: "0.75rem", padding: "4px 10px", flexShrink: 0 }}>
            <i className="bi bi-plus-lg"></i>
          </Button>
        </div>
      </div>

      {/* Repuestos */}
      <div className="w-75 mx-auto mb-4">
        <div className="px-2 py-1 fw-bold text-white rounded mb-2 d-flex justify-content-between align-items-center" style={{ backgroundColor: "#2c2c2c", fontSize: "0.85rem" }}>
          <span>REPUESTOS</span>
          {totalRepuestos > 0 && (
            <span style={{ fontWeight: "400", fontSize: "0.8rem" }}>
              Total: ${totalRepuestos.toLocaleString("es-AR")}
            </span>
          )}
        </div>
        <Table bordered size="sm" className="text-center align-middle mb-0">
          <thead className="table-secondary">
            <tr>
              <th className="text-start">Repuesto</th>
              <th style={{ width: "130px" }}>Costo</th>
              <th>Observaciones</th>
              <th style={{ width: "44px" }}></th>
            </tr>
          </thead>
          <tbody>
            {repuestos.length === 0 && (
              <tr><td colSpan={4} className="text-muted py-2">Sin repuestos cargados</td></tr>
            )}
            {repuestos.map((r, idx) => (
              <tr key={idx}>
                <td>
                  <Form.Control size="sm" value={r.nombre} onChange={(e) => editarFila(idx, "nombre", e.target.value)} />
                </td>
                <td>
                  <InputGroup size="sm">
                    <InputGroup.Text>$</InputGroup.Text>
                    <Form.Control
                      type="text" inputMode="numeric"
                      value={r.costo ?? ""}
                      onChange={(e) => editarFila(idx, "costo", e.target.value.replace(/[^\d]/g, ""))}
                      onBlur={(e)  => editarFila(idx, "costo", formatearPeso(e.target.value))}
                      onFocus={(e) => editarFila(idx, "costo", String(e.target.value).replace(/\./g, ""))}
                      style={{ textAlign: "center" }}
                    />
                  </InputGroup>
                </td>
                <td>
                  <Form.Control size="sm" value={r.observaciones} onChange={(e) => editarFila(idx, "observaciones", e.target.value)} />
                </td>
                <td>
                  <button type="button" onClick={() => eliminarFila(idx)}
                    style={{ background: "none", border: "none", color: "#7a4040", cursor: "pointer", fontSize: "1rem" }}>
                    <i className="bi bi-trash"></i>
                  </button>
                </td>
              </tr>
            ))}

            {/* Fila agregar */}
            <tr style={{ backgroundColor: "#f8f9fa" }}>
              <td>
                <Form.Control size="sm" placeholder="Repuesto..." value={nuevaFila.nombre}
                  onChange={(e) => setNuevaFila((p) => ({ ...p, nombre: e.target.value }))}
                  onKeyDown={(e) => e.key === "Enter" && agregarFila()} />
              </td>
              <td>
                <InputGroup size="sm">
                  <InputGroup.Text>$</InputGroup.Text>
                  <Form.Control
                    type="text" inputMode="numeric" placeholder="0"
                    value={nuevaFila.costo}
                    onChange={(e) => setNuevaFila((p) => ({ ...p, costo: e.target.value.replace(/[^\d]/g, "") }))}
                    onBlur={(e)  => setNuevaFila((p) => ({ ...p, costo: formatearPeso(e.target.value) }))}
                    onFocus={(e) => setNuevaFila((p) => ({ ...p, costo: String(e.target.value).replace(/\./g, "") }))}
                    style={{ textAlign: "center" }}
                    onKeyDown={(e) => e.key === "Enter" && agregarFila()} />
                </InputGroup>
              </td>
              <td>
                <Form.Control size="sm" placeholder="Observaciones..." value={nuevaFila.observaciones}
                  onChange={(e) => setNuevaFila((p) => ({ ...p, observaciones: e.target.value }))}
                  onKeyDown={(e) => e.key === "Enter" && agregarFila()} />
              </td>
              <td>
                <Button type="button" size="sm" onClick={agregarFila}
                  style={{ backgroundColor: "#52735a", border: "none", fontSize: "0.75rem", padding: "2px 8px" }}>
                  <i className="bi bi-plus-lg"></i>
                </Button>
              </td>
            </tr>
          </tbody>
        </Table>
      </div>

    </Container>
  );
}

export default TareaDetalle;
