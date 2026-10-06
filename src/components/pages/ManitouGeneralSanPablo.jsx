import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import Swal from "sweetalert2";
import { Button, Form, Modal } from "react-bootstrap";
import { api } from "../../services/api";
import { cosechaDeParam } from "../../utils/cosechas";
import { usePermisos } from "../../context/permisos";
import TractorIcon from "../shared/TractorIcon";
import NavbarSanPablo from "../shared/NavbarSanPablo";
import TarjetasSanPablo from "../shared/TarjetasSanPablo";
import { SISTEMAS_MANITOU } from "../../utils/sistemasManitou";

// Cian, para distinguirlas de las tarjetas verdes de Manitous.
const cian = {
  bg: "linear-gradient(135deg, #164e63 0%, #0e7490 100%)",
  hoverBg: "linear-gradient(135deg, #083344 0%, #164e63 100%)",
  accentColor: "#22d3ee",
};
// El verde de Manitous, para el título.
const VERDE = "#047857";
const COLOR = "#1e293b";
const SECCION = "manitous-general";
const ANCHO = "min(500px, calc(100vh - 200px))";

// Manitous › General: una tarjeta por sistema de la máquina (06/10/2026),
// cada una con su tabla de chequeo (ChequeosManitou).
const tarjetas = SISTEMAS_MANITOU.map((t) => ({ ...t, ...cian }));

