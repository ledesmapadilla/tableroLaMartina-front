import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Container, Button, Modal, Form } from "react-bootstrap";
import Swal from "sweetalert2";
import { isMobile } from "../../utils/device";

const API = "/api/visitas";

const DIAS = ["Lun", "Mar", "Mié", "Jue", "Vie"];
const MESES_NOMBRE = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];
const COLOR = "#3a7070";

const GRUPOS = [
  { label: "Grupo 1",   color: "#4a6fa5" },
  { label: "Grupo 2",   color: "#52735a" },
  { label: "Grupo 3",   color: "#9e8850" },
  { label: "Grupo 4",   color: "#6b5b7b" },
  { label: "Grupo 5",   color: "#7a5038" },
  { label: "NINGUNA",   color: "#777"    },
  { label: "Berdina",   color: "#7a3535" },
  { label: "San Pablo", color: "#5a6f40" },
  { label: "Repuestos", color: "#8e44ad" },
];

const ITINERARIO = [
  { dia: "Día 1", manana: "Visita a Campo", tarde: "Visita San Pablo" },
  { dia: "Día 2", manana: "Visita Berdina", tarde: "Repuestos Berdina" },
  { dia: "Día 3", manana: "Visita a Campo", tarde: "Visita a Campo" },
  { dia: "Día 4", manana: "Visita a Campo", tarde: "Repuestos San Pablo" },
  { dia: "Día 5", manana: "Visita a Campo", tarde: "Resumen semanal" }
];

function colorGrupo(label) {
  return GRUPOS.find((g) => g.label === label)?.color ?? COLOR;
}

function celdasMes(año, mes) {
  const totalDias = new Date(año, mes + 1, 0).getDate();
  const arr = [];
  let offsetSet = false;
  for (let d = 1; d <= totalDias; d++) {
    const dow = new Date(año, mes, d).getDay();
    if (dow === 0 || dow === 6) continue;
    if (!offsetSet) {
      for (let i = 0; i < dow - 1; i++) arr.push(null);
      offsetSet = true;
    }
    arr.push(d);
  }
  return arr;
}

