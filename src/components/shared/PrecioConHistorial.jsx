import { useEffect, useState } from "react";
import { Button, Form, InputGroup, Modal, Table } from "react-bootstrap";
import Swal from "sweetalert2";
import { api } from "../../services/api";

/**
 * Un precio con su fecha y su historial (07/11/2026): hoy el del gasoil y el
 * del dólar, arriba de Contable › Equivalencias tareas/variables.
 *
 * Uno por fecha; rige el de la fecha más nueva. Los inputs muestran el
 * vigente bloqueados; "Actualizar" los abre para cargar uno nuevo (si ya hay
 * uno ese día, lo pisa). Los anteriores se ven, se corrigen (lápiz, fecha y
 * precio) y se borran en el historial.
 *
 * `ruta` es la del back (GET lista, PUT { fecha, precio }, DELETE /:id).
 * `nombre` va en minúscula en los textos ("el precio del gasoil").
 */

const hoyISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
// La fecha viene a las 00:00 UTC del día: se lee sin pasarla a hora local.
const fechaCorta = (f) => {
  const [a, m, d] = String(f || "").slice(0, 10).split("-");
  return d ? `${d}/${m}/${a}` : "";
};
// Formato de moneda argentino, igual que en Producción: $ 12.500,00.
const formatPesos = (valor) =>
  valor === null || valor === undefined || valor === ""
    ? "—"
    : Number(valor).toLocaleString("es-AR", {
        style: "currency",
        currency: "ARS",
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });
// La fecha y hora de carga, para el historial.
const fechaHora = (f) =>
  f
    ? new Date(f).toLocaleString("es-AR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "";

const td = { fontSize: "0.7rem", padding: "1px 5px", verticalAlign: "middle" };
const raya = <span style={{ color: "#cbd5e1" }}>—</span>;

function PrecioConHistorial({ titulo, subtitulo, nombre, icono, ruta, unidad, color, sinEditar }) {
  const th = {
    backgroundColor: color,
    color: "#fff",
    fontSize: "0.66rem",
    fontWeight: 600,
    verticalAlign: "middle",
    padding: "3px 5px",
    whiteSpace: "nowrap",
  };

  // Llegan del más nuevo al más viejo: el primero es el que rige.
  const [precios, setPrecios] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [fecha, setFecha] = useState(hoyISO);
  const [precio, setPrecio] = useState("");
  const [editando, setEditando] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [verHistorial, setVerHistorial] = useState(false);
  // El renglón del historial que se está corrigiendo: { id, fecha, precio }.
  const [fila, setFila] = useState(null);
  const [guardandoFila, setGuardandoFila] = useState(false);

  // La lista y, en los inputs, el que queda rigiendo.
  const poner = (lista) => {
    const vigente = lista[0];
    setPrecios(lista);
    setFecha(vigente ? String(vigente.fecha).slice(0, 10) : hoyISO());
    setPrecio(vigente ? String(vigente.precio) : "");
    setEditando(false);
  };

  useEffect(() => {
    let vigente = true;
    api
      .get(ruta)
      .catch(() => [])
      .then((lista) => vigente && poner(Array.isArray(lista) ? lista : []))
      .finally(() => vigente && setCargando(false));
    return () => {
      vigente = false;
    };
  }, [ruta]);

  const guardar = async (ev) => {
    ev.preventDefault();
    const valor = Number(String(precio).replace(",", "."));
    if (!fecha || !(valor > 0)) return;
    setGuardando(true);
    try {
      const doc = await api.put(ruta, { fecha, precio: valor });
      poner(
        [...precios.filter((x) => String(x._id) !== String(doc._id)), doc].sort((a, b) =>
          String(b.fecha).localeCompare(String(a.fecha))
        )
      );
      Swal.fire({ icon: "success", title: "Guardado", timer: 1500, showConfirmButton: false, width: "300px" });
    } catch (err) {
      Swal.fire({ icon: "error", title: "No se pudo guardar", text: err.message, width: "300px" });
    } finally {
      setGuardando(false);
    }
  };

  const ordenarLista = (lista) => [...lista].sort((a, b) => String(b.fecha).localeCompare(String(a.fecha)));

  // Corregir un renglón del historial: fecha y precio (07/11/2026).
  const editarFila = (p) => setFila({ id: p._id, fecha: String(p.fecha).slice(0, 10), precio: String(p.precio) });
  const guardarFila = async () => {
    const valor = Number(String(fila.precio).replace(",", "."));
    if (!fila.fecha || !(valor > 0)) return;
    setGuardandoFila(true);
    try {
      const doc = await api.put(`${ruta}/${fila.id}`, { fecha: fila.fecha, precio: valor });
      poner(ordenarLista(precios.map((x) => (String(x._id) === String(doc._id) ? doc : x))));
      setFila(null);
      Swal.fire({ icon: "success", title: "Guardado", timer: 1500, showConfirmButton: false, width: "300px" });
    } catch (err) {
      Swal.fire({ icon: "error", title: "No se pudo guardar", text: err.message, width: "300px" });
    } finally {
      setGuardandoFila(false);
    }
  };

  const borrar = async (p) => {
    const { isConfirmed } = await Swal.fire({
      icon: "warning",
      title: "¿Borrar el precio?",
      text: `Se borra el precio del ${nombre} del ${fechaCorta(p.fecha)} (${formatPesos(p.precio)}). Esta acción no se puede deshacer.`,
      width: "320px",
      showCancelButton: true,
      confirmButtonText: "Sí, borrar",
      cancelButtonText: "Cancelar",
      confirmButtonColor: "#dc2626",
      cancelButtonColor: "#64748b",
    });
    if (!isConfirmed) return;
    const antes = precios;
    poner(antes.filter((x) => x._id !== p._id));
    api.delete(`${ruta}/${p._id}`).catch((err) => {
      poner(antes);
      Swal.fire({ icon: "error", title: "No se pudo borrar", text: err.message, width: "300px" });
    });
  };

  return (
    <>
      <div className="d-flex align-items-center gap-2 flex-wrap">
        {/* Ancho fijo, así los renglones quedan alineados uno abajo del otro. */}
        <span
          className="d-flex align-items-center gap-2"
          style={{ color, fontSize: "0.85rem", fontWeight: 700, width: "105px" }}
        >
          <i className={`bi ${icono}`}></i>
          <span className="d-flex flex-column" style={{ lineHeight: 1.1 }}>
            {titulo}
            {/* Una aclaración abajo, en letra más suave (ej. "oficial, venta"). */}
            {subtitulo && (
              <span style={{ fontSize: "0.64rem", fontWeight: 400, color: "#64748b" }}>{subtitulo}</span>
            )}
          </span>
        </span>
        <Form onSubmit={guardar} className="d-flex align-items-center gap-2 flex-wrap">
          <Form.Control
            type="date"
            size="sm"
            value={fecha}
            onChange={(e) => setFecha(e.target.value)}
            disabled={!editando}
            className="text-center"
            style={{ width: "120px", fontSize: "0.8rem" }}
            title="Fecha desde la que rige el precio"
          />
          {editando ? (
            <InputGroup size="sm" style={{ width: "115px" }}>
              <InputGroup.Text className="bg-light text-muted" style={{ fontSize: "0.8rem", fontWeight: 700 }}>
                $
              </InputGroup.Text>
              <Form.Control
                type="number"
                step="any"
                min="0"
                autoFocus
                value={precio}
                onChange={(e) => setPrecio(e.target.value)}
                className="text-center"
                style={{ fontSize: "0.8rem", fontWeight: 700, color }}
                placeholder={unidad}
              />
            </InputGroup>
          ) : (
            <Form.Control
              type="text"
              size="sm"
              readOnly
              disabled
              value={precios.length ? formatPesos(precio) : ""}
              placeholder="Sin precio"
              className="text-center"
              style={{ width: "115px", fontSize: "0.8rem", fontWeight: 700, color }}
              title={`Precio ${unidad} vigente`}
            />
          )}
          {editando ? (
            <>
              <Button
                type="submit"
                size="sm"
                disabled={guardando || !fecha || !(Number(precio) > 0)}
                className="rounded-3 px-3 d-flex align-items-center gap-2"
                style={{ backgroundColor: color, borderColor: color, fontSize: "0.78rem", height: "30px", fontWeight: 600 }}
              >
                <i className="bi bi-check-lg"></i>
                <span>Guardar</span>
              </Button>
              <Button
                size="sm"
                variant="outline-secondary"
                onClick={() => poner(precios)}
                disabled={guardando}
                className="rounded-3 px-3"
                style={{ fontSize: "0.78rem", height: "30px" }}
              >
                Cancelar
              </Button>
            </>
          ) : (
            <Button
              size="sm"
              onClick={() => setEditando(true)}
              disabled={sinEditar || cargando}
              className="rounded-3 px-3 d-flex align-items-center gap-2"
              style={{ backgroundColor: color, borderColor: color, fontSize: "0.78rem", height: "30px", fontWeight: 600 }}
              title={sinEditar ? "Sin permiso para editar" : "Cargar un precio nuevo"}
            >
              <i className="bi bi-arrow-repeat"></i>
              <span>Actualizar</span>
            </Button>
          )}
        </Form>
        <Button
          size="sm"
          variant="outline-secondary"
          onClick={() => setVerHistorial(true)}
          disabled={cargando || !precios.length}
          className="rounded-3 px-3 d-flex align-items-center gap-2"
          style={{ fontSize: "0.78rem", height: "30px", fontWeight: 600 }}
        >
          <i className="bi bi-clock-history"></i>
          <span>Historial</span>
        </Button>
      </div>

      {/* El historial, como el de Producción › Variables. */}
      <Modal
        show={verHistorial}
        onHide={() => {
          setVerHistorial(false);
          setFila(null);
        }}
        centered
        size="lg"
        contentClassName="border-0 shadow-lg rounded-4"
      >
        <Modal.Header
          closeButton
          closeVariant="white"
          style={{
            backgroundColor: color,
            color: "#fff",
            borderTopLeftRadius: "1rem",
            borderTopRightRadius: "1rem",
          }}
        >
          <Modal.Title className="fs-6 fw-bold d-flex align-items-center gap-2 text-white">
            <i className="bi bi-clock-history" style={{ color: "#a5f3fc" }}></i>
            <span>Historial del precio del {nombre}</span>
          </Modal.Title>
        </Modal.Header>
        <Modal.Body className="p-4" style={{ minHeight: "320px", maxHeight: "65vh", overflowY: "auto" }}>
          <div className="shadow-sm rounded-3 bg-white" style={{ border: "1px solid #cbd5e1", overflow: "hidden" }}>
            <Table className="text-center align-middle mb-0 tabla-informe" style={{ width: "100%" }}>
              <thead>
                <tr>
                  <th style={{ ...th, width: "170px" }}>Vigencia desde</th>
                  <th style={th}>Precio {unidad}</th>
                  <th style={th}>Cargado por</th>
                  <th style={{ ...th, width: "150px" }}>Fecha de carga</th>
                  <th style={{ ...th, width: "90px" }}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {precios.map((p, i) => {
                  const enEdicion = fila?.id === p._id;
                  return (
                  <tr key={p._id} className={enEdicion ? "fila-editando" : undefined}>
                    <td style={td} className="fw-semibold text-dark">
                      {enEdicion ? (
                        <Form.Control
                          type="date"
                          size="sm"
                          value={fila.fecha}
                          onChange={(e) => setFila((f) => ({ ...f, fecha: e.target.value }))}
                          className="text-center mx-auto"
                          style={{ width: "130px", fontSize: "0.75rem" }}
                        />
                      ) : (
                        fechaCorta(p.fecha)
                      )}
                      {!enEdicion && i === 0 && (
                        <span
                          className="ms-2 px-2 rounded-pill"
                          style={{ backgroundColor: "#dcfce7", color: "#15803d", fontSize: "0.68rem", fontWeight: 700 }}
                        >
                          vigente
                        </span>
                      )}
                    </td>
                    <td style={{ ...td, fontWeight: 700, color }}>
                      {enEdicion ? (
                        <InputGroup size="sm" className="mx-auto" style={{ width: "130px" }}>
                          <InputGroup.Text className="bg-light text-muted" style={{ fontSize: "0.75rem", fontWeight: 700 }}>
                            $
                          </InputGroup.Text>
                          <Form.Control
                            type="number"
                            step="any"
                            min="0"
                            autoFocus
                            value={fila.precio}
                            onChange={(e) => setFila((f) => ({ ...f, precio: e.target.value }))}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") guardarFila();
                              if (e.key === "Escape") setFila(null);
                            }}
                            className="text-center"
                            style={{ fontSize: "0.75rem", fontWeight: 700, color }}
                          />
                        </InputGroup>
                      ) : (
                        formatPesos(p.precio)
                      )}
                    </td>
                    <td style={td}>{p.cargadoPor || raya}</td>
                    <td style={td} className="text-secondary">
                      {fechaHora(p.updatedAt) || raya}
                    </td>
                    <td style={td}>
                      <div className="d-flex justify-content-center align-items-center" style={{ gap: "10px" }}>
                        {enEdicion ? (
                          <>
                            <button
                              onClick={guardarFila}
                              disabled={guardandoFila || !fila.fecha || !(Number(fila.precio) > 0)}
                              className="btn btn-sm btn-outline-success d-flex align-items-center justify-content-center rounded-2 p-0"
                              style={{ width: "24px", height: "24px" }}
                              title="Guardar"
                            >
                              <i className="bi bi-check-lg" style={{ fontSize: "0.85rem" }}></i>
                            </button>
                            <button
                              onClick={() => setFila(null)}
                              disabled={guardandoFila}
                              className="btn btn-sm btn-outline-secondary d-flex align-items-center justify-content-center rounded-2 p-0"
                              style={{ width: "24px", height: "24px" }}
                              title="Cancelar"
                            >
                              <i className="bi bi-x-lg" style={{ fontSize: "0.75rem" }}></i>
                            </button>
                          </>
                        ) : (
                          <>
                        <button
                          onClick={() => editarFila(p)}
                          disabled={sinEditar || Boolean(fila)}
                          className="btn btn-sm btn-outline-primary d-flex align-items-center justify-content-center rounded-2 p-0"
                          style={{ width: "24px", height: "24px" }}
                          title={sinEditar ? "Sin permiso para editar" : "Editar este precio"}
                        >
                          <i className="bi bi-pencil" style={{ fontSize: "0.8rem" }}></i>
                        </button>
                        <button
                          onClick={() => borrar(p)}
                          disabled={sinEditar || Boolean(fila)}
                          className="btn btn-sm btn-outline-danger d-flex align-items-center justify-content-center rounded-2 p-0"
                          style={{ width: "24px", height: "24px" }}
                          title={sinEditar ? "Sin permiso para editar" : "Borrar este precio"}
                        >
                          <i className="bi bi-trash" style={{ fontSize: "0.8rem" }}></i>
                        </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                  );
                })}
                {!precios.length && (
                  <tr>
                    <td colSpan={5} className="text-center text-muted py-4" style={td}>
                      No hay precios cargados
                    </td>
                  </tr>
                )}
              </tbody>
            </Table>
          </div>
        </Modal.Body>
        <Modal.Footer
          className="bg-light border-0 py-2 px-4"
          style={{ borderBottomLeftRadius: "1rem", borderBottomRightRadius: "1rem" }}
        >
          <span className="text-muted me-auto" style={{ fontSize: "0.76rem" }}>
            Rige el precio de la fecha más nueva
          </span>
          <Button
            variant="outline-secondary"
            size="sm"
            onClick={() => setVerHistorial(false)}
            className="rounded-3 px-3"
            style={{ fontSize: "0.84rem" }}
          >
            Cerrar
          </Button>
        </Modal.Footer>
      </Modal>
    </>
  );
}

export default PrecioConHistorial;