function ManitouGeneralSanPablo() {
  const { cosecha: param } = useParams();
  const cosecha = cosechaDeParam(param);
  const { puede } = usePermisos();
  const sinEditar = !puede("sanpablo.ingresos", "editar");

  // Los responsables guardados (se ven afuera, uno abajo del otro) y, con el
  // modal abierto, el nombre que se está escribiendo.
  const [responsables, setResponsables] = useState([]);
  const [nombre, setNombre] = useState(null);
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    api
      .get(`/ingresos-sanpablo/responsables?cosecha=${cosecha}&seccion=${SECCION}`)
      .then((r) => setResponsables(r.nombres))
      .catch(() => setResponsables([]));
  }, [cosecha]);

  const cerrar = () => setNombre(null);

  // Se guarda la lista entera: la de ahora con el nombre nuevo, o sin uno.
  const guardarLista = async (nombres) => {
    setGuardando(true);
    try {
      const r = await api.put("/ingresos-sanpablo/responsables", { cosecha, seccion: SECCION, nombres });
      setResponsables(r.nombres);
      return true;
    } catch (err) {
      Swal.fire({ icon: "error", title: "No se pudo guardar", text: err.message });
      return false;
    } finally {
      setGuardando(false);
    }
  };

  const agregar = async (e) => {
    e.preventDefault();
    if (!nombre.trim()) return;
    if (await guardarLista([...responsables, nombre])) cerrar();
  };

  const quitar = (i) => guardarLista(responsables.filter((_, j) => j !== i));

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
      {/* La cosecha y Manitou › General ya están en el encabezado de abajo. */}
      <NavbarSanPablo
        icono={<i className="bi bi-grid-fill"></i>}
        volverA={`/reparaciones/sanpablo/${param}/manitous`}
      />

      {/* Las 8 tarjetas en dos filas de 4, sin scroll, a la mitad del tamaño
          de las de la cosecha. Arriba, bien visible, que es Manitou, y los
          responsables. */}
      <TarjetasSanPablo
        tarjetas={tarjetas}
        base={`/reparaciones/sanpablo/${param}/manitous/general`}
        porFila={4}
        maxWidth={ANCHO}
        chicas
      >
        <div
          className="d-flex align-items-start justify-content-between gap-3 mb-4 pb-3"
          style={{ maxWidth: ANCHO, width: "100%", borderBottom: `3px solid ${VERDE}` }}
        >
          <div className="d-flex align-items-center gap-3">
            <div
              className="d-flex align-items-center justify-content-center"
              style={{
                width: "56px",
                height: "56px",
                borderRadius: "14px",
                background: "linear-gradient(135deg, #064e3b 0%, #047857 100%)",
                boxShadow: "0 6px 16px rgba(4, 120, 87, 0.35)",
                flexShrink: 0,
              }}
            >
              <TractorIcon size="2rem" color="#fff" />
            </div>
            <div>
              <div className="fw-bold" style={{ fontSize: "2rem", lineHeight: 1, color: VERDE, letterSpacing: "0.02em" }}>
                MANITOU
              </div>
              <div className="text-secondary fw-semibold" style={{ fontSize: "0.9rem" }}>
                General · Cosecha {param}
              </div>
            </div>
          </div>

          {/* El botón y, debajo, los responsables cargados. */}
          <div className="d-flex flex-column align-items-end gap-1">
            <Button
              size="sm"
              onClick={() => setNombre("")}
              disabled={sinEditar}
              className="rounded-3 px-3 py-1 shadow-sm d-flex align-items-center gap-1"
              style={{ backgroundColor: COLOR, borderColor: COLOR, fontSize: "0.84rem", fontWeight: 600 }}
            >
              <i className="bi bi-person-plus-fill"></i>
              <span>Responsable</span>
            </Button>
            {responsables.map((r, i) => (
              <div
                key={r}
                className="d-flex align-items-center gap-1 fw-semibold"
                style={{ fontSize: "0.85rem", color: COLOR }}
              >
                <i className="bi bi-person-fill text-secondary"></i>
                <span>{r}</span>
                {!sinEditar && (
                  <button
                    type="button"
                    onClick={() => quitar(i)}
                    disabled={guardando}
                    title="Quitar"
                    className="btn btn-link p-0 text-danger"
                    style={{ fontSize: "0.8rem", lineHeight: 1 }}
                  >
                    <i className="bi bi-x-lg"></i>
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      </TarjetasSanPablo>

      {/* Modal Responsable: un solo campo; cada uno que se guarda se suma
          abajo del botón. */}
      <Modal show={nombre !== null} onHide={cerrar} centered size="sm" contentClassName="border-0 shadow-lg rounded-4">
        <Modal.Header
          closeButton
          closeVariant="white"
          style={{
            backgroundColor: COLOR,
            color: "#fff",
            borderTopLeftRadius: "1rem",
            borderTopRightRadius: "1rem",
            borderBottom: "1px solid rgba(255,255,255,0.1)",
          }}
        >
          <Modal.Title className="fs-6 fw-normal d-flex align-items-center gap-2 text-white">
            <i className="bi bi-person-plus-fill"></i>
            <span>Responsable</span>
          </Modal.Title>
        </Modal.Header>
        {nombre !== null && (
          <Form onSubmit={agregar}>
            <Modal.Body className="p-4">
              <Form.Label className="fw-semibold text-dark small mb-1">Responsable</Form.Label>
              <Form.Control
                className="rounded-3"
                size="sm"
                value={nombre}
                placeholder="Nombre del responsable"
                onChange={(e) => setNombre(e.target.value)}
                autoFocus
                required
              />
            </Modal.Body>
            <Modal.Footer
              className="bg-light border-0 py-2 px-4"
              style={{ borderBottomLeftRadius: "1rem", borderBottomRightRadius: "1rem" }}
            >
              <Button
                variant="outline-secondary"
                size="sm"
                onClick={cerrar}
                className="rounded-3 px-3 py-1"
                style={{ fontSize: "0.84rem" }}
              >
                Cancelar
              </Button>
              <Button
                size="sm"
                type="submit"
                disabled={guardando}
                className="rounded-3 px-3 py-1 shadow-sm d-flex align-items-center gap-1"
                style={{ backgroundColor: "#15803d", borderColor: "#15803d", fontSize: "0.84rem", fontWeight: 600 }}
              >
                <i className="bi bi-check-lg"></i>
                <span>Guardar</span>
              </Button>
            </Modal.Footer>
          </Form>
        )}
      </Modal>
    </div>
  );
}

export default ManitouGeneralSanPablo;
