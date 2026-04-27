import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useForm, useWatch } from "react-hook-form";
import { Button, Modal, Form, Table } from "react-bootstrap";
import Swal from "sweetalert2";

const INTERVAL_KM = 10000;

const formatFecha = (iso) => {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric" });
};

const getEstado = (odoActual, kmsService) => {
  if (odoActual == null || kmsService == null) return null;
  const diff = odoActual - kmsService;
  if (diff >= INTERVAL_KM)        return { label: "Atrasado",       bg: "#c62828", color: "#fff" };
  if (diff >= INTERVAL_KM - 1000) return { label: "a 1.000 Km",     bg: "#f9c600", color: "#333" };
  return                                   { label: "Al día",         bg: "#2e7d32", color: "#fff" };
};

function ServicesUltimoService() {
  const navigate = useNavigate();
  const [showModal, setShowModal] = useState(false);
  const [camionetas, setCamionetas] = useState([]);
  const [ultimos, setUltimos] = useState([]);
  const [ultimosKm, setUltimosKm] = useState([]);
  const [dropOpen, setDropOpen] = useState(false);
  const [filtro, setFiltro] = useState("");
  const dropRef = useRef(null);

  const { register, handleSubmit, setValue, reset, control, formState: { errors } } = useForm({
    defaultValues: {
      camioneta: "",
      fecha: new Date().toISOString().split("T")[0],
      responsable: "",
      kms: "",
      observaciones: "",
    },
  });

  const camionetaId    = useWatch({ control, name: "camioneta" });
  const responsableVal = useWatch({ control, name: "responsable" });

  const cargarTabla = () => Promise.all([
    fetch("/api/services/ultimos").then((r) => r.json()).then(setUltimos).catch(() => setUltimos([])),
    fetch("/api/kilometros/ultimos").then((r) => r.json()).then(setUltimosKm).catch(() => setUltimosKm([])),
  ]);

  useEffect(() => {
    fetch("/api/camionetas")
      .then((r) => r.json())
      .then(setCamionetas)
      .catch(() => setCamionetas([]));
    cargarTabla();
  }, []);

  useEffect(() => {
    const handler = (e) => {
      if (dropRef.current && !dropRef.current.contains(e.target)) {
        setDropOpen(false);
        setFiltro("");
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  useEffect(() => {
    const c = camionetas.find((c) => c._id === camionetaId);
    if (c?.responsable) setValue("responsable", c.responsable);
  }, [camionetaId, camionetas]);

  const abrirModal = (camionetaId = "") => {
    const c   = camionetas.find((c) => c._id === camionetaId);
    const reg = ultimos.find((u) => u.camioneta?._id === camionetaId || u.camioneta === camionetaId);
    reset({
      camioneta:    camionetaId,
      fecha:        new Date().toISOString().split("T")[0],
      responsable:  c?.responsable ?? "",
      kms:          reg?.kms ?? "",
      observaciones: "",
    });
    setShowModal(true);
  };

  const cerrarModal = () => {
    setShowModal(false);
    setFiltro("");
    setDropOpen(false);
  };

  const onSubmit = async (data) => {
    try {
      const res = await fetch("/api/services", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (res.ok) {
        cerrarModal();
        await cargarTabla();
        Swal.fire({ icon: "success", title: "Service guardado", timer: 1500, showConfirmButton: false });
      } else {
        const err = await res.json();
        Swal.fire({ icon: "error", title: "Error", text: err.error });
      }
    } catch {
      Swal.fire({ icon: "error", title: "Sin conexión", text: "No se pudo conectar con el servidor" });
    }
  };

  const responsablesUnicos = camionetas
    .map((c) => c.responsable)
    .filter(Boolean)
    .filter((v, i, arr) => arr.indexOf(v) === i)
    .sort();

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>

      {/* Encabezado */}
      <div className="d-flex justify-content-between align-items-center" style={{ padding: "1rem 2rem 0" }}>
        <h3 className="fw-bold mb-0">Último service — Camionetas</h3>
        <div className="d-flex gap-2">
          <Button onClick={() => navigate("/camionetas/services")} style={{ backgroundColor: "#fff", border: "1px solid #000", color: "#000" }}>
            <i className="bi bi-arrow-left me-2"></i>Services
          </Button>
          <Button onClick={() => navigate("/")} style={{ backgroundColor: "#fff", border: "1px solid #000", color: "#000" }}>
            <i className="bi bi-house-fill me-2"></i>Tablero
          </Button>
        </div>
      </div>

      {/* Tabla */}
      <div style={{ flex: 1, padding: "2rem", overflowY: "auto", overflowX: "auto" }}>

        <div className="d-flex justify-content-center">
          <Table bordered size="sm" className="text-center align-middle" style={{ whiteSpace: "nowrap", fontSize: "0.75rem", width: "auto" }}>
            <thead className="table-dark">
              <tr>
                <th></th>
                <th>Patente</th>
                <th>Fecha</th>
                <th>Km último service</th>
                <th>Observaciones</th>
                <th>Estado</th>
              </tr>
            </thead>
            <tbody>
              {camionetas.map((c) => {
                const reg    = ultimos.find((u) => u.camioneta?._id === c._id || u.camioneta === c._id);
                const km     = ultimosKm.find((u) => u.camioneta?._id === c._id || u.camioneta === c._id);
                const estado = getEstado(km?.kms, reg?.kms);
                return (
                  <tr key={c._id}>
                    <td className="text-center">
                      <button
                        onClick={() => abrirModal(c._id)}
                        style={{ width: "36px", height: "36px", borderRadius: "6px", border: "none", backgroundColor: "#b71c1c", color: "#fff", fontWeight: "bold", fontSize: "1.3rem", lineHeight: 1, cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center", boxShadow: "3px 3px 8px rgba(0,0,0,0.4)", transition: "transform 0.15s ease, box-shadow 0.15s ease" }}
                        onMouseEnter={(e) => { e.currentTarget.style.transform = "scale(1.2)"; e.currentTarget.style.boxShadow = "4px 4px 12px rgba(0,0,0,0.5)"; }}
                        onMouseLeave={(e) => { e.currentTarget.style.transform = "scale(1)"; e.currentTarget.style.boxShadow = "3px 3px 8px rgba(0,0,0,0.4)"; }}
                      >+</button>
                    </td>
                    <td className="text-start">
                      <span style={{ display: "inline-block", backgroundColor: "#2e7d32", color: "#fff", borderRadius: "4px", padding: "2px 8px", fontSize: "0.82rem", boxShadow: "3px 3px 6px rgba(0,0,0,0.35)" }}>
                        {c.patente} — {c.marca}
                      </span>
                    </td>
                    <td>{reg ? formatFecha(reg.fecha) : "—"}</td>
                    <td className="fw-semibold">{reg?.kms ? reg.kms.toLocaleString("es-AR") : "—"}</td>
                    <td className="text-start text-muted" style={{ fontSize: "0.9rem" }}>{reg?.observaciones || "—"}</td>
                    <td>
                      {estado
                        ? <span style={{ display: "inline-block", backgroundColor: estado.bg, color: estado.color, borderRadius: "4px", padding: "5px 14px", fontWeight: "400", fontSize: "1rem", boxShadow: "2px 2px 5px rgba(0,0,0,0.3)" }}>{estado.label}</span>
                        : "—"}
                    </td>
                  </tr>
                );
              })}
              {camionetas.length === 0 && (
                <tr><td colSpan={6} className="text-muted">Sin datos</td></tr>
              )}
            </tbody>
          </Table>
        </div>

      </div>

      {/* Modal */}
      <Modal show={showModal} onHide={cerrarModal} centered contentClassName="border border-secondary">
        <Modal.Header closeButton>
          <Modal.Title className="fw-bold">Cargar Service</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form onSubmit={handleSubmit(onSubmit)}>

            <Form.Group className="mb-3">
              <Form.Label className="fw-semibold">Fecha</Form.Label>
              <Form.Control type="date" className="w-50" {...register("fecha", { required: "Requerido" })} isInvalid={!!errors.fecha} />
              <Form.Control.Feedback type="invalid">{errors.fecha?.message}</Form.Control.Feedback>
            </Form.Group>

            <Form.Group className="mb-3">
              <Form.Label className="fw-semibold">Patente</Form.Label>
              <Form.Select className="w-50" {...register("camioneta", { required: "Seleccioná una camioneta" })} isInvalid={!!errors.camioneta}>
                <option value="">— Seleccionar —</option>
                {camionetas.map((c) => (
                  <option key={c._id} value={c._id}>{c.patente} — {c.marca}</option>
                ))}
              </Form.Select>
              <Form.Control.Feedback type="invalid">{errors.camioneta?.message}</Form.Control.Feedback>
            </Form.Group>

            <Form.Group className="mb-3" ref={dropRef} style={{ position: "relative" }}>
              <Form.Label className="fw-semibold">Responsable</Form.Label>
              <input type="hidden" {...register("responsable")} />
              <Form.Control
                className="w-50"
                placeholder="— Seleccionar o escribir —"
                value={dropOpen ? filtro : responsableVal}
                onChange={(e) => { setFiltro(e.target.value); setValue("responsable", e.target.value); }}
                onFocus={() => { setFiltro(responsableVal); setDropOpen(true); }}
                autoComplete="off"
              />
              {dropOpen && (
                <div style={{ position: "absolute", top: "100%", left: 0, width: "50%", backgroundColor: "#fff", border: "2px solid #aaa", borderRadius: "4px", boxShadow: "0 4px 12px rgba(0,0,0,0.15)", zIndex: 1060, maxHeight: "180px", overflowY: "auto" }}>
                  {responsablesUnicos
                    .filter((r) => r.toLowerCase().includes(filtro.toLowerCase()))
                    .map((r) => (
                      <div
                        key={r}
                        style={{ padding: "8px 16px", cursor: "pointer", backgroundColor: responsableVal === r ? "#e9ecef" : "transparent" }}
                        onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#f0f0f0")}
                        onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = responsableVal === r ? "#e9ecef" : "transparent")}
                        onMouseDown={(e) => {
                          e.preventDefault();
                          setValue("responsable", r);
                          setFiltro("");
                          setDropOpen(false);
                        }}
                      >
                        {r}
                      </div>
                    ))
                  }
                </div>
              )}
            </Form.Group>

            <Form.Group className="mb-3">
              <Form.Label className="fw-semibold">Km último service</Form.Label>
              <Form.Control
                type="number"
                className="w-50"
                placeholder="Ej: 125000"
                {...register("kms", { min: { value: 0, message: "Debe ser positivo" } })}
                isInvalid={!!errors.kms}
              />
              <Form.Control.Feedback type="invalid">{errors.kms?.message}</Form.Control.Feedback>
            </Form.Group>

            <Form.Group className="mb-3">
              <Form.Label className="fw-semibold">Observaciones</Form.Label>
              <Form.Control as="textarea" rows={3} placeholder="Opcional..." {...register("observaciones")} />
            </Form.Group>

            <div className="d-flex justify-content-end gap-2">
              <Button variant="secondary" onClick={cerrarModal}>Cancelar</Button>
              <Button type="submit" style={{ backgroundColor: "#000", border: "1px solid #000", color: "#fff" }}>
                <i className="bi bi-save me-2"></i>Guardar
              </Button>
            </div>

          </Form>
        </Modal.Body>
      </Modal>

    </div>
  );
}

export default ServicesUltimoService;
