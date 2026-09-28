import { useEffect, useState } from 'react'
import { Button, Form, InputGroup, Modal, Row, Col } from 'react-bootstrap'
import { api } from '../../services/api'
import SelectBuscador from '../shared/SelectBuscador'
import { compararCC } from '../../utils/ordenCC'
import { GRUPOS_PEDIDO } from '../../utils/equipos'
import { litros, nombreAceite } from './aceites'

/**
 * Cargar o corregir una compra o un consumo de aceite (28/09/2026).
 *
 * Son los dos modales del Sistema de Gestión Lepa en uno: la compra pide
 * proveedor, marca y precio, y el consumo a qué equipo fue. La máquina de
 * allá acá es el centro de costo, que se elige después del grupo como en las
 * salidas del almacén; "Berdina" va al taller y no lleva C.C.
 *
 * Al corregir no se puede cambiar el aceite: lo mal cargado se borra y se
 * carga de nuevo, igual que en el almacén.
 */
const BERDINA = 'Berdina'

export default function ModalMovimientoAceite({ mov, datos, aceites, guardando, onCampo, onGuardar, onCerrar }) {
  const [centrosCosto, setCentrosCosto] = useState([])
  const [proveedores, setProveedores] = useState([])

  // Los padrones hacen falta solo para este formulario: se piden desde acá.
  useEffect(() => {
    api
      .get('/centros-costo')
      .then((data) => setCentrosCosto(Array.isArray(data) ? data : []))
      .catch(() => setCentrosCosto([]))
    api
      .get('/proveedores')
      .then((data) => setProveedores(Array.isArray(data) ? data : []))
      .catch(() => setProveedores([]))
  }, [])

  const compra = mov?.movimiento === 'Entrada'
  const fondo = compra ? '#15803d' : '#9d2235'
  const aceite = aceites.find((a) => a._id === datos.aceite)

  const opcionesAceite = aceites.map((a) => ({
    valor: a._id,
    texto: `${nombreAceite(a)} — hay ${litros(a.existencia)} L`,
  }))

  const opcionesProveedor = [...new Set(proveedores.map((p) => p.razonsocial).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b))
    .map((p) => ({ valor: p, texto: p }))

  // Los grupos que tienen algún CC en el padrón, en el orden de Compras, y
  // Berdina arriba de todo.
  const opcionesGrupo = [
    { valor: BERDINA, texto: `${BERDINA} (va al taller, sin C.C.)`, destacada: true },
    ...GRUPOS_PEDIDO.filter((g) => centrosCosto.some((c) => c.grupo === g)).map((g) => ({ valor: g, texto: g })),
  ]

  const opcionesCC = centrosCosto
    .filter((c) => c.grupo === datos.grupo)
    .sort((a, b) => compararCC(a.cc, b.cc))
    .map((c) => ({ valor: c.cc, texto: [c.cc, c.marca || c.descripcion].filter(Boolean).join(' — ') }))

  const rotulo = (texto, requerido) => (
    <Form.Label className="fw-semibold text-dark small mb-1">
      {texto} {requerido && <span className="text-danger">*</span>}
    </Form.Label>
  )
  const campo = { fontSize: '0.85rem' }

  return (
    <Modal show={!!mov} onHide={onCerrar} centered size="lg" contentClassName="border-0 shadow-lg rounded-4">
      <Modal.Header
        closeButton
        closeVariant="white"
        style={{
          backgroundColor: fondo,
          color: '#fff',
          borderTopLeftRadius: '1rem',
          borderTopRightRadius: '1rem',
          borderBottom: '1px solid rgba(255,255,255,0.1)',
        }}
      >
        <Modal.Title className="fs-6 fw-bold d-flex align-items-center gap-2 text-white">
          <i className={`bi ${compra ? 'bi-cart-plus' : 'bi-droplet-half'}`}></i>
          <span>
            {mov?.editando ? 'Corregir ' : ''}
            {compra ? 'compra de aceite' : 'consumo de aceite'}
          </span>
        </Modal.Title>
      </Modal.Header>
      <Form onSubmit={onGuardar}>
        <Modal.Body className="p-4">
          <Row className="g-3">
            <Col md={4}>
              {rotulo('Fecha', true)}
              <Form.Control
                type="date"
                required
                className="rounded-3"
                style={campo}
                value={datos.fecha}
                onChange={(e) => onCampo('fecha', e.target.value)}
              />
            </Col>

            <Col md={8}>
              {rotulo('Aceite', true)}
              {mov?.editando ? (
                <Form.Control
                  readOnly
                  value={nombreAceite(aceite)}
                  className="rounded-3"
                  style={{ ...campo, backgroundColor: '#f1f5f9', cursor: 'default' }}
                />
              ) : (
                <SelectBuscador
                  opciones={opcionesAceite}
                  valor={datos.aceite}
                  onChange={(v) => {
                    onCampo('aceite', v)
                    // La marca de la compra arranca siendo la del aceite: casi
                    // siempre es la misma.
                    const elegido = aceites.find((a) => a._id === v)
                    if (compra && elegido && !datos.marca) onCampo('marca', elegido.marca)
                  }}
                  vacio="Elegir…"
                  placeholder="Tipo, marca…"
                  className="rounded-3"
                  style={campo}
                />
              )}
            </Col>

            <Col md={4}>
              {rotulo('Litros', true)}
              <InputGroup>
                <Form.Control
                  type="number"
                  step="0.01"
                  min={0.01}
                  max={
                    // Un consumo nuevo no puede sacar más de lo que hay. Al
                    // corregir no se topea: de que alcance se encarga el
                    // servidor.
                    !compra && !mov?.editando && aceite ? aceite.existencia : undefined
                  }
                  required
                  className="rounded-start-3"
                  style={campo}
                  value={datos.litros}
                  onWheel={(e) => e.target.blur()}
                  onChange={(e) => onCampo('litros', e.target.value)}
                />
                <InputGroup.Text style={campo}>L</InputGroup.Text>
              </InputGroup>
              {aceite && (
                <div className="text-muted mt-1" style={{ fontSize: '0.72rem' }}>
                  Hay {litros(aceite.existencia)} L
                </div>
              )}
            </Col>

            {compra ? (
              <>
                <Col md={8}>
                  {rotulo('Proveedor', true)}
                  <SelectBuscador
                    opciones={opcionesProveedor}
                    valor={datos.proveedor}
                    onChange={(v) => onCampo('proveedor', v)}
                    vacio="Elegir…"
                    placeholder="Buscar proveedor…"
                    className="rounded-3"
                    style={campo}
                  />
                </Col>
                <Col md={6}>
                  {rotulo('Marca', true)}
                  <Form.Control
                    required
                    className="rounded-3"
                    placeholder="Shell, YPF, Total…"
                    style={campo}
                    value={datos.marca}
                    onChange={(e) => onCampo('marca', e.target.value)}
                  />
                </Col>
                <Col md={6}>
                  {rotulo('Precio total', true)}
                  <InputGroup>
                    <InputGroup.Text style={campo}>$</InputGroup.Text>
                    <Form.Control
                      type="number"
                      step="0.01"
                      min={0}
                      required
                      className="rounded-end-3"
                      placeholder="Lo que se pagó por todo"
                      style={campo}
                      value={datos.precio}
                      onWheel={(e) => e.target.blur()}
                      onChange={(e) => onCampo('precio', e.target.value)}
                    />
                  </InputGroup>
                </Col>
              </>
            ) : (
              <>
                <Col md={4}>
                  {rotulo('Grupo', true)}
                  <SelectBuscador
                    opciones={opcionesGrupo}
                    valor={datos.grupo}
                    onChange={(v) => {
                      onCampo('grupo', v)
                      onCampo('cc', '')
                    }}
                    vacio="Elegir…"
                    placeholder="Tractores, Camioneta…"
                    className="rounded-3"
                    style={campo}
                  />
                </Col>
                <Col md={4}>
                  {rotulo('C.C.')}
                  {datos.grupo === BERDINA ? (
                    <Form.Control
                      readOnly
                      value="Va a Berdina"
                      className="rounded-3"
                      style={{ ...campo, backgroundColor: '#f1f5f9', cursor: 'default' }}
                    />
                  ) : (
                    <SelectBuscador
                      opciones={opcionesCC}
                      valor={datos.cc}
                      onChange={(v) => onCampo('cc', v)}
                      vacio="Sin C.C."
                      disabled={!datos.grupo}
                      placeholder={datos.grupo ? 'Buscar por número o marca…' : 'Elegí el grupo primero'}
                      className="rounded-3"
                      style={campo}
                    />
                  )}
                </Col>
              </>
            )}

            <Col md={12}>
              {rotulo('Observaciones')}
              <Form.Control
                as="textarea"
                rows={2}
                className="rounded-3"
                placeholder="Notas adicionales…"
                style={campo}
                value={datos.observaciones}
                onChange={(e) => onCampo('observaciones', e.target.value)}
              />
            </Col>
          </Row>
        </Modal.Body>
        <Modal.Footer
          className="bg-light border-0 py-2 px-4"
          style={{ borderBottomLeftRadius: '1rem', borderBottomRightRadius: '1rem' }}
        >
          <Button
            variant="outline-secondary"
            size="sm"
            onClick={onCerrar}
            className="rounded-3 px-3 py-1"
            style={{ fontSize: '0.84rem' }}
          >
            Cancelar
          </Button>
          <Button
            size="sm"
            type="submit"
            disabled={guardando}
            className="rounded-3 px-3 py-1 shadow-sm d-flex align-items-center gap-1"
            style={{ backgroundColor: fondo, borderColor: fondo, fontSize: '0.84rem', fontWeight: 600 }}
          >
            <i className="bi bi-check-lg"></i>
            <span>
              {guardando
                ? 'Guardando…'
                : mov?.editando
                  ? 'Guardar cambios'
                  : compra
                    ? 'Registrar compra'
                    : 'Registrar consumo'}
            </span>
          </Button>
        </Modal.Footer>
      </Form>
    </Modal>
  )
}

