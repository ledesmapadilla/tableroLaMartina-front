import { useCallback, useEffect, useRef, useState } from "react";
import { Button, Card, Col, Form, ListGroup, Row, Spinner } from "react-bootstrap";
import { useNavigate } from "react-router-dom";
import Swal from "sweetalert2";
import { api } from "../../../services/api";
import { subirArchivo, borrarArchivo, prepararSubida } from "../../../services/archivos";
import { COLOR, CONCEPTOS, dmy, hayCamaraEnPagina, hoyIso, pesos, useAltoVista } from "./comun";
import { formatearMonto, leerMonto } from "../../../helpers/montoInput";
import Camara from "./Camara";
import "./caja.css";

/**
 * Caja desde el celular (13/11/2026): el alta de un movimiento. Copiada de
 * NuevaCargaGasoil del Sistema de Gestión Lepa: en vez de un modal con
 * campos, una tarjeta por dato que se despliega al tocarla, tres por fila, y
 * las alternativas en un panel ancho debajo de la fila tocada.
 * Back: POST /api/contable/caja (permiso compras.caja, "Editar").
 */

const CAMPOS = ["fecha", "concepto", "monto", "descripcion", "observaciones", "fotos"];
const FILAS = [CAMPOS.slice(0, 3), CAMPOS.slice(3)];
const OBLIGATORIOS = ["fecha", "concepto", "monto", "descripcion"];

const ETIQUETAS = {
  fecha: "Fecha",
  concepto: "Concepto",
  monto: "Monto",
  descripcion: "Descripción",
  observaciones: "Observ.",
  fotos: "Fotos",
};

const montoDe = (s) => leerMonto(s) || 0;

// Lo cargado queda en la pestaña (23/11/2026): si el celular recarga la página
// (Android a veces la cierra mientras se usa la cámara o la galería), al
// volver siguen los datos y las fotos que ya habían subido.
const GUARDADO = "caja-cel-nuevo";
const leerGuardado = () => {
  try {
    return JSON.parse(sessionStorage.getItem(GUARDADO)) || null;
  } catch {
    return null;
  }
};
const borrarGuardado = () => {
  try {
    sessionStorage.removeItem(GUARDADO);
  } catch {
    // Sin sessionStorage no hay nada que borrar.
  }
};

