import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Container, Button, Modal, Form } from "react-bootstrap";

const DIAS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
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
    if (dow === 0) continue;
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

  const retroceder = () => {
    if (año === 2026 && mes === 4) return;
    if (mes === 0) { setMes(11); setAño((a) => a - 1); }
    else setMes((m) => m - 1);
  };

  const avanzar = () => {
    if (mes === 11) { setMes(0); setAño((a) => a + 1); }
    else setMes((m) => m + 1);
  };

  const abrirDia = (dia) => {
    setDiaModal(dia);
    setForm(formVacio);
    setError(false);
  };

  const agregarVisita = () => {
    if (!form.grupo) { setError(true); return; }
    const key = toKey(año, mes, diaModal);
    setVisitas((prev) => ({ ...prev, [key]: [...(prev[key] ?? []), { ...form }] }));
    setForm(formVacio);
    setError(false);
    setDiaModal(null);
  };

  const eliminarVisita = (key, idx) => {
    setVisitas((prev) => {
      const lista = [...(prev[key] ?? [])];
      lista.splice(idx, 1);
      return { ...prev, [key]: lista };
    });
  };

  const dias        = celdasMes(año, mes);
  const hoyKey      = toKey(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());
  const keyModal    = diaModal ? toKey(año, mes, diaModal) : null;
  const visitasModal = keyModal ? (visitas[keyModal] ?? []) : [];
  const esMinimoMes = año === 2026 && mes === 4;

  return (
    <Container className="py-4">

      {/* Encabezado */}
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h3 className="fw-bold mb-0">Visitas</h3>
        <Button onClick={() => navigate("/")} style={{ backgroundColor: "#fff", border: "1px solid #000", color: "#000" }}>
          <i className="bi bi-house-fill me-2"></i>General
        </Button>
      </div>

      {/* Navegación mes */}
      <div className="d-flex align-items-center justify-content-center gap-4 mb-4">
        <button
          onClick={retroceder}
          style={{ ...estiloNavBtn, opacity: esMinimoMes ? 0.3 : 1, cursor: esMinimoMes ? "default" : "pointer" }}
        >
          <i className="bi bi-chevron-left"></i>
        </button>
        <span style={{ fontSize: "1.5rem", fontWeight: "bold", minWidth: "250px", textAlign: "center" }}>
          {MESES_NOMBRE[mes]} {año}
        </span>
        <button onClick={avanzar} style={estiloNavBtn}>
          <i className="bi bi-chevron-right"></i>
        </button>
      </div>

      {/* Calendario */}
      <div style={{ maxWidth: "860px", margin: "0 auto" }}>

        {/* Encabezados */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: "4px", marginBottom: "4px" }}>
          {DIAS.map((d) => (
            <div key={d} style={{ textAlign: "center", fontWeight: "700", fontSize: "0.82rem", color: "#666", padding: "6px 0", letterSpacing: "0.5px" }}>
              {d}
            </div>
          ))}
        </div>

        {/* Celdas */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: "4px" }}>
          {dias.map((dia, idx) => {
            if (!dia) return <div key={`v-${idx}`} />;
            const key    = toKey(año, mes, dia);
            const vDia   = visitas[key] ?? [];
            const esHoy  = key === hoyKey;
            return (
              <div
                key={key}
                onClick={() => abrirDia(dia)}
                style={{
                  border: esHoy ? `2px solid ${COLOR}` : "1.5px solid #ddd",
                  borderRadius: "8px",
                  padding: "8px 7px",
                  minHeight: "88px",
                  cursor: "pointer",
                  backgroundColor: esHoy ? "#eef6f6" : "#fff",
                  transition: "background-color 0.15s",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#f0f6f6")}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = esHoy ? "#eef6f6" : "#fff")}
              >
                <div style={{ fontWeight: esHoy ? "bold" : "normal", fontSize: "0.88rem", color: esHoy ? COLOR : "#333", marginBottom: "5px", textAlign: "center" }}>
                  {dia}
                </div>
                {vDia.slice(0, 2).map((v, i) => (
                  <div key={i} style={{ color: colorGrupo(v.grupo), fontWeight: "600", textAlign: "center", padding: "2px 5px", fontSize: "0.68rem", marginBottom: "2px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {v.grupo}
                  </div>
                ))}
                {vDia.length > 2 && (
                  <div style={{ fontSize: "0.68rem", color: "#888" }}>+{vDia.length - 2} más</div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Modal */}
      <Modal show={diaModal !== null} onHide={() => setDiaModal(null)} centered contentClassName="border border-dark">
        <Modal.Header closeButton>
          <Modal.Title className="fw-bold">
            {diaModal} de {MESES_NOMBRE[mes]} {año}
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