function toKey(año, mes, dia) {
  return `${año}-${String(mes + 1).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;
}

const formVacio = { grupo: "", observaciones: "" };

function Visitas() {
  const navigate = useNavigate();
  const hoy = new Date();

  const [año, setAño]       = useState(hoy.getFullYear());
  const [mes, setMes]       = useState(hoy.getMonth());
  const [visitas, setVisitas] = useState({});
  const [diaModal, setDiaModal] = useState(null);
  const [form, setForm]     = useState(formVacio);
  const [error, setError]   = useState(false);
  const [tractores, setTractores] = useState([]);
  const [mostrarItinerario, setMostrarItinerario] = useState(false);

  const retroceder = () => {
    if (año === 2026 && mes === 4) return;
    if (mes === 0) { setMes(11); setAño((a) => a - 1); }
    else setMes((m) => m - 1);
  };

  const avanzar = () => {
    if (mes === 11) { setMes(0); setAño((a) => a + 1); }
    else setMes((m) => m + 1);
  };

  const cargar = async () => {
    try {
      const res = await fetch(API);
      const data = await res.json();
      const agrupadas = {};
      (Array.isArray(data) ? data : []).forEach((v) => {
        (agrupadas[v.fecha] ??= []).push(v);
      });
      setVisitas(agrupadas);
    } catch {
      setVisitas({});
    }
  };

  useEffect(() => { cargar(); }, []);

  useEffect(() => {
    fetch("/api/tractores")
      .then((r) => r.json())
      .then((d) => setTractores(Array.isArray(d) ? d : []))
      .catch(() => setTractores([]));
  }, []);

  const abrirDia = (dia) => {
    setDiaModal(dia);
    setForm(formVacio);
    setError(false);
  };

  const agregarVisita = async () => {
    if (!form.grupo) { setError(true); return; }
    const key = toKey(año, mes, diaModal);
    try {
      const res = await fetch(API, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fecha: key, grupo: form.grupo, observaciones: form.observaciones }),
      });
      if (!res.ok) throw new Error();
      const nueva = await res.json();
      setVisitas((prev) => ({ ...prev, [key]: [...(prev[key] ?? []), nueva] }));
      setForm(formVacio);
      setError(false);
      setDiaModal(null);
      Swal.fire({ icon: "success", title: "Visita registrada", timer: 1500, showConfirmButton: false });
    } catch {
      setError(true);
      Swal.fire({ icon: "error", title: "Error", text: "No se pudo guardar la visita" });
    }
  };

  const eliminarVisita = async (key, idx) => {
    const visita = (visitas[key] ?? [])[idx];
    if (!visita?._id) return;
    const result = await Swal.fire({
      title: "¿Eliminar visita?",
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#7a4040",
      confirmButtonText: "Sí, eliminar",
      cancelButtonText: "Cancelar",
    });
    if (!result.isConfirmed) return;
    try {
      const res = await fetch(`${API}/${visita._id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      setVisitas((prev) => {
        const lista = [...(prev[key] ?? [])];
        lista.splice(idx, 1);
        return { ...prev, [key]: lista };
      });
      await Swal.fire({ icon: "success", title: "Visita eliminada", timer: 1200, showConfirmButton: false });
      setDiaModal(null);
    } catch {
      Swal.fire({ icon: "error", title: "Error", text: "No se pudo eliminar la visita" });
    }
  };

  const dias        = celdasMes(año, mes);
  const hoyKey      = toKey(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());
  const keyModal    = diaModal ? toKey(año, mes, diaModal) : null;
  const visitasModal = keyModal ? (visitas[keyModal] ?? []) : [];
  const esMinimoMes = año === 2026 && mes === 4;

  const getModalTitle = () => {
    if (!diaModal) return "";
    const dateObj = new Date(año, mes, diaModal);
    const diasSemana = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
    const nombreDia = diasSemana[dateObj.getDay()];
    return `${nombreDia}, ${diaModal} de ${MESES_NOMBRE[mes]} de ${año}`;
  };

  return (
    <Container className={isMobile ? "py-2 px-2" : "py-4"}>

      {/* Encabezado */}
      <div className={`d-flex justify-content-between align-items-center ${isMobile ? "mb-2" : "mb-4"}`}>
        <h3 className="fw-bold mb-0" style={{ fontSize: isMobile ? "1.25rem" : undefined }}>Visitas</h3>
        {!isMobile && (
          <Button onClick={() => navigate("/")} style={{ backgroundColor: "#fff", border: "1px solid #000", color: "#000" }}>
            <i className="bi bi-house-fill me-2"></i>General
          </Button>
        )}
      </div>

      {/* Navegación mes */}
      <div className={`d-flex align-items-center justify-content-center ${isMobile ? "gap-3 mb-2" : "gap-4 mb-4"}`}>
        <button
          onClick={retroceder}
          style={{ ...estiloNavBtn, opacity: esMinimoMes ? 0.3 : 1, cursor: esMinimoMes ? "default" : "pointer" }}
        >
          <i className="bi bi-chevron-left"></i>
        </button>
        <span style={{ fontSize: isMobile ? "1.1rem" : "1.5rem", fontWeight: "bold", minWidth: isMobile ? "150px" : "250px", textAlign: "center" }}>
          {MESES_NOMBRE[mes]} {año}
        </span>
        <button onClick={avanzar} style={estiloNavBtn}>
          <i className="bi bi-chevron-right"></i>
        </button>
      </div>

      {/* Calendario */}
      <div style={{ maxWidth: "860px", margin: "0 auto" }}>

        {/* Encabezados */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(5, minmax(0, 1fr))", gap: isMobile ? "3px" : "4px", marginBottom: isMobile ? "3px" : "4px" }}>
          {DIAS.map((d) => {
            return (
              <div
                key={d}
                style={{
                  textAlign: "center",
                  fontWeight: "700",
                  fontSize: isMobile ? "0.7rem" : "0.82rem",
                  color: "#666",
                  padding: isMobile ? "2px 0" : "6px 0",
                  letterSpacing: "0.5px"
                }}
              >
                {d}
              </div>
            );
          })}
        </div>

        {/* Celdas */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(5, minmax(0, 1fr))", gap: isMobile ? "3px" : "4px" }}>
          {dias.map((dia, idx) => {
            if (!dia) return <div key={`v-${idx}`} />;
            const key    = toKey(año, mes, dia);
            const vDia   = visitas[key] ?? [];
            const esHoy  = key === hoyKey;

            const bgCell = esHoy
              ? "#eef6f6"
              : "#fff";

            const hoverBgCell = esHoy
              ? "#dbebeb"
              : "#f0f6f6";

            const colorText = esHoy
              ? COLOR
              : "#333";

            return (
              <div
                key={key}
                onClick={() => abrirDia(dia)}
                style={{
                  border: esHoy ? `2px solid ${COLOR}` : "1.5px solid #ddd",
                  borderRadius: isMobile ? "6px" : "8px",
                  padding: isMobile ? "4px 3px" : "8px 6px",
                  height: isMobile ? "64px" : "100px",
                  cursor: "pointer",
                  backgroundColor: bgCell,
                  transition: "background-color 0.15s",
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "flex-start",
                  overflow: "hidden"
                }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = hoverBgCell)}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = bgCell)}
              >
                <div style={{ fontWeight: esHoy ? "bold" : "normal", fontSize: isMobile ? "0.75rem" : "0.88rem", color: colorText, marginBottom: isMobile ? "1px" : "3px", textAlign: "center", flexShrink: 0 }}>
                  {dia}
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "2px", overflow: "hidden", flexGrow: 1 }}>
                  {vDia.slice(0, 2).map((v, i) => (
                    <div
                      key={i}
                      style={{
                        color: colorGrupo(v.grupo),
                        fontWeight: "600",
                        textAlign: "center",
                        padding: "0 2px",
                        fontSize: isMobile ? "0.58rem" : "0.68rem",
                        whiteSpace: "normal",
                        wordBreak: "break-word",
                        lineHeight: "1.1",
                        maxHeight: isMobile ? "14px" : "24px",
                        overflow: "hidden"
                      }}
                    >
                      {v.grupo}
                    </div>
                  ))}
                  {vDia.length > 2 && (
                    <div style={{ fontSize: isMobile ? "0.58rem" : "0.68rem", color: "#888", textAlign: "center", flexShrink: 0, marginTop: "auto" }}>
                      +{vDia.length - 2} más
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Leyenda: grupo — supervisor (desde altas de tractores) */}
      <div style={{ maxWidth: "860px", margin: "1.5rem auto 0", display: "flex", justifyContent: "space-between", alignItems: "center", gap: "10px" }}>
        <div style={{ flex: 1 }}>
          {[1, 2, 3, 4, 5].map((g) => {
            const label = `Grupo ${g}`;
            const sups = [...new Set(
              tractores
                .filter((t) => (t.gruppo ?? 6) === g)
                .map((t) => (t.supervisor || "").trim())
                .filter(Boolean)
            )];
            return (
              <div key={g} className="d-flex align-items-center mb-1" style={{ fontSize: isMobile ? "0.78rem" : "0.9rem" }}>
                <span style={{ display: "inline-block", width: "12px", height: "12px", borderRadius: "3px", backgroundColor: colorGrupo(label), marginRight: "8px", flexShrink: 0 }} />
                <span className="fw-semibold" style={{ minWidth: isMobile ? "55px" : "70px" }}>{label}:</span>
                <span className="ms-2 text-truncate" style={{ maxWidth: isMobile ? "100px" : "none" }}>{sups.length ? sups.join(", ") : "—"}</span>
              </div>
            );
          })}
        </div>
        <div style={{ flexShrink: 0 }}>
          <Button
            onClick={() => setMostrarItinerario(true)}
            style={{
              backgroundColor: COLOR,
              borderColor: COLOR,
              color: "#fff",
              fontWeight: "bold",
              padding: isMobile ? "6px 12px" : "8px 16px",
              fontSize: isMobile ? "0.82rem" : "1rem"
            }}
          >
            <i className="bi bi-journal-text me-2"></i>Itinerario
          </Button>
        </div>
      </div>

      {/* Modal de Itinerario */}
      <Modal show={mostrarItinerario} onHide={() => setMostrarItinerario(false)} size="lg" centered contentClassName="border border-dark">
        <Modal.Header closeButton style={{ backgroundColor: "#3a7070", color: "#fff" }}>
          <Modal.Title className="fw-bold" style={{ fontSize: isMobile ? "1.1rem" : "1.25rem" }}>
            <i className="bi bi-calendar4-week me-2"></i>Itinerario de Visitas
          </Modal.Title>
        </Modal.Header>
        <Modal.Body className={isMobile ? "p-2" : "p-4"} style={{ backgroundColor: "#fdfdfd" }}>
          <div className="table-responsive" style={{ overflowX: "hidden" }}>
            <table className="table table-bordered align-middle text-center" style={{ width: "100%", borderRadius: "8px", overflow: "hidden", borderCollapse: "separate", borderSpacing: "0", margin: "0" }}>
              <thead>
                <tr style={{ backgroundColor: "#3a7070", color: "#fff" }}>
                  <th style={{ padding: isMobile ? "6px 4px" : "12px", border: "1px solid #2e5959", fontWeight: "700", fontSize: isMobile ? "0.78rem" : "0.95rem" }}>Día</th>
                  <th style={{ padding: isMobile ? "6px 4px" : "12px", border: "1px solid #2e5959", fontWeight: "700", fontSize: isMobile ? "0.78rem" : "0.95rem" }}>
                    <i className="bi bi-sun-fill text-warning me-1"></i>Mañana
                  </th>
                  <th style={{ padding: isMobile ? "6px 4px" : "12px", border: "1px solid #2e5959", fontWeight: "700", fontSize: isMobile ? "0.78rem" : "0.95rem" }}>
                    <i className="bi bi-sunset-fill me-1" style={{ color: "#fd7e14" }}></i>Tarde
                  </th>
                </tr>
              </thead>
              <tbody>
                {ITINERARIO.map((item, idx) => {
                  const getBadgeStyle = (text) => {
                    const t = (text || "").trim();
                    if (t === "Visita a Campo") {
                      return {
                        backgroundColor: "#e6fffa",
                        color: "#006d5b",
                        borderColor: "#b2f5ea"
                      };
                    }
                    if (t === "Visita San Pablo" || t === "Visita Berdina") {
                      return {
                        backgroundColor: "#ebf8ff",
                        color: "#2b6cb0",
                        borderColor: "#bee3f8"
                      };
                    }
                    if (t === "Repuestos San Pablo" || t === "Repuestos Berdina") {
                      return {
                        backgroundColor: "#fff5ed",
                        color: "#a05820",
                        borderColor: "#ffe3d1"
                      };
                    }
                    if (t === "Resumen semanal") {
                      return {
                        backgroundColor: "#f3e8ff",
                        color: "#6b21a8",
                        borderColor: "#e9d5ff"
                      };
                    }
                    return {
                      backgroundColor: "#f8f9fa",
                      color: "#333",
                      borderColor: "#dee2e6"
                    };
                  };

                  return (
                    <tr key={idx} style={{ backgroundColor: idx % 2 === 0 ? "#f9fbfb" : "#ffffff" }}>
                      <td className="fw-bold" style={{ padding: isMobile ? "6px 4px" : "12px", border: "1px solid #dee2e6", color: "#495057", fontSize: isMobile ? "0.75rem" : "0.95rem", width: isMobile ? "50px" : "100px" }}>
                        {item.dia}
                      </td>
                      <td style={{ padding: isMobile ? "6px 4px" : "12px", border: "1px solid #dee2e6" }}>
                        <span
                          style={{
                            display: "block",
                            padding: isMobile ? "4px 6px" : "6px 12px",
                            borderRadius: "20px",
                            fontSize: isMobile ? "0.7rem" : "0.88rem",
                            fontWeight: "600",
                            textAlign: "center",
                            whiteSpace: "normal",
                            wordBreak: "break-word",
                            lineHeight: "1.2",
                            ...getBadgeStyle(item.manana)
                          }}
                        >
                          {item.manana}
                        </span>
                      </td>
                      <td style={{ padding: isMobile ? "6px 4px" : "12px", border: "1px solid #dee2e6" }}>
                        <span
                          style={{
                            display: "block",
                            padding: isMobile ? "4px 6px" : "6px 12px",
                            borderRadius: "20px",
                            fontSize: isMobile ? "0.7rem" : "0.88rem",
                            fontWeight: "600",
                            textAlign: "center",
                            whiteSpace: "normal",
                            wordBreak: "break-word",
                            lineHeight: "1.2",
                            ...getBadgeStyle(item.tarde)
                          }}
                        >
                          {item.tarde}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setMostrarItinerario(false)}>
            Cerrar
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Modal */}
      <Modal show={diaModal !== null} onHide={() => setDiaModal(null)} centered contentClassName="border border-dark">
        <Modal.Header closeButton>
          <Modal.Title className="fw-bold">
            {getModalTitle()}
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>

          {/* Visitas ya registradas */}
          {visitasModal.length > 0 && (
            <div className="mb-4">
              <p className="fw-semibold mb-2">Visitas del día:</p>
              {visitasModal.map((v, i) => (
                <div
                  key={i}
                  style={{
                    borderLeft: `4px solid ${colorGrupo(v.grupo)}`,
                    backgroundColor: "#f8f8f8",
                    borderRadius: "6px",
                    padding: "8px 12px",
                    marginBottom: "6px",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    gap: "8px",
                  }}
                >
                  <span style={{ fontSize: "0.95rem" }}>
                    <strong style={{ color: colorGrupo(v.grupo) }}>{v.grupo}</strong>
                    {v.observaciones ? <span className="text-muted"> — {v.observaciones}</span> : ""}
                  </span>
                  <button
                    onClick={() => eliminarVisita(keyModal, i)}
                    style={{ background: "none", border: "none", cursor: "pointer", color: "#8b4a4a", padding: "0 4px" }}
                  >
                    <i className="bi bi-trash"></i>
                  </button>
                </div>
              ))}
              <div style={{ height: "1px", backgroundColor: "#bbb", margin: "12px 0 0" }} />
            </div>
          )}

          {/* Formulario */}
          <p className="fw-semibold mb-2">{visitasModal.length > 0 ? "Agregar otra visita:" : "Nueva visita:"}</p>

          <Form.Group className="mb-3">
            <Form.Label className="fw-semibold">Grupo *</Form.Label>
            <Form.Select
              value={form.grupo}
              onChange={(e) => { setForm((f) => ({ ...f, grupo: e.target.value })); setError(false); }}
              isInvalid={error}
              autoFocus
            >
              <option value="">— Seleccionar —</option>
              {GRUPOS.map((g) => (
                <option key={g.label} value={g.label}>{g.label}</option>
              ))}
            </Form.Select>
            {error && <Form.Control.Feedback type="invalid">Seleccioná un grupo</Form.Control.Feedback>}
          </Form.Group>

          <Form.Group className="mb-1">
            <Form.Label className="fw-semibold">Observaciones</Form.Label>
            <Form.Control
              type="text"
              placeholder="Observaciones..."
              value={form.observaciones}
              onChange={(e) => setForm((f) => ({ ...f, observaciones: e.target.value }))}
              onKeyDown={(e) => e.key === "Enter" && agregarVisita()}
            />
          </Form.Group>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setDiaModal(null)}>Cerrar</Button>
          <Button onClick={agregarVisita} style={{ backgroundColor: COLOR, border: "none", color: "#fff" }}>
            <i className="bi bi-save me-2"></i>Guardar
          </Button>
        </Modal.Footer>
      </Modal>

    </Container>
  );
}

const estiloNavBtn = {
  background: "none",
  border: "1.5px solid #bbb",
  borderRadius: "6px",
  padding: "6px 16px",
  fontSize: "1.1rem",
  cursor: "pointer",
  transition: "background-color 0.15s",
};

export default Visitas;