export default function CajaNuevo() {
  const navigate = useNavigate();
  useAltoVista();

  const [guardado] = useState(leerGuardado);
  const [valores, setValores] = useState(
    () => guardado?.valores || { fecha: hoyIso(), concepto: "", monto: "", descripcion: "", observaciones: "" }
  );
  // Arranca con todas cerradas: la pantalla se ve entera antes de tocar nada.
  // Si se recargó en medio de las fotos, vuelve abierta ahí.
  const [abierto, setAbierto] = useState(() => guardado?.abierto || null);
  // Las fotos se suben apenas se eligen: { clave, nombre, archivo, fallo }.
  const [subidas, setSubidas] = useState(() => guardado?.subidas || []);
  const promesas = useRef(new Map((guardado?.subidas || []).map((s) => [s.clave, Promise.resolve(s.archivo)])));
  const contador = useRef(guardado?.contador || 0);
  const [guardando, setGuardando] = useState(false);
  const enCurso = useRef(false);
  const [camara, setCamara] = useState(false);
  const inputCamara = useRef(null);

  // La firma de Cloudinary, pedida de antemano: la primera foto sale más rápido.
  useEffect(() => {
    prepararSubida();
  }, []);

  // Solo las fotos ya subidas: las que estaban subiendo se pierden con la recarga.
  useEffect(() => {
    try {
      sessionStorage.setItem(
        GUARDADO,
        JSON.stringify({
          valores,
          abierto: abierto === "fotos" ? "fotos" : null,
          subidas: subidas.filter((s) => s.archivo),
          contador: contador.current,
        })
      );
    } catch {
      // Sin sessionStorage la carga anda igual, solo que no sobrevive a una recarga.
    }
  }, [valores, abierto, subidas]);

  const sinCamaraEnPagina = useCallback(() => {
    setCamara(false);
    inputCamara.current?.click();
  }, [setCamara]);
  const abrirCamara = () => (hayCamaraEnPagina() ? setCamara(true) : inputCamara.current?.click());

  const fotosOk = subidas.filter((s) => !s.fallo);
  const completo = (campo) => {
    if (campo === "fotos") return fotosOk.length > 0;
    if (campo === "monto") return montoDe(valores.monto) > 0;
    return String(valores[campo] || "").trim() !== "";
  };
  const faltantes = OBLIGATORIOS.filter((c) => !completo(c));

  const elegir = (campo, valor) => {
    setValores((prev) => ({ ...prev, [campo]: valor }));
    setAbierto(null);
  };
  const alternar = (campo) => setAbierto((prev) => (prev === campo ? null : campo));

  const textoValor = (campo) => {
    if (campo === "fecha") return dmy(valores.fecha);
    if (campo === "concepto") return CONCEPTOS[valores.concepto]?.texto || "";
    if (campo === "monto") return pesos(montoDe(valores.monto));
    if (campo === "fotos") return fotosOk.length === 1 ? "1 foto" : `${fotosOk.length} fotos`;
    return valores[campo];
  };

  const agregarFotos = (ev) => {
    const files = [...(ev.target.files || [])];
    ev.target.value = "";
    agregarArchivos(files);
  };

  const agregarArchivos = (files) => {
    for (const f of files) {
      contador.current += 1;
      const clave = `foto-${contador.current}`;
      setSubidas((l) => [...l, { clave, nombre: f.name, archivo: null, fallo: false }]);
      const promesa = subirArchivo(f, { achicar: true })
        .then((archivo) => {
          setSubidas((l) => l.map((s) => (s.clave === clave ? { ...s, archivo } : s)));
          return archivo;
        })
        .catch((err) => {
          setSubidas((l) => l.map((s) => (s.clave === clave ? { ...s, fallo: true } : s)));
          Swal.fire({ icon: "error", title: "No se pudo subir", text: `${f.name}: ${err.message}`, width: "300px" });
          return null;
        });
      promesas.current.set(clave, promesa);
    }
  };

  const sacarFoto = (s) => {
    setSubidas((l) => l.filter((x) => x.clave !== s.clave));
    const promesa = promesas.current.get(s.clave);
    promesas.current.delete(s.clave);
    // Si ya subió (o cuando termine), fuera de Cloudinary.
    promesa?.then((a) => a && borrarArchivo(a));
  };

  const guardar = async () => {
    if (enCurso.current) return;
    if (faltantes.length > 0) {
      const lista = faltantes.map((c) => ETIQUETAS[c]);
      await Swal.fire({
        icon: "warning",
        title: lista.length === 1 ? "Falta un dato" : "Faltan datos",
        text: `Completá: ${lista.join(", ")}.`,
        width: "320px",
        confirmButtonColor: "#1e293b",
      });
      // Abre la primera que falta, para no tener que buscarla.
      setAbierto(faltantes[0]);
      return;
    }
    enCurso.current = true;
    setGuardando(true);
    try {
      // Se esperan las fotos que todavía están subiendo.
      const archivos = (await Promise.all([...promesas.current.values()])).filter(Boolean);
      await api.post("/contable/caja", {
        fecha: valores.fecha,
        concepto: valores.concepto,
        monto: montoDe(valores.monto),
        descripcion: valores.descripcion.trim(),
        observaciones: valores.observaciones.trim(),
        archivos,
      });
      borrarGuardado();
      await Swal.fire({ icon: "success", title: "Movimiento cargado", timer: 1500, showConfirmButton: false, width: "300px" });
      navigate("/compras/caja");
    } catch (err) {
      Swal.fire({ icon: "error", title: "No se pudo guardar", text: err.message, width: "300px" });
    } finally {
      enCurso.current = false;
      setGuardando(false);
    }
  };

  const subiendo = subidas.some((s) => !s.archivo && !s.fallo);

  return (
    <div className="caja-cel-centrado mx-auto px-3 py-3 d-flex flex-column justify-content-center" style={{ maxWidth: "480px" }}>
      <div className="d-flex justify-content-end mb-2">
        <Button
          size="sm"
          variant="outline-secondary"
          onClick={() => {
            // Lo que ya había subido no se va a usar: fuera de Cloudinary.
            subidas.forEach((s) => s.archivo && borrarArchivo(s.archivo));
            borrarGuardado();
            navigate("/compras/caja");
          }}
        >
          Cancelar
        </Button>
      </div>

      {FILAS.map((fila, i) => (
        <div key={i}>
          <Row className="g-2 mb-2">
            {fila.map((campo) => {
              const estaAbierto = abierto === campo;
              const listo = completo(campo);
              const colorConcepto = campo === "concepto" && listo ? CONCEPTOS[valores.concepto].color : null;
              return (
                <Col xs={4} key={campo}>
                  <Card
                    role="button"
                    onClick={() => alternar(campo)}
                    className="h-100"
                    style={{
                      backgroundColor: listo ? "rgba(22, 78, 99, 0.10)" : "#f8f9fa",
                      borderColor: estaAbierto ? COLOR : listo ? "rgba(22, 78, 99, 0.35)" : "#dee2e6",
                    }}
                  >
                    <Card.Body className="px-2 py-3 text-center d-flex flex-column justify-content-center" style={{ minHeight: "86px" }}>
                      <div className="text-muted text-uppercase mb-1" style={{ fontSize: "0.72rem" }}>
                        {ETIQUETAS[campo]}
                        {!OBLIGATORIOS.includes(campo) && <span style={{ textTransform: "none" }}> (opc.)</span>}
                      </div>
                      <div
                        title={listo ? textoValor(campo) : undefined}
                        className={`caja-cel-valor ${listo ? "fw-semibold" : "fst-italic text-body-tertiary"}`}
                        style={{ fontSize: "1rem", lineHeight: 1.2, opacity: listo ? 1 : 0.7, color: colorConcepto || undefined }}
                      >
                        {listo ? textoValor(campo) : campo === "fotos" && subiendo ? "Subiendo…" : "Tocar"}
                      </div>
                    </Card.Body>
                  </Card>
                </Col>
              );
            })}
          </Row>

          {/* El panel va debajo de la fila tocada, a lo ancho. */}
          {fila.includes(abierto) && (
            <Card className="mb-2" style={{ borderColor: COLOR, backgroundColor: "#f8f9fa" }}>
              <Card.Header className="py-2 fw-semibold" style={{ fontSize: "0.9rem", borderBottom: `0.5px solid ${COLOR}` }}>
                {ETIQUETAS[abierto] === "Observ." ? "Observaciones" : ETIQUETAS[abierto]}
              </Card.Header>

              {abierto === "fecha" && (
                <Card.Body className="d-flex flex-column align-items-center">
                  <Form.Control
                    type="date"
                    value={valores.fecha}
                    max={hoyIso()}
                    onChange={(e) => e.target.value && elegir("fecha", e.target.value)}
                    className="text-center"
                    style={{ maxWidth: "200px", height: "48px", fontSize: "1.1rem" }}
                  />
                </Card.Body>
              )}

              {abierto === "concepto" && (
                <ListGroup variant="flush">
                  {Object.entries(CONCEPTOS).map(([clave, c]) => (
                    <ListGroup.Item
                      key={clave}
                      action
                      onClick={() => elegir("concepto", clave)}
                      className="caja-cel-opcion py-3 bg-transparent fw-semibold"
                      style={{ color: c.color, backgroundColor: valores.concepto === clave ? "rgba(22, 78, 99, 0.10)" : undefined }}
                    >
                      {c.texto}
                    </ListGroup.Item>
                  ))}
                </ListGroup>
              )}

              {abierto === "monto" && (
                <Card.Body className="d-flex flex-column align-items-center">
                  {/* Sin placeholder: un 0 en gris se lee como un valor cargado. */}
                  <Form.Control
                    type="text"
                    inputMode="decimal"
                    autoFocus
                    value={valores.monto}
                    className="text-center"
                    style={{ maxWidth: "180px", height: "60px", fontSize: "1.6rem" }}
                    onFocus={(e) => {
                      const el = e.target;
                      setTimeout(() => el.select(), 0);
                    }}
                    onChange={(e) => setValores((prev) => ({ ...prev, monto: formatearMonto(e.target.value) }))}
                  />
                  <Button
                    size="sm"
                    variant="outline-secondary"
                    className="mt-2"
                    style={{ maxWidth: "180px", width: "100%" }}
                    disabled={!(montoDe(valores.monto) > 0)}
                    onClick={() => setAbierto(null)}
                  >
                    Listo
                  </Button>
                </Card.Body>
              )}

              {(abierto === "descripcion" || abierto === "observaciones") && (
                <Card.Body className="d-flex flex-column align-items-center">
                  <Form.Control
                    as="textarea"
                    rows={abierto === "descripcion" ? 2 : 3}
                    autoFocus
                    maxLength={abierto === "descripcion" ? 300 : 1000}
                    value={valores[abierto]}
                    onChange={(e) => setValores((prev) => ({ ...prev, [abierto]: e.target.value }))}
                    style={{ fontSize: "1rem" }}
                  />
                  <Button size="sm" variant="outline-secondary" className="mt-2" style={{ maxWidth: "180px", width: "100%" }} onClick={() => setAbierto(null)}>
                    Listo
                  </Button>
                </Card.Body>
              )}

              {abierto === "fotos" && (
                <Card.Body>
                  {subidas.length > 0 && (
                    <ListGroup className="mb-2">
                      {subidas.map((s) => (
                        <ListGroup.Item key={s.clave} className="d-flex align-items-center gap-2 py-2" style={{ fontSize: "0.85rem" }}>
                          {s.archivo ? (
                            <i className="bi bi-check-circle-fill" style={{ color: "#15803d" }}></i>
                          ) : s.fallo ? (
                            <i className="bi bi-x-circle-fill" style={{ color: "#dc2626" }}></i>
                          ) : (
                            <Spinner animation="border" size="sm" style={{ width: "0.85rem", height: "0.85rem" }} />
                          )}
                          <span className="flex-grow-1 text-truncate">{s.nombre}</span>
                          <Button size="sm" variant="link" className="p-0 text-danger" onClick={() => sacarFoto(s)} title="Sacar">
                            <i className="bi bi-trash"></i>
                          </Button>
                        </ListGroup.Item>
                      ))}
                    </ListGroup>
                  )}
                  <div className="d-flex gap-2 justify-content-center">
                    <Button size="sm" variant="outline-secondary" onClick={abrirCamara}>
                      <i className="bi bi-camera-fill me-1"></i>Sacar foto
                    </Button>
                    {/* La cámara de siempre, por si el teléfono no deja usarla en la página. */}
                    <input ref={inputCamara} type="file" accept="image/*" capture="environment" hidden onChange={agregarFotos} />
                    <Form.Label className="btn btn-sm btn-outline-secondary mb-0">
                      <i className="bi bi-images me-1"></i>Galería
                      <input type="file" accept="image/*,application/pdf" multiple hidden onChange={agregarFotos} />
                    </Form.Label>
                  </div>
                </Card.Body>
              )}
            </Card>
          )}
        </div>
      ))}

      <div className="d-flex justify-content-center mt-3">
        {/* Habilitado siempre: si falta algo lo dice, en vez de quedarse apagado
            sin explicar por qué. */}
        <Button
          variant="outline-secondary"
          style={{ minWidth: "140px", borderColor: COLOR, color: COLOR, fontWeight: 600 }}
          onClick={guardar}
          disabled={guardando}
        >
          {guardando ? <Spinner animation="border" size="sm" /> : "Guardar"}
        </Button>
      </div>

      {camara && <Camara onHide={() => setCamara(false)} onFoto={(f) => agregarArchivos([f])} onSinCamara={sinCamaraEnPagina} />}
    </div>
  );
}
