import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import Swal from "sweetalert2";
import { Container, Table, Button, Form, Card } from "react-bootstrap";

const MESES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

// Los turnos que más se repiten en la planilla: completan ingreso y egreso de
// un toque en lugar de tipearlos.
const TURNOS_FRECUENTES = [
  ["06:00", "14:00"],
  ["07:00", "15:00"],
  ["14:00", "22:00"],
  ["22:00", "06:00"],
];

const FORM_VACIO = {
  fecha: "",
  persona: "",
  cc: "",
  horaIngreso: "",
  horaEgreso: "",
  lote: "",
  observacion: "",
  tarea: "",
  cantidad: "",
  combustible: "",
  turbo: "",
};

const soloFecha = (iso) => (iso || "").slice(0, 10);

const formatFecha = (iso) => {
  const [a, m, d] = soloFecha(iso).split("-");
  return d ? `${d}/${m}` : "—";
};

// Mismo cálculo que hace el backend, para mostrar el total mientras se carga.
const calcularHoras = (ingreso, egreso) => {
  const aMin = (h) => {
    const m = /^(\d{1,2}):(\d{2})$/.exec((h || "").trim());
    if (!m) return null;
    const hs = Number(m[1]);
    const min = Number(m[2]);
    return hs > 23 || min > 59 ? null : hs * 60 + min;
  };
  const i = aMin(ingreso);
  const e = aMin(egreso);
  if (i === null || e === null) return 0;
  const minutos = e >= i ? e - i : 1440 - i + e;
  return Math.round((minutos / 60) * 100) / 100;
};

