import { useEffect, useRef, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { useNavigate, useLocation } from "react-router-dom";
import Swal from "sweetalert2";
import { Container, Form, Button, Row, Col, Table, Modal } from "react-bootstrap";

const SECCIONES = [
  {
    titulo: "DOCUMENTACIÓN",
    campo: "documentacion",
    items: [
      { nombre: "Tarjeta azul",             estandar: "Existe, a nombre de quien" },
      { nombre: "Tarjeta de seguro (vto.)",  estandar: "Existe, fecha de vencimiento" },
      { nombre: "VTV (vto.)",               estandar: "Existe, fecha de vencimiento" },
      { nombre: "Carnet manejo (vto.)",      estandar: "Fecha de vencimiento" },
      { nombre: "Otros",                    estandar: "" },
    ],
  },
  {
    titulo: "MOTOR",
    campo: "motor",
    items: [
      { nombre: "Nivel de aceite",           estandar: "Varilla de nivel, entre máximo y mínimo" },
      { nombre: "Nivel de agua",             estandar: "Nivel en recipiente entre máximo y mínimo" },
      { nombre: "Nivel líquidos freno",      estandar: "Nivel en recipiente entre máximo y mínimo" },
      { nombre: "Nivel aceite de caja",      estandar: "Hasta tapón de nivel de aceite" },
      { nombre: "Nivel líquidos dirección",  estandar: "Nivel en recipiente entre máximo y mínimo" },
      { nombre: "Pérdidas de aceite",        estandar: "No debe haber manchas de aceite" },
      { nombre: "Pérdidas de gasoil",        estandar: "No debe haber manchas de gasoil" },
      { nombre: "Sonido en general",         estandar: "Motor en marcha, sin sonidos extraños" },
      { nombre: "Otros",                    estandar: "" },
    ],
  },
  {
    titulo: "PRUEBA CON VEHÍCULO EN MOVIMIENTO",
    campo: "pruebaMovimiento",
    items: [
      { nombre: "Tren delantero",             estandar: "Sin ruidos" },
      { nombre: "Frenos",                    estandar: "Verificar buen frenado" },
      { nombre: "Freno de mano",             estandar: "Verificar frenado en desnivel" },
      { nombre: "Cuenta kilómetros",         estandar: "Funcionando" },
      { nombre: "Reloj temperatura",         estandar: "Funcionando y en rango" },
      { nombre: "Cubiertas delanteras",      estandar: "Revisión visual y km último cambio" },
      { nombre: "Cubiertas traseras",        estandar: "Revisión visual y km último cambio" },
      { nombre: "Caja de cambios",           estandar: "Entran todos los cambios, sin ruidos" },
      { nombre: "Otros",                    estandar: "" },
    ],
  },
  {
    titulo: "ESTADO GENERAL DE LA CAMIONETA",
    campo: "estadoGeneral",
    items: [
      { nombre: "Ópticas delanteras",        estandar: "Sin roturas" },
      { nombre: "Ópticas traseras",          estandar: "Sin roturas" },
      { nombre: "Chapa (abolladuras)",       estandar: "Sin choques en toda la camioneta" },
      { nombre: "Espejos",                  estandar: "Los 3 espejos en condiciones" },
      { nombre: "Interior / accesorios",    estandar: "Palancas y perillas en condiciones" },
      { nombre: "Compuerta",                estandar: "Cierra bien, tiene manija, sin abolladuras" },
      { nombre: "Limpieza de tapizados",    estandar: "Sin roturas ni manchas" },
      { nombre: "Otros",                    estandar: "" },
    ],
  },
];

const defaultSeccion = (items) => items.map(() => ({ estado: "", observaciones: "" }));

function CamionetasCheckList() {
  const navigate = useNavigate();
  const location = useLocation();
  const [camionetas, setCamionetas] = useState([]);
  const [checklistId, setChecklistId] = useState(null);
  const [campoAncho, setCampoAncho] = useState("auto");
  const [dropOpen, setDropOpen] = useState(false);
  const [filtro, setFiltro] = useState("");
  const responsableRef = useRef(null);
  const [paradas, setParadas] = useState([]);
  const [showHistorial, setShowHistorial] = useState(false);
  const [showNuevaParada, setShowNuevaParada] = useState(false);
  const [motivoNueva, setMotivoNueva] = useState("");
  const [showArranque, setShowArranque] = useState(false);
  const [fechaArranqueInput, setFechaArranqueInput] = useState("");
  const [paradaAbiertaId, setParadaAbiertaId] = useState(null);
  const [showNuevaTarea, setShowNuevaTarea] = useState(false);
  const [motivoNuevaTarea, setMotivoNuevaTarea] = useState("");
  const [showResolverTarea, setShowResolverTarea] = useState(false);
  const dropRef = useRef(null);

  const { register, handleSubmit, setValue, control, formState: { errors } } = useForm({
    defaultValues: {
      camioneta: "",
      mes: location.state?.mes ?? "",
      fecha: new Date().toISOString().split("T")[0],
      numeroCc: "",
      kms: "",
      encargado: "",
      kmsUltimoService: "",
      fechaUltimoService: "",
      documentacion:      defaultSeccion(SECCIONES[0].items),
      motor:              defaultSeccion(SECCIONES[1].items),
      pruebaMovimiento:   defaultSeccion(SECCIONES[2].items),
      estadoGeneral:      defaultSeccion(SECCIONES[3].items),
      puntuacion: "",
      camionetatParada: false,
      tareaPendiente: false,
    },
  });

  const camionetaId      = useWatch({ control, name: "camioneta" });
  const encargadoVal     = useWatch({ control, name: "encargado" });
  const camionetatParada = useWatch({ control, name: "camionetatParada" });
  const tareaPendiente   = useWatch({ control, name: "tareaPendiente" });
  const fechaVal         = useWatch({ control, name: "fecha" });

  useEffect(() => {
    fetch("/api/camionetas")
      .then((r) => r.json())
      .then((data) => {
        setCamionetas(data);
        const { camionetaId, mes } = location.state || {};
        if (camionetaId) setValue("camioneta", camionetaId);
        if (camionetaId && mes) {
          const año = new Date().getFullYear();
          fetch(`/api/checklist/buscar?camioneta=${camionetaId}&mes=${mes}&año=${año}`)
            .then((r) => r.ok ? r.json() : null)
            .then((cl) => {
              if (!cl) return;
              setChecklistId(cl._id);
              setValue("fecha", cl.fecha ? cl.fecha.split("T")[0] : "");
              setValue("kms", cl.kms ?? "");
              setValue("encargado", cl.encargado ?? "");
              setValue("kmsUltimoService", cl.kmsUltimoService ?? "");
              setValue("fechaUltimoService", cl.fechaUltimoService ? cl.fechaUltimoService.split("T")[0] : "");
              setValue("puntuacion", cl.puntuacion ?? "");
              setValue("camionetatParada", cl.camionetatParada ?? false);
              setValue("tareaPendiente", cl.tareaPendiente ?? false);
              SECCIONES.forEach((s) => {
                cl[s.campo]?.forEach((item, i) => {
                  setValue(`${s.campo}.${i}.estado`, item.estado ?? "");
                  setValue(`${s.campo}.${i}.observaciones`, item.observaciones ?? "");
                });
              });
            })
            .catch(() => {});
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (responsableRef.current && camionetas.length > 0) {
      setCampoAncho(responsableRef.current.offsetWidth);
    }
  }, [camionetas]);

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
    if (c?.responsable) setValue("encargado", c.responsable);
  }, [camionetaId, camionetas]);

  const cargarParadas = async (id) => {
    try {
      const r = await fetch(`/api/paradas/${id}`);
      setParadas(await r.json());
    } catch { setParadas([]); }
  };

  const alClickCirculo = async (e) => {
    e.preventDefault();
    if (!camionetaId) return;
    if (!camionetatParada) {
      setMotivoNueva("");
      setShowNuevaParada(true);
    } else {
      const lista = await fetch(`/api/paradas/${camionetaId}`).then((r) => r.json()).catch(() => []);
      const abierta = lista.find((p) => !p.fechaArranque);
      setParadaAbiertaId(abierta?._id ?? null);
      setFechaArranqueInput(new Date().toISOString().split("T")[0]);
      setShowArranque(true);
    }
  };

  const alClickCirculoPendiente = (e) => {
    e.preventDefault();
    if (!camionetaId) return;
    if (!tareaPendiente) {
      setMotivoNuevaTarea("");
      setShowNuevaTarea(true);
    } else {
      setShowResolverTarea(true);
    }
  };

  const guardarNuevaTarea = () => {
    setValue("tareaPendiente", true);
    setShowNuevaTarea(false);
  };

  const resolverTarea = () => {
    setValue("tareaPendiente", false);
    setShowResolverTarea(false);
  };

  const guardarNuevaParada = async () => {
    try {
      await fetch("/api/paradas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ camioneta: camionetaId, fechaParada: fechaVal, motivo: motivoNueva }),
      });
      setValue("camionetatParada", true);
      setShowNuevaParada(false);
    } catch { Swal.fire({ icon: "error", title: "Sin conexión" }); }
  };

  const guardarArranque = async () => {
    if (!fechaArranqueInput) return;
    try {
      if (paradaAbiertaId) {
        await fetch(`/api/paradas/${paradaAbiertaId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ fechaArranque: fechaArranqueInput }),
        });
      }
      setValue("camionetatParada", false);
      setShowArranque(false);
    } catch { Swal.fire({ icon: "error", title: "Sin conexión" }); }
  };

  const abrirHistorial = () => {
    if (!camionetaId) return;
    cargarParadas(camionetaId);
    setShowHistorial(true);
  };

  const eliminarParada = async (id) => {
    const r = await Swal.fire({ icon: "warning", title: "¿Eliminar?", showCancelButton: true, confirmButtonText: "Eliminar", cancelButtonText: "Cancelar", confirmButtonColor: "#8b4a4a" });
    if (!r.isConfirmed) return;
    await fetch(`/api/paradas/${id}`, { method: "DELETE" });
    cargarParadas(camionetaId);
  };

  const formatF = (iso) => iso ? new Date(iso).toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric" }) : "—";

  const onSubmit = async (data) => {
    const payload = {
      ...data,
      ...Object.fromEntries(
        SECCIONES.map((s) => [
          s.campo,
          s.items.map((item, i) => ({
            nombre: item.nombre,
            estado: data[s.campo][i]?.estado ?? "",
            observaciones: data[s.campo][i]?.observaciones ?? "",
          })),
        ])
      ),
    };

    const año = new Date(data.fecha).getFullYear();
    const fullPayload = { ...payload, mes: data.mes, año };
    try {
      const url = checklistId ? `/api/checklist/${checklistId}` : "/api/checklist";
      const method = checklistId ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(fullPayload),
      });
      if (res.ok) {
        await fetch("/api/programa-checklist", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ camionetaId: data.camioneta, año, mes: data.mes, estado: "realizado", puntuacion: data.puntuacion ? Number(data.puntuacion) : null, camionetatParada: !!data.camionetatParada, tareaPendiente: !!data.tareaPendiente }),
        });
        if (data.tareaPendiente && motivoNuevaTarea.trim()) {
          await fetch("/api/trabajos-camioneta", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ camioneta: data.camioneta, descripcion: motivoNuevaTarea.trim(), fecha: data.fecha }),
          });
        }
        Swal.fire({ icon: "success", title: "Check list guardado", timer: 1500, showConfirmButton: false });
        navigate("/camionetas/checklist");
      } else {
        const err = await res.json();
        Swal.fire({ icon: "error", title: "Error", text: err.error });
      }
    } catch {
      Swal.fire({ icon: "error", title: "Sin conexión", text: "No se pudo conectar con el servidor" });
    }
  };

  return (
    <Container className="py-4">
      <Form onSubmit={handleSubmit(onSubmit)}>

        {/* Encabezado + Mes — sticky */}
        <div style={{ position: "sticky", top: 0, zIndex: 50, backgroundColor: "#fff", paddingTop: "1rem", paddingBottom: "0.5rem" }}>
          <div className="d-flex justify-content-between align-items-center mb-3 w-75 mx-auto">
            <h3 className="fw-bold mb-0">Check List — Camionetas</h3>
            <div className="d-flex gap-2">
              <Button onClick={() => navigate(-1)} style={{ backgroundColor: "#fff", border: "1px solid #000", color: "#000" }}>
                <i className="bi bi-arrow-left me-2"></i>Volver
              </Button>
              <Button onClick={() => navigate("/camionetas/resumen")} style={{ backgroundColor: "#fff", border: "1px solid #000", color: "#000" }}>
                <i className="bi bi-speedometer me-2"></i>Tablero
              </Button>
              <Button onClick={() => navigate("/")} style={{ backgroundColor: "#fff", border: "1px solid #000", color: "#000" }}>
                <i className="bi bi-house-fill me-2"></i>General
              </Button>
              <Button type="submit" style={{ backgroundColor: "#000", border: "1px solid #000", color: "#fff" }}>
                <i className="bi bi-save me-2"></i>Guardar
              </Button>
            </div>
          </div>

          <div className="w-75 mx-auto d-flex align-items-center gap-3">
            <Form.Label className="fw-bold mb-0 fs-5">Mes</Form.Label>
            <Form.Select
              style={{ width: "200px", appearance: "none", WebkitAppearance: "none", MozAppearance: "none", backgroundImage: "none", pointerEvents: "none", backgroundColor: "#e9ecef", cursor: "default" }}
              {...register("mes", { required: "Seleccioná un mes" })}
              isInvalid={!!errors.mes}
            >
              <option value="">— Seleccionar —</option>
              {["Enero","Marzo","Mayo","Julio","Septiembre","Noviembre"].map((m) => (
                <option key={m} value={m.toLowerCase()}>{m}</option>
              ))}
            </Form.Select>
            {errors.mes && <span className="text-danger small">{errors.mes.message}</span>}
            <div className="d-flex flex-row align-items-start gap-4 ms-auto">
              {/* Tarea pendiente */}
              <div className="d-flex flex-column">
                <Form.Check
                  type="checkbox"
                  id="tareaPendiente"
                  label="Tarea pendiente"
                  className="fw-bold fs-5 mb-0"
                  style={{ cursor: camionetaId ? "pointer" : "default" }}
                  checked={tareaPendiente}
                  onClick={alClickCirculoPendiente}
                  onChange={() => {}}
                />
              </div>
              {/* Camioneta parada */}
              <div className="d-flex flex-column">
                <Form.Check
                  type="checkbox"
                  id="camionetatParada"
                  label="Camioneta parada"
                  className="fw-bold fs-5 mb-0"
                  style={{ cursor: camionetaId ? "pointer" : "default" }}
                  checked={camionetatParada}
                  onClick={alClickCirculo}
                  onChange={() => {}}
                />
                {camionetatParada && fechaVal
                  ? <span
                      className="fw-semibold"
                      style={{ fontSize: "0.85rem", paddingLeft: "1.9rem", color: camionetaId ? "#8b4a4a" : "#aaa", cursor: camionetaId ? "pointer" : "default", textDecoration: "none" }}
                      onClick={camionetaId ? abrirHistorial : undefined}
                    >
                      desde {new Date(fechaVal + "T00:00:00").toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric" })}
                    </span>
                  : <span
                      className="fw-semibold"
                      style={{ fontSize: "0.85rem", paddingLeft: "1.9rem", color: camionetaId ? "#1565c0" : "#aaa", cursor: camionetaId ? "pointer" : "default", textDecoration: camionetaId ? "underline" : "none" }}
                      onClick={camionetaId ? abrirHistorial : undefined}
                    >
                      Historial paradas
                    </span>
                }
              </div>
            </div>
          </div>
        </div>

        {/* Info principal */}
        <div className="cuadro p-2 mb-3 bg-light w-75 mx-auto mt-3">
          <div className="d-flex justify-content-between align-items-end gap-3">
            <div>
              <Form.Label className="fw-semibold">Fecha</Form.Label>
              <Form.Control type="date" style={{ width: "160px" }} {...register("fecha")} />
            </div>
            <div>
              <Form.Label className="fw-semibold">Camioneta</Form.Label>
              <Form.Select style={{ width: "auto", appearance: "none", WebkitAppearance: "none", MozAppearance: "none", backgroundImage: "none", pointerEvents: "none", backgroundColor: "#e9ecef", cursor: "default" }} {...register("camioneta", { required: "Seleccioná una camioneta" })} isInvalid={!!errors.camioneta}>
                <option value="">— Seleccionar —</option>
                {camionetas.map((c) => (
                  <option key={c._id} value={c._id}>{c.patente}</option>
                ))}
              </Form.Select>
              <Form.Control.Feedback type="invalid">{errors.camioneta?.message}</Form.Control.Feedback>
            </div>
            <div>
              <Form.Label className="fw-semibold">Kilómetros</Form.Label>
              <Form.Control type="number" placeholder="Kms actuales" style={{ width: "160px" }} {...register("kms")} />
            </div>
          </div>
        </div>

        {/* Datos generales */}
        <div className="cuadro p-2 mb-3 bg-light w-75 mx-auto">
          <h6 className="fw-bold mb-2">DATOS GENERALES</h6>
          <div className="d-flex justify-content-between align-items-end gap-3">
            <div ref={dropRef} style={{ position: "relative" }}>
              <Form.Label className="fw-semibold">Responsable</Form.Label>
              <input type="hidden" {...register("encargado")} />
              <Form.Control
                ref={responsableRef}
                style={{ width: "auto", textAlign: "center" }}
                placeholder="— Seleccionar —"
                value={dropOpen ? filtro : encargadoVal}
                onChange={(e) => { setFiltro(e.target.value); setDropOpen(true); }}
                onFocus={() => { setFiltro(""); setDropOpen(true); }}
                autoComplete="off"
              />
              {dropOpen && (
                <div style={{
                  position: "absolute",
                  top: "100%",
                  left: 0,
                  zIndex: 1050,
                  backgroundColor: "#fff",
                  border: "2px solid #aaa",
                  borderRadius: "4px",
                  minWidth: "100%",
                  maxHeight: "220px",
                  overflowY: "auto",
                  boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
                }}>
                  {camionetas
                    .map((c) => c.responsable)
                    .filter(Boolean)
                    .filter((v, i, arr) => arr.indexOf(v) === i)
                    .sort()
                    .filter((r) => r.toLowerCase().includes(filtro.toLowerCase()))
                    .map((r) => (
                      <div
                        key={r}
                        style={{
                          padding: "8px 16px",
                          cursor: "pointer",
                          textAlign: "center",
                          backgroundColor: encargadoVal === r ? "#e9ecef" : "transparent",
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#f0f0f0")}
                        onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = encargadoVal === r ? "#e9ecef" : "transparent")}
                        onMouseDown={(e) => {
                          e.preventDefault();
                          setValue("encargado", r);
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
            </div>
            <div>
              <Form.Label className="fw-semibold">Km último service</Form.Label>
              <Form.Control type="number" placeholder="Kms" style={{ width: campoAncho }} {...register("kmsUltimoService")} />
            </div>
            <div>
              <Form.Label className="fw-semibold">Fecha último service</Form.Label>
              <Form.Control type="date" style={{ width: campoAncho }} {...register("fechaUltimoService")} />
            </div>
          </div>
        </div>

        {/* Secciones de items */}
        {SECCIONES.map((seccion) => (
          <div key={seccion.campo} className="cuadro mb-3 overflow-hidden w-75 mx-auto">
            <div className="px-3 py-1 fw-bold text-white" style={{ backgroundColor: "#2c2c2c", fontSize: "0.9rem" }}>
              {seccion.titulo}
            </div>
            <Table bordered size="sm" className="mb-0">
              <thead className="table-secondary">
                <tr>
                  <th style={{ width: "22%" }}>Ítem</th>
                  <th style={{ width: "18%" }}>Estándar requerido</th>
                  <th style={{ width: "6%" }} className="text-center">Bien</th>
                  <th style={{ width: "6%" }} className="text-center">Mal</th>
                  <th>Observaciones</th>
                </tr>
              </thead>
              <tbody>
                {seccion.items.map((item, i) => (
                  <tr key={i}>
                    <td className="fw-semibold align-middle">{item.nombre}</td>
                    <td className="text-muted align-middle" style={{ fontSize: "0.88rem" }}>{item.estandar}</td>
                    <td className="text-center align-middle">
                      <Form.Check
                        type="radio"
                        value="bien"
                        {...register(`${seccion.campo}.${i}.estado`)}
                      />
                    </td>
                    <td className="text-center align-middle">
                      <Form.Check
                        type="radio"
                        value="mal"
                        {...register(`${seccion.campo}.${i}.estado`)}
                      />
                    </td>
                    <td>
                      <Form.Control
                        size="sm"
                        placeholder="Observaciones"
                        {...register(`${seccion.campo}.${i}.observaciones`)}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </div>
        ))}

        {/* Puntuación */}
        <div className="cuadro p-2 mb-3 bg-light w-75 mx-auto">
          <Row className="align-items-center">
            <Col md={8}>
              <p className="mb-0 fw-semibold">
                Puntuación del vehículo por su estado general de cuidado, conservación y presencia
              </p>
            </Col>
            <Col md={2}>
              <Form.Control
                type="number"
                min={1}
                max={10}
                placeholder="1 — 10"
                {...register("puntuacion", { min: { value: 1, message: "Mínimo 1" }, max: { value: 10, message: "Máximo 10" } })}
                isInvalid={!!errors.puntuacion}
              />
              <Form.Control.Feedback type="invalid">{errors.puntuacion?.message}</Form.Control.Feedback>
            </Col>
          </Row>
        </div>

      </Form>

      {/* Modal: Nueva tarea pendiente */}
      <Modal show={showNuevaTarea} onHide={() => setShowNuevaTarea(false)} centered contentClassName="border border-dark">
        <Modal.Header closeButton>
          <Modal.Title className="fw-bold">Registrar tarea pendiente</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <div className="mb-3">
            <Form.Label className="fw-semibold">Descripción</Form.Label>
            <Form.Control type="text" placeholder="Descripción de la tarea" value={motivoNuevaTarea} onChange={(e) => setMotivoNuevaTarea(e.target.value)} autoFocus />
          </div>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowNuevaTarea(false)}>Cancelar</Button>
          <Button style={{ backgroundColor: "#9e8850", border: "none", color: "#fff" }} onClick={guardarNuevaTarea}>
            <i className="bi bi-save me-2"></i>Confirmar
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Modal: Resolver tarea pendiente */}
      <Modal show={showResolverTarea} onHide={() => setShowResolverTarea(false)} centered contentClassName="border border-dark">
        <Modal.Header closeButton>
          <Modal.Title className="fw-bold">Resolver tarea pendiente</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <p>¿Marcar la tarea como resuelta?</p>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowResolverTarea(false)}>Cancelar</Button>
          <Button style={{ backgroundColor: "#52735a", border: "none", color: "#fff" }} onClick={resolverTarea}>
            <i className="bi bi-check-lg me-2"></i>Resolver
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Modal: Nueva parada (circulo sin tildar → click) */}
      <Modal show={showNuevaParada} onHide={() => setShowNuevaParada(false)} centered contentClassName="border border-dark">
        <Modal.Header closeButton>
          <Modal.Title className="fw-bold">Registrar parada</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <div className="mb-3">
            <Form.Label className="fw-semibold">Fecha de parada</Form.Label>
            <Form.Control type="date" className="w-50" value={fechaVal} readOnly style={{ backgroundColor: "#e9ecef" }} />
          </div>
          <div className="mb-3">
            <Form.Label className="fw-semibold">Motivo</Form.Label>
            <Form.Control type="text" placeholder="Motivo de la parada" value={motivoNueva} onChange={(e) => setMotivoNueva(e.target.value)} autoFocus />
          </div>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowNuevaParada(false)}>Cancelar</Button>
          <Button style={{ backgroundColor: "#8b4a4a", border: "none", color: "#fff" }} onClick={guardarNuevaParada}>
            <i className="bi bi-save me-2"></i>Confirmar parada
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Modal: Registrar arranque (circulo tildado → click) */}
      <Modal show={showArranque} onHide={() => setShowArranque(false)} centered contentClassName="border border-dark">
        <Modal.Header closeButton>
          <Modal.Title className="fw-bold">Registrar arranque</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <div className="mb-3">
            <Form.Label className="fw-semibold">Fecha de arranque</Form.Label>
            <Form.Control type="date" className="w-50" value={fechaArranqueInput} onChange={(e) => setFechaArranqueInput(e.target.value)} autoFocus />
          </div>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowArranque(false)}>Cancelar</Button>
          <Button style={{ backgroundColor: "#52735a", border: "none", color: "#fff" }} onClick={guardarArranque}>
            <i className="bi bi-save me-2"></i>Confirmar arranque
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Modal: Historial (solo listado) */}
      <Modal show={showHistorial} onHide={() => setShowHistorial(false)} centered size="lg" contentClassName="border border-dark">
        <Modal.Header closeButton>
          <Modal.Title className="fw-bold">Historial de Paradas</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Table bordered size="sm" className="text-center align-middle mb-0">
            <thead className="table-dark">
              <tr>
                <th>Fecha parada</th>
                <th>Fecha arranque</th>
                <th>Días de parada</th>
                <th>Motivo</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {paradas.length === 0 && <tr><td colSpan={5} className="text-muted">Sin registros</td></tr>}
              {paradas.map((p) => {
                const inicio = p.fechaParada ? new Date(p.fechaParada) : null;
                const fin    = p.fechaArranque ? new Date(p.fechaArranque) : new Date();
                const dias   = inicio ? Math.ceil((fin - inicio) / (1000 * 60 * 60 * 24)) : null;
                return (
                <tr key={p._id}>
                  <td>{formatF(p.fechaParada)}</td>
                  <td>{formatF(p.fechaArranque)}</td>
                  <td>{dias != null ? dias : "—"}</td>
                  <td className="text-start">{p.motivo || "—"}</td>
                  <td>
                    <button className="btn btn-sm btn-outline-danger py-0 px-2" onClick={() => eliminarParada(p._id)}>
                      <i className="bi bi-trash"></i>
                    </button>
                  </td>
                </tr>
                );
              })}
            </tbody>
          </Table>
        </Modal.Body>
      </Modal>

    </Container>
  );
}

export default CamionetasCheckList;