function ProduccionCertificadoMes() {
  const { anio, mes } = useParams();
  const navigate = useNavigate();

  const [periodo, setPeriodo] = useState({ desde: "", hasta: "" });
  const [partes, setPartes] = useState([]);
  const [personal, setPersonal] = useState([]);
  const [centros, setCentros] = useState([]);
  const [tareas, setTareas] = useState([]);

  const [form, setForm] = useState(FORM_VACIO);
  const [editando, setEditando] = useState(null);
  const [guardando, setGuardando] = useState(false);
  const refPersona = useRef(null);

  const titulo = `${MESES[Number(mes) - 1] || ""} ${anio}`;

  // ── carga de datos ────────────────────────────────────────────────
  const cargarPeriodo = async () => {
    try {
      const res = await fetch(`/api/periodos/${anio}/${mes}`);
      const data = await res.json();
      setPeriodo({ desde: soloFecha(data.desde), hasta: soloFecha(data.hasta) });
      return { desde: soloFecha(data.desde), hasta: soloFecha(data.hasta) };
    } catch {
      return null;
    }
  };

  const cargarPartes = async (rango) => {
    if (!rango?.desde || !rango?.hasta) return;
    try {
      const res = await fetch(`/api/partes?desde=${rango.desde}&hasta=${rango.hasta}`);
      const data = res.ok ? await res.json() : [];
      setPartes(Array.isArray(data) ? data : []);
    } catch {
      setPartes([]);
    }
  };

  const cargarPadrones = async () => {
    const pedir = async (url) => {
      try {
        const res = await fetch(url);
        const data = res.ok ? await res.json() : [];
        return Array.isArray(data) ? data : [];
      } catch {
        return [];
      }
    };
    setPersonal(await pedir("/api/personal"));
    setCentros(await pedir("/api/centros-costo"));
    setTareas(await pedir("/api/tareas"));
  };

  useEffect(() => {
    (async () => {
      const rango = await cargarPeriodo();
      await cargarPadrones();
      await cargarPartes(rango);
      setForm((f) => ({ ...f, fecha: rango?.desde || "" }));
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [anio, mes]);

  // ── período ───────────────────────────────────────────────────────
  const guardarPeriodo = async () => {
    if (!periodo.desde || !periodo.hasta) return;
    try {
      const res = await fetch(`/api/periodos/${anio}/${mes}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(periodo),
      });
      if (res.ok) {
        await cargarPartes(periodo);
        Swal.fire({ icon: "success", title: "Período actualizado", timer: 1200, showConfirmButton: false });
      } else {
        const err = await res.json();
        Swal.fire({ icon: "error", title: "Error", text: err.error || "No se pudo guardar el período" });
      }
    } catch {
      Swal.fire({ icon: "error", title: "Sin conexión", text: "No se pudo conectar con el servidor" });
    }
  };

  // ── alta / edición de partes ──────────────────────────────────────
  const cambiar = (campo, valor) => setForm((f) => ({ ...f, [campo]: valor }));

  const aplicarTurno = ([ingreso, egreso]) =>
    setForm((f) => ({ ...f, horaIngreso: ingreso, horaEgreso: egreso }));

  const limpiarForm = () => {
    setForm({ ...FORM_VACIO, fecha: form.fecha });
    setEditando(null);
    refPersona.current?.focus();
  };

  const guardarParte = async () => {
    if (!form.fecha || !form.persona) {
      Swal.fire({ icon: "warning", title: "Faltan datos", text: "La fecha y la persona son obligatorias" });
      return;
    }
    setGuardando(true);
    try {
      const url = editando ? `/api/partes/${editando}` : "/api/partes";
      const res = await fetch(url, {
        method: editando ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (res.ok) {
        await cargarPartes(periodo);
        limpiarForm();
      } else {
        const err = await res.json();
        Swal.fire({ icon: "error", title: "Error", text: err.error || "No se pudo guardar" });
      }
    } catch {
      Swal.fire({ icon: "error", title: "Sin conexión", text: "No se pudo conectar con el servidor" });
    } finally {
      setGuardando(false);
    }
  };

  // Enter guarda y deja todo listo para el parte siguiente.
  const alPresionarEnter = (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      guardarParte();
    }
  };

  const editarParte = (p) => {
    setEditando(p._id);
    setForm({
      fecha: soloFecha(p.fecha),
      persona: p.persona?._id || "",
      cc: p.cc?._id || "",
      horaIngreso: p.horaIngreso || "",
      horaEgreso: p.horaEgreso || "",
      lote: p.lote || "",
      observacion: p.observacion || "",
      tarea: p.tarea?._id || "",
      cantidad: p.cantidad ?? "",
      combustible: p.combustible ?? "",
      turbo: p.turbo || "",
    });
    refPersona.current?.focus();
  };

  // Copia el parte al formulario sin pisarlo: sirve para el rondín de todos
  // los días, donde solo cambia la fecha o la persona.
  const duplicarParte = (p) => {
    setEditando(null);
    setForm({
      fecha: soloFecha(p.fecha),
      persona: p.persona?._id || "",
      cc: p.cc?._id || "",
      horaIngreso: p.horaIngreso || "",
      horaEgreso: p.horaEgreso || "",
      lote: p.lote || "",
      observacion: p.observacion || "",
      tarea: p.tarea?._id || "",
      cantidad: p.cantidad ?? "",
      combustible: p.combustible ?? "",
      turbo: p.turbo || "",
    });
    refPersona.current?.focus();
  };

  const eliminarParte = async (p) => {
    const result = await Swal.fire({
      title: "¿Eliminar parte?",
      text: `${p.persona?.apellidoNombre || ""} — ${formatFecha(p.fecha)}`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#dc2626",
      cancelButtonColor: "#64748b",
      confirmButtonText: "Sí, eliminar",
      cancelButtonText: "Cancelar",
    });
    if (result.isConfirmed) {
      await fetch(`/api/partes/${p._id}`, { method: "DELETE" });
      await cargarPartes(periodo);
    }
  };

  // ── datos derivados ───────────────────────────────────────────────
  const lotesUsados = useMemo(
    () => [...new Set(partes.map((p) => (p.lote || "").trim()).filter(Boolean))].sort(),
    [partes]
  );
  const observacionesUsadas = useMemo(
    () => [...new Set(partes.map((p) => (p.observacion || "").trim()).filter(Boolean))].sort(),
    [partes]
  );

  const totalHorasForm = calcularHoras(form.horaIngreso, form.horaEgreso);

  const totales = useMemo(() => {
    const horas = partes.reduce((acc, p) => acc + (p.totalHoras || 0), 0);
    const combustible = partes.reduce((acc, p) => acc + (p.combustible || 0), 0);
    const porTarea = {};
    partes.forEach((p) => {
      if (!p.tarea) return;
      const k = p.tarea.tarea;
      porTarea[k] = (porTarea[k] || 0) + (p.cantidad || 0);
    });
    return { horas: Math.round(horas * 100) / 100, combustible, porTarea };
  }, [partes]);

  const estiloCelda = { fontSize: "0.78rem", height: "30px", padding: "2px 6px" };

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
        {/* Encabezado: mes, período y volver */}
        <div className="d-flex align-items-center justify-content-between gap-3 mb-2 flex-wrap">
          <div className="d-flex align-items-center gap-2">
            <button
              onClick={() => navigate("/produccion/certificados")}
              className="btn btn-sm btn-outline-secondary d-flex align-items-center gap-1 rounded-3 px-2 py-1"
              style={{ fontSize: "0.8rem" }}
            >
              <i className="bi bi-arrow-left"></i>
            </button>
            <span className="fw-bold" style={{ color: "#1b4332", fontSize: "1.05rem" }}>
              {titulo}
            </span>
            <span className="text-muted" style={{ fontSize: "0.78rem" }}>
              {partes.length} partes · {totales.horas} hs
            </span>
          </div>

          <div className="d-flex align-items-center gap-2">
            <span className="fw-bold text-dark" style={{ fontSize: "0.78rem" }}>
              Período:
            </span>
            <Form.Control
              type="date"
              size="sm"
              value={periodo.desde}
              onChange={(e) => setPeriodo((p) => ({ ...p, desde: e.target.value }))}
              style={{ fontSize: "0.78rem", height: "30px", width: "140px" }}
            />
            <span className="text-muted" style={{ fontSize: "0.78rem" }}>
              al
            </span>
            <Form.Control
              type="date"
              size="sm"
              value={periodo.hasta}
              onChange={(e) => setPeriodo((p) => ({ ...p, hasta: e.target.value }))}
              style={{ fontSize: "0.78rem", height: "30px", width: "140px" }}
            />
            <Button
              size="sm"
              onClick={guardarPeriodo}
              className="rounded-3 px-2 py-1"
              style={{ backgroundColor: "#1b4332", borderColor: "#1b4332", fontSize: "0.78rem" }}
              title="Guardar el período y recargar"
            >
              <i className="bi bi-check-lg"></i>
            </Button>
          </div>
        </div>

        {/* Fila de carga */}
        <Card className="shadow-sm border-0 rounded-3 px-2 py-2 bg-white flex-shrink-0 mb-2">
          <div className="d-flex align-items-end gap-2 flex-wrap" onKeyDown={alPresionarEnter}>
            <div style={{ width: "120px" }}>
              <label className="text-muted d-block" style={{ fontSize: "0.7rem" }}>Fecha</label>
              <Form.Control type="date" value={form.fecha} onChange={(e) => cambiar("fecha", e.target.value)} style={estiloCelda} />
            </div>

            <div style={{ width: "175px" }}>
              <label className="text-muted d-block" style={{ fontSize: "0.7rem" }}>Personal *</label>
              <Form.Select ref={refPersona} value={form.persona} onChange={(e) => cambiar("persona", e.target.value)} style={estiloCelda}>
                <option value="">—</option>
                {personal.map((p) => (
                  <option key={p._id} value={p._id}>{p.apellidoNombre}</option>
                ))}
              </Form.Select>
            </div>

            <div style={{ width: "110px" }}>
              <label className="text-muted d-block" style={{ fontSize: "0.7rem" }}>CC</label>
              <Form.Select value={form.cc} onChange={(e) => cambiar("cc", e.target.value)} style={estiloCelda}>
                <option value="">—</option>
                {centros.map((c) => (
                  <option key={c._id} value={c._id}>{c.cc}</option>
                ))}
              </Form.Select>
            </div>

            <div style={{ width: "78px" }}>
              <label className="text-muted d-block" style={{ fontSize: "0.7rem" }}>Ingreso</label>
              <Form.Control type="time" value={form.horaIngreso} onChange={(e) => cambiar("horaIngreso", e.target.value)} style={estiloCelda} />
            </div>

            <div style={{ width: "78px" }}>
              <label className="text-muted d-block" style={{ fontSize: "0.7rem" }}>Egreso</label>
              <Form.Control type="time" value={form.horaEgreso} onChange={(e) => cambiar("horaEgreso", e.target.value)} style={estiloCelda} />
            </div>

            <div style={{ width: "56px" }}>
              <label className="text-muted d-block" style={{ fontSize: "0.7rem" }}>Total</label>
              <div
                className="d-flex align-items-center justify-content-center rounded-2 fw-bold"
                style={{ ...estiloCelda, backgroundColor: "#e8f5ee", color: "#1b4332", border: "1px solid #a7d8bf" }}
                title="Se calcula solo"
              >
                {totalHorasForm || "—"}
              </div>
            </div>

            <div style={{ width: "120px" }}>
              <label className="text-muted d-block" style={{ fontSize: "0.7rem" }}>Lote</label>
              <Form.Control list="lotes-usados" value={form.lote} onChange={(e) => cambiar("lote", e.target.value)} style={estiloCelda} />
              <datalist id="lotes-usados">
                {lotesUsados.map((l) => <option key={l} value={l} />)}
              </datalist>
            </div>

            <div style={{ width: "150px" }}>
              <label className="text-muted d-block" style={{ fontSize: "0.7rem" }}>Observaciones</label>
              <Form.Control list="obs-usadas" value={form.observacion} onChange={(e) => cambiar("observacion", e.target.value)} style={estiloCelda} />
              <datalist id="obs-usadas">
                {observacionesUsadas.map((o) => <option key={o} value={o} />)}
              </datalist>
            </div>

            <div style={{ width: "185px" }}>
              <label className="text-muted d-block" style={{ fontSize: "0.7rem" }}>Tarea</label>
              <Form.Select value={form.tarea} onChange={(e) => cambiar("tarea", e.target.value)} style={estiloCelda}>
                <option value="">—</option>
                {tareas.map((t) => (
                  <option key={t._id} value={t._id}>{t.tarea}</option>
                ))}
              </Form.Select>
            </div>

            <div style={{ width: "80px" }}>
              <label className="text-muted d-block" style={{ fontSize: "0.7rem" }}>Cantidad</label>
              <Form.Control type="number" value={form.cantidad} onChange={(e) => cambiar("cantidad", e.target.value)} style={estiloCelda} />
            </div>

            <div style={{ width: "78px" }}>
              <label className="text-muted d-block" style={{ fontSize: "0.7rem" }}>Combust.</label>
              <Form.Control type="number" value={form.combustible} onChange={(e) => cambiar("combustible", e.target.value)} style={estiloCelda} />
            </div>

            <div style={{ width: "70px" }}>
              <label className="text-muted d-block" style={{ fontSize: "0.7rem" }}>Turbo</label>
              <Form.Control value={form.turbo} onChange={(e) => cambiar("turbo", e.target.value)} style={estiloCelda} />
            </div>

            <Button
              size="sm"
              onClick={guardarParte}
              disabled={guardando}
              className="rounded-3 px-3 d-flex align-items-center gap-1"
              style={{ backgroundColor: editando ? "#0e7490" : "#15803d", borderColor: "transparent", fontSize: "0.78rem", height: "30px", fontWeight: 600 }}
            >
              <i className={`bi bi-${editando ? "check-lg" : "plus-lg"}`}></i>
              <span>{editando ? "Guardar" : "Agregar"}</span>
            </Button>

            {editando && (
              <Button
                size="sm"
                variant="outline-secondary"
                onClick={limpiarForm}
                className="rounded-3 px-2"
                style={{ fontSize: "0.78rem", height: "30px" }}
              >
                Cancelar
              </Button>
            )}
          </div>

          {/* Turnos frecuentes */}
          <div className="d-flex align-items-center gap-2 mt-2 flex-wrap">
            <span className="text-muted" style={{ fontSize: "0.7rem" }}>Turnos:</span>
            {TURNOS_FRECUENTES.map(([i, e]) => (
              <button
                key={`${i}-${e}`}
                onClick={() => aplicarTurno([i, e])}
                className="btn btn-sm rounded-pill px-2 py-0"
                style={{
                  fontSize: "0.7rem",
                  border: "1px solid #cbd5e1",
                  backgroundColor: form.horaIngreso === i && form.horaEgreso === e ? "#e8f5ee" : "#fff",
                  color: "#1b4332",
                }}
              >
                {i} - {e}
              </button>
            ))}
            <span className="text-muted ms-2" style={{ fontSize: "0.7rem" }}>
              Enter guarda y deja la fecha para el siguiente
            </span>
          </div>
        </Card>

        {/* Tabla de partes */}
        <div
          className="flex-grow-1 shadow-sm rounded-3 bg-white"
          style={{ overflowY: "auto", overflowX: "auto", border: "1px solid #cbd5e1" }}
        >
          <Table hover size="sm" className="text-center align-middle mb-0" style={{ whiteSpace: "nowrap", fontSize: "0.78rem", width: "100%" }}>
            <thead style={{ position: "sticky", top: 0, zIndex: 10, backgroundColor: "#1b4332", color: "#fff" }}>
              <tr className="fw-normal align-middle">
                {["Fecha", "Personal", "CC", "Ingreso", "Egreso", "Total hs", "Lote", "Observaciones", "Tarea", "Cantidad", "Combust.", "Turbo", ""].map((h, i) => (
                  <th key={i} style={{ backgroundColor: "#1b4332", color: "#fff", padding: "7px 8px", fontWeight: "normal" }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {partes.length === 0 ? (
                <tr>
                  <td colSpan={13} className="text-muted py-4" style={{ fontSize: "0.85rem" }}>
                    No hay partes cargados en este período
                  </td>
                </tr>
              ) : (
                partes.map((p, idx) => (
                  <tr
                    key={p._id}
                    style={{
                      backgroundColor: editando === p._id ? "#e0f2fe" : idx % 2 === 0 ? "#ffffff" : "#f8fafc",
                      borderBottom: "1px solid #e2e8f0",
                      height: "30px",
                    }}
                  >
                    <td className="fw-semibold text-dark">{formatFecha(p.fecha)}</td>
                    <td className="text-start ps-2">{p.persona?.apellidoNombre || "—"}</td>
                    <td>{p.cc?.cc || "—"}</td>
                    <td className="text-secondary">{p.horaIngreso || "—"}</td>
                    <td className="text-secondary">{p.horaEgreso || "—"}</td>
                    <td className="fw-bold" style={{ color: "#1b4332" }}>{p.totalHoras || "—"}</td>
                    <td className="text-secondary">{p.lote || "—"}</td>
                    <td className="text-start ps-2 text-secondary">{p.observacion || "—"}</td>
                    <td className="text-start ps-2">{p.tarea?.tarea || "—"}</td>
                    <td className="fw-semibold">{p.cantidad ?? "—"}</td>
                    <td className="text-secondary">{p.combustible ?? "—"}</td>
                    <td className="text-secondary">{p.turbo || "—"}</td>
                    <td>
                      <div className="d-flex justify-content-center gap-1">
                        <button
                          onClick={() => duplicarParte(p)}
                          className="btn btn-sm btn-outline-secondary d-flex align-items-center justify-content-center rounded-2 p-0"
                          style={{ width: "22px", height: "22px" }}
                          title="Copiar al formulario"
                        >
                          <i className="bi bi-files" style={{ fontSize: "0.7rem" }}></i>
                        </button>
                        <button
                          onClick={() => editarParte(p)}
                          className="btn btn-sm btn-outline-primary d-flex align-items-center justify-content-center rounded-2 p-0"
                          style={{ width: "22px", height: "22px" }}
                          title="Editar"
                        >
                          <i className="bi bi-pencil" style={{ fontSize: "0.7rem" }}></i>
                        </button>
                        <button
                          onClick={() => eliminarParte(p)}
                          className="btn btn-sm btn-outline-danger d-flex align-items-center justify-content-center rounded-2 p-0"
                          style={{ width: "22px", height: "22px" }}
                          title="Eliminar"
                        >
                          <i className="bi bi-trash" style={{ fontSize: "0.7rem" }}></i>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
            {partes.length > 0 && (
              <tfoot style={{ position: "sticky", bottom: 0, backgroundColor: "#f1f5f9" }}>
                <tr style={{ borderTop: "2px solid #cbd5e1", height: "32px" }}>
                  <td colSpan={5} className="text-end pe-2 fw-bold text-dark">TOTALES</td>
                  <td className="fw-bold" style={{ color: "#1b4332" }}>{totales.horas}</td>
                  <td colSpan={4}></td>
                  <td className="fw-bold" style={{ color: "#1b4332" }}>{totales.combustible || "—"}</td>
                  <td colSpan={2}></td>
                </tr>
              </tfoot>
            )}
          </Table>
        </div>

        {/* Totales por tarea */}
        {Object.keys(totales.porTarea).length > 0 && (
          <div className="d-flex align-items-center gap-3 flex-wrap mt-2 px-1">
            <span className="text-muted fw-bold" style={{ fontSize: "0.72rem" }}>Por tarea:</span>
            {Object.entries(totales.porTarea).map(([t, cant]) => (
              <span
                key={t}
                className="badge rounded-pill px-2 py-1"
                style={{ backgroundColor: "#e8f5ee", color: "#1b4332", border: "1px solid #a7d8bf", fontSize: "0.72rem", fontWeight: 600 }}
              >
                {t}: {cant}
              </span>
            ))}
          </div>
        )}
      </Container>
    </div>
  );
}

export default ProduccionCertificadoMes;
